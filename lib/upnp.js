// UPnP/DLNA MediaRenderer control — zero dependencies, like the rest of the app.
//
// Covers Sonos speakers *and* smart TVs (Samsung, LG, Sony, Philips…) and any
// other DLNA renderer: they all speak the same AVTransport/RenderingControl
// SOAP, so one code path drives them all. Renderers are found with an SSDP
// multicast search (plus any UPNP_IPS/SONOS_IPS from the env, for networks
// where multicast doesn't travel, e.g. docker bridge). The renderer fetches
// the audio itself from /api/stream with a cast token, the same cookie-less
// flow the Chromecast uses.
//
// Unlike Sonos — which always lives at port 1400 with fixed service paths — a
// TV puts its renderer wherever it likes (a Samsung Tizen panel answers on
// :9197/dmr, and hosts two *other* unrelated UPnP devices on the same IP), so
// the control URLs are read out of the device description rather than assumed.
import dgram from "node:dgram";
import os from "node:os";
import { config } from "./config.js";

export const escapeXml = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

// Device descriptions are XML, so a friendlyName like `34" Odyssey` arrives as
// `34&quot; Odyssey` — decode before it reaches the UI.
const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export const decodeXml = (s = "") =>
  String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, ent) => {
    if (ent[0] === "#") {
      const code =
        ent[1] === "x" || ent[1] === "X"
          ? parseInt(ent.slice(2), 16)
          : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[ent.toLowerCase()] ?? m;
  });

const IP_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------
// Everything the server will send SOAP to must be a renderer we found (or one
// the admin configured) — never a client-supplied address. This is the SSRF
// guard: /api/sonos/* routes reject IPs outside this set.
const known = new Map(); // ip -> { ip, name, model, kind, av, rc }
let lastScan = 0;
let scanning = null;

const DESC_TIMEOUT = 3000;
const SEARCH_TARGETS = [
  "urn:schemas-upnp-org:device:MediaRenderer:1", // TVs, DLNA speakers (and Sonos)
  "urn:schemas-upnp-org:device:ZonePlayer:1", // Sonos-specific
];

// Sonos's fixed layout — the fallback for a configured IP that never answers
// SSDP (the only case where we can't read the real control URLs).
const sonosAv = (ip) => `http://${ip}:1400/MediaRenderer/AVTransport/Control`;
const sonosRc = (ip) => `http://${ip}:1400/MediaRenderer/RenderingControl/Control`;

function localIPv4s() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces() || {})) {
    for (const i of list || []) {
      if (i.family === "IPv4" && !i.internal) out.push(i.address);
    }
  }
  return out;
}

// One M-SEARCH. Bound to a specific local address so a machine with a VPN or
// virtual adapter still probes the real LAN (a default-route socket often
// leaves through the wrong one and finds nothing). `unicastTo` asks a single
// known host directly, for networks where multicast is dropped.
function ssdpSearch(bindAddr, st, timeout = 3500, unicastTo = null) {
  return new Promise((resolve) => {
    const hits = [];
    let sock;
    try {
      sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
    } catch {
      return resolve(hits);
    }
    const target = unicastTo || "239.255.255.250";
    // MX is the window a device may randomise its reply across. Keep it at 1s
    // and listen well past it: with MX 2 a TV can answer later than a 2.5s
    // listen, and the device silently "disappears" from the menu.
    const msg = Buffer.from(
      [
        "M-SEARCH * HTTP/1.1",
        `HOST: ${target}:1900`,
        'MAN: "ssdp:discover"',
        "MX: 1",
        `ST: ${st}`,
        "",
        "",
      ].join("\r\n")
    );
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { sock.close(); } catch { /* already closed */ }
      resolve(hits);
    };
    sock.on("message", (buf, rinfo) => {
      const loc = (buf.toString().match(/^LOCATION:\s*(.*)$/im) || [])[1]?.trim();
      if (loc) hits.push({ ip: rinfo.address, location: loc });
    });
    sock.on("error", finish);
    try {
      sock.bind(0, bindAddr || undefined, () => {
        try {
          if (!unicastTo && bindAddr) sock.setMulticastInterface(bindAddr);
        } catch { /* not fatal — fall back to the default interface */ }
        // M-SEARCH is UDP and gets dropped; retransmitting is what makes
        // discovery dependable. Duplicate replies collapse by location.
        const fire = () => {
          if (done) return;
          try { sock.send(msg, 1900, target); } catch { finish(); }
        };
        fire();
        setTimeout(fire, 300).unref?.();
        setTimeout(fire, 900).unref?.();
      });
    } catch { finish(); }
    setTimeout(finish, timeout).unref?.();
  });
}

// Pull a service's control URL out of a device description, resolved absolute.
function serviceControlUrl(xml, base, re) {
  for (const m of xml.matchAll(/<service>([\s\S]*?)<\/service>/gi)) {
    const block = m[1];
    const type = (block.match(/<serviceType>([^<]*)<\/serviceType>/i) || [])[1] || "";
    if (!re.test(type)) continue;
    const ctrl = decodeXml(
      (block.match(/<controlURL>([^<]*)<\/controlURL>/i) || [])[1] || ""
    ).trim();
    if (!ctrl) continue;
    try {
      return new URL(ctrl, base).href;
    } catch {
      return null;
    }
  }
  return null;
}

// Fetch a description and keep it only if it can actually play something.
// One IP can host several UPnP devices (a Samsung TV advertises a DIAL
// receiver and a screen-mirroring service too) — the AVTransport check is what
// picks the renderer out of them.
export async function describeLocation(ip, location) {
  try {
    const res = await fetch(location, { signal: AbortSignal.timeout(DESC_TIMEOUT) });
    if (!res.ok) return null;
    const xml = await res.text();
    const pick = (tag) =>
      decodeXml((xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i")) || [])[1] || "").trim();
    const av = serviceControlUrl(xml, pick("URLBase") || location, /:AVTransport:/i);
    if (!av) return null; // not a renderer we can drive
    const isSonos = /Sonos/i.test(xml);
    return {
      ip,
      name: pick("roomName") || pick("friendlyName") || ip,
      model: pick("modelName") || (isSonos ? "Sonos" : "Media renderer"),
      kind: isSonos ? "sonos" : "renderer",
      av,
      rc: serviceControlUrl(xml, pick("URLBase") || location, /:RenderingControl:/i),
    };
  } catch {
    return null;
  }
}

const list = () => [...known.values()].sort((a, b) => a.name.localeCompare(b.name));

// Discover renderers (cached ~60s). Configured IPs are always included.
export async function discover(force = false) {
  if (!force && Date.now() - lastScan < 60_000) return list();
  if (scanning) return scanning; // coalesce concurrent scans
  scanning = (async () => {
    try {
      // One SSDP sweep: every search target, out of every local interface.
      const sweep = async () => {
        const binds = localIPv4s();
        const jobs = [];
        for (const st of SEARCH_TARGETS) {
          if (binds.length) for (const b of binds) jobs.push(ssdpSearch(b, st));
          else jobs.push(ssdpSearch(null, st));
          // ask configured hosts directly — multicast may never reach them
          for (const ip of config.upnpIps) {
            if (IP_RE.test(ip)) jobs.push(ssdpSearch(null, st, 2500, ip));
          }
        }
        const locations = new Map(); // location -> ip
        for (const hits of await Promise.all(jobs)) {
          for (const h of hits) locations.set(h.location, h.ip);
        }
        // a configured Sonos that ignores unicast SSDP still has a known path
        for (const ip of config.upnpIps) {
          if (IP_RE.test(ip)) {
            locations.set(`http://${ip}:1400/xml/device_description.xml`, ip);
          }
        }
        return (
          await Promise.all([...locations].map(([loc, ip]) => describeLocation(ip, loc)))
        ).filter(Boolean);
      };

      // The first sweep after boot reliably comes back empty on some hosts —
      // the OS is still setting up multicast routing when the datagram goes
      // out. One retry turns "no devices found" into a found device.
      let found = await sweep();
      if (!found.length) found = await sweep();

      // replace rather than accumulate, so movers/leavers don't go stale —
      // but keep env-configured devices even when unreachable right now
      known.clear();
      for (const d of found) {
        // prefer a real Sonos entry over a generic one for the same IP
        if (!known.has(d.ip) || d.kind === "sonos") known.set(d.ip, d);
      }
      for (const ip of config.upnpIps) {
        if (!known.has(ip) && IP_RE.test(ip)) {
          known.set(ip, {
            ip,
            name: ip,
            model: "Sonos (configured)",
            kind: "sonos",
            av: sonosAv(ip),
            rc: sonosRc(ip),
          });
        }
      }
      // An empty sweep is usually a transient miss — a TV that just went to
      // standby, or multicast dropped once — and caching it for the full
      // minute would hide a device that is actually there. Retry sooner.
      lastScan = known.size ? Date.now() : Date.now() - 50_000;
      return list();
    } finally {
      scanning = null;
    }
  })();
  return scanning;
}

export const isKnown = (ip) => known.has(String(ip));
export const deviceName = (ip) => known.get(String(ip))?.name || String(ip);
export const deviceKind = (ip) => known.get(String(ip))?.kind || "renderer";

// test seam — lets the suite exercise SOAP/DIDL without a device on the LAN
export function _setKnown(devices) {
  known.clear();
  for (const d of devices) known.set(d.ip, d);
  lastScan = Date.now();
}

// ---------------------------------------------------------------------------
// SOAP control
// ---------------------------------------------------------------------------
async function soap(ip, service, action, body = "") {
  const dev = known.get(String(ip));
  if (!dev) throw new Error("unknown playback device — rescan devices");
  const url = service === "RenderingControl" ? dev.rc : dev.av;
  if (!url) throw new Error(`${dev.name} doesn't expose ${service}`);
  const ns = `urn:schemas-upnp-org:service:${service}:1`;
  const envelope =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ` +
    `s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>` +
    `<u:${action} xmlns:u="${ns}"><InstanceID>0</InstanceID>${body}</u:${action}>` +
    `</s:Body></s:Envelope>`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": 'text/xml; charset="utf-8"',
      SOAPACTION: `"${ns}#${action}"`,
    },
    body: envelope,
    signal: AbortSignal.timeout(5000),
  });
  const text = await res.text();
  if (!res.ok) {
    const code = (text.match(/<errorCode>(\d+)<\/errorCode>/) || [])[1];
    throw new Error(
      `${dev.name}: ${action} failed${code ? ` (UPnP ${code})` : ` (${res.status})`}`
    );
  }
  return text;
}

// hh:mm:ss <-> seconds (UPnP REL_TIME format)
export const toHms = (sec) => {
  sec = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
export const fromHms = (t) => {
  const m = /^(\d+):(\d+):(\d+)/.exec(String(t) || "");
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
};

// DIDL-Lite metadata so the speaker/TV shows title/artist/art for the track.
// Sonos is happy with a wildcard protocolInfo; TVs are pickier and want the
// DLNA flags that advertise byte-range seeking, or they refuse to seek.
const DLNA_AUDIO =
  "http-get:*:audio/mp4:DLNA.ORG_OP=01;DLNA.ORG_CI=0;" +
  "DLNA.ORG_FLAGS=01700000000000000000000000000000";

export function didl(song, url, kind = "sonos") {
  const protocolInfo = kind === "sonos" ? "http-get:*:audio/mp4:*" : DLNA_AUDIO;
  return (
    `<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" ` +
    `xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">` +
    `<item id="marusic-${escapeXml(song.id || "track")}" parentID="-1" restricted="true">` +
    `<dc:title>${escapeXml(song.title || "Marusic")}</dc:title>` +
    `<dc:creator>${escapeXml(song.artist || "")}</dc:creator>` +
    `<upnp:artist>${escapeXml(song.artist || "")}</upnp:artist>` +
    `<upnp:album>${escapeXml(song.album || "")}</upnp:album>` +
    (song.image ? `<upnp:albumArtURI>${escapeXml(song.image)}</upnp:albumArtURI>` : "") +
    `<upnp:class>object.item.audioItem.musicTrack</upnp:class>` +
    `<res protocolInfo="${protocolInfo}"${
      song.duration ? ` duration="${toHms(song.duration)}"` : ""
    }>${escapeXml(url)}</res>` +
    `</item></DIDL-Lite>`
  );
}

const uriBody = (tag, url, meta) =>
  `<${tag}>${escapeXml(url)}</${tag}>` +
  `<${tag}MetaData>${escapeXml(meta)}</${tag}MetaData>`;

export async function setUri(ip, url, meta) {
  // Sonos swaps the URI happily mid-play; many TVs reject SetAVTransportURI
  // while the previous item is still running, so clear the transport first.
  if (deviceKind(ip) !== "sonos") await soap(ip, "AVTransport", "Stop").catch(() => {});
  return soap(ip, "AVTransport", "SetAVTransportURI", uriBody("CurrentURI", url, meta));
}
// queue the following track on the device itself, for gapless advancing
export const setNextUri = (ip, url, meta) =>
  soap(ip, "AVTransport", "SetNextAVTransportURI", uriBody("NextURI", url, meta));
export const play = (ip) => soap(ip, "AVTransport", "Play", "<Speed>1</Speed>");
export const pause = (ip) => soap(ip, "AVTransport", "Pause");
export const stop = (ip) => soap(ip, "AVTransport", "Stop");
export const seek = (ip, sec) =>
  soap(ip, "AVTransport", "Seek", `<Unit>REL_TIME</Unit><Target>${toHms(sec)}</Target>`);

export async function status(ip) {
  const [pos, tr] = await Promise.all([
    soap(ip, "AVTransport", "GetPositionInfo"),
    soap(ip, "AVTransport", "GetTransportInfo"),
  ]);
  const pick = (xml, tag) =>
    (xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`)) || [])[1] || "";
  return {
    state: pick(tr, "CurrentTransportState"), // PLAYING | PAUSED_PLAYBACK | STOPPED | TRANSITIONING
    pos: fromHms(pick(pos, "RelTime")),
    duration: fromHms(pick(pos, "TrackDuration")),
    // the device XML-escapes the URI inside the response — undo &amp; for compares
    trackUri: pick(pos, "TrackURI").replace(/&amp;/g, "&"),
  };
}

export async function transportState(ip) {
  const xml = await soap(ip, "AVTransport", "GetTransportInfo");
  return (xml.match(/<CurrentTransportState>([^<]*)</) || [])[1] || "";
}

// A renderer reports TRANSITIONING while it buffers, and TVs reject transport
// commands during that window with UPnP 701 — a seek arriving mid-buffer can
// drop playback altogether. Wait for it to settle before commanding it.
// Resolves either way; the caller's command is best-effort regardless.
export async function waitUntilSettled(ip, ms = 5000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const state = await transportState(ip);
      if (state && state !== "TRANSITIONING") return state;
    } catch {
      return null; // device not answering — let the caller try anyway
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

export const setVolume = (ip, v) =>
  soap(
    ip,
    "RenderingControl",
    "SetVolume",
    `<Channel>Master</Channel><DesiredVolume>${Math.max(0, Math.min(100, Math.round(v)))}</DesiredVolume>`
  );

export async function getVolume(ip) {
  const xml = await soap(ip, "RenderingControl", "GetVolume", "<Channel>Master</Channel>");
  return Number((xml.match(/<CurrentVolume>(\d+)<\/CurrentVolume>/) || [])[1] || 0);
}

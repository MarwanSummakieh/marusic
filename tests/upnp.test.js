// lib/upnp.js — XML building/parsing, time conversion, and device-description
// parsing. SSDP discovery itself needs real hardware, but describeLocation is
// exercised against a local HTTP server serving real-world description XML.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  escapeXml,
  decodeXml,
  toHms,
  fromHms,
  didl,
  describeLocation,
} from "../lib/upnp.js";

test("escapeXml escapes the five XML metacharacters", () => {
  assert.equal(
    escapeXml(`Mel & Kim <"Respectable"> it's`),
    "Mel &amp; Kim &lt;&quot;Respectable&quot;&gt; it&#39;s"
  );
  assert.equal(escapeXml(""), "");
  assert.equal(escapeXml(undefined), "");
});

test("decodeXml turns description entities back into text", () => {
  assert.equal(decodeXml("34&quot; Odyssey OLED G8"), '34" Odyssey OLED G8');
  assert.equal(decodeXml("Mel &amp; Kim"), "Mel & Kim");
  assert.equal(decodeXml("&lt;tag&gt;"), "<tag>");
  assert.equal(decodeXml("caf&#233;"), "café");
  assert.equal(decodeXml("&#x41;&#x42;"), "AB");
  assert.equal(decodeXml("plain"), "plain");
  assert.equal(decodeXml("&unknown;"), "&unknown;"); // left alone, not mangled
});

test("toHms formats seconds as h:mm:ss", () => {
  assert.equal(toHms(0), "0:00:00");
  assert.equal(toHms(83), "0:01:23");
  assert.equal(toHms(3725), "1:02:05");
  assert.equal(toHms("bogus"), "0:00:00");
});

test("fromHms parses UPnP REL_TIME strings", () => {
  assert.equal(fromHms("0:01:23"), 83);
  assert.equal(fromHms("1:02:05"), 3725);
  assert.equal(fromHms("NOT_IMPLEMENTED"), 0);
  assert.equal(fromHms(""), 0);
});

test("toHms/fromHms round-trip", () => {
  for (const sec of [0, 1, 59, 60, 3599, 3600, 7261]) {
    assert.equal(fromHms(toHms(sec)), sec);
  }
});

test("didl builds escaped DIDL-Lite with metadata and the stream url", () => {
  const song = {
    id: "abc123",
    title: "Q&A <live>",
    artist: "Mel & Kim",
    album: 'The "Best" Of',
    image: "https://img.example/a.jpg?w=500&h=500",
    duration: 215,
  };
  const url = "http://192.168.1.20:3000/api/stream/abc123?q=sonos&t=tok";
  const xml = didl(song, url);

  // well-formed enough for a speaker: no raw ampersands outside entities
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|#39;)/.test(xml), "raw & left unescaped");
  assert.ok(xml.includes("Q&amp;A &lt;live&gt;"));
  assert.ok(xml.includes("<dc:creator>Mel &amp; Kim</dc:creator>"));
  assert.ok(xml.includes("object.item.audioItem.musicTrack"));
  assert.ok(xml.includes('duration="0:03:35"'));
  assert.ok(xml.includes("q=sonos&amp;t=tok"), "res url must be XML-escaped");
  assert.ok(xml.includes("upnp:albumArtURI"));
});

test("didl tolerates sparse songs", () => {
  const xml = didl({ id: "x" }, "http://h/s");
  assert.ok(xml.includes("<dc:title>Marusic</dc:title>"));
  assert.ok(!xml.includes("albumArtURI"));
  assert.ok(!xml.includes("duration="));
});

test("didl advertises DLNA seek flags to TVs but stays wildcard for Sonos", () => {
  const song = { id: "x", title: "T", duration: 10 };
  assert.ok(didl(song, "http://h/s", "sonos").includes('protocolInfo="http-get:*:audio/mp4:*"'));

  const tv = didl(song, "http://h/s", "renderer");
  assert.ok(tv.includes("DLNA.ORG_OP=01"), "byte-range seeking must be advertised");
  assert.ok(tv.includes("DLNA.ORG_FLAGS="));
  assert.ok(!tv.includes('audio/mp4:*"'));
});

// --------------------------------------------------------------------------
// device description parsing
// --------------------------------------------------------------------------
// Verbatim shape of a Samsung Tizen panel's renderer (:9197/dmr): entity in
// the name, relative control URLs, no URLBase.
const SAMSUNG_DMR = `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0"><device>
  <deviceType>urn:schemas-upnp-org:device:MediaRenderer:1</deviceType>
  <friendlyName>34&quot; Odyssey OLED G8</friendlyName>
  <manufacturer>Samsung Electronics</manufacturer>
  <modelName>LS34DG850SUXEN</modelName>
  <serviceList>
    <service>
      <serviceType>urn:schemas-upnp-org:service:RenderingControl:1</serviceType>
      <controlURL>/upnp/control/RenderingControl1</controlURL>
    </service>
    <service>
      <serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>
      <controlURL>/upnp/control/AVTransport1</controlURL>
    </service>
  </serviceList>
</device></root>`;

// The same TV's DIAL receiver (:7678) — same IP, no AVTransport, must be skipped.
const DIAL_RECEIVER = `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0"><device>
  <deviceType>urn:dial-multiscreen-org:device:dialreceiver:1</deviceType>
  <friendlyName>34&quot; Odyssey OLED G8</friendlyName>
  <serviceList>
    <service>
      <serviceType>urn:dial-multiscreen-org:service:dial:1</serviceType>
      <controlURL>/RCR/control/dial</controlURL>
    </service>
  </serviceList>
</device></root>`;

const SONOS_DESC = `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0"><device>
  <deviceType>urn:schemas-upnp-org:device:ZonePlayer:1</deviceType>
  <friendlyName>192.168.1.50 - Sonos One</friendlyName>
  <roomName>Kitchen</roomName>
  <modelName>Sonos One</modelName>
  <serviceList>
    <service>
      <serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>
      <controlURL>/MediaRenderer/AVTransport/Control</controlURL>
    </service>
    <service>
      <serviceType>urn:schemas-upnp-org:service:RenderingControl:1</serviceType>
      <controlURL>/MediaRenderer/RenderingControl/Control</controlURL>
    </service>
  </serviceList>
</device></root>`;

const WITH_URLBASE = `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0">
  <URLBase>http://10.0.0.9:2870/</URLBase>
  <device>
  <friendlyName>Living Room</friendlyName>
  <modelName>DLNA Box</modelName>
  <serviceList>
    <service>
      <serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>
      <controlURL>ctl/AVTransport</controlURL>
    </service>
  </serviceList>
</device></root>`;

function serve(routes) {
  const server = http.createServer((req, res) => {
    const body = routes[req.url];
    if (body === undefined) {
      res.writeHead(404).end("nope");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/xml" }).end(body);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("describeLocation reads control URLs out of a TV's description", async (t) => {
  const server = await serve({
    "/dmr": SAMSUNG_DMR,
    "/nservice/": DIAL_RECEIVER,
  });
  t.after(() => server.close());
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const dev = await describeLocation("127.0.0.1", `${base}/dmr`);
  assert.ok(dev, "renderer description must be accepted");
  assert.equal(dev.name, '34" Odyssey OLED G8', "entities decoded for the UI");
  assert.equal(dev.model, "LS34DG850SUXEN");
  assert.equal(dev.kind, "renderer");
  assert.equal(dev.av, `${base}/upnp/control/AVTransport1`);
  assert.equal(dev.rc, `${base}/upnp/control/RenderingControl1`);

  // same IP, different UPnP device on the box — nothing to play with
  assert.equal(await describeLocation("127.0.0.1", `${base}/nservice/`), null);
  // unreachable / non-XML paths fail closed rather than throwing
  assert.equal(await describeLocation("127.0.0.1", `${base}/missing`), null);
});

test("describeLocation recognises Sonos and prefers roomName", async (t) => {
  const server = await serve({ "/xml/device_description.xml": SONOS_DESC });
  t.after(() => server.close());
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const dev = await describeLocation("127.0.0.1", `${base}/xml/device_description.xml`);
  assert.ok(dev);
  assert.equal(dev.kind, "sonos");
  assert.equal(dev.name, "Kitchen", "roomName wins over friendlyName");
  assert.equal(dev.av, `${base}/MediaRenderer/AVTransport/Control`);
});

test("describeLocation honours URLBase for relative control URLs", async (t) => {
  const server = await serve({ "/desc.xml": WITH_URLBASE });
  t.after(() => server.close());
  const { port } = server.address();

  const dev = await describeLocation("127.0.0.1", `http://127.0.0.1:${port}/desc.xml`);
  assert.ok(dev);
  assert.equal(dev.av, "http://10.0.0.9:2870/ctl/AVTransport");
  assert.equal(dev.rc, null, "no RenderingControl service in this description");
});

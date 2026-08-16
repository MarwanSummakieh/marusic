// Free lossless FLAC sources — no account, no API key. A track we already know
// (title + artist) is matched by text search against public proxies, then a
// real FLAC CDN url is resolved. Two independent source families are tried, and
// the best match across them wins:
//
//   Qobuz  — the "squid.wtf" / MusicFLAC API shape (config.losslessApiBases):
//     GET {base}/api/get-music?q=<query>&offset=0&limit=10
//          -> data.tracks.items[] { id, title, isrc, maximum_bit_depth, ... }
//     GET {base}/api/download-music?track_id=<id>&quality=27
//          -> data.url  (flac cdn url)
//
//   Tidal  — SpotiFLAC's hifi-api mirrors (config.tidalApiBases), queried in
//   parallel (any that's up wins):
//     GET {base}/search/?s=<query>&limit=10
//          -> items[] { id, title, artists[], isrc, audioQuality }
//     GET {base}/track/?id=<id>&quality=HI_RES_LOSSLESS
//          -> { manifest: <base64 JSON> }, base64 decodes to
//             { mimeType:"audio/flac", encryptionType:"NONE", urls:[<flac url>] }
//
// Every network call degrades to null on a dead/blocked/HTML-challenge
// instance, so the caller falls back to the yt-dlp (YouTube) source.
import { config } from "./config.js";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0";

const TIMEOUT_MS = 15000;

async function getJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
    });
    const ctype = res.headers.get("content-type") || "";
    // Down / blocked instances answer with an HTML challenge or 5xx page.
    if (!res.ok || !ctype.includes("json")) return null;
    return await res.json();
  } catch {
    return null; // DNS failure, timeout, abort, invalid JSON
  } finally {
    clearTimeout(timer);
  }
}

// Resolve with the first instance that returns a truthy value; null if none do.
// (Failures/nulls are swallowed so one dead mirror can't sink the race.)
async function firstOk(bases, fn) {
  try {
    return await Promise.any(
      bases.map(async (base) => {
        const r = await fn(base);
        if (r == null) throw new Error("empty");
        return r;
      })
    );
  } catch {
    return null; // AggregateError: every instance failed
  }
}

const norm = (s = "") =>
  String(s)
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ") // drop "(feat. …)", "[Remastered]"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// crude token-overlap score in [0,1]
export function similarity(a, b) {
  const at = new Set(norm(a).split(" ").filter(Boolean));
  const bt = new Set(norm(b).split(" ").filter(Boolean));
  if (!at.size || !bt.size) return 0;
  let hit = 0;
  for (const t of at) if (bt.has(t)) hit++;
  return hit / Math.max(at.size, bt.size);
}

/* ------------------------------- Qobuz ------------------------------- */
function qobuzItems(payload) {
  const items =
    payload?.data?.tracks?.items ||
    payload?.tracks?.items ||
    payload?.data?.items ||
    (Array.isArray(payload?.data) ? payload.data : null) ||
    [];
  return Array.isArray(items) ? items : [];
}

function mapQobuz(t) {
  const artist =
    t.performer?.name ||
    t.artist?.name ||
    (Array.isArray(t.artists) ? t.artists[0]?.name : "") ||
    t.album?.artist?.name ||
    "";
  return {
    provider: "Qobuz",
    id: t.id ?? t.track_id ?? null,
    title: t.title || t.name || "",
    artist,
    isrc: t.isrc || "",
    bitDepth: t.maximum_bit_depth || t.bit_depth || 0,
    sampleRate: t.maximum_sampling_rate || t.sampling_rate || 0,
  };
}

// Qobuz instances are a small sequential chain (the squid.wtf pool is tiny).
async function searchQobuz(query) {
  for (const base of config.losslessApiBases) {
    const payload = await getJson(
      `${base}/api/get-music?q=${encodeURIComponent(query)}&offset=0&limit=10`
    );
    const items = qobuzItems(payload).map(mapQobuz).filter((t) => t.id != null);
    if (items.length) return items.map((t) => ({ ...t, base }));
  }
  return [];
}

async function resolveQobuz({ base, id }) {
  const payload = await getJson(
    `${base}/api/download-music?track_id=${encodeURIComponent(id)}&quality=27`
  );
  const dl = payload?.data?.url || payload?.url || null;
  return typeof dl === "string" && dl.startsWith("http") ? dl : null;
}

/* ------------------------------- Tidal ------------------------------- */
const artistOfTidal = (t) =>
  t.artist?.name ||
  (Array.isArray(t.artists) ? t.artists.map((a) => a?.name).filter(Boolean).join(", ") : "") ||
  "";

// Tidal reports a quality tier, not a numeric depth — map to a display guess.
const tidalDepth = (q = "") => (/HI_RES/i.test(q) ? 24 : 16);
const tidalRate = (q = "") => (/HI_RES/i.test(q) ? 96 : 44.1);

function mapTidal(t) {
  return {
    provider: "Tidal",
    id: t.id ?? t.trackId ?? null,
    title: t.title || t.name || "",
    artist: artistOfTidal(t),
    isrc: t.isrc || "",
    bitDepth: tidalDepth(t.audioQuality),
    sampleRate: tidalRate(t.audioQuality),
  };
}

async function searchTidal(query) {
  const items = await firstOk(config.tidalApiBases, async (base) => {
    const payload = await getJson(
      `${base}/search/?s=${encodeURIComponent(query)}&limit=10`
    );
    const arr = payload?.items || payload?.tracks?.items || [];
    const mapped = arr.map(mapTidal).filter((t) => t.id != null).map((t) => ({ ...t, base }));
    return mapped.length ? mapped : null;
  });
  return items || [];
}

// Decode hifi-api's base64 manifest and pull an unencrypted FLAC url from it.
export function flacUrlFromManifest(manifestB64) {
  try {
    const json = JSON.parse(Buffer.from(String(manifestB64), "base64").toString("utf8"));
    if (json.encryptionType && json.encryptionType !== "NONE") return null; // DRM — unusable
    const url = Array.isArray(json.urls) ? json.urls[0] : json.url;
    return typeof url === "string" && url.startsWith("http") ? url : null;
  } catch {
    return null;
  }
}

async function resolveTidal({ id }) {
  // any mirror serves any id; race them, and prefer hi-res but accept lossless
  for (const quality of ["HI_RES_LOSSLESS", "LOSSLESS"]) {
    const url = await firstOk(config.tidalApiBases, async (base) => {
      const payload = await getJson(
        `${base}/track/?id=${encodeURIComponent(id)}&quality=${quality}`
      );
      if (!payload) return null;
      // some builds return the manifest, others a direct url field
      return (
        flacUrlFromManifest(payload.manifest) ||
        (typeof payload.OriginalTrackUrl === "string" ? payload.OriginalTrackUrl : null)
      );
    });
    if (url) return url;
  }
  return null;
}

/* ---------------------------- MusicBrainz ISRC ----------------------------
   Text similarity alone happily returns a karaoke cover or a live version with
   the same title. SpotiFLAC leans on ISRCs for exactly this reason, so we ask
   MusicBrainz for the recording's ISRCs first and treat an exact ISRC hit on a
   candidate as decisive. It's advisory: when MusicBrainz is down or the track
   isn't catalogued, scoring falls back to text as before. */
const MB_ENDPOINT = "https://musicbrainz.org/ws/2/recording";
const isrcCache = new Map(); // "title|artist" -> string[] (possibly empty)
const ISRC_TTL_MS = 60 * 60 * 1000;

// MusicBrainz asks for a descriptive UA and rate-limits to ~1 req/sec.
const MB_UA = "Marusic/1.0 (self-hosted personal music player)";
let mbNextSlot = 0;

const mbThrottle = () => {
  const wait = Math.max(0, mbNextSlot - Date.now());
  mbNextSlot = Date.now() + wait + 1100;
  return wait ? new Promise((r) => setTimeout(r, wait)) : Promise.resolve();
};

const luceneEscape = (s = "") => String(s).replace(/(["\\])/g, "\\$1");

// The probe and the download fire at the same moment and want the same answer,
// so an in-flight lookup is shared rather than raced through the throttle twice.
const isrcInflight = new Map();

export function findIsrcs({ title, artist }) {
  if (!title) return Promise.resolve([]);
  const key = `${title}|${artist}`;
  const hit = isrcCache.get(key);
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit.value);
  const pending = isrcInflight.get(key);
  if (pending) return pending;

  const run = fetchIsrcs(key, title, artist).finally(() => isrcInflight.delete(key));
  isrcInflight.set(key, run);
  return run;
}

async function fetchIsrcs(key, title, artist) {
  const query = [
    `recording:"${luceneEscape(title)}"`,
    artist ? `artist:"${luceneEscape(artist)}"` : "",
  ].filter(Boolean).join(" AND ");
  const url = `${MB_ENDPOINT}?query=${encodeURIComponent(query)}&fmt=json&limit=5&inc=isrcs`;

  await mbThrottle();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let value = [];
  let answered = false; // did MusicBrainz actually reply?
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": MB_UA, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (res.ok) {
      const json = await res.json();
      answered = true;
      // Keep only recordings MusicBrainz itself scored as a strong match, so a
      // loose query can't drag in an unrelated ISRC.
      value = [...new Set(
        (json?.recordings || [])
          .filter((r) => (r.score ?? 0) >= 90 && similarity(r.title, title) >= 0.6)
          .flatMap((r) => r.isrcs || [])
          .map((c) => String(c).toUpperCase())
      )];
    }
  } catch {
    value = []; // offline, throttled, aborted — advisory only
  } finally {
    clearTimeout(timer);
  }
  // A real "this track has no ISRCs" answer is worth caching for the hour; a
  // timeout is not — cache that briefly so one blip doesn't disable ISRC
  // matching for every download that follows.
  isrcCache.set(key, {
    value,
    exp: Date.now() + (answered ? ISRC_TTL_MS : 60 * 1000),
  });
  return value;
}

/* ---------------------------- match + resolve ---------------------------- */
// Score a candidate against the wanted track; higher is better. An ISRC that
// matches MusicBrainz outranks any amount of text similarity.
export function scoreCandidate(t, title, artist, isrcs = []) {
  const isrcHit = t.isrc && isrcs.includes(String(t.isrc).toUpperCase());
  return (
    (isrcHit ? 1 : 0) +
    similarity(t.title, title) * 0.6 +
    (artist ? similarity(t.artist, artist) * 0.4 : 0.4) +
    (t.bitDepth >= 24 ? 0.03 : 0) // nudge toward hi-res on ties
  );
}

// Find the best lossless match across all sources for a known title + artist.
export async function findLossless({ title, artist }) {
  if (!title) return null;
  const query = `${artist ? artist + " " : ""}${title}`.trim();

  // Query Qobuz, Tidal and MusicBrainz concurrently; merge whatever came back.
  const [qobuz, tidal, isrcs] = await Promise.all([
    searchQobuz(query).catch(() => []),
    searchTidal(query).catch(() => []),
    findIsrcs({ title, artist }).catch(() => []),
  ]);
  const candidates = [...qobuz, ...tidal];
  if (!candidates.length) return null;

  let best = null;
  let bestScore = -1;
  for (const t of candidates) {
    const score = scoreCandidate(t, title, artist, isrcs);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  if (!best) return null;
  // An ISRC match is proof of identity, so it stands on its own. Otherwise
  // require a real title overlap so we don't hand back a wrong song.
  const byIsrc = best.isrc && isrcs.includes(String(best.isrc).toUpperCase());
  if (!byIsrc && similarity(best.title, title) < 0.5) return null;
  return { ...best, matchedByIsrc: !!byIsrc };
}

// Resolve the FLAC url for a match, dispatching on its provider.
export function resolveUrlFor(match) {
  if (!match) return Promise.resolve(null);
  return match.provider === "Tidal" ? resolveTidal(match) : resolveQobuz(match);
}

// One-shot: match + resolve. Returns { url, provider, bitDepth, ... } or null.
export async function resolveLossless({ title, artist }) {
  const match = await findLossless({ title, artist });
  if (!match) return null;
  const url = await resolveUrlFor(match);
  if (!url) return null;
  return {
    url,
    provider: match.provider,
    bitDepth: match.bitDepth || 16,
    sampleRate: match.sampleRate || 44.1,
    matchedTitle: match.title,
    matchedArtist: match.artist,
    isrc: match.isrc,
    matchedByIsrc: !!match.matchedByIsrc,
  };
}

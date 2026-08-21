import express from "express";
import dns from "node:dns";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { Readable, pipeline } from "node:stream";
import { fileURLToPath } from "node:url";
import * as ytm from "./lib/ytmusic.js";
import * as lossless from "./lib/lossless.js";
import * as db from "./lib/db.js";
import * as jam from "./lib/jam.js";
import * as sonos from "./lib/upnp.js";
import { config } from "./lib/config.js";
import {
  securityHeaders,
  makeRateLimiter,
  makeCastToken,
  verifyCastToken,
} from "./lib/security.js";

// FORCE_IPV4: pin outbound connections to IPv4 before anything can fetch.
// Node races IPv4 and IPv6 (Happy Eyeballs) and keeps whichever answers
// first, so on a dual-stack line our fetch can leave over IPv6 while the
// yt-dlp resolve left over IPv4 — and a googlevideo URL is only valid from
// the address that requested it. Disabling the race and preferring A
// records makes both legs agree. Off unless the deployment sets it.
let ipv4Pinned = false;
function pinIpv4(why) {
  if (ipv4Pinned) return;
  ipv4Pinned = true;
  net.setDefaultAutoSelectFamily(false);
  dns.setDefaultResultOrder("ipv4first");
  console.log(`  Outbound connections pinned to IPv4 (${why}).`);
}
if (config.forceIpv4) pinIpv4("FORCE_IPV4");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_MAX_AGE = config.sessionMaxAgeDays * 24 * 60 * 60 * 1000;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", config.trustProxy);
app.use(securityHeaders);
// 256kb so playlist JSON imports fit (a few hundred song snapshots)
app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "public")));

// tiny cookie parser — avoids a cookie-parser dependency
app.use((req, _res, next) => {
  req.cookies = Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((c) => c.trim().split("=").map(decodeURIComponent))
      .filter((p) => p[0])
  );
  next();
});

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(`[api] ${req.path}: ${err.message}`);
    // Once a stream has begun, .status() would throw ERR_HTTP_HEADERS_SENT
    // inside this catch and become an unhandled rejection of its own.
    if (res.headersSent) res.destroy();
    else res.status(500).json({ error: err.message });
  });

// ---------------------------------------------------------------------------
// Auth plumbing (same pattern as animeMarwan)
// ---------------------------------------------------------------------------
function setSession(res, token) {
  const flags = ["HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${SESSION_MAX_AGE / 1000}`];
  if (config.cookieSecure) flags.push("Secure");
  res.setHeader("Set-Cookie", `sid=${token}; ${flags.join("; ")}`);
}
function currentUser(req) {
  // native clients (Android app / Android Auto) send a long-lived device
  // token instead of the session cookie — see /api/device/token
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) {
    const u = db.getUserByDeviceToken(auth.slice(7).trim());
    if (u) return u;
  }
  return db.getSessionUser(req.cookies.sid, SESSION_MAX_AGE);
}
function requireAuth(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: "auth required" });
  req.user = u;
  next();
}
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "admin only" });
  next();
}
// Stream-only auth: the browser's <audio> sends the session cookie, but a
// Chromecast fetching the same URL can't — it authenticates with a signed
// cast token in the query string instead (see /api/cast/token).
function streamAuth(req, res, next) {
  const u = currentUser(req);
  if (u) {
    req.user = u;
    return next();
  }
  const t = verifyCastToken(req.query.t);
  const tu = t && db.getUserById(t.userId);
  if (tu?.active) {
    req.user = tu;
    return next();
  }
  res.status(401).json({ error: "auth required" });
}

// ---------- first-run bootstrap: seed the admin ----------
function bootstrap() {
  db.pruneSessions(SESSION_MAX_AGE);
  if (db.listUsers().length > 0) return;
  const { email, password } = config.admin;
  db.createUser({ email, name: "Admin", password, role: "admin" });
  console.log(`  Seeded admin: ${email}${config.isProd ? "" : ` / ${password}`}`);
}
bootstrap();

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
const loginLimiter = makeRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

// lets the Android app validate a server URL before asking for credentials
app.get("/api/health", (_req, res) => res.json({ ok: true, app: "marusic" }));

app.post("/api/login", loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  // non-string values would throw inside toLowerCase()/scrypt — reject early
  if (typeof email !== "string" || typeof password !== "string")
    return res.status(400).json({ error: "email and password required" });
  const u = db.getUserByEmail(email);
  if (!u || !u.active || !db.verifyPassword(password, u.pw_hash))
    return res.status(401).json({ error: "invalid credentials" });
  setSession(res, db.createSession(u.id));
  res.json({ ok: true, user: { name: u.name, role: u.role } });
});

app.post("/api/logout", (req, res) => {
  db.destroySession(req.cookies.sid);
  res.setHeader("Set-Cookie", "sid=; HttpOnly; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: "no session" });
  res.json({ name: u.name, email: u.email, role: u.role });
});

// ---------------------------------------------------------------------------
// Account settings (self-service)
// ---------------------------------------------------------------------------
app.post("/api/account/password", requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  if (typeof current !== "string" || typeof next !== "string")
    return res.status(400).json({ error: "current and new password required" });
  if (next.length < config.minPasswordLength)
    return res.status(400).json({ error: `password must be at least ${config.minPasswordLength} characters` });
  if (!db.verifyPassword(current, req.user.pw_hash))
    return res.status(401).json({ error: "current password is incorrect" });
  db.updatePassword(req.user.id, next);
  // sign out every device (a changed password should revoke stolen sessions),
  // then re-establish this one so the user isn't dumped to the login screen
  db.destroyUserSessions(req.user.id);
  setSession(res, db.createSession(req.user.id));
  res.json({ ok: true });
});

app.post("/api/account/name", requireAuth, (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: "name required" });
  db.updateName(req.user.id, name);
  res.json({ ok: true, name });
});

// Invite redemption: the friend sets their own password. NO open registration.
app.get("/api/invite/:token", (req, res) => {
  const inv = db.getInvite(req.params.token);
  if (!inv) return res.status(404).json({ error: "invalid or used invite" });
  res.json({ email: inv.email, name: inv.name });
});
app.post("/api/invite/:token", (req, res) => {
  const inv = db.getInvite(req.params.token);
  if (!inv) return res.status(404).json({ error: "invalid or used invite" });
  const { password } = req.body || {};
  if (typeof password !== "string" || password.length < config.minPasswordLength)
    return res.status(400).json({ error: `password must be at least ${config.minPasswordLength} characters` });
  if (db.getUserByEmail(inv.email)) return res.status(409).json({ error: "user already exists" });
  const u = db.createUser({ email: inv.email, name: inv.name, password, role: inv.role });
  db.useInvite(inv.token);
  setSession(res, db.createSession(u.id));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Device tokens: long-lived bearer credentials for native clients (the
// Android app / Android Auto). The app logs in once with the session cookie,
// exchanges it for a token here, then authenticates every request — including
// /api/stream — with `Authorization: Bearer <token>` (see currentUser above).
// ---------------------------------------------------------------------------
app.post("/api/device/token", requireAuth, (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 64) || "device";
  const { id, token } = db.createDeviceToken(req.user.id, name);
  res.json({ id, name, token }); // the raw token is returned exactly once
});

app.get("/api/device/tokens", requireAuth, (req, res) => {
  res.json(db.listDeviceTokens(req.user.id));
});

app.delete("/api/device/tokens/:id", requireAuth, (req, res) => {
  if (!db.revokeDeviceToken(req.user.id, Number(req.params.id)))
    return res.status(404).json({ error: "not found" });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: user management
// ---------------------------------------------------------------------------
app.use("/api/admin", requireAuth, requireAdmin);

app.get("/api/admin/users", (_req, res) =>
  res.json({ users: db.listUsers(), invites: db.listInvites() })
);

app.post("/api/admin/invite", (req, res) => {
  const { email, name, role } = req.body || {};
  if (typeof email !== "string" || !email || typeof name !== "string" || !name)
    return res.status(400).json({ error: "email and name required" });
  if (db.getUserByEmail(email)) return res.status(409).json({ error: "user exists" });
  const token = db.createInvite({ email, name, role: role === "admin" ? "admin" : "member" });
  res.json({ token, url: `/invite.html?token=${token}` });
});

app.post("/api/admin/user/:id/active", (req, res) => {
  const { active } = req.body || {};
  // strict: a missing/garbled body must not silently coerce into "disable"
  if (typeof active !== "boolean" && active !== 0 && active !== 1)
    return res.status(400).json({ error: "active must be a boolean" });
  const id = Number(req.params.id);
  db.setUserActive(id, active);
  if (!active) db.destroyUserSessions(id); // kick them now
  res.json({ ok: true });
});

app.delete("/api/admin/user/:id", (req, res) => {
  const id = Number(req.params.id);
  const target = db.getUserById(id);
  if (target?.role === "admin" && db.countAdmins() <= 1)
    return res.status(400).json({ error: "cannot delete the last admin" });
  db.destroyUserSessions(id);
  db.deleteUser(id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Music API (ported from youtube-music-cli) — session required
// ---------------------------------------------------------------------------
const EMPTY_SEARCH = { songs: [], videos: [], albums: [], singles: [], artists: [], playlists: [] };

// Upstream's album search answers with albums and nothing else — singles and
// EPs only exist as their own shelves on an artist's page. So when the query is
// essentially an artist's name, that page is where the short releases come from.
const matchesQuery = (name, q) => {
  const a = String(name).toLowerCase().trim();
  const b = q.toLowerCase().trim();
  return !!a && (a === b || a.startsWith(b) || b.startsWith(a));
};

app.get("/api/search", requireAuth, wrap(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ ...EMPTY_SEARCH });
  const [songs, rawVideos, releases, artists, playlists] = await Promise.all([
    ytm.searchSongs(q),
    ytm.searchVideos(q).catch(() => []),
    ytm.searchAlbums(q).catch(() => []),
    ytm.searchArtists(q).catch(() => []),
    ytm.searchPlaylists(q).catch(() => []),
  ]);

  // The song shelf already absorbs anything YouTube Music classes as a song, so
  // a video that came back under both headings belongs with the songs.
  const songIds = new Set(songs.map((s) => s.id));
  const videos = rawVideos.filter((v) => !songIds.has(v.id));

  const albums = releases.filter((r) => r.kind === "Album");
  const singles = releases.filter((r) => r.kind !== "Album");

  const named = artists.find((a) => matchesQuery(a.name, q));
  if (named) {
    const page = await getArtistPage(named.id).catch(() => null);
    const seen = new Set([...albums, ...singles].map((r) => r.token));
    for (const s of page?.singles ?? []) {
      if (seen.has(s.token)) continue;
      seen.add(s.token);
      singles.push({ ...s, kind: "Single", artist: page.name });
    }
    for (const a of page?.albums ?? []) {
      if (seen.has(a.token)) continue;
      seen.add(a.token);
      albums.push({ ...a, kind: "Album", artist: page.name });
    }
  }

  res.json({ songs, videos, albums, singles, artists, playlists });
}));

app.get("/api/suggest", requireAuth, wrap(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json([]);
  res.json(await ytm.getSearchSuggestions(q).catch(() => []));
}));

app.get("/api/album/:token", requireAuth, wrap(async (req, res) => {
  res.json(await ytm.getAlbum(req.params.token));
}));

const artistCache = new Map(); // channelId -> { data, exp }

// Shared with /api/search, which reads an artist's singles shelf — searching a
// band's name shouldn't cost a fresh page fetch every keystroke.
async function getArtistPage(id) {
  const hit = artistCache.get(id);
  if (hit && hit.exp > Date.now()) return hit.data;
  const data = await ytm.getArtist(id);
  artistCache.set(id, { data, exp: Date.now() + 30 * 60 * 1000 });
  return data;
}

app.get("/api/artist/:id", requireAuth, wrap(async (req, res) => {
  res.json(await getArtistPage(req.params.id));
}));

const lyricsCache = new Map(); // videoId -> { data, exp }
app.get("/api/lyrics/:id", requireAuth, wrap(async (req, res) => {
  const hit = lyricsCache.get(req.params.id);
  if (hit && hit.exp > Date.now()) return res.json(hit.data);
  const data = await ytm.getLyrics(req.params.id);
  lyricsCache.set(req.params.id, { data, exp: Date.now() + 24 * 60 * 60 * 1000 });
  res.json(data);
}));

// Public YouTube Music playlists (from search results)
app.get("/api/playlist/:browseId", requireAuth, wrap(async (req, res) => {
  res.json(await ytm.getPublicPlaylist(req.params.browseId));
}));

app.get("/api/trending", requireAuth, wrap(async (_req, res) => {
  res.json(await ytm.getTrending());
}));

// "Made for you": automix continuations seeded by recent, distinct-artist
// history tracks. Cached per user — building three mixes is ~three upstream calls.
const mixCache = new Map(); // userId -> { data, exp }

app.get("/api/mixes", requireAuth, wrap(async (req, res) => {
  const hit = mixCache.get(req.user.id);
  if (hit && hit.exp > Date.now()) return res.json(hit.data);

  const seeds = [];
  const seenArtists = new Set();
  for (const s of db.getHistory(req.user.id)) {
    const key = (s.artist || s.id).toLowerCase();
    if (seenArtists.has(key)) continue;
    seenArtists.add(key);
    seeds.push(s);
    if (seeds.length >= 3) break;
  }

  const mixes = (
    await Promise.all(
      seeds.map(async (seed, i) => {
        const songs = await ytm.getUpNext(seed.id, 24).catch(() => []);
        if (songs.length < 3) return null;
        return {
          id: `mix-${i + 1}`,
          title: `Daily Mix ${i + 1}`,
          basedOn: `Based on ${seed.title} · ${seed.artist}`,
          image: seed.image || songs[0]?.image || "",
          songs: [seed, ...songs.filter((s) => s.id !== seed.id)],
        };
      })
    )
  ).filter(Boolean);

  const data = { mixes };
  if (mixes.length) mixCache.set(req.user.id, { data, exp: Date.now() + 6 * 60 * 60 * 1000 });
  res.json(data);
}));

// "Quick picks": the speed-dial grid on Home. Seeded from what you play most
// and what you liked, then filled out with each seed's automix continuation and
// interleaved so no single artist owns the top of the grid. Falls back to
// Trending for an account with nothing to go on yet.
const quickPickCache = new Map(); // userId -> { data, exp }

app.get("/api/quickpicks", requireAuth, wrap(async (req, res) => {
  const hit = quickPickCache.get(req.user.id);
  if (hit && hit.exp > Date.now()) return res.json(hit.data);

  // Favourites first, then recent plays — a seed each, one per artist.
  const pool = [...db.topPlayed(req.user.id, 20), ...db.likedSongs(req.user.id), ...db.getHistory(req.user.id)];
  const seeds = [];
  const seenArtists = new Set();
  for (const s of pool) {
    const key = (s.artist || s.id).toLowerCase();
    if (seenArtists.has(key)) continue;
    seenArtists.add(key);
    seeds.push(s);
    if (seeds.length >= 5) break;
  }

  const lists = (await Promise.all(
    seeds.map((seed) => ytm.getUpNext(seed.id, 12).catch(() => []))
  )).filter((l) => l.length);

  // Round-robin across the seeds so the grid reads as a mix, not five blocks.
  const seedIds = new Set(seeds.map((s) => s.id));
  const seen = new Set();
  const songs = [];
  for (let i = 0; songs.length < 24 && lists.some((l) => i < l.length); i++) {
    for (const list of lists) {
      const s = list[i];
      if (!s || seen.has(s.id) || seedIds.has(s.id)) continue;
      seen.add(s.id);
      songs.push(s);
      if (songs.length >= 24) break;
    }
  }

  if (!songs.length) {
    const { singles = [] } = await ytm.getTrending().catch(() => ({ singles: [] }));
    const data = { songs: singles.slice(0, 24), seeded: false };
    return res.json(data); // uncached: trending moves, and this is the cold path
  }

  const data = { songs, seeded: true };
  quickPickCache.set(req.user.id, { data, exp: Date.now() + 3 * 60 * 60 * 1000 });
  res.json(data);
}));

// ---------------------------------------------------------------------------
// Downloads: list the source's real formats (lossless first, if any), then
// deliver either a native format as-is or an ffmpeg conversion (flac/mp3).
// ---------------------------------------------------------------------------
const formatCache = new Map(); // id -> { data, exp }

app.get("/api/formats/:id", requireAuth, wrap(async (req, res) => {
  const hit = formatCache.get(req.params.id);
  if (hit && hit.exp > Date.now()) return res.json(hit.data);
  const data = await ytm.listFormats(req.params.id);
  formatCache.set(req.params.id, { data, exp: Date.now() + 60 * 60 * 1000 });
  res.json(data);
}));

// Is a free lossless (Qobuz) match available for this track right now?
// Cached briefly so opening the download menu is snappy and we don't hammer
// the public instances.
const losslessCache = new Map(); // `${title}|${artist}` -> { data, exp }

app.get("/api/lossless", requireAuth, wrap(async (req, res) => {
  const title = String(req.query.title || "").trim();
  const artist = String(req.query.artist || "").trim();
  if (!title) return res.json({ available: false });
  const key = `${title}|${artist}`;
  const hit = losslessCache.get(key);
  if (hit && hit.exp > Date.now()) return res.json(hit.data);

  const match = await lossless.findLossless({ title, artist }).catch(() => null);
  const data = match
    ? {
        available: true,
        provider: match.provider || "",
        bitDepth: match.bitDepth || 16,
        sampleRate: match.sampleRate || 44.1,
        matchedTitle: match.title,
        matchedArtist: match.artist,
      }
    : { available: false };
  losslessCache.set(key, { data, exp: Date.now() + 10 * 60 * 1000 });
  res.json(data);
}));

// Stream the matched FLAC through as an attachment (with Range support).
app.get("/api/download-lossless", requireAuth, wrap(async (req, res) => {
  const title = String(req.query.title || "").trim();
  const artist = String(req.query.artist || "").trim();
  if (!title) return res.status(400).json({ error: "title required" });

  const resolved = await lossless.resolveLossless({ title, artist });
  if (!resolved) {
    return res.status(404).json({ error: "no free lossless match available" });
  }

  const headers = { "User-Agent": lossless.UA };
  if (req.headers.range) headers.Range = req.headers.range;
  const upstream = await fetch(resolved.url, { headers });
  if (upstream.status >= 400 || !upstream.body) {
    return res.status(502).json({ error: `lossless source returned ${upstream.status}` });
  }

  const baseName =
    String(req.query.name || `${artist} - ${title}`)
      .replace(/[/\\?%*:|"<>]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || title;
  const ascii = baseName.replace(/[^\x20-\x7E]/g, "_");

  res.status(upstream.status);
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  if (!upstream.headers.get("content-type")) res.setHeader("Content-Type", "audio/flac");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${ascii}.flac"; filename*=UTF-8''${encodeURIComponent(baseName)}.flac`
  );
  // pipeline, not pipe: pipe() installs no error handlers, so a CDN reset
  // mid-transfer raises an unhandled 'error' and takes the whole process
  // down. pipeline tears both streams down and reports to the callback.
  pipeline(Readable.fromWeb(upstream.body), res, () => {});
}));

const DL_MIME = {
  flac: "audio/flac",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  webm: "audio/webm",
  opus: "audio/ogg",
  ogg: "audio/ogg",
};

const safeName = (raw, fallback) =>
  String(raw || fallback)
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || fallback;

// Transcode-from-YouTube path: yt-dlp writes a temp file, we stream it out and
// delete it. Shared by the explicit-format route and the FLAC fallback.
async function sendTranscoded(res, id, fmt, baseName) {
  const { dir, filePath, ext } = await ytm.downloadAudio(id, fmt);
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  try {
    const size = fs.statSync(filePath).size;
    const ascii = baseName.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader("Content-Type", DL_MIME[ext] || "application/octet-stream");
    res.setHeader("Content-Length", size);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${ascii}.${ext}"; filename*=UTF-8''${encodeURIComponent(baseName)}.${ext}`
    );
    // pipeline calls back exactly once, success or failure, so the temp dir
    // is removed on every path and stream errors can't escape as crashes.
    pipeline(fs.createReadStream(filePath), res, cleanup);
  } catch (err) {
    cleanup();
    throw err;
  }
}

app.get("/api/download/:id", requireAuth, wrap(async (req, res) => {
  const fmt = String(req.query.fmt || "flac");
  await sendTranscoded(res, req.params.id, fmt, safeName(req.query.name, req.params.id));
}));

// The one download route the UI uses: always hands back a .flac. It prefers a
// real lossless master (Qobuz / Tidal, per SpotiFLAC) and only falls back to
// transcoding the YouTube source when no lossless match is reachable. The
// X-Flac-Source header tells the client which of the two it actually got, so
// the UI can be honest about it rather than implying every file is a master.
app.get("/api/download-flac/:id", requireAuth, wrap(async (req, res) => {
  const title = String(req.query.title || "").trim();
  const artist = String(req.query.artist || "").trim();
  const baseName = safeName(req.query.name, title || req.params.id);
  res.setHeader("Access-Control-Expose-Headers", "X-Flac-Source, X-Flac-Detail");

  const resolved = title
    ? await lossless.resolveLossless({ title, artist }).catch(() => null)
    : null;

  if (resolved) {
    const upstream = await fetch(resolved.url, { headers: { "User-Agent": lossless.UA } })
      .catch(() => null);
    if (upstream && upstream.status < 400 && upstream.body) {
      const ascii = baseName.replace(/[^\x20-\x7E]/g, "_");
      const len = upstream.headers.get("content-length");
      if (len) res.setHeader("Content-Length", len);
      res.setHeader("Content-Type", "audio/flac");
      res.setHeader("X-Flac-Source", resolved.provider || "lossless");
      res.setHeader(
        "X-Flac-Detail",
        `${resolved.bitDepth || 16}-bit/${resolved.sampleRate || 44.1}kHz${resolved.matchedByIsrc ? " (ISRC match)" : ""}`
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${ascii}.flac"; filename*=UTF-8''${encodeURIComponent(baseName)}.flac`
      );
      return pipeline(Readable.fromWeb(upstream.body), res, () => {});
    }
    // resolved but the CDN refused — fall through to the transcode
  }

  res.setHeader("X-Flac-Source", "youtube");
  res.setHeader("X-Flac-Detail", "transcoded from the YouTube source");
  await sendTranscoded(res, req.params.id, "flac", baseName);
}));

// ---------------------------------------------------------------------------
// Google Cast: mint the token the sender appends to stream URLs. `base` is a
// LAN address for when the app is opened on localhost — the Chromecast can't
// resolve "localhost", it needs this machine's network IP. Opened over the
// tunnel hostname, the client just uses location.origin and ignores `base`.
// ---------------------------------------------------------------------------
// VPN/hypervisor adapters register non-internal IPv4s a Chromecast can't
// reach — prefer physical-looking interfaces (and home-LAN 192.168.* first).
// CAST_BASE_URL overrides the guess entirely.
const VIRTUAL_IFACE =
  /virtual|vethernet|vmware|vbox|hyper-v|wsl|tailscale|zerotier|wireguard|docker|bluetooth|loopback|tun|tap/i;

function lanBase() {
  if (config.castBaseUrl) return config.castBaseUrl;
  let physical = null;
  let virtual = null;
  for (const [name, ifaces] of Object.entries(os.networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family !== "IPv4" || i.internal) continue;
      const url = `http://${i.address}:${config.port}`;
      if (VIRTUAL_IFACE.test(name)) virtual ??= url;
      else if (i.address.startsWith("192.168.")) return url;
      else physical ??= url;
    }
  }
  return physical || virtual;
}

app.post("/api/cast/token", requireAuth, (req, res) => {
  res.json({ ...makeCastToken(req.user.id), base: lanBase() });
});

// Where should a playback device (Sonos here; the Chromecast client does the
// equivalent in the browser) fetch streams from? Explicit override first,
// then the origin the user is browsing on (tunnel hostname — devices can
// fetch through it), then a LAN adapter guess for the localhost case.
function deviceBase(req) {
  if (config.castBaseUrl) return config.castBaseUrl;
  const host = String(req.headers.host || "");
  if (host && !/^(localhost|127\.|\[?::1)/i.test(host)) {
    return `${req.protocol || "http"}://${host}`;
  }
  return lanBase();
}

// ---------------------------------------------------------------------------
// UPnP playback devices — Sonos speakers, DLNA smart TVs, any MediaRenderer.
// The server drives them over UPnP (lib/upnp.js) and the device fetches the
// audio with a cast token, like a Chromecast. Control is only allowed toward
// IPs that discovery/config produced, never client-invented ones (SSRF guard).
// The routes keep their /api/sonos/* names for compatibility.
// ---------------------------------------------------------------------------
app.get("/api/sonos/devices", requireAuth, wrap(async (req, res) => {
  res.json(await sonos.discover(req.query.fresh === "1"));
}));

function requireSpeaker(req, res, next) {
  const ip = String(req.body?.ip || req.query.ip || "");
  if (!sonos.isKnown(ip))
    return res.status(400).json({ error: "unknown playback device — rescan devices" });
  req.speakerIp = ip;
  next();
}

function sonosStreamUrl(req, id) {
  const base = deviceBase(req);
  if (!base)
    throw new Error("no reachable address for the speaker — set CAST_BASE_URL");
  // start resolving now: the device fetches this URL a second or two from now,
  // and a warm cache is the difference between instant playback and a stall
  resolveStreamUrl(id, "sonos").catch(() => {});
  const { token } = makeCastToken(req.user.id);
  return `${base}/api/stream/${encodeURIComponent(id)}?q=sonos&t=${encodeURIComponent(token)}`;
}

app.post("/api/sonos/play", requireAuth, requireSpeaker, wrap(async (req, res) => {
  const song = req.body?.song;
  if (!song?.id) return res.status(400).json({ error: "song required" });
  const url = sonosStreamUrl(req, song.id);
  const kind = sonos.deviceKind(req.speakerIp);
  await sonos.setUri(req.speakerIp, url, sonos.didl(song, url, kind));
  await sonos.play(req.speakerIp);
  // transfer mid-song: seek once the transport is rolling (it rejects earlier,
  // and a TV that is still buffering may drop playback entirely)
  const pos = Number(req.body.pos) || 0;
  if (pos > 1) {
    await sonos.waitUntilSettled(req.speakerIp);
    await sonos.seek(req.speakerIp, pos).catch(() => {});
  }
  res.json({ ok: true, streamUrl: url });
}));

// queue the following track on the speaker itself → gapless auto-advance
app.post("/api/sonos/next-uri", requireAuth, requireSpeaker, wrap(async (req, res) => {
  const song = req.body?.song;
  if (!song?.id) return res.status(400).json({ error: "song required" });
  const url = sonosStreamUrl(req, song.id);
  await sonos.setNextUri(req.speakerIp, url, sonos.didl(song, url, sonos.deviceKind(req.speakerIp)));
  res.json({ ok: true, streamUrl: url });
}));

app.post("/api/sonos/control", requireAuth, requireSpeaker, wrap(async (req, res) => {
  const { action, pos, volume } = req.body || {};
  const ops = {
    play: () => sonos.play(req.speakerIp),
    pause: () => sonos.pause(req.speakerIp),
    stop: () => sonos.stop(req.speakerIp),
    seek: () => sonos.seek(req.speakerIp, Number(pos) || 0),
    volume: () => sonos.setVolume(req.speakerIp, Number(volume)),
  };
  const op = ops[action];
  if (!op) return res.status(400).json({ error: "unknown action" });
  try {
    await op();
  } catch (err) {
    // UPnP 701 "transition not available": the device was still buffering.
    // Let it settle and try once more before surfacing a failure.
    if (!/\b701\b/.test(err.message) || action === "volume") throw err;
    await sonos.waitUntilSettled(req.speakerIp);
    await op();
  }
  res.json({ ok: true });
}));

app.get("/api/sonos/status", requireAuth, requireSpeaker, wrap(async (req, res) => {
  const st = await sonos.status(req.speakerIp);
  const volume = await sonos.getVolume(req.speakerIp).catch(() => null);
  res.json({ ...st, volume });
}));

// googlevideo URLs expire (~6h) and are IP-bound to this server, so cache
// resolutions with a TTL and re-resolve when the CDN rejects a stale one.
const STREAM_QUALITIES = new Set(["low", "medium", "high", "sonos"]);
const URL_TTL_MS = 4 * 60 * 60 * 1000;
const urlCache = new Map(); // `${id}:${quality}` -> { url, exp }

// The player client that last produced a working URL. yt-dlp's default is
// fine until YouTube changes its mind about it; once a fallback works there is
// no reason to keep paying for the failures that found it.
let preferredClient = "";

async function resolveStreamUrl(id, quality, { fresh = false, ipv4 = false, client = preferredClient } = {}) {
  // the client is part of the identity of a resolved URL, not a detail of how
  // it was fetched — two clients hand back genuinely different URLs
  const key = `${id}:${quality}:${client}`;
  const hit = urlCache.get(key);
  if (!fresh && hit && hit.exp > Date.now()) return hit.url;
  const src = await ytm.getStreamSource(id, quality, { ipv4, client });
  urlCache.set(key, { url: src, exp: Date.now() + URL_TTL_MS });
  return src;
}

// A UPnP renderer probes the URL with HEAD *inside* SetAVTransportURI and
// blocks until it answers — a Samsung TV does this twice before it will even
// accept the track. Resolving with yt-dlp first takes seconds, so the SOAP
// call would time out before playback ever began. Answer from what we already
// know and warm the real resolution in the background, so the GET that
// follows a moment later is served from cache. Registered before the GET
// route, which would otherwise field HEAD itself.
app.head("/api/stream/:id", streamAuth, (req, res) => {
  const quality = STREAM_QUALITIES.has(req.query.q) ? req.query.q : "high";
  resolveStreamUrl(req.params.id, quality).catch(() => {}); // warm the cache
  res.setHeader("Content-Type", quality === "sonos" ? "audio/mp4" : "audio/webm");
  res.setHeader("Accept-Ranges", "bytes");
  res.end();
});

// Audio proxy: the browser's <audio> element points here; we forward Range
// headers so seeking works. The element sends the session cookie itself
// (same-origin); a Chromecast authenticates with ?t=<cast token> instead.
app.get("/api/stream/:id", streamAuth, wrap(async (req, res) => {
  const quality = STREAM_QUALITIES.has(req.query.q) ? req.query.q : "high";
  // Whatever headers yt-dlp says this URL needs, plus the browser's Range.
  // Inventing our own User-Agent here is what produced 403s from some
  // addresses and not others.
  const withRange = (src) =>
    req.headers.range ? { ...src.headers, Range: req.headers.range } : { ...src.headers };

  let src = await resolveStreamUrl(req.params.id, quality);
  let upstream = await fetch(src.url, { headers: withRange(src) });
  if (upstream.status >= 400 || !upstream.body) {
    // stale/expired URL — re-resolve once and retry
    src = await resolveStreamUrl(req.params.id, quality, { fresh: true });
    upstream = await fetch(src.url, { headers: withRange(src) });
  }

  // Refused even after a fresh re-resolve, and the URL had not expired. One
  // cheap possibility first: the resolve and this fetch left by different
  // addresses, which happens on a dual-stack host when Node wins its Happy
  // Eyeballs race over IPv6. Google mints the URL for whoever asked, so it is
  // right to refuse. One extra resolve, spent on a request already failing.
  if ((upstream.status === 403 || upstream.status === 401) && !ipv4Pinned) {
    pinIpv4("a stream URL was refused; suspecting a split egress");
    src = await resolveStreamUrl(req.params.id, quality, { fresh: true, ipv4: true });
    upstream = await fetch(src.url, { headers: withRange(src) });
    if (upstream.status < 400 && upstream.body)
      console.log(`[stream] ${req.params.id}: recovered after pinning to IPv4`);
  }

  // Still refused: the player client yt-dlp chose is no longer one YouTube
  // will serve. Work down the ladder and keep whichever answers, so the next
  // request pays nothing for this discovery.
  if (upstream.status === 403 || upstream.status === 401) {
    for (const client of ytm.STREAM_CLIENTS) {
      if (client === preferredClient) continue; // already the failing one
      try {
        const alt = await resolveStreamUrl(req.params.id, quality, { fresh: true, client });
        const res2 = await fetch(alt.url, { headers: withRange(alt) });
        if (res2.status < 400 && res2.body) {
          preferredClient = client;
          src = alt;
          upstream = res2;
          console.log(`[stream] ${req.params.id}: recovered with player_client=${client}`);
          break;
        }
      } catch (err) {
        // an unknown or broken client is not fatal — try the next one
        console.error(`[stream] player_client=${client} failed: ${err.message.slice(0, 120)}`);
      }
    }
  }

  if (upstream.status >= 400 || !upstream.body) {
    // the key carries the client now, so clear every variant for this track
    for (const k of [...urlCache.keys()])
      if (k.startsWith(`${req.params.id}:${quality}:`)) urlCache.delete(k);
    // Refused even after a fresh re-resolve. A googlevideo URL is minted for
    // one IP and expires within hours, so the two facts worth having are
    // which address it was issued to and whether it was already stale — if
    // boundIp is not this box's public address, the resolve and the fetch
    // are leaving by different routes (classically IPv4 vs IPv6) and Google
    // is right to refuse. Logged because a 502 in a console says none of it.
    let q = new URLSearchParams();
    try { q = new URL(src.url).searchParams; } catch {}
    const expire = Number(q.get("expire")) * 1000;
    console.error(
      `[stream] ${req.params.id} q=${quality} upstream=${upstream.status} ` +
        `boundIp=${q.get("ip") || "?"} client=${q.get("c") || "?"}` +
        (expire ? ` expired=${expire < Date.now()}` : "")
    );
    return res.status(502).json({ error: `Upstream returned ${upstream.status}` });
  }

  res.status(upstream.status);
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  if (!upstream.headers.get("accept-ranges")) res.setHeader("Accept-Ranges", "bytes");

  // pipeline, not pipe — see the lossless proxy above. This is the pipe every
  // song rides for minutes at a time, so it is the likeliest place for a
  // googlevideo reset to land; before pipeline() one such reset killed the
  // whole server with no log line.
  pipeline(Readable.fromWeb(upstream.body), res, () => {});
}));

// ---------------------------------------------------------------------------
// Radio — YT Music moods & genres for stations, automix "up next" for refills
// ---------------------------------------------------------------------------
app.get("/api/radio/stations", requireAuth, wrap(async (req, res) => {
  res.json(await ytm.getStations());
}));

// Station covers, resolved lazily so the stations list itself stays instant.
// The client posts only the stations it actually rendered.
app.post("/api/radio/art", requireAuth, wrap(async (req, res) => {
  const names = (Array.isArray(req.body?.names) ? req.body.names : [])
    .filter((n) => typeof n === "string" && n.trim())
    .slice(0, 32);
  if (!names.length) return res.json({});
  res.json(await ytm.getStationArt(names).catch(() => ({})));
}));

app.get("/api/radio/queue", requireAuth, wrap(async (req, res) => {
  const name = String(req.query.name || "").trim();
  const seed = String(req.query.seed || "").trim();
  const next = Math.max(1, parseInt(req.query.next, 10) || 1);
  if (!name) return res.status(400).json({ error: "name required" });

  let songs = [];

  // Refills: continue the automix from the last queued track
  if (seed) {
    songs = await ytm.getUpNext(seed).catch(() => []);
  }
  // First batch: tracks from the genre's featured playlists
  if (!songs.length) {
    songs = await ytm.getGenreTracks(name).catch(() => []);
  }
  // Last resort: plain search, shuffled
  if (!songs.length) {
    songs = await ytm.searchSongs(name);
    for (let i = songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [songs[i], songs[j]] = [songs[j], songs[i]];
    }
  }
  res.json({ songs, next: next + 1 });
}));

// Related songs for a track ("song radio" / autoplay)
app.get("/api/reco/:id", requireAuth, wrap(async (req, res) => {
  res.json(await ytm.getUpNext(req.params.id));
}));

// ---------------------------------------------------------------------------
// Library: per-user liked songs, history, playlists (SQLite)
// ---------------------------------------------------------------------------
app.get("/api/library", requireAuth, (req, res) => res.json(db.getLibrary(req.user.id)));

app.post("/api/history", requireAuth, (req, res) => {
  const song = req.body?.song;
  if (song?.id) db.addHistory(req.user.id, song);
  res.json(db.getHistory(req.user.id));
});

app.delete("/api/history", requireAuth, (req, res) => {
  db.clearHistory(req.user.id);
  res.json([]);
});

app.post("/api/liked/toggle", requireAuth, (req, res) => {
  const song = req.body?.song;
  if (!song?.id) return res.status(400).json({ error: "song required" });
  const liked = db.toggleLike(req.user.id, song);
  res.json({ liked, songs: db.likedSongs(req.user.id) });
});

// "Listen later" — deliberately separate from playlists so exploring never
// clutters a curated list.
app.post("/api/saves/toggle", requireAuth, (req, res) => {
  const song = req.body?.song;
  if (!song?.id) return res.status(400).json({ error: "song required" });
  const saved = db.toggleSave(req.user.id, song);
  res.json({ saved, songs: db.savedSongs(req.user.id) });
});

app.delete("/api/saves", requireAuth, (req, res) => {
  db.clearSaves(req.user.id);
  res.json([]);
});

app.get("/api/top-played", requireAuth, (req, res) =>
  res.json(db.topPlayed(req.user.id, Math.min(100, Number(req.query.limit) || 50)))
);

// Who else is on this instance. Non-admins get names and roles only — no
// email addresses, and nothing they could act on.
app.get("/api/members", requireAuth, (req, res) =>
  res.json(db.listUsers()
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, name: u.name, role: u.role, active: u.active })))
);

// ---- friends (members of this instance, found by display name) ----
app.get("/api/friends", requireAuth, (req, res) => res.json(db.getFriends(req.user.id)));

app.get("/api/friends/search", requireAuth, (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.json([]);
  res.json(db.searchMembers(req.user.id, q));
});

app.post("/api/friends/:id", requireAuth, (req, res) => {
  const out = db.requestFriend(req.user.id, Number(req.params.id));
  if (!out) return res.status(404).json({ error: "member not found" });
  res.json({ ...out, ...db.getFriends(req.user.id) });
});

app.delete("/api/friends/:id", requireAuth, (req, res) => {
  db.removeFriend(req.user.id, Number(req.params.id));
  res.json(db.getFriends(req.user.id));
});

app.post("/api/albums/toggle", requireAuth, (req, res) => {
  const album = req.body?.album;
  if (!album?.token) return res.status(400).json({ error: "album required" });
  const saved = db.toggleSavedAlbum(req.user.id, album);
  res.json({ saved, albums: db.savedAlbums(req.user.id) });
});

app.post("/api/artists/toggle", requireAuth, (req, res) => {
  const artist = req.body?.artist;
  if (!artist?.id) return res.status(400).json({ error: "artist required" });
  const followed = db.toggleFollowedArtist(req.user.id, artist);
  res.json({ followed, artists: db.followedArtists(req.user.id) });
});

app.post("/api/playlists", requireAuth, (req, res) => {
  const name = String(req.body?.name || "").trim() || "My Playlist";
  res.json(db.createPlaylist(req.user.id, name));
});

app.put("/api/playlists/:id", requireAuth, (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const p = db.renamePlaylist(req.user.id, Number(req.params.id), name);
  if (!p) return res.status(404).json({ error: "playlist not found" });
  res.json(p);
});

app.delete("/api/playlists/:id", requireAuth, (req, res) => {
  if (!db.deletePlaylist(req.user.id, Number(req.params.id)))
    return res.status(404).json({ error: "playlist not found" });
  res.json({ ok: true });
});

app.post("/api/playlists/:id/songs", requireAuth, (req, res) => {
  const song = req.body?.song;
  if (!song?.id) return res.status(400).json({ error: "song required" });
  const result = db.addPlaylistSong(req.user.id, Number(req.params.id), song);
  if (!result) return res.status(404).json({ error: "playlist not found" });
  res.json(result);
});

app.delete("/api/playlists/:id/songs/:songId", requireAuth, (req, res) => {
  const p = db.removePlaylistSong(req.user.id, Number(req.params.id), req.params.songId);
  if (!p) return res.status(404).json({ error: "playlist not found" });
  res.json(p);
});

app.put("/api/playlists/:id/order", requireAuth, (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || !ids.length)
    return res.status(400).json({ error: "ids array required" });
  const p = db.reorderPlaylist(req.user.id, Number(req.params.id), ids.map(String));
  if (!p) return res.status(404).json({ error: "playlist not found" });
  res.json(p);
});

// ---------------------------------------------------------------------------
// Playlist sharing (members-only links), export, import
// ---------------------------------------------------------------------------
app.get("/api/playlists/:id/share", requireAuth, (req, res) => {
  const p = db.getPlaylist(req.user.id, Number(req.params.id));
  if (!p) return res.status(404).json({ error: "playlist not found" });
  res.json({ token: db.getShareToken(req.user.id, p.id) });
});

app.post("/api/playlists/:id/share", requireAuth, (req, res) => {
  const token = db.sharePlaylist(req.user.id, Number(req.params.id));
  if (!token) return res.status(404).json({ error: "playlist not found" });
  res.json({ token, url: `/#/shared/${token}` });
});

app.delete("/api/playlists/:id/share", requireAuth, (req, res) => {
  if (!db.revokeShare(req.user.id, Number(req.params.id)))
    return res.status(404).json({ error: "playlist not found" });
  res.json({ ok: true });
});

app.get("/api/shared/:token", requireAuth, (req, res) => {
  const p = db.getSharedPlaylist(req.params.token);
  if (!p) return res.status(404).json({ error: "share link is invalid or was revoked" });
  res.json(p);
});

app.post("/api/shared/:token/copy", requireAuth, (req, res) => {
  const p = db.getSharedPlaylist(req.params.token);
  if (!p) return res.status(404).json({ error: "share link is invalid or was revoked" });
  res.json(db.importPlaylist(req.user.id, p.name, p.songs));
});

app.get("/api/playlists/:id/export", requireAuth, (req, res) => {
  const p = db.getPlaylist(req.user.id, Number(req.params.id));
  if (!p) return res.status(404).json({ error: "playlist not found" });
  const fname = p.name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 80) || "playlist";
  res.setHeader("Content-Disposition", `attachment; filename="${fname}.marusic.json"`);
  res.json({ app: "marusic", name: p.name, exportedAt: new Date().toISOString(), songs: p.songs });
});

app.post("/api/playlists/import", requireAuth, (req, res) => {
  const { name, songs } = req.body || {};
  if (!Array.isArray(songs)) return res.status(400).json({ error: "songs array required" });
  const clean = songs
    .filter((s) => s && s.id && s.title)
    .slice(0, 500)
    .map((s) => ({ id: s.id, title: s.title, artist: s.artist, album: s.album, duration: s.duration, image: s.image }));
  if (!clean.length) return res.status(400).json({ error: "no importable songs found" });
  res.json(db.importPlaylist(req.user.id, String(name || "Imported playlist").trim().slice(0, 60) || "Imported playlist", clean));
});

// ---------------------------------------------------------------------------
// Shared real-time listening — REST for actions, SSE for push. State lives in
// memory (lib/jam.js): sessions are ephemeral, a restart ends them.
//
// Two products over one engine, split by mode (see lib/jam.js): "speaker" is
// a Jam (same room, one device makes sound) and "together" is Listen together
// (everyone remote, every device plays). The routes are shared because the
// queue, presence, permissions and transport are identical — only the audio
// role differs, and that is decided on the client.
// ---------------------------------------------------------------------------
function requireJamMember(req, res, next) {
  const j = jam.jamForUser(req.user.id);
  if (!j) return res.status(404).json({ error: "you're not in a jam" });
  req.jam = j;
  next();
}
function requireJamControl(req, res, next) {
  if (!jam.canControl(req.jam, req.user.id))
    return res.status(403).json({ error: "the host has playback control locked" });
  next();
}
function requireJamHost(req, res, next) {
  if (req.jam.hostId !== req.user.id)
    return res.status(403).json({ error: "host only" });
  next();
}

// When the current track is the last one and jam-autoplay is on, top the
// queue up with related songs (the same automix continuation the local
// player's autoplay uses) before advancing, so the music never stops.
//
// The store schedules this a good while before the track runs out (it knows
// when that is), so the next song is normally sitting in the queue when the
// boundary arrives. Everything else that can reach the end of a queue — a
// tapped "next", a client's `ended` report — calls it too, and `extending`
// holds the in-flight promise so every caller rides the same fetch instead of
// racing it. A second caller that skipped the wait would see "no next track"
// and stop the session, leaving the refill to land on a jam parked at 0:00 of
// the song that just finished.
async function refillJamIfEnding(j) {
  if (!j.settings.autoplay) return;
  if (j.extending) return j.extending;
  if (j.index < j.queue.length - 1) return;
  const last = j.queue[j.queue.length - 1];
  if (!last) return;
  j.extending = (async () => {
    try {
      const songs = await ytm.getUpNext(last.id).catch(() => []);
      jam.extendQueue(j, songs);
    } finally {
      j.extending = false;
    }
  })();
  return j.extending;
}

// the store can't fetch recommendations itself — it asks us to, in time
jam.onNeedsRefill((j) => { refillJamIfEnding(j); });

app.post("/api/jam", requireAuth, (req, res) => {
  const { queue, index, pos, playing, deviceId, mode } = req.body || {};
  // In a jam the creating device becomes the speaker — the only one that
  // actually plays audio; every other member is a synchronized remote. In
  // listen-together mode there is no speaker: everyone plays their own copy.
  const j = jam.createJam(req.user, { queue, index, pos, playing }, deviceId, mode);
  res.json(jam.snapshot(j, req.user.id));
});

// Server clock, for the client's offset estimate. Deliberately tiny: the
// client times the round trip and keeps its lowest-latency sample, which is
// far more accurate than reading `now` off a pushed SSE payload (that bakes
// in one-way delay it can't measure). Listen-together needs that accuracy —
// a 200ms offset error puts everyone permanently 200ms apart.
app.get("/api/jam/time", requireAuth, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ now: Date.now() });
});

app.get("/api/jam", requireAuth, (req, res) => {
  const j = jam.jamForUser(req.user.id);
  res.json({ jam: j ? jam.snapshot(j, req.user.id) : null });
});

// what a join link shows before the person commits
app.get("/api/jam/peek/:code", requireAuth, (req, res) => {
  const p = jam.peekJam(req.params.code);
  if (!p) return res.status(404).json({ error: "that jam has ended or the code is wrong" });
  res.json(p);
});

app.post("/api/jam/join", requireAuth, (req, res) => {
  const j = jam.joinJam(req.user, String(req.body?.code || ""));
  if (!j) return res.status(404).json({ error: "that jam has ended or the code is wrong" });
  res.json(jam.snapshot(j, req.user.id));
});

app.post("/api/jam/leave", requireAuth, (req, res) => {
  res.json(jam.leaveJam(req.user.id));
});

app.post("/api/jam/end", requireAuth, requireJamMember, requireJamHost, (req, res) => {
  jam.endJam(req.jam);
  res.json({ ok: true });
});

app.post("/api/jam/kick", requireAuth, requireJamMember, requireJamHost, (req, res) => {
  if (!jam.kickMember(req.jam, Number(req.body?.userId)))
    return res.status(400).json({ error: "not a kickable member" });
  res.json({ ok: true });
});

app.post("/api/jam/settings", requireAuth, requireJamMember, requireJamHost, (req, res) => {
  res.json({ settings: jam.setJamSettings(req.jam, req.body || {}) });
});

// host moves the audio to the device they're on ("play here") — jams only
app.post("/api/jam/speaker", requireAuth, requireJamMember, requireJamHost, (req, res) => {
  const deviceId = String(req.body?.deviceId || "");
  if (!deviceId) return res.status(400).json({ error: "deviceId required" });
  if (!jam.setSpeaker(req.jam, deviceId))
    return res.status(400).json({ error: "everyone's own device plays in listen together" });
  res.json({ ok: true });
});

// anyone in the jam can add songs — that's the point of a jam
app.post("/api/jam/queue", requireAuth, requireJamMember, (req, res) => {
  const songs = Array.isArray(req.body?.songs) ? req.body.songs : [req.body?.song];
  const added = jam.addSongs(req.jam, songs, req.user.name);
  if (!added) return res.status(400).json({ error: "nothing to add (queue full?)" });
  res.json({ added });
});

app.delete("/api/jam/queue/:index", requireAuth, requireJamMember, requireJamControl, (req, res) => {
  if (!jam.removeSongAt(req.jam, Number(req.params.index)))
    return res.status(400).json({ error: "can't remove that track" });
  res.json({ ok: true });
});

app.post("/api/jam/play", requireAuth, requireJamMember, requireJamControl, (req, res) => {
  const ok = req.body?.index != null
    ? jam.playAt(req.jam, Number(req.body.index))
    : jam.resumeJam(req.jam);
  if (!ok) return res.status(400).json({ error: "nothing to play" });
  res.json({ ok: true });
});

app.post("/api/jam/pause", requireAuth, requireJamMember, requireJamControl, (req, res) => {
  jam.pauseJam(req.jam);
  res.json({ ok: true });
});

app.post("/api/jam/seek", requireAuth, requireJamMember, requireJamControl, (req, res) => {
  if (!jam.seekTo(req.jam, Number(req.body?.pos)))
    return res.status(400).json({ error: "nothing playing" });
  res.json({ ok: true });
});

app.post("/api/jam/next", requireAuth, requireJamMember, requireJamControl, wrap(async (req, res) => {
  await refillJamIfEnding(req.jam);
  if (!jam.nextTrack(req.jam)) return res.status(400).json({ error: "end of the jam queue" });
  res.json({ ok: true });
}));

app.post("/api/jam/prev", requireAuth, requireJamMember, requireJamControl, (req, res) => {
  jam.prevTrack(req.jam);
  res.json({ ok: true });
});

// a client's <audio> finished the current track — advance the session. In a
// jam markEnded rejects reports from any device but the speaker (remotes have
// no audio); in listen-together every member reports and the first one wins.
app.post("/api/jam/ended", requireAuth, requireJamMember, wrap(async (req, res) => {
  const i = Number(req.body?.index);
  const deviceId = String(req.body?.deviceId || "");
  const isSpeaker = !req.jam.speakerId || deviceId === req.jam.speakerId;
  if (isSpeaker && i === req.jam.index && req.jam.playing) await refillJamIfEnding(req.jam);
  res.json({ advanced: jam.markEnded(req.jam, i, deviceId) });
}));

// SSE push channel. EventSource reconnects on its own and every (re)connect
// starts with a fresh full snapshot, so a dropped event is never fatal.
app.get("/api/jam/events", requireAuth, requireJamMember, (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // proxies must not buffer the stream
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  res.write("retry: 2500\n\n");
  send("hello", jam.snapshot(req.jam, req.user.id));
  // EventSource can't set headers, so the device id rides the query string
  const device = String(req.query.device || "");
  const unsub = jam.subscribe(req.jam, req.user.id, device, send, () => res.end());
  const heartbeat = setInterval(() => res.write(":hb\n\n"), 25_000);
  res.on("close", () => {
    clearInterval(heartbeat);
    unsub();
  });
});

// SPA fallback
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Prune expired sessions periodically.
setInterval(() => db.pruneSessions(SESSION_MAX_AGE), 24 * 60 * 60 * 1000).unref?.();

// Garbage-collect jams nobody has been connected to for a while.
setInterval(() => jam.sweepJams(10 * 60 * 1000), 60 * 1000).unref?.();

// Last-resort visibility. The server once died mid-song with nothing in the
// log, which cost an evening of guessing; whatever slips every guard above
// must at least say what it was. A stray rejection is almost always a lost
// network promise on a music box, so log it and keep playing; an uncaught
// exception means unknown state, so log it and let Docker restart us.
process.on("unhandledRejection", (err) => {
  console.error(`[fatal?] unhandled rejection: ${err?.stack || err}`);
});
process.on("uncaughtException", (err) => {
  console.error(`[fatal] uncaught exception: ${err?.stack || err}`);
  process.exit(1);
});

app.listen(config.port, () => {
  console.log(`Marusic running at http://localhost:${config.port}`);
  // The Docker layer that installs yt-dlp is cached, so a freshly built
  // image can still carry a months-old extractor — and a stale extractor
  // hands back URLs YouTube then refuses. Say which one is aboard.
  ytm.ytdlpVersion().then((v) => console.log(`  yt-dlp ${v}`));
});

// SQLite via Node's built-in driver (same approach as animeMarwan) — no
// native deps, no separate DB server. Holds users, sessions, invites, and the
// per-user music library: liked songs, play history, and playlists.
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile = config.dbPath || path.join(__dirname, "..", "data", "marusic.sqlite");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new DatabaseSync(dbFile);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY,
    email    TEXT UNIQUE NOT NULL,
    name     TEXT NOT NULL,
    pw_hash  TEXT,
    role     TEXT NOT NULL DEFAULT 'member',
    active   INTEGER NOT NULL DEFAULT 1,
    created  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invites (
    token    TEXT PRIMARY KEY,
    email    TEXT NOT NULL,
    name     TEXT NOT NULL,
    role     TEXT NOT NULL DEFAULT 'member',
    used     INTEGER NOT NULL DEFAULT 0,
    created  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token    TEXT PRIMARY KEY,
    user_id  INTEGER NOT NULL,
    created  INTEGER NOT NULL
  );

  -- long-lived bearer credentials for native clients (the Android app /
  -- Android Auto): unlike sessions they survive password changes and are
  -- revoked one device at a time. Only a hash of the token is stored.
  CREATE TABLE IF NOT EXISTS device_tokens (
    id         INTEGER PRIMARY KEY,
    token_hash TEXT UNIQUE NOT NULL,
    user_id    INTEGER NOT NULL,
    name       TEXT NOT NULL,
    created    INTEGER NOT NULL,
    last_used  INTEGER NOT NULL
  );

  -- songs are external API entities, so each row stores a small snapshot
  -- (id + display metadata), like animeMarwan's progress table does
  CREATE TABLE IF NOT EXISTS liked (
    user_id  INTEGER NOT NULL,
    song_id  TEXT NOT NULL,
    title    TEXT NOT NULL,
    artist   TEXT,
    album    TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    image    TEXT,
    created  INTEGER NOT NULL,
    PRIMARY KEY (user_id, song_id)
  );

  CREATE TABLE IF NOT EXISTS history (
    user_id   INTEGER NOT NULL,
    song_id   TEXT NOT NULL,
    title     TEXT NOT NULL,
    artist    TEXT,
    album     TEXT,
    duration  INTEGER NOT NULL DEFAULT 0,
    image     TEXT,
    played_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, song_id)
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id       INTEGER PRIMARY KEY,
    user_id  INTEGER NOT NULL,
    name     TEXT NOT NULL,
    created  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS playlist_items (
    playlist_id INTEGER NOT NULL,
    song_id     TEXT NOT NULL,
    title       TEXT NOT NULL,
    artist      TEXT,
    album       TEXT,
    duration    INTEGER NOT NULL DEFAULT 0,
    image       TEXT,
    created     INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, song_id)
  );

  -- albums saved to the library (snapshot of search/album metadata, like liked)
  CREATE TABLE IF NOT EXISTS saved_albums (
    user_id  INTEGER NOT NULL,
    token    TEXT NOT NULL,
    title    TEXT NOT NULL,
    artist   TEXT,
    year     TEXT,
    image    TEXT,
    created  INTEGER NOT NULL,
    PRIMARY KEY (user_id, token)
  );

  CREATE TABLE IF NOT EXISTS followed_artists (
    user_id   INTEGER NOT NULL,
    artist_id TEXT NOT NULL,
    name      TEXT NOT NULL,
    image     TEXT,
    created   INTEGER NOT NULL,
    PRIMARY KEY (user_id, artist_id)
  );

  -- share links: any signed-in member with the token can view / copy the list
  CREATE TABLE IF NOT EXISTS playlist_shares (
    token       TEXT PRIMARY KEY,
    playlist_id INTEGER NOT NULL,
    created     INTEGER NOT NULL
  );

  -- "listen later": a lightweight exploration queue that deliberately sits
  -- outside playlists, so trying something out never clutters a curated list
  CREATE TABLE IF NOT EXISTS saves (
    user_id  INTEGER NOT NULL,
    song_id  TEXT NOT NULL,
    title    TEXT NOT NULL,
    artist   TEXT,
    artist_id TEXT NOT NULL DEFAULT '',
    album    TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    image    TEXT,
    created  INTEGER NOT NULL,
    PRIMARY KEY (user_id, song_id)
  );

  -- friendships between members of this instance. One row per direction so a
  -- pending request is just the half that hasn't been reciprocated yet.
  CREATE TABLE IF NOT EXISTS friend_edges (
    user_id   INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    created   INTEGER NOT NULL,
    PRIMARY KEY (user_id, friend_id)
  );

  -- "not interested": tracks the listener explicitly hid. The recommender
  -- treats these as a hard no (and the artist as a soft no), so the snapshot
  -- keeps the artist name alongside the id.
  CREATE TABLE IF NOT EXISTS hidden (
    user_id  INTEGER NOT NULL,
    song_id  TEXT NOT NULL,
    artist   TEXT,
    created  INTEGER NOT NULL,
    PRIMARY KEY (user_id, song_id)
  );
`);

const hasColumn = (table, col) =>
  db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);

// Migration: song snapshots gained the artist's channel id so artist names
// stay clickable for songs replayed from the library.
for (const table of ["liked", "history", "playlist_items"]) {
  if (!hasColumn(table, "artist_id")) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN artist_id TEXT NOT NULL DEFAULT ''`);
  }
}

// Migration: history gained a play counter so "most frequently listened to"
// can rank by real play counts. Existing rows start at one play each.
if (!hasColumn("history", "plays")) {
  db.exec("ALTER TABLE history ADD COLUMN plays INTEGER NOT NULL DEFAULT 1");
}

// Migration: history gained watch-time columns. YouTube-style ranking scores
// by time actually listened, not clicks — completions push a track's artist
// up, early skips push it down. Older rows stay at zero, which the
// recommender reads as "no signal", not "never finished".
for (const col of ["ms_played", "skips", "completions"]) {
  if (!hasColumn("history", col)) {
    db.exec(`ALTER TABLE history ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`);
  }
}

// Migration: playlist_items gained an explicit position for drag-reordering.
// Older databases ordered by insertion time, so backfill positions that way.
{
  const cols = db.prepare("PRAGMA table_info(playlist_items)").all().map((c) => c.name);
  if (!cols.includes("position")) {
    db.exec("ALTER TABLE playlist_items ADD COLUMN position INTEGER NOT NULL DEFAULT 0");
    const rows = db
      .prepare("SELECT playlist_id, song_id FROM playlist_items ORDER BY playlist_id, created")
      .all();
    const setPos = db.prepare(
      "UPDATE playlist_items SET position = ? WHERE playlist_id = ? AND song_id = ?"
    );
    let last = null, pos = 0;
    for (const r of rows) {
      if (r.playlist_id !== last) { last = r.playlist_id; pos = 0; }
      setPos.run(++pos, r.playlist_id, r.song_id);
    }
  }
}

// ---- password hashing (scrypt, built in) ----
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const dk = crypto.scryptSync(pw, salt, 32);
  return `${salt.toString("hex")}:${dk.toString("hex")}`;
}
export function verifyPassword(pw, stored) {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(":");
  const dk = crypto.scryptSync(pw, Buffer.from(saltHex, "hex"), 32);
  return crypto.timingSafeEqual(dk, Buffer.from(hashHex, "hex"));
}

const token = () => crypto.randomBytes(24).toString("hex");
const now = () => Date.now();

// ---- users ----
export const getUserByEmail = (email) =>
  db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
export const getUserById = (id) =>
  db.prepare("SELECT * FROM users WHERE id = ?").get(id);
export const listUsers = () =>
  db.prepare("SELECT id,email,name,role,active,created FROM users ORDER BY created").all();
export function createUser({ email, name, password, role = "member" }) {
  const info = db
    .prepare("INSERT INTO users (email,name,pw_hash,role,active,created) VALUES (?,?,?,?,1,?)")
    .run(email.toLowerCase(), name, password ? hashPassword(password) : null, role, now());
  return getUserById(info.lastInsertRowid);
}
export const setUserActive = (id, active) =>
  db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
export const deleteUser = (id) => {
  db.prepare("DELETE FROM device_tokens WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM liked WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM history WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM saved_albums WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM followed_artists WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM saves WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM hidden WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM friend_edges WHERE user_id = ? OR friend_id = ?").run(id, id);
  db.prepare(
    "DELETE FROM playlist_shares WHERE playlist_id IN (SELECT id FROM playlists WHERE user_id = ?)"
  ).run(id);
  db.prepare(
    "DELETE FROM playlist_items WHERE playlist_id IN (SELECT id FROM playlists WHERE user_id = ?)"
  ).run(id);
  db.prepare("DELETE FROM playlists WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
};

export const updatePassword = (id, password) =>
  db.prepare("UPDATE users SET pw_hash = ? WHERE id = ?").run(hashPassword(password), id);
export const updateName = (id, name) =>
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, id);
export const countAdmins = () =>
  db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin' AND active=1").get().c;

// ---- invites ----
export function createInvite({ email, name, role = "member" }) {
  const t = token();
  db.prepare("INSERT INTO invites (token,email,name,role,used,created) VALUES (?,?,?,?,0,?)")
    .run(t, email.toLowerCase(), name, role, now());
  return t;
}
export const getInvite = (t) =>
  db.prepare("SELECT * FROM invites WHERE token = ? AND used = 0").get(t);
export const useInvite = (t) =>
  db.prepare("UPDATE invites SET used = 1 WHERE token = ?").run(t);
export const listInvites = () =>
  db.prepare("SELECT token,email,name,role,used,created FROM invites ORDER BY created DESC").all();

// ---- sessions ----
export function createSession(userId) {
  const t = token();
  db.prepare("INSERT INTO sessions (token,user_id,created) VALUES (?,?,?)").run(t, userId, now());
  return t;
}
export function getSessionUser(t, maxAgeMs) {
  if (!t) return null;
  const s = db.prepare("SELECT * FROM sessions WHERE token = ?").get(t);
  if (!s) return null;
  if (maxAgeMs && Date.now() - s.created > maxAgeMs) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(t); // expired
    return null;
  }
  const u = getUserById(s.user_id);
  return u && u.active ? u : null;
}
export const destroySession = (t) =>
  db.prepare("DELETE FROM sessions WHERE token = ?").run(t);
export const destroyUserSessions = (id) =>
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id); // instant revoke
export function pruneSessions(maxAgeMs) {
  db.prepare("DELETE FROM sessions WHERE created < ?").run(Date.now() - maxAgeMs);
}

// ---- device tokens ----
const hashToken = (raw) => crypto.createHash("sha256").update(String(raw)).digest("hex");

export function createDeviceToken(userId, name) {
  const raw = crypto.randomBytes(32).toString("hex");
  const info = db
    .prepare("INSERT INTO device_tokens (token_hash,user_id,name,created,last_used) VALUES (?,?,?,?,?)")
    .run(hashToken(raw), userId, String(name || "device").slice(0, 64), now(), now());
  return { id: Number(info.lastInsertRowid), token: raw }; // raw token exists only here
}

export function getUserByDeviceToken(raw) {
  if (!raw) return null;
  const row = db.prepare("SELECT * FROM device_tokens WHERE token_hash = ?").get(hashToken(raw));
  if (!row) return null;
  const u = getUserById(row.user_id);
  if (!u || !u.active) return null;
  // last_used is informational — throttle to one write per minute per token
  if (now() - row.last_used > 60_000)
    db.prepare("UPDATE device_tokens SET last_used = ? WHERE id = ?").run(now(), row.id);
  return u;
}

export const listDeviceTokens = (userId) =>
  // id (rowid) breaks ties: two tokens minted in the same millisecond would
  // otherwise come back in arbitrary order
  db.prepare("SELECT id,name,created,last_used FROM device_tokens WHERE user_id = ? ORDER BY created DESC, id DESC")
    .all(userId)
    .map((r) => ({ id: r.id, name: r.name, created: r.created, lastUsed: r.last_used }));

export const revokeDeviceToken = (userId, id) =>
  db.prepare("DELETE FROM device_tokens WHERE user_id = ? AND id = ?").run(userId, id).changes > 0;

// ---- music library ----
const rowToSong = (r) => ({
  id: r.song_id,
  title: r.title,
  artist: r.artist || "Unknown Artist",
  artistId: r.artist_id || "",
  album: r.album || "Unknown Album",
  duration: r.duration,
  image: r.image || "",
});

const songCols = (s) => [
  String(s.id),
  String(s.title || "Unknown Title"),
  String(s.artist || ""),
  String(s.artistId || ""),
  String(s.album || ""),
  Number(s.duration) || 0,
  String(s.image || ""),
];

// rowid breaks same-millisecond ties so "latest like" ordering is deterministic
export const likedSongs = (userId) =>
  db.prepare("SELECT * FROM liked WHERE user_id = ? ORDER BY created DESC, rowid DESC").all(userId).map(rowToSong);

export function toggleLike(userId, song) {
  const has = db.prepare("SELECT 1 FROM liked WHERE user_id=? AND song_id=?").get(userId, String(song.id));
  if (has) {
    db.prepare("DELETE FROM liked WHERE user_id=? AND song_id=?").run(userId, String(song.id));
    return false;
  }
  db.prepare(
    "INSERT INTO liked (user_id,song_id,title,artist,artist_id,album,duration,image,created) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run(userId, ...songCols(song), now());
  return true;
}

export const getHistory = (userId) =>
  db.prepare("SELECT * FROM history WHERE user_id = ? ORDER BY played_at DESC LIMIT 100").all(userId).map(rowToSong);

export function addHistory(userId, song) {
  db.prepare(
    "INSERT INTO history (user_id,song_id,title,artist,artist_id,album,duration,image,played_at,plays) VALUES (?,?,?,?,?,?,?,?,?,1) " +
      "ON CONFLICT(user_id,song_id) DO UPDATE SET title=excluded.title, artist=excluded.artist, " +
      "artist_id=excluded.artist_id, album=excluded.album, duration=excluded.duration, " +
      "image=excluded.image, played_at=excluded.played_at, plays=history.plays+1"
  ).run(userId, ...songCols(song), now());
}

// Watch-time feedback, the signal YouTube-style ranking is built on: how much
// of the track was actually heard. Finishing (>=90%) counts as a completion;
// bailing inside 30 seconds or the first third counts as a skip. Anything in
// between is just listened time. Outcomes only attach to plays we saw start.
export function notePlayOutcome(userId, songId, ms, durMs) {
  const id = String(songId);
  const has = db.prepare("SELECT 1 FROM history WHERE user_id=? AND song_id=?").get(userId, id);
  if (!has) return false;
  const heard = Math.max(0, Math.min(Number(ms) || 0, 24 * 60 * 60 * 1000));
  const dur = Math.max(0, Number(durMs) || 0);
  const done = dur > 0 && heard >= dur * 0.9;
  const skip = !done && (heard < 30_000 || (dur > 0 && heard < dur / 3));
  db.prepare(
    "UPDATE history SET ms_played = ms_played + ?, completions = completions + ?, skips = skips + ? WHERE user_id=? AND song_id=?"
  ).run(Math.round(heard), done ? 1 : 0, skip ? 1 : 0, userId, id);
  return true;
}

// ---- hidden ("not interested") ----
export const hiddenSongIds = (userId) =>
  db.prepare("SELECT song_id FROM hidden WHERE user_id = ?").all(userId).map((r) => r.song_id);

export function hideSong(userId, song) {
  db.prepare("INSERT OR IGNORE INTO hidden (user_id,song_id,artist,created) VALUES (?,?,?,?)")
    .run(userId, String(song.id), String(song.artist || ""), now());
  return true;
}

export const unhideSong = (userId, songId) =>
  db.prepare("DELETE FROM hidden WHERE user_id=? AND song_id=?").run(userId, String(songId)).changes > 0;

// ---- recommendation inputs ----
// Raw rows (snapshots plus the counters), not the mapped song shapes — the
// recommender needs plays / ms_played / skips / played_at, which rowToSong drops.
export const getTasteData = (userId) => {
  // Recency alone would let a big Takeout import fall out of the window —
  // its rows carry old timestamps by design. Taste reads the union of the
  // newest rows and the most-played rows, so all-time favourites keep
  // feeding the profile no matter how much has been played since.
  const recent = db.prepare(
    "SELECT * FROM history WHERE user_id = ? ORDER BY played_at DESC LIMIT 300"
  ).all(userId);
  const seen = new Set(recent.map((r) => r.song_id));
  const top = db.prepare(
    "SELECT * FROM history WHERE user_id = ? ORDER BY plays DESC, played_at DESC LIMIT 200"
  ).all(userId).filter((r) => !seen.has(r.song_id));
  return {
    history: [...recent, ...top],
    liked: db.prepare("SELECT * FROM liked WHERE user_id = ? ORDER BY created DESC LIMIT 200").all(userId),
    saves: db.prepare("SELECT * FROM saves WHERE user_id = ?").all(userId),
    followed: db.prepare("SELECT * FROM followed_artists WHERE user_id = ?").all(userId),
    hidden: db.prepare("SELECT * FROM hidden WHERE user_id = ?").all(userId),
  };
};

// Collaborative filtering at the scale of one instance: members who play what
// you play ("neighbors", weighted by overlap) nominate their favourites you
// haven't heard — YouTube's co-watch candidate source, in one SQL query.
export const coListenedCandidates = (userId, limit = 40) =>
  db.prepare(
    `WITH neighbors AS (
       SELECT o.user_id AS uid, COUNT(*) AS overlap
       FROM history mine
       JOIN history o ON o.song_id = mine.song_id AND o.user_id != mine.user_id
       WHERE mine.user_id = ?
       GROUP BY o.user_id
     )
     SELECT h.song_id, h.title, h.artist, h.artist_id, h.album, h.duration, h.image,
            SUM(n.overlap * (h.plays + h.completions)) AS weight
     FROM history h
     JOIN neighbors n ON n.uid = h.user_id
     WHERE h.song_id NOT IN (SELECT song_id FROM history WHERE user_id = ?)
       AND h.song_id NOT IN (SELECT song_id FROM hidden WHERE user_id = ?)
     GROUP BY h.song_id
     ORDER BY weight DESC
     LIMIT ?`
  ).all(userId, userId, userId, limit)
    .map((r) => ({ ...rowToSong(r), weight: r.weight }));

// Bulk seed from a YouTube Takeout export: one row per song, plays already
// aggregated, with the *latest* real listen time. Existing rows gain the
// plays; played_at only ever moves forward, so an import can't bury what you
// played this morning under 2019 — and old obsessions stay old for decay.
export function importPlays(userId, rows) {
  const ins = db.prepare(
    "INSERT INTO history (user_id,song_id,title,artist,artist_id,album,duration,image,played_at,plays) VALUES (?,?,?,?,?,?,?,?,?,?) " +
      "ON CONFLICT(user_id,song_id) DO UPDATE SET plays = history.plays + excluded.plays, " +
      "played_at = MAX(history.played_at, excluded.played_at)"
  );
  let imported = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r?.id || !r?.title) continue;
    const plays = Math.max(1, Math.min(10_000, Math.round(Number(r.plays) || 1)));
    // clamp to [1, now]: future stamps can't jump the queue, and a missing
    // stamp reads as ancient (fully decayed) rather than "played just now"
    const at = Math.min(now(), Math.max(1, Number(r.lastPlayed) || 1));
    ins.run(userId, ...songCols(r), at, plays);
    imported++;
  }
  return imported;
}

// Ranked by how often you actually played something, not how recently — this
// is what the artist page's "most frequently listened to" shelf reads from.
export const topPlayed = (userId, limit = 50) =>
  db.prepare("SELECT * FROM history WHERE user_id = ? ORDER BY plays DESC, played_at DESC LIMIT ?")
    .all(userId, limit)
    .map((r) => ({ ...rowToSong(r), plays: r.plays }));

export const clearHistory = (userId) =>
  db.prepare("DELETE FROM history WHERE user_id = ?").run(userId);

// ---- playlists ----
const playlistSongs = (playlistId) =>
  db.prepare("SELECT * FROM playlist_items WHERE playlist_id = ? ORDER BY position, created")
    .all(playlistId).map(rowToSong);

export function getPlaylist(userId, id) {
  const p = db.prepare("SELECT * FROM playlists WHERE id = ? AND user_id = ?").get(id, userId);
  return p ? { id: p.id, name: p.name, createdAt: p.created, songs: playlistSongs(p.id) } : null;
}

export const listPlaylists = (userId) =>
  db.prepare("SELECT * FROM playlists WHERE user_id = ? ORDER BY created").all(userId)
    .map((p) => ({ id: p.id, name: p.name, createdAt: p.created, songs: playlistSongs(p.id) }));

export function createPlaylist(userId, name) {
  const info = db.prepare("INSERT INTO playlists (user_id,name,created) VALUES (?,?,?)").run(userId, name, now());
  return getPlaylist(userId, Number(info.lastInsertRowid));
}

export function renamePlaylist(userId, id, name) {
  db.prepare("UPDATE playlists SET name = ? WHERE id = ? AND user_id = ?").run(name, id, userId);
  return getPlaylist(userId, id);
}

export function deletePlaylist(userId, id) {
  if (!getPlaylist(userId, id)) return false;
  db.prepare("DELETE FROM playlist_shares WHERE playlist_id = ?").run(id);
  db.prepare("DELETE FROM playlist_items WHERE playlist_id = ?").run(id);
  db.prepare("DELETE FROM playlists WHERE id = ?").run(id);
  return true;
}

export function addPlaylistSong(userId, id, song) {
  if (!getPlaylist(userId, id)) return null;
  const pos = db.prepare("SELECT COALESCE(MAX(position),0)+1 p FROM playlist_items WHERE playlist_id = ?").get(id).p;
  const info = db.prepare(
    "INSERT OR IGNORE INTO playlist_items (playlist_id,song_id,title,artist,artist_id,album,duration,image,created,position) VALUES (?,?,?,?,?,?,?,?,?,?)"
  ).run(id, ...songCols(song), now(), pos);
  return { added: info.changes > 0, playlist: getPlaylist(userId, id) };
}

// Reorder: songIds is the full desired order; unknown ids are ignored and
// unmentioned rows keep their relative order after the reordered block.
export function reorderPlaylist(userId, id, songIds) {
  if (!getPlaylist(userId, id)) return null;
  const setPos = db.prepare(
    "UPDATE playlist_items SET position = ? WHERE playlist_id = ? AND song_id = ?"
  );
  songIds.forEach((songId, i) => setPos.run(i + 1, id, String(songId)));
  return getPlaylist(userId, id);
}

export function importPlaylist(userId, name, songs) {
  const p = createPlaylist(userId, name);
  const ins = db.prepare(
    "INSERT OR IGNORE INTO playlist_items (playlist_id,song_id,title,artist,artist_id,album,duration,image,created,position) VALUES (?,?,?,?,?,?,?,?,?,?)"
  );
  songs.forEach((s, i) => ins.run(p.id, ...songCols(s), now(), i + 1));
  return getPlaylist(userId, p.id);
}

// ---- playlist sharing (instance members only — the route requires a session) ----
export function sharePlaylist(userId, id) {
  if (!getPlaylist(userId, id)) return null;
  const existing = db.prepare("SELECT token FROM playlist_shares WHERE playlist_id = ?").get(id);
  if (existing) return existing.token;
  const t = token();
  db.prepare("INSERT INTO playlist_shares (token,playlist_id,created) VALUES (?,?,?)").run(t, id, now());
  return t;
}

export function revokeShare(userId, id) {
  if (!getPlaylist(userId, id)) return false;
  db.prepare("DELETE FROM playlist_shares WHERE playlist_id = ?").run(id);
  return true;
}

export function getSharedPlaylist(t) {
  const share = db.prepare("SELECT * FROM playlist_shares WHERE token = ?").get(t);
  if (!share) return null;
  const p = db.prepare("SELECT * FROM playlists WHERE id = ?").get(share.playlist_id);
  if (!p) return null;
  const owner = getUserById(p.user_id);
  return { name: p.name, owner: owner?.name || "someone", songs: playlistSongs(p.id) };
}

export const getShareToken = (userId, id) =>
  getPlaylist(userId, id)
    ? (db.prepare("SELECT token FROM playlist_shares WHERE playlist_id = ?").get(id)?.token ?? null)
    : null;

// ---- saved albums ----
export const savedAlbums = (userId) =>
  db.prepare("SELECT * FROM saved_albums WHERE user_id = ? ORDER BY created DESC").all(userId)
    .map((r) => ({ token: r.token, title: r.title, artist: r.artist || "", year: r.year || "", image: r.image || "" }));

export function toggleSavedAlbum(userId, album) {
  const t = String(album.token);
  const has = db.prepare("SELECT 1 FROM saved_albums WHERE user_id=? AND token=?").get(userId, t);
  if (has) {
    db.prepare("DELETE FROM saved_albums WHERE user_id=? AND token=?").run(userId, t);
    return false;
  }
  db.prepare(
    "INSERT INTO saved_albums (user_id,token,title,artist,year,image,created) VALUES (?,?,?,?,?,?,?)"
  ).run(userId, t, String(album.title || "Unknown Album"), String(album.artist || ""), String(album.year || ""), String(album.image || ""), now());
  return true;
}

// ---- followed artists ----
export const followedArtists = (userId) =>
  db.prepare("SELECT * FROM followed_artists WHERE user_id = ? ORDER BY created DESC").all(userId)
    .map((r) => ({ id: r.artist_id, name: r.name, image: r.image || "" }));

export function toggleFollowedArtist(userId, artist) {
  const aid = String(artist.id);
  const has = db.prepare("SELECT 1 FROM followed_artists WHERE user_id=? AND artist_id=?").get(userId, aid);
  if (has) {
    db.prepare("DELETE FROM followed_artists WHERE user_id=? AND artist_id=?").run(userId, aid);
    return false;
  }
  db.prepare(
    "INSERT INTO followed_artists (user_id,artist_id,name,image,created) VALUES (?,?,?,?,?)"
  ).run(userId, aid, String(artist.name || "Unknown Artist"), String(artist.image || ""), now());
  return true;
}

export function removePlaylistSong(userId, id, songId) {
  if (!getPlaylist(userId, id)) return null;
  db.prepare("DELETE FROM playlist_items WHERE playlist_id = ? AND song_id = ?").run(id, String(songId));
  return getPlaylist(userId, id);
}

// ---- saves (listen later) ----
export const savedSongs = (userId) =>
  db.prepare("SELECT * FROM saves WHERE user_id = ? ORDER BY created DESC, rowid DESC")
    .all(userId).map(rowToSong);

export function toggleSave(userId, song) {
  const has = db.prepare("SELECT 1 FROM saves WHERE user_id=? AND song_id=?").get(userId, String(song.id));
  if (has) {
    db.prepare("DELETE FROM saves WHERE user_id=? AND song_id=?").run(userId, String(song.id));
    return false;
  }
  db.prepare(
    "INSERT INTO saves (user_id,song_id,title,artist,artist_id,album,duration,image,created) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run(userId, ...songCols(song), now());
  return true;
}

export const clearSaves = (userId) =>
  db.prepare("DELETE FROM saves WHERE user_id = ?").run(userId);

// ---- friends ----
// A friendship is mutual only when both directions exist; a single edge is a
// pending request. This keeps the whole feature in one small table.
const publicUser = (u) => ({ id: u.id, name: u.name });

export const searchMembers = (userId, q) =>
  db.prepare(
    "SELECT id, name FROM users WHERE active = 1 AND id != ? AND name LIKE ? ORDER BY name LIMIT 20"
  ).all(userId, `%${q}%`).map(publicUser);

const edgeExists = (a, b) =>
  !!db.prepare("SELECT 1 FROM friend_edges WHERE user_id=? AND friend_id=?").get(a, b);

export function requestFriend(userId, friendId) {
  const other = getUserById(friendId);
  if (!other || !other.active || Number(friendId) === Number(userId)) return null;
  db.prepare("INSERT OR IGNORE INTO friend_edges (user_id,friend_id,created) VALUES (?,?,?)")
    .run(userId, friendId, now());
  return { accepted: edgeExists(friendId, userId) };
}

export function removeFriend(userId, friendId) {
  // Drop both directions: declining a request and un-friending are the same act.
  db.prepare("DELETE FROM friend_edges WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)")
    .run(userId, friendId, friendId, userId);
  return true;
}

// What a friend last played, so the list has something to look at. Only the
// single most recent track is exposed — not their whole history.
const lastPlayed = (uid) => {
  const r = db.prepare("SELECT * FROM history WHERE user_id = ? ORDER BY played_at DESC LIMIT 1").get(uid);
  return r ? rowToSong(r) : null;
};

export function getFriends(userId) {
  const outgoing = db.prepare("SELECT friend_id FROM friend_edges WHERE user_id = ?").all(userId).map((r) => r.friend_id);
  const incoming = db.prepare("SELECT user_id FROM friend_edges WHERE friend_id = ?").all(userId).map((r) => r.user_id);
  const out = new Set(outgoing);
  const inc = new Set(incoming);

  const friends = outgoing.filter((id) => inc.has(id));
  const pendingOut = outgoing.filter((id) => !inc.has(id));
  const pendingIn = incoming.filter((id) => !out.has(id));
  const hydrate = (ids, withTrack) =>
    ids.map((id) => getUserById(id)).filter((u) => u && u.active)
      .map((u) => ({ ...publicUser(u), ...(withTrack ? { nowPlaying: lastPlayed(u.id) } : {}) }));

  return {
    friends: hydrate(friends, true),
    pendingOut: hydrate(pendingOut, false),
    pendingIn: hydrate(pendingIn, false),
  };
}

export const getLibrary = (userId) => ({
  playlists: listPlaylists(userId),
  liked: likedSongs(userId),
  history: getHistory(userId),
  albums: savedAlbums(userId),
  artists: followedArtists(userId),
  saves: savedSongs(userId),
  hidden: hiddenSongIds(userId),
});

export function closeDb() {
  try { db.close(); } catch {}
}

export default db;

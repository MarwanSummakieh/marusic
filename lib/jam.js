// Shared real-time listening. Everything lives in memory — sessions are
// ephemeral by design (a server restart ends the party, like Spotify's Jam).
// The server clock is the single source of truth for playback: state is
// { index, playing, pos, at } where `pos` is seconds into the track as of
// server-time `at`, so any client can derive the current position without a
// steady stream of progress reports.
//
// One engine, two products, differing only in *who renders the audio*:
//
//   "speaker"  — Jam. Everyone is in the same room, so exactly one device
//                (`speakerId`) makes sound and the rest are synchronized
//                remote controls. Two devices playing in one room is noise.
//   "together" — Listen together. Everyone is somewhere else, so *every*
//                device plays its own stream, aligned to the server clock.
//                `speakerId` is meaningless and stays empty.
//
// The mode is fixed when the session is created: the two are separate
// features, not a toggle, because "which room are we in" isn't something
// playback should change under you mid-song.
//
// This module knows nothing about Express or the network. Routes feed it
// actions; interested connections register a callback with subscribe() and
// receive (event, data) pairs to forward over SSE.
import crypto from "node:crypto";

export const JAM_QUEUE_MAX = 500;

export const JAM_MODES = ["speaker", "together"];
export const normalizeMode = (m) =>
  JAM_MODES.includes(String(m || "")) ? String(m) : "speaker";
export const playsEverywhere = (jam) => jam.mode === "together";

// join codes: short enough to read out loud, no ambiguous 0/O/1/I
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

const jams = new Map(); // code -> jam
const memberIndex = new Map(); // userId -> code
let subSeq = 0;

const now = () => Date.now();

function makeCode() {
  for (;;) {
    let code = "";
    for (const b of crypto.randomBytes(CODE_LENGTH))
      code += CODE_ALPHABET[b % CODE_ALPHABET.length];
    if (!jams.has(code)) return code;
  }
}

// same snapshot shape the library tables use — never trust client blobs
export function cleanSong(s) {
  if (!s || !s.id || !s.title) return null;
  return {
    id: String(s.id),
    title: String(s.title),
    artist: String(s.artist || "Unknown Artist"),
    artistId: String(s.artistId || ""),
    album: String(s.album || ""),
    duration: Number(s.duration) || 0,
    image: String(s.image || ""),
  };
}

export function positionNow(jam, at = now()) {
  if (!jam.playing) return jam.pos;
  return jam.pos + (at - jam.at) / 1000;
}

// ---- fan-out ----
function broadcast(jam, event, data) {
  for (const sub of jam.subs.values()) sub.fn(event, data);
}
function notifyUser(jam, userId, event, data) {
  for (const sub of jam.subs.values()) if (sub.userId === userId) sub.fn(event, data);
}
function closeUserSubs(jam, userId) {
  for (const [id, sub] of jam.subs) {
    if (sub.userId !== userId) continue;
    jam.subs.delete(id);
    try { sub.close?.(); } catch {}
  }
}

const isConnected = (jam, userId) =>
  [...jam.subs.values()].some((s) => s.userId === userId);

// is the designated speaker device (the one that makes sound) connected?
// Only meaningful in "speaker" mode — in "together" mode every connected
// device is its own speaker, so there is nothing to be offline.
export const speakerOnline = (jam) =>
  !!jam.speakerId &&
  [...jam.subs.values()].some((s) => s.deviceId && s.deviceId === jam.speakerId);

function membersPayload(jam, note = null) {
  return {
    hostId: jam.hostId,
    mode: jam.mode,
    speakerId: jam.speakerId,
    speakerOnline: speakerOnline(jam),
    members: [...jam.members.values()]
      .sort((a, b) => a.joined - b.joined)
      .map((m) => ({
        id: m.id,
        name: m.name,
        host: m.id === jam.hostId,
        connected: isConnected(jam, m.id),
      })),
    note,
  };
}

function syncPayload(jam) {
  return {
    index: jam.index,
    playing: jam.playing,
    pos: jam.pos,
    at: jam.at,
    now: now(),
  };
}

function queuePayload(jam, extra = {}) {
  return { queue: jam.queue, index: jam.index, ...extra };
}

const touch = (jam) => { jam.lastActive = now(); };

function broadcastSync(jam) { touch(jam); broadcast(jam, "sync", syncPayload(jam)); }
function broadcastMembers(jam, note) { broadcast(jam, "members", membersPayload(jam, note)); }

// ---- lifecycle ----
// In "speaker" mode speakerId names the one device whose <audio> actually
// plays — everyone else is a synchronized remote control — and it starts as
// the creating device. In "together" mode there is no such device: every
// member plays, so speakerId stays empty for the life of the session.
export function createJam(user, seed = {}, speakerId = "", mode = "speaker") {
  leaveJam(user.id); // one session per user
  const queue = (Array.isArray(seed.queue) ? seed.queue : [])
    .map(cleanSong).filter(Boolean).slice(0, JAM_QUEUE_MAX);
  const index = queue.length
    ? Math.min(Math.max(0, Math.trunc(Number(seed.index) || 0)), queue.length - 1)
    : -1;
  const kind = normalizeMode(mode);
  const jam = {
    code: makeCode(),
    hostId: user.id,
    mode: kind,
    speakerId: kind === "together" ? "" : String(speakerId || "").slice(0, 64),
    created: now(),
    lastActive: now(),
    members: new Map([[user.id, { id: user.id, name: user.name, joined: now() }]]),
    settings: { guestsControl: true, autoplay: true },
    queue,
    index,
    playing: index >= 0 && !!seed.playing,
    pos: index >= 0 ? Math.max(0, Number(seed.pos) || 0) : 0,
    at: now(),
    subs: new Map(), // subId -> { userId, fn, close }
    extending: false, // autoplay-refill in flight (guards double fetch)
  };
  jams.set(jam.code, jam);
  memberIndex.set(user.id, jam.code);
  return jam;
}

export const getJam = (code) => jams.get(String(code || "").trim().toUpperCase()) || null;

export function jamForUser(userId) {
  const code = memberIndex.get(userId);
  const jam = code ? jams.get(code) : null;
  if (code && !jam) memberIndex.delete(userId); // jam died (swept/ended)
  return jam || null;
}

// what a join screen needs to show before committing
export function peekJam(code) {
  const jam = getJam(code);
  if (!jam) return null;
  const host = jam.members.get(jam.hostId);
  return {
    code: jam.code,
    mode: jam.mode, // the join screen frames itself around this
    host: host?.name || "someone",
    members: jam.members.size,
    current: jam.queue[jam.index] || null,
    playing: jam.playing,
  };
}

export function joinJam(user, code) {
  const jam = getJam(code);
  if (!jam) return null;
  if (jam.members.has(user.id)) return jam; // rejoining is a no-op
  leaveJam(user.id);
  jam.members.set(user.id, { id: user.id, name: user.name, joined: now() });
  memberIndex.set(user.id, jam.code);
  touch(jam);
  broadcastMembers(jam, { type: "join", name: user.name });
  return jam;
}

export function leaveJam(userId) {
  const jam = jamForUser(userId);
  if (!jam) return { left: false, ended: false };
  const name = jam.members.get(userId)?.name || "";
  jam.members.delete(userId);
  memberIndex.delete(userId);
  notifyUser(jam, userId, "left", {}); // other tabs of the same user exit too
  closeUserSubs(jam, userId);
  if (!jam.members.size) {
    jams.delete(jam.code);
    return { left: true, ended: true };
  }
  // the host walked out — hand the jam to the longest-standing member
  let note = { type: "leave", name };
  if (jam.hostId === userId) {
    const heir = [...jam.members.values()].sort((a, b) => a.joined - b.joined)[0];
    jam.hostId = heir.id;
    note = { type: "host", name: heir.name, left: name };
  }
  touch(jam);
  broadcastMembers(jam, note);
  return { left: true, ended: false };
}

export function endJam(jam) {
  broadcast(jam, "jam-ended", {});
  for (const sub of jam.subs.values()) { try { sub.close?.(); } catch {} }
  jam.subs.clear();
  for (const id of jam.members.keys()) memberIndex.delete(id);
  jam.members.clear();
  jams.delete(jam.code);
}

export function kickMember(jam, targetId) {
  if (!jam.members.has(targetId) || targetId === jam.hostId) return false;
  const name = jam.members.get(targetId).name;
  jam.members.delete(targetId);
  memberIndex.delete(targetId);
  notifyUser(jam, targetId, "kicked", {});
  closeUserSubs(jam, targetId);
  touch(jam);
  broadcastMembers(jam, { type: "kick", name });
  return true;
}

// jams with nobody connected for a while get garbage-collected (members may
// still reload back in before the sweep fires — membership survives an F5)
export function sweepJams(maxIdleMs, at = now()) {
  let n = 0;
  for (const jam of [...jams.values()]) {
    if (jam.subs.size || at - jam.lastActive <= maxIdleMs) continue;
    for (const id of jam.members.keys()) memberIndex.delete(id);
    jams.delete(jam.code);
    n++;
  }
  return n;
}

// ---- queue ----
export function addSongs(jam, rawSongs, byName = "") {
  const songs = rawSongs.map(cleanSong).filter(Boolean)
    .slice(0, Math.max(0, JAM_QUEUE_MAX - jam.queue.length));
  if (!songs.length) return 0;
  const wasEmpty = !jam.queue.length;
  jam.queue.push(...songs);
  if (wasEmpty) {
    // first song in an empty jam starts the music
    jam.index = 0;
    jam.pos = 0;
    jam.playing = true;
    jam.at = now();
  }
  touch(jam);
  broadcast(jam, "queue", queuePayload(jam, { added: songs.length, by: byName }));
  if (wasEmpty) broadcastSync(jam);
  return songs.length;
}

// autoplay refill: append related songs, skipping anything already queued
export function extendQueue(jam, rawSongs) {
  const have = new Set(jam.queue.map((s) => s.id));
  const fresh = rawSongs.map(cleanSong).filter((s) => s && !have.has(s.id))
    .slice(0, Math.max(0, JAM_QUEUE_MAX - jam.queue.length));
  if (!fresh.length) return 0;
  jam.queue.push(...fresh);
  touch(jam);
  broadcast(jam, "queue", queuePayload(jam, { added: fresh.length, by: "Autoplay" }));
  return fresh.length;
}

export function removeSongAt(jam, i) {
  if (!Number.isInteger(i) || i < 0 || i >= jam.queue.length || i === jam.index) return false;
  jam.queue.splice(i, 1);
  if (i < jam.index) jam.index--;
  touch(jam);
  broadcast(jam, "queue", queuePayload(jam));
  return true;
}

// ---- transport ----
function moveTo(jam, i, playing = jam.playing) {
  jam.index = i;
  jam.pos = 0;
  jam.playing = playing;
  jam.at = now();
  broadcastSync(jam);
}

export function playAt(jam, i) {
  if (!jam.queue[i]) return false;
  moveTo(jam, i, true);
  return true;
}

export function resumeJam(jam) {
  if (jam.index < 0) return false;
  if (!jam.playing) {
    jam.playing = true;
    jam.at = now();
  }
  broadcastSync(jam);
  return true;
}

export function pauseJam(jam) {
  if (jam.playing) {
    jam.pos = positionNow(jam);
    jam.playing = false;
    jam.at = now();
  }
  broadcastSync(jam);
  return true;
}

export function seekTo(jam, pos) {
  if (jam.index < 0) return false;
  const dur = jam.queue[jam.index]?.duration || 0;
  jam.pos = Math.max(0, Math.min(Number(pos) || 0, dur || Infinity));
  jam.at = now();
  broadcastSync(jam);
  return true;
}

export function nextTrack(jam) {
  if (jam.index + 1 >= jam.queue.length) return false;
  moveTo(jam, jam.index + 1);
  return true;
}

export function prevTrack(jam) {
  if (jam.index < 0) return false;
  // like the local player: early in the track goes back, otherwise restart
  if (positionNow(jam) > 3 || jam.index === 0) {
    jam.pos = 0;
    jam.at = now();
    broadcastSync(jam);
  } else {
    moveTo(jam, jam.index - 1);
  }
  return true;
}

// the host chose a different device to make the sound (e.g. moved the party
// from the laptop to the desktop) — broadcast so the old one goes quiet.
// Meaningless in "together" mode, where every device is already playing.
export function setSpeaker(jam, deviceId) {
  if (playsEverywhere(jam)) return false;
  jam.speakerId = String(deviceId || "").slice(0, 64);
  touch(jam);
  broadcastMembers(jam);
  return true;
}

// A client's audio finished the current track. In "speaker" mode only the
// speaker device may report it (remotes have no audio to finish). In
// "together" mode everyone's audio ends at roughly the same moment, so the
// first report wins and the index guard makes the stragglers no-ops — the
// few hundred ms of tail the slowest clients lose is inaudible, and their
// drift correction pulls them onto the new track immediately.
export function markEnded(jam, i, deviceId = "") {
  if (jam.speakerId && deviceId !== jam.speakerId) return false;
  if (!jam.playing || i !== jam.index) return false;
  if (jam.index + 1 < jam.queue.length) {
    moveTo(jam, jam.index + 1, true);
  } else {
    jam.playing = false;
    jam.pos = 0;
    jam.at = now();
    broadcastSync(jam);
  }
  return true;
}

// ---- settings & permissions ----
export function setJamSettings(jam, patch = {}) {
  if (typeof patch.guestsControl === "boolean") jam.settings.guestsControl = patch.guestsControl;
  if (typeof patch.autoplay === "boolean") jam.settings.autoplay = patch.autoplay;
  touch(jam);
  broadcast(jam, "settings", { settings: jam.settings });
  return jam.settings;
}

export const canControl = (jam, userId) =>
  userId === jam.hostId || jam.settings.guestsControl;

// ---- wire formats ----
export function snapshot(jam, userId) {
  return {
    code: jam.code,
    mode: jam.mode,
    hostId: jam.hostId,
    speakerId: jam.speakerId,
    speakerOnline: speakerOnline(jam),
    you: {
      id: userId,
      isHost: userId === jam.hostId,
      canControl: canControl(jam, userId),
    },
    members: membersPayload(jam).members,
    settings: jam.settings,
    queue: jam.queue,
    index: jam.index,
    playing: jam.playing,
    pos: jam.pos,
    at: jam.at,
    now: now(),
  };
}

// `fn(event, data)` forwards to the transport (SSE); `close()` lets the store
// hang up the underlying connection on kick/end. Presence flows from subs;
// `deviceId` identifies which connection is the speaker device.
export function subscribe(jam, userId, deviceId, fn, close) {
  const id = ++subSeq;
  jam.subs.set(id, { userId, deviceId: String(deviceId || ""), fn, close });
  touch(jam);
  broadcastMembers(jam);
  return () => {
    if (!jam.subs.delete(id)) return;
    touch(jam);
    if (jams.get(jam.code) === jam) broadcastMembers(jam);
  };
}

// test hook
export function resetJams() {
  jams.clear();
  memberIndex.clear();
}

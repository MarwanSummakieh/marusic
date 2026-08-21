// Shared real-time listening. Everything lives in memory — sessions are
// ephemeral by design (a server restart ends the party, like Spotify's Jam).
// The server clock is the single source of truth for playback: state is
// { index, playing, pos, at } where `pos` is seconds into the track as of
// server-time `at`, so any client can derive the current position without a
// steady stream of progress reports.
//
// Because we know when a track started and how long it is, we also know
// exactly when it ends — so the server *schedules* the move to the next song
// instead of waiting for whichever client's <audio> happens to fire `ended`
// first. That race used to decide the boundary, which meant it landed a few
// hundred milliseconds apart for everyone and a short or misreported stream
// could drag the whole session off the beat. Now every member gets the same
// `ends` timestamp up front and the same sync at the same instant: songs
// start together, and nothing has to be corrected in between.
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

// ---- the track boundary ----
// Sync is a promise about one moment: everyone starts the same song at the
// same instant. Between boundaries there is nothing to arrange, so all the
// arranging happens here.

// ms of head start the autoplay refill gets, so the next song is in the queue
// before the current one runs out rather than after
const REFILL_LEAD_MS = 25_000;
// an `ended` report this close to the scheduled boundary is telling the truth
const BOUNDARY_GRACE_MS = 1500;
// a timer that fires this late (a suspended process) can't claim the boundary
// as the moment the next track began — start it from now instead
const BOUNDARY_STALE_MS = 5000;

// Topping the queue up needs recommendations, which need the network — the
// one thing this module doesn't do. The server hands us a callback instead.
let refillHook = null;
export const onNeedsRefill = (fn) => { refillHook = fn; };

// server-time ms at which the current track runs out, or 0 when we can't know
// (nothing playing, or a track whose duration metadata is missing — those
// fall back to clients reporting `ended`)
export function trackEndsAt(jam) {
  if (!jam.playing || jam.index < 0) return 0;
  const dur = jam.queue[jam.index]?.duration || 0;
  if (!dur) return 0;
  return jam.at + (dur - jam.pos) * 1000;
}

function clearTimers(jam) {
  clearTimeout(jam.boundary);
  clearTimeout(jam.refillTimer);
  jam.boundary = null;
  jam.refillTimer = null;
}

// Re-armed by every transport change, since every one of them moves the
// boundary: a seek, a pause, a new track, a queue edit that changes what's
// playing next.
function scheduleBoundary(jam) {
  clearTimers(jam);
  const ends = trackEndsAt(jam);
  if (!ends) return;
  jam.boundary = setTimeout(() => {
    jam.boundary = null;
    crossBoundary(jam, ends);
  }, Math.max(0, ends - now()));
  jam.boundary.unref?.();
  if (refillHook && jam.index >= jam.queue.length - 1) {
    jam.refillTimer = setTimeout(() => {
      jam.refillTimer = null;
      try { refillHook(jam); } catch { /* best-effort — the boundary still fires */ }
    }, Math.max(0, ends - now() - REFILL_LEAD_MS));
    jam.refillTimer.unref?.();
  }
}

// the current track just ran out. `ends` is the boundary itself, and becomes
// the new track's `at` so the timeline stays exact even when the timer fires
// a few ms late — clients that hear about it afterwards simply start that far
// into the song, which is the truth.
function crossBoundary(jam, ends) {
  if (jams.get(jam.code) !== jam || !jam.playing) return;
  // only adopt the ideal boundary when we're actually just past it — a timer
  // that overslept, or an `ended` that beat it, must not bend the timeline
  const late = now() - ends;
  const at = ends && late >= 0 && late <= BOUNDARY_STALE_MS ? ends : now();
  if (jam.index + 1 < jam.queue.length) return moveTo(jam, jam.index + 1, true, at);
  // last track, but more music is on its way — extendQueue picks this up
  if (jam.extending) return;
  jam.playing = false;
  jam.pos = 0;
  jam.at = now();
  jam.ended = true; // adding a song from here starts the music again
  clearTimers(jam);
  broadcastSync(jam);
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
    ends: trackEndsAt(jam), // when the next boundary lands, for everyone alike
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
  // `auto` survives the clean-up so a jam seeded from a local queue keeps its
  // "chosen vs. suggested" boundary (see addSongs)
  const queue = (Array.isArray(seed.queue) ? seed.queue : [])
    .map((s) => { const c = cleanSong(s); return c && s.auto ? { ...c, auto: true } : c; })
    .filter(Boolean).slice(0, JAM_QUEUE_MAX);
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
    ended: false, // ran out of queue — the next song added starts the music
    boundary: null, // timer: move to the next track when this one runs out
    refillTimer: null, // timer: ask for more music before that happens
  };
  jams.set(jam.code, jam);
  memberIndex.set(user.id, jam.code);
  scheduleBoundary(jam);
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
    clearTimers(jam);
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
  clearTimers(jam);
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
    clearTimers(jam);
    jams.delete(jam.code);
    n++;
  }
  return n;
}

// ---- queue ----
// Songs people add go ahead of anything autoplay filled in: the queue is
// "what we chose, then what the machine suggested", so a pick made while a
// suggested song plays lands right after it, not behind thirty more guesses.
// Autoplay entries carry `auto: true`; the insertion point is the first one
// after the current track.
function userQueueEnd(jam) {
  const from = Math.max(0, jam.index + 1);
  for (let i = from; i < jam.queue.length; i++) if (jam.queue[i].auto) return i;
  return jam.queue.length;
}

export function addSongs(jam, rawSongs, byName = "") {
  const songs = rawSongs.map(cleanSong).filter(Boolean)
    .slice(0, Math.max(0, JAM_QUEUE_MAX - jam.queue.length));
  if (!songs.length) return 0;
  const wasEmpty = !jam.queue.length;
  const at = userQueueEnd(jam);
  jam.queue.splice(at, 0, ...songs);
  // A song added to a session that has nothing to play starts the music: an
  // empty jam begins, and one that ran out of queue picks up again instead of
  // sitting paused at 0:00 of the song that already finished.
  const starts = wasEmpty || jam.ended;
  if (starts) {
    jam.index = wasEmpty ? 0 : at;
    jam.pos = 0;
    jam.playing = true;
    jam.at = now();
    jam.ended = false;
  }
  scheduleBoundary(jam);
  touch(jam);
  broadcast(jam, "queue", queuePayload(jam, { added: songs.length, by: byName }));
  if (starts) broadcastSync(jam);
  return songs.length;
}

// autoplay refill: append related songs, skipping anything already queued
export function extendQueue(jam, rawSongs) {
  const have = new Set(jam.queue.map((s) => s.id));
  const fresh = rawSongs.map(cleanSong).filter((s) => s && !have.has(s.id))
    .slice(0, Math.max(0, JAM_QUEUE_MAX - jam.queue.length))
    .map((s) => ({ ...s, auto: true }));
  if (!fresh.length) return 0;
  const first = jam.queue.length; // index of the first fresh song
  jam.queue.push(...fresh);
  touch(jam);
  broadcast(jam, "queue", queuePayload(jam, { added: fresh.length, by: "Autoplay" }));
  // The refill usually lands while the last track is still playing, and just
  // gives the scheduled boundary somewhere to go. When it lands *after* the
  // music stopped, it has to start it again itself.
  if (jam.ended) moveTo(jam, first, true);
  else scheduleBoundary(jam);
  return fresh.length;
}

export function removeSongAt(jam, i) {
  if (!Number.isInteger(i) || i < 0 || i >= jam.queue.length || i === jam.index) return false;
  jam.queue.splice(i, 1);
  if (i < jam.index) jam.index--;
  scheduleBoundary(jam); // what follows the current track just changed
  touch(jam);
  broadcast(jam, "queue", queuePayload(jam));
  return true;
}

// ---- transport ----
// Every one of these moves the boundary, so every one of them re-arms it.
function moveTo(jam, i, playing = jam.playing, at = now()) {
  jam.index = i;
  jam.pos = 0;
  jam.playing = playing;
  jam.at = at;
  jam.ended = false;
  scheduleBoundary(jam);
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
    jam.ended = false;
  }
  scheduleBoundary(jam);
  broadcastSync(jam);
  return true;
}

export function pauseJam(jam) {
  if (jam.playing) {
    jam.pos = positionNow(jam);
    jam.playing = false;
    jam.at = now();
  }
  clearTimers(jam);
  broadcastSync(jam);
  return true;
}

export function seekTo(jam, pos) {
  if (jam.index < 0) return false;
  const dur = jam.queue[jam.index]?.duration || 0;
  jam.pos = Math.max(0, Math.min(Number(pos) || 0, dur || Infinity));
  jam.at = now();
  scheduleBoundary(jam);
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
    scheduleBoundary(jam);
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
// speaker device may report it (remotes have no audio to finish).
//
// This is now a fallback, not the mechanism: when the track's duration is
// known the scheduled boundary owns the moment, and a report that lands well
// before it means *that client's* stream was short — honouring it would yank
// everyone else out of a song they're still listening to. So an early report
// is ignored and the timer decides. Tracks with no duration metadata have no
// boundary to schedule, and there the first report still wins.
export function markEnded(jam, i, deviceId = "") {
  if (jam.speakerId && deviceId !== jam.speakerId) return false;
  if (!jam.playing || i !== jam.index) return false;
  const ends = trackEndsAt(jam);
  if (ends && now() < ends - BOUNDARY_GRACE_MS) return false;
  // more songs are on their way — don't declare the end; the refill advances
  if (jam.index + 1 >= jam.queue.length && jam.extending) return false;
  crossBoundary(jam, ends || now());
  return true;
}

// ---- settings & permissions ----
export function setJamSettings(jam, patch = {}) {
  if (typeof patch.guestsControl === "boolean") jam.settings.guestsControl = patch.guestsControl;
  if (typeof patch.autoplay === "boolean") jam.settings.autoplay = patch.autoplay;
  scheduleBoundary(jam); // autoplay just came on: arm the refill for this track
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
    ends: trackEndsAt(jam),
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
  for (const jam of jams.values()) clearTimers(jam);
  jams.clear();
  memberIndex.clear();
  refillHook = null;
}

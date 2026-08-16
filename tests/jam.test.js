// Tests for the in-memory jam store (lib/jam.js) — pure logic, no network,
// no Express. Covers lifecycle, queue rules, transport math, permissions,
// and the subscribe/broadcast fan-out the SSE layer rides on.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as jams from "../lib/jam.js";

let nextId = 1;
const user = (name) => ({ id: nextId++, name });
const song = (id, extra = {}) => ({
  id,
  title: `Song ${id}`,
  artist: "Test Artist",
  album: "Test Album",
  duration: 200,
  image: "",
  ...extra,
});

// capture every event a subscriber sees
function listen(jam, u, deviceId = "") {
  const events = [];
  const unsub = jams.subscribe(jam, u.id, deviceId, (event, data) => events.push({ event, data }));
  return { events, unsub, last: (type) => [...events].reverse().find((e) => e.event === type) };
}

beforeEach(() => jams.resetJams());

test("create: seeds queue/position, host is a member, code is readable", () => {
  const host = user("Host");
  const jam = jams.createJam(host, {
    queue: [song("a"), song("b"), song("c")],
    index: 1,
    pos: 42,
    playing: true,
  });
  assert.match(jam.code, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(jam.hostId, host.id);
  assert.equal(jam.index, 1);
  assert.equal(jam.playing, true);
  assert.ok(jams.positionNow(jam, jam.at + 5000) > 46.9);
  const snap = jams.snapshot(jam, host.id);
  assert.equal(snap.you.isHost, true);
  assert.equal(snap.members.length, 1);
});

test("create: garbage seeds are sanitized", () => {
  const jam = jams.createJam(user("H"), {
    queue: [song("ok"), { title: "no id" }, null, { id: "x" }],
    index: 99,
    pos: -5,
  });
  assert.deepEqual(jam.queue.map((s) => s.id), ["ok"]);
  assert.equal(jam.index, 0); // clamped
  assert.equal(jam.pos, 0);
  assert.equal(jam.playing, false);
});

test("join: case-insensitive code, bad code null, one jam per user", () => {
  const host = user("Host");
  const guest = user("Guest");
  const jam = jams.createJam(host, {});
  assert.equal(jams.joinJam(guest, jam.code.toLowerCase()), jam);
  assert.equal(jams.joinJam(user("X"), "NOPE99"), null);

  // joining another jam leaves the first
  const jam2 = jams.createJam(user("Other"), {});
  jams.joinJam(guest, jam2.code);
  assert.equal(jam.members.has(guest.id), false);
  assert.equal(jams.jamForUser(guest.id), jam2);
});

test("peek: shows host, member count, current track", () => {
  const host = user("Marwan");
  const jam = jams.createJam(host, { queue: [song("s1")], index: 0, playing: true });
  jams.joinJam(user("G"), jam.code);
  const p = jams.peekJam(jam.code);
  assert.equal(p.host, "Marwan");
  assert.equal(p.members, 2);
  assert.equal(p.current.id, "s1");
  assert.equal(jams.peekJam("XXXXXX"), null);
});

test("queue: add caps at max, first song in an empty jam auto-plays", () => {
  const host = user("H");
  const jam = jams.createJam(host, {});
  assert.equal(jam.index, -1);
  const l = listen(jam, host);
  assert.equal(jams.addSongs(jam, [song("a")], "H"), 1);
  assert.equal(jam.index, 0);
  assert.equal(jam.playing, true);
  assert.ok(l.last("queue"));
  assert.ok(l.last("sync"));

  const many = Array.from({ length: 600 }, (_, i) => song(`m${i}`));
  assert.equal(jams.addSongs(jam, many), jams.JAM_QUEUE_MAX - 1);
  assert.equal(jam.queue.length, jams.JAM_QUEUE_MAX);
  assert.equal(jams.addSongs(jam, [song("overflow")]), 0);
});

test("queue: extendQueue dedupes, removeSongAt guards current and fixes index", () => {
  const jam = jams.createJam(user("H"), { queue: [song("a"), song("b"), song("c")], index: 1 });
  assert.equal(jams.extendQueue(jam, [song("a"), song("d")]), 1);
  assert.deepEqual(jam.queue.map((s) => s.id), ["a", "b", "c", "d"]);

  assert.equal(jams.removeSongAt(jam, 1), false); // current track
  assert.equal(jams.removeSongAt(jam, 99), false);
  assert.equal(jams.removeSongAt(jam, 0), true); // before current → index shifts
  assert.equal(jam.index, 0);
  assert.equal(jam.queue[jam.index].id, "b");
  assert.equal(jams.removeSongAt(jam, 1), true); // after current
  assert.deepEqual(jam.queue.map((s) => s.id), ["b", "d"]);
});

test("transport: play/pause/seek/next/prev and server-clock position", () => {
  const jam = jams.createJam(user("H"), { queue: [song("a"), song("b")], index: 0 });
  jams.resumeJam(jam);
  assert.equal(jam.playing, true);
  assert.ok(jams.positionNow(jam, jam.at + 10_000) >= 10);

  jams.pauseJam(jam);
  assert.equal(jam.playing, false);
  const frozen = jam.pos;
  assert.equal(jams.positionNow(jam, jam.at + 60_000), frozen);

  jams.seekTo(jam, 150);
  assert.equal(jam.pos, 150);
  jams.seekTo(jam, 9999);
  assert.equal(jam.pos, 200); // clamped to duration

  assert.equal(jams.nextTrack(jam), true);
  assert.equal(jam.index, 1);
  assert.equal(jam.pos, 0);
  assert.equal(jam.playing, false); // skip preserves paused state
  assert.equal(jams.nextTrack(jam), false); // end of queue

  // prev early in the track goes back; later it restarts
  assert.equal(jams.prevTrack(jam), true);
  assert.equal(jam.index, 0);
  jams.seekTo(jam, 50);
  jams.nextTrack(jam);
  jams.seekTo(jam, 50);
  jams.prevTrack(jam);
  assert.equal(jam.index, 1);
  assert.equal(jam.pos, 0);
});

test("markEnded: first matching report advances, stragglers and paused no-op", () => {
  const jam = jams.createJam(user("H"), { queue: [song("a"), song("b")], index: 0, playing: true });
  assert.equal(jams.markEnded(jam, 1), false); // wrong index
  assert.equal(jams.markEnded(jam, 0), true);
  assert.equal(jam.index, 1);
  assert.equal(jam.playing, true);
  assert.equal(jams.markEnded(jam, 0), false); // straggler

  assert.equal(jams.markEnded(jam, 1), true); // last track → stop at start
  assert.equal(jam.index, 1);
  assert.equal(jam.playing, false);
  assert.equal(jam.pos, 0);
  assert.equal(jams.markEnded(jam, 1), false); // paused → ignore
});

test("permissions: guestsControl gates guests, never the host", () => {
  const host = user("H");
  const guest = user("G");
  const jam = jams.createJam(host, {});
  jams.joinJam(guest, jam.code);
  assert.equal(jams.canControl(jam, guest.id), true);
  jams.setJamSettings(jam, { guestsControl: false });
  assert.equal(jams.canControl(jam, guest.id), false);
  assert.equal(jams.canControl(jam, host.id), true);
  assert.equal(jams.snapshot(jam, guest.id).you.canControl, false);
  jams.setJamSettings(jam, { guestsControl: "yes" }); // non-boolean ignored
  assert.equal(jam.settings.guestsControl, false);
});

test("subscribe: presence + broadcasts reach every listener", () => {
  const host = user("H");
  const guest = user("G");
  const jam = jams.createJam(host, { queue: [song("a")], index: 0 });
  jams.joinJam(guest, jam.code);

  const hostEars = listen(jam, host);
  const guestEars = listen(jam, guest);
  assert.equal(
    guestEars.last("members").data.members.find((m) => m.id === guest.id).connected,
    true
  );

  jams.resumeJam(jam);
  assert.ok(hostEars.last("sync").data.playing);
  assert.ok(guestEars.last("sync").data.playing);

  guestEars.unsub();
  const after = hostEars.last("members").data.members.find((m) => m.id === guest.id);
  assert.equal(after.connected, false);
  assert.equal(after.id, guest.id); // still a member, just offline
});

test("leave: host hand-off, empty jam dissolves, other tabs told to exit", () => {
  const host = user("H");
  const g1 = user("G1");
  const jam = jams.createJam(host, {});
  jams.joinJam(g1, jam.code);

  const g1Ears = listen(jam, g1);
  jams.leaveJam(host.id);
  assert.equal(jam.hostId, g1.id); // longest-standing member inherits
  assert.equal(g1Ears.last("members").data.note.type, "host");

  let closed = false;
  jams.subscribe(jam, g1.id, "", () => {}, () => { closed = true; });
  const res = jams.leaveJam(g1.id);
  assert.deepEqual(res, { left: true, ended: true });
  assert.equal(closed, true); // the leaver's own connections hang up
  assert.equal(jams.getJam(jam.code), null);
});

test("end + kick: connections closed, membership cleared", () => {
  const host = user("H");
  const guest = user("G");
  const jam = jams.createJam(host, {});
  jams.joinJam(guest, jam.code);

  let guestClosed = false;
  const guestEars = [];
  jams.subscribe(jam, guest.id, "", (e) => guestEars.push(e), () => { guestClosed = true; });

  assert.equal(jams.kickMember(jam, host.id), false); // can't kick the host
  assert.equal(jams.kickMember(jam, guest.id), true);
  assert.ok(guestEars.includes("kicked"));
  assert.equal(guestClosed, true);
  assert.equal(jams.jamForUser(guest.id), null);

  let hostClosed = false;
  jams.subscribe(jam, host.id, "", () => {}, () => { hostClosed = true; });
  jams.endJam(jam);
  assert.equal(hostClosed, true);
  assert.equal(jams.getJam(jam.code), null);
  assert.equal(jams.jamForUser(host.id), null);
});

test("speaker: only the speaker device advances, transfer works, presence tracked", () => {
  const host = user("H");
  const guest = user("G");
  const jam = jams.createJam(
    host,
    { queue: [song("a"), song("b")], index: 0, playing: true },
    "device-A"
  );
  jams.joinJam(guest, jam.code);
  assert.equal(jam.speakerId, "device-A");

  // a remote (or a spoofed report) can't advance the jam — only the speaker
  assert.equal(jams.markEnded(jam, 0, "device-B"), false);
  assert.equal(jams.markEnded(jam, 0, ""), false);
  assert.equal(jams.markEnded(jam, 0, "device-A"), true);
  assert.equal(jam.index, 1);

  // presence: online only while a sub carries the speaker's device id
  assert.equal(jams.speakerOnline(jam), false);
  const hostEars = listen(jam, host, "device-A");
  assert.equal(jams.speakerOnline(jam), true);
  assert.equal(hostEars.last("members").data.speakerId, "device-A");
  assert.equal(hostEars.last("members").data.speakerOnline, true);
  assert.equal(jams.snapshot(jam, guest.id).speakerOnline, true);

  // host moves the sound to another device — broadcast + presence update
  jams.setSpeaker(jam, "device-B");
  assert.equal(hostEars.last("members").data.speakerId, "device-B");
  assert.equal(hostEars.last("members").data.speakerOnline, false);
  const remote = listen(jam, guest, "device-B");
  assert.equal(jams.speakerOnline(jam), true);
  remote.unsub();

  // legacy jams without a speaker keep democratic advancement
  const open = jams.createJam(user("O"), { queue: [song("x"), song("y")], index: 0, playing: true });
  assert.equal(open.speakerId, "");
  assert.equal(jams.markEnded(open, 0), true);
});

test("sweep: idle unconnected jams die, connected or fresh ones survive", () => {
  const a = jams.createJam(user("A"), {});
  const b = jams.createJam(user("B"), {});
  const c = jams.createJam(user("C"), {});
  jams.subscribe(b, b.hostId, "", () => {});
  a.lastActive -= 20 * 60 * 1000;
  b.lastActive -= 20 * 60 * 1000;
  assert.equal(jams.sweepJams(10 * 60 * 1000), 1); // only a: b connected, c fresh
  assert.equal(jams.getJam(a.code), null);
  assert.equal(jams.jamForUser(a.hostId), null); // stale pointer cleaned on lookup
  assert.ok(jams.getJam(b.code));
  assert.ok(jams.getJam(c.code));
});

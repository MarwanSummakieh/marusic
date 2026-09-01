// Tests for the SQLite layer (lib/db.js) — the only module with no network
// dependency, and the one guarding user data. Runs against a throwaway file.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DB_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "marusic-test-")),
  "test.sqlite"
);
const db = await import("../lib/db.js");

const song = (id, extra = {}) => ({
  id,
  title: `Song ${id}`,
  artist: "Test Artist",
  album: "Test Album",
  duration: 200,
  image: "",
  ...extra,
});

test("users: create, lookup, password verify", () => {
  const u = db.createUser({ email: "Alice@Example.com", name: "Alice", password: "hunter22" });
  assert.ok(u.id);
  assert.equal(u.email, "alice@example.com"); // emails normalize to lowercase
  assert.equal(db.getUserByEmail("ALICE@example.COM").id, u.id);
  assert.ok(db.verifyPassword("hunter22", u.pw_hash));
  assert.ok(!db.verifyPassword("wrong", u.pw_hash));
});

test("users: updatePassword rotates the hash, updateName renames", () => {
  const u = db.createUser({ email: "pw@test.io", name: "Pw", password: "original1" });
  db.updatePassword(u.id, "changed123");
  const fresh = db.getUserById(u.id);
  assert.ok(!db.verifyPassword("original1", fresh.pw_hash));
  assert.ok(db.verifyPassword("changed123", fresh.pw_hash));
  db.updateName(u.id, "Renamed");
  assert.equal(db.getUserById(u.id).name, "Renamed");
});

test("sessions: create, resolve, expire, revoke", () => {
  const u = db.createUser({ email: "sess@test.io", name: "S", password: "password1" });
  const t = db.createSession(u.id);
  assert.equal(db.getSessionUser(t, 60_000).id, u.id);
  assert.equal(db.getSessionUser(t, -1), null); // aged out → deleted
  assert.equal(db.getSessionUser(t, 60_000), null); // and stays gone
  const t2 = db.createSession(u.id);
  db.destroyUserSessions(u.id);
  assert.equal(db.getSessionUser(t2, 60_000), null);
});

test("sessions: disabled users can't resolve a session", () => {
  const u = db.createUser({ email: "off@test.io", name: "Off", password: "password1" });
  const t = db.createSession(u.id);
  db.setUserActive(u.id, false);
  assert.equal(db.getSessionUser(t, 60_000), null);
});

test("invites: single-use", () => {
  const t = db.createInvite({ email: "friend@test.io", name: "Friend" });
  assert.equal(db.getInvite(t).email, "friend@test.io");
  db.useInvite(t);
  assert.equal(db.getInvite(t), undefined);
});

test("liked: toggle on/off, newest first", () => {
  const u = db.createUser({ email: "like@test.io", name: "L", password: "password1" });
  assert.equal(db.toggleLike(u.id, song("a1")), true);
  assert.equal(db.toggleLike(u.id, song("a2")), true);
  assert.deepEqual(db.likedSongs(u.id).map((s) => s.id), ["a2", "a1"]);
  assert.equal(db.toggleLike(u.id, song("a1")), false);
  assert.deepEqual(db.likedSongs(u.id).map((s) => s.id), ["a2"]);
});

test("history: upserts and orders by last played", () => {
  const u = db.createUser({ email: "hist@test.io", name: "H", password: "password1" });
  db.addHistory(u.id, song("h1"));
  db.addHistory(u.id, song("h2"));
  db.addHistory(u.id, song("h1", { title: "Song h1 (updated)" }));
  const hist = db.getHistory(u.id);
  assert.equal(hist.length, 2);
  assert.equal(hist[0].id, "h1"); // replayed → back to the top
  assert.equal(hist[0].title, "Song h1 (updated)");
});

test("playlists: crud, ownership, and ordering", () => {
  const u = db.createUser({ email: "pl@test.io", name: "P", password: "password1" });
  const other = db.createUser({ email: "pl2@test.io", name: "P2", password: "password1" });
  const p = db.createPlaylist(u.id, "Mine");

  db.addPlaylistSong(u.id, p.id, song("s1"));
  db.addPlaylistSong(u.id, p.id, song("s2"));
  db.addPlaylistSong(u.id, p.id, song("s3"));
  assert.deepEqual(db.getPlaylist(u.id, p.id).songs.map((s) => s.id), ["s1", "s2", "s3"]);

  // another user can't see or mutate it
  assert.equal(db.getPlaylist(other.id, p.id), null);
  assert.equal(db.addPlaylistSong(other.id, p.id, song("evil")), null);
  assert.equal(db.reorderPlaylist(other.id, p.id, ["s3", "s1"]), null);

  const reordered = db.reorderPlaylist(u.id, p.id, ["s3", "s1", "s2"]);
  assert.deepEqual(reordered.songs.map((s) => s.id), ["s3", "s1", "s2"]);

  db.removePlaylistSong(u.id, p.id, "s1");
  assert.deepEqual(db.getPlaylist(u.id, p.id).songs.map((s) => s.id), ["s3", "s2"]);

  db.renamePlaylist(u.id, p.id, "Renamed");
  assert.equal(db.getPlaylist(u.id, p.id).name, "Renamed");
  assert.ok(db.deletePlaylist(u.id, p.id));
  assert.equal(db.getPlaylist(u.id, p.id), null);
});

test("playlists: import preserves order", () => {
  const u = db.createUser({ email: "imp@test.io", name: "I", password: "password1" });
  const p = db.importPlaylist(u.id, "Imported", [song("i3"), song("i1"), song("i2")]);
  assert.equal(p.name, "Imported");
  assert.deepEqual(p.songs.map((s) => s.id), ["i3", "i1", "i2"]);
});

test("sharing: stable token, member view, revoke", () => {
  const owner = db.createUser({ email: "share@test.io", name: "Owner", password: "password1" });
  const p = db.createPlaylist(owner.id, "Shared list");
  db.addPlaylistSong(owner.id, p.id, song("sh1"));

  const t1 = db.sharePlaylist(owner.id, p.id);
  const t2 = db.sharePlaylist(owner.id, p.id);
  assert.equal(t1, t2); // idempotent
  assert.equal(db.getShareToken(owner.id, p.id), t1);

  const view = db.getSharedPlaylist(t1);
  assert.equal(view.name, "Shared list");
  assert.equal(view.owner, "Owner");
  assert.deepEqual(view.songs.map((s) => s.id), ["sh1"]);

  assert.ok(db.revokeShare(owner.id, p.id));
  assert.equal(db.getSharedPlaylist(t1), null);
  assert.equal(db.getShareToken(owner.id, p.id), null);

  // sharing someone else's playlist id is rejected
  const stranger = db.createUser({ email: "str@test.io", name: "S", password: "password1" });
  assert.equal(db.sharePlaylist(stranger.id, p.id), null);
});

test("saved albums + followed artists toggle", () => {
  const u = db.createUser({ email: "lib@test.io", name: "Lib", password: "password1" });
  assert.equal(db.toggleSavedAlbum(u.id, { token: "MPREb_x", title: "Album X", artist: "A" }), true);
  assert.equal(db.savedAlbums(u.id)[0].token, "MPREb_x");
  assert.equal(db.toggleSavedAlbum(u.id, { token: "MPREb_x", title: "Album X" }), false);
  assert.equal(db.savedAlbums(u.id).length, 0);

  assert.equal(db.toggleFollowedArtist(u.id, { id: "UC123", name: "Artist X" }), true);
  assert.equal(db.followedArtists(u.id)[0].id, "UC123");
  assert.equal(db.toggleFollowedArtist(u.id, { id: "UC123", name: "Artist X" }), false);
  assert.equal(db.followedArtists(u.id).length, 0);

  const lib = db.getLibrary(u.id);
  assert.deepEqual(Object.keys(lib).sort(),
    ["albums", "artists", "hidden", "history", "liked", "playlists", "saves"]);
});

test("saves are a separate shelf from liked and playlists", () => {
  const u = db.createUser({ email: "saves@test.io", name: "Saver", password: "password1" });
  assert.equal(db.toggleSave(u.id, song("s1")), true);
  assert.equal(db.savedSongs(u.id).length, 1);
  // saving must not leak into liked songs — that separation is the whole point
  assert.equal(db.likedSongs(u.id).length, 0);
  assert.equal(db.toggleSave(u.id, song("s1")), false);
  assert.equal(db.savedSongs(u.id).length, 0);

  db.toggleSave(u.id, song("s2"));
  db.toggleSave(u.id, song("s3"));
  db.clearSaves(u.id);
  assert.equal(db.savedSongs(u.id).length, 0);
});

test("history counts plays so top-played can rank", () => {
  const u = db.createUser({ email: "plays@test.io", name: "Player", password: "password1" });
  db.addHistory(u.id, song("p1"));
  db.addHistory(u.id, song("p2"));
  db.addHistory(u.id, song("p2"));
  db.addHistory(u.id, song("p2"));
  db.addHistory(u.id, song("p3"));
  db.addHistory(u.id, song("p3"));

  const top = db.topPlayed(u.id, 10);
  assert.deepEqual(top.map((s) => s.id), ["p2", "p3", "p1"]);
  assert.deepEqual(top.map((s) => s.plays), [3, 2, 1]);
  // replaying must update, not duplicate
  assert.equal(db.getHistory(u.id).length, 3);
});

test("friendship needs both directions", () => {
  const a = db.createUser({ email: "fa@test.io", name: "Ada", password: "password1" });
  const b = db.createUser({ email: "fb@test.io", name: "Bo", password: "password1" });

  assert.deepEqual(db.requestFriend(a.id, b.id), { accepted: false });
  assert.equal(db.getFriends(a.id).pendingOut.length, 1);
  assert.equal(db.getFriends(a.id).friends.length, 0);
  assert.equal(db.getFriends(b.id).pendingIn.length, 1);

  assert.deepEqual(db.requestFriend(b.id, a.id), { accepted: true });
  assert.equal(db.getFriends(a.id).friends.length, 1);
  assert.equal(db.getFriends(b.id).friends[0].name, "Ada");
  assert.equal(db.getFriends(a.id).pendingOut.length, 0);

  // a friend's last play rides along with the list
  db.addHistory(b.id, song("f1"));
  assert.equal(db.getFriends(a.id).friends[0].nowPlaying.id, "f1");

  // removing from either side drops both edges
  db.removeFriend(b.id, a.id);
  assert.equal(db.getFriends(a.id).friends.length, 0);
  assert.equal(db.getFriends(a.id).pendingIn.length, 0);

  // you can't friend yourself, or a stranger who doesn't exist
  assert.equal(db.requestFriend(a.id, a.id), null);
  assert.equal(db.requestFriend(a.id, 999999), null);
});

test("member search finds others by display name, never yourself", () => {
  const me = db.createUser({ email: "me@test.io", name: "Marwan", password: "password1" });
  const other = db.createUser({ email: "other@test.io", name: "Marwana", password: "password1" });
  const names = db.searchMembers(me.id, "Marwan").map((m) => m.name);
  assert.ok(names.includes("Marwana"));
  assert.ok(!names.includes("Marwan"));
  assert.deepEqual(Object.keys(db.searchMembers(me.id, "Marwan")[0]).sort(), ["id", "name"]);

  // disabled members drop out of search
  db.setUserActive(other.id, false);
  assert.equal(db.searchMembers(me.id, "Marwana").length, 0);
});

test("deleteUser removes the whole footprint", () => {
  const u = db.createUser({ email: "gone@test.io", name: "G", password: "password1" });
  db.toggleLike(u.id, song("g1"));
  db.addHistory(u.id, song("g2"));
  db.toggleSavedAlbum(u.id, { token: "MPREb_g", title: "G" });
  db.toggleFollowedArtist(u.id, { id: "UCg", name: "G" });
  db.toggleSave(u.id, song("g4"));
  const p = db.createPlaylist(u.id, "Gone");
  db.addPlaylistSong(u.id, p.id, song("g3"));
  const share = db.sharePlaylist(u.id, p.id);

  db.deleteUser(u.id);
  assert.equal(db.getUserById(u.id), undefined);
  assert.equal(db.getSharedPlaylist(share), null);
  const raw = db.default;
  for (const [table, col] of [
    ["liked", "user_id"], ["history", "user_id"], ["saved_albums", "user_id"],
    ["followed_artists", "user_id"], ["playlists", "user_id"],
    ["saves", "user_id"], ["friend_edges", "user_id"],
  ]) {
    const n = raw.prepare(`SELECT COUNT(*) c FROM ${table} WHERE ${col} = ?`).get(u.id).c;
    assert.equal(n, 0, `${table} not cleaned`);
  }
});

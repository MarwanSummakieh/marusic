// Device tokens — the long-lived bearer credentials the Android app (and
// Android Auto) authenticates with. Same throwaway-file setup as db.test.js.
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

let seq = 0;
const user = () =>
  db.createUser({ email: `dev${++seq}@test.io`, name: `Dev${seq}`, password: "password1" });

test("create + resolve round-trip", () => {
  const u = user();
  const { id, token } = db.createDeviceToken(u.id, "Pixel 9");
  assert.ok(id > 0);
  assert.match(token, /^[0-9a-f]{64}$/); // 32 random bytes, hex
  assert.equal(db.getUserByDeviceToken(token).id, u.id);
});

test("only a hash is stored, never the raw token", () => {
  const u = user();
  const { token } = db.createDeviceToken(u.id, "leak check");
  const rows = db.default.prepare("SELECT token_hash FROM device_tokens").all();
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.token_hash !== token));
});

test("unknown or garbage tokens resolve to null", () => {
  assert.equal(db.getUserByDeviceToken("deadbeef".repeat(8)), null);
  assert.equal(db.getUserByDeviceToken(""), null);
  assert.equal(db.getUserByDeviceToken(null), null);
  assert.equal(db.getUserByDeviceToken(undefined), null);
});

test("list exposes metadata (newest first) but not the token; revoke deletes", () => {
  const u = user();
  const a = db.createDeviceToken(u.id, "Car");
  const b = db.createDeviceToken(u.id, "Phone");
  const list = db.listDeviceTokens(u.id);
  assert.equal(list.length, 2);
  assert.deepEqual(Object.keys(list[0]).sort(), ["created", "id", "lastUsed", "name"]);
  assert.equal(list[0].id, b.id);

  assert.ok(db.revokeDeviceToken(u.id, a.id));
  assert.equal(db.getUserByDeviceToken(a.token), null);
  assert.equal(db.getUserByDeviceToken(b.token).id, u.id);
});

test("a user cannot revoke another user's token", () => {
  const owner = user();
  const stranger = user();
  const { id, token } = db.createDeviceToken(owner.id, "mine");
  assert.equal(db.revokeDeviceToken(stranger.id, id), false);
  assert.equal(db.getUserByDeviceToken(token).id, owner.id);
});

test("deactivated users' tokens stop resolving", () => {
  const u = user();
  const { token } = db.createDeviceToken(u.id, "car");
  db.setUserActive(u.id, false);
  assert.equal(db.getUserByDeviceToken(token), null);
  db.setUserActive(u.id, true);
  assert.equal(db.getUserByDeviceToken(token).id, u.id);
});

test("device tokens survive a password change (unlike sessions)", () => {
  const u = user();
  const sid = db.createSession(u.id);
  const { token } = db.createDeviceToken(u.id, "car");
  db.updatePassword(u.id, "newpassword1");
  db.destroyUserSessions(u.id); // what /api/account/password does
  assert.equal(db.getSessionUser(sid, 60_000), null);
  assert.equal(db.getUserByDeviceToken(token).id, u.id); // car stays signed in
});

test("deleteUser removes the user's device tokens", () => {
  const u = user();
  db.createDeviceToken(u.id, "gone");
  db.deleteUser(u.id);
  const n = db.default
    .prepare("SELECT COUNT(*) c FROM device_tokens WHERE user_id = ?")
    .get(u.id).c;
  assert.equal(n, 0);
});

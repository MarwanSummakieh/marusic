// Tests for the Cast media tokens (lib/security.js) — the credential a
// Chromecast presents to /api/stream instead of a session cookie.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeCastToken, verifyCastToken } from "../lib/security.js";

test("cast token: round-trips the user id", () => {
  const { token, exp } = makeCastToken(42);
  assert.ok(exp > Date.now());
  assert.deepEqual(verifyCastToken(token), { userId: 42 });
});

test("cast token: rejects tampering", () => {
  const { token } = makeCastToken(42);
  const [userId, exp, sig] = token.split(".");
  // swapped user id, forged/truncated signature, altered expiry
  assert.equal(verifyCastToken(`7.${exp}.${sig}`), null);
  assert.equal(verifyCastToken(`${userId}.${exp}.${sig.slice(0, -2)}xx`), null);
  assert.equal(verifyCastToken(`${userId}.${Number(exp) + 9999}.${sig}`), null);
});

test("cast token: rejects expiry and garbage", () => {
  const { token: expired } = makeCastToken(42, -1000); // validly signed, past exp
  assert.equal(verifyCastToken(expired), null);
  assert.equal(verifyCastToken(""), null);
  assert.equal(verifyCastToken(null), null);
  assert.equal(verifyCastToken("not.a.token"), null);
  assert.equal(verifyCastToken("1.2"), null);
});

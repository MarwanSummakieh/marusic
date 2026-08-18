// Tests for the yt-dlp argv the stream resolver builds (lib/ytmusic.js).
// Pure argument construction, nothing spawned: whether -4 and player_client
// actually reach yt-dlp is exactly the kind of thing that breaks silently and
// still reads fine in review — the production 403s were a header flag that
// never got sent, so these assert the flags land.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStreamArgs, STREAM_CLIENTS } from "../lib/ytmusic.js";

// index of a flag's value, so order-insensitive assertions stay readable
const valueAfter = (args, flag) => args[args.indexOf(flag) + 1];
const pairs = (args, flag) =>
  args.map((a, i) => (a === flag ? args[i + 1] : null)).filter(Boolean);

test("args: default resolve asks for the URL and its headers", () => {
  const args = buildStreamArgs("abc123", "high");
  assert.deepEqual(pairs(args, "--print"), ["%(url)s", "%(http_headers)j"]);
  assert.equal(valueAfter(args, "-f"), "bestaudio/best");
  assert.ok(args.includes("--no-playlist"));
  assert.ok(args.at(-1).endsWith("watch?v=abc123"));
  // nothing opted in, so neither knob shows up
  assert.equal(args.includes("-4"), false);
  assert.equal(args.includes("--extractor-args"), false);
});

test("args: quality picks the format, unknown falls back to high", () => {
  assert.equal(valueAfter(buildStreamArgs("x1", "low"), "-f"), "worstaudio/worst");
  assert.match(valueAfter(buildStreamArgs("x1", "sonos"), "-f"), /m4a|mp4a/);
  assert.equal(valueAfter(buildStreamArgs("x1", "nonsense"), "-f"), "bestaudio/best");
  assert.equal(valueAfter(buildStreamArgs("x1"), "-f"), "bestaudio/best");
});

test("args: ipv4 pins the resolve so it leaves by the same address as the fetch", () => {
  assert.ok(buildStreamArgs("abc123", "high", { ipv4: true }).includes("-4"));
  assert.equal(buildStreamArgs("abc123", "high", { ipv4: false }).includes("-4"), false);
});

test("args: a player client is passed through as an extractor arg", () => {
  const args = buildStreamArgs("abc123", "high", { client: "web_safari" });
  assert.equal(valueAfter(args, "--extractor-args"), "youtube:player_client=web_safari");
  // the flag precedes -f, so a client never gets read as a format
  assert.ok(args.indexOf("--extractor-args") < args.indexOf("-f"));
});

test("args: both knobs compose, and the URL stays last", () => {
  const args = buildStreamArgs("abc123", "medium", { ipv4: true, client: "tv" });
  assert.ok(args.includes("-4"));
  assert.equal(valueAfter(args, "--extractor-args"), "youtube:player_client=tv");
  assert.equal(valueAfter(args, "-f"), "bestaudio[abr<=132]/bestaudio/best");
  assert.equal(args.filter((a) => a.startsWith("https://www.youtube.com/")).length, 1);
  assert.ok(args.at(-1).startsWith("https://www.youtube.com/"));
});

test("clients: the fallback ladder is non-empty and has no duplicates", () => {
  assert.ok(STREAM_CLIENTS.length > 0);
  assert.equal(new Set(STREAM_CLIENTS).size, STREAM_CLIENTS.length);
  // an empty entry would resolve with no client and silently repeat the
  // attempt that already failed
  assert.equal(STREAM_CLIENTS.some((c) => !c.trim()), false);
});

test("clients: the ladder holds only clients measured to work", () => {
  // Probed against a real video: web, web_safari, ios and tv return no usable
  // audio format, mweb resolved but its URL was refused, and tv_embedded
  // silently negotiates ANDROID_VR, and web_embedded passed once then was
  // refused on the next run. A ladder is only worth having if every
  // rung holds weight, so guard the measured set against a hopeful edit.
  const BROKEN = ["web", "web_safari", "ios", "tv", "mweb", "tv_embedded", "web_embedded"];
  for (const bad of BROKEN)
    assert.equal(STREAM_CLIENTS.includes(bad), false, `${bad} does not work — do not ship it in the ladder`);
  // ANDROID_VR is what yt-dlp already picks by default, so retrying it is a
  // guaranteed-identical second failure
  assert.equal(STREAM_CLIENTS.includes("android_vr"), false);
});

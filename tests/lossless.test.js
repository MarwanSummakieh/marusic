// Pure-function tests for the lossless matcher. The network paths (Tidal/Qobuz
// proxies) aren't exercised here — these cover the parsing/scoring logic that
// decides what gets handed back, which is where correctness bugs hide.
import { test } from "node:test";
import assert from "node:assert/strict";
import { flacUrlFromManifest, similarity, scoreCandidate } from "../lib/lossless.js";

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64");

test("flacUrlFromManifest pulls the FLAC url from a Tidal BTS manifest", () => {
  const url = "https://lgf.audio.tidal.com/abc.flac";
  const manifest = b64({ mimeType: "audio/flac", codecs: "flac", encryptionType: "NONE", urls: [url] });
  assert.equal(flacUrlFromManifest(manifest), url);
});

test("flacUrlFromManifest rejects DRM-encrypted manifests", () => {
  const manifest = b64({ encryptionType: "OLD_AES", urls: ["https://x/y.flac"] });
  assert.equal(flacUrlFromManifest(manifest), null);
});

test("flacUrlFromManifest handles a singular url field", () => {
  const manifest = b64({ encryptionType: "NONE", url: "https://cdn/track.flac" });
  assert.equal(flacUrlFromManifest(manifest), "https://cdn/track.flac");
});

test("flacUrlFromManifest returns null on garbage / non-http", () => {
  assert.equal(flacUrlFromManifest("not-base64-!!!"), null);
  assert.equal(flacUrlFromManifest(b64({ urls: ["ftp://nope"] })), null);
  assert.equal(flacUrlFromManifest(b64({ urls: [] })), null);
  assert.equal(flacUrlFromManifest(undefined), null);
});

// The ISRC is what stops a karaoke cover or a live cut with the same title
// winning on text similarity alone.
test("an ISRC match outranks a better text match", () => {
  const isrcs = ["USUG11904206"];
  const exactText = { title: "Blinding Lights", artist: "The Weeknd", isrc: "GBXXX0000001", bitDepth: 16 };
  const isrcHit = { title: "Blinding Lights (Single Version)", artist: "Weeknd", isrc: "USUG11904206", bitDepth: 16 };

  const a = scoreCandidate(exactText, "Blinding Lights", "The Weeknd", isrcs);
  const b = scoreCandidate(isrcHit, "Blinding Lights", "The Weeknd", isrcs);
  assert.ok(b > a, "the ISRC-matched candidate should win");
});

test("scoring is case-insensitive about ISRCs and survives having none", () => {
  const cand = { title: "Song", artist: "Band", isrc: "usug11904206", bitDepth: 16 };
  assert.ok(
    scoreCandidate(cand, "Song", "Band", ["USUG11904206"]) >
    scoreCandidate(cand, "Song", "Band", [])
  );
  // no ISRC data at all must not throw, and hi-res still breaks ties
  const hires = { title: "Song", artist: "Band", isrc: "", bitDepth: 24 };
  const cd = { title: "Song", artist: "Band", isrc: "", bitDepth: 16 };
  assert.ok(scoreCandidate(hires, "Song", "Band") > scoreCandidate(cd, "Song", "Band"));
});

test("similarity ignores bracketed noise and casing", () => {
  assert.equal(similarity("Blinding Lights", "blinding lights"), 1);
  assert.ok(similarity("Blinding Lights (Remastered)", "Blinding Lights") >= 0.99);
  assert.ok(similarity("Blinding Lights", "Save Your Tears") < 0.34);
  assert.equal(similarity("", "anything"), 0);
});

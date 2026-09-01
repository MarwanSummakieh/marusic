// Tests for the recommender (lib/reco.js) and its db feeds — the ranking is
// pure functions over taste rows, so it all runs against a throwaway SQLite
// file with no network in sight.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DB_PATH = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "marusic-reco-test-")),
  "test.sqlite"
);
const db = await import("../lib/db.js");
const reco = await import("../lib/reco.js");

const song = (id, extra = {}) => ({
  id,
  title: `Song ${id}`,
  artist: "Test Artist",
  album: "Test Album",
  duration: 200,
  image: "",
  ...extra,
});

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000; // fixed clock — decay math must not read the wall

/* ------------------------------ pure ranking ------------------------------ */

test("decay: halves every 30 days", () => {
  assert.equal(reco.decay(0), 1);
  assert.ok(Math.abs(reco.decay(30 * DAY) - 0.5) < 1e-9);
  assert.ok(reco.decay(90 * DAY) < reco.decay(30 * DAY));
});

test("artistKey: first credited artist, case-folded", () => {
  assert.equal(reco.artistKey({ artist: "Dua Lipa feat. DaBaby" }), "dua lipa");
  assert.equal(reco.artistKey({ artist: "A & B" }), "a");
  assert.equal(reco.artistKey({ artist: "" }), "");
});

test("buildProfile: likes lift an artist, skips drag one down, hidden is hard", () => {
  const profile = reco.buildProfile(
    {
      history: [
        { song_id: "h1", artist: "Skipped Band", plays: 4, skips: 6, played_at: NOW - DAY, duration: 200 },
        { song_id: "h2", artist: "Played Band", plays: 4, completions: 3, played_at: NOW - DAY, duration: 200 },
      ],
      liked: [{ song_id: "l1", artist: "Liked Band", created: NOW - DAY }],
      hidden: [{ song_id: "x1", artist: "Hidden Band" }],
    },
    NOW
  );
  assert.ok(profile.artists.get("liked band") > 0);
  assert.ok(profile.artists.get("played band") > profile.artists.get("skipped band"));
  assert.ok(profile.artists.get("hidden band") < 0);
  assert.ok(profile.hiddenIds.has("x1"));
});

test("buildProfile: watch time scales the play signal", () => {
  const row = (id, ms) => ({
    song_id: id, artist: `Band ${id}`, plays: 5, duration: 200,
    ms_played: ms, played_at: NOW - DAY,
  });
  // finished every play vs bailed almost immediately
  const profile = reco.buildProfile({ history: [row("full", 5 * 200_000), row("bail", 5_000)] }, NOW);
  assert.ok(profile.artists.get("band full") > profile.artists.get("band bail"));
});

test("rankCandidates: hidden dropped, taste outranks equal priors, dedupe keeps best", () => {
  const profile = reco.buildProfile(
    {
      liked: [{ song_id: "l1", artist: "Fave", created: NOW }],
      hidden: [{ song_id: "bad", artist: "Meh" }],
    },
    NOW
  );
  const ranked = reco.rankCandidates(
    [
      { ...song("a", { artist: "Nobody" }), source: "automix", prior: 0.8 },
      { ...song("b", { artist: "Fave" }), source: "automix", prior: 0.8 },
      { ...song("bad", { artist: "Meh" }), source: "automix", prior: 1 },
      { ...song("a", { artist: "Nobody" }), source: "trending", prior: 1 }, // duplicate, worse source
    ],
    profile
  );
  assert.deepEqual(ranked.map((c) => c.id), ["b", "a"]);
  assert.equal(ranked[1].source, "automix"); // the higher-scoring nomination won
});

test("scoreCandidate: a track heard in the last day sinks, novelty lifts", () => {
  const profile = reco.buildProfile(
    { history: [{ song_id: "old", artist: "X", plays: 2, played_at: NOW - 2 * 60 * 60 * 1000 }] },
    NOW
  );
  const fresh = reco.scoreCandidate({ ...song("new1", { artist: "X" }), source: "automix", prior: 0.5 }, profile);
  const repeat = reco.scoreCandidate({ ...song("old", { artist: "X" }), source: "automix", prior: 0.5 }, profile);
  assert.ok(fresh > repeat);
});

test("diversify: caps per artist and reserves discovery slots", () => {
  const profile = reco.buildProfile(
    { liked: [{ song_id: "l", artist: "Known", created: NOW }] },
    NOW
  );
  const ranked = [
    ...[1, 2, 3, 4].map((i) => ({ ...song(`k${i}`, { artist: "Known" }), score: 10 - i })),
    { ...song("n1", { artist: "Fresh Face" }), score: 0.5 },
    { ...song("n2", { artist: "Other New" }), score: 0.4 },
  ];
  const slate = reco.diversify(ranked, profile, { limit: 4, perArtist: 2, exploreSlots: 2 });
  assert.equal(slate.filter((c) => c.artist === "Known").length, 2);
  assert.ok(slate.some((c) => c.artist === "Fresh Face"));
  assert.ok(slate.some((c) => c.artist === "Other New"));
});

test("rerankUpNext: keeps upstream order for a blank profile, drops hidden, sinks serial skips", () => {
  const upstream = [song("u1"), song("u2"), song("u3"), song("u4")];

  const blank = reco.buildProfile({}, NOW);
  assert.deepEqual(reco.rerankUpNext(upstream, blank).map((s) => s.id), ["u1", "u2", "u3", "u4"]);

  const profile = reco.buildProfile(
    {
      history: [{ song_id: "u1", artist: "Test Artist", plays: 2, skips: 5, played_at: NOW - 10 * DAY }],
      hidden: [{ song_id: "u3", artist: "Test Artist" }],
    },
    NOW
  );
  const ids = reco.rerankUpNext(upstream, profile).map((s) => s.id);
  assert.ok(!ids.includes("u3"));
  assert.equal(ids[ids.length - 1], "u1"); // five skips beat the top positional prior
});

test("pickSeeds: one per artist, strongest taste first, skip-heavy and hidden excluded", () => {
  const taste = {
    history: [
      { song_id: "s1", title: "S1", artist: "Alpha", plays: 9, played_at: NOW - DAY, duration: 200 },
      { song_id: "s2", title: "S2", artist: "Alpha", plays: 8, played_at: NOW - DAY, duration: 200 },
      { song_id: "s3", title: "S3", artist: "Beta", plays: 2, skips: 9, played_at: NOW - DAY, duration: 200 },
      { song_id: "s4", title: "S4", artist: "Gamma", plays: 3, played_at: NOW - DAY, duration: 200 },
      { song_id: "s5", title: "S5", artist: "Delta", plays: 5, played_at: NOW - DAY, duration: 200 },
    ],
    hidden: [{ song_id: "s5", artist: "Delta" }],
  };
  const seeds = reco.pickSeeds(taste, 5, NOW);
  const artists = seeds.map((s) => s.artist);
  assert.equal(new Set(artists).size, artists.length); // distinct artists
  assert.equal(artists.filter((a) => a === "Alpha").length, 1);
  assert.ok(!seeds.some((s) => s.id === "s3")); // mostly skipped
  assert.ok(!seeds.some((s) => s.id === "s5")); // hidden
});

/* ----------------------------- db signal feeds ----------------------------- */

test("notePlayOutcome: completions, skips, and accumulated listen time", () => {
  const u = db.createUser({ email: "reco@test.io", name: "Reco", password: "secret12" });
  db.addHistory(u.id, song("t1"));

  assert.equal(db.notePlayOutcome(u.id, "nope", 10_000, 200_000), false); // never played

  db.notePlayOutcome(u.id, "t1", 195_000, 200_000); // finished
  db.notePlayOutcome(u.id, "t1", 8_000, 200_000); // bailed fast
  db.notePlayOutcome(u.id, "t1", 100_000, 200_000); // half — neither

  const row = db.getTasteData(u.id).history.find((h) => h.song_id === "t1");
  assert.equal(row.completions, 1);
  assert.equal(row.skips, 1);
  assert.equal(row.ms_played, 303_000);
});

test("importPlays: Takeout rows merge into history without rewriting the present", () => {
  const u = db.createUser({ email: "takeout@test.io", name: "Takeout", password: "secret12" });
  const before = Date.now();
  db.addHistory(u.id, song("kept")); // a real play from just now

  const n = db.importPlays(u.id, [
    { id: "kept", title: "Song kept", artist: "Test Artist", plays: 40, lastPlayed: NOW - 400 * DAY },
    { id: "new1", title: "Old Fave", artist: "Import Band", plays: 12, lastPlayed: NOW - 100 * DAY },
    { id: "future", title: "Clock Skew", artist: "X", plays: 2, lastPlayed: Date.now() + 365 * DAY },
    { id: "", title: "no id" }, // junk rows don't count
    { title: "no id either" },
  ]);
  assert.equal(n, 3);

  const rows = Object.fromEntries(db.getTasteData(u.id).history.map((h) => [h.song_id, h]));
  assert.equal(rows.kept.plays, 41); // plays accumulate…
  assert.ok(rows.kept.played_at >= before); // …but the fresh timestamp survives the old import
  assert.equal(rows.new1.plays, 12);
  assert.equal(rows.new1.played_at, NOW - 100 * DAY);
  assert.ok(rows.future.played_at <= Date.now()); // future stamps clamp to now

  // the imported taste feeds seeds immediately
  const seeds = reco.pickSeeds(db.getTasteData(u.id), 5, NOW);
  assert.ok(seeds.some((s) => s.artist === "Import Band"));
});

test("getTasteData: all-time favourites survive a wall of recent plays", () => {
  const u = db.createUser({ email: "wall@test.io", name: "Wall", password: "secret12" });
  // a heavy old favourite (Takeout-style: big plays, old timestamp)…
  db.importPlays(u.id, [
    { id: "oldfave", title: "Old Fave", artist: "Import Band", plays: 500, lastPlayed: NOW - 300 * DAY },
  ]);
  // …buried under more recent plays than the recency window holds
  for (let i = 0; i < 310; i++) db.addHistory(u.id, song(`recent${i}`));

  const taste = db.getTasteData(u.id);
  assert.ok(taste.history.some((h) => h.song_id === "oldfave"));
  assert.equal(new Set(taste.history.map((h) => h.song_id)).size, taste.history.length); // union, no dupes
});

test("hidden: hide, surface in library, unhide", () => {
  const u = db.createUser({ email: "hide@test.io", name: "Hide", password: "secret12" });
  db.hideSong(u.id, song("h1", { artist: "Bad Band" }));
  db.hideSong(u.id, song("h1", { artist: "Bad Band" })); // idempotent
  assert.deepEqual(db.hiddenSongIds(u.id), ["h1"]);
  assert.deepEqual(db.getLibrary(u.id).hidden, ["h1"]);
  assert.equal(db.getTasteData(u.id).hidden[0].artist, "Bad Band");
  assert.ok(db.unhideSong(u.id, "h1"));
  assert.deepEqual(db.hiddenSongIds(u.id), []);
});

test("coListenedCandidates: neighbors nominate what you haven't heard", () => {
  const me = db.createUser({ email: "me@test.io", name: "Me", password: "secret12" });
  const pal = db.createUser({ email: "pal@test.io", name: "Pal", password: "secret12" });
  const rando = db.createUser({ email: "rando@test.io", name: "Rando", password: "secret12" });

  // pal shares two plays with me and has two of their own; rando shares nothing
  for (const id of ["c1", "c2", "mine"]) db.addHistory(me.id, song(id));
  for (const id of ["c1", "c2", "pal1", "pal2"]) db.addHistory(pal.id, song(id));
  db.addHistory(pal.id, song("pal1")); // pal's favourite — played twice
  db.addHistory(rando.id, song("r1"));
  db.hideSong(me.id, song("pal2"));

  const cands = db.coListenedCandidates(me.id);
  const ids = cands.map((c) => c.id);
  assert.ok(ids.includes("pal1"));
  assert.ok(!ids.includes("mine")); // already in my history
  assert.ok(!ids.includes("c1")); // shared, so also in my history
  assert.ok(!ids.includes("pal2")); // hidden
  assert.ok(!ids.includes("r1")); // no overlap with rando
  assert.ok(cands[0].weight > 0);
});

test("homeFeed: ranks automix + co-listening, falls back to trending when cold", async () => {
  const u = db.createUser({ email: "feed@test.io", name: "Feed", password: "secret12" });
  const trending = [song("tr1", { artist: "Chart Act" }), song("tr2", { artist: "Chart Act 2" })];
  const fakeYtm = {
    getUpNext: async (id) => [song(`${id}-next1`, { artist: `Near ${id}` }), song(`${id}-next2`, { artist: `Near ${id}` })],
    getTrending: async () => ({ singles: trending }),
  };

  // cold start: nothing played → trending, unranked
  const cold = await reco.homeFeed(u.id, { db, ytm: fakeYtm, nowMs: NOW });
  assert.equal(cold.seeded, false);
  assert.deepEqual(cold.songs.map((s) => s.id), ["tr1", "tr2"]);

  // warm: history seeds the automix fan-out
  db.addHistory(u.id, song("seed1", { artist: "Alpha" }));
  db.hideSong(u.id, song("seed1-next2", { artist: "Near seed1" }));
  const feed = await reco.homeFeed(u.id, { db, ytm: fakeYtm, nowMs: NOW });
  assert.equal(feed.seeded, true);
  const ids = feed.songs.map((s) => s.id);
  assert.ok(ids.includes("seed1-next1"));
  assert.ok(!ids.includes("seed1-next2")); // hidden never surfaces
  assert.ok(!ids.includes("seed1")); // the seed itself isn't a recommendation
  assert.ok(!("score" in feed.songs[0]) && !("source" in feed.songs[0])); // internals stripped
});

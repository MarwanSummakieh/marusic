// YouTube-style two-stage recommender, sized for one Marusic instance.
//
// YouTube's system (the Covington deep-candidate-generation paper, and every
// public description since) is two stages. Candidate generation: several
// cheap sources — similar-item lookups seeded by your history, co-watch
// collaborative filtering, fresh/trending — each nominate a batch. Ranking:
// one scorer orders the pooled candidates by expected *watch time* (not
// clicks), with explicit feedback (likes, "not interested") as overrides,
// then the final slate gets diversity caps and a few exploration slots so
// the feed never collapses into one artist or pure familiarity.
//
// The same architecture here:
//   sources   automix continuations of your highest-affinity seeds (similar
//             items), co-listening across instance members (collaborative
//             filtering), trending (exploration)
//   signals   listened time per play — the ranking objective — plus
//             completions up, early skips down, likes/saves/follows as strong
//             positives, hidden tracks as a hard no; everything decays with a
//             30-day half-life so last month's obsession outranks last year's
//   slate     at most two tracks per artist, reserved discovery slots

const HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Tuning in one place. Units are "score points"; a point is roughly one
// step of upstream automix similarity.
export const W = {
  affinity: 0.6, // per-artist taste, clamped to [-2, 4] before weighting
  affinityMin: -2,
  affinityMax: 4,
  novelty: 0.4, // never-played bonus: discovery surfaces favour fresh-to-you
  skip: 1.2, // per recorded skip of this exact track
  justPlayed: 1.5, // heard in the last 24h — don't feed it straight back
  knownFavorite: 0.2, // log-scaled resurface bonus…
  knownFavoriteCap: 0.6, // …capped, so a 200-play song doesn't pin the feed
  like: 2,
  save: 1,
  follow: 1.5,
  hiddenArtist: 0.75, // hiding a track dings its artist, softly
  sources: { automix: 1, co: 1.1, trending: 0.15 },
};

export const decay = (ageMs) => Math.pow(0.5, Math.max(0, ageMs) / HALF_LIFE_MS);

// Affinity aggregates per first-credited artist — "Artist feat. Guest" counts
// toward Artist, matching how the album page splits contributor credits.
export const artistKey = (s) =>
  String(s.artist || "")
    .split(/,|&|feat\.|ft\.|\bx\b/i)[0]
    .trim()
    .toLowerCase();

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ------------------------------ profile ------------------------------ */
// Distill the library into what ranking needs: a per-artist affinity map, a
// per-song stats map, and the hard-no set. Input is db.getTasteData(userId).
export function buildProfile(taste = {}, nowMs = Date.now()) {
  const artists = new Map(); // artistKey -> affinity score
  const songs = new Map(); // songId -> { plays, skips, lastPlayed }
  const hiddenIds = new Set();
  const bump = (key, amt) => {
    if (key) artists.set(key, (artists.get(key) || 0) + amt);
  };

  for (const h of taste.history || []) {
    const plays = h.plays || 1;
    // Listen quality: the share of expected listening time actually heard.
    // Rows with no watch-time data (older rows, remote speakers) stay
    // neutral at 1 — absence of signal isn't a downvote.
    const expectedMs = (h.duration || 0) * 1000 * plays;
    let quality = 1;
    if (expectedMs > 0 && (h.ms_played || 0) > 0)
      quality = clamp(h.ms_played / expectedMs, 0.25, 1.5);
    const w =
      (Math.log2(1 + plays) * quality + 0.5 * (h.completions || 0) - 0.5 * (h.skips || 0)) *
      decay(nowMs - (h.played_at || nowMs));
    bump(artistKey(h), w);
    songs.set(h.song_id, { plays, skips: h.skips || 0, lastPlayed: h.played_at || 0 });
  }
  for (const l of taste.liked || []) bump(artistKey(l), W.like * decay(nowMs - (l.created || nowMs)));
  for (const s of taste.saves || []) bump(artistKey(s), W.save * decay(nowMs - (s.created || nowMs)));
  for (const f of taste.followed || []) bump(String(f.name || "").toLowerCase(), W.follow);
  for (const h of taste.hidden || []) {
    hiddenIds.add(h.song_id);
    bump(artistKey(h), -W.hiddenArtist);
  }
  return { artists, songs, hiddenIds, nowMs };
}

export const affinity = (profile, song) => profile.artists.get(artistKey(song)) || 0;

/* ------------------------------ ranking ------------------------------ */
// A candidate is a song plus { source, prior } where prior ∈ [0,1] is the
// nominating source's own confidence (position in an automix, co-play weight).
export function scoreCandidate(c, profile) {
  let s = (W.sources[c.source] ?? 0.5) * (c.prior ?? 0.5);
  s += clamp(affinity(profile, c), W.affinityMin, W.affinityMax) * W.affinity;
  const st = profile.songs.get(c.id);
  if (!st) {
    s += W.novelty;
  } else {
    s -= W.skip * st.skips;
    if (profile.nowMs - st.lastPlayed < DAY_MS) s -= W.justPlayed;
    s += Math.min(W.knownFavoriteCap, Math.log2(1 + st.plays) * W.knownFavorite);
  }
  return s;
}

// Dedupe (a song nominated by several sources keeps its best score), drop
// hidden, sort best-first.
export function rankCandidates(cands, profile) {
  const best = new Map();
  for (const c of cands) {
    if (!c?.id || profile.hiddenIds.has(c.id)) continue;
    const score = scoreCandidate(c, profile);
    const prev = best.get(c.id);
    if (!prev || score > prev.score) best.set(c.id, { ...c, score });
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

/* ------------------------------- slate ------------------------------- */
// Diversity pass: cap tracks per artist, then reserve the tail for artists
// the profile has never heard — the guard against a feed of pure déjà vu.
export function diversify(ranked, profile, { limit = 24, perArtist = 2, exploreSlots = 3 } = {}) {
  const picked = [];
  const counts = new Map();
  const have = new Set();
  const room = (c) => (counts.get(artistKey(c)) || 0) < perArtist && !have.has(c.id);
  const take = (c) => {
    picked.push(c);
    have.add(c.id);
    counts.set(artistKey(c), (counts.get(artistKey(c)) || 0) + 1);
  };

  for (const c of ranked) {
    if (picked.length >= limit - exploreSlots) break;
    if (room(c)) take(c);
  }
  for (const c of ranked) {
    if (picked.length >= limit) break;
    if (room(c) && !profile.artists.has(artistKey(c))) take(c);
  }
  for (const c of ranked) {
    // no unknown artists left — top up with the best of the rest
    if (picked.length >= limit) break;
    if (room(c)) take(c);
  }
  return picked;
}

const cleanSong = ({ source, prior, score, weight, ...song }) => song;

/* ------------------------------ up next ------------------------------ */
// Autoplay / song radio: the upstream automix order is already a similarity
// ranking, so it stays a strong prior — taste nudges it rather than shuffling
// it. Hidden tracks and serial skips drop out; recent repeats sink.
export function rerankUpNext(songs = [], profile) {
  const n = songs.length || 1;
  return songs
    .filter((s) => s?.id && !profile.hiddenIds.has(s.id))
    .map((s, i) => {
      let score = ((n - i) / n) * 2; // positional prior
      score += clamp(affinity(profile, s), -1.5, 1.5) * 0.35;
      const st = profile.songs.get(s.id);
      if (st) {
        score -= 0.8 * st.skips;
        if (profile.nowMs - st.lastPlayed < 6 * 60 * 60 * 1000) score -= 0.75;
      }
      return { s, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}

/* ------------------------------- seeds ------------------------------- */
const rowSong = (r) => ({
  id: r.song_id,
  title: r.title,
  artist: r.artist || "Unknown Artist",
  artistId: r.artist_id || "",
  album: r.album || "",
  duration: r.duration || 0,
  image: r.image || "",
});

// Seeds for the automix fan-out: your strongest current tastes, one per
// artist, skipping anything you mostly skip or explicitly hid.
export function pickSeeds(taste, n = 5, nowMs = Date.now()) {
  const profile = buildProfile(taste, nowMs);
  const pool = [...(taste.history || []), ...(taste.liked || [])];
  const seen = new Set();
  const scored = [];
  for (const r of pool) {
    if (!r.song_id || seen.has(r.song_id) || profile.hiddenIds.has(r.song_id)) continue;
    seen.add(r.song_id);
    const st = profile.songs.get(r.song_id);
    if (st && st.skips > st.plays) continue; // you keep skipping it
    const score =
      affinity(profile, r) +
      Math.log2(1 + (r.plays || 1)) * decay(nowMs - (r.played_at || r.created || nowMs));
    scored.push({ r, score });
  }
  scored.sort((a, b) => b.score - a.score);

  const seeds = [];
  const seenArtists = new Set();
  for (const { r } of scored) {
    const key = artistKey(r) || r.song_id;
    if (seenArtists.has(key)) continue;
    seenArtists.add(key);
    seeds.push(rowSong(r));
    if (seeds.length >= n) break;
  }
  return seeds;
}

/* ----------------------------- home feed ----------------------------- */
// The full pipeline behind Quick picks. Upstream cost matches the old
// implementation: one automix call per seed, plus trending only when the
// local sources come up short (or as the cold-start fallback).
export async function homeFeed(userId, { db, ytm, nowMs = Date.now(), limit = 24 } = {}) {
  const taste = db.getTasteData(userId);
  const profile = buildProfile(taste, nowMs);
  const seeds = pickSeeds(taste, 5, nowMs);

  const trendingFallback = async () => {
    const { singles = [] } = await ytm.getTrending().catch(() => ({ singles: [] }));
    return { songs: singles.slice(0, limit), seeded: false };
  };
  if (!seeds.length) return trendingFallback();

  const cands = [];

  // similar items: each seed's automix continuation, prior fading with depth
  const lists = await Promise.all(seeds.map((s) => ytm.getUpNext(s.id, 12).catch(() => [])));
  const seedIds = new Set(seeds.map((s) => s.id));
  for (const list of lists) {
    list.forEach((s, i) => {
      if (s?.id && !seedIds.has(s.id))
        cands.push({ ...s, source: "automix", prior: 1 - i / (2 * list.length) });
    });
  }

  // collaborative filtering: what the rest of the instance plays that you haven't
  const co = db.coListenedCandidates(userId, 30);
  const maxW = co[0]?.weight || 1;
  for (const c of co) cands.push({ ...c, source: "co", prior: c.weight / maxW });

  // exploration: only pay for a trending call when the pool runs thin
  if (cands.length < limit + 8) {
    const { singles = [] } = await ytm.getTrending().catch(() => ({ singles: [] }));
    singles.forEach((s, i) =>
      cands.push({ ...s, source: "trending", prior: 1 - i / (2 * (singles.length || 1)) })
    );
  }
  if (!cands.length) return trendingFallback();

  const slate = diversify(rankCandidates(cands, profile), profile, { limit });
  return { songs: slate.map(cleanSong), seeded: true };
}

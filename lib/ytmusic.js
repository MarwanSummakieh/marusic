// YouTube Music source layer — ported from involvex/youtube-music-cli.
// Search/metadata use the Innertube API via youtubei.js exactly like the CLI's
// MusicService (source/services/youtube-music/api.ts):
//   searchSongs   -> yt.music.search(q, {type:'song'})
//   searchAlbums  -> yt.music.search(q, {type:'album'})
//   getAlbum      -> yt.music.getAlbum(browseId)          (getReleaseTracks)
//   getUpNext     -> yt.music.getUpNext(id, automix)      (getSuggestions)
//   getGenres     -> /browse FEmusic_moods_and_genres     (getGenres)
//   genreTracks   -> getGenrePlaylists + getReleaseTracks
//   getTrending   -> yt.music.getExplore()                (getTrending)
// Stream extraction uses yt-dlp (the CLI's documented audio extractor) because
// YouTube now serves SABR-only responses that break every pure-JS extractor
// the CLI bundles (ytdl-core / youtube-ext / youtubei.js downloads).
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Innertube, Log } from "youtubei.js";
import { config } from "./config.js";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0";

/* ------------------------------ client ------------------------------ */
let ytClient = null;
async function getClient() {
  if (!ytClient) {
    Log.setLevel(Log.Level.ERROR); // suppress noisy parser warnings, like the CLI
    ytClient = await Innertube.create();
  }
  return ytClient;
}

/* ------------------------------ helpers ------------------------------ */
const txt = (v) => (v == null ? "" : String(v.text ?? v)).trim();

// Descriptions come back as several shapes depending on the surface: a plain
// string, a { text } node, or a run list. `txt` alone stringifies the nested
// ones into "[object Object]", so unwrap until we reach something printable.
function richText(v, depth = 0) {
  if (v == null || depth > 4) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map((p) => richText(p, depth + 1)).join("").trim();
  if (typeof v === "object")
    return richText(v.text ?? v.runs ?? v.content ?? v.description ?? null, depth + 1);
  return String(v).trim();
}

function thumbUrl(item, videoId = "") {
  const t = item?.thumbnail;
  const arr = Array.isArray(t) ? t : (t?.contents ?? item?.thumbnails ?? []);
  const best = Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
  if (best?.url) return best.url;
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "";
}

const artistsOf = (item) =>
  (item?.artists ?? item?.authors ?? [])
    .map((a) => a?.name)
    .filter(Boolean)
    .join(", ");

// first artist with a channel id — powers clickable artist names in the UI
const firstArtistId = (item) =>
  (item?.artists ?? item?.authors ?? []).find((a) => a?.channel_id)?.channel_id || "";

function mapSong(item, fallbacks = {}) {
  const id = item?.id || item?.video_id;
  if (!id) return null;
  return {
    id,
    title: txt(item.title) || "Unknown Title",
    artist: artistsOf(item) || txt(item.author?.name ?? item.author) || fallbacks.artist || "Unknown Artist",
    artistId: firstArtistId(item) || fallbacks.artistId || "",
    album: txt(item.album?.name) || fallbacks.album || "",
    duration:
      typeof item.duration === "number"
        ? item.duration
        : (item.duration?.seconds ?? 0),
    image: thumbUrl(item, id) || fallbacks.image || "",
  };
}

/* ------------------------------ search ------------------------------ */
export async function searchSongs(query) {
  const yt = await getClient();
  const res = await yt.music.search(query, { type: "song" });
  const items = [
    ...(res.songs?.contents ?? []),
    ...(res.videos?.contents ?? []),
  ];
  const seen = new Set();
  const songs = [];
  for (const item of items) {
    const s = mapSong(item);
    if (s && !seen.has(s.id)) {
      seen.add(s.id);
      songs.push(s);
    }
  }
  return songs.slice(0, 30);
}

// Videos are a separate shelf in YouTube Music's own search — live sets, music
// videos, fan uploads. Kept apart from songs so the UI can group them the same
// way, instead of blending two different things into one list.
export async function searchVideos(query) {
  const yt = await getClient();
  const res = await yt.music.search(query, { type: "video" });
  const items = [
    ...(res.videos?.contents ?? []),
    ...(res.songs?.contents ?? []),
  ];
  const seen = new Set();
  const videos = [];
  for (const item of items) {
    const v = mapSong(item);
    if (v && !seen.has(v.id)) {
      seen.add(v.id);
      videos.push(v);
    }
  }
  return videos.slice(0, 20);
}

export async function searchAlbums(query) {
  const yt = await getClient();
  const res = await yt.music.search(query, { type: "album" });
  return (res.albums?.contents ?? [])
    .map((a) => {
      // The release shelf mixes albums, EPs and singles; the subtitle leads
      // with which one it is ("Single • Artist • 2024"), so the UI can group
      // them the way YouTube Music does rather than calling everything an album.
      const parts = txt(a?.subtitle).split("•").map((p) => p.trim()).filter(Boolean);
      const kindKey = String(a?.album_type ?? a?.item_type ?? parts[0] ?? "").toLowerCase();
      return {
        token: a?.id || "",
        kind: RELEASE_KINDS[kindKey] || RELEASE_KINDS[String(parts[0]).toLowerCase()] || "Album",
        title: txt(a?.title) || "Unknown Album",
        artist: artistsOf(a) || txt(a?.author?.name ?? a?.author) || "Unknown Artist",
        year: txt(a?.year) || (parts.find((p) => /^(19|20)\d{2}$/.test(p)) || ""),
        image: thumbUrl(a),
      };
    })
    .filter((a) => a.token)
    .slice(0, 20);
}

export async function searchArtists(query) {
  const yt = await getClient();
  const res = await yt.music.search(query, { type: "artist" });
  return (res.artists?.contents ?? [])
    .map((a) => ({
      id: a?.id || "",
      name: txt(a?.name) || txt(a?.title) || "Unknown Artist",
      image: thumbUrl(a),
    }))
    .filter((a) => a.id)
    .slice(0, 12);
}

export async function searchPlaylists(query) {
  const yt = await getClient();
  const res = await yt.music.search(query, { type: "playlist" });
  return (res.playlists?.contents ?? [])
    .map((p) => ({
      browseId: p?.id || "",
      title: txt(p?.title) || "Unknown Playlist",
      author: artistsOf(p) || txt(p?.author?.name ?? p?.author) || "",
      image: thumbUrl(p),
    }))
    .filter((p) => p.browseId)
    .slice(0, 12);
}

// Typeahead for the search box.
export async function getSearchSuggestions(query) {
  const yt = await getClient();
  const sections = await yt.music.getSearchSuggestions(query);
  const out = [];
  for (const section of sections ?? []) {
    for (const item of section?.contents ?? []) {
      const t = txt(item?.suggestion);
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out.slice(0, 8);
}

/* ------------------------------ album ------------------------------ */
export async function getAlbum(token) {
  const yt = await getClient();
  const album = await yt.music.getAlbum(token);
  const header = album?.header;

  const title = txt(header?.title) || "Unknown Album";
  const image = thumbUrl(header) || thumbUrl(album?.background) || "";
  const artist =
    txt(header?.strapline_text_one) ||
    txt(header?.subtitle)?.split("•")[0]?.trim() ||
    "";
  const year = (txt(header?.subtitle).match(/\b(19|20)\d{2}\b/) || [""])[0];

  const songs = (album?.contents ?? [])
    .map((item) => mapSong(item, { artist, album: title, image }))
    .filter(Boolean)
    .map((s) => ({ ...s, album: title, image: s.image || image }));

  // "Album • 2024 • 12 songs" — the leading word is the release kind, and any
  // remaining non-numeric segments are the closest thing YouTube Music gives
  // us to genre tags.
  const subtitleParts = txt(header?.subtitle).split("•").map((p) => p.trim()).filter(Boolean);
  const kind = subtitleParts[0] || "Album";
  const tags = subtitleParts
    .slice(1)
    .filter((p) => !/^\d/.test(p) && p !== artist && !/song|track|minute|hour/i.test(p));

  // Contributors are the distinct credited artists across the track list, minus
  // the headline act — that's the "featuring" list without a separate request.
  const contributors = [...new Map(
    songs
      .flatMap((s) => String(s.artist || "").split(/,|&|feat\.|ft\.|\bx\b/i))
      .map((n) => n.trim())
      .filter((n) => n && n.toLowerCase() !== String(artist).toLowerCase())
      .map((n) => [n.toLowerCase(), n])
  ).values()].slice(0, 12);

  return {
    title,
    artist: artist || songs[0]?.artist || "Unknown Artist",
    year,
    kind,
    tags,
    contributors,
    description: richText(header?.description),
    image: image || songs[0]?.image || "",
    songs,
  };
}

/* ------------------------------ artist ------------------------------ */
const mapRelease = (i) => {
  const token = i?.id || "";
  if (!token.startsWith("MPRE")) return null;
  return {
    token,
    title: txt(i?.title) || "Unknown Album",
    year: (txt(i?.subtitle).match(/\b(19|20)\d{2}\b/) || [""])[0],
    image: thumbUrl(i),
  };
};

export async function getArtist(channelId) {
  const yt = await getClient();
  const artist = await yt.music.getArtist(channelId);
  const header = artist?.header;
  const name = txt(header?.title) || "Unknown Artist";
  const out = {
    id: channelId,
    name,
    image: thumbUrl(header) || "",
    description: richText(header?.description),
    songs: [],
    albums: [],
    singles: [],
    related: [],
  };

  for (const section of artist?.sections ?? []) {
    const title = txt(section?.header?.title).toLowerCase();
    const contents = section?.contents ?? [];
    if (!contents.length) continue;
    if (!out.songs.length && (title.includes("song") || title.includes("top"))) {
      out.songs = contents.map((i) => mapSong(i, { artist: name, artistId: channelId }))
        .filter(Boolean).slice(0, 10);
    } else if (title.includes("album")) {
      out.albums = contents.map(mapRelease).filter(Boolean).slice(0, 12);
    } else if (title.includes("single") || title.includes("ep")) {
      out.singles = contents.map(mapRelease).filter(Boolean).slice(0, 12);
    } else if (title.includes("fans") || title.includes("related") || title.includes("similar")) {
      out.related = contents
        .map((i) => ({ id: i?.id || "", name: txt(i?.title) || "", image: thumbUrl(i) }))
        .filter((a) => a.id.startsWith("UC") && a.name)
        .slice(0, 12);
    }
  }

  // some artist pages front-load a nameless shelf of songs — fall back to search
  if (!out.songs.length) {
    out.songs = (await searchSongs(name).catch(() => [])).slice(0, 10);
  }
  return out;
}

/* ------------------------------ lyrics ------------------------------ */
export async function getLyrics(videoId) {
  const yt = await getClient();
  const shelf = await yt.music.getLyrics(videoId).catch(() => null);
  return {
    lyrics: txt(shelf?.description) || "",
    source: txt(shelf?.footer) || "",
  };
}

/* --------------------------- public playlists --------------------------- */
export async function getPublicPlaylist(browseId) {
  const yt = await getClient();
  const playlistId = browseId.replace(/^VL/, "");
  const playlist = await yt.music.getPlaylist(playlistId);
  const header = playlist?.header;
  const rows = [...(playlist?.items ?? []), ...(playlist?.contents ?? [])];
  const seen = new Set();
  const songs = [];
  for (const row of rows) {
    const s = mapSong(row);
    if (s && !seen.has(s.id)) {
      seen.add(s.id);
      songs.push(s);
    }
  }
  return {
    browseId,
    title: txt(header?.title) || "Playlist",
    author: txt(header?.subtitle)?.split("•")[0]?.trim() || "",
    image: thumbUrl(header) || songs[0]?.image || "",
    songs,
  };
}

/* ------------------------- suggestions / radio ------------------------- */
// Automix "up next" — the CLI's getSuggestions; powers song radio and refills.
export async function getUpNext(videoId, limit = 20) {
  const yt = await getClient();
  const panel = await yt.music.getUpNext(videoId, true);
  const songs = [];
  for (const item of panel?.contents ?? []) {
    const s = mapSong(item);
    if (s && s.id !== videoId && s.title) songs.push(s);
    if (songs.length >= limit) break;
  }
  return songs;
}

/* ---------------------------- moods & genres ---------------------------- */
// name -> {browseId, params}, filled when stations are listed
const genreCache = new Map();
// name -> cover url ("" once we know the genre page has no usable art)
const stationArtCache = new Map();

// YT Music tags each mood/genre chip with a signed ARGB stripe colour.
const argbToHex = (n) =>
  typeof n === "number" ? `#${((n >>> 0) & 0xffffff).toString(16).padStart(6, "0")}` : "";

export async function getStations() {
  const yt = await getClient();
  try {
    const response = await yt.actions.execute("/browse", {
      browseId: "FEmusic_moods_and_genres",
      client: "YTMUSIC",
    });
    const tabs = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs;
    const contents = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
    const stations = [];
    for (const section of contents) {
      for (const item of section.gridRenderer?.items ?? []) {
        const btn = item.musicNavigationButtonRenderer;
        if (!btn) continue;
        const name = btn.buttonText?.runs?.[0]?.text;
        const browseId = btn.clickCommand?.browseEndpoint?.browseId;
        const params = btn.clickCommand?.browseEndpoint?.params;
        if (name && browseId) {
          genreCache.set(name, { browseId, params });
          stations.push({
            name,
            color: argbToHex(btn.solid?.leftStripeColor),
            image: stationArtCache.get(name) || "",
          });
        }
      }
    }
    if (stations.length) return stations.slice(0, 28);
  } catch { /* fall through */ }
  return ["Pop", "Rock", "Hip-Hop", "Chill", "Focus", "Workout", "Party", "Sleep"]
    .map((name) => ({ name, color: "", image: stationArtCache.get(name) || "" }));
}

// Cover art for stations: the first release/playlist cover on the genre's page.
// One upstream /browse per station, so results are cached for the process and
// resolved a few at a time — callers ask only for the stations they render.
export async function getStationArt(names) {
  if (!genreCache.size) await getStations();

  const out = {};
  const todo = [];
  for (const name of names) {
    if (stationArtCache.has(name)) out[name] = stationArtCache.get(name);
    else if (genreCache.has(name)) todo.push(name);
  }

  const worker = async () => {
    while (todo.length) {
      const name = todo.shift();
      const url = await resolveStationArt(name).catch(() => "");
      stationArtCache.set(name, url);
      out[name] = url;
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, todo.length) }, worker));
  return out;
}

async function resolveStationArt(name) {
  const genre = genreCache.get(name);
  if (!genre) return "";
  const yt = await getClient();
  const payload = { browseId: genre.browseId, client: "YTMUSIC" };
  if (genre.params) payload.params = genre.params;
  const response = await yt.actions.execute("/browse", payload);
  const contents =
    response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
      ?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];

  for (const section of contents) {
    const items =
      section.musicCarouselShelfRenderer?.contents ||
      section.musicShelfRenderer?.contents ||
      section.gridRenderer?.items ||
      [];
    for (const item of items) {
      const thumbs =
        item.musicTwoRowItemRenderer?.thumbnailRenderer?.musicThumbnailRenderer
          ?.thumbnail?.thumbnails;
      const url = thumbs?.[thumbs.length - 1]?.url;
      if (url) return url;
    }
  }
  return "";
}

// First batch for a genre station: resolve the genre page to a playlist and
// pull its tracks (CLI's getGenrePlaylists + getReleaseTracks).
export async function getGenreTracks(name) {
  const genre = genreCache.get(name);
  if (!genre) return [];
  const yt = await getClient();
  try {
    const payload = { browseId: genre.browseId, client: "YTMUSIC" };
    if (genre.params) payload.params = genre.params;
    const response = await yt.actions.execute("/browse", payload);
    const contents =
      response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];

    const browseIds = [];
    for (const section of contents) {
      const items =
        section.musicCarouselShelfRenderer?.contents ||
        section.musicShelfRenderer?.contents ||
        section.gridRenderer?.items ||
        [];
      for (const item of items) {
        const renderer = item.musicTwoRowItemRenderer;
        const browseId = renderer?.navigationEndpoint?.browseEndpoint?.browseId;
        if (browseId) browseIds.push(browseId);
      }
    }

    for (const browseId of browseIds.slice(0, 3)) {
      const tracks = await getReleaseTracks(browseId).catch(() => []);
      if (tracks.length >= 5) return tracks;
    }
  } catch { /* fall through */ }
  return [];
}

export async function getReleaseTracks(browseId) {
  const yt = await getClient();
  if (browseId.startsWith("MPREb")) {
    return (await getAlbum(browseId)).songs;
  }
  const playlistId = browseId.replace(/^VL/, "");
  const playlist = await yt.music.getPlaylist(playlistId);
  const rows = [...(playlist?.items ?? []), ...(playlist?.contents ?? [])];
  const seen = new Set();
  const songs = [];
  for (const row of rows) {
    const s = mapSong(row);
    if (s && !seen.has(s.id)) {
      seen.add(s.id);
      songs.push(s);
    }
  }
  return songs;
}

/* ------------------------------ trending ------------------------------ */
// Explore mixes loose tracks and MPRE releases into the same shelves, so a
// release id must never be mapped as a song (and vice versa).
const isReleaseId = (id = "") => id.startsWith("MPRE");

const RELEASE_KINDS = { album: "Album", ep: "EP", single: "Single" };

// A release card off an Explore/genre shelf: "Album • Artist • 2024".
function mapExploreRelease(item) {
  const token = item?.id || "";
  if (!isReleaseId(token)) return null;
  const parts = txt(item?.subtitle).split("•").map((p) => p.trim()).filter(Boolean);
  const kindKey = String(item?.album_type ?? item?.item_type ?? parts[0] ?? "").toLowerCase();
  return {
    token,
    kind: RELEASE_KINDS[kindKey] || RELEASE_KINDS[String(parts[0]).toLowerCase()] || "Album",
    title: txt(item?.title) || "Unknown Release",
    artist:
      artistsOf(item) ||
      parts.find((p) => !RELEASE_KINDS[p.toLowerCase()] && !/^(19|20)\d{2}$/.test(p)) ||
      "",
    year: txt(item?.year) || (parts.find((p) => /^(19|20)\d{2}$/.test(p)) || ""),
    image: thumbUrl(item),
  };
}

// Explore, split by shape: the loose tracks become one "Trending Singles"
// playlist in the UI, the MPRE cards sit beside it as albums/EPs/singles.
export async function getTrending() {
  const yt = await getClient();
  try {
    const explore = await yt.music.getExplore();
    const sections = explore?.sections ?? [];

    const trending =
      sections.find((s) => txt(s?.header?.title).toLowerCase().includes("trending")) ||
      sections.find((s) => (s?.contents ?? []).some((i) => i?.video_id));

    const seenSongs = new Set();
    const singles = [];
    for (const item of trending?.contents ?? []) {
      const s = mapSong(item);
      if (!s || isReleaseId(s.id) || seenSongs.has(s.id)) continue;
      seenSongs.add(s.id);
      singles.push(s);
    }

    // "New albums & singles", "New releases", … — every release Explore surfaces
    const seenReleases = new Set();
    const releases = [];
    for (const section of sections) {
      for (const item of section?.contents ?? []) {
        const r = mapExploreRelease(item);
        if (!r || seenReleases.has(r.token)) continue;
        seenReleases.add(r.token);
        releases.push(r);
      }
    }

    return { singles: singles.slice(0, 30), releases: releases.slice(0, 20) };
  } catch {
    return { singles: [], releases: [] };
  }
}

/* ------------------------------ streaming ------------------------------ */
// yt-dlp resolves a direct googlevideo URL (Range-capable, IP-bound to this
// server). Quality maps like the CLI's low/medium/high stream settings.
let ytdlpBin = null;
function findYtdlp() {
  if (ytdlpBin) return ytdlpBin;
  const candidates = [
    process.env.YTDLP_PATH,
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Links", "yt-dlp.exe"),
  ].filter(Boolean);
  // winget installs land in versioned package dirs that aren't on a freshly
  // started process's PATH — scan for them so a server boot right after
  // install still finds the binary.
  try {
    const packages = path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Packages");
    for (const dir of fs.readdirSync(packages)) {
      if (dir.startsWith("yt-dlp.yt-dlp_")) {
        candidates.push(path.join(packages, dir, "yt-dlp.exe"));
      }
    }
  } catch { /* not a winget machine */ }

  ytdlpBin = candidates.find((c) => fs.existsSync(c)) || "yt-dlp"; // last resort: PATH
  return ytdlpBin;
}

const FORMATS = {
  low: "worstaudio/worst",
  medium: "bestaudio[abr<=132]/bestaudio/best",
  high: "bestaudio/best",
  // Sonos can't play webm/opus (YouTube's usual bestaudio) — pin AAC/m4a
  sonos: "bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio/best",
};

/* ------------------------------ downloads ------------------------------ */
async function ffmpegLocation() {
  try {
    return (await import("ffmpeg-static")).default || null;
  } catch {
    return null;
  }
}

const LOSSLESS_RE = /flac|alac|pcm|wav|aiff/i;
const isAudioOnly = (f) =>
  f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none");

// List the source's real audio formats, lossless first if any exist.
export function listFormats(videoId) {
  if (!/^[\w-]{6,20}$/.test(videoId)) {
    return Promise.reject(new Error("invalid video id"));
  }
  return new Promise((resolve, reject) => {
    execFile(
      findYtdlp(),
      ["-J", "--no-warnings", "--no-playlist", `https://www.youtube.com/watch?v=${videoId}`],
      { timeout: 45000, windowsHide: true, maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const detail = String(stderr || err.message).split(/\r?\n/).filter(Boolean).pop() || "unknown error";
          return reject(new Error(`yt-dlp: ${detail.slice(0, 200)}`));
        }
        let info;
        try { info = JSON.parse(stdout); } catch { return reject(new Error("yt-dlp returned invalid JSON")); }
        const formats = (info.formats || [])
          .filter(isAudioOnly)
          .map((f) => ({
            id: String(f.format_id),
            ext: f.ext || "",
            codec: String(f.acodec || "").split(".")[0],
            abr: Math.round(f.abr || f.tbr || 0),
            size: f.filesize || f.filesize_approx || 0,
            lossless: LOSSLESS_RE.test(String(f.acodec || "")),
            note: f.format_note || "",
          }))
          // lossless first (the point of the search), then highest bitrate
          .sort((a, b) => (b.lossless - a.lossless) || (b.abr - a.abr));
        resolve({ formats, hasLossless: formats.some((f) => f.lossless) });
      }
    );
  });
}

// Download a track: either a native format as-is (fmt = yt-dlp format id) or
// converted via ffmpeg (fmt = "flac" | "mp3"), with tags + cover art embedded.
export async function downloadAudio(videoId, fmt) {
  if (!/^[\w-]{6,20}$/.test(videoId)) throw new Error("invalid video id");
  if (!/^[\w.+-]{1,20}$/.test(fmt)) throw new Error("invalid format");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "marusic-dl-"));
  const args = ["--no-warnings", "--no-playlist", "-o", path.join(dir, "audio.%(ext)s")];

  const ffmpeg = await ffmpegLocation();
  if (ffmpeg) args.push("--ffmpeg-location", ffmpeg);

  if (fmt === "flac" || fmt === "mp3") {
    if (!ffmpeg) throw new Error(`converting to ${fmt} requires ffmpeg`);
    args.push("-f", "bestaudio", "--extract-audio", "--audio-format", fmt, "--audio-quality", "0");
    // 16-bit is already beyond the lossy source's fidelity; without this
    // ffmpeg pads FLAC to 24/32-bit and the file balloons for nothing
    if (fmt === "flac") args.push("--postprocessor-args", "ExtractAudio:-sample_fmt s16");
    args.push("--embed-metadata", "--embed-thumbnail");
  } else {
    args.push("-f", fmt);
    if (ffmpeg) args.push("--embed-metadata");
  }
  args.push(`https://www.youtube.com/watch?v=${videoId}`);

  try {
    await new Promise((resolve, reject) => {
      execFile(
        findYtdlp(),
        args,
        { timeout: 300000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
        (err, _stdout, stderr) => {
          if (err) {
            const detail = String(stderr || err.message).split(/\r?\n/).filter(Boolean).pop() || "unknown error";
            return reject(new Error(`yt-dlp: ${detail.slice(0, 200)}`));
          }
          resolve();
        }
      );
    });
    const file = fs.readdirSync(dir).find((f) => f.startsWith("audio."));
    if (!file) throw new Error("download produced no file");
    return { dir, filePath: path.join(dir, file), ext: file.split(".").pop() };
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw err;
  }
}

// Resolve a playable URL *and the headers it must be fetched with*. yt-dlp
// reports http_headers per format for a reason: googlevideo validates the
// request against the client yt-dlp negotiated and answers a mismatch with
// 403. Substituting our own User-Agent was tolerated from some addresses
// and refused from others — a miserable bug to chase — so use what yt-dlp
// hands us instead of inventing headers of our own.
export function getStreamSource(videoId, quality = "high", { ipv4 = false } = {}) {
  if (!/^[\w-]{6,20}$/.test(videoId)) {
    return Promise.reject(new Error("invalid video id"));
  }
  const format = FORMATS[quality] ?? FORMATS.high;
  return new Promise((resolve, reject) => {
    execFile(
      findYtdlp(),
      [
        // Only this resolve needs pinning: it is the one place a googlevideo
        // URL is handed to a different HTTP client (our fetch) instead of
        // being downloaded by yt-dlp itself. Google mints the URL for the
        // address that asked, so the two legs must agree. Either the
        // deployment asked for IPv4 up front, or the caller is retrying after
        // a refusal that looks like a split egress.
        ...(config.forceIpv4 || ipv4 ? ["-4"] : []),
        "-f", format,
        // two lines out: the URL, then the headers it needs, as JSON.
        // Lighter than -J, which dumps the entire info dict.
        "--print", "%(url)s",
        "--print", "%(http_headers)j",
        "--no-warnings",
        "--no-playlist",
        `https://www.youtube.com/watch?v=${videoId}`,
      ],
      // 90s, not 45: YouTube now makes yt-dlp work harder per resolve, and a
      // NAS CPU is slower than a desktop. A killed resolve surfaces as a 500
      // with a bare "Command failed", which is a miserable thing to debug.
      { timeout: 90000, windowsHide: true, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const detail = String(stderr || err.message).split(/\r?\n/).filter(Boolean).pop() || "unknown error";
          return reject(new Error(`yt-dlp: ${detail.slice(0, 200)}`));
        }
        const [url, headerJson] = String(stdout).trim().split(/\r?\n/);
        if (!url || !url.startsWith("http")) {
          return reject(new Error("yt-dlp returned no stream URL"));
        }
        let headers;
        try { headers = JSON.parse(headerJson); } catch {}
        // a missing header line is survivable — an older yt-dlp may not
        // print one — but our own UA is a guess, so it is only a fallback
        resolve({ url, headers: headers && typeof headers === "object" ? headers : { "User-Agent": UA } });
      }
    );
  });
}

/* ==========================================================================
   Marusic — Spotify-style player on top of music-cli's JioSaavn backend
   ========================================================================== */
"use strict";

/* ---------------- icons ---------------- */
const I = {
  home: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 3.25a.75.75 0 0 0-1 0L4 9.72V21a1 1 0 0 0 1 1h5v-7h4v7h5a1 1 0 0 0 1-1V9.72z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>',
  radio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="14" r="7"/><circle cx="12" cy="14" r="2.5" fill="currentColor" stroke="none"/><path d="m6 6 10-3.5"/></svg>',
  library: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 22V2h2v20zm5 0V2h2v20zm5.4-19.6 6.53 18.3-1.88.68L11.5 3.07z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 3h2v8h8v2h-8v8h-2v-8H3v-2h8z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.3a.8.8 0 0 1 1.2-.7l13 7.7a.8.8 0 0 1 0 1.4l-13 7.7A.8.8 0 0 1 7 19.7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h2v16H6zm14 .6v14.8a.7.7 0 0 1-1.1.58L9 12.6a.72.72 0 0 1 0-1.2l9.9-7.38A.7.7 0 0 1 20 4.6z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 4h2v16h-2zM4 4.6v14.8a.7.7 0 0 0 1.1.58L15 12.6a.72.72 0 0 0 0-1.2L5.1 4.02A.7.7 0 0 0 4 4.6z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 4h4v4h-2V7.4l-4.2 4.2-1.4-1.4L18.6 6H16V4zM2 6h5.5l3 3-1.4 1.4L6.7 8H2zm14.6 10H14l-2.5-2.5 1.4-1.4 2 1.9H18v-1.6l4 3.1-4 3.1V16zM2 18v-2h4.7l8-8H20v2h-4.5l-8 8z" fill-rule="evenodd"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20.7C7 16.6 3 13.2 3 9.3 3 6.4 5.2 4.5 7.7 4.5c1.7 0 3.3.9 4.3 2.4a5.2 5.2 0 0 1 4.3-2.4c2.5 0 4.7 1.9 4.7 4.8 0 3.9-4 7.3-9 11.4z"/></svg>',
  heartFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.7C7 16.6 3 13.2 3 9.3 3 6.4 5.2 4.5 7.7 4.5c1.7 0 3.3.9 4.3 2.4a5.2 5.2 0 0 1 4.3-2.4c2.5 0 4.7 1.9 4.7 4.8 0 3.9-4 7.3-9 11.4z"/></svg>',
  queue: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18v2H3zm0 6h12v2H3zm0 6h12v2H3zm15-3v8l6-4z"/></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l6 5V4L8 9zm12.5 3a3.5 3.5 0 0 0-2-3.2v6.4a3.5 3.5 0 0 0 2-3.2zm-2-7.7v2.1a5.5 5.5 0 0 1 0 11.2v2.1a7.5 7.5 0 0 0 0-15.4z"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l6 5V4L8 9zm14.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L5.8 19l-1.4-1.4L10 12 4.4 6.4z"/></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m15 4-8 8 8 8"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 4 8 8-8 8"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 19.5a3.5 3.5 0 1 1-2-3.15V5l12-2.5V16a3.5 3.5 0 1 1-2-3.15V6.9L9 8.9z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6l1 2h4v2H4V5h4zM6 8h12l-1 13H7z"/></svg>',
  addQueue: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18v2H3zm0 6h10v2H3zm0 6h10v2H3zm15 0v-3h2v3h3v2h-3v3h-2v-3h-3v-2z"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 20h4l10.5-10.5-4-4L4 16zm14.9-12.9 1.6-1.6a1 1 0 0 0 0-1.4l-2.6-2.6a1 1 0 0 0-1.4 0l-1.6 1.6z"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 3h2v9.6l3.3-3.3 1.4 1.4-5.7 5.7-5.7-5.7 1.4-1.4L11 12.6zM4 19h16v2H4z"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 0 0-7 0v5A3.5 3.5 0 0 0 12 15zm5.5-3.5a5.5 5.5 0 0 1-11 0H4.6a7.4 7.4 0 0 0 6.4 7.33V21h2v-2.17a7.4 7.4 0 0 0 6.4-7.33z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.4 10.7 7.2-4.2 1 1.74-7.2 4.2zm0 2.6 7.2 4.2 1-1.74-7.2-4.2z"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 16V6.4L7.7 9.7 6.3 8.3 12 2.6l5.7 5.7-1.4 1.4L13 6.4V16zM4 19h16v2H4z"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z"/></svg>',
  group: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 11a3.6 3.6 0 1 0-3.6-3.6A3.6 3.6 0 0 0 9 11zm7 .4a3 3 0 1 0-3-3 3 3 0 0 0 3 3zM9 13c-3.6 0-6.5 1.8-6.5 4.1V19h13v-1.9C15.5 14.8 12.6 13 9 13zm7 .5c-.6 0-1.2.06-1.75.18a5.3 5.3 0 0 1 2.75 4.42V19h4.5v-1.4c0-2.3-2.4-4.1-5.5-4.1z"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m4 9 8 8 8-8"/></svg>',
  cast: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z"/></svg>',
  castOn: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm18-3H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7z"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-5 2.6a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM12 20a5.2 5.2 0 1 1 0-10.4A5.2 5.2 0 0 1 12 20zm0-8.3a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2z"/></svg>',
  airplay: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h4.6l1.7-2H3V5h18v11h-6.3l1.7 2H21a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-9 11-6.5 8h13z"/></svg>',
  tv: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5v2h8v-2h5a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 14H3V5h18v12z"/></svg>',
  /* content-type marks — see TYPES */
  stack: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4zm12 .5v5l4.5-2.5z"/></svg>',
  disc: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 7.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z"/></svg>',
  sleeve: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm3 0v18H5V3zm6 4.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6zm0 3.4a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8z"/></svg>',
  waves: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5 14 9l6.5 2-6.5 2-2 6.5-2-6.5L3.5 11 10 9zm7 11.5.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h7v2H6v5H4zm9 0h7v7h-2V6h-5zm5 9h2v7h-7v-2h5zM4 13h2v5h5v2H4z"/></svg>',
  collapse: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 4h2v7H4V9h5zm4 0h2v5h5v2h-7zm7 9v2h-5v5h-2v-7zM4 13h7v7H9v-5H4z"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M6 3.8h12a1 1 0 0 1 1 1v15.4l-7-4.2-7 4.2V4.8a1 1 0 0 1 1-1z"/></svg>',
  bookmarkFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12a1 1 0 0 1 1 1v16.5l-7-4.2-7 4.2V4a1 1 0 0 1 1-1z"/></svg>',
  thumbUp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 10h4v11H2zm6 0 4.6-8a1 1 0 0 1 1.85.7L13.4 8.6H20a2 2 0 0 1 1.95 2.44l-1.7 7.5A2.4 2.4 0 0 1 17.9 20.5H8z"/></svg>',
  thumbDown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 14h-4V3h4zm-6 0-4.6 8a1 1 0 0 1-1.85-.7l1.05-5.9H4a2 2 0 0 1-1.95-2.44l1.7-7.5A2.4 2.4 0 0 1 6.1 3.5H16z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/></svg>',
  rows: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 4h18v4H3zm0 6h18v4H3zm0 6h18v4H3z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m14.5 2.1 7.4 7.4-1.5 1.5-1.2-.4-3.6 3.6.5 3.6-1.5 1.5-4.1-4.1L4.6 21 3 19.4l5.8-5.9-4.1-4.1L6.2 7.9l3.6.5L13.4 4.8l-.4-1.2z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4c5.1 0 9.3 3.3 11 8-1.7 4.7-5.9 8-11 8S2.7 16.7 1 12c1.7-4.7 5.9-8 11-8zm0 3.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.1 3.5 3.5 2.1l18.4 18.4-1.4 1.4-3.3-3.3A11 11 0 0 1 12 20C6.9 20 2.7 16.7 1 12a13 13 0 0 1 4-5.4zM12 4c5.1 0 9.3 3.3 11 8a13.2 13.2 0 0 1-3.3 4.8L8.6 5.7A11 11 0 0 1 12 4z"/></svg>',
  drag: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.6 16.6 4.8 11.8l1.4-1.4 3.4 3.4 8-8L19 7.2z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.4l3.4 2"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z"/></svg>',
  userPlus: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 12a4.4 4.4 0 1 0-4.4-4.4A4.4 4.4 0 0 0 10 12zm0 2c-4.2 0-7.5 2.1-7.5 4.8V21h15v-2.2C17.5 16.1 14.2 14 10 14zm9-8h2v3h3v2h-3v3h-2v-3h-3V9h3z"/></svg>',
};

/* ---------------- utils ---------------- */
const $ = (sel) => document.querySelector(sel);

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const fmtTime = (sec) => {
  sec = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const fmtBytes = (n) => {
  if (!n) return "";
  const mb = n / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
};

const fmtTotal = (songs) => {
  const total = songs.reduce((a, s) => a + (Number(s.duration) || 0), 0);
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
};

function toast(msg, isError = false) {
  const el = document.createElement("div");
  el.className = `toast${isError ? " error" : ""}`;
  el.textContent = msg;
  $("#toast-wrap").appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// `icon` lets an empty cover fall back to its content type's glyph rather than
// a generic note, so a missing image still tells you what the thing is.
const artImg = (src, cls = "", icon = I.note) =>
  src
    ? `<img class="${cls}" loading="lazy" src="${esc(src)}" alt="">`
    : `<div class="${cls} art-placeholder">${icon}</div>`;

/* ---------------- api ---------------- */
function ensureSession(res) {
  // session expired mid-use → back to the sign-in screen
  if (res.status === 401) {
    location.replace("/login.html");
    throw new Error("signed out");
  }
  return res;
}

const api = {
  async get(url) {
    const res = ensureSession(await fetch(url));
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  },
  async send(method, url, body) {
    const res = ensureSession(await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }));
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  },
  search: (q) => api.get(`/api/search?q=${encodeURIComponent(q)}`),
  suggest: (q) => api.get(`/api/suggest?q=${encodeURIComponent(q)}`),
  album: (token) => api.get(`/api/album/${encodeURIComponent(token)}`),
  artist: (id) => api.get(`/api/artist/${encodeURIComponent(id)}`),
  lyrics: (id) => api.get(`/api/lyrics/${encodeURIComponent(id)}`),
  publicPlaylist: (browseId) => api.get(`/api/playlist/${encodeURIComponent(browseId)}`),
  mixes: () => api.get("/api/mixes"),
  quickPicks: () => api.get("/api/quickpicks"),
  reco: (id) => api.get(`/api/reco/${encodeURIComponent(id)}`),
  radioStations: () => api.get("/api/radio/stations"),
  stationArt: (names) => api.send("POST", "/api/radio/art", { names }),
  radioQueue: (name, next, seed = "") =>
    api.get(`/api/radio/queue?name=${encodeURIComponent(name)}&next=${next}&seed=${encodeURIComponent(seed)}`),
  formats: (id) => api.get(`/api/formats/${encodeURIComponent(id)}`),
  library: () => api.get("/api/library"),
  saveHistory: (song) => api.send("POST", "/api/history", { song }),
  toggleLike: (song) => api.send("POST", "/api/liked/toggle", { song }),
  createPlaylist: (name) => api.send("POST", "/api/playlists", { name }),
  renamePlaylist: (id, name) => api.send("PUT", `/api/playlists/${id}`, { name }),
  deletePlaylist: (id) => api.send("DELETE", `/api/playlists/${id}`),
  addToPlaylist: (id, song) => api.send("POST", `/api/playlists/${id}/songs`, { song }),
  removeFromPlaylist: (id, songId) =>
    api.send("DELETE", `/api/playlists/${id}/songs/${encodeURIComponent(songId)}`),
  reorderPlaylist: (id, ids) => api.send("PUT", `/api/playlists/${id}/order`, { ids }),
  sharePlaylist: (id) => api.send("POST", `/api/playlists/${id}/share`),
  shareState: (id) => api.get(`/api/playlists/${id}/share`),
  revokeShare: (id) => api.send("DELETE", `/api/playlists/${id}/share`),
  shared: (token) => api.get(`/api/shared/${encodeURIComponent(token)}`),
  copyShared: (token) => api.send("POST", `/api/shared/${encodeURIComponent(token)}/copy`),
  importPlaylist: (name, songs) => api.send("POST", "/api/playlists/import", { name, songs }),
  toggleSave: (song) => api.send("POST", "/api/saves/toggle", { song }),
  clearSaves: () => api.send("DELETE", "/api/saves"),
  topPlayed: () => api.get("/api/top-played?limit=60"),
  friends: () => api.get("/api/friends"),
  findMembers: (q) => api.get(`/api/friends/search?q=${encodeURIComponent(q)}`),
  addFriend: (id) => api.send("POST", `/api/friends/${id}`),
  removeFriend: (id) => api.send("DELETE", `/api/friends/${id}`),
  toggleAlbum: (album) => api.send("POST", "/api/albums/toggle", { album }),
  toggleArtist: (artist) => api.send("POST", "/api/artists/toggle", { artist }),
  changeName: (name) => api.send("POST", "/api/account/name", { name }),
  changePassword: (current, next) => api.send("POST", "/api/account/password", { current, next }),
  jamState: () => api.get("/api/jam"),
  jamTime: () => api.get("/api/jam/time"),
  jamCreate: (seed, mode) =>
    api.send("POST", "/api/jam", { ...seed, mode, deviceId: jamDeviceId() }),
  jamSpeaker: () => api.send("POST", "/api/jam/speaker", { deviceId: jamDeviceId() }),
  jamPeek: (code) => api.get(`/api/jam/peek/${encodeURIComponent(code)}`),
  jamJoin: (code) => api.send("POST", "/api/jam/join", { code }),
  jamLeave: () => api.send("POST", "/api/jam/leave"),
  jamEnd: () => api.send("POST", "/api/jam/end"),
  jamKick: (userId) => api.send("POST", "/api/jam/kick", { userId }),
  jamSettings: (patch) => api.send("POST", "/api/jam/settings", patch),
  jamAdd: (songs) => api.send("POST", "/api/jam/queue", { songs }),
  jamRemove: (i) => api.send("DELETE", `/api/jam/queue/${i}`),
  jamPlay: (index) => api.send("POST", "/api/jam/play", index == null ? {} : { index }),
  jamPause: () => api.send("POST", "/api/jam/pause"),
  jamSeek: (pos) => api.send("POST", "/api/jam/seek", { pos }),
  jamNext: () => api.send("POST", "/api/jam/next"),
  jamPrev: () => api.send("POST", "/api/jam/prev"),
  jamEnded: (index) => api.send("POST", "/api/jam/ended", { index, deviceId: jamDeviceId() }),
  castToken: () => api.send("POST", "/api/cast/token"),
  sonosDevices: (fresh) => api.get(`/api/sonos/devices${fresh ? "?fresh=1" : ""}`),
  sonosPlay: (ip, song, pos) => api.send("POST", "/api/sonos/play", { ip, song, pos }),
  sonosNextUri: (ip, song) => api.send("POST", "/api/sonos/next-uri", { ip, song }),
  sonosControl: (ip, action, extra) =>
    api.send("POST", "/api/sonos/control", { ip, action, ...extra }),
  sonosStatus: (ip) => api.get(`/api/sonos/status?ip=${encodeURIComponent(ip)}`),
};

/* ---------------- state ---------------- */
const state = {
  user: null,
  library: { playlists: [], liked: [], history: [], albums: [], artists: [], saves: [] },
  autoplay: localStorage.getItem("autoplay") !== "off", // radio-style continuation
  queue: [],
  qIndex: -1,
  current: null,
  shuffle: false,
  order: null, // shuffled index order, pos points into it
  pos: 0,
  repeat: "off", // off | all | one
  radio: null, // { name, next }
  insertAt: 0, // "add to queue" insertion pointer
  quality: ["low", "medium", "high"].includes(localStorage.getItem("quality"))
    ? localStorage.getItem("quality")
    : "high",
  searchQ: "",
  failStreak: 0,
  radioFetching: false,
  jam: null, // active jam session — playback is slaved to the server while set
  resumeAt: 0, // restored-but-not-yet-played position (handed to Cast if asked)
};

const likedIds = () => new Set(state.library.liked.map((s) => s.id));
const savedIds = () => new Set((state.library.saves || []).map((s) => s.id));
const savedAlbumTokens = () => new Set(state.library.albums.map((a) => a.token));
const followedIds = () => new Set(state.library.artists.map((a) => a.id));


/* ---------------- audio engine ---------------- */
const audio = new Audio();
audio.preload = "auto";

const streamSrc = (song) =>
  `/api/stream/${encodeURIComponent(song.id)}?q=${state.quality}`;

/* ---- playback persistence: survive a reload with queue + position ---- */
let lastStateSave = 0;

function savePlayerState(force = false) {
  if (state.jam) return; // jam playback is server-owned; keep the local queue intact
  if (!force && Date.now() - lastStateSave < 5000) return;
  lastStateSave = Date.now();
  try {
    // never *clear* here: a tab that unloads before playing anything (or a
    // failed init) must not wipe state another session saved. Logout clears.
    if (!state.queue.length || state.qIndex < 0) return;
    // radio queues grow without bound — persist a window around the cursor
    let { queue, qIndex, order, pos } = state;
    if (queue.length > 300) {
      const from = Math.max(0, qIndex - 50);
      queue = queue.slice(from, from + 300);
      qIndex -= from;
      order = null; // window shifted; a saved shuffle order would misindex
    }
    localStorage.setItem("player", JSON.stringify({
      queue, qIndex, order, opos: pos,
      time: playerTime(),
      shuffle: state.shuffle,
      repeat: state.repeat,
      radio: state.radio,
    }));
  } catch { /* quota — playback state is a nicety, not critical */ }
}

function restorePlayerState() {
  let st;
  try { st = JSON.parse(localStorage.getItem("player") || "null"); } catch { return; }
  if (!st || !Array.isArray(st.queue) || !st.queue[st.qIndex]) return;
  state.queue = st.queue;
  state.qIndex = st.qIndex;
  state.current = st.queue[st.qIndex];
  state.shuffle = !!st.shuffle;
  state.order = Array.isArray(st.order) ? st.order : null;
  state.pos = st.opos || 0;
  state.repeat = st.repeat === "all" || st.repeat === "one" ? st.repeat : "off";
  state.radio = st.radio || null;
  state.insertAt = st.qIndex + 1;
  // don't hit the stream proxy (a yt-dlp resolve) until the user presses play
  audio.preload = "none";
  audio.src = streamSrc(state.current);
  const resumeAt = Number(st.time) || 0;
  if (resumeAt) {
    state.resumeAt = resumeAt;
    audio.addEventListener("loadedmetadata", () => { audio.currentTime = resumeAt; }, { once: true });
    if (state.current.duration) {
      $("#time-cur").textContent = fmtTime(resumeAt);
      $("#time-dur").textContent = fmtTime(state.current.duration);
      const pct = (resumeAt / state.current.duration) * 100;
      $("#progress-fill").style.width = `${pct}%`;
      $("#progress-knob").style.left = `${pct}%`;
    }
  }
  audio.addEventListener("play", () => { audio.preload = "auto"; state.resumeAt = 0; }, { once: true });
  updateNowPlaying();
  setMediaSession(state.current);
  applyShuffleRepeatUI();
}

window.addEventListener("pagehide", () => savePlayerState(true));

function playQueue(songs, index = 0, opts = {}) {
  if (!songs.length) return;
  // in a jam you don't hijack everyone's player — the pick joins the queue
  if (inJam()) return jamAddSongs([songs[index]]);
  state.queue = songs.slice();
  state.radio = opts.radio || null;
  state.insertAt = 0;
  if (state.shuffle && !state.radio) buildShuffleOrder(index);
  else { state.order = null; }
  loadTrack(index, true);
}

/* Play one track and let YouTube Music's own "up next" decide the rest —
   picking a song out of a list of search results means "play this", not "play
   these thirty things I was only scanning". The track starts immediately and
   the continuation lands a moment later; autoplay would fetch the same songs
   at the end of the track anyway, so an empty result is harmless. */
async function playSongRadio(song) {
  if (!song) return;
  if (inJam()) return playQueue([song], 0);
  playQueue([song], 0);
  let related = [];
  try {
    related = await api.reco(song.id);
  } catch { /* the track is already playing; autoplay retries later */ }
  // Bail if the listener moved on to something else while that was in flight.
  if (!Array.isArray(related) || state.current?.id !== song.id || state.queue.length !== 1) return;
  const fresh = related.filter((s) => s.id !== song.id && !hiddenTracks.has(s.id))
    .map((s) => ({ ...s, auto: true }));
  if (!fresh.length) return;
  state.queue.push(...fresh);
  if (state.order) state.order.push(...fresh.map((_, k) => 1 + k));
  renderQueuePanel();
  savePlayerState(true);
}

function buildShuffleOrder(startIdx) {
  const rest = [...state.queue.keys()].filter((i) => i !== startIdx);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  state.order = [startIdx, ...rest];
  state.pos = 0;
}

// bookkeeping once queue index `i` becomes the current track, however it
// started sounding (local audio, Chromecast load, or a Sonos self-advance)
function markTrackCurrent(i, song) {
  state.qIndex = i;
  state.current = song;
  state.resumeAt = 0;
  state.insertAt = Math.max(state.insertAt, i + 1);
  if (state.order) state.pos = state.order.indexOf(i);
  updateNowPlaying();
  renderQueuePanel();
  highlightPlayingRow();
  api.saveHistory(song).catch(() => {});
  state.library.history = [
    song,
    ...state.library.history.filter((s) => s.id !== song.id),
  ].slice(0, 100);
  setMediaSession(song);
  savePlayerState(true);
  if (!$("#lyrics-panel").classList.contains("hidden")) renderLyricsPanel();
  // Prefetch more radio songs when the queue is running low
  if (state.radio && i >= state.queue.length - 3) fetchMoreRadio();
}

function loadTrack(i, autoplay) {
  const song = state.queue[i];
  if (!song) return;
  if (castActive() || sonosActive()) {
    // the remote device does the playing; keep the local element pointed at
    // the track but idle, so handing the audio back later is seamless
    audio.preload = "none";
    audio.src = streamSrc(song);
    if (castActive()) castLoad(song, 0, autoplay);
    else sonosLoad(song, 0, autoplay);
  } else {
    audio.src = streamSrc(song);
    if (autoplay) audio.play().catch(() => {});
  }
  markTrackCurrent(i, song);
}

function computeNextIndex() {
  if (!state.queue.length) return -1;
  // A per-track repeat flag wins once, then clears itself — "play that again"
  // rather than "loop this forever".
  const cur = state.queue[state.qIndex];
  if (cur && queueFlags.get(cur.id)?.repeat) {
    const flags = queueFlags.get(cur.id);
    queueFlags.set(cur.id, { ...flags, repeat: false });
    renderQueuePanel();
    return state.qIndex;
  }
  if (state.order) {
    if (state.pos + 1 < state.order.length) return state.order[state.pos + 1];
    return state.repeat === "all" ? state.order[0] : -1;
  }
  if (state.qIndex + 1 < state.queue.length) return state.qIndex + 1;
  return state.repeat === "all" ? 0 : -1;
}

async function next() {
  if (inJam()) return jamControl(api.jamNext);
  let ni = computeNextIndex();
  if (ni === -1 && state.radio) {
    await fetchMoreRadio();
    ni = computeNextIndex();
  }
  // Autoplay: extend the queue with related songs instead of going silent
  if (ni === -1 && state.autoplay && state.repeat === "off" && state.current) {
    await fetchAutoplay();
    ni = computeNextIndex();
  }
  if (ni === -1) return; // end of queue
  loadTrack(ni, true);
}

async function fetchAutoplay() {
  if (state.autoplayFetching) return;
  state.autoplayFetching = true;
  try {
    const songs = await api.reco(state.current.id);
    const have = new Set(state.queue.map((s) => s.id));
    // Tracks the listener hid never come back through autoplay.
    const fresh = songs.filter((s) => !have.has(s.id) && !hiddenTracks.has(s.id))
      .map((s) => ({ ...s, auto: true }));
    if (fresh.length) {
      const start = state.queue.length;
      state.queue.push(...fresh);
      // a finished shuffle order continues in play order through the new songs
      if (state.order) state.order.push(...fresh.map((_, k) => start + k));
      renderQueuePanel();
      savePlayerState(true);
    }
  } catch { /* recommendations are best-effort */ } finally {
    state.autoplayFetching = false;
  }
}

function prev() {
  if (inJam()) return jamControl(api.jamPrev);
  const restart = () =>
    castActive() ? castSeek(0) : sonosActive() ? sonosSeek(0) : (audio.currentTime = 0);
  if (playerTime() > 3 || !state.queue.length) return restart();
  if (state.order) {
    if (state.pos > 0) loadTrack(state.order[state.pos - 1], true);
    else restart();
    return;
  }
  if (state.qIndex > 0) loadTrack(state.qIndex - 1, true);
  else restart();
}

async function fetchMoreRadio() {
  if (!state.radio || state.radioFetching) return;
  state.radioFetching = true;
  try {
    const seed = state.queue[state.queue.length - 1]?.id || "";
    const { songs, next: n } = await api.radioQueue(state.radio.name, state.radio.next, seed);
    state.radio.next = n;
    const have = new Set(state.queue.map((s) => s.id));
    const fresh = songs.filter((s) => !have.has(s.id) && !hiddenTracks.has(s.id));
    if (fresh.length) {
      state.queue.push(...fresh);
      renderQueuePanel();
    }
  } catch {
    /* station hiccup — will retry on next track */
  } finally {
    state.radioFetching = false;
  }
}

function addToQueue(song) {
  if (inJam()) return jamAddSongs([song]);
  if (!state.queue.length || state.qIndex === -1) {
    playQueue([song], 0);
    toast(`Playing "${song.title}"`);
    return;
  }
  const at = Math.min(state.insertAt, state.queue.length);
  state.queue.splice(at, 0, song);
  if (state.order) {
    // shift shuffled indices >= insertion point, keep queued song next in order
    state.order = state.order.map((i) => (i >= at ? i + 1 : i));
    state.order.splice(state.pos + 1 + (state.insertAt - state.qIndex - 1), 0, at);
  }
  state.insertAt++;
  renderQueuePanel();
  savePlayerState(true);
  toast(`Added to queue: ${song.title}`);
}

/* audio events */
// shared by the local <audio>, the Cast player and Sonos when a track finishes
function handleTrackEnded() {
  if (state.repeat === "one" && state.current) {
    if (castActive()) return castLoad(state.current, 0, true);
    if (sonosActive()) return sonosLoad(state.current, 0, true);
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  next();
}

audio.addEventListener("ended", () => {
  if (inJam()) {
    // a device that finished the track advances the session for everyone —
    // in listen together all of them report and the server takes the first
    if (jamPlaysAudio()) api.jamEnded(state.jam.index).catch(() => {});
    return;
  }
  handleTrackEnded();
});

audio.addEventListener("play", updatePlayButton);
audio.addEventListener("pause", updatePlayButton);
audio.addEventListener("loadedmetadata", () => {
  $("#time-dur").textContent = fmtTime(audio.duration);
  $("#np2-time-dur").textContent = fmtTime(audio.duration);
  audio.volume = baseVolume; // undo any crossfade left over from the last track
});
audio.addEventListener("canplay", () => { state.failStreak = 0; });

audio.addEventListener("timeupdate", () => {
  if (seeking) return;
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  $("#progress-fill").style.width = `${pct}%`;
  $("#progress-knob").style.left = `${pct}%`;
  $("#time-cur").textContent = fmtTime(audio.currentTime);
  if ($("#np-sheet").classList.contains("open")) {
    $("#np2-progress-fill").style.width = `${pct}%`;
    $("#np2-progress-knob").style.left = `${pct}%`;
    $("#np2-time-cur").textContent = fmtTime(audio.currentTime);
  }
  savePlayerState();
  syncLyricsPop();
  applyEdgeTrims();
  if (inJam()) jamDriftCheck();
  if (audio.currentTime > 5) prefetchNext();
});

/* ---- audio scrubbing effects ----
   "Skip silence" jumps the dead air at both ends of a track; "crossfade the
   gap" rides the volume down over the tail so the seam between songs closes.
   Both stay off unless asked for, and neither touches jam or remote playback. */
const SILENCE_HEAD = 1.2;  // trimmed from the start
const SILENCE_TAIL = 2.5;  // trimmed from the end
const FADE_LEN = 1.2;

let trimmedTrack = "";

function applyEdgeTrims() {
  if (inJam() || castActive() || sonosActive() || !state.current) return;
  const dur = audio.duration;
  if (!dur || !isFinite(dur)) return;

  if (prefs.skipSilence) {
    // Only nudge past the head once per track, and never when the listener has
    // deliberately scrubbed back into it.
    if (trimmedTrack !== state.current.id && audio.currentTime < SILENCE_HEAD && !seeking) {
      trimmedTrack = state.current.id;
      audio.currentTime = SILENCE_HEAD;
    }
    if (dur - audio.currentTime <= SILENCE_TAIL) {
      handleTrackEnded();
      return;
    }
  }

  if (prefs.fadeOut && !audio.muted) {
    const left = dur - audio.currentTime;
    const target = left < FADE_LEN ? Math.max(0, left / FADE_LEN) : 1;
    audio.volume = baseVolume * target;
  }
}

// The fade multiplies the listener's volume rather than replacing it, so the
// slider still means what it says.
let baseVolume = 1;

// Warm the next track: a 2-byte ranged request makes the server resolve and
// cache the googlevideo URL, so the next song starts without the yt-dlp wait.
let prefetchedKey = "";
function prefetchNext() {
  let s;
  if (inJam()) {
    if (!jamPlaysAudio()) return; // remotes never touch the stream proxy
    s = state.jam.queue[state.jam.index + 1] || null;
  } else {
    const ni = computeNextIndex();
    s = ni >= 0 ? state.queue[ni] : null;
  }
  if (!s) return;
  // a Sonos speaker fetches its own AAC variant — warm that cache entry
  const q = sonosActive() ? "sonos" : state.quality;
  const key = `${s.id}:${q}`;
  if (prefetchedKey === key) return;
  prefetchedKey = key;
  fetch(`/api/stream/${encodeURIComponent(s.id)}?q=${q}`, {
    headers: { Range: "bytes=0-1" },
  }).catch(() => {});
}

audio.addEventListener("error", () => {
  if (!state.current) return;
  toast(`Couldn't play "${state.current.title}"`, true);
  // in a jam one client's stream hiccup must not skip the track for everyone
  if (inJam()) return;
  state.failStreak++;
  if (state.failStreak < 5) setTimeout(next, 700);
});

/* ---------------- player UI ---------------- */
function updatePlayButton() {
  // a jam remote has no audio of its own — the button mirrors the jam state;
  // while casting / on Sonos it mirrors the remote device
  const paused = inJam() && !jamPlaysAudio()
    ? !state.jam.playing
    : castActive()
    ? castPlayer.isPaused || !castPlayer.isMediaLoaded
    : sonosActive()
    ? !sonosPlaying
    : audio.paused;
  $("#btn-play").innerHTML = paused ? I.play : I.pause;
  $("#btn-play").title = paused ? "Play" : "Pause";
  $("#np2-play").innerHTML = paused ? I.play : I.pause;
  document.querySelector(".player").classList.toggle("tint-dim", paused);
}

function updateNowPlaying() {
  const s = state.current;
  if (!s) return;
  document.querySelector(".player").classList.remove("is-idle"); // leave the idle state
  const img = $("#np-image");
  if (s.image) { img.src = s.image; img.classList.remove("hidden"); }
  else img.classList.add("hidden");
  $("#np-title").textContent = s.title;
  const npArtist = $("#np-artist");
  npArtist.textContent = s.artist;
  npArtist.classList.toggle("artist-link", !!s.artistId);
  const like = $("#btn-like");
  like.classList.remove("hidden");
  const on = likedIds().has(s.id);
  like.innerHTML = on ? I.heartFill : I.heart;
  like.classList.toggle("on", on);
  $("#btn-download").classList.remove("hidden");
  document.title = `${s.title} · ${s.artist} — Marusic`;

  // mirror into the full-screen Now Playing sheet
  const img2 = $("#np2-image");
  if (s.image) { img2.src = s.image; img2.classList.remove("hidden"); }
  else img2.classList.add("hidden");
  $("#np2-art-placeholder").classList.toggle("hidden", !!s.image);
  $("#np2-title").textContent = s.title;
  const np2Artist = $("#np2-artist");
  np2Artist.textContent = s.artist;
  np2Artist.classList.toggle("artist-link", !!s.artistId);
  const like2 = $("#np2-like");
  like2.innerHTML = on ? I.heartFill : I.heart;
  like2.classList.toggle("on", on);
  $("#np2-time-dur").textContent = fmtTime(s.duration || audio.duration || 0);
  $("#np-sheet").style.setProperty("--np-accent", gradientFor(s.title));

  $("#btn-track-menu").classList.remove("hidden");
  refreshSaveButtons();
  tintPlayerFrom(s);
  trimmedTrack = "";       // a new track gets its own silence trim
  popFor = "";             // and its own lyrics
  if (lyricsPop.open) openLyricsPop();
  if (prefs.dj && djLastId !== s.id) djSay();
}

/* ---- dynamic player bar colour ----
   The bar takes its tint from the current cover and drains to grey while
   paused, so the transport tells you the playback state at a glance. */
const tintCache = new Map();

function averageColor(src) {
  if (tintCache.has(src)) return Promise.resolve(tintCache.get(src));
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 16;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 16, 16);
        const { data } = ctx.getImageData(0, 0, 16, 16);
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          // Skip near-black and near-white pixels: letterboxing and blown
          // highlights would otherwise wash every cover into the same grey.
          const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (lum < 24 || lum > 236) continue;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        if (!n) return resolve(null);
        const out = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
        tintCache.set(src, out);
        resolve(out);
      } catch { resolve(null); } // tainted canvas — no tint, no crash
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

let tintSeq = 0;

async function tintPlayerFrom(song) {
  const player = document.querySelector(".player");
  if (!song?.image) return player.style.removeProperty("--player-tint");
  const seq = ++tintSeq;
  const rgb = await averageColor(song.image);
  if (seq !== tintSeq || !rgb) return;
  player.style.setProperty("--player-tint", `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`);
  applyPlayerTintState();
}

// Paused playback drops the tint's saturation rather than removing it, so the
// bar doesn't jump colour every time you tap pause.
function applyPlayerTintState() {
  const player = document.querySelector(".player");
  const paused = inJam() && !jamPlaysAudio() ? !state.jam.playing
    : castActive() ? castPlayer.isPaused || !castPlayer.isMediaLoaded
    : sonosActive() ? !sonosPlaying
    : audio.paused;
  player.classList.toggle("tint-dim", paused);
}

function setMediaSession(song) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title,
    artist: song.artist,
    album: song.album,
    artwork: song.image ? [{ src: song.image, sizes: "500x500", type: "image/jpeg" }] : [],
  });
  navigator.mediaSession.setActionHandler("play", () => {
    if (inJam() || castActive() || sonosActive()) return $("#btn-play").click();
    audio.play();
  });
  navigator.mediaSession.setActionHandler("pause", () => {
    if (inJam() || castActive() || sonosActive()) return $("#btn-play").click();
    audio.pause();
  });
  navigator.mediaSession.setActionHandler("previoustrack", prev);
  navigator.mediaSession.setActionHandler("nexttrack", next);
  navigator.mediaSession.setActionHandler("seekto", (d) => {
    if (d.seekTime == null) return;
    if (inJam()) return jamControl(api.jamSeek, d.seekTime);
    if (castActive()) return castSeek(d.seekTime);
    if (sonosActive()) return sonosSeek(d.seekTime);
    audio.currentTime = d.seekTime;
  });
}

/* progress bar seeking */
let seeking = false;
const progressBar = $("#progress-bar");

function seekFromEvent(e) {
  const rect = progressBar.getBoundingClientRect();
  const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  $("#progress-fill").style.width = `${pct * 100}%`;
  $("#progress-knob").style.left = `${pct * 100}%`;
  $("#time-cur").textContent = fmtTime(pct * seekDuration());
  return pct;
}

progressBar.addEventListener("pointerdown", (e) => {
  if (!seekDuration()) return;
  if (inJam() && !jamCanControl()) return toast("Only the host can seek in this jam", true);
  seeking = true;
  progressBar.setPointerCapture(e.pointerId);
  seekFromEvent(e);
});

progressBar.addEventListener("pointermove", (e) => {
  if (seeking) seekFromEvent(e);
});

progressBar.addEventListener("pointerup", (e) => {
  if (!seeking) return;
  seeking = false;
  const t = seekFromEvent(e) * seekDuration();
  if (castActive()) return castSeek(t);
  if (sonosActive()) return sonosSeek(t);
  // optimistic on a device that has the audio; remotes wait for the sync
  if (!inJam() || jamPlaysAudio()) audio.currentTime = t;
  if (inJam()) jamControl(api.jamSeek, t);
});

/* controls */
$("#btn-play").addEventListener("click", () => {
  if (inJam()) {
    // our audio got blocked while the session plays → this tap is the user
    // gesture that lets us catch back up, not a pause for everyone
    if (jamPlaysAudio() && state.jam.playing && audio.paused)
      return jamApplyPlayback({ sync: true });
    return jamControl(state.jam.playing ? api.jamPause : api.jamPlay);
  }
  if (!state.current) return;
  if (castActive()) return castPlayPause();
  if (sonosActive()) return sonosPlayPause();
  audio.paused ? audio.play().catch(() => {}) : audio.pause();
});

$("#btn-next").addEventListener("click", next);
$("#btn-prev").addEventListener("click", prev);

function applyShuffleRepeatUI() {
  const repeatHTML = I.repeat + (state.repeat === "one" ? '<span class="repeat-one-badge">1</span>' : "");
  for (const [sh, rp] of [["#btn-shuffle", "#btn-repeat"], ["#np2-shuffle", "#np2-repeat"]]) {
    $(sh).classList.toggle("active", state.shuffle);
    const btn = $(rp);
    btn.classList.toggle("active", state.repeat !== "off");
    btn.style.position = "relative";
    btn.innerHTML = repeatHTML;
  }
}

$("#btn-shuffle").addEventListener("click", () => {
  if (inJam()) return toast("Shuffle is off in a jam — everyone hears the same order");
  state.shuffle = !state.shuffle;
  if (state.shuffle && state.queue.length && !state.radio) buildShuffleOrder(state.qIndex);
  else state.order = null;
  applyShuffleRepeatUI();
  renderQueuePanel();
  savePlayerState(true);
});

$("#btn-repeat").addEventListener("click", () => {
  if (inJam()) return toast("Repeat is off in a jam");
  state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
  applyShuffleRepeatUI();
  savePlayerState(true);
});

// Three distinct destinations, three distinct buttons — liking a song and
// filing it in a playlist are no longer the same gesture.
$("#btn-like").addEventListener("click", () => {
  if (state.current) toggleLike(state.current);
});

// Everything else for the current track, one click deeper.
$("#btn-track-menu").addEventListener("click", (e) => {
  e.stopPropagation();
  const s = state.current;
  if (!s) return;
  const saved = savedIds().has(s.id);
  popover.innerHTML = `
    <div class="popover-title">${esc(s.title)}</div>
    <button class="popover-item" data-np="save">${saved ? I.bookmarkFill : I.bookmark}<span>${saved ? "Remove from Saves" : "Save for later"}</span></button>
    <button class="popover-item" data-np="playlist">${I.plus}<span>Add to a playlist</span></button>
    <button class="popover-item" data-np="queue">${I.addQueue}<span>Add to queue</span></button>
    <button class="popover-item" data-np="download">${I.download}<span>Download FLAC</span></button>
    ${s.artistId ? `<button class="popover-item" data-np="artist">${I.person}<span>Go to artist</span></button>` : ""}`;
  popover.classList.remove("hidden");
  const rect = $("#btn-track-menu").getBoundingClientRect();
  popover.style.left = `${Math.max(12, rect.left - 40)}px`;
  popover.style.top = `${rect.top - popover.offsetHeight - 10}px`;

  popover.onclick = (ev) => {
    const btn = ev.target.closest("[data-np]");
    if (!btn) return;
    closePopover();
    const act = btn.dataset.np;
    if (act === "save") return toggleSave(s);
    if (act === "playlist") return openAddPopover(ev, s);
    if (act === "queue") return addToQueue(s);
    if (act === "download") return downloadFlac(s);
    if (act === "artist") location.hash = `#/artist/${encodeURIComponent(s.artistId)}`;
  };
});

$("#btn-download").addEventListener("click", (e) => {
  e.stopPropagation();
  if (state.current) downloadOrPick(e, state.current);
});

$("#np-artist").addEventListener("click", () => {
  if (isPhone()) return; // on phones the tap opens the Now Playing sheet instead
  if (state.current?.artistId)
    location.hash = `#/artist/${encodeURIComponent(state.current.artistId)}`;
});

/* ---------------- full-screen Now Playing sheet (phones) ---------------- */
const npSheet = $("#np-sheet");
const isPhone = () => window.matchMedia("(max-width: 640px)").matches;

const npSheetLabel = () =>
  inJam()
    ? `Jam · ${state.jam.code}`
    : castActive()
    ? `Casting to ${castDeviceName}`
    : sonosActive()
    ? `Playing on ${sonosDev.name}`
    : airplayOn
    ? "AirPlay"
    : state.radio
    ? `${state.radio.name} Radio`
    : "Now playing";

function openNpSheet() {
  if (!state.current) return;
  updateNowPlaying(); // refresh the mirrored fields before revealing
  const dur = seekDuration();
  const pct = dur ? (playerTime() / dur) * 100 : 0;
  $("#np2-progress-fill").style.width = `${pct}%`;
  $("#np2-progress-knob").style.left = `${pct}%`;
  $("#np2-time-cur").textContent = fmtTime(playerTime());
  $("#np-sheet-label").textContent = npSheetLabel();
  npSheet.classList.add("open");
}

const closeNpSheet = () => {
  npSheet.classList.remove("open");
  closeDrawer(); // the drawer lives inside the sheet — never leave it hanging
};

/* ---- press and hold the mini player (phones) ----
   A long press gets you like / save / device / hide without the full sheet
   sliding up first. A short press still expands, as it always did. */
const holdSheet = $("#hold-sheet");
let holdTimer = null, holdFiredAt = 0;

// A long press is followed by a synthetic click that would expand the sheet.
// Suppress clicks for a short window after the press rather than latching a
// flag: if the pointerup never lands where we expect, a stuck flag would eat
// the next real tap instead.
const HOLD_CLICK_GRACE = 700;
const holdJustFired = () => Date.now() - holdFiredAt < HOLD_CLICK_GRACE;

function openHoldSheet() {
  const s = state.current;
  if (!s) return;
  holdFiredAt = Date.now();
  if (navigator.vibrate) navigator.vibrate(12);
  const liked = likedIds().has(s.id);
  const saved = savedIds().has(s.id);
  $("#hold-card").innerHTML = `
    <div class="hold-track">
      ${artImg(s.image, "hold-art")}
      <div class="hold-text">
        <div class="hold-title">${esc(s.title)}</div>
        <div class="hold-artist">${esc(s.artist)}</div>
      </div>
    </div>
    <div class="hold-actions">
      <button class="hold-act${liked ? " on" : ""}" data-hold="like">${liked ? I.heartFill : I.heart}<span>${liked ? "Liked" : "Like"}</span></button>
      <button class="hold-act${saved ? " on" : ""}" data-hold="save">${saved ? I.bookmarkFill : I.bookmark}<span>${saved ? "Saved" : "Save"}</span></button>
      <button class="hold-act" data-hold="device">${I.cast}<span>Device</span></button>
      <button class="hold-act" data-hold="playlist">${I.plus}<span>Playlist</span></button>
      <button class="hold-act" data-hold="queue">${I.addQueue}<span>Queue</span></button>
      <button class="hold-act" data-hold="hide">${I.eyeOff}<span>Hide track</span></button>
    </div>`;
  holdSheet.classList.remove("hidden");
  requestAnimationFrame(() => holdSheet.classList.add("open"));
}

function closeHoldSheet() {
  holdSheet.classList.remove("open");
  setTimeout(() => holdSheet.classList.add("hidden"), 180);
}

holdSheet.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-hold]");
  if (!btn) return closeHoldSheet();      // tapping the scrim dismisses
  const s = state.current;
  closeHoldSheet();
  if (!s) return;
  const act = btn.dataset.hold;
  if (act === "like") return toggleLike(s);
  if (act === "save") return toggleSave(s);
  if (act === "queue") return addToQueue(s);
  if (act === "playlist") return openAddPopover(e, s);
  if (act === "device") return openOutputMenu(e);
  if (act === "hide") {
    // "Hide" drops it from the queue and skips on — the track you didn't want
    // to hear goes away without you hunting through a menu.
    const i = state.queue.findIndex((q) => q.id === s.id);
    if (i >= 0) state.queue.splice(i, 1);
    hiddenTracks.add(s.id);
    toast(`Hidden — “${s.title}” won't come back in this queue`);
    next();
  }
});

// Tracks the listener explicitly hid; autoplay and radio both skip them.
const hiddenTracks = new Set();

{
  const left = document.querySelector(".player-left");
  const start = (e) => {
    if (!isPhone() || e.target.closest("button")) return;
    holdTimer = setTimeout(openHoldSheet, 480);
  };
  const cancel = () => clearTimeout(holdTimer);
  left.addEventListener("pointerdown", start);
  left.addEventListener("pointerup", cancel);
  left.addEventListener("pointercancel", cancel);
  left.addEventListener("pointermove", cancel);
  // Suppress the expand-sheet click that would otherwise follow the long press.
  left.addEventListener("click", (e) => {
    if (holdJustFired()) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  left.addEventListener("contextmenu", (e) => { if (isPhone()) e.preventDefault(); });
}

// click/tap the player's track info (not its buttons) to expand:
// full-screen sheet on phones, right-side Now Playing panel on desktop
document.querySelector(".player-left").addEventListener("click", (e) => {
  if (e.target.closest("button")) return;
  // on desktop the artist name navigates to the artist page instead
  if (!isPhone() && e.target.closest("#np-artist") && state.current?.artistId) return;
  if (state.current) openNpSheet();
});

$("#np-sheet-close").addEventListener("click", closeNpSheet);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && npSheet.classList.contains("open")) closeNpSheet();
});

/* sheet controls reuse the main handlers so behavior can't drift */
$("#np2-play").addEventListener("click", () => $("#btn-play").click());
$("#np2-next").addEventListener("click", next);
$("#np2-prev").addEventListener("click", prev);
$("#np2-shuffle").addEventListener("click", () => $("#btn-shuffle").click());
$("#np2-repeat").addEventListener("click", () => $("#btn-repeat").click());
$("#np2-like").addEventListener("click", () => state.current && toggleLike(state.current));
$("#np2-download").addEventListener("click", (e) => {
  e.stopPropagation();
  if (state.current) downloadOrPick(e, state.current);
});
/* ---- sheet drawer ----
   Queue and lyrics slide up from the bottom of the sheet instead of throwing
   you into a side panel, so both land under your thumb. */
const npDrawer = $("#np2-drawer");
let drawerMode = "";

function openDrawer(mode) {
  if (drawerMode === mode && !npDrawer.hidden) return closeDrawer();
  drawerMode = mode;
  npDrawer.hidden = false;
  $("#np2-drawer-title").textContent = mode === "queue" ? "Up next" : "Lyrics";
  requestAnimationFrame(() => npDrawer.classList.add("open"));
  paintDrawer();
  $("#np2-queue").classList.toggle("on", mode === "queue");
  $("#np2-lyrics").classList.toggle("on", mode === "lyrics");
}

function closeDrawer() {
  npDrawer.classList.remove("open");
  drawerMode = "";
  $("#np2-queue").classList.remove("on");
  $("#np2-lyrics").classList.remove("on");
  setTimeout(() => { if (!drawerMode) npDrawer.hidden = true; }, 200);
}

async function paintDrawer() {
  const body = $("#np2-drawer-body");
  if (drawerMode === "queue") {
    const up = upcomingIndices();
    body.innerHTML = up.length
      ? up.map((i) => {
          const s = state.queue[i];
          return `<div class="dq-item" data-dq="${i}">
            ${artImg(s.image, "dq-art")}
            <span class="dq-meta"><b>${esc(s.title)}</b><span>${esc(s.artist)}</span></span>
          </div>`;
        }).join("")
      : `<div class="queue-empty">Nothing queued after this.</div>`;
  } else if (drawerMode === "lyrics") {
    const song = state.current;
    if (!song) return (body.innerHTML = `<div class="queue-empty">Play something first.</div>`);
    body.innerHTML = `<div class="spinner"></div>`;
    try {
      const { lyrics } = await api.lyrics(song.id);
      if (drawerMode !== "lyrics" || state.current?.id !== song.id) return;
      body.innerHTML = lyrics
        ? `<div class="lyrics-text">${esc(lyrics)}</div>`
        : `<div class="queue-empty">No lyrics published for this track.</div>`;
    } catch {
      body.innerHTML = `<div class="queue-empty">Couldn't load lyrics.</div>`;
    }
  }
}

$("#np2-lyrics").addEventListener("click", () => openDrawer("lyrics"));
$("#np2-queue").addEventListener("click", () => openDrawer("queue"));
$("#np2-drawer-close").addEventListener("click", closeDrawer);
npDrawer.addEventListener("click", (e) => {
  const item = e.target.closest("[data-dq]");
  if (item) loadTrack(Number(item.dataset.dq), true);
});
$("#np2-artist").addEventListener("click", () => {
  if (!state.current?.artistId) return;
  closeNpSheet();
  location.hash = `#/artist/${encodeURIComponent(state.current.artistId)}`;
});

/* sheet seek bar (shares the `seeking` flag so the bars never fight) */
const np2Bar = $("#np2-progress-bar");

function np2SeekFromEvent(e) {
  const rect = np2Bar.getBoundingClientRect();
  const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  $("#np2-progress-fill").style.width = `${pct * 100}%`;
  $("#np2-progress-knob").style.left = `${pct * 100}%`;
  $("#np2-time-cur").textContent = fmtTime(pct * seekDuration());
  return pct;
}

np2Bar.addEventListener("pointerdown", (e) => {
  if (!seekDuration()) return;
  if (inJam() && !jamCanControl()) return toast("Only the host can seek in this jam", true);
  seeking = true;
  np2Bar.setPointerCapture(e.pointerId);
  np2SeekFromEvent(e);
});
np2Bar.addEventListener("pointermove", (e) => { if (seeking) np2SeekFromEvent(e); });
np2Bar.addEventListener("pointerup", (e) => {
  if (!seeking) return;
  seeking = false;
  const t = np2SeekFromEvent(e) * seekDuration();
  if (castActive()) return castSeek(t);
  if (sonosActive()) return sonosSeek(t);
  if (!inJam() || jamPlaysAudio()) audio.currentTime = t;
  if (inJam()) jamControl(api.jamSeek, t);
});

/* swipe down on the header or artwork to dismiss */
let sheetDragY = null;
for (const zone of ["#np-sheet-head", "#np2-art"]) {
  const el = $(zone);
  el.addEventListener("touchstart", (e) => {
    sheetDragY = e.touches[0].clientY;
    npSheet.style.transition = "none";
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    if (sheetDragY == null) return;
    const dy = Math.max(0, e.touches[0].clientY - sheetDragY);
    npSheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (sheetDragY == null) return;
    const dy = Math.max(0, e.changedTouches[0].clientY - sheetDragY);
    sheetDragY = null;
    npSheet.style.transition = "";
    npSheet.style.transform = "";
    if (dy > 110) closeNpSheet();
  });
}

/* volume */
const volumeEl = $("#volume");

function applyVolume(v) {
  baseVolume = (v / 100) ** 2; // perceptual curve
  audio.volume = baseVolume;   // the crossfade rides on top of this
  volumeEl.value = v;
  volumeEl.style.setProperty("--vol", `${v}%`);
  $("#btn-mute").innerHTML = audio.muted || v === 0 ? I.mute : I.volume;
}

volumeEl.addEventListener("input", () => {
  const v = Number(volumeEl.value);
  if (castActive() || sonosActive()) {
    // the slider drives the remote device; the local preference stays untouched
    volumeEl.style.setProperty("--vol", `${v}%`);
    $("#btn-mute").innerHTML = v === 0 ? I.mute : I.volume;
    if (castActive()) {
      castPlayer.volumeLevel = v / 100;
      castCtl.setVolumeLevel();
    } else {
      sonosSetVolume(v); // debounced — SOAP per pixel would flood the speaker
    }
    return;
  }
  audio.muted = false;
  localStorage.setItem("volume", volumeEl.value);
  applyVolume(v);
});

$("#btn-mute").addEventListener("click", () => {
  if (castActive()) return castCtl.muteOrUnmute();
  if (sonosActive()) return sonosToggleMute();
  audio.muted = !audio.muted;
  $("#btn-mute").innerHTML = audio.muted ? I.mute : I.volume;
});

/* Streaming quality is a set-once preference, so it lives in Profile ›
   Settings rather than taking up a control in the transport bar. */

/* keyboard */
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select")) return;
  if (e.code === "Space") {
    e.preventDefault();
    $("#btn-play").click();
  }
});

/* ---------------- queue panel ---------------- */
$("#btn-queue").addEventListener("click", () => {
  $("#lyrics-panel").classList.add("hidden");
  $("#queue-panel").classList.toggle("hidden");
  renderQueuePanel();
});

$("#btn-queue-close").addEventListener("click", () =>
  $("#queue-panel").classList.add("hidden")
);

/* autoplay toggle (queue panel header) — in a jam it mirrors the jam setting */
function applyAutoplayUI() {
  $("#btn-autoplay").classList.toggle(
    "on",
    inJam() ? state.jam.settings.autoplay : state.autoplay
  );
}

$("#btn-autoplay").addEventListener("click", () => {
  if (inJam()) {
    if (!jamIsHost()) return toast("Only the host can change jam autoplay");
    return jamControl(api.jamSettings, { autoplay: !state.jam.settings.autoplay });
  }
  state.autoplay = !state.autoplay;
  localStorage.setItem("autoplay", state.autoplay ? "on" : "off");
  applyAutoplayUI();
  toast(state.autoplay ? "Autoplay on — similar songs keep the music going" : "Autoplay off");
});

/* ---------------- lyrics ----------------
   Desktop gets a light pop-up rather than a side panel that shoves the page
   over; the side panel is still there for anyone who prefers it (shift-click). */
$("#btn-lyrics").addEventListener("click", (e) => {
  if (e.shiftKey || isPhone()) {
    $("#queue-panel").classList.add("hidden");
    const panel = $("#lyrics-panel");
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) renderLyricsPanel();
    return;
  }
  openLyricsPop();
});

/* ---- lyrics pop-up ---- */
const lyricsPop = $("#lyrics-pop");
let popLines = [];        // [{ t, text }] — t is seconds, or null when unsynced
let popActive = -1;
let popTranslated = false;
let popRaw = "";
let popFor = "";

// LRC-style timestamps if the source has them; otherwise the lines are paced
// evenly across the track so "follow along" still tracks roughly right.
function parseLyrics(text, duration) {
  const raw = String(text || "").split(/\r?\n/);
  const stamped = raw
    .map((line) => {
      const m = line.match(/^\s*\[(\d{1,2}):(\d{2})(?:[.:](\d{1,2}))?\]\s*(.*)$/);
      if (!m) return null;
      return { t: Number(m[1]) * 60 + Number(m[2]) + Number(`0.${m[3] || 0}`), text: m[4].trim() };
    })
    .filter(Boolean);
  if (stamped.length > 2) return stamped;

  const lines = raw.map((l) => l.trim());
  const sung = lines.filter(Boolean).length;
  if (!duration || !sung) return lines.map((text) => ({ t: null, text }));
  // Leave a short intro and outro rather than starting the first line at 0:00.
  const span = Math.max(1, duration - 12);
  let seen = 0;
  return lines.map((text) => {
    const t = text ? 6 + (seen++ / sung) * span : null;
    return { t, text };
  });
}

async function openLyricsPop() {
  const song = state.current;
  if (!song) return toast("Play something first");
  lyricsPop.showModal();
  $("#lp-title").textContent = song.title;
  $("#lp-artist").textContent = song.artist;
  applyLyricsSize();
  if (popFor === song.id) return;   // already loaded for this track
  popFor = song.id;
  popTranslated = false;
  $("#lp-body").innerHTML = `<div class="spinner"></div>`;
  $("#lp-note").textContent = "";
  try {
    const { lyrics, source } = await api.lyrics(song.id);
    if (popFor !== song.id) return;
    popRaw = lyrics || "";
    if (!popRaw) {
      $("#lp-body").innerHTML = `<div class="queue-empty">No lyrics published for this track.</div>`;
      popLines = [];
      return;
    }
    popLines = parseLyrics(popRaw, song.duration || audio.duration || 0);
    paintLyricsPop();
    $("#lp-note").textContent = source || "";
  } catch {
    if (popFor === song.id)
      $("#lp-body").innerHTML = `<div class="queue-empty">Couldn't load lyrics.</div>`;
  }
}

function paintLyricsPop() {
  $("#lp-body").innerHTML = popLines
    .map((l, i) => l.text
      ? `<p class="lp-line" data-lp="${i}"${l.t != null ? ` data-t="${l.t}"` : ""}>${esc(l.text)}</p>`
      : `<p class="lp-gap"></p>`)
    .join("");
  popActive = -1;
}

function applyLyricsSize() {
  $("#lp-body").style.fontSize = `${prefs.lyricsSize}px`;
}

// Highlight-and-scroll runs off the same tick the progress bar already uses.
function syncLyricsPop() {
  if (!lyricsPop.open || !$("#lp-follow").checked || !popLines.length) return;
  const t = playerTime();
  let idx = -1;
  for (let i = 0; i < popLines.length; i++) {
    if (popLines[i].t != null && popLines[i].t <= t) idx = i;
  }
  if (idx === popActive) return;
  popActive = idx;
  const body = $("#lp-body");
  body.querySelectorAll(".lp-line.on").forEach((el) => el.classList.remove("on"));
  const el = body.querySelector(`[data-lp="${idx}"]`);
  if (!el) return;
  el.classList.add("on");
  body.scrollTo({ top: el.offsetTop - body.clientHeight / 2 + el.clientHeight, behavior: "smooth" });
}

$("#lp-close").addEventListener("click", () => lyricsPop.close());
$("#lp-page").addEventListener("click", () => {
  lyricsPop.close();
  $("#queue-panel").classList.add("hidden");
  $("#lyrics-panel").classList.remove("hidden");
  renderLyricsPanel();
});
$("#lp-bigger").addEventListener("click", () => {
  setPref("lyricsSize", Math.min(34, prefs.lyricsSize + 2));
  applyLyricsSize();
});
$("#lp-smaller").addEventListener("click", () => {
  setPref("lyricsSize", Math.max(12, prefs.lyricsSize - 2));
  applyLyricsSize();
});

// Translation goes through the browser's own machinery — nothing about the
// listener or the track leaves this instance for a third-party API.
$("#lp-translate").addEventListener("click", () => {
  const body = $("#lp-body");
  popTranslated = !popTranslated;
  body.lang = popTranslated ? "" : "en";
  body.translate = true;
  $("#lp-note").textContent = popTranslated
    ? "Use your browser's translate option on this panel to render these lines in your language."
    : "";
  $("#lp-translate").classList.toggle("on", popTranslated);
});

// Clicking a timed line seeks to it — the lyrics double as a scrub track.
$("#lp-body").addEventListener("click", (e) => {
  const line = e.target.closest("[data-t]");
  if (!line) return;
  const t = Number(line.dataset.t);
  if (inJam()) return jamControl(api.jamSeek, t);
  if (castActive()) return castSeek(t);
  if (sonosActive()) return sonosSeek(t);
  audio.currentTime = t;
});

$("#btn-lyrics-close").addEventListener("click", () =>
  $("#lyrics-panel").classList.add("hidden")
);

let lyricsFor = "";
async function renderLyricsPanel() {
  const body = $("#lyrics-body");
  const song = state.current;
  if (!song) {
    body.innerHTML = `<div class="queue-empty">Play something to see its lyrics.</div>`;
    return;
  }
  if (lyricsFor === song.id && body.dataset.loaded === song.id) return;
  lyricsFor = song.id;
  body.innerHTML = `<div class="spinner"></div>`;
  try {
    const { lyrics, source } = await api.lyrics(song.id);
    if (lyricsFor !== song.id) return; // track changed while loading
    body.dataset.loaded = song.id;
    body.innerHTML = lyrics
      ? `<div class="lyrics-title">${esc(song.title)} · ${esc(song.artist)}</div>
         <div class="lyrics-text">${esc(lyrics)}</div>
         ${source ? `<div class="lyrics-source">${esc(source)}</div>` : ""}`
      : `<div class="queue-empty">No lyrics available for<br><b>${esc(song.title)}</b></div>`;
  } catch {
    if (lyricsFor === song.id)
      body.innerHTML = `<div class="queue-empty">Couldn't load lyrics.</div>`;
  }
}

function upcomingIndices() {
  if (state.order) return state.order.slice(state.pos + 1);
  return [...state.queue.keys()].slice(state.qIndex + 1);
}

function renderQueuePanel() {
  const panel = $("#queue-panel");
  if (panel.classList.contains("hidden")) return;
  const list = $("#queue-list");
  $("#queue-title").textContent = inJam() ? "Jam" : "Queue";
  if (inJam()) return renderJamQueue(list);
  if (!state.queue.length) {
    list.innerHTML = `<div class="queue-empty">Nothing queued.<br>Play something!</div>`;
    return;
  }
  // Queued items carry their own repeat/shuffle marks: repeat one plays that
  // track again before moving on, shuffle marks a block to be jumbled.
  const item = (i, playing) => {
    const s = state.queue[i];
    const flags = queueFlags.get(s.id) || {};
    return `<div class="queue-item ${playing ? "playing" : ""}" data-qi="${i}" draggable="true">
      <span class="qi-grip" title="Drag to reorder">${I.drag}</span>
      ${artImg(s.image)}
      <div class="qi-meta">
        <div class="qi-title">${esc(s.title)}</div>
        <div class="qi-artist">${esc(s.artist)}</div>
      </div>
      <div class="qi-actions">
        <button class="icon-btn qi-flag${flags.repeat ? " on" : ""}" data-qflag="repeat" data-qid="${esc(s.id)}"
                title="${flags.repeat ? "Stop repeating this track" : "Repeat this track once more"}">${I.repeat}</button>
        <button class="icon-btn qi-flag${flags.shuffle ? " on" : ""}" data-qflag="shuffle" data-qid="${esc(s.id)}"
                title="${flags.shuffle ? "Don't shuffle from here" : "Shuffle everything from here on"}">${I.shuffle}</button>
        <button class="icon-btn qi-remove" data-qremove="${i}" title="Remove from queue">${I.close}</button>
      </div>
    </div>`;
  };
  let html = "";
  if (state.current) {
    html += `<div class="queue-section">Now playing</div>${item(state.qIndex, true)}`;
  }
  const up = upcomingIndices();
  const { picks, autos } = state.radio
    ? { picks: up, autos: [] }
    : splitAutoTail(up, (i) => state.queue[i].auto);
  if (picks.length) {
    html += `<div class="queue-section">${
      state.radio ? `Next · ${esc(state.radio.name)} Radio` : autos.length ? "Next in queue" : "Next up"}
      <button class="queue-clear" id="queue-clear-up">Clear</button></div>`;
    html += picks.map((i) => item(i, false)).join("");
  }
  if (autos.length) {
    html += `<div class="queue-section">Next up · Autoplay${
      picks.length ? "" : `<button class="queue-clear" id="queue-clear-up">Clear</button>`}</div>`;
    html += autos.map((i) => item(i, false)).join("");
  }
  list.innerHTML = html;
  const clear = $("#queue-clear-up");
  if (clear) clear.onclick = (e) => {
    e.stopPropagation();
    state.queue = state.queue.slice(0, state.qIndex + 1);
    state.order = null;
    state.pos = 0;
    if (state.shuffle) buildShuffleOrder(state.qIndex);
    renderQueuePanel();
    savePlayerState(true);
  };
}

/* Per-track queue flags, keyed by song id so they survive a reorder. */
const queueFlags = new Map();

/* ---- queue: drag to reorder, including whole runs of a playlist ---- */
let qDragFrom = null;

$("#queue-list").addEventListener("dragstart", (e) => {
  const row = e.target.closest(".queue-item");
  if (!row || inJam()) return;
  qDragFrom = Number(row.dataset.qi);
  e.dataTransfer.effectAllowed = "move";
  row.classList.add("dragging");
});

$("#queue-list").addEventListener("dragover", (e) => {
  if (qDragFrom == null) return;
  const row = e.target.closest(".queue-item");
  if (!row) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  $("#queue-list").querySelectorAll(".queue-item.drop-target")
    .forEach((r) => r.classList.remove("drop-target"));
  if (Number(row.dataset.qi) !== qDragFrom) row.classList.add("drop-target");
});

$("#queue-list").addEventListener("dragend", () => {
  qDragFrom = null;
  $("#queue-list").querySelectorAll(".dragging, .drop-target")
    .forEach((r) => r.classList.remove("dragging", "drop-target"));
});

$("#queue-list").addEventListener("drop", (e) => {
  const row = e.target.closest(".queue-item");
  if (qDragFrom == null || !row) return;
  e.preventDefault();
  const to = Number(row.dataset.qi);
  const from = qDragFrom;
  qDragFrom = null;
  if (to === from) return;
  const playingId = state.current?.id;
  const [moved] = state.queue.splice(from, 1);
  state.queue.splice(to, 0, moved);
  // The pointer has to follow the track that's actually playing, not its index.
  state.qIndex = state.queue.findIndex((s) => s.id === playingId);
  if (state.shuffle) buildShuffleOrder(state.qIndex);
  renderQueuePanel();
  savePlayerState(true);
});

$("#queue-list").addEventListener("click", (e) => {
  const flag = e.target.closest("[data-qflag]");
  if (flag) {
    e.stopPropagation();
    const id = flag.dataset.qid;
    const cur = queueFlags.get(id) || {};
    const key = flag.dataset.qflag;
    queueFlags.set(id, { ...cur, [key]: !cur[key] });
    if (key === "shuffle" && !cur.shuffle) {
      // Shuffling "from here" jumbles everything after this track, in place.
      const at = state.queue.findIndex((s) => s.id === id);
      const tail = state.queue.slice(at + 1);
      for (let i = tail.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tail[i], tail[j]] = [tail[j], tail[i]];
      }
      state.queue = [...state.queue.slice(0, at + 1), ...tail];
      toast("Shuffled the rest of the queue");
    }
    renderQueuePanel();
    savePlayerState(true);
    return;
  }
  const remove = e.target.closest("[data-qremove]");
  if (remove) {
    e.stopPropagation();
    const i = Number(remove.dataset.qremove);
    if (i === state.qIndex) return toast("That one's playing right now", true);
    const playingId = state.current?.id;
    state.queue.splice(i, 1);
    state.qIndex = state.queue.findIndex((s) => s.id === playingId);
    if (state.shuffle) buildShuffleOrder(state.qIndex);
    renderQueuePanel();
    savePlayerState(true);
  }
});

function renderJamQueue(list) {
  const j = state.jam;
  const listening = j.members.filter((m) => m.connected).length;
  const c = jamCopy(jamMode());
  let html = `<a class="jam-strip" href="${jamRoute(jamMode())}" title="Open the ${c.noun}">
    <span class="jam-strip-icon">${c.icon()}</span>
    <span class="jam-strip-meta">
      <span class="jam-strip-title">${c.title} · ${esc(j.code)}</span>
      <span class="jam-strip-sub">${j.members.length} in · ${listening} online${
        jamPlaysAudio() ? " · playing here" : ""
      }</span>
    </span>${I.chevronRight}
  </a>`;
  if (!j.queue.length) {
    list.innerHTML = html +
      `<div class="queue-empty">The jam queue is empty.<br>Anything anyone plays lands here.</div>`;
    return;
  }
  const item = (i, playing) => {
    const s = j.queue[i];
    return `<div class="queue-item ${playing ? "playing" : ""}" data-jqi="${i}">
      ${artImg(s.image)}
      <div class="qi-meta">
        <div class="qi-title">${esc(s.title)}</div>
        <div class="qi-artist">${esc(s.artist)}</div>
      </div>
      ${!playing && jamCanControl() ? `<button class="icon-btn qi-remove" data-jqr="${i}" title="Remove from the jam">${I.close}</button>` : ""}
    </div>`;
  };
  if (j.index >= 0 && j.queue[j.index]) {
    html += `<div class="queue-section">Now playing</div>${item(j.index, true)}`;
  }
  // what people queued comes first, then what autoplay filled in — shown as
  // two sections so it's obvious a new pick jumps ahead of the suggestions
  const up = [...j.queue.keys()].slice(j.index + 1);
  const { picks, autos } = splitAutoTail(up, (i) => j.queue[i].auto);
  if (picks.length) {
    html += `<div class="queue-section">${autos.length ? "Next in queue" : "Next up"}</div>` +
      picks.map((i) => item(i, false)).join("");
  }
  if (autos.length) {
    html += `<div class="queue-section">Next up · Autoplay</div>` + autos.map((i) => item(i, false)).join("");
  }
  list.innerHTML = html;
}

// Split upcoming indices into "picks" and the autoplay tail — but only when
// the tail really is a tail (every auto song after the first one). If someone
// backed up into the picks, the two interleave and one flat list is honest.
function splitAutoTail(up, isAuto) {
  const k = up.findIndex(isAuto);
  if (k === -1 || !up.slice(k).every(isAuto)) return { picks: up, autos: [] };
  return { picks: up.slice(0, k), autos: up.slice(k) };
}

$("#queue-list").addEventListener("click", (e) => {
  const rm = e.target.closest("[data-jqr]");
  if (rm) return jamControl(api.jamRemove, Number(rm.dataset.jqr));
  const jamRow = e.target.closest("[data-jqi]");
  if (jamRow) return jamControl(api.jamPlay, Number(jamRow.dataset.jqi));
  const el = e.target.closest(".queue-item");
  if (el) loadTrack(Number(el.dataset.qi), true);
});

/* ---------------- shared listening: jams & listen together ----------------
   The server clock owns playback: state is { index, playing, pos, at } with
   `pos` measured at server-time `at`. Every client (host included) slaves its
   <audio> to that — controls just POST intents, and the SSE stream brings back
   the truth.

   Two modes (see lib/jam.js), differing only in who renders the audio:
     "speaker"  — Jam, same room: one device sounds, the rest are remotes.
     "together" — Listen together, everyone remote: every device plays.
   Almost everything below is shared; jamPlaysAudio() is the fork. */
let jamES = null; // EventSource
let jamLoadedKey = ""; // `${index}:${songId}` this client's UI is showing
let jamRecheckAt = 0; // throttle for "does my jam still exist?" after ES errors
let jamDriftAt = 0;
let jamTicker = null; // remote-control progress timer (no audio to drive the bar)

const inJam = () => !!state.jam;
const jamIsHost = () => inJam() && state.jam.youId === state.jam.hostId;
const jamCanControl = () => inJam() && (jamIsHost() || state.jam.settings.guestsControl);
const jamSong = () => state.jam?.queue[state.jam.index] || null;
const jamMode = () => state.jam?.mode || "speaker";
const isTogether = () => inJam() && jamMode() === "together";

/* everything the two features say differently — one table so the copy for a
   mode lives in one place instead of scattered ternaries */
const JAM_COPY = {
  speaker: {
    route: "jam",
    noun: "jam",
    title: "Jam",
    icon: () => I.group,
    blurb: `Everyone's in the same room. One device plays the music and everyone
      else's phone becomes a remote — same queue, no echo.`,
    start: "Start a jam",
    startFrom: "Start a jam from what's playing",
    started: "Jam started — share the code",
    invited: "invited you to a jam",
    join: "Join the jam",
  },
  together: {
    route: "together",
    noun: "listen together",
    title: "Listen together",
    icon: () => I.volume,
    blurb: `Everyone's somewhere else. Every device plays its own audio, held in
      sync to the same moment of the same song — so hop in a call and listen.`,
    start: "Start listening together",
    startFrom: "Listen together from what's playing",
    started: "Started — share the code and hop in a call",
    invited: "invited you to listen together",
    join: "Join and listen",
  },
};
const jamCopy = (mode) => JAM_COPY[mode] || JAM_COPY.speaker;
// what the session is called in front of the user
const jamNoun = () => jamCopy(jamMode()).noun;
// Both kinds live behind the one Jam entry, so a session's link is the same
// either way; peek() reports the kind, so a join screen still frames itself
// correctly whichever sort of code you were handed.
const jamRoute = () => "#/jam";
const onJamRoute = () => currentRoute === "jam" || currentRoute === "together";

// One device per jam makes the sound — the tab that created it (or that the
// host later picked via "Play here"). Everyone else is a synchronized remote.
// sessionStorage = per-tab and reload-proof, so a second tab never doubles up.
function jamDeviceId() {
  let id = sessionStorage.getItem("jam-device");
  if (!id) {
    id = crypto.randomUUID?.() || `d-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem("jam-device", id);
  }
  return id;
}
// the one device sounding a jam (also drives the "Play here" UI)
const isJamSpeaker = () => inJam() && state.jam.speakerId === jamDeviceId();
// does *this* device render the audio? In listen together, always.
const jamPlaysAudio = () => inJam() && (isTogether() || isJamSpeaker());

// where the session is *right now*, from the last sync + our clock offset
function jamTargetPos() {
  const j = state.jam;
  if (!j) return 0;
  if (!j.playing) return j.pos;
  return Math.max(0, j.pos + (Date.now() + j.offset - j.at) / 1000);
}

/* ---- clock offset ----
   `offset` converts our Date.now() to server time. Reading it off a pushed
   SSE payload (server_now - our_now) silently includes the one-way delivery
   delay, which we can't measure and which jitters. A jam didn't care — one
   device made sound, so being 200ms off matched nothing. Listen together
   does: a biased offset holds everyone permanently that far apart.

   So we time round trips to /api/jam/time and keep the *lowest-RTT* sample,
   since the fastest round trip is the least skewed. */
let jamClockRtt = Infinity; // best RTT seen for the offset we're holding
let jamClockTimer = null;

async function jamProbeClock(rounds = 4) {
  for (let i = 0; i < rounds; i++) {
    if (!inJam()) return;
    const t0 = performance.now();
    let now;
    try {
      ({ now } = await api.jamTime());
    } catch {
      return;
    }
    const rtt = performance.now() - t0;
    if (!inJam() || rtt >= jamClockRtt) continue;
    jamClockRtt = rtt;
    // the reply was written ~rtt/2 ago, so server time is `now + rtt/2` right
    // about now — and Date.now() moved on by however long the parse took
    state.jam.offset = now + rtt / 2 - Date.now();
  }
}

function jamStartClock() {
  jamClockRtt = Infinity;
  jamProbeClock(5);
  clearInterval(jamClockTimer);
  // re-probe occasionally: laptops sleep, clocks get stepped by NTP. The best
  // sample decays so a stale lucky RTT can't lock out a fresh accurate one.
  jamClockTimer = setInterval(() => {
    if (!inJam()) return;
    jamClockRtt *= 1.5;
    jamProbeClock(3);
  }, 60_000);
}

function jamStopClock() {
  clearInterval(jamClockTimer);
  jamClockTimer = null;
  jamClockRtt = Infinity;
}

async function jamControl(fn, ...args) {
  if (!jamCanControl())
    return toast("Only the host can control playback in this jam", true);
  try {
    await fn(...args);
  } catch (err) {
    toast(err.message, true);
  }
}

async function jamAddSongs(songs) {
  try {
    const { added } = await api.jamAdd(songs);
    toast(added === 1 ? "Added to the queue" : `Added ${added} songs to the queue`);
  } catch (err) {
    toast(err.message, true);
  }
}

function jamApplyState(snap) {
  Object.assign(state.jam, {
    mode: snap.mode || "speaker",
    hostId: snap.hostId,
    speakerId: snap.speakerId,
    speakerOnline: snap.speakerOnline,
    members: snap.members,
    settings: snap.settings,
    queue: snap.queue,
    index: snap.index,
    playing: snap.playing,
    pos: snap.pos,
    at: snap.at,
  });
  jamAdoptOffset(snap.now);
}

// only trust a payload's clock until a round-trip probe gives us a better one
function jamAdoptOffset(serverNow) {
  if (jamClockRtt === Infinity && Number.isFinite(serverNow))
    state.jam.offset = serverNow - Date.now();
}

/* ---- drift correction ----
   In a jam this barely matters: one device makes sound, so the only job is
   keeping the seek bar honest, and a lazy 2.5s tolerance avoids pointless
   seeking. Listen together is the opposite — being a second apart from your
   friends is the whole failure mode, but hard-seeking to fix it is an audible
   glitch. So: nudge playbackRate for small drift (inaudible at ±3%, closes a
   200ms gap in a few seconds) and only seek when we're too far out for a
   nudge to catch up in reasonable time. */
const JAM_DRIFT_SEEK = 1.0; // past this, a nudge would take too long — seek
const JAM_DRIFT_NUDGE = 0.15; // inside this we're in sync; run at exactly 1×
const JAM_RATE_MAX = 0.03; // ±3%, comfortably below the audible-pitch floor
const JAM_DRIFT_TOLERANCE = 2.5; // jam mode: nobody is listening in parallel
const JAM_SEEK_HOLDOFF = 5000; // ms between hard seeks — let one land first
const JAM_LEAD_MAX = 2.0; // cap on the seek lead we'll compensate for

/* A hard seek is not free: the proxy has to open a fresh ranged request
   upstream, so playback resumes some hundreds of ms (on a phone, seconds)
   after we ask — and by then we're behind again. Naively re-seeking every
   check turns that into a stutter loop: seek, stall, fall behind, seek…
   Three defences: (1) never hard-seek while the element is stalled or
   starving — it can't help, and the rate nudge is paused anyway; (2) after a
   hard seek, hold off further ones so it can settle; (3) aim past the target
   by the lead we measured last time (issue → `playing`), so we land on the
   beat instead of a step behind it. */
let jamSeekAt = 0; // when the last hard seek was issued
let jamSeekLead = 0; // seconds a hard seek has been costing us lately (EMA)
let jamStalledAt = 0; // last `waiting`/`stalled` — buffer ran dry
let jamPlayingAt = 0; // last `playing` — buffer refilled / play resumed
let jamSyncPending = false; // a loadedmetadata sync is already queued

audio.addEventListener("error", () => { jamSyncPending = false; }); // no metadata coming
audio.addEventListener("waiting", () => { jamStalledAt = Date.now(); });
audio.addEventListener("stalled", () => { jamStalledAt = Date.now(); });
audio.addEventListener("playing", () => {
  jamPlayingAt = Date.now();
  if (jamSeekAt && jamPlayingAt - jamSeekAt < 10_000) {
    // how long the last hard seek took to start sounding
    const took = Math.min(JAM_LEAD_MAX, (jamPlayingAt - jamSeekAt) / 1000);
    jamSeekLead = jamSeekLead ? jamSeekLead * 0.6 + took * 0.4 : took;
  }
});

// starved: buffering now, or hasn't recovered since the last stall
const jamStarved = () =>
  audio.readyState < 3 || (jamStalledAt > jamPlayingAt && Date.now() - jamStalledAt < 8000);

function jamSetRate(rate) {
  if (Math.abs(audio.playbackRate - rate) > 0.0005) audio.playbackRate = rate;
}

function jamHardSeek(target) {
  jamSeekAt = Date.now();
  audio.currentTime = target;
}

function jamSyncPosition() {
  // `initial` = the track just loaded and hasn't sounded yet: place the head
  // outright (nothing to stutter), no hold-off, no starved gate.
  const apply = (initial = false) => {
    if (!inJam()) return;
    const target = jamTargetPos();
    const drift = (audio.currentTime || 0) - target; // >0 = we're ahead
    if (!isTogether()) {
      // past the end (everyone lagged): the seek clamps, `ended` fires, and
      // the ended report advances the session — exactly what we want
      if (Math.abs(drift) > JAM_DRIFT_TOLERANCE) jamHardSeek(target);
      return;
    }
    if (!state.jam.playing || audio.paused) {
      jamSetRate(1);
      // paused: line up exactly, so resume starts everyone together
      if (Math.abs(drift) > JAM_DRIFT_NUDGE) jamHardSeek(target);
      return;
    }
    if (initial) {
      jamSetRate(1);
      // the stream takes a moment to start; aim ahead by what that has been
      // costing so the first note lands with everyone else's
      if (target + jamSeekLead > JAM_DRIFT_NUDGE) jamHardSeek(target + jamSeekLead);
      return;
    }
    if (Math.abs(drift) > JAM_DRIFT_SEEK) {
      jamSetRate(1);
      if (jamStarved()) return; // buffering — a seek only stalls it again
      if (Date.now() - jamSeekAt < JAM_SEEK_HOLDOFF) return; // let the last one land
      // behind: lead the target by what a seek costs, so we arrive on time
      // rather than a step late. Ahead: never lead (that's a rewind).
      jamHardSeek(target + (drift < 0 ? jamSeekLead : 0));
      return;
    }
    if (jamStarved()) return jamSetRate(1); // don't steer an empty buffer
    if (Math.abs(drift) <= JAM_DRIFT_NUDGE) return jamSetRate(1);
    // steer toward the target: ahead → slow down, behind → speed up
    jamSetRate(1 - Math.max(-JAM_RATE_MAX, Math.min(JAM_RATE_MAX, drift / 4)));
  };
  if (audio.readyState >= 1) return apply(false);
  if (jamSyncPending) return; // one listener is enough — it reads live state
  jamSyncPending = true;
  audio.addEventListener("loadedmetadata", () => {
    jamSyncPending = false;
    apply(true);
  }, { once: true });
}

function jamApplyPlayback(opts = {}) {
  const j = state.jam;
  if (!j) return;
  const plays = jamPlaysAudio();
  jamSyncTicker();
  const song = jamSong();
  if (!song) {
    // nothing queued — silence until somebody adds a song
    audio.pause();
    jamLoadedKey = "";
    updatePlayButton();
    return;
  }
  const key = `${j.index}:${song.id}`;
  const changed = key !== jamLoadedKey || opts.force;
  if (changed) {
    jamLoadedKey = key;
    state.current = song;
    updateNowPlaying();
    setMediaSession(song);
    highlightPlayingRow();
    if (plays) {
      // only a device actually playing writes listening history — which in
      // listen together is everyone, and rightly so: they each heard it
      api.saveHistory(song).catch(() => {});
      state.library.history = [
        song,
        ...state.library.history.filter((s) => s.id !== song.id),
      ].slice(0, 100);
    }
    if (!$("#lyrics-panel").classList.contains("hidden")) renderLyricsPanel();
  }
  if (!plays) {
    // this device is a remote control: it shows the jam, the speaker sounds it
    if (!audio.paused) audio.pause();
    jamSetRate(1);
    hideJamResume();
    updatePlayButton();
    return;
  }
  // compare against the src the current track *should* have, so reclaiming
  // the speaker role after tracks moved on still loads the right stream
  const want = streamSrc(song);
  if (!audio.src || !audio.src.endsWith(want)) audio.src = want;
  // Only re-check the position when the transport actually moved (a sync, a
  // new track, a role change). A queue edit — someone adding a song — used to
  // run this too, and a mid-song hard seek was the audible result.
  if (changed || opts.sync) jamSyncPosition();
  if (j.playing) {
    audio.play().then(hideJamResume).catch(showJamResume);
  } else {
    audio.pause();
    hideJamResume();
  }
  updatePlayButton();
}

/* remotes have no audio events to move the progress bar — a timer derives
   the position from the last sync and the server-clock offset instead */
function jamSyncTicker() {
  const want = inJam() && !jamPlaysAudio();
  if (want && !jamTicker) jamTicker = setInterval(jamTickProgress, 500);
  if (!want && jamTicker) {
    clearInterval(jamTicker);
    jamTicker = null;
  }
}

function jamTickProgress() {
  if (!inJam() || seeking) return;
  const song = jamSong();
  if (!song) return;
  const dur = song.duration || 0;
  const pos = dur ? Math.min(jamTargetPos(), dur) : jamTargetPos();
  const pct = dur ? (pos / dur) * 100 : 0;
  $("#progress-fill").style.width = `${pct}%`;
  $("#progress-knob").style.left = `${pct}%`;
  $("#time-cur").textContent = fmtTime(pos);
  $("#time-dur").textContent = fmtTime(dur);
  if ($("#np-sheet").classList.contains("open")) {
    $("#np2-progress-fill").style.width = `${pct}%`;
    $("#np2-progress-knob").style.left = `${pct}%`;
    $("#np2-time-cur").textContent = fmtTime(pos);
  }
}

// seconds the seek bars should map to — remotes have no audio metadata,
// and while casting / on Sonos the remote device owns the clock
const seekDuration = () =>
  inJam() && !jamPlaysAudio()
    ? jamSong()?.duration || 0
    : castActive()
    ? castPlayer.duration || state.current?.duration || 0
    : sonosActive()
    ? sonosDur || state.current?.duration || 0
    : audio.duration || 0;

// periodic nudge back into sync (buffering, tab throttling, …). Listen
// together checks four times as often: it's steering with playbackRate, which
// needs to see the drift shrink to know when to stop.
function jamDriftCheck() {
  if (Date.now() - jamDriftAt < (isTogether() ? 750 : 3000)) return;
  jamDriftAt = Date.now();
  const j = state.jam;
  if (!j?.playing || !jamSong() || audio.paused || audio.readyState < 2)
    return jamSetRate(1);
  jamSyncPosition();
}

/* the browser blocked un-gestured playback — one tap re-joins the music.
   In a jam only the speaker ever sees this (remotes are silent by design);
   in listen together everyone needs their own gesture. */
function showJamResume() {
  if (jamPlaysAudio()) $("#jam-resume").classList.remove("hidden");
}
function hideJamResume() {
  $("#jam-resume").classList.add("hidden");
}
$("#jam-resume").addEventListener("click", () => {
  hideJamResume();
  jamApplyPlayback({ sync: true }); // runs inside the tap gesture, so play() is allowed
});

function enterJam(snap, opts = {}) {
  // a session takes over the audio — remote outputs can't own playback too
  if (castActive()) castCtx.endCurrentSession(true);
  if (sonosActive()) sonosStopToLocal({ silent: true });
  state.jam = { code: snap.code, youId: snap.you.id, mode: snap.mode || "speaker" };
  jamApplyState(snap);
  jamStartClock();
  jamLoadedKey = "";
  // a jam replaces any local listening context
  state.radio = null;
  state.shuffle = false;
  state.order = null;
  state.repeat = "off";
  applyShuffleRepeatUI();
  applyAutoplayUI();
  jamOpenEvents();
  jamApplyPlayback({ force: true });
  renderJamChip();
  renderQueuePanel();
  if (!opts.quiet)
    toast(
      snap.mode === "together"
        ? `You're listening together · code ${snap.code}`
        : `You're in the jam · code ${snap.code}`
    );
}

function exitJamMode(msg) {
  if (!inJam()) return;
  const j = state.jam;
  state.jam = null;
  if (jamES) {
    jamES.close();
    jamES = null;
  }
  jamStopClock();
  jamSyncTicker(); // stops the remote progress timer
  jamSetRate(1); // drop any drift-correction nudge
  hideJamResume();
  jamLoadedKey = "";
  // keep the music going: the jam queue becomes your local queue
  if (j.queue.length && j.index >= 0) {
    state.queue = j.queue.slice();
    state.qIndex = j.index;
    state.current = j.queue[j.index];
    state.insertAt = j.index + 1;
    state.order = null;
    // a remote never loaded the stream — give it a playable (paused) src so
    // the play button works, picking up from where the jam was
    const want = streamSrc(state.current);
    if (!audio.src || !audio.src.endsWith(want)) {
      const resumeAt = Math.max(
        0,
        j.playing ? j.pos + (Date.now() + j.offset - j.at) / 1000 : j.pos
      );
      audio.preload = "none";
      audio.src = want;
      if (resumeAt) {
        audio.addEventListener(
          "loadedmetadata",
          () => { audio.currentTime = Math.min(resumeAt, audio.duration || resumeAt); },
          { once: true }
        );
      }
      audio.addEventListener("play", () => { audio.preload = "auto"; }, { once: true });
    }
    savePlayerState(true);
  }
  applyAutoplayUI();
  updatePlayButton();
  renderJamChip();
  renderQueuePanel();
  if (msg) toast(msg);
  if (onJamRoute()) router();
}

function jamOpenEvents() {
  if (jamES) jamES.close();
  const es = new EventSource(`/api/jam/events?device=${encodeURIComponent(jamDeviceId())}`);
  jamES = es;
  const parse = (e) => JSON.parse(e.data);

  es.addEventListener("hello", (e) => {
    if (!inJam()) return;
    jamApplyState(parse(e));
    jamApplyPlayback({ sync: true });
    applyAutoplayUI();
    renderJamChip();
    renderQueuePanel();
    if (onJamRoute()) renderJamView();
  });

  es.addEventListener("sync", (e) => {
    if (!inJam()) return;
    const s = parse(e);
    Object.assign(state.jam, {
      index: s.index, playing: s.playing, pos: s.pos, at: s.at,
    });
    jamAdoptOffset(s.now);
    jamApplyPlayback({ sync: true });
    renderQueuePanel();
    if (onJamRoute()) renderJamView();
  });

  es.addEventListener("queue", (e) => {
    if (!inJam()) return;
    const q = parse(e);
    state.jam.queue = q.queue;
    state.jam.index = q.index;
    if (q.added && q.by && q.by !== state.user?.name) {
      toast(
        q.by === "Autoplay"
          ? "Autoplay added similar songs"
          : `${q.by} added ${q.added === 1 ? "a song" : `${q.added} songs`}`
      );
    }
    jamApplyPlayback(); // a removal can shift the index
    renderQueuePanel();
    if (onJamRoute()) renderJamView();
  });

  es.addEventListener("members", (e) => {
    if (!inJam()) return;
    const m = parse(e);
    const wasPlaying = jamPlaysAudio();
    state.jam.hostId = m.hostId;
    if (m.mode) state.jam.mode = m.mode;
    state.jam.speakerId = m.speakerId;
    state.jam.speakerOnline = m.speakerOnline;
    state.jam.members = m.members;
    // audio moved to (or away from) this device — start or stop the sound
    if (wasPlaying !== jamPlaysAudio()) jamApplyPlayback({ force: true });
    const note = m.note;
    const noun = jamNoun();
    if (note?.type === "join") toast(`${note.name} joined the ${noun}`);
    if (note?.type === "leave") toast(`${note.name} left the ${noun}`);
    if (note?.type === "kick") toast(`${note.name} was removed from the ${noun}`);
    if (note?.type === "host")
      toast(note.left ? `${note.left} left — ${note.name} hosts the ${noun} now` : `${note.name} hosts the ${noun} now`);
    renderJamChip();
    renderQueuePanel();
    if (onJamRoute()) renderJamView();
  });

  es.addEventListener("settings", (e) => {
    if (!inJam()) return;
    state.jam.settings = parse(e).settings;
    applyAutoplayUI();
    renderQueuePanel();
    if (onJamRoute()) renderJamView();
  });

  es.addEventListener("jam-ended", () =>
    exitJamMode(jamIsHost() ? `Ended the ${jamNoun()}` : `The host ended the ${jamNoun()}`));
  es.addEventListener("kicked", () => exitJamMode(`You were removed from the ${jamNoun()}`));
  es.addEventListener("left", () => exitJamMode()); // this account left from another tab

  es.onerror = () => {
    // EventSource retries by itself; but if the jam is truly gone (server
    // restarted), confirm once and exit instead of retrying forever
    if (!inJam() || Date.now() - jamRecheckAt < 5000) return;
    jamRecheckAt = Date.now();
    api.jamState()
      .then(({ jam: j }) => {
        if (!j && inJam()) exitJamMode("The jam ended");
      })
      .catch(() => {});
  };
}

/* topbar chip: always-visible way back to the session while it's on */
function renderJamChip() {
  const chip = $("#jam-chip");
  if (!inJam()) return chip.classList.add("hidden");
  const c = jamCopy(jamMode());
  chip.classList.remove("hidden");
  chip.setAttribute("href", jamRoute(jamMode()));
  chip.title = `Open the ${c.noun}`;
  chip.innerHTML = `${c.icon()}<span class="jam-chip-code">${esc(state.jam.code)}</span><span class="jam-chip-count">${state.jam.members.length}</span>`;
}

$("#np2-jam").addEventListener("click", () => {
  closeNpSheet();
  location.hash = inJam() ? jamRoute(jamMode()) : "#/jam";
});

/* ---------------- Google Cast (Chromecast) ----------------
   The web app is a Cast *sender*: while a session is on, the Chromecast
   fetches /api/stream itself (authenticated by a signed token, since it has
   no session cookie) and this UI becomes the remote — play/pause/seek/volume
   go to the receiver, track ends advance the same local queue, and stopping
   the session hands the audio back to this device at the cast position.
   Casting and jams are mutually exclusive: a jam already has one speaker. */
let castCtx = null; // cast.framework.CastContext once the SDK is up
let castPlayer = null; // RemotePlayer — mirrored receiver state
let castCtl = null; // RemotePlayerController
let castOn = false;
let castDeviceName = "";
let castHadMedia = false; // a track was loaded (guards the "ended" detection)
let castLastTime = 0; // last position/duration seen — the receiver clears its
let castLastDur = 0; //   media session on finish, so remember them
let castTokenCache = null; // { token, exp, base }
let castLoadSeq = 0; // stale async loads (user skipped meanwhile) are dropped

function castActive() {
  return castOn;
}

// the position of whatever is actually sounding: Chromecast, Sonos, or local
function playerTime() {
  if (castOn) return castPlayer.currentTime || 0;
  if (sonosActive()) return sonosNow();
  return audio.currentTime || 0;
}

// set by us before the SDK script (loaded after app.js) executes
window.__onGCastApiAvailable = (available) => {
  if (available && window.cast?.framework && window.chrome?.cast) initCast();
};

function initCast() {
  castCtx = cast.framework.CastContext.getInstance();
  castCtx.setOptions({
    receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED, // reload rejoins
  });
  castPlayer = new cast.framework.RemotePlayer();
  castCtl = new cast.framework.RemotePlayerController(castPlayer);

  const E = cast.framework.RemotePlayerEventType;
  castCtl.addEventListener(E.IS_PAUSED_CHANGED, () => castOn && updatePlayButton());
  castCtl.addEventListener(E.CURRENT_TIME_CHANGED, castTimeTick);
  castCtl.addEventListener(E.DURATION_CHANGED, () => {
    if (!castOn || !castPlayer.duration) return;
    castLastDur = castPlayer.duration;
    $("#time-dur").textContent = fmtTime(castPlayer.duration);
    $("#np2-time-dur").textContent = fmtTime(castPlayer.duration);
  });
  castCtl.addEventListener(E.VOLUME_LEVEL_CHANGED, castSyncVolume);
  castCtl.addEventListener(E.IS_MUTED_CHANGED, castSyncVolume);
  castCtl.addEventListener(E.IS_MEDIA_LOADED_CHANGED, castCheckEnded);
  castCtl.addEventListener(E.PLAYER_STATE_CHANGED, castCheckEnded);

  // The button is always in the UI (dimmed until some device is reachable) —
  // hiding it until discovery succeeds turns every network hiccup (VPN up,
  // mDNS blocked, wrong subnet) into a mysteriously missing button.
  castCtx.addEventListener(
    cast.framework.CastContextEventType.CAST_STATE_CHANGED,
    updateCastUI
  );
  updateCastUI();

  castCtx.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, (e) => {
    const S = cast.framework.SessionState;
    if (e.sessionState === S.SESSION_STARTED) onCastConnected(false);
    else if (e.sessionState === S.SESSION_RESUMED) onCastConnected(true);
    else if (e.sessionState === S.SESSION_ENDED) onCastDisconnected();
  });
}

function onCastConnected(resumed) {
  if (inJam()) {
    // the session owns the audio — don't fight it from a TV
    toast(`Casting isn't available during a ${jamNoun()}`, true);
    castCtx.endCurrentSession(true);
    return;
  }
  // whatever was sounding — this device or a Sonos — hands over to the TV
  const wasPlaying = sonosActive() ? sonosPlaying : !audio.paused && !!state.current;
  const at = playerTime() || state.resumeAt || 0;
  if (sonosActive()) sonosStopToLocal({ silent: true });
  castOn = true;
  castHadMedia = false;
  castLastTime = 0;
  castLastDur = 0;
  castDeviceName =
    castCtx.getCurrentSession()?.getCastDevice()?.friendlyName || "Cast device";
  audio.pause(); // the Chromecast sounds it from here on
  updateCastUI();
  castSyncVolume();
  if (resumed) {
    // page reload mid-cast: the receiver kept playing — just adopt its state
    castHadMedia = castPlayer.isMediaLoaded;
    castTimeTick();
  } else if (state.current) {
    // pick up exactly where this device was, playing or paused
    castLoad(state.current, at, wasPlaying);
  }
  updatePlayButton();
  toast(`Casting to ${castDeviceName}`);
}

function onCastDisconnected() {
  if (!castOn) return;
  const name = castDeviceName;
  const saved = castPlayer.savedPlayerState; // receiver state at disconnect
  const t = Number(saved ? saved.currentTime : castLastTime) || 0;
  const wasPlaying = saved ? !saved.isPaused : false;
  castOn = false;
  castDeviceName = "";
  castHadMedia = false;
  updateCastUI();
  if (inJam() || sonosActive()) {
    // cast ended because a jam or a Sonos speaker took over — not a handback
    updatePlayButton();
    return;
  }
  applyVolume(Number(localStorage.getItem("volume") ?? 80)); // local volume back
  if (state.current) {
    // hand the audio back to this device at the cast position (paused if the
    // browser blocks the un-gestured play — the button is primed either way)
    audio.preload = "auto";
    const want = streamSrc(state.current);
    if (!audio.src || !audio.src.endsWith(want)) audio.src = want;
    const seekTo = Math.min(t, state.current.duration || t);
    if (audio.readyState >= 1) audio.currentTime = seekTo;
    else if (seekTo)
      audio.addEventListener("loadedmetadata", () => { audio.currentTime = seekTo; }, { once: true });
    if (wasPlaying) audio.play().catch(() => {});
  }
  updatePlayButton();
  savePlayerState(true);
  if (name) toast(`Stopped casting to ${name}`);
}

// the output button reflects whichever remote output is on: Chromecast,
// a Sonos speaker, or an AirPlay route
function updateCastUI() {
  const remote = castOn || sonosActive() || airplayOn;
  const title = castOn
    ? `Casting to ${castDeviceName}`
    : sonosActive()
    ? `Playing on ${sonosDev.name}`
    : airplayOn
    ? "AirPlay is on"
    : "Playback devices";
  const icon = castOn ? I.castOn : sonosActive() ? I.speaker : airplayOn ? I.airplay : I.cast;
  // dim only when nothing remote is on AND Chrome has found no cast device
  // (castCtx null = browser can't cast at all — Sonos still works, keep dim)
  const dim =
    !remote &&
    (!castCtx ||
      castCtx.getCastState() === cast.framework.CastState.NO_DEVICES_AVAILABLE);
  const btn = $("#btn-cast");
  btn.innerHTML = icon;
  btn.title = title;
  btn.classList.toggle("active", remote);
  btn.classList.toggle("cast-nodevices", dim);
  const np2 = $("#np2-cast");
  np2.querySelector("[data-icon]").innerHTML = icon;
  np2.title = title;
  np2.classList.toggle("casting", remote);
  np2.classList.toggle("cast-nodevices", dim);
  $("#np-sheet-label").textContent = npSheetLabel();
}

// mirror the receiver's volume/mute into the slider while casting
function castSyncVolume() {
  if (!castOn) return;
  const v = Math.round((castPlayer.volumeLevel ?? 1) * 100);
  volumeEl.value = v;
  volumeEl.style.setProperty("--vol", `${v}%`);
  $("#btn-mute").innerHTML = castPlayer.isMuted || v === 0 ? I.mute : I.volume;
}

// the cast counterpart of the <audio> timeupdate handler
function castTimeTick() {
  if (!castOn || seeking) return;
  const cur = castPlayer.currentTime || 0;
  if (cur) castLastTime = cur;
  if (castPlayer.duration) castLastDur = castPlayer.duration;
  const dur = castLastDur || state.current?.duration || 0;
  const pct = dur ? (cur / dur) * 100 : 0;
  $("#progress-fill").style.width = `${pct}%`;
  $("#progress-knob").style.left = `${pct}%`;
  $("#time-cur").textContent = fmtTime(cur);
  if (dur) $("#time-dur").textContent = fmtTime(dur);
  if ($("#np-sheet").classList.contains("open")) {
    $("#np2-progress-fill").style.width = `${pct}%`;
    $("#np2-progress-knob").style.left = `${pct}%`;
    $("#np2-time-cur").textContent = fmtTime(cur);
  }
  savePlayerState();
  if (cur > 5) prefetchNext(); // warms the server's URL cache for the receiver
}

// a finished track on the receiver advances the queue, exactly like `ended`
function castCheckEnded() {
  if (!castOn) return;
  updatePlayButton();
  if (castPlayer.isMediaLoaded) {
    castHadMedia = true;
    return;
  }
  if (!castHadMedia) return;
  const reason = castCtx.getCurrentSession()?.getMediaSession()?.idleReason;
  const dur = castLastDur || state.current?.duration || 0;
  const finished =
    reason === chrome.cast.media.IdleReason.FINISHED ||
    // some receivers drop the media session on finish — near-the-end counts
    (reason == null && dur && castLastTime > dur - 3);
  if (!finished) return; // interrupted/cancelled loads are not an auto-advance
  castHadMedia = false;
  handleTrackEnded();
}

function castPlayPause() {
  if (castPlayer.isMediaLoaded) castCtl.playOrPause();
  // queue ran out (receiver went idle) — this tap replays the current track
  else if (state.current) castLoad(state.current, 0, true);
}

function castSeek(t) {
  if (!castPlayer.isMediaLoaded) return;
  castPlayer.currentTime = Math.max(0, t || 0);
  castCtl.seek();
}

async function castMediaToken() {
  if (castTokenCache && castTokenCache.exp - Date.now() > 60_000) return castTokenCache;
  castTokenCache = await api.castToken();
  return castTokenCache;
}

// the Chromecast must be able to reach this server: over a real hostname
// location.origin works as-is; on localhost swap in the server's LAN address
function castStreamBase() {
  const h = location.hostname;
  if ((h === "localhost" || h === "127.0.0.1") && castTokenCache?.base)
    return castTokenCache.base;
  return location.origin;
}

async function castLoad(song, startTime = 0, autoplay = true) {
  const seq = ++castLoadSeq;
  try {
    await castLoadOnce(song, startTime, autoplay, seq);
  } catch (err) {
    if (seq !== castLoadSeq || !castOn) return;
    castTokenCache = null; // stale token (server restarted?) — remint, retry once
    try {
      await castLoadOnce(song, startTime, autoplay, seq);
    } catch {
      toast(`Couldn't cast "${song.title}"`, true);
    }
  }
}

async function castLoadOnce(song, startTime, autoplay, seq) {
  const session = castCtx?.getCurrentSession();
  if (!session) return;
  // 2-byte ranged probe: resolves + caches the stream server-side (so the
  // receiver starts fast) and reveals the real container for contentType
  let contentType = "audio/mp4";
  try {
    const probe = await fetch(streamSrc(song), { headers: { Range: "bytes=0-1" } });
    const ct = (probe.headers.get("content-type") || "").split(";")[0].trim();
    if (ct.startsWith("audio/") || ct.startsWith("video/")) contentType = ct;
  } catch { /* the receiver can sniff it */ }
  const { token } = await castMediaToken();
  if (seq !== castLoadSeq || !castOn) return; // superseded while resolving

  const url = `${castStreamBase()}/api/stream/${encodeURIComponent(song.id)}?q=${state.quality}&t=${encodeURIComponent(token)}`;
  const info = new chrome.cast.media.MediaInfo(url, contentType);
  info.streamType = chrome.cast.media.StreamType.BUFFERED;
  const md = new chrome.cast.media.MusicTrackMediaMetadata();
  md.title = song.title;
  md.artist = song.artist;
  md.albumName = song.album || "";
  if (song.image) md.images = [new chrome.cast.Image(song.image)];
  info.metadata = md;
  if (song.duration) info.duration = Number(song.duration);

  const req = new chrome.cast.media.LoadRequest(info);
  req.currentTime = Math.max(0, startTime || 0);
  req.autoplay = autoplay;
  await session.loadMedia(req);
  if (seq === castLoadSeq) castHadMedia = true;
}

/* ---------------- Sonos ----------------
   Direct playback on Sonos speakers from ANY browser: the server drives the
   speaker over UPnP and the speaker fetches /api/stream (AAC variant) with a
   cast token, exactly like a Chromecast. The client polls the speaker's
   transport state to run the progress bar and advance the queue; the next
   track is pre-armed on the speaker (SetNextAVTransportURI) so transitions
   are gapless even if a poll is late. */
let sonosDev = null; // { ip, name } while a speaker is the output
let sonosPollTimer = null;
let sonosTickCount = 0;
let sonosPlaying = false;
let sonosPos = 0; // position at sonosPosAt — extrapolated between polls
let sonosPosAt = 0;
let sonosDur = 0;
let sonosLastSeen = 0; // last observed live position (for end-of-track detection)
let sonosNextUrl = ""; // stream URL armed on the speaker for gapless advance
let sonosNextIdx = -1; // queue index that URL belongs to
let sonosBusy = false; // a load/transfer in flight — polls stand down
let sonosVolTimer = null;
let sonosPrevVol = 30; // for the mute toggle

function sonosActive() {
  return !!sonosDev;
}

function sonosNow() {
  const t = sonosPlaying ? sonosPos + (Date.now() - sonosPosAt) / 1000 : sonosPos;
  return sonosDur ? Math.min(t, sonosDur) : t;
}

const sonosSongPayload = (s) => ({
  id: s.id,
  title: s.title,
  artist: s.artist,
  album: s.album,
  image: s.image,
  duration: s.duration,
});

async function sonosSelect(dev) {
  if (inJam()) return toast(`Playback devices are disabled during a ${jamNoun()}`, true);
  // capture the handover position from whatever is sounding right now
  let at = 0;
  let wasPlaying = false;
  if (castActive()) {
    at = castPlayer.currentTime || castLastTime || 0;
    wasPlaying = castPlayer.isMediaLoaded ? !castPlayer.isPaused : false;
  } else if (sonosActive()) {
    at = sonosNow();
    wasPlaying = sonosPlaying;
    api.sonosControl(sonosDev.ip, "stop").catch(() => {}); // the old speaker goes quiet
  } else {
    at = audio.currentTime || state.resumeAt || 0;
    wasPlaying = !audio.paused && !!state.current;
  }
  sonosDev = { ip: dev.ip, name: dev.name };
  sonosPlaying = false;
  sonosNextUrl = "";
  sonosNextIdx = -1;
  sonosLastSeen = 0;
  if (castActive()) castCtx.endCurrentSession(true); // handler sees sonosActive → no handback
  audio.pause();
  updateCastUI();
  updatePlayButton();
  sonosStartPoll();
  api.sonosStatus(sonosDev.ip)
    .then((st) => st.volume != null && sonosReflectVolume(st.volume))
    .catch(() => {});
  if (state.current) {
    toast(`Playing on ${dev.name}`);
    await sonosLoad(state.current, at, wasPlaying || !at); // idle-but-loaded starts fresh
  } else {
    toast(`Ready on ${dev.name} — play something`);
  }
}

async function sonosLoad(song, at = 0, autoplay = true) {
  if (!sonosDev) return;
  const ip = sonosDev.ip;
  sonosBusy = true;
  sonosPos = at;
  sonosPosAt = Date.now();
  sonosDur = song.duration || 0;
  sonosLastSeen = at;
  sonosNextUrl = "";
  sonosNextIdx = -1;
  try {
    await api.sonosPlay(ip, sonosSongPayload(song), at);
    sonosPlaying = true;
    if (!autoplay) {
      await api.sonosControl(ip, "pause").catch(() => {});
      sonosPlaying = false;
    }
    sonosQueueNext();
  } catch (err) {
    sonosPlaying = false;
    toast(`${sonosDev?.name || "Device"}: ${err.message}`, true);
  } finally {
    sonosBusy = false;
    updatePlayButton();
  }
}

// keep the speaker's "next" slot pointed at whatever should follow — re-run
// after queue edits and each poll (no-op when the target hasn't changed)
async function sonosQueueNext() {
  if (!sonosDev) return;
  const ni = state.repeat === "one" ? state.qIndex : computeNextIndex();
  if (ni < 0 || !state.queue[ni]) {
    sonosNextUrl = "";
    sonosNextIdx = -1;
    return;
  }
  if (ni === sonosNextIdx) return;
  const target = state.queue[ni];
  try {
    const { streamUrl } = await api.sonosNextUri(sonosDev.ip, sonosSongPayload(target));
    sonosNextUrl = streamUrl;
    sonosNextIdx = ni;
  } catch { /* gapless is a nicety — the poll-based advance still works */ }
}

function sonosStartPoll() {
  clearInterval(sonosPollTimer);
  sonosTickCount = 0;
  // UI every 500ms from the extrapolated clock; the speaker itself every 2s
  sonosPollTimer = setInterval(() => {
    sonosTick();
    if (++sonosTickCount % 4 === 0) sonosPollStatus();
  }, 500);
}

function sonosTick() {
  if (!sonosDev || seeking) return;
  const cur = sonosNow();
  if (sonosPlaying) sonosLastSeen = cur;
  const dur = sonosDur || state.current?.duration || 0;
  const pct = dur ? Math.min(100, (cur / dur) * 100) : 0;
  $("#progress-fill").style.width = `${pct}%`;
  $("#progress-knob").style.left = `${pct}%`;
  $("#time-cur").textContent = fmtTime(cur);
  if (dur) $("#time-dur").textContent = fmtTime(dur);
  if ($("#np-sheet").classList.contains("open")) {
    $("#np2-progress-fill").style.width = `${pct}%`;
    $("#np2-progress-knob").style.left = `${pct}%`;
    $("#np2-time-cur").textContent = fmtTime(cur);
  }
  savePlayerState();
  if (cur > 5) prefetchNext(); // warms the resolver for the speaker's next fetch
}

async function sonosPollStatus() {
  if (!sonosDev || sonosBusy || seeking) return;
  const ip = sonosDev.ip;
  let st;
  try {
    st = await api.sonosStatus(ip);
  } catch {
    return; // transient LAN hiccup — keep the previous state
  }
  if (!sonosDev || sonosDev.ip !== ip || sonosBusy) return;
  // the speaker rolled itself into the armed next track (gapless advance)
  if (sonosNextUrl && st.trackUri === sonosNextUrl) {
    const ni = sonosNextIdx;
    sonosNextUrl = "";
    sonosNextIdx = -1;
    sonosAdoptAdvance(ni, st);
    return;
  }
  const wasPlaying = sonosPlaying;
  sonosPlaying = st.state === "PLAYING" || st.state === "TRANSITIONING";
  if (st.state !== "TRANSITIONING") {
    sonosPos = st.pos;
    sonosPosAt = Date.now();
  }
  if (st.duration) sonosDur = st.duration;
  if (st.volume != null) sonosReflectVolume(st.volume);
  updatePlayButton();
  // finished with nothing armed (queue end / arm failed): STOPPED at ~the end
  const dur = sonosDur || state.current?.duration || 0;
  if (
    wasPlaying &&
    st.state === "STOPPED" &&
    state.current &&
    dur &&
    sonosLastSeen > dur - 6
  ) {
    sonosLastSeen = 0;
    handleTrackEnded();
    return;
  }
  sonosQueueNext(); // repoint the armed next track after queue/shuffle edits
}

// the speaker already started queue index `ni` on its own — adopt, don't reload
function sonosAdoptAdvance(ni, st) {
  sonosPos = st.pos;
  sonosPosAt = Date.now();
  sonosPlaying = true;
  sonosLastSeen = st.pos;
  if (state.repeat === "one") {
    // the same track was armed — it simply restarted
    sonosQueueNext();
    return;
  }
  const song = state.queue[ni];
  if (!song) return;
  sonosDur = st.duration || song.duration || 0;
  audio.preload = "none";
  audio.src = streamSrc(song); // primed for a later handback
  markTrackCurrent(ni, song);
  updatePlayButton();
  sonosQueueNext();
}

function sonosPlayPause() {
  if (!sonosDev || !state.current) return;
  const ip = sonosDev.ip;
  if (sonosPlaying) {
    sonosPos = sonosNow(); // freeze the clock where it is
    sonosPosAt = Date.now();
    sonosPlaying = false;
    updatePlayButton();
    api.sonosControl(ip, "pause").catch(() => {});
  } else {
    sonosPlaying = true;
    sonosPosAt = Date.now();
    updatePlayButton();
    api.sonosControl(ip, "play").catch(() => {
      // transport lost (stopped at queue end, speaker restarted) — reload
      if (sonosDev && state.current) sonosLoad(state.current, sonosNow(), true);
    });
  }
}

function sonosSeek(t) {
  if (!sonosDev) return;
  sonosPos = Math.max(0, t || 0);
  sonosPosAt = Date.now();
  sonosLastSeen = sonosPos;
  api.sonosControl(sonosDev.ip, "seek", { pos: Math.round(sonosPos) }).catch(() => {});
}

function sonosSetVolume(v) {
  clearTimeout(sonosVolTimer);
  sonosVolTimer = setTimeout(() => {
    sonosVolTimer = null;
    if (sonosDev) api.sonosControl(sonosDev.ip, "volume", { volume: v }).catch(() => {});
  }, 150);
}

function sonosReflectVolume(v) {
  if (sonosVolTimer) return; // the user is dragging — don't fight them
  volumeEl.value = v;
  volumeEl.style.setProperty("--vol", `${v}%`);
  $("#btn-mute").innerHTML = v === 0 ? I.mute : I.volume;
}

function sonosToggleMute() {
  const v = Number(volumeEl.value);
  if (v > 0) sonosPrevVol = v;
  const next = v > 0 ? 0 : sonosPrevVol || 30;
  sonosReflectVolume(next);
  if (sonosDev) api.sonosControl(sonosDev.ip, "volume", { volume: next }).catch(() => {});
}

// back to this device (or just detach silently when a jam/cast takes over)
function sonosStopToLocal(opts = {}) {
  if (!sonosDev) return;
  const { ip, name } = sonosDev;
  const t = sonosNow();
  const wasPlaying = sonosPlaying;
  clearInterval(sonosPollTimer);
  sonosPollTimer = null;
  sonosDev = null;
  sonosPlaying = false;
  sonosNextUrl = "";
  sonosNextIdx = -1;
  api.sonosControl(ip, "stop").catch(() => {}); // leave the speaker quiet
  updateCastUI();
  if (opts.silent) {
    updatePlayButton();
    return;
  }
  applyVolume(Number(localStorage.getItem("volume") ?? 80));
  if (state.current) {
    audio.preload = "auto";
    const want = streamSrc(state.current);
    if (!audio.src || !audio.src.endsWith(want)) audio.src = want;
    const seekTo = Math.min(t, state.current.duration || t);
    if (audio.readyState >= 1) audio.currentTime = seekTo;
    else if (seekTo)
      audio.addEventListener("loadedmetadata", () => { audio.currentTime = seekTo; }, { once: true });
    if (wasPlaying) audio.play().catch(() => {});
  }
  updatePlayButton();
  savePlayerState(true);
  toast(`Stopped playing on ${name}`);
}

/* ---------------- AirPlay (Safari) ----------------
   Safari routes the local <audio> to AirPlay-2 gear — Sonos included — via
   the system picker. Playback stays on this device, so every existing
   control keeps working; there is nothing to re-route. */
let airplayOn = false;
let airplayAvailable = false;

const airplaySupported = () =>
  typeof audio.webkitShowPlaybackTargetPicker === "function" &&
  !!window.WebKitPlaybackTargetAvailabilityEvent;

if (window.WebKitPlaybackTargetAvailabilityEvent) {
  audio.addEventListener("webkitplaybacktargetavailabilitychanged", (e) => {
    airplayAvailable = e.availability === "available";
  });
  audio.addEventListener("webkitcurrentplaybacktargetiswirelesschanged", () => {
    airplayOn = !!audio.webkitCurrentPlaybackTargetIsWireless;
    updateCastUI();
    toast(airplayOn ? "AirPlay on" : "AirPlay off");
  });
}

/* ---------------- output menu ----------------
   One button, one menu, every way the audio can leave this tab. */
async function openOutputMenu(e) {
  if (inJam())
    return toast(
      isTogether()
        ? "Playback devices are disabled while listening together — the sync only holds on this device"
        : "Playback devices are disabled in a jam — the jam speaker owns the audio",
      true
    );
  const x = e.clientX, y = e.clientY;
  const localOn = !castOn && !sonosActive() && !airplayOn;
  popover.innerHTML = `
    <div class="popover-title">Play on</div>
    <button class="popover-item ${localOn ? "out-on" : ""}" data-out="local">
      ${I.volume}<span>This ${isPhone() ? "phone" : "computer"}</span></button>
    ${castCtx ? `
    <button class="popover-item ${castOn ? "out-on" : ""}" data-out="cast">
      ${I.cast}<span>${castOn ? `Chromecast · ${esc(castDeviceName)}` : "Chromecast…"}</span></button>` : ""}
    ${airplaySupported() ? `
    <button class="popover-item ${airplayOn ? "out-on" : airplayAvailable ? "" : "cast-nodevices"}" data-out="airplay">
      ${I.airplay}<span>AirPlay${airplayOn ? " · on" : "…"}</span></button>` : ""}
    <div id="sonos-slot"><div class="popover-note">Looking for speakers & TVs…</div></div>
    ${!castCtx && !airplaySupported() ? `
    <div class="popover-note">Chromecast needs Google Chrome and AirPlay needs
      Safari on an Apple device — speakers and TVs found on your network work
      from any browser.</div>` : ""}`;
  popover.classList.remove("hidden");
  positionPopover(x, y);

  popover.onclick = (ev) => {
    const btn = ev.target.closest("[data-out]");
    if (!btn) return;
    const kind = btn.dataset.out;
    closePopover();
    if (kind === "local") {
      if (castOn) castCtx.endCurrentSession(true);
      else if (sonosActive()) sonosStopToLocal();
      else if (airplayOn) audio.webkitShowPlaybackTargetPicker(); // route back via the picker
    } else if (kind === "cast") {
      castCtx.requestSession().catch(() => {}); // "cancel" isn't an error
    } else if (kind === "airplay") {
      audio.webkitShowPlaybackTargetPicker();
    } else if (kind === "sonos") {
      if (sonosDev?.ip !== btn.dataset.ip)
        sonosSelect({ ip: btn.dataset.ip, name: btn.dataset.name });
    }
  };

  // fill the Sonos rows once the scan answers (first SSDP sweep takes ~2s)
  try {
    const devices = await api.sonosDevices();
    const slot = $("#sonos-slot");
    if (!slot || popover.classList.contains("hidden")) return;
    slot.innerHTML = devices.length
      ? devices.map((d) => `
        <button class="popover-item ${sonosDev?.ip === d.ip ? "out-on" : ""}"
          data-out="sonos" data-ip="${esc(d.ip)}" data-name="${esc(d.name)}">
          ${d.kind === "renderer" ? I.tv : I.speaker}<span>${esc(d.name)} <small class="out-model">${esc(d.model || "Media renderer")}</small></span>
        </button>`).join("")
      : `<div class="popover-note">No speakers or TVs found on this network.</div>`;
    positionPopover(x, y);
  } catch {
    const slot = $("#sonos-slot");
    if (slot) slot.innerHTML = `<div class="popover-note">Couldn't scan for playback devices.</div>`;
  }
}

$("#btn-cast").addEventListener("click", openOutputMenu);
$("#np2-cast").addEventListener("click", openOutputMenu);

/* ---------------- like / playlists ---------------- */
async function toggleLike(song) {
  try {
    const { liked, songs } = await api.toggleLike(song);
    state.library.liked = songs;
    toast(liked ? "Added to Liked Songs" : "Removed from Liked Songs");
    updateNowPlaying();
    renderSidebar();
    refreshLikeButtons();
    if (currentRoute === "liked") router();
  } catch (err) {
    toast(err.message, true);
  }
}

function refreshLikeButtons() {
  const ids = likedIds();
  document.querySelectorAll(".track").forEach((row) => {
    const song = viewCtx.songs[Number(row.dataset.idx)];
    const btn = row.querySelector(".act-like");
    if (!song || !btn) return;
    const on = ids.has(song.id);
    btn.innerHTML = on ? I.heartFill : I.heart;
    btn.classList.toggle("on", on);
  });
}

/* ---------------- downloads ---------------- */
function startDownload(href, msg) {
  const a = document.createElement("a");
  a.href = href;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast(msg);
}

function triggerDownload(song, fmt) {
  const name = `${song.artist} - ${song.title}`;
  startDownload(
    `/api/download/${encodeURIComponent(song.id)}?fmt=${encodeURIComponent(fmt)}&name=${encodeURIComponent(name)}`,
    "Preparing download — it starts in a few seconds…"
  );
}

function triggerLosslessDownload(song) {
  const p = new URLSearchParams({
    title: song.title,
    artist: song.artist,
    name: `${song.artist} - ${song.title}`,
  });
  startDownload(`/api/download-lossless?${p}`, "Fetching lossless FLAC — this can take a moment…");
}

/* ---- the download ----
   One action, one format: FLAC. The server prefers a real lossless master and
   only transcodes the YouTube source if none is reachable, so the toast says
   which you actually got instead of implying every file is a master.
   Shift-click any download button for the old per-format picker. */
async function downloadFlac(song) {
  const p = new URLSearchParams({
    title: song.title || "",
    artist: song.artist || "",
    name: `${song.artist} - ${song.title}`,
  });
  startDownload(`/api/download-flac/${encodeURIComponent(song.id)}?${p}`, "Getting FLAC…");

  // The <a download> navigation can't hand us response headers, so ask the
  // (server-cached) probe what the source will be and report it after the fact.
  try {
    const res = await api.get(
      `/api/lossless?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`
    );
    if (res.available) {
      const hz = res.sampleRate ? ` / ${res.sampleRate} kHz` : "";
      toast(`FLAC · ${res.bitDepth || 16}-bit${hz} from ${res.provider}`);
    } else {
      toast("No lossless master found — converting the YouTube source to FLAC");
    }
  } catch { /* the download is already running; the note is a courtesy */ }
}

// Plain click downloads FLAC; shift/alt-click opens the format picker for the
// rare case you actually want an MP3 or a specific YouTube stream.
const downloadOrPick = (e, song) =>
  e.shiftKey || e.altKey ? openDownloadPopover(e, song) : downloadFlac(song);

async function openDownloadPopover(e, song) {
  const x = e.clientX, y = e.clientY;
  popover.innerHTML = `<div class="popover-title">Download “${esc(song.title)}”</div>
    <div class="popover-note">Checking available formats…</div>`;
  popover.classList.remove("hidden");
  positionPopover(x, y);

  let data;
  try {
    data = await api.formats(song.id);
  } catch (err) {
    popover.innerHTML = `<div class="popover-title">Download</div>
      <div class="popover-note">Couldn't read formats: ${esc(err.message)}</div>`;
    return;
  }
  if (popover.classList.contains("hidden")) return; // closed while loading

  const native = data.formats
    .map((f) => `
      <button class="popover-item" data-fmt="${esc(f.id)}">
        ${f.lossless ? I.heartFill : I.download}
        <span class="dl-label">
          <b>${esc(f.codec.toUpperCase())}${f.lossless ? " · lossless" : ""}</b>
          <small>${f.abr ? `${f.abr} kbps · ` : ""}${esc(f.ext)}${f.size ? ` · ${fmtBytes(f.size)}` : ""}</small>
        </span>
      </button>`)
    .join("");

  popover.innerHTML = `
    <div class="popover-title">Download “${esc(song.title)}”</div>
    <div class="popover-section">True lossless <span class="dl-badge">FLAC</span></div>
    <div id="dl-lossless"><div class="popover-note">Checking free lossless sources…</div></div>
    <div class="popover-section">YouTube source</div>
    ${native || `<div class="popover-note">No audio formats found.</div>`}
    <div class="popover-section">Convert (from best YouTube source)</div>
    <button class="popover-item" data-fmt="flac">${I.download}<span class="dl-label"><b>FLAC</b><small>lossless container of the YouTube source</small></span></button>
    <button class="popover-item" data-fmt="mp3">${I.download}<span class="dl-label"><b>MP3</b><small>best quality, maximum compatibility</small></span></button>`;
  positionPopover(x, y);

  popover.onclick = (ev) => {
    const lossBtn = ev.target.closest("[data-lossless]");
    if (lossBtn) {
      closePopover();
      triggerLosslessDownload(song);
      return;
    }
    const btn = ev.target.closest("[data-fmt]");
    if (!btn) return;
    closePopover();
    triggerDownload(song, btn.dataset.fmt);
  };

  // Probe the free lossless (Qobuz) sources in the background and fill the slot
  api.get(`/api/lossless?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`)
    .then((res) => {
      const slot = $("#dl-lossless");
      if (!slot || popover.classList.contains("hidden")) return;
      if (res.available) {
        const hz = res.sampleRate ? `${res.sampleRate} kHz` : "";
        const src = res.provider || "Lossless";
        slot.innerHTML = `
          <button class="popover-item lossless-item" data-lossless="1">
            ${I.heartFill}
            <span class="dl-label">
              <b>FLAC · ${res.bitDepth || 16}-bit${hz ? " / " + esc(hz) : ""} <span class="dl-src">${esc(src)}</span></b>
              <small>${esc(src)} match: ${esc(res.matchedTitle || song.title)}${res.matchedArtist ? " · " + esc(res.matchedArtist) : ""}</small>
            </span>
          </button>`;
      } else {
        slot.innerHTML = `<div class="popover-note">No free lossless match reachable right now (Tidal &amp; Qobuz sources unreachable). Use a YouTube source below, or set <code>TIDAL_API_BASE</code> / <code>LOSSLESS_API_BASE</code> to a working instance.</div>`;
      }
      positionPopover(x, y);
    })
    .catch(() => {
      const slot = $("#dl-lossless");
      if (slot) slot.innerHTML = `<div class="popover-note">Couldn't reach the lossless sources.</div>`;
    });
}

/* ---------------- popover (add to playlist) ---------------- */
const popover = $("#popover");

function positionPopover(x, y) {
  const rect = popover.getBoundingClientRect();
  popover.style.left = `${Math.max(12, Math.min(x, window.innerWidth - rect.width - 12))}px`;
  popover.style.top = `${Math.min(y, window.innerHeight - rect.height - 12)}px`;
}

// Phone overflow menu: one "⋮" per row surfaces every action (touch has no
// hover, and the inline buttons don't fit a narrow row).
function openRowMenu(e, song, opts = {}) {
  const liked = likedIds().has(song.id);
  popover.innerHTML = `
    <div class="popover-title">${esc(song.title)}</div>
    <button class="popover-item" data-row="like">${liked ? I.heartFill : I.heart}<span>${liked ? "Remove from Liked Songs" : "Save to Liked Songs"}</span></button>
    <button class="popover-item" data-row="add">${I.plus}<span>Add to playlist</span></button>
    <button class="popover-item" data-row="queue">${I.addQueue}<span>Add to queue</span></button>
    <button class="popover-item" data-row="download">${I.download}<span>Download FLAC</span></button>
    ${opts.removable ? `<button class="popover-item" data-row="remove">${I.close}<span>Remove from this playlist</span></button>` : ""}`;
  popover.classList.remove("hidden");
  positionPopover(e.clientX, e.clientY);

  popover.onclick = async (ev) => {
    const btn = ev.target.closest("[data-row]");
    if (!btn) return;
    const act = btn.dataset.row;
    closePopover();
    if (act === "like") return toggleLike(song);
    if (act === "queue") return addToQueue(song);
    if (act === "add") return openAddPopover(e, song);
    if (act === "download") return downloadOrPick(e, song);
    if (act === "remove") {
      const p = await api.removeFromPlaylist(opts.playlistId, song.id);
      state.library.playlists = state.library.playlists.map((x) => (x.id === p.id ? p : x));
      renderSidebar();
      router();
    }
  };
}

function openAddPopover(e, song) {
  const items = state.library.playlists
    .map(
      (p) => `<button class="popover-item" data-pid="${p.id}">${I.note}<span>${esc(p.name)}</span></button>`
    )
    .join("");
  popover.innerHTML = `
    <div class="popover-title">Add to playlist</div>
    <button class="popover-item" data-new="1">${I.plus}<span>New playlist</span></button>
    ${items}`;
  popover.classList.remove("hidden");
  const rect = popover.getBoundingClientRect();
  let x = Math.min(e.clientX, window.innerWidth - rect.width - 12);
  let y = Math.min(e.clientY, window.innerHeight - rect.height - 12);
  popover.style.left = `${x}px`;
  popover.style.top = `${y}px`;

  popover.onclick = async (ev) => {
    const btn = ev.target.closest(".popover-item");
    if (!btn) return;
    closePopover();
    try {
      if (btn.dataset.new) {
        const name = await modalPrompt("Create playlist", song.album || "My Playlist");
        if (!name) return;
        const p = await api.createPlaylist(name);
        await api.addToPlaylist(p.id, song);
        state.library = await api.library();
        renderSidebar();
        toast(`Added to "${name}"`);
      } else {
        const { added, playlist } = await api.addToPlaylist(btn.dataset.pid, song);
        state.library.playlists = state.library.playlists.map((p) =>
          p.id === playlist.id ? playlist : p
        );
        renderSidebar();
        toast(added ? `Added to "${playlist.name}"` : `Already in "${playlist.name}"`);
        if (currentRoute === "playlist") router();
      }
    } catch (err) {
      toast(err.message, true);
    }
  };
}

function closePopover() {
  popover.classList.add("hidden");
  popover.onclick = null;
}

document.addEventListener("click", (e) => {
  if (!popover.classList.contains("hidden") && !popover.contains(e.target)) closePopover();
}, true);

/* ---------------- modal ---------------- */
const modal = $("#modal");

function modalPrompt(title, placeholder = "", value = "") {
  return new Promise((resolve) => {
    $("#modal-title").textContent = title;
    const input = $("#modal-input");
    input.placeholder = placeholder;
    input.value = value;
    modal.showModal();
    input.focus();
    input.select();

    const done = (val) => {
      modal.close();
      $("#modal-form").onsubmit = null;
      $("#modal-cancel").onclick = null;
      resolve(val);
    };
    $("#modal-form").onsubmit = (e) => {
      e.preventDefault();
      done(input.value.trim());
    };
    $("#modal-cancel").onclick = () => done(null);
    modal.oncancel = () => done(null);
  });
}

$("#btn-new-playlist").addEventListener("click", async () => {
  const name = await modalPrompt("Create playlist", "My Playlist");
  if (!name) return;
  const p = await api.createPlaylist(name);
  state.library.playlists.push(p);
  renderSidebar();
  location.hash = `#/playlist/${p.id}`;
});

/* ---------------- user chip / account menu ---------------- */
function renderUserChip() {
  const chip = $("#user-chip");
  if (!state.user) return chip.classList.add("hidden");
  chip.classList.remove("hidden");
  chip.innerHTML = `<span class="user-avatar">${esc((state.user.name || "?")[0].toUpperCase())}</span>
    <span class="user-name">${esc(state.user.name)}</span>`;
}

$("#user-chip").addEventListener("click", (e) => {
  e.stopPropagation();
  const adminItem = state.user?.role === "admin"
    ? `<button class="popover-item" data-act="admin">${I.library}<span>Manage users</span></button>`
    : "";
  // Everything account-shaped now lives in the Profile tab; this stays as a
  // shortcut into it rather than a second, competing menu.
  popover.innerHTML = `
    <div class="popover-title">${esc(state.user?.email || "")}</div>
    <button class="popover-item" data-act="profile">${I.person}<span>Your profile</span></button>
    <button class="popover-item" data-act="friends">${I.group}<span>Friends</span></button>
    <button class="popover-item" data-act="settings">${I.sparkle}<span>Settings</span></button>
    ${adminItem}
    <button class="popover-item" data-act="jam">${I.group}<span>Jam session</span></button>
    <button class="popover-item" data-act="logout">${I.close}<span>Log out</span></button>`;
  popover.classList.remove("hidden");
  const rect = $("#user-chip").getBoundingClientRect();
  popover.style.left = "auto";
  popover.style.left = `${Math.max(12, rect.right - 220)}px`;
  popover.style.top = `${rect.bottom + 8}px`;

  popover.onclick = async (ev) => {
    const btn = ev.target.closest(".popover-item");
    if (!btn) return;
    closePopover();
    const act = btn.dataset.act;
    if (act === "admin") location.hash = "#/profile";
    if (act === "jam") location.hash = inJam() ? jamRoute(jamMode()) : "#/jam";
    if (act === "profile") location.hash = "#/profile";
    if (act === "friends") location.hash = "#/profile/friends";
    if (act === "settings") location.hash = "#/profile/settings";
    if (act === "logout") logout();
  };
});

/* ---- change password modal ---- */
const pwModal = $("#pw-modal");

function openPasswordModal() {
  $("#pw-current").value = "";
  $("#pw-new").value = "";
  $("#pw-err").textContent = "";
  pwModal.showModal();
  $("#pw-current").focus();
}

$("#pw-cancel").addEventListener("click", () => pwModal.close());

$("#pw-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#pw-err").textContent = "";
  try {
    await api.changePassword($("#pw-current").value, $("#pw-new").value);
    pwModal.close();
    toast("Password changed — other devices were signed out");
  } catch (err) {
    $("#pw-err").textContent = err.message;
  }
});

/* ---------------- sidebar ---------------- */
function renderSidebar() {
  $("#liked-count").textContent = `Playlist · ${state.library.liked.length} songs`;
  $("#saves-count").textContent = `Listen later · ${(state.library.saves || []).length} songs`;

  // Smart lists sit above hand-made playlists and are only shown when they'd
  // actually contain something.
  const smart = allSmartLists().filter((l) => l.pick().length);
  $("#sidebar-smart").innerHTML = smart.length
    ? `<div class="lib-section nav-label">Smart playlists</div>` +
      smart.map((l) => `
        <a class="lib-item" href="#/smart/${encodeURIComponent(l.id)}">
          <span class="lib-cover-empty smart-cover">${I.sparkle}</span>
          <span class="lib-meta nav-label">
            <span class="lib-name">${esc(l.name)}</span>
            <span class="lib-sub">Auto · ${l.pick().length} songs</span>
          </span></a>`).join("")
    : "";

  const ul = $("#playlist-list");
  ul.innerHTML = state.library.playlists
    .map((p) => {
      const imgs = p.songs.slice(0, 4).map((s) => s.image).filter(Boolean);
      let cover;
      if (imgs.length >= 4) {
        cover = `<span class="lib-cover-collage">${imgs.map((u) => `<img src="${esc(u)}">`).join("")}</span>`;
      } else if (imgs.length) {
        cover = `<img class="lib-cover" src="${esc(imgs[0])}">`;
      } else {
        cover = `<span class="lib-cover-empty">${I.note}</span>`;
      }
      return `<li><a class="lib-item" href="#/playlist/${p.id}" data-plid="${p.id}">
        ${cover}
        <span class="lib-meta nav-label">
          <span class="lib-name">${esc(p.name)}</span>
          <span class="lib-sub">Playlist · ${p.songs.length} songs</span>
        </span></a></li>`;
    })
    .join("");

  $("#sidebar-albums").innerHTML = state.library.albums.length
    ? `<div class="lib-section nav-label">Albums</div>` +
      state.library.albums.map((a) => `
        <a class="lib-item" href="#/album/${encodeURIComponent(a.token)}">
          ${a.image ? `<img class="lib-cover" loading="lazy" src="${esc(a.image)}">` : `<span class="lib-cover-empty">${I.note}</span>`}
          <span class="lib-meta nav-label">
            <span class="lib-name">${esc(a.title)}</span>
            <span class="lib-sub">Album · ${esc(a.artist)}</span>
          </span></a>`).join("")
    : "";

  $("#sidebar-artists").innerHTML = state.library.artists.length
    ? `<div class="lib-section nav-label">Artists</div>` +
      state.library.artists.map((a) => `
        <a class="lib-item" href="#/artist/${encodeURIComponent(a.id)}">
          ${a.image ? `<img class="lib-cover round" loading="lazy" src="${esc(a.image)}">` : `<span class="lib-cover-empty round">${I.person}</span>`}
          <span class="lib-meta nav-label">
            <span class="lib-name">${esc(a.name)}</span>
            <span class="lib-sub">Artist</span>
          </span></a>`).join("")
    : "";

  markActiveNav();
}

/* Fixed-width by default; the full-page library is an explicit, remembered
   choice rather than something a stray drag can trigger. */
function applyLibraryMode() {
  document.body.classList.toggle("library-full", !!prefs.libraryFull);
  const btn = $("#btn-lib-full");
  if (btn) {
    btn.innerHTML = prefs.libraryFull ? I.collapse : I.expand;
    btn.title = prefs.libraryFull ? "Back to the sidebar" : "Open the full-page library";
  }
}

$("#btn-lib-full").addEventListener("click", () => {
  setPref("libraryFull", !prefs.libraryFull);
  applyLibraryMode();
  if (prefs.libraryFull) location.hash = "#/library";
});

/* ---- playlist import (.json from the export button) ---- */
const importFile = $("#import-file");

async function importFromFile(file) {
  try {
    const data = JSON.parse(await file.text());
    const songs = Array.isArray(data) ? data : data.songs;
    if (!Array.isArray(songs) || !songs.length) throw new Error("No songs found in that file");
    const name = data.name || file.name.replace(/\.marusic\.json$|\.json$/i, "");
    const p = await api.importPlaylist(name, songs);
    state.library.playlists.push(p);
    renderSidebar();
    toast(`Imported "${p.name}" (${p.songs.length} songs)`);
    location.hash = `#/playlist/${p.id}`;
  } catch (err) {
    toast(err.message.startsWith("Unexpected") ? "That file isn't valid JSON" : err.message, true);
  }
}

importFile.addEventListener("change", () => {
  if (importFile.files[0]) importFromFile(importFile.files[0]);
  importFile.value = "";
});

$("#btn-import-playlist").addEventListener("click", () => importFile.click());

/* ---------------- views ---------------- */
const view = $("#view");
let viewCtx = { songs: [], playlistId: null };
let currentRoute = "";

/* ---------------- content-type visual language ----------------
   Everything browsable carries the same three cues, so you can tell what a
   card *is* before reading a word of it:
     shape — playlists stack, releases sit in a sleeve, singles show a disc
             edge, stations are a tuning dial, artists are a bare circle
     mark  — a glyph pinned to the corner of the artwork
     hue   — one colour per type, shared by the mark and the chip
   The hues live in styles.css as --t-<type>; the legend below spells the
   whole system out once, on Home. */
const TYPES = {
  playlist: { label: "Playlist", icon: "stack",   note: "many artists, one list" },
  mix:      { label: "Mix",      icon: "sparkle", note: "built from your history" },
  single:   { label: "Single",   icon: "disc",    note: "one track, plays now" },
  album:    { label: "Album",    icon: "sleeve",  note: "a full release" },
  ep:       { label: "EP",       icon: "sleeve",  note: "a short release" },
  station:  { label: "Station",  icon: "waves",   note: "endless, never ends" },
  artist:   { label: "Artist",   icon: "person",  note: "everything by them" },
};

const TYPE_LEGEND = `
  <div class="type-legend">
    ${["playlist", "single", "album", "ep", "station"]
      .map((t) => `<span class="legend-item" data-type="${t}">
        <span class="legend-mark">${I[TYPES[t].icon]}</span>
        <b>${TYPES[t].label}</b><i>${TYPES[t].note}</i>
      </span>`)
      .join("")}
  </div>`;

// Playlist covers read as a stack of four — instantly not-an-album.
const mosaicHTML = (imgs) =>
  `<div class="art-mosaic">${imgs
    .slice(0, 4)
    .map((src) => `<img loading="lazy" src="${esc(src)}" alt="">`)
    .join("")}</div>`;

const CARD = (o) => {
  const t = TYPES[o.type];
  const cover = o.mosaic?.length >= 4
    ? mosaicHTML(o.mosaic)
    : artImg(o.image, "", t ? I[t.icon] : I.note);
  return `
  <div class="card" data-card="${o.kind}"${o.type ? ` data-type="${o.type}"` : ""} ${o.attrs || ""}>
    <div class="card-art${o.round ? " round" : ""}"${o.color ? ` style="--card-tint:${esc(o.color)}"` : ""}>
      <div class="art-frame">
        ${cover}
        ${t ? `<span class="art-mark" title="${t.label}">${I[t.icon]}</span>` : ""}
      </div>
      ${o.noPlay ? "" : `<button class="card-play" title="Play">${I.play}</button>`}
    </div>
    <div class="card-title">${esc(o.title)}</div>
    <div class="card-sub">
      ${t ? `<span class="type-chip">${t.label}</span>` : ""}
      ${o.sub ? `<span class="sub-text">${esc(o.sub)}</span>` : ""}
    </div>
  </div>`;
};

const artistLine = (s, cls = "t-artist") =>
  s.artistId
    ? `<a class="${cls} artist-link" data-artist="${esc(s.artistId)}" title="Go to artist">${esc(s.artist)}</a>`
    : `<div class="${cls}">${esc(s.artist)}</div>`;

function trackListHTML(songs, opts = {}) {
  const liked_ = likedIds();
  const saved_ = savedIds();
  const rows = songs
    .map((s, i) => {
      const liked = liked_.has(s.id);
      const saved = saved_.has(s.id);
      const playing = state.current?.id === s.id;
      // `data-search` gives the in-page filter a clean haystack — the row's own
      // text includes durations and menu labels that would match by accident.
      return `<div class="track ${playing ? "playing" : ""}" data-idx="${i}" ${opts.reorderable ? 'draggable="true"' : ""}
          data-search="${esc(`${s.title} ${s.artist} ${s.album}`)}">
        <div class="t-num">
          ${opts.selectable ? `<label class="t-check"><input type="checkbox" class="row-select"><span>${I.check}</span></label>` : ""}
          <span class="num">${i + 1}</span><button class="row-play">${I.play}</button>
        </div>
        <div class="t-main">
          ${artImg(s.image)}
          <div class="t-text">
            <div class="t-title">${esc(s.title)}</div>
            ${artistLine(s)}
          </div>
        </div>
        <div class="t-album">${esc(s.album)}</div>
        <div class="t-actions">
          <button class="icon-btn act-like ${liked ? "on" : ""}" title="Add to Liked Songs">${liked ? I.heartFill : I.heart}</button>
          <button class="icon-btn act-save ${saved ? "on" : ""}" title="${saved ? "Remove from Saves" : "Save for later"}">${saved ? I.bookmarkFill : I.bookmark}</button>
          <button class="icon-btn act-add" title="Add to a playlist">${I.plus}</button>
          <button class="icon-btn act-queue" title="Add to queue">${I.addQueue}</button>
          <button class="icon-btn act-download" title="Download FLAC (shift-click for other formats)">${I.download}</button>
          ${opts.removable ? `<button class="icon-btn act-remove" title="Remove from this playlist">${I.close}</button>` : ""}
          <button class="icon-btn act-more" title="More">${I.more}</button>
          <span class="t-dur">${s.duration ? fmtTime(s.duration) : "–:––"}</span>
        </div>
      </div>`;
    })
    .join("");
  return `<div class="tracklist ${opts.noAlbum ? "no-album" : ""}${opts.selectable ? " selectable" : ""}">
    <div class="tracklist-header">
      <span>${opts.selectable ? `<label class="t-check"><input type="checkbox" id="select-all"><span>${I.check}</span></label>` : "#"}</span>
      <span>Title</span><span class="th-album">Album</span><span class="th-dur">⏱</span>
    </div>
    ${rows}
  </div>`;
}

function highlightPlayingRow() {
  document.querySelectorAll(".track").forEach((row) => {
    const song = viewCtx.songs[Number(row.dataset.idx)];
    row.classList.toggle("playing", !!song && state.current?.id === song.id);
  });
}

/* track list + card delegation */
view.addEventListener("click", async (e) => {
  const chip = e.target.closest(".suggest-chip");
  if (chip) {
    searchInput.value = chip.dataset.q;
    state.searchQ = chip.dataset.q;
    clearTimeout(searchTimer);
    // a Browse tile is a search — results live on the search route
    if (currentRoute !== "search") location.hash = "#/search";
    else renderSearch();
    fetchSuggestions();
    return;
  }

  const artistLink = e.target.closest("[data-artist]");
  if (artistLink) {
    e.preventDefault();
    location.hash = `#/artist/${encodeURIComponent(artistLink.dataset.artist)}`;
    return;
  }

  const track = e.target.closest(".track");
  if (track) {
    const idx = Number(track.dataset.idx);
    const song = viewCtx.songs[idx];
    if (!song) return;
    if (e.target.closest(".act-more"))
      return openRowMenu(e, song, { removable: !!viewCtx.playlistId, playlistId: viewCtx.playlistId });
    if (e.target.closest(".act-like")) return toggleLike(song);
    if (e.target.closest(".act-save")) return toggleSave(song);
    if (e.target.closest(".row-select")) return; // selection is handled below
    if (e.target.closest(".t-check")) return;
    if (e.target.closest(".act-add")) return openAddPopover(e, song);
    if (e.target.closest(".act-queue")) return addToQueue(song);
    if (e.target.closest(".act-download")) return downloadOrPick(e, song);
    if (e.target.closest(".act-remove")) {
      const p = await api.removeFromPlaylist(viewCtx.playlistId, song.id);
      state.library.playlists = state.library.playlists.map((x) => (x.id === p.id ? p : x));
      renderSidebar();
      router();
      return;
    }
    // On a results page the list is something you were reading, not a queue you
    // chose — one pick starts that track and a radio built from it.
    if (viewCtx.songRadio) playSongRadio(song);
    else playQueue(viewCtx.songs, idx);
    return;
  }

  const card = e.target.closest("[data-card]");
  if (card) {
    const playClicked = !!e.target.closest(".card-play");
    const kind = card.dataset.card;
    if (kind === "song") {
      const idx = Number(card.dataset.idx);
      if (viewCtx.songRadio) playSongRadio(viewCtx.songs[idx]);
      else playQueue(viewCtx.songs, idx);
    } else if (kind === "video") {
      // Video cards sit on the search overview beside the song rows, so they
      // index into their own list rather than viewCtx.songs.
      playSongRadio(searchData?.videos?.[Number(card.dataset.idx)]);
    } else if (kind === "quickpick") {
      const pick = homeQuickPicks[Number(card.dataset.idx)];
      if (!pick) return;
      if (e.target.closest(".qp-more")) return openRowMenu(e, pick);
      // The picks are a shelf you chose to look at, so they play as a set —
      // the same as tapping one in YouTube Music's own grid.
      playQueue(homeQuickPicks, Number(card.dataset.idx));
    } else if (kind === "album") {
      if (playClicked) {
        try {
          const album = await api.album(card.dataset.token);
          if (!album.songs.length) return toast("Album unavailable", true);
          playQueue(album.songs, 0);
        } catch (err) { toast(err.message, true); }
      } else {
        location.hash = `#/album/${encodeURIComponent(card.dataset.token)}`;
      }
    } else if (kind === "station") {
      startRadio(card.dataset.name);
    } else if (kind === "trending") {
      if (playClicked && homeTrending.length) playQueue(homeTrending, 0);
      else location.hash = "#/trending";
    } else if (kind === "history") {
      const songs = state.library.history;
      playQueue(songs, Number(card.dataset.idx));
    } else if (kind === "playlist") {
      location.hash = `#/playlist/${card.dataset.id}`;
    } else if (kind === "liked") {
      location.hash = "#/liked";
    } else if (kind === "saves") {
      location.hash = "#/saves";
    } else if (kind === "artist") {
      location.hash = `#/artist/${encodeURIComponent(card.dataset.id)}`;
    } else if (kind === "mix") {
      const mix = homeMixes.find((m) => m.id === card.dataset.id);
      if (mix?.songs?.length) playQueue(mix.songs, 0);
    } else if (kind === "ytplaylist") {
      if (playClicked) {
        try {
          const p = await api.publicPlaylist(card.dataset.token);
          if (!p.songs.length) return toast("Playlist unavailable", true);
          playQueue(p.songs, 0);
        } catch (err) { toast(err.message, true); }
      } else {
        location.hash = `#/ytplaylist/${encodeURIComponent(card.dataset.token)}`;
      }
    }
  }
});

/* ---- drag-to-reorder (playlist view only: rows carry draggable) ---- */
let dragFrom = null;

view.addEventListener("dragstart", (e) => {
  const row = e.target.closest(".track[draggable]");
  if (!row || !viewCtx.playlistId) return;
  dragFrom = Number(row.dataset.idx);
  e.dataTransfer.effectAllowed = "move";
});

view.addEventListener("dragover", (e) => {
  if (dragFrom == null) return;
  const row = e.target.closest(".track[draggable]");
  if (!row) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  document.querySelectorAll(".track.drop-target").forEach((r) => r.classList.remove("drop-target"));
  if (Number(row.dataset.idx) !== dragFrom) row.classList.add("drop-target");
});

view.addEventListener("dragend", () => {
  dragFrom = null;
  document.querySelectorAll(".track.drop-target").forEach((r) => r.classList.remove("drop-target"));
});

view.addEventListener("drop", async (e) => {
  const row = e.target.closest(".track[draggable]");
  if (dragFrom == null || !row || !viewCtx.playlistId) return;
  e.preventDefault();
  const to = Number(row.dataset.idx);
  const from = dragFrom;
  dragFrom = null;
  if (to === from) return;
  const songs = viewCtx.songs.slice();
  const [moved] = songs.splice(from, 1);
  songs.splice(to, 0, moved);
  try {
    const p = await api.reorderPlaylist(viewCtx.playlistId, songs.map((s) => s.id));
    state.library.playlists = state.library.playlists.map((x) => (x.id === p.id ? p : x));
    router();
  } catch (err) { toast(err.message, true); }
});

async function startRadio(name) {
  try {
    toast(`Starting ${name} Radio…`);
    const { songs, next: n } = await api.radioQueue(name, 1);
    if (!songs.length) return toast("Station returned no songs", true);
    playQueue(songs, 0, { radio: { name, next: n } });
  } catch (err) {
    toast(err.message, true);
  }
}

/* ---- home ----
   Every shelf is a row you own: pin it to the top, hide it outright, or drag
   it wherever you want. The layout lives in prefs, so it survives reloads. */
const HOME_ROWS = [
  { id: "shortcuts", label: "Shortcuts" },
  { id: "quickpicks", label: "Quick picks" },
  { id: "mixes", label: "Made for you" },
  { id: "history", label: "Jump back in" },
  { id: "trending", label: "Trending" },
  { id: "radio", label: "Radio stations" },
];

let homeEditing = false;

// Stored layout is merged with the built-in list so a new shelf in a future
// version still shows up for someone with a saved order.
function homeLayout() {
  const saved = prefs.homeRows;
  const known = new Map(HOME_ROWS.map((r) => [r.id, r]));
  const out = [];
  if (Array.isArray(saved)) {
    for (const row of saved) {
      if (!known.has(row.id)) continue;
      out.push({ ...known.get(row.id), hidden: !!row.hidden, pinned: !!row.pinned });
      known.delete(row.id);
    }
  }
  for (const r of known.values()) out.push({ ...r, hidden: false, pinned: false });
  // Pinned rows float to the top but keep their order among themselves.
  return [...out.filter((r) => r.pinned), ...out.filter((r) => !r.pinned)];
}

const saveHomeLayout = (rows) =>
  setPref("homeRows", rows.map(({ id, hidden, pinned }) => ({ id, hidden, pinned })));

function renderHome() {
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const { history, playlists } = state.library;
  const cold = !history.length && !playlists.length && !state.library.liked.length;
  const rows = homeLayout();

  const shortcuts = [
    state.library.liked.length
      ? `<div class="shortcut" data-card="liked"><span class="liked-cover">${I.heartFill}</span><span class="sc-name">Liked Songs</span></div>`
      : "",
    (state.library.saves || []).length
      ? `<div class="shortcut" data-card="saves"><span class="saves-cover">${I.bookmarkFill}</span><span class="sc-name">Saves</span></div>`
      : "",
    ...playlists.slice(0, 5).map((p) => {
      const img = p.songs[0]?.image;
      return `<div class="shortcut" data-card="playlist" data-id="${p.id}">
        ${img ? `<img src="${esc(img)}">` : `<span class="liked-cover" style="background:linear-gradient(135deg,#27856a,#1e3264)">${I.note}</span>`}
        <span class="sc-name">${esc(p.name)}</span></div>`;
    }),
  ].join("");

  // Each row is wrapped so the customise controls have something to grab.
  const wrap = (row, inner) => `
    <section class="home-row${row.hidden ? " row-hidden" : ""}${row.pinned ? " row-pinned" : ""}"
             data-row="${row.id}" ${homeEditing ? 'draggable="true"' : ""}>
      <div class="row-tools">
        <span class="row-grip" title="Drag to reorder">${I.drag}</span>
        <span class="row-name">${esc(row.label)}</span>
        <button class="row-tool" data-row-pin="${row.id}" title="${row.pinned ? "Unpin" : "Pin to the top"}">${I.pin}</button>
        <button class="row-tool" data-row-hide="${row.id}" title="${row.hidden ? "Show this row" : "Hide this row"}">${row.hidden ? I.eye : I.eyeOff}</button>
      </div>
      ${inner}
    </section>`;

  const bodyFor = (row) => {
    if (row.id === "shortcuts")
      return shortcuts ? `<div class="shortcut-grid">${shortcuts}</div>` : "";
    if (row.id === "quickpicks") return `<div class="section" id="home-quickpicks"></div>`;
    if (row.id === "mixes") return `<div class="section" id="home-mixes"></div>`;
    if (row.id === "history")
      return history.length ? `
        <div class="section">
          <h2>Jump back in</h2>
          <div class="card-grid shelf">
            ${history.slice(0, 14).map((s, i) =>
              CARD({ kind: "history", type: "single", attrs: `data-idx="${i}"`, image: s.image, title: s.title, sub: s.artist })
            ).join("")}
          </div>
        </div>` : "";
    if (row.id === "trending") return `<div class="section" id="home-trending"></div>`;
    if (row.id === "radio") return `<div class="section" id="home-radio"></div>`;
    return "";
  };

  view.innerHTML = `
    <div class="home-head">
      <div class="greeting">${greeting}</div>
      <button class="btn-outline${homeEditing ? " on" : ""}" id="home-customise">
        ${homeEditing ? "Done" : "Customise"}
      </button>
    </div>
    ${homeEditing ? `<p class="home-hint">Drag a row to reorder it, pin it to the top, or hide it. Hidden rows stay here while you're editing.</p>` : ""}
    ${cold ? `
      <div class="hero">
        ${I.note}
        <h2>Welcome to Marusic</h2>
        <p>Your personal streaming player, powered by the music-cli backend.
        Head to <a href="#/search" style="color:var(--accent);font-weight:700">Search</a> to find your first song,
        or tune into a <a href="#/radio" style="color:var(--accent);font-weight:700">Radio</a> station.</p>
      </div>` : ""}
    <div id="home-rows">
      ${rows.filter((r) => homeEditing || !r.hidden).map((r) => wrap(r, bodyFor(r))).join("")}
    </div>`;

  viewCtx = { songs: history.slice(0, 100), playlistId: null };
  setTabTitle("Home");

  $("#home-customise").onclick = () => { homeEditing = !homeEditing; renderHome(); };

  const wanted = (id) => rows.some((r) => r.id === id && (homeEditing || !r.hidden));
  if (wanted("quickpicks")) loadHomeQuickPicks();
  if (wanted("mixes")) loadHomeMixes();
  if (wanted("trending")) loadHomeTrending();
  if (wanted("radio")) loadHomeRadio();
  mountShelfControls();
}

/* ---- home row controls ---- */
function mutateHomeRow(id, patch) {
  const rows = homeLayout().map((r) => (r.id === id ? { ...r, ...patch } : r));
  saveHomeLayout(rows);
  renderHome();
}

view.addEventListener("click", (e) => {
  const pin = e.target.closest("[data-row-pin]");
  if (pin) {
    const row = homeLayout().find((r) => r.id === pin.dataset.rowPin);
    return mutateHomeRow(pin.dataset.rowPin, { pinned: !row.pinned });
  }
  const hide = e.target.closest("[data-row-hide]");
  if (hide) {
    const row = homeLayout().find((r) => r.id === hide.dataset.rowHide);
    return mutateHomeRow(hide.dataset.rowHide, { hidden: !row.hidden });
  }
});

/* Reordering the shelves themselves — same drag idiom as reordering a playlist. */
let rowDragId = null;

view.addEventListener("dragstart", (e) => {
  const row = e.target.closest(".home-row[draggable]");
  if (!row) return;
  rowDragId = row.dataset.row;
  e.dataTransfer.effectAllowed = "move";
});

view.addEventListener("dragover", (e) => {
  if (!rowDragId) return;
  const row = e.target.closest(".home-row[draggable]");
  if (!row) return;
  e.preventDefault();
  document.querySelectorAll(".home-row.row-drop").forEach((r) => r.classList.remove("row-drop"));
  if (row.dataset.row !== rowDragId) row.classList.add("row-drop");
});

view.addEventListener("drop", (e) => {
  const target = e.target.closest(".home-row[draggable]");
  if (!rowDragId || !target) return;
  e.preventDefault();
  const from = rowDragId;
  rowDragId = null;
  if (target.dataset.row === from) return;
  const rows = homeLayout();
  const fromIdx = rows.findIndex((r) => r.id === from);
  const toIdx = rows.findIndex((r) => r.id === target.dataset.row);
  const [moved] = rows.splice(fromIdx, 1);
  // Dropping onto an unpinned row un-pins the dragged one, so the order you
  // see is always the order you get.
  moved.pinned = rows[toIdx]?.pinned ?? false;
  rows.splice(toIdx, 0, moved);
  saveHomeLayout(rows);
  renderHome();
});

view.addEventListener("dragend", () => {
  rowDragId = null;
  document.querySelectorAll(".home-row.row-drop").forEach((r) => r.classList.remove("row-drop"));
});

let homeTrending = [];        // the trending singles, as one playlist
let homeTrendingReleases = []; // trending albums & EPs, shown beside it
let homeMixes = [];
let homeQuickPicks = [];

// Cards for the trending releases — kind stays "album" (same click handler),
// only the visual type differs between a full album and a short EP/single.
const trendingReleaseCards = (releases) =>
  releases.map((r) =>
    CARD({
      kind: "album",
      type: (TYPES[String(r.kind).toLowerCase()] ? String(r.kind).toLowerCase() : "album"),
      attrs: `data-token="${esc(r.token)}"`,
      image: r.image,
      title: r.title,
      sub: [r.year, r.artist].filter(Boolean).join(" · "),
    })
  ).join("");

const trendingPlaylistCard = (singles) =>
  CARD({
    kind: "trending",
    type: "playlist",
    image: singles[0]?.image,
    mosaic: singles.map((s) => s.image).filter(Boolean),
    title: "Trending Singles",
    sub: `${singles.length} single${singles.length === 1 ? "" : "s"} · YouTube Music`,
  });

/* Quick picks — the speed dial.
   A wall of single tracks four deep that pages sideways, so a screenful puts a
   dozen songs one tap away instead of a dozen things to open first. Deliberately
   not cards: cards are for something you browse into, and none of these have an
   inside. */
const quickPickHTML = (s, i) => `
  <div class="qp" data-card="quickpick" data-idx="${i}">
    ${artImg(s.image, "qp-art")}
    <div class="qp-text">
      <div class="qp-title">${esc(s.title)}</div>
      <div class="qp-sub">${esc(s.artist)}</div>
    </div>
    <button class="icon-btn qp-more" title="More">${I.more}</button>
  </div>`;

async function loadHomeQuickPicks() {
  try {
    const { songs = [], seeded } = await api.quickPicks();
    const el = $("#home-quickpicks");
    if (!el || !songs.length) return;
    homeQuickPicks = songs;
    el.innerHTML = `
      <h2>Quick picks
        <button class="btn-outline qp-playall" id="qp-play-all">Play all</button>
      </h2>
      <p class="section-note">${seeded
        ? "Built from what you play most — one tap each."
        : "Trending right now. Play a few songs and these become yours."}</p>
      <div class="qp-grid shelf">${songs.map(quickPickHTML).join("")}</div>`;
    $("#qp-play-all").onclick = () => playQueue(homeQuickPicks, 0);
    mountShelfControls();
  } catch { /* quick picks are a shelf like any other — optional */ }
}

async function loadHomeMixes() {
  try {
    const { mixes } = await api.mixes();
    const el = $("#home-mixes");
    if (!el || !mixes.length) return;
    homeMixes = mixes;
    el.innerHTML = `
      <h2>Made for you</h2>
      <div class="card-grid shelf">
        ${mixes.map((m) =>
          CARD({ kind: "mix", type: "mix", attrs: `data-id="${esc(m.id)}"`, image: m.image, title: m.title, sub: m.basedOn })
        ).join("")}
      </div>`;
    mountShelfControls();
  } catch { /* mixes need listening history — shelf is optional */ }
}

// Trending leads with one playlist holding every trending single, then the
// albums & EPs sit alongside it in the same shelf.
async function loadHomeTrending() {
  try {
    const { singles = [], releases = [] } = await api.get("/api/trending");
    const el = $("#home-trending");
    if (!el || (!singles.length && !releases.length)) return;
    homeTrending = singles;
    homeTrendingReleases = releases;
    el.innerHTML = `
      <h2>Trending ${singles.length ? `<a class="see-all" href="#/trending">Show all</a>` : ""}</h2>
      ${TYPE_LEGEND}
      <div class="card-grid shelf">
        ${singles.length ? trendingPlaylistCard(singles) : ""}
        ${trendingReleaseCards(releases.slice(0, 14))}
      </div>`;
    mountShelfControls();
  } catch { /* trending shelf is optional */ }
}

async function loadHomeRadio() {
  try {
    const stations = await api.radioStations();
    const el = $("#home-radio");
    if (!el) return;
    const shown = stations.slice(0, 5);
    el.innerHTML = `
      <h2>Radio stations <a class="see-all" href="#/radio">Show all</a></h2>
      <div class="card-grid shelf">${stationCards(shown)}</div>`;
    mountShelfControls();
    hydrateStationArt(shown);
  } catch { /* radio section is optional on home */ }
}

/* ---- search ---- */
let searchToken = 0;
let searchSuggestions = []; // typeahead for the current query, shown in-page

const suggestHTML = () =>
  searchSuggestions.length
    ? `<div class="section">
        <h2 class="suggest-head">Related searches</h2>
        <div class="suggest-strip">
          ${searchSuggestions
            .map((s) => `<button class="suggest-chip" data-q="${esc(s)}">${I.search}<span>${esc(s)}</span></button>`)
            .join("")}
        </div>
      </div>`
    : "";

// The search view is re-rendered whole, so the strip is repainted into its slot
// rather than living in the markup of any one branch.
function paintSuggestions() {
  const el = $("#search-suggest");
  if (el) el.innerHTML = suggestHTML();
}

/* Browse tiles, grouped into named categories instead of one undifferentiated
   wall of colour. Each tile just seeds a search. */
const BROWSE_CATEGORIES = [
  {
    name: "Genres",
    tiles: ["Pop", "Hip-Hop", "Rock", "R&B", "Electronic", "Jazz", "Classical",
            "Country", "Metal", "Indie", "Latin", "Arabic"],
  },
  {
    name: "Moods & moments",
    tiles: ["Chill", "Focus", "Workout", "Party", "Sleep", "Romance",
            "Feel good", "Sad", "Commute", "Dinner"],
  },
  {
    name: "Decades",
    tiles: ["60s", "70s", "80s", "90s", "2000s", "2010s", "2020s"],
  },
  {
    name: "Formats",
    tiles: ["Live", "Acoustic", "Remix", "Covers", "Instrumental", "Soundtrack"],
  },
];

const browseSectionsHTML = () =>
  BROWSE_CATEGORIES.map((cat) => `
    <div class="section">
      <h2>${esc(cat.name)}</h2>
      <div class="browse-grid">
        ${cat.tiles.map((t) => `
          <button class="browse-tile suggest-chip" data-q="${esc(t)}"
                  style="--tile:${gradientFor(t)}">${esc(t)}</button>`).join("")}
      </div>
    </div>`).join("");

/* ---- search results ----
   Results arrive already sorted into kinds, and the page keeps them that way:
   a filter row across the top, an "All" overview that shows the head of every
   kind, and a focused page per kind behind each chip. Switching chips never
   refetches — the whole response is held in `searchData`. */
const SEARCH_FILTERS = [
  { id: "all", label: "All" },
  { id: "songs", label: "Songs" },
  { id: "videos", label: "Videos" },
  { id: "albums", label: "Albums" },
  { id: "singles", label: "Singles & EPs" },
  { id: "artists", label: "Artists" },
  { id: "playlists", label: "Playlists" },
];

let searchFilter = "all";
let searchData = null;  // the last response, kept for chip switching
let searchDataQ = "";   // the query it belongs to

const artistCards = (artists) =>
  artists.map((a) =>
    CARD({ kind: "artist", type: "artist", round: true, noPlay: true,
           attrs: `data-id="${esc(a.id)}"`, image: a.image, title: a.name, sub: "" })
  ).join("");

// One card shape for every release; only the type badge tells an album from an
// EP from a single.
const releaseCards = (releases) =>
  releases.map((r) => {
    const type = String(r.kind || "album").toLowerCase();
    return CARD({
      kind: "album",
      type: TYPES[type] ? type : "album",
      attrs: `data-token="${esc(r.token)}"`,
      image: r.image,
      title: r.title,
      sub: [r.year, r.artist].filter(Boolean).join(" · "),
    });
  }).join("");

const ytPlaylistCards = (playlists) =>
  playlists.map((p) =>
    CARD({ kind: "ytplaylist", type: "playlist", attrs: `data-token="${esc(p.browseId)}"`,
           image: p.image, title: p.title, sub: p.author ? `By ${p.author}` : "YouTube Music" })
  ).join("");

// YouTube Music leads with the artist when the query is basically their name,
// and with a track otherwise. Same rule here.
function topResult(q, { songs, artists }) {
  const needle = q.toLowerCase();
  const artist = artists.find((a) => {
    const name = a.name.toLowerCase();
    return name === needle || name.startsWith(needle) || needle.startsWith(name);
  });
  if (artist) return { kind: "artist", item: artist };
  return songs[0] ? { kind: "song", item: songs[0] } : null;
}

const topResultHTML = (top) =>
  top.kind === "artist"
    ? `<div class="top-result" data-card="artist" data-id="${esc(top.item.id)}">
         ${artImg(top.item.image, "round")}
         <div>
           <div class="tr-title">${esc(top.item.name)}</div>
           <div class="tr-sub">Artist</div>
         </div>
       </div>`
    : `<div class="top-result" data-card="song" data-idx="0">
         ${artImg(top.item.image)}
         <div>
           <div class="tr-title">${esc(top.item.title)}</div>
           <div class="tr-sub">Song · <b>${esc(top.item.artist)}</b></div>
         </div>
         <button class="card-play">${I.play}</button>
       </div>`;

const searchSection = (title, body, seeAll) =>
  body ? `<div class="section">
    <h2>${esc(title)}${seeAll ? ` <a class="see-all" data-filter="${seeAll}">Show all</a>` : ""}</h2>
    ${body}
  </div>` : "";

/* The moods & genres catalogue — the Browse tab on every screen size. The
   search field is the only search: in the header on desktop, behind the
   header's search icon on phones (where the empty Search page also shows this
   grid under the field). Either way a tile is a search. */
function renderBrowse() {
  view.innerHTML = `
    <div id="search-suggest"></div>
    <h1 class="page-title">Browse everything</h1>
    ${browseSectionsHTML()}`;
  viewCtx = { songs: [], playlistId: null };
  setTabTitle(currentRoute === "browse" ? "Browse" : "Search");
  paintSuggestions();
}

function renderSearch() {
  const q = state.searchQ.trim();
  if (!q) return renderBrowse();

  // A repeat of the query we already hold (a chip click) repaints from memory.
  if (searchData && searchDataQ === q) return paintSearch(q);

  searchFilter = "all";
  view.innerHTML = `<div class="spinner"></div>`;
  const token = ++searchToken;

  api.search(q).then((data) => {
    if (token !== searchToken || currentRoute !== "search") return;
    searchData = {
      songs: data.songs || [],
      videos: data.videos || [],
      albums: data.albums || [],
      singles: data.singles || [],
      artists: data.artists || [],
      playlists: data.playlists || [],
    };
    searchDataQ = q;
    paintSearch(q);
  }).catch((err) => {
    if (token !== searchToken) return;
    view.innerHTML = `<div class="search-empty"><h3>Search failed</h3><p>${esc(err.message)}</p></div>`;
  });
}

function paintSearch(q) {
  const d = searchData;
  const counts = {
    songs: d.songs.length, videos: d.videos.length, albums: d.albums.length,
    singles: d.singles.length, artists: d.artists.length, playlists: d.playlists.length,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  setTabTitle(`“${q}”`);

  if (!total) {
    view.innerHTML = `
      <div class="search-empty">
        <h3>No results found for "${esc(q)}"</h3>
        <p>Check the spelling, or try different keywords.</p>
      </div>
      <div id="search-suggest"></div>`;
    viewCtx = { songs: [], playlistId: null };
    paintSuggestions();
    return;
  }

  // Only offer a chip for a kind that actually came back.
  const chips = SEARCH_FILTERS
    .filter((f) => f.id === "all" || counts[f.id])
    .map((f) => `<button class="chip${searchFilter === f.id ? " on" : ""}" data-filter="${f.id}">${f.label}</button>`)
    .join("");

  // Whichever list the visible rows index into — the click handler reads this.
  let rowSongs = d.songs;
  let body;

  if (searchFilter === "songs" || searchFilter === "videos") {
    rowSongs = searchFilter === "songs" ? d.songs : d.videos;
    body = `<div class="section">
      <h2>${searchFilter === "songs" ? "Songs" : "Videos"}</h2>
      <div id="search-rows"></div>
    </div>`;
  } else if (searchFilter === "albums") {
    body = searchSection("Albums", `<div class="card-grid">${releaseCards(d.albums)}</div>`);
  } else if (searchFilter === "singles") {
    body = searchSection("Singles & EPs", `<div class="card-grid">${releaseCards(d.singles)}</div>`);
  } else if (searchFilter === "artists") {
    body = searchSection("Artists", `<div class="card-grid">${artistCards(d.artists)}</div>`);
  } else if (searchFilter === "playlists") {
    body = searchSection("Playlists", `<div class="card-grid">${ytPlaylistCards(d.playlists)}</div>`);
  } else {
    const top = topResult(q, d);
    body = `
      ${top ? `<div class="section">
        <div class="search-top">
          <div>
            <h2>Top result</h2>
            ${topResultHTML(top)}
          </div>
          <div>
            <h2>Songs${counts.songs > 5 ? ` <a class="see-all" data-filter="songs">Show all</a>` : ""}</h2>
            <div id="search-rows"></div>
          </div>
        </div>
      </div>` : ""}
      ${searchSection("Artists", counts.artists ? `<div class="card-grid">${artistCards(d.artists.slice(0, 6))}</div>` : "",
                      counts.artists > 6 ? "artists" : "")}
      ${searchSection("Albums", counts.albums ? `<div class="card-grid">${releaseCards(d.albums.slice(0, 10))}</div>` : "",
                      counts.albums > 10 ? "albums" : "")}
      ${searchSection("Singles & EPs", counts.singles ? `<div class="card-grid">${releaseCards(d.singles.slice(0, 10))}</div>` : "",
                      counts.singles > 10 ? "singles" : "")}
      ${searchSection("Videos", counts.videos ? `<div class="card-grid">${
        d.videos.slice(0, 10).map((v, i) =>
          CARD({ kind: "video", type: "single", attrs: `data-idx="${i}"`, image: v.image, title: v.title, sub: v.artist })
        ).join("")}</div>` : "", counts.videos > 10 ? "videos" : "")}
      ${searchSection("Playlists", counts.playlists ? `<div class="card-grid">${ytPlaylistCards(d.playlists.slice(0, 10))}</div>` : "",
                      counts.playlists > 10 ? "playlists" : "")}`;
  }

  view.innerHTML = `
    <div class="chip-row search-filters">${chips}</div>
    <div id="search-suggest"></div>
    ${body}`;

  // songRadio: picking one of these plays that track and a radio from it,
  // rather than queueing everything you were only scanning.
  viewCtx = { songs: rowSongs, playlistId: null, songRadio: true };
  paintSuggestions();

  const rows = $("#search-rows");
  if (rows) {
    rows.innerHTML = trackListHTML(
      searchFilter === "all" ? rowSongs.slice(0, 5) : rowSongs,
      { noAlbum: searchFilter === "all" }
    );
  }
  highlightPlayingRow();
}

// Chips and every "Show all" link drive the same filter.
view.addEventListener("click", (e) => {
  if (currentRoute !== "search") return;
  const el = e.target.closest("[data-filter]");
  if (!el || !searchData) return;
  e.preventDefault();
  searchFilter = el.dataset.filter;
  paintSearch(state.searchQ.trim());
});

const searchInput = $("#search-input");
let searchTimer;

searchInput.addEventListener("input", () => {
  state.searchQ = searchInput.value;
  $("#search-clear").classList.toggle("hidden", !searchInput.value);
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    // The field is live on every route now, so the first keystroke is what
    // takes you to Search — you never have to go there first.
    if (currentRoute !== "search") location.hash = "#/search";
    else renderSearch();
  }, 350);
  fetchSuggestions();
});

/* ---- where the search field lives ----
   One input, two homes. On desktop it sits in the header, ready on every
   route. On phones the header has no room for it, so the very same element is
   moved down into the Search page (reached from the header's search icon) —
   moved rather than duplicated, so every handler bound to #search-input keeps
   working and the two can't drift apart. */
const phoneSearchSlot = $("#phone-search");

function placeSearchBar() {
  const bar = $("#topbar-search");
  const onPhone = isPhone();

  if (onPhone && bar.parentElement !== phoneSearchSlot) {
    phoneSearchSlot.appendChild(bar);
  } else if (!onPhone && bar.parentElement !== $(".topbar")) {
    $(".topbar").insertBefore(bar, $("#jam-chip"));
  }
  phoneSearchSlot.classList.toggle("hidden", !onPhone || currentRoute !== "search");
}

// Rotating the phone or resizing the window has to hand the field back: a
// field left in the hidden container would mean no way to search at all. The
// call is idempotent and cheap, so every signal that could mean "the viewport
// changed" is wired rather than betting on one. The router calls it too, so
// navigating anywhere is a backstop.
matchMedia("(max-width: 640px)").addEventListener("change", placeSearchBar);
window.addEventListener("resize", placeSearchBar);
window.addEventListener("orientationchange", placeSearchBar);
new ResizeObserver(placeSearchBar).observe(document.documentElement);

$("#search-clear").addEventListener("click", () => {
  searchInput.value = "";
  state.searchQ = "";
  $("#search-clear").classList.add("hidden");
  searchSuggestions = [];
  if (currentRoute === "search") renderSearch();
  searchInput.focus();
});

// Phones: the header's search icon opens the Search page with the keyboard up.
let phoneSearchTap = false;
$("#phone-search-btn").addEventListener("click", () => {
  phoneSearchTap = true;
  if (currentRoute === "search") { searchInput.focus(); phoneSearchTap = false; }
  else location.hash = "#/search";
});

// ⌘/Ctrl-K and "/" jump to the search field from anywhere.
document.addEventListener("keydown", (e) => {
  const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable;
  if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  } else if (e.key === "/" && !typing) {
    e.preventDefault();
    searchInput.focus();
  }
});

/* ---- search suggestions (typeahead) ----
   These render inside the search page as a row of chips, not as a dropdown
   over it: the results stay visible while you narrow the query. */
let suggestTimer, suggestSeq = 0;

function fetchSuggestions() {
  clearTimeout(suggestTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) {
    searchSuggestions = [];
    paintSuggestions();
    return;
  }
  suggestTimer = setTimeout(async () => {
    const seq = ++suggestSeq;
    let items = [];
    try {
      items = await api.suggest(q);
    } catch { /* typeahead is a nicety — leave the strip empty */ }
    if (seq !== suggestSeq) return;
    searchSuggestions = items;
    paintSuggestions();
  }, 200);
}

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    clearTimeout(searchTimer);
    renderSearch();
  }
});

/* ---- album ---- */
const GRADIENTS = ["#8c1932", "#1e3264", "#537a1c", "#a56752", "#503750", "#0f5a52", "#af2896", "#7d4b32"];
const gradientFor = (s) => GRADIENTS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADIENTS.length];

async function renderAlbum(token) {
  view.innerHTML = `<div class="spinner"></div>`;
  try {
    const album = await api.album(token);
    if (currentRoute !== "album") return;
    const color = gradientFor(album.title);
    const saved = savedAlbumTokens().has(token);
    const tags = (album.tags || []).length
      ? `<div class="tag-row">${album.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>`
      : "";
    const contributors = (album.contributors || []).length ? `
      <div class="section">
        <h2>Also on this album</h2>
        <div class="contrib-row">
          ${album.contributors.map((n) => `<span class="contrib">${I.person}${esc(n)}</span>`).join("")}
        </div>
      </div>` : "";

    view.innerHTML = `
      <div class="collection-hero" style="background:linear-gradient(180deg, ${color}cc 0%, transparent 100%)">
        <div class="collection-header">
          ${artImg(album.image, "ch-art")}
          <div class="ch-info">
            <div class="ch-kind">${esc(album.kind || "Album")}</div>
            <h1 class="ch-title">${esc(album.title)}</h1>
            <div class="ch-sub"><b>${esc(album.artist)}</b>${album.year ? ` · ${esc(album.year)}` : ""} · ${album.songs.length} songs, ${fmtTotal(album.songs)}</div>
            ${tags}
          </div>
        </div>
      </div>
      <div class="collection-actions">
        <button class="big-play" id="coll-play">${I.play}</button>
        <button class="icon-btn ${saved ? "on" : ""}" id="alb-save" title="${saved ? "Remove from Your Library" : "Save to Your Library"}">${saved ? I.heartFill : I.heart}</button>
        <button class="btn-outline select-toggle" id="alb-select">Select songs</button>
      </div>
      ${album.description ? `<p class="collection-desc">${esc(album.description)}</p>` : ""}
      ${album.songs.length > 8 ? filterBarHTML(`Search ${album.title}`) : ""}
      ${trackListHTML(album.songs, { noAlbum: true, selectable: true })}
      ${contributors}`;
    viewCtx = { songs: album.songs, playlistId: null };
    setTabTitle(album.title);
    $("#coll-play").onclick = () => playQueue(album.songs, 0);
    $("#alb-select").onclick = () => toggleSelectMode();
    mountBulkBar();
    $("#alb-save").onclick = async () => {
      try {
        const { saved: on, albums } = await api.toggleAlbum({
          token, title: album.title, artist: album.artist, year: album.year, image: album.image,
        });
        state.library.albums = albums;
        renderSidebar();
        const btn = $("#alb-save");
        btn.classList.toggle("on", on);
        btn.innerHTML = on ? I.heartFill : I.heart;
        toast(on ? "Album saved to Your Library" : "Album removed from Your Library");
      } catch (err) { toast(err.message, true); }
    };
    highlightPlayingRow();
  } catch (err) {
    view.innerHTML = `<div class="search-empty"><h3>Couldn't load album</h3><p>${esc(err.message)}</p></div>`;
  }
}

/* ---- bulk song selection ----
   Off by default so ordinary clicking still just plays a song; turning it on
   swaps the track numbers for checkboxes and raises an action bar. */
function toggleSelectMode(on) {
  const list = view.querySelector(".tracklist.selectable");
  if (!list) return;
  const next = on ?? !list.classList.contains("selecting");
  list.classList.toggle("selecting", next);
  const btn = view.querySelector(".select-toggle");
  if (btn) btn.textContent = next ? "Done" : "Select songs";
  if (!next) {
    list.querySelectorAll(".row-select").forEach((c) => (c.checked = false));
    const all = $("#select-all");
    if (all) all.checked = false;
  }
  updateBulkBar();
}

const selectedSongs = () =>
  [...view.querySelectorAll(".tracklist.selecting .row-select:checked")]
    .map((c) => viewCtx.songs[Number(c.closest(".track").dataset.idx)])
    .filter(Boolean);

function mountBulkBar() {
  if ($("#bulk-bar")) return;
  const bar = document.createElement("div");
  bar.id = "bulk-bar";
  bar.className = "bulk-bar hidden";
  bar.innerHTML = `
    <span class="bulk-count"></span>
    <button class="btn-ghost" data-bulk="queue">${I.addQueue}Add to queue</button>
    <button class="btn-ghost" data-bulk="like">${I.heart}Like</button>
    <button class="btn-ghost" data-bulk="save">${I.bookmark}Save for later</button>
    <button class="btn-solid" data-bulk="playlist">${I.plus}Add to playlist</button>
    <button class="icon-btn" data-bulk="cancel" title="Cancel">${I.close}</button>`;
  document.body.appendChild(bar);
  bar.onclick = (e) => {
    const btn = e.target.closest("[data-bulk]");
    if (btn) runBulkAction(btn.dataset.bulk);
  };
}

function updateBulkBar() {
  const bar = $("#bulk-bar");
  if (!bar) return;
  const n = selectedSongs().length;
  bar.classList.toggle("hidden", !n);
  bar.querySelector(".bulk-count").textContent = `${n} selected`;
}

async function runBulkAction(action) {
  const songs = selectedSongs();
  if (action === "cancel") return toggleSelectMode(false);
  if (!songs.length) return;
  try {
    if (action === "queue") {
      songs.forEach(addToQueue);
      toast(`Added ${songs.length} songs to the queue`);
    } else if (action === "like") {
      const known = likedIds();
      const todo = songs.filter((s) => !known.has(s.id));
      for (const s of todo) state.library.liked = (await api.toggleLike(s)).songs;
      toast(`Liked ${todo.length} song${todo.length === 1 ? "" : "s"}`);
    } else if (action === "save") {
      const known = savedIds();
      const todo = songs.filter((s) => !known.has(s.id));
      for (const s of todo) state.library.saves = (await api.toggleSave(s)).songs;
      toast(`Saved ${todo.length} song${todo.length === 1 ? "" : "s"} for later`);
    } else if (action === "playlist") {
      const name = await modalPrompt("Add the selection to a new playlist named", "New playlist");
      if (!name) return;
      const p = await api.importPlaylist(name, songs);
      state.library.playlists.push(p);
      toast(`Added ${songs.length} songs to "${p.name}"`);
    }
    renderSidebar();
    refreshLikeButtons();
    refreshSaveButtons();
    toggleSelectMode(false);
  } catch (err) { toast(err.message, true); }
}

view.addEventListener("change", (e) => {
  if (e.target.id === "select-all") {
    const on = e.target.checked;
    view.querySelectorAll(".tracklist.selecting .row-select").forEach((c) => (c.checked = on));
  }
  if (e.target.classList.contains("row-select") || e.target.id === "select-all") updateBulkBar();
});

/* ---- artist ----
   Split across tabs instead of one endless scroll: you land on Overview and
   go straight to the part you actually wanted. */
let artistTab = "overview";
let artistData = null;

const ARTIST_TABS = [
  ["overview", "Overview"],
  ["albums", "Albums"],
  ["singles", "Singles & EPs"],
  ["about", "About"],
];

async function renderArtist(id) {
  view.innerHTML = `<div class="spinner"></div>`;
  try {
    const artist = await api.artist(id);
    if (currentRoute !== "artist") return;
    artistData = artist;
    artistTab = "overview";
    paintArtist(id);
  } catch (err) {
    view.innerHTML = `<div class="search-empty"><h3>Couldn't load artist</h3><p>${esc(err.message)}</p></div>`;
  }
}

function paintArtist(id) {
  const artist = artistData;
  const color = gradientFor(artist.name);
  const following = followedIds().has(id);
  const counts = { albums: artist.albums.length, singles: artist.singles.length };

  view.innerHTML = `
    <div class="collection-hero" style="background:linear-gradient(180deg, ${color}cc 0%, transparent 100%)">
      <div class="collection-header">
        ${artImg(artist.image, "ch-art ch-art-round")}
        <div class="ch-info">
          <div class="ch-kind">Artist</div>
          <h1 class="ch-title">${esc(artist.name)}</h1>
          <div class="ch-sub">${counts.albums} album${counts.albums === 1 ? "" : "s"} · ${counts.singles} single${counts.singles === 1 ? "" : "s"} &amp; EPs</div>
        </div>
      </div>
    </div>
    <div class="collection-actions">
      ${artist.songs.length ? `<button class="big-play" id="coll-play">${I.play}</button>` : ""}
      <button class="btn-outline ${following ? "on" : ""}" id="artist-follow">${following ? "Following" : "Follow"}</button>
    </div>
    <nav class="subtabs" id="artist-tabs">
      ${ARTIST_TABS.map(([k, label]) =>
        `<button class="subtab${k === artistTab ? " active" : ""}" data-atab="${k}">${esc(label)}</button>`).join("")}
    </nav>
    ${filterBarHTML(`Search ${artist.name}`)}
    <div id="artist-body"></div>`;

  setTabTitle(artist.name);
  if (artist.songs.length) $("#coll-play").onclick = () => playQueue(artist.songs, 0);
  $("#artist-follow").onclick = async () => {
    try {
      const { followed, artists } = await api.toggleArtist({ id, name: artist.name, image: artist.image });
      state.library.artists = artists;
      renderSidebar();
      const btn = $("#artist-follow");
      btn.classList.toggle("on", followed);
      btn.textContent = followed ? "Following" : "Follow";
      toast(followed ? `Following ${artist.name}` : `Unfollowed ${artist.name}`);
    } catch (err) { toast(err.message, true); }
  };
  $("#artist-tabs").onclick = (e) => {
    const btn = e.target.closest("[data-atab]");
    if (!btn || btn.dataset.atab === artistTab) return;
    artistTab = btn.dataset.atab;
    paintArtist(id);
  };

  paintArtistBody(id);
}

// A discography that starts collapsed, remembers grid-vs-list, and never makes
// you scroll past forty covers to reach the next section.
function discographyHTML(heading, list, type, artistName, key) {
  if (!list.length) return "";
  const open = prefs.discoOpen;
  const grid = prefs.discoGrid;
  const cards = list.map((a) =>
    CARD({ kind: "album", type, attrs: `data-token="${esc(a.token)}"`, image: a.image, title: a.title, sub: `${a.year ? a.year + " · " : ""}${artistName}` })
  ).join("");
  const rows = list.map((a) => `
    <a class="lib-row" data-card="album" data-token="${esc(a.token)}" data-search="${esc(`${a.title} ${a.year || ""}`)}">
      ${a.image ? `<img class="lib-cover" loading="lazy" src="${esc(a.image)}">` : `<span class="lib-cover-empty">${I.note}</span>`}
      <span class="lib-row-meta">
        <span class="lib-row-name">${esc(a.title)}</span>
        <span class="lib-row-sub">${esc([a.year, TYPES[type]?.label].filter(Boolean).join(" · "))}</span>
      </span>
    </a>`).join("");

  return `
    <div class="section disco" data-disco="${key}">
      <h2 class="disco-head">
        <button class="disco-toggle" data-disco-toggle="${key}" aria-expanded="${open}">
          <span class="disco-caret">${I.chevronRight}</span>${esc(heading)}
          <span class="disco-count">${list.length}</span>
        </button>
        <span class="seg small">
          <button data-disco-view="grid" class="${grid ? "on" : ""}" title="Grid">${I.grid}</button>
          <button data-disco-view="list" class="${grid ? "" : "on"}" title="List">${I.rows}</button>
        </span>
      </h2>
      <div class="disco-body${open ? "" : " collapsed"}">
        ${grid ? `<div class="card-grid">${cards}</div>` : `<div class="lib-list">${rows}</div>`}
      </div>
    </div>`;
}

function paintArtistBody(id) {
  const artist = artistData;
  const body = $("#artist-body");
  if (!body) return;

  const relatedSection = artist.related.length ? `
    <div class="section">
      <h2>Fans also like</h2>
      <div class="card-grid shelf">
        ${artist.related.map((a) =>
          CARD({ kind: "artist", type: "artist", round: true, noPlay: true, attrs: `data-id="${esc(a.id)}"`, image: a.image, title: a.name, sub: "" })
        ).join("")}
      </div>
    </div>` : "";

  if (artistTab === "overview") {
    // Your own most-played of theirs sits beside the global chart, because the
    // two are rarely the same list.
    const mine = libraryCorpus()
      .filter((s) => s.artistId === id || s.artist === artist.name)
      .slice(0, 10);
    body.innerHTML = `
      ${mine.length ? `<div class="section">
        <h2>Most frequently listened to <span class="h2-note">your plays</span></h2>
        <div id="artist-mine"></div>
      </div>` : ""}
      ${artist.songs.length ? `<div class="section">
        <h2>Top songs <span class="h2-note">everyone</span></h2>
        <div id="artist-top"></div>
      </div>` : ""}
      ${discographyHTML("Albums", artist.albums.slice(0, 8), "album", artist.name, "albums")}
      ${discographyHTML("Singles &amp; EPs", artist.singles.slice(0, 8), "ep", artist.name, "singles")}
      ${relatedSection}`;
    // Both lists index into one array so row clicks resolve correctly.
    const all = [...mine, ...artist.songs];
    viewCtx = { songs: all, playlistId: null };
    const mineEl = $("#artist-mine");
    if (mineEl) mineEl.innerHTML = trackListHTML(mine, { noAlbum: true });
    const topEl = $("#artist-top");
    if (topEl) {
      topEl.innerHTML = trackListHTML(artist.songs, { noAlbum: false });
      topEl.querySelectorAll(".track").forEach((r, i) => (r.dataset.idx = mine.length + i));
    }
  } else if (artistTab === "albums") {
    body.innerHTML = discographyHTML("Albums", artist.albums, "album", artist.name, "albums")
      || `<div class="search-empty"><h3>No albums listed</h3></div>`;
    viewCtx = { songs: [], playlistId: null };
  } else if (artistTab === "singles") {
    body.innerHTML = discographyHTML("Singles &amp; EPs", artist.singles, "ep", artist.name, "singles")
      || `<div class="search-empty"><h3>No singles or EPs listed</h3></div>`;
    viewCtx = { songs: [], playlistId: null };
  } else {
    const bio = artist.description || artist.about || "";
    body.innerHTML = `
      <div class="section about-grid">
        <div class="about-text">
          <h2>About</h2>
          ${bio ? `<p>${esc(bio)}</p>` : `<p class="admin-sub">YouTube Music doesn't publish a biography for ${esc(artist.name)}.</p>`}
          <dl class="about-facts">
            <div><dt>Albums</dt><dd>${artist.albums.length}</dd></div>
            <div><dt>Singles &amp; EPs</dt><dd>${artist.singles.length}</dd></div>
            <div><dt>Top songs listed</dt><dd>${artist.songs.length}</dd></div>
            ${artist.subscribers ? `<div><dt>Subscribers</dt><dd>${esc(artist.subscribers)}</dd></div>` : ""}
            <div><dt>In your library</dt><dd>${libraryCorpus().filter((s) => s.artistId === id || s.artist === artist.name).length} songs</dd></div>
          </dl>
        </div>
        ${artist.image ? `<img class="about-portrait" src="${esc(artist.image)}" alt="">` : ""}
      </div>
      ${relatedSection}`;
    viewCtx = { songs: [], playlistId: null };
  }

  mountShelfControls();
  highlightPlayingRow();
  if (pageFilter) applyPageFilter(pageFilter);
}

// Discography controls are delegated so they survive every repaint.
view.addEventListener("click", (e) => {
  const toggle = e.target.closest("[data-disco-toggle]");
  if (toggle) {
    const section = toggle.closest(".disco");
    const body = section.querySelector(".disco-body");
    const open = body.classList.toggle("collapsed");
    toggle.setAttribute("aria-expanded", String(!open));
    setPref("discoOpen", !open);
    return;
  }
  const viewBtn = e.target.closest("[data-disco-view]");
  if (viewBtn) {
    setPref("discoGrid", viewBtn.dataset.discoView === "grid");
    if (currentRoute === "artist") paintArtistBody(decodeURIComponent(location.hash.split("/")[2] || ""));
  }
});

/* ---- public YouTube Music playlist ---- */
async function renderYtPlaylist(browseId) {
  view.innerHTML = `<div class="spinner"></div>`;
  try {
    const p = await api.publicPlaylist(browseId);
    if (currentRoute !== "ytplaylist") return;
    const color = gradientFor(p.title);
    view.innerHTML = `
      <div class="collection-hero" style="background:linear-gradient(180deg, ${color}cc 0%, transparent 100%)">
        <div class="collection-header">
          ${artImg(p.image, "ch-art")}
          <div class="ch-info">
            <div class="ch-kind">Public playlist</div>
            <h1 class="ch-title">${esc(p.title)}</h1>
            <div class="ch-sub">${p.author ? `<b>${esc(p.author)}</b> · ` : ""}${p.songs.length} songs${p.songs.length ? `, ${fmtTotal(p.songs)}` : ""}</div>
          </div>
        </div>
      </div>
      <div class="collection-actions">
        ${p.songs.length ? `<button class="big-play" id="coll-play">${I.play}</button>` : ""}
        <button class="btn-outline" id="ytpl-save">Save a copy</button>
      </div>
      ${p.songs.length ? trackListHTML(p.songs) : `<div class="search-empty"><h3>This playlist is empty or unavailable.</h3></div>`}`;
    viewCtx = { songs: p.songs, playlistId: null };
    if (p.songs.length) $("#coll-play").onclick = () => playQueue(p.songs, 0);
    $("#ytpl-save").onclick = async () => {
      try {
        const mine = await api.importPlaylist(p.title, p.songs);
        state.library.playlists.push(mine);
        renderSidebar();
        toast(`Saved "${mine.name}" to Your Library`);
        location.hash = `#/playlist/${mine.id}`;
      } catch (err) { toast(err.message, true); }
    };
    highlightPlayingRow();
  } catch (err) {
    view.innerHTML = `<div class="search-empty"><h3>Couldn't load playlist</h3><p>${esc(err.message)}</p></div>`;
  }
}

/* ---- shared playlist (from another member's link) ---- */
async function renderShared(token) {
  view.innerHTML = `<div class="spinner"></div>`;
  try {
    const p = await api.shared(token);
    if (currentRoute !== "shared") return;
    const color = gradientFor(p.name);
    const img = p.songs[0]?.image;
    view.innerHTML = `
      <div class="collection-hero" style="background:linear-gradient(180deg, ${color}cc 0%, transparent 100%)">
        <div class="collection-header">
          ${img ? `<img class="ch-art" src="${esc(img)}">` : `<div class="ch-art art-placeholder">${I.note}</div>`}
          <div class="ch-info">
            <div class="ch-kind">Shared playlist</div>
            <h1 class="ch-title">${esc(p.name)}</h1>
            <div class="ch-sub">Shared by <b>${esc(p.owner)}</b> · ${p.songs.length} songs${p.songs.length ? `, ${fmtTotal(p.songs)}` : ""}</div>
          </div>
        </div>
      </div>
      <div class="collection-actions">
        ${p.songs.length ? `<button class="big-play" id="coll-play">${I.play}</button>` : ""}
        <button class="btn-outline" id="shared-save">Save a copy</button>
      </div>
      ${p.songs.length ? trackListHTML(p.songs) : `<div class="search-empty"><h3>This playlist is empty.</h3></div>`}`;
    viewCtx = { songs: p.songs, playlistId: null };
    if (p.songs.length) $("#coll-play").onclick = () => playQueue(p.songs, 0);
    $("#shared-save").onclick = async () => {
      try {
        const mine = await api.copyShared(token);
        state.library.playlists.push(mine);
        renderSidebar();
        toast(`Saved "${mine.name}" to Your Library`);
        location.hash = `#/playlist/${mine.id}`;
      } catch (err) { toast(err.message, true); }
    };
    highlightPlayingRow();
  } catch (err) {
    view.innerHTML = `<div class="search-empty"><h3>Couldn't open the shared playlist</h3><p>${esc(err.message)}</p></div>`;
  }
}

/* ---- playlist ---- */
function renderPlaylist(id) {
  // SQLite playlist ids are numbers; the route param is a string
  const p = state.library.playlists.find((x) => String(x.id) === String(id));
  if (!p) {
    view.innerHTML = `<div class="search-empty"><h3>Playlist not found</h3></div>`;
    return;
  }
  const color = gradientFor(p.name);
  const img = p.songs[0]?.image;
  view.innerHTML = `
    <div class="collection-hero" style="background:linear-gradient(180deg, ${color}cc 0%, transparent 100%)">
      <div class="collection-header">
        ${img ? `<img class="ch-art" src="${esc(img)}">` : `<div class="ch-art art-placeholder">${I.note}</div>`}
        <div class="ch-info">
          <div class="ch-kind">Playlist</div>
          <h1 class="ch-title editable" id="pl-title" title="Rename">${esc(p.name)}</h1>
          <div class="ch-sub">${p.songs.length} songs${p.songs.length ? `, ${fmtTotal(p.songs)}` : ""}</div>
        </div>
      </div>
    </div>
    <div class="collection-actions">
      ${p.songs.length ? `<button class="big-play" id="coll-play">${I.play}</button>` : ""}
      <button class="icon-btn" id="pl-rename" title="Rename playlist">${I.pencil}</button>
      <button class="icon-btn" id="pl-share" title="Share playlist">${I.share}</button>
      ${p.songs.length ? `<button class="icon-btn" id="pl-export" title="Export as JSON">${I.download}</button>` : ""}
      <button class="icon-btn danger" id="pl-delete" title="Delete playlist">${I.trash}</button>
      ${p.songs.length ? `<button class="btn-outline select-toggle" id="pl-select">Select songs</button>` : ""}
      ${p.songs.length > 1 ? `<span class="reorder-hint">Drag songs to reorder</span>` : ""}
    </div>
    ${p.songs.length > 8 ? filterBarHTML(`Search ${p.name}`) : ""}
    ${p.songs.length
      ? trackListHTML(p.songs, { removable: true, reorderable: true, selectable: true })
      : `<div class="search-empty"><h3>It's a bit quiet in here</h3><p>Use <a href="#/search" style="color:var(--accent);font-weight:700">Search</a> and the ＋ button on any song to fill this playlist.</p></div>`}`;

  viewCtx = { songs: p.songs, playlistId: p.id };
  setTabTitle(p.name);
  if (p.songs.length) {
    $("#coll-play").onclick = () => playQueue(p.songs, 0);
    $("#pl-select").onclick = () => toggleSelectMode();
    mountBulkBar();
  }

  $("#pl-share").onclick = async (e) => {
    e.stopPropagation();
    try {
      const { token } = await api.shareState(p.id);
      const shareItems = token
        ? `<button class="popover-item" data-share="copy">${I.share}<span>Copy share link</span></button>
           <button class="popover-item" data-share="revoke">${I.close}<span>Revoke share link</span></button>`
        : `<button class="popover-item" data-share="create">${I.share}<span>Create share link</span></button>`;
      popover.innerHTML = `<div class="popover-title">Share “${esc(p.name)}”</div>${shareItems}
        <div class="popover-note">Anyone signed in to this Marusic can open the link and save a copy.</div>`;
      popover.classList.remove("hidden");
      positionPopover(e.clientX, e.clientY);
      popover.onclick = async (ev) => {
        const btn = ev.target.closest("[data-share]");
        if (!btn) return;
        closePopover();
        try {
          if (btn.dataset.share === "revoke") {
            await api.revokeShare(p.id);
            return toast("Share link revoked");
          }
          const res = token && btn.dataset.share === "copy" ? { token } : await api.sharePlaylist(p.id);
          const url = `${location.origin}/#/shared/${res.token}`;
          try { await navigator.clipboard.writeText(url); toast("Share link copied to clipboard"); }
          catch { await modalPrompt("Copy this share link", "", url); }
        } catch (err) { toast(err.message, true); }
      };
    } catch (err) { toast(err.message, true); }
  };

  const exportBtn = $("#pl-export");
  if (exportBtn) exportBtn.onclick = () =>
    startDownload(`/api/playlists/${p.id}/export`, "Exporting playlist…");

  const rename = async () => {
    const name = await modalPrompt("Rename playlist", "", p.name);
    if (!name || name === p.name) return;
    const updated = await api.renamePlaylist(p.id, name);
    state.library.playlists = state.library.playlists.map((x) => (x.id === p.id ? updated : x));
    renderSidebar();
    router();
  };
  $("#pl-title").onclick = rename;
  $("#pl-rename").onclick = rename;
  $("#pl-delete").onclick = async () => {
    const sure = await modalPrompt(`Type DELETE to remove "${p.name}"`, "DELETE");
    if (sure !== "DELETE") return;
    await api.deletePlaylist(p.id);
    state.library.playlists = state.library.playlists.filter((x) => x.id !== p.id);
    renderSidebar();
    toast(`Deleted "${p.name}"`);
    location.hash = "#/home";
  };
  highlightPlayingRow();
}

/* ---- liked ---- */
function renderLiked() {
  const songs = state.library.liked;
  view.innerHTML = `
    <div class="collection-hero" style="background:linear-gradient(180deg, #5038a0cc 0%, transparent 100%)">
      <div class="collection-header">
        <div class="ch-art-liked">${I.heartFill}</div>
        <div class="ch-info">
          <div class="ch-kind">Playlist</div>
          <h1 class="ch-title">Liked Songs</h1>
          <div class="ch-sub">${songs.length} songs${songs.length ? `, ${fmtTotal(songs)}` : ""}</div>
        </div>
      </div>
    </div>
    <div class="collection-actions">
      ${songs.length ? `<button class="big-play" id="coll-play">${I.play}</button>` : ""}
      ${songs.length ? `<button class="btn-outline select-toggle" id="liked-select">Select songs</button>` : ""}
    </div>
    ${songs.length ? filterBarHTML("Search your liked songs") : ""}
    ${songs.length
      ? trackListHTML(songs, { selectable: true })
      : `<div class="search-empty"><h3>Songs you like will appear here</h3><p>Save songs by tapping the heart icon.</p></div>`}`;
  viewCtx = { songs, playlistId: null };
  setTabTitle("Liked Songs");
  if (songs.length) {
    $("#coll-play").onclick = () => playQueue(songs, 0);
    $("#liked-select").onclick = () => toggleSelectMode();
    mountBulkBar();
  }
  highlightPlayingRow();
}

/* ---- library ----
   The full-page view: everything the sidebar holds, grouped and filterable,
   for when the sidebar is too narrow to work in. */
let libraryKind = "all"; // all | playlists | albums | artists | songs

const LIB_KINDS = [
  ["all", "All"], ["playlists", "Playlists"], ["albums", "Albums"],
  ["artists", "Artists"], ["songs", "Songs"],
];

function renderLibrary() {
  const { playlists, liked, albums, artists, saves = [] } = state.library;
  const smart = allSmartLists().filter((l) => l.pick().length);

  const group = (title, rows) => rows.length
    ? `<div class="section"><h2>${title}</h2><div class="lib-list">${rows.join("")}</div></div>`
    : "";

  const row = (href, cover, name, sub) => `
    <a class="lib-row" href="${href}" data-search="${esc(`${name} ${sub}`)}">
      ${cover}
      <span class="lib-row-meta"><span class="lib-row-name">${esc(name)}</span><span class="lib-row-sub">${esc(sub)}</span></span>
    </a>`;
  const cover = (img, cls = "") => img
    ? `<img class="lib-cover ${cls}" loading="lazy" src="${esc(img)}">`
    : `<span class="lib-cover-empty ${cls}">${cls.includes("round") ? I.person : I.note}</span>`;

  const pinned = [
    row("#/liked", `<span class="liked-cover">${I.heartFill}</span>`, "Liked Songs", `Playlist · ${liked.length} songs`),
    row("#/saves", `<span class="saves-cover">${I.bookmarkFill}</span>`, "Saves", `Listen later · ${saves.length} songs`),
  ];

  const show = (kind) => libraryKind === "all" || libraryKind === kind;

  view.innerHTML = `
    <div class="lib-head">
      <h1 class="page-title">Your Library</h1>
      <span class="lib-head-actions">
        <button class="btn-ghost" id="lib-import">Import</button>
        <button class="btn-solid" id="lib-new">New playlist</button>
      </span>
    </div>
    <div class="chip-row" id="lib-kinds">
      ${LIB_KINDS.map(([k, label]) =>
        `<button class="chip${libraryKind === k ? " on" : ""}" data-kind="${k}">${label}</button>`).join("")}
    </div>
    ${filterBarHTML("Search your library")}
    <div id="lib-groups">
      ${group("Pinned", show("songs") || libraryKind === "all" ? pinned : [])}
      ${show("playlists") ? group("Smart playlists", smart.map((l) =>
        row(`#/smart/${encodeURIComponent(l.id)}`, `<span class="lib-cover-empty smart-cover">${I.sparkle}</span>`,
          l.name, `Auto · ${l.pick().length} songs`))) : ""}
      ${show("playlists") ? group("Playlists", playlists.map((p) =>
        row(`#/playlist/${p.id}`, cover(p.songs[0]?.image), p.name, `Playlist · ${p.songs.length} songs`))) : ""}
      ${show("albums") ? group("Albums", albums.map((a) =>
        row(`#/album/${encodeURIComponent(a.token)}`, cover(a.image), a.title, `Album · ${a.artist}`))) : ""}
      ${show("artists") ? group("Artists", artists.map((a) =>
        row(`#/artist/${encodeURIComponent(a.id)}`, cover(a.image, "round"), a.name, "Artist"))) : ""}
    </div>`;

  viewCtx = { songs: [], playlistId: null };
  setTabTitle("Library");

  $("#lib-kinds").onclick = (e) => {
    const chip = e.target.closest("[data-kind]");
    if (!chip || chip.dataset.kind === libraryKind) return;
    libraryKind = chip.dataset.kind;
    const keep = pageFilter;
    renderLibrary();
    if (keep) {
      const input = view.querySelector(".pf-input");
      if (input) input.value = keep;
      applyPageFilter(keep);
    }
  };
  $("#lib-import").onclick = () => importFile.click();
  $("#lib-new").onclick = newPlaylistFlow;
}

async function newPlaylistFlow() {
  const name = await modalPrompt("Create playlist", "My Playlist");
  if (!name) return;
  const p = await api.createPlaylist(name);
  state.library.playlists.push(p);
  renderSidebar();
  location.hash = `#/playlist/${p.id}`;
}

/* ---- trending ---- */
// Both halves of the Trending shelf on one page: the singles as a playlist you
// can play top to bottom, and the albums & EPs added underneath it.
async function renderTrending() {
  view.innerHTML = `<div class="spinner"></div>`;
  try {
    const { singles = [], releases = [] } = await api.get("/api/trending");
    if (currentRoute !== "trending") return;
    homeTrending = singles;
    homeTrendingReleases = releases;

    const covers = singles.map((s) => s.image).filter(Boolean);
    const color = gradientFor("Trending Singles");
    view.innerHTML = `
      <div class="collection-hero" style="background:linear-gradient(180deg, ${color}cc 0%, transparent 100%)">
        <div class="collection-header">
          <div class="ch-art ch-art-stack" data-type="playlist">
            ${covers.length >= 4 ? mosaicHTML(covers) : artImg(covers[0])}
          </div>
          <div class="ch-info">
            <div class="ch-kind"><span class="type-chip" data-type="playlist">Playlist</span></div>
            <h1 class="ch-title">Trending Singles</h1>
            <div class="ch-sub">Every single trending on YouTube Music right now · ${singles.length} songs${
              // Explore rarely reports durations — don't claim a 0 min runtime
              singles.some((s) => Number(s.duration) > 0) ? `, ${fmtTotal(singles)}` : ""
            }</div>
          </div>
        </div>
      </div>
      <div class="collection-actions">
        ${singles.length ? `<button class="big-play" id="coll-play">${I.play}</button>` : ""}
      </div>
      ${singles.length ? trackListHTML(singles, { noAlbum: false }) : ""}
      ${releases.length ? `
        <div class="section">
          <h2>Trending albums &amp; EPs</h2>
          <div class="card-grid">${trendingReleaseCards(releases)}</div>
        </div>` : ""}`;

    viewCtx = { songs: singles, playlistId: null };
    if (singles.length) $("#coll-play").onclick = () => playQueue(singles, 0);
    highlightPlayingRow();
  } catch (err) {
    view.innerHTML = `<div class="search-empty"><h3>Couldn't load Trending</h3><p>${esc(err.message)}</p></div>`;
  }
}

/* ---- radio ---- */
// Stations paint straight away on their YT Music genre colour; real cover art
// costs one upstream page each, so it is fetched after paint and faded in.
// name -> cover url, mirroring the server's cache so a re-rendered shelf paints
// its art immediately instead of flashing back to the colour cover
const stationArt = new Map();

const stationCards = (stations) =>
  stations.map((st) => {
    if (st.image) stationArt.set(st.name, st.image);
    return CARD({
      kind: "station",
      type: "station",
      color: st.color,
      attrs: `data-name="${esc(st.name)}"`,
      image: st.image || stationArt.get(st.name) || "",
      title: st.name,
      sub: "Endless · never runs out",
    });
  }).join("");

// Paint every cover we already know onto the station cards currently on screen.
function applyStationArt() {
  document.querySelectorAll('.card[data-card="station"]').forEach((card) => {
    const name = card.dataset.name;
    const url = stationArt.get(name);
    const frame = card.querySelector(".art-frame");
    if (!url || !frame || frame.querySelector("img")) return;

    const img = new Image();
    img.loading = "lazy";
    img.alt = "";
    img.className = "art-fade-in";
    img.onload = () => {
      // the shelf can re-render while the image downloads — re-find the live
      // card rather than writing into a node that has since been replaced
      const live = [...document.querySelectorAll('.card[data-card="station"]')]
        .find((c) => c.dataset.name === name);
      live?.querySelector(".art-placeholder")?.replaceWith(img);
    };
    img.src = url;
  });
}

async function hydrateStationArt(stations) {
  applyStationArt();
  const missing = stations.filter((st) => !stationArt.get(st.name)).map((st) => st.name);
  if (!missing.length) return;

  try {
    for (const [name, url] of Object.entries(await api.stationArt(missing))) {
      if (url) stationArt.set(name, url);
    }
  } catch {
    return; // the colour covers are a perfectly good permanent fallback
  }
  applyStationArt();
}

async function renderRadio() {
  view.innerHTML = `<div class="spinner"></div>`;
  try {
    const stations = await api.radioStations();
    if (currentRoute !== "radio") return;
    view.innerHTML = `
      <div class="section">
        <h2>Radio stations</h2>
        <p class="section-note">Stations never end — they keep pulling in similar tracks as you listen.</p>
        <div class="card-grid">${stationCards(stations)}</div>
      </div>`;
    viewCtx = { songs: [], playlistId: null };
    hydrateStationArt(stations);
  } catch (err) {
    view.innerHTML = `<div class="search-empty"><h3>Couldn't load stations</h3><p>${esc(err.message)}</p></div>`;
  }
}

/* ---- jam view: start/join screens + live dashboard ----
   Jam and Listen together are one screen: a toggle picks which kind you are
   about to start, and a session in progress simply shows its own. */
async function renderJamView(codeParam = "") {
  const code = String(codeParam || "").trim().toUpperCase();
  viewCtx = { songs: [], playlistId: null };

  // someone's invite link, and we're not (yet) in that session
  if (code && (!state.jam || state.jam.code !== code)) {
    view.innerHTML = `<div class="spinner"></div>`;
    let p;
    try {
      p = await api.jamPeek(code);
    } catch (err) {
      if (!onJamRoute()) return;
      view.innerHTML = `<div class="search-empty"><h3>That session isn't on</h3>
        <p>${esc(err.message)}</p>
        <p style="margin-top:16px"><a class="btn-solid" href="${jamRoute()}">Start your own</a></p></div>`;
      return;
    }
    if (!onJamRoute()) return;
    // the code decides which kind it is, not the link you clicked
    const c = jamCopy(p.mode);
    view.innerHTML = `
      <div class="jam-hero">
        <div class="jam-hero-icon">${c.icon()}</div>
        <h1>${esc(p.host)} ${c.invited}</h1>
        <p class="jam-sub">${p.members} ${p.members === 1 ? "person is" : "people are"} in${
          p.current
            ? ` · ${p.playing ? "playing" : "paused on"} <b>${esc(p.current.title)}</b> — ${esc(p.current.artist)}`
            : ""
        }</p>
        ${
          p.mode === "together"
            ? `<p class="jam-sub">The music plays on this device, in sync with everyone else's.</p>`
            : `<p class="jam-sub">One device plays for the room — this one is a remote unless the host hands it the audio.</p>`
        }
        ${inJam() ? `<p class="jam-sub">Joining moves you out of your current ${jamNoun()}.</p>` : ""}
        <button class="btn-solid" id="jam-join-btn">${c.join}</button>
      </div>`;
    $("#jam-join-btn").onclick = async () => {
      try {
        const snap = await api.jamJoin(code);
        enterJam(snap);
        location.hash = jamRoute(snap.mode); // re-routes into the dashboard
      } catch (err) {
        toast(err.message, true);
      }
    };
    return;
  }

  // No session yet. One screen, one toggle: the two kinds differ only in where
  // the sound comes out, which is a choice you make once at the start — not
  // two separate destinations to navigate between.
  if (!inJam()) {
    const paint = () => {
      const mode = prefs.jamMode === "together" ? "together" : "speaker";
      const c = jamCopy(mode);
      view.innerHTML = `
        <div class="jam-hero">
          <div class="jam-hero-icon">${c.icon()}</div>
          <h1>Listen with friends</h1>
          <span class="seg jam-mode-seg">
            <button data-jam-mode="speaker" class="${mode === "speaker" ? "on" : ""}">${I.group} Jam</button>
            <button data-jam-mode="together" class="${mode === "together" ? "on" : ""}">${I.volume} Listen together</button>
          </span>
          <p class="jam-sub jam-mode-blurb">${c.blurb}</p>
          <button class="btn-solid" id="jam-start-btn">${state.current ? c.startFrom : c.start}</button>
          <div class="jam-join-row">
            <input id="jam-code-input" maxlength="6" placeholder="Have a code?"
              autocomplete="off" spellcheck="false">
            <button class="btn-ghost" id="jam-join-code-btn">Join</button>
          </div>
        </div>`;

      // the toggle only changes what you are about to start — a session's own
      // kind is fixed once it exists, since moving the audio out from under
      // everyone mid-song is not a thing anyone asked for
      view.querySelectorAll("[data-jam-mode]").forEach((b) => {
        b.onclick = () => {
          if (b.dataset.jamMode === mode) return;
          setPref("jamMode", b.dataset.jamMode);
          paint();
        };
      });

      $("#jam-start-btn").onclick = async () => {
        try {
          const seed = state.current
            ? {
                queue: state.queue.slice(0, 500),
                index: state.qIndex,
                pos: audio.currentTime || 0,
                playing: !audio.paused,
              }
            : {};
          const snap = await api.jamCreate(seed, mode);
          enterJam(snap, { quiet: true });
          renderJamView();
          toast(c.started);
        } catch (err) {
          toast(err.message, true);
        }
      };

      const joinByCode = async () => {
        const typed = $("#jam-code-input").value.trim();
        if (!typed) return;
        try {
          // the code decides which kind you are joining, not the toggle
          const snap = await api.jamJoin(typed);
          enterJam(snap);
          renderJamView();
        } catch (err) {
          toast(err.message, true);
        }
      };
      $("#jam-join-code-btn").onclick = joinByCode;
      $("#jam-code-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") joinByCode();
      });
    };
    paint();
    return;
  }

  // in a session: the dashboard
  const j = state.jam;
  const host = jamIsHost();
  const cur = jamSong();
  const c = jamCopy(jamMode());
  const listening = j.members.filter((m) => m.connected).length;
  view.innerHTML = `
    <div class="jam-dash">
      <div class="jam-code-card">
        <div class="jam-code-main">
          <div class="jam-code-label">${c.title} · join code</div>
          <div class="jam-code">${esc(j.code)}</div>
          <div class="jam-sub">${
            cur
              ? `${j.playing ? "Playing" : "Paused"} · <b>${esc(cur.title)}</b> — ${esc(cur.artist)}`
              : "The queue is empty — play any song to add it"
          }</div>
        </div>
        <div class="jam-code-actions">
          <button class="btn-solid" id="jam-copy-link">Copy invite link</button>
          <button class="btn-ghost" id="jam-copy-code">Copy code</button>
        </div>
      </div>

      ${
        isTogether()
          ? `<div class="jam-speaker-row">
        <span class="jam-speaker-icon">${I.volume}</span>
        <span class="jam-speaker-text">Playing on <b>every device</b> —
          ${listening} ${listening === 1 ? "person is" : "people are"} hearing this
          right now, in sync. Voice chat is on you.</span>
      </div>`
          : `<div class="jam-speaker-row${isJamSpeaker() || j.speakerOnline ? "" : " warn"}">
        <span class="jam-speaker-icon">${I.volume}</span>
        <span class="jam-speaker-text">${
          isJamSpeaker()
            ? "The audio plays on <b>this device</b> — everyone else is a remote"
            : j.speakerOnline
            ? "The audio plays on the host's device; this one is a remote control"
            : "No device is playing the audio right now"
        }</span>
        ${host && !isJamSpeaker() ? `<button class="btn-solid" id="jam-claim-btn">Play here</button>` : ""}
      </div>`
      }

      <div class="section">
        <h2>${j.members.length} ${isTogether() ? "listening together" : "in the jam"}</h2>
        <div class="jam-members">
          ${j.members
            .map(
              (m) => `
            <div class="jam-member${m.connected ? "" : " offline"}">
              <span class="user-avatar">${esc((m.name || "?")[0].toUpperCase())}</span>
              <span class="jam-member-name">${esc(m.name)}${m.id === j.youId ? " (you)" : ""}</span>
              ${m.host ? `<span class="badge badge-green">host</span>` : ""}
              ${m.connected ? "" : `<span class="badge">away</span>`}
              ${host && !m.host ? `<button class="btn-ghost danger-text" data-kick="${m.id}">Remove</button>` : ""}
            </div>`
            )
            .join("")}
        </div>
      </div>

      ${
        host
          ? `<div class="section">
        <h2>Host settings</h2>
        <label class="jam-setting">
          <input type="checkbox" id="jam-set-control" ${j.settings.guestsControl ? "checked" : ""}>
          <span>Everyone can control playback
            <span class="jam-sub">Off — only you can play, pause, skip and seek. Anyone can still add songs.</span></span>
        </label>
        <label class="jam-setting">
          <input type="checkbox" id="jam-set-autoplay" ${j.settings.autoplay ? "checked" : ""}>
          <span>Autoplay
            <span class="jam-sub">Keep the music going with similar songs when the queue runs out.</span></span>
        </label>
      </div>`
          : ""
      }

      <div class="jam-leave-row">
        ${host ? `<button class="btn-ghost danger-text" id="jam-end-btn">End for everyone</button>` : ""}
        <button class="btn-ghost" id="jam-leave-btn">Leave</button>
      </div>
    </div>`;

  const shareUrl = `${location.origin}/${jamRoute(jamMode())}/${j.code}`;
  const copy = async (text, okMsg) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(okMsg);
    } catch {
      modalPrompt("Copy this", "", text);
    }
  };
  $("#jam-copy-link").onclick = () => copy(shareUrl, "Invite link copied");
  $("#jam-copy-code").onclick = () => copy(j.code, "Code copied");
  const claim = $("#jam-claim-btn");
  if (claim)
    claim.onclick = () =>
      api.jamSpeaker().then(() => toast("This device is the speaker now"))
        .catch((err) => toast(err.message, true));
  view.querySelectorAll("[data-kick]").forEach(
    (b) =>
      (b.onclick = () =>
        api.jamKick(Number(b.dataset.kick)).catch((err) => toast(err.message, true)))
  );
  const set = (patch) => api.jamSettings(patch).catch((err) => toast(err.message, true));
  const ctl = $("#jam-set-control");
  if (ctl) ctl.onchange = () => set({ guestsControl: ctl.checked });
  const ap = $("#jam-set-autoplay");
  if (ap) ap.onchange = () => set({ autoplay: ap.checked });
  const endBtn = $("#jam-end-btn");
  if (endBtn)
    endBtn.onclick = async () => {
      const noun = jamNoun();
      try {
        await api.jamEnd();
        exitJamMode(`Ended the ${noun}`);
      } catch (err) {
        toast(err.message, true);
      }
    };
  $("#jam-leave-btn").onclick = async () => {
    const noun = jamNoun();
    try {
      await api.jamLeave();
      exitJamMode(`Left the ${noun}`);
    } catch (err) {
      toast(err.message, true);
    }
  };
}

/* ==========================================================================
   DJ — docked beside the player, never filed under playlists, and every
   behaviour it has is something you can switch off.
   ========================================================================== */
const djDock = $("#dj-dock");
let djTimer = null;
let djLastId = "";

// Feedback is local and only steers what the DJ queues next; nothing about it
// is sent anywhere.
const djFeedback = { up: new Set(), down: new Set() };

let djDismissed = false;

function applyDjUI() {
  djDock.classList.toggle("hidden", !prefs.dj || djDismissed);
  djDock.classList.toggle("on", !!prefs.dj);
  $("#dj-toggle").textContent = prefs.dj ? "Turn off" : "Turn on";
  $("#dj-skip").disabled = !prefs.dj;
  if (!prefs.dj) $("#dj-line").textContent = "DJ is off";
}

$("#dj-face").addEventListener("click", () => setDj(!prefs.dj));
$("#dj-toggle").addEventListener("click", () => setDj(!prefs.dj));
$("#dj-close").addEventListener("click", () => {
  djDismissed = true;
  djDock.classList.add("hidden");
  toast("DJ hidden — turn it back on from Profile › Settings");
});

$("#dj-skip").addEventListener("click", () => {
  clearTimeout(djTimer);
  $("#dj-line").textContent = "Commentary skipped.";
  djTimer = setTimeout(() => djSay(), 20000);
});

$("#dj-up").addEventListener("click", () => djVote(1));
$("#dj-down").addEventListener("click", () => djVote(-1));

function setDj(on) {
  setPref("dj", on);
  djDismissed = false;
  applyDjUI();
  if (on) {
    toast("DJ on — it'll line up what comes next and say why");
    djSay();
  } else {
    clearTimeout(djTimer);
  }
}

function djVote(dir) {
  const s = state.current;
  if (!s) return;
  const [add, remove] = dir > 0 ? [djFeedback.up, djFeedback.down] : [djFeedback.down, djFeedback.up];
  add.add(s.artist);
  remove.delete(s.artist);
  $("#dj-line").textContent = dir > 0
    ? `More like ${s.artist}, noted.`
    : `Less ${s.artist} from here on.`;
  if (dir < 0) next();
}

// The "commentary" is a short line about what's actually playing and what it
// queued — no generated audio, and no pretending it knows more than it does.
function djSay() {
  if (!prefs.dj) return;
  const s = state.current;
  const line = $("#dj-line");
  if (!s) { line.textContent = "Nothing playing — start something and I'll take it from there."; return; }
  const upNext = state.queue[computeNextIndex()];
  const lines = [
    `${s.title} — ${s.artist}.`,
    upNext ? `Next up: ${upNext.title}.` : `That's the last one queued — I'll find more.`,
    djFeedback.up.size ? `Leaning into ${[...djFeedback.up].slice(-1)[0]}.` : "",
    state.radio ? `Riding the ${state.radio.name} station.` : "",
  ].filter(Boolean);
  line.textContent = lines.join(" ");
  djLastId = s.id;
  clearTimeout(djTimer);
  djTimer = setTimeout(djSay, 45000);

  // Keep the queue stocked so the DJ always has somewhere to go next.
  if (state.autoplay && computeNextIndex() === -1) fetchAutoplay();
}

/* ==========================================================================
   Discover — the short-clip feed, moved off Home into a tab of its own so the
   two never compete for the same scroll.
   ========================================================================== */
const DISCOVER_FILTERS = [
  { id: "foryou", label: "For you", seed: "" },
  { id: "hiphop", label: "Hip-hop", seed: "hip hop" },
  { id: "pop", label: "Pop", seed: "pop hits" },
  { id: "rock", label: "Rock", seed: "rock" },
  { id: "rnb", label: "R&B", seed: "rnb soul" },
  { id: "electronic", label: "Electronic", seed: "electronic dance" },
  { id: "arabic", label: "Arabic", seed: "arabic" },
  { id: "chill", label: "Chill", seed: "chill lofi" },
  { id: "focus", label: "Focus", seed: "focus instrumental" },
  { id: "workout", label: "Workout", seed: "workout energy" },
  { id: "sad", label: "Sad", seed: "sad songs" },
  { id: "party", label: "Party", seed: "party anthems" },
];

let discoverFilter = "foryou";
let discoverSongs = [];

async function renderDiscover() {
  const chips = DISCOVER_FILTERS.map((f) =>
    `<button class="chip${f.id === discoverFilter ? " on" : ""}" data-disc="${f.id}">${esc(f.label)}</button>`).join("");
  view.innerHTML = `
    <div class="discover-head">
      <h1 class="page-title">Discover</h1>
      <p class="page-lede">Short previews, one at a time. Swipe or scroll to move on.</p>
      <div class="chip-row" id="discover-chips">${chips}</div>
    </div>
    <div class="discover-feed" id="discover-feed"><div class="spinner"></div></div>`;
  viewCtx = { songs: [], playlistId: null };
  setTabTitle("Discover");

  $("#discover-chips").onclick = (e) => {
    const chip = e.target.closest("[data-disc]");
    if (!chip || chip.dataset.disc === discoverFilter) return;
    discoverFilter = chip.dataset.disc;
    renderDiscover();
  };
  await loadDiscoverFeed();
}

async function loadDiscoverFeed() {
  const feed = $("#discover-feed");
  if (!feed) return;
  const filter = DISCOVER_FILTERS.find((f) => f.id === discoverFilter);
  try {
    let songs = [];
    if (filter.id === "foryou") {
      // "For you" leans on what you've actually played before falling back to
      // whatever is trending, so a cold account still has something to swipe.
      const seed = state.library.history[0] || state.library.liked[0];
      // /api/reco answers with the track list itself, not a wrapper
      if (seed) songs = await api.reco(seed.id).catch(() => []);
      if (!songs.length) songs = (await api.get("/api/trending")).singles || [];
    } else {
      songs = (await api.search(filter.seed)).songs || [];
    }
    if (currentRoute !== "discover") return;
    discoverSongs = songs.filter((s) => s.id).slice(0, 40);
    if (!discoverSongs.length) {
      feed.innerHTML = `<div class="search-empty"><h3>Nothing to discover here yet</h3>
        <p>Play a few songs and this fills up.</p></div>`;
      return;
    }
    feed.innerHTML = discoverSongs.map((s, i) => discoverCardHTML(s, i)).join("");
    viewCtx = { songs: discoverSongs, playlistId: null };
    mountDiscoverObserver();
  } catch (err) {
    feed.innerHTML = `<div class="search-empty"><h3>Couldn't load Discover</h3><p>${esc(err.message)}</p></div>`;
  }
}

const discoverCardHTML = (s, i) => {
  const liked = likedIds().has(s.id);
  const saved = savedIds().has(s.id);
  return `<article class="disc-card" data-disc-idx="${i}">
    <div class="disc-art">
      ${artImg(s.image, "disc-img")}
      <button class="disc-play" title="Play preview">${I.play}</button>
    </div>
    <div class="disc-info">
      <div class="disc-title">${esc(s.title)}</div>
      <div class="disc-artist">${esc(s.artist)}</div>
    </div>
    <div class="disc-rail">
      <button class="disc-act act-like ${liked ? "on" : ""}" title="Like">${liked ? I.heartFill : I.heart}</button>
      <button class="disc-act act-save ${saved ? "on" : ""}" title="Save for later">${saved ? I.bookmarkFill : I.bookmark}</button>
      <button class="disc-act act-add" title="Add to playlist">${I.plus}</button>
      <button class="disc-act act-queue" title="Add to queue">${I.addQueue}</button>
    </div>
  </article>`;
};

// Auto-preview whichever card is centred, the way a clip feed behaves.
let discObserver = null;
function mountDiscoverObserver() {
  discObserver?.disconnect();
  const feed = $("#discover-feed");
  if (!feed) return;
  discObserver = new IntersectionObserver((entries) => {
    entries.forEach((en) => en.target.classList.toggle("in-view", en.isIntersecting && en.intersectionRatio > 0.6));
  }, { root: feed, threshold: [0, 0.6, 1] });
  feed.querySelectorAll(".disc-card").forEach((c) => discObserver.observe(c));
}

view.addEventListener("click", (e) => {
  const card = e.target.closest("[data-disc-idx]");
  if (!card) return;
  const song = discoverSongs[Number(card.dataset.discIdx)];
  if (!song) return;
  if (e.target.closest(".act-like")) return toggleLike(song);
  if (e.target.closest(".act-save")) return toggleSave(song);
  if (e.target.closest(".act-add")) return openAddPopover(e, song);
  if (e.target.closest(".act-queue")) return addToQueue(song);
  playQueue(discoverSongs, Number(card.dataset.discIdx));
});

/* ==========================================================================
   Saves — the "listen later" shelf that keeps playlists clean
   ========================================================================== */
async function toggleSave(song) {
  try {
    const { saved, songs } = await api.toggleSave(song);
    state.library.saves = songs;
    refreshSaveButtons();
    renderSidebar();
    toast(saved ? "Saved to listen later" : "Removed from Saves");
  } catch (err) { toast(err.message, true); }
}

function refreshSaveButtons() {
  const ids = savedIds();
  document.querySelectorAll(".act-save").forEach((btn) => {
    const row = btn.closest("[data-idx], [data-disc-idx]");
    const song = row?.dataset.discIdx != null
      ? discoverSongs[Number(row.dataset.discIdx)]
      : viewCtx.songs[Number(row?.dataset.idx)];
    if (!song) return;
    const on = ids.has(song.id);
    btn.classList.toggle("on", on);
    btn.innerHTML = on ? I.bookmarkFill : I.bookmark;
  });
}

function renderSaves() {
  const songs = state.library.saves || [];
  view.innerHTML = `
    <div class="collection-hero" style="background:linear-gradient(180deg, #1e5f9acc 0%, transparent 100%)">
      <div class="collection-header">
        <div class="ch-art-saves">${I.bookmarkFill}</div>
        <div class="ch-info">
          <div class="ch-kind">Listen later</div>
          <h1 class="ch-title">Saves</h1>
          <div class="ch-sub">Things you want to come back to, kept out of your playlists · ${songs.length} songs${songs.length ? `, ${fmtTotal(songs)}` : ""}</div>
        </div>
      </div>
    </div>
    <div class="collection-actions">
      ${songs.length ? `<button class="big-play" id="coll-play">${I.play}</button>` : ""}
      ${songs.length ? `<button class="btn-outline" id="saves-to-playlist">Move all to a playlist</button>` : ""}
      ${songs.length ? `<button class="btn-ghost danger-text" id="saves-clear">Clear</button>` : ""}
    </div>
    ${songs.length ? filterBarHTML("Search your saves") : ""}
    ${songs.length
      ? trackListHTML(songs, { savable: true })
      : `<div class="search-empty"><h3>Nothing saved yet</h3>
          <p>Hit the bookmark on any song to park it here without touching a playlist.</p></div>`}`;
  viewCtx = { songs, playlistId: null };
  setTabTitle("Saves");
  if (songs.length) $("#coll-play").onclick = () => playQueue(songs, 0);
  const clear = $("#saves-clear");
  if (clear) clear.onclick = async () => {
    const sure = await modalPrompt("Type CLEAR to empty your Saves", "CLEAR");
    if (sure !== "CLEAR") return;
    await api.clearSaves();
    state.library.saves = [];
    renderSidebar();
    router();
  };
  const move = $("#saves-to-playlist");
  if (move) move.onclick = async () => {
    const name = await modalPrompt("Name the new playlist", "From my Saves");
    if (!name) return;
    try {
      const p = await api.importPlaylist(name, songs);
      state.library.playlists.push(p);
      renderSidebar();
      toast(`Created "${p.name}" from ${songs.length} saves`);
      location.hash = `#/playlist/${p.id}`;
    } catch (err) { toast(err.message, true); }
  };
  highlightPlayingRow();
}

/* ==========================================================================
   Smart playlists — saved library filters that re-evaluate on every visit
   ========================================================================== */
// Everything already in the library is the corpus; a smart list is just a
// predicate over it, so it can never go stale.
const SMART_LISTS = [
  {
    id: "recent-likes", name: "Recently liked", sub: "Your last 50 likes",
    pick: () => state.library.liked.slice(0, 50),
  },
  {
    id: "on-repeat", name: "On repeat", sub: "Played most often",
    pick: () => state.library.history.slice(0, 40),
  },
  {
    id: "long", name: "Long players", sub: "Everything over 6 minutes",
    pick: () => libraryCorpus().filter((s) => Number(s.duration) > 360),
  },
  {
    id: "quick", name: "Quick hits", sub: "Under 3 minutes",
    pick: () => libraryCorpus().filter((s) => Number(s.duration) > 0 && Number(s.duration) < 180),
  },
  {
    id: "unplayed-saves", name: "Saves you haven't played", sub: "From your listen-later shelf",
    pick: () => {
      const played = new Set(state.library.history.map((s) => s.id));
      return (state.library.saves || []).filter((s) => !played.has(s.id));
    },
  },
];

// Every distinct song the account knows about, de-duplicated by id.
function libraryCorpus() {
  const seen = new Map();
  [
    state.library.liked,
    state.library.saves || [],
    ...state.library.playlists.map((p) => p.songs),
    state.library.history,
  ].flat().forEach((s) => { if (s && !seen.has(s.id)) seen.set(s.id, s); });
  return [...seen.values()];
}

const smartByArtist = () => {
  // One auto list per followed artist, built from what's already in the library.
  const corpus = libraryCorpus();
  return state.library.artists.map((a) => ({
    id: `artist-${a.id}`,
    name: `All ${a.name}`,
    sub: "Everything of theirs in your library",
    pick: () => corpus.filter((s) => s.artistId === a.id || s.artist === a.name),
  })).filter((l) => l.pick().length > 1);
};

const allSmartLists = () => [...SMART_LISTS, ...smartByArtist()];

function renderSmart(id) {
  const list = allSmartLists().find((l) => l.id === id);
  if (!list) {
    view.innerHTML = `<div class="search-empty"><h3>That smart playlist no longer exists</h3></div>`;
    return;
  }
  const songs = list.pick();
  view.innerHTML = `
    <div class="collection-hero" style="background:linear-gradient(180deg, ${gradientFor(list.name)}cc 0%, transparent 100%)">
      <div class="collection-header">
        <div class="ch-art ch-art-smart">${I.sparkle}</div>
        <div class="ch-info">
          <div class="ch-kind"><span class="type-chip">Smart playlist</span></div>
          <h1 class="ch-title">${esc(list.name)}</h1>
          <div class="ch-sub">${esc(list.sub)} · updates itself · ${songs.length} songs${songs.length ? `, ${fmtTotal(songs)}` : ""}</div>
        </div>
      </div>
    </div>
    <div class="collection-actions">
      ${songs.length ? `<button class="big-play" id="coll-play">${I.play}</button>` : ""}
      ${songs.length ? `<button class="btn-outline" id="smart-freeze">Save a fixed copy</button>` : ""}
    </div>
    ${songs.length ? filterBarHTML(`Search ${list.name}`) : ""}
    ${songs.length
      ? trackListHTML(songs, { savable: true })
      : `<div class="search-empty"><h3>Nothing matches this filter yet</h3>
          <p>It'll fill in as your library grows.</p></div>`}`;
  viewCtx = { songs, playlistId: null };
  setTabTitle(list.name);
  if (songs.length) $("#coll-play").onclick = () => playQueue(songs, 0);
  const freeze = $("#smart-freeze");
  if (freeze) freeze.onclick = async () => {
    try {
      const p = await api.importPlaylist(list.name, songs);
      state.library.playlists.push(p);
      renderSidebar();
      toast(`Froze "${p.name}" as a normal playlist`);
      location.hash = `#/playlist/${p.id}`;
    } catch (err) { toast(err.message, true); }
  };
  highlightPlayingRow();
}

/* ==========================================================================
   Profile — one tab for the account, friends, history and every setting
   ========================================================================== */
const PROFILE_TABS = [
  ["overview", "Overview"],
  ["friends", "Friends"],
  ["history", "Listening history"],
  ["settings", "Settings"],
];

function renderProfile(sub = "") {
  const tab = PROFILE_TABS.some(([k]) => k === sub) ? sub : "overview";
  const u = state.user || {};
  view.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar">${esc((u.name || "?")[0].toUpperCase())}</div>
      <div class="profile-id">
        <div class="ch-kind">Profile</div>
        <h1 class="ch-title">${esc(u.name || "You")}</h1>
        <div class="ch-sub">${esc(u.email || "")}${u.role === "admin" ? " · Admin" : ""}</div>
      </div>
    </div>
    <nav class="subtabs" id="profile-subtabs">
      ${PROFILE_TABS.map(([k, label]) =>
        `<a class="subtab${k === tab ? " active" : ""}" href="#/profile/${k}">${esc(label)}</a>`).join("")}
    </nav>
    <div id="profile-body"></div>`;
  viewCtx = { songs: [], playlistId: null };
  setTabTitle("Profile");

  const body = $("#profile-body");
  if (tab === "overview") profileOverview(body);
  if (tab === "friends") profileFriends(body);
  if (tab === "history") profileHistory(body);
  if (tab === "settings") profileSettings(body);
}

function profileOverview(el) {
  const { liked, playlists, albums, artists, history, saves = [] } = state.library;
  const stat = (n, label) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`;
  el.innerHTML = `
    <div class="stat-row">
      ${stat(liked.length, "Liked songs")}
      ${stat(saves.length, "Saved for later")}
      ${stat(playlists.length, "Playlists")}
      ${stat(albums.length, "Albums")}
      ${stat(artists.length, "Artists")}
      ${stat(history.length, "Recently played")}
    </div>
    <div class="section" id="profile-members"></div>
    <div class="section" id="profile-top"></div>`;
  loadMembers();
  loadTopPlayed();
}

/* Member management lives right here rather than behind its own route: on a
   self-hosted, invite-only instance this is the only "account" concept there
   is. Admins get the controls; everyone else just sees who they share with. */
async function loadMembers() {
  const el = $("#profile-members");
  if (!el) return;
  const admin = state.user?.role === "admin";
  el.innerHTML = `<h2>Members${admin ? ` <button class="btn-solid" id="mem-invite">Invite someone</button>` : ""}</h2>
    <div class="spinner"></div>`;

  let data;
  try {
    data = admin
      ? await api.get("/api/admin/users")
      : { users: await api.get("/api/members"), invites: [] };
  } catch (err) {
    el.querySelector(".spinner")?.remove();
    return el.insertAdjacentHTML("beforeend", `<p class="admin-sub">Couldn't load members: ${esc(err.message)}</p>`);
  }
  if (currentRoute !== "profile") return;

  const you = state.user?.email;
  const rows = data.users.map((u) => {
    const isYou = u.email ? u.email === you : u.id === state.user?.id;
    const actions = !admin || isYou
      ? (isYou ? `<span class="admin-sub">you</span>` : "")
      : `<button class="btn-ghost" data-mem-toggle="${u.id}" data-next="${u.active ? 0 : 1}">${u.active ? "Disable" : "Enable"}</button>
         <button class="btn-ghost danger-text" data-mem-del="${u.id}" data-name="${esc(u.name)}">Delete</button>`;
    return `
      <div class="friend-row" data-search="${esc(u.name)}">
        <span class="user-avatar">${esc((u.name || "?")[0].toUpperCase())}</span>
        <span class="friend-meta">
          <span class="friend-name">${esc(u.name)}</span>
          <span class="friend-sub">${admin ? esc(u.email) : ""}${u.role === "admin" ? (admin ? " · " : "") + "Admin" : ""}${u.active === 0 ? " · disabled" : ""}</span>
        </span>
        <span class="friend-actions">${actions}</span>
      </div>`;
  }).join("");

  // Only worth a heading when something is actually outstanding.
  const pending = admin ? data.invites.filter((i) => !i.used) : [];
  const invites = pending.length
    ? `<h2>Pending invites</h2>
       <div class="friend-list">${pending.map((inv) => `
         <div class="friend-row">
           <span class="user-avatar">${esc((inv.name || "?")[0].toUpperCase())}</span>
           <span class="friend-meta">
             <span class="friend-name">${esc(inv.name)}</span>
             <span class="friend-sub">${esc(inv.email)} · not redeemed yet</span>
           </span>
           <span class="friend-actions">
             <button class="btn-ghost" data-mem-copy="/invite.html?token=${esc(inv.token)}">Copy link</button>
           </span>
         </div>`).join("")}</div>`
    : "";

  el.innerHTML = `
    <h2>Members${admin ? ` <button class="btn-solid" id="mem-invite">Invite someone</button>` : ""}</h2>
    <div class="friend-list">${rows}</div>
    ${admin ? "" : `<p class="pc-note">Marusic is invite-only. Ask an admin to invite someone new.</p>`}
    ${invites}`;

  const inviteBtn = $("#mem-invite");
  if (inviteBtn) inviteBtn.onclick = inviteMemberFlow;
}

async function inviteMemberFlow() {
  const name = await modalPrompt("Invite: their name", "Friend");
  if (!name) return;
  const email = await modalPrompt("Invite: their email", "friend@example.com");
  if (!email) return;
  try {
    const { url } = await api.send("POST", "/api/admin/invite", { name, email });
    const full = location.origin + url;
    try { await navigator.clipboard.writeText(full); toast("Invite link copied to clipboard"); }
    catch { await modalPrompt("Copy this invite link", "", full); }
    loadMembers();
  } catch (err) { toast(err.message, true); }
}

// Delegated so the rows can be repainted without rewiring anything.
view.addEventListener("click", async (e) => {
  const toggle = e.target.closest("[data-mem-toggle]");
  const del = e.target.closest("[data-mem-del]");
  const copy = e.target.closest("[data-mem-copy]");
  if (copy) {
    const full = location.origin + copy.dataset.memCopy;
    try { await navigator.clipboard.writeText(full); toast("Invite link copied"); }
    catch { await modalPrompt("Copy this invite link", "", full); }
    return;
  }
  if (!toggle && !del) return;
  try {
    if (toggle) {
      await api.send("POST", `/api/admin/user/${toggle.dataset.memToggle}/active`,
        { active: toggle.dataset.next === "1" });
    } else {
      const sure = await modalPrompt(
        `Type DELETE to remove ${del.dataset.name} and their library`, "DELETE");
      if (sure !== "DELETE") return;
      await api.send("DELETE", `/api/admin/user/${del.dataset.memDel}`);
      toast(`Removed ${del.dataset.name}`);
    }
    loadMembers();
  } catch (err) { toast(err.message, true); }
});

async function loadTopPlayed() {
  try {
    const songs = await api.topPlayed();
    const el = $("#profile-top");
    if (!el || !songs.length) return;
    el.innerHTML = `<h2>On repeat</h2>${trackListHTML(songs.slice(0, 20), { noAlbum: true })}`;
    viewCtx = { songs: songs.slice(0, 20), playlistId: null };
    highlightPlayingRow();
  } catch { /* play counts only exist once you've listened to something */ }
}

/* ---- friends: found by display name, no external account needed ---- */
async function profileFriends(el) {
  el.innerHTML = `
    <div class="section">
      <h2>Add a friend</h2>
      <div class="friend-search">
        <span>${I.search}</span>
        <input id="friend-q" placeholder="Search members by username" autocomplete="off" spellcheck="false">
      </div>
      <div id="friend-results" class="friend-list"></div>
    </div>
    <div id="friend-lists"><div class="spinner"></div></div>`;

  const q = $("#friend-q");
  let timer;
  q.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const term = q.value.trim();
      const box = $("#friend-results");
      if (!box) return;
      if (term.length < 2) return (box.innerHTML = "");
      try {
        const found = await api.findMembers(term);
        box.innerHTML = found.length
          ? found.map((m) => friendRowHTML(m, `<button class="btn-outline" data-add="${m.id}">${I.userPlus}Add</button>`)).join("")
          : `<p class="admin-sub">No member here goes by “${esc(term)}”.</p>`;
      } catch (err) { toast(err.message, true); }
    }, 250);
  });

  await paintFriendLists();
}

const friendRowHTML = (m, actions, sub = "") => `
  <div class="friend-row" data-search="${esc(m.name)}">
    <span class="user-avatar">${esc((m.name || "?")[0].toUpperCase())}</span>
    <span class="friend-meta">
      <span class="friend-name">${esc(m.name)}</span>
      ${sub ? `<span class="friend-sub">${sub}</span>` : ""}
    </span>
    <span class="friend-actions">${actions}</span>
  </div>`;

async function paintFriendLists() {
  const box = $("#friend-lists");
  if (!box) return;
  let data;
  try { data = await api.friends(); }
  catch (err) { return (box.innerHTML = `<p class="admin-sub">${esc(err.message)}</p>`); }
  if (!$("#friend-lists")) return;

  const section = (title, rows, emptyNote) => `
    <div class="section">
      <h2>${title}</h2>
      ${rows.length ? `<div class="friend-list">${rows.join("")}</div>` : `<p class="admin-sub">${emptyNote}</p>`}
    </div>`;

  box.innerHTML = [
    data.pendingIn.length ? section("Wants to be your friend",
      data.pendingIn.map((m) => friendRowHTML(m,
        `<button class="btn-solid" data-add="${m.id}">Accept</button>
         <button class="btn-ghost" data-drop="${m.id}">Ignore</button>`)), "") : "",
    section("Friends", data.friends.map((m) => friendRowHTML(m,
      `<button class="btn-ghost danger-text" data-drop="${m.id}">Remove</button>`,
      m.nowPlaying ? `Last played ${esc(m.nowPlaying.title)} · ${esc(m.nowPlaying.artist)}` : "Hasn't played anything yet")),
      "No friends yet — search for a member above to send the first request."),
    data.pendingOut.length ? section("Requests you sent",
      data.pendingOut.map((m) => friendRowHTML(m,
        `<button class="btn-ghost" data-drop="${m.id}">Cancel</button>`, "Waiting for them to accept")), "") : "",
  ].join("");
}

// One delegated handler covers search results and all three friend lists.
view.addEventListener("click", async (e) => {
  const add = e.target.closest("[data-add]");
  const drop = e.target.closest("[data-drop]");
  if (!add && !drop) return;
  try {
    if (add) {
      const res = await api.addFriend(Number(add.dataset.add));
      toast(res.accepted ? "You're now friends" : "Friend request sent");
      const box = $("#friend-results");
      if (box) box.innerHTML = "";
      const q = $("#friend-q");
      if (q) q.value = "";
    } else {
      await api.removeFriend(Number(drop.dataset.drop));
      toast("Removed");
    }
    await paintFriendLists();
  } catch (err) { toast(err.message, true); }
});

function profileHistory(el) {
  const songs = state.library.history;
  el.innerHTML = `
    <div class="section">
      <h2>Recently played
        ${songs.length ? `<button class="btn-ghost danger-text" id="hist-clear">Clear history</button>` : ""}
      </h2>
      ${filterBarHTML("Search your history")}
      ${songs.length
        ? trackListHTML(songs, { noAlbum: false })
        : `<p class="admin-sub">Nothing played yet.</p>`}
    </div>`;
  viewCtx = { songs, playlistId: null };
  highlightPlayingRow();
  const clear = $("#hist-clear");
  if (clear) clear.onclick = async () => {
    const sure = await modalPrompt("Type CLEAR to erase your listening history", "CLEAR");
    if (sure !== "CLEAR") return;
    await api.send("DELETE", "/api/history");
    state.library.history = [];
    toast("Listening history cleared");
    renderProfile("history");
  };
}

function profileSettings(el) {
  const row = (label, note, control) => `
    <div class="set-row">
      <div class="set-label"><b>${label}</b>${note ? `<span>${note}</span>` : ""}</div>
      <div class="set-control">${control}</div>
    </div>`;
  el.innerHTML = `
    <div class="section">
      <h2>Playback</h2>
      <div class="panel-card">
        ${row("Audio quality", "Higher quality uses more bandwidth.", `
          <select id="set-quality">
            ${["high", "medium", "low"].map((q) =>
              `<option value="${q}"${state.quality === q ? " selected" : ""}>${q[0].toUpperCase() + q.slice(1)}</option>`).join("")}
          </select>`)}
        ${row("Autoplay", "Keep playing similar songs when the queue runs out.",
          `<label class="switch"><input type="checkbox" id="set-autoplay"${state.autoplay ? " checked" : ""}><span></span></label>`)}
        ${row("Skip silence", "Trim dead air at the start and end of a track.",
          `<label class="switch"><input type="checkbox" id="set-skipsilence"${prefs.skipSilence ? " checked" : ""}><span></span></label>`)}
        ${row("Crossfade the gap", "Fade the last second of a track into the next.",
          `<label class="switch"><input type="checkbox" id="set-fade"${prefs.fadeOut ? " checked" : ""}><span></span></label>`)}
        ${row("DJ", "Docks beside the player and lines up what's next.",
          `<label class="switch"><input type="checkbox" id="set-dj"${prefs.dj ? " checked" : ""}><span></span></label>`)}
      </div>
    </div>

    <div class="section">
      <h2>Home page</h2>
      <div class="panel-card">
        <p class="pc-note">Rows on Home can be pinned, hidden and reordered from the
        <b>Customise</b> button at the top of <a href="#/home">Home</a>.</p>
        <button class="btn-outline" id="set-home-reset">Reset home layout</button>
      </div>
    </div>

    <div class="section">
      <h2>Account</h2>
      <div class="panel-card">
        ${row("Display name", esc(state.user?.name || ""), `<button class="btn-outline" id="set-name">Change</button>`)}
        ${row("Password", "Changing it signs out your other devices.", `<button class="btn-outline" id="set-pw">Change</button>`)}
        ${state.user?.role === "admin"
          ? row("Members", "Invite people and manage access.", `<a class="btn-outline" href="#/profile">Manage members</a>`)
          : ""}
        ${row("Session", "Sign out on this device.", `<button class="btn-outline danger-text" id="set-logout">Log out</button>`)}
      </div>
    </div>`;

  $("#set-quality").onchange = (e) => {
    state.quality = e.target.value;
    localStorage.setItem("quality", state.quality);
    toast(`Audio quality: ${state.quality}`);
  };
  $("#set-autoplay").onchange = (e) => {
    state.autoplay = e.target.checked;
    localStorage.setItem("autoplay", state.autoplay ? "on" : "off");
    applyAutoplayUI();
  };
  $("#set-skipsilence").onchange = (e) => setPref("skipSilence", e.target.checked);
  $("#set-fade").onchange = (e) => setPref("fadeOut", e.target.checked);
  $("#set-dj").onchange = (e) => setDj(e.target.checked);
  $("#set-home-reset").onclick = () => {
    setPref("homeRows", null);
    toast("Home layout reset");
  };
  $("#set-name").onclick = changeDisplayName;
  $("#set-pw").onclick = openPasswordModal;
  $("#set-logout").onclick = logout;
}

async function changeDisplayName() {
  const name = await modalPrompt("Change display name", "", state.user.name);
  if (!name || name === state.user.name) return;
  try {
    const res = await api.changeName(name);
    state.user.name = res.name;
    renderUserChip();
    if (currentRoute === "profile") router();
    toast("Name updated");
  } catch (err) { toast(err.message, true); }
}

async function logout() {
  if (castActive()) castCtx.endCurrentSession(true); // don't leave the TV playing
  if (sonosActive()) sonosStopToLocal({ silent: true }); // …or the speaker
  await fetch("/api/logout", { method: "POST" });
  localStorage.removeItem("player");
  location.replace("/login.html");
}

/* ==========================================================================
   Preferences — small, local, and shared by several features
   ========================================================================== */
const PREF_DEFAULTS = {
  skipSilence: false,
  fadeOut: false,
  homeRows: null,      // null = the built-in order
  libraryFull: false,
  discoGrid: true,     // discography: grid vs list
  discoOpen: false,    // discography starts collapsed
  lyricsSize: 18,
  dj: false,
  jamMode: "speaker", // which kind the Jam screen offers first
};

const prefs = (() => {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem("prefs") || "{}"); } catch {}
  return { ...PREF_DEFAULTS, ...saved };
})();

// Passing null restores that key's built-in default rather than storing null.
function setPref(key, value) {
  prefs[key] = value === null ? PREF_DEFAULTS[key] : value;
  try { localStorage.setItem("prefs", JSON.stringify(prefs)); } catch {}
}

/* ==========================================================================
   Shell: theme switch, desktop page tabs, universal in-page search
   ========================================================================== */

/* ---- desktop multi-tab browsing ----
   Ctrl/⌘/middle-click a card (or a sidebar entry) to keep the page you're on
   and open the new one beside it. Tabs are session-only by design: they're a
   workspace, not a bookmark bar. */
let pageTabs = [];   // [{ hash, title }]
let tabIndex = 0;
let suppressTabSync = false;

const routeLabel = (hash) => {
  const route = hash.slice(2).split("/")[0] || "home";
  return ({
    home: "Home", search: "Search", browse: "Browse", discover: "Discover", library: "Library",
    profile: "Profile", liked: "Liked Songs", saves: "Saves", radio: "Radio",
    jam: "Jam", trending: "Trending", admin: "Members",
  })[route] || route.charAt(0).toUpperCase() + route.slice(1);
};

function renderPageTabs() {
  const strip = $("#page-tabs");
  // A lone tab is just "the page you're on" — don't spend a row of chrome on it.
  strip.classList.toggle("hidden", pageTabs.length < 2);
  strip.innerHTML = pageTabs
    .map((t, i) => `<button class="page-tab${i === tabIndex ? " active" : ""}" data-tab="${i}">
        <span class="page-tab-label">${esc(t.title)}</span>
        <span class="page-tab-close" data-close="${i}" title="Close tab">${I.close}</span>
      </button>`)
    .join("");
}

// Keeps the tab strip honest after any navigation, however it happened.
function syncPageTabs() {
  const hash = location.hash || "#/home";
  if (suppressTabSync) return;
  if (!pageTabs.length) pageTabs = [{ hash, title: routeLabel(hash) }];
  else pageTabs[tabIndex] = { hash, title: pageTabs[tabIndex]?.hash === hash ? pageTabs[tabIndex].title : routeLabel(hash) };
  renderPageTabs();
}

// Views know their own real title (an album name beats "Album"), so they call
// this once the heading exists.
function setTabTitle(title) {
  if (!title || !pageTabs[tabIndex]) return;
  pageTabs[tabIndex].title = title;
  renderPageTabs();
}

function openInNewTab(hash, title) {
  pageTabs.splice(++tabIndex, 0, { hash, title: title || routeLabel(hash) });
  renderPageTabs();
  suppressTabSync = true;
  location.hash = hash;
  setTimeout(() => { suppressTabSync = false; }, 0);
}

function closeTab(i) {
  if (pageTabs.length < 2) return;
  pageTabs.splice(i, 1);
  if (tabIndex >= pageTabs.length) tabIndex = pageTabs.length - 1;
  else if (i < tabIndex) tabIndex--;
  renderPageTabs();
  suppressTabSync = true;
  location.hash = pageTabs[tabIndex].hash;
  setTimeout(() => { suppressTabSync = false; }, 0);
}

$("#page-tabs").addEventListener("click", (e) => {
  const close = e.target.closest("[data-close]");
  if (close) { e.stopPropagation(); return closeTab(Number(close.dataset.close)); }
  const tab = e.target.closest("[data-tab]");
  if (!tab) return;
  tabIndex = Number(tab.dataset.tab);
  renderPageTabs();
  suppressTabSync = true;
  location.hash = pageTabs[tabIndex].hash;
  setTimeout(() => { suppressTabSync = false; }, 0);
});

$("#page-tabs").addEventListener("auxclick", (e) => {
  const tab = e.target.closest("[data-tab]");
  if (tab && e.button === 1) { e.preventDefault(); closeTab(Number(tab.dataset.tab)); }
});

// Middle-click / ctrl-click anywhere in the view that leads somewhere.
const tabHashFor = (el) => {
  const card = el.closest("[data-card]");
  if (card) {
    // The same data-card lives on grid cards and on list rows, so read whichever
    // label this one actually has.
    const label = (card.querySelector(".card-title") || card.querySelector(".lib-row-name"))?.textContent;
    const k = card.dataset.card;
    if (k === "album") return [`#/album/${encodeURIComponent(card.dataset.token)}`, label];
    if (k === "artist") return [`#/artist/${encodeURIComponent(card.dataset.id)}`, label];
    if (k === "playlist") return [`#/playlist/${card.dataset.id}`, label];
    if (k === "ytplaylist") return [`#/ytplaylist/${encodeURIComponent(card.dataset.token)}`, label];
    if (k === "liked") return ["#/liked", "Liked Songs"];
    if (k === "saves") return ["#/saves", "Saves"];
  }
  const link = el.closest("a[href^='#/']");
  if (link) {
    const label = (link.querySelector(".lib-name") || link.querySelector(".lib-row-name"))?.textContent;
    return [link.getAttribute("href"), label];
  }
  return null;
};

document.addEventListener("auxclick", (e) => {
  if (e.button !== 1 || isPhone()) return;
  const target = tabHashFor(e.target);
  if (!target) return;
  e.preventDefault();
  openInNewTab(target[0], target[1]);
});

document.addEventListener("click", (e) => {
  if (!(e.ctrlKey || e.metaKey) || isPhone()) return;
  const target = tabHashFor(e.target);
  if (!target) return;
  e.preventDefault();
  e.stopPropagation();
  openInNewTab(target[0], target[1]);
}, true);

/* ---- universal in-page search ----
   Every collection page carries its own filter. It hides non-matching rows in
   place rather than re-rendering, so the field never loses focus mid-word. */
let pageFilter = "";

const filterBarHTML = (placeholder = "Search in this page") => `
  <div class="page-filter">
    <span class="pf-icon">${I.search}</span>
    <input class="pf-input" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false" value="${esc(pageFilter)}">
    <button class="pf-clear icon-btn${pageFilter ? "" : " hidden"}" title="Clear">${I.close}</button>
    <span class="pf-count"></span>
  </div>`;

function applyPageFilter(q) {
  pageFilter = q;
  const needle = q.trim().toLowerCase();
  let shown = 0, total = 0;
  const sift = (el) => {
    total++;
    const hay = (el.dataset.search || el.textContent || "").toLowerCase();
    const hit = !needle || hay.includes(needle);
    el.classList.toggle("filtered-out", !hit);
    if (hit) shown++;
  };
  view.querySelectorAll(".track, .lib-row, .card, .friend-row").forEach(sift);
  // A section whose every child vanished should go too, header and all.
  view.querySelectorAll(".section").forEach((sec) => {
    const items = sec.querySelectorAll(".track, .lib-row, .card, .friend-row");
    sec.classList.toggle("filtered-out", !!needle && items.length > 0 &&
      [...items].every((el) => el.classList.contains("filtered-out")));
  });
  const count = view.querySelector(".pf-count");
  if (count) count.textContent = needle ? `${shown} of ${total}` : "";
  const clear = view.querySelector(".pf-clear");
  if (clear) clear.classList.toggle("hidden", !needle);
  let empty = view.querySelector(".pf-empty");
  if (needle && !shown && total) {
    if (!empty) {
      empty = document.createElement("div");
      empty.className = "pf-empty search-empty";
      view.appendChild(empty);
    }
    empty.innerHTML = `<h3>Nothing here matches “${esc(q)}”</h3>`;
  } else if (empty) empty.remove();
}

view.addEventListener("input", (e) => {
  if (e.target.classList.contains("pf-input")) applyPageFilter(e.target.value);
});

view.addEventListener("click", (e) => {
  if (!e.target.closest(".pf-clear")) return;
  const input = view.querySelector(".pf-input");
  if (input) { input.value = ""; input.focus(); }
  applyPageFilter("");
});

/* ---- horizontal shelves ----
   Card rows scroll in place on desktop instead of shoving you onto a "show
   all" page just to see the sixth item. */
function mountShelfControls(root = view) {
  root.querySelectorAll(".shelf").forEach((grid) => {
    if (grid.dataset.shelfMounted) return;
    grid.dataset.shelfMounted = "1";
    const wrap = document.createElement("div");
    wrap.className = "shelf-wrap";
    grid.parentNode.insertBefore(wrap, grid);
    wrap.appendChild(grid);
    wrap.insertAdjacentHTML("afterbegin",
      `<button class="shelf-nav prev" title="Scroll left">${I.chevronLeft}</button>`);
    wrap.insertAdjacentHTML("beforeend",
      `<button class="shelf-nav next" title="Scroll right">${I.chevronRight}</button>`);

    const update = () => {
      const max = grid.scrollWidth - grid.clientWidth - 2;
      wrap.querySelector(".prev").classList.toggle("hidden", grid.scrollLeft <= 2);
      wrap.querySelector(".next").classList.toggle("hidden", grid.scrollLeft >= max);
    };
    const page = (dir) => grid.scrollBy({ left: dir * grid.clientWidth * 0.85, behavior: "smooth" });
    wrap.querySelector(".prev").onclick = () => page(-1);
    wrap.querySelector(".next").onclick = () => page(1);
    grid.addEventListener("scroll", update, { passive: true });
    new ResizeObserver(update).observe(grid);
    update();
  });
}

/* ---------------- router ---------------- */
// Which top-level tab owns each route — the tabs stay lit while you drill into
// an album or an artist, so you never lose track of where you are.
const TAB_OWNER = {
  home: "home", trending: "home", radio: "home", jam: "home", together: "home",
  search: "search", browse: "search", album: "search", artist: "search", ytplaylist: "search", shared: "search",
  discover: "discover",
  library: "library", liked: "library", saves: "library", playlist: "library", smart: "library",
  profile: "profile", admin: "profile",
};

function markActiveNav() {
  const route = currentRoute;
  const owner = TAB_OWNER[route] || route;
  document.querySelectorAll("[data-nav]").forEach((a) =>
    a.classList.toggle("active", a.dataset.nav === route || a.dataset.nav === owner)
  );
  document.querySelectorAll("[data-plid]").forEach((a) =>
    a.classList.toggle("active", route === "playlist" && location.hash.includes(a.dataset.plid))
  );
  document.querySelectorAll("[data-mnav]").forEach((a) =>
    a.classList.toggle("active", a.dataset.mnav === owner && route !== "search")
  );
  $("#phone-search-btn").classList.toggle("active", route === "search");
}

function router() {
  const parts = (location.hash || "#/home").slice(2).split("/");
  const route = parts[0] || "home";
  const param = parts.slice(1).join("/");
  currentRoute = route;

  // On desktop the wordmark is a Home affordance, so it only shows there. On
  // phones the header has nothing else in it now that search has moved out, so
  // it stays put and the bar reads as an app bar rather than a stray avatar.
  $("#topbar-brand").classList.toggle("hidden", route !== "home" && !isPhone());
  markActiveNav();
  placeSearchBar();
  syncPageTabs();
  $("#main").scrollTop = 0;
  pageFilter = ""; // the in-page filter belongs to the page you just left

  switch (route) {
    case "home": renderHome(); break;
    case "search":
      searchInput.value = state.searchQ;
      renderSearch();
      // "go search" with nothing typed yet: put the cursor in the field (on a
      // phone only when the search icon was tapped — not on every back-swipe)
      if (!state.searchQ.trim() && (!isPhone() || phoneSearchTap)) searchInput.focus();
      phoneSearchTap = false;
      break;
    case "browse": renderBrowse(); break;
    case "discover": renderDiscover(); break;
    case "profile": renderProfile(param); break;
    case "album": renderAlbum(decodeURIComponent(param)); break;
    case "artist": renderArtist(decodeURIComponent(param)); break;
    case "ytplaylist": renderYtPlaylist(decodeURIComponent(param)); break;
    case "shared": renderShared(decodeURIComponent(param)); break;
    case "playlist": renderPlaylist(param); break;
    case "liked": renderLiked(); break;
    case "saves": renderSaves(); break;
    case "smart": renderSmart(decodeURIComponent(param)); break;
    case "trending": renderTrending(); break;
    case "radio": renderRadio(); break;
    // one view, two front doors: #/jam is the same-room feature, #/together
    // the remote one. Inside a session both show its dashboard.
    case "jam": renderJamView(param); break;
    // links shared while the two had separate routes still work
    case "together":
      location.replace(param ? `#/jam/${param}` : "#/jam");
      break;
    case "library": renderLibrary(); break;
    // Member management moved into Profile; keep the old route pointing there.
    case "admin": location.replace("#/profile"); break;
    default: renderHome();
  }
}

$("#btn-back").addEventListener("click", () => history.back());
$("#btn-fwd").addEventListener("click", () => history.forward());

$("#main").addEventListener("scroll", (e) => {
  e.currentTarget.classList.toggle("scrolled", e.currentTarget.scrollTop > 24);
});

/* ---------------- init ---------------- */
function mountIcons() {
  document.querySelectorAll("[data-icon]").forEach((el) => {
    const icon = I[el.dataset.icon];
    if (icon) el.innerHTML = icon;
  });
}

async function init() {
  // auth gate: no session → sign-in screen (same flow as animeMarwan)
  let me = null;
  try { me = await fetch("/api/me", { cache: "no-store" }); } catch {}
  if (!me || me.status === 401) {
    location.replace("/login.html");
    return;
  }
  state.user = await me.json();

  mountIcons();
  renderUserChip();
  applyLibraryMode();
  applyDjUI();
  updatePlayButton();
  applyAutoplayUI();
  applyShuffleRepeatUI();
  $("#btn-mute").innerHTML = I.volume;
  applyVolume(Number(localStorage.getItem("volume") ?? 80));

  try {
    state.library = await api.library();
  } catch {
    toast("Couldn't load your library", true);
  }
  renderSidebar();

  // rejoin a live jam (survives reloads); otherwise restore local playback
  let jamSnap = null;
  try {
    jamSnap = (await api.jamState()).jam;
  } catch { /* jam state is a nicety */ }
  if (jamSnap) enterJam(jamSnap, { quiet: true });
  else restorePlayerState();

  window.addEventListener("hashchange", router);
  // setting the hash fires hashchange, which routes — so only route directly
  // when there is already a hash, or the first paint happens twice
  if (location.hash) router();
  else location.hash = "#/home";

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

init();

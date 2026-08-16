// Central configuration — same pattern as animeMarwan: read env, apply safe
// dev defaults, and refuse to boot in production with default secrets.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tiny .env loader (KEY=VALUE lines, # comments) — avoids a dotenv dependency.
// Real environment variables always win over the file.
const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !m[2].startsWith("#") && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const isProd = process.env.NODE_ENV === "production";

function required(name) {
  const v = process.env[name];
  if (!v && isProd) {
    console.error(`\n  FATAL: ${name} must be set in production. Refusing to start.\n`);
    process.exit(1);
  }
  return v || null;
}

// Admin seed (first run, empty database only).
const adminEmail = process.env.ADMIN_EMAIL || (isProd ? required("ADMIN_EMAIL") : "marwansummakieh97@gmail.com");
const adminPassword = process.env.ADMIN_PASSWORD || (isProd ? required("ADMIN_PASSWORD") : "changeme");
if (isProd && adminPassword === "changeme") {
  console.error("\n  FATAL: ADMIN_PASSWORD is still the default 'changeme'. Set a real one.\n");
  process.exit(1);
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 0,
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProd,
  sessionMaxAgeDays: Number(process.env.SESSION_MAX_AGE_DAYS) || 30,
  dbPath: process.env.DB_PATH || null, // null → data/marusic.sqlite
  minPasswordLength: Number(process.env.MIN_PASSWORD_LENGTH) || 8,
  admin: { email: adminEmail, password: adminPassword },
  // Base URL a playback device (Chromecast, Sonos) should fetch streams from
  // when the app is opened on localhost (devices can't resolve "localhost").
  // Unset → the server guesses a LAN adapter; set it explicitly if the guess
  // picks a VPN/virtual adapter, e.g. CAST_BASE_URL=http://192.168.1.20:3000
  castBaseUrl: (process.env.CAST_BASE_URL || "").trim().replace(/\/+$/, "") || null,
  // Playback devices (Sonos speakers, DLNA TVs) to control even when SSDP
  // multicast discovery can't reach them (docker bridge networks, strict
  // VLANs) — comma-separated IPs. SONOS_IPS is the old name for the same
  // thing, kept working.
  upnpIps: [
    ...(process.env.UPNP_IPS || "").split(","),
    ...(process.env.SONOS_IPS || "").split(","),
  ]
    .map((s) => s.trim())
    .filter(Boolean),
  // Free public lossless (Qobuz) proxy instances — the squid.wtf / MusicFLAC
  // "get-music/download-music" API shape. These hosts rotate and get blocked
  // often, so they're configurable (comma-separated, tried in order). When
  // none are reachable, downloads fall back to the yt-dlp source.
  losslessApiBases: (process.env.LOSSLESS_API_BASE ||
    "https://qobuz.squid.wtf,https://eu.qobuz.squid.wtf")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  // Tidal source (SpotiFLAC's hifi-api mirrors): a track is found by text
  // search, then a FLAC CDN url is pulled from the base64 /track manifest.
  // These are a shared public pool that rotates; they're queried in parallel
  // and any that's up wins. Self-host binimum/hifi-api and set TIDAL_API_BASE
  // for guaranteed availability.
  tidalApiBases: (process.env.TIDAL_API_BASE ||
    [
      "https://vogel.qqdl.site",
      "https://maus.qqdl.site",
      "https://hund.qqdl.site",
      "https://katze.qqdl.site",
      "https://wolf.qqdl.site",
      "https://tidal.kinoplus.online",
      "https://tidal-api.binimum.org",
      "https://triton.squid.wtf",
    ].join(","))
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean),
};

if (!isProd && adminPassword === "changeme") {
  console.warn("  [dev] Default admin password 'changeme' — override with ADMIN_PASSWORD for anything real.");
}

export default config;

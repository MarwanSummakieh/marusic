// Security middleware: headers, a small in-memory login throttle, and the
// Cast media tokens. Ported from animeMarwan's security.mjs (minus the SSRF
// guard — marusic's stream proxy only fetches CDN URLs the server resolved
// itself, never user-supplied ones). Media tokens are back for Chromecast:
// the receiver fetches /api/stream without a session cookie.
import crypto from "node:crypto";

// CSP: our JS lives in external files (app.js/auth.js), so script-src stays
// strict; www.gstatic.com is the Google Cast sender SDK. style-src needs
// 'unsafe-inline' for the inline style attributes the UI uses (gradients,
// progress widths). Album art comes from saavncdn/ytimg, hence img-src https:.
const CSP = [
  "default-src 'self'",
  "img-src 'self' https: data:",
  "media-src 'self'",
  "script-src 'self' https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export function securityHeaders(_req, res, next) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.removeHeader("X-Powered-By");
  next();
}

// ---- login rate limiter (per IP, sliding window) ----
export function makeRateLimiter({ windowMs = 15 * 60 * 1000, max = 10 } = {}) {
  const hits = new Map(); // ip -> [timestamps]
  // opportunistic cleanup so the map can't grow unbounded
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, arr] of hits) {
      const kept = arr.filter((t) => t > cutoff);
      if (kept.length) hits.set(ip, kept);
      else hits.delete(ip);
    }
  }, windowMs).unref?.();

  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const cutoff = now - windowMs;
    const arr = (hits.get(ip) || []).filter((t) => t > cutoff);
    if (arr.length >= max) {
      res.setHeader("Retry-After", Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: "Too many attempts. Try again later." });
    }
    arr.push(now);
    hits.set(ip, arr);
    next();
  };
}

// ---- Cast media tokens ----
// A Chromecast fetches the audio itself and can't send the session cookie,
// so the sender app appends a signed short-lived token to the stream URL
// instead. HMAC over `userId.exp` with a per-boot secret: stateless, grants
// stream access only, and a restart invalidates it (like jams, casting is a
// live session — the sender just mints a fresh token on the next track load).
const CAST_SECRET = crypto.randomBytes(32);
const CAST_TOKEN_TTL = 12 * 60 * 60 * 1000; // long listening sessions

const castSig = (payload) =>
  crypto.createHmac("sha256", CAST_SECRET).update(payload).digest("base64url");

export function makeCastToken(userId, ttl = CAST_TOKEN_TTL) {
  const exp = Date.now() + ttl;
  const payload = `${userId}.${exp}`;
  return { token: `${payload}.${castSig(payload)}`, exp };
}

// -> { userId } for a valid unexpired token, else null
export function verifyCastToken(token) {
  const m = /^(\d+)\.(\d+)\.([\w-]+)$/.exec(String(token || ""));
  if (!m) return null;
  const want = castSig(`${m[1]}.${m[2]}`);
  if (m[3].length !== want.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(m[3]), Buffer.from(want))) return null;
  if (Number(m[2]) < Date.now()) return null;
  return { userId: Number(m[1]) };
}

// Marusic service worker: cache the static app shell so the installed PWA
// opens instantly. Network-first (so deploys land on next load) with a cache
// fallback for offline. The API — including the audio proxy — is never
// touched: Range streaming and auth must always hit the server.
const CACHE = "marusic-shell-v21";
const SHELL = [
  "/",
  "/styles.css?v=28",
  "/app.js?v=28",
  "/auth.js",
  "/login.html",
  "/invite.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      // SPA routes all serve index.html — fall back to the cached shell
      .catch(async () =>
        (await caches.match(e.request)) ||
        (await caches.match("/")) ||
        Response.error()
      )
  );
});

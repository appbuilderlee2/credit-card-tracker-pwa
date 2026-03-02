// Minimal service worker for offline caching (MVP)
const CACHE = "g5-cards-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./about.html",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/config.js",
  "./src/sheets_gviz.js",
  "./public/icon-192.png",
  "./public/icon-512.png",
];

self.addEventListener("install", (evt) => {
  evt.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evt) => {
  const req = evt.request;
  evt.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Cache only same-origin GET
          try {
            const url = new URL(req.url);
            if (req.method === "GET" && url.origin === self.location.origin) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
          } catch {}
          return res;
        })
        .catch(() => cached);
    })
  );
});

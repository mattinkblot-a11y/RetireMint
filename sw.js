/* Caches the app shell and the three libraries it loads from unpkg, so after one
   online launch it opens with no network at all. Bump CACHE to force an update. */
const CACHE = "retiremint-v8";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./favicon.svg",
  "./favicon-32.png",
];

const LIBS = [
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/prop-types@15/prop-types.min.js",
  "https://unpkg.com/recharts@2.12.7/umd/Recharts.js",
  "https://unpkg.com/@babel/standalone@7.24.7/babel.min.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Cache each item on its own so one failure doesn't abort the whole install.
    await Promise.all([...SHELL, ...LIBS].map(async (url) => {
      try { await cache.add(new Request(url, { cache: "reload" })); } catch (err) { /* retried at runtime */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) {
      // Refresh in the background; serve instantly from cache.
      e.waitUntil((async () => {
        try {
          const fresh = await fetch(e.request);
          if (fresh && fresh.ok) (await caches.open(CACHE)).put(e.request, fresh.clone());
        } catch (err) { /* offline, cache stands */ }
      })());
      return cached;
    }
    try {
      const res = await fetch(e.request);
      if (res && res.ok) (await caches.open(CACHE)).put(e.request, res.clone());
      return res;
    } catch (err) {
      const shell = await caches.match("./index.html");
      if (shell) return shell;
      throw err;
    }
  })());
});

// Cache-first app shell, so a dead signal at the field changes nothing.
// Bump CACHE when the shell changes; activate deletes every older cache.

// github.io serves every repo's Pages site from one origin, so only ever
// delete caches this app owns.
const CACHE_PREFIX = "hirdir-";
const CACHE = `${CACHE_PREFIX}v1`;
const SHELL = [
  ".",
  "index.html",
  "app.css",
  "manifest.webmanifest",
  "src/main.js",
  "src/ui.js",
  "src/viewmodel.js",
  "src/selectors.js",
  "src/fold.js",
  "src/log.js",
  "src/clock.js",
  "src/storage.js",
  "src/importer.js",
  "src/exporter.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate: answer from cache so a dead signal at the field
// changes nothing, but fetch in the background so a deploy actually lands —
// cache-first alone would serve the same shell forever under a fixed name.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(event.request);
      const fresh = fetch(event.request)
        .then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => hit); // offline: the cached copy is the answer
      return hit ?? fresh;
    }),
  );
});

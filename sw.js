// Service Worker für „Dein Music Browser“ – macht die Seite installierbar
// und hält die eigenen Dateien als Offline-Kopie vor.
// Strategie: immer zuerst aus dem Netz (damit Updates sofort ankommen),
// nur ohne Verbindung aus dem Zwischenspeicher. Streams und fremde Server
// werden nicht angefasst.
const CACHE = "music-browser-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // cache: "no-cache" = beim Server nachfragen (ETag, meist nur ein kurzes 304),
  // damit neue Versionen sofort ankommen statt erst nach 10 Minuten Browser-Cache.
  event.respondWith(
    fetch(request, { cache: "no-cache" })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }))
  );
});

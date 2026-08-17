// Service worker: houdt de app zelf offline beschikbaar. De weerdata gaat hier
// bewust niet door — die cachet de app zelf in localStorage, met een tijdstip
// erbij, zodat je altijd ziet hoe oud een verwachting is.

const CACHE = 'weer-op-locatie-v1';

const SCHIL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/api.js',
  './js/charts.js',
  './js/config.js',
  './js/format.js',
  './js/history.js',
  './js/models.js',
  './js/stats.js',
  './js/weercodes.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SCHIL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Alleen eigen bestanden; verzoeken naar Open-Meteo laten we ongemoeid.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Voor de pagina zelf eerst het netwerk, zodat een nieuwe versie meteen
  // doorkomt; valt dat weg, dan uit de cache.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request).then((r) => r ?? caches.match('./index.html')))
    );
    return;
  }

  // Overige bestanden: direct uit de cache, en op de achtergrond verversen.
  e.respondWith(
    caches.match(e.request).then((gecacht) => {
      const netwerk = fetch(e.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => gecacht);
      return gecacht ?? netwerk;
    })
  );
});

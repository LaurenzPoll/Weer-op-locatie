// Service worker: houdt de app zelf offline beschikbaar. De weerdata gaat hier
// bewust niet door — die cachet de app zelf in localStorage, met een tijdstip
// erbij, zodat je altijd ziet hoe oud een verwachting is.
//
// Eigen bestanden komen eerst van het netwerk en pas als dat wegvalt uit de
// cache. Zo is een nieuwe versie er na één keer laden helemaal: niet eerst de
// nieuwe pagina met de oude scripts, en niet pas na tien minuten omdat GitHub
// Pages zo lang laat cachen. Het nummer hieronder hoeft daarom niet omhoog bij
// een nieuwe versie, alleen als de opbouw van de cache verandert.

const CACHE = 'weer-op-locatie-v7';

// Zo lang wacht de app op het netwerk als er al een kopie klaarligt.
const GEDULD = 3000;
const TE_LAAT = 'te laat';

// Kreeg de pagina zelf de kopie, dan krijgen de scripts en de opmaak die erbij
// horen tot dit moment ook meteen hun kopie: oud blijft bij oud, en de app
// wacht niet voor elk bestand opnieuw op een traag netwerk.
let kopieTot = 0;

// Alles wat de pagina bij het starten laadt.
const CODE = [
  './',
  './styles.css',
  './js/app.js',
  './js/api.js',
  './js/charts.js',
  './js/config.js',
  './js/format.js',
  './js/history.js',
  './js/iconen.js',
  './js/models.js',
  './js/pixels.js',
  './js/scene.js',
  './js/scene-basis.js',
  './js/scene-hemel.js',
  './js/scene-gebouwen.js',
  './js/scene-figuren.js',
  './js/stats.js',
  './js/uitslag.js',
  './js/weercodes.js',
  './js/zon.js',
  './js/nu.js',
  './js/plek.js',
  './js/uren.js',
  './js/versie.js'
];

// Wat verder offline moet werken, maar geen reden is om opnieuw te laden.
const BIJLAGEN = [
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './fonts/big-shoulders-display-600.woff2',
  './fonts/big-shoulders-display-700.woff2',
  './fonts/big-shoulders-display-800.woff2',
  './fonts/silkscreen-400.woff2',
  './fonts/silkscreen-700.woff2'
];

const THUIS = new URL('./', self.location).href;

// Altijd bij de server navragen (met een ETag is dat een klein verzoek), in
// plaats van op de browsercache te vertrouwen.
const haal = (verzoek) => fetch(verzoek, { cache: 'no-cache' });

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([...CODE, ...BIJLAGEN].map((pad) => new Request(pad, { cache: 'no-cache' }))))
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
  // De versiecontrole van de pagina wil weten wat er nu op de server staat,
  // nooit een kopie: die gaat rechtstreeks naar het netwerk.
  if (e.request.cache === 'no-store') return;
  e.respondWith(netwerkEerst(e));
});

self.addEventListener('message', (e) => {
  // De pagina zag een nieuwe versie op de server: alvast in de cache, zodat
  // opnieuw laden hem ook op een traag netwerk meteen heeft.
  if (e.data === 'ververs') e.waitUntil(ververs().catch(() => {}));
  // Pagina's van vóór de versiecontrole in de pagina zelf vragen nog dit.
  // Wie het vraagt, draait dus een oude versie.
  else if (e.data === 'controleer') e.source?.postMessage('nieuwe-versie');
});

// Een navigatie naar de app (met of zonder ?dag=…) is altijd dezelfde pagina;
// die bewaren we onder één naam. Al het andere onder zijn eigen adres.
function sleutelVoor(verzoek) {
  const url = new URL(verzoek.url);
  if (verzoek.mode === 'navigate' && /\/(index\.html)?$/.test(url.pathname)) return THUIS;
  return url.href;
}

async function netwerkEerst(e) {
  const navigatie = e.request.mode === 'navigate';
  const cache = await caches.open(CACHE);
  const sleutel = sleutelVoor(e.request);
  const kopie = await cache.match(sleutel);
  const netwerk = haal(e.request);
  e.waitUntil(netwerk.then((a) => a.ok && cache.put(sleutel, a.clone())).catch(() => {}));
  if (!kopie) return netwerk;

  // Er ligt een kopie klaar: die nemen we als het netwerk wegvalt, een fout
  // geeft of te lang op zich laat wachten.
  if (navigatie) kopieTot = 0;
  const antwoord =
    navigatie || Date.now() > kopieTot
      ? await Promise.race([netwerk.catch(() => null), new Promise((klaar) => setTimeout(klaar, GEDULD, TE_LAAT))])
      : TE_LAAT;
  if (antwoord && antwoord !== TE_LAAT && (antwoord.ok || antwoord.type === 'opaqueredirect')) return antwoord;
  // Wat het netwerk later nog brengt, komt hierboven in de cache; dat de
  // pagina dan oud is, ziet ze zelf aan haar versie.
  if (navigatie) kopieTot = Date.now() + 10_000;
  return kopie;
}

async function ververs() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    CODE.map(async (pad) => {
      const nieuw = await haal(pad);
      if (nieuw.ok) await cache.put(pad, nieuw);
    })
  );
}

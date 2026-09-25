// Instellingen van de app. Alles wat je normaal zou willen wijzigen staat hier.

// De plek waar de app mee begint. In de app kies je een andere (zie plek.js);
// die keuze onthoudt hij op dit apparaat.
export const STANDAARD_PLEK = {
  naam: 'Heerlen',
  regio: 'Limburg',
  latitude: 50.8882,
  longitude: 5.9795,
  timezone: 'Europe/Amsterdam'
};

export const PLEK_SLEUTEL = 'weer-op-locatie:plek:v1';
export const PLEKKEN_SLEUTEL = 'weer-op-locatie:plekken:v1';

/** Twee plekken zijn dezelfde als ze op een honderd meter na samenvallen. */
export const zelfdePlek = (a, b) =>
  Math.abs(a.latitude - b.latitude) < 0.001 && Math.abs(a.longitude - b.longitude) < 0.001;

export function geldigeTijdzone(tz) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return typeof tz === 'string' && tz ? tz : null;
  } catch {
    return null;
  }
}

export const apparaatTijdzone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam';

export function isPlek(p) {
  return (
    !!p &&
    typeof p.naam === 'string' &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180 &&
    !!geldigeTijdzone(p.timezone)
  );
}

// Een gedeelde link (?plek=…&lat=…&lon=…) opent die plek zonder hem te
// onthouden; anders de plek die je hier het laatst koos.
function beginPlek() {
  if (typeof location !== 'undefined') {
    const q = new URLSearchParams(location.search);
    const gedeeld = {
      naam: q.get('plek') || 'Gedeelde plek',
      regio: q.get('regio') || '',
      latitude: parseFloat(q.get('lat')),
      longitude: parseFloat(q.get('lon')),
      timezone: geldigeTijdzone(q.get('tz')) ?? apparaatTijdzone(),
      gedeeld: true
    };
    if (isPlek(gedeeld)) return gedeeld;
  }
  try {
    const bewaard = JSON.parse(localStorage.getItem(PLEK_SLEUTEL));
    if (isPlek(bewaard)) return bewaard;
  } catch {
    // Geen opslag (of buiten de browser): dan de standaardplek.
  }
  return STANDAARD_PLEK;
}

// De plek waarvoor we de verwachting ophalen. Wisselen doet de app door de
// pagina opnieuw te laden, dus binnen een bezoek verandert deze niet.
export const LOCATION = { ...beginPlek() };

// Het deel van de dag waar het om gaat: tussen deze uren wil je weten of het
// droog blijft. Is het na VENSTER.tot, dan opent de app op morgen. (Het
// uurrooster zelf loopt vanaf nu 24 uur vooruit; zie uren.js.)
export const VENSTER = { van: 11, tot: 20 };

// De app gaat altijd over vandaag of morgen, gerekend in de tijdzone van de
// locatie — niet in die van het apparaat. Bovenaan de pagina wissel je tussen
// de twee; met ?dag=morgen in de URL open je direct op morgen.
export const DAGKEUZES = ['vandaag', 'morgen'];

function opLocatie(nu, opties) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: LOCATION.timezone, ...opties }).format(nu);
}

/** De ISO-datum (JJJJ-MM-DD) die bij 'vandaag' of 'morgen' hoort. */
export function datumVoor(keuze, nu = new Date()) {
  // en-CA schrijft datums als JJJJ-MM-DD, precies wat Open-Meteo teruggeeft.
  const vandaag = opLocatie(nu, { year: 'numeric', month: '2-digit', day: '2-digit' });
  if (keuze !== 'morgen') return vandaag;
  const d = new Date(`${vandaag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Datum en tijd als 'JJJJ-MM-DDTHH:MM' op de klok van de locatie, zoals Open-Meteo ze geeft. */
export function tijdOpLocatie(nu = new Date()) {
  const datum = opLocatie(nu, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const klok = new Intl.DateTimeFormat('en-GB', {
    timeZone: LOCATION.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(nu);
  return `${datum}T${klok}`;
}

/** Het uur (0–23) op dit moment, in de tijdzone van de locatie. */
export function uurNu(nu = new Date()) {
  return Number(opLocatie(nu, { hour: 'numeric', hourCycle: 'h23' }));
}

function beginKeuze() {
  if (typeof location !== 'undefined') {
    const gevraagd = new URLSearchParams(location.search).get('dag');
    if (DAGKEUZES.includes(gevraagd)) return gevraagd;
  }
  // Is het dagvenster van vandaag al voorbij, dan valt er over vandaag niets
  // meer te plannen en beginnen we bij morgen.
  return uurNu() > VENSTER.tot ? 'morgen' : 'vandaag';
}

// De gekozen dag. Andere modules lezen DAG en TARGET_DATE rechtstreeks; wijzig
// ze alleen via kiesDag, dan lopen die twee nooit uit elkaar.
export let DAG = beginKeuze();
export let TARGET_DATE = datumVoor(DAG);

/** De datum van n dagen geleden, net als datumVoor in de tijdzone van de locatie. */
export function dagenTerug(n, nu = new Date()) {
  const d = new Date(`${datumVoor('vandaag', nu)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function kiesDag(keuze) {
  DAG = DAGKEUZES.includes(keuze) ? keuze : 'vandaag';
  TARGET_DATE = datumVoor(DAG);
}

export const API_BASE = 'https://api.open-meteo.com/v1/forecast';

// Hoe lang een ophaal geldig blijft voordat de app opnieuw naar Open-Meteo gaat.
// De modellen worden hoogstens elk uur bijgewerkt, dus vaker dan dit heeft geen zin.
export const CACHE_TTL_MS = 30 * 60 * 1000;

// Hoeveel dagen we in één keer opvragen. De app gaat over vandaag en morgen;
// de derde dag is er zodat morgen ook vlak voor middernacht compleet is, en
// zodat een model dat morgen niet haalt nog steeds zijn echte horizon laat zien.
// Meer dagen kost alleen data: 16 dagen uur-voor-uur is zo'n vijf keer zoveel.
// We vragen bewust een vast aantal dagen op in plaats van een datumbereik:
// modellen die maar 2,5 dag vooruitkijken geven op een datumbereik buiten hun
// horizon een harde fout, terwijl ze op forecast_days simpelweg korter antwoorden.
export const FORECAST_DAYS = 3;

// Zo lang wachten we op één antwoord van Open-Meteo, gerekend vanaf het moment
// dat het verzoek echt vertrekt. Eén traag model mag de pagina niet ophouden.
export const TIJDSLIMIET_MS = 12 * 1000;

// Zoveel modellen tegelijk. Een browser opent maar een handvol verbindingen
// naar dezelfde server; de rest wacht in de rij. Die rij houden we zelf bij,
// zodat de tijdslimiet pas loopt als een verzoek echt vertrekt.
export const GELIJKTIJDIG = 6;

// Wie niet antwoordt of een tijdelijke fout geeft (geen verbinding, druk bij
// Open-Meteo), krijgt nog twee kansen: eerst na anderhalve seconde met twintig
// seconden de tijd, daarna na vier seconden met dertig.
export const HERKANSINGEN = [
  { wacht: 1500, limiet: 20 * 1000 },
  { wacht: 4000, limiet: 30 * 1000 }
];

// Mist er dan nog steeds een model, dan geldt de ophaal maar zo kort als vers:
// de volgende keer openen of terughalen probeert de app het opnieuw.
export const ONVOLLEDIG_TTL_MS = 2 * 60 * 1000;

// localStorage-sleutels. Verhoog het versienummer als de opslagvorm verandert.
// Elke plek heeft zijn eigen cache, trend en "Wie had gelijk?"; de standaardplek
// houdt de sleutels van vóór de plekkeuze, zodat zijn geschiedenis blijft.
const PER_PLEK = zelfdePlek(LOCATION, STANDAARD_PLEK)
  ? ''
  : `:${LOCATION.latitude.toFixed(3)},${LOCATION.longitude.toFixed(3)}`;
export const CACHE_KEY = `weer-op-locatie:cache:v2${PER_PLEK}`;
export const HISTORY_KEY = `weer-op-locatie:historie:v1${PER_PLEK}`;

// Niet vaker dan eens per 3 uur een meetpunt aan de trendgeschiedenis toevoegen,
// zodat driftig op verversen drukken de trendlijn niet volspamt.
export const HISTORY_MIN_GAP_MS = 3 * 60 * 60 * 1000;
export const HISTORY_MAX_ENTRIES = 240;

// "Wie had gelijk?": hoeveel dagen terug de app verwachtingen bewaart om ze naast
// de werkelijkheid te leggen, en waar hij die werkelijkheid bewaart. Het verleden
// verandert niet meer, maar gisteren wordt de eerste uren nog bijgewerkt; daarom
// halen we de terugblik na zes uur opnieuw op.
export const UITSLAG_DAGEN = 7;
export const TERUGBLIK_KEY = `weer-op-locatie:terugblik:v1${PER_PLEK}`;
export const TERUGBLIK_TTL_MS = 6 * 60 * 60 * 1000;

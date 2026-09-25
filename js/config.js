// Instellingen van de app. Alles wat je normaal zou willen wijzigen staat hier.

// De plek waarvoor we de verwachting ophalen.
export const LOCATION = {
  naam: 'Heerlen',
  regio: 'Limburg',
  latitude: 50.8882,
  longitude: 5.9795,
  timezone: 'Europe/Amsterdam'
};

// Het dagvenster waar het om gaat: tussen deze uren wil je weten of het droog
// blijft. Beide grenzen zijn inclusief, dus 11 tot en met 20 uur.
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

// Hoeveel dagen we in één keer opvragen. 16 is het maximum van de API.
// We vragen bewust een vast aantal dagen op in plaats van een datumbereik:
// modellen die maar 2,5 dag vooruitkijken geven op een datumbereik buiten hun
// horizon een harde fout, terwijl ze op forecast_days simpelweg korter antwoorden.
export const FORECAST_DAYS = 16;

// localStorage-sleutels. Verhoog het versienummer als de opslagvorm verandert.
export const CACHE_KEY = 'weer-op-locatie:cache:v2';
export const HISTORY_KEY = 'weer-op-locatie:historie:v1';

// Niet vaker dan eens per 3 uur een meetpunt aan de trendgeschiedenis toevoegen,
// zodat driftig op verversen drukken de trendlijn niet volspamt.
export const HISTORY_MIN_GAP_MS = 3 * 60 * 60 * 1000;
export const HISTORY_MAX_ENTRIES = 240;

// "Wie had gelijk?": hoeveel dagen terug de app verwachtingen bewaart om ze naast
// de werkelijkheid te leggen, en waar hij die werkelijkheid bewaart. Het verleden
// verandert niet meer, maar gisteren wordt de eerste uren nog bijgewerkt; daarom
// halen we de terugblik na zes uur opnieuw op.
export const UITSLAG_DAGEN = 7;
export const TERUGBLIK_KEY = 'weer-op-locatie:terugblik:v1';
export const TERUGBLIK_TTL_MS = 6 * 60 * 60 * 1000;

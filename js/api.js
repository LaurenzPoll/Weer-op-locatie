// Ophalen en normaliseren van de modelverwachtingen bij Open-Meteo.
//
// Bewust één verzoek per model in plaats van één gebundeld verzoek met alle
// modellen erin. Dat kost een paar HTTP-verzoeken meer, maar levert twee dingen:
// een model dat een variabele niet ondersteunt kan de hele pagina niet meer
// slopen, en de antwoordvelden heten gewoon `temperature_2m_max` in plaats van
// `temperature_2m_max_ecmwf_ifs025`.

import {
  API_BASE,
  CACHE_KEY,
  CACHE_TTL_MS,
  DAGKEUZES,
  FORECAST_DAYS,
  LOCATION,
  TARGET_DATE,
  datumVoor
} from './config.js';
import { MODELLEN } from './models.js';

const DAG_VARIABELEN = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_hours',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
  'cloud_cover_mean',
  'sunshine_duration'
];

const UUR_VARIABELEN = [
  'temperature_2m',
  'precipitation',
  'wind_speed_10m',
  'cloud_cover',
  'sunshine_duration',
  'weather_code'
];

// Terugvalset voor modellen die één van de bovenstaande variabelen niet kennen:
// alleen wat elk model in huis heeft. Zonder deze terugval zou zo'n model als
// "fout" op de kaart komen terwijl er wel bruikbare data is.
const DAG_KERN = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'wind_speed_10m_max'
];
const UUR_KERN = ['temperature_2m', 'precipitation'];

export function bouwUrl(modelId, { kern = false } = {}) {
  const p = new URLSearchParams({
    latitude: String(LOCATION.latitude),
    longitude: String(LOCATION.longitude),
    timezone: LOCATION.timezone,
    forecast_days: String(FORECAST_DAYS),
    daily: (kern ? DAG_KERN : DAG_VARIABELEN).join(','),
    hourly: (kern ? UUR_KERN : UUR_VARIABELEN).join(','),
    models: modelId,
    wind_speed_unit: 'kmh'
  });
  return `${API_BASE}?${p.toString()}`;
}

// --- mockmodus ------------------------------------------------------------
// Met ?mock=1 in de URL leest de app dev/fixture.json in plaats van de echte
// API. Zo is de weergave — inclusief alle foutsituaties — te controleren zonder
// netwerk, en kunnen we de opmaak nakijken in een omgeving zonder internet.
// De guard op `location` houdt dit bestand importeerbaar buiten de browser,
// zodat scripts/check-models.mjs dezelfde URL-opbouw kan gebruiken.
const mockAan = typeof location !== 'undefined' && new URLSearchParams(location.search).has('mock');
let mockData = null;

// De fixture is gemaakt rond één vaste doeldag. We schuiven zijn tijdas zo op
// dat die doeldag op vandaag valt; dan heeft de mockmodus altijd iets te tonen.
function verschuifDatum(iso, dagen) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10) + iso.slice(10);
}

async function haalMock(modelId) {
  if (!mockData) {
    const res = await fetch('./dev/fixture.json');
    if (!res.ok) throw new Error(`fixture.json niet gevonden (HTTP ${res.status})`);
    mockData = await res.json();
  }
  const entry = mockData[modelId];
  if (!entry) throw new Error('geen mockdata voor dit model');
  if (entry.__fout) throw new Error(entry.__fout);
  const verschil = Math.round(
    (new Date(`${datumVoor('vandaag')}T12:00:00Z`) - new Date(`${mockData.__doel}T12:00:00Z`)) / 86400000
  );
  const schuif = (tijden) => (tijden ?? []).map((t) => verschuifDatum(t, verschil));
  return {
    ...entry,
    daily: { ...entry.daily, time: schuif(entry.daily?.time) },
    hourly: { ...entry.hourly, time: schuif(entry.hourly?.time) }
  };
}

async function haalOp(url) {
  const res = await fetch(url);
  let json = null;
  try {
    json = await res.json();
  } catch {
    throw new Error(`onleesbaar antwoord (HTTP ${res.status})`);
  }
  if (json && json.error) throw new Error(json.reason || 'onbekende API-fout');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return json;
}

async function haalModel(modelId) {
  if (mockAan) return haalMock(modelId);
  try {
    return await haalOp(bouwUrl(modelId));
  } catch (fout) {
    // Tweede kans met alleen de kernvariabelen: waarschijnlijk kent dit model
    // één van de extra variabelen niet.
    try {
      return await haalOp(bouwUrl(modelId, { kern: true }));
    } catch {
      throw fout;
    }
  }
}

function getal(reeks, i) {
  if (!reeks || reeks[i] === undefined || reeks[i] === null) return null;
  return reeks[i];
}

export function normaliseer(modelId, ruw, datum = TARGET_DATE) {
  const dagen = ruw?.daily?.time ?? [];
  const i = dagen.indexOf(datum);
  const d = ruw?.daily ?? {};

  // Open-Meteo geeft áltijd het volledige aantal opgevraagde dagen terug en vult
  // aan met null voorbij de horizon van het model. De lengte van de tijdas zegt
  // dus niets; we moeten kijken tot welke dag er echt waarden staan.
  const heeftWaarde = (j) =>
    (d.temperature_2m_max?.[j] ?? null) !== null || (d.precipitation_sum?.[j] ?? null) !== null;

  let dagenMetData = 0;
  let laatsteDagMetData = null;
  for (let j = 0; j < dagen.length; j++) {
    if (heeftWaarde(j)) {
      dagenMetData++;
      laatsteDagMetData = dagen[j];
    }
  }

  const bereik = { horizonDagen: dagenMetData, laatsteDag: laatsteDagMetData };

  // Geen enkele dag met waarden: dit model levert hier niets.
  if (!dagenMetData) {
    return { id: modelId, status: 'geen_dekking', ...bereik };
  }

  // De dag zit niet op de as, of hij zit er wel maar zonder waarden: in beide
  // gevallen reikt dit model nog niet tot de doeldag.
  if (i === -1 || !heeftWaarde(i)) {
    return { id: modelId, status: 'buiten_bereik', ...bereik };
  }

  const dag = {
    code: getal(d.weather_code, i),
    tempMax: getal(d.temperature_2m_max, i),
    tempMin: getal(d.temperature_2m_min, i),
    neerslag: getal(d.precipitation_sum, i),
    neerslagUren: getal(d.precipitation_hours, i),
    neerslagKans: getal(d.precipitation_probability_max, i),
    wind: getal(d.wind_speed_10m_max, i),
    windstoten: getal(d.wind_gusts_10m_max, i),
    windrichting: getal(d.wind_direction_10m_dominant, i),
    bewolking: getal(d.cloud_cover_mean, i),
    zonuren: getal(d.sunshine_duration, i) === null ? null : getal(d.sunshine_duration, i) / 3600
  };

  const uren = [];
  const uurTijden = ruw?.hourly?.time ?? [];
  for (let u = 0; u < uurTijden.length; u++) {
    if (!uurTijden[u].startsWith(datum)) continue;
    uren.push({
      tijd: uurTijden[u],
      uur: Number(uurTijden[u].slice(11, 13)),
      temp: getal(ruw.hourly.temperature_2m, u),
      neerslag: getal(ruw.hourly.precipitation, u),
      wind: getal(ruw.hourly.wind_speed_10m, u),
      bewolking: getal(ruw.hourly.cloud_cover, u),
      // Zonneschijn komt in seconden per uur; minuten leest prettiger.
      zon: getal(ruw.hourly.sunshine_duration, u) === null ? null : getal(ruw.hourly.sunshine_duration, u) / 60,
      code: getal(ruw.hourly.weather_code, u)
    });
  }

  return { id: modelId, status: 'ok', ...bereik, dag, uren };
}

// --- cache ----------------------------------------------------------------
// Eén ophaal levert alle 16 dagen, dus we verwerken hem meteen voor vandaag én
// morgen en bewaren beide. Wisselen tussen de dagen kost dan geen nieuw verzoek.

function leesCache() {
  try {
    const ruw = localStorage.getItem(CACHE_KEY);
    if (!ruw) return null;
    const cache = JSON.parse(ruw);
    if (!cache.perDag?.[TARGET_DATE]) return null;
    if (cache.locatie !== `${LOCATION.latitude},${LOCATION.longitude}`) return null;
    return cache;
  } catch {
    return null;
  }
}

function schrijfCache(perDag, opgehaaldOp) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        locatie: `${LOCATION.latitude},${LOCATION.longitude}`,
        opgehaaldOp,
        perDag
      })
    );
  } catch {
    // Opslag vol of geblokkeerd: dan werkt de app gewoon zonder cache verder.
  }
}

export function cacheIsVers(cache) {
  return !!cache && Date.now() - new Date(cache.opgehaaldOp).getTime() < CACHE_TTL_MS;
}

/**
 * Haalt alle modellen op (parallel) en levert per dag (vandaag en morgen) een
 * lijst genormaliseerde resultaten, in de volgorde van de catalogus.
 */
export async function haalAlles() {
  const uitkomsten = await Promise.allSettled(MODELLEN.map((m) => haalModel(m.id)));

  const verwerk = (datum) =>
    uitkomsten.map((uitkomst, idx) => {
      const id = MODELLEN[idx].id;
      if (uitkomst.status === 'fulfilled') {
        try {
          return normaliseer(id, uitkomst.value, datum);
        } catch (fout) {
          return { id, status: 'fout', melding: `antwoord onverwerkbaar: ${fout.message}` };
        }
      }
      return { id, status: 'fout', melding: uitkomst.reason?.message ?? 'ophalen mislukt' };
    });

  // De gekozen dag hoort er altijd bij, ook als middernacht net gepasseerd is.
  const datums = new Set([...DAGKEUZES.map((k) => datumVoor(k)), TARGET_DATE]);
  const perDag = Object.fromEntries([...datums].map((d) => [d, verwerk(d)]));

  const opgehaaldOp = new Date().toISOString();
  schrijfCache(perDag, opgehaaldOp);
  return { resultaten: perDag[TARGET_DATE], perDag, opgehaaldOp, uitCache: false };
}

/**
 * Levert de verwachtingen, uit de cache als die nog vers is.
 */
export async function laadVerwachtingen({ forceer = false } = {}) {
  const cache = leesCache();
  if (!forceer && cacheIsVers(cache)) {
    return { resultaten: cache.perDag[TARGET_DATE], opgehaaldOp: cache.opgehaaldOp, uitCache: true };
  }
  try {
    return await haalAlles();
  } catch (fout) {
    // Netwerk helemaal onbereikbaar: liever oude data met een eerlijk label dan
    // een lege pagina.
    if (cache) {
      return { resultaten: cache.perDag[TARGET_DATE], opgehaaldOp: cache.opgehaaldOp, uitCache: true, offline: true };
    }
    throw fout;
  }
}

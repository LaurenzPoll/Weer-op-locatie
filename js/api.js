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
  TERUGBLIK_KEY,
  TERUGBLIK_TTL_MS,
  TIJDSLIMIET_MS,
  UITSLAG_DAGEN,
  dagenTerug,
  datumVoor,
  tijdOpLocatie
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

export function bouwUrl(modelId, { kern = false, dagen = FORECAST_DAYS } = {}) {
  const p = new URLSearchParams({
    latitude: String(LOCATION.latitude),
    longitude: String(LOCATION.longitude),
    timezone: LOCATION.timezone,
    forecast_days: String(dagen),
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
let fixtureBelofte = null;

// Eén keer ophalen voor alle modellen samen, in plaats van één keer per model.
function laadFixture() {
  fixtureBelofte ??= fetch('./dev/fixture.json').then((res) => {
    if (!res.ok) throw new Error(`fixture.json niet gevonden (HTTP ${res.status})`);
    return res.json();
  });
  return fixtureBelofte;
}

// De fixture is gemaakt rond één vaste doeldag. We schuiven zijn tijdas zo op
// dat die doeldag op vandaag valt; dan heeft de mockmodus altijd iets te tonen.
function verschuifDatum(iso, dagen) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10) + iso.slice(10);
}

function mockVerschil(fixture) {
  return Math.round((new Date(`${datumVoor('vandaag')}T12:00:00Z`) - new Date(`${fixture.__doel}T12:00:00Z`)) / 86400000);
}

async function haalMock(modelId) {
  const mockData = await laadFixture();
  const entry = mockData[modelId];
  if (!entry) throw new Error('geen mockdata voor dit model');
  if (entry.__fout) throw new Error(entry.__fout);
  const verschil = mockVerschil(mockData);
  const schuif = (tijden) => (tijden ?? []).map((t) => verschuifDatum(t, verschil));
  return {
    ...entry,
    daily: { ...entry.daily, time: schuif(entry.daily?.time) },
    hourly: { ...entry.hourly, time: schuif(entry.hourly?.time) }
  };
}

// Een fetch die na TIJDSLIMIET_MS opgeeft, met een melding die je begrijpt.
async function haalMetLimiet(url) {
  const stop = new AbortController();
  const klok = setTimeout(() => stop.abort(), TIJDSLIMIET_MS);
  try {
    return await fetch(url, { signal: stop.signal });
  } catch (fout) {
    if (stop.signal.aborted) {
      const traag = new Error(`geen antwoord binnen ${TIJDSLIMIET_MS / 1000} seconden`);
      traag.traag = true;
      throw traag;
    }
    throw fout;
  } finally {
    clearTimeout(klok);
  }
}

async function haalOp(url) {
  const res = await haalMetLimiet(url);
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
    // Te traag: niet nog eens tien seconden wachten op een tweede poging.
    if (fout.traag) throw fout;
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
 * Wat er van de vorige keer op dit apparaat staat, hoe oud ook: dat toont de
 * app meteen, terwijl hij op de achtergrond nieuwe gegevens ophaalt.
 */
export function oudeVerwachtingen() {
  const cache = leesCache();
  return cache ? { resultaten: cache.perDag[TARGET_DATE], opgehaaldOp: cache.opgehaaldOp } : null;
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

// --- regen in het komende uur ----------------------------------------------
// Eén klein verzoek met neerslag per kwartier (Best Match). Dat verandert snel,
// dus geen cache: de app vraagt het opnieuw als het ouder is dan een kwartier.

export function bouwRegenNuUrl(plek = LOCATION) {
  const p = new URLSearchParams({
    latitude: String(plek.latitude),
    longitude: String(plek.longitude),
    timezone: plek.timezone,
    minutely_15: 'precipitation',
    forecast_minutely_15: '12'
  });
  return `${API_BASE}?${p.toString()}`;
}

export async function laadRegenNu() {
  if (mockAan) return mockRegenNu();
  const ruw = await haalOp(bouwRegenNuUrl());
  const m = ruw?.minutely_15 ?? {};
  return (m.time ?? []).map((tijd, i) => ({ tijd, mm: getal(m.precipitation, i) }));
}

// In de mockmodus: nog drie kwartier droog, dan een half uur regen.
function mockRegenNu() {
  const nu = Date.parse(`${tijdOpLocatie()}:00Z`);
  const eerste = Math.floor(nu / 900000) * 900000;
  const mm = [0, 0, 0, 0, 0.2, 0.5, 0.3, 0, 0, 0, 0, 0, 0];
  return mm.map((w, i) => ({ tijd: new Date(eerste + i * 900000).toISOString().slice(0, 16), mm: w }));
}

// --- plekken naast elkaar -----------------------------------------------------
// Voor de lijst met bewaarde plekken: per plek alleen Best Match, drie dagen,
// een paar getallen. Zo blijft een overzicht van acht plekken licht.

export function bouwPlekWeerUrl(plek) {
  const p = new URLSearchParams({
    latitude: String(plek.latitude),
    longitude: String(plek.longitude),
    timezone: plek.timezone,
    forecast_days: '3',
    daily: 'weather_code,temperature_2m_max,precipitation_sum'
  });
  return `${API_BASE}?${p.toString()}`;
}

/** { 'JJJJ-MM-DD': { code, t, n } } voor een plek, in de tijdzone van die plek. */
export async function laadPlekWeer(plek) {
  if (mockAan) return mockPlekWeer(plek);
  const d = (await haalOp(bouwPlekWeerUrl(plek)))?.daily ?? {};
  return Object.fromEntries(
    (d.time ?? []).map((datum, i) => [
      datum,
      { code: getal(d.weather_code, i), t: getal(d.temperature_2m_max, i), n: getal(d.precipitation_sum, i) }
    ])
  );
}

// In de mockmodus: vaste, per plek verschillende waarden.
function mockPlekWeer(plek) {
  const h = [...plek.naam].reduce((som, c) => som + c.charCodeAt(0), 0);
  return Object.fromEntries(
    [0, 1, 2].map((dag) => {
      const datum = new Date(Date.parse(`${datumVoor('vandaag')}T12:00:00Z`) + dag * 86400000);
      const nat = (h + dag) % 3 === 0;
      return [datum.toISOString().slice(0, 10), { code: nat ? 61 : 2, t: 17 + ((h + dag * 3) % 8), n: nat ? 2.4 : 0 }];
    })
  );
}

// --- terugblik ------------------------------------------------------------
// Voor "Wie had gelijk?": wat Open-Meteo achteraf over de afgelopen dagen zegt.
// Dat is zelf ook een analyse uit de modellen, geen meting van een regenmeter;
// de app zegt dat er eerlijk bij.

const locatieSleutel = () => `${LOCATION.latitude},${LOCATION.longitude}`;

/** Van een Open-Meteo-antwoord naar { datum: { t, n } }, alleen voor dagen die voorbij zijn. */
function naarDagen(ruw, verschil = 0) {
  const d = ruw?.daily ?? {};
  const vandaag = datumVoor('vandaag');
  const dagen = {};
  (d.time ?? []).forEach((tijd, i) => {
    const datum = verschil ? verschuifDatum(tijd, verschil) : tijd;
    const t = getal(d.temperature_2m_max, i);
    const n = getal(d.precipitation_sum, i);
    if (datum < vandaag && t !== null && n !== null) dagen[datum] = { t, n };
  });
  return dagen;
}

export function bouwTerugblikUrl() {
  const p = new URLSearchParams({
    latitude: String(LOCATION.latitude),
    longitude: String(LOCATION.longitude),
    timezone: LOCATION.timezone,
    past_days: String(UITSLAG_DAGEN),
    forecast_days: '1',
    daily: 'temperature_2m_max,precipitation_sum',
    models: 'best_match'
  });
  return `${API_BASE}?${p.toString()}`;
}

function leesTerugblik() {
  try {
    const cache = JSON.parse(localStorage.getItem(TERUGBLIK_KEY));
    return cache && cache.locatie === locatieSleutel() ? cache : null;
  } catch {
    return null;
  }
}

/**
 * De werkelijke middagtemperatuur en neerslag van de afgelopen dagen, uit de
 * cache zolang die vers is en gisteren al bevat.
 */
export async function laadTerugblik() {
  if (mockAan) {
    const fixture = await laadFixture();
    return naarDagen(fixture.__terugblik, mockVerschil(fixture));
  }
  const cache = leesTerugblik();
  const vers = cache && Date.now() - new Date(cache.opgehaaldOp).getTime() < TERUGBLIK_TTL_MS;
  if (vers && cache.dagen[dagenTerug(1)]) return cache.dagen;

  try {
    const dagen = naarDagen(await haalOp(bouwTerugblikUrl()));
    try {
      localStorage.setItem(
        TERUGBLIK_KEY,
        JSON.stringify({ locatie: locatieSleutel(), opgehaaldOp: new Date().toISOString(), dagen })
      );
    } catch {
      // Zonder opslag halen we hem de volgende keer gewoon opnieuw op.
    }
    return dagen;
  } catch (fout) {
    if (cache) return cache.dagen;
    throw fout;
  }
}

/**
 * In de mockmodus komen ook de verwachtingen van de afgelopen week uit de
 * fixture, zodat "Wie had gelijk?" meteen iets te tonen heeft. Ze worden nooit
 * in de echte historie geschreven. Buiten de mockmodus: null.
 */
export async function laadMockHistorie() {
  if (!mockAan) return null;
  const fixture = await laadFixture();
  const verschil = mockVerschil(fixture);
  return (fixture.__historie ?? []).map((e) => ({
    ...e,
    datum: verschuifDatum(e.datum, verschil),
    ts: new Date(new Date(e.ts).getTime() + verschil * 86400000).toISOString()
  }));
}

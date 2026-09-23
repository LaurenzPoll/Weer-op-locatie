// Genereert dev/fixture.json: nagemaakte Open-Meteo-antwoorden waarmee de
// weergave te controleren is zonder netwerk. Bewust met alle vier de statussen
// erin, zodat ook de foutpaden zichtbaar zijn.
//
//   node dev/maak-fixture.mjs
//
// Dit bestand is alleen voor ontwikkeling; de app gebruikt het uitsluitend met
// ?mock=1 in de URL.

import { writeFileSync } from 'node:fs';
import { MODELLEN } from '../js/models.js';

// De app schuift de tijdas in de mockmodus zo op dat deze dag op vandaag valt,
// en de dag erna dus op morgen. De tijdas begint ook op deze dag, net als bij de
// echte API: die levert vanaf vandaag.
const DOEL = '2026-08-28';

function datums(n) {
  const uit = [];
  const d = new Date(`${DOEL}T12:00:00Z`);
  for (let i = 0; i < n; i++) {
    uit.push(new Date(d.getTime() + i * 86400000).toISOString().slice(0, 10));
  }
  return uit;
}

// Vaste pseudo-random per model, zodat de fixture stabiel blijft tussen runs.
function zaad(tekst) {
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Per model: hoeveel dagen het antwoord beslaat, en of het bruikbaar is. Zoals
// in het echt halen bijna alle modellen vandaag en morgen; de andere statussen
// komen van de modellen die hier ook werkelijk niets of te weinig leveren.
const BIJZONDER = {
  ecmwf_ifs: { dagen: 10 },
  ncep_aigfs025: { geenZon: true }, // levert geen uurlijkse zonneschijn
  dwd_icon_global: { dagen: 8 },
  ukmo_global_deterministic_10km: { dagen: 7 },
  dwd_icon_eu: { dagen: 5 },
  dwd_icon_d2: { dagen: 2 },
  knmi_harmonie_arome_netherlands: { dagen: 3 },
  knmi_harmonie_arome_europe: { dagen: 3 },
  dmi_harmonie_arome_europe: { dagen: 3 },
  meteofrance_arpege_europe: { dagen: 4 },
  meteofrance_arome_france_hd: { dagen: 1 }, // haalt morgen nog niet
  chmi_aladin_central_europe_2km: { dagen: 3 },
  kma_gdps: { leeg: true }, // geen dekking op deze plek
  bom_access_global: { fout: 'Cannot initialize WeatherVariableDaily from invalid String value' }
};

// Een deel van de modellen houdt de dag droog. De rest zet een bui ergens in de
// middag, elk op een eigen uur: precies de vraag die het uurrooster moet
// beantwoorden. Regionale modellen rekenen buien echt uit, dus bij hen is een
// bui korter en feller; globale modellen smeren hem uit.
function kiesBui(rnd, regionaal) {
  if (rnd() < 0.4) return null;
  return {
    midden: 15 + (rnd() - 0.5) * 5,
    duur: regionaal ? 1 + rnd() * 2 : 2 + rnd() * 3,
    piek: regionaal ? 1.5 + rnd() * 7 : 0.4 + rnd() * 2.4
  };
}

function regenOp(bui, uur) {
  if (!bui) return 0;
  const afstand = Math.abs(uur + 0.5 - bui.midden) / (bui.duur / 2 + 0.5);
  return afstand >= 1 ? 0 : Number((bui.piek * (1 - afstand)).toFixed(1));
}

const som = (lijst) => lijst.reduce((a, b) => a + b, 0);

const fixture = { __doel: DOEL };

for (const m of MODELLEN) {
  const bijz = BIJZONDER[m.id] ?? {};
  if (bijz.fout) {
    fixture[m.id] = { __fout: bijz.fout };
    continue;
  }

  const rnd = zaad(m.id);
  // Net als de echte API: altijd 16 dagen op de tijdas, opgevuld met null
  // voorbij de horizon van het model.
  const dagen = datums(16);
  const dagenMetData = bijz.leeg ? 0 : (bijz.dagen ?? 16);
  const regionaal = m.groep === 'regionaal';
  const basisTemp = 22 + (rnd() - 0.5) * 5;

  // Uurwaarden alleen voor vandaag en morgen: dat is het enige wat de app
  // uitleest en het houdt de fixture klein. De dagwaarden van die twee dagen
  // worden eruit opgeteld, zodat dag en uur met elkaar kloppen.
  const hourly = {
    time: [],
    temperature_2m: [],
    precipitation: [],
    wind_speed_10m: [],
    cloud_cover: [],
    sunshine_duration: [],
    weather_code: []
  };
  const perDag = [];
  for (let i = 0; i < Math.min(2, dagenMetData); i++) {
    const bui = kiesBui(rnd, regionaal);
    const dagTemp = basisTemp + (i ? (rnd() - 0.5) * 3 : 0);
    const wolkBasis = 30 + rnd() * 45;
    const dag = { temps: [], regen: [], wolken: [], zon: 0 };
    for (let u = 0; u < 24; u++) {
      // Warmste moment rond drie uur 's middags, koudste rond drie uur 's nachts.
      const dagbocht = Math.sin(((u - 9) / 24) * Math.PI * 2);
      const regen = regenOp(bui, u);
      const temp = Number((dagTemp - 4 + dagbocht * 5 - (regen ? 1.5 : 0)).toFixed(1));
      const bewolking = Math.round(Math.min(100, Math.max(0, wolkBasis + (rnd() - 0.5) * 40 + (regen ? 45 : 0))));
      // Zonneschijn in seconden per uur; 's nachts en in een bui nul, en één
      // model levert de variabele niet zodat het rooster ook die situatie toont.
      const zon = u >= 6 && u <= 20 && !regen ? Math.round(((100 - bewolking) / 100) * 3600) : 0;
      hourly.time.push(`${dagen[i]}T${String(u).padStart(2, '0')}:00`);
      hourly.temperature_2m.push(temp);
      hourly.precipitation.push(regen);
      hourly.wind_speed_10m.push(Number((10 + rnd() * 14).toFixed(1)));
      hourly.cloud_cover.push(bewolking);
      hourly.sunshine_duration.push(bijz.geenZon ? null : zon);
      hourly.weather_code.push(regen >= 2 ? 81 : regen > 0 ? 80 : bewolking > 70 ? 3 : bewolking > 30 ? 2 : 1);
      dag.temps.push(temp);
      dag.regen.push(regen);
      dag.wolken.push(bewolking);
      dag.zon += zon;
    }
    perDag.push(dag);
  }

  const daily = {
    time: dagen,
    weather_code: [],
    temperature_2m_max: [],
    temperature_2m_min: [],
    precipitation_sum: [],
    precipitation_hours: [],
    precipitation_probability_max: [],
    wind_speed_10m_max: [],
    wind_gusts_10m_max: [],
    wind_direction_10m_dominant: [],
    cloud_cover_mean: [],
    sunshine_duration: []
  };

  dagen.forEach((_, i) => {
    const leeg = i >= dagenMetData;
    const uur = perDag[i];
    const t = uur ? Math.max(...uur.temps) : basisTemp + Math.sin(i / 2.6) * 2.4;
    const tMin = uur ? Math.min(...uur.temps) : t - 8 - rnd() * 2;
    const n = uur ? som(uur.regen) : rnd() * 4;
    const wolk = uur ? som(uur.wolken) / 24 : 25 + rnd() * 65;
    const push = (sleutel, waarde) => daily[sleutel].push(leeg ? null : waarde);
    push(
      'weather_code',
      n > 6 ? 82 : n > 1.5 ? (regionaal ? 81 : 61) : n > 0.3 ? 80 : wolk < 45 ? 1 : wolk < 70 ? 2 : 3
    );
    push('temperature_2m_max', Number(t.toFixed(1)));
    push('temperature_2m_min', Number(tMin.toFixed(1)));
    push('precipitation_sum', Number(n.toFixed(1)));
    push('precipitation_hours', uur ? uur.regen.filter((v) => v >= 0.1).length : Math.round(n > 0.2 ? 1 + rnd() * 5 : 0));
    push('precipitation_probability_max', Math.round(Math.min(95, n * 12 + rnd() * 25)));
    push('wind_speed_10m_max', Number((14 + rnd() * 16).toFixed(1)));
    push('wind_gusts_10m_max', Number((26 + rnd() * 22).toFixed(1)));
    push('wind_direction_10m_dominant', Math.round(rnd() * 359));
    push('cloud_cover_mean', Math.round(wolk));
    push('sunshine_duration', uur ? uur.zon : Math.round((3 + rnd() * 8) * 3600));
  });

  fixture[m.id] = {
    latitude: 50.89,
    longitude: 5.98,
    timezone: 'Europe/Amsterdam',
    daily_units: { temperature_2m_max: '°C', precipitation_sum: 'mm', wind_speed_10m_max: 'km/h' },
    daily,
    hourly
  };
}

const pad = new URL('./fixture.json', import.meta.url);
writeFileSync(pad, JSON.stringify(fixture));
console.log(`fixture.json geschreven: ${Object.keys(fixture).length - 1} modellen`);

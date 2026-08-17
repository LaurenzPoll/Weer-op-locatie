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

const START = '2026-08-17';
const DOEL = '2026-08-28';

function datums(n) {
  const uit = [];
  const d = new Date(`${START}T12:00:00Z`);
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

// Per model: hoeveel dagen het antwoord beslaat, en of het bruikbaar is.
const BIJZONDER = {
  ecmwf_ifs: { dagen: 10 }, // haalt de doeldag net niet
  dwd_icon_global: { dagen: 8 },
  ukmo_global_deterministic_10km: { dagen: 7 },
  dwd_icon_eu: { dagen: 6 },
  dwd_icon_d2: { dagen: 3 },
  knmi_harmonie_arome_netherlands: { dagen: 3 },
  knmi_harmonie_arome_europe: { dagen: 3 },
  dmi_harmonie_arome_europe: { dagen: 3 },
  meteofrance_arpege_europe: { dagen: 5 },
  meteofrance_arome_france_hd: { dagen: 3 },
  chmi_aladin_central_europe_2km: { leeg: true }, // reikt ver genoeg, maar geen dekking
  bom_access_global: { fout: 'Cannot initialize WeatherVariableDaily from invalid String value' }
};

const fixture = {};

for (const m of MODELLEN) {
  const bijz = BIJZONDER[m.id] ?? {};
  if (bijz.fout) {
    fixture[m.id] = { __fout: bijz.fout };
    continue;
  }

  const rnd = zaad(m.id);
  const dagen = datums(bijz.dagen ?? 16);
  const doelIndex = dagen.indexOf(DOEL);

  const basisTemp = 23.5 + (rnd() - 0.5) * 7;
  const basisNeerslag = rnd() < 0.45 ? rnd() * 11 : rnd() * 0.6;

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
    const leeg = bijz.leeg === true;
    const t = basisTemp + Math.sin(i / 2.6) * 2.4;
    const n = i === doelIndex ? basisNeerslag : rnd() * 4;
    const push = (sleutel, waarde) => daily[sleutel].push(leeg ? null : waarde);
    push('weather_code', n > 6 ? 82 : n > 1.5 ? 61 : n > 0.3 ? 80 : rnd() > 0.5 ? 1 : 3);
    push('temperature_2m_max', Number(t.toFixed(1)));
    push('temperature_2m_min', Number((t - 8 - rnd() * 2).toFixed(1)));
    push('precipitation_sum', Number(n.toFixed(1)));
    push('precipitation_hours', Math.round(n > 0.2 ? 1 + rnd() * 5 : 0));
    push('precipitation_probability_max', Math.round(Math.min(95, n * 12 + rnd() * 25)));
    push('wind_speed_10m_max', Number((14 + rnd() * 16).toFixed(1)));
    push('wind_gusts_10m_max', Number((26 + rnd() * 22).toFixed(1)));
    push('wind_direction_10m_dominant', Math.round(rnd() * 359));
    push('cloud_cover_mean', Math.round(25 + rnd() * 65));
    push('sunshine_duration', Math.round((3 + rnd() * 8) * 3600));
  });

  // Uurwaarden alleen voor de doeldag: dat is het enige wat de app uitleest en
  // het houdt de fixture klein.
  const hourly = { time: [], temperature_2m: [], precipitation: [], wind_speed_10m: [], cloud_cover: [], weather_code: [] };
  if (doelIndex !== -1 && !bijz.leeg) {
    for (let u = 0; u < 24; u++) {
      const dagbocht = Math.sin(((u - 4) / 24) * Math.PI * 2);
      hourly.time.push(`${DOEL}T${String(u).padStart(2, '0')}:00`);
      hourly.temperature_2m.push(Number((basisTemp - 4 + dagbocht * 5).toFixed(1)));
      hourly.precipitation.push(u > 12 && u < 19 && basisNeerslag > 1 ? Number((basisNeerslag / 5).toFixed(1)) : 0);
      hourly.wind_speed_10m.push(Number((10 + rnd() * 14).toFixed(1)));
      hourly.cloud_cover.push(Math.round(20 + rnd() * 75));
      hourly.weather_code.push(basisNeerslag > 6 && u > 13 && u < 18 ? 82 : 2);
    }
  }

  fixture[m.id] = {
    latitude: 50.89,
    longitude: 5.75,
    timezone: 'Europe/Amsterdam',
    daily_units: { temperature_2m_max: '°C', precipitation_sum: 'mm', wind_speed_10m_max: 'km/h' },
    daily,
    hourly
  };
}

const pad = new URL('./fixture.json', import.meta.url);
writeFileSync(pad, JSON.stringify(fixture));
console.log(`fixture.json geschreven: ${Object.keys(fixture).length} modellen`);

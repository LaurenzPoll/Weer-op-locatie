// Een andere plek kiezen: zoeken via de geocoding van Open-Meteo (geen account,
// geen sleutel), je eigen locatie, of een plek die je eerder koos. De keuze
// blijft op dit apparaat. Bij wisselen laadt de pagina opnieuw, zodat alles —
// de cache, de trend en "Wie had gelijk?" — bij die ene plek hoort.

import {
  CACHE_TTL_MS,
  DAG,
  LOCATION,
  PLEK_SLEUTEL,
  PLEKKEN_SLEUTEL,
  STANDAARD_PLEK,
  apparaatTijdzone,
  isPlek,
  zelfdePlek
} from './config.js';
import { laadPlekWeer } from './api.js';
import { icoon, icoonVoorCode } from './iconen.js';

const GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search';
const MAX_BEWAARD = 8;
const mockAan = typeof location !== 'undefined' && new URLSearchParams(location.search).has('mock');

const el = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ------------------------------------------------------------------ opslag

export function bewaardePlekken() {
  try {
    const lijst = JSON.parse(localStorage.getItem(PLEKKEN_SLEUTEL));
    if (Array.isArray(lijst) && lijst.some(isPlek)) return lijst.filter(isPlek);
  } catch {
    // Niets bewaard of geen opslag: dan alleen de standaardplek.
  }
  return [STANDAARD_PLEK];
}

function schrijf(sleutel, waarde) {
  try {
    localStorage.setItem(sleutel, JSON.stringify(waarde));
    return true;
  } catch {
    return false;
  }
}

/** Maakt van een plek de huidige, zet hem bovenaan de bewaarde en laadt opnieuw. */
export function kiesPlek(gekozen, { bewaar = true } = {}) {
  const { gedeeld, ...plek } = gekozen;
  if (bewaar) {
    const lijst = [plek, ...bewaardePlekken().filter((p) => !zelfdePlek(p, plek))];
    schrijf(PLEKKEN_SLEUTEL, lijst.slice(0, MAX_BEWAARD));
  }
  schrijf(PLEK_SLEUTEL, plek);
  // Zonder de gedeelde plek in de URL, anders wint die bij het laden.
  const url = new URL(location.href);
  for (const k of ['plek', 'regio', 'lat', 'lon', 'tz']) url.searchParams.delete(k);
  location.replace(url.href);
}

function vergeetPlek(plek) {
  const lijst = bewaardePlekken().filter((p) => !zelfdePlek(p, plek));
  schrijf(PLEKKEN_SLEUTEL, lijst.length ? lijst : [STANDAARD_PLEK]);
}

/** De URL-parameters waarmee een gedeelde link deze plek opent. */
export function plekParameters(plek = LOCATION) {
  return {
    plek: plek.naam,
    regio: plek.regio ?? '',
    lat: plek.latitude.toFixed(4),
    lon: plek.longitude.toFixed(4),
    tz: plek.timezone
  };
}

// ------------------------------------------------------------------ zoeken

// In de mockmodus zoeken we in een vaste lijst, zodat de keuze zonder netwerk
// te bekijken is.
const MOCK_PLAATSEN = [
  STANDAARD_PLEK,
  { naam: 'Maastricht', regio: 'Limburg', latitude: 50.8483, longitude: 5.6889, timezone: 'Europe/Amsterdam' },
  { naam: 'Sittard', regio: 'Limburg', latitude: 50.9983, longitude: 5.8692, timezone: 'Europe/Amsterdam' },
  { naam: 'Kerkrade', regio: 'Limburg', latitude: 50.8658, longitude: 6.0625, timezone: 'Europe/Amsterdam' },
  {
    naam: 'Valkenburg aan de Geul',
    regio: 'Limburg',
    latitude: 50.865,
    longitude: 5.8319,
    timezone: 'Europe/Amsterdam'
  },
  { naam: 'Amsterdam', regio: 'Noord-Holland', latitude: 52.374, longitude: 4.8897, timezone: 'Europe/Amsterdam' },
  {
    naam: 'Aken',
    regio: 'Noordrijn-Westfalen, Duitsland',
    latitude: 50.7766,
    longitude: 6.0834,
    timezone: 'Europe/Berlin'
  }
];

export async function zoekPlaatsen(tekst, signaal) {
  if (mockAan) {
    const t = tekst.toLowerCase();
    return MOCK_PLAATSEN.filter((p) => p.naam.toLowerCase().includes(t));
  }
  const p = new URLSearchParams({ name: tekst, count: '8', language: 'nl', format: 'json' });
  const res = await fetch(`${GEOCODING}?${p.toString()}`, { signal: signaal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json.results ?? [])
    .map((r) => ({
      naam: r.name,
      // Een provincie zegt in Nederland genoeg; daarbuiten hoort het land erbij.
      regio: [r.admin1, r.country_code === 'NL' ? null : r.country].filter(Boolean).join(', '),
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone || apparaatTijdzone()
    }))
    .filter(isPlek);
}

const graden = (w, plus, min) =>
  `${Math.abs(w).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}° ${w >= 0 ? plus : min}`;

function mijnLocatie() {
  return new Promise((klaar, mislukt) => {
    if (!('geolocation' in navigator)) {
      mislukt(new Error('geen-locatie'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Op honderd meter is nauwkeurig genoeg voor het weer, en het zegt minder
        // over waar je precies bent.
        const latitude = Math.round(pos.coords.latitude * 1000) / 1000;
        const longitude = Math.round(pos.coords.longitude * 1000) / 1000;
        klaar({
          naam: 'Mijn locatie',
          regio: `${graden(latitude, 'N', 'Z')}, ${graden(longitude, 'O', 'W')}`,
          latitude,
          longitude,
          timezone: apparaatTijdzone(),
          hier: true
        });
      },
      mislukt,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 }
    );
  });
}

// ----------------------------------------------------- plekken naast elkaar
// Achter elke bewaarde plek het weer van de dag die je bekijkt, volgens Best
// Match. Een half uur bewaard, zodat het blad bij opnieuw openen meteen vol staat.

const plekWeer = new Map();
const plekSleutel = (p) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`;

/** Vandaag of morgen (JJJJ-MM-DD) op de klok van een plek. */
export function datumOp(plek, keuze = DAG, nu = new Date()) {
  const vandaag = new Intl.DateTimeFormat('en-CA', {
    timeZone: plek.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(nu);
  if (keuze !== 'morgen') return vandaag;
  return new Date(Date.parse(`${vandaag}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
}

function weerVoor(plek) {
  const sleutel = plekSleutel(plek);
  const bewaard = plekWeer.get(sleutel);
  if (bewaard && Date.now() - bewaard.op < CACHE_TTL_MS) return bewaard.belofte;
  const belofte = laadPlekWeer(plek).catch(() => {
    plekWeer.delete(sleutel);
    return null;
  });
  plekWeer.set(sleutel, { op: Date.now(), belofte });
  return belofte;
}

/** "22°, droog" voor in de lijst, of niets als er (nog) geen gegevens zijn. */
export function plekWeerHtml(dag) {
  if (!dag || dag.t === null || dag.t === undefined) return '';
  const regen =
    dag.n === null || dag.n === undefined
      ? ''
      : dag.n < 0.1
        ? 'droog'
        : `${String(Math.round(dag.n * 10) / 10).replace('.', ',')} mm`;
  return `${dag.code === null || dag.code === undefined ? '' : icoon(icoonVoorCode(dag.code))}
    <span class="plek-cijfers"><span class="plek-temp">${Math.round(dag.t)}°</span>${
      regen ? `<span class="plek-mm">${regen}</span>` : ''
    }</span>`;
}

function vulWeer(lijstEl, plekken) {
  plekken.forEach((plek, i) => {
    weerVoor(plek).then((dagen) => {
      const vak = lijstEl.querySelector(`.plek-weer[data-i="${i}"]`);
      if (vak) vak.innerHTML = plekWeerHtml(dagen?.[datumOp(plek)]);
    });
  });
}

// ---------------------------------------------------------------------- blad

function plekKnop(plek, i, { huidig = false, bron }) {
  return `<li class="plek-rij">
      <button type="button" class="plek-kies" data-bron="${bron}" data-i="${i}"${huidig ? ' aria-current="true"' : ''}>
        <span class="plek-naam">${esc(plek.naam)}</span>
        ${plek.regio ? `<span class="plek-regio">${esc(plek.regio)}</span>` : ''}
      </button>
      ${bron === 'bewaard' ? `<span class="plek-weer" data-i="${i}"></span>` : ''}
      ${
        huidig
          ? '<span class="plek-vink" aria-label="huidige plek">✓</span>'
          : bron === 'bewaard'
            ? `<button type="button" class="plek-weg" data-i="${i}" aria-label="${esc(plek.naam)} vergeten">×</button>`
            : ''
      }
    </li>`;
}

export function zetPlekkenOp() {
  const blad = el('plekken');
  const zoek = el('plek-zoek');
  const resultatenLijst = el('plek-resultaten');
  const melding = el('plek-melding');
  let bewaard = [];
  let gevonden = [];

  const meld = (tekst) => {
    melding.textContent = tekst;
    melding.hidden = !tekst;
  };

  const toonBewaard = () => {
    bewaard = bewaardePlekken();
    // Staat er nu een plek open die niet bewaard is (een gedeelde link), dan
    // staat hij bovenaan: tikken bewaart hem.
    if (!bewaard.some((p) => zelfdePlek(p, LOCATION)) && !LOCATION.hier) bewaard = [LOCATION, ...bewaard];
    el('plek-bewaard').innerHTML = bewaard
      .map((p, i) => plekKnop(p, i, { huidig: zelfdePlek(p, LOCATION), bron: 'bewaard' }))
      .join('');
    el('plek-bewaard-kop').textContent = `Bewaard · ${DAG === 'morgen' ? 'morgen' : 'vandaag'} volgens Best Match`;
    vulWeer(el('plek-bewaard'), bewaard);
  };

  el('plek-knop').addEventListener('click', () => {
    zoek.value = '';
    resultatenLijst.hidden = true;
    meld('');
    toonBewaard();
    blad.showModal();
  });

  // Tik naast het blad: dicht.
  blad.addEventListener('click', (e) => {
    if (e.target === blad) blad.close();
  });

  let wacht = null;
  let lopend = null;
  zoek.addEventListener('input', () => {
    clearTimeout(wacht);
    lopend?.abort();
    const tekst = zoek.value.trim();
    if (tekst.length < 2) {
      resultatenLijst.hidden = true;
      meld('');
      return;
    }
    wacht = setTimeout(async () => {
      lopend = new AbortController();
      try {
        gevonden = await zoekPlaatsen(tekst, lopend.signal);
        resultatenLijst.innerHTML = gevonden
          .map((p, i) => plekKnop(p, i, { huidig: zelfdePlek(p, LOCATION), bron: 'gevonden' }))
          .join('');
        resultatenLijst.hidden = !gevonden.length;
        meld(gevonden.length ? '' : `Geen plaats gevonden die "${tekst}" heet.`);
      } catch (fout) {
        if (fout.name === 'AbortError') return;
        resultatenLijst.hidden = true;
        meld('Zoeken lukt nu niet. Is er verbinding?');
      }
    }, 300);
  });
  // Enter kiest de eerste uitkomst.
  zoek.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && gevonden.length && !resultatenLijst.hidden) {
      e.preventDefault();
      kiesPlek(gevonden[0]);
    }
  });

  blad.addEventListener('click', (e) => {
    const kies = e.target.closest('.plek-kies');
    if (kies) {
      const plek = (kies.dataset.bron === 'gevonden' ? gevonden : bewaard)[Number(kies.dataset.i)];
      if (!plek) return;
      // De plek die al open staat en al bewaard is: niets te doen.
      const alBewaard = bewaardePlekken().some((p) => zelfdePlek(p, plek));
      if (zelfdePlek(plek, LOCATION) && alBewaard && !LOCATION.gedeeld) blad.close();
      else kiesPlek(plek);
      return;
    }
    const weg = e.target.closest('.plek-weg');
    if (weg) {
      vergeetPlek(bewaard[Number(weg.dataset.i)]);
      toonBewaard();
    }
  });

  el('plek-hier').addEventListener('click', async () => {
    meld('Je locatie opvragen…');
    try {
      kiesPlek(await mijnLocatie(), { bewaar: false });
    } catch (fout) {
      meld(
        fout?.code === 1
          ? 'De app mag je locatie niet zien. Op de iPhone zet je dat aan bij Instellingen → Privacy en beveiliging → Locatievoorzieningen.'
          : 'Je locatie is nu niet te bepalen.'
      );
    }
  });
}

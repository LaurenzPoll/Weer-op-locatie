// Opbouw van de pagina. Haalt de verwachtingen op, rekent de spreiding uit en
// zet alles op het scherm.

import { LOCATION, TARGET_DATE, VENSTER } from './config.js';
import { GROEPEN, MODELLEN, kortNaam } from './models.js';
import { laadVerwachtingen } from './api.js';
import { mediaan, samenvatting } from './stats.js';
import { puntenWolk, trendLijn, uurGrafiek, uurRooster } from './charts.js';
import * as f from './format.js';
import { weercode, windstreek } from './weercodes.js';
import { bewaarMeting, leesHistorie, modelVerschuiving, trendPunten, verschuiving } from './history.js';

const modellenPerId = Object.fromEntries(MODELLEN.map((m) => [m.id, m]));
const el = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STATUSSEN = {
  ok: { label: 'actueel', kleur: 'good', icoon: '●' },
  buiten_bereik: { label: 'haalt deze dag nog niet', kleur: 'warning', icoon: '◔' },
  geen_dekking: { label: 'geen dekking op deze plek', kleur: 'serious', icoon: '○' },
  fout: { label: 'ophalen mislukt', kleur: 'critical', icoon: '!' }
};

const STATUS_ORDE = { ok: 0, buiten_bereik: 1, geen_dekking: 2, fout: 3 };

// ---------------------------------------------------------------- kop & meta

function vulKop() {
  el('plaats').textContent = `${LOCATION.naam}, ${LOCATION.regio}`;
  el('datum').textContent = f.langeDatum(TARGET_DATE);

  const dagen = f.dagenTot(TARGET_DATE);
  const aftellen =
    dagen > 1
      ? `nog ${dagen} dagen`
      : dagen === 1
        ? 'morgen'
        : dagen === 0
          ? 'vandaag'
          : `${Math.abs(dagen)} ${Math.abs(dagen) === 1 ? 'dag' : 'dagen'} geleden`;
  el('aftellen').textContent = aftellen;
  document.title = `${f.langeDatum(TARGET_DATE)} in ${LOCATION.naam} — Weer op locatie`;
}

function zetStatus(tekst, isFout = false) {
  const p = el('ophaalstatus');
  p.textContent = tekst;
  p.classList.toggle('is-fout', isFout);
}

function toonVenstermelding(soort, dagen) {
  const doos = el('venstermelding');
  doos.hidden = false;
  doos.className = 'melding';
  if (soort === 'voorbij') {
    doos.innerHTML = `<p><strong>Deze dag is voorbij.</strong> De weermodellen kijken alleen vooruit, dus er is niets
      meer op te halen. Wil je een andere dag volgen? Pas <code>TARGET_DATE</code> in <code>js/config.js</code> aan —
      dat is één regel.</p>`;
  } else {
    doos.innerHTML = `<p><strong>Nog te ver weg.</strong> Deze dag is over ${dagen} dagen, en de modellen reiken maximaal
      16 dagen vooruit. Vanaf ${esc(f.korteDatum(nDagenTerug(TARGET_DATE, 15)))} komen de eerste verwachtingen binnen.</p>`;
  }
  ['consensus', 'spreiding', 'modellen'].forEach((id) => el(id)?.setAttribute('hidden', ''));
}

function nDagenTerug(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------------ consensus

function consensusHtml(sam) {
  if (!sam.oordeel) {
    return `<p class="leeg">Nog te weinig modellen met een verwachting voor deze dag
      (${sam.bruikbaar} van ${sam.totaal}). Zodra er meer aanhaken verschijnt hier de samenvatting.</p>`;
  }

  const t = sam.temp;
  const n = sam.neerslag;
  const natte = n.paren.filter((p) => p.waarde >= 1).length;

  const dekking =
    `<p class="dekking"><strong>${sam.bruikbaar}</strong> van de ${sam.totaal} modellen ${
      sam.bruikbaar === 1 ? 'heeft' : 'hebben'
    } een verwachting voor deze dag` +
    (sam.buitenBereik ? ` · ${sam.buitenBereik} reiken nog niet zo ver` : '') +
    (sam.geenDekking ? ` · ${sam.geenDekking} zonder dekking hier` : '') +
    (sam.fout ? ` · ${sam.fout} niet op te halen` : '') +
    `.</p>`;

  return `
    <div class="oordeel oordeel-${sam.oordeel.status}">
      <span class="oordeel-icoon" aria-hidden="true">${sam.oordeel.icoon}</span>
      <p><strong>${esc(sam.oordeel.tekst)}</strong> — ${esc(sam.oordeel.reden)}.</p>
    </div>
    <div class="tegels">
      <div class="tegel tegel-held">
        <p class="tegel-label">Mediane middagtemperatuur</p>
        <p class="held">${esc(f.temp(t.mediaan))}</p>
        <p class="tegel-onder">laagste ${esc(f.temp(t.min))} · hoogste ${esc(f.temp(t.max))}</p>
      </div>
      <div class="tegel">
        <p class="tegel-label">Mediane nachttemperatuur</p>
        <p class="tegel-waarde">${esc(f.temp(sam.tempMin?.mediaan))}</p>
        <p class="tegel-onder">${sam.tempMin ? `${esc(f.temp(sam.tempMin.min))} – ${esc(f.temp(sam.tempMin.max))}` : ''}</p>
      </div>
      <div class="tegel">
        <p class="tegel-label">Mediane neerslag</p>
        <p class="tegel-waarde">${esc(f.mm(n.mediaan))}</p>
        <p class="tegel-onder">${natte} van ${n.aantal} modellen boven 1 mm · tot ${esc(f.mm(n.max))}</p>
      </div>
      <div class="tegel">
        <p class="tegel-label">Mediane wind</p>
        <p class="tegel-waarde">${esc(f.kmh(sam.wind?.mediaan))}</p>
        <p class="tegel-onder">${sam.wind ? `${esc(f.kmh(sam.wind.min))} – ${esc(f.kmh(sam.wind.max))}` : ''}</p>
      </div>
    </div>
    ${dekking}`;
}

// ------------------------------------------------------------------ spreiding

// Eén zin per groep, zodat de legenda niet alleen een naam maar ook een
// betekenis geeft — "referentie" zegt op zichzelf niets.
const GROEP_UITLEG = {
  globaal: 'Globale modellen rekenen de hele aardbol door en kijken daardoor het verst vooruit.',
  regionaal:
    'Regionale modellen zoomen in op een klein gebied en rekenen buien echt uit, maar zien maar een paar dagen vooruit.',
  referentie:
    'Referentie is geen eigen model, maar de keuze die Open-Meteo zelf maakt: per uur het fijnste model dat hier geldig is — ongeveer wat een gewone weerapp je toont.'
};

function legendaHtml(resultaten) {
  const aanwezig = new Set(
    resultaten.filter((r) => r.status === 'ok').map((r) => modellenPerId[r.id].groep)
  );
  const uitleg = [...aanwezig]
    .map((sleutel) => GROEP_UITLEG[sleutel])
    .filter(Boolean)
    .join(' ');
  const merken = Object.entries(GROEPEN)
    .filter(([sleutel]) => aanwezig.has(sleutel))
    .map(([, g]) => {
      const vormSvg =
        g.vorm === 'vierkant'
          ? `<rect x="3" y="3" width="10" height="10" rx="1.5"/>`
          : g.vorm === 'ruit'
            ? `<rect x="3.2" y="3.2" width="9.6" height="9.6" rx="1" transform="rotate(45 8 8)"/>`
            : `<circle cx="8" cy="8" r="5.5"/>`;
      return `<span class="legenda-item">
        <svg class="legenda-vorm serie-${g.serie}" viewBox="0 0 16 16" aria-hidden="true">${vormSvg}</svg>
        ${esc(g.titel)}</span>`;
    })
    .join('');
  return { merken, uitleg };
}

function wolkenHtml(sam) {
  const temp = puntenWolk({
    paren: sam.temp?.paren ?? [],
    verdeling: sam.temp,
    modellen: modellenPerId,
    formatter: (v) => f.temp(v),
    label: 'Middagtemperatuur per model'
  });
  const neerslag = puntenWolk({
    paren: sam.neerslag?.paren ?? [],
    verdeling: sam.neerslag,
    modellen: modellenPerId,
    formatter: (v) => f.mm(v),
    label: 'Neerslag over de hele dag per model',
    minimumNul: true
  });
  return `
    <div class="wolk-blok">
      <h3 class="wolk-titel">Middagtemperatuur</h3>
      ${temp}
    </div>
    <div class="wolk-blok">
      <h3 class="wolk-titel">Neerslag over de hele dag</h3>
      ${neerslag}
    </div>`;
}

// ---------------------------------------------------------------------- trend

function trendHtml(historie) {
  const tempSchuif = verschuiving(historie, 'mediaanTemp');
  const neerslagSchuif = verschuiving(historie, 'mediaanNeerslag');
  if (!tempSchuif && !neerslagSchuif) {
    return `<p class="leeg">De trend verschijnt zodra de app een tweede keer gegevens heeft opgehaald, minstens
      een halve dag na de eerste. Alles wordt lokaal op dit apparaat bijgehouden.</p>`;
  }

  const rijen = [];
  if (tempSchuif) {
    rijen.push(`
      <div class="trend-rij">
        <div>
          <p class="tegel-label">Mediane middagtemperatuur</p>
          <p class="trend-waarde">${esc(f.metTeken(tempSchuif.delta, ' °C'))}
            <span class="trend-sinds">in ${esc(tempSchuif.sinds)}</span></p>
          <p class="tegel-onder">van ${esc(f.temp(tempSchuif.van))} naar ${esc(f.temp(tempSchuif.naar))}</p>
        </div>
        ${trendLijn(trendPunten(historie, 'mediaanTemp'))}
      </div>`);
  }
  if (neerslagSchuif) {
    rijen.push(`
      <div class="trend-rij">
        <div>
          <p class="tegel-label">Mediane neerslag</p>
          <p class="trend-waarde">${esc(f.metTeken(neerslagSchuif.delta, ' mm'))}
            <span class="trend-sinds">in ${esc(neerslagSchuif.sinds)}</span></p>
          <p class="tegel-onder">van ${esc(f.mm(neerslagSchuif.van))} naar ${esc(f.mm(neerslagSchuif.naar))}</p>
        </div>
        ${trendLijn(trendPunten(historie, 'mediaanNeerslag'))}
      </div>`);
  }
  return rijen.join('');
}

// --------------------------------------------------------------------- kaarten

function waardenHtml(r) {
  const d = r.dag;
  const w = weercode(d.code);
  const streek = windstreek(d.windrichting);
  const regels = [
    ['Weerbeeld', `<span class="weer-icoon" aria-hidden="true">${w.icoon}</span> ${esc(w.tekst)}`],
    ['Middagtemperatuur', esc(f.temp(d.tempMax))],
    ['Nacht', esc(f.temp(d.tempMin))],
    [
      'Neerslag',
      esc(f.mm(d.neerslag)) +
        (d.neerslagUren ? ` <span class="bij">in ${esc(f.uren(d.neerslagUren))}</span>` : '') +
        (d.neerslagKans !== null && d.neerslagKans !== undefined
          ? ` <span class="bij">kans ${esc(f.procent(d.neerslagKans))}</span>`
          : '')
    ],
    [
      'Wind',
      esc(f.kmh(d.wind)) +
        (streek ? ` <span class="bij">uit het ${esc(streek)}</span>` : '') +
        (d.windstoten ? ` <span class="bij">stoten ${esc(f.kmh(d.windstoten))}</span>` : '')
    ]
  ];
  if (d.zonuren !== null || d.bewolking !== null) {
    regels.push([
      'Zon en bewolking',
      (d.zonuren !== null ? esc(f.uren(d.zonuren)) + ' zon' : '') +
        (d.bewolking !== null ? ` <span class="bij">${esc(f.procent(d.bewolking))} bewolkt</span>` : '')
    ]);
  }
  return `<dl class="waarden">${regels
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`)
    .join('')}</dl>`;
}

/** Vanaf welke dag mag je verwachten dat dit model de doeldag haalt? */
function aanhaakDatum(horizon) {
  if (!horizon) return null;
  const d = new Date(`${TARGET_DATE}T12:00:00`);
  d.setDate(d.getDate() - Math.floor(horizon));
  return d.toISOString().slice(0, 10);
}

function uitlegStatusHtml(r, m) {
  if (r.status === 'buiten_bereik') {
    const tot = r.laatsteDag ? f.dagMaand(r.laatsteDag) : null;
    const aanhaak = aanhaakDatum(m.horizon);
    const verwacht =
      aanhaak && f.dagenTot(aanhaak) > 0
        ? ` Volgens de aanbieder rekent hij ${esc(String(m.horizon).replace('.', ','))} dagen vooruit, dus verwacht hem
           hier vanaf ongeveer ${esc(f.dagMaand(aanhaak))}.`
        : ' Hij haakt automatisch aan zodra hij ver genoeg reikt.';
    return `<p class="statusuitleg">Dit model levert nu waarden tot en met ${esc(tot ?? 'onbekend')}
      (${r.horizonDagen} ${r.horizonDagen === 1 ? 'dag' : 'dagen'}) — deze dag valt daar nog buiten.${verwacht}</p>`;
  }
  if (r.status === 'geen_dekking') {
    return `<p class="statusuitleg">Dit model levert voor ${esc(LOCATION.naam)} op geen enkele dag waarden. Deze plek
      valt buiten zijn rekengebied, of hij levert de variabelen niet die deze app opvraagt.</p>`;
  }
  if (r.status === 'fout') {
    return `<p class="statusuitleg">Open-Meteo gaf geen bruikbaar antwoord voor dit model.
      Melding: <code>${esc(r.melding ?? 'onbekend')}</code>. Probeer het later opnieuw met Verversen.</p>`;
  }
  return '';
}

function kaartHtml(r, historie) {
  const m = modellenPerId[r.id];
  const s = STATUSSEN[r.status] ?? STATUSSEN.fout;
  const schuif = r.status === 'ok' ? modelVerschuiving(historie, r.id, 't') : null;

  const metaDelen = [m.aanbieder, m.resolutie, `bijgewerkt ${m.update}`];
  if (m.horizon) metaDelen.push(`bereik ~${String(m.horizon).replace('.', ',')} dagen`);

  const merken = [
    m.anker ? '<span class="merk">anker</span>' : '',
    m.thuismodel ? '<span class="merk">thuismodel</span>' : '',
    m.ai ? '<span class="merk">AI-model</span>' : '',
    m.ensemble ? '<span class="merk">ensemble</span>' : ''
  ].join('');

  return `
<article class="kaart" data-status="${r.status}" id="model-${esc(r.id)}">
  <div class="kaart-kop">
    <span class="vlag" aria-hidden="true">${m.vlag}</span>
    <div class="kaart-titel">
      <h3>${esc(m.naam)}</h3>
      <p class="kaart-meta">${esc(metaDelen.join(' · '))}</p>
    </div>
    <span class="chip chip-${s.kleur}"><span aria-hidden="true">${s.icoon}</span> ${esc(s.label)}</span>
  </div>
  ${merken ? `<p class="merken">${merken}</p>` : ''}
  ${r.status === 'ok' ? waardenHtml(r) : uitlegStatusHtml(r, m)}
  ${
    schuif
      ? `<p class="model-trend">Deze verwachting is <strong>${esc(
          f.metTeken(schuif.delta, ' °C')
        )}</strong> geschoven in ${esc(schuif.sinds)}.</p>`
      : ''
  }
  <div class="waarom">
    <p>${esc(m.waarom)}</p>
    ${m.letOp ? `<p class="letop"><strong>Let op:</strong> ${esc(m.letOp)}</p>` : ''}
    ${
      m.dekkingOnzeker
        ? `<p class="letop"><strong>Dekking:</strong> ${esc(m.dekking)}.</p>`
        : ''
    }
  </div>
  ${
    r.status === 'ok' && r.uren && r.uren.length
      ? `<details class="uurdetail">
           <summary>Uurverloop op deze dag</summary>
           ${uurGrafiek(r.uren)}
         </details>`
      : ''
  }
</article>`;
}

function groepenHtml(resultaten, historie) {
  return Object.entries(GROEPEN)
    .map(([sleutel, g]) => {
      const inGroep = resultaten
        .filter((r) => modellenPerId[r.id]?.groep === sleutel)
        .sort((a, b) => STATUS_ORDE[a.status] - STATUS_ORDE[b.status]);
      if (!inGroep.length) return '';
      const klaar = inGroep.filter((r) => r.status === 'ok').length;
      return `
<section class="groep">
  <div class="groep-kop">
    <h3>${esc(g.titel)} <span class="groep-telling">${klaar} van ${inGroep.length} met data</span></h3>
    <p>${esc(g.ondertitel)}</p>
  </div>
  <div class="kaarten">${inGroep.map((r) => kaartHtml(r, historie)).join('')}</div>
</section>`;
    })
    .join('');
}

// ---------------------------------------------------------------------- tabel

function tabelHtml(resultaten) {
  const koppen = [
    'Model',
    'Status',
    'Weer',
    'Middag',
    'Nacht',
    'Neerslag',
    'Regenuren',
    'Wind',
    'Stoten',
    'Richting',
    'Bewolking',
    'Zon'
  ];
  const rijen = resultaten
    .map((r) => {
      const m = modellenPerId[r.id];
      const s = STATUSSEN[r.status] ?? STATUSSEN.fout;
      if (r.status !== 'ok') {
        return `<tr><th scope="row">${esc(m.naam)}</th><td>${esc(s.label)}</td>
          <td colspan="10" class="tabel-leeg">geen waarden</td></tr>`;
      }
      const d = r.dag;
      const w = weercode(d.code);
      return `<tr>
        <th scope="row">${esc(m.naam)}</th>
        <td>${esc(s.label)}</td>
        <td>${esc(w.tekst)}</td>
        <td>${esc(f.graden(d.tempMax))}</td>
        <td>${esc(f.graden(d.tempMin))}</td>
        <td>${esc(f.mm(d.neerslag))}</td>
        <td>${esc(d.neerslagUren === null ? '–' : f.heel(d.neerslagUren))}</td>
        <td>${esc(f.kmh(d.wind))}</td>
        <td>${esc(f.kmh(d.windstoten))}</td>
        <td>${esc(windstreek(d.windrichting) ?? '–')}</td>
        <td>${esc(f.procent(d.bewolking))}</td>
        <td>${esc(f.uren(d.zonuren))}</td>
      </tr>`;
    })
    .join('');

  return `<table class="tabel">
    <caption>Alle modelwaarden voor ${esc(f.langeDatum(TARGET_DATE))} in ${esc(LOCATION.naam)}.
      Temperaturen in °C, wind in km/u.</caption>
    <thead><tr>${koppen.map((k) => `<th scope="col">${esc(k)}</th>`).join('')}</tr></thead>
    <tbody>${rijen}</tbody>
  </table>`;
}

// --------------------------------------------------------------- uurrooster

const VENSTER_UREN = [];
for (let u = VENSTER.van; u <= VENSTER.tot; u++) VENSTER_UREN.push(u);

const venTekst = `${String(VENSTER.van).padStart(2, '0')}:00 en ${String(VENSTER.tot).padStart(2, '0')}:00`;
const som = (lijst) => lijst.reduce((a, b) => a + b, 0);

// De drie manieren om naar het venster te kijken. Per meting: waar de waarde
// vandaan komt, hoe de schaal loopt, wat de regel eronder samenvat, en welk
// getal rechts per model staat.
// Vaste neerslagschaal in millimeter per uur. Bewust absoluut en niet
// meeschalend met de data: zo betekent een kleur altijd hetzelfde, en valt er
// iets zinnigs over te zeggen in de legenda.
const REGEN_SCHAAL = [
  { tot: 0.1, stap: 0, naam: 'droog' },
  { tot: 0.3, stap: 1, naam: 'een spat' },
  { tot: 1, stap: 2, naam: 'lichte regen' },
  { tot: 2, stap: 3, naam: 'regen' },
  { tot: 4, stap: 4, naam: 'stevige regen' },
  { tot: 8, stap: 5, naam: 'zware regen' },
  { tot: 15, stap: 6, naam: 'zeer zware regen' },
  { tot: Infinity, stap: 7, naam: 'stortbui' }
];

// Zonneschijn per uur vertaald naar drie weerbeelden.
const ZON_SCHAAL = [
  { vanaf: 40, icoon: 'zon', naam: 'zonnig' },
  { vanaf: 10, icoon: 'halfzon', naam: 'halfbewolkt' },
  { vanaf: -1, icoon: 'wolk', naam: 'bewolkt' }
];

// De drie manieren om naar het venster te kijken.
const METINGEN = {
  regen: {
    label: 'Regen',
    sleutel: 'neerslag',
    ramp: 'blauw',
    formatter: (v) => f.mm(v),
    cel: (v) => {
      const s = REGEN_SCHAAL.find((x) => v < x.tot);
      return {
        soort: s.stap === 0 ? 'leeg' : 'kleur',
        stap: s.stap,
        omschrijving: `${f.mm(v)} — ${s.naam}`
      };
    },
    samenvattingLabel: 'totaal',
    samenvattingFormatter: (v) => f.mm(v),
    rijSamenvatting: (waarden) => som(waarden),
    voetLabel: 'modellen met regen',
    voetWaarde: (perUur) => perUur.filter((v) => v >= 0.1).length,
    voetFormatter: (v) => (v === null ? '' : String(v)),
    tabelUitleg: `Neerslag per uur per model tussen ${venTekst}. Elke cel bevat de waarde in millimeter.`,
    legenda: {
      soort: 'balk',
      laag: 'een spat',
      hoog: 'stortbui',
      nulLabel: 'droog',
      uitleg:
        `De schaal ligt vast, dus dezelfde kleur betekent altijd hetzelfde. Een <strong>leeg vakje is droog</strong>:
         minder dan 0,1 mm in dat uur. <strong>Een spat</strong> is 0,1 tot 0,3 mm — dat zie je op de stoep en verder
         merk je er niets van. Daarna lichte regen (tot 1 mm), regen (tot 2 mm), stevige regen (tot 4 mm),
         <strong>zware regen</strong> (4 tot 8 mm: binnen tien minuten doorweekt zonder jas) en een stortbui bij meer
         dan 15 mm in één uur.`
    },
    kop: (rijen) => {
      const totalen = rijen.map((r) => r.samenvatting);
      const nat = totalen.filter((v) => v >= 0.5).length;
      const natste = rijen.reduce((a, b) => (a.samenvatting >= b.samenvatting ? a : b));
      if (!nat) {
        return `Alle ${rijen.length} modellen houden het tussen ${venTekst} vrijwel droog.`;
      }
      const med = mediaan(totalen);
      const medTekst = med < 0.5 ? `de meerderheid blijft droog` : `de mediaan komt op ${esc(f.mm(med))}`;
      return `<strong>${nat} van de ${rijen.length} modellen</strong> ${nat === 1 ? 'geeft' : 'geven'} meer dan
        0,5 mm tussen ${venTekst} — ${medTekst}, en het natste model geeft ${esc(f.mm(natste.samenvatting))}
        (${esc(natste.naam)}).`;
    }
  },
  zon: {
    label: 'Zon',
    sleutel: 'zon',
    formatter: (v) => `${Math.round(v)} min`,
    cel: (v) => {
      const s = ZON_SCHAAL.find((x) => v >= x.vanaf);
      return { soort: 'icoon', icoon: s.icoon, omschrijving: `${Math.round(v)} min zon — ${s.naam}` };
    },
    samenvattingLabel: 'totaal',
    samenvattingFormatter: (v) => f.uren(v / 60),
    rijSamenvatting: (waarden) => som(waarden),
    voetLabel: 'mediaan (minuten)',
    voetWaarde: (perUur) => (perUur.length ? mediaan(perUur) : null),
    voetFormatter: (v) => (v === null ? '' : `${Math.round(v)}`),
    tabelUitleg: `Zonneschijn in minuten per uur per model tussen ${venTekst}.`,
    legenda: {
      soort: 'iconen',
      items: [
        { icoon: 'zon', label: 'zonnig — 40 minuten of meer zon in dat uur' },
        { icoon: 'halfzon', label: 'halfbewolkt — 10 tot 40 minuten' },
        { icoon: 'wolk', label: 'bewolkt — minder dan 10 minuten' }
      ],
      uitleg: `Een uur duurt 60 minuten, dus "40 minuten zon" betekent dat de zon twee derde van dat uur vrij stond.`
    },
    kop: (rijen) => {
      const totalen = rijen.map((r) => r.samenvatting / 60);
      const meest = rijen.reduce((a, b) => (a.samenvatting >= b.samenvatting ? a : b));
      return `Mediaan <strong>${esc(f.uren(mediaan(totalen)))} zon</strong> tussen ${venTekst} —
        van ${esc(f.uren(Math.min(...totalen)))} tot ${esc(f.uren(Math.max(...totalen)))}
        (zonnigst: ${esc(meest.naam)}).`;
    }
  },
  temp: {
    label: 'Temperatuur',
    sleutel: 'temp',
    ramp: 'geel',
    formatter: (v) => f.temp(v),
    // Temperatuur heeft geen vaste schaal: het verloop loopt van de koelste tot
    // de warmste waarde die er die dag in het venster staat.
    maakCel: (domein) => (v) => {
      const [lo, hi] = domein;
      const deel = hi > lo ? (v - lo) / (hi - lo) : 1;
      return {
        soort: 'kleur',
        stap: Math.min(7, Math.max(1, Math.round(1 + deel * 6))),
        omschrijving: f.temp(v)
      };
    },
    samenvattingLabel: 'hoogste',
    samenvattingFormatter: (v) => f.temp(v),
    rijSamenvatting: (waarden) => Math.max(...waarden),
    domein: (alle) => [Math.min(...alle), Math.max(...alle)],
    voetLabel: 'mediaan (°C)',
    voetWaarde: (perUur) => (perUur.length ? mediaan(perUur) : null),
    voetFormatter: (v) => (v === null ? '' : f.graden(v)),
    tabelUitleg: `Temperatuur per uur per model tussen ${venTekst}, in graden Celsius.`,
    legenda: {
      soort: 'balk',
      laag: 'koeler',
      hoog: 'warmer',
      uitleg: `Het verloop is niet vast maar past zich aan deze dag aan: het lichtste geel is de koelste waarde die
        een model in dit venster geeft, het donkerste de warmste.`
    },
    kop: (rijen) => {
      const toppen = rijen.map((r) => r.samenvatting);
      return `Mediane hoogste temperatuur tussen ${venTekst}: <strong>${esc(f.temp(mediaan(toppen)))}</strong> —
        de modellen lopen van ${esc(f.temp(Math.min(...toppen)))} tot ${esc(f.temp(Math.max(...toppen)))}.`;
    }
  }
};

const METING_SLEUTEL = 'weer-op-locatie:meting';
let huidigeMeting = 'regen';
try {
  const bewaard = localStorage.getItem(METING_SLEUTEL);
  if (bewaard && METINGEN[bewaard]) huidigeMeting = bewaard;
} catch {
  // Zonder opslag begint hij simpelweg elke keer bij regen.
}

function bouwRooster(resultaten, metingSleutel) {
  const meting = METINGEN[metingSleutel];
  const rijen = [];
  const overgeslagen = [];
  const perUur = Object.fromEntries(VENSTER_UREN.map((u) => [u, []]));

  for (const r of resultaten) {
    if (r.status !== 'ok' || !r.uren?.length) continue;
    const waarden = {};
    let aantalGevuld = 0;
    for (const uur of VENSTER_UREN) {
      const treffer = r.uren.find((x) => x.uur === uur);
      const waarde = treffer ? (treffer[meting.sleutel] ?? null) : null;
      waarden[uur] = waarde;
      if (waarde !== null) {
        aantalGevuld++;
        perUur[uur].push(waarde);
      }
    }
    if (!aantalGevuld) {
      // Het model heeft wel uurwaarden, maar niet déze grootheid. Dat benoemen we
      // liever dan de rij stilletjes weg te laten.
      overgeslagen.push(modellenPerId[r.id].naam);
      continue;
    }
    const gevuld = Object.values(waarden).filter((v) => v !== null);
    rijen.push({
      id: r.id,
      naam: modellenPerId[r.id].naam,
      kort: kortNaam(r.id),
      waarden,
      samenvatting: meting.rijSamenvatting(gevuld)
    });
  }

  if (!rijen.length) return { rijen, meting: null, overgeslagen };

  const alle = rijen.flatMap((r) => Object.values(r.waarden).filter((v) => v !== null));
  const domein = meting.domein ? meting.domein(alle) : null;
  const uitgebreid = {
    ...meting,
    // Metingen met een vaste schaal brengen hun eigen cel-functie mee; die met
    // een meeschalend verloop krijgen hem hier, als het domein bekend is.
    cel: meting.cel ?? meting.maakCel(domein),
    legenda:
      meting.ramp === 'geel' && domein
        ? { ...meting.legenda, laag: `koeler — ${f.temp(domein[0])}`, hoog: `warmer — ${f.temp(domein[1])}` }
        : meting.legenda,
    voet: {
      label: meting.voetLabel,
      waarden: Object.fromEntries(VENSTER_UREN.map((u) => [u, meting.voetWaarde(perUur[u])])),
      formatter: meting.voetFormatter
    }
  };
  return { rijen, meting: uitgebreid, overgeslagen };
}

function renderRooster(resultaten) {
  const { rijen, meting, overgeslagen } = bouwRooster(resultaten, huidigeMeting);
  const basis = METINGEN[huidigeMeting];

  el('rooster-knoppen')
    .querySelectorAll('button')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.meting === huidigeMeting)));

  if (!rijen.length) {
    el('rooster-kop').textContent = '';
    el('rooster-inhoud').innerHTML = `<p class="leeg">Geen model levert ${basis.label.toLowerCase()} per uur voor deze
      dag. Zodra de modellen dichter bij de datum komen, vult dit rooster zich.</p>`;
    return;
  }

  el('rooster-kop').innerHTML = basis.kop(rijen);
  const noot = overgeslagen.length
    ? `<p class="rooster-noot">${esc(overgeslagen.join(', '))} ${
        overgeslagen.length === 1 ? 'levert' : 'leveren'
      } ${esc(basis.label.toLowerCase())} niet per uur en ${
        overgeslagen.length === 1 ? 'staat' : 'staan'
      } daarom niet in dit rooster.</p>`
    : '';
  el('rooster-inhoud').innerHTML = uurRooster({ rijen, uren: VENSTER_UREN, meting }) + noot;
}

// -------------------------------------------------------------------- tekenen

let laatsteResultaten = [];

function render(resultaten, meta) {
  const sam = samenvatting(resultaten);

  el('consensus-inhoud').innerHTML = consensusHtml(sam);
  const legenda = legendaHtml(resultaten);
  el('legenda').innerHTML = legenda.merken;
  el('legenda-uitleg').textContent = legenda.uitleg;
  laatsteResultaten = resultaten;
  renderRooster(resultaten);
  el('wolken').innerHTML = wolkenHtml(sam);
  el('groepen').innerHTML = groepenHtml(resultaten, meta.historie);
  el('tabel').innerHTML = tabelHtml(resultaten);

  const trendInhoud = trendHtml(meta.historie);
  el('trend').hidden = false;
  el('trend-inhoud').innerHTML = trendInhoud;

  const delen = [`bijgewerkt ${f.datumTijd(meta.opgehaaldOp)}`];
  if (meta.offline) delen.push('geen verbinding — laatst bekende gegevens');
  else if (meta.uitCache) delen.push('uit lokale cache');
  zetStatus(delen.join(' · '));
}

async function laad({ forceer = false } = {}) {
  const knop = el('verversen');
  knop.disabled = true;
  zetStatus('verwachtingen ophalen…');
  try {
    const { resultaten, opgehaaldOp, uitCache, offline } = await laadVerwachtingen({ forceer });
    const historie = uitCache ? leesHistorie() : bewaarMeting(resultaten);
    render(resultaten, { opgehaaldOp, uitCache, offline, historie });
  } catch (fout) {
    zetStatus(`ophalen mislukt: ${fout.message}`, true);
    el('consensus-inhoud').innerHTML = `<p class="leeg">Geen verbinding met Open-Meteo, en er staat nog niets in de
      lokale cache. Controleer je internetverbinding en probeer Verversen.</p>`;
  } finally {
    knop.disabled = false;
  }
}

// -------------------------------------------------------------------- tooltip

function zetTooltipOp() {
  const tip = el('tip');
  let zichtbaar = false;

  const verberg = () => {
    if (!zichtbaar) return;
    tip.classList.remove('zichtbaar');
    tip.setAttribute('aria-hidden', 'true');
    zichtbaar = false;
  };

  document.addEventListener(
    'pointerover',
    (e) => {
      const doel = e.target.closest?.('[data-tip]');
      if (!doel) return verberg();
      tip.textContent = doel.dataset.tip;
      tip.classList.add('zichtbaar');
      tip.setAttribute('aria-hidden', 'false');
      zichtbaar = true;
      const vak = doel.getBoundingClientRect();
      const breedte = tip.offsetWidth;
      const links = Math.min(
        Math.max(8, vak.left + vak.width / 2 - breedte / 2),
        window.innerWidth - breedte - 8
      );
      const boven = vak.top - tip.offsetHeight - 10;
      tip.style.left = `${links}px`;
      tip.style.top = `${boven < 8 ? vak.bottom + 10 : boven}px`;
    },
    { passive: true }
  );

  document.addEventListener('pointerdown', verberg, { passive: true });
  window.addEventListener('scroll', verberg, { passive: true });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && verberg());
}

// ----------------------------------------------------------------------- start

function start() {
  vulKop();
  zetTooltipOp();
  el('verversen').addEventListener('click', () => laad({ forceer: true }));

  el('rooster-knoppen').addEventListener('click', (e) => {
    const knop = e.target.closest('button[data-meting]');
    if (!knop || !METINGEN[knop.dataset.meting]) return;
    huidigeMeting = knop.dataset.meting;
    try {
      localStorage.setItem(METING_SLEUTEL, huidigeMeting);
    } catch {
      // Niet kunnen onthouden is geen reden om de weergave niet te wisselen.
    }
    renderRooster(laatsteResultaten);
  });

  const dagen = f.dagenTot(TARGET_DATE);
  if (dagen < 0) {
    toonVenstermelding('voorbij');
    zetStatus('');
    return;
  }
  if (dagen > 15) {
    toonVenstermelding('tever', dagen);
    zetStatus('');
    return;
  }
  laad();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Zonder service worker werkt de app gewoon, alleen niet offline.
    });
  }
}

start();

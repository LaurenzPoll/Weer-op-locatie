// Opbouw van de pagina. Haalt de verwachtingen op, rekent de spreiding uit en
// zet alles op het scherm.

import { DAG, DAGKEUZES, LOCATION, TARGET_DATE, VENSTER, datumVoor, kiesDag } from './config.js';
import { GROEPEN, MODELLEN, kortNaam } from './models.js';
import { laadVerwachtingen } from './api.js';
import { mediaan, samenvatting } from './stats.js';
import { puntenWolk, trendLijn, uurGrafiek, uurRooster } from './charts.js';
import * as f from './format.js';
import { weercode, windstreek } from './weercodes.js';
import { icoon, icoonVoorCode } from './iconen.js';
import { bewaarMeting, leesHistorie, modelVerschuiving, trendPunten, verschuiving } from './history.js';

const modellenPerId = Object.fromEntries(MODELLEN.map((m) => [m.id, m]));
const el = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STATUSSEN = {
  ok: { label: 'actueel', kort: 'actueel', kleur: 'good', icoon: '●' },
  buiten_bereik: { label: 'haalt deze dag nog niet', kort: 'reikt niet zo ver', kleur: 'warning', icoon: '◔' },
  geen_dekking: { label: 'geen dekking op deze plek', kort: 'geen dekking', kleur: 'serious', icoon: '○' },
  fout: { label: 'ophalen mislukt', kort: 'mislukt', kleur: 'critical', icoon: '!' }
};

const STATUS_ORDE = { ok: 0, buiten_bereik: 1, geen_dekking: 2, fout: 3 };

// ---------------------------------------------------------------- kop & meta

function vulKop() {
  el('plaats').textContent = LOCATION.naam;
  el('regio').textContent = LOCATION.regio;
  // Het scheidingsteken komt met de datum mee, zodat er vóór het laden geen los
  // puntje achter de regio staat.
  el('datum').textContent = ` · ${f.weekdagDatum(TARGET_DATE)}`;
  const knoppen = el('dag-knoppen');
  knoppen.style.setProperty('--i', String(DAGKEUZES.indexOf(DAG)));
  knoppen
    .querySelectorAll('button')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dag === DAG)));
  document.title = `${DAG === 'morgen' ? 'Morgen' : 'Vandaag'} in ${LOCATION.naam} — Weer op locatie`;
}

function zetStatus(tekst, isFout = false) {
  const p = el('ophaalstatus');
  p.textContent = tekst;
  p.classList.toggle('is-fout', isFout);
}

// ------------------------------------------------------------------ consensus
// De bovenste kaart is de lucht zelf: zijn kleur volgt het weerbeeld waar de
// meeste modellen op uitkomen, en de strip eronder laat zien hoe dicht de
// modellen bij elkaar zitten. Dat is de vraag waar deze app om draait.

const LUCHT_TEKST = {
  zon: 'Zonnig',
  halfzon: 'Half bewolkt',
  wolk: 'Bewolkt',
  mist: 'Nevelig',
  regen: 'Regen',
  bui: 'Buien',
  sneeuw: 'Sneeuw',
  onweer: 'Onweer'
};

/** Het weerbeeld dat de meeste modellen geven, met hoeveel dat er zijn. */
function meesteWeerbeeld(resultaten) {
  const tel = {};
  for (const r of resultaten) {
    if (r.status !== 'ok' || r.dag?.code === null || r.dag?.code === undefined) continue;
    const naam = icoonVoorCode(r.dag.code);
    tel[naam] = (tel[naam] ?? 0) + 1;
  }
  const [naam, aantal] = Object.entries(tel).sort((a, b) => b[1] - a[1])[0] ?? ['wolk', 0];
  return { naam, aantal, totaal: Object.values(tel).reduce((a, b) => a + b, 0) };
}

/** Een stip per model op één temperatuuras, met de middelste helft als band. */
function koorHtml(v) {
  const lo = v.min;
  const span = v.max - v.min || 1;
  const pos = (x) => 5 + ((x - lo) / span) * 90;
  // Stippen die elkaar zouden raken schuiven een rij omhoog, zodat je ze telt.
  const rijen = [];
  const stippen = [...v.paren]
    .sort((a, b) => a.waarde - b.waarde)
    .map((p) => {
      const x = pos(p.waarde);
      let rij = rijen.findIndex((laatste) => x - laatste >= 4.2);
      if (rij === -1) rij = rijen.length < 3 ? rijen.push(x) - 1 : rijen.indexOf(Math.min(...rijen));
      rijen[rij] = x;
      const naam = modellenPerId[p.id]?.naam ?? p.id;
      return `<i style="left:${x.toFixed(1)}%;--rij:${rij}" data-tip="${esc(`${naam}: ${f.temp(p.waarde)}`)}"></i>`;
    })
    .join('');
  const bandL = pos(v.p25);
  const bandB = Math.max(pos(v.p75) - bandL, 1.5);
  const omschrijving = `Middagtemperatuur van ${v.aantal} modellen: van ${f.temp(v.min)} tot ${f.temp(
    v.max
  )}, mediaan ${f.temp(v.mediaan)}.`;
  return `
    <div class="koor">
      <div class="koor-baan" role="img" aria-label="${esc(omschrijving)}">
        <span class="koor-band" style="left:${bandL.toFixed(1)}%;width:${bandB.toFixed(1)}%"></span>
        <span class="koor-med" style="left:${pos(v.mediaan).toFixed(1)}%"></span>
        ${stippen}
      </div>
      <div class="koor-as" aria-hidden="true">
        <span>${esc(f.graden(v.min))}°</span>
        <span>elke stip is één model</span>
        <span>${esc(f.graden(v.max))}°</span>
      </div>
    </div>`;
}

function consensusHtml(sam, resultaten) {
  if (!sam.oordeel) {
    return `
      <p class="lucht-eyebrow">Nog even geduld</p>
      <p class="lucht-leeg">Nog te weinig modellen met een verwachting voor deze dag (${sam.bruikbaar} van
        ${sam.totaal}). Zodra er meer aanhaken verschijnt hier de samenvatting.</p>`;
  }

  const t = sam.temp;
  const n = sam.neerslag;
  const natte = n.paren.filter((p) => p.waarde >= 1).length;
  const beeld = meesteWeerbeeld(resultaten);

  const dekking =
    `${sam.bruikbaar} van de ${sam.totaal} modellen ${sam.bruikbaar === 1 ? 'heeft' : 'hebben'} een verwachting` +
    (sam.buitenBereik ? ` · ${sam.buitenBereik} reiken nog niet zo ver` : '') +
    (sam.geenDekking ? ` · ${sam.geenDekking} zonder dekking hier` : '') +
    (sam.fout ? ` · ${sam.fout} niet op te halen` : '');

  return `
    <p class="lucht-eyebrow">Middag · mediaan van ${t.aantal} modellen</p>
    <div class="lucht-hoofd">
      <p class="lucht-temp"><span class="enkel-lezer">Mediane middagtemperatuur: ${esc(f.temp(t.mediaan))}</span><span
        aria-hidden="true">${Math.round(t.mediaan)}<span class="graad">°</span></span></p>
      <div class="lucht-beeld">
        ${icoon(beeld.naam, 'lucht-icoon')}
        <p><strong>${esc(LUCHT_TEKST[beeld.naam])}</strong><span>${beeld.aantal} van ${beeld.totaal} modellen</span></p>
      </div>
    </div>
    ${koorHtml(t)}
    <dl class="lucht-cijfers">
      <div><dt>Nacht</dt><dd>${esc(f.temp(sam.tempMin?.mediaan))}</dd>
        <dd class="bij">${sam.tempMin ? `${esc(f.graden(sam.tempMin.min))} – ${esc(f.graden(sam.tempMin.max))}°` : ''}</dd></div>
      <div><dt>Neerslag</dt><dd>${esc(f.mm(n.mediaan))}</dd>
        <dd class="bij">${natte} van ${n.aantal} nat</dd></div>
      <div><dt>Wind</dt><dd>${esc(f.kmh(sam.wind?.mediaan))}</dd>
        <dd class="bij">${sam.wind ? `tot ${esc(f.kmh(sam.wind.max))}` : ''}</dd></div>
    </dl>
    <div class="oordeel oordeel-${sam.oordeel.status}">
      <span class="oordeel-icoon" aria-hidden="true">${sam.oordeel.icoon}</span>
      <p><strong>${esc(sam.oordeel.tekst)}</strong> ${esc(sam.oordeel.reden)}.</p>
    </div>
    <p class="lucht-dekking">${esc(dekking)}.</p>`;
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
        ${esc(g.kort)}</span>`;
    })
    .join('');
  return { merken, uitleg };
}

function wolkenHtml(sam, breedte) {
  const temp = puntenWolk({
    paren: sam.temp?.paren ?? [],
    verdeling: sam.temp,
    modellen: modellenPerId,
    formatter: (v) => f.temp(v),
    label: 'Middagtemperatuur per model',
    breedte
  });
  const neerslag = puntenWolk({
    paren: sam.neerslag?.paren ?? [],
    verdeling: sam.neerslag,
    modellen: modellenPerId,
    formatter: (v) => f.mm(v),
    label: 'Neerslag over de hele dag per model',
    minimumNul: true,
    breedte
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
    ['Weerbeeld', `${icoon(icoonVoorCode(d.code), 'weer-icoon')} ${esc(w.tekst)}`],
    ['Middag', esc(f.temp(d.tempMax))],
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

// Onder de naam: resolutie en land, of — als het model niets levert — de
// statuschip. Die stond eerst rechts, waar hij de naam op een telefoon over
// twee of drie regels drukte.
function rijSubHtml(r, m, s) {
  if (r.status !== 'ok') {
    return `<span class="model-sub"><span class="chip chip-${s.kleur}"><span aria-hidden="true">${
      s.icoon
    }</span> ${esc(s.kort)}</span></span>`;
  }
  return `<span class="model-sub">${esc(`${m.resolutie} · ${m.land}`)}</span>`;
}

function rijWaardeHtml(r) {
  if (r.status !== 'ok') return '<span class="model-waarde"></span>';
  const d = r.dag;
  return `<span class="model-waarde">
    ${icoon(icoonVoorCode(d.code))}
    <span class="model-cijfers"><span class="model-temp">${esc(f.graden(d.tempMax))}°</span><span
      class="model-mm">${d.neerslag !== null && d.neerslag < 0.1 ? 'droog' : esc(f.mm(d.neerslag))}</span></span>
  </span>`;
}

function kaartHtml(r, historie, grafiekBreedte) {
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
<details class="model" data-status="${r.status}" id="model-${esc(r.id)}">
  <summary>
    <span class="vlag" aria-hidden="true">${m.vlag}</span>
    <span class="model-titel">
      <span class="model-naam">${esc(m.naam).replace(/(\d) (km)\b/g, '$1&nbsp;$2')}</span>
      ${rijSubHtml(r, m, s)}
    </span>
    ${rijWaardeHtml(r)}
    <svg class="pijl" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.2 2.5 7.8 6l-3.6 3.5"/></svg>
  </summary>
  <div class="model-inhoud">
    <p class="kaart-meta">${esc(metaDelen.join(' · '))}</p>
    ${merken ? `<p class="merken">${merken}</p>` : ''}
    ${r.status === 'ok' ? waardenHtml(r) : uitlegStatusHtml(r, m)}
    ${
      schuif
        ? `<p class="model-trend">Deze verwachting is <strong>${esc(
            f.metTeken(schuif.delta, ' °C')
          )}</strong> geschoven in ${esc(schuif.sinds)}.</p>`
        : ''
    }
    ${
      r.status === 'ok' && r.uren && r.uren.length
        ? `<div class="uurdetail">${uurGrafiek(r.uren, { breedte: grafiekBreedte })}</div>`
        : ''
    }
    <div class="waarom">
      <p>${esc(m.waarom)}</p>
      ${m.letOp ? `<p class="letop"><strong>Let op:</strong> ${esc(m.letOp)}</p>` : ''}
      ${m.dekkingOnzeker ? `<p class="letop"><strong>Dekking:</strong> ${esc(m.dekking)}.</p>` : ''}
    </div>
  </div>
</details>`;
}

function groepenHtml(resultaten, historie, grafiekBreedte) {
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
    <h3>${esc(g.titel)}</h3>
    <span class="groep-telling">${klaar} van ${inGroep.length} met data</span>
  </div>
  <p class="groep-uitleg">${esc(g.ondertitel)}</p>
  <div class="lijst">${inGroep.map((r) => kaartHtml(r, historie, grafiekBreedte)).join('')}</div>
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
    // Zelfde grens als een leeg vakje: onder 0,1 mm heet het droog.
    samenvattingFormatter: (v) => (v < 0.1 ? 'droog' : f.mm(v)),
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
      uitlegKop: 'Wat betekenen de kleuren?',
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
      uitlegKop: 'Wat betekent 40 minuten zon?',
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
    // Hele graden: een decimaal past niet in een kolom van een telefoonbreed
    // rooster, en de vakjes en tips geven de precieze waarde al. `|| 0` voorkomt
    // een "-0" bij een mediaan net onder nul.
    voetFormatter: (v) => (v === null ? '' : String(Math.round(v) || 0)),
    tabelUitleg: `Temperatuur per uur per model tussen ${venTekst}, in graden Celsius.`,
    legenda: {
      soort: 'balk',
      laag: 'koeler',
      hoog: 'warmer',
      uitlegKop: 'Hoe loopt de kleurschaal?',
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

  const knoppen = el('rooster-knoppen');
  knoppen.style.setProperty('--i', String(Object.keys(METINGEN).indexOf(huidigeMeting)));
  knoppen
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
// Elke laadronde krijgt een volgnummer. Wissel je van dag terwijl er nog een
// ophaal loopt, dan mag dat oudere antwoord de nieuwe dag niet overschrijven.
let laadBeurt = 0;

// Grafieken worden op de echte breedte getekend in plaats van geschaald: een
// SVG van 560 breed op een telefoon van 360 maakt van 11 px tekst 7 px.
const breedteVan = (id, aftrek = 0) =>
  Math.max(260, Math.round(el(id).getBoundingClientRect().width - aftrek));

let laatsteRender = null;

function render(resultaten, meta) {
  laatsteRender = { resultaten, meta };
  const sam = samenvatting(resultaten);

  const lucht = el('consensus');
  lucht.dataset.lucht = sam.oordeel ? meesteWeerbeeld(resultaten).naam : 'leeg';
  el('consensus-inhoud').innerHTML = consensusHtml(sam, resultaten);
  const legenda = legendaHtml(resultaten);
  el('legenda').innerHTML = legenda.merken;
  el('legenda-uitleg').textContent = legenda.uitleg;
  laatsteResultaten = resultaten;
  renderRooster(resultaten);
  el('wolken').innerHTML = wolkenHtml(sam, breedteVan('wolken'));
  // Open modellen blijven open als de weergave opnieuw wordt opgebouwd.
  const open = [...document.querySelectorAll('details.model[open]')].map((d) => d.id);
  el('groepen').innerHTML = groepenHtml(resultaten, meta.historie, breedteVan('groepen', 32));
  open.forEach((id) => document.getElementById(id)?.setAttribute('open', ''));
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
  const beurt = ++laadBeurt;
  const knop = el('verversen');
  knop.disabled = true;
  knop.classList.add('draait');
  zetStatus('verwachtingen ophalen…');
  try {
    const { resultaten, perDag, opgehaaldOp, uitCache, offline } = await laadVerwachtingen({ forceer });
    // Een verse ophaal bevat vandaag én morgen; beide gaan de trend in, welke
    // dag je ook bekijkt.
    if (!uitCache) Object.entries(perDag).forEach(([datum, res]) => bewaarMeting(res, datum));
    if (beurt !== laadBeurt) return;
    render(resultaten, { opgehaaldOp, uitCache, offline, historie: leesHistorie() });
  } catch (fout) {
    if (beurt !== laadBeurt) return;
    zetStatus(`ophalen mislukt: ${fout.message}`, true);
    el('consensus').dataset.lucht = 'leeg';
    el('consensus-inhoud').innerHTML = `<p class="lucht-eyebrow">Geen verbinding</p>
      <p class="lucht-leeg">Open-Meteo is niet bereikbaar en er staat nog niets op dit apparaat. Controleer je
      internetverbinding en tik op verversen.</p>`;
  } finally {
    if (beurt === laadBeurt) {
      knop.disabled = false;
      knop.classList.remove('draait');
    }
  }
}

function wisselDag(keuze) {
  kiesDag(keuze);
  // De keuze in de URL, zodat een gedeelde link of herladen op dezelfde dag opent.
  try {
    const url = new URL(location.href);
    url.searchParams.set('dag', DAG);
    history.replaceState(null, '', url);
  } catch {
    // Geen URL bijwerken is geen reden om niet te wisselen.
  }
  vulKop();
  laad();
}

// -------------------------------------------------------------------- tooltip

function zetTooltipOp() {
  const tip = el('tip');
  let zichtbaar = null;

  const verberg = () => {
    if (!zichtbaar) return;
    tip.classList.remove('zichtbaar');
    tip.setAttribute('aria-hidden', 'true');
    zichtbaar = null;
  };

  const toon = (doel) => {
    tip.textContent = doel.dataset.tip;
    tip.classList.add('zichtbaar');
    tip.setAttribute('aria-hidden', 'false');
    zichtbaar = doel;
    const vak = doel.getBoundingClientRect();
    const breedte = tip.offsetWidth;
    const links = Math.min(
      Math.max(8, vak.left + vak.width / 2 - breedte / 2),
      window.innerWidth - breedte - 8
    );
    const boven = vak.top - tip.offsetHeight - 10;
    tip.style.left = `${links}px`;
    tip.style.top = `${boven < 8 ? vak.bottom + 10 : boven}px`;
  };

  // Met een muis volgt de tip de aanwijzer; op een telefoon is er geen hover,
  // dus daar opent een tik hem en sluit een tweede tik of scrollen hem weer.
  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const doel = e.target.closest?.('[data-tip]');
      if (doel) toon(doel);
      else verberg();
    },
    { passive: true }
  );
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse') return verberg();
      const doel = e.target.closest?.('[data-tip]');
      if (doel && doel !== zichtbaar) toon(doel);
      else verberg();
    },
    { passive: true }
  );
  window.addEventListener('scroll', verberg, { passive: true });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && verberg());
}

// Als de grote titel wegscrolt, verschijnt de plaatsnaam klein in de balk —
// zoals een iOS-navigatiebalk dat doet. Op het beginscherm verdwijnt hij al
// onder de statusbalk, dus die strook telt mee.
function zetBalkOp() {
  const balk = el('balk');
  if (!('IntersectionObserver' in window)) return;
  const statusbalk = parseFloat(getComputedStyle(balk).top) || 0;
  new IntersectionObserver(([ingang]) => balk.classList.toggle('is-vast', !ingang.isIntersecting), {
    rootMargin: `-${Math.round(statusbalk) + 8}px 0px 0px 0px`
  }).observe(el('plaats'));
}

// Een link naar een model in het rooster klapt dat model open en scrolt ernaar.
function zetModelLinksOp() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest?.('a[href^="#model-"]');
    if (!link) return;
    const doel = document.getElementById(link.getAttribute('href').slice(1));
    if (!doel) return;
    e.preventDefault();
    doel.open = true;
    const rustig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    doel.scrollIntoView({ behavior: rustig ? 'auto' : 'smooth', block: 'start' });
  });
}

// ----------------------------------------------------------------------- start

function start() {
  vulKop();
  zetTooltipOp();
  zetBalkOp();
  zetModelLinksOp();

  // Draait de telefoon of verandert het venster van breedte, dan tekenen we de
  // grafieken opnieuw op de nieuwe maat.
  let vorigeBreedte = window.innerWidth;
  let wacht = null;
  window.addEventListener('resize', () => {
    clearTimeout(wacht);
    wacht = setTimeout(() => {
      if (window.innerWidth === vorigeBreedte || !laatsteRender) return;
      vorigeBreedte = window.innerWidth;
      render(laatsteRender.resultaten, laatsteRender.meta);
    }, 150);
  });
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

  el('dag-knoppen').addEventListener('click', (e) => {
    const knop = e.target.closest('button[data-dag]');
    if (!knop || !DAGKEUZES.includes(knop.dataset.dag) || knop.dataset.dag === DAG) return;
    wisselDag(knop.dataset.dag);
  });

  // Staat de pagina over middernacht open, dan schuift 'vandaag' mee zodra je
  // er weer naar kijkt.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && datumVoor(DAG) !== TARGET_DATE) wisselDag(DAG);
  });

  laad();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Zonder service worker werkt de app gewoon, alleen niet offline.
    });
  }
}

start();

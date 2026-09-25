// Opbouw van de pagina. Haalt de verwachtingen op, rekent de spreiding uit en
// zet alles op het scherm.

import {
  CACHE_TTL_MS,
  DAG,
  DAGKEUZES,
  LOCATION,
  TARGET_DATE,
  VENSTER,
  dagenTerug,
  datumVoor,
  kiesDag,
  tijdOpLocatie,
  uurNu
} from './config.js';
import { GROEPEN, MODELLEN, kortNaam } from './models.js';
import { laadMockHistorie, laadRegenNu, laadTerugblik, laadVerwachtingen, oudeVerwachtingen } from './api.js';
import { mediaan, samenvatting } from './stats.js';
import { puntenWolk, trendLijn, uurGrafiek, uurRooster } from './charts.js';
import * as f from './format.js';
import { weercode, windstreek } from './weercodes.js';
import { icoon, icoonVoorCode } from './iconen.js';
import { FIGUREN, MEDAILLES, PIXEL, figuurVoor, pixelSvg, zetPixel } from './pixels.js';
import {
  bewaarMeting,
  leesHistorie,
  leesVerleden,
  modelVerschuiving,
  trendPunten,
  verschuiving
} from './history.js';
import { NAT_MM, RAAK_GRADEN, beoordeel, besteModellen, ranglijst, verwachtingVan } from './uitslag.js';
import { zonOpOnder } from './zon.js';
import { regenKomend } from './nu.js';
import { plekParameters, zetPlekkenOp } from './plek.js';

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
  el('balk-titel').textContent = LOCATION.naam;
  // Een lange plaatsnaam past niet in de grote letter; het langste woord
  // bepaalt hoeveel kleiner hij moet.
  const langste = Math.max(...LOCATION.naam.split(/\s+/).map((w) => w.length));
  el('plaats').style.fontSize = langste > 12 ? `${Math.max(34, Math.floor((58 * 12) / langste))}px` : '';
  el('regio').textContent = LOCATION.regio;
  // Het scheidingsteken komt met de datum mee, zodat er vóór het laden geen los
  // puntje achter de regio staat.
  el('datum').textContent = `${LOCATION.regio ? ' · ' : ''}${f.weekdagDatum(TARGET_DATE)}`;
  const knoppen = el('dag-knoppen');
  knoppen.style.setProperty('--i', String(DAGKEUZES.indexOf(DAG)));
  knoppen
    .querySelectorAll('button')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dag === DAG)));
  document.title = `${DAG === 'morgen' ? 'Morgen' : 'Vandaag'} in ${LOCATION.naam} — Weer`;
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

// Zonsopkomst en -ondergang hangen niet van een model af; die rekenen we uit.
const ZON_OP = `<svg class="lucht-klein" viewBox="0 0 24 24" aria-hidden="true">
  <path class="zonvlak" d="M6.5 17a5.5 5.5 0 0 1 11 0z"/><path d="M3 20h18M12 3v6M9 6l3-3 3 3"/></svg>`;
const ZON_ONDER = `<svg class="lucht-klein" viewBox="0 0 24 24" aria-hidden="true">
  <path class="zonvlak" d="M6.5 17a5.5 5.5 0 0 1 11 0z"/><path d="M3 20h18M12 3v6M9 6l3 3 3-3"/></svg>`;

function zonHtml() {
  const z = zonOpOnder(TARGET_DATE, LOCATION.latitude, LOCATION.longitude);
  const dag = DAG === 'morgen' ? 'morgen' : 'vandaag';
  if (z.poolnacht) return `<p class="lucht-zon">De zon komt ${dag} niet op</p>`;
  if (z.middernachtzon) return `<p class="lucht-zon">De zon gaat ${dag} niet onder</p>`;
  const tz = LOCATION.timezone;
  return `<p class="lucht-zon">
      <span>${ZON_OP}<span class="enkel-lezer">Zon op om </span>${esc(f.klok(z.op, tz))}</span>
      <span>${ZON_ONDER}<span class="enkel-lezer">Zon onder om </span>${esc(f.klok(z.onder, tz))}</span>
    </p>`;
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
    <div class="lucht-links">
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
    </div>
    <div class="lucht-rechts">
    <dl class="lucht-cijfers">
      <div><dt>Nacht</dt><dd>${esc(f.temp(sam.tempMin?.mediaan))}</dd>
        <dd class="bij">${sam.tempMin ? `${esc(f.graden(sam.tempMin.min))} – ${esc(f.graden(sam.tempMin.max))}°` : ''}</dd></div>
      <div><dt>Neerslag</dt><dd>${esc(f.mm(n.mediaan))}</dd>
        <dd class="bij">${natte} van ${n.aantal} nat</dd></div>
      <div><dt>Wind</dt><dd>${esc(f.kmh(sam.wind?.mediaan))}</dd>
        <dd class="bij">${sam.wind ? `tot ${esc(f.kmh(sam.wind.max))}` : ''}</dd></div>
    </dl>
    <div class="lucht-regels">
      <p class="lucht-nu" id="lucht-nu" hidden></p>
      ${zonHtml()}
      ${besteHtml(resultaten)}
    </div>
    <div class="oordeel oordeel-${sam.oordeel.status}">
      <span class="oordeel-icoon" aria-hidden="true">${sam.oordeel.icoon}</span>
      <p><strong>${esc(sam.oordeel.tekst)}</strong> ${esc(sam.oordeel.reden)}.</p>
    </div>
    <div class="lucht-voet">
      <p class="lucht-dekking">${esc(dekking)}.</p>
      <button type="button" class="lucht-deel" data-actie="delen">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 11H5.5A1.5 1.5 0 0 0 4 12.5v7A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H17"/></svg>
        Delen
      </button>
    </div>
    </div>`;
}

// ---------------------------------------------------------------------- delen
// Het oordeel als een paar zinnen, voor een appje of een bericht. De link
// opent dezelfde dag op dezelfde plek.

function deelTekst() {
  if (!laatsteRender) return null;
  const sam = samenvatting(laatsteRender.resultaten);
  if (!sam.oordeel) return null;
  const beeld = meesteWeerbeeld(laatsteRender.resultaten);
  const dag = DAG === 'morgen' ? 'Morgen' : 'Vandaag';
  const regels = [
    `${dag} in ${LOCATION.naam} (${f.weekdagDatum(TARGET_DATE)}): ${Math.round(sam.temp.mediaan)}° en ` +
      `${LUCHT_TEKST[beeld.naam].toLowerCase()}, volgens de mediaan van ${sam.temp.aantal} weermodellen.`,
    `${sam.oordeel.tekst}: ${sam.oordeel.reden}.`
  ];
  const komend = komendeRegen();
  if (komend) regels.push(`${komend.kop}${komend.rest ? `, ${komend.rest}` : ''}.`);
  return regels.join(' ');
}

async function deel() {
  const tekst = deelTekst();
  if (!tekst) return;
  const url = new URL(location.href);
  url.search = '';
  for (const [k, w] of Object.entries({ dag: DAG, ...plekParameters() })) if (w) url.searchParams.set(k, w);
  const titel = `${DAG === 'morgen' ? 'Morgen' : 'Vandaag'} in ${LOCATION.naam}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: titel, text: tekst, url: url.href });
    } catch {
      // Weggetikt: niets aan de hand.
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${tekst}\n${url.href}`);
    meld('Gekopieerd. Plak het waar je wilt.');
  } catch {
    meld('Delen lukt hier niet.');
  }
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

// ------------------------------------------------------------- wie had gelijk
// Het podium van gisteren en de stand over de afgelopen week. De maatstaf is
// Open-Meteo's eigen terugblik: een analyse, geen regenmeter. Dat staat erbij.

function figuurTegel(id, klasse = '') {
  const figuur = FIGUREN[figuurVoor(modellenPerId[id])];
  return `<span class="figuur-tegel${klasse ? ` ${klasse}` : ''}" aria-hidden="true">${pixelSvg(figuur.rijen)}</span>`;
}

const regenTekst = (n) => (n >= NAT_MM ? `${f.mm(n)} regen` : 'droog');

function dagLabel(datum) {
  if (datum === dagenTerug(1)) return 'Gisteren';
  const tekst = f.weekdagDatum(datum);
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

/** Waar een model naast zat, in woorden: te warm of te koud, en de regen. */
function naastTekst(r, gezien) {
  const delen = [];
  if (Math.abs(r.dT) >= 0.5) delen.push(`${f.graden(Math.abs(r.dT))} °C te ${r.dT > 0 ? 'warm' : 'koud'}`);
  if (!r.regenGoed)
    delen.push(r.n >= NAT_MM ? `gaf ${f.mm(r.n)} regen die niet viel` : `hield het droog terwijl er ${f.mm(gezien.n)} viel`);
  return delen.join(' en ') || 'net iets verder ernaast dan de rest';
}

function podiumHtml(dag) {
  const { gezien, rijen } = dag;
  const plekken = rijen
    .slice(0, 3)
    .map(
      (r, i) => `
      <li class="podium-rij">
        ${figuurTegel(r.id)}
        <span class="podium-naam"><strong>${esc(modellenPerId[r.id]?.naam ?? r.id)}</strong>
          <span>verwachtte ${esc(f.temp(r.t))} en ${esc(regenTekst(r.n))}</span></span>
        <span class="medaille" role="img" aria-label="${i + 1}e plaats">${pixelSvg(MEDAILLES[i + 1])}</span>
      </li>`
    )
    .join('');
  const laatste = rijen.length > 3 ? rijen.at(-1) : null;
  const bron = dag.dagErvoor
    ? `de verwachting van ${f.weekdagTijd(dag.punt.ts)}`
    : `de verwachting van die ochtend, ${f.tijdstip(dag.punt.ts)}`;
  const nat = gezien.n >= NAT_MM;
  return `
    <div class="paneel podium">
      <p class="tegel-label">${esc(dagLabel(dag.datum))}</p>
      <p class="podium-gezien">Het werd <strong>${esc(f.temp(gezien.t))}</strong> en
        <strong>${nat ? `nat, ${esc(f.mm(gezien.n))}` : 'droog'}</strong>${
          !nat && gezien.n > 0 ? ` <span>(${esc(f.mm(gezien.n))})</span>` : ''
        }.</p>
      <ol class="podium-lijst">${plekken}</ol>
      ${
        laatste
          ? `<p class="podium-laatste">Verst ernaast: <strong>${esc(kortNaam(laatste.id))}</strong>, ${esc(
              naastTekst(laatste, gezien)
            )}.</p>`
          : ''
      }
      <p class="uitslag-klein">Beoordeeld op ${esc(bron)}.</p>
    </div>`;
}

function standHtml(dagen) {
  const rang = ranglijst(dagen);
  const datums = dagen.map((d) => d.datum).reverse();
  const rij = (s, i) => `
      <li class="stand-rij">
        <span class="stand-plek">${
          i < 3 ? `<span role="img" aria-label="${i + 1}e plaats">${pixelSvg(MEDAILLES[i + 1])}</span>` : i + 1
        }</span>
        ${figuurTegel(s.id, 'klein')}
        <span class="stand-naam">${esc(kortNaam(s.id))}</span>
        <span class="stand-reeks" role="img" aria-label="${s.raak} van de ${s.dagen} dagen raak">${datums
          .map((d) => `<i class="${s.reeks[d] === undefined ? 'geen' : s.reeks[d] ? 'raak' : 'mis'}"></i>`)
          .join('')}</span>
        <span class="stand-cijfer">±${esc(f.graden(s.gemAfwijking))}°</span>
      </li>`;
  const rest = rang.slice(5);
  return `
    <div class="paneel stand">
      <p class="tegel-label">De stand over ${dagen.length} dagen</p>
      <ol class="stand-lijst">${rang.slice(0, 5).map(rij).join('')}</ol>
      ${
        rest.length
          ? `<details class="meer"><summary>Alle ${rang.length} modellen</summary>
              <ol class="stand-lijst">${rest.map((s, i) => rij(s, i + 5)).join('')}</ol></details>`
          : ''
      }
      <p class="uitslag-klein">Eén vakje per dag, oudste links. Gevuld is raak: binnen ${esc(
        String(RAAK_GRADEN).replace('.', ',')
      )} °C en goed over droog of nat. ± is de gemiddelde afwijking in middagtemperatuur.</p>
    </div>`;
}

const UITSLAG_NOOT = `<p class="uitslag-klein">De maatstaf is Open-Meteo’s eigen terugblik op die dag: een analyse uit
  dezelfde modellen, geen regenmeter. Daarom doet Best Match niet mee. Alles blijft op dit apparaat.</p>`;

let uitslagGeladen = false;
// De modellen die het hier deze week het best deden (zie uitslag.js).
let beste = [];

async function laadUitslag() {
  let html;
  try {
    const [terugblik, mockHistorie] = await Promise.all([laadTerugblik(), laadMockHistorie()]);
    const dagen = beoordeel(mockHistorie ?? leesVerleden(), terugblik);
    beste = besteModellen(ranglijst(dagen));
    html = dagen.length
      ? podiumHtml(dagen[0]) + (dagen.length > 1 ? standHtml(dagen) : '') + UITSLAG_NOOT
      : `<div class="paneel"><p class="leeg">Morgen staat hier wie er vandaag het dichtst bij zat. De app bewaart
          elke verwachting op dit apparaat en legt die de volgende dag naast wat er werkelijk gebeurde.</p></div>`;
  } catch {
    html = `<div class="paneel"><p class="leeg">${
      leesVerleden().length
        ? 'De terugblik op de afgelopen dagen kon niet worden opgehaald. Probeer het later opnieuw met verversen.'
        : 'Morgen staat hier wie er vandaag het dichtst bij zat.'
    }</p></div>`;
  }
  el('uitslag-inhoud').innerHTML = html;
  el('uitslag').hidden = false;
  uitslagGeladen = true;
  // De kaart en de lijst tonen wie er deze week het best deed.
  if (beste.length && laatsteRender) render(laatsteRender.resultaten, laatsteRender.meta);
}

// Eén regel in de bovenste kaart: wat zeggen de modellen die het hier deze
// week het best deden? De mediaan erboven blijft die van alle modellen.
function besteHtml(resultaten) {
  if (beste.length < 2) return '';
  const v = verwachtingVan(
    resultaten,
    beste.map((b) => b.id)
  );
  if (!v || v.aantal < 2) return '';
  const namen = v.ids.map((id) => kortNaam(id));
  const lijst = `${namen.slice(0, -1).join(', ')} en ${namen.at(-1)}`;
  const temp =
    Math.round(v.laag * 2) === Math.round(v.hoog * 2)
      ? `${f.graden(v.laag)}°`
      : `${f.graden(v.laag)} tot ${f.graden(v.hoog)}°`;
  const regen = v.nat === 0 ? 'droog' : v.nat === v.aantal ? 'nat' : `${v.nat} van ${v.aantal} nat`;
  return `<p class="lucht-beste"><span class="lucht-medaille" aria-hidden="true">${pixelSvg(MEDAILLES[1])}</span>
      <span><strong>Beste deze week</strong> (${esc(lijst)}): ${esc(temp)}, ${esc(regen)}</span></p>`;
}

// Een medaille achter de naam in de lijst, voor de beste drie van de week.
function besteMerk(id) {
  const plek = beste.findIndex((b) => b.id === id);
  if (plek === -1) return '';
  return `<span class="beste-merk" title="${plek + 1}e deze week bij Wie had gelijk?">${pixelSvg(
    MEDAILLES[plek + 1]
  )}<span class="enkel-lezer">, ${plek + 1}e deze week</span></span>`;
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

  const figuur = FIGUREN[figuurVoor(m)];

  const merken = [
    m.anker ? '<span class="merk">anker</span>' : '',
    m.thuismodel ? '<span class="merk">thuismodel</span>' : '',
    m.ai ? '<span class="merk">AI-model</span>' : '',
    m.ensemble ? '<span class="merk">ensemble</span>' : ''
  ].join('');

  return `
<details class="model" data-status="${r.status}" id="model-${esc(r.id)}">
  <summary>
    ${
      PIXEL
        ? `<span class="vlag figuur-tegel" aria-hidden="true">${pixelSvg(figuur.rijen)}</span>`
        : `<span class="vlag" aria-hidden="true">${m.vlag}</span>`
    }
    <span class="model-titel">
      <span class="model-naam">${esc(m.naam).replace(/(\d) (km)\b/g, '$1&nbsp;$2')}${besteMerk(r.id)}</span>
      ${rijSubHtml(r, m, s)}
    </span>
    ${rijWaardeHtml(r)}
    <svg class="pijl" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.2 2.5 7.8 6l-3.6 3.5"/></svg>
  </summary>
  <div class="model-inhoud">
    <div class="figuur">
      <span class="figuur-tegel" aria-hidden="true">${pixelSvg(figuur.rijen)}</span>
      <p><strong>${esc(figuur.naam)}.</strong> ${esc(figuur.zin)}</p>
    </div>
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

// Het uur waarop het rooster voor het laatst de nu-markering kreeg.
let roosterUur = null;

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
  roosterUur = TARGET_DATE === datumVoor('vandaag') ? uurNu() : null;
  el('rooster-inhoud').innerHTML = uurRooster({ rijen, uren: VENSTER_UREN, meting, nuUur: roosterUur }) + noot;
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

// Voor welke dag er nu iets op het scherm staat.
let getoondVoor = null;

function render(resultaten, meta) {
  laatsteRender = { resultaten, meta };
  getoondVoor = TARGET_DATE;
  const sam = samenvatting(resultaten);

  const lucht = el('consensus');
  lucht.dataset.lucht = sam.oordeel ? meesteWeerbeeld(resultaten).naam : 'leeg';
  el('consensus-inhoud').innerHTML = consensusHtml(sam, resultaten);
  toonRegenNu();
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
  plaatsScene();

  const delen = [`bijgewerkt ${f.datumTijd(meta.opgehaaldOp)}`];
  if (meta.bijwerken) delen.push('nieuwe gegevens ophalen…');
  else if (meta.offline) delen.push('geen verbinding — laatst bekende gegevens');
  else if (meta.uitCache) delen.push('uit lokale cache');
  zetStatus(delen.join(' · '));
}

// ------------------------------------------------------ regen komend uur
// Alleen voor vandaag: een zin als "Droog tot 16:15" bovenin de kaart. Een
// kwartier oud is oud genoeg om opnieuw te vragen.

let regenNu = null;
let regenNuLaden = null;

function komendeRegen() {
  if (TARGET_DATE !== datumVoor('vandaag') || !regenNu) return null;
  return regenKomend(regenNu.kwartieren, tijdOpLocatie());
}

function toonRegenNu() {
  const p = el('lucht-nu');
  if (!p) return;
  const komend = komendeRegen();
  p.hidden = !komend;
  if (!komend) return;
  // Een volle druppel als het nu regent, een lege als het (nog) droog is.
  const druppel = `<svg class="lucht-klein" viewBox="0 0 24 24" aria-hidden="true"><path${
    komend.nat ? ' class="vol"' : ''
  } d="M12 3.5c3.2 4.2 5.5 7.4 5.5 10.2a5.5 5.5 0 0 1-11 0c0-2.8 2.3-6 5.5-10.2z"/></svg>`;
  p.innerHTML = `${druppel}<span><strong>${esc(komend.kop)}</strong>${komend.rest ? ` ${esc(komend.rest)}` : ''}</span>`;
}

function ververRegenNu() {
  if (regenNuLaden) return regenNuLaden;
  if (regenNu && Date.now() - regenNu.opgehaaldOp < 15 * 60 * 1000) return Promise.resolve();
  regenNuLaden = laadRegenNu()
    .then((kwartieren) => {
      regenNu = { kwartieren, opgehaaldOp: Date.now() };
    })
    .catch(() => {
      // Geen verbinding: dan zeggen we liever niets dan iets ouds.
      regenNu = null;
    })
    .finally(() => {
      regenNuLaden = null;
      toonRegenNu();
    });
  return regenNuLaden;
}

// Loopt er al een ophaal, dan wachten we die af in plaats van een tweede te starten.
let bezig = false;

function gegevensVerouderd() {
  const opgehaald = laatsteRender?.meta?.opgehaaldOp;
  return !bezig && !!opgehaald && Date.now() - new Date(opgehaald).getTime() >= CACHE_TTL_MS;
}

async function laad({ forceer = false } = {}) {
  const beurt = ++laadBeurt;
  const knop = el('verversen');
  knop.disabled = true;
  knop.classList.add('draait');
  bezig = true;
  zetStatus('verwachtingen ophalen…');
  if (forceer) regenNu = null;
  if (TARGET_DATE === datumVoor('vandaag')) ververRegenNu();
  // Staat er nog niets op het scherm voor deze dag, dan meteen wat er van de
  // vorige keer bewaard is, ook als het ouder is dan een half uur: liever iets
  // te zien terwijl de 22 modellen antwoorden dan een lege kaart.
  const oud = !forceer && getoondVoor !== TARGET_DATE ? oudeVerwachtingen() : null;
  if (oud && Date.now() - new Date(oud.opgehaaldOp).getTime() >= CACHE_TTL_MS) {
    render(oud.resultaten, { opgehaaldOp: oud.opgehaaldOp, uitCache: true, bijwerken: true, historie: leesHistorie() });
  }
  try {
    const { resultaten, perDag, opgehaaldOp, uitCache, offline } = await laadVerwachtingen({ forceer });
    // Een verse ophaal bevat vandaag én morgen; beide gaan de trend in, welke
    // dag je ook bekijkt.
    if (!uitCache) Object.entries(perDag).forEach(([datum, res]) => bewaarMeting(res, datum));
    if (beurt !== laadBeurt) return;
    render(resultaten, { opgehaaldOp, uitCache, offline, historie: leesHistorie() });
    // Na een verse ophaal kan er een nieuwe voorbije dag te beoordelen zijn.
    if (forceer || !uitslagGeladen) laadUitslag();
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
      bezig = false;
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

// ------------------------------------------------------------------- 8-bit
// Een paasei: tik vijf keer op HEERLEN (of toets de Konami-code) en de app gaat
// over op pixels. De grote letters worden een pixelletter, de iconen pixelkunst,
// de vlaggen in de lijst de figuren van de modellen, en achter de bovenste kaart
// verschijnt Heerlen in pixels, met het weer van de modellen erin.

const MODUS_SLEUTEL = 'weer-op-locatie:8bit';
const is8bit = () => document.documentElement.dataset.modus === '8bit';
let scene = null;
let sceneDoek = null;
let meldingKlok = null;

function meld(tekst) {
  const melding = el('melding');
  melding.textContent = tekst;
  melding.classList.add('zichtbaar');
  clearTimeout(meldingKlok);
  meldingKlok = setTimeout(() => melding.classList.remove('zichtbaar'), 3200);
}

// De scène vult de bovenkant van de kaart tot vlak boven de stippenstrip; de
// strip schuift zoveel omlaag dat de skyline ertussen past.
function plaatsScene() {
  if (!scene) return;
  const lucht = el('consensus');
  const koor = lucht.querySelector('.koor');
  if (!is8bit() || !koor) {
    sceneDoek.hidden = true;
    scene.speel(false);
    return;
  }
  sceneDoek.hidden = false;
  const breedte = lucht.clientWidth;
  // Een liggende telefoon is breed maar laag: daar blijven de pixels klein,
  // anders vult de skyline het halve scherm.
  const laag = matchMedia('(orientation: landscape) and (max-height: 540px)').matches;
  const schaal = breedte >= 600 && !laag ? 3 : 2;
  // Het hoogste gebouw (de kerk, 57 pixels) plus de straat, en wat lucht.
  lucht.style.setProperty('--skyline', `${(57 + 14 + 3) * schaal + 8}px`);
  // Gemeten vanaf de kaart zelf: offsetTop zou vanaf het binnenvak tellen.
  const tot = koor.getBoundingClientRect().top - lucht.getBoundingClientRect().top;
  scene.maat({ breedte, hoogte: tot - 6, schaal });
  scene.zetWeer(lucht.dataset.lucht);
  scene.speel(true);
}

// De scène is ruim de helft van alle code; die halen we pas op als iemand de
// 8-bitmodus aanzet.
let sceneLaden = null;
function laadScene() {
  sceneLaden ??= import('./scene.js')
    .then(({ maakScene }) => {
      sceneDoek = document.createElement('canvas');
      sceneDoek.className = 'lucht-scene';
      sceneDoek.setAttribute('aria-hidden', 'true');
      el('consensus').prepend(sceneDoek);
      scene = maakScene(sceneDoek);
      plaatsScene();
    })
    .catch(() => {
      // Niet te laden (offline en nog nooit opgehaald): volgende keer opnieuw.
      sceneLaden = null;
    });
  return sceneLaden;
}

function zet8bit(aan, { melden = true } = {}) {
  if (aan) document.documentElement.dataset.modus = '8bit';
  else delete document.documentElement.dataset.modus;
  zetPixel(aan);
  try {
    if (aan) localStorage.setItem(MODUS_SLEUTEL, '1');
    else localStorage.removeItem(MODUS_SLEUTEL);
  } catch {
    // Niet kunnen onthouden: dan geldt hij alleen voor dit bezoek.
  }
  if (aan) laadScene();
  if (laatsteRender) render(laatsteRender.resultaten, laatsteRender.meta);
  else plaatsScene();
  if (melden) {
    meld(aan ? `8-bit aan. Tik nog eens vijf keer op ${LOCATION.naam.toUpperCase()} om terug te gaan.` : '8-bit uit.');
  }
}

function zet8bitOp() {
  let tikken = [];
  el('plaats').addEventListener('click', () => {
    const nu = Date.now();
    tikken = [...tikken.filter((t) => nu - t < 2500), nu];
    if (tikken.length >= 5) {
      tikken = [];
      zet8bit(!is8bit());
    }
  });
  const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let stap = 0;
  document.addEventListener('keydown', (e) => {
    const toets = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    // Een extra pijl omhoog aan het begin mag: twee keer omhoog blijft twee keer omhoog.
    if (toets === code[stap]) stap++;
    else if (toets === code[0]) stap = stap === 2 ? 2 : 1;
    else stap = 0;
    if (stap === code.length) {
      stap = 0;
      zet8bit(!is8bit());
    }
  });
  let bewaard = false;
  try {
    bewaard = localStorage.getItem(MODUS_SLEUTEL) === '1';
  } catch {
    // Zonder opslag begint de app gewoon zonder pixels.
  }
  if (bewaard) zet8bit(true, { melden: false });
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

// ------------------------------------------------------------ nieuwe versie
// Wie de app opent, krijgt van de service worker altijd de nieuwste versie.
// Maar een app op het beginscherm van de iPhone begint niet opnieuw als je hem
// terughaalt; hij gaat verder waar hij was. Daarom vraagt de pagina dan aan de
// service worker of er intussen iets nieuws staat, en biedt hem onderin aan.
// Onderaan de pagina kun je ook altijd zelf opnieuw laden.

let nieuweVersie = false;

function controleerVersie() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.controller?.postMessage('controleer');
  // Ook de service worker zelf kan nieuw zijn; normaal kijkt de browser daar
  // pas naar bij de volgende keer openen.
  navigator.serviceWorker
    .getRegistration()
    .then((r) => r?.update())
    .catch(() => {});
}

function zetVersieOp() {
  const herlaad = () => location.reload();
  el('herladen').addEventListener('click', herlaad);
  el('versie-laden').addEventListener('click', herlaad);

  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data !== 'nieuwe-versie') return;
    nieuweVersie = true;
    el('nieuwe-versie').hidden = false;
  });

  // Niet bij elk trekje aan het berichtencentrum; eens per minuut is genoeg.
  let laatst = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - laatst < 60_000) return;
    laatst = Date.now();
    controleerVersie();
  });

  navigator.serviceWorker.register('./sw.js').catch(() => {
    // Zonder service worker werkt de app gewoon, alleen niet offline.
  });
}

// ----------------------------------------------------------------------- start

function start() {
  vulKop();
  zetTooltipOp();
  zetBalkOp();
  zetModelLinksOp();
  zetPlekkenOp();
  zet8bitOp();

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
  el('consensus').addEventListener('click', (e) => {
    if (e.target.closest('[data-actie="delen"]')) deel();
  });
  el('verversen').addEventListener('click', () => {
    // Staat er een nieuwe versie klaar, dan is opnieuw laden de beste verversing.
    if (nieuweVersie) return location.reload();
    laad({ forceer: true });
    controleerVersie();
  });

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

  // Een app op het beginscherm gaat verder waar hij was als je hem terughaalt.
  // Is 'vandaag' intussen een andere dag, of zijn de gegevens ouder dan een
  // half uur, dan halen we ze opnieuw op; ook als hij al die tijd openstaat.
  const bijwerken = () => {
    if (document.visibilityState !== 'visible') return;
    if (datumVoor(DAG) !== TARGET_DATE) wisselDag(DAG);
    else if (gegevensVerouderd()) laad();
    else if (roosterUur !== null && uurNu() !== roosterUur) renderRooster(laatsteResultaten);
    if (TARGET_DATE === datumVoor('vandaag')) ververRegenNu();
    toonRegenNu();
  };
  document.addEventListener('visibilitychange', bijwerken);
  setInterval(bijwerken, 5 * 60 * 1000);

  laad();
  zetVersieOp();
}

start();

// Opbouw van de pagina. Haalt de verwachtingen op, rekent de spreiding uit en
// zet alles op het scherm.

import { LOCATION, TARGET_DATE } from './config.js';
import { GROEPEN, MODELLEN } from './models.js';
import { laadVerwachtingen } from './api.js';
import { samenvatting } from './stats.js';
import { puntenWolk, trendLijn, uurGrafiek } from './charts.js';
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

function legendaHtml(resultaten) {
  const aanwezig = new Set(
    resultaten.filter((r) => r.status === 'ok').map((r) => modellenPerId[r.id].groep)
  );
  return Object.entries(GROEPEN)
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

// -------------------------------------------------------------------- tekenen

function render(resultaten, meta) {
  const sam = samenvatting(resultaten);

  el('consensus-inhoud').innerHTML = consensusHtml(sam);
  el('legenda').innerHTML = legendaHtml(resultaten);
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

// Alle grafiek-SVG wordt hier met de hand opgebouwd. Geen bibliotheek, geen CDN:
// een puntenwolk en een lijntje zijn minder code dan de laadtijd van een chartlib,
// en het blijft werken zolang de browser SVG kan tekenen.
//
// Vormafspraken die overal gelden: lijnen 2 px, markers minstens 8 px doorsnee met
// een 2 px ring in de achtergrondkleur zodat ze leesbaar blijven waar ze elkaar
// raken, staven maximaal 24 px dik met een afgeronde bovenkant, en assen en
// rasterlijnen als haarlijn in een terugtredend grijs.

import { GROEPEN } from './models.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function nettePunten(min, max, aantal = 5) {
  const span = max - min || 1;
  const grofStap = span / aantal;
  const grootte = Math.pow(10, Math.floor(Math.log10(grofStap)));
  const genormaliseerd = grofStap / grootte;
  const stap = (genormaliseerd <= 1 ? 1 : genormaliseerd <= 2 ? 2 : genormaliseerd <= 5 ? 5 : 10) * grootte;
  const start = Math.floor(min / stap) * stap;
  const eind = Math.ceil(max / stap) * stap;
  const punten = [];
  for (let v = start; v <= eind + 1e-9; v += stap) punten.push(Number(v.toPrecision(12)));
  return { punten, start, eind };
}

/** Verdeelt de punten over rijen zodat overlappende stippen elkaar niet bedekken. */
function verdeelInRijen(punten, x, minAfstand) {
  const rijen = [];
  const gesorteerd = [...punten].sort((a, b) => a.waarde - b.waarde);
  for (const p of gesorteerd) {
    const px = x(p.waarde);
    let rij = rijen.findIndex((r) => px - r.laatsteX >= minAfstand);
    if (rij === -1) {
      rijen.push({ laatsteX: px, punten: [] });
      rij = rijen.length - 1;
    }
    rijen[rij].laatsteX = px;
    rijen[rij].punten.push({ ...p, x: px, rij });
  }
  return rijen;
}

function vorm(soort, x, y, kleurVar) {
  const gedeeld = `fill="var(${kleurVar})" stroke="var(--surface-1)" stroke-width="2"`;
  if (soort === 'vierkant') return `<rect x="${(x - 5).toFixed(1)}" y="${(y - 5).toFixed(1)}" width="10" height="10" rx="1.5" ${gedeeld}/>`;
  if (soort === 'ruit')
    return `<rect x="${(x - 4.8).toFixed(1)}" y="${(y - 4.8).toFixed(1)}" width="9.6" height="9.6" rx="1" ${gedeeld} transform="rotate(45 ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" ${gedeeld}/>`;
}

/**
 * Puntenwolk: elk model één stip op een gedeelde as, met de mediaan als lijn en
 * de middelste helft van de modellen als grijze band. Dit is de grafiek die de
 * vraag "hoe eens zijn ze het" in één blik beantwoordt.
 */
export function puntenWolk({ paren, modellen, verdeling, formatter, label, breedte = 760, minimumNul = false }) {
  if (!verdeling || !paren.length) {
    return `<p class="leeg">Nog geen model met een waarde voor deze dag.</p>`;
  }

  const padLinks = 14;
  const padRechts = 14;
  const padBoven = 30;
  const asHoogte = 28;
  const plotBreedte = breedte - padLinks - padRechts;

  // Bij grootheden die niet negatief kunnen (neerslag) begint de as bij nul:
  // een as met "−5 mm regen" erop is onzin, ook al past het rekenkundig.
  const marge = (verdeling.bereik || 1) * 0.12;
  const ondergrens = minimumNul ? Math.max(0, verdeling.min - marge) : verdeling.min - marge;
  const { punten: ticks, start, eind } = nettePunten(ondergrens, verdeling.max + marge, 5);
  const x = (v) => padLinks + ((v - start) / (eind - start || 1)) * plotBreedte;

  const rijen = verdeelInRijen(paren, x, 15);
  const rijHoogte = 17;
  const plotHoogte = Math.max(rijen.length, 1) * rijHoogte;
  const hoogte = padBoven + plotHoogte + asHoogte;
  const asY = padBoven + plotHoogte + 6;

  const bandX = x(verdeling.p25);
  const bandBreedte = Math.max(x(verdeling.p75) - bandX, 2);
  const medX = x(verdeling.mediaan);

  // Het medianelabel mag niet buiten het vlak vallen: staat de mediaan tegen een
  // rand aan, dan verankeren we de tekst aan die rand in plaats van hem te centreren.
  const labelAnker = medX < 70 ? 'start' : medX > breedte - 70 ? 'end' : 'middle';
  const labelX = labelAnker === 'start' ? padLinks : labelAnker === 'end' ? breedte - padRechts : medX;

  const stippen = rijen
    .flatMap((r) => r.punten)
    .map((p) => {
      const m = modellen[p.id];
      const groep = GROEPEN[m.groep];
      const y = padBoven + plotHoogte - p.rij * rijHoogte - rijHoogte / 2;
      const tekst = `${m.naam}: ${formatter(p.waarde)}`;
      return `<g class="stip" data-tip="${esc(tekst)}" data-model="${esc(p.id)}"><title>${esc(tekst)}</title>${vorm(
        groep.vorm,
        x(p.waarde),
        y,
        `--serie-${groep.serie}`
      )}</g>`;
    })
    .join('');

  const asTicks = ticks
    .map(
      (t) =>
        `<line class="raster" x1="${x(t).toFixed(1)}" y1="${padBoven - 8}" x2="${x(t).toFixed(1)}" y2="${asY}"/>` +
        `<text class="tick" x="${x(t).toFixed(1)}" y="${asY + 16}" text-anchor="middle">${esc(formatter(t))}</text>`
    )
    .join('');

  const laagste = modellen[paren.reduce((a, b) => (a.waarde <= b.waarde ? a : b)).id].naam;
  const hoogste = modellen[paren.reduce((a, b) => (a.waarde >= b.waarde ? a : b)).id].naam;

  const omschrijving =
    `${label}: ${verdeling.aantal} modellen, mediaan ${formatter(verdeling.mediaan)}, ` +
    `laagste ${formatter(verdeling.min)} (${laagste}), hoogste ${formatter(verdeling.max)} (${hoogste}).`;

  return `
<svg class="wolk" viewBox="0 0 ${breedte} ${hoogte}" role="img" aria-label="${esc(omschrijving)}" preserveAspectRatio="xMidYMid meet">
  <title>${esc(label)}</title><desc>${esc(omschrijving)}</desc>
  <rect class="band" x="${bandX.toFixed(1)}" y="${padBoven - 8}" width="${bandBreedte.toFixed(1)}" height="${plotHoogte + 14}" rx="3"/>
  ${asTicks}
  <line class="mediaan" x1="${medX.toFixed(1)}" y1="${padBoven - 12}" x2="${medX.toFixed(1)}" y2="${asY}"/>
  <text class="mediaan-label" x="${labelX.toFixed(1)}" y="${padBoven - 18}" text-anchor="${labelAnker}">mediaan ${esc(
    formatter(verdeling.mediaan)
  )}</text>
  <line class="as" x1="${padLinks}" y1="${asY}" x2="${breedte - padRechts}" y2="${asY}"/>
  ${stippen}
</svg>
<p class="wolk-uitleg">Laagste: <strong>${esc(laagste)}</strong> ${esc(formatter(verdeling.min))} · hoogste:
<strong>${esc(hoogste)}</strong> ${esc(formatter(verdeling.max))} · de grijze band is de middelste helft van de modellen.</p>`;
}

/**
 * Uurverloop voor de gekozen dag: twee panelen onder elkaar met dezelfde tijdas.
 * Bewust twee panelen en geen twee y-assen in één vlak — twee schalen over
 * elkaar heen laat je een verband zien dat er niet is.
 */
export function uurGrafiek(uren, { breedte = 760 } = {}) {
  const metTemp = uren.filter((u) => u.temp !== null);
  if (!metTemp.length) return `<p class="leeg">Dit model levert geen uurwaarden voor deze dag.</p>`;

  const padLinks = 34;
  const padRechts = 12;
  const plotBreedte = breedte - padLinks - padRechts;
  const tempHoogte = 84;
  const tussen = 26;
  const neerslagHoogte = 52;
  const asHoogte = 24;
  const tempTop = 18;
  const neerslagTop = tempTop + tempHoogte + tussen;
  const hoogte = neerslagTop + neerslagHoogte + asHoogte;

  const uurX = (u) => padLinks + ((u + 0.5) / 24) * plotBreedte;

  const temps = metTemp.map((u) => u.temp);
  const { punten: tempTicks, start: tStart, eind: tEind } = nettePunten(Math.min(...temps), Math.max(...temps), 3);
  const tempY = (v) => tempTop + tempHoogte - ((v - tStart) / (tEind - tStart || 1)) * tempHoogte;

  const neerslagen = uren.map((u) => u.neerslag ?? 0);
  const heeftNeerslag = Math.max(...neerslagen) > 0;
  const nMax = Math.max(1, Math.ceil(Math.max(...neerslagen) * 1.15));
  const neerslagY = (v) => neerslagTop + neerslagHoogte - (v / nMax) * neerslagHoogte;

  const lijn = metTemp.map((u) => `${uurX(u.uur).toFixed(1)},${tempY(u.temp).toFixed(1)}`).join(' ');
  const vlak =
    `${padLinks + ((metTemp[0].uur + 0.5) / 24) * plotBreedte},${tempTop + tempHoogte} ` +
    lijn +
    ` ${uurX(metTemp.at(-1).uur).toFixed(1)},${tempTop + tempHoogte}`;

  const bandBreedte = plotBreedte / 24;
  const staafBreedte = Math.min(24, bandBreedte - 2);
  const staven = uren
    .map((u) => {
      const v = u.neerslag ?? 0;
      if (v <= 0) return '';
      const y = neerslagY(v);
      const h = neerslagTop + neerslagHoogte - y;
      const x = uurX(u.uur) - staafBreedte / 2;
      const r = Math.min(4, staafBreedte / 2, h);
      const tekst = `${String(u.uur).padStart(2, '0')}:00 — ${v.toFixed(1).replace('.', ',')} mm`;
      return `<g class="staaf" data-tip="${esc(tekst)}"><title>${esc(tekst)}</title><path d="M${x.toFixed(1)},${(
        neerslagTop + neerslagHoogte
      ).toFixed(1)} L${x.toFixed(1)},${(y + r).toFixed(1)} Q${x.toFixed(1)},${y.toFixed(1)} ${(x + r).toFixed(
        1
      )},${y.toFixed(1)} L${(x + staafBreedte - r).toFixed(1)},${y.toFixed(1)} Q${(x + staafBreedte).toFixed(
        1
      )},${y.toFixed(1)} ${(x + staafBreedte).toFixed(1)},${(y + r).toFixed(1)} L${(x + staafBreedte).toFixed(1)},${(
        neerslagTop + neerslagHoogte
      ).toFixed(1)} Z"/></g>`;
    })
    .join('');

  const tempAs = tempTicks
    .map(
      (t) =>
        `<line class="raster" x1="${padLinks}" y1="${tempY(t).toFixed(1)}" x2="${breedte - padRechts}" y2="${tempY(
          t
        ).toFixed(1)}"/>` +
        `<text class="tick" x="${padLinks - 6}" y="${(tempY(t) + 4).toFixed(1)}" text-anchor="end">${t}°</text>`
    )
    .join('');

  const tijdAs = [0, 3, 6, 9, 12, 15, 18, 21]
    .map(
      (u) =>
        `<text class="tick" x="${uurX(u).toFixed(1)}" y="${(neerslagTop + neerslagHoogte + 18).toFixed(
          1
        )}" text-anchor="middle">${String(u).padStart(2, '0')}</text>`
    )
    .join('');

  const punten = metTemp
    .map((u) => {
      const tekst = `${String(u.uur).padStart(2, '0')}:00 — ${u.temp.toFixed(1).replace('.', ',')} °C`;
      return `<g class="uurpunt" data-tip="${esc(tekst)}"><title>${esc(
        tekst
      )}</title><circle cx="${uurX(u.uur).toFixed(1)}" cy="${tempY(u.temp).toFixed(1)}" r="2.5"/></g>`;
    })
    .join('');

  return `
<svg class="uren" viewBox="0 0 ${breedte} ${hoogte}" role="img" aria-label="Uurverloop van temperatuur en neerslag" preserveAspectRatio="xMidYMid meet">
  <text class="svg-titel" x="${padLinks}" y="10">Temperatuur</text>
  ${tempAs}
  <polygon class="vlak" points="${vlak}"/>
  <polyline class="lijn" points="${lijn}"/>
  ${punten}
  <text class="svg-titel" x="${padLinks}" y="${neerslagTop - 8}">${
    heeftNeerslag ? `Neerslag per uur — tot ${nMax} mm` : 'Neerslag per uur — dit model houdt het droog'
  }</text>
  <line class="as" x1="${padLinks}" y1="${neerslagTop + neerslagHoogte}" x2="${breedte - padRechts}" y2="${
    neerslagTop + neerslagHoogte
  }"/>
  ${staven}
  ${tijdAs}
</svg>`;
}

/** Klein trendlijntje: hoe schoof de mediaan de afgelopen ophalen? */
export function trendLijn(punten, { breedte = 132, hoogte = 34 } = {}) {
  if (punten.length < 2) return '';
  const waarden = punten.map((p) => p.waarde);
  const min = Math.min(...waarden);
  const max = Math.max(...waarden);
  const x = (i) => 3 + (i / (punten.length - 1)) * (breedte - 6);
  const y = (v) => hoogte - 5 - ((v - min) / (max - min || 1)) * (hoogte - 12);
  const pad = punten.map((p, i) => `${x(i).toFixed(1)},${y(p.waarde).toFixed(1)}`).join(' ');
  const laatste = punten.at(-1);
  return `<svg class="trend" viewBox="0 0 ${breedte} ${hoogte}" role="img" aria-label="Verloop van de mediaan over de laatste ophalen" preserveAspectRatio="none">
  <polyline class="trend-lijn" points="${pad}"/>
  <circle class="trend-punt" cx="${x(punten.length - 1).toFixed(1)}" cy="${y(laatste.waarde).toFixed(1)}" r="4"/>
</svg>`;
}

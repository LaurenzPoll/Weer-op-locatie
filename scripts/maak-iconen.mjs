// Maakt de app-iconen als PNG, zonder externe pakketten: node heeft zlib aan
// boord en een PNG is niet meer dan een paar blokken met een CRC erachter.
//
//   node scripts/maak-iconen.mjs
//
// Een gewoon weericoon, getekend zoals de pagina zelf: de blauwe lucht van de
// bovenste kaart met gloed rond de zon, het zonnetje en de wolk uit iconen.js.
// De kleine twist: elke regendruppel heeft een eigen kleur, zoals elk model zijn
// eigen bui voorspelt. Er staat geen plaatsnaam in, dus het past bij elke plek.
// De tekening staat hieronder één keer beschreven en wordt zowel als PNG
// gerasterd als als SVG geschreven.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

// ------------------------------------------------------------------ tekening
// Alles in een vak van 100 × 100.

const WIT = [0xff, 0xff, 0xff];
const ZON = [0xff, 0xd3, 0x5c]; // --zon op de lucht
const RAND = [0x0a, 0x14, 0x28]; // een dun donker randje, zodat de druppels loskomen van de lucht

// De lucht bij 'zon': een verloop onder 168°, met een warme gloed rond de zon.
const LUCHT_A = [0x15, 0x4f, 0xae];
const LUCHT_B = [0x2a, 0x72, 0xc8];
const GLOED = [0xff, 0xc4, 0x54];

const ZON_MIDDEN = { x: 36, y: 30, r: 14 };

// De wolk uit iconen.js (een vak van 24), vergroot en naar rechtsonder.
const WOLK = { x: 3, y: -1, schaal: 3.9 };

// Drie druppels, elk in zijn eigen kleur en op zijn eigen hoogte: regen zoals
// op de pagina, en de oranje en groene van de andere modelgroepen.
const DRUPPELS = [
  { x: 38, y: 74, kleur: [0xb5, 0xd7, 0xff] },
  { x: 52, y: 79, kleur: [0xf0, 0x8a, 0x5d] },
  { x: 66, y: 74, kleur: [0x3c, 0xcf, 0x6a] }
];
const DRUPPEL = { hoog: 8.2, r: 4.4 };

const effen = (kleur, dekking = 1) => ({ kleur, dekking });

// Een druppel: een punt bovenaan, met rechte flanken die raken aan het bolletje.
function druppelPad(x, y, rand = 0) {
  const r = DRUPPEL.r + rand;
  const top = y - rand * 1.6;
  const cy = y + DRUPPEL.hoog;
  const afstand = cy - top;
  const hoek = Math.asin(r / afstand); // tussen de flank en de verticaal
  const punten = [[x, top]];
  // Van het rechter raakpunt, onderlangs, naar het linker.
  const van = -Math.PI / 2 + (Math.PI / 2 - hoek);
  const tot = (3 * Math.PI) / 2 - (Math.PI / 2 - hoek);
  for (let i = 0; i <= 32; i++) {
    const a = van + ((tot - van) * i) / 32;
    punten.push([x + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return `M${punten.map(([px, py]) => `${px.toFixed(2)} ${py.toFixed(2)}`).join('L')}Z`;
}

function tekening() {
  // CSS-verloop onder 168°: de lijn loopt door het midden, zo lang dat de
  // hoeken precies op 0 en 1 vallen.
  const hoek = (168 * Math.PI) / 180;
  const [dx, dy] = [Math.sin(hoek), -Math.cos(hoek)];
  const lengte = Math.abs(100 * dx) + Math.abs(100 * dy);
  const lucht = {
    lineair: {
      van: [50 - (dx * lengte) / 2, 50 - (dy * lengte) / 2],
      tot: [50 + (dx * lengte) / 2, 50 + (dy * lengte) / 2]
    },
    stops: [
      [0, LUCHT_A, 1],
      [1, LUCHT_B, 1]
    ]
  };
  const z = ZON_MIDDEN;
  const gloed = {
    radiaal: { cx: z.x, cy: z.y, rx: 46, ry: 46 },
    stops: [
      [0, GLOED, 0.5],
      [1, GLOED, 0]
    ]
  };
  const w = WOLK;
  const wx = (u) => w.x + u * w.schaal;
  const wy = (u) => w.y + u * w.schaal;

  return [
    { vorm: 'rect', x: 0, y: 0, b: 100, h: 100, verf: lucht, achtergrond: true },
    // De gloed vult het hele vak, maar schuift in het maskable icoon mee met de zon.
    { vorm: 'rect', x: 0, y: 0, b: 100, h: 100, verf: gloed, vult: true },
    { vorm: 'cirkel', x: z.x, y: z.y, r: z.r, verf: effen(ZON) },
    ...Array.from({ length: 8 }, (_, k) => {
      const a = (k * Math.PI) / 4;
      return {
        vorm: 'lijn',
        x1: z.x + Math.cos(a) * (z.r + 5),
        y1: z.y + Math.sin(a) * (z.r + 5),
        x2: z.x + Math.cos(a) * (z.r + 10),
        y2: z.y + Math.sin(a) * (z.r + 10),
        dikte: 4.2,
        verf: effen(ZON)
      };
    }),
    { vorm: 'cirkel', x: wx(9.4), y: wy(12.6), r: 3.7 * w.schaal, verf: effen(WIT) },
    { vorm: 'cirkel', x: wx(14.4), y: wy(11.6), r: 4.5 * w.schaal, verf: effen(WIT) },
    {
      vorm: 'rect',
      x: wx(5.7),
      y: wy(13.4),
      b: 12.9 * w.schaal,
      h: 4.9 * w.schaal,
      r: 2.45 * w.schaal,
      verf: effen(WIT)
    },
    ...DRUPPELS.flatMap((d) => [
      { vorm: 'pad', d: druppelPad(d.x, d.y, 0.5), verf: effen(RAND, 0.25) },
      { vorm: 'pad', d: druppelPad(d.x, d.y), verf: effen(d.kleur) }
    ])
  ];
}

// ------------------------------------------------------------------- vormen
// Elke vorm wordt een of meer veelhoeken; de rasteraar vult die met de
// nonzero-regel, net als SVG.

function boog(cx, cy, r, van, tot, stappen) {
  const punten = [];
  for (let i = 0; i <= stappen; i++) {
    const a = van + ((tot - van) * i) / stappen;
    punten.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return punten;
}

const stappenVoor = (r, schaal) => Math.max(8, Math.ceil((r * schaal) / 1.5));

function veelhoeken(v, schaal) {
  if (v.vorm === 'cirkel') return [boog(v.x, v.y, v.r, 0, 2 * Math.PI, 4 * stappenVoor(v.r, schaal))];
  if (v.vorm === 'rect') {
    const [lb, rb, ro, lo] = Array.isArray(v.r) ? v.r : [v.r ?? 0, v.r ?? 0, v.r ?? 0, v.r ?? 0];
    const h = Math.PI / 2;
    const hoek = (cx, cy, r, van) => (r ? boog(cx, cy, r, van, van + h, stappenVoor(r, schaal)) : [[cx, cy]]);
    return [
      [
        ...hoek(v.x + lb, v.y + lb, lb, 2 * h),
        ...hoek(v.x + v.b - rb, v.y + rb, rb, 3 * h),
        ...hoek(v.x + v.b - ro, v.y + v.h - ro, ro, 0),
        ...hoek(v.x + lo, v.y + v.h - lo, lo, h)
      ]
    ];
  }
  if (v.vorm === 'lijn') {
    // Een lijn met ronde kapjes: twee halve cirkels aan elkaar.
    const r = v.dikte / 2;
    const a = Math.atan2(v.y2 - v.y1, v.x2 - v.x1);
    const n = stappenVoor(r, schaal) * 2;
    return [
      [
        ...boog(v.x2, v.y2, r, a - Math.PI / 2, a + Math.PI / 2, n),
        ...boog(v.x1, v.y1, r, a + Math.PI / 2, a + (3 * Math.PI) / 2, n)
      ]
    ];
  }
  if (v.vorm === 'pad') {
    // Alleen wat het lettertype gebruikt: M, L, Q en Z, absoluut.
    const delen = [];
    let huidig = null;
    let [px, py] = [0, 0];
    const getallen = (s) =>
      s
        .trim()
        .split(/[\s,]+/)
        .map(Number);
    for (const [, op, rest] of v.d.matchAll(/([MLQZ])([^MLQZ]*)/g)) {
      const g = getallen(rest);
      if (op === 'M') delen.push((huidig = [[(px = g[0]), (py = g[1])]]));
      else if (op === 'L') huidig.push([(px = g[0]), (py = g[1])]);
      else if (op === 'Q') {
        for (let i = 1; i <= 8; i++) {
          const t = i / 8;
          const u = 1 - t;
          huidig.push([u * u * px + 2 * u * t * g[0] + t * t * g[2], u * u * py + 2 * u * t * g[1] + t * t * g[3]]);
        }
        [px, py] = [g[2], g[3]];
      }
    }
    return delen;
  }
  throw new Error(`onbekende vorm ${v.vorm}`);
}

// Kleur en dekking van een verf op een punt.
function verfOp(verf, x, y) {
  if (verf.kleur) return [verf.kleur, verf.dekking];
  let t;
  if (verf.lineair) {
    const { van, tot } = verf.lineair;
    const [dx, dy] = [tot[0] - van[0], tot[1] - van[1]];
    t = ((x - van[0]) * dx + (y - van[1]) * dy) / (dx * dx + dy * dy);
  } else {
    const { cx, cy, rx, ry } = verf.radiaal;
    t = Math.hypot((x - cx) / rx, (y - cy) / ry);
  }
  const stops = verf.stops;
  if (t <= stops[0][0]) return [stops[0][1], stops[0][2]];
  for (let i = 1; i < stops.length; i++) {
    const [t1, k1, a1] = stops[i];
    const [t0, k0, a0] = stops[i - 1];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0);
      // Zoals in CSS: kleuren mengen met voorvermenigvuldigde dekking.
      const a = a0 + (a1 - a0) * f;
      const k = k0.map((w, j) => (a ? (w * a0 + (k1[j] * a1 - w * a0) * f) / a : w));
      return [k, a];
    }
  }
  const laatste = stops[stops.length - 1];
  return [laatste[1], laatste[2]];
}

// ------------------------------------------------------------------ raster

const N = 4; // 4 × 4 monsters per pixel, zodat de randen niet trapperig worden

// inzet: 1 voor het gewone icoon; kleiner voor een maskable icoon, waar Android
// er een cirkel of druppel uit kan knippen.
function raster(maat, inzet = 1) {
  const m = maat * N;
  const beeld = new Float32Array(m * m * 3);
  const schaal = m / 100;
  for (const v of tekening()) {
    // De achtergrond vult altijd het hele vak; de rest krimpt naar het midden.
    const fVorm = v.achtergrond || v.vult ? 1 : inzet;
    const f = v.achtergrond ? 1 : inzet;
    const naarBeeld = ([x, y]) => [(50 + (x - 50) * fVorm) * schaal, (50 + (y - 50) * fVorm) * schaal];
    const randen = [];
    for (const veelhoek of veelhoeken(v, schaal * fVorm)) {
      const p = veelhoek.map(naarBeeld);
      for (let i = 0; i < p.length; i++) randen.push([p[i], p[(i + 1) % p.length]]);
    }
    for (let sy = 0; sy < m; sy++) {
      const y = sy + 0.5;
      const kruisingen = [];
      for (const [[x0, y0], [x1, y1]] of randen) {
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          kruisingen.push([x0 + ((y - y0) / (y1 - y0)) * (x1 - x0), y1 > y0 ? 1 : -1]);
        }
      }
      if (!kruisingen.length) continue;
      kruisingen.sort((a, b) => a[0] - b[0]);
      let winding = 0;
      for (let i = 0; i < kruisingen.length - 1; i++) {
        winding += kruisingen[i][1];
        if (!winding) continue;
        const van = Math.max(0, Math.ceil(kruisingen[i][0] - 0.5));
        const tot = Math.min(m - 1, Math.ceil(kruisingen[i + 1][0] - 0.5) - 1);
        for (let sx = van; sx <= tot; sx++) {
          // Terug naar het vak van 100 om de verf te bepalen.
          const [k, a] = verfOp(v.verf, 50 + ((sx + 0.5) / schaal - 50) / f, 50 + (y / schaal - 50) / f);
          const o = (sy * m + sx) * 3;
          for (let j = 0; j < 3; j++) beeld[o + j] += (k[j] - beeld[o + j]) * a;
        }
      }
    }
  }

  // Terugschalen: het gemiddelde van elk blok monsters is één pixel.
  const pixels = Buffer.alloc(maat * maat * 4);
  for (let py = 0; py < maat; py++) {
    for (let px = 0; px < maat; px++) {
      const som = [0, 0, 0];
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const o = ((py * N + j) * m + px * N + i) * 3;
          for (let q = 0; q < 3; q++) som[q] += beeld[o + q];
        }
      }
      const o = (py * maat + px) * 4;
      for (let q = 0; q < 3; q++) pixels[o + q] = Math.round(som[q] / (N * N));
      pixels[o + 3] = 0xff; // dicht: iOS maakt doorzichtige pixels zwart
    }
  }
  return pixels;
}

// --------------------------------------------------------------------- PNG

const crcTabel = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = crcTabel[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function blok(type, data) {
  const lengte = Buffer.alloc(4);
  lengte.writeUInt32BE(data.length);
  const inhoud = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(inhoud));
  return Buffer.concat([lengte, inhoud, crc]);
}

function png(maat, inzet) {
  const pixels = raster(maat, inzet);
  const rijen = [];
  for (let y = 0; y < maat; y++) {
    const rij = Buffer.alloc(1 + maat * 4);
    rij[0] = 0; // filtertype: geen
    pixels.copy(rij, 1, y * maat * 4, (y + 1) * maat * 4);
    rijen.push(rij);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(maat, 0);
  ihdr.writeUInt32BE(maat, 4);
  ihdr[8] = 8; // bitdiepte
  ihdr[9] = 6; // kleurtype RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    blok('IHDR', ihdr),
    blok('IDAT', deflateSync(Buffer.concat(rijen), { level: 9 })),
    blok('IEND', Buffer.alloc(0))
  ]);
}

// --------------------------------------------------------------------- SVG

const hex = (k) => `#${k.map((w) => Math.round(w).toString(16).padStart(2, '0')).join('')}`;
const g = (w) => +w.toFixed(2);

function svg() {
  const defs = [];
  const verf = (v) => {
    if (v.kleur) return `fill="${hex(v.kleur)}"${v.dekking < 1 ? ` fill-opacity="${v.dekking}"` : ''}`;
    const id = `v${defs.length}`;
    const stops = v.stops
      .map(([t, k, a]) => `<stop offset="${t}" stop-color="${hex(k)}"${a < 1 ? ` stop-opacity="${a}"` : ''}/>`)
      .join('');
    if (v.lineair) {
      const { van, tot } = v.lineair;
      defs.push(
        `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${g(van[0])}" y1="${g(van[1])}" x2="${g(tot[0])}" y2="${g(tot[1])}">${stops}</linearGradient>`
      );
    } else {
      const { cx, cy, rx, ry } = v.radiaal;
      defs.push(
        `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${g(cx)} ${g(cy)}) scale(${g(rx)} ${g(ry)})">${stops}</radialGradient>`
      );
    }
    return `fill="url(#${id})"`;
  };
  const vormen = tekening().map((v) => {
    if (v.achtergrond || v.vult) return `<rect width="100" height="100" rx="22" ${verf(v.verf)}/>`;
    if (v.vorm === 'cirkel') return `<circle cx="${g(v.x)}" cy="${g(v.y)}" r="${g(v.r)}" ${verf(v.verf)}/>`;
    if (v.vorm === 'lijn') {
      const k = v.verf;
      return `<path d="M${g(v.x1)} ${g(v.y1)}L${g(v.x2)} ${g(v.y2)}" stroke="${hex(k.kleur)}" stroke-width="${g(v.dikte)}" stroke-linecap="round"/>`;
    }
    if (v.vorm === 'pad') return `<path d="${v.d}" ${verf(v.verf)}/>`;
    // Een rechthoek met ongelijke hoeken wordt een pad.
    if (Array.isArray(v.r))
      return `<path d="M${veelhoeken(v, 1)[0]
        .map(([x, y]) => `${g(x)} ${g(y)}`)
        .join('L')}Z" ${verf(v.verf)}/>`;
    return `<rect x="${g(v.x)}" y="${g(v.y)}" width="${g(v.b)}" height="${g(v.h)}"${v.r ? ` rx="${g(v.r)}"` : ''} ${verf(v.verf)}/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>${defs.join('')}</defs>
  ${vormen.join('\n  ')}
</svg>
`;
}

// --------------------------------------------------------------- schrijven

const map = new URL('../icons/', import.meta.url);
for (const [naam, maat, inzet] of [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.78],
  ['apple-touch-icon.png', 180, 1]
]) {
  writeFileSync(new URL(naam, map), png(maat, inzet));
  console.log(`${naam} (${maat}×${maat}) geschreven`);
}

// Dezelfde tekening als SVG, voor het browsertabje. Daar mogen de hoeken wel
// rond, want een tabje rondt niets voor je af.
writeFileSync(new URL('favicon.svg', map), svg());
console.log('favicon.svg geschreven');

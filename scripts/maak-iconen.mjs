// Maakt de app-iconen als PNG, zonder externe pakketten: node heeft zlib aan
// boord en een PNG is niet meer dan een paar blokken met een CRC erachter.
//
//   node scripts/maak-iconen.mjs
//
// Het icoon is de bovenkant van de pagina zelf: HEERLEN in de smalle
// mijnletter op de nevelgrijze grond, en daaronder de lucht-kaart met het
// zonnetje en de stippenstrip (elke stip één model). Kleuren en maten komen
// uit styles.css en iconen.js; de tekening staat hieronder één keer
// beschreven en wordt zowel als PNG gerasterd als als SVG geschreven.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

// ------------------------------------------------------------------ tekening
// Alles in een vak van 100 × 100.

const GROND = [0xec, 0xef, 0xf3]; // --plane
const INKT = [0x10, 0x17, 0x22]; // --text-1
const WIT = [0xff, 0xff, 0xff];
const ZON = [0xff, 0xd3, 0x5c]; // --zon op de lucht
const STIPRAND = [0x0a, 0x14, 0x28]; // de schaduwrand om een stip, op 35 %

// De lucht bij 'zon': een verloop onder 168°, met gloed uit de hoek rechtsboven.
const LUCHT_A = [0x15, 0x4f, 0xae];
const LUCHT_B = [0x2a, 0x72, 0xc8];
const GLOED = [0xff, 0xc4, 0x54];

// HEERLEN in Big Shoulders Display ExtraBold (SIL Open Font License), 27
// hoog met 0,25 letterafstand en de basislijn op 39: de omtrekken zijn eenmalig
// uit het lettertype gehaald, zodat dit script het lettertype niet nodig heeft.
const HEERLEN =
  'M14.41 39L10.91 39L10.91 17.4L14.41 17.4L14.41 26.5L17.39 26.5L17.39 17.4L20.87 17.4L20.87 39L17.39 39' +
  'L17.39 29.58L14.41 29.58L14.41 39M31.98 39L23.45 39L23.45 17.4L31.98 17.4L31.98 20.48L26.94 20.48L26.94 26.5' +
  'L31.71 26.5L31.71 29.58L26.94 29.58L26.94 35.92L31.98 35.92L31.98 39M42.53 39L34 39L34 17.4L42.53 17.4' +
  'L42.53 20.48L37.49 20.48L37.49 26.5L42.26 26.5L42.26 29.58L37.49 29.58L37.49 35.92L42.53 35.92L42.53 39' +
  'M48.04 39L44.55 39L44.55 17.4L49.28 17.4Q52.01 17.4 53.22 18.52Q54.43 19.64 54.52 22.22L54.52 22.22' +
  'Q54.55 23.08 54.56 23.78Q54.58 24.47 54.56 25.16Q54.55 25.84 54.52 26.65L54.52 26.65Q54.47 28.29 53.97 29.33' +
  'Q53.47 30.36 52.4 30.89L52.4 30.89L54.85 39L51.15 39L49.12 31.47L48.04 31.47L48.04 39M48.04 20.48' +
  'L48.04 28.39L49.27 28.39Q50.15 28.39 50.57 27.99Q51 27.59 51.04 26.82L51.04 26.82Q51.08 26.07 51.09 25.25' +
  'Q51.11 24.43 51.09 23.62Q51.08 22.8 51.04 22.04L51.04 22.04Q51 21.27 50.57 20.88Q50.15 20.48 49.28 20.48' +
  'L49.28 20.48L48.04 20.48M65.36 39L56.8 39L56.8 17.4L60.29 17.4L60.29 35.92L65.36 35.92L65.36 39M75.68 39' +
  'L67.15 39L67.15 17.4L75.68 17.4L75.68 20.48L70.64 20.48L70.64 26.5L75.41 26.5L75.41 29.58L70.64 29.58' +
  'L70.64 35.92L75.68 35.92L75.68 39M81.07 39L77.7 39L77.7 17.4L82.85 17.4L84.38 24.27L85.94 35.92L86.62 35.92' +
  'L85.99 26.26L85.7 17.4L89.08 17.4L89.08 39L83.68 39L82.12 31.76L80.91 20.45L80.18 20.45L80.77 30.77L81.07 39';

// De kaart valt precies onder de letters.
const KAART = { x: 10.9, y: 45.5, b: 78.2, h: 37, r: 6.5 };

// Het zonnetje uit iconen.js (een vak van 24), rechtsboven in de kaart.
const ZON_VAK = { x: 70.7, y: 47.8, schaal: 0.72 };
const STRALEN = [
  [12, 2.4, 12, 5],
  [12, 19, 12, 21.6],
  [2.4, 12, 5, 12],
  [19, 12, 21.6, 12],
  [5.2, 5.2, 7.1, 7.1],
  [16.9, 16.9, 18.8, 18.8],
  [18.8, 5.2, 16.9, 7.1],
  [7.1, 16.9, 5.2, 18.8]
];

// De stippenstrip: een as, de middelste helft als band, de mediaan als streep,
// en een stip per model; stippen die elkaar zouden raken gaan een rij omhoog.
const STRIP = { van: 16.5, tot: 83.5, basis: 77, r: 2.35, rand: 0.55 };
const STIPPEN = [
  [0.04, 0],
  [0.19, 0],
  [0.33, 0],
  [0.43, 0],
  [0.43, 1],
  [0.53, 0],
  [0.53, 1],
  [0.63, 0],
  [0.77, 0],
  [0.95, 0]
];
const BAND = [0.33, 0.63];
const MEDIAAN = 0.48;

const effen = (kleur, dekking = 1) => ({ kleur, dekking });

function tekening() {
  const k = KAART;
  // CSS-verloop onder 168°: de lijn loopt door het midden, zo lang dat de
  // hoeken precies op 0 en 1 vallen.
  const hoek = (168 * Math.PI) / 180;
  const [dx, dy] = [Math.sin(hoek), -Math.cos(hoek)];
  const lengte = Math.abs(k.b * dx) + Math.abs(k.h * dy);
  const [mx, my] = [k.x + k.b / 2, k.y + k.h / 2];
  const lucht = {
    lineair: {
      van: [mx - (dx * lengte) / 2, my - (dy * lengte) / 2],
      tot: [mx + (dx * lengte) / 2, my + (dy * lengte) / 2]
    },
    stops: [
      [0, LUCHT_A, 1],
      [1, LUCHT_B, 1]
    ]
  };
  const gloed = {
    radiaal: { cx: k.x + k.b, cy: k.y, rx: 1.1 * k.b, ry: 0.7 * k.h },
    stops: [
      [0, GLOED, 0.55],
      [0.62, GLOED, 0]
    ]
  };

  const s = STRIP;
  const x = (t) => s.van + t * (s.tot - s.van);
  const rij = 2 * s.r + 0.4;
  const hoog = 2 * rij + 2.2;

  const z = ZON_VAK;
  const zx = (w) => z.x + w * z.schaal;
  const zy = (w) => z.y + w * z.schaal;

  return [
    { vorm: 'rect', x: 0, y: 0, b: 100, h: 100, verf: effen(GROND), achtergrond: true },
    { vorm: 'pad', d: HEERLEN, verf: effen(INKT) },
    { vorm: 'rect', ...k, verf: lucht },
    { vorm: 'rect', ...k, verf: gloed },
    { vorm: 'cirkel', x: zx(12), y: zy(12), r: 4.6 * z.schaal, verf: effen(ZON) },
    ...STRALEN.map(([x1, y1, x2, y2]) => ({
      vorm: 'lijn',
      x1: zx(x1),
      y1: zy(y1),
      x2: zx(x2),
      y2: zy(y2),
      dikte: 2 * z.schaal,
      verf: effen(ZON)
    })),
    {
      vorm: 'rect',
      x: x(BAND[0]),
      y: s.basis - hoog,
      b: (BAND[1] - BAND[0]) * (s.tot - s.van),
      h: hoog,
      r: [s.r, s.r, 0, 0],
      verf: effen(WIT, 0.15)
    },
    { vorm: 'rect', x: s.van, y: s.basis - 0.7, b: s.tot - s.van, h: 1.4, r: 0.7, verf: effen(WIT, 0.28) },
    { vorm: 'rect', x: x(MEDIAAN) - 0.7, y: s.basis - hoog - 1.5, b: 1.4, h: hoog + 1.5, r: 0.7, verf: effen(WIT) },
    ...STIPPEN.flatMap(([t, n]) => {
      const cy = s.basis - 1.4 - s.r - n * rij - s.rand;
      return [
        { vorm: 'cirkel', x: x(t), y: cy, r: s.r + s.rand, verf: effen(STIPRAND, 0.35) },
        { vorm: 'cirkel', x: x(t), y: cy, r: s.r, verf: effen(WIT) }
      ];
    })
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
    const f = v.achtergrond ? 1 : inzet;
    const naarBeeld = ([x, y]) => [(50 + (x - 50) * f) * schaal, (50 + (y - 50) * f) * schaal];
    const randen = [];
    for (const veelhoek of veelhoeken(v, schaal * f)) {
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
    if (v.achtergrond) return `<rect width="100" height="100" rx="22" ${verf(v.verf)}/>`;
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

// Maakt de app-iconen als PNG, zonder externe pakketten: node heeft zlib aan
// boord en een PNG is niet meer dan een paar blokken met een CRC erachter.
//
//   node scripts/maak-iconen.mjs
//
// Het beeldmerk is de lucht uit de bovenste kaart van de app: een zon die
// achter een wolk vandaan komt, met op de wolk de drie stippen van de
// spreiding — drie modellen, één verwachting. Alles blijft binnen de cirkel
// die Android van een maskable icoon overhoudt, en het vierkant is dicht:
// iOS rondt de hoeken zelf af en maakt doorzichtige pixels zwart.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

// Kleuren uit styles.css: de lucht van 'halfzon', de zon en de wolk zoals ze op
// die lucht staan, en de drie seriekleuren.
const LUCHT_BOVEN = [0x1d, 0x4c, 0x8c];
const LUCHT_ONDER = [0x4a, 0x7f, 0xbd];
const GLOED = [0xff, 0xcd, 0x6e];
const ZON = [0xff, 0xcc, 0x4a];
const WOLK = [0xff, 0xff, 0xff];
const SCHADUW = [0x0d, 0x24, 0x47];
const STIPPEN = [
  { x: 0.365, kleur: [0x2a, 0x78, 0xd6] },
  { x: 0.5, kleur: [0xeb, 0x68, 0x34] },
  { x: 0.635, kleur: [0x1b, 0xaf, 0x7a] }
];

const ZON_MIDDEN = { x: 0.655, y: 0.35 };
const ZON_R = 0.155;
const STIP_Y = 0.648;
const STIP_R = 0.047;

// De wolk: een onderkant met ronde hoeken en drie bollen erop.
const WOLK_ONDER = { van: 0.2, tot: 0.8, boven: 0.56, onder: 0.745, r: 0.09 };
const BOLLEN = [
  { x: 0.355, y: 0.56, r: 0.14 },
  { x: 0.54, y: 0.475, r: 0.17 },
  { x: 0.7, y: 0.585, r: 0.105 }
];

// Afstanden met teken: negatief is binnen de vorm.
const cirkel = (u, v, c) => Math.hypot(u - c.x, v - c.y) - c.r;

function rondeRechthoek(u, v, { van, tot, boven, onder, r }) {
  const cx = (van + tot) / 2;
  const cy = (boven + onder) / 2;
  const dx = Math.abs(u - cx) - ((tot - van) / 2 - r);
  const dy = Math.abs(v - cy) - ((onder - boven) / 2 - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}

const wolk = (u, v) => Math.min(rondeRechthoek(u, v, WOLK_ONDER), ...BOLLEN.map((b) => cirkel(u, v, b)));

// Zet kleur k met dekking a over kleur c heen.
const over = (c, k, a) => c.map((w, i) => w + (k[i] - w) * a);
// Licht dat erbij komt: maakt lichter zonder de lucht grijs te kleuren.
const scherm = (c, k, a) => c.map((w, i) => 255 - ((255 - w) * (255 - k[i] * a)) / 255);

// Kleur van één punt in het vierkant, in eenheidscoördinaten (0..1).
function kleurOp(u, v) {
  // De lucht loopt, net als op de kaart, schuin van donker naar licht.
  const t = Math.min(1, Math.max(0, 0.92 * v + 0.12 * (0.5 - u) + 0.04));
  let c = over(LUCHT_BOVEN, LUCHT_ONDER, t);

  const zonAfstand = Math.hypot(u - ZON_MIDDEN.x, v - ZON_MIDDEN.y);
  const gloed = Math.max(0, 1 - (zonAfstand - ZON_R) / 0.34);
  c = scherm(c, GLOED, 0.5 * gloed * gloed);
  if (zonAfstand <= ZON_R) c = ZON;

  // Een zachte schaduw onder de wolk, zodat hij los van de lucht komt.
  const schaduw = wolk(u, v - 0.022);
  if (schaduw < 0.03) c = over(c, SCHADUW, 0.2 * Math.min(1, (0.03 - schaduw) / 0.03));

  if (wolk(u, v) <= 0) {
    c = WOLK;
    for (const s of STIPPEN) if (cirkel(u, v, { x: s.x, y: STIP_Y, r: STIP_R }) <= 0) c = s.kleur;
  }
  return c;
}

// 4×4 supersampling, zodat de randen niet trapperig worden.
function pixel(px, py, maat) {
  const n = 4;
  const som = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const k = kleurOp((px + (i + 0.5) / n) / maat, (py + (j + 0.5) / n) / maat);
      for (let q = 0; q < 3; q++) som[q] += k[q];
    }
  }
  return [...som.map((w) => Math.round(w / (n * n))), 0xff];
}

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

function png(maat) {
  const rijen = [];
  for (let y = 0; y < maat; y++) {
    const rij = Buffer.alloc(1 + maat * 4);
    rij[0] = 0; // filtertype: geen
    for (let x = 0; x < maat; x++) {
      const [r, g, b, a] = pixel(x, y, maat);
      rij[1 + x * 4] = r;
      rij[2 + x * 4] = g;
      rij[3 + x * 4] = b;
      rij[4 + x * 4] = a;
    }
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

const map = new URL('../icons/', import.meta.url);
for (const [naam, maat] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180]
]) {
  writeFileSync(new URL(naam, map), png(maat));
  console.log(`${naam} (${maat}×${maat}) geschreven`);
}

// Dezelfde tekening als SVG, voor het browsertabje. Daar mogen de hoeken wel
// rond, want een tabje rondt niets voor je af.
const hex = (k) => `#${k.map((w) => w.toString(16).padStart(2, '0')).join('')}`;
const h = (w) => +(w * 100).toFixed(2);
const wolkVormen = (dy) =>
  [
    `<rect x="${h(WOLK_ONDER.van)}" y="${h(WOLK_ONDER.boven + dy)}" width="${h(WOLK_ONDER.tot - WOLK_ONDER.van)}" height="${h(WOLK_ONDER.onder - WOLK_ONDER.boven)}" rx="${h(WOLK_ONDER.r)}"/>`,
    ...BOLLEN.map((b) => `<circle cx="${h(b.x)}" cy="${h(b.y + dy)}" r="${h(b.r)}"/>`)
  ].join('\n    ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="lucht" x1="0.55" y1="0" x2="0.45" y2="1">
      <stop offset="0" stop-color="${hex(LUCHT_BOVEN)}"/>
      <stop offset="1" stop-color="${hex(LUCHT_ONDER)}"/>
    </linearGradient>
    <radialGradient id="gloed" cx="${h(ZON_MIDDEN.x)}" cy="${h(ZON_MIDDEN.y)}" r="${h(ZON_R + 0.34)}" gradientUnits="userSpaceOnUse">
      <stop offset="0.3" stop-color="${hex(GLOED)}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${hex(GLOED)}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#lucht)"/>
  <rect width="100" height="100" rx="22" fill="url(#gloed)"/>
  <circle cx="${h(ZON_MIDDEN.x)}" cy="${h(ZON_MIDDEN.y)}" r="${h(ZON_R)}" fill="${hex(ZON)}"/>
  <g fill="${hex(SCHADUW)}" opacity="0.2">
    ${wolkVormen(0.022)}
  </g>
  <g fill="${hex(WOLK)}">
    ${wolkVormen(0)}
  </g>
  ${STIPPEN.map((s) => `<circle cx="${h(s.x)}" cy="${h(STIP_Y)}" r="${h(STIP_R)}" fill="${hex(s.kleur)}"/>`).join('\n  ')}
</svg>
`;
writeFileSync(new URL('favicon.svg', map), svg);
console.log('favicon.svg geschreven');

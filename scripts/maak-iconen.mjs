// Maakt de app-iconen als PNG, zonder externe pakketten: node heeft zlib aan
// boord en een PNG is niet meer dan een paar blokken met een CRC erachter.
//
//   node scripts/maak-iconen.mjs
//
// Het beeldmerk is de puntenwolk uit de app zelf: drie modellen op één as.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const ACHTERGROND = [0x14, 0x24, 0x3d, 0xff];
const AS = [0x5b, 0x6b, 0x82, 0xff];
const STIPPEN = [
  { x: 0.27, y: 0.44, kleur: [0x39, 0x87, 0xe5, 0xff] },
  { x: 0.5, y: 0.44, kleur: [0xd9, 0x59, 0x26, 0xff] },
  { x: 0.73, y: 0.44, kleur: [0x19, 0x9e, 0x70, 0xff] }
];
const STIP_R = 0.087;
const RING = 0.024;
const AS_Y = 0.70;
const AS_DIK = 0.026;
const AS_VAN = 0.20;
const AS_TOT = 0.80;

// Kleur van één punt in het vierkant, in eenheidscoördinaten (0..1).
function kleurOp(u, v) {
  for (const s of STIPPEN) {
    const d = Math.hypot(u - s.x, v - s.y);
    if (d <= STIP_R) return s.kleur;
    if (d <= STIP_R + RING) return ACHTERGROND;
  }
  if (Math.abs(v - AS_Y) <= AS_DIK / 2 && u >= AS_VAN && u <= AS_TOT) return AS;
  return ACHTERGROND;
}

// 2×2 supersampling, zodat de randen niet trapperig worden.
function pixel(px, py, maat) {
  const som = [0, 0, 0, 0];
  const offsets = [0.25, 0.75];
  for (const ox of offsets) {
    for (const oy of offsets) {
      const k = kleurOp((px + ox) / maat, (py + oy) / maat);
      for (let i = 0; i < 4; i++) som[i] += k[i];
    }
  }
  return som.map((v) => Math.round(v / 4));
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

// Dezelfde tekening als SVG, voor het browsertabje.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="18" fill="#14243d"/>
  <rect x="20" y="${(AS_Y * 100 - 1.3).toFixed(1)}" width="60" height="2.6" rx="1.3" fill="#5b6b82"/>
  ${STIPPEN.map(
    (s) =>
      `<circle cx="${s.x * 100}" cy="${s.y * 100}" r="${STIP_R * 100}" fill="rgb(${s.kleur
        .slice(0, 3)
        .join(',')})" stroke="#14243d" stroke-width="${RING * 100}"/>`
  ).join('\n  ')}
</svg>
`;
writeFileSync(new URL('favicon.svg', map), svg);
console.log('favicon.svg geschreven');

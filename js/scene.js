// De 8-bitmodus: Heerlen in pixels achter de bovenste kaart. De skyline — het
// Glaspaleis, het Maankwartier met de Heliostaat, de kerktoren, de schachtbok,
// de terril en een rij huizen van baksteen en mergel — met het weer dat de
// meeste modellen geven: wolken, regen met een paraplu, een fietser als het
// droog is, bliksem, sneeuw op de daken, mist.
//
// Alles wordt per pixel in een klein canvas getekend en met gehele factoren
// opgeschaald, zodat elke pixel scherp blijft. De animatie loopt op twaalf
// beelden per seconde, alleen als de kaart in beeld is, en staat stil bij
// "beperk beweging".

const rustig = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ kleuren

const cache = new Map();
function kl(hex) {
  let v = cache.get(hex);
  if (v === undefined) {
    const n = parseInt(hex.slice(1), 16);
    // ImageData is RGBA in het geheugen; een Uint32-blik leest dat als ABGR.
    v = (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
    cache.set(hex, v);
  }
  return v;
}
function meng(a, b, f) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const kanaal = (s) => Math.round(((pa >> s) & 255) * (1 - f) + ((pb >> s) & 255) * f);
  return '#' + ((1 << 24) | (kanaal(16) << 16) | (kanaal(8) << 8) | kanaal(0)).toString(16).slice(1);
}
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];

class Beeld {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new ImageData(w, h);
    this.buf = new Uint32Array(this.data.data.buffer);
  }
  px(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.buf[y * this.w + x] = c;
  }
  rect(x, y, w, h, c) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let j = y0; j < y1; j++) if (x1 > x0) this.buf.fill(c, j * this.w + x0, j * this.w + x1);
  }
  lijn(x0, y0, x1, y1, c) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 600; n++) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  schijf(cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.px(x, y, c);
  }
  ring(cx, cy, r, c) {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++)
        if (Math.abs(Math.hypot(x - cx, y - cy) - r) < 0.55) this.px(x, y, c);
  }
}

// -------------------------------------------------------------------- weer

// Dezelfde luchtkleuren als de gewone kaart, van boven naar de horizon.
const LUCHT = {
  zon: ['#154fae', '#1f63c2', '#3a80d4', '#76aee6'],
  halfzon: ['#22548f', '#3b6ca4', '#5a88ba', '#8fb0d2'],
  wolk: ['#36414f', '#4a5667', '#627083', '#8793a4'],
  regen: ['#18263a', '#23364f', '#355273', '#4f6a88'],
  bui: ['#1c3353', '#2f5079', '#4a74a3', '#7b9cc2'],
  onweer: ['#17192a', '#262640', '#3b3456', '#554a72'],
  sneeuw: ['#3a4c63', '#4e6480', '#6c84a0', '#a7b8cb'],
  mist: ['#5a6470', '#727b87', '#8e969f', '#aeb4bb']
};
const WOLKEN = {
  zon: { n: 2, vul: '#ffffff', schaduw: '#dfe7f1', s: [0.9, 1.2] },
  halfzon: { n: 4, vul: '#ffffff', schaduw: '#d3dce8', s: [1.2, 1.8] },
  wolk: { n: 7, vul: '#c3cbd6', schaduw: '#a3adbb', s: [1.4, 2.3] },
  regen: { n: 7, vul: '#5c6879', schaduw: '#465163', s: [1.6, 2.5] },
  bui: { n: 3, vul: '#ffffff', schaduw: '#cfd8e3', s: [1.1, 1.5] },
  onweer: { n: 7, vul: '#3b384f', schaduw: '#2b293c', s: [1.6, 2.5] },
  sneeuw: { n: 6, vul: '#dde3eb', schaduw: '#c2cad5', s: [1.4, 2.1] },
  mist: { n: 2, vul: '#c9ced4', schaduw: '#b4bac2', s: [1.6, 2] }
};
const NAT = new Set(['regen', 'bui', 'onweer']);
const LAMPEN = new Set(['regen', 'onweer', 'sneeuw', 'mist']);
const ZONNIG = new Set(['zon', 'halfzon', 'bui']);

// De straat is veertien pixels hoog; alle hoogtes van de skyline tellen vanaf
// de grondlijn erboven.
const STRAAT = 14;
let H = 100;
let GROND = H - STRAAT;

// Van links naar rechts: Glaspaleis, Maankwartier, kerk, schachtbok, terril. Op
// een smal scherm houdt elk gebouw afstand tot het vorige, zodat niets overlapt.
function indeling(W) {
  const glas = Math.round(W * 0.03);
  const maan = Math.max(glas + 33, Math.round(W * 0.24));
  const kerk = Math.max(maan + 47, Math.round(W * 0.5));
  const schacht = Math.max(kerk + 28, Math.round(W * 0.66));
  return { glas, maan, kerk, schacht, terril: Math.round(W * 0.92) };
}

// ----------------------------------------------------------------- tekenen

function tekenLucht(b, kleuren, flits) {
  const k = kleuren.map((c) => kl(flits ? meng(c, '#d9d4f5', 0.45) : c));
  for (let y = 0; y < GROND; y++) {
    const pos = (y / (GROND - 1)) * (k.length - 1);
    const i = Math.min(k.length - 2, Math.floor(pos));
    const f = pos - i;
    const rij = BAYER[y & 3];
    for (let x = 0; x < b.w; x++) b.buf[y * b.w + x] = f > (rij[x & 3] + 0.5) / 16 ? k[i + 1] : k[i];
  }
}

function tekenZon(b, cx, cy, t) {
  const gloed = kl('#ffe7a0');
  for (let y = cy - 10; y <= cy + 10; y++)
    for (let x = cx - 10; x <= cx + 10; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 6.5 && d < 8.5 && ((x + y) & 1) === 0) b.px(x, y, gloed);
    }
  b.schijf(cx, cy, 6, kl('#ffd35c'));
  b.schijf(cx - 2, cy - 2, 2, kl('#fff1b8'));
  const lang = rustig ? 3 : 2 + (Math.floor(t * 2) % 2);
  const geel = kl('#ffd35c');
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]])
    for (let k = 0; k < lang; k++) b.px(cx + dx * (10 + k), cy + dy * (10 + k), geel);
}

function tekenWolk(b, x, y, sch, vul, schaduw) {
  const delen = [
    [3, 4.2, 3],
    [7.5, 3.2, 3.9],
    [11, 4.6, 2.6]
  ];
  const v = kl(vul);
  const sd = kl(schaduw);
  for (let j = 0; j < 8 * sch; j++)
    for (let i = 0; i < 14 * sch; i++) {
      const X = i / sch;
      const Y = j / sch;
      const binnen =
        delen.some(([cx, cy, r]) => (X - cx) ** 2 + (Y - cy) ** 2 <= r * r) || (Y >= 4.2 && Y <= 7.2 && X >= 1 && X <= 13);
      if (binnen) b.px(x + i, y + j, Y > 5.9 ? sd : v);
    }
}

function tekenHeuvels(b, kleur) {
  const c = kl(kleur);
  for (let x = 0; x < b.w; x++) {
    const top = Math.round(GROND - 17 + 3 * Math.sin(x * 0.045 + 1) + 2 * Math.sin(x * 0.11 + 2));
    for (let y = top; y < GROND; y++) b.px(x, y, c);
  }
}

// De terril: een steenberg met een groene kruin en de trap die erop zigzagt.
function tekenTerril(b, cx, horizon) {
  const top = GROND - 42;
  const steen = kl(meng('#2e333b', horizon, 0.15));
  const korrel = kl(meng('#3b414b', horizon, 0.15));
  const groen = kl(meng('#3f6b4a', horizon, 0.2));
  const groen2 = kl(meng('#4f7d58', horizon, 0.2));
  for (let x = Math.floor(cx - 48); x < b.w; x++) {
    const y0 = top + Math.abs(x - cx) * (x < cx ? 0.92 : 0.78);
    for (let y = Math.max(0, Math.ceil(y0)); y < GROND; y++) {
      let c = steen;
      if (y - y0 < 9 && y < top + 14) c = (x + y) & 1 ? groen : groen2;
      else if ((x * 7 + y * 13) % 11 === 0) c = korrel;
      b.px(x, y, c);
    }
  }
  const pad = kl(meng('#8a8f98', horizon, 0.3));
  const punten = [
    [cx - 40, GROND - 2],
    [cx - 12, GROND - 11],
    [cx - 26, GROND - 17],
    [cx - 6, GROND - 26],
    [cx - 10, GROND - 29],
    [cx - 3, GROND - 36]
  ];
  for (let i = 0; i < punten.length - 1; i++) b.lijn(...punten[i], ...punten[i + 1], pad);
}

// De schachtbok, met draaiende schijven en het machinegebouw ernaast.
function tekenSchachtbok(b, x0, horizon, t, lampen) {
  const staal = kl(meng('#1d2530', horizon, 0.1));
  const wiel = kl(meng('#48525f', horizon, 0.1));
  const top = GROND - 36;
  const breed = 10;
  for (let y = top; y < GROND; y++) {
    b.px(x0, y, staal);
    b.px(x0 + breed, y, staal);
  }
  for (let y = top + 2; y + 8 <= GROND; y += 8) {
    b.lijn(x0, y, x0 + breed, y + 8, staal);
    b.lijn(x0 + breed, y, x0, y + 8, staal);
  }
  b.rect(x0 - 2, top - 1, breed + 5, 2, staal);
  const hoek = rustig ? 0.6 : t * 2.4;
  for (const wx of [x0 + 2, x0 + 8]) {
    b.ring(wx, top - 5, 3.2, wiel);
    b.px(wx, top - 5, staal);
    b.px(wx + Math.round(Math.cos(hoek) * 2), top - 5 + Math.round(Math.sin(hoek) * 2), wiel);
  }
  b.lijn(x0 + breed, top + 1, x0 + breed + 16, GROND - 1, staal);
  b.lijn(x0 + breed - 1, top + 2, x0 + breed + 15, GROND - 1, staal);
  const mx = x0 + breed + 8;
  b.rect(mx, GROND - 11, 13, 11, kl(meng('#8c4a3a', horizon, 0.12)));
  for (let i = 0; i < 4; i++) b.rect(mx + i, GROND - 12 - i, 13 - 2 * i, 1, kl('#3a3f4a'));
  const raam = kl(lampen ? '#ffd35c' : '#2b3440');
  b.rect(mx + 2, GROND - 8, 2, 3, raam);
  b.rect(mx + 9, GROND - 8, 2, 3, raam);
}

function tekenKerk(b, x0, horizon, lampen, sneeuw) {
  const steen = kl(meng('#6f6258', horizon, 0.12));
  const steen2 = kl(meng('#7d6f63', horizon, 0.12));
  const lei = kl(meng('#39414d', horizon, 0.1));
  const donker = kl('#262b33');
  const tTop = GROND - 34;
  const spits = GROND - 52;
  b.rect(x0, tTop, 9, GROND - tTop, steen);
  for (let y = spits; y < tTop; y++) {
    const half = Math.round(((y - spits) / (tTop - spits)) * 4.5);
    b.rect(x0 + 4 - half, y, half * 2 + 1, 1, sneeuw && y === spits + 9 ? kl('#eef2f7') : lei);
  }
  for (let y = spits - 5; y < spits; y++) b.px(x0 + 4, y, donker);
  b.px(x0 + 3, spits - 4, donker);
  b.px(x0 + 5, spits - 4, donker);
  b.rect(x0 + 3, GROND - 30, 3, 3, kl('#e8e2d6'));
  b.px(x0 + 4, GROND - 29, donker);
  b.rect(x0 + 2, GROND - 24, 1, 3, donker);
  b.rect(x0 + 6, GROND - 24, 1, 3, donker);
  const nx = x0 + 9;
  b.rect(nx, GROND - 11, 16, 11, steen2);
  for (let i = 0; i < 5; i++) b.rect(nx + i, GROND - 12 - i, 16 - 2 * i, 1, sneeuw && i === 4 ? kl('#eef2f7') : lei);
  const raam = kl(lampen ? '#ffd35c' : '#2b3440');
  for (const rx of [nx + 3, nx + 7, nx + 11]) b.rect(rx, GROND - 9, 1, 4, raam);
}

// Het Maankwartier: Michel Huismans pastelkleurige "citadel" op een dek boven
// het spoor bij het station, met arcades, een ronde toren met een maansikkel en
// de Heliostaat — een open toren met een halve bol, waarvan de spiegel daglicht
// naar beneden kaatst. Achter de bogen in het dek schuift een gele trein langs.
function tekenMaankwartier(b, x0, horizon, t, lampen, sneeuw, weer) {
  const dek = GROND - 8;
  const tint = (c, f = 0.12) => kl(meng(c, horizon, f));
  const donker = kl('#1d2026');
  const raam = kl(lampen ? '#ffd35c' : '#4a4452');
  const wit = kl('#eef2f7');

  b.rect(x0, dek, 42, GROND - dek, tint('#6f6763'));
  const treinX = x0 + 60 - ((rustig ? 40 : t * 20) % 150);
  for (const bx of [x0 + 4, x0 + 18, x0 + 32]) {
    b.rect(bx + 1, dek + 2, 4, 1, donker);
    b.rect(bx, dek + 3, 6, GROND - dek - 3, donker);
    for (let x = bx; x < bx + 6; x++) {
      if (x < treinX || x >= treinX + 28) continue;
      b.rect(x, dek + 4, 1, 3, kl('#ffc917'));
      b.px(x, GROND - 1, kl('#1f4e9c'));
      if ((x - Math.floor(treinX)) % 4 === 1) b.px(x, dek + 4, kl('#2b3440'));
    }
  }
  const trap = tint('#8b8480');
  for (let i = 0; i < 4; i++) b.rect(x0 - 7 + i * 2, GROND - 2 - i * 2, 2, 2 + i * 2, trap);
  b.lijn(x0 - 7, GROND - 5, x0 - 1, GROND - 11, tint('#4f4a47'));

  b.rect(x0, dek - 12, 11, 12, tint('#e7b9a8'));
  b.rect(x0 + 1, dek - 13, 9, 1, tint('#b98f86'));
  for (let i = 0; i < 3; i++) {
    b.rect(x0 + 1 + i * 3, dek - 4, 2, 4, donker);
    b.rect(x0 + 1 + i * 3, dek - 9, 1, 2, raam);
  }

  const koper = tint('#b87a4b');
  b.rect(x0 + 11, dek - 20, 6, 20, tint('#ecd9a4'));
  b.rect(x0 + 16, dek - 20, 1, 20, tint('#cbb785'));
  b.rect(x0 + 11, dek - 21, 6, 1, koper);
  b.rect(x0 + 12, dek - 22, 4, 1, koper);
  b.rect(x0 + 13, dek - 23, 2, 1, sneeuw ? wit : koper);
  const maan = kl('#ffd35c');
  b.px(x0 + 14, dek - 27, maan);
  b.px(x0 + 13, dek - 26, maan);
  b.px(x0 + 13, dek - 25, maan);
  b.px(x0 + 14, dek - 24, maan);
  b.rect(x0 + 13, dek - 16, 2, 2, raam);
  b.rect(x0 + 13, dek - 10, 2, 2, raam);

  const mint = tint('#bdd3b6');
  for (let i = 0; i < 12; i++) {
    const h = 8 + Math.round(3 * Math.sin((i / 11) * Math.PI));
    b.rect(x0 + 17 + i, dek - h, 1, h, mint);
    if (sneeuw) b.px(x0 + 17 + i, dek - h, wit);
  }
  for (const [lx, ly] of [
    [x0 + 19, dek - 6],
    [x0 + 23, dek - 8],
    [x0 + 26, dek - 6]
  ])
    b.rect(lx, ly, 2, 2, raam);

  const staal = tint('#8e98a3');
  const hx = x0 + 32;
  for (let y = dek - 22; y < dek; y++) {
    b.px(hx, y, staal);
    b.px(hx + 2, y, staal);
    if ((y & 1) === 0) b.px(hx + 1, y, staal);
  }
  const glim = tint('#d9a071');
  for (let y = dek - 26; y <= dek - 23; y++)
    for (let x = hx - 4; x <= hx + 6; x++)
      if ((x - hx - 1) ** 2 + ((y - (dek - 23)) * 1.2) ** 2 <= 20) b.px(x, y, (x + y) % 5 === 0 ? glim : koper);
  if (sneeuw) b.rect(hx - 1, dek - 26, 5, 1, wit);
  b.rect(hx - 3, dek - 22, 9, 1, kl('#e6f3ff'));
  if (ZONNIG.has(weer)) {
    const straal = kl('#fff3c4');
    const fase = rustig ? 0 : Math.floor(t * 6) % 2;
    for (let i = 1; i < 8; i++) if ((i + fase) % 2 === 0) b.px(hx - i, dek - 22 + i * 2, straal);
  }

  b.rect(x0 + 36, dek - 9, 6, 9, tint('#b9cadf'));
  b.rect(x0 + 38, dek - 6, 2, 2, raam);
  if (sneeuw) {
    b.rect(x0, dek - 13, 11, 1, wit);
    b.rect(x0 + 36, dek - 10, 6, 1, wit);
  }
}

// Het Glaspaleis: een glazen doos met een raster van stijlen en vloeren.
function tekenGlaspaleis(b, x0, lampen) {
  const w = 22;
  const h = 21;
  const y0 = GROND - h;
  const kader = kl('#dfe6ee');
  const glas = kl('#93b9df');
  const glans = kl('#cfe2f5');
  const licht = kl('#ffe08a');
  b.rect(x0, y0, w, h, kader);
  for (let y = y0 + 1; y < GROND - 1; y++)
    for (let x = x0 + 1; x < x0 + w - 1; x++) {
      if ((x - x0) % 4 === 0 || (y - y0) % 5 === 0) continue;
      let c = glas;
      if ((x - x0 + (y - y0)) % 9 === 0) c = glans;
      if (lampen && (x * 3 + y * 5) % 7 < 3) c = licht;
      b.px(x, y, c);
    }
  b.rect(x0 - 1, y0 - 1, w + 2, 1, kl('#b9c3cf'));
}

function tekenHuizen(b, stad, lampen, sneeuw) {
  const dak = kl('#3a3f4a');
  const wit = kl('#eef2f7');
  for (const h of stad.huizen) {
    b.rect(h.x, GROND - h.h, h.b, h.h, kl(h.muur));
    const dakH = Math.min(5, Math.ceil(h.b / 2));
    for (let i = 0; i < dakH; i++) {
      const y = GROND - h.h - 1 - i;
      const b0 = h.x + i;
      const b1 = h.b - 2 * i;
      b.rect(b0, y, b1, 1, dak);
      if (sneeuw) {
        b.px(b0, y, wit);
        b.px(b0 + b1 - 1, y, wit);
        if (i === dakH - 1) b.rect(b0, y, b1, 1, wit);
      }
    }
    for (const [rx, ry, aan] of h.ramen) b.rect(rx, GROND - ry, 1, 2, kl(lampen && aan ? '#ffd35c' : '#2b3440'));
    b.rect(h.deur, GROND - 3, 2, 3, kl('#3a2a22'));
  }
  for (const x of stad.bomen) {
    const y = GROND - 5;
    b.rect(x, y + 2, 1, 3, kl('#4a3528'));
    b.schijf(x, y, 2.6, kl(sneeuw ? '#dfe7ee' : '#2f5d3a'));
    b.px(x - 1, y - 1, kl(sneeuw ? '#ffffff' : '#3d7148'));
  }
}

function tekenStraat(b, t, sneeuw, nat) {
  b.rect(0, GROND, b.w, 3, kl(sneeuw ? '#eef2f7' : '#7d838c'));
  b.rect(0, GROND + 3, b.w, 1, kl(sneeuw ? '#d9e0e8' : '#a3a9b1'));
  b.rect(0, GROND + 4, b.w, H - GROND - 4, kl('#2b3038'));
  for (let x = 2; x < b.w; x += 9) b.rect(x, GROND + 11, 4, 1, kl('#8e949d'));
  if (nat) {
    const plas = kl('#4d5d73');
    const rnd = mulberry32(Math.floor(t * 5));
    for (let i = 0; i < b.w / 5; i++) b.px(rnd() * b.w, GROND + 5 + rnd() * 9, plas);
  }
}

function tekenFietser(b, x, t) {
  const y = GROND + 9;
  const frame = kl('#e8edf3');
  const jas = kl('#eb6834');
  const band = kl('#0f1318');
  for (const wx of [x, x + 6]) {
    b.px(wx, y - 2, band);
    b.px(wx - 1, y - 1, band);
    b.px(wx + 1, y - 1, band);
    b.px(wx, y, band);
  }
  b.lijn(x, y - 1, x + 3, y - 1, frame);
  b.lijn(x + 3, y - 1, x + 2, y - 3, frame);
  b.lijn(x + 2, y - 3, x + 5, y - 3, frame);
  b.lijn(x + 5, y - 3, x + 6, y - 1, frame);
  b.px(x + 2, y - 4, jas);
  b.px(x + 3, y - 4, jas);
  b.px(x + 3, y - 5, jas);
  b.px(x + 4, y - 4, jas);
  b.px(x + 3, y - 6, kl('#f1c7a1'));
  b.px(x + 3 + (Math.floor(t * 6) % 2 ? 1 : -1), y, jas);
}

function tekenWandelaar(b, x, t) {
  const y = GROND + 2;
  const scherm = kl('#d03b3b');
  const jas = kl('#1f2733');
  b.px(x, y - 11, scherm);
  b.rect(x - 2, y - 10, 5, 1, scherm);
  b.rect(x - 3, y - 9, 7, 1, scherm);
  b.px(x + 1, y - 8, jas);
  b.px(x + 1, y - 7, jas);
  b.px(x, y - 6, kl('#f1c7a1'));
  b.rect(x, y - 5, 1, 3, jas);
  const stap = rustig ? 0 : Math.floor(t * 4) % 2;
  b.px(x - stap, y - 1, jas);
  b.px(x + stap, y - 1, jas);
}

function tekenSneeuwpop(b, x) {
  const wit = kl('#f4f7fb');
  b.schijf(x, GROND - 2, 2.4, wit);
  b.schijf(x, GROND - 6, 1.8, wit);
  b.schijf(x, GROND - 9, 1.3, wit);
  b.rect(x - 1, GROND - 11, 3, 1, kl('#1b2433'));
  b.px(x, GROND - 12, kl('#1b2433'));
  b.px(x + 1, GROND - 9, kl('#eb6834'));
}

function maakBliksem(W, doel) {
  const punten = [[W * (0.55 + Math.random() * 0.35), 16]];
  let [x, y] = punten[0];
  while (y < doel[1]) {
    y += 4;
    x += (doel[0] - x) * 0.25 + (Math.random() - 0.5) * 6;
    punten.push([x, Math.min(y, doel[1])]);
  }
  return punten;
}

// --------------------------------------------------------------- de scène

/**
 * Een scène op een canvas. `maat` zet de afmeting in schermpunten en de
 * pixelgrootte, `zetWeer` het weerbeeld (dezelfde namen als de iconen), `speel`
 * start of stopt de animatie.
 */
export function maakScene(canvas) {
  const ctx = canvas.getContext('2d');
  const s = {
    W: 0,
    weer: 'wolk',
    zonY: 30,
    beeld: null,
    stad: { huizen: [], bomen: [] },
    wolken: [],
    druppels: [],
    vlokken: [],
    flitsTot: 0,
    volgendeFlits: 1.5,
    bliksem: null
  };
  const start = performance.now();
  let vorige = 0;
  let loopt = false;
  let wil = false;
  let zichtbaar = true;
  let laatste = 0;

  function maakStad() {
    const W = s.W;
    const plek = indeling(W);
    const bezet = [
      [plek.glas - 2, plek.glas + 24],
      [plek.maan - 9, plek.maan + 44],
      [plek.kerk - 2, plek.kerk + 27],
      [plek.schacht - 3, plek.schacht + 33]
    ];
    const vrij = (a, b) => bezet.every(([l, r]) => b < l || a > r);
    const rnd = mulberry32(11);
    const huizen = [];
    const bomen = [];
    let x = -4;
    while (x < W) {
      const b = 9 + Math.floor(rnd() * 7);
      if (!vrij(x, x + b)) {
        x += 2;
        continue;
      }
      const h = 8 + Math.floor(rnd() * 6);
      const muur = ['#8c4a3a', '#a4583f', '#cdb888', '#7a3f33', '#bca676', '#96503d'][Math.floor(rnd() * 6)];
      // Ramen onthouden hun hoogte vanaf de grond, zodat ze meeschuiven als de kaart groeit.
      const ramen = [];
      for (let rx = x + 2; rx < x + b - 2; rx += 3)
        for (let ry = h - 2; ry > 4; ry -= 4) ramen.push([rx, ry, rnd() < 0.55]);
      huizen.push({ x, b, h, muur, ramen, deur: x + Math.floor(b / 2) - 1 });
      x += b;
      if (rnd() < 0.3) {
        const gat = 4 + Math.floor(rnd() * 4);
        if (vrij(x, x + gat)) bomen.push(x + gat / 2);
        x += gat;
      }
    }
    s.stad = { huizen, bomen };
  }

  function maakWeer() {
    const W = s.W;
    const rnd = mulberry32(W * 31 + s.weer.length * 7);
    const w = WOLKEN[s.weer];
    s.wolken = Array.from({ length: w.n }, () => ({
      x: rnd() * (W + 40),
      y: 3 + rnd() * 30,
      v: 1.2 + rnd() * 2.6,
      s: w.s[0] + rnd() * (w.s[1] - w.s[0])
    }));
    const aantal = { regen: 90, onweer: 130, bui: 34 }[s.weer] ?? 0;
    s.druppels = Array.from({ length: aantal }, () => ({ x: rnd() * W, ox: 4 + rnd() * 26, y: rnd() * GROND, v: 70 + rnd() * 45 }));
    s.vlokken =
      s.weer === 'sneeuw'
        ? Array.from({ length: 80 }, () => ({ x: rnd() * W, y: rnd() * H, v: 5 + rnd() * 7, f: rnd() * 6.28 }))
        : [];
    s.flitsTot = 0;
    s.volgendeFlits = 1.5;
    s.bliksem = null;
  }

  function teken(t) {
    const b = s.beeld;
    if (!b) return;
    const dt = Math.min(0.12, Math.max(0, t - vorige));
    vorige = t;
    const W = s.W;
    const weer = s.weer;
    const plek = indeling(W);
    const kleuren = LUCHT[weer];
    const horizon = kleuren[3];
    const lampen = LAMPEN.has(weer);
    const sneeuw = weer === 'sneeuw';

    if (weer === 'onweer' && !rustig && t > s.volgendeFlits) {
      s.flitsTot = t + 0.2;
      const opSchacht = Math.random() < 0.5;
      s.bliksem = maakBliksem(W, opSchacht ? [plek.schacht + 5, GROND - 42] : [W * (0.2 + Math.random() * 0.6), GROND - 12]);
      s.volgendeFlits = t + 2.2 + Math.random() * 3;
    }
    const flits = t < s.flitsTot;

    tekenLucht(b, kleuren, flits);
    if (ZONNIG.has(weer)) tekenZon(b, Math.round(W * 0.8), s.zonY, t);
    const w = WOLKEN[weer];
    for (const c of s.wolken) {
      const x = ((c.x + (rustig ? 0 : t * c.v)) % (W + 40)) - 30;
      tekenWolk(b, Math.round(x), Math.round(c.y), c.s, w.vul, w.schaduw);
    }
    let buiX = 0;
    if (weer === 'bui') {
      buiX = ((W * 0.25 + (rustig ? 0 : t * 5)) % (W + 70)) - 45;
      tekenWolk(b, Math.round(buiX), 12, 2.4, '#56657a', '#445165');
    }
    if (flits && s.bliksem) {
      const geel = kl('#fff6c2');
      for (let i = 0; i < s.bliksem.length - 1; i++) b.lijn(...s.bliksem[i], ...s.bliksem[i + 1], geel);
    }

    tekenHeuvels(b, meng(horizon, '#2f4f3a', 0.45));
    tekenTerril(b, plek.terril, horizon);
    tekenSchachtbok(b, plek.schacht, horizon, t, lampen);
    tekenKerk(b, plek.kerk, horizon, lampen, sneeuw);
    tekenMaankwartier(b, plek.maan, horizon, t, lampen, sneeuw, weer);
    tekenGlaspaleis(b, plek.glas, lampen);
    tekenHuizen(b, s.stad, lampen, sneeuw);
    tekenStraat(b, t, sneeuw, NAT.has(weer));

    if (weer === 'mist') {
      const nevel = kl('#c9ced4');
      for (let y = Math.max(0, GROND - 50); y < GROND + 8; y++)
        for (let x = 0; x < W; x++) {
          const d = 0.3 + 0.2 * Math.sin(y * 0.35 + t * 0.4) + 0.12 * Math.sin(x * 0.06 + t * 0.6 + y * 0.2);
          if ((BAYER[y & 3][x & 3] + 0.5) / 16 < d) b.px(x, y, nevel);
        }
    }

    if (sneeuw) tekenSneeuwpop(b, Math.round(W * 0.36));
    if (NAT.has(weer)) tekenWandelaar(b, Math.round(((W * 0.2 + (rustig ? 0 : t * 4)) % (W + 20)) - 10), t);
    else if (!sneeuw) tekenFietser(b, Math.round(((W * 0.05 + (rustig ? 0 : t * 11)) % (W + 30)) - 15), t);

    const regen = kl('#b5d7ff');
    for (const d of s.druppels) {
      if (!rustig) {
        d.y += d.v * dt;
        d.x += d.v * dt * 0.12;
        if (d.y > GROND + 8) {
          d.y = -Math.random() * 20;
          d.x = Math.random() * W;
        }
      }
      const x = weer === 'bui' ? buiX + d.ox + (d.y - 30) * 0.12 : d.x;
      if (weer === 'bui' && d.y < 30) continue;
      b.px(x, d.y, regen);
      b.px(x, d.y - 1, regen);
      b.px(x - 1, d.y - 2, regen);
    }
    const wit = kl('#ffffff');
    for (const v of s.vlokken) {
      if (!rustig) {
        v.y += v.v * dt;
        v.x += Math.sin(t * 1.5 + v.f) * 0.25;
        if (v.y > GROND + 10) {
          v.y = -2;
          v.x = Math.random() * W;
        }
      }
      b.px(v.x, v.y, wit);
    }

    ctx.putImageData(b.data, 0, 0);
  }

  const nu = () => (rustig ? 4 : (performance.now() - start) / 1000);

  function lus(tijd) {
    if (!loopt) return;
    requestAnimationFrame(lus);
    if (tijd - laatste < 80) return;
    laatste = tijd;
    teken((tijd - start) / 1000);
  }
  function stuur() {
    const moet = wil && !rustig && zichtbaar && document.visibilityState === 'visible';
    if (moet && !loopt) {
      loopt = true;
      requestAnimationFrame(lus);
    } else if (!moet) loopt = false;
  }
  if ('IntersectionObserver' in window)
    new IntersectionObserver(([ingang]) => {
      zichtbaar = ingang.isIntersecting;
      stuur();
    }).observe(canvas);
  document.addEventListener('visibilitychange', stuur);

  return {
    maat({ breedte, hoogte, schaal }) {
      const W = Math.max(160, Math.ceil(breedte / schaal));
      const nieuwH = Math.max(80, Math.floor(hoogte / schaal));
      const zonY = Math.max(14, Math.round(80 / schaal));
      if (W === s.W && nieuwH === H && s.beeld) return;
      H = nieuwH;
      GROND = H - STRAAT;
      s.W = W;
      s.zonY = zonY;
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = `${W * schaal}px`;
      canvas.style.height = `${H * schaal}px`;
      s.beeld = new Beeld(W, H);
      maakStad();
      maakWeer();
      teken(nu());
    },
    zetWeer(weer) {
      const nieuw = LUCHT[weer] ? weer : 'wolk';
      if (nieuw === s.weer && s.druppels) {
        teken(nu());
        return;
      }
      s.weer = nieuw;
      if (s.beeld) {
        maakWeer();
        teken(nu());
      }
    },
    speel(aan) {
      wil = aan;
      stuur();
    }
  };
}

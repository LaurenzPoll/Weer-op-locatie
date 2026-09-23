// Gereedschap voor de 8-bitscène: kleuren, een pixelbuffer met tekenfuncties
// en de maat van het beeld, die alle tekenmodules delen.

export const rustig = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// De straat is veertien pixels hoog; alle hoogtes van de skyline tellen vanaf
// de grondlijn erboven. `maat` verandert mee met de kaart.
export const STRAAT = 14;
export const maat = { H: 100, GROND: 86 };

const cache = new Map();
export function kl(hex) {
  let v = cache.get(hex);
  if (v === undefined) {
    const n = parseInt(hex.slice(1), 16);
    // ImageData is RGBA in het geheugen; een Uint32-blik leest dat als ABGR.
    v = (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
    cache.set(hex, v);
  }
  return v;
}

// Kleuren die zelf licht geven — ramen, lampen, lichtjes — blijven 's nachts
// helder terwijl de rest van de stad donker wordt.
export const LICHT = new Set();
export function licht(hex) {
  const v = kl(hex);
  LICHT.add(v);
  return v;
}

export function meng(a, b, f) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const kanaal = (s) => Math.round(((pa >> s) & 255) * (1 - f) + ((pb >> s) & 255) * f);
  return '#' + ((1 << 24) | (kanaal(16) << 16) | (kanaal(8) << 8) | kanaal(0)).toString(16).slice(1);
}

export function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];

// Een pixelbuffer. `ox` is de camera: alles wat in de stad staat wordt in
// wereldcoördinaten getekend en schuift met de camera mee; de lucht staat
// stil (ox = 0).
export class Beeld {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.ox = 0;
    this.data = new ImageData(w, h);
    this.buf = new Uint32Array(this.data.data.buffer);
  }
  px(x, y, c) {
    x = Math.round(x) - this.ox;
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.buf[y * this.w + x] = c;
  }
  rect(x, y, w, h, c) {
    const x0 = Math.max(0, Math.round(x) - this.ox);
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w) - this.ox);
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

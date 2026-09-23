// De gebouwen van de 8-bitscène, elk getekend vanaf zijn linkerrand `x0`. `F` is het beeld van dit moment: tijd, weer, licht, feesten.

import { rustig, maat, kl, licht, meng } from './scene-basis.js';

const WIT = '#eef2f7';
const RAAM_UIT = '#2b3440';
const LAMP = '#ffd35c';

// Een gevel van baksteen onder cement of natuursteen: de basiskleur met hier en
// daar een steen die erdoor schemert.
function gevel(b, F, x, y, w, h, basis, steenKleur = '#9a5a45', f = 0.3) {
  const c = F.tint(basis);
  const steen = F.tint(meng(basis, steenKleur, f));
  b.rect(x, y, w, h, c);
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) if ((i * 7 + j * 5) % 13 === 0) b.px(i, j, steen);
}

function raam(F, aan = true) {
  return F.lampen && aan ? licht(LAMP) : kl(RAAM_UIT);
}

// Een vlag van Nederland aan een mast, met een oranje wimpel op Koningsdag.
function vlag(b, x, y, F) {
  const wapper = rustig ? 0 : Math.floor(F.t * 3) % 2;
  b.rect(x, y, 1, 9, kl('#c9ced4'));
  const kleuren = ['#ae1c28', '#ffffff', '#21468b'];
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 5; i++) b.px(x + 1 + i, y + r + (i > 2 ? wapper : 0), kl(kleuren[r]));
  for (let i = 0; i < 6; i++) b.px(x + 1 + i, y + 4 + (i > 3 ? wapper : 0), kl('#ff7f00'));
}

// ---------------------------------------------------------------- terril

// De terril van de Wilhelminaberg met een groene kruin, de trappen die langs de
// helling omhoog zigzaggen, en SnowWorld: de lange skihal die tegen de flank
// ligt, met het dak in zwarte en witte banen als pianotoetsen.
export function tekenTerril(b, cx, F, eind) {
  const { GROND } = maat;
  const top = GROND - 42;
  const steen = F.tint('#2e333b', 0.15);
  const korrel = F.tint('#3b414b', 0.15);
  const groen = F.tint('#3f6b4a', 0.2);
  const groen2 = F.tint('#4f7d58', 0.2);
  const oppervlak = (x) => top + Math.abs(x - cx) * (x < cx ? 0.92 : 0.78);
  for (let x = Math.floor(cx - 48); x < eind; x++) {
    const y0 = oppervlak(x);
    for (let y = Math.max(0, Math.ceil(y0)); y < GROND; y++) {
      let c = steen;
      if (y - y0 < 9 && y < top + 14) c = (x + y) & 1 ? groen : groen2;
      else if ((x * 7 + y * 13) % 11 === 0) c = korrel;
      b.px(x, y, c);
    }
  }
  const pad = F.tint('#8a8f98', 0.3);
  const punten = [
    [cx + 46, GROND - 3],
    [cx + 14, GROND - 18],
    [cx + 26, GROND - 21],
    [cx + 8, GROND - 31],
    [cx + 12, GROND - 32],
    [cx + 3, GROND - 38]
  ];
  for (let i = 0; i < punten.length - 1; i++) b.lijn(...punten[i], ...punten[i + 1], pad);

  const zwart = F.tint('#20242b', 0.08);
  const wit = F.tint(F.sneeuw ? '#ffffff' : '#e9edf1', 0.08);
  const wand = F.tint('#aab1ba', 0.1);
  const schaduw = F.tint('#7d858f', 0.1);
  const voet = cx - 46;
  const dakVoet = Math.round(oppervlak(voet) - 9);
  for (let x = cx - 52; x <= cx - 7; x++) {
    const dak = x < voet ? dakVoet : Math.round(oppervlak(x) - 9);
    const onder = x < voet ? GROND : Math.min(GROND, Math.round(oppervlak(x)) + 1);
    b.px(x, dak, F.sneeuw ? wit : (x >> 1) & 1 ? zwart : wit);
    b.px(x, dak + 1, F.sneeuw ? wit : (x >> 1) & 1 ? zwart : wit);
    b.px(x, dak + 2, schaduw);
    for (let y = dak + 3; y < onder; y++) b.px(x, y, wand);
  }
  const glas = F.lampen ? licht('#ffe08a') : F.tint('#5d7488');
  b.rect(cx - 51, GROND - 5, 5, 3, glas);
  b.rect(cx - 7, Math.round(oppervlak(cx - 7) - 9), 1, 9, schaduw);
}

// -------------------------------------------------------------- schachtbok

export function tekenSchachtbok(b, x0, F) {
  const { GROND } = maat;
  const staal = F.tint('#1d2530', 0.1);
  const wiel = F.tint('#48525f', 0.1);
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
  const hoek = rustig ? 0.6 : F.t * 2.4;
  for (const wx of [x0 + 2, x0 + 8]) {
    b.ring(wx, top - 5, 3.2, wiel);
    b.px(wx, top - 5, staal);
    b.px(wx + Math.round(Math.cos(hoek) * 2), top - 5 + Math.round(Math.sin(hoek) * 2), wiel);
  }
  b.lijn(x0 + breed, top + 1, x0 + breed + 16, GROND - 1, staal);
  b.lijn(x0 + breed - 1, top + 2, x0 + breed + 15, GROND - 1, staal);
  const mx = x0 + breed + 8;
  b.rect(mx, GROND - 11, 13, 11, F.tint('#8c4a3a'));
  for (let i = 0; i < 4; i++) b.rect(mx + i, GROND - 12 - i, 13 - 2 * i, 1, kl(F.sneeuw && i === 3 ? WIT : '#3a3f4a'));
  b.rect(mx + 2, GROND - 8, 2, 3, raam(F));
  b.rect(mx + 9, GROND - 8, 2, 3, raam(F));
}

// ------------------------------------------------------------------- kerk

export function tekenKerk(b, x0, F) {
  const { GROND } = maat;
  const steen = F.tint('#6f6258');
  const steen2 = F.tint('#7d6f63');
  const lei = F.tint('#39414d', 0.1);
  const donker = kl('#262b33');
  const wit = kl(WIT);
  const tTop = GROND - 34;
  const spits = GROND - 52;
  b.rect(x0, tTop, 9, GROND - tTop, steen);
  for (let y = spits; y < tTop; y++) {
    const half = Math.round(((y - spits) / (tTop - spits)) * 4.5);
    b.rect(x0 + 4 - half, y, half * 2 + 1, 1, F.sneeuw && y === spits + 9 ? wit : lei);
  }
  for (let y = spits - 5; y < spits; y++) b.px(x0 + 4, y, donker);
  b.px(x0 + 3, spits - 4, donker);
  b.px(x0 + 5, spits - 4, donker);
  b.rect(x0 + 3, GROND - 30, 3, 3, F.donker ? licht('#fff1c9') : kl('#e8e2d6'));
  b.px(x0 + 4, GROND - 29, donker);
  b.rect(x0 + 2, GROND - 24, 1, 3, donker);
  b.rect(x0 + 6, GROND - 24, 1, 3, donker);
  const nx = x0 + 9;
  b.rect(nx, GROND - 11, 16, 11, steen2);
  for (let i = 0; i < 5; i++) b.rect(nx + i, GROND - 12 - i, 16 - 2 * i, 1, F.sneeuw && i === 4 ? wit : lei);
  for (const rx of [nx + 3, nx + 7, nx + 11]) b.rect(rx, GROND - 9, 1, 4, raam(F));
}

// ------------------------------------------------------------ Maankwartier

// Het Maankwartier: Michel Huismans "citadel" op een dek boven het spoor bij het
// station. De gevels zijn baksteen onder een waas van cement, in zachte
// aardetinten: gebroken wit, zand, oker en verweerd terracotta. Links een ronde
// toren met een maansikkel, rechts het hoogste punt: de Heliostaat, een open
// vakwerktoren van staal op een betonnen sokkel die in drie trappen smaller
// wordt, met bovenop een halve bol. De bolle kant lijkt op de maan, de platte
// kant is een spiegel: overdag kantelt hij naar de zon en kaatst licht het
// plein op, 's avonds wijst hij naar beneden. Achter de bogen in het dek rijden
// om beurten een lange gele trein van de NS en een korte witblauwe van Arriva.
export function tekenMaankwartier(b, x0, F) {
  const { GROND } = maat;
  const { t, sneeuw } = F;
  const dek = GROND - 8;
  const tint = F.tint;
  const donker = kl('#1d2026');
  const rm = F.lampen ? licht(LAMP) : kl('#3b3a44');
  const wit = kl(WIT);
  const boog = (x, y, h) => {
    b.rect(x + 1, y, 1, 1, donker);
    b.rect(x, y + 1, 3, h - 1, donker);
  };

  // Het dek over het spoor, met de trein achter de bogen.
  gevel(b, F, x0, dek, 42, GROND - dek, '#a9a197');
  const rit = rustig ? 40 : t * 20;
  const treinX = x0 + 60 - (rit % 150);
  const arriva = Math.floor(rit / 150) % 2 === 1;
  const lengte = arriva ? 28 : 56;
  const kleur = arriva
    ? { boven: '#eef1f4', midden: '#eef1f4', onder: '#1b2f6e', band: '#1b2f6e' }
    : { boven: '#ffc917', midden: '#ffc917', onder: '#ffc917', band: '#1f4e9c' };
  for (const bx of [x0 + 4, x0 + 18, x0 + 32]) {
    b.rect(bx + 1, dek + 2, 4, 1, donker);
    b.rect(bx, dek + 3, 6, GROND - dek - 3, donker);
    for (let x = bx; x < bx + 6; x++) {
      if (x < treinX || x >= treinX + lengte) continue;
      const i = x - Math.floor(treinX);
      b.px(x, dek + 4, kl(kleur.boven));
      b.px(x, dek + 5, kl(kleur.midden));
      b.px(x, dek + 6, kl(kleur.onder));
      b.px(x, GROND - 1, kl(kleur.band));
      if (i % 4 === 1) b.px(x, dek + 4, F.lampen ? licht('#ffe08a') : kl('#2b3440'));
      if (arriva && (i === 2 || i === 3)) b.px(x, dek + 5, kl('#d52b1e'));
      if (i === 0 && F.lampen) b.px(x, dek + 6, licht('#fff6c2'));
    }
  }
  const trap = tint('#b3a898');
  for (let i = 0; i < 4; i++) b.rect(x0 - 7 + i * 2, GROND - 2 - i * 2, 2, 2 + i * 2, trap);
  b.lijn(x0 - 7, GROND - 5, x0 - 1, GROND - 11, tint('#5a5249'));

  // Links: een blok in verweerd terracotta met een arcade.
  gevel(b, F, x0, dek - 14, 11, 14, '#cf9a80');
  b.rect(x0, dek - 15, 11, 1, tint('#8f7f70'));
  for (let i = 0; i < 3; i++) {
    boog(x0 + 1 + i * 3, dek - 5, 5);
    b.rect(x0 + 2 + i * 3, dek - 11, 1, 2, rm);
  }

  // De ronde toren in zandkleur, licht van links, met een koperen kap en de maan.
  const koper = tint('#b87a4b');
  gevel(b, F, x0 + 11, dek - 22, 6, 22, '#e2cfa3');
  b.rect(x0 + 11, dek - 22, 1, 22, tint('#efe2c2'));
  b.rect(x0 + 15, dek - 22, 2, 22, tint('#c6b184'));
  b.rect(x0 + 11, dek - 23, 6, 1, koper);
  b.rect(x0 + 12, dek - 24, 4, 1, koper);
  b.rect(x0 + 13, dek - 25, 2, 1, sneeuw ? wit : koper);
  const maan = kl('#ffd35c');
  b.px(x0 + 14, dek - 29, maan);
  b.px(x0 + 13, dek - 28, maan);
  b.px(x0 + 13, dek - 27, maan);
  b.px(x0 + 14, dek - 26, maan);
  b.rect(x0 + 13, dek - 18, 1, 2, rm);
  b.rect(x0 + 13, dek - 12, 1, 2, rm);
  b.rect(x0 + 13, dek - 6, 1, 2, rm);

  // Het midden: een laag gebroken wit volume en een hoger okerkleurig met een loggia.
  gevel(b, F, x0 + 17, dek - 10, 6, 10, '#ebe3d2');
  gevel(b, F, x0 + 23, dek - 13, 7, 13, '#d7b67c');
  b.rect(x0 + 17, dek - 11, 6, 1, tint('#9b8f82'));
  b.rect(x0 + 23, dek - 14, 7, 1, tint('#9b8f82'));
  b.rect(x0 + 18, dek - 7, 1, 2, rm);
  b.rect(x0 + 21, dek - 7, 1, 2, rm);
  boog(x0 + 19, dek - 4, 4);
  b.rect(x0 + 24, dek - 11, 5, 3, donker);
  b.rect(x0 + 24, dek - 9, 5, 1, tint('#8a7f73'));
  b.px(x0 + 26, dek - 11, tint('#d7b67c'));
  b.rect(x0 + 25, dek - 6, 1, 2, rm);
  b.rect(x0 + 27, dek - 6, 1, 2, rm);

  // De Heliostaat: de betonnen sokkel en drie trappen vakwerk.
  gevel(b, F, x0 + 30, dek - 9, 12, 9, '#b9b3a9');
  b.rect(x0 + 30, dek - 10, 12, 1, tint('#8e877d'));
  boog(x0 + 34, dek - 5, 5);
  const staal = tint('#474d56', 0.08);
  const staal2 = tint('#6b727c', 0.08);
  const trappen = [
    [x0 + 30, 12, dek - 10, 10],
    [x0 + 31, 10, dek - 20, 9],
    [x0 + 32, 8, dek - 29, 8]
  ];
  for (const [l, w, onder, h] of trappen) {
    const r = l + w - 1;
    const m = l + Math.floor(w / 2);
    const top = onder - h;
    b.lijn(l, onder, m, top + 1, staal2);
    b.lijn(m, onder, l, top + 1, staal2);
    b.lijn(m, onder, r, top + 1, staal2);
    b.lijn(r, onder, m, top + 1, staal2);
    for (const x of [l, m, r]) b.rect(x, top, 1, h, staal);
    b.rect(l - 1, top, w + 2, 1, staal);
  }
  if (sneeuw) b.rect(x0 + 30, dek - 10, 12, 1, wit);

  // De halve bol. `n` wijst van de spiegel naar de bolle kant; de spiegel
  // kijkt naar de kant waar de zon staat.
  const cx = x0 + 36;
  const cy = dek - 42;
  const straal = 4.6;
  const n = F.zonnig ? [-0.8 * F.zonKant, 0.6] : [0, -1];
  b.rect(cx, cy, 1, dek - 37 - cy, staal);
  const bol = tint('#dcd8cc', 0.06);
  const bol2 = tint('#b4afa3', 0.06);
  const krater = tint('#a29d91', 0.06);
  const spiegel = F.lampen ? licht('#fff3c4') : kl('#ffffff');
  const spiegel2 = F.lampen ? licht('#ffd35c') : kl('#8fc8f5');
  for (let y = Math.floor(cy - 6); y <= cy + 6; y++)
    for (let x = cx - 6; x <= cx + 6; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > straal * straal) continue;
      const d = dx * n[0] + dy * n[1];
      if (d < -0.5) continue;
      let c;
      if (d < 0.8) c = (x + y) & 1 ? spiegel : spiegel2;
      else if ((x * 5 + y * 3) % 7 === 0) c = krater;
      else c = dx * F.zonKant - dy > 1.5 ? bol : bol2;
      b.px(x, y, c);
    }
  if (sneeuw && !F.zonnig) b.rect(cx - 2, cy - 5, 5, 1, wit);
  if (F.zonnig) {
    const glans = kl('#fff3c4');
    const fase = rustig ? 0 : Math.floor(t * 6) % 2;
    for (let i = 2; i < 13; i++) if ((i + fase) % 2 === 0) b.px(cx - i * F.zonKant, cy + 1 + i * 2, glans);
  } else if (F.lampen) {
    const gloed = licht('#ffe7a0');
    for (let i = -2; i <= 2; i++) if ((i & 1) === 0) b.px(cx + i, cy + 2, gloed);
  }
}

// ------------------------------------------------------------- Glaspaleis

// Het Glaspaleis: een glazen doos met een raster van stijlen en vloeren.
export function tekenGlaspaleis(b, x0, F) {
  const { GROND } = maat;
  const w = 22;
  const h = 21;
  const y0 = GROND - h;
  const kader = kl('#dfe6ee');
  const glas = kl('#93b9df');
  const glans = kl('#cfe2f5');
  const aan = licht('#ffe08a');
  b.rect(x0, y0, w, h, kader);
  for (let y = y0 + 1; y < GROND - 1; y++)
    for (let x = x0 + 1; x < x0 + w - 1; x++) {
      if ((x - x0) % 4 === 0 || (y - y0) % 5 === 0) continue;
      let c = glas;
      if ((x - x0 + (y - y0)) % 9 === 0) c = glans;
      if (F.lampen && (x * 3 + y * 5) % 7 < 3) c = aan;
      b.px(x, y, c);
    }
  b.rect(x0 - 1, y0 - 1, w + 2, 1, kl(F.sneeuw ? WIT : '#b9c3cf'));
}

// ---------------------------------------------------------------- Raadhuis

// Het Raadhuis van Frits Peutz (1936–1942): een lang, strak blok bekleed met
// zandkleurige Franse kalksteen, met hoge smalle ramen, een zuilengang op de
// begane grond en in het midden het iets hogere deel van de raadszaal.
export function tekenRaadhuis(b, x0, F) {
  const { GROND } = maat;
  const w = 36;
  const h = 19;
  const top = GROND - h;
  const steen = F.tint('#d6c39a');
  const voeg = F.tint('#c4ae83');
  const lijst = F.tint('#b09a70');
  const donker = kl('#2a2622');
  b.rect(x0, top, w, h, steen);
  for (let y = top + 3; y < GROND - 5; y += 4) b.rect(x0, y, w, 1, voeg);
  b.rect(x0 - 1, top - 1, w + 2, 1, F.sneeuw ? kl(WIT) : lijst);
  // De zuilengang.
  b.rect(x0 + 1, GROND - 5, w - 2, 5, donker);
  for (let x = x0 + 1; x < x0 + w - 1; x += 3) b.rect(x, GROND - 5, 1, 5, steen);
  b.rect(x0, GROND - 6, w, 1, lijst);
  // Het middendeel.
  const mx = x0 + 13;
  b.rect(mx, top - 4, 10, 4, steen);
  b.rect(mx - 1, top - 5, 12, 1, F.sneeuw ? kl(WIT) : lijst);
  b.rect(mx + 2, top - 2, 6, 9, raam(F));
  for (let x = mx + 3; x < mx + 8; x += 2) b.rect(x, top - 2, 1, 9, steen);
  b.rect(mx + 1, top + 7, 8, 1, lijst);
  // Ramen in twee rijen.
  let i = 0;
  for (let x = x0 + 2; x < x0 + w - 1; x += 3) {
    if (x >= mx - 1 && x <= mx + 10) continue;
    for (const ry of [top + 2, top + 8]) b.rect(x, ry, 1, 4, raam(F, (i++ * 5) % 7 < 4));
  }
  // De vlaggenmast.
  if (F.feest.koning) vlag(b, mx + 5, top - 14, F);
  else b.rect(mx + 5, top - 12, 1, 7, kl('#c9ced4'));
}

// --------------------------------------------------------- Kasteel Hoensbroek

// Kasteel Hoensbroek: baksteen met banden mergel, twee gedrongen torens met
// uivormige spitsen bij de poort, links achter een lagere vierkante toren en
// rechts de hoge ronde donjon met een slanke spits.
export function tekenKasteel(b, x0, F) {
  const { GROND } = maat;
  const baksteen = F.tint('#95503d');
  const mergel = F.tint('#d9d0b5');
  const lei = F.tint('#353c47', 0.1);
  const wit = kl(WIT);
  const donker = kl('#221d1b');
  const toren = (x, w, h) => {
    b.rect(x, GROND - h, w, h, baksteen);
    for (let y = GROND - h + 3; y < GROND; y += 5) b.rect(x, y, w, 1, mergel);
  };
  const spits = (x, w, voet, hoogte) => {
    for (let i = 0; i < hoogte; i++) {
      const breed = Math.max(1, Math.round((i / (hoogte - 1)) * w));
      b.rect(x + Math.floor((w - breed) / 2), voet - hoogte + i, breed, 1, F.sneeuw && i === hoogte - 1 ? wit : lei);
    }
  };
  const ui = (x, voet) => {
    const rijen = [1, 1, 3, 5, 5, 3, 1, 3, 5];
    rijen.forEach((breed, i) => b.rect(x + (5 - breed) / 2, voet - rijen.length + i, breed, 1, F.sneeuw && i === 2 ? wit : lei));
  };
  // Achter: de vierkante toren en de ronde donjon.
  toren(x0 + 3, 6, 22);
  spits(x0 + 3, 6, GROND - 22, 8);
  toren(x0 + 29, 8, 30);
  b.rect(x0 + 29, GROND - 30, 1, 30, F.tint('#a86250'));
  b.rect(x0 + 35, GROND - 30, 2, 30, F.tint('#7b4131'));
  spits(x0 + 29, 8, GROND - 30, 12);
  for (const y of [GROND - 26, GROND - 19, GROND - 12]) b.rect(x0 + 32, y, 1, 2, raam(F));
  if (F.feest.koning) vlag(b, x0 + 33, GROND - 51, F);
  // Het hoofdgebouw met een leien dak.
  toren(x0 + 8, 22, 13);
  for (let i = 0; i < 3; i++) b.rect(x0 + 8 + i, GROND - 14 - i, 22 - 2 * i, 1, F.sneeuw && i === 2 ? wit : lei);
  for (const rx of [x0 + 10, x0 + 25, x0 + 28])
    for (const ry of [GROND - 11, GROND - 6]) b.rect(rx, ry, 1, 2, raam(F, rx !== x0 + 28));
  // Voor: de poorttorens met hun uien.
  for (const tx of [x0 + 12, x0 + 20]) {
    toren(tx, 5, 17);
    ui(tx, GROND - 17);
    b.rect(tx + 2, GROND - 13, 1, 2, raam(F));
  }
  b.rect(x0 + 17, GROND - 5, 3, 5, donker);
  b.px(x0 + 18, GROND - 6, donker);
}

// ----------------------------------------------------------------- huizen

// Een rij huizen van baksteen en mergel. Met Kerstmis hangen er lichtjes langs
// de dakranden.
export function tekenHuizen(b, stad, F) {
  const { GROND } = maat;
  const dak = kl('#3a3f4a');
  const wit = kl(WIT);
  const kerstKleuren = ['#ff4d4d', '#ffd35c', '#5ce07a', '#6fb7ff'].map((c) => licht(c));
  const knipper = rustig ? 0 : Math.floor(F.t * 2);
  for (const h of stad.huizen) {
    const top = GROND - h.h;
    b.rect(h.x, top, h.b, h.h, kl(h.muur));
    const dakH = Math.min(5, Math.ceil(h.b / 2));
    for (let i = 0; i < dakH; i++) {
      const y = top - 1 - i;
      const b0 = h.x + i;
      const b1 = h.b - 2 * i;
      b.rect(b0, y, b1, 1, dak);
      if (F.sneeuw) {
        b.px(b0, y, wit);
        b.px(b0 + b1 - 1, y, wit);
        if (i === dakH - 1) b.rect(b0, y, b1, 1, wit);
      }
    }
    if (F.feest.kerst)
      for (let x = h.x; x < h.x + h.b; x += 2) b.px(x, top, kerstKleuren[(x / 2 + knipper) & 3]);
    for (const [rx, ry, aan] of h.ramen) b.rect(rx, GROND - ry, 1, 2, raam(F, aan));
    b.rect(h.deur, GROND - 3, 2, 3, kl('#3a2a22'));
  }
  for (const x of stad.bomen) {
    const y = GROND - 5;
    b.rect(x, y + 2, 1, 3, kl('#4a3528'));
    b.schijf(x, y, 2.6, kl(F.sneeuw ? '#dfe7ee' : '#2f5d3a'));
    b.px(x - 1, y - 1, kl(F.sneeuw ? '#ffffff' : '#3d7148'));
  }
}

// De stad in de verte: daken en een paar hogere blokken, vaag in de kleur van
// de horizon. 's Avonds brandt hier en daar een raam.
export function tekenVerteStad(b, rij, F) {
  const { GROND } = maat;
  const kleuren = ['#6d5750', '#7d6a58', '#5f5a5e'].map((c) => F.tint(c, 0.55));
  const daken = F.tint('#3a3f4a', 0.55);
  const wit = F.tint('#eef2f7', 0.3);
  const raamAan = licht('#e2bf6a');
  for (const d of rij) {
    const top = GROND - d.h;
    b.rect(d.x, top, d.b, d.h, kleuren[d.k]);
    if (d.punt) {
      const dakH = Math.min(4, Math.ceil(d.b / 2));
      for (let i = 0; i < dakH; i++) b.rect(d.x + i, top - 1 - i, d.b - 2 * i, 1, F.sneeuw && i === dakH - 1 ? wit : daken);
    } else b.rect(d.x, top, d.b, 1, F.sneeuw ? wit : daken);
    if (F.lampen)
      for (let y = top + 2; y < GROND - 2; y += 3)
        for (let x = d.x + 1; x < d.x + d.b - 1; x += 2) if ((x * 7 + y * 3 + d.zaad) % 9 === 0) b.px(x, y, raamAan);
  }
}

// De kerstboom op het plein, met knipperende lichtjes en een ster.
export function tekenKerstboom(b, x, F) {
  const { GROND } = maat;
  const groen = kl('#1f5a33');
  const groen2 = kl('#2a7042');
  for (let i = 0; i < 14; i++) {
    const half = Math.floor(i / 2.2) + 1 - (i % 5 === 0 && i > 0 ? 1 : 0);
    b.rect(x - half, GROND - 17 + i, half * 2 + 1, 1, i & 1 ? groen : groen2);
  }
  b.rect(x, GROND - 3, 1, 3, kl('#4a3528'));
  b.px(x, GROND - 18, licht('#ffe45c'));
  const kleuren = ['#ff4d4d', '#ffd35c', '#6fb7ff', '#fffffe'].map((c) => licht(c));
  const knipper = rustig ? 0 : Math.floor(F.t * 2.5);
  for (let i = 0; i < 12; i++) {
    const y = GROND - 15 + i;
    const half = Math.floor((i + 2) / 2.2);
    b.px(x + ((i * 3) % (half * 2 + 1)) - half, y, kleuren[(i + knipper) & 3]);
  }
}

// Een bushalte: een paal met een blauw bord.
export function tekenBushalte(b, x) {
  const { GROND } = maat;
  b.rect(x, GROND - 6, 1, 9, kl('#8e949d'));
  b.rect(x - 1, GROND - 9, 3, 3, kl('#1f4e9c'));
  b.px(x, GROND - 8, kl('#ffffff'));
}

// Lantaarnpalen langs de stoep; 's avonds met een plas licht op straat.
export function tekenLantaarns(b, xs, F) {
  const { GROND } = maat;
  const paal = kl('#3a3f4a');
  const kop = F.lampen ? licht('#ffe7a0') : kl('#9aa1ab');
  const plas = licht('#6b6446');
  for (const x of xs) {
    b.rect(x, GROND - 7, 1, 10, paal);
    b.rect(x - 1, GROND - 8, 3, 1, paal);
    b.px(x - 1, GROND - 7, kop);
    b.px(x + 1, GROND - 7, kop);
    if (F.lampen)
      for (let y = GROND + 4; y < GROND + 9; y++)
        for (let dx = -3; dx <= 3; dx++) if (((dx + y) & 1) === 0 && Math.abs(dx) < 1 + (y - GROND - 3)) b.px(x + dx, y, plas);
  }
}

// Slingers over de straat: rood-geel-groen met carnaval, oranje op Koningsdag.
export function tekenSlingers(b, van, tot, kleuren, F) {
  const { GROND } = maat;
  const vlaggen = kleuren.map((c) => kl(c));
  const touw = kl('#3a3f4a');
  const stap = 36;
  const wapper = rustig ? 0 : Math.floor(F.t * 3) % 2;
  for (let a = van; a < tot; a += stap) {
    for (let x = a; x < a + stap; x++) {
      const f = (x - a) / stap;
      const y = Math.round(GROND - 22 + 5 * Math.sin(f * Math.PI));
      b.px(x, y, touw);
      if ((x - a) % 3 === 1) {
        const c = vlaggen[Math.floor((x - a) / 3) % vlaggen.length];
        b.px(x, y + 1, c);
        b.px(x + 1, y + 1, c);
        b.px(x + (wapper ? 1 : 0), y + 2, c);
      }
    }
  }
}

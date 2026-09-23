// Wat er door de scène beweegt: mensen en voertuigen op straat (in
// wereldcoördinaten) en zon, maan, sterren, wolken, een luchtballon, een
// vliegtuig en vogels in de lucht (in schermcoördinaten).

import { rustig, maat, kl, licht } from './scene-basis.js';

// ------------------------------------------------------------------ straat

export function tekenFietser(b, x, t) {
  const y = maat.GROND + 9;
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

export function tekenWandelaar(b, x, t) {
  const y = maat.GROND + 2;
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

// Een Romeinse legionair die voor het Thermenmuseum heen en weer loopt: rode
// tunica, helm met rode kam, schild en speer.
export function tekenLegionair(b, x, t, kant) {
  const y = maat.GROND + 2;
  const rood = kl('#b3262d');
  const helm = kl('#aab1ba');
  const huid = kl('#e0b48f');
  b.rect(x - 1, y - 12, 3, 1, rood);
  b.rect(x, y - 11, 2, 1, helm);
  b.px(x, y - 10, huid);
  b.px(x + 1, y - 10, helm);
  b.rect(x, y - 9, 2, 3, rood);
  b.rect(x, y - 6, 2, 1, kl('#6b4a2a'));
  const stap = rustig ? 0 : Math.floor(t * 4) % 2;
  b.px(x - stap + (stap ? 1 : 0), y - 5, huid);
  b.px(x + 1 + stap - (stap ? 1 : 0), y - 5, huid);
  b.px(x, y - 4, kl('#6b4a2a'));
  b.px(x + 1, y - 4, kl('#6b4a2a'));
  const sx = kant > 0 ? x + 2 : x - 2;
  b.rect(sx, y - 9, 2, 4, rood);
  b.px(sx + (kant > 0 ? 0 : 1), y - 7, kl('#ffd35c'));
  const px = kant > 0 ? x - 1 : x + 2;
  b.rect(px, y - 14, 1, 11, kl('#8a6a45'));
  b.px(px, y - 15, helm);
}

export function tekenSneeuwpop(b, x) {
  const { GROND } = maat;
  const wit = kl('#f4f7fb');
  b.schijf(x, GROND - 2, 2.4, wit);
  b.schijf(x, GROND - 6, 1.8, wit);
  b.schijf(x, GROND - 9, 1.3, wit);
  b.rect(x - 1, GROND - 11, 3, 1, kl('#1b2433'));
  b.px(x, GROND - 12, kl('#1b2433'));
  b.px(x + 1, GROND - 9, kl('#eb6834'));
}

// Een bus van Arriva in de Limburgse huisstijl: donkerblauw met een witte neus
// en de rode Limburgse leeuw. Hij rijdt van rechts naar links.
export function tekenBus(b, x, t, lampen) {
  const y = maat.H - 2;
  const blauw = kl('#1b2f6e');
  const blauw2 = kl('#132251');
  const wit = kl('#f4f7fb');
  const glas = lampen ? licht('#ffe08a') : kl('#16202c');
  const band = kl('#0f1318');
  b.rect(x, y - 10, 27, 9, blauw);
  b.rect(x + 1, y - 11, 25, 1, blauw);
  b.rect(x, y - 2, 27, 1, blauw2);
  b.rect(x, y - 11, 5, 10, wit);
  b.px(x, y - 11, blauw2);
  b.rect(x + 1, y - 9, 2, 5, lampen ? kl('#2a3a4a') : glas);
  b.rect(x + 1, y - 11, 3, 1, licht('#ff9d2e'));
  b.rect(x + 3, y - 5, 2, 2, kl('#d52b1e'));
  b.px(x + 4, y - 6, kl('#d52b1e'));
  for (let rx = x + 9; rx < x + 26; rx += 4) b.rect(rx, y - 9, 3, 3, glas);
  b.rect(x + 6, y - 9, 2, 7, kl('#0b1636'));
  b.px(x, y - 3, lampen ? licht('#fff6c2') : kl('#e8edf3'));
  b.px(x + 26, y - 3, kl('#d03b3b'));
  const draai = rustig ? 0 : Math.floor(t * 8) % 2;
  for (const wx of [x + 6, x + 21]) {
    b.rect(wx - 1, y - 2, 3, 2, band);
    b.px(wx, y - 1 - draai, kl('#8e949d'));
  }
  if (lampen)
    for (let i = 1; i < 6; i++) if (i & 1) b.px(x - i, y - 3 + (i > 3 ? 1 : 0), licht('#fff3c4'));
}

// Een carnavalswagen: een trekker met een wagen vol confetti en een grote
// kop met een narrenkap in rood, geel en groen.
export function tekenWagen(b, x, t) {
  const y = maat.H - 2;
  const band = kl('#0f1318');
  b.rect(x, y - 6, 6, 4, kl('#2f8a3a'));
  b.rect(x + 2, y - 9, 3, 3, kl('#9fc6e0'));
  b.rect(x + 2, y - 10, 4, 1, kl('#2f8a3a'));
  b.rect(x + 6, y - 3, 3, 1, kl('#3a3f4a'));
  b.rect(x + 9, y - 6, 22, 4, kl('#ffd35c'));
  for (let i = 0; i < 22; i += 3) b.px(x + 9 + i, y - 6, kl(['#d52b1e', '#2f8a3a', '#ffffff'][i % 3]));
  b.schijf(x + 20, y - 12, 5, kl('#f1c7a1'));
  b.px(x + 18, y - 13, kl('#1d2026'));
  b.px(x + 22, y - 13, kl('#1d2026'));
  b.rect(x + 18, y - 10, 5, 1, kl('#c2412d'));
  b.px(x + 20, y - 12, kl('#d52b1e'));
  const kap = ['#d52b1e', '#ffd35c', '#2f8a3a'];
  for (let i = 0; i < 3; i++) {
    b.rect(x + 15 + i * 3, y - 17, 3, 2, kl(kap[i]));
    b.px(x + 14 + i * 4, y - 18 - (i & 1), kl(kap[i]));
  }
  const bel = rustig ? 0 : Math.floor(t * 4) % 2;
  for (const bx of [x + 14, x + 18, x + 22]) b.px(bx, y - 19 - bel, kl('#ffe45c'));
  for (const wx of [x + 2, x + 12, x + 27]) {
    b.rect(wx - 1, y - 2, 3, 2, band);
    b.px(wx, y - 1 - (rustig ? 0 : Math.floor(t * 8) % 2), kl('#8e949d'));
  }
}

// -------------------------------------------------------------------- lucht

export function tekenZon(b, cx, cy, t) {
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

// De maan in de fase van vandaag: wassend licht aan de rechterkant, afnemend
// aan de linker. Het donkere deel schemert net zichtbaar.
export function tekenMaan(b, cx, cy, fase) {
  const r = 5;
  const licht1 = kl('#f4f1dc');
  const licht2 = kl('#d9d5bd');
  const donker = kl('#2b3452');
  const k = Math.cos(2 * Math.PI * fase);
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r + 1) continue;
      const xn = x / r;
      const rand = Math.sqrt(Math.max(0, 1 - (y / r) ** 2));
      const aan = fase < 0.5 ? xn > k * rand : xn < -k * rand;
      let c = aan ? licht1 : donker;
      if (aan && (x * 3 + y * 5 + 40) % 7 === 0) c = licht2;
      b.px(cx + x, cy + y, c);
    }
}

export function tekenSterren(b, sterren, t, zicht) {
  for (const s of sterren) {
    if (s.y > zicht) continue;
    const aan = rustig || Math.sin(t * s.v + s.f) > -0.6;
    if (aan) b.px(s.x, s.y, kl(s.fel ? '#ffffff' : '#aab6d6'));
  }
}

export function tekenWolk(b, x, y, sch, vul, schaduw) {
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

// Een luchtballon in rode en gele banen, met een mandje eronder.
export function tekenBallon(b, x, y) {
  const kleuren = [kl('#d8433a'), kl('#ffd35c')];
  for (let j = -6; j <= 5; j++)
    for (let i = -6; i <= 6; i++) {
      const breed = j < 2 ? Math.sqrt(Math.max(0, 36 - j * j)) : 6 - (j - 1) * 1.4;
      if (Math.abs(i) > breed) continue;
      b.px(x + i, y + j, kleuren[Math.floor((i + 7) / 2.5) & 1]);
    }
  b.px(x - 2, y + 6, kl('#5a4632'));
  b.px(x + 2, y + 6, kl('#5a4632'));
  b.px(x - 1, y + 7, kl('#5a4632'));
  b.px(x + 1, y + 7, kl('#5a4632'));
  b.rect(x - 1, y + 8, 3, 2, kl('#8a5a32'));
}

// Een vliegtuig hoog in de lucht: overdag met een condensstreep, 's nachts
// alleen de knipperende lichten.
export function tekenVliegtuig(b, x, y, t, nacht) {
  if (nacht) {
    const aan = rustig || Math.floor(t * 2) % 2 === 0;
    b.px(x, y, licht('#ff4d4d'));
    if (aan) b.px(x + 2, y, licht('#fffffe'));
    return;
  }
  const wit = kl('#f4f7fb');
  b.rect(x, y, 5, 1, wit);
  b.px(x + 2, y - 1, wit);
  b.px(x + 2, y + 1, wit);
  b.px(x + 4, y - 1, wit);
  const streep = kl('#e6edf5');
  for (let i = 6; i < 40; i++) if (i < 16 || (i + y) % Math.max(2, Math.floor(i / 8)) === 0) b.px(x + i, y, streep);
}

// Een zwerm vogels in een V, met om en om de vleugels op en neer.
export function tekenVogels(b, x, y, t) {
  const c = kl('#26303d');
  const slag = rustig ? 0 : Math.floor(t * 5) % 2;
  for (const [dx, dy] of [[0, 0], [4, 2], [4, -2], [8, 4], [8, -4]]) {
    const vx = x + dx;
    const vy = y + dy;
    b.px(vx, vy, c);
    b.px(vx - 1, vy - 1 + slag, c);
    b.px(vx + 1, vy - 1 + slag, c);
  }
}

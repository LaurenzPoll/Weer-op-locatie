// De 8-bitmodus: Heerlen in pixels achter de bovenste kaart. Een brede strook
// stad — Kasteel Hoensbroek, het Glaspaleis, het Raadhuis, de kerktoren, het
// Maankwartier met de Heliostaat en de trein en de schachtbok, met in de verte
// de terril met SnowWorld — waar de camera
// langzaam langs schuift. Met het weer dat de meeste modellen geven, de zon en
// de maan waar ze nu echt boven Heerlen staan, en Kerstmis, carnaval en
// Koningsdag als het zover is.
//
// Alles wordt per pixel in een klein canvas getekend en met gehele factoren
// opgeschaald, zodat elke pixel scherp blijft. De animatie loopt op twaalf
// beelden per seconde, alleen als de kaart in beeld is, en staat stil bij
// "beperk beweging".
//
// Om een ander moment te bekijken: ?scenetijd=2027-02-07T20:30 in de adresbalk.

import { rustig, STRAAT, maat, kl, licht, LICHT, meng, mulberry32, BAYER, Beeld } from './scene-basis.js';
import { hemel, feesten } from './scene-hemel.js';
import {
  tekenTerril,
  tekenSchachtbok,
  tekenKerk,
  tekenMaankwartier,
  tekenGlaspaleis,
  tekenRaadhuis,
  tekenKasteel,
  tekenHuizen,
  tekenKerstboom,
  tekenBushalte,
  tekenLantaarns,
  tekenSlingers
} from './scene-gebouwen.js';
import {
  tekenFietser,
  tekenWandelaar,
  tekenSneeuwpop,
  tekenBus,
  tekenWagen,
  tekenZon,
  tekenMaan,
  tekenSterren,
  tekenWolk,
  tekenBallon,
  tekenVliegtuig,
  tekenVogels
} from './scene-figuren.js';

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
const NACHT = ['#050914', '#0a1226', '#111d3a', '#1b2a4c'];
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
const CONFETTI = ['#d52b1e', '#ffd35c', '#2f8a3a', '#ffffff', '#6fb7ff', '#ff7fc8'];

// Een tijdstip in de adresbalk (?scenetijd=...) zet de klok van de scène
// daarheen; hij loopt vanaf daar gewoon door.
const gevraagd = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('scenetijd') : null;
const KLOKVERSCHIL = gevraagd && !Number.isNaN(Date.parse(gevraagd)) ? Date.parse(gevraagd) - Date.now() : 0;

// ----------------------------------------------------------------- indeling

// De stad is een vaste strook van 500 pixels; is het scherm breder, dan
// schuiven de gebouwen verder uit elkaar en vullen huizen de gaten.
const STAD = 500;
const PLEK = {
  kasteel: 4,
  glas: 80,
  raad: 120,
  boom: 163,
  kerk: 175,
  maan: 285,
  schacht: 390
};
const BREEDTE = { kasteel: 40, glas: 22, raad: 36, boom: 4, kerk: 25, maan: 42, schacht: 33 };

function indeling(WW) {
  const f = WW / STAD;
  const plek = {};
  for (const [k, x] of Object.entries(PLEK)) plek[k] = Math.round(x * f);
  return plek;
}

// ----------------------------------------------------------------- tekenen

function tekenLucht(b, kleuren, flits) {
  const { GROND } = maat;
  const k = kleuren.map((c) => kl(flits ? meng(c, '#d9d4f5', 0.45) : c));
  for (let y = 0; y < GROND; y++) {
    const pos = (y / (GROND - 1)) * (k.length - 1);
    const i = Math.min(k.length - 2, Math.floor(pos));
    const f = pos - i;
    const rij = BAYER[y & 3];
    for (let x = 0; x < b.w; x++) b.buf[y * b.w + x] = f > (rij[x & 3] + 0.5) / 16 ? k[i + 1] : k[i];
  }
}

function tekenHeuvels(b, kleur, verschuif) {
  const { GROND } = maat;
  const c = kl(kleur);
  for (let x = 0; x < b.w; x++) {
    const X = x + verschuif;
    const top = Math.round(GROND - 17 + 3 * Math.sin(X * 0.045 + 1) + 2 * Math.sin(X * 0.11 + 2));
    for (let y = top; y < GROND; y++) b.px(x, y, c);
  }
}

function tekenStraat(b, t, sneeuw, nat, cam) {
  const { GROND, H } = maat;
  b.rect(0, GROND, b.w, 3, kl(sneeuw ? '#eef2f7' : '#7d838c'));
  b.rect(0, GROND + 3, b.w, 1, kl(sneeuw ? '#d9e0e8' : '#a3a9b1'));
  b.rect(0, GROND + 4, b.w, H - GROND - 4, kl('#2b3038'));
  for (let x = 2 - (cam % 9); x < b.w; x += 9) b.rect(x, GROND + 11, 4, 1, kl('#8e949d'));
  if (nat) {
    const plas = kl('#4d5d73');
    const rnd = mulberry32(Math.floor(t * 5));
    for (let i = 0; i < b.w / 5; i++) b.px(rnd() * b.w, GROND + 5 + rnd() * 9, plas);
  }
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

// Waar een hemellichaam op het scherm staat: oost links, west rechts, hoger
// in de lucht naarmate het hoger boven de horizon staat.
function positie(W, { hoogte, uurhoek }) {
  const horizon = maat.GROND - 14;
  const x = Math.round(W * 0.5 + (Math.max(-130, Math.min(130, uurhoek)) / 130) * W * 0.44);
  const y = Math.round(Math.max(9, horizon - (Math.max(-4, hoogte) / 55) * (horizon - 9)));
  return [x, y];
}

// Hoeveel daglicht er is: 0 in de nacht, 1 overdag, daartussen de schemering.
const daglicht = (hoogte) => Math.max(0, Math.min(1, (hoogte + 8) / 14));

// De luchtkleuren voor het weer, gemengd met de nacht en bij zonsop- en
// ondergang met een oranje gloed aan de horizon.
function luchtKleuren(weer, dag, zonHoogte) {
  const bewolkt = !ZONNIG.has(weer);
  const gloed = Math.max(0, 1 - Math.abs(zonHoogte - 1) / 7) * (bewolkt ? 0.22 : 0.6);
  return LUCHT[weer].map((c, i) => {
    const nacht = bewolkt ? meng(NACHT[i], '#2c2f3a', 0.35) : NACHT[i];
    const k = meng(c, nacht, 1 - dag);
    return gloed > 0 ? meng(k, '#f0874a', gloed * [0, 0.2, 0.55, 0.85][i]) : k;
  });
}

// 's Nachts wordt alles wat niet zelf licht geeft donkerder en blauwer. De
// lucht is al donker, dus die slaan we over.
function maakNacht(b, lucht, sterkte) {
  if (sterkte < 0.02) return;
  const naar = [0x0c, 0x12, 0x24];
  const cache = new Map();
  const { buf } = b;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c === lucht[i] || LICHT.has(c)) continue;
    let d = cache.get(c);
    if (d === undefined) {
      const r = (c & 0xff) * (1 - sterkte) + naar[0] * sterkte;
      const g = ((c >> 8) & 0xff) * (1 - sterkte) + naar[1] * sterkte;
      const bl = ((c >> 16) & 0xff) * (1 - sterkte) + naar[2] * sterkte;
      d = (0xff000000 | (Math.round(bl) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
      cache.set(c, d);
    }
    buf[i] = d;
  }
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
    WW: STAD,
    weer: 'wolk',
    beeld: null,
    lucht: null,
    stad: { huizen: [], bomen: [] },
    wolken: [],
    druppels: [],
    vlokken: [],
    confetti: [],
    sterren: [],
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
    const WW = s.WW;
    const plek = indeling(WW);
    const bezet = Object.keys(BREEDTE).map((k) => [plek[k] - 3, plek[k] + BREEDTE[k] + 2]);
    bezet.push([plek.maan - 10, plek.maan + 44]);
    const vrij = (a, b) => bezet.every(([l, r]) => b < l || a > r);
    const rnd = mulberry32(11);
    const huizen = [];
    const bomen = [];
    let x = -4;
    while (x < WW) {
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
    const { H, GROND } = maat;
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
    s.confetti = Array.from({ length: 60 }, (_, i) => ({
      x: rnd() * W,
      y: rnd() * H,
      v: 4 + rnd() * 6,
      f: rnd() * 6.28,
      c: CONFETTI[i % CONFETTI.length]
    }));
    s.sterren = Array.from({ length: Math.round(W / 4) }, () => ({
      x: Math.floor(rnd() * W),
      y: Math.floor(rnd() * (GROND - 20)),
      v: 1 + rnd() * 3,
      f: rnd() * 6.28,
      fel: rnd() < 0.2
    }));
    s.flitsTot = 0;
    s.volgendeFlits = 1.5;
    s.bliksem = null;
  }

  // De camera schuift heen en weer langs de stad, langzaam en met een zachte
  // bocht aan de uiteinden. Hij begint bij het Maankwartier.
  function camera(t, plek) {
    const R = s.WW - s.W;
    if (R <= 0) return 0;
    const begin = Math.max(0, Math.min(R, plek.maan + 21 - s.W / 2));
    if (rustig) return Math.round(begin);
    const T = (2 * R) / 2.5 + 20;
    const u0 = Math.acos(1 - (2 * begin) / R) / (2 * Math.PI);
    return Math.round((R * (1 - Math.cos(2 * Math.PI * (t / T + u0)))) / 2);
  }

  function teken(t) {
    const b = s.beeld;
    if (!b) return;
    const { GROND, H } = maat;
    const dt = Math.min(0.12, Math.max(0, t - vorige));
    vorige = t;
    const W = s.W;
    const WW = s.WW;
    const weer = s.weer;
    const plek = indeling(WW);
    const cam = camera(t, plek);

    const nu = new Date(Date.now() + KLOKVERSCHIL);
    const hem = hemel(nu);
    const feest = feesten(nu);
    const dag = daglicht(hem.zon.hoogte);
    const kleuren = luchtKleuren(weer, dag, hem.zon.hoogte);
    const horizon = kleuren[3];
    const helder = ZONNIG.has(weer);
    const [zonX, zonY] = positie(W, hem.zon);
    const heliostaat = plek.maan + 36 - cam;
    const F = {
      t,
      weer,
      horizon,
      tint: (c, f = 0.12) => kl(meng(c, horizon, f)),
      lampen: LAMPEN.has(weer) || hem.zon.hoogte < -1,
      donker: hem.zon.hoogte < -3,
      sneeuw: weer === 'sneeuw',
      zonnig: helder && hem.zon.hoogte > 2,
      zonKant: zonX >= heliostaat ? 1 : -1,
      feest
    };

    if (weer === 'onweer' && !rustig && t > s.volgendeFlits) {
      s.flitsTot = t + 0.2;
      const schacht = plek.schacht + 5 - cam;
      const opSchacht = Math.random() < 0.5 && schacht > 0 && schacht < W;
      s.bliksem = maakBliksem(W, opSchacht ? [schacht, GROND - 42] : [W * (0.2 + Math.random() * 0.6), GROND - 12]);
      s.volgendeFlits = t + 2.2 + Math.random() * 3;
    }
    const flits = t < s.flitsTot;

    // De lucht met sterren, maan en zon: die worden 's nachts niet donkerder.
    b.ox = 0;
    tekenLucht(b, kleuren, flits);
    if (helder && dag < 0.4) tekenSterren(b, s.sterren, t, GROND - 22);
    if ((helder || weer === 'wolk') && dag < 0.7 && hem.maan.hoogte > -3) {
      const [mx, my] = positie(W, hem.maan);
      tekenMaan(b, mx, my, hem.fase);
    }
    if (helder && hem.zon.hoogte > -3) tekenZon(b, zonX, zonY, t);
    if (!s.lucht || s.lucht.length !== b.buf.length) s.lucht = new Uint32Array(b.buf.length);
    s.lucht.set(b.buf);

    // Wat er door de lucht beweegt.
    const nacht = dag < 0.3;
    if (helder || (nacht && weer !== 'mist' && !NAT.has(weer))) {
      const u = (t + 20) % 55;
      const k = Math.floor((t + 20) / 55);
      tekenVliegtuig(b, Math.round(W + 10 - u * 22), 6 + ((k * 5) % 9), t, nacht);
    }
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
    if ((weer === 'zon' || weer === 'halfzon') && dag > 0.8) {
      const u = (t + 40) % 150;
      if (u < 110) tekenBallon(b, Math.round(-10 + (u * (W + 20)) / 110), Math.round(24 + 3 * Math.sin(t * 0.3)));
    }
    if (dag > 0.6 && !NAT.has(weer) && weer !== 'sneeuw' && weer !== 'mist') {
      const u = (t + 5) % 35;
      const k = Math.floor((t + 5) / 35);
      tekenVogels(b, Math.round(W + 10 - u * 9), 30 + (k % 3) * 4, t);
    }
    if (flits && s.bliksem) {
      const geel = licht('#fff6c2');
      for (let i = 0; i < s.bliksem.length - 1; i++) b.lijn(...s.bliksem[i], ...s.bliksem[i + 1], geel);
    }

    // De stad, in wereldcoördinaten achter de camera.
    // De terril met SnowWorld staat in de verte: vager, in de kleur van de
    // horizon, en hij schuift half zo snel mee als de stad.
    const verte = Math.round(cam * 0.5);
    const terril = Math.round(W * 0.75 + (WW - W) * 0.42);
    b.ox = verte;
    tekenTerril(b, terril, { ...F, tint: (c, f = 0.12) => kl(meng(c, horizon, Math.min(0.85, f + 0.38))) }, terril + 60);
    b.ox = 0;
    tekenHeuvels(b, meng(horizon, '#2f4f3a', 0.45), verte);
    b.ox = cam;
    tekenSchachtbok(b, plek.schacht, F);
    tekenKasteel(b, plek.kasteel, F);
    tekenRaadhuis(b, plek.raad, F);
    tekenKerk(b, plek.kerk, F);
    tekenMaankwartier(b, plek.maan, F);
    tekenGlaspaleis(b, plek.glas, F);
    tekenHuizen(b, s.stad, F);
    if (feest.kerst) tekenKerstboom(b, plek.boom + 2, F);
    const halte = plek.maan + 2;
    tekenBushalte(b, halte);
    const lantaarns = [];
    for (let x = 30; x < WW; x += 64) lantaarns.push(x);
    tekenLantaarns(b, lantaarns, F);
    b.ox = 0;
    tekenStraat(b, t, F.sneeuw, NAT.has(weer), cam);
    b.ox = cam;
    if (feest.carnaval) tekenSlingers(b, 0, WW, ['#d52b1e', '#ffd35c', '#2f8a3a'], F);
    else if (feest.koning) tekenSlingers(b, 0, WW, ['#ff7f00', '#ff9d2e', '#ffffff', '#21468b'], F);
    b.ox = 0;

    if (weer === 'mist') {
      const nevel = kl('#c9ced4');
      for (let y = Math.max(0, GROND - 50); y < GROND + 8; y++)
        for (let x = 0; x < W; x++) {
          const d = 0.3 + 0.2 * Math.sin(y * 0.35 + t * 0.4) + 0.12 * Math.sin((x + cam) * 0.06 + t * 0.6 + y * 0.2);
          if ((BAYER[y & 3][x & 3] + 0.5) / 16 < d) b.px(x, y, nevel);
        }
    }

    // Wie er over straat gaat.
    b.ox = cam;
    if (F.sneeuw) tekenSneeuwpop(b, plek.kerk + 30);
    if (NAT.has(weer)) tekenWandelaar(b, Math.round(((WW * 0.2 + (rustig ? 0 : t * 4)) % (WW + 20)) - 10), t);
    else if (!F.sneeuw) tekenFietser(b, Math.round(((WW * 0.05 + (rustig ? 0 : t * 11)) % (WW + 30)) - 15), t);
    // De bus komt van rechts, stopt even bij de halte voor het station en rijdt
    // door. Met carnaval rijdt om de beurt een carnavalswagen mee.
    const v = 26;
    const van = WW + 30;
    const stop = halte - 5;
    const t1 = (van - stop) / v;
    const t2 = (stop + 35) / v;
    const periode = t1 + 5 + t2 + 12;
    const u = (t + 6) % periode;
    const ronde = Math.floor((t + 6) / periode);
    if (feest.carnaval && ronde % 2 === 1) {
      const x = Math.round(van - u * 16);
      if (x > -35) tekenWagen(b, x, t);
    } else {
      let x = null;
      if (u < t1) x = van - u * v;
      else if (u < t1 + 5) x = stop;
      else if (u < t1 + 5 + t2) x = stop - (u - t1 - 5) * v;
      if (x !== null) tekenBus(b, Math.round(x), t, F.lampen);
    }
    b.ox = 0;

    maakNacht(b, s.lucht, (1 - dag) * 0.62);

    // Neerslag en confetti vallen voor alles langs.
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
    const vallen = (lijst, kleur) => {
      for (const v of lijst) {
        if (!rustig) {
          v.y += v.v * dt;
          v.x += Math.sin(t * 1.5 + v.f) * 0.25;
          if (v.y > GROND + 10) {
            v.y = -2;
            v.x = Math.random() * W;
          }
        }
        b.px(v.x, v.y, kleur ?? kl(v.c));
      }
    };
    vallen(s.vlokken, wit);
    if (feest.carnaval && !NAT.has(weer)) vallen(s.confetti);

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
      if (W === s.W && nieuwH === maat.H && s.beeld) return;
      maat.H = nieuwH;
      maat.GROND = nieuwH - STRAAT;
      s.W = W;
      s.WW = Math.max(STAD, W);
      canvas.width = W;
      canvas.height = nieuwH;
      canvas.style.width = `${W * schaal}px`;
      canvas.style.height = `${nieuwH * schaal}px`;
      s.beeld = new Beeld(W, nieuwH);
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

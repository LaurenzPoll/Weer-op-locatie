// Pixelkunst: sprites van 16 × 16, in code getekend in plaats van als plaatjes.
// Ze dienen voor de figuren bij de modellen, de medailles in "Wie had gelijk?"
// en de iconen in de 8-bitmodus. Een sprite is een lijst van zestien regels;
// elk teken is één pixel en verwijst naar een kleur in PALET, een punt is leeg.
// Wat zich makkelijker laat uitrekenen dan uittekenen (wolken, webben,
// medailles) wordt met raster() opgebouwd.

export const PALET = {
  k: '#1b2433',
  w: '#ffffff',
  l: '#d6dde8',
  g: '#8d99ab',
  d: '#4f5b6d',
  y: '#ffd35c',
  o: '#f0b52f',
  O: '#a86e00',
  b: '#9cc8f5',
  B: '#2f7be0',
  n: '#1c5cab',
  p: '#f2a7b5',
  r: '#d03b3b',
  t: '#35c4bb',
  e: '#8a5a3c',
  s: '#6f55c2',
  G: '#3f9d5c',
  h: '#6cbf6b',
  c: '#e0a36b',
  C: '#8f5324'
};

// De 8-bitmodus zet dit aan; iconen.js en de modellenlijst lezen het bij het tekenen.
export let PIXEL = false;
export function zetPixel(aan) {
  PIXEL = aan;
}

function raster(teken) {
  const g = Array.from({ length: 16 }, () => Array(16).fill('.'));
  const zet = (x, y, c) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < 16 && y < 16) g[y][x] = c;
  };
  const api = {
    px: zet,
    rect(x, y, w, h, c) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) zet(i, j, c);
    },
    lijn(x0, y0, x1, y1, c) {
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (let n = 0; n < 64; n++) {
        zet(x0, y0, c);
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
    },
    // Een gevulde vorm met een rand, en desgewenst een schaduw langs de onderkant.
    vorm(binnen, vul, rand, schaduw) {
      const in16 = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && binnen(x, y);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          if (!in16(x, y)) continue;
          const aanRand = !in16(x - 1, y) || !in16(x + 1, y) || !in16(x, y - 1) || !in16(x, y + 1);
          zet(x, y, aanRand ? rand : schaduw && !in16(x, y + 2) ? schaduw : vul);
        }
    }
  };
  teken(api);
  return g.map((r) => r.join(''));
}

const schijf = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const wolkVorm = (ox, oy, sch = 1) => (x, y) => {
  const X = (x - ox) / sch;
  const Y = (y - oy) / sch;
  return (
    [
      [3.6, 4, 2.9],
      [7.6, 3, 3.6],
      [11, 4.4, 2.5]
    ].some(([cx, cy, r]) => (X - cx) ** 2 + (Y - cy) ** 2 <= r * r) ||
    (Y >= 4 && Y <= 7 && X >= 1 && X <= 13)
  );
};

// ------------------------------------------------------------------ iconen
// Dezelfde acht weerbeelden als de gewone iconen in iconen.js.

export const PIXEL_ICONEN = {
  zon: [
    '................',
    '.......OO.......',
    '.......OO.......',
    '..O..........O..',
    '...O..OOOO..O...',
    '.....OyyyyO.....',
    '....OywyyyyO....',
    '.OO.OyyyyyyO.OO.',
    '.OO.OyyyyyyO.OO.',
    '....OyyyyyyO....',
    '.....OyyyyO.....',
    '...O..OOOO..O...',
    '..O..........O..',
    '.......OO.......',
    '.......OO.......',
    '................'
  ],
  halfzon: raster((a) => {
    a.vorm(schijf(5.5, 5.5, 3.3), 'y', 'O', null);
    for (const [x, y] of [[5, 0], [6, 0], [0, 5], [0, 6], [1, 1], [2, 2], [10, 1], [9, 2], [1, 10], [2, 9]])
      a.px(x, y, 'O');
    a.vorm(wolkVorm(2, 6, 0.95), 'w', 'g', 'l');
  }),
  wolk: raster((a) => a.vorm(wolkVorm(0.4, 3, 1.1), 'w', 'g', 'l')),
  mist: raster((a) => {
    a.rect(2, 4, 11, 2, 'g');
    a.rect(4, 7, 10, 2, 'd');
    a.rect(1, 10, 12, 2, 'g');
    a.rect(5, 13, 9, 2, 'd');
  }),
  regen: raster((a) => {
    a.vorm(wolkVorm(1, 1.5), 'w', 'g', 'l');
    for (const x of [4, 8, 12]) a.lijn(x, 11, x - 1, 13, 'B');
  }),
  bui: raster((a) => {
    a.vorm(schijf(11.5, 3.5, 2.8), 'y', 'O', null);
    for (const [x, y] of [[11, 0], [14, 1], [15, 4]]) a.px(x, y, 'O');
    a.vorm(wolkVorm(0.5, 3.5, 0.95), 'w', 'g', 'l');
    for (const x of [5, 9]) a.lijn(x, 12, x - 1, 14, 'B');
  }),
  onweer: raster((a) => {
    a.vorm(wolkVorm(1, 1.5), 'd', 'k', null);
    for (const [x, y] of [[8, 8], [7, 9], [6, 10], [7, 10], [8, 10], [9, 10], [8, 11], [7, 12], [6, 13]])
      a.px(x, y, 'y');
  }),
  sneeuw: raster((a) => {
    a.vorm(wolkVorm(1, 1.5), 'w', 'g', 'l');
    for (const [x, y] of [[4, 12], [8, 14], [12, 12]]) {
      a.px(x, y, 'B');
      a.px(x - 1, y, 'B');
      a.px(x + 1, y, 'B');
      a.px(x, y - 1, 'B');
      a.px(x, y + 1, 'B');
    }
  })
};

// ----------------------------------------------------------------- figuren
// Eén figuur per soort model, gekozen op gedrag en niet op herkomst.

export const FIGUREN = {
  uil: {
    naam: 'De uil',
    zin: 'Het anker: rustig, ervaren en zelden ver ernaast. Wijkt hij af van de rest, luister dan extra goed.',
    rijen: [
      '................',
      '..kk........kk..',
      '..knk......knk..',
      '..knnkkkkkknnk..',
      '..knnnnnnnnnnk..',
      '.knnyyynnyyynnk.',
      '.knnykynnykynnk.',
      '.knnyyyooyyynnk.',
      '.knnnnnoonnnnnk.',
      '.knnbbbbbbbbnnk.',
      '.knnbnbbbbnbnnk.',
      '.knnbbbnnbbbnnk.',
      '..knnbbbbbbnnk..',
      '..kknnnnnnnnkk..',
      '...kook..kook...',
      '................'
    ]
  },
  haas: {
    naam: 'De haas',
    zin: 'Snel en springerig: elk uur een nieuwe run, pikt een omslag als eerste op en schiet soms te vroeg weg.',
    rijen: [
      '....kk....kk....',
      '...kwwk..kwwk...',
      '...kwpk..kpwk...',
      '...kwpk..kpwk...',
      '...kwpk..kpwk...',
      '...kwwk..kwwk...',
      '..kkwwkkkkwwkk..',
      '.kwwwwwwwwwwwwk.',
      '.kwwkwwwwwwkwwk.',
      '.kwwwwwppwwwwwk.',
      '.kpwwwwkkwwwwpk.',
      '..kwwwwwwwwwwk..',
      '...kkwwwwwwkk...',
      '.....kkkkkk.....',
      '................',
      '................'
    ]
  },
  schildpad: {
    naam: 'De schildpad',
    zin: 'Draagt de hele wereld op zijn rug: kijkt ver vooruit, maar ziet Heerlen als één grove pixel.',
    rijen: [
      '................',
      '................',
      '................',
      '....kkkkkk......',
      '...kBBhhBBk.....',
      '..kBhhhBBBBk....',
      '..kBBhBBBhhk.kk.',
      '.kBBBBBBhhhBkGkG',
      '.kBhhBBBBhBBkGGk',
      'kkkkkkkkkkkkkkk.',
      '..kGk....kGk....',
      '..kkk....kkk....',
      '................',
      '................',
      '................',
      '................'
    ]
  },
  spin: {
    naam: 'De spin',
    zin: 'Spint een fijnmazig web over een klein gebied: vangt de buien die de grote modellen missen, maar ziet maar een paar dagen vooruit.',
    rijen: raster((a) => {
      for (const [x, y] of [[0, 0], [15, 0], [15, 8], [15, 15], [7, 15], [0, 15], [0, 8]]) a.lijn(7, 8, x, y, 'g');
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) if (Math.abs(x - 7) + Math.abs(y - 8) === 7) a.px(x, y, 'g');
      a.lijn(7, 0, 7, 5, 'd');
      for (const [x0, y0, x1, y1] of [[5, 7, 3, 5], [5, 8, 2, 8], [5, 9, 2, 10], [5, 10, 3, 12]]) {
        a.lijn(x0, y0, x1, y1, 'k');
        a.lijn(14 - x0, y0, 14 - x1, y1, 'k');
      }
      a.rect(6, 6, 3, 2, 'k');
      a.rect(6, 8, 3, 3, 's');
      a.px(7, 11, 's');
      a.px(6, 6, 'w');
      a.px(8, 6, 'w');
    })
  },
  robot: {
    naam: 'De robot',
    zin: 'Geen natuurwetten maar geleerd uit veertig jaar weer: sterk in grote patronen, te glad bij uitschieters.',
    rijen: [
      '......kyyk......',
      '.......kk.......',
      '...kkkkkkkkkk...',
      '...kwwwwwwwwk...',
      '..kkwttwwttwkk..',
      '..kkwttwwttwkk..',
      '...kwwwwwwwwk...',
      '...kwkgkgkgwk...',
      '...kwwwwwwwwk...',
      '...kkkkkkkkkk...',
      '.....kkkkkk.....',
      '..kkkkkkkkkkkk..',
      '..kgggyggrgggk..',
      '..kggggggggggk..',
      '..kkkkkkkkkkkk..',
      '....kk....kk....'
    ]
  },
  zwerm: {
    naam: 'De zwerm',
    zin: 'Tientallen runs die samen één vorm maken: nooit extreem, zelden helemaal fout.',
    rijen: raster((a) => {
      // Zeven meeuwen in een losse zwerm; de blauwe in het midden is het gemiddelde.
      const meeuw = (x, y, c) => {
        a.px(x, y, c);
        a.px(x + 4, y, c);
        a.px(x + 1, y + 1, c);
        a.px(x + 3, y + 1, c);
        a.px(x + 2, y + 2, c);
      };
      for (const [x, y] of [[0, 1], [7, 0], [11, 4], [0, 8], [9, 10], [3, 12]]) meeuw(x, y, 'd');
      meeuw(5, 5, 'B');
    })
  },
  ekster: {
    naam: 'De ekster',
    zin: 'Verzamelt per uur het glimmendste stukje van de anderen. Geen eigen model, wel een handige spiegel.',
    rijen: [
      '................',
      '................',
      '.........kkk....',
      '........kkkkk...',
      '........kkkwkddy',
      '......kkkkkkk.yy',
      '.....kkttkwwk...',
      '....kwwttkwwk...',
      '...kkwwtkwwwk...',
      '.ktkkttkwwwk....',
      'kttkkkkkkkk.....',
      'ktk....d.d......',
      'kk....dd.dd.....',
      '................',
      '................',
      '................'
    ]
  }
};

/** Welke figuur bij een model hoort: eerst wat het bijzonder maakt, dan zijn groep. */
export function figuurVoor(model) {
  if (!model) return 'schildpad';
  if (model.ai) return 'robot';
  if (model.ensemble) return 'zwerm';
  if (model.id.startsWith('ecmwf_ifs')) return 'uil';
  if (model.id === 'ncep_gfs_seamless') return 'haas';
  if (model.groep === 'regionaal') return 'spin';
  if (model.groep === 'referentie') return 'ekster';
  return 'schildpad';
}

// --------------------------------------------------------------- medailles
// Goud, zilver en brons voor het podium, met het cijfer erin.

const CIJFERS = {
  1: ['.k.', 'kk.', '.k.', '.k.', 'kkk'],
  2: ['kk.', '..k', '.k.', 'k..', 'kkk'],
  3: ['kk.', '..k', '.k.', '..k', 'kk.']
};

function medaille(plek, vul, rand, schaduw, inkt) {
  return raster((a) => {
    a.lijn(3, 0, 6, 5, 'B');
    a.lijn(4, 0, 7, 5, 'B');
    a.lijn(12, 0, 9, 5, 'r');
    a.lijn(11, 0, 8, 5, 'r');
    a.vorm(schijf(7.5, 10, 5.3), vul, rand, schaduw);
    CIJFERS[plek].forEach((rij, y) => [...rij].forEach((ch, x) => ch === 'k' && a.px(6 + x, 8 + y, inkt)));
  });
}

export const MEDAILLES = {
  1: medaille(1, 'y', 'O', 'o', 'O'),
  2: medaille(2, 'l', 'g', null, 'd'),
  3: medaille(3, 'c', 'C', null, 'C')
};

// ---------------------------------------------------------------- tekenen

/**
 * Een sprite als SVG. Elke reeks gelijke pixels op een regel wordt één
 * rechthoek, en alle rechthoeken van één kleur samen één pad: zo blijft een
 * figuur een handvol elementen in plaats van honderden.
 */
export function pixelSvg(rijen, klasse = '') {
  const paden = new Map();
  rijen.forEach((rij, y) => {
    let x = 0;
    while (x < 16) {
      const ch = rij[x] ?? '.';
      let eind = x + 1;
      while (eind < 16 && (rij[eind] ?? '.') === ch) eind++;
      if (PALET[ch]) paden.set(ch, `${paden.get(ch) ?? ''}M${x} ${y}h${eind - x}v1h-${eind - x}z`);
      x = eind;
    }
  });
  const inhoud = [...paden].map(([ch, d]) => `<path fill="${PALET[ch]}" d="${d}"/>`).join('');
  return `<svg class="px${klasse ? ` ${klasse}` : ''}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${inhoud}</svg>`;
}

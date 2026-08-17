// WMO-weercodes zoals Open-Meteo ze teruggeeft, naar Nederlandse tekst.
// Het icoon is nooit het enige signaal: overal waar dit gebruikt wordt staat
// de omschrijving als tekst ernaast.

const CODES = {
  0: ['Onbewolkt', '☀️'],
  1: ['Overwegend zonnig', '🌤️'],
  2: ['Half bewolkt', '⛅'],
  3: ['Bewolkt', '☁️'],
  45: ['Nevel', '🌫️'],
  48: ['Aanvriezende nevel', '🌫️'],
  51: ['Lichte motregen', '🌦️'],
  53: ['Motregen', '🌦️'],
  55: ['Zware motregen', '🌧️'],
  56: ['Lichte aanvriezende motregen', '🌧️'],
  57: ['Aanvriezende motregen', '🌧️'],
  61: ['Lichte regen', '🌦️'],
  63: ['Regen', '🌧️'],
  65: ['Zware regen', '🌧️'],
  66: ['Lichte aanvriezende regen', '🌧️'],
  67: ['Aanvriezende regen', '🌧️'],
  71: ['Lichte sneeuw', '🌨️'],
  73: ['Sneeuw', '🌨️'],
  75: ['Zware sneeuw', '❄️'],
  77: ['Sneeuwkorrels', '🌨️'],
  80: ['Lichte buien', '🌦️'],
  81: ['Buien', '🌧️'],
  82: ['Zware buien', '⛈️'],
  85: ['Lichte sneeuwbuien', '🌨️'],
  86: ['Sneeuwbuien', '🌨️'],
  95: ['Onweer', '⛈️'],
  96: ['Onweer met lichte hagel', '⛈️'],
  99: ['Onweer met zware hagel', '⛈️']
};

export function weercode(code) {
  const treffer = CODES[code];
  if (!treffer) return { tekst: 'Onbekend', icoon: '❔' };
  return { tekst: treffer[0], icoon: treffer[1] };
}

// Windrichting in graden naar een windstreek, zoals een weerbericht het zegt.
const STREKEN = ['N', 'NNO', 'NO', 'ONO', 'O', 'OZO', 'ZO', 'ZZO', 'Z', 'ZZW', 'ZW', 'WZW', 'W', 'WNW', 'NW', 'NNW'];

export function windstreek(graden) {
  if (graden === null || graden === undefined) return null;
  return STREKEN[Math.round(graden / 22.5) % 16];
}

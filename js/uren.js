// Welke uren het rooster laat zien. Op vandaag: vanaf het uur waarin we nu
// zitten, 24 uur vooruit, dus door tot morgen. Op morgen: die hele dag, van
// 0 tot 23 uur. Alles op de klok van de plek.

import { LOCATION, datumVoor, tijdOpLocatie } from './config.js';
import { zonOpOnder } from './zon.js';

const DAGEN_KORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const weekdagKort = (datum) => DAGEN_KORT[new Date(`${datum}T12:00:00Z`).getUTCDay()];

// Een uur verder, op de kalender: 'JJJJ-MM-DDTHH' plus n uur.
function verder(datumUur, n) {
  const t = new Date(Date.parse(`${datumUur}:00:00Z`) + n * 3600000).toISOString();
  return t.slice(0, 13);
}

/** Zonsopkomst en -ondergang als uur met breuk (7,4 = 07:24) op de klok van de plek. */
function zonUren(datum) {
  const z = zonOpOnder(datum, LOCATION.latitude, LOCATION.longitude);
  if (z.poolnacht) return { op: 24, onder: 0 };
  if (z.middernachtzon) return { op: 0, onder: 24 };
  const uur = (d) => {
    const [h, m] = new Intl.DateTimeFormat('en-GB', {
      timeZone: LOCATION.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
      .format(d)
      .split(':')
      .map(Number);
    return h + m / 60;
  };
  return { op: uur(z.op), onder: uur(z.onder) };
}

/**
 * De kolommen van het rooster: { sleutel: 'JJJJ-MM-DDTHH', datum, uur, nu,
 * nieuweDag, dagKort, nacht }. `nacht` is waar als de zon dat hele uur onder de
 * horizon staat.
 */
export function uurKolommen(keuze, nu = new Date()) {
  const start = keuze === 'morgen' ? `${datumVoor('morgen', nu)}T00` : tijdOpLocatie(nu).slice(0, 13);
  const aantal = keuze === 'morgen' ? 24 : 25;
  const zon = {};
  return Array.from({ length: aantal }, (_, i) => {
    const sleutel = verder(start, i);
    const datum = sleutel.slice(0, 10);
    const uur = Number(sleutel.slice(11, 13));
    zon[datum] ??= zonUren(datum);
    return {
      sleutel,
      datum,
      uur,
      nu: keuze !== 'morgen' && i === 0,
      nieuweDag: i > 0 && uur === 0,
      dagKort: weekdagKort(datum),
      nacht: uur + 1 <= zon[datum].op || uur >= zon[datum].onder
    };
  });
}

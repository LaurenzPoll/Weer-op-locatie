// Trendgeschiedenis: bij elke ophaal leggen we vast wat de modellen op dat moment
// zeiden, zodat de app kan laten zien of de verwachting nog schuift of stabiliseert.
// Alles staat in localStorage, dus per apparaat en per browser — er gaat niets naar
// een server.

import { HISTORY_KEY, HISTORY_MAX_ENTRIES, HISTORY_MIN_GAP_MS, TARGET_DATE } from './config.js';
import { mediaan } from './stats.js';

export function leesHistorie() {
  try {
    const ruw = localStorage.getItem(HISTORY_KEY);
    if (!ruw) return [];
    const alles = JSON.parse(ruw);
    return Array.isArray(alles) ? alles.filter((e) => e.datum === TARGET_DATE) : [];
  } catch {
    return [];
  }
}

function schrijfHistorie(lijst) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(lijst.slice(-HISTORY_MAX_ENTRIES)));
  } catch {
    // Geen opslag beschikbaar: de app werkt verder, alleen zonder trend.
  }
}

/**
 * Legt de huidige stand vast. Binnen het minimuminterval overschrijven we het
 * laatste punt in plaats van er een toe te voegen, zodat vaak verversen de
 * trendlijn niet volspamt maar de weergave wel actueel blijft.
 */
export function bewaarMeting(resultaten) {
  const bruikbaar = resultaten.filter((r) => r.status === 'ok' && r.dag);
  if (bruikbaar.length < 3) return leesHistorie();

  const punt = {
    ts: new Date().toISOString(),
    datum: TARGET_DATE,
    mediaanTemp: mediaan(bruikbaar.map((r) => r.dag.tempMax).filter((v) => v !== null)),
    mediaanNeerslag: mediaan(bruikbaar.map((r) => r.dag.neerslag).filter((v) => v !== null)),
    modellen: Object.fromEntries(bruikbaar.map((r) => [r.id, { t: r.dag.tempMax, n: r.dag.neerslag }]))
  };

  const historie = leesHistorie();
  const laatste = historie.at(-1);
  if (laatste && Date.now() - new Date(laatste.ts).getTime() < HISTORY_MIN_GAP_MS) {
    historie[historie.length - 1] = punt;
  } else {
    historie.push(punt);
  }
  schrijfHistorie(historie);
  return historie;
}

/** Het oudste punt dat minstens `minUren` oud is — het ijkpunt voor de trend. */
function ijkpunt(historie, minUren = 12) {
  const grens = Date.now() - minUren * 3600000;
  const oud = historie.filter((e) => new Date(e.ts).getTime() <= grens);
  return oud.length ? oud[0] : null;
}

export function verschuiving(historie, veld) {
  if (historie.length < 2) return null;
  const ref = ijkpunt(historie);
  const nu = historie.at(-1);
  if (!ref || ref === nu) return null;
  const van = ref[veld];
  const naar = nu[veld];
  if (van === null || naar === null || van === undefined || naar === undefined) return null;
  const urenGeleden = Math.round((new Date(nu.ts) - new Date(ref.ts)) / 3600000);
  return {
    delta: naar - van,
    van,
    naar,
    urenGeleden,
    sinds: urenGeleden >= 36 ? `${Math.round(urenGeleden / 24)} dagen` : `${urenGeleden} uur`
  };
}

export function modelVerschuiving(historie, id, sleutel = 't') {
  const metModel = historie.filter((e) => e.modellen && e.modellen[id] && e.modellen[id][sleutel] !== null);
  if (metModel.length < 2) return null;
  const ref = ijkpunt(metModel) ?? metModel[0];
  const nu = metModel.at(-1);
  if (ref === nu) return null;
  const urenGeleden = Math.round((new Date(nu.ts) - new Date(ref.ts)) / 3600000);
  if (urenGeleden < 6) return null;
  return {
    delta: nu.modellen[id][sleutel] - ref.modellen[id][sleutel],
    urenGeleden,
    sinds: urenGeleden >= 36 ? `${Math.round(urenGeleden / 24)} dagen` : `${urenGeleden} uur`
  };
}

export function trendPunten(historie, veld) {
  return historie
    .filter((e) => e[veld] !== null && e[veld] !== undefined)
    .slice(-14)
    .map((e) => ({ ts: e.ts, waarde: e[veld] }));
}

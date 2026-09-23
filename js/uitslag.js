// "Wie had gelijk?": de verwachting van vóór een dag naast wat er die dag
// werkelijk gebeurde.
//
// Per dag beoordelen we alle modellen op dezelfde ophaal, zodat ze eerlijk
// tegen elkaar uitkomen: de laatste verwachting van de dag ervoor, of — als de
// app die dag niet open is geweest — de vroegste van de dag zelf. Een model
// scoort op twee dingen die je merkt als je buiten staat: hoe warm het werd, en
// of het droog bleef.

import { datumVoor } from './config.js';

// Dezelfde grens als het oordeel bovenaan: vanaf 1 mm heet een dag nat.
export const NAT_MM = 1;
// Binnen deze afwijking in middagtemperatuur, én goed over droog of nat, is een
// verwachting raak.
export const RAAK_GRADEN = 1.5;
// Droog en nat verwisselen weegt zwaar: zoveel graden afwijking is het waard.
const STRAF_REGEN = 2;
// Best Match is de maatstaf zelf — Open-Meteo's terugblik komt uit dezelfde
// modellen — dus die doet niet mee.
const BUITEN_MEDEDINGING = new Set(['best_match']);

const lokaleDatum = (ts) => datumVoor('vandaag', new Date(ts));

/** De verwachting waarop een dag beoordeeld wordt, en of die van de dag ervoor was. */
export function kiesVerwachting(verleden, datum) {
  const vanDag = verleden
    .filter((p) => p.datum === datum && p.modellen)
    .sort((a, b) => a.ts.localeCompare(b.ts));
  const ervoor = vanDag.filter((p) => lokaleDatum(p.ts) < datum);
  if (ervoor.length) return { punt: ervoor.at(-1), dagErvoor: true };
  return vanDag.length ? { punt: vanDag[0], dagErvoor: false } : null;
}

/** Alle modellen van één verwachting tegen de werkelijkheid, beste eerst. */
export function beoordeelDag(punt, gezien) {
  const natGezien = gezien.n >= NAT_MM;
  const rijen = [];
  for (const [id, v] of Object.entries(punt.modellen)) {
    if (BUITEN_MEDEDINGING.has(id) || v?.t == null || v?.n == null) continue;
    const dT = v.t - gezien.t;
    const regenGoed = v.n >= NAT_MM === natGezien;
    // De afwijking in graden, plus straf voor droog en nat verwisselen, plus een
    // kleine weging van het verschil in millimeters als tie-breaker.
    const fout = Math.abs(dT) + (regenGoed ? 0 : STRAF_REGEN) + Math.min(Math.abs(v.n - gezien.n), 10) * 0.1;
    rijen.push({ id, t: v.t, n: v.n, dT, regenGoed, fout, raak: Math.abs(dT) <= RAAK_GRADEN && regenGoed });
  }
  return rijen.sort((a, b) => a.fout - b.fout);
}

/** Elke voorbije dag waarvan zowel een verwachting als de terugblik bekend is, nieuwste eerst. */
export function beoordeel(verleden, terugblik) {
  return Object.keys(terugblik)
    .sort()
    .reverse()
    .map((datum) => {
      const keuze = kiesVerwachting(verleden, datum);
      if (!keuze) return null;
      const rijen = beoordeelDag(keuze.punt, terugblik[datum]);
      return rijen.length ? { datum, gezien: terugblik[datum], ...keuze, rijen } : null;
    })
    .filter(Boolean);
}

/** De stand over meerdere dagen: gemiddelde fout, raak-dagen en per dag raak of mis. */
export function ranglijst(dagen) {
  const per = new Map();
  for (const dag of [...dagen].reverse()) {
    for (const r of dag.rijen) {
      const s = per.get(r.id) ?? { id: r.id, dagen: 0, raak: 0, somFout: 0, somAfwijking: 0, reeks: {} };
      s.dagen++;
      if (r.raak) s.raak++;
      s.somFout += r.fout;
      s.somAfwijking += Math.abs(r.dT);
      s.reeks[dag.datum] = r.raak;
      per.set(r.id, s);
    }
  }
  return [...per.values()]
    .map((s) => ({ ...s, gemFout: s.somFout / s.dagen, gemAfwijking: s.somAfwijking / s.dagen }))
    .sort((a, b) => a.gemFout - b.gemFout || b.dagen - a.dagen);
}

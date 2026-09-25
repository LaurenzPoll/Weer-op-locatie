// Zonsopkomst en -ondergang, uitgerekend in plaats van opgevraagd: ze hangen
// alleen af van de plek en de datum, niet van een weermodel. Dit is de gewone
// zonsopkomstformule (met breking in de atmosfeer en de straal van de
// zonneschijf, samen 0,833° onder de horizon); die klopt op een minuut na.

const RAD = Math.PI / 180;
const J2000 = 2451545;
const naarJuliaans = (ms) => ms / 86400000 + 2440587.5;
const vanJuliaans = (j) => new Date((j - 2440587.5) * 86400000);

/**
 * Opkomst en ondergang op een kalenderdag (JJJJ-MM-DD) op een plek. Geeft
 * { op, onder } als Date, of { poolnacht: true } / { middernachtzon: true } als
 * de zon die dag niet opkomt of niet ondergaat.
 */
export function zonOpOnder(datum, breedte, lengte) {
  // Dagen sinds 1 januari 2000, 12:00 UTC, en de gemiddelde zonnemiddag op
  // deze lengtegraad.
  const n = Math.round(naarJuliaans(Date.parse(`${datum}T12:00:00Z`)) - J2000);
  const middag = n - lengte / 360;
  const M = (357.5291 + 0.98560028 * middag) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transit = J2000 + middag + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const declinatie = Math.asin(Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD));
  const cosUurhoek =
    (Math.sin(-0.833 * RAD) - Math.sin(breedte * RAD) * Math.sin(declinatie)) /
    (Math.cos(breedte * RAD) * Math.cos(declinatie));
  if (cosUurhoek > 1) return { poolnacht: true };
  if (cosUurhoek < -1) return { middernachtzon: true };
  const uurhoek = Math.acos(cosUurhoek) / RAD;
  return { op: vanJuliaans(transit - uurhoek / 360), onder: vanJuliaans(transit + uurhoek / 360) };
}

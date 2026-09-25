// Regen in het komende uur, in één zin. Open-Meteo geeft neerslag per kwartier;
// elk getal is de som over het kwartier dat op dat tijdstip eindigt. Dit is
// één verwachting (Best Match), geen vergelijking van modellen: op zo'n korte
// termijn gaat het om wanneer de bui komt, niet om hoe zeker dat is.

// Vanaf zoveel millimeter in een kwartier heet het nat (0,4 mm per uur).
export const NAT_KWARTIER = 0.1;

// Hoe ver vooruit we kijken: acht kwartieren, twee uur.
const VENSTER = 8;

const verschuif = (tijd, minuten) => new Date(Date.parse(`${tijd}:00Z`) + minuten * 60000).toISOString().slice(0, 16);
const beginVan = (kwartier) => verschuif(kwartier.tijd, -15).slice(11);
const isNat = (kwartier) => kwartier.mm >= NAT_KWARTIER;

// Indeling naar hoe het buiten voelt, in millimeter per uur.
function soort(kwartieren) {
  const perUur = Math.max(...kwartieren.map((k) => k.mm)) * 4;
  if (perUur >= 10) return 'zware buien';
  if (perUur >= 2.5) return 'regen';
  return 'lichte regen';
}

/**
 * kwartieren: [{ tijd: 'JJJJ-MM-DDTHH:MM', mm }], met tijd het einde van het
 * kwartier in de tijdzone van de plek; nu: hetzelfde formaat. Geeft
 * { nat, kop, rest } of null als er te weinig gegevens zijn.
 */
export function regenKomend(kwartieren, nu) {
  const komend = kwartieren.filter((k) => k.tijd > nu && k.mm !== null && k.mm !== undefined).slice(0, VENSTER);
  if (komend.length < 4) return null;
  const duur = komend.length === VENSTER ? 'twee uur' : `${komend.length * 15} minuten`;

  if (!isNat(komend[0])) {
    const i = komend.findIndex(isNat);
    if (i === -1) return { nat: false, kop: `Komende ${duur} droog`, rest: '' };
    const droogWeer = komend.findIndex((k, j) => j > i && !isNat(k));
    const bui = komend.slice(i, droogWeer === -1 ? undefined : droogWeer);
    return { nat: false, kop: `Droog tot ${beginVan(komend[i])}`, rest: `daarna ${soort(bui)}` };
  }

  const j = komend.findIndex((k) => !isNat(k));
  if (j === -1) {
    const s = soort(komend);
    return { nat: true, kop: s[0].toUpperCase() + s.slice(1), rest: `de komende ${duur}` };
  }
  return { nat: true, kop: `Droog vanaf ${beginVan(komend[j])}`, rest: `nu ${soort(komend.slice(0, j))}` };
}

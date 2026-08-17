// Spreiding en overeenstemming tussen de modellen.
//
// De vraag die deze module beantwoordt is niet "wat wordt het" maar "hoe zeker
// zijn de modellen het samen". Dat is bij een dag die nog ruim een week weg is
// het eigenlijke antwoord.

export function sorteerOp(waarden) {
  return [...waarden].sort((a, b) => a - b);
}

export function mediaan(waarden) {
  if (!waarden.length) return null;
  const s = sorteerOp(waarden);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function kwantiel(waarden, q) {
  if (!waarden.length) return null;
  const s = sorteerOp(waarden);
  const pos = (s.length - 1) * q;
  const onder = Math.floor(pos);
  const boven = Math.ceil(pos);
  if (onder === boven) return s[onder];
  return s[onder] + (s[boven] - s[onder]) * (pos - onder);
}

/** Haalt per bruikbaar model één veld op als {id, waarde}-paren. */
export function veldWaarden(resultaten, veld) {
  return resultaten
    .filter((r) => r.status === 'ok' && r.dag && r.dag[veld] !== null && r.dag[veld] !== undefined)
    .map((r) => ({ id: r.id, waarde: r.dag[veld] }));
}

function verdeling(paren) {
  const waarden = paren.map((p) => p.waarde);
  if (!waarden.length) return null;
  return {
    paren,
    waarden,
    aantal: waarden.length,
    mediaan: mediaan(waarden),
    min: Math.min(...waarden),
    max: Math.max(...waarden),
    p25: kwantiel(waarden, 0.25),
    p75: kwantiel(waarden, 0.75),
    iqr: kwantiel(waarden, 0.75) - kwantiel(waarden, 0.25),
    bereik: Math.max(...waarden) - Math.min(...waarden)
  };
}

/**
 * Oordeel over de mate van overeenstemming.
 * Temperatuur weegt via de interkwartielafstand (de middelste helft van de
 * modellen), zodat één uitschieter het beeld niet bepaalt. Neerslag weegt via de
 * vraag of de modellen het eens zijn over droog of nat — een verdeeld veld daar
 * is voor "kan het buiten" belangrijker dan een halve graad temperatuur.
 */
const komma = (v, decimalen = 1) => v.toFixed(decimalen).replace('.', ',');

export function beoordeel(temp, neerslag) {
  // Redenen krijgen een vlag mee: de reden die het oordeel bepaalt komt vooraan,
  // anders lees je eerst "ze zitten dicht bij elkaar" onder de kop "verdeeld".
  const redenen = [];
  const orde = { eens: 0, verdeeld: 1, oneens: 2 };
  let niveau = 'eens';
  const verhoogNaar = (n) => {
    if (orde[n] > orde[niveau]) niveau = n;
  };

  if (temp) {
    if (temp.iqr > 4) {
      verhoogNaar('oneens');
      redenen.push({ tekst: `de middelste helft van de modellen ligt ${komma(temp.iqr)} °C uit elkaar`, beslissend: true });
    } else if (temp.iqr > 2) {
      verhoogNaar('verdeeld');
      redenen.push({ tekst: `de temperaturen liggen ${komma(temp.iqr)} °C uit elkaar`, beslissend: true });
    } else {
      redenen.push({ tekst: `de temperaturen zitten binnen ${komma(temp.iqr)} °C van elkaar`, beslissend: false });
    }
  }

  if (neerslag) {
    const nat = neerslag.paren.filter((p) => p.waarde >= 1).length;
    const droog = neerslag.aantal - nat;
    const fractie = nat / neerslag.aantal;
    const geven = nat === 1 ? 'geeft' : 'geven';
    if (fractie > 0.25 && fractie < 0.75) {
      verhoogNaar('verdeeld');
      redenen.push({
        tekst: `${nat} van de ${neerslag.aantal} modellen ${geven} meer dan 1 mm regen en de rest houdt het droog`,
        beslissend: true
      });
    } else if (fractie >= 0.75) {
      redenen.push({ tekst: `${nat} van de ${neerslag.aantal} modellen ${geven} meer dan 1 mm regen`, beslissend: false });
    } else {
      redenen.push({
        tekst: `${droog} van de ${neerslag.aantal} modellen ${droog === 1 ? 'houdt' : 'houden'} het vrijwel droog`,
        beslissend: false
      });
    }
    if (neerslag.bereik > 12) {
      verhoogNaar('oneens');
      redenen.push({ tekst: 'de neerslagsommen lopen ver uiteen', beslissend: true });
    }
  }

  redenen.sort((a, b) => Number(b.beslissend) - Number(a.beslissend));

  const teksten = {
    eens: 'De modellen zijn het eens',
    verdeeld: 'De modellen zijn verdeeld',
    oneens: 'De modellen zijn het oneens'
  };
  const status = { eens: 'good', verdeeld: 'warning', oneens: 'serious' };
  const iconen = { eens: '✓', verdeeld: '≈', oneens: '✗' };

  return {
    niveau,
    tekst: teksten[niveau],
    status: status[niveau],
    icoon: iconen[niveau],
    reden: redenen.map((r) => r.tekst).join(', ')
  };
}

export function samenvatting(resultaten) {
  const temp = verdeling(veldWaarden(resultaten, 'tempMax'));
  const tempMin = verdeling(veldWaarden(resultaten, 'tempMin'));
  const neerslag = verdeling(veldWaarden(resultaten, 'neerslag'));
  const wind = verdeling(veldWaarden(resultaten, 'wind'));

  const bruikbaar = resultaten.filter((r) => r.status === 'ok').length;
  const buitenBereik = resultaten.filter((r) => r.status === 'buiten_bereik').length;
  const geenDekking = resultaten.filter((r) => r.status === 'geen_dekking').length;
  const fout = resultaten.filter((r) => r.status === 'fout').length;

  return {
    temp,
    tempMin,
    neerslag,
    wind,
    bruikbaar,
    buitenBereik,
    geenDekking,
    fout,
    totaal: resultaten.length,
    oordeel: bruikbaar >= 3 ? beoordeel(temp, neerslag) : null
  };
}

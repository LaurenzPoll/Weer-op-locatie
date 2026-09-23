// De klok en de kalender achter de 8-bitscène: waar de zon en de maan boven
// Heerlen staan, welke fase de maan heeft, en of het Kerstmis, carnaval of
// Koningsdag is. Benaderingen die op een paar graden en een paar uur na
// kloppen — genoeg voor een pixelhemel.

const BREEDTE = 50.888; // Heerlen
const LENGTE = 5.979;
const RAD = Math.PI / 180;

// Een bekende nieuwe maan (6 januari 2000, 18:14 UTC) en de lengte van een
// maancyclus.
const NIEUWE_MAAN = Date.UTC(2000, 0, 6, 18, 14);
const SYNODISCH = 29.530588853;

function hoogteEnUurhoek(dagen, eclLengte, lst) {
  const e = (23.439 - 0.00000036 * dagen) * RAD;
  const L = eclLengte * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / RAD;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  let uurhoek = (((lst - ra) % 360) + 540) % 360 - 180;
  const h = Math.asin(
    Math.sin(BREEDTE * RAD) * Math.sin(dec) + Math.cos(BREEDTE * RAD) * Math.cos(dec) * Math.cos(uurhoek * RAD)
  );
  return { hoogte: h / RAD, uurhoek };
}

/**
 * Zon en maan voor een tijdstip. Hoogte in graden boven de horizon, uurhoek in
 * graden (negatief in het oosten, 's ochtends), fase van 0 (nieuw) via 0,5
 * (vol) naar 1.
 */
export function hemel(datum) {
  const dagen = datum.getTime() / 86400000 - 10957.5;
  const g = (357.529 + 0.98560028 * dagen) * RAD;
  const q = 280.459 + 0.98564736 * dagen;
  const zonLengte = q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
  const gmst = 18.697374558 + 24.06570982441908 * dagen;
  const lst = (((gmst * 15 + LENGTE) % 360) + 360) % 360;
  const fase = ((((datum.getTime() - NIEUWE_MAAN) / 86400000 / SYNODISCH) % 1) + 1) % 1;
  return {
    zon: hoogteEnUurhoek(dagen, zonLengte, lst),
    // De maan loopt in een cyclus eens rond de ecliptica, voor de zon uit.
    maan: hoogteEnUurhoek(dagen, zonLengte + fase * 360, lst),
    fase
  };
}

function pasen(jaar) {
  const a = jaar % 19;
  const b = Math.floor(jaar / 100);
  const c = jaar % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maand = Math.floor((h + l - 7 * m + 114) / 31);
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(jaar, maand - 1, dag);
}

/**
 * Welke feesten er op een datum (lokale tijd) in de stad te zien zijn:
 * Kerstmis van 1 december tot Driekoningen, carnaval (vastelaovend, van
 * zaterdag tot en met dinsdag, en de elfde van de elfde) en Koningsdag.
 */
export function feesten(datum) {
  const j = datum.getFullYear();
  const m = datum.getMonth() + 1;
  const d = datum.getDate();
  const vandaag = Date.UTC(j, m - 1, d);
  const dagenNaPasen = (vandaag - pasen(j)) / 86400000;
  const koningsdag = new Date(j, 3, 27).getDay() === 0 ? 26 : 27;
  return {
    kerst: m === 12 || (m === 1 && d <= 6),
    carnaval: (dagenNaPasen >= -50 && dagenNaPasen <= -47) || (m === 11 && d === 11),
    koning: m === 4 && d === koningsdag
  };
}

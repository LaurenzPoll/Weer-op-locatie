// Controleert de modelcatalogus tegen de echte Open-Meteo-API: bestaat elk
// model-id nog, hoe ver reikt het werkelijk, en levert het waarden voor onze
// locatie? Handig na een wijziging in de catalogus en als periodieke controle,
// want Open-Meteo voegt modellen toe en hernoemt ze soms.
//
//   node scripts/check-models.mjs
//
// Geen npm-pakketten nodig: node 18+ heeft fetch aan boord.

import { LOCATION, TARGET_DATE } from '../js/config.js';
import { MODELLEN } from '../js/models.js';
import { bouwUrl } from '../js/api.js';

const kleur = process.stdout.isTTY
  ? { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[90m', uit: '\x1b[0m' }
  : { rood: '', groen: '', geel: '', grijs: '', uit: '' };

async function controleer(m) {
  const probeer = async (kern) => {
    const res = await fetch(bouwUrl(m.id, { kern }));
    const json = await res.json();
    if (json.error) throw new Error(json.reason ?? `HTTP ${res.status}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return json;
  };

  let json;
  let viaKern = false;
  try {
    json = await probeer(false);
  } catch {
    try {
      json = await probeer(true);
      viaKern = true;
    } catch (tweede) {
      return {
        id: m.id,
        naam: m.naam,
        status: 'FOUT',
        melding: tweede.message,
        opgegeven: m.horizon,
        dagen: '–',
        laatste: '–'
      };
    }
  }

  // Open-Meteo geeft altijd het volledige aantal opgevraagde dagen terug en vult
  // aan met null voorbij de horizon van het model. De lengte van de tijdas zegt
  // dus niets over het bereik; we tellen de dagen die echt waarden hebben.
  const dagen = json?.daily?.time ?? [];
  const i = dagen.indexOf(TARGET_DATE);
  const temps = json?.daily?.temperature_2m_max ?? [];
  const neers = json?.daily?.precipitation_sum ?? [];
  const heeftWaarde = (j) => (temps[j] ?? null) !== null || (neers[j] ?? null) !== null;

  let gevuld = 0;
  let laatsteMetData = null;
  for (let j = 0; j < dagen.length; j++) {
    if (heeftWaarde(j)) {
      gevuld++;
      laatsteMetData = dagen[j];
    }
  }

  let status = 'OK';
  if (!dagen.length) status = 'LEEG';
  else if (gevuld === 0) status = 'GEEN DEKKING';
  else if (i === -1 || !heeftWaarde(i)) status = 'REIKT NIET TOT DOELDAG';

  return {
    id: m.id,
    naam: m.naam,
    status,
    dagen: gevuld,
    tempGevuld: temps.filter((v) => v !== null).length,
    neerslagGevuld: neers.filter((v) => v !== null).length,
    laatste: laatsteMetData ?? '–',
    doelwaarde: i === -1 ? null : temps[i],
    opgegeven: m.horizon,
    viaKern
  };
}

const resultaten = [];
for (const m of MODELLEN) {
  resultaten.push(await controleer(m));
  await new Promise((r) => setTimeout(r, 250)); // rustig aan tegen de gratis API
}

const breedte = Math.max(...resultaten.map((r) => r.id.length));
console.log(
  `\nControle voor ${LOCATION.naam} (${LOCATION.latitude}, ${LOCATION.longitude}) op ${TARGET_DATE}\n`
);
console.log(
  `${'model'.padEnd(breedte)}  ${'status'.padEnd(22)}  dagen met data  opgegeven  laatste dag met data  waarde doeldag`
);
console.log('-'.repeat(breedte + 70));

for (const r of resultaten) {
  const c = r.status === 'OK' ? kleur.groen : r.status === 'FOUT' ? kleur.rood : kleur.geel;
  const opgegeven = r.opgegeven ? String(r.opgegeven).replace('.', ',') : '–';
  const regel =
    `${r.id.padEnd(breedte)}  ${c}${r.status.padEnd(22)}${kleur.uit}  ` +
    `${String(r.dagen ?? '–').padStart(14)}  ${opgegeven.padStart(9)}  ${String(r.laatste).padStart(20)}  ` +
    `${r.doelwaarde === null || r.doelwaarde === undefined ? '–' : `${r.doelwaarde} °C`}`;
  console.log(regel + (r.viaKern ? `${kleur.grijs}  (alleen kernvariabelen)${kleur.uit}` : ''));
  if (r.melding) console.log(`${' '.repeat(breedte + 2)}${kleur.rood}${r.melding}${kleur.uit}`);
}

const fouten = resultaten.filter((r) => r.status === 'FOUT');
const geenDekking = resultaten.filter((r) => r.status === 'GEEN DEKKING');
const buiten = resultaten.filter((r) => r.status === 'REIKT NIET TOT DOELDAG');
const ok = resultaten.filter((r) => r.status === 'OK');

console.log(
  `\n${ok.length} met data · ${buiten.length} reiken nog niet tot de doeldag · ` +
    `${geenDekking.length} zonder dekking hier · ${fouten.length} met een fout\n`
);

// Verschil tussen wat de catalogus opgeeft en wat de API werkelijk levert.
const afwijkend = resultaten.filter(
  (r) => r.status !== 'FOUT' && r.opgegeven && Math.abs(r.dagen - r.opgegeven) > 1.5
);
if (afwijkend.length) {
  console.log('Horizon in de catalogus wijkt af van de werkelijkheid — bijstellen in js/models.js:');
  for (const r of afwijkend) {
    console.log(`  ${r.id}: opgegeven ${String(r.opgegeven).replace('.', ',')} dagen, geleverd ${r.dagen}`);
  }
  console.log('');
}

if (geenDekking.length) {
  console.log('Zonder dekking op deze locatie (overweeg weglaten of als "dekkingOnzeker" markeren):');
  for (const r of geenDekking) {
    console.log(`  ${r.id}: temperatuur ${r.tempGevuld} dagen gevuld, neerslag ${r.neerslagGevuld} dagen gevuld`);
  }
  console.log('');
}

// Een onbekend model-id is een echte fout: dan klopt de catalogus niet meer.
if (fouten.length) {
  console.error('Er zijn modellen die de API niet accepteert. Controleer de identifiers in js/models.js.');
  process.exit(1);
}

// Schrijft js/versie.js: een vingerafdruk van de code van de app.
//
//   node scripts/versie.mjs
//
// Draai dit na elke wijziging aan de pagina, de opmaak of de scripts; de tests
// falen als het vergeten is. De app vergelijkt zijn eigen vingerafdruk met die
// op de server, en weet zo zeker of hij een oude versie draait — ook als de
// service worker zijn cache intussen al heeft bijgewerkt.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const wortel = new URL('../', import.meta.url);
const VERSIEBESTAND = 'js/versie.js';

// Alles wat de pagina draait. De service worker, het manifest en de iconen
// tellen niet mee: daarvoor hoeft de pagina niet opnieuw te laden.
function codebestanden() {
  const scripts = readdirSync(new URL('js/', wortel))
    .filter((naam) => naam.endsWith('.js'))
    .map((naam) => `js/${naam}`);
  return ['index.html', 'styles.css', ...scripts].filter((pad) => pad !== VERSIEBESTAND).sort();
}

export function berekenVersie() {
  const hash = createHash('sha256');
  for (const pad of codebestanden()) {
    // Regeleinden gelijk trekken: GitHub Pages serveert de bestanden zoals ze
    // in git staan, met \n.
    const inhoud = readFileSync(new URL(pad, wortel), 'utf8').replace(/\r\n/g, '\n');
    hash.update(`${pad}\0${inhoud}\0`);
  }
  return hash.digest('hex').slice(0, 12);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const versie = berekenVersie();
  writeFileSync(
    new URL(VERSIEBESTAND, wortel),
    `// Geschreven door scripts/versie.mjs; niet met de hand aanpassen.\nexport const VERSIE = '${versie}';\n`
  );
  console.log(`${VERSIEBESTAND}: ${versie}`);
}

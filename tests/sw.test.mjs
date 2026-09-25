// De service worker moet elk bestand van de app kennen, anders werkt dat
// bestand offline niet en merkt de versiecontrole een wijziging erin niet op.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const wortel = new URL('../', import.meta.url);
const sw = readFileSync(new URL('sw.js', wortel), 'utf8');
const lijst = (naam) =>
  [...sw.match(new RegExp(`const ${naam} = \\[([^\\]]*)\\]`))[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
const code = lijst('CODE');
const bijlagen = lijst('BIJLAGEN');

test('elk script en de opmaak staan in CODE', () => {
  for (const f of readdirSync(new URL('js/', wortel)))
    if (f.endsWith('.js')) assert.ok(code.includes(`js/${f}`), `js/${f}`);
  assert.ok(code.includes('styles.css'));
  assert.ok(code.includes(''), 'de pagina zelf (./)');
});

test('elk lettertype en icoon staat in BIJLAGEN', () => {
  for (const f of readdirSync(new URL('fonts/', wortel)))
    if (f.endsWith('.woff2')) assert.ok(bijlagen.includes(`fonts/${f}`), `fonts/${f}`);
  for (const f of readdirSync(new URL('icons/', wortel))) assert.ok(bijlagen.includes(`icons/${f}`), `icons/${f}`);
});

test('alles wat de service worker noemt, bestaat', () => {
  for (const f of [...code, ...bijlagen].filter(Boolean)) assert.ok(existsSync(new URL(f, wortel)), f);
});

test('de iconen uit het manifest bestaan', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', wortel), 'utf8'));
  for (const i of manifest.icons) assert.ok(existsSync(new URL(i.src, wortel)), i.src);
});

// De pagina zelf: laadt hij alle scripts in één ronde, en niet meer dan nodig?

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wortel = new URL('../', import.meta.url);
const lees = (pad) => readFileSync(new URL(pad, wortel), 'utf8');

// Alle modules die app.js statisch importeert, direct of via via.
function statischeModules() {
  const gezien = new Set();
  const bezoek = (bestand) => {
    if (gezien.has(bestand)) return;
    gezien.add(bestand);
    for (const m of lees(`js/${bestand}`).matchAll(/^\s*(?:import|export)\s[^;]*?from\s+'\.\/([^']+)'/gms)) {
      bezoek(m[1]);
    }
  };
  bezoek('app.js');
  gezien.delete('app.js');
  return gezien;
}

test('elke module die app.js nodig heeft, staat als modulepreload in de pagina', () => {
  const html = lees('index.html');
  const vooraf = new Set([...html.matchAll(/<link rel="modulepreload" href="js\/([^"]+)"/g)].map((m) => m[1]));
  assert.deepEqual([...vooraf].sort(), [...statischeModules()].sort());
});

test('de 8-bitscène wordt niet vooraf geladen en niet statisch geïmporteerd', () => {
  for (const m of statischeModules()) assert.ok(!m.startsWith('scene'), m);
});

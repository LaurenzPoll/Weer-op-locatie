// De versie in js/versie.js moet bij de code horen: daaraan ziet een geopende
// app dat er een nieuwe versie op de server staat.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSIE } from '../js/versie.js';
import { berekenVersie } from '../scripts/versie.mjs';

test('js/versie.js hoort bij de huidige code', () => {
  assert.equal(VERSIE, berekenVersie(), 'js/versie.js is verouderd: draai node scripts/versie.mjs');
});

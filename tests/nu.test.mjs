// De zin over regen in het komende uur.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { regenKomend } from '../js/nu.js';

// Kwartieren die eindigen om 14:15, 14:30, … met deze neerslag.
const reeks = (mm) =>
  mm.map((w, i) => ({
    tijd: new Date(Date.parse('2026-09-25T14:00:00Z') + (i + 1) * 900000).toISOString().slice(0, 16),
    mm: w
  }));
const NU = '2026-09-25T14:20';

test('helemaal droog', () => {
  assert.deepEqual(regenKomend(reeks([0, 0, 0, 0, 0, 0, 0, 0, 0]), NU), {
    nat: false,
    kop: 'Komende twee uur droog',
    rest: ''
  });
});

test('droog, dan regen: de tijd is het begin van het eerste natte kwartier', () => {
  const r = regenKomend(reeks([0, 0, 0, 0.2, 0.5, 0, 0, 0, 0]), NU);
  assert.equal(r.kop, 'Droog tot 14:45');
  assert.equal(r.rest, 'daarna lichte regen');
});

test('het regent nu en houdt op', () => {
  const r = regenKomend(reeks([0.3, 0.2, 0, 0, 0, 0, 0, 0, 0]), NU);
  assert.equal(r.nat, true);
  assert.equal(r.kop, 'Droog vanaf 14:30');
  assert.equal(r.rest, 'nu lichte regen');
});

test('de hele tijd nat, met de zwaarte van de bui', () => {
  const r = regenKomend(reeks([1, 3, 3, 2, 1, 1, 2, 2, 1]), NU);
  assert.deepEqual([r.kop, r.rest], ['Zware buien', 'de komende twee uur']);
  // Het eerste kwartier (tot 14:15) is al voorbij; vanaf 14:30 2,8 mm per uur.
  assert.equal(regenKomend(reeks([0, 0, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7]), NU).rest, 'daarna regen');
});

test('te weinig gegevens: niets zeggen', () => {
  assert.equal(regenKomend(reeks([0, 0, 0]), NU), null);
  assert.equal(regenKomend(reeks([null, null, null, null, null, 0, 0, 0]), NU), null);
});

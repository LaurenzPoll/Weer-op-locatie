// Datums en plekken, altijd in de tijdzone van de plek.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCATION, STANDAARD_PLEK, datumVoor, isPlek, tijdOpLocatie, uurNu, zelfdePlek } from '../js/config.js';

test('buiten de browser is de plek de standaardplek', () => {
  assert.deepEqual(LOCATION, STANDAARD_PLEK);
});

test('vandaag en morgen wisselen om middernacht in Amsterdam, niet in UTC', () => {
  const laat = new Date('2026-09-24T22:30:00Z'); // 00:30 op de 25e in Amsterdam
  assert.equal(datumVoor('vandaag', laat), '2026-09-25');
  assert.equal(datumVoor('morgen', laat), '2026-09-26');
  assert.equal(datumVoor('morgen', new Date('2026-12-31T12:00:00Z')), '2027-01-01');
});

test('tijd en uur op de klok van de plek', () => {
  const t = new Date('2026-09-25T12:20:00Z');
  assert.equal(tijdOpLocatie(t), '2026-09-25T14:20');
  assert.equal(uurNu(t), 14);
  assert.equal(uurNu(new Date('2026-01-15T12:20:00Z')), 13);
});

test('wat een geldige plek is', () => {
  assert.ok(isPlek(STANDAARD_PLEK));
  assert.ok(!isPlek({ ...STANDAARD_PLEK, latitude: 95 }));
  assert.ok(!isPlek({ ...STANDAARD_PLEK, timezone: 'Nergens/Niets' }));
  assert.ok(!isPlek({ ...STANDAARD_PLEK, naam: undefined }));
  assert.ok(zelfdePlek(STANDAARD_PLEK, { latitude: 50.8885, longitude: 5.9791 }));
  assert.ok(!zelfdePlek(STANDAARD_PLEK, { latitude: 50.85, longitude: 5.69 }));
});

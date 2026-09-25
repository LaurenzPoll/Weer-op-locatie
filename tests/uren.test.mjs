// Welke uren het rooster laat zien, op de klok van de plek.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uurKolommen } from '../js/uren.js';

const vrijdagMiddag = new Date('2026-09-25T12:20:00Z'); // 14:20 in Amsterdam

test('vandaag: het uur van nu vooraan en 24 uur vooruit, door de nacht heen', () => {
  const k = uurKolommen('vandaag', vrijdagMiddag);
  assert.equal(k.length, 25);
  assert.deepEqual([k[0].sleutel, k[0].nu], ['2026-09-25T14', true]);
  assert.equal(k.filter((x) => x.nu).length, 1);
  assert.equal(k.at(-1).sleutel, '2026-09-26T14');
  // Waar zaterdag begint.
  const nieuw = k.filter((x) => x.nieuweDag);
  assert.deepEqual(
    nieuw.map((x) => [x.sleutel, x.dagKort]),
    [['2026-09-26T00', 'za']]
  );
});

test('de nachturen: de zon gaat om 19:29 onder en komt om 07:26 op', () => {
  const nacht = uurKolommen('vandaag', vrijdagMiddag)
    .filter((x) => x.nacht)
    .map((x) => x.uur);
  assert.deepEqual(nacht, [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6]);
});

test('morgen: de hele dag, zonder uur van nu', () => {
  const k = uurKolommen('morgen', vrijdagMiddag);
  assert.equal(k.length, 24);
  assert.deepEqual([k[0].sleutel, k.at(-1).sleutel], ['2026-09-26T00', '2026-09-26T23']);
  assert.ok(!k.some((x) => x.nu));
});

test('vlak voor middernacht begint morgen al in de tweede kolom', () => {
  const k = uurKolommen('vandaag', new Date('2026-09-25T21:40:00Z')); // 23:40
  assert.deepEqual([k[0].sleutel, k[1].sleutel, k[1].nieuweDag], ['2026-09-25T23', '2026-09-26T00', true]);
});

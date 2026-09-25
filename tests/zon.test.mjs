// Zonsopkomst en -ondergang, tegen bekende tijden.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zonOpOnder } from '../js/zon.js';

const klok = (datum, tz = 'Europe/Amsterdam') =>
  datum.toLocaleTimeString('nl-NL', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
const minuten = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const binnen = (gekregen, verwacht, marge = 2) =>
  assert.ok(Math.abs(minuten(gekregen) - minuten(verwacht)) <= marge, `${gekregen} is geen ${verwacht}`);

test('Amsterdam op de langste en de kortste dag', () => {
  const zomer = zonOpOnder('2024-06-21', 52.374, 4.8897);
  binnen(klok(zomer.op), '05:18');
  binnen(klok(zomer.onder), '22:06');
  const winter = zonOpOnder('2024-12-21', 52.374, 4.8897);
  binnen(klok(winter.op), '08:48');
  binnen(klok(winter.onder), '16:29');
});

test('het zuidelijk halfrond', () => {
  const sydney = zonOpOnder('2026-06-21', -33.87, 151.21);
  binnen(klok(sydney.op, 'Australia/Sydney'), '07:00');
  binnen(klok(sydney.onder, 'Australia/Sydney'), '16:53');
});

test('poolnacht en middernachtzon', () => {
  assert.deepEqual(zonOpOnder('2026-12-21', 69.65, 18.96), { poolnacht: true });
  assert.deepEqual(zonOpOnder('2026-06-21', 69.65, 18.96), { middernachtzon: true });
});

// Van een Open-Meteo-antwoord naar wat de app toont, en wat een ontbrekende
// waarde betekent.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseer } from '../js/api.js';

const dagen = ['2026-09-25', '2026-09-26', '2026-09-27'];

test('een model met waarden voor de dag', () => {
  const r = normaliseer(
    'x',
    {
      daily: {
        time: dagen,
        temperature_2m_max: [20, 21, null],
        precipitation_sum: [0, 1.5, null],
        sunshine_duration: [7200, 0, null]
      },
      hourly: {
        time: ['2026-09-25T13:00', '2026-09-26T13:00'],
        temperature_2m: [19, 20],
        precipitation: [0, 0.4],
        sunshine_duration: [1800, 0]
      }
    },
    '2026-09-26'
  );
  assert.equal(r.status, 'ok');
  assert.equal(r.dag.tempMax, 21);
  assert.equal(r.dag.zonuren, 0);
  assert.equal(r.horizonDagen, 2);
  assert.deepEqual(
    r.uren.map((u) => [u.uur, u.neerslag, u.zon]),
    [[13, 0.4, 0]]
  );
});

test('voorbij de horizon van het model: reikt nog niet zo ver', () => {
  const ruw = { daily: { time: dagen, temperature_2m_max: [20, null, null], precipitation_sum: [0, null, null] } };
  const r = normaliseer('x', ruw, '2026-09-26');
  assert.equal(r.status, 'buiten_bereik');
  assert.equal(r.laatsteDag, '2026-09-25');
});

test('nergens een waarde: geen dekking op deze plek', () => {
  const ruw = { daily: { time: dagen, temperature_2m_max: [null, null, null], precipitation_sum: [null, null, null] } };
  assert.equal(normaliseer('x', ruw, '2026-09-25').status, 'geen_dekking');
});

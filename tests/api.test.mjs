// Van een Open-Meteo-antwoord naar wat de app toont, en wat een ontbrekende
// waarde betekent.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haalAlles, metPool, normaliseer } from '../js/api.js';
import { datumVoor } from '../js/config.js';

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

test('metPool: nooit meer dan n tegelijk, en alles komt aan de beurt', async () => {
  let bezig = 0;
  let hoogste = 0;
  const klaar = [];
  const taken = Array.from({ length: 10 }, (_, i) => async () => {
    bezig++;
    hoogste = Math.max(hoogste, bezig);
    await new Promise((r) => setTimeout(r, 5 + (i % 3) * 5));
    bezig--;
    klaar.push(i);
  });
  await metPool(taken, 3);
  assert.equal(hoogste, 3);
  assert.deepEqual(
    [...klaar].sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  );
});

// Een nagebootste Open-Meteo: per model een reeks antwoorden, één per poging.
function nepApi(perModel) {
  const pogingen = {};
  // Vandaag én morgen: na 20:00 haalt de app morgen op.
  const goed = {
    daily: {
      time: [datumVoor('vandaag'), datumVoor('morgen')],
      temperature_2m_max: [20, 20],
      precipitation_sum: [0, 0]
    },
    hourly: { time: [], temperature_2m: [], precipitation: [] }
  };
  globalThis.fetch = async (url) => {
    const model = new URL(url).searchParams.get('models');
    const n = (pogingen[model] = (pogingen[model] ?? 0) + 1);
    const plan = perModel[model] ?? ['goed'];
    const stap = plan[Math.min(n, plan.length) - 1];
    if (stap === 'netwerk') throw new TypeError('Load failed');
    if (stap === 'druk') return new Response('{"error":true,"reason":"te druk"}', { status: 429 });
    if (stap === 'onbekend') return new Response('{"error":true,"reason":"onbekende variabele"}', { status: 400 });
    return new Response(JSON.stringify(goed), { status: 200 });
  };
  return pogingen;
}

test('een tijdelijke fout wordt opnieuw geprobeerd, met de tussenstand erbij', async () => {
  const echt = globalThis.fetch;
  const pogingen = nepApi({ ecmwf_ifs025: ['netwerk', 'goed'], dwd_icon_d2: ['druk', 'goed'] });
  const tussenstanden = [];
  try {
    const { resultaten, onvolledig } = await haalAlles({ bijTussenstand: (_, n) => tussenstanden.push(n) });
    assert.equal(onvolledig, false);
    assert.equal(resultaten.find((r) => r.id === 'ecmwf_ifs025').status, 'ok');
    assert.equal(resultaten.find((r) => r.id === 'dwd_icon_d2').status, 'ok');
    assert.equal(pogingen.ecmwf_ifs025, 2);
    assert.deepEqual(tussenstanden, [2], 'één tussenstand, met twee modellen die opnieuw moeten');
  } finally {
    globalThis.fetch = echt;
  }
});

test('een vaste fout wordt niet herhaald; wie blijft haperen maakt de ophaal onvolledig', async () => {
  const echt = globalThis.fetch;
  const pogingen = nepApi({ jma_gsm: ['onbekend'], cma_grapes_global: ['netwerk'] });
  try {
    const { resultaten, onvolledig } = await haalAlles();
    // Vaste fout: één poging met alles en één met de kernvariabelen, dan klaar.
    assert.equal(pogingen.jma_gsm, 2);
    const jma = resultaten.find((r) => r.id === 'jma_gsm');
    assert.deepEqual([jma.status, jma.tijdelijk], ['fout', false]);
    // Tijdelijke fout: drie pogingen, en dan telt de ophaal als onvolledig.
    assert.equal(pogingen.cma_grapes_global, 3);
    const grapes = resultaten.find((r) => r.id === 'cma_grapes_global');
    assert.deepEqual([grapes.status, grapes.tijdelijk], ['fout', true]);
    assert.equal(onvolledig, true);
  } finally {
    globalThis.fetch = echt;
  }
});

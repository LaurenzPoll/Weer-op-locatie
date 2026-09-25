// De spreiding en het oordeel bovenaan de pagina.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beoordeel, kwantiel, mediaan, samenvatting } from '../js/stats.js';

const model = (id, tempMax, neerslag, status = 'ok') =>
  status === 'ok' ? { id, status, dag: { tempMax, tempMin: 10, neerslag, wind: 12 } } : { id, status };

test('mediaan en kwantielen', () => {
  assert.equal(mediaan([]), null);
  assert.equal(mediaan([3, 1, 2]), 2);
  assert.equal(mediaan([4, 1, 3, 2]), 2.5);
  assert.equal(kwantiel([1, 2, 3, 4, 5], 0.25), 2);
  assert.equal(kwantiel([1, 2, 3, 4], 0.75), 3.25);
});

test('eens: temperaturen dicht bij elkaar en overal droog', () => {
  const s = samenvatting([model('a', 20, 0), model('b', 20.5, 0.2), model('c', 21, 0), model('d', 20.2, 0)]);
  assert.equal(s.oordeel.niveau, 'eens');
  assert.equal(s.oordeel.status, 'good');
  assert.match(s.oordeel.reden, /houden het vrijwel droog/);
});

test('verdeeld: de helft geeft regen, en die reden staat vooraan', () => {
  const s = samenvatting([model('a', 20, 0), model('b', 20, 3), model('c', 20, 0), model('d', 20, 2)]);
  assert.equal(s.oordeel.niveau, 'verdeeld');
  assert.match(s.oordeel.reden, /^2 van de 4 modellen geven meer dan 1 mm regen/);
});

test('oneens: de middelste helft ligt meer dan 4 graden uit elkaar', () => {
  const s = samenvatting([model('a', 14, 0), model('b', 16, 0), model('c', 22, 0), model('d', 25, 0)]);
  assert.equal(s.oordeel.niveau, 'oneens');
  assert.match(s.oordeel.reden, /^de middelste helft van de modellen ligt/);
});

test('oneens: neerslagsommen lopen ver uiteen, ook als bijna alles nat is', () => {
  const t = { iqr: 1 };
  const n = { paren: [{ waarde: 2 }, { waarde: 3 }, { waarde: 20 }, { waarde: 4 }], aantal: 4, bereik: 18 };
  assert.equal(beoordeel(t, n).niveau, 'oneens');
});

test('geen oordeel met minder dan drie bruikbare modellen, wel de tellingen', () => {
  const s = samenvatting([
    model('a', 20, 0),
    model('b', 21, 0),
    model('c', null, null, 'buiten_bereik'),
    model('d', null, null, 'geen_dekking'),
    model('e', null, null, 'fout')
  ]);
  assert.equal(s.oordeel, null);
  assert.deepEqual([s.bruikbaar, s.buitenBereik, s.geenDekking, s.fout, s.totaal], [2, 1, 1, 1, 5]);
});

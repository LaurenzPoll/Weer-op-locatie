// "Wie had gelijk?": welke verwachting telt, en hoe een model scoort.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beoordeel, beoordeelDag, kiesVerwachting, ranglijst } from '../js/uitslag.js';

const punt = (ts, datum, modellen) => ({ ts, datum, modellen });

test('de laatste verwachting van de dag ervoor telt, in de tijdzone van de plek', () => {
  const verleden = [
    punt('2026-09-23T08:00:00Z', '2026-09-24', { a: { t: 18, n: 0 } }),
    punt('2026-09-23T20:00:00Z', '2026-09-24', { a: { t: 19, n: 0 } }),
    // 22:30 UTC is al 00:30 op de 24e in Amsterdam: dat is de dag zelf.
    punt('2026-09-23T22:30:00Z', '2026-09-24', { a: { t: 25, n: 0 } })
  ];
  const keuze = kiesVerwachting(verleden, '2026-09-24');
  assert.equal(keuze.dagErvoor, true);
  assert.equal(keuze.punt.modellen.a.t, 19);
});

test('zonder verwachting van de dag ervoor: de vroegste van de dag zelf', () => {
  const verleden = [
    punt('2026-09-24T12:00:00Z', '2026-09-24', { a: { t: 21, n: 0 } }),
    punt('2026-09-24T06:00:00Z', '2026-09-24', { a: { t: 20, n: 0 } })
  ];
  const keuze = kiesVerwachting(verleden, '2026-09-24');
  assert.equal(keuze.dagErvoor, false);
  assert.equal(keuze.punt.modellen.a.t, 20);
  assert.equal(kiesVerwachting(verleden, '2026-09-25'), null);
});

test('raak is binnen 1,5 graad én goed over droog of nat; Best Match doet niet mee', () => {
  const rijen = beoordeelDag(
    {
      modellen: {
        goed: { t: 20.5, n: 0 },
        warm: { t: 23, n: 0 },
        nat: { t: 20, n: 4 },
        best_match: { t: 20, n: 0 },
        leeg: { t: null, n: 0 }
      }
    },
    { t: 20, n: 0.2 }
  );
  assert.deepEqual(
    rijen.map((r) => [r.id, r.raak]),
    [
      ['goed', true],
      ['nat', false],
      ['warm', false]
    ]
  );
  // Droog en nat verwisselen weegt zwaarder dan een graad of drie ernaast? Nee:
  // 2 strafpunten plus 0,4 voor de millimeters, tegen 3 graden.
  assert.ok(rijen[1].fout < rijen[2].fout);
});

test('de ranglijst middelt over dagen, beste eerst', () => {
  const verleden = [
    punt('2026-09-22T18:00:00Z', '2026-09-23', { a: { t: 20, n: 0 }, b: { t: 24, n: 0 } }),
    punt('2026-09-23T18:00:00Z', '2026-09-24', { a: { t: 18, n: 0 }, b: { t: 18, n: 5 } })
  ];
  const terugblik = { '2026-09-23': { t: 20, n: 0 }, '2026-09-24': { t: 18, n: 0 } };
  const dagen = beoordeel(verleden, terugblik);
  assert.deepEqual(
    dagen.map((d) => d.datum),
    ['2026-09-24', '2026-09-23']
  );
  const stand = ranglijst(dagen);
  assert.equal(stand[0].id, 'a');
  assert.equal(stand[0].raak, 2);
  assert.equal(stand[1].raak, 0);
});

// Browsertests: de app zoals je hem op de telefoon gebruikt, in Chromium.
//
//   node --test tests/browser/*.browser.mjs
//
// Nodig: het npm-pakket playwright met Chromium (zie de workflow Tests).

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

let browser;
let server;

before(async () => {
  [browser, server] = await Promise.all([chromium.launch(), startServer()]);
});

after(async () => {
  await browser?.close();
  await server?.stop();
});

// Een nieuwe, schone telefoon: eigen opslag, eigen service worker. Verzoeken
// naar buiten gaan niet door, tenzij een test ze zelf beantwoordt.
async function telefoon({ sw = false, ...opties } = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: sw ? 'allow' : 'block',
    ...opties
  });
  await context.route(/^https:\/\//, (route) => route.abort());
  const page = await context.newPage();
  const fouten = [];
  page.on('pageerror', (fout) => fouten.push(fout.message));
  return { context, page, fouten };
}

const wachtOpKaart = (page) => page.waitForSelector('#consensus .lucht-temp', { timeout: 15000 });

test('een nieuwe versie wordt gemeld en met één tik geladen', async () => {
  const { context, page, fouten } = await telefoon({ sw: true });
  try {
    await page.goto(`${server.url}?mock=1`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await wachtOpKaart(page);
    assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'de service worker regelt de pagina');

    // Niets veranderd: geen melding.
    await page.click('#verversen');
    await page.waitForTimeout(800);
    assert.ok(await page.locator('#nieuwe-versie').isHidden());

    // Een nieuwe versie op de server.
    await server.wijzig('js/format.js', (t) => `${t}\nwindow.__versie = 2;\n`);
    await page.click('#verversen');
    await page.waitForSelector('#nieuwe-versie:not([hidden])', { timeout: 5000 });
    assert.equal(await page.evaluate(() => window.__versie), undefined, 'nog de oude versie tot je laadt');
    await Promise.all([page.waitForNavigation(), page.click('#versie-laden')]);
    assert.equal(await page.evaluate(() => window.__versie), 2);

    // Gewoon herladen geeft meteen de nieuwste, ondanks de tien minuten cache.
    await server.wijzig('js/format.js', (t) => `${t}\nwindow.__versie = 3;\n`);
    await page.reload();
    assert.equal(await page.evaluate(() => window.__versie), 3);
    assert.deepEqual(fouten, []);
  } finally {
    await server.herstel();
    await context.close();
  }
});

test('zonder verbinding start de app uit de cache', async () => {
  const { context, page, fouten } = await telefoon({ sw: true });
  try {
    await page.goto(`${server.url}?mock=1`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await wachtOpKaart(page);
    server.zetUit(true);
    await page.reload();
    await wachtOpKaart(page);
    assert.equal(await page.textContent('#plaats'), 'Heerlen');
    assert.deepEqual(fouten, []);
  } finally {
    server.zetUit(false);
    await context.close();
  }
});

test('oude gegevens staan er meteen, terwijl de nieuwe binnenkomen', async () => {
  const { context, page } = await telefoon();
  try {
    await page.goto(`${server.url}?mock=1`);
    await wachtOpKaart(page);
    // Maak de bewaarde gegevens twee uur oud, en laat de nieuwe drie seconden op zich wachten.
    await page.evaluate(() => {
      const sleutel = 'weer-op-locatie:cache:v2';
      const cache = JSON.parse(localStorage.getItem(sleutel));
      cache.opgehaaldOp = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      localStorage.setItem(sleutel, JSON.stringify(cache));
    });
    server.vertraag('/dev/fixture.json', 3000);
    const begin = Date.now();
    await page.reload();
    await wachtOpKaart(page);
    assert.ok(Date.now() - begin < 2500, 'de kaart staat er voordat de nieuwe gegevens binnen zijn');
    assert.match(await page.textContent('#ophaalstatus'), /nieuwe gegevens ophalen/);
    await page.waitForFunction(() => !document.getElementById('ophaalstatus').textContent.includes('ophalen'), null, {
      timeout: 8000
    });
  } finally {
    server.vertraag('/dev/fixture.json', 0);
    await context.close();
  }
});

test('een andere plek kiezen, met het weer achter elke bewaarde plek', async () => {
  const { context, page, fouten } = await telefoon();
  try {
    await page.goto(`${server.url}?mock=1`);
    await wachtOpKaart(page);
    await page.click('#plek-knop');
    await page.waitForSelector('#plek-bewaard .plek-weer:not(:empty)');
    assert.match(await page.locator('#plek-bewaard .plek-weer').first().innerText(), /\d+°/);
    await page.fill('#plek-zoek', 'maa');
    await page.waitForSelector('#plek-resultaten:not([hidden]) .plek-kies');
    await Promise.all([page.waitForNavigation(), page.locator('#plek-resultaten .plek-kies').first().click()]);
    await wachtOpKaart(page);
    assert.equal(await page.textContent('#plaats'), 'Maastricht');
    const sleutels = await page.evaluate(() => Object.keys(localStorage));
    assert.ok(sleutels.includes('weer-op-locatie:cache:v2:50.848,5.689'), 'eigen cache per plek');
    assert.deepEqual(fouten, []);
  } finally {
    await context.close();
  }
});

test('delen zet het oordeel met een link naar dezelfde dag en plek op het klembord', async () => {
  const { context, page } = await telefoon({ permissions: ['clipboard-read', 'clipboard-write'] });
  try {
    await page.goto(`${server.url}?mock=1`);
    await wachtOpKaart(page);
    await page.evaluate(() => delete Navigator.prototype.share);
    await page.click('[data-actie="delen"]');
    await page.waitForFunction(() => document.getElementById('melding').textContent.includes('Gekopieerd'));
    const tekst = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(tekst, /^(Vandaag|Morgen) in Heerlen/);
    assert.match(tekst, /plek=Heerlen&regio=Limburg&lat=50\.8882&lon=5\.9795/);
  } finally {
    await context.close();
  }
});

test('op vandaag markeert het rooster het huidige uur', async () => {
  const { context, page } = await telefoon();
  try {
    // Vrijdag 14:20 in Amsterdam.
    await page.clock.install({ time: new Date('2026-09-25T12:20:00Z') });
    await page.goto(`${server.url}?mock=1&dag=vandaag`);
    await wachtOpKaart(page);
    await page.waitForSelector('.rooster thead th.is-nu');
    assert.match(await page.textContent('.rooster thead th.is-nu'), /14$/);
    assert.equal(await page.locator('.rooster thead th.is-voorbij').count(), 3);
    await page.waitForSelector('#lucht-nu:not([hidden])');
    assert.match(await page.textContent('#lucht-nu'), /Droog tot|droog|regen/i);
  } finally {
    await context.close();
  }
});

test('de 8-bitscène wordt pas geladen als je hem aanzet', async () => {
  const { context, page, fouten } = await telefoon();
  const geladen = [];
  page.on('request', (verzoek) => geladen.push(new URL(verzoek.url()).pathname));
  try {
    await page.goto(`${server.url}?mock=1`);
    await wachtOpKaart(page);
    assert.ok(!geladen.some((p) => p.includes('scene')), 'geen scène bij het openen');
    for (let i = 0; i < 5; i++) await page.click('#plaats');
    await page.waitForSelector('canvas.lucht-scene');
    assert.ok(geladen.includes('/js/scene.js'));
    assert.deepEqual(fouten, []);
  } finally {
    await context.close();
  }
});

// Het echte pad, zonder mockmodus: de verzoeken naar Open-Meteo beantwoorden
// we hier zelf met de fixture. Eén model antwoordt de eerste keer niet.
test('tegen de API: zes tegelijk, drie dagen, en een traag model komt bij de herkansing alsnog binnen', async () => {
  const fixture = JSON.parse(readFileSync(new URL('../../dev/fixture.json', import.meta.url), 'utf8'));
  const vandaag = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
  const verschil = Math.round(
    (Date.parse(`${vandaag}T12:00:00Z`) - Date.parse(`${fixture.__doel}T12:00:00Z`)) / 86400000
  );
  const schuif = (tijden) =>
    tijden.map(
      (t) =>
        new Date(Date.parse(`${t.slice(0, 10)}T12:00:00Z`) + verschil * 86400000).toISOString().slice(0, 10) +
        t.slice(10)
    );
  const verschoven = (e) => ({
    ...e,
    daily: { ...e.daily, time: schuif(e.daily.time) },
    hourly: { ...e.hourly, time: schuif(e.hourly.time) }
  });
  const TRAAG = 'jma_gsm';
  // Dit model kent een gevraagde variabele niet: een vaste fout, elke keer.
  const VAST = 'cma_grapes_global';
  const dagenGevraagd = new Set();
  const pogingen = {};
  let tegelijk = 0;
  let hoogste = 0;

  const { context, page } = await telefoon();
  try {
    await context.route('https://api.open-meteo.com/**', async (route) => {
      const q = new URL(route.request().url()).searchParams;
      const json = (body, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {});
      if (q.has('minutely_15')) return json({ minutely_15: { time: [], precipitation: [] } });
      if (q.has('past_days')) {
        const t = fixture.__terugblik;
        return json({ daily: { ...t.daily, time: schuif(t.daily.time) } });
      }
      const model = q.get('models');
      if (!model) return json({ daily: {} });
      dagenGevraagd.add(q.get('forecast_days'));
      pogingen[model] = (pogingen[model] ?? 0) + 1;
      if (model === TRAAG && pogingen[model] === 1) return; // de eerste keer nooit een antwoord
      if (model === VAST) return json({ error: true, reason: 'Cannot initialize WeatherVariableDaily' }, 400);
      tegelijk++;
      hoogste = Math.max(hoogste, tegelijk);
      await new Promise((klaar) => setTimeout(klaar, 250));
      tegelijk--;
      const e = fixture[model];
      if (e.__fout) return json({ error: true, reason: e.__fout }, 400);
      return json(verschoven(e));
    });
    const begin = Date.now();
    await page.goto(server.url);
    // De tussenstand: alles behalve het trage model, terwijl dat opnieuw wordt geprobeerd.
    await wachtOpKaart(page);
    const tussen = Date.now() - begin;
    assert.ok(tussen >= 11000 && tussen < 18000, `tussenstand na de tijdslimiet (${tussen} ms)`);
    assert.match(await page.textContent('#ophaalstatus'), /1 model opnieuw proberen/);
    assert.match(await page.locator(`#model-${TRAAG}`).innerText(), /mislukt/);
    // Daarna komt het trage model alsnog binnen.
    await page.waitForFunction((id) => !document.querySelector(`#model-${id}`).innerText.includes('mislukt'), TRAAG, {
      timeout: 10000
    });
    assert.doesNotMatch(await page.textContent('#ophaalstatus'), /opnieuw|niet alle/);
    assert.equal(pogingen[TRAAG], 2);
    assert.ok(hoogste <= 6, `nooit meer dan zes tegelijk (${hoogste})`);
    assert.deepEqual([...dagenGevraagd], ['3'], 'drie dagen per model');
    // Een model met een vaste fout wordt niet herhaald.
    assert.equal(pogingen[VAST], 2, 'één keer alles, één keer de kernvariabelen');
    assert.match(await page.locator(`#model-${VAST}`).innerText(), /mislukt/);
  } finally {
    await context.close();
  }
});

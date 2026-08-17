# Weer op locatie

Een webapp die voor **één dag op één plek** laat zien wat *alle* beschikbare weermodellen voorspellen — met per model de uitleg waarom het meedoet en wat je van zijn antwoord moet vinden.

Nu ingesteld op **vrijdag 28 augustus 2026 in Meerssen**.

Geen server, geen account, geen tracking: de pagina praat rechtstreeks met [Open-Meteo](https://open-meteo.com/) en bewaart alles lokaal in je browser.

## Waarom niet gewoon één verwachting?

Een gewone weerapp geeft je één getal, en verzwijgt hoe zeker dat getal is. Bij een dag die nog ruim een week weg is, is juist die zekerheid het antwoord. Daarom staat hier de **spreiding** centraal:

- **Zitten de modellen dicht bij elkaar?** Dan kun je plannen.
- **Lopen ze uiteen?** Dan is het nog open, hoe overtuigd één app ook klinkt.
- **Welke modellen praten er eigenlijk mee?** Een model met 2 km resolutie is scherper, maar kijkt maar 2,5 dag vooruit. Elf dagen vooraf hoor je dus alleen de globale modellen; de scherpe modellen haken pas in de laatste dagen aan. De app zegt dat er bij, in plaats van een leeg vakje te laten zien.

## Wat je ziet

| Onderdeel | Wat het je vertelt |
|---|---|
| Oordeel bovenaan | Zijn de modellen het eens, verdeeld of oneens — met de reden erbij |
| Mediaan en bandbreedte | Het middelste antwoord, plus hoe ver de uitersten uit elkaar liggen |
| Puntenwolk | Elk model één stip op één as: cluster of chaos in één blik |
| Kaart per model | Waarden, uurverloop, en waarom dit model in de lijst hoort |
| Trend | Schoof de verwachting de laatste dagen op? (lokaal bijgehouden) |
| Tabel | Alle waarden naast elkaar, ook voor schermlezers |

Elk model krijgt een statuschip, zodat een ontbrekende waarde altijd verklaard is: **actueel**, **haalt deze dag nog niet**, **geen dekking op deze plek** of **ophalen mislukt**.

## Een andere dag of plek

Alles wat je normaal wilt wijzigen staat in [`js/config.js`](js/config.js):

```js
export const TARGET_DATE = '2026-08-28';   // de dag waar de app over gaat
export const LOCATION = { naam: 'Meerssen', latitude: 50.8917, longitude: 5.75, … };
```

Eén regel aanpassen, opslaan, pushen. Meer is het niet.

Ligt de datum in het verleden of meer dan 16 dagen vooruit, dan zegt de app dat netjes in plaats van een lege pagina te tonen.

## Lokaal draaien

Het is platte HTML, CSS en JavaScript — geen build, geen `npm install`.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Wil je de weergave bekijken zonder internet (of de foutsituaties nakijken), gebruik dan de mockmodus:

```bash
node dev/maak-fixture.mjs          # eenmalig, schrijft dev/fixture.json
# open http://localhost:8000/?mock=1
```

De fixture bevat bewust alle vier de statussen, inclusief een model dat een fout teruggeeft.

## De modelcatalogus controleren

Open-Meteo voegt modellen toe en hernoemt ze af en toe. Dit script houdt de catalogus tegen de echte API aan en meldt welke modellen niet meer bestaan, welke hier geen dekking hebben en waar de opgegeven horizon afwijkt van de werkelijkheid:

```bash
node scripts/check-models.mjs
```

Dezelfde controle loopt als GitHub Action — handmatig te starten via *Actions → Modelcontrole → Run workflow*, en verder elke maandagochtend automatisch.

## Iconen

De iconen worden gegenereerd, niet met de hand getekend:

```bash
node scripts/maak-iconen.mjs
```

## Publiceren

De app is een statische site en staat op GitHub Pages. Instellen: *Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`*. Het veld **Custom domain** laat je leeg — zonder eigen domein krijg je gewoon de standaard-URL. Daarna is elke push naar `main` meteen live.

## Bronnen en licentie

Weerdata van [Open-Meteo](https://open-meteo.com/), gebruikt onder [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). De modellen komen van ECMWF, KNMI, DWD, NOAA/NCEP, Météo-France, UK Met Office, DMI, CHMI, CMC, JMA, KMA, CMA en BOM.

De code in deze repository is vrij te gebruiken.

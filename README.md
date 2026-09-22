# Weer op locatie

Een webapp die voor **één dag op één plek** laat zien wat *alle* beschikbare weermodellen voorspellen — met per model de uitleg waarom het meedoet en wat je van zijn antwoord moet vinden.

Ingesteld op **Heerlen**, en altijd voor **vandaag of morgen**: bovenaan de pagina wissel je met één tik tussen de twee.

Geen server, geen account, geen tracking: de pagina praat rechtstreeks met [Open-Meteo](https://open-meteo.com/) en bewaart alles lokaal in je browser.

## Waarom niet gewoon één verwachting?

Een gewone weerapp geeft je één getal, en verzwijgt hoe zeker dat getal is. Ook voor vandaag en morgen is juist die zekerheid het antwoord: zetten de modellen de bui op hetzelfde uur, of kiest ieder een ander moment? Daarom staat hier de **spreiding** centraal:

- **Zitten de modellen dicht bij elkaar?** Dan kun je plannen.
- **Lopen ze uiteen?** Dan is het nog open, hoe overtuigd één app ook klinkt.
- **Welke modellen praten er eigenlijk mee?** Een model met 2 km resolutie is scherper, maar kijkt maar 2,5 dag vooruit — precies genoeg voor vandaag en morgen. Levert een model hier niets, dan zegt de app dat erbij, in plaats van een leeg vakje te laten zien.

## Wat je ziet

| Onderdeel | Wat het je vertelt |
|---|---|
| Schakelaar bovenaan | Vandaag of morgen, met één tik; de keuze staat ook in de URL (`?dag=morgen`) |
| Oordeel bovenaan | Zijn de modellen het eens, verdeeld of oneens — met de reden erbij |
| Mediaan en bandbreedte | Het middelste antwoord, plus hoe ver de uitersten uit elkaar liggen |
| Puntenwolk | Elk model één stip op één as: cluster of chaos in één blik |
| Uurrooster 11:00–20:00 | Modellen tegen uren, met een schakelaar tussen regen, zon en temperatuur: zetten ze de regen op hetzelfde uur of kiest ieder een ander moment? |
| Kaart per model | Waarden, uurverloop, en waarom dit model in de lijst hoort |
| Trend | Schoof de verwachting de laatste dagen op? (lokaal bijgehouden) |
| Tabel | Alle waarden naast elkaar, ook voor schermlezers |

Elk model krijgt een statuschip, zodat een ontbrekende waarde altijd verklaard is: **actueel**, **haalt deze dag nog niet**, **geen dekking op deze plek** of **ophalen mislukt**.

## Vandaag of morgen

De dag rekent de app zelf uit, in de tijdzone van de locatie (Europe/Amsterdam) en niet in die van je apparaat. Standaard opent hij op **vandaag**; is het dagvenster van vandaag al voorbij (na 20:00), dan op **morgen**. Met `?dag=vandaag` of `?dag=morgen` in de URL kies je zelf.

Eén ophaal bij Open-Meteo levert beide dagen, dus wisselen is direct en kost geen nieuw verzoek. Laat je de pagina over middernacht openstaan, dan schuift "vandaag" mee zodra je er weer naar kijkt.

## Een andere plek

Alles wat je normaal wilt wijzigen staat in [`js/config.js`](js/config.js):

```js
export const LOCATION = { naam: 'Heerlen', latitude: 50.8882, longitude: 5.9795, … };
export const VENSTER = { van: 11, tot: 20 };   // het dagvenster van het uurrooster
```

Eén regel aanpassen, opslaan, pushen. Draai daarna `node scripts/check-models.mjs` om te zien welke regionale modellen de nieuwe plek dekken.

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

De fixture bevat bewust alle vier de statussen, inclusief een model dat een fout teruggeeft. De app schuift de datums in de fixture zo op dat de doeldag op vandaag valt, dus de schakelaar werkt ook in de mockmodus.

## De modelcatalogus controleren

Open-Meteo voegt modellen toe en hernoemt ze af en toe. Dit script houdt de catalogus tegen de echte API aan en meldt welke modellen niet meer bestaan, welke hier geen dekking hebben en waar de opgegeven horizon afwijkt van de werkelijkheid:

```bash
node scripts/check-models.mjs
```

Het script rapporteert ook per model hoeveel uren in het dagvenster gevuld zijn voor neerslag, zon, temperatuur en bewolking — daarmee is vastgesteld dat alle modellen zonneschijn per uur leveren behalve NOAA AI-GFS. Modellen die de gekozen grootheid niet per uur geven, worden onder het rooster benoemd in plaats van stil weggelaten.

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

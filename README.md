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
| De lucht | De bovenste kaart kleurt mee met het weerbeeld waar de meeste modellen op uitkomen, met de mediane middagtemperatuur groot en een strip met één stip per model |
| Oordeel | Zijn de modellen het eens, verdeeld of oneens — met de reden erbij |
| Uurrooster 11:00–20:00 | Modellen tegen uren, met een schakelaar tussen regen, zon en temperatuur: zetten ze de regen op hetzelfde uur of kiest ieder een ander moment? Alle uren passen naast elkaar op een telefoon, met het dagtotaal onder de modelnaam. Tik op een vakje voor de waarde |
| Spreiding | Elk model één stip op één as, met de mediaan en de middelste helft: cluster of chaos in één blik |
| Trend | Schoof de verwachting de laatste dagen op? (lokaal bijgehouden) |
| Wie had gelijk? | Elke dag de verwachting van de dag ervoor naast wat er werkelijk gebeurde: het podium van gisteren, wie er het verst naast zat, en de stand over een week |
| Model voor model | Een lijst in iOS-stijl; tik op een model voor zijn waarden, uurverloop, zijn figuur en waarom het in de lijst hoort |
| Tabel | Alle waarden naast elkaar, ook voor schermlezers |

Elk model krijgt een statuschip, zodat een ontbrekende waarde altijd verklaard is: **actueel**, **haalt deze dag nog niet**, **geen dekking op deze plek** of **ophalen mislukt**.

Elk soort model heeft ook een figuur in pixelkunst, gekozen op gedrag en niet op herkomst: de **uil** (ECMWF, het anker), de **haas** (GFS: snel en springerig), de **schildpad** (de andere globale modellen, met de hele wereld op zijn rug), de **spin** (de regionale modellen en hun fijnmazige web), de **robot** (de AI-modellen), de **zwerm** (het ensemblegemiddelde) en de **ekster** (Best Match, die het glimmendste stukje van elk model verzamelt). De sprites staan als rasters van 16 × 16 in [`js/pixels.js`](js/pixels.js); er zijn geen afbeeldingen.

## Wie had gelijk?

De app bewaart elke verwachting een week lang op het apparaat. Voor elke voorbije dag pakt hij de laatste verwachting van de dag ervoor (of, als de app die dag niet open was, de vroegste van de dag zelf) en legt die naast wat er gebeurde. Een model is **raak** als het binnen 1,5 °C van de werkelijke middagtemperatuur zat én goed was over droog of nat (de grens is 1 mm, dezelfde als in het oordeel bovenaan). De rangorde telt de afwijking in graden, met twee strafpunten voor droog en nat verwisselen.

De maatstaf is Open-Meteo's eigen terugblik op die dag (`past_days` met Best Match), één extra verzoek per zes uur. Dat is een analyse uit dezelfde modellen en geen meting van een regenmeter; de app zegt dat erbij, en Best Match doet daarom niet mee.

## 8-bit

Tik vijf keer op **HEERLEN**, of toets de Konami-code (↑ ↑ ↓ ↓ ← → ← → B A), en de app gaat over op pixels: een pixelletter voor de grote titels, pixeliconen, de figuren in plaats van de vlaggen, vierkante hoeken, en achter de bovenste kaart Heerlen in pixels: een brede strook stad waar de camera langzaam langs schuift. Kasteel Hoensbroek in zijn gracht, het Glaspaleis, het Raadhuis van Peutz, de kerktoren, het Maankwartier met de Heliostaat en de treinen van de NS en Arriva eronder, de schachtbok, en de terril met SnowWorld. De zon en de maan (in de fase van vandaag) staan waar ze nu echt boven Heerlen staan; 's avonds gaan de lichten aan. Het weer is dat van de modellen: wolken, regen met een paraplu, een fietser als het droog is, bliksem, sneeuw op de daken. Een Arriva-bus stopt bij het station, er vliegen vogels, een vliegtuig en een luchtballon over, en met Kerstmis, carnaval (ook op 11-11) en Koningsdag is de stad versierd. Om een ander moment te bekijken: zet `?scenetijd=2027-02-07T14:00` achter het adres. Nog eens vijf keer tikken zet het weer uit; de keuze wordt onthouden. Bij *beperk beweging* staat de scène stil.

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

Het is platte HTML, CSS en JavaScript — geen build, geen `npm install`. De opmaak is eerst voor de iPhone gemaakt (voeg hem via *Deel → Zet op beginscherm* toe voor een app zonder adresbalk) en blijft op een groter scherm één smalle kolom.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Wil je de weergave bekijken zonder internet (of de foutsituaties nakijken), gebruik dan de mockmodus:

```bash
node dev/maak-fixture.mjs          # eenmalig, schrijft dev/fixture.json
# open http://localhost:8000/?mock=1
```

De fixture lijkt op een echte dag: net als in het echt hebben bijna alle modellen een verwachting voor vandaag en morgen, en elk model zet zijn bui op een eigen uur. Hij bevat bewust alle vier de statussen, inclusief een model dat een fout teruggeeft; "reikt niet zo ver" zie je op morgen. Er zit ook een week aan verwachtingen en terugblik in, zodat "Wie had gelijk?" meteen iets te tonen heeft; die week komt alleen uit de fixture en belandt nooit in de echte historie. De app schuift de datums in de fixture zo op dat de doeldag op vandaag valt, dus de schakelaar werkt ook in de mockmodus.

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

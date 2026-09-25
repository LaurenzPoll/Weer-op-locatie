# Weer op locatie

Een webapp die voor **één dag op één plek** laat zien wat *alle* beschikbare weermodellen voorspellen — met per model de uitleg waarom het meedoet en wat je van zijn antwoord moet vinden.

Standaard op **Heerlen** (met de speld bovenaan kies je een andere plek), en altijd voor **vandaag of morgen**: bovenaan de pagina wissel je met één tik tussen de twee.

Geen server, geen account, geen tracking: de pagina praat alleen met [Open-Meteo](https://open-meteo.com/) en bewaart alles lokaal in je browser. Ook de lettertypes komen van de site zelf.

## Waarom niet gewoon één verwachting?

Een gewone weerapp geeft je één getal, en verzwijgt hoe zeker dat getal is. Ook voor vandaag en morgen is juist die zekerheid het antwoord: zetten de modellen de bui op hetzelfde uur, of kiest ieder een ander moment? Daarom staat hier de **spreiding** centraal:

- **Zitten de modellen dicht bij elkaar?** Dan kun je plannen.
- **Lopen ze uiteen?** Dan is het nog open, hoe overtuigd één app ook klinkt.
- **Welke modellen praten er eigenlijk mee?** Een model met 2 km resolutie is scherper, maar kijkt maar 2,5 dag vooruit — precies genoeg voor vandaag en morgen. Levert een model hier niets, dan zegt de app dat erbij, in plaats van een leeg vakje te laten zien.

## Wat je ziet

| Onderdeel | Wat het je vertelt |
|---|---|
| Schakelaar bovenaan | Vandaag of morgen, met één tik; de keuze staat ook in de URL (`?dag=morgen`) |
| Speld bovenaan | Een andere plek: zoek een plaats, gebruik je eigen locatie of kies een bewaarde plek. Achter elke bewaarde plek staat het weer van de dag die je bekijkt (Best Match), zodat je plekken naast elkaar ziet |
| De lucht | De bovenste kaart kleurt mee met het weerbeeld waar de meeste modellen op uitkomen, met de mediane middagtemperatuur groot en een strip met één stip per model |
| Regen komend uur | Voor vandaag één zin als *Droog tot 16:15, daarna lichte regen*, uit Open-Meteo's neerslag per kwartier |
| Zon op en onder | Uitgerekend voor de plek en de dag, niet opgevraagd |
| Beste deze week | Wat de drie modellen zeggen die het hier de afgelopen week het best deden bij "Wie had gelijk?" |
| Oordeel | Zijn de modellen het eens, verdeeld of oneens — met de reden erbij. Met *Delen* stuur je het als tekst met een link door |
| Uurrooster 11:00–20:00 | Modellen tegen uren, met een schakelaar tussen regen, zon en temperatuur: zetten ze de regen op hetzelfde uur of kiest ieder een ander moment? Alle uren passen naast elkaar op een telefoon, met het dagtotaal onder de modelnaam. Op vandaag is het huidige uur gemarkeerd en zijn de voorbije uren gedimd. Tik op een vakje voor de waarde |
| Spreiding | Elk model één stip op één as, met de mediaan en de middelste helft: cluster of chaos in één blik |
| Trend | Schoof de verwachting de laatste dagen op? (lokaal bijgehouden) |
| Wie had gelijk? | Elke dag de verwachting van de dag ervoor naast wat er werkelijk gebeurde: het podium van gisteren, wie er het verst naast zat, en de stand over een week |
| Model voor model | Een lijst in iOS-stijl; tik op een model voor zijn waarden, uurverloop, zijn figuur en waarom het in de lijst hoort. De beste drie van de week hebben een medaille |
| Tabel | Alle waarden naast elkaar, ook voor schermlezers |

Elk model krijgt een statuschip, zodat een ontbrekende waarde altijd verklaard is: **actueel**, **haalt deze dag nog niet**, **geen dekking op deze plek** of **ophalen mislukt**.

Elk soort model heeft ook een figuur in pixelkunst, gekozen op gedrag en niet op herkomst: de **uil** (ECMWF, het anker), de **haas** (GFS: snel en springerig), de **schildpad** (de andere globale modellen, met de hele wereld op zijn rug), de **spin** (de regionale modellen en hun fijnmazige web), de **robot** (de AI-modellen), de **zwerm** (het ensemblegemiddelde) en de **ekster** (Best Match, die het glimmendste stukje van elk model verzamelt). De sprites staan als rasters van 16 × 16 in [`js/pixels.js`](js/pixels.js); er zijn geen afbeeldingen.

## Wie had gelijk?

De app bewaart elke verwachting een week lang op het apparaat, per plek. Voor elke voorbije dag pakt hij de laatste verwachting van de dag ervoor (of, als de app die dag niet open was, de vroegste van de dag zelf) en legt die naast wat er gebeurde. Een model is **raak** als het binnen 1,5 °C van de werkelijke middagtemperatuur zat én goed was over droog of nat (de grens is 1 mm, dezelfde als in het oordeel bovenaan). De rangorde telt de afwijking in graden, met twee strafpunten voor droog en nat verwisselen.

Die stand telt ook bovenaan mee: heeft een model minstens vier beoordeelde dagen, dan doet het mee voor de beste drie van de week. Wat die drie voor de gekozen dag verwachten staat in de bovenste kaart, en in de lijst hebben ze een medaille. De mediaan bovenaan blijft die van alle modellen.

De maatstaf is Open-Meteo's eigen terugblik op die dag (`past_days` met Best Match), één extra verzoek per zes uur. Dat is een analyse uit dezelfde modellen en geen meting van een regenmeter; de app zegt dat erbij, en Best Match doet daarom niet mee.

## 8-bit

Tik vijf keer op de plaatsnaam (**HEERLEN**), of toets de Konami-code (↑ ↑ ↓ ↓ ← → ← → B A), en de app gaat over op pixels: een pixelletter voor de grote titels, pixeliconen, de figuren in plaats van de vlaggen, vierkante hoeken, en achter de bovenste kaart Heerlen in pixels: Kasteel Hoensbroek, het Glaspaleis, het Raadhuis van Peutz, het Maankwartier met de Heliostaat en de treinen van de NS en Arriva eronder, en de schachtbok, met in de verte de terril met SnowWorld. Op een gekantelde telefoon of een laptop komt de kerktoren erbij. De zon en de maan (in de fase van vandaag) staan waar ze nu echt boven de gekozen plek staan; 's avonds gaan de lichten aan. Het weer is dat van de modellen: wolken, regen met een paraplu, een fietser als het droog is, bliksem, sneeuw op de daken. Af en toe rijdt er een Arriva-bus voorbij, er vliegen vogels, een vliegtuig en een luchtballon over, en met Kerstmis, carnaval (ook op 11-11) en Koningsdag is de stad versierd. Om een ander moment te bekijken: zet `?scenetijd=2027-02-07T14:00` achter het adres. Nog eens vijf keer tikken zet het weer uit; de keuze wordt onthouden. Bij *beperk beweging* staat de scène stil. De scène wordt pas opgehaald als je de 8-bitmodus aanzet.

## Vandaag of morgen

De dag rekent de app zelf uit, in de tijdzone van de plek (voor Heerlen Europe/Amsterdam) en niet in die van je apparaat. Standaard opent hij op **vandaag**; is het dagvenster van vandaag al voorbij (na 20:00), dan op **morgen**. Met `?dag=vandaag` of `?dag=morgen` in de URL kies je zelf.

Eén ophaal bij Open-Meteo levert beide dagen, dus wisselen is direct en kost geen nieuw verzoek. Per model vraagt de app drie dagen op, genoeg voor vandaag en morgen. Hij vraagt zes modellen tegelijk op (een browser opent toch maar een handvol verbindingen naar dezelfde server), en elk verzoek krijgt twaalf seconden vanaf het moment dat het echt vertrekt. Antwoordt een model niet, of is er even geen verbinding of drukte bij Open-Meteo, dan probeert de app het nog twee keer, met twintig en dertig seconden de tijd; intussen staat wat er al binnen is op het scherm, met "1 model opnieuw proberen…". Ontbreekt er daarna nog iets, dan zegt de statusregel dat, en probeert de app het na twee minuten opnieuw in plaats van na een half uur. Een model dat een vaste fout geeft (bijvoorbeeld een variabele niet kent), wordt niet herhaald. Zijn de bewaarde gegevens ouder dan een half uur, dan staan ze bij het openen toch meteen op het scherm, met "nieuwe gegevens ophalen…", tot de nieuwe binnen zijn. Laat je de pagina over middernacht openstaan, dan schuift "vandaag" mee zodra je er weer naar kijkt. Haal je de app terug en zijn de gegevens ouder dan een half uur, dan haalt hij ze vanzelf opnieuw op.

## Een andere plek

Tik bovenaan op de speld. Je kunt een plaats zoeken (via de geocoding van Open-Meteo, zonder account of sleutel), je eigen locatie gebruiken (afgerond op honderd meter) of een plek kiezen die je eerder koos; de laatste acht blijven bewaard. De keuze staat alleen op dit apparaat. Elke plek heeft zijn eigen cache, trend en "Wie had gelijk?", en de dag rekent in de tijdzone van die plek. Regionale modellen die een plek niet dekken, krijgen gewoon de status *geen dekking*.

Een gedeelde link (de knop *Delen*) neemt de plek mee: `?plek=Maastricht&lat=50.8483&lon=5.6889&tz=Europe/Amsterdam`. Zo'n link opent die plek zonder hem te onthouden; tik je hem in de lijst aan, dan wordt hij bewaard.

De plek waarmee de app begint en het dagvenster staan in [`js/config.js`](js/config.js):

```js
export const STANDAARD_PLEK = { naam: 'Heerlen', latitude: 50.8882, longitude: 5.9795, … };
export const VENSTER = { van: 11, tot: 20 };   // het dagvenster van het uurrooster
```

Draai na het wijzigen van de standaardplek `node scripts/check-models.mjs` om te zien welke regionale modellen hem dekken.

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

De fixture lijkt op een echte dag: net als in het echt hebben bijna alle modellen een verwachting voor vandaag en morgen, en elk model zet zijn bui op een eigen uur. "Reikt niet zo ver" zie je op morgen; een model zonder dekking of met een fout komt in de browsertests aan bod. Er zit ook een week aan verwachtingen en terugblik in, zodat "Wie had gelijk?" meteen iets te tonen heeft; die week komt alleen uit de fixture en belandt nooit in de echte historie. De app schuift de datums in de fixture zo op dat de doeldag op vandaag valt, dus de schakelaar werkt ook in de mockmodus.

## Tests

De rekenkern heeft tests: het oordeel en de spreiding, "Wie had gelijk?", het normaliseren van de antwoorden, zonsopkomst en -ondergang, de zin over regen in het komende uur, de datums in de tijdzone van de plek, en of de service worker elk bestand van de app kent. Ze gebruiken alleen wat Node (22 of nieuwer) aan boord heeft:

```bash
node --test tests/*.test.mjs
```

Daarnaast zijn er browsertests die de app in Chromium doorlopen, tegen een server die GitHub Pages nabootst: een nieuwe versie melden en laden, offline starten, oude gegevens meteen tonen, een plek kiezen, delen, de nu-markering, de 8-bitmodus, en het echte API-pad waarin één model nooit antwoordt. Daarvoor is het npm-pakket `playwright` nodig:

```bash
npm install --no-save playwright && npx playwright install chromium
node --test tests/browser/*.browser.mjs
```

Beide draaien als GitHub Action bij elke push en elk pull request.

## De modelcatalogus controleren

Open-Meteo voegt modellen toe en hernoemt ze af en toe. Dit script houdt de catalogus tegen de echte API aan en meldt welke modellen niet meer bestaan, welke hier geen dekking hebben en waar de opgegeven horizon afwijkt van de werkelijkheid:

```bash
node scripts/check-models.mjs
```

Het script rapporteert ook per model hoeveel uren in het dagvenster gevuld zijn voor neerslag, zon, temperatuur en bewolking — daarmee is vastgesteld dat alle modellen zonneschijn per uur leveren behalve NOAA AI-GFS. Modellen die de gekozen grootheid niet per uur geven, worden onder het rooster benoemd in plaats van stil weggelaten.

Het script doet daarna ook de andere verzoeken van de app, met dezelfde URL's: regen per kwartier, plaatsen zoeken, het weer achter de bewaarde plekken en de terugblik voor "Wie had gelijk?". Geeft een daarvan niet het antwoord dat de app verwacht, dan faalt de controle.

Dezelfde controle loopt als GitHub Action — handmatig te starten via *Actions → Modelcontrole → Run workflow*, en verder elke maandagochtend automatisch.

## Iconen

Op het beginscherm heet de app **Weer**. Het icoon is een gewoon weericoon, getekend zoals de pagina: de blauwe lucht van de bovenste kaart, het zonnetje en de wolk uit de app. De twist: de drie regendruppels zijn de drie modelgroepen, in dezelfde kleuren en met hetzelfde witte randje als de stippen bij *Spreiding* (blauw globaal, oranje regionaal, groen referentie). Er staat geen plaatsnaam in, dus het past bij elke plek. De iconen worden gegenereerd, niet met de hand getekend:

```bash
node scripts/maak-iconen.mjs
```

Het schrijft `apple-touch-icon.png` (180 × 180, voor het beginscherm van de iPhone), `icon-192.png` en `icon-512.png` (voor het manifest), `icon-maskable-512.png` (dezelfde tekening wat kleiner, zodat Android er een cirkel uit kan knippen) en `favicon.svg` voor het browsertabje. De iPhone neemt het icoon over op het moment dat je de app op het beginscherm zet en kijkt daarna niet meer; zie je een oud icoon, haal de app dan van het beginscherm en zet hem er opnieuw op.

## Nieuwe versies

De service worker ([`sw.js`](sw.js)) haalt de eigen bestanden eerst van het netwerk en valt pas terug op zijn cache als er geen verbinding is, of als het netwerk na 3 seconden nog niets heeft gegeven. Wie de app opent, krijgt dus altijd de nieuwste versie in zijn geheel, zonder de tien minuten die GitHub Pages bestanden laat cachen. Een versienummer ophogen is daarvoor niet nodig.

Een app op het beginscherm begint niet opnieuw als je hem terughaalt, maar gaat verder waar hij was. Daarom vergelijkt de app bij terugkomst (en bij een tik op verversen) de code met die op de server; is er iets veranderd, dan verschijnt onderin *Er is een nieuwe versie* met een knop om hem te laden. Helemaal onderaan de pagina staat bovendien altijd een knop *Nieuwste versie laden*.

## Publiceren

De app is een statische site en staat op GitHub Pages. Instellen: *Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`*. Het veld **Custom domain** laat je leeg — zonder eigen domein krijg je gewoon de standaard-URL. Daarna is elke push naar `main` meteen live.

## Bronnen en licentie

Weerdata van [Open-Meteo](https://open-meteo.com/), gebruikt onder [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). De modellen komen van ECMWF, KNMI, DWD, NOAA/NCEP, Météo-France, UK Met Office, DMI, CHMI, CMC, JMA en CMA.

De lettertypes Big Shoulders Display en Silkscreen staan in [`fonts/`](fonts/) en vallen onder de SIL Open Font License; de licentieteksten staan ernaast.

De code in deze repository is vrij te gebruiken.

// De modelcatalogus: welke weermodellen we opvragen en waarom elk model meedoet.
//
// De identifiers komen uit de documentatiebron van Open-Meteo zelf
// (open-meteo/open-meteo-website, src/routes/en/docs/options.ts) en gebruiken de
// actuele namen met aanbieder-voorvoegsel (dwd_icon_*, ncep_gfs_*, cmc_gem_*).
//
// De veldwaarden `horizon` en `dekking` zijn wat de aanbieder opgeeft. Wat een
// model op déze plek en dag werkelijk levert, bepaalt de app zelf bij het ophalen
// en zie je terug in de statuschip op de kaart. Met scripts/check-models.mjs kun
// je de opgegeven waarden tegen de echte API aan houden.

export const GROEPEN = {
  globaal: {
    titel: 'Globale modellen',
    ondertitel:
      'Rekenen de hele aardbol door en kijken ver vooruit. Dit zijn de modellen die een dag die nog ruim een week weg is überhaupt kunnen zien.',
    serie: 1,
    vorm: 'cirkel'
  },
  regionaal: {
    titel: 'Regionale modellen met hoge resolutie',
    ondertitel:
      'Zoomen in op een klein gebied met een fijn rekenraster, waardoor ze buien, onweer en lokale verschillen echt uitrekenen. De prijs: ze kijken maar een paar dagen vooruit, dus ze haken pas kort voor de datum aan.',
    serie: 2,
    vorm: 'vierkant'
  },
  referentie: {
    titel: 'Referentie',
    ondertitel: 'Geen eigen model, maar een ijkpunt om de rest tegen af te zetten.',
    serie: 3,
    vorm: 'ruit'
  }
};

export const MODELLEN = [
  // ---------------------------------------------------------------- globaal
  {
    id: 'ecmwf_ifs025',
    naam: 'ECMWF IFS 0.25°',
    aanbieder: 'ECMWF',
    land: 'Europese Unie',
    vlag: '🇪🇺',
    resolutie: '25 km',
    horizon: 15,
    update: 'elke 6 uur',
    dekking: 'wereldwijd',
    groep: 'globaal',
    anker: true,
    waarom:
      'Het referentiemodel van het Europees centrum in Reading, en het anker van deze vergelijking. In onafhankelijke verificatie scoort ECMWF jaar na jaar het hoogst op dag 3 tot 10 — precies het bereik waarin de 28ste valt zolang die nog ruim een week weg is. Wijkt dit model af van de rest, dan is de kans reëel dat de rest zich vergist en niet hij.'
  },
  {
    id: 'ecmwf_ifs',
    naam: 'ECMWF IFS HRES 9 km',
    aanbieder: 'ECMWF',
    land: 'Europese Unie',
    vlag: '🇪🇺',
    resolutie: '9 km',
    horizon: 10,
    update: 'elke 6 uur',
    dekking: 'wereldwijd',
    groep: 'globaal',
    waarom:
      'Dezelfde motor als het model hierboven, maar op het volle 9 km-raster in plaats van uitgedund naar een kwart graad. Daardoor is het Heuvelland hier iets meer dan één vlakke pixel. Zodra hij de datum haalt is dit de scherpste versie van de beste verwachting die er is.',
    letOp: 'Kijkt minder ver vooruit dan de 0,25°-variant, dus hij haakt later aan.'
  },
  {
    id: 'ecmwf_aifs025_single',
    naam: 'ECMWF AIFS 0.25°',
    aanbieder: 'ECMWF',
    land: 'Europese Unie',
    vlag: '🇪🇺',
    resolutie: '25 km',
    horizon: 15,
    update: 'elke 6 uur',
    dekking: 'wereldwijd',
    groep: 'globaal',
    ai: true,
    waarom:
      'Het machine-learningmodel van ECMWF: geen natuurwetten die stap voor stap worden doorgerekend, maar een neuraal net dat op veertig jaar heranalysedata geleerd heeft hoe weerpatronen zich ontwikkelen. Op grootschalige patronen haalt hij inmiddels dezelfde of betere scores dan de klassieke IFS, in seconden rekentijd. Een tweede, deels onafhankelijke mening uit hetzelfde huis.',
    letOp: 'Is doorgaans te glad met extremen: scherpe pieken vlakt hij af.'
  },
  {
    id: 'ncep_gfs_seamless',
    naam: 'NOAA GFS',
    aanbieder: 'NOAA / NCEP',
    land: 'Verenigde Staten',
    vlag: '🇺🇸',
    resolutie: '11 – 25 km',
    horizon: 16,
    update: 'elk uur',
    dekking: 'wereldwijd',
    groep: 'globaal',
    waarom:
      'De Amerikaanse werkhorse: gratis, wereldwijd en met 16 dagen het langste bereik van het hele gezelschap, en elk uur bijgewerkt. Die snelle cyclus maakt hem vaak de eerste die een omslag oppikt. Voor Europa is hij historisch wel onrustiger en natter dan ECMWF, dus zet GFS als enige een buienzone op de 28ste, wacht dan op bevestiging.'
  },
  {
    id: 'ncep_aigfs025',
    naam: 'NOAA AI-GFS 0.25°',
    aanbieder: 'NOAA / NCEP',
    land: 'Verenigde Staten',
    vlag: '🇺🇸',
    resolutie: '25 km',
    horizon: 10,
    update: 'elke 6 uur',
    dekking: 'wereldwijd',
    groep: 'globaal',
    ai: true,
    waarom:
      "NOAA's antwoord op AIFS: hetzelfde idee — een neuraal net in plaats van fysica — maar door de Amerikanen getraind, op hun eigen analyses. Hij staat hier omdat twee AI-modellen die onafhankelijk hetzelfde zeggen een sterker signaal vormen dan één, en omdat het de moeite is om te zien of de AI's als groep afwijken van de fysische modellen."
  },
  {
    id: 'ncep_hgefs025_ensemble_mean',
    naam: 'NOAA HGEFS ensemblegemiddelde',
    aanbieder: 'NOAA / NCEP',
    land: 'Verenigde Staten',
    vlag: '🇺🇸',
    resolutie: '25 km',
    horizon: 16,
    update: 'elke 6 uur',
    dekking: 'wereldwijd',
    groep: 'globaal',
    ensemble: true,
    waarom:
      'Geen enkele voorspelling, maar het gemiddelde van tientallen runs die elk vanuit een minuscuul andere begintoestand starten. Op tien dagen afstand zit zo\'n gemiddelde bijna altijd dichter bij de waarheid dan één losse run, omdat toevallige ruis eruit wast en alleen het robuuste patroon overblijft.',
    letOp: 'Uitmiddelen dempt uitersten: een hittepiek of zware bui ziet er hier structureel te braaf uit.'
  },
  {
    id: 'dwd_icon_global',
    naam: 'DWD ICON Global',
    aanbieder: 'Deutscher Wetterdienst',
    land: 'Duitsland',
    vlag: '🇩🇪',
    resolutie: '11 km',
    horizon: 7.5,
    update: 'elke 3 uur',
    dekking: 'wereldwijd',
    groep: 'globaal',
    waarom:
      'Het globale model van de Duitse Wetterdienst, en de basis waarop ICON-EU en ICON-D2 verder inzoomen. Duitsland zit bovengemiddeld goed in West-Europese weersystemen; ICON is de sterkste niet-ECMWF-speler op ons continent. Met 7,5 dagen komt hij pas in de laatste week in beeld.'
  },
  {
    id: 'ukmo_global_deterministic_10km',
    naam: 'UK Met Office Global 10 km',
    aanbieder: 'UK Met Office',
    land: 'Verenigd Koninkrijk',
    vlag: '🇬🇧',
    resolutie: '10 km',
    horizon: 7,
    update: 'elk uur',
    dekking: 'wereldwijd',
    groep: 'globaal',
    waarom:
      'Het Britse Unified Model, traditioneel sterk in de Atlantische stroming die ons weer aanvoert. Voor de vraag of een hogedrukgebied blijft liggen of een depressie tóch doorschuift is de Britse kijk een waardevolle onafhankelijke stem — zij zitten stroomopwaarts van ons.'
  },
  {
    id: 'cmc_gem_gdps',
    naam: 'CMC GEM Global',
    aanbieder: 'Environment Canada',
    land: 'Canada',
    vlag: '🇨🇦',
    resolutie: '15 km',
    horizon: 10,
    update: 'elke 12 uur',
    dekking: 'wereldwijd',
    groep: 'globaal',
    waarom:
      'Het Canadese globale model, gebouwd voor een continent vol koudeluchtuitbraken en daardoor scherp op de posities van fronten. Hij staat hier vooral als volwaardig vierde onafhankelijke fysische motor: vier modellen die het eens zijn is een steviger argument dan drie.'
  },
  {
    id: 'jma_gsm',
    naam: 'JMA GSM',
    aanbieder: 'Japan Meteorological Agency',
    land: 'Japan',
    vlag: '🇯🇵',
    resolutie: '55 km',
    horizon: 11,
    update: 'elke 6 uur',
    dekking: 'wereldwijd',
    groep: 'globaal',
    waarom:
      'Het Japanse globale model. Met 55 km is hij grof — verwacht geen enkel detail over Meerssen — maar hij is volledig zelfstandig ontwikkeld en getuned op een heel ander klimaat. Precies daarom is hij bruikbaar: ziet een grof, ver van hier gebouwd model hetzelfde patroon, dan zit dat patroon er echt.'
  },
  {
    id: 'kma_gdps',
    naam: 'KMA GDPS',
    aanbieder: 'Korea Meteorological Administration',
    land: 'Zuid-Korea',
    vlag: '🇰🇷',
    resolutie: '13 km',
    horizon: 12,
    update: 'elke 6 uur',
    dekking: 'wereldwijd',
    groep: 'globaal',
    waarom:
      'Zuid-Korea draait een eigen variant van het Britse Unified Model, met eigen data-assimilatie. Familie van UKMO dus, en dat is juist het nut: staan die twee samen tegenover ECMWF, dan wijkt er één modelfamilie af en niet twee losse meningen.'
  },
  {
    id: 'cma_grapes_global',
    naam: 'CMA GRAPES Global',
    aanbieder: 'China Meteorological Administration',
    land: 'China',
    vlag: '🇨🇳',
    resolutie: '15 km',
    horizon: 10,
    update: 'elke 6 uur',
    dekking: 'wereldwijd',
    groep: 'globaal',
    waarom:
      'Het Chinese globale model, volledig eigen ontwikkeling. Voor Europa hoort hij niet bij de topmodellen, maar hij is een echte buitenstaander in dit gezelschap. Het helpt om te weten of de uitschieter in de spreiding een Chinese of een Amerikaanse is.'
  },
  {
    id: 'bom_access_global',
    naam: 'BOM ACCESS-G',
    aanbieder: 'Bureau of Meteorology',
    land: 'Australië',
    vlag: '🇦🇺',
    resolutie: '15 km',
    horizon: 10,
    update: 'elke 6 uur',
    dekking: 'wereldwijd',
    groep: 'globaal',
    waarom:
      'Het Australische globale model, ook uit de Unified Model-familie. Ver van huis en niet op Europa geoptimaliseerd; hij staat er voor de volledigheid van "alle modellen" en als extra stem in de spreiding — niet als model waarop je je zaterdag plant.'
  },

  // -------------------------------------------------------------- regionaal
  {
    id: 'dwd_icon_eu',
    naam: 'DWD ICON-EU',
    aanbieder: 'Deutscher Wetterdienst',
    land: 'Duitsland',
    vlag: '🇩🇪',
    resolutie: '7 km',
    horizon: 5,
    update: 'elke 3 uur',
    dekking: 'Europa',
    groep: 'regionaal',
    waarom:
      'Dezelfde Duitse motor als ICON Global, maar ingezoomd op Europa met een 7 km-raster. Genoeg detail om de Ardennen, het Maasdal en het Limburgse plateau van elkaar te onderscheiden — en dat is precies het schaalniveau waarop zomerse buien zich organiseren.'
  },
  {
    id: 'dwd_icon_d2',
    naam: 'DWD ICON-D2',
    aanbieder: 'Deutscher Wetterdienst',
    land: 'Duitsland',
    vlag: '🇩🇪',
    resolutie: '2 km',
    horizon: 2,
    update: 'elke 3 uur',
    dekking: 'Duitsland en directe buurlanden (Zuid-Limburg valt erbinnen)',
    groep: 'regionaal',
    waarom:
      'Het 2 km-model over Duitsland en de directe buurlanden; Zuid-Limburg valt er ruim binnen. Op deze resolutie worden buien niet met een formule geschat maar daadwerkelijk uitgerekend. Dat is het verschil tussen "kans op een bui" en "rond vier uur staat er een onweersbui boven Meerssen".',
    letOp: 'Kijkt nauwelijks twee dagen vooruit, dus hij doet pas op 26 augustus mee.'
  },
  {
    id: 'knmi_harmonie_arome_netherlands',
    naam: 'KNMI Harmonie-AROME Nederland',
    aanbieder: 'KNMI',
    land: 'Nederland',
    vlag: '🇳🇱',
    resolutie: '2 km',
    horizon: 2.5,
    update: 'elk uur',
    dekking: 'Nederland',
    groep: 'regionaal',
    thuismodel: true,
    waarom:
      'Het model waarop het KNMI zijn eigen verwachtingen en waarschuwingen baseert, specifiek voor Nederland afgeregeld: onze land-zeeverdeling, onze bodem, onze kustinvloed. Voor de vraag "kan het buiten of moeten we naar binnen" is dit het laatste woord — het thuismodel voor deze locatie.',
    letOp: 'Rekent maar 2,5 dag vooruit; hij doet pas de laatste twee dagen mee.'
  },
  {
    id: 'knmi_harmonie_arome_europe',
    naam: 'KNMI Harmonie-AROME Europa',
    aanbieder: 'KNMI',
    land: 'Nederland',
    vlag: '🇳🇱',
    resolutie: '5,5 km',
    horizon: 2.5,
    update: 'elk uur',
    dekking: 'Noordwest-Europa',
    groep: 'regionaal',
    waarom:
      'Dezelfde KNMI-code over een groter Europees gebied: iets grover, maar met meer aanloop en meer omgeving in beeld. Nuttig als tussenstap — hij laat het weersysteem zien dat het Nederlandse model straks in detail gaat uitrekenen.'
  },
  {
    id: 'dmi_harmonie_arome_europe',
    naam: 'DMI Harmonie-AROME Europa',
    aanbieder: 'Danmarks Meteorologiske Institut',
    land: 'Denemarken',
    vlag: '🇩🇰',
    resolutie: '2 km',
    horizon: 2.5,
    update: 'elke 3 uur',
    dekking: 'Noordwest-Europa',
    groep: 'regionaal',
    waarom:
      'Het Deense instituut draait dezelfde Harmonie-AROME-familie als het KNMI, maar met eigen instellingen en een eigen datastroom over Noordwest-Europa. Twee keer bijna hetzelfde model dat tóch verschilt vertelt je hoeveel van de verwachting echt vaststaat en hoeveel keuze van de bouwer is.'
  },
  {
    id: 'meteofrance_arpege_europe',
    naam: 'Météo-France ARPEGE Europa',
    aanbieder: 'Météo-France',
    land: 'Frankrijk',
    vlag: '🇫🇷',
    resolutie: '11 km',
    horizon: 4,
    update: 'elke 6 uur',
    dekking: 'Europa',
    groep: 'regionaal',
    waarom:
      'De Fransen kijken vanaf de andere kant naar hetzelfde weer, en voor Zuid-Limburg is dat relevant: veel zomerse onweersclusters komen vanuit Frankrijk of over de Ardennen aanlopen. ARPEGE heeft dat brongebied fijner in beeld dan een globaal model.'
  },
  {
    id: 'meteofrance_arome_france_hd',
    naam: 'Météo-France AROME HD',
    aanbieder: 'Météo-France',
    land: 'Frankrijk',
    vlag: '🇫🇷',
    resolutie: '1,5 km',
    horizon: 2,
    update: 'elke 3 uur',
    dekking: 'Frankrijk — Meerssen ligt op of net buiten de rand',
    groep: 'regionaal',
    dekkingOnzeker: true,
    waarom:
      'Met 1,5 km het fijnste raster in de hele lijst. De vraag is alleen of Meerssen binnen het Franse rekengebied valt: we zitten op of net buiten de noordoostrand. Hij staat erbij om dat feitelijk te laten zien — komt er niets terug, dan meldt de kaart eerlijk "geen dekking" in plaats van dat we hem stilletjes weglaten.'
  },
  {
    id: 'chmi_aladin_central_europe_2km',
    naam: 'CHMI Aladin Centraal-Europa',
    aanbieder: 'Český hydrometeorologický ústav',
    land: 'Tsjechië',
    vlag: '🇨🇿',
    resolutie: '2 km',
    horizon: 2.5,
    update: 'elke 6 uur',
    dekking: 'Centraal-Europa — dekking op Meerssen onzeker',
    groep: 'regionaal',
    dekkingOnzeker: true,
    waarom:
      'Het Tsjechische Aladin-model op 2 km over Centraal-Europa. Of zijn gebied tot in Limburg doorloopt is niet zeker; ook hier laat de app het gewoon zien in plaats van erover te gokken.'
  },

  // ------------------------------------------------------------- referentie
  {
    id: 'best_match',
    naam: 'Open-Meteo Best Match',
    aanbieder: 'Open-Meteo',
    land: 'samenstelling',
    vlag: '🌍',
    resolutie: 'wisselend',
    horizon: 16,
    update: 'elk uur',
    dekking: 'wereldwijd',
    groep: 'referentie',
    waarom:
      'Geen eigen model, maar de keuze die Open-Meteo zelf maakt: per uur pakken ze het fijnste model dat op deze plek geldig is en plakken die aan elkaar. Dit is ongeveer de verwachting die je in een gewone weerapp op je telefoon ziet. Handig als ijkpunt — wijkt hij af van de mediaan, dan leunt hij op één hoge-resolutiemodel dat de rest niet steunt.'
  }
];

export const MODEL_IDS = MODELLEN.map((m) => m.id);

export function model(id) {
  return MODELLEN.find((m) => m.id === id);
}

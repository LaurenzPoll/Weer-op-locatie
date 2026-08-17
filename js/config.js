// Instellingen van de app. Alles wat je normaal zou willen wijzigen staat hier.

// De dag waar deze app over gaat, als ISO-datum (JJJJ-MM-DD).
// Wil je een andere dag bekijken? Wijzig deze ene regel en klaar.
export const TARGET_DATE = '2026-08-28';

// De plek waarvoor we de verwachting ophalen.
export const LOCATION = {
  naam: 'Meerssen',
  regio: 'Limburg',
  latitude: 50.8917,
  longitude: 5.75,
  timezone: 'Europe/Amsterdam'
};

export const API_BASE = 'https://api.open-meteo.com/v1/forecast';

// Hoe lang een ophaal geldig blijft voordat de app opnieuw naar Open-Meteo gaat.
// De modellen worden hoogstens elk uur bijgewerkt, dus vaker dan dit heeft geen zin.
export const CACHE_TTL_MS = 30 * 60 * 1000;

// Hoeveel dagen we in één keer opvragen. 16 is het maximum van de API.
// We vragen bewust een vast aantal dagen op in plaats van een datumbereik:
// modellen die maar 2,5 dag vooruitkijken geven op een datumbereik buiten hun
// horizon een harde fout, terwijl ze op forecast_days simpelweg korter antwoorden.
export const FORECAST_DAYS = 16;

// localStorage-sleutels. Verhoog het versienummer als de opslagvorm verandert.
export const CACHE_KEY = 'weer-op-locatie:cache:v1';
export const HISTORY_KEY = 'weer-op-locatie:historie:v1';

// Niet vaker dan eens per 3 uur een meetpunt aan de trendgeschiedenis toevoegen,
// zodat driftig op verversen drukken de trendlijn niet volspamt.
export const HISTORY_MIN_GAP_MS = 3 * 60 * 60 * 1000;
export const HISTORY_MAX_ENTRIES = 240;

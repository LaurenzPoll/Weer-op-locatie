// Nederlandse notatie op één plek, zodat komma's en eenheden overal gelijk zijn.

const nul = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });
const een = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function temp(v) {
  return v === null || v === undefined ? '–' : `${een.format(v)} °C`;
}

export function graden(v) {
  return v === null || v === undefined ? '–' : een.format(v);
}

export function mm(v) {
  if (v === null || v === undefined) return '–';
  return `${v < 10 ? een.format(v) : nul.format(v)} mm`;
}

export function kmh(v) {
  return v === null || v === undefined ? '–' : `${nul.format(v)} km/u`;
}

export function procent(v) {
  return v === null || v === undefined ? '–' : `${nul.format(v)} %`;
}

export function uren(v) {
  return v === null || v === undefined ? '–' : `${een.format(v)} uur`;
}

export function heel(v) {
  return v === null || v === undefined ? '–' : nul.format(v);
}

export function metTeken(v, eenheid = '') {
  if (v === null || v === undefined) return '–';
  const t = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${t}${een.format(Math.abs(v))}${eenheid}`;
}

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MAANDEN = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'
];

export function langeDatum(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]} ${d.getFullYear()}`;
}

/** "26 augustus" — zonder jaartal, voor tekst binnen hetzelfde jaar. */
export function dagMaand(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} ${MAANDEN[d.getMonth()]}`;
}

export function korteDatum(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} ${MAANDEN[d.getMonth()].slice(0, 3)}`;
}

export function tijdstip(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

export function datumTijd(iso) {
  const d = new Date(iso);
  const vandaag = new Date();
  const zelfdeDag = d.toDateString() === vandaag.toDateString();
  const tijd = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  if (zelfdeDag) return `vandaag ${tijd}`;
  return `${d.getDate()} ${MAANDEN[d.getMonth()].slice(0, 3)} ${tijd}`;
}

export function geledenTekst(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'net';
  if (min < 60) return `${min} min geleden`;
  const uur = Math.round(min / 60);
  if (uur < 24) return `${uur} uur geleden`;
  const dag = Math.round(uur / 24);
  return `${dag} ${dag === 1 ? 'dag' : 'dagen'} geleden`;
}

export function dagenTot(iso) {
  const doel = new Date(`${iso}T00:00:00`);
  const nu = new Date();
  const vandaag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());
  return Math.round((doel - vandaag) / 86400000);
}

// Weericoontjes, met de hand getekend. Vlakken in plaats van dunne lijnen, zodat
// ze op 18 px nog leesbaar zijn en op 72 px niet grof worden. Kleur komt uit de
// thema-tokens (--zon, --wolk, --regen), dus ze kloppen in licht en donker. In de
// 8-bitmodus komen dezelfde acht weerbeelden als pixelkunst uit pixels.js.

import { PIXEL, PIXEL_ICONEN, pixelSvg } from './pixels.js';

const WOLK_HOOG = `<g class="wolk">
    <circle cx="9.2" cy="9.8" r="3.6"/>
    <circle cx="14.4" cy="8.8" r="4.4"/>
    <rect x="5.4" y="10.4" width="13.4" height="4.8" rx="2.4"/>
  </g>`;

const ZON_KLEIN = `<circle class="zonvlak" cx="7.4" cy="6.6" r="3"/>
  <g class="stralen"><path d="M7.4 1.2v1.3M2 6.6h1.3M3.6 2.8l.9.9M11.2 2.8l-.9.9"/></g>`;

const ICONEN = {
  zon: `<circle class="zonvlak" cx="12" cy="12" r="4.6"/>
    <g class="stralen">
      <path d="M12 2.4v2.6M12 19v2.6M2.4 12h2.6M19 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9"/>
    </g>`,
  halfzon: `<circle class="zonvlak" cx="8.6" cy="7.6" r="3.3"/>
    <g class="stralen">
      <path d="M8.6 1.6v1.8M2.6 7.6h1.8M4.1 3.1l1.3 1.3M13.1 3.1l-1.3 1.3"/>
    </g>
    <g class="wolk">
      <circle cx="12.4" cy="15.4" r="3.2"/>
      <circle cx="16.4" cy="14.6" r="3.9"/>
      <rect x="9.3" y="16" width="10.8" height="4.3" rx="2.15"/>
    </g>`,
  wolk: `<g class="wolk">
      <circle cx="9.4" cy="12.6" r="3.7"/>
      <circle cx="14.4" cy="11.6" r="4.5"/>
      <rect x="5.7" y="13.4" width="12.9" height="4.9" rx="2.45"/>
    </g>`,
  mist: `<g class="wolk">
      <rect x="3.5" y="7" width="17" height="2.6" rx="1.3"/>
      <rect x="5.5" y="11.4" width="14" height="2.6" rx="1.3"/>
      <rect x="3.5" y="15.8" width="15" height="2.6" rx="1.3"/>
    </g>`,
  regen: `${WOLK_HOOG}
    <g class="druppels"><path d="M8.2 17.6l-1 2.6M12.2 17.6l-1 2.6M16.2 17.6l-1 2.6"/></g>`,
  bui: `${ZON_KLEIN}
    <g class="wolk" transform="translate(2.2 2)">
      <circle cx="9.2" cy="9.8" r="3.4"/>
      <circle cx="13.8" cy="8.9" r="4.1"/>
      <rect x="5.6" y="10.3" width="12.4" height="4.6" rx="2.3"/>
    </g>
    <g class="druppels"><path d="M10.6 19.4l-.9 2.2M14.4 19.4l-.9 2.2M18.2 19.4l-.9 2.2"/></g>`,
  sneeuw: `${WOLK_HOOG}
    <g class="vlokken"><circle cx="8" cy="18.6" r="1.2"/><circle cx="12" cy="20.2" r="1.2"/><circle cx="16" cy="18.6" r="1.2"/></g>`,
  onweer: `${WOLK_HOOG}
    <path class="bliksem" d="M12.6 14.2l-3.1 4.6h2.6l-1.2 4 4.1-5.6h-2.7l1.6-3z"/>`
};

/** Van WMO-weercode naar een van de iconen hierboven. */
export function icoonVoorCode(code) {
  if (code === null || code === undefined) return 'wolk';
  if (code <= 1) return 'zon';
  if (code === 2) return 'halfzon';
  if (code === 3) return 'wolk';
  if (code === 45 || code === 48) return 'mist';
  if (code >= 51 && code <= 67) return 'regen';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'sneeuw';
  if (code >= 80 && code <= 82) return 'bui';
  if (code >= 95) return 'onweer';
  return 'wolk';
}

export function icoon(naam, klasse = '') {
  if (PIXEL) return pixelSvg(PIXEL_ICONEN[naam] ?? PIXEL_ICONEN.wolk, `ic ic-${naam}${klasse ? ` ${klasse}` : ''}`);
  const inhoud = ICONEN[naam] ?? ICONEN.wolk;
  return `<svg class="ic ic-${naam}${klasse ? ` ${klasse}` : ''}" viewBox="0 0 24 24" aria-hidden="true">${inhoud}</svg>`;
}

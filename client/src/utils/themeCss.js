// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The stylesheets of the themes that have one (client/src/themes/<id>.css),
// as text for the pages presented decks and the PDF are written into. Each
// one is scoped to .deck-theme-<id> (deckThemeClass), which the slides'
// container carries. The editor loads the same files with the app (main.jsx).

import bauhaus from '../themes/bauhaus.css?raw'
import pixel from '../themes/pixel.css?raw'
import mission from '../themes/mission.css?raw'
import turin from '../themes/turin.css?raw'
import gutter from '../themes/gutter.css?raw'
import lemma from '../themes/lemma.css?raw'
import beamline from '../themes/beamline.css?raw'
import kourou from '../themes/kourou.css?raw'
import ledger from '../themes/ledger.css?raw'

const SHEETS = { bauhaus, pixel, mission, turin, gutter, lemma, beamline, kourou, ledger }

// The class a theme's stylesheet is scoped to, for a slide's container
export function deckThemeClass(themeId) {
  return /^[\w-]+$/.test(themeId || '') ? `deck-theme-${themeId}` : ''
}

// A theme's stylesheet, or '' for a theme without one
export function themeCss(themeId) {
  return Object.prototype.hasOwnProperty.call(SHEETS, themeId) ? SHEETS[themeId] : ''
}

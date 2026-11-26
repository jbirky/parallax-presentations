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
import preprint from '../themes/preprint.css?raw'
import transit from '../themes/transit.css?raw'
import trace from '../themes/trace.css?raw'
import prompt from '../themes/prompt.css?raw'
import zenith from '../themes/zenith.css?raw'
import quincunx from '../themes/quincunx.css?raw'
import partition from '../themes/partition.css?raw'
import holdout from '../themes/holdout.css?raw'
import separatrix from '../themes/separatrix.css?raw'
import runlevel from '../themes/runlevel.css?raw'
import fanout from '../themes/fanout.css?raw'
import cell from '../themes/cell.css?raw'
import graticule from '../themes/graticule.css?raw'
import eigenstate from '../themes/eigenstate.css?raw'
import mise from '../themes/mise.css?raw'
import valence from '../themes/valence.css?raw'
import quadrille from '../themes/quadrille.css?raw'
import inspiral from '../themes/inspiral.css?raw'
import parti from '../themes/parti.css?raw'
import downforce from '../themes/downforce.css?raw'
import parallax from '../themes/parallax.css?raw'

const SHEETS = { bauhaus, pixel, mission, turin, gutter, lemma, beamline, kourou, ledger, preprint, transit, trace, prompt, zenith, quincunx, partition, holdout, separatrix, runlevel, fanout, cell, graticule, eigenstate, mise, valence, quadrille, inspiral, parti, downforce, parallax }

// The class a theme's stylesheet is scoped to, for a slide's container
export function deckThemeClass(themeId) {
  return /^[\w-]+$/.test(themeId || '') ? `deck-theme-${themeId}` : ''
}

// A theme's stylesheet, or '' for a theme without one
export function themeCss(themeId) {
  return Object.prototype.hasOwnProperty.call(SHEETS, themeId) ? SHEETS[themeId] : ''
}

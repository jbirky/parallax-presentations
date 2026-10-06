// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The example decks (catalog.js), built from each element's own templates and
// defaults, so they show what the editor makes today. The server serves them
// at /examples/<slug> and /api/examples/<slug> through
// server/services/deck-html.js (scripts/build-deck-html.js), and a guest who
// opens one in the editor starts from it (GuestPage).

import { FEYNMAN_TEMPLATES, feynmanBox } from '../utils/feynmanDiagram'
import { CIRCUIT_TEMPLATES, circuitBox } from '../utils/circuitDiagram'
import { LOGIC_TEMPLATES, logicBox } from '../utils/logicDiagram'
import { FREEBODY_TEMPLATES, freebodyBox } from '../utils/freebodyDiagram'
import { VENN_TEMPLATES, vennBox, vennModel } from '../utils/vennDiagram'
import { TIMING_TEMPLATES, timingBox } from '../utils/timingDiagram'
import { geometryFromTemplate, GEOMETRY_SIZE } from '../utils/geometryDiagram'
import { defaultPeriodic, periodicBox } from '../utils/periodicTable'
import { defaultHarmonics } from '../utils/harmonicsView'
import { MOLECULE_DEFAULTS } from '../utils/moleculeViewer'
import { defaultEquation, EQUATION_SIZE } from '../utils/equationTerms'
import { defaultGraph, defaultGraph3d, GRAPH_COLORS } from '../utils/graphPage'

// The structure file the chemistry deck's molecule loads, from client/public
export const CAFFEINE_SRC = '/examples/caffeine.sdf'

const W = 960, H = 540
const GRAPH_BOX = { w: 560, h: 400 }
const ink = dark => (dark ? '#ffffff' : '#1a1a1a')

// One deck's builder: ids that are unique within it, and its slides' parts
function builder(slug) {
  let n = 0
  const id = () => slug + '-' + (++n)
  const heading = html => ({ id: id(), type: 'text', x: 60, y: 28, width: 840, height: 72, zIndex: 3, content: '<h2 style="margin: 0; font-size: 40px; line-height: 1.25">' + html + '</h2>' })
  const caption = (html, dark = true) => ({ id: id(), type: 'text', x: 60, y: 476, width: 840, height: 40, zIndex: 3, content: '<p style="text-align: center; margin: 0; font-size: 18px; line-height: 1.4; opacity: 0.72' + (dark ? '' : '; color: #2a2a35') + '">' + html + '</p>' })
  // An element of box's shape, as large as fits the area under the heading
  const placed = (fields, box, area = { x: 60, y: 100, w: 840, h: 366 }) => {
    const s = Math.min(area.w / box.w, area.h / box.h)
    const w = Math.round(box.w * s), h = Math.round(box.h * s)
    return { id: id(), x: Math.round(area.x + (area.w - w) / 2), y: Math.round(area.y + (area.h - h) / 2), width: w, height: h, zIndex: 2, ...fields }
  }
  const slide = (dark, elements) => ({ id: id(), notes: '', background: { type: 'color', color: dark ? '#1e1e2e' : '#fbfaf7' }, elements })
  const deck = (title, dark, slides) => ({ id: 'example-' + slug, title, theme: dark ? 'black' : 'white', transition: 'slide', slideWidth: W, slideHeight: H, slides })
  return { id, heading, caption, placed, slide, deck }
}

// A template's diagram, in a slide's ink, stepping from the first step
const fromTemplate = (list, key, dark, extra = {}) => ({ ...list.find(t => t.key === key).build(), color: ink(dark), stepStart: 1, ...extra })
const feynman = (key, dark) => { const d = fromTemplate(FEYNMAN_TEMPLATES, key, dark, { dimPast: true }); return [{ type: 'feynman', ...d }, feynmanBox(d)] }
const circuit = (key, dark) => { const d = fromTemplate(CIRCUIT_TEMPLATES, key, dark, { symbols: 'us', flow: true, readings: true }); return [{ type: 'circuit', ...d }, circuitBox(d)] }
const logic = (key, dark) => { const d = fromTemplate(LOGIC_TEMPLATES, key, dark, { symbols: 'us', values: true }); return [{ type: 'logic', ...d }, logicBox(d)] }
const freebody = (key, dark) => { const d = fromTemplate(FREEBODY_TEMPLATES, key, dark); return [{ type: 'freebody', ...d }, freebodyBox(d)] }
const venn = (key, dark) => { const d = { ...vennModel(VENN_TEMPLATES.find(t => t.key === key).build()), color: ink(dark), stepStart: 1 }; return [{ type: 'venn', ...d }, vennBox(d)] }
const timing = (key, dark) => { const d = { source: TIMING_TEMPLATES.find(t => t.key === key).source, theme: dark ? 'dark' : 'light', steps: [], revealFrom: 0, cursor: true, stepStart: 1 }; return [{ type: 'timing', ...d }, timingBox(d)] }
const geometry = (key, dark) => [{ type: 'geometry', ...geometryFromTemplate(key, { dark }) }, GEOMETRY_SIZE]

// A galaxy's rotation speed against radius: the stars' Keplerian fall, and
// the flat curve a pseudo-isothermal dark halo gives
function rotationCurve(view) {
  const c = GRAPH_COLORS.dark
  return {
    type: 'graph',
    ...defaultGraph(true),
    expressions: [
      { id: 'disk', text: 'y = sqrt(M/x)', color: c[1], style: 'dashed' },
      { id: 'halo', text: 'y = sqrt(M/x + h^2 (1 - (c/x) atan(x/c)))', color: c[0] },
      { id: 'mass', text: 'M = 6', slider: { min: 0, max: 20, step: 0.1 } },
      { id: 'speed', text: 'h = 1.6', slider: { min: 0, max: 3, step: 0.05 } },
      { id: 'core', text: 'c = 2', slider: { min: 0.2, max: 8, step: 0.1 } },
    ],
    view,
    equalScale: false,
    xLabel: 'radius (kpc)',
    yLabel: 'v (100 km/s)',
  }
}

const BUILDERS = {
  hero() {
    const b = builder('hero')
    return b.deck('Parallax', true, [
      b.slide(true, [b.heading('Why galaxies spin too fast'), { id: b.id(), x: 60, y: 100, width: 840, height: 370, zIndex: 2, ...rotationCurve({ xMin: 0, xMax: 24, yMin: 0, yMax: 3.6 }) }, b.caption('Dashed: the stars alone. Solid: with a dark halo. Drag a slider.')]),
      b.slide(true, [b.heading('Gluon fusion to a Higgs'), b.placed(...feynman('ggf', true)), b.caption('Press → to draw each propagator in turn')]),
      b.slide(true, [b.heading('Euclid I.1: an equilateral triangle'), b.placed(...geometry('euclid', true)), b.caption('The construction draws itself; drag A or B')]),
    ])
  },
  chemistry() {
    const b = builder('chemistry')
    const table = defaultPeriodic(true)
    return b.deck('Chemistry', true, [
      b.slide(true, [b.placed({ type: 'periodic', ...table }, periodicBox(table), { x: 24, y: 20, w: 912, h: 500 })]),
      b.slide(true, [
        b.heading('Caffeine, C<sub>8</sub>H<sub>10</sub>N<sub>4</sub>O<sub>2</sub>'),
        b.placed({ type: 'molecule', ...MOLECULE_DEFAULTS, spin: true, src: CAFFEINE_SRC, format: 'sdf', name: 'Caffeine', source: { db: 'pubchem', id: '2519' }, view: null }, { w: 420, h: 360 }),
        b.caption('Drag to turn it, scroll to zoom'),
      ]),
    ])
  },
  circuit() {
    const b = builder('circuit')
    return b.deck('Circuits, solved', true, [
      b.slide(true, [b.heading('A voltage divider'), b.placed(...circuit('divider', true)), b.caption('Currents and voltages come from a DC solver, and the current flows')]),
      b.slide(true, [b.heading('A Wheatstone bridge'), b.placed(...circuit('bridge', true))]),
    ])
  },
  rotation() {
    const b = builder('rotation')
    return b.deck('Rotation curves', true, [
      b.slide(true, [b.heading('Why galaxies spin too fast'), b.placed(rotationCurve({ xMin: 0, xMax: 20, yMin: 0, yMax: 4 }), GRAPH_BOX, { x: 60, y: 100, w: 840, h: 370 }), b.caption('Dashed: the stars alone. Solid: with a dark halo. Drag the sliders.')]),
      b.slide(true, [b.heading('Fitting the halo: Bayes’ rule, term by term'), b.placed({ type: 'equation', ...defaultEquation(true) }, EQUATION_SIZE), b.caption('Click a term to see what it means')]),
    ])
  },
  logic() {
    const b = builder('logic')
    return b.deck('Digital logic', true, [
      b.slide(true, [b.heading('A half adder, gate by gate'), b.placed(...logic('half', true)), b.caption('Click an input to flip it; the outputs follow')]),
      b.slide(true, [b.heading('An SPI byte, mode 0'), b.placed(...timing('spi', true))]),
    ])
  },
  orbitals() {
    const b = builder('orbitals')
    return b.deck('Orbitals and surfaces', true, [
      b.slide(true, [b.heading('Spherical harmonics'), b.placed({ type: 'harmonics', ...defaultHarmonics(true) }, { w: 576, h: 389 }), b.caption('Change l and m while you present')]),
      b.slide(true, [b.heading('A surface you can turn'), b.placed({ type: 'graph', ...defaultGraph3d(true), spin: true }, GRAPH_BOX)]),
    ])
  },
  freebody() {
    const b = builder('freebody')
    return b.deck('Forces on a block', true, [
      b.slide(true, [b.heading('A block sliding down, with friction'), b.placed(...freebody('slide', true)), b.caption('Each force arrives on its own step; ΣF = ma is solved for you')]),
      b.slide(true, [b.heading('A sled pulled at an angle'), b.placed(...freebody('sled', true))]),
    ])
  },
  venn() {
    const b = builder('venn')
    return b.deck('Venn diagrams', false, [
      b.slide(false, [b.heading('De Morgan’s law'), b.placed(...venn('demorgan', false)), b.caption('Each side shades in, step by step', false)]),
      b.slide(false, [b.heading('Probability: rain and lateness'), b.placed(...venn('probability', false))]),
    ])
  },
  feynman() {
    const b = builder('feynman')
    return b.deck('Feynman diagrams', true, [
      b.slide(true, [b.heading('Gluon fusion to a Higgs'), b.placed(...feynman('ggf', true)), b.caption('Press → to draw each propagator in turn')]),
      b.slide(true, [b.heading('Compton scattering'), b.placed(...feynman('compton', true))]),
    ])
  },
  geometry() {
    const b = builder('geometry')
    return b.deck('Euclid I.1', false, [
      b.slide(false, [b.heading('Euclid I.1: an equilateral triangle'), b.placed(...geometry('euclid', false)), b.caption('The construction draws itself one step at a time; drag A or B', false)]),
      b.slide(false, [b.heading('Thales’ theorem'), b.placed(...geometry('thales', false))]),
    ])
  },
}

export const EXAMPLE_SLUGS = Object.keys(BUILDERS)

// The deck for an example's slug, made fresh each time, or null
export function exampleDeck(slug) {
  return Object.prototype.hasOwnProperty.call(BUILDERS, slug) ? BUILDERS[slug]() : null
}

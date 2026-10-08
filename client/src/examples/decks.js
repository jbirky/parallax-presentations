// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The example decks (catalog.js), built from each element's own templates and
// defaults, so they show what the editor makes today. The exoplanet and
// Gaia decks plot the example datasets (datasets.js). The server serves them
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

// The Solar System's planets: orbital period (days) and mass (Earth masses),
// labeled where a label has room
const SOLAR_SYSTEM = [
  ['mercury', 87.97, 0.0553, 'Mercury'], ['venus', 224.7, 0.815], ['earth', 365.25, 1, 'Earth'], ['mars', 687, 0.107],
  ['jupiter', 4332.6, 317.8, 'Jupiter'], ['saturn', 10759, 95.2, 'Saturn'], ['uranus', 30687, 14.5], ['neptune', 60190, 17.1, 'Neptune'],
]

// Under a slide that plots example datasets: when the data was fetched, how
// many rows the largest has (`things`), and whose data it is, from the
// deck's datasets (parallax.datasets, which names no dataset here, so the
// deck carries none whole for it)
const dataFooter = (things, credit, color) => `<div id="f" style="font: 12.5px/1.5 -apple-system, 'Segoe UI', sans-serif; color: ${color}"></div>
<script>
parallax.datasets.list().then(function (all) {
  var d = all.reduce(function (a, b) { return (b.rowCount || 0) > (a.rowCount || 0) ? b : a })
  var when = d.asOf ? new Date(d.asOf).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'today'
  document.getElementById('f').textContent = 'Data as of ' + when + ' · ' + (d.rowCount || 0).toLocaleString('en-US') + ' ${things} · ${credit}'
})
</script>`
const DATA_FOOTER = dataFooter('planets', 'NASA Exoplanet Archive', '#6f6d68')

// The HR diagram's view: Gaia's BP − RP color across, and G-band
// luminosity on a log scale, so brighter is up
const HR_VIEW = { xMin: -0.6, xMax: 5.6, yMin: 5e-6, yMax: 200 }
const HR_BOX = { x: 60, y: 96, w: 840, h: 360 }
// Where a point of the HR diagram lies on the slide
function hrAt(x, y) {
  const v = HR_VIEW, top = Math.log10(v.yMax), span = top - Math.log10(v.yMin)
  return {
    x: HR_BOX.x + (x - v.xMin) / (v.xMax - v.xMin) * HR_BOX.w,
    y: HR_BOX.y + (top - Math.log10(y)) / span * HR_BOX.h,
  }
}

// The latest planets, as a table read from the deck's "newest" dataset
const NEWEST_TABLE = `<style>
  body { font: 15px/1.4 -apple-system, 'Segoe UI', sans-serif; color: #1a1a1a; }
  table { border-collapse: collapse; width: 100%; }
  th { text-align: left; font-weight: 600; font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase; color: #6f6d68; padding: 6px 16px 8px 0; border-bottom: 1.5px solid #c3c2b7; }
  td { padding: 6px 16px 6px 0; border-bottom: 1px solid #e7e6e0; font-variant-numeric: tabular-nums; }
  .num { text-align: right; }
  td:first-child { font-weight: 600; }
</style>
<table>
  <thead><tr><th>Planet</th><th>Found by</th><th class="num">Period (days)</th><th class="num">Mass (Earth = 1)</th><th>Published</th></tr></thead>
  <tbody id="rows"></tbody>
</table>
<script>
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function cell(text, cls) {
  var td = document.createElement('td')
  td.textContent = text
  if (cls) td.className = cls
  return td
}
function num(v) { return v == null ? '' : Number(v).toLocaleString('en-US', { maximumSignificantDigits: 3 }) }
function month(v) { var p = String(v || '').split('-'); return p.length > 1 ? MONTHS[+p[1] - 1] + ' ' + p[0] : String(v || '') }
parallax.datasets.query("newest").then(function (d) {
  var c = d.columns, body = document.getElementById('rows')
  for (var i = 0; i < c.pl_name.length; i++) {
    var tr = document.createElement('tr')
    tr.append(cell(c.pl_name[i]), cell(c.discoverymethod[i]), cell(num(c.pl_orbper[i]), 'num'), cell(num(c.pl_bmasse[i]), 'num'), cell(month(c.disc_pubdate[i])))
    body.append(tr)
  }
})
</script>`

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
  exoplanets() {
    const b = builder('exoplanets')
    const c = GRAPH_COLORS.light
    const footer = () => ({ id: b.id(), type: 'html', x: 60, y: 500, width: 840, height: 28, zIndex: 3, content: DATA_FOOTER })
    const graph = fields => ({ id: b.id(), x: 60, y: 96, width: 840, height: 360, zIndex: 2, type: 'graph', ...defaultGraph(false), equalScale: false, ...fields })
    const caption = html => ({ ...b.caption(html, false), y: 464, height: 32 })
    return b.deck('Exoplanets', false, [
      b.slide(false, [
        b.heading('Exoplanets by orbital period and mass'),
        graph({
          expressions: [
            { id: 'planets', text: '', color: c[1], data: { dataset: 'exoplanets', x: 'pl_orbper', y: 'pl_bmasse', mark: 'points', colorBy: 'Discovered by', label: 'pl_name', size: 2.2, opacity: 0.75 } },
            ...SOLAR_SYSTEM.map(([id, period, mass, label]) => ({ id, text: `(${period}, ${mass})`, color: '#1a1a1a', step: 1, ...(label ? { label } : {}) })),
            // m sin i for a 1 m/s wobble of a Sun-like star: 11.2 Earth masses at one year
            { id: 'rv', text: 'y = 11.2 (x/365.25)^(1/3)', color: c[3], style: 'dashed', step: 2 },
          ],
          // Room on the right for the key
          view: { xMin: 0.1, xMax: 1e7, yMin: 0.01, yMax: 3e4 },
          xScale: 'log',
          yScale: 'log',
          xLabel: 'orbital period (days)',
          yLabel: 'mass (Earth = 1)',
        }),
        caption('Press → for the Solar System, then the mass that moves a Sun-like star by 1 m/s'),
        footer(),
      ]),
      b.slide(false, [
        b.heading('Planets found each year'),
        graph({
          expressions: [{ id: 'per-year', text: '', color: c[1], data: { dataset: 'discoveries', x: 'disc_year', y: 'planets', mark: 'bars' } }],
          view: { xMin: 1989, xMax: 2028, yMin: 0, yMax: 1650 },
          yLabel: 'planets with a mass',
        }),
        caption('Counted by a step on the same dataset, so the bars follow every refresh'),
        footer(),
      ]),
      b.slide(false, [
        b.heading('The newest planets in the archive'),
        { id: b.id(), type: 'html', x: 60, y: 110, width: 840, height: 340, zIndex: 2, content: NEWEST_TABLE },
        caption('The latest published discoveries, read by an HTML element with parallax.datasets'),
        footer(),
      ]),
    ])
  },
  gaia() {
    const b = builder('gaia')
    const c = GRAPH_COLORS.dark
    const footer = () => ({ id: b.id(), type: 'html', x: 60, y: 500, width: 840, height: 28, zIndex: 3, content: dataFooter('stars within 50 parsecs', 'ESA/Gaia/DPAC, Gaia DR3', 'rgba(255, 255, 255, 0.5)') })
    const graph = fields => ({ id: b.id(), x: HR_BOX.x, y: HR_BOX.y, width: HR_BOX.w, height: HR_BOX.h, zIndex: 2, type: 'graph', ...defaultGraph(true), equalScale: false, ...fields })
    const caption = html => ({ ...b.caption(html), y: 464, height: 32 })
    // A name for part of the diagram, left-aligned at its (color, luminosity),
    // at the slide's step 1
    const name = (text, x, y) => {
      const at = hrAt(x, y)
      return {
        id: b.id(), type: 'text', x: Math.round(at.x), y: Math.round(at.y - 18), width: 180, height: 36, zIndex: 3, fragment: true, fragmentIndex: 1,
        content: '<p style="margin: 0; font-size: 17px; line-height: 36px; font-style: italic; color: #f5d68f">' + text + '</p>',
      }
    }
    return b.deck('The solar neighborhood', true, [
      b.slide(true, [
        b.heading('The Sun’s neighbors, measured by Gaia'),
        graph({
          expressions: [
            { id: 'stars', text: '', color: '#ffe9c4', data: { dataset: 'nearby_stars', x: 'bp_rp', y: 'luminosity', mark: 'points', size: 1.3, opacity: 0.8 } },
            // The Sun's BP − RP (Casagrande & VandenBerg 2018)
            { id: 'sun', text: '(0.82, 1)', color: '#ffc531', step: 2, label: 'Sun' },
          ],
          view: { ...HR_VIEW },
          yScale: 'log',
          xLabel: 'color, BP − RP (blue to red)',
          yLabel: 'G-band luminosity (Sun = 1)',
        }),
        name('Main sequence', 2.75, 0.06),
        name('White dwarfs', 1.7, 1.3e-4),
        name('Red giants', 1.35, 8),
        caption('Press → to name the sequences, then to find the Sun'),
        footer(),
      ]),
      b.slide(true, [
        b.heading('Stars fill space evenly'),
        graph({
          expressions: [
            { id: 'shells', text: '', color: c[1], data: { dataset: 'star_counts', x: 'shell', y: 'stars', mark: 'bars' } },
            // A shell's volume, 4πd² by a parsec, times one density
            { id: 'even', text: 'y = 4π · 0.053 x^2', color: c[4], step: 1 },
          ],
          // Room under the bars for the distances
          view: { xMin: 0, xMax: 51, yMin: -100, yMax: 1800 },
          xLabel: 'distance (parsecs)',
          yLabel: 'stars in each parsec-thick shell',
        }),
        caption('Press → for 4πd² times one density, 0.053 stars per cubic parsec'),
        footer(),
      ]),
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

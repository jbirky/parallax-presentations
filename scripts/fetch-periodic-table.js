// Writes client/src/utils/periodicData.js, the periodic table element's data,
// from PubChem's periodic table (PUG REST): fetched once and committed, so a
// deck needs no internet to present one. Run again to refresh it:
//
//   node scripts/fetch-periodic-table.js
//
// It cleans what PubChem writes several ways and fixes the few entries below
// that are wrong, then checks every electron configuration adds up to Z.

const fs = require('fs')
const path = require('path')

const URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON'
const TARGET = path.join(__dirname, '..', 'client/src/utils/periodicData.js')

// Corrections to PubChem's table, by atomic number
const FIXES = {
  // Lawrencium's ground state is 7p¹, not 6d¹ (Sato et al., Nature 2015)
  103: { config: '[Rn] 5f14 7s2 7p1' },
  // Isolated in 1825 and 1808; PubChem lists both as known in ancient times
  13: { year: 1825 },
  20: { year: 1808 },
}

const CORE = { He: 2, Ne: 10, Ar: 18, Kr: 36, Xe: 54, Rn: 86 }
const SPDF = 'spdf'

const num = s => (s === '' || s == null ? null : Number.isFinite(parseFloat(s)) ? parseFloat(s) : null)

// "[He] 2s2 2p3", "[Rn]7s2 7p2 5f14 6d10 (predicted)" → { config: '[Rn] 5f14 6d10 7s2 7p2', note: 'predicted' }
function cleanConfig(raw) {
  const note = (/\(([^)]+)\)/.exec(raw) || [])[1] || ''
  let s = raw.replace(/\([^)]*\)/g, '').trim()
  const core = (/^\[(\w+)\]/.exec(s) || [])[1] || ''
  s = s.replace(/^\[\w+\]/, '')
  const subs = s.split(/\s+/).filter(Boolean).map(t => {
    const m = /^(\d)([spdf])(\d+)$/.exec(t)
    if (!m) throw new Error(`Can't read the subshell ${t} in ${raw}`)
    return { n: +m[1], l: SPDF.indexOf(m[2]), e: +m[3] }
  })
  // Filling order, which is how PubChem writes most of them
  subs.sort((a, b) => (a.n + a.l) - (b.n + b.l) || a.n - b.n)
  const text = subs.map(x => `${x.n}${SPDF[x.l]}${x.e}`).join(' ')
  return { config: core ? `[${core}]${text ? ' ' + text : ''}` : text, note }
}

function electrons(config) {
  const core = (/^\[(\w+)\]/.exec(config) || [])[1]
  return (core ? CORE[core] : 0) + config.replace(/^\[\w+\]/, '').split(/\s+/).filter(Boolean)
    .reduce((sum, t) => sum + +/^\d[spdf](\d+)$/.exec(t)[1], 0)
}

// "6, 4,2, 1, 0" → "+6, +4, +2, +1, 0"
const cleanOx = s => (s || '').split(',').map(p => p.trim()).filter(Boolean).map(p => (/^[1-9]/.test(p) ? '+' + p : p)).join(', ')

async function main() {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`PubChem answered ${res.status}`)
  const table = (await res.json()).Table
  const cols = table.Columns.Column
  const at = name => {
    const i = cols.indexOf(name)
    if (i < 0) throw new Error(`PubChem's table has no ${name} column`)
    return i
  }
  const C = Object.fromEntries(['AtomicNumber', 'Symbol', 'Name', 'AtomicMass', 'ElectronConfiguration', 'Electronegativity', 'AtomicRadius',
    'IonizationEnergy', 'ElectronAffinity', 'OxidationStates', 'StandardState', 'MeltingPoint', 'BoilingPoint', 'Density', 'GroupBlock', 'YearDiscovered'].map(n => [n, at(n)]))

  const rows = table.Row.map(({ Cell: c }) => {
    const z = +c[C.AtomicNumber]
    const { config, note } = cleanConfig(c[C.ElectronConfiguration])
    const state = /^Expected to be an? (\w+)/.exec(c[C.StandardState])
    const year = /^\d+$/.test(c[C.YearDiscovered]) ? +c[C.YearDiscovered] : c[C.YearDiscovered]
    const row = {
      z, symbol: c[C.Symbol], name: c[C.Name], mass: c[C.AtomicMass], config, note,
      en: num(c[C.Electronegativity]), radius: num(c[C.AtomicRadius]), ie: num(c[C.IonizationEnergy]), ea: num(c[C.ElectronAffinity]),
      ox: cleanOx(c[C.OxidationStates]), state: state ? state[1] : c[C.StandardState], predicted: state ? 1 : 0,
      mp: num(c[C.MeltingPoint]), bp: num(c[C.BoilingPoint]), density: num(c[C.Density]), category: c[C.GroupBlock], year,
    }
    Object.assign(row, FIXES[z] || {})
    if (FIXES[z]?.config) row.config = cleanConfig(FIXES[z].config).config
    if (electrons(row.config) !== z) throw new Error(`${row.symbol}'s configuration ${row.config} has ${electrons(row.config)} electrons`)
    return row
  }).sort((a, b) => a.z - b.z)
  if (rows.length !== 118 || rows.some((r, i) => r.z !== i + 1)) throw new Error(`Expected elements 1 to 118, got ${rows.length}`)

  const FIELDS = ['z', 'symbol', 'name', 'mass', 'config', 'note', 'en', 'radius', 'ie', 'ea', 'ox', 'state', 'predicted', 'mp', 'bp', 'density', 'category', 'year']
  const fetched = new Date().toISOString().slice(0, 10)
  const out = `// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Written by scripts/fetch-periodic-table.js from PubChem's periodic table,
// ${URL}
// (fetched ${fetched}); run it again rather than editing this. Changes from
// PubChem's own data: Lr's configuration is 7p¹, Al and Ca have the years
// they were isolated, configurations are in filling order with any
// "(predicted)" moved to note, oxidation states all have their signs, and
// "Expected to be a Solid" is a state of Solid with predicted set.
//
// Units: en Pauling; radius pm (van der Waals); ie, ea eV; mp, bp K;
// density g/cm³ (gases at STP too).

export const PERIODIC_SOURCE = { name: 'PubChem', url: 'https://pubchem.ncbi.nlm.nih.gov/periodic-table/', api: ${JSON.stringify(URL)}, fetched: ${JSON.stringify(fetched)} }

export const PERIODIC_FIELDS = ${JSON.stringify(FIELDS)}

export const PERIODIC_ROWS = [
${rows.map(r => '  ' + JSON.stringify(FIELDS.map(f => r[f]))).join(',\n')},
]
`
  fs.writeFileSync(TARGET, out)
  console.log(`Wrote ${path.relative(path.join(__dirname, '..'), TARGET)}: ${rows.length} elements`)
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})

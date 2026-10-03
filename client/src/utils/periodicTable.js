// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Periodic table elements (toolbar: Diagrams → Periodic Table), on PubChem's
// data (periodicData.js, written by scripts/fetch-periodic-table.js).
// Pointing at a tile shows that element in a card in the gap above the
// transition metals, with its electron structure as orbital boxes, Bohr
// shells or orbital clouds; clicking pins it there. Steps highlight groups,
// periods, blocks or categories, pin an element, recolor the table or draw a
// trend's arrows.
//
// periodicRuntime holds all of it, the drawing and what it does, as one
// function that uses nothing from outside: the editor calls it here, and a
// deck carries its source with the data (periodicDeckScript), so a presented
// table works without the app. The table is SVG at a fixed size in its own
// units, scaled to its box, so its text grows with the slide and stays sharp
// in the PDF. The server's pages have this through server/services/deck-html.js.

import { PERIODIC_ROWS, PERIODIC_SOURCE } from './periodicData'

export { PERIODIC_SOURCE }

export function periodicRuntime(ROWS) {
  var SPDF = 'spdf'
  var CORE_Z = { He: 2, Ne: 10, Ar: 18, Kr: 36, Xe: 54, Rn: 86 }
  var SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"
  var MONO = 'Menlo, Consolas, monospace'
  var NS = 'http://www.w3.org/2000/svg'

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  function n1(v) { return String(Math.round(v * 10) / 10) }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

  // ---------- The data, by atomic number

  var EL = {}, BY_SYMBOL = {}
  ROWS.forEach(function (r) {
    var e = {
      z: r[0], sym: r[1], name: r[2], mass: r[3], config: r[4], note: r[5],
      en: r[6], radius: r[7], ie: r[8], ea: r[9], ox: r[10], state: r[11], predicted: !!r[12],
      mp: r[13], bp: r[14], density: r[15], cat: r[16],
      year: typeof r[17] === 'number' ? r[17] : null, yearText: r[17] == null ? '' : String(r[17]),
    }
    e.massNum = parseFloat(e.mass)
    EL[e.z] = e
    BY_SYMBOL[e.sym.toLowerCase()] = e.z
  })

  // An atomic number from a number or a symbol, or null
  function zOf(v) {
    if (typeof v === 'number' || /^\s*\d+\s*$/.test(String(v))) {
      var n = Math.round(+v)
      return n >= 1 && n <= 118 ? n : null
    }
    return BY_SYMBOL[String(v == null ? '' : v).trim().toLowerCase()] || null
  }

  // ---------- Electron configurations

  var parsed = {}
  function madelung(a, b) { return (a.n + a.l) - (b.n + b.l) || a.n - b.n }
  // { core: 'Ar', subs: [{ n, l, e }] } in filling order, outside the core
  function parse(z) {
    if (parsed[z]) return parsed[z]
    var s = EL[z].config, core = null, m = /^\[(\w+)\]\s*/.exec(s), subs = []
    if (m) { core = m[1]; s = s.slice(m[0].length) }
    s.split(/\s+/).forEach(function (t) {
      var mm = /^(\d)([spdf])(\d+)$/.exec(t)
      if (mm) subs.push({ n: +mm[1], l: SPDF.indexOf(mm[2]), e: +mm[3] })
    })
    subs.sort(madelung)
    return (parsed[z] = { core: core, subs: subs })
  }
  // Every subshell, the core's too
  function fullSubs(z) {
    var p = parse(z)
    return (p.core ? fullSubs(CORE_Z[p.core]) : []).concat(p.subs).sort(madelung)
  }
  // Electrons in each shell, K first
  function shellCounts(z) {
    var counts = []
    fullSubs(z).forEach(function (s) { counts[s.n - 1] = (counts[s.n - 1] || 0) + s.e })
    for (var i = 0; i < counts.length; i++) counts[i] = counts[i] || 0
    return counts
  }
  function unpaired(z) {
    return fullSubs(z).reduce(function (a, s) { var k = 2 * s.l + 1; return a + (s.e <= k ? s.e : 2 * k - s.e) }, 0)
  }
  function subName(s) { return s.n + SPDF[s.l] }

  // ---------- Where each element goes. r: period 1–7, or 9 and 10 for the
  // f rows under the table; c: group 1–18. Group 3 is drawn one of three
  // ways: with 57–71 and 89–103 left out ('gap'), with La and Ac ('la'), or
  // with Lu and Lr ('lu', IUPAC's 2021 recommendation).

  function pos(z, g3) {
    if (z === 1) return { r: 1, c: 1 }
    if (z === 2) return { r: 1, c: 18 }
    var i
    if (z <= 10) { i = z - 3; return { r: 2, c: i < 2 ? i + 1 : i + 11 } }
    if (z <= 18) { i = z - 11; return { r: 3, c: i < 2 ? i + 1 : i + 11 } }
    if (z <= 36) return { r: 4, c: z - 18 }
    if (z <= 54) return { r: 5, c: z - 36 }
    var base = z <= 86 ? 55 : 87, r = z <= 86 ? 6 : 7, fr = z <= 86 ? 9 : 10
    i = z - base
    if (i < 2) return { r: r, c: i + 1 }
    var fi = i - 2
    if (fi <= 14) {
      if (g3 === 'la') return fi === 0 ? { r: r, c: 3 } : { r: fr, c: 3 + fi }
      if (g3 === 'lu') return fi === 14 ? { r: r, c: 3 } : { r: fr, c: 4 + fi }
      return { r: fr, c: 3 + fi }
    }
    return { r: r, c: i - 13 }
  }
  function blockOf(z, g3) {
    var p = pos(z, g3)
    if (p.r >= 9) return 'f'
    if (z === 2 || p.c <= 2) return 's'
    return p.c >= 13 ? 'p' : 'd'
  }
  function groupOf(z, g3) { var p = pos(z, g3); return p.r <= 7 ? p.c : null }
  function periodOf(z, g3) { var p = pos(z, g3); return p.r <= 7 ? p.r : p.r - 3 }

  // ---------- Colors

  var CATEGORIES = ['Alkali metal', 'Alkaline earth metal', 'Transition metal', 'Post-transition metal', 'Metalloid', 'Nonmetal', 'Halogen', 'Noble gas', 'Lanthanide', 'Actinide']
  var CAT_HUE = { 'Alkali metal': 4, 'Alkaline earth metal': 32, 'Transition metal': 210, 'Post-transition metal': 166, 'Metalloid': 70, 'Nonmetal': 118, 'Halogen': 190, 'Noble gas': 268, 'Lanthanide': 318, 'Actinide': 342 }
  var BLOCK_HUE = { s: 4, p: 118, d: 210, f: 318 }
  var STATES = ['Solid', 'Liquid', 'Gas']
  var STATE_HUE = { Solid: 32, Liquid: 205, Gas: 150 }
  var PROPS = {
    en: { label: 'Electronegativity', unit: '', key: 'en', dp: 2 },
    ie: { label: 'Ionization energy', unit: 'eV', key: 'ie', dp: 2 },
    ea: { label: 'Electron affinity', unit: 'eV', key: 'ea', dp: 2 },
    radius: { label: 'Van der Waals radius', unit: 'pm', key: 'radius', dp: 0 },
    mp: { label: 'Melting point', unit: 'K', key: 'mp', dp: 0 },
    bp: { label: 'Boiling point', unit: 'K', key: 'bp', dp: 0 },
    density: { label: 'Density', unit: 'g/cm³', key: 'density', log: true, dp: 3 },
    mass: { label: 'Atomic mass', unit: 'u', key: 'massNum', dp: 1 },
    year: { label: 'Year discovered', unit: '', key: 'year', dp: 0 },
  }
  var RAMP = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b']
  var THEMES = {
    light: { dark: false, fg: '#16202a', muted: '#56636f', faint: '#87929c', line: '#d6dce1', surface: '#ffffff', accent: '#1d5fa6', onAccent: '#ffffff', code: '#e8ecef', pos: '#cf5a1f', neg: '#2470cc', tileS: 72, tileL: 89, strongS: 58, strongL: 44, edge: 0.09 },
    dark: { dark: true, fg: '#e3e8ed', muted: '#9ba7b3', faint: '#7a8692', line: '#3a4652', surface: '#151c22', accent: '#7db0ff', onAccent: '#0e1317', code: '#1f2a33', pos: '#ff9759', neg: '#63a6f7', tileS: 32, tileL: 23, strongS: 62, strongL: 64, edge: 0.08 },
  }

  // hsl to #rrggbb, since an SVG for PowerPoint can't use hsl()
  function hsl(h, s, l) {
    s /= 100; l /= 100
    var a = s * Math.min(l, 1 - l)
    function f(n) { var k = (n + h / 30) % 12; return ('0' + Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16)).slice(-2) }
    return '#' + f(0) + f(8) + f(4)
  }
  function rgbOf(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] }
  function rampAt(t, dark) {
    var stops = dark ? RAMP.slice(1).reverse() : RAMP
    t = clamp(t, 0, 1) * (stops.length - 1)
    var i = Math.min(stops.length - 2, Math.floor(t)), f = t - i, a = rgbOf(stops[i]), b = rgbOf(stops[i + 1])
    var c = a.map(function (v, k) { return Math.round(v + (b[k] - v) * f) })
    var lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255
    return { bg: '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2) }).join(''), ink: lum < 0.5 ? '#ffffff' : '#0f1720' }
  }
  var ranges = {}
  function propRange(p) {
    if (ranges[p.key]) return ranges[p.key]
    var vals = []
    for (var z = 1; z <= 118; z++) { var v = EL[z][p.key]; if (v != null && isFinite(v) && (!p.log || v > 0)) vals.push(p.log ? Math.log10(v) : v) }
    return (ranges[p.key] = [Math.min.apply(null, vals), Math.max.apply(null, vals)])
  }
  function heatT(p, v) {
    if (v == null || !isFinite(v) || (p.log && v <= 0)) return null
    var r = propRange(p), x = p.log ? Math.log10(v) : v
    return (x - r[0]) / (r[1] - r[0] || 1)
  }
  function fmtVal(p, v) {
    if (v == null || !isFinite(v)) return '—'
    if (p.key === 'density') return v < 0.01 ? v.toExponential(1) : v < 1 ? v.toFixed(3) : v.toFixed(2)
    return (p.dp === 0 ? String(Math.round(v)) : v.toFixed(p.dp)).replace('-', '−')
  }
  function keyOf(z, colorBy, g3) {
    var e = EL[z]
    return colorBy === 'category' ? e.cat : colorBy === 'block' ? blockOf(z, g3) : colorBy === 'state' ? e.state : null
  }
  function hueOf(z, colorBy, g3) {
    var e = EL[z]
    return colorBy === 'block' ? BLOCK_HUE[blockOf(z, g3)] : colorBy === 'state' ? STATE_HUE[e.state] : CAT_HUE[e.cat]
  }

  // ---------- Settings

  var COLOR_BY = ['category', 'block', 'state', 'en', 'ie', 'ea', 'radius', 'mp', 'bp', 'density', 'mass', 'year']
  var VIEWS = ['boxes', 'shells', 'clouds', 'none']
  var SHOWS = ['all', 'periods-1-4', 'main-group', 'periods-1-3', 'element']
  var TILE_LABELS = ['auto', 'name', 'mass', 'valence', 'none']
  var TRENDS = {
    en: { label: 'Electronegativity', right: true, up: true },
    ie: { label: 'Ionization energy', right: true, up: true },
    ea: { label: 'Electron affinity', right: true, up: true },
    radius: { label: 'Atomic radius', right: false, up: false },
    metallic: { label: 'Metallic character', right: false, up: false },
  }
  var HL_KINDS = ['group', 'period', 'block', 'category', 'state', 'z']

  function pick(v, list, d) { return list.indexOf(v) >= 0 ? v : d }

  // A highlight: "group:1,2", "period:3", "block:p", "category:Halogen",
  // "state:Gas" or "z:6,7,8" (numbers or symbols), several joined by ";"
  function parseHighlight(spec) {
    var out = []
    String(spec || '').split(';').forEach(function (part) {
      var m = /^\s*(\w+)\s*:\s*(.*)$/.exec(part)
      if (!m || HL_KINDS.indexOf(m[1]) < 0) return
      var kind = m[1], vals = []
      m[2].split(',').forEach(function (raw) {
        var v = raw.trim(), n = +v, hit = null
        if (kind === 'group') hit = n >= 1 && n <= 18 && n % 1 === 0 ? n : null
        else if (kind === 'period') hit = n >= 1 && n <= 7 && n % 1 === 0 ? n : null
        else if (kind === 'block') hit = /^[spdf]$/.test(v) ? v : null
        else if (kind === 'category') hit = CATEGORIES.filter(function (c) { return c.toLowerCase() === v.toLowerCase() })[0] || null
        else if (kind === 'state') hit = STATES.filter(function (c) { return c.toLowerCase() === v.toLowerCase() })[0] || null
        else hit = zOf(v)
        if (hit != null && vals.indexOf(hit) < 0) vals.push(hit)
      })
      if (vals.length) out.push({ kind: kind, vals: vals })
    })
    return out
  }
  function cleanHighlight(spec) {
    return parseHighlight(spec).map(function (h) { return h.kind + ':' + h.vals.join(',') }).join(';')
  }
  var hlCache = {}
  function highlighted(spec, z, g3) {
    var hs = hlCache[spec] || (hlCache[spec] = parseHighlight(spec))
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i], v = h.kind === 'group' ? groupOf(z, g3) : h.kind === 'period' ? periodOf(z, g3) : h.kind === 'block' ? blockOf(z, g3)
        : h.kind === 'category' ? EL[z].cat : h.kind === 'state' ? EL[z].state : z
      if (h.vals.indexOf(v) >= 0) return true
    }
    return false
  }

  function normStep(st) {
    st = st && typeof st === 'object' ? st : {}
    return { highlight: cleanHighlight(st.highlight), pin: zOf(st.pin), arrow: TRENDS[st.arrow] ? st.arrow : '', colorBy: pick(st.colorBy, COLOR_BY, '') }
  }
  // An element's settings, every one checked, as everything else here takes them
  function normalize(el) {
    el = el && typeof el === 'object' ? el : {}
    var start = Math.round(+el.stepStart)
    return {
      colorBy: pick(el.colorBy, COLOR_BY, 'category'),
      orbitalView: pick(el.orbitalView, VIEWS, 'boxes'),
      showCore: !!el.showCore,
      group3: pick(el.group3, ['gap', 'la', 'lu'], 'gap'),
      show: pick(el.show, SHOWS, 'all'),
      restingElement: el.restingElement === null ? null : zOf(el.restingElement) || 26,
      card: pick(el.card, ['gap', 'side', 'none'], 'gap'),
      tileLabel: pick(el.tileLabel, TILE_LABELS, 'auto'),
      labels: el.labels !== false,
      legend: el.legend !== false,
      source: el.source !== false,
      theme: el.theme === 'light' ? 'light' : 'dark',
      highlight: cleanHighlight(el.highlight),
      arrow: TRENDS[el.arrow] ? el.arrow : '',
      stepStart: start >= 1 && start <= 1000 ? start : 1,
      steps: (Array.isArray(el.steps) ? el.steps : []).slice(0, 60).map(normStep),
    }
  }

  // What the table shows at diagram step n: 0 is as it rests; step k is the
  // element's kth step, whose color is the table's unless it sets one
  function viewAt(s, n) {
    var st = n > 0 ? s.steps[n - 1] : null
    if (!st) return { colorBy: s.colorBy, highlight: s.highlight, arrow: s.arrow, pin: null }
    return { colorBy: st.colorBy || s.colorBy, highlight: st.highlight, arrow: st.arrow, pin: st.pin }
  }

  // ---------- Layout, in the drawing's units: a tile is 60 square, 4 apart

  var CARD_WIDE = { w: 636, h: 188 }, CARD_TALL = { w: 372, h: 360 }
  var ROW_H = 18

  function textW(s, fs, k) { return String(s).length * fs * (k || 0.52) }

  // The legend's items, flowed into rows of width w
  function legendItems(colorBy, g3) {
    if (colorBy === 'category') return CATEGORIES.map(function (c) { return { key: c, label: c, hue: CAT_HUE[c] } })
    if (colorBy === 'block') return ['s', 'p', 'd', 'f'].map(function (b) { return { key: b, label: b + '-block', hue: BLOCK_HUE[b] } })
    if (colorBy === 'state') return STATES.map(function (c) { return { key: c, label: c, hue: STATE_HUE[c] } }).concat([{ key: null, label: 'Dashed: predicted' }])
    return null
  }
  function flowLegend(items, w) {
    var x = 0, row = 0, out = []
    items.forEach(function (it) {
      var iw = (it.key != null ? 15 : 0) + textW(it.label, 11)
      if (x > 0 && x + iw > w) { x = 0; row++ }
      out.push({ it: it, x: x, row: row, w: iw })
      x += iw + 14
    })
    return { items: out, rows: row + 1 }
  }
  function legendRows(colorBy, w) {
    var items = legendItems(colorBy)
    return items ? flowLegend(items, w).rows : w >= 700 ? 1 : 2
  }

  function layout(s) {
    var arrows = !!s.arrow || s.steps.some(function (st) { return !!st.arrow })
    if (s.show === 'element') {
      var cw = CARD_WIDE.w, ch = CARD_WIDE.h
      return { W: cw, H: ch, tiles: [], glabels: [], plabels: [], flabels: [], ph: [], card: { x: 0, y: 0, w: cw, h: ch, mode: 'wide' }, legend: null, bands: false, vb: { x: -4, y: -4, w: cw + 8, h: ch + 8 } }
    }
    var wide = s.show === 'all' || s.show === 'periods-1-4'
    var ox = arrows ? 34 : 0, oy = arrows ? 34 : 0, lab = s.labels ? 24 : 0
    var ncol = wide ? 18 : 8
    var maxPeriod = s.show === 'periods-1-4' ? 4 : s.show === 'periods-1-3' ? 3 : 7
    var withF = s.show === 'all'
    var colOf = function (c) { return wide ? c : c <= 2 ? c : c - 10 }
    var X = function (col) { return ox + lab + (col - 1) * 64 }
    var Y = function (r) { return oy + lab + (r <= 7 ? (r - 1) * 64 : 466 + (r - 9) * 64) }
    var L = { tiles: [], glabels: [], plabels: [], flabels: [], ph: [], bands: arrows, ox: ox, oy: oy }
    for (var z = 1; z <= 118; z++) {
      var p = pos(z, s.group3)
      if (p.r > 7 ? !withF : p.r > maxPeriod) continue
      if (!wide && p.c > 2 && p.c < 13) continue
      L.tiles.push({ z: z, x: X(colOf(p.c)), y: Y(p.r), r: p.r, c: colOf(p.c) })
    }
    var GROUPS = wide ? null : [1, 2, 13, 14, 15, 16, 17, 18]
    if (s.labels) {
      for (var col = 1; col <= ncol; col++) L.glabels.push({ x: X(col) + 30, y: oy + 14, t: String(GROUPS ? GROUPS[col - 1] : col) })
      for (var r = 1; r <= maxPeriod; r++) L.plabels.push({ x: ox + 9, y: Y(r) + 34, t: String(r) })
    }
    if (withF) {
      var fStart = s.group3 === 'gap' ? 3 : 4
      L.flabels.push({ x: X(fStart) - 7, y: Y(9) + 34, t: 'Lanthanides' }, { x: X(fStart) - 7, y: Y(10) + 34, t: 'Actinides' })
      if (s.group3 === 'gap') L.ph.push({ x: X(3), y: Y(6), t: '57–71', cat: 'Lanthanide', from: 57, to: 71 }, { x: X(3), y: Y(7), t: '89–103', cat: 'Actinide', from: 89, to: 103 })
    }
    var right = X(ncol) + 60, bottom = withF ? Y(10) + 60 : Y(maxPeriod) + 60
    L.tx0 = X(1); L.tx1 = right; L.ty0 = Y(1); L.ty1 = Y(maxPeriod) + 60
    // In the gap above the transition metals, or beside the table: tall
    // beside a tall table, the gap's shape beside a short one
    var card = null
    if (s.card === 'gap' && wide) card = { x: X(3), y: Y(1), w: CARD_WIDE.w, h: CARD_WIDE.h, mode: 'wide' }
    else if (s.card !== 'none') card = maxPeriod <= 3 && !withF ? { x: right + 16, y: Y(1), w: CARD_WIDE.w, h: CARD_WIDE.h, mode: 'wide' } : { x: right + 16, y: Y(1), w: CARD_TALL.w, h: CARD_TALL.h, mode: 'tall' }
    L.card = card
    var W = card ? Math.max(right, card.x + card.w) : right
    var H = card ? Math.max(bottom, card.y + card.h) : bottom
    L.legend = null
    if (s.legend) {
      var lw = right - ox - lab
      // As many rows as the most any coloring needs, so steps don't move it
      var rows = Math.max(legendRows('category', lw), legendRows('block', lw), legendRows('state', lw), legendRows('en', lw))
      L.legend = { x: ox + lab, y: H + 14, w: lw, h: rows * ROW_H }
      H = L.legend.y + L.legend.h
    }
    L.W = W; L.H = H
    L.vb = { x: -6, y: -6, w: W + 12, h: H + 12 }
    return L
  }

  // ---------- Text

  // A font size that fits text estimated at w into max
  function fit(w, max, fs, min) { return w > max ? Math.max(min || 5, fs * max / w) : fs }
  function text(x, y, s, a) { return '<text x="' + n1(x) + '" y="' + n1(y) + '"' + (a || '') + '>' + esc(s) + '</text>' }
  // Text with superscripts: runs of [base, sup], e.g. [['4s', '2'], ['3d', '6']]
  function supText(x, y, runs, fs, a, sep) {
    var out = '', down = false
    runs.forEach(function (r, i) {
      out += '<tspan' + (down ? ' dy="' + n1(fs * 0.38) + '"' : '') + '>' + esc((i && sep ? sep : '') + r[0]) + '</tspan>'
      down = false
      if (r[1]) { out += '<tspan dy="' + n1(-fs * 0.38) + '" font-size="' + n1(fs * 0.7) + '">' + esc(r[1]) + '</tspan>'; down = true }
    })
    return '<text x="' + n1(x) + '" y="' + n1(y) + '" font-size="' + n1(fs) + '"' + (a || '') + '>' + out + '</text>'
  }
  function runsW(runs, fs, k, sep) {
    return runs.reduce(function (w, r, i) { return w + ((i && sep ? sep.length : 0) + r[0].length) * fs * k + (r[1] || '').length * fs * k * 0.7 }, 0)
  }
  function configRuns(z, full) {
    var p = parse(z), subs = full ? fullSubs(z) : p.subs
    var runs = subs.map(function (s) { return [subName(s), String(s.e)] })
    if (!full && p.core) runs.unshift(['[' + p.core + ']', ''])
    return runs
  }

  // ---------- Tiles

  function look(z, v, s, th) {
    var e = EL[z], prop = PROPS[v.colorBy]
    if (prop) {
      var val = e[prop.key], t = heatT(prop, val)
      if (t == null) return { fill: th.surface, fillOp: 0, ink: th.muted, stroke: th.faint, dash: true, value: prop.key === 'year' && e.yearText ? e.yearText : '—' }
      var c = rampAt(t, th.dark)
      return { fill: c.bg, ink: c.ink, value: fmtVal(prop, val) }
    }
    var h = hueOf(z, v.colorBy, s.group3), strong = hsl(h, th.strongS, th.strongL)
    return { fill: hsl(h, th.tileS, th.tileL), ink: th.fg, stripe: strong, stroke: v.colorBy === 'state' && e.predicted ? strong : null, dash: v.colorBy === 'state' && e.predicted }
  }
  function shortMass(m) { var v = parseFloat(m); return isFinite(v) ? String(Number(v.toFixed(3))) : m }

  function tileSvg(t, s, v, th, o) {
    var z = t.z, e = EL[z], lk = look(z, v, s, th)
    var a = ' data-pt-z="' + z + '" transform="translate(' + t.x + ' ' + t.y + ')"' + (dimmed(z, v, s, o.key) ? ' opacity="0.22"' : '')
    if (o.mode === 'deck') a += ' tabindex="' + (z === o.tab ? 0 : -1) + '" role="button" aria-label="' + esc(e.name + ', ' + z) + '" style="cursor:pointer;outline:none;transition:opacity .18s"'
    else if (o.mode === 'canvas') a += ' style="cursor:pointer;transition:opacity .18s"'
    var h = '<g' + a + '><rect width="60" height="60" rx="6" fill="' + lk.fill + '"' + (lk.fillOp === 0 ? ' fill-opacity="0"' : '')
    h += lk.dash ? ' stroke="' + lk.stroke + '" stroke-dasharray="3 2"/>' : ' stroke="' + th.fg + '" stroke-opacity="' + th.edge + '"/>'
    if (lk.stripe) h += '<rect x="5" y="55" width="50" height="2" rx="1" fill="' + lk.stripe + '" opacity="0.85"/>'
    h += text(5, 12.5, z, ' font-family="' + MONO + '" font-size="9.5" fill="' + lk.ink + '" opacity="0.8"')
    h += text(30, 38, e.sym, ' text-anchor="middle" font-size="22" font-weight="700" fill="' + lk.ink + '"')
    var mode = s.tileLabel === 'auto' ? (lk.value != null ? 'value' : 'name') : s.tileLabel
    var a2 = ' text-anchor="middle" fill="' + lk.ink + '"'
    if (mode === 'value' || (mode === 'name' && lk.value != null && s.tileLabel === 'auto')) {
      h += text(30, 50.5, lk.value, a2 + ' font-family="' + MONO + '" font-size="' + n1(fit(textW(lk.value, 8.6, 0.6), 54, 8.6)) + '"')
    } else if (mode === 'name') {
      h += text(30, 50.5, e.name, a2 + ' font-size="' + n1(fit(textW(e.name, 8.6), 54, 8.6, 6)) + '"')
    } else if (mode === 'mass') {
      var m = shortMass(e.mass)
      h += text(30, 50.5, m, a2 + ' font-family="' + MONO + '" font-size="' + n1(fit(textW(m, 8.6, 0.6), 54, 8.6)) + '"')
    } else if (mode === 'valence') {
      var runs = configRuns(z).filter(function (r) { return r[1] })
      var fs = fit(runsW(runs, 8.6, 0.6), 54, 8.6, 5)
      h += supText(30, 51, runs, fs, a2 + ' font-family="' + MONO + '"')
    }
    return h + '</g>'
  }
  function dimmed(z, v, s, key) {
    return (!!v.highlight && !highlighted(v.highlight, z, s.group3)) || (key != null && keyOf(z, v.colorBy, s.group3) !== key)
  }
  // A placeholder for 57–71 or 89–103 is dimmed when all of them are
  function phDimmed(p, v, s, key) {
    for (var z = p.from; z <= p.to; z++) if (!dimmed(z, v, s, key)) return false
    return true
  }

  // The rings around the element shown, and around one pinned
  function ringsSvg(L, shown, pinned, th) {
    var t = tileAt(L, shown), p = tileAt(L, pinned)
    var tr = function (x) { return x ? ' transform="translate(' + x.x + ' ' + x.y + ')"' : ' visibility="hidden"' }
    return '<g data-pt-rings style="pointer-events:none">' +
      '<rect data-pt-ring="1" x="-1.5" y="-1.5" width="63" height="63" rx="7.5" fill="none" stroke="' + th.accent + '" stroke-width="2.4"' + tr(t) + '/>' +
      '<rect data-pt-ring="2" x="-5.5" y="-5.5" width="71" height="71" rx="10" fill="none" stroke="' + th.accent + '" stroke-width="1.2"' + tr(p) + '/></g>'
  }
  function tileAt(L, z) {
    for (var i = 0; z && i < L.tiles.length; i++) if (L.tiles[i].z === z) return L.tiles[i]
    return null
  }

  // ---------- The card

  function factRows(e) {
    var u = function (v, unit, dp) { return v == null ? '—' : (dp != null ? v.toFixed(dp) : String(v)).replace('-', '−') + (unit ? ' ' + unit : '') }
    return [
      ['en', 'Electronegativity', u(e.en, '', 2)],
      ['ie', 'Ionization energy', u(e.ie, 'eV', 3)],
      ['ea', 'Electron affinity', u(e.ea, 'eV', 3)],
      ['radius', 'Van der Waals radius', u(e.radius, 'pm')],
      ['ox', 'Oxidation states', (e.ox || '—').replace(/-/g, '−')],
      ['mp', 'Melting point', u(e.mp, 'K')],
      ['bp', 'Boiling point', u(e.bp, 'K')],
      ['density', 'Density', e.density == null ? '—' : fmtVal(PROPS.density, e.density) + ' g/cm³'],
    ]
  }

  // The card for element z, in its own units (C: { w, h, mode })
  function cardSvg(z, s, v, th, o, C, at) {
    if (!z || !EL[z]) return ''
    var e = EL[z], lk = look(z, v, s, th), prop = PROPS[v.colorBy]
    var h = '<rect width="' + C.w + '" height="' + C.h + '" rx="8" fill="' + th.surface + '" stroke="' + th.line + '"/>'
    // The element's own tile, large
    h += '<rect x="8" y="8" width="108" height="104" rx="7" fill="' + (lk.fillOp === 0 ? th.code : lk.fill) + '" stroke="' + th.fg + '" stroke-opacity="' + th.edge + '"/>'
    var ink = lk.fillOp === 0 ? th.fg : lk.ink
    h += text(15, 21, z, ' font-family="' + MONO + '" font-size="11" fill="' + ink + '"')
    h += text(109, 21, e.mass, ' text-anchor="end" font-family="' + MONO + '" font-size="' + n1(fit(textW(e.mass, 9.5, 0.6), 64, 9.5)) + '" fill="' + ink + '" opacity="0.72"')
    h += text(62, 72, e.sym, ' text-anchor="middle" font-size="44" font-weight="700" fill="' + ink + '"')
    h += text(62, 98, e.name, ' text-anchor="middle" font-size="' + n1(fit(textW(e.name, 13), 100, 13, 8)) + '" font-weight="600" fill="' + ink + '"')
    var cat = hsl(CAT_HUE[e.cat], th.strongS, th.strongL)
    h += '<rect x="8" y="121" width="8" height="8" rx="2" fill="' + cat + '"/>'
    h += text(20, 129, e.cat, ' font-size="' + n1(fit(textW(e.cat, 10.5), 96, 10.5, 7)) + '" font-weight="600" fill="' + th.fg + '"')
    var meta = [(e.predicted ? 'Predicted ' + e.state.toLowerCase() : e.state) + ' at 298 K', blockOf(z, s.group3) + '-block', e.year ? 'Discovered ' + e.year : e.yearText === 'Ancient' ? 'Known since antiquity' : '']
    meta.forEach(function (m, i) { if (m) h += text(8, 144 + i * 14, m, ' font-size="' + n1(fit(textW(m, 10.5), 108, 10.5, 7)) + '" fill="' + th.muted + '"') })

    // The configuration and the facts
    var x0 = 128, x1 = 364, runs = configRuns(z)
    var note = e.note ? ' (' + e.note + ')' : ''
    var cfs = fit(runsW(runs, 13, 0.6, ' ') + textW(note, 10, 0.55), 236, 13, 7)
    h += supText(x0, 25, runs, cfs, ' font-family="' + MONO + '" fill="' + th.fg + '"', ' ')
      .replace('</text>', note ? '<tspan dy="' + (runs[runs.length - 1][1] ? n1(cfs * 0.38) : 0) + '" font-family="' + SANS + '" font-size="' + n1(cfs * 0.75) + '" fill="' + th.muted + '">' + esc(note) + '</tspan></text>' : '</text>')
    factRows(e).forEach(function (r, i) {
      var y = 48 + i * 16, hl = prop && (prop.key === r[0] || (prop.key === 'massNum' && r[0] === 'mass'))
      var col = hl ? th.accent : th.muted, vcol = hl ? th.accent : th.fg
      var lw = textW(r[1], 11) + 8, val = r[2]
      if (textW(val, 11, 0.6) > 236 - lw) val = val.replace(/, /g, ',')
      h += text(x0, y, r[1], ' font-size="11" fill="' + col + '"')
      h += text(x1, y, val, ' text-anchor="end" font-family="' + MONO + '" font-size="' + n1(fit(textW(val, 11, 0.6), 236 - lw, 11, 6.5)) + '" fill="' + vcol + '"')
    })
    if (s.source) h += text(C.mode === 'wide' ? x1 : C.w - 8, C.h - 7, 'Data: PubChem', ' text-anchor="end" font-size="8.5" fill="' + th.faint + '"')

    // The electron structure
    var B = C.mode === 'wide' ? { x: 376, y: 8, w: C.w - 384, h: C.h - 16 } : { x: 8, y: 190, w: C.w - 16, h: C.h - 210 }
    if (s.orbitalView === 'boxes') h += boxesSvg(z, B, s, th)
    else if (s.orbitalView === 'shells') h += shellsSvg(z, B, th, o.mode === 'deck' && o.animate)
    else if (s.orbitalView === 'clouds') h += cloudsSvg(z, B, th, o, C, at)
    if (o.mode === 'deck' && o.pinned === z) h += text(C.mode === 'wide' ? x0 : 8, C.h - 7, 'Pinned · Esc to let go', ' font-family="' + MONO + '" font-size="9" fill="' + th.accent + '"')
    return h
  }
  function header(B, s, th) { return text(B.x, B.y + 10, s, ' font-family="' + MONO + '" font-size="10" fill="' + th.muted + '"') }

  // One box per orbital, with arrows for its electrons
  function boxesSvg(z, B, s, th) {
    var p = parse(z), all = fullSubs(z), subs = s.showCore ? all : p.subs.slice(), front = all[all.length - 1]
    var h = header(B, 'Orbital boxes · ' + unpaired(z) + ' unpaired', th)
    var area = { x: B.x, y: B.y + 20, w: B.w, h: B.h - 20 }
    var core = !s.showCore && p.core ? '[' + p.core + ']' : null
    var sizes = [18, 15, 13, 11, 9, 7], place = null, bw = 7
    for (var si = 0; si < sizes.length && !place; si++) {
      bw = sizes[si]
      var bh = bw + 4, x = 0, y = 0, items = [], rowH = 12 + bh + 7
      var add = function (w, item) {
        if (x > 0 && x + w > area.w) { x = 0; y += rowH }
        item.x = x; item.y = y; items.push(item); x += w + 9
      }
      if (core) add(textW(core, 11, 0.6) + 12, { core: true })
      subs.forEach(function (sub) { add((2 * sub.l + 1) * bw + 1, { sub: sub }) })
      if (y + rowH - 7 <= area.h || si === sizes.length - 1) place = { items: items, bh: bh }
    }
    place.items.forEach(function (it) {
      var X = area.x + it.x, Y = area.y + it.y
      if (it.core) {
        var cw = textW(core, 11, 0.6) + 12
        h += '<rect x="' + n1(X) + '" y="' + n1(Y + 12) + '" width="' + n1(cw) + '" height="' + n1(place.bh) + '" rx="4" fill="' + th.code + '"/>'
        h += text(X + cw / 2, Y + 12 + place.bh / 2 + 3.8, core, ' text-anchor="middle" font-family="' + MONO + '" font-size="11" fill="' + th.muted + '"')
        return
      }
      var sb = it.sub, k = 2 * sb.l + 1, up = Math.min(sb.e, k), down = Math.max(0, sb.e - k)
      var isFront = sb.n === front.n && sb.l === front.l, w = bw, bh2 = place.bh
      h += text(X, Y + 9, subName(sb), ' font-family="' + MONO + '" font-size="10" fill="' + (isFront ? th.accent : th.muted) + '"')
      for (var i = 0; i < k; i++) {
        var bx = X + i * w + 0.5, by = Y + 12.5
        h += '<rect x="' + n1(bx) + '" y="' + n1(by) + '" width="' + w + '" height="' + bh2 + '" fill="none" stroke="' + th.muted + '"/>'
        var a1 = bx + w * 0.34, a2 = bx + w * 0.66, t = by + bh2 * 0.18, bt = by + bh2 * 0.82, hd = w * 0.2
        var line = ' fill="none" stroke="' + th.fg + '" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
        if (i < up) h += '<path d="M' + n1(a1) + ' ' + n1(bt) + 'V' + n1(t) + 'l' + n1(-hd) + ' ' + n1(hd * 1.2) + '"' + line
        if (i < down) h += '<path d="M' + n1(a2) + ' ' + n1(t) + 'V' + n1(bt) + 'l' + n1(hd) + ' ' + n1(-hd * 1.2) + '"' + line
      }
    })
    return h
  }

  // The Bohr picture: electrons on a ring per shell, the outer one in the accent
  function shellsSvg(z, B, th, animate) {
    var counts = shellCounts(z), N = counts.length, e = EL[z]
    var h = header(B, 'Bohr shells · ' + counts.join(' · '), th)
    var area = { x: B.x, y: B.y + 16, w: B.w, h: B.h - 16 }
    var R = Math.max(20, Math.min(area.h / 2 - 2, (area.w - 56) / 2)), cx = area.x + R + 2, cy = area.y + area.h / 2
    var rIn = Math.max(10, R * 0.28), nucleus = R * 0.17
    h += '<circle cx="' + n1(cx) + '" cy="' + n1(cy) + '" r="' + n1(nucleus) + '" fill="' + hsl(CAT_HUE[e.cat], th.strongS, th.strongL) + '"/>'
    h += text(cx, cy + nucleus * 0.3, e.sym, ' text-anchor="middle" font-size="' + n1(nucleus * 0.85) + '" font-weight="700" fill="' + th.surface + '"')
    for (var k = 0; k < N; k++) {
      var r = N === 1 ? R * 0.55 : rIn + k * (R - rIn) / (N - 1), outer = k === N - 1, n = counts[k], off = k * 0.5
      h += '<circle cx="' + n1(cx) + '" cy="' + n1(cy) + '" r="' + n1(r) + '" fill="none" stroke="' + th.line + '"/>'
      h += '<g>'
      for (var j = 0; j < n; j++) {
        var a = off + j * 2 * Math.PI / n
        h += '<circle cx="' + n1(cx + r * Math.cos(a)) + '" cy="' + n1(cy + r * Math.sin(a)) + '" r="' + n1(R * (n > 18 ? 0.029 : 0.035)) + '" fill="' + (outer ? th.accent : th.fg) + '"/>'
      }
      if (animate) {
        var dur = 14 + k * 7, from = k % 2 ? 360 : 0
        h += '<animateTransform attributeName="transform" type="rotate" from="' + from + ' ' + n1(cx) + ' ' + n1(cy) + '" to="' + (360 - from) + ' ' + n1(cx) + ' ' + n1(cy) + '" dur="' + dur + 's" repeatCount="indefinite"/>'
      }
      h += '</g>'
      h += text(cx + R + 14, area.y + 12 + k * 15, 'KLMNOPQ'[k] + ' ' + n, ' font-family="' + MONO + '" font-size="10.5" fill="' + (outer ? th.accent : th.muted) + '"')
    }
    return h
  }

  // ---------- Orbital clouds: hydrogen-like |ψ|², sampled once per orbital
  // (seeded, so every drawing of it is the same) and drawn at an angle

  var ANG = [
    [{ f: function () { return 1 }, lab: ['s', ''] }],
    [{ f: function (x) { return x }, lab: ['p', 'x'] }, { f: function (x, y) { return y }, lab: ['p', 'y'] }, { f: function (x, y, z) { return z }, lab: ['p', 'z'] }],
    [{ f: function (x, y) { return x * y }, lab: ['d', 'xy'] }, { f: function (x, y, z) { return y * z }, lab: ['d', 'yz'] },
      { f: function (x, y, z) { return 3 * z * z - 1 }, lab: ['d', 'z²'] }, { f: function (x, y, z) { return x * z }, lab: ['d', 'xz'] },
      { f: function (x, y) { return x * x - y * y }, lab: ['d', 'x²−y²'] }],
    [{ f: function (x, y) { return y * (3 * x * x - y * y) }, lab: ['f', 'y(3x²−y²)'] }, { f: function (x, y, z) { return x * y * z }, lab: ['f', 'xyz'] },
      { f: function (x, y, z) { return y * (5 * z * z - 1) }, lab: ['f', 'yz²'] }, { f: function (x, y, z) { return z * (5 * z * z - 3) }, lab: ['f', 'z³'] },
      { f: function (x, y, z) { return x * (5 * z * z - 1) }, lab: ['f', 'xz²'] }, { f: function (x, y, z) { return z * (x * x - y * y) }, lab: ['f', 'z(x²−y²)'] },
      { f: function (x, y) { return x * (x * x - 3 * y * y) }, lab: ['f', 'x(x²−3y²)'] }],
  ]
  function laguerre(k, a, x) {
    if (k === 0) return 1
    var L0 = 1, L1 = 1 + a - x
    for (var i = 1; i < k; i++) { var L2 = ((2 * i + 1 + a - x) * L1 - (i + a) * L0) / (i + 1); L0 = L1; L1 = L2 }
    return L1
  }
  function radial(n, l, r) { var rho = 2 * r / n; return Math.pow(rho, l) * Math.exp(-rho / 2) * laguerre(n - l - 1, 2 * l + 1, rho) }
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  var CLOUD_N = [2600, 1700, 1100, 900]
  var clouds = {}
  function samples(n, l, m) {
    var key = n + '_' + l + '_' + m
    if (clouds[key]) return clouds[key]
    var rand = rng(n * 1000 + l * 100 + m + 1)
    var dir = function () {
      var x, y, z, d
      do { x = rand() * 2 - 1; y = rand() * 2 - 1; z = rand() * 2 - 1; d = x * x + y * y + z * z } while (d > 1 || d < 1e-6)
      d = Math.sqrt(d); return [x / d, y / d, z / d]
    }
    var rmax = 3 * n * n + 10, G = 1200, cdf = new Float64Array(G + 1), acc = 0, i
    for (i = 1; i <= G; i++) { var rr0 = rmax * i / G, R0 = radial(n, l, rr0); acc += rr0 * rr0 * R0 * R0; cdf[i] = acc }
    var Y = ANG[l][m].f, ymax = 0
    for (i = 0; i < 4000; i++) { var d0 = dir(), v0 = Y(d0[0], d0[1], d0[2]); if (v0 * v0 > ymax) ymax = v0 * v0 }
    ymax *= 1.15
    var count = CLOUD_N[l], pts = new Float32Array(count * 4), rs = []
    for (var k = 0; k < count; k++) {
      var u = rand() * acc, lo = 0, hi = G
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid; else hi = mid }
      var rr = rmax * (lo + rand()) / G, d, yv
      do { d = dir(); yv = Y(d[0], d[1], d[2]) } while (rand() * ymax > yv * yv)
      pts[k * 4] = d[0] * rr; pts[k * 4 + 1] = d[1] * rr; pts[k * 4 + 2] = d[2] * rr
      pts[k * 4 + 3] = radial(n, l, rr) * yv >= 0 ? 1 : -1
      rs.push(rr)
    }
    rs.sort(function (a, b) { return a - b })
    return (clouds[key] = { pts: pts, r90: rs[Math.floor(rs.length * 0.92)] })
  }
  // The subshells a cloud can show (outside the core) and the one shown: the
  // one asked for, or the open one with the most lobes (5f for uranium, not
  // its lone 6d electron), or the last filled
  function cloudChoice(z, sub) {
    var p = parse(z), valence = p.subs.length ? p.subs : fullSubs(z)
    var names = valence.map(subName), front = valence[valence.length - 1]
    valence.forEach(function (v) { if (v.e < 2 * (2 * v.l + 1) && (front.e >= 2 * (2 * front.l + 1) || v.l > front.l)) front = v })
    var i = names.indexOf(sub)
    return { valence: valence, sel: i >= 0 ? valence[i] : front }
  }
  // Where each orbital of a subshell goes in a w × h area
  function cloudCells(sub, w, h) {
    var k = 2 * sub.l + 1, up = Math.min(sub.e, k), down = Math.max(0, sub.e - k)
    var rows = k === 1 ? [1] : k === 3 ? [3] : k === 5 ? [3, 2] : [4, 3]
    var labH = 13, cellH = (h - rows.length * labH) / rows.length, cw0 = w / rows[0], cells = [], m = 0
    rows.forEach(function (cnt, ri) {
      var off = (w - cnt * cw0) / 2
      for (var c = 0; c < cnt; c++, m++) cells.push({ x: off + c * cw0, y: ri * (cellH + labH), w: cw0, h: cellH, m: m, occ: (m < up ? 1 : 0) + (m < down ? 1 : 0) })
    })
    return cells
  }
  // Each point of an orbital turned by a about the vertical and tipped toward the viewer
  function projectCell(sub, c, a, count, each) {
    var data = samples(sub.n, sub.l, c.m), pts = data.pts, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(0.42), sb = Math.sin(0.42)
    var R = Math.min(c.w, c.h) / 2 * 0.92 / data.r90, cx = c.x + c.w / 2, cy = c.y + c.h / 2
    var n = Math.min(count || Infinity, pts.length / 4)
    for (var i = 0; i < n * 4; i += 4) {
      var x = pts[i], y = pts[i + 1], z = pts[i + 2]
      var x1 = x * ca - y * sa, y1 = x * sa + y * ca, y2 = y1 * cb - z * sb, z2 = y1 * sb + z * cb
      each(cx + x1 * R, cy - z2 * R, clamp(y2 / (data.r90 || 1), -1, 1), pts[i + 3])
    }
  }
  var STILL = [900, 520, 340, 240]   // points per orbital in a still drawing
  function cloudsSvg(z, B, th, o, C, at) {
    var ch = cloudChoice(z, o.sub), s = ch.sel
    // Chips for the subshells, which a presented deck can switch between
    var h = '', x = B.x
    ch.valence.forEach(function (v) {
      var nm = subName(v), on = nm === subName(s), w = textW(nm, 10, 0.6) + 10
      h += '<g' + (o.mode !== 'static' ? ' data-pt-sub="' + nm + '" style="cursor:pointer"' : '') + '><rect x="' + n1(x) + '" y="' + n1(B.y) + '" width="' + n1(w) + '" height="14" rx="3" fill="' + (on ? th.accent : th.surface) + '" stroke="' + (on ? th.accent : th.line) + '"/>'
      h += text(x + w / 2, B.y + 10.5, nm, ' text-anchor="middle" font-family="' + MONO + '" font-size="10" fill="' + (on ? th.onAccent : th.fg) + '"') + '</g>'
      x += w + 4
    })
    if (x + 70 < B.x + B.w) h += text(B.x + B.w, B.y + 10.5, 'ψ ', ' text-anchor="end" font-family="' + MONO + '" font-size="10" fill="' + th.muted + '"').replace('ψ </text>', 'ψ <tspan fill="' + th.pos + '">+</tspan> <tspan fill="' + th.neg + '">−</tspan></text>')
    var A = { x: B.x, y: B.y + 20, w: B.w, h: B.h - 20 }
    var cells = cloudCells(s, A.w, A.h), k = 2 * s.l + 1, sz = k >= 5 ? 1.1 : 1.3
    // The points, in a few paths by sign and depth
    var paths = {}
    cells.forEach(function (c) {
      var base = c.occ ? 1 : 0.16
      projectCell(s, c, 0.6, STILL[s.l], function (px, py, depth, sign) {
        var bucket = Math.min(3, Math.floor((depth + 1) * 2)), key = (sign > 0 ? 'p' : 'n') + bucket + (base < 1 ? 'e' : '')
        var d = paths[key] || (paths[key] = { d: [], sign: sign, op: base * (0.42 - 0.22 * (bucket / 2 - 0.75)) })
        d.d.push('M' + n1(A.x + px - sz / 2) + ' ' + n1(A.y + py - sz / 2) + 'h' + sz + 'v' + sz + 'h-' + sz + 'z')
      })
    })
    h += '<g data-pt-cloud-static>'
    Object.keys(paths).sort().forEach(function (key) {
      var p = paths[key]
      h += '<path d="' + p.d.join('') + '" fill="' + (p.sign > 0 ? th.pos : th.neg) + '" fill-opacity="' + n1(p.op * 100) / 100 + '"/>'
    })
    h += '</g>'
    // Where a deck draws them turning instead, in the table's units
    h += '<rect data-pt-cloud data-n="' + s.n + '" data-l="' + s.l + '" data-e="' + s.e + '" data-x="' + n1(at.x + A.x) + '" data-y="' + n1(at.y + A.y) + '" data-w="' + n1(A.w) + '" data-h="' + n1(A.h) + '" x="' + n1(A.x) + '" y="' + n1(A.y) + '" width="' + n1(A.w) + '" height="' + n1(A.h) + '" fill="none"/>'
    cells.forEach(function (c) {
      var lab = ANG[s.l][c.m].lab, occ = c.occ === 2 ? ' ↑↓' : c.occ === 1 ? ' ↑' : ''
      h += '<text x="' + n1(A.x + c.x + c.w / 2) + '" y="' + n1(A.y + c.y + c.h + 10) + '" text-anchor="middle" font-family="' + MONO + '" font-size="10" fill="' + (c.occ ? th.fg : th.muted) + '">' +
        esc(lab[0]) + (lab[1] ? '<tspan dy="2.5" font-size="7.5">' + esc(lab[1]) + '</tspan><tspan dy="-2.5">' + esc(occ) + '</tspan>' : esc(occ)) + '</text>'
    })
    return h
  }

  // ---------- The legend and a trend's arrows

  function legendSvg(L, s, v, th, o, shown) {
    var G = L.legend
    if (!G) return ''
    var items = legendItems(v.colorBy), h = ''
    if (items) {
      flowLegend(items, G.w).items.forEach(function (f) {
        var x = G.x + f.x, y = G.y + f.row * ROW_H + 12, it = f.it, on = o.key != null && o.key === it.key
        if (it.key == null) { h += text(x, y, it.label, ' font-size="11" fill="' + th.muted + '" font-style="italic"'); return }
        h += '<g' + (o.mode === 'deck' ? ' data-pt-key="' + esc(it.key) + '" style="cursor:pointer"' : '') + '>'
        h += '<rect x="' + n1(x - 3) + '" y="' + n1(y - 12) + '" width="' + n1(f.w + 6) + '" height="16" fill="' + th.surface + '" fill-opacity="0"' + (on ? ' stroke="' + th.accent + '" rx="4"' : '') + '/>'
        h += '<rect x="' + n1(x) + '" y="' + n1(y - 9) + '" width="10" height="10" rx="2" fill="' + hsl(it.hue, th.strongS, th.strongL) + '"/>'
        h += text(x + 15, y, it.label, ' font-size="11" fill="' + th.fg + '"') + '</g>'
      })
      return h
    }
    var prop = PROPS[v.colorBy], r = propRange(prop), lo = prop.log ? Math.pow(10, r[0]) : r[0], hi = prop.log ? Math.pow(10, r[1]) : r[1]
    var e = shown ? EL[shown] : null, t = e ? heatT(prop, e[prop.key]) : null
    var title = prop.label + (prop.unit ? ' (' + prop.unit + ')' : '') + (t != null ? ' · ' + e.sym + ' ' + fmtVal(prop, e[prop.key]) : '')
    var oneRow = G.w >= 700, tw = oneRow ? Math.min(300, textW(title, 11.5) + 16) : 0
    var by = oneRow ? G.y + 3 : G.y + ROW_H + 3, bx = G.x + tw + textW(fmtVal(prop, lo), 11, 0.6) + 8
    var bw = Math.max(80, Math.min(320, G.w - (bx - G.x) - textW(fmtVal(prop, hi), 11, 0.6) - 100))
    h += text(G.x, G.y + 12, title, ' font-size="' + n1(fit(textW(title, 11.5), oneRow ? tw - 16 : G.w, 11.5, 8)) + '" font-weight="600" fill="' + th.fg + '"')
    h += text(bx - 6, by + 10, fmtVal(prop, lo), ' text-anchor="end" font-family="' + MONO + '" font-size="11" fill="' + th.muted + '"')
    for (var i = 0; i < 24; i++) h += '<rect x="' + n1(bx + i * bw / 24) + '" y="' + by + '" width="' + n1(bw / 24 + 0.4) + '" height="12" fill="' + rampAt((i + 0.5) / 24, th.dark).bg + '"/>'
    if (t != null) h += '<rect data-pt-mark x="' + n1(bx + t * bw - 1) + '" y="' + (by - 4) + '" width="2" height="20" rx="1" fill="' + th.fg + '"/>'
    h += text(bx + bw + 6, by + 10, fmtVal(prop, hi), ' font-family="' + MONO + '" font-size="11" fill="' + th.muted + '"')
    var nx = bx + bw + 14 + textW(fmtVal(prop, hi), 11, 0.6)
    h += '<rect x="' + n1(nx) + '" y="' + (by) + '" width="12" height="12" rx="3" fill="none" stroke="' + th.faint + '" stroke-dasharray="3 2"/>' + text(nx + 17, by + 10, 'no data', ' font-size="11" fill="' + th.muted + '"')
    return h
  }

  function arrowsSvg(L, v, th) {
    if (!v.arrow || !L.bands) return ''
    var t = TRENDS[v.arrow], label = t.label + ' increases', fs = 12, tw = textW(label, fs) + 16
    var a = ' stroke="' + th.accent + '" stroke-width="2" stroke-linecap="round"'
    var head = function (x, y, dx, dy) { return '<path d="M' + n1(x) + ' ' + n1(y) + 'l' + n1(-dx * 10 + dy * 5) + ' ' + n1(-dy * 10 - dx * 5) + 'l' + n1(-dy * 10) + ' ' + n1(dx * 10) + 'z" fill="' + th.accent + '"/>' }
    // Across the top, then down the side
    var y = L.oy - 17, x0 = L.tx0, x1 = L.tx1, mx = (x0 + x1) / 2
    var h = '<line x1="' + n1(x0) + '" y1="' + n1(y) + '" x2="' + n1(mx - tw / 2) + '" y2="' + n1(y) + '"' + a + '/><line x1="' + n1(mx + tw / 2) + '" y1="' + n1(y) + '" x2="' + n1(x1) + '" y2="' + n1(y) + '"' + a + '/>'
    h += t.right ? head(x1 + 2, y, 1, 0) : head(x0 - 2, y, -1, 0)
    h += text(mx, y + 4.2, label, ' text-anchor="middle" font-size="' + fs + '" font-weight="600" fill="' + th.accent + '"')
    var x = L.ox - 17, y0 = L.ty0, y1 = L.ty1, my = (y0 + y1) / 2, th2 = Math.min(tw, (y1 - y0) - 40), vfs = fit(tw - 16, th2 - 16, fs, 7)
    h += '<line x1="' + n1(x) + '" y1="' + n1(y0) + '" x2="' + n1(x) + '" y2="' + n1(my - th2 / 2) + '"' + a + '/><line x1="' + n1(x) + '" y1="' + n1(my + th2 / 2) + '" x2="' + n1(x) + '" y2="' + n1(y1) + '"' + a + '/>'
    h += t.up ? head(x, y0 - 2, 0, -1) : head(x, y1 + 2, 0, 1)
    h += '<text transform="translate(' + n1(x + 4.2) + ' ' + n1(my) + ') rotate(-90)" text-anchor="middle" font-size="' + n1(vfs) + '" font-weight="600" fill="' + th.accent + '">' + esc(label) + '</text>'
    return h
  }

  // ---------- The whole table as SVG. o: view (default the resting one),
  // shown and pinned (atomic numbers), sub (a cloud's subshell), key (a
  // legend entry picked), mode ('static', 'deck' or 'canvas'), standalone
  function render(s, o) {
    o = o || {}
    var v = o.view || viewAt(s, 0), th = THEMES[s.theme], L = layout(s)
    var pinned = o.pinned !== undefined ? o.pinned : v.pin
    var shown = o.shown !== undefined ? o.shown : pinned || s.restingElement
    var mode = o.mode || 'static', ro = { mode: mode, key: o.key == null ? null : o.key, sub: o.sub, pinned: pinned, animate: o.animate, tab: shown || (L.tiles[0] && L.tiles[0].z) }
    var h = ''
    if (L.bands) h += '<g data-pt-arrows>' + arrowsSvg(L, v, th) + '</g>'
    var lab = ' font-family="' + MONO + '" font-size="10" fill="' + th.faint + '" text-anchor="middle"'
    L.glabels.forEach(function (g) { h += text(g.x, g.y, g.t, lab) })
    L.plabels.forEach(function (g) { h += text(g.x, g.y, g.t, lab) })
    L.flabels.forEach(function (g) { h += text(g.x, g.y, g.t, ' font-size="10.5" fill="' + th.muted + '" text-anchor="end"') })
    L.ph.forEach(function (p) {
      var hue = CAT_HUE[p.cat], heat = !!PROPS[v.colorBy]
      h += '<g data-pt-ph="' + p.from + '" transform="translate(' + p.x + ' ' + p.y + ')"' + (phDimmed(p, v, s, ro.key) ? ' opacity="0.22"' : '') + '><rect width="60" height="60" rx="6" fill="' + (heat ? th.surface : hsl(hue, th.tileS, th.tileL)) + '"' + (heat ? ' fill-opacity="0" stroke="' + th.faint + '" stroke-dasharray="3 2"' : ' stroke="' + th.fg + '" stroke-opacity="' + th.edge + '"') + '/>' +
        text(30, 34, p.t, ' text-anchor="middle" font-family="' + MONO + '" font-size="11" fill="' + (heat ? th.muted : th.fg) + '"') + '</g>'
    })
    h += '<g data-pt-tiles>'
    L.tiles.forEach(function (t) { h += tileSvg(t, s, v, th, ro) })
    h += '</g>'
    if (L.tiles.length) h += ringsSvg(L, shown, pinned, th)
    if (L.card) h += '<g data-pt-card transform="translate(' + L.card.x + ' ' + L.card.y + ')">' + cardSvg(shown, s, v, th, ro, L.card, L.card) + '</g>'
    if (L.legend) h += '<g data-pt-legend>' + legendSvg(L, s, v, th, ro, shown) + '</g>'
    var vb = L.vb, size = o.standalone ? ' width="' + n1(vb.w) + '" height="' + n1(vb.h) + '"' : ''
    return '<svg xmlns="' + NS + '" viewBox="' + n1(vb.x) + ' ' + n1(vb.y) + ' ' + n1(vb.w) + ' ' + n1(vb.h) + '" preserveAspectRatio="xMidYMid meet"' + size +
      ' role="group" aria-label="Periodic table" font-family="' + esc(SANS) + '" style="width:100%;height:100%;display:block;overflow:visible">' + h + '</svg>'
  }

  // ---------- On a page: pointing at a tile shows it, a click (or Enter)
  // pins it, Esc lets go. opts.mode: 'deck' (keys, pins, legend picks, steps
  // through setStep, clouds turning when opts.animate) or 'canvas' (the
  // editor's: pointing only, and a double-click calls opts.onPick(z))

  var live = [], escOn = false
  function attach(root, el, opts) {
    opts = opts || {}
    var s = normalize(el), L = layout(s), th = THEMES[s.theme], mode = opts.mode === 'canvas' ? 'canvas' : 'deck'
    var st = { view: viewAt(s, 0), hover: null, pin: null, sub: null, key: null }
    var raf = 0, canvas = null, gone = false
    var win = root.ownerDocument.defaultView || window
    var reduce = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches)
    function shown() { return st.pin != null ? st.pin : st.hover != null ? st.hover : s.restingElement }
    function ro() { return { mode: mode, key: st.key, sub: st.sub, pinned: st.pin, animate: opts.animate && !reduce, tab: shown() || (L.tiles[0] && L.tiles[0].z) } }
    function visible() { var sec = root.closest('section'); return !sec || sec.classList.contains('present') }

    function draw() {
      var a = root.ownerDocument.activeElement, f = a && root.contains(a) && a.getAttribute ? a.getAttribute('data-pt-z') : null
      root.innerHTML = render(s, { view: st.view, shown: shown(), pinned: st.pin, sub: st.sub, key: st.key, mode: mode, animate: opts.animate && !reduce })
      if (f) { var t = root.querySelector('[data-pt-z="' + f + '"]'); if (t && t.focus) t.focus() }
      startClouds()
    }
    function refresh() {
      var z = shown(), o = ro(), tiles = root.querySelectorAll('[data-pt-z]')
      for (var i = 0; i < tiles.length; i++) {
        var g = tiles[i], tz = +g.getAttribute('data-pt-z')
        if (dimmed(tz, st.view, s, st.key)) g.setAttribute('opacity', '0.22'); else g.removeAttribute('opacity')
        if (mode === 'deck') g.setAttribute('tabindex', tz === o.tab ? '0' : '-1')
      }
      L.ph.forEach(function (p) {
        var g = root.querySelector('[data-pt-ph="' + p.from + '"]')
        if (g && phDimmed(p, st.view, s, st.key)) g.setAttribute('opacity', '0.22'); else if (g) g.removeAttribute('opacity')
      })
      var rings = root.querySelector('[data-pt-rings]')
      if (rings) rings.outerHTML = ringsSvg(L, z, st.pin, th)
      var card = root.querySelector('[data-pt-card]')
      if (card) card.innerHTML = cardSvg(z, s, st.view, th, o, L.card, L.card)
      var lg = root.querySelector('[data-pt-legend]')
      if (lg) lg.innerHTML = legendSvg(L, s, st.view, th, o, z)
      startClouds()
    }

    // The clouds on a canvas over the card, turning slowly
    function stopClouds() {
      if (raf) win.cancelAnimationFrame(raf)
      raf = 0
      if (canvas) { canvas.parentNode && canvas.parentNode.removeChild(canvas); canvas = null }
    }
    function startClouds() {
      stopClouds()
      var mark = mode === 'deck' && opts.animate && root.querySelector('[data-pt-cloud]')
      if (!mark || !win.requestAnimationFrame) return
      var sub = { n: +mark.getAttribute('data-n'), l: +mark.getAttribute('data-l'), e: +mark.getAttribute('data-e') }
      var A = { x: +mark.getAttribute('data-x'), y: +mark.getAttribute('data-y'), w: +mark.getAttribute('data-w'), h: +mark.getAttribute('data-h') }
      var cells = cloudCells(sub, A.w, A.h), k = 2 * sub.l + 1, sz = k >= 5 ? 1.1 : 1.3
      var cv = root.ownerDocument.createElement('canvas')
      cv.setAttribute('aria-hidden', 'true')
      cv.style.cssText = 'position:absolute;pointer-events:none;'
      if (win.getComputedStyle(root).position === 'static') root.style.position = 'relative'
      root.appendChild(cv)
      canvas = cv
      var ctx = cv.getContext && cv.getContext('2d')
      if (!ctx) return stopClouds()
      var still = root.querySelector('[data-pt-cloud-static]')
      if (still) still.setAttribute('visibility', 'hidden')
      var t0 = win.performance ? win.performance.now() : Date.now()
      function frame(now) {
        if (!reduce) raf = win.requestAnimationFrame(frame)
        if (!visible() || !root.clientWidth) return
        var vb = L.vb, cw = root.clientWidth, chh = root.clientHeight, kk = Math.min(cw / vb.w, chh / vb.h)
        var ox = (cw - vb.w * kk) / 2, oy = (chh - vb.h * kk) / 2
        var zoom = root.getBoundingClientRect().width / cw, dpr = (win.devicePixelRatio || 1) * (zoom || 1)
        var W = Math.round(A.w * kk * dpr), H = Math.round(A.h * kk * dpr)
        cv.style.left = (ox + (A.x - vb.x) * kk) + 'px'; cv.style.top = (oy + (A.y - vb.y) * kk) + 'px'
        cv.style.width = (A.w * kk) + 'px'; cv.style.height = (A.h * kk) + 'px'
        if (cv.width !== W) cv.width = W
        if (cv.height !== H) cv.height = H
        ctx.setTransform(W / A.w, 0, 0, H / A.h, 0, 0)
        ctx.clearRect(0, 0, A.w, A.h)
        var a = 0.6 + (reduce ? 0 : ((now || t0) - t0) / 1000 * 0.35)
        cells.forEach(function (c) {
          var base = c.occ ? 1 : 0.16
          projectCell(sub, c, a, 0, function (px, py, depth, sign) {
            ctx.globalAlpha = base * (0.42 - 0.22 * depth)
            ctx.fillStyle = sign > 0 ? th.pos : th.neg
            ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz)
          })
        })
        ctx.globalAlpha = 1
      }
      raf = win.requestAnimationFrame(frame)
    }

    function tileOf(t) { var g = t && t.closest ? t.closest('[data-pt-z]') : null; return g && root.contains(g) ? g : null }
    function onOver(ev) {
      var g = tileOf(ev.target)
      if (!g || st.pin != null) return
      var z = +g.getAttribute('data-pt-z')
      if (st.hover !== z) { st.hover = z; st.sub = null; refresh() }
    }
    function onLeave() { if (st.hover != null && st.pin == null) { st.hover = null; st.sub = null; refresh() } }
    function onClick(ev) {
      var t = ev.target, chip = t && t.closest && t.closest('[data-pt-sub]')
      if (chip) { st.sub = chip.getAttribute('data-pt-sub'); refresh(); return }
      if (mode !== 'deck') return
      var key = t && t.closest && t.closest('[data-pt-key]')
      if (key) { var kk = key.getAttribute('data-pt-key'); st.key = st.key === kk ? null : kk; refresh(); return }
      var g = tileOf(t)
      if (!g) return
      var z = +g.getAttribute('data-pt-z')
      st.pin = st.pin === z ? null : z
      st.hover = st.pin == null ? z : null
      st.sub = null
      refresh()
    }
    function onDbl(ev) { var g = tileOf(ev.target); if (g && opts.onPick) opts.onPick(+g.getAttribute('data-pt-z')) }
    // A click doesn't take focus, so the deck's keys (and a clicker's) still
    // change slides after one; Tab does, for moving with the arrow keys
    function onDown(ev) { if (tileOf(ev.target) || (ev.target.closest && ev.target.closest('[data-pt-sub],[data-pt-key]'))) ev.preventDefault() }
    function onFocus(ev) {
      var g = tileOf(ev.target)
      if (!g || st.pin != null) return
      var z = +g.getAttribute('data-pt-z')
      if (st.hover !== z) { st.hover = z; st.sub = null; refresh() }
    }
    // Arrow keys move between tiles while one has focus, and go no further
    // (a deck's would change the slide); Enter or space pins
    function onKey(ev) {
      var g = tileOf(ev.target)
      if (!g) return
      var z = +g.getAttribute('data-pt-z')
      // Esc with nothing pinned gives the keys back to the deck
      if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); g.blur(); onLeave(); return }
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault(); ev.stopPropagation()
        st.pin = st.pin === z ? null : z; st.hover = z; st.sub = null
        refresh()
        return
      }
      var d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[ev.key]
      if (!d) return
      ev.preventDefault(); ev.stopPropagation()
      var cur = tileAt(L, z), best = null, bestScore = Infinity
      L.tiles.forEach(function (t) {
        var dr = (t.y - cur.y) / 64, dc = (t.x - cur.x) / 64
        var along = d[0] ? dr * d[0] : dc * d[1], across = d[0] ? Math.abs(dc) : Math.abs(dr)
        if (along <= 0.01) return
        var score = along + across * 3
        if (score < bestScore) { bestScore = score; best = t.z }
      })
      if (best) { var n = root.querySelector('[data-pt-z="' + best + '"]'); if (n && n.focus) n.focus() }
    }
    function onOut(ev) { if (!ev.relatedTarget || !root.contains(ev.relatedTarget)) onLeave() }

    root.addEventListener('mouseover', onOver)
    root.addEventListener('mouseleave', onLeave)
    root.addEventListener('click', onClick)
    if (mode === 'canvas') root.addEventListener('dblclick', onDbl)
    if (mode === 'deck') {
      root.addEventListener('focusin', onFocus)
      root.addEventListener('focusout', onOut)
      root.addEventListener('keydown', onKey)
      root.addEventListener('mousedown', onDown)
      if (!escOn && win.addEventListener) {
        escOn = true
        // Esc lets go of a pin on the slide showing, before the deck sees it
        win.addEventListener('keydown', function (ev) {
          if (ev.key !== 'Escape') return
          for (var i = 0; i < live.length; i++) {
            if (live[i].pinned() && live[i].visible()) { ev.stopPropagation(); ev.preventDefault(); live[i].release(); return }
          }
        }, true)
      }
    }
    var api = {
      // Show diagram step n (0 is as it rests), dropping a pin from before
      setStep: function (n) {
        st.view = viewAt(s, n); st.pin = st.view.pin; st.hover = null; st.sub = null; st.key = null
        draw()
      },
      pinned: function () { return st.pin != null },
      // Changed by someone since its step was shown
      touched: function () { return st.pin !== st.view.pin || st.hover != null || st.sub != null || st.key != null },
      visible: visible,
      release: function () { st.pin = null; refresh() },
      destroy: function () {
        gone = true
        stopClouds()
        root.removeEventListener('mouseover', onOver)
        root.removeEventListener('mouseleave', onLeave)
        root.removeEventListener('click', onClick)
        root.removeEventListener('dblclick', onDbl)
        root.removeEventListener('focusin', onFocus)
        root.removeEventListener('focusout', onOut)
        root.removeEventListener('keydown', onKey)
        root.removeEventListener('mousedown', onDown)
        var i = live.indexOf(api)
        if (i >= 0) live.splice(i, 1)
      },
      state: function () { return { shown: shown(), pinned: st.pin, hover: st.hover, view: st.view, gone: gone } },
    }
    if (mode === 'deck') live.push(api)
    return api
  }

  return {
    EL: EL, CATEGORIES: CATEGORIES, STATES: STATES, PROPS: PROPS, TRENDS: TRENDS, COLOR_BY: COLOR_BY, VIEWS: VIEWS, SHOWS: SHOWS, TILE_LABELS: TILE_LABELS,
    zOf: zOf, parse: parse, fullSubs: fullSubs, shellCounts: shellCounts, unpaired: unpaired, pos: pos, blockOf: blockOf, groupOf: groupOf, periodOf: periodOf,
    parseHighlight: parseHighlight, cleanHighlight: cleanHighlight, highlighted: highlighted, normalize: normalize, viewAt: viewAt, layout: layout,
    samples: samples, cloudCells: cloudCells, render: render, attach: attach,
  }
}

// ---------- In the editor

export const PT = periodicRuntime(PERIODIC_ROWS)

// The element's own fields
export const PERIODIC_FIELDS = ['colorBy', 'orbitalView', 'showCore', 'group3', 'show', 'restingElement', 'card', 'tileLabel', 'labels', 'legend', 'source', 'theme', 'highlight', 'arrow', 'stepStart', 'steps']

// The drawing's shape: the element keeps this aspect
export function periodicBox(el) {
  const L = PT.layout(PT.normalize(el))
  return { w: L.vb.w, h: L.vb.h }
}

// changes to an element, with a new height when they change the table's
// shape, so it keeps its width and fills its box
export function periodicResize(el, changes) {
  const before = periodicBox(el), after = periodicBox({ ...el, ...changes })
  if (Math.abs(before.w / before.h - after.w / after.h) < 0.005 || !(el.width > 0)) return changes
  return { ...changes, height: Math.max(20, Math.round(el.width * after.h / after.w)) }
}

// The element as an <svg> filling its box. opts: step (as at that diagram
// step; default as it rests), mode ('static', 'deck', 'canvas'), standalone
export function periodicSvg(el, opts = {}) {
  const s = PT.normalize(el)
  const view = opts.step ? PT.viewAt(s, opts.step) : undefined
  return PT.render(s, { view, mode: opts.mode, standalone: opts.standalone })
}

// A new one: the whole table, in the slide's colors, showing iron
export function defaultPeriodic(dark = true) {
  return {
    colorBy: 'category', orbitalView: 'boxes', showCore: false, group3: 'gap', show: 'all', restingElement: 26, card: 'gap',
    tileLabel: 'auto', labels: true, legend: true, source: true, theme: dark ? 'dark' : 'light', highlight: '', arrow: '', stepStart: 1, steps: [],
  }
}

// ---------- Steps: the element's kth step is its diagram step k

export function periodicSteps(el) {
  if (el?.type !== 'periodic') return []
  const s = PT.normalize(el)
  return s.steps.map((_, i) => [s.stepStart + i, i + 1]).filter(([n]) => n <= 1000)
}
export function periodicStepAt(el, slideStep) {
  let at = 0
  for (const [n, s] of periodicSteps(el)) if (n <= slideStep) at = s
  return at
}
export function periodicStepMarkers(slide) {
  let html = ''
  for (const el of slide?.elements || []) {
    const id = String(el.id || '').replace(/[^A-Za-z0-9_-]/g, '')
    for (const [n, s] of periodicSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-pt-step="${id}" data-pt-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`
  }
  return html
}
export function hasPeriodic(presentation) {
  return (presentation?.slides || []).some(s => (s.elements || []).some(el => el.type === 'periodic'))
}

const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// The element in a deck: its table, and its settings for the deck's script
export function periodicDeckHtml(el) {
  const s = PT.normalize(el)
  const id = String(el.id || '').replace(/[^A-Za-z0-9_-]/g, '')
  return { id, attrs: ` data-pt="${id}" data-pt-config="${escAttr(JSON.stringify(s))}"`, svg: PT.render(s, { mode: 'deck' }) }
}

// In a deck with periodic tables: the runtime and the data, once, which
// makes each table respond and follows the slide's steps
let deckScript = null
export function periodicDeckScript() {
  if (!deckScript) deckScript = `
    (function() {
      var PT = (${periodicRuntime.toString()})(${JSON.stringify(PERIODIC_ROWS)});
      var items = [];
      document.querySelectorAll('[data-pt]').forEach(function(el) {
        // Not the overview's pictures of slides
        if (el.closest('[inert]')) return;
        var cfg;
        try { cfg = JSON.parse(el.getAttribute('data-pt-config')); } catch (e) { return; }
        items.push({ el: el, id: el.getAttribute('data-pt'), at: -1, api: PT.attach(el, cfg, { mode: 'deck', animate: true }) });
      });
      function stepOf(item) {
        var slide = item.el.closest('section'), n = 0;
        if (!slide) return 0;
        slide.querySelectorAll('.fragment[data-pt-step]').forEach(function(m) {
          if (m.getAttribute('data-pt-step') === item.id && m.classList.contains('visible')) n = Math.max(n, +m.getAttribute('data-pt-step-at') || 0);
        });
        return n;
      }
      function sync() {
        items.forEach(function(item) {
          var n = stepOf(item);
          if (n !== item.at) { item.api.setStep(n); item.at = n; }
        });
      }
      ['ready', 'fragmentshown', 'fragmenthidden'].forEach(function(name) { Reveal.on(name, sync); });
      // On another slide, what was pinned or pointed at is let go
      Reveal.on('slidechanged', function() {
        items.forEach(function(item) { if (item.api.touched()) item.at = -1; });
        sync();
      });
      sync();
    })();
`
  return deckScript
}

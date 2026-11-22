// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// What the plot import's readers share (pdfReader.js, svgReader.js): the
// drawing they make of a figure, and the pieces they both need to make it.
//
// A drawing is what a figure's file draws, in points with y going up, as
// a PDF has it:
//   { width, height, producer, pages,
//     paths: [{ segs: [[[x, y], …], …], closed, curves, stroke, fill, width, dash, group, ops, role }],
//     marks: [{ x, y, shape, size, fill, stroke, group, ops, role }],   (a marker stamped at a point)
//     texts: [{ s, x, y, size, angle, group, role }],
//     axes: [{ box, ticks: { x: [{ pos, label }], y: […] }, xLabel, yLabel, xOffset, yOffset }] (an SVG's; a PDF's are found from the rest)
//     images, notes }
// group names the plot element something came from, where the file says
// (an SVG's line2d_3); ops, the operators that draw it (a PDF's: [first,
// last] in pdf.js's list); role marks what isn't data (a tick, a spine, the
// legend, a label). plotModel.js reads a plot out of it.

export const IDENTITY = [1, 0, 0, 1, 0, 0]

// Matrices as PDF and SVG write them, [a, b, c, d, e, f]
export function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}
export const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

export function bboxOf(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of points) {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return { x0, y0, x1, y1 }
}

// A color as #rrggbb, or null for none
export function hexColor(c) {
  if (c == null) return null
  if (Array.isArray(c) || ArrayBuffer.isView(c)) {
    const v = Array.from(c).slice(0, 3).map(n => (n <= 1 && Array.from(c).every(k => k <= 1) ? n * 255 : n))
    return '#' + v.map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')
  }
  const s = String(c).trim().toLowerCase()
  if (!s || s === 'none' || s === 'transparent') return null
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + [...s.slice(1)].map(h => h + h).join('')
  const m = /^rgba?\(([^)]+)\)$/.exec(s)
  if (m) return hexColor(m[1].split(',').slice(0, 3).map(Number))
  if (s === 'black') return '#000000'
  if (s === 'white') return '#ffffff'
  return s
}

const nearPt = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6

// A marker's shape, from its outline around its center: what matplotlib's
// markers draw ('o', 's', '^', 'D', '+', 'x', '_', '|' …), and its size
// across, in points
export function markerShape(segs, curves = 0) {
  const pts = segs.flat()
  if (!pts.length) return { shape: 'other', size: 0 }
  const b = bboxOf(pts)
  const w = b.x1 - b.x0, h = b.y1 - b.y0, size = Math.max(w, h)
  if (curves > 0) return { shape: 'circle', size }
  const clean = segs.map(s => (s.length > 2 && nearPt(s[0], s[s.length - 1]) ? s.slice(0, -1) : s)).filter(s => s.length > 1)
  if (clean.length === 1) {
    const s = clean[0]
    if (s.length === 2) return { shape: w >= h ? 'hline' : 'vline', size }
    if (s.length === 3) return { shape: 'triangle', size }
    if (s.length === 4) {
      const onAxes = s.every(([x, y]) => Math.abs(x - (b.x0 + b.x1) / 2) < size * 0.05 || Math.abs(y - (b.y0 + b.y1) / 2) < size * 0.05)
      return { shape: onAxes ? 'diamond' : 'square', size }
    }
    return { shape: s.length === 5 ? 'pentagon' : s.length === 6 ? 'hexagon' : 'polygon', size }
  }
  if (clean.length === 2 && clean.every(s => s.length === 2)) {
    const upright = clean.every(s => Math.abs(s[0][0] - s[1][0]) < 1e-6 || Math.abs(s[0][1] - s[1][1]) < 1e-6)
    return { shape: upright ? 'plus' : 'x', size }
  }
  return { shape: 'other', size }
}

// matplotlib's mathtext without its \mathdefault{…} wrappers (which hold
// braces of their own, as in \mathdefault{10^{3}}), its $ signs and its
// minus signs
function unwrap(text) {
  let s = String(text).trim().replace(/−/g, '-').replace(/\$/g, '')
  for (let guard = 0; guard < 8; guard++) {
    const m = /\\math(?:default|regular|rm)\{/.exec(s)
    if (!m) break
    let depth = 1, j = m.index + m[0].length
    for (; j < s.length && depth; j++) { if (s[j] === '{') depth++; else if (s[j] === '}') depth-- }
    s = s.slice(0, m.index) + s.slice(m.index + m[0].length, j - 1) + s.slice(j)
  }
  return s.replace(/\\times|\\cdot/g, '×')
}

// A tick label's number: 0.5, −1.0, 2e+03, 10^{3} or 2×10^{3}, as matplotlib
// writes them (its mathtext in an SVG's comments: $\mathdefault{10^{3}}$).
// { value, power } where it's a power of ten, for a log axis; null for words
export function parseTickLabel(raw) {
  if (raw == null) return null
  // Thousands set apart (2,000 or 2 000) read as one number
  const s = unwrap(raw).replace(/(\d)[,\u2009\u202f\u00a0](?=\d{3}(?:\D|$))/g, '$1').replace(/[\s{}]/g, '').replace(/%$/, '')
  if (!s) return null
  let m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.exec(s)
  if (m) return { value: Number(s) }
  m = /^(?:([-+]?(?:\d+\.?\d*|\.\d+))×)?10\^([-+]?\d+)$/.exec(s)
  if (m) {
    const power = Number(m[2])
    return m[1] === undefined ? { value: 10 ** power, power } : { value: Number(m[1]) * 10 ** power }
  }
  return null
}

// The note matplotlib puts at an axis's end when its tick labels are scaled
// or shifted: 1e6, ×10^{6}, 1e−3, +1.5e3. { scale } or { shift }, or null
export function parseAxisOffset(raw) {
  if (raw == null) return null
  const s = unwrap(raw).replace(/[\s{}]/g, '')
  let m = /^1e([-+]?\d+)$/i.exec(s) || /^×10\^([-+]?\d+)$/.exec(s)
  if (m) return { scale: 10 ** Number(m[1]) }
  m = /^([-+])((?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)$/i.exec(s)
  if (m) return { shift: Number(m[1] + m[2]) }
  return null
}

// What matplotlib's fonts measure, for placing a tick from its label alone:
// a digit's width (in the SVG glyphs' units, 100 to the em) and how far
// below a y tick a label's baseline sits (in font sizes, va='center_baseline')
const FONT_METRICS = [
  [/liberation|arial|helvetica|arimo/i, { digit: 55.62, drop: 0.3623 }],
  [/dejavu|bitstream/i, { digit: 63.62, drop: 0.38 }],
]
export function fontMetrics(name) {
  for (const [re, m] of FONT_METRICS) if (re.test(name || '')) return m
  return { digit: 63.62, drop: 0.38 }
}

// A file name without its type, for the dataset's name
export const baseName = name => String(name || 'plot').replace(/\.[a-z0-9]+$/i, '').trim() || 'plot'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A plot read out of a figure's drawing (drawing.js): its axes, calibrated
// from their numbered ticks, and its layers, each with the data it draws.
//
//   { size: { width, height },
//     axes: { box, x: { scale, range, label, categories }, y: {…}, grid },
//     layers: [{ id, name, kind: 'points' | 'line' | 'bars', color, shape, size, width, style,
//                data: { x, y, xErr?, yErr?, x2? }, fidelity: 'exact' | 'as drawn', legend }],
//     warnings: [] }
//
// Markers, bars and error bars are where the file puts them, so their data
// is exact. A line has the points the file draws it through; matplotlib
// leaves out points that don't change the picture.

import { bboxOf, parseTickLabel, parseAxisOffset, markerShape } from './drawing'

export class PlotError extends Error {}

const EDGE = 0.75 // points: how near an edge counts as on it
const TICK_MAX = 12 // points: the longest a tick mark is

export function plotFromDrawing(drawing) {
  const warnings = [...(drawing.notes || [])]
  if (drawing.pages > 1) warnings.push(`This PDF has ${drawing.pages} pages; the first was read.`)
  if (drawing.producer && !/matplotlib/i.test(drawing.producer)) warnings.push(`This figure was made by ${drawing.producer.split(/[\s,]/)[0]}, not matplotlib, so check what was found.`)
  if (drawing.images) warnings.push('The figure has a picture in it (such as imshow’s), which has no data to read.')

  // matplotlib stamps a marker only where that's shorter than drawing each
  // one out: a lone marker (a legend's sample, a one-point series) comes as
  // a small path, filled and stroked. Those are markers too
  const inline = new Set()
  const allMarks = [...(drawing.marks || [])]
  for (const p of drawing.paths || []) {
    if (p.group || !p.fill || !p.stroke) continue
    const pts = p.segs.flat()
    if (!pts.length) continue
    const b = bboxOf(pts)
    const w = b.x1 - b.x0, h = b.y1 - b.y0, big = Math.max(w, h)
    if (big > 20 || big < 0.5) continue
    // Square-ish, or a line ('_', '|')
    if (p.curves === 0 && Math.min(w, h) > 0.01 && Math.abs(w - h) > 0.15 * big) continue
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2
    const { shape, size } = markerShape(p.segs.map(s => s.map(([x, y]) => [x - cx, y - cy])), p.curves)
    if (shape === 'other' || shape === 'polygon') continue
    allMarks.push({ x: cx, y: cy, shape, size, fill: p.fill, stroke: p.stroke, order: p.order, role: p.role })
    inline.add(p)
  }
  drawing = { ...drawing, marks: allMarks, paths: (drawing.paths || []).filter(p => !inline.has(p)), allPaths: drawing.paths }

  // The axes: the SVG's, or found from what's drawn
  let all = (drawing.axes || []).filter(a => a.box)
  if (!all.length) all = findAxes(drawing)
  if (!all.length) throw new PlotError('No axes were found in this figure.')
  const area = b => (b.x1 - b.x0) * (b.y1 - b.y0)
  all.sort((p, q) => area(q.box) - area(p.box))
  const axes = all[0]
  if (all.length > 1) warnings.push(`This figure has ${all.length} sets of axes; the largest was read.`)
  const box = axes.box
  const others = all.slice(1).map(a => a.box)
  const inside = (x, y, b = box, m = 0.5) => x >= b.x0 - m && x <= b.x1 + m && y >= b.y0 - m && y <= b.y1 + m
  const inOther = (x, y) => others.some(b => inside(x, y, b, 0) && !inside(x, y, box, -0.5))

  // Ticks and their labels
  const texts = mergeTexts(drawing.texts || [])
  const found = axes.ticks?.x?.length || axes.ticks?.y?.length ? null : ticksOf(drawing, box, texts)
  const xTicks = axes.ticks?.x?.length ? axes.ticks.x : found?.x || []
  const yTicks = axes.ticks?.y?.length ? axes.ticks.y : found?.y || []
  const offsets = axes.ticks?.x?.length ? { x: axes.xOffset, y: axes.yOffset } : offsetsOf(texts, box)
  const X = calibrate(xTicks, offsets.x, 'x', warnings)
  const Y = calibrate(yTicks, offsets.y, 'y', warnings)
  if (!X || !Y) throw new PlotError(`The ${!X ? 'x' : 'y'} axis doesn’t have two numbered ticks to read its scale from.`)
  X.range = [X.toData(box.x0), X.toData(box.x1)]
  Y.range = [Y.toData(box.y0), Y.toData(box.y1)]
  const labels = axes.ticks?.x?.length ? { x: axes.xLabel, y: axes.yLabel } : axisLabels(texts, box)

  // The legend: its frame, from the SVG's group or a filled box with words in it
  const legendBox = legendOf(drawing, box, texts)
  const inLegend = (x, y) => legendBox && inside(x, y, legendBox, 1)
  const isData = it => !it.role

  // What's drawn inside the axes
  const marks = (drawing.marks || []).filter(m => isData(m) && inside(m.x, m.y) && !inLegend(m.x, m.y) && !inOther(m.x, m.y))
  const lines = [], segments = [], rects = [], fills = []
  let grid = false
  for (const p of drawing.paths || []) {
    if (!isData(p)) {
      if ((p.role === 'tick-x' || p.role === 'tick-y') && spansBox(p, box)) grid = true
      continue
    }
    const pts = p.segs.flat()
    if (!pts.length) continue
    const b = bboxOf(pts)
    if (!inside(b.x0, b.y0) || !inside(b.x1, b.y1)) continue
    if (legendBox && inside(b.x0, b.y0, legendBox, 1) && inside(b.x1, b.y1, legendBox, 1)) continue
    if (sameBox(b, box)) continue
    if (isSpine(p, b, box) || isInnerTick(p, b, box)) continue
    if (p.stroke && p.segs.length === 1 && p.segs[0].length === 2 && spansBox(p, box)) { grid = true; continue }
    if (p.fill && (p.closed || isClosed(p)) && p.segs.length === 1 && rectOf(p.segs[0])) { rects.push({ ...rectOf(p.segs[0]), fill: p.fill, group: p.group, order: p.order ?? 0 }); continue }
    if (p.fill && !p.stroke) { fills.push(p); continue }
    if (!p.stroke) continue
    if (p.segs.every(s => s.length === 2 && (flat(s, 0) || flat(s, 1)))) { for (const s of p.segs) segments.push({ s, color: p.stroke, group: p.group }); continue }
    lines.push(p)
  }
  if (fills.length) warnings.push(`${fills.length === 1 ? 'A filled area' : `${fills.length} filled areas`} (fill_between, a shaded band) couldn’t be read as data.`)

  // Error bars: upright or level segments through markers of their color
  const ups = segments.filter(g => flat(g.s, 0)), levels = segments.filter(g => flat(g.s, 1) && !flat(g.s, 0))
  // Caps: level or upright tick markers at the bars' ends
  const ends = segments.flatMap(g => g.s)
  const isCap = m => (m.shape === 'hline' || m.shape === 'vline') && ends.some(([x, y]) => Math.abs(x - m.x) < 0.05 && Math.abs(y - m.y) < 0.05)
  const points = marks.filter(m => !isCap(m))

  // Layers: markers by the element they came from (an SVG says), or by look
  const layers = []
  const groups = new Map()
  for (const m of points) {
    const key = m.group || `${m.fill}|${m.stroke}|${m.shape}|${m.size.toFixed(1)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(m)
  }
  for (const ms of groups.values()) {
    const first = ms[0]
    const color = first.fill || first.stroke || '#000000'
    layers.push({
      kind: 'points', color, shape: first.shape, size: first.size, z: first.order ?? 0,
      px: ms.map(m => m.x), py: ms.map(m => m.y),
      data: { x: ms.map(m => X.toData(m.x)), y: ms.map(m => Y.toData(m.y)) },
      fidelity: 'exact',
    })
  }
  attachErrors(layers, ups, 'y', X, Y, warnings)
  attachErrors(layers, levels, 'x', X, Y, warnings)

  for (const p of lines) {
    const pts = p.segs.length === 1 ? p.segs[0] : p.segs.flatMap((s, i) => (i ? [[NaN, NaN], ...s] : s))
    layers.push({
      kind: 'line', color: p.stroke, width: p.width, style: dashStyle(p.dash, p.width), z: p.order ?? 0,
      data: { x: pts.map(([x]) => (isFinite(x) ? X.toData(x) : NaN)), y: pts.map(([, y]) => (isFinite(y) ? Y.toData(y) : NaN)) },
      fidelity: 'as drawn',
    })
  }

  // Bars: rectangles standing on the axis, by color
  if (rects.length) {
    const byFill = new Map()
    for (const r of rects) { if (!byFill.has(r.fill)) byFill.set(r.fill, []); byFill.get(r.fill).push(r) }
    let shifted = false
    for (const [fill, rs] of byFill) {
      const data = { x: [], x2: [], y: [] }
      for (const r of rs) {
        const left = X.toData(r.x0), right = X.toData(r.x1)
        const lo = Y.toData(r.y0), hi = Y.toData(r.y1)
        const zero = v => Math.abs(v) <= 1e-9 * (Math.abs(Y.range[1] - Y.range[0]) || 1)
        let value
        if (Y.scale === 'log') value = hi
        else if (zero(lo)) value = hi
        else if (zero(hi)) value = lo
        else { value = hi; shifted = true }
        data.x.push(left); data.x2.push(right); data.y.push(value)
      }
      layers.push({ kind: 'bars', color: fill, z: rs[0].order, data, fidelity: 'exact' })
    }
    if (shifted) warnings.push('Some bars don’t start at zero (stacked bars?); they stand on zero here.')
  }

  if (!layers.length) throw new PlotError('No points, lines or bars were found inside the axes.')
  layers.sort((p, q) => p.z - q.z)

  // Names from the legend, matched by kind, color and marker
  const entries = legendEntries(drawing, legendBox, texts)
  const taken = new Set()
  for (const layer of layers) {
    const i = entries.findIndex((e, k) => !taken.has(k) && e.kind === layer.kind && e.color === layer.color && (layer.kind !== 'points' || !e.shape || e.shape === layer.shape))
    if (i >= 0) { taken.add(i); layer.name = entries[i].label; layer.legend = i }
  }
  const counts = {}
  const noun = { points: 'Points', line: 'Line', bars: 'Bars' }
  layers.forEach((l, i) => {
    l.id = `l${i + 1}`
    counts[l.kind] = (counts[l.kind] || 0) + 1
    if (!l.name) l.name = `${noun[l.kind]} ${counts[l.kind]}`
    delete l.z; delete l.px; delete l.py
  })

  return {
    size: { width: drawing.width, height: drawing.height },
    producer: drawing.producer || '',
    axes: {
      box,
      x: { scale: X.scale, range: X.range, label: clean(labels.x), categories: X.categories || null },
      y: { scale: Y.scale, range: Y.range, label: clean(labels.y), categories: Y.categories || null },
      grid,
    },
    layers,
    warnings,
  }
}

const clean = s => String(s || '').replace(/\$/g, '').replace(/\\mathdefault\{([^{}]*)\}/g, '$1').trim()

// ── Axes, in a drawing that doesn't name them (a PDF) ──

function findAxes(d) {
  const page = d.width * d.height
  const boxes = []
  for (const p of d.paths || []) {
    if (!p.fill || p.segs.length !== 1) continue
    const r = rectOf(p.segs[0])
    if (!r) continue
    const a = (r.x1 - r.x0) * (r.y1 - r.y0)
    // Not the page's own background, and big enough to be a plot
    if (a > page * 0.98 || a < page * 0.04) continue
    if (boxes.some(b => sameBox(b, r))) continue
    boxes.push(r)
  }
  // Keep the boxes that have ticks on them: a bar or a legend has none
  const withTicks = boxes.filter(b => {
    const t = ticksOf(d, b, mergeTexts(d.texts || []))
    return t.x.length >= 2 && t.y.length >= 2
  })
  if (withTicks.length) return withTicks.map(box => ({ box }))
  // No background: the spines' box
  const spines = (d.paths || []).filter(p => p.stroke && p.segs.length === 1 && p.segs[0].length === 2 && (flat(p.segs[0], 0) || flat(p.segs[0], 1)))
    .filter(p => { const b = bboxOf(p.segs[0]); return Math.max(b.x1 - b.x0, b.y1 - b.y0) > Math.min(d.width, d.height) * 0.3 })
  if (spines.length >= 2) {
    const b = bboxOf(spines.flatMap(p => p.segs[0]))
    if (b.x1 - b.x0 > 20 && b.y1 - b.y0 > 20) return [{ box: b }]
  }
  return []
}

// Tick marks on the box's bottom and left edges (short strokes, or tick
// markers), each with the label beside it
function ticksOf(d, box, texts) {
  const xs = [], ys = []
  for (const p of d.paths || []) {
    if (!p.stroke || p.segs.length !== 1 || p.segs[0].length !== 2) continue
    const [[ax, ay], [bx, by]] = p.segs[0]
    const len = Math.hypot(bx - ax, by - ay)
    if (len > TICK_MAX || len < 0.5) continue
    if (Math.abs(ax - bx) < 0.01 && (Math.abs(ay - box.y0) < EDGE || Math.abs(by - box.y0) < EDGE) && ax >= box.x0 - EDGE && ax <= box.x1 + EDGE) xs.push({ pos: ax, len })
    else if (Math.abs(ay - by) < 0.01 && (Math.abs(ax - box.x0) < EDGE || Math.abs(bx - box.x0) < EDGE) && ay >= box.y0 - EDGE && ay <= box.y1 + EDGE) ys.push({ pos: ay, len })
  }
  for (const m of d.marks || []) {
    if (m.shape === 'vline' && Math.abs(m.y - box.y0) < m.size && m.x >= box.x0 - EDGE && m.x <= box.x1 + EDGE) xs.push({ pos: m.x, len: m.size })
    if (m.shape === 'hline' && Math.abs(m.x - box.x0) < m.size && m.y >= box.y0 - EDGE && m.y <= box.y1 + EDGE) ys.push({ pos: m.y, len: m.size })
  }
  const labeled = (ticks, axis) => {
    const used = new Set()
    const out = []
    // Longest first: major ticks carry the labels
    const longest = Math.max(0, ...ticks.map(t => t.len))
    for (const t of ticks.filter(t => t.len >= longest * 0.75).sort((p, q) => p.pos - q.pos)) {
      let best = null, bestD = Infinity
      texts.forEach((tx, i) => {
        if (used.has(i) || tx.angle) return
        const cx = tx.x + tx.w / 2, cy = tx.y + tx.size * 0.35
        const dist = axis === 'x'
          ? (tx.y + tx.size < box.y0 + 1 && box.y0 - tx.y < 40 ? Math.abs(cx - t.pos) : Infinity)
          : (tx.x + tx.w < box.x0 + 1 && box.x0 - (tx.x + tx.w) < 30 ? Math.abs(cy - t.pos) : Infinity)
        if (dist < bestD) { bestD = dist; best = i }
      })
      if (best !== null && bestD < (axis === 'x' ? 10 : 6)) { used.add(best); out.push({ pos: t.pos, label: texts[best].s }) }
      else out.push({ pos: t.pos, label: null })
    }
    return out
  }
  return { x: labeled(xs, 'x'), y: labeled(ys, 'y') }
}

// pdf.js gives 10³ as "10" and a raised "3": one label, 10^{3}
function mergeTexts(texts) {
  const used = new Set()
  const out = []
  texts.forEach((t, i) => {
    if (used.has(i)) return
    if (/^×?10$/.test(t.s)) {
      const j = texts.findIndex((u, k) => k !== i && !used.has(k) && u.x >= t.x + t.w * 0.5 && u.x <= t.x + t.w + 8
        && u.y > t.y + 1 && u.y < t.y + t.size && /^[-−]?\d+$/.test(u.s))
      if (j >= 0) {
        used.add(j)
        const u = texts[j]
        out.push({ ...t, s: `${t.s}^{${u.s}}`, w: u.x + u.w - t.x })
        return
      }
    }
    out.push(t)
  })
  return out
}

// The scale note at an axis's end (1e6, ×10^{6}), from a PDF's words
function offsetsOf(texts, box) {
  const out = { x: null, y: null }
  for (const t of texts) {
    if (!parseAxisOffset(t.s)) continue
    if (t.x > box.x1 - 60 && t.y < box.y0) out.x = t.s
    else if (t.y > box.y1 - 2 && t.x < box.x0 + 60) out.y = t.s
  }
  return out
}

// A PDF's axis labels: the words under the x axis's numbers, and the
// upright words left of the y axis's
function axisLabels(texts, box) {
  const words = texts.filter(t => !parseTickLabel(t.s) && !parseAxisOffset(t.s))
  const x = words.filter(t => !t.angle && t.y < box.y0 - 2 && t.x + t.w / 2 > box.x0 && t.x + t.w / 2 < box.x1).sort((p, q) => q.y - p.y)[0]
  const y = words.filter(t => Math.abs(Math.abs(t.angle) - 90) < 2 && t.x < box.x0).sort((p, q) => q.x - p.x)[0]
  return { x: x ? x.s : '', y: y ? y.s : '' }
}

// An axis's scale from its labeled ticks: linear or log, whichever puts the
// ticks where they are; words for labels number the ticks 0, 1, 2…
function calibrate(ticks, offsetText, axis, warnings) {
  let pairs = ticks.filter(t => t.pos != null && t.label != null).map(t => ({ pos: t.pos, label: t.label, ...(parseTickLabel(t.label) || {}) }))
    .sort((p, q) => p.pos - q.pos)
  const numbered = pairs.filter(p => p.value !== undefined && isFinite(p.value))
  let categories = null
  if (numbered.length < 2) {
    const named = pairs.filter(p => String(p.label).trim())
    if (named.length < 2) return null
    categories = named.map(p => String(p.label).replace(/\$/g, '').trim())
    pairs = named.map((p, i) => ({ pos: p.pos, value: i }))
    warnings.push(`The ${axis} axis is labeled with words (${categories.slice(0, 3).join(', ')}${categories.length > 3 ? '…' : ''}), so the graph numbers them from 0.`)
  } else pairs = numbered

  if (!categories) {
    // Type 3 text loses minus signs: labels rise along an axis, so those
    // before a 0 are negative, and labels that fall are all negative
    const powers = pairs.every(p => p.power !== undefined)
    const key = powers ? 'power' : 'value'
    const rising = pairs.every((p, i) => i === 0 || p[key] > pairs[i - 1][key])
    if (!rising) {
      const zero = pairs.findIndex(p => p[key] === 0)
      let fixed = false
      if (zero > 0 && pairs.slice(0, zero).every(p => p[key] > 0)) { pairs.slice(0, zero).forEach(p => { p[key] = -p[key] }); fixed = true }
      else if (pairs.every((p, i) => (i === 0 || p[key] < pairs[i - 1][key]) && p[key] > 0)) { pairs.forEach(p => { p[key] = -p[key] }); fixed = true }
      if (fixed && powers) pairs.forEach(p => { p.value = 10 ** p.power })
    }
    const off = parseAxisOffset(offsetText)
    if (off) pairs.forEach(p => { p.value = off.scale ? p.value * off.scale : p.value + off.shift })
  }

  const fit = f => {
    const n = pairs.length
    let sx = 0, sy = 0, sxx = 0, sxy = 0
    for (const p of pairs) { const u = f(p.value); sx += u; sy += p.pos; sxx += u * u; sxy += u * p.pos }
    const den = n * sxx - sx * sx
    if (!(Math.abs(den) > 0)) return null
    const b = (n * sxy - sx * sy) / den, a = (sy - b * sx) / n
    const resid = Math.max(...pairs.map(p => Math.abs(a + b * f(p.value) - p.pos)))
    return { a, b, resid }
  }
  const lin = fit(v => v)
  const canLog = !categories && pairs.every(p => p.value > 0)
  const log = canLog ? fit(v => Math.log10(v)) : null
  const useLog = log && (!lin || log.resid < lin.resid * 0.5 || pairs.every(p => p.power !== undefined))
  const F = useLog ? log : lin
  if (!F || !isFinite(F.b) || F.b === 0) return null
  if (F.resid > 0.5) warnings.push(`The ${axis} axis’s numbered ticks don’t line up evenly (off by up to ${F.resid.toFixed(1)} pt); check its numbers.`)
  const toData = pos => { const u = (pos - F.a) / F.b; return useLog ? 10 ** u : u }
  return { scale: useLog ? 'log' : 'linear', toData, categories, range: null, fit: F }
}

// ── The legend ──

function legendOf(d, box, texts) {
  const own = (d.paths || []).filter(p => p.role === 'legend')
  if (own.length) {
    const frame = own.find(p => p.fill && p.segs.length === 1 && p.segs[0].length >= 4)
    return frame ? bboxOf(frame.segs[0]) : bboxOf(own.flatMap(p => p.segs.flat()))
  }
  // A filled frame inside the axes with words in it
  const words = texts.filter(t => !parseTickLabel(t.s))
  for (const p of d.paths || []) {
    if (p.role || !p.fill || p.segs.length !== 1 || p.segs[0].length < 4) continue
    const b = bboxOf(p.segs[0])
    if (sameBox(b, box) || b.x0 < box.x0 - 1 || b.x1 > box.x1 + 1 || b.y0 < box.y0 - 1 || b.y1 > box.y1 + 1) continue
    if (words.some(t => t.x >= b.x0 && t.x <= b.x1 && t.y >= b.y0 && t.y <= b.y1)) return b
  }
  return null
}

// Each legend entry's words, and the kind and color of the sample beside them
function legendEntries(d, lb, texts) {
  if (!lb) return []
  const within = (x, y) => x >= lb.x0 - 1 && x <= lb.x1 + 1 && y >= lb.y0 - 1 && y <= lb.y1 + 1
  const words = texts.filter(t => within(t.x, t.y) && !parseTickLabel(t.s)).sort((p, q) => q.y - p.y)
  return words.map(t => {
    const mid = t.y + t.size * 0.35
    const row = (y) => Math.abs(y - mid) < t.size * 0.6
    const left = x => x < t.x
    const mark = (d.marks || []).find(m => within(m.x, m.y) && row(m.y) && left(m.x) && m.shape !== 'hline' && m.shape !== 'vline')
    if (mark) return { label: t.s.replace(/\$/g, ''), kind: 'points', color: mark.fill || mark.stroke, shape: mark.shape }
    const path = (d.paths || []).find(p => { const b = bboxOf(p.segs.flat()); return within(b.x0, b.y0) && within(b.x1, b.y1) && row((b.y0 + b.y1) / 2) && left(b.x1) && (b.x1 - b.x0) > 3 })
    if (!path) return { label: t.s, kind: null }
    const r = path.fill && path.segs.length === 1 && rectOf(path.segs[0])
    return r && !path.stroke ? { label: t.s.replace(/\$/g, ''), kind: 'bars', color: path.fill } : { label: t.s.replace(/\$/g, ''), kind: 'line', color: path.stroke }
  })
}

// ── Error bars ──

function attachErrors(layers, segs, axis, X, Y, warnings) {
  if (!segs.length) return
  const left = []
  let lopsided = false
  for (const g of segs) {
    const [[ax, ay], [bx, by]] = g.s
    let hit = null
    for (const layer of layers) {
      if (layer.kind !== 'points' || layer.color !== g.color) continue
      for (let i = 0; i < layer.px.length; i++) {
        const px = layer.px[i], py = layer.py[i]
        const ok = axis === 'y'
          ? Math.abs(px - ax) < 0.05 && py >= Math.min(ay, by) - 0.05 && py <= Math.max(ay, by) + 0.05
          : Math.abs(py - ay) < 0.05 && px >= Math.min(ax, bx) - 0.05 && px <= Math.max(ax, bx) + 0.05
        if (ok) { hit = { layer, i }; break }
      }
      if (hit) break
    }
    if (!hit) { left.push(g); continue }
    const { layer, i } = hit
    const A = axis === 'y' ? Y : X
    const lo = A.toData(axis === 'y' ? Math.min(ay, by) : Math.min(ax, bx))
    const hi = A.toData(axis === 'y' ? Math.max(ay, by) : Math.max(ax, bx))
    const v = layer.data[axis][i]
    const key = axis === 'y' ? 'yErr' : 'xErr'
    if (!layer.data[key]) layer.data[key] = layer.data.x.map(() => null)
    layer.data[key][i] = (hi - lo) / 2
    if (Math.abs((hi - v) - (v - lo)) > 1e-6 * Math.max(Math.abs(hi - lo), 1e-12)) lopsided = true
  }
  if (lopsided) warnings.push(`Some ${axis} error bars reach further one way than the other; they’re shown the same both ways.`)
  if (left.length) warnings.push(`${left.length} ${axis === 'y' ? 'upright' : 'level'} line${left.length === 1 ? '' : 's'} (error bars without markers?) weren’t read.`)
}

// ── Shapes ──

const flat = (s, k) => Math.abs(s[0][k] - s[1][k]) < 0.01
const isClosed = p => p.segs.length === 1 && p.segs[0].length > 2 && Math.abs(p.segs[0][0][0] - p.segs[0].at(-1)[0]) < 0.01 && Math.abs(p.segs[0][0][1] - p.segs[0].at(-1)[1]) < 0.01
const sameBox = (a, b) => Math.abs(a.x0 - b.x0) < EDGE && Math.abs(a.x1 - b.x1) < EDGE && Math.abs(a.y0 - b.y0) < EDGE && Math.abs(a.y1 - b.y1) < EDGE

// An axis-aligned rectangle's box, or null
function rectOf(pts) {
  let p = pts
  if (p.length === 5 && Math.abs(p[0][0] - p[4][0]) < 0.01 && Math.abs(p[0][1] - p[4][1]) < 0.01) p = p.slice(0, 4)
  if (p.length !== 4) return null
  for (let i = 0; i < 4; i++) {
    const a = p[i], b = p[(i + 1) % 4]
    if (!(Math.abs(a[0] - b[0]) < 0.01 || Math.abs(a[1] - b[1]) < 0.01)) return null
  }
  return bboxOf(p)
}

// A spine: a line along one of the box's edges
function isSpine(p, b, box) {
  if (!p.stroke || p.segs.length !== 1 || p.segs[0].length !== 2) return false
  const upright = b.x1 - b.x0 < 0.01, level = b.y1 - b.y0 < 0.01
  if (upright && (Math.abs(b.x0 - box.x0) < EDGE || Math.abs(b.x0 - box.x1) < EDGE)) return b.y1 - b.y0 > (box.y1 - box.y0) * 0.5
  if (level && (Math.abs(b.y0 - box.y0) < EDGE || Math.abs(b.y0 - box.y1) < EDGE)) return b.x1 - b.x0 > (box.x1 - box.x0) * 0.5
  return false
}

// A tick drawn inward, or on the top and right edges
function isInnerTick(p, b, box) {
  if (!p.stroke || p.segs.length !== 1 || p.segs[0].length !== 2) return false
  const len = Math.max(b.x1 - b.x0, b.y1 - b.y0)
  if (len > TICK_MAX) return false
  const onEdge = Math.abs(b.y0 - box.y0) < EDGE || Math.abs(b.y1 - box.y1) < EDGE || Math.abs(b.x0 - box.x0) < EDGE || Math.abs(b.x1 - box.x1) < EDGE
  return onEdge
}

// A line right across the box: a grid line, or a reference line
function spansBox(p, box) {
  if (p.segs.length !== 1 || p.segs[0].length !== 2) return false
  const b = bboxOf(p.segs[0])
  if (b.y1 - b.y0 < 0.01) return b.x1 - b.x0 >= (box.x1 - box.x0) * 0.98
  if (b.x1 - b.x0 < 0.01) return b.y1 - b.y0 >= (box.y1 - box.y0) * 0.98
  return false
}

function dashStyle(dash, width) {
  if (!dash || !dash.length || dash.every(v => !v)) return 'solid'
  return dash[0] <= Math.max(1.5, width * 1.5) ? 'dotted' : 'dashed'
}

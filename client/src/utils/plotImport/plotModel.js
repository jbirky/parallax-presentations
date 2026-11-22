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
//
// An axis is calibrated from its numbered ticks: the tick marks (on any
// side, on the box or on a spine moved out from it), or grid lines where a
// style draws no ticks, or, with neither, the numbers' own places, which
// matplotlib centers on their ticks.

import { bboxOf, parseTickLabel, parseAxisOffset, markerShape, fontMetrics } from './drawing'

export class PlotError extends Error {}

const EDGE = 0.75 // points: how near an edge counts as on it
const TICK_MAX = 12 // points: the longest a tick mark is
const LABEL_GAP = 45 // points: the furthest a tick label sits from its axis

export function plotFromDrawing(drawing) {
  const warnings = [...(drawing.notes || [])]
  if (drawing.pages > 1) warnings.push(`This PDF has ${drawing.pages} pages; the first was read.`)
  if (drawing.producer && !/matplotlib/i.test(drawing.producer)) warnings.push(`This figure was made by ${drawing.producer.split(/[\s,]/)[0]}, not matplotlib, so check what was found.`)
  if (drawing.images) warnings.push('The figure has a picture in it (such as imshow’s), which has no data to read.')
  drawing = withInlineMarks(drawing)

  // The axes: the SVG's, or found from what's drawn; the largest (the first
  // drawn, of ones the same size)
  let all = (drawing.axes || []).filter(a => a.box)
  if (!all.length) all = findAxes(drawing)
  if (!all.length) throw new PlotError('No axes were found in this figure.')
  const area = b => (b.x1 - b.x0) * (b.y1 - b.y0)
  all.sort((p, q) => { const d = area(q.box) - area(p.box); return Math.abs(d) > 0.02 * area(p.box) ? d : 0 })
  const axes = all[0]
  if (all.length > 1) warnings.push(`This figure has ${all.length} sets of axes; the ${area(all[0].box) > area(all[1].box) * 1.02 ? 'largest' : 'first'} was read.`)
  const box = axes.box
  // An SVG says which axes drew what: a twin's layers (twinx) are its own
  const mine = it => !it.axes || !axes.id || it.axes === axes.id
  const inBox = it => { const [x, y] = centerOf(it); return x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1 }
  const twinDrawn = axes.id && [...(drawing.paths || []), ...(drawing.marks || [])].some(it => !it.role && it.axes && it.axes !== axes.id && inBox(it))
  if (all.slice(1).some(a => sameBox(a.box, box)) || twinDrawn) warnings.push('A second set of axes shares this plot’s box (twinx or twiny); its layers were left out.')
  const others = all.slice(1).filter(a => !sameBox(a.box, box)).map(a => a.box)
  const inside = (x, y, b = box, m = 0.5) => x >= b.x0 - m && x <= b.x1 + m && y >= b.y0 - m && y <= b.y1 + m
  const inOther = (x, y) => others.some(b => inside(x, y, b, 0) && !inside(x, y, box, -0.5))

  // Ticks and their labels
  const texts = mergeTexts(drawing.texts || [])
  const own = axes.ticks && (axes.ticks.x.length || axes.ticks.y.length)
  const found = own ? null : ticksOf(drawing, box, texts)
  if (found?.twin) warnings.push(`This plot has a second ${found.twin.split('').join(' and ')} axis on its other side; everything was read against the ${found.twin === 'x' ? 'bottom' : found.twin === 'y' ? 'left' : 'bottom and left'} one.`)
  const xTicks = own ? axes.ticks.x : found.x
  const yTicks = own ? axes.ticks.y : found.y
  const offsets = own ? { x: axes.xOffset, y: axes.yOffset } : offsetsOf(texts, box)
  const X = calibrate(xTicks, offsets.x, 'x', warnings)
  const Y = calibrate(yTicks, offsets.y, 'y', warnings)
  if (!X || !Y) {
    const which = !X ? 'x' : 'y'
    const ticks = !X ? xTicks : yTicks
    const words = ticks.filter(t => t.label != null).map(t => t.label)
    throw new PlotError(`The ${which} axis doesn’t have two numbered ticks to read its scale from${words.length ? ` (its labels read as: ${words.slice(0, 4).join(', ')})` : ' (no tick labels were found beside it)'}.`)
  }
  X.range = [X.toData(box.x0), X.toData(box.x1)]
  Y.range = [Y.toData(box.y0), Y.toData(box.y1)]
  const used = new Set([...(found?.used || [])])
  const labels = own ? { x: axes.xLabel, y: axes.yLabel } : axisLabels(texts.filter(t => !used.has(t)), box)

  // The legend: its frame (or, without one, its entries), and when it was drawn
  const legend = legendOf(drawing, box, texts)
  // Part of the legend: inside it and drawn with it. Data under the legend
  // was drawn before it
  const ofLegend = it => legend && it.order >= legend.order && inside(...centerOf(it), legend.box, 1)
  const isData = it => !it.role && mine(it)

  // What's drawn inside the axes
  const marks = (drawing.marks || []).filter(m => isData(m) && inside(m.x, m.y) && !ofLegend(m) && !inOther(m.x, m.y) && !isTickMark(m, box))
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
    if (ofLegend(p)) continue
    if (sameBox(b, box)) continue
    if (isSpine(p, b, box) || isInnerTick(p, b, box)) continue
    if (p.stroke && p.segs.length === 1 && p.segs[0].length === 2 && spansBox(p, box)) { grid = true; continue }
    if (p.fill && (p.closed || isClosed(p)) && p.segs.length === 1 && rectOf(p.segs[0])) { rects.push({ ...rectOf(p.segs[0]), fill: p.fill, group: p.group, ops: p.ops, order: p.order ?? 0 }); continue }
    if (p.fill && !p.stroke) { fills.push(p); continue }
    if (!p.stroke) continue
    if (p.segs.every(s => s.length === 2 && (flat(s, 0) || flat(s, 1)))) { for (const s of p.segs) segments.push({ s, color: p.stroke, group: p.group, ops: p.ops }); continue }
    lines.push(p)
  }
  if (fills.length) warnings.push(`${fills.length === 1 ? 'A filled area' : `${fills.length} filled areas`} (fill_between, a shaded band) couldn’t be read as data.`)

  // Error bars: upright or level segments through markers of their color
  const ups = segments.filter(g => flat(g.s, 0)), levels = segments.filter(g => flat(g.s, 1) && !flat(g.s, 0))
  // Caps: level or upright tick markers at the bars' ends
  const ends = segments.flatMap(g => g.s)
  const isCap = m => (m.shape === 'hline' || m.shape === 'vline') && ends.some(([x, y]) => Math.abs(x - m.x) < 0.05 && Math.abs(y - m.y) < 0.05)
  const points = marks.filter(m => !isCap(m))
  const caps = marks.filter(isCap)

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
      groups: new Set(ms.map(m => m.group).filter(Boolean)),
      ops: ms.map(m => m.ops).filter(Boolean),
      px: ms.map(m => m.x), py: ms.map(m => m.y),
      data: { x: ms.map(m => X.toData(m.x)), y: ms.map(m => Y.toData(m.y)) },
      fidelity: 'exact',
    })
  }
  attachErrors(layers, ups, 'y', X, Y, warnings)
  attachErrors(layers, levels, 'x', X, Y, warnings)
  // An error bar's caps go with its points
  for (const c of caps) {
    const layer = (c.group || c.ops) && layers.find(l => l.kind === 'points' && l.color === (c.fill || c.stroke))
    if (layer && c.group) layer.groups.add(c.group)
    if (layer && c.ops) layer.ops.push(c.ops)
  }

  for (const p of lines) {
    const pts = p.segs.length === 1 ? p.segs[0] : p.segs.flatMap((s, i) => (i ? [[NaN, NaN], ...s] : s))
    layers.push({
      kind: 'line', color: p.stroke, width: p.width, style: dashStyle(p.dash, p.width), z: p.order ?? 0,
      groups: new Set(p.group ? [p.group] : []),
      ops: p.ops ? [p.ops] : [],
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
      layers.push({ kind: 'bars', color: fill, z: rs[0].order, data, fidelity: 'exact', groups: new Set(rs.map(r => r.group).filter(Boolean)), ops: rs.map(r => r.ops).filter(Boolean) })
    }
    if (shifted) warnings.push('Some bars don’t start at zero (stacked bars?); they stand on zero here.')
  }

  if (!layers.length) throw new PlotError('No points, lines or bars were found inside the axes.')
  layers.sort((p, q) => p.z - q.z)

  // Names from the legend, matched by kind, color and marker
  const entries = legendEntries(drawing, legend, texts)
  const taken = new Set()
  for (const layer of layers) {
    const i = entries.findIndex((e, k) => !taken.has(k) && e.kind === layer.kind && e.color === layer.color && (layer.kind !== 'points' || !e.shape || e.shape === layer.shape))
    if (i >= 0) { taken.add(i); layer.name = entries[i].label; layer.legend = i }
  }
  // Each entry's drawing to its layer, to come and go with it; the frame and
  // the rest to the legend's own part
  const legendPart = legend ? legendDrawing(drawing, legend, entries, layers) : null
  const counts = {}
  const noun = { points: 'Points', line: 'Line', bars: 'Bars' }
  layers.forEach((l, i) => {
    l.id = `l${i + 1}`
    counts[l.kind] = (counts[l.kind] || 0) + 1
    if (!l.name) l.name = `${noun[l.kind]} ${counts[l.kind]}`
    // What draws it, for keeping the figure as it is: an SVG's groups
    // (splitSvg.js), a PDF's operators (splitPdf.js)
    l.groups = [...(l.groups || [])]
    l.ops = l.ops || []
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
    // What draws the legend but no layer's entry (its frame, its title), for
    // keeping the figure as it is; null without a legend
    legend: legendPart && (legendPart.groups.size || legendPart.ops.length) ? { groups: [...legendPart.groups], ops: legendPart.ops } : null,
    warnings,
  }
}

const clean = s => String(s || '').replace(/\$/g, '').replace(/\\mathdefault\{([^{}]*)\}/g, '$1').trim()
const centerOf = it => (it.segs ? (b => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2])(bboxOf(it.segs.flat())) : [it.x, it.y])

// matplotlib stamps a marker only where that's shorter than drawing each
// one out: a lone marker (a legend's sample, a one-point series, a few tick
// marks) comes as a small path, filled and stroked. Those are markers too
function withInlineMarks(drawing) {
  const inline = new Set()
  const marks = [...(drawing.marks || [])]
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
    marks.push({ x: cx, y: cy, shape, size, fill: p.fill, stroke: p.stroke, order: p.order, ops: p.ops, role: p.role, line: shape === 'hline' || shape === 'vline' ? p.segs[0] : null })
    inline.add(p)
  }
  return { ...drawing, marks, paths: (drawing.paths || []).filter(p => !inline.has(p)) }
}

// A tick mark drawn as a marker, on the box's edge
function isTickMark(m, box) {
  if (m.shape === 'vline') return Math.abs(m.y - box.y0) <= m.size / 2 + EDGE || Math.abs(m.y - box.y1) <= m.size / 2 + EDGE
  if (m.shape === 'hline') return Math.abs(m.x - box.x0) <= m.size / 2 + EDGE || Math.abs(m.x - box.x1) <= m.size / 2 + EDGE
  return false
}

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
  // Keep the boxes numbered along two sides: a bar or a legend isn't
  const texts = mergeTexts(d.texts || [])
  const numbered = boxes.filter(b => {
    const t = ticksOf(d, b, texts)
    return t.x.filter(k => parseTickLabel(k.label)).length >= 2 && t.y.filter(k => parseTickLabel(k.label)).length >= 2
  })
  if (numbered.length) return numbered.map(box => ({ box }))
  // No background: the spines' box
  const spines = (d.paths || []).filter(p => p.stroke && p.segs.length === 1 && p.segs[0].length === 2 && (flat(p.segs[0], 0) || flat(p.segs[0], 1)))
    .filter(p => { const b = bboxOf(p.segs[0]); return Math.max(b.x1 - b.x0, b.y1 - b.y0) > Math.min(d.width, d.height) * 0.3 })
  if (spines.length >= 2) {
    const b = bboxOf(spines.flatMap(p => p.segs[0]))
    if (b.x1 - b.x0 > 20 && b.y1 - b.y0 > 20) return [{ box: b }]
  }
  // A background with words beside it that aren't numbers (categories)
  return boxes.length ? [{ box: boxes.sort((p, q) => (q.x1 - q.x0) * (q.y1 - q.y0) - (p.x1 - p.x0) * (p.y1 - p.y0))[0] }] : []
}

// Each axis's labeled ticks: [{ pos, label, approx }]. The labels are the
// row of words under (or over) the box and the column beside it nearest the
// box; each goes to the nearest tick mark or grid line, or, with none near,
// stands where its tick would be (approx). used: the words taken as labels
function ticksOf(d, box, texts) {
  // Where ticks are: short strokes (or tick markers) along an edge, in a row
  // that shares an end on the edge or on a spine moved out from it, and
  // grid lines across the box
  const strokes = []
  for (const p of d.paths || []) {
    if (!p.stroke || p.segs.length !== 1 || p.segs[0].length !== 2) continue
    strokes.push(p.segs[0])
  }
  for (const m of d.marks || []) if (m.line) strokes.push(m.line)
    else if (m.shape === 'vline') strokes.push([[m.x, m.y - m.size / 2], [m.x, m.y + m.size / 2]])
    else if (m.shape === 'hline') strokes.push([[m.x - m.size / 2, m.y], [m.x + m.size / 2, m.y]])
  const places = { x: [], y: [] }
  const rows = { x: new Map(), y: new Map() }
  for (const s of strokes) {
    const [[ax, ay], [bx, by]] = s
    const len = Math.hypot(bx - ax, by - ay)
    const upright = Math.abs(ax - bx) < 0.01, level = Math.abs(ay - by) < 0.01
    if (upright && ax >= box.x0 - 1 && ax <= box.x1 + 1) {
      if (Math.min(ay, by) <= box.y0 + 1 && Math.max(ay, by) >= box.y1 - 1) { places.x.push(ax); continue } // a grid line
      if (len > TICK_MAX) continue
      // Grouped by the end nearer the box's edge: at or below the bottom, at or above the top
      for (const y of [ay, by]) if (y <= box.y0 + EDGE || y >= box.y1 - EDGE) { const k = y.toFixed(1); if (!rows.x.has(k)) rows.x.set(k, []); rows.x.get(k).push(ax) }
    } else if (level && ay >= box.y0 - 1 && ay <= box.y1 + 1) {
      if (Math.min(ax, bx) <= box.x0 + 1 && Math.max(ax, bx) >= box.x1 - 1) { places.y.push(ay); continue }
      if (len > TICK_MAX) continue
      for (const x of [ax, bx]) if (x <= box.x0 + EDGE || x >= box.x1 - EDGE) { const k = x.toFixed(1); if (!rows.y.has(k)) rows.y.set(k, []); rows.y.get(k).push(ay) }
    }
  }
  // A row of ticks: three or more marks sharing an end
  for (const k of ['x', 'y']) for (const list of rows[k].values()) if (list.length >= 3) places[k].push(...list)

  // The labels: words beside the box, the row (or column) nearest it, on
  // whichever side has more
  const flatText = texts.filter(t => !t.angle)
  const pick = groups => [...groups.values()].sort((p, q) => p.gap - q.gap)[0]?.items || []
  const cluster = (list, key, gap) => {
    const groups = new Map()
    for (const t of list) {
      const k = Math.round(key(t) * 2) / 2
      const g = [...groups.keys()].find(q => Math.abs(q - k) <= 1)
      const at = g ?? k
      if (!groups.has(at)) groups.set(at, { gap: gap(t), items: [] })
      groups.get(at).items.push(t)
    }
    return groups
  }
  const below = flatText.filter(t => t.y + t.size * 0.75 < box.y0 + 1 && box.y0 - t.y < LABEL_GAP && t.x + t.w > box.x0 - 20 && t.x < box.x1 + 20)
  const above = flatText.filter(t => t.y > box.y1 - 1 && t.y - box.y1 < LABEL_GAP && t.x + t.w > box.x0 - 20 && t.x < box.x1 + 20)
  const left = flatText.filter(t => t.x + t.w < box.x0 + 1 && box.x0 - (t.x + t.w) < LABEL_GAP && t.y >= box.y0 - 10 && t.y <= box.y1 + 10)
  const right = flatText.filter(t => t.x > box.x1 - 1 && t.x - box.x1 < LABEL_GAP && t.y >= box.y0 - 10 && t.y <= box.y1 + 10)
  // The bottom and left first, where they're numbered; a second axis on the
  // other side (twinx) is a different scale
  const numbered = list => list.filter(t => parseTickLabel(t.s)).length
  const side = (first, other) => (numbered(first) >= 2 || numbered(other) < 2 ? (first.length || !other.length ? first : other) : other)
  const bottomRow = pick(cluster(below, t => t.y, t => box.y0 - t.y)), topRow = pick(cluster(above, t => t.y, t => t.y - box.y1))
  const leftCol = pick(cluster(left, t => t.x + t.w, t => box.x0 - (t.x + t.w))), rightCol = pick(cluster(right, t => t.x, t => t.x - box.x1))
  const xRow = side(bottomRow, topRow), yCol = side(leftCol, rightCol)
  const twin = (xRow === bottomRow && numbered(topRow) >= 2 ? 'x' : '') + (yCol === leftCol && numbered(rightCol) >= 2 ? 'y' : '')

  const pair = (labels, list, anchor, tol) => labels.map(t => {
    const a = anchor(t)
    let best = null
    for (const p of list) if (Math.abs(p - a) <= tol && (best === null || Math.abs(p - a) < Math.abs(best - a))) best = p
    return best === null ? { pos: a, label: t.s, approx: true } : { pos: best, label: t.s }
  }).sort((p, q) => p.pos - q.pos)
  const x = pair(xRow, places.x, t => t.x + t.w / 2, 6)
  // matplotlib centers a y label's line on its tick, its baseline a
  // font's measure below
  const y = pair(yCol, places.y, t => t.y + fontMetrics(t.font).drop * t.size, 4)
  return { x, y, used: [...xRow, ...yCol], twin }
}

// pdf.js may give a label in pieces: LaTeX's glyphs one by one ("2", ".",
// "5"), and 10³ as "10" and a raised "3". One label each
function mergeTexts(texts) {
  // Pieces on one baseline, touching: one word
  const sorted = [...texts].sort((p, q) => (Math.abs(p.y - q.y) > 0.1 * Math.max(p.size, q.size) ? q.y - p.y : p.x - q.x))
  const runs = []
  for (const t of sorted) {
    const last = runs[runs.length - 1]
    const gap = last ? t.x - (last.x + last.w) : Infinity
    if (last && !t.angle && !last.angle && Math.abs(t.y - last.y) < 0.1 * t.size && Math.abs(t.size - last.size) < 0.5 && gap > -0.6 && gap < 0.45 * t.size) {
      last.s += gap > 0.12 * t.size ? ` ${t.s}` : t.s
      last.w = t.x + t.w - last.x
    } else runs.push({ ...t })
  }
  // 10 (or 3 × 10) with its raised power: 10^{3}. Every pair is found
  // first: a power, higher up, comes before its 10
  const power = new Map() // 10's index -> its power's
  const taken = new Set()
  runs.forEach((t, i) => {
    if (!/^(?:[-−]?\d+(?:\.\d+)?\s*×\s*)?10$/.test(t.s)) return
    const j = runs.findIndex((u, k) => k !== i && !taken.has(k) && u.x >= t.x + t.w - 2 && u.x <= t.x + t.w + 8
      && u.y > t.y + 1 && u.y < t.y + t.size && /^[-−]?\d+$/.test(u.s))
    if (j >= 0) { power.set(i, j); taken.add(j) }
  })
  return runs.flatMap((t, i) => {
    if (taken.has(i)) return []
    if (!power.has(i)) return [t]
    const u = runs[power.get(i)]
    return [{ ...t, s: `${t.s}^{${u.s}}`, w: u.x + u.w - t.x }]
  })
}

// The scale note at an axis's end (1e6, ×10^{6}), from a PDF's words
function offsetsOf(texts, box) {
  const out = { x: null, y: null }
  for (const t of texts) {
    if (!parseAxisOffset(t.s)) continue
    if (t.x > box.x1 - 60 && t.y < box.y0) out.x = t.s
    else if (t.y > box.y1 - 2 && (t.x < box.x0 + 60 || t.x > box.x1 - 60)) out.y = t.s
  }
  return out
}

// A PDF's axis labels: the words under the x axis's numbers, and the
// upright words beside the y axis's
function axisLabels(texts, box) {
  const words = texts.filter(t => !parseTickLabel(t.s) && !parseAxisOffset(t.s))
  const x = words.filter(t => !t.angle && t.y < box.y0 - 2 && t.x + t.w / 2 > box.x0 && t.x + t.w / 2 < box.x1).sort((p, q) => q.y - p.y)[0]
  const y = words.filter(t => Math.abs(Math.abs(t.angle) - 90) < 2 && (t.x < box.x0 || t.x > box.x1)).sort((p, q) => Math.abs(p.x - box.x0) - Math.abs(q.x - box.x0))[0]
  return { x: x ? x.s : '', y: y ? y.s : '' }
}

// An axis's scale from its labeled ticks: linear or log, whichever puts the
// ticks where they are; words for labels number the ticks 0, 1, 2…
function calibrate(ticks, offsetText, axis, warnings) {
  let pairs = ticks.filter(t => t.pos != null && t.label != null).map(t => ({ pos: t.pos, label: t.label, approx: !!t.approx, ...(parseTickLabel(t.label) || {}) }))
    .sort((p, q) => p.pos - q.pos)
  const numbered = pairs.filter(p => p.value !== undefined && isFinite(p.value))
  let categories = null
  if (numbered.length < 2) {
    const named = pairs.filter(p => String(p.label).trim())
    if (named.length < 2) return null
    categories = named.map(p => String(p.label).replace(/\$/g, '').trim())
    pairs = named.map((p, i) => ({ pos: p.pos, value: i, approx: p.approx }))
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
  const approx = pairs.some(p => p.approx)
  if (approx) warnings.push(`The ${axis} axis has no tick marks or grid lines to measure from, so its scale comes from where its numbers are printed: very close (within about 0.01% of the axis), not exact.`)
  else if (F.resid > 0.5) warnings.push(`The ${axis} axis’s numbered ticks don’t line up evenly (off by up to ${F.resid.toFixed(1)} pt); check its numbers.`)
  const toData = pos => { const u = (pos - F.a) / F.b; return useLog ? 10 ** u : u }
  return { scale: useLog ? 'log' : 'linear', toData, categories, range: null, fit: F, approx }
}

// ── The legend ──

// { box, order }: where the legend is and when it was drawn (it's drawn
// after the data), from the SVG's group, a filled frame with words in it,
// or, without a frame, words inside the axes with a sample just left of them
function legendOf(d, box, texts) {
  const own = [...(d.paths || []), ...(d.marks || [])].filter(p => p.role === 'legend')
  if (own.length) {
    const frame = own.find(p => p.segs && p.fill && p.segs.length === 1 && p.segs[0].length >= 4)
    // Without a frame: around its samples and its words
    const words = (d.texts || []).filter(t => t.role === 'legend').flatMap(t => [[t.x, t.y], [t.x + t.w, t.y + t.size]])
    const b = frame ? bboxOf(frame.segs[0]) : bboxOf([...own.flatMap(p => (p.segs ? p.segs.flat() : [[p.x, p.y]])), ...words])
    return { box: b, order: Math.min(...own.map(p => p.order ?? 0)), frame: frame || null }
  }
  const words = texts.filter(t => !t.angle && !parseTickLabel(t.s) && t.x > box.x0 && t.x < box.x1 && t.y > box.y0 && t.y < box.y1)
  for (const p of d.paths || []) {
    if (p.role || !p.fill || p.segs.length !== 1 || p.segs[0].length < 4) continue
    const b = bboxOf(p.segs[0])
    if (sameBox(b, box) || b.x0 < box.x0 - 1 || b.x1 > box.x1 + 1 || b.y0 < box.y0 - 1 || b.y1 > box.y1 + 1) continue
    if (words.some(t => t.x >= b.x0 && t.x <= b.x1 && t.y >= b.y0 && t.y <= b.y1)) return { box: b, order: p.order ?? 0, frame: p }
  }
  // No frame: entries, each a word with a sample just before it on its line
  const found = []
  for (const t of words) {
    const s = sampleBefore(d, t, -Infinity)
    if (s) found.push({ t, s })
  }
  if (!found.length) return null
  const pts = found.flatMap(({ t, s }) => [[t.x, t.y], [t.x + t.w, t.y + t.size], ...(s.segs ? s.segs.flat() : [[s.x - s.size / 2, s.y], [s.x + s.size / 2, s.y]])])
  const b = bboxOf(pts)
  return { box: { x0: b.x0 - 2, y0: b.y0 - 2, x1: b.x1 + 2, y1: b.y1 + 2 }, order: Math.min(...found.map(({ s }) => s.order ?? 0)), frame: null }
}

// The sample a legend entry's words follow: a marker or a short line on
// their line, ending just before them, drawn from `after` on
function sampleBefore(d, t, after) {
  const mid = t.y + t.size * 0.35
  const row = y => Math.abs(y - mid) < t.size * 0.6
  const before = x => x < t.x && x > t.x - 40
  const mark = (d.marks || []).find(m => (m.order ?? 0) >= after && row(m.y) && before(m.x) && m.shape !== 'hline' && m.shape !== 'vline')
  if (mark) return mark
  return (d.paths || []).find(p => {
    if ((p.order ?? 0) < after) return false
    const b = bboxOf(p.segs.flat())
    // (the gap before the words is handletextpad, 0.8 of their size by default)
    return row((b.y0 + b.y1) / 2) && b.y1 - b.y0 < t.size && before(b.x1 + 0.01) && t.x - b.x1 < Math.max(12, t.size * 1.6) && (b.x1 - b.x0) > 3 && (b.x1 - b.x0) < 40
  }) || null
}

// Each legend entry's words, and the kind and color of the sample beside them
function legendEntries(d, legend, texts) {
  if (!legend) return []
  const lb = legend.box
  const within = (x, y) => x >= lb.x0 - 1 && x <= lb.x1 + 1 && y >= lb.y0 - 1 && y <= lb.y1 + 1
  const words = texts.filter(t => within(t.x, t.y) && !parseTickLabel(t.s)).sort((p, q) => q.y - p.y)
  return words.map(t => {
    const label = t.s.replace(/\$/g, '')
    const s = sampleBefore(d, t, legend.order)
    if (!s) return { label, kind: null, t }
    if (!s.segs) return { label, kind: 'points', color: s.fill || s.stroke, shape: s.shape, t }
    const r = s.fill && s.segs.length === 1 && rectOf(s.segs[0])
    return r && !s.stroke ? { label, kind: 'bars', color: s.fill, t } : { label, kind: 'line', color: s.stroke, t }
  })
}

// What the legend draws, shared out: each entry's sample and words go to the
// layer named from it (its groups, an SVG's; its operators, a PDF's), so
// they come and go with it; the frame, a title and entries no layer has
// stay the legend's ({ groups, ops }). An SVG's legend is its group's; a
// PDF's, what's drawn in its box from its frame on. An entry is a row of
// the legend: its words, and the sample just before them
function legendDrawing(d, legend, entries, layers) {
  const lb = legend.box
  const out = { groups: new Set(), ops: [] }
  const svg = [...(d.paths || []), ...(d.marks || []), ...(d.texts || [])].some(it => it.role === 'legend')
  const inBox = (x, y) => x >= lb.x0 - 1 && x <= lb.x1 + 1 && y >= lb.y0 - 1 && y <= lb.y1 + 1
  const drawn = it => svg ? it.role === 'legend' : !it.role && (it.order ?? -Infinity) >= legend.order && inBox(...centerOf(it))
  const items = [
    ...[...(d.paths || []), ...(d.marks || [])].filter(drawn),
    ...(svg ? (d.texts || []).filter(t => t.role === 'legend') : (d.textOps || []).filter(drawn)),
  ]
  const rows = entries.map((e, k) => ({ k, mid: e.t.y + e.t.size * 0.35, x0: e.t.x - 45, x: e.t.x, x1: e.t.x + (e.t.w || 0) + 2, size: e.t.size }))
  for (const r of rows) {
    // Half the way to the next row of the same column, or near a line's height
    const gaps = rows.filter(o => o !== r && o.x1 > r.x0 && o.x0 < r.x1).map(o => Math.abs(o.mid - r.mid)).filter(g => g > 0)
    r.half = gaps.length ? Math.min(...gaps) / 2 : r.size * 0.9
  }
  const wide = (lb.x1 - lb.x0) * 0.85
  const rowOf = it => {
    if (it === legend.frame) return null
    let cx, cy, w = 0
    if (it.segs) { const b = bboxOf(it.segs.flat()); cx = (b.x0 + b.x1) / 2; cy = (b.y0 + b.y1) / 2; w = b.x1 - b.x0 }
    else if (it.s != null) { cx = it.x + (it.w || 0) / 2; cy = it.y + it.size * 0.35 }
    else if (it.ops && it.size != null && it.shape == null) { cx = it.x; cy = it.y + it.size * 0.35 }
    else { cx = it.x; cy = it.y }
    // The frame, its shadow: across the legend
    if (w >= wide) return null
    let best = null, score = Infinity
    for (const r of rows) {
      const dy = Math.abs(cy - r.mid)
      if (dy > r.half || cx < r.x0 || cx > r.x1) continue
      // Words before a sample: one column's words can reach the next's sample
      const sc = dy + (cx >= r.x ? 0 : (r.x - cx) / 100)
      if (sc < score) { score = sc; best = r }
    }
    return best
  }
  const byEntry = new Map(layers.filter(l => l.legend != null).map(l => [l.legend, l]))
  for (const it of items) {
    const layer = byEntry.get(rowOf(it)?.k)
    const key = it.gid || it.group
    if (layer) {
      if (key && layer.groups) layer.groups.add(key)
      if (it.ops && layer.ops) layer.ops.push(it.ops)
    } else {
      if (it.legendId) out.groups.add(it.legendId)
      if (it.ops) out.ops.push(it.ops)
    }
  }
  return out
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
    if (g.group && layer.groups) layer.groups.add(g.group)
    if (g.ops && layer.ops) layer.ops.push(g.ops)
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

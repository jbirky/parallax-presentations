// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// An SVG figure as a drawing (drawing.js), with y going up as in a PDF.
// matplotlib names each plot element's group (axes_1, xtick_2, line2d_3,
// PathCollection_1, LineCollection_1, patch_4, legend_1, text_5), stamps
// markers as <use> of a symbol in <defs>, and writes each text's words in a
// comment before its glyphs, so ticks pair with their labels exactly and
// every mark keeps the element it came from. Parsed with DOMParser and never
// put on the page, so nothing in the file runs.

import { IDENTITY, multiply, apply, hexColor, markerShape, bboxOf, fontMetrics } from './drawing'

const SKIP = new Set(['defs', 'clipPath', 'style', 'metadata', 'script', 'title', 'desc', 'mask', 'pattern', 'symbol', 'marker', 'linearGradient', 'radialGradient', 'filter'])

export function readSvgDrawing(text, Parser = globalThis.DOMParser) {
  const doc = new Parser().parseFromString(text, 'image/svg+xml')
  const svg = doc.documentElement
  if (!svg || svg.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) throw new Error('This file isn’t an SVG that could be read')
  const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  const [vx, vy, vw, vh] = vb.length === 4 && vb.every(isFinite) ? vb : [0, 0, parseFloat(svg.getAttribute('width')) || 0, parseFloat(svg.getAttribute('height')) || 0]
  // y up, as a PDF has it
  const root = [1, 0, 0, -1, -vx, vy + vh]
  const byId = new Map()
  for (const el of svg.getElementsByTagName('*')) { const id = el.getAttribute('id'); if (id) byId.set(id, el) }

  const drawing = { width: vw, height: vh, pages: 1, producer: producerOf(svg, text), paths: [], marks: [], texts: [], axes: [], images: 0, notes: [], drawn: 0 }
  const ctx = { byId, drawing, axes: null, group: null, role: null }
  walk(svg, root, ctx)
  return drawing
}

function producerOf(svg, text) {
  const head = text.slice(0, 4000)
  const version = /Matplotlib v([\d.]+)/i.exec(head)
  if (version) return `Matplotlib ${version[1]}`
  if (/matplotlib/i.test(head)) return 'Matplotlib'
  const creator = [...svg.getElementsByTagName('*')].find(e => e.localName === 'creator')
  return creator ? creator.textContent.trim() : ''
}

// The role a group's id gives what's in it
function roleOf(id) {
  if (/^xtick_\d+$/.test(id)) return 'tick-x'
  if (/^ytick_\d+$/.test(id)) return 'tick-y'
  if (/^legend_\d+$/.test(id)) return 'legend'
  return null
}

function walk(el, ctm, ctx) {
  for (const child of el.childNodes) {
    if (child.nodeType !== 1 || SKIP.has(child.localName)) continue
    const m = multiply(ctm, transformOf(child.getAttribute('transform')))
    const id = child.getAttribute('id') || ''
    const tag = child.localName
    if (tag === 'g') {
      if (/^axes_\d+$/.test(id)) {
        const axes = { id, box: null, ticks: { x: [], y: [] }, xLabel: '', yLabel: '', xOffset: null, yOffset: null, title: '' }
        ctx.drawing.axes.push(axes)
        walk(child, m, { ...ctx, axes, group: null, role: null })
        continue
      }
      if (/^text_\d+$/.test(id)) { addText(child, m, ctx); continue }
      // matplotlib numbers its axes' axis groups across the figure: x, y, x, y…
      if (/^matplotlib\.axis_\d+$/.test(id)) { walk(child, m, { ...ctx, axis: Number(id.split('_').pop()) % 2 === 1 ? 'x' : 'y', role: 'axis' }); continue }
      const role = roleOf(id) || ctx.role
      // A tick: the mark's place, and its label
      // A tick: the mark's place, else its grid line's (a style without tick
      // marks), else where its label says it is (matplotlib centers an x
      // label on its tick, and a y label's line)
      if (role === 'tick-x' || role === 'tick-y') {
        if (role !== ctx.role) {
          const tick = { pos: null, grid: null, label: null, text: null }
          walk(child, m, { ...ctx, role, tick })
          let pos = tick.pos ?? tick.grid, approx = false
          if (pos == null && tick.text) {
            pos = role === 'tick-x' ? tick.text.x + tick.text.w / 2 : tick.text.y + fontMetrics(tick.text.font).drop * tick.text.size
            approx = true
          }
          if (ctx.axes && pos != null) ctx.axes.ticks[role === 'tick-x' ? 'x' : 'y'].push({ pos, label: tick.label, approx })
          continue
        }
      }
      const group = /^(line2d|PathCollection|LineCollection|PolyCollection|patch|Line2D|QuadMesh)_?\d*$/i.test(id) && !ctx.group ? id : ctx.group
      walk(child, m, { ...ctx, role, group })
      continue
    }
    if (tag === 'text') { addText(child, m, ctx); continue }
    if (tag === 'image') { ctx.drawing.images++; continue }
    if (tag === 'use') { addUse(child, m, ctx); continue }
    const shape = shapeOf(child)
    if (shape) addPath(child, shape, m, ctx)
  }
}

// A text group's words (matplotlib's comment, or <text>'s own) at its glyphs'
// first place
function addText(el, m, ctx) {
  let words = ''
  for (const n of el.childNodes) if (n.nodeType === 8) { words = n.nodeValue.trim(); break }
  if (!words && el.localName === 'text') words = el.textContent.trim()
  if (!words) return
  let at = m, size = 10, w = null, anchor = 'start', font = ''
  const glyphs = [...el.getElementsByTagName('g')].find(g => g.getAttribute('transform'))
  if (glyphs) {
    at = multiply(m, transformOf(glyphs.getAttribute('transform')))
    size = Math.abs(at[3]) * 100 || 10
    // Its width: the last glyph's place along the line, and a digit's width
    // after it, in its font (the glyphs are named after it: DejaVuSans-31)
    const uses = [...glyphs.getElementsByTagName('use')]
    font = ((uses[0]?.getAttribute('xlink:href') || uses[0]?.getAttribute('href') || '').match(/^#(.+)-[0-9a-f]+$/i) || [])[1] || ''
    let last = 0
    for (const u of uses) last = Math.max(last, transformOf(u.getAttribute('transform'))[4])
    w = (last + fontMetrics(font).digit) * Math.hypot(at[0], at[1])
  } else if (el.localName === 'text') {
    at = multiply(m, [1, 0, 0, 1, parseFloat(el.getAttribute('x')) || 0, parseFloat(el.getAttribute('y')) || 0])
    const style = styleOf(el)
    size = parseFloat(style['font-size']) || 10
    anchor = style['text-anchor'] || el.getAttribute('text-anchor') || 'start'
    font = style['font-family'] || ''
  }
  if (w === null) w = size * 0.6 * words.length
  let [x, y] = apply(at, 0, 0)
  if (anchor === 'middle') x -= w / 2
  else if (anchor === 'end') x -= w
  const angle = Math.round(Math.atan2(-at[1], at[0]) * 180 / Math.PI)
  const text = { s: words, x, y, size, angle, w, font, group: ctx.group, role: ctx.role }
  ctx.drawing.texts.push(text)
  if (ctx.tick) { ctx.tick.label = words; ctx.tick.text = text }
  else if (ctx.role === 'axis' && ctx.axes) {
    // An axis's own words: its label, or the note that scales its numbers
    const key = ctx.axis === 'x' ? 'x' : 'y'
    if (!ctx.axes[`${key}Label`] && !/^\$?[−\-+×\\\d]/.test(words)) ctx.axes[`${key}Label`] = words.replace(/\$/g, '')
    else ctx.axes[`${key}Offset`] = words
  } else if (ctx.axes && !ctx.role && !ctx.group && !ctx.axes.title) ctx.axes.title = words.replace(/\$/g, '')
}

function addUse(el, m, ctx) {
  const ref = (el.getAttribute('xlink:href') || el.getAttribute('href') || '').replace(/^#/, '')
  const def = ctx.byId.get(ref)
  if (!def) return
  const x = parseFloat(el.getAttribute('x')) || 0, y = parseFloat(el.getAttribute('y')) || 0
  const at = multiply(m, [1, 0, 0, 1, x, y])
  const [px, py] = apply(at, 0, 0)
  if (ctx.tick) { if (ctx.tick.pos == null) ctx.tick.pos = ctx.role === 'tick-x' ? px : py; return }
  const shape = shapeOf(def)
  if (!shape) return
  // The symbol's outline about its center, in the page's points
  const lin = [at[0], at[1], at[2], at[3], 0, 0]
  const segs = shape.segs.map(s => s.map(([sx, sy]) => apply(lin, sx, sy)))
  const { shape: name, size } = markerShape(segs, shape.curves)
  const style = { ...styleOf(def), ...styleOf(el) }
  ctx.drawing.marks.push({ x: px, y: py, shape: name, size, fill: paintOf(style.fill, '#000000'), stroke: paintOf(style.stroke, null), group: ctx.group, role: ctx.role, axes: ctx.axes?.id, order: ctx.drawing.drawn++ })
}

function addPath(el, shape, m, ctx) {
  const segs = shape.segs.map(s => s.map(([x, y]) => apply(m, x, y)))
  if (!segs.length) return
  const style = styleOf(el)
  const scale = Math.hypot(m[0], m[1]) || 1
  const stroke = paintOf(style.stroke, null)
  // A tick's grid line says where the tick is
  if (ctx.tick && ctx.tick.grid == null) ctx.tick.grid = ctx.role === 'tick-x' ? segs[0][0][0] : segs[0][0][1]
  const path = {
    segs, closed: shape.closed, curves: shape.curves,
    stroke, fill: paintOf(style.fill, '#000000'),
    width: (parseFloat(style['stroke-width']) || 1) * scale,
    dash: stroke && style['stroke-dasharray'] && style['stroke-dasharray'] !== 'none' ? style['stroke-dasharray'].split(/[\s,]+/).map(Number).filter(isFinite) : null,
    group: ctx.group, role: ctx.role, axes: ctx.axes?.id, order: ctx.drawing.drawn++,
  }
  // The axes' background: the first thing its axes draw, a patch
  if (ctx.axes && !ctx.axes.drawn) {
    ctx.axes.drawn = true
    if (/^patch_\d+$/.test(ctx.group || '') && segs.length === 1 && segs[0].length === 4) {
      ctx.axes.box = bboxOf(segs[0])
      path.role = 'axes'
    }
  }
  ctx.drawing.paths.push(path)
}

// fill and stroke as #rrggbb or null; an unset fill is black, as in SVG
function paintOf(v, unset) {
  if (v === undefined) return unset
  return hexColor(v)
}

function styleOf(el) {
  const out = {}
  for (const a of ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-size', 'text-anchor', 'font-family']) { const v = el.getAttribute(a); if (v != null) out[a] = v.trim() }
  for (const part of (el.getAttribute('style') || '').split(';')) {
    const k = part.indexOf(':')
    if (k > 0) out[part.slice(0, k).trim()] = part.slice(k + 1).trim()
  }
  return out
}

// The subpaths an element draws, unmoved
function shapeOf(el) {
  const tag = el.localName
  const num = a => parseFloat(el.getAttribute(a)) || 0
  if (tag === 'path') return parsePathData(el.getAttribute('d') || '')
  if (tag === 'rect') {
    const x = num('x'), y = num('y'), w = num('width'), h = num('height')
    return { segs: [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]], closed: true, curves: 0 }
  }
  if (tag === 'line') return { segs: [[[num('x1'), num('y1')], [num('x2'), num('y2')]]], closed: false, curves: 0 }
  if (tag === 'polyline' || tag === 'polygon') {
    const v = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number)
    const pts = []
    for (let i = 0; i + 1 < v.length; i += 2) pts.push([v[i], v[i + 1]])
    return { segs: [pts], closed: tag === 'polygon', curves: 0 }
  }
  if (tag === 'circle' || tag === 'ellipse') {
    const cx = num('cx'), cy = num('cy'), rx = tag === 'circle' ? num('r') : num('rx'), ry = tag === 'circle' ? num('r') : num('ry')
    return { segs: [[[cx + rx, cy], [cx, cy + ry], [cx - rx, cy], [cx, cy - ry]]], closed: true, curves: 4 }
  }
  return null
}

// SVG path data: M L H V C S Q T A Z, absolute or relative. Curves keep only
// their end points (a marker's outline and a curve's ends are what's read)
export function parsePathData(d) {
  const tokens = d.match(/[a-df-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || []
  const segs = []
  let cur = null, x = 0, y = 0, sx = 0, sy = 0, curves = 0, closed = false, cmd = ''
  let i = 0
  const n = () => Number(tokens[i++])
  const isNum = () => i < tokens.length && !/^[a-z]$/i.test(tokens[i])
  const to = (nx, ny) => { x = nx; y = ny; if (!cur) { cur = [[x, y]]; segs.push(cur) } else cur.push([x, y]) }
  while (i < tokens.length) {
    if (/^[a-z]$/i.test(tokens[i])) cmd = tokens[i++]
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    if (C === 'Z') { closed = true; x = sx; y = sy; cur = null; continue }
    if (!isNum()) { i++; continue }
    if (C === 'M') {
      const nx = n() + (rel ? x : 0), ny = n() + (rel ? y : 0)
      cur = [[nx, ny]]; segs.push(cur); x = sx = nx; y = sy = ny
      cmd = rel ? 'l' : 'L'
    } else if (C === 'L') to(n() + (rel ? x : 0), n() + (rel ? y : 0))
    else if (C === 'H') to(n() + (rel ? x : 0), y)
    else if (C === 'V') to(x, n() + (rel ? y : 0))
    else if (C === 'C') { i += 4; curves++; to(n() + (rel ? x : 0), n() + (rel ? y : 0)) }
    else if (C === 'S' || C === 'Q') { i += 2; curves++; to(n() + (rel ? x : 0), n() + (rel ? y : 0)) }
    else if (C === 'T') { curves++; to(n() + (rel ? x : 0), n() + (rel ? y : 0)) }
    else if (C === 'A') { i += 5; curves++; to(n() + (rel ? x : 0), n() + (rel ? y : 0)) }
    else i++
  }
  return { segs: segs.filter(s => s.length), closed, curves }
}

// An SVG transform list as one matrix
export function transformOf(attr) {
  let m = IDENTITY
  if (!attr) return m
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g
  let t
  while ((t = re.exec(attr))) {
    const v = t[2].trim().split(/[\s,]+/).map(Number)
    let n = IDENTITY
    if (t[1] === 'matrix' && v.length === 6) n = v
    else if (t[1] === 'translate') n = [1, 0, 0, 1, v[0] || 0, v[1] || 0]
    else if (t[1] === 'scale') n = [v[0], 0, 0, v.length > 1 ? v[1] : v[0], 0, 0]
    else if (t[1] === 'rotate') {
      const r = (v[0] || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r)
      n = [c, s, -s, c, 0, 0]
      if (v.length === 3) n = multiply(multiply([1, 0, 0, 1, v[1], v[2]], n), [1, 0, 0, 1, -v[1], -v[2]])
    } else if (t[1] === 'skewX') n = [1, 0, Math.tan((v[0] || 0) * Math.PI / 180), 1, 0, 0]
    else if (t[1] === 'skewY') n = [1, Math.tan((v[0] || 0) * Math.PI / 180), 0, 1, 0, 0]
    m = multiply(m, n)
  }
  return m
}

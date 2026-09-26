// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The geometry of shape elements, in one place: the editor's canvas
// (ShapeRenderer) draws shapeParts, the deck generators write shapeSvgString,
// and shapes that change their outline in a state (utils/clickActions.js)
// morph between shapeOutline points.
//
// The server has a copy of this file, for the pages it builds, written by
// scripts/copy-click-actions.js.

// Shapes with an inside, which can morph into one another
export const CLOSED_SHAPES = ['rect', 'rounded-rect', 'circle', 'triangle', 'diamond', 'arrow-right', 'star']

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const round = v => Math.round(v * 100) / 100
const escapeAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function dashArray(style, width) {
  return style === 'dashed' ? `${width * 3} ${width * 2}` : style === 'dotted' ? `${width} ${width * 1.5}` : undefined
}

// A star's points, from its own settings or the middle of its box
function starPoints(el, w, h, sw) {
  const cx = el.starCx != null ? num(el.starCx) : w / 2
  const cy = el.starCy != null ? num(el.starCy) : h / 2
  const outerR = el.starOuterR != null ? num(el.starOuterR) : Math.min(w, h) / 2 - sw
  const innerR = el.starInnerR != null ? num(el.starInnerR) : outerR * 0.4
  const pts = []
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return pts
}

// The corners of a closed shape that's drawn as a polygon, or null
function polygonPoints(el, w, h, sw) {
  switch (el.shape) {
    case 'triangle': return [[w / 2, sw], [w - sw, h - sw], [sw, h - sw]]
    case 'diamond': return [[w / 2, sw], [w - sw, h / 2], [w / 2, h - sw], [sw, h / 2]]
    case 'arrow-right': return [[sw, h * 0.35], [w * 0.6, h * 0.35], [w * 0.6, sw], [w - sw, h / 2], [w * 0.6, h - sw], [w * 0.6, h * 0.65], [sw, h * 0.65]]
    case 'star': return starPoints(el, w, h, sw)
    default: return null
  }
}

// A rectangle's corner radius, as SVG draws it
const cornerRadius = (el, w, h, sw) => Math.max(0, Math.min(el.shape === 'rounded-rect' ? Math.min(w, h) * 0.15 : num(el.borderRadius), (w - sw) / 2, (h - sw) / 2))

// The SVG that draws `el`: for a line, `lines`, each { tag, attrs }; for any
// other shape, a `body` in a `group` that paints it
export function shapeParts(el) {
  const w = num(el.width), h = num(el.height), sw = num(el.strokeWidth)
  const shape = el.shape || 'rect'
  if (shape === 'line' || shape === 'line-arrow') {
    const lw = num(el.strokeWidth) || 3
    const color = el.stroke && el.stroke !== 'none' ? el.stroke : (el.fill || '#ffffff')
    const dash = dashArray(el.strokeDasharray, lw)
    const lines = [{ tag: 'line', attrs: { x1: lw, y1: h / 2, x2: w - lw, y2: h / 2, stroke: color, 'stroke-width': lw, 'stroke-dasharray': dash, fill: 'none' } }]
    if (shape === 'line-arrow') {
      const hs = Math.max(lw * 3, h * 0.3)
      lines.push({ tag: 'polyline', attrs: {
        points: `${w - lw - hs},${h / 2 - hs} ${w - lw},${h / 2} ${w - lw - hs},${h / 2 + hs}`,
        stroke: color, 'stroke-width': lw, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      } })
    }
    return { lines }
  }
  const group = { fill: el.fill || '#6366f1', stroke: el.stroke || 'none', 'stroke-width': sw, 'stroke-dasharray': dashArray(el.strokeDasharray, sw) }
  const poly = polygonPoints({ ...el, shape }, w, h, sw)
  const body = poly ? { tag: 'polygon', attrs: { points: poly.map(p => p.join(',')).join(' ') } }
    : shape === 'circle' ? { tag: 'ellipse', attrs: { cx: w / 2, cy: h / 2, rx: Math.max(0, w / 2 - sw / 2), ry: Math.max(0, h / 2 - sw / 2) } }
    : { tag: 'rect', attrs: { x: sw / 2, y: sw / 2, width: w - sw, height: h - sw, rx: shape === 'rect' || shape === 'rounded-rect' ? cornerRadius({ ...el, shape }, w, h, sw) : 0 } }
  return { group, body }
}

// A closed shape's outline as `n` points evenly spaced along it, from the top
// middle round clockwise, so that two outlines' points pair up for a morph.
// Lines have none.
export function shapeOutline(el, n = 64) {
  const shape = el.shape || 'rect'
  if (!CLOSED_SHAPES.includes(shape)) return null
  const w = num(el.width), h = num(el.height), sw = num(el.strokeWidth)
  // The outline, finely: corners and curves as many short edges
  let dense = polygonPoints({ ...el, shape }, w, h, sw)
  if (shape === 'circle') {
    const rx = Math.max(0, w / 2 - sw / 2), ry = Math.max(0, h / 2 - sw / 2)
    dense = Array.from({ length: 256 }, (_, i) => { const a = (2 * Math.PI * i) / 256 - Math.PI / 2; return [w / 2 + rx * Math.cos(a), h / 2 + ry * Math.sin(a)] })
  } else if (!dense) {
    const r = cornerRadius({ ...el, shape }, w, h, sw), x0 = sw / 2, y0 = sw / 2, x1 = w - sw / 2, y1 = h - sw / 2
    const arc = (cx, cy, from) => Array.from({ length: 17 }, (_, i) => { const a = from + (Math.PI / 2) * (i / 16); return [cx + r * Math.cos(a), cy + r * Math.sin(a)] })
    dense = [...arc(x1 - r, y0 + r, -Math.PI / 2), ...arc(x1 - r, y1 - r, 0), ...arc(x0 + r, y1 - r, Math.PI / 2), ...arc(x0 + r, y0 + r, Math.PI)]
  }
  // Clockwise on screen (y down), from where it crosses the middle at the top
  const area = dense.reduce((a, p, i) => { const q = dense[(i + 1) % dense.length]; return a + p[0] * q[1] - q[0] * p[1] }, 0)
  if (area < 0) dense.reverse()
  const cx = w / 2
  let top = null
  dense.forEach((p, i) => {
    const q = dense[(i + 1) % dense.length]
    if ((p[0] - cx) * (q[0] - cx) > 0 || p[0] === q[0]) return
    const y = p[1] + (q[1] - p[1]) * ((cx - p[0]) / (q[0] - p[0]))
    if (!top || y < top.y) top = { i, y }
  })
  if (top) dense = [[cx, top.y], ...dense.slice(top.i + 1), ...dense.slice(0, top.i + 1)]
  // Evenly by length along the edges
  const lengths = dense.map((p, i) => { const q = dense[(i + 1) % dense.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]) })
  const total = lengths.reduce((a, b) => a + b, 0) || 1
  const points = []
  let edge = 0, walked = 0
  for (let k = 0; k < n; k++) {
    const at = (total * k) / n
    while (edge < dense.length - 1 && walked + lengths[edge] < at) walked += lengths[edge++]
    const p = dense[edge], q = dense[(edge + 1) % dense.length], t = lengths[edge] ? (at - walked) / lengths[edge] : 0
    points.push([round(p[0] + (q[0] - p[0]) * t), round(p[1] + (q[1] - p[1]) * t)])
  }
  return points
}

// Points as an SVG path
export const outlinePath = points => `M${points.map(p => p.join(' ')).join('L')}Z`

const attrsHtml = attrs => Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null && v !== '')
  .map(([k, v]) => ` ${k}="${escapeAttr(typeof v === 'number' ? round(v) : v)}"`).join('')

// The SVG for a shape element in a page. With `morph` ({ d, outlines }), the
// shape is a path drawn in the element's own pixels, starting as `d`, with
// the outlines it morphs between; its label stays in the middle as the
// element changes size.
export function shapeSvgString(el, morph = null) {
  const w = num(el.width), h = num(el.height)
  const parts = shapeParts(el)
  const inner = parts.lines
    ? parts.lines.map(({ tag, attrs }) => `<${tag}${attrsHtml(attrs)} />`).join('')
    : `<g${attrsHtml(parts.group)}>${morph ? `<path d="${escapeAttr(morph.d)}" data-morph="${escapeAttr(morph.outlines)}" />` : `<${parts.body.tag}${attrsHtml(parts.body.attrs)} />`}</g>`
  const label = el.text
    ? `<text${attrsHtml({ x: morph ? '50%' : w / 2, y: morph ? '50%' : h / 2, 'dominant-baseline': 'middle', 'text-anchor': 'middle', 'font-size': num(el.fontSize) || 16, fill: el.textColor || '#ffffff' })} style="font-family:inherit;">${escapeAttr(el.text)}</text>`
    : ''
  const box = morph ? '' : ` viewBox="0 0 ${round(w)} ${round(h)}" preserveAspectRatio="none"`
  return `<svg width="100%" height="100%"${box} style="position:absolute;inset:0;overflow:visible;">${inner}${label}</svg>`
}

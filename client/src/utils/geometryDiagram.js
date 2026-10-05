// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Geometry construction elements (toolbar: Diagrams → Geometry), made in
// GeometryEditorModal and worked out by geometryEngine.js. The element keeps
// the construction as its script, the view (the world point at its center
// and the width of world it shows, so the figure scales with the box), its
// colors, axes and grid, and its steps: how many objects show before the
// first, how many each step shows, captions, and whether the working is
// hidden at the end.
//
// geometrySvg draws it for the canvas and thumbnails (labels by KaTeX),
// printed pages (labels the print page's KaTeX fills in) and PowerPoint
// (labels as SVG text). A deck carries the engine (geometryDeckScript), so
// its points can be dragged when presenting and each step draws in.

import { GEO, geometryRuntime } from './geometryEngine'
import { texSvg, texLiteHtml, MATH_FONT } from './diagramCore'

export const GEOMETRY_FIELDS = ['script', 'view', 'theme', 'axes', 'grid', 'steps', 'start', 'tidy', 'captions', 'stepStart']
export const GEOMETRY_SIZE = { w: 640, h: 400 }

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n2 = v => String(Math.round(v * 100) / 100)
const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d)

// The element's settings, every one checked
export function geometryModel(el) {
  const v = el?.view || {}
  const start = Math.round(Number(el?.stepStart))
  return {
    script: String(el?.script ?? '').slice(0, 40000),
    view: { x: num(v.x, -1e6, 1e6, 0), y: num(v.y, -1e6, 1e6, 0), w: num(v.w, 0.01, 1e6, 12) },
    theme: el?.theme === 'light' ? 'light' : 'dark',
    axes: !!el?.axes,
    grid: !!el?.grid,
    steps: (Array.isArray(el?.steps) ? el.steps : []).slice(0, 400).map(s => ({ to: Math.max(0, Math.round(Number(s?.to) || 0)), caption: typeof s?.caption === 'string' ? s.caption.slice(0, 200) : '' })),
    start: el?.start == null || el.start === '' ? null : Math.max(0, Math.round(Number(el.start) || 0)),
    tidy: !!el?.tidy,
    captions: el?.captions !== false,
    stepStart: start >= 1 && start <= 1000 ? start : 1,
    W: num(el?.width, 20, 20000, GEOMETRY_SIZE.w),
    H: num(el?.height, 20, 20000, GEOMETRY_SIZE.h),
  }
}

// What each step shows: to[k] objects at step k (0 is before the first),
// its caption, the step from which the working is hidden, and whether a
// step was added to show the rest
export function geometryPlan(m, objs) {
  const n = objs.length
  if (!m.steps.length) return { to: [n], captions: [''], tidyAt: null, rest: false }
  const lead = objs.findIndex(o => o.cmd !== 'Point')
  const start = Math.min(n, m.start == null ? (lead < 0 ? n : lead) : m.start)
  const to = [start], captions = ['']
  for (const s of m.steps) {
    const t = Math.min(n, Math.max(to[to.length - 1], s.to))
    to.push(t)
    captions.push(m.captions ? (s.caption || (t > 0 && t > to[to.length - 2] ? GEO.describe(objs[t - 1]) : '')) : '')
  }
  // Nothing is left out: a last step shows what the steps don't reach
  const rest = to[to.length - 1] < n
  if (rest) { to.push(n); captions.push(m.captions ? GEO.describe(objs[n - 1]) : '') }
  let tidyAt = null
  if (m.tidy) { to.push(n); captions.push(''); tidyAt = to.length - 1 }
  return { to, captions, tidyAt, rest }
}

// Steps a line each, from the first object after the points it starts with
export function stepsPerLine(objs, start) {
  const lead = objs.findIndex(o => o.cmd !== 'Point')
  const from = start == null ? (lead < 0 ? objs.length : lead) : start
  const out = []
  for (let t = from + 1; t <= objs.length; t++) out.push({ to: t, caption: '' })
  return out
}

// ---------- Labels: a point's name in KaTeX, centered on where it goes

function labelBox(tex, x, y, size, color, inner) {
  const w = Math.max(28, tex.length * size * 0.9), h = size * 2
  return `<foreignObject x="${n2(x - w / 2)}" y="${n2(y - h / 2)}" width="${n2(w)}" height="${n2(h)}" pointer-events="none" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:${n2(size / 1.21)}px;color:${esc(color)}">${inner}</div></foreignObject>`
}
// labels: 'text' (SVG text, for PowerPoint), 'deck' (for a page's KaTeX
// to fill in), or a function from TeX to KaTeX's HTML
export function geometryLabeler(labels) {
  if (labels === 'deck') return (tex, x, y, size, color) => labelBox(tex, x, y, size, color, `<span data-math-latex="${esc(tex)}" style="font-family:${esc(MATH_FONT)}">${texLiteHtml(tex)}</span>`)
  if (typeof labels === 'function') return (tex, x, y, size, color) => labelBox(tex, x, y, size, color, labels(tex))
  return (tex, x, y, size, color) => texSvg(tex, x, y, size, color)
}

// ---------- The element as an <svg> filling its box. opts: labels, step (as
// at that step, with its caption; default everything), standalone, and
// for the editor, hover, sel, anim
export function geometrySvg(el, opts = {}) {
  const m = geometryModel(el), p = GEO.parse(m.script)
  if (p.errors.length) return placeholder(m, `Line ${p.errors[0].line}: ${p.errors[0].msg}`, opts)
  const vals = GEO.compute(p.objs), plan = geometryPlan(m, p.objs)
  const at = opts.step == null ? null : Math.max(0, Math.min(plan.to.length - 1, opts.step))
  return GEO.render(p.objs, vals, {
    W: m.W, H: m.H, view: m.view, dark: m.theme === 'dark', axes: m.axes, grid: m.grid, label: geometryLabeler(opts.labels),
    upto: at == null ? null : plan.to[at], tidy: at != null && plan.tidyAt != null && at >= plan.tidyAt, caption: at == null ? '' : plan.captions[at],
    standalone: opts.standalone, hover: opts.hover, sel: opts.sel, anim: opts.anim,
  })
}
function placeholder(m, msg, opts) {
  const dark = m.theme === 'dark', W = m.W, H = m.H, c = dark ? '#f5a524' : '#b45309'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"${opts.standalone ? ` width="${W}" height="${H}"` : ''} style="display:block;width:100%;height:100%"><rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="10" fill="none" stroke="${c}" stroke-dasharray="7 5"/>` +
    `<text x="${W / 2}" y="${H / 2 - 8}" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="600" fill="${c}">Geometry</text>` +
    `<text x="${W / 2}" y="${H / 2 + 18}" text-anchor="middle" font-family="sans-serif" font-size="13" fill="${dark ? '#e7ebf3' : '#333'}">${esc(msg.length > 80 ? msg.slice(0, 79) + '…' : msg)}</text></svg>`
}

// The view that frames the figure's points and circles in a W × H box
export function fitView(objs, vals, W = GEOMETRY_SIZE.w, H = GEOMETRY_SIZE.h) {
  const xs = [], ys = []
  objs.forEach(o => {
    const v = vals[o.name]
    if (!v || o.opts.hidden) return
    if (GEO.isPoint(v)) { xs.push(v.x); ys.push(v.y) }
    else if (GEO.isCircle(v)) { xs.push(v.c.x - v.r, v.c.x + v.r); ys.push(v.c.y - v.r, v.c.y + v.r) }
  })
  if (!xs.length) return { x: 0, y: 0, w: 12 }
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const w = Math.max((x1 - x0) * 1.22, (y1 - y0) * 1.3 * W / H, 2)
  return { x: Math.round((x0 + x1) / 2 * 100) / 100, y: Math.round(((y0 + y1) / 2 - w * H / W * 0.02) * 100) / 100, w: Math.round(w * 100) / 100 }
}

// ---------- Steps: the element's kth step is its diagram step k

export function geometrySteps(el) {
  if (el?.type !== 'geometry') return []
  const m = geometryModel(el), p = GEO.parse(m.script)
  if (p.errors.length) return []
  const plan = geometryPlan(m, p.objs)
  const out = []
  for (let k = 1; k < plan.to.length; k++) if (m.stepStart - 1 + k <= 1000) out.push([m.stepStart - 1 + k, k])
  return out
}
export function geometryStepAt(el, slideStep) {
  let at = 0
  for (const [n, s] of geometrySteps(el)) if (n <= slideStep) at = s
  return at
}
export function geometryStepMarkers(slide) {
  let html = ''
  for (const el of slide?.elements || []) {
    const id = String(el.id || '').replace(/[^A-Za-z0-9_-]/g, '')
    for (const [n, s] of geometrySteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-gm-step="${id}" data-gm-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`
  }
  return html
}
export function hasGeometry(presentation) {
  return (presentation?.slides || []).some(s => (s.elements || []).some(el => el.type === 'geometry'))
}

// ---------- In a deck: the figure as the slide opens, and what the deck's
// script needs to redraw it as its points are dragged
export function geometryDeckHtml(el) {
  const m = geometryModel(el), p = GEO.parse(m.script)
  const id = String(el.id || '').replace(/[^A-Za-z0-9_-]/g, '')
  if (p.errors.length) return { id, attrs: '', svg: geometrySvg(el) }
  const plan = geometryPlan(m, p.objs)
  const cfg = { script: GEO.serialize(p.objs), view: m.view, W: m.W, H: m.H, dark: m.theme === 'dark', axes: m.axes, grid: m.grid, plan }
  return { id, attrs: ` data-gm="${id}" data-gm-config="${esc(JSON.stringify(cfg))}"`, svg: geometrySvg(el, { step: 0, labels: 'deck' }) }
}

export const GEOMETRY_CSS = [
  '.pxgm-new[pathLength]{stroke-dasharray:1;animation:pxgm-draw .9s ease-in-out both}',
  '.pxgm-fade,g.pxgm-new{animation:pxgm-fade .45s ease-out both}',
  '@keyframes pxgm-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}',
  '@keyframes pxgm-fade{from{opacity:0}to{opacity:1}}',
  '@media (prefers-reduced-motion:reduce){.pxgm-new,.pxgm-fade{animation:none}}',
].join('\n')

// The engine, once, with KaTeX for the labels: points dragged, each step
// drawn in, and every figure back as saved when its slide is shown again
let deckScript = null
export function geometryDeckScript() {
  if (!deckScript) deckScript = `
    (function() {
      var G = (${geometryRuntime.toString()})();
      var css = document.createElement('style');
      css.textContent = ${JSON.stringify(GEOMETRY_CSS)};
      document.head.appendChild(css);
      var cache = {};
      function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
      function label(tex, x, y, size, color) {
        var html = cache[tex];
        if (html == null) {
          try { html = window.katex ? window.katex.renderToString(tex, { throwOnError: false }) : esc(tex); } catch (e) { html = esc(tex); }
          cache[tex] = html;
        }
        var w = Math.max(28, tex.length * size * 0.9), h = size * 2;
        return '<foreignObject x="' + (x - w / 2) + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" pointer-events="none" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:' + (size / 1.21) + 'px;color:' + color + '">' + html + '</div></foreignObject>';
      }
      var items = [];
      document.querySelectorAll('[data-gm]').forEach(function(el) {
        // Not the overview's pictures of slides
        if (el.closest('[inert]')) return;
        var cfg;
        try { cfg = JSON.parse(el.getAttribute('data-gm-config')); } catch (e) { return; }
        items.push({ el: el, id: el.getAttribute('data-gm'), at: -1, api: G.attach(el, cfg, { label: label }) });
      });
      function stepOf(item) {
        var slide = item.el.closest('section'), n = 0;
        if (!slide) return 0;
        slide.querySelectorAll('.fragment[data-gm-step]').forEach(function(m) {
          if (m.getAttribute('data-gm-step') === item.id && m.classList.contains('visible')) n = Math.max(n, +m.getAttribute('data-gm-step-at') || 0);
        });
        return n;
      }
      function sync(ev) {
        var forward = !!ev && ev.type === 'fragmentshown';
        items.forEach(function(item) {
          var n = stepOf(item);
          if (n !== item.at) { item.api.setStep(n, forward && n > item.at); item.at = n; }
        });
      }
      ['ready', 'fragmentshown', 'fragmenthidden'].forEach(function(name) { Reveal.on(name, sync); });
      Reveal.on('slidechanged', function() {
        items.forEach(function(item) { item.api.reset(); item.at = -1; });
        sync();
      });
      sync();
    })();
`
  return deckScript
}

// ---------- tkz-euclide: the construction itself, so the figure moves in
// LaTeX too, clipped to the element's view
const TKZ_COLORS = { red: 'red', blue: 'blue', green: 'green!60!black', yellow: 'orange', purple: 'purple' }
export function geometryTikz(el) {
  const m = geometryModel(el), p = GEO.parse(m.script)
  if (p.errors.length) return `% Line ${p.errors[0].line}: ${p.errors[0].msg}`
  const objs = p.objs, vals = GEO.compute(objs)
  const T = n => String(n).replace(/'/g, 'p').replace(/[^A-Za-z0-9]/g, '') || 'X'
  const pair = v => `${n2(v.x)},${n2(v.y)}`
  const byName = Object.fromEntries(objs.map(o => [o.name, o]))
  const defs = [], draws = [], points = [], linePts = {}
  const opt = (o, more = []) => {
    const list = [...more]
    if (o.opts.construction) list.push('gray', 'thin', 'dashed')
    else if (o.opts.dashed) list.push('dashed')
    if (o.opts.color && TKZ_COLORS[o.opts.color]) list.push(`color=${TKZ_COLORS[o.opts.color]}`)
    return list.length ? `[${list.join(', ')}]` : ''
  }
  for (const o of objs) {
    const v = vals[o.name]
    if (!v) continue
    const n = T(o.name), a = o.args.map(x => (typeof x === 'number' ? x : T(x)))
    const mark = draws.length
    switch (o.cmd) {
      case 'Point': defs.push(`\\tkzDefPoint(${pair(v)}){${n}}`); break
      case 'PointOn': defs.push(`\\tkzDefPoint(${pair(v)}){${n}} % on ${a[0]}, where it was left`); break
      case 'Midpoint': defs.push(`\\tkzDefMidPoint(${a[0]},${a[1]}) \\tkzGetPoint{${n}}`); break
      case 'Intersect': {
        const u = byName[o.args[0]], w = byName[o.args[1]], cu = u.cmd === 'Circle', cw = w.cmd === 'Circle'
        const two = x => `(${linePts[T(x.name)].join(',')})`
        if (!cu && !cw) { defs.push(`\\tkzInterLL${two(u)}${two(w)} \\tkzGetPoint{${n}}`); break }
        // tkz-euclide's own order of the two crossings, matched to this one's
        const order = tkzOrder(vals[o.args[0]], vals[o.args[1]], cu, cw)
        const get = order.length > 1 && GEO.dist(order[1], v) < 1e-6 ? '\\tkzGetSecondPoint' : '\\tkzGetFirstPoint'
        defs.push(cu && cw ? `\\tkzInterCC${two(u)}${two(w)} ${get}{${n}}` : `\\tkzInterLC${two(cu ? w : u)}${two(cu ? u : w)} ${get}{${n}}`)
        break
      }
      case 'Segment': linePts[n] = [a[0], a[1]]; draws.push(`\\tkzDrawSegment${opt(o)}(${a[0]},${a[1]})`); break
      case 'Line': linePts[n] = [a[0], a[1]]; draws.push(`\\tkzDrawLine${opt(o, ['add=4 and 4'])}(${a[0]},${a[1]})`); break
      case 'Ray': linePts[n] = [a[0], a[1]]; draws.push(`\\tkzDrawLine${opt(o, ['add=0 and 6'])}(${a[0]},${a[1]})`); break
      case 'Circle':
        if (a.length === 2) linePts[n] = [a[0], a[1]]
        else { defs.push(`\\tkzDefCircle[circum](${a.join(',')}) \\tkzGetPoint{${n}O}`); linePts[n] = [`${n}O`, a[0]] }
        draws.push(`\\tkzDrawCircle${opt(o)}(${linePts[n].join(',')})`)
        break
      case 'Perpendicular': case 'Parallel': {
        const ln = a.length === 2 ? linePts[a[1]] : [a[1], a[2]]
        defs.push(`\\tkzDefLine[${o.cmd === 'Perpendicular' ? 'orthogonal' : 'parallel'}=through ${a[0]}](${ln.join(',')}) \\tkzGetPoint{${n}2}`)
        linePts[n] = [a[0], `${n}2`]; draws.push(`\\tkzDrawLine${opt(o, ['add=4 and 4'])}(${a[0]},${n}2)`)
        break
      }
      case 'PerpendicularBisector':
        defs.push(`\\tkzDefLine[mediator](${a[0]},${a[1]}) \\tkzGetPoints{${n}1}{${n}2}`)
        linePts[n] = [`${n}1`, `${n}2`]; draws.push(`\\tkzDrawLine${opt(o, ['add=2 and 2'])}(${n}1,${n}2)`)
        break
      case 'AngleBisector':
        defs.push(`\\tkzDefLine[bisector](${a.join(',')}) \\tkzGetPoint{${n}2}`)
        linePts[n] = [a[1], `${n}2`]; draws.push(`\\tkzDrawLine${opt(o, ['add=0 and 6'])}(${a[1]},${n}2)`)
        break
      case 'Polygon': draws.unshift(`\\tkzFillPolygon[fill=${o.opts.color && TKZ_COLORS[o.opts.color] ? TKZ_COLORS[o.opts.color] + '!25' : 'yellow!40'}](${a.join(',')})`); draws.push(`\\tkzDrawPolygon(${a.join(',')})`); break
      case 'Angle': {
        const ord = GEO.cross(GEO.sub(v.a, v.b), GEO.sub(v.c, v.b)) > 0 ? a.join(',') : [a[2], a[1], a[0]].join(',')
        draws.push(Math.abs(v.deg - 90) < 0.05 ? `\\tkzMarkRightAngle(${ord})` : `\\tkzMarkAngle[size=0.6](${ord}) \\tkzLabelAngle[pos=1](${ord}){$${v.deg.toFixed(1)}^\\circ$}`)
        break
      }
      case 'Distance': draws.push(`\\tkzLabelSegment[above](${a[0]},${a[1]}){$${v.d.toFixed(2)}$}`); break
    }
    // Hidden: defined, so what's made from it can be, but not drawn
    if (o.opts.hidden) draws.length = mark
    if (GEO.isPoint(v) && !o.opts.hidden && !o.opts.construction) points.push(n)
  }
  const ar = m.H / m.W, x0 = m.view.x - m.view.w / 2, x1 = m.view.x + m.view.w / 2, y0 = m.view.y - m.view.w * ar / 2, y1 = m.view.y + m.view.w * ar / 2
  const scale = Math.min(1, 12 / m.view.w)
  return ['% \\usepackage{tkz-euclide}', `\\begin{tikzpicture}${scale < 1 ? `[scale=${n2(scale)}]` : ''}`,
    `  \\tkzInit[xmin=${n2(x0)},xmax=${n2(x1)},ymin=${n2(y0)},ymax=${n2(y1)}] \\tkzClip`,
    ...defs.map(s => '  ' + s), ...draws.map(s => '  ' + s),
    points.length ? `  \\tkzDrawPoints(${points.join(',')})` : '', points.length ? `  \\tkzLabelPoints[above right](${points.join(',')})` : '',
    '\\end{tikzpicture}'].filter(Boolean).join('\n')
}
// tkz-euclide's first crossing (as pdflatex gives it with tkz-euclide 5.06):
// for two circles, the one on the left of the line from the first center to
// the second; for a line and a circle, the one clockwise of the ray from the
// center to the line's nearest point, whichever way the line runs
export function tkzOrder(u, v, cu, cw) {
  const cand = GEO.intersections(u, v).filter(Boolean)
  if (cand.length < 2) return cand
  if (cu && cw) return GEO.cross(GEO.sub(v.c, u.c), GEO.sub(cand[0], u.c)) > 0 ? cand : [cand[1], cand[0]]
  const l = cu ? v : u, c = (cu ? u : v).c, d = GEO.sub(l.q, l.p), t = GEO.dot(GEO.sub(c, l.p), d) / GEO.dot(d, d)
  const H = GEO.add(l.p, GEO.mul(d, t)), e = GEO.sub(H, c)
  if (GEO.len(e) < 1e-9) return cand
  return GEO.cross(e, GEO.sub(cand[0], H)) < 0 ? cand : [cand[1], cand[0]]
}

// ---------- Starting points: constructions a class does by hand, each with
// the measurement that shows its theorem
export const GEOMETRY_TEMPLATES = [
  { key: 'euclid', name: 'Euclid I.1: an equilateral triangle', script:
`A = Point(-2, -1.5)
B = Point(2, -1.5)
s = Segment(A, B)
c = Circle(A, B) {construction}
d = Circle(B, A) {construction}
C = Intersect(c, d, 0)
t = Polygon(A, B, C)
α = Angle(B, A, C)` },
  { key: 'bisector', name: 'Perpendicular bisector, by compass', script:
`A = Point(-3, -1)
B = Point(2.5, 0.5)
s = Segment(A, B)
c = Circle(A, B) {construction}
d = Circle(B, A) {construction}
P = Intersect(c, d, 0)
Q = Intersect(c, d, 1)
m = Line(P, Q) {color=red}
M = Intersect(m, s, 0)
α = Angle(B, M, P)` },
  { key: 'circum', name: 'Circumcircle', script:
`A = Point(-3, -2)
B = Point(3.2, -1.6)
C = Point(-0.6, 2.6)
t = Polygon(A, B, C)
f = PerpendicularBisector(A, B) {construction}
g = PerpendicularBisector(B, C) {construction}
h = PerpendicularBisector(C, A) {construction}
O = Intersect(f, g, 0)
k = Circle(O, A)` },
  { key: 'incircle', name: 'Incircle', script:
`A = Point(-3.4, -2)
B = Point(3.4, -2)
C = Point(0.6, 2.8)
t = Polygon(A, B, C)
f = AngleBisector(B, A, C) {construction}
g = AngleBisector(A, B, C) {construction}
I = Intersect(f, g, 0)
a = Line(A, B) {hidden}
p = Perpendicular(I, a) {construction}
H = Intersect(p, a, 0)
k = Circle(I, H)
ρ = Angle(I, H, B)` },
  { key: 'euler', name: 'Euler line', script:
`A = Point(-3.6, -2)
B = Point(3.4, -2)
C = Point(-1.2, 2.8)
t = Polygon(A, B, C)
M_a = Midpoint(B, C) {construction}
M_b = Midpoint(C, A) {construction}
ma = Segment(A, M_a) {construction}
mb = Segment(B, M_b) {construction}
G = Intersect(ma, mb, 0) {color=green}
ha = Perpendicular(A, B, C) {construction}
hb = Perpendicular(B, C, A) {construction}
H = Intersect(ha, hb, 0) {color=red}
f = PerpendicularBisector(A, B) {construction}
g = PerpendicularBisector(B, C) {construction}
O = Intersect(f, g, 0) {color=blue}
e = Line(O, H) {color=red}` },
  { key: 'thales', name: 'Thales’ theorem', script:
`A = Point(-3, -0.5)
B = Point(3, -0.5)
O = Midpoint(A, B)
c = Circle(O, B)
d = Segment(A, B)
C = PointOn(c, 2.1)
t = Polygon(A, B, C)
γ = Angle(A, C, B)` },
  { key: 'inscribed', name: 'Inscribed angle theorem', script:
`O = Point(0, 0)
R = Point(3, 0) {hidden}
c = Circle(O, R)
A = PointOn(c, 3.6)
B = PointOn(c, 5.9)
C = PointOn(c, 1.7)
s1 = Segment(C, A)
s2 = Segment(C, B)
s3 = Segment(O, A) {color=blue}
s4 = Segment(O, B) {color=blue}
γ = Angle(A, C, B)
θ = Angle(A, O, B) {color=blue}` },
  { key: 'tangents', name: 'Tangents from a point', script:
`O = Point(-1.5, 0)
R = Point(0.6, 0) {hidden}
c = Circle(O, R)
P = Point(3.5, 1)
M = Midpoint(O, P) {construction}
d = Circle(M, P) {construction}
T = Intersect(c, d, 0)
U = Intersect(c, d, 1)
f = Line(P, T) {color=red}
g = Line(P, U) {color=red}
r = Segment(O, T)
β = Angle(O, T, P)` },
  { key: 'blank', name: 'Blank', script: '' },
]

// A template as the element's settings, framed for a box of that size,
// built up a line a step
export function geometryFromTemplate(key, { dark = true, W = GEOMETRY_SIZE.w, H = GEOMETRY_SIZE.h } = {}) {
  const t = GEOMETRY_TEMPLATES.find(x => x.key === key) || GEOMETRY_TEMPLATES[0]
  const p = GEO.parse(t.script), vals = GEO.compute(p.objs)
  return {
    script: t.script, view: t.key === 'blank' ? { x: 0, y: 0, w: 12 } : fitView(p.objs, vals, W, H), theme: dark ? 'dark' : 'light',
    axes: false, grid: false, steps: stepsPerLine(p.objs, null), start: null, tidy: false, captions: true, stepStart: 1,
  }
}
export function defaultGeometry(dark = true) {
  return geometryFromTemplate('euclid', { dark })
}

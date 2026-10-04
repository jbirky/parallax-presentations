// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// What runs in a graph element's iframe: draws the graph on a canvas, and
// lets the audience pan, zoom, drag points, move sliders and play them.
// Like createMathParser, it has nothing from outside it (the page embeds its
// source): `P` is the parser, `G` the field numerics (graphFields.js),
// `config` the graph (graphPage.js graphConfig).
//
// Fields (vector fields, systems, slope fields) draw as arrows, streamlines,
// slope marks or moving particles, with their equilibria, separatrices,
// nullclines and paths; a click on the graph starts a path through it.
//
// Messages it takes from its parent: 'parallax-resize' (its slide is shown);
// { source: 'parallax-deck', type: 'graph-step', step } (the deck's step, for
// expressions that appear at a step); { source: 'parallax-graph-editor',
// type: 'config', config } (the editor's preview). It sends the editor
// { source: 'parallax-graph', type: 'view' | 'param' } when someone pans or
// moves a slider there, and the slide panel its thumbnail.

export function graphRuntime(P, G, config) {
  let C = config
  const THEMES = {
    light: {
      axis: '#2b2b2b', major: 'rgba(0,0,0,0.14)', minor: 'rgba(0,0,0,0.055)', text: '#3a3a3a',
      halo: 'rgba(255,255,255,0.85)', panel: 'rgba(255,255,255,0.94)', panelText: '#222', border: 'rgba(0,0,0,0.14)', accent: '#2d70b3',
      fg: '#1d2430', pos: '#cf5a1f', neg: '#2470cc', mid: 'rgba(255,255,255,0)', null1: '#388c46', null2: '#6042a6', path: '#2b2b2b',
    },
    dark: {
      axis: 'rgba(255,255,255,0.85)', major: 'rgba(255,255,255,0.16)', minor: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.8)',
      halo: 'rgba(18,18,28,0.8)', panel: 'rgba(24,24,36,0.9)', panelText: '#eee', border: 'rgba(255,255,255,0.16)', accent: '#6fa8ff',
      fg: '#eef1f6', pos: '#ff9759', neg: '#63a6f7', mid: 'rgba(0,0,0,0)', null1: '#4cc36a', null2: '#b18cff', path: 'rgba(255,255,255,0.9)',
    },
  }
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
  const MATH_FONT = '"Cambria Math", "Latin Modern Math", "STIX Two Math", "Times New Roman", serif'

  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;left:0;top:0;display:block;touch-action:none;'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  let W = 0, H = 0
  let theme = THEMES.light
  let analysis = null
  let values = {} // sliders' current values
  let view = null
  let step = 0
  let hover = null
  let playing = {} // name -> direction
  let snapshotSent = false
  let frame = 0
  let clicks = []   // paths started with a click: { x, y, field }
  let eqHover = null
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  // How much the deck, editor or preview enlarges this frame, which it
  // can't see (a CSS transform): it draws at that size to stay sharp
  let shownScale = 1
  // Canvas pixels per CSS pixel: the screen's density times that, and at
  // least 3 in a PDF; at most 4, which covers a 4K screen at density 1
  const density = () => Math.min(4, Math.max(1, (window.devicePixelRatio || 1) * (C.print ? Math.max(shownScale, 3) : shownScale)))
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

  const copyView = v => ({ xMin: +v.xMin, xMax: +v.xMax, yMin: +v.yMin, yMax: +v.yMax })
  const sameView = (a, b) => ['xMin', 'xMax', 'yMin', 'yMax'].every(k => Math.abs(a[k] - b[k]) < 1e-9 * Math.max(1, Math.abs(a[k])))

  function setConfig(next, keepState) {
    C = next
    theme = THEMES[C.theme] || THEMES.light
    analysis = P.analyze(C.expressions || [])
    const kept = values
    values = {}
    for (const it of analysis.items) {
      if (it.kind === 'param' && it.slider) values[it.name] = keepState && typeof kept[it.name] === 'number' && !C.editor ? kept[it.name] : it.literal
    }
    if (!keepState || C.editor) view = copyView(C.view)
    if (!keepState) clicks = []
    fieldGeo = null
    playing = {}
    for (const e of C.expressions || []) {
      const it = analysis.items.find(i => i.id === e.id)
      if (it && it.kind === 'param' && it.slider && e.slider && e.slider.play && !C.print) playing[it.name] = 1
    }
    step = C.showAll ? Infinity : step
    buildPanel()
    request()
  }

  // The view as drawn: with equal scales, y's range follows the shape
  function shown() {
    if (C.equalScale === false || !W || !H) return view
    const half = (view.xMax - view.xMin) * H / W / 2
    const mid = (view.yMin + view.yMax) / 2
    return { xMin: view.xMin, xMax: view.xMax, yMin: mid - half, yMax: mid + half }
  }

  function exprOf(it) { return (C.expressions || []).find(e => e.id === it.id) || {} }
  function visible(it) {
    const e = exprOf(it)
    if (e.hidden) return false
    return !(e.step > 0) || e.step <= step
  }

  // ── Numbers ──────────────────────────────────────────────────────────────
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)))
    const m = raw / p
    const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10
    return { step: nice * p, minor: nice === 2 ? 4 : 5 }
  }
  // The multiples of `stepSize` from lo to hi. Never more than a few hundred,
  // and never an endless loop: where k passes 2^53, k + 1 is k
  function ticksBetween(lo, hi, stepSize) {
    if (!(stepSize > 0) || !isFinite(lo) || !isFinite(hi)) return []
    const first = Math.ceil(lo / stepSize), last = Math.floor(hi / stepSize)
    if (!(last - first < 500)) return []
    const out = []
    for (let i = 0; i <= last - first; i++) out.push((first + i) * stepSize)
    return out
  }
  function tickLabel(v, stepSize) {
    if (Math.abs(v) < stepSize * 1e-6) return '0'
    if (stepSize >= 1e6 || stepSize < 1e-5) return v.toExponential(2).replace(/\.?0+e/, 'e').replace('-', '−')
    const decimals = Math.max(0, -Math.floor(Math.log10(stepSize) + 1e-9))
    return (Math.round(v / stepSize) * stepSize).toFixed(decimals).replace('-', '−')
  }
  function fmt(v) {
    if (!isFinite(v)) return 'undefined'
    if (v !== 0 && (Math.abs(v) >= 1e6 || Math.abs(v) < 1e-4)) return v.toExponential(3).replace('-', '−')
    return String(parseFloat(v.toPrecision(4))).replace('-', '−')
  }
  function prettyName(name) {
    const greek = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', lambda: 'λ', sigma: 'σ', omega: 'ω', phi: 'φ', rho: 'ρ', theta: 'θ' }
    const i = name.indexOf('_')
    const base = i < 0 ? name : name.slice(0, i)
    return { base: greek[base] || base, sub: i < 0 ? '' : name.slice(i + 1) }
  }

  // ── Drawing ──────────────────────────────────────────────────────────────
  let X0, X1, Y0, Y1
  const sx = x => (x - X0) / (X1 - X0) * W
  const sy = y => H - (y - Y0) / (Y1 - Y0) * H
  const wx = px => X0 + px / W * (X1 - X0)
  const wy = py => Y0 + (H - py) / H * (Y1 - Y0)
  const clampPx = v => (v > 1e5 ? 1e5 : v < -1e5 ? -1e5 : v)

  function env() {
    const e = P.paramValues(analysis, values)
    e.x = 0; e.y = 0; e.t = 0; e.theta = 0
    return e
  }

  function draw() {
    if (!W || !H || !analysis) return
    const v = shown()
    X0 = v.xMin; X1 = v.xMax; Y0 = v.yMin; Y1 = v.yMax
    ctx.clearRect(0, 0, W, H)
    if (C.background && C.background !== 'transparent') {
      ctx.fillStyle = C.background
      ctx.fillRect(0, 0, W, H)
    }
    const E = env()
    const ticks = gridAndAxes()
    const items = analysis.items.filter(visible)
    const fg = fieldGeometry(E)
    const fieldsDo = fn => { try { fn() } catch (e) { ctx.globalAlpha = 1; ctx.setLineDash([]) } }
    fieldsDo(() => drawShades(fg))
    // One expression that fails to draw leaves the others drawn
    const each = (kinds, fn) => {
      for (const it of items) {
        if (!kinds.includes(it.kind)) continue
        try { fn(it) } catch (e) { ctx.globalAlpha = 1; ctx.setLineDash([]) }
      }
    }
    each(['region'], it => drawRegion(it, E))
    fieldsDo(() => drawFieldMarks(fg, E))
    each(['explicit', 'function', 'polar', 'parametric', 'implicit'], it => {
      if (it.kind === 'explicit' || (it.kind === 'function' && it.graph)) strokeRuns(explicitRuns(it.f, E, it.axis || 'y'), exprOf(it))
      else if (it.kind === 'polar') strokeRuns(curveRuns(it, E, 'theta'), exprOf(it))
      else if (it.kind === 'parametric') strokeRuns(curveRuns(it, E, 't'), exprOf(it))
      else if (it.kind === 'implicit') strokeRuns(contour(it.F, E), exprOf(it))
    })
    fieldsDo(() => drawFieldPaths(fg, E))
    axisNumbers(ticks)
    axisLabels()
    each(['point'], it => drawPoint(it, E))
    fieldsDo(() => drawFieldPoints(fg, E))
    fieldsDo(() => drawMoving(fg))
    if (hover) drawHover()
    if (eqHover) drawEquilibriumCard(eqHover)
    if (C.snapshotKey && !snapshotSent && analysis.items.length) {
      snapshotSent = true
      try { parent.postMessage({ source: 'parallax-embed', type: 'snapshot', key: C.snapshotKey, dataUrl: canvas.toDataURL('image/png') }, '*') } catch (e) { /* keeps its placeholder */ }
    }
  }

  function gridAndAxes() {
    const px = 90 // about this far apart, major lines
    const tx = niceStep((X1 - X0) * px / W)
    const ty = C.equalScale === false ? niceStep((Y1 - Y0) * px / H) : tx
    const line = (x0, y0, x1, y1) => { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1) }
    if (C.grid !== false) {
      ctx.lineWidth = 1
      for (const [t, major] of [[tx.step / tx.minor, false], [tx.step, true]]) {
        ctx.beginPath()
        ctx.strokeStyle = major ? theme.major : theme.minor
        for (const v of ticksBetween(X0, X1, t)) { const p = Math.round(sx(v)) + 0.5; line(p, 0, p, H) }
        const u = major ? ty.step : ty.step / ty.minor
        for (const v of ticksBetween(Y0, Y1, u)) { const p = Math.round(sy(v)) + 0.5; line(0, p, W, p) }
        ctx.stroke()
      }
    }
    if (C.axes !== false) {
      ctx.beginPath()
      ctx.strokeStyle = theme.axis
      ctx.lineWidth = 1.25
      if (X0 <= 0 && X1 >= 0) { const p = Math.round(sx(0)) + 0.5; line(p, 0, p, H) }
      if (Y0 <= 0 && Y1 >= 0) { const p = Math.round(sy(0)) + 0.5; line(0, p, W, p) }
      ctx.stroke()
    }
    return { tx, ty }
  }

  function haloText(text, x, y, align, baseline, font, color) {
    ctx.font = font
    ctx.textAlign = align
    ctx.textBaseline = baseline
    ctx.lineJoin = 'round'
    ctx.lineWidth = 3
    ctx.strokeStyle = theme.halo
    ctx.strokeText(text, x, y)
    ctx.fillStyle = color || theme.text
    ctx.fillText(text, x, y)
  }

  function axisNumbers({ tx, ty }) {
    if (C.axisNumbers === false || C.axes === false) return
    const font = '12px ' + FONT
    // Numbers sit by the axis, or along the edge it's past
    const ay = Math.min(Math.max(sy(0), 2), H - 18)
    const ax = Math.min(Math.max(sx(0), 30), W - 4)
    const originShown = X0 <= 0 && X1 >= 0 && Y0 <= 0 && Y1 >= 0
    for (const v of ticksBetween(X0, X1, tx.step)) {
      if (Math.abs(v) < tx.step * 1e-6) continue
      const p = sx(v)
      if (p < 12 || p > W - 12) continue
      haloText(tickLabel(v, tx.step), p, ay + 4, 'center', 'top', font)
    }
    for (const v of ticksBetween(Y0, Y1, ty.step)) {
      if (Math.abs(v) < ty.step * 1e-6) continue
      const p = sy(v)
      if (p < 10 || p > H - 10) continue
      haloText(tickLabel(v, ty.step), ax - 5, p, 'right', 'middle', font)
    }
    if (originShown) haloText('0', sx(0) - 5, sy(0) + 4, 'right', 'top', font)
  }

  function axisLabels() {
    const font = 'italic 16px ' + MATH_FONT
    if (C.xLabel) haloText(C.xLabel, W - 8, Math.min(Math.max(sy(0), 20), H - 24) - 6, 'right', 'bottom', font)
    if (C.yLabel) haloText(C.yLabel, Math.min(Math.max(sx(0), 8), W - 40) + 8, 8, 'left', 'top', font)
  }

  function styleFor(e) {
    ctx.strokeStyle = e.color || '#c74440'
    ctx.lineWidth = e.width || 2.5
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const w = ctx.lineWidth
    ctx.setLineDash(e.style === 'dashed' ? [w * 3.2, w * 2.4] : e.style === 'dotted' ? [0.01, w * 2.2] : [])
  }

  function strokeRuns(runs, e) {
    styleFor(e)
    ctx.beginPath()
    for (const run of runs) {
      if (run.length < 2) continue
      ctx.moveTo(run[0][0], run[0][1])
      for (let i = 1; i < run.length; i++) ctx.lineTo(run[i][0], run[i][1])
    }
    ctx.stroke()
    ctx.setLineDash([])
  }

  // y = f(x) (or x = f(y)) one sample a pixel. Where it jumps, halving the
  // gap tells a steep curve (the jump shrinks) from a break (tan x, floor x:
  // it doesn't), and the halving's points carry each side up to the break.
  function explicitRuns(f, E, axis) {
    const horiz = axis === 'y'
    // A sample a screen pixel, up to two a CSS pixel
    const k = Math.min(2, density())
    const n = Math.ceil((horiz ? W : H) * k)
    const toWorld = horiz ? px => wx(px / k) : px => wy(px / k)
    const toPx = horiz ? sy : sx
    const key = horiz ? 'x' : 'y'
    const at = u => { E[key] = u; return f(E) }
    const place = (u, val) => (horiz ? [sx(u), clampPx(sy(val))] : [clampPx(sx(val)), sy(u)])
    const runs = []
    let run = [], pu = 0, pv = NaN
    for (let i = 0; i <= n; i++) {
      const u = toWorld(i)
      const val = at(u)
      if (!isFinite(val)) {
        if (run.length) { runs.push(run); run = [] }
        pv = NaN
        continue
      }
      if (isFinite(pv) && Math.abs(toPx(val) - toPx(pv)) > 24) {
        let a = pu, b = u, fa = pv, fb = val, broken = false
        const left = [], right = []
        for (let k = 0; k < 30; k++) {
          const m = (a + b) / 2
          const fm = at(m)
          if (!isFinite(fm)) { broken = true; break }
          if (Math.abs(fm - fa) > Math.abs(fb - fm)) { b = m; fb = fm; right.push(place(m, fm)) } else { a = m; fa = fm; left.push(place(m, fm)) }
        }
        if (broken || Math.abs(toPx(fb) - toPx(fa)) > 2) {
          run.push(...left)
          runs.push(run)
          run = right.reverse()
        }
      }
      run.push(place(u, val))
      pv = val
      pu = u
    }
    if (run.length) runs.push(run)
    return runs
  }

  // Parametric and polar curves over their own range
  function curveRuns(it, E, key) {
    const e = exprOf(it)
    const lo = isFinite(+e.min) && e.min !== '' && e.min != null ? +e.min : 0
    const hi = isFinite(+e.max) && e.max !== '' && e.max != null ? +e.max : 2 * Math.PI
    const n = Math.min(20000, Math.max(800, Math.ceil(Math.abs(hi - lo) * 150)))
    const runs = []
    let run = []
    let prev = null
    for (let i = 0; i <= n; i++) {
      E[key] = lo + (hi - lo) * i / n
      let x, y
      if (key === 't') { x = it.fx(E); y = it.fy(E) } else { const r = it.f(E); x = r * Math.cos(E.theta); y = r * Math.sin(E.theta) }
      if (!isFinite(x) || !isFinite(y)) { if (run.length) runs.push(run); run = []; prev = null; continue }
      const p = [clampPx(sx(x)), clampPx(sy(y))]
      if (prev && Math.abs(p[0] - prev[0]) + Math.abs(p[1] - prev[1]) > W + H) { runs.push(run); run = [] }
      run.push(p)
      prev = p
    }
    if (run.length) runs.push(run)
    return runs
  }

  // Where F(x, y) = 0, by marching squares, joined into lines. A sign change
  // across a pole (1/x = y at x = 0) isn't a crossing.
  function contour(F, E, cellPx) {
    // Cells about 6 screen pixels across, 2 to 4 CSS pixels
    const cell = cellPx || clamp(6 / density(), 2, 4)
    const nx = Math.ceil(W / cell) + 1, ny = Math.ceil(H / cell) + 1
    const vals = new Float64Array(nx * ny)
    for (let j = 0; j < ny; j++) {
      E.y = wy(j * cell)
      for (let i = 0; i < nx; i++) { E.x = wx(i * cell); vals[j * nx + i] = F(E) }
    }
    const points = new Map()
    const cross = (key, i0, j0, i1, j1) => {
      if (points.has(key)) return points.get(key)
      const a = vals[j0 * nx + i0], b = vals[j1 * nx + i1]
      const t = a / (a - b)
      const px = (i0 + (i1 - i0) * t) * cell, py = (j0 + (j1 - j0) * t) * cell
      E.x = wx(px); E.y = wy(py)
      const fp = F(E)
      const p = Math.abs(fp) < 0.5 * (Math.abs(a) + Math.abs(b)) ? [px, py] : null
      points.set(key, p)
      return p
    }
    const edges = new Map() // edge key -> segment indices
    const segs = []
    const add = (k1, p1, k2, p2) => {
      if (!p1 || !p2) return
      const s = segs.length
      segs.push([k1, p1, k2, p2])
      for (const k of [k1, k2]) { if (!edges.has(k)) edges.set(k, []); edges.get(k).push(s) }
    }
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = vals[j * nx + i], b = vals[j * nx + i + 1], c = vals[(j + 1) * nx + i + 1], d = vals[(j + 1) * nx + i]
        if (!(isFinite(a) && isFinite(b) && isFinite(c) && isFinite(d))) continue
        const idx = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0)
        if (idx === 0 || idx === 15) continue
        const T = () => ['h' + (j * nx + i), cross('h' + (j * nx + i), i, j, i + 1, j)]
        const B = () => ['h' + ((j + 1) * nx + i), cross('h' + ((j + 1) * nx + i), i, j + 1, i + 1, j + 1)]
        const L = () => ['v' + (j * nx + i), cross('v' + (j * nx + i), i, j, i, j + 1)]
        const R = () => ['v' + (j * nx + i + 1), cross('v' + (j * nx + i + 1), i + 1, j, i + 1, j + 1)]
        const seg = (e1, e2) => { const p = e1(), q = e2(); add(p[0], p[1], q[0], q[1]) }
        switch (idx) {
          case 1: case 14: seg(L, T); break
          case 2: case 13: seg(T, R); break
          case 3: case 12: seg(L, R); break
          case 4: case 11: seg(R, B); break
          case 6: case 9: seg(T, B); break
          case 7: case 8: seg(L, B); break
          case 5: case 10: {
            E.x = wx((i + 0.5) * cell); E.y = wy((j + 0.5) * cell)
            const centerPositive = F(E) > 0
            if ((idx === 5) === centerPositive) { seg(T, R); seg(B, L) } else { seg(L, T); seg(R, B) }
            break
          }
        }
      }
    }
    // Segments sharing an edge point, walked into lines
    const used = new Uint8Array(segs.length)
    const runs = []
    const walk = (s, fromKey) => {
      const out = []
      let key = fromKey
      while (s >= 0 && !used[s]) {
        used[s] = 1
        const [k1, p1, k2, p2] = segs[s]
        const [nextKey, p] = k1 === key ? [k2, p2] : [k1, p1]
        out.push(p)
        key = nextKey
        s = (edges.get(key) || []).find(o => !used[o])
        if (s === undefined) s = -1
      }
      return out
    }
    const order = [...edges.entries()].filter(([, list]) => list.length === 1).map(([k, list]) => [list[0], k])
    for (let s = 0; s < segs.length; s++) order.push([s, segs[s][0]])
    for (const [s, key] of order) {
      if (used[s]) continue
      const start = segs[s][0] === key ? segs[s][1] : segs[s][3]
      runs.push([start].concat(walk(s, key)))
    }
    return runs
  }

  function fillStyle(e) {
    ctx.fillStyle = e.color || '#c74440'
    ctx.globalAlpha = 0.28
  }

  function drawRegion(it, E) {
    const e = exprOf(it)
    if (it.axis) {
      // y < f(x): between the curve and the edge, where f is defined
      const runs = explicitRuns(it.f, E, it.axis)
      const horiz = it.axis === 'y'
      const edge = horiz ? (it.side === 'below' ? H + 2 : -2) : (it.side === 'below' ? -2 : W + 2)
      fillStyle(e)
      ctx.beginPath()
      for (const run of runs) {
        if (run.length < 2) continue
        ctx.moveTo(run[0][0], run[0][1])
        for (const p of run) ctx.lineTo(p[0], p[1])
        const last = run[run.length - 1], first = run[0]
        if (horiz) { ctx.lineTo(last[0], edge); ctx.lineTo(first[0], edge) } else { ctx.lineTo(edge, last[1]); ctx.lineTo(edge, first[1]) }
        ctx.closePath()
      }
      ctx.fill()
      ctx.globalAlpha = 1
      strokeRuns(runs, Object.assign({}, e, { style: it.strict ? 'dashed' : e.style }))
      return
    }
    // Anything else: every cell where all the parts hold, then each boundary
    const cell = clamp(4.5 / density(), 1.5, 3)
    fillStyle(e)
    ctx.beginPath()
    for (let py = 0; py < H; py += cell) {
      E.y = wy(py + cell / 2)
      let start = -1
      for (let px = 0; px <= W; px += cell) {
        E.x = wx(px + cell / 2)
        const inside = px < W && it.comps.every(c => c.test(E))
        if (inside && start < 0) start = px
        if (!inside && start >= 0) { ctx.rect(start, py, px - start, cell); start = -1 }
      }
    }
    ctx.fill()
    ctx.globalAlpha = 1
    for (const c of it.comps) strokeRuns(contour(c.g, E), Object.assign({}, e, { style: c.strict ? 'dashed' : e.style }))
  }

  function pointAt(it, E) {
    const x = it.fx(E), y = it.fy(E)
    return isFinite(x) && isFinite(y) ? { x, y, px: sx(x), py: sy(y) } : null
  }

  function drawPoint(it, E) {
    const p = pointAt(it, E)
    if (!p) return
    const e = exprOf(it)
    ctx.beginPath()
    ctx.arc(p.px, p.py, (e.width || 2.5) + 2.5, 0, Math.PI * 2)
    ctx.fillStyle = e.color || '#c74440'
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = theme.halo
    ctx.stroke()
    if (it.dragX || it.dragY) {
      ctx.beginPath()
      ctx.arc(p.px, p.py, (e.width || 2.5) + 8, 0, Math.PI * 2)
      ctx.globalAlpha = 0.25
      ctx.fill()
      ctx.globalAlpha = 1
    }
    const label = e.label ? e.label : e.showCoords ? '(' + fmt(p.x) + ', ' + fmt(p.y) + ')' : ''
    if (label) haloText(label, p.px + 9, p.py - 7, 'left', 'bottom', '13px ' + FONT, e.color)
  }

  function drawHover() {
    const { px, py, x, y, color } = hover
    ctx.beginPath()
    ctx.arc(px, py, 4.5, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    const text = '(' + fmt(x) + ', ' + fmt(y) + ')'
    ctx.font = '12px ' + FONT
    const w = ctx.measureText(text).width + 12
    const bx = Math.min(Math.max(px + 10, 2), W - w - 2), by = Math.max(py - 30, 2)
    ctx.fillStyle = theme.panel
    ctx.strokeStyle = theme.border
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.rect(bx, by, w, 22)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = theme.panelText
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, bx + 6, by + 11)
  }


  // ── Fields ───────────────────────────────────────────────────────────────
  // How a field line draws unless its options say otherwise
  const FIELD_DEFAULTS = {
    vector: { draw: 'arrows', density: 'normal', length: 'scaled', colorBy: 'magnitude', shade: 'none', equilibria: false, separatrices: false, nullclines: false, traceDet: false, clicks: true },
    system: { draw: 'streamlines', density: 'normal', length: 'scaled', colorBy: 'line', shade: 'none', equilibria: true, separatrices: true, nullclines: false, traceDet: false, clicks: true },
    slope: { draw: 'slopes', density: 'normal', length: 'equal', colorBy: 'line', shade: 'none', equilibria: false, separatrices: false, nullclines: false, traceDet: false, clicks: true },
  }
  const GRID_PX = { sparse: 54, normal: 38, dense: 27 }
  const STREAM_PX = { sparse: 34, normal: 24, dense: 16 }
  const FIELD_KINDS = ['vector', 'system', 'slope']
  function fieldOptions(e, kind) {
    const d = FIELD_DEFAULTS[kind], f = e.field || {}, o = {}
    for (const k in d) o[k] = f[k] === undefined ? d[k] : f[k]
    // Particles stand still in a PDF and with reduced motion: streamlines instead
    if (o.draw === 'particles' && (C.print || reduceMotion)) o.draw = 'streamlines'
    return o
  }
  // An overlay (equilibria, nullclines…) is shown from its own step, if it has one
  function overlayShown(e, o, key) {
    if (!o[key]) return false
    const at = e.field && e.field.steps ? Number(e.field.steps[key]) : 0
    return !(at > 0) || at <= step
  }
  let fieldGeo = null, fieldKey = ''
  // What the fields draw, worked out again only when the view, size, sliders,
  // lines, step or clicked paths change
  function fieldGeometry(E) {
    const fieldItems = analysis.items.filter(it => FIELD_KINDS.includes(it.kind) && visible(it))
    const pathItems = analysis.items.filter(it => (it.kind === 'trajectory' || it.kind === 'solution') && visible(it))
    if (!fieldItems.length) { fieldGeo = null; return null }
    const box = { xMin: X0, xMax: X1, yMin: Y0, yMax: Y1 }
    const key = JSON.stringify([box, W, H, step, values, C.expressions, clicks])
    if (fieldGeo && key === fieldKey) return fieldGeo
    fieldKey = key
    const out = [0, 0], kx = W / (X1 - X0), ky = H / (Y1 - Y0)
    const fields = fieldItems.map(it => {
      const e = exprOf(it), o = fieldOptions(e, it.kind)
      const F = it.kind === 'slope' ? (env, x, y, r) => { r[0] = 1; r[1] = it.f(env, x, y) } : it.F
      const f = { it, e, o, F, color: e.color || '#c74440' }
      // A typical strength (85th percentile), for arrows' lengths and colors
      const mags = []
      for (let i = 0; i < 24; i++) for (let j = 0; j < 16; j++) {
        F(E, wx((i + 0.5) * W / 24), wy((j + 0.5) * H / 16), out)
        const m = Math.hypot(out[0], out[1])
        if (isFinite(m)) mags.push(m)
      }
      mags.sort((a, b) => a - b)
      f.mRef = (mags.length && (mags[Math.floor(mags.length * 0.85)] || mags[mags.length - 1])) || 1
      f.V = (px, py, r) => { F(E, wx(px), wy(py), out); r[0] = out[0] * kx; r[1] = -out[1] * ky }
      if (o.draw === 'streamlines') f.lines = G.streamlines(f.V, W, H, STREAM_PX[o.density] || 24, { budget: 3e5 })
      if (it.kind !== 'slope' && (overlayShown(e, o, 'equilibria') || overlayShown(e, o, 'separatrices') || overlayShown(e, o, 'traceDet'))) {
        f.eq = G.equilibria(F, E, box)
        if (overlayShown(e, o, 'separatrices')) f.seps = [].concat(...f.eq.map(q => G.separatrices(F, E, q, box)))
      }
      if (it.kind === 'vector' && o.shade !== 'none') f.shade = shadeGrid(F, E, o.shade)
      return f
    })
    const fieldOf = id => fields.find(f => f.it.id === id)
    const paths = []
    for (const it of pathItems) {
      const owner = fieldOf(it.owner)
      if (!owner) continue
      const e = exprOf(it)
      if (it.kind === 'solution') {
        const x0 = it.x0(E), y0 = it.y0(E)
        if (isFinite(x0) && isFinite(y0)) paths.push({ it, e, x0, y0, color: e.color || owner.color, solution: G.solution(owner.it.f, E, x0, y0, box) })
        continue
      }
      const x0 = it.px(E), y0 = it.py(E), dir = (e.traj && e.traj.dir) || 'forward', runs = []
      if (!isFinite(x0) || !isFinite(y0)) continue
      if (dir !== 'backward') runs.push(G.trajectory(owner.F, E, x0, y0, 1, box, { tMax: 400 }))
      if (dir !== 'forward') runs.push(G.trajectory(owner.F, E, x0, y0, -1, box, { tMax: 400 }))
      paths.push({ it, e, x0, y0, runs, color: e.color || owner.color, moving: !!(e.traj && e.traj.moving) })
    }
    const clicked = C.print ? [] : clicks.map(c => {
      const f = fieldOf(c.field)
      if (!f) return null
      if (f.it.kind === 'slope') return { x0: c.x, y0: c.y, color: theme.path, click: true, solution: G.solution(f.it.f, E, c.x, c.y, box) }
      return { x0: c.x, y0: c.y, color: theme.path, click: true, runs: [G.trajectory(f.F, E, c.x, c.y, 1, box, { tMax: 400 }), G.trajectory(f.F, E, c.x, c.y, -1, box, { tMax: 400 })] }
    }).filter(Boolean)
    fieldGeo = { fields, paths, clicked }
    return fieldGeo
  }
  // Divergence, curl or strength on a grid of 8 px cells
  function shadeGrid(F, E, what) {
    const cell = 8, nx = Math.ceil(W / cell), ny = Math.ceil(H / cell), vals = new Float64Array(nx * ny), a = [0, 0], b = [0, 0], all = []
    const hx = (X1 - X0) * 1e-4, hy = (Y1 - Y0) * 1e-4
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = wx((i + 0.5) * cell), y = wy((j + 0.5) * cell)
      let v
      if (what === 'magnitude') { F(E, x, y, a); v = Math.hypot(a[0], a[1]) } else {
        F(E, x + hx, y, a); F(E, x - hx, y, b)
        const dPdx = (a[0] - b[0]) / (2 * hx), dQdx = (a[1] - b[1]) / (2 * hx)
        F(E, x, y + hy, a); F(E, x, y - hy, b)
        const dPdy = (a[0] - b[0]) / (2 * hy), dQdy = (a[1] - b[1]) / (2 * hy)
        v = what === 'divergence' ? dPdx + dQdy : dQdx - dPdy
      }
      vals[j * nx + i] = v
      if (isFinite(v)) all.push(Math.abs(v))
    }
    all.sort((p, q) => p - q)
    return { cell, nx, ny, vals, ref: all[Math.floor(all.length * 0.95)] || 1, what }
  }
  // A pixel a cell, scaled up smoothly
  const shadeCanvas = document.createElement('canvas'), shadeCtx = shadeCanvas.getContext('2d')
  function rgbOf(color) {
    shadeCtx.fillStyle = '#000'
    shadeCtx.fillStyle = color
    const c = shadeCtx.fillStyle
    if (c[0] === '#') { const n = parseInt(c.slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
    const m = /(\d+)\D+(\d+)\D+(\d+)/.exec(c)
    return m ? [+m[1], +m[2], +m[3]] : [128, 128, 128]
  }
  function drawShades(g) {
    if (!g) return
    for (const f of g.fields) {
      const s = f.shade
      if (!s) continue
      shadeCanvas.width = s.nx
      shadeCanvas.height = s.ny
      const img = shadeCtx.createImageData(s.nx, s.ny), pos = rgbOf(s.what === 'magnitude' ? f.color : theme.pos), neg = rgbOf(theme.neg)
      for (let k = 0; k < s.nx * s.ny; k++) {
        const v = s.vals[k]
        if (!isFinite(v)) continue
        const t = Math.max(-1, Math.min(1, v / s.ref)), c = t > 0 || s.what === 'magnitude' ? pos : neg
        img.data[4 * k] = c[0]; img.data[4 * k + 1] = c[1]; img.data[4 * k + 2] = c[2]
        img.data[4 * k + 3] = Math.round(255 * (s.what === 'magnitude' ? 0.42 * Math.abs(t) : 0.5 * Math.pow(Math.abs(t), 0.8)))
      }
      shadeCtx.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(shadeCanvas, 0, 0, s.nx * s.cell, s.ny * s.cell)
    }
  }
  function arrowHead(x, y, ux, uy, size) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - ux * size - uy * size * 0.55, y - uy * size + ux * size * 0.55)
    ctx.lineTo(x - ux * size + uy * size * 0.55, y - uy * size - ux * size * 0.55)
    ctx.closePath()
    ctx.fill()
  }
  // Arrows, slope marks or streamlines
  function drawFieldMarks(g, E) {
    if (!g) return
    const out = [0, 0], kx = W / (X1 - X0), ky = H / (Y1 - Y0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const f of g.fields) {
      const o = f.o, s = GRID_PX[o.density] || 38
      ctx.strokeStyle = f.color
      ctx.fillStyle = f.color
      if (o.draw === 'arrows') {
        ctx.lineWidth = 1.7
        for (let py = s / 2; py < H; py += s) for (let px = s / 2; px < W; px += s) {
          f.F(E, wx(px), wy(py), out)
          const vx = out[0] * kx, vy = -out[1] * ky, m = Math.hypot(out[0], out[1]), pm = Math.hypot(vx, vy)
          if (!(pm > 0) || !isFinite(pm)) continue
          const rel = Math.min(1, m / f.mRef), L = s * 0.8 * (o.length === 'scaled' ? Math.max(0.18, rel) : 1)
          const ux = vx / pm, uy = vy / pm, head = Math.max(3.5, Math.min(7, L * 0.32))
          ctx.globalAlpha = o.colorBy === 'magnitude' ? 0.28 + 0.72 * rel : 1
          ctx.beginPath()
          ctx.moveTo(px - ux * L / 2, py - uy * L / 2)
          ctx.lineTo(px + ux * (L / 2 - head * 0.6), py + uy * (L / 2 - head * 0.6))
          ctx.stroke()
          arrowHead(px + ux * L / 2, py + uy * L / 2, ux, uy, head)
        }
      } else if (o.draw === 'slopes') {
        ctx.lineWidth = 1.6
        ctx.globalAlpha = 0.8
        ctx.beginPath()
        for (let py = s / 2; py < H; py += s) for (let px = s / 2; px < W; px += s) {
          const m = f.it.f(E, wx(px), wy(py))
          if (!isFinite(m)) continue
          const vx = kx, vy = -m * ky, pm = Math.hypot(vx, vy), L = s * 0.62
          ctx.moveTo(px - vx / pm * L / 2, py - vy / pm * L / 2)
          ctx.lineTo(px + vx / pm * L / 2, py + vy / pm * L / 2)
        }
        ctx.stroke()
      } else if (o.draw === 'streamlines' && f.lines) {
        ctx.lineWidth = 1.25
        for (const l of f.lines) {
          const pts = l.pts
          if (o.colorBy === 'magnitude') {
            for (let i = 1; i < pts.length; i++) {
              f.F(E, wx(pts[i][0]), wy(pts[i][1]), out)
              ctx.globalAlpha = 0.25 + 0.7 * Math.min(1, Math.hypot(out[0], out[1]) / f.mRef)
              ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke()
            }
          } else {
            ctx.globalAlpha = 0.62
            ctx.beginPath()
            ctx.moveTo(pts[0][0], pts[0][1])
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
            ctx.stroke()
          }
          // Arrowheads along it, with the flow
          ctx.globalAlpha = 0.85
          let acc = 0, next = 130 * 0.45
          for (let k = 1; k < pts.length; k++) {
            const dx = pts[k][0] - pts[k - 1][0], dy = pts[k][1] - pts[k - 1][1], d = Math.hypot(dx, dy)
            acc += d
            if (acc >= next && d > 0) { arrowHead(pts[k][0], pts[k][1], dx / d, dy / d, 5.5); next += 130 }
          }
        }
      }
      ctx.globalAlpha = 1
    }
  }
  // A path in graph coordinates, with arrows the way time runs
  function strokePath(run, color, width, alpha) {
    const pts = run.pts
    if (!pts || pts.length < 2) return
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.globalAlpha = alpha
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(clampPx(sx(pts[0][0])), clampPx(sy(pts[0][1])))
    for (let i = 1; i < pts.length; i++) ctx.lineTo(clampPx(sx(pts[i][0])), clampPx(sy(pts[i][1])))
    ctx.stroke()
    const forward = pts[pts.length - 1][2] >= pts[0][2]
    let acc = 0, next = 60
    for (let k = 1; k < pts.length; k++) {
      const x0 = sx(pts[k - 1][0]), y0 = sy(pts[k - 1][1]), x1 = sx(pts[k][0]), y1 = sy(pts[k][1]), d = Math.hypot(x1 - x0, y1 - y0)
      if (x1 < 0 || x1 > W || y1 < 0 || y1 > H) continue
      acc += d
      if (acc >= next && d > 0) { const s = forward ? 1 : -1; arrowHead(x1, y1, s * (x1 - x0) / d, s * (y1 - y0) / d, 7); next += 120 }
    }
    ctx.globalAlpha = 1
  }
  // Nullclines, separatrices, paths and solutions
  function drawFieldPaths(g, E) {
    if (!g) return
    const out = [0, 0]
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const f of g.fields) {
      if (f.it.kind !== 'slope' && overlayShown(f.e, f.o, 'nullclines')) {
        strokeRuns(contour(env => { f.F(env, env.x, env.y, out); return out[0] }, E), { color: theme.null1, style: 'dashed', width: 2 })
        strokeRuns(contour(env => { f.F(env, env.x, env.y, out); return out[1] }, E), { color: theme.null2, style: 'dashed', width: 2 })
        E.x = 0; E.y = 0
      }
      for (const sep of f.seps || []) strokePath(sep, f.color, 2.6, 1)
    }
    for (const p of g.paths.concat(g.clicked)) {
      if (p.solution) {
        ctx.strokeStyle = p.color
        ctx.lineWidth = p.click ? 2 : (p.e.width || 2.5)
        ctx.beginPath()
        p.solution.forEach((q, i) => (i ? ctx.lineTo(sx(q[0]), clampPx(sy(q[1]))) : ctx.moveTo(sx(q[0]), clampPx(sy(q[1])))))
        ctx.stroke()
      } else for (const r of p.runs) strokePath(r, p.color, p.click ? 2 : (p.e.width || 2.5), p.click ? 0.9 : 1)
    }
  }
  // Equilibria, paths' starting points, keys and the trace–determinant plane
  function drawFieldPoints(g) {
    if (!g) return
    for (const p of g.paths.concat(g.clicked)) {
      const x = sx(p.x0), y = sy(p.y0), drag = p.it && (p.it.dragX || p.it.dragY)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(x, y, p.click ? 3.5 : drag ? 6 : 4.5, 0, Math.PI * 2)
      ctx.fill()
      if (drag) {
        ctx.globalAlpha = 0.25
        ctx.beginPath()
        ctx.arc(x, y, 11, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }
    for (const f of g.fields) if (f.eq && overlayShown(f.e, f.o, 'equilibria')) for (const q of f.eq) marker(q)
    let keyY = 10
    for (const f of g.fields) {
      if (f.it.kind !== 'slope' && overlayShown(f.e, f.o, 'nullclines')) {
        const polar = f.it.polar
        keyY = nullclineKey(keyY, [[theme.null1, polar ? 'ẋ = 0' : 'x′ = 0'], [theme.null2, polar ? 'ẏ = 0' : 'y′ = 0']])
      }
      if (f.shade && f.shade.what !== 'magnitude') keyY = shadeKey(keyY, f.shade.what)
    }
    const td = g.fields.find(f => f.eq && overlayShown(f.e, f.o, 'traceDet'))
    if (td) traceDet(td)
  }
  // Filled: attracts. Open: repels. Half filled: a saddle. A dot in a ring: a center
  function marker(q) {
    const x = sx(q.x), y = sy(q.y), r = 6.5
    if (x < -r || x > W + r || y < -r || y > H + r) return
    ctx.lineWidth = 2.2
    ctx.strokeStyle = theme.fg
    ctx.fillStyle = C.background && C.background !== 'transparent' ? C.background : theme.halo
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = theme.fg
    if (/^stable/.test(q.kind)) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill() }
    else if (q.kind === 'saddle') { ctx.beginPath(); ctx.arc(x, y, r, Math.PI / 2, 3 * Math.PI / 2); ctx.closePath(); ctx.fill() }
    else if (q.kind === 'center') { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill() }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
  }
  function nullclineKey(y, entries) {
    let x = 10
    ctx.font = 'italic 14px ' + MATH_FONT
    for (const [color, text] of entries) {
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.setLineDash([7, 5])
      ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x + 24, y + 8); ctx.stroke()
      ctx.setLineDash([])
      haloText(text, x + 30, y + 8, 'left', 'middle', 'italic 14px ' + MATH_FONT)
      x += 30 + ctx.measureText(text).width + 16
    }
    return y + 24
  }
  function shadeKey(y, what) {
    const x = 10, w = 110
    haloText(what === 'divergence' ? 'divergence' : 'curl', x, y + 6, 'left', 'middle', '12px ' + FONT)
    const grad = ctx.createLinearGradient(x, 0, x + w, 0)
    grad.addColorStop(0, theme.neg); grad.addColorStop(0.5, theme.mid); grad.addColorStop(1, theme.pos)
    ctx.fillStyle = grad
    ctx.fillRect(x, y + 16, w, 7)
    ctx.strokeStyle = theme.border
    ctx.lineWidth = 1
    ctx.strokeRect(x, y + 16, w, 7)
    haloText('−', x, y + 26, 'left', 'top', '11px ' + FONT)
    haloText('0', x + w / 2, y + 26, 'center', 'top', '11px ' + FONT)
    haloText('+', x + w, y + 26, 'right', 'top', '11px ' + FONT)
    return y + 46
  }
  // The trace–determinant plane, top right, with where each equilibrium sits
  function traceDet(f) {
    const w = 190, h = 140, x0 = W - w - 10, y0 = 42
    ctx.fillStyle = theme.panel
    ctx.strokeStyle = theme.border
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.fill(); ctx.stroke()
    let R = 2.4
    for (const q of f.eq) R = Math.max(R, Math.abs(q.trace) * 1.3, Math.sqrt(Math.abs(q.det)) * 1.3)
    const ix = x0 + 10, iy = y0 + 14, iw = w - 20, ih = h - 34
    const tx = t => ix + (t + R) / (2 * R) * iw, dy = d => iy + ih * 0.72 - d / (R * R / 4 * 1.25) * ih * 0.72
    ctx.save()
    ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip()
    ctx.fillStyle = theme.neg
    ctx.globalAlpha = 0.1
    ctx.fillRect(ix, dy(0), iw, ih)
    ctx.globalAlpha = 1
    ctx.strokeStyle = theme.axis
    ctx.beginPath(); ctx.moveTo(ix, dy(0)); ctx.lineTo(ix + iw, dy(0)); ctx.moveTo(tx(0), iy); ctx.lineTo(tx(0), iy + ih); ctx.stroke()
    ctx.strokeStyle = theme.text
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    for (let k = 0; k <= 60; k++) { const t = -R + 2 * R * k / 60; if (k) ctx.lineTo(tx(t), dy(t * t / 4)); else ctx.moveTo(tx(t), dy(t * t / 4)) }
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = '9.5px ' + FONT
    ctx.fillStyle = theme.text
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText('saddles', tx(0), dy(0) + 14)
    ctx.fillText('spirals', tx(-R * 0.32), dy(R * R / 4 * 0.85))
    ctx.fillText('spirals', tx(R * 0.32), dy(R * R / 4 * 0.85))
    ctx.textAlign = 'left'; ctx.fillText('nodes', ix + 2, dy(R * R / 4 * 0.12))
    ctx.textAlign = 'right'; ctx.fillText('nodes', ix + iw - 2, dy(R * R / 4 * 0.12))
    for (const q of f.eq) {
      ctx.fillStyle = f.color
      ctx.strokeStyle = theme.halo
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(tx(q.trace), Math.max(iy + 3, Math.min(iy + ih - 3, dy(q.det))), 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    }
    ctx.restore()
    ctx.font = 'italic 12px ' + MATH_FONT
    ctx.fillStyle = theme.text
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'; ctx.fillText('Δ = det', x0 + 8, y0 + h - 7)
    ctx.textAlign = 'right'; ctx.fillText('τ = trace', x0 + w - 8, y0 + h - 7)
  }
  function drawEquilibriumCard(q) {
    const x = sx(q.x), y = sy(q.y)
    // Zero to within the view's rounding reads as 0
    const at = v => fmt(Math.abs(v) < (X1 - X0) * 1e-9 ? 0 : v)
    const lines = [
      q.kind === 'center' ? 'Center (of the linearization)' : q.kind[0].toUpperCase() + q.kind.slice(1),
      '(' + at(q.x) + ', ' + at(q.y) + ')',
      'λ = ' + (q.eig[0][1] ? fmt(q.eig[0][0]) + ' ± ' + fmt(Math.abs(q.eig[0][1])) + 'i' : fmt(q.eig[0][0]) + ', ' + fmt(q.eig[1][0])),
      'τ = ' + fmt(q.trace) + ',  Δ = ' + fmt(q.det),
    ]
    ctx.font = '12.5px ' + FONT
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 20, h = lines.length * 18 + 12
    const bx = x + 14 + w > W ? x - 14 - w : x + 14, by = Math.max(4, Math.min(H - h - 4, y - h / 2))
    ctx.fillStyle = theme.panel
    ctx.strokeStyle = theme.border
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.rect(bx, by, w, h); ctx.fill(); ctx.stroke()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    lines.forEach((l, i) => { ctx.fillStyle = theme.panelText; ctx.font = (i ? '' : '600 ') + '12.5px ' + FONT; ctx.fillText(l, bx + 10, by + 8 + i * 18) })
  }
  // A path's or solution's starting point, where it can be dragged from
  function startAt(it, E) {
    const x = it.kind === 'solution' ? it.x0(E) : it.px(E), y = it.kind === 'solution' ? it.y0(E) : it.py(E)
    return isFinite(x) && isFinite(y) ? { x, y, px: sx(x), py: sy(y) } : null
  }

  // ── Moving: particles, and dots riding along paths ──────────────────────
  let particles = [], lastStep = 0
  const trailCanvas = document.createElement('canvas'), trail = trailCanvas.getContext('2d')
  const startTime = typeof performance !== 'undefined' ? performance.now() : 0
  function moving(g) {
    if (!g || C.print || reduceMotion) return false
    return g.fields.some(f => f.o.draw === 'particles') || g.paths.some(p => p.moving)
  }
  function drawMoving(g) {
    if (!moving(g)) { particles = []; return }
    const now = performance.now(), d = density()
    const flows = g.fields.filter(f => f.o.draw === 'particles')
    if (flows.length) {
      const dt = lastStep ? Math.min(0.05, (now - lastStep) / 1000) : 0
      lastStep = now
      const TW = Math.round(W * d), TH = Math.round(H * d)
      if (trailCanvas.width !== TW || trailCanvas.height !== TH) { trailCanvas.width = TW; trailCanvas.height = TH; particles = [] }
      trail.setTransform(d, 0, 0, d, 0, 0)
      trail.globalCompositeOperation = 'destination-out'
      trail.fillStyle = 'rgba(0,0,0,0.075)'
      trail.fillRect(0, 0, W, H)
      trail.globalCompositeOperation = 'source-over'
      const want = Math.round(W * H / 700 / flows.length), v = [0, 0], scale = Math.min(W / (X1 - X0), H / (Y1 - Y0))
      for (const f of flows) {
        let mine = particles.filter(q => q.f === f.it.id)
        while (mine.length < want) { const q = { x: Math.random() * W, y: Math.random() * H, age: Math.random() * 4, f: f.it.id }; particles.push(q); mine.push(q) }
        trail.strokeStyle = f.color
        trail.globalAlpha = 0.9
        trail.lineWidth = 1.6
        trail.lineCap = 'round'
        trail.beginPath()
        for (const q of mine) {
          f.V(q.x, q.y, v)
          const m = Math.hypot(v[0], v[1]), speed = 70 * Math.min(2.5, m / (f.mRef * scale || 1))
          const nx = q.x + (m ? v[0] / m * speed * dt : 0), ny = q.y + (m ? v[1] / m * speed * dt : 0)
          q.age += dt
          if (!isFinite(nx) || !isFinite(ny) || nx < 0 || ny < 0 || nx > W || ny > H || q.age > 5 || !m) { q.x = Math.random() * W; q.y = Math.random() * H; q.age = 0; continue }
          trail.moveTo(q.x, q.y); trail.lineTo(nx, ny)
          q.x = nx; q.y = ny
        }
        trail.stroke()
      }
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(trailCanvas, 0, 0)
      ctx.restore()
    }
    // Dots ride along their paths at the system's own pace
    for (const p of g.paths) {
      if (!p.moving || !p.runs[0]) continue
      const pts = p.runs[0].pts, T = Math.abs(pts[pts.length - 1][2])
      if (!(T > 0)) continue
      const t = ((now - startTime) / 1000 * 1.2) % T
      let k = 0
      while (k < pts.length - 1 && Math.abs(pts[k + 1][2]) < t) k++
      ctx.fillStyle = p.color
      ctx.strokeStyle = theme.halo
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(sx(pts[k][0]), sy(pts[k][1]), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    }
  }

  // ── Redrawing ────────────────────────────────────────────────────────────
  let last = 0
  function request() { if (!frame) frame = requestAnimationFrame(tick) }
  function tick(now) {
    frame = 0
    const names = Object.keys(playing)
    if (names.length) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
      last = now
      for (const name of names) animate(name, dt)
      syncPanel()
      draw()
      request()
    } else {
      last = 0
      draw()
      if (moving(fieldGeo)) request()
    }
  }
  function sliderOf(name) {
    const it = analysis.items.find(i => i.kind === 'param' && i.name === name)
    const e = it ? exprOf(it) : {}
    const s = e.slider || {}
    const min = isFinite(+s.min) && s.min !== '' ? +s.min : -10
    const max = isFinite(+s.max) && s.max !== '' ? +s.max : 10
    const stepSize = isFinite(+s.step) && +s.step > 0 ? +s.step : 0
    return { min: Math.min(min, max), max: Math.max(min, max), step: stepSize, speed: +s.speed > 0 ? +s.speed : 1 }
  }
  function animate(name, dt) {
    const s = sliderOf(name)
    if (s.max === s.min) return
    let v = values[name] + playing[name] * (s.max - s.min) * dt * s.speed / 4
    if (v > s.max) { v = s.max - (v - s.max); playing[name] = -1 }
    if (v < s.min) { v = s.min + (s.min - v); playing[name] = 1 }
    values[name] = Math.min(s.max, Math.max(s.min, v))
  }

  // ── Sliders on the graph ─────────────────────────────────────────────────
  const panel = document.createElement('div')
  document.body.appendChild(panel)
  let rows = []
  function buildPanel() {
    panel.innerHTML = ''
    rows = []
    const params = analysis.items.filter(it => it.kind === 'param' && it.slider && !exprOf(it).hidden)
    const show = C.showSliders !== false && !C.print && params.length > 0
    panel.style.cssText = 'position:absolute;left:8px;bottom:8px;display:' + (show ? 'flex' : 'none') + ';flex-direction:column;gap:4px;padding:6px 10px;border-radius:8px;max-height:45%;overflow:auto;'
      + 'background:' + theme.panel + ';border:1px solid ' + theme.border + ';color:' + theme.panelText + ';font:13px ' + FONT + ';box-shadow:0 2px 10px rgba(0,0,0,0.15);'
    for (const it of params) {
      const s = sliderOf(it.name)
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;gap:8px;white-space:nowrap;'
      const play = document.createElement('button')
      play.type = 'button'
      play.style.cssText = 'width:22px;height:22px;border-radius:50%;border:1px solid ' + theme.border + ';background:transparent;color:' + theme.panelText + ';cursor:pointer;font-size:10px;line-height:1;padding:0;flex:none;'
      play.title = 'Play'
      play.addEventListener('click', () => {
        if (playing[it.name]) delete playing[it.name]
        else playing[it.name] = 1
        syncPanel()
        request()
      })
      const label = document.createElement('span')
      const nm = prettyName(it.name)
      const base = document.createElement('i')
      base.textContent = nm.base
      base.style.fontFamily = MATH_FONT
      base.style.fontSize = '15px'
      label.appendChild(base)
      if (nm.sub) { const sub = document.createElement('sub'); sub.textContent = nm.sub; label.appendChild(sub) }
      const value = document.createElement('span')
      value.style.cssText = 'min-width:44px;font-variant-numeric:tabular-nums;'
      const range = document.createElement('input')
      range.type = 'range'
      range.min = String(s.min)
      range.max = String(s.max)
      range.step = s.step ? String(s.step) : 'any'
      range.style.cssText = 'width:120px;accent-color:' + theme.accent + ';'
      range.addEventListener('input', () => {
        values[it.name] = +range.value
        delete playing[it.name]
        syncPanel()
        request()
      })
      range.addEventListener('change', () => postEditor({ type: 'param', name: it.name, value: values[it.name] }))
      row.append(play, label, document.createTextNode('='), value, range)
      panel.appendChild(row)
      rows.push({ name: it.name, play, value, range })
    }
    syncPanel()
  }
  function syncPanel() {
    for (const r of rows) {
      const v = values[r.name]
      r.value.textContent = fmt(v)
      if (document.activeElement !== r.range) r.range.value = String(v)
      r.play.textContent = playing[r.name] ? '❚❚' : '▶'
      r.play.title = playing[r.name] ? 'Pause' : 'Play'
    }
  }

  // ── Panning, zooming, dragging points, reading values ────────────────────
  const reset = document.createElement('button')
  reset.type = 'button'
  reset.textContent = '⟲'
  reset.title = 'Back to the starting view'
  document.body.appendChild(reset)
  function styleReset() {
    const changed = view && C.view && !sameView(view, copyView(C.view))
    reset.style.cssText = 'position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:16px;line-height:1;padding:0;'
      + 'background:' + theme.panel + ';border:1px solid ' + theme.border + ';color:' + theme.panelText + ';display:' + (changed && !C.editor && !C.print ? 'block' : 'none') + ';'
    if (typeof styleClear === 'function') styleClear()
  }
  reset.addEventListener('click', () => { view = copyView(C.view); styleReset(); request() })
  // Clear paths: those a click started
  const clear = document.createElement('button')
  clear.type = 'button'
  clear.textContent = 'Clear paths'
  document.body.appendChild(clear)
  function styleClear() {
    const right = reset.style.display === 'block' ? 42 : 8
    clear.style.cssText = 'position:absolute;top:8px;right:' + right + 'px;height:28px;border-radius:6px;cursor:pointer;font:12px ' + FONT + ';padding:0 10px;'
      + 'background:' + theme.panel + ';border:1px solid ' + theme.border + ';color:' + theme.panelText + ';display:' + (clicks.length && !C.print ? 'block' : 'none') + ';'
  }
  clear.addEventListener('click', () => { clicks = []; styleClear(); request() })
  // A click (a press that doesn't move) starts a path through it, of the first
  // field that takes clicks; a double-click zooms instead
  let clickTimer = 0
  function clickAt(px, py) {
    if (C.print) return
    const it = analysis.items.find(i => FIELD_KINDS.includes(i.kind) && visible(i) && fieldOptions(exprOf(i), i.kind).clicks)
    if (!it) return
    clearTimeout(clickTimer)
    clickTimer = setTimeout(() => {
      clicks = clicks.concat([{ x: wx(px), y: wy(py), field: it.id }]).slice(-16)
      styleClear()
      request()
    }, 260)
  }

  function postEditor(msg) {
    if (!C.editor) return
    try { parent.postMessage(Object.assign({ source: 'parallax-graph' }, msg), '*') } catch (e) { /* no editor */ }
  }
  let viewTimer = 0
  function viewChanged() {
    styleReset()
    request()
    clearTimeout(viewTimer)
    viewTimer = setTimeout(() => postEditor({ type: 'view', view: copyView(view) }), 200)
  }

  // No closer than a millionth of a millionth of where it's looking (floats
  // tell apart about 1e-16 of it), and no farther out than 1e12 across
  function zoom(factor, px, py) {
    const v = shown()
    const cx = v.xMin + px / W * (v.xMax - v.xMin)
    const cy = v.yMin + (H - py) / H * (v.yMax - v.yMin)
    const span = Math.min(view.xMax - view.xMin, view.yMax - view.yMin)
    const least = 1e-12 * Math.max(1, Math.abs(cx), Math.abs(cy))
    factor = Math.min(Math.max(factor, least / span), 1e12 / Math.max(view.xMax - view.xMin, view.yMax - view.yMin))
    if (!(factor > 0) || !isFinite(factor)) return
    view = {
      xMin: cx - (cx - view.xMin) * factor, xMax: cx + (view.xMax - cx) * factor,
      yMin: cy - (cy - view.yMin) * factor, yMax: cy + (view.yMax - cy) * factor,
    }
    viewChanged()
  }

  const pointers = new Map()
  let drag = null
  function pos(ev) { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top] }
  function snap(name, v) {
    const s = sliderOf(name)
    return s.step ? Math.round(v / s.step) * s.step : parseFloat(v.toPrecision(6))
  }

  canvas.addEventListener('pointerdown', ev => {
    const [px, py] = pos(ev)
    pointers.set(ev.pointerId, [px, py])
    canvas.setPointerCapture(ev.pointerId)
    hover = null
    if (pointers.size === 2) { drag = { kind: 'pinch', view: copyView(view), start: [...pointers.values()] }; return }
    const E = env()
    for (const it of analysis.items) {
      if (!['point', 'trajectory', 'solution'].includes(it.kind) || !(it.dragX || it.dragY) || !visible(it)) continue
      const p = it.kind === 'point' ? pointAt(it, E) : startAt(it, E)
      if (p && Math.hypot(p.px - px, p.py - py) < 14) { drag = { kind: 'point', it }; return }
    }
    drag = C.lockView ? { kind: 'click', start: [px, py] } : { kind: 'pan', view: copyView(view), start: [px, py], shown: shown() }
  })
  canvas.addEventListener('pointermove', ev => {
    const [px, py] = pos(ev)
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, [px, py])
    if (!drag) { trace(px, py); return }
    if (drag.kind === 'point') {
      const v = shown()
      if (drag.it.dragX) values[drag.it.dragX] = snap(drag.it.dragX, v.xMin + px / W * (v.xMax - v.xMin))
      if (drag.it.dragY) values[drag.it.dragY] = snap(drag.it.dragY, v.yMin + (H - py) / H * (v.yMax - v.yMin))
      if (drag.it.dragX) delete playing[drag.it.dragX]
      if (drag.it.dragY) delete playing[drag.it.dragY]
      syncPanel()
      request()
    } else if (drag.kind === 'pan') {
      if (Math.hypot(px - drag.start[0], py - drag.start[1]) > 4) drag.moved = true
      const dx = (px - drag.start[0]) / W * (drag.shown.xMax - drag.shown.xMin)
      const dy = (py - drag.start[1]) / H * (drag.shown.yMax - drag.shown.yMin)
      view = { xMin: drag.view.xMin - dx, xMax: drag.view.xMax - dx, yMin: drag.view.yMin + dy, yMax: drag.view.yMax + dy }
      viewChanged()
    } else if (drag.kind === 'pinch' && pointers.size === 2 && !C.lockView) {
      const [a, b] = [...pointers.values()]
      const [a0, b0] = drag.start
      const d0 = Math.hypot(a0[0] - b0[0], a0[1] - b0[1]), d1 = Math.hypot(a[0] - b[0], a[1] - b[1])
      if (d0 > 10 && d1 > 10) {
        view = copyView(drag.view)
        zoom(d0 / d1, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
      }
    }
  })
  const end = ev => {
    pointers.delete(ev.pointerId)
    if (drag && drag.kind === 'point') {
      for (const name of [drag.it.dragX, drag.it.dragY]) if (name) postEditor({ type: 'param', name, value: values[name] })
    }
    if (drag && (drag.kind === 'click' || (drag.kind === 'pan' && !drag.moved)) && ev.type === 'pointerup' && !pointers.size) {
      const [px, py] = pos(ev)
      if (Math.hypot(px - drag.start[0], py - drag.start[1]) <= 4) clickAt(px, py)
    }
    if (!pointers.size) drag = null
  }
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)
  canvas.addEventListener('pointerleave', () => { if (hover || eqHover) { hover = null; eqHover = null; request() } })
  canvas.addEventListener('wheel', ev => {
    if (C.lockView) return
    ev.preventDefault()
    const [px, py] = pos(ev)
    zoom(Math.exp(ev.deltaY * 0.0015), px, py)
  }, { passive: false })
  canvas.addEventListener('dblclick', ev => {
    clearTimeout(clickTimer)
    if (C.lockView) return
    const [px, py] = pos(ev)
    zoom(0.5, px, py)
  })

  // The value of the nearest y = f(x) under the pointer
  function trace(px, py) {
    // Pointing at an equilibrium reads it
    let near = null
    if (fieldGeo) {
      for (const f of fieldGeo.fields) {
        if (!f.eq || !overlayShown(f.e, f.o, 'equilibria')) continue
        for (const q of f.eq) if (Math.hypot(sx(q.x) - px, sy(q.y) - py) < 10) near = q
      }
    }
    if (near !== eqHover) { eqHover = near; request() }
    if (near) { hover = null; canvas.style.cursor = 'default'; return }
    let best = null
    const E = env()
    for (const it of analysis.items) {
      const curve = it.kind === 'explicit' || (it.kind === 'function' && it.graph)
      if (!curve || !visible(it)) continue
      const e = exprOf(it)
      const horiz = (it.axis || 'y') === 'y'
      const u = horiz ? wx(px) : wy(py)
      E[horiz ? 'x' : 'y'] = u
      const val = it.f(E)
      if (!isFinite(val)) continue
      const d = horiz ? Math.abs(sy(val) - py) : Math.abs(sx(val) - px)
      if (d < 10 && (!best || d < best.d)) {
        best = horiz ? { d, px, py: sy(val), x: u, y: val, color: e.color } : { d, px: sx(val), py, x: val, y: u, color: e.color }
      }
    }
    const had = !!hover
    hover = best
    canvas.style.cursor = best ? 'crosshair' : C.lockView ? 'default' : 'grab'
    if (best || had) request()
  }

  // ── Size and messages ────────────────────────────────────────────────────
  function resize() {
    const w = window.innerWidth, h = window.innerHeight
    if (!w || !h) return
    W = w; H = h
    const d = density()
    canvas.width = Math.round(w * d)
    canvas.height = Math.round(h * d)
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    ctx.setTransform(d, 0, 0, d, 0, 0)
    draw()
  }
  window.addEventListener('resize', resize)
  // Clicking into the graph takes the keyboard from the deck: hand the keys
  // that move through the slides back (a slider keeps its arrow keys)
  const NAV_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ', 'Home', 'End']
  window.addEventListener('keydown', ev => {
    if (C.editor || ev.altKey || ev.ctrlKey || ev.metaKey || !NAV_KEYS.includes(ev.key)) return
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return
    ev.preventDefault()
    try { parent.postMessage({ source: 'parallax-graph', type: 'key', key: ev.key, shift: ev.shiftKey }, '*') } catch (e) { /* no deck */ }
  })
  window.addEventListener('message', ev => {
    if (ev.source !== window.parent) return
    const data = ev.data
    if (data === 'parallax-resize') { clicks = []; styleClear(); resize(); return }
    if (!data || typeof data !== 'object') return
    if (data.type === 'scale' && typeof data.scale === 'number' && data.scale > 0) {
      shownScale = clamp(data.scale, 0.1, 8)
      resize()
      return
    }
    if (data.source === 'parallax-deck' && data.type === 'graph-step' && typeof data.step === 'number' && !C.showAll) {
      step = data.step
      request()
    } else if (data.source === 'parallax-graph-editor' && data.type === 'config' && data.config) {
      setConfig(Object.assign({}, data.config, { editor: true, showAll: true }), true)
      styleReset()
    }
  })

  setConfig(C, false)
  styleReset()
  canvas.style.cursor = C.lockView ? 'default' : 'grab'
  resize()
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Where a Venn diagram's regions are (vennDiagram.js draws them): its sets as
// circles and ellipses, the outline of every region between them, a point
// well inside each for its label, where the set labels go, and the lines and
// dots that hatch a group of regions. Lengths in cm, y up.
//
// Each region is drawn as its exact outline rather than with clipping masks:
// the outline is also what places its label and lights it in the editor, and
// a plain path is the safest thing to hand PowerPoint. Hatching is drawn as
// line segments for the same reason, and so it needs no pattern ids, which
// would clash between the canvas and the slide thumbnails.

const TAU = Math.PI * 2
const D2R = Math.PI / 180

// ---------- Shapes: { x, y, rx, ry, rot } in cm, rot in degrees counterclockwise

export function shapeFns(s) {
  const c = Math.cos(s.rot * D2R), sn = Math.sin(s.rot * D2R)
  return {
    // Negative inside, positive outside
    F(px, py) { const dx = px - s.x, dy = py - s.y, u = dx * c + dy * sn, v = -dx * sn + dy * c; return (u / s.rx) ** 2 + (v / s.ry) ** 2 - 1 },
    at(t) { const a = s.rx * Math.cos(t), b = s.ry * Math.sin(t); return [s.x + a * c - b * sn, s.y + a * sn + b * c] },
    // About how far a point is from the outline
    dist(px, py) {
      const dx = px - s.x, dy = py - s.y, u = dx * c + dy * sn, v = -dx * sn + dy * c
      if (Math.abs(s.rx - s.ry) < 1e-9) return Math.abs(Math.hypot(u, v) - s.rx)
      const r = Math.hypot(u / s.rx, v / s.ry), F = r * r - 1
      const g = 2 * Math.hypot(u / (s.rx * s.rx), v / (s.ry * s.ry))
      const radial = r > 1e-9 ? Math.abs(1 - 1 / r) * Math.hypot(u, v) : Math.min(s.rx, s.ry)
      return g > 1e-9 ? Math.min(Math.abs(F) / g, radial) : radial
    },
    // Where a ray from the centre in direction d crosses the outline
    ray(d) { const u = d[0] * c + d[1] * sn, v = -d[0] * sn + d[1] * c; const k = 1 / Math.hypot(u / s.rx, v / s.ry); return [s.x + d[0] * k, s.y + d[1] * k] },
  }
}

// ---------- The regions
//
// Each shape is cut where the others cross it. An arc between two crossings
// borders exactly two regions, the one just inside the shape and the one just
// outside, which agree on every other shape. A region's arcs chain into
// loops, wound so the region is on their left, and drawn even-odd, so a
// region with a hole or in two pieces comes out right. The outside region
// (m = 0) also has the universe's rectangle.
export function arrangement(shapes, box) {
  const n = shapes.length, fns = shapes.map(shapeFns), N = 720
  const arcs = []
  for (let i = 0; i < n; i++) {
    const cuts = []
    for (let j = 0; j < n; j++) {
      if (j === i) continue
      let prev = fns[j].F(...fns[i].at(0))
      for (let k = 1; k <= N; k++) {
        const t = (k / N) * TAU, cur = fns[j].F(...fns[i].at(t))
        if ((prev < 0) !== (cur < 0)) {
          let a = ((k - 1) / N) * TAU, b = t, fa = prev
          for (let it = 0; it < 48; it++) {
            const mid = (a + b) / 2, fm = fns[j].F(...fns[i].at(mid))
            if ((fm < 0) === (fa < 0)) { a = mid; fa = fm } else b = mid
          }
          cuts.push((a + b) / 2)
        }
        prev = cur
      }
    }
    cuts.sort((a, b) => a - b)
    const segs = cuts.length ? cuts.map((t0, k) => [t0, k + 1 < cuts.length ? cuts[k + 1] : cuts[0] + TAU]) : [[0, TAU]]
    for (const [t0, t1] of segs) {
      const p = fns[i].at((t0 + t1) / 2)
      let others = 0
      for (let j = 0; j < n; j++) if (j !== i && fns[j].F(p[0], p[1]) < 0) others |= 1 << j
      arcs.push({ i, t0, t1, full: !cuts.length, others, p0: fns[i].at(t0), p1: fns[i].at(t1) })
    }
  }
  const regions = []
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-5
  for (let m = 0; m < (1 << n); m++) {
    const mine = arcs.filter(a => a.others === (m & ~(1 << a.i))).map(a => {
      const fwd = ((m >> a.i) & 1) === 1
      return { arc: a, fwd, start: fwd ? a.p0 : a.p1, end: fwd ? a.p1 : a.p0 }
    })
    const loops = []
    const unused = mine.slice()
    while (unused.length) {
      const first = unused.shift(), loop = [first]
      if (!first.arc.full) {
        let cur = first
        for (let guard = 0; guard < 64 && !near(cur.end, first.start); guard++) {
          let k = -1, bd = Infinity
          unused.forEach((x, j) => { const d = Math.hypot(x.start[0] - cur.end[0], x.start[1] - cur.end[1]); if (d < bd) { bd = d; k = j } })
          if (k < 0 || bd > 1e-4) break
          cur = unused.splice(k, 1)[0]
          loop.push(cur)
        }
      }
      loops.push(loop)
    }
    if (m === 0 && box) loops.push([{ rect: box }])
    // The loops as polygons, for the area, hatching and dots
    let area = 0
    const poly = []
    for (const loop of loops) {
      const pts = []
      for (const seg of loop) {
        if (seg.rect) { const b = seg.rect; pts.push([b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]); continue }
        const a = seg.arc, steps = Math.max(8, Math.ceil((a.t1 - a.t0) / 0.05))
        for (let k = 0; k < steps; k++) {
          const t = seg.fwd ? a.t0 + (a.t1 - a.t0) * (k / steps) : a.t1 - (a.t1 - a.t0) * (k / steps)
          pts.push(fns[a.i].at(t))
        }
      }
      for (let k = 0; k < pts.length; k++) { const p = pts[k], q = pts[(k + 1) % pts.length]; area += (p[0] * q[1] - q[0] * p[1]) / 2 }
      poly.push(pts)
    }
    regions.push({ m, loops, area: m === 0 && !box ? Infinity : area, poly })
  }
  return { shapes, fns, arcs, regions }
}

// A point well inside each region, for its label: the sample furthest from
// any edge, the universe's sides and the boxes in opts.avoid ({ x, y, w, h })
export function regionPoles(geo, box, opts = {}) {
  const n = geo.shapes.length, fns = geo.fns
  const h = opts.step || 0.09
  const best = new Array(1 << n).fill(null)
  const bit = (x, y) => { let m = 0; for (let i = 0; i < n; i++) if (fns[i].F(x, y) < 0) m |= 1 << i; return m }
  const avoid = opts.avoid || []
  const score = (x, y) => {
    let d = Math.min(x - box.x0, box.x1 - x, y - box.y0, box.y1 - y)
    for (let i = 0; i < n; i++) d = Math.min(d, fns[i].dist(x, y))
    for (const a of avoid) { const dx = Math.max(0, Math.abs(x - a.x) - a.w / 2), dy = Math.max(0, Math.abs(y - a.y) - a.h / 2); d = Math.min(d, Math.hypot(dx, dy) * 1.2) }
    return d
  }
  for (let x = box.x0 + h / 2; x < box.x1; x += h) {
    for (let y = box.y0 + h / 2; y < box.y1; y += h) {
      const m = bit(x, y), d = score(x, y)
      if (!best[m] || d > best[m].d) best[m] = { x, y, d }
    }
  }
  for (let m = 0; m < best.length; m++) {
    const b = best[m]
    if (!b) continue
    for (let k = 0; k < 2; k++) {
      const hh = h / (k ? 8 : 3)
      let bx = b.x, by = b.y, bd = b.d
      for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
        const x = b.x + dx * hh, y = b.y + dy * hh
        if (bit(x, y) !== m) continue
        const d = score(x, y)
        if (d > bd) { bd = d; bx = x; by = y }
      }
      b.x = bx; b.y = by; b.d = bd
    }
  }
  return best
}

// ---------- Set labels: just outside each shape, clear of the others

export function placeLabels(shapes, sizes) {
  const n = shapes.length, fns = shapes.map(shapeFns)
  const cx = shapes.reduce((s, p) => s + p.x, 0) / n, cy = shapes.reduce((s, p) => s + p.y, 0) / n
  // A shape inside another can't put its label outside that one, so the
  // label just keeps clear of its outline from the inside
  const samples = fns.map(f => Array.from({ length: 32 }, (_, k) => f.at((k / 32) * TAU)))
  const within = (i, j) => samples[i].every(q => fns[j].F(q[0], q[1]) < 0)
  const placed = []
  return shapes.map((s, i) => {
    const { w, h } = sizes[i]
    let out = [s.x - cx, s.y - cy]
    const ol = Math.hypot(out[0], out[1])
    out = ol > 1e-6 ? [out[0] / ol, out[1] / ol] : [-0.6, 0.8]
    let best = null
    for (let k = 0; k < 64; k++) {
      const a = (k / 64) * TAU, d = [Math.cos(a), Math.sin(a)]
      const e = fns[i].ray(d)
      const r = 0.12 + Math.abs(d[0]) * w / 2 + Math.abs(d[1]) * h / 2
      const p = [e[0] + d[0] * r, e[1] + d[1] * r]
      let clear = 1
      const corners = [p, [p[0] - w / 2, p[1] - h / 2], [p[0] + w / 2, p[1] - h / 2], [p[0] - w / 2, p[1] + h / 2], [p[0] + w / 2, p[1] + h / 2]]
      for (let j = 0; j < n; j++) {
        if (j === i) continue
        const inside = within(i, j)
        for (const q of corners) { const F = fns[j].F(q[0], q[1]), dd = fns[j].dist(q[0], q[1]); clear = Math.min(clear, F < 0 && !inside ? -dd : dd) }
      }
      let score = Math.min(clear, 0.45) * 4 + 0.8 * (d[0] * out[0] + d[1] * out[1]) + 0.25 * d[1] - 0.05 * d[0]
      for (const o of placed) if (Math.abs(o.x - p[0]) < (o.w + w) / 2 + 0.1 && Math.abs(o.y - p[1]) < (o.h + h) / 2 + 0.05) score -= 3
      if (!best || score > best.score) best = { x: p[0], y: p[1], w, h, score }
    }
    placed.push(best)
    return best
  })
}

// ---------- Everything about a layout: the universe's box, the regions, and
// where labels go. sizes: each set label's { w, h }; universe: null, or its
// label's { w, h }. Cached, since the editor asks on every pointer move.

const cache = new Map()
export function layoutGeometry(shapes, sizes, universe) {
  const key = JSON.stringify([shapes, sizes, universe])
  const hit = cache.get(key)
  if (hit) return hit
  const fns = shapes.map(shapeFns)
  const labels = placeLabels(shapes, sizes)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const ext = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  fns.forEach(f => { for (let k = 0; k < 96; k++) { const p = f.at((k / 96) * TAU); ext(p[0], p[1]) } })
  labels.forEach(l => { ext(l.x - l.w / 2, l.y - l.h / 2); ext(l.x + l.w / 2, l.y + l.h / 2) })
  const pad = 0.4
  const box = { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad }
  // The universe's label in its top left corner, with the box grown until it's clear
  let ulab = null
  if (universe) {
    const { w, h } = universe
    const place = () => ({ x: box.x0 + 0.18 + w / 2, y: box.y1 - 0.14 - h / 2, w, h })
    ulab = place()
    const clash = () => [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].some(([sx, sy]) => {
      const qx = ulab.x + sx * w / 2, qy = ulab.y + sy * h / 2
      return fns.some(f => f.F(qx, qy) < 0.08) || labels.some(l => Math.abs(qx - l.x) < l.w / 2 + 0.05 && Math.abs(qy - l.y) < l.h / 2 + 0.05)
    })
    for (let k = 0; k < 6 && clash(); k++) { box.y1 += 0.18; box.x0 -= 0.12; ulab = place() }
  }
  const geo = arrangement(shapes, box)
  const poles = regionPoles(geo, box, { avoid: labels.concat(ulab ? [ulab] : []) })
  // Regions with room to be drawn
  let drawn = 0
  geo.regions.forEach(r => { if (r.area > 0.02 && poles[r.m]) drawn |= 1 << r.m })
  const res = { shapes, fns, labels, box, ulab, geo, poles, drawn }
  cache.set(key, res)
  if (cache.size > 80) cache.delete(cache.keys().next().value)
  return res
}

// Which region a point is in, or null outside the universe
export function regionAt(g, x, y) {
  const b = g.box
  if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) return null
  let m = 0
  g.fns.forEach((f, i) => { if (f.F(x, y) < 0) m |= 1 << i })
  return m
}

// ---------- Hatching and dots, from the regions' polygons

const has = (mask, m) => ((mask >>> m) & 1) === 1
export function regionPolys(g, mask) {
  const out = []
  for (const r of g.geo.regions) if (has(mask, r.m)) out.push(...r.poly)
  return out
}
// Lines at an angle (degrees), spaced apart, inside the polygons (even-odd):
// each line is cut where it crosses an edge, and alternate pieces kept
export function hatchSegments(polys, deg, spacing) {
  const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R)
  // Turn the drawing so the lines are level
  const rot = ([x, y]) => [x * c + y * s, -x * s + y * c]
  const back = ([u, v]) => [u * c - v * s, u * s + v * c]
  const rp = polys.map(p => p.map(rot))
  let v0 = Infinity, v1 = -Infinity
  for (const p of rp) for (const q of p) { v0 = Math.min(v0, q[1]); v1 = Math.max(v1, q[1]) }
  const segs = []
  if (!isFinite(v0)) return segs
  for (let v = Math.ceil(v0 / spacing) * spacing; v < v1; v += spacing) {
    const xs = []
    for (const p of rp) {
      for (let k = 0; k < p.length; k++) {
        const a = p[k], b = p[(k + 1) % p.length]
        if ((a[1] <= v) !== (b[1] <= v)) xs.push(a[0] + (v - a[1]) * (b[0] - a[0]) / (b[1] - a[1]))
      }
    }
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2) if (xs[k + 1] - xs[k] > 1e-3) segs.push([back([xs[k], v]), back([xs[k + 1], v])])
  }
  return segs
}
function insidePolys(polys, x, y) {
  let inside = false
  for (const p of polys) {
    for (let k = 0, j = p.length - 1; k < p.length; j = k++) {
      const a = p[k], b = p[j]
      if ((a[1] > y) !== (b[1] > y) && x < a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) inside = !inside
    }
  }
  return inside
}
// Dots on a staggered grid, inside the polygons
export function dotPoints(polys, spacing) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of polys) for (const q of p) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]) }
  const pts = []
  if (!isFinite(x0)) return pts
  let row = 0
  for (let y = Math.ceil(y0 / spacing) * spacing; y < y1; y += spacing * 0.87, row++) {
    for (let x = Math.ceil(x0 / spacing) * spacing + (row % 2 ? spacing / 2 : 0); x < x1; x += spacing) if (insidePolys(polys, x, y)) pts.push([x, y])
  }
  return pts
}

// ---------- Layouts for each number of sets. Four circles can make at most
// 14 regions (n² − n + 2), not 16, so four sets are ellipses, tuned so every
// region is one piece with room for a label.

const C = (x, y, r) => ({ x, y, rx: r, ry: r, rot: 0 })
export const VENN_LAYOUTS = {
  1: [{ id: 'one', name: 'One circle', shapes: [C(0, 0, 1.6)] }],
  2: [
    { id: 'overlap', name: 'Overlapping', shapes: [C(-0.95, 0, 1.6), C(0.95, 0, 1.6)] },
    { id: 'inside', name: '{0} inside {1}', shapes: [C(-0.45, -0.15, 0.95), C(0, 0, 1.9)] },
    { id: 'apart', name: 'Apart', shapes: [C(-1.85, 0, 1.45), C(1.85, 0, 1.45)] },
  ],
  3: [
    { id: 'classic', name: 'Overlapping', shapes: [C(-0.9, 0.52, 1.5), C(0.9, 0.52, 1.5), C(0, -1.04, 1.5)] },
    { id: 'row', name: 'In a row', shapes: [C(-1.9, 0, 1.3), C(0, 0, 1.3), C(1.9, 0, 1.3)] },
    { id: 'nested', name: 'Nested', shapes: [C(0, -0.55, 0.85), C(0, -0.2, 1.45), C(0, 0.2, 2.1)] },
  ],
  4: [
    { id: 'ellipses', name: 'Ellipses', shapes: [
      { x: -0.8, y: -0.4, rx: 2.4, ry: 1.56, rot: -50 },
      { x: 0, y: 0.3, rx: 2.4, ry: 1.56, rot: -50 },
      { x: 0, y: 0.3, rx: 2.4, ry: 1.56, rot: 50 },
      { x: 0.8, y: -0.4, rx: 2.4, ry: 1.56, rot: 50 },
    ] },
  ],
}

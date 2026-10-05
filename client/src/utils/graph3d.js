// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// 3D graphs: the meshes a 3D graph's lines make (surfaces z = f(x, y) and
// along the other axes, parametric surfaces over u and v, implicit surfaces
// F(x, y, z) = 0 by marching tetrahedra, curves over t), a fourth value
// shown as color (w = F(x, y, z) on slices, level surfaces or a cloud of
// points, or any surface or curve colored by a function), the camera, and a
// WebGL 2 renderer for them. Like createMathParser it has nothing from
// outside it: the graph page embeds its source (graphPage.js) and
// graphRuntime draws with it.
//
// Meshes are in the graph's own coordinates. The renderer maps the view's
// box to a cube, so a surface fills it whatever its units, and discards
// what falls outside the box.

export function graph3d() {
  'use strict'

  // ── Meshes ──────────────────────────────────────────────────────────────
  // A mesh: pos (x, y, z per vertex), nor (a normal in graph units), mesh
  // (the two coordinates its mesh lines follow), idx (triangles)

  // u = f(…) over a grid of the other two axes: axis 'z' (z = f(x, y)),
  // 'x' (x = f(y, z)) or 'y' (y = f(x, z)). set(E, a, b) puts a grid point
  // in the env; f(E) is the value. n cells a side.
  function explicit(f, E, box, axis, n) {
    var A = axis === 'z' ? ['x', 'y'] : axis === 'x' ? ['y', 'z'] : ['x', 'z']
    var a0 = box[A[0] + 'Min'], a1 = box[A[0] + 'Max'], b0 = box[A[1] + 'Min'], b1 = box[A[1] + 'Max']
    var N = n + 1, pos = new Float32Array(N * N * 3), mesh = new Float32Array(N * N * 2), val = new Float64Array(N * N)
    var k = { x: 0, y: 1, z: 2 }, ia = k[A[0]], ib = k[A[1]], iu = k[axis]
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
      var a = a0 + (a1 - a0) * i / n, b = b0 + (b1 - b0) * j / n, p = j * N + i
      E[A[0]] = a; E[A[1]] = b
      if (axis === 'z') { E.r = Math.hypot(a, b); E.theta = Math.atan2(b, a) }
      var u = f(E)
      val[p] = isFinite(u) ? u : NaN
      pos[3 * p + ia] = a; pos[3 * p + ib] = b; pos[3 * p + iu] = val[p]
      mesh[2 * p] = a; mesh[2 * p + 1] = b
    }
    // Where a cell is partly undefined (a restriction, √ of a negative), its
    // edge is found by bisection along the cell's sides, so the surface ends
    // smoothly rather than a whole cell at a time
    var at = function (a, b) {
      E[A[0]] = a; E[A[1]] = b
      if (axis === 'z') { E.r = Math.hypot(a, b); E.theta = Math.atan2(b, a) }
      var u = f(E)
      return isFinite(u) ? u : NaN
    }
    var extra = []
    var edgePoint = function (p, q) {
      // p defined, q not: bisect toward q
      var ap = pos[3 * p + ia], bp = pos[3 * p + ib], aq = pos[3 * q + ia], bq = pos[3 * q + ib], lo = 0, hi = 1, u = val[p]
      for (var it = 0; it < 12; it++) {
        var mid = (lo + hi) / 2, w = at(ap + (aq - ap) * mid, bp + (bq - bp) * mid)
        if (w === w) { lo = mid; u = w } else hi = mid
      }
      var v = [0, 0, 0]
      v[ia] = ap + (aq - ap) * lo; v[ib] = bp + (bq - bp) * lo; v[iu] = u
      return v
    }
    for (j = 0; j < n; j++) for (i = 0; i < n; i++) {
      var corners = [j * N + i, j * N + i + 1, (j + 1) * N + i + 1, (j + 1) * N + i]
      var ok = corners.map(function (c) { return val[c] === val[c] })
      var count = ok.filter(Boolean).length
      if (count === 0 || count === 4) continue
      // The defined corners and the edge's points, in order round the cell
      var poly = []
      for (var c = 0; c < 4; c++) {
        var cur = corners[c], next = corners[(c + 1) % 4]
        if (ok[c]) poly.push([pos[3 * cur], pos[3 * cur + 1], pos[3 * cur + 2], cur])
        if (ok[c] !== ok[(c + 1) % 4]) poly.push(ok[c] ? edgePoint(cur, next) : edgePoint(next, cur))
      }
      if (poly.length >= 3) extra.push(poly)
    }
    E.x = 0; E.y = 0; E.z = 0; E.r = 0; E.theta = 0
    return grid(pos, mesh, N, N, false, extra, axis === 'z' ? [ia, ib] : [ia, ib])
  }
  // (x, y, z)(u, v) over [u0, u1] × [v0, v1]
  function parametric(fx, fy, fz, E, u0, u1, v0, v1, nu, nv) {
    var NU = nu + 1, NV = nv + 1, pos = new Float32Array(NU * NV * 3), mesh = new Float32Array(NU * NV * 2)
    for (var j = 0; j < NV; j++) for (var i = 0; i < NU; i++) {
      var u = u0 + (u1 - u0) * i / nu, v = v0 + (v1 - v0) * j / nv, p = j * NU + i
      E.u = u; E.v = v
      var x = fx(E), y = fy(E), z = fz(E)
      var ok = isFinite(x) && isFinite(y) && isFinite(z)
      pos[3 * p] = ok ? x : NaN; pos[3 * p + 1] = ok ? y : NaN; pos[3 * p + 2] = ok ? z : NaN
      mesh[2 * p] = u; mesh[2 * p + 1] = v
    }
    E.u = 0; E.v = 0
    return grid(pos, mesh, NU, NV, true)
  }
  // Triangles and normals for a grid of points (NaN where undefined)
  // extra: polygons [[x, y, z, (grid index)], …] for cells partly defined,
  // which then replace the grid's own triangles there; meshAxes: which of a
  // point's coordinates its mesh lines follow
  function grid(pos, mesh, NU, NV, unused, extra, meshAxes) {
    var idx = []
    var ok = function (p) { return pos[3 * p] === pos[3 * p] && pos[3 * p + 1] === pos[3 * p + 1] && pos[3 * p + 2] === pos[3 * p + 2] }
    for (var j = 0; j < NV - 1; j++) for (var i = 0; i < NU - 1; i++) {
      var a = j * NU + i, b = a + 1, c = a + NU, d = c + 1
      var A = ok(a), B = ok(b), C = ok(c), D = ok(d)
      if (A && B && C && D) { idx.push(a, b, d, a, d, c); continue }
      if (extra) continue
      // Three of four: a triangle, so a surface's edge isn't ragged by a whole cell
      if (A && B && D) idx.push(a, b, d)
      else if (A && D && C) idx.push(a, d, c)
      else if (A && B && C) idx.push(a, b, c)
      else if (B && D && C) idx.push(b, d, c)
    }
    if (extra && extra.length) {
      // New points for the edges, fanned from each polygon's first corner
      var more = []
      extra.forEach(function (poly) { poly.forEach(function (q) { if (q[3] === undefined) more.push(q) }) })
      var base = NU * NV, P2 = new Float32Array(pos.length + more.length * 3), M2 = new Float32Array(mesh.length + more.length * 2)
      P2.set(pos); M2.set(mesh)
      var k = 0
      extra.forEach(function (poly) {
        var ids = poly.map(function (q) {
          if (q[3] !== undefined) return q[3]
          var id = base + k++
          P2[3 * id] = q[0]; P2[3 * id + 1] = q[1]; P2[3 * id + 2] = q[2]
          M2[2 * id] = q[meshAxes[0]]; M2[2 * id + 1] = q[meshAxes[1]]
          return id
        })
        for (var t = 1; t < ids.length - 1; t++) idx.push(ids[0], ids[t], ids[t + 1])
      })
      pos = P2; mesh = M2
    }
    var nor = new Float32Array(pos.length)
    // Normals summed from the triangles at each vertex
    for (var t = 0; t < idx.length; t += 3) {
      var p = 3 * idx[t], q = 3 * idx[t + 1], r = 3 * idx[t + 2]
      var ux = pos[q] - pos[p], uy = pos[q + 1] - pos[p + 1], uz = pos[q + 2] - pos[p + 2]
      var vx = pos[r] - pos[p], vy = pos[r + 1] - pos[p + 1], vz = pos[r + 2] - pos[p + 2]
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
      for (var s = 0; s < 3; s++) { var o = 3 * idx[t + s]; nor[o] += nx; nor[o + 1] += ny; nor[o + 2] += nz }
    }
    // Undefined points can't be drawn: park them at 0
    for (var k = 0; k < pos.length; k++) if (pos[k] !== pos[k]) pos[k] = 0
    return { pos: pos, nor: nor, mesh: mesh, idx: new Uint32Array(idx) }
  }

  // F(x, y, z) = 0 by marching tetrahedra on an n³ grid over the box, with
  // normals from F's gradient. Crossings through infinity (1/x) aren't zeros.
  var TETS = [[0, 1, 3, 7], [0, 3, 2, 7], [0, 2, 6, 7], [0, 6, 4, 7], [0, 4, 5, 7], [0, 5, 1, 7]]
  // A cube's 12 edges, by corner (bit 1 x, 2 y, 4 z)
  var EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]
  // F at the corners of an n³ grid over the box (NaN where undefined), i
  // fastest, then j, then k
  function sample(F, E, box, n) {
    var N = n + 1, vals = new Float64Array(N * N * N)
    var dx = (box.xMax - box.xMin) / n, dy = (box.yMax - box.yMin) / n, dz = (box.zMax - box.zMin) / n
    for (var k = 0, p = 0; k < N; k++) for (var j = 0; j < N; j++) for (var i = 0; i < N; i++, p++) {
      E.x = box.xMin + dx * i; E.y = box.yMin + dy * j; E.z = box.zMin + dz * k
      E.r = Math.hypot(E.x, E.y); E.theta = Math.atan2(E.y, E.x)
      var v = F(E)
      vals[p] = isFinite(v) ? v : NaN
    }
    E.x = 0; E.y = 0; E.z = 0; E.r = 0; E.theta = 0
    return vals
  }
  // F(x, y, z) = level; `grid` is F already sampled on this n³ grid, so a
  // field's level surfaces share one
  function implicit(F, E, box, n, level, grid) {
    level = level || 0
    var N = n + 1, src = grid || sample(F, E, box, n)
    var vals = level ? src.map(function (v) { return v - level }) : src
    var dx = (box.xMax - box.xMin) / n, dy = (box.yMax - box.yMin) / n, dz = (box.zMax - box.zMin) / n
    var at = function (i, j, k) { return (k * N + j) * N + i }
    var i, j, k
    // The gradient at a grid point, by differences
    var grad = function (i, j, k, out) {
      var c = vals[at(i, j, k)]
      var gx = i > 0 && i < n ? (vals[at(i + 1, j, k)] - vals[at(i - 1, j, k)]) / (2 * dx) : i === 0 ? (vals[at(1, j, k)] - c) / dx : (c - vals[at(i - 1, j, k)]) / dx
      var gy = j > 0 && j < n ? (vals[at(i, j + 1, k)] - vals[at(i, j - 1, k)]) / (2 * dy) : j === 0 ? (vals[at(i, 1, k)] - c) / dy : (c - vals[at(i, j - 1, k)]) / dy
      var gz = k > 0 && k < n ? (vals[at(i, j, k + 1)] - vals[at(i, j, k - 1)]) / (2 * dz) : k === 0 ? (vals[at(i, j, 1)] - c) / dz : (c - vals[at(i, j, k - 1)]) / dz
      out[0] = gx; out[1] = gy; out[2] = gz
    }
    var pos = [], nor = [], cv = new Array(8), cp = new Array(8), cg = new Array(8)
    for (var q = 0; q < 8; q++) { cp[q] = [0, 0, 0]; cg[q] = [0, 0, 0] }
    var crossing = function (a, b) {
      var va = cv[a], vb = cv[b], t = va / (va - vb)
      pos.push(cp[a][0] + (cp[b][0] - cp[a][0]) * t, cp[a][1] + (cp[b][1] - cp[a][1]) * t, cp[a][2] + (cp[b][2] - cp[a][2]) * t)
      nor.push(cg[a][0] + (cg[b][0] - cg[a][0]) * t, cg[a][1] + (cg[b][1] - cg[a][1]) * t, cg[a][2] + (cg[b][2] - cg[a][2]) * t)
    }
    for (k = 0; k < n; k++) for (j = 0; j < n; j++) for (i = 0; i < n; i++) {
      var pos0 = false, neg0 = false, bad = false
      for (q = 0; q < 8; q++) {
        var ii = i + (q & 1), jj = j + (q >> 1 & 1), kk = k + (q >> 2 & 1), w = vals[at(ii, jj, kk)]
        if (w !== w) { bad = true; break }
        cv[q] = w
        if (w > 0) pos0 = true; else neg0 = true
      }
      if (bad || !(pos0 && neg0)) continue
      // A sign change across a pole (1/x), not a zero: where an edge's values
      // say F is 0, F is no smaller than at the edge's nearer end (for a
      // simple pole always so; at a zero it's nearly 0, and where a corner is
      // exactly on the surface, 0)
      var pole = false
      for (var e = 0; e < 12 && !pole; e++) {
        var qa = EDGES[e][0], qb = EDGES[e][1], wa = cv[qa], wb = cv[qb]
        if ((wa > 0) === (wb > 0)) continue
        var f = wa / (wa - wb)
        E.x = box.xMin + dx * (i + ((qa & 1) + ((qb & 1) - (qa & 1)) * f))
        E.y = box.yMin + dy * (j + ((qa >> 1 & 1) + ((qb >> 1 & 1) - (qa >> 1 & 1)) * f))
        E.z = box.zMin + dz * (k + ((qa >> 2 & 1) + ((qb >> 2 & 1) - (qa >> 2 & 1)) * f))
        E.r = Math.hypot(E.x, E.y); E.theta = Math.atan2(E.y, E.x)
        var mid = F(E) - level
        if (!(Math.abs(mid) <= Math.min(Math.abs(wa), Math.abs(wb)) + 1e-9 * Math.max(Math.abs(wa), Math.abs(wb)))) pole = true
      }
      if (pole) continue
      for (q = 0; q < 8; q++) {
        ii = i + (q & 1); jj = j + (q >> 1 & 1); kk = k + (q >> 2 & 1)
        cp[q][0] = box.xMin + dx * ii; cp[q][1] = box.yMin + dy * jj; cp[q][2] = box.zMin + dz * kk
        grad(ii, jj, kk, cg[q])
      }
      for (var t = 0; t < 6; t++) {
        var T = TETS[t], inside = [], outside = []
        for (var s = 0; s < 4; s++) (cv[T[s]] > 0 ? inside : outside).push(T[s])
        if (inside.length === 0 || inside.length === 4) continue
        if (inside.length === 1 || inside.length === 3) {
          var lone = inside.length === 1 ? inside[0] : outside[0], rest = inside.length === 1 ? outside : inside
          crossing(lone, rest[0]); crossing(lone, rest[1]); crossing(lone, rest[2])
        } else {
          var a = inside[0], b = inside[1], c = outside[0], d = outside[1]
          crossing(a, c); crossing(a, d); crossing(b, d)
          crossing(a, c); crossing(b, d); crossing(b, c)
        }
      }
    }
    E.x = 0; E.y = 0; E.z = 0; E.r = 0; E.theta = 0
    var idx = new Uint32Array(pos.length / 3)
    for (q = 0; q < idx.length; q++) idx[q] = q
    var P = new Float32Array(pos)
    return { pos: P, nor: new Float32Array(nor), mesh: new Float32Array(idx.length * 2).fill(0), idx: idx }
  }

  // (x, y, z)(t) for t in [t0, t1]: runs of points [x, y, z, t], broken
  // where undefined
  function curve(fx, fy, fz, E, t0, t1, n) {
    var runs = [], run = []
    for (var i = 0; i <= n; i++) {
      E.t = t0 + (t1 - t0) * i / n
      var p = [fx(E), fy(E), fz(E), E.t]
      if (isFinite(p[0]) && isFinite(p[1]) && isFinite(p[2])) run.push(p)
      else if (run.length) { runs.push(run); run = [] }
    }
    E.t = 0
    if (run.length) runs.push(run)
    return runs
  }

  // ── A fourth value, as color ────────────────────────────────────────────
  // F at each of a mesh's points: m.w. uv: F may use the mesh's u and v (a
  // parametric surface's)
  function values(m, F, E, uv) {
    var n = m.pos.length / 3, w = new Float32Array(n)
    for (var p = 0; p < n; p++) {
      var x = m.pos[3 * p], y = m.pos[3 * p + 1], z = m.pos[3 * p + 2]
      E.x = x; E.y = y; E.z = z; E.r = Math.hypot(x, y); E.theta = Math.atan2(y, x)
      if (uv) { E.u = m.mesh[2 * p]; E.v = m.mesh[2 * p + 1] }
      var v = F(E)
      w[p] = isFinite(v) ? v : NaN
    }
    E.x = 0; E.y = 0; E.z = 0; E.r = 0; E.theta = 0; E.u = 0; E.v = 0
    m.w = w
    return w
  }
  // The values a mesh's triangles reach (not the points parked unused)
  function usedValues(m) {
    var seen = new Uint8Array(m.w.length), out = []
    for (var i = 0; i < m.idx.length; i++) { var p = m.idx[i]; if (!seen[p]) { seen[p] = 1; out.push(m.w[p]) } }
    return out
  }
  // Where the value is undefined on a surface that is, it's drawn as the
  // scale's middle
  function fillMissing(m, scale) {
    var mid = (scale.min + scale.max) / 2
    for (var i = 0; i < m.w.length; i++) if (m.w[i] !== m.w[i]) m.w[i] = mid
  }
  // How values are colored: { kind: 'viridis' | 'diverging', min, max }.
  // o.cmap 'auto' is diverging, about 0, when the values have both signs
  // (the smaller side at least a tenth of the larger), else viridis. o.min
  // and o.max fix the range; otherwise it's the values', less the last 1%
  // at each end when those stretch it (a pole would spend the whole map),
  // rounded outward
  function colorScale(vals, o) {
    o = o || {}
    var f = [], i
    for (i = 0; i < vals.length; i++) if (isFinite(vals[i])) f.push(vals[i])
    var lo = 0, hi = 1
    if (f.length) {
      f = Float64Array.from(f).sort()
      var q = function (p) { return f[Math.round(p * (f.length - 1))] }
      lo = f[0]; hi = f[f.length - 1]
      var p1 = q(0.01), p99 = q(0.99)
      if (p99 > p1 && hi - lo > 4 * (p99 - p1)) { lo = p1; hi = p99 }
    }
    var kind = o.cmap === 'viridis' || o.cmap === 'diverging' ? o.cmap
      : lo < 0 && hi > 0 && Math.min(-lo, hi) >= 0.1 * Math.max(-lo, hi) ? 'diverging' : 'viridis'
    if (kind === 'diverging') { var m = Math.max(Math.abs(lo), Math.abs(hi)); lo = -m; hi = m }
    // Ends found are rounded outward, to label well (and a grid's samples
    // fall a little short of a peak)
    var st = hi > lo ? niceStep(hi - lo, 20) : 0
    if (st > 0) { lo = Math.floor(lo / st + 1e-9) * st; hi = Math.ceil(hi / st - 1e-9) * st }
    if (isFinite(o.min) && o.min !== null) lo = o.min
    if (isFinite(o.max) && o.max !== null) hi = o.max
    if (hi < lo) { var t = lo; lo = hi; hi = t }
    if (!(hi > lo)) { var d = Math.abs(lo) * 0.1 || 1; lo -= d; hi += d }
    return { kind: kind, min: lo, max: hi }
  }
  // The diverging map: blue below its middle, a neutral gray at it, orange
  // above (the 2D graph's shading); viridis as a polynomial
  var NEG = [0.1412, 0.4392, 0.8], MID = [0.86, 0.86, 0.86], POS = [0.8118, 0.3529, 0.1216]
  var VIRIDIS = [[0.2777, 0.0054, 0.3341], [0.1051, 1.4046, 1.3846], [-0.3309, 0.2148, 0.0951], [-4.6342, -5.7991, -19.3324], [6.2283, 14.1799, 56.6906], [4.7764, -13.7451, -65.3530], [-5.4355, 4.6459, 26.3124]]
  // A color [r, g, b] (0 to 1) at t (0 to 1) along a map; the shaders' cmap
  function colormap(t, kind) {
    t = Math.min(1, Math.max(0, t))
    var out = [0, 0, 0]
    for (var c = 0; c < 3; c++) {
      if (kind === 'diverging') { var s = 2 * t - 1; out[c] = s < 0 ? MID[c] + (NEG[c] - MID[c]) * -s : MID[c] + (POS[c] - MID[c]) * s; continue }
      var v = 0
      for (var k = 6; k >= 0; k--) v = VIRIDIS[k][c] + t * v
      out[c] = Math.min(1, Math.max(0, v))
    }
    return out
  }
  // The plane axis = c through the box, where F is defined, colored by F
  function slice(F, E, box, axis, c, n) {
    var m = explicit(function (E) {
      E[axis] = c
      E.r = Math.hypot(E.x, E.y); E.theta = Math.atan2(E.y, E.x)
      return isFinite(F(E)) ? c : NaN
    }, E, box, axis, n)
    values(m, F, E)
    return m
  }
  // F at the middles of an n³ grid of cells, where it's defined: dots
  function cloud(F, E, box, n) {
    var pos = [], w = []
    for (var k = 0; k < n; k++) for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) {
      var x = box.xMin + (box.xMax - box.xMin) * (i + 0.5) / n, y = box.yMin + (box.yMax - box.yMin) * (j + 0.5) / n, z = box.zMin + (box.zMax - box.zMin) * (k + 0.5) / n
      E.x = x; E.y = y; E.z = z; E.r = Math.hypot(x, y); E.theta = Math.atan2(y, x)
      var v = F(E)
      if (isFinite(v)) { pos.push(x, y, z); w.push(v) }
    }
    E.x = 0; E.y = 0; E.z = 0; E.r = 0; E.theta = 0
    return { pos: new Float32Array(pos), w: new Float32Array(w), points: true }
  }

  // ── Camera ──────────────────────────────────────────────────────────────
  // Column-major 4 × 4 matrices. The box maps to the cube [−1, 1]³; the
  // camera turns about z (turn, from +x) and looks down at tilt.
  var FOV = 26 * Math.PI / 180, DIST = 7.6
  function perspective(aspect) {
    var f = 1 / Math.tan(FOV / 2), near = 0.5, far = 20, nf = 1 / (near - far)
    return [f / Math.max(aspect, 1e-6) * Math.min(1, aspect), 0, 0, 0, 0, f * Math.min(1, aspect), 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]
  }
  function lookAt(turn, tilt) {
    var t = turn * Math.PI / 180, e = tilt * Math.PI / 180
    var ex = DIST * Math.cos(e) * Math.cos(t), ey = DIST * Math.cos(e) * Math.sin(t), ez = DIST * Math.sin(e)
    var fx = -ex / DIST, fy = -ey / DIST, fz = -ez / DIST
    var sx = fy, sy = -fx, sl = Math.hypot(sx, sy) || 1
    sx /= sl; sy /= sl
    // up = side × forward
    var ux = sy * fz, uy = -sx * fz, uz = sx * fy - sy * fx
    return [sx, ux, -fx, 0, sy, uy, -fy, 0, 0, uz, -fz, 0, -(sx * ex + sy * ey), -(ux * ex + uy * ey + uz * ez), fx * ex + fy * ey + fz * ez, 1]
  }
  function mul(a, b) {
    var o = new Array(16)
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]
    return o
  }
  // The camera for a w × h view of the box
  function camera(box, turn, tilt, w, h) {
    var cx = (box.xMin + box.xMax) / 2, cy = (box.yMin + box.yMax) / 2, cz = (box.zMin + box.zMax) / 2
    var hx = (box.xMax - box.xMin) / 2, hy = (box.yMax - box.yMin) / 2, hz = (box.zMax - box.zMin) / 2
    var model = [1 / hx, 0, 0, 0, 0, 1 / hy, 0, 0, 0, 0, 1 / hz, 0, -cx / hx, -cy / hy, -cz / hz, 1]
    var view = lookAt(turn, tilt), proj = perspective(w / h)
    var mvp = mul(proj, mul(view, model))
    return {
      mvp: mvp, view: view, center: [cx, cy, cz], half: [hx, hy, hz], w: w, h: h,
      // A point of the graph to the canvas: [x, y, depth] in CSS pixels
      project: function (p) {
        var x = p[0], y = p[1], z = p[2]
        var X = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12], Y = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13]
        var Z = mvp[2] * x + mvp[6] * y + mvp[10] * z + mvp[14], W = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15]
        return [(X / W * 0.5 + 0.5) * w, (0.5 - Y / W * 0.5) * h, Z / W]
      },
    }
  }

  // ── Drawing ─────────────────────────────────────────────────────────────
  var f3 = function (c) { return c.map(function (v) { return v.toFixed(4) }).join(', ') }
  // The color maps, as the shaders have them: uMode 2 viridis, 3 diverging,
  // over uWRange
  var CMAP_GLSL =
    'uniform highp int uMode; uniform highp vec2 uWRange;\n' +
    'const vec3 NEG = vec3(' + f3(NEG) + '), MID = vec3(' + f3(MID) + '), POS = vec3(' + f3(POS) + ');\n' +
    'vec3 viridis(float t) {\n' +
    '  t = clamp(t, 0.0, 1.0);\n' +
    '  vec3 c0 = vec3(' + f3(VIRIDIS[0]) + '), c1 = vec3(' + f3(VIRIDIS[1]) + '), c2 = vec3(' + f3(VIRIDIS[2]) + ');\n' +
    '  vec3 c3 = vec3(' + f3(VIRIDIS[3]) + '), c4 = vec3(' + f3(VIRIDIS[4]) + '), c5 = vec3(' + f3(VIRIDIS[5]) + '), c6 = vec3(' + f3(VIRIDIS[6]) + ');\n' +
    '  return clamp(c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6))))), 0.0, 1.0);\n' +
    '}\n' +
    'vec3 cmap(float w) {\n' +
    '  float t = clamp((w - uWRange.x) / max(uWRange.y - uWRange.x, 1e-20), 0.0, 1.0);\n' +
    '  if (uMode == 3) { float s = 2.0 * t - 1.0; return s < 0.0 ? mix(MID, NEG, -s) : mix(MID, POS, s); }\n' +
    '  return viridis(t);\n' +
    '}\n'
  var SURFACE_VS = '#version 300 es\n' +
    'in vec3 aPos; in vec3 aNor; in vec2 aMesh; in float aW;\n' +
    'uniform mat4 uMVP, uView; uniform vec3 uCenter, uHalf;\n' +
    'out vec3 vData; out vec3 vN; out vec3 vEye; out vec2 vMesh; out float vW;\n' +
    'void main() {\n' +
    '  vec3 c = (aPos - uCenter) / uHalf;\n' +
    '  vData = aPos; vMesh = aMesh; vW = aW;\n' +
    '  vN = mat3(uView) * (aNor * uHalf);\n' +   // a normal scales inversely to its axes
    '  vEye = (uView * vec4(c, 1.0)).xyz;\n' +
    '  gl_Position = uMVP * vec4(aPos, 1.0);\n' +
    '}'
  var SURFACE_FS = '#version 300 es\n' +
    'precision highp float; precision highp int;\n' +
    'in vec3 vData; in vec3 vN; in vec3 vEye; in vec2 vMesh; in float vW;\n' +
    'uniform vec3 uMin, uMax, uColor, uLineColor; uniform vec2 uMeshStep; uniform float uContour, uAlpha, uLit; uniform int uContourW;\n' +
    CMAP_GLSL +
    'out vec4 o;\n' +
    'float gridLine(vec2 p) { vec2 d = abs(fract(p - 0.5) - 0.5) / max(fwidth(p), vec2(1e-6)); return min(d.x, d.y); }\n' +
    'void main() {\n' +
    '  vec3 eps = (uMax - uMin) * 1e-4;\n' +
    '  if (any(lessThan(vData, uMin - eps)) || any(greaterThan(vData, uMax + eps))) discard;\n' +
    // 1: by height, over the box; 2, 3: by the mesh's own values
    '  vec3 col = uMode == 1 ? viridis((vData.z - uMin.z) / (uMax.z - uMin.z)) : uMode >= 2 ? cmap(vW) : uColor;\n' +
    '  if (uMeshStep.x > 0.0) col = mix(col * 0.7, col, smoothstep(0.4, 1.4, gridLine(vMesh / uMeshStep)));\n' +
    '  if (uContour > 0.0) { float c = (uContourW == 1 ? vW : vData.z) / uContour; float d = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), 1e-6); col = mix(uLineColor, col, smoothstep(0.5, 1.5, d)); }\n' +
    '  vec3 v = normalize(-vEye), n = normalize(vN);\n' +
    // the side facing the viewer, whichever way the triangle winds (marching
    // tetrahedra's do both); its underside a little darker
    '  float under = dot(n, v) < 0.0 ? 1.0 : 0.0; if (under > 0.5) n = -n;\n' +
    '  vec3 L1 = normalize(vec3(-0.4, 0.75, 0.55)), L2 = normalize(vec3(0.7, -0.3, 0.4));\n' +
    '  float d1 = max(dot(n, L1), 0.0), d2 = max(dot(n, L2), 0.0), sp = pow(max(dot(n, normalize(L1 + v)), 0.0), 40.0);\n' +
    '  vec3 lit = col * (0.42 + 0.5 * d1 + 0.18 * d2) + vec3(0.12 * sp);\n' +
    '  if (under > 0.5) lit *= 0.88;\n' +
    // a slice is unlit, so its colors read true against the color bar
    '  lit = mix(col, lit, uLit);\n' +
    '  o = vec4(lit * uAlpha, uAlpha);\n' +
    '}'
  // Lines a few pixels wide: each segment a quad, widened on screen
  var LINE_VS = '#version 300 es\n' +
    'in vec3 aPos; in vec3 aOther; in float aSide; in float aW;\n' +
    'uniform mat4 uMVP; uniform vec2 uViewport; uniform float uWidth;\n' +
    'out vec3 vData; out float vW;\n' +
    'void main() {\n' +
    '  vec4 a = uMVP * vec4(aPos, 1.0), b = uMVP * vec4(aOther, 1.0);\n' +
    '  vec2 sa = a.xy / a.w * uViewport, sb = b.xy / b.w * uViewport;\n' +
    '  vec2 dir = sb - sa; float len = length(dir); dir = len > 1e-6 ? dir / len : vec2(1.0, 0.0);\n' +
    '  vec2 nrm = vec2(-dir.y, dir.x) * aSide * uWidth;\n' +
    '  vData = aPos; vW = aW;\n' +
    '  gl_Position = vec4((sa + nrm) / uViewport * a.w, a.z - 0.0015 * a.w, a.w);\n' +
    '}'
  var LINE_FS = '#version 300 es\n' +
    'precision highp float; precision highp int;\n' +
    'in vec3 vData; in float vW; uniform vec3 uMin, uMax; uniform vec4 uColor; uniform int uClip;\n' +
    CMAP_GLSL +
    'out vec4 o;\n' +
    'void main() {\n' +
    '  vec3 eps = (uMax - uMin) * 1e-4;\n' +
    '  if (uClip == 1 && (any(lessThan(vData, uMin - eps)) || any(greaterThan(vData, uMax + eps)))) discard;\n' +
    '  vec3 c = uMode >= 2 ? cmap(vW) : uColor.rgb;\n' +
    '  o = vec4(c * uColor.a, uColor.a);\n' +
    '}'
  // Dots, round, a little darker toward the rim; sized by their value when
  // uSizeBy (larger toward the map's top, or for a diverging map its ends)
  var POINT_VS = '#version 300 es\n' +
    'in vec3 aPos; in float aW;\n' +
    'uniform mat4 uMVP; uniform float uSize; uniform int uSizeBy;\n' +
    'uniform highp int uMode; uniform highp vec2 uWRange;\n' +
    'out float vW; out float vSize;\n' +
    'void main() {\n' +
    '  float t = clamp((aW - uWRange.x) / max(uWRange.y - uWRange.x, 1e-20), 0.0, 1.0);\n' +
    '  float s = uMode == 3 ? abs(2.0 * t - 1.0) : t;\n' +
    '  vW = aW;\n' +
    '  vSize = uSize * (uSizeBy == 1 ? 0.3 + 0.7 * s : 1.0);\n' +
    '  gl_PointSize = vSize;\n' +
    '  gl_Position = uMVP * vec4(aPos, 1.0);\n' +
    '}'
  var POINT_FS = '#version 300 es\n' +
    'precision highp float; precision highp int;\n' +
    'in float vW; in float vSize; uniform float uAlpha;\n' +
    CMAP_GLSL +
    'out vec4 o;\n' +
    'void main() {\n' +
    '  vec2 d = gl_PointCoord * 2.0 - 1.0; float r = length(d);\n' +
    '  float a = uAlpha * (1.0 - smoothstep(1.0 - 2.0 / max(vSize, 2.0), 1.0, r));\n' +
    '  if (a <= 0.0) discard;\n' +
    '  o = vec4(cmap(vW) * (1.0 - 0.3 * r * r) * a, a);\n' +
    '}'

  // A renderer on its own canvas: draw() a frame, then copy the canvas over
  function renderer(doc) {
    var cv = doc.createElement('canvas'), gl = null, progS = null, progL = null, progP = null, U = {}, failed = false
    function compile(vs, fs, attrs) {
      var mk = function (type, src) {
        var s = gl.createShader(type)
        gl.shaderSource(s, src); gl.compileShader(s)
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
        return s
      }
      var p = gl.createProgram()
      gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs))
      attrs.forEach(function (a, i) { gl.bindAttribLocation(p, i, a) })
      gl.linkProgram(p)
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p))
      return p
    }
    function init() {
      if (gl || failed) return !!gl
      try {
        gl = cv.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true })
        if (!gl) throw new Error('no WebGL 2')
        progS = compile(SURFACE_VS, SURFACE_FS, ['aPos', 'aNor', 'aMesh', 'aW'])
        progL = compile(LINE_VS, LINE_FS, ['aPos', 'aOther', 'aSide', 'aW'])
        progP = compile(POINT_VS, POINT_FS, ['aPos', 'aW'])
        ;['uMVP', 'uView', 'uCenter', 'uHalf', 'uMin', 'uMax', 'uColor', 'uLineColor', 'uMode', 'uMeshStep', 'uContour', 'uAlpha', 'uLit', 'uContourW', 'uWRange'].forEach(function (n) { U['s' + n] = gl.getUniformLocation(progS, n) })
        ;['uMVP', 'uViewport', 'uWidth', 'uMin', 'uMax', 'uColor', 'uClip', 'uMode', 'uWRange'].forEach(function (n) { U['l' + n] = gl.getUniformLocation(progL, n) })
        ;['uMVP', 'uSize', 'uSizeBy', 'uMode', 'uWRange', 'uAlpha'].forEach(function (n) { U['p' + n] = gl.getUniformLocation(progP, n) })
        return true
      } catch (e) {
        failed = true; gl = null
        return false
      }
    }
    // GPU buffers for a mesh, made once and kept with it: arrays [[data,
    // size], …] at attributes 0, 1, … (null leaves one at its constant 0)
    function upload(m, arrays) {
      if (m.vao && m.gl === gl) return m
      m.gl = gl
      m.vao = gl.createVertexArray()
      gl.bindVertexArray(m.vao)
      m.buffers = arrays.map(function (a, i) {
        if (!a) return null
        var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a[0], gl.STATIC_DRAW)
        gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, a[1], gl.FLOAT, false, 0, 0)
        return b
      })
      if (m.idx) { m.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW) }
      gl.bindVertexArray(null)
      return m
    }
    // Polylines to quads: [[p, p, …], …] → a mesh for the line program;
    // wOf(p), when given, a value at each point to color it by
    function lines(runs, wOf) {
      var pos = [], other = [], side = [], idx = [], w = wOf ? [] : null
      runs.forEach(function (run) {
        for (var i = 0; i < run.length - 1; i++) {
          var a = run[i], b = run[i + 1], base = pos.length / 3
          pos.push(a[0], a[1], a[2], a[0], a[1], a[2], b[0], b[1], b[2], b[0], b[1], b[2])
          other.push(b[0], b[1], b[2], b[0], b[1], b[2], a[0], a[1], a[2], a[0], a[1], a[2])
          side.push(1, -1, -1, 1)
          idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
          if (w) { var wa = wOf(a), wb = wOf(b); w.push(wa, wa, wb, wb) }
        }
      })
      return { pos: new Float32Array(pos), nor: new Float32Array(other), mesh: new Float32Array(side), idx: new Uint32Array(idx), w: w && new Float32Array(w), line: true }
    }
    function free(m) {
      if (!m || !m.vao || m.gl !== gl || !gl) return
      m.buffers.forEach(function (b) { if (b) gl.deleteBuffer(b) })
      if (m.ib) gl.deleteBuffer(m.ib)
      gl.deleteVertexArray(m.vao)
      m.vao = null
    }
    function rgb(c) {
      var n = parseInt(String(c).replace('#', '').slice(0, 6), 16)
      return isFinite(n) ? [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255] : [0.5, 0.5, 0.5]
    }
    // One frame: surfaces [{ mesh, color, mode, wRange, lit, meshStep,
    // contour, contourW, lineColor, alpha }], lines [{ mesh, color, mode,
    // wRange, alpha, width, clip }], dots [{ mesh, mode, wRange, size,
    // sizeBy }]. See-through surfaces go last, over the rest, without
    // hiding one another. Returns the canvas, or null without WebGL
    function draw(cam, box, w, h, dpr, surfaces, lineSets, dots) {
      if (!init()) return null
      var W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr))
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H }
      gl.viewport(0, 0, W, H)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.enable(gl.DEPTH_TEST)
      gl.depthMask(true)
      gl.disable(gl.CULL_FACE)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.vertexAttrib1f(3, 0)
      var mn = [box.xMin, box.yMin, box.zMin], mx = [box.xMax, box.yMax, box.zMax]
      var mvp = new Float32Array(cam.mvp)
      gl.useProgram(progS)
      gl.uniformMatrix4fv(U.suMVP, false, mvp)
      gl.uniformMatrix4fv(U.suView, false, new Float32Array(cam.view))
      gl.uniform3fv(U.suCenter, cam.center); gl.uniform3fv(U.suHalf, cam.half)
      gl.uniform3fv(U.suMin, mn); gl.uniform3fv(U.suMax, mx)
      var surface = function (s) {
        if (!s.mesh.idx.length) return
        var m = s.mesh
        upload(m, [[m.pos, 3], [m.nor, 3], [m.mesh, 2], m.w ? [m.w, 1] : null])
        gl.uniform3fv(U.suColor, rgb(s.color)); gl.uniform3fv(U.suLineColor, rgb(s.lineColor || '#000000'))
        gl.uniform1i(U.suMode, s.mode || 0)
        gl.uniform2fv(U.suWRange, s.wRange || [0, 1])
        gl.uniform1f(U.suLit, s.lit == null ? 1 : s.lit)
        gl.uniform2fv(U.suMeshStep, s.meshStep || [0, 0])
        gl.uniform1f(U.suContour, s.contour || 0)
        gl.uniform1i(U.suContourW, s.contourW ? 1 : 0)
        gl.uniform1f(U.suAlpha, s.alpha == null ? 1 : s.alpha)
        gl.bindVertexArray(m.vao)
        gl.drawElements(gl.TRIANGLES, m.idx.length, gl.UNSIGNED_INT, 0)
      }
      var clear = surfaces.filter(function (s) { return s.alpha < 1 })
      surfaces.forEach(function (s) { if (!(s.alpha < 1)) surface(s) })
      if (dots && dots.length) {
        gl.useProgram(progP)
        gl.uniformMatrix4fv(U.puMVP, false, mvp)
        dots.forEach(function (d) {
          var m = d.mesh, count = m.w.length
          if (!count) return
          upload(m, [[m.pos, 3], [m.w, 1]])
          gl.uniform1i(U.puMode, d.mode || 2)
          gl.uniform2fv(U.puWRange, d.wRange || [0, 1])
          gl.uniform1f(U.puSize, (d.size || 8) * dpr)
          gl.uniform1i(U.puSizeBy, d.sizeBy ? 1 : 0)
          gl.uniform1f(U.puAlpha, d.alpha == null ? 1 : d.alpha)
          gl.bindVertexArray(m.vao)
          gl.drawArrays(gl.POINTS, 0, count)
        })
      }
      gl.useProgram(progL)
      gl.uniformMatrix4fv(U.luMVP, false, mvp)
      gl.uniform2f(U.luViewport, W / 2, H / 2)
      gl.uniform3fv(U.luMin, mn); gl.uniform3fv(U.luMax, mx)
      lineSets.forEach(function (l) {
        if (!l.mesh.idx.length) return
        var m = l.mesh
        upload(m, [[m.pos, 3], [m.nor, 3], [m.mesh, 1], m.w ? [m.w, 1] : null])
        var c = rgb(l.color)
        gl.uniform4f(U.luColor, c[0], c[1], c[2], l.alpha == null ? 1 : l.alpha)
        gl.uniform1i(U.luMode, l.mode || 0)
        gl.uniform2fv(U.luWRange, l.wRange || [0, 1])
        gl.uniform1f(U.luWidth, (l.width || 2) * dpr / 2)
        gl.uniform1i(U.luClip, l.clip === false ? 0 : 1)
        gl.bindVertexArray(m.vao)
        gl.drawElements(gl.TRIANGLES, m.idx.length, gl.UNSIGNED_INT, 0)
      })
      if (clear.length) {
        gl.useProgram(progS)
        gl.depthMask(false)
        clear.forEach(surface)
        gl.depthMask(true)
      }
      gl.bindVertexArray(null)
      return cv
    }
    return { init: init, draw: draw, lines: lines, free: free, available: function () { return init() } }
  }

  // Tick spacing: about `count` ticks across a range
  function niceStep(span, count) {
    var raw = span / count, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p
  }

  return {
    explicit: explicit, parametric: parametric, implicit: implicit, curve: curve, sample: sample,
    values: values, usedValues: usedValues, fillMissing: fillMissing, colorScale: colorScale, colormap: colormap, slice: slice, cloud: cloud,
    camera: camera, renderer: renderer, niceStep: niceStep,
  }
}

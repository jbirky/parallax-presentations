// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The numerics behind Graph's fields (graphParser reads their lines):
// paths by Dormand–Prince 5(4) with error control, evenly spaced
// streamlines (Jobard and Lefer), equilibria by Newton's method from a grid
// of guesses, classified from the Jacobian, and saddles' separatrices.
// (Nullclines use graphRuntime's contours.) Like createMathParser it has nothing from outside it:
// the graph page embeds its source (graphPage.js).

export function graphFields() {
  'use strict'

  // ── Integrating: Dormand–Prince 5(4) with error control ──────────────

  var A = [[], [1 / 5], [3 / 40, 9 / 40], [44 / 45, -56 / 15, 32 / 9], [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
    [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656], [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84]]
  var C = [0, 0.2, 0.3, 0.8, 8 / 9, 1, 1]
  var E = [71 / 57600, 0, -71 / 16695, 71 / 1920, -17253 / 339200, 22 / 525, -1 / 40]
  // f(t, s, out) for an n-vector s. Steps from (t, s) toward tEnd, calling
  // each(t, s) after every accepted step until it returns false.
  // opts: atol, rtol, h0, hmax(t, s, ds) for drawing resolution, maxSteps
  function dopri(f, n, t0, s0, tEnd, opts, each) {
    var dir = tEnd >= t0 ? 1 : -1, t = t0, s = s0.slice(), h = (opts.h0 || 1e-2) * dir
    var k = [], tmp = new Array(n), sn = new Array(n), steps = 0, maxSteps = opts.maxSteps || 20000
    for (var i = 0; i < 7; i++) k.push(new Array(n))
    var atol = opts.atol || 1e-9, rtol = opts.rtol || 1e-9
    f(t, s, k[0])
    while (dir * (tEnd - t) > 1e-14 * Math.max(1, Math.abs(t)) && steps < maxSteps) {
      if (dir * (t + h - tEnd) > 0) h = tEnd - t
      if (opts.hmax) { var hm = opts.hmax(t, s, k[0]); if (Math.abs(h) > hm) h = hm * dir }
      for (var st = 1; st < 7; st++) {
        for (var j = 0; j < n; j++) { var acc = s[j]; for (var q = 0; q < st; q++) acc += h * A[st][q] * k[q][j]; tmp[j] = acc }
        f(t + h * C[st], tmp, k[st])
        if (st === 6) for (j = 0; j < n; j++) sn[j] = tmp[j]
      }
      var err = 0
      for (j = 0; j < n; j++) {
        var ej = 0
        for (q = 0; q < 7; q++) ej += E[q] * k[q][j]
        ej *= h
        var sc = atol + rtol * Math.max(Math.abs(s[j]), Math.abs(sn[j]))
        err += (ej / sc) * (ej / sc)
      }
      err = Math.sqrt(err / n)
      if (!isFinite(err)) { h *= 0.25; if (Math.abs(h) < 1e-14) return 'blowup'; f(t, s, k[0]); steps++; continue }
      var fac = Math.min(5, Math.max(0.2, 0.9 * Math.pow(err || 1e-10, -0.2)))
      if (err <= 1) {
        t += h; for (j = 0; j < n; j++) s[j] = sn[j]
        for (j = 0; j < n; j++) k[0][j] = k[6][j]                       // first same as last
        steps++
        if (each(t, s, k[0]) === false) return 'stopped'
        h *= fac
      } else h *= Math.max(0.2, fac)
      if (Math.abs(h) < 1e-13 * Math.max(1, Math.abs(t))) return 'stiff'
    }
    return steps >= maxSteps ? 'steps' : 'end'
  }

  // A trajectory of a planar field from (x0, y0), forward (dir 1) or backward
  // (-1), stopping where it leaves `box` (with margin), comes to rest, or
  // closes on itself. Returns { pts: [[x, y, t]], closed, end }
  function trajectory(F, env, x0, y0, dir, box, opts) {
    opts = opts || {}
    var span = Math.max(box.xMax - box.xMin, box.yMax - box.yMin), out = [0, 0]
    var mx = (box.xMax - box.xMin) * 0.5, my = (box.yMax - box.yMin) * 0.5
    var pts = [[x0, y0, 0]], closed = false, left = false, len = 0, eps = span * 0.004, fastest = 0
    var f = function (t, s, o) { F(env, s[0], s[1], out); o[0] = dir * out[0]; o[1] = dir * out[1] }
    var res = dopri(f, 2, 0, [x0, y0], opts.tMax || 1e3, {
      atol: span * 1e-8, rtol: 1e-8, h0: 1e-3, maxSteps: opts.maxSteps || 30000,
      // Steps short enough to draw: at most 1/300 of the view
      hmax: function (t, s, ds) { var sp = Math.hypot(ds[0], ds[1]); return sp > 0 ? span / 300 / sp : 1e3 },
    }, function (t, s, ds) {
      var p = pts[pts.length - 1]
      len += Math.hypot(s[0] - p[0], s[1] - p[1])
      pts.push([s[0], s[1], dir * t])
      if (!(isFinite(s[0]) && isFinite(s[1]))) return false
      if (s[0] < box.xMin - mx || s[0] > box.xMax + mx || s[1] < box.yMin - my || s[1] > box.yMax + my) return false
      // At rest: a millionth of the fastest it went, or hardly moving over its
      // last 50 steps (below the tolerance, the speed itself is noise)
      var speed = Math.hypot(ds[0], ds[1])
      if (speed > fastest) fastest = speed
      if (speed < span * 1e-12 || speed < fastest * 1e-6) return false
      var back = pts[pts.length - 51]
      if (back && Math.hypot(s[0] - back[0], s[1] - back[1]) < span * 1e-6) return false
      var d = Math.hypot(s[0] - x0, s[1] - y0)
      if (d > 3 * eps) left = true
      if (left && d < eps && len > 8 * eps) { closed = true; pts.push([x0, y0, dir * t]); return false }
    })
    return { pts: pts, closed: closed, end: closed ? 'closed' : res }
  }
  // dy/dx = f(x, y) through (x0, y0), across [xMin, xMax]: [[x, y]]
  function solution(f, env, x0, y0, box) {
    var span = box.yMax - box.yMin, my = span * 2, out = []
    ;[-1, 1].forEach(function (dir) {
      var seg = [[x0, y0]]
      var g = function (x, s, o) { o[0] = f(env, x, s[0]) }
      dopri(g, 1, x0, [y0], dir > 0 ? box.xMax : box.xMin, {
        atol: span * 1e-9, rtol: 1e-9, h0: (box.xMax - box.xMin) / 1000, maxSteps: 20000,
        hmax: function (x, s, ds) { var w = (box.xMax - box.xMin) / 400; return Math.min(w, Math.abs(ds[0]) > 0 ? span / 300 / Math.abs(ds[0]) : w) },
      }, function (x, s) {
        seg.push([x, s[0]])
        if (!isFinite(s[0]) || s[0] < box.yMin - my || s[0] > box.yMax + my) return false
      })
      if (dir < 0) seg.reverse()
      out = dir < 0 ? seg : out.concat(seg.slice(1))
    })
    return out
  }

  // ── Equilibria: Newton from a grid of seeds, classified by the Jacobian

  function jacobian(F, env, x, y, h) {
    var a = [0, 0], b = [0, 0]
    F(env, x + h, y, a); F(env, x - h, y, b)
    var j11 = (a[0] - b[0]) / (2 * h), j21 = (a[1] - b[1]) / (2 * h)
    F(env, x, y + h, a); F(env, x, y - h, b)
    return [[j11, (a[0] - b[0]) / (2 * h)], [j21, (a[1] - b[1]) / (2 * h)]]
  }
  // The linearization's kind, eigenvalues and (when real) eigenvectors
  function classify(J) {
    var a = J[0][0], b = J[0][1], c = J[1][0], d = J[1][1]
    var tr = a + d, det = a * d - b * c, disc = tr * tr - 4 * det
    var s2 = Math.max(tr * tr, Math.abs(det), 1e-300), tiny = 1e-8 * s2, tinyT = 1e-5 * Math.sqrt(s2)
    var kind, stable = tr < 0
    if (det < -tiny) kind = 'saddle'
    else if (Math.abs(det) <= tiny) kind = 'degenerate'
    else if (disc < -tiny) kind = Math.abs(tr) <= tinyT ? 'center' : stable ? 'stable spiral' : 'unstable spiral'
    else if (Math.abs(disc) <= tiny) kind = stable ? 'stable degenerate node' : 'unstable degenerate node'
    else kind = stable ? 'stable node' : 'unstable node'
    var eig, vecs = null
    if (disc >= 0) {
      var r = Math.sqrt(Math.max(0, disc)), l1 = (tr - r) / 2, l2 = (tr + r) / 2
      eig = [[l1, 0], [l2, 0]]
      var vec = function (l) {
        var v = Math.abs(b) > Math.abs(c) ? [b, l - a] : Math.abs(c) > 0 ? [l - d, c] : (Math.abs(l - a) < Math.abs(l - d) ? [1, 0] : [0, 1])
        var m = Math.hypot(v[0], v[1]) || 1
        return [v[0] / m, v[1] / m]
      }
      vecs = [vec(l1), vec(l2)]
    } else eig = [[tr / 2, Math.sqrt(-disc) / 2], [tr / 2, -Math.sqrt(-disc) / 2]]
    return { kind: kind, trace: tr, det: det, eig: eig, vecs: vecs }
  }
  function equilibria(F, env, box, opts) {
    opts = opts || {}
    var span = Math.max(box.xMax - box.xMin, box.yMax - box.yMin), h = span * 1e-6
    var nx = opts.nx || 14, ny = opts.ny || 10, found = [], out = [0, 0]
    var mx = (box.xMax - box.xMin) * 0.04, my = (box.yMax - box.yMin) * 0.04
    var scale = 0, samples = 0
    for (var i = 0; i <= nx; i++) for (var j = 0; j <= ny; j++) {
      F(env, box.xMin + (box.xMax - box.xMin) * i / nx, box.yMin + (box.yMax - box.yMin) * j / ny, out)
      var m = Math.hypot(out[0], out[1]); if (isFinite(m)) { scale += m; samples++ }
    }
    scale = samples ? scale / samples : 1
    for (i = 0; i < nx; i++) for (j = 0; j < ny; j++) {
      var x = box.xMin + (box.xMax - box.xMin) * (i + 0.5) / nx, y = box.yMin + (box.yMax - box.yMin) * (j + 0.5) / ny
      for (var it = 0; it < 40; it++) {
        F(env, x, y, out)
        if (!isFinite(out[0]) || !isFinite(out[1])) break
        var J = jacobian(F, env, x, y, h), det = J[0][0] * J[1][1] - J[0][1] * J[1][0]
        if (!det || !isFinite(det)) break
        var dx = (J[1][1] * out[0] - J[0][1] * out[1]) / det, dy = (-J[1][0] * out[0] + J[0][0] * out[1]) / det
        // Damped when it would jump far: Newton is local
        var stepLen = Math.hypot(dx, dy), lim = span * 0.25
        if (stepLen > lim) { dx *= lim / stepLen; dy *= lim / stepLen }
        x -= dx; y -= dy
        if (stepLen < span * 1e-13) break
      }
      F(env, x, y, out)
      if (!(Math.hypot(out[0], out[1]) <= scale * 1e-9 + 1e-14)) continue
      if (x < box.xMin - mx || x > box.xMax + mx || y < box.yMin - my || y > box.yMax + my) continue
      if (found.some(function (p) { return Math.hypot(p.x - x, p.y - y) < span * 1e-5 })) continue
      found.push({ x: x, y: y })
    }
    found.forEach(function (p) { var c = classify(jacobian(F, env, p.x, p.y, h)); for (var k in c) p[k] = c[k] })
    found.sort(function (a, b) { return a.x - b.x || a.y - b.y })
    return found
  }
  // A saddle's four separatrices: stable ones traced backward, unstable forward
  function separatrices(F, env, eq, box) {
    if (eq.kind !== 'saddle' || !eq.vecs) return []
    var span = Math.max(box.xMax - box.xMin, box.yMax - box.yMin), e = span * 1e-4, out = []
    eq.vecs.forEach(function (v, i) {
      var unstable = eq.eig[i][0] > 0
      ;[1, -1].forEach(function (sgn) {
        var tr = trajectory(F, env, eq.x + sgn * e * v[0], eq.y + sgn * e * v[1], unstable ? 1 : -1, box, { tMax: 200 })
        tr.unstable = unstable
        out.push(tr)
      })
    })
    return out
  }

  // ── Evenly spaced streamlines (Jobard and Lefer, 1997), in pixels
  // V(px, py, out): the field's direction at a pixel. W × H pixels, lines
  // dsep apart. Returns [{ pts: [[px, py]], loop }], each running with the flow
  function streamlines(V, W, H, dsep, opts) {
    opts = opts || {}
    var dtest = dsep * (opts.test || 0.5), step = Math.max(0.6, dsep / 16), cell = dsep
    var cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1, grid = new Array(cols * rows)
    var lines = [], v = [0, 0], maxLen = opts.maxLen || 4 * (W + H), budget = opts.budget || 4e5
    function cellOf(x, y) { var c = Math.floor(x / cell), r = Math.floor(y / cell); return c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c }
    // Whether (x, y) is at least d from every other line, and from this
    // line's own points more than `skip` steps along it from here (sAt)
    function free(x, y, d, own, sAt) {
      if (x < 0 || y < 0 || x > W || y > H) return false
      var c0 = Math.floor(x / cell), r0 = Math.floor(y / cell), d2 = d * d
      for (var r = r0 - 1; r <= r0 + 1; r++) for (var c = c0 - 1; c <= c0 + 1; c++) {
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue
        var k = r * cols + c, lists = [grid[k], own ? own[k] : null]
        for (var L = 0; L < 2; L++) {
          var list = lists[L]
          if (!list) continue
          for (var i = 0; i < list.length; i++) {
            var p = list[i]
            if (L === 1 && Math.abs(p[2] - sAt) < skip) continue
            var dx = p[0] - x, dy = p[1] - y
            if (dx * dx + dy * dy < d2) return false
          }
        }
      }
      return true
    }
    var skip = Math.ceil(2.2 * dsep / step)
    function dirAt(x, y, sgn, o) {
      V(x, y, v)
      var m = Math.hypot(v[0], v[1])
      if (!(m > 0) || !isFinite(m)) return false
      o[0] = sgn * v[0] / m; o[1] = sgn * v[1] / m
      return true
    }
    var k1 = [0, 0], k2 = [0, 0], k3 = [0, 0], k4 = [0, 0]
    // One way from the seed, keeping its points in `own` by arc index (+
    // forward, − backward) so the line can't run into itself
    function grow(x, y, sgn, own) {
      var pts = [], len = 0, sx = x, sy = y
      for (var n = 1; n < maxLen / step && budget > 0; n++, budget--) {
        if (!dirAt(x, y, sgn, k1)) break
        if (!dirAt(x + k1[0] * step / 2, y + k1[1] * step / 2, sgn, k2)) break
        if (!dirAt(x + k2[0] * step / 2, y + k2[1] * step / 2, sgn, k3)) break
        if (!dirAt(x + k3[0] * step, y + k3[1] * step, sgn, k4)) break
        var nx = x + step * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6, ny = y + step * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6
        // A sharp turn means a sink, a source or a singular point: stop there
        if ((nx - x) * k1[0] + (ny - y) * k1[1] < 0.2 * step) break
        if (!free(nx, ny, dtest, own, sgn * n)) {
          // Back round to its own seed: a closed loop
          if (len > 3 * dsep && Math.hypot(nx - sx, ny - sy) < dsep * 0.75) { pts.push([sx, sy]); pts.loop = true }
          break
        }
        pts.push([nx, ny]); len += step; x = nx; y = ny
        var k = cellOf(nx, ny)
        if (k >= 0) (own[k] = own[k] || []).push([nx, ny, sgn * n])
      }
      return pts
    }
    function add(line, id) {
      line.forEach(function (p) { var k = cellOf(p[0], p[1]); if (k >= 0) (grid[k] = grid[k] || []).push([p[0], p[1], id]) })
    }
    var queue = [], id = 0
    function tryLine(x, y) {
      if (!free(x, y, dsep, null, 0)) return false
      var own = {}, fwd = grow(x, y, 1, own), back = fwd.loop ? [] : grow(x, y, -1, own)
      var line = back.reverse().concat([[x, y]], fwd)
      if (line.length * step < (opts.minLen || dsep * 0.6)) return false
      var obj = { pts: line, loop: !!fwd.loop }
      add(line, id++)
      lines.push(obj)
      // Seeds a separation away on either side
      var every = Math.max(1, Math.round(dsep / step / 2))
      for (var i = 0; i < line.length - 1; i += every) {
        var p = line[i], q = line[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], m = Math.hypot(dx, dy) || 1
        queue.push([p[0] - dy / m * dsep, p[1] + dx / m * dsep], [p[0] + dy / m * dsep, p[1] - dx / m * dsep])
      }
      return true
    }
    tryLine(W / 2 + 0.37, H / 2 + 0.41)
    // Then regions no line reached, from a grid of seeds, each tried once
    // (a seed where the field is zero or undefined starts nothing)
    var tried = {}
    for (var pass = 0; pass < 4 && budget > 0; pass++) {
      while (queue.length && budget > 0) { var sd = queue.shift(); tryLine(sd[0], sd[1]) }
      var more = false
      for (var gy = dsep / 2; gy < H && budget > 0; gy += dsep) for (var gx = dsep / 2; gx < W; gx += dsep) {
        var key = gx + ',' + gy
        if (tried[key] || !free(gx, gy, dsep, null, 0)) continue
        tried[key] = true
        if (tryLine(gx + 0.13, gy + 0.17)) more = true
        while (queue.length && budget > 0) { sd = queue.shift(); tryLine(sd[0], sd[1]) }
      }
      if (!more) break
    }
    return lines
  }

  return {
    dopri: dopri, trajectory: trajectory, solution: solution, jacobian: jacobian, classify: classify,
    equilibria: equilibria, separatrices: separatrices, streamlines: streamlines,
  }
}

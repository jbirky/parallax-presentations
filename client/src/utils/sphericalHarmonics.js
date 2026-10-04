// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Spherical harmonics (toolbar: Diagrams → Spherical Harmonics): the math.
// Associated Legendre functions by stable recurrences, the conventions
// (Condon–Shortley phase, four normalizations, complex or real), typed sums
// like "(s + p_x + p_y + p_z)/2", exact closed forms, a polar cap's and a
// random sky's coefficients, synthesis on a θ × φ grid, and the meshes and
// map projections harmonicsView.js draws.
//
// θ is the polar angle from +z and φ the azimuth from +x (ISO 80000-2, as
// physics texts and SciPy's sph_harm_y have them). harmonicsCore uses nothing
// outside itself, so a deck carries its source (harmonicsDeckScript).

/* global BigInt */
export function harmonicsCore() {
  var PI = Math.PI

  // ---------- Associated Legendre functions, orthonormal on the sphere
  // y(l, m) = √((2l+1)/4π · (l−m)!/(l+m)!) P_l^m(cos θ) for m ≥ 0, with the
  // Condon–Shortley phase, by the usual stable recurrences (fine past l = 100)
  function idx(l, m) { return l * (l + 1) / 2 + m }
  function legendre(L, x, s, out) {
    out = out || new Float64Array((L + 1) * (L + 2) / 2)
    var ymm = 1 / Math.sqrt(4 * PI)
    for (var m = 0; m <= L; m++) {
      if (m > 0) ymm *= -Math.sqrt((2 * m + 1) / (2 * m)) * s
      out[idx(m, m)] = ymm
      if (m + 1 <= L) out[idx(m + 1, m)] = Math.sqrt(2 * m + 3) * x * ymm
      for (var l = m + 2; l <= L; l++) {
        var a = Math.sqrt((4 * l * l - 1) / (l * l - m * m))
        var b = Math.sqrt(((l - 1) * (l - 1) - m * m) / (4 * (l - 1) * (l - 1) - 1))
        out[idx(l, m)] = a * (x * out[idx(l - 1, m)] - b * out[idx(l - 2, m)])
      }
    }
    return out
  }
  // (l−m)!/(l+m)!
  function factRatio(l, m) { var r = 1; for (var k = l - m + 1; k <= l + m; k++) r /= k; return r }

  // ---------- Conventions
  var NORMS = ['orthonormal', '4pi', 'schmidt', 'unnormalized']
  // Each basis function as a multiple of the orthonormal one
  function normFactor(l, m, form, norm) {
    var am = Math.abs(m)
    if (norm === '4pi') return Math.sqrt(4 * PI)
    if (norm === 'schmidt') return Math.sqrt(4 * PI / (2 * l + 1))
    if (norm === 'unnormalized') {
      var N = Math.sqrt((2 * l + 1) / (4 * PI) * factRatio(l, am))
      return 1 / (N * (form === 'real' && am ? Math.SQRT2 : 1))
    }
    return 1
  }

  // ---------- Coefficients: f = Σ_l Σ_{m≥0} y(l,m)(θ) [A cos mφ + B sin mφ],
  // A and B complex. Every basis function, complex or real, lands in this form.
  function coefs(L) {
    var n = (L + 1) * (L + 2) / 2
    return { L: L, Ar: new Float64Array(n), Ai: new Float64Array(n), Br: new Float64Array(n), Bi: new Float64Array(n), terms: 0 }
  }
  // Add c·(basis function), c = [re, im]
  function addTerm(C, t, conv) {
    var l = t.l, m = t.m, am = Math.abs(m), k = idx(l, am)
    var f = normFactor(l, m, t.form, conv.norm), cr = t.c[0] * f, ci = t.c[1] * f
    var sg = am % 2 ? -1 : 1
    if (t.form === 'real') {
      // Y_{l,m} = √2 (−1)^m Re Y_l^m (m > 0), √2 (−1)^m Im Y_l^|m| (m < 0):
      // positive lobes on +x, +y whatever the complex phase convention
      if (m === 0) { C.Ar[k] += cr; C.Ai[k] += ci }
      else if (m > 0) { C.Ar[k] += Math.SQRT2 * sg * cr; C.Ai[k] += Math.SQRT2 * sg * ci }
      else { C.Br[k] += Math.SQRT2 * sg * cr; C.Bi[k] += Math.SQRT2 * sg * ci }
    } else {
      // Without Condon–Shortley, Y_l^m loses its (−1)^m for m > 0, so that
      // Y_l^{−m} = conj(Y_l^m)
      if (!conv.cs && m > 0) { cr *= sg; ci *= sg }
      if (m >= 0) {            // y e^{imφ}: A += c, B += i c
        C.Ar[k] += cr; C.Ai[k] += ci
        if (m > 0) { C.Br[k] -= ci; C.Bi[k] += cr }
      } else {                 // Y_l^{−|m|} = (−1)^|m| y e^{−i|m|φ}
        C.Ar[k] += sg * cr; C.Ai[k] += sg * ci
        C.Br[k] += sg * ci; C.Bi[k] -= sg * cr
      }
    }
    C.terms++
  }
  function fromTerms(terms, conv) {
    var L = 0
    terms.forEach(function (t) { if (t.l > L) L = t.l })
    var C = coefs(L)
    terms.forEach(function (t) { addTerm(C, t, conv) })
    return C
  }

  // A polar cap (1 inside, 0 outside) of half-angle α about (θ0, φ0), kept to
  // l ≤ L. About +z only m = 0 survives: a_l = 2π √((2l+1)/4π) ∫_{cos α}^1 P_l
  // = 2π √((2l+1)/4π) (P_{l−1} − P_{l+1})(cos α)/(2l+1); the addition theorem
  // turns it to (θ0, φ0): a_lm = √(4π/(2l+1)) a_l conj(Y_l^m(θ0, φ0)).
  function capCoefs(theta0, phi0, alpha, L) {
    var c = Math.cos(alpha), P = [1, c]
    for (var l = 1; l <= L; l++) P[l + 1] = ((2 * l + 1) * c * P[l] - l * P[l - 1]) / (l + 1)
    var C = coefs(L), y = legendre(L, Math.cos(theta0), Math.sin(theta0))
    for (l = 0; l <= L; l++) {
      var al = 2 * PI * Math.sqrt((2 * l + 1) / (4 * PI)) * (l === 0 ? 1 - c : (P[l - 1] - P[l + 1]) / (2 * l + 1))
      var w = al * Math.sqrt(4 * PI / (2 * l + 1))
      for (var m = 0; m <= l; m++) {
        // Σ_m conj(Y_l^m(n0)) Y_l^m(n), a real field: the m and −m terms pair
        // into 2 y0 y (cos mφ0 cos mφ + sin mφ0 sin mφ)
        var k = idx(l, m), yy = w * y[k] * (m ? 2 : 1)
        C.Ar[k] += yy * Math.cos(m * phi0); C.Br[k] += yy * Math.sin(m * phi0)
      }
    }
    C.terms = (L + 1) * (L + 1)
    return C
  }

  // Gaussian random field: real a_lm ~ N(0, C_l), C_l = l^−slope, l ≥ lmin
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  function skyCoefs(seed, slope, L, lmin) {
    var rand = rng(seed * 7919 + 1), C = coefs(L)
    var gauss = function () { var u = 1 - rand(), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * PI * v) }
    for (var l = 0; l <= L; l++) {
      for (var m = 0; m <= l; m++) {
        // Draw every coefficient even below lmin, so raising lmax only adds
        // detail: the big features stay where they were
        var g1 = gauss(), g2 = gauss()
        if (l < lmin) continue
        var sd = Math.pow(l, -slope / 2), k = idx(l, m)
        C.Ar[k] = sd * g1 * (m ? Math.SQRT2 : 1)
        if (m) C.Br[k] = sd * g2 * Math.SQRT2
      }
    }
    C.terms = (L + 1) * (L + 1)
    return C
  }

  // ---------- Synthesis on a θ × φ grid: separable, rings then Fourier columns,
  // O(L² nθ + L nθ nφ) instead of a sum over every harmonic at every point
  function synth(C, thetas, phis) {
    var L = C.L, nt = thetas.length, np = phis.length
    var re = new Float64Array(nt * np), im = new Float64Array(nt * np)
    var cs = new Float64Array((L + 1) * np), sn = new Float64Array((L + 1) * np)
    for (var j = 0; j < np; j++) for (var m = 0; m <= L; m++) { cs[m * np + j] = Math.cos(m * phis[j]); sn[m * np + j] = Math.sin(m * phis[j]) }
    var y = new Float64Array((L + 1) * (L + 2) / 2)
    var ar = new Float64Array(L + 1), ai = new Float64Array(L + 1), br = new Float64Array(L + 1), bi = new Float64Array(L + 1)
    for (var i = 0; i < nt; i++) {
      legendre(L, Math.cos(thetas[i]), Math.sin(thetas[i]), y)
      for (m = 0; m <= L; m++) {
        var sar = 0, sai = 0, sbr = 0, sbi = 0
        for (var l = m; l <= L; l++) {
          var k = idx(l, m), v = y[k]
          sar += v * C.Ar[k]; sai += v * C.Ai[k]; sbr += v * C.Br[k]; sbi += v * C.Bi[k]
        }
        ar[m] = sar; ai[m] = sai; br[m] = sbr; bi[m] = sbi
      }
      for (j = 0; j < np; j++) {
        var r = 0, q = 0
        for (m = 0; m <= L; m++) {
          var c = cs[m * np + j], s = sn[m * np + j]
          r += ar[m] * c + br[m] * s; q += ai[m] * c + bi[m] * s
        }
        re[i * np + j] = r; im[i * np + j] = q
      }
    }
    return { re: re, im: im }
  }
  // One value, for checks and readouts
  function evalAt(C, theta, phi) {
    var g = synth(C, [theta], [phi])
    return [g.re[0], g.im[0]]
  }

  // ---------- Names
  var ORBITALS = [
    ['s'],
    ['p_y', 'p_z', 'p_x'],
    ['d_{xy}', 'd_{yz}', 'd_{z^2}', 'd_{xz}', 'd_{x^2-y^2}'],
    ['f_{y(3x^2-y^2)}', 'f_{xyz}', 'f_{yz^2}', 'f_{z^3}', 'f_{xz^2}', 'f_{z(x^2-y^2)}', 'f_{x(x^2-3y^2)}'],
  ]
  // What can be typed for each: braces, underscores, ^ and ² dropped
  function compactName(s) { return s.replace(/[_{}^()]/g, '').replace(/²/g, '2').replace(/³/g, '3').replace(/−/g, '-') }
  var NAME_KEYS = {}
  ORBITALS.forEach(function (row, l) { row.forEach(function (n, i) { NAME_KEYS[compactName(n)] = { l: l, m: i - l } }) })
  function orbitalTex(l, m) { return l < ORBITALS.length ? ORBITALS[l][m + l] : null }
  function basisTex(t) {
    if (t.form === 'real') return orbitalTex(t.l, t.m) || 'Y_{' + t.l + ',' + t.m + '}'
    return 'Y_{' + t.l + '}^{' + t.m + '}'
  }

  // ---------- Typed sums: "(s + p_x + p_y + p_z)/2", "Y(2,1) - i Y(2,-1)",
  // "Y_3^2 + 0.5 Y_{3,-2}". Y(l,m) follows the form switch; Y_l^m is complex;
  // Y_{l,m} and orbital names are real.
  function parseExpr(src, form) {
    var s = String(src || '').replace(/−/g, '-').replace(/·|×/g, '*').replace(/π/g, 'pi')
    var pos = 0
    function err(msg, at) { var e = new Error(msg); e.pos = at === undefined ? pos : at; throw e }
    function ws() { while (pos < s.length && /\s/.test(s[pos])) pos++ }
    function peek() { ws(); return s[pos] }
    function lin(c) { return { c: c, t: {} } }
    function isConst(a) { return Object.keys(a.t).length === 0 }
    function cmul(a, b) { return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]] }
    function scale(a, c) {
      var r = lin(cmul(a.c, c))
      Object.keys(a.t).forEach(function (k) { r.t[k] = cmul(a.t[k], c) })
      return r
    }
    function add(a, b, sign) {
      var r = lin([a.c[0] + sign * b.c[0], a.c[1] + sign * b.c[1]])
      Object.keys(a.t).forEach(function (k) { r.t[k] = a.t[k].slice() })
      Object.keys(b.t).forEach(function (k) {
        var v = r.t[k] || [0, 0]
        r.t[k] = [v[0] + sign * b.t[k][0], v[1] + sign * b.t[k][1]]
      })
      return r
    }
    function basis(fm, l, m, at) {
      if (!(l >= 0 && l <= 60)) err('ℓ has to be a whole number from 0 to 60', at)
      if (Math.abs(m) > l) err('m has to lie between −ℓ and ℓ: |' + m + '| > ' + l, at)
      var r = lin([0, 0]); r.t[fm + ':' + l + ':' + m] = [1, 0]; return r
    }
    function int() {
      ws(); var m = /^[+-]?\s*\d+/.exec(s.slice(pos))
      if (!m) err('Expected a whole number')
      pos += m[0].length; return parseInt(m[0].replace(/\s/g, ''), 10)
    }
    function braced() { // 2 or {2} or {-1}
      ws()
      if (s[pos] === '{') { pos++; var v = int(); ws(); if (s[pos] !== '}') err('Expected }'); pos++; return v }
      var m = /^[+-]?\d/.exec(s.slice(pos)); if (!m) err('Expected a number after _ or ^')
      pos += m[0].length; return parseInt(m[0], 10)
    }
    function primary() {
      ws(); var at = pos, rest = s.slice(pos), m
      if ((m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest))) { pos += m[0].length; return lin([parseFloat(m[0]), 0]) }
      if (s[pos] === '(') { pos++; var e = expr(); if (peek() !== ')') err('A ( is never closed', at); pos++; return e }
      if ((m = /^(sqrt|√)\s*/.exec(rest))) {
        pos += m[0].length
        var a = peek() === '(' ? primary() : primary()
        if (!isConst(a) || a.c[1]) err('√ takes a plain number', at)
        if (a.c[0] < 0) err('√ of a negative number', at)
        return lin([Math.sqrt(a.c[0]), 0])
      }
      if (/^pi\b/.test(rest)) { pos += 2; return lin([PI, 0]) }
      if (/^i(?![A-Za-z0-9_])/.test(rest)) { pos += 1; return lin([0, 1]) }
      if ((m = /^Y\s*\(/.exec(rest))) {
        pos += m[0].length; var l = int(); ws(); if (s[pos] !== ',') err('Write Y(ℓ, m)'); pos++
        var mm = int(); ws(); if (s[pos] !== ')') err('Write Y(ℓ, m)'); pos++
        return basis(form === 'real' ? 'r' : 'c', l, mm, at)
      }
      if ((m = /^Y\s*_\s*\{\s*(\d+)\s*,\s*([+-]?\d+)\s*\}/.exec(rest))) { pos += m[0].length; return basis('r', +m[1], +m[2], at) }
      if (/^Y\s*_/.test(rest)) {
        pos = s.indexOf('_', pos) + 1; var l2 = braced(); ws()
        if (s[pos] !== '^') err('Write Y_ℓ^m, or Y_{ℓ,m} for a real one'); pos++
        return basis('c', l2, braced(), at)
      }
      if ((m = /^[spdf][A-Za-z0-9_{}^()²³\-−]*/.exec(rest))) {
        // The longest start of the run that names an orbital (names have
        // minus signs in them: d_{x^2-y^2})
        for (var n = m[0].length; n > 0; n--) {
          var key = compactName(m[0].slice(0, n))
          if (NAME_KEYS[key] && (n === m[0].length || !/[A-Za-z0-9]/.test(m[0][n]) || m[0][n - 1] === '}')) {
            if (m[0].slice(0, n).split('(').length !== m[0].slice(0, n).split(')').length) continue
            pos += n; return basis('r', NAME_KEYS[key].l, NAME_KEYS[key].m, at)
          }
        }
      }
      if (pos >= s.length) err('Something is missing at the end')
      err('“' + (/^\S+/.exec(rest) || [rest])[0].slice(0, 12) + '” isn’t a harmonic or a number', at)
    }
    function power() {
      var a = primary()
      if (peek() === '^') {
        var at = pos; pos++
        var b = unary()
        if (!isConst(a) || !isConst(b) || a.c[1] || b.c[1]) err('Only numbers can be raised to a power', at)
        return lin([Math.pow(a.c[0], b.c[0]), 0])
      }
      return a
    }
    function unary() {
      var c = peek()
      if (c === '-') { pos++; return scale(unary(), [-1, 0]) }
      if (c === '+') { pos++; return unary() }
      return power()
    }
    function term() {
      var a = unary()
      for (;;) {
        var c = peek(), at = pos
        if (c === '*' || c === '/') pos++
        else if (c === undefined || c === '+' || c === '-' || c === ')' || c === ',') return a
        var b = unary()
        if (c === '/') {
          if (!isConst(b)) err('Dividing by a harmonic doesn’t give a harmonic', at)
          var d = b.c[0] * b.c[0] + b.c[1] * b.c[1]
          if (!d) err('Division by zero', at)
          a = scale(a, [b.c[0] / d, -b.c[1] / d])
        } else if (isConst(a)) a = scale(b, a.c)
        else if (isConst(b)) a = scale(a, b.c)
        else err('A product of two harmonics isn’t a sum of harmonics of one ℓ (it needs Clebsch–Gordan coefficients)', at)
      }
    }
    function expr() {
      var a = term()
      for (;;) {
        var c = peek()
        if (c === '+' || c === '-') { pos++; a = add(a, term(), c === '+' ? 1 : -1) } else return a
      }
    }
    try {
      if (!s.trim()) err('Type a sum of harmonics, like Y(2,1) + 0.5 d_{xy}', 0)
      var r = expr()
      if (pos < s.length && peek() !== undefined) err('Unexpected “' + s[pos] + '”')
      if (Math.hypot(r.c[0], r.c[1]) > 1e-12) err('A number on its own isn’t a harmonic: write it times s (or Y(0,0))', 0)
      var terms = Object.keys(r.t).map(function (k) {
        var p = k.split(':')
        return { form: p[0] === 'r' ? 'real' : 'complex', l: +p[1], m: +p[2], c: r.t[k] }
      }).filter(function (t) { return Math.hypot(t.c[0], t.c[1]) > 1e-12 })
      terms.sort(function (a, b) { return a.l - b.l || a.m - b.m || (a.form < b.form ? -1 : 1) })
      if (!terms.length) err('Every term cancels', 0)
      return { terms: terms }
    } catch (e) {
      return { error: e.message, pos: e.pos }
    }
  }

  // ---------- Numbers in TeX: common surds by name, the rest to 4 figures
  var NICE = [[1, '1'], [0.5, '\\tfrac{1}{2}'], [Math.SQRT1_2, '\\tfrac{1}{\\sqrt{2}}'], [1 / Math.sqrt(3), '\\tfrac{1}{\\sqrt{3}}'],
    [Math.sqrt(3) / 2, '\\tfrac{\\sqrt{3}}{2}'], [Math.SQRT2, '\\sqrt{2}'], [Math.sqrt(3), '\\sqrt{3}'], [0.25, '\\tfrac{1}{4}'], [1 / 3, '\\tfrac{1}{3}'], [2 / 3, '\\tfrac{2}{3}'], [1 / Math.sqrt(6), '\\tfrac{1}{\\sqrt{6}}'], [Math.sqrt(2 / 3), '\\sqrt{\\tfrac{2}{3}}']]
  function realTex(v) {
    var a = Math.abs(v)
    for (var i = 0; i < NICE.length; i++) if (Math.abs(a - NICE[i][0]) < 5e-7) return NICE[i][1]
    var t = String(+a.toPrecision(4))
    return t
  }
  // A coefficient in front of a term: '' for 1, '-' for −1, 'i', '(1+2i)'
  function coefTex(c, first) {
    var re = c[0], im = c[1], sgn
    if (Math.abs(im) < 1e-12) {
      sgn = re < 0 ? '-' : (first ? '' : '+')
      var t = realTex(re); return sgn + (t === '1' ? '' : t + '\\,')
    }
    if (Math.abs(re) < 1e-12) {
      sgn = im < 0 ? '-' : (first ? '' : '+')
      var u = realTex(im); return sgn + (u === '1' ? '' : u) + 'i\\,'
    }
    return (first ? '' : '+') + '(' + (re < 0 ? '-' : '') + realTex(re) + (im < 0 ? '-' : '+') + realTex(im) + 'i)\\,'
  }
  function termsTex(terms) {
    return terms.map(function (t, i) { return coefTex(t.c, i === 0) + basisTex(t) }).join(' ')
  }

  // ---------- Closed forms, exact: integers as BigInt
  function bgcd(a, b) { a = a < BigInt(0) ? -a : a; b = b < BigInt(0) ? -b : b; while (b) { var t = a % b; a = b; b = t } return a }
  function bfact(n) { var r = BigInt(1); for (var k = BigInt(2); k <= BigInt(n); k++) r *= k; return r }
  // d^m/dx^m P_l(x) as integer coefficients (index = power) over 2^l
  function legendreDeriv(l, m) {
    var c = []
    for (var j = 0; j <= l; j++) c.push(BigInt(0))
    for (var k = 0; 2 * k <= l; k++) {
      var num = bfact(2 * l - 2 * k) / (bfact(k) * bfact(l - k) * bfact(l - 2 * k))
      c[l - 2 * k] = (k % 2 ? -BigInt(1) : BigInt(1)) * num
    }
    for (var d = 0; d < m; d++) {
      var n = []
      for (j = 1; j < c.length; j++) n.push(c[j] * BigInt(j))
      c = n.length ? n : [BigInt(0)]
    }
    return { c: c, den: BigInt(1) << BigInt(l) }
  }
  // n = a² · rest, rest square-free over primes up to 199 (enough here: every
  // factor comes from factorials of numbers below 3l)
  var PRIMES = []
  for (var p = 2; p < 200; p++) { var isP = true; for (var q = 2; q * q <= p; q++) if (p % q === 0) isP = false; if (isP) PRIMES.push(BigInt(p)) }
  function squareOut(n) {
    var a = BigInt(1), rest = BigInt(1)
    PRIMES.forEach(function (p) {
      var e = 0
      while (n % p === BigInt(0)) { n /= p; e++ }
      for (var i = 0; i < Math.floor(e / 2); i++) a *= p
      if (e % 2) rest *= p
    })
    return { a: a, rest: rest * n }
  }
  function fracTex(n, d) { return d === BigInt(1) ? String(n) : '\\frac{' + n + '}{' + d + '}' }
  // The polynomial in u (cos θ or z) with integer coefficients, highest power first
  function polyTex(c, u, uPow) {
    var parts = []
    for (var j = c.length - 1; j >= 0; j--) {
      if (!c[j]) continue
      var a = c[j] < BigInt(0) ? -c[j] : c[j], sgn = c[j] < BigInt(0) ? '-' : '+'
      var mono = uPow(j)
      parts.push({ sgn: sgn, s: (a === BigInt(1) && mono ? '' : String(a)) + mono })
    }
    return parts.map(function (t, i) { return (i === 0 ? (t.sgn === '-' ? '-' : '') : ' ' + t.sgn + ' ') + t.s }).join('')
  }
  function pw(sym, k) { return k === 0 ? '' : k === 1 ? sym : sym + '^{' + k + '}' }
  function trigPw(fn, k) { return k === 0 ? '' : k === 1 ? '\\' + fn + '\\theta' : '\\' + fn + '^{' + k + '}\\theta' }

  // Exact closed form of one basis function: Y_l^m or the real Y_{l,m}
  // (with its Cartesian form too), under the given conventions
  function closedForm(l, m, form, conv) {
    var am = Math.abs(m), D = legendreDeriv(l, am)
    var g = BigInt(0)
    D.c.forEach(function (v) { g = bgcd(g, v) })
    var lead = D.c[D.c.length - 1] || BigInt(1)
    if (lead < BigInt(0)) g = -g
    var poly = D.c.map(function (v) { return v / g })
    // K² = (gn/gd)² · normalization², as (num/den) · π^pp
    var gn = g < BigInt(0) ? -g : g, gd = D.den, sign = g < BigInt(0) ? -1 : 1
    var gg = bgcd(gn, gd); gn /= gg; gd /= gg
    var real = form === 'real', two = real && am ? BigInt(2) : BigInt(1)
    var num, den, pp
    var fr = { n: bfact(l - am), d: bfact(l + am) }
    if (conv.norm === 'unnormalized') { num = gn * gn; den = gd * gd; pp = 0 }
    else if (conv.norm === '4pi') { num = gn * gn * BigInt(2 * l + 1) * fr.n * two; den = gd * gd * fr.d; pp = 0 }
    else if (conv.norm === 'schmidt') { num = gn * gn * fr.n * two; den = gd * gd * fr.d; pp = 0 }
    else { num = gn * gn * BigInt(2 * l + 1) * fr.n * two; den = BigInt(4) * gd * gd * fr.d; pp = -1 }
    // Condon–Shortley: (−1)^m on complex m > 0 only
    if (!real && m > 0 && conv.cs && am % 2) sign = -sign
    var r = bgcd(num, den); num /= r; den /= r
    var sn = squareOut(num), sd = squareOut(den)
    // prefactor = sign · (sn.a / sd.a) · √(sn.rest / (sd.rest π^-pp))
    var ra = sn.a, rb = sd.a, k = bgcd(ra, rb); ra /= k; rb /= k
    function pref(extra) {
      var A = ra * extra.n, B = rb * extra.d, kk = bgcd(A, B); A /= kk; B /= kk
      var rad = sn.rest === BigInt(1) && sd.rest === BigInt(1) && pp === 0 ? ''
        : '\\sqrt{' + fracTex(sn.rest, sd.rest).replace(/^(\d+)$/, '$1') + '}'
      if (pp === -1) rad = sd.rest === BigInt(1) ? '\\sqrt{\\frac{' + sn.rest + '}{\\pi}}' : '\\sqrt{\\frac{' + sn.rest + '}{' + sd.rest + '\\pi}}'
      if (pp === -1 && sn.rest === BigInt(1)) rad = '\\frac{1}{\\sqrt{' + (sd.rest === BigInt(1) ? '' : sd.rest) + '\\pi}}'
      var front = A === BigInt(1) && B === BigInt(1) ? '' : (B === BigInt(1) ? String(A) : '\\frac{' + A + '}{' + B + '}')
      if (!front && !rad) front = '1'
      return { tex: front + (front && rad ? '\\,' : '') + rad, value: Number(A) / Number(B) * Math.sqrt(Number(sn.rest) / Number(sd.rest) * Math.pow(PI, pp)) }
    }
    var P0 = pref({ n: BigInt(1), d: BigInt(1) })
    var x = poly.length === 1 ? '' : polyTex(poly, '', function (j) { return trigPw('cos', j) })
    var nonzero = poly.filter(function (v) { return v }).length
    var angular = trigPw('sin', am)
    var body = angular + (x ? (nonzero > 1 ? (angular ? '\\,' : '') + '(' + x + ')' : (angular ? '\\,' : '') + x) : '')
    var phase = ''
    if (am) {
      if (real) phase = '\\' + (m > 0 ? 'cos' : 'sin') + (am === 1 ? '' : am) + '\\varphi'
      else phase = 'e^{' + (m < 0 ? '-' : '') + (am === 1 ? '' : am) + 'i\\varphi}'
    }
    var name = real ? (orbitalTex(l, m) ? orbitalTex(l, m) : 'Y_{' + l + ',' + m + '}') : 'Y_{' + l + '}^{' + m + '}'
    var tex = (sign < 0 ? '-' : '') + P0.tex + (body ? '\\,' + body : '') + (phase ? '\\,' + phase : '')
    var out = { name: name, tex: tex, prefactor: sign * P0.value, poly: poly.map(Number), m: m, l: l, form: form }
    if (real) out.cartesian = cartesian(l, m, poly, sign, pref)
    return out
  }
  // Real forms in x, y, z over r^l: sin^m θ {cos, sin} mφ = {Re, Im}(x+iy)^m / r^m
  function cartesian(l, m, poly, sign, pref) {
    var am = Math.abs(m), xy = []  // [coef, px, py]
    for (var k = 0; k <= am; k++) {
      if ((m >= 0) !== (k % 2 === 0)) continue
      var c = BigInt(binom(am, k)) * (((m >= 0 ? k : k - 1) / 2) % 2 ? -BigInt(1) : BigInt(1))
      xy.push([c, am - k, k])
    }
    var g = BigInt(0)
    xy.forEach(function (t) { g = bgcd(g, t[0]) })
    if (xy.length && xy[0][0] < BigInt(0)) g = -g
    xy.forEach(function (t) { t[0] /= g })
    var P = pref({ n: g < BigInt(0) ? -g : g, d: BigInt(1) }), s = sign * (g < BigInt(0) ? -1 : 1)
    // z part: Σ c_j z^j r^{l−m−j}
    var zr = []
    for (var j = poly.length - 1; j >= 0; j--) if (poly[j]) zr.push([poly[j], j, l - am - j])
    var zmin = Math.min.apply(null, zr.map(function (t) { return t[1] }))
    var xmin = Math.min.apply(null, xy.map(function (t) { return t[1] })), ymin = Math.min.apply(null, xy.map(function (t) { return t[2] }))
    function mono(ts, f) {
      return ts.map(function (t, i) {
        var a = t[0] < BigInt(0) ? -t[0] : t[0], vars = f(t)
        return (i === 0 ? (t[0] < BigInt(0) ? '-' : '') : (t[0] < BigInt(0) ? ' - ' : ' + ')) + (a === BigInt(1) && vars ? '' : String(a)) + vars
      }).join('')
    }
    var common = pw('x', xmin) + pw('y', ymin) + pw('z', zmin)
    var xyRest = xy.length > 1 ? '(' + mono(xy, function (t) { return pw('x', t[1] - xmin) + pw('y', t[2] - ymin) }) + ')' : ''
    var zRest = zr.length > 1 ? '(' + mono(zr, function (t) { return pw('z', t[1] - zmin) + pw('r', t[2]) }) + ')' : ''
    var numer = common + xyRest + zRest
    if (!common && !(xyRest && zRest) && /^\([^()]*\)$/.test(numer)) numer = numer.slice(1, -1)
    var frac = l === 0 ? '' : '\\frac{' + (numer || '1') + '}{' + pw('r', l) + '}'
    return (s < 0 ? '-' : '') + P.tex + (frac ? '\\,' + frac : '')
  }
  function binom(n, k) { var r = 1; for (var i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r) }

  // ---------- Nodes of one real harmonic (or Re/Im of a complex one)
  function nodes(l, m, form, part) {
    var am = Math.abs(m), lat = l - am
    var cplx = form === 'complex' && (part === 'auto' || part === 'abs' || part === 'abs2')
    var a = lat === 0 ? 'no nodal circles of latitude' : lat === 1 ? '1 nodal circle of latitude' : lat + ' nodal circles of latitude'
    if (cplx) return a + (am ? '; the phase turns ' + (am === 1 ? 'once' : am + ' times') + ' around the z axis' : '') + '. ℓ = ' + l + ' in all.'
    var b = am === 0 ? 'no nodal meridians' : am === 1 ? '1 nodal great circle through the poles' : am + ' nodal great circles through the poles'
    return a + ' and ' + b + ': ℓ = ' + l + ' nodal circles in all.'
  }

  // ---------- The picture's function: what the element's fields describe
  var CONV0 = { cs: true, norm: 'orthonormal' }
  function functionOf(s) {
    var conv = { cs: s.cs !== false, norm: NORMS.indexOf(s.norm) >= 0 ? s.norm : 'orthonormal' }
    if (s.source === 'sum') {
      var p = parseExpr(s.expr, s.form)
      if (p.error) return { error: p.error, pos: p.pos }
      return { C: fromTerms(p.terms, conv), terms: p.terms, tex: termsTex(p.terms), real: p.terms.every(function (t) { return t.form === 'real' && !t.c[1] }) }
    }
    if (s.source === 'cap') {
      var cp = s.cap || {}
      return { C: capCoefs((cp.theta || 0) * PI / 180, (cp.phi || 0) * PI / 180, (cp.radius || 30) * PI / 180, cp.lmax || 0), real: true, tex: '\\text{cap of radius } ' + (cp.radius || 30) + '^\\circ' }
    }
    if (s.source === 'sky') {
      var sk = s.sky || {}
      return { C: skyCoefs(sk.seed || 1, sk.slope == null ? 2 : sk.slope, sk.lmax || 2, 2), real: true, tex: 'C_\\ell \\propto \\ell^{-' + (sk.slope == null ? 2 : sk.slope) + '}' }
    }
    var t = { form: s.form === 'real' ? 'real' : 'complex', l: s.l | 0, m: s.m | 0, c: [1, 0] }
    return { C: fromTerms([t], conv), terms: [t], tex: basisTex(t), real: t.form === 'real', single: t }
  }

  // ---------- Meshes. A grid of rows θ_i (poles included) × columns φ_j.
  function grid(nt, np, wrap) {
    var th = [], ph = []
    for (var i = 0; i <= nt; i++) th.push(PI * i / nt)
    for (var j = 0; j < np + (wrap ? 0 : 1); j++) ph.push(wrap ? 2 * PI * j / np : -PI + 2 * PI * j / np)
    return { th: th, ph: ph, nt: nt + 1, np: ph.length, wrap: wrap }
  }
  // keepPoles: a map draws the pole rows as lines (plate carrée), a sphere
  // as the one point they are
  function indices(G, keepPoles) {
    var out = [], np = G.np, cols = G.wrap ? np : np - 1
    for (var i = 0; i < G.nt - 1; i++) {
      for (var j = 0; j < cols; j++) {
        var j1 = (j + 1) % np, a = i * np + j, b = (i + 1) * np + j, c = i * np + j1, d = (i + 1) * np + j1
        if (i > 0 || keepPoles) out.push(a, b, c)
        if (i < G.nt - 2 || keepPoles) out.push(b, d, c)
      }
    }
    return new Uint32Array(out)
  }
  // The value a picture shows, from the complex f: [re, im] arrays and what
  // the radius follows
  function values(F, part, isReal) {
    var n = F.re.length, re = new Float32Array(n), im = new Float32Array(n), amax = 0
    var complexShown = !isReal && part === 'auto'
    for (var k = 0; k < n; k++) {
      var a = F.re[k], b = F.im[k], v, w = 0
      if (part === 're' || (part === 'auto' && isReal)) v = a
      else if (part === 'im') v = b
      else if (part === 'abs') v = Math.hypot(a, b)
      else if (part === 'abs2') v = a * a + b * b
      else { v = a; w = b }
      re[k] = v; im[k] = w
      var mag = Math.hypot(v, w); if (mag > amax) amax = mag
    }
    return { re: re, im: im, amax: amax || 1, complex: complexShown, positive: part === 'abs' || part === 'abs2' }
  }
  // Radii on the unit directions: lobes r = |v|/max; shape r = 1 + ε v/max
  function radii(V, view, amplitude, t) {
    var n = V.re.length, r = new Float32Array(n), inv = 1 / V.amax
    var c = Math.cos(t || 0), s = Math.sin(t || 0)
    for (var k = 0; k < n; k++) {
      if (view === 'lobes') r[k] = Math.hypot(V.re[k], V.im[k]) * inv
      else if (view === 'shape') r[k] = 1 + amplitude * (V.re[k] * c + V.im[k] * s) * inv
      else r[k] = 1
    }
    return r
  }
  // Positions and smooth normals for r(θ, φ) on the grid
  function surface(G, r, idx3, out) {
    var n = G.nt * G.np
    var pos = out && out.pos || new Float32Array(n * 3), nor = out && out.nor || new Float32Array(n * 3)
    for (var i = 0; i < G.nt; i++) {
      var st = Math.sin(G.th[i]), ct = Math.cos(G.th[i])
      for (var j = 0; j < G.np; j++) {
        var k = i * G.np + j, rr = r[k]
        pos[3 * k] = rr * st * Math.cos(G.ph[j]); pos[3 * k + 1] = rr * st * Math.sin(G.ph[j]); pos[3 * k + 2] = rr * ct
      }
    }
    nor.fill(0)
    for (var t = 0; t < idx3.length; t += 3) {
      var a = 3 * idx3[t], b = 3 * idx3[t + 1], c = 3 * idx3[t + 2]
      var ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2]
      var vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
      nor[a] += nx; nor[a + 1] += ny; nor[a + 2] += nz
      nor[b] += nx; nor[b + 1] += ny; nor[b + 2] += nz
      nor[c] += nx; nor[c + 1] += ny; nor[c + 2] += nz
    }
    // The poles are one point drawn as a row: one normal for the row
    ;[0, G.nt - 1].forEach(function (row) {
      var sx = 0, sy = 0, sz = 0
      for (var j = 0; j < G.np; j++) { var k = 3 * (row * G.np + j); sx += nor[k]; sy += nor[k + 1]; sz += nor[k + 2] }
      for (j = 0; j < G.np; j++) { var q = 3 * (row * G.np + j); nor[q] = sx; nor[q + 1] = sy; nor[q + 2] = sz }
    })
    for (var p = 0; p < n * 3; p += 3) {
      var len = Math.hypot(nor[p], nor[p + 1], nor[p + 2]) || 1
      nor[p] /= len; nor[p + 1] /= len; nor[p + 2] /= len
    }
    return { pos: pos, nor: nor }
  }

  // ---------- Map projections: lat ψ, lon λ → x, y
  function mollweide(lat, lon) {
    var t = lat, target = PI * Math.sin(lat)
    if (Math.abs(Math.abs(lat) - PI / 2) < 1e-9) t = lat
    else for (var k = 0; k < 30; k++) { var d = (2 * t + Math.sin(2 * t) - target) / (2 + 2 * Math.cos(2 * t)); t -= d; if (Math.abs(d) < 1e-12) break }
    return [2 * Math.SQRT2 / PI * lon * Math.cos(t), Math.SQRT2 * Math.sin(t)]
  }
  function project(projection, lat, lon) {
    return projection === 'plate' ? [lon, lat] : mollweide(lat, lon)
  }
  function projBox(projection) { return projection === 'plate' ? [PI, PI / 2] : [2 * Math.SQRT2, Math.SQRT2] }

  return {
    legendre: legendre, idx: idx, normFactor: normFactor, NORMS: NORMS, CONV0: CONV0,
    coefs: coefs, addTerm: addTerm, fromTerms: fromTerms, capCoefs: capCoefs, skyCoefs: skyCoefs,
    synth: synth, evalAt: evalAt, parseExpr: parseExpr, termsTex: termsTex, basisTex: basisTex,
    orbitalTex: orbitalTex, closedForm: closedForm, nodes: nodes, functionOf: functionOf,
    grid: grid, indices: indices, values: values, radii: radii, surface: surface,
    mollweide: mollweide, project: project, projBox: projBox, realTex: realTex, rng: rng,
  }
}

// ---------- In the editor

export const SH = harmonicsCore()

const NORM_NAMES = { orthonormal: 'orthonormal', '4pi': '4π-normalized', schmidt: 'Schmidt semi-normalized', unnormalized: 'unnormalized' }

// The conventions a picture's numbers follow, in a line
export function conventionsText(s) {
  return NORM_NAMES[s.norm] + (s.form === 'complex' || s.source === 'sum' ? `, Condon–Shortley phase ${s.cs ? 'on' : 'off'}` : '') + '; θ from +z, φ from +x'
}

// What the picture shows, in TeX. s: a picture's state (harmonicsView's stepState)
export function harmonicsTex(s) {
  if (s.view === 'table') return `% Every ${s.form === 'real' ? 'real' : 'complex'} harmonic with \\ell \\le ${s.tableMax}`
  if (s.source === 'single') {
    const cf = SH.closedForm(s.l, s.m, s.form, { cs: s.cs, norm: s.norm })
    return `% ${NORM_NAMES[s.norm]}${s.form === 'complex' ? `, Condon–Shortley phase ${s.cs ? 'on' : 'off'}` : ''}\n` +
      `${cf.name}(\\theta,\\varphi) = ${cf.tex}${cf.cartesian ? `\n  = ${cf.cartesian}` : ''}`
  }
  if (s.source === 'sum') {
    const p = SH.parseExpr(s.expr, s.form)
    return p.error ? `% ${p.error}` : `f(\\theta,\\varphi) = ${SH.termsTex(p.terms)}`
  }
  if (s.source === 'cap') return `f(\\theta,\\varphi) = \\sum_{\\ell=0}^{${s.cap.lmax}} \\frac{P_{\\ell-1}(\\cos\\alpha) - P_{\\ell+1}(\\cos\\alpha)}{2}\\, P_\\ell(\\hat n\\cdot\\hat n_0), \\quad \\alpha = ${s.cap.radius}^\\circ`
  return `f = \\sum_{\\ell=2}^{${s.sky.lmax}} \\sum_m a_{\\ell m} Y_{\\ell m}, \\quad a_{\\ell m} \\sim \\mathcal{N}(0,\\ \\ell^{-${s.sky.slope}})`
}

function pyCoef(c) {
  const re = +c[0].toPrecision(8), im = +c[1].toPrecision(8)
  if (!im) return String(re)
  if (!re) return `${im}j`
  return `(${re}${im < 0 ? ' - ' : ' + '}${Math.abs(im)}j)`
}
function pyNorm(s, l, m, real) {
  if (s.norm === '4pi') return ' * np.sqrt(4 * np.pi)'
  if (s.norm === 'schmidt') return ` * np.sqrt(4 * np.pi / ${2 * l + 1})`
  if (s.norm === 'unnormalized') return ` / norm(${l}, ${Math.abs(m)}${real && m ? ', real=True' : ''})`
  return ''
}

// The same picture with NumPy, SciPy and Matplotlib: s, a picture's state
export function harmonicsPython(s) {
  const L = []
  const push = (...lines) => L.push(...lines)
  const parsed = s.source === 'sum' ? SH.parseExpr(s.expr, s.form) : null
  if (parsed?.error) return `# ${parsed.error}`
  const usesReal = (s.source === 'single' && s.form === 'real') || s.source === 'sky' || (s.view === 'table' && s.form === 'real') ||
    (parsed && parsed.terms.some(t => t.form === 'real'))
  push('import numpy as np', 'import matplotlib.pyplot as plt',
    'from scipy.special import sph_harm_y  # SciPy 1.15+: sph_harm_y(l, m, theta, phi), theta from +z' + (s.source === 'cap' ? '\nfrom scipy.special import eval_legendre' : ''), '')
  if (usesReal) {
    push('def real_ylm(l, m, theta, phi):', '    """Real harmonic, its positive lobe on +x (m > 0) or +y (m < 0) whatever the phase convention."""',
      '    if m == 0:', '        return sph_harm_y(l, 0, theta, phi).real',
      '    y = sph_harm_y(l, abs(m), theta, phi)', '    return np.sqrt(2) * (-1) ** abs(m) * (y.real if m > 0 else y.imag)', '')
  }
  if (s.norm === 'unnormalized' && s.view !== 'table') push('from math import factorial', 'def norm(l, m, real=False):', '    return np.sqrt((2 * l + 1) / (4 * np.pi) * factorial(l - m) / factorial(l + m)) * (np.sqrt(2) if real else 1)', '')
  const map = s.view === 'map'
  if (map) push('lon, lat = np.meshgrid(np.linspace(-np.pi, np.pi, 361), np.linspace(-np.pi / 2, np.pi / 2, 181))', 'theta, phi = np.pi / 2 - lat, lon')
  else push('theta, phi = np.meshgrid(np.linspace(0, np.pi, 121), np.linspace(0, 2 * np.pi, 241), indexing="ij")')
  const ylm = (form, l, m) => {
    if (form === 'real') return `real_ylm(${l}, ${m}, theta, phi)${pyNorm(s, l, m, true)}`
    const sign = !s.cs && m > 0 && m % 2 ? '-' : ''
    return `${sign}sph_harm_y(${l}, ${m}, theta, phi)${pyNorm(s, l, m, false)}`
  }
  if (s.view === 'table') {
    push('', `L = ${s.tableMax}`, 'fig = plt.figure(figsize=(2 * L + 1, L + 1))',
      'for l in range(L + 1):', '    for m in range(-l, l + 1):',
      s.form === 'real' ? '        f = real_ylm(l, m, theta, phi)' : '        f = sph_harm_y(l, m, theta, phi)',
      '        r = np.abs(f)',
      s.form === 'real' ? '        colors = np.where(f >= 0, "#cf5a1f", "#2470cc")' : '        colors = plt.cm.twilight_shifted((np.angle(f) % (2 * np.pi)) / (2 * np.pi))',
      '        ax = fig.add_subplot(L + 1, 2 * L + 1, l * (2 * L + 1) + m + L + 1, projection="3d")',
      '        ax.plot_surface(r * np.sin(theta) * np.cos(phi), r * np.sin(theta) * np.sin(phi), r * np.cos(theta), facecolors=colors, rstride=2, cstride=2, linewidth=0)',
      '        ax.set_box_aspect((1, 1, 1)); ax.set_axis_off()',
      'plt.show()')
    return L.join('\n')
  }
  let complex = false
  if (s.source === 'single') { push(`f = ${ylm(s.form, s.l, s.m)}`); complex = s.form === 'complex' }
  else if (s.source === 'sum') {
    push('f = (' + parsed.terms.map((t, i) => (i ? '\n     + ' : '') + pyCoef(t.c) + ' * ' + ylm(t.form, t.l, t.m)).join('') + ')')
    complex = !parsed.terms.every(t => t.form === 'real' && !t.c[1])
  } else if (s.source === 'cap') {
    push(`theta0, phi0, alpha = np.radians(${s.cap.theta}), np.radians(${s.cap.phi}), np.radians(${s.cap.radius})`,
      'mu = np.cos(theta) * np.cos(theta0) + np.sin(theta) * np.sin(theta0) * np.cos(phi - phi0)  # cos of the angle to the cap\'s center',
      'c = np.cos(alpha)', `f = (1 - c) / 2 + sum((eval_legendre(l - 1, c) - eval_legendre(l + 1, c)) / 2 * eval_legendre(l, mu) for l in range(1, ${s.cap.lmax + 1}))`)
  } else {
    push(`rng = np.random.default_rng(${s.sky.seed})  # a different draw from the same spectrum`,
      `f = sum(rng.normal(0, l ** -${s.sky.slope / 2}) * real_ylm(l, m, theta, phi) for l in range(2, ${s.sky.lmax + 1}) for m in range(-l, l + 1))`)
  }
  if (complex && s.part === 're') { push('f = f.real'); complex = false }
  if (complex && s.part === 'im') { push('f = f.imag'); complex = false }
  if (s.part === 'abs') { push('f = np.abs(f)'); complex = false }
  if (s.part === 'abs2') { push('f = np.abs(f) ** 2'); complex = false }
  if (!complex) push('f = np.real(f)')
  push('')
  if (map) {
    push(`ax = plt.figure(figsize=(8, 4.5)).add_subplot(${s.projection === 'plate' ? '' : 'projection="mollweide"'})`)
    const lonX = s.eastLeft ? '-lon' : 'lon'
    if (complex) push(`ax.pcolormesh(${lonX}, lat, np.angle(f), cmap="twilight_shifted", shading="auto")`)
    else push('v = np.abs(f).max()', `ax.pcolormesh(${lonX}, lat, f, cmap="RdBu_r", vmin=-v, vmax=v, shading="auto")`)
    if (s.eastLeft) push('ax.set_xticklabels([])  # longitude grows to the left, as on the sky')
    push('ax.grid(alpha=0.3)', 'plt.show()')
    return L.join('\n')
  }
  const R = s.view === 'lobes' ? 'np.abs(f) / np.abs(f).max()' : s.view === 'shape' ? `1 + ${s.amplitude} * np.real(f) / np.abs(f).max()` : 'np.ones_like(theta)'
  push(`r = ${R}`)
  if (complex) push('colors = plt.cm.twilight_shifted((np.angle(f) % (2 * np.pi)) / (2 * np.pi))  # phase')
  else if (s.view === 'lobes') push('colors = np.where(f >= 0, "#cf5a1f", "#2470cc")  # sign')
  else push('colors = plt.cm.RdBu_r(0.5 + 0.5 * f / np.abs(f).max())')
  push('ax = plt.figure(figsize=(5, 5)).add_subplot(projection="3d")',
    'ax.plot_surface(r * np.sin(theta) * np.cos(phi), r * np.sin(theta) * np.sin(phi), r * np.cos(theta),',
    '                facecolors=colors, rstride=1, cstride=1, linewidth=0, antialiased=False)',
    `ax.view_init(elev=${Math.round(s.tilt)}, azim=${Math.round(s.turn)})`,
    'ax.set_box_aspect((1, 1, 1)); ax.set_axis_off()', 'plt.show()')
  return L.join('\n')
}

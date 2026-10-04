// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Spherical harmonics elements, drawn: an element's fields → a picture →
// frames. Five views (lobes r = |f|, the unit sphere colored by f, the shape
// r = 1 + εf, a Mollweide or plate carrée map, and the ℓ, m table), turned by
// dragging, spinning or moving as a wave e^{−iωt}, with steps that morph
// from one picture to the next.
//
// It draws with WebGL 2, without three.js: one context for the whole page
// draws every frame, which is copied into each element's own 2D canvas.
// Browsers allow about 16 live contexts, which a deck of these (and the
// overview's copies of its slides) would run out of with one each.
//
// harmonicsRuntime uses nothing outside itself but the harmonicsCore it is
// given, so a deck carries both as source (harmonicsDeckScript), as the
// periodic table's deck does. The editor's canvas, the slide panel, decks
// and print pages all draw with it; PowerPoint gets a PNG from it.

import { harmonicsCore, SH } from './sphericalHarmonics'

export function harmonicsRuntime(SH) {
  var PI = Math.PI, DEG = PI / 180

  // ---------- WebGL: one context, one program
  var GL = (function () {
    var cv = null, gl = null, prog = null, U = {}, failed = false
    var VS = '#version 300 es\n' +
      'in vec3 aPos; in vec3 aNor; in vec2 aVal;\n' +
      'uniform mat4 uView, uProj;\n' +
      'out vec3 vN; out vec3 vV; out vec2 vVal;\n' +
      'void main() { vec4 p = uView * vec4(aPos, 1.0); vV = p.xyz; vN = mat3(uView) * aNor; vVal = aVal; gl_Position = uProj * p; }'
    // Modes: 0 sign, 1 diverging, 2 phase, 3 phase over magnitude, 4 solid, 5 0…max
    var FS = '#version 300 es\n' +
      'precision highp float;\n' +
      'in vec3 vN; in vec3 vV; in vec2 vVal;\n' +
      'uniform int uMode; uniform vec3 uPos, uNeg, uMid, uSolid, uNodeCol, uZero;\n' +
      'uniform float uLit, uNodes, uHue0, uL, uC;\n' +
      'out vec4 o;\n' +
      'vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }\n' +
      'vec3 oklch(float L, float C, float h) {\n' +
      '  float a = C * cos(h), b = C * sin(h);\n' +
      '  float l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;\n' +
      '  float l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;\n' +
      '  return clamp(vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s), 0.0, 1.0);\n' +
      '}\n' +
      'void main() {\n' +
      '  float re = vVal.x, im = vVal.y; vec3 col;\n' +
      '  if (uMode == 0) col = lin(re >= 0.0 ? uPos : uNeg);\n' +
      '  else if (uMode == 1) { float t = clamp(re, -1.0, 1.0); col = mix(lin(uMid), lin(t >= 0.0 ? uPos : uNeg), pow(abs(t), 0.8)); }\n' +
      '  else if (uMode == 2 || uMode == 3) {\n' +
      '    col = oklch(uL, uC, uHue0 + atan(im, re));\n' +
      '    if (uMode == 3) col = mix(lin(uZero), col, smoothstep(0.0, 0.55, length(vVal)));\n' +
      '  }\n' +
      '  else if (uMode == 5) col = mix(lin(uMid), lin(uPos), pow(clamp(re, 0.0, 1.0), 0.8));\n' +
      '  else col = lin(uSolid);\n' +
      '  if (uNodes > 0.0) {\n' +
      '    float q = (uMode == 2 || uMode == 3) ? length(vVal) : re;\n' +
      '    float d = abs(q) / max(fwidth(q), 1e-7);\n' +
      '    col = mix(col, lin(uNodeCol), (1.0 - smoothstep(uNodes * 0.5, uNodes * 0.5 + 1.0, d)) * 0.9);\n' +
      '  }\n' +
      '  if (uLit > 0.0) {\n' +
      '    vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;\n' +
      '    vec3 v = normalize(-vV), L1 = normalize(vec3(-0.45, 0.7, 0.6)), L2 = normalize(vec3(0.75, -0.25, 0.45));\n' +
      '    float d1 = max(dot(n, L1), 0.0), d2 = max(dot(n, L2), 0.0);\n' +
      '    float sp = pow(max(dot(n, normalize(L1 + v)), 0.0), 56.0);\n' +
      '    vec3 shaded = col * (0.34 + 0.6 * d1 + 0.16 * d2) + vec3(0.2 * sp);\n' +
      '    col = mix(col, shaded, uLit);\n' +
      '  }\n' +
      '  o = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);\n' +
      '}'

    function init() {
      if (gl || failed) return !!gl
      try {
        cv = document.createElement('canvas'); cv.width = 16; cv.height = 16
        gl = cv.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true })
        if (!gl) throw new Error('no WebGL 2')
        var sh = function (type, src) {
          var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s)
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
          return s
        }
        prog = gl.createProgram()
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS))
        gl.bindAttribLocation(prog, 0, 'aPos'); gl.bindAttribLocation(prog, 1, 'aNor'); gl.bindAttribLocation(prog, 2, 'aVal')
        gl.linkProgram(prog)
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog))
        ;['uView', 'uProj', 'uMode', 'uPos', 'uNeg', 'uMid', 'uSolid', 'uNodeCol', 'uZero', 'uLit', 'uNodes', 'uHue0', 'uL', 'uC'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n) })
        // A lost context (the GPU reset, or too many on the page) is made again on the next frame
        cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); gl = null; prog = null; meshesLost() })
        return true
      } catch (e) {
        failed = true; gl = null
        return false
      }
    }
    function mesh(pos, nor, val, idx) {
      var m = { vao: gl.createVertexArray(), count: idx.length, b: [], gl: gl }
      gl.bindVertexArray(m.vao)
      ;[[pos, 3], [nor, 3], [val, 2]].forEach(function (a, i) {
        var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b)
        gl.bufferData(gl.ARRAY_BUFFER, a[0], gl.DYNAMIC_DRAW)
        gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, a[1], gl.FLOAT, false, 0, 0)
        m.b.push(b)
      })
      m.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)
      gl.bindVertexArray(null)
      return m
    }
    function update(m, pos, nor, val) {
      ;[pos, nor, val].forEach(function (a, i) { if (a) { gl.bindBuffer(gl.ARRAY_BUFFER, m.b[i]); gl.bufferSubData(gl.ARRAY_BUFFER, 0, a) } })
    }
    function free(m) {
      if (!m || !gl || m.gl !== gl) return
      m.b.forEach(function (b) { gl.deleteBuffer(b) }); gl.deleteBuffer(m.ib); gl.deleteVertexArray(m.vao)
    }
    function valid(m) { return !!(m && gl && m.gl === gl) }
    function hex(c) { var n = parseInt(c.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255] }
    // passes: [{ vp: [x, y, w, h] (css px from the top left), cam, draws: [{ mesh, style }] }]
    function render(ctx, w, h, dpr, passes) {
      if (!init()) return false
      var W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr))
      if (cv.width < W || cv.height < H) { cv.width = Math.max(cv.width, W); cv.height = Math.max(cv.height, H) }
      gl.viewport(0, 0, cv.width, cv.height)
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE)
      gl.useProgram(prog)
      // Drawn in the shared canvas's bottom-left W × H and copied from there
      passes.forEach(function (P) {
        var vx = Math.round(P.vp[0] * dpr), vw = Math.round(P.vp[2] * dpr), vh = Math.round(P.vp[3] * dpr)
        var vy = H - Math.round(P.vp[1] * dpr) - vh
        gl.enable(gl.SCISSOR_TEST); gl.scissor(vx, vy, vw, vh); gl.viewport(vx, vy, vw, vh)
        gl.clear(gl.DEPTH_BUFFER_BIT)
        gl.uniformMatrix4fv(U.uView, false, new Float32Array(P.cam.view))
        gl.uniformMatrix4fv(U.uProj, false, new Float32Array(P.cam.proj))
        P.draws.forEach(function (d) {
          var s = d.style, c = s.colors
          gl.uniform1i(U.uMode, s.mode); gl.uniform1f(U.uLit, s.lit); gl.uniform1f(U.uNodes, (s.nodes || 0) * dpr)
          gl.uniform3fv(U.uPos, hex(c.pos)); gl.uniform3fv(U.uNeg, hex(c.neg)); gl.uniform3fv(U.uMid, hex(c.mid))
          gl.uniform3fv(U.uSolid, hex(s.solid || c.axis)); gl.uniform3fv(U.uNodeCol, hex(c.node)); gl.uniform3fv(U.uZero, hex(c.zero))
          gl.uniform1f(U.uHue0, c.hue0); gl.uniform1f(U.uL, c.L); gl.uniform1f(U.uC, c.C)
          gl.bindVertexArray(d.mesh.vao)
          gl.drawElements(gl.TRIANGLES, d.mesh.count, gl.UNSIGNED_INT, 0)
        })
        gl.disable(gl.SCISSOR_TEST)
      })
      gl.bindVertexArray(null)
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(cv, 0, cv.height - H, W, H, 0, 0, W, H)
      ctx.restore()
      return true
    }
    return { init: init, mesh: mesh, update: update, free: free, valid: valid, render: render }
  })()

  // ---------- Matrices (column-major)
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far)
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]
  }
  function ortho(l, r, b, t) { return [2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -1, 0, -(r + l) / (r - l), -(t + b) / (t - b), 0, 1] }
  // Looking at the origin from turn (about z, from +x) and tilt (above the xy-plane), z up
  function lookAt(turn, tilt, dist) {
    var ct = Math.cos(tilt), ex = dist * ct * Math.cos(turn), ey = dist * ct * Math.sin(turn), ez = dist * Math.sin(tilt)
    var fx = -ex / dist, fy = -ey / dist, fz = -ez / dist
    var sx = fy, sy = -fx, sz = 0, sl = Math.hypot(sx, sy) || 1; sx /= sl; sy /= sl
    var ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx
    return [sx, ux, -fx, 0, sy, uy, -fy, 0, sz, uz, -fz, 0,
      -(sx * ex + sy * ey + sz * ez), -(ux * ex + uy * ey + uz * ez), (fx * ex + fy * ey + fz * ez), 1]
  }
  function apply(M, p) {
    var x = p[0], y = p[1], z = p[2]
    return [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14], M[3] * x + M[7] * y + M[11] * z + M[15]]
  }

  // ---------- The element's fields
  // Colors for a dark or a light slide: Parallax's sign colors (the periodic
  // table's ψ±), a neutral middle, and a hue circle of constant OKLCH
  // lightness for phase, starting at the same orange
  var THEMES = {
    light: { pos: '#cf5a1f', neg: '#2470cc', mid: '#e7e5e0', node: '#1f2328', zero: '#34363d', axis: '#8a939d', fg: '#16202a', muted: '#56636f', hue0: 42 * DEG, L: 0.69, C: 0.12 },
    dark: { pos: '#ff9759', neg: '#63a6f7', mid: '#d8d5cf', node: '#15181b', zero: '#26282e', axis: '#8f9aa6', fg: '#e3e8ed', muted: '#9ba7b3', hue0: 42 * DEG, L: 0.74, C: 0.115 },
  }
  var SOURCES = ['single', 'sum', 'cap', 'sky'], FORMS = ['complex', 'real'], PARTS = ['auto', 're', 'im', 'abs', 'abs2']
  var VIEWS = ['lobes', 'sphere', 'shape', 'map', 'table'], MOTIONS = ['none', 'spin', 'wave'], LABELS = ['none', 'name', 'formula']
  var DEFAULTS = {
    source: 'single', l: 2, m: 1, form: 'complex', expr: '(s + p_x + p_y + p_z)/2',
    cap: { theta: 35, phi: 20, radius: 25, lmax: 12 }, sky: { seed: 7, slope: 2, lmax: 24 },
    part: 'auto', view: 'lobes', tableMax: 3, tableCell: 'lobes', projection: 'mollweide', eastLeft: false,
    amplitude: 0.3, motion: 'none', speed: 1, turn: 52, tilt: 20,
    nodes: true, axes: true, key: true, label: 'name', cs: true, norm: 'orthonormal', theme: 'dark',
    stepStart: 1, steps: [],
  }
  // What a step can change: everything about the picture, not the conventions, colors or label
  var PICTURE_FIELDS = ['source', 'l', 'm', 'form', 'expr', 'cap', 'sky', 'part', 'view', 'tableMax', 'tableCell', 'projection', 'eastLeft', 'amplitude', 'motion', 'turn', 'tilt', 'nodes', 'axes']
  function pick(v, list, dflt) { return list.indexOf(v) >= 0 ? v : dflt }
  function num(v, lo, hi, dflt) { v = +v; return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt }
  function int(v, lo, hi, dflt) { return Math.round(num(v, lo, hi, dflt)) }
  function clean(o, base) {
    var s = {}
    s.source = pick(o.source, SOURCES, base.source)
    s.l = int(o.l, 0, 60, base.l)
    s.m = int(o.m, -s.l, s.l, Math.max(-s.l, Math.min(s.l, base.m)))
    s.form = pick(o.form, FORMS, base.form)
    s.expr = typeof o.expr === 'string' ? o.expr.slice(0, 2000) : base.expr
    var c = o.cap || {}, bc = base.cap
    s.cap = { theta: num(c.theta, 0, 180, bc.theta), phi: num(c.phi, -180, 360, bc.phi), radius: num(c.radius, 1, 179, bc.radius), lmax: int(c.lmax, 0, 60, bc.lmax) }
    var k = o.sky || {}, bk = base.sky
    s.sky = { seed: int(k.seed, 1, 1e9, bk.seed), slope: num(k.slope, 0, 6, bk.slope), lmax: int(k.lmax, 2, 60, bk.lmax) }
    s.part = pick(o.part, PARTS, base.part)
    s.view = pick(o.view, VIEWS, base.view)
    s.tableMax = int(o.tableMax, 0, 5, base.tableMax)
    s.tableCell = pick(o.tableCell, ['lobes', 'sphere'], base.tableCell)
    s.projection = pick(o.projection, ['mollweide', 'plate'], base.projection)
    s.eastLeft = o.eastLeft === undefined ? base.eastLeft : !!o.eastLeft
    s.amplitude = num(o.amplitude, 0.05, 0.6, base.amplitude)
    s.motion = pick(o.motion, MOTIONS, base.motion)
    s.turn = num(o.turn, -720, 720, base.turn)
    s.tilt = num(o.tilt, -89, 89, base.tilt)
    s.nodes = o.nodes === undefined ? base.nodes : !!o.nodes
    s.axes = o.axes === undefined ? base.axes : !!o.axes
    return s
  }
  function normalize(el) {
    el = el || {}
    var s = clean(el, DEFAULTS)
    s.speed = num(el.speed, 0.1, 4, 1)
    s.key = el.key === undefined ? true : !!el.key
    s.label = pick(el.label, LABELS, 'name')
    s.cs = el.cs !== false
    s.norm = pick(el.norm, SH.NORMS, 'orthonormal')
    s.theme = pick(el.theme, ['dark', 'light'], 'dark')
    s.stepStart = int(el.stepStart, 1, 1000, 1)
    // A step keeps its own copy of every picture field, filled from the
    // picture before it when it was written without them
    var prev = s
    s.steps = (Array.isArray(el.steps) ? el.steps : []).slice(0, 60).map(function (st) {
      st = st && typeof st === 'object' ? st : {}
      var out = clean(st, prev)
      out.caption = typeof st.caption === 'string' ? st.caption.slice(0, 300) : ''
      prev = out
      return out
    })
    return s
  }
  // The picture at step n (0: as the slide opens)
  function stepState(s, n) {
    var st = n > 0 ? s.steps[Math.min(n, s.steps.length) - 1] : null
    var out = {}
    for (var k in s) if (k !== 'steps') out[k] = s[k]
    if (st) PICTURE_FIELDS.forEach(function (f) { out[f] = st[f] })
    out.caption = st ? st.caption : ''
    return out
  }

  // ---------- Grids and their meshes, shared by every picture
  var grids = {}
  function gridFor(kind, L) {
    var nt = Math.max(48, Math.min(170, 4 * L + 28)), np = 2 * nt
    if (kind === 'cell') { nt = Math.max(36, 2 * L + 30); np = 2 * nt }
    var key = kind + nt
    if (grids[key]) return grids[key]
    var G = SH.grid(nt, np, kind !== 'map')
    G.idx = SH.indices(G, kind === 'map')
    G.key = key
    return (grids[key] = G)
  }
  var meshes = {}, axesMeshes = {}, cellMeshes = []
  function meshesLost() { meshes = {}; axesMeshes = {}; cellMeshes.forEach(function (c) { c.mesh = null }); cellMeshes = [] }
  function meshFor(G) {
    var M = meshes[G.key], n = G.nt * G.np
    if (!GL.valid(M)) M = meshes[G.key] = GL.mesh(new Float32Array(n * 3), new Float32Array(n * 3), new Float32Array(n * 2), G.idx)
    return M
  }

  // ---------- Pictures: the function on its grid, ready to draw frames of
  function picture(s) {
    var F = SH.functionOf(s)
    if (F.error) return { s: s, error: F.error, pos: F.pos }
    var pic = { s: s, F: F, view: s.view }
    if (s.view === 'table') {
      pic.cells = []
      for (var l = 0; l <= s.tableMax; l++) for (var m = -l; m <= l; m++) {
        var c = { source: 'single', l: l, m: m, form: s.form, part: s.part, cs: s.cs, norm: s.norm, view: s.tableCell, amplitude: s.amplitude, nodes: s.nodes }
        var Fc = SH.functionOf(c), G = gridFor('cell', l)
        pic.cells.push({ l: l, m: m, s: c, F: Fc, G: G, field: SH.synth(Fc.C, G.th, G.ph) })
      }
      return pic
    }
    var Gk = gridFor(s.view === 'map' ? 'map' : '3d', F.C.L)
    pic.G = Gk
    pic.field = SH.synth(F.C, Gk.th, Gk.ph)
    if (s.view === 'map') {
      var n = Gk.nt * Gk.np, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), flip = s.eastLeft ? -1 : 1
      for (var i = 0; i < Gk.nt; i++) for (var j = 0; j < Gk.np; j++) {
        var xy = SH.project(s.projection, PI / 2 - Gk.th[i], Gk.ph[j]), k = i * Gk.np + j
        pos[3 * k] = flip * xy[0]; pos[3 * k + 1] = xy[1]; nor[3 * k + 2] = 1
      }
      pic.mapPos = pos; pic.mapNor = nor
    }
    return pic
  }
  // f e^{−iωt}
  function rotate(field, wt) {
    if (!wt) return field
    var c = Math.cos(wt), sn = Math.sin(wt), n = field.re.length, re = new Float64Array(n), im = new Float64Array(n)
    for (var k = 0; k < n; k++) { re[k] = field.re[k] * c + field.im[k] * sn; im[k] = field.im[k] * c - field.re[k] * sn }
    return { re: re, im: im }
  }
  // A frame's radii and values, and how to color them
  function frameData(s, F, field, wt, view) {
    var V = SH.values(rotate(field, wt), s.part, F.real)
    var r = SH.radii(V, view, s.amplitude)
    var n = V.re.length, val = new Float32Array(2 * n), inv = 1 / V.amax
    for (var k = 0; k < n; k++) { val[2 * k] = V.re[k] * inv; val[2 * k + 1] = V.im[k] * inv }
    var mode = view === 'lobes' ? (V.complex ? 2 : 0) : (V.complex ? 3 : V.positive ? 5 : 1)
    return { r: r, val: val, mode: mode }
  }
  function lerp(a, b, u) { var o = new Float32Array(a.length); for (var k = 0; k < a.length; k++) o[k] = a[k] + (b[k] - a[k]) * u; return o }

  // Axes: thin cylinders and cones
  function axesMesh(len) {
    var key = len.toFixed(2)
    if (GL.valid(axesMeshes[key])) return axesMeshes[key]
    var P = [], N = [], I = [], seg = 14, rad = 0.0075 * len, cone = 0.075 * len, crad = 0.026 * len
    function add(d) {
      var u = Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1]
      var v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]
      u = [v[1] * d[2] - v[2] * d[1], v[2] * d[0] - v[0] * d[2], v[0] * d[1] - v[1] * d[0]]
      var base = P.length / 3
      for (var i = 0; i <= seg; i++) {
        var a = 2 * PI * i / seg, ca = Math.cos(a), sa = Math.sin(a)
        var nx = u[0] * ca + v[0] * sa, ny = u[1] * ca + v[1] * sa, nz = u[2] * ca + v[2] * sa
        ;[-len, len - cone].forEach(function (t) { P.push(d[0] * t + nx * rad, d[1] * t + ny * rad, d[2] * t + nz * rad); N.push(nx, ny, nz) })
        P.push(d[0] * (len - cone) + nx * crad, d[1] * (len - cone) + ny * crad, d[2] * (len - cone) + nz * crad); N.push(nx * 0.9 + d[0] * 0.4, ny * 0.9 + d[1] * 0.4, nz * 0.9 + d[2] * 0.4)
        P.push(d[0] * len, d[1] * len, d[2] * len); N.push(nx * 0.9 + d[0] * 0.4, ny * 0.9 + d[1] * 0.4, nz * 0.9 + d[2] * 0.4)
      }
      for (i = 0; i < seg; i++) {
        var a0 = base + 4 * i, a1 = base + 4 * (i + 1)
        I.push(a0, a1, a0 + 1, a1, a1 + 1, a0 + 1, a0 + 2, a1 + 2, a0 + 3, a1 + 2, a1 + 3, a0 + 3)
      }
    }
    add([1, 0, 0]); add([0, 1, 0]); add([0, 0, 1])
    return (axesMeshes[key] = GL.mesh(new Float32Array(P), new Float32Array(N), new Float32Array(P.length / 3 * 2), new Uint32Array(I)))
  }

  // Cameras
  var FOV = 24 * DEG
  function camera(turn, tilt, R, w, h) {
    var aspect = w / h, half = Math.atan(Math.tan(FOV / 2) * Math.min(1, aspect))
    var dist = R / Math.sin(half) * 1.02
    return { view: lookAt(turn * DEG, tilt * DEG, dist), proj: perspective(FOV, aspect, dist / 20, dist * 4) }
  }
  function mapCamera(s, w, h) {
    var B = SH.projBox(s.projection), bx = B[0] * 1.06, by = B[1] * 1.06
    if (bx / by > w / h) by = bx * h / w; else bx = by * w / h
    return { view: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], proj: ortho(-bx, bx, -by, by), bx: bx, by: by }
  }
  function toScreen(cam, p, vp) {
    var q = apply(cam.view, p), c = apply(cam.proj, [q[0], q[1], q[2]])
    return [vp[0] + (c[0] / c[3] * 0.5 + 0.5) * vp[2], vp[1] + (0.5 - c[1] / c[3] * 0.5) * vp[3]]
  }
  function style(th, mode, lit, nodes) { return { mode: mode, lit: lit, nodes: nodes, colors: th } }

  // ---------- A frame on a 2D canvas. o: { w, h (css px), dpr, t (seconds),
  // turn, tilt (overriding the picture's), from (a picture morphing into
  // this one), u (0…1 of the way), fromTurn, fromTilt }. False without WebGL.
  function draw(canvas, pic, o) {
    o = o || {}
    var w = o.w, h = o.h, dpr = o.dpr || 1
    var W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr))
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H }
    var ctx = canvas.getContext('2d')
    if (!ctx) return false
    if (!pic || pic.error) { ctx.clearRect(0, 0, W, H); return true }
    var s = pic.s, th = THEMES[s.theme] || THEMES.dark, t = o.t || 0
    var turn = (o.turn != null ? o.turn : s.turn) + (s.motion === 'spin' ? t * 24 * s.speed : 0)
    var tilt = o.tilt != null ? o.tilt : s.tilt
    var wt = s.motion === 'wave' ? t * 2.2 * s.speed : 0
    var from = o.from && !o.from.error && o.u < 1 ? o.from : null, u = from ? ease(o.u) : 1
    if (from && o.fromTurn != null) { turn = o.fromTurn + (turn - o.fromTurn) * u; tilt = o.fromTilt + (tilt - o.fromTilt) * u }
    var one = function (c, p, f, uu) { return p.view === 'table' ? drawTable(c, p, w, h, dpr, th, turn, tilt, wt) : drawSingle(c, p, w, h, dpr, th, turn, tilt, wt, f, uu) }
    if (!from) return one(ctx, pic)
    if (sameKind(from, pic)) return one(ctx, pic, from, u)
    // Different meshes: a cross-fade
    var a = scratch(0, W, H), b = scratch(1, W, H)
    if (!one(a.getContext('2d'), from) || !one(b.getContext('2d'), pic)) return false
    ctx.clearRect(0, 0, W, H)
    ctx.globalAlpha = 1 - u; ctx.drawImage(a, 0, 0)
    ctx.globalAlpha = u; ctx.drawImage(b, 0, 0)
    ctx.globalAlpha = 1
    return true
  }
  function ease(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u) }
  function sameKind(a, b) {
    return a.view !== 'table' && b.view !== 'table' && (a.view === 'map') === (b.view === 'map') && a.G.key === b.G.key &&
      (a.view !== 'map' || (a.s.projection === b.s.projection && a.s.eastLeft === b.s.eastLeft))
  }
  var scratches = []
  function scratch(i, W, H) { var c = scratches[i] || (scratches[i] = document.createElement('canvas')); c.width = W; c.height = H; return c }

  function drawSingle(ctx, pic, w, h, dpr, th, turn, tilt, wt, from, u) {
    var s = pic.s, G = pic.G, view = pic.view
    var D = frameData(s, pic.F, pic.field, wt, view), r = D.r, val = D.val, mode = D.mode
    if (from) {
      var E = frameData(from.s, from.F, from.field, wt, from.view)
      r = lerp(E.r, D.r, u); val = lerp(E.val, D.val, u); mode = u < 0.5 ? E.mode : D.mode
    }
    if (!GL.init()) return false
    var M = meshFor(G), vp = [0, 0, w, h], cam, nodes = s.nodes && view !== 'lobes' ? 1.6 : 0
    if (view === 'map') {
      cam = mapCamera(s, w, h)
      GL.update(M, pic.mapPos, pic.mapNor, val)
      if (!GL.render(ctx, w, h, dpr, [{ vp: vp, cam: cam, draws: [{ mesh: M, style: style(th, mode, 0, nodes) }] }])) return false
      overlayMap(ctx, s, cam, vp, dpr, th)
    } else {
      var S = SH.surface(G, r, G.idx, pic.surfBuf)
      pic.surfBuf = S
      var R = 0
      for (var k = 0; k < r.length; k++) if (r[k] > R) R = r[k]
      var axisLen = Math.max(1, R) * 1.28
      cam = camera(turn, tilt, s.axes ? axisLen * 1.08 : Math.max(R, 0.3) * 1.04, w, h)
      GL.update(M, S.pos, S.nor, val)
      var draws = [{ mesh: M, style: style(th, mode, 1, nodes) }]
      if (s.axes) draws.push({ mesh: axesMesh(axisLen), style: { mode: 4, lit: 0.6, nodes: 0, colors: th, solid: th.axis } })
      if (!GL.render(ctx, w, h, dpr, [{ vp: vp, cam: cam, draws: draws }])) return false
      if (s.axes) overlayAxes(ctx, cam, vp, axisLen, dpr, th, Math.min(w, h))
    }
    if (s.key) overlayKey(ctx, mode, w, h, dpr, th)
    return true
  }

  function drawTable(ctx, pic, w, h, dpr, th, turn, tilt, wt) {
    var s = pic.s, Lt = s.tableMax, rows = Lt + 1, cols = 2 * Lt + 1
    var lab = Math.max(10, Math.min(26, h / rows * 0.24)), names = s.names !== false && h / rows > 40
    var gap = names ? lab * 0.6 : 0
    var cell = Math.min(w / cols, (h - 4) / rows - gap), passes = [], places = []
    var x0 = (w - cell * cols) / 2, y0 = (h - rows * (cell + gap)) / 2
    if (!GL.init()) return false
    pic.cells.forEach(function (c) {
      var x = x0 + (c.m + Lt) * cell, y = y0 + c.l * (cell + gap)
      var D = frameData(c.s, c.F, c.field, wt, c.s.view)
      var S = SH.surface(c.G, D.r, c.G.idx, c.surfBuf); c.surfBuf = S
      // Each cell has its own mesh, so the table is drawn in one go
      if (!GL.valid(c.mesh)) { c.mesh = GL.mesh(S.pos, S.nor, D.val, c.G.idx); cellMeshes.push(c) } else GL.update(c.mesh, S.pos, S.nor, D.val)
      var vp = [x + cell * 0.04, y, cell * 0.92, cell * 0.92]
      passes.push({ vp: vp, cam: camera(turn, tilt, 1.04, vp[2], vp[3]), draws: [{ mesh: c.mesh, style: style(th, D.mode, 1, c.s.view === 'lobes' ? 0 : (s.nodes ? 1.2 : 0)) }] })
      places.push([c, x + cell / 2, y + cell * 0.92 + lab * 0.45, D.mode])
    })
    if (!GL.render(ctx, w, h, dpr, passes)) return false
    ctx.save(); ctx.scale(dpr, dpr)
    if (names) places.forEach(function (p) { drawName(ctx, p[1], p[2], p[0].s.form, p[0].l, p[0].m, lab * 0.7, th.fg) })
    ctx.restore()
    if (s.key && places.length) overlayKey(ctx, places[places.length - 1][3], w, h, dpr, th, true)
    return true
  }
  // A table's pictures are freed with it
  function freePicture(pic) {
    if (!pic || !pic.cells) return
    pic.cells.forEach(function (c) { GL.free(c.mesh); c.mesh = null; var i = cellMeshes.indexOf(c); if (i >= 0) cellMeshes.splice(i, 1) })
  }

  // ---------- Overlays, in 2D after the frame
  var SERIF = '"KaTeX_Main", "STIX Two Text", "Times New Roman", Times, serif'
  function overlayAxes(ctx, cam, vp, len, dpr, th, size) {
    ctx.save(); ctx.scale(dpr, dpr)
    ctx.fillStyle = th.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = 'italic ' + Math.max(10, Math.min(24, size * 0.045)).toFixed(1) + 'px ' + SERIF
    ;[['x', [1, 0, 0]], ['y', [0, 1, 0]], ['z', [0, 0, 1]]].forEach(function (a) {
      var tip = toScreen(cam, [a[1][0] * len, a[1][1] * len, a[1][2] * len], vp), o = toScreen(cam, [0, 0, 0], vp)
      var dx = tip[0] - o[0], dy = tip[1] - o[1], d = Math.hypot(dx, dy) || 1, off = Math.max(8, size * 0.03)
      ctx.fillText(a[0], tip[0] + dx / d * off, tip[1] + dy / d * off)
    })
    ctx.restore()
  }
  function overlayMap(ctx, s, cam, vp, dpr, th) {
    ctx.save(); ctx.scale(dpr, dpr)
    var sx = vp[2] / (2 * cam.bx), sy = vp[3] / (2 * cam.by), flip = s.eastLeft ? -1 : 1
    var pt = function (lat, lon) { var p = SH.project(s.projection, lat, lon); return [vp[0] + vp[2] / 2 + flip * p[0] * sx, vp[1] + vp[3] / 2 - p[1] * sy] }
    ctx.strokeStyle = th.fg; ctx.globalAlpha = 0.18; ctx.lineWidth = 0.8
    var lat, lon, i, p
    for (lat = -60; lat <= 60; lat += 30) { ctx.beginPath(); for (i = 0; i <= 120; i++) { p = pt(lat * DEG, -PI + 2 * PI * i / 120); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]) } ctx.stroke() }
    for (lon = -120; lon <= 120; lon += 60) { ctx.beginPath(); for (i = 0; i <= 90; i++) { p = pt(-PI / 2 + PI * i / 90, lon * DEG); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]) } ctx.stroke() }
    ctx.globalAlpha = 0.55; ctx.lineWidth = 1
    ctx.beginPath()
    for (i = 0; i <= 90; i++) { p = pt(-PI / 2 + PI * i / 90, PI); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]) }
    for (i = 0; i <= 90; i++) { p = pt(PI / 2 - PI * i / 90, -PI); ctx.lineTo(p[0], p[1]) }
    ctx.closePath(); ctx.stroke()
    ctx.globalAlpha = 1
    // Where longitude 0 is, and which way it grows
    var fs = Math.max(9, Math.min(16, vp[3] * 0.04))
    ctx.fillStyle = th.muted; ctx.font = 'italic ' + fs.toFixed(1) + 'px ' + SERIF; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    var e = pt(0, 0)
    ctx.fillText(flip > 0 ? 'φ = 0 →' : '← φ = 0', e[0] + (flip > 0 ? fs * 0.75 : -fs * 0.75), pt(-PI / 2, 0)[1] + 3)
    ctx.restore()
  }
  // How the colors read, in the bottom right (a table's, the top right, which it leaves empty)
  function overlayKey(ctx, mode, w, h, dpr, th, top) {
    ctx.save(); ctx.scale(dpr, dpr)
    var k = Math.max(0.6, Math.min(1.8, Math.min(w, h) / 320)), x = w - 10 * k, y = top ? 34 * k : h - 12 * k, fs = 11 * k
    ctx.font = fs.toFixed(1) + 'px ' + SERIF; ctx.textBaseline = 'middle'; ctx.fillStyle = th.muted
    if (mode === 0) {
      ;[['−', th.neg], ['+', th.pos]].forEach(function (c, i) {
        var xx = x - (1 - i) * 30 * k - 24 * k
        ctx.fillStyle = c[1]; roundRect(ctx, xx, y - 5 * k, 10 * k, 10 * k, 2 * k); ctx.fill()
        ctx.fillStyle = th.muted; ctx.textAlign = 'left'; ctx.fillText(c[0], xx + 13 * k, y)
      })
    } else if (mode === 1 || mode === 5) {
      var bw = 86 * k, bx = x - bw, g = ctx.createLinearGradient(bx, 0, x, 0)
      if (mode === 1) { g.addColorStop(0, th.neg); g.addColorStop(0.5, th.mid); g.addColorStop(1, th.pos) } else { g.addColorStop(0, th.mid); g.addColorStop(1, th.pos) }
      ctx.fillStyle = g; roundRect(ctx, bx, y - 4 * k, bw, 8 * k, 2 * k); ctx.fill()
      ctx.fillStyle = th.muted; ctx.textAlign = 'center'
      ctx.fillText(mode === 1 ? '−' : '0', bx, y - 12 * k); ctx.fillText(mode === 1 ? '+' : 'max', x, y - 12 * k)
      if (mode === 1) ctx.fillText('0', bx + bw / 2, y - 12 * k)
    } else if (mode === 2 || mode === 3) {
      var R = 13 * k, cx = x - R, cy = y - R + 6 * k
      for (var i = 0; i < 48; i++) {
        var a0 = 2 * PI * i / 48, a1 = 2 * PI * (i + 1) / 48 + 0.01
        ctx.beginPath(); ctx.arc(cx, cy, R, -a1, -a0); ctx.arc(cx, cy, R * 0.55, -a0, -a1, true); ctx.closePath()
        ctx.fillStyle = oklchHex(th.L, th.C, th.hue0 + (a0 + a1) / 2); ctx.fill()
      }
      ctx.fillStyle = th.muted; ctx.textAlign = 'right'
      ctx.fillText('arg', cx - R - 5 * k, cy - 6 * k); ctx.fillText('0 →', cx - R - 5 * k, cy + 7 * k)
    }
    ctx.restore()
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath() }
  function oklchHex(L, C, h) {
    var a = C * Math.cos(h), b = C * Math.sin(h)
    var l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b
    var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_
    var rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]
    return '#' + rgb.map(function (v) { v = Math.max(0, Math.min(1, v)); return ('0' + Math.round(Math.pow(v, 1 / 2.2) * 255).toString(16)).slice(-2) }).join('')
  }
  // Y_l^m, or an orbital's name, set with sub- and superscripts
  function uni(t) { return t.replace(/\^\{?2\}?/g, '²').replace(/\^\{?3\}?/g, '³').replace(/-/g, '−').replace(/[{}]/g, '') }
  function drawName(ctx, x, y, form, l, m, size, color) {
    var base, sub, sup = ''
    var orb = form === 'real' ? SH.orbitalTex(l, m) : null
    if (orb) { base = orb[0]; sub = uni(orb.slice(2)) } else if (form === 'real') { base = 'Y'; sub = l + ',' + String(m).replace('-', '−') } else { base = 'Y'; sub = String(l); sup = String(m).replace('-', '−') }
    var big = 'italic ' + size.toFixed(1) + 'px ' + SERIF, small = (orb ? 'italic ' : '') + (size * 0.68).toFixed(1) + 'px ' + SERIF
    ctx.font = big; var bw = ctx.measureText(base).width
    ctx.font = small; var sw = Math.max(ctx.measureText(sub).width, ctx.measureText(sup).width)
    var x0 = x - (bw + sw + 1) / 2
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    ctx.font = big; ctx.fillText(base, x0, y + size * 0.3)
    ctx.font = small; ctx.fillText(sub, x0 + bw + 1, y + size * 0.52)
    if (sup) ctx.fillText(sup, x0 + bw + 1, y - size * 0.12)
  }

  // ---------- The label over a picture, in TeX
  function labelTex(s) {
    if (s.label === 'none') return ''
    if (s.view === 'table') return s.form === 'real' ? 'Y_{\\ell,m}' : 'Y_\\ell^m'
    var F = SH.functionOf(s)
    if (F.error) return ''
    var f = F.tex, wrap = s.source === 'sum' && F.terms.length > 1 ? '(' + f + ')' : f
    var sp = s.source === 'single' ? '\\,' : ''
    var name = s.part === 're' ? '\\operatorname{Re}' + sp + wrap : s.part === 'im' ? '\\operatorname{Im}' + sp + wrap
      : s.part === 'abs' ? '|' + f + '|' : s.part === 'abs2' ? '|' + f + '|^2' : f
    if (s.label === 'formula' && s.source === 'single' && s.part === 'auto') name += ' = ' + SH.closedForm(s.l, s.m, s.form, { cs: s.cs, norm: s.norm }).tex
    return name
  }

  // ---------- On a page. opts.mode: 'deck' (drag to turn, steps through
  // setStep, moving while its slide shows), 'canvas' (the editor's selected
  // element: drag to turn, reported to opts.onTurn) or 'static' (thumbnails,
  // print, the overview: drawn once, still). opts.step: the step shown;
  // opts.katex: KaTeX for the label (else window.katex, else plain text);
  // opts.dpr: a fixed pixel density (print).
  function attach(root, el, opts) {
    opts = opts || {}
    var mode = opts.mode === 'canvas' || opts.mode === 'static' ? opts.mode : 'deck'
    var doc = root.ownerDocument, win = doc.defaultView || window
    var reduce = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches)
    var s = normalize(el), step = opts.step || 0
    var st = { pic: null, from: null, morph0: 0, fromTurn: null, fromTilt: null, turn: null, tilt: null, t0: now(), dirty: true, raf: 0, gone: false, broken: false }
    function now() { return win.performance ? win.performance.now() : Date.now() }

    root.innerHTML = ''
    if (win.getComputedStyle && win.getComputedStyle(root).position === 'static') root.style.position = 'relative'
    var canvas = doc.createElement('canvas')
    canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;' + (mode === 'static' ? '' : 'cursor:grab;touch-action:none;')
    canvas.setAttribute('role', 'img')
    root.appendChild(canvas)
    var label = doc.createElement('div'), caption = doc.createElement('div'), note = doc.createElement('div')
    label.style.cssText = 'position:absolute;left:1.5%;top:1%;pointer-events:none;white-space:nowrap;line-height:1.2;'
    caption.style.cssText = 'position:absolute;left:0;right:0;bottom:0;text-align:center;pointer-events:none;line-height:1.2;'
    note.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;text-align:center;padding:8px;font:13px sans-serif;pointer-events:none;'
    root.appendChild(label); root.appendChild(caption); root.appendChild(note)

    function texInto(node, src) {
      var k = opts.katex || win.katex
      node.textContent = ''
      if (!src) return
      if (k) { try { k.render(src, node, { throwOnError: false }); return } catch (e) { /* plain text below */ } }
      node.textContent = src.replace(/\\[a-zA-Z]+|[{}]/g, '').replace(/\^/g, '').replace(/_/g, '')
    }
    function sized() {
      var h = root.clientHeight || 0, th = THEMES[s.theme] || THEMES.dark
      var fs = Math.max(10, Math.min(48, h * 0.06))
      label.style.fontSize = fs + 'px'; label.style.color = th.fg
      caption.style.fontSize = Math.max(10, Math.min(44, h * 0.055)) + 'px'; caption.style.color = th.fg
      note.style.color = th.muted
      var capH = caption.textContent ? caption.offsetHeight + h * 0.01 : 0
      canvas.style.height = capH ? 'calc(100% - ' + capH + 'px)' : '100%'
    }
    function show(n, animate) {
      var state = stepState(s, n), next = picture(state)
      if (animate && !reduce && st.pic && !st.pic.error && !next.error) {
        if (st.from && st.from !== st.pic) freePicture(st.from)
        st.from = st.pic; st.morph0 = now()
        st.fromTurn = st.turn != null ? st.turn : st.pic.s.turn; st.fromTilt = st.tilt != null ? st.tilt : st.pic.s.tilt
      } else { if (st.pic) freePicture(st.pic); if (st.from) freePicture(st.from); st.from = null }
      st.pic = next; st.turn = null; st.tilt = null; st.dirty = true
      texInto(label, next.error ? '' : labelTex(state))
      caption.textContent = state.caption || ''
      canvas.setAttribute('aria-label', next.error ? 'Spherical harmonics: ' + next.error : 'Spherical harmonics' + (state.caption ? ': ' + state.caption : ''))
      sized()
    }
    function visible() {
      if (mode !== 'deck') return true
      var sec = root.closest && root.closest('section')
      return !sec || sec.classList.contains('present')
    }
    function render(t) {
      var w = root.clientWidth, h = canvas.clientHeight || root.clientHeight
      if (!w || !h) return false
      var rect = root.getBoundingClientRect(), zoom = rect.width / w || 1
      var dpr = opts.dpr || Math.min(3, (win.devicePixelRatio || 1) * zoom)
      // Keeps a huge canvas (a zoomed-in editor) to about 6 megapixels
      dpr = Math.min(dpr, Math.sqrt(6e6 / (w * h)))
      var u = st.from ? (now() - st.morph0) / 750 : 1
      if (u >= 1 && st.from) { freePicture(st.from); st.from = null }
      var ok = draw(canvas, st.pic, { w: w, h: h, dpr: dpr, t: t, turn: st.turn, tilt: st.tilt, from: st.from, u: u, fromTurn: st.fromTurn, fromTilt: st.fromTilt })
      if (ok === false && !st.broken) {
        st.broken = true
        note.textContent = 'Drawing this needs WebGL 2, which this browser has turned off.'
        note.style.display = 'flex'
      }
      return true
    }
    function moving() { return st.pic && !st.pic.error && st.pic.s.motion !== 'none' && !reduce }
    function loop() {
      st.raf = 0
      if (st.gone) return
      if (visible() && (st.dirty || st.from || moving())) {
        if (render(moving() ? (now() - st.t0) / 1000 : 0)) st.dirty = false
      }
      if (mode !== 'static') st.raf = win.requestAnimationFrame(loop)
    }

    // Drag to turn, z kept up. Mouse-down doesn't take focus, so a clicker's
    // keys still change slides; the canvas's own handlers don't see it
    var drag = null
    function onDown(e) {
      if (mode === 'static' || !st.pic || st.pic.error || st.pic.view === 'map' || (e.button != null && e.button !== 0)) return
      e.preventDefault(); e.stopPropagation()
      var p = st.pic.s
      drag = { x: e.clientX, y: e.clientY, turn: st.turn != null ? st.turn : p.turn, tilt: st.tilt != null ? st.tilt : p.tilt, zoom: (root.getBoundingClientRect().width / (root.clientWidth || 1)) || 1 }
      if (canvas.setPointerCapture && e.pointerId != null) { try { canvas.setPointerCapture(e.pointerId) } catch (er) { /* fine */ } }
      canvas.style.cursor = 'grabbing'
    }
    function onMove(e) {
      if (!drag) return
      e.stopPropagation()
      st.turn = drag.turn - (e.clientX - drag.x) / drag.zoom * 0.45
      st.tilt = Math.max(-89, Math.min(89, drag.tilt + (e.clientY - drag.y) / drag.zoom * 0.35))
      st.dirty = true
    }
    function onUp(e) {
      if (!drag) return
      if (e) e.stopPropagation()
      drag = null
      canvas.style.cursor = 'grab'
      if (opts.onTurn && st.turn != null) opts.onTurn({ turn: Math.round(((st.turn % 360) + 360) % 360), tilt: Math.round(st.tilt) })
    }
    function stop(e) { if (mode !== 'static') e.stopPropagation() }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    // The editor moves elements, and a deck changes slides, on these
    canvas.addEventListener('mousedown', stop)
    canvas.addEventListener('touchstart', stop)
    canvas.addEventListener('dblclick', stop)

    var ro = win.ResizeObserver ? new win.ResizeObserver(function () { sized(); st.dirty = true; if (mode === 'static') loop() }) : null
    if (ro) ro.observe(root)
    show(step, false)
    if (mode === 'static') loop(); else st.raf = win.requestAnimationFrame(loop)

    return {
      // Show step n (0: as the slide opens), morphing to it when animate
      setStep: function (n, animate) { step = n; show(n, animate); if (mode === 'static') loop() },
      // New fields (the editor's), at step n
      update: function (next, n, animate) { s = normalize(next); step = n == null ? step : n; show(step, animate); if (mode === 'static') loop() },
      // Back to the step's own angle
      resetTurn: function () { st.turn = null; st.tilt = null; st.dirty = true },
      redraw: function () { st.dirty = true; if (mode === 'static') loop() },
      // The canvas now, as a PNG (print, PowerPoint)
      png: function () { render(0); return canvas.toDataURL('image/png') },
      state: function () { return { step: step, turn: st.turn, tilt: st.tilt, morphing: !!st.from, picture: st.pic, broken: st.broken } },
      destroy: function () {
        st.gone = true
        if (st.raf) win.cancelAnimationFrame(st.raf)
        if (ro) ro.disconnect()
        canvas.removeEventListener('pointerdown', onDown)
        canvas.removeEventListener('pointermove', onMove)
        canvas.removeEventListener('pointerup', onUp)
        canvas.removeEventListener('pointercancel', onUp)
        freePicture(st.pic); freePicture(st.from)
      },
    }
  }

  // A still of the element at step n, w × h css px at a pixel density, with
  // its label (as plain text) and caption drawn in: for PowerPoint
  function still(el, w, h, dpr, n) {
    var s = normalize(el), state = stepState(s, n || 0), pic = picture(state)
    var c = document.createElement('canvas'), th = THEMES[s.theme] || THEMES.dark
    var capH = state.caption ? Math.max(10, h * 0.055) * 1.4 : 0
    if (!draw(c, pic, { w: w, h: h - capH, dpr: dpr })) { freePicture(pic); return null }
    var out = document.createElement('canvas')
    out.width = Math.round(w * dpr); out.height = Math.round(h * dpr)
    var ctx = out.getContext('2d')
    ctx.drawImage(c, 0, 0)
    ctx.scale(dpr, dpr)
    var fs = Math.max(10, Math.min(48, h * 0.06))
    if (state.label !== 'none' && state.source === 'single' && state.view !== 'table') {
      var name = state.part === 're' ? 'Re ' : state.part === 'im' ? 'Im ' : ''
      ctx.fillStyle = th.fg; ctx.font = fs + 'px ' + SERIF; ctx.textBaseline = 'alphabetic'
      ctx.fillText(name, w * 0.015, fs * 1.2)
      drawName(ctx, w * 0.015 + ctx.measureText(name).width + fs * 0.45, fs * 0.95, state.form, state.l, state.m, fs, th.fg)
    }
    if (state.caption) {
      ctx.fillStyle = th.fg; ctx.font = Math.max(10, h * 0.055) + 'px ' + SERIF; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      ctx.fillText(state.caption, w / 2, h - 2)
    }
    freePicture(pic)
    return out.toDataURL('image/png')
  }

  return {
    THEMES: THEMES, DEFAULTS: DEFAULTS, PICTURE_FIELDS: PICTURE_FIELDS, SOURCES: SOURCES, VIEWS: VIEWS, PARTS: PARTS, MOTIONS: MOTIONS,
    normalize: normalize, stepState: stepState, picture: picture, draw: draw, labelTex: labelTex, attach: attach, still: still,
    oklchHex: oklchHex, available: function () { return GL.init() },
  }
}

// ---------- In the editor

export const HV = harmonicsRuntime(SH)

// The element's own fields
export const HARMONICS_FIELDS = ['source', 'l', 'm', 'form', 'expr', 'cap', 'sky', 'part', 'view', 'tableMax', 'tableCell', 'projection', 'eastLeft', 'amplitude', 'motion', 'speed', 'turn', 'tilt', 'nodes', 'axes', 'key', 'label', 'cs', 'norm', 'theme', 'stepStart', 'steps']

// A new one: complex Y_2^1 as lobes colored by phase, in the slide's colors
export function defaultHarmonics(dark = true) {
  const s = HV.normalize({ theme: dark ? 'dark' : 'light' })
  const out = {}
  HARMONICS_FIELDS.forEach(k => { out[k] = s[k] })
  return out
}

// Starting points, from the properties panel's Start From
const each = (arr, f) => arr.map(f)
export const HARMONICS_TEMPLATES = [
  { id: 'phase', name: 'Y₂¹, colored by phase', el: { source: 'single', l: 2, m: 1, form: 'complex', part: 'auto', view: 'lobes', turn: 52, tilt: 20, axes: true } },
  { id: 'd', name: 'The five d orbitals, as steps', el: { source: 'single', l: 2, m: -2, form: 'real', part: 'auto', view: 'lobes', turn: 52, tilt: 24, axes: true,
    steps: each([-1, 0, 1, 2], m => ({ l: 2, m, caption: '' })) } },
  { id: 'table', name: 'Real harmonics, ℓ ≤ 3', el: { view: 'table', form: 'real', part: 'auto', tableMax: 3, tableCell: 'lobes', turn: 52, tilt: 20 } },
  { id: 'ctable', name: 'Complex harmonics, ℓ ≤ 3', el: { view: 'table', form: 'complex', part: 'auto', tableMax: 3, tableCell: 'lobes', turn: 52, tilt: 20 } },
  { id: 'nodes', name: 'Nodal lines on a sphere', el: { source: 'single', l: 5, m: 3, form: 'real', part: 'auto', view: 'sphere', nodes: true, turn: 40, tilt: 24, axes: true } },
  { id: 'star', name: 'A star ringing (a traveling mode)', el: { source: 'single', l: 3, m: 2, form: 'complex', part: 're', view: 'shape', motion: 'wave', amplitude: 0.22, nodes: true, axes: false, turn: 40, tilt: 26 } },
  { id: 'sp3', name: 'An sp³ hybrid, term by term', el: { source: 'sum', expr: 's', form: 'real', part: 'auto', view: 'lobes', turn: -42, tilt: 12, axes: true,
    steps: [{ expr: '(s + p_x)/sqrt(2)', caption: '+ p_x' }, { expr: '(s + p_x + p_y)/sqrt(3)', caption: '+ p_y' }, { expr: '(s + p_x + p_y + p_z)/2', caption: '+ p_z: one lobe along (1, 1, 1)' }] } },
  { id: 'cap', name: 'A polar cap, band-limited', el: { source: 'cap', cap: { theta: 38, phi: 30, radius: 30, lmax: 1 }, part: 'auto', view: 'sphere', nodes: false, axes: false, turn: 30, tilt: 30,
    steps: each([2, 4, 8, 16, 32], L => ({ cap: { theta: 38, phi: 30, radius: 30, lmax: L }, caption: `ℓ ≤ ${L}` })) } },
  { id: 'sky', name: 'A random sky map', el: { source: 'sky', sky: { seed: 7, slope: 2, lmax: 4 }, part: 'auto', view: 'map', projection: 'mollweide', eastLeft: true, nodes: false, axes: false,
    steps: each([8, 16, 32], L => ({ sky: { seed: 7, slope: 2, lmax: L }, caption: `ℓ ≤ ${L}` })) } },
]

// A template's fields over an element, keeping its colors and conventions
export function applyHarmonicsTemplate(el, template) {
  const base = HV.normalize({ theme: el.theme, cs: el.cs, norm: el.norm, label: el.label, key: el.key, stepStart: el.stepStart })
  const t = HV.normalize({ ...base, ...template.el })
  const out = {}
  HARMONICS_FIELDS.forEach(k => { out[k] = t[k] })
  return out
}

// ---------- Which step the editor shows, and the angle a selected element
// was turned to on the canvas, shared by the canvas and the panel

const editing = new Map()
const turned = new Map()
const listeners = new Set()
let version = 0
function changed() { version++; listeners.forEach(f => f()) }
export function subscribeHarmonics(f) { listeners.add(f); return () => listeners.delete(f) }
export function harmonicsVersion() { return version }
export function harmonicsEditStep(id) { return editing.get(id) || 0 }
export function setHarmonicsEditStep(id, n) { if ((editing.get(id) || 0) !== n) { editing.set(id, n); turned.delete(id); changed() } }
export function harmonicsTurned(id) { return turned.get(id) || null }
export function setHarmonicsTurned(id, view) { turned.set(id, view); changed() }
export function clearHarmonicsTurned(id) { if (turned.delete(id)) changed() }

// ---------- Steps: the element's kth step is its diagram step k

export function harmonicsSteps(el) {
  if (el?.type !== 'harmonics') return []
  const s = HV.normalize(el)
  return s.steps.map((_, i) => [s.stepStart + i, i + 1]).filter(([n]) => n <= 1000)
}
export function harmonicsStepAt(el, slideStep) {
  let at = 0
  for (const [n, s] of harmonicsSteps(el)) if (n <= slideStep) at = s
  return at
}
export function harmonicsStepMarkers(slide) {
  let html = ''
  for (const el of slide?.elements || []) {
    const id = String(el.id || '').replace(/[^A-Za-z0-9_-]/g, '')
    for (const [n, s] of harmonicsSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-sh-step="${id}" data-sh-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`
  }
  return html
}
export function hasHarmonics(presentation) {
  return (presentation?.slides || []).some(s => (s.elements || []).some(el => el.type === 'harmonics'))
}

const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// The element in a deck or on a print page: an empty box with its settings,
// which the page's script draws into
export function harmonicsDeckAttrs(el, step = null) {
  const s = HV.normalize(el)
  const id = String(el.id || '').replace(/[^A-Za-z0-9_-]/g, '')
  // data-prevent-swipe: a finger on it turns it rather than the slide
  return ` data-sh="${id}" data-sh-config="${escAttr(JSON.stringify(s))}"${step == null ? ' data-prevent-swipe' : ` data-sh-at="${step}"`}`
}

// Both functions' source, made once
let runtimeSource = null
function runtimeJs() {
  if (!runtimeSource) runtimeSource = `var HV = (${harmonicsRuntime.toString()})((${harmonicsCore.toString()})());`
  return runtimeSource
}

// In a deck with spherical harmonics: the runtime, once, which draws each
// one, lets it be turned, and follows the slide's steps. The overview's
// copies of slides get stills.
let deckScript = null
export function harmonicsDeckScript() {
  if (!deckScript) deckScript = `
    (function() {
      ${runtimeJs()}
      var items = [];
      function config(el) { try { return JSON.parse(el.getAttribute('data-sh-config')); } catch (e) { return null; } }
      document.querySelectorAll('[data-sh]').forEach(function(el) {
        if (el.closest('[inert]')) return;
        var cfg = config(el);
        if (!cfg) return;
        items.push({ el: el, id: el.getAttribute('data-sh'), at: 0, api: HV.attach(el, cfg, { mode: 'deck' }) });
      });
      function stepOf(item) {
        var slide = item.el.closest('section'), n = 0;
        if (!slide) return 0;
        slide.querySelectorAll('.fragment[data-sh-step]').forEach(function(m) {
          if (m.getAttribute('data-sh-step') === item.id && m.classList.contains('visible')) n = Math.max(n, +m.getAttribute('data-sh-step-at') || 0);
        });
        return n;
      }
      function sync(animate) {
        items.forEach(function(item) {
          var n = stepOf(item);
          if (n !== item.at) { item.api.setStep(n, animate); item.at = n; }
        });
      }
      // The overview's pictures of slides, drawn still
      function stills() {
        document.querySelectorAll('[inert] [data-sh]').forEach(function(el) {
          if (el.__shStill) return;
          var cfg = config(el);
          if (!cfg) return;
          el.__shStill = true;
          var a = HV.attach(el, cfg, { mode: 'static', step: +el.getAttribute('data-sh-at') || 0, dpr: 0.5 });
          a.destroy();
        });
      }
      Reveal.on('ready', function() { sync(false); setTimeout(stills, 0); });
      Reveal.on('fragmentshown', function() { sync(true); });
      Reveal.on('fragmenthidden', function() { sync(true); });
      Reveal.on('slidechanged', function() { items.forEach(function(item) { item.api.resetTurn(); }); sync(false); });
      sync(false);
    })();
`
  return deckScript
}

// On a print page: each one drawn still, sharp, at its page's step
export function harmonicsPrintScript() {
  return `
    (function() {
      ${runtimeJs()}
      document.querySelectorAll('[data-sh]').forEach(function(el) {
        var cfg;
        try { cfg = JSON.parse(el.getAttribute('data-sh-config')); } catch (e) { return; }
        var a = HV.attach(el, cfg, { mode: 'static', step: +el.getAttribute('data-sh-at') || 0, dpr: 2 });
        a.destroy();
      });
    })();
`
}

// A PNG of it as at step n, for PowerPoint; null without WebGL
export function harmonicsPng(el, n = 0) {
  const w = Math.max(1, el.width || 480), h = Math.max(1, el.height || 270)
  try { return HV.still(el, w, h, Math.min(3, Math.sqrt(8e6 / (w * h))), n) } catch { return null }
}

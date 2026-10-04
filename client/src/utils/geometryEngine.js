// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Geometry constructions (geometryDiagram.js has the element): a figure kept
// as how each object is made, in GeoGebra's command names (c = Circle(A, B),
// C = Intersect(c, d, 0)), and worked out in order, so dragging a point
// moves everything made from it and the figure stays correct. An object that
// stops existing (two circles pulled apart have no crossing) is null, as is
// everything made from it, until it exists again.
//
// geometryRuntime holds the engine and its drawing as one function that
// uses nothing from outside: the editor calls it, and a deck carries its
// source (geometryDeckScript) so the points can be dragged when presenting.

export function geometryRuntime() {
  var NAME = /^[A-Za-zα-ωΑ-Ω][A-Za-z0-9α-ωΑ-Ω_']*$/;
  var SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
  var SERIF = "'Latin Modern Roman', 'Times New Roman', Times, serif";
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function n1(v) { return String(Math.round(v * 10) / 10); }
  function n2(v) { var r = Math.round(v * 100) / 100; return String(r === 0 ? 0 : r); }

  // ---------- Vectors
  var P = function (x, y) { return { x: x, y: y }; };
  var sub = function (a, b) { return P(a.x - b.x, a.y - b.y); };
  var add = function (a, b) { return P(a.x + b.x, a.y + b.y); };
  var mul = function (a, k) { return P(a.x * k, a.y * k); };
  var dot = function (a, b) { return a.x * b.x + a.y * b.y; };
  var cross = function (a, b) { return a.x * b.y - a.y * b.x; };
  var len = function (a) { return Math.sqrt(a.x * a.x + a.y * a.y); };
  var unit = function (a) { var l = len(a); return l > 1e-12 ? mul(a, 1 / l) : null; };
  var perp = function (a) { return P(-a.y, a.x); };
  var dist = function (a, b) { return len(sub(a, b)); };
  var EPS = 1e-9;

  // Values: a point {x, y}; a line {kind: line | segment | ray, p, q}; a
  // circle {c, r, start}; a polygon {pts}; an angle {a, b, c, deg}; a length {p, q, d}
  var isLine = function (v) { return !!v && !!v.kind && !!v.p; };
  var isCircle = function (v) { return !!v && !!v.c && v.r != null; };
  var isPoint = function (v) { return !!v && v.x != null && v.kind == null; };

  function inRange(l, t) { return l.kind === 'line' || (t >= -1e-7 && (l.kind === 'ray' || t <= 1 + 1e-7)); }
  function interLL(l, m) {
    var d1 = sub(l.q, l.p), d2 = sub(m.q, m.p), den = cross(d1, d2);
    if (Math.abs(den) < EPS) return [];
    var w = sub(m.p, l.p), t = cross(w, d2) / den, u = cross(w, d1) / den;
    return inRange(l, t) && inRange(m, u) ? [add(l.p, mul(d1, t))] : [];
  }
  // In order along the line; a tangent gives the same point twice
  function interLC(l, c) {
    var d = sub(l.q, l.p), f = sub(l.p, c.c), A = dot(d, d), B = 2 * dot(f, d), C = dot(f, f) - c.r * c.r, disc = B * B - 4 * A * C;
    if (A < EPS || disc < -1e-9) return [];
    var s = Math.sqrt(Math.max(0, disc));
    return [(-B - s) / (2 * A), (-B + s) / (2 * A)].map(function (t) { return inRange(l, t) ? add(l.p, mul(d, t)) : null; });
  }
  // The first on the left of the line from the first center to the second
  function interCC(a, b) {
    var d = dist(a.c, b.c);
    if (d < EPS || d > a.r + b.r + 1e-9 || d < Math.abs(a.r - b.r) - 1e-9) return [];
    var x = (d * d + a.r * a.r - b.r * b.r) / (2 * d), h = Math.sqrt(Math.max(0, a.r * a.r - x * x));
    var e = mul(sub(b.c, a.c), 1 / d), m = add(a.c, mul(e, x)), n = perp(e);
    return [add(m, mul(n, h)), add(m, mul(n, -h))];
  }
  function intersections(u, v) {
    if (isLine(u) && isLine(v)) return interLL(u, v);
    if (isLine(u) && isCircle(v)) return interLC(u, v);
    if (isCircle(u) && isLine(v)) return interLC(v, u);
    if (isCircle(u) && isCircle(v)) return interCC(u, v);
    return [];
  }
  function lineArg(a, at) {
    if (isLine(a[at])) return a[at];
    if (isPoint(a[at]) && isPoint(a[at + 1])) return { kind: 'line', p: a[at], q: a[at + 1] };
    return null;
  }
  function through(p, d) { return d ? { kind: 'line', p: p, q: add(p, d) } : null; }

  // ---------- Commands: what each takes (p a point, o a line or circle, x
  // either, n a number, ? optional, + one or more), what it makes, and what
  // it says
  var CMDS = {
    Point: { sig: ['n', 'n'], fn: function (a) { return P(a[0], a[1]); }, say: function (o) { return 'Mark a point ' + o.name; } },
    PointOn: {
      sig: ['o', 'n'],
      fn: function (a) {
        var o = a[0], t = a[1];
        if (isCircle(o)) return add(o.c, P(o.r * Math.cos(t), o.r * Math.sin(t)));
        if (isLine(o)) { var tt = o.kind === 'segment' ? Math.max(0, Math.min(1, t)) : o.kind === 'ray' ? Math.max(0, t) : t; return add(o.p, mul(sub(o.q, o.p), tt)); }
        return null;
      },
      say: function (o) { return 'Put a point ' + o.name + ' on ' + o.args[0]; },
    },
    Intersect: { sig: ['o', 'o', 'n?'], fn: function (a) { return intersections(a[0], a[1])[a[2] || 0] || null; }, say: function (o) { return o.name + ' is where ' + o.args[0] + ' and ' + o.args[1] + ' cross'; } },
    Midpoint: { sig: ['p', 'p'], fn: function (a) { return mul(add(a[0], a[1]), 0.5); }, say: function (o) { return o.name + ' is the midpoint of ' + o.args[0] + o.args[1]; } },
    Segment: { sig: ['p', 'p'], fn: function (a) { return dist(a[0], a[1]) > EPS ? { kind: 'segment', p: a[0], q: a[1] } : null; }, say: function (o) { return 'Draw the segment ' + o.args[0] + o.args[1]; } },
    Line: { sig: ['p', 'p'], fn: function (a) { return dist(a[0], a[1]) > EPS ? { kind: 'line', p: a[0], q: a[1] } : null; }, say: function (o) { return 'Draw the line through ' + o.args[0] + ' and ' + o.args[1]; } },
    Ray: { sig: ['p', 'p'], fn: function (a) { return dist(a[0], a[1]) > EPS ? { kind: 'ray', p: a[0], q: a[1] } : null; }, say: function (o) { return 'Draw the ray from ' + o.args[0] + ' through ' + o.args[1]; } },
    Circle: {
      sig: ['p', 'p', 'p?'],
      fn: function (a) {
        if (a.length === 2) { var r = dist(a[0], a[1]); return r > EPS ? { c: a[0], r: r, start: Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x) } : null; }
        var A = a[0], B = a[1], C = a[2], d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
        if (Math.abs(d) < EPS) return null;
        var s = function (p) { return p.x * p.x + p.y * p.y; };
        var c = P((s(A) * (B.y - C.y) + s(B) * (C.y - A.y) + s(C) * (A.y - B.y)) / d, (s(A) * (C.x - B.x) + s(B) * (A.x - C.x) + s(C) * (B.x - A.x)) / d);
        return { c: c, r: dist(c, A), start: Math.atan2(A.y - c.y, A.x - c.x) };
      },
      say: function (o) { return o.args.length === 2 ? 'Draw the circle centered at ' + o.args[0] + ' through ' + o.args[1] : 'Draw the circle through ' + o.args[0] + ', ' + o.args[1] + ' and ' + o.args[2]; },
    },
    Perpendicular: {
      sig: ['p', 'x', 'p?'],
      fn: function (a) { var l = lineArg(a, 1); return l && through(a[0], unit(perp(sub(l.q, l.p)))); },
      say: function (o) { return 'Draw the line through ' + o.args[0] + ' perpendicular to ' + o.args.slice(1).join(''); },
    },
    Parallel: {
      sig: ['p', 'x', 'p?'],
      fn: function (a) { var l = lineArg(a, 1); return l && through(a[0], unit(sub(l.q, l.p))); },
      say: function (o) { return 'Draw the line through ' + o.args[0] + ' parallel to ' + o.args.slice(1).join(''); },
    },
    PerpendicularBisector: {
      sig: ['p', 'p'],
      fn: function (a) { var d = unit(sub(a[1], a[0])); return d && through(mul(add(a[0], a[1]), 0.5), perp(d)); },
      say: function (o) { return 'Draw the perpendicular bisector of ' + o.args[0] + o.args[1]; },
    },
    AngleBisector: {
      sig: ['p', 'p', 'p'],
      fn: function (a) { var u = unit(sub(a[0], a[1])), v = unit(sub(a[2], a[1])); if (!u || !v) return null; return through(a[1], unit(add(u, v)) || perp(u)); },
      say: function (o) { return 'Bisect the angle ' + o.args.join(''); },
    },
    Polygon: {
      sig: ['p', 'p', 'p+'],
      fn: function (a) { return { pts: a.slice() }; },
      say: function (o) { var n = o.args.length; return 'Draw the ' + (n === 3 ? 'triangle ' : n === 4 ? 'quadrilateral ' : 'polygon ') + o.args.join(''); },
    },
    Angle: {
      sig: ['p', 'p', 'p'],
      fn: function (a) {
        var u = sub(a[0], a[1]), v = sub(a[2], a[1]);
        if (len(u) < EPS || len(v) < EPS) return null;
        return { a: a[0], b: a[1], c: a[2], deg: Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (len(u) * len(v))))) * 180 / Math.PI };
      },
      say: function (o) { return 'Measure the angle ' + o.args.join(''); },
    },
    Distance: { sig: ['p', 'p'], fn: function (a) { return { p: a[0], q: a[1], d: dist(a[0], a[1]) }; }, say: function (o) { return 'Measure ' + o.args[0] + o.args[1]; } },
  };
  var KIND = { p: isPoint, o: function (v) { return isLine(v) || isCircle(v); } };
  var MAX_OBJECTS = 400;

  // ---------- The script: name = Command(args) {options}, a line each
  function parse(text) {
    var objs = [], errors = [], names = {};
    String(text == null ? '' : text).split('\n').forEach(function (raw, i) {
      var line = i + 1, s = raw.replace(/#.*$/, '').trim();
      if (!s) return;
      if (objs.length >= MAX_OBJECTS) { if (objs.length === MAX_OBJECTS) errors.push({ line: line, msg: 'A construction can have up to ' + MAX_OBJECTS + ' objects' }); return; }
      var m = /^([^=\s]+)\s*=\s*([A-Za-z]+)\s*\(([^)]*)\)\s*(?:\{([^}]*)\})?\s*$/.exec(s);
      if (!m) { errors.push({ line: line, msg: 'Write a line as name = Command(…), like c = Circle(A, B)' }); return; }
      var name = m[1], cmd = m[2], def = CMDS[cmd];
      if (!NAME.test(name) || name.length > 24) { errors.push({ line: line, msg: '"' + name + '" can’t be a name: start with a letter, then letters, digits, _ or ’' }); return; }
      if (!def) { errors.push({ line: line, msg: cmd + ' isn’t a command. These are: ' + Object.keys(CMDS).join(', ') }); return; }
      if (names[name] != null) { errors.push({ line: line, msg: name + ' is named twice' }); return; }
      var args = m[3].split(',').map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) { return /^-?\d*\.?\d+(e-?\d+)?$/i.test(x) ? +x : x; });
      for (var k = 0; k < args.length; k++) if (typeof args[k] === 'string' && names[args[k]] == null) { errors.push({ line: line, msg: args[k] + ' isn’t made before this line' }); return; }
      var why = checkArgs(def, args, cmd, objs, names);
      if (why) { errors.push({ line: line, msg: why }); return; }
      var opts = {};
      (m[4] || '').split(',').forEach(function (o) {
        var kv = o.split('=').map(function (x) { return x.trim(); });
        if (!kv[0] || !/^(construction|hidden|dashed|color|label)$/.test(kv[0])) return;
        opts[kv[0]] = kv.length > 1 ? kv.slice(1).join('=').replace(/^"|"$/g, '').slice(0, 60) : true;
      });
      names[name] = objs.length;
      objs.push({ name: name, cmd: cmd, args: args, opts: opts, line: line });
    });
    return { objs: objs, errors: errors };
  }
  // The arguments a command takes: how many, and numbers where numbers go
  function checkArgs(def, args, cmd) {
    var sig = def.sig, min = sig.filter(function (s) { return s.slice(-1) !== '?'; }).length, max = /\+$/.test(sig[sig.length - 1]) ? 50 : sig.length;
    if (args.length < min || args.length > max) return cmd + ' takes ' + (min === max ? min : max === 50 ? min + ' or more' : min + ' or ' + max) + ' arguments, like ' + example(cmd);
    for (var i = 0; i < args.length; i++) {
      var want = sig[Math.min(i, sig.length - 1)].charAt(0);
      if (want === 'n' && typeof args[i] !== 'number') return cmd + '’s argument ' + (i + 1) + ' is a number, like ' + example(cmd);
      if (want !== 'n' && typeof args[i] === 'number') return cmd + '’s argument ' + (i + 1) + ' is a point or a curve, like ' + example(cmd);
    }
    return null;
  }
  var EXAMPLES = { Point: 'Point(1, 2)', PointOn: 'PointOn(c, 0.5)', Intersect: 'Intersect(c, d, 0)', Midpoint: 'Midpoint(A, B)', Segment: 'Segment(A, B)', Line: 'Line(A, B)', Ray: 'Ray(A, B)', Circle: 'Circle(A, B)', Perpendicular: 'Perpendicular(P, f)', Parallel: 'Parallel(P, f)', PerpendicularBisector: 'PerpendicularBisector(A, B)', AngleBisector: 'AngleBisector(A, B, C)', Polygon: 'Polygon(A, B, C)', Angle: 'Angle(A, B, C)', Distance: 'Distance(A, B)' };
  function example(cmd) { return EXAMPLES[cmd] || cmd + '(…)'; }

  function serialize(objs) {
    return objs.map(function (o) {
      var opts = Object.keys(o.opts || {}).filter(function (k) { return o.opts[k] != null && o.opts[k] !== false; })
        .map(function (k) { return o.opts[k] === true ? k : k + '=' + o.opts[k]; });
      return o.name + ' = ' + o.cmd + '(' + o.args.map(function (a) { return typeof a === 'number' ? n2(a) : a; }).join(', ') + ')' + (opts.length ? ' {' + opts.join(', ') + '}' : '');
    }).join('\n');
  }

  // Each object from those before it; null where it doesn't exist
  function compute(objs) {
    var vals = {};
    objs.forEach(function (o) {
      var a = o.args.map(function (x) { return typeof x === 'number' ? x : vals[x]; });
      if (a.some(function (x) { return x == null; })) { vals[o.name] = null; return; }
      for (var i = 0; i < a.length; i++) {
        var want = CMDS[o.cmd].sig[Math.min(i, CMDS[o.cmd].sig.length - 1)].charAt(0);
        if (KIND[want] && !KIND[want](a[i])) { vals[o.name] = null; return; }
      }
      var v = null;
      try { v = CMDS[o.cmd].fn(a); } catch (e) { v = null; }
      vals[o.name] = v && (v.x == null || (isFinite(v.x) && isFinite(v.y))) ? v : null;
    });
    return vals;
  }
  function describe(o) { return CMDS[o.cmd] ? CMDS[o.cmd].say(o) : o.name; }

  // A point's name as TeX: digits after letters go below (P1 is P₁)
  function labelTex(name) {
    var m = /^([A-Za-zα-ωΑ-Ω]+'*)_?(\d+)('*)$/.exec(name);
    return m ? m[1] + '_{' + m[2] + '}' + m[3] : name.replace(/_(\w+)/, '_{$1}');
  }

  // ---------- Drawing, in the element's px. view: {x, y} the world point
  // at its center, w the width of world it shows; world y is up
  var THEMES = {
    dark: { ink: '#e7ebf3', soft: '#8d96aa', grid: '#3a4152', axis: '#7d8698', blue: '#5aa2ff', red: '#ff6f61', yellow: '#ffcc4d', green: '#52c78d', purple: '#b58cff', accent: '#ffcc4d', halo: '#1e1e2e', fillOp: 0.2 },
    light: { ink: '#1b2230', soft: '#7a8396', grid: '#e1e5ec', axis: '#8790a2', blue: '#1f62c4', red: '#cc2f24', yellow: '#e3a400', green: '#2a8a57', purple: '#7a42c8', accent: '#cc2f24', halo: '#ffffff', fillOp: 0.26 },
  };
  function frame(o) {
    var W = o.W || 960, H = o.H || 540, v = o.view || { x: 0, y: 0, w: 16 }, k = W / (v.w > 0 ? v.w : 16);
    return { W: W, H: H, k: k, cx: W / 2 - v.x * k, cy: H / 2 + v.y * k };
  }
  function toScreen(F, p) { return P(F.cx + p.x * F.k, F.cy - p.y * F.k); }
  function toWorld(o, sx, sy) { var F = frame(o); return P((sx - F.cx) / F.k, (F.cy - sy) / F.k); }
  function colorOf(ob, th, fallback) { var c = ob.opts && ob.opts.color; return c ? (/^(red|blue|green|yellow|purple)$/.test(c) ? th[c] : (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c) ? c : fallback)) : fallback; }

  // Liang–Barsky: the part of a line, ray or segment inside R
  function clipLine(p, q, kind, R) {
    var d = sub(q, p), t0 = kind === 'line' ? -Infinity : 0, t1 = kind === 'segment' ? 1 : Infinity;
    var cl = [[-d.x, p.x - R.x0], [d.x, R.x1 - p.x], [-d.y, p.y - R.y0], [d.y, R.y1 - p.y]];
    for (var i = 0; i < 4; i++) {
      var pp = cl[i][0], qq = cl[i][1];
      if (Math.abs(pp) < 1e-12) { if (qq < 0) return null; continue; }
      var r = qq / pp;
      if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    if (!isFinite(t0) || !isFinite(t1)) return null;
    return [add(p, mul(d, t0)), add(p, mul(d, t1))];
  }
  // A step of 1, 2 or 5 times a power of ten, at least 34 px apart
  function gridStep(k) { var raw = 34 / k, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)); return raw <= p ? p : raw <= 2 * p ? 2 * p : raw <= 5 * p ? 5 * p : 10 * p; }

  // o: W, H, view, dark, axes, grid, upto (objects shown), anim (objects from
  // this index on are drawn in), tidy (working hidden), caption, hover, sel (names), label
  // (tex, x, y, size, color) → markup centered there
  function render(objs, vals, o) {
    var th = THEMES[o.dark ? 'dark' : 'light'], F = frame(o), W = F.W, H = F.H;
    var S = function (p) { return toScreen(F, p); };
    var R = { x0: -40, y0: -40, x1: W + 40, y1: H + 40 };
    var label = o.label || function (tex, x, y, size, color) { return '<text x="' + n1(x) + '" y="' + n1(y + size * 0.34) + '" text-anchor="middle" font-family="' + SERIF + '" font-size="' + size + '" font-style="italic" fill="' + color + '">' + esc(tex) + '</text>'; };
    var upto = o.upto == null ? objs.length : o.upto, L = { back: '', fill: '', line: '', mark: '', point: '', label: '' };
    var hl = function (name) { return name === o.hover || (o.sel || []).indexOf(name) >= 0; };
    var halo = ' paint-order="stroke" stroke="' + th.halo + '" stroke-width="3.5" stroke-linejoin="round"';
    if (o.grid || o.axes) L.back = backdrop(F, th, o);
    // What's drawn, for the points' labels to keep clear of
    var obs = [];
    objs.slice(0, upto).forEach(function (ob) {
      var v = vals[ob.name];
      if (!v || ob.opts.hidden || (o.tidy && ob.opts.construction)) return;
      if (isLine(v)) { var sg = clipLine(S(v.p), S(v.q), v.kind, R); if (sg) obs.push({ a: sg[0], b: sg[1], pad: 1 }); }
      else if (isCircle(v)) obs.push({ c: S(v.c), r: v.r * F.k, pad: 1 });
      else if (v.pts) { var ps = v.pts.map(S); ps.forEach(function (p, k) { obs.push({ a: p, b: ps[(k + 1) % ps.length], pad: 1 }); }); }
      else if (v.deg != null) { var ta = angleAt(S(v.a), S(v.b), S(v.c)); if (ta) obs.push({ a: P(ta.t.x - 20, ta.t.y), b: P(ta.t.x + 20, ta.t.y), pad: 7 }, { p: ta.w, pad: 6 }); }
      else if (v.d != null) { var td = distAt(S(v.p), S(v.q)); obs.push({ a: P(td.x - 30, td.y), b: P(td.x + 30, td.y), pad: 7 }); }
      else if (isPoint(v)) obs.push({ p: S(v), pad: 5 });
    });
    objs.slice(0, upto).forEach(function (ob, i) {
      var v = vals[ob.name];
      if (!v || ob.opts.hidden || (o.tidy && ob.opts.construction)) return;
      var cons = !!ob.opts.construction, isNew = o.anim != null && i >= o.anim, h = hl(ob.name);
      var fl = function (m) { return isNew && m ? '<g class="pxgm-fade">' + m + '</g>' : m; };
      var w = cons ? 1.3 : 2.2, dash = cons ? ' stroke-dasharray="6 5"' : ob.opts.dashed ? ' stroke-dasharray="8 6"' : '';
      // When new, solid strokes trace themselves and the rest fade in
      var tag = ' data-name="' + esc(ob.name) + '"' + (isNew ? (dash ? ' class="pxgm-new pxgm-fade"' : ' class="pxgm-new" pathLength="1"') : '');
      var glow = function (d) { return '<path d="' + d + '" stroke="' + th.accent + '" stroke-width="' + (w + 7) + '" stroke-opacity="0.35" fill="none" stroke-linecap="round"/>'; };
      var nameLabel = function (at, dx, dy) { if (!ob.opts.label || ob.opts.label === 'none') return ''; var t = ob.opts.label === true ? labelTex(ob.name) : ob.opts.label; return label(t, at.x + dx, at.y + dy, 19, th.ink); };
      if (isLine(v)) {
        var seg = clipLine(S(v.p), S(v.q), v.kind, R);
        if (!seg) return;
        var d = 'M' + n1(seg[0].x) + ' ' + n1(seg[0].y) + 'L' + n1(seg[1].x) + ' ' + n1(seg[1].y);
        if (h) L.line += glow(d);
        L.line += '<path' + tag + ' d="' + d + '" fill="none" stroke="' + (cons ? th.soft : colorOf(ob, th, th.ink)) + '" stroke-width="' + w + '"' + dash + ' stroke-linecap="round"/>';
        L.label += fl(nameLabel(mul(add(seg[0], seg[1]), 0.5), 12, -12));
      } else if (isCircle(v)) {
        var c = S(v.c), r = v.r * F.k, s0 = v.start || 0;
        if (r > 20000) return;
        var x1 = c.x + r * Math.cos(s0), y1 = c.y - r * Math.sin(s0), x2 = c.x - r * Math.cos(s0), y2 = c.y + r * Math.sin(s0);
        // From where it was set, so drawing it in sweeps round as a compass does
        var dc = 'M' + n1(x1) + ' ' + n1(y1) + 'A' + n1(r) + ' ' + n1(r) + ' 0 1 0 ' + n1(x2) + ' ' + n1(y2) + 'A' + n1(r) + ' ' + n1(r) + ' 0 1 0 ' + n1(x1) + ' ' + n1(y1);
        if (h) L.line += glow(dc);
        L.line += '<path' + tag + ' d="' + dc + '" fill="none" stroke="' + (cons ? th.soft : colorOf(ob, th, th.blue)) + '" stroke-width="' + w + '"' + dash + '/>';
        L.label += fl(nameLabel(P(c.x + r * 0.71, c.y - r * 0.71), 14, -10));
      } else if (v.pts) {
        var pts = v.pts.map(S), dp = 'M' + pts.map(function (p) { return n1(p.x) + ' ' + n1(p.y); }).join('L') + 'Z';
        L.fill += '<path' + tag + ' d="' + dp + '" fill="' + colorOf(ob, th, th.yellow) + '" fill-opacity="' + th.fillOp + '" stroke="' + (h ? th.accent : th.ink) + '" stroke-width="' + (h ? 3.2 : 2) + '" stroke-linejoin="round"/>';
      } else if (v.deg != null) {
        L.mark += angleMark(S(v.a), S(v.b), S(v.c), v.deg, colorOf(ob, th, th.red), th, tag, h, halo, ob);
      } else if (v.d != null) {
        var at = distAt(S(v.p), S(v.q));
        L.mark += '<text' + tag + ' x="' + n1(at.x) + '" y="' + n1(at.y + 5) + '" text-anchor="middle" font-family="' + SANS + '" font-size="15" fill="' + colorOf(ob, th, th.red) + '"' + halo + '>' + esc((ob.opts.label && ob.opts.label !== true ? ob.opts.label : ob.args[0] + ob.args[1]) + ' = ' + v.d.toFixed(2)) + '</text>';
      } else if (isPoint(v)) {
        var sp = S(v), free = ob.cmd === 'Point', glide = ob.cmd === 'PointOn';
        var pc = colorOf(ob, th, free ? th.blue : glide ? th.green : th.ink);
        L.point += '<g' + tag + '>' + (h ? '<circle cx="' + n1(sp.x) + '" cy="' + n1(sp.y) + '" r="12" fill="' + th.accent + '" fill-opacity="0.35"/>' : '') +
          '<circle cx="' + n1(sp.x) + '" cy="' + n1(sp.y) + '" r="' + (free || glide ? 5.5 : 4.3) + '" fill="' + pc + '" stroke="' + th.halo + '" stroke-width="1.6"/></g>';
        if (ob.opts.label !== 'none' && !cons) {
          var q = spot(sp, obs);
          L.label += fl(label(ob.opts.label && ob.opts.label !== true ? ob.opts.label : labelTex(ob.name), q.x, q.y, 20, th.ink));
          obs.push({ p: q, pad: 10 });
        }
      }
    });
    var cap = o.caption ? '<text x="' + n1(W / 2) + '" y="' + n1(H - 14) + '" text-anchor="middle" font-family="' + SANS + '" font-size="18" fill="' + th.ink + '"' + halo + '>' + esc(o.caption) + '</text>' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n1(W) + ' ' + n1(H) + '" preserveAspectRatio="xMidYMid meet"' + (o.standalone ? ' width="' + n1(W) + '" height="' + n1(H) + '"' : '') + ' style="display:block;width:100%;height:100%;overflow:hidden">' +
      L.back + '<g>' + L.fill + '</g><g>' + L.line + '</g><g>' + L.mark + '</g><g>' + L.point + '</g><g style="pointer-events:none">' + L.label + '</g>' + cap + '</svg>';
  }
  function backdrop(F, th, o) {
    var s = gridStep(F.k), out = '', x0 = -F.cx / F.k, x1 = (F.W - F.cx) / F.k, y0 = (F.cy - F.H) / F.k, y1 = F.cy / F.k;
    if (o.grid) {
      var d = '';
      for (var x = Math.ceil(x0 / s) * s; x <= x1; x += s) d += 'M' + n1(F.cx + x * F.k) + ' 0V' + n1(F.H);
      for (var y = Math.ceil(y0 / s) * s; y <= y1; y += s) d += 'M0 ' + n1(F.cy - y * F.k) + 'H' + n1(F.W);
      out += '<path d="' + d + '" stroke="' + th.grid + '" stroke-width="1" fill="none"/>';
    }
    if (o.axes) {
      var ax = '<path d="M0 ' + n1(F.cy) + 'H' + n1(F.W) + 'M' + n1(F.cx) + ' 0V' + n1(F.H) + '" stroke="' + th.axis + '" stroke-width="1.4" fill="none"/>', lab = '';
      for (var tx = Math.ceil(x0 / s) * s; tx <= x1; tx += s) if (Math.abs(tx) > s / 2) lab += '<text x="' + n1(F.cx + tx * F.k) + '" y="' + n1(Math.min(F.H - 4, Math.max(14, F.cy + 15))) + '" text-anchor="middle">' + n2(tx) + '</text>';
      for (var ty = Math.ceil(y0 / s) * s; ty <= y1; ty += s) if (Math.abs(ty) > s / 2) lab += '<text x="' + n1(Math.min(F.W - 4, Math.max(16, F.cx - 6))) + '" y="' + n1(F.cy - ty * F.k + 4) + '" text-anchor="end">' + n2(ty) + '</text>';
      out += ax + '<g font-family="' + SANS + '" font-size="11" fill="' + th.axis + '">' + lab + '</g>';
    }
    return out;
  }
  // Where an angle's reading goes, out along its bisector, and its wedge's middle
  function angleAt(a, b, c) {
    var u = unit(sub(a, b)), v = unit(sub(c, b));
    if (!u || !v) return null;
    var bis = unit(add(u, v)) || perp(u);
    return { t: add(b, mul(bis, 47)), w: add(b, mul(bis, 13)) };
  }
  // Where a distance's reading goes: beside the middle of the segment, above it
  function distAt(a, b) {
    var nrm = unit(perp(sub(b, a))) || P(0, -1);
    if (nrm.y > 0) nrm = mul(nrm, -1);
    return add(mul(add(a, b), 0.5), mul(nrm, 15));
  }
  // Where a point's label goes: of eight places round it, above and to the
  // right first, the first clear of what's drawn, else the clearest
  var SPOTS = [[1, -1], [-1, -1], [1, 1], [-1, 1], [0, -1.35], [1.35, 0], [-1.35, 0], [0, 1.35]];
  function segDist(q, a, b) { var d = sub(b, a), l2 = dot(d, d), t = l2 ? Math.max(0, Math.min(1, dot(sub(q, a), d) / l2)) : 0; return dist(q, add(a, mul(d, t))); }
  function spot(sp, obs) {
    var best = null, room = -Infinity;
    for (var k = 0; k < SPOTS.length; k++) {
      var q = P(sp.x + SPOTS[k][0] * 13, sp.y + SPOTS[k][1] * 13), m = Infinity;
      for (var i = 0; i < obs.length; i++) {
        var b = obs[i], d = b.a ? segDist(q, b.a, b.b) : b.c ? Math.abs(dist(q, b.c) - b.r) : dist(q, b.p);
        if (d - b.pad < m) m = d - b.pad;
      }
      if (m >= 11) return q;
      if (m > room) { room = m; best = q; }
    }
    return best;
  }
  function angleMark(a, b, c, deg, col, th, tag, h, halo, ob) {
    var u = unit(sub(a, b)), v = unit(sub(c, b));
    if (!u || !v) return '';
    var r = 26, out = '';
    if (Math.abs(deg - 90) < 0.05) {
      var p1 = add(b, mul(u, 14)), p2 = add(p1, mul(v, 14)), p3 = add(b, mul(v, 14));
      out += '<path' + tag + ' d="M' + n1(p1.x) + ' ' + n1(p1.y) + 'L' + n1(p2.x) + ' ' + n1(p2.y) + 'L' + n1(p3.x) + ' ' + n1(p3.y) + '" fill="none" stroke="' + col + '" stroke-width="2"/>';
    } else {
      var s = add(b, mul(u, r)), e = add(b, mul(v, r));
      out += '<path' + tag + ' d="M' + n1(b.x) + ' ' + n1(b.y) + 'L' + n1(s.x) + ' ' + n1(s.y) + 'A' + r + ' ' + r + ' 0 0 ' + (cross(u, v) < 0 ? 1 : 0) + ' ' + n1(e.x) + ' ' + n1(e.y) + 'Z" fill="' + col + '" fill-opacity="' + (h ? 0.45 : 0.22) + '" stroke="' + col + '" stroke-width="1.8"/>';
    }
    var t = angleAt(a, b, c).t, text = deg.toFixed(1) + '°';
    if (ob.opts.label && ob.opts.label !== true) text = ob.opts.label + ' = ' + text;
    return out + '<text x="' + n1(t.x) + '" y="' + n1(t.y + 5) + '" text-anchor="middle" font-family="' + SANS + '" font-size="15" font-weight="600" fill="' + col + '"' + halo + '>' + esc(text) + '</text>';
  }

  // ---------- What's under the pointer, in the element's px: points first
  function hit(objs, vals, o, sx, sy, upto) {
    var F = frame(o), m = P(sx, sy), out = [];
    objs.slice(0, upto == null ? objs.length : upto).forEach(function (ob) {
      var v = vals[ob.name];
      if (!v || ob.opts.hidden) return;
      var d = Infinity;
      if (isPoint(v)) d = dist(toScreen(F, v), m) - 4;
      else if (isLine(v)) {
        var a = toScreen(F, v.p), b = toScreen(F, v.q), ab = sub(b, a), t = dot(sub(m, a), ab) / dot(ab, ab);
        if (v.kind === 'segment') t = Math.max(0, Math.min(1, t)); else if (v.kind === 'ray') t = Math.max(0, t);
        d = dist(add(a, mul(ab, t)), m);
      } else if (isCircle(v)) d = Math.abs(dist(toScreen(F, v.c), m) - v.r * F.k);
      else if (v.pts) d = inside(v.pts.map(function (p) { return toScreen(F, p); }), m) ? 8 : Infinity;
      if (d < 9) out.push({ name: ob.name, d: d, point: isPoint(v), curve: isLine(v) || isCircle(v), free: ob.cmd === 'Point' || ob.cmd === 'PointOn' });
    });
    return out.sort(function (a, b) { return (b.point - a.point) || a.d - b.d; });
  }
  function inside(pts, m) {
    var c = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) if ((pts[i].y > m.y) !== (pts[j].y > m.y) && m.x < (pts[j].x - pts[i].x) * (m.y - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x) c = !c;
    return c;
  }

  // Dragging a free point to w (world), or a point on a curve to the nearest place on it
  function dragTo(ob, vals, w, snap) {
    if (ob.cmd === 'Point') { ob.args = [snap ? Math.round(w.x / snap) * snap : Math.round(w.x * 100) / 100, snap ? Math.round(w.y / snap) * snap : Math.round(w.y * 100) / 100]; return true; }
    if (ob.cmd === 'PointOn') {
      var v = vals[ob.args[0]];
      if (isCircle(v)) ob.args[1] = Math.round(Math.atan2(w.y - v.c.y, w.x - v.c.x) * 1000) / 1000;
      else if (isLine(v)) { var d = sub(v.q, v.p); ob.args[1] = Math.round(dot(sub(w, v.p), d) / dot(d, d) * 1000) / 1000; }
      else return false;
      return true;
    }
    return false;
  }

  // ---------- In a deck: points dragged with the pointer, steps from the
  // slide, and back to how it was saved when the slide is shown again.
  // cfg: script, view, W, H, dark, axes, grid, plan {to: [objects shown at
  // each step], captions, tidyAt}; opts.label as render's
  function attach(root, cfg, opts) {
    opts = opts || {};
    var saved = parse(cfg.script).objs, objs = clone(saved), vals = compute(objs), step = 0, drag = null, anim = null;
    var plan = cfg.plan || { to: [objs.length], captions: [] };
    var base = { W: cfg.W, H: cfg.H, view: cfg.view, dark: cfg.dark, axes: cfg.axes, grid: cfg.grid, label: opts.label };
    var draggable = objs.some(function (o) { return o.cmd === 'Point' || o.cmd === 'PointOn'; });
    function clone(list) { return list.map(function (o) { return { name: o.name, cmd: o.cmd, args: o.args.slice(), opts: o.opts, line: o.line }; }); }
    function upto() { return plan.to[Math.min(step, plan.to.length - 1)]; }
    function draw() {
      var o = {}, k;
      for (k in base) o[k] = base[k];
      o.upto = upto(); o.anim = anim; o.tidy = plan.tidyAt != null && step >= plan.tidyAt; o.caption = plan.captions[step] || '';
      o.hover = drag ? drag.name : null;
      root.innerHTML = render(objs, vals, o);
      anim = null;
    }
    function point(ev) {
      var svg = root.querySelector('svg'), m = svg && svg.getScreenCTM();
      if (!m) return null;
      var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      return pt.matrixTransform(m.inverse());
    }
    function onDown(ev) {
      var p = point(ev);
      if (!p) return;
      var h = hit(objs, vals, base, p.x, p.y, upto()).filter(function (x) { return x.free; })[0];
      if (!h) return;
      drag = { name: h.name };
      ev.preventDefault(); ev.stopPropagation();
      if (root.setPointerCapture) try { root.setPointerCapture(ev.pointerId); } catch (e) {}
      draw();
    }
    function onMove(ev) {
      var p = point(ev);
      if (!p) return;
      if (!drag) {
        var h = hit(objs, vals, base, p.x, p.y, upto()).filter(function (x) { return x.free; })[0];
        root.style.cursor = h ? 'grab' : '';
        return;
      }
      ev.preventDefault();
      var ob = objs.filter(function (o) { return o.name === drag.name; })[0];
      if (ob && dragTo(ob, vals, toWorld(base, p.x, p.y), cfg.grid ? gridStep(frame(base).k) : 0)) { vals = compute(objs); draw(); }
      root.style.cursor = 'grabbing';
    }
    function onUp() { if (drag) { drag = null; root.style.cursor = ''; draw(); } }
    if (draggable) {
      // A finger on the figure drags its points rather than turning the slide
      root.style.touchAction = 'none';
      root.setAttribute('data-prevent-swipe', '');
      root.addEventListener('pointerdown', onDown);
      root.addEventListener('pointermove', onMove);
      root.addEventListener('pointerup', onUp);
      root.addEventListener('pointercancel', onUp);
    }
    return {
      // Show step n, drawing in what it adds when going forward
      setStep: function (n, forward) {
        var before = upto();
        step = Math.max(0, Math.min(plan.to.length - 1, n));
        if (forward && upto() > before) anim = before;
        draw();
      },
      reset: function () { objs = clone(saved); vals = compute(objs); drag = null; draw(); },
      state: function () { return { step: step, objs: objs, vals: vals }; },
    };
  }

  return {
    CMDS: CMDS, THEMES: THEMES, parse: parse, serialize: serialize, compute: compute, describe: describe, labelTex: labelTex,
    render: render, hit: hit, frame: frame, toWorld: toWorld, toScreen: toScreen, gridStep: gridStep, dragTo: dragTo, attach: attach,
    intersections: intersections, isPoint: isPoint, isLine: isLine, isCircle: isCircle, dist: dist, cross: cross, sub: sub, add: add, mul: mul, dot: dot, len: len,
  };
}

export const GEO = geometryRuntime()

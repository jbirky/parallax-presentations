// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Reads a graph's expressions the way people type them into Desmos:
// multiplication without a sign (2x, 3(x+1), ab), functions with or without
// parentheses (sin x, sin^2 x, sin^-1 x), |x|, π and θ, subscripts (a_1),
// piecewise braces ({x < 0: -x, x}), which also restrict a curve
// (y = x^2 {0 < x < 2}), f(x) = … definitions, and a = 1 for sliders.
// Also fields: F(x, y) = (−y, x) and ∇f, systems x′ = …, y′ = … (or r′, θ′),
// slope fields dy/dx = …, and their paths, y(0) = 1 and (x, y)(0) = (1, 0);
// graphFields.js draws them.
//
// createMathParser has nothing from outside it: the graph page (graphPage.js)
// embeds its source, and the editor runs the same parser to show errors and
// offer sliders, so what the editor accepts is what the slide draws.

export function createMathParser() {
  const FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x),
    arcsin: Math.asin, arccos: Math.acos, arctan: (y, x) => (x === undefined ? Math.atan(y) : Math.atan2(y, x)),
    asin: Math.asin, acos: Math.acos, atan: (y, x) => (x === undefined ? Math.atan(y) : Math.atan2(y, x)),
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    sqrt: Math.sqrt, cbrt: Math.cbrt, exp: Math.exp, ln: Math.log, log: Math.log10,
    abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign, sgn: Math.sign,
    min: Math.min, max: Math.max, mod: (a, b) => ((a % b) + b) % b,
  }
  // [fewest, most] arguments
  const ARITY = { min: [1, 99], max: [1, 99], mod: [2, 2], arctan: [1, 2], atan: [1, 2] }
  const INVERSE = { sin: 'arcsin', cos: 'arccos', tan: 'arctan' }
  const CONSTANTS = { pi: Math.PI, tau: 2 * Math.PI, e: Math.E }
  const GREEK = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'lambda', 'sigma', 'omega', 'phi', 'rho', 'mu', 'nu', 'kappa', 'eta']
  // The variables curves are drawn over: never sliders
  const RESERVED = ['x', 'y', 't', 'theta', 'r']
  const NAMES = Object.keys(FUNCS).concat(Object.keys(CONSTANTS), ['theta'], GREEK)
    .sort((a, b) => b.length - a.length)
  const UNICODE = {
    '−': '-', '–': '-', '·': '*', '×': '*', '⋅': '*', '÷': '/', '≤': '<=', '≥': '>=',
    'π': 'pi', 'θ': 'theta', 'τ': 'tau', '√': 'sqrt', '²': '^2', '³': '^3',
    'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon', 'λ': 'lambda',
    'σ': 'sigma', 'ω': 'omega', 'φ': 'phi', 'ρ': 'rho', 'μ': 'mu', 'ν': 'nu', 'κ': 'kappa', 'η': 'eta',
  }
  const CMP = ['=', '<', '>', '<=', '>=']

  function fail(message) {
    const e = new Error(message)
    e.graphError = true
    throw e
  }

  function normalize(text) {
    let out = ''
    for (const ch of String(text)) out += UNICODE[ch] !== undefined ? UNICODE[ch] : ch
    return out
  }

  const isDigit = c => c >= '0' && c <= '9'
  const isLetter = c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
  const isWord = c => isLetter(c) || isDigit(c)

  function tokenize(text) {
    const s = normalize(text)
    const tokens = []
    let i = 0
    while (i < s.length) {
      const c = s[i]
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue }
      if (isDigit(c) || (c === '.' && isDigit(s[i + 1]))) {
        let j = i
        while (isDigit(s[j])) j++
        if (s[j] === '.') { j++; while (isDigit(s[j])) j++ }
        tokens.push({ t: 'num', v: parseFloat(s.slice(i, j)) })
        i = j
        continue
      }
      if (isLetter(c)) {
        const word = NAMES.find(n => s.startsWith(n, i))
        let name = word || c
        let j = i + name.length
        if (!word || !FUNCS[word]) {
          // A subscript: a_1, a_{12}, v_x
          if (s[j] === '_') {
            if (s[j + 1] === '{') {
              const end = s.indexOf('}', j + 2)
              if (end < 0) fail('A subscript _{ needs its }')
              const sub = s.slice(j + 2, end).trim()
              if (!sub || ![...sub].every(isWord)) fail('Subscripts are letters and digits, like a_1')
              name += '_' + sub
              j = end + 1
            } else {
              let k = j + 1
              while (k < s.length && isWord(s[k])) k++
              if (k === j + 1) fail('Put a letter or digit after _, like a_1')
              name += '_' + s.slice(j + 1, k)
              j = k
            }
          }
        }
        tokens.push({ t: word && FUNCS[word] ? 'fn' : 'id', v: name })
        i = j
        continue
      }
      const two = s.slice(i, i + 2)
      if (two === '<=' || two === '>=') { tokens.push({ t: 'op', v: two }); i += 2; continue }
      if (two === '**') { tokens.push({ t: 'op', v: '^' }); i += 2; continue }
      if ('+-*/^(),|{}=<>:'.includes(c)) { tokens.push({ t: 'op', v: c }); i++; continue }
      fail('“' + c + '” isn’t something a graph can read')
    }
    return tokens
  }

  // Tokens to a tree: { k: 'num' | 'var' | 'neg' | 'bin' | 'call' | 'ucall' | 'piece' | 'tuple' }
  function parser(tokens, userFns) {
    let pos = 0
    let absDepth = 0
    const peek = () => tokens[pos]
    const isOp = v => pos < tokens.length && tokens[pos].t === 'op' && tokens[pos].v === v
    function expect(v, what) {
      if (!isOp(v)) fail(pos < tokens.length ? 'Expected ' + (what || v) + ' before “' + tokens[pos].v + '”' : 'Expected ' + (what || v) + ' at the end')
      pos++
    }
    function startsFactor(tok) {
      if (!tok) return false
      if (tok.t !== 'op') return true
      return tok.v === '(' || tok.v === '{' || (tok.v === '|' && absDepth === 0)
    }

    function expr() {
      let a = term()
      while (isOp('+') || isOp('-')) {
        const op = tokens[pos++].v
        a = { k: 'bin', op, a, b: term() }
      }
      return a
    }
    function term() {
      let a = unary()
      for (;;) {
        if (isOp('*') || isOp('/')) {
          const op = tokens[pos++].v
          a = { k: 'bin', op, a, b: unary() }
        } else if (startsFactor(peek())) {
          a = { k: 'bin', op: '*', a, b: power() }
        } else {
          return a
        }
      }
    }
    function unary() {
      if (isOp('-')) { pos++; return { k: 'neg', a: unary() } }
      if (isOp('+')) { pos++; return unary() }
      return power()
    }
    function power() {
      const base = primary()
      if (isOp('^')) { pos++; return { k: 'bin', op: '^', a: base, b: exponent() } }
      return base
    }
    function exponent() {
      if (isOp('{')) { pos++; const e = expr(); expect('}'); return e }
      return unary()
    }
    function args() {
      const list = [expr()]
      while (isOp(',')) { pos++; list.push(expr()) }
      expect(')')
      return list
    }
    function chain(first) {
      const parts = [first || expr()]
      const ops = []
      while (pos < tokens.length && tokens[pos].t === 'op' && CMP.includes(tokens[pos].v)) {
        ops.push(tokens[pos++].v)
        parts.push(expr())
      }
      return { parts, ops }
    }
    function piecewise() {
      const branches = []
      let otherwise = null
      for (;;) {
        const c = chain()
        if (!c.ops.length) {
          otherwise = c.parts[0]
          if (!isOp('}')) fail('In { }, the value for “otherwise” goes last')
          break
        }
        let value = null
        if (isOp(':')) { pos++; value = expr() }
        branches.push({ cond: c, value })
        if (!isOp(',')) break
        pos++
      }
      expect('}')
      return { k: 'piece', branches, otherwise }
    }
    function fn() {
      let name = tokens[pos++].v
      let pow = null
      if (isOp('^')) { pos++; pow = exponent() }
      if (pow && INVERSE[name] && pow.k === 'neg' && pow.a.k === 'num' && pow.a.v === 1) { name = INVERSE[name]; pow = null }
      let list
      if (isOp('(')) {
        pos++
        list = args()
      } else {
        if (!startsFactor(peek())) fail(name + ' needs something to work on, like ' + name + '(x)')
        // sin 2x is sin(2x); sin x cos x is sin(x)·cos(x)
        let a = power()
        while (startsFactor(peek()) && peek().t !== 'fn') a = { k: 'bin', op: '*', a, b: power() }
        list = [a]
      }
      const [least, most] = ARITY[name] || [1, 1]
      if (list.length < least || list.length > most) {
        fail(name + ' takes ' + (least === most ? least : least + ' or ' + most) + ' value' + (most === 1 ? '' : 's'))
      }
      const call = { k: 'call', f: name, args: list }
      return pow ? { k: 'bin', op: '^', a: call, b: pow } : call
    }
    function primary() {
      const tok = peek()
      if (!tok) fail('Something’s missing at the end')
      if (tok.t === 'num') { pos++; return { k: 'num', v: tok.v } }
      if (tok.t === 'fn') return fn()
      if (tok.t === 'id') {
        pos++
        if (userFns.has(tok.v) && isOp('(')) { pos++; return { k: 'ucall', f: tok.v, args: args() } }
        return { k: 'var', n: tok.v }
      }
      if (isOp('(')) {
        pos++
        const saved = absDepth
        absDepth = 0
        const items = args()
        absDepth = saved
        return items.length === 1 ? items[0] : { k: 'tuple', items }
      }
      if (isOp('|')) {
        pos++
        absDepth++
        const a = expr()
        absDepth--
        expect('|', 'a closing |')
        return { k: 'call', f: 'abs', args: [a] }
      }
      if (isOp('{')) { pos++; return piecewise() }
      fail('“' + tok.v + '” is out of place')
    }

    return {
      statement() {
        const c = chain()
        if (pos < tokens.length) fail('“' + tokens[pos].v + '” is out of place')
        return c
      },
    }
  }

  function parseStatement(text, userFns) {
    return parser(tokenize(text), userFns || new Set()).statement()
  }

  // The variables an expression reads, less a function's own arguments
  function freeVars(node, into, bound) {
    const out = into || new Set()
    const walk = n => {
      if (!n) return
      switch (n.k) {
        case 'var': if (!(n.n in CONSTANTS) && !(bound && bound.includes(n.n))) out.add(n.n); break
        case 'neg': walk(n.a); break
        case 'bin': walk(n.a); walk(n.b); break
        case 'call': case 'ucall': n.args.forEach(walk); break
        case 'tuple': n.items.forEach(walk); break
        case 'piece':
          n.branches.forEach(b => { b.cond.parts.forEach(walk); walk(b.value) })
          walk(n.otherwise)
          break
      }
    }
    walk(node)
    return out
  }

  function usedFns(node, into) {
    const out = into || new Set()
    const walk = n => {
      if (!n) return
      if (n.k === 'ucall') out.add(n.f)
      if (n.a) walk(n.a)
      if (n.b) walk(n.b)
      if (n.args) n.args.forEach(walk)
      if (n.items) n.items.forEach(walk)
      if (n.branches) n.branches.forEach(b => { b.cond.parts.forEach(walk); walk(b.value) })
      if (n.otherwise) walk(n.otherwise)
    }
    walk(node)
    return out
  }

  const approxEqual = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
  const COMPARE = {
    '=': approxEqual,
    '<': (a, b) => a < b, '>': (a, b) => a > b, '<=': (a, b) => a <= b, '>=': (a, b) => a >= b,
  }

  // A tree to a function of (env, args): env holds x, y, t, theta and the
  // sliders' values; args a user function's arguments. Nothing is eval'd.
  function compile(node, formals, fns) {
    const c = n => compile(n, formals, fns)
    switch (node.k) {
      case 'num': { const v = node.v; return () => v }
      case 'var': {
        if (node.n in CONSTANTS) { const v = CONSTANTS[node.n]; return () => v }
        const i = formals ? formals.indexOf(node.n) : -1
        if (i >= 0) return (env, a) => a[i]
        if (fns[node.n]) fail(node.n + ' is a function: write ' + node.n + '(x)')
        const name = node.n
        return env => { const v = env[name]; return typeof v === 'number' ? v : NaN }
      }
      case 'neg': { const a = c(node.a); return (env, x) => -a(env, x) }
      case 'bin': {
        const a = c(node.a), b = c(node.b)
        switch (node.op) {
          case '+': return (env, x) => a(env, x) + b(env, x)
          case '-': return (env, x) => a(env, x) - b(env, x)
          case '*': return (env, x) => a(env, x) * b(env, x)
          case '/': return (env, x) => a(env, x) / b(env, x)
          default: return (env, x) => Math.pow(a(env, x), b(env, x))
        }
      }
      case 'call': {
        const f = FUNCS[node.f]
        const list = node.args.map(c)
        if (list.length === 1) { const a = list[0]; return (env, x) => f(a(env, x)) }
        if (list.length === 2) { const a = list[0], b = list[1]; return (env, x) => f(a(env, x), b(env, x)) }
        return (env, x) => f.apply(null, list.map(g => g(env, x)))
      }
      case 'ucall': {
        const def = fns[node.f]
        // Only functions that compiled are here: this one has an error
        if (!def) fail(node.f + '(…) has an error')
        if (def.formals.length !== node.args.length) fail(node.f + ' takes ' + def.formals.length + ' value' + (def.formals.length === 1 ? '' : 's'))
        const list = node.args.map(c)
        return (env, x) => def.call(env, list.map(g => g(env, x)))
      }
      case 'piece': {
        const branches = node.branches.map(b => ({ test: condition(b.cond, formals, fns), value: b.value ? c(b.value) : () => 1 }))
        const otherwise = node.otherwise ? c(node.otherwise) : () => NaN
        return (env, x) => {
          for (let i = 0; i < branches.length; i++) if (branches[i].test(env, x)) return branches[i].value(env, x)
          return otherwise(env, x)
        }
      }
      case 'tuple': fail('A point ( , ) can’t be used inside a calculation')
    }
    fail('Couldn’t read this')
  }

  function condition(ch, formals, fns) {
    const parts = ch.parts.map(p => compile(p, formals, fns))
    const tests = ch.ops.map(op => COMPARE[op])
    return (env, x) => {
      let left = parts[0](env, x)
      for (let i = 0; i < tests.length; i++) {
        const right = parts[i + 1](env, x)
        if (!tests[i](left, right)) return false
        left = right
      }
      return true
    }
  }

  const FN_DEF = /^\s*([A-Za-z](?:_(?:\{[A-Za-z0-9]+\}|[A-Za-z0-9]+))?)\s*\(\s*([A-Za-z]+(?:\s*,\s*[A-Za-z]+)*)\s*\)\s*=(?![=<>])/

  // A slider's value as typed: a number, maybe negative
  function literal(node) {
    if (node.k === 'num') return node.v
    if (node.k === 'neg' && node.a.k === 'num') return -node.a.v
    return null
  }

  const isVar = (node, name) => node.k === 'var' && node.n === name
  // Uses no curve variables but these; any other name is a slider, made or not
  const only = (set, names) => [...set].every(v => !RESERVED.includes(v) || names.includes(v))
  const has = (set, names) => names.some(n => set.has(n))

  // ── Fields ────────────────────────────────────────────────────────────
  // Lines graphFields draws, told apart by how they're written

  function fieldText(text) {
    return normalize(text).replace(/[′’ʹ]/g, "'").replace(/ẋ/g, "x'").replace(/ẏ/g, "y'").replace(/ṙ/g, "r'").trim()
  }
  // "(a, b)" to ["a", "b"], split at the comma outside any brackets
  function pairOf(text) {
    const s = text.trim()
    if (s[0] !== '(' || s[s.length - 1] !== ')') return null
    let depth = 0, cut = -1
    for (let i = 1; i < s.length - 1; i++) {
      const c = s[i]
      if (c === '(' || c === '{') depth++
      else if (c === ')' || c === '}') { if (--depth < 0) return null } else if (c === ',' && depth === 0) { if (cut >= 0) return null; cut = i }
    }
    return cut < 0 || depth !== 0 ? null : [s.slice(1, cut), s.slice(cut + 1, -1)]
  }
  // (P, Q) {x² + y² > 1}: the field only where that holds, as a curve is restricted
  const restrictTo = (p, cond) => (cond ? p.map(c => '(' + c + ')' + cond) : p)
  const FIELD_NAME = '([A-Za-z](?:_(?:\\{[A-Za-z0-9]+\\}|[A-Za-z0-9]+))?)'
  const FIELD = {
    sys: /^\(\s*x\s*'\s*,\s*y\s*'\s*\)\s*=(.*?)\s*(\{[^{}]*\})?$/,
    rate: /^(?:(x|y|r|theta)\s*'|d(x|y|r|theta)\s*\/\s*dt)\s*=(?![=<>])(.*)$/,
    slope: /^dy\s*\/\s*dx\s*=(?![=<>])(.*)$/,
    ic1: /^y\s*\(([^()]*)\)\s*=(?![=<>])(.*)$/,
    ic2: /^\(\s*x\s*,\s*y\s*\)\s*\(([^()]*)\)\s*=(?![=<>])(.*)$/,
    grad: new RegExp('^(?:∇|grad\\s+|grad(?=\\s*[A-Za-z]))\\s*' + FIELD_NAME + '\\s*$'),
    vec: new RegExp('^' + FIELD_NAME + '\\s*\\(\\s*x\\s*,\\s*y\\s*\\)\\s*=(?![=<>])\\s*(\\(.*\\))\\s*(\\{[^{}]*\\})?$'),
    bare: /^(\(.*\))\s*(\{[^{}]*\})?$/,
  }
  // What a field line is, or null for Graph's other lines
  function fieldOf(text) {
    const s = fieldText(text)
    let m, p
    if (!s) return null
    if ((m = FIELD.sys.exec(s))) return (p = pairOf(m[1])) ? { type: 'system', comps: restrictTo(p, m[2]) } : { type: 'bad', error: 'Write (x′, y′) = (…, …)' }
    if ((m = FIELD.rate.exec(s))) return { type: 'rate', v: m[1] || m[2], rhs: m[3] }
    if ((m = FIELD.slope.exec(s))) return { type: 'slope', rhs: m[1] }
    if ((m = FIELD.ic2.exec(s))) return (p = pairOf(m[2])) ? { type: 'ic2', at: m[1], comps: p } : { type: 'bad', error: 'Write (x, y)(0) = (a, b)' }
    if ((m = FIELD.ic1.exec(s))) return { type: 'ic1', at: m[1], val: m[2] }
    if ((m = FIELD.grad.exec(s))) return { type: 'grad', f: m[1].replace(/[{}]/g, '') }
    if ((m = FIELD.vec.exec(s)) && (p = pairOf(m[2]))) return { type: 'vector', name: m[1].replace(/[{}]/g, ''), comps: restrictTo(p, m[3]) }
    // A bare (P, Q) using both x and y is a field; with t it's a curve, without
    // them a point (and (x, 2) is still a mistaken point, not a field)
    if ((m = FIELD.bare.exec(s)) && (p = pairOf(m[1]))) {
      try {
        const vars = new Set()
        p.forEach(c => freeVars(parseStatement(c).parts[0], vars))
        if (vars.has('x') && vars.has('y') && !vars.has('t')) return { type: 'vector', name: null, comps: restrictTo(p, m[2]) }
      } catch (e) {
        if (!e.graphError) throw e
      }
    }
    return null
  }

  // The field lines of a graph, once its sliders and functions are known:
  // each gets its kind and compiled functions (F(env, x, y, out) for a
  // vector field or system, f(env, x, y) for a slope field), or an error
  function readFields(items, params, callable, note) {
    const fnNames = new Set(Object.keys(callable))
    // A compiled expression in the given variables, sliders from env
    const compiled = (item, text, own) => {
      const st = parseStatement(text, fnNames)
      if (st.ops.length) fail('One expression here, without =, < or >')
      const node = st.parts[0]
      if (node.k === 'tuple') fail('A component is one number, not a point')
      const vars = freeVars(node)
      for (const v of vars) {
        if (own.includes(v) || params.has(v) || fnNames.has(v)) continue
        if (RESERVED.includes(v)) fail(!own.length ? 'A starting point is numbers or sliders' : v === 't' ? 'A field here doesn’t change with t: use x, y and sliders' : 'Use ' + own.map(o => (o === 'theta' ? 'θ' : o)).join(' and ') + ' and sliders here')
      }
      note(vars, item)
      return { f: compile(node, own.length ? own : null, callable), node }
    }
    const xy = (fx, fy) => (env, x, y, out) => { const a = [x, y]; out[0] = fx(env, a); out[1] = fy(env, a) }
    const sliderOf = node => (node.k === 'var' && params.has(node.n) ? node.n : null)
    const guard = (item, fn) => {
      try { fn() } catch (e) {
        if (!e.graphError) throw e
        Object.assign(item, { kind: 'error', error: e.message })
      }
    }
    const fields = items.filter(it => it.field)
    // x′ and y′ (or r′ and θ′) make a system, kept on the first of the two
    const rates = fields.filter(it => it.field.type === 'rate')
    const byVar = {}
    for (const it of rates) (byVar[it.field.v] = byVar[it.field.v] || []).push(it)
    for (const it of rates) {
      guard(it, () => {
        const v = it.field.v, name = v === 'theta' ? 'θ' : v
        if (byVar[v].length > 1) fail(name + '′ is defined twice')
        const mate = (byVar[{ x: 'y', y: 'x', r: 'theta', theta: 'r' }[v]] || [])[0]
        if (!mate) {
          // y′ = … on its own is dy/dx
          if (v === 'y') { it.field = { type: 'slope', rhs: it.field.rhs }; return }
          fail(v === 'x' ? 'x′ = … needs a y′ = … line too' : v === 'r' ? 'r′ = … needs a θ′ = … line too' : 'θ′ = … needs an r′ = … line too')
        }
        if (items.indexOf(mate) < items.indexOf(it)) { Object.assign(it, { kind: 'partner', partnerOf: mate.id }); return }
        it.partner = mate.id
        const rhs = w => (it.field.v === w ? it : mate).field.rhs
        if (v === 'x' || v === 'y') {
          const fx = compiled(it, rhs('x'), ['x', 'y']).f, fy = compiled(it, rhs('y'), ['x', 'y']).f
          Object.assign(it, { kind: 'system', F: xy(fx, fy) })
        } else {
          const fr = compiled(it, rhs('r'), ['r', 'theta']).f, ft = compiled(it, rhs('theta'), ['r', 'theta']).f
          Object.assign(it, {
            kind: 'system', polar: true,
            F: (env, x, y, out) => {
              const r = Math.hypot(x, y), th = Math.atan2(y, x), a = [r, th], dr = fr(env, a), dt = ft(env, a)
              out[0] = dr * Math.cos(th) - r * dt * Math.sin(th)
              out[1] = dr * Math.sin(th) + r * dt * Math.cos(th)
            },
          })
        }
      })
      // An error in either line is the system's: its partner says so too
      if (it.kind === 'error' && it.partner) {
        const mate = items.find(o => o.id === it.partner)
        if (mate && !mate.kind) Object.assign(mate, { kind: 'partner', partnerOf: it.id })
      }
    }
    for (const it of fields) {
      if (it.kind) continue
      guard(it, () => {
        const d = it.field
        if (d.type === 'bad') fail(d.error)
        if (d.type === 'system' || d.type === 'vector') {
          const fx = compiled(it, d.comps[0], ['x', 'y']).f, fy = compiled(it, d.comps[1], ['x', 'y']).f
          Object.assign(it, { kind: d.type, F: xy(fx, fy), name: d.name || null })
        } else if (d.type === 'grad') {
          const def = callable[d.f]
          if (!def) fail(d.f + '(x, y) = … isn’t defined')
          if (def.formals.length !== 2) fail('∇' + d.f + ' needs ' + d.f + '(x, y), with two variables')
          Object.assign(it, {
            kind: 'vector', gradOf: d.f,
            F: (env, x, y, out) => {
              const hx = 1e-5 * (1 + Math.abs(x)), hy = 1e-5 * (1 + Math.abs(y))
              out[0] = (def.call(env, [x + hx, y]) - def.call(env, [x - hx, y])) / (2 * hx)
              out[1] = (def.call(env, [x, y + hy]) - def.call(env, [x, y - hy])) / (2 * hy)
            },
          })
        } else if (d.type === 'slope') {
          const g = compiled(it, d.rhs, ['x', 'y']).f
          Object.assign(it, { kind: 'slope', f: (env, x, y) => g(env, [x, y]) })
        } else if (d.type === 'ic1') {
          const x0 = compiled(it, d.at, []), y0 = compiled(it, d.val, [])
          Object.assign(it, { kind: 'solution', x0: x0.f, y0: y0.f, dragY: sliderOf(y0.node) })
        } else if (d.type === 'ic2') {
          const px = compiled(it, d.comps[0], []), py = compiled(it, d.comps[1], [])
          compiled(it, d.at, [])
          Object.assign(it, { kind: 'trajectory', px: px.f, py: py.f, dragX: sliderOf(px.node), dragY: sliderOf(py.node) })
        }
      })
    }
    // A field's name, like a function's, is defined once
    const names = {}
    for (const it of fields) {
      if (it.kind !== 'vector' || !it.name) continue
      if (names[it.name]) Object.assign(it, { kind: 'error', error: it.name + ' is defined twice' })
      names[it.name] = true
    }
    // A solution or path follows the field above it, or else the first below
    for (const it of fields) {
      if (it.kind !== 'solution' && it.kind !== 'trajectory') continue
      const want = it.kind === 'solution' ? ['slope'] : ['system', 'vector']
      const i = items.indexOf(it)
      let owner = null
      for (let j = i - 1; j >= 0 && !owner; j--) if (want.includes(items[j].kind)) owner = items[j]
      for (let j = i + 1; j < items.length && !owner; j++) if (want.includes(items[j].kind)) owner = items[j]
      if (owner) it.owner = owner.id
      else Object.assign(it, { kind: 'error', error: it.kind === 'solution' ? 'y(…) = … needs a slope field, like dy/dx = x − y' : '(x, y)(0) = (…) needs a field or a system to follow' })
    }
  }

  // Every expression of a graph, read together: what each one is, its
  // compiled functions, its error, and the names used but never defined
  // (the sliders to offer). Expressions are { id, text }.
  function analyze(expressions) {
    const items = (expressions || []).map(e => ({ id: e.id, text: String(e.text || '') }))
    const fns = {}
    for (const item of items) {
      const field = fieldOf(item.text)
      if (field) item.field = field
    }

    // Function definitions first, so f(x) reads as a call everywhere
    for (const item of items) {
      if (item.field) continue
      const text = normalize(item.text)
      const m = FN_DEF.exec(text)
      if (!m) continue
      const name = m[1].replace(/[{}]/g, '')
      const formals = m[2].split(',').map(s => s.trim())
      if (FUNCS[name] || name in CONSTANTS || RESERVED.includes(name)) continue
      if (!formals.every(f => f.length === 1 || f === 'theta' || GREEK.includes(f))) continue
      if (fns[name]) { item.kind = 'error'; item.error = name + ' is defined twice'; continue }
      item.kind = 'function'
      item.name = name
      item.formals = formals
      item.bodyText = text.slice(m[0].length)
      fns[name] = { formals, item }
    }
    const userFns = new Set(Object.keys(fns))

    for (const item of items) {
      if (item.kind === 'error' || item.field) continue
      if (!item.text.trim()) { item.kind = 'empty'; continue }
      try {
        if (item.kind === 'function') {
          const st = parseStatement(item.bodyText, userFns)
          if (st.ops.length) fail('A function is one expression after =')
          item.body = st.parts[0]
        } else {
          item.stmt = parseStatement(item.text, userFns)
        }
      } catch (e) {
        if (!e.graphError) throw e
        item.kind = 'error'
        item.error = e.message
      }
    }

    // Sliders and other named values: a = 1, c = 2a
    const params = new Set()
    for (const item of items) {
      if (!item.stmt || item.kind) continue
      const { parts, ops } = item.stmt
      if (ops.length !== 1 || ops[0] !== '=' || parts[0].k !== 'var') continue
      const name = parts[0].n
      if (RESERVED.includes(name) || name in CONSTANTS) continue
      if (has(freeVars(parts[1]), RESERVED)) continue
      if (params.has(name)) { item.kind = 'error'; item.error = name + ' is defined twice'; continue }
      params.add(name)
      item.kind = 'param'
      item.name = name
      item.value = parts[1]
      item.literal = literal(parts[1])
      item.slider = item.literal !== null
    }
    for (const name of params) {
      if (fns[name]) Object.assign(fns[name].item, { kind: 'error', error: name + ' is already a slider' })
    }

    const known = new Set(RESERVED.concat([...params], [...userFns]))
    const missing = new Set()
    const note = (vars, item) => vars.forEach(v => {
      if (known.has(v)) return
      missing.add(v)
      if (item) (item.missing = item.missing || []).push(v)
    })

    // User functions call each other; one that reaches itself can't be drawn
    const reaches = (name, seen) => {
      const def = fns[name]
      if (!def || !def.item.body) return false
      for (const f of usedFns(def.item.body)) {
        if (seen.has(f)) return true
        if (reaches(f, new Set([...seen, f]))) return true
      }
      return false
    }
    for (const name of userFns) {
      const item = fns[name].item
      if (item.kind === 'function' && reaches(name, new Set([name]))) { item.kind = 'error'; item.error = name + ' uses itself' }
    }
    // A compiled user function; its body's free variables come from env. Its
    // body compiles against the functions that can be called, so one calling
    // a function with an error has an error too, rather than failing when drawn
    const callable = {}
    for (const name of userFns) if (fns[name].item.kind === 'function') callable[name] = fns[name]
    for (const name of Object.keys(callable)) {
      const def = callable[name]
      let body = null
      def.call = (env, a) => (body ? body(env, a) : NaN)
      def.compile = () => { body = compile(def.item.body, def.formals, callable) }
    }
    for (const name of Object.keys(callable)) {
      try { callable[name].compile() } catch (e) {
        if (!e.graphError) throw e
        callable[name].item.kind = 'error'
        callable[name].item.error = e.message
      }
    }
    // A function compiled before one it calls failed has an error as well
    for (let changed = true; changed;) {
      changed = false
      for (const name of Object.keys(callable)) {
        const item = callable[name].item
        if (item.kind !== 'function') { delete callable[name]; changed = true; continue }
        const broken = [...usedFns(item.body)].find(f => !callable[f] || callable[f].item.kind !== 'function')
        if (broken) { Object.assign(item, { kind: 'error', error: broken + '(…) has an error' }); changed = true }
      }
    }

    const cf = node => compile(node, null, callable)
    readFields(items, params, callable, note)

    for (const item of items) {
      try {
        if (item.kind === 'function') {
          const vars = freeVars(item.body, null, item.formals)
          note(vars, item)
          // f(x) = … is also drawn, as Desmos does
          if (item.formals.length === 1 && item.formals[0] === 'x' && only(vars, ['x'])) {
            item.graph = 'y'
            const def = callable[item.name]
            item.f = env => def.call(env, [env.x])
          }
        } else if (item.kind === 'param') {
          note(freeVars(item.value), item)
          item.f = cf(item.value)
        } else if (item.stmt && !item.kind) {
          classify(item)
        }
      } catch (e) {
        if (!e.graphError) throw e
        item.kind = 'error'
        item.error = e.message
      }
    }

    function classify(item) {
      const { parts, ops } = item.stmt
      const vars = new Set()
      parts.forEach(p => freeVars(p, vars))
      note(vars, item)
      if (!ops.length) {
        let node = parts[0]
        // (cos t, sin t) {t < π}: the restriction applies to both
        let restrict = null
        if (node.k === 'bin' && node.op === '*' && node.a.k === 'tuple') { restrict = node.b; node = node.a }
        if (node.k === 'tuple') {
          if (node.items.length !== 2) fail('A point has two coordinates, like (1, 2)')
          const [nx, ny] = restrict ? node.items.map(n => ({ k: 'bin', op: '*', a: n, b: restrict })) : node.items
          if (vars.has('t')) {
            if (!only(vars, ['t'])) fail('A curve (x(t), y(t)) can use only t and sliders')
            item.kind = 'parametric'
          } else {
            if (has(vars, RESERVED)) fail('A point’s coordinates are numbers or sliders; for a curve use t, for a vector field write F(x, y) = (…)')
            item.kind = 'point'
            // (a, b) with sliders a and b can be dragged
            item.dragX = node.items[0].k === 'var' && params.has(node.items[0].n) ? node.items[0].n : null
            item.dragY = node.items[1].k === 'var' && params.has(node.items[1].n) ? node.items[1].n : null
          }
          item.fx = cf(nx)
          item.fy = cf(ny)
          return
        }
        if (has(vars, ['y', 't', 'theta', 'r'])) fail('Write it as an equation, like y = …')
        item.f = cf(node)
        item.kind = vars.has('x') ? 'explicit' : 'value'
        item.axis = 'y'
        return
      }

      if (ops.every(op => op === '=')) {
        if (ops.length > 1) fail('Only one = per line')
        const [l, r] = parts
        for (const [side, other] of [[l, r], [r, l]]) {
          const ov = freeVars(other)
          if (isVar(side, 'y') && only(ov, ['x'])) { item.kind = 'explicit'; item.axis = 'y'; item.f = cf(other); return }
          if (isVar(side, 'x') && only(ov, ['y'])) { item.kind = 'explicit'; item.axis = 'x'; item.f = cf(other); return }
          if (isVar(side, 'r') && only(ov, ['theta'])) { item.kind = 'polar'; item.f = cf(other); return }
        }
        if (isVar(l, 't') || isVar(l, 'theta')) fail(l.n + ' is what curves are drawn over; call this something else')
        if (!only(vars, ['x', 'y'])) fail('An equation uses x, y and sliders; for curves over t or θ, see the examples')
        if (!has(vars, ['x', 'y'])) fail('There’s no x or y to draw')
        const lf = cf(l), rf = cf(r)
        item.kind = 'implicit'
        item.F = env => lf(env) - rf(env)
        return
      }

      if (ops.includes('=')) fail('Use either = or <, >, ≤, ≥ in one line')
      if (!only(vars, ['x', 'y'])) fail('An inequality uses x, y and sliders')
      if (!has(vars, ['x', 'y'])) fail('There’s no x or y to shade')
      if (ops.length === 1) {
        const [l, r] = parts
        const op = ops[0]
        const strict = op === '<' || op === '>'
        const less = op === '<' || op === '<='
        for (const [axis, other] of [['y', 'x'], ['x', 'y']]) {
          if (isVar(l, axis) && only(freeVars(r), [other])) {
            Object.assign(item, { kind: 'region', axis, f: cf(r), side: less ? 'below' : 'above', strict })
            return
          }
          if (isVar(r, axis) && only(freeVars(l), [other])) {
            Object.assign(item, { kind: 'region', axis, f: cf(l), side: less ? 'above' : 'below', strict })
            return
          }
        }
      }
      // Any other inequality, chained or not: shade where every part holds
      item.kind = 'region'
      item.axis = null
      item.comps = ops.map((op, i) => {
        const lf = cf(parts[i]), rf = cf(parts[i + 1])
        const test = COMPARE[op]
        return { g: env => lf(env) - rf(env), test: env => test(lf(env), rf(env)), strict: op === '<' || op === '>' }
      })
    }

    return { items, params: [...params], missing: [...missing], fns: Object.keys(callable) }
  }

  // Every named value's number, sliders from `values` when given
  function paramValues(analysis, values) {
    const env = {}
    const pending = analysis.items.filter(it => it.kind === 'param')
    for (const it of pending) {
      if (it.slider) env[it.name] = values && typeof values[it.name] === 'number' ? values[it.name] : it.literal
    }
    // Each pass settles at least one value that depends only on settled ones,
    // so as many passes as there are values settles every one there is
    let rest = pending.filter(it => !it.slider)
    const passes = rest.length + 1
    for (let pass = 0; pass < passes && rest.length; pass++) {
      rest = rest.filter(it => {
        const v = it.f(env)
        if (Number.isNaN(v) && [...freeVars(it.value)].some(n => env[n] === undefined)) return true
        env[it.name] = v
        return false
      })
    }
    return env
  }

  return { tokenize, parseStatement, freeVars, compile, analyze, paramValues, normalize, RESERVED }
}

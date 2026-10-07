// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Expressions over a dataset's rows, for computed columns and filters:
// pl_bmasse / 317.83, log(pl_orbper), if(disc_year < 2000, "early", "late").
// The functions and constants are Graph's (log is base 10, ln is natural),
// but a name is a whole column name, so multiplying names takes a * (Graph
// reads "ab" as a times b; here it's the column ab). A number before a name
// still multiplies it, as in 2π. A column whose name isn't a plain word
// goes in backticks: `mass (kg)`.
//
// An expression compiles to closures over the table's columns, never to
// code: nothing in it can reach anything but the row it's evaluated on.

const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x),
  arcsin: Math.asin, arccos: Math.acos, arctan: (y, x) => (x === undefined ? Math.atan(y) : Math.atan2(y, x)),
  asin: Math.asin, acos: Math.acos, atan: (y, x) => (x === undefined ? Math.atan(y) : Math.atan2(y, x)),
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, cbrt: Math.cbrt, exp: Math.exp, ln: Math.log, log: Math.log10, log2: Math.log2,
  abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign, sgn: Math.sign,
  min: Math.min, max: Math.max, mod: (a, b) => ((a % b) + b) % b,
}
// [fewest, most] arguments; one otherwise
const ARITY = { min: [1, 99], max: [1, 99], mod: [2, 2], arctan: [1, 2], atan: [1, 2] }
const CONSTANTS = { pi: Math.PI, tau: 2 * Math.PI, e: Math.E }
const UNICODE = {
  '−': '-', '–': '-', '·': '*', '×': '*', '⋅': '*', '÷': '/', '≤': '<=', '≥': '>=', '≠': '!=',
  'π': 'pi', 'τ': 'tau', '²': '^2', '³': '^3',
}
const MAX_LENGTH = 1000

class ExprError extends Error {
  constructor(message) {
    super(message)
    this.exprError = true
  }
}

function tokenize(source) {
  let text = ''
  for (const ch of String(source)) text += UNICODE[ch] !== undefined ? UNICODE[ch] : ch
  const tokens = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (/\s/.test(c)) { i++; continue }
    if (/[0-9.]/.test(c)) {
      const m = text.slice(i).match(/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/)
      if (!m) throw new ExprError(`Unexpected "${c}"`)
      tokens.push({ type: 'num', value: Number(m[0]) })
      i += m[0].length
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = text.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/)
      tokens.push({ type: 'name', value: m[0] })
      i += m[0].length
      continue
    }
    if (c === '`') {
      const end = text.indexOf('`', i + 1)
      if (end === -1) throw new ExprError('A backtick column name isn’t closed')
      tokens.push({ type: 'column', value: text.slice(i + 1, end) })
      i = end + 1
      continue
    }
    if (c === '"' || c === '\'') {
      const end = text.indexOf(c, i + 1)
      if (end === -1) throw new ExprError('A quoted text isn’t closed')
      tokens.push({ type: 'str', value: text.slice(i + 1, end) })
      i = end + 1
      continue
    }
    const two = text.slice(i, i + 2)
    if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) { tokens.push({ type: 'op', value: two }); i += 2; continue }
    if ('+-*/%^()<>=!,'.includes(c)) { tokens.push({ type: 'op', value: c }); i++; continue }
    throw new ExprError(`Unexpected "${c}"`)
  }
  return tokens
}

// Parses into a tree of { kind, ... } nodes
function parse(tokens) {
  let pos = 0
  const peek = () => tokens[pos]
  const isOp = (...ops) => peek() && peek().type === 'op' && ops.includes(peek().value)
  const isWord = (...words) => peek() && peek().type === 'name' && words.includes(peek().value.toLowerCase())
  const expect = op => {
    if (!isOp(op)) throw new ExprError(peek() ? `Expected "${op}" before ${describe(peek())}` : `Expected "${op}" at the end`)
    pos++
  }

  function or() {
    let left = and()
    while (isOp('||') || isWord('or')) { pos++; left = { kind: 'or', left, right: and() } }
    return left
  }
  function and() {
    let left = not()
    while (isOp('&&') || isWord('and')) { pos++; left = { kind: 'and', left, right: not() } }
    return left
  }
  function not() {
    if (isOp('!') || isWord('not')) { pos++; return { kind: 'not', arg: not() } }
    return compare()
  }
  function compare() {
    const left = add()
    if (isOp('<', '<=', '>', '>=', '==', '=', '!=')) {
      const op = tokens[pos++].value
      return { kind: 'cmp', op: op === '=' ? '==' : op, left, right: add() }
    }
    return left
  }
  function add() {
    let left = mul()
    while (isOp('+', '-')) { const op = tokens[pos++].value; left = { kind: 'bin', op, left, right: mul() } }
    return left
  }
  function mul() {
    let left = unary()
    while (isOp('*', '/', '%')) { const op = tokens[pos++].value; left = { kind: 'bin', op, left, right: unary() } }
    return left
  }
  function unary() {
    if (isOp('-')) { pos++; return { kind: 'neg', arg: unary() } }
    if (isOp('+')) { pos++; return unary() }
    return power()
  }
  function power() {
    const base = primary()
    if (isOp('^')) { pos++; return { kind: 'bin', op: '^', left: base, right: unary() } }
    // A number right before a name or a bracket multiplies it, as in Graph
    // (2π, 3(x + 1)): no column name starts with a digit
    if (base.kind === 'num' && peek() && !isWord('and', 'or', 'not') && (peek().type === 'name' || peek().type === 'column' || isOp('('))) {
      return { kind: 'bin', op: '*', left: base, right: power() }
    }
    return base
  }
  function primary() {
    const tok = peek()
    if (!tok) throw new ExprError('The expression ends too soon')
    if (tok.type === 'num') { pos++; return { kind: 'num', value: tok.value } }
    if (tok.type === 'str') { pos++; return { kind: 'str', value: tok.value } }
    if (tok.type === 'column') { pos++; return { kind: 'col', name: tok.value } }
    if (tok.type === 'name') {
      pos++
      if (isOp('(')) {
        pos++
        const args = []
        if (!isOp(')')) {
          args.push(or())
          while (isOp(',')) { pos++; args.push(or()) }
        }
        expect(')')
        return { kind: 'call', name: tok.value, args }
      }
      return { kind: 'name', name: tok.value }
    }
    if (isOp('(')) {
      pos++
      const inner = or()
      expect(')')
      return inner
    }
    throw new ExprError(`Unexpected ${describe(tok)}`)
  }

  const tree = or()
  if (pos < tokens.length) throw new ExprError(`Unexpected ${describe(tokens[pos])}`)
  return tree
}

function describe(tok) {
  if (tok.type === 'str') return `"${tok.value}"`
  return `"${tok.value}"`
}

const columnOf = (columns, name) => (Object.hasOwn(columns, name) ? columns[name] : undefined)
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const clean = v => (typeof v === 'number' && !Number.isFinite(v) ? null : v)

// A function of the row number, for a tree over `columns` (name -> values)
function build(node, columns) {
  switch (node.kind) {
    case 'num': return () => node.value
    case 'str': return () => node.value
    case 'col': {
      const values = columnOf(columns, node.name)
      if (!values) throw new ExprError(`There’s no column "${node.name}"`)
      return i => values[i]
    }
    case 'name': {
      const values = columnOf(columns, node.name)
      if (values) return i => values[i]
      const lower = node.name.toLowerCase()
      if (lower === 'true' || lower === 'false') return () => lower === 'true'
      if (lower === 'null') return () => null
      if (Object.hasOwn(CONSTANTS, lower)) return () => CONSTANTS[lower]
      throw new ExprError(`There’s no column "${node.name}"`)
    }
    case 'neg': {
      const arg = build(node.arg, columns)
      return i => { const v = num(arg(i)); return v === null ? null : -v }
    }
    case 'not': {
      const arg = build(node.arg, columns)
      return i => !truthy(arg(i))
    }
    case 'and': {
      const l = build(node.left, columns), r = build(node.right, columns)
      return i => truthy(l(i)) && truthy(r(i))
    }
    case 'or': {
      const l = build(node.left, columns), r = build(node.right, columns)
      return i => truthy(l(i)) || truthy(r(i))
    }
    case 'cmp': {
      const l = build(node.left, columns), r = build(node.right, columns)
      const test = {
        '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
        '==': (a, b) => a === b, '!=': (a, b) => a !== b,
      }[node.op]
      // A missing value equals nothing and orders with nothing
      return i => {
        const a = l(i), b = r(i)
        if (a == null || b == null) return node.op === '!=' ? (a == null) !== (b == null) : node.op === '==' && a == null && b == null
        return test(a, b)
      }
    }
    case 'bin': {
      const l = build(node.left, columns), r = build(node.right, columns)
      if (node.op === '+') {
        return i => {
          const a = l(i), b = r(i)
          if (a == null || b == null) return null
          if (typeof a === 'string' || typeof b === 'string') return `${a}${b}`
          return clean(num(a) === null || num(b) === null ? null : a + b)
        }
      }
      const f = { '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b, '%': (a, b) => a % b, '^': (a, b) => a ** b }[node.op]
      return i => { const a = num(l(i)), b = num(r(i)); return a === null || b === null ? null : clean(f(a, b)) }
    }
    case 'call': return buildCall(node, columns)
  }
  throw new ExprError('That expression can’t be read')
}

function truthy(v) {
  return v !== null && v !== undefined && v !== false && v !== 0 && v !== ''
}

function buildCall(node, columns) {
  const name = node.name.toLowerCase()
  const args = node.args.map(a => build(a, columns))
  const arity = n => {
    if (node.args.length !== n) throw new ExprError(`${name}() takes ${n} value${n === 1 ? '' : 's'}`)
  }
  if (name === 'if') {
    arity(3)
    const [c, a, b] = args
    return i => (truthy(c(i)) ? a(i) : b(i))
  }
  if (name === 'isnull') { arity(1); return i => args[0](i) == null }
  if (name === 'coalesce') {
    if (!args.length) throw new ExprError('coalesce() takes at least one value')
    return i => { for (const a of args) { const v = a(i); if (v != null) return v } return null }
  }
  if (!Object.hasOwn(FUNCS, name)) throw new ExprError(`There’s no function ${node.name}()`)
  const [lo, hi] = ARITY[name] || [1, 1]
  if (node.args.length < lo || node.args.length > hi) {
    throw new ExprError(lo === hi ? `${name}() takes ${lo} value${lo === 1 ? '' : 's'}` : `${name}() takes ${lo} to ${hi} values`)
  }
  const f = FUNCS[name]
  return i => {
    const vals = args.map(a => num(a(i)))
    return vals.includes(null) ? null : clean(f(...vals))
  }
}

// Compiles `expr` over a table's columns: a function of the row number, or
// an ExprError saying what's wrong with it
function compile(expr, columns) {
  if (typeof expr !== 'string' || !expr.trim()) throw new ExprError('Write an expression')
  if (expr.length > MAX_LENGTH) throw new ExprError(`Keep an expression under ${MAX_LENGTH} characters`)
  return build(parse(tokenize(expr)), columns)
}

module.exports = { compile, ExprError, FUNCS, CONSTANTS }

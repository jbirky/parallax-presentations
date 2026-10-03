// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Set expressions for Venn diagram elements (vennDiagram.js): reading them
// (TeX, Unicode, keyboard characters or words), the regions they shade,
// writing them out again, the simplest expression for a group of regions,
// and the numbers in the regions, worked out from facts like |A ∩ B| = 7 or
// listed as members.
//
// A region of n sets is a number m < 2^n whose bit i says it's inside set i;
// a group of regions is a mask with bit m set for each, so four sets fit in
// 16 bits and the set operations are bitwise ones.

const OVERLINE = String.fromCharCode(0x305)
export const MAX_MEMBERS = 200

// ---------- Regions as bits. A region is a number m < 2^n whose bit i says
// it's inside set i; a group of regions is a mask with bit m set for each.
export const popcount = m => { let c = 0; while (m) { c += m & 1; m >>>= 1 } return c }
export const fullMask = n => (1 << (1 << n)) - 1
export const has = (mask, m) => ((mask >>> m) & 1) === 1
export function setMask(i, n) {
  let r = 0
  for (let m = 0; m < (1 << n); m++) if ((m >> i) & 1) r |= 1 << m
  return r
}
export function regionsOf(mask, n) {
  const out = []
  for (let m = 0; m < (1 << n); m++) if (has(mask, m)) out.push(m)
  return out
}

// ---------- Reading an expression
const WORDS = {
  or: 'or', union: 'or', cup: 'or',
  and: 'and', intersect: 'and', intersection: 'and', cap: 'and',
  minus: 'diff', without: 'diff', setminus: 'diff', except: 'diff',
  xor: 'xor', symdiff: 'xor',
  not: 'not', complement: 'not',
  empty: 'empty', emptyset: 'empty',
}
const CMDS = {
  cup: 'or', lor: 'or', vee: 'or', bigcup: 'or',
  cap: 'and', land: 'and', wedge: 'and', bigcap: 'and', cdot: 'and',
  setminus: 'diff', smallsetminus: 'diff', backslash: 'diff',
  triangle: 'xor', vartriangle: 'xor', bigtriangleup: 'xor', triangleup: 'xor', Delta: 'xor', ominus: 'xor', oplus: 'xor', veebar: 'xor',
  neg: 'not', lnot: 'not', complement: 'not',
  overline: 'bar', bar: 'bar', widebar: 'bar', overbar: 'bar',
  emptyset: 'empty', varnothing: 'empty',
  prime: 'comp',
}
const SKIP = new Set(['left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr', 'biggl', 'biggr', 'Biggl', 'Biggr', 'middle', ',', ';', ':', '!', 'quad', 'qquad', 'displaystyle', 'textstyle'])
const WRAP = new Set(['mathrm', 'text', 'textrm', 'mathsf', 'mathit', 'mathbf', 'textit', 'operatorname', 'mathnormal', 'mathbin'])
const REL_CMDS = { neq: '≠', ne: '≠', subseteq: '⊆', subset: '⊆', supseteq: '⊇', supset: '⊇', equiv: '=', subsetneq: '⊂', supsetneq: '⊃' }
const REL_CHARS = { '=': '=', '≡': '=', '≠': '≠', '⊆': '⊆', '⊂': '⊆', '⊇': '⊇', '⊃': '⊇', '⊊': '⊂', '⊋': '⊃' }
const CHAR_OPS = {
  '∪': 'or', '|': 'or', '+': 'or', '∨': 'or',
  '∩': 'and', '&': 'and', '∧': 'and', '·': 'and', '⋅': 'and', '*': 'and',
  '∖': 'diff', '-': 'diff', '−': 'diff',
  'Δ': 'xor', '△': 'xor', '∆': 'xor', '⊕': 'xor', '⊖': 'xor', '⊻': 'xor',
  '¬': 'not', '~': 'not', '!': 'not',
  '∅': 'empty', '⌀': 'empty', 'Ø': 'empty',
  "'": 'comp', '′': 'comp', 'ᶜ': 'comp',
  '(': 'lp', '[': 'lp', '{': 'lp', ')': 'rp', ']': 'rp', '}': 'rp',
}
// The universe goes by many names: U, Ω or S in probability, and ξ or ℰ in British schools
const UNIVERSE_CHARS = ['Ω', 'ξ', 'ℰ', '𝒰', 'ε']
const UNIVERSE_CMDS = { Omega: 1, xi: 1, varepsilon: 1 }
const UNIVERSE_TEXT = { '\\Omega': 'Ω', '\\xi': 'ξ', '\\mathcal{E}': 'ℰ', '\\mathcal{U}': '𝒰', '\\varepsilon': 'ε' }
const OP_TEXT = { or: '∪', and: '∩', diff: '∖', xor: 'Δ', not: '′', comp: '′', lp: '(', rp: ')' }

function fail(msg, at, len) { const e = new Error(msg); e.at = at; e.len = len || 1; e.venn = true; throw e }
export const listNames = ids => ids.length === 1 ? ids[0] : ids.slice(0, -1).join(', ') + ' and ' + ids[ids.length - 1]

// ctx: { ids: ['A', 'B', 'C'], universe: 'U' }
export function tokenize(src, ctx) {
  const toks = []
  const ids = ctx.ids
  const uni = String(ctx.universe || 'U')
  const uniLetter = /^[A-Za-z]$/.test(uni) && !ids.includes(uni) ? uni : null
  const push = (k, at, len, v) => toks.push({ k, at, len, v })
  function letter(c, at) {
    if (ids.includes(c)) return push('set', at, 1, ids.indexOf(c))
    if (c === uniLetter || (c === 'U' && !ids.includes('U'))) return push('U', at, 1)
    const up = c.toUpperCase(), lo = c.toLowerCase()
    const alt = c === up ? lo : up
    if (ids.includes(alt) && !ids.includes(c)) return push('set', at, 1, ids.indexOf(alt))
    fail(`There's no set ${c}. The sets here are ${listNames(ids)}.`, at, 1)
  }
  function readGroup(i) {
    // src[i] is '{': returns [inner, index after the closing brace]
    let depth = 0
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') { depth--; if (depth === 0) return [src.slice(i + 1, j), j + 1] }
    }
    fail('A { here is never closed.', i, 1)
  }
  const skipBraces = new Set()
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) { i++; continue }
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i))
      if (!m) { push('diff', i, 1); i++; continue }
      const name = m[1], at = i
      i += m[0].length
      if (name === ' ' || name === '\\') { push('diff', at, 1); continue }
      if (SKIP.has(name)) { if ((name === 'left' || name === 'right') && src[i] === '.') i++; continue }
      if (name === '{') {
        if (src.startsWith('\\}', i)) { push('empty', at, i + 2 - at); i += 2; continue }
        fail('Lists of members go in the panel’s Elements box, not in the expression.', at, 2)
      }
      // \text{…}, \mathbin{…}: what's inside is read as if it had no braces
      if (WRAP.has(name)) {
        while (src[i] === ' ') i++
        if (src[i] === '{') { const close = readGroup(i)[1] - 1; skipBraces.add(close); i++ }
        continue
      }
      if (name === 'mathcal' || name === 'mathscr' || name === 'mathbb') {
        while (src[i] === ' ') i++
        let inner, next
        if (src[i] === '{') [inner, next] = readGroup(i)
        else { inner = src[i] || ''; next = i + 1 }
        i = next
        if (/^\s*[UE]\s*$/.test(inner)) { push('U', at, i - at); continue }
        fail(`\\${name}{${inner}} isn't a set here.`, at, i - at)
      }
      if (UNIVERSE_CMDS[name]) { push('U', at, i - at); continue }
      if (REL_CMDS[name]) { push('rel', at, i - at, REL_CMDS[name]); continue }
      if (CMDS[name]) {
        const k = CMDS[name]
        if (k === 'not' && name === 'complement' && toks.length && endsAtom(toks[toks.length - 1])) { push('comp', at, i - at); continue }
        push(k, at, i - at)
        continue
      }
      // A\B, typed for "A minus B"
      if (/^[A-Za-z]$/.test(name) && ids.includes(name)) { push('diff', at, 1); push('set', at + 1, 1, ids.indexOf(name)); continue }
      fail(`\\${name} isn't something a set expression can use.`, at, i - at)
    }
    if (c === '^') {
      const at = i
      i++
      while (src[i] === ' ') i++
      let inner
      if (src[i] === '{') { const g = readGroup(i); inner = g[0]; i = g[1] }
      else if (src[i] === '\\') { const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i)); inner = m[0]; i += m[0].length }
      else { inner = src[i] || ''; i++ }
      const norm = inner.replace(/\\(mathrm|mathsf|text|textrm|mathit)\s*/g, '').replace(/[{}\s]/g, '')
      if (['c', 'C', '\\complement', '∁', '\\prime', "'", '′', '\\mathcal{C}', '\\mathcalC'].includes(norm)) { push('comp', at, i - at); continue }
      fail('A superscript can only be c here, for the complement: A^c.', at, i - at)
    }
    if (c === '∁') { push(toks.length && endsAtom(toks[toks.length - 1]) ? 'comp' : 'not', i, 1); i++; continue }
    if (c === '!' && src[i + 1] === '=') { push('rel', i, 2, '≠'); i += 2; continue }
    if (REL_CHARS[c]) { push('rel', i, 1, REL_CHARS[c]); i++; continue }
    const u = UNIVERSE_CHARS.find(s => src.startsWith(s, i))
    if (u) { push('U', i, u.length); i += u.length; continue }
    if (c === '}' && skipBraces.has(i)) { i++; continue }
    if (CHAR_OPS[c]) { push(CHAR_OPS[c], i, 1); i++; continue }
    if (/[A-Za-z]/.test(c)) {
      const m = /^[A-Za-z]+/.exec(src.slice(i))
      const run = m[0], at = i
      i += run.length
      if (src[i] === '_') fail('Sets are named by one letter, without subscripts. Their labels on the diagram can be anything.', i, 1)
      const w = WORDS[run.toLowerCase()]
      if (w && run.length > 1) { push(w, at, run.length); continue }
      if (run.length > 3 && !run.split('').every(ch => ids.includes(ch) || ids.includes(ch.toUpperCase()))) {
        fail(`“${run}” isn't an operation or a set. Sets are named by one letter.`, at, run.length)
      }
      for (let k = 0; k < run.length; k++) letter(run[k], at + k)
      continue
    }
    if (/[0-9]/.test(c)) fail('Numbers go in the panel’s Facts box. Expressions are made of sets.', i, 1)
    fail(`“${c}” doesn't mean anything in a set expression.`, i, 1)
  }
  push('end', src.length, 0)
  return toks
}
const endsAtom = t => t.k === 'set' || t.k === 'U' || t.k === 'empty' || t.k === 'rp' || t.k === 'comp'
const startsAtom = t => t.k === 'set' || t.k === 'U' || t.k === 'empty' || t.k === 'lp' || t.k === 'not' || t.k === 'bar'
const LEVEL1 = { or: 1, diff: 1, xor: 1 }

export function parse(src, ctx) {
  src = String(src == null ? '' : src)
  const toks = tokenize(src, ctx)
  let p = 0
  const flags = { andInOr: false, mixed: false, implicit: false }
  const peek = () => toks[p]
  const next = () => toks[p++]
  const what = t => t.k === 'end' ? 'the end' : `“${src.slice(t.at, t.at + t.len)}”`
  function expectAtom(after) {
    const t = peek()
    if (t.k === 'end') fail(after ? `Something's missing after ${after}.` : 'Type an expression, such as A ∩ (B ∪ C).', src.length, 0)
    fail(`Expected a set before ${what(t)}.`, t.at, t.len)
  }
  function parseRel() {
    const a = parseExpr()
    const t = peek()
    if (t.k === 'rel') {
      next()
      const b = parseExpr()
      if (peek().k === 'rel') fail('One relation at a time: compare two sides.', peek().at, peek().len)
      if (peek().k !== 'end') fail(`Unexpected ${what(peek())}.`, peek().at, peek().len)
      return { t: 'rel', op: t.v, a, b }
    }
    if (t.k === 'rp') fail('This bracket closes one that was never opened.', t.at, t.len)
    if (t.k !== 'end') fail(`Unexpected ${what(t)}.`, t.at, t.len)
    return a
  }
  function parseExpr() {
    let left = parseTerm()
    let lastOp = null, grouped = left.paren
    while (LEVEL1[peek().k]) {
      const op = next().k
      if (lastOp && lastOp !== op) flags.mixed = true
      if (lastOp === 'diff' && op === 'diff') flags.mixed = true
      const right = parseTerm(OP_TEXT[op])
      if (left.t === 'and' && !left.paren) flags.andInOr = true
      if (right.t === 'and' && !right.paren) flags.andInOr = true
      left = { t: op, a: left, b: right }
      lastOp = op
    }
    void grouped
    return left
  }
  function parseTerm(after) {
    let left = parseFactor(after)
    for (;;) {
      const t = peek()
      if (t.k === 'and') { next(); left = { t: 'and', a: left, b: parseFactor('∩') }; continue }
      if (startsAtom(t)) { flags.implicit = true; left = { t: 'and', a: left, b: parseFactor() }; continue }
      return left
    }
  }
  function parseFactor(after) {
    if (peek().k === 'not') { const t = next(); return { t: 'not', a: parseFactor(src.slice(t.at, t.at + t.len)) } }
    let a = parseAtom(after)
    while (peek().k === 'comp') { next(); a = { t: 'not', a } }
    return a
  }
  function parseAtom(after) {
    const t = peek()
    if (t.k === 'set') { next(); return { t: 'set', i: t.v } }
    if (t.k === 'U') { next(); return { t: 'U' } }
    if (t.k === 'empty') { next(); return { t: 'empty' } }
    if (t.k === 'lp') {
      next()
      if (peek().k === 'rp') fail('There’s nothing inside these brackets.', t.at, peek().at - t.at + 1)
      const e = parseExpr()
      if (peek().k !== 'rp') {
        if (peek().k === 'end') fail('This bracket is never closed.', t.at, t.len)
        fail(`Unexpected ${what(peek())}.`, peek().at, peek().len)
      }
      next()
      return Object.assign({}, e, { paren: true })
    }
    if (t.k === 'bar') {
      next()
      return { t: 'not', a: parseAtom('a bar') }
    }
    expectAtom(after)
  }
  const ast = parseRel()
  const notes = []
  if (flags.andInOr) notes.push('∩ is read before ∪, ∖ and Δ, the way × comes before +.')
  if (flags.mixed) notes.push('∪, ∖ and Δ are read from left to right. Brackets make it certain.')
  return { ast, notes, readAs: flags.andInOr || flags.mixed, implicit: flags.implicit }
}

// The regions an expression shades
export function evaluate(node, n) {
  switch (node.t) {
    case 'set': return setMask(node.i, n)
    case 'U': return fullMask(n)
    case 'empty': return 0
    case 'not': return fullMask(n) & ~evaluate(node.a, n)
    case 'and': return evaluate(node.a, n) & evaluate(node.b, n)
    case 'or': return evaluate(node.a, n) | evaluate(node.b, n)
    case 'diff': return evaluate(node.a, n) & ~evaluate(node.b, n)
    case 'xor': return evaluate(node.a, n) ^ evaluate(node.b, n)
  }
  throw new Error('Unknown node ' + node.t)
}

// ---------- Writing one out. style: { out: 'tex' | 'text' | 'html', comp: 'prime' | 'c' | 'bar', ids, universe }
const prec = node => LEVEL1[node.t] ? 1 : node.t === 'and' ? 2 : node.t === 'not' ? 3 : 4
function needsParens(child, parent, side) {
  const pc = prec(child)
  if (pc >= 3) return false
  if (LEVEL1[parent.t]) {
    if (pc === 2) return true
    return !(side === 'a' && child.t === parent.t && (parent.t === 'or' || parent.t === 'xor'))
  }
  if (parent.t === 'and') return pc === 1 || side === 'b'
  return false
}
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export function universeText(u) { return UNIVERSE_TEXT[u] || String(u).replace(/[\\{}]/g, '') }
export function format(node, style) {
  const out = style.out || 'text', comp = style.comp || 'prime', ids = style.ids
  const S = out === 'tex'
    ? { or: ' \\cup ', and: ' \\cap ', diff: ' \\setminus ', xor: ' \\mathbin{\\triangle} ', empty: '\\varnothing', U: style.universe || 'U', lp: '(', rp: ')' }
    : { or: ' ∪ ', and: ' ∩ ', diff: ' ∖ ', xor: ' Δ ', empty: '∅', U: universeText(style.universe || 'U'), lp: '(', rp: ')' }
  if (out === 'html') S.U = `<i>${escHtml(S.U)}</i>`
  if (out === 'tex' && style.xor === 'plain') S.xor = ' \\triangle '
  const set = i => out === 'html' ? `<i>${escHtml(ids[i])}</i>` : ids[i]
  function f(nd) {
    switch (nd.t) {
      case 'set': return set(nd.i)
      case 'U': return S.U
      case 'empty': return S.empty
      case 'not': {
        const a = nd.a, inner = f(a), atom = prec(a) >= 3
        if (comp === 'bar') {
          if (out === 'tex') return `\\overline{${inner}}`
          if (out === 'html') return `<span class="ov">${inner}</span>`
          if (a.t === 'set') return ids[a.i] + OVERLINE
        }
        const body = atom ? inner : S.lp + inner + S.rp
        if (comp === 'c' || (comp === 'bar' && out === 'text')) return out === 'tex' ? `${a.t === 'not' ? `{${body}}` : body}^{c}` : out === 'html' ? `${body}<sup>c</sup>` : body + 'ᶜ'
        return out === 'tex' ? body + "'" : body + '′'
      }
      default: {
        const l = needsParens(nd.a, nd, 'a') ? S.lp + f(nd.a) + S.rp : f(nd.a)
        const r = needsParens(nd.b, nd, 'b') ? S.lp + f(nd.b) + S.rp : f(nd.b)
        return l + S[nd.t] + r
      }
    }
  }
  if (node.t === 'rel') {
    const R = out === 'tex' ? { '=': ' = ', '≠': ' \\neq ', '⊆': ' \\subseteq ', '⊇': ' \\supseteq ', '⊂': ' \\subsetneq ', '⊃': ' \\supsetneq ' } : { '=': ' = ', '≠': ' ≠ ', '⊆': ' ⊆ ', '⊇': ' ⊇ ', '⊂': ' ⊊ ', '⊃': ' ⊋ ' }
    return f(node.a) + R[node.op] + f(node.b)
  }
  return f(node)
}
// How hard a written form is to read: symbols, plus a little for each pair of brackets
export function cost(node) {
  let c = 0
  ;(function walk(nd, parent, side) {
    c += 1
    if (parent && parent.t !== 'not' && needsParens(nd, parent, side)) c += 0.35
    if (parent && parent.t === 'not' && prec(nd) < 3) c += 0.35
    // A complement inside a difference reads badly: B′ ∖ A rather than (A ∪ B)′
    if (parent && parent.t === 'diff' && nd.t === 'not') c += 1.2
    if (parent && parent.t === 'not' && nd.t === 'not') c += 1
    if (nd.a) walk(nd.a, nd, 'a')
    if (nd.b) walk(nd.b, nd, 'b')
  })(node, null, null)
  return c
}

// ---------- The simplest way to name a group of regions
const S_ = i => ({ t: 'set', i })
const chain = (t, items) => items.reduce((acc, x) => acc ? { t, a: acc, b: x } : x, null)
function primeImplicants(mins) {
  let cur = mins.map(m => ({ v: m, d: 0 }))
  const primes = []
  while (cur.length) {
    const next = new Map(), used = new Set()
    for (let a = 0; a < cur.length; a++) {
      for (let b = a + 1; b < cur.length; b++) {
        const A = cur[a], B = cur[b]
        if (A.d !== B.d) continue
        const diff = A.v ^ B.v
        if (popcount(diff) !== 1) continue
        const imp = { v: A.v & ~diff, d: A.d | diff }
        next.set(imp.v + ':' + imp.d, imp)
        used.add(a); used.add(b)
      }
    }
    cur.forEach((imp, k) => { if (!used.has(k)) primes.push(imp) })
    cur = [...next.values()]
  }
  return primes
}
const covers = (imp, m) => (m & ~imp.d) === imp.v
function minimalCover(mins, primes, n) {
  const lits = imp => n - popcount(imp.d)
  const chosen = new Set()
  for (const m of mins) {
    const c = primes.filter(p => covers(p, m))
    if (c.length === 1) chosen.add(c[0])
  }
  const left = mins.filter(m => ![...chosen].some(p => covers(p, m)))
  if (!left.length) return [...chosen]
  const cands = primes.filter(p => !chosen.has(p) && left.some(m => covers(p, m)))
  let best = null, bestCost = Infinity
  const k = cands.length
  for (let size = 1; size <= k && !best; size++) {
    const idx = []
    ;(function pick(start) {
      if (idx.length === size) {
        if (left.every(m => idx.some(j => covers(cands[j], m)))) {
          const c = idx.reduce((s, j) => s + lits(cands[j]), 0)
          if (c < bestCost) { bestCost = c; best = idx.map(j => cands[j]) }
        }
        return
      }
      for (let j = start; j < k; j++) { idx.push(j); pick(j + 1); idx.pop() }
    })(0)
  }
  return [...chosen, ...(best || [])]
}
function termAst(imp, n) {
  const P = [], N = []
  for (let i = 0; i < n; i++) {
    if ((imp.d >> i) & 1) continue
    if ((imp.v >> i) & 1) P.push(S_(i)); else N.push(S_(i))
  }
  if (!P.length && !N.length) return { t: 'U' }
  if (!P.length) return { t: 'not', a: chain('or', N) }
  const pos = chain('and', P)
  return N.length ? { t: 'diff', a: pos, b: chain('or', N) } : pos
}
// Each region m of a function over n sets, as a bit string of length 2^n
function sop(f, n) {
  const mins = regionsOf(f, n)
  const cover = minimalCover(mins, primeImplicants(mins), n)
  // Terms in the order of their first set, and shorter ones first: A ∪ (B ∩ C)
  const first = imp => { for (let i = 0; i < n; i++) if (!((imp.d >> i) & 1) && ((imp.v >> i) & 1)) return i; return n }
  cover.sort((a, b) => first(a) - first(b) || popcount(b.d) - popcount(a.d) || a.v - b.v)
  return chain('or', cover.map(imp => termAst(imp, n)))
}
// The fewest overlapping terms that cover a group of regions, for TikZ's clips
export function cover(f, n) {
  f &= fullMask(n)
  if (!f) return []
  const mins = regionsOf(f, n)
  return minimalCover(mins, primeImplicants(mins), n)
}
function cofactor(f, n, i, b) {
  let g = 0
  for (let m = 0; m < (1 << n); m++) {
    const src = b ? (m | (1 << i)) : (m & ~(1 << i))
    if (has(f, src)) g |= 1 << m
  }
  return g
}
function parityMask(S, n) {
  let r = 0
  for (let m = 0; m < (1 << n); m++) if (popcount(m & S) & 1) r |= 1 << m
  return r
}
export function simplest(f, n, depth = 0) {
  const all = fullMask(n)
  f &= all
  if (f === 0) return { t: 'empty' }
  if (f === all) return { t: 'U' }
  const cands = [sop(f, n)]
  for (let S = 3; S < (1 << n); S++) {
    if (popcount(S) < 2) continue
    const ids = []
    for (let i = 0; i < n; i++) if ((S >> i) & 1) ids.push(S_(i))
    const p = parityMask(S, n)
    if (p === f) cands.push(chain('xor', ids))
    if ((all & ~p) === f) cands.push({ t: 'not', a: chain('xor', ids) })
  }
  if (depth < 2) {
    cands.push({ t: 'not', a: depth === 0 ? simplest(all & ~f, n, 2) : sop(all & ~f, n) })
    for (let i = 0; i < n; i++) {
      const f1 = cofactor(f, n, i, 1), f0 = cofactor(f, n, i, 0)
      if (f0 === 0 && f1 !== all) cands.push({ t: 'and', a: S_(i), b: simplest(f1, n, depth + 1) })
      if (f1 === 0 && f0 !== all) cands.push({ t: 'diff', a: simplest(f0, n, depth + 1), b: S_(i) })
      if (f1 === all && f0 !== 0) cands.push({ t: 'or', a: S_(i), b: simplest(f0, n, depth + 1) })
    }
  }
  let best = null, bc = Infinity
  for (const c of cands) {
    if (evaluate(c, n) !== f) continue
    const k = cost(c)
    if (k < bc - 1e-9) { bc = k; best = c }
  }
  return best
}

// ---------- Naming single regions
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI']
// Three sets follow the order most textbooks number them in (I is A only,
// V the middle, VIII outside); four have no standard, so they go by how many
// sets a region is in
export const REGION_ORDER = {
  1: [1, 0],
  2: [1, 3, 2, 0],
  3: [1, 3, 2, 5, 7, 6, 4, 0],
  4: [1, 2, 4, 8, 3, 5, 9, 6, 10, 12, 7, 11, 13, 14, 15, 0],
}
export const regionNumber = (m, n) => ROMAN[REGION_ORDER[n].indexOf(m)]
export function regionAst(m, n) {
  const lits = []
  for (let i = 0; i < n; i++) lits.push((m >> i) & 1 ? S_(i) : { t: 'not', a: S_(i) })
  return chain('and', lits)
}
export function regionPhrase(m, n, names) {
  const inside = names.filter((_, i) => (m >> i) & 1)
  if (n === 1) return m ? `in ${names[0]}` : `outside ${names[0]}`
  if (!inside.length) return 'in none of them'
  if (inside.length === n) return n === 2 ? 'in both' : n === 3 ? 'in all three' : 'in all four'
  return listNames(inside) + ' only'
}

// ---------- Numbers in the regions: counts or probabilities from facts
export function parseNumber(s) {
  s = String(s).trim().replace(/\s+/g, '')
  let m = /^\\[dt]?frac\{(-?[\d.]+)\}\{([\d.]+)\}$/.exec(s)
  if (m) return +m[1] / +m[2]
  m = /^(-?[\d.]+)\/([\d.]+)$/.exec(s)
  if (m) return +m[1] / +m[2]
  m = /^(-?[\d.]+)(\\?%)$/.exec(s)
  if (m) return +m[1] / 100
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return +s
  return null
}
function splitGiven(s) {
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (depth === 0 && c === '|') return [s.slice(0, i), s.slice(i + 1)]
    else if (depth === 0 && s.startsWith('\\mid', i)) return [s.slice(0, i), s.slice(i + 4)]
  }
  return [s, null]
}
// One line of facts: |A ∩ B| = 7, n(A) = 22, P(A) = 0.3, P(A | B) = 1/4
export function parseFact(line, ctx, n) {
  const raw = line
  line = line.replace(/\\left|\\right|\\big|\\Big/g, '').trim()
  if (!line || line.startsWith('%') || line.startsWith('//')) return null
  const eq = line.lastIndexOf('=')
  if (eq < 0) fail('A fact needs an equals sign: |A| = 12.', 0, raw.length)
  const lhs = line.slice(0, eq).trim(), rhs = parseNumber(line.slice(eq + 1))
  if (rhs == null) fail('The right side should be a number, such as 12, 0.35, 35% or 1/3.', eq + 1, raw.length - eq - 1)
  let m, kind = 'n'
  let inner = null
  if ((m = /^\|(.*)\|$/.exec(lhs))) inner = m[1]
  else if ((m = /^(?:n|N|#)\s*\((.*)\)$/.exec(lhs))) inner = m[1]
  else if ((m = /^#\s*(.+)$/.exec(lhs))) inner = m[1]
  else if ((m = /^(?:P|Pr|\\Pr|\\mathbb\{P\}|ℙ)\s*[([](.*)[)\]]$/.exec(lhs))) { inner = m[1]; kind = 'P' }
  else fail('Write a fact as |A ∩ B| = 7, n(A) = 22 or P(A) = 0.3.', 0, eq)
  const [a, b] = kind === 'P' ? splitGiven(inner) : [inner, null]
  const pa = parse(a, ctx)
  if (pa.ast.t === 'rel') fail('A fact measures one set, not a relation.', 0, eq)
  const out = { kind, a: evaluate(pa.ast, n), rhs }
  if (b != null) {
    const pb = parse(b, ctx)
    if (pb.ast.t === 'rel') fail('A fact measures one set, not a relation.', 0, eq)
    out.b = evaluate(pb.ast, n)
  }
  return out
}
// mode: 'counts' or 'probability'. Each region's value, null where the
// facts don't settle it, and the total of the shaded regions if they do.
export function solveFacts(text, ctx, n, mode, shaded) {
  const R = 1 << n
  const rows = [], notes = [], errors = []
  const lines = String(text || '').split('\n')
  let anyP = false, anyN = false
  lines.forEach((line, k) => {
    try {
      const f = parseFact(line, ctx, n)
      if (!f) return
      if (f.kind === 'P') anyP = true; else anyN = true
      const coef = new Array(R).fill(0)
      if (f.b != null) {
        // P(A | B) = c  →  P(A ∩ B) − c P(B) = 0
        for (let m = 0; m < R; m++) coef[m] = (has(f.a & f.b, m) ? 1 : 0) - (has(f.b, m) ? f.rhs : 0)
        rows.push({ coef, rhs: 0, line: k })
      } else {
        for (let m = 0; m < R; m++) coef[m] = has(f.a, m) ? 1 : 0
        rows.push({ coef, rhs: f.rhs, line: k })
      }
    } catch (e) {
      if (!e.venn) throw e
      errors.push({ line: k, msg: e.message })
    }
  })
  if (mode === 'probability') rows.unshift({ coef: new Array(R).fill(1), rhs: 1, line: -1 })
  if (mode === 'counts' && anyP && !anyN) notes.push('These facts are probabilities. Switch to Probability to count them out of 1.')
  // Row by row into reduced row echelon form, so a fact that contradicts
  // those above it can be named
  const basis = [] // { coef, rhs, pivot }
  const eps = 1e-9
  const contradictions = [], redundant = []
  for (const row of rows) {
    const c = row.coef.slice()
    let r = row.rhs
    for (const b of basis) {
      const k = c[b.pivot]
      if (Math.abs(k) > eps) { for (let j = 0; j < R; j++) c[j] -= k * b.coef[j]; r -= k * b.rhs }
    }
    let piv = -1, big = 0
    for (let j = 0; j < R; j++) if (Math.abs(c[j]) > big + eps) { big = Math.abs(c[j]); piv = j }
    if (piv < 0 || big < 1e-7) {
      if (Math.abs(r) > 1e-6) contradictions.push(row.line)
      else if (row.line >= 0) redundant.push(row.line)
      continue
    }
    const k = c[piv]
    for (let j = 0; j < R; j++) c[j] /= k
    r /= k
    for (const b of basis) {
      const kk = b.coef[piv]
      if (Math.abs(kk) > eps) { for (let j = 0; j < R; j++) b.coef[j] -= kk * c[j]; b.rhs -= kk * r }
    }
    basis.push({ coef: c, rhs: r, pivot: piv })
  }
  const pivotOf = new Map(basis.map(b => [b.pivot, b]))
  const free = []
  for (let j = 0; j < R; j++) if (!pivotOf.has(j)) free.push(j)
  const value = new Array(R).fill(null)
  for (let m = 0; m < R; m++) {
    const b = pivotOf.get(m)
    if (b && free.every(f => Math.abs(b.coef[f]) < 1e-7)) value[m] = Math.abs(b.rhs) < 1e-12 ? 0 : b.rhs
  }
  // The total over a group of regions is settled when the free regions cancel out of it
  function total(mask) {
    let c = 0
    for (const f of free) {
      let k = has(mask, f) ? 1 : 0
      for (const b of basis) if (has(mask, b.pivot)) k -= b.coef[f]
      if (Math.abs(k) > 1e-7) return null
    }
    for (const b of basis) if (has(mask, b.pivot)) c += b.rhs
    return Math.abs(c) < 1e-12 ? 0 : c
  }
  const unknown = value.filter(v => v == null).length
  return { value, total, shadedTotal: shaded == null ? null : total(shaded), errors, contradictions, redundant, notes, unknown, facts: rows.filter(r => r.line >= 0).length }
}

// Members listed per set: each lands in the region it belongs to
export function placeMembers(members, ids) {
  const n = ids.length
  // Members separated by commas; a range like 1..12 stands for each number in it
  const parse = s => {
    const out = []
    for (const part of String(s || '').split(',')) {
      const t = part.trim()
      if (!t || out.length >= MAX_MEMBERS) continue
      const r = /^(-?\d+)\s*\.\.\s*(-?\d+)$/.exec(t)
      if (r) {
        const a = +r[1], b = +r[2], d = a <= b ? 1 : -1
        for (let v = a; d > 0 ? v <= b : v >= b; v += d) { if (out.length >= MAX_MEMBERS) break; if (!out.includes(String(v))) out.push(String(v)) }
        continue
      }
      if (!out.includes(t)) out.push(t.slice(0, 40))
    }
    return out
  }
  const lists = ids.map(id => parse(members[id]))
  const uniGiven = parse(members.U)
  const order = uniGiven.length ? uniGiven.slice() : []
  const notes = []
  lists.forEach((list, i) => list.forEach(x => {
    if (!order.includes(x)) {
      if (uniGiven.length) notes.push(`${x} is in ${ids[i]} but not in the universe.`)
      order.push(x)
    }
  }))
  const region = new Array(1 << n).fill(null).map(() => [])
  const where = new Map()
  for (const x of order) {
    let m = 0
    lists.forEach((list, i) => { if (list.includes(x)) m |= 1 << i })
    region[m].push(x)
    where.set(x, m)
  }
  return { region, order, where, notes, universeGiven: uniGiven.length > 0 }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// An equation element with interactive terms: LaTeX in which parts are
// wrapped as \term{id}{…}, each term with a color, a label and a note.
// Presented, the terms are colored one step at a time (or while the pointer is
// over one), and labeled by a callout, a brace, or a sentence under the
// equation whose phrases share the terms' colors.
//
//   el.latex       = '\term{t1}{p(\theta \mid D)} = \frac{\term{t2}{…}}{…}'
//   el.terms       = [{ id, label, note, color }], in the order they're stepped through
//   el.labelStyle  = 'callout' (the default) | 'brace' | 'sentence'
//   el.sentence    = 'What you believe [after the data](t1) is …': phrases linked to terms
//   el.interaction = 'steps' (the default) | 'hover' | 'both'
//   el.stepStart   = the slide's step at which the first term is colored (1)
//   el.showAll     = false: no last step that colors every term at once
//   el.keepTinted  = true: terms already stepped through stay faintly colored
//   el.fontSize, el.labelSize, el.textColor
//
// equationRuntime.js draws it, on the canvas and on a deck's page. This file
// has what's around that: the source's structure (to pick a part of the drawn
// equation and wrap it as a term), the slide steps, and the config a page reads.

import { equationRuntime } from './equationRuntime'

export const EQUATION_COLORS = {
  dark: ['#5aa9ff', '#ff9a52', '#4cc36a', '#c58cff', '#f0c04b', '#ff7aa2'],
  light: ['#1d6fd8', '#cc5410', '#12855a', '#8a3ec2', '#9f6600', '#c02a5c'],
}
export const LABEL_STYLES = ['callout', 'brace', 'sentence']
export const INTERACTIONS = ['steps', 'hover', 'both']
export const EQUATION_SIZE = { w: 760, h: 340 }
export const EQUATION_FIELDS = ['latex', 'terms', 'labelStyle', 'sentence', 'interaction', 'stepStart', 'showAll', 'keepTinted', 'fontSize', 'labelSize', 'textColor']
export const MAX_TERMS = 40

export const TERM_ID = /^[A-Za-z][A-Za-z0-9_-]*$/
const COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export function defaultEquation(dark) {
  const c = EQUATION_COLORS[dark ? 'dark' : 'light']
  return {
    latex: '\\term{t1}{p(\\theta \\mid D)} = \\frac{\\term{t2}{p(D \\mid \\theta)}\\,\\term{t3}{p(\\theta)}}{\\term{t4}{p(D)}}',
    terms: [
      { id: 't1', label: 'Posterior', note: 'What you believe about θ after seeing the data', color: c[3] },
      { id: 't2', label: 'Likelihood', note: 'How probable the data are for a given θ', color: c[0] },
      { id: 't3', label: 'Prior', note: 'What you believed about θ beforehand', color: c[4] },
      { id: 't4', label: 'Evidence', note: 'How probable the data are overall', color: c[1] },
    ],
    labelStyle: 'callout',
    sentence: '[What you believe after the data](t1) is [how well θ explains the data](t2) times [what you believed before](t3), divided by [how probable the data are overall](t4).',
    interaction: 'steps',
    stepStart: 1,
    showAll: true,
    keepTinted: false,
    fontSize: 44,
    labelSize: 18,
    textColor: dark ? '#ffffff' : '#1a1a1a',
  }
}

// ── The source's structure ──────────────────────────────────────────────────
// Enough of LaTeX's grammar to cut the source into atoms: pieces that can be
// wrapped in braces on their own (a symbol, a group, \frac{…}{…}, x^{2}, a
// \left…\right pair, an environment), each holding the lists inside it (a
// fraction's numerator, an exponent, a table cell). Picking a part of the
// drawn equation selects atoms.
//
//   list: { start, end, braced, atoms, parent: the atom it's in, or null }
//   atom: { start, end, kind, lists, parent: its list, index in it,
//           wrap: false where braces around it alone would change the math,
//           term and body for \term{id}{body} }
//
// `braced` is false for a list that's a lone token, like the 2 in x^2: a
// term made of it needs braces of its own, x^{\term{t1}{2}}.

// Commands' arguments: m, math the picker goes into; t, text or a name it
// doesn't; o, an optional math argument in [ ]. Commands not here take none,
// or, followed straight away by braces, those braces.
const ARGS = {
  frac: 'mm', dfrac: 'mm', tfrac: 'mm', cfrac: 'mm', binom: 'mm', dbinom: 'mm', tbinom: 'mm',
  sqrt: 'om', overset: 'mm', underset: 'mm', stackrel: 'mm', xrightarrow: 'om', xleftarrow: 'om',
  overbrace: 'm', underbrace: 'm', overline: 'm', underline: 'm', boxed: 'm',
  hat: 'm', widehat: 'm', tilde: 'm', widetilde: 'm', bar: 'm', vec: 'm', dot: 'm', ddot: 'm', dddot: 'm',
  check: 'm', breve: 'm', acute: 'm', grave: 'm', mathring: 'm',
  overrightarrow: 'm', overleftarrow: 'm', overleftrightarrow: 'm', underrightarrow: 'm', underleftarrow: 'm',
  cancel: 'm', bcancel: 'm', xcancel: 'm', sout: 'm', phantom: 'm', hphantom: 'm', vphantom: 'm', smash: 'om',
  mathrm: 'm', mathbf: 'm', mathit: 'm', mathsf: 'm', mathtt: 'm', mathcal: 'm', mathbb: 'm', mathfrak: 'm',
  mathscr: 'm', mathnormal: 'm', boldsymbol: 'm', bm: 'm', pmb: 'm',
  mathop: 'm', mathbin: 'm', mathrel: 'm', mathord: 'm', mathopen: 'm', mathclose: 'm', mathpunct: 'm', mathinner: 'm',
  text: 't', textrm: 't', textbf: 't', textit: 't', textsf: 't', texttt: 't', textnormal: 't', textup: 't', emph: 't',
  mbox: 't', hbox: 't', operatorname: 't', 'operatorname*': 't', tag: 't', 'tag*': 't', label: 't',
  color: 't', textcolor: 'tm', colorbox: 'tt', fcolorbox: 'ttt', href: 'tm', url: 't',
  htmlData: 'tm', htmlClass: 'tm', htmlId: 'tm', htmlStyle: 'tm',
  hspace: 't', kern: '', mkern: '', mskip: '', hskip: '',
}
// Infix and structural commands, which mean nothing in braces on their own
const STRUCTURAL = new Set(['over', 'atop', 'choose', 'above', 'brace', 'brack', '\\', 'cr', 'newline', 'right', 'middle', 'end', 'hline', 'hdashline', 'nonumber', 'notag'])
// Bases whose scripts KaTeX places by them (a big operator's limits, the
// label over \overbrace): wrapped apart from their scripts, they'd move
const OPERATORS = new Set(['sum', 'prod', 'coprod', 'int', 'iint', 'iiint', 'oint', 'oiint', 'bigcup', 'bigcap', 'bigvee',
  'bigwedge', 'bigoplus', 'bigotimes', 'bigodot', 'biguplus', 'bigsqcup', 'lim', 'liminf', 'limsup', 'max', 'min', 'sup',
  'inf', 'det', 'gcd', 'Pr', 'argmax', 'argmin', 'varlimsup', 'varliminf', 'injlim', 'projlim',
  'overbrace', 'underbrace', 'overbracket', 'underbracket', 'operatorname*', 'mathop'])
// Environments whose \begin takes an argument of its own
const ENV_ARG = new Set(['array', 'darray', 'subarray', 'alignat', 'alignat*', 'alignedat'])

function tokenize(src) {
  const out = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '%') { while (i < src.length && src[i] !== '\n') i++; continue }
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue }
    if (c === '\\') {
      const word = /^[A-Za-z@]+\*?/.exec(src.slice(i + 1, i + 64))
      if (word) {
        out.push({ t: 'cmd', name: word[0], start: i, end: i + 1 + word[0].length })
        i += 1 + word[0].length
      } else if (i + 1 < src.length) {
        out.push({ t: 'cmd', name: src[i + 1], start: i, end: i + 2 })
        i += 2
      } else {
        out.push({ t: 'char', start: i, end: i + 1 })
        i++
      }
      continue
    }
    const len = src.codePointAt(i) > 0xffff ? 2 : 1
    out.push({ t: '{}^_&[]'.includes(c) ? c : 'char', start: i, end: i + len })
    i += len
  }
  return out
}

export function parseLatex(src) {
  src = String(src || '')
  const toks = tokenize(src)
  let p = 0
  const isCmd = (tok, ...names) => !!tok && tok.t === 'cmd' && names.includes(tok.name)
  const mkList = (atoms, start, end, braced) => ({ start, end, braced, atoms, parent: null })
  const mk = (kind, start, end, lists, extra) => ({ kind, start, end, lists, wrap: true, parent: null, index: 0, ...extra })

  // Atoms up to a token `stop` accepts (left for the caller)
  function items(stop) {
    const atoms = []
    while (p < toks.length && !stop(toks[p])) {
      const a = atom()
      if (a) atoms.push(a)
    }
    return atoms
  }

  // At '{': the list inside, and where the braces close
  function group() {
    const open = toks[p++]
    const atoms = items(tok => tok.t === '}')
    const close = toks[p] && toks[p].t === '}' ? toks[p++] : null
    const innerEnd = close ? close.start : (atoms.length ? atoms[atoms.length - 1].end : open.end)
    return { inner: mkList(atoms, open.end, innerEnd, true), end: close ? close.end : innerEnd }
  }

  // An argument that isn't read as math: a group or one token. Where it ends.
  function skipArg() {
    const tok = toks[p]
    if (!tok) return src.length
    if (tok.t !== '{') { p++; return tok.end }
    let depth = 0
    while (p < toks.length) {
      const t = toks[p++]
      if (t.t === '{') depth++
      else if (t.t === '}' && --depth === 0) return t.end
    }
    return src.length
  }

  // A math argument: a group, or a lone atom (\frac12)
  function mathArg() {
    const tok = toks[p]
    if (!tok || tok.t === '}' || tok.t === '&') return null
    if (tok.t === '{') { const g = group(); return { list: g.inner, end: g.end } }
    const a = base()
    return a ? { list: mkList([a], a.start, a.end, false), end: a.end } : null
  }

  // One atom without its sub- and superscripts
  function base() {
    const tok = toks[p]
    if (tok.t === '{') {
      const g = group()
      return mk('group', tok.start, g.end, [g.inner])
    }
    if (tok.t === 'cmd') return command()
    p++
    return mk('char', tok.start, tok.end, [], { wrap: tok.t !== '&' && tok.t !== '}' })
  }

  // An atom with its scripts: x^{2}_i, \sum\limits_{i=1}^{n}, f'
  function atom() {
    const tok = toks[p]
    if (tok.t === '}') { p++; return null }
    const b = tok.t === '^' || tok.t === '_' ? null : base()
    if (b && !b.wrap) return b
    const scripts = []
    let end = b ? b.end : tok.start, any = false
    while (p < toks.length) {
      const t = toks[p]
      if (isCmd(t, 'limits', 'nolimits')) { end = t.end; p++; continue }
      if (t.t === 'char' && src[t.start] === "'") { end = t.end; p++; any = true; continue }
      if (t.t !== '^' && t.t !== '_') break
      p++
      any = true
      const arg = mathArg()
      if (!arg) { end = t.end; continue }
      scripts.push(arg.list)
      end = arg.end
    }
    if (!any) return b
    // The base is picked apart from its scripts, unless it's a big operator
    const lists = []
    if (b) {
      if (b.kind === 'cmd' && OPERATORS.has(b.name)) lists.push(...b.lists)
      else lists.push(mkList([b], b.start, b.end, false))
    }
    lists.push(...scripts)
    return mk('scripts', b ? b.start : tok.start, end, lists)
  }

  function command() {
    const tok = toks[p++]
    const name = tok.name
    if (name === 'left') return leftRight(tok)
    if (name === 'begin') return environment(tok)
    if (name === 'term') return term(tok)
    if (STRUCTURAL.has(name)) {
      let end = tok.end
      if (name === 'middle' || name === 'right') { const d = toks[p]; if (d) { p++; end = d.end } }
      if (name === '\\' && toks[p] && toks[p].t === '[') { p++; items(t => t.t === ']'); if (toks[p]) end = toks[p++].end }
      return mk('cmd', tok.start, end, [], { name, wrap: false })
    }
    const lists = []
    let end = tok.end
    const spec = ARGS[name]
    if (spec === undefined) {
      // Unknown: the braces right after it are its arguments
      while (toks[p] && toks[p].t === '{' && toks[p].start === end) {
        const g = group()
        lists.push(g.inner)
        end = g.end
      }
    } else {
      for (const kind of spec) {
        const t = toks[p]
        if (!t) break
        if (kind === 'o') {
          if (t.t !== '[') continue
          p++
          const atoms = items(x => x.t === ']')
          const close = toks[p] && toks[p].t === ']' ? toks[p++] : null
          lists.push(mkList(atoms, t.end, close ? close.start : end, true))
          end = close ? close.end : (atoms.length ? atoms[atoms.length - 1].end : t.end)
        } else if (kind === 't') {
          end = skipArg()
        } else {
          const arg = mathArg()
          if (!arg) break
          lists.push(arg.list)
          end = arg.end
        }
      }
    }
    return mk('cmd', tok.start, end, lists, { name })
  }

  function leftRight(tok) {
    let end = tok.end
    if (toks[p]) end = toks[p++].end // the delimiter
    const open = end
    const atoms = items(t => isCmd(t, 'right'))
    const close = toks[p] ? toks[p].start : src.length
    if (isCmd(toks[p], 'right')) {
      end = toks[p++].end
      if (toks[p]) end = toks[p++].end
    } else if (atoms.length) end = atoms[atoms.length - 1].end
    return mk('leftright', tok.start, end, [mkList(atoms, open, close, true)])
  }

  function environment(tok) {
    const nameTok = toks[p]
    let end = skipArg()
    const env = nameTok && nameTok.t === '{' ? src.slice(nameTok.end, end - 1).trim() : ''
    if (ENV_ARG.has(env)) end = skipArg()
    const cells = []
    for (;;) {
      const from = toks[p] ? toks[p].start : src.length
      const atoms = items(t => t.t === '&' || isCmd(t, '\\', 'cr', 'end', 'hline', 'hdashline'))
      const t = toks[p]
      cells.push(mkList(atoms, from, t ? t.start : src.length, true))
      if (!t) break
      p++
      if (isCmd(t, 'end')) { end = skipArg(); break }
      if (isCmd(t, '\\') && toks[p] && toks[p].t === '[') { p++; items(x => x.t === ']'); if (toks[p]) p++ }
    }
    return mk('env', tok.start, end, cells, { name: env })
  }

  function term(tok) {
    let id = '', end = tok.end
    if (toks[p] && toks[p].t === '{') {
      const from = toks[p].end
      end = skipArg()
      id = src.slice(from, end - 1).trim()
    }
    const arg = mathArg()
    if (!arg) return mk('cmd', tok.start, end, [], { name: 'term', wrap: false, term: id })
    return mk('term', tok.start, arg.end, [arg.list], { term: id, body: arg.list })
  }

  const root = mkList(items(() => false), 0, src.length, true)
  const atoms = []
  const link = (list, parent) => {
    list.parent = parent
    list.atoms.forEach((a, i) => {
      a.parent = list
      a.index = i
      atoms.push(a)
      a.lists.forEach(l => link(l, a))
    })
  }
  link(root, null)
  return { src, root, atoms }
}

// The terms' atoms, in the order they're written
export function termAtoms(tree) {
  return tree.atoms.filter(a => a.kind === 'term').sort((a, b) => a.start - b.start)
}

// The ids of the source's terms, once each, in the order they're written
export function termIdsIn(latex) {
  const ids = []
  for (const a of termAtoms(parseLatex(latex))) if (TERM_ID.test(a.term) && !ids.includes(a.term)) ids.push(a.term)
  return ids
}

// Ids the source uses that can't be a term's
export function badTermIds(latex) {
  return termAtoms(parseLatex(latex)).map(a => a.term).filter(id => !TERM_ID.test(id))
}

// ── Picking ─────────────────────────────────────────────────────────────────

// The source with every atom wrapped as \htmlData{pk=n}{…}, n its place in
// `atoms`. Drawn by KaTeX it looks the same (the wrappers add no space), and
// the span under a click says which atom it's in.
export function pickSource(tree) {
  const { src } = tree
  const atoms = []
  const emit = (a, braced) => {
    let out = ''
    let cur = a.start
    for (const list of a.lists) {
      for (const child of list.atoms) {
        out += src.slice(cur, child.start) + emit(child, list.braced)
        cur = child.end
      }
    }
    out += src.slice(cur, a.end)
    if (!a.wrap) return out
    const n = atoms.push(a) - 1
    const wrapped = `\\htmlData{pk=${n}}{${out}}`
    return braced ? wrapped : `{${wrapped}}`
  }
  let source = '', cur = 0
  for (const a of tree.root.atoms) {
    source += src.slice(cur, a.start) + emit(a, true)
    cur = a.end
  }
  source += src.slice(cur)
  return { source, atoms }
}

// a's chain of atoms out to the top: a, the atom whose list holds it, …
function chain(a) {
  const out = []
  for (let x = a; x; x = x.parent && x.parent.parent) out.push(x)
  return out
}

// The atoms that hold both a and b, side by side in the deepest list that
// has them both: { list, from, to }
export function selectionBetween(a, b) {
  const cb = chain(b)
  for (const x of chain(a)) {
    const y = cb.find(z => z.parent === x.parent)
    if (y) return { list: x.parent, from: Math.min(x.index, y.index), to: Math.max(x.index, y.index) }
  }
  return null
}

export function selectionOf(a) {
  return { list: a.parent, from: a.index, to: a.index }
}

// Whether atom a is in the selection, or inside an atom that is
export function selectionHolds(sel, a) {
  return chain(a).some(x => x.parent === sel.list && x.index >= sel.from && x.index <= sel.to)
}

// One step out: the whole list the selection is part of, then the atom
// that holds that list
export function growSelection(sel) {
  const { list } = sel
  if (sel.from > 0 || sel.to < list.atoms.length - 1) return { list, from: 0, to: list.atoms.length - 1 }
  const up = list.parent
  if (!up || !up.parent) return sel
  return { list: up.parent, from: up.index, to: up.index }
}

export function selectionAtoms(sel) {
  return sel.list.atoms.slice(sel.from, sel.to + 1)
}

export function selectionRange(sel) {
  return { start: sel.list.atoms[sel.from].start, end: sel.list.atoms[sel.to].end }
}

export function sameSelection(a, b) {
  return !!a && !!b && a.list === b.list && a.from === b.from && a.to === b.to
}

// The term the selection is, if it is one: the \term atom, or all it holds
export function selectedTerm(sel) {
  if (sel.from === sel.to && sel.list.atoms[sel.from].kind === 'term') return sel.list.atoms[sel.from].term
  const up = sel.list.parent
  if (up && up.kind === 'term' && sel.from === 0 && sel.to === sel.list.atoms.length - 1) return up.term
  return null
}

// Whether braces around the selection alone keep the math the same
export function canWrap(sel) {
  return selectionAtoms(sel).every(a => a.wrap)
}

// The atoms a stretch of the source touches, at the level that holds them all
export function selectionForRange(tree, start, end) {
  const { src } = tree
  while (start < end && /\s/.test(src[start])) start++
  while (end > start && /\s/.test(src[end - 1])) end--
  if (start >= end) return null
  const at = pos => {
    let found = null
    for (const a of tree.atoms) if (a.start <= pos && pos < a.end && a.wrap && (!found || a.end - a.start <= found.end - found.start)) found = a
    return found
  }
  const a = at(start), b = at(end - 1)
  return a && b ? selectionBetween(a, b) : null
}

// ── Changing the source ─────────────────────────────────────────────────────

export function wrapAsTerm(latex, sel, id) {
  const { start, end } = selectionRange(sel)
  const term = `\\term{${id}}{${latex.slice(start, end)}}`
  return latex.slice(0, start) + (sel.list.braced ? term : `{${term}}`) + latex.slice(end)
}

// Each \term{id}{…} becomes what it holds
export function unwrapTerm(latex, id) {
  const found = termAtoms(parseLatex(latex)).filter(a => a.term === id).sort((a, b) => b.start - a.start)
  let out = latex
  for (const a of found) out = out.slice(0, a.start) + out.slice(a.body.start, a.body.end) + out.slice(a.end)
  return out
}

export function newTermId(latex, terms = []) {
  const used = new Set([...termAtoms(parseLatex(latex)).map(a => a.term), ...terms.map(t => t.id)])
  let n = 1
  while (used.has(`t${n}`)) n++
  return `t${n}`
}

// The terms list for a source: those it still has, in their order, then any
// new ones, with what `cache` remembers of them (a term deleted from the
// source and typed back) or the next color
export function syncTerms(latex, terms, colors, cache = new Map()) {
  const ids = termIdsIn(latex)
  const kept = (terms || []).filter((t, i, all) => ids.includes(t.id) && all.findIndex(u => u.id === t.id) === i)
  for (const id of ids) {
    if (kept.some(t => t.id === id)) continue
    const used = new Set(kept.map(t => t.color))
    const color = colors.find(c => !used.has(c)) || colors[kept.length % colors.length]
    kept.push(cache.get(id) || { id, label: '', note: '', color })
  }
  return kept
}

// ── The sentence ────────────────────────────────────────────────────────────
// Plain text, with phrases linked to terms as [phrase](id)

const PHRASE = /\[([^\]]+)\]\(([A-Za-z][A-Za-z0-9_-]*)\)/g

export function sentenceParts(sentence) {
  const text = String(sentence || '')
  const parts = []
  let last = 0
  for (const m of text.matchAll(PHRASE)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) })
    parts.push({ text: m[1], id: m[2] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

// The sentence with [start, end) linked to term id, or relinked if it's
// already a phrase
export function linkPhrase(sentence, start, end, id) {
  const text = String(sentence || '')
  for (const m of text.matchAll(PHRASE)) {
    if (start >= m.index && end <= m.index + m[0].length) {
      return text.slice(0, m.index) + `[${m[1]}](${id})` + text.slice(m.index + m[0].length)
    }
  }
  const phrase = text.slice(start, end).replace(/[[\]]/g, '').trim()
  if (!phrase) return text
  return `${text.slice(0, start)}[${phrase}](${id})${text.slice(end)}`
}

// Phrases linked to the term become plain text
export function unlinkTerm(sentence, id) {
  return String(sentence || '').replace(PHRASE, (whole, phrase, linked) => (linked === id ? phrase : whole))
}

// ── Steps ───────────────────────────────────────────────────────────────────

const int = (v, min, max, dflt) => (Number.isInteger(+v) && +v >= min && +v <= max ? +v : dflt)
const num = (v, min, max, dflt) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt)
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')
const isDark = hex => {
  const h = hex.length === 4 ? hex.replace(/[0-9a-f]/gi, d => d + d) : hex
  const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * b < 140
}

// What a page reads, from checked values only. Terms are the source's, in
// the element's order; one it hasn't any details for gets a color.
export function equationConfig(el) {
  const latex = str(el?.latex, 20000)
  const ids = termIdsIn(latex)
  const textColor = typeof el?.textColor === 'string' && COLOR.test(el.textColor) ? el.textColor : null
  const palette = EQUATION_COLORS[textColor && isDark(textColor) ? 'light' : 'dark']
  const given = Array.isArray(el?.terms) ? el.terms : []
  const terms = []
  for (const t of given) {
    if (!t || !ids.includes(t.id) || terms.some(u => u.id === t.id)) continue
    terms.push({ id: t.id, label: str(t.label, 200), note: str(t.note, 500), color: COLOR.test(t.color || '') ? t.color : null })
  }
  for (const id of ids) if (!terms.some(t => t.id === id)) terms.push({ id, label: '', note: '', color: null })
  terms.splice(MAX_TERMS)
  terms.forEach((t, i) => { if (!t.color) t.color = palette[i % palette.length] })
  return {
    latex,
    terms,
    labelStyle: LABEL_STYLES.includes(el?.labelStyle) ? el.labelStyle : 'callout',
    sentence: str(el?.sentence, 2000),
    interaction: INTERACTIONS.includes(el?.interaction) ? el.interaction : 'steps',
    stepStart: int(el?.stepStart, 1, 1000, 1),
    showAll: el?.showAll !== false,
    keepTinted: !!el?.keepTinted,
    fontSize: num(el?.fontSize, 8, 200, 44),
    labelSize: num(el?.labelSize, 6, 120, 18),
    textColor,
  }
}

// The slide steps at which an equation changes: [[step, index of the term
// colored then, or 'all']]
export function equationSteps(el) {
  if (el?.type !== 'equation') return []
  const cfg = equationConfig(el)
  if (cfg.interaction === 'hover') return []
  const steps = cfg.terms.map((t, i) => [cfg.stepStart + i, i])
  if (steps.length && cfg.showAll) steps.push([cfg.stepStart + steps.length, 'all'])
  return steps.filter(([n]) => n <= 1000)
}

// A slide's hidden fragments for its equations' steps, as clickActions'
// stepMarkers are for states; EQUATION_DECK_SCRIPT tells each equation its step
export function equationStepMarkers(slide) {
  let html = ''
  for (const el of slide?.elements || []) {
    const id = String(el.id || '').replace(/[^A-Za-z0-9_-]/g, '')
    // Reveal renumbers data-fragment-index from 0, so the step is kept apart
    for (const [n] of equationSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-eq-step="${id}" data-eq-step-at="${n}" aria-hidden="true" style="position:absolute;"></span>`
  }
  return html
}

export function hasEquations(presentation) {
  return (presentation?.slides || []).some(s => (s.elements || []).some(el => el.type === 'equation'))
}

// The config as an attribute value
export function equationConfigAttr(el, extra = {}) {
  return JSON.stringify({ ...equationConfig(el), ...extra })
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// The runtime as source, made once. Its own code has no "</script" or
// "<!--", and a minifier can't make one: in code "<!--" is "< !--"; in a
// string "<\/" is "</".
let runtimeCode = null
function runtimeSource() {
  if (!runtimeCode) runtimeCode = `(${equationRuntime.toString()})`.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '< !--')
  return runtimeCode
}

// In a deck with equations: draws each, and tells it the slide's step
export function equationDeckScript() {
  return `
    (function() {
      var run = ${runtimeSource()};
      var items = [];
      document.querySelectorAll('[data-eq-config]').forEach(function(el) {
        try {
          var cfg = JSON.parse(el.getAttribute('data-eq-config'));
          cfg.hover = cfg.interaction !== 'steps';
          items.push({ el: el, id: el.getAttribute('data-eq'), eq: run(el, cfg, window.katex) });
        } catch (e) {}
      });
      function stepOf(item) {
        var slide = item.el.closest('section'), n = 0;
        if (!slide) return 0;
        slide.querySelectorAll('.fragment[data-eq-step]').forEach(function(m) {
          if (m.getAttribute('data-eq-step') === item.id && m.classList.contains('visible')) n = Math.max(n, +m.getAttribute('data-eq-step-at') || 0);
        });
        return n;
      }
      function sync() { items.forEach(function(item) { item.eq.step(stepOf(item)); }); }
      ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden'].forEach(function(name) { Reveal.on(name, sync); });
    })();
`
}

// For the printed pages: each equation as it is at its page's step
export function equationPrintScript() {
  return `
    (function() {
      var run = ${runtimeSource()};
      document.querySelectorAll('[data-eq-config]').forEach(function(el) {
        try {
          var cfg = JSON.parse(el.getAttribute('data-eq-config'));
          cfg.static = true;
          var eq = run(el, cfg, window.katex);
          var at = el.getAttribute('data-eq-at');
          if (at === 'all') eq.show('all'); else eq.step(+at || 0);
        } catch (e) {}
      });
    })();
`
}

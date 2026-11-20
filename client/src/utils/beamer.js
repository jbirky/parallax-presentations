// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// LaTeX Beamer, read into frames: each frame's title and its content as
// blocks (paragraphs, lists, math, figures, tables, columns, Beamer's blocks,
// TikZ, code), with the steps each block shows on (\pause and overlay
// specifications), and the talk's title page, sections, notes and
// bibliography. utils/beamerSlides.js lays the frames out as slides.
//
// Nothing here runs TeX. The source's own macros are expanded, and what isn't
// known is kept as text where it has any, and named in the warnings.
//
// A block's `vis` is when it shows: null for always, or
// { ranges: [[from, to]], reserve }, slides numbered from 1 as Beamer counts
// them, with reserve false where hidden content takes no room (\only).
// Text comes as runs: { t: 'text' | 'math' | 'cite' | 'img' | 'br', m: marks }.

const NBSP = String.fromCharCode(0xa0)
const THIN = String.fromCharCode(0x2009)
const EMSP = String.fromCharCode(0x2003)
const INF = Infinity

// ── Reading TeX ─────────────────────────────────────────────────────────────
const isLetter = ch => ch !== undefined && /[A-Za-z]/.test(ch)

// The command whose backslash is at i: its name (letters, or one symbol)
function readCommand(s, i) {
  let j = i + 1
  if (j >= s.length) return { name: '', end: j }
  if (!isLetter(s[j])) return { name: s[j], end: j + 1 }
  while (j < s.length && isLetter(s[j])) j++
  return { name: s.slice(i + 1, j), end: j }
}

// Past spaces and at most one line break: a blank line ends a paragraph, and
// the search for an argument
function skipSpace(s, i) {
  let nl = false
  for (; i < s.length; i++) {
    const c = s[i]
    if (c === '\n') { if (nl) break; nl = true } else if (c !== ' ' && c !== '\t' && c !== '\r') break
  }
  return i
}

// The group whose { is at i, to its matching }
function readGroup(s, i) {
  let depth = 0
  for (let j = i; j < s.length; j++) {
    const c = s[j]
    if (c === '\\') j++
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return { content: s.slice(i + 1, j), end: j + 1 }
  }
  return { content: s.slice(i + 1), end: s.length }
}

// [...] at i, with braces inside it kept whole
function readBracket(s, i) {
  let depth = 0
  for (let j = i + 1; j < s.length; j++) {
    const c = s[j]
    if (c === '\\') j++
    else if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === ']' && depth <= 0) return { content: s.slice(i + 1, j), end: j + 1 }
  }
  return null
}

const optArg = (s, i) => { const j = skipSpace(s, i); return s[j] === '[' ? readBracket(s, j) : null }

// A required argument: a group, a command, or one character
function reqArg(s, i) {
  const j = skipSpace(s, i)
  if (j >= s.length || s[j] === '}') return null
  if (s[j] === '{') return readGroup(s, j)
  if (s[j] === '\\') { const c = readCommand(s, j); return { content: s.slice(j, c.end), end: c.end } }
  return { content: s[j], end: j + 1 }
}

// An overlay specification, <2->, after a command
const SPEC = /^[\s\w+.\-,()|@*:]*$/
function overlayAt(s, i) {
  const j = skipSpace(s, i)
  if (s[j] !== '<') return null
  const k = s.indexOf('>', j)
  if (k < 0 || k - j > 80) return null
  const content = s.slice(j + 1, k)
  return SPEC.test(content) ? { content, end: k + 1 } : null
}

// Where \end{name} closes the environment whose body starts at i
function findEnd(s, i, name) {
  const begin = '\\begin{' + name + '}', end = '\\end{' + name + '}'
  let depth = 1, j = i
  for (;;) {
    const e = s.indexOf(end, j)
    if (e < 0) return { inner: s.slice(i), end: s.length }
    const b = s.indexOf(begin, j)
    if (b >= 0 && b < e) { depth++; j = b + begin.length; continue }
    if (--depth === 0) return { inner: s.slice(i, e), end: e + end.length }
    j = e + end.length
  }
}

// Where `test` matches in s outside groups and environments; test(s, i)
// returns the match's length, or 0
function topLevel(s, test) {
  const at = []
  let depth = 0, env = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') {
      if (s.startsWith('\\begin{', i)) { env++; i += 6; continue }
      if (s.startsWith('\\end{', i)) { env = Math.max(0, env - 1); i += 4; continue }
      if (depth === 0 && env === 0) { const n = test(s, i); if (n) { at.push({ at: i, len: n }); i += n - 1; continue } }
      i++
      continue
    }
    if (c === '{') depth++
    else if (c === '}') depth = Math.max(0, depth - 1)
    else if (depth === 0 && env === 0) { const n = test(s, i); if (n) { at.push({ at: i, len: n }); i += n - 1 } }
  }
  return at
}

// s cut where `test` matches at the top level
function splitTop(s, test) {
  const parts = []
  let from = 0
  for (const { at, len } of topLevel(s, test)) { parts.push(s.slice(from, at)); from = at + len }
  parts.push(s.slice(from))
  return parts
}

const commandTest = name => (s, i) => s.startsWith('\\' + name, i) && !isLetter(s[i + name.length + 1]) ? name.length + 1 : 0

// key=value lists: [width=0.5\textwidth, keepaspectratio]
export function parseKeyval(s) {
  const out = {}
  for (const part of splitTop(s || '', (t, i) => t[i] === ',' ? 1 : 0)) {
    const k = part.indexOf('=')
    const key = (k < 0 ? part : part.slice(0, k)).trim()
    if (key) out[key] = k < 0 ? true : part.slice(k + 1).trim().replace(/^\{([\s\S]*)\}$/, '$1')
  }
  return out
}

// A length, as a fraction of the text width (tw), text height (th), paper
// width (pw) or height (ph), or millimeters (mm)
const RELATIVE = { textwidth: 'tw', linewidth: 'tw', columnwidth: 'tw', hsize: 'tw', paperwidth: 'pw', textheight: 'th', vsize: 'th', paperheight: 'ph' }
const MM = { cm: 10, mm: 1, in: 25.4, pt: 0.35146, bp: 0.35278, pc: 4.2175, dd: 0.376, cc: 4.512, em: 3.87, ex: 1.7 }
export function parseLength(str) {
  const t = String(str || '').replace(/\s+/g, '')
  const r = /^(-?[\d.]*)\\([a-z]+)$/.exec(t)
  if (r && RELATIVE[r[2]]) return { v: r[1] === '' ? 1 : r[1] === '-' ? -1 : parseFloat(r[1]), unit: RELATIVE[r[2]] }
  const u = /^(-?[\d.]+)([a-z]{2})$/.exec(t)
  if (u && MM[u[2]]) return { v: parseFloat(u[1]) * MM[u[2]], unit: 'mm' }
  return null
}

// ── When things show ────────────────────────────────────────────────────────
// An overlay specification, resolved to numbers (2-, 1-3, -2, 1,3-, 2| alert@2)
export function specVis(spec, reserve = true) {
  if (spec == null) return null
  const ranges = []
  for (let part of String(spec).split('|')[0].split(',')) {
    part = part.trim()
    if (!part || /[a-z@]/i.test(part)) continue
    const m = /^(\d*)\s*(-?)\s*(\d*)$/.exec(part)
    if (!m || (!m[1] && !m[3])) continue
    const a = m[1] ? +m[1] : 1
    ranges.push([a, m[2] ? (m[3] ? +m[3] : INF) : a])
  }
  return ranges.length ? { ranges, reserve } : null
}

export function intersect(a, b) {
  if (!a) return b || null
  if (!b) return a
  const ranges = []
  for (const [a1, a2] of a.ranges) for (const [b1, b2] of b.ranges) {
    const lo = Math.max(a1, b1), hi = Math.min(a2, b2)
    if (lo <= hi) ranges.push([lo, hi])
  }
  return { ranges, reserve: a.reserve && b.reserve }
}

// The slides v doesn't show on
function complement(v, reserve) {
  if (!v) return { ranges: [], reserve }
  const out = []
  let from = 1
  for (const [a, b] of [...v.ranges].sort((x, y) => x[0] - y[0])) {
    if (a > from) out.push([from, a - 1])
    from = Math.max(from, b + 1)
  }
  if (from < INF) out.push([from, INF])
  return { ranges: out, reserve }
}

export const visibleAt = (v, n) => !v || v.ranges.some(([a, b]) => n >= a && n <= b)
// Shown from some step on, and never hidden again
export const isCumulative = v => !v || (v.ranges.length === 1 && v.ranges[0][1] === INF)
export const firstStep = v => !v ? 1 : v.ranges.length ? Math.min(...v.ranges.map(r => r[0])) : INF
// Beamer's counted overlays (+, ., \pause) as numbers, in the order they're
// met, as Beamer's beamerpauses counter has them. Items get their list's
// default specification ([<+->]), or the frame's. steps: the last slide any
// specification names, which is how many slides Beamer makes of the frame.
const OVERLAY_COMMANDS = new Set(['only', 'uncover', 'visible', 'invisible', 'onslide', 'alt', 'temporal', 'alert', 'structure', 'textbf', 'textit', 'textsl', 'textrm', 'textsf', 'texttt', 'emph', 'color', 'textcolor', 'includegraphics', 'action', 'hyperlink', 'note'])
const LISTS = new Set(['itemize', 'enumerate', 'description'])
const MATH_ENVS = new Set(['equation', 'equation*', 'align', 'align*', 'gather', 'gather*', 'multline', 'multline*', 'eqnarray', 'eqnarray*', 'displaymath', 'flalign', 'flalign*', 'alignat', 'alignat*'])

function mathEnd(s, i, display) {
  for (let j = i; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue }
    if (s[j] === '$' && (!display || s[j + 1] === '$')) return j
  }
  return s.length
}

export function resolveOverlays(s, frameDefault = null) {
  let counter = 1, steps = 1
  const lists = []
  let out = '', i = 0
  const resolve = spec => {
    let plus = false
    const r = spec.replace(/([+.])(?:\((-?\d+)\))?/g, (m, sign, off) => {
      if (sign === '+') plus = true
      return String((sign === '+' ? counter : counter - 1) + (off ? +off : 0))
    })
    if (plus) counter++
    for (const n of r.split('|')[0].match(/\d+/g) || []) steps = Math.max(steps, +n)
    return r
  }
  while (i < s.length) {
    const c = s[i]
    if (c === '$') {
      const display = s[i + 1] === '$'
      const end = mathEnd(s, i + (display ? 2 : 1), display) + (display ? 2 : 1)
      out += s.slice(i, end); i = end
      continue
    }
    if (c !== '\\') { out += c; i++; continue }
    const cmd = readCommand(s, i)
    const name = cmd.name
    if (name === '(' || name === '[') {
      const close = s.indexOf(name === '(' ? '\\)' : '\\]', cmd.end)
      const end = close < 0 ? s.length : close + 2
      out += s.slice(i, end); i = end
      continue
    }
    if (name === 'pause') {
      const o = optArg(s, cmd.end)
      if (o && /^\s*\d+\s*$/.test(o.content)) counter = +o.content
      else counter++
      out += `\\pause[${counter}]`
      steps = Math.max(steps, counter)
      i = o ? o.end : cmd.end
      continue
    }
    if (name === 'begin' && s[cmd.end] === '{') {
      const g = readGroup(s, cmd.end)
      const env = g.content.trim()
      out += s.slice(i, g.end); i = g.end
      if (MATH_ENVS.has(env)) {
        const { end } = findEnd(s, i, env)
        out += s.slice(i, end); i = end
        continue
      }
      const ov = overlayAt(s, i)
      if (ov) { out += '<' + resolve(ov.content) + '>'; i = ov.end }
      if (LISTS.has(env)) {
        let def = null
        const o = optArg(s, i)
        if (o && /^\s*<[^<>]*>\s*$/.test(o.content)) { def = o.content.trim().slice(1, -1); i = o.end }
        lists.push(def)
      }
      continue
    }
    if (name === 'end' && s[cmd.end] === '{') {
      const g = readGroup(s, cmd.end)
      if (LISTS.has(g.content.trim())) lists.pop()
      out += s.slice(i, g.end); i = g.end
      continue
    }
    if (name === 'item') {
      const ov = overlayAt(s, cmd.end)
      const def = lists.length ? lists[lists.length - 1] : null
      const spec = ov ? ov.content : def ?? frameDefault
      out += spec ? '\\item<' + resolve(spec) + '>' : '\\item'
      i = ov ? ov.end : cmd.end
      continue
    }
    if (OVERLAY_COMMANDS.has(name)) {
      const ov = overlayAt(s, cmd.end)
      if (ov) { out += '\\' + name + '<' + resolve(ov.content) + '>'; i = ov.end; continue }
    }
    out += s.slice(i, cmd.end); i = cmd.end
  }
  return { text: out, steps }
}

// ── The source, cleaned ─────────────────────────────────────────────────────
// Comments out, and verbatim text (verbatim, lstlisting, minted, \verb) set
// aside in `verbatim` behind \parallaxverbatim{n} and \parallaxverb{n}, so
// nothing else reads inside it
const VERBATIM_ENV = /^\\begin\{(verbatim\*?|Verbatim|BVerbatim|lstlisting|minted|semiverbatim)\}/
function stripComments(src, verbatim) {
  let out = '', i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '\\') {
      const env = VERBATIM_ENV.exec(src.slice(i, i + 32))
      if (env) {
        const endTag = '\\end{' + env[1] + '}'
        const k = src.indexOf(endTag, i)
        const stop = k < 0 ? src.length : k + endTag.length
        verbatim.push(src.slice(i, stop))
        out += `\\parallaxverbatim{${verbatim.length - 1}}`
        i = stop
        continue
      }
      const verb = /^\\(verb|lstinline)\*?(\[[^\]]*\])?([^A-Za-z\s{])/.exec(src.slice(i, i + 40))
        || /^\\(lstinline)(\[[^\]]*\])?(\{)/.exec(src.slice(i, i + 40))
        || /^\\(mintinline)\{[^}]*\}([^A-Za-z\s{])/.exec(src.slice(i, i + 40))
      if (verb) {
        const delim = verb[verb.length - 1] === '{' ? '}' : verb[verb.length - 1]
        const start = i + verb[0].length
        const k = src.indexOf(delim, start)
        const stop = k < 0 ? src.length : k
        verbatim.push(src.slice(start, stop))
        out += `\\parallaxverb{${verbatim.length - 1}}`
        i = stop + 1
        continue
      }
      out += c + (src[i + 1] ?? '')
      i += 2
      continue
    }
    if (c === '%') {
      const nl = src.indexOf('\n', i)
      if (nl < 0) break
      i = nl + 1
      while (src[i] === ' ' || src[i] === '\t') i++
      continue
    }
    out += c
    i++
  }
  return out
}

// A file the source names, from the files given (a Map of path → text)
function findFile(files, name, exts) {
  if (!files) return null
  const want = name.trim().replace(/^\.\//, '')
  for (const ext of exts) {
    const p = want + ext
    if (files.has(p)) return files.get(p)
    for (const [k, v] of files) if (k === p || k.endsWith('/' + p)) return v
  }
  return null
}

// \input and \include, with the files they name
function withInputs(text, files, verbatim, warn, depth = 0) {
  return text.replace(/\\(input|include|subfile)\s*\{([^}]*)\}/g, (m, cmd, name) => {
    const found = depth < 8 ? findFile(files, name, ['.tex', '']) : null
    if (found == null) {
      warn('input:' + name, `${name} wasn't among the files, so what \\${cmd} brings in is missing`)
      return ''
    }
    return withInputs(stripComments(found, verbatim), files, verbatim, warn, depth + 1)
  })
}

// The source's own commands and environments, taken out of it into
// `macros` and `envs`. \makeatletter code is the class's business, not the talk's.
function takeDefinitions(text, macros, envs) {
  text = text.replace(/\\makeatletter[\s\S]*?(\\makeatother|$)/g, '')
  let out = '', i = 0
  for (;;) {
    const k = text.indexOf('\\', i)
    if (k < 0) { out += text.slice(i); break }
    out += text.slice(i, k)
    const cmd = readCommand(text, k)
    let j = cmd.end
    const name = cmd.name
    if (name === 'newcommand' || name === 'renewcommand' || name === 'providecommand') {
      if (text[j] === '*') j++
      const target = reqArg(text, j)
      if (!target) { out += text.slice(k, j); i = j; continue }
      j = target.end
      const macro = target.content.trim().replace(/^\\/, '')
      const n = optArg(text, j)
      if (n) j = n.end
      const def = optArg(text, j)
      if (def) j = def.end
      const body = reqArg(text, j)
      if (body) j = body.end
      if (body && /^[A-Za-z]+$/.test(macro) && !(name === 'providecommand' && macros.has(macro))) {
        macros.set(macro, { n: n ? parseInt(n.content, 10) || 0 : 0, def: def ? def.content : null, body: body.content })
      }
      i = j
      continue
    }
    if (name === 'def' || name === 'gdef' || name === 'edef' || name === 'xdef') {
      const m = /^\s*\\([A-Za-z]+)((?:#\d)*)\s*\{/.exec(text.slice(j, j + 80))
      if (m) {
        const body = readGroup(text, j + m[0].length - 1)
        macros.set(m[1], { n: m[2].length / 2, def: null, body: body.content })
        i = body.end
        continue
      }
    }
    if (name === 'DeclareMathOperator') {
      const star = text[j] === '*'
      if (star) j++
      const target = reqArg(text, j)
      const body = target && reqArg(text, target.end)
      if (body) {
        macros.set(target.content.trim().replace(/^\\/, ''), { n: 0, def: null, body: `\\operatorname${star ? '*' : ''}{${body.content}}` })
        i = body.end
        continue
      }
    }
    if (name === 'let') {
      const m = /^\s*\\([A-Za-z]+)\s*=?\s*\\([A-Za-z]+)/.exec(text.slice(j, j + 80))
      if (m) {
        if (macros.has(m[2])) macros.set(m[1], macros.get(m[2]))
        else if (m[1] !== m[2]) macros.set(m[1], { n: 0, def: null, body: '\\' + m[2] })
        i = j + m[0].length
        continue
      }
    }
    if (name === 'newenvironment' || name === 'renewenvironment') {
      if (text[j] === '*') j++
      const env = reqArg(text, j)
      if (env) {
        j = env.end
        const n = optArg(text, j)
        if (n) j = n.end
        const def = optArg(text, j)
        if (def) j = def.end
        const begin = reqArg(text, j)
        const end = begin && reqArg(text, begin.end)
        if (end) {
          envs.set(env.content.trim(), { n: n ? parseInt(n.content, 10) || 0 : 0, def: def ? def.content : null, begin: begin.content, end: end.content })
          i = end.end
          continue
        }
      }
    }
    out += text.slice(k, j)
    i = j
  }
  return out
}

// A macro's arguments from j: the optional first one, if it has a default
function macroArgs(s, j, m) {
  const args = []
  if (m.def != null) {
    const o = optArg(s, j)
    if (o) { args.push(o.content); j = o.end } else args.push(m.def)
  }
  while (args.length < m.n) {
    const a = reqArg(s, j)
    if (!a) break
    args.push(a.content)
    j = a.end
  }
  return { args, end: j }
}
const fill = (body, args) => body.replace(/##|#([1-9])/g, (t, k) => k ? (args[k - 1] ?? '') : '#')

// Each macro and environment of the source's own, expanded, and what they
// hold expanded again
function expand(text, macros, envs, warn) {
  if (!macros.size && !envs.size) return text
  // A definition that refers to itself stops after a while, or once the
  // source has grown far past what it was
  let s = text, i = 0, budget = 5000
  const limit = Math.max(200000, text.length * 4)
  while (i < s.length) {
    const k = s.indexOf('\\', i)
    if (k < 0) break
    const cmd = readCommand(s, k)
    if (cmd.name === 'parallaxverbatim' || cmd.name === 'parallaxverb') { i = cmd.end; continue }
    let replaced = null, end = cmd.end
    if (cmd.name === 'begin' && s[cmd.end] === '{') {
      const g = readGroup(s, cmd.end)
      const env = envs.get(g.content.trim())
      if (env) {
        const { args, end: e } = macroArgs(s, g.end, env)
        replaced = fill(env.begin, args)
        end = e
        // its \end, filled with the same arguments
        const close = findEnd(s, e, g.content.trim())
        s = s.slice(0, close.end - (`\\end{${g.content.trim()}}`).length) + fill(env.end, args) + s.slice(close.end)
      }
    } else if (macros.has(cmd.name)) {
      const m = macros.get(cmd.name)
      const { args, end: e } = macroArgs(s, cmd.end, m)
      replaced = fill(m.body, args)
      end = e
      // \foo followed by a letter, once \foo's body ends in a command: keep them apart
      if (/\\[A-Za-z]+$/.test(replaced) && isLetter(s[end])) replaced += ' '
    }
    if (replaced == null) { i = cmd.end; continue }
    if (--budget < 0 || s.length + replaced.length > limit) { warn('macros', 'Some commands defined in the source refer to themselves, so not all of them were expanded'); break }
    s = s.slice(0, k) + replaced + s.slice(end)
    i = k
  }
  return s
}

// ── Colors ──────────────────────────────────────────────────────────────────
const NAMED = {
  red: [255, 0, 0], green: [0, 255, 0], blue: [0, 0, 255], cyan: [0, 255, 255], magenta: [255, 0, 255], yellow: [255, 255, 0],
  black: [0, 0, 0], white: [255, 255, 255], gray: [128, 128, 128], grey: [128, 128, 128], darkgray: [64, 64, 64], lightgray: [191, 191, 191],
  brown: [191, 128, 64], lime: [191, 255, 0], olive: [128, 128, 0], orange: [255, 128, 0], pink: [255, 191, 191], purple: [191, 0, 64],
  teal: [0, 128, 128], violet: [128, 0, 128],
}
// Beamer's own colors, which the look decides (utils/beamerSlides.js)
const BEAMER_COLORS = { structure: '@structure', alert: '@alert', alerted: '@alert', example: '@example', fg: '@text', bg: '@background' }

function modelColor(model, spec) {
  const nums = String(spec).split(',').map(x => parseFloat(x))
  switch ((model || '').trim()) {
    case 'rgb': return nums.length === 3 ? nums.map(x => x * 255) : null
    case 'RGB': return nums.length === 3 ? nums : null
    case 'HTML': return /^[0-9a-f]{6}$/i.test(spec.trim()) ? [0, 2, 4].map(k => parseInt(spec.trim().slice(k, k + 2), 16)) : null
    case 'gray': return nums.length === 1 ? [nums[0] * 255, nums[0] * 255, nums[0] * 255] : null
    case 'cmyk': {
      if (nums.length !== 4) return null
      const [c, m, y, k] = nums
      return [c, m, y].map(x => 255 * (1 - Math.min(1, x + k)))
    }
    default: return null
  }
}

const hex = rgb => '#' + rgb.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')
const mix = (a, b, t) => a.map((x, k) => x * t + b[k] * (1 - t))

// An xcolor expression (red!50!black, -blue, a \definecolor name) as #rrggbb,
// or a Beamer color as @structure and the like; null when it isn't known
export function resolveColor(expr, defs = {}, model = null, depth = 0) {
  if (model) { const c = modelColor(model, expr); return c ? hex(c) : null }
  const e = String(expr || '').trim()
  if (BEAMER_COLORS[e]) return BEAMER_COLORS[e]
  const rgb = colorRgb(e, defs, depth)
  return rgb ? hex(rgb) : null
}
function colorRgb(e, defs, depth) {
  if (depth > 8) return null
  let neg = false
  if (e.startsWith('-')) { neg = true; e = e.slice(1) }
  const parts = e.split('!').map(x => x.trim())
  const base = name => {
    if (NAMED[name]) return NAMED[name]
    const d = defs[name]
    if (d) return d.model ? modelColor(d.model, d.spec) : colorRgb(d.spec, defs, depth + 1)
    return null
  }
  let c = base(parts[0])
  if (!c) return null
  for (let k = 1; k < parts.length; k += 2) {
    const pct = parseFloat(parts[k])
    if (isNaN(pct)) return null
    const other = parts[k + 1] !== undefined ? base(parts[k + 1]) : NAMED.white
    if (!other) return null
    c = mix(c, other, pct / 100)
  }
  return neg ? c.map(x => 255 - x) : c
}

// ── Text ────────────────────────────────────────────────────────────────────
const SIZES = { tiny: 0.55, scriptsize: 0.7, footnotesize: 0.8, small: 0.9, normalsize: 1, large: 1.2, Large: 1.44, LARGE: 1.73, huge: 2.07, Huge: 2.49 }

const SYMBOLS = {
  LaTeX: 'LaTeX', LaTeXe: 'LaTeX2ε', TeX: 'TeX', BibTeX: 'BibTeX', ldots: '…', dots: '…', textellipsis: '…',
  textendash: '–', textemdash: '—', textbullet: '•', textperiodcentered: '·', S: '§', P: '¶', copyright: '©',
  textcopyright: '©', textregistered: '®', texttrademark: '™', textdegree: '°', degree: '°', textasciitilde: '~',
  textasciicircum: '^', textbackslash: '\\', textbar: '|', textless: '<', textgreater: '>', textquotedblleft: '“',
  textquotedblright: '”', textquoteleft: '‘', textquoteright: '’', guillemotleft: '«', guillemotright: '»',
  dag: '†', ddag: '‡', textdagger: '†', textdaggerdbl: '‡', checkmark: '✓', euro: '€', texteuro: '€', pounds: '£',
  textsterling: '£', yen: '¥', textmu: 'µ', textpm: '±', texttimes: '×', textdiv: '÷', textminus: '−',
  textrightarrow: '→', textleftarrow: '←', textunderscore: '_', textsection: '§',
  i: 'ı', j: 'ȷ', o: 'ø', O: 'Ø', ae: 'æ', AE: 'Æ', oe: 'œ', OE: 'Œ', aa: 'å', AA: 'Å', ss: 'ß', l: 'ł', L: 'Ł',
  quad: EMSP, qquad: EMSP + EMSP, enspace: ' ', thinspace: THIN, hfill: ' ', hfil: ' ', space: ' ', slash: '/',
  '%': '%', '&': '&', '$': '$', '#': '#', '_': '_', '{': '{', '}': '}', ' ': ' ', ',': THIN, ';': ' ', ':': ' ',
  '>': ' ', '!': '', '-': '', '/': '', '@': '', '\n': ' ', '\t': ' ',
}

const DINGS = { 43: '☞', 51: '✓', 52: '✔', 55: '✗', 56: '✘', 72: '★', 108: '●', 110: '■', 115: '▲', 116: '▼', 117: '◆', 224: '➔' }

// Accents, as the combining character each adds
const ACCENTS = { "'": 0x301, '`': 0x300, '^': 0x302, '"': 0x308, '~': 0x303, '=': 0x304, '.': 0x307, u: 0x306, v: 0x30c, H: 0x30b, c: 0x327, k: 0x328, r: 0x30a, d: 0x323, b: 0x331 }

// Formatting that takes its text as an argument
const STYLED = {
  textbf: m => ({ ...m, b: true }), textit: m => ({ ...m, i: true }), textsl: m => ({ ...m, i: true }),
  emph: m => ({ ...m, i: !m.i }), textup: m => ({ ...m, i: false }), textmd: m => ({ ...m, b: false }),
  textnormal: m => ({ ...m, b: false, i: false, tt: false }), textrm: m => ({ ...m, tt: false }), textsf: m => ({ ...m, tt: false }),
  texttt: m => ({ ...m, tt: true }), textsc: m => m, underline: m => ({ ...m, u: true }), uline: m => ({ ...m, u: true }),
  sout: m => ({ ...m, s: true }), st: m => ({ ...m, s: true }), xout: m => ({ ...m, s: true }), hl: m => ({ ...m, hl: '#fff3a0' }),
  alert: m => ({ ...m, color: '@alert' }), structure: m => ({ ...m, color: '@structure' }),
  textsuperscript: m => ({ ...m, sup: true }), textsubscript: m => ({ ...m, sub: true }), inst: m => ({ ...m, sup: true }),
  mbox: m => m, hbox: m => m, fbox: m => m, text: m => m, ensuremath: m => m, textmath: m => m, hyperlink: m => m, hypertarget: m => m,
}
// Declarations: they change the text after them, to the end of the group
const DECLARED = {
  bfseries: { b: true }, bf: { b: true }, itshape: { i: true }, it: { i: true }, slshape: { i: true }, sl: { i: true },
  ttfamily: { tt: true }, tt: { tt: true }, upshape: { i: false }, mdseries: { b: false }, rmfamily: { tt: false }, sffamily: { tt: false },
  normalfont: { b: false, i: false, tt: false }, scshape: {},
}
// Commands that take a box's arguments, the last being what's shown:
// o optional, a an argument read for its meaning (scale, width), c the content
const BOXES = {
  makebox: 'ooc', framebox: 'ooc', parbox: 'oooac', raisebox: 'aooc', scalebox: 'aoc', resizebox: 'aac',
  adjustbox: 'ac', smash: 'oc', centerline: 'c', vbox: 'c', vtop: 'c', colorbox: 'oac', fcolorbox: 'oaac', minibox: 'oc',
}
// Commands with nothing to show: how many arguments to pass over
const SKIP = {
  setbeamertemplate: 2, setbeamercolor: 2, setbeamerfont: 2, setbeamersize: 1, setbeamercovered: 1, setlength: 2, addtolength: 2,
  setcounter: 2, addtocounter: 2, stepcounter: 1, hypersetup: 1, label: 1, index: 1, nocite: 1, bibliographystyle: 1,
  graphicspath: 1, usetheme: 1, usecolortheme: 1, usefonttheme: 1, useinnertheme: 1, useoutertheme: 1, vspace: 1,
  phantom: 1, hphantom: 1, vphantom: 1, usebeamercolor: 1, usebeamerfont: 1, usebeamertemplate: 1, logo: 1,
  definecolor: 3, colorlet: 2, pgfdeclareimage: 2, titlegraphic: 1, title: 1, subtitle: 1, author: 1, institute: 1, date: 1,
  usepackage: 1, frametitle: 1, framesubtitle: 1, addbibresource: 1, bibliography: 1, renewcommand: 2, newcommand: 2,
  footnotemark: 0, vskip: 0, hskip: 0, rule: 2, linespread: 1, captionsetup: 1, lstset: 1, tikzset: 1, pgfplotsset: 1,
  setminted: 1, AtBeginSection: 1, AtBeginSubsection: 1, mode: 0, includeonlyframes: 1, setkeys: 2, resetcounteronoverlays: 1,
  newcounter: 1, newlength: 1, settowidth: 2, settoheight: 2, metroset: 1, setbeameroption: 1, usebackgroundtemplate: 1,
  setsansfont: 1, setmainfont: 1, setmonofont: 1, usemintedstyle: 1, newtheorem: 2, theoremstyle: 1, pgfplotstableread: 2,
}
const NOOP = new Set(['relax', 'protect', 'noindent', 'indent', 'strut', 'leavevmode', 'nobreak', 'allowbreak', 'ignorespaces',
  'unskip', 'normalcolor', 'vfill', 'vfil', 'smallskip', 'medskip', 'bigskip', 'newpage', 'clearpage', 'displaystyle',
  'nointerlineskip', 'break', 'null', 'selectfont', 'framebreak', 'pagebreak', 'justifying', 'hss', 'appendix', 'par',
  'printbibliography', 'maketitle', 'titlepage', 'tableofcontents', 'pause', 'centering', 'raggedright', 'raggedleft',
  'flushleft', 'flushright', 'columnbreak', 'egroup', 'bgroup', 'onslide', 'hline', 'toprule', 'midrule', 'bottomrule'])

const CITES = /^(cite|citep|citet|citealp|citealt|citeauthor|citeyear|citeyearpar|citetitle|parencite|textcite|autocite|footcite|footfullcite|supercite|smartcite|fullcite|Cite|Citep|Citet|Parencite|Textcite|Autocite|cites|parencites|textcites|autocites)$/

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const today = () => { const d = new Date(); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` }

// Math as KaTeX takes it: what only numbers or labels equations goes
function cleanMath(t) {
  return t.replace(/\\label\s*\{[^}]*\}/g, '').replace(/\\(nonumber|notag)(?![A-Za-z])/g, '').replace(/\\mathbbm(?![A-Za-z])/g, '\\mathbb').trim()
}
export function mathEnvTex(env, inner) {
  let t = cleanMath(inner).replace(/\\\\\s*$/, '')
  const base = env.replace('*', '')
  if (base === 'align' || base === 'flalign') return `\\begin{aligned}${t}\\end{aligned}`
  if (base === 'alignat') {
    const n = /^\s*\{(\d+)\}/.exec(t)
    if (n) t = t.slice(n[0].length)
    return `\\begin{alignedat}{${n ? n[1] : 1}}${t}\\end{alignedat}`
  }
  if (base === 'gather' || base === 'multline') return `\\begin{gathered}${t}\\end{gathered}`
  if (base === 'eqnarray') return `\\begin{array}{rcl}${t}\\end{array}`
  return t
}

// Text, as runs in `runs`. ix: the frame's reading state (st) and what the
// paragraph's commands set for the paragraph as a whole (align)
function inline(s, marks, runs, ix) {
  let m = { ...marks }
  let text = ''
  const flush = () => { if (text) { runs.push({ t: 'text', text, m: { ...m } }); text = '' } }
  const set = changes => { flush(); m = { ...m, ...changes } }
  const sub = (src, mm) => { flush(); inline(src, mm, runs, ix) }
  const st = ix.st
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '$') {
      flush()
      const display = s[i + 1] === '$'
      const from = i + (display ? 2 : 1)
      const close = mathEnd(s, from, display)
      runs.push({ t: 'math', tex: cleanMath(s.slice(from, close)), display, m: { ...m } })
      i = close + (display ? 2 : 1)
      continue
    }
    if (c === '{') { const g = readGroup(s, i); sub(g.content, m); i = g.end; continue }
    if (c === '}') { i++; continue }
    if (c === '~') { text += NBSP; i++; continue }
    if (c === '-' && s.startsWith('---', i)) { text += '—'; i += 3; continue }
    if (c === '-' && s.startsWith('--', i)) { text += '–'; i += 2; continue }
    if (c === '`') { if (s[i + 1] === '`') { text += '“'; i += 2 } else { text += '‘'; i++ } continue }
    if (c === "'") { if (s[i + 1] === "'") { text += '”'; i += 2 } else { text += '’'; i++ } continue }
    if (c === '&') { text += ' '; i++; continue }
    if (c !== '\\') { text += c; i++; continue }

    const cmd = readCommand(s, i)
    const name = cmd.name
    let j = cmd.end
    // A command made of letters swallows the spaces after it, as in TeX
    const past = () => isLetter(name[0]) ? skipSpace(s, j) : j
    const ov = OVERLAY_COMMANDS.has(name) ? overlayAt(s, j) : null
    if (ov) j = ov.end

    if (name === '\\' || name === 'newline' || name === 'linebreak') {
      if (s[j] === '*') j++
      const o = optArg(s, j)
      if (o) j = o.end
      flush()
      runs.push({ t: 'br' })
      i = past()
      continue
    }
    if (name === '(' || name === '[') {
      flush()
      const close = s.indexOf(name === '(' ? '\\)' : '\\]', j)
      const end = close < 0 ? s.length : close
      runs.push({ t: 'math', tex: cleanMath(s.slice(j, end)), display: name === '[', m: { ...m } })
      i = end + 2
      continue
    }
    if (ACCENTS[name] !== undefined && !(isLetter(name) && isLetter(s[j]))) {
      const a = reqArg(s, j)
      if (a) {
        const base = a.content.replace(/^\\([ij])$/, (t, l) => l === 'i' ? 'ı' : 'ȷ').replace(/[{}]/g, '')
        text += (base.slice(0, 1) + String.fromCharCode(ACCENTS[name]) + base.slice(1)).normalize('NFC')
        i = a.end
        continue
      }
    }
    if (Object.hasOwn(SYMBOLS, name)) { text += SYMBOLS[name]; i = past(); continue }
    if (SIZES[name]) { set({ size: SIZES[name] }); i = past(); continue }
    if (DECLARED[name]) { set(DECLARED[name]); i = past(); continue }
    if (name === 'em') { set({ i: !m.i }); i = past(); continue }
    if (name === 'centering' || name === 'raggedright' || name === 'raggedleft') {
      ix.align = name === 'centering' ? 'center' : name === 'raggedright' ? 'left' : 'right'
      i = past()
      continue
    }
    if (name === 'color') {
      const model = optArg(s, j)
      const a = reqArg(s, model ? model.end : j)
      if (a) { set({ color: resolveColor(a.content, st.doc.colors, model?.content) || m.color }); i = a.end; continue }
    }
    if (STYLED[name]) {
      const a = reqArg(s, j)
      if (a) {
        if (name === 'hyperlink' || name === 'hypertarget') { const b = reqArg(s, a.end); if (b) { sub(b.content, m); i = b.end; continue } }
        sub(a.content, STYLED[name](m))
        i = a.end
        continue
      }
    }
    if (name === 'textcolor') {
      const model = optArg(s, j)
      const col = reqArg(s, model ? model.end : j)
      const a = col && reqArg(s, col.end)
      if (a) { sub(a.content, { ...m, color: resolveColor(col.content, st.doc.colors, model?.content) || m.color }); i = a.end; continue }
    }
    if (name === 'href') {
      const url = reqArg(s, j)
      const a = url && reqArg(s, url.end)
      if (a) { sub(a.content, { ...m, href: url.content.trim() }); i = a.end; continue }
    }
    if (name === 'url' || name === 'nolinkurl') {
      const a = reqArg(s, j)
      if (a) { flush(); runs.push({ t: 'text', text: a.content.trim(), m: { ...m, tt: true, href: name === 'url' ? a.content.trim() : m.href } }); i = a.end; continue }
    }
    if (name === 'footnote' || name === 'footnotetext') {
      const o = optArg(s, j)
      const a = reqArg(s, o ? o.end : j)
      if (a) {
        const note = []
        inline(a.content, {}, note, { st, align: null })
        st.footnotes.push(note)
        if (name === 'footnote') { flush(); runs.push({ t: 'text', text: String(st.footnotes.length), m: { ...m, sup: true } }) }
        i = a.end
        continue
      }
    }
    if (CITES.test(name)) {
      let k = j
      for (let n = 0; n < 2; n++) { const o = optArg(s, k); if (o) k = o.end }
      const a = reqArg(s, k)
      if (a) {
        flush()
        runs.push({ t: 'cite', keys: a.content.split(',').map(x => x.trim()).filter(Boolean), m: { ...m } })
        i = a.end
        continue
      }
    }
    if (name === 'includegraphics') {
      if (s[j] === '*') j++
      const o = optArg(s, j)
      const a = reqArg(s, o ? o.end : j)
      if (a) {
        flush()
        runs.push({ t: 'img', path: a.content.trim(), opts: parseKeyval(o ? o.content : ''), vis: intersect(m.vis, ov ? specVis(ov.content) : null), m: { ...m } })
        i = a.end
        continue
      }
    }
    if (name === 'only' || name === 'uncover' || name === 'visible' || name === 'invisible' || name === 'onslide' || name === 'alt' || name === 'temporal') {
      const k = skipSpace(s, j)
      if (name === 'onslide' && s[k] !== '{') {
        // From here on, in this paragraph and after it
        const v = ov ? specVis(ov.content) : null
        set({ vis: v })
        st.current = v
        i = j
        continue
      }
      const reserve = name !== 'only' && name !== 'alt'
      const spec = ov ? specVis(ov.content, reserve) : null
      const a = reqArg(s, j)
      if (!a) { i = j; continue }
      if (name === 'alt' || name === 'temporal') {
        const b = reqArg(s, a.end)
        const d = name === 'temporal' && b ? reqArg(s, b.end) : null
        if (name === 'alt' && b) {
          sub(a.content, { ...m, vis: intersect(m.vis, spec) })
          sub(b.content, { ...m, vis: intersect(m.vis, spec ? complement(spec, false) : { ranges: [], reserve: false }) })
          i = b.end
          continue
        }
        if (d && spec) {
          const lo = firstStep(spec), hi = Math.max(...spec.ranges.map(r => r[1]))
          sub(a.content, { ...m, vis: intersect(m.vis, lo > 1 ? { ranges: [[1, lo - 1]], reserve: false } : { ranges: [], reserve: false }) })
          sub(b.content, { ...m, vis: intersect(m.vis, { ...spec, reserve: false }) })
          sub(d.content, { ...m, vis: intersect(m.vis, hi < INF ? { ranges: [[hi + 1, INF]], reserve: false } : { ranges: [], reserve: false }) })
          i = d.end
          continue
        }
      }
      const v = name === 'invisible' ? complement(spec, true) : spec
      sub(a.content, { ...m, vis: intersect(m.vis, v) })
      i = a.end
      continue
    }
    if (name === 'parallaxverb' || name === 'parallaxverbatim') {
      const a = reqArg(s, j)
      if (a) {
        let raw = st.doc.verbatim[+a.content] ?? ''
        if (name === 'parallaxverbatim') raw = codeOf(raw).text
        flush()
        runs.push({ t: 'text', text: raw, m: { ...m, tt: true } })
        i = a.end
        continue
      }
    }
    if (name === 'ref' || name === 'eqref' || name === 'autoref' || name === 'cref' || name === 'Cref' || name === 'pageref') {
      const a = reqArg(s, j)
      st.warn('ref', 'References to labels (\\ref, \\eqref) can’t be numbered here, so they show as “?”')
      text += name === 'eqref' ? '(?)' : '?'
      i = a ? a.end : j
      continue
    }
    if (name === 'today') { text += today(); i = past(); continue }
    if (name === 'and') {
      // Authors, listed: no space before the comma, wherever it is
      text = text.replace(/[ \t\n]+$/, '')
      const last = runs[runs.length - 1]
      if (!text && last && last.t === 'text') last.text = last.text.replace(/[ \t\n]+$/, '')
      text += ', '
      i = past()
      continue
    }
    if (name === 'insertsection' || name === 'insertsectionhead' || name === 'insertsubsection' || name === 'insertsubsectionhead') {
      text += name.includes('sub') ? st.subsection || '' : st.section || ''
      i = past()
      continue
    }
    if (name === 'ding') {
      const a = reqArg(s, j)
      if (a) { text += DINGS[parseInt(a.content, 10)] || '•'; i = a.end; continue }
    }
    if (name === 'hspace' || name === 'hspace*') {
      const a = reqArg(s, s[j] === '*' ? j + 1 : j)
      text += ' '
      i = a ? a.end : j
      continue
    }
    if (BOXES[name]) {
      let k = j, mm = m
      for (const kind of BOXES[name]) {
        if (kind === 'o') { const o = optArg(s, k); if (o) k = o.end; continue }
        const a = reqArg(s, k)
        if (!a) break
        k = a.end
        if (kind === 'a') {
          if (name === 'scalebox' && mm.scale === m.scale) mm = { ...mm, scale: (parseFloat(a.content) || 1) * (m.scale || 1) }
          if (name === 'resizebox' && !mm.boxWidth) mm = { ...mm, boxWidth: a.content.trim() }
          if (name === 'colorbox' || (name === 'fcolorbox' && mm.hlFrame)) mm = { ...mm, hl: resolveColor(a.content, st.doc.colors) || '#fff3a0' }
          if (name === 'fcolorbox') mm = { ...mm, hlFrame: true }
          continue
        }
        if (name === 'centerline') ix.align = 'center'
        sub(a.content, { ...mm, hlFrame: undefined })
      }
      i = k
      continue
    }
    if (name === 'begin' && s[j] === '{') {
      const g = readGroup(s, j)
      const env = g.content.trim()
      const { inner, end } = findEnd(s, g.end, env)
      flush()
      if (MATH_ENVS.has(env)) runs.push({ t: 'math', tex: mathEnvTex(env, inner), display: true, m: { ...m } })
      else if (env === 'math') runs.push({ t: 'math', tex: cleanMath(inner), display: false, m: { ...m } })
      else if (LISTS.has(env)) {
        for (const item of splitTop(inner, commandTest('item')).slice(1)) {
          runs.push({ t: 'br' })
          runs.push({ t: 'text', text: '• ', m: { ...m } })
          inline(item.replace(/^\s*<[^>]*>/, '').replace(/^\s*\[[^\]]*\]/, ''), m, runs, ix)
        }
      } else if (env !== 'comment') sub(inner, m)
      i = end
      continue
    }
    if (name === 'end' && s[j] === '{') { i = readGroup(s, j).end; continue }
    if (Object.hasOwn(SKIP, name)) {
      // Its arguments, and options before or between them (\setbeamertemplate{…}[…])
      let k = j
      if (s[k] === '*') k++
      const options = () => { for (;;) { const o = s[skipSpace(s, k)] === '[' ? optArg(s, k) : null; if (!o) break; k = o.end } }
      options()
      for (let n = 0; n < SKIP[name]; n++) {
        // After the first, only braced arguments: \setbeamertemplate{…}[…] has one
        if (n > 0 && s[skipSpace(s, k)] !== '{') break
        const a = reqArg(s, k)
        if (!a) break
        k = a.end
        if (s[k] === '[') options()
      }
      i = k
      continue
    }
    if (name === 'xspace') {
      // A space, unless punctuation follows
      if (/^[A-Za-z0-9(\\]/.test(s.slice(skipSpace(s, j), skipSpace(s, j) + 1))) text += ' '
      i = past()
      continue
    }
    if (NOOP.has(name) || name === '') {
      const o = name === 'pause' ? optArg(s, j) : null
      i = o ? o.end : past()
      continue
    }
    // Not known: its text, if it has any
    let k = skipSpace(s, j)
    for (let n = 0; n < 3 && s[k] === '['; n++) { const o = readBracket(s, k); if (!o) break; k = skipSpace(s, o.end) }
    if (s[k] === '{') {
      let last = readGroup(s, k)
      while (s[skipSpace(s, last.end)] === '{' && !/\n\s*\n/.test(s.slice(last.end, skipSpace(s, last.end)))) last = readGroup(s, skipSpace(s, last.end))
      st.warn('cmd:' + name, `\\${name} isn’t known here, so only its text was kept`)
      sub(last.content, m)
      i = last.end
      continue
    }
    st.warn('cmd:' + name, `\\${name} isn’t known here, so it was left out`)
    i = past()
  }
  flush()
}

// Text as runs, for titles, labels and table cells
function inlineRuns(tex, st, marks = {}) {
  const runs = []
  inline(tex || '', marks, runs, { st, align: null })
  return runs
}

// ── Blocks ──────────────────────────────────────────────────────────────────
// What makes a group's content more than a paragraph's worth
const BLOCKISH = /\\begin\{(itemize|enumerate|description|equation\*?|align\*?|gather\*?|multline\*?|eqnarray\*?|displaymath|center|flushleft|flushright|columns|block|alertblock|exampleblock|theorem|definition|lemma|corollary|proof|example|examples|figure|table|tabular\*?|tabularx|tikzpicture|minipage|quote|quotation|verse|onlyenv|uncoverenv|visibleenv|overprint)\}|\\(item|pause|par|titlepage|maketitle|tableofcontents|parallaxverbatim|column)(?![A-Za-z])|\\\[|\$\$|\n[ \t]*\n/

const BOX_ENVS = { block: 'block', alertblock: 'alert', exampleblock: 'example' }
const THEOREMS = {
  theorem: 'Theorem', definition: 'Definition', definitions: 'Definitions', lemma: 'Lemma', corollary: 'Corollary', proof: 'Proof',
  example: 'Example', examples: 'Examples', fact: 'Fact', proposition: 'Proposition', remark: 'Remark', conjecture: 'Conjecture',
  claim: 'Claim', exercise: 'Exercise', solution: 'Solution', problem: 'Problem', assumption: 'Assumption', observation: 'Observation',
  note: 'Note', question: 'Question', answer: 'Answer',
}
const TABULARS = new Set(['tabular', 'tabular*', 'tabularx', 'tabulary', 'longtable', 'array'])

// Paragraph text as blocks: its words, and its pictures (one row where they
// stand side by side)
function paraBlocks(src, st, scope, vis) {
  const ix = { st, align: null }
  const runs = []
  inline(src, scope.marks || {}, runs, ix)
  const align = ix.align || scope.align || null
  const out = []
  let cur = [], row = null
  const pushText = () => {
    while (cur.length && cur[cur.length - 1].t === 'br') cur.pop()
    if (cur.some(r => r.t !== 'br' && (r.t !== 'text' || r.text.trim()))) out.push(textBlock(cur, align, vis, st))
    cur = []
  }
  for (const r of runs) {
    if (r.t === 'img') {
      pushText()
      if (!row) { row = { kind: 'images', items: [], align, vis }; out.push(row) }
      row.items.push({ path: r.path, opts: r.opts, vis: r.vis, scale: r.m.scale || 1, boxWidth: r.m.boxWidth || null })
      continue
    }
    if (row && (r.t === 'br' || (r.t === 'text' && !r.text.trim()))) { if (r.t === 'br') row = null; continue }
    row = null
    if (r.t === 'br' && !cur.length) continue
    cur.push(r)
  }
  pushText()
  return out
}

// A paragraph's block. Where all its text shows at once, that's the block's
// vis; where parts come at different steps, the frame needs a slide per step.
function textBlock(runs, align, vis, st) {
  const shown = runs.filter(r => r.t !== 'br' && (r.t !== 'text' || r.text.trim()))
  const key = v => JSON.stringify(v || null)
  const same = shown.every(r => key(r.m?.vis) === key(shown[0].m?.vis))
  if (same && shown[0]?.m?.vis) {
    const v = shown[0].m.vis
    return { kind: 'para', runs: runs.map(r => r.m ? { ...r, m: { ...r.m, vis: undefined } } : r), align, vis: intersect(vis, v) }
  }
  if (!same) st.mixed = true
  return { kind: 'para', runs, align, vis }
}

function codeOf(raw) {
  const head = /^\\begin\{([^}]*)\}/.exec(raw)
  if (!head) return { text: raw, language: 'plaintext' }
  const env = head[1]
  let i = head[0].length, language = 'plaintext'
  const o = optArg(raw, i)
  if (o) {
    i = o.end
    const lang = parseKeyval(o.content).language
    if (lang) language = lang
  }
  if (env === 'minted') { const a = reqArg(raw, i); if (a) { language = a.content; i = a.end } }
  const close = raw.lastIndexOf('\\end{')
  let text = raw.slice(i, close < i ? raw.length : close)
  text = text.replace(/^[ \t]*\n/, '').replace(/\s+$/, '')
  // Beamer's semiverbatim keeps \\, \{ and \} as commands
  if (env === 'semiverbatim') text = text.replace(/\\([{}\\])/g, '$1')
  const lang = String(language).replace(/[[\]{}]/g, '').toLowerCase()
  const LANGS = { 'c++': 'cpp', 'c#': 'csharp', sh: 'bash', shell: 'bash', tex: 'latex', 'python3': 'python', py: 'python', js: 'javascript', matlab: 'matlab', octave: 'matlab' }
  return { text, language: LANGS[lang] || lang || 'plaintext' }
}

function parseTabular(env, s, st, scope, raw) {
  let i = 0
  const pos = optArg(s, 0)
  if (pos) i = pos.end
  if (env === 'tabular*' || env === 'tabularx' || env === 'tabulary') { const w = reqArg(s, i); if (w) i = w.end }
  const spec = reqArg(s, i)
  if (spec) i = spec.end
  const aligns = []
  const cols = (spec ? spec.content : '').replace(/\*\{(\d+)\}\{([^}]*)\}/g, (t, n, x) => x.repeat(+n)).replace(/[@!<>]\{[^}]*\}/g, '').replace(/\{[^}]*\}/g, '')
  for (const ch of cols) {
    if ('lcrX'.includes(ch)) aligns.push(ch === 'c' ? 'center' : ch === 'r' ? 'right' : 'left')
    else if ('pmb'.includes(ch)) aligns.push('left')
  }
  const RULE = /\\(hline|toprule|midrule|bottomrule|hhline|specialrule|cline|cmidrule|addlinespace|morecmidrules|rowcolor|rowcolors|arrayrulecolor|endhead|endfirsthead|endfoot|endlastfoot)(?![A-Za-z])(\([^)]*\))?(\[[^\]]*\])?(\{[^}]*\})*/g
  const lines = splitTop(s.slice(i), (t, k) => t.startsWith('\\\\', k) ? 2 : t.startsWith('\\tabularnewline', k) ? 15 : 0)
  const rows = []
  let ruleAfterFirst = false
  for (let line of lines) {
    line = line.replace(/^\s*\[[^\]]*\]/, '')
    const hadRule = RULE.test(line)
    RULE.lastIndex = 0
    const body = line.replace(RULE, '')
    if (rows.length === 1 && hadRule && /^\s*\\(midrule|hline|cmidrule)/.test(line)) ruleAfterFirst = true
    if (!body.trim()) continue
    const cells = []
    for (let cell of splitTop(body, (t, k) => t[k] === '&' ? 1 : 0)) {
      let span = 1
      const mc = /^\s*\\multicolumn\s*\{(\d+)\}\s*\{[^}]*\}\s*/.exec(cell)
      if (mc) { span = +mc[1]; cell = (reqArg(cell, mc[0].length) || { content: '' }).content }
      const mr = /^\s*\\multirow\s*(\[[^\]]*\])?\s*\{[^}]*\}\s*(\[[^\]]*\])?\s*\{[^}]*\}\s*/.exec(cell)
      if (mr) cell = (reqArg(cell, mr[0].length) || { content: '' }).content
      cells.push({ tex: cell.trim(), runs: inlineRuns(cell.trim(), st, scope.marks), span })
    }
    rows.push(cells)
  }
  return { kind: 'table', rows, aligns, header: ruleAfterFirst && rows.length > 1, raw, align: scope.align }
}

function parseList(env, s, st, scope, vis) {
  let i = 0
  const ov = overlayAt(s, 0)
  if (ov) i = ov.end
  const o = optArg(s, i)
  if (o) i = o.end
  const listScope = { ...scope, vis: intersect(scope.vis, ov ? specVis(ov.content) : null), marks: { ...scope.marks } }
  const body = s.slice(i)
  const parts = splitTop(body, commandTest('item'))
  // A size before the first \item is the whole list's
  const size = [...parts[0].matchAll(/\\(tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)(?![A-Za-z])/g)].pop()
  if (size) listScope.marks.size = SIZES[size[1]]
  const items = parts.slice(1).map(part => {
    let k = 0
    const iov = overlayAt(part, 0)
    if (iov) k = iov.end
    const lab = optArg(part, k)
    if (lab) k = lab.end
    const itemScope = { ...listScope, vis: intersect(listScope.vis, iov ? specVis(iov.content) : null) }
    const itemVis = intersect(st.current, itemScope.vis)
    return {
      vis: itemVis,
      label: lab ? inlineRuns(lab.content, st, listScope.marks) : null,
      blocks: parseBlocks(part.slice(k), st, itemScope),
    }
  })
  return { kind: 'list', type: env.replace('*', ''), items, vis, marks: listScope.marks }
}

function parseColumns(s, st, scope, vis) {
  const o = optArg(s, 0)
  const opts = o ? o.content : ''
  const body = s.slice(o ? o.end : 0)
  const raw = []
  if (/\\begin\{column\}/.test(body)) {
    let k = 0
    for (;;) {
      const b = body.indexOf('\\begin{column}', k)
      if (b < 0) break
      let j = b + '\\begin{column}'.length
      const pos = optArg(body, j)
      if (pos) j = pos.end
      const w = reqArg(body, j)
      if (w) j = w.end
      const { inner, end } = findEnd(body, j, 'column')
      raw.push({ width: w ? w.content : null, valign: pos ? pos.content.trim() : null, content: inner })
      k = end
    }
  } else {
    for (const part of splitTop(body, commandTest('column')).slice(1)) {
      let j = 0
      const pos = optArg(part, 0)
      if (pos) j = pos.end
      const w = reqArg(part, j)
      raw.push({ width: w ? w.content : null, valign: pos ? pos.content.trim() : null, content: part.slice(w ? w.end : j) })
    }
  }
  const valign = /(^|,)\s*[tT]\s*(,|$)/.test(opts) ? 'top' : /(^|,)\s*b\s*(,|$)/.test(opts) ? 'bottom' : 'center'
  return {
    kind: 'columns', valign, vis,
    cols: raw.map(c => ({ width: parseLength(c.width), valign: c.valign === 't' || c.valign === 'T' ? 'top' : c.valign === 'b' ? 'bottom' : null, blocks: parseBlocks(c.content, st, { ...scope }) })),
  }
}

// Side-by-side minipages, as columns
function mergeMinipages(blocks) {
  const out = []
  for (const b of blocks) {
    if (b.kind === 'minipage') {
      const prev = out[out.length - 1]
      const col = { width: b.width, valign: b.valign, blocks: b.blocks }
      if (prev && prev.kind === 'columns' && prev.fromMinipages) prev.cols.push(col)
      else out.push({ kind: 'columns', fromMinipages: true, valign: 'center', vis: b.vis, cols: [col] })
      continue
    }
    out.push(b)
  }
  return out
}

// A TikZ picture as TikZJax takes it: Beamer's overlay commands keep what
// they hold, without saying when
function tikzSource(tex) {
  let out = tex.replace(/\\pause(\[\d+\])?/g, '').replace(/\\onslide\s*<[^<>]*>/g, '')
  out = out.replace(/\\(only|uncover|visible|invisible|alert|structure)\s*<[^<>]*>/g, '\\$1')
  out = out.replace(/\\(only|uncover|visible)(?![A-Za-z])/g, '').replace(/\\invisible(?![A-Za-z])\s*\{/g, '\\phantom{').replace(/\\(alert|structure)(?![A-Za-z])/g, '\\textbf')
  return out.replace(/,?\s*visible on=<[^<>]*>/g, '')
}

function parseBlocks(s, st, scope) {
  scope = { ...scope, marks: { ...(scope.marks || {}) } }
  const blocks = []
  let para = '', pending = null
  const now = () => intersect(st.current, scope.vis)
  const flush = () => {
    if (para.trim()) blocks.push(...paraBlocks(para.trim(), st, scope, now()))
    para = ''
    if (pending) { scope.marks = { ...scope.marks, ...pending }; pending = null }
  }
  const declare = changes => { pending = { ...(pending || {}), ...changes } }
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '\n') {
      let j = i + 1
      while (s[j] === ' ' || s[j] === '\t' || s[j] === '\r') j++
      if (s[j] === '\n') { flush(); i = j + 1; continue }
      para += '\n'
      i++
      continue
    }
    if (c === '$' && s[i + 1] === '$') {
      const close = mathEnd(s, i + 2, true)
      flush()
      blocks.push({ kind: 'math', tex: cleanMath(s.slice(i + 2, close)), vis: now(), marks: scope.marks })
      i = close + 2
      continue
    }
    if (c === '{') {
      const g = readGroup(s, i)
      if (BLOCKISH.test(g.content)) { flush(); blocks.push(...parseBlocks(g.content, st, scope)) } else para += s.slice(i, g.end)
      i = g.end
      continue
    }
    if (c !== '\\') { para += c; i++; continue }

    const cmd = readCommand(s, i)
    const name = cmd.name
    let j = cmd.end
    if (name === '[') {
      const close = s.indexOf('\\]', j)
      const end = close < 0 ? s.length : close
      flush()
      blocks.push({ kind: 'math', tex: cleanMath(s.slice(j, end)), vis: now(), marks: scope.marks })
      i = end + 2
      continue
    }
    if (name === 'pause') {
      const o = optArg(s, j)
      flush()
      st.current = { ranges: [[o ? parseInt(o.content, 10) || 1 : 2, INF]], reserve: true }
      i = o ? o.end : j
      continue
    }
    if (name === 'onslide' || name === 'only' || name === 'uncover' || name === 'visible' || name === 'invisible' || name === 'alt' || name === 'temporal') {
      const ov = overlayAt(s, j)
      const k = skipSpace(s, ov ? ov.end : j)
      if (name === 'onslide' && s[k] !== '{') {
        flush()
        st.current = ov ? specVis(ov.content) : null
        i = ov ? ov.end : j
        continue
      }
      const groups = []
      let e = ov ? ov.end : j
      for (let n = 0; n < (name === 'alt' ? 2 : name === 'temporal' ? 3 : 1); n++) {
        const a = reqArg(s, e)
        if (!a) break
        groups.push(a.content)
        e = a.end
      }
      if (groups.length && groups.some(g => BLOCKISH.test(g)) && name !== 'temporal') {
        flush()
        const reserve = name !== 'only' && name !== 'alt'
        const spec = ov ? specVis(ov.content, reserve) : null
        const shown = name === 'invisible' ? complement(spec, true) : spec
        blocks.push(...parseBlocks(groups[0], st, { ...scope, vis: intersect(scope.vis, shown) }))
        if (name === 'alt' && groups[1] != null) blocks.push(...parseBlocks(groups[1], st, { ...scope, vis: intersect(scope.vis, spec ? complement(spec, false) : { ranges: [], reserve: false }) }))
        i = e
        continue
      }
      para += s.slice(i, e)
      i = e
      continue
    }
    if (name === 'begin' && s[j] === '{') {
      const g = readGroup(s, j)
      const env = g.content.trim()
      const { inner, end } = findEnd(s, g.end, env)
      const vis = now()
      if (env === 'math') { para += '$' + inner + '$'; i = end; continue }
      flush()
      if (LISTS.has(env) || env === 'itemize*' || env === 'enumerate*') blocks.push(parseList(env, inner, st, scope, vis))
      else if (MATH_ENVS.has(env)) blocks.push({ kind: 'math', tex: mathEnvTex(env, inner), vis, marks: scope.marks })
      else if (env === 'center' || env === 'flushleft' || env === 'flushright') blocks.push(...parseBlocks(inner, st, { ...scope, align: env === 'center' ? 'center' : env === 'flushleft' ? 'left' : 'right' }))
      else if (env === 'columns') blocks.push(parseColumns(inner, st, scope, vis))
      else if (env === 'multicols' || env === 'multicols*') {
        const n = reqArg(inner, 0)
        const parts = splitTop(n ? inner.slice(n.end) : inner, commandTest('columnbreak'))
        blocks.push({ kind: 'columns', valign: 'top', vis, cols: parts.map(p => ({ width: { v: 1 / parts.length, unit: 'tw' }, blocks: parseBlocks(p, st, { ...scope }) })) })
      } else if (BOX_ENVS[env] || THEOREMS[env] || env === 'tcolorbox') {
        let k = 0
        const ov = overlayAt(inner, 0)
        if (ov) k = ov.end
        let title = null
        if (BOX_ENVS[env]) { const t = reqArg(inner, k); if (t && inner[skipSpace(inner, k)] === '{') { title = t.content; k = t.end } }
        else if (env === 'tcolorbox') { const o = optArg(inner, k); if (o) { title = parseKeyval(o.content).title || null; k = o.end } }
        else {
          const o = optArg(inner, k)
          title = THEOREMS[env] + (o ? ` (${o.content})` : '')
          if (o) k = o.end
        }
        const ov2 = overlayAt(inner, k)
        if (ov2) k = ov2.end
        const bscope = { ...scope, vis: intersect(scope.vis, specVis(ov?.content ?? ov2?.content ?? null)) }
        const bvis = intersect(st.current, bscope.vis)
        blocks.push({ kind: 'box', variant: BOX_ENVS[env] || (env === 'example' || env === 'examples' ? 'example' : 'block'), title: title != null ? inlineRuns(title, st, scope.marks) : null, theorem: !!THEOREMS[env], blocks: parseBlocks(inner.slice(k), st, bscope), vis: bvis })
      } else if (env === 'figure' || env === 'figure*' || env === 'table' || env === 'table*' || env === 'wrapfigure') {
        let k = 0
        const o = optArg(inner, 0)
        if (o) k = o.end
        if (env === 'wrapfigure') { const a = reqArg(inner, k); const w = a && reqArg(inner, a.end); if (w) k = w.end }
        blocks.push(...parseBlocks(inner.slice(k), st, { ...scope, align: 'center' }))
      } else if (TABULARS.has(env)) blocks.push({ ...parseTabular(env, inner, st, scope, s.slice(i, end)), vis })
      else if (env === 'tikzpicture' || env === 'circuitikz') blocks.push({ kind: 'tikz', tex: tikzSource(s.slice(i, end)), vis, align: scope.align })
      else if (env === 'minipage') {
        let k = 0
        for (let n = 0; n < 3; n++) { const o = optArg(inner, k); if (o) k = o.end; else break }
        const w = reqArg(inner, k)
        const valign = /^\s*\[\s*t/.test(inner) ? 'top' : null
        blocks.push({ kind: 'minipage', width: w ? parseLength(w.content) : null, valign, vis, blocks: parseBlocks(w ? inner.slice(w.end) : inner, st, { ...scope }) })
      } else if (env === 'quote' || env === 'quotation' || env === 'verse') blocks.push({ kind: 'quote', blocks: parseBlocks(inner, st, scope), vis })
      else if (env === 'onlyenv' || env === 'uncoverenv' || env === 'visibleenv' || env === 'invisibleenv' || env === 'altenv') {
        const ov = overlayAt(inner, 0)
        const spec = ov ? specVis(ov.content, env !== 'onlyenv') : null
        blocks.push(...parseBlocks(ov ? inner.slice(ov.end) : inner, st, { ...scope, vis: intersect(scope.vis, env === 'invisibleenv' ? complement(spec, true) : spec) }))
      } else if (env === 'overprint' || env === 'overlayarea') {
        let rest = inner
        if (env === 'overlayarea') { const a = reqArg(rest, 0); const b = a && reqArg(rest, a.end); if (b) rest = rest.slice(b.end) } else { const o = optArg(rest, 0); if (o) rest = rest.slice(o.end) }
        const area = (t, k) => { const m = /^\\onslide\s*<[^<>]*>/.exec(t.slice(k, k + 40)); return m ? m[0].length : 0 }
        const parts = splitTop(rest, area)
        const heads = topLevel(rest, area)
        blocks.push(...parseBlocks(parts[0], st, scope))
        heads.forEach((h, n) => {
          const spec = /<([^>]*)>/.exec(rest.slice(h.at, h.at + h.len))
          blocks.push(...parseBlocks(parts[n + 1], st, { ...scope, vis: intersect(scope.vis, specVis(spec ? spec[1] : null, false)) }))
        })
      } else if (env === 'thebibliography') {
        const parts = splitTop(inner, commandTest('bibitem'))
        for (const part of parts.slice(1)) {
          let k = 0
          const o = optArg(part, 0)
          if (o) k = o.end
          const key = reqArg(part, k)
          if (key) st.doc.bibItems.push({ key: key.content.trim(), text: plainText(inlineRuns(part.slice(key.end), st)) })
        }
        st.bibliography = true
      } else if (env === 'abstract' || env === 'document' || env === 'frame' || env === 'small' || env === 'footnotesize' || env === 'scriptsize' || env === 'large' || env === 'Large') {
        blocks.push(...parseBlocks(inner, st, SIZES[env] ? { ...scope, marks: { ...scope.marks, size: SIZES[env] } } : scope))
      } else if (env !== 'comment') {
        st.warn('env:' + env, `\\begin{${env}} isn’t known here, so only what it holds was kept`)
        blocks.push(...parseBlocks(inner, st, scope))
      }
      i = end
      continue
    }
    if (name === 'parallaxverbatim') {
      const a = reqArg(s, j)
      flush()
      if (a) blocks.push({ kind: 'code', ...codeOf(st.doc.verbatim[+a.content] ?? ''), vis: now() })
      i = a ? a.end : j
      continue
    }
    if (name === 'titlepage' || name === 'maketitle') { flush(); blocks.push({ kind: 'titlepage', vis: now() }); i = j; continue }
    if (name === 'tableofcontents') {
      const o = optArg(s, j)
      flush()
      blocks.push({ kind: 'toc', options: parseKeyval(o ? o.content : ''), vis: now() })
      i = o ? o.end : j
      continue
    }
    if (name === 'note') {
      const ov = overlayAt(s, j)
      const o = optArg(s, ov ? ov.end : j)
      const a = reqArg(s, o ? o.end : ov ? ov.end : j)
      if (a) st.notes.push(noteText(a.content, st, o?.content))
      i = a ? a.end : j
      continue
    }
    if (name === 'caption') {
      const o = optArg(s, j)
      const a = reqArg(s, o ? o.end : j)
      flush()
      if (a) blocks.push({ kind: 'para', runs: inlineRuns(a.content, st, { ...scope.marks, size: (scope.marks.size || 1) * 0.85 }), align: 'center', vis: now(), caption: true })
      i = a ? a.end : j
      continue
    }
    if (name === 'bibliography' || name === 'printbibliography' || name === 'addbibresource') {
      const o = optArg(s, j)
      const a = name === 'printbibliography' ? null : reqArg(s, o ? o.end : j)
      if (a) st.doc.bibFiles.push(...a.content.split(',').map(x => x.trim()).filter(Boolean))
      st.bibliography = true
      i = a ? a.end : o ? o.end : j
      continue
    }
    if (name === 'par' || name === 'vfill' || name === 'bigskip' || name === 'medskip' || name === 'smallskip' || name === 'newpage' || name === 'clearpage' || name === 'framebreak' || name === 'pagebreak' || name === 'vfil') { flush(); i = j; continue }
    if (name === 'vspace' || name === 'vskip') {
      if (s[j] === '*') j++
      const a = name === 'vspace' ? reqArg(s, j) : null
      flush()
      i = a ? a.end : j
      continue
    }
    if (name === 'centering' || name === 'raggedright' || name === 'raggedleft') {
      scope.align = name === 'centering' ? 'center' : name === 'raggedright' ? 'left' : 'right'
      i = skipSpace(s, j)
      continue
    }
    if (SIZES[name] || DECLARED[name]) {
      para += '\\' + name + ' '
      declare(SIZES[name] ? { size: SIZES[name] } : DECLARED[name])
      i = j
      continue
    }
    if (name === 'color') {
      const model = optArg(s, j)
      const a = reqArg(s, model ? model.end : j)
      if (a) {
        para += s.slice(i, a.end)
        const col = resolveColor(a.content, st.doc.colors, model?.content)
        if (col) declare({ color: col })
        i = a.end
        continue
      }
    }
    if (BOXES[name] && name !== 'colorbox' && name !== 'fcolorbox') {
      let k = j, content = null, mm = scope.marks
      for (const kind of BOXES[name]) {
        if (kind === 'o') { const o = optArg(s, k); if (o) k = o.end; continue }
        const a = reqArg(s, k)
        if (!a) break
        k = a.end
        if (kind === 'a') {
          if (name === 'scalebox') mm = { ...mm, scale: (parseFloat(a.content) || 1) * (mm.scale || 1) }
          if (name === 'resizebox' && !mm.boxWidth) mm = { ...mm, boxWidth: a.content.trim() }
        } else content = a.content
      }
      if (content != null && BLOCKISH.test(content)) {
        flush()
        blocks.push(...parseBlocks(content, st, { ...scope, marks: mm, align: name === 'centerline' ? 'center' : scope.align }))
      } else para += s.slice(i, k)
      i = k
      continue
    }
    if (name === 'item') { i = j; continue }
    if (name === 'frametitle' || name === 'framesubtitle') {
      const o = optArg(s, j)
      const a = reqArg(s, o ? o.end : j)
      i = a ? a.end : j
      continue
    }
    // Anything else is text: the command, and the arguments right after it
    let k = j
    if (isLetter(name[0])) {
      for (;;) {
        if (s[k] === '*' && k === j) { k++; continue }
        if (s[k] === '<') { const ov = overlayAt(s, k); if (ov) { k = ov.end; continue } }
        if (s[k] === '[') { const o = readBracket(s, k); if (o) { k = o.end; continue } }
        if (s[k] === '{') { k = readGroup(s, k).end; continue }
        break
      }
    }
    para += s.slice(i, k)
    i = k
  }
  flush()
  return mergeMinipages(blocks)
}

// ── Notes and plain text ────────────────────────────────────────────────────
export function plainText(runs) {
  return (runs || []).map(r => r.t === 'text' ? r.text : r.t === 'math' ? `$${r.tex}$` : r.t === 'cite' ? `[${r.keys.join(', ')}]` : r.t === 'br' ? '\n' : '')
    .join('').replace(new RegExp(NBSP, 'g'), ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim()
}

function blocksText(blocks, depth = 0) {
  const lines = []
  for (const b of blocks || []) {
    if (b.kind === 'para') lines.push(plainText(b.runs))
    else if (b.kind === 'math') lines.push(`$$${b.tex}$$`)
    else if (b.kind === 'list') b.items.forEach((it, k) => {
      const [first, ...rest] = blocksText(it.blocks, depth + 1)
      const mark = it.label ? plainText(it.label) : b.type === 'enumerate' ? `${k + 1}.` : '•'
      lines.push('  '.repeat(depth) + mark + ' ' + (first || '').trim(), ...rest)
    })
    else if (b.blocks) lines.push(...blocksText(b.blocks, depth))
    else if (b.cols) b.cols.forEach(c => lines.push(...blocksText(c.blocks, depth)))
  }
  return lines.filter(l => l.trim())
}

function noteText(tex, st, opt) {
  const sub = { ...st, current: null, footnotes: [], notes: [], warn: () => {} }
  const text = blocksText(parseBlocks(tex, sub, { vis: null, marks: {}, align: null })).join('\n')
  return opt && /item/.test(opt) ? '• ' + text : text
}

// ── The document ────────────────────────────────────────────────────────────
// Beamer's frame sizes in millimeters, by aspectratio
const ASPECTS = { 169: [160, 90], 1610: [160, 100], 149: [140, 90], 141: [148.5, 105], 54: [125, 100], 43: [128, 96], 32: [135, 90], 1609: [160, 90] }

function documentClass(preamble) {
  const m = /\\documentclass\s*(?:\[([^\]]*)\])?\s*\{([^}]*)\}/.exec(preamble)
  const opts = parseKeyval(m && m[1] ? m[1] : '')
  const ratio = ASPECTS[opts.aspectratio] || ASPECTS[43]
  const pt = Object.keys(opts).map(k => /^(\d+)pt$/.exec(k)).find(Boolean)
  return {
    name: m ? m[2].trim() : null,
    width: ratio[0], height: ratio[1],
    pt: pt ? +pt[1] : 11,
    top: !!opts.t,
    handout: !!opts.handout,
  }
}

// The first \name[short]{long} in s, as its long form
function firstArg(s, name) {
  const re = new RegExp('\\\\' + name + '(?![A-Za-z])', 'g')
  const m = re.exec(s)
  if (!m) return null
  let j = re.lastIndex
  const ov = overlayAt(s, j)
  if (ov) j = ov.end
  const o = optArg(s, j)
  const a = reqArg(s, o ? o.end : j)
  return a ? a.content : null
}

function readColors(text) {
  const colors = {}
  for (const m of text.matchAll(/\\definecolor\s*\{([^}]*)\}\s*\{([^}]*)\}\s*\{([^}]*)\}/g)) colors[m[1].trim()] = { model: m[2].trim(), spec: m[3] }
  for (const m of text.matchAll(/\\colorlet\s*\{([^}]*)\}\s*\{([^}]*)\}/g)) colors[m[1].trim()] = { model: null, spec: m[2] }
  return colors
}

// \setbeamercolor{structure}{fg=…} and the like, for the look's colors
function readBeamerColors(text, colors) {
  const out = {}
  const ROLES = { structure: 'structure', 'frametitle': 'title', title: 'title', 'alerted text': 'alert', 'example text': 'example', 'normal text': 'text', 'block title': 'blockTitle' }
  for (const m of text.matchAll(/\\setbeamercolor\*?\s*\{([^}]*)\}\s*\{([^}]*)\}/g)) {
    const role = ROLES[m[1].trim()]
    if (!role) continue
    const kv = parseKeyval(m[2])
    const fg = kv.fg ? resolveColor(kv.fg, colors) : null
    if (fg && !fg.startsWith('@')) out[role] = fg
    if (role === 'text' && kv.bg) { const bg = resolveColor(kv.bg, colors); if (bg && !bg.startsWith('@')) out.background = bg }
  }
  for (const m of text.matchAll(/\\usecolortheme\s*(?:\[([^\]]*)\])?\s*\{([^}]*)\}/g)) {
    const kv = parseKeyval(m[1] || '')
    if (kv['named']) { const c = resolveColor(kv.named, colors); if (c && !c.startsWith('@')) out.structure = c }
    if (kv.rgb) { const c = resolveColor(kv.rgb, colors, 'rgb'); if (c) out.structure = c }
    if (kv.RGB) { const c = resolveColor(kv.RGB, colors, 'RGB'); if (c) out.structure = c }
  }
  return out
}

// A frame's opening: <overlay>[<default overlay>][options]{title}{subtitle}
function frameHead(s, j, withTitle) {
  let def = null, options = ''
  const ov = overlayAt(s, j)
  if (ov) j = ov.end
  for (let n = 0; n < 2; n++) {
    const o = optArg(s, j)
    if (!o) break
    if (/^\s*<[^<>]*>\s*$/.test(o.content)) def = o.content.trim().slice(1, -1)
    else options = o.content
    j = o.end
    const ov2 = overlayAt(s, j)
    if (ov2) j = ov2.end
  }
  let title = null, subtitle = null
  if (withTitle) {
    const k = skipSpace(s, j)
    if (s[k] === '{') {
      const t = readGroup(s, k)
      title = t.content
      j = t.end
      const k2 = skipSpace(s, j)
      if (s[k2] === '{') { const u = readGroup(s, k2); subtitle = u.content; j = u.end }
    }
  }
  return { def, options: parseKeyval(options), title, subtitle, end: j }
}

// The frames, sections and hooks in a document's body, in order
function bodyItems(body, warn) {
  const items = []
  let outside = ''
  let i = 0
  for (;;) {
    const k = body.indexOf('\\', i)
    if (k < 0) { outside += body.slice(i); break }
    outside += body.slice(i, k)
    const cmd = readCommand(body, k)
    let j = cmd.end
    const name = cmd.name
    if (name === 'begin' && body.startsWith('{frame}', j)) {
      const head = frameHead(body, j + 7, true)
      const { inner, end } = findEnd(body, head.end, 'frame')
      items.push({ type: 'frame', ...head, body: inner, notes: [] })
      i = end
      continue
    }
    if (name === 'frame') {
      const head = frameHead(body, j, false)
      const a = reqArg(body, head.end)
      if (a) { items.push({ type: 'frame', ...head, body: a.content, notes: [] }); i = a.end; continue }
    }
    if (name === 'section' || name === 'subsection') {
      const star = body[j] === '*'
      if (star) j++
      const o = optArg(body, j)
      const a = reqArg(body, o ? o.end : j)
      if (a) { items.push({ type: name, star, name: a.content, short: o ? o.content : null }); i = a.end; continue }
    }
    if (name === 'AtBeginSection' || name === 'AtBeginSubsection') {
      const o = optArg(body, j)
      const a = reqArg(body, o ? o.end : j)
      if (a) { items.push({ type: 'hook', of: name === 'AtBeginSection' ? 'section' : 'subsection', body: a.content }); i = a.end; continue }
    }
    if (name === 'againframe') {
      const ov = overlayAt(body, j)
      const o = optArg(body, ov ? ov.end : j)
      const a = reqArg(body, o ? o.end : ov ? ov.end : j)
      if (a) { items.push({ type: 'again', label: a.content.trim() }); i = a.end; continue }
    }
    if (name === 'maketitle' || name === 'titlepage') {
      // Outside a frame, a title frame of its own, as metropolis makes it
      items.push({ type: 'frame', def: null, options: { plain: true }, title: null, subtitle: null, body: '\\titlepage', notes: [] })
      i = j
      continue
    }
    if (name === 'note') {
      const o = optArg(body, j)
      const a = reqArg(body, o ? o.end : j)
      if (a) {
        const last = [...items].reverse().find(x => x.type === 'frame')
        if (last) last.notes.push({ tex: a.content, opt: o?.content })
        i = a.end
        continue
      }
    }
    outside += body.slice(k, j)
    i = j
  }
  return { items, outside }
}

// Reads a Beamer document, or just some frames, into
// { meta, size, frames, sections, bibFiles, bibItems, warnings }.
// files: other files the source names (\input), path → text.
export function readBeamer(source, { files = null } = {}) {
  const warnings = new Map()
  const warn = (key, message, frame) => {
    const w = warnings.get(key) || { message, frames: new Set() }
    if (frame) w.frames.add(frame)
    warnings.set(key, w)
  }
  const verbatim = []
  let text = String(source || '').replace(/\r\n?/g, '\n').replace(/\\(begin|end)\s+\{/g, '\\$1{')
  text = stripComments(text, verbatim)
  text = withInputs(text, files, verbatim, warn)
  const macros = new Map(), envs = new Map()
  text = takeDefinitions(text, macros, envs)
  text = expand(text, macros, envs, warn)

  const docAt = text.indexOf('\\begin{document}')
  const preamble = docAt >= 0 ? text.slice(0, docAt) : ''
  let body = docAt >= 0 ? text.slice(docAt + '\\begin{document}'.length) : text
  const endAt = body.indexOf('\\end{document}')
  if (endAt >= 0) body = body.slice(0, endAt)

  const { items, outside } = bodyItems(body, warn)
  const head = preamble + '\n' + outside
  const colors = readColors(text)
  const doc = {
    size: documentClass(preamble),
    colors,
    beamerColors: readBeamerColors(head, colors),
    verbatim,
    bibFiles: [],
    bibItems: [],
    graphicsPaths: [],
    sections: [],
    frames: [],
  }
  for (const m of head.matchAll(/\\addbibresource\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g)) doc.bibFiles.push(m[1].trim())
  for (const m of head.matchAll(/\\bibliography\s*\{([^}]*)\}/g)) doc.bibFiles.push(...m[1].split(',').map(x => x.trim()).filter(Boolean))
  // What TikZ pictures need from the preamble: libraries, styles, colors
  doc.tikzPreamble = [...preamble.matchAll(/\\(usetikzlibrary|usepgfplotslibrary|tikzset|pgfplotsset|tikzstyle|definecolor|colorlet)(?![A-Za-z])/g)].map(m => {
    let k = m.index + m[0].length
    for (;;) {
      const j = skipSpace(preamble, k)
      if (preamble[j] === '{') { k = readGroup(preamble, j).end; continue }
      if (preamble[j] === '[') { const b = readBracket(preamble, j); if (!b) break; k = b.end; continue }
      if (preamble[j] === '=' && m[1] === 'tikzstyle') { k = j + 1; continue }
      break
    }
    return preamble.slice(m.index, k)
  }).join('\n')
  const gp = firstArg(head, 'graphicspath')
  if (gp) for (const m of gp.matchAll(/\{([^}]*)\}/g)) doc.graphicsPaths.push(m[1].trim())

  const metaState = { doc, current: null, footnotes: [], notes: [], warn: (k, msg) => warn(k, msg), section: '', subsection: '' }
  const metaRuns = name => { const v = firstArg(head, name); return v != null ? inlineRuns(v, metaState) : null }
  const graphic = firstArg(head, 'titlegraphic')
  doc.meta = {
    title: metaRuns('title'),
    subtitle: metaRuns('subtitle'),
    author: metaRuns('author'),
    institute: metaRuns('institute'),
    date: metaRuns('date') || [{ t: 'text', text: today(), m: {} }],
    graphic: graphic ? paraBlocks(graphic, metaState, { marks: {} }, null).filter(b => b.kind === 'images') : [],
  }

  // Sections, for tables of contents
  for (const it of items) {
    if (it.type === 'section' && !it.star) doc.sections.push({ name: plainText(inlineRuns(it.short ?? it.name, metaState)), subsections: [] })
    if (it.type === 'subsection' && !it.star && doc.sections.length) doc.sections[doc.sections.length - 1].subsections.push(plainText(inlineRuns(it.short ?? it.name, metaState)))
  }

  // \AtBeginSection and \AtBeginSubsection: frames for each section's start
  const hooks = {}
  for (const it of bodyItems(preamble, warn).items) if (it.type === 'hook') hooks[it.of] = bodyItems(it.body, warn).items.filter(x => x.type === 'frame')
  let section = '', subsection = '', sectionIndex = -1
  const labeled = new Map()
  const emit = (it, extra = {}) => {
    const frame = readFrame(it, doc, { section, subsection, sectionIndex, number: doc.frames.length + 1, warn, ...extra })
    if (!frame) return
    if (it.options.label) labeled.set(String(it.options.label), it)
    doc.frames.push(frame)
  }
  for (const it of items) {
    if (it.type === 'hook') { hooks[it.of] = bodyItems(it.body, warn).items.filter(x => x.type === 'frame'); continue }
    if (it.type === 'section' || it.type === 'subsection') {
      const name = plainText(inlineRuns(it.name, metaState))
      if (it.type === 'section') { section = name; subsection = ''; if (!it.star) sectionIndex++ } else subsection = name
      if (!it.star) for (const h of hooks[it.type] || []) emit({ ...h, notes: [] }, { hook: true })
      continue
    }
    if (it.type === 'again') {
      const again = labeled.get(it.label)
      if (again) emit(again)
      else warn('again:' + it.label, `\\againframe{${it.label}} names no frame before it`)
      continue
    }
    if (it.type === 'frame') emit(it)
  }

  doc.warnings = [...warnings.values()].map(w => ({ message: w.message, frames: [...w.frames].sort((a, b) => a - b) }))
  return doc
}

function readFrame(it, doc, ctx) {
  let { title, subtitle } = it
  let body = it.body
  // \frametitle and \framesubtitle, wherever they are
  for (const which of ['frametitle', 'framesubtitle']) {
    const re = new RegExp('\\\\' + which + '(?![A-Za-z])')
    for (;;) {
      const m = re.exec(body)
      if (!m) break
      let j = m.index + m[0].length
      const ov = overlayAt(body, j)
      if (ov) j = ov.end
      const o = optArg(body, j)
      const a = reqArg(body, o ? o.end : j)
      if (!a) { body = body.slice(0, m.index) + body.slice(j); continue }
      if (which === 'frametitle') title = a.content
      else subtitle = a.content
      body = body.slice(0, m.index) + body.slice(a.end)
    }
  }
  const st = {
    doc,
    current: null,
    footnotes: [],
    notes: [],
    warn: (k, msg) => ctx.warn(k, msg, ctx.number),
    section: ctx.section,
    subsection: ctx.subsection,
    mixed: false,
    bibliography: false,
  }
  const resolved = resolveOverlays(body, it.def)
  const blocks = parseBlocks(resolved.text, st, { vis: null, marks: {}, align: null })
  // Notes in the frame, then those after it
  st.notes.push(...it.notes.map(n => noteText(n.tex, st, n.opt)))
  const titleRuns = title != null ? inlineRuns(title, st) : null
  const subtitleRuns = subtitle != null ? inlineRuns(subtitle, st) : null
  const empty = !blocks.length && !plainText(titleRuns) && !st.notes.length
  // A frame for the bibliography: Parallax makes the references slide itself
  if (empty || (st.bibliography && !blocks.length)) return null

  // When its parts show: all from some step on, or not
  let cumulative = !st.mixed
  const steps = resolved.steps
  const visit = v => { if (!isCumulative(v)) cumulative = false }
  const runsVis = runs => (runs || []).forEach(r => { if (r.m?.vis) cumulative = false })
  const walk = bs => bs.forEach(b => {
    visit(b.vis)
    if (b.runs) runsVis(b.runs)
    if (b.items) b.items.forEach(x => { visit(x.vis); if (x.blocks) walk(x.blocks) })
    if (b.blocks) walk(b.blocks)
    if (b.cols) b.cols.forEach(c => walk(c.blocks))
    if (b.rows) b.rows.forEach(r => r.forEach(c => runsVis(c.runs)))
  })
  walk(blocks)
  runsVis(titleRuns)
  runsVis(subtitleRuns)

  return {
    number: ctx.number,
    title: titleRuns,
    subtitle: subtitleRuns,
    options: it.options,
    blocks,
    notes: st.notes,
    footnotes: st.footnotes,
    section: ctx.section,
    subsection: ctx.subsection,
    sectionIndex: ctx.sectionIndex,
    hook: !!ctx.hook,
    steps,
    cumulative,
  }
}

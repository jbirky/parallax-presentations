// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A deck's theme stylesheet (deck.themeCss, the Themes panel's CSS tab):
// parsed into rules and written back out, never pasted as text, so only what
// these rules allow reaches a page. Every selector is scoped to a slide
// (.px-slide, utils/slideHooks.js), so a stylesheet can't restyle the
// editor's controls, the deck's buttons or the presenter view. The editor
// (setDocumentThemeCss), presented decks and the PDF (themeCssTag) all write
// what scopeThemeCss returns, so a deck changed by an old copy of the app, or
// imported as JSON, is checked each time it's drawn.
//
// Kept: rules, @media, @supports, @font-face, @keyframes (renamed px-<name>,
// so they can't replace the app's own), and @import of the font hosts decks
// already load. url() may be a data: image or font, an upload of this site,
// or a font host's. Dropped, and listed with their line so the CSS tab can
// say why: anything else, position: fixed (it leaves the slide in a
// presented deck), and identifiers written with \ escapes.

import parse from 'css-tree/parser'
import walk from 'css-tree/walker'
import generate from 'css-tree/generator'
import { SLIDE_CLASS } from './slideHooks'

export const MAX_THEME_CSS = 50000
export const MAX_THEME_RULES = 2000

const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com', 'fonts.cdnfonts.com', 'cdn.jsdelivr.net'])
const BLOCK_AT_RULES = new Set(['media', 'supports'])
const ROOTS = new Set(['html', 'body'])
const BLOCKED_PROPERTIES = new Set(['behavior', '-moz-binding'])
const BLOCKED_FUNCTIONS = new Set(['expression', 'element', '-moz-element'])
const URL_STRINGS = new Set(['image-set', '-webkit-image-set'])

// Whether a url() (or an image-set() string) may load: a data: image or
// font, this site's uploads and fonts, or a font host over https
export function allowedUrl(value) {
  const url = String(value || '').trim()
  if (/^data:(image\/(png|jpeg|gif|webp|avif|svg\+xml)|font\/[\w.+-]+|application\/(font-woff2?|x-font-[\w-]+|vnd\.ms-fontobject))[;,]/i.test(url)) return true
  if (/^\/(uploads|api\/fonts\/file)\/[^\s"'()\\]*$/.test(url)) return true
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && FONT_HOSTS.has(u.hostname)
  } catch {
    return false
  }
}

// Text outside its strings, for what can't be in an identifier
const outsideStrings = text => text.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""')

// What's wrong with a declaration, or '' when it can stay. keyframes maps
// the stylesheet's @keyframes names to their new ones.
function declarationProblem(decl, keyframes) {
  const property = decl.property.toLowerCase()
  if (BLOCKED_PROPERTIES.has(property)) return `${property} isn't allowed`
  if (decl.value.type === 'Raw') {
    // A custom property's value, which isn't parsed: its urls by hand
    const raw = decl.value.value
    if (/expression\s*\(|javascript:|-moz-binding|\\/i.test(outsideStrings(raw))) return `${property} has a value that isn't allowed`
    for (const m of raw.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)) if (!allowedUrl(m[2])) return `url(${m[2].slice(0, 60)}) isn't an upload, a data: URL or a font host`
    if (/image-set\(|@import/i.test(raw)) return `${property} has a value that isn't allowed`
    return ''
  }
  let problem = ''
  walk(decl.value, node => {
    if (problem) return
    if (node.type === 'Url' && !allowedUrl(node.value)) problem = `url(${String(node.value).slice(0, 60)}) isn't an upload, a data: URL or a font host`
    else if (node.type === 'Function') {
      const name = node.name.toLowerCase()
      if (BLOCKED_FUNCTIONS.has(name) || name.includes('\\')) problem = `${name}() isn't allowed`
      else if (URL_STRINGS.has(name)) walk(node, inner => { if (!problem && inner.type === 'String' && !allowedUrl(inner.value)) problem = `${name}("${String(inner.value).slice(0, 60)}") isn't an upload, a data: URL or a font host` })
    } else if (node.type === 'Identifier' && keyframes.has(node.name) && /^(-webkit-)?animation(-name)?$/.test(property)) node.name = keyframes.get(node.name)
  })
  if (problem) return problem
  const text = generate(decl.value)
  if (/javascript:/i.test(text) || outsideStrings(text).includes('\\')) return `${property} has a value that isn't allowed`
  if (property === 'position' && /\bfixed\b/i.test(text)) return 'position: fixed leaves the slide in a presented deck'
  return ''
}

// A compound selector's start: whether it's only html, body or :root
const isRootCompound = nodes => nodes.length > 0 && nodes.every(n => (n.type === 'TypeSelector' && ROOTS.has(n.name.toLowerCase())) || (n.type === 'PseudoClassSelector' && n.name.toLowerCase() === 'root'))
const slideClass = () => ({ type: 'ClassSelector', name: SLIDE_CLASS })
const descendant = () => ({ type: 'Combinator', name: ' ' })

// A selector inside a slide, as an array of its parts, or null when it
// would reach outside one
function scopeSelector(selector) {
  const parts = selector.children.toArray()
  if (generate(selector).includes('\\')) return null
  const firstCombinator = parts.findIndex(n => n.type === 'Combinator')
  const lead = firstCombinator === -1 ? parts : parts.slice(0, firstCombinator)
  const rest = firstCombinator === -1 ? [] : parts.slice(firstCombinator)
  // html, body and :root are the slide
  if (isRootCompound(lead)) {
    let tail = rest
    // html body …: both the slide
    while (tail.length > 1 && tail[0].name === ' ') {
      const next = tail.findIndex((n, i) => i > 0 && n.type === 'Combinator')
      const compound = next === -1 ? tail.slice(1) : tail.slice(1, next)
      if (!isRootCompound(compound)) break
      tail = next === -1 ? [] : tail.slice(next)
    }
    return [slideClass(), ...tail]
  }
  // Starting at the slide (.px-slide[data-layout=…] …): within it, so not
  // next to it (+ and ~ would reach the editor's rulers)
  if (lead.some(n => n.type === 'ClassSelector' && n.name === SLIDE_CLASS)) {
    if (rest.length && rest[0].name !== ' ' && rest[0].name !== '>') return null
    return parts
  }
  if (parts[0]?.type === 'Combinator') {
    if (parts[0].name !== '>' && parts[0].name !== ' ') return null
    return [slideClass(), ...parts]
  }
  return [slideClass(), descendant(), ...parts]
}

// A rule's selectors, scoped; false when none is left
function scopeRule(rule) {
  if (rule.prelude.type !== 'SelectorList') return false
  const kept = []
  for (const selector of rule.prelude.children.toArray()) {
    const parts = scopeSelector(selector)
    if (parts) kept.push({ type: 'Selector', children: parts })
  }
  if (!kept.length) return false
  rule.prelude = { type: 'SelectorList', children: kept }
  return true
}

const lineOf = node => node.loc?.start?.line || 0

// The stylesheet, checked: { css, dropped: [{ line, reason }] }. css is ''
// when nothing is left.
export function scopeThemeCss(source) {
  const dropped = []
  if (typeof source !== 'string' || !source.trim()) return { css: '', dropped }
  if (source.length > MAX_THEME_CSS) return { css: '', dropped: [{ line: 1, reason: `The stylesheet is over ${MAX_THEME_CSS / 1000} KB` }] }
  let ast
  try {
    ast = parse(source, { positions: true, parseCustomProperty: false, onParseError: err => dropped.push({ line: err.line || 0, reason: `Can't be read: ${err.message}` }) })
  } catch (err) {
    return { css: '', dropped: [{ line: 1, reason: `Can't be read: ${err.message}` }] }
  }
  // @keyframes names, renamed so they can't replace the app's own
  const keyframes = new Map()
  walk(ast, node => {
    if (node.type === 'Atrule' && /^(-webkit-)?keyframes$/i.test(node.name) && node.prelude) {
      const name = generate(node.prelude).trim()
      if (/^[\w-]{1,60}$/.test(name)) keyframes.set(name, `px-${name}`)
    }
  })
  let rules = 0

  // A block's declarations, each checked; nested rules (CSS nesting) are
  // already inside their scoped parent
  const cleanBlock = block => {
    const kept = []
    for (const child of block.children.toArray()) {
      if (child.type === 'Declaration') {
        const problem = declarationProblem(child, keyframes)
        if (problem) dropped.push({ line: lineOf(child), reason: problem })
        else kept.push(child)
      } else if (child.type === 'Rule' && child.block) {
        cleanBlock(child.block)
        kept.push(child)
      } else if (child.type === 'Atrule' && BLOCK_AT_RULES.has(child.name.toLowerCase()) && child.block) {
        cleanBlock(child.block)
        kept.push(child)
      } else if (child.type !== 'Raw' || child.value.trim()) {
        dropped.push({ line: lineOf(child), reason: "Isn't a declaration that can be read" })
      }
    }
    block.children = kept
  }

  // A list of top-level (or @media) rules, cleaned
  const cleanList = list => {
    const kept = []
    for (const node of list) {
      if (++rules > MAX_THEME_RULES) {
        if (rules === MAX_THEME_RULES + 1) dropped.push({ line: lineOf(node), reason: `Only the first ${MAX_THEME_RULES} rules are used` })
        continue
      }
      if (node.type === 'Rule') {
        if (!scopeRule(node)) { dropped.push({ line: lineOf(node), reason: 'Its selectors reach outside the slide' }); continue }
        cleanBlock(node.block)
        // A rule with nothing left does nothing
        if (node.block.children.length) kept.push(node)
      } else if (node.type === 'Atrule') {
        const name = node.name.toLowerCase()
        if (BLOCK_AT_RULES.has(name) && node.block) {
          node.block.children = cleanList(node.block.children.toArray())
          kept.push(node)
        } else if (name === 'font-face' && node.block) {
          cleanBlock(node.block)
          kept.push(node)
        } else if (/^(-webkit-)?keyframes$/.test(name) && node.block && keyframes.has(generate(node.prelude).trim())) {
          node.prelude = { type: 'Raw', value: keyframes.get(generate(node.prelude).trim()) }
          for (const frame of node.block.children.toArray()) if (frame.block) cleanBlock(frame.block)
          kept.push(node)
        } else if (name === 'import' && node.prelude) {
          let url = ''
          walk(node.prelude, n => { if (!url && (n.type === 'Url' || n.type === 'String')) url = n.value })
          if (allowedUrl(url) && /^https:/.test(url)) kept.push(node)
          else dropped.push({ line: lineOf(node), reason: '@import is only for the font hosts decks load (Google Fonts, cdnfonts, jsDelivr)' })
        } else {
          dropped.push({ line: lineOf(node), reason: `@${name} isn't allowed in a theme` })
        }
      } else if (node.type !== 'Raw' || node.value.trim()) {
        dropped.push({ line: lineOf(node), reason: "Isn't a rule that can be read" })
      }
    }
    return kept
  }

  ast.children = cleanList(ast.children.toArray())
  // @import first, as CSS needs it
  ast.children.sort((a, b) => (b.type === 'Atrule' && b.name.toLowerCase() === 'import') - (a.type === 'Atrule' && a.name.toLowerCase() === 'import'))
  // Never a "<", so it can't close the <style> it's written into
  const css = generate(ast).replace(/</g, '\\3c ')
  return { css, dropped }
}

// For presented decks and the PDF: the stylesheet as a <style> for the
// page's head, or ''
export function themeCssTag(source) {
  const { css } = scopeThemeCss(source)
  return css ? `\n  <style data-theme-css>\n${css}\n  </style>` : ''
}

// For the editor: the stylesheet in a <style> of the page's own, which the
// canvas and every thumbnail read; '' or none takes it away
export function setDocumentThemeCss(source, doc = globalThis.document) {
  if (!doc) return
  const { css } = scopeThemeCss(source)
  let tag = doc.head.querySelector('style[data-theme-css]')
  if (!css) { tag?.remove(); return }
  if (!tag) {
    tag = doc.createElement('style')
    tag.setAttribute('data-theme-css', '')
    doc.head.appendChild(tag)
  }
  if (tag.textContent !== css) tag.textContent = css
}

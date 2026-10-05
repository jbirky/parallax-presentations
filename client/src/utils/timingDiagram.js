// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Timing diagram elements (toolbar: Diagrams → Timing Diagram), drawn by
// WaveDrom (MIT) from WaveJSON: signals' waveforms with buses, gaps, groups
// and arrows between events, and also its register (bit field) and logic
// (assign) drawings. Made in TimingEditorModal.
//
// WaveDrom's SVG leans on a style sheet and on <use> of bricks kept in its
// <defs>. The editor's SVG cleaning drops both, and a style sheet in a page
// styles every diagram on it, so two skins on one slide would clash.
// timingSvg rewrites it as plain shapes, the skin's styles as attributes and
// each id that's left made the element's own, which the canvas, decks,
// printed pages and PowerPoint can all use.
//
// Steps reveal the waveforms up to a cycle, with a cursor there: rectangles
// in a clip path shown for one step each through diagramCore's data-fx-in
// ranges, so a deck needs only diagramDeckScript.

import renderAny from 'wavedrom-render-any'
import defaultSkin from 'wavedrom/skins/default.js'
import darkSkin from 'wavedrom/skins/dark.js'
import JSON5 from 'json5'

const SKINS = { ...defaultSkin, ...darkSkin }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n1 = v => String(Math.round(v * 10) / 10)

export const TIMING_FIELDS = ['source', 'theme', 'steps', 'revealFrom', 'cursor', 'stepStart']

// Big enough for any figure, small enough that a typo can't make a page of millions of shapes
const LIMITS = { source: 40000, signals: 80, wave: 400, hscale: 8, bits: 512 }

// ---------- Reading WaveJSON: JSON5, so keys needn't be quoted, strings can
// use single quotes and trailing commas are fine, as in WaveDrom's editor

export function parseTiming(source) {
  const text = String(source ?? '')
  if (text.length > LIMITS.source) return { error: `That's ${text.length.toLocaleString('en-US')} characters; a diagram can have up to ${LIMITS.source.toLocaleString('en-US')}.` }
  let json
  try { json = JSON5.parse(text) } catch (err) {
    const where = err.lineNumber ? `Line ${err.lineNumber}: ` : ''
    return { error: where + String(err.message || err).replace(/^JSON5: /, '').replace(/ at \d+:\d+$/, '') }
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) return { error: 'Write an object: { signal: [ … ] } for waveforms, or { reg: [ … ] } for a register.' }
  if (json.signal) {
    if (!Array.isArray(json.signal)) return { error: 'signal must be a list: signal: [ { name: "clk", wave: "p...." } ]' }
    let count = 0, bad = null
    const walk = list => list.forEach(s => {
      if (Array.isArray(s)) { walk(s.slice(1)); return }
      if (!s || typeof s !== 'object') return
      count++
      if (s.wave != null && typeof s.wave !== 'string') bad = bad || `${s.name || 'A signal'}'s wave must be a string, like "p...."`
      else if (String(s.wave || '').length > LIMITS.wave) bad = bad || `${s.name || 'A signal'}'s wave is ${s.wave.length} steps long; up to ${LIMITS.wave} are drawn`
      if (s.data != null && !Array.isArray(s.data) && typeof s.data !== 'string') bad = bad || `${s.name || 'A signal'}'s data must be a list of labels`
    })
    walk(json.signal)
    if (bad) return { error: bad }
    if (count > LIMITS.signals) return { error: `${count} signals; a diagram can have up to ${LIMITS.signals}.` }
    const hs = Number(json.config?.hscale)
    if (json.config?.hscale != null && !(hs > 0 && hs <= LIMITS.hscale)) return { error: `hscale must be between 0 and ${LIMITS.hscale}.` }
    return { json, kind: 'signal' }
  }
  if (json.reg) {
    if (!Array.isArray(json.reg)) return { error: 'reg must be a list of fields: reg: [ { bits: 8, name: "data" } ]' }
    const bits = json.reg.reduce((n, f) => n + (Number(f?.bits) || 0), 0)
    if (bits > LIMITS.bits) return { error: `${bits} bits; a register can have up to ${LIMITS.bits}.` }
    return { json, kind: 'reg' }
  }
  if (json.assign) {
    if (!Array.isArray(json.assign)) return { error: 'assign must be a list, like assign: [ ["out", ["&", "a", "b"]] ]' }
    return { json, kind: 'assign' }
  }
  return { error: 'Nothing to draw: give it a signal list for waveforms, reg for a register, or assign for logic.' }
}

// ---------- WaveDrom's SVG as plain shapes

// The style properties an SVG attribute can carry; the rest (display,
// overflow, marker:none…) change nothing in a still drawing
const ATTR_PROPS = new Set(['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'font-size', 'font-style', 'font-weight', 'font-family', 'text-anchor'])

const DEFAULTS = { 'stroke-linejoin': 'miter', 'stroke-miterlimit': '4', 'stroke-opacity': '1', 'stroke-dasharray': 'none', 'stroke-dashoffset': '0', 'fill-opacity': '1', 'font-style': 'normal', 'font-weight': 'normal', 'fill-rule': 'nonzero', opacity: '1' }

// A style sheet's rules for one tag or one class; anything subtler (hover,
// descendants) doesn't apply to a still drawing
function parseCss(css) {
  const rules = []
  String(css).replace(/\/\*[\s\S]*?\*\//g, '').split('}').forEach(chunk => {
    const at = chunk.indexOf('{')
    if (at < 0) return
    const decls = {}
    chunk.slice(at + 1).split(';').forEach(d => {
      const m = /^\s*([\w-]+)\s*:\s*(.+?)\s*(?:!important)?\s*$/.exec(d)
      if (m && ATTR_PROPS.has(m[1])) decls[m[1]] = m[2]
    })
    chunk.slice(0, at).split(',').forEach(sel => {
      const s = sel.trim(), m = /^([a-z]+)$/i.exec(s) || /^\.([\w-]+)$/.exec(s)
      if (m) rules.push(s[0] === '.' ? { cls: m[1], decls } : { tag: m[1].toLowerCase(), decls })
    })
  })
  return rules
}

// WaveDrom's tree as SVG markup. onml's own stringify escapes nothing, and
// WaveJSON can put markup of its own in names and labels (["tspan", {…}, …]),
// so only drawing tags and attributes are written, every value escaped.
const TAGS = new Set(['svg', 'g', 'path', 'rect', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'text', 'tspan', 'marker', 'defs', 'clipPath', 'title', 'desc'])
const tagName = t => { const s = String(t); for (const k of TAGS) if (k.toLowerCase() === s.toLowerCase()) return k; return null }
// Text WaveDrom has escaped already (its tspan markup does), back to plain, to be escaped once
const ENT = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }
const unesc = s => String(s).replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, e) => {
  if (e[0] !== '#') return ENT[e.toLowerCase()]
  const c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)
  return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : m
})
function toXml(n) {
  if (!Array.isArray(n)) return n == null || typeof n === 'object' ? '' : esc(unesc(n))
  const tag = tagName(n[0])
  if (!tag) return ''
  let s = '<' + tag
  for (const [k, v] of Object.entries(attrsOf(n) || {})) {
    if (v == null || typeof v === 'object' && !Array.isArray(v)) continue
    if (!/^[A-Za-z][\w:-]*$/.test(k) || /^on/i.test(k) || /href$/i.test(k)) continue
    let val = Array.isArray(v) ? v.join(' ') : String(v)
    if (/url\(/i.test(val)) val = val.replace(/url\(\s*(?!#[\w-]+\s*\))[^)]*\)/gi, 'none')
    if (/javascript:|expression\(/i.test(val)) continue
    s += ' ' + k + '="' + esc(val) + '"'
  }
  const kids = kidsOf(n)
  return kids.length ? s + '>' + kids.map(toXml).join('') + '</' + tag + '>' : s + '/>'
}

const isAttrs = x => x && typeof x === 'object' && !Array.isArray(x)
const attrsOf = n => (isAttrs(n[1]) ? n[1] : null)
const kidsOf = n => n.slice(isAttrs(n[1]) ? 2 : 1)
const clone = n => JSON.parse(JSON.stringify(n))

// The dark slide's colors for what WaveDrom hard-codes rather than takes from its skin
const DARK = { ink: '#e8ecf3', blue: '#79b8ff', soft: '#1e1e2e' }
function recolor(value) {
  return String(value)
    .replace(/#0041c4|#00f\b|#0000ff/gi, DARK.blue)
    .replace(/#ffffffcc/gi, DARK.soft + 'cc')
    .replace(/fill:\s*(?:#fff(?:fff)?|white)(?![\w-])/gi, 'fill:' + DARK.soft)
    .replace(/(^|[^\w#-])(?:#000000|#000|black)(?![\w-])/gi, (m, p) => p + DARK.ink)
}

// A tree from onml (['tag', {attrs}, ...children]) as a drawing with no
// style sheet, no <use> and no ids but its own (prefixed)
function plain(tree, { prefix, dark }) {
  const rules = [], bricks = {}, markers = []
  // The style sheets and the bricks
  const gather = n => {
    if (!Array.isArray(n)) return
    if (n[0] === 'style') { rules.push(...parseCss(kidsOf(n).filter(k => typeof k === 'string').join(''))); return }
    if (n[0] === 'defs') {
      for (const k of kidsOf(n)) {
        if (!Array.isArray(k)) continue
        const id = attrsOf(k)?.id
        if (k[0] === 'marker' && id) markers.push(k)
        else if (id) bricks[id] = k
      }
      return
    }
    kidsOf(n).forEach(gather)
  }
  gather(tree)
  const tagRules = {}, clsRules = {}
  rules.forEach(r => { if (r.tag) Object.assign(tagRules[r.tag] = tagRules[r.tag] || {}, r.decls); else Object.assign(clsRules[r.cls] = clsRules[r.cls] || {}, r.decls) })
  const markerIds = new Set(markers.map(m => attrsOf(m).id))
  const fixUrls = v => String(v).replace(/url\(#([\w-]+)\)/g, (m, id) => (markerIds.has(id) ? `url(#${prefix}-${id})` : 'none'))

  let depth = 0
  const walk = n => {
    if (!Array.isArray(n)) return n
    if (n[0] === 'style' || n[0] === 'defs') return null
    if (n[0] === 'use') {
      // A brick, copied in
      const a = attrsOf(n) || {}, id = String(a['xlink:href'] || a.href || '').replace(/^#/, ''), brick = bricks[id]
      if (!brick || depth > 8) return null
      depth++
      const g = ['g', a.transform ? { transform: a.transform } : {}, ...kidsOf(clone(brick)).map(walk).filter(Boolean)]
      depth--
      return g
    }
    const a = { ...(attrsOf(n) || {}) }, tag = String(n[0]).toLowerCase()
    // On a dark slide, the colors WaveDrom writes into its own code (the
    // skin's, which come next, are already the dark skin's)
    if (dark) for (const k of ['fill', 'stroke', 'style', 'color']) if (a[k] != null) a[k] = recolor(a[k])
    // A rule for its tag, then one for each of its classes, over its own attributes
    Object.assign(a, tagRules[tag] || {})
    String(a.class || '').split(/\s+/).forEach(c => { if (clsRules[c]) Object.assign(a, clsRules[c]) })
    delete a.class
    // What SVG draws anyway, which the skins spell out
    for (const [k, v] of Object.entries(DEFAULTS)) if (a[k] != null && String(a[k]).trim() === v) delete a[k]
    // What drawing a step needs, kept as data attributes
    const id = String(a.id || '')
    if (/^lanes_\d+$/.test(id)) a['data-tm'] = 'lanes'
    else if (/^(wavelane_draw_\d+_\d+|wavearcs_\d+|wavegaps_\d+)$/.test(id)) a['data-tm'] = 'clip'
    else if (/^gmarks_\d+$/.test(id)) a['data-tm'] = 'marks'
    else if (/^wavelane_\d+_\d+$/.test(id)) a['data-tm'] = 'lane'
    delete a.id
    for (const k of Object.keys(a)) {
      if (k === 'style' || k === 'marker-end' || k === 'marker-start') a[k] = fixUrls(a[k])
      if (k === 'xml:space' || k === 'xmlns:xlink') delete a[k]
    }
    // WaveDrom's white page: the slide shows through instead
    if (tag === 'rect' && /fill:\s*white/.test(a.style || '') && /stroke:\s*none/.test(a.style || '')) return null
    return [tag, a, ...kidsOf(n).map(walk).filter(x => x != null)]
  }
  const out = walk(tree)
  // The arrowheads, under ids of the element's own
  const defs = markers.map(m => {
    const c = clone(m), a = attrsOf(c)
    a.id = `${prefix}-${a.id}`
    if (dark) for (const k of ['style', 'fill', 'stroke']) if (a[k]) a[k] = recolor(a[k])
    return ['marker', a, ...kidsOf(c).map(k => (Array.isArray(k) && attrsOf(k) && dark ? [k[0], Object.fromEntries(Object.entries(attrsOf(k)).map(([key, v]) => [key, key === 'style' || key === 'fill' || key === 'stroke' ? recolor(v) : v])), ...kidsOf(k)] : k))]
  })
  return { tree: out, defs }
}

function findAll(n, test, out = []) {
  if (!Array.isArray(n)) return out
  if (test(n)) out.push(n)
  kidsOf(n).forEach(k => findAll(k, test, out))
  return out
}

// ---------- The element's drawing

const cache = new Map()
const CACHE_SIZE = 60

// WaveDrom's drawing of the source, made plain, with what steps need: the
// lanes' box and the px a cycle takes. Memoized, since the canvas redraws often
export function drawTiming(el, prefix = 'tm') {
  const theme = el?.theme === 'light' ? 'light' : 'dark'
  const key = theme + '\n' + prefix + '\n' + (el?.source ?? '')
  const hit = cache.get(key)
  if (hit) return hit
  let out
  const p = parseTiming(el?.source)
  if (p.error) out = { error: p.error }
  else {
    try {
      const json = clone(p.json)
      if (p.kind === 'signal') json.config = { ...(json.config || {}), skin: theme === 'dark' ? 'dark' : 'default' }
      const tree = renderAny(0, json, SKINS)
      if (!Array.isArray(tree) || tree[0] !== 'svg') throw new Error('WaveDrom drew nothing for this')
      const a = attrsOf(tree)
      const w = Number(a.width) || 400, h = Number(a.height) || 100
      const { tree: body, defs } = plain(tree, { prefix, dark: theme === 'dark' })
      out = { kind: p.kind, w, h, body: kidsOf(body), defs, rootAttrs: attrsOf(body) || {} }
      if (p.kind === 'signal') {
        // A cycle's width from the grid's lines (or the bricks), and where the lanes are
        const lanes = findAll(body, n => attrsOf(n)?.['data-tm'] === 'lanes')[0]
        const t = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)/.exec(attrsOf(lanes || [])?.transform || '')
        const grid = findAll(lanes || [], n => attrsOf(n)?.['data-tm'] === 'marks')[0] || []
        const lines = findAll(grid, n => n[0] === 'line')
        const marks = lines.map(n => Number(attrsOf(n).x1)).sort((x, y) => x - y)
        const hscale = Number(p.json.config?.hscale) || 1
        let period = marks.length > 1 ? marks[1] - marks[0] : 40 * hscale
        if (!(period > 0)) period = 40 * hscale
        const laneH = Math.max(0, ...lines.map(n => Number(attrsOf(n).y2) || 0))
        out.lanes = { x: t ? +t[1] : 0, y: t ? +t[2] : 0, h: laneH || h, period, cycles: marks.length > 1 ? marks.length - 1 : Math.round((w - (t ? +t[1] : 0)) / period) }
      }
    } catch (err) {
      out = { error: 'WaveDrom couldn’t draw this: ' + (err?.message || String(err)) }
    }
  }
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value)
  cache.set(key, out)
  return out
}

// The element's steps, checked: each reveals the waveforms to a cycle
export function timingModel(el) {
  const steps = (Array.isArray(el?.steps) ? el.steps : []).slice(0, 200).map(s => ({
    to: Math.max(0, Math.min(10000, Math.round((Number(s?.to) || 0) * 2) / 2)),
    caption: typeof s?.caption === 'string' ? s.caption.slice(0, 300) : '',
  }))
  const start = Math.round(Number(el?.stepStart))
  return {
    source: String(el?.source ?? ''),
    theme: el?.theme === 'light' ? 'light' : 'dark',
    steps,
    revealFrom: Math.max(0, Math.min(10000, Math.round((Number(el?.revealFrom) || 0) * 2) / 2)),
    cursor: el?.cursor !== false,
    stepStart: start >= 1 && start <= 1000 ? start : 1,
  }
}

const CAPTION_H = 30

// The drawing's box: the element keeps this aspect
export function timingBox(el) {
  const d = drawTiming(el)
  if (d.error) return { w: 480, h: 120 }
  const m = timingModel(el)
  return { w: d.w, h: d.h + (m.steps.some(s => s.caption) ? CAPTION_H : 0) }
}

const idOf = el => 'tm' + String(el?.id || 'x').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)

// The element as an <svg> filling its box. opts: deck (an id: every step's
// reveal, shown by diagramCore's step script), step (as at that step;
// default everything), standalone (with a size, for an image)
export function timingSvg(el, opts = {}) {
  const m = timingModel(el), prefix = idOf(el) + (opts.deck ? '' : opts.step != null ? 's' + opts.step : 'c')
  const d = drawTiming(m, prefix)
  const dark = m.theme === 'dark'
  if (d.error) {
    const w = 480, h = 120
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet"${opts.standalone ? ` width="${w}" height="${h}"` : ''} style="width:100%;height:100%;display:block;overflow:visible">` +
      `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="8" fill="none" stroke="${dark ? '#f5a524' : '#b45309'}" stroke-dasharray="6 4"/>` +
      `<text x="${w / 2}" y="${h / 2 - 6}" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="600" fill="${dark ? '#f5a524' : '#b45309'}">Timing diagram</text>` +
      `<text x="${w / 2}" y="${h / 2 + 16}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="${dark ? '#e8ecf3' : '#333'}">${esc(d.error.length > 70 ? d.error.slice(0, 69) + '…' : d.error)}</text></svg>`
  }
  const hasCaps = m.steps.some(s => s.caption)
  const W = d.w, H = d.h + (hasCaps ? CAPTION_H : 0)
  const ink = dark ? DARK.ink : '#222222', accent = dark ? '#ff8a65' : '#d9480f'
  let defs = d.defs.map(toXml).join('')
  let body = d.body
  // Revealing the waveforms by cycle
  const steps = d.kind === 'signal' && m.steps.length ? m.steps : null
  const at = opts.step != null ? Math.max(0, Math.min(m.steps.length, opts.step)) : null
  let over = ''
  if (steps && (opts.deck || at != null)) {
    const L = d.lanes, x = cyc => cyc * L.period
    const reveal = k => (k === 0 ? m.revealFrom : steps[k - 1].to)
    const range = k => (k === steps.length ? `${k}-` : `${k}-${k}`)
    const ks = opts.deck ? steps.map((_, i) => i + 1).concat(0) : [at]
    const clipId = `${prefix}-reveal`
    defs += `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">` + ks.map(k =>
      `<rect${opts.deck ? ` data-fx-in="${range(k)}"` : ''} x="-4" y="-10000" width="${n1(x(reveal(k)) + 4)}" height="20000"/>`).join('') + '</clipPath>'
    body = clipLanes(body, clipId)
    // The cursor at the edge of what's shown
    if (m.cursor) {
      over += ks.filter(k => reveal(k) > 0 && reveal(k) < L.cycles).map(k => {
        const cx = L.x + x(reveal(k))
        return `<line${opts.deck ? ` data-fx-in="${range(k)}"` : ''} x1="${n1(cx)}" y1="${n1(L.y - 8)}" x2="${n1(cx)}" y2="${n1(L.y + L.h + 4)}" stroke="${accent}" stroke-width="1.5" stroke-dasharray="4 3"/>`
      }).join('')
    }
  }
  if (hasCaps && d.kind === 'signal') {
    // Each step's caption under the diagram; in a deck the latest one shows
    const caps = m.steps.map((s, i) => [i + 1, s.caption]).filter(([, c]) => c)
    const shown = opts.deck ? caps : at != null ? caps.filter(([k]) => k <= at).slice(-1) : []
    over += shown.map(([k, c]) => `<text class="pxfx-cap"${opts.deck ? ` data-fx-cap="${k}"` : ''} x="${n1(W / 2)}" y="${n1(d.h + CAPTION_H - 10)}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="${ink}">${esc(c)}</text>`).join('')
  }
  const inner = body.map(toXml).join('')
  const rootFill = d.kind !== 'signal' && dark ? ` fill="${DARK.ink}"` : ''
  const size = opts.standalone ? ` width="${n1(W)}" height="${n1(H)}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n1(W)} ${n1(H)}" preserveAspectRatio="xMidYMid meet"${size}${rootFill} style="width:100%;height:100%;display:block;overflow:visible">` +
    (defs ? `<defs>${defs}</defs>` : '') + inner + over + '</svg>'
}

// The lanes' waveforms, arrows and gaps, each clipped to what a step shows
function clipLanes(nodes, clipId) {
  const walk = n => {
    if (!Array.isArray(n)) return n
    const a = attrsOf(n)
    if (a && a['data-tm'] === 'clip') return [n[0], { ...a, 'clip-path': `url(#${clipId})` }, ...kidsOf(n)]
    return [n[0], ...(a ? [a] : []), ...kidsOf(n).map(walk)]
  }
  return nodes.map(walk)
}

// ---------- Steps

// The diagram steps at which it changes: [[slide step, diagram step]]
export function timingSteps(el) {
  if (el?.type !== 'timing') return []
  const m = timingModel(el)
  if (!m.steps.length) return []
  return m.steps.map((_, i) => [m.stepStart + i, i + 1]).filter(([n]) => n <= 1000)
}
export function timingStepAt(el, slideStep) {
  let at = 0
  for (const [n, s] of timingSteps(el)) if (n <= slideStep) at = s
  return at
}
export function timingStepMarkers(slide) {
  let html = ''
  for (const el of slide?.elements || []) {
    const id = String(el.id || '').replace(/[^A-Za-z0-9_-]/g, '')
    for (const [n, s] of timingSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`
  }
  return html
}
export function hasTiming(presentation) {
  return (presentation?.slides || []).some(s => (s.elements || []).some(el => el.type === 'timing'))
}

// How many cycles the waveforms run for, for the steps' fields
export function timingCycles(el) {
  const d = drawTiming(el)
  return d.lanes ? d.lanes.cycles : 0
}

// Steps that reveal a cycle at a time, or every `every` cycles
export function stepsByCycle(el, every = 1) {
  const n = timingCycles(el), out = []
  const k = Math.max(0.5, Number(every) || 1)
  for (let c = k; c < n + 1e-9; c += k) out.push({ to: Math.round(c * 2) / 2, caption: '' })
  if (!out.length || out[out.length - 1].to < n) out.push({ to: n, caption: '' })
  return out
}

// ---------- Starting points

export const TIMING_TEMPLATES = [
  {
    key: 'clock-data', name: 'Clock, data and a handshake', source: `{ signal: [
  { name: 'clk',  wave: 'p.......' },
  { name: 'data', wave: 'x.345x..', data: ['head', 'body', 'tail'] },
  { name: 'req',  wave: '0.1..0..', node: '..a..b' },
  { name: 'ack',  wave: '0..1..0.', node: '...c..d' },
],
  edge: ['a~>c', 'b~>d'],
  head: { text: 'Request and acknowledge', tick: 0 },
}`,
  },
  {
    key: 'spi', name: 'SPI byte, mode 0', source: `{ signal: [
  { name: 'CS',   wave: '10........1' },
  { name: 'SCLK', wave: '0.p.......l', period: 1 },
  { name: 'MOSI', wave: 'x.========x', data: ['b7', 'b6', 'b5', 'b4', 'b3', 'b2', 'b1', 'b0'] },
  { name: 'MISO', wave: 'z.========z', data: ['b7', 'b6', 'b5', 'b4', 'b3', 'b2', 'b1', 'b0'] },
],
  head: { text: 'SPI, mode 0: sampled on the rising edge', tick: 0 },
}`,
  },
  {
    key: 'i2c', name: 'I²C start, address and ACK', source: `{ signal: [
  { name: 'SCL', wave: '1.n........h.' },
  { name: 'SDA', wave: '10=========01', data: ['A6', 'A5', 'A4', 'A3', 'A2', 'A1', 'A0', 'R/W', 'ACK'] },
],
  head: { text: 'I²C: start, a 7-bit address, read or write, acknowledge, stop', tick: 0 },
}`,
  },
  {
    key: 'uart', name: 'UART frame', source: `{ signal: [
  { name: 'TX',  wave: '1.0========1.', data: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'] },
  { name: 'bit', wave: 'x.3444444445x', data: ['start', '0', '1', '2', '3', '4', '5', '6', '7', 'stop'] },
],
  head: { text: 'UART, 8N1: a start bit, eight data bits least significant first, a stop bit' },
}`,
  },
  {
    key: 'axi', name: 'Valid and ready handshake', source: `{ signal: [
  { name: 'ACLK',   wave: 'p.........' },
  ['Write address',
    { name: 'AWVALID', wave: '0.1...0...', node: '..a...' },
    { name: 'AWREADY', wave: '0...10....', node: '....b' },
    { name: 'AWADDR',  wave: 'x.3...x...', data: ['0x40'] },
  ],
  {},
  ['Write data',
    { name: 'WVALID', wave: '0...1.0...' },
    { name: 'WREADY', wave: '0.....10..', node: '......c' },
    { name: 'WDATA',  wave: 'x...4..x..', data: ['0xBEEF'] },
  ],
],
  edge: ['a~>b address taken', 'b~>c'],
  head: { text: 'A transfer happens on the cycle VALID and READY are both high', tick: 0 },
}`,
  },
  {
    key: 'pipeline', name: 'Five-stage pipeline', source: `{ signal: [
  { name: 'clk', wave: 'p......' },
  { name: 'add', wave: '34567xx', data: ['IF', 'ID', 'EX', 'MEM', 'WB'] },
  { name: 'sub', wave: 'x34567x', data: ['IF', 'ID', 'EX', 'MEM', 'WB'] },
  { name: 'lw',  wave: 'xx34567', data: ['IF', 'ID', 'EX', 'MEM', 'WB'] },
],
  head: { text: 'One instruction enters the pipeline each cycle', tick: 1 },
}`,
  },
  {
    key: 'register', name: 'Register fields (RISC-V I-type)', source: `{ reg: [
  { bits: 7,  name: 'opcode',    attr: 'OP-IMM' },
  { bits: 5,  name: 'rd',        attr: 'dest' },
  { bits: 3,  name: 'funct3',    attr: ['ADDI', 'SLTI', 'ANDI'] },
  { bits: 5,  name: 'rs1',       attr: 'src' },
  { bits: 12, name: 'imm[11:0]', attr: 'I-immediate' },
],
  config: { hspace: 880, bits: 32, lanes: 1 },
}`,
  },
]

export function defaultTiming(dark = true) {
  return { source: TIMING_TEMPLATES[0].source, theme: dark ? 'dark' : 'light', steps: [], revealFrom: 0, cursor: true, stepStart: 1 }
}

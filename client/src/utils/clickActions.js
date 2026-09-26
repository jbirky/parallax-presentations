// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Click and hover actions, and slide links. In a presented deck, an element
// with a click action goes to a slide, to the next or previous one, opens a
// web page, or shows and hides elements on its slide (tabs, click-to-reveal);
// one with a hover action shows and hides elements while the pointer is over
// it (hotspots). Clicks and hovers can also put elements in a state: a look
// with its own position, size, turn, colors or opacity (flip cards, quiz
// answers, click to zoom). And text can link to a slide. Slides are addressed by id, as
// #/s-<slide id>: each slide's section has that id, which reveal.js resolves
// (and shows in the address bar), so links and shared URLs keep their slide
// when slides move.
//
//   el.clickAction = { type: 'slide', slideId } | { type: 'next' } | { type: 'prev' }
//                  | { type: 'url', url, newTab }
//                  | { type: 'visibility', show: [elementId], hide: [...], toggle: [...],
//                      set: [{ id: elementId, state: stateId or '' (its default), mode }] }
//                    mode: 'set', 'toggle' (between the state and its default) or
//                    'cycle' (to its next state, then back to the default)
//   el.hoverAction = { type: 'visibility', show: [elementId], hide: [...], set: [{ id, state }] },
//                    undone when the hover ends
//   el.states = [{ id, name, duration (ms), easing, ...overrides }]: up to
//                    MAX_STATES looks, each overriding some of STATE_PROPS. A
//                    shape whose states change its outline (its shape, size or
//                    corners) morphs between them.
//   el.initialState = a state's id: the one it's in each time its slide opens,
//                    rather than its default (its own properties)
//   el.backfaceHidden = true: unseen while turned over by a state's flip
//   el.stateSteps = { [step]: stateId or null }: at that step of its slide (a
//                    press of → or a clicker, counted with its fragments), it
//                    goes to that state, or its default for null; stepping
//                    back undoes it
//   el.hoverEffect = 'brighten' (the default) | 'lift' | 'grow' | 'none': how a
//                    clickable element looks under the pointer
//   el.startHidden = true: hidden each time its slide opens, until a click or
//                    hover shows it
//
// The server has a copy of everything above "Editor helpers" below, for the
// pages it builds (share links, GitHub and Zenodo exports), written by
// scripts/copy-click-actions.js.

import { CLOSED_SHAPES, shapeOutline, outlinePath, shapeSvgString } from './shapeGeometry'

export const CLICK_ACTION_TYPES = ['slide', 'next', 'prev', 'url', 'visibility']
export const HOVER_EFFECTS = ['brighten', 'lift', 'grow', 'none']
const VISIBILITY_KEYS = ['show', 'hide', 'toggle']
const HOVER_KEYS = ['show', 'hide']

// ── States ──
// What a state can change, and how it moves there
export const MAX_STATES = 8
export const STATE_PROPS = ['x', 'y', 'width', 'height', 'rotation', 'scale', 'flipX', 'flipY', 'opacity', 'zIndex',
  'fill', 'stroke', 'textColor', 'filterBrightness', 'filterContrast', 'filterGrayscale', 'shape', 'borderRadius']
export const STATE_EASINGS = {
  ease: 'ease', 'ease-in-out': 'ease-in-out', 'ease-out': 'ease-out', 'ease-in': 'ease-in', linear: 'linear',
  spring: 'cubic-bezier(0.34,1.56,0.64,1)',
}
export const DEFAULT_STATE_DURATION = 400
export const SET_MODES = ['set', 'toggle', 'cycle']

// Ids and values go into the page's CSS and selectors, so only these do
const SAFE_ID = /^[A-Za-z0-9_-]+$/
const COLOR = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9.,%\s/-]+\)|[a-z]{3,20})$/i
const clamp = (v, min, max) => typeof v === 'number' && Number.isFinite(v) ? +Math.min(max, Math.max(min, v)).toFixed(2) : null
const color = v => typeof v === 'string' && COLOR.test(v.trim()) ? v.trim() : null
// Turned over (true, or -180 to turn the other way), in degrees
const flip = v => v === true || v === 180 ? 180 : v === -180 ? -180 : 0

// An element's states, the ones a page can use
export function elementStates(el) {
  if (typeof el?.id !== 'string' || !SAFE_ID.test(el.id) || !Array.isArray(el.states)) return []
  return el.states.filter(st => typeof st?.id === 'string' && SAFE_ID.test(st.id)).slice(0, MAX_STATES)
}

// A state's overrides, checked
function stateValues(st) {
  return {
    x: clamp(st.x, -10000, 10000), y: clamp(st.y, -10000, 10000),
    width: clamp(st.width, 1, 10000), height: clamp(st.height, 1, 10000),
    rotation: clamp(st.rotation, -3600, 3600), scale: clamp(st.scale, 0.05, 20),
    flipX: flip(st.flipX), flipY: flip(st.flipY),
    opacity: clamp(st.opacity, 0, 1), zIndex: st.zIndex == null ? null : Math.round(clamp(st.zIndex, -1000, 100000) ?? 0),
    fill: color(st.fill), stroke: color(st.stroke), textColor: color(st.textColor),
    filterBrightness: clamp(st.filterBrightness, 0, 400), filterContrast: clamp(st.filterContrast, 0, 400),
    filterGrayscale: clamp(st.filterGrayscale, 0, 100),
    shape: CLOSED_SHAPES.includes(st.shape) ? st.shape : null, borderRadius: clamp(st.borderRadius, 0, 10000),
    duration: Math.round(clamp(st.duration, 0, 10000) ?? DEFAULT_STATE_DURATION),
    easing: STATE_EASINGS[st.easing] || 'ease',
  }
}

// The state changes in a click or hover action, checked; a hover only sets
function setList(action, modes = SET_MODES) {
  return (Array.isArray(action?.set) ? action.set : []).filter(s => typeof s?.id === 'string' && SAFE_ID.test(s.id)
    && (!s.state || (typeof s.state === 'string' && SAFE_ID.test(s.state))) && modes.includes(s.mode || 'set'))
}

// Embeds, players and drawings take their own clicks, or none
const NO_CLICK_ACTION = new Set(['html', 'p5', 'video', 'audio', 'drawing'])
export function supportsClickAction(el) {
  return !!el?.type && !NO_CLICK_ACTION.has(el.type) && !el.type.startsWith('plugin:')
}

export const slideAnchor = id => `s-${id}`
export const slideHref = id => `#/${slideAnchor(id)}`

// Shared decks are served from the app's own origin, so a web page action
// opens only http(s) and mailto addresses, never script
export function safeActionUrl(url) {
  if (typeof url !== 'string') return ''
  const trimmed = url.trim()
  return /^(https?:\/\/[^\s]|mailto:[^\s])/i.test(trimmed) ? trimmed : ''
}

const escapeAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Element ids in a show/hide list; the page separates them with spaces
const idList = list => (Array.isArray(list) ? list : []).filter(id => typeof id === 'string' && id && !/\s/.test(id))

// The ids of the elements on `slide` that a click or hover shows, hides or toggles
export function visibilityTargets(slide) {
  const targets = new Set()
  for (const el of slide?.elements || []) {
    if (el.clickAction?.type === 'visibility') {
      for (const key of VISIBILITY_KEYS) idList(el.clickAction[key]).forEach(id => targets.add(id))
      setList(el.clickAction).forEach(s => targets.add(s.id))
    }
    if (el.hoverAction?.type === 'visibility') {
      for (const key of HOVER_KEYS) idList(el.hoverAction[key]).forEach(id => targets.add(id))
      setList(el.hoverAction, ['set']).forEach(s => targets.add(s.id))
    }
  }
  return targets
}

// The attributes that make an element clickable or hoverable in a presented
// deck, and that let a click or hover on its slide show or hide it (`targets`,
// from visibilityTargets)
export function clickActionAttrs(el, targets = new Set()) {
  const click = actionAttrs(el)
  return click + hoverAttrs(el, !click) + visibilityAttrs(el, targets)
}

function actionAttrs(el) {
  const action = el?.clickAction
  if (!action || !supportsClickAction(el)) return ''
  let target = ''
  if (action.type === 'slide') {
    if (!action.slideId) return ''
    target = ` data-action-slide="${escapeAttr(slideAnchor(action.slideId))}"`
  } else if (action.type === 'url') {
    const url = safeActionUrl(action.url)
    if (!url) return ''
    target = ` data-action-url="${escapeAttr(url)}"${action.newTab === false ? '' : ' data-action-new-tab'}`
  } else if (action.type === 'visibility') {
    const set = setList(action)
    target = VISIBILITY_KEYS.map(key => [key, idList(action[key])]).filter(([, ids]) => ids.length)
      .map(([key, ids]) => ` data-action-${key}="${escapeAttr(ids.join(' '))}"`).join('')
      + (set.length ? ` data-action-set="${set.map(s => `${s.id}:${s.state || ''}:${s.mode || 'set'}`).join(' ')}"` : '')
    if (!target) return ''
  } else if (action.type !== 'next' && action.type !== 'prev') {
    return ''
  }
  const hover = HOVER_EFFECTS.includes(el.hoverEffect) && el.hoverEffect !== 'brighten' ? ` data-hover="${el.hoverEffect}"` : ''
  return ` data-action="${action.type}"${target}${hover} role="${action.type === 'url' ? 'link' : 'button'}" tabindex="0"`
}

// What a hover shows and hides; `focusable` for an element with no click
// action, so the keyboard can reach it too
function hoverAttrs(el, focusable) {
  const action = el?.hoverAction
  if (action?.type !== 'visibility' || !supportsClickAction(el)) return ''
  const set = setList(action, ['set'])
  const attrs = HOVER_KEYS.map(key => [key, idList(action[key])]).filter(([, ids]) => ids.length)
    .map(([key, ids]) => ` data-hover-${key}="${escapeAttr(ids.join(' '))}"`).join('')
    + (set.length ? ` data-hover-set="${set.map(s => `${s.id}:${s.state || ''}`).join(' ')}"` : '')
  return attrs && focusable ? `${attrs} tabindex="0"` : attrs
}

// Any element, embeds included, can be shown or hidden by a click or hover,
// and one with states can be put in them: data-st is the state it's in, ''
// for its default
function visibilityAttrs(el, targets) {
  const states = elementStates(el)
  if (!el?.id || !(targets.has(el.id) || el.startHidden || states.length)) return ''
  const start = states.some(st => st.id === el.initialState) ? el.initialState : ''
  const st = states.length ? ` data-st-list="${states.map(s => s.id).join(' ')}" data-st="${start}" data-st-start="${start}"` : ''
  return ` data-el="${escapeAttr(el.id)}"${el.startHidden ? ' data-start-hidden data-hidden' : ''}${st}`
}

// A shape element's outline in each of its states, when some state changes
// it ('' for its default), or null: lines don't morph
function stateOutlines(el) {
  const shape = el?.shape || 'rect'
  if (el?.type !== 'shape' || !CLOSED_SHAPES.includes(shape)) return null
  const states = elementStates(el)
  const values = states.map(stateValues)
  if (!values.some(v => (v.shape && v.shape !== shape) || v.width != null || v.height != null || v.borderRadius != null)) return null
  const outlines = [['', shapeOutline(el)]]
  states.forEach((st, i) => {
    const v = values[i]
    const w = v.width ?? el.width, h = v.height ?? el.height
    // A star's own center and sizes grow with its box
    const sx = w / (el.width || 1), sy = h / (el.height || 1)
    const star = ['starCx', 'starCy', 'starOuterR', 'starInnerR'].filter(k => el[k] != null)
      .reduce((o, k) => ({ ...o, [k]: el[k] * (k === 'starCx' ? sx : k === 'starCy' ? sy : Math.min(sx, sy)) }), {})
    outlines.push([st.id, shapeOutline({ ...el, ...star, shape: v.shape || shape, width: w, height: h, borderRadius: v.borderRadius ?? el.borderRadius })])
  })
  return outlines
}

// The SVG for a shape element in a presented deck. One whose states change
// its outline is a path, which the page script morphs (data-morph holds
// each state's outline, as "id:x,y x,y …|…").
export function shapeSvg(el) {
  const outlines = stateOutlines(el)
  if (!outlines) return shapeSvgString(el)
  const start = elementStates(el).some(st => st.id === el.initialState) ? el.initialState : ''
  return shapeSvgString(el, {
    d: outlinePath(outlines.find(([id]) => id === start)[1]),
    outlines: outlines.map(([id, points]) => `${id}:${points.map(p => p.join(',')).join(' ')}`).join('|'),
  })
}

// The steps at which a slide's elements change state, checked, in order:
// [[step, [[elementId, stateId or '' for its default], …]], …]
export function stateSteps(slide) {
  const steps = new Map()
  for (const el of slide?.elements || []) {
    const ids = elementStates(el).map(st => st.id)
    if (!ids.length || !el.stateSteps || typeof el.stateSteps !== 'object') continue
    for (const [key, state] of Object.entries(el.stateSteps)) {
      const step = Number(key)
      if (!Number.isInteger(step) || step < 1 || step > 1000 || (state && !ids.includes(state))) continue
      if (!steps.has(step)) steps.set(step, [])
      steps.get(step).push([el.id, state || ''])
    }
  }
  return [...steps.entries()].sort((a, b) => a[0] - b[0])
}

// For a slide's section: an invisible fragment per step at which elements
// change state, which reveal.js counts with the slide's other fragments
export function stepMarkers(slide) {
  return stateSteps(slide).map(([step, changes]) =>
    `<span class="fragment" data-fragment-index="${step}" data-st-steps="${changes.map(([id, st]) => `${id}:${st}`).join(' ')}" aria-hidden="true" style="position:absolute;"></span>`).join('')
}

// The page CSS for the states of a deck's elements, from checked values only.
// Each state is a rule for the element while a click (or step) has put it in
// that state and no hover has changed it, or while a hover has. The rules are
// no more specific than a class, so the rule that hides elements still wins,
// but a state's position, size, turn and opacity override the element's own.
export function statesCss(slides) {
  const rules = []
  for (const slide of slides || []) {
    for (const el of slide?.elements || []) {
      const states = elementStates(el)
      if (!states.length) continue
      const values = states.map(stateValues)
      const base = `[data-el="${el.id}"]`
      const where = sel => `.reveal .slides :where(${sel})`
      // Turning and scaling animate between lists of the same functions
      const turns = values.some(v => v.flipX || v.flipY || v.scale != null)
      const transform = v => `perspective(1000px) rotateX(${v.flipY || 0}deg) rotateY(${v.flipX || 0}deg) scale(${v.scale ?? 1})`
      const own = [turns && `transform:${transform({})}`, el.backfaceHidden === true && 'backface-visibility:hidden'].filter(Boolean)
      if (own.length) rules.push(`${where(base)} { ${own.join('; ')}; }`)
      const line = el.shape === 'line' || el.shape === 'line-arrow'
      states.forEach((st, i) => {
        const v = values[i]
        const on = [`${base}[data-st="${st.id}"]:not([data-hover-st])`, `${base}[data-hover-st="${st.id}"]`]
        const decl = [`--st-dur:${v.duration}ms`, `--st-ease:${v.easing}`]
        for (const [key, prop] of [['x', 'left'], ['y', 'top'], ['width', 'width'], ['height', 'height']]) {
          if (v[key] != null) decl.push(`${prop}:${v[key]}px !important`)
        }
        if (v.rotation != null) decl.push(`rotate:${v.rotation}deg !important`)
        if (v.zIndex != null) decl.push(`z-index:${v.zIndex} !important`)
        if (turns) decl.push(`transform:${transform(v)}`)
        rules.push(`${where(on.join(', '))} { ${decl.join('; ')}; }`)
        // Not while it's a fragment still to come
        if (v.opacity != null) rules.push(`${where(on.map(s => `${s}:not(.fragment:not(.visible))`).join(', '))} { opacity:${v.opacity} !important; }`)
        // A line is drawn in its stroke color, or its fill color when it has no stroke
        const lineColor = v.stroke || (el.stroke && el.stroke !== 'none' ? null : v.fill)
        const paint = (line ? [lineColor && `stroke:${lineColor}`] : [v.fill && `fill:${v.fill}`, v.stroke && `stroke:${v.stroke}`]).filter(Boolean)
        if (paint.length) rules.push(`${where(on.join(', '))} > svg > ${line ? ':is(line, polyline)' : 'g'} { ${paint.join('; ')}; }`)
        if (v.textColor) rules.push(`${where(on.join(', '))} > svg > text { fill:${v.textColor}; }`)
        if (v.filterBrightness != null || v.filterContrast != null || v.filterGrayscale != null) {
          const b = v.filterBrightness ?? clamp(el.filterBrightness, 0, 400) ?? 100
          const c = v.filterContrast ?? clamp(el.filterContrast, 0, 400) ?? 100
          const g = v.filterGrayscale ?? clamp(el.filterGrayscale, 0, 100) ?? 0
          rules.push(`${where(on.join(', '))} img { filter:brightness(${b}%) contrast(${c}%) grayscale(${g}%) !important; }`)
        }
      })
    }
  }
  return rules.map(r => `\n    ${r}`).join('')
}

// A slide section's id, for slide links
export function slideIdAttr(slide) {
  return slide?.id ? ` id="${escapeAttr(slideAnchor(slide.id))}"` : ''
}

const SLIDE_LINK_RE = /#\/s-([A-Za-z0-9_-]+)/g

// `slides` with their slide links and click actions pointed at new slide ids,
// for slides copied under new ids (imported, or made from a template). Links
// to slides not in `idMap` (old id → new id) are left as they are.
export function remapSlideLinks(slides, idMap) {
  const map = idMap instanceof Map ? idMap : new Map(Object.entries(idMap))
  const remapElement = el => {
    let next = el
    const json = JSON.stringify(el)
    if (json.includes('#/s-')) {
      next = JSON.parse(json.replace(SLIDE_LINK_RE, (link, id) => map.has(id) ? `#/s-${map.get(id)}` : link))
    }
    if (next.clickAction?.type === 'slide' && map.has(next.clickAction.slideId)) {
      next = { ...next, clickAction: { ...next.clickAction, slideId: map.get(next.clickAction.slideId) } }
    }
    return next
  }
  return slides.map(slide => ({ ...slide, elements: (slide.elements || []).map(remapElement) }))
}

// `elements` with their show/hide actions, on click and on hover, pointed at
// new element ids, for a slide's elements copied under new ids. Ids not in
// `idMap` are left as they are.
export function remapElementRefs(elements, idMap) {
  const map = idMap instanceof Map ? idMap : new Map(Object.entries(idMap))
  const remap = action => {
    if (action?.type !== 'visibility') return action
    const next = { ...action }
    for (const key of VISIBILITY_KEYS) {
      if (Array.isArray(action[key])) next[key] = action[key].map(id => map.get(id) ?? id)
    }
    if (Array.isArray(action.set)) next.set = action.set.map(s => s && map.has(s.id) ? { ...s, id: map.get(s.id) } : s)
    return next
  }
  return elements.map(el => {
    if (el.clickAction?.type !== 'visibility' && el.hoverAction?.type !== 'visibility') return el
    const next = { ...el }
    if (el.clickAction) next.clickAction = remap(el.clickAction)
    if (el.hoverAction) next.hoverAction = remap(el.hoverAction)
    return next
  })
}

// `elements` under new ids from `makeId`, with their show/hide actions
// following them, for a slide's elements copied to a new slide
export function renewElementIds(elements, makeId) {
  const ids = new Map()
  const renewed = (elements || []).map(el => {
    const id = makeId()
    if (el.id) ids.set(el.id, id)
    return { ...el, id }
  })
  return remapElementRefs(renewed, ids)
}

// `slides` under new ids from `makeId`, and their elements too, with slide
// links and show/hide actions following them, for slides copied into a deck
// (imported, forked, or made from a template)
export function renewSlideIds(slides, makeId) {
  const ids = new Map()
  const renewed = (slides || []).map(slide => {
    const id = makeId()
    if (slide.id) ids.set(slide.id, id)
    return { ...slide, id, elements: renewElementIds(slide.elements, makeId) }
  })
  return remapSlideLinks(renewed, ids)
}

// How many elements link to the slide with `slideId`, by click action or by a
// link in their text
export function countLinksTo(slides, slideId) {
  if (!slideId) return 0
  const linksTo = el => (el.clickAction?.type === 'slide' && el.clickAction.slideId === slideId)
    || [...JSON.stringify(el).matchAll(SLIDE_LINK_RE)].some(m => m[1] === slideId)
  return (slides || []).reduce((n, slide) => n + (slide.elements || []).filter(linksTo).length, 0)
}

// Page CSS for presented decks. Fragments keep reveal.js's own transitions.
export const CLICK_ACTION_CSS = `
    .reveal .slides [data-action] { cursor:pointer; }
    .reveal .slides [data-action]:not(.fragment), .reveal .slides [data-el]:not(.fragment) { transition:filter 0.15s, translate 0.15s, scale 0.15s, box-shadow 0.15s, opacity 0.25s, visibility 0.25s; }
    .reveal .slides [data-action]:hover { filter:brightness(1.15); }
    .reveal .slides [data-action][data-hover]:hover { filter:none; }
    .reveal .slides [data-action][data-hover="lift"]:hover { translate:0 -4px; box-shadow:0 10px 24px rgba(0,0,0,0.35); }
    .reveal .slides [data-action][data-hover="grow"]:hover { scale:1.04; }
    .reveal .slides [data-action]:focus-visible, .reveal .slides :is([data-hover-show], [data-hover-hide], [data-hover-set]):focus-visible { outline:2px solid #818cf8; outline-offset:2px; }
    .reveal .slides [data-action] iframe { pointer-events:none; }
    .reveal .slides [data-el][data-hidden]:not([data-hover-shown]), .reveal .slides [data-el][data-hover-hidden] { opacity:0 !important; visibility:hidden !important; pointer-events:none; }
    .reveal .slides [data-el][data-st-list]:not(.fragment) { transition-property:left, top, width, height, rotate, transform, opacity, visibility, filter, translate, scale, box-shadow; transition-duration:var(--st-dur, 0.4s); transition-timing-function:var(--st-ease, ease); }
    .reveal .slides [data-st-list] > svg > *, .reveal .slides [data-st-list] img { transition:fill var(--st-dur, 0.4s) var(--st-ease, ease), stroke var(--st-dur, 0.4s) var(--st-ease, ease), filter var(--st-dur, 0.4s) var(--st-ease, ease); }
    @media (prefers-reduced-motion: reduce) { .reveal .slides [data-st-list], .reveal .slides [data-st-list] * { transition-duration:0s !important; } }`

// Page script for presented decks, after reveal.js has loaded. Slide links
// move within the page, even ones saved to open in a new tab; an element's
// action runs on click, or on Enter or Space once it has focus. Each time a
// slide opens, what its clicks showed or hid goes back to how it started.
//
// A hover lasts while the pointer is over the element or over something its
// hover shows, and a moment after (so the pointer can cross a gap onto a
// pop-up card), or while it has keyboard focus; on a touch screen a tap turns
// it on and off, unless the element has a click action, which wins. What
// hovers show and hide lies over what clicks did (data-hover-shown,
// data-hover-hidden), and goes when the hover ends or the slide changes.
//
// States work the same way: data-st is the state a click put an element in
// ('' for its default), data-hover-st the one a hover has it in, over that.
// A state moves in with its own duration and easing (statesCss), and back to
// the default with the one it's leaving. Each time a slide opens, its
// elements go back to their first state at once. Steps (stepMarkers) put
// elements in states as their marker fragments are shown, and back as
// they're hidden: an element is in the state of its latest marker shown, or
// its first state.
export const CLICK_ACTION_SCRIPT = `
    (function() {
      var HOVER = '.reveal .slides [data-hover-show], .reveal .slides [data-hover-hide], .reveal .slides [data-hover-set]';
      var hovered = [], focused = null, tapped = null, pointerType = 'mouse', keyboard = false, ending = null;
      function ids(el, key) { return (el.getAttribute(key) || '').split(' '); }
      function shownBy(source, node) {
        var shown = ids(source, 'data-hover-show');
        var slide = source.closest('section');
        for (var t = node; t && t !== slide && t.getAttribute; t = t.parentElement) {
          if (shown.indexOf(t.getAttribute('data-el')) !== -1) return true;
        }
        return false;
      }
      function sameHover(a, b) {
        return a === b || !!(a && b && a.closest('section') === b.closest('section')
          && a.getAttribute('data-hover-show') === b.getAttribute('data-hover-show')
          && a.getAttribute('data-hover-hide') === b.getAttribute('data-hover-hide')
          && a.getAttribute('data-hover-set') === b.getAttribute('data-hover-set'));
      }
      function stateOf(el) { return el.hasAttribute('data-hover-st') ? el.getAttribute('data-hover-st') : el.getAttribute('data-st') || ''; }
      // Morphing: a shape whose states change its outline moves its path's
      // points to the new state's, over the time the state moves in
      var CURVES = { ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1], linear: [0, 0, 1, 1] };
      function curve(css) {
        var m = /cubic-bezier[(]([^)]+)[)]/.exec(css || ''), c = m ? m[1].split(',').map(Number) : CURVES[(css || '').trim()] || CURVES.ease;
        var at = function(t, a, b) { return 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t; };
        return function(x) {
          var lo = 0, hi = 1, t = x;
          for (var i = 0; i < 24; i++) { t = (lo + hi) / 2; if (at(t, c[0], c[2]) < x) lo = t; else hi = t; }
          return at(t, c[1], c[3]);
        };
      }
      function outlines(path) {
        if (!path._outlines) {
          path._outlines = {};
          (path.getAttribute('data-morph') || '').split('|').forEach(function(entry) {
            var at = entry.indexOf(':');
            path._outlines[entry.slice(0, at)] = entry.slice(at + 1).split(' ').map(function(p) { return p.split(',').map(Number); });
          });
        }
        return path._outlines;
      }
      function draw(path, points) {
        path._points = points;
        path.setAttribute('d', 'M' + points.map(function(p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join('L') + 'Z');
      }
      function morph(el) {
        var path = el.querySelector('path[data-morph]');
        if (!path) return;
        var all = outlines(path), to = all[stateOf(el)] || all[''];
        var from = path._points || all[el.getAttribute('data-st-start') || ''] || to;
        if (!to || from.length !== to.length) return;
        window.cancelAnimationFrame(path._frame);
        var cs = window.getComputedStyle(el), time = (cs.getPropertyValue('--st-dur') || '').trim();
        var ms = !time ? 400 : /ms$/.test(time) ? parseFloat(time) : parseFloat(time) * 1000;
        var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!(ms > 0) || still) return draw(path, to);
        var ease = curve(cs.getPropertyValue('--st-ease')), began = null;
        var step = function(now) {
          if (began === null) began = now;
          var k = ease(Math.min(1, (now - began) / ms));
          draw(path, from.map(function(p, i) { return [p[0] + (to[i][0] - p[0]) * k, p[1] + (to[i][1] - p[1]) * k]; }));
          if (now - began < ms) path._frame = window.requestAnimationFrame(step);
        };
        path._frame = window.requestAnimationFrame(step);
      }
      function changeState(el, attr, value) {
        var before = stateOf(el), dur = '', ease = '';
        if (before) { var cs = window.getComputedStyle(el); dur = cs.getPropertyValue('--st-dur'); ease = cs.getPropertyValue('--st-ease'); }
        if (value === null) el.removeAttribute(attr); else el.setAttribute(attr, value);
        var after = stateOf(el);
        if (after === before) return;
        if (after || !dur) { el.style.removeProperty('--st-dur'); el.style.removeProperty('--st-ease'); }
        else { el.style.setProperty('--st-dur', dur); el.style.setProperty('--st-ease', ease); }
        morph(el);
      }
      function stateTarget(slide, id) {
        var els = slide.querySelectorAll('[data-st-list]');
        for (var i = 0; i < els.length; i++) if (els[i].getAttribute('data-el') === id) return els[i];
        return null;
      }
      function hasState(el, state) { return !state || ids(el, 'data-st-list').indexOf(state) !== -1; }
      function changeStates(el) {
        var slide = el.closest('section');
        var sets = ids(el, 'data-action-set');
        for (var i = 0; slide && i < sets.length; i++) {
          var parts = sets[i].split(':'), target = stateTarget(slide, parts[0]);
          if (!target) continue;
          var state = parts[1] || '', mode = parts[2], now = target.getAttribute('data-st') || '';
          var cycle = [''].concat(ids(target, 'data-st-list'));
          var next = mode === 'toggle' ? (now === state ? '' : state) : mode === 'cycle' ? cycle[(cycle.indexOf(now) + 1) % cycle.length] : state;
          if (hasState(target, next)) changeState(target, 'data-st', next);
        }
      }
      function stepped(slide) {
        var markers = Array.prototype.slice.call(slide ? slide.querySelectorAll('.fragment[data-st-steps]') : []);
        markers.sort(function(a, b) { return (+a.getAttribute('data-fragment-index') || 0) - (+b.getAttribute('data-fragment-index') || 0); });
        var states = {};
        for (var i = 0; i < markers.length; i++) {
          var shown = markers[i].classList.contains('visible'), changes = ids(markers[i], 'data-st-steps');
          for (var j = 0; j < changes.length; j++) {
            var parts = changes[j].split(':');
            if (shown) states[parts[0]] = parts[1] || '';
            else if (!(parts[0] in states)) states[parts[0]] = null; // not reached yet: its first state
          }
        }
        return states;
      }
      function stepStates(slide, now) {
        var states = stepped(slide);
        for (var id in states) {
          var el = stateTarget(slide, id);
          if (!el) continue;
          var next = states[id] === null ? el.getAttribute('data-st-start') || '' : states[id];
          if (!hasState(el, next) || (el.getAttribute('data-st') || '') === next) continue;
          if (now) el.setAttribute('data-st', next); else changeState(el, 'data-st', next);
        }
      }
      function resetStates(slide) {
        var els = slide ? slide.querySelectorAll('[data-st-list]') : [];
        for (var i = 0; i < els.length; i++) {
          els[i].style.setProperty('--st-dur', '0s');
          els[i].removeAttribute('data-hover-st');
          els[i].setAttribute('data-st', els[i].getAttribute('data-st-start') || '');
        }
        stepStates(slide, true);
        if (els.length) els[0].offsetWidth;
        for (var j = 0; j < els.length; j++) { morph(els[j]); els[j].style.removeProperty('--st-dur'); els[j].style.removeProperty('--st-ease'); }
      }
      function layer() {
        var old = document.querySelectorAll('.reveal .slides [data-hover-shown], .reveal .slides [data-hover-hidden]');
        for (var i = 0; i < old.length; i++) { old[i].removeAttribute('data-hover-shown'); old[i].removeAttribute('data-hover-hidden'); }
        var sources = [focused, tapped].concat(hovered), stated = [], states = [];
        for (var s = 0; s < sources.length; s++) {
          var source = sources[s], slide = source && source.closest('section');
          if (!slide) continue;
          var hide = ids(source, 'data-hover-hide'), show = ids(source, 'data-hover-show');
          var els = slide.querySelectorAll('[data-el]');
          for (var j = 0; j < els.length; j++) {
            var id = els[j].getAttribute('data-el');
            if (show.indexOf(id) !== -1) { els[j].setAttribute('data-hover-shown', ''); els[j].removeAttribute('data-hover-hidden'); }
            else if (hide.indexOf(id) !== -1) { els[j].setAttribute('data-hover-hidden', ''); els[j].removeAttribute('data-hover-shown'); }
          }
          var sets = ids(source, 'data-hover-set');
          for (var k = 0; k < sets.length; k++) {
            var parts = sets[k].split(':'), target = stateTarget(slide, parts[0]);
            if (!target || !hasState(target, parts[1] || '')) continue;
            var at = stated.indexOf(target);
            if (at === -1) { stated.push(target); states.push(parts[1] || ''); } else states[at] = parts[1] || '';
          }
        }
        // States change only where they differ, so they move rather than restart
        var was = document.querySelectorAll('.reveal .slides [data-hover-st]');
        for (var w = 0; w < was.length; w++) if (stated.indexOf(was[w]) === -1) changeState(was[w], 'data-hover-st', null);
        for (var t = 0; t < stated.length; t++) if (stated[t].getAttribute('data-hover-st') !== states[t]) changeState(stated[t], 'data-hover-st', states[t]);
      }
      function unhover() { clearTimeout(ending); ending = null; hovered = []; focused = null; tapped = null; layer(); }
      function hover(next) {
        clearTimeout(ending);
        ending = null;
        if (next.length === hovered.length && next.every(function(el, i) { return el === hovered[i]; })) return;
        if (next.every(function(el) { return hovered.indexOf(el) !== -1; })) {
          ending = setTimeout(function() { ending = null; hovered = next; layer(); }, 200);
          return;
        }
        hovered = next;
        layer();
      }
      document.addEventListener('pointerover', function(e) {
        pointerType = e.pointerType || 'mouse';
        if (pointerType === 'touch' || !e.target.closest) return;
        var next = hovered.filter(function(source) { return shownBy(source, e.target); });
        var source = e.target.closest(HOVER);
        if (source && next.indexOf(source) === -1) next.push(source);
        hover(next);
      });
      document.addEventListener('pointerout', function(e) {
        if (!e.relatedTarget && e.pointerType !== 'touch') hover([]);
      });
      document.addEventListener('pointerdown', function(e) { pointerType = e.pointerType || 'mouse'; keyboard = false; }, true);
      window.addEventListener('keydown', function() { keyboard = true; }, true);
      document.addEventListener('focusin', function(e) {
        var source = keyboard && e.target.closest ? e.target.closest(HOVER) : null;
        if (source === focused) return;
        focused = source;
        layer();
      });
      document.addEventListener('focusout', function() {
        if (!focused) return;
        focused = null;
        layer();
      });
      function tap(target) {
        var source = target.closest(HOVER);
        var next = source && !source.hasAttribute('data-action') ? (sameHover(source, tapped) ? null : source)
          : tapped && shownBy(tapped, target) ? tapped : null;
        if (next === tapped) return;
        tapped = next;
        layer();
      }
      function hide(el, hidden) {
        if (hidden) el.setAttribute('data-hidden', ''); else el.removeAttribute('data-hidden');
      }
      function reset(slide) {
        var els = slide ? slide.querySelectorAll('[data-el]') : [];
        for (var i = 0; i < els.length; i++) hide(els[i], els[i].hasAttribute('data-start-hidden'));
      }
      function showHide(el) {
        var slide = el.closest('section');
        var els = slide ? slide.querySelectorAll('[data-el]') : [];
        var change = function(key, fn) {
          var ids = (el.getAttribute('data-action-' + key) || '').split(' ');
          for (var i = 0; i < els.length; i++) if (ids.indexOf(els[i].getAttribute('data-el')) !== -1) fn(els[i]);
        };
        change('hide', function(t) { hide(t, true); });
        change('show', function(t) { hide(t, false); });
        change('toggle', function(t) { hide(t, !t.hasAttribute('data-hidden')); });
      }
      function run(el) {
        var type = el.getAttribute('data-action');
        if (type === 'visibility') { showHide(el); changeStates(el); return; }
        if (type === 'next') return Reveal.next();
        if (type === 'prev') return Reveal.prev();
        if (type === 'slide') {
          var target = document.getElementById(el.getAttribute('data-action-slide'));
          if (!target) return;
          var at = Reveal.getIndices(target);
          return Reveal.slide(at.h, at.v);
        }
        if (type === 'url') {
          var url = el.getAttribute('data-action-url');
          if (!/^(https?:|mailto:)/i.test(url)) return;
          if (el.hasAttribute('data-action-new-tab')) window.open(url, '_blank', 'noopener');
          else window.location.href = url;
        }
      }
      document.addEventListener('click', function(e) {
        if (!e.target.closest) return;
        if (pointerType === 'touch') tap(e.target);
        var link = e.target.closest('.reveal .slides a[href^="#/"]');
        if (link) { e.preventDefault(); window.location.hash = link.getAttribute('href'); return; }
        if (e.target.closest('a[href]')) return;
        var el = e.target.closest('.reveal .slides [data-action]');
        if (!el) return;
        e.preventDefault();
        run(el);
      });
      window.addEventListener('keydown', function(e) {
        if ((e.key !== 'Enter' && e.key !== ' ') || !e.target.closest) return;
        var el = e.target.closest('.reveal .slides [data-action]');
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        run(el);
      }, true);
      Reveal.on('slidechanged', function(e) { unhover(); reset(e.currentSlide); resetStates(e.currentSlide); });
      Reveal.on('fragmentshown', function() { stepStates(Reveal.getCurrentSlide()); });
      Reveal.on('fragmenthidden', function() { stepStates(Reveal.getCurrentSlide()); });
    })();`

// ── Editor helpers ─────────────────────────────────────────────────────────

// The first line of text in a text element's HTML
function firstLine(html) {
  return (html || '').replace(/<\/(p|h[1-6]|li|div)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split('\n').map(line => line.trim()).find(Boolean) || ''
}
const shorten = (text, max) => text.length > max ? `${text.slice(0, max - 1)}…` : text

// A copy of `el` under `id`, for pasting and duplicating: a click on it that
// shows or hides the element itself does so to the copy
export function copyElement(el, id) {
  return remapElementRefs([{ ...el, id }], new Map(el?.id ? [[el.id, id]] : []))[0]
}

// "3 · First line of text" for a slide picker
export function slideLabel(slide, index) {
  const text = (slide?.elements || [])
    .filter(el => el.type === 'text' && el.content)
    .sort((a, b) => (a.y || 0) - (b.y || 0))
    .map(el => firstLine(el.content)).find(Boolean) || ''
  return text ? `${index + 1} · ${shorten(text, 40)}` : `Slide ${index + 1}`
}

// The slide id a text link's href points to, or null
export function slideIdFromHref(href) {
  const m = /^#\/s-([A-Za-z0-9_-]+)$/.exec(href || '')
  return m ? m[1] : null
}

// "Shape 2", or a text element's first line or a shape's label, for each
// element of a slide
export function elementLabels(elements) {
  const labels = new Map()
  const counts = {}
  for (const el of elements || []) {
    const text = el.type === 'text' ? firstLine(el.content) : el.type === 'shape' ? (el.text || '').trim() : ''
    if (text) { labels.set(el.id, shorten(text, 32)); continue }
    const name = (el.type || 'element').replace(/^plugin:/, '').replace(/^./, c => c.toUpperCase())
    counts[name] = (counts[name] || 0) + 1
    labels.set(el.id, `${name} ${counts[name]}`)
  }
  return labels
}

// The first element of each group, and each ungrouped one, that `keep` keeps
function onePerGroup(elements, keep) {
  const groups = new Set()
  return (elements || []).filter(el => {
    if (!keep(el)) return false
    if (!el.groupId) return true
    if (groups.has(el.groupId)) return false
    groups.add(el.groupId)
    return true
  })
}

// The elements of a slide whose click shows or hides something, one per
// group, for previewing their clicks in the editor
export function visibilityClickers(elements) {
  return onePerGroup(elements, el => el.clickAction?.type === 'visibility' && supportsClickAction(el))
}

// The elements of a slide whose hover shows or hides something, one per group
export function hoverSources(elements) {
  return onePerGroup(elements, el => el.hoverAction?.type === 'visibility' && supportsClickAction(el))
}

// The canvas preview of the slide while the pointer is over `id`'s element
export const hoverPreview = id => `hover:${id}`

// The ids of the elements on a slide that are hidden once it opens and
// `clickerId`'s element is clicked (or as it opens, with no clicker)
export function hiddenAfterClick(elements, clickerId = null) {
  const hidden = new Set((elements || []).filter(el => el.startHidden).map(el => el.id))
  const action = clickerId && (elements || []).find(el => el.id === clickerId)?.clickAction
  if (action?.type === 'visibility') {
    idList(action.hide).forEach(id => hidden.add(id))
    idList(action.show).forEach(id => hidden.delete(id))
    idList(action.toggle).forEach(id => hidden.has(id) ? hidden.delete(id) : hidden.add(id))
  }
  return hidden
}

// ── States in the editor ──

// `el` as it looks in state `stateId` (as it is, for none or one it doesn't have)
export function withState(el, stateId) {
  const st = stateId && el?.states?.find(s => s.id === stateId)
  if (!st) return el
  const next = { ...el }
  for (const key of STATE_PROPS) if (st[key] !== undefined && st[key] !== null) next[key] = st[key]
  return next
}

// Whether `el` (in a state, from withState) can't be seen: at no opacity, or
// turned over with its back hidden
export function stateHides(el) {
  return el?.opacity === 0 || (el?.backfaceHidden === true && (flip(el.flipX) !== 0) !== (flip(el.flipY) !== 0))
}

// Whether state `stateId` hides `el`, when it can be seen without it (an
// invisible shape can still be a button)
export function hiddenByState(el, stateId) {
  const inState = withState(el, stateId)
  return inState !== el && stateHides(inState) && !stateHides(el)
}

// `el` with `updates` made while recording its state `stateId`: what a state
// can change goes into the state, and the rest to the element
export function recordIntoState(el, stateId, updates) {
  const i = (el?.states || []).findIndex(s => s.id === stateId)
  if (i < 0) return { ...el, ...updates }
  const into = {}, rest = {}
  for (const [key, value] of Object.entries(updates)) (STATE_PROPS.includes(key) ? into : rest)[key] = value
  if (!Object.keys(into).length) return { ...el, ...rest }
  const states = el.states.slice()
  states[i] = { ...states[i], ...into }
  return { ...el, ...rest, states }
}

// A new state's id
export const newStateId = () => `st_${Math.random().toString(36).slice(2, 10)}`

// The state `mode` takes an element from `now` to, given its state ids
function nextState(ids, now, state, mode) {
  const cycle = ['', ...ids]
  const next = mode === 'toggle' ? (now === state ? '' : state) : mode === 'cycle' ? cycle[(cycle.indexOf(now) + 1) % cycle.length] : (state || '')
  return cycle.includes(next) ? next : now
}

// Each element's state in a canvas preview (see hiddenInPreview), by id; ''
// or missing for its default
export function statesInPreview(elements, mode) {
  const all = elements || []
  const states = new Map()
  for (const el of all) if (elementStates(el).some(st => st.id === el.initialState)) states.set(el.id, el.initialState)
  const hovering = typeof mode === 'string' && mode.startsWith('hover:')
  const source = all.find(el => (hovering ? hoverPreview(el.id) : el.id) === mode)
  const sets = hovering ? setList(source?.hoverAction, ['set']) : source?.clickAction?.type === 'visibility' ? setList(source.clickAction) : []
  for (const s of sets) {
    const target = all.find(el => el.id === s.id)
    if (target) states.set(target.id, nextState(elementStates(target).map(st => st.id), states.get(target.id) || '', s.state || '', hovering ? 'set' : s.mode || 'set'))
  }
  return states
}

// Each element's state after `step` steps of `slide` (0 as it opens), for
// the elements whose steps change it; '' for its default
export function statesAtStep(slide, step) {
  const states = new Map()
  for (const [at, changes] of stateSteps(slide)) {
    for (const [id, state] of changes) {
      if (at <= step) states.set(id, state)
      else if (!states.has(id)) states.set(id, (slide.elements.find(el => el.id === id)?.initialState) || '')
    }
  }
  return states
}

// The ids of the elements on a slide that are hidden in a canvas preview:
// 'start', a clicker's id, or hoverPreview(id) for the slide as it opens with
// the pointer over that element
export function hiddenInPreview(elements, mode) {
  if (!mode?.startsWith?.('hover:')) return hiddenAfterClick(elements, mode === 'start' ? null : mode)
  const hidden = hiddenAfterClick(elements)
  const action = (elements || []).find(el => hoverPreview(el.id) === mode)?.hoverAction
  if (action?.type === 'visibility') {
    idList(action.hide).forEach(id => hidden.add(id))
    idList(action.show).forEach(id => hidden.delete(id))
  }
  return hidden
}

// What the editor's canvas shows of a slide while previewing its clicks and
// hovers. `mode` is 'all' (everything, with what starts hidden faded), 'start'
// (the slide as it opens), a clicker's id (the slide after that click) or
// hoverPreview(id) (the slide while that element is hovered); slides with
// show/hide preview 'start' unless told otherwise, so tab panels don't
// overlap. Selected elements stay on the canvas, faded if the preview hides them.
export function canvasClickPreview(elements, mode, selectedIds = []) {
  const all = elements || []
  const clickers = visibilityClickers(all)
  const hovers = hoverSources(all)
  const canPreview = clickers.length > 0 || hovers.length > 0 || all.some(el => el.startHidden || (el.initialState && elementStates(el).length))
  const current = !canPreview ? 'all'
    : mode === 'all' || clickers.some(c => c.id === mode) || hovers.some(h => hoverPreview(h.id) === mode) ? mode
    : 'start'
  const selected = new Set(selectedIds)
  // What's selected shows as it is, to be edited; the rest in their states
  const states = current === 'all' ? new Map() : statesInPreview(all, current)
  const hidden = current === 'all' ? new Set() : hiddenInPreview(all, current)
  const shown = !states.size ? all : all.map(el => {
    if (!states.get(el.id) || selected.has(el.id)) return el
    if (hiddenByState(el, states.get(el.id))) hidden.add(el.id)
    return withState(el, states.get(el.id))
  })
  return {
    canPreview, clickers, hovers, mode: current, states,
    elements: hidden.size ? shown.filter(el => !hidden.has(el.id) || selected.has(el.id)) : shown,
    fadedIds: new Set(current === 'all'
      ? all.filter(el => el.startHidden && !selected.has(el.id)).map(el => el.id)
      : [...hidden].filter(id => selected.has(id))),
  }
}

// The preview to switch to when `selectedId` is selected: its own click if
// it's a clicker (or in a clicker's group), else its own hover, or a click or
// hover that shows it if the current preview hides it; null to stay
export function previewForSelection(elements, selectedId, mode) {
  const el = (elements || []).find(e => e.id === selectedId)
  if (!el) return null
  const own = c => c.id === el.id || (el.groupId && c.groupId === el.groupId)
  const clickers = visibilityClickers(elements)
  const hovers = hoverSources(elements)
  const clicker = clickers.find(own)
  const hover = hovers.find(own)
  const ownMode = clicker ? clicker.id : hover ? hoverPreview(hover.id) : null
  if (ownMode) return ownMode === mode ? null : ownMode
  if (mode === 'all' || !hiddenInPreview(elements, mode).has(el.id)) return null
  const shower = clickers.find(c => ['show', 'toggle'].some(k => idList(c.clickAction[k]).includes(el.id)))
  if (shower) return shower.id
  const hoverShower = hovers.find(h => idList(h.hoverAction.show).includes(el.id))
  return hoverShower ? hoverPreview(hoverShower.id) : null
}

// A tabs component for a slide: a row of tab buttons over a panel, with each
// tab showing its content and a bar under itself, and hiding the others'.
// Tab 1 starts shown. Its parts aren't grouped, since a group shares one
// click action.
export function buildTabs(count, { slideW = 960, slideH = 540, zIndex = 1, makeId }) {
  const n = Math.max(2, Math.min(6, count))
  const mx = 80, top = 110, tabH = 44, gap = 8
  const width = slideW - 2 * mx
  const tabW = Math.min(200, (width - (n - 1) * gap) / n)
  const panelY = top + tabH + 10
  const panelH = Math.max(120, slideH - panelY - 50)
  const shape = (extra) => ({
    id: makeId(), type: 'shape', shape: 'rect', stroke: 'none', strokeWidth: 0, borderRadius: 0,
    opacity: 1, text: '', fontSize: 18, textColor: '#ffffff', ...extra,
  })
  const background = shape({ x: mx, y: panelY, width, height: panelH, zIndex, fill: 'rgba(255,255,255,0.05)', stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1, borderRadius: 8 })
  const tabs = [], bars = [], panels = []
  for (let i = 0; i < n; i++) {
    const x = mx + i * (tabW + gap)
    const hidden = i ? { startHidden: true } : {}
    tabs.push(shape({ x, y: top, width: tabW, height: tabH, zIndex: zIndex + 1, fill: 'rgba(255,255,255,0.08)', borderRadius: 6, text: `Tab ${i + 1}` }))
    bars.push(shape({ x, y: top + tabH - 4, width: tabW, height: 4, zIndex: zIndex + 2, fill: '#6366f1', ...hidden }))
    panels.push({
      id: makeId(), type: 'text', x: mx + 24, y: panelY + 16, width: width - 48, height: panelH - 32, zIndex: zIndex + 2,
      content: `<p><span style="font-size: 28px">Content for tab ${i + 1}</span></p><p><span style="font-size: 20px; color: #94a3b8">Double-click to edit. Each tab shows its own text here.</span></p>`,
      ...hidden,
    })
  }
  const switched = [...bars, ...panels].map(el => el.id)
  tabs.forEach((tab, i) => {
    const own = [bars[i].id, panels[i].id]
    tab.clickAction = { type: 'visibility', show: own, hide: switched.filter(id => !own.includes(id)) }
  })
  return [background, ...tabs, ...bars, ...panels]
}

// A hotspot for a slide: a round marker, and a card that shows while the
// pointer is over the marker (or, on a touch screen, once it's tapped). The
// card's box and text are grouped; the marker is selected after inserting
// it, so its On hover shows how.
export function buildHotspot({ slideW = 960, slideH = 540, zIndex = 1, makeId }) {
  const size = 36
  const cardW = Math.min(280, slideW - 120), cardH = 100
  const x = Math.round(slideW * 0.3), y = Math.round(slideH * 0.4)
  const cardX = Math.min(x + size + 12, slideW - cardW - 20)
  const cardY = Math.max(20, Math.min(y - 16, slideH - cardH - 20))
  const groupId = makeId()
  const marker = {
    id: makeId(), type: 'shape', shape: 'circle', x, y, width: size, height: size, zIndex,
    fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2, opacity: 1, text: 'i', fontSize: 18, textColor: '#ffffff',
  }
  const box = {
    id: makeId(), type: 'shape', shape: 'rect', x: cardX, y: cardY, width: cardW, height: cardH, zIndex: zIndex + 1,
    fill: '#1e293b', stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1, borderRadius: 8, opacity: 1, text: '', fontSize: 16, textColor: '#ffffff',
    groupId, startHidden: true,
  }
  const text = {
    id: makeId(), type: 'text', x: cardX + 4, y: cardY + 4, width: cardW - 8, height: cardH - 8, zIndex: zIndex + 2,
    content: '<p><span style="font-size: 20px">Hotspot text</span></p>',
    groupId, startHidden: true,
  }
  marker.hoverAction = { type: 'visibility', show: [box.id, text.id] }
  return [marker, box, text]
}

// A flip card: a front and a back, grouped, that turn over together when
// clicked. The back starts turned away, and each hides its back.
export function buildFlipCard({ slideW = 960, slideH = 540, zIndex = 1, makeId }) {
  const width = Math.min(320, slideW - 80), height = Math.min(200, slideH - 80)
  const x = Math.round((slideW - width) / 2), y = Math.round((slideH - height) / 2)
  const groupId = makeId()
  const face = (text, fill, z, state) => ({
    id: makeId(), type: 'shape', shape: 'rect', x, y, width, height, zIndex: z, fill, stroke: 'none', strokeWidth: 0, borderRadius: 14,
    opacity: 1, text, fontSize: 26, textColor: '#ffffff', groupId, backfaceHidden: true,
    states: [{ id: newStateId(), name: state.name, flipX: state.flip, duration: 600, easing: 'ease-in-out' }],
  })
  const front = face('Front', '#4f46e5', zIndex, { name: 'Turned over', flip: true })
  const back = face('Back', '#0f766e', zIndex + 1, { name: 'Turned away', flip: -180 })
  back.initialState = back.states[0].id
  const clickAction = { type: 'visibility', show: [], hide: [], toggle: [], set: [
    { id: front.id, state: front.states[0].id, mode: 'toggle' },
    { id: back.id, state: back.states[0].id, mode: 'toggle' },
  ] }
  return [{ ...front, clickAction }, { ...back, clickAction }]
}

// Quiz answers: a question and three answers that turn green (the first) or
// red when clicked
export function buildQuiz({ slideW = 960, slideH = 540, zIndex = 1, makeId }) {
  const mx = 100, width = slideW - 2 * mx, answerH = 56, gap = 16
  const top = Math.max(40, Math.round(slideH / 2 - (3 * answerH + 2 * gap) / 2 + 30))
  const question = {
    id: makeId(), type: 'text', x: mx, y: Math.max(20, top - 100), width, height: 70, zIndex,
    content: '<p><span style="font-size: 32px">Question?</span></p>',
  }
  const answers = ['A', 'B', 'C'].map((letter, i) => {
    const right = i === 0
    const state = { id: newStateId(), name: right ? 'Right' : 'Wrong', fill: right ? '#15803d' : '#b91c1c', stroke: right ? '#4ade80' : '#f87171', duration: 250, easing: 'ease-out' }
    const id = makeId()
    return {
      id, type: 'shape', shape: 'rect', x: mx, y: top + i * (answerH + gap), width, height: answerH, zIndex: zIndex + 1,
      fill: 'rgba(255,255,255,0.08)', stroke: 'rgba(255,255,255,0.25)', strokeWidth: 2, borderRadius: 10, opacity: 1,
      text: `Answer ${letter}`, fontSize: 22, textColor: '#ffffff',
      states: [state], clickAction: { type: 'visibility', show: [], hide: [], toggle: [], set: [{ id, state: state.id, mode: 'set' }] },
    }
  })
  return [question, ...answers]
}

// `el` made to zoom to the middle of the slide when clicked, and back when
// clicked again; null if it has another click action already
export function withClickToZoom(el, { slideW = 960, slideH = 540 } = {}) {
  if (!supportsClickAction(el) || (el.clickAction && el.clickAction.type !== 'visibility') || (el.states || []).length >= MAX_STATES) return null
  const w = el.width || 1, h = el.height || 1
  const scale = +Math.max(1, Math.min(0.85 * slideW / w, 0.85 * slideH / h)).toFixed(2)
  const state = { id: newStateId(), name: 'Zoomed', x: Math.round((slideW - w) / 2), y: Math.round((slideH - h) / 2), rotation: 0, scale, zIndex: 9000, duration: 450, easing: 'ease-in-out' }
  const action = el.clickAction || { type: 'visibility', show: [], hide: [], toggle: [] }
  const set = (action.set || []).filter(s => s.id !== el.id)
  return { ...el, states: [...(el.states || []), state], clickAction: { ...action, set: [...set, { id: el.id, state: state.id, mode: 'toggle' }] } }
}

// ── PDF ────────────────────────────────────────────────────────────────────

// Text links to slides, pointed at the printed pages' anchors (slideIdAttr)
export const printSlideLinks = html => html.replace(/href="#\/s-([A-Za-z0-9_-]+)"/g, 'href="#s-$1"')

// Links over the elements of the slide at `index` that go somewhere when
// clicked, for a printed page; `hidden(el)` says what the page doesn't show
export function printActionLinks(slides, index, hidden = () => false) {
  const px = v => Number(v) || 0
  return (slides[index]?.elements || []).map(el => {
    const action = el.clickAction
    if (!action || !supportsClickAction(el) || hidden(el)) return ''
    const slideLink = slide => slide?.id ? `#${slideAnchor(slide.id)}` : ''
    const href = action.type === 'slide' ? (action.slideId ? `#${slideAnchor(action.slideId)}` : '')
      : action.type === 'next' ? slideLink(slides[index + 1])
      : action.type === 'prev' ? slideLink(slides[index - 1])
      : action.type === 'url' ? safeActionUrl(action.url)
      : ''
    if (!href) return ''
    return `<a href="${escapeAttr(href)}" style="position:absolute;left:${px(el.x)}px;top:${px(el.y)}px;width:${px(el.width)}px;height:${px(el.height)}px;z-index:1000;display:block;"></a>`
  }).join('')
}

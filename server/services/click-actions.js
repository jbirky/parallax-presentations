// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Written by scripts/copy-click-actions.js from client/src/utils/clickActions.js;
// edit that, then run the script.

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

const { CLOSED_SHAPES, shapeOutline, outlinePath, shapeSvgString } = require('./shape-geometry')

const CLICK_ACTION_TYPES = ['slide', 'next', 'prev', 'url', 'visibility']
const HOVER_EFFECTS = ['brighten', 'lift', 'grow', 'none']
const VISIBILITY_KEYS = ['show', 'hide', 'toggle']
const HOVER_KEYS = ['show', 'hide']

// ── States ──
// What a state can change, and how it moves there
const MAX_STATES = 8
const STATE_PROPS = ['x', 'y', 'width', 'height', 'rotation', 'scale', 'flipX', 'flipY', 'opacity', 'zIndex',
  'fill', 'stroke', 'textColor', 'filterBrightness', 'filterContrast', 'filterGrayscale', 'shape', 'borderRadius']
const STATE_EASINGS = {
  ease: 'ease', 'ease-in-out': 'ease-in-out', 'ease-out': 'ease-out', 'ease-in': 'ease-in', linear: 'linear',
  spring: 'cubic-bezier(0.34,1.56,0.64,1)',
}
const DEFAULT_STATE_DURATION = 400
const SET_MODES = ['set', 'toggle', 'cycle']

// Ids and values go into the page's CSS and selectors, so only these do
const SAFE_ID = /^[A-Za-z0-9_-]+$/
const COLOR = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9.,%\s/-]+\)|[a-z]{3,20})$/i
const clamp = (v, min, max) => typeof v === 'number' && Number.isFinite(v) ? +Math.min(max, Math.max(min, v)).toFixed(2) : null
const color = v => typeof v === 'string' && COLOR.test(v.trim()) ? v.trim() : null
// Turned over (true, or -180 to turn the other way), in degrees
const flip = v => v === true || v === 180 ? 180 : v === -180 ? -180 : 0

// An element's states, the ones a page can use
function elementStates(el) {
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
function supportsClickAction(el) {
  return !!el?.type && !NO_CLICK_ACTION.has(el.type) && !el.type.startsWith('plugin:')
}

const slideAnchor = id => `s-${id}`
const slideHref = id => `#/${slideAnchor(id)}`

// Shared decks are served from the app's own origin, so a web page action
// opens only http(s) and mailto addresses, never script
function safeActionUrl(url) {
  if (typeof url !== 'string') return ''
  const trimmed = url.trim()
  return /^(https?:\/\/[^\s]|mailto:[^\s])/i.test(trimmed) ? trimmed : ''
}

const escapeAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Element ids in a show/hide list; the page separates them with spaces
const idList = list => (Array.isArray(list) ? list : []).filter(id => typeof id === 'string' && id && !/\s/.test(id))

// The ids of the elements on `slide` that a click or hover shows, hides or toggles
function visibilityTargets(slide) {
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
function clickActionAttrs(el, targets = new Set()) {
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
function shapeSvg(el) {
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
function stateSteps(slide) {
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
function stepMarkers(slide) {
  return stateSteps(slide).map(([step, changes]) =>
    `<span class="fragment" data-fragment-index="${step}" data-st-steps="${changes.map(([id, st]) => `${id}:${st}`).join(' ')}" aria-hidden="true" style="position:absolute;"></span>`).join('')
}

// The page CSS for the states of a deck's elements, from checked values only.
// Each state is a rule for the element while a click (or step) has put it in
// that state and no hover has changed it, or while a hover has. The rules are
// no more specific than a class, so the rule that hides elements still wins,
// but a state's position, size, turn and opacity override the element's own.
function statesCss(slides) {
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
function slideIdAttr(slide) {
  return slide?.id ? ` id="${escapeAttr(slideAnchor(slide.id))}"` : ''
}

const SLIDE_LINK_RE = /#\/s-([A-Za-z0-9_-]+)/g

// `slides` with their slide links and click actions pointed at new slide ids,
// for slides copied under new ids (imported, or made from a template). Links
// to slides not in `idMap` (old id → new id) are left as they are.
function remapSlideLinks(slides, idMap) {
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
function remapElementRefs(elements, idMap) {
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
function renewElementIds(elements, makeId) {
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
function renewSlideIds(slides, makeId) {
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
function countLinksTo(slides, slideId) {
  if (!slideId) return 0
  const linksTo = el => (el.clickAction?.type === 'slide' && el.clickAction.slideId === slideId)
    || [...JSON.stringify(el).matchAll(SLIDE_LINK_RE)].some(m => m[1] === slideId)
  return (slides || []).reduce((n, slide) => n + (slide.elements || []).filter(linksTo).length, 0)
}

// Page CSS for presented decks. Fragments keep reveal.js's own transitions.
const CLICK_ACTION_CSS = `
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
const CLICK_ACTION_SCRIPT = `
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

module.exports = { CLICK_ACTION_TYPES, HOVER_EFFECTS, MAX_STATES, STATE_PROPS, STATE_EASINGS, DEFAULT_STATE_DURATION, SET_MODES, elementStates, supportsClickAction, slideAnchor, slideHref, safeActionUrl, visibilityTargets, clickActionAttrs, shapeSvg, stateSteps, stepMarkers, statesCss, slideIdAttr, remapSlideLinks, remapElementRefs, renewElementIds, renewSlideIds, countLinksTo, CLICK_ACTION_CSS, CLICK_ACTION_SCRIPT }

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Click and hover actions, and slide links. In a presented deck, an element
// with a click action goes to a slide, to the next or previous one, opens a
// web page, or shows and hides elements on its slide (tabs, click-to-reveal);
// one with a hover action shows and hides elements while the pointer is over
// it (hotspots); and text can link to a slide. Slides are addressed by id, as
// #/s-<slide id>: each slide's section has that id, which reveal.js resolves
// (and shows in the address bar), so links and shared URLs keep their slide
// when slides move.
//
//   el.clickAction = { type: 'slide', slideId } | { type: 'next' } | { type: 'prev' }
//                  | { type: 'url', url, newTab }
//                  | { type: 'visibility', show: [elementId], hide: [...], toggle: [...] }
//   el.hoverAction = { type: 'visibility', show: [elementId], hide: [...] }, undone
//                    when the hover ends
//   el.hoverEffect = 'brighten' (the default) | 'lift' | 'grow' | 'none': how a
//                    clickable element looks under the pointer
//   el.startHidden = true: hidden each time its slide opens, until a click or
//                    hover shows it
//
// The server has a copy of everything above "Editor helpers" below, for the
// pages it builds (share links, GitHub and Zenodo exports), written by
// scripts/copy-click-actions.js.

export const CLICK_ACTION_TYPES = ['slide', 'next', 'prev', 'url', 'visibility']
export const HOVER_EFFECTS = ['brighten', 'lift', 'grow', 'none']
const VISIBILITY_KEYS = ['show', 'hide', 'toggle']
const HOVER_KEYS = ['show', 'hide']

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
    }
    if (el.hoverAction?.type === 'visibility') {
      for (const key of HOVER_KEYS) idList(el.hoverAction[key]).forEach(id => targets.add(id))
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
    target = VISIBILITY_KEYS.map(key => [key, idList(action[key])]).filter(([, ids]) => ids.length)
      .map(([key, ids]) => ` data-action-${key}="${escapeAttr(ids.join(' '))}"`).join('')
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
  const attrs = HOVER_KEYS.map(key => [key, idList(action[key])]).filter(([, ids]) => ids.length)
    .map(([key, ids]) => ` data-hover-${key}="${escapeAttr(ids.join(' '))}"`).join('')
  return attrs && focusable ? `${attrs} tabindex="0"` : attrs
}

// Any element, embeds included, can be shown or hidden by a click or hover
function visibilityAttrs(el, targets) {
  if (!el?.id || !(targets.has(el.id) || el.startHidden)) return ''
  return ` data-el="${escapeAttr(el.id)}"${el.startHidden ? ' data-start-hidden data-hidden' : ''}`
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
    .reveal .slides [data-action]:focus-visible, .reveal .slides [data-hover-show]:focus-visible, .reveal .slides [data-hover-hide]:focus-visible { outline:2px solid #818cf8; outline-offset:2px; }
    .reveal .slides [data-action] iframe { pointer-events:none; }
    .reveal .slides [data-el][data-hidden]:not([data-hover-shown]), .reveal .slides [data-el][data-hover-hidden] { opacity:0 !important; visibility:hidden !important; pointer-events:none; }`

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
export const CLICK_ACTION_SCRIPT = `
    (function() {
      var HOVER = '.reveal .slides [data-hover-show], .reveal .slides [data-hover-hide]';
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
          && a.getAttribute('data-hover-hide') === b.getAttribute('data-hover-hide'));
      }
      function layer() {
        var old = document.querySelectorAll('.reveal .slides [data-hover-shown], .reveal .slides [data-hover-hidden]');
        for (var i = 0; i < old.length; i++) { old[i].removeAttribute('data-hover-shown'); old[i].removeAttribute('data-hover-hidden'); }
        var sources = [focused, tapped].concat(hovered);
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
        }
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
        if (type === 'visibility') return showHide(el);
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
      Reveal.on('slidechanged', function(e) { unhover(); reset(e.currentSlide); });
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
  const canPreview = clickers.length > 0 || hovers.length > 0 || all.some(el => el.startHidden)
  const current = !canPreview ? 'all'
    : mode === 'all' || clickers.some(c => c.id === mode) || hovers.some(h => hoverPreview(h.id) === mode) ? mode
    : 'start'
  const hidden = current === 'all' ? new Set() : hiddenInPreview(all, current)
  const selected = new Set(selectedIds)
  return {
    canPreview, clickers, hovers, mode: current,
    elements: hidden.size ? all.filter(el => !hidden.has(el.id) || selected.has(el.id)) : all,
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

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Written by scripts/copy-click-actions.js from client/src/utils/clickActions.js;
// edit that, then run the script.

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

const CLICK_ACTION_TYPES = ['slide', 'next', 'prev', 'url', 'visibility']
const HOVER_EFFECTS = ['brighten', 'lift', 'grow', 'none']
const VISIBILITY_KEYS = ['show', 'hide', 'toggle']
const HOVER_KEYS = ['show', 'hide']

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
const CLICK_ACTION_SCRIPT = `
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

module.exports = { CLICK_ACTION_TYPES, HOVER_EFFECTS, supportsClickAction, slideAnchor, slideHref, safeActionUrl, visibilityTargets, clickActionAttrs, slideIdAttr, remapSlideLinks, remapElementRefs, renewElementIds, renewSlideIds, countLinksTo, CLICK_ACTION_CSS, CLICK_ACTION_SCRIPT }

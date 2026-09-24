// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Click actions and slide links. In a presented deck, an element with a click
// action goes to a slide, to the next or previous one, or opens a web page,
// and text can link to a slide. Slides are addressed by id, as #/s-<slide id>:
// each slide's section has that id, which reveal.js resolves (and shows in the
// address bar), so links and shared URLs keep their slide when slides move.
//
//   el.clickAction = { type: 'slide', slideId } | { type: 'next' } | { type: 'prev' }
//                  | { type: 'url', url, newTab }
//
// The server's services/click-actions.js has the same code for the pages it
// builds; the tests check that the two agree.

export const CLICK_ACTION_TYPES = ['slide', 'next', 'prev', 'url']

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

// The attributes that make an element clickable in a presented deck
export function clickActionAttrs(el) {
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
  } else if (action.type !== 'next' && action.type !== 'prev') {
    return ''
  }
  return ` data-action="${action.type}"${target} role="${action.type === 'url' ? 'link' : 'button'}" tabindex="0"`
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

// How many elements link to the slide with `slideId`, by click action or by a
// link in their text
export function countLinksTo(slides, slideId) {
  if (!slideId) return 0
  const linksTo = el => (el.clickAction?.type === 'slide' && el.clickAction.slideId === slideId)
    || [...JSON.stringify(el).matchAll(SLIDE_LINK_RE)].some(m => m[1] === slideId)
  return (slides || []).reduce((n, slide) => n + (slide.elements || []).filter(linksTo).length, 0)
}

// Page CSS for presented decks
export const CLICK_ACTION_CSS = `
    .reveal .slides [data-action] { cursor:pointer; transition:filter 0.15s; }
    .reveal .slides [data-action]:hover { filter:brightness(1.15); }
    .reveal .slides [data-action]:focus-visible { outline:2px solid #818cf8; outline-offset:2px; }
    .reveal .slides [data-action] iframe { pointer-events:none; }`

// Page script for presented decks, after reveal.js has loaded. Slide links
// move within the page, even ones saved to open in a new tab; an element's
// action runs on click, or on Enter or Space once it has focus.
export const CLICK_ACTION_SCRIPT = `
    (function() {
      function run(el) {
        var type = el.getAttribute('data-action');
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
    })();`

// ── Editor helpers ─────────────────────────────────────────────────────────

// "3 · First line of text" for a slide picker
export function slideLabel(slide, index) {
  const text = (slide?.elements || [])
    .filter(el => el.type === 'text' && el.content)
    .sort((a, b) => (a.y || 0) - (b.y || 0))
    .map(el => el.content.replace(/<\/(p|h[1-6]|li|div)>/gi, '\n').replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"))
    .join('\n').split('\n').map(line => line.trim()).find(Boolean) || ''
  const short = text.length > 40 ? `${text.slice(0, 39)}…` : text
  return short ? `${index + 1} · ${short}` : `Slide ${index + 1}`
}

// The slide id a text link's href points to, or null
export function slideIdFromHref(href) {
  const m = /^#\/s-([A-Za-z0-9_-]+)$/.exec(href || '')
  return m ? m[1] : null
}

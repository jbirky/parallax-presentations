// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Scrolling slides. A slide whose canvas is taller than the deck is presented
// one screen at a time, and scrolls: the section keeps the deck's height and
// holds the canvas in a scroller. It suits what is too long for one screen but
// shouldn't be cut up, like a derivation, a tall figure or a timeline.
//
//   slide.scrollHeight = the canvas height in px. Anything up to the deck's
//                        height is an ordinary slide.
//   el.scrollBehavior  = 'pin': stays on the screen while the canvas scrolls
//                        past, so its y is measured from the top of the screen.
//
// Element x/y stay canvas coordinates, so a slide stops scrolling without
// anything moving. Decks with no scrolling slide are written exactly as they
// were before scrolling slides existed. The server's
// services/scrolling-slides.js has the same code for the pages it builds; the
// tests check that the two agree.

export const MAX_SCREENS = 8

// The canvas height of a slide, in px
export function getCanvasHeight(slide, slideH) {
  const h = Math.round(Number(slide?.scrollHeight) || 0)
  return h > slideH ? Math.min(h, slideH * MAX_SCREENS) : slideH
}

// How many screens the canvas takes, counting a part screen as one
export function getScreenCount(slide, slideH) {
  return Math.ceil(getCanvasHeight(slide, slideH) / slideH)
}

export const isScrolling = (slide, slideH) => getCanvasHeight(slide, slideH) > slideH

export const isPinned = el => el?.scrollBehavior === 'pin'

export function hasScrollingSlides(presentation) {
  const slideH = presentation?.slideHeight || 540
  return (presentation?.slides || []).some(slide => isScrolling(slide, slideH))
}

// A scrolling slide's gradient or image background is painted on its canvas,
// so that it scrolls with what's on it, as the editor shows it. (A colour looks
// the same either way, and stays reveal.js's.) url turns the image's address
// into one the page can load. What could end the declaration or the attribute
// is left out.
export function canvasBackgroundStyle(bg, url = src => src) {
  const value = v => String(v).replace(/[\\;{}<>"'`\r\n]/g, '').replace(/&/g, '&amp;')
  if (bg?.type === 'gradient' && bg.gradient) return `background:${value(bg.gradient)};`
  if (bg?.type === 'image' && bg.image && !/^\s*(javascript|data|vbscript):/i.test(bg.image)) {
    return `background-image:url('${value(url(bg.image))}');background-size:${value(bg.size || 'cover')};background-position:${value(bg.position || 'center')};`
  }
  return ''
}

// A scrolling slide's section content: the canvas in its scroller, the track
// that shows how far down it is, and the pinned elements on top. The scroller
// keeps touches for itself (data-prevent-swipe) so that a finger scrolls it.
export function scrollingSlideBody({ slideW, slideH, canvasH, elementsHtml, pinnedHtml, background = '' }) {
  return `      <div class="slide-scroller" data-prevent-swipe style="position:absolute;left:0;top:0;width:${slideW}px;height:${slideH}px;overflow-x:hidden;overflow-y:auto;">
        <div class="slide-scroll-inner" style="position:relative;width:${slideW}px;height:${canvasH}px;${background}">
${elementsHtml}
        </div>
      </div>
      <div class="slide-scroll-track" aria-hidden="true"><div class="slide-scroll-thumb"></div></div>${pinnedHtml ? `\n${pinnedHtml}` : ''}`
}

// One screen of a scrolling slide, as a PDF page: the canvas moved up by the
// screens before it, which the page clips, and the pinned elements on top
export function printScreenBody({ slideW, slideH, canvasH, screen, elementsHtml, pinnedHtml, background = '' }) {
  return `<div style="position:absolute;left:0;top:${-screen * slideH}px;width:${slideW}px;height:${canvasH}px;${background}">\n${elementsHtml}\n</div>${pinnedHtml ? `\n${pinnedHtml}` : ''}`
}

// Stylesheet for decks with a scrolling slide. The scroller's own scrollbar
// gives way to a thin track on the right edge.
export const SCROLLING_CSS = `
    .reveal .slides section > .slide-scroller { overflow-x:hidden !important; overflow-y:auto !important; overscroll-behavior:contain; touch-action:pan-y pinch-zoom; scrollbar-width:none; }
    .reveal .slides section > .slide-scroller::-webkit-scrollbar { display:none; }
    .reveal .slides section .slide-scroll-inner { overflow:visible; }
    .reveal .slides section > .slide-scroll-track { position:absolute; top:0; right:0; width:4px; height:100%; z-index:940; background:rgba(127,127,127,0.12); pointer-events:none; }
    .reveal .slides section .slide-scroll-thumb { position:absolute; left:0; top:0; width:100%; height:0; background:rgba(160,160,160,0.55); border-radius:2px; }`

// What a key that moves forwards (dir 1) or back (dir -1) does on a scrolling
// slide. view is the scroller ({ top, height, max }, in canvas px) and step is
// the fragment step the key would show or hide next: null, { top, bottom } on
// the canvas, or { pinned: true } when it is on the screen whatever the
// scroll. The answer is a scroll position to go to, 'reveal' to leave the key
// to reveal.js (which shows or hides that fragment step, or changes slide),
// or 'skip' to go to the previous slide past fragments that are off screen.
//
// Going forwards, a fragment appears once the canvas has scrolled down to it,
// and the next slide comes once there is nothing left to scroll or show.
// Going back undoes that: a fragment on screen hides, then the canvas scrolls
// up, then the previous slide.
//
// Plain ES5 without backticks, as it's written into decks inside the script
// below, and the tests run this source.
export const SCROLL_STEP_SOURCE = `
      var SCROLL_STEP = 0.85;
      function scrollStep(dir, view, step) {
        var bottom = view.top + view.height;
        if (dir > 0) {
          if (step && (step.pinned || step.top < bottom)) return 'reveal';
          if (view.top < view.max - 1) return Math.min(view.max, view.top + view.height * SCROLL_STEP);
          return 'reveal';
        }
        if (step && (step.pinned || (step.top < bottom && step.bottom > view.top))) return 'reveal';
        if (view.top > 1) return Math.max(0, view.top - view.height * SCROLL_STEP);
        return step ? 'skip' : 'reveal';
      }`

// Page script for decks with a scrolling slide, after reveal.js has loaded.
// The keys that move forwards (down, J, space, page down, N) and back (up, K,
// shift+space, page up, P) scroll the canvas first, as scrollStep decides;
// what it leaves to reveal.js, and every other key, is reveal.js's as usual.
// The mouse wheel and touch scroll the canvas natively, including over embeds
// that don't use the wheel themselves, and a sideways swipe still changes
// slides. Arriving by stepping back from the next slide starts at the bottom.
export const SCROLLING_SCRIPT = `
    // ── Scrolling slides ─────────────────────────────────────────────────
    (function() {${SCROLL_STEP_SOURCE}
      var reduceMotion = false;
      try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

      function scrollerOf(slide) { return slide ? slide.querySelector(':scope > .slide-scroller') : null; }
      function canScroll(sc) { return !!sc && sc.scrollHeight > sc.clientHeight + 1; }

      // Where the canvas is, or is on its way to while a step's smooth scroll runs
      function viewOf(sc) {
        var top = sc._to != null && Date.now() - sc._toAt < 800 ? sc._to : sc.scrollTop;
        return { top: top, height: sc.clientHeight, max: sc.scrollHeight - sc.clientHeight };
      }
      function scrollToY(sc, top) {
        top = Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, top));
        sc._to = top;
        sc._toAt = Date.now();
        sc.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
      }

      // The fragment step a key would show (the lowest index still hidden) or
      // hide (the highest shown)
      function fragmentStep(slide, shown) {
        var frags = slide.querySelectorAll('.fragment'), best = null, els = [];
        for (var i = 0; i < frags.length; i++) {
          if (frags[i].classList.contains('visible') !== shown) continue;
          var index = parseInt(frags[i].getAttribute('data-fragment-index'), 10) || 0;
          if (best === null || (shown ? index > best : index < best)) { best = index; els = [frags[i]]; }
          else if (index === best) els.push(frags[i]);
        }
        return els;
      }
      // Where elements are on the canvas, or pinned: true if any is on the screen
      function extentOf(els, sc) {
        var inner = sc.firstElementChild, top = Infinity, bottom = -Infinity;
        for (var i = 0; i < els.length; i++) {
          var y = 0, node = els[i];
          while (node && node !== inner) { y += node.offsetTop; node = node.offsetParent; }
          if (node !== inner) return { pinned: true };
          top = Math.min(top, y);
          bottom = Math.max(bottom, y + els[i].offsetHeight);
        }
        return els.length ? { top: top, bottom: bottom } : null;
      }

      function keyDirection(e) {
        if (e.altKey || e.ctrlKey || e.metaKey) return 0;
        if (e.keyCode === 32) return e.shiftKey ? -1 : 1;
        if (e.shiftKey) return 0;
        if ([40, 74, 34, 78].indexOf(e.keyCode) !== -1) return 1;
        if ([38, 75, 33, 80].indexOf(e.keyCode) !== -1) return -1;
        return 0;
      }
      // Before reveal.js's own handler, which listens on the document too
      document.addEventListener('keydown', function(e) {
        var dir = keyDirection(e);
        if (!dir) return;
        var active = document.activeElement;
        if (active && (active.isContentEditable || /^(input|textarea|select)$/i.test(active.tagName))) return;
        if (Reveal.getConfig().keyboard === false || Reveal.isOverview() || Reveal.isPaused()) return;
        var slide = Reveal.getCurrentSlide(), sc = scrollerOf(slide);
        if (!canScroll(sc)) return;
        var to = scrollStep(dir, viewOf(sc), extentOf(fragmentStep(slide, dir < 0), sc));
        if (to === 'reveal') return;
        e.preventDefault();
        e.stopPropagation();
        if (to === 'skip') Reveal.prev({ skipFragments: true });
        else scrollToY(sc, to);
      }, true);

      // A fragment that appears off screen is scrolled into view
      Reveal.on('fragmentshown', function(e) {
        var sc = scrollerOf(Reveal.getCurrentSlide());
        if (!canScroll(sc)) return;
        var extent = extentOf(e.fragments || [e.fragment], sc);
        if (!extent || extent.pinned) return;
        var view = viewOf(sc), margin = 24;
        if (extent.top < view.top) scrollToY(sc, extent.top - margin);
        else if (extent.bottom > view.top + view.height) scrollToY(sc, Math.min(extent.top - margin, extent.bottom + margin - view.height));
      });

      function syncTrack(sc) {
        var thumb = sc.parentNode.querySelector(':scope > .slide-scroll-track > .slide-scroll-thumb');
        if (!thumb) return;
        var h = sc.clientHeight, max = sc.scrollHeight - h, size = Math.max(24, h * h / sc.scrollHeight);
        thumb.style.height = size + 'px';
        thumb.style.top = (max > 0 ? sc.scrollTop / max * (h - size) : 0) + 'px';
      }
      var scrollers = document.querySelectorAll('.reveal .slides section > .slide-scroller');
      for (var i = 0; i < scrollers.length; i++) (function(sc) {
        sc.addEventListener('scroll', function() { syncTrack(sc); }, { passive: true });
        // Scrolled by hand, the canvas is no longer on its way to a step's position
        var byHand = function() { sc._to = null; };
        sc.addEventListener('wheel', byHand, { passive: true });
        sc.addEventListener('touchstart', byHand, { passive: true });
      })(scrollers[i]);

      var lastIndex = -1;
      function land(e) {
        var index = Reveal.getSlides().indexOf(e.currentSlide), sc = scrollerOf(e.currentSlide);
        if (sc) {
          sc._to = null;
          sc.scrollTop = index === lastIndex - 1 ? sc.scrollHeight : 0;
          syncTrack(sc);
        }
        lastIndex = index;
      }
      Reveal.on('ready', land);
      Reveal.on('slidechanged', land);

      // The scroller keeps touches from reveal.js, so a sideways swipe on it
      // changes slides here, the way reveal.js's own swipes do
      var swipe = null;
      document.addEventListener('touchstart', function(e) {
        var on = e.touches.length === 1 && e.target.closest && e.target.closest('.slide-scroller');
        swipe = on ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
      }, { passive: true });
      document.addEventListener('touchend', function(e) {
        if (!swipe) return;
        var t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
        swipe = null;
        var config = Reveal.getConfig();
        if (config.touch === false || Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 2) return;
        if (config.navigationMode === 'linear') { if ((dx > 0) !== !!config.rtl) Reveal.prev(); else Reveal.next(); }
        else if (dx > 0) Reveal.left();
        else Reveal.right();
      }, { passive: true });
    })();`

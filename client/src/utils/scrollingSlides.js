// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Scrolling slides. A slide whose canvas is taller or wider than the deck is
// presented one screen at a time, and scrolls: the section keeps the deck's
// size and holds the canvas in a scroller. It suits what is too long for one
// screen but shouldn't be cut up, like a derivation, a tall figure or a
// timeline.
//
//   slide.scrollHeight = the canvas height in px, for a slide that scrolls down
//   slide.scrollWidth  = the canvas width in px, for one that scrolls sideways.
//                        Anything up to the deck's size is an ordinary slide.
//                        A slide scrolls one way: given both, it scrolls down.
//   el.scrollBehavior  = 'pin': stays on the screen while the canvas scrolls
//                        past, so its x and y are measured on the screen.
//
// Element x/y stay canvas coordinates, so a slide stops scrolling without
// anything moving. Decks with no scrolling slide are written exactly as they
// were before scrolling slides existed. The server's pages have it through
// server/services/deck-html.js (scripts/build-deck-html.js).

export const MAX_SCREENS = 8

// The canvas height of a slide, in px
export function getCanvasHeight(slide, slideH) {
  const h = Math.round(Number(slide?.scrollHeight) || 0)
  return h > slideH ? Math.min(h, slideH * MAX_SCREENS) : slideH
}

// The canvas width of a slide, in px: the screen's, unless it scrolls sideways
export function getCanvasWidth(slide, slideW, slideH) {
  if (getCanvasHeight(slide, slideH) > slideH) return slideW
  const w = Math.round(Number(slide?.scrollWidth) || 0)
  return w > slideW ? Math.min(w, slideW * MAX_SCREENS) : slideW
}

// Which way a slide scrolls: 'y' down, 'x' sideways, or null for an ordinary slide
export function scrollAxis(slide, slideW, slideH) {
  if (getCanvasHeight(slide, slideH) > slideH) return 'y'
  if (getCanvasWidth(slide, slideW, slideH) > slideW) return 'x'
  return null
}

// How many screens the canvas takes, counting a part screen as one
export function getScreenCount(slide, slideW, slideH) {
  return scrollAxis(slide, slideW, slideH) === 'x'
    ? Math.ceil(getCanvasWidth(slide, slideW, slideH) / slideW)
    : Math.ceil(getCanvasHeight(slide, slideH) / slideH)
}

export const isScrolling = (slide, slideW, slideH) => scrollAxis(slide, slideW, slideH) !== null

export const isPinned = el => el?.scrollBehavior === 'pin'

export function hasScrollingSlides(presentation) {
  const slideW = Number(presentation?.slideWidth) || 960
  const slideH = Number(presentation?.slideHeight) || 540
  return (presentation?.slides || []).some(slide => isScrolling(slide, slideW, slideH))
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
// that shows how far along it is, and the pinned elements on top. The scroller
// keeps touches for itself (data-prevent-swipe) so that a finger scrolls it.
// One that scrolls sideways is marked data-scroll="x".
export function scrollingSlideBody({ slideW, slideH, canvasW = slideW, canvasH = slideH, axis = 'y', elementsHtml, pinnedHtml, background = '' }) {
  const x = axis === 'x'
  const mark = x ? ' data-scroll="x"' : ''
  return `      <div class="slide-scroller"${mark} data-prevent-swipe style="position:absolute;left:0;top:0;width:${slideW}px;height:${slideH}px;${x ? 'overflow-x:auto;overflow-y:hidden;' : 'overflow-x:hidden;overflow-y:auto;'}">
        <div class="slide-scroll-inner" style="position:relative;width:${canvasW}px;height:${canvasH}px;${background}">
${elementsHtml}
        </div>
      </div>
      <div class="slide-scroll-track"${mark} aria-hidden="true"><div class="slide-scroll-thumb"></div></div>${pinnedHtml ? `\n${pinnedHtml}` : ''}`
}

// One screen of a scrolling slide, as a PDF page: the canvas moved up (or
// left) by the screens before it, which the page clips, and the pinned
// elements on top
export function printScreenBody({ slideW, slideH, canvasW = slideW, canvasH = slideH, axis = 'y', screen, elementsHtml, pinnedHtml, background = '' }) {
  const left = axis === 'x' ? -screen * slideW : 0, top = axis === 'x' ? 0 : -screen * slideH
  return `<div style="position:absolute;left:${left}px;top:${top}px;width:${canvasW}px;height:${canvasH}px;${background}">\n${elementsHtml}\n</div>${pinnedHtml ? `\n${pinnedHtml}` : ''}`
}

// Stylesheet for decks with a scrolling slide. The scroller's own scrollbar
// gives way to a thin track on the right edge, or the bottom one for a slide
// that scrolls sideways.
export const SCROLLING_CSS = `
    .reveal .slides section > .slide-scroller { overflow-x:hidden !important; overflow-y:auto !important; overscroll-behavior:contain; touch-action:pan-y pinch-zoom; scrollbar-width:none; }
    .reveal .slides section > .slide-scroller[data-scroll="x"] { overflow-x:auto !important; overflow-y:hidden !important; touch-action:pan-x pinch-zoom; }
    .reveal .slides section > .slide-scroller::-webkit-scrollbar { display:none; }
    .reveal .slides section .slide-scroll-inner { overflow:visible; }
    .reveal .slides section > .slide-scroll-track { position:absolute; top:0; right:0; width:4px; height:100%; z-index:940; background:rgba(127,127,127,0.12); pointer-events:none; }
    .reveal .slides section > .slide-scroll-track[data-scroll="x"] { top:auto; bottom:0; left:0; right:auto; width:100%; height:4px; }
    .reveal .slides section .slide-scroll-thumb { position:absolute; left:0; top:0; width:100%; height:0; background:rgba(160,160,160,0.55); border-radius:2px; }
    .reveal .slides section > .slide-scroll-track[data-scroll="x"] > .slide-scroll-thumb { width:0; height:100%; }`

// Page script for decks with a scrolling slide, after reveal.js has loaded.
// Only the mouse wheel, the trackpad and touch scroll the canvas. Keys change
// slides and show fragments as they do on any slide, and a fragment that
// appears off screen is scrolled into view. The wheel scrolls natively,
// including over embeds that don't use the wheel themselves, and an
// up-and-down wheel turns a sideways canvas too. A sideways swipe still
// changes slides: at once on a slide that scrolls down, and from the end on
// one that scrolls sideways. Arriving from the slide before starts at the
// beginning, and stepping back from the one after finds the canvas where it
// was left.
//
// Plain ES5 without backticks, as it's written into decks inside a template
// literal.
export const SCROLLING_SCRIPT = `
    // ── Scrolling slides ─────────────────────────────────────────────────
    (function() {
      var reduceMotion = false;
      try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

      function scrollerOf(slide) { return slide ? slide.querySelector(':scope > .slide-scroller') : null; }
      function sideways(sc) { return sc.getAttribute('data-scroll') === 'x'; }
      // How far along the scroller is, how much it shows, and how far it can go
      function posOf(sc) { return sideways(sc) ? sc.scrollLeft : sc.scrollTop; }
      function sizeOf(sc) { return sideways(sc) ? sc.clientWidth : sc.clientHeight; }
      function maxOf(sc) { return sideways(sc) ? sc.scrollWidth - sc.clientWidth : sc.scrollHeight - sc.clientHeight; }
      function canScroll(sc) { return !!sc && maxOf(sc) > 1; }

      // Where the canvas is, or is on its way to while a smooth scroll runs
      function viewOf(sc) {
        var start = sc._to != null && Date.now() - sc._toAt < 800 ? sc._to : posOf(sc);
        return { start: start, size: sizeOf(sc), max: maxOf(sc) };
      }
      function scrollToPos(sc, pos) {
        pos = Math.max(0, Math.min(maxOf(sc), pos));
        sc._to = pos;
        sc._toAt = Date.now();
        var to = { behavior: reduceMotion ? 'auto' : 'smooth' };
        to[sideways(sc) ? 'left' : 'top'] = pos;
        sc.scrollTo(to);
      }

      // Where elements are along the canvas, or pinned: true if any is on the screen
      function extentOf(els, sc) {
        var inner = sc.firstElementChild, x = sideways(sc), start = Infinity, end = -Infinity;
        for (var i = 0; i < els.length; i++) {
          var at = 0, node = els[i];
          while (node && node !== inner) { at += x ? node.offsetLeft : node.offsetTop; node = node.offsetParent; }
          if (node !== inner) return { pinned: true };
          start = Math.min(start, at);
          end = Math.max(end, at + (x ? els[i].offsetWidth : els[i].offsetHeight));
        }
        return els.length ? { start: start, end: end } : null;
      }

      // A fragment that appears off screen is scrolled into view
      Reveal.on('fragmentshown', function(e) {
        var sc = scrollerOf(Reveal.getCurrentSlide());
        if (!canScroll(sc)) return;
        var extent = extentOf(e.fragments || [e.fragment], sc);
        if (!extent || extent.pinned) return;
        var view = viewOf(sc), margin = 24;
        if (extent.start < view.start) scrollToPos(sc, extent.start - margin);
        else if (extent.end > view.start + view.size) scrollToPos(sc, Math.min(extent.start - margin, extent.end + margin - view.size));
      });

      function syncTrack(sc) {
        var thumb = sc.parentNode.querySelector(':scope > .slide-scroll-track > .slide-scroll-thumb');
        if (!thumb) return;
        var x = sideways(sc), size = sizeOf(sc), max = maxOf(sc), length = Math.max(24, size * size / (size + max));
        thumb.style[x ? 'width' : 'height'] = length + 'px';
        thumb.style[x ? 'left' : 'top'] = (max > 0 ? posOf(sc) / max * (size - length) : 0) + 'px';
      }
      var scrollers = document.querySelectorAll('.reveal .slides section > .slide-scroller');
      for (var i = 0; i < scrollers.length; i++) (function(sc) {
        sc.addEventListener('scroll', function() { syncTrack(sc); }, { passive: true });
        // Scrolled by hand, the canvas is no longer on its way to a fragment
        var byHand = function() { sc._to = null; };
        sc.addEventListener('wheel', byHand, { passive: true });
        sc.addEventListener('touchstart', byHand, { passive: true });
        // An up-and-down wheel turns a sideways canvas, until it reaches an end
        if (sideways(sc)) sc.addEventListener('wheel', function(e) {
          if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
          var by = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? sc.clientWidth : 1);
          if (by > 0 ? sc.scrollLeft >= maxOf(sc) - 1 : sc.scrollLeft <= 0) return;
          e.preventDefault();
          sc.scrollLeft += by;
        }, { passive: false });
      })(scrollers[i]);

      // Leaving a slide keeps its place, for stepping back to it
      var lastIndex = -1, lastScroller = null;
      function land(e) {
        if (lastScroller) lastScroller._left = posOf(lastScroller);
        var index = Reveal.getSlides().indexOf(e.currentSlide), sc = scrollerOf(e.currentSlide);
        if (sc) {
          sc._to = null;
          var pos = index === lastIndex - 1 ? sc._left || 0 : 0;
          if (sideways(sc)) sc.scrollLeft = pos;
          else sc.scrollTop = pos;
          syncTrack(sc);
        }
        lastIndex = index;
        lastScroller = sc;
      }
      Reveal.on('ready', land);
      Reveal.on('slidechanged', land);

      // The scroller keeps touches from reveal.js, so a sideways swipe on it
      // changes slides here, the way reveal.js's own swipes do. On a slide that
      // scrolls sideways the swipe scrolls the canvas, so it changes slides only
      // when it starts at the end it moves towards.
      var swipe = null;
      document.addEventListener('touchstart', function(e) {
        var sc = e.touches.length === 1 && e.target.closest && e.target.closest('.slide-scroller');
        swipe = sc ? { x: e.touches[0].clientX, y: e.touches[0].clientY, sc: sc, pos: sc.scrollLeft } : null;
      }, { passive: true });
      document.addEventListener('touchend', function(e) {
        if (!swipe) return;
        var t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y, sc = swipe.sc, pos = swipe.pos;
        swipe = null;
        var config = Reveal.getConfig();
        if (config.touch === false || Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 2) return;
        if (sideways(sc) && (dx < 0 ? pos < maxOf(sc) - 1 : pos > 1)) return;
        if (config.navigationMode === 'linear') { if ((dx > 0) !== !!config.rtl) Reveal.prev(); else Reveal.next(); }
        else if (dx > 0) Reveal.left();
        else Reveal.right();
      }, { passive: true });
    })();`

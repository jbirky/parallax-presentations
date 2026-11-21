// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Shrink text on overflow, as PowerPoint and Google Slides do for
// placeholders (a text box's sizeMode 'shrink'): its content is laid out
// 1/scale as wide and scaled down by `scale`, which is the same as smaller
// type wrapping in the same width. The box is `box`, its content the child
// `inner` (padded, with its height its own).

export const MIN_FIT = 0.3

// The height of `el`'s content: to the bottom of its last block, not its
// margin, plus its padding (el is positioned, so its children measure from it)
export function contentHeight(el) {
  const last = el.lastElementChild
  if (!last) return el.offsetHeight
  const pad = parseFloat(getComputedStyle(el).paddingBottom) || 0
  return last.offsetTop + last.offsetHeight + pad
}

// The largest scale (to 0.01) at which `inner` fits in boxW × boxH; what's
// measured is `measure` (inner, or the editor inside it)
export function fitScale(inner, boxW, boxH, measure = inner) {
  inner.style.transform = ''
  inner.style.width = `${boxW}px`
  if (contentHeight(measure) <= boxH + 0.5) return 1
  let lo = MIN_FIT
  let hi = 1
  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2
    inner.style.width = `${boxW / mid}px`
    if (contentHeight(measure) * mid <= boxH + 0.5) lo = mid
    else hi = mid
  }
  return Math.floor(lo * 100) / 100
}

// Lays `inner` out at `scale`
export function applyScale(inner, boxW, scale) {
  inner.style.width = `${boxW / scale}px`
  inner.style.transform = scale < 1 ? `scale(${scale})` : ''
  inner.style.transformOrigin = '0 0'
}

// The same in a presented deck or an exported page: every [data-fit=shrink]
// box, once fonts are in and as slides come up. No backslashes: it goes into
// a page in a template literal.
export const SHRINK_FIT_SCRIPT = `
(function () {
  function height(el) {
    var last = el.lastElementChild
    if (!last) return el.offsetHeight
    return last.offsetTop + last.offsetHeight + (parseFloat(getComputedStyle(el).paddingBottom) || 0)
  }
  function fit(box) {
    var inner = box.firstElementChild
    var w = box.clientWidth, h = box.clientHeight
    if (!inner || !w || !h) return
    inner.style.transform = ''
    inner.style.transformOrigin = '0 0'
    inner.style.width = w + 'px'
    var s = 1
    if (height(inner) > h + 0.5) {
      var lo = ${MIN_FIT}, hi = 1
      for (var i = 0; i < 9; i++) {
        var mid = (lo + hi) / 2
        inner.style.width = (w / mid) + 'px'
        if (height(inner) * mid <= h + 0.5) lo = mid; else hi = mid
      }
      s = Math.floor(lo * 100) / 100
    }
    inner.style.width = (w / s) + 'px'
    inner.style.transform = s < 1 ? 'scale(' + s + ')' : ''
  }
  function fitAll(root) {
    var boxes = (root || document).querySelectorAll('[data-fit="shrink"]')
    for (var i = 0; i < boxes.length; i++) if (boxes[i].getClientRects().length) fit(boxes[i])
  }
  window.parallaxFitText = fitAll
  function start() {
    fitAll()
    if (window.Reveal && window.Reveal.on) {
      window.Reveal.on('ready', function () { fitAll() })
      window.Reveal.on('slidechanged', function (e) { fitAll(e.currentSlide) })
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitAll() })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})();
`

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useEffect } from 'react'

// Where the pointer is from the center of `ref`'s element, as x and y from
// -1 to 1 (a half window away or more is 1), eased frame by frame and handed
// to `apply(element, x, y)`. The landing page's red and blue layers use it to
// shift against the pointer the way far things do as you move your head. It
// re-aims as the page scrolls, eases back to 0 when the pointer leaves the
// window, and does nothing for anyone who asks for less motion, or for touch,
// or while `on` is false.
export default function usePointerDepth(ref, apply, on = true) {
  useEffect(() => {
    const el = ref.current
    if (!on || !el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const clamp = v => Math.max(-1, Math.min(1, v))
    let target = { x: 0, y: 0 }
    let pointer = null
    const at = { x: 0, y: 0 }
    let frame = 0
    const step = () => {
      at.x += (target.x - at.x) * 0.12
      at.y += (target.y - at.y) * 0.12
      apply(el, at.x, at.y)
      frame = Math.abs(target.x - at.x) + Math.abs(target.y - at.y) > 0.002 ? requestAnimationFrame(step) : 0
    }
    const go = () => { if (!frame) frame = requestAnimationFrame(step) }
    const aim = () => {
      if (!pointer) return
      const r = el.getBoundingClientRect()
      target = {
        x: clamp((pointer.x - (r.left + r.width / 2)) / (window.innerWidth / 2)),
        y: clamp((pointer.y - (r.top + r.height / 2)) / (window.innerHeight / 2)),
      }
      go()
    }
    const move = e => {
      if (e.pointerType === 'touch') return
      pointer = { x: e.clientX, y: e.clientY }
      aim()
    }
    const rest = () => { pointer = null; target = { x: 0, y: 0 }; go() }
    const page = document.documentElement
    window.addEventListener('pointermove', move, { passive: true })
    // Capturing, so a scroll of the page's own scroller counts too
    document.addEventListener('scroll', aim, { capture: true, passive: true })
    page.addEventListener('mouseleave', rest)
    window.addEventListener('blur', rest)
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('scroll', aim, { capture: true })
      page.removeEventListener('mouseleave', rest)
      window.removeEventListener('blur', rest)
      cancelAnimationFrame(frame)
    }
  }, [on])
}

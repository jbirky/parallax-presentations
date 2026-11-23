// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A deck page drawn at its own 960 × 540 and scaled to the width it's
// given, so a phone shows the slide rather than reveal.js's scroll view
// (the landing page's live decks)

import { useEffect, useRef } from 'react'

export default function SlideFrame({ src, title }) {
  const ref = useRef(null)
  useEffect(() => {
    const box = ref.current
    if (!box) return
    const fit = () => box.style.setProperty('--s', String(box.clientWidth / 960))
    fit()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fit)
      return () => window.removeEventListener('resize', fit)
    }
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  return <div className="lp-slide" ref={ref}><iframe src={src} title={title} allow="fullscreen" /></div>
}

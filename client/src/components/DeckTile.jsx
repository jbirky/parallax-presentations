// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A presentation's first slide on its dashboard card, drawn as the editor's
// filmstrip draws it (SlideThumbnail), from what the lists send of it
// (server/storage/deck-tile.js). It fits the card, centered on the slide's
// own background, and is only drawn once the card is near the screen, so a
// long list costs nothing until it's scrolled to.

import { useEffect, useRef, useState } from 'react'
import SlideThumbnail from './SlideThumbnail'
import { deckTextFont } from '../utils/themes'

// The slide a list item describes: its first slide, with the background the
// list sends apart (thumbnail), or null when it sends none
export function tileSlide(pres) {
  if (!pres?.firstSlide || typeof pres.firstSlide !== 'object') return null
  return pres.thumbnail ? { ...pres.firstSlide, background: pres.thumbnail } : pres.firstSlide
}

export default function DeckTile({ pres }) {
  const ref = useRef(null)
  const [box, setBox] = useState(null)
  const [near, setNear] = useState(false)
  const slide = tileSlide(pres)
  const slideW = Number(pres.slideWidth) || 960
  const slideH = Number(pres.slideHeight) || 540

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const sized = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    sized?.observe(el)
    let seen = null
    if (typeof IntersectionObserver === 'undefined') setNear(true)
    else {
      seen = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { setNear(true); seen.disconnect() }
      }, { rootMargin: '300px' })
      seen.observe(el)
    }
    return () => { sized?.disconnect(); seen?.disconnect() }
  }, [])

  // As wide as fits the card without spilling over its height
  const width = box?.w ? Math.floor(Math.min(box.w, box.h ? box.h * slideW / slideH : box.w)) : 0

  return (
    <div ref={ref} className="deck-tile-slide" aria-hidden="true">
      {slide && near && width > 0 && (
        <SlideThumbnail slide={slide} slideW={slideW} slideH={slideH} width={width} radius={0} quiet
          globalFont={deckTextFont(pres.globalFont, pres.theme)} citationLabels={{}}
          theme={pres.theme || 'black'} textStyles={pres.textStyles || null} themeColors={pres.themeColors || null} />
      )}
    </div>
  )
}

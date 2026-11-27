// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useRef } from 'react'
import usePointerDepth from '../utils/usePointerDepth'

// The mark: the P as each eye sees it, red and blue, and where the two
// overlap in `ink`, the color of the text around it. Each use on a page
// names its own clip path with `id`. The landing page and the dashboard
// show it.
//
// `moving`: the red and blue P's shift against the pointer, the red (farther
// back) by twice the blue, and the overlap follows them (the landing page's
// closing mark, like the fringed words above it).

const P_PATH = 'M26 18H56A22 22 0 0 1 56 62H42V82H26ZM42 32H55A8 8 0 0 1 55 48H42Z'
const RED = -6, BLUE = 6
// How far each P moves at most, in the viewBox's units (72 across)
const RED_SHIFT = { x: 4, y: 2.4 }, BLUE_SHIFT = { x: 2, y: 1.2 }

// Set on the paths themselves: a clip path can't hold a <g>
const shiftEyes = (svg, x, y) => {
  for (const path of svg.querySelectorAll('[data-eye]')) {
    const [base, shift] = path.dataset.eye === 'red' ? [RED, RED_SHIFT] : [BLUE, BLUE_SHIFT]
    path.setAttribute('transform', `translate(${(base - x * shift.x).toFixed(2)} ${(-y * shift.y).toFixed(2)})`)
  }
}

export default function ParallaxMark({ id, size, className = 'lp-mark', ink = 'var(--lp-strong)', moving = false }) {
  const ref = useRef(null)
  usePointerDepth(ref, shiftEyes, moving)
  return (
    <svg ref={ref} className={className} width={size} height={size} viewBox="14 14 72 72" aria-hidden="true" focusable="false">
      <defs><clipPath id={`lp-mark-${id}`}><path data-eye="red" d={P_PATH} transform={`translate(${RED} 0)`} clipRule="evenodd" /></clipPath></defs>
      <g transform="translate(-2 0)" fillRule="evenodd">
        <path data-eye="red" d={P_PATH} transform={`translate(${RED} 0)`} fill="#ee2b2b" />
        <path data-eye="blue" d={P_PATH} transform={`translate(${BLUE} 0)`} fill="#1e60ff" />
        <g clipPath={`url(#lp-mark-${id})`}><path data-eye="blue" d={P_PATH} transform={`translate(${BLUE} 0)`} style={{ fill: ink }} /></g>
      </g>
    </svg>
  )
}

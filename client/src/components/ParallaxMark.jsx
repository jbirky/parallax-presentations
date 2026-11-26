// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The mark: the P as each eye sees it, red and blue, and where the two
// overlap in `ink`, the color of the text around it. Each use on a page
// names its own clip path with `id`. The landing page and the dashboard
// show it.

const P_PATH = 'M26 18H56A22 22 0 0 1 56 62H42V82H26ZM42 32H55A8 8 0 0 1 55 48H42Z'

export default function ParallaxMark({ id, size, className = 'lp-mark', ink = 'var(--lp-strong)' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="14 14 72 72" aria-hidden="true" focusable="false">
      <defs><clipPath id={`lp-mark-${id}`}><path d={P_PATH} transform="translate(-6 0)" clipRule="evenodd" /></clipPath></defs>
      <g transform="translate(-2 0)" fillRule="evenodd">
        <path d={P_PATH} transform="translate(-6 0)" fill="#ee2b2b" />
        <path d={P_PATH} transform="translate(6 0)" fill="#1e60ff" />
        <g clipPath={`url(#lp-mark-${id})`}><path d={P_PATH} transform="translate(6 0)" style={{ fill: ink }} /></g>
      </g>
    </svg>
  )
}

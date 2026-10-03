// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A Feynman diagram element on the canvas and in thumbnails: the whole
// diagram, with its last caption, and labels drawn by KaTeX.

import { memo, useMemo } from 'react'
import katex from 'katex'
import { feynmanSvg } from '../utils/feynmanDiagram'
import { safeSvg } from '../utils/safeHtml'

const texCache = new Map()
// A label's TeX as KaTeX's HTML, remembered since the canvas redraws often
export function texHtml(tex) {
  let html = texCache.get(tex)
  if (html === undefined) {
    html = katex.renderToString(tex, { throwOnError: false })
    if (texCache.size > 500) texCache.delete(texCache.keys().next().value)
    texCache.set(tex, html)
  }
  return html
}

function FeynmanView({ element, style }) {
  const { vertices, edges, captions, color, dimPast } = element
  const html = useMemo(() => safeSvg(feynmanSvg({ vertices, edges, captions, color, dimPast }, { labels: texHtml })), [vertices, edges, captions, color, dimPast])
  return <div style={{ width: '100%', height: '100%', ...style }} dangerouslySetInnerHTML={{ __html: html }} />
}

export default memo(FeynmanView)

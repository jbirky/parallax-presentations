// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A Venn diagram element on the canvas and in thumbnails: as at the last step
// of its build, with labels drawn by KaTeX.

import { memo, useMemo } from 'react'
import { vennSvg } from '../utils/vennDiagram'
import { safeSvg } from '../utils/safeHtml'
import { texHtml } from './FeynmanView'

function VennView({ element, style }) {
  const { sets, layout, shapes, universe, notation, outlines, expr, result, layers, regions, facts, members, verdict, captions, color } = element
  const html = useMemo(
    () => safeSvg(vennSvg({ sets, layout, shapes, universe, notation, outlines, expr, result, layers, regions, facts, members, verdict, captions, color }, { labels: texHtml })),
    [sets, layout, shapes, universe, notation, outlines, expr, result, layers, regions, facts, members, verdict, captions, color],
  )
  return <div style={{ width: '100%', height: '100%', ...style }} dangerouslySetInnerHTML={{ __html: html }} />
}

export default memo(VennView)

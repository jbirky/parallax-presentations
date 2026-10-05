// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A geometry construction on the canvas and in thumbnails: all of it, as
// saved, at the element's shape, with labels drawn by KaTeX.

import { memo, useMemo } from 'react'
import { geometrySvg } from '../utils/geometryDiagram'
import { safeSvg } from '../utils/safeHtml'
import { texHtml } from './FeynmanView'

function GeometryView({ element, style }) {
  const { script, view, theme, axes, grid, steps, start, tidy, captions, stepStart, width, height } = element
  const html = useMemo(
    () => safeSvg(geometrySvg({ script, view, theme, axes, grid, steps, start, tidy, captions, stepStart, width, height }, { labels: texHtml })),
    [script, view, theme, axes, grid, steps, start, tidy, captions, stepStart, width, height],
  )
  return <div style={{ width: '100%', height: '100%', ...style }} dangerouslySetInnerHTML={{ __html: html }} />
}

export default memo(GeometryView)

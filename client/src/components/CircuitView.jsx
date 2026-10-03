// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A circuit diagram element on the canvas and in thumbnails: the circuit as
// it ends, with its current and readings (the dots stand still here), and
// labels drawn by KaTeX.

import { memo, useMemo } from 'react'
import { circuitSvg } from '../utils/circuitDiagram'
import { safeSvg } from '../utils/safeHtml'
import { texHtml } from './FeynmanView'

function CircuitView({ element, style }) {
  const { vertices, edges, captions, color, symbols, flow, readings } = element
  const html = useMemo(
    () => safeSvg(circuitSvg({ vertices, edges, captions, color, symbols, flow, readings }, { labels: texHtml })),
    [vertices, edges, captions, color, symbols, flow, readings],
  )
  return <div style={{ width: '100%', height: '100%', ...style }} dangerouslySetInnerHTML={{ __html: html }} />
}

export default memo(CircuitView)

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A logic diagram element on the canvas and in thumbnails: every part, its
// signals as the slide starts, and labels drawn by KaTeX.

import { memo, useMemo } from 'react'
import { logicSvg } from '../utils/logicDiagram'
import { safeSvg } from '../utils/safeHtml'
import { texHtml } from './FeynmanView'

function LogicView({ element, style }) {
  const { parts, nodes, wires, captions, color, symbols, values, table } = element
  const html = useMemo(
    () => safeSvg(logicSvg({ parts, nodes, wires, captions, color, symbols, values, table }, { labels: texHtml })),
    [parts, nodes, wires, captions, color, symbols, values, table],
  )
  return <div style={{ width: '100%', height: '100%', ...style }} dangerouslySetInnerHTML={{ __html: html }} />
}

export default memo(LogicView)

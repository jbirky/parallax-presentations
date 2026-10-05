// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A free-body diagram element on the canvas and in thumbnails: every force,
// its first caption, and labels drawn by KaTeX.

import { memo, useMemo } from 'react'
import { freebodySvg } from '../utils/freebodyDiagram'
import { safeSvg } from '../utils/safeHtml'
import { texHtml } from './FeynmanView'

function FreebodyView({ element, style }) {
  const { body, surface, model, axes, motion, forceScale, values, net, forces, captions, color } = element
  const html = useMemo(
    () => safeSvg(freebodySvg({ body, surface, model, axes, motion, forceScale, values, net, forces, captions, color }, { labels: texHtml })),
    [body, surface, model, axes, motion, forceScale, values, net, forces, captions, color],
  )
  return <div style={{ width: '100%', height: '100%', ...style }} dangerouslySetInnerHTML={{ __html: html }} />
}

export default memo(FreebodyView)

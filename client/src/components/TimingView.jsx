// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A timing diagram element on the canvas and in thumbnails: every waveform,
// drawn by WaveDrom.

import { memo, useMemo } from 'react'
import { timingSvg } from '../utils/timingDiagram'
import { safeSvg } from '../utils/safeHtml'

function TimingView({ element, style }) {
  const { id, source, theme, steps } = element
  const html = useMemo(() => safeSvg(timingSvg({ id, source, theme, steps })), [id, source, theme, steps])
  return <div style={{ width: '100%', height: '100%', ...style }} dangerouslySetInnerHTML={{ __html: html }} />
}

export default memo(TimingView)

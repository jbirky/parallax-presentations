// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A periodic table element on the canvas and in thumbnails. Once it's
// selected on the canvas, pointing at a tile shows that element in its card,
// as when presenting, and double-clicking one makes it the element the card
// shows at rest (onPick).

import { memo, useEffect, useMemo, useRef } from 'react'
import { PT, PERIODIC_FIELDS, periodicSvg } from '../utils/periodicTable'
import { safeSvg } from '../utils/safeHtml'

function PeriodicView({ element, style, interactive = false, onPick }) {
  const ref = useRef(null)
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  const settings = PERIODIC_FIELDS.map(k => element[k])
  const key = JSON.stringify(settings)
  const mode = interactive ? 'canvas' : 'static'
  const html = useMemo(() => safeSvg(periodicSvg(element, { mode })), [key, mode]) // eslint-disable-line react-hooks/exhaustive-deps
  const htmlRef = useRef(html)
  htmlRef.current = html

  useEffect(() => {
    if (!interactive || !ref.current) return
    const root = ref.current
    const api = PT.attach(root, element, { mode: 'canvas', onPick: z => pickRef.current?.(z) })
    // Back to the card at rest, which pointing may have changed (cleaning up
    // after React has written the newest drawing, if there is one)
    return () => { api.destroy(); root.innerHTML = htmlRef.current }
  }, [html, interactive]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={ref} style={{ width: '100%', height: '100%', ...style }} dangerouslySetInnerHTML={{ __html: html }} />
}

export default memo(PeriodicView)

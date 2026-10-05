// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A spherical harmonics element on the canvas and in thumbnails. Once it's
// selected on the canvas, it shows the step the properties panel is editing
// and dragging turns it; the angle goes to the panel, which can keep it.
// Changing ℓ, m, the view or the step morphs the picture, as presenting does.

import { memo, useEffect, useRef, useSyncExternalStore } from 'react'
import katex from 'katex'
import { HV, HARMONICS_FIELDS, subscribeHarmonics, harmonicsVersion, harmonicsEditStep, setHarmonicsTurned } from '../utils/harmonicsView'

// Changes that morph; a slider's or typing's redraw at once
const MORPHS = ['source', 'l', 'm', 'form', 'part', 'view', 'tableMax', 'tableCell', 'projection', 'eastLeft']
const pictureAt = (el, n) => HV.stepState(HV.normalize(el), n)

function HarmonicsView({ element, interactive = false, style }) {
  const ref = useRef(null)
  const api = useRef(null)
  const last = useRef(null)
  useSyncExternalStore(subscribeHarmonics, harmonicsVersion)
  const step = interactive ? harmonicsEditStep(element.id) : 0
  const key = JSON.stringify(HARMONICS_FIELDS.map(k => element[k]))

  useEffect(() => {
    const a = HV.attach(ref.current, element, {
      mode: interactive ? 'canvas' : 'static', step, katex,
      onTurn: view => setHarmonicsTurned(element.id, view),
    })
    api.current = a
    last.current = { key, step, element }
    return () => { a.destroy(); api.current = null }
  }, [interactive, element.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const prev = last.current
    if (!api.current || !prev || (prev.key === key && prev.step === step)) return
    const a = pictureAt(prev.element, prev.step), b = pictureAt(element, step)
    const animate = interactive && (prev.step !== step || MORPHS.some(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])))
    api.current.update(element, step, animate)
    last.current = { key, step, element }
  }, [key, step]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%', ...style }} />
}

export default memo(HarmonicsView)

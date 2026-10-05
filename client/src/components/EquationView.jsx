// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// An equation element drawn by equationRuntime: on the canvas, in thumbnails
// and in the equation editor. `show` is what it shows: 'all' (every term
// colored and labeled, the default), 'rest', 'plain', or { kind: 'term',
// index }. `onReady` gets the runtime's handle each time it's drawn anew.

import { useEffect, useMemo, useRef } from 'react'
import katex from 'katex'
import { equationConfig } from '../utils/equationTerms'
import { equationRuntime } from '../utils/equationRuntime'

export default function EquationView({ element, config, show = 'all', animate = false, hover = false, onReady, style }) {
  const ref = useRef(null)
  const handle = useRef(null)
  const cfg = useMemo(() => config || equationConfig(element), [config, element])
  const key = JSON.stringify(cfg)

  useEffect(() => {
    if (!ref.current) return undefined
    const eq = equationRuntime(ref.current, { ...cfg, static: !animate, hover }, katex)
    handle.current = eq
    onReady?.(eq)
    return () => {
      eq.destroy()
      handle.current = null
    }
    // The config is compared by value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, animate, hover])

  const showKey = typeof show === 'string' ? show : `${show.kind}:${show.index}`
  useEffect(() => {
    const eq = handle.current
    if (!eq) return
    if (typeof show === 'string') eq.show(show)
    else eq.show(show.kind, show.index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showKey, key, animate, hover])

  return <div ref={ref} style={{ width: '100%', height: '100%', ...style }} />
}

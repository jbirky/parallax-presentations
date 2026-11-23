// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Speaker notes, in a strip under the slide as in PowerPoint, Keynote and
// Google Slides. Without notes it's one line to click; with them, drag its
// top edge (or focus the edge and press ↑ ↓) to make it taller or shorter.
// Its height is kept in this browser.

import { useState, useRef, useEffect } from 'react'

const HEIGHT_KEY = 'parallax-notes-height'
const MIN = 56
const maxHeight = () => Math.max(MIN, Math.round((typeof window === 'undefined' ? 800 : window.innerHeight) * 0.5))

function storedHeight() {
  try { const h = Number(localStorage.getItem(HEIGHT_KEY)); if (h >= MIN) return h } catch { /* not kept */ }
  return 110
}

export default function NotesStrip({ notes = '', onChange, slideNumber, focusRequest = 0 }) {
  const [height, setHeight] = useState(storedHeight)
  const [writing, setWriting] = useState(false)
  const textRef = useRef(null)
  const open = !!notes || writing

  const resize = h => {
    const next = Math.max(MIN, Math.min(maxHeight(), Math.round(h)))
    setHeight(next)
    try { localStorage.setItem(HEIGHT_KEY, String(next)) } catch { /* not kept */ }
  }

  useEffect(() => { if (writing && !notes) textRef.current?.focus() }, [writing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Asked to open for typing (the getting-started checklist's Add speaker notes)
  useEffect(() => {
    if (!focusRequest) return
    setWriting(true)
    requestAnimationFrame(() => textRef.current?.focus())
  }, [focusRequest])

  const startDrag = e => {
    e.preventDefault()
    const startY = e.clientY
    const startH = height
    const move = ev => resize(startH + (startY - ev.clientY))
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  if (!open) {
    return (
      <button type="button" className="notes-strip notes-strip-empty" onClick={() => setWriting(true)}>
        Click to add speaker notes
      </button>
    )
  }

  return (
    <div className="notes-strip" style={{ height }}>
      <div
        className="notes-strip-resize"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize speaker notes"
        aria-valuenow={height}
        aria-valuemin={MIN}
        aria-valuemax={maxHeight()}
        tabIndex={0}
        onMouseDown={startDrag}
        onKeyDown={e => {
          if (e.key === 'ArrowUp') { e.preventDefault(); resize(height + 16) }
          else if (e.key === 'ArrowDown') { e.preventDefault(); resize(height - 16) }
        }}
      />
      <textarea
        ref={textRef}
        className="notes-strip-text"
        aria-label={`Speaker notes for slide ${slideNumber}`}
        value={notes}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setWriting(true)}
        onBlur={() => setWriting(false)}
        placeholder="Speaker notes: only you see them, in presenter mode"
        spellCheck
      />
    </div>
  )
}

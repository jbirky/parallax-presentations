// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A right-click menu: on an element, the empty slide, or a slide in the slide
// list. Items are { label, action, shortcut, disabled, checked }, '-' for a
// line between groups, or a falsy value to leave out. It stays on screen,
// and closes on a pick, a click elsewhere, Escape, or the window losing focus.

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { keyLabel } from '../utils/shortcuts'

// The items without what's left out, and without lines at the ends or twice
export function menuItems(items) {
  const out = []
  for (const item of items) {
    if (!item) continue
    if (item === '-' && (!out.length || out[out.length - 1] === '-')) continue
    out.push(item)
  }
  while (out[out.length - 1] === '-') out.pop()
  return out
}

export default function ContextMenu({ x, y, items, onClose, label = 'Menu' }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    setPos({
      left: Math.max(4, Math.min(x, window.innerWidth - box.width - 4)),
      top: Math.max(4, Math.min(y, window.innerHeight - box.height - 4)),
    })
  }, [x, y])

  useEffect(() => {
    const onDown = e => { if (!ref.current?.contains(e.target)) onClose() }
    // Escape closes the menu and nothing else (not the selection)
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() } }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="canvas-context-menu"
      role="menu"
      aria-label={label}
      style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 10000 }}
      onContextMenu={e => e.preventDefault()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {menuItems(items).map((item, i) => item === '-'
        ? <div key={`line-${i}`} className="canvas-context-menu-separator" role="separator" />
        : (
          <button
            key={item.label}
            role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={item.checked === undefined ? undefined : !!item.checked}
            disabled={item.disabled}
            onClick={() => { onClose(); item.action() }}
          >
            <span>
              {item.checked !== undefined && <span className="menu-check">{item.checked ? '✓' : ''}</span>}
              {item.label}
            </span>
            {item.shortcut && <span className="menu-shortcut">{keyLabel(item.shortcut)}</span>}
          </button>
        ))}
    </div>,
    document.body,
  )
}

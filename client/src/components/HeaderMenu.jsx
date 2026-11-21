// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A button beside Present that opens a short menu: Share (the share link and
// who edits the presentation, as in Google Slides) and Sync (GitHub). Its
// menu looks like the menu bar's. An item is { label, icon, title, action },
// or '-' / { divider: true } for a line between groups.

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

const isDivider = item => item === '-' || item?.divider

export default function HeaderMenu({ label, icon, title, items }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const button = useRef(null)

  useEffect(() => {
    if (!open) return
    wrap.current?.querySelector('[role=menuitem]')?.focus()
    const away = e => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const onKeyDown = e => {
    if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); button.current?.focus(); return }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const rows = [...wrap.current.querySelectorAll('[role=menuitem]')]
    const at = rows.indexOf(document.activeElement)
    rows[(at + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length]?.focus()
  }

  if (!items.some(item => item && !isDivider(item))) return null
  return (
    <div ref={wrap} style={{ position: 'relative' }} onKeyDown={open ? onKeyDown : undefined}>
      <button ref={button} type="button" className="btn btn-secondary" title={title}
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        {icon}
        {label}
        <ChevronDown size={12} style={{ marginLeft: -2, opacity: 0.7 }} />
      </button>
      {open && (
        <div className="menu-dropdown" role="menu" aria-label={label}
          style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, minWidth: 180 }}>
          {items.map((item, i) => isDivider(item)
            ? <div key={i} className="menu-separator" role="separator" />
            : (
              <div className="menu-row" key={i}>
                <button type="button" role="menuitem" title={item.title}
                  onClick={() => { setOpen(false); item.action() }}>
                  <span className="menu-label" style={{ gap: 8, paddingLeft: 4 }}>{item.icon}{item.label}</span>
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

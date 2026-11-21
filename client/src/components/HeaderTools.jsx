// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The editor's top-bar buttons, in one line. When the bar runs out of room,
// the last of them go into a "More" menu, so they never push Present off the
// screen. The line is cut to one row's height and allowed to wrap: whatever
// wraps onto the hidden second row is what didn't fit.
//
// A tool is { key, label, icon, title, onClick } or, for a dropdown, the same
// with items: [{ label, icon, action }] (and { divider: true } between groups)
// in place of onClick. active marks a toggle that's on, badge is a count shown
// beside the label, and chevron shows a dropdown arrow.

import { useState, useRef, useLayoutEffect, useEffect, Fragment } from 'react'
import { ChevronDown, MoreHorizontal, Check } from 'lucide-react'

const MENU_STYLE = {
  position: 'absolute', top: 'calc(100% + 4px)', right: 0,
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 8, padding: 4, zIndex: 1000, minWidth: 170,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 2,
}
const ITEM_STYLE = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'none', border: 'none',
  color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', borderRadius: 5, textAlign: 'left', whiteSpace: 'nowrap',
}

function Badge({ count }) {
  return (
    <span style={{ fontSize: 9, background: 'var(--accent)', color: 'white', borderRadius: 8, padding: '0 4px', lineHeight: '14px', fontWeight: 700 }}>
      {count}
    </span>
  )
}

// A dropdown's items; onPick closes it
function MenuItems({ items, onPick }) {
  return items.map((item, i) => item.divider
    ? <div key={`divider-${i}`} role="separator" style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
    : (
      <button
        key={item.label}
        role="menuitem"
        style={ITEM_STYLE}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
        onClick={() => { onPick(); item.action() }}
      >
        {item.icon}{item.label}
      </button>
    ))
}

// The keys of the tools on the row's second line, out of sight
export function wrappedKeys(row) {
  const items = [...row.children]
  if (!items.length) return []
  const firstTop = items[0].offsetTop
  return items.filter(el => el.offsetTop > firstTop + 1).map(el => el.dataset.key)
}

export default function HeaderTools({ tools }) {
  const rowRef = useRef(null)
  const [hidden, setHidden] = useState([])
  // The open dropdown: a tool's key, or 'more'
  const [open, setOpen] = useState(null)
  // What changes a tool's width
  const widths = tools.map(t => `${t.key}:${t.label}:${t.badge ?? ''}`).join('|')

  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row) return
    const measure = () => {
      const next = wrappedKeys(row)
      setHidden(prev => (prev.join() === next.join() ? prev : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  }, [widths])

  // A click outside an open dropdown, or Escape, closes it
  useEffect(() => {
    if (!open) return
    const onDown = e => { if (!e.target.closest?.('[data-header-menu]')) setOpen(null) }
    const onKey = e => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // A tool that went out of sight can't stay open
  useEffect(() => {
    if (open && open !== 'more' && hidden.includes(open)) setOpen(null)
  }, [open, hidden])

  const toggle = key => setOpen(o => (o === key ? null : key))
  const overflow = tools.filter(t => hidden.includes(t.key))

  return (
    <>
      <div className="header-tools" ref={rowRef}>
        {tools.map(tool => {
          const out = hidden.includes(tool.key)
          return (
            <div key={tool.key} data-key={tool.key} data-header-menu="" aria-hidden={out || undefined}
              style={{ position: 'relative', visibility: out ? 'hidden' : undefined }}>
              <button
                className={`btn btn-secondary ${tool.active || open === tool.key ? 'active' : ''}`}
                onClick={() => (tool.items ? toggle(tool.key) : (setOpen(null), tool.onClick()))}
                title={tool.title}
                tabIndex={out ? -1 : undefined}
                aria-haspopup={tool.items ? 'menu' : undefined}
                aria-expanded={tool.items ? open === tool.key : undefined}
              >
                {tool.icon}
                {tool.label}
                {tool.badge ? <Badge count={tool.badge} /> : null}
                {tool.chevron && <ChevronDown size={12} style={{ marginLeft: 2 }} />}
              </button>
              {tool.items && open === tool.key && (
                <div role="menu" style={MENU_STYLE}>
                  <MenuItems items={tool.items} onPick={() => setOpen(null)} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {overflow.length > 0 && (
        <div data-header-menu="" style={{ position: 'relative' }}>
          <button
            className={`btn btn-secondary ${open === 'more' ? 'active' : ''}`}
            onClick={() => toggle('more')}
            title="More"
            aria-label="More"
            aria-haspopup="menu"
            aria-expanded={open === 'more'}
            style={{ padding: '6px 8px' }}
          >
            <MoreHorizontal size={14} />
          </button>
          {open === 'more' && (
            <div role="menu" style={MENU_STYLE}>
              {overflow.map(tool => tool.items ? (
                <Fragment key={tool.key}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 12px 2px' }}>{tool.label}</div>
                  <MenuItems items={tool.items} onPick={() => setOpen(null)} />
                </Fragment>
              ) : (
                <button
                  key={tool.key}
                  role="menuitem"
                  style={ITEM_STYLE}
                  title={tool.title}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  onClick={() => { setOpen(null); tool.onClick() }}
                >
                  {tool.icon}{tool.label}
                  {tool.badge ? <Badge count={tool.badge} /> : null}
                  {tool.active && <Check size={13} style={{ marginLeft: 'auto' }} aria-label="on" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

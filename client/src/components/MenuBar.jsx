// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The editor's menu bar (File, Edit, View, Insert, Format, Slide, Tools,
// Help), as in Google Slides, and the box that searches it (Alt+/).
//
// A menu is { key, label, items }. An item is { label, action, shortcut,
// disabled, checked, radio, title, items } (items: a submenu), '-' for a line
// between groups, or a falsy value to leave out.
//
// The menus keep the keyboard focus where it was, so Format › Bold applies to
// the text being edited. While one is open, the arrow keys, Enter and Escape
// move through it and nothing else gets them.

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Search } from 'lucide-react'
import { menuItems } from './ContextMenu'
import { keyLabel } from '../utils/shortcuts'

const isPick = item => item && item !== '-' && !item.disabled

// The items at `path` within `items` (path: indices of submenus)
function itemsAt(items, path) {
  let list = menuItems(items)
  for (const i of path) list = menuItems(list[i]?.items || [])
  return list
}

// The next item that can be picked, from `from`, going `step`
function nextPick(list, from, step) {
  const n = list.length
  for (let k = 1; k <= n; k++) {
    const i = ((from + step * k) % n + n) % n
    if (isPick(list[i])) return i
  }
  return -1
}

function MenuRow({ item, index, depth, active, onHover, onPick, children }) {
  const role = item.radio ? 'menuitemradio' : item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'
  const sub = !!item.items
  return (
    <div className="menu-row" style={{ position: 'relative' }}>
      <button
        type="button"
        role={role}
        aria-checked={item.checked === undefined ? undefined : !!item.checked}
        aria-haspopup={sub ? 'menu' : undefined}
        aria-expanded={sub ? !!children : undefined}
        disabled={item.disabled}
        title={item.title}
        className={active ? 'active' : undefined}
        data-depth={depth}
        onMouseDown={e => e.preventDefault()}
        onMouseEnter={() => onHover(index)}
        onClick={() => onPick(index)}
      >
        <span className="menu-label">
          <span className="menu-check">{item.checked ? (item.radio ? '•' : '✓') : ''}</span>
          {item.label}
        </span>
        {item.shortcut && <span className="menu-shortcut">{keyLabel(item.shortcut)}</span>}
        {sub && <ChevronRight size={13} className="menu-more" aria-hidden="true" />}
      </button>
      {children}
    </div>
  )
}

// A submenu, beside its item, kept on screen
function Flyout({ label, children }) {
  const ref = useRef(null)
  const [style, setStyle] = useState({ left: '100%', top: -5 })
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const next = { left: '100%', top: -5 }
    if (box.right > window.innerWidth - 4) { next.left = 'auto'; next.right = '100%' }
    if (box.bottom > window.innerHeight - 4) next.top = -5 - Math.min(box.top - 4, box.bottom - window.innerHeight + 4)
    setStyle(next)
  }, [])
  return (
    <div ref={ref} className="menu-dropdown menu-flyout" role="menu" aria-label={label} style={{ position: 'absolute', ...style }}>
      {children}
    </div>
  )
}

export default function MenuBar({ menus, label = 'Menu bar' }) {
  const list = menus.filter(Boolean)
  // The open menu's index, and the item highlighted at each level: the last
  // level's submenu is open when the level after it is there (-1: none yet)
  const [open, setOpen] = useState(null)
  const [path, setPath] = useState([])
  const barRef = useRef(null)
  const close = useCallback(() => { setOpen(null); setPath([]) }, [])

  const openMenu = (i, highlight = false) => {
    setOpen(i)
    setPath(highlight ? [nextPick(itemsAt(list[i].items, []), -1, 1)] : [])
  }

  const pick = (depth, index) => {
    const levels = path.slice(0, depth)
    const item = itemsAt(list[open].items, levels)[index]
    if (!isPick(item)) return
    if (item.items) { setPath([...levels, index, -1]); return }
    close()
    item.action?.()
  }

  const hover = (depth, index) => {
    const item = itemsAt(list[open].items, path.slice(0, depth))[index]
    setPath([...path.slice(0, depth), index, ...(item?.items && !item.disabled ? [-1] : [])])
  }

  useEffect(() => {
    if (open === null) return
    const onDown = e => { if (!barRef.current?.contains(e.target)) close() }
    const onKey = e => {
      const keys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape', 'Home', 'End', 'Tab']
      if (!keys.includes(e.key)) return
      if (e.key === 'Tab') { close(); return }
      e.preventDefault()
      e.stopPropagation()
      // The deepest level with a highlight, or an open submenu's first item
      let levels = path
      if (levels[levels.length - 1] === -1) levels = levels.slice(0, -1)
      const depth = Math.max(0, levels.length - 1)
      const current = itemsAt(list[open].items, levels.slice(0, depth))
      const at = levels[depth] ?? -1
      const item = current[at]
      const subJustOpen = path.length > 1 && path[path.length - 1] === -1
      if (e.key === 'Escape') {
        if (path.length > 1) setPath(path.slice(0, -1))
        else close()
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // In an open submenu nothing is highlighted yet: start there
        if (subJustOpen) {
          const sub = itemsAt(list[open].items, levels)
          setPath([...levels, nextPick(sub, e.key === 'ArrowDown' ? -1 : sub.length, e.key === 'ArrowDown' ? 1 : -1)])
          return
        }
        setPath([...levels.slice(0, depth), nextPick(current, at, e.key === 'ArrowDown' ? 1 : -1)])
        return
      }
      if (e.key === 'Home' || e.key === 'End') {
        setPath([...levels.slice(0, depth), nextPick(current, e.key === 'Home' ? -1 : current.length, e.key === 'Home' ? 1 : -1)])
        return
      }
      if (e.key === 'ArrowRight') {
        if (item?.items && !item.disabled) {
          const sub = itemsAt(item.items, [])
          setPath([...levels, nextPick(sub, -1, 1)])
        } else {
          openMenu((open + 1) % list.length, true)
        }
        return
      }
      if (e.key === 'ArrowLeft') {
        if (subJustOpen) setPath(levels)
        else if (depth > 0) setPath(levels.slice(0, depth))
        else openMenu((open - 1 + list.length) % list.length, true)
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (subJustOpen) setPath([...levels, nextPick(itemsAt(list[open].items, levels), -1, 1)])
        else if (item?.items && !item.disabled) setPath([...levels, nextPick(itemsAt(item.items, []), -1, 1)])
        else if (at >= 0) pick(depth, at)
      }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
    }
  })

  const renderLevel = (items, depth) => menuItems(items).map((item, i) => {
    if (item === '-') return <div key={`line-${i}`} className="menu-separator" role="separator" />
    const active = path[depth] === i
    const subOpen = active && item.items && path.length > depth + 1
    return (
      <MenuRow key={`${item.label}-${i}`} item={item} index={i} depth={depth} active={active}
        onHover={index => hover(depth, index)} onPick={index => pick(depth, index)}>
        {subOpen && <Flyout label={item.label}>{renderLevel(item.items, depth + 1)}</Flyout>}
      </MenuRow>
    )
  })

  return (
    <div ref={barRef} className="menu-bar" role="menubar" aria-label={label}>
      {list.map((menu, i) => (
        <div key={menu.key} style={{ position: 'relative' }}>
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === i}
            className={`menu-title ${open === i ? 'open' : ''}`}
            onMouseDown={e => { e.preventDefault(); open === i ? close() : openMenu(i) }}
            onKeyDown={e => {
              if (open !== null) return
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openMenu(i, true) }
              else if (e.key === 'ArrowRight') { e.preventDefault(); e.currentTarget.parentElement.nextElementSibling?.querySelector('button')?.focus() }
              else if (e.key === 'ArrowLeft') { e.preventDefault(); e.currentTarget.parentElement.previousElementSibling?.querySelector('button')?.focus() }
            }}
            onMouseEnter={() => { if (open !== null && open !== i) openMenu(i) }}
          >
            {menu.label}
          </button>
          {open === i && (
            <div className="menu-dropdown" role="menu" aria-label={menu.label} style={{ position: 'absolute', top: '100%', left: 0 }}>
              {renderLevel(menu.items, 0)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Every command in the menus, as "Insert › Science › Molecule", for the search
export function menuCommands(menus) {
  const out = []
  const walk = (items, trail) => {
    for (const item of menuItems(items)) {
      if (item === '-') continue
      if (item.items) walk(item.items, [...trail, item.label])
      else if (item.action) out.push({ ...item, trail })
    }
  }
  for (const menu of menus.filter(Boolean)) walk(menu.items, [menu.label])
  return out
}

// The commands whose name or menu has every word typed
export function searchCommands(commands, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return commands.filter(c => {
    const text = [...c.trail, c.label, c.keywords || ''].join(' ').toLowerCase()
    return words.every(w => text.includes(w))
  })
}

// Search the menus (Help › Search the menus, Alt+/)
export function MenuSearch({ menus, onClose }) {
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)
  const commands = useMemo(() => menuCommands(menus), [menus])
  const found = searchCommands(commands, query).slice(0, 12)
  const run = c => { if (!c || c.disabled) return; onClose(); c.action() }

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose} style={{ alignItems: 'flex-start', paddingTop: '12vh' }}>
      <div className="menu-search" role="dialog" aria-label="Search the menus" onMouseDown={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            autoFocus
            value={query}
            onChange={e => { setQuery(e.target.value); setAt(0) }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setAt(i => Math.min(found.length - 1, i + 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setAt(i => Math.max(0, i - 1)) }
              else if (e.key === 'Enter') { e.preventDefault(); run(found[at]) }
            }}
            placeholder="Search the menus, e.g. molecule, background, export"
            aria-label="Search the menus"
            role="combobox"
            aria-expanded={found.length > 0}
            aria-controls="menu-search-results"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14 }}
          />
        </div>
        <div id="menu-search-results" role="listbox" aria-label="Commands" style={{ maxHeight: '50vh', overflowY: 'auto', padding: 4 }}>
          {found.map((c, i) => (
            <button key={`${c.trail.join('/')}/${c.label}`} type="button" role="option" aria-selected={i === at} disabled={c.disabled}
              className={i === at ? 'active' : undefined}
              onMouseEnter={() => setAt(i)} onClick={() => run(c)}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.label}
                <span className="menu-trail">{c.trail.join(' › ')}</span>
              </span>
              {c.shortcut && <span className="menu-shortcut">{keyLabel(c.shortcut)}</span>}
            </button>
          ))}
          {query.trim() && !found.length && <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-muted)' }}>Nothing in the menus matches “{query.trim()}”.</div>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

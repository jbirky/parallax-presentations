// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The keyboard shortcuts sheet (Ctrl+/, or Help › Keyboard shortcuts), from
// the table the keyboard handler uses (utils/shortcuts.js), with a search

import { useEffect, useState } from 'react'
import { X, Search } from 'lucide-react'
import { SHORTCUT_GROUPS, keyLabel } from '../utils/shortcuts'

// The groups' rows whose name or keys have every word typed
export function findShortcuts(query, groups = SHORTCUT_GROUPS) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return groups.map(group => ({
    ...group,
    items: group.items.filter(([what, keys]) => {
      const text = `${group.name} ${what} ${keyLabel(keys)}`.toLowerCase()
      return words.every(w => text.includes(w))
    }),
  })).filter(group => group.items.length)
}

export default function KeyboardShortcuts({ onClose }) {
  const [query, setQuery] = useState('')
  useEffect(() => {
    // Escape closes the sheet and nothing else
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  const groups = findShortcuts(query)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-labelledby="shortcuts-title" onClick={e => e.stopPropagation()} style={{ maxWidth: 680, width: '92vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
          <h2 id="shortcuts-title" style={{ margin: 0, fontSize: 16 }}>Keyboard shortcuts</h2>
          <button className="btn-icon" onClick={onClose} title="Close" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="insert-search" style={{ margin: '0 0 14px' }}>
          <Search size={13} aria-hidden="true" />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search, e.g. bold, group, slide" aria-label="Search the shortcuts" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '16px 28px', maxHeight: '60vh', overflowY: 'auto' }}>
          {groups.map(group => (
            <section key={group.name}>
              <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: '0 0 6px' }}>{group.name}</h3>
              <dl style={{ margin: 0 }}>
                {group.items.map(([what, keys]) => (
                  <div key={what} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <dt style={{ color: 'var(--text-secondary)' }}>{what}</dt>
                    <dd style={{ margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>{keyLabel(keys)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          {!groups.length && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No shortcut matches “{query.trim()}”.</p>}
        </div>
      </div>
    </div>
  )
}

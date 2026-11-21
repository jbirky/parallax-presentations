// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The keyboard shortcuts sheet (Ctrl+/, or the keyboard button in the top
// bar), from utils/shortcuts.js

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { SHORTCUT_GROUPS, keyLabel } from '../utils/shortcuts'

export default function KeyboardShortcuts({ onClose }) {
  useEffect(() => {
    // Escape closes the sheet and nothing else
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-labelledby="shortcuts-title" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, width: '92vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 id="shortcuts-title" style={{ margin: 0, fontSize: 16 }}>Keyboard shortcuts</h2>
          <button className="btn-icon" onClick={onClose} title="Close" aria-label="Close"><X size={16} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px 28px' }}>
          {SHORTCUT_GROUPS.map(group => (
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
        </div>
      </div>
    </div>
  )
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The frame the diagram editors share: a full-window dialog with a header
// (its name, a line saying what to do next, templates, actions, a link to
// its docs page), tools down the left, the drawing in the middle, a side
// panel on the right, and Cancel and Insert or Save at the foot. Keys
// pressed inside don't reach the slide editor's own shortcuts.
//
// The geometry editor is the first on it; the Feynman, circuit, logic,
// free-body, Venn and timing editors still have their own copies.

import { X } from 'lucide-react'

export const ui = {
  input: {
    padding: '5px 7px', background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', borderRadius: 4,
    color: 'var(--text-primary, #fff)', fontSize: 12, boxSizing: 'border-box', width: '100%', minWidth: 0,
  },
  mono: "'Fira Code','JetBrains Mono',monospace",
  smallLabel: { fontSize: 11, color: 'var(--text-muted, #888)' },
  sectionTitle: { fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted, #888)' },
  iconButton: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #888)', padding: 3, display: 'flex', alignItems: 'center' },
  smallButton: { fontSize: 12, padding: '4px 10px' },
  section: { display: 'flex', flexDirection: 'column', gap: 7 },
  row: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  check: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' },
  warn: '#f5a524',
}

// A choice of a few, as a row of buttons
export function Segmented({ value, onChange, options, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'inline-flex', padding: 2, gap: 2, borderRadius: 6, border: '1px solid var(--border, #333)', background: 'var(--bg-hover, #252530)', flexWrap: 'wrap' }}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          style={{ border: 'none', borderRadius: 4, padding: '3px 9px', fontSize: 12, cursor: 'pointer', color: value === v ? '#fff' : 'var(--text-secondary, #ccc)', background: value === v ? 'var(--accent, #6366f1)' : 'none' }}>
          {text}
        </button>
      ))}
    </div>
  )
}

// Tabs over the side panel
export function PanelTabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 2, padding: '0 10px', borderBottom: '1px solid var(--border, #333)', flex: 'none' }}>
      {tabs.map(([k, t]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          style={{ border: 'none', background: 'none', padding: '8px 9px', fontSize: 12.5, cursor: 'pointer', color: value === k ? 'var(--text-primary, #fff)' : 'var(--text-muted, #888)', fontWeight: value === k ? 600 : 400, borderBottom: `2px solid ${value === k ? 'var(--accent, #6366f1)' : 'transparent'}`, marginBottom: -1 }}>
          {t}
        </button>
      ))}
    </div>
  )
}

export default function DiagramEditorFrame({
  title, hint, templates, onTemplate, actions, help, onClose, dialogRef, onKeyDown,
  left, leftWidth = 112, right, rightWidth = 320, children, busy = false,
  onCancel, onSave, saveLabel = 'Save', saveDisabled = false,
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={dialogRef} role="dialog" aria-label={title} tabIndex={-1}
        onKeyDown={ev => { ev.stopPropagation(); onKeyDown?.(ev) }}
        style={{ background: 'var(--bg-card, #1e1e2e)', borderRadius: 12, width: 'min(1400px, 96vw)', height: 'min(900px, 94vh)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border, #333)', overflow: 'hidden', outline: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', borderBottom: '1px solid var(--border, #333)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary, #fff)' }}>{title}</span>
          <span role="status" style={{ ...ui.smallLabel, fontSize: 12, flex: '1 1 260px', minWidth: 0 }}>{hint}</span>
          <div style={ui.row}>
            {templates && (
              <select aria-label="Start from a template" value="" disabled={busy} onChange={e => onTemplate?.(e.target.value)} style={{ ...ui.input, width: 'auto' }}>
                <option value="" disabled>Start from…</option>
                {templates.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
              </select>
            )}
            {actions}
          </div>
          {help && <a href={`/#docs/${help}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>How to use</a>}
          <button onClick={onCancel || onClose} aria-label="Close" style={ui.iconButton}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {left && (
            <div style={{ width: leftWidth, flex: 'none', borderRight: '1px solid var(--border, #333)', overflowY: 'auto', opacity: busy ? 0.4 : 1, pointerEvents: busy ? 'none' : undefined }}>
              {left}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 14, gap: 8 }}>{children}</div>
          {right && (
            <div style={{ width: rightWidth, flex: 'none', borderLeft: '1px solid var(--border, #333)', display: 'flex', flexDirection: 'column', minHeight: 0, fontSize: 12, color: 'var(--text-secondary, #ccc)' }}>
              {right}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border, #333)' }}>
          <button className="btn btn-secondary" onClick={onCancel || onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saveDisabled}>{saveLabel}</button>
        </div>
      </div>
    </div>
  )
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The present-mode annotation sessions of a presentation: view one read-only,
// keep drawing on it, export it with its ink as PDF or HTML, rename or delete
// it. The editor does the work; this only lists the sessions.

import { useState, useRef } from 'react'
import { Eye, Pencil, Play, Download, FileDown, Trash2, X } from 'lucide-react'

const when = set => new Date(set.updatedAt || set.createdAt)
  .toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

function summary(set) {
  const slides = Object.values(set.slides || {}).filter(s => s.paths?.length).length
  const boards = (set.boards || []).length
  return [
    `${slides} ${slides === 1 ? 'slide' : 'slides'}`,
    boards ? `${boards} ${boards === 1 ? 'board' : 'boards'}` : '',
  ].filter(Boolean).join(' · ')
}

const actionStyle = { fontSize: 11, padding: '3px 8px', gap: 4 }

export default function AnnotationSessionsModal({ sets, onView, onContinue, onExportPdf, onExportHtml, onRename, onDelete, onClose }) {
  const [renaming, setRenaming] = useState(null) // { id, name }
  const [exporting, setExporting] = useState(null)
  const cancelled = useRef(false) // Escape, so the blur that follows doesn't save

  const finishRename = () => {
    if (renaming && !cancelled.current) onRename(renaming.id, renaming.name)
    cancelled.current = false
    setRenaming(null)
  }
  const exportHtml = async set => {
    setExporting(set.id)
    try { await onExportHtml(set) } catch (e) { alert('Export failed: ' + e.message) }
    setExporting(null)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 620, maxWidth: '92vw', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>Annotation sessions</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }} aria-label="Close"><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
          The ink from each time you presented with the pen. Exports and views include the ink, and nothing else here changes the slides.
        </p>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {sets.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 24 }}>
              No sessions yet. Present, press D to draw, and your ink is kept here.
            </p>
          ) : sets.map(set => (
            <div key={set.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {renaming?.id === set.id ? (
                  <input
                    className="prop-input"
                    autoFocus
                    value={renaming.name}
                    onChange={e => setRenaming({ id: set.id, name: e.target.value })}
                    onBlur={finishRename}
                    onKeyDown={e => {
                      if (e.key === 'Enter') finishRename()
                      if (e.key === 'Escape') { e.stopPropagation(); cancelled.current = true; setRenaming(null) }
                    }}
                    aria-label="Session name"
                    style={{ width: '100%', fontSize: 13 }}
                  />
                ) : (
                  <button
                    onClick={() => { cancelled.current = false; setRenaming({ id: set.id, name: set.name }) }}
                    title="Rename"
                    style={{ all: 'unset', cursor: 'text', display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{set.name}</span>
                    <Pencil size={11} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                  </button>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{when(set)} · {summary(set)}</div>
              </div>
              <button className="btn btn-secondary" style={actionStyle} onClick={() => onView(set)} title="Present with this session's ink, without the pen">
                <Eye size={12} /> View
              </button>
              <button className="btn btn-secondary" style={actionStyle} onClick={() => onContinue(set)} title="Present with the pen, and keep adding to this session">
                <Play size={12} /> Continue
              </button>
              <button className="btn btn-secondary" style={actionStyle} onClick={() => onExportPdf(set)} title="Print or save the slides with this session's ink as a PDF">
                <Download size={12} /> PDF
              </button>
              <button className="btn btn-secondary" style={actionStyle} disabled={exporting === set.id} onClick={() => exportHtml(set)} title="Download the slides with this session's ink as one HTML file that works offline">
                <FileDown size={12} /> {exporting === set.id ? 'Exporting…' : 'HTML'}
              </button>
              <button
                className="btn btn-ghost"
                style={{ padding: 4 }}
                onClick={() => { if (confirm(`Delete "${set.name}" and its ink? This can't be undone.`)) onDelete(set.id) }}
                title="Delete this session"
                aria-label={`Delete ${set.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

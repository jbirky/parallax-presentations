// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The TikZ diagram editor (tools/tikz-editor.html) in a frame, for adding or
// editing a TikZ diagram element. The frame shares this page's origin, so it's
// driven directly through its window.tikzEditorApi.

import { useEffect, useRef, useState } from 'react'
import { localizeLibraries } from '../utils/libraries'

// onSave gets { state, tikz, svg, width, height }
export default function TikzEditorModal({ initialState = null, dark = false, onSave, onClose }) {
  const frameRef = useRef(null)
  const [html, setHtml] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    // Loaded when first opened; its libraries come from this app's copies
    import('../tools/tikz-editor.html?raw')
      .then(m => setHtml(localizeLibraries(m.default)))
      .catch(err => setMessage(`Couldn’t load the editor: ${err.message}`))
  }, [])

  const api = () => frameRef.current?.contentWindow?.tikzEditorApi

  function start() {
    if (!api()) return setMessage('The editor didn’t start. Close this and try again.')
    api().load(initialState, { dark })
  }

  function save() {
    const diagram = api()?.read()
    if (!diagram) return setMessage('The diagram is empty. Draw something, or Cancel.')
    onSave(diagram)
  }

  function cancel() {
    const now = api()?.read()
    const changed = (now?.state ?? null) !== (initialState ?? null)
    if (changed && !confirm('Discard your changes to this diagram?')) return
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div role="dialog" aria-label="TikZ diagram"
        style={{ width: '96vw', height: '92vh', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <strong style={{ fontSize: 14 }}>TikZ diagram</strong>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
            {message || 'Use $$…$$ for math in labels. Save puts the diagram on the slide and keeps its TikZ code.'}
          </span>
          <button className="btn btn-secondary" onClick={cancel} style={{ padding: '5px 12px', fontSize: 13 }}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={!html} style={{ padding: '5px 12px', fontSize: 13 }}>Save</button>
        </div>
        {html
          ? <iframe ref={frameRef} srcDoc={html} onLoad={start} title="TikZ diagram editor" style={{ flex: 1, border: 'none', background: '#fff' }} />
          : <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>{message || 'Loading the editor…'}</div>}
      </div>
    </div>
  )
}

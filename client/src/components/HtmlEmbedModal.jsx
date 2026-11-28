// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// An HTML embed's window: its code, and, when the code has a content block
// (utils/embedContent.js), a Content tab that shows the block as a form beside
// a preview of the embed, so its words and numbers change without the code.

import { useEffect, useMemo, useState } from 'react'
import EmbedContentForm from './EmbedContentForm'
import { buildHtmlEmbed } from './SlideCanvas'
import { localizeLibraries } from '../utils/libraries'
import { readEmbedContent, writeEmbedContent } from '../utils/embedContent'

const PREVIEW_W = 440

const tab = active => ({
  background: active ? 'var(--bg-hover)' : 'none', border: '1px solid ' + (active ? 'var(--border)' : 'transparent'),
  borderRadius: 6, color: active ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 12px',
})

// steps: the clicks the embed takes; the preview shows it at its last
export default function HtmlEmbedModal({ content = '', width = 840, height = 400, steps = 0, background = null, initialMode, onApply, onCancel }) {
  const [html, setHtml] = useState(content)
  const parsed = useMemo(() => readEmbedContent(html), [html])
  const [mode, setMode] = useState(() => initialMode || (readEmbedContent(content) ? 'content' : 'code'))
  const showContent = mode === 'content' && parsed

  // The preview follows the form, once typing pauses
  const [previewHtml, setPreviewHtml] = useState(html)
  useEffect(() => {
    if (!showContent) return
    const t = setTimeout(() => setPreviewHtml(html), 450)
    return () => clearTimeout(t)
  }, [html, showContent])
  const scale = PREVIEW_W / Math.max(1, width)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
    >
      <div role="dialog" aria-label="HTML embed" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: showContent ? '90vw' : '78vw', maxWidth: showContent ? 1240 : 960, height: showContent ? '84vh' : '78vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>HTML / D3 Embed</span>
            {parsed && (
              <div role="tablist" style={{ display: 'flex', gap: 4 }}>
                <button type="button" role="tab" aria-selected={mode === 'content'} style={tab(mode === 'content')} onClick={() => setMode('content')}>Content</button>
                <button type="button" role="tab" aria-selected={mode !== 'content'} style={tab(mode !== 'content')} onClick={() => setMode('code')}>Code</button>
              </div>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {showContent ? 'The words and numbers this embed shows. Apply puts them on the slide.' : 'D3, plain HTML, or any JavaScript — renders in an iframe'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onCancel}>Cancel</button>
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => onApply(html)}>Apply</button>
          </div>
        </div>

        {showContent ? (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '16px 20px' }}>
              {parsed.error
                ? (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    <p style={{ marginTop: 0 }}>{parsed.error}</p>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setMode('code')}>Fix it in the code</button>
                  </div>
                )
                : <EmbedContentForm data={parsed.data} onChange={data => setHtml(h => writeEmbedContent(h, data))} />}
            </div>
            <div style={{ width: PREVIEW_W + 32, flexShrink: 0, borderLeft: '1px solid var(--border)', padding: 16, boxSizing: 'border-box', overflowY: 'auto' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Preview</div>
              <div style={{ width: PREVIEW_W, height: Math.round(height * scale), overflow: 'hidden', borderRadius: 4, border: '1px solid var(--border)', ...(background || { backgroundColor: '#ffffff' }) }}>
                <iframe
                  title="Embed preview"
                  sandbox="allow-scripts"
                  srcDoc={localizeLibraries(buildHtmlEmbed(previewHtml, width, height, undefined, steps))}
                  style={{ width, height, border: 'none', display: 'block', transform: `scale(${scale})`, transformOrigin: '0 0' }}
                />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                The embed reads these fields from a block of JSON in its code, marked <code>data-parallax-content</code>. Anything else about it is in the Code tab.
              </p>
            </div>
          </div>
        ) : (
          <textarea
            aria-label="Embed code"
            value={html}
            onChange={e => setHtml(e.target.value)}
            style={{ flex: 1, background: '#0d0d1a', color: '#e2e8f0', fontFamily: "'Fira Code', 'JetBrains Mono', monospace", fontSize: 13, padding: '16px 20px', border: 'none', outline: 'none', resize: 'none', borderRadius: '0 0 12px 12px', lineHeight: 1.6, tabSize: 2 }}
            spellCheck={false}
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Tab') {
                e.preventDefault()
                const { selectionStart: s, selectionEnd: end, value } = e.target
                const next = value.substring(0, s) + '  ' + value.substring(end)
                e.target.value = next
                setHtml(next)
                requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = s + 2 })
              }
            }}
          />
        )}
      </div>
    </div>
  )
}

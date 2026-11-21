// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A PDF's pages as images on the slide: pick the pages, and each becomes an
// image (Insert › Media › PDF pages, File › Import › PDF pages)

import { useState } from 'react'
import { libUrl, localizeLibraries } from '../utils/libraries'

// The PDF's pages, drawn at twice their size
export async function loadPdfPages(file) {
  // PDF.js, a module, from this app's copy (server/vendor-libraries.js).
  // Its legacy build: the modern one calls Map.prototype.getOrInsertComputed
  // on every page it draws, which the desktop app's Electron and browsers
  // older than 2025's don't have
  const pdfjsLib = await import(/* @vite-ignore */ localizeLibraries(libUrl('pdfjs-dist', 'legacy/build/pdf.min.mjs')))
  pdfjsLib.GlobalWorkerOptions.workerSrc = localizeLibraries(libUrl('pdfjs-dist', 'legacy/build/pdf.worker.min.mjs'))
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvas, viewport }).promise
    pages.push({ canvas, num: i })
  }
  return pages
}

// Each page picked, as a PNG file
export async function pageFiles(pages, selected) {
  const files = []
  for (const { canvas, num } of pages) {
    if (!selected.has(num)) continue
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
    files.push(new File([blob], `pdf-page-${num}.png`, { type: 'image/png' }))
  }
  return files
}

export default function PdfPagesModal({ pages, onInsert, onClose }) {
  const [selected, setSelected] = useState(() => new Set([1]))
  const toggle = num => setSelected(prev => {
    const s = new Set(prev)
    s.has(num) ? s.delete(num) : s.add(num)
    return s
  })
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
    >
      <div role="dialog" aria-label="Select PDF pages to insert" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: '80vw', maxWidth: 960, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Select PDF Pages to Insert</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pages.length} page{pages.length !== 1 ? 's' : ''} — click to select</span>
        </div>
        <div style={{ overflowY: 'auto', padding: 16, display: 'flex', flexWrap: 'wrap', gap: 12, flex: 1 }}>
          {pages.map(({ canvas, num }) => {
            const isSelected = selected.has(num)
            return (
              <div key={num} onClick={() => toggle(num)}
                style={{ cursor: 'pointer', border: `2px solid ${isSelected ? '#6366f1' : 'var(--border)'}`, borderRadius: 6, overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                <img src={canvas.toDataURL()} alt={`Page ${num}`} style={{ display: 'block', width: 160, height: 'auto' }} />
                <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.7)', pointerEvents: 'none' }}>{num}</div>
                {isSelected && (
                  <div style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'white', fontWeight: 700 }}>✓</div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setSelected(new Set(pages.map(p => p.num)))}>Select All</button>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={async () => { onClose(); onInsert(await pageFiles(pages, selected)) }} disabled={selected.size === 0}>
            Insert {selected.size > 0 ? `${selected.size} Page${selected.size !== 1 ? 's' : ''}` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

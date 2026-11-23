// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The slide layouts, each drawn as it comes out in this deck's theme with its
// placeholders' hints: for a new slide (New slide ▾), or to change the
// layout of one (Slide › Change layout…)

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { slidePalette } from '../utils/themes'
import { placeholderHint, withHint } from '../utils/placeholders'
import { safeHtml } from '../utils/safeHtml'
import { DEFAULT_DECK_FONT } from '../utils/deckFont'

const PREVIEW_W = 184

// A layout at a glance: its placeholders' hints and its shapes, on the theme's page
export function LayoutPreview({ layout, theme, themeColors = null, slideW = 960, slideH = 540, width = PREVIEW_W }) {
  const scale = width / slideW
  const palette = slidePalette({}, theme, themeColors)
  return (
    <div style={{ width, height: Math.round(width * slideH / slideW), overflow: 'hidden', position: 'relative', borderRadius: 4 }}>
      <div className="slide-thumb-canvas" style={{
        position: 'absolute', top: 0, left: 0, width: slideW, height: slideH,
        transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none', fontSize: '42px', fontFamily: DEFAULT_DECK_FONT,
        ...palette.background, '--slide-heading': palette.heading,
      }}>
        {layout.elements.map((el, i) => {
          const box = { position: 'absolute', left: el.x, top: el.y, width: el.width, height: el.height, zIndex: el.zIndex || 1, opacity: el.opacity ?? 1, boxSizing: 'border-box' }
          if (el.type === 'text') return (
            <div key={i} style={{ ...box, overflow: 'hidden', border: el.placeholder ? `2px dashed ${palette.text}55` : undefined }}>
              <div className="slide-text-content" style={{ padding: '8px 12px', color: palette.text, lineHeight: 1.5 }}
                dangerouslySetInnerHTML={{ __html: safeHtml(el.placeholder ? withHint(el.content, placeholderHint(el)) : el.content) }} />
            </div>
          )
          if (el.type === 'shape') return (
            <div key={i} style={{
              ...box, background: el.fill && el.fill !== 'none' ? el.fill : 'transparent',
              border: el.stroke && el.stroke !== 'none' ? `${el.strokeWidth || 1}px solid ${el.stroke}` : undefined,
              borderRadius: el.shape === 'circle' ? '50%' : el.shape === 'rounded-rect' ? 16 : 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: el.textColor || palette.text, fontSize: el.fontSize || 18,
            }}>{el.text || ''}</div>
          )
          return null
        })}
      </div>
    </div>
  )
}

export default function LayoutPicker({ layouts, theme, themeColors = null, slideW, slideH, title, current = null, onPick, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const section = (heading, entries) => (
    <section>
      {heading && <h3 className="layout-picker-heading">{heading}</h3>}
      <div className="layout-picker-grid">
        {entries.map(([key, layout]) => (
          <button key={key} type="button" className={`layout-choice ${current === key ? 'current' : ''}`}
            aria-current={current === key ? 'true' : undefined} onClick={() => onPick(key)}>
            <LayoutPreview layout={layout} theme={theme} themeColors={themeColors} slideW={slideW} slideH={slideH} />
            <span>{layout.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
  const all = Object.entries(layouts)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal layout-picker" role="dialog" aria-labelledby="layout-picker-title" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 id="layout-picker-title" style={{ margin: 0, fontSize: 16 }}>{title}</h2>
          <button className="btn-icon" onClick={onClose} title="Close" aria-label="Close"><X size={16} /></button>
        </div>
        <div style={{ overflowY: 'auto', maxHeight: '72vh', paddingRight: 4 }}>
          {section(null, all.filter(([, l]) => !l.category))}
          {section('Typographic systems', all.filter(([, l]) => l.category === 'systems'))}
        </div>
      </div>
    </div>
  )
}

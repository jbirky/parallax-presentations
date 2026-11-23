// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A slide's background: a color, a gradient, an image, or none (the theme's).
// In the toolbar's Background popup and the inspector's Slide tab.

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { api } from '../utils/api'
import { pickFile } from '../utils/pickFile'
import { ownBackground, themeOf, themeBackgroundStyle } from '../utils/themes'

export const DEFAULT_BG = '#1e1e2e'

const COLOR_SWATCHES = [
  '#1e1e2e', '#0a0a0f', '#1a1a4e', '#0d3349',
  '#1a3a1a', '#3a1a1a', '#2d1b69', '#000000',
  '#ffffff', '#f8f9fa', '#4a4a6a', '#6b3fa0',
]

const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #1e1e2e, #4a0e8f)',
  'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
  'linear-gradient(135deg, #360033, #0b8793)',
  'radial-gradient(ellipse at center, #1e3c72 0%, #2a5298 100%)',
  'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
  'linear-gradient(135deg, #2c3e50, #3498db)',
]

// A small square showing the background (the theme's, for a slide without
// one of its own), for a button
export function BackgroundSwatch({ background, theme }) {
  const own = ownBackground(background)
  return (
    <span aria-hidden="true" style={{
      display: 'inline-block', width: 14, height: 14, borderRadius: 3, flexShrink: 0,
      border: '1px solid rgba(128,128,128,0.5)',
      ...(own ? { ...own.style, backgroundSize: 'cover' } : themeBackgroundStyle(theme)),
    }} />
  )
}

export default function BackgroundEditor({ slide, onUpdateSlide, theme }) {
  const [uploading, setUploading] = useState(false)
  // A slide without a background of its own shows the theme's (None)
  const bg = slide?.background || { type: 'none' }
  const bgType = bg.type || 'color'
  const update = background => onUpdateSlide({ background })
  // A color starts as the page it replaces
  const setType = type => update({ ...bg, type, ...(type === 'color' && !bg.color ? { color: themeOf(theme).background } : {}), ...(type === 'gradient' && !bg.gradient ? { gradient: GRADIENT_PRESETS[0] } : {}) })
  const setColor = color => update({ ...bg, type: 'color', color })
  const setGradient = gradient => update({ ...bg, type: 'gradient', gradient })
  const setImage = image => update({ ...bg, type: 'image', image, size: bg.size || 'cover', position: bg.position || 'center' })

  const upload = () => pickFile('image/*', async file => {
    setUploading(true)
    try { const res = await api.uploadFile(file); if (res.url) setImage(res.url) }
    catch (err) { alert('Upload failed: ' + err.message) }
    finally { setUploading(false) }
  })

  return (
    <div className="background-editor">
      <div className="bg-type-tabs" role="radiogroup" aria-label="Background" style={{ marginBottom: 8 }}>
        {['color', 'gradient', 'image', 'none'].map(type => (
          <button key={type} role="radio" aria-checked={bgType === type} className={`bg-type-tab ${bgType === type ? 'active' : ''}`}
            onClick={() => setType(type)}
          >{type.charAt(0).toUpperCase() + type.slice(1)}</button>
        ))}
      </div>

      {bgType === 'color' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input type="color" aria-label="Background color" value={/^#[0-9a-f]{6}$/i.test(bg.color || '') ? bg.color : DEFAULT_BG} onChange={e => setColor(e.target.value)}
              style={{ width: 32, height: 28, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer', padding: 1 }} />
            <input className="prop-input" type="text" value={bg.color || DEFAULT_BG} onChange={e => setColor(e.target.value)}
              style={{ flex: 1, fontSize: 12, padding: '4px 6px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
            {COLOR_SWATCHES.map(color => (
              <button key={color} onClick={() => setColor(color)} title={color} aria-label={color}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: 4, cursor: 'pointer', padding: 0,
                  backgroundColor: color,
                  border: bg.color === color ? '2px solid var(--accent)' : color === '#ffffff' || color === '#f8f9fa' ? '1px solid var(--border)' : '1px solid transparent',
                }} />
            ))}
          </div>
        </>
      )}

      {bgType === 'gradient' && (
        <>
          <div style={{ height: 32, borderRadius: 4, background: bg.gradient || GRADIENT_PRESETS[0], marginBottom: 8, border: '1px solid var(--border)' }} />
          <input className="prop-input" type="text" value={bg.gradient || ''} onChange={e => setGradient(e.target.value)}
            placeholder="linear-gradient(...)" style={{ marginBottom: 8, fontSize: 11, padding: '4px 6px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {GRADIENT_PRESETS.map((preset, i) => (
              <button key={i} onClick={() => setGradient(preset)} title={preset} aria-label={`Gradient ${i + 1}`}
                style={{ height: 24, borderRadius: 4, background: preset, cursor: 'pointer',
                  border: bg.gradient === preset ? '2px solid var(--accent)' : '1px solid var(--border)' }} />
            ))}
          </div>
        </>
      )}

      {bgType === 'image' && (
        <>
          {bg.image && (
            <div style={{ height: 60, borderRadius: 4, backgroundImage: `url(${bg.image})`, backgroundSize: 'cover', backgroundPosition: 'center', marginBottom: 8, border: '1px solid var(--border)' }} />
          )}
          <input className="prop-input" type="text" value={bg.image || ''} onChange={e => setImage(e.target.value)}
            placeholder="https://example.com/image.jpg" style={{ marginBottom: 6, fontSize: 11, padding: '4px 6px' }} />
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: 6, fontSize: 11, padding: '4px 8px' }}
            onClick={upload} disabled={uploading}>
            <Upload size={12} />
            {uploading ? 'Uploading…' : 'Upload image'}
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <label style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Size</div>
              <select className="prop-input" value={bg.size || 'cover'} onChange={e => update({ ...bg, size: e.target.value })} style={{ padding: '3px 4px', fontSize: 11 }}>
                <option value="cover">Cover</option><option value="contain">Contain</option><option value="auto">Auto</option><option value="100% 100%">Stretch</option>
              </select>
            </label>
            <label style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Position</div>
              <select className="prop-input" value={bg.position || 'center'} onChange={e => update({ ...bg, position: e.target.value })} style={{ padding: '3px 4px', fontSize: 11 }}>
                <option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option>
              </select>
            </label>
          </div>
        </>
      )}

      {bgType === 'none' && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>No background of its own: the {themeOf(theme).label} theme’s page shows.</p>
      )}
    </div>
  )
}

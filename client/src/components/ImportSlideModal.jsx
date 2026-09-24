// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { ArrowLeft, Check } from 'lucide-react'
import { shapeSvgString } from '../utils/shapeUtils'
import { pointsToPath } from '../utils/drawingUtils'

const THUMB_W = 160

function getBgStyle(bg) {
  if (!bg) return { backgroundColor: '#1e1e2e' }
  if (bg.type === 'color') return { backgroundColor: bg.color || '#1e1e2e' }
  if (bg.type === 'gradient') return { background: bg.gradient || '#1e1e2e' }
  if (bg.type === 'image' && bg.image) return { backgroundImage: `url(${bg.image})`, backgroundSize: bg.size || 'cover', backgroundPosition: bg.position || 'center' }
  return { backgroundColor: '#1e1e2e' }
}

function MiniThumbnail({ slide, slideW = 960, slideH = 540 }) {
  const scale = THUMB_W / slideW
  const thumbH = Math.round(THUMB_W * slideH / slideW)
  return (
    <div style={{ width: THUMB_W, height: thumbH, overflow: 'hidden', position: 'relative', borderRadius: 4 }}>
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: slideW, height: slideH,
        transform: `scale(${scale})`, transformOrigin: 'top left',
        pointerEvents: 'none',
        ...getBgStyle(slide.background),
      }}>
        {(slide.elements || [])
          .slice()
          .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
          .map(el => (
            <div key={el.id} style={{
              position: 'absolute',
              left: el.x, top: el.y,
              width: el.width, height: el.height,
              overflow: 'hidden',
              zIndex: el.zIndex || 1,
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
            }}>
              {el.type === 'text' && (
                <div style={{ width: '100%', height: '100%', color: 'white', padding: '8px 12px', boxSizing: 'border-box', overflow: 'hidden' }}
                  dangerouslySetInnerHTML={{ __html: el.content || '' }} />
              )}
              {el.type === 'image' && (
                <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: el.objectFit || 'contain', display: 'block' }} draggable={false} />
              )}
              {el.type === 'shape' && (
                <div style={{ width: '100%', height: '100%', position: 'relative', opacity: el.opacity ?? 1 }}
                  dangerouslySetInnerHTML={{ __html: shapeSvgString(el) }} />
              )}
              {el.type === 'drawing' && (
                <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                  {(el.paths || []).map((path, pi) => (
                    <path key={pi}
                      d={pointsToPath(path.points, el.smooth !== false)}
                      stroke={path.color || '#ffffff'}
                      strokeWidth={path.strokeWidth || 3}
                      fill="none" strokeLinecap="round" strokeLinejoin="round"
                      opacity={path.opacity ?? 1}
                    />
                  ))}
                </svg>
              )}
              {el.type === 'video' && (
                <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: el.height * 0.4 }}>▶</div>
              )}
              {['html', 'code', 'latex', 'markdown', 'chart', 'audio', 'table', 'icon', 'callout', 'p5'].includes(el.type) && (
                <div style={{ width: '100%', height: '100%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', fontSize: el.height * 0.25 }}>
                  {el.type === 'code' ? '</>' : el.type === 'latex' ? 'TeX' : el.type === 'chart' ? '▦' : el.type === 'table' ? '⊞' : el.type === 'audio' ? '♪' : el.type === 'callout' ? '●' : el.type === 'icon' ? '★' : el.type === 'p5' ? 'p5' : 'MD'}
                </div>
              )}
            </div>
          ))
        }
      </div>
    </div>
  )
}

export default function ImportSlideModal({ currentPresentationId, onImport, onClose }) {
  const [presentations, setPresentations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPresentation, setSelectedPresentation] = useState(null)
  const [loadingSlides, setLoadingSlides] = useState(false)
  const [slides, setSlides] = useState([])
  const [slideW, setSlideW] = useState(960)
  const [slideH, setSlideH] = useState(540)
  const [selected, setSelected] = useState(new Set())

  useEffect(() => {
    api.getPresentations().then(list => {
      setPresentations(list.filter(p => p.id !== currentPresentationId))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [currentPresentationId])

  const loadPresentation = async (pres) => {
    setSelectedPresentation(pres)
    setLoadingSlides(true)
    setSelected(new Set())
    try {
      const data = await api.getPresentation(pres.id)
      setSlides(data.slides || [])
      setSlideW(data.slideWidth || 960)
      setSlideH(data.slideHeight || 540)
    } catch {
      setSlides([])
    }
    setLoadingSlides(false)
  }

  const toggleSlide = (index) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === slides.length) setSelected(new Set())
    else setSelected(new Set(slides.map((_, i) => i)))
  }

  const handleImport = () => {
    const importedSlides = [...selected].sort((a, b) => a - b).map(i => slides[i])
    onImport(importedSlides)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          {selectedPresentation && (
            <button onClick={() => { setSelectedPresentation(null); setSlides([]); setSelected(new Set()) }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 style={{ margin: 0 }}>
            {selectedPresentation ? selectedPresentation.title : 'Import Slides'}
          </h2>
          {selectedPresentation && !loadingSlides && slides.length > 0 && (
            <button onClick={selectAll}
              style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', padding: '3px 8px', fontSize: 11 }}>
              {selected.size === slides.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {!selectedPresentation ? (
            loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Loading presentations...</div>
            ) : presentations.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No other presentations found</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {presentations.map(pres => (
                  <button key={pres.id} onClick={() => loadPresentation(pres)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}
                  >
                    <div>
                      <div style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500 }}>{pres.title || 'Untitled'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {pres.slideCount} slide{pres.slideCount !== 1 ? 's' : ''}
                        {pres.updatedAt && <> · {new Date(pres.updatedAt).toLocaleDateString()}</>}
                      </div>
                    </div>
                    <ArrowLeft size={14} style={{ transform: 'rotate(180deg)', color: 'var(--text-muted)' }} />
                  </button>
                ))}
              </div>
            )
          ) : loadingSlides ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Loading slides...</div>
          ) : slides.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No slides in this presentation</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {slides.map((slide, index) => {
                const isSelected = selected.has(index)
                return (
                  <div key={slide.id || index} onClick={() => toggleSlide(index)}
                    style={{
                      position: 'relative', cursor: 'pointer', borderRadius: 6, padding: 6,
                      border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      background: isSelected ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    {isSelected && (
                      <div style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                        <Check size={12} color="white" />
                      </div>
                    )}
                    <MiniThumbnail slide={slide} slideW={slideW} slideH={slideH} />
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
                      Slide {index + 1}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {selectedPresentation && selected.size > 0 && (
            <button className="btn btn-primary" onClick={handleImport}
              style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontWeight: 500 }}>
              Import {selected.size} Slide{selected.size !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

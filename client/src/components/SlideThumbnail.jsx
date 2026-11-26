// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A slide, small: as the editor's filmstrip (SlidePanel) and the dashboard's
// cards (DeckTile) show it. The slide is laid out at its own size and scaled
// down, so it looks as it does on the canvas. Embeds show the still captured
// while they were live on the canvas, or a placeholder tile until then.

import { useRef, useEffect } from 'react'
import { slidePalette, deckTextStyles, paletteVars } from '../utils/themes'
import { SLIDE_CLASS, TEXT_CLASS, slideLayout, textPlaceholder } from '../utils/slideHooks'
import { deckThemeClass } from '../utils/themeCss'
import { isEmptyPlaceholder } from '../utils/placeholders'
import { fitScale, applyScale } from '../utils/shrinkFit'
import { shapeSvgString } from '../utils/shapeUtils'
import { safeHtml, safeSvg } from '../utils/safeHtml'
import { resolveCitationsInHtml } from '../utils/citationIndex'
import { pointsToPath } from '../utils/drawingUtils'
import { snapshotKey, getSnapshot } from '../utils/embedSnapshots'
import { tikzDiagramSvg } from '../utils/tikzDiagram'
import { text3dHtml, text3dShadowFilter } from '../utils/text3d'
import { getCanvasHeight, getCanvasWidth } from '../utils/scrollingSlides'
import { modelSnapshotContent } from '../utils/modelViewer'
import { moleculeSnapshotContent } from '../utils/moleculeViewer'
import { graphSnapshotContent } from '../utils/graphPage'
import EquationView from './EquationView'
import FeynmanView from './FeynmanView'
import CircuitView from './CircuitView'
import LogicView from './LogicView'
import FreebodyView from './FreebodyView'
import VennView from './VennView'
import TimingView from './TimingView'
import GeometryView from './GeometryView'
import PeriodicView from './PeriodicView'
import HarmonicsView from './HarmonicsView'
import { DEFAULT_DECK_FONT } from '../utils/deckFont'
import { textStyleVars } from '../utils/textStyles'

// The editor's filmstrip width
export const THUMB_W = 150

// A text box in a thumbnail, as on the slide: shrunk to fit when it's set to
function ThumbText({ el, globalFont, textStylesKey = '', citationLabels }) {
  const ref = useRef(null)
  const shrink = el.sizeMode === 'shrink'
  useEffect(() => {
    if (!shrink || !ref.current) return
    const inner = ref.current
    const fit = () => applyScale(inner, el.width, fitScale(inner, el.width, el.height))
    fit()
    let live = true
    document.fonts?.ready?.then(() => { if (live) fit() })
    return () => { live = false }
  }, [shrink, el.content, el.width, el.height, el.lineHeight, globalFont, textStylesKey])
  const style = { color: 'var(--slide-text, white)', padding: '8px 12px', boxSizing: 'border-box', fontFamily: globalFont || undefined, lineHeight: el.lineHeight ?? 1.5 }
  const html = { __html: safeHtml(resolveCitationsInHtml(el.content, citationLabels)) }
  if (shrink) return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <div ref={ref} className="slide-text-content" style={{ ...style, position: 'relative' }} dangerouslySetInnerHTML={html} />
    </div>
  )
  return <div className="slide-text-content" style={{ ...style, width: '100%', height: '100%', overflow: 'hidden' }} dangerouslySetInnerHTML={html} />
}

// width: the thumbnail's, in pixels; radius: its corners'. quiet: embeds
// without a still are a plain tile, without the label saying what they are
export default function SlideThumbnail({ slide, slideW, slideH, globalFont, citationLabels, theme, textStyles, themeColors, width = THUMB_W, radius = 3, quiet = false }) {
  const scale = width / slideW
  const palette = slidePalette(slide, theme, themeColors)
  // The deck's text styles (utils/textStyles.js)
  const textVars = textStyleVars(deckTextStyles(textStyles, theme))
  const textStylesKey = JSON.stringify(textVars)
  const thumbH = Math.round(width * slideH / slideW)
  // A scrolling slide shows its first screen, and a badge for how many it has
  const canvasH = getCanvasHeight(slide, slideH)
  const canvasW = getCanvasWidth(slide, slideW, slideH)

  return (
    <div className="slide-thumb" style={{ width, height: thumbH, overflow: 'hidden', position: 'relative', flexShrink: 0, borderRadius: radius }}>
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: slideW, height: slideH,
        transform: `scale(${scale})`, transformOrigin: 'top left',
        pointerEvents: 'none',
        fontSize: '42px', fontFamily: DEFAULT_DECK_FONT,
        ...palette.background,
        '--slide-text': palette.text,
        '--slide-heading': palette.heading,
        '--slide-link': palette.link,
        ...paletteVars(palette),
        ...textVars,
      }} className={['slide-thumb-canvas', SLIDE_CLASS, deckThemeClass(theme)].filter(Boolean).join(' ')} data-layout={slideLayout(slide) || undefined} data-own-background={palette.own ? '' : undefined}>
        {(slide.elements || [])
          .filter(el => !isEmptyPlaceholder(el))
          .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
          .map(el => (
            <div key={el.id} className={el.type === 'text' ? TEXT_CLASS : undefined} data-placeholder={textPlaceholder(el) || undefined} style={{
              position: 'absolute',
              left: el.x, top: el.y,
              width: el.width, height: el.height,
              overflow: el.type === 'text3d' || el.type === 'equation' || el.type === 'feynman' || el.type === 'circuit' || el.type === 'logic' || el.type === 'freebody' || el.type === 'venn' || el.type === 'periodic' ? 'visible' : 'hidden',
              zIndex: el.zIndex || 1,
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              boxShadow: el.type !== 'text3d' && (el.shadowBlur || el.shadowX || el.shadowY)
                ? `${el.shadowX||0}px ${el.shadowY||0}px ${el.shadowBlur||0}px ${el.shadowColor||'rgba(0,0,0,0.5)'}`
                : undefined,
              filter: el.type === 'text3d' ? text3dShadowFilter(el) || undefined : undefined,
            }}>
              {el.type === 'text' && <ThumbText el={el} globalFont={globalFont} textStylesKey={textStylesKey} citationLabels={citationLabels} />}
              {el.type === 'image' && (() => {
                const imgFilter = [
                  (el.filterBrightness != null && el.filterBrightness !== 100) ? `brightness(${el.filterBrightness}%)` : '',
                  (el.filterContrast   != null && el.filterContrast   !== 100) ? `contrast(${el.filterContrast}%)` : '',
                  el.filterGrayscale ? `grayscale(${el.filterGrayscale}%)` : '',
                ].filter(Boolean).join(' ') || undefined
                return (
                  <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: el.borderRadius || undefined }}>
                    <img
                      src={el.src} alt=""
                      style={el.imageW != null ? {
                        position: 'absolute',
                        left: el.imageOffsetX ?? 0,
                        top: el.imageOffsetY ?? 0,
                        width: el.imageW,
                        height: el.imageH,
                        objectFit: el.objectFit || 'contain',
                        display: 'block',
                        filter: imgFilter,
                      } : {
                        width: '100%', height: '100%',
                        objectFit: el.objectFit || 'contain',
                        display: 'block',
                        filter: imgFilter,
                      }}
                      draggable={false}
                    />
                  </div>
                )
              })()}
              {el.type === 'shape' && (
                <div style={{ width: '100%', height: '100%', position: 'relative', opacity: el.opacity ?? 1 }}
                  dangerouslySetInnerHTML={{ __html: safeHtml(shapeSvgString(el)) }} />
              )}
              {el.type === 'tikz' && (
                <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: safeSvg(tikzDiagramSvg(el)) }} />
              )}
              {el.type === 'text3d' && (
                <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: safeHtml(text3dHtml(el, { fontFamily: globalFont, resolution: 1 })) }} />
              )}
              {el.type === 'equation' && <EquationView element={el} />}
              {el.type === 'feynman' && <FeynmanView element={el} />}
              {el.type === 'circuit' && <CircuitView element={el} />}
              {el.type === 'logic' && <LogicView element={el} />}
              {el.type === 'freebody' && <FreebodyView element={el} />}
              {el.type === 'venn' && <VennView element={el} />}
              {el.type === 'timing' && <TimingView element={el} />}
              {el.type === 'geometry' && <GeometryView element={el} />}
              {el.type === 'periodic' && <PeriodicView element={el} />}
              {el.type === 'harmonics' && <HarmonicsView element={el} />}
              {el.type === 'drawing' && (
                <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                  {(el.paths || []).map((path, pi) => (
                    <path key={pi}
                      d={pointsToPath(path.points, el.smooth !== false)}
                      stroke={path.color || '#ffffff'}
                      strokeWidth={path.strokeWidth || 3}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={path.opacity ?? 1}
                    />
                  ))}
                </svg>
              )}
              {el.type === 'video' && (
                el.poster
                  ? <img src={el.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} draggable={false} />
                  : <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: el.height * 0.4 }}>▶</div>
              )}
              {(el.type === 'html' || el.type === 'code' || el.type === 'latex' || el.type === 'markdown' || el.type === 'audio' || el.type === 'table' || el.type === 'icon' || el.type === 'callout' || el.type === 'p5' || el.type === 'model' || el.type === 'molecule' || el.type === 'graph') && (() => {
                // A still captured while this embed was live on the canvas, so the
                // thumbnail costs nothing to draw. Placeholder tile until then.
                const snap = (el.type === 'html' || el.type === 'p5')
                  ? getSnapshot(snapshotKey(el.id, el.content))
                  : el.type === 'model' ? getSnapshot(snapshotKey(el.id, modelSnapshotContent(el)))
                  : el.type === 'molecule' ? getSnapshot(snapshotKey(el.id, moleculeSnapshotContent(el)))
                  : el.type === 'graph' ? getSnapshot(snapshotKey(el.id, graphSnapshotContent(el)))
                  : null
                if (snap) {
                  return <img src={snap} alt="" draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                }
                return (
                  <div style={{ width: '100%', height: '100%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', fontSize: el.height * 0.25 }}>
                    {quiet ? null : el.type === 'code' ? '</>' : el.type === 'html' ? 'HTML' : el.type === 'latex' ? 'TeX' : el.type === 'table' ? '⊞' : el.type === 'audio' ? '♪' : el.type === 'callout' ? el.calloutNumber || '●' : el.type === 'icon' ? '★' : el.type === 'p5' ? 'p5' : el.type === 'model' ? '3D' : el.type === 'molecule' ? '⌬' : el.type === 'graph' ? 'y=' : 'MD' }
                  </div>
                )
              })()}
            </div>
          ))
        }
      </div>
      {(canvasH > slideH || canvasW > slideW) && (
        <div title={canvasW > slideW ? 'Scrolls sideways' : 'Scrolls down'} style={{
          position: 'absolute', bottom: 2, right: 2, pointerEvents: 'none',
          background: 'rgba(99,102,241,0.85)', color: '#fff', fontSize: 8, fontWeight: 600,
          padding: '1px 4px', borderRadius: 2, letterSpacing: 0.2,
        }}>{canvasW > slideW ? <>&#8596; {+(canvasW / slideW).toFixed(2)}</> : <>&#8597; {+(canvasH / slideH).toFixed(2)}</>}&times;</div>
      )}
    </div>
  )
}

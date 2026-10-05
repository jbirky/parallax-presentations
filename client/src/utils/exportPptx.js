import pptxgen from 'pptxgenjs'
import { sanitizeSvg } from './tikzDiagram'
import { feynmanSvg } from './feynmanDiagram'
import { circuitSvg } from './circuitDiagram'
import { logicSvg } from './logicDiagram'
import { freebodySvg } from './freebodyDiagram'
import { vennSvg } from './vennDiagram'
import { timingSvg } from './timingDiagram'
import { geometrySvg } from './geometryDiagram'
import { periodicSvg } from './periodicTable'
import { harmonicsPng } from './harmonicsView'
import { getScreenCount, scrollAxis, isPinned } from './scrollingSlides'
import { text3dSettings, text3dExtrusion, darken } from './text3d'
import { buildCitationIndex, resolveCitationsInHtml } from './citationIndex'

function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  return doc.body.textContent || ''
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  if (h.length === 3) return { r: parseInt(h[0]+h[0],16), g: parseInt(h[1]+h[1],16), b: parseInt(h[2]+h[2],16) }
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) }
}

function pxToInch(px) { return px / 96 }

// Convert 960x540 canvas coords to 10"x5.625" slide
const SCALE_X = 10 / 960
const SCALE_Y = 5.625 / 540

export function exportToPptx(presentation) {
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_WIDE' // 13.33x7.5 — we'll use custom
  pptx.defineLayout({ name: 'CUSTOM', width: 10, height: 5.625 })
  pptx.layout = 'CUSTOM'
  pptx.title = presentation.title || 'Presentation'

  // PowerPoint can't scroll, so a scrolling slide gives a slide per screen, as
  // the PDF does, with its pinned elements on each
  const slideW = presentation.slideWidth || 960
  const slideH = presentation.slideHeight || 540
  const citationLabels = buildCitationIndex(presentation).labelByKey
  const pages = (presentation.slides || []).flatMap(slide =>
    Array.from({ length: getScreenCount(slide, slideW, slideH) }, (_, screen) => ({ slide, screen })))

  for (const { slide, screen } of pages) {
    const pptSlide = pptx.addSlide()
    const axis = scrollAxis(slide, slideW, slideH)

    // Background
    const bg = slide.background
    if (bg?.type === 'color' && bg.color) {
      pptSlide.background = { color: bg.color.replace('#', '') }
    } else if (!bg || bg.type === 'none') {
      pptSlide.background = { color: '1e1e2e' }
    }

    // Sort elements by zIndex
    const elements = [...(slide.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))

    for (const el of elements) {
      // Where it is on this page's screen: the canvas moves up (or left) a screen a page
      const onCanvas = axis && !isPinned(el)
      const elX = onCanvas && axis === 'x' ? el.x - screen * slideW : el.x
      const elY = onCanvas && axis === 'y' ? el.y - screen * slideH : el.y
      if (axis && (elX + el.width <= 0 || elX >= slideW || elY + el.height <= 0 || elY >= slideH)) continue
      const x = elX * SCALE_X
      const y = elY * SCALE_Y
      const w = el.width * SCALE_X
      const h = el.height * SCALE_Y
      const rotation = el.rotation || 0

      if (el.type === 'text' || el.type === 'markdown') {
        // Citations read as the index numbers them now
        const text = stripHtml(el.type === 'text' ? resolveCitationsInHtml(el.content, citationLabels) : el.content)
        if (text.trim()) {
          pptSlide.addText(text, {
            x, y, w, h,
            fontSize: 14,
            color: 'FFFFFF',
            valign: 'top',
            wrap: true,
            rotate: rotation,
          })
        }
      } else if (el.type === 'image') {
        try {
          const src = el.src
          if (src && (src.startsWith('http') || src.startsWith('data:'))) {
            pptSlide.addImage({ path: src, x, y, w, h, rotate: rotation })
          }
        } catch {}
      } else if (el.type === 'feynman' || el.type === 'circuit' || el.type === 'logic' || el.type === 'freebody' || el.type === 'venn' || el.type === 'timing' || el.type === 'geometry' || el.type === 'periodic') {
        // As an image, with its labels as SVG text rather than KaTeX, which PowerPoint would leave out
        try {
          const svg = (el.type === 'feynman' ? feynmanSvg : el.type === 'circuit' ? circuitSvg : el.type === 'logic' ? logicSvg : el.type === 'periodic' ? periodicSvg : el.type === 'venn' ? vennSvg : el.type === 'timing' ? timingSvg : el.type === 'geometry' ? geometrySvg : freebodySvg)(el, { labels: 'text', standalone: true })
          const bytes = new TextEncoder().encode(svg)
          let binary = ''
          for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
          pptSlide.addImage({ path: `data:image/svg+xml;base64,${btoa(binary)}`, x, y, w, h, rotate: rotation })
        } catch {}
      } else if (el.type === 'harmonics') {
        // As a picture, drawn by the same renderer as it rests, its label in plain text
        const png = harmonicsPng(el)
        if (png) pptSlide.addImage({ data: png, x, y, w, h, rotate: rotation })
      } else if (el.type === 'tikz' && el.svg) {
        // As an image; its math labels are HTML inside the SVG, which PowerPoint leaves out
        try {
          const bytes = new TextEncoder().encode(sanitizeSvg(el.svg))
          let binary = ''
          for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
          const base64 = btoa(binary)
          pptSlide.addImage({ path: `data:image/svg+xml;base64,${base64}`, x, y, w, h, rotate: rotation })
        } catch {}
      } else if (el.type === 'shape') {
        const fill = el.fill || '6366f1'
        pptSlide.addShape(pptx.ShapeType.rect, {
          x, y, w, h,
          fill: { color: fill.replace('#', '') },
          rotate: rotation,
        })
        if (el.text) {
          pptSlide.addText(el.text, {
            x, y, w, h,
            fontSize: el.fontSize || 16,
            color: (el.textColor || '#ffffff').replace('#', ''),
            align: 'center',
            valign: 'middle',
            rotate: rotation,
          })
        }
      } else if (el.type === 'text3d') {
        // PowerPoint has no stack of copies: the face, with a hard shadow in
        // the side color where the extrusion shows
        const s = text3dSettings(el)
        const { dx, dy } = text3dExtrusion(el)
        const offset = Math.hypot(dx, dy) * 0.75
        const hex = c => darken(c, 0).slice(1)
        if ((el.content || '').trim()) {
          pptSlide.addText(el.content, {
            x, y, w, h,
            fontSize: Math.round(s.fontSize * 0.75),
            fontFace: el.fontFamily ? s.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : undefined,
            bold: s.fontWeight === 'bold' || Number(s.fontWeight) >= 600,
            italic: s.fontStyle !== 'normal',
            color: hex(s.color),
            align: s.textAlign,
            valign: 'middle',
            rotate: rotation,
            // pptxgenjs reads a blur or angle of 0 as unset, and fills in its own
            shadow: offset >= 0.5 ? {
              type: 'outer', blur: 0.01, opacity: 1,
              offset: Math.min(200, Math.round(offset * 10) / 10),
              angle: Math.round((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360) || 0.01,
              color: hex(s.sideColor),
            } : undefined,
          })
        }
      } else if (el.type === 'code') {
        pptSlide.addText(el.content || '', {
          x, y, w, h,
          fontSize: el.fontSize || 12,
          fontFace: 'Courier New',
          color: 'E2E8F0',
          fill: { color: '1a1a2e' },
          valign: 'top',
          wrap: true,
          rotate: rotation,
        })
      } else if (el.type === 'callout') {
        const bg = (el.calloutColor || '#ef4444').replace('#', '')
        pptSlide.addShape(pptx.ShapeType.ellipse, {
          x, y, w, h,
          fill: { color: bg },
          rotate: rotation,
        })
        pptSlide.addText(String(el.calloutNumber || 1), {
          x, y, w, h,
          fontSize: el.fontSize || 16,
          color: (el.calloutTextColor || '#ffffff').replace('#', ''),
          bold: true,
          align: 'center',
          valign: 'middle',
          rotate: rotation,
        })
      } else if (el.type === 'table' && el.data) {
        const rows = el.data.map((row, ri) =>
          (row || []).map(cell => ({
            text: cell || '',
            options: {
              fontSize: el.fontSize || 12,
              color: (el.textColor || '#ffffff').replace('#', ''),
              fill: { color: (el.headerRow && ri === 0 ? el.headerBgColor || '#6366f1' : el.cellBgColor || '1e1e2e').replace('#', '') },
              border: { pt: el.borderWidth || 1, color: (el.borderColor || '555555').replace('#', '') },
            }
          }))
        )
        if (rows.length > 0) {
          pptSlide.addTable(rows, { x, y, w, h })
        }
      }
    }

    // Speaker notes
    if (slide.notes && screen === 0) {
      pptSlide.addNotes(slide.notes)
    }
  }

  pptx.writeFile({ fileName: `${(presentation.title || 'presentation').replace(/[^a-z0-9]/gi, '_')}.pptx` })
}

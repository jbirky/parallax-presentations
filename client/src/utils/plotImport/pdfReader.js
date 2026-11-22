// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A PDF figure's first page as a drawing (drawing.js), from pdf.js's list of
// its drawing commands. matplotlib draws each plot element as paths, and
// each marker as a stored symbol stamped at a point (a form XObject, which
// pdf.js plays back at each stamp), so a marker's place is exact. Text
// comes from pdf.js's text content; with matplotlib's default Type 3 fonts
// a minus sign has no text, so plotModel.js puts it back from the labels'
// order. pdfjsLib is pdf.js, loaded by the caller (index.js, or the tests).
// Each mark and path keeps the operators that draw it (ops: [first, last],
// indices into the list), for keeping the figure as it is (splitPdf.js).

import { IDENTITY, multiply, apply, hexColor, markerShape } from './drawing'

export async function readPdfDrawing(data, pdfjsLib) {
  const task = pdfjsLib.getDocument({ data, verbosity: 0, isEvalSupported: false })
  const doc = await task.promise
  try {
    const page = await doc.getPage(1)
    const [ops, content, meta] = await Promise.all([
      page.getOperatorList(),
      page.getTextContent(),
      doc.getMetadata().catch(() => null),
    ])
    const drawing = walk(ops, pdfjsLib.OPS)
    const [vx0, vy0, vx1, vy1] = page.view
    drawing.width = vx1 - vx0
    drawing.height = vy1 - vy0
    drawing.pages = doc.numPages
    drawing.producer = String(meta?.info?.Producer || meta?.info?.Creator || '')
    // Each font's own name (DejaVuSans, LiberationSans), for its metrics
    const fonts = {}
    const fontName = id => {
      if (!(id in fonts)) {
        try { fonts[id] = String(page.commonObjs.get(id)?.name || '').replace(/^[A-Z]{6}\+/, '') } catch { fonts[id] = '' }
      }
      return fonts[id]
    }
    drawing.texts = content.items.filter(t => t.str && t.str.trim()).map(t => {
      const [a, b, c, d, e, f] = t.transform
      const size = Math.hypot(c, d) || t.height || 10
      return { s: t.str.trim(), x: e, y: f, w: t.width || 0, size, angle: Math.round(Math.atan2(b, a) * 180 / Math.PI), font: fontName(t.fontName) }
    })
    return drawing
  } finally {
    task.destroy()
  }
}

// The drawing in a page's operator list
export function walk(ops, OPS) {
  const NAME = {}
  for (const [k, v] of Object.entries(OPS)) NAME[v] = k
  let ctm = IDENTITY, stroke = '#000000', fill = '#000000', width = 1, dash = null
  const stack = [], paths = [], marks = []
  let images = 0
  let order = 0 // what's drawn, in the order it's drawn
  let form = null // the marker being stamped, while its symbol plays back
  const forms = []

  ops.fnArray.forEach((fn, i) => {
    const a = ops.argsArray[i]
    switch (NAME[fn]) {
      case 'save': stack.push([ctm, stroke, fill, width, dash]); break
      case 'restore': if (stack.length) [ctm, stroke, fill, width, dash] = stack.pop(); break
      case 'transform': ctm = multiply(ctm, a); break
      case 'setStrokeRGBColor': stroke = hexColor(typeof a[0] === 'string' ? a[0] : a); break
      case 'setFillRGBColor': fill = hexColor(typeof a[0] === 'string' ? a[0] : a); break
      case 'setLineWidth': width = a[0]; break
      case 'setDash': dash = a[0] && a[0].length ? Array.from(a[0]) : null; break
      case 'paintFormXObjectBegin': {
        forms.push([ctm, stroke, fill, width, dash, form])
        ctm = multiply(ctm, a[0] || IDENTITY)
        form = { x: ctm[4], y: ctm[5], segs: [], curves: 0, filled: false, stroked: false, fill, stroke, scale: Math.hypot(ctm[0], ctm[1]) || 1, begin: i }
        break
      }
      case 'paintFormXObjectEnd': {
        const done = form
        ;[ctm, stroke, fill, width, dash, form] = forms.pop() || [ctm, stroke, fill, width, dash, null]
        if (done && done.segs.length) {
          const { shape, size } = markerShape(done.segs, done.curves)
          marks.push({ x: done.x, y: done.y, shape, size, fill: done.filled ? done.fill : null, stroke: done.stroked ? done.stroke : null, order: order++, ops: [done.begin, i] })
        }
        break
      }
      case 'paintImageXObject': case 'paintInlineImageXObject': case 'paintImageMaskXObject': images++; break
      case 'constructPath': {
        const paint = NAME[a[0]] || ''
        if (!paint || paint === 'endPath') break
        const { segs, curves, closed } = pathOf(a[1] && a[1][0], form ? null : ctm)
        if (!segs.length) break
        const stroked = /stroke/i.test(paint), filled = /fill/i.test(paint)
        if (form) {
          // The marker's symbol, about its center
          const m = [ctm[0], ctm[1], ctm[2], ctm[3], 0, 0]
          form.segs.push(...segs.map(s => s.map(([x, y]) => apply(m, x, y))))
          form.curves += curves
          form.filled = form.filled || filled
          form.stroked = form.stroked || stroked
          form.fill = fill
          form.stroke = stroke
        } else {
          const scale = Math.hypot(ctm[0], ctm[1]) || 1
          paths.push({ segs, closed, curves, stroke: stroked ? stroke : null, fill: filled ? fill : null, width: width * scale, dash: stroked ? dash : null, order: order++, ops: [i, i] })
        }
        break
      }
      default: break
    }
  })
  return { paths, marks, texts: [], images, notes: [] }
}

// A path's subpaths, through the matrix (none: as drawn). pdf.js gives a
// path as its drawing ops in one array: moveTo 0 (x, y), lineTo 1 (x, y),
// curveTo 2 (six numbers), quadraticCurveTo 3 (four), closePath 4
function pathOf(data, m) {
  const segs = []
  let cur = null, curves = 0, closed = false
  const at = (x, y) => (m ? apply(m, x, y) : [x, y])
  const d = data ? Array.from(data) : []
  for (let k = 0; k < d.length;) {
    const op = d[k]
    if (op === 0) { cur = [at(d[k + 1], d[k + 2])]; segs.push(cur); k += 3 }
    else if (op === 1) { if (!cur) { cur = []; segs.push(cur) } cur.push(at(d[k + 1], d[k + 2])); k += 3 }
    else if (op === 2) { if (!cur) { cur = []; segs.push(cur) } cur.push(at(d[k + 5], d[k + 6])); curves++; k += 7 }
    else if (op === 3) { if (!cur) { cur = []; segs.push(cur) } cur.push(at(d[k + 3], d[k + 4])); curves++; k += 5 }
    else if (op === 4) { closed = true; k += 1 }
    else k += 1
  }
  return { segs: segs.filter(s => s.length), curves, closed }
}

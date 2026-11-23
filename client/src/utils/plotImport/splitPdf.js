// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A matplotlib PDF cut into pieces the way an SVG is (splitSvg.js): runs, in
// the order the page draws them, of what one layer draws or of what none
// does (toFigure.js). A layer is the operators plotModel.js found drawing it
// (layer.ops: [first, last] ranges in pdf.js's list of the page's drawing
// operators, pdfReader.js). Each piece is the page drawn by pdf.js with
// every operator that sets things up (the place, the colors, the clip, the
// fonts) and only the piece's own operators that paint, on a clear canvas,
// as a PNG: one over another they're the page as pdf.js draws it. The
// figure's background and the axes' (backdrop: the operators that paint
// them, plotModel.js) can be left out, clear, as in splitSvg.js, and the
// legends' boxes (frames) cleared inside their outlines. A part drawn in
// another color (recolor) has its pixels of its color made the other; made
// for a dark slide (dark), a piece has its grays turned over, but for what
// a data part draws (dataParts: the layers, a figure legend's entries) other
// than its words, and for pictures. A piece is drawn in stretches, of what
// paints one way, and each stretch's pixels changed as it needs before the
// next is drawn over it.

import { runsOf, planOf, keptRuns } from './toFigure'
import { SplitError } from './splitSvg'

// The operators that put something on the page; a path's painting operator
// comes with it, in constructPath's first argument
const PAINTS = new Set([
  'stroke', 'closeStroke', 'fill', 'eoFill', 'fillStroke', 'eoFillStroke', 'closeFillStroke', 'closeEOFillStroke', 'rawFillPath',
  'shadingFill', 'showText', 'showSpacedText', 'nextLineShowText', 'nextLineSetSpacingShowText',
  'paintImageXObject', 'paintInlineImageXObject', 'paintInlineImageXObjectGroup', 'paintImageMaskXObject',
  'paintImageMaskXObjectGroup', 'paintImageXObjectRepeat', 'paintImageMaskXObjectRepeat', 'paintSolidColorImageMask',
])
const WORDS = new Set(['showText', 'showSpacedText', 'nextLineShowText', 'nextLineSetSpacingShowText'])
const PICTURES = new Set([...PAINTS].filter(n => /Image/.test(n)))

// A page's operator list cut into runs: { runs: [{ part, run, ops: Set,
// backdrop, inked, empty }], paints: Set (every painting operator), back:
// Set (the backgrounds'), frames: Map (a legend box's operator → { fill,
// stroke }),
// words: Set (the operators that show text), pictures: Set (that paint
// images), plan }. backdrop: that a run paints a background or a legend's
// box; inked: that it's drawn differently for a dark slide; empty: that it
// paints nothing but backgrounds, and they're left clear
export function planPdf(ops, layers, OPS, { backdrop = [], frames = [], clear = false, dataParts = new Set() } = {}) {
  const NAME = {}
  for (const [k, v] of Object.entries(OPS)) NAME[v] = k
  const paints = [], words = new Set(), pictures = new Set()
  ops.fnArray.forEach((fn, i) => {
    const name = NAME[fn]
    if (name === 'constructPath' ? PAINTS.has(NAME[ops.argsArray[i]?.[0]]) : PAINTS.has(name)) paints.push(i)
    if (WORDS.has(name)) words.add(i)
    if (PICTURES.has(name)) pictures.add(i)
  })
  const owner = new Map()
  for (const l of layers) for (const [a, b] of l.ops || []) for (let i = a; i <= b; i++) owner.set(i, l.id)
  const runs = runsOf(paints.map(i => owner.get(i) || 'base'))
  const all = new Set(paints)
  const back = new Set(), boxes = new Map()
  for (const [a, b] of backdrop) for (let i = a; i <= b; i++) if (all.has(i)) back.add(i)
  for (const f of frames) for (const [a, b] of f.ops ? [f.ops] : []) for (let i = a; i <= b; i++) if (all.has(i)) boxes.set(i, { fill: f.fill, stroke: f.stroke || null })
  return {
    runs: runs.map(r => {
      const own = paints.slice(r.from, r.to + 1)
      const n = own.filter(i => back.has(i)).length
      return {
        part: r.part, run: r.run, ops: new Set(own),
        backdrop: n > 0 || own.some(i => boxes.has(i)),
        inked: !dataParts.has(r.part) || own.some(i => words.has(i)),
        empty: clear && n === own.length,
      }
    }),
    paints: all,
    back,
    frames: boxes,
    words,
    pictures,
    plan: planOf(runs),
  }
}

// { pieces: [{ part, run, blob, backdrop, inked }], plan, width, height,
// type, ext }: a piece is drawn only where need(piece, plan) says (else its
// blob is null), as the others are already on hand. longSide: the PNGs'
// longer side, in pixels; backdrop, frames, clear, dataParts: as planPdf has
// them; recolor: Map(part → { from, to }); dark: for a dark slide
export async function splitPdf(data, layers, pdfjsLib, { need = () => true, longSide = 2400, backdrop = [], frames = [], clear = false, recolor = new Map(), dark = false, dataParts = new Set() } = {}) {
  if (!layers.length || layers.some(l => !l.ops || !l.ops.length)) throw new SplitError('Only a figure saved by matplotlib can be kept as it is')
  const task = pdfjsLib.getDocument({ data, verbosity: 0, isEvalSupported: false })
  try {
    const page = await (await task.promise).getPage(1)
    const plan = planPdf(await page.getOperatorList(), layers, pdfjsLib.OPS, { backdrop, frames, clear, dataParts })
    const { runs, paints, back, words, pictures } = plan
    const [x0, y0, x1, y1] = page.view
    const width = x1 - x0, height = y1 - y0
    const viewport = viewportOf(page, longSide)
    const pieces = []
    for (const r of keptRuns(runs)) {
      const piece = { part: r.part, run: r.run, blob: null, backdrop: r.backdrop, inked: r.inked }
      if (need(piece, plan.plan)) {
        // What's done to each operator's pixels: a data part's drawing in
        // its color, its words (a legend entry's) for the slide; the rest
        // for the slide, a legend's box cleared, a picture as it is
        const swap = recolor.get(r.part)
        const treat = i => {
          if (dataParts.has(r.part)) return words.has(i) ? (dark ? 'dark' : '') : swap ? 'recolor' : ''
          if (pictures.has(i)) return ''
          const box = clear && plan.frames.get(i)
          return [box ? `clear:${box.fill}:${box.stroke || 'none'}` : '', dark ? 'dark' : ''].filter(Boolean).join(' ')
        }
        const stretches = []
        for (const i of [...r.ops].sort((a, b) => a - b)) {
          if (clear && back.has(i)) continue
          const how = treat(i), last = stretches[stretches.length - 1]
          if (last && last.how === how) last.ops.add(i)
          else stretches.push({ how, ops: new Set([i]) })
        }
        let canvas = null
        for (const st of stretches.length ? stretches : [{ how: '', ops: new Set() }]) {
          const drawn = await draw(page, viewport, i => !paints.has(i) || st.ops.has(i))
          if (st.how) changePixels(drawn, st.how, swap)
          if (canvas) canvas.getContext('2d').drawImage(drawn, 0, 0)
          else canvas = drawn
        }
        piece.blob = await pngOf(canvas)
      }
      pieces.push(piece)
    }
    return { pieces, plan: plan.plan, width, height, type: 'image/png', ext: 'png' }
  } finally {
    task.destroy()
  }
}

// The page whole, as a PNG the size of the pieces: a figure put on a slide
// before it's cut
export async function pdfFigurePng(data, pdfjsLib, { longSide = 2400 } = {}) {
  const task = pdfjsLib.getDocument({ data, verbosity: 0, isEvalSupported: false })
  try {
    const page = await (await task.promise).getPage(1)
    return await pngOf(await draw(page, viewportOf(page, longSide)))
  } finally {
    task.destroy()
  }
}

// The scale the pieces are drawn at: longSide pixels, between 2 and 6 to the
// point, and no more than a canvas holds
function viewportOf(page, longSide) {
  const [x0, y0, x1, y1] = page.view
  const long = Math.max(x1 - x0, y1 - y0) || 1
  return page.getViewport({ scale: Math.min(Math.max(longSide / long, 2), 6, 4096 / long) })
}

// The page drawn (only the operators filter lets through) on a canvas,
// clear where nothing's drawn
async function draw(page, viewport, operationsFilter) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  // A context of its own, made first: pdf.js would make one with no alpha
  const canvasContext = canvas.getContext('2d')
  await page.render({ canvasContext, viewport, background: 'rgba(0,0,0,0)', ...(operationsFilter ? { operationsFilter } : {}) }).promise
  return canvas
}

const pngOf = canvas => new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('The figure couldn’t be drawn.'))), 'image/png'))

// A canvas's pixels changed, each way in turn: 'recolor' (swap: { from,
// to }), 'dark', 'clear:<fill>:<stroke>' (#rrggbb, or none)
function changePixels(canvas, how, swap) {
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (const step of how.split(' ')) {
    if (step === 'recolor') recolorPixels(img.data, swap.from, swap.to)
    else if (step === 'dark') turnGrays(img.data)
    else if (step.startsWith('clear:')) { const [, fill, stroke] = step.split(':'); clearPixels(img.data, fill, stroke === 'none' ? null : stroke) }
  }
  ctx.putImageData(img, 0, 0)
}

// Grays turned over, light for dark (black words white, a white background
// black), each pixel as opaque as it was; colors as they were. A faint
// pixel's color is stored roughly, so it's a gray from further off
export function turnGrays(data) {
  for (let k = 0; k < data.length; k += 4) {
    const a = data[k + 3]
    if (!a) continue
    const r = data[k], g = data[k + 1], b = data[k + 2]
    if (Math.max(r, g, b) - Math.min(r, g, b) > 16 + 255 / a) continue
    data[k] = 255 - r; data[k + 1] = 255 - g; data[k + 2] = 255 - b
  }
}

// A box's fill taken out of what drew it (a legend's: fill and stroke, as
// #rrggbb, the stroke null for none), its outline left as it would be drawn
// alone. Each pixel is some of the outline over some of the fill, so how much
// of the outline it has follows from its color and how opaque it is (in the
// channel they differ most in)
export function clearPixels(data, fill, stroke) {
  const f = rgbOf(fill), st = stroke ? rgbOf(stroke) : null
  const k = st ? [0, 1, 2].reduce((best, c) => (Math.abs(st[c] - f[c]) > Math.abs(st[best] - f[best]) ? c : best), 0) : 0
  const apart = st ? (st[k] - f[k]) / 255 : 0
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255
    if (!a) continue
    // No outline, or one the fill's own color: nothing to keep
    if (Math.abs(apart) < 8 / 255) { data[i + 3] = 0; continue }
    const outline = Math.min(a, Math.max(0, (a * data[i + k] / 255 - a * f[k] / 255) / apart))
    data[i] = st[0]; data[i + 1] = st[1]; data[i + 2] = st[2]; data[i + 3] = Math.round(outline * 255)
  }
}

// Pixels (RGBA, as a canvas has them) of one color made another (#rrggbb):
// each as opaque as it was, and as far from the new color as it was from
// the old (an edge's shading). Near the color is nearer the fainter a pixel
// is, as a faint pixel's color is stored roughly
export function recolorPixels(data, from, to) {
  const [fr, fg, fb] = rgbOf(from), [tr, tg, tb] = rgbOf(to)
  const clamp = v => (v < 0 ? 0 : v > 255 ? 255 : v)
  for (let k = 0; k < data.length; k += 4) {
    const a = data[k + 3]
    if (!a) continue
    const dr = data[k] - fr, dg = data[k + 1] - fg, db = data[k + 2] - fb
    if (Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db)) > 28 + 765 / a) continue
    data[k] = clamp(tr + dr); data[k + 1] = clamp(tg + dg); data[k + 2] = clamp(tb + db)
  }
}
const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))

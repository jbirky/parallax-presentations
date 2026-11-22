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
// them, plotModel.js) can be left out, clear, as in splitSvg.js. A part
// drawn in another color (recolor) has its pixels of its color made the
// other, its words drawn over them after, in theirs.

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

// A page's operator list cut into runs: { runs: [{ part, run, ops: Set,
// backdrop, empty }], paints: Set (every painting operator), back: Set (the
// backgrounds' painting operators), words: Set (those that show text),
// plan }. backdrop: that a run paints a background; empty: that it paints
// nothing else, and they're left clear
export function planPdf(ops, layers, OPS, { backdrop = [], clear = false } = {}) {
  const NAME = {}
  for (const [k, v] of Object.entries(OPS)) NAME[v] = k
  const paints = [], words = new Set()
  ops.fnArray.forEach((fn, i) => {
    const name = NAME[fn]
    if (name === 'constructPath' ? PAINTS.has(NAME[ops.argsArray[i]?.[0]]) : PAINTS.has(name)) paints.push(i)
    if (WORDS.has(name)) words.add(i)
  })
  const owner = new Map()
  for (const l of layers) for (const [a, b] of l.ops || []) for (let i = a; i <= b; i++) owner.set(i, l.id)
  const runs = runsOf(paints.map(i => owner.get(i) || 'base'))
  const all = new Set(paints)
  const back = new Set()
  for (const [a, b] of backdrop) for (let i = a; i <= b; i++) if (all.has(i)) back.add(i)
  return {
    runs: runs.map(r => {
      const own = paints.slice(r.from, r.to + 1)
      const n = own.filter(i => back.has(i)).length
      return { part: r.part, run: r.run, ops: new Set(own), backdrop: n > 0, empty: clear && n === own.length }
    }),
    paints: all,
    back,
    words,
    plan: planOf(runs),
  }
}

// { pieces: [{ part, run, blob, backdrop }], plan, width, height, type, ext }:
// a piece is drawn only where need(piece, plan) says (else its blob is
// null), as the others are already on hand. longSide: the PNGs' longer
// side, in pixels; backdrop, clear: as planPdf has them; recolor: Map(part
// → { from, to })
export async function splitPdf(data, layers, pdfjsLib, { need = () => true, longSide = 2400, backdrop = [], clear = false, recolor = new Map() } = {}) {
  if (!layers.length || layers.some(l => !l.ops || !l.ops.length)) throw new SplitError('Only a figure saved by matplotlib can be kept as it is')
  const task = pdfjsLib.getDocument({ data, verbosity: 0, isEvalSupported: false })
  try {
    const page = await (await task.promise).getPage(1)
    const { runs, paints, back, words, plan } = planPdf(await page.getOperatorList(), layers, pdfjsLib.OPS, { backdrop, clear })
    const [x0, y0, x1, y1] = page.view
    const width = x1 - x0, height = y1 - y0
    const viewport = viewportOf(page, longSide)
    const pieces = []
    for (const r of keptRuns(runs)) {
      const piece = { part: r.part, run: r.run, blob: null, backdrop: r.backdrop }
      if (need(piece, plan)) {
        const own = i => r.ops.has(i) && !(clear && back.has(i))
        const swap = recolor.get(r.part)
        if (!swap) piece.blob = await pngOf(await draw(page, viewport, i => !paints.has(i) || own(i)))
        else {
          // In another color, but for its words (a legend entry's), which keep theirs
          const canvas = await draw(page, viewport, i => !paints.has(i) || (own(i) && !words.has(i)))
          const ctx = canvas.getContext('2d')
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
          recolorPixels(img.data, swap.from, swap.to)
          ctx.putImageData(img, 0, 0)
          if ([...r.ops].some(i => words.has(i))) ctx.drawImage(await draw(page, viewport, i => !paints.has(i) || (own(i) && words.has(i))), 0, 0)
          piece.blob = await pngOf(canvas)
        }
      }
      pieces.push(piece)
    }
    return { pieces, plan, width, height, type: 'image/png', ext: 'png' }
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

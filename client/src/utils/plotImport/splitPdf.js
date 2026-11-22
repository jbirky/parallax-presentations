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
// them, plotModel.js) can be left out, clear, as in splitSvg.js.

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

// A page's operator list cut into runs: { runs: [{ part, run, ops: Set,
// backdrop, empty }], paints: Set (every painting operator), back: Set (the
// backgrounds' painting operators), plan }. backdrop: that a run paints a
// background; empty: that it paints nothing else, and they're left clear
export function planPdf(ops, layers, OPS, { backdrop = [], clear = false } = {}) {
  const NAME = {}
  for (const [k, v] of Object.entries(OPS)) NAME[v] = k
  const paints = []
  ops.fnArray.forEach((fn, i) => {
    const name = NAME[fn]
    if (name === 'constructPath' ? PAINTS.has(NAME[ops.argsArray[i]?.[0]]) : PAINTS.has(name)) paints.push(i)
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
    plan: planOf(runs),
  }
}

// { pieces: [{ part, run, blob, backdrop }], plan, width, height, type, ext }:
// a piece is drawn only where need(piece, plan) says (else its blob is
// null), as the others are already on hand. longSide: the PNGs' longer
// side, in pixels; backdrop, clear: as planPdf has them
export async function splitPdf(data, layers, pdfjsLib, { need = () => true, longSide = 2400, backdrop = [], clear = false } = {}) {
  if (!layers.length || layers.some(l => !l.ops || !l.ops.length)) throw new SplitError('Only a figure saved by matplotlib can be kept as it is')
  const task = pdfjsLib.getDocument({ data, verbosity: 0, isEvalSupported: false })
  try {
    const page = await (await task.promise).getPage(1)
    const { runs, paints, back, plan } = planPdf(await page.getOperatorList(), layers, pdfjsLib.OPS, { backdrop, clear })
    const [x0, y0, x1, y1] = page.view
    const width = x1 - x0, height = y1 - y0
    const viewport = viewportOf(page, longSide)
    const pieces = []
    for (const r of keptRuns(runs)) {
      const piece = { part: r.part, run: r.run, blob: null, backdrop: r.backdrop }
      if (need(piece, plan)) {
        piece.blob = await draw(page, viewport, i => !paints.has(i) || (r.ops.has(i) && !(clear && back.has(i))))
      }
      pieces.push(piece)
    }
    return { pieces, plan, width, height, type: 'image/png', ext: 'png' }
  } finally {
    task.destroy()
  }
}

// The page whole, as a PNG the size of the pieces: a figure put on a slide
// before it's cut. backdrop: the operators that paint backgrounds to leave
// out, clear
export async function pdfFigurePng(data, pdfjsLib, { longSide = 2400, backdrop = [] } = {}) {
  const task = pdfjsLib.getDocument({ data, verbosity: 0, isEvalSupported: false })
  try {
    const page = await (await task.promise).getPage(1)
    const back = new Set()
    for (const [a, b] of backdrop) for (let i = a; i <= b; i++) back.add(i)
    return await draw(page, viewportOf(page, longSide), back.size ? i => !back.has(i) : undefined)
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

// The page drawn (only the operators filter lets through) as a PNG, clear
// where nothing's drawn
async function draw(page, viewport, operationsFilter) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  // A context of its own, made first: pdf.js would make one with no alpha
  const canvasContext = canvas.getContext('2d')
  await page.render({ canvasContext, viewport, background: 'rgba(0,0,0,0)', ...(operationsFilter ? { operationsFilter } : {}) }).promise
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('The figure couldn’t be drawn.'))), 'image/png'))
}

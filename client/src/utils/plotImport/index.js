// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Importing a plot: a figure saved from matplotlib as a PDF or an SVG, read
// in the browser into its axes and layers (plotModel.js), with a picture of
// it to check them against (PlotImportModal.jsx). Then either a graph of its
// data (toGraph.js: only the data is uploaded, as a dataset), or the figure
// as it is, cut into pieces each layer can come and go with (splitFigure;
// toFigure.js: the pieces and the file are uploaded).

import { libUrl, localizeLibraries } from '../libraries'
import { readPdfDrawing } from './pdfReader'
import { readSvgDrawing } from './svgReader'
import { plotFromDrawing, PlotError } from './plotModel'
import { splitSvg } from './splitSvg'
import { splitPdf } from './splitPdf'
import { partsOf, figureLayers } from './toFigure'

export { PlotError } from './plotModel'
export { plotToGraph, defaultChoices, IMPORT_WIDTH } from './toGraph'
export { splitSvg } from './splitSvg'
export { figureElements, readFigure, pieceKey, figureLayers } from './toFigure'
export { baseName } from './drawing'

export const MAX_PLOT_BYTES = 20 * 1024 * 1024

export function plotKind(file) {
  const name = String(file?.name || '').toLowerCase()
  if (name.endsWith('.svg') || file?.type === 'image/svg+xml') return 'svg'
  if (name.endsWith('.pdf') || file?.type === 'application/pdf') return 'pdf'
  return null
}

// pdf.js, from this app's copy, as the PDF pages import loads it
// (PdfPagesModal.jsx): its legacy build, for older browsers and Electron
async function loadPdfjs() {
  const pdfjsLib = await import(/* @vite-ignore */ localizeLibraries(libUrl('pdfjs-dist', 'legacy/build/pdf.min.mjs')))
  pdfjsLib.GlobalWorkerOptions.workerSrc = localizeLibraries(libUrl('pdfjs-dist', 'legacy/build/pdf.worker.min.mjs'))
  return pdfjsLib
}

// { kind, plot, preview, text, bytes }: preview is an image URL; revoke it
// with URL.revokeObjectURL when it's an object URL (an SVG's). text, an
// SVG's, and bytes, a PDF's: for keeping the figure as it is (splitFigure)
export async function readPlotFile(file) {
  const kind = plotKind(file)
  if (!kind) throw new PlotError('Choose a PDF or an SVG saved from matplotlib.')
  if (file.size > MAX_PLOT_BYTES) throw new PlotError('That file is over 20 MB; a figure saved from matplotlib is far smaller.')
  if (kind === 'svg') {
    const text = await file.text()
    const plot = plotFromDrawing(readSvgDrawing(text))
    // Shown as an image, so nothing in it runs
    return { kind, plot, text, preview: URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' })) }
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const pdfjsLib = await loadPdfjs()
  let drawing
  try {
    // pdf.js hands the bytes to its worker, so each read gets a copy
    drawing = await readPdfDrawing(bytes.slice(), pdfjsLib)
  } catch (err) {
    if (err instanceof PlotError) throw err
    throw new PlotError(`This PDF couldn’t be read (${err.message || 'unknown error'}).`)
  }
  const plot = plotFromDrawing(drawing)
  return { kind, plot, bytes, preview: await pdfPreview(bytes.slice(), pdfjsLib) }
}

// A figure read by readPlotFile that can be kept as it is: every layer of it
// drawn by groups an SVG names, or by operators a PDF lists
export function keepable(result) {
  const layers = result?.plot && figureLayers(result.plot)
  if (!layers?.length) return false
  if (result.kind === 'svg') return !!result.text && layers.every(l => l.groups?.length)
  return result.kind === 'pdf' && !!result.bytes && layers.every(l => l.ops?.length)
}

// A figure read by readPlotFile, cut into the pieces toFigure.js stacks:
// { pieces: [{ part, run, blob }], plan, width, height, type, ext }, an
// SVG's pieces as SVG, a PDF's as PNG; a piece's part is 'base', 'legend' or
// a layer's id. need(piece, plan): whether to make a piece (else its blob
// is null)
export async function splitFigure(result, { need = () => true } = {}) {
  const layers = partsOf(result.plot, result.kind)
  if (result.kind === 'svg') {
    const { pieces, ...rest } = splitSvg(result.text, layers)
    return { ...rest, pieces: pieces.map(p => ({ part: p.part, run: p.run, blob: need(p, rest.plan) ? new Blob([p.svg], { type: rest.type }) : null })) }
  }
  // pdf.js hands the bytes to its worker, so each read gets a copy
  return splitPdf(result.bytes.slice(), layers, await loadPdfjs(), { need })
}

// The PDF's first page as a PNG data URL
async function pdfPreview(bytes, pdfjsLib) {
  const task = pdfjsLib.getDocument({ data: bytes, verbosity: 0, isEvalSupported: false })
  try {
    const page = await (await task.promise).getPage(1)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvas, viewport }).promise
    return canvas.toDataURL('image/png')
  } catch {
    return null
  } finally {
    task.destroy()
  }
}

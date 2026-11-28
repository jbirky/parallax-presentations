// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Reading a figure saved from matplotlib, an SVG or a PDF, into its axes and
// layers, for import_plot (index.js), as the editor's Plot import reads one
// (client/src/utils/plotImport, bundled into shared.js). The reading runs in
// a worker thread (plot-worker.js) with a time and memory limit, so a slow or
// strange file never holds up the server: the SVG parsed with
// @xmldom/xmldom, the PDF read with the pdf.js the app serves its pages
// (/vendor), or the one in node_modules where there's no client build.

const fs = require('fs')
const path = require('path')
const { Worker } = require('worker_threads')

// As the editor's Plot import (MAX_PLOT_BYTES): a figure is far smaller
const MAX_PLOT_BYTES = 20 * 1024 * 1024
const READ_MS = 20000
const WORKER_MB = 512

// A file that isn't a figure, or one with no plot in it that can be read:
// the message says what's wrong, for the AI
class PlotReadError extends Error {}

// 'svg', 'pdf', or null for anything else
function plotKind(bytes) {
  const head = Buffer.from(bytes.subarray(0, 2048)).toString('utf8').replace(/^﻿/, '').trimStart()
  if (head.startsWith('%PDF-')) return 'pdf'
  if (/^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE\s+svg[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head)) return 'svg'
  return null
}

const root = path.join(__dirname, '..', '..')

// pdf.js's legacy build and its worker, as files: the copy the client build
// vendors (client/dist/vendor/pdfjs-dist@<version>), else node_modules'
let pdfjsFiles = null
function pdfjs() {
  if (pdfjsFiles) return pdfjsFiles
  try {
    const version = JSON.parse(fs.readFileSync(path.join(root, 'client', 'dist', 'vendor', 'manifest.json'), 'utf8')).versions?.['pdfjs-dist']
    const dir = path.join(root, 'client', 'dist', 'vendor', `pdfjs-dist@${version}`, 'legacy', 'build')
    const lib = path.join(dir, 'pdf.min.mjs'), worker = path.join(dir, 'pdf.worker.min.mjs')
    if (version && fs.existsSync(lib) && fs.existsSync(worker)) return (pdfjsFiles = { lib, worker })
  } catch { /* no client build here */ }
  try {
    const lib = require.resolve('pdfjs-dist/legacy/build/pdf.mjs', { paths: [root] })
    return (pdfjsFiles = { lib, worker: path.join(path.dirname(lib), 'pdf.worker.mjs') })
  } catch {
    return null
  }
}

// The plot in a figure's bytes (plotModel.js's: axes, layers, panels,
// warnings), read in a worker. Throws PlotReadError for a file that isn't a
// figure or has no plot that reads.
async function readPlot(bytes) {
  if (!bytes || !bytes.length) throw new PlotReadError('The file is empty.')
  if (bytes.length > MAX_PLOT_BYTES) throw new PlotReadError('That file is over 20 MB; a figure saved from matplotlib is far smaller.')
  const kind = plotKind(bytes)
  if (!kind) throw new PlotReadError("That isn't an SVG or a PDF. Save the figure from matplotlib with plt.savefig('figure.svg') or 'figure.pdf'.")
  const files = kind === 'pdf' ? pdfjs() : null
  if (kind === 'pdf' && !files) throw new PlotReadError("This server can't read PDFs. Save the figure as an SVG instead.")
  return new Promise((resolve, reject) => {
    let settled = false
    const done = (fn, value) => { if (!settled) { settled = true; clearTimeout(timer); fn(value) } }
    const worker = new Worker(path.join(__dirname, 'plot-worker.js'), {
      workerData: { kind, bytes: new Uint8Array(bytes), pdfjs: files },
      resourceLimits: { maxOldGenerationSizeMb: WORKER_MB },
      stdout: true, stderr: true,
    })
    const timer = setTimeout(() => {
      worker.terminate()
      done(reject, new PlotReadError('Reading the figure took too long. Save a simpler figure, or fewer points, and try again.'))
    }, READ_MS)
    worker.once('message', m => {
      if (m.plot) done(resolve, { kind, plot: m.plot })
      else done(reject, m.plotError ? new PlotReadError(m.error) : new Error(m.error))
      worker.terminate()
    })
    worker.once('error', err => done(reject, err?.code === 'ERR_WORKER_OUT_OF_MEMORY'
      ? new PlotReadError('The figure was too big to read. Save a simpler figure, or fewer points, and try again.')
      : err))
    worker.once('exit', code => done(reject, new Error(`The figure reader stopped (${code}).`)))
  })
}

module.exports = { readPlot, plotKind, PlotReadError, MAX_PLOT_BYTES }

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The worker thread plots.js reads a figure in: { kind: 'svg' | 'pdf',
// bytes, pdfjs: { lib, worker } } in, { plot } or { error, plotError } out.
// plotError: the file was read but isn't a plot that can be imported, and
// error says why in words for the AI.

const { parentPort, workerData } = require('worker_threads')
const { pathToFileURL } = require('url')

async function read({ kind, bytes, pdfjs }) {
  const shared = require('./shared')
  let drawing
  try {
    if (kind === 'svg') {
      const { DOMParser } = require('@xmldom/xmldom')
      drawing = shared.readSvgDrawing(Buffer.from(bytes).toString('utf8'), DOMParser)
    } else {
      const lib = await import(pathToFileURL(pdfjs.lib).href)
      lib.GlobalWorkerOptions.workerSrc = pathToFileURL(pdfjs.worker).href
      drawing = await shared.readPdfDrawing(new Uint8Array(bytes), lib)
    }
  } catch (err) {
    const what = kind === 'svg' ? 'This SVG' : 'This PDF'
    return { error: `${what} couldn't be read (${String(err?.message || err).split('\n')[0].slice(0, 200)}).`, plotError: true }
  }
  try {
    return { plot: shared.plotFromDrawing(drawing) }
  } catch (err) {
    if (err instanceof shared.PlotError) return { error: err.message, plotError: true }
    throw err
  }
}

read(workerData).then(
  out => parentPort.postMessage(out),
  err => parentPort.postMessage({ error: String(err?.message || err) }),
)

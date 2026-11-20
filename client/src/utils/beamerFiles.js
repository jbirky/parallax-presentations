// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The files a Beamer talk comes as, read in the browser for the Beamer
// import (components/BeamerImportModal.jsx): a .tex, or a project's .zip as
// Overleaf downloads it, with the files it \inputs, its .bib and its figures.
// Paths are kept relative to the main .tex, as the source names them.

import { libUrl, localizeLibraries } from './libraries'

const TEX = /\.(tex|ltx)$/i
const BIB = /\.bib$/i
const FIGURE = /\.(png|jpe?g|gif|svg|webp|pdf|eps)$/i
const MAIN_NAMES = /(^|\/)(main|slides|talk|presentation|beamer)\.tex$/i

// The file a project is built from: a Beamer \documentclass, then any
// document, then anything with frames
export function pickMain(texts) {
  const paths = [...texts.keys()]
  const score = p => {
    const t = texts.get(p) || ''
    return (/\\documentclass[^{]*\{beamer\}/.test(t) ? 8 : 0) + (/\\begin\{document\}/.test(t) ? 4 : 0)
      + (/\\begin\{frame\}|\\frame\s*\{/.test(t) ? 2 : 0) + (MAIN_NAMES.test(p) ? 1 : 0) - p.split('/').length * 0.01
  }
  return paths.sort((a, b) => score(b) - score(a))[0] || null
}

const skipped = path => /(^|\/)(__MACOSX|\.[^/]*)(\/|$)/.test(path)

// Files from an <input> or a drop, zips unpacked: { texts: Map, bibs: Map,
// figures: Map of path → { name, blob() } }
export async function readFiles(fileList) {
  const entries = []
  for (const f of fileList) {
    if (/\.zip$/i.test(f.name)) {
      const { default: JSZip } = await import('jszip')
      const zip = await JSZip.loadAsync(f)
      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir || skipped(path)) continue
        entries.push({ path, text: () => entry.async('string'), blob: () => entry.async('blob') })
      }
    } else entries.push({ path: f.webkitRelativePath || f.name, text: () => f.text(), blob: async () => f })
  }
  const texts = new Map(), bibs = new Map(), figures = new Map()
  for (const e of entries) {
    if (TEX.test(e.path)) texts.set(e.path, await e.text())
    else if (BIB.test(e.path)) bibs.set(e.path, await e.text())
    else if (FIGURE.test(e.path)) figures.set(e.path, { name: e.path.split('/').pop(), blob: e.blob })
  }
  return { texts, bibs, figures }
}

// Paths made relative to the folder of the main file
export function relativeTo(main, map) {
  const dir = main && main.includes('/') ? main.slice(0, main.lastIndexOf('/') + 1) : ''
  if (!dir) return map
  return new Map([...map].map(([p, v]) => [p.startsWith(dir) ? p.slice(dir.length) : p, v]))
}

const EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.eps']

// The figure \includegraphics{name} means, as LaTeX looks for it: with the
// extensions it tries, in each \graphicspath folder; then in any case, and
// then by its file name anywhere
export function findFigure(figures, name, graphicsPaths = []) {
  const want = String(name || '').trim().replace(/^\.\//, '').replace(/^"(.*)"$/, '$1')
  if (!want) return null
  const dirs = ['', ...graphicsPaths.map(d => d.replace(/^\.\//, '').replace(/\/*$/, '/'))]
  const exts = ['', ...EXTS]
  const candidates = dirs.flatMap(d => exts.map(x => d + want + x))
  for (const p of candidates) if (figures.has(p)) return p
  const lower = new Map([...figures.keys()].map(k => [k.toLowerCase(), k]))
  for (const p of candidates) if (lower.has(p.toLowerCase())) return lower.get(p.toLowerCase())
  const base = want.split('/').pop().toLowerCase()
  for (const k of figures.keys()) {
    const b = k.split('/').pop().toLowerCase()
    if (b === base || b.replace(/\.[^.]+$/, '') === base) return k
  }
  return null
}

// Pixels per inch a PNG (pHYs) or JPEG (JFIF) says it has, which LaTeX sizes
// it by; 72 when it says nothing, as LaTeX takes it
export function imageDpi(bytes) {
  const b = new Uint8Array(bytes)
  const u32 = i => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    for (let i = 8; i + 12 <= b.length;) {
      const len = u32(i), type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7])
      if (type === 'pHYs' && b[i + 16] === 1) return Math.round(u32(i + 8) * 0.0254) || 72
      if (type === 'IDAT' || type === 'IEND') break
      i += 12 + len
    }
    return 72
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 4 < b.length;) {
      if (b[i] !== 0xff) break
      const marker = b[i + 1], len = (b[i + 2] << 8) | b[i + 3]
      if (marker === 0xe0 && String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]) === 'JFIF') {
        const unit = b[i + 11], x = (b[i + 12] << 8) | b[i + 13]
        return unit === 1 ? x || 72 : unit === 2 ? Math.round(x * 2.54) || 72 : 72
      }
      if (marker === 0xda) break
      i += 2 + len
    }
  }
  return 72
}

let pdfjs = null
async function loadPdfjs() {
  if (!pdfjs) {
    // As the toolbar's PDF import loads it: this app's copy, the legacy build
    pdfjs = await import(/* @vite-ignore */ localizeLibraries(libUrl('pdfjs-dist', 'legacy/build/pdf.min.mjs')))
    pdfjs.GlobalWorkerOptions.workerSrc = localizeLibraries(libUrl('pdfjs-dist', 'legacy/build/pdf.worker.min.mjs'))
  }
  return pdfjs
}

const imageSize = blob => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
  img.onerror = () => { reject(new Error('unreadable')); URL.revokeObjectURL(url) }
  img.src = url
})

// A figure ready to show and upload: { blob, url, width, height } in points,
// a PDF's first page drawn as a PNG; or { error }
export async function loadFigure(entry) {
  const name = entry.name
  try {
    const blob = await entry.blob()
    if (/\.eps$/i.test(name)) return { error: 'eps' }
    if (/\.pdf$/i.test(name)) {
      const lib = await loadPdfjs()
      const pdf = await lib.getDocument({ data: await blob.arrayBuffer() }).promise
      const page = await pdf.getPage(1)
      const unit = page.getViewport({ scale: 1 })
      const scale = Math.min(4, 2200 / Math.max(unit.width, unit.height))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await page.render({ canvas, viewport }).promise
      const png = await new Promise(r => canvas.toBlob(r, 'image/png'))
      pdf.destroy?.()
      return { blob: png, name: name.replace(/\.pdf$/i, '.png'), url: URL.createObjectURL(png), width: unit.width, height: unit.height }
    }
    const { width, height } = await imageSize(blob)
    const dpi = /\.svg$/i.test(name) ? 96 : imageDpi(await blob.slice(0, 65536).arrayBuffer())
    const typed = blob.type ? blob : new Blob([blob], { type: /\.svg$/i.test(name) ? 'image/svg+xml' : /\.png$/i.test(name) ? 'image/png' : /\.gif$/i.test(name) ? 'image/gif' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg' })
    return { blob: typed, name, url: URL.createObjectURL(typed), width: width * 72 / dpi, height: height * 72 / dpi }
  } catch (e) {
    return { error: e?.message || 'unreadable' }
  }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Slides from LaTeX Beamer: source typed or pasted, or a .tex, .bib files,
// figures or a project's .zip dropped in, read (utils/beamer.js) and laid out
// (utils/beamerSlides.js) as ordinary slides, previewed frame by frame. From
// the slide panel's Import it adds slides to the deck (mode 'insert'); from
// the dashboard it starts a new one (mode 'new').

import { useState, useEffect, useMemo, useRef } from 'react'
import katex from 'katex'
import { X, Upload, AlertTriangle, Check, Loader, HelpCircle } from 'lucide-react'
import { readBeamer, plainText } from '../utils/beamer'
import { beamerSlides, mergeBibliography, citedKeys, citeKeyFinder } from '../utils/beamerSlides'
import { readFiles, pickMain, relativeTo, findFigure, loadFigure } from '../utils/beamerFiles'
import { parseBibtex } from '../utils/bibtexParser'
import { safeHtml } from '../utils/safeHtml'
import { shapeSvgString } from '../utils/shapeUtils'
import { api } from '../utils/api'
import { DEFAULT_DECK_FONT } from '../utils/deckFont'

const THUMB_W = 216
// The type a slide's text boxes sit in, on the canvas and in decks
const SLIDE_TYPE = { fontSize: 42, fontFamily: DEFAULT_DECK_FONT }

const EXAMPLE = `\\documentclass[aspectratio=169]{beamer}
\\title{A talk in Beamer}
\\author{Your Name}
\\date{\\today}

\\begin{document}
\\frame{\\titlepage}

\\section{Introduction}
\\begin{frame}{What carries over}
  \\begin{itemize}
    \\item Text, \\textbf{bold}, \\emph{emphasis} and \\alert{alerts}
    \\item Math, inline $e^{i\\pi} + 1 = 0$ and displayed:
      \\[ \\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2} \\]
    \\pause
    \\item Steps, from \\texttt{\\textbackslash pause} and overlays
  \\end{itemize}
\\end{frame}

\\begin{frame}{Columns and blocks}
  \\begin{columns}
    \\begin{column}{0.48\\textwidth}
      \\begin{block}{Definition}
        A block, with its title.
      \\end{block}
    \\end{column}
    \\begin{column}{0.48\\textwidth}
      \\begin{enumerate}
        \\item One
        \\item Two
      \\end{enumerate}
    \\end{column}
  \\end{columns}
\\end{frame}
\\end{document}
`

// Math in an element tree, drawn by KaTeX as the canvas draws it
function renderMath(root) {
  root.querySelectorAll('span[data-math-latex]').forEach(el => {
    if (el.getAttribute('data-katex-done')) return
    try {
      katex.render(el.getAttribute('data-math-latex'), el, { throwOnError: false, displayMode: el.getAttribute('data-math-display') === 'true' })
      el.setAttribute('data-katex-done', '1')
    } catch {}
  })
}

// Text boxes measured in the page, styled as the canvas styles them
function domMeasurer(fontFamily) {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;left:-20000px;top:0;visibility:hidden;pointer-events:none;font-size:${SLIDE_TYPE.fontSize}px;font-family:${SLIDE_TYPE.fontFamily}`
  document.body.appendChild(host)
  const cache = new Map()
  const measure = (html, width) => {
    const key = width + '|' + html
    let h = cache.get(key)
    if (h !== undefined) return h
    const el = document.createElement('div')
    el.className = 'slide-text-content'
    el.style.cssText = `width:${width}px;padding:8px 12px;box-sizing:border-box;line-height:1.5;color:white;${fontFamily ? `font-family:${fontFamily};` : ''}`
    el.innerHTML = safeHtml(html)
    renderMath(el)
    host.appendChild(el)
    h = Math.ceil(el.getBoundingClientRect().height)
    host.removeChild(el)
    cache.set(key, h)
    return h
  }
  measure.dispose = () => host.remove()
  return measure
}

function ThumbElement({ el, fontFamily }) {
  const box = { position: 'absolute', left: el.x, top: el.y, width: el.width, height: el.height, zIndex: el.zIndex || 1, overflow: 'hidden', boxSizing: 'border-box' }
  if (el.type === 'text') {
    return <div className="slide-text-content" style={{ ...box, padding: '8px 12px', lineHeight: 1.5, color: 'white', fontFamily: fontFamily || undefined }} dangerouslySetInnerHTML={{ __html: safeHtml(el.content) }} />
  }
  if (el.type === 'image') return <img src={el.src} alt="" draggable={false} style={{ ...box, objectFit: el.objectFit || 'contain' }} />
  if (el.type === 'shape') return <div style={box} dangerouslySetInnerHTML={{ __html: safeHtml(shapeSvgString(el)) }} />
  if (el.type === 'code') {
    return <pre style={{ ...box, margin: 0, padding: '10px 14px', background: '#0d1117', color: '#c9d1d9', fontSize: el.fontSize || 14, lineHeight: 1.5, fontFamily: "'Fira Code', 'Courier New', monospace", borderRadius: 4 }}>{el.content}</pre>
  }
  if (el.type === 'table') {
    return (
      <table style={{ ...box, borderCollapse: 'collapse', display: 'table', height: 'auto' }}>
        <tbody>{(el.data || []).map((row, ri) => (
          <tr key={ri}>{row.map((cell, ci) => (
            <td key={ci} style={{ padding: el.cellPadding, border: `${el.borderWidth}px solid ${el.borderColor}`, background: el.headerRow && ri === 0 ? el.headerBgColor : el.cellBgColor, color: el.textColor, fontSize: el.fontSize }}>{cell}</td>
          ))}</tr>
        ))}</tbody>
      </table>
    )
  }
  if (el.type === 'latex') {
    return <div style={{ ...box, display: 'grid', placeItems: 'center', border: `2px dashed ${el.textColor || '#888'}`, opacity: 0.45, color: el.textColor, fontFamily: 'serif', fontSize: 40 }}>{/tikzpicture/.test(el.content) ? 'TikZ' : 'LaTeX table'}</div>
  }
  return null
}

function Thumb({ slide, slideW, slideH, fontFamily }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) renderMath(ref.current) }, [slide])
  const scale = THUMB_W / slideW
  const steps = new Set(slide.elements.filter(e => e.fragment).map(e => e.fragmentIndex)).size
  return (
    <div style={{ width: THUMB_W, height: Math.round(slideH * scale), overflow: 'hidden', position: 'relative', borderRadius: 3, background: slide.background?.color, boxShadow: '0 0 0 1px var(--border)', fontFamily: DEFAULT_DECK_FONT }}>
      <div ref={ref} style={{ position: 'absolute', left: 0, top: 0, width: slideW, height: slideH, transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none', ...SLIDE_TYPE }}>
        {slide.elements.map(el => <ThumbElement key={el.id} el={el} fontFamily={fontFamily} />)}
      </div>
      {steps > 0 && (
        <span title="Shown step by step" style={{ position: 'absolute', right: 4, bottom: 4, fontSize: 10, background: 'rgba(99,102,241,0.9)', color: 'white', borderRadius: 3, padding: '0 5px', lineHeight: '16px' }}>
          {steps + 1} steps
        </span>
      )}
    </div>
  )
}

// Figures a document names, from every frame and its title page
function figurePaths(doc) {
  const paths = new Set()
  const walk = blocks => (blocks || []).forEach(b => {
    if (b.kind === 'images') b.items.forEach(it => paths.add(it.path))
    if (b.items && b.kind !== 'images') b.items.forEach(it => walk(it.blocks))
    walk(b.blocks)
    if (b.cols) b.cols.forEach(c => walk(c.blocks))
  })
  doc.frames.forEach(f => walk(f.blocks))
  walk(doc.meta.graphic)
  return paths
}

const SIZES = { '16:9': [960, 540], '4:3': [960, 720], '16:10': [960, 600] }
// Beamer's frame sizes (millimeters), by the aspect ratio they make
const RATIOS = { '160x90': '16:9', '128x96': '4:3', '160x100': '16:10', '140x90': '14:9', '148.5x105': '√2:1', '125x100': '5:4', '135x90': '3:2' }

// onInsert(slides, bibliography) in mode 'insert'; onCreate({ title, slides,
// bibliography, slideWidth, slideHeight, theme }) in mode 'new'.
// bibliography: the deck's library, which citations join
export default function BeamerImportModal({ mode = 'insert', slideW = 960, slideH = 540, bibliography = [], globalFont = '', dark = false, onInsert, onCreate, onClose }) {
  const [source, setSource] = useState('')
  const [files, setFiles] = useState({ texts: new Map(), bibs: new Map(), figures: new Map() })
  const [look, setLook] = useState(dark ? 'dark' : 'light')
  const [overlays, setOverlays] = useState('steps')
  const [size, setSize] = useState('source')
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState(null)
  const [figures, setFigures] = useState(new Map())
  const [skipped, setSkipped] = useState(new Set())
  const [busy, setBusy] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [measure, setMeasure] = useState(null)
  const loading = useRef(new Set())
  const fileInput = useRef(null)

  useEffect(() => {
    const m = domMeasurer(globalFont)
    setMeasure(() => m)
    return () => m.dispose()
  }, [globalFont])

  // Object URLs for the figures, let go when the modal closes
  const figuresRef = useRef(figures)
  figuresRef.current = figures
  useEffect(() => () => { for (const f of figuresRef.current.values()) if (f.url) URL.revokeObjectURL(f.url) }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      if (!source.trim()) { setDoc(null); setError(null); return }
      try {
        setDoc(readBeamer(source, { files: files.texts }))
        setError(null)
      } catch (e) {
        setError(`Couldn’t read this source: ${e.message}`)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [source, files.texts])

  // Figures the source names, read from the files given as they're needed
  useEffect(() => {
    if (!doc) return
    for (const path of figurePaths(doc)) {
      const p = findFigure(files.figures, path, doc.graphicsPaths)
      if (!p || figures.has(p) || loading.current.has(p)) continue
      loading.current.add(p)
      loadFigure(files.figures.get(p)).then(fig => {
        loading.current.delete(p)
        setFigures(prev => new Map(prev).set(p, fig))
      })
    }
  }, [doc, files.figures, figures])

  const references = useMemo(() => {
    const incoming = [...files.bibs.values()].flatMap(text => { try { return parseBibtex(text) } catch { return [] } })
    for (const item of doc?.bibItems || []) incoming.push({ type: 'misc', key: item.key, title: item.text })
    return mergeBibliography(mode === 'insert' ? bibliography : [], incoming)
  }, [files.bibs, doc, bibliography, mode])

  const slideSize = useMemo(() => {
    if (mode !== 'new') return [slideW, slideH]
    if (SIZES[size]) return SIZES[size]
    const s = doc?.size
    return s ? [960, Math.round(960 * s.height / s.width)] : [960, 540]
  }, [mode, size, doc, slideW, slideH])

  const layout = useMemo(() => {
    if (!doc || !measure) return null
    const citeKey = citeKeyFinder(references.keyMap, mode === 'insert' ? bibliography : [])
    const order = new Map()
    const cite = key => {
      const k = citeKey(key)
      if (!k) return null
      if (!order.has(k)) order.set(k, order.size + 1)
      return { key: k, label: `[${order.get(k)}]` }
    }
    const image = path => {
      const p = findFigure(files.figures, path, doc.graphicsPaths)
      const fig = p && figures.get(p)
      return fig && !fig.error ? { src: fig.url, width: fig.width, height: fig.height } : null
    }
    try {
      return beamerSlides(doc, { slideW: slideSize[0], slideH: slideSize[1], look, overlays, measure, image, cite })
    } catch (e) {
      return { error: e.message }
    }
  }, [doc, measure, look, overlays, slideSize, figures, files.figures, references, bibliography, mode])

  const frames = useMemo(() => {
    const out = new Map()
    for (const s of layout?.slides || []) {
      if (!out.has(s.frame)) out.set(s.frame, [])
      out.get(s.frame).push(s.slide)
    }
    return [...out]
  }, [layout])

  const chosen = frames.filter(([n]) => !skipped.has(n))
  const chosenSlides = chosen.flatMap(([, slides]) => slides)
  const pendingFigures = doc ? [...figurePaths(doc)].some(p => { const k = findFigure(files.figures, p, doc.graphicsPaths); return k && !figures.has(k) }) : false
  const unreadable = doc ? [...figurePaths(doc)].map(p => findFigure(files.figures, p, doc.graphicsPaths)).filter(k => k && figures.get(k)?.error) : []
  const unlinked = useMemo(() => {
    if (!doc) return 0
    const keys = new Set()
    const walkRuns = runs => (runs || []).forEach(r => r.t === 'cite' && r.keys.forEach(k => keys.add(k)))
    const walk = bs => (bs || []).forEach(b => { walkRuns(b.runs); walkRuns(b.title); if (b.items && b.kind !== 'images') b.items.forEach(i => walk(i.blocks)); walk(b.blocks); if (b.cols) b.cols.forEach(c => walk(c.blocks)) })
    doc.frames.forEach(f => walk(f.blocks))
    const citeKey = citeKeyFinder(references.keyMap, mode === 'insert' ? bibliography : [])
    return [...keys].filter(k => !citeKey(k)).length
  }, [doc, references, bibliography, mode])

  async function addFiles(list) {
    if (!list?.length) return
    try {
      const read = await readFiles([...list])
      const main = pickMain(read.texts)
      const rel = map => relativeTo(main, map)
      setFiles(prev => ({
        texts: new Map([...prev.texts, ...rel(read.texts)]),
        bibs: new Map([...prev.bibs, ...rel(read.bibs)]),
        figures: new Map([...prev.figures, ...rel(read.figures)]),
      }))
      if (main) {
        const text = read.texts.get(main)
        // A full document replaces what's here; a piece of one, with nothing
        // here yet, is the source too
        if (/\\begin\{document\}/.test(text) || !source.trim()) { setSource(text); setSkipped(new Set()) }
      }
    } catch (e) {
      setError(`Couldn’t read those files: ${e.message}`)
    }
  }

  async function finish() {
    if (!chosenSlides.length || busy) return
    setError(null)
    try {
      // The figures these slides show, uploaded for the deck
      const byUrl = new Map([...figures.values()].filter(f => f.url).map(f => [f.url, f]))
      const used = [...new Set(chosenSlides.flatMap(s => s.elements.filter(e => e.type === 'image' && byUrl.has(e.src)).map(e => e.src)))]
      const urls = new Map()
      for (let k = 0; k < used.length; k++) {
        setBusy(`Uploading figures (${k + 1} of ${used.length})…`)
        const fig = byUrl.get(used[k])
        const result = await api.uploadFile(new File([fig.blob], fig.name, { type: fig.blob.type || 'image/png' }))
        if (!result?.url) throw new Error('A figure didn’t upload')
        urls.set(used[k], result.url)
      }
      setBusy(mode === 'new' ? 'Making the presentation…' : 'Adding the slides…')
      const slides = chosenSlides.map(s => ({ ...s, elements: s.elements.map(e => e.type === 'image' && urls.has(e.src) ? { ...e, src: urls.get(e.src) } : e) }))
      // The references these slides cite join the library
      const cited = citedKeys(slides)
      const added = references.added.filter(e => cited.has(e.key))
      if (mode === 'new') {
        await onCreate({
          title: plainText(doc.meta.title) || 'Beamer talk',
          slides,
          bibliography: added,
          slideWidth: slideSize[0],
          slideHeight: slideSize[1],
          theme: look === 'dark' ? 'black' : 'white',
        })
      } else onInsert(slides, added.length ? [...bibliography, ...added] : null)
    } catch (e) {
      setBusy(null)
      setError(e.message || 'Something went wrong')
    }
  }

  const toggle = n => setSkipped(prev => { const next = new Set(prev); if (next.has(n)) next.delete(n); else next.add(n); return next })
  const missing = layout?.missing || []
  const crowded = layout?.crowded || []
  const fileCount = files.texts.size + files.bibs.size + files.figures.size

  const segment = (value, current, set, label) => (
    <button key={value} onClick={() => set(value)} className="btn" aria-pressed={current === value}
      style={{ padding: '4px 10px', fontSize: 12, borderRadius: 0, border: 'none', background: current === value ? 'var(--accent)' : 'transparent', color: current === value ? 'white' : 'var(--text-secondary)' }}>
      {label}
    </button>
  )

  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-label="Slides from LaTeX Beamer" onClick={e => e.stopPropagation()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={e => { if (e.currentTarget === e.target) setDragging(false) }}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        style={{ width: 'min(1180px, 96vw)', height: '88vh', background: 'var(--bg-card)', border: `1px solid ${dragging ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>{mode === 'new' ? 'New presentation from LaTeX Beamer' : 'Slides from LaTeX Beamer'}</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>Frames become slides you can edit: text, math, lists, figures, tables, steps and notes.</span>
          <a href="/#docs/tutorials/beamer-import" target="_blank" rel="noopener noreferrer" title="How Beamer comes across" style={{ color: 'var(--text-muted)', display: 'flex', padding: 4 }}><HelpCircle size={16} /></a>
          <button onClick={onClose} disabled={!!busy} title="Close" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(320px, 42%) 1fr' }}>
          {/* The source */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid var(--border)', padding: 14, gap: 10 }}>
            <div style={{ border: `1.5px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, background: dragging ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
              <Upload size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Drop a <code>.tex</code>, a project <code>.zip</code> (as Overleaf downloads it), <code>.bib</code> files or figures here.
                {fileCount > 0 && (
                  <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                    {[files.texts.size && `${files.texts.size} .tex`, files.bibs.size && `${files.bibs.size} .bib`, files.figures.size && `${files.figures.size} figure${files.figures.size === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <button className="btn btn-secondary" onClick={() => fileInput.current?.click()} style={{ padding: '5px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>Choose files</button>
              <input ref={fileInput} type="file" multiple accept=".tex,.ltx,.zip,.bib,.png,.jpg,.jpeg,.gif,.svg,.webp,.pdf,.eps" style={{ display: 'none' }}
                onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
            </div>
            <textarea value={source} onChange={e => setSource(e.target.value)} spellCheck={false} aria-label="Beamer source"
              placeholder={'Type or paste Beamer source: a whole document, or just some frames.\n\n\\begin{frame}{A title}\n  \\begin{itemize}\n    \\item First point\n    \\pause\n    \\item Second point\n  \\end{itemize}\n\\end{frame}'}
              style={{ flex: 1, minHeight: 0, resize: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontFamily: "'Fira Code', 'JetBrains Mono', Menlo, monospace", fontSize: 12.5, lineHeight: 1.55, tabSize: 2 }} />
            {!source.trim() && (
              <button onClick={() => setSource(EXAMPLE)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontSize: 12, cursor: 'pointer' }}>
                Start from an example
              </button>
            )}
          </div>

          {/* The slides */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
              <div role="group" aria-label="Look" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Look
                <span style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  {segment('light', look, setLook, 'Light')}
                  {segment('dark', look, setLook, 'Dark')}
                </span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Steps
                <select className="form-select" value={overlays} onChange={e => setOverlays(e.target.value)} style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
                  title="\pause and overlays like <2->">
                  <option value="steps">Build up each slide</option>
                  <option value="slides">A slide per step</option>
                  <option value="none">Final step only</option>
                </select>
              </label>
              {mode === 'new' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Size
                  <select className="form-select" value={size} onChange={e => setSize(e.target.value)} style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}>
                    <option value="source">As the source{doc ? ` (${RATIOS[`${doc.size.width}x${doc.size.height}`] || `${doc.size.width}×${doc.size.height} mm`})` : ''}</option>
                    <option value="16:9">16:9</option>
                    <option value="4:3">4:3</option>
                    <option value="16:10">16:10</option>
                  </select>
                </label>
              )}
              {frames.length > 0 && (
                <button onClick={() => setSkipped(skipped.size ? new Set() : new Set(frames.map(([n]) => n)))}
                  style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', padding: '3px 8px', fontSize: 11 }}>
                  {skipped.size ? 'Select all' : 'Select none'}
                </button>
              )}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
              {(error || layout?.error) && <Notice>{error || `Couldn’t lay out the slides: ${layout.error}`}</Notice>}
              {doc && (missing.length > 0 || unreadable.length > 0 || unlinked > 0 || crowded.length > 0 || doc.warnings.length > 0) && (
                <details style={{ marginBottom: 14, fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '8px 12px' }}>
                  <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={13} style={{ color: '#f59e0b' }} />
                    {[
                      missing.length && `${missing.length} figure${missing.length === 1 ? '' : 's'} not found`,
                      unlinked && `${unlinked} citation${unlinked === 1 ? '' : 's'} without an entry`,
                      crowded.length && `${crowded.length} crowded frame${crowded.length === 1 ? '' : 's'}`,
                      doc.warnings.length && `${doc.warnings.length} note${doc.warnings.length === 1 ? '' : 's'}`,
                    ].filter(Boolean).join(' · ') || 'Notes'}
                  </summary>
                  <ul style={{ margin: '8px 0 2px', paddingLeft: 18, lineHeight: 1.55 }}>
                    {missing.length > 0 && <li>Not found: {missing.join(', ')}. Drop the figures here, or the project’s .zip; they show as boxes until then.</li>}
                    {unreadable.length > 0 && <li>Can’t be shown: {unreadable.join(', ')}{unreadable.some(p => /\.eps$/i.test(p)) ? ' (EPS figures need converting to PDF or PNG first)' : ''}.</li>}
                    {unlinked > 0 && <li>Citations whose keys aren’t in any .bib given show as [key]. Drop the .bib file to link them to the bibliography.</li>}
                    {crowded.length > 0 && <li>Frame{crowded.length === 1 ? '' : 's'} {crowded.join(', ')} still overflow{crowded.length === 1 ? 's' : ''} after shrinking; check {crowded.length === 1 ? 'it' : 'them'} after importing.</li>}
                    {doc.warnings.map((w, k) => <li key={k}>{w.message}{w.frames.length ? ` (frame${w.frames.length === 1 ? '' : 's'} ${w.frames.join(', ')})` : ''}</li>)}
                  </ul>
                </details>
              )}
              {!doc && !error && (
                <div style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
                  <div>The slides show here as you type.<br />Each frame becomes a slide, or a slide per step if you choose.</div>
                </div>
              )}
              {doc && !frames.length && !error && !layout?.error && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No frames yet: frames are <code>\begin{'{frame}'} … \end{'{frame}'}</code>.</div>}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${THUMB_W + 14}px, 1fr))`, gap: 12 }}>
                {frames.map(([n, slides]) => {
                  const on = !skipped.has(n)
                  const frame = doc.frames.find(f => f.number === n)
                  const title = plainText(frame?.title) || (frame?.blocks.some(b => b.kind === 'titlepage') ? 'Title page' : 'Untitled')
                  return (
                    <div key={n} onClick={() => toggle(n)} role="checkbox" aria-checked={on} tabIndex={0}
                      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(n) } }}
                      style={{ position: 'relative', cursor: 'pointer', borderRadius: 8, padding: 7, border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'rgba(99,102,241,0.07)' : 'var(--bg-secondary)', opacity: on ? 1 : 0.55 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {slides.map(slide => <Thumb key={slide.id} slide={slide} slideW={slideSize[0]} slideH={slideSize[1]} fontFamily={globalFont} />)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'grid', placeItems: 'center', background: on ? 'var(--accent)' : 'transparent', border: on ? 'none' : '1px solid var(--border)' }}>
                          {on && <Check size={11} color="white" />}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}. {title}</span>
                        {slides.length > 1 && <span style={{ marginLeft: 'auto', flexShrink: 0 }}>{slides.length} slides</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {busy ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> {busy}</>
              : pendingFigures ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Reading figures…</>
                : frames.length ? `${chosen.length} of ${frames.length} frame${frames.length === 1 ? '' : 's'} · ${chosenSlides.length} slide${chosenSlides.length === 1 ? '' : 's'}${references.added.length ? ` · ${references.added.length} reference${references.added.length === 1 ? '' : 's'} in the .bib` : ''}` : ''}
          </span>
          <button className="btn btn-secondary" onClick={onClose} disabled={!!busy}>Cancel</button>
          <button className="btn btn-primary" onClick={finish} disabled={!chosenSlides.length || !!busy || pendingFigures}>
            {mode === 'new' ? 'Create presentation' : `Add ${chosenSlides.length || ''} slide${chosenSlides.length === 1 ? '' : 's'}`.replace('  ', ' ')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Notice({ children }) {
  return <div style={{ marginBottom: 12, fontSize: 12, color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '8px 12px' }}>{children}</div>
}

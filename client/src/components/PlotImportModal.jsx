// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Insert › Science › Plot from a figure, File › Import › Plot from a PDF or
// SVG figure: a matplotlib figure, read in the browser (utils/plotImport),
// shown beside what was found in it, its axes and its layers. Each layer can
// be renamed, left out, and given the step it appears at and the step it
// leaves at. Then, either:
//   a graph of its data: a dataset of the layers' data, linked to the deck,
//     and a Graph element's fields for the editor (onInsert);
//   the figure as it is: the file and the pieces it's cut into (images: an
//     SVG's as SVG, a PDF's as PNG), uploaded, the pieces stacked in a
//     group, each layer's hidden until its step and from the step it leaves
//     at (onInsertElements). Its background and its axes' can be left out,
//     transparent, as savefig(transparent=True) leaves them (the legends'
//     boxes too), its text and lines made white for a dark slide, a layer
//     drawn in another color, and its titles' and axis labels' words
//     changed; the figure is shown as it will look. And it can be
//     annotated: callouts, rings and boxes pinned to points in its data,
//     made of the slide's own elements in its group (utils/plotImport/notes.js).
// A figure kept as it is opens here again (figure: its elements; source:
// its file, { url, name }), to change its layers: onInsertElements(elements,
// { replace: the ids they stand in for }).

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../utils/api'
import { refreshGraphData } from '../utils/graphData'
import { readPlotFile, plotToGraph, defaultChoices, baseName, keepable, splitFigure, figureElements, readFigure, pieceKey, figureLayers, panelPlot, partSteps, hasBackdrop, recolorOf, fontFor,
  notesOnFigure, readNotes, placeOf, snapTo, pageOf, toData, defaultOffset, noteSize, arrowEnds, wordsBox, insetWords, IMPORT_WIDTH } from '../utils/plotImport'

// Behind a figure with a transparent background, light or dark
const CHECKERS = 'repeating-conic-gradient(#d4d4d8 0% 25%, #ffffff 0% 50%) 50% / 16px 16px'
const DARK_CHECKERS = 'repeating-conic-gradient(#3f3f46 0% 25%, #18181b 0% 50%) 50% / 16px 16px'
// What a title or label is, said in a list of them
// What an annotation is
const NOTE_KINDS = { arrow: 'Arrow', ring: 'Ring', box: 'Box' }
const LABEL_KINDS = { title: 'Title', xlabel: 'x-axis label', ylabel: 'y-axis label', ylabel2: 'Right y-axis label', xlabel2: 'Top x-axis label', suptitle: 'Figure title' }
const STEPS = Array.from({ length: 20 }, (_, i) => i + 1)
const fmt = v => (!isFinite(v) ? '—' : Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(2).replace('-', '−') : String(+v.toPrecision(4)).replace('-', '−'))

function describe(layer) {
  const n = layer.data.x.filter(v => isFinite(v)).length
  if (layer.kind === 'bars') return `${n} bar${n === 1 ? '' : 's'}`
  if (layer.kind === 'line') return `Line through ${n} point${n === 1 ? '' : 's'}${layer.style && layer.style !== 'solid' ? `, ${layer.style}` : ''}`
  const errs = [layer.data.yErr && 'y', layer.data.xErr && 'x'].filter(Boolean)
  return `${n} point${n === 1 ? '' : 's'}${errs.length ? `, with ${errs.join(' and ')} error bars` : ''}`
}

// A dataset name of the user's not yet taken: uploading under a taken one replaces it
async function freeName(base) {
  let names = new Set()
  try { names = new Set((await api.getDatasets() || []).map(d => String(d.name).toLowerCase())) } catch { /* the server says if it's taken */ }
  let name = base
  for (let n = 2; names.has(name.toLowerCase()); n++) name = `${base} ${n}`
  return name
}

export default function PlotImportModal({ file: initialFile, source, figure: figureEls, presentationId, dark, onInsert, onInsertElements, onClose }) {
  const [file, setFile] = useState(initialFile || null)
  const [result, setResult] = useState(null) // { kind, plot, preview, text, bytes }
  const [choices, setChoices] = useState({})
  const [oneByOne, setOneByOne] = useState(true)
  const [mode, setMode] = useState('graph') // 'graph', or 'figure': kept as it is
  const [graphOf, setGraphOf] = useState(null) // of several panels, the one a graph is made of
  const [previous, setPrevious] = useState(null) // the figure opened again, read (readFigure)
  const [clear, setClear] = useState(false) // kept as it is, with a transparent background
  const [forDark, setForDark] = useState(false) // kept as it is, its text and lines white, for a dark slide
  const [words, setWords] = useState({}) // kept as it is, its titles' and labels' words: { [label id]: words }
  const [notes, setNotes] = useState([]) // kept as it is, its annotations (notes.js)
  const [placing, setPlacing] = useState(null) // an annotation being put on the figure: 'arrow', 'ring' or 'box'
  const [band, setBand] = useState(null) // a box being dragged out over the figure: [from, to], in its points
  const readBack = useRef(new Map()) // the annotations as the figure had them (readNotes), by id
  const sketch = useRef(null) // the drawing of them over the figure
  const moving = useRef(null) // an annotation's words being dragged: { id, x, y, offset }
  const [look, setLook] = useState(null) // the figure as it will look: its pieces' image URLs, stacked
  const pieceUrls = useRef(new Map()) // those images, by piece and look
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(initialFile || source ? 'reading' : '')
  const input = useRef(null)
  const reopen = !!figureEls?.length

  // A figure opened again: its file, from where it was uploaded
  useEffect(() => {
    if (!source?.url || initialFile) return undefined
    let live = true
    fetch(source.url)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob() })
      .then(b => { if (live) setFile(new File([b], source.name || 'figure', { type: b.type })) })
      .catch(() => { if (live) { setError('The figure’s file couldn’t be fetched.'); setBusy('') } })
    return () => { live = false }
  }, [source?.url, source?.name, initialFile])

  useEffect(() => {
    if (!file) return undefined
    let live = true
    let preview = null
    setBusy('reading')
    setError('')
    setResult(null)
    readPlotFile(file).then(r => {
      preview = r.preview
      if (!live) return
      const prev = reopen ? readFigure(figureEls, r.plot) : null
      setResult(r)
      setPrevious(prev)
      setClear(!!prev?.meta.clear)
      setForDark(!!prev?.meta.dark)
      setWords({ ...(prev?.meta.labels || {}) })
      const read = prev ? readNotes(figureEls, r.plot, prev.box) : []
      readBack.current = new Map(read.map(n => [n.note.id, n]))
      setNotes(read.map(n => n.note))
      const fresh = defaultChoices(r.plot, oneByOne, { figure: keepable(r) })
      // (a figure not cut yet, dropped on the slide, starts from them)
      setChoices(prev && !prev.whole ? { ...fresh, ...prev.choices } : fresh)
      // A figure matplotlib saved can be kept as it is: start there
      setMode(keepable(r) ? 'figure' : 'graph')
      setGraphOf(r.plot.panels?.find(p => p.main)?.id || null)
      setBusy('')
    }).catch(err => {
      if (!live) return
      setError(err.message || 'The figure couldn’t be read.')
      setBusy('')
    })
    return () => { live = false; if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview) }
    // A new file reads again; the steps' default doesn't
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  const choose = f => { if (f) setFile(f) }
  const setChoice = (id, patch) => setChoices(c => {
    const next = { ...c[id], ...patch }
    if (next.until && next.step && next.until <= next.step) next.until = 0
    return { ...c, [id]: next }
  })
  // The steps by default (one a step or all at once, for a graph or the
  // figure kept as it is), keeping what's left out and what's renamed
  const restep = (one, asFigure, panel = graphOf) => {
    if (result) setChoices(c => {
      const fresh = defaultChoices(asFigure ? result.plot : panelPlot(result.plot, panel) || result.plot, one, { figure: asFigure })
      const out = { ...c }
      for (const id of Object.keys(fresh)) out[id] = { ...fresh[id], include: c[id]?.include ?? true, name: c[id]?.name ?? fresh[id].name, ...(c[id]?.color ? { color: c[id].color } : {}) }
      return out
    })
  }
  const reveal = one => { setOneByOne(one); restep(one, figure) }
  const changeMode = key => { setMode(key); restep(oneByOne, key === 'figure') }
  const pickPanel = id => { setGraphOf(id); restep(oneByOne, false, id) }

  const plot = result?.plot
  const canKeep = keepable(result)
  const figure = mode === 'figure' && canKeep
  const canClear = hasBackdrop(result)
  const transparent = figure && clear && canClear
  const inkDark = figure && forDark
  // The titles and labels whose words are changed
  const relabeled = useMemo(() => {
    if (!figure) return {}
    const out = {}
    for (const l of plot.labels || []) if (Object.hasOwn(words, l.id) && words[l.id] !== l.s) out[l.id] = words[l.id]
    return out
  }, [figure, plot, words])

  // The layers drawn in colors of their own
  const recolor = useMemo(() => (figure ? recolorOf(plot, choices) : new Map()), [figure, plot, choices])
  // The figure as it will look, when that's not as it was saved: its pieces,
  // cut as they will be (smaller, for a PDF), stacked. Each piece is made
  // once for each look it has (a color picked while it's dragged waits)
  const lookKey = transparent || inkDark || recolor.size || Object.keys(relabeled).length
    ? JSON.stringify([transparent, inkDark, [...recolor].map(([part, c]) => [part, c.to]), relabeled]) : ''
  useEffect(() => {
    if (!lookKey) { setLook(null); return undefined }
    let live = true
    const urls = pieceUrls.current
    const keyOf = p => `${pieceKey(p)}|${transparent && p.backdrop ? 'clear' : ''}|${recolor.get(p.part)?.to || ''}|${inkDark && p.inked ? 'dark' : ''}|${JSON.stringify((p.labels || []).map(id => relabeled[id] ?? null))}`
    const wait = setTimeout(async () => {
      try {
        const split = await splitFigure(result, { clear: transparent, recolor, dark: inkDark, labels: relabeled, longSide: 1200, need: p => !urls.has(keyOf(p)) })
        for (const p of split.pieces) if (p.blob && !urls.has(keyOf(p))) urls.set(keyOf(p), URL.createObjectURL(p.blob))
        if (live) setLook(split.pieces.map(p => urls.get(keyOf(p))))
      } catch { /* the figure as saved stands for it */ }
    }, 150)
    return () => { live = false; clearTimeout(wait) }
    // (the key says all of what it's made of)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookKey, result])
  // A new figure, or none: its pieces' images go (and any still being made
  // go with them, not to the next)
  useEffect(() => () => {
    for (const url of pieceUrls.current.values()) URL.revokeObjectURL(url)
    pieceUrls.current = new Map()
    setLook(null)
  }, [result])
  const looks = lookKey ? look : null
  // A figure of several panels kept as it is: each panel comes and goes as
  // a whole, its layers with it
  const panels = figure && plot?.panels ? plot.panels : null
  const panelById = new Map((panels || []).map(p => [p.id, p]))
  const panelOn = id => { const p = panelById.get(id); return !p || (choices[id]?.include !== false && panelOn(p.parent)) }
  const layerOn = l => choices[l.id]?.include !== false && (!panels || panelOn(l.panel))
  // Of several panels, the one a graph is made of, and the plot as it sees it
  const graphPanel = plot?.panels ? plot.panels.find(p => p.id === graphOf) || plot.panels.find(p => p.main) : null
  const gplot = plot && graphPanel ? panelPlot(plot, graphPanel.id) || plot : plot
  const panelWord = p => (/ panel$|^Inset( \d+)?$/.test(p.name) ? p.name.toLowerCase() : p.name)
  const datasetBase = `${baseName(file?.name)}${graphPanel ? ` ${panelWord(graphPanel)}` : ''} data`
  const listed = plot ? (panels ? figureLayers(plot) : gplot.layers) : []
  const included = listed.filter(layerOn)
  const remarks = !plot ? [] : figure ? (plot.panels ? [...(plot.fileWarnings || []), `This figure has ${plot.panels.length} panels; each comes and goes with its layers.`] : plot.warnings) : gplot.warnings

  async function insert() {
    if (!plot || !included.length) return
    if (figure) return insertFigure()
    if (reopen) return
    setBusy('saving')
    setError('')
    try {
      const name = await freeName(datasetBase)
      const first = plotToGraph(gplot, { datasetName: name, choices, dark })
      const ds = await api.uploadDataset(new File([first.csv], `${name}.csv`, { type: 'text/csv' }), name)
      if (presentationId) await api.linkDataset(presentationId, ds.id)
      // The graph plots the dataset under the name the server gave it
      const { graph, size } = ds.name && ds.name !== name ? plotToGraph(gplot, { datasetName: ds.name, choices, dark }) : first
      refreshGraphData()
      onInsert(graph, size)
    } catch (err) {
      setError(err.message || 'The plot couldn’t be added.')
      setBusy('')
    }
  }

  // The figure cut into pieces, uploaded with its file, then stacked. Opened
  // again, the pieces it already has stand in for new ones where it's cut
  // the same way
  async function insertFigure() {
    setBusy('saving')
    setError('')
    try {
      const name = baseName(file?.name).replace(/[^\w.-]+/g, '-').slice(0, 40) || 'figure'
      const upload = async f => {
        const r = await api.uploadFile(f)
        if (!r?.url) throw new Error('The figure couldn’t be uploaded.')
        return r.url
      }
      // A figure legend's entry or frame only while it can show: some layer
      // it names is in the figure
      const shows = partSteps(plot, Object.fromEntries(Object.entries(choices).map(([id, c]) => [id, panelById.has(id) && !panelOn(id) ? { ...c, include: false } : c])))
      const wanted = p => {
        if (/^figure-legend/.test(p.part)) return !shows.get(p.part)?.never
        if (panelById.has(p.part)) return panelOn(p.part)
        const legendIn = /^(.+)-legend$/.exec(p.part)
        if (legendIn && panelById.has(legendIn[1])) return panelOn(legendIn[1])
        const layer = listed.find(l => l.id === p.part)
        return layer ? layerOn(layer) : true
      }
      // (a piece with a background in it, only if that's as it was: clear, or not)
      // (a piece with a background in it only if that's as it was, clear or
      // not; a piece in a color only if it's the color it was; a piece a
      // dark slide changes only if it's for the slide it was; a piece with
      // a title or label in it only if its words are as they were)
      const was = previous?.choices ? recolorOf(plot, previous.choices) : new Map()
      const sameColor = p => (was.get(p.part)?.to || null) === (recolor.get(p.part)?.to || null)
      const had = (p, plan) => (previous && previous.plan === plan && (!p.backdrop || previous.meta.clear === transparent) && (!p.inked || previous.meta.dark === inkDark) && sameColor(p) && (p.labels || []).every(id => (previous.meta.labels?.[id] ?? null) === (relabeled[id] ?? null)) && previous.reuse.get(pieceKey(p))?.src) || null
      const split = await splitFigure(result, { need: (p, plan) => wanted(p) && !had(p, plan), clear: transparent, recolor, dark: inkDark, labels: relabeled })
      const src = previous?.meta.src || await upload(file.type ? file : new File([file], file.name, { type: result.kind === 'pdf' ? 'application/pdf' : 'image/svg+xml' }))
      const pieces = []
      for (const p of split.pieces) {
        if (!wanted(p)) continue
        const url = p.blob
          ? await upload(new File([p.blob], `${name}-${p.part}${p.run ? `-${p.run + 1}` : ''}.${split.ext}`, { type: split.type }))
          : had(p, split.plan)
        pieces.push({ part: p.part, run: p.run, url })
      }
      const meta = { id: previous?.meta.id, src, file: previous?.meta.file || file.name, plan: split.plan, ...(transparent ? { clear: true } : {}), ...(inkDark ? { dark: true } : {}), ...(Object.keys(relabeled).length ? { labels: relabeled } : {}) }
      const elements = figureElements(plot, pieces, previous
        ? { choices, meta, reuse: previous.reuse, box: previous.box, groupId: previous.groupId, z: previous.z }
        : { choices, meta })
      // Its annotations, over it, in its group
      const first = elements[0]
      const noted = notesOnFigure(plot, notes, {
        box: { x: first.x, y: first.y, width: first.width, height: first.height }, groupId: first.groupId,
        meta: { ...meta, id: first.figure.id }, z: Math.max(...elements.map(e => e.zIndex ?? 0)) + 1, dark: inkDark,
        read: readBack.current, restyle: !!previous && !!previous.meta.dark !== inkDark,
      })
      onInsertElements([...elements, ...noted], previous ? { replace: previous.ids } : undefined)
    } catch (err) {
      setError(err.message || 'The figure couldn’t be added.')
      setBusy('')
    }
  }

  // The axes read, outlined on the figure: each panel's, kept as it is
  // (every panel, numbered; for a graph, its panel picked out)
  const boxes = !plot ? [] : plot.panels && (panels || graphPanel)
    ? plot.panels.map((p, i) => ({ id: p.id, box: p.box, label: String(i + 1), faint: !panels && p !== graphPanel }))
    : [{ id: 'axes', box: plot.axes.box }]
  const overlayOf = box => ({
    left: `${(box.x0 / plot.size.width) * 100}%`, width: `${((box.x1 - box.x0) / plot.size.width) * 100}%`,
    top: `${(1 - box.y1 / plot.size.height) * 100}%`, height: `${((box.y1 - box.y0) / plot.size.height) * 100}%`,
  })
  const select = { fontSize: 12, padding: '3px 4px', background: 'var(--bg-input, var(--bg-hover))', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4 }
  const nameInput = { flex: 1, minWidth: 0, fontSize: 13, padding: '3px 6px', background: 'var(--bg-input, var(--bg-hover))', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4 }

  // When something comes and goes
  const steps = (id, c, off, set = patch => setChoice(id, patch)) => (<>
    <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>Appears
      <select value={c.step || 0} disabled={off} onChange={e => set({ step: +e.target.value })} style={select}>
        <option value={0}>With the slide</option>
        {STEPS.map(n => <option key={n} value={n}>At step {n}</option>)}
      </select>
    </label>
    <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>Leaves
      <select value={c.until || 0} disabled={off} onChange={e => set({ until: +e.target.value })} style={select}>
        <option value={0}>Stays</option>
        {STEPS.filter(n => n > (c.step || 0)).map(n => <option key={n} value={n}>At step {n}</option>)}
      </select>
    </label>
  </>)

  // Annotations: the figure they're drawn on in the preview (as it'll be on
  // the slide, at its place there or as it's first put), changed, made, and
  // sketched over the figure
  const noteBox = plot ? previous?.box || { x: 0, y: 0, width: IMPORT_WIDTH, height: Math.round(IMPORT_WIDTH * (plot.size.height / plot.size.width || 0.7)) } : null
  const setNote = (id, patch) => setNotes(ns => ns.map(n => {
    if (n.id !== id) return n
    const next = { ...n, ...patch }
    if (next.until && next.step && next.until <= next.step) next.until = 0
    return next
  }))
  // The step after every other's
  const nextStep = () => 1 + Math.max(0, ...Object.values(choices).map(c => (c.include === false ? 0 : c.step || 0)), ...notes.map(n => n.step || 0))
  // A pointer's place on the figure, in its points up from the bottom left
  const figurePoint = e => {
    const r = sketch.current.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * plot.size.width, (1 - (e.clientY - r.top) / r.height) * plot.size.height]
  }
  const addNote = (kind, from, to) => {
    const place = placeOf(plot, from)
    let at = place.at, text = ''
    if (kind !== 'box') {
      // At the data point nearest, near enough (12 of the preview's pixels)
      const near = snapTo(plot, place.panel, place.axes, from, (12 * plot.size.width) / sketch.current.getBoundingClientRect().width)
      if (near) { at = near.at; if (kind === 'arrow') text = `${fmt(at[0])}, ${fmt(at[1])}` }
      if (kind === 'arrow' && !text) text = 'Note'
    }
    const note = { id: crypto.randomUUID(), kind, panel: place.panel, at, ...(place.frac ? { frac: true } : {}), text, step: nextStep(), until: 0 }
    if (to) note.to = place.frac ? [to[0] / plot.size.width, to[1] / plot.size.height] : toData(place.axes, to)
    setNotes(ns => [...ns, note])
    setPlacing(null)
  }
  const placeDown = e => {
    if (!placing) return
    const at = figurePoint(e)
    if (placing === 'box') { e.currentTarget.setPointerCapture?.(e.pointerId); setBand([at, at]) } else addNote(placing, at)
  }
  const placeMove = e => {
    if (band) setBand([band[0], figurePoint(e)])
    else if (moving.current) {
      const m = moving.current, r = sketch.current.getBoundingClientRect()
      setNote(m.id, { offset: [m.offset[0] + (e.clientX - m.x) / r.width, m.offset[1] + (e.clientY - m.y) / r.height] })
    }
  }
  const placeUp = () => {
    if (band) {
      const [[x0, y0], [x1, y1]] = band
      // (a click, not a drag: no box)
      if (Math.abs(x1 - x0) > 2 && Math.abs(y1 - y0) > 2) addNote('box', band[0], band[1])
      setBand(null)
    }
    moving.current = null
  }
  const describeNote = n => {
    const where = n.panel && plot.panels?.length ? ` in ${choices[n.panel]?.name ?? panelById.get(n.panel)?.name ?? n.panel}` : ''
    if (n.frac) return `On the figure${where}`
    if (n.kind === 'box') { const to = n.to || n.at; return `${fmt(Math.min(n.at[0], to[0]))} to ${fmt(Math.max(n.at[0], to[0]))} by ${fmt(Math.min(n.at[1], to[1]))} to ${fmt(Math.max(n.at[1], to[1]))}${where}` }
    return `At ${fmt(n.at[0])}, ${fmt(n.at[1])}${where}`
  }
  // An annotation drawn over the preview, as on the slide: in the figure's
  // points, down from its top left (the SVG's); its words dragged to move them
  const noteSketch = n => {
    const W = plot.size.width, H = plot.size.height, per = noteBox.width / W
    const fs = noteSize(plot, noteBox)
    const ink = inkDark ? '#ffffff' : '#000000'
    const down = ([px, py]) => [px, H - py]
    const a = down(pageOf(plot, n))
    let corner = a, boxed = null
    if (n.kind === 'box') {
      const b = down(pageOf(plot, n, n.to || n.at))
      boxed = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), width: Math.abs(b[0] - a[0]), height: Math.abs(b[1] - a[1]) }
      corner = [boxed.x, boxed.y]
    }
    const [dx, dy] = n.offset || defaultOffset(plot, n, noteBox)
    const [tw, th] = wordsBox(n.text, fs).map(v => v / per)
    const c = [corner[0] + dx * W, corner[1] + dy * H]
    // (the text box, and its words inside its padding, in the figure's points)
    const box = { x: c[0] - tw / 2, y: c[1] - th / 2, width: tw, height: th }
    const inner = insetWords({ x: box.x * per, y: box.y * per, width: box.width * per, height: box.height * per })
    const ends = n.kind === 'arrow' && n.text ? arrowEnds({ x: inner.x / per, y: inner.y / per, width: inner.width / per, height: inner.height / per }, a) : null
    const lw = Math.max(2, Math.round(fs / 8)) / per
    return (
      <g key={n.id} data-note={n.id}>
        {n.kind === 'ring' && <circle cx={a[0]} cy={a[1]} r={(fs * 0.9) / per} fill="none" stroke={ink} strokeWidth={lw} />}
        {boxed && <rect {...boxed} fill={inkDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'} stroke={ink} strokeWidth={Math.max(1, lw * per - 1) / per} />}
        {ends && (() => {
          const [[sx, sy], [ex, ey]] = ends.map(([x, y]) => [x, y])
          const t = Math.atan2(ey - sy, ex - sx), hs = Math.max(lw * 3, 4 / per)
          const head = [[ex - hs * Math.cos(t - 0.6), ey - hs * Math.sin(t - 0.6)], [ex, ey], [ex - hs * Math.cos(t + 0.6), ey - hs * Math.sin(t + 0.6)]]
          return <><line x1={sx} y1={sy} x2={ex} y2={ey} stroke={ink} strokeWidth={lw} /><polyline points={head.map(p => p.join(',')).join(' ')} fill="none" stroke={ink} strokeWidth={lw} strokeLinecap="round" strokeLinejoin="round" /></>
        })()}
        {n.text && (
          <text x={c[0]} y={c[1]} textAnchor="middle" dominantBaseline="central" fontSize={fs / per} fill={ink} fontFamily="Arial, sans-serif"
            style={{ pointerEvents: placing ? 'none' : 'all', cursor: 'move', userSelect: 'none' }}
            onPointerDown={e => { e.stopPropagation(); sketch.current.setPointerCapture?.(e.pointerId); moving.current = { id: n.id, x: e.clientX, y: e.clientY, offset: [dx, dy] } }}>{n.text}</text>
        )}
      </g>
    )
  }

  const layerRow = (layer, { hidden = false } = {}) => {
    const c = choices[layer.id] || {}
    const on = c.include !== false
    const recolored = /^#[0-9a-f]{6}$/i.test(c.color || '') && c.color.toLowerCase() !== layer.color.toLowerCase()
    const color = recolored ? c.color.toLowerCase() : layer.color
    return (
      <div role="listitem" key={layer.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, display: 'grid', gap: 6, opacity: on && !hidden ? 1 : 0.55 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={on} disabled={hidden} onChange={e => setChoice(layer.id, { include: e.target.checked })} aria-label={`Import ${c.name || layer.name}`} />
          <label title="Change its color" style={{ position: 'relative', width: 16, height: 16, flex: 'none', cursor: on && !hidden ? 'pointer' : 'default' }}>
            <input type="color" value={color} disabled={!on || hidden} onChange={e => setChoice(layer.id, { color: e.target.value })} aria-label={`Color of ${c.name || layer.name}`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, padding: 0, border: 0, cursor: 'inherit' }} />
            <span aria-hidden="true" style={{ position: 'absolute', inset: 1, borderRadius: layer.kind === 'points' ? '50%' : 3, background: color, border: '1px solid rgba(0,0,0,0.2)', pointerEvents: 'none' }} />
          </label>
          {recolored && (
            <button type="button" onClick={() => setChoice(layer.id, { color: undefined })} title={`Back to the figure’s color (${layer.color})`} aria-label={`Put back ${c.name || layer.name}’s own color`}
              style={{ flex: 'none', fontSize: 12, lineHeight: 1, padding: '2px 4px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>↺</button>
          )}
          <input value={c.name ?? layer.name} onChange={e => setChoice(layer.id, { name: e.target.value })} aria-label="Layer name" maxLength={60} style={nameInput} />
          {!figure && (
            <span title={layer.fidelity === 'exact' ? 'Where the file puts them' : 'Through the points the file draws it with; matplotlib leaves out points that don’t change the picture'}
              style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: layer.fidelity === 'exact' ? 'rgba(16,185,129,0.18)' : 'rgba(234,179,8,0.18)', color: layer.fidelity === 'exact' ? '#34d399' : '#facc15', whiteSpace: 'nowrap' }}>
              {layer.fidelity === 'exact' ? 'Exact' : 'As drawn'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
          <span style={{ flex: '1 1 160px' }}>{describe(layer)}</span>
          {steps(layer.id, c, !on || hidden)}
        </div>
      </div>
    )
  }

  // A panel: its own steps, its layers under it
  const panelRow = p => {
    const c = choices[p.id] || {}
    const on = c.include !== false
    const hidden = !panelOn(p.parent)
    const name = c.name ?? p.name
    return (
      <div key={p.id} role="group" aria-label={name} style={{ display: 'grid', gap: 6, marginLeft: p.parent ? 16 : 0 }}>
        <div data-panel={p.id} style={{ borderRadius: 8, padding: 8, display: 'grid', gap: 6, background: 'var(--bg-hover)', opacity: on && !hidden ? 1 : 0.55 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={on} disabled={hidden} onChange={e => setChoice(p.id, { include: e.target.checked })} aria-label={`Import ${name}`} />
            <span aria-hidden="true" style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', width: 14, textAlign: 'center' }}>{panels.indexOf(p) + 1}</span>
            <input value={name} onChange={e => setChoice(p.id, { name: e.target.value })} aria-label="Panel name" maxLength={60} style={{ ...nameInput, fontWeight: 600 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ flex: '1 1 160px' }}>{p.layers.length ? `The panel, and ${p.layers.length} layer${p.layers.length === 1 ? '' : 's'}` : 'The panel'}</span>
            {steps(p.id, c, !on || hidden)}
          </div>
        </div>
        {p.layers.length > 0 && <div role="list" aria-label={`${name}: layers`} style={{ display: 'grid', gap: 6, marginLeft: 16 }}>{p.layers.map(l => layerRow(l, { hidden: !on || hidden }))}</div>}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onKeyDown={e => { if (e.key === 'Escape' && busy !== 'saving') onClose() }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); if (!reopen) choose(e.dataTransfer.files?.[0]) }}>
      <div role="dialog" aria-label={reopen ? 'Edit the figure’s layers' : 'Import a plot'} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: '88vw', maxWidth: 1080, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{reopen ? 'Edit the figure’s layers' : 'Import a plot'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {reopen
              ? previous?.whole ? 'Choose the steps its layers come and go at: the figure is then cut into a piece for each, stacked where it is.' : 'Rename the layers, change their colors, choose the steps they come and go at, or put back one left out.'
              : 'A figure saved from matplotlib as a PDF or an SVG can be kept just as it’s drawn, or made into a graph of its data; either way its layers can come and go a step at a time.'}
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: 16, flex: 1, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {!file && !busy && (
            <button type="button" onClick={() => input.current?.click()} style={{ flex: 1, minHeight: 180, border: '2px dashed var(--border)', borderRadius: 10, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>
              Choose a PDF or SVG figure, or drop it here
            </button>
          )}
          {busy === 'reading' && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Reading {file?.name || 'the figure'}…</p>}
          {error && !plot && (
            <div role="alert" style={{ fontSize: 13, display: 'grid', gap: 6 }}>
              <span>{error}</span>
              {!reopen && <span style={{ color: 'var(--text-muted)' }}>Plot import reads figures saved from matplotlib as PDF or SVG; a PNG or JPEG has no data to read.</span>}
            </div>
          )}

          {plot && (<>
            <div style={{ flex: '1 1 380px', minWidth: 280 }}>
              <div data-transparent={transparent || undefined} data-dark={inkDark || undefined} style={{ position: 'relative', background: transparent ? (inkDark ? DARK_CHECKERS : CHECKERS) : inkDark ? '#000' : '#fff', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                {result.preview
                  ? <img src={result.preview} alt={`${file?.name || 'The figure'}, as saved`} style={{ display: 'block', width: '100%', height: 'auto', visibility: looks ? 'hidden' : 'visible' }} />
                  : <div style={{ aspectRatio: `${plot.size.width} / ${plot.size.height}` }} />}
                {looks && (
                  <div data-look role="img" aria-label={`${file?.name || 'The figure'}, as it will look${transparent ? ', with a transparent background' : ''}${inkDark ? ', for a dark slide' : ''}${recolor.size ? ', in the colors chosen' : ''}${Object.keys(relabeled).length ? ', with its words changed' : ''}`} style={{ position: 'absolute', inset: 0 }}>
                    {looks.map((url, k) => <img key={k} src={url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />)}
                  </div>
                )}
                {boxes.map(b => (
                  <div key={b.id} title="The axes that were read" style={{ position: 'absolute', ...overlayOf(b.box), border: `2px dashed ${b.faint ? 'rgba(100,116,139,0.6)' : '#6366f1'}`, pointerEvents: 'none' }}>
                    {b.label && <span style={{ position: 'absolute', left: 2, top: 2, fontSize: 11, fontWeight: 700, color: '#fff', background: b.faint ? 'rgba(100,116,139,0.8)' : '#6366f1', borderRadius: 3, padding: '0 4px' }}>{b.label}</span>}
                  </div>
                ))}
                {figure && (
                  <svg ref={sketch} data-notes viewBox={`0 0 ${plot.size.width} ${plot.size.height}`} preserveAspectRatio="none"
                    aria-label={placing ? (placing === 'box' ? 'Drag over the figure to box a stretch of it' : 'Click a point on the figure to annotate it') : undefined}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', cursor: placing ? 'crosshair' : 'default', pointerEvents: placing || moving.current ? 'all' : 'none', touchAction: 'none' }}
                    onPointerDown={placeDown} onPointerMove={placeMove} onPointerUp={placeUp} onPointerCancel={placeUp}>
                    {notes.map(noteSketch)}
                    {band && <rect x={Math.min(band[0][0], band[1][0])} y={plot.size.height - Math.max(band[0][1], band[1][1])} width={Math.abs(band[1][0] - band[0][0])} height={Math.abs(band[1][1] - band[0][1])} fill="rgba(99,102,241,0.15)" stroke="#6366f1" strokeWidth={1} strokeDasharray="3 2" />}
                  </svg>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, display: 'grid', gap: 2 }}>
                {!panels && ['x', 'y'].map(k => {
                  const a = gplot.axes[k]
                  return <span key={k}><b>{k}</b>: {a.scale}, {fmt(a.range[0])} to {fmt(a.range[1])}{a.label ? ` · ${a.label}` : ''}{a.categories ? ` · ${a.categories.length} named ticks` : ''}</span>
                })}
                {plot.producer && <span style={{ color: 'var(--text-muted)' }}>Made by {plot.producer}</span>}
              </div>
            </div>

            <div style={{ flex: '1 1 420px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!reopen && <div role="radiogroup" aria-label="What to make of it" style={{ display: 'grid', gap: 6 }}>
                {[
                  ['figure', 'Keep the figure as it is', canKeep
                    ? 'matplotlib’s own drawing, with each layer coming and going a step at a time.'
                    : 'Only for a figure whose every layer could be found in the file.'],
                  ['graph', 'Make a graph of its data', 'A Parallax graph of the data, in the deck’s look, which can be pointed at and changed.'],
                ].map(([key, label, note]) => {
                  const off = key === 'figure' && !canKeep
                  const on = (key === 'figure') === figure
                  return (
                    <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px', borderRadius: 8, border: `1px solid ${on ? 'var(--accent, #6366f1)' : 'var(--border)'}`, opacity: off ? 0.55 : 1, cursor: off ? 'default' : 'pointer' }}>
                      <input type="radio" name="plot-mode" checked={on} disabled={off} onChange={() => changeMode(key)} style={{ marginTop: 3 }} />
                      <span style={{ display: 'grid', gap: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{note}</span>
                      </span>
                    </label>
                  )
                })}
              </div>}
              {figure && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginRight: 'auto', opacity: canClear ? 1 : 0.55 }}
                    title={canClear ? 'Leave out the white behind the figure, its axes and its legend, as savefig(transparent=True) does (the legend keeps its outline)' : 'This figure has no background to leave out'}>
                    <input type="checkbox" checked={transparent} disabled={!canClear} onChange={e => setClear(e.target.checked)} />
                    Transparent background
                  </label>
                  <span role="group" aria-label="Axes and text" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Axes and text</span>
                    <button type="button" className={`btn ${!forDark ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12, padding: '3px 10px' }} aria-pressed={!forDark} title="Black text and lines, for a light slide" onClick={() => setForDark(false)}>Light</button>
                    <button type="button" className={`btn ${forDark ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12, padding: '3px 10px' }} aria-pressed={forDark} title="White text and lines, for a dark slide (the layers keep their colors)" onClick={() => setForDark(true)}>Dark</button>
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
                {!figure && graphPanel && (
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginRight: 'auto' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Make a graph of</span>
                    <select aria-label="Panel to graph" value={graphPanel.id} onChange={e => pickPanel(e.target.value)} style={select}>
                      {plot.panels.map((p, i) => {
                        const why = !p.axes ? ' (its numbers can’t be read)' : !p.layers.length ? ' (nothing to graph)' : ''
                        return <option key={p.id} value={p.id} disabled={!!why}>{i + 1}. {p.name}{why}</option>
                      })}
                    </select>
                  </label>
                )}
                <span style={{ color: 'var(--text-muted)', marginLeft: figure ? 'auto' : undefined }}>Show the layers</span>
                <button type="button" className={`btn ${oneByOne ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12, padding: '3px 10px' }} aria-pressed={oneByOne} onClick={() => reveal(true)}>One a step</button>
                <button type="button" className={`btn ${!oneByOne ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12, padding: '3px 10px' }} aria-pressed={!oneByOne} onClick={() => reveal(false)}>All at once</button>
              </div>
              {panels
                ? <div aria-label="Panels" style={{ display: 'grid', gap: 10 }}>{panels.map(panelRow)}</div>
                : <div role="list" aria-label="Layers" style={{ display: 'grid', gap: 8 }}>{listed.map(l => layerRow(l))}</div>}
              {figure && plot.labels?.length > 0 && (
                <div role="group" aria-label="Titles and labels" style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr) auto', columnGap: 8, rowGap: 6, alignItems: 'center', fontSize: 12 }}>
                  <div style={{ gridColumn: '1 / -1', fontWeight: 600, color: 'var(--text-secondary)' }}>Titles and labels</div>
                  {plot.labels.map(l => {
                    const value = Object.hasOwn(words, l.id) ? words[l.id] : l.s
                    const changed = value !== l.s
                    const what = LABEL_KINDS[l.kind] || 'Text'
                    const panel = l.panel ? panelById.get(l.panel) : null
                    const caption = panel ? `${choices[panel.id]?.name ?? panel.name} · ${what.toLowerCase()}` : what
                    const font = fontFor(l.font)
                    return (
                      <Fragment key={l.id}>
                        <label htmlFor={`plot-label-${l.id}`} style={{ color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={caption}>{caption}</label>
                        <input id={`plot-label-${l.id}`} value={value} onChange={e => setWords(w => ({ ...w, [l.id]: e.target.value }))} aria-label={caption} maxLength={200} style={nameInput} />
                        {changed ? (
                          <button type="button" onClick={() => setWords(w => { const out = { ...w }; delete out[l.id]; return out })} title={`Back to “${l.s}”`} aria-label={`Put back the ${caption.toLowerCase()}’s own words`}
                            style={{ fontSize: 12, lineHeight: 1, padding: '2px 4px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>↺</button>
                        ) : <span />}
                        {changed && (l.math || font !== l.font) && (
                          <span style={{ gridColumn: '2 / -1', fontSize: 11, color: 'var(--text-muted)', marginTop: -4 }}>
                            {[l.math && 'Math ($…$) is drawn as plain text.', font !== l.font && `Drawn in DejaVu Sans${l.font ? `, not ${l.font}` : ''}.`].filter(Boolean).join(' ')}
                          </span>
                        )}
                      </Fragment>
                    )
                  })}
                </div>
              )}
              {figure && (
                <div role="group" aria-label="Annotations" style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginRight: 'auto' }}>Annotations</span>
                    {Object.entries(NOTE_KINDS).map(([kind, label]) => (
                      <button key={kind} type="button" className={`btn ${placing === kind ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12, padding: '3px 10px' }} aria-pressed={placing === kind}
                        title={kind === 'box' ? 'Drag over the figure to box a stretch of it' : `Click a point on the figure: ${kind === 'arrow' ? 'words with an arrow to it' : 'a ring round it'}`}
                        onClick={() => setPlacing(p => (p === kind ? null : kind))}>+ {label}</button>
                    ))}
                  </div>
                  {placing && (
                    <div role="status" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {placing === 'box' ? 'Drag over the figure to box a stretch of it.' : 'Click a point on the figure; it snaps to the nearest data point.'}
                    </div>
                  )}
                  {notes.map(n => (
                    <div key={n.id} data-note={n.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', minWidth: 36 }}>{NOTE_KINDS[n.kind]}</span>
                        <input value={n.text} placeholder={n.kind === 'arrow' ? 'Its words' : 'Its words (or none)'} onChange={e => setNote(n.id, { text: e.target.value })} aria-label={`${NOTE_KINDS[n.kind]}: words`} maxLength={120} style={nameInput} />
                        <button type="button" onClick={() => setNotes(ns => ns.filter(o => o.id !== n.id))} aria-label="Remove the annotation" title="Remove it"
                          style={{ flex: 'none', fontSize: 12, lineHeight: 1, padding: '3px 6px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>✕</button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span style={{ flex: '1 1 140px' }}>{describeNote(n)}</span>
                        {steps(n.id, n, false, patch => setNote(n.id, patch))}
                      </div>
                    </div>
                  ))}
                  {notes.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Drag an annotation’s words over the figure to move them. On the slide they’re text, arrows and shapes in the figure’s group.</div>}
                </div>
              )}
              {remarks.length > 0 && (
                <ul aria-label="Notes" style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-muted)', display: 'grid', gap: 3 }}>
                  {remarks.map(w => <li key={w}>{w}</li>)}
                </ul>
              )}
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                {reopen
                  ? 'The figure stays where it is on the slide. A layer left out is taken out of it, and can be put back here.'
                  : figure
                  ? `The figure is cut into ${result.kind === 'pdf' ? 'PNG' : 'SVG'} images, stacked in a group, and the file is saved with them so the layers can be changed later (right-click the figure). ${panels ? 'Each panel comes and goes as a whole, and a layer shows only while its panel does. ' : ''}Each layer’s legend entry comes and goes with it, and the legend’s frame shows while any entry does; a layer left out is taken out of the figure, entry and all.`
                  : `The data goes into a dataset, “${datasetBase}”, linked to this presentation; the figure itself isn’t uploaded.`}
              </p>
              {error && <div role="alert" style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
            </div>
          </>)}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
          <input ref={input} type="file" accept=".pdf,.svg,application/pdf,image/svg+xml" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; choose(f) }} />
          {reopen ? <span style={{ marginRight: 'auto' }} /> : (
            <button className="btn btn-secondary" style={{ fontSize: 12, marginRight: 'auto' }} disabled={busy === 'saving'} onClick={() => input.current?.click()}>
              {file ? 'Choose another figure…' : 'Choose a figure…'}
            </button>
          )}
          <button className="btn btn-secondary" style={{ fontSize: 12 }} disabled={busy === 'saving'} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={!plot || !included.length || !!busy || (reopen && !figure)} onClick={insert}>
            {busy === 'saving'
              ? (reopen ? 'Updating the figure…' : figure ? 'Adding the figure…' : 'Adding the graph…')
              : reopen ? 'Update figure'
                : `Insert ${figure ? 'figure' : 'graph'}${included.length && plot ? ` with ${included.length} layer${included.length === 1 ? '' : 's'}` : ''}${panels ? ((n => ` in ${n} panel${n === 1 ? '' : 's'}`)(panels.filter(p => panelOn(p.id)).length)) : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

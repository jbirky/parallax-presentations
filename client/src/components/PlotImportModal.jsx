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
//     transparent, as savefig(transparent=True) leaves them.
// A figure kept as it is opens here again (figure: its elements; source:
// its file, { url, name }), to change its layers: onInsertElements(elements,
// { replace: the ids they stand in for }).

import { useEffect, useRef, useState } from 'react'
import { api } from '../utils/api'
import { refreshGraphData } from '../utils/graphData'
import { readPlotFile, plotToGraph, defaultChoices, baseName, keepable, splitFigure, figureElements, readFigure, pieceKey, figureLayers, panelPlot, partSteps, hasBackdrop, clearPreview } from '../utils/plotImport'

// Behind a figure with a transparent background
const CHECKERS = 'repeating-conic-gradient(#d4d4d8 0% 25%, #ffffff 0% 50%) 50% / 16px 16px'
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
  const [clearView, setClearView] = useState(null) // the figure so, to look at
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
      for (const id of Object.keys(fresh)) out[id] = { ...fresh[id], include: c[id]?.include ?? true, name: c[id]?.name ?? fresh[id].name }
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

  // The figure with its backgrounds left out, while that's chosen
  useEffect(() => {
    if (!transparent) return undefined
    let live = true, url = null
    clearPreview(result).then(u => { url = u; if (live) setClearView(u); else URL.revokeObjectURL(u) }).catch(() => {})
    return () => { live = false; setClearView(null); if (url) URL.revokeObjectURL(url) }
  }, [transparent, result])
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
  const notes = !plot ? [] : figure ? (plot.panels ? [...(plot.fileWarnings || []), `This figure has ${plot.panels.length} panels; each comes and goes with its layers.`] : plot.warnings) : gplot.warnings

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
      const had = (p, plan) => (previous && previous.plan === plan && (!p.backdrop || previous.meta.clear === transparent) && previous.reuse.get(pieceKey(p))?.src) || null
      const split = await splitFigure(result, { need: (p, plan) => wanted(p) && !had(p, plan), clear: transparent })
      const src = previous?.meta.src || await upload(file.type ? file : new File([file], file.name, { type: result.kind === 'pdf' ? 'application/pdf' : 'image/svg+xml' }))
      const pieces = []
      for (const p of split.pieces) {
        if (!wanted(p)) continue
        const url = p.blob
          ? await upload(new File([p.blob], `${name}-${p.part}${p.run ? `-${p.run + 1}` : ''}.${split.ext}`, { type: split.type }))
          : had(p, split.plan)
        pieces.push({ part: p.part, run: p.run, url })
      }
      const meta = { id: previous?.meta.id, src, file: previous?.meta.file || file.name, plan: split.plan, ...(transparent ? { clear: true } : {}) }
      const elements = figureElements(plot, pieces, previous
        ? { choices, meta, reuse: previous.reuse, box: previous.box, groupId: previous.groupId, z: previous.z }
        : { choices, meta })
      onInsertElements(elements, previous ? { replace: previous.ids } : undefined)
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
  const steps = (id, c, off) => (<>
    <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>Appears
      <select value={c.step || 0} disabled={off} onChange={e => setChoice(id, { step: +e.target.value })} style={select}>
        <option value={0}>With the slide</option>
        {STEPS.map(n => <option key={n} value={n}>At step {n}</option>)}
      </select>
    </label>
    <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>Leaves
      <select value={c.until || 0} disabled={off} onChange={e => setChoice(id, { until: +e.target.value })} style={select}>
        <option value={0}>Stays</option>
        {STEPS.filter(n => n > (c.step || 0)).map(n => <option key={n} value={n}>At step {n}</option>)}
      </select>
    </label>
  </>)

  const layerRow = (layer, { hidden = false } = {}) => {
    const c = choices[layer.id] || {}
    const on = c.include !== false
    return (
      <div role="listitem" key={layer.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, display: 'grid', gap: 6, opacity: on && !hidden ? 1 : 0.55 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={on} disabled={hidden} onChange={e => setChoice(layer.id, { include: e.target.checked })} aria-label={`Import ${c.name || layer.name}`} />
          <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: layer.kind === 'points' ? '50%' : 3, background: layer.color, flex: 'none', border: '1px solid rgba(0,0,0,0.2)' }} />
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
              ? previous?.whole ? 'Choose the steps its layers come and go at: the figure is then cut into a piece for each, stacked where it is.' : 'Rename the layers, choose the steps they come and go at, or put back one left out.'
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
              <div data-transparent={transparent || undefined} style={{ position: 'relative', background: transparent ? CHECKERS : '#fff', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                {result.preview
                  ? <img src={(transparent && clearView) || result.preview} alt={`${file?.name || 'The figure'}, ${transparent && clearView ? 'with a transparent background' : 'as saved'}`} style={{ display: 'block', width: '100%', height: 'auto' }} />
                  : <div style={{ aspectRatio: `${plot.size.width} / ${plot.size.height}` }} />}
                {boxes.map(b => (
                  <div key={b.id} title="The axes that were read" style={{ position: 'absolute', ...overlayOf(b.box), border: `2px dashed ${b.faint ? 'rgba(100,116,139,0.6)' : '#6366f1'}`, pointerEvents: 'none' }}>
                    {b.label && <span style={{ position: 'absolute', left: 2, top: 2, fontSize: 11, fontWeight: 700, color: '#fff', background: b.faint ? 'rgba(100,116,139,0.8)' : '#6366f1', borderRadius: 3, padding: '0 4px' }}>{b.label}</span>}
                  </div>
                ))}
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
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
                {figure && (
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginRight: 'auto', opacity: canClear ? 1 : 0.55 }}
                    title={canClear ? 'Leave out the white behind the figure and its axes, as savefig(transparent=True) does' : 'This figure has no background to leave out'}>
                    <input type="checkbox" checked={transparent} disabled={!canClear} onChange={e => setClear(e.target.checked)} />
                    Transparent background
                  </label>
                )}
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
                <span style={{ color: 'var(--text-muted)' }}>Show the layers</span>
                <button type="button" className={`btn ${oneByOne ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12, padding: '3px 10px' }} aria-pressed={oneByOne} onClick={() => reveal(true)}>One a step</button>
                <button type="button" className={`btn ${!oneByOne ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12, padding: '3px 10px' }} aria-pressed={!oneByOne} onClick={() => reveal(false)}>All at once</button>
              </div>
              {panels
                ? <div aria-label="Panels" style={{ display: 'grid', gap: 10 }}>{panels.map(panelRow)}</div>
                : <div role="list" aria-label="Layers" style={{ display: 'grid', gap: 8 }}>{listed.map(l => layerRow(l))}</div>}
              {notes.length > 0 && (
                <ul aria-label="Notes" style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-muted)', display: 'grid', gap: 3 }}>
                  {notes.map(w => <li key={w}>{w}</li>)}
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

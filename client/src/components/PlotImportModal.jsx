// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Insert › Science › Plot from a figure, File › Import › Plot from a PDF or
// SVG figure: a matplotlib figure, read in the browser (utils/plotImport),
// shown beside what was found in it, its axes and its layers. Each layer can
// be renamed, left out, and given the step it appears at and the step it
// leaves at. Then, either:
//   a graph of its data: a dataset of the layers' data, linked to the deck,
//     and a Graph element's fields for the editor (onInsert);
//   the figure as it is (an SVG): its base and each layer as SVG images,
//     stacked in a group, each layer hidden until its step and from the step
//     it leaves at (onInsertElements).

import { useEffect, useRef, useState } from 'react'
import { api } from '../utils/api'
import { refreshGraphData } from '../utils/graphData'
import { readPlotFile, plotToGraph, defaultChoices, baseName, splitSvg, figureElements } from '../utils/plotImport'

const STEPS = Array.from({ length: 12 }, (_, i) => i + 1)
// An SVG matplotlib saved, every layer of it drawn by groups the file names
const keepable = r => !!r && r.kind === 'svg' && !!r.text && r.plot.layers.length > 0 && r.plot.layers.every(l => l.groups?.length)
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

export default function PlotImportModal({ file: initialFile, presentationId, dark, onInsert, onInsertElements, onClose }) {
  const [file, setFile] = useState(initialFile || null)
  const [result, setResult] = useState(null) // { kind, plot, preview }
  const [choices, setChoices] = useState({})
  const [oneByOne, setOneByOne] = useState(true)
  const [mode, setMode] = useState('graph') // 'graph', or 'figure': kept as it is
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(initialFile ? 'reading' : '')
  const input = useRef(null)

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
      setResult(r)
      setChoices(defaultChoices(r.plot, oneByOne))
      // An SVG matplotlib saved can be kept as it is: start there
      setMode(keepable(r) ? 'figure' : 'graph')
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
  const reveal = one => {
    setOneByOne(one)
    if (result) setChoices(c => {
      const fresh = defaultChoices(result.plot, one)
      const out = {}
      for (const id of Object.keys(fresh)) out[id] = { ...fresh[id], include: c[id]?.include ?? true, name: c[id]?.name ?? fresh[id].name }
      return out
    })
  }

  const plot = result?.plot
  const included = plot ? plot.layers.filter(l => choices[l.id]?.include !== false) : []
  const canKeep = keepable(result)
  const figure = mode === 'figure' && canKeep

  async function insert() {
    if (!plot || !included.length) return
    if (figure) return insertFigure()
    setBusy('saving')
    setError('')
    try {
      const name = await freeName(`${baseName(file?.name)} data`)
      const first = plotToGraph(plot, { datasetName: name, choices, dark })
      const ds = await api.uploadDataset(new File([first.csv], `${name}.csv`, { type: 'text/csv' }), name)
      if (presentationId) await api.linkDataset(presentationId, ds.id)
      // The graph plots the dataset under the name the server gave it
      const { graph, size } = ds.name && ds.name !== name ? plotToGraph(plot, { datasetName: ds.name, choices, dark }) : first
      refreshGraphData()
      onInsert(graph, size)
    } catch (err) {
      setError(err.message || 'The plot couldn’t be added.')
      setBusy('')
    }
  }

  // The figure's base and its layers as SVG images, uploaded, then stacked
  async function insertFigure() {
    setBusy('saving')
    setError('')
    try {
      const split = splitSvg(result.text, plot.layers)
      const name = baseName(file?.name).replace(/[^\w.-]+/g, '-').slice(0, 40) || 'figure'
      const upload = async (svg, part) => {
        const r = await api.uploadFile(new File([svg], `${name}-${part}.svg`, { type: 'image/svg+xml' }))
        if (!r?.url) throw new Error('The figure couldn’t be uploaded.')
        return r.url
      }
      const urls = { base: await upload(split.base, 'base') }
      for (const layer of split.layers) {
        if (choices[layer.id]?.include === false) continue
        urls[layer.id] = await upload(layer.svg, layer.id)
      }
      onInsertElements(figureElements(plot, urls, { choices }))
    } catch (err) {
      setError(err.message || 'The figure couldn’t be added.')
      setBusy('')
    }
  }

  const box = plot?.axes.box
  const overlay = plot && box && {
    left: `${(box.x0 / plot.size.width) * 100}%`, width: `${((box.x1 - box.x0) / plot.size.width) * 100}%`,
    top: `${(1 - box.y1 / plot.size.height) * 100}%`, height: `${((box.y1 - box.y0) / plot.size.height) * 100}%`,
  }
  const select = { fontSize: 12, padding: '3px 4px', background: 'var(--bg-input, var(--bg-hover))', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onKeyDown={e => { if (e.key === 'Escape' && busy !== 'saving') onClose() }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); choose(e.dataTransfer.files?.[0]) }}>
      <div role="dialog" aria-label="Import a plot" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: '88vw', maxWidth: 1080, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Import a plot</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            A figure saved from matplotlib as a PDF or an SVG becomes a graph of its data, whose layers can come and go a step at a time.
            Markers, bars and error bars come in exactly; a line comes through the points the file draws it with.
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
              <span style={{ color: 'var(--text-muted)' }}>Plot import reads figures saved from matplotlib as PDF or SVG; a PNG or JPEG has no data to read.</span>
            </div>
          )}

          {plot && (<>
            <div style={{ flex: '1 1 380px', minWidth: 280 }}>
              <div style={{ position: 'relative', background: '#fff', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                {result.preview
                  ? <img src={result.preview} alt={`${file?.name || 'The figure'}, as saved`} style={{ display: 'block', width: '100%', height: 'auto' }} />
                  : <div style={{ aspectRatio: `${plot.size.width} / ${plot.size.height}` }} />}
                {overlay && <div title="The axes that were read" style={{ position: 'absolute', ...overlay, border: '2px dashed #6366f1', pointerEvents: 'none' }} />}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, display: 'grid', gap: 2 }}>
                {['x', 'y'].map(k => {
                  const a = plot.axes[k]
                  return <span key={k}><b>{k}</b>: {a.scale}, {fmt(a.range[0])} to {fmt(a.range[1])}{a.label ? ` · ${a.label}` : ''}{a.categories ? ` · ${a.categories.length} named ticks` : ''}</span>
                })}
                {plot.producer && <span style={{ color: 'var(--text-muted)' }}>Made by {plot.producer}</span>}
              </div>
            </div>

            <div style={{ flex: '1 1 420px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div role="radiogroup" aria-label="What to make of it" style={{ display: 'grid', gap: 6 }}>
                {[
                  ['figure', 'Keep the figure as it is', canKeep
                    ? 'matplotlib’s own drawing, with each layer coming and going a step at a time.'
                    : 'Only for a figure saved as SVG: plt.savefig("figure.svg").'],
                  ['graph', 'Make a graph of its data', 'A Parallax graph of the data, in the deck’s look, which can be pointed at and changed.'],
                ].map(([key, label, note]) => {
                  const off = key === 'figure' && !canKeep
                  const on = (key === 'figure') === figure
                  return (
                    <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px', borderRadius: 8, border: `1px solid ${on ? 'var(--accent, #6366f1)' : 'var(--border)'}`, opacity: off ? 0.55 : 1, cursor: off ? 'default' : 'pointer' }}>
                      <input type="radio" name="plot-mode" checked={on} disabled={off} onChange={() => setMode(key)} style={{ marginTop: 3 }} />
                      <span style={{ display: 'grid', gap: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{note}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Show the layers</span>
                <button type="button" className={`btn ${oneByOne ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12, padding: '3px 10px' }} aria-pressed={oneByOne} onClick={() => reveal(true)}>One a step</button>
                <button type="button" className={`btn ${!oneByOne ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12, padding: '3px 10px' }} aria-pressed={!oneByOne} onClick={() => reveal(false)}>All at once</button>
              </div>
              <div role="list" aria-label="Layers" style={{ display: 'grid', gap: 8 }}>
                {plot.layers.map(layer => {
                  const c = choices[layer.id] || {}
                  const on = c.include !== false
                  return (
                    <div role="listitem" key={layer.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, display: 'grid', gap: 6, opacity: on ? 1 : 0.55 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={on} onChange={e => setChoice(layer.id, { include: e.target.checked })} aria-label={`Import ${c.name || layer.name}`} />
                        <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: layer.kind === 'points' ? '50%' : 3, background: layer.color, flex: 'none', border: '1px solid rgba(0,0,0,0.2)' }} />
                        <input value={c.name ?? layer.name} onChange={e => setChoice(layer.id, { name: e.target.value })} aria-label="Layer name" maxLength={60}
                          style={{ flex: 1, minWidth: 0, fontSize: 13, padding: '3px 6px', background: 'var(--bg-input, var(--bg-hover))', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4 }} />
                        {!figure && (
                          <span title={layer.fidelity === 'exact' ? 'Where the file puts them' : 'Through the points the file draws it with; matplotlib leaves out points that don’t change the picture'}
                            style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: layer.fidelity === 'exact' ? 'rgba(16,185,129,0.18)' : 'rgba(234,179,8,0.18)', color: layer.fidelity === 'exact' ? '#34d399' : '#facc15', whiteSpace: 'nowrap' }}>
                            {layer.fidelity === 'exact' ? 'Exact' : 'As drawn'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span style={{ flex: '1 1 160px' }}>{describe(layer)}</span>
                        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>Appears
                          <select value={c.step || 0} disabled={!on} onChange={e => setChoice(layer.id, { step: +e.target.value })} style={select}>
                            <option value={0}>With the slide</option>
                            {STEPS.map(n => <option key={n} value={n}>At step {n}</option>)}
                          </select>
                        </label>
                        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>Leaves
                          <select value={c.until || 0} disabled={!on} onChange={e => setChoice(layer.id, { until: +e.target.value })} style={select}>
                            <option value={0}>Stays</option>
                            {STEPS.filter(n => n > (c.step || 0)).map(n => <option key={n} value={n}>At step {n}</option>)}
                          </select>
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
              {plot.warnings.length > 0 && (
                <ul aria-label="Notes" style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-muted)', display: 'grid', gap: 3 }}>
                  {plot.warnings.map(w => <li key={w}>{w}</li>)}
                </ul>
              )}
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                {figure
                  ? 'The figure and each layer are saved as SVG images in this presentation, stacked in a group; the legend stays as drawn. A layer left out is taken out of the figure.'
                  : `The data goes into a dataset, “${baseName(file?.name)} data”, linked to this presentation; the figure itself isn’t uploaded.`}
              </p>
              {error && <div role="alert" style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
            </div>
          </>)}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
          <input ref={input} type="file" accept=".pdf,.svg,application/pdf,image/svg+xml" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; choose(f) }} />
          <button className="btn btn-secondary" style={{ fontSize: 12, marginRight: 'auto' }} disabled={busy === 'saving'} onClick={() => input.current?.click()}>
            {file ? 'Choose another figure…' : 'Choose a figure…'}
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} disabled={busy === 'saving'} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={!plot || !included.length || !!busy} onClick={insert}>
            {busy === 'saving' ? (figure ? 'Adding the figure…' : 'Adding the graph…') : `Insert ${figure ? 'figure' : 'graph'}${included.length && plot ? ` with ${included.length} layer${included.length === 1 ? '' : 's'}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The graph editor: expressions on the left, typed as in Desmos, and the
// graph on the right as the slide will show it. The preview is the slide's
// own page (graphPage.js), sent each change; panning it or moving a slider
// there changes the graph that's saved.

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Eye, EyeOff, X, Plus, SlidersHorizontal, Play } from 'lucide-react'
import { createMathParser } from '../utils/graphParser'
import { graphPageHtml, graphConfig, GRAPH_COLORS, DEFAULT_VIEW, DEFAULT_VIEW_3D, DEFAULT_CAMERA, defaultGraph, defaultGraph3d, newExpressionId } from '../utils/graphPage'

const EXAMPLES = [
  ['Function', 'y = x^2 - 2'],
  ['With a slider', 'y = a sin(bx)'],
  ['Circle', 'x^2 + y^2 = 9'],
  ['Shaded region', 'y < 0.5x + 1'],
  ['Parametric curve', '(3cos t, 2sin t)'],
  ['Polar curve', 'r = 2 + 2cos θ'],
  ['Point', '(2, 3)'],
  ['Draggable point', '(p, q)'],
  ['Piecewise', 'y = {x < 0: -x, x^2}'],
  ['Restricted domain', 'y = √x {0 < x < 4}'],
  ['Define a function', 'f(x) = e^(-x^2)'],
  ['Vector field', 'F(x, y) = (-y, x)'],
  ['System (phase portrait)', "(x', y') = (y, -sin x - 0.3y)"],
  ['Slope field', 'dy/dx = x - y'],
  ['Path from a point', '(x, y)(0) = (1, 0)'],
  ['Solution through a point', 'y(0) = 1'],
]

// A 3D graph's examples; some set their parameters' ranges
const EXAMPLES_3D = [
  ['Surface', 'z = sin x cos y'],
  ['Saddle', 'z = (x^2 - y^2)/10'],
  ['Cylindrical (r, θ)', 'z = 8 - r^2/4 {r < 6}'],
  ['Sphere', 'x^2 + y^2 + z^2 = 36'],
  ['Cylinder', 'r = 4'],
  ['Parametric surface (torus)', '((6 + 2cos v)cos u, (6 + 2cos v)sin u, 2sin v)', { uMin: 0, uMax: 2 * Math.PI, vMin: 0, vMax: 2 * Math.PI }],
  ['Curve (helix)', '(5cos t, 5sin t, t/2 - 8)', { min: 0, max: 32 }],
  ['Point', '(2, 3, 4)'],
  ['Define a function', 'f(x, y) = e^(-(x^2 + y^2)/20) 8'],
  ['Value in space, sliced', 'w = sin x + sin y + sin z'],
  ['Level surfaces', 'f(x, y, z) = x^2 + y^2 - z^2', { volume: { draw: 'levels' } }],
  ['Value in space as points', 'w = e^(-(x^2 + y^2 + z^2)/30)', { volume: { draw: 'points' } }],
  ['Surface colored by a function', 'x^2 + y^2 + z^2 = 64', { surface: { color: 'function', colorBy: 'x y z' } }],
]
const SURFACE_KINDS = ['surface', 'psurface', 'implicit3']
// A value in space's options and their defaults (graphRuntime's VOLUME)
const VOLUME_DEFAULTS = { draw: 'slices', slices: { x: true, y: true, z: true }, at: {}, levels: 5, opacity: 0.5, density: 'normal', sizeBy: true, contours: false, cmap: 'auto', detail: 'normal' }
const isVolumeItem = it => it.kind === 'field3' || (it.kind === 'function' && it.graph === 'w')
const MATH_FONT = "'Cambria Math','STIX Two Math','Times New Roman',serif"

// What a field line's options offer, and their defaults by kind (graphRuntime's)
const FIELD_DEFAULTS = {
  vector: { draw: 'arrows', density: 'normal', length: 'scaled', colorBy: 'magnitude', shade: 'none', equilibria: false, separatrices: false, nullclines: false, traceDet: false, clicks: true },
  system: { draw: 'streamlines', density: 'normal', length: 'scaled', colorBy: 'line', shade: 'none', equilibria: true, separatrices: true, nullclines: false, traceDet: false, clicks: true },
  slope: { draw: 'slopes', density: 'normal', length: 'equal', colorBy: 'line', shade: 'none', equilibria: false, separatrices: false, nullclines: false, traceDet: false, clicks: true },
}
const FIELD_KINDS = ['vector', 'system', 'slope']
const OVERLAYS = [['equilibria', 'Equilibria, classified'], ['separatrices', 'Separatrices of saddles'], ['nullclines', 'Nullclines (x′ = 0, y′ = 0)'], ['traceDet', 'Trace–determinant plane']]

// What a field line was read as, under it
function fieldNote(it, lineOf) {
  switch (it.kind) {
    case 'vector': return it.gradOf ? `Vector field, the gradient of ${it.gradOf}` : 'Vector field'
    case 'system': return `${it.polar ? 'Polar system' : 'System'}, with line ${lineOf(it.partner)}`
    case 'partner': return `Part of line ${lineOf(it.partnerOf)}’s system`
    case 'slope': return 'Slope field, dy/dx'
    case 'solution': return `Solution of line ${lineOf(it.owner)}’s slope field`
    case 'trajectory': return `Path along line ${lineOf(it.owner)}${it.dragX || it.dragY ? '; drag its start' : ''}`
    default: return ''
  }
}

const SLIDER_DEFAULTS = { min: -10, max: 10, step: 0.1 }

const inputStyle = {
  padding: '4px 6px', background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', borderRadius: 4,
  color: 'var(--text-primary, #fff)', fontSize: 12, boxSizing: 'border-box',
}
const smallLabel = { fontSize: 11, color: 'var(--text-muted, #888)' }
const iconButton = {
  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #888)', padding: 3, display: 'flex', alignItems: 'center',
}

function fmtNumber(v) {
  if (!isFinite(v)) return ''
  return String(parseFloat(Number(v).toPrecision(6)))
}

// A number typed as an expression: 2π, -1/2, sqrt(2)
function useConstant(P) {
  return useCallback(text => {
    try {
      const st = P.parseStatement(String(text), new Set())
      if (st.ops.length) return NaN
      return P.compile(st.parts[0], null, {})({}, [])
    } catch {
      return NaN
    }
  }, [P])
}

function NumberField({ value, onCommit, width = 60, title, constant, placeholder }) {
  const [text, setText] = useState(value === undefined || value === null || value === '' ? '' : fmtNumber(value))
  useEffect(() => { setText(value === undefined || value === null || value === '' ? '' : fmtNumber(value)) }, [value])
  const commit = () => {
    if (text.trim() === '') { onCommit(undefined); return }
    const v = constant(text)
    if (isFinite(v)) onCommit(v)
    else setText(value === undefined ? '' : fmtNumber(value))
  }
  return (
    <input value={text} title={title} placeholder={placeholder} onChange={e => setText(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
      style={{ ...inputStyle, width }} />
  )
}

// How a value shown as color is colored: its map and range
function ColorScaleRow({ opts, set, constant }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ ...smallLabel, width: 44 }}>Map</span>
      <select value={opts.cmap || 'auto'} onChange={e => set({ cmap: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 0 }}
        title="Auto is blue to orange, gray at 0, when the values are both negative and positive; otherwise viridis">
        <option value="auto">Auto</option>
        <option value="viridis">Viridis</option>
        <option value="diverging">Blue to orange</option>
      </select>
      <NumberField value={opts.wMin} constant={constant} width={50} placeholder="auto" title="The color range’s bottom" onCommit={v => set({ wMin: v })} />
      <span style={smallLabel}>to</span>
      <NumberField value={opts.wMax} constant={constant} width={50} placeholder="auto" title="The color range’s top" onCommit={v => set({ wMax: v })} />
    </div>
  )
}

export default function GraphEditorModal({ initial, size, slideBg, isNew, onSave, onClose }) {
  const P = useMemo(() => createMathParser(), [])
  const constant = useConstant(P)
  const [graph, setGraph] = useState(() => ({ ...initial, view: { ...DEFAULT_VIEW, ...(initial.view || {}) } }))
  const [openOptions, setOpenOptions] = useState(null)
  const [focusId, setFocusId] = useState(null)
  const inputs = useRef({})
  const frameRef = useRef(null)
  const previewBox = useRef(null)
  const [box, setBox] = useState({ w: 640, h: 420 })

  const expressions = graph.expressions || []
  const dims3 = graph.dims === 3
  const analysis = useMemo(() => P.analyze(expressions, { dims: graph.dims }), [P, expressions, graph.dims])
  const byId = useMemo(() => Object.fromEntries(analysis.items.map(it => [it.id, it])), [analysis])
  // Whether any line shows a value as color, which a color bar keys
  const colorDims = graph.dims === 3 && analysis.items.some(it => isVolumeItem(it) || !!it.colorF)
  const palette = GRAPH_COLORS[graph.theme === 'dark' ? 'dark' : 'light']

  const update = patch => setGraph(g => ({ ...g, ...patch }))
  // 2D ↔ 3D: the default graph trades for the other's default; anything
  // typed stays, and is read the other way
  const switchDims = d => setGraph(g => {
    if ((g.dims === 3 ? 3 : 2) === d) return g
    const dark = g.theme === 'dark'
    const texts = list => (list || []).map(e => e.text).join('\n')
    const untouched = d === 3 ? texts(g.expressions) === texts(defaultGraph(dark).expressions) : texts(g.expressions) === texts(defaultGraph3d(dark).expressions)
    const next = d === 3
      ? { ...g, dims: 3, view: { ...DEFAULT_VIEW_3D }, camera: { ...DEFAULT_CAMERA } }
      : { ...g, dims: undefined, camera: undefined, view: { ...DEFAULT_VIEW } }
    if (untouched) next.expressions = (d === 3 ? defaultGraph3d(dark) : defaultGraph(dark)).expressions
    return next
  })
  const setExpressions = fn => setGraph(g => ({ ...g, expressions: fn(g.expressions || []) }))
  const updateExpr = (id, patch) => setExpressions(list => list.map(e => (e.id === id ? { ...e, ...patch } : e)))

  const nextColor = list => palette[list.filter(e => e.color).length % palette.length]
  const addExpression = (afterId, text = '', extra = {}) => {
    const id = newExpressionId()
    setExpressions(list => {
      const e = { id, text, color: nextColor(list), ...extra }
      const i = afterId ? list.findIndex(x => x.id === afterId) : -1
      return i < 0 ? [...list, e] : [...list.slice(0, i + 1), e, ...list.slice(i + 1)]
    })
    setFocusId(id)
    return id
  }
  const removeExpression = id => {
    const i = expressions.findIndex(e => e.id === id)
    setExpressions(list => list.filter(e => e.id !== id))
    const prev = expressions[i - 1] || expressions[i + 1]
    if (prev) setFocusId(prev.id)
  }
  const addSliders = (afterId, names) => {
    let after = afterId
    setExpressions(list => {
      const out = [...list]
      for (const name of names) {
        if (out.some(e => byId[e.id]?.kind === 'param' && byId[e.id]?.name === name)) continue
        const e = { id: newExpressionId(), text: `${name} = 1`, slider: { ...SLIDER_DEFAULTS } }
        const i = out.findIndex(x => x.id === after)
        out.splice(i < 0 ? out.length : i + 1, 0, e)
        after = e.id
      }
      return out
    })
  }

  useEffect(() => {
    if (!focusId) return
    const el = inputs.current[focusId]
    if (el) { el.focus(); setFocusId(null) }
  }, [focusId, expressions])

  // The preview: the slide's page, loaded once, then sent each change
  const previewHtml = useMemo(() => graphPageHtml(initial, { editor: true }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const sendConfig = useCallback(() => {
    const win = frameRef.current?.contentWindow
    if (win) win.postMessage({ source: 'parallax-graph-editor', type: 'config', config: graphConfig(graph, { editor: true }) }, '*')
  }, [graph])
  const onPreviewLoad = () => {
    sendConfig()
    frameRef.current?.contentWindow?.postMessage({ source: 'parallax-graph-editor', type: 'scale', scale: fitScale }, '*')
  }
  useEffect(() => { sendConfig() }, [sendConfig])

  useEffect(() => {
    const onMessage = e => {
      if (e.source !== frameRef.current?.contentWindow) return
      const d = e.data
      if (!d || d.source !== 'parallax-graph') return
      if (d.type === 'view' && d.view) update(d.camera ? { view: d.view, camera: d.camera } : { view: d.view })
      if (d.type === 'param' && typeof d.value === 'number') {
        setExpressions(list => list.map(ex => {
          const it = byId[ex.id]
          if (!it || it.kind !== 'param' || it.name !== d.name) return ex
          return { ...ex, text: `${ex.text.split('=')[0].trim()} = ${fmtNumber(d.value)}` }
        }))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [byId])

  // The preview keeps the element's shape, as large as its box allows
  useEffect(() => {
    const el = previewBox.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Drawn at the element's own size and scaled to fit, so it lays out as the
  // slide does; told the scale so it stays sharp
  const elW = size?.w || 560, elH = size?.h || 400
  const aspect = elW / elH
  const fitScale = Math.max(0.1, Math.min((box.w - 24) / elW, (box.h - 24) / elH))
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({ source: 'parallax-graph-editor', type: 'scale', scale: fitScale }, '*')
  }, [fitScale])

  const view = graph.view
  const equal = graph.equalScale !== false
  const shownY = equal
    ? (() => { const half = (view.xMax - view.xMin) / aspect / 2, mid = (view.yMin + view.yMax) / 2; return { yMin: mid - half, yMax: mid + half } })()
    : { yMin: view.yMin, yMax: view.yMax }
  const setView = patch => {
    const next = { ...view, ...patch }
    if (next.xMax > next.xMin && next.yMax > next.yMin) update({ view: next })
  }
  const setView3 = patch => {
    const next = { ...DEFAULT_VIEW_3D, ...view, ...patch }
    if (next.xMax > next.xMin && next.yMax > next.yMin && next.zMax > next.zMin) update({ view: next })
  }

  const onKeyDown = (e, ex, index) => {
    if (e.key === 'Enter') { e.preventDefault(); addExpression(ex.id) }
    else if (e.key === 'Backspace' && !ex.text && expressions.length > 1) { e.preventDefault(); removeExpression(ex.id) }
    else if (e.key === 'ArrowUp' && index > 0) { e.preventDefault(); setFocusId(expressions[index - 1].id) }
    else if (e.key === 'ArrowDown' && index < expressions.length - 1) { e.preventDefault(); setFocusId(expressions[index + 1].id) }
  }

  const check = (key, label, dflt = true) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary, #ccc)' }}>
      <input type="checkbox" checked={graph[key] === undefined ? dflt : !!graph[key]} onChange={e => update({ [key]: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
      {label}
    </label>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}>
      <div role="dialog" aria-label="Graph editor" style={{ background: 'var(--bg-card, #1e1e2e)', borderRadius: 12, width: 'min(1240px, 96vw)', height: 'min(800px, 94vh)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border, #333)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--border, #333)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary, #fff)' }}>Graph</span>
            <div role="group" aria-label="2D or 3D" style={{ display: 'inline-flex', border: '1px solid var(--border, #333)', borderRadius: 6, overflow: 'hidden' }}>
              {[[2, '2D'], [3, '3D']].map(([d, label]) => (
                <button key={d} type="button" aria-pressed={(graph.dims === 3 ? 3 : 2) === d} onClick={() => switchDims(d)}
                  style={{ border: 'none', padding: '3px 12px', fontSize: 12, cursor: 'pointer', background: (graph.dims === 3 ? 3 : 2) === d ? 'var(--accent)' : 'transparent', color: (graph.dims === 3 ? 3 : 2) === d ? '#fff' : 'var(--text-secondary, #ccc)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/#docs/tutorials/graphs" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>How to use</a>
            <button onClick={onClose} aria-label="Close" style={{ ...iconButton, fontSize: 18 }}><X size={18} /></button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Expressions */}
          <div style={{ width: 380, borderRight: '1px solid var(--border, #333)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {expressions.map((ex, index) => {
                const it = byId[ex.id] || {}
                const isSlider = it.kind === 'param' && it.slider
                const isField = FIELD_KINDS.includes(it.kind)
                const isPath = it.kind === 'trajectory' || it.kind === 'solution'
                const isSurface = SURFACE_KINDS.includes(it.kind) || (it.kind === 'function' && it.graph === 'z')
                const isVolume = isVolumeItem(it)
                const drawn = ['explicit', 'implicit', 'region', 'polar', 'parametric', 'point', 'curve3', 'point3'].includes(it.kind) || (it.kind === 'function' && it.graph) || isField || isPath || isSurface || isVolume
                const curve = drawn && !['point', 'point3'].includes(it.kind) && !isField && !isSurface && !isVolume
                const surf = { color: 'line', mesh: true, contours: false, detail: 'normal', ...(ex.surface || {}) }
                const setSurface = patch => updateExpr(ex.id, { surface: { ...(ex.surface || {}), ...patch } })
                // Coloring by a function starts from one of three variables, if there is one
                const pickColor = value => {
                  if (value !== 'function' || surf.colorBy) { setSurface({ color: value }); return }
                  const f3 = analysis.items.find(isVolumeItem)
                  setSurface({ color: value, colorBy: f3 && f3.kind === 'function' ? `${f3.name}(x, y, z)` : it.kind === 'curve3' ? 't' : 'x y z' })
                }
                const vol = isVolume ? { ...VOLUME_DEFAULTS, ...(ex.volume || {}), slices: { ...VOLUME_DEFAULTS.slices, ...(ex.volume?.slices || {}) }, at: { ...(ex.volume?.at || {}) } } : null
                const setVolume = patch => updateExpr(ex.id, { volume: { ...(ex.volume || {}), ...patch } })
                const fieldOpts = isField ? { ...FIELD_DEFAULTS[it.kind], ...(ex.field || {}) } : null
                const setField = patch => updateExpr(ex.id, { field: { ...(ex.field || {}), ...patch } })
                const lineOf = id => expressions.findIndex(e => e.id === id) + 1
                const note = fieldNote(it, lineOf)
                const slider = { ...SLIDER_DEFAULTS, ...(ex.slider || {}) }
                const missing = (it.missing || []).filter(n => analysis.missing.includes(n))
                return (
                  <div key={ex.id} style={{ borderBottom: '1px solid var(--border, #333)', padding: '8px 10px 8px 0', display: 'flex', gap: 6 }}>
                    <div style={{ width: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 2, color: 'var(--text-muted)', fontSize: 10 }}>
                      <span>{index + 1}</span>
                      {isVolume && (
                        <span title="Colored by its value" style={{ width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg, #440154, #3b528b, #21918c, #5ec962, #fde725)', opacity: ex.hidden ? 0.3 : 1 }} />
                      )}
                      {drawn && !isVolume && (
                        <label title="Color" style={{ width: 18, height: 18, borderRadius: '50%', background: ex.hidden ? 'transparent' : (ex.color || palette[0]), border: `2px solid ${ex.color || palette[0]}`, cursor: 'pointer', position: 'relative' }}>
                          <input type="color" value={ex.color || palette[0]} onChange={e => updateExpr(ex.id, { color: e.target.value })}
                            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                        </label>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          ref={el => { inputs.current[ex.id] = el }}
                          value={ex.text}
                          spellCheck={false}
                          placeholder={index === expressions.length - 1 ? 'Type an expression, like y = x^2' : ''}
                          onChange={e => updateExpr(ex.id, { text: e.target.value })}
                          onKeyDown={e => onKeyDown(e, ex, index)}
                          style={{ ...inputStyle, flex: 1, minWidth: 0, fontSize: 14, padding: '6px 8px', fontFamily: "'Cambria Math','STIX Two Math','Times New Roman',serif", borderColor: it.kind === 'error' ? '#e5484d' : 'var(--border, #333)' }}
                        />
                        {(drawn || isSlider) && (
                          <button title={ex.hidden ? 'Show' : 'Hide'} onClick={() => updateExpr(ex.id, { hidden: !ex.hidden })} style={iconButton}>
                            {ex.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                        {(drawn || isSlider) && (
                          <button title="Options" onClick={() => setOpenOptions(o => (o === ex.id ? null : ex.id))} style={{ ...iconButton, color: openOptions === ex.id ? 'var(--accent)' : iconButton.color }}>
                            <SlidersHorizontal size={14} />
                          </button>
                        )}
                        <button title="Delete" onClick={() => removeExpression(ex.id)} style={iconButton}><X size={14} /></button>
                      </div>

                      {it.kind === 'error' && <div style={{ fontSize: 11, color: '#e5484d', marginTop: 4 }}>{it.error}</div>}
                      {it.kind !== 'error' && (it.colorError || it.atError) && <div style={{ fontSize: 11, color: '#e5484d', marginTop: 4 }}>{it.colorError || it.atError}</div>}
                      {note && <div style={{ ...smallLabel, marginTop: 4 }}>{note}</div>}
                      {it.kind === 'value' && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>= {fmtNumber(it.f(P.paramValues(analysis)))}</div>}
                      {missing.length > 0 && it.kind !== 'error' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5, alignItems: 'center' }}>
                          <span style={smallLabel}>add slider:</span>
                          {missing.map(n => (
                            <button key={n} onClick={() => addSliders(ex.id, [n])} style={{ ...inputStyle, padding: '1px 8px', cursor: 'pointer', fontStyle: 'italic' }}>{n}</button>
                          ))}
                          {missing.length > 1 && <button onClick={() => addSliders(ex.id, missing)} style={{ ...inputStyle, padding: '1px 8px', cursor: 'pointer' }}>all</button>}
                        </div>
                      )}

                      {isSlider && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                          <NumberField value={slider.min} constant={constant} width={48} title="Least value" onCommit={v => updateExpr(ex.id, { slider: { ...slider, min: v ?? SLIDER_DEFAULTS.min } })} />
                          <input type="range" min={Math.min(slider.min, slider.max)} max={Math.max(slider.min, slider.max)} step={slider.step || 'any'}
                            value={isFinite(it.literal) ? it.literal : 0}
                            onChange={e => updateExpr(ex.id, { text: `${ex.text.split('=')[0].trim()} = ${fmtNumber(+e.target.value)}` })}
                            style={{ flex: 1, minWidth: 0, accentColor: 'var(--accent)' }} />
                          <NumberField value={slider.max} constant={constant} width={48} title="Greatest value" onCommit={v => updateExpr(ex.id, { slider: { ...slider, max: v ?? SLIDER_DEFAULTS.max } })} />
                        </div>
                      )}
                      {it.kind === 'psurface' && (
                        <div style={{ display: 'grid', gap: 4, marginTop: 6, ...smallLabel }}>
                          {[['u', 'uMin', 'uMax', 2 * Math.PI], ['v', 'vMin', 'vMax', Math.PI]].map(([name, lo, hi, dflt]) => (
                            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <NumberField value={ex[lo] ?? 0} constant={constant} width={62} onCommit={v => updateExpr(ex.id, { [lo]: v })} />
                              <span>≤ <i style={{ fontFamily: 'serif', fontSize: 13 }}>{name}</i> ≤</span>
                              <NumberField value={ex[hi] ?? dflt} constant={constant} width={62} onCommit={v => updateExpr(ex.id, { [hi]: v })} />
                            </div>
                          ))}
                        </div>
                      )}
                      {(it.kind === 'parametric' || it.kind === 'polar' || it.kind === 'curve3') && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, ...smallLabel }}>
                          <NumberField value={ex.min ?? 0} constant={constant} width={62} onCommit={v => updateExpr(ex.id, { min: v })} />
                          <span>≤ <i style={{ fontFamily: 'serif', fontSize: 13 }}>{it.kind === 'polar' ? 'θ' : 't'}</i> ≤</span>
                          <NumberField value={ex.max ?? 2 * Math.PI} constant={constant} width={62} onCommit={v => updateExpr(ex.id, { max: v })} />
                        </div>
                      )}

                      {openOptions === ex.id && (
                        <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: 'var(--bg-hover, #252530)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {curve && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span style={{ ...smallLabel, width: 44 }}>Line</span>
                              <select value={ex.style || 'solid'} onChange={e => updateExpr(ex.id, { style: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                                <option value="solid">Solid</option>
                                <option value="dashed">Dashed</option>
                                <option value="dotted">Dotted</option>
                              </select>
                              <select value={ex.width || 2.5} onChange={e => updateExpr(ex.id, { width: +e.target.value })} style={{ ...inputStyle, width: 70 }} title="Thickness">
                                {[1.5, 2.5, 3.5, 5].map(w => <option key={w} value={w}>{w === 2.5 ? 'Normal' : w < 2.5 ? 'Thin' : w === 3.5 ? 'Thick' : 'Heavy'}</option>)}
                              </select>
                            </div>
                          )}
                          {it.kind === 'curve3' && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span style={{ ...smallLabel, width: 44 }}>Color</span>
                              <select value={surf.color === 'function' ? 'function' : 'line'} onChange={e => pickColor(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                                <option value="line">The line’s color</option>
                                <option value="function">By a function…</option>
                              </select>
                            </div>
                          )}
                          {it.kind === 'point' && (
                            <>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ ...smallLabel, width: 44 }}>Label</span>
                                <input value={ex.label || ''} onChange={e => updateExpr(ex.id, { label: e.target.value })} placeholder="None" style={{ ...inputStyle, flex: 1 }} />
                              </div>
                              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={!!ex.showCoords} onChange={e => updateExpr(ex.id, { showCoords: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
                                Show its coordinates
                              </label>
                              {(it.dragX || it.dragY) && <div style={smallLabel}>Its sliders move when it’s dragged.</div>}
                            </>
                          )}
                          {isSlider && (
                            <>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ ...smallLabel, width: 44 }}>Step</span>
                                <NumberField value={slider.step} constant={constant} width={70} placeholder="Any" onCommit={v => updateExpr(ex.id, { slider: { ...slider, step: v > 0 ? v : undefined } })} />
                                <span style={{ ...smallLabel, marginLeft: 6 }}>Speed</span>
                                <select value={slider.speed || 1} onChange={e => updateExpr(ex.id, { slider: { ...slider, speed: +e.target.value } })} style={{ ...inputStyle, width: 70 }}>
                                  {[0.25, 0.5, 1, 2, 4].map(s => <option key={s} value={s}>{s}×</option>)}
                                </select>
                              </div>
                              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={!!slider.play} onChange={e => updateExpr(ex.id, { slider: { ...slider, play: e.target.checked } })} style={{ accentColor: 'var(--accent)' }} />
                                <Play size={11} /> Play when the slide opens
                              </label>
                              <div style={smallLabel}>Hide it (the eye) to leave it off the slide’s sliders.</div>
                            </>
                          )}
                          {isField && (
                            <>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ ...smallLabel, width: 44 }}>Draw as</span>
                                <select value={fieldOpts.draw} onChange={e => setField({ draw: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                                  {(it.kind === 'slope' ? [['slopes', 'Slope marks'], ['streamlines', 'Streamlines']] : [['streamlines', 'Streamlines'], ['arrows', 'Arrows'], ['particles', 'Particles moving'], ['none', 'Nothing']])
                                    .map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                                </select>
                                <select value={fieldOpts.density} onChange={e => setField({ density: e.target.value })} style={{ ...inputStyle, width: 82 }} title="How close together">
                                  <option value="sparse">Sparse</option>
                                  <option value="normal">Normal</option>
                                  <option value="dense">Dense</option>
                                </select>
                              </div>
                              {it.kind !== 'slope' && (fieldOpts.draw === 'arrows' || fieldOpts.draw === 'streamlines') && (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <span style={{ ...smallLabel, width: 44 }}>Color</span>
                                  <select value={fieldOpts.colorBy} onChange={e => setField({ colorBy: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                                    <option value="line">The line’s color</option>
                                    <option value="magnitude">Fainter where weaker</option>
                                  </select>
                                  {fieldOpts.draw === 'arrows' && (
                                    <select value={fieldOpts.length} onChange={e => setField({ length: e.target.value })} style={{ ...inputStyle, width: 104 }} title="Arrow length">
                                      <option value="scaled">Length by strength</option>
                                      <option value="equal">All one length</option>
                                    </select>
                                  )}
                                </div>
                              )}
                              {it.kind === 'vector' && (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <span style={{ ...smallLabel, width: 44 }}>Shade</span>
                                  <select value={fieldOpts.shade} onChange={e => setField({ shade: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                                    <option value="none">Nothing behind it</option>
                                    <option value="magnitude">Its strength</option>
                                    <option value="divergence">Its divergence</option>
                                    <option value="curl">Its curl</option>
                                  </select>
                                </div>
                              )}
                              {it.kind !== 'slope' && OVERLAYS.map(([key, label]) => (
                                <div key={key} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', flex: 1 }}>
                                    <input type="checkbox" checked={!!fieldOpts[key]} onChange={e => setField({ [key]: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
                                    {key === 'equilibria' && it.kind === 'vector' ? 'Zeros, classified' : label}
                                  </label>
                                  {fieldOpts[key] && (
                                    <select value={(ex.field?.steps || {})[key] || 0} title="When it appears"
                                      onChange={e => setField({ steps: { ...(ex.field?.steps || {}), [key]: +e.target.value || undefined } })} style={{ ...inputStyle, width: 104 }}>
                                      <option value={0}>With the line</option>
                                      {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>At step {n}</option>)}
                                    </select>
                                  )}
                                </div>
                              ))}
                              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={!!fieldOpts.clicks} onChange={e => setField({ clicks: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
                                {it.kind === 'slope' ? 'A click starts a solution through it' : 'A click starts a path through it'}
                              </label>
                            </>
                          )}
                          {isSurface && (
                            <>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ ...smallLabel, width: 44 }}>Color</span>
                                <select value={surf.color} onChange={e => pickColor(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                                  <option value="line">The line’s color</option>
                                  <option value="height">By height (viridis)</option>
                                  <option value="function">By a function…</option>
                                </select>
                                <select value={surf.detail} onChange={e => setSurface({ detail: e.target.value })} style={{ ...inputStyle, width: 84 }} title="How finely it's drawn">
                                  <option value="normal">Normal</option>
                                  <option value="fine">Fine</option>
                                </select>
                              </div>
                              {it.kind !== 'implicit3' && (
                                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                  <input type="checkbox" checked={surf.mesh !== false} onChange={e => setSurface({ mesh: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
                                  Mesh lines
                                </label>
                              )}
                              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={!!surf.contours} onChange={e => setSurface({ contours: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
                                Contour lines (where z is a round number)
                              </label>
                            </>
                          )}
                          {(isSurface || it.kind === 'curve3') && surf.color === 'function' && (
                            <>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ ...smallLabel, width: 44 }}>By</span>
                                <input value={surf.colorBy || ''} spellCheck={false} aria-label="Color by" placeholder={it.kind === 'curve3' ? 't' : 'x y z'} onChange={e => setSurface({ colorBy: e.target.value })}
                                  title={it.kind === 'curve3' ? 'A function of x, y, z and t' : it.kind === 'psurface' ? 'A function of x, y, z, u and v' : 'A function of x, y and z'}
                                  style={{ ...inputStyle, flex: 1, minWidth: 0, fontSize: 13, fontFamily: MATH_FONT }} />
                              </div>
                              <ColorScaleRow opts={surf} set={setSurface} constant={constant} />
                            </>
                          )}
                          {isVolume && (
                            <>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ ...smallLabel, width: 44 }}>Draw as</span>
                                <select value={vol.draw} onChange={e => setVolume({ draw: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                                  <option value="slices">Slices through it</option>
                                  <option value="levels">Level surfaces</option>
                                  <option value="points">Points</option>
                                </select>
                                {vol.draw === 'points' ? (
                                  <select value={vol.density} onChange={e => setVolume({ density: e.target.value })} style={{ ...inputStyle, width: 84 }} title="How close together">
                                    <option value="sparse">Sparse</option>
                                    <option value="normal">Normal</option>
                                    <option value="dense">Dense</option>
                                  </select>
                                ) : (
                                  <select value={vol.detail} onChange={e => setVolume({ detail: e.target.value })} style={{ ...inputStyle, width: 84 }} title="How finely it's drawn">
                                    <option value="normal">Normal</option>
                                    <option value="fine">Fine</option>
                                  </select>
                                )}
                              </div>
                              {vol.draw === 'slices' && ['x', 'y', 'z'].map(k => (
                                <div key={k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', width: 96 }}>
                                    <input type="checkbox" checked={vol.slices[k] !== false} onChange={e => setVolume({ slices: { ...vol.slices, [k]: e.target.checked } })} style={{ accentColor: 'var(--accent)' }} />
                                    Slice at <i style={{ fontFamily: 'serif', fontSize: 13 }}>{k}</i> =
                                  </label>
                                  <input value={vol.at[k] ?? ''} spellCheck={false} placeholder="the middle" disabled={vol.slices[k] === false}
                                    title="A number, or a slider to move it with" onChange={e => setVolume({ at: { ...vol.at, [k]: e.target.value } })}
                                    style={{ ...inputStyle, flex: 1, minWidth: 0, fontSize: 13, fontFamily: MATH_FONT, opacity: vol.slices[k] === false ? 0.5 : 1 }} />
                                </div>
                              ))}
                              {vol.draw === 'slices' && (
                                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                  <input type="checkbox" checked={!!vol.contours} onChange={e => setVolume({ contours: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
                                  Contour lines (where the value is a round number)
                                </label>
                              )}
                              {vol.draw === 'levels' && (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <span style={{ ...smallLabel, width: 44 }}>Levels</span>
                                  <select value={vol.levels} onChange={e => setVolume({ levels: +e.target.value })} style={{ ...inputStyle, width: 60 }} title="How many, evenly spaced within the color range">
                                    {[1, 2, 3, 4, 5, 7, 9].map(n => <option key={n} value={n}>{n}</option>)}
                                  </select>
                                  <span style={{ ...smallLabel, marginLeft: 6 }}>Opacity</span>
                                  <select value={vol.opacity} onChange={e => setVolume({ opacity: +e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                                    {[[0.3, 'Faint'], [0.5, 'Half'], [0.75, 'Mostly'], [1, 'Solid']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                                  </select>
                                </div>
                              )}
                              {vol.draw === 'points' && (
                                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }} title="Larger toward the top of the color range, or for blue to orange, toward either end">
                                  <input type="checkbox" checked={vol.sizeBy !== false} onChange={e => setVolume({ sizeBy: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
                                  Size by value
                                </label>
                              )}
                              <ColorScaleRow opts={vol} set={setVolume} constant={constant} />
                            </>
                          )}
                          {it.kind === 'point3' && (
                            <>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ ...smallLabel, width: 44 }}>Label</span>
                                <input value={ex.label || ''} onChange={e => updateExpr(ex.id, { label: e.target.value })} placeholder="None" style={{ ...inputStyle, flex: 1 }} />
                              </div>
                              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={!!ex.showCoords} onChange={e => updateExpr(ex.id, { showCoords: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
                                Show its coordinates
                              </label>
                            </>
                          )}
                          {it.kind === 'trajectory' && (
                            <>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ ...smallLabel, width: 44 }}>Runs</span>
                                <select value={ex.traj?.dir || 'forward'} onChange={e => updateExpr(ex.id, { traj: { ...(ex.traj || {}), dir: e.target.value } })} style={{ ...inputStyle, flex: 1 }}>
                                  <option value="forward">Forward in time</option>
                                  <option value="backward">Backward in time</option>
                                  <option value="both">Both ways</option>
                                </select>
                              </div>
                              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={!!ex.traj?.moving} onChange={e => updateExpr(ex.id, { traj: { ...(ex.traj || {}), moving: e.target.checked } })} style={{ accentColor: 'var(--accent)' }} />
                                A dot rides along it while presenting
                              </label>
                            </>
                          )}
                          {drawn && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span style={{ ...smallLabel, width: 44 }}>Appears</span>
                              <select value={ex.step || 0} onChange={e => updateExpr(ex.id, { step: +e.target.value || undefined })} style={{ ...inputStyle, flex: 1 }}>
                                <option value={0}>With the slide</option>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>At step {n}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ padding: 10, borderTop: '1px solid var(--border, #333)', display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary" onClick={() => addExpression(expressions[expressions.length - 1]?.id)} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={13} /> Expression
              </button>
              <select value="" onChange={e => {
                const ex = (dims3 ? EXAMPLES_3D : EXAMPLES).find(([label]) => label === e.target.value)
                if (ex) addExpression(expressions[expressions.length - 1]?.id, ex[1], ex[2] || {})
                e.target.value = ''
              }}
                style={{ ...inputStyle, flex: 1, cursor: 'pointer' }} aria-label="Add an example">
                <option value="">Add an example…</option>
                {(dims3 ? EXAMPLES_3D : EXAMPLES).map(([label, text]) => <option key={label} value={label}>{label}: {text}</option>)}
              </select>
            </div>
          </div>

          {/* Preview and the graph's settings */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div ref={previewBox} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary, #111)' }}>
              <div style={{ width: Math.round(elW * fitScale), height: Math.round(elH * fitScale), position: 'relative', outline: '1px solid var(--border, #333)', background: slideBg || (graph.theme === 'dark' ? '#1e1e2e' : '#ffffff') }}>
                <iframe
                  ref={frameRef}
                  title="Graph preview"
                  sandbox="allow-scripts"
                  srcDoc={previewHtml}
                  onLoad={onPreviewLoad}
                  style={{ position: 'absolute', left: 0, top: 0, width: elW, height: elH, border: 'none', transform: `scale(${fitScale})`, transformOrigin: 'top left', background: 'transparent', display: 'block' }}
                />
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border, #333)', padding: '10px 16px', display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 14, rowGap: 8, alignItems: 'center' }}>
              <span style={smallLabel}>View</span>
              {dims3 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {['x', 'y', 'z'].map(k => (
                    <span key={k} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginRight: 6 }}>
                      <NumberField value={view[k + 'Min'] ?? DEFAULT_VIEW_3D[k + 'Min']} constant={constant} width={50} title={`Least ${k}`} onCommit={v => v !== undefined && setView3({ [k + 'Min']: v })} />
                      <span>≤ <i style={{ fontFamily: 'serif' }}>{k}</i> ≤</span>
                      <NumberField value={view[k + 'Max'] ?? DEFAULT_VIEW_3D[k + 'Max']} constant={constant} width={50} title={`Greatest ${k}`} onCommit={v => v !== undefined && setView3({ [k + 'Max']: v })} />
                    </span>
                  ))}
                  <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => update({ view: { ...DEFAULT_VIEW_3D }, camera: { ...DEFAULT_CAMERA } })}>Reset</button>
                  <span style={{ ...smallLabel, marginLeft: 4 }}>Drag the preview to turn it, scroll to zoom.</span>
                </div>
              ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                <NumberField value={view.xMin} constant={constant} width={58} title="Left edge" onCommit={v => v !== undefined && setView({ xMin: v })} />
                <span>≤ <i style={{ fontFamily: 'serif' }}>x</i> ≤</span>
                <NumberField value={view.xMax} constant={constant} width={58} title="Right edge" onCommit={v => v !== undefined && setView({ xMax: v })} />
                <span style={{ width: 8 }} />
                {equal ? (
                  <span title="With equal scales, the height follows the width; drag the preview to move up or down" style={smallLabel}>
                    {fmtNumber(shownY.yMin)} ≤ <i style={{ fontFamily: 'serif' }}>y</i> ≤ {fmtNumber(shownY.yMax)}
                  </span>
                ) : (
                  <>
                    <NumberField value={view.yMin} constant={constant} width={58} title="Bottom edge" onCommit={v => v !== undefined && setView({ yMin: v })} />
                    <span>≤ <i style={{ fontFamily: 'serif' }}>y</i> ≤</span>
                    <NumberField value={view.yMax} constant={constant} width={58} title="Top edge" onCommit={v => v !== undefined && setView({ yMax: v })} />
                  </>
                )}
                <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 8px', marginLeft: 6 }} onClick={() => update({ view: { ...DEFAULT_VIEW } })}>Reset</button>
                <span style={{ ...smallLabel, marginLeft: 4 }}>Drag the preview to move, scroll to zoom.</span>
              </div>
              )}
              <span style={smallLabel}>Show</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                {check('grid', 'Grid')}
                {check('axes', 'Axes')}
                {check('axisNumbers', 'Numbers')}
                {!dims3 && check('equalScale', 'Equal scales')}
                {check('showSliders', 'Sliders on the slide')}
                {check('lockView', dims3 ? 'Lock turning and zooming' : 'Lock panning and zooming', false)}
                {dims3 && check('spin', 'Spin while presenting', false)}
                {colorDims && check('colorBar', 'Color bars')}
              </div>
              <span style={smallLabel}>Axes</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <input value={graph.xLabel || ''} onChange={e => update({ xLabel: e.target.value })} placeholder="x-axis label" style={{ ...inputStyle, width: 130 }} />
                <input value={graph.yLabel || ''} onChange={e => update({ yLabel: e.target.value })} placeholder="y-axis label" style={{ ...inputStyle, width: 130 }} />
                {dims3 && <input value={graph.zLabel || ''} onChange={e => update({ zLabel: e.target.value })} placeholder="z-axis label" style={{ ...inputStyle, width: 130 }} />}
                <span style={{ ...smallLabel, marginLeft: 10 }}>Colors</span>
                <select value={graph.theme || 'light'} onChange={e => update({ theme: e.target.value })} style={inputStyle}>
                  <option value="light">For a light slide</option>
                  <option value="dark">For a dark slide</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!graph.background || graph.background === 'transparent'}
                    onChange={e => update({ background: e.target.checked ? 'transparent' : (graph.theme === 'dark' ? '#1e1e2e' : '#ffffff') })} style={{ accentColor: 'var(--accent)' }} />
                  See-through
                </label>
                {graph.background && graph.background !== 'transparent' && (
                  <input type="color" value={graph.background} onChange={e => update({ background: e.target.value })}
                    style={{ width: 34, height: 24, border: '1px solid var(--border)', borderRadius: 4, padding: 1, background: 'none', cursor: 'pointer' }} />
                )}
              </div>
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border, #333)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12 }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => onSave(graph)} style={{ fontSize: 12 }}>{isNew ? 'Insert' : 'Save'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

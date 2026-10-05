// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The circuit diagram editor. Parts on the left; in the middle, the circuit
// on the slide's color, solved as it's drawn; on the right, what's selected,
// or the circuit's checks, settings and steps. With a part chosen, a drag
// between two grid points places it (a wire turns one right angle; Shift
// keeps it straight), a click on a wire turns the wire into the part, and a
// drag that starts or ends in the middle of a wire splits it there. Ground
// grounds the vertex or wire clicked. Select moves vertices and parts.
// Preview build steps through the circuit as the presented slide will.

import { useState, useRef, useMemo, useLayoutEffect, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import { CIRCUIT_PARTS, CIRCUIT_TOOLS, CIRCUIT_VERTEX_KINDS, circuitModel, parseValue, formatSI } from '../utils/circuitParts'
import { solveCircuit } from '../utils/circuitSolve'
import {
  CIRCUIT_UNIT as UNIT, CIRCUIT_TEMPLATES, drawCircuit, circuitSvg, circuitTikz, circuitBounds, looseEnds, maxStep,
  connections, snapTo, addVertex, addPart, changePart, wireAt, junctionPoint, splitWire, routeWire, mergeDropped, removeParts,
} from '../utils/circuitDiagram'
import { DIAGRAM_CSS, applyDiagramStep, texRuns } from '../utils/diagramCore'
import { texHtml } from './FeynmanView'

const ACCENT = '#818cf8'
const inputStyle = {
  padding: '5px 7px', background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', borderRadius: 4,
  color: 'var(--text-primary, #fff)', fontSize: 12, boxSizing: 'border-box', width: '100%', minWidth: 0,
}
const texInput = { ...inputStyle, fontFamily: "'Fira Code','JetBrains Mono',monospace" }
const smallLabel = { fontSize: 11, color: 'var(--text-muted, #888)' }
const sectionTitle = { fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted, #888)' }
const iconButton = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #888)', padding: 3, display: 'flex', alignItems: 'center' }
const smallButton = { fontSize: 12, padding: '4px 10px' }
const section = { display: 'flex', flexDirection: 'column', gap: 7 }
const row = { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }
const check = { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }

const clone = d => JSON.parse(JSON.stringify(d))
const isDark = hex => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex || '')
  return !m || 0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16) < 140
}
const stepName = n => (n === 0 ? 'From the start' : `Step ${n}`)
const SOLVED = {
  empty: 'Draw a circuit to see its current.',
  nosource: 'Add a battery or a source to see current flow.',
  shorted: 'A source is shorted out by a wire, a closed switch or an ammeter (highlighted).',
  conflict: 'Two sources set the same voltage differently, so there is no solution.',
  still: 'No current flows in the steady state.',
}

// The window of the circuit the canvas shows, in cm, 5:3 like the canvas
function fitView(d) {
  const b = circuitBounds(d), pad = 1.3
  let w = Math.max(9, b.x1 - b.x0 + 2 * pad), h = Math.max(5.4, b.y1 - b.y0 + 2 * pad)
  if (w / h > 5 / 3) h = w * 3 / 5; else w = h * 5 / 3
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2
  return { x0: cx - w / 2, y0: cy - h / 2, w, h }
}
function nearestVertex(d, p) {
  let best = null, bd = 0.24
  for (const v of d.vertices) { const dist = Math.hypot(v.x - p.x, v.y - p.y); if (dist < bd) { bd = dist; best = v } }
  return best
}
const findPart = (d, sel) => !sel ? null : sel.kind === 'v' ? d.vertices.find(v => v.id === sel.id) : d.edges.find(e => e.id === sel.id)

// A part's picture, for the buttons
function miniPart(part, style) {
  const u = 30, len = 1.8
  if (part === 'ground') {
    const m = { vertices: [{ id: 'a', x: 0.9, y: 0.25, ground: 'down', kind: 'none' }], edges: [], captions: {} }
    return `<svg viewBox="0 ${-0.3 * u} ${len * u} ${0.7 * u}" width="50" height="19" style="display:block;overflow:visible">${drawCircuit(m, { U: u, ink: 'currentColor', style, lw: 2.2 }).svg}</svg>`
  }
  const m = { vertices: [{ id: 'a', x: 0, y: 0, kind: 'none' }, { id: 'b', x: len, y: 0, kind: 'none' }], edges: [{ id: 'm', from: 'a', to: 'b', part, label: '', value: '', step: 0 }], captions: {} }
  return `<svg viewBox="${-0.05 * u} ${-0.38 * u} ${(len + 0.1) * u} ${0.76 * u}" width="50" height="19" style="display:block;overflow:visible">${drawCircuit(m, { U: u, ink: 'currentColor', style, lw: 2.2 }).svg}</svg>`
}
function TexFace({ tex }) {
  return texRuns(tex).map((r, i) => {
    const t = r.it ? <i>{r.t}</i> : r.t
    return r.lvl > 0 ? <sup key={i}>{t}</sup> : r.lvl < 0 ? <sub key={i}>{t}</sub> : <span key={i}>{t}</span>
  })
}
function Chips({ items, onPick }) {
  if (!items?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {items.map(tex => (
        <button key={tex} type="button" title={tex} onClick={() => onPick(tex)}
          style={{ fontFamily: "'Latin Modern Roman', 'Times New Roman', serif", fontSize: 14, lineHeight: 1.4, padding: '0 8px', borderRadius: 999, border: '1px solid var(--border, #333)', background: 'var(--bg-hover, #252530)', color: 'var(--text-primary, #fff)', cursor: 'pointer' }}>
          <TexFace tex={tex} />
        </button>
      ))}
    </div>
  )
}
function Stepper({ value, onChange, label, name = stepName, min = 0 }) {
  const b = { width: 28, height: 26, border: 'none', background: 'none', color: 'var(--text-primary, #fff)', cursor: 'pointer', fontSize: 15 }
  return (
    <span role="group" aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border, #333)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-hover, #252530)' }}>
      <button type="button" style={b} aria-label="Earlier" onClick={() => onChange(value == null ? null : value - 1 < min ? (min === 1 ? null : min) : value - 1)}>−</button>
      <output style={{ minWidth: 104, textAlign: 'center', fontSize: 12, lineHeight: '26px', borderInline: '1px solid var(--border, #333)', fontVariantNumeric: 'tabular-nums' }}>{name(value)}</output>
      <button type="button" style={b} aria-label="Later" onClick={() => onChange(Math.min(1000, (value ?? min - 1) + 1))}>+</button>
    </span>
  )
}
function Segmented({ value, options, onChange, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'inline-flex', padding: 2, gap: 2, borderRadius: 6, border: '1px solid var(--border, #333)', background: 'var(--bg-hover, #252530)', flexWrap: 'wrap' }}>
      {options.map(([v, text, title]) => (
        <button key={v} type="button" aria-pressed={value === v} title={title} onClick={() => onChange(v)}
          style={{ border: 'none', borderRadius: 4, padding: '3px 9px', fontSize: 12, cursor: 'pointer', background: value === v ? 'var(--accent, #6366f1)' : 'transparent', color: value === v ? '#fff' : 'var(--text-secondary, #ccc)' }}>
          {text}
        </button>
      ))}
    </div>
  )
}

export default function CircuitEditorModal({ initial, slideBg = '#1e1e2e', isNew, onSave, onClose }) {
  const start = useMemo(() => circuitModel(initial), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [circuit, setCircuit] = useState(() => ({ vertices: start.vertices, edges: start.edges, captions: start.captions }))
  const [settings, setSettings] = useState({ color: start.color, symbols: start.symbols, flow: start.flow, readings: start.readings, stepStart: start.stepStart, dimPast: start.dimPast })
  const [sel, setSel] = useState(null)
  const [tool, setTool] = useState('select')
  const [view, setView] = useState(() => fitView(start))
  const [ghost, setGhost] = useState(null)
  const [preview, setPreview] = useState(null) // { step, animate, n }
  const [showTikz, setShowTikz] = useState(false)
  const [copied, setCopied] = useState(false)
  const [, setHistoryTick] = useState(0)
  const past = useRef([]), future = useRef([]), typingKey = useRef(null), drag = useRef(null)
  const circuitRef = useRef(circuit)
  const svgRef = useRef(null), previewRef = useRef(null), dialogRef = useRef(null)
  const startJson = useRef(JSON.stringify({ circuit, settings }))

  const ink = settings.color
  const mark = isDark(slideBg) ? '#6e7591' : '#a3a9bd'
  const solution = useMemo(() => solveCircuit(circuit), [circuit])
  const loose = useMemo(() => looseEnds(circuit), [circuit])
  const steps = useMemo(() => maxStep(circuit), [circuit])

  useEffect(() => { dialogRef.current?.focus({ preventScroll: true }) }, [])

  // Every change to the circuit goes through here, so it can be undone. A key
  // groups changes into one, such as the keystrokes typed into a field.
  const commit = useCallback((next, before, key = null) => {
    if (!key || key !== typingKey.current) {
      past.current.push(before)
      if (past.current.length > 300) past.current.shift()
      future.current = []
      setHistoryTick(t => t + 1)
    }
    typingKey.current = key
    circuitRef.current = next
    setCircuit(next)
  }, [])
  const edit = useCallback((fn, key = null) => {
    const before = JSON.stringify(circuitRef.current)
    const next = JSON.parse(before)
    const out = fn(next)
    if (JSON.stringify(next) !== before) commit(next, before, key)
    return out
  }, [commit])
  const editSelected = useCallback((fn, key) => edit(d => { const o = findPart(d, sel); if (o) fn(o, d) }, key), [edit, sel])
  const restore = useCallback((json, into) => {
    into.current.push(JSON.stringify(circuitRef.current))
    const d = JSON.parse(json)
    typingKey.current = null
    circuitRef.current = d
    setCircuit(d)
    setSel(s => (findPart(d, s) ? s : null))
    setHistoryTick(t => t + 1)
  }, [])
  const undo = useCallback(() => { if (past.current.length) restore(past.current.pop(), future) }, [restore])
  const redo = useCallback(() => { if (future.current.length) restore(future.current.pop(), past) }, [restore])

  // ---------- The canvas
  const markup = useMemo(() => drawCircuit(ghost || circuit, {
    ink, style: settings.symbols, labels: texHtml, editor: true, sel, grid: true, view, mark, accent: ACCENT, warnColor: '#f5a524',
    warn: [...loose, ...(solution.status === 'shorted' ? [solution.id] : [])],
    sol: ghost ? solveCircuit(ghost) : solution, flow: settings.flow, readings: settings.readings,
  }).svg, [ghost, circuit, ink, settings.symbols, settings.flow, settings.readings, sel, view, mark, loose, solution])

  const world = ev => {
    const svg = svgRef.current, pt = svg.createSVGPoint()
    pt.x = ev.clientX; pt.y = ev.clientY
    const p = pt.matrixTransform(svg.getScreenCTM().inverse())
    return { x: p.x / UNIT, y: -p.y / UNIT }
  }
  const snapPt = (p, ev) => ev.altKey ? { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 } : { x: snapTo(p.x), y: snapTo(p.y) }
  // Where a drag starts or ends: a vertex, a junction on a wire, or a grid point
  const endOf = (d, p, ev) => {
    const v = nearestVertex(d, p)
    if (v) return { v: v.id, x: v.x, y: v.y }
    const w = wireAt(d, p)
    if (w) return { wire: w.e.id, ...junctionPoint(d, w, ev.altKey) }
    return snapPt(p, ev)
  }
  // Lays the drawn part (or wire, maybe with a corner) into a circuit; returns the last part's id
  const lay = (d, a, b, straight) => {
    const from = a.v || (a.wire ? splitWire(d, a.wire, a) : addVertex(d, a.x, a.y))
    const to = b.v || (b.wire ? splitWire(d, b.wire, b) : addVertex(d, b.x, b.y))
    const A = d.vertices.find(v => v.id === from), B = d.vertices.find(v => v.id === to)
    const pts = tool === 'wire' ? routeWire({ x: A.x, y: A.y }, { x: B.x, y: B.y }, straight) : [A, B]
    let last = null
    for (let i = 0; i + 1 < pts.length; i++) {
      const p = i === 0 ? from : addVertex(d, pts[i].x, pts[i].y)
      const q = i + 2 === pts.length ? to : addVertex(d, pts[i + 1].x, pts[i + 1].y)
      if (p !== q) last = addPart(d, p, q, tool).id
    }
    return last
  }

  const onPointerDown = ev => {
    if (ev.button > 0) return
    ev.preventDefault()
    dialogRef.current?.focus({ preventScroll: true })
    typingKey.current = null
    const p = world(ev), d = circuitRef.current
    const vt = nearestVertex(d, p), et = ev.target.closest('[data-e]')
    try { svgRef.current.setPointerCapture(ev.pointerId) } catch { /* not every pointer can be captured */ }
    const before = JSON.stringify(d)
    if (tool === 'select') {
      if (vt) { setSel({ kind: 'v', id: vt.id }); drag.current = { kind: 'vertex', id: vt.id, start: p, ox: vt.x, oy: vt.y, before, work: JSON.parse(before) } }
      else if (et) {
        const e = d.edges.find(x => x.id === et.dataset.e), A = d.vertices.find(v => v.id === e.from), B = d.vertices.find(v => v.id === e.to)
        setSel({ kind: 'e', id: e.id })
        drag.current = { kind: 'edge', id: e.id, start: p, orig: [A.x, A.y, B.x, B.y], before, work: JSON.parse(before) }
      } else setSel(null)
      return
    }
    if (tool === 'ground') { drag.current = { kind: 'ground', p, vt: vt?.id, wire: !vt && wireAt(d, p) }; return }
    drag.current = { kind: 'new', start: endOf(d, p, ev), sp: p, onEdge: et && !vt ? et.dataset.e : null }
  }

  const onPointerMove = ev => {
    const dr = drag.current
    if (!dr) return
    const p = world(ev)
    if (dr.kind === 'new') {
      dr.moved = dr.moved || Math.hypot(p.x - dr.sp.x, p.y - dr.sp.y) > 0.2
      if (!dr.moved) return
      const m = clone(circuitRef.current), end = endOf(circuitRef.current, p, ev)
      if (Math.hypot(end.x - dr.start.x, end.y - dr.start.y) > 0.01 && !(end.v && end.v === dr.start.v)) lay(m, dr.start, end, ev.shiftKey)
      setGhost(m)
      return
    }
    if (dr.kind !== 'vertex' && dr.kind !== 'edge') return
    const w = dr.work
    if (dr.kind === 'vertex') {
      const v = w.vertices.find(x => x.id === dr.id), q = snapPt({ x: dr.ox + p.x - dr.start.x, y: dr.oy + p.y - dr.start.y }, ev)
      v.x = q.x; v.y = q.y
    } else {
      const e = w.edges.find(x => x.id === dr.id), A = w.vertices.find(v => v.id === e.from), B = w.vertices.find(v => v.id === e.to), [ax, ay, bx, by] = dr.orig
      const q = snapPt({ x: p.x - dr.start.x, y: p.y - dr.start.y }, ev)
      A.x = ax + q.x; A.y = ay + q.y; B.x = bx + q.x; B.y = by + q.y
    }
    const next = { ...w }
    circuitRef.current = next
    setCircuit(next)
  }

  const onPointerUp = ev => {
    const dr = drag.current
    drag.current = null
    if (!dr) return
    if (dr.kind === 'vertex' || dr.kind === 'edge') {
      const w = { ...dr.work }
      if (dr.kind === 'vertex') { const kept = mergeDropped(w, dr.id); if (kept) setSel({ kind: 'v', id: kept }) }
      if (JSON.stringify(w) !== dr.before) commit(w, dr.before)
      else { circuitRef.current = w; setCircuit(w) }
      return
    }
    if (dr.kind === 'ground') {
      const id = edit(d => {
        if (dr.vt) { const v = d.vertices.find(x => x.id === dr.vt); v.ground = v.ground ? null : 'down'; return v.id }
        if (dr.wire) { const vid = splitWire(d, dr.wire.e.id, junctionPoint(d, dr.wire, ev.altKey)); d.vertices.find(v => v.id === vid).ground = 'down'; return vid }
        const q = snapPt(dr.p, ev)
        return addVertex(d, q.x, q.y, { ground: 'down' })
      })
      setSel({ kind: 'v', id })
      return
    }
    setGhost(null)
    if (!dr.moved) {
      // A click: a wire or part becomes this part, or an empty point gets one 2 cm long
      if (dr.onEdge) { edit(d => { const e = d.edges.find(x => x.id === dr.onEdge); if (e) changePart(e, tool) }); setSel({ kind: 'e', id: dr.onEdge }) }
      else if (!dr.start.v && !dr.start.wire && tool !== 'wire') {
        const id = edit(d => addPart(d, addVertex(d, dr.start.x, dr.start.y), addVertex(d, dr.start.x + 2, dr.start.y), tool).id)
        setSel({ kind: 'e', id })
      }
      return
    }
    const end = endOf(circuitRef.current, world(ev), ev)
    if ((end.v && end.v === dr.start.v) || Math.hypot(end.x - dr.start.x, end.y - dr.start.y) < 0.01) return
    const id = edit(d => lay(d, dr.start, end, ev.shiftKey))
    if (id) setSel({ kind: 'e', id })
  }

  const onPointerCancel = () => {
    const dr = drag.current
    drag.current = null
    setGhost(null)
    if (dr?.before) { const d = JSON.parse(dr.before); circuitRef.current = d; setCircuit(d) }
  }

  const deleteSelected = () => {
    if (!sel) return
    edit(d => removeParts(d, sel))
    setSel(null)
  }
  const loadTemplate = key => {
    const t = CIRCUIT_TEMPLATES.find(x => x.key === key)
    if (!t) return
    const d = t.build()
    commit(d, JSON.stringify(circuitRef.current))
    setSel(null)
    setView(fitView(d))
  }

  // ---------- Preview build: the slide's drawing, stepped as it will be
  const previewSvg = useMemo(() => (preview ? circuitSvg({ ...circuit, ...settings }, { deck: 'editor', labels: texHtml }) : ''), [preview != null, circuit, settings]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (preview && previewRef.current) applyDiagramStep(previewRef.current, preview.step, preview.animate, settings.dimPast)
  }, [preview, previewSvg, settings.dimPast])
  const startPreview = () => { setSel(null); setTool('select'); setPreview({ step: 0, animate: false, n: 0 }) }
  const goStep = delta => setPreview(pv => {
    if (!pv) return pv
    const step = Math.min(steps, Math.max(0, pv.step + delta))
    return step === pv.step ? pv : { step, animate: delta > 0, n: pv.n + 1 }
  })
  const replay = () => {
    setPreview(pv => ({ ...pv, step: 0, animate: false, n: pv.n + 1 }))
    setTimeout(() => goStep(1), 250)
  }

  // ---------- Keys
  const onKeyDown = ev => {
    // Nothing here reaches the editor's own shortcuts (Delete, Ctrl+Z, …)
    ev.stopPropagation()
    const typing = ev.target.closest?.('input, textarea, select')
    const mod = ev.metaKey || ev.ctrlKey, k = ev.key.toLowerCase()
    if (mod && (k === 'z' || k === 'y')) {
      if (typing || preview) return
      ev.preventDefault()
      if (k === 'y' || ev.shiftKey) redo(); else undo()
      return
    }
    if (typing || mod || ev.altKey) return
    if (preview) {
      if (ev.key === 'ArrowRight' || ev.key === ' ' || ev.key === 'PageDown') { ev.preventDefault(); goStep(1) }
      else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); goStep(-1) }
      else if (ev.key === 'Escape') setPreview(null)
      return
    }
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && sel) { ev.preventDefault(); deleteSelected(); return }
    if (ev.key === 'Escape') { setSel(null); setTool('select'); return }
    if (k === 'v') { setTool('select'); return }
    if (k === 'g') { setTool('ground'); return }
    const t = CIRCUIT_TOOLS.find(x => CIRCUIT_PARTS[x]?.key === k)
    if (t) setTool(t)
  }

  // ---------- Saving
  const result = () => ({ ...circuit, captions: Object.fromEntries(Object.entries(circuit.captions).filter(([, v]) => v && v.trim())), ...settings })
  const tikz = useMemo(() => circuitTikz({ ...circuit, ...settings }), [circuit, settings])
  const save = () => onSave(result())
  const cancel = () => {
    if (JSON.stringify({ circuit, settings }) !== startJson.current && !confirm('Discard your changes to this circuit?')) return
    onClose()
  }
  const copyTikz = async () => {
    try { await navigator.clipboard.writeText(tikz); setCopied(true); setTimeout(() => setCopied(false), 1500) }
    catch (err) { alert('Couldn’t copy: ' + err.message) }
  }

  const rail = useMemo(() => Object.fromEntries(CIRCUIT_TOOLS.map(t => [t, miniPart(t, settings.symbols)])), [settings.symbols])
  const selected = findPart(circuit, sel)
  const hint = preview
    ? '→ or Space goes to the next step, ← goes back, Esc returns to editing.'
    : tool === 'select' ? (sel ? 'Drag to move. Delete removes the selection.' : 'Click a part or vertex to edit it, or pick a part to draw.')
      : tool === 'ground' ? 'Click a vertex or a wire to ground it there, or an empty point for a new ground.'
        : tool === 'wire' ? 'Drag between two points for a wire, with one right angle. Shift keeps it straight; Alt draws off the grid.'
          : `Drag between two points for a ${CIRCUIT_PARTS[tool].name.toLowerCase()}, or click a wire to make it one.`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{DIAGRAM_CSS}</style>
      <div ref={dialogRef} role="dialog" aria-label="Circuit diagram" tabIndex={-1} onKeyDown={onKeyDown}
        style={{ background: 'var(--bg-card, #1e1e2e)', borderRadius: 12, width: 'min(1320px, 96vw)', height: 'min(860px, 94vh)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border, #333)', overflow: 'hidden', outline: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', borderBottom: '1px solid var(--border, #333)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary, #fff)' }}>Circuit diagram</span>
          <span role="status" style={{ ...smallLabel, fontSize: 12, flex: '1 1 260px', minWidth: 0 }}>{hint}</span>
          <div style={row}>
            <select aria-label="Start from a template" value="" disabled={!!preview} onChange={e => loadTemplate(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="" disabled>Start from…</option>
              {CIRCUIT_TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
            <button className="btn btn-secondary" style={smallButton} disabled={!!preview || !past.current.length} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
            <button className="btn btn-secondary" style={smallButton} disabled={!!preview || !future.current.length} onClick={redo} title="Redo (Ctrl+Shift+Z)">Redo</button>
            <button className="btn btn-secondary" style={smallButton} disabled={!!preview} onClick={() => setView(fitView(circuit))} title="Fit the view to the circuit">Fit</button>
            {preview
              ? <button className="btn btn-primary" style={smallButton} onClick={() => setPreview(null)}>Back to editing</button>
              : <button className="btn btn-primary" style={smallButton} onClick={startPreview} disabled={!circuit.edges.length}>Preview build</button>}
          </div>
          <a href="/#docs/tutorials/circuit-diagrams" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>How to use</a>
          <button onClick={cancel} aria-label="Close" style={iconButton}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Parts */}
          <div role="toolbar" aria-label="Parts" style={{ width: 140, flex: 'none', borderRight: '1px solid var(--border, #333)', padding: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, alignContent: 'start', overflowY: 'auto', opacity: preview ? 0.4 : 1, pointerEvents: preview ? 'none' : undefined }}>
            <button type="button" aria-pressed={tool === 'select'} onClick={() => setTool('select')} title="Select and move (V)"
              style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-primary, #fff)', border: `1px solid ${tool === 'select' ? 'var(--accent, #6366f1)' : 'transparent'}`, background: tool === 'select' ? 'rgba(99,102,241,0.18)' : 'none' }}>
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 1.5v11.2l3-2.9 2 4.6 2-.9-2-4.5h4.1z" fill="currentColor" /></svg>
              Select <span style={{ ...smallLabel, fontSize: 10 }}>V</span>
            </button>
            {CIRCUIT_TOOLS.map(t => {
              const P = CIRCUIT_PARTS[t] || { name: 'Ground', key: 'g' }
              return (
                <button key={t} type="button" aria-pressed={tool === t} onClick={() => setTool(t)} title={`${P.name}${P.key ? ` (${P.key.toUpperCase()})` : ''}`}
                  style={{ display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, padding: '7px 2px 6px', borderRadius: 6, fontSize: 10.5, lineHeight: 1.2, cursor: 'pointer', color: 'var(--text-primary, #fff)', textAlign: 'center', border: `1px solid ${tool === t ? 'var(--accent, #6366f1)' : 'transparent'}`, background: tool === t ? 'rgba(99,102,241,0.18)' : 'none' }}>
                  <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: rail[t] }} />
                  {P.name}
                </button>
              )
            })}
          </div>

          {/* The circuit */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 14, gap: 10 }}>
            <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 6, overflow: 'hidden', background: slideBg, boxShadow: '0 0 0 1px var(--border, #333)' }}>
              {preview
                ? <div ref={previewRef} style={{ position: 'absolute', inset: '6%' }} dangerouslySetInnerHTML={{ __html: previewSvg }} />
                : <svg ref={svgRef} viewBox={`${view.x0 * UNIT} ${-(view.y0 + view.h) * UNIT} ${view.w * UNIT} ${view.h * UNIT}`} preserveAspectRatio="xMidYMid meet"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', userSelect: 'none', cursor: tool === 'select' ? 'default' : 'crosshair' }}
                    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
                    dangerouslySetInnerHTML={{ __html: markup }} />}
            </div>
            {preview && (
              <div style={{ ...row, fontSize: 12.5, color: 'var(--text-secondary, #ccc)' }}>
                <button className="btn btn-secondary" style={smallButton} onClick={() => goStep(-1)} disabled={preview.step <= 0} aria-label="Previous step">◀</button>
                <span style={{ minWidth: 92, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>Step {preview.step} of {steps}</span>
                <button className="btn btn-secondary" style={smallButton} onClick={() => goStep(1)} disabled={preview.step >= steps} aria-label="Next step">▶</button>
                <button className="btn btn-secondary" style={smallButton} onClick={replay}>Replay</button>
                {!steps && <span style={smallLabel}>Everything shows from the start. Give parts steps, or have a switch flip at one.</span>}
              </div>
            )}
            {showTikz && (
              <pre style={{ margin: 0, maxHeight: 200, overflow: 'auto', padding: '10px 12px', borderRadius: 6, background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', fontSize: 11.5, lineHeight: 1.55, color: 'var(--text-primary, #fff)', fontFamily: "'Fira Code','JetBrains Mono',monospace" }}>{tikz}</pre>
            )}
          </div>

          {/* What's selected, or the circuit */}
          <div style={{ width: 280, flex: 'none', borderLeft: '1px solid var(--border, #333)', overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18, fontSize: 12, color: 'var(--text-secondary, #ccc)' }}>
            {selected && sel.kind === 'e' && <PartPanel e={selected} solution={solution} editSelected={editSelected} onDelete={deleteSelected} />}
            {selected && sel.kind === 'v' && <VertexPanel v={selected} circuit={circuit} solution={solution} editSelected={editSelected} onDelete={deleteSelected} />}
            {!selected && <CircuitPanel circuit={circuit} settings={settings} setSettings={setSettings} solution={solution} loose={loose} steps={steps} edit={edit} preview={preview} />}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderTop: '1px solid var(--border, #333)' }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setShowTikz(v => !v)} aria-pressed={showTikz}>{showTikz ? 'Hide CircuiTikZ' : 'Show CircuiTikZ'}</button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={copyTikz} disabled={!circuit.edges.length}>{copied ? 'Copied' : 'Copy CircuiTikZ'}</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={cancel}>Cancel</button>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={save} disabled={!circuit.edges.length}>{isNew ? 'Insert' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

function solvedHere(solution, e) {
  if ((solution.status !== 'ok' && solution.status !== 'still') || solution.I[e.id] == null) return null
  return `${formatSI(Math.abs(solution.I[e.id]), 'A')} through it, ${formatSI(Math.abs((solution.V[e.from] || 0) - (solution.V[e.to] || 0)), 'V')} across it.`
}

function PartPanel({ e, solution, editSelected, onDelete }) {
  const P = CIRCUIT_PARTS[e.part], parsed = parseValue(e.value), here = solvedHere(solution, e)
  return (
    <>
      <section style={section}>
        <div style={sectionTitle}>{e.part === 'wire' ? 'Wire' : 'Part'}</div>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Part</span>
          <select value={e.part} onChange={ev => editSelected(o => changePart(o, ev.target.value))} style={inputStyle}>
            {CIRCUIT_TOOLS.filter(t => CIRCUIT_PARTS[t]).map(t => <option key={t} value={t}>{CIRCUIT_PARTS[t].name}</option>)}
          </select>
        </label>
        <div style={row}>
          <button className="btn btn-secondary" style={smallButton} onClick={() => editSelected(o => { [o.from, o.to] = [o.to, o.from]; o.flip = !o.flip })} title={P.polar ? 'Swap its ends, which turns it around' : 'Swap its ends'}>Reverse</button>
          {e.part !== 'wire' && <button className="btn btn-secondary" style={smallButton} onClick={() => editSelected(o => { o.flip = !o.flip })}>Swap label sides</button>}
        </div>
        {here && <span style={smallLabel}>{here}</span>}
      </section>
      {e.part !== 'wire' && (
        <section style={section}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>Label</span>
            <input value={e.label} placeholder="TeX, like R_1" spellCheck={false} onChange={ev => editSelected(o => { o.label = ev.target.value }, 'label:' + e.id)} style={texInput} />
          </label>
          <Chips items={P.chips} onPick={tex => editSelected(o => { o.label = tex })} />
        </section>
      )}
      {P.unit && (
        <section style={section}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>Value</span>
            <input value={e.value} placeholder={`${P.dflt}, or with a prefix like 4.7k`} spellCheck={false} onChange={ev => editSelected(o => { o.value = ev.target.value }, 'value:' + e.id)} style={inputStyle} />
          </label>
          <span style={smallLabel}>
            {e.value === '' ? `Not shown; solved as ${formatSI(P.dflt, P.unit)}.` : parsed == null ? `Shown as typed; not a number, so solved as ${formatSI(P.dflt, P.unit)}.` : `Shown as ${formatSI(parsed, P.unit)}.`}
          </span>
        </section>
      )}
      {e.part === 'switch' && (
        <section style={section}>
          <div style={sectionTitle}>Switch</div>
          <label style={check}><input type="checkbox" checked={e.closed} onChange={ev => editSelected(o => { o.closed = ev.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Starts closed</label>
          <div style={row}>
            <span>{e.closed ? 'Opens' : 'Closes'} at</span>
            <Stepper label="Flips at" value={e.flipAt} min={1} name={n => (n == null ? 'Never' : `Step ${n}`)} onChange={n => editSelected(o => { o.flipAt = n })} />
          </div>
        </section>
      )}
      <section style={section}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Current arrow</span>
          <input value={e.current} placeholder="TeX, like i_1" spellCheck={false} onChange={ev => editSelected(o => { o.current = ev.target.value }, 'current:' + e.id)} style={texInput} />
        </label>
        {e.part !== 'wire' && (
          <label style={{ display: 'grid', gap: 4 }}>
            <span>Voltage marks</span>
            <input value={e.voltage} placeholder="TeX, like v_R" spellCheck={false} onChange={ev => editSelected(o => { o.voltage = ev.target.value }, 'voltage:' + e.id)} style={texInput} />
          </label>
        )}
      </section>
      <section style={section}>
        <div style={sectionTitle}>Appears</div>
        <Stepper label="Step" value={e.step || 0} onChange={n => editSelected(o => { o.step = Math.max(0, n ?? 0) })} />
      </section>
      <div><button className="btn btn-secondary" style={{ ...smallButton, color: '#e5484d' }} onClick={onDelete}>Delete {e.part === 'wire' ? 'wire' : 'part'}</button></div>
    </>
  )
}

function VertexPanel({ v, circuit, solution, editSelected, onDelete }) {
  const parts = (connections(circuit)[v.id] || 0) - (v.ground ? 1 : 0)
  const volts = (solution.status === 'ok' || solution.status === 'still') && solution.V[v.id] != null ? solution.V[v.id] : null
  const grounded = circuit.vertices.some(w => w.ground)
  return (
    <>
      <section style={section}>
        <div style={sectionTitle}>Vertex</div>
        <Segmented label="Mark" value={v.kind || 'auto'} onChange={k => editSelected(o => { o.kind = k })}
          options={CIRCUIT_VERTEX_KINDS.map(([k, name]) => [k, name, k === 'auto' ? 'A dot where three or more connections meet' : name])} />
        <span style={smallLabel}>{parts === 1 ? 'The end of one part.' : `${parts} parts meet here.`} At {Math.round(v.x * 100) / 100}, {Math.round(v.y * 100) / 100} cm.</span>
        {volts != null && <span style={smallLabel}>At {formatSI(volts, 'V')}{grounded ? '' : ', against the first source’s − terminal'}.</span>}
      </section>
      <section style={section}>
        <div style={sectionTitle}>Ground</div>
        <Segmented label="Ground" value={v.ground || ''} onChange={g => editSelected(o => { o.ground = g || null })}
          options={[['', 'None', 'Not grounded'], ['down', '↓', 'Pointing down'], ['up', '↑', 'Pointing up'], ['left', '←', 'Pointing left'], ['right', '→', 'Pointing right']]} />
      </section>
      <section style={section}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Label</span>
          <input value={v.label} placeholder="TeX, like V_\mathrm{out}" spellCheck={false} onChange={ev => editSelected(o => { o.label = ev.target.value }, 'vlabel:' + v.id)} style={texInput} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Label position</span>
          <select value={v.labelAt || 'auto'} onChange={ev => editSelected(o => { o.labelAt = ev.target.value })} style={inputStyle}>
            <option value="auto">Away from its parts</option>
            <option value="above">Above</option>
            <option value="below">Below</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </label>
      </section>
      <div><button className="btn btn-secondary" style={{ ...smallButton, color: '#e5484d' }} onClick={onDelete}>Delete vertex</button></div>
    </>
  )
}

function CircuitPanel({ circuit, settings, setSettings, solution, loose, steps, edit, preview }) {
  const parts = circuit.edges.filter(e => e.part !== 'wire').length, wires = circuit.edges.length - parts
  const bad = loose.length || solution.status === 'shorted' || solution.status === 'conflict'
  const said = solution.status === 'ok' ? `Solved. The most current anywhere is ${formatSI(solution.maxI, 'A')}.` : SOLVED[solution.status]
  const set = patch => setSettings(s => ({ ...s, ...patch }))
  return (
    <>
      <section style={section}>
        <div style={sectionTitle}>Circuit</div>
        <span style={smallLabel}>{parts} part{parts === 1 ? '' : 's'}, {wires} wire{wires === 1 ? '' : 's'}{steps ? `, built in ${steps} step${steps === 1 ? '' : 's'}` : ''}.</span>
        {circuit.edges.length > 0 && (
          <div role="status" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 6, border: `1px solid ${bad ? 'rgba(245,165,36,0.6)' : 'var(--border, #333)'}`, background: 'var(--bg-hover, #252530)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 4, flex: 'none', background: bad ? '#f5a524' : '#22c55e' }} />
            <span>{loose.length ? `${loose.length} loose end${loose.length === 1 ? '' : 's'} (circled). ` : ''}{said}</span>
          </div>
        )}
      </section>
      <section style={section}>
        <div style={sectionTitle}>Drawing</div>
        <Segmented label="Symbols" value={settings.symbols} onChange={v => set({ symbols: v })} options={[['us', 'US symbols'], ['iec', 'IEC symbols']]} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Line color
          <input type="color" value={settings.color} onChange={e => set({ color: e.target.value })}
            style={{ width: 28, height: 22, border: '1px solid var(--border, #333)', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }} />
        </label>
        <label style={check}><input type="checkbox" checked={settings.flow} onChange={e => set({ flow: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Show the current, and lamps lit</label>
        <label style={check}><input type="checkbox" checked={settings.readings} onChange={e => set({ readings: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Show meter readings</label>
      </section>
      <section style={section}>
        <div style={sectionTitle}>Build steps</div>
        {steps > 0
          ? Array.from({ length: steps }, (_, i) => i + 1).map(n => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr)', gap: 6, alignItems: 'center' }}>
              <b style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: preview?.step === n ? 'var(--accent, #6366f1)' : 'var(--text-muted, #888)' }}>{n}</b>
              <input value={circuit.captions[n] || ''} aria-label={`Caption for step ${n}`} placeholder={`Caption for step ${n}`}
                onChange={e => edit(d => { d.captions[n] = e.target.value }, 'caption:' + n)}
                style={{ ...inputStyle, borderColor: preview?.step === n ? 'var(--accent, #6366f1)' : undefined }} />
            </div>
          ))
          : <span style={smallLabel}>Everything shows from the start. Select a part and give it a step, or have a switch flip at one.</span>}
        <div style={row}>
          <button className="btn btn-secondary" style={smallButton} disabled={!steps} onClick={() => edit(d => { for (const e of d.edges) { e.step = 0; e.flipAt = null } for (const v of d.vertices) v.step = null })}>Clear steps</button>
        </div>
        {steps > 0 && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              First step at slide step
              <input type="number" min={1} max={1000} value={settings.stepStart}
                onChange={e => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= 1000) set({ stepStart: n }) }}
                style={{ ...inputStyle, width: 60 }} />
            </label>
            <label style={check}>
              <input type="checkbox" checked={settings.dimPast} onChange={e => set({ dimPast: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
              Fade earlier steps
            </label>
          </>
        )}
      </section>
    </>
  )
}

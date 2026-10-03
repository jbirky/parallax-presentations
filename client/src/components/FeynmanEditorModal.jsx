// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The Feynman diagram editor. Line styles on the left; in the middle, the
// diagram on the slide's color; on the right, what's selected, or the whole
// diagram's checks and steps. With a line style, a drag between two points
// draws a line (out of the middle of a line, it splits it there, and a click
// on a line restyles it); Select moves vertices and lines, and a selected
// line's handle bends it or turns its loop. Preview build steps through the
// diagram as the presented slide will.

import { useState, useRef, useMemo, useLayoutEffect, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import {
  UNIT, FEYNMAN_TYPES, FEYNMAN_TOOLS, VERTEX_KINDS, FEYNMAN_TEMPLATES, FEYNMAN_COLORS, FEYNMAN_CSS,
  feynmanModel, drawDiagram, feynmanSvg, feynmanTikz, flowWarnings, maxStep, vertexStep, degrees, diagramBounds,
  lineGeometry, vertexMap, nearestOnLine, snapTo, addVertex, addLine, splitLine, reverseLine, mergeDropped,
  removeParts, mirrorDiagram, rotateDiagram, stepsByTime, applyFeynmanStep, texRuns,
} from '../utils/feynmanDiagram'
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

const clone = d => JSON.parse(JSON.stringify(d))
const isDark = hex => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex || '')
  if (!m) return true
  return 0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16) < 140
}
const stepName = n => (n === 0 ? 'From the start' : `Step ${n}`)

// The window of the diagram the canvas shows, in cm, 5:3 like the canvas
function fitView(d) {
  const b = diagramBounds(d), pad = 1.2
  let w = Math.max(8, b.x1 - b.x0 + 2 * pad), h = Math.max(4.8, b.y1 - b.y0 + 2 * pad)
  if (w / h > 5 / 3) h = w * 3 / 5; else w = h * 5 / 3
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2
  return { x0: cx - w / 2, y0: cy - h / 2, w, h }
}
function nearestVertex(d, p, except) {
  let best = null, bd = 0.26
  for (const v of d.vertices) {
    if (v.id === except) continue
    const dist = Math.hypot(v.x - p.x, v.y - p.y)
    if (dist < bd) { bd = dist; best = v }
  }
  return best
}
const findPart = (d, sel) => !sel ? null : sel.kind === 'v' ? d.vertices.find(v => v.id === sel.id) : d.edges.find(e => e.id === sel.id)

// A line style's picture, for the tool buttons
function miniLine(type) {
  const u = 36, len = 1.3
  const m = { vertices: [{ id: 'a', x: 0, y: 0, kind: 'none' }, { id: 'b', x: len, y: 0, kind: 'none' }], edges: [{ id: 'm', from: 'a', to: 'b', particle: type, bend: 0, step: 0 }], captions: {} }
  return `<svg viewBox="${-0.06 * u} ${-0.22 * u} ${(len + 0.12) * u} ${0.44 * u}" width="50" height="16" style="display:block;overflow:visible">${drawDiagram(m, { U: u, ink: 'currentColor', lw: 1.7 }).svg}</svg>`
}
function kindIcon(k) {
  const line = '<path d="M-11 0H11" stroke="currentColor" stroke-width="1.5" opacity=".55"/>'
  const shapes = {
    auto: '<text x="0" y="4.5" text-anchor="middle" font-size="12" fill="currentColor" font-style="italic" font-family="serif">a</text>',
    none: line,
    dot: line + '<circle r="3.6" fill="currentColor"/>',
    blob: line + '<circle r="7" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.5"/>',
    crossed: line + '<circle r="5.5" fill="var(--bg-card, #1e1e2e)" stroke="currentColor" stroke-width="1.4"/><path d="M-3.8-3.8L3.8 3.8M-3.8 3.8L3.8-3.8" stroke="currentColor" stroke-width="1.3"/>',
    empty: line + '<circle r="3.6" fill="var(--bg-card, #1e1e2e)" stroke="currentColor" stroke-width="1.4"/>',
    square: line + '<rect x="-3.6" y="-3.6" width="7.2" height="7.2" fill="currentColor"/>',
  }
  return `<svg viewBox="-11 -9 22 18" width="22" height="18" style="overflow:visible">${shapes[k]}</svg>`
}
// A chip's TeX, as text with sub- and superscripts
function TexFace({ tex }) {
  return texRuns(tex).map((r, i) => {
    const t = r.it ? <i>{r.t}</i> : r.t
    return r.lvl > 0 ? <sup key={i}>{t}</sup> : r.lvl < 0 ? <sub key={i}>{t}</sub> : <span key={i}>{t}</span>
  })
}
function Chips({ items, onPick }) {
  if (!items.length) return null
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
function Swatches({ value, ink, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {[null, ...FEYNMAN_COLORS].map(c => (
        <button key={c || 'ink'} type="button" aria-pressed={(value || null) === c} aria-label={c ? `Color ${c}` : 'The diagram’s color'} title={c || 'The diagram’s color'}
          onClick={() => onChange(c)}
          style={{ width: 22, height: 22, borderRadius: '50%', padding: 0, cursor: 'pointer', background: c || ink, border: '2px solid var(--bg-card, #1e1e2e)', boxShadow: `0 0 0 ${(value || null) === c ? 2 : 1}px ${(value || null) === c ? 'var(--accent, #6366f1)' : 'var(--border-light, #444)'}` }} />
      ))}
    </div>
  )
}
function Stepper({ value, onChange, label }) {
  const b = { width: 28, height: 26, border: 'none', background: 'none', color: 'var(--text-primary, #fff)', cursor: 'pointer', fontSize: 15 }
  return (
    <span role="group" aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border, #333)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-hover, #252530)' }}>
      <button type="button" style={b} aria-label="Earlier" onClick={() => onChange(Math.max(0, value - 1))}>−</button>
      <output style={{ minWidth: 104, textAlign: 'center', fontSize: 12, lineHeight: '26px', borderInline: '1px solid var(--border, #333)', fontVariantNumeric: 'tabular-nums' }}>{stepName(value)}</output>
      <button type="button" style={b} aria-label="Later" onClick={() => onChange(Math.min(1000, value + 1))}>+</button>
    </span>
  )
}

export default function FeynmanEditorModal({ initial, slideBg = '#1e1e2e', isNew, onSave, onClose }) {
  const start = useMemo(() => feynmanModel(initial), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [diagram, setDiagram] = useState(() => ({ vertices: start.vertices, edges: start.edges, captions: start.captions }))
  const [settings, setSettings] = useState({ color: start.color, stepStart: start.stepStart, dimPast: start.dimPast })
  const [sel, setSel] = useState(null)
  const [tool, setTool] = useState('select')
  const [lastLine, setLastLine] = useState('photon')
  const [view, setView] = useState(() => fitView(start))
  const [ghost, setGhost] = useState(null)
  const [preview, setPreview] = useState(null) // { step, animate, n }
  const [showTikz, setShowTikz] = useState(false)
  const [copied, setCopied] = useState(false)
  const [, setHistoryTick] = useState(0)
  const past = useRef([]), future = useRef([]), typingKey = useRef(null), drag = useRef(null)
  const diagramRef = useRef(diagram)
  const svgRef = useRef(null), previewRef = useRef(null), dialogRef = useRef(null)
  const startJson = useRef(JSON.stringify({ diagram, settings }))

  const ink = settings.color
  const mark = isDark(slideBg) ? '#6e7591' : '#a3a9bd'
  const warn = useMemo(() => flowWarnings(diagram), [diagram])
  const steps = useMemo(() => maxStep(diagram), [diagram])

  useEffect(() => { dialogRef.current?.focus({ preventScroll: true }) }, [])

  // Every change to the diagram goes through here, so it can be undone. A
  // key groups changes into one, such as the keystrokes typed into a field.
  const commit = useCallback((next, before, key = null) => {
    if (!key || key !== typingKey.current) {
      past.current.push(before)
      if (past.current.length > 300) past.current.shift()
      future.current = []
      setHistoryTick(t => t + 1)
    }
    typingKey.current = key
    diagramRef.current = next
    setDiagram(next)
  }, [])
  const edit = useCallback((fn, key = null) => {
    const before = JSON.stringify(diagramRef.current)
    const next = JSON.parse(before)
    const out = fn(next)
    if (JSON.stringify(next) !== before) commit(next, before, key)
    return out
  }, [commit])
  const editSelected = useCallback((fn, key) => edit(d => { const o = findPart(d, sel); if (o) fn(o, d) }, key), [edit, sel])
  const restore = useCallback((json, into) => {
    into.current.push(JSON.stringify(diagramRef.current))
    const d = JSON.parse(json)
    typingKey.current = null
    diagramRef.current = d
    setDiagram(d)
    setSel(s => (findPart(d, s) ? s : null))
    setHistoryTick(t => t + 1)
  }, [])
  const undo = useCallback(() => { if (past.current.length) restore(past.current.pop(), future) }, [restore])
  const redo = useCallback(() => { if (future.current.length) restore(future.current.pop(), past) }, [restore])

  const pickTool = t => { setTool(t); if (t !== 'select') setLastLine(t) }

  // ---------- The canvas
  const markup = useMemo(() => drawDiagram(ghost || diagram, {
    ink, labels: texHtml, editor: true, sel, warn, grid: true, view, mark, accent: ACCENT, warnColor: '#f5a524',
  }).svg, [ghost, diagram, ink, sel, warn, view, mark])

  const world = ev => {
    const svg = svgRef.current, pt = svg.createSVGPoint()
    pt.x = ev.clientX; pt.y = ev.clientY
    const p = pt.matrixTransform(svg.getScreenCTM().inverse())
    return { x: p.x / UNIT, y: -p.y / UNIT }
  }
  const snap = (v, ev) => (ev.altKey ? Math.round(v * 100) / 100 : snapTo(v))

  // The diagram with the line being drawn, to show it as it's drawn
  const withLine = (dr, p, ev) => {
    const m = clone(diagramRef.current)
    const from = dr.startV || addVertex(m, dr.startPt.x, dr.startPt.y)
    const end = nearestVertex(diagramRef.current, p)
    const to = end ? end.id : addVertex(m, snap(p.x, ev), snap(p.y, ev))
    if (to !== from) addLine(m, from, to, tool)
    return m
  }

  const onPointerDown = ev => {
    if (ev.button > 0) return
    ev.preventDefault()
    dialogRef.current?.focus({ preventScroll: true })
    typingKey.current = null
    const p = world(ev), d = diagramRef.current
    const vt = nearestVertex(d, p), handle = ev.target.closest('[data-h]'), et = ev.target.closest('[data-e]')
    try { svgRef.current.setPointerCapture(ev.pointerId) } catch { /* not every pointer can be captured */ }
    const before = JSON.stringify(d)
    if (tool === 'select') {
      if (handle && sel?.kind === 'e') drag.current = { kind: handle.dataset.h, id: sel.id, before, work: JSON.parse(before) }
      else if (vt) { setSel({ kind: 'v', id: vt.id }); drag.current = { kind: 'vertex', id: vt.id, start: p, ox: vt.x, oy: vt.y, before, work: JSON.parse(before) } }
      else if (et) {
        const e = d.edges.find(x => x.id === et.dataset.e), V = vertexMap(d)
        setSel({ kind: 'e', id: e.id })
        drag.current = { kind: 'edge', id: e.id, start: p, orig: [V[e.from].x, V[e.from].y, V[e.to].x, V[e.to].y], before, work: JSON.parse(before) }
      } else setSel(null)
      return
    }
    if (vt) drag.current = { kind: 'new', startV: vt.id, sp: p }
    else if (et) {
      const e = d.edges.find(x => x.id === et.dataset.e)
      if (e.from === e.to) drag.current = { kind: 'new', onEdge: e.id, startPt: { x: snap(p.x, ev), y: snap(p.y, ev) }, sp: p }
      else {
        const g = lineGeometry(vertexMap(d), e), t = nearestOnLine(g, p), [x, y] = g.at(t)
        drag.current = { kind: 'new', onEdge: e.id, split: true, t, startPt: { x, y }, sp: p }
      }
    } else drag.current = { kind: 'new', startPt: { x: snap(p.x, ev), y: snap(p.y, ev) }, sp: p }
  }

  const onPointerMove = ev => {
    const dr = drag.current
    if (!dr) return
    const p = world(ev)
    if (dr.kind === 'new') {
      dr.moved = dr.moved || Math.hypot(p.x - dr.sp.x, p.y - dr.sp.y) > 0.12
      if (dr.moved) setGhost(withLine(dr, p, ev))
      return
    }
    const w = dr.work, V = vertexMap(w)
    if (dr.kind === 'vertex') {
      const v = V[dr.id]
      v.x = snap(dr.ox + p.x - dr.start.x, ev); v.y = snap(dr.oy + p.y - dr.start.y, ev)
    } else if (dr.kind === 'edge') {
      const e = w.edges.find(x => x.id === dr.id), A = V[e.from], B = V[e.to], [ax, ay, bx, by] = dr.orig
      const dx = snap(p.x - dr.start.x, ev), dy = snap(p.y - dr.start.y, ev)
      A.x = ax + dx; A.y = ay + dy
      if (B !== A) { B.x = bx + dx; B.y = by + dy }
    } else if (dr.kind === 'bend') {
      const e = w.edges.find(x => x.id === dr.id), A = V[e.from], B = V[e.to]
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1
      const off = ((p.x - (A.x + B.x) / 2) * -dy + (p.y - (A.y + B.y) / 2) * dx) / d
      let b = Math.min(1.6, Math.max(-1.6, off / (d / 2)))
      // Snaps straight, and to a semicircle
      if (Math.abs(b) < 0.07) b = 0
      else if (Math.abs(Math.abs(b) - 1) < 0.07) b = Math.sign(b)
      e.bend = Math.round(b * 100) / 100
    } else if (dr.kind === 'loop') {
      const e = w.edges.find(x => x.id === dr.id), A = V[e.from]
      const dx = p.x - A.x, dy = p.y - A.y
      e.loopAngle = (Math.round(Math.atan2(dy, dx) * 180 / Math.PI / 15) * 15 + 360) % 360
      e.loopSize = Math.round(Math.min(3, Math.max(0.5, Math.hypot(dx, dy))) * 4) / 4
    }
    const next = { ...w }
    diagramRef.current = next
    setDiagram(next)
  }

  const onPointerUp = ev => {
    const dr = drag.current
    drag.current = null
    if (!dr) return
    if (dr.kind !== 'new') {
      const w = { ...dr.work }
      if (dr.kind === 'vertex') { const kept = mergeDropped(w, dr.id); if (kept) setSel({ kind: 'v', id: kept }) }
      if (JSON.stringify(w) !== dr.before) commit(w, dr.before)
      else { diagramRef.current = w; setDiagram(w) }
      return
    }
    setGhost(null)
    if (!dr.moved) {
      // A click on a line restyles it
      if (dr.onEdge) { edit(d => { const e = d.edges.find(x => x.id === dr.onEdge); if (e) e.particle = tool }); setSel({ kind: 'e', id: dr.onEdge }) }
      return
    }
    const p = world(ev), end = nearestVertex(diagramRef.current, p)
    if (end && end.id === dr.startV) return
    const endPt = end ? null : { x: snap(p.x, ev), y: snap(p.y, ev) }
    if (endPt && !dr.startV && Math.hypot(endPt.x - dr.startPt.x, endPt.y - dr.startPt.y) < 0.01) return
    const id = edit(d => {
      const from = dr.startV || (dr.split ? splitLine(d, dr.onEdge, dr.t) : addVertex(d, dr.startPt.x, dr.startPt.y))
      const to = end ? end.id : addVertex(d, endPt.x, endPt.y)
      return addLine(d, from, to, tool).id
    })
    setSel({ kind: 'e', id })
  }

  const onPointerCancel = () => {
    const dr = drag.current
    drag.current = null
    setGhost(null)
    if (dr?.before) { const d = JSON.parse(dr.before); diagramRef.current = d; setDiagram(d) }
  }

  const deleteSelected = () => {
    if (!sel) return
    edit(d => removeParts(d, sel))
    setSel(null)
  }
  const transform = fn => {
    if (!diagramRef.current.vertices.length) return
    edit(fn)
    setView(fitView(diagramRef.current))
  }
  const loadTemplate = key => {
    const t = FEYNMAN_TEMPLATES.find(x => x.key === key)
    if (!t) return
    const d = t.build()
    commit(d, JSON.stringify(diagramRef.current))
    setSel(null)
    setView(fitView(d))
  }

  // ---------- Preview build: the slide's drawing, stepped as it will be
  const previewSvg = useMemo(() => (preview ? feynmanSvg({ ...diagram, ...settings }, { deck: 'editor', labels: texHtml }) : ''), [preview != null, diagram, settings]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (preview && previewRef.current) applyFeynmanStep(previewRef.current, preview.step, preview.animate, settings.dimPast)
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
    if (k === 'v') { pickTool('select'); return }
    const t = FEYNMAN_TOOLS.find(x => FEYNMAN_TYPES[x].key === k)
    if (t) pickTool(t)
  }

  // ---------- Saving
  const result = () => ({ ...diagram, captions: Object.fromEntries(Object.entries(diagram.captions).filter(([, v]) => v && v.trim())), ...settings })
  const tikz = useMemo(() => feynmanTikz({ ...diagram, ...settings }), [diagram, settings])
  const save = () => onSave(result())
  const cancel = () => {
    if (JSON.stringify({ diagram, settings }) !== startJson.current && !confirm('Discard your changes to this diagram?')) return
    onClose()
  }
  const copyTikz = async () => {
    try { await navigator.clipboard.writeText(tikz); setCopied(true); setTimeout(() => setCopied(false), 1500) }
    catch (err) { alert('Couldn’t copy: ' + err.message) }
  }

  const rail = useMemo(() => Object.fromEntries(FEYNMAN_TOOLS.map(t => [t, miniLine(t)])), [])
  const selected = findPart(diagram, sel)
  const hint = preview
    ? '→ or Space draws the next step, ← goes back, Esc returns to editing.'
    : tool === 'select'
      ? (sel ? 'Drag to move. Drag a line’s round handle to bend it. Delete removes the selection.' : 'Click a line or vertex to edit it, or pick a line style to draw.')
      : `Drag from a vertex, a line or empty space to draw a ${FEYNMAN_TYPES[tool].name.toLowerCase()} line. Click a line to restyle it. Alt draws off the grid.`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{FEYNMAN_CSS}</style>
      <div ref={dialogRef} role="dialog" aria-label="Feynman diagram" tabIndex={-1} onKeyDown={onKeyDown}
        style={{ background: 'var(--bg-card, #1e1e2e)', borderRadius: 12, width: 'min(1320px, 96vw)', height: 'min(860px, 94vh)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border, #333)', overflow: 'hidden', outline: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', borderBottom: '1px solid var(--border, #333)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary, #fff)' }}>Feynman diagram</span>
          <span role="status" style={{ ...smallLabel, fontSize: 12, flex: '1 1 260px', minWidth: 0 }}>{hint}</span>
          <div style={row}>
            <select aria-label="Start from a template" value="" disabled={!!preview} onChange={e => loadTemplate(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="" disabled>Start from…</option>
              {FEYNMAN_TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
            <button className="btn btn-secondary" style={smallButton} disabled={!!preview || !past.current.length} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
            <button className="btn btn-secondary" style={smallButton} disabled={!!preview || !future.current.length} onClick={redo} title="Redo (Ctrl+Shift+Z)">Redo</button>
            <button className="btn btn-secondary" style={smallButton} disabled={!!preview} onClick={() => transform(mirrorDiagram)} title="Mirror left to right, which reverses time">Mirror</button>
            <button className="btn btn-secondary" style={smallButton} disabled={!!preview} onClick={() => transform(rotateDiagram)} title="A quarter turn, e.g. from the s-channel picture to the t-channel one">Rotate</button>
            <button className="btn btn-secondary" style={smallButton} disabled={!!preview} onClick={() => setView(fitView(diagram))} title="Fit the view to the diagram">Fit</button>
            {preview
              ? <button className="btn btn-primary" style={smallButton} onClick={() => setPreview(null)}>Back to editing</button>
              : <button className="btn btn-primary" style={smallButton} onClick={startPreview} disabled={!diagram.edges.length}>Preview build</button>}
          </div>
          <a href="/#docs/tutorials/feynman-diagrams" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>How to use</a>
          <button onClick={cancel} aria-label="Close" style={iconButton}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Line styles */}
          <div role="toolbar" aria-label="Line styles" style={{ width: 140, flex: 'none', borderRight: '1px solid var(--border, #333)', padding: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, alignContent: 'start', overflowY: 'auto', opacity: preview ? 0.4 : 1, pointerEvents: preview ? 'none' : undefined }}>
            <button type="button" aria-pressed={tool === 'select'} onClick={() => pickTool('select')} title="Select and move (V)"
              style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-primary, #fff)', border: `1px solid ${tool === 'select' ? 'var(--accent, #6366f1)' : 'transparent'}`, background: tool === 'select' ? 'rgba(99,102,241,0.18)' : 'none' }}>
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 1.5v11.2l3-2.9 2 4.6 2-.9-2-4.5h4.1z" fill="currentColor" /></svg>
              Select <span style={{ ...smallLabel, fontSize: 10 }}>V</span>
            </button>
            {FEYNMAN_TOOLS.map(t => {
              const type = FEYNMAN_TYPES[t]
              return (
                <button key={t} type="button" aria-pressed={tool === t} onClick={() => pickTool(t)} title={`${type.name} line: ${type.usual}${type.key ? ` (${type.key.toUpperCase()})` : ''}`}
                  style={{ display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, padding: '7px 2px 6px', borderRadius: 6, fontSize: 10.5, lineHeight: 1.2, cursor: 'pointer', color: 'var(--text-primary, #fff)', textAlign: 'center', border: `1px solid ${tool === t ? 'var(--accent, #6366f1)' : 'transparent'}`, background: tool === t ? 'rgba(99,102,241,0.18)' : 'none' }}>
                  <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: rail[t] }} />
                  {type.name}
                </button>
              )
            })}
          </div>

          {/* The diagram */}
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
                {!steps && <span style={smallLabel}>Every line shows from the start. Give lines steps on the right to build the diagram up.</span>}
              </div>
            )}
            {showTikz && (
              <pre style={{ margin: 0, maxHeight: 200, overflow: 'auto', padding: '10px 12px', borderRadius: 6, background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', fontSize: 11.5, lineHeight: 1.55, color: 'var(--text-primary, #fff)', fontFamily: "'Fira Code','JetBrains Mono',monospace" }}>{tikz}</pre>
            )}
          </div>

          {/* What's selected, or the diagram */}
          <div style={{ width: 280, flex: 'none', borderLeft: '1px solid var(--border, #333)', overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18, fontSize: 12, color: 'var(--text-secondary, #ccc)' }}>
            {selected && sel.kind === 'e' && (
              <LinePanel e={selected} ink={ink} steps={steps} editSelected={editSelected} onDelete={deleteSelected} />
            )}
            {selected && sel.kind === 'v' && (
              <VertexPanel v={selected} diagram={diagram} ink={ink} steps={steps} lastLine={lastLine} editSelected={editSelected} edit={edit}
                onDelete={deleteSelected} onSelect={setSel} />
            )}
            {!selected && (
              <DiagramPanel diagram={diagram} settings={settings} setSettings={setSettings} warn={warn} steps={steps} edit={edit} preview={preview} />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderTop: '1px solid var(--border, #333)' }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setShowTikz(v => !v)} aria-pressed={showTikz}>{showTikz ? 'Hide TikZ' : 'Show TikZ'}</button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={copyTikz} disabled={!diagram.vertices.length}>{copied ? 'Copied' : 'Copy TikZ-Feynman'}</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={cancel}>Cancel</button>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={save} disabled={!diagram.edges.length}>{isNew ? 'Insert' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

function LinePanel({ e, ink, editSelected, onDelete }) {
  const type = FEYNMAN_TYPES[e.particle]
  const loop = e.from === e.to
  return (
    <>
      <section style={section}>
        <div style={sectionTitle}>Line</div>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Style</span>
          <select value={e.particle} onChange={ev => editSelected(o => { o.particle = ev.target.value })} style={inputStyle}>
            {FEYNMAN_TOOLS.map(t => <option key={t} value={t}>{FEYNMAN_TYPES[t].name}</option>)}
          </select>
        </label>
        {!loop && (
          <div style={row}>
            <button className="btn btn-secondary" style={smallButton} onClick={() => editSelected(o => reverseLine(o))} title="Swap its ends, which flips its arrow">Reverse</button>
            <button className="btn btn-secondary" style={smallButton} disabled={Math.abs(e.bend || 0) < 0.02} onClick={() => editSelected(o => { o.bend = 0 })}>Straighten</button>
          </div>
        )}
      </section>
      <section style={section}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Label</span>
          <input value={e.label} placeholder="TeX, like e^- or \gamma" spellCheck={false} onChange={ev => editSelected(o => { o.label = ev.target.value }, 'label:' + e.id)} style={texInput} />
        </label>
        <Chips items={type.chips} onPick={tex => editSelected(o => { o.label = tex })} />
        <div style={row}><button className="btn btn-secondary" style={smallButton} disabled={!e.label} onClick={() => editSelected(o => { o.labelSide = -(o.labelSide || 1) })}>Move label across</button></div>
      </section>
      <section style={section}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Momentum arrow</span>
          <input value={e.momentum} placeholder="p, k, q, p_1 + k" spellCheck={false} onChange={ev => editSelected(o => { o.momentum = ev.target.value }, 'momentum:' + e.id)} style={texInput} />
        </label>
        <Chips items={['p', 'k', 'q', 'p_1', 'p_2', "p'"]} onPick={tex => editSelected(o => { o.momentum = tex })} />
        <div style={row}>
          <button className="btn btn-secondary" style={smallButton} disabled={!e.momentum} onClick={() => editSelected(o => { o.momentumSide = -(o.momentumSide || -1) })}>Other side</button>
          <button className="btn btn-secondary" style={smallButton} disabled={!e.momentum} onClick={() => editSelected(o => { o.momentumReverse = !o.momentumReverse })}>Point the other way</button>
        </div>
      </section>
      <section style={section}>
        <div style={sectionTitle}>Color</div>
        <Swatches value={e.color} ink={ink} onChange={c => editSelected(o => { o.color = c })} />
      </section>
      <section style={section}>
        <div style={sectionTitle}>Appears</div>
        <Stepper label="Step" value={e.step || 0} onChange={n => editSelected(o => { o.step = n })} />
      </section>
      <div><button className="btn btn-secondary" style={{ ...smallButton, color: '#e5484d' }} onClick={onDelete}>Delete line</button></div>
    </>
  )
}

function VertexPanel({ v, diagram, ink, steps, lastLine, editSelected, edit, onDelete, onSelect }) {
  const deg = degrees(diagram)[v.id] || 0
  const auto = vertexStep({ ...diagram }, { ...v, step: null })
  return (
    <>
      <section style={section}>
        <div style={sectionTitle}>Vertex</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4 }}>
          {VERTEX_KINDS.map(([k, name]) => (
            <button key={k} type="button" aria-pressed={(v.kind || 'auto') === k} title={k === 'auto' ? 'A dot where three or more lines meet' : name}
              onClick={() => editSelected(o => { o.kind = k })}
              style={{ display: 'grid', justifyItems: 'center', gap: 2, padding: '5px 2px 4px', fontSize: 10.5, borderRadius: 6, cursor: 'pointer', color: 'var(--text-primary, #fff)', border: `1px solid ${(v.kind || 'auto') === k ? 'var(--accent, #6366f1)' : 'var(--border, #333)'}`, background: (v.kind || 'auto') === k ? 'rgba(99,102,241,0.18)' : 'var(--bg-hover, #252530)' }}>
              <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: kindIcon(k) }} />{name}
            </button>
          ))}
        </div>
        <span style={smallLabel}>{deg === 1 ? 'The end of an external leg.' : `${deg} line ends meet here.`} At {Math.round(v.x * 100) / 100}, {Math.round(v.y * 100) / 100} cm.</span>
      </section>
      <section style={section}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Label</span>
          <input value={v.label} placeholder="TeX, like \mu^+" spellCheck={false} onChange={ev => editSelected(o => { o.label = ev.target.value }, 'vlabel:' + v.id)} style={texInput} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Label position</span>
          <select value={v.labelAt || 'auto'} onChange={ev => editSelected(o => { o.labelAt = ev.target.value })} style={inputStyle}>
            <option value="auto">Away from its lines</option>
            <option value="above">Above</option>
            <option value="below">Below</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </label>
      </section>
      <section style={section}>
        <div style={sectionTitle}>Color</div>
        <Swatches value={v.color} ink={ink} onChange={c => editSelected(o => { o.color = c })} />
      </section>
      <section style={section}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Appears</span>
          <select value={v.step == null ? 'auto' : String(v.step)} onChange={ev => editSelected(o => { o.step = ev.target.value === 'auto' ? null : Number(ev.target.value) })} style={inputStyle}>
            <option value="auto">With its first line ({stepName(auto).toLowerCase()})</option>
            {Array.from({ length: steps + 2 }, (_, i) => <option key={i} value={String(i)}>{stepName(i)}</option>)}
          </select>
        </label>
      </section>
      <div style={row}>
        <button className="btn btn-secondary" style={smallButton} title={`A loop from this vertex back to itself, drawn as a ${FEYNMAN_TYPES[lastLine].name.toLowerCase()} line`}
          onClick={() => { const id = edit(d => addLine(d, v.id, v.id, lastLine).id); onSelect({ kind: 'e', id }) }}>Add a loop</button>
        <button className="btn btn-secondary" style={{ ...smallButton, color: '#e5484d' }} onClick={onDelete}>Delete vertex</button>
      </div>
    </>
  )
}

function DiagramPanel({ diagram, settings, setSettings, warn, steps, edit, preview }) {
  const counts = {}
  for (const e of diagram.edges) counts[e.step || 0] = (counts[e.step || 0] || 0) + 1
  return (
    <>
      <section style={section}>
        <div style={sectionTitle}>Diagram</div>
        <span style={smallLabel}>{diagram.vertices.length} vertices, {diagram.edges.length} lines{steps ? `, built in ${steps} step${steps === 1 ? '' : 's'}` : ''}.</span>
        {diagram.edges.length > 0 && (
          <div role="status" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 6, border: `1px solid ${warn.length ? 'rgba(245,165,36,0.6)' : 'var(--border, #333)'}`, background: 'var(--bg-hover, #252530)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 4, flex: 'none', background: warn.length ? '#f5a524' : '#22c55e' }} />
            <span>{warn.length
              ? `Fermion arrows don’t flow through ${warn.length} vertex${warn.length === 1 ? '' : 'es'} (circled). Reverse a line there, or leave it for an effective vertex.`
              : 'Fermion arrows flow through every vertex.'}</span>
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Line color
          <input type="color" value={settings.color} onChange={e => setSettings(s => ({ ...s, color: e.target.value }))}
            style={{ width: 28, height: 22, border: '1px solid var(--border, #333)', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }} />
        </label>
      </section>
      <section style={section}>
        <div style={sectionTitle}>Build steps</div>
        {steps > 0
          ? Array.from({ length: steps }, (_, i) => i + 1).map(n => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr)', gap: 6, alignItems: 'center' }}>
              <b style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: preview?.step === n ? 'var(--accent, #6366f1)' : 'var(--text-muted, #888)' }}>{n}</b>
              <input value={diagram.captions[n] || ''} aria-label={`Caption for step ${n}`} placeholder={`Caption (${counts[n] || 0} line${counts[n] === 1 ? '' : 's'})`}
                onChange={e => edit(d => { d.captions[n] = e.target.value }, 'caption:' + n)}
                style={{ ...inputStyle, borderColor: preview?.step === n ? 'var(--accent, #6366f1)' : undefined }} />
            </div>
          ))
          : <span style={smallLabel}>Every line shows from the start. Select a line and give it a step, or number the lines by time.</span>}
        <div style={row}>
          <button className="btn btn-secondary" style={smallButton} disabled={!diagram.edges.length} onClick={() => edit(stepsByTime)} title="Steps from left to right">Number by time</button>
          <button className="btn btn-secondary" style={smallButton} disabled={!steps} onClick={() => edit(d => { for (const e of d.edges) e.step = 0; for (const v of d.vertices) v.step = null })}>Clear steps</button>
        </div>
        {steps > 0 && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              First step at slide step
              <input type="number" min={1} max={1000} value={settings.stepStart}
                onChange={e => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= 1000) setSettings(s => ({ ...s, stepStart: n })) }}
                style={{ ...inputStyle, width: 60 }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.dimPast} onChange={e => setSettings(s => ({ ...s, dimPast: e.target.checked }))} style={{ accentColor: 'var(--accent)' }} />
              Fade earlier steps
            </label>
          </>
        )}
      </section>
    </>
  )
}

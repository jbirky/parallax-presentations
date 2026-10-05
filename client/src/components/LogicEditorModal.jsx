// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The logic diagram editor. Parts on the left; in the middle, the diagram on
// the slide's color with its signals as the slide starts; on the right,
// what's selected, or the diagram's checks, truth table and steps. A part
// tool places its part with a click; Wire draws from pin to pin (a drag that
// starts or ends on a wire makes a junction there); Select moves parts,
// junctions and a wire's upright, and a click on an input's box flips it.
// Preview build steps through the diagram as the presented slide will.

import { useState, useRef, useMemo, useLayoutEffect, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import { LOGIC_PARTS, LOGIC_TOOLS, LOGIC_GATES, logicModel, endpoints, snapTo } from '../utils/logicParts'
import { simulateLogic, everythingAtOnce, truthTable, rowOf } from '../utils/logicSim'
import {
  LOGIC_UNIT as UNIT, LOGIC_TEMPLATES, drawLogic, logicSvg, logicTikz, logicTableLatex, logicBounds, maxStep,
  addLogicPart, addLogicNode, logicWireAt, splitLogicWire, nearestEnd, removeLogic, pruneLogic,
} from '../utils/logicDiagram'
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
const plainTex = tex => texRuns(tex).map(r => r.t).join('')

// The window of the diagram the canvas shows, in cm, 5:3 like the canvas, room for the truth table kept
function fitView(d) {
  const b = logicBounds(d), tt = d.table ? truthTable(d) : null
  const extra = tt?.rows ? 1.2 + (tt.ins.length + tt.outs.length) * 0.62 : 0, pad = 1.1
  let w = Math.max(9, b.x1 - b.x0 + extra + 2 * pad), h = Math.max(5.4, b.y1 - b.y0 + 2 * pad)
  if (tt?.rows) h = Math.max(h, (tt.rows.length + 1) * 0.44 + 2 * pad)
  if (w / h > 5 / 3) h = w * 3 / 5; else w = h * 5 / 3
  const cx = (b.x0 + b.x1 + extra) / 2, cy = (b.y0 + b.y1) / 2
  return { x0: cx - w / 2, y0: cy - h / 2, w, h }
}
const findThing = (d, sel) => !sel ? null : sel.kind === 'p' ? d.parts.find(p => p.id === sel.id) : sel.kind === 'n' ? d.nodes.find(n => n.id === sel.id) : d.wires.find(w => w.id === sel.id)

// A part's picture, for the buttons
function miniPart(kind, style) {
  if (kind === 'wire') return '<svg viewBox="0 0 60 22" width="50" height="19" style="display:block"><path d="M4 16H24V6H56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  const u = 34, p = { id: 'm', kind, x: 0, y: 0, inputs: 2, label: '', value: 1, flips: [], step: 0 }
  const w = kind === 'dff' ? 2.2 : 1.8, h = kind === 'dff' ? 2 : 1.2
  const { svg } = drawLogic({ parts: [p], nodes: [], wires: [], captions: {} }, { U: u, ink: 'currentColor', style })
  return `<svg viewBox="${-w / 2 * u} ${-h / 2 * u} ${w * u} ${h * u}" width="50" height="22" style="display:block;overflow:visible">${svg}</svg>`
}
function Stepper({ value, onChange, label, name = stepName, min = 0, max = 1000 }) {
  const b = { width: 28, height: 26, border: 'none', background: 'none', color: 'var(--text-primary, #fff)', cursor: 'pointer', fontSize: 15 }
  return (
    <span role="group" aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border, #333)', borderRadius: 6, overflow: 'hidden', background: 'var(--bg-hover, #252530)' }}>
      <button type="button" style={b} aria-label="Earlier" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <output style={{ minWidth: 104, textAlign: 'center', fontSize: 12, lineHeight: '26px', borderInline: '1px solid var(--border, #333)', fontVariantNumeric: 'tabular-nums' }}>{name(value)}</output>
      <button type="button" style={b} aria-label="Later" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </span>
  )
}
function Segmented({ value, options, onChange, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'inline-flex', padding: 2, gap: 2, borderRadius: 6, border: '1px solid var(--border, #333)', background: 'var(--bg-hover, #252530)', flexWrap: 'wrap' }}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          style={{ border: 'none', borderRadius: 4, padding: '3px 9px', fontSize: 12, cursor: 'pointer', background: value === v ? 'var(--accent, #6366f1)' : 'transparent', color: value === v ? '#fff' : 'var(--text-secondary, #ccc)' }}>
          {text}
        </button>
      ))}
    </div>
  )
}

export default function LogicEditorModal({ initial, slideBg = '#1e1e2e', isNew, onSave, onClose }) {
  const start = useMemo(() => logicModel(initial), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [logic, setLogic] = useState(() => ({ parts: start.parts, nodes: start.nodes, wires: start.wires, captions: start.captions, table: start.table }))
  const [settings, setSettings] = useState({ color: start.color, symbols: start.symbols, values: start.values, stepStart: start.stepStart })
  const [sel, setSel] = useState(null)
  const [tool, setTool] = useState('select')
  const [view, setView] = useState(() => fitView(start))
  const [ghost, setGhost] = useState(null)
  const [preview, setPreview] = useState(null) // { step, animate, n }
  const [showTikz, setShowTikz] = useState(false)
  const [copied, setCopied] = useState('')
  const [, setHistoryTick] = useState(0)
  const past = useRef([]), future = useRef([]), typingKey = useRef(null), drag = useRef(null)
  const logicRef = useRef(logic)
  const svgRef = useRef(null), previewRef = useRef(null), dialogRef = useRef(null)
  const startJson = useRef(JSON.stringify({ logic, settings }))

  const ink = settings.color
  const mark = isDark(slideBg) ? '#6e7591' : '#a3a9bd'
  const steps = useMemo(() => maxStep(logic), [logic])
  const allSteps = useMemo(() => simulateLogic(logic, steps), [logic, steps])
  const atStart = useMemo(() => simulateLogic(everythingAtOnce(logic), 0)[0], [logic])
  const tt = useMemo(() => truthTable(logic), [logic])

  useEffect(() => { dialogRef.current?.focus({ preventScroll: true }) }, [])

  // Every change goes through here, so it can be undone; a key groups typing into one change
  const commit = useCallback((next, before, key = null) => {
    if (!key || key !== typingKey.current) {
      past.current.push(before)
      if (past.current.length > 300) past.current.shift()
      future.current = []
      setHistoryTick(t => t + 1)
    }
    typingKey.current = key
    logicRef.current = next
    setLogic(next)
  }, [])
  const edit = useCallback((fn, key = null) => {
    const before = JSON.stringify(logicRef.current)
    const next = JSON.parse(before)
    const out = fn(next)
    if (JSON.stringify(next) !== before) commit(next, before, key)
    return out
  }, [commit])
  const editSelected = useCallback((fn, key) => edit(d => { const o = findThing(d, sel); if (o) fn(o, d) }, key), [edit, sel])
  const restore = useCallback((json, into) => {
    into.current.push(JSON.stringify(logicRef.current))
    const d = JSON.parse(json)
    typingKey.current = null
    logicRef.current = d
    setLogic(d)
    setSel(s => (findThing(d, s) ? s : null))
    setHistoryTick(t => t + 1)
  }, [])
  const undo = useCallback(() => { if (past.current.length) restore(past.current.pop(), future) }, [restore])
  const redo = useCallback(() => { if (future.current.length) restore(future.current.pop(), past) }, [restore])

  // ---------- The canvas
  const markup = useMemo(() => drawLogic(ghost || logic, {
    ink, style: settings.symbols, values: settings.values, table: logic.table, labels: texHtml, editor: true, sel, grid: true, view, mark,
    accent: ACCENT, warnColor: '#f5a524', warn: atStart.floating,
  }).svg, [ghost, logic, ink, settings.symbols, settings.values, sel, view, mark, atStart])

  const world = ev => {
    const svg = svgRef.current, pt = svg.createSVGPoint()
    pt.x = ev.clientX; pt.y = ev.clientY
    const p = pt.matrixTransform(svg.getScreenCTM().inverse())
    return { x: p.x / UNIT, y: -p.y / UNIT }
  }
  // Where a wire starts or ends: a pin or junction, a junction on a wire, or a new junction
  const endOf = (d, p) => {
    const id = nearestEnd(d, p)
    if (id) return { id }
    const hit = logicWireAt(d, p)
    if (hit) return { hit }
    return { at: { x: snapTo(p.x), y: snapTo(p.y) } }
  }
  const pointOf = (d, e) => e.id ? endpoints(d).get(e.id) : e.hit ? e.hit.q : e.at
  const lay = (d, a, b) => {
    const from = a.id || (a.hit ? splitLogicWire(d, a.hit) : addLogicNode(d, a.at.x, a.at.y))
    const bHit = b.hit && (logicWireAt(d, b.hit.q, 0.02) || b.hit)
    const to = b.id || (bHit ? splitLogicWire(d, bHit) : addLogicNode(d, b.at.x, b.at.y))
    if (from === to) return null
    const w = { id: `w${d.wires.length + 1}`, from, to, mx: null, step: 0 }
    while (d.wires.some(x => x.id === w.id) || d.parts.some(x => x.id === w.id) || d.nodes.some(x => x.id === w.id)) w.id += 'x'
    d.wires.push(w)
    return w.id
  }

  const onPointerDown = ev => {
    if (ev.button > 0) return
    ev.preventDefault()
    dialogRef.current?.focus({ preventScroll: true })
    typingKey.current = null
    const p = world(ev), d = logicRef.current, t = ev.target
    try { svgRef.current.setPointerCapture(ev.pointerId) } catch { /* not every pointer can be captured */ }
    const before = JSON.stringify(d)
    if (tool === 'select') {
      const toggle = t.closest('[data-toggle]'), part = t.closest('[data-p]'), node = t.closest('[data-n]'), wire = t.closest('[data-w]'), handle = t.closest('[data-h]')
      if (handle) drag.current = { kind: 'upright', id: handle.dataset.h, before, work: JSON.parse(before) }
      else if (toggle || part) {
        const id = (toggle || part).dataset.toggle || (toggle || part).dataset.p, q = d.parts.find(x => x.id === id)
        setSel({ kind: 'p', id })
        drag.current = { kind: 'part', id, start: p, ox: q.x, oy: q.y, before, work: JSON.parse(before), toggle: !!toggle }
      } else if (node) {
        const n = d.nodes.find(x => x.id === node.dataset.n)
        setSel({ kind: 'n', id: n.id })
        drag.current = { kind: 'node', id: n.id, start: p, ox: n.x, oy: n.y, before, work: JSON.parse(before) }
      } else if (wire) setSel({ kind: 'w', id: wire.dataset.w })
      else setSel(null)
      return
    }
    if (tool === 'wire') { drag.current = { kind: 'wire', start: endOf(d, p), sp: p }; return }
    const id = edit(m => addLogicPart(m, tool, p.x, p.y).id)
    setSel({ kind: 'p', id })
  }

  const onPointerMove = ev => {
    const dr = drag.current
    if (!dr) return
    const p = world(ev)
    if (dr.kind === 'wire') {
      dr.moved = dr.moved || Math.hypot(p.x - dr.sp.x, p.y - dr.sp.y) > 0.15
      if (!dr.moved) return
      const m = clone(logicRef.current), end = endOf(logicRef.current, p)
      const a = pointOf(logicRef.current, dr.start), b = pointOf(logicRef.current, end)
      if (Math.hypot(a.x - b.x, a.y - b.y) > 0.01) lay(m, dr.start, end)
      setGhost(m)
      return
    }
    const w = dr.work
    if (dr.kind === 'part' || dr.kind === 'node') {
      const o = (dr.kind === 'part' ? w.parts : w.nodes).find(x => x.id === dr.id)
      const nx = snapTo(dr.ox + p.x - dr.start.x), ny = snapTo(dr.oy + p.y - dr.start.y)
      if (nx !== o.x || ny !== o.y) dr.moved = true
      o.x = nx; o.y = ny
    } else if (dr.kind === 'upright') {
      w.wires.find(x => x.id === dr.id).mx = snapTo(p.x)
      dr.moved = true
    } else return
    const next = { ...w }
    logicRef.current = next
    setLogic(next)
  }

  const onPointerUp = ev => {
    const dr = drag.current
    drag.current = null
    if (!dr) return
    if (dr.kind === 'wire') {
      setGhost(null)
      if (!dr.moved) return
      const end = endOf(logicRef.current, world(ev))
      const a = pointOf(logicRef.current, dr.start), b = pointOf(logicRef.current, end)
      if (Math.hypot(a.x - b.x, a.y - b.y) < 0.01 || (end.id && end.id === dr.start.id)) return
      const id = edit(d => lay(d, dr.start, end))
      if (id) setSel({ kind: 'w', id })
      return
    }
    // A click on an input's box flips its value
    if (dr.kind === 'part' && dr.toggle && !dr.moved) {
      const q = dr.work.parts.find(x => x.id === dr.id)
      if (q.kind === 'input') q.value = q.value ? 0 : 1
    }
    const w = { ...dr.work }
    if (JSON.stringify(w) !== dr.before) commit(w, dr.before)
    else { logicRef.current = w; setLogic(w) }
  }
  const onPointerCancel = () => {
    const dr = drag.current
    drag.current = null
    setGhost(null)
    if (dr?.before) { const d = JSON.parse(dr.before); logicRef.current = d; setLogic(d) }
  }

  const deleteSelected = () => {
    if (!sel) return
    edit(d => removeLogic(d, sel))
    setSel(null)
  }
  const loadTemplate = key => {
    const t = LOGIC_TEMPLATES.find(x => x.key === key)
    if (!t) return
    const d = t.build()
    commit(d, JSON.stringify(logicRef.current))
    setSel(null)
    setView(fitView(d))
  }

  // ---------- Preview build: the slide's drawing, stepped as it will be
  const previewSvg = useMemo(() => (preview ? logicSvg({ ...logic, ...settings }, { deck: 'editor', labels: texHtml }) : ''), [preview != null, logic, settings]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (preview && previewRef.current) applyDiagramStep(previewRef.current, preview.step, preview.animate, false)
  }, [preview, previewSvg])
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
    if (k === 'w') { setTool('wire'); return }
    const t = LOGIC_TOOLS.find(x => LOGIC_PARTS[x]?.key === k)
    if (t) setTool(t)
  }

  // ---------- Saving
  const result = () => ({ ...logic, captions: Object.fromEntries(Object.entries(logic.captions).filter(([, v]) => v && v.trim())), ...settings })
  const tikz = useMemo(() => logicTikz({ ...logic, ...settings }), [logic, settings])
  const save = () => onSave(result())
  const cancel = () => {
    if (JSON.stringify({ logic, settings }) !== startJson.current && !confirm('Discard your changes to this diagram?')) return
    onClose()
  }
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1500) }
    catch (err) { alert('Couldn’t copy: ' + err.message) }
  }

  const rail = useMemo(() => Object.fromEntries(LOGIC_TOOLS.map(t => [t, miniPart(t, settings.symbols)])), [settings.symbols])
  const selected = findThing(logic, sel)
  const hint = preview
    ? '→ or Space goes to the next step, ← goes back, Esc returns to editing.'
    : tool === 'select' ? (sel ? 'Drag to move. Click an input’s box to flip it. Delete removes the selection.' : 'Click a part to edit it, an input’s box to flip it, or pick a part to place.')
      : tool === 'wire' ? 'Drag from a pin to a pin. Start or end on a wire for a junction there.'
        : `Click to place ${/^[AEIOU]/.test(LOGIC_PARTS[tool].name) ? 'an' : 'a'} ${LOGIC_PARTS[tool].name}.`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{DIAGRAM_CSS}</style>
      <div ref={dialogRef} role="dialog" aria-label="Logic diagram" tabIndex={-1} onKeyDown={onKeyDown}
        style={{ background: 'var(--bg-card, #1e1e2e)', borderRadius: 12, width: 'min(1320px, 96vw)', height: 'min(860px, 94vh)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border, #333)', overflow: 'hidden', outline: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', borderBottom: '1px solid var(--border, #333)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary, #fff)' }}>Logic diagram</span>
          <span role="status" style={{ ...smallLabel, fontSize: 12, flex: '1 1 260px', minWidth: 0 }}>{hint}</span>
          <div style={row}>
            <select aria-label="Start from a template" value="" disabled={!!preview} onChange={e => loadTemplate(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="" disabled>Start from…</option>
              {LOGIC_TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
            <button className="btn btn-secondary" style={smallButton} disabled={!!preview || !past.current.length} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
            <button className="btn btn-secondary" style={smallButton} disabled={!!preview || !future.current.length} onClick={redo} title="Redo (Ctrl+Shift+Z)">Redo</button>
            <button className="btn btn-secondary" style={smallButton} disabled={!!preview} onClick={() => setView(fitView(logic))} title="Fit the view to the diagram">Fit</button>
            {preview
              ? <button className="btn btn-primary" style={smallButton} onClick={() => setPreview(null)}>Back to editing</button>
              : <button className="btn btn-primary" style={smallButton} onClick={startPreview} disabled={!logic.parts.length}>Preview build</button>}
          </div>
          <a href="/#docs/tutorials/logic-diagrams" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>How to use</a>
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
            {LOGIC_TOOLS.map(t => {
              const K = LOGIC_PARTS[t] || { name: 'Wire', key: 'w' }
              return (
                <button key={t} type="button" aria-pressed={tool === t} onClick={() => setTool(t)} title={`${K.name}${K.key ? ` (${K.key.toUpperCase()})` : ''}`}
                  style={{ display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, padding: '7px 2px 6px', borderRadius: 6, fontSize: 10.5, lineHeight: 1.2, cursor: 'pointer', color: 'var(--text-primary, #fff)', textAlign: 'center', border: `1px solid ${tool === t ? 'var(--accent, #6366f1)' : 'transparent'}`, background: tool === t ? 'rgba(99,102,241,0.18)' : 'none' }}>
                  <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: rail[t] }} />
                  {K.name}
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
                {!steps && <span style={smallLabel}>Nothing changes yet. Have an input flip at a step, add a clock, or give a part a step.</span>}
              </div>
            )}
            {showTikz && (
              <pre style={{ margin: 0, maxHeight: 200, overflow: 'auto', padding: '10px 12px', borderRadius: 6, background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', fontSize: 11.5, lineHeight: 1.55, color: 'var(--text-primary, #fff)', fontFamily: "'Fira Code','JetBrains Mono',monospace" }}>{tikz}</pre>
            )}
          </div>

          {/* What's selected, or the diagram */}
          <div style={{ width: 280, flex: 'none', borderLeft: '1px solid var(--border, #333)', overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18, fontSize: 12, color: 'var(--text-secondary, #ccc)' }}>
            {selected && sel.kind === 'p' && <PartPanel p={selected} editSelected={editSelected} onDelete={deleteSelected} />}
            {selected && sel.kind === 'w' && (
              <>
                <section style={section}>
                  <div style={sectionTitle}>Wire</div>
                  <span style={smallLabel}>From {selected.from} to {selected.to}.</span>
                  {selected.mx != null && <div><button className="btn btn-secondary" style={smallButton} onClick={() => editSelected(o => { o.mx = null })}>Center its upright</button></div>}
                </section>
                <section style={section}><div style={sectionTitle}>Appears</div><Stepper label="Step" value={selected.step || 0} onChange={n => editSelected(o => { o.step = n })} /></section>
                <div><button className="btn btn-secondary" style={{ ...smallButton, color: '#e5484d' }} onClick={deleteSelected}>Delete wire</button></div>
              </>
            )}
            {selected && sel.kind === 'n' && (
              <>
                <section style={section}><div style={sectionTitle}>Junction</div><span style={smallLabel}>Where wires meet. Drag it to move them.</span></section>
                <div><button className="btn btn-secondary" style={{ ...smallButton, color: '#e5484d' }} onClick={deleteSelected}>Delete junction</button></div>
              </>
            )}
            {!selected && (
              <DiagramPanel logic={logic} settings={settings} setSettings={setSettings} edit={edit} preview={preview} steps={steps}
                allSteps={allSteps} atStart={atStart} tt={tt} onCopyTable={() => copy(logicTableLatex(logic), 'table')} copied={copied} />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderTop: '1px solid var(--border, #333)' }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setShowTikz(v => !v)} aria-pressed={showTikz}>{showTikz ? 'Hide CircuiTikZ' : 'Show CircuiTikZ'}</button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => copy(tikz, 'tikz')} disabled={!logic.parts.length}>{copied === 'tikz' ? 'Copied' : 'Copy CircuiTikZ'}</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={cancel}>Cancel</button>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={save} disabled={!logic.parts.length}>{isNew ? 'Insert' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

function PartPanel({ p, editSelected, onDelete }) {
  const K = LOGIC_PARTS[p.kind]
  const [flipsText, setFlipsText] = useState((p.flips || []).join(', '))
  useEffect(() => { setFlipsText((p.flips || []).join(', ')) }, [p.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const setInputs = n => editSelected((o, d) => { o.inputs = n; pruneLogic(d) })
  return (
    <>
      <section style={section}>
        <div style={sectionTitle}>{K.name}</div>
        {K.gate && (
          <label style={{ display: 'grid', gap: 4 }}>
            <span>Gate</span>
            <select value={p.kind} onChange={ev => editSelected((o, d) => { o.kind = ev.target.value; if (LOGIC_PARTS[o.kind].multi) o.inputs = o.inputs || 2; else delete o.inputs; pruneLogic(d) })} style={inputStyle}>
              {LOGIC_GATES.map(k => <option key={k} value={k}>{LOGIC_PARTS[k].name}</option>)}
            </select>
          </label>
        )}
        {K.multi && (
          <div style={row}><span>Inputs</span><Segmented label="Inputs" value={p.inputs || 2} onChange={setInputs} options={[[2, '2'], [3, '3'], [4, '4']]} /></div>
        )}
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Label</span>
          <input value={p.label} placeholder="TeX, like A or \overline{Q}" spellCheck={false} onChange={ev => editSelected(o => { o.label = ev.target.value }, 'label:' + p.id)} style={texInput} />
        </label>
      </section>
      {p.kind === 'input' && (
        <section style={section}>
          <div style={sectionTitle}>Value</div>
          <div style={row}><span>Starts at</span><Segmented label="Starts at" value={p.value ? 1 : 0} onChange={v => editSelected(o => { o.value = v })} options={[[0, '0'], [1, '1']]} /></div>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>Flips at steps</span>
            <input value={flipsText} placeholder="like 1, 3" spellCheck={false}
              onChange={ev => {
                setFlipsText(ev.target.value)
                const flips = [...new Set(ev.target.value.split(/[^0-9]+/).filter(Boolean).map(Number).filter(n => n >= 1 && n <= 1000))].sort((a, b) => a - b)
                editSelected(o => { o.flips = flips }, 'flips:' + p.id)
              }} style={inputStyle} />
          </label>
        </section>
      )}
      {p.kind === 'clock' && (
        <section style={section}>
          <div style={sectionTitle}>Ticks</div>
          <div style={row}><span>First high at</span><Stepper label="First high" value={p.start ?? 1} min={1} name={n => `Step ${n}`} onChange={n => editSelected(o => { o.start = n; if (o.end < n) o.end = n })} /></div>
          <div style={row}><span>Stops after</span><Stepper label="Stops after" value={p.end ?? 8} min={p.start ?? 1} name={n => `Step ${n}`} onChange={n => editSelected(o => { o.end = n })} /></div>
        </section>
      )}
      <section style={section}><div style={sectionTitle}>Appears</div><Stepper label="Step" value={p.step || 0} onChange={n => editSelected(o => { o.step = n })} /></section>
      <div><button className="btn btn-secondary" style={{ ...smallButton, color: '#e5484d' }} onClick={onDelete}>Delete {K.name.toLowerCase()}</button></div>
    </>
  )
}

function DiagramPanel({ logic, settings, setSettings, edit, preview, steps, allSteps, atStart, tt, onCopyTable, copied }) {
  const set = patch => setSettings(s => ({ ...s, ...patch }))
  const problems = []
  if (atStart.floating.length) problems.push(`${atStart.floating.length} input${atStart.floating.length === 1 ? '' : 's'} connected to nothing (circled)`)
  if (allSteps.some(s => s.conflicts)) problems.push('a wire driven by outputs that disagree')
  if (allSteps.some(s => s.oscillates)) problems.push('a loop that never settles')
  const shown = preview ? allSteps[preview.step] : atStart
  const now = rowOf(tt, shown)
  const head = p => plainTex(p.label || p.id)
  return (
    <>
      <section style={section}>
        <div style={sectionTitle}>Diagram</div>
        <span style={smallLabel}>{logic.parts.length} part{logic.parts.length === 1 ? '' : 's'}, {logic.wires.length} wire{logic.wires.length === 1 ? '' : 's'}{steps ? `, ${steps} step${steps === 1 ? '' : 's'}` : ''}.</span>
        {logic.parts.length > 0 && (
          <div role="status" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 6, border: `1px solid ${problems.length ? 'rgba(245,165,36,0.6)' : 'var(--border, #333)'}`, background: 'var(--bg-hover, #252530)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 4, flex: 'none', background: problems.length ? '#f5a524' : '#22c55e' }} />
            <span>{problems.length ? problems.join('; ').replace(/^./, c => c.toUpperCase()) + '.' : 'Every input is driven, and the diagram settles at every step.'}</span>
          </div>
        )}
      </section>
      <section style={section}>
        <div style={sectionTitle}>Truth table</div>
        {tt.rows ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontFamily: "'Fira Code','JetBrains Mono',monospace", fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                <thead><tr>{[...tt.ins, ...tt.outs].map((p, i) => <th key={p.id} style={{ padding: '2px 8px', fontFamily: "'Latin Modern Roman', serif", fontStyle: 'italic', fontWeight: 400, fontSize: 13, color: 'var(--text-primary, #fff)', borderLeft: i === tt.ins.length ? '1px solid var(--border-light, #444)' : undefined, borderBottom: '1px solid var(--border, #333)' }}>{head(p)}</th>)}</tr></thead>
                <tbody>{tt.rows.map((r, ri) => (
                  <tr key={ri} style={ri === now ? { background: 'rgba(99,102,241,0.22)', fontWeight: 600, color: 'var(--text-primary, #fff)' } : undefined}>
                    {r.map((v, c) => <td key={c} style={{ padding: '2px 8px', textAlign: 'center', borderLeft: c === tt.ins.length ? '1px solid var(--border-light, #444)' : undefined }}>{v == null ? '?' : v}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <label style={check}><input type="checkbox" checked={!!logic.table} onChange={e => edit(d => { d.table = e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Show it on the slide</label>
            <div><button className="btn btn-secondary" style={smallButton} onClick={onCopyTable}>{copied === 'table' ? 'Copied' : 'Copy as LaTeX'}</button></div>
          </>
        ) : <span style={smallLabel}>{tt.why}</span>}
      </section>
      <section style={section}>
        <div style={sectionTitle}>Drawing</div>
        <Segmented label="Symbols" value={settings.symbols} onChange={v => set({ symbols: v })} options={[['us', 'US symbols'], ['iec', 'IEC symbols']]} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Line color
          <input type="color" value={settings.color} onChange={e => set({ color: e.target.value })}
            style={{ width: 28, height: 22, border: '1px solid var(--border, #333)', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }} />
        </label>
        <label style={check}><input type="checkbox" checked={settings.values} onChange={e => set({ values: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Color wires by signal</label>
      </section>
      <section style={section}>
        <div style={sectionTitle}>Steps</div>
        {steps > 0
          ? Array.from({ length: steps + 1 }, (_, i) => i).map(n => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr)', gap: 6, alignItems: 'center' }}>
              <b style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: preview?.step === n ? 'var(--accent, #6366f1)' : 'var(--text-muted, #888)' }}>{n}</b>
              <input value={logic.captions[n] || ''} aria-label={`Caption for step ${n}`} placeholder={`Caption for step ${n}`}
                onChange={e => edit(d => { d.captions[n] = e.target.value }, 'caption:' + n)}
                style={{ ...inputStyle, borderColor: preview?.step === n ? 'var(--accent, #6366f1)' : undefined }} />
            </div>
          ))
          : <span style={smallLabel}>Nothing changes yet. Have an input flip at a step, add a clock, or give a part a step.</span>}
        {steps > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            First step at slide step
            <input type="number" min={1} max={1000} value={settings.stepStart}
              onChange={e => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= 1000) set({ stepStart: n }) }}
              style={{ ...inputStyle, width: 60 }} />
          </label>
        )}
      </section>
    </>
  )
}

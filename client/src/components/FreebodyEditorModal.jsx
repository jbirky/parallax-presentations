// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The free-body diagram editor. Forces on the left; in the middle, the
// diagram on the slide's color; on the right, what the forces add up to, then
// the selected force, or the body, its surroundings and its motion. A force
// button (or its key) adds that force in its usual direction; a drag out of
// the body draws an applied force; a drag on an arrow turns it (and sizes it,
// if its value is given). Preview build steps through the diagram as the
// presented slide will.

import { useState, useRef, useMemo, useLayoutEffect, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import { FORCE_KINDS, FORCE_KIND_ORDER, FORCE_COLORS, freebodyModel, solveFreebody, netDirection, readNumber, len } from '../utils/freebodySolve'
import { FREEBODY_UNIT as UNIT, FREEBODY_TEMPLATES, drawFreebody, freebodySvg, freebodyTikz, maxStep, addForce, aimForce, compLabel, sig3 } from '../utils/freebodyDiagram'
import { DIAGRAM_CSS, applyDiagramStep } from '../utils/diagramCore'
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
const chip = { fontSize: 11.5, padding: '1px 8px', borderRadius: 999, border: '1px solid var(--border, #333)', background: 'var(--bg-hover, #252530)', color: 'var(--text-primary, #fff)', cursor: 'pointer' }

const stepName = n => (n === 0 ? 'From the start' : `Step ${n}`)
const Tex = ({ tex }) => <span dangerouslySetInnerHTML={{ __html: texHtml(tex) }} />

// The window of the diagram the canvas shows, in px, 5:3 like the canvas
function fitView(box) {
  const pad = 0.9 * UNIT
  let w = Math.max(9 * UNIT, box.x1 - box.x0 + 2 * pad), h = Math.max(5.4 * UNIT, box.y1 - box.y0 + 2 * pad)
  if (w / h > 5 / 3) h = w * 3 / 5; else w = h * 5 / 3
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}
// A force's arrow, for the buttons
function miniForce(kind) {
  const a = { weight: -90, normal: 90, friction: 180, tension: 50, applied: 0, drag: 90, spring: 180, custom: 35 }[kind] * Math.PI / 180
  const ux = Math.cos(a), uy = -Math.sin(a), t = [15 + ux * 11, 12 + uy * 9]
  const h1 = [t[0] - ux * 4 - uy * 3, t[1] - uy * 4 + ux * 3], h2 = [t[0] - ux * 4 + uy * 3, t[1] - uy * 4 - ux * 3]
  const f = v => Math.round(v * 10) / 10
  return `<svg viewBox="0 0 30 24" width="30" height="22" style="display:block;overflow:visible"><rect x="9" y="7" width="12" height="10" rx="1" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-opacity=".5"/><path d="M15 12L${f(t[0])} ${f(t[1])}" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M${f(t[0] + ux * 1.5)} ${f(t[1] + uy * 1.5)}L${f(h1[0])} ${f(h1[1])}L${f(h2[0])} ${f(h2[1])}Z" fill="currentColor"/></svg>`
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

export default function FreebodyEditorModal({ initial, slideBg = '#1e1e2e', isNew, onSave, onClose }) {
  const [d, setD] = useState(() => freebodyModel(initial))
  const [sel, setSel] = useState(null)
  const [frozen, setFrozen] = useState(null)
  const [preview, setPreview] = useState(null) // { step, animate, n }
  const [showTikz, setShowTikz] = useState(false)
  const [copied, setCopied] = useState('')
  const [, setHistoryTick] = useState(0)
  const past = useRef([]), future = useRef([]), typingKey = useRef(null), drag = useRef(null)
  const dRef = useRef(d)
  const svgRef = useRef(null), previewRef = useRef(null), dialogRef = useRef(null)
  const startJson = useRef(JSON.stringify(d))

  const sol = useMemo(() => solveFreebody(d), [d])
  const steps = useMemo(() => maxStep(d), [d])

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
    dRef.current = next
    setD(next)
  }, [])
  const edit = useCallback((fn, key = null) => {
    const before = JSON.stringify(dRef.current)
    const next = JSON.parse(before)
    const out = fn(next)
    if (JSON.stringify(next) !== before) commit(next, before, key)
    return out
  }, [commit])
  const editSelected = useCallback((fn, key) => edit(m => { const f = m.forces.find(x => x.id === sel); if (f) fn(f, m) }, key), [edit, sel])
  const restore = useCallback((json, into) => {
    into.current.push(JSON.stringify(dRef.current))
    const m = JSON.parse(json)
    typingKey.current = null
    dRef.current = m
    setD(m)
    setSel(s => (m.forces.some(f => f.id === s) ? s : null))
    setHistoryTick(t => t + 1)
  }, [])
  const undo = useCallback(() => { if (past.current.length) restore(past.current.pop(), future) }, [restore])
  const redo = useCallback(() => { if (future.current.length) restore(future.current.pop(), past) }, [restore])

  // ---------- The canvas
  const drawn = useMemo(() => drawFreebody(d, { ink: d.color, labels: texHtml, editor: true, sel, accent: ACCENT, bg: slideBg, sol }), [d, sel, slideBg, sol])
  const view = frozen || fitView(drawn.box)

  const world = ev => {
    const svg = svgRef.current, pt = svg.createSVGPoint()
    pt.x = ev.clientX; pt.y = ev.clientY
    const p = pt.matrixTransform(svg.getScreenCTM().inverse())
    return [p.x / UNIT, -p.y / UNIT]
  }
  const onPointerDown = ev => {
    if (ev.button > 0) return
    ev.preventDefault()
    dialogRef.current?.focus({ preventScroll: true })
    typingKey.current = null
    const t = ev.target, hit = t.closest('[data-h], [data-f]'), body = t.closest('[data-body]')
    const before = JSON.stringify(dRef.current)
    if (hit || body) {
      try { svgRef.current.setPointerCapture(ev.pointerId) } catch { /* not every pointer can be captured */ }
      setFrozen(view)
    }
    if (hit) {
      const id = hit.dataset.h || hit.dataset.f
      setSel(id)
      drag.current = { kind: 'aim', id, start: world(ev), before, work: JSON.parse(before), moved: false }
    } else if (body) {
      drag.current = { kind: 'draw', id: null, start: world(ev), before, work: JSON.parse(before), moved: false }
    } else setSel(null)
  }
  const onPointerMove = ev => {
    const dr = drag.current
    if (!dr) return
    const p = world(ev)
    if (!dr.moved && Math.hypot(p[0] - dr.start[0], p[1] - dr.start[1]) < (dr.kind === 'draw' ? 0.3 : 0.12)) return
    dr.moved = true
    if (dr.kind === 'draw' && !dr.id) { dr.id = addForce(dr.work, 'applied', { mag: '10' }).id; setSel(dr.id) }
    const f = dr.work.forces.find(x => x.id === dr.id)
    if (!f) return
    aimForce(dr.work, f, p, solveFreebody(dr.work), ev.altKey)
    const next = JSON.parse(JSON.stringify(dr.work))
    dRef.current = next
    setD(next)
  }
  const onPointerUp = () => {
    const dr = drag.current
    drag.current = null
    setFrozen(null)
    if (!dr) return
    if (dr.moved && JSON.stringify(dr.work) !== dr.before) commit(JSON.parse(JSON.stringify(dr.work)), dr.before)
  }
  const onPointerCancel = () => {
    const dr = drag.current
    drag.current = null
    setFrozen(null)
    if (dr?.before) { const m = JSON.parse(dr.before); dRef.current = m; setD(m) }
  }

  const add = kind => { const id = edit(m => addForce(m, kind).id); setSel(id) }
  const deleteSelected = () => {
    if (!sel) return
    edit(m => { m.forces = m.forces.filter(f => f.id !== sel) })
    setSel(null)
  }
  const loadTemplate = key => {
    const t = FREEBODY_TEMPLATES.find(x => x.key === key)
    if (!t) return
    const m = freebodyModel({ ...t.build(), color: dRef.current.color, stepStart: dRef.current.stepStart, dimPast: dRef.current.dimPast })
    commit(m, JSON.stringify(dRef.current))
    setSel(null)
  }

  // ---------- Preview build: the slide's drawing, stepped as it will be
  const previewSvg = useMemo(() => (preview ? freebodySvg(d, { deck: 'editor', labels: texHtml }) : ''), [preview != null, d]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (preview && previewRef.current) applyDiagramStep(previewRef.current, preview.step, preview.animate, d.dimPast)
  }, [preview, previewSvg, d.dimPast])
  const startPreview = () => { setSel(null); setPreview({ step: 0, animate: false, n: 0 }) }
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
    // Text fields undo their own typing; a slider, box or menu undoes the diagram
    const textEntry = ev.target.closest?.('textarea, input:not([type=range]):not([type=checkbox]):not([type=color])')
    const mod = ev.metaKey || ev.ctrlKey, k = ev.key.toLowerCase()
    if (mod && (k === 'z' || k === 'y')) {
      if (textEntry || preview) return
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
    if (ev.key === 'Escape') { setSel(null); return }
    const kind = FORCE_KIND_ORDER.find(x => FORCE_KINDS[x].key === k)
    if (kind) { ev.preventDefault(); add(kind) }
  }

  // ---------- Saving
  const tikz = useMemo(() => freebodyTikz(d), [d])
  const save = () => onSave(freebodyModel(d))
  const cancel = () => {
    if (JSON.stringify(d) !== startJson.current && !confirm('Discard your changes to this diagram?')) return
    onClose()
  }
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1500) }
    catch (err) { alert('Couldn’t copy: ' + err.message) }
  }

  const rail = useMemo(() => Object.fromEntries(FORCE_KIND_ORDER.map(k => [k, miniForce(k)])), [])
  const selected = d.forces.find(f => f.id === sel) || null
  const hint = preview
    ? '→ or Space goes to the next step, ← goes back, Esc returns to editing.'
    : selected ? 'Drag the arrow to turn it; for a given value the drag sets its size too. Delete removes it.'
      : 'Click a force on the left (or press its key) to add it, or drag out from the body to draw one.'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{DIAGRAM_CSS}</style>
      <div ref={dialogRef} role="dialog" aria-label="Free-body diagram" tabIndex={-1} onKeyDown={onKeyDown}
        style={{ background: 'var(--bg-card, #1e1e2e)', borderRadius: 12, width: 'min(1320px, 96vw)', height: 'min(860px, 94vh)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border, #333)', overflow: 'hidden', outline: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', borderBottom: '1px solid var(--border, #333)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary, #fff)' }}>Free-body diagram</span>
          <span role="status" style={{ ...smallLabel, fontSize: 12, flex: '1 1 260px', minWidth: 0 }}>{hint}</span>
          <div style={row}>
            <select aria-label="Start from a template" value="" disabled={!!preview} onChange={e => loadTemplate(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="" disabled>Start from…</option>
              {FREEBODY_TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
            <button className="btn btn-secondary" style={smallButton} disabled={!!preview || !past.current.length} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
            <button className="btn btn-secondary" style={smallButton} disabled={!!preview || !future.current.length} onClick={redo} title="Redo (Ctrl+Shift+Z)">Redo</button>
            {preview
              ? <button className="btn btn-primary" style={smallButton} onClick={() => setPreview(null)}>Back to editing</button>
              : <button className="btn btn-primary" style={smallButton} onClick={startPreview} disabled={!d.forces.length}>Preview build</button>}
          </div>
          <a href="/#docs/tutorials/free-body-diagrams" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>How to use</a>
          <button onClick={cancel} aria-label="Close" style={iconButton}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Forces */}
          <div role="toolbar" aria-label="Forces" style={{ width: 140, flex: 'none', borderRight: '1px solid var(--border, #333)', padding: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, alignContent: 'start', overflowY: 'auto', opacity: preview ? 0.4 : 1, pointerEvents: preview ? 'none' : undefined }}>
            <div style={{ ...sectionTitle, gridColumn: '1 / -1', fontSize: 10.5, margin: '0 2px 2px' }}>Add a force</div>
            {FORCE_KIND_ORDER.map(k => (
              <button key={k} type="button" onClick={() => add(k)} title={`${FORCE_KINDS[k].name} (${FORCE_KINDS[k].key.toUpperCase()})`}
                style={{ display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 3, padding: '7px 2px 6px', borderRadius: 6, fontSize: 10.5, lineHeight: 1.2, cursor: 'pointer', color: 'var(--text-primary, #fff)', textAlign: 'center', border: '1px solid transparent', background: 'none' }}>
                <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: rail[k] }} />
                <span>{FORCE_KINDS[k].name} <span style={{ ...smallLabel, fontSize: 9.5 }}>{FORCE_KINDS[k].key.toUpperCase()}</span></span>
              </button>
            ))}
            <p style={{ ...smallLabel, gridColumn: '1 / -1', margin: '6px 2px 0', lineHeight: 1.4 }}>Or drag out from the body to draw an applied force.</p>
          </div>

          {/* The diagram */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 14, gap: 10 }}>
            <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 6, overflow: 'hidden', background: slideBg, boxShadow: '0 0 0 1px var(--border, #333)' }}>
              {preview
                ? <div ref={previewRef} style={{ position: 'absolute', inset: '6%' }} dangerouslySetInnerHTML={{ __html: previewSvg }} />
                : <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', userSelect: 'none' }}
                    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
                    dangerouslySetInnerHTML={{ __html: drawn.svg }} />}
            </div>
            {preview && (
              <div style={{ ...row, fontSize: 12.5, color: 'var(--text-secondary, #ccc)' }}>
                <button className="btn btn-secondary" style={smallButton} onClick={() => goStep(-1)} disabled={preview.step <= 0} aria-label="Previous step">◀</button>
                <span style={{ minWidth: 92, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>Step {preview.step} of {steps}</span>
                <button className="btn btn-secondary" style={smallButton} onClick={() => goStep(1)} disabled={preview.step >= steps} aria-label="Next step">▶</button>
                <button className="btn btn-secondary" style={smallButton} onClick={replay}>Replay</button>
                {!steps && <span style={smallLabel}>Everything appears at once. Give forces steps to build it up.</span>}
              </div>
            )}
            {showTikz && (
              <pre style={{ margin: 0, maxHeight: 200, overflow: 'auto', padding: '10px 12px', borderRadius: 6, background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', fontSize: 11.5, lineHeight: 1.55, color: 'var(--text-primary, #fff)', fontFamily: "'Fira Code','JetBrains Mono',monospace" }}>{tikz}</pre>
            )}
          </div>

          {/* What it adds up to, then what's selected or the diagram */}
          <div style={{ width: 290, flex: 'none', borderLeft: '1px solid var(--border, #333)', overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18, fontSize: 12, color: 'var(--text-secondary, #ccc)' }}>
            <Readout d={d} sol={sol} />
            {selected
              ? <ForcePanel key={selected.id} f={selected} d={d} editSelected={editSelected} onDelete={deleteSelected} onDone={() => setSel(null)} />
              : <DiagramPanel d={d} edit={edit} steps={steps} preview={preview} />}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderTop: '1px solid var(--border, #333)' }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setShowTikz(v => !v)} aria-pressed={showTikz}>{showTikz ? 'Hide TikZ' : 'Show TikZ'}</button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => copy(tikz, 'tikz')}>{copied === 'tikz' ? 'Copied' : 'Copy TikZ'}</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={cancel}>Cancel</button>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={save}>{isNew ? 'Insert' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

// A note, with its labels in KaTeX where it has {0}, {1}
function Note({ note }) {
  const parts = note.text.split(/\{(\d)\}/)
  return <p style={{ margin: 0, color: '#f5a524', lineHeight: 1.45 }}>{parts.map((p, i) => (i % 2 ? <Tex key={i} tex={note.labels[+p] || ''} /> : p))}</p>
}
const HOW = { given: 'given', solve: 'worked out', mass: <Tex tex="mg" />, mu: <Tex tex="\mu F_N" />, none: 'no value' }

// What the forces add up to: each magnitude and where it came from, ΣF, a, and any warnings
function Readout({ d, sol }) {
  const netMag = len(sol.net), mass = readNumber(d.body.mass)
  const anyValue = d.forces.some(f => sol.mag[f.id] != null)
  let tone = 'ok', text
  if (!d.forces.length) { tone = 'idle'; text = 'No forces yet.' }
  else if (!anyValue) { tone = 'warn'; text = 'No force has a value yet.' }
  else if (sol.status === 'unsolved') { tone = 'warn'; text = 'The unknowns can’t be worked out as they are.' }
  else if (netMag < 0.01) text = <><Tex tex="\Sigma F = 0" />{d.motion === 'free' ? ': no acceleration' : ', in equilibrium'}</>
  else {
    const a = sol.acc ? len(sol.acc) : null
    tone = d.motion === 'rest' ? 'warn' : 'moving'
    text = <><Tex tex={`\\Sigma F = ${sig3(netMag)}\\,\\text{N}`} /> {netDirection(d, sol.net)}{a != null && a > 1e-6 ? <>, so <Tex tex={`a = ${sig3(a)}\\,\\text{m/s}^2`} /></> : mass == null ? '. Give it a mass to find a.' : ''}</>
  }
  const dot = { ok: '#22c55e', moving: ACCENT, warn: '#f5a524', idle: 'var(--text-muted, #888)' }[tone]
  return (
    <section style={section}>
      <div style={sectionTitle}>The forces add up to</div>
      <div role="status" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 6, border: `1px solid ${tone === 'warn' ? 'rgba(245,165,36,0.6)' : 'var(--border, #333)'}`, background: 'var(--bg-hover, #252530)', color: 'var(--text-primary, #fff)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flex: 'none', background: dot }} />
        <span>{text}</span>
      </div>
      {d.forces.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
          <tbody>{d.forces.map(f => (
            <tr key={f.id} style={{ borderBottom: '1px solid var(--border, #333)' }}>
              <td style={{ padding: '3px 6px 3px 0', color: 'var(--text-primary, #fff)' }}><Tex tex={f.label} /></td>
              <td style={{ padding: '3px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>{sol.mag[f.id] == null ? '—' : `${sig3(Math.abs(sol.mag[f.id]))} N`}</td>
              <td style={{ padding: '3px 0', textAlign: 'right', ...smallLabel }}>{HOW[sol.how[f.id]]}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {sol.notes.map((n, i) => <Note key={i} note={n} />)}
    </section>
  )
}

function ForcePanel({ f, d, editSelected, onDelete, onDone }) {
  const K = FORCE_KINDS[f.kind]
  const modes = [['given', 'Given'], ['solve', 'Worked out']]
  if (f.kind === 'weight') modes.push(['mass', 'From the mass, mg'])
  if (f.kind === 'friction') modes.push(['mu', 'μ × the normal force'])
  const set = (patch, key) => editSelected(o => { Object.assign(o, patch) }, key)
  const pushable = d.model === 'extended' && !['weight', 'normal', 'friction'].includes(f.kind)
  return (
    <>
      <section style={section}>
        <div style={sectionTitle}>{K.name}</div>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Label</span>
          <input value={f.label} placeholder="TeX, like F_N" spellCheck={false} onChange={e => set({ label: e.target.value }, 'label:' + f.id)} style={texInput} />
        </label>
        <div style={row}>{K.chips.map(c => <button key={c} type="button" style={chip} onClick={() => set({ label: c })}><Tex tex={c} /></button>)}</div>
      </section>
      <section style={section}>
        <div style={sectionTitle}>Magnitude</div>
        <select value={f.magMode} onChange={e => editSelected(o => { o.magMode = e.target.value; if (o.magMode === 'given' && !o.mag) o.mag = '10' })} style={inputStyle} aria-label="Magnitude">
          {modes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        {f.magMode === 'given' && (
          <div style={row}><input value={f.mag} inputMode="decimal" aria-label="Magnitude in newtons" onChange={e => set({ mag: e.target.value }, 'mag:' + f.id)} style={{ ...inputStyle, width: 90 }} /><span style={smallLabel}>N</span></div>
        )}
        {f.magMode === 'mu' && (
          <div style={row}><span style={smallLabel}>μ =</span><input value={f.mu} inputMode="decimal" aria-label="Coefficient of friction" onChange={e => set({ mu: e.target.value }, 'mu:' + f.id)} style={{ ...inputStyle, width: 70 }} /></div>
        )}
      </section>
      <section style={section}>
        <div style={sectionTitle}>Direction</div>
        <div style={row}>
          <select value={f.dir.from} onChange={e => editSelected(o => { o.dir.from = e.target.value })} style={{ ...inputStyle, flex: '1 1 120px', width: 'auto' }} aria-label="Measured from">
            <option value="level">From horizontal</option>
            <option value="surface">From the surface</option>
          </select>
          <input type="number" step={5} value={f.dir.deg} aria-label="Angle in degrees"
            onChange={e => { const v = Number(e.target.value); if (isFinite(v)) editSelected(o => { o.dir.deg = Math.max(-360, Math.min(360, v)) }, 'deg:' + f.id) }}
            style={{ ...inputStyle, width: 70 }} />
          <span style={smallLabel}>°</span>
        </div>
        <div style={row}>
          {[['Down', 'level', -90], ['Up', 'level', 90], ['Off the surface', 'surface', 90], ['Along +', 'surface', 0], ['Along −', 'surface', 180]].map(([t, from, deg]) => (
            <button key={t} type="button" style={chip} onClick={() => editSelected(o => { o.dir = { from, deg } })}>{t}</button>
          ))}
          <button type="button" style={chip} onClick={() => editSelected(o => { o.dir.deg = ((o.dir.deg + 360) % 360) - 180 })}>Reverse</button>
        </div>
        {pushable && (
          <label style={check}><input type="checkbox" checked={f.push} onChange={e => set({ push: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Pushes on the body (drawn into it)</label>
        )}
      </section>
      <section style={section}>
        <div style={sectionTitle}>Marks</div>
        <label style={{ ...check, opacity: d.axes === 'none' ? 0.5 : 1 }}>
          <input type="checkbox" checked={f.comps} disabled={d.axes === 'none'} onChange={e => set({ comps: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
          Show its components{d.axes === 'none' ? ' (turn on axes)' : ''}
        </label>
        {f.comps && d.axes !== 'none' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[0, 1].map(i => (
              <label key={i} style={{ display: 'grid', gap: 3 }}>
                <span style={smallLabel}>Along {i ? 'y' : 'x'}</span>
                <input value={f.compLabels[i]} placeholder={compLabel(f.label, i ? 'y' : 'x')} spellCheck={false}
                  onChange={e => editSelected(o => { o.compLabels[i] = e.target.value }, `comp${i}:${f.id}`)} style={texInput} />
              </label>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 6, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 3 }}>
            <span style={smallLabel}>Mark its angle to</span>
            <select value={f.angle} onChange={e => set({ angle: e.target.value })} style={inputStyle}>
              <option value="none">Nothing</option>
              <option value="level">The horizontal</option>
              <option value="vertical">The vertical</option>
              <option value="surface">The surface</option>
              <option value="normal">The normal</option>
            </select>
          </label>
          {f.angle !== 'none' && <input value={f.angleLabel} aria-label="Angle label" spellCheck={false} onChange={e => set({ angleLabel: e.target.value }, 'angle:' + f.id)} style={texInput} />}
        </div>
        {['tension', 'applied', 'spring', 'custom'].includes(f.kind) && (
          <label style={check}><input type="checkbox" checked={f.rope} onChange={e => set({ rope: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Draw its rope</label>
        )}
        <div style={row}>
          <span style={smallLabel}>Color</span>
          {[null, ...FORCE_COLORS].map(c => (
            <button key={c || 'auto'} type="button" aria-label={c || 'The diagram’s color'} aria-pressed={f.color === c} onClick={() => set({ color: c })}
              style={{ width: 20, height: 20, borderRadius: '50%', padding: 0, cursor: 'pointer', border: '2px solid var(--bg-card, #1e1e2e)', boxShadow: f.color === c ? '0 0 0 2px var(--accent, #6366f1)' : '0 0 0 1px var(--border, #444)', background: c || d.color }} />
          ))}
        </div>
      </section>
      <section style={section}><div style={sectionTitle}>Appears</div><Stepper label="Step" value={f.step} onChange={n => set({ step: n })} /></section>
      <div style={row}>
        <button className="btn btn-secondary" style={{ ...smallButton, color: '#e5484d' }} onClick={onDelete}>Delete force</button>
        <button className="btn btn-secondary" style={smallButton} onClick={onDone}>Done</button>
      </div>
    </>
  )
}

function DiagramPanel({ d, edit, steps, preview }) {
  const set = (fn, key) => edit(fn, key)
  return (
    <>
      <section style={section}>
        <div style={sectionTitle}>Body</div>
        <Segmented label="Shape" value={d.body.shape} onChange={v => set(m => { m.body.shape = v })} options={[['box', 'Box'], ['ball', 'Ball'], ['dot', 'Point']]} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <label style={{ display: 'grid', gap: 3 }}><span style={smallLabel}>Label</span>
            <input value={d.body.label} spellCheck={false} onChange={e => set(m => { m.body.label = e.target.value }, 'body-label')} style={texInput} /></label>
          <label style={{ display: 'grid', gap: 3 }}><span style={smallLabel}>Mass (kg)</span>
            <input value={d.body.mass} inputMode="decimal" onChange={e => set(m => { m.body.mass = e.target.value }, 'mass')} style={inputStyle} /></label>
        </div>
      </section>
      <section style={section}>
        <div style={sectionTitle}>Surroundings</div>
        <select value={d.surface.kind} onChange={e => set(m => { m.surface.kind = e.target.value })} style={inputStyle} aria-label="Surface">
          <option value="none">None</option>
          <option value="floor">Floor</option>
          <option value="incline">Incline</option>
          <option value="wall">Wall on the left</option>
          <option value="ceiling">Ceiling</option>
        </select>
        {d.surface.kind === 'incline' && (
          <div style={row}>
            <input type="range" min={-60} max={60} step={1} value={d.surface.angle} aria-label="Incline angle"
              onChange={e => set(m => { m.surface.angle = Number(e.target.value) }, 'incline')} style={{ flex: 1, minWidth: 0, accentColor: 'var(--accent)' }} />
            <span style={{ minWidth: 30, fontVariantNumeric: 'tabular-nums' }}>{d.surface.angle}°</span>
            <input value={d.surface.angleLabel} aria-label="Incline angle label" spellCheck={false} onChange={e => set(m => { m.surface.angleLabel = e.target.value }, 'incline-label')} style={{ ...texInput, width: 64 }} />
          </div>
        )}
        <label style={check}><input type="checkbox" checked={d.surface.show} onChange={e => set(m => { m.surface.show = e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Draw the surroundings and ropes</label>
      </section>
      <section style={section}>
        <div style={sectionTitle}>Motion</div>
        <select value={d.motion} onChange={e => set(m => { m.motion = e.target.value })} style={inputStyle} aria-label="Motion">
          <option value="rest">At rest or steady: ΣF = 0</option>
          <option value="slide">Sliding along the surface</option>
          <option value="free">Free: a = ΣF / m</option>
        </select>
        <span style={smallLabel}>{d.motion === 'rest' ? 'Forces marked worked out take whatever values balance the rest.' : d.motion === 'slide' ? 'The acceleration lies along the surface, and is worked out with up to one force.' : 'Nothing is worked out: the forces give the acceleration.'}</span>
      </section>
      <section style={section}>
        <div style={sectionTitle}>Drawing</div>
        <Segmented label="Forces act" value={d.model} onChange={v => set(m => { m.model = v })} options={[['particle', 'From the centre'], ['extended', 'Where they act']]} />
        <label style={{ display: 'grid', gap: 3 }}><span style={smallLabel}>Axes</span>
          <select value={d.axes} onChange={e => set(m => { m.axes = e.target.value })} style={inputStyle}>
            <option value="none">None</option>
            <option value="level">Horizontal and vertical</option>
            <option value="surface">Along the surface</option>
          </select></label>
        <div style={row}>
          <span style={smallLabel}>Scale</span>
          <input type="number" min={0.01} step="any" value={d.forceScale} aria-label="Newtons per centimetre"
            onChange={e => { const v = Number(e.target.value); if (v > 0) set(m => { m.forceScale = v }, 'scale') }} style={{ ...inputStyle, width: 70 }} />
          <span style={smallLabel}>N per cm of arrow</span>
        </div>
        <label style={check}><input type="checkbox" checked={d.values} onChange={e => set(m => { m.values = e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Write values on the labels</label>
        <label style={check}><input type="checkbox" checked={d.net.show} onChange={e => set(m => { m.net.show = e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Show the net force</label>
        {d.net.show && (
          <div style={row}>
            <input value={d.net.label} aria-label="Net force label" spellCheck={false} onChange={e => set(m => { m.net.label = e.target.value }, 'net-label')} style={{ ...texInput, width: 110 }} />
            <Stepper label="Net force step" value={d.net.step} onChange={n => set(m => { m.net.step = n })} />
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Line color
          <input type="color" value={d.color} onChange={e => set(m => { m.color = e.target.value }, 'color')}
            style={{ width: 28, height: 22, border: '1px solid var(--border, #333)', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }} />
        </label>
      </section>
      <section style={section}>
        <div style={sectionTitle}>Steps</div>
        {steps > 0
          ? Array.from({ length: steps + 1 }, (_, i) => i).map(n => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr)', gap: 6, alignItems: 'center' }}>
              <b style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: preview?.step === n ? 'var(--accent, #6366f1)' : 'var(--text-muted, #888)' }}>{n}</b>
              <input value={d.captions[n] || ''} aria-label={`Caption for step ${n}`} placeholder={`Caption for step ${n}`}
                onChange={e => set(m => { if (e.target.value) m.captions[n] = e.target.value; else delete m.captions[n] }, 'caption:' + n)}
                style={{ ...inputStyle, borderColor: preview?.step === n ? 'var(--accent, #6366f1)' : undefined }} />
            </div>
          ))
          : <span style={smallLabel}>Everything appears at once. Select a force to give it a step.</span>}
        {steps > 0 && (
          <>
            <label style={check}><input type="checkbox" checked={d.dimPast} onChange={e => set(m => { m.dimPast = e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Dim earlier steps</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              First step at slide step
              <input type="number" min={1} max={1000} value={d.stepStart}
                onChange={e => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= 1000) set(m => { m.stepStart = n }) }}
                style={{ ...inputStyle, width: 60 }} />
            </label>
          </>
        )}
      </section>
    </>
  )
}

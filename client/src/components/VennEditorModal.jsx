// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The Venn diagram editor. On the left, how many sets, their layout, and a
// keypad of set symbols; in the middle, the expression and the diagram on the
// slide's color; on the right, what's shaded, then tabs for the regions, the
// steps, the numbers in the regions, and the sets' style. Typing an
// expression shades its regions; clicking a region shades or clears it and
// rewrites the expression in its simplest form. Dragging a set's outline
// moves it (Shift resizes). Preview build steps through the diagram as the
// presented slide will.

import { useState, useRef, useMemo, useLayoutEffect, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import {
  VENN_UNIT as UNIT, VENN_TEMPLATES, VENN_STYLES, VENN_SWATCHES, SHADE_COLOR, UNIVERSE_LABELS,
  vennModel, analyzeVenn, drawVenn, vennSvg, vennTikz, vennExprTex, vennFrame, styleOf, inputSyntax, fmtValue,
  buildUp, toggleRegion, setSetCount, applyLayout, layoutName, renameSet, addLayer,
} from '../utils/vennDiagram'
import { VENN_LAYOUTS, shapeFns, regionAt } from '../utils/vennGeometry'
import { format, simplest, popcount, has, regionAst, regionNumber, regionPhrase, REGION_ORDER } from '../utils/vennExpr'
import { DIAGRAM_CSS, applyDiagramStep } from '../utils/diagramCore'
import { texHtml } from './FeynmanView'

const ACCENT = '#818cf8'
const inputStyle = {
  padding: '5px 7px', background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', borderRadius: 4,
  color: 'var(--text-primary, #fff)', fontSize: 12, boxSizing: 'border-box', width: '100%', minWidth: 0,
}
const mono = "'Fira Code','JetBrains Mono',monospace"
const texInput = { ...inputStyle, fontFamily: mono }
const smallLabel = { fontSize: 11, color: 'var(--text-muted, #888)' }
const sectionTitle = { fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted, #888)' }
const iconButton = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #888)', padding: 3, display: 'flex', alignItems: 'center' }
const smallButton = { fontSize: 12, padding: '4px 10px' }
const section = { display: 'flex', flexDirection: 'column', gap: 7 }
const row = { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }
const check = { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }
const chip = { fontSize: 12, padding: '1px 9px', borderRadius: 999, border: '1px solid var(--border, #333)', background: 'var(--bg-hover, #252530)', color: 'var(--text-primary, #fff)', cursor: 'pointer' }
const numInput = { ...inputStyle, width: 52, textAlign: 'center', padding: '3px 4px' }
const WARN = '#f5a524', OKC = '#22c55e', BADC = '#ef4444'

const Tex = ({ tex }) => <span dangerouslySetInnerHTML={{ __html: texHtml(tex) }} />

// The window of the diagram the canvas shows, in px, 5:3 like the canvas
function fitView(box) {
  const pad = 0.5 * UNIT
  let w = Math.max(8 * UNIT, box.x1 - box.x0 + 2 * pad), h = Math.max(4.8 * UNIT, box.y1 - box.y0 + 2 * pad)
  if (w / h > 5 / 3) h = w * 3 / 5; else w = h * 5 / 3
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}
// A layout's shapes, small, for its button
function miniShapes(shapes, w = 26, h = 20) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const s of shapes) { const f = shapeFns(s); for (let k = 0; k < 32; k++) { const p = f.at(k / 32 * Math.PI * 2); x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]) } }
  const k = Math.min((w - 2) / (x1 - x0), (h - 2) / (y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const r = v => Math.round(v * 10) / 10
  return `<svg width="${w}" height="${h}" viewBox="${-w / 2} ${-h / 2} ${w} ${h}" style="display:block">${shapes.map(s => { const x = r((s.x - cx) * k), y = r(-(s.y - cy) * k); return `<ellipse cx="${x}" cy="${y}" rx="${r(s.rx * k)}" ry="${r(s.ry * k)}" transform="rotate(${-s.rot} ${x} ${y})" fill="none" stroke="currentColor" stroke-width="1.2"/>` }).join('')}</svg>`
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
function StepInput({ value, onChange, label, empty }) {
  return (
    <input type="number" min={0} max={1000} aria-label={label} placeholder={empty} value={value == null ? '' : value} style={numInput}
      onChange={e => {
        if (e.target.value === '' && empty) { onChange(null); return }
        const n = Math.round(Number(e.target.value))
        if (isFinite(n) && n >= 0 && n <= 1000) onChange(n)
      }} />
  )
}
const nextSwatch = c => VENN_SWATCHES[(VENN_SWATCHES.indexOf(c) + 1) % VENN_SWATCHES.length]

export default function VennEditorModal({ initial, slideBg = '#1e1e2e', isNew, onSave, onClose }) {
  const [d, setD] = useState(() => vennModel(initial))
  const [hover, setHover] = useState(null)     // { p, r }: the region pointed at
  const [sel, setSel] = useState(null)         // the set being dragged
  const [hint, setHint] = useState(null)
  const [frozen, setFrozen] = useState(null)
  const [preview, setPreview] = useState(null) // { step, animate, n }
  const [tab, setTab] = useState('regions')
  const [detail, setDetail] = useState('every')
  const [showTikz, setShowTikz] = useState(false)
  const [beamer, setBeamer] = useState(false)
  const [copied, setCopied] = useState('')
  const [, setHistoryTick] = useState(0)
  const past = useRef([]), future = useRef([]), typingKey = useRef(null), drag = useRef(null)
  const dRef = useRef(d)
  const svgRef = useRef(null), previewRef = useRef(null), dialogRef = useRef(null), exprRef = useRef(null)
  const startJson = useRef(JSON.stringify(d))
  const lastGood = useRef(d.expr)

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
  const restore = useCallback((json, into) => {
    into.current.push(JSON.stringify(dRef.current))
    const m = JSON.parse(json)
    typingKey.current = null
    dRef.current = m
    setD(m)
    setHistoryTick(t => t + 1)
  }, [])
  const undo = useCallback(() => { if (past.current.length) restore(past.current.pop(), future) }, [restore])
  const redo = useCallback(() => { if (future.current.length) restore(future.current.pop(), past) }, [restore])

  // ---------- What's worked out, and what's drawn: while the expression
  // doesn't read, the diagram keeps its last shading
  const a = useMemo(() => analyzeVenn(d), [d])
  if (!a.err) lastGood.current = d.expr
  const shownModel = useMemo(() => (a.err ? { ...d, expr: lastGood.current } : d), [a.err, d])
  const da = useMemo(() => { if (!a.err) return a; const b = analyzeVenn(shownModel); return b.err ? { ...b, err: null, masks: [], sides: [] } : b }, [a, shownModel])
  const drawn = useMemo(() => drawVenn(shownModel, { a: da, ink: d.color, labels: texHtml, hover, sel, accent: ACCENT, captions: true }), [shownModel, da, d.color, hover, sel])
  const view = frozen || fitView(drawn.box)

  // ---------- The canvas
  const world = ev => {
    const svg = svgRef.current, pt = svg.createSVGPoint()
    pt.x = ev.clientX; pt.y = ev.clientY
    const ctm = svg.getScreenCTM()
    const q = pt.matrixTransform(ctm.inverse())
    const fr = vennFrame(shownModel, da), box = da.g.box
    const gx = q.x / UNIT
    const p = fr.panels === 2 && gx > (box.x1 + box.x0 + fr.offs[1]) / 2 ? 1 : 0
    return { x: gx - fr.offs[p], y: -q.y / UNIT, p, scale: ctm.a * UNIT }
  }
  const outlineAt = pt => {
    let best = null, bd = 6 / pt.scale
    da.g.fns.forEach((f, i) => { const dd = f.dist(pt.x, pt.y); if (dd < bd) { bd = dd; best = i } })
    return best
  }
  const regionUnder = pt => {
    const r = regionAt(da.g, pt.x, pt.y)
    return r != null && has(da.visible, r) ? r : null
  }
  const clickRegion = (p, r) => {
    if (a.err) return
    edit(m => { toggleRegion(m, analyzeVenn(m), p, r) })
  }
  const onPointerDown = ev => {
    if (ev.button > 0) return
    ev.preventDefault()
    dialogRef.current?.focus({ preventScroll: true })
    typingKey.current = null
    const pt = world(ev), k = outlineAt(pt)
    if (k != null) {
      try { svgRef.current.setPointerCapture(ev.pointerId) } catch { /* not every pointer can be captured */ }
      setFrozen(view)
      const before = JSON.stringify(dRef.current)
      drag.current = { kind: 'move', k, start: pt, orig: { ...dRef.current.shapes[k] }, before, work: JSON.parse(before), moved: false }
    } else drag.current = { kind: 'click', start: pt, moved: false }
  }
  const onPointerMove = ev => {
    const pt = world(ev), dr = drag.current
    if (dr?.kind === 'move') {
      const dx = pt.x - dr.start.x, dy = pt.y - dr.start.y
      if (!dr.moved && Math.hypot(dx, dy) * pt.scale < 3) return
      if (!dr.moved) setSel(dr.k)
      dr.moved = true
      const s = dr.work.shapes[dr.k], o = dr.orig
      if (ev.shiftKey) {
        const d0 = Math.hypot(dr.start.x - o.x, dr.start.y - o.y), d1 = Math.hypot(pt.x - o.x, pt.y - o.y)
        const f = d0 > 0.05 ? d1 / d0 : 1
        Object.assign(s, { x: o.x, y: o.y, rx: Math.max(0.4, Math.min(5, o.rx * f)), ry: Math.max(0.4, Math.min(5, o.ry * f)) })
      } else Object.assign(s, { x: Math.round((o.x + dx) * 20) / 20, y: Math.round((o.y + dy) * 20) / 20, rx: o.rx, ry: o.ry })
      dr.work.layout = 'custom'
      const next = JSON.parse(JSON.stringify(dr.work))
      dRef.current = next
      setD(next)
      return
    }
    if (dr?.kind === 'click') { if (Math.hypot(pt.x - dr.start.x, pt.y - dr.start.y) * pt.scale > 6) dr.moved = true; return }
    if (preview) return
    const k = outlineAt(pt)
    if (k != null) {
      if (hover) setHover(null)
      setHint({ kind: 'outline', k })
      svgRef.current.style.cursor = 'move'
      return
    }
    const r = a.err ? null : regionUnder(pt)
    svgRef.current.style.cursor = r == null ? 'default' : 'pointer'
    const h = r == null ? null : { p: pt.p, r }
    if (JSON.stringify(h) !== JSON.stringify(hover)) { setHover(h); setHint(h ? { kind: 'region', ...h } : null) }
  }
  const onPointerUp = () => {
    const dr = drag.current
    drag.current = null
    setFrozen(null)
    setSel(null)
    if (!dr) return
    if (dr.kind === 'move' && dr.moved) {
      if (JSON.stringify(dr.work) !== dr.before) commit(JSON.parse(JSON.stringify(dr.work)), dr.before)
      return
    }
    // A click, on a region or on an outline without a drag: the region under it
    if (!dr.moved) { const r = regionUnder(dr.start); if (r != null) clickRegion(dr.start.p, r) }
  }
  const onPointerCancel = () => {
    const dr = drag.current
    drag.current = null
    setFrozen(null)
    setSel(null)
    if (dr?.before) { const m = JSON.parse(dr.before); dRef.current = m; setD(m) }
  }
  const onPointerLeave = () => { if (!drag.current) { setHover(null); setHint(null) } }

  const loadTemplate = key => {
    const t = VENN_TEMPLATES.find(x => x.key === key)
    if (!t) return
    const m = vennModel({ ...t.build(), color: dRef.current.color, stepStart: dRef.current.stepStart, dimPast: dRef.current.dimPast })
    commit(m, JSON.stringify(dRef.current))
    setHover(null)
  }
  // The keypad writes in the syntax the expression is already in
  const insert = (tex, text) => {
    const el = exprRef.current, cur = dRef.current.expr
    const s = el ? el.selectionStart ?? cur.length : cur.length, e = el ? el.selectionEnd ?? s : s
    let ins = inputSyntax(dRef.current) === 'tex' ? tex : text
    const before = cur.slice(0, s), after = cur.slice(e)
    if (ins.startsWith(' ') && (before.endsWith(' ') || !before)) ins = ins.slice(1)
    if (ins.endsWith(' ') && after.startsWith(' ')) ins = ins.slice(0, -1)
    edit(m => { m.expr = before + ins + after })
    requestAnimationFrame(() => { if (el) { el.focus(); const c = before.length + ins.length; el.setSelectionRange(c, c) } })
  }

  // ---------- Preview build: the slide's drawing, stepped as it will be
  const steps = da.maxStep
  const previewSvg = useMemo(() => (preview ? vennSvg(shownModel, { deck: 'editor', labels: texHtml }) : ''), [preview != null, shownModel]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (preview && previewRef.current) applyDiagramStep(previewRef.current, preview.step, preview.animate, d.dimPast)
  }, [preview, previewSvg, d.dimPast])
  const startPreview = () => { setHover(null); setPreview({ step: 0, animate: false, n: 0 }) }
  const goStep = delta => setPreview(pv => {
    if (!pv) return pv
    const step = Math.min(steps, Math.max(0, pv.step + delta))
    return step === pv.step ? pv : { step, animate: delta > 0, n: pv.n + 1 }
  })

  // ---------- Keys
  const onKeyDown = ev => {
    // Nothing here reaches the editor's own shortcuts (Delete, Ctrl+Z, …)
    ev.stopPropagation()
    const typing = ev.target.closest?.('input, textarea, select')
    // Text fields undo their own typing; a box or menu undoes the diagram
    const textEntry = ev.target.closest?.('textarea, input:not([type=checkbox]):not([type=color])')
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
    if (ev.key === 'Escape') { setHover(null); setSel(null) }
  }

  // ---------- Saving
  const tikz = useMemo(() => (showTikz ? vennTikz(d, { beamer }) : ''), [showTikz, d, beamer])
  const save = () => { if (!a.err) onSave(vennModel(d)) }
  const cancel = () => {
    if (JSON.stringify(d) !== startJson.current && !confirm('Discard your changes to this diagram?')) return
    onClose()
  }
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1500) }
    catch (err) { alert('Couldn’t copy: ' + err.message) }
  }

  const n = d.sets.length, ids = d.sets.map(s => s.id)
  const hintText = preview
    ? '→ or Space goes to the next step, ← goes back, Esc returns to editing.'
    : hint?.kind === 'outline' ? <>Drag to move <Tex tex={ids[hint.k]} />. Shift-drag resizes it.</>
      : hint?.kind === 'region' && hint.r != null ? <><b>{regionNumber(hint.r, n)}</b> · <Tex tex={format(regionAst(hint.r, n), styleOf(d, 'tex'))} /> · {regionPhrase(hint.r, n, ids)} · click to {has(a.masks[hint.p] || 0, hint.r) ? 'clear' : 'shade'} it{a.rel ? (hint.p ? ' on the right' : ' on the left') : ''}</>
        : 'Type an expression, or click regions to shade them. Drag a set’s outline to move it, Shift-drag to resize it.'
  const keys = [
    ['∪', ' \\cup ', ' ∪ ', 'Union'], ['∩', ' \\cap ', ' ∩ ', 'Intersection'], ['∖', ' \\setminus ', ' ∖ ', 'Difference'], ['△', ' \\triangle ', ' Δ ', 'Symmetric difference'],
    ['′', "'", "'", 'Complement'], ['(', '(', '(', 'Open bracket'], [')', ')', ')', 'Close bracket'], ['∅', '\\varnothing', '∅', 'The empty set'],
    [d.universe.label, d.universe.label + (/^\\/.test(d.universe.label) ? ' ' : ''), d.universe.label, 'The universe'], ['=', ' = ', ' = ', 'Equals: compare two sides'], ['⊆', ' \\subseteq ', ' ⊆ ', 'Subset: compare two sides'], ['≠', ' \\neq ', ' ≠ ', 'Not equal: compare two sides'],
    ...ids.map(id => [id, id, id, `Set ${id}`]),
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{DIAGRAM_CSS}</style>
      <div ref={dialogRef} role="dialog" aria-label="Venn diagram" tabIndex={-1} onKeyDown={onKeyDown}
        style={{ background: 'var(--bg-card, #1e1e2e)', borderRadius: 12, width: 'min(1360px, 96vw)', height: 'min(880px, 94vh)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border, #333)', overflow: 'hidden', outline: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', borderBottom: '1px solid var(--border, #333)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary, #fff)' }}>Venn diagram</span>
          <span role="status" style={{ ...smallLabel, fontSize: 12, flex: '1 1 260px', minWidth: 0 }}>{hintText}</span>
          <div style={row}>
            <select aria-label="Start from a template" value="" disabled={!!preview} onChange={e => loadTemplate(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="" disabled>Start from…</option>
              {VENN_TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
            <button className="btn btn-secondary" style={smallButton} disabled={!!preview || !past.current.length} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
            <button className="btn btn-secondary" style={smallButton} disabled={!!preview || !future.current.length} onClick={redo} title="Redo (Ctrl+Shift+Z)">Redo</button>
            {preview
              ? <button className="btn btn-primary" style={smallButton} onClick={() => setPreview(null)}>Back to editing</button>
              : <button className="btn btn-primary" style={smallButton} onClick={startPreview} disabled={!!a.err}>Preview build</button>}
          </div>
          <a href="/#docs/tutorials/venn-diagrams" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>How to use</a>
          <button onClick={cancel} aria-label="Close" style={iconButton}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Sets, layouts and the keypad */}
          <div role="toolbar" aria-label="Sets, layouts and symbols" style={{ width: 150, flex: 'none', borderRight: '1px solid var(--border, #333)', padding: 10, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4, alignContent: 'start', overflowY: 'auto', opacity: preview ? 0.4 : 1, pointerEvents: preview ? 'none' : undefined }}>
            <div style={{ ...sectionTitle, gridColumn: '1 / -1', fontSize: 10.5, margin: '0 2px 2px' }}>Sets</div>
            {[1, 2, 3, 4].map(k => (
              <button key={k} type="button" title={`${k} set${k > 1 ? 's' : ''}`} aria-pressed={n === k} onClick={() => edit(m => setSetCount(m, k))}
                style={{ display: 'grid', placeItems: 'center', height: 30, borderRadius: 6, cursor: 'pointer', color: 'var(--text-primary, #fff)', border: `1px solid ${n === k ? 'var(--accent, #6366f1)' : 'transparent'}`, background: n === k ? 'rgba(99,102,241,0.18)' : 'none' }}>
                <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: miniShapes(VENN_LAYOUTS[k][0].shapes) }} />
              </button>
            ))}
            <div style={{ ...sectionTitle, gridColumn: '1 / -1', fontSize: 10.5, margin: '8px 2px 2px' }}>Layout</div>
            {[...VENN_LAYOUTS[n], ...(d.layout === 'custom' ? [{ id: 'custom', name: 'Dragged', shapes: d.shapes }] : [])].map(L => (
              <button key={L.id} type="button" aria-pressed={d.layout === L.id} onClick={() => L.id !== 'custom' && edit(m => applyLayout(m, L.id))}
                style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-primary, #fff)', textAlign: 'left', border: `1px solid ${d.layout === L.id ? 'var(--accent, #6366f1)' : 'transparent'}`, background: d.layout === L.id ? 'rgba(99,102,241,0.18)' : 'none' }}>
                <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: miniShapes(L.shapes) }} />{layoutName(L, d)}
              </button>
            ))}
            <div style={{ ...sectionTitle, gridColumn: '1 / -1', fontSize: 10.5, margin: '8px 2px 2px' }}>Insert</div>
            {keys.map(([label, tex, text, title], i) => (
              <button key={i} type="button" title={title} onClick={() => insert(tex, text)}
                style={{ height: 30, borderRadius: 6, cursor: 'pointer', color: 'var(--text-primary, #fff)', border: '1px solid var(--border, #333)', background: 'var(--bg-hover, #252530)', fontSize: 15, fontFamily: "'KaTeX_Main','Times New Roman',serif", fontStyle: /^[A-Za-z]$/.test(label) ? 'italic' : 'normal', padding: 0 }}>
                {/^\\/.test(label) ? <Tex tex={label} /> : label}
              </button>
            ))}
            <button type="button" onClick={() => { edit(m => { m.expr = '' }); exprRef.current?.focus() }} style={{ gridColumn: 'span 2', height: 28, borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary, #ccc)', border: 'none', background: 'none', fontSize: 12 }}>Clear</button>
          </div>

          {/* The expression and the diagram */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 14, gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px', borderRadius: 8, border: `1px solid ${a.err ? 'rgba(239,68,68,0.6)' : 'var(--border, #333)'}`, background: 'var(--bg-hover, #252530)' }}>
              <span style={{ ...sectionTitle, fontSize: 10.5 }}>Shade</span>
              <input ref={exprRef} value={d.expr} spellCheck={false} autoComplete="off" disabled={!!preview} aria-label="Set expression" aria-invalid={!!a.err}
                placeholder="A \cap (B \cup C)" onChange={e => { const v = e.target.value; edit(m => { m.expr = v }, 'expr') }}
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none', color: 'var(--text-primary, #fff)', fontFamily: mono, fontSize: 14, padding: '6px 0' }} />
            </label>
            <ReadLine d={d} a={a} />
            <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 6, overflow: 'hidden', background: slideBg, boxShadow: '0 0 0 1px var(--border, #333)' }}>
              {preview
                ? <div ref={previewRef} style={{ position: 'absolute', inset: '5%' }} dangerouslySetInnerHTML={{ __html: previewSvg }} />
                : <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', userSelect: 'none' }}
                    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onPointerLeave={onPointerLeave}
                    dangerouslySetInnerHTML={{ __html: drawn.svg }} />}
            </div>
            {preview && (
              <div style={{ ...row, fontSize: 12.5, color: 'var(--text-secondary, #ccc)' }}>
                <button className="btn btn-secondary" style={smallButton} onClick={() => goStep(-1)} disabled={preview.step <= 0} aria-label="Previous step">◀</button>
                <span style={{ minWidth: 92, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>Step {preview.step} of {steps}</span>
                <button className="btn btn-secondary" style={smallButton} onClick={() => goStep(1)} disabled={preview.step >= steps} aria-label="Next step">▶</button>
                {!steps && <span style={smallLabel}>Everything appears at once. Build It Up, in the Steps tab, writes steps.</span>}
              </div>
            )}
            {showTikz && (
              <pre style={{ margin: 0, maxHeight: 200, overflow: 'auto', padding: '10px 12px', borderRadius: 6, background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', fontSize: 11.5, lineHeight: 1.55, color: 'var(--text-primary, #fff)', fontFamily: mono }}>{tikz}</pre>
            )}
          </div>

          {/* What's shaded, then the tabs */}
          <div style={{ width: 310, flex: 'none', borderLeft: '1px solid var(--border, #333)', display: 'flex', flexDirection: 'column', minHeight: 0, fontSize: 12, color: 'var(--text-secondary, #ccc)' }}>
            <div style={{ padding: '14px 16px 10px', display: 'grid', gap: 8 }}>
              <Summary d={d} a={a} />
              {a.staleBuild && !a.err && !preview && (
                <div role="status" style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(245,165,36,0.6)', display: 'grid', gap: 6, lineHeight: 1.45 }}>
                  <span>The steps were built for <Tex tex={vennExprTex({ ...d, expr: d.builtFrom })} />.</span>
                  <div style={row}>
                    <button className="btn btn-primary" style={smallButton} onClick={() => edit(m => { buildUp(m, detail) })}>Build it up again</button>
                    <button className="btn btn-secondary" style={smallButton} onClick={() => edit(m => { m.layers = []; m.result.steps = [0, 0]; m.captions = {}; m.verdict.step = 0; m.builtFrom = '' })}>Clear steps</button>
                  </div>
                </div>
              )}
            </div>
            <div role="tablist" style={{ display: 'flex', gap: 2, padding: '0 10px', borderBottom: '1px solid var(--border, #333)' }}>
              {[['regions', 'Regions'], ['steps', 'Steps'], ['numbers', 'Numbers'], ['style', 'Style']].map(([k, t]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  style={{ border: 'none', background: 'none', padding: '7px 9px', fontSize: 12.5, cursor: 'pointer', color: tab === k ? 'var(--text-primary, #fff)' : 'var(--text-muted, #888)', fontWeight: tab === k ? 600 : 400, borderBottom: `2px solid ${tab === k ? 'var(--accent, #6366f1)' : 'transparent'}`, marginBottom: -1 }}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 16, opacity: preview ? 0.5 : 1, pointerEvents: preview ? 'none' : undefined }}>
              {tab === 'regions' && <RegionsTab d={d} a={a} edit={edit} hover={hover} setHover={setHover} onToggle={clickRegion} />}
              {tab === 'steps' && <StepsTab d={d} a={da} err={!!a.err} edit={edit} detail={detail} setDetail={setDetail} />}
              {tab === 'numbers' && <NumbersTab d={d} a={a} edit={edit} />}
              {tab === 'style' && <StyleTab d={d} edit={edit} />}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderTop: '1px solid var(--border, #333)', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setShowTikz(v => !v)} aria-pressed={showTikz}>{showTikz ? 'Hide TikZ' : 'Show TikZ'}</button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => copy(vennTikz(d, { beamer }), 'tikz')}>{copied === 'tikz' ? 'Copied' : 'Copy TikZ'}</button>
          <label style={{ ...check, fontSize: 12 }}><input type="checkbox" checked={beamer} onChange={e => setBeamer(e.target.checked)} style={{ accentColor: 'var(--accent)' }} /> Beamer steps</label>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => copy(vennExprTex(d), 'tex')}>{copied === 'tex' ? 'Copied' : 'Copy expression'}</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={cancel}>Cancel</button>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={save} disabled={!!a.err} title={a.err ? 'Fix the expression first' : undefined}>{isNew ? 'Insert' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

// How the expression was read, or where it went wrong
function ReadLine({ d, a }) {
  if (a.err) {
    const s = d.expr, at = Math.min(a.err.at, s.length), len = Math.max(1, a.err.len || 1)
    return (
      <div role="status" style={{ ...row, minHeight: 24, fontSize: 12.5 }}>
        <span style={{ color: BADC }}>{a.err.message}</span>
        {s && <code style={{ fontFamily: mono, fontSize: 12, color: 'var(--text-secondary, #ccc)' }}>{s.slice(0, at)}<mark style={{ background: 'rgba(239,68,68,0.3)', color: 'inherit', borderRadius: 2 }}>{s.slice(at, at + len) || ' '}</mark>{s.slice(at + len)}</code>}
      </div>
    )
  }
  const node = a.rel ? { t: 'rel', op: a.rel, a: a.sides[0], b: a.sides[1] } : a.sides[0]
  return (
    <div role="status" style={{ ...row, minHeight: 24, fontSize: 12, color: 'var(--text-muted, #888)' }}>
      {a.parsed.readAs && <span>Read as</span>}
      <span style={{ fontSize: 15, color: 'var(--text-primary, #fff)' }}><Tex tex={format(node, styleOf(d, 'tex'))} /></span>
      {a.parsed.readAs && <span>{a.parsed.notes.join(' ')}</span>}
    </div>
  )
}

// What's shaded: how many regions, the simplest form, and what's in them; or the verdict
function Summary({ d, a }) {
  const st = styleOf(d, 'tex'), n = a.n
  let tone = 'shade', lines = []
  if (a.err) {
    tone = 'warn'
    lines = [<b key="h">The expression doesn’t read yet</b>, <span key="s">The diagram keeps its last shading until it does.</span>]
  } else if (a.rel) {
    const v = a.verdict
    tone = v.holds ? 'ok' : 'bad'
    lines.push(<b key="h" style={{ color: v.holds ? OKC : BADC }}>{v.holds ? '✓' : '✗'} {v.short}</b>, <span key="t">{v.text}</span>)
    if (v.layoutNote) lines.push(<span key="l">{v.layoutNote}</span>)
    a.sides.forEach((s, p) => {
      const simp = simplest(a.masks[p], n)
      if (format(simp, st) !== format(s, st)) lines.push(<span key={'s' + p}>{p ? 'Right' : 'Left'} side, simplest: <Tex tex={format(simp, st)} /></span>)
    })
  } else {
    const mask = a.masks[0], visible = popcount(a.visible), k = popcount(mask & a.visible)
    lines.push(<span key="e" style={{ fontSize: 15, color: 'var(--text-primary, #fff)' }}><Tex tex={format(a.sides[0], st)} /></span>)
    lines.push(<span key="c">{mask === 0 ? 'Nothing is shaded.' : `${k} of ${visible} region${visible === 1 ? '' : 's'} shaded.`}</span>)
    const simp = simplest(mask, n)
    if (format(simp, st) !== format(a.sides[0], st)) lines.push(<span key="s">Simplest: <Tex tex={format(simp, st)} /></span>)
    const vals = d.regions.values, e = format(a.sides[0], st)
    if ((vals === 'counts' || vals === 'probability') && a.num) {
      const lhs = vals === 'probability' ? `P(${e})` : `|${e}|`
      const tot = a.num.shadedTotal
      lines.push(tot == null ? <span key="n">The facts don’t settle <Tex tex={lhs} /> yet.</span> : <span key="n"><Tex tex={`${lhs} = ${fmtValue(tot, vals)}`} /></span>)
    }
    if (vals === 'elements' && a.mem) {
      const items = a.mem.order.filter(x => has(mask, a.mem.where.get(x)))
      lines.push(<span key="m"><Tex tex={`${e} = \\{${items.join(', ')}\\}`} /></span>)
    }
  }
  for (const w of a.warnings) lines.push(<span key={w} style={{ color: WARN }}>{w}</span>)
  for (const w of a.notes) lines.push(<span key={w} style={{ color: 'var(--text-muted, #888)' }}>{w}</span>)
  const dot = { shade: ACCENT, ok: OKC, bad: BADC, warn: WARN }[tone]
  return (
    <div role="status" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 6, border: `1px solid ${tone === 'warn' ? 'rgba(245,165,36,0.6)' : 'var(--border, #333)'}`, background: 'var(--bg-hover, #252530)', color: 'var(--text-secondary, #ccc)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flex: 'none', background: dot }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, lineHeight: 1.45 }}>{lines}</div>
    </div>
  )
}

function RegionsTab({ d, a, edit, hover, setHover, onToggle }) {
  const n = a.n, st = styleOf(d, 'tex'), vals = d.regions.values, sides = a.rel ? 2 : 1
  return (
    <>
      <section style={section}>
        <div style={sectionTitle}>Label regions</div>
        <Segmented label="Label regions" value={d.regions.label} onChange={v => edit(m => { m.regions.label = v })} options={[['none', 'None'], ['roman', 'I, II, III'], ['name', 'Names']]} />
      </section>
      <section style={section}>
        <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between' }}><span>Regions</span><span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{popcount(a.visible)} drawn of {1 << n}</span></div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }} onMouseLeave={() => setHover(null)}>
          <tbody>
            {REGION_ORDER[n].map(r => {
              const drawn = has(a.visible, r)
              let value = ''
              if ((vals === 'counts' || vals === 'probability') && a.num) value = fmtValue(a.num.value[r], vals)
              if (vals === 'elements' && a.mem) value = a.mem.region[r].join(', ')
              return (
                <tr key={r} onMouseEnter={() => setHover({ p: 0, r })} onClick={() => onToggle(0, r)}
                  style={{ borderTop: '1px solid var(--border, #333)', cursor: 'pointer', opacity: drawn ? 1 : 0.45, background: hover?.r === r ? 'var(--bg-hover, #252530)' : undefined }}>
                  <td style={{ padding: '4px 4px 4px 0', ...smallLabel, width: 30 }}>{regionNumber(r, n)}</td>
                  <td style={{ padding: '4px' }}>
                    <div style={{ color: 'var(--text-primary, #fff)' }}><Tex tex={format(regionAst(r, n), st)} /></div>
                    <div style={smallLabel}>{regionPhrase(r, n, d.sets.map(s => s.id))}{drawn ? '' : ' · no room'}</div>
                  </td>
                  <td style={{ padding: '4px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    {!a.err && [0, 1].slice(0, sides).map(p => (
                      <button key={p} type="button" title={sides > 1 ? (p ? 'Right side' : 'Left side') : 'Shaded'} aria-pressed={has(a.masks[p] || 0, r)}
                        onClick={e => { e.stopPropagation(); onToggle(p, r) }}
                        style={{ width: 13, height: 13, margin: '0 2px', padding: 0, borderRadius: 3, cursor: 'pointer', border: `1.5px solid ${has(a.masks[p] || 0, r) ? ACCENT : 'var(--border, #555)'}`, background: has(a.masks[p] || 0, r) ? ACCENT : 'transparent' }} />
                    ))}
                  </td>
                  {vals !== 'none' && <td style={{ padding: '4px 0 4px 4px', textAlign: 'right', color: 'var(--text-primary, #fff)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
        <span style={smallLabel}>Click a row or a region on the slide to shade it or clear it.{sides > 1 ? ' The two boxes are the left and right sides.' : ''}</span>
      </section>
    </>
  )
}

function StepsTab({ d, a, err, edit, detail, setDetail }) {
  const rel = !!a.rel, sides = rel ? 2 : 1
  const swatch = (color, onClick, label) => (
    <button type="button" onClick={onClick} title="Change its colour" aria-label={label}
      style={{ width: 22, height: 22, flex: 'none', borderRadius: 5, padding: 0, cursor: 'pointer', border: '1px solid var(--border, #444)', background: color }} />
  )
  const styleSelect = (value, onChange) => (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label="Style" style={{ ...inputStyle, width: 'auto', flex: '1 1 90px', padding: '3px 5px' }}>
      {VENN_STYLES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  )
  return (
    <>
      <section style={section}>
        <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between' }}><span>Build it up</span><span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{a.maxStep} step{a.maxStep === 1 ? '' : 's'}</span></div>
        <div style={row}>
          <button className="btn btn-primary" style={smallButton} disabled={err} onClick={() => edit(m => { buildUp(m, detail) })}>Build it up</button>
          <select value={detail} onChange={e => setDetail(e.target.value)} aria-label="How much detail" style={{ ...inputStyle, width: 'auto', flex: 1 }}>
            <option value="every">Every operation</option>
            <option value="sides">{rel ? 'One step per side' : 'In one step'}</option>
          </select>
        </div>
        <div style={row}>
          <button className="btn btn-secondary" style={smallButton} onClick={() => edit(m => { m.layers = []; m.result.steps = [0, 0]; m.captions = {}; m.verdict.step = 0; m.regions.step = 0; m.builtFrom = '' })}>Clear steps</button>
          <button className="btn btn-secondary" style={smallButton} onClick={() => edit(m => { addLayer(m, a) })}>Add a layer</button>
        </div>
        <span style={smallLabel}>Writes a step that hatches each operation’s two sides, then one that fills in its result, with captions. Edit them below.</span>
      </section>
      <section style={section}>
        <div style={sectionTitle}>Layers</div>
        <div style={{ display: 'grid', gap: 6, padding: 7, borderRadius: 7, border: '1px solid var(--accent, #6366f1)', background: 'var(--bg-hover, #252530)' }}>
          <div style={row}>
            {swatch(d.result.color || SHADE_COLOR, () => edit(m => { m.result.color = nextSwatch(m.result.color || SHADE_COLOR) }), 'Change the shading’s colour')}
            <span style={{ color: 'var(--text-primary, #fff)' }}>The expression</span>
          </div>
          <div style={row}>
            {styleSelect(d.result.style, v => edit(m => { m.result.style = v }))}
            {[0, 1].slice(0, sides).map(p => (
              <span key={p} style={{ ...row, gap: 4 }}><span style={smallLabel}>{rel ? (p ? 'R' : 'L') : ''} step</span><StepInput label={`${rel ? (p ? 'Right' : 'Left') + ' side' : 'The expression'}: step`} value={d.result.steps[p]} onChange={v => edit(m => { m.result.steps[p] = v })} /></span>
            ))}
          </div>
        </div>
        {d.layers.map((L, i) => {
          const l = a.layers.find(x => x.L.id === L.id)
          const set = (fn, key) => edit(m => { const x = m.layers.find(y => y.id === L.id); if (x) fn(x, m) }, key)
          return (
            <div key={L.id} style={{ display: 'grid', gap: 6, padding: 7, borderRadius: 7, border: '1px solid var(--border, #333)' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {swatch(L.color || SHADE_COLOR, () => set(x => { x.color = nextSwatch(x.color || SHADE_COLOR) }), `Change layer ${i + 1}’s colour`)}
                <input value={L.expr} spellCheck={false} aria-label={`Layer ${i + 1}`} onChange={e => set(x => { x.expr = e.target.value }, 'layer:' + L.id)}
                  style={{ ...texInput, borderColor: l?.err ? 'rgba(239,68,68,0.7)' : undefined }} />
                <button type="button" onClick={() => edit(m => { m.layers = m.layers.filter(x => x.id !== L.id) })} aria-label={`Remove layer ${i + 1}`} title="Remove it" style={iconButton}><X size={14} /></button>
              </div>
              <div style={row}>
                {styleSelect(L.style, v => set(x => { x.style = v }))}
                <span style={smallLabel}>step</span><StepInput label="Appears at step" value={L.step} onChange={v => set(x => { x.step = v; if (x.until != null && x.until < v) x.until = v })} />
                <span style={smallLabel}>to</span><StepInput label="Last step" empty="end" value={L.until} onChange={v => set(x => { x.until = v == null ? null : Math.max(v, x.step) })} />
                {rel && <Segmented label="Side" value={L.panel} onChange={v => set(x => { x.panel = v })} options={[[0, 'L'], [1, 'R']]} />}
              </div>
              {l?.err && <span style={{ color: BADC, fontSize: 11.5 }}>{l.err}</span>}
            </div>
          )
        })}
      </section>
      {rel && (
        <section style={section}>
          <div style={sectionTitle}>Verdict</div>
          <div style={row}>
            <label style={check}><input type="checkbox" checked={d.verdict.show} onChange={e => edit(m => { m.verdict.show = e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Show whether it holds</label>
            <span style={smallLabel}>at step</span><StepInput label="Verdict step" value={d.verdict.step} onChange={v => edit(m => { m.verdict.step = v })} />
          </div>
        </section>
      )}
      <section style={section}>
        <div style={sectionTitle}>Captions</div>
        {Array.from({ length: a.maxStep + 1 }, (_, k) => k).map(k => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr)', gap: 6, alignItems: 'center' }}>
            <b style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted, #888)' }}>{k}</b>
            <input value={d.captions[k] || ''} aria-label={`Caption for step ${k}`} placeholder={k ? `Caption for step ${k}` : 'Before any step'}
              onChange={e => { const v = e.target.value; edit(m => { if (v) m.captions[k] = v; else delete m.captions[k] }, 'caption:' + k) }} style={inputStyle} />
          </div>
        ))}
        <span style={smallLabel}>Use $…$ for maths, as in $A \cup B$.</span>
        {a.maxStep > 0 && (
          <>
            <label style={check}><input type="checkbox" checked={d.dimPast} onChange={e => edit(m => { m.dimPast = e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Dim earlier steps</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              First step at slide step
              <input type="number" min={1} max={1000} value={d.stepStart}
                onChange={e => { const v = Math.round(Number(e.target.value)); if (v >= 1 && v <= 1000) edit(m => { m.stepStart = v }) }} style={{ ...inputStyle, width: 60 }} />
            </label>
          </>
        )}
      </section>
    </>
  )
}

function NumbersTab({ d, a, edit }) {
  const vals = d.regions.values, n = a.n
  const msgs = []
  if ((vals === 'counts' || vals === 'probability') && a.num) {
    const s = a.num
    for (const e of s.errors) msgs.push([BADC, `Line ${e.line + 1}: ${e.msg}`])
    for (const l of s.contradictions) msgs.push([BADC, l < 0 ? 'The facts contradict each other.' : `Line ${l + 1} contradicts the lines above it.`])
    for (const l of s.redundant) msgs.push(['var(--text-muted, #888)', `Line ${l + 1} follows from the lines above it.`])
    s.value.forEach((v, r) => {
      if (v == null || !has(a.visible, r)) return
      if (v < -1e-9) msgs.push([WARN, `${a.nameOf(r)} comes out as ${fmtValue(v, vals)}, which can’t be.`])
      else if (vals === 'counts' && Math.abs(v - Math.round(v)) > 1e-6) msgs.push([WARN, `${a.nameOf(r)} comes out as ${v.toFixed(2)}, which isn’t a whole number.`])
      else if (vals === 'probability' && v > 1 + 1e-9) msgs.push([WARN, `${a.nameOf(r)} comes out above 1.`])
    })
    for (const t of s.notes) msgs.push([WARN, t])
    const unknown = s.value.filter((v, r) => v == null && has(a.visible, r)).length
    if (!s.facts) msgs.push(['var(--text-muted, #888)', 'Add a fact on each line.'])
    else if (unknown) msgs.push(['var(--text-muted, #888)', `${unknown} region${unknown > 1 ? 's aren’t' : ' isn’t'} settled yet, shown as ?. Each new fact can settle one more.`])
    else if (!s.errors.length && !s.contradictions.length) msgs.push([OKC, 'Every region is settled.'])
  }
  if (vals === 'elements' && a.mem) {
    for (const t of a.mem.notes) msgs.push([WARN, t])
    if (!a.mem.universeGiven) msgs.push(['var(--text-muted, #888)', 'Without the universe’s members, nothing lands outside the sets.'])
  }
  return (
    <>
      <section style={section}>
        <div style={sectionTitle}>In the regions</div>
        <Segmented label="In the regions" value={vals} onChange={v => edit(m => { m.regions.values = v })} options={[['none', 'Nothing'], ['counts', 'Counts'], ['probability', 'Probability'], ['elements', 'Members']]} />
      </section>
      {(vals === 'counts' || vals === 'probability') && (
        <section style={section}>
          <div style={sectionTitle}>Facts</div>
          <textarea value={d.facts.join('\n')} rows={Math.max(4, d.facts.length + 1)} spellCheck={false} aria-label="Facts, one per line"
            onChange={e => { const v = e.target.value; edit(m => { m.facts = v.split('\n') }, 'facts') }} style={{ ...texInput, resize: 'vertical', lineHeight: 1.55 }} />
          <span style={smallLabel}>One per line: {vals === 'probability' ? 'P(A) = 0.3, P(A ∩ B) = 1/10, P(A | B) = 0.5. The regions add up to 1.' : '|U| = 40, |A ∩ B| = 7, n(A) = 22.'}</span>
        </section>
      )}
      {vals === 'elements' && (
        <section style={section}>
          <div style={sectionTitle}>Members</div>
          {['U', ...d.sets.map(s => s.id)].map(k => (
            <label key={k} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', gap: 6, alignItems: 'center' }}>
              <span style={{ color: 'var(--text-primary, #fff)' }}><Tex tex={k === 'U' ? d.universe.label : k} /></span>
              <input value={d.members[k] || ''} spellCheck={false} placeholder={k === 'U' ? '1..12' : '2, 4, 6'} aria-label={`Members of ${k}`}
                onChange={e => { const v = e.target.value; edit(m => { if (v) m.members[k] = v; else delete m.members[k] }, 'members:' + k) }} style={texInput} />
            </label>
          ))}
          <span style={smallLabel}>Separate members with commas. Ranges like 1..12 work.</span>
        </section>
      )}
      {msgs.length > 0 && <section style={{ ...section, gap: 4 }}>{msgs.map(([c, t], i) => <p key={i} style={{ margin: 0, color: c, lineHeight: 1.45 }}>{t}</p>)}</section>}
      {vals !== 'none' && (
        <section style={section}>
          <div style={sectionTitle}>Reveal</div>
          <Segmented label="Reveal" value={d.regions.reveal} onChange={v => edit(m => { m.regions.reveal = v })} options={[['together', 'All at once'], ['inside-out', 'Inside out']]} />
          <div style={row}><span style={smallLabel}>From step</span><StepInput label="First step with numbers" value={d.regions.step} onChange={v => edit(m => { m.regions.step = v })} /></div>
          <span style={smallLabel}>{d.regions.reveal === 'inside-out' ? `The middle first, then a ring a step, outside last: steps ${d.regions.step} to ${d.regions.step + n}.` : 'Every region at once.'}</span>
        </section>
      )}
    </>
  )
}

function StyleTab({ d, edit }) {
  const [msg, setMsg] = useState('')
  return (
    <>
      <section style={section}>
        <div style={sectionTitle}>Sets</div>
        {d.sets.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '22px 36px minmax(0, 1fr)', gap: 6, alignItems: 'center' }}>
            <button type="button" title="Change its colour" aria-label={`Change ${s.id}’s colour`} onClick={() => edit(m => { m.sets[i].color = nextSwatch(m.sets[i].color) })}
              style={{ width: 20, height: 20, borderRadius: '50%', padding: 0, cursor: 'pointer', border: '2px solid var(--bg-card, #1e1e2e)', boxShadow: '0 0 0 1px var(--border, #444)', background: s.color }} />
            <input key={s.id} defaultValue={s.id} maxLength={1} aria-label={`Letter for set ${i + 1}`} style={{ ...inputStyle, textAlign: 'center', fontStyle: 'italic', fontSize: 14, padding: '4px 2px' }}
              onBlur={e => {
                const to = e.target.value.trim()
                let why = null
                edit(m => { why = renameSet(m, i, to) })
                if (why) { e.target.value = s.id; setMsg(why) } else setMsg('')
              }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
            <input value={s.label} spellCheck={false} aria-label={`Label for ${s.id}`} onChange={e => { const v = e.target.value; edit(m => { m.sets[i].label = v }, 'label:' + i) }} style={texInput} />
          </div>
        ))}
        <span style={{ ...smallLabel, color: msg ? WARN : undefined }}>{msg || 'The letter is how expressions name a set. The label is any TeX, like \\text{French}.'}</span>
      </section>
      <section style={section}>
        <div style={sectionTitle}>Universe</div>
        <label style={check}><input type="checkbox" checked={d.universe.show} onChange={e => edit(m => { m.universe.show = e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Draw the universe</label>
        <div style={row}>
          {UNIVERSE_LABELS.map(l => (
            <button key={l} type="button" aria-pressed={d.universe.label === l} onClick={() => edit(m => { if (!m.sets.some(s => s.id === l)) m.universe.label = l })}
              style={{ ...chip, borderColor: d.universe.label === l ? 'var(--accent, #6366f1)' : undefined }}><Tex tex={l} /></button>
          ))}
        </div>
      </section>
      <section style={section}>
        <div style={sectionTitle}>Complement</div>
        <Segmented label="Complement" value={d.notation.complement} onChange={v => edit(m => { m.notation.complement = v })} options={[['prime', <Tex key="p" tex="A'" />], ['c', <Tex key="c" tex="A^c" />], ['bar', <Tex key="b" tex="\overline{A}" />]]} />
        <span style={smallLabel}>How region names, captions and rewritten expressions write it.</span>
      </section>
      <section style={section}>
        <div style={sectionTitle}>Drawing</div>
        <Segmented label="Outlines" value={d.outlines} onChange={v => edit(m => { m.outlines = v })} options={[['ink', 'Outlines in the line colour'], ['sets', 'In each set’s colour']]} />
        <div style={row}>
          <span style={smallLabel}>Shading</span>
          {VENN_SWATCHES.map(c => (
            <button key={c} type="button" aria-label={`Shade in ${c}`} aria-pressed={(d.result.color || SHADE_COLOR) === c} onClick={() => edit(m => { m.result.color = c === SHADE_COLOR ? null : c })}
              style={{ width: 20, height: 20, borderRadius: '50%', padding: 0, cursor: 'pointer', border: '2px solid var(--bg-card, #1e1e2e)', boxShadow: (d.result.color || SHADE_COLOR) === c ? '0 0 0 2px var(--accent, #6366f1)' : '0 0 0 1px var(--border, #444)', background: c }} />
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Line colour
          <input type="color" value={d.color} onChange={e => { const v = e.target.value; edit(m => { m.color = v }, 'color') }}
            style={{ width: 28, height: 22, border: '1px solid var(--border, #333)', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }} />
        </label>
      </section>
    </>
  )
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The geometry editor, on the shared editor frame. Tools down the left; in
// the middle, the figure on the slide's color, at the element's shape; on
// the right, the construction (each object, what it's made from, its style),
// the same as a script, the steps, and the figure's colors, axes and grid.
// A tool takes clicks in turn: a click on a point uses it, and anywhere
// else makes one, on a curve if it's on one and where two cross if it's at
// a crossing. Move drags the free (blue) points, and the green ones along
// their curves; dragging empty space pans and the wheel zooms.

import { useState, useRef, useMemo, useEffect, useLayoutEffect, useCallback } from 'react'
import DiagramEditorFrame, { ui, Segmented, PanelTabs } from './DiagramEditorFrame'
import { GEO } from '../utils/geometryEngine'
import { GEOMETRY_TEMPLATES, GEOMETRY_CSS, geometryLabeler, geometryModel, geometryPlan, geometryTikz, geometryFromTemplate, fitView, stepsPerLine } from '../utils/geometryDiagram'
import { texHtml } from './FeynmanView'

// Labels by KaTeX, as on the slide
const katexLabel = geometryLabeler(texHtml)

const I = body => `<svg viewBox="0 0 30 22" width="30" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${body}</svg>`
const dot = (x, y, f) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${f || 'currentColor'}" stroke="none"/>`
const TOOLS = [
  { group: 'Move' },
  { key: 'move', name: 'Move', icon: I('<path d="M9 4l12 9-6 1 3 6-3 1-3-6-4 4z" fill="currentColor" stroke="none"/>'), hint: 'Drag the blue points, or the green ones along their curves. Drag empty space to pan; scroll to zoom.' },
  { group: 'Points' },
  { key: 'point', name: 'Point', need: ['pt'], icon: I(dot(15, 11)), hint: 'Click to place a point. On a curve it stays on it; where two cross, it’s their crossing.' },
  { key: 'intersect', name: 'Intersect', need: ['curve', 'curve'], icon: I('<path d="M3 18L27 4"/><circle cx="16" cy="12" r="7"/>' + dot(22, 7.5)), hint: 'Click two lines or circles, the second near the crossing you want.' },
  { key: 'midpoint', name: 'Midpoint', cmd: 'Midpoint', need: ['pt', 'pt'], point: true, icon: I('<path d="M4 16L26 6"/>' + dot(4, 16) + dot(26, 6) + dot(15, 11, '#e3a400')), hint: 'Click two points.' },
  { group: 'Lines' },
  { key: 'segment', name: 'Segment', cmd: 'Segment', need: ['pt', 'pt'], icon: I('<path d="M5 17L25 5"/>' + dot(5, 17) + dot(25, 5)), hint: 'Click two points.' },
  { key: 'line', name: 'Line', cmd: 'Line', need: ['pt', 'pt'], icon: I('<path d="M1 19L29 3"/>' + dot(9, 14.5) + dot(21, 7.5)), hint: 'Click two points.' },
  { key: 'ray', name: 'Ray', cmd: 'Ray', need: ['pt', 'pt'], icon: I('<path d="M5 17L29 3"/>' + dot(5, 17) + dot(18, 9.5)), hint: 'Click where it starts, then a point it goes through.' },
  { key: 'perp', name: 'Perpendicular', cmd: 'Perpendicular', need: ['line', 'pt'], icon: I('<path d="M2 17H28M15 2V20"/><path d="M15 13h4v4" stroke-width="1"/>'), hint: 'Click a line, then the point it goes through.' },
  { key: 'para', name: 'Parallel', cmd: 'Parallel', need: ['line', 'pt'], icon: I('<path d="M2 16L28 10M2 9L28 3"/>'), hint: 'Click a line, then the point it goes through.' },
  { key: 'pbis', name: 'Perpendicular bisector', cmd: 'PerpendicularBisector', need: ['pt', 'pt'], icon: I('<path d="M4 15H26M15 2V21"/>' + dot(4, 15) + dot(26, 15)), hint: 'Click the two points it’s halfway between.' },
  { key: 'abis', name: 'Angle bisector', cmd: 'AngleBisector', need: ['pt', 'pt', 'pt'], icon: I('<path d="M4 19L27 19M4 19L20 3"/><path d="M4 19L28 9" stroke-dasharray="3 2"/>'), hint: 'Click a point on one arm, the vertex, then a point on the other arm.' },
  { group: 'Circles' },
  { key: 'circle', name: 'Circle', cmd: 'Circle', need: ['pt', 'pt'], icon: I('<circle cx="14" cy="11" r="8"/>' + dot(14, 11) + dot(22, 11)), hint: 'Click the center, then a point it passes through.' },
  { key: 'circle3', name: 'Circle through 3', cmd: 'Circle', need: ['pt', 'pt', 'pt'], icon: I('<circle cx="15" cy="11" r="8.5"/>' + dot(7, 9) + dot(20, 4.3) + dot(19, 18.3)), hint: 'Click three points.' },
  { group: 'Shapes and measures' },
  { key: 'poly', name: 'Polygon', need: 'poly', icon: I('<path d="M5 18L15 3L26 15Z" fill="currentColor" fill-opacity="0.2"/>'), hint: 'Click the corners, then the first again to close it.' },
  { key: 'angle', name: 'Angle', cmd: 'Angle', need: ['pt', 'pt', 'pt'], icon: I('<path d="M5 18H27M5 18L22 4"/><path d="M13 18a8 8 0 0 0-2-5.5"/>'), hint: 'Click a point on one arm, the vertex, then a point on the other arm.' },
  { key: 'dist', name: 'Distance', cmd: 'Distance', need: ['pt', 'pt'], icon: I('<path d="M4 15H26M4 11V19M26 11V19"/><path d="M11 7h8" stroke-width="1"/>'), hint: 'Click two points.' },
  { key: 'del', name: 'Delete', need: ['any'], icon: I('<path d="M7 7L23 17M23 7L7 17"/>'), hint: 'Click something to delete it, with everything made from it.' },
]
const COLORS = [['', 'Its usual color'], ['red', 'Red'], ['blue', 'Blue'], ['green', 'Green'], ['yellow', 'Yellow'], ['purple', 'Purple']]
const r2 = v => Math.round(v * 100) / 100
const copyObjs = objs => objs.map(o => ({ ...o, args: [...o.args], opts: { ...o.opts } }))

export default function GeometryEditorModal({ initial, size, slideBg, isNew, onSave, onClose }) {
  const W = size?.w || 640, H = size?.h || 400
  const start = useMemo(() => {
    const m = geometryModel({ ...initial, width: W, height: H })
    return { objs: GEO.parse(m.script).objs, view: m.view, theme: m.theme, axes: m.axes, grid: m.grid, steps: m.steps, start: m.start, tidy: m.tidy, captions: m.captions, stepStart: m.stepStart }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [d, setD] = useState(start)
  const [tool, setTool] = useState('move')
  const [picks, setPicks] = useState([])
  const [poly, setPoly] = useState([])
  const [hover, setHover] = useState(null)
  const [sel, setSel] = useState(null)
  const [mouse, setMouse] = useState(null)
  const [tab, setTab] = useState('construction')
  const [preview, setPreview] = useState(null) // { step, anim }
  const [scriptText, setScriptText] = useState(null) // while the script is being edited
  const [scriptErrors, setScriptErrors] = useState([])
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState('')
  const past = useRef([]), future = useRef([]), dialogRef = useRef(null), stageRef = useRef(null), dragRef = useRef(null)
  // Points a tool has made for its picks, added with what it makes
  const pending = useRef([])
  const startJson = useRef(JSON.stringify(start))
  const [box, setBox] = useState({ w: W, h: H })

  useEffect(() => { dialogRef.current?.focus() }, [])
  // The figure's frame, as large as the middle allows at the element's shape
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const fit = () => { const r = el.getBoundingClientRect(); const k = Math.min(r.width / W, r.height / H); setBox({ w: Math.floor(W * k), h: Math.floor(H * k) }) }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [W, H])

  const vals = useMemo(() => GEO.compute(d.objs), [d.objs])
  const frameOpts = { W, H, view: d.view }
  const snap = d.grid ? GEO.gridStep(GEO.frame(frameOpts).k) : 0

  // ---------- Changes, with undo
  const edit = useCallback((fn, keep) => {
    setD(prev => {
      if (!keep) { past.current.push(prev); if (past.current.length > 200) past.current.shift(); future.current = [] }
      const next = { ...prev, objs: copyObjs(prev.objs), steps: prev.steps.map(s => ({ ...s })) }
      fn(next)
      return next
    })
  }, [])
  const undo = () => { const p = past.current.pop(); if (!p) return; future.current.push(d); setD(p); setPicks([]); setPoly([]) }
  const redo = () => { const f = future.current.pop(); if (!f) return; past.current.push(d); setD(f) }
  const used = n => d.objs.some(o => o.name === n)
  const nextName = (kind, taken = []) => {
    const pool = { point: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', angle: 'αβγδεθφψω', other: 'fghkmnpqrsuvwabcde' }[kind] || 'fghkmnpqrsuvwabcde'
    for (let r = 0; r < 50; r++) for (const ch of pool) { const n = ch + (r || ''); if (!used(n) && !taken.includes(n)) return n }
    return kind + d.objs.length
  }
  // Adds objects (the points a tool made, then what it makes) as one change
  // and, if the build had reached the end, as a step of its own
  const add = list => {
    edit(m => {
      const was = m.objs.length
      m.objs.push(...list)
      if (m.objs.length > 400) m.objs.length = 400
      const last = m.steps[m.steps.length - 1]
      if (last && last.to >= was && m.objs.length > was) m.steps.push({ to: m.objs.length, caption: '' })
    })
    setPreview(null)
  }

  // ---------- Pointer to the figure, in the element's px
  const at = ev => {
    const svg = stageRef.current?.querySelector('svg')
    const ctm = svg?.getScreenCTM()
    if (!ctm) return null
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY
    const p = pt.matrixTransform(ctm.inverse()), w = GEO.toWorld(frameOpts, p.x, p.y)
    return { sx: p.x, sy: p.y, x: w.x, y: w.y }
  }
  // What's under the pointer, the points a tool has made but not yet added included
  const hits = m => {
    if (!pending.current.length) return GEO.hit(d.objs, vals, frameOpts, m.sx, m.sy)
    const all = [...d.objs, ...pending.current]
    return GEO.hit(all, GEO.compute(all), frameOpts, m.sx, m.sy)
  }

  // The point a click means: one already there, else a new one, at a
  // crossing, on a curve, or free (on the grid, if there is one)
  const pointAt = (m, pending) => {
    const h = hits(m), pt = h.find(x => x.point)
    if (pt) return { name: pt.name, made: [] }
    const curves = h.filter(x => x.curve), F = GEO.frame(frameOpts), name = nextName('point', pending.map(o => o.name))
    if (curves.length >= 2) {
      let best = null
      for (let i = 0; i < curves.length; i++) for (let j = i + 1; j < curves.length; j++) {
        GEO.intersections(vals[curves[i].name], vals[curves[j].name]).forEach((q, k) => {
          if (!q) return
          const s = GEO.toScreen(F, q), dd = Math.hypot(s.x - m.sx, s.y - m.sy)
          if (dd < 14 && (!best || dd < best.d)) best = { d: dd, a: curves[i].name, b: curves[j].name, k }
        })
      }
      if (best) return { name, made: [{ name, cmd: 'Intersect', args: [best.a, best.b, best.k], opts: {} }] }
    }
    if (curves.length) {
      const c = curves[0].name, obj = { name, cmd: 'PointOn', args: [c, 0], opts: {} }
      GEO.dragTo(obj, vals, m)
      return { name, made: [obj] }
    }
    const x = snap ? Math.round(m.x / snap) * snap : r2(m.x), y = snap ? Math.round(m.y / snap) * snap : r2(m.y)
    return { name, made: [{ name, cmd: 'Point', args: [r2(x), r2(y)], opts: {} }] }
  }

  const click = m => {
    const t = TOOLS.find(x => x.key === tool)
    if (!t?.need) return
    if (t.key === 'del') { const h = hits(m)[0]; if (h) remove(h.name); return }
    if (t.key === 'point') { const p = pointAt(m, []); if (p.made.length) add(p.made); return }
    if (t.need === 'poly') {
      const p = pointAt(m, pending.current)
      if (poly.length >= 3 && p.name === poly[0]) {
        let n = 1
        while (used('t' + n)) n++
        add([...pending.current, { name: 't' + n, cmd: 'Polygon', args: poly, opts: {} }])
        pending.current = []; setPoly([])
        return
      }
      pending.current.push(...p.made)
      if (!poly.includes(p.name)) setPoly([...poly, p.name])
      return
    }
    const want = t.need[picks.length]
    let got = null
    if (want === 'pt') {
      const p = pointAt(m, pending.current)
      if (picks.includes(p.name)) { setNote('Pick a different point.'); return }
      pending.current.push(...p.made); got = p.name
    }
    else if (want === 'line') got = hits(m).find(h => GEO.isLine(vals[h.name]))?.name
    else if (want === 'curve') got = hits(m).find(h => h.curve && !picks.includes(h.name))?.name
    if (!got) { setNote(want === 'line' ? 'Click a line, ray or segment.' : want === 'curve' ? 'Click a line or a circle.' : ''); return }
    setNote('')
    const all = [...picks, got]
    if (all.length < t.need.length) { setPicks(all); return }
    setPicks([])
    const made = pending.current
    pending.current = []
    if (t.key === 'intersect') {
      const xs = GEO.intersections(vals[all[0]], vals[all[1]])
      if (!xs.some(Boolean)) { setNote('Those don’t cross.'); return }
      let k = 0, bd = Infinity
      xs.forEach((q, i) => { if (q) { const dd = Math.hypot(q.x - m.x, q.y - m.y); if (dd < bd) { bd = dd; k = i } } })
      add([{ name: nextName('point'), cmd: 'Intersect', args: [all[0], all[1], k], opts: {} }])
      return
    }
    const args = t.key === 'perp' || t.key === 'para' ? [all[1], all[0]] : all
    const kind = t.point ? 'point' : t.cmd === 'Angle' ? 'angle' : 'other'
    add([...made, { name: nextName(kind, made.map(o => o.name)), cmd: t.cmd, args, opts: {} }])
  }

  const remove = name => {
    const gone = new Set([name])
    d.objs.forEach(o => { if (o.args.some(a => gone.has(a))) gone.add(o.name) })
    edit(m => {
      // Steps keep to the same objects, those left
      const kept = [0]
      m.objs.forEach((o, i) => kept.push(kept[i] + (gone.has(o.name) ? 0 : 1)))
      m.objs = m.objs.filter(o => !gone.has(o.name))
      m.steps = m.steps.map(st => ({ ...st, to: kept[Math.min(st.to, kept.length - 1)] })).filter((st, i, all) => i === 0 || st.to > all[i - 1].to)
      if (m.start != null) m.start = kept[Math.min(m.start, kept.length - 1)]
    })
    if (gone.has(sel)) setSel(null)
  }

  // ---------- Pointer events on the figure
  const onPointerDown = ev => {
    // The figure is redrawn under the pointer, so the browser would find
    // nothing to focus and drop focus to the page, sending keys like Ctrl+Z
    // to the slide editor; keep it on the dialog
    ev.preventDefault()
    dialogRef.current?.focus({ preventScroll: true })
    if (ev.button !== 0 || preview) return
    const m = at(ev)
    if (!m) return
    const h = hits(m).find(x => x.free)
    if (tool === 'move' && h) {
      dragRef.current = { name: h.name, moved: false }
      past.current.push(d); future.current = []
      ev.currentTarget.setPointerCapture(ev.pointerId)
      setSel(h.name)
      return
    }
    if (tool === 'move') {
      dragRef.current = { pan: true, sx: m.sx, sy: m.sy, view: d.view }
      ev.currentTarget.setPointerCapture(ev.pointerId)
      return
    }
    click(m)
  }
  const onPointerMove = ev => {
    const m = at(ev)
    if (!m) return
    setMouse(m)
    const dr = dragRef.current
    if (dr?.pan) {
      const k = W / dr.view.w
      edit(n => { n.view = { ...dr.view, x: r2(dr.view.x - (m.sx - dr.sx) / k), y: r2(dr.view.y + (m.sy - dr.sy) / k) } }, true)
      return
    }
    if (dr) {
      edit(n => { const ob = n.objs.find(o => o.name === dr.name); if (ob) GEO.dragTo(ob, GEO.compute(n.objs), m, snap) }, true)
      dr.moved = true
      return
    }
    const h = hits(m)[0]
    setHover(h ? h.name : null)
  }
  const onPointerUp = () => {
    const dr = dragRef.current
    if (dr && !dr.pan && !dr.moved) past.current.pop()
    dragRef.current = null
  }
  const onWheel = ev => {
    const m = at(ev)
    if (!m) return
    const f = Math.exp(ev.deltaY * 0.0015), w = Math.max(0.2, Math.min(5000, d.view.w * f)), k = W / w
    edit(n => { n.view = { x: r2(m.x - (m.sx - W / 2) / k), y: r2(m.y + (m.sy - H / 2) / k), w: r2(w) } }, true)
  }
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const stop = e => { e.preventDefault(); onWheel(e) }
    el.addEventListener('wheel', stop, { passive: false })
    return () => el.removeEventListener('wheel', stop)
  })

  // ---------- What's drawn: the figure, a faint preview of what the tool
  // will make, and in a build preview, the figure at that step
  const plan = useMemo(() => geometryPlan(geometryModel({ ...d, script: '', width: W, height: H }), d.objs), [d, W, H])
  const svg = useMemo(() => {
    const t = TOOLS.find(x => x.key === tool)
    let objs = d.objs, v = vals
    const sels = [...picks, ...poly, ...(sel ? [sel] : [])]
    if (!preview && mouse && t?.cmd && t.need.length - 1 === picks.length && t.need[t.need.length - 1] === 'pt' && t.cmd !== 'Angle' && t.cmd !== 'Distance' && t.cmd !== 'Midpoint') {
      const ghost = { name: '·p', cmd: 'Point', args: [mouse.x, mouse.y], opts: { hidden: true } }
      const args = t.key === 'perp' || t.key === 'para' ? ['·p', picks[0]] : [...picks, '·p']
      objs = [...d.objs, ...pending.current, ghost, { name: '·g', cmd: t.cmd, args, opts: { construction: true } }]
      v = GEO.compute(objs)
    } else if (!preview && mouse && poly.length) {
      objs = [...d.objs, ...pending.current, { name: '·p', cmd: 'Point', args: [mouse.x, mouse.y], opts: { hidden: true } }, { name: '·g', cmd: 'Polygon', args: [...poly, '·p'], opts: { construction: true } }]
      v = GEO.compute(objs)
    } else if (pending.current.length) {
      objs = [...d.objs, ...pending.current]
      v = GEO.compute(objs)
    }
    const o = { W, H, view: d.view, dark: d.theme === 'dark', axes: d.axes, grid: d.grid, label: katexLabel, hover: preview ? null : hover, sel: preview ? [] : sels }
    if (preview) Object.assign(o, { upto: plan.to[preview.step], tidy: plan.tidyAt != null && preview.step >= plan.tidyAt, caption: plan.captions[preview.step], anim: preview.anim })
    return GEO.render(objs, v, o)
  }, [d, vals, tool, picks, poly, mouse, hover, sel, preview, plan, W, H])

  // ---------- Keys
  const onKeyDown = ev => {
    const typing = ev.target.closest?.('input, textarea, select')
    const mod = ev.metaKey || ev.ctrlKey, k = ev.key.toLowerCase()
    if (mod && (k === 'z' || k === 'y') && !typing) { ev.preventDefault(); if (k === 'y' || ev.shiftKey) redo(); else undo(); return }
    if (typing || mod) return
    if (preview) {
      if (ev.key === 'ArrowRight' || ev.key === ' ' || ev.key === 'PageDown') { ev.preventDefault(); stepTo(preview.step + 1) }
      else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); stepTo(preview.step - 1) }
      else if (ev.key === 'Escape') setPreview(null)
      return
    }
    if (ev.key === 'Escape') { setPicks([]); setPoly([]); pending.current = []; setSel(null); setNote('') }
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && sel) { ev.preventDefault(); remove(sel) }
  }
  const stepTo = n => setPreview(pv => {
    const step = Math.max(0, Math.min(plan.to.length - 1, n))
    return { step, anim: pv && step > pv.step && plan.to[step] > plan.to[pv.step] ? plan.to[pv.step] : null }
  })

  // ---------- Saving
  const model = () => ({ script: GEO.serialize(d.objs), view: d.view, theme: d.theme, axes: d.axes, grid: d.grid, steps: d.steps, start: d.start, tidy: d.tidy, captions: d.captions, stepStart: d.stepStart })
  const save = () => onSave(model())
  const cancel = () => {
    if (JSON.stringify(d) !== startJson.current && !confirm('Discard your changes to this figure?')) return
    onClose()
  }
  const loadTemplate = key => {
    if (d.objs.length && !confirm('Replace this figure with the template?')) return
    const t = geometryFromTemplate(key, { dark: d.theme === 'dark', W, H })
    edit(m => { m.objs = GEO.parse(t.script).objs; m.view = t.view; m.steps = t.steps; m.start = null })
    setPicks([]); setPoly([]); setSel(null); setPreview(null)
  }
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1500) }
    catch (e) { alert('Couldn’t copy: ' + e.message) }
  }

  const t = TOOLS.find(x => x.key === tool)
  const hint = preview
    ? '→ or Space goes to the next step, ← goes back, Esc returns to editing.'
    : note || (t.hint + (picks.length ? `  ${picks.length} of ${t.need.length} picked; Esc starts over.` : '') + (poly.length ? `  ${poly.length} corners so far.` : ''))
  const selObj = d.objs.find(o => o.name === sel)

  return (
    <DiagramEditorFrame
      title="Geometry" hint={hint} dialogRef={dialogRef} onKeyDown={onKeyDown} busy={!!preview} help="tutorials/geometry-constructions"
      templates={GEOMETRY_TEMPLATES} onTemplate={loadTemplate}
      actions={<>
        <button className="btn btn-secondary" style={ui.smallButton} disabled={!!preview || !past.current.length} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
        <button className="btn btn-secondary" style={ui.smallButton} disabled={!!preview || !future.current.length} onClick={redo} title="Redo (Ctrl+Shift+Z)">Redo</button>
        <button className="btn btn-secondary" style={ui.smallButton} disabled={!!preview} onClick={() => edit(m => { m.view = fitView(m.objs, GEO.compute(m.objs), W, H) })} title="Frame the figure">Fit</button>
        {preview
          ? <button className="btn btn-primary" style={ui.smallButton} onClick={() => setPreview(null)}>Back to editing</button>
          : <button className="btn btn-primary" style={ui.smallButton} onClick={() => { setPreview({ step: 0, anim: null }); setPicks([]); setPoly([]); pending.current = [] }}>Preview build</button>}
      </>}
      leftWidth={176}
      left={<div role="toolbar" aria-label="Tools" style={{ padding: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
        {TOOLS.map((x, i) => x.group
          ? <div key={i} style={{ ...ui.sectionTitle, fontSize: 10.5, margin: i ? '8px 2px 2px' : '0 2px 2px', gridColumn: '1 / -1' }}>{x.group}</div>
          : <button key={x.key} type="button" title={x.hint} aria-pressed={tool === x.key}
              onClick={() => { setTool(x.key); setPicks([]); setPoly([]); pending.current = []; setNote('') }}
              style={{ display: 'grid', justifyItems: 'center', gap: 2, padding: '5px 2px', borderRadius: 6, cursor: 'pointer', fontSize: 11, lineHeight: 1.15, color: tool === x.key ? '#fff' : 'var(--text-primary, #fff)', border: '1px solid transparent', background: tool === x.key ? 'var(--accent, #6366f1)' : 'none' }}>
              <span dangerouslySetInnerHTML={{ __html: x.icon }} />{x.name}
            </button>)}
      </div>}
      right={<>
        <PanelTabs value={tab} onChange={setTab} tabs={[['construction', 'Construction'], ['script', 'Script'], ['steps', 'Steps'], ['style', 'Figure']]} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px 16px', display: 'flex', flexDirection: 'column', gap: 14, opacity: preview ? 0.5 : 1, pointerEvents: preview ? 'none' : undefined }}>
          {tab === 'construction' && <ConstructionTab d={d} vals={vals} sel={selObj} setSel={setSel} setHover={setHover} edit={edit} remove={remove} />}
          {tab === 'script' && (
            <section style={ui.section}>
              <textarea value={scriptText ?? GEO.serialize(d.objs)} spellCheck={false} aria-label="Construction script" onChange={e => setScriptText(e.target.value)}
                style={{ ...ui.input, fontFamily: ui.mono, fontSize: 12, lineHeight: 1.55, minHeight: 320, resize: 'vertical', whiteSpace: 'pre' }} />
              {scriptErrors.map((e, i) => <div key={i} role="alert" style={{ color: ui.warn, lineHeight: 1.4 }}>Line {e.line}: {e.msg}</div>)}
              <div style={ui.row}>
                <button className="btn btn-primary" style={ui.smallButton} disabled={scriptText == null} onClick={() => {
                  const p = GEO.parse(scriptText)
                  setScriptErrors(p.errors)
                  if (p.errors.length) return
                  edit(m => {
                    // Framed anew if any of it is out of view
                    const v = GEO.compute(p.objs), F = GEO.frame({ W, H, view: m.view })
                    const out = p.objs.some(o => { const q = v[o.name]; if (!GEO.isPoint(q) || o.opts.hidden) return false; const sp = GEO.toScreen(F, q); return sp.x < 0 || sp.x > W || sp.y < 0 || sp.y > H })
                    const grew = p.objs.length > m.objs.length, last = m.steps[m.steps.length - 1]
                    if (grew && last && last.to >= m.objs.length) m.steps.push({ to: p.objs.length, caption: '' })
                    m.objs = p.objs
                    if (out) m.view = fitView(p.objs, v, W, H)
                  })
                  setScriptText(null)
                }}>Apply</button>
                {scriptText != null && <button className="btn btn-secondary" style={ui.smallButton} onClick={() => { setScriptText(null); setScriptErrors([]) }}>Discard</button>}
              </div>
              <span style={ui.smallLabel}>A line a step, in GeoGebra’s command names: c = Circle(A, B), C = Intersect(c, d, 0). After a line, {'{construction}'} draws it as working, {'{hidden}'} hides it, {'{color=red}'} colors it.</span>
            </section>
          )}
          {tab === 'steps' && <StepsTab d={d} plan={plan} edit={edit} />}
          {tab === 'style' && (
            <>
              <section style={ui.section}>
                <div style={ui.sectionTitle}>Colors</div>
                <Segmented label="Colors" value={d.theme} onChange={v => edit(m => { m.theme = v })} options={[['dark', 'For a dark slide'], ['light', 'For a light slide']]} />
              </section>
              <section style={ui.section}>
                <div style={ui.sectionTitle}>Axes and grid</div>
                <label style={ui.check}><input type="checkbox" checked={d.axes} onChange={e => edit(m => { m.axes = e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Axes, numbered</label>
                <label style={ui.check}><input type="checkbox" checked={d.grid} onChange={e => edit(m => { m.grid = e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> A grid, which free points snap to</label>
              </section>
              <section style={ui.section}>
                <div style={ui.sectionTitle}>Copy</div>
                <div style={ui.row}>
                  <button className="btn btn-secondary" style={ui.smallButton} onClick={() => copy(geometryTikz({ ...model(), width: W, height: H }), 'tikz')}>{copied === 'tikz' ? 'Copied' : 'tkz-euclide'}</button>
                  <button className="btn btn-secondary" style={ui.smallButton} onClick={() => copy(GEO.serialize(d.objs), 'script')}>{copied === 'script' ? 'Copied' : 'Script'}</button>
                </div>
                <span style={ui.smallLabel}>tkz-euclide keeps the construction, so the figure moves in LaTeX too: \usepackage{'{tkz-euclide}'}.</span>
              </section>
            </>
          )}
        </div>
      </>}
      onCancel={cancel} onSave={save} saveLabel={isNew ? 'Insert' : 'Save'}
    >
      <style>{GEOMETRY_CSS}</style>
      <div ref={stageRef} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          onPointerLeave={() => { setMouse(null); setHover(null) }}
          style={{ width: box.w, height: box.h, background: slideBg, borderRadius: 4, boxShadow: '0 0 0 1px var(--border, #333)', touchAction: 'none', userSelect: 'none', overflow: 'hidden',
            cursor: dragRef.current ? 'grabbing' : tool === 'move' ? (d.objs.some(o => o.name === hover && (o.cmd === 'Point' || o.cmd === 'PointOn')) ? 'grab' : 'default') : 'crosshair' }}
          dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      {preview && (
        <div style={{ ...ui.row, fontSize: 12.5, color: 'var(--text-secondary, #ccc)' }}>
          <button className="btn btn-secondary" style={ui.smallButton} onClick={() => stepTo(preview.step - 1)} disabled={preview.step <= 0} aria-label="Previous step">◀</button>
          <span style={{ minWidth: 92, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>Step {preview.step} of {plan.to.length - 1}</span>
          <button className="btn btn-secondary" style={ui.smallButton} onClick={() => stepTo(preview.step + 1)} disabled={preview.step >= plan.to.length - 1} aria-label="Next step">▶</button>
          {plan.to.length < 2 && <span style={ui.smallLabel}>Everything shows at once. The Steps tab makes steps.</span>}
        </div>
      )}
    </DiagramEditorFrame>
  )
}

// Each object, what it's made from, and the selected one's style
function ConstructionTab({ d, vals, sel, setSel, setHover, edit, remove }) {
  // The objects' names in italics, as in math: B and C in "the triangle ABC",
  // not the M of "Mark" (the article "a" can't be told from a name a).
  // Names are letters, digits, _ and ', none of them special in a RegExp
  const nameRe = useMemo(() => {
    const names = d.objs.map(o => o.name).filter(n => n !== 'a').sort((x, y) => y.length - x.length)
    return names.length ? new RegExp(`(?<![a-z0-9_α-ω])(${names.join('|')})(?![a-z0-9_'α-ω])`, 'g') : null
  }, [d.objs])
  const italic = text => (nameRe ? text.split(nameRe) : [text]).map((part, i) => (i % 2 ? <i key={i} style={{ fontFamily: "'Times New Roman', serif", fontSize: '1.08em' }}>{part}</i> : part))
  return (
    <>
      {sel && (
        <section style={{ ...ui.section, padding: 10, borderRadius: 8, border: '1px solid var(--border, #333)' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{italic(GEO.describe(sel))}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 10px', alignItems: 'center' }}>
            <span style={ui.smallLabel}>Color</span>
            <select value={sel.opts.color || ''} onChange={e => { const v = e.target.value; edit(m => { const o = m.objs.find(x => x.name === sel.name); if (v) o.opts.color = v; else delete o.opts.color }) }} style={ui.input}>
              {COLORS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
            <span style={ui.smallLabel}>Label</span>
            <input value={typeof sel.opts.label === 'string' ? sel.opts.label : ''} placeholder={GEO.isPoint(vals[sel.name]) ? GEO.labelTex(sel.name) : 'None'} maxLength={60}
              onChange={e => { const v = e.target.value.replace(/[,{}]/g, ''); edit(m => { const o = m.objs.find(x => x.name === sel.name); if (v) o.opts.label = v; else delete o.opts.label }, true) }}
              style={{ ...ui.input, fontFamily: ui.mono }} title="TeX, like A' or P_1" />
          </div>
          <div style={ui.row}>
            <label style={ui.check}><input type="checkbox" checked={!!sel.opts.construction} onChange={e => edit(m => { const o = m.objs.find(x => x.name === sel.name); if (e.target.checked) o.opts.construction = true; else delete o.opts.construction })} style={{ accentColor: 'var(--accent)' }} /> Working</label>
            <label style={ui.check}><input type="checkbox" checked={!!sel.opts.hidden} onChange={e => edit(m => { const o = m.objs.find(x => x.name === sel.name); if (e.target.checked) o.opts.hidden = true; else delete o.opts.hidden })} style={{ accentColor: 'var(--accent)' }} /> Hidden</label>
            <button className="btn btn-secondary" style={ui.smallButton} onClick={() => remove(sel.name)}>Delete {sel.name}</button>
          </div>
        </section>
      )}
      <section style={ui.section}>
        <div style={ui.sectionTitle}>Construction · {d.objs.length}</div>
        {!d.objs.length && <span style={ui.smallLabel}>Nothing yet. Pick a tool on the left, or a template at the top.</span>}
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 1 }}>
          {d.objs.map((o, i) => (
            <li key={o.name} onClick={() => setSel(o.name)} onMouseEnter={() => setHover(o.name)} onMouseLeave={() => setHover(null)}
              style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr)', gap: 6, padding: '4px 6px', borderRadius: 5, cursor: 'pointer', background: sel?.name === o.name ? 'rgba(99,102,241,0.22)' : 'none', opacity: o.opts.hidden ? 0.5 : 1 }}
              title={vals[o.name] ? '' : 'It doesn’t exist as the figure is now'}>
              <span style={{ ...ui.smallLabel, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
              <span style={{ lineHeight: 1.35, fontStyle: o.opts.construction ? 'italic' : 'normal', color: o.opts.construction ? 'var(--text-muted, #888)' : undefined, textDecoration: vals[o.name] ? 'none' : 'line-through' }}>{italic(GEO.describe(o))}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}

// How the figure builds up when presented
function StepsTab({ d, plan, edit }) {
  const n = d.objs.length
  return (
    <>
      <section style={ui.section}>
        <div style={ui.sectionTitle}>Steps · {plan.to.length - 1}</div>
        <div style={ui.row}>
          <button className="btn btn-secondary" style={ui.smallButton} disabled={!n} onClick={() => edit(m => { m.steps = stepsPerLine(m.objs, m.start) })}>A step a line</button>
          <button className="btn btn-secondary" style={ui.smallButton} disabled={!d.steps.length} onClick={() => edit(m => { m.steps = [] })}>No steps</button>
        </div>
        <div style={ui.row}>
          <span>Shown before the first:</span>
          <input type="number" min={0} max={n} value={plan.to[0]} aria-label="Objects shown before the first step"
            onChange={e => { const v = Math.max(0, Math.min(n, Math.round(Number(e.target.value) || 0))); edit(m => { m.start = v }) }}
            style={{ ...ui.input, width: 56, textAlign: 'center' }} disabled={!d.steps.length} />
          <span>{plan.to[0] === 1 ? 'object' : 'objects'}</span>
        </div>
        {d.steps.map((s, i) => {
          const shown = plan.to[i + 1]
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 52px minmax(0, 1fr) auto', gap: 6, alignItems: 'center' }}>
              <span style={{ ...ui.smallLabel, minWidth: 40 }}>{i + 1}. to</span>
              <input type="number" min={1} max={n} value={s.to} aria-label={`Step ${i + 1} shows objects up to`}
                onChange={e => { const v = Math.max(0, Math.min(n, Math.round(Number(e.target.value) || 0))); edit(m => { m.steps[i].to = v }) }}
                style={{ ...ui.input, textAlign: 'center' }} />
              <input value={s.caption} maxLength={200} aria-label={`Step ${i + 1}’s caption`}
                placeholder={shown > 0 ? GEO.describe(d.objs[shown - 1]) : 'Caption'}
                onChange={e => { const v = e.target.value; edit(m => { m.steps[i].caption = v }, true) }} style={ui.input} />
              <button type="button" style={ui.iconButton} aria-label={`Remove step ${i + 1}`} title="Remove, joining it to the next" onClick={() => edit(m => { m.steps.splice(i, 1) })}>✕</button>
            </div>
          )
        })}
        {plan.rest && <span style={ui.smallLabel}>Then a step showing the rest, to object {n}.</span>}
        {d.steps.length > 0 && (
          <>
            <label style={ui.check}><input type="checkbox" checked={d.captions} onChange={e => edit(m => { m.captions = e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Captions under the figure</label>
            <label style={ui.check}><input type="checkbox" checked={d.tidy} onChange={e => edit(m => { m.tidy = e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> A last step that hides the working</label>
          </>
        )}
        <span style={ui.smallLabel}>A step shows the construction up to its object, drawing in what's new. An empty caption says what the step's last object is. Presented, the blue and green points can be dragged at every step.</span>
      </section>
    </>
  )
}

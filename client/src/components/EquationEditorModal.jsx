// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The interactive equation editor. The LaTeX, its terms and how they're
// labeled and stepped through are on the left; on the right, the equation as
// the slide will show it. In Select, a click on the drawn equation selects
// the part under it (each click again selects more around it, and a drag
// selects across parts), and Make term wraps that part of the source as
// \term{id}{…}. In Preview, the steps play as they will when presenting.

import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { X, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import katex from 'katex'
import EquationPalette from './EquationPalette'
import EquationView from './EquationView'
import {
  EQUATION_COLORS, EQUATION_FIELDS, parseLatex, pickSource, termAtoms, badTermIds, selectionBetween, selectionOf,
  growSelection, selectionHolds, selectionAtoms, selectionRange, selectedTerm, canWrap, selectionForRange,
  wrapAsTerm, unwrapTerm, newTermId, syncTerms, linkPhrase, unlinkTerm, equationConfig,
} from '../utils/equationTerms'

const KATEX_OPTIONS = () => ({
  displayMode: true,
  throwOnError: true,
  trust: ctx => ctx.command === '\\htmlData',
  strict: code => (code === 'htmlExtension' ? 'ignore' : 'warn'),
  macros: { '\\term': '\\htmlData{term=#1}{#2}' },
})

const inputStyle = {
  padding: '5px 7px', background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', borderRadius: 4,
  color: 'var(--text-primary, #fff)', fontSize: 12, boxSizing: 'border-box',
}
const smallLabel = { fontSize: 11, color: 'var(--text-muted, #888)' }
const sectionTitle = { fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted, #888)' }
const iconButton = {
  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #888)', padding: 3, display: 'flex', alignItems: 'center',
}
const STYLE_NAMES = { callout: 'Callout', brace: 'Brace', sentence: 'Sentence' }

function Segmented({ value, options, onChange, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'inline-flex', padding: 2, gap: 2, borderRadius: 6, border: '1px solid var(--border, #333)', background: 'var(--bg-hover, #252530)' }}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          style={{
            border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
            background: value === v ? 'var(--accent, #6366f1)' : 'transparent', color: value === v ? '#fff' : 'var(--text-secondary, #ccc)',
          }}>
          {text}
        </button>
      ))}
    </div>
  )
}

function NumberInput({ value, onChange, min, max, width = 56, title }) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])
  const commit = () => {
    const n = Math.round(Number(text))
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
    else setText(String(value))
  }
  return (
    <input type="number" value={text} min={min} max={max} title={title} onChange={e => setText(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit() }} style={{ ...inputStyle, width }} />
  )
}

// A term's color: the palette, or any color
function ColorPicker({ value, palette, onChange, label }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button type="button" aria-label={label} title="Color" onClick={() => setOpen(o => !o)}
        style={{ width: 18, height: 18, borderRadius: '50%', background: value, border: '2px solid var(--bg-card, #1e1e2e)', boxShadow: `0 0 0 1px ${value}`, cursor: 'pointer', padding: 0 }} />
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 1 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: 24, left: -4, zIndex: 2, display: 'flex', gap: 6, alignItems: 'center', padding: 8, borderRadius: 8, background: 'var(--bg-secondary, #262636)', border: '1px solid var(--border, #333)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            {palette.map(c => (
              <button key={c} type="button" aria-label={c} onClick={() => { onChange(c); setOpen(false) }}
                style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: c === value ? '2px solid var(--text-primary, #fff)' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
            ))}
            <label title="Any color" style={{ position: 'relative', width: 20, height: 20, borderRadius: '50%', border: '1px dashed var(--text-muted, #888)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted, #888)' }}>
              +
              <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
            </label>
          </div>
        </>
      )}
    </div>
  )
}

export default function EquationEditorModal({ initial, size, slideBg, dark, isNew, onSave, onClose }) {
  const palette = EQUATION_COLORS[dark ? 'dark' : 'light']
  const [eq, setEq] = useState(() => {
    const out = {}
    for (const key of EQUATION_FIELDS) if (initial[key] !== undefined) out[key] = initial[key]
    out.latex = out.latex || ''
    out.terms = syncTerms(out.latex, out.terms || [], palette)
    return out
  })
  const [box, setBox] = useState({ w: Math.max(80, Math.round(size?.w || 760)), h: Math.max(40, Math.round(size?.h || 340)) })
  const update = patch => setEq(e => ({ ...e, ...patch }))
  const [mode, setMode] = useState('select')
  const [sel, setSel] = useState(null)
  const [hoverPk, setHoverPk] = useState(null)
  const [activeTerm, setActiveTerm] = useState(null)
  const [focusTerm, setFocusTerm] = useState(null)
  const [preview, setPreview] = useState('all')
  const [notice, setNotice] = useState('')
  const removed = useRef(new Map()) // terms deleted from the source, in case it's typed back
  const sourceRef = useRef(null)
  const sentenceRef = useRef(null)
  const labelInputs = useRef({})

  const tree = useMemo(() => parseLatex(eq.latex), [eq.latex])
  const pick = useMemo(() => pickSource(tree), [tree])
  const pkOf = useMemo(() => new Map(pick.atoms.map((a, i) => [a, i])), [pick])
  const cfg = useMemo(() => equationConfig(eq), [eq])
  const pickCfg = useMemo(() => ({ ...cfg, latex: pick.source, labelStyle: cfg.labelStyle === 'sentence' ? 'sentence' : 'callout' }), [cfg, pick])
  const error = useMemo(() => {
    const bad = badTermIds(eq.latex)
    if (bad.length) return `A term's name can have letters, digits, - and _, and starts with a letter: "${bad[0]}" doesn't.`
    try {
      katex.renderToString(eq.latex, KATEX_OPTIONS())
      return ''
    } catch (e) {
      return String(e.message || e).replace(/^KaTeX parse error: /, '')
    }
  }, [eq.latex])
  const steps = eq.interaction !== 'hover'
  const stepStart = cfg.stepStart

  const setLatex = latex => {
    setEq(e => {
      for (const t of e.terms) removed.current.set(t.id, t)
      return { ...e, latex, terms: syncTerms(latex, e.terms, palette, removed.current) }
    })
    setSel(null)
    setNotice('')
  }

  // ── Selecting on the drawn equation ──
  const selRef = useRef(sel)
  selRef.current = sel
  const drag = useRef(null)
  const atomAt = target => {
    const n = target?.closest?.('[data-pk]')
    return n ? pick.atoms[+n.getAttribute('data-pk')] || null : null
  }
  const choose = next => {
    setSel(next)
    setNotice('')
    const id = next && selectedTerm(next)
    if (id) setActiveTerm(id)
  }
  const onPointerDown = e => {
    if (mode !== 'select' || e.button !== 0) return
    // Out of the boxes on the left, so Enter makes the selection a term
    stageRef.current?.focus({ preventScroll: true })
    const a = atomAt(e.target)
    if (!a) { if (!e.shiftKey) choose(null); return }
    e.preventDefault()
    drag.current = { anchor: a, last: a, moved: false, shift: e.shiftKey }
  }
  const onPointerMove = e => {
    if (mode !== 'select') return
    const a = atomAt(e.target)
    const d = drag.current
    if (d) {
      if (a && a !== d.last) {
        d.last = a
        d.moved = true
        choose(selectionBetween(d.anchor, a))
      }
      return
    }
    setHoverPk(a ? pkOf.get(a) ?? null : null)
  }
  useEffect(() => {
    const up = () => {
      const d = drag.current
      drag.current = null
      if (!d || d.moved) return
      const cur = selRef.current
      const a = d.anchor
      if (d.shift && cur) choose(selectionBetween(cur.list.atoms[cur.from], a))
      else if (cur && selectionHolds(cur, a)) choose(growSelection(cur))
      else choose(selectionOf(a))
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [])

  // Selecting in the source selects the same part of the drawn equation
  const onSourceSelect = e => {
    const { selectionStart: s, selectionEnd: end } = e.target
    if (s === end) return
    const next = selectionForRange(tree, s, end)
    if (next) { setMode('select'); choose(next) }
  }

  const selTerm = sel ? selectedTerm(sel) : null
  const selText = sel ? (() => { const r = selectionRange(sel); return eq.latex.slice(r.start, r.end) })() : ''

  const makeTerm = useCallback(() => {
    const cur = selRef.current
    if (!cur || selectedTerm(cur)) return
    if (!canWrap(cur)) { setNotice('That part can’t be a term on its own. Click it again to select more around it.'); return }
    const id = newTermId(eq.latex, eq.terms)
    const latex = wrapAsTerm(eq.latex, cur, id)
    try {
      katex.renderToString(latex, KATEX_OPTIONS())
    } catch {
      setNotice('That part can’t be a term on its own. Click it again to select more around it.')
      return
    }
    const at = selectionRange(cur).start
    const firsts = new Map()
    for (const a of termAtoms(parseLatex(latex))) if (!firsts.has(a.term)) firsts.set(a.term, a.start)
    setEq(e => {
      const used = new Set(e.terms.map(t => t.color))
      const term = { id, label: '', note: '', color: palette.find(c => !used.has(c)) || palette[e.terms.length % palette.length] }
      const terms = [...e.terms]
      const before = terms.findIndex(t => (firsts.get(t.id) ?? Infinity) > at)
      terms.splice(before < 0 ? terms.length : before, 0, term)
      return { ...e, latex, terms }
    })
    setSel(null)
    setActiveTerm(id)
    setFocusTerm(id)
  }, [eq.latex, eq.terms, palette])

  const removeTerm = id => {
    setEq(e => ({ ...e, latex: unwrapTerm(e.latex, id), terms: e.terms.filter(t => t.id !== id), sentence: unlinkTerm(e.sentence, id) }))
    setSel(null)
    if (activeTerm === id) setActiveTerm(null)
  }
  const updateTerm = (id, patch) => setEq(e => ({ ...e, terms: e.terms.map(t => (t.id === id ? { ...t, ...patch } : t)) }))
  const moveTerm = (id, by) => setEq(e => {
    const i = e.terms.findIndex(t => t.id === id), j = i + by
    if (i < 0 || j < 0 || j >= e.terms.length) return e
    const terms = [...e.terms]
    ;[terms[i], terms[j]] = [terms[j], terms[i]]
    return { ...e, terms }
  })
  const selectTerm = id => {
    setActiveTerm(id)
    const a = termAtoms(tree).find(x => x.term === id)
    if (a && mode === 'select') setSel(selectionOf(a))
  }

  useEffect(() => {
    if (!focusTerm) return
    labelInputs.current[focusTerm]?.focus()
    setFocusTerm(null)
  }, [focusTerm, eq.terms])

  // ── The preview's box: the element's size, as large as the stage allows ──
  const stageRef = useRef(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Focus inside the dialog from the start, so Escape and Enter reach it
  useEffect(() => { stageRef.current?.focus({ preventScroll: true }) }, [])
  // Room around it for labels that reach past its edges
  const scale = Math.max(0.1, Math.min(1.6, (stage.w - 40) / box.w, (stage.h * 0.62) / box.h))

  // Outlines over the drawn equation: what's selected, and what's under the pointer
  const [handle, setHandle] = useState(null)
  const [rects, setRects] = useState({ sel: null, hover: null, term: [] })
  useLayoutEffect(() => {
    if (!handle || mode !== 'select') { setRects({ sel: null, hover: null, term: [] }); return }
    const math = handle.math
    const union = nodes => {
      let r = null
      for (const n of nodes) {
        const b = handle.box(n)
        if (!b) continue
        r = r ? { left: Math.min(r.left, b.left), top: Math.min(r.top, b.top), right: Math.max(r.right, b.right), bottom: Math.max(r.bottom, b.bottom) } : b
      }
      return r
    }
    const nodesOf = atoms => atoms.map(a => pkOf.get(a)).filter(n => n !== undefined)
      .flatMap(n => [...math.querySelectorAll(`.katex-html [data-pk="${n}"]`)])
    const selRect = sel ? union(nodesOf(selectionAtoms(sel))) : null
    const hoverRect = hoverPk !== null && !drag.current ? union([...math.querySelectorAll(`.katex-html [data-pk="${hoverPk}"]`)]) : null
    const termRects = activeTerm && !selTerm ? [...math.querySelectorAll(`.katex-html [data-term="${activeTerm}"]`)].map(n => handle.box(n)).filter(Boolean) : []
    setRects({ sel: selRect, hover: hoverRect, term: termRects })
  }, [handle, sel, hoverPk, activeTerm, selTerm, mode, pkOf, scale])

  const onKeyDown = e => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (sel) setSel(null)
      else onClose()
      return
    }
    const typing = e.target.closest?.('input, textarea, select')
    if (e.key === 'Enter' && !typing && sel && !selTerm) { e.preventDefault(); makeTerm() }
  }

  const save = () => {
    const out = {}
    for (const key of EQUATION_FIELDS) if (eq[key] !== undefined) out[key] = eq[key]
    out.terms = syncTerms(eq.latex, eq.terms, palette)
    onSave(out, box)
  }

  const insertAtCursor = text => {
    const ta = sourceRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: end, value } = ta
    setLatex(value.slice(0, s) + text + value.slice(end))
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + text.length })
  }

  const linkWords = id => {
    const ta = sentenceRef.current
    if (!ta || ta.selectionStart === ta.selectionEnd) {
      setNotice('Select some words in the sentence first, then click the term they describe.')
      return
    }
    update({ sentence: linkPhrase(eq.sentence, ta.selectionStart, ta.selectionEnd, id) })
    setNotice('')
  }

  const termLabel = t => t.label || 'Untitled term'
  const previewSteps = [['plain', 'Before'], ...eq.terms.map((t, i) => [`term:${i}`, termLabel(t), t.color]), ['all', 'All terms']]
  const previewShow = preview.startsWith('term:') ? { kind: 'term', index: +preview.slice(5) } : preview

  const rect = (r, styleExtra) => r && (
    <div style={{
      position: 'absolute', left: r.left - 6, top: r.top - 4, width: r.right - r.left + 12, height: r.bottom - r.top + 8,
      borderRadius: 6, pointerEvents: 'none', ...styleExtra,
    }} />
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onKeyDown={onKeyDown}>
      <div role="dialog" aria-label="Interactive equation" style={{ background: 'var(--bg-card, #1e1e2e)', borderRadius: 12, width: 'min(1280px, 96vw)', height: 'min(840px, 94vh)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border, #333)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--border, #333)' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary, #fff)' }}>Interactive equation</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/#docs/tutorials/interactive-equations" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>How to use</a>
            <button onClick={onClose} aria-label="Close" style={iconButton}><X size={18} /></button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Source, terms and options */}
          <div style={{ width: 410, borderRight: '1px solid var(--border, #333)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor="eq-source" style={sectionTitle}>Equation</label>
                <div style={{ border: '1px solid var(--border, #333)', borderRadius: 6, overflow: 'hidden' }}>
                  <textarea id="eq-source" ref={sourceRef} value={eq.latex} spellCheck={false} rows={4}
                    onChange={e => setLatex(e.target.value)} onSelect={onSourceSelect}
                    style={{ display: 'block', width: '100%', resize: 'vertical', minHeight: 70, background: 'var(--bg-hover, #252530)', color: 'var(--text-primary, #fff)', border: 'none', outline: 'none', padding: '10px 12px', fontFamily: "'Fira Code','JetBrains Mono',monospace", fontSize: 12.5, lineHeight: 1.55, boxSizing: 'border-box' }} />
                  <EquationPalette onInsert={insertAtCursor} />
                </div>
                {error && <div role="status" style={{ fontSize: 11.5, color: '#e5484d' }}>{error}</div>}
                <div style={smallLabel}>Terms are written as <code>\term{'{'}name{'}'}{'{'}…{'}'}</code>. Selecting part of the source selects it in the drawing too.</div>
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={sectionTitle}>Terms{eq.terms.length ? ` (${eq.terms.length})` : ''}</div>
                {!eq.terms.length && (
                  <div style={{ ...smallLabel, fontSize: 12, lineHeight: 1.5 }}>No terms yet. Click part of the equation on the right, then click <b>Make term</b>.</div>
                )}
                {eq.terms.map((t, i) => (
                  <div key={t.id} onClick={() => selectTerm(t.id)}
                    style={{ display: 'flex', gap: 8, padding: 8, borderRadius: 6, border: `1px solid ${activeTerm === t.id ? t.color : 'var(--border, #333)'}`, background: activeTerm === t.id ? 'var(--bg-hover, #252530)' : 'transparent' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}>
                      <ColorPicker value={t.color} palette={palette} label={`Color of ${termLabel(t)}`} onChange={c => updateTerm(t.id, { color: c })} />
                      {steps && <span title="The slide's step when it's colored" style={{ ...smallLabel, fontSize: 10 }}>{stepStart + i}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <input ref={el => { labelInputs.current[t.id] = el }} value={t.label} placeholder="Label, like Likelihood" aria-label="Label"
                        onChange={e => updateTerm(t.id, { label: e.target.value })} style={{ ...inputStyle, fontWeight: 600 }} />
                      <input value={t.note} placeholder="What it means (shown with the label)" aria-label="Explanation"
                        onChange={e => updateTerm(t.id, { note: e.target.value })} style={inputStyle} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <button title="Earlier" aria-label="Move earlier" disabled={i === 0} onClick={e => { e.stopPropagation(); moveTerm(t.id, -1) }} style={{ ...iconButton, opacity: i === 0 ? 0.3 : 1 }}><ArrowUp size={13} /></button>
                      <button title="Later" aria-label="Move later" disabled={i === eq.terms.length - 1} onClick={e => { e.stopPropagation(); moveTerm(t.id, 1) }} style={{ ...iconButton, opacity: i === eq.terms.length - 1 ? 0.3 : 1 }}><ArrowDown size={13} /></button>
                      <button title="Remove the term (keeps the math)" aria-label="Remove term" onClick={e => { e.stopPropagation(); removeTerm(t.id) }} style={iconButton}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={sectionTitle}>Labels</div>
                <Segmented label="Label style" value={cfg.labelStyle} onChange={v => update({ labelStyle: v })}
                  options={Object.entries(STYLE_NAMES)} />
                <div style={smallLabel}>
                  {cfg.labelStyle === 'callout' && 'A box around the term, with a line to its label and explanation.'}
                  {cfg.labelStyle === 'brace' && 'A brace under (or over) the term, with its label and explanation.'}
                  {cfg.labelStyle === 'sentence' && 'A sentence under the equation, its phrases in the colors of the terms they describe.'}
                </div>
                {cfg.labelStyle === 'sentence' && (
                  <>
                    <textarea ref={sentenceRef} value={eq.sentence || ''} rows={3} aria-label="Sentence" placeholder="Describe the equation in words"
                      onChange={e => update({ sentence: e.target.value })}
                      style={{ ...inputStyle, width: '100%', resize: 'vertical', fontSize: 12.5, lineHeight: 1.5 }} />
                    {eq.terms.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                        <span style={smallLabel}>Link the selected words to:</span>
                        {eq.terms.map(t => (
                          <button key={t.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => linkWords(t.id)}
                            style={{ ...inputStyle, padding: '2px 8px', cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color }} />{termLabel(t)}
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={smallLabel}>A linked phrase is written <code>[words](name)</code>.</div>
                  </>
                )}
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={sectionTitle}>Presenting</div>
                <select value={cfg.interaction} onChange={e => update({ interaction: e.target.value })} aria-label="How terms are shown" style={{ ...inputStyle, width: '100%' }}>
                  <option value="steps">Color one term per step (→ or a click)</option>
                  <option value="hover">Color a term while the pointer is over it</option>
                  <option value="both">Both</option>
                </select>
                {steps && (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary, #ccc)' }}>
                      First term at step
                      <NumberInput value={stepStart} min={1} max={1000} onChange={v => update({ stepStart: v })} title="The slide's step (its fragments count too)" />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary, #ccc)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={cfg.showAll} onChange={e => update({ showAll: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
                      Finish with a step that colors every term
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary, #ccc)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={cfg.keepTinted} onChange={e => update({ keepTinted: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
                      Keep earlier terms faintly colored
                    </label>
                  </>
                )}
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={sectionTitle}>Size</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', alignItems: 'center', fontSize: 12, color: 'var(--text-secondary, #ccc)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Equation <NumberInput value={cfg.fontSize} min={8} max={200} onChange={v => update({ fontSize: v })} width={52} /> px</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Labels <NumberInput value={cfg.labelSize} min={6} max={120} onChange={v => update({ labelSize: v })} width={52} /> px</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Text
                    <input type="color" value={cfg.textColor || (dark ? '#ffffff' : '#1a1a1a')} onChange={e => update({ textColor: e.target.value })}
                      style={{ width: 28, height: 22, border: '1px solid var(--border, #333)', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary, #ccc)' }}>
                  Box
                  <NumberInput value={box.w} min={80} max={4000} width={64} title="Width" onChange={w => setBox(b => ({ ...b, w }))} />
                  ×
                  <NumberInput value={box.h} min={40} max={4000} width={64} title="Height" onChange={h => setBox(b => ({ ...b, h }))} />
                  px
                </div>
                <div style={smallLabel}>Labels can reach past the box; the dashed line in the preview is its edge.</div>
              </section>
            </div>
          </div>

          {/* The equation as the slide shows it */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border, #333)', flexWrap: 'wrap' }}>
              <Segmented label="Mode" value={mode} onChange={v => { setMode(v); setSel(null); setHoverPk(null) }} options={[['select', 'Select terms'], ['preview', 'Preview']]} />
              {mode === 'select' && (
                <span style={{ ...smallLabel, fontSize: 12 }}>Click part of the equation to select it. Click again to select more around it, or drag across parts.</span>
              )}
              {mode === 'preview' && cfg.interaction !== 'steps' && (
                <span style={{ ...smallLabel, fontSize: 12 }}>Point at a term to try the hover.</span>
              )}
            </div>

            <div ref={stageRef} tabIndex={-1} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerLeave={() => setHoverPk(null)}
              style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', outline: 'none', background: slideBg || (dark ? '#1e1e2e' : '#ffffff'), cursor: mode === 'select' ? 'pointer' : 'default', userSelect: 'none' }}>
              <div style={{
                position: 'absolute', left: (stage.w - box.w * scale) / 2, top: (stage.h - box.h * scale) / 2,
                width: box.w, height: box.h, transform: `scale(${scale})`, transformOrigin: '0 0',
                outline: `${1 / scale}px dashed ${dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}`,
              }}>
                {mode === 'select' ? (
                  <>
                    <EquationView config={pickCfg} show="rest" onReady={setHandle} />
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                      {rects.term.map((r, i) => <div key={i}>{rect(r, { border: `2px solid ${eq.terms.find(t => t.id === activeTerm)?.color || 'var(--accent)'}` })}</div>)}
                      {rect(rects.hover, { background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' })}
                      {rect(rects.sel, { border: '2px dashed var(--accent, #6366f1)', background: 'color-mix(in srgb, var(--accent, #6366f1) 14%, transparent)' })}
                    </div>
                  </>
                ) : (
                  <EquationView config={cfg} show={previewShow} animate hover={cfg.interaction !== 'steps'} />
                )}
              </div>
            </div>

            {/* What's selected, or the steps */}
            <div style={{ minHeight: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderTop: '1px solid var(--border, #333)', flexWrap: 'wrap' }}>
              {mode === 'select' && !sel && !notice && (
                <span style={{ ...smallLabel, fontSize: 12 }}>
                  {eq.terms.length ? `${eq.terms.length} term${eq.terms.length > 1 ? 's' : ''}. Select another part to add one, or click a term to edit it.` : 'Nothing selected.'}
                </span>
              )}
              {mode === 'select' && sel && selTerm && (() => {
                const t = eq.terms.find(x => x.id === selTerm)
                return (
                  <>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: t?.color || 'var(--accent)' }} />
                    <span style={{ fontSize: 13, color: 'var(--text-primary, #fff)' }}>{t ? termLabel(t) : selTerm}</span>
                    <span style={smallLabel}>is a term. Edit it on the left.</span>
                    <button className="btn btn-secondary" style={{ fontSize: 12, marginLeft: 'auto' }} onClick={() => removeTerm(selTerm)}>Remove term</button>
                  </>
                )
              })()}
              {mode === 'select' && sel && !selTerm && (
                <>
                  <span style={smallLabel}>Selected</span>
                  <code style={{ fontSize: 12, maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-hover, #252530)', color: 'var(--text-primary, #fff)' }}>{selText}</code>
                  <button className="btn btn-primary" style={{ fontSize: 12, marginLeft: 'auto' }} onClick={makeTerm}>Make term</button>
                </>
              )}
              {notice && <span role="status" style={{ fontSize: 12, color: '#f5a524' }}>{notice}</span>}
              {mode === 'preview' && (
                <div role="group" aria-label="Step" style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {previewSteps.map(([v, text, color]) => (
                    <button key={v} type="button" aria-pressed={preview === v} onClick={() => setPreview(v)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                        border: '1px solid var(--border, #333)', background: preview === v ? 'var(--accent, #6366f1)' : 'var(--bg-hover, #252530)',
                        color: preview === v ? '#fff' : 'var(--text-secondary, #ccc)',
                      }}>
                      {color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />}
                      {text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 18px', borderTop: '1px solid var(--border, #333)' }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={save}>{isNew ? 'Insert' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

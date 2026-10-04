// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The timing diagram editor. On the left, the WaveJSON, with what's wrong
// with it under it and the wave characters below that; in the middle, the
// diagram WaveDrom draws, on the slide's color; on the right, its colors and
// the steps that reveal its waveforms cycle by cycle. Preview build steps
// through the diagram as the presented slide will.

import { useState, useRef, useMemo, useLayoutEffect, useEffect } from 'react'
import { X } from 'lucide-react'
import { TIMING_TEMPLATES, timingSvg, drawTiming, timingModel, stepsByCycle } from '../utils/timingDiagram'
import { DIAGRAM_CSS, applyDiagramStep } from '../utils/diagramCore'
import { safeSvg } from '../utils/safeHtml'

const inputStyle = {
  padding: '5px 7px', background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', borderRadius: 4,
  color: 'var(--text-primary, #fff)', fontSize: 12, boxSizing: 'border-box', width: '100%', minWidth: 0,
}
const mono = "'Fira Code','JetBrains Mono',monospace"
const smallLabel = { fontSize: 11, color: 'var(--text-muted, #888)' }
const sectionTitle = { fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted, #888)' }
const iconButton = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #888)', padding: 3, display: 'flex', alignItems: 'center' }
const smallButton = { fontSize: 12, padding: '4px 10px' }
const section = { display: 'flex', flexDirection: 'column', gap: 7 }
const row = { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }
const numInput = { ...inputStyle, width: 58, textAlign: 'center', padding: '3px 4px' }
const WARN = '#f5a524'

// The wave characters, as WaveDrom reads them
const WAVE_KEYS = [
  ['p n', 'Clock, rising or falling at the start of each cycle (P N with an arrow)'],
  ['0 1', 'Low, high'],
  ['l h', 'Low, high, with a sharp edge'],
  ['x', 'Unknown'],
  ['z', 'High impedance'],
  ['= 2–9', 'A bus value, labelled from data; the digits choose its color'],
  ['.', 'The same again for another cycle'],
  ['|', 'A gap: time left out'],
  ['u d', 'Pulled up or down'],
]

function Segmented({ value, onChange, options, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'inline-flex', padding: 2, gap: 2, borderRadius: 6, border: '1px solid var(--border, #333)', background: 'var(--bg-hover, #252530)' }}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          style={{ border: 'none', borderRadius: 4, padding: '3px 9px', fontSize: 12, cursor: 'pointer', color: value === v ? '#fff' : 'var(--text-secondary, #ccc)', background: value === v ? 'var(--accent, #6366f1)' : 'none' }}>
          {text}
        </button>
      ))}
    </div>
  )
}

export default function TimingEditorModal({ initial, slideBg, isNew, onSave, onClose }) {
  const [d, setD] = useState(() => timingModel(initial))
  const [shown, setShown] = useState(d) // what's drawn: the source a moment after typing stops
  const [preview, setPreview] = useState(null) // { step, animate, n }
  const [every, setEvery] = useState(1)
  const [copied, setCopied] = useState('')
  const startJson = useRef(JSON.stringify(d))
  const dialogRef = useRef(null), previewRef = useRef(null), textRef = useRef(null)

  useEffect(() => { dialogRef.current?.focus() }, [])
  // Drawing waits for a pause in typing; settings change it at once
  useEffect(() => {
    if (d.source === shown.source) { setShown(d); return }
    const t = setTimeout(() => setShown(d), 180)
    return () => clearTimeout(t)
  }, [d]) // eslint-disable-line react-hooks/exhaustive-deps

  const edit = changes => setD(prev => ({ ...prev, ...changes }))
  const draw = useMemo(() => drawTiming({ ...shown, id: 'editor' }), [shown])
  const err = draw.error || null
  const cycles = draw.lanes ? draw.lanes.cycles : 0
  const svg = useMemo(() => safeSvg(timingSvg({ ...shown, id: 'editor' })), [shown])

  // ---------- Preview build
  const steps = shown.steps.length
  const previewSvg = useMemo(() => (preview ? timingSvg({ ...shown, id: 'editor' }, { deck: 'editor' }) : ''), [preview != null, shown]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (preview && previewRef.current) applyDiagramStep(previewRef.current, preview.step, preview.animate, false)
  }, [preview, previewSvg])
  const goStep = delta => setPreview(pv => {
    if (!pv) return pv
    const step = Math.min(steps, Math.max(0, pv.step + delta))
    return step === pv.step ? pv : { step, animate: delta > 0, n: pv.n + 1 }
  })

  const onKeyDown = ev => {
    // Nothing here reaches the editor's own shortcuts (Delete, Ctrl+Z, …)
    ev.stopPropagation()
    if (ev.target.closest?.('input, textarea, select') || ev.metaKey || ev.ctrlKey || ev.altKey) return
    if (preview) {
      if (ev.key === 'ArrowRight' || ev.key === ' ' || ev.key === 'PageDown') { ev.preventDefault(); goStep(1) }
      else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); goStep(-1) }
      else if (ev.key === 'Escape') setPreview(null)
    }
  }

  const save = () => { if (!drawTiming({ ...d, id: 'editor' }).error) onSave(timingModel(d)) }
  const cancel = () => {
    if (JSON.stringify(d) !== startJson.current && !confirm('Discard your changes to this diagram?')) return
    onClose()
  }
  const loadTemplate = key => {
    const t = TIMING_TEMPLATES.find(x => x.key === key)
    if (!t) return
    if (d.source.trim() && d.source !== t.source && JSON.stringify(d) !== startJson.current && !confirm('Replace this diagram with the template?')) return
    setD(prev => ({ ...prev, source: t.source, steps: [], revealFrom: 0 }))
    setShown(prev => ({ ...prev, source: t.source, steps: [], revealFrom: 0 }))
  }
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1500) }
    catch (e) { alert('Couldn’t copy: ' + e.message) }
  }
  const setStep = (i, changes) => edit({ steps: d.steps.map((s, j) => (j === i ? { ...s, ...changes } : s)) })
  const nextTo = () => Math.min(cycles || 1, Math.max(d.revealFrom, ...d.steps.map(s => s.to)) + 1)

  // Where the slide will put a step's cursor, for the steps' list
  const hint = preview
    ? '→ or Space goes to the next step, ← goes back, Esc returns to editing.'
    : err ? '' : draw.kind === 'reg' ? 'A register’s fields, as WaveDrom’s bit-field drawing. Steps reveal waveforms, so a register has none.'
      : draw.kind === 'assign' ? 'Logic from assign, as WaveDrom draws it.' : `${cycles} cycles. Steps reveal the waveforms up to a cycle, with a cursor there.`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{DIAGRAM_CSS}</style>
      <div ref={dialogRef} role="dialog" aria-label="Timing diagram" tabIndex={-1} onKeyDown={onKeyDown}
        style={{ background: 'var(--bg-card, #1e1e2e)', borderRadius: 12, width: 'min(1360px, 96vw)', height: 'min(860px, 94vh)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border, #333)', overflow: 'hidden', outline: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', borderBottom: '1px solid var(--border, #333)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary, #fff)' }}>Timing diagram</span>
          <span role="status" style={{ ...smallLabel, fontSize: 12, flex: '1 1 260px', minWidth: 0 }}>{hint}</span>
          <div style={row}>
            <select aria-label="Start from a template" value="" disabled={!!preview} onChange={e => loadTemplate(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="" disabled>Start from…</option>
              {TIMING_TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
            {preview
              ? <button className="btn btn-primary" style={smallButton} onClick={() => setPreview(null)}>Back to editing</button>
              : <button className="btn btn-primary" style={smallButton} onClick={() => setPreview({ step: 0, animate: false, n: 0 })} disabled={!!err}>Preview build</button>}
          </div>
          <a href="/#docs/tutorials/timing-diagrams" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>How to use</a>
          <button onClick={cancel} aria-label="Close" style={iconButton}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* The WaveJSON */}
          <div style={{ width: 'min(430px, 36%)', flex: 'none', borderRight: '1px solid var(--border, #333)', display: 'flex', flexDirection: 'column', minHeight: 0, opacity: preview ? 0.5 : 1 }}>
            <textarea ref={textRef} value={d.source} disabled={!!preview} spellCheck={false} autoCapitalize="off" autoComplete="off" aria-label="WaveJSON" aria-invalid={!!err}
              onChange={e => edit({ source: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const t = e.target, a = t.selectionStart; t.setRangeText('  ', a, t.selectionEnd, 'end'); edit({ source: t.value }) }
              }}
              style={{ flex: 1, minHeight: 0, resize: 'none', border: 'none', outline: 'none', padding: '12px 14px', background: 'var(--bg-card, #1e1e2e)', color: 'var(--text-primary, #fff)', fontFamily: mono, fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre', overflow: 'auto', tabSize: 2 }} />
            {err && <div role="alert" style={{ padding: '8px 12px', borderTop: '1px solid rgba(245,165,36,0.5)', color: WARN, fontSize: 12, lineHeight: 1.45 }}>{err}</div>}
            <details style={{ borderTop: '1px solid var(--border, #333)', padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary, #ccc)' }}>
              <summary style={{ cursor: 'pointer', ...sectionTitle }}>Wave characters</summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', marginTop: 8 }}>
                {WAVE_KEYS.map(([k, t]) => [<code key={k + 'k'} style={{ fontFamily: mono, color: 'var(--text-primary, #fff)' }}>{k}</code>, <span key={k + 't'}>{t}</span>])}
              </div>
              <p style={{ margin: '8px 0 0', lineHeight: 1.45 }}>A signal is <code style={{ fontFamily: mono }}>{"{ name: 'clk', wave: 'p...' }"}</code>; <code style={{ fontFamily: mono }}>{'{}'}</code> leaves a space, and <code style={{ fontFamily: mono }}>{"['Name', …]"}</code> groups signals. node letters and edge draw arrows between events.</p>
            </details>
          </div>

          {/* The diagram */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 14, gap: 8 }}>
            <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 6, overflow: 'hidden', background: slideBg, boxShadow: '0 0 0 1px var(--border, #333)' }}>
              {preview
                ? <div ref={previewRef} style={{ position: 'absolute', inset: '5%' }} dangerouslySetInnerHTML={{ __html: previewSvg }} />
                : <div style={{ position: 'absolute', inset: '5%', opacity: err ? 0.35 : 1 }} dangerouslySetInnerHTML={{ __html: svg }} />}
            </div>
            {preview && (
              <div style={{ ...row, fontSize: 12.5, color: 'var(--text-secondary, #ccc)' }}>
                <button className="btn btn-secondary" style={smallButton} onClick={() => goStep(-1)} disabled={preview.step <= 0} aria-label="Previous step">◀</button>
                <span style={{ minWidth: 92, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>Step {preview.step} of {steps}</span>
                <button className="btn btn-secondary" style={smallButton} onClick={() => goStep(1)} disabled={preview.step >= steps} aria-label="Next step">▶</button>
                {!steps && <span style={smallLabel}>Everything appears at once. Add steps on the right.</span>}
              </div>
            )}
          </div>

          {/* Colors and steps */}
          <div style={{ width: 300, flex: 'none', borderLeft: '1px solid var(--border, #333)', overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18, fontSize: 12, color: 'var(--text-secondary, #ccc)', opacity: preview ? 0.5 : 1, pointerEvents: preview ? 'none' : undefined }}>
            <section style={section}>
              <div style={sectionTitle}>Colors</div>
              <Segmented label="Colors" value={d.theme} onChange={v => edit({ theme: v })} options={[['dark', 'For a dark slide'], ['light', 'For a light slide']]} />
              <span style={smallLabel}>WaveDrom’s dark or its usual skin.</span>
            </section>

            <section style={section}>
              <div style={sectionTitle}>Steps</div>
              {draw.kind && draw.kind !== 'signal'
                ? <span style={smallLabel}>Only waveforms have steps.</span>
                : <>
                  <div style={row}>
                    <span>Before the first, show</span>
                    <input type="number" min={0} max={cycles} step={0.5} value={d.revealFrom} aria-label="Cycles shown before the first step"
                      onChange={e => edit({ revealFrom: Math.max(0, Number(e.target.value) || 0) })} style={numInput} />
                    <span>cycles</span>
                  </div>
                  {d.steps.map((s, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 58px minmax(0, 1fr) auto', gap: 6, alignItems: 'center' }}>
                      <span style={{ ...smallLabel, minWidth: 34 }}>{i + 1}. to</span>
                      <input type="number" min={0} max={cycles} step={0.5} value={s.to} aria-label={`Step ${i + 1} shows up to cycle`}
                        onChange={e => setStep(i, { to: Math.max(0, Number(e.target.value) || 0) })} style={numInput} />
                      <input value={s.caption} placeholder="Caption" aria-label={`Step ${i + 1}’s caption`} maxLength={300}
                        onChange={e => setStep(i, { caption: e.target.value })} style={inputStyle} />
                      <button type="button" aria-label={`Remove step ${i + 1}`} title="Remove" onClick={() => edit({ steps: d.steps.filter((_, j) => j !== i) })} style={iconButton}><X size={14} /></button>
                    </div>
                  ))}
                  <div style={row}>
                    <button className="btn btn-secondary" style={smallButton} disabled={!!err || d.steps.length >= 200} onClick={() => edit({ steps: [...d.steps, { to: nextTo(), caption: '' }] })}>Add a step</button>
                    {d.steps.length > 0 && <button className="btn btn-secondary" style={smallButton} onClick={() => edit({ steps: [] })}>Clear</button>}
                  </div>
                  <div style={row}>
                    <button className="btn btn-secondary" style={smallButton} disabled={!!err || !cycles}
                      onClick={() => edit({ steps: stepsByCycle({ ...d }, every).map(s => ({ ...s, caption: d.steps.find(x => x.to === s.to)?.caption || '' })) })}>
                      A step every
                    </button>
                    <input type="number" min={0.5} max={Math.max(1, cycles)} step={0.5} value={every} aria-label="Cycles a step" onChange={e => setEvery(Math.max(0.5, Number(e.target.value) || 1))} style={numInput} />
                    <span>{every === 1 ? 'cycle' : 'cycles'}</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={d.cursor} onChange={e => edit({ cursor: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> A cursor where the waveforms stop
                  </label>
                  {d.steps.some(s => s.to > cycles) && cycles > 0 && <span style={{ ...smallLabel, color: WARN }}>The waveforms end at cycle {cycles}.</span>}
                </>}
            </section>

            <section style={section}>
              <div style={sectionTitle}>Copy</div>
              <div style={row}>
                <button className="btn btn-secondary" style={smallButton} onClick={() => copy(d.source, 'json')}>{copied === 'json' ? 'Copied' : 'WaveJSON'}</button>
                <button className="btn btn-secondary" style={smallButton} disabled={!!err} onClick={() => copy(timingSvg({ ...d, id: 'copy', steps: [] }, { standalone: true }), 'svg')}>{copied === 'svg' ? 'Copied' : 'SVG'}</button>
              </div>
              <span style={smallLabel}>The WaveJSON also opens in WaveDrom’s own editor.</span>
            </section>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border, #333)' }}>
          <button className="btn btn-secondary" onClick={cancel}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={!!err}>{isNew ? 'Insert' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

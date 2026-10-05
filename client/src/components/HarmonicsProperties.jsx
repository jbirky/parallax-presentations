// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The properties panel's section for spherical harmonics: the function (one
// harmonic, a typed sum, a polar cap or a random sky), how it's shown, its
// conventions, its exact formula, and its steps. Each step is a whole
// picture: picking one in the strip makes the controls above edit it, and
// the canvas shows it. Build Up writes a sequence of steps.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import katex from 'katex'
import { SH, harmonicsPython, harmonicsTex, conventionsText } from '../utils/sphericalHarmonics'
import {
  HV, HARMONICS_TEMPLATES, applyHarmonicsTemplate, subscribeHarmonics, harmonicsVersion,
  harmonicsEditStep, setHarmonicsEditStep, harmonicsTurned, clearHarmonicsTurned,
} from '../utils/harmonicsView'

const label = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }
const select = { padding: '4px 6px', width: '100%' }
const check = { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }
const small = { fontSize: 11, padding: '3px 6px' }
const note = { fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }

const SOURCES = [['single', 'One'], ['sum', 'Sum'], ['cap', 'Cap'], ['sky', 'Random sky']]
const PARTS = [['auto', 'f', 'The value: signed when real, colored by phase when complex'], ['re', 'Re f'], ['im', 'Im f'], ['abs', '|f|'], ['abs2', '|f|²']]
const VIEWS = [['lobes', 'Lobes', 'r = |f|'], ['sphere', 'Sphere', 'The unit sphere colored by f'], ['shape', 'Shape', 'r = 1 + εf'], ['map', 'Map', 'A Mollweide or plate carrée map'], ['table', 'Table', 'Every harmonic up to an ℓ']]
const MOTIONS = [['none', 'Still'], ['spin', 'Spin'], ['wave', 'Wave', 'Times e^(−iωt): a complex harmonic travels, a real one stands']]
const NORMS = [['orthonormal', 'Orthonormal (physics)'], ['4pi', '4π (geodesy)'], ['schmidt', 'Schmidt semi-normalized (geomagnetism)'], ['unnormalized', 'Unnormalized']]
const BUILDS = [['m', 'Each m for this ℓ'], ['l', 'ℓ = 0, 1, … up to this one'], ['band', 'Band limits 1, 2, 4, … (cap or sky)'], ['terms', 'A sum, one term at a time']]

function Tex({ src, display = false, style }) {
  let html = ''
  try { html = katex.renderToString(src, { throwOnError: false, displayMode: display }) } catch { html = '' }
  return <div style={{ overflowX: 'auto', overflowY: 'hidden', ...style }} dangerouslySetInnerHTML={{ __html: html }} />
}

function Seg({ options, value, onChange, wide = true }) {
  return (
    <div role="group" style={{ display: wide ? 'flex' : 'inline-flex', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
      {options.map(([v, t, title], i) => (
        <button key={v} type="button" title={title} aria-pressed={value === v} onClick={() => onChange(v)}
          style={{ flex: wide ? '1 1 auto' : '0 0 auto', padding: options.length > 4 ? '4px 3px' : '4px 7px', fontSize: options.length > 4 ? 11 : 11.5, border: 'none', borderLeft: i ? '1px solid var(--border)' : 'none', cursor: 'pointer',
            background: value === v ? 'var(--accent)' : 'var(--bg-tertiary, transparent)', color: value === v ? '#fff' : 'var(--text-secondary)' }}>
          {t}
        </button>
      ))}
    </div>
  )
}

function Stepper({ value, onChange, min, max, name }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
      <button type="button" className="btn-icon" aria-label={`${name} down`} disabled={value <= min} onClick={() => onChange(value - 1)} style={{ width: 24, height: 24, borderRadius: 0 }}>−</button>
      <span style={{ minWidth: 30, textAlign: 'center', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{String(value).replace('-', '−')}</span>
      <button type="button" className="btn-icon" aria-label={`${name} up`} disabled={value >= max} onClick={() => onChange(value + 1)} style={{ width: 24, height: 24, borderRadius: 0 }}>+</button>
    </div>
  )
}

function Slider({ name, value, min, max, step = 1, unit = '', onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 40px', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{name}</div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ accentColor: 'var(--accent)', minWidth: 0 }} />
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}{unit}</div>
    </div>
  )
}

function CopyButton({ text, label: name }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      alert('Couldn’t copy: ' + err.message)
    }
  }
  return <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 11, padding: '5px 8px' }} onClick={copy} disabled={!text}>{copied ? 'Copied' : name}</button>
}

// A typed sum, kept as typed and applied a moment after typing stops
function SumInput({ value, onChange }) {
  const [text, setText] = useState(value)
  const timer = useRef(null)
  useEffect(() => setText(value), [value])
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <textarea className="prop-input" value={text} spellCheck={false} rows={2}
      onChange={e => { const v = e.target.value; setText(v); clearTimeout(timer.current); timer.current = setTimeout(() => onChange(v), 350) }}
      onBlur={() => { clearTimeout(timer.current); if (text !== value) onChange(text) }}
      style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, padding: '5px 6px', resize: 'vertical' }} />
  )
}

// Terms back into typed text, scaled to unit norm
function exprOf(terms) {
  const norm = Math.sqrt(terms.reduce((a, t) => a + t.c[0] * t.c[0] + t.c[1] * t.c[1], 0)) || 1
  return terms.map((t, i) => {
    const re = +(t.c[0] / norm).toPrecision(6), im = +(t.c[1] / norm).toPrecision(6)
    const name = t.form === 'real' ? `Y_{${t.l},${t.m}}` : `Y_${t.l}^{${t.m}}`
    const neg = re < 0 && !im
    const coef = im ? `(${re}${im < 0 ? '-' : '+'}${Math.abs(im)}i)` : String(Math.abs(re))
    return (i ? (neg ? ' - ' : ' + ') : (neg ? '-' : '')) + (coef === '1' ? '' : coef + ' ') + name
  }).join('')
}
const plainName = t => {
  const n = t.form === 'real' && SH.orbitalTex(t.l, t.m)
  return n ? n.replace(/[{}^]/g, '') : `Y(${t.l},${t.m})`
}

// A sequence of pictures from the one being edited: the first becomes the
// start, the rest the steps
function buildUp(kind, s) {
  const seq = []
  const at = o => ({ ...s, ...o })
  if (kind === 'm') for (let m = -s.l; m <= s.l; m++) seq.push(at({ source: 'single', m, caption: '' }))
  if (kind === 'l') for (let l = 0; l <= Math.max(s.l, 1); l++) seq.push(at({ source: 'single', l, m: Math.max(-l, Math.min(l, s.m)), caption: '' }))
  if (kind === 'band') {
    if (s.source !== 'cap' && s.source !== 'sky') return { error: 'Band limits need a cap or a random sky.' }
    const top = s[s.source].lmax, first = s.source === 'sky' ? 2 : 1
    const ls = []
    for (let L = first; L < top; L *= 2) ls.push(L)
    ls.push(top)
    ls.forEach(L => seq.push(at({ [s.source]: { ...s[s.source], lmax: L }, caption: `ℓ ≤ ${L}` })))
  }
  if (kind === 'terms') {
    const p = s.source === 'sum' ? SH.parseExpr(s.expr, s.form) : null
    if (!p || p.error) return { error: 'One term at a time needs a sum that reads.' }
    for (let n = 1; n <= p.terms.length; n++) seq.push(at({ source: 'sum', expr: exprOf(p.terms.slice(0, n)), caption: n === 1 ? '' : `+ ${plainName(p.terms[n - 1])}` }))
  }
  if (seq.length < 2) return { error: 'That makes only one picture.' }
  return { seq: seq.slice(0, 61) }
}

export default function HarmonicsProperties({ element, onUpdateElement }) {
  useSyncExternalStore(subscribeHarmonics, harmonicsVersion)
  const [msg, setMsg] = useState('')
  const s = HV.normalize(element)
  const editing = Math.min(harmonicsEditStep(element.id), s.steps.length)
  const p = HV.stepState(s, editing)
  const turned = harmonicsTurned(element.id)
  const id = element.id

  // A picture field goes to the step being edited; the rest to the element
  const set = changes => {
    const pic = {}, own = {}
    Object.entries(changes).forEach(([k, v]) => { (HV.PICTURE_FIELDS.includes(k) ? pic : own)[k] = v })
    if (editing > 0 && Object.keys(pic).length) own.steps = s.steps.map((st, i) => (i === editing - 1 ? { ...st, ...pic } : st))
    else Object.assign(own, pic)
    onUpdateElement(own)
  }
  const go = n => setHarmonicsEditStep(id, n)
  const setL = l => set({ l, m: Math.max(-l, Math.min(l, p.m)) })
  const picFields = o => { const out = {}; HV.PICTURE_FIELDS.forEach(k => { out[k] = o[k] }); return out }

  const parsed = p.source === 'sum' ? SH.parseExpr(p.expr, p.form) : null
  const cf = p.source === 'single' && p.view !== 'table' ? SH.closedForm(p.l, p.m, p.form, { cs: p.cs, norm: p.norm }) : null
  const canKeep = turned && (Math.round(turned.turn) !== Math.round(p.turn) || Math.round(turned.tilt) !== Math.round(p.tilt))

  return (
    <div style={{ marginBottom: 10, display: 'grid', gap: 9 }}>
      <div>
        <div style={label}>Start from</div>
        <select className="prop-input" value="" style={select}
          onChange={e => {
            const t = HARMONICS_TEMPLATES.find(x => x.id === e.target.value)
            if (t) { onUpdateElement(applyHarmonicsTemplate(element, t)); go(0) }
          }}>
          <option value="">A starting point…</option>
          {HARMONICS_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {s.steps.length > 0 && (
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>
          {editing ? `Editing step ${editing}` : 'Editing the start'}
        </div>
      )}

      <div>
        <div style={label}>Function</div>
        <Seg options={SOURCES} value={p.source} onChange={v => set({ source: v })} />
      </div>
      {p.source === 'single' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontStyle: 'italic', fontFamily: 'KaTeX_Main, serif', fontSize: 15 }}>ℓ</span>
            <Stepper name="ℓ" value={p.l} min={0} max={20} onChange={setL} />
            <span style={{ fontStyle: 'italic', fontFamily: 'KaTeX_Main, serif', fontSize: 15, marginLeft: 4 }}>m</span>
            <Stepper name="m" value={p.m} min={-p.l} max={p.l} onChange={m => set({ m })} />
          </div>
          {p.l > 0 && <input type="range" aria-label="m" min={-p.l} max={p.l} step={1} value={p.m} onChange={e => set({ m: Number(e.target.value) })} style={{ accentColor: 'var(--accent)' }} />}
        </div>
      )}
      {p.source === 'sum' && (
        <div style={{ display: 'grid', gap: 4 }}>
          <SumInput value={p.expr} onChange={expr => set({ expr })} />
          {parsed.error
            ? <div style={{ fontSize: 11, color: 'var(--danger, #e5484d)' }}>{parsed.error}{parsed.pos != null ? ` (at character ${parsed.pos + 1})` : ''}</div>
            : <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 11, color: 'var(--text-muted)' }}>Reads as <Tex src={SH.termsTex(parsed.terms)} style={{ color: 'var(--text-primary)', fontSize: 13 }} /></div>}
          <div style={note}>Y(ℓ,m) follows the form below; Y_ℓ^m is complex; Y_{'{ℓ,m}'} and names like p_x, d_{'{xy}'}, d_z2 are real. Coefficients can use i, sqrt and pi.</div>
        </div>
      )}
      {(p.source === 'single' || p.source === 'sum') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Form</div>
          <Seg wide={false} options={[['complex', 'Complex Yₗᵐ'], ['real', 'Real (orbitals)']]} value={p.form} onChange={v => set({ form: v })} />
        </div>
      )}
      {p.source === 'cap' && (
        <div style={{ display: 'grid', gap: 4 }}>
          <Slider name="θ₀" value={p.cap.theta} min={0} max={180} unit="°" onChange={v => set({ cap: { ...p.cap, theta: v } })} />
          <Slider name="φ₀" value={p.cap.phi} min={-180} max={180} unit="°" onChange={v => set({ cap: { ...p.cap, phi: v } })} />
          <Slider name="Radius α" value={p.cap.radius} min={2} max={90} unit="°" onChange={v => set({ cap: { ...p.cap, radius: v } })} />
          <Slider name="ℓ max" value={p.cap.lmax} min={0} max={48} onChange={v => set({ cap: { ...p.cap, lmax: v } })} />
        </div>
      )}
      {p.source === 'sky' && (
        <div style={{ display: 'grid', gap: 4 }}>
          <Slider name="Cℓ ∝ ℓ⁻ⁿ, n" value={p.sky.slope} min={0} max={4} step={0.5} onChange={v => set({ sky: { ...p.sky, slope: v } })} />
          <Slider name="ℓ max" value={p.sky.lmax} min={2} max={48} onChange={v => set({ sky: { ...p.sky, lmax: v } })} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Seed {p.sky.seed}</div>
            <button className="btn btn-secondary" style={small} onClick={() => set({ sky: { ...p.sky, seed: 1 + Math.floor(Math.random() * 99999) } })}>New Draw</button>
          </div>
        </div>
      )}

      <div>
        <div style={label}>Show</div>
        <Seg options={PARTS} value={p.part} onChange={v => set({ part: v })} />
      </div>
      <div>
        <div style={label}>View</div>
        <Seg options={VIEWS} value={p.view} onChange={v => set({ view: v })} />
      </div>
      {p.view === 'shape' && <Slider name="Amplitude ε" value={p.amplitude} min={0.05} max={0.6} step={0.01} onChange={v => set({ amplitude: v })} />}
      {p.view === 'map' && (
        <div style={{ display: 'grid', gap: 4 }}>
          <select className="prop-input" value={p.projection} onChange={e => set({ projection: e.target.value })} style={select}>
            <option value="mollweide">Mollweide</option>
            <option value="plate">Plate carrée</option>
          </select>
          <label style={check}><input type="checkbox" checked={p.eastLeft} onChange={e => set({ eastLeft: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Longitude grows to the left, as on the sky</label>
        </div>
      )}
      {p.view === 'table' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div>
            <div style={label}>Up to ℓ =</div>
            <select className="prop-input" value={p.tableMax} onChange={e => set({ tableMax: Number(e.target.value) })} style={select}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <div style={label}>Each as</div>
            <select className="prop-input" value={p.tableCell} onChange={e => set({ tableCell: e.target.value })} style={select}>
              <option value="lobes">Lobes</option>
              <option value="sphere">A sphere</option>
            </select>
          </div>
        </div>
      )}
      <div>
        <div style={label}>Motion</div>
        <Seg options={MOTIONS} value={p.motion} onChange={v => set({ motion: v })} />
      </div>
      {p.motion !== 'none' && <Slider name="Speed" value={s.speed} min={0.25} max={3} step={0.25} unit="×" onChange={v => set({ speed: v })} />}

      <div style={{ display: 'grid', gap: 4 }}>
        <label style={check}><input type="checkbox" checked={p.nodes} onChange={e => set({ nodes: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Nodal lines (sphere, shape, map)</label>
        <label style={check}><input type="checkbox" checked={p.axes} onChange={e => set({ axes: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Axes</label>
        <label style={check}><input type="checkbox" checked={s.key} onChange={e => set({ key: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Color key</label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div>
          <div style={label}>Label</div>
          <select className="prop-input" value={s.label} onChange={e => set({ label: e.target.value })} style={select}>
            <option value="none">None</option>
            <option value="name">Name</option>
            <option value="formula">Name and formula</option>
          </select>
        </div>
        <div>
          <div style={label}>Colors</div>
          <select className="prop-input" value={s.theme} onChange={e => set({ theme: e.target.value })} style={select}>
            <option value="dark">For a dark slide</option>
            <option value="light">For a light slide</option>
          </select>
        </div>
      </div>

      <details>
        <summary style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>Conventions</summary>
        <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
          <label style={check}><input type="checkbox" checked={s.cs} onChange={e => set({ cs: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Condon–Shortley phase (−1)<sup>m</sup></label>
          <select className="prop-input" value={s.norm} onChange={e => set({ norm: e.target.value })} style={select}>
            {NORMS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          <div style={note}>θ is measured from +z and φ from +x. These change the formulas and the weight of each term in a sum; one harmonic is drawn scaled to fit either way. Real harmonics keep p_x’s positive lobe on +x whatever the phase.</div>
        </div>
      </details>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'grid', gap: 5 }}>
        {cf && <Tex display src={`${cf.name}(\\theta,\\varphi) = ${cf.tex}`} style={{ fontSize: 12 }} />}
        {cf?.cartesian && <Tex display src={`= ${cf.cartesian}`} style={{ fontSize: 12 }} />}
        {cf && <div style={note}>{SH.nodes(p.l, p.m, p.form, p.part)}</div>}
        {parsed && !parsed.error && p.view !== 'table' && s.norm === 'orthonormal' && (() => {
          const n2 = parsed.terms.reduce((a, t) => a + t.c[0] * t.c[0] + t.c[1] * t.c[1], 0)
          return <div style={note}>∫|f|² dΩ = Σ|c|² = {+n2.toPrecision(4)}{Math.abs(n2 - 1) < 1e-9 ? ': normalized.' : '.'}</div>
        })()}
        {p.source === 'cap' && p.view !== 'table' && <div style={note}>{(p.cap.lmax + 1) ** 2} terms. The ripples at the edge are Gibbs ringing: they narrow as ℓ grows but keep their height.</div>}
        {p.source === 'sky' && p.view !== 'table' && <div style={note}>Gaussian a_ℓm with Cℓ ∝ ℓ^−{p.sky.slope}, 2 ≤ ℓ ≤ {p.sky.lmax}. Raising ℓ max adds detail without moving what’s already there.</div>}
        {p.view === 'table' && <div style={note}>Every {p.form === 'real' ? 'real' : 'complex'} harmonic with ℓ ≤ {p.tableMax}: {(p.tableMax + 1) ** 2} pictures.</div>}
        <div style={{ ...note, fontSize: 10.5 }}>{conventionsText(p)}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <CopyButton text={harmonicsPython(p)} label="Copy Python" />
          <CopyButton text={harmonicsTex(p)} label="Copy TeX" />
        </div>
      </div>

      {p.view !== 'map' && (
        <div>
          <div style={label}>{editing ? `Step ${editing}’s angle` : 'Starting angle'} <span style={{ fontVariantNumeric: 'tabular-nums' }}>({Math.round(p.turn)}°, {Math.round(p.tilt)}°)</span></div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 11, padding: '5px 8px', opacity: canKeep ? 1 : 0.5 }}
              disabled={!canKeep} title={canKeep ? 'Start from the angle it’s turned to now' : 'Turn it on the canvas first'}
              onClick={() => { set({ turn: turned.turn, tilt: turned.tilt }); clearHarmonicsTurned(id) }}>
              Keep This View
            </button>
            <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 11, padding: '5px 8px' }}
              onClick={() => { set({ turn: HV.DEFAULTS.turn, tilt: HV.DEFAULTS.tilt }); clearHarmonicsTurned(id) }}>
              Reset View
            </button>
          </div>
        </div>
      )}

      <div style={{ ...label, marginTop: 4, marginBottom: 0, fontWeight: 600, color: 'var(--text-secondary)' }}>Steps</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {[0, ...s.steps.map((_, i) => i + 1)].map(n => (
          <button key={n} type="button" onClick={() => go(n)} title={n ? s.steps[n - 1].caption || `Step ${n}` : 'The picture as the slide opens'}
            style={{ fontSize: 11, minWidth: 26, padding: '2px 8px', borderRadius: 999, cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
              border: `1px solid ${n === editing ? 'var(--accent)' : 'var(--border)'}`, background: n === editing ? 'var(--accent)' : 'transparent', color: n === editing ? '#fff' : 'var(--text-secondary)' }}>
            {n ? n : 'Start'}
          </button>
        ))}
      </div>
      {editing > 0 && (
        <input className="prop-input" value={s.steps[editing - 1].caption} placeholder="Caption for this step"
          onChange={e => onUpdateElement({ steps: s.steps.map((st, i) => (i === editing - 1 ? { ...st, caption: e.target.value } : st)) })}
          style={{ padding: '4px 6px' }} />
      )}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" style={small} disabled={s.steps.length >= 60}
          title="A new step after this one, showing the same picture"
          onClick={() => {
            const st = { ...picFields(p), ...(turned ? { turn: turned.turn, tilt: turned.tilt } : {}), caption: '' }
            const next = s.steps.slice(); next.splice(editing, 0, st)
            onUpdateElement({ steps: next }); go(editing + 1)
          }}>Add a Step</button>
        {editing > 0 && <>
          <button className="btn btn-secondary" style={small} disabled={editing === 1} title="Earlier"
            onClick={() => { const next = s.steps.slice(); next.splice(editing - 2, 0, next.splice(editing - 1, 1)[0]); onUpdateElement({ steps: next }); go(editing - 1) }}>↑</button>
          <button className="btn btn-secondary" style={small} disabled={editing === s.steps.length} title="Later"
            onClick={() => { const next = s.steps.slice(); next.splice(editing, 0, next.splice(editing - 1, 1)[0]); onUpdateElement({ steps: next }); go(editing + 1) }}>↓</button>
          <button className="btn btn-secondary" style={small} title="Remove this step"
            onClick={() => { onUpdateElement({ steps: s.steps.filter((_, i) => i !== editing - 1) }); go(editing - 1) }}>Remove</button>
        </>}
      </div>
      <select className="prop-input" value="" style={select}
        onChange={e => {
          const r = buildUp(e.target.value, p)
          if (r.error) { setMsg(r.error); return }
          const [first, ...rest] = r.seq
          onUpdateElement({ ...picFields(first), steps: rest.map(st => ({ ...picFields(st), caption: st.caption })) })
          go(0)
          setMsg(`Wrote the start and ${rest.length} step${rest.length === 1 ? '' : 's'}.`)
        }}>
        <option value="">Build up…</option>
        {BUILDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      {msg && <div style={note}>{msg}</div>}
      {s.steps.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>First step at slide step</div>
          <input className="prop-input" type="number" min={1} max={1000} step={1} value={s.stepStart}
            onChange={e => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= 1000) onUpdateElement({ stepStart: n }) }}
            style={{ width: 56, padding: '2px 4px', fontSize: 11 }} />
        </div>
      )}
      <div style={note}>
        Drag it to turn it, on the canvas once it’s selected and when presenting. Moving from step to step, it morphs into the next picture.
      </div>
    </div>
  )
}

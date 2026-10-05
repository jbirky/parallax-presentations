// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The properties panel's section for a periodic table: what it shows, how
// it's colored, the element its card shows at rest, and its steps (each
// highlights part of the table, pins an element, draws a trend's arrows or
// recolors it). A change that reshapes the table keeps the element's width.

import { useEffect, useState } from 'react'
import { PT, periodicResize } from '../utils/periodicTable'

const label = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }
const select = { padding: '4px 6px', width: '100%' }
const check = { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }
const small = { fontSize: 11, padding: '3px 6px' }

const SHOWS = [['all', 'The whole table'], ['periods-1-4', 'Periods 1–4'], ['main-group', 'Main groups (s and p blocks)'], ['periods-1-3', 'Periods 1–3, main groups'], ['element', 'One element’s card']]
const CARDS = [['gap', 'In the gap above the transition metals'], ['side', 'Beside the table'], ['none', 'None']]
const COLORS = [['category', 'Category'], ['block', 'Block (s, p, d, f)'], ['state', 'State at 298 K']]
const HEAT = ['en', 'ie', 'ea', 'radius', 'mp', 'bp', 'density', 'mass', 'year']
const TILE_TEXT = [['auto', 'Name (in a heat map, the value)'], ['name', 'Name'], ['mass', 'Atomic mass'], ['valence', 'Valence electrons'], ['none', 'Nothing']]
const VIEWS = [['boxes', 'Orbital boxes'], ['shells', 'Bohr shells'], ['clouds', 'Orbital clouds'], ['none', 'Not shown']]
const GROUP3 = [['gap', 'Sc, Y, then 57–71 and 89–103'], ['la', 'Sc, Y, La, Ac'], ['lu', 'Sc, Y, Lu, Lr (IUPAC 2021)']]
const TRENDS = [['', 'None'], ...Object.entries(PT.TRENDS).map(([k, t]) => [k, t.label])]
const HL_KINDS = [['', 'Nothing'], ['group', 'Groups'], ['period', 'Periods'], ['block', 'A block'], ['category', 'A category'], ['state', 'A state'], ['z', 'Elements']]

function ColorOptions({ inherit }) {
  return (
    <>
      {inherit && <option value="">As at rest</option>}
      {COLORS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      <optgroup label="Heat map">
        {HEAT.map(k => <option key={k} value={k}>{PT.PROPS[k].label}</option>)}
      </optgroup>
    </>
  )
}

// Text kept as typed until it's committed (on Enter or leaving the field),
// then shown as it was understood
function CommitInput({ value, onCommit, placeholder, title, style }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const commit = () => { if (text !== value) onCommit(text) }
  return (
    <input className="prop-input" value={text} placeholder={placeholder} title={title}
      onChange={e => setText(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); e.currentTarget.blur() } }}
      style={{ padding: '4px 6px', ...style }} />
  )
}

// An element by symbol or number, shown as both
function ElementInput({ value, onChange, placeholder = 'Fe or 26', allowNone = true }) {
  const e = value ? PT.EL[value] : null
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <CommitInput value={e ? e.sym : ''} placeholder={placeholder} style={{ width: 70 }}
        title="A symbol or an atomic number"
        onCommit={t => { const z = PT.zOf(t); if (z || (allowNone && !t.trim())) onChange(z || null) }} />
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e ? `${e.name}, ${e.z}` : 'None'}</span>
    </div>
  )
}

// A highlight: one kind (groups, a category…) and which
function HighlightPicker({ value, onChange }) {
  const first = PT.parseHighlight(value)[0]
  const kind = first?.kind || ''
  const vals = first?.vals || []
  const set = (k, v) => onChange(k ? PT.cleanHighlight(`${k}:${v}`) : '')
  const pickKind = k => {
    const start = { group: '1', period: '2', block: 'p', category: 'Halogen', state: 'Gas', z: 'C,N,O' }[k]
    set(k, start)
  }
  let field = null
  if (kind === 'block') field = (
    <select className="prop-input" value={vals[0]} onChange={e => set(kind, e.target.value)} style={select}>
      {['s', 'p', 'd', 'f'].map(b => <option key={b} value={b}>{b}-block</option>)}
    </select>
  )
  else if (kind === 'category') field = (
    <select className="prop-input" value={vals[0]} onChange={e => set(kind, e.target.value)} style={select}>
      {PT.CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  )
  else if (kind === 'state') field = (
    <select className="prop-input" value={vals[0]} onChange={e => set(kind, e.target.value)} style={select}>
      {PT.STATES.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  )
  else if (kind) field = (
    <CommitInput
      value={kind === 'z' ? vals.map(z => PT.EL[z].sym).join(', ') : vals.join(', ')}
      placeholder={kind === 'z' ? 'C, N, O' : kind === 'group' ? '1, 2' : '3'}
      title={kind === 'z' ? 'Symbols or atomic numbers, separated by commas' : `${kind === 'group' ? 'Groups 1–18' : 'Periods 1–7'}, separated by commas`}
      onCommit={t => set(kind, t)} style={{ width: '100%' }} />
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      <select className="prop-input" value={kind} onChange={e => pickKind(e.target.value)} style={select}>
        {HL_KINDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      {field || <span />}
    </div>
  )
}

function StepEditor({ step, index, count, slideStep, onChange, onMove, onRemove }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flex: 1 }}>
          Step {index + 1} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· slide step {slideStep}</span>
        </div>
        <button className="btn btn-secondary" style={small} disabled={index === 0} onClick={() => onMove(-1)} title="Earlier">↑</button>
        <button className="btn btn-secondary" style={small} disabled={index === count - 1} onClick={() => onMove(1)} title="Later">↓</button>
        <button className="btn btn-secondary" style={small} onClick={onRemove} title="Remove this step">✕</button>
      </div>
      <div>
        <div style={label}>Highlight</div>
        <HighlightPicker value={step.highlight} onChange={highlight => onChange({ highlight })} />
      </div>
      <div>
        <div style={label} title="The element the card shows and holds at this step">Pin</div>
        <ElementInput value={step.pin} onChange={pin => onChange({ pin })} placeholder="None" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div>
          <div style={label}>Trend arrows</div>
          <select className="prop-input" value={step.arrow} onChange={e => onChange({ arrow: e.target.value })} style={select}>
            {TRENDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
        <div>
          <div style={label}>Color by</div>
          <select className="prop-input" value={step.colorBy} onChange={e => onChange({ colorBy: e.target.value })} style={select}>
            <ColorOptions inherit />
          </select>
        </div>
      </div>
    </div>
  )
}

export default function PeriodicProperties({ element, onUpdateElement }) {
  const s = PT.normalize(element)
  const set = changes => onUpdateElement(periodicResize(element, changes))
  const steps = s.steps
  const setSteps = next => set({ steps: next })
  const table = s.show !== 'element'

  return (
    <div style={{ marginBottom: 10, display: 'grid', gap: 8 }}>
      <div>
        <div style={label}>Show</div>
        <select className="prop-input" value={s.show} onChange={e => set({ show: e.target.value })} style={select}>
          {SHOWS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      {table && (
        <div>
          <div style={label} title="The gap is there only in the whole table and periods 1–4; elsewhere the card goes beside it">Card</div>
          <select className="prop-input" value={s.card} onChange={e => set({ card: e.target.value })} style={select}>
            {CARDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
      )}
      <div>
        <div style={label} title="What the card shows until someone points at a tile, and in the PDF">Card shows at rest</div>
        <ElementInput value={s.restingElement} onChange={z => set({ restingElement: z })} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>Or double-click a tile on the canvas.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div>
          <div style={label}>Color by</div>
          <select className="prop-input" value={s.colorBy} onChange={e => set({ colorBy: e.target.value })} style={select}>
            <ColorOptions />
          </select>
        </div>
        <div>
          <div style={label}>Electrons as</div>
          <select className="prop-input" value={s.orbitalView} onChange={e => set({ orbitalView: e.target.value })} style={select}>
            {VIEWS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
      </div>
      {table && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div>
            <div style={label}>Tiles show</div>
            <select className="prop-input" value={s.tileLabel} onChange={e => set({ tileLabel: e.target.value })} style={select}>
              {TILE_TEXT.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={label} title="Which elements go under scandium and yttrium">Group 3</div>
            <select className="prop-input" value={s.group3} onChange={e => set({ group3: e.target.value })} style={select}>
              {GROUP3.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
        </div>
      )}
      <div>
        <div style={label}>Colors</div>
        <select className="prop-input" value={s.theme} onChange={e => set({ theme: e.target.value })} style={select}>
          <option value="dark">For a dark slide</option>
          <option value="light">For a light slide</option>
        </select>
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {s.orbitalView === 'boxes' && (
          <label style={check}><input type="checkbox" checked={s.showCore} onChange={e => set({ showCore: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Show core electrons</label>
        )}
        {table && <label style={check}><input type="checkbox" checked={s.labels} onChange={e => set({ labels: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Group and period numbers</label>}
        {table && <label style={check}><input type="checkbox" checked={s.legend} onChange={e => set({ legend: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Legend</label>}
        <label style={check}><input type="checkbox" checked={s.source} onChange={e => set({ source: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> “Data: PubChem” on the card</label>
      </div>

      {table && (
        <>
          <div>
            <div style={label}>Highlight at rest</div>
            <HighlightPicker value={s.highlight} onChange={highlight => set({ highlight })} />
          </div>
          <div>
            <div style={label} title="Arrows along the top and side, the way the property grows">Trend arrows at rest</div>
            <select className="prop-input" value={s.arrow} onChange={e => set({ arrow: e.target.value })} style={select}>
              {TRENDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>

          <div style={{ ...label, marginTop: 4, marginBottom: 0, fontWeight: 600, color: 'var(--text-secondary)' }}>Steps</div>
          {steps.map((step, i) => (
            <StepEditor key={i} step={step} index={i} count={steps.length} slideStep={s.stepStart + i}
              onChange={changes => setSteps(steps.map((st, j) => (j === i ? { ...st, ...changes } : st)))}
              onMove={d => { const next = steps.slice(); next.splice(i + d, 0, next.splice(i, 1)[0]); setSteps(next) }}
              onRemove={() => setSteps(steps.filter((_, j) => j !== i))} />
          ))}
          <button className="btn btn-secondary" style={{ justifyContent: 'center', fontSize: 11, padding: '5px 8px' }}
            disabled={steps.length >= 60}
            onClick={() => setSteps([...steps, steps.length ? { ...steps[steps.length - 1], pin: null } : { highlight: '', pin: null, arrow: '', colorBy: '' }])}>
            Add a Step
          </button>
          {steps.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>First step at slide step</div>
              <input className="prop-input" type="number" min={1} max={1000} step={1} value={s.stepStart}
                onChange={e => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= 1000) set({ stepStart: n }) }}
                style={{ width: 56, padding: '2px 4px', fontSize: 11 }} />
            </div>
          )}
        </>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        Presenting, pointing at a tile shows it in the card and a click pins it; Esc lets go. The canvas shows it once selected.
      </div>
    </div>
  )
}

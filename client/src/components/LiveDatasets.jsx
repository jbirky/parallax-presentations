// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The dataset panel's parts for live datasets and transforms: the form that
// makes a dataset from a URL or a TAP query, a live dataset's source and
// versions, and the steps that shape any dataset for slides.

import { useState, useEffect, useRef } from 'react'
import { Play, Save, RotateCcw, Pin, PinOff, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { api } from '../utils/api'

const SCHEDULE_LABELS = { hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly', manual: 'By hand' }

export function scheduleLabel(schedule) {
  return SCHEDULE_LABELS[schedule] || schedule
}

// "3 hours ago", "in 2 days"
export function relativeTime(value, now = Date.now()) {
  if (!value) return ''
  const diff = new Date(value).getTime() - now
  const abs = Math.abs(diff)
  const units = [['day', 86400000], ['hour', 3600000], ['minute', 60000]]
  for (const [unit, ms] of units) {
    if (abs >= ms) {
      const n = Math.round(abs / ms)
      const words = `${n} ${unit}${n === 1 ? '' : 's'}`
      return diff < 0 ? `${words} ago` : `in ${words}`
    }
  }
  return diff < 0 ? 'just now' : 'in a moment'
}

const label = { fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }
const input = {
  width: '100%', boxSizing: 'border-box', background: 'var(--bg-card)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', padding: '6px 8px', borderRadius: 6, fontSize: 12,
}
const mono = { ...input, fontFamily: 'monospace' }
const button = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, fontSize: 12,
  border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500,
}
const primary = { ...button, background: 'var(--accent)', color: '#fff', border: 'none' }
const small = { ...button, padding: '3px 8px', fontSize: 11 }
const errorBox = { padding: '8px 12px', borderRadius: 6, fontSize: 12, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }
const noteBox = { padding: '8px 12px', borderRadius: 6, fontSize: 12, background: 'rgba(99,102,241,0.08)', color: 'var(--text-secondary)' }

function Field({ title, hint, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={label}>{title}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{hint}</span>}
    </label>
  )
}

// Rows as a table: an array of objects, or a data route's columns
export function RowsTable({ rows, columns, total }) {
  const names = columns ? Object.keys(columns) : rows?.length ? Object.keys(rows[0]) : []
  const count = columns ? (columns[names[0]]?.length || 0) : rows?.length || 0
  const cell = i => c => {
    const v = columns ? columns[c][i] : rows[i][c]
    return v == null ? '' : String(v)
  }
  if (!names.length) return <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>No rows</div>
  return (
    <div style={{ overflowX: 'auto', marginTop: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {names.map(c => <th key={c} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: count }, (_, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.05))' }}>
              {names.map(c => (
                <td key={c} style={{ padding: '3px 8px', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cell(i)(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {total > count && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 8px', textAlign: 'right' }}>
          Showing {count} of {total.toLocaleString()} rows
        </div>
      )}
    </div>
  )
}

// --- Making a live dataset ---

function emptySource(kind, presets) {
  return kind === 'tap'
    ? { service: presets?.[0]?.url || '', query: '', maxRows: '' }
    : { url: '', format: 'auto', rowsPath: '' }
}

function SourceFields({ kind, source, onChange, presets }) {
  const set = patch => onChange({ ...source, ...patch })
  if (kind === 'tap') {
    const preset = presets?.find(p => p.url === source.service)
    return (
      <>
        <Field title="TAP service" hint="Any TAP service works; these are filled in for you.">
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={preset ? preset.url : ''} onChange={e => set({ service: e.target.value })} style={{ ...input, width: 220, flex: 'none' }}>
              {(presets || []).map(p => <option key={p.id} value={p.url}>{p.name}</option>)}
              <option value="">Another service…</option>
            </select>
            <input value={source.service} onChange={e => set({ service: e.target.value })} placeholder="https://example.org/tap" style={mono} />
          </div>
        </Field>
        <Field title="ADQL query" hint="Runs on the service each time the dataset refreshes.">
          <textarea value={source.query} onChange={e => set({ query: e.target.value })} rows={5}
            placeholder={'select pl_name, pl_orbper, pl_bmasse\nfrom pscomppars\nwhere pl_orbper is not null'} style={{ ...mono, resize: 'vertical' }} />
        </Field>
        <Field title="Most rows" hint="Leave blank for up to 1,000,000.">
          <input value={source.maxRows ?? ''} onChange={e => set({ maxRows: e.target.value })} inputMode="numeric" style={{ ...input, width: 160 }} />
        </Field>
      </>
    )
  }
  return (
    <>
      <Field title="Address of the data" hint="A CSV, TSV or JSON file. A Google Sheet works through its published CSV link.">
        <input value={source.url} onChange={e => set({ url: e.target.value })} placeholder="https://example.org/data.csv" style={mono} />
      </Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field title="Format">
          <select value={source.format} onChange={e => set({ format: e.target.value })} style={{ ...input, width: 140 }}>
            <option value="auto">Work it out</option>
            <option value="csv">CSV</option>
            <option value="tsv">TSV</option>
            <option value="json">JSON</option>
          </select>
        </Field>
        <div style={{ flex: 1 }}>
          <Field title="Where the rows are (JSON)" hint="For JSON with its rows inside, such as data.items.">
            <input value={source.rowsPath || ''} onChange={e => set({ rowsPath: e.target.value })} placeholder="data.items" style={mono} />
          </Field>
        </div>
      </div>
    </>
  )
}

// The form for a new live dataset, in place of the panel's list
export function LiveSourceForm({ kind, sources, presentationId, onDone, onCancel }) {
  const [source, setSource] = useState(() => emptySource(kind, sources.presets))
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState(sources.schedules.includes('daily') ? 'daily' : sources.schedules[0])
  const [keyColumn, setKeyColumn] = useState('')
  const [secret, setSecret] = useState('')
  const [tested, setTested] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const allowance = sources.allowance
  const full = allowance && allowance.used >= allowance.limit

  const body = () => ({ sourceKind: kind, source: { ...source, keyColumn: keyColumn || undefined }, secret: secret || undefined })

  async function test() {
    setBusy('test'); setError(null); setTested(null)
    try {
      const result = await api.testDatasetSource(body())
      setTested(result)
      if (!name) {
        const guess = kind === 'tap' ? (source.query.match(/\bfrom\s+([A-Za-z0-9_.]+)/i)?.[1] || 'query') : (source.url.split('/').pop() || '').replace(/\.[a-z]+$/i, '')
        setName(guess.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase())
      }
    } catch (err) { setError(err.message) }
    setBusy(null)
  }

  async function save() {
    setBusy('save'); setError(null)
    try {
      const ds = await api.createLiveDataset({ ...body(), name, schedule })
      if (presentationId) await api.linkDataset(presentationId, ds.id)
      onDone(ds)
    } catch (err) { setError(err.message); setBusy(null) }
  }

  const ready = kind === 'tap' ? source.service && source.query.trim() : source.url.trim()
  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
        {kind === 'tap' ? 'A dataset from a TAP query' : 'A dataset from a URL'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        Parallax fetches it now and again on the schedule you choose. Each time the data changes, it keeps the new version.
      </div>
      {allowance && (
        <div style={{ ...noteBox, marginBottom: 12 }}>
          {allowance.limit
            ? `${allowance.used} of ${allowance.limit} live dataset${allowance.limit === 1 ? '' : 's'} used on the ${allowance.plan} plan.`
            : `The ${allowance.plan} plan doesn’t include live datasets.`}
        </div>
      )}

      <SourceFields kind={kind} source={source} onChange={s => { setSource(s); setTested(null) }} presets={sources.presets} />

      <Field title="Header for the source (optional)" hint="For sources that need a key: Name: value, such as X-API-Key: abc123. Stored encrypted and never shown again.">
        <input type="password" value={secret} onChange={e => setSecret(e.target.value)} autoComplete="off" placeholder="X-API-Key: …" style={mono} />
      </Field>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button onClick={test} disabled={!ready || !!busy} style={{ ...button, opacity: !ready || busy ? 0.6 : 1 }}>
          <Play size={12} /> {busy === 'test' ? 'Fetching…' : 'Test'}
        </button>
        {tested && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tested.rowCount.toLocaleString()} rows, {tested.columns.length} columns</span>}
      </div>

      {error && <div style={{ ...errorBox, marginBottom: 12 }}>{error}</div>}
      {tested && <div style={{ marginBottom: 12 }}><RowsTable rows={tested.rows} total={tested.rowCount} /></div>}

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field title="Name" hint="What plugins call it: ctx.datasets.query(&quot;name&quot;).">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="exoplanets" style={mono} />
          </Field>
        </div>
        <Field title="Refresh">
          <select value={schedule} onChange={e => setSchedule(e.target.value)} style={{ ...input, width: 130 }}>
            {sources.schedules.map(s => <option key={s} value={s}>{scheduleLabel(s)}</option>)}
          </select>
        </Field>
        <Field title="Key column" hint="Optional: rows that only change order aren’t a new version.">
          <select value={keyColumn} onChange={e => setKeyColumn(e.target.value)} disabled={!tested} style={{ ...input, width: 170 }}>
            <option value="">None</option>
            {(tested?.columns || []).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onCancel} style={button}>Cancel</button>
        <button onClick={save} disabled={!ready || !name.trim() || !!busy || full} style={{ ...primary, opacity: !ready || !name.trim() || busy || full ? 0.6 : 1 }}>
          <Save size={12} /> {busy === 'save' ? 'Fetching and saving…' : 'Save dataset'}
        </button>
      </div>
    </div>
  )
}

// --- A live dataset's source, changed in place ---

export function SourceTab({ ds, sources, onChanged }) {
  const [source, setSource] = useState(() => ({ ...emptySource(ds.sourceKind, sources?.presets), ...ds.source }))
  const [schedule, setSchedule] = useState(ds.schedule)
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const schedules = sources?.schedules || [ds.schedule]

  async function save(extra = {}) {
    setBusy(true); setMessage(null)
    try {
      const changes = { source, schedule, ...extra }
      if (secret) changes.secret = secret
      const { dataset, refresh } = await api.updateDatasetSource(ds.id, changes)
      setSecret('')
      setMessage(refresh?.outcome === 'failed' ? { error: refresh.error } : { note: refresh ? 'Saved, and fetched again.' : 'Saved.' })
      onChanged(dataset)
    } catch (err) { setMessage({ error: err.message }) }
    setBusy(false)
  }

  return (
    <div>
      <SourceFields kind={ds.sourceKind} source={source} onChange={setSource} presets={sources?.presets} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <Field title="Refresh">
          <select value={schedule} onChange={e => setSchedule(e.target.value)} style={{ ...input, width: 130 }}>
            {[...new Set([...schedules, ds.schedule])].map(s => <option key={s} value={s}>{scheduleLabel(s)}</option>)}
          </select>
        </Field>
        <div style={{ flex: 1 }}>
          <Field title={ds.hasSecret ? 'Header for the source (one is saved)' : 'Header for the source (optional)'} hint={ds.hasSecret ? 'Type a new one to replace it.' : 'Name: value, such as X-API-Key: abc123.'}>
            <input type="password" value={secret} onChange={e => setSecret(e.target.value)} autoComplete="off" placeholder={ds.hasSecret ? '••••••••' : 'X-API-Key: …'} style={mono} />
          </Field>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
        {ds.lastFetchedAt && <>Fetched {relativeTime(ds.lastFetchedAt)}. </>}
        {ds.nextFetchAt ? <>Next fetch {relativeTime(ds.nextFetchAt)}.</> : ds.schedule === 'manual' ? 'Refreshes when you press Refresh.' : 'Paused: press Refresh to try again.'}
        {ds.schedule !== 'manual' && <> Only datasets a deck uses refresh on their own.</>}
      </div>
      {message?.error && <div style={{ ...errorBox, marginBottom: 10 }}>{message.error}</div>}
      {message?.note && <div style={{ ...noteBox, marginBottom: 10 }}>{message.note}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => save()} disabled={busy} style={{ ...primary, opacity: busy ? 0.6 : 1 }}><Save size={12} /> {busy ? 'Saving…' : 'Save changes'}</button>
        {ds.hasSecret && <button onClick={() => save({ secret: '' })} disabled={busy} style={button}>Remove the header</button>}
      </div>
    </div>
  )
}

// --- Versions, pins and the fetch log ---

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function VersionsTab({ ds, presentationId, linked, pinnedVersionId, onPinned }) {
  const [versions, setVersions] = useState(null)
  const [fetches, setFetches] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let live = true
    Promise.all([api.getDatasetVersions(ds.id), ds.sourceKind !== 'upload' ? api.getDatasetFetches(ds.id) : []])
      .then(([v, f]) => { if (live) { setVersions(v); setFetches(f) } })
      .catch(err => live && setError(err.message))
    return () => { live = false }
  }, [ds.id, ds.currentVersionId, pinnedVersionId])

  async function pin(versionId) {
    try {
      await api.pinDatasetVersion(presentationId, ds.id, versionId)
      onPinned(versionId)
    } catch (err) { setError(err.message) }
  }

  if (error) return <div style={errorBox}>{error}</div>
  if (!versions) return <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
  const canPin = presentationId && linked
  return (
    <div>
      {pinnedVersionId && (
        <div style={{ ...noteBox, marginBottom: 8 }}>
          This deck holds the dataset at its pinned version, whatever later fetches bring. Unpin it to follow the newest again.
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Saved</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>Rows</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>Size</th>
            <th style={{ padding: '4px 8px' }} />
          </tr>
        </thead>
        <tbody>
          {versions.map(v => {
            const pinnedHere = v.id === pinnedVersionId
            return (
              <tr key={v.id} style={{ borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.05))' }}>
                <td style={{ padding: '4px 8px', color: 'var(--text-primary)' }} title={new Date(v.createdAt).toLocaleString()}>
                  {relativeTime(v.createdAt)}
                  {v.current && <span style={{ marginLeft: 6, fontSize: 10, color: '#22c55e' }}>current</span>}
                  {pinnedHere && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)' }}>pinned for this deck</span>}
                  {!pinnedHere && v.pinnedBy?.length > 0 && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>pinned by {v.pinnedBy.length} deck{v.pinnedBy.length === 1 ? '' : 's'}</span>}
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v.rowCount?.toLocaleString()}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>{formatBytes(v.byteSize)}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                  {canPin && (pinnedHere
                    ? <button onClick={() => pin(null)} style={small}><PinOff size={11} /> Unpin</button>
                    : <button onClick={() => pin(v.id)} style={small}><Pin size={11} /> Pin for this deck</button>)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!canPin && versions.length > 1 && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>Link the dataset to this deck to pin a version for it.</div>}

      {fetches.length > 0 && (
        <>
          <div style={{ ...label, marginTop: 14 }}>Recent fetches</div>
          {fetches.slice(0, 10).map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, padding: '3px 0', color: 'var(--text-secondary)' }}>
              <span style={{ width: 110, flex: 'none', color: 'var(--text-muted)' }} title={new Date(f.startedAt).toLocaleString()}>{relativeTime(f.startedAt)}</span>
              <span style={{ width: 80, flex: 'none', color: f.outcome === 'failed' ? '#ef4444' : f.outcome === 'changed' ? '#22c55e' : 'var(--text-muted)' }}>
                {f.outcome === 'changed' ? 'New version' : f.outcome === 'unchanged' ? 'No change' : 'Failed'}
              </span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.error || ''}>
                {f.error || (f.bytes != null ? formatBytes(f.bytes) : '')}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// --- Transforms ---

const STEP_KINDS = [
  ['filter', 'Keep rows'], ['compute', 'Add a column'], ['select', 'Keep columns'], ['rename', 'Rename a column'],
  ['sort', 'Sort'], ['group', 'Group and count'], ['bin', 'Histogram bins'], ['bin2d', '2D bins'],
  ['join', 'Join another dataset'], ['limit', 'First rows'],
]
const STEP_LABELS = Object.fromEntries(STEP_KINDS)

function newStep(op) {
  switch (op) {
    case 'filter': return { op, expr: '' }
    case 'compute': return { op, name: '', expr: '' }
    case 'select': return { op, columns: [] }
    case 'rename': return { op, from: '', to: '' }
    case 'sort': return { op, column: '', direction: 'asc' }
    case 'group': return { op, by: [], aggregates: [{ fn: 'count' }] }
    case 'bin': return { op, column: '', bins: 20, scale: 'linear' }
    case 'bin2d': return { op, x: '', y: '', xBins: 40, yBins: 40, xScale: 'linear', yScale: 'linear' }
    case 'join': return { op, dataset: '', leftOn: '', rightOn: '', how: 'left' }
    case 'limit': return { op, count: 100 }
    default: return { op }
  }
}

const listText = list => (list || []).join(', ')
const textList = text => text.split(',').map(s => s.trim()).filter(Boolean)

// Aggregates as people type them: count, mean(pl_bmasse), max(disc_year) as latest
function aggregatesText(aggregates) {
  return (aggregates || []).map(a => {
    const call = a.fn === 'count' && !a.column ? 'count' : `${a.fn}(${a.column || ''})`
    const plain = a.fn === 'count' && !a.column ? 'count' : `${a.fn}_${a.column}`
    return a.name && a.name !== plain ? `${call} as ${a.name}` : call
  }).join(', ')
}

function textAggregates(text) {
  return textList(text).map(part => {
    const m = part.match(/^(\w+)\s*(?:\(\s*([^)]*?)\s*\))?(?:\s+as\s+(\w+))?$/i)
    if (!m) return { fn: part }
    return { fn: m[1].toLowerCase(), ...(m[2] && { column: m[2] }), ...(m[3] && { name: m[3] }) }
  })
}

function StepFields({ step, onChange, columns, datasets }) {
  const set = patch => onChange({ ...step, ...patch })
  const col = (key, placeholder = 'column') => (
    <input value={step[key] || ''} onChange={e => set({ [key]: e.target.value })} list="transform-columns" placeholder={placeholder} style={{ ...mono, width: 150 }} />
  )
  const num = (key, w = 70) => <input value={step[key] ?? ''} onChange={e => set({ [key]: e.target.value === '' ? '' : Number(e.target.value) })} inputMode="numeric" style={{ ...input, width: w }} />
  const scale = key => (
    <select value={step[key]} onChange={e => set({ [key]: e.target.value })} style={{ ...input, width: 90 }}>
      <option value="linear">even</option><option value="log">log</option>
    </select>
  )
  const words = text => <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{text}</span>
  const row = children => <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>{children}</div>
  switch (step.op) {
    case 'filter':
      return row(<input value={step.expr || ''} onChange={e => set({ expr: e.target.value })} placeholder="pl_bmasse > 10 and disc_year >= 2000" style={{ ...mono, flex: 1, minWidth: 240 }} />)
    case 'compute':
      return row(<>{col('name', 'new column')}{words('=')}<input value={step.expr || ''} onChange={e => set({ expr: e.target.value })} placeholder="pl_bmasse / 317.83" style={{ ...mono, flex: 1, minWidth: 200 }} /></>)
    case 'select':
      return row(<input value={listText(step.columns)} onChange={e => set({ columns: textList(e.target.value) })} placeholder="pl_name, pl_orbper, pl_bmasse" style={{ ...mono, flex: 1 }} />)
    case 'rename':
      return row(<>{col('from')}{words('to')}<input value={step.to || ''} onChange={e => set({ to: e.target.value })} placeholder="new name" style={{ ...mono, width: 150 }} /></>)
    case 'sort':
      return row(<>{col('column')}<select value={step.direction} onChange={e => set({ direction: e.target.value })} style={{ ...input, width: 120 }}><option value="asc">low to high</option><option value="desc">high to low</option></select></>)
    case 'group':
      return row(<>{words('by')}<input value={listText(step.by)} onChange={e => set({ by: textList(e.target.value) })} list="transform-columns" placeholder="discoverymethod" style={{ ...mono, width: 170 }} />
        {words('work out')}<input defaultValue={aggregatesText(step.aggregates)} onChange={e => set({ aggregates: textAggregates(e.target.value) })} placeholder="count, mean(pl_bmasse)" style={{ ...mono, flex: 1, minWidth: 180 }} /></>)
    case 'bin':
      return row(<>{col('column')}{words('into')}{num('bins')}{words('bins,')}{scale('scale')}</>)
    case 'bin2d':
      return row(<>{col('x', 'x column')}{num('xBins', 60)}{scale('xScale')}{words('by')}{col('y', 'y column')}{num('yBins', 60)}{scale('yScale')}</>)
    case 'join':
      return row(<>
        <select value={step.dataset} onChange={e => set({ dataset: e.target.value })} style={{ ...input, width: 150 }}>
          <option value="">dataset…</option>
          {datasets.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {words('where')}{col('leftOn', 'this column')}{words('=')}<input value={step.rightOn || ''} onChange={e => set({ rightOn: e.target.value })} placeholder="its column" style={{ ...mono, width: 130 }} />
        <select value={step.how} onChange={e => set({ how: e.target.value })} style={{ ...input, width: 150 }}>
          <option value="left">keep every row</option><option value="inner">only matches</option>
        </select>
      </>)
    case 'limit':
      return row(<>{words('the first')}{num('count', 90)}{words('rows')}</>)
    default:
      return null
  }
}

// Steps as the server takes them: blank optional fields left out
function cleanSteps(steps) {
  return steps.map(s => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== '' && v !== undefined)))
}

export function TransformsTab({ ds, datasets, onSaved }) {
  const [steps, setSteps] = useState(() => ds.transforms || [])
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(true)
  const timer = useRef(null)
  const columnNames = [...new Set([
    ...(ds.sourceColumns || ds.columns || []).map(c => c.name),
    ...steps.flatMap(s => [s.op === 'compute' && s.name, s.op === 'rename' && s.to]).filter(Boolean),
  ])]

  // Previews the steps as they're edited, after a pause
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const { preview: p } = await api.previewDatasetTransforms(ds.id, cleanSteps(steps))
        setPreview(p); setError(null)
      } catch (err) { setError(err.message) }
    }, 500)
    return () => clearTimeout(timer.current)
  }, [ds.id, JSON.stringify(steps)])

  const change = next => { setSteps(next); setSaved(false) }
  const update = (i, step) => change(steps.map((s, k) => (k === i ? step : s)))
  const move = (i, by) => {
    const next = [...steps]
    const [s] = next.splice(i, 1)
    next.splice(i + by, 0, s)
    change(next)
  }

  async function save() {
    setBusy(true)
    try {
      const { dataset } = await api.saveDatasetTransforms(ds.id, cleanSteps(steps))
      setSaved(true); setError(null)
      onSaved(dataset)
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
        Steps run in order on every read, so they follow each refresh. Expressions use Graph’s functions (log is base 10, ln is natural); write * between column names, and put names with spaces in `backticks`.
      </div>
      <datalist id="transform-columns">{columnNames.map(c => <option key={c} value={c} />)}</datalist>
      {steps.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>No steps: slides get the data as it comes.</div>}
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.05))' }}>
          <span style={{ width: 18, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', flex: 'none' }}>{i + 1}</span>
          <span style={{ width: 130, fontSize: 12, color: 'var(--text-primary)', flex: 'none' }}>{STEP_LABELS[step.op] || step.op}</span>
          <StepFields step={step} onChange={s => update(i, s)} columns={columnNames} datasets={datasets.filter(d => d !== ds.name)} />
          <div style={{ display: 'flex', gap: 2, flex: 'none' }}>
            <button title="Move up" disabled={i === 0} onClick={() => move(i, -1)} style={{ ...small, padding: '3px 5px', opacity: i === 0 ? 0.4 : 1 }}><ArrowUp size={11} /></button>
            <button title="Move down" disabled={i === steps.length - 1} onClick={() => move(i, 1)} style={{ ...small, padding: '3px 5px', opacity: i === steps.length - 1 ? 0.4 : 1 }}><ArrowDown size={11} /></button>
            <button title="Remove step" onClick={() => change(steps.filter((_, k) => k !== i))} style={{ ...small, padding: '3px 5px' }}><Trash2 size={11} /></button>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0' }}>
        <Plus size={12} style={{ color: 'var(--text-muted)' }} />
        <select value="" onChange={e => e.target.value && change([...steps, newStep(e.target.value)])} style={{ ...input, width: 200 }} aria-label="Add a step">
          <option value="">Add a step…</option>
          {STEP_KINDS.map(([op, text]) => <option key={op} value={op}>{text}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {!saved && <button onClick={() => change(ds.transforms || [])} style={button}><RotateCcw size={12} /> Undo changes</button>}
        <button onClick={save} disabled={busy || saved} style={{ ...primary, opacity: busy || saved ? 0.6 : 1 }}><Save size={12} /> {busy ? 'Saving…' : saved ? 'Saved' : 'Save steps'}</button>
      </div>
      {error && <div style={{ ...errorBox, marginBottom: 8 }}>{error}</div>}
      {preview && !error && (
        <>
          <div style={label}>What slides get: {preview.rowCount.toLocaleString()} rows, {preview.columns.length} columns</div>
          <RowsTable rows={preview.rows} total={preview.rowCount} />
        </>
      )}
    </div>
  )
}

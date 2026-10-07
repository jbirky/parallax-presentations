// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Admin dashboard (/admin): sign-ups, per-user storage and processing, and
// the server container's CPU and memory. The server answers only for admins.

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { api } from '../utils/api'
import { ColumnChart, LineChart } from '../components/AdminCharts'
import { formatSize, planSummary } from '../utils/plans'

const REFRESH_MS = 60 * 1000

const JOB_LABELS = {
  video_conversion: 'Video conversion',
  powerpoint_import: 'PowerPoint import',
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const v = bytes / 1024 ** i
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

function formatDuration(ms) {
  if (!ms) return '0 s'
  const s = ms / 1000
  if (s < 10) return `${s.toFixed(1)} s`
  if (s < 60) return `${Math.round(s)} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ${Math.round(s % 60)} s`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}

function formatDay(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
}

function formatAgo(iso) {
  if (!iso) return '—'
  const minutes = Math.round((Date.now() - new Date(iso)) / 60000)
  if (minutes < 60) return minutes <= 1 ? 'Just now' : `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days <= 30 ? `${days} days ago` : formatDay(iso)
}

const formatClock = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const formatWeek = iso => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

// Hourly averages and peaks, the table view for the CPU and memory charts
function hourlyRows(samples, key) {
  const hours = new Map()
  for (const s of samples) {
    const d = new Date(s.t)
    d.setMinutes(0, 0, 0)
    const bucket = hours.get(d.getTime()) || { t: d.getTime(), sum: 0, n: 0, peak: 0 }
    bucket.sum += s[key]
    bucket.n += 1
    bucket.peak = Math.max(bucket.peak, s[key])
    hours.set(d.getTime(), bucket)
  }
  return [...hours.values()].sort((a, b) => b.t - a.t).map(b => ({ t: b.t, average: b.sum / b.n, peak: b.peak }))
}

const styles = {
  // The app's body doesn't scroll (the editor needs that), so this page does
  page: { height: '100%', overflowY: 'auto', background: 'var(--bg-primary)', color: 'var(--text-primary)' },
  wrap: { maxWidth: 1120, margin: '0 auto', paddingInline: 16, paddingBlock: '20px 64px', display: 'grid', gap: 20 },
  panel: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, minWidth: 0 },
  h2: { margin: '0 0 2px', fontSize: 14, fontWeight: 600 },
  sub: { margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' },
  muted: { color: 'var(--text-muted)' },
  th: { textAlign: 'left', fontWeight: 500, fontSize: 12, color: 'var(--text-muted)', padding: '8px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
  td: { padding: '9px 10px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'top' },
  num: { fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' },
  details: { marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' },
}

function Stat({ label, value, note, first, children }) {
  return (
    <div style={{ flex: '1 1 170px', padding: '4px 16px', borderLeft: first ? 'none' : '1px solid var(--border)', minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.3 }}>{value}</div>
      {note && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{note}</div>}
      {children}
    </div>
  )
}

// Ends every guest session, after a confirm, and deletes their work
function EndGuestSessions({ active, onEnded }) {
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState(null)

  async function endAll() {
    const sessions = `${active} guest session${active === 1 ? '' : 's'}`
    if (!confirm(`End all ${sessions}? Their presentations and uploads will be deleted.`)) return
    setWorking(true)
    setMessage(null)
    try {
      const { ended, cleanupPending } = await api.endAllGuestSessions()
      setMessage(`Ended ${ended} session${ended === 1 ? '' : 's'}.` +
        (cleanupPending ? ` Files for ${cleanupPending} couldn’t be deleted yet; cleanup will retry.` : ''))
      onEnded?.()
    } catch (err) {
      setMessage(`Couldn’t end the sessions: ${err.message}`)
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      {active > 0 && (
        <button className="btn btn-secondary" onClick={endAll} disabled={working} style={{ marginTop: 6, padding: '3px 8px', fontSize: 12 }}>
          {working ? 'Ending…' : 'End all'}
        </button>
      )}
      {message && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{message}</div>}
    </>
  )
}

const MB = 1024 * 1024
const GB = 1024 * MB
const planName = (plans, id) => plans.find(p => p.id === id)?.name || id

// What a move from one plan to another changes, for the confirm
export function planChangeSummary(user, from, to) {
  const lines = [`Move ${user.name || user.email} from ${from?.name || user.plan} to ${to.name}?`,
    `Storage limit: ${formatSize(to.storageBytes)}.`]
  if (from?.expirationDays && !to.expirationDays) lines.push('Their presentations will stop expiring.')
  if (!from?.expirationDays && to.expirationDays) {
    lines.push(`Their existing presentations are kept; new ones will expire after ${to.expirationDays} days.`)
  }
  if (user.hasSubscription) lines.push('They pay through Stripe, so a billing change can switch this back.')
  return lines.join('\n\n')
}

// An account's plan, which an admin can change after a confirm
function PlanPicker({ user, plans, onChanged }) {
  const [moving, setMoving] = useState(null) // the plan being moved to
  const [message, setMessage] = useState(null)
  const choices = plans.filter(p => p.assignable)

  async function change(plan) {
    const to = choices.find(p => p.id === plan)
    if (!to || plan === user.plan) return
    if (!confirm(planChangeSummary(user, plans.find(p => p.id === user.plan), to))) return
    setMoving(plan)
    setMessage(null)
    try {
      const { unexpired } = await api.setUserPlan(user.id, plan)
      setMessage(`Moved to ${to.name}.` +
        (unexpired ? ` ${unexpired} presentation${unexpired === 1 ? '' : 's'} no longer expire${unexpired === 1 ? 's' : ''}.` : ''))
      await onChanged?.()
    } catch (err) {
      setMessage(`Couldn’t change the plan: ${err.message}`)
    } finally {
      setMoving(null)
    }
  }

  return (
    <>
      <select className="select-sm" value={moving || user.plan} disabled={!!moving}
        onChange={e => change(e.target.value)} aria-label={`Plan for ${user.email}`}>
        {!choices.some(p => p.id === user.plan) && <option value={user.plan}>{planName(plans, user.plan)}</option>}
        {choices.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {message && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)', maxWidth: 180 }}>{message}</div>}
    </>
  )
}

// ── Plan editor ──

const EMPTY_PLAN = {
  id: '', name: '', storageBytes: GB, maxPresentations: null, expirationDays: null, maxFileBytes: null,
  stripePriceId: null, priceLabel: null, public: false, sortOrder: 10,
}

// A plan as form fields: sizes in MB or GB, blanks for no limit
export function toPlanForm(plan) {
  const inGB = plan.storageBytes >= GB && plan.storageBytes % GB === 0
  return {
    id: plan.id,
    name: plan.name,
    storage: String(inGB ? plan.storageBytes / GB : Math.round(plan.storageBytes / MB * 10) / 10),
    storageUnit: inGB ? 'GB' : 'MB',
    maxPresentations: plan.maxPresentations == null ? '' : String(plan.maxPresentations),
    expirationDays: plan.expirationDays == null ? '' : String(plan.expirationDays),
    maxFileMB: plan.maxFileBytes == null ? '' : String(Math.round(plan.maxFileBytes / MB * 10) / 10),
    stripePriceId: plan.stripePriceId || '',
    priceLabel: plan.priceLabel || '',
    public: !!plan.public,
    sortOrder: String(plan.sortOrder ?? 0),
  }
}

// Form fields back to what the server takes; blanks stay blank for it to check
export function fromPlanForm(form) {
  const bytes = (value, unit) => value.trim() === '' ? null : Math.round(Number(value) * unit)
  return {
    id: form.id.trim(),
    name: form.name,
    storageBytes: bytes(form.storage, form.storageUnit === 'GB' ? GB : MB),
    maxPresentations: form.maxPresentations.trim() === '' ? null : Number(form.maxPresentations),
    expirationDays: form.expirationDays.trim() === '' ? null : Number(form.expirationDays),
    maxFileBytes: bytes(form.maxFileMB, MB),
    stripePriceId: form.stripePriceId.trim() || null,
    priceLabel: form.priceLabel.trim() || null,
    public: form.public,
    sortOrder: form.sortOrder.trim() === '' ? 0 : Number(form.sortOrder),
  }
}

// What saving `next` over `old` does to the `accounts` already on it, for the confirm
export function planEditEffects(old, next, accounts) {
  const effects = []
  if (old.expirationDays && !next.expirationDays) {
    effects.push(!accounts ? 'Presentations will stop expiring.'
      : `Presentations of ${accounts === 1 ? 'the account' : `the ${accounts} accounts`} on it will stop expiring.`)
  } else if (!old.expirationDays && next.expirationDays) {
    effects.push(`Only presentations made from now on will expire, after ${next.expirationDays} days; existing ones won’t.`)
  } else if (old.expirationDays !== next.expirationDays) {
    effects.push(`The new expiry applies to presentations made from now on; existing ones keep their dates.`)
  }
  if (accounts && next.storageBytes < old.storageBytes) {
    effects.push(`Accounts on it storing more than ${formatSize(next.storageBytes)} can’t upload until they free space.`)
  }
  if (accounts && next.maxPresentations != null && (old.maxPresentations == null || next.maxPresentations < old.maxPresentations)) {
    effects.push(`Accounts on it with more than ${next.maxPresentations} presentations keep them but can’t make more.`)
  }
  if (old.stripePriceId && old.stripePriceId !== next.stripePriceId) {
    effects.push('Existing subscribers stay on the old price in Stripe; renewals on it will no longer match a plan until you move them.')
  }
  return effects
}

const fieldLabel = { display: 'grid', gap: 3, fontSize: 12, color: 'var(--text-muted)' }
const fieldInput = { background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 8px', borderRadius: 6, fontSize: 13, minWidth: 0, width: '100%', boxSizing: 'border-box' }
const chip = { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }

function Field({ label, hint, children }) {
  return (
    <label style={fieldLabel}>
      <span>{label}{hint && <span style={{ color: 'var(--text-muted)', opacity: 0.8 }}> · {hint}</span>}</span>
      {children}
    </label>
  )
}

// Edits one plan, or a new one when `isNew`
function PlanForm({ plan, isNew, accounts, onDone }) {
  const [form, setForm] = useState(() => toPlanForm(plan))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const builtIn = plan.id === 'free' || plan.id === 'guest'

  async function save(e) {
    e.preventDefault()
    const next = fromPlanForm(form)
    if (!isNew) {
      const effects = planEditEffects(plan, next, accounts)
      if (effects.length && !confirm([`Save ${next.name || plan.name}?`, ...effects].join('\n\n'))) return
    }
    setSaving(true)
    setError(null)
    try {
      const { unexpired } = await api.savePlan(next, isNew)
      await onDone?.(unexpired ? `Saved. ${unexpired} presentation${unexpired === 1 ? '' : 's'} stopped expiring.` : 'Saved.')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        {isNew && (
          <Field label="Id" hint="kept on accounts">
            <input style={fieldInput} value={form.id} onChange={set('id')} placeholder="starter" required pattern="[a-z][a-z0-9-]{1,31}" />
          </Field>
        )}
        <Field label="Name"><input style={fieldInput} value={form.name} onChange={set('name')} required maxLength={40} /></Field>
        <Field label="Storage">
          <div style={{ display: 'flex', gap: 4 }}>
            <input style={fieldInput} type="number" min="1" step="any" value={form.storage} onChange={set('storage')} required />
            <select className="select-sm" value={form.storageUnit} onChange={set('storageUnit')} aria-label="Storage unit">
              <option>MB</option><option>GB</option>
            </select>
          </div>
        </Field>
        <Field label="Presentations" hint="blank: unlimited">
          <input style={fieldInput} type="number" min="1" step="1" value={form.maxPresentations} onChange={set('maxPresentations')} />
        </Field>
        <Field label="Expires after (days)" hint="blank: never">
          <input style={fieldInput} type="number" min="1" step="1" value={form.expirationDays} onChange={set('expirationDays')} />
        </Field>
        <Field label="Largest file (MB)" hint="blank: 500">
          <input style={fieldInput} type="number" min="1" max="500" step="any" value={form.maxFileMB} onChange={set('maxFileMB')} />
        </Field>
        <Field label="Order"><input style={fieldInput} type="number" min="0" step="1" value={form.sortOrder} onChange={set('sortOrder')} /></Field>
        {!builtIn && (
          <Field label="Stripe price ID" hint="blank: not for sale">
            <input style={{ ...fieldInput, fontFamily: 'monospace' }} value={form.stripePriceId} onChange={set('stripePriceId')} placeholder="price_…" spellCheck={false} />
          </Field>
        )}
        {plan.id !== 'guest' && (
          <Field label="Price label" hint="shown to buyers">
            <input style={fieldInput} value={form.priceLabel} onChange={set('priceLabel')} placeholder="$5/mo" maxLength={40} />
          </Field>
        )}
      </div>
      {plan.id !== 'guest' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={form.public} onChange={set('public')} /> Listed for people choosing a plan
        </label>
      )}
      {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '5px 12px', fontSize: 13 }}>
          {saving ? 'Saving…' : isNew ? 'Add plan' : 'Save'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => onDone?.(null)} style={{ padding: '5px 12px', fontSize: 13 }}>Cancel</button>
      </div>
    </form>
  )
}

function PlanCard({ plan, accounts, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const builtIn = plan.id === 'free' || plan.id === 'guest'

  async function remove() {
    if (!confirm(`Delete the ${plan.name} plan?`)) return
    setDeleting(true)
    try {
      await api.deletePlan(plan.id)
      await onChanged?.()
    } catch (err) {
      setMessage(err.message)
      setDeleting(false)
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, display: 'grid', gap: 8, alignContent: 'start', minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 6 }}>
        <strong style={{ fontSize: 14 }}>{plan.name}</strong>
        <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{plan.id}</code>
        <span style={chip}>{plan.id === 'guest' ? 'Guest mode' : plan.public ? 'Listed' : 'Hidden'}</span>
        {plan.id !== 'guest' && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            {accounts} account{accounts === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {editing ? (
        <PlanForm plan={plan} accounts={accounts} onDone={async done => {
          if (done) { setMessage(done); await onChanged?.() }
          setEditing(false)
        }} />
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {planSummary(plan).map(line => <div key={line}>{line}</div>)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
            {plan.stripePriceId
              ? <>{plan.priceLabel || 'Priced'} · <code>{plan.stripePriceId}</code></>
              : plan.priceLabel || (builtIn ? '—' : 'Not for sale')}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary" onClick={() => { setMessage(null); setEditing(true) }} style={{ padding: '3px 10px', fontSize: 12 }}>Edit</button>
            {!builtIn && (
              <button className="btn btn-secondary" onClick={remove} disabled={deleting || accounts > 0}
                title={accounts > 0 ? 'Move its accounts to another plan first' : undefined} style={{ padding: '3px 10px', fontSize: 12 }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
          {message && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{message}</div>}
        </>
      )}
    </div>
  )
}

function PlansPanel({ plans, byPlan, billingEnabled, onChanged }) {
  const [adding, setAdding] = useState(false)
  return (
    <section style={styles.panel}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={styles.h2}>Plans</h2>
          <p style={styles.sub}>
            Limits apply as soon as you save.{' '}
            {billingEnabled
              ? 'Listed plans with a Stripe price can be bought from the dashboard.'
              : 'Billing is switched off, so Stripe prices take effect once it’s on.'}
          </p>
        </div>
        {!adding && <button className="btn btn-secondary" onClick={() => setAdding(true)} style={{ padding: '5px 12px', fontSize: 12 }}>Add a plan</button>}
      </div>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {adding && (
          <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 12 }}>
            <PlanForm plan={EMPTY_PLAN} isNew accounts={0} onDone={async done => {
              if (done) await onChanged?.()
              setAdding(false)
            }} />
          </div>
        )}
        {plans.map(p => <PlanCard key={p.id} plan={p} accounts={byPlan?.[p.id] || 0} onChanged={onChanged} />)}
      </div>
    </section>
  )
}

// ---- The landing page's examples ----

const slugify = str => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'
const exampleThumb = e => (e.hasThumbnail ? `/examples/thumbs/${e.slug}.jpg?v=${Date.parse(e.updatedAt) || 0}` : e.builtin && !e.ownDeck ? `/examples/thumbs/${e.slug}.jpg` : null)
const background = bg => (bg?.type === 'color' && bg.color) || (bg?.type === 'gradient' && bg.gradient) || '#1e1e2e'
const smallBtn = { padding: '3px 10px', fontSize: 12 }

// A card's words as form fields, and back
const toExampleForm = e => ({ field: e.field || '', title: e.title || '', description: e.description || '', tags: (e.tags || []).join(', ') })

function ExampleFields({ form, set, fields }) {
  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
      <Field label="Title"><input style={fieldInput} value={form.title} onChange={set('title')} required maxLength={80} /></Field>
      <Field label="Field" hint="the filter it's under">
        <input style={fieldInput} value={form.field} onChange={set('field')} maxLength={40} list="example-fields" />
        <datalist id="example-fields">{fields.map(f => <option key={f} value={f} />)}</datalist>
      </Field>
      <Field label="Tags" hint="comma-separated"><input style={fieldInput} value={form.tags} onChange={set('tags')} placeholder="Graph with sliders, 3D molecule" /></Field>
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label="Description"><textarea style={{ ...fieldInput, minHeight: 54, resize: 'vertical' }} value={form.description} onChange={set('description')} maxLength={300} /></Field>
      </div>
    </div>
  )
}

function AddExample({ fields, onAdded, onCancel }) {
  const [presentations, setPresentations] = useState(null)
  const [presentationId, setPresentationId] = useState('')
  const [form, setForm] = useState({ field: '', title: '', description: '', tags: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))
  useEffect(() => {
    api.getPresentations().then(list => setPresentations((list || []).filter(p => !p.role || p.role === 'owner'))).catch(err => setError(err.message))
  }, [])
  function choose(e) {
    const id = e.target.value
    setPresentationId(id)
    const p = presentations.find(x => x.id === id)
    if (p && !form.title) setForm(f => ({ ...f, title: p.title || '' }))
  }
  async function add(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onAdded(await api.addExample({ presentationId, ...form }))
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }
  return (
    <form onSubmit={add} style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 12, display: 'grid', gap: 10 }}>
      <Field label="Presentation" hint="its slides are copied as they are now">
        <select className="select-sm" value={presentationId} onChange={choose} required disabled={!presentations}>
          <option value="">{presentations ? 'Choose one of your presentations…' : 'Loading…'}</option>
          {presentations?.map(p => <option key={p.id} value={p.id}>{p.title || 'Untitled'}</option>)}
        </select>
      </Field>
      <ExampleFields form={form} set={set} fields={fields} />
      {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={saving || !presentationId} style={{ padding: '5px 12px', fontSize: 13 }}>{saving ? 'Adding…' : 'Add example'}</button>
        <button type="button" className="btn btn-secondary" disabled={saving} onClick={onCancel} style={{ padding: '5px 12px', fontSize: 13 }}>Cancel</button>
        {saving && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Copying the slides and drawing the thumbnail, a few seconds…</span>}
      </div>
    </form>
  )
}

function ExampleRow({ example: e, first, last, fields, busy, onAct, onMove }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => toExampleForm(e))
  const set = key => ev => setForm(f => ({ ...f, [key]: ev.target.value }))
  const thumb = exampleThumb(e)
  const working = busy === e.slug
  const save = async ev => {
    ev.preventDefault()
    if (await onAct(e, () => api.saveExample(e.slug, form))) setEditing(false)
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr)', gap: 14, padding: '12px 0', borderTop: first ? 'none' : '1px solid var(--border)', opacity: e.card || e.hero ? 1 : 0.65 }}>
      <a href={`/examples/${e.slug}`} target="_blank" rel="noopener noreferrer" title="Open the live deck" style={{ display: 'block', aspectRatio: '16 / 9', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', background: background(e.background) }}>
        {thumb
          ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <span style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 8, fontSize: 11, color: '#fff', textAlign: 'center' }}>{e.title}</span>}
      </a>
      <div style={{ display: 'grid', gap: 6, alignContent: 'start', minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 6 }}>
          <strong style={{ fontSize: 14 }}>{e.title}</strong>
          {e.field && <span style={chip}>{e.field}</span>}
          {e.hero && <span style={{ ...chip, background: 'var(--accent)', color: '#fff' }}>At the top</span>}
          {!e.card && !e.hero && <span style={chip}>Hidden</span>}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {e.sourcePresentationId
              ? (e.sourceTitle ? <>Copy of <a href={`/dashboard/${slugify(e.sourceTitle)}`} style={{ color: 'var(--accent)' }}>{e.sourceTitle}</a></> : 'Copy of a presentation that’s been deleted')
              : 'Built in'}
          </span>
        </div>
        {editing ? (
          <form onSubmit={save} style={{ display: 'grid', gap: 10 }}>
            <ExampleFields form={form} set={set} fields={fields} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={working} style={{ padding: '5px 12px', fontSize: 13 }}>{working ? 'Saving…' : 'Save'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setForm(toExampleForm(e)); setEditing(false) }} style={{ padding: '5px 12px', fontSize: 13 }}>Cancel</button>
            </div>
          </form>
        ) : (<>
          {e.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{e.description}</div>}
          {e.tags.length > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.tags.join(' · ')}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button className="btn btn-secondary" style={smallBtn} disabled={working} onClick={() => setEditing(true)}>Edit</button>
            <button className="btn btn-secondary" style={smallBtn} disabled={working || first} onClick={() => onMove(e, -1)} aria-label={`Move ${e.title} up`}>↑</button>
            <button className="btn btn-secondary" style={smallBtn} disabled={working || last} onClick={() => onMove(e, 1)} aria-label={`Move ${e.title} down`}>↓</button>
            {!e.hero && <button className="btn btn-secondary" style={smallBtn} disabled={working} onClick={() => onAct(e, () => api.saveExample(e.slug, { card: !e.card }))}>{e.card ? 'Hide' : 'Show'}</button>}
            {!e.hero && <button className="btn btn-secondary" style={smallBtn} disabled={working} onClick={() => onAct(e, () => api.saveExample(e.slug, { hero: true }))}>Put at the top</button>}
            {e.sourcePresentationId
              ? <button className="btn btn-secondary" style={smallBtn} disabled={working || !e.sourceTitle} onClick={() => onAct(e, () => api.refreshExample(e.slug))} title="Copy the slides again, as the presentation is now">Update from presentation</button>
              : <button className="btn btn-secondary" style={smallBtn} disabled={working} onClick={() => onAct(e, () => api.copyExample(e.slug))} title="Make a presentation of yours from it, to change its slides">Make an editable copy</button>}
            <button className="btn btn-secondary" style={smallBtn} disabled={working} onClick={() => onAct(e, () => api.redrawExampleThumbnail(e.slug))}>Redraw thumbnail</button>
            {!e.builtin && !e.hero && <button className="btn btn-secondary" style={smallBtn} disabled={working}
              onClick={() => confirm(`Delete the example “${e.title}”? The presentation it came from stays.`) && onAct(e, () => api.deleteExample(e.slug), { removed: true })}>Delete</button>}
          </div>
        </>)}
        {working && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Working…</div>}
      </div>
    </div>
  )
}

// The deck at the top of the landing page and the example cards under it
export function ExamplesPanel() {
  const [list, setList] = useState(null)
  const [canDraw, setCanDraw] = useState(true)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    try {
      const r = await api.getAdminExamples()
      setList(r.examples)
      setCanDraw(r.thumbnails)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])
  useEffect(() => { load() }, [load])

  // Runs a change to one example; true when it went through
  const act = useCallback(async (e, change, { removed = false } = {}) => {
    setBusy(e.slug)
    setNotice(null)
    try {
      const r = await change()
      if (removed) setList(l => l.filter(x => x.slug !== e.slug))
      else await load()
      const parts = []
      if (r?.presentation) parts.push(`Made “${r.presentation.title}” in your presentations; change its slides there, then use Update from presentation.`)
      if (r?.thumbnailError) parts.push(`The thumbnail wasn’t drawn: ${r.thumbnailError}`)
      if (parts.length) setNotice({ slug: e.slug, text: parts.join(' '), link: r?.presentation ? `/dashboard/${slugify(r.presentation.title)}` : null })
      return true
    } catch (err) {
      setNotice({ slug: e.slug, text: err.message })
      return false
    } finally {
      setBusy(null)
    }
  }, [load])

  const move = useCallback(async (e, dir) => {
    const slugs = list.map(x => x.slug)
    const at = slugs.indexOf(e.slug)
    ;[slugs[at], slugs[at + dir]] = [slugs[at + dir], slugs[at]]
    setBusy(e.slug)
    try { setList((await api.orderExamples(slugs)).examples) } catch (err) { setNotice({ slug: e.slug, text: err.message }) } finally { setBusy(null) }
  }, [list])

  const fields = [...new Set(['Physics', 'Astronomy', 'Chemistry', 'Mathematics', 'Engineering and CS', ...(list || []).map(e => e.field).filter(Boolean)])]

  return (
    <section style={styles.panel} aria-labelledby="admin-examples">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={styles.h2} id="admin-examples">Landing page examples</h2>
          <p style={styles.sub}>
            The deck at the top of the landing page and the example cards under it, in this order. An example is a copy
            of one of your presentations: change the presentation, then use Update from presentation to show it.
            {canDraw ? ' The server draws each card’s thumbnail from the first slide.' : ' This server has no Chromium, so it can’t draw thumbnails; new cards show a placeholder.'}
          </p>
        </div>
        {!adding && <button className="btn btn-secondary" onClick={() => setAdding(true)} style={{ padding: '5px 12px', fontSize: 12 }}>Add an example</button>}
      </div>
      {adding && <AddExample fields={fields} onCancel={() => setAdding(false)} onAdded={async r => {
        setAdding(false)
        await load()
        if (r.thumbnailError) setNotice({ slug: r.example.slug, text: `Added, but the thumbnail wasn’t drawn: ${r.thumbnailError}` })
      }} />}
      {error && <p style={{ fontSize: 13, margin: '8px 0 0' }}>Couldn’t load the examples: {error}</p>}
      {notice && !list?.some(e => e.slug === notice.slug) && <div role="status" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0' }}>{notice.text}</div>}
      {list && list.map((e, i) => (
        <div key={e.slug}>
          <ExampleRow example={e} first={i === 0} last={i === list.length - 1} fields={fields} busy={busy} onAct={act} onMove={move} />
          {notice?.slug === e.slug && (
            <div role="status" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '-4px 0 10px 174px' }}>
              {notice.text}{notice.link && <> <a href={notice.link} style={{ color: 'var(--accent)' }}>Open it</a></>}
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

function ChartPanel({ title, subtitle, children, table }) {
  return (
    <section style={styles.panel}>
      <h2 style={styles.h2}>{title}</h2>
      <p style={styles.sub}>{subtitle}</p>
      {children}
      {table && (
        <details style={styles.details}>
          <summary style={{ cursor: 'pointer' }}>Show numbers</summary>
          <div style={{ overflowX: 'auto', marginTop: 8 }}>{table}</div>
        </details>
      )}
    </section>
  )
}

// Columns from `numbersFrom` on hold numbers and align right
function SimpleTable({ columns, rows, numbersFrom = 1 }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{columns.map((c, i) => <th key={c} style={{ ...styles.th, ...(i >= numbersFrom ? styles.num : {}) }}>{c}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((cell, j) => <td key={j} style={{ ...styles.td, ...(j >= numbersFrom ? styles.num : {}) }}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  )
}

// Same thresholds and colors as the storage meter on the dashboard
function StorageMeter({ used, limit }) {
  const ratio = limit ? used / limit : 0
  const color = ratio > 0.9 ? '#ef4444' : ratio > 0.7 ? '#f59e0b' : 'var(--accent)'
  const status = ratio >= 1 ? 'Over limit' : ratio > 0.9 ? 'Almost full' : ratio > 0.7 ? 'Near limit' : null
  return (
    <div style={{ display: 'grid', gap: 4, minWidth: 150 }}>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, ratio * 100)}%`, background: color, borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
        {formatBytes(used)} of {formatBytes(limit)}{status && <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}> · {status}</strong>}
      </div>
    </div>
  )
}

// The dashboard itself, rendered from the overview data
export function AdminDashboard({ data, refreshing = false, onGuestSessionsEnded, onPlanChanged, showExamples = false }) {
  const system = data.system
  const samples = system?.samples || []
  const cpuPoints = samples.map(s => ({ t: s.t, value: s.cpuPercent }))
  const memPoints = samples.map(s => ({ t: s.t, value: s.memBytes / (1024 * 1024) }))
  const weeks = (data.signupsByWeek || []).map(w => ({
    key: w.weekStart, label: formatWeek(w.weekStart), tooltipLabel: `Week of ${formatWeek(w.weekStart)}`, value: w.signups,
  }))
  const plans = Object.entries(data.accounts.byPlan || {}).sort((a, b) => b[1] - a[1])
  const signupsInRange = weeks.reduce((sum, w) => sum + w.value, 0)
  const collecting = system?.intervalSeconds
    ? `Collecting. Readings are taken every ${system.intervalSeconds} seconds; the chart appears after two.`
    : 'Collecting.'

  return (
    <div style={{ display: 'grid', gap: 20, opacity: refreshing ? 0.6 : 1, transition: 'opacity 150ms' }}>
      <section style={{ ...styles.panel, display: 'flex', flexWrap: 'wrap', rowGap: 14, padding: '14px 0' }}>
        <Stat first label="Accounts" value={data.accounts.total.toLocaleString()}
          note={plans.length ? plans.map(([plan, n]) => `${n} ${plan}`).join(' · ') : 'None yet'} />
        <Stat label="New accounts" value={data.accounts.new30d.toLocaleString()} note={`Last 30 days · ${data.accounts.new7d} in the last 7`} />
        <Stat label="Guest sessions now" value={data.guestsActive === null ? '—' : data.guestsActive.toLocaleString()}
          note={data.guestsActive === null ? 'Guest mode isn’t set up here' : 'Active in the last 12 hours'}>
          {data.guestsActive !== null && <EndGuestSessions active={data.guestsActive} onEnded={onGuestSessionsEnded} />}
        </Stat>
        <Stat label="Storage used" value={formatBytes(data.storage.uploadBytes + data.storage.datasetBytes)}
          note={`${formatBytes(data.storage.uploadBytes)} uploads · ${formatBytes(data.storage.datasetBytes)} datasets`} />
        <Stat label="Memory" value={formatBytes(system.memoryBytes)}
          note={system.memoryLimitBytes ? `of ${formatBytes(system.memoryLimitBytes)} limit` : 'No limit set'} />
        <Stat label="CPU" value={system.cpuPercent === null ? '—' : `${system.cpuPercent}%`}
          note={system.source === 'process' ? 'This process, 100% = one core' : 'Last minute, 100% = one core'} />
      </section>

      <ChartPanel title="Sign-ups per week"
        subtitle={signupsInRange ? `Last 12 weeks · ${signupsInRange} in total` : 'Last 12 weeks · none in this period'}
        table={<SimpleTable columns={['Week of', 'Sign-ups']} rows={[...weeks].reverse().map(w => [w.label, w.value])} />}>
        <ColumnChart data={weeks} integer ariaLabel="Sign-ups per week, last 12 weeks" />
      </ChartPanel>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <ChartPanel title="Container CPU" subtitle={`Last 24 hours · 100% = one core${system.source === 'process' ? ' · this process only' : ''} · starts over when the server restarts`}
          table={samples.length > 1 && <SimpleTable columns={['Hour', 'Average', 'Peak']}
            rows={hourlyRows(samples, 'cpuPercent').map(r => [formatClock(r.t), `${r.average.toFixed(1)}%`, `${r.peak.toFixed(1)}%`])} />}>
          <LineChart points={cpuPoints} formatValue={v => `${Math.round(v * 10) / 10}%`} formatTime={formatClock}
            ariaLabel="Container CPU over the last 24 hours" emptyText={collecting} />
        </ChartPanel>
        <ChartPanel title="Container memory"
          subtitle={`Last 24 hours · ${system.memoryLimitBytes ? `limit ${formatBytes(system.memoryLimitBytes)}` : 'no limit set'} · starts over when the server restarts`}
          table={samples.length > 1 && <SimpleTable columns={['Hour', 'Average', 'Peak']}
            rows={hourlyRows(samples, 'memBytes').map(r => [formatClock(r.t), formatBytes(r.average), formatBytes(r.peak)])} />}>
          <LineChart points={memPoints} formatValue={v => `${Math.round(v)} MB`} formatTime={formatClock}
            ariaLabel="Container memory over the last 24 hours" emptyText={collecting} />
        </ChartPanel>
      </div>

      {data.plans?.length > 0 && (
        <PlansPanel plans={data.plans} byPlan={data.accounts.byPlan} billingEnabled={data.billingEnabled} onChanged={onPlanChanged} />
      )}

      {showExamples && <ExamplesPanel />}

      <section style={styles.panel}>
        <h2 style={styles.h2}>Accounts</h2>
        <p style={styles.sub}>Sorted by storage used · processing counts video conversion and PowerPoint import over the last 30 days</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                <th style={styles.th}>Account</th>
                <th style={styles.th}>Plan</th>
                <th style={styles.th}>Joined</th>
                <th style={{ ...styles.th, ...styles.num }}>Presentations</th>
                <th style={styles.th}>Storage</th>
                <th style={{ ...styles.th, ...styles.num }}>Processing</th>
                <th style={{ ...styles.th, ...styles.num }}>Last edit</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map(u => (
                <tr key={u.id}>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 500 }}>{u.name || u.email}</div>
                    {u.name && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</div>}
                  </td>
                  <td style={styles.td}>
                    {data.plans?.length ? <PlanPicker user={u} plans={data.plans} onChanged={onPlanChanged} /> : (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-hover)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{u.plan}</span>
                    )}
                  </td>
                  <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>{formatDay(u.createdAt)}</td>
                  <td style={{ ...styles.td, ...styles.num }}>{u.presentations}</td>
                  <td style={styles.td}><StorageMeter used={u.storageBytes} limit={u.storageLimitBytes} /></td>
                  <td style={{ ...styles.td, ...styles.num }}>
                    {u.jobs ? <>{formatDuration(u.processingMs)}<div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.jobs} {u.jobs === 1 ? 'job' : 'jobs'}</div></> : <span style={styles.muted}>—</span>}
                  </td>
                  <td style={{ ...styles.td, ...styles.num }}>{formatAgo(u.lastActive)}</td>
                </tr>
              ))}
              {!data.users.length && (
                <tr><td colSpan={7} style={{ ...styles.td, color: 'var(--text-muted)' }}>No accounts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.h2}>Processing jobs</h2>
        <p style={styles.sub}>The CPU-heavy work, by type over the last 30 days, and the latest jobs</p>
        {!data.jobs ? (
          <p style={{ ...styles.muted, margin: 0, fontSize: 13 }}>Job tracking starts once migration 012 has run on this database.</p>
        ) : !data.jobs.recent.length ? (
          <p style={{ ...styles.muted, margin: 0, fontSize: 13 }}>No processing jobs yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <SimpleTable columns={['Type', 'Jobs', 'Total time']}
              rows={data.jobs.byKind.map(k => [JOB_LABELS[k.kind] || k.kind, k.jobs, formatDuration(k.durationMs)])} />
            <div style={{ overflowX: 'auto' }}>
              <SimpleTable numbersFrom={3} columns={['When', 'Account', 'Type', 'Duration', 'File size']}
                rows={data.jobs.recent.map(j => [formatAgo(j.createdAt), j.email || '(deleted account)', JOB_LABELS[j.kind] || j.kind, formatDuration(j.durationMs), j.bytes === null ? '—' : formatBytes(j.bytes)])} />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default function AdminPage() {
  const [data, setData] = useState(undefined) // undefined: loading, null: not an admin
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      setData(await api.getAdminOverview())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load() }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  if (data === undefined && !error) {
    return <div style={{ ...styles.page, display: 'grid', placeItems: 'center' }}><p style={styles.muted}>Loading…</p></div>
  }
  if (data === null) {
    return (
      <div style={{ ...styles.page, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>Page not found</p>
          <a href="/dashboard" style={{ color: 'var(--accent)' }}>Go to your dashboard</a>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <a href="/dashboard" className="btn btn-secondary" style={{ textDecoration: 'none', padding: '6px 10px' }}>
              <ArrowLeft size={15} /> Dashboard
            </a>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Admin</h1>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{window.location.host}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            {data && <span>Updated {formatClock(data.generatedAt)}</span>}
            <button className="btn btn-secondary" onClick={load} disabled={refreshing} style={{ padding: '6px 10px' }}>
              <RefreshCw size={14} /> {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        {error && (
          <p style={{ ...styles.panel, margin: 0, color: 'var(--text-primary)' }}>
            Couldn’t load the dashboard: {error}. It retries every minute, or use Refresh.
          </p>
        )}

        {data && <AdminDashboard data={data} refreshing={refreshing} onGuestSessionsEnded={load} onPlanChanged={load} showExamples={data.plans?.length > 0} />}
      </div>
    </div>
  )
}

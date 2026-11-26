// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Admin dashboard (/admin): sign-ups, per-user storage and processing, and
// the server container's CPU and memory. The server answers only for admins.

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { api } from '../utils/api'
import { ColumnChart, LineChart } from '../components/AdminCharts'
import PluginReviewPanel from '../components/PluginReviewPanel'
import AdminTeamsPanel from '../components/AdminTeamsPanel'
import { formatSize, planSummary, priceText } from '../utils/plans'

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
  tabs: { display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'thin' },
  tab: { background: 'none', border: 'none', borderBottom: '2px solid transparent', marginBottom: -1, padding: '8px 12px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
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
  if (to.maxPresentations != null && (from?.maxPresentations == null || to.maxPresentations < from.maxPresentations)) {
    lines.push(`They can edit their ${to.maxPresentations} newest presentation${to.maxPresentations === 1 ? '' : 's'}; older ones become read-only.`)
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
      await api.setUserPlan(user.id, plan)
      setMessage(`Moved to ${to.name}.`)
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
  id: '', name: '', storageBytes: GB, maxPresentations: null, maxFileBytes: null,
  stripePriceId: null, priceLabel: null, public: false, sortOrder: 10, liveDatasets: 0, minRefresh: 'daily',
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
    maxFileMB: plan.maxFileBytes == null ? '' : String(Math.round(plan.maxFileBytes / MB * 10) / 10),
    stripePriceId: plan.stripePriceId || '',
    priceLabel: plan.priceLabel || '',
    public: !!plan.public,
    sortOrder: String(plan.sortOrder ?? 0),
    liveDatasets: String(plan.liveDatasets ?? 0),
    minRefresh: plan.minRefresh || 'daily',
    perSeat: !!plan.perSeat,
    minSeats: plan.minSeats == null ? '' : String(plan.minSeats),
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
    maxFileBytes: bytes(form.maxFileMB, MB),
    stripePriceId: form.stripePriceId.trim() || null,
    priceLabel: form.priceLabel.trim() || null,
    public: form.public,
    sortOrder: form.sortOrder.trim() === '' ? 0 : Number(form.sortOrder),
    liveDatasets: form.liveDatasets.trim() === '' ? 0 : Number(form.liveDatasets),
    minRefresh: form.minRefresh,
    perSeat: !!form.perSeat,
    minSeats: form.perSeat && String(form.minSeats ?? '').trim() !== '' ? Number(form.minSeats) : null,
  }
}

// What saving `next` over `old` does to the `accounts` already on it, for the confirm
export function planEditEffects(old, next, accounts) {
  const effects = []
  if (accounts && next.storageBytes < old.storageBytes) {
    effects.push(`Accounts on it storing more than ${formatSize(next.storageBytes)} can’t upload until they free space.`)
  }
  if (accounts && next.maxPresentations != null && (old.maxPresentations == null || next.maxPresentations < old.maxPresentations)) {
    effects.push(`Accounts on it with more than ${next.maxPresentations} presentations can edit only their ${next.maxPresentations} newest; older ones become read-only.`)
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
      await api.savePlan(next, isNew)
      await onDone?.('Saved.')
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
        <Field label="Editable presentations" hint="their newest; older ones read-only. Blank: unlimited">
          <input style={fieldInput} type="number" min="1" step="1" value={form.maxPresentations} onChange={set('maxPresentations')} />
        </Field>
        <Field label="Largest file (MB)" hint="blank: 500">
          <input style={fieldInput} type="number" min="1" max="500" step="any" value={form.maxFileMB} onChange={set('maxFileMB')} />
        </Field>
        <Field label="Live datasets" hint="fetched from a URL or TAP query">
          <input style={fieldInput} type="number" min="0" step="1" value={form.liveDatasets} onChange={set('liveDatasets')} />
        </Field>
        <Field label="Fastest refresh">
          <select className="select-sm" style={fieldInput} value={form.minRefresh} onChange={set('minRefresh')}>
            <option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
          </select>
        </Field>
        <Field label="Order"><input style={fieldInput} type="number" min="0" step="1" value={form.sortOrder} onChange={set('sortOrder')} /></Field>
        {!builtIn && form.perSeat && (
          <Field label="Fewest seats" hint="blank: 1">
            <input style={fieldInput} type="number" min="1" max="1000" step="1" value={form.minSeats} onChange={set('minSeats')} />
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
      {!builtIn && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={form.perSeat} onChange={set('perSeat')} /> Sold to teams, by the seat
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

// A plan's Stripe prices: each to stop selling at, and one more to add by its
// ID. Where Stripe is set up, the server asks it for the interval and amount.
function PlanPrices({ plan, onChanged }) {
  const [form, setForm] = useState(null) // { priceId, interval, amount }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const act = async fn => {
    setBusy(true)
    setError(null)
    try { await fn(); await onChanged?.() } catch (err) { setError(err.message) }
    setBusy(false)
  }
  const add = e => {
    e.preventDefault()
    const amount = form.amount.trim()
    act(async () => {
      await api.addPlanPrice(plan.id, { priceId: form.priceId.trim(), interval: form.interval, amountCents: amount === '' ? null : Math.round(Number(amount) * 100) })
      setForm(null)
    })
  }
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {plan.prices?.length ? plan.prices.map(p => (
        <div key={p.priceId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', minWidth: 0 }}>
          <span style={{ flexShrink: 0 }}>{p.interval === 'year' ? 'Yearly' : 'Monthly'}: {priceText(p, { perSeat: plan.perSeat })}</span>
          <code style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.priceId}</code>
          <button type="button" className="btn btn-ghost" disabled={busy} aria-label={`Stop selling at ${p.priceId}`} title="Stop selling at this price; subscriptions on it carry on"
            style={{ marginLeft: 'auto', padding: '1px 6px', fontSize: 12, color: 'var(--danger)' }}
            onClick={() => confirm(`Stop selling ${plan.name} at ${p.priceId}? Subscriptions already on it carry on.`) && act(() => api.removePlanPrice(plan.id, p.priceId))}>
            Remove
          </button>
        </div>
      )) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{plan.priceLabel || 'Not for sale'}</div>}
      {form ? (
        <form onSubmit={add} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <input style={{ ...fieldInput, flex: '1 1 160px', width: 'auto', fontFamily: 'monospace' }} required placeholder="price_…" spellCheck={false}
            aria-label="Stripe price ID" value={form.priceId} onChange={e => setForm(f => ({ ...f, priceId: e.target.value }))} />
          <select className="select-sm" aria-label="Billed" value={form.interval} onChange={e => setForm(f => ({ ...f, interval: e.target.value }))}>
            <option value="month">Monthly</option><option value="year">Yearly</option>
          </select>
          <input style={{ ...fieldInput, width: 90 }} type="number" min="0" step="0.01" placeholder={plan.perSeat ? '$ a seat' : '$'} aria-label="Amount in dollars"
            value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ padding: '3px 10px', fontSize: 12 }}>Add</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setForm(null)} style={{ padding: '3px 10px', fontSize: 12 }}>Cancel</button>
          <div style={{ flexBasis: '100%', fontSize: 11, color: 'var(--text-muted)' }}>Where Stripe is set up, how often and how much come from the price itself.</div>
        </form>
      ) : (
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setForm({ priceId: '', interval: 'month', amount: '' })}
          style={{ justifySelf: 'start', padding: '2px 8px', fontSize: 12 }}>Add a price</button>
      )}
      {error && <div role="alert" style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
    </div>
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
          {plan.perSeat && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sold to teams by the seat{plan.minSeats > 1 ? `, at least ${plan.minSeats}` : ''}</div>}
          {builtIn
            ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{plan.priceLabel || '—'}</div>
            : <PlanPrices plan={plan} onChanged={onChanged} />}
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
              ? 'Listed plans with a price can be bought from the dashboard, and plans sold by the seat by people creating a team.'
              : 'Billing is switched off (PARALLAX_BILLING), so prices take effect once it’s on.'}
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
      <EducationDomains />
    </section>
  )
}

// The education price's schools: domains beyond those known by their ending
// (.edu, .edu.au, .ac.uk, .k12.wa.us), and whether the coupon is set up
// (STRIPE_EDUCATION_COUPON, server/services/education.js)
export function EducationDomains() {
  const [data, setData] = useState(null)
  const [domain, setDomain] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const load = () => api.getEducationDomains().then(setData, err => setError(err.message))
  useEffect(() => { load() }, [])
  const add = async e => {
    e.preventDefault()
    setError('')
    try {
      await api.addEducationDomain(domain, note)
      setDomain('')
      setNote('')
      await load()
    } catch (err) { setError(err.message) }
  }
  const drop = async d => {
    if (!confirm(`Stop counting ${d} as a school?`)) return
    try { await api.dropEducationDomain(d); await load() } catch (err) { setError(err.message) }
  }
  const coupon = data?.coupon
  return (
    <div className="edu-domains">
      <h3 style={{ margin: '18px 0 4px', fontSize: 14 }}>Education price</h3>
      <p style={styles.sub}>
        {!coupon
          ? 'No coupon is set (STRIPE_EDUCATION_COUPON), so checkout takes only promotion codes.'
          : coupon.percentOff != null || coupon.amountOffCents != null
            ? `Coupon ${coupon.id}: ${coupon.percentOff != null ? `${coupon.percentOff}%` : `$${(coupon.amountOffCents / 100).toFixed(2)}`} off, for accounts with a verified school email.`
            : `Coupon ${coupon.id} is set, but Stripe doesn’t know it (or billing is off).`}
        {' '}Emails ending in .edu, .edu.xx, .ac.xx or .k12.xx.us count already; add other schools’ domains here.
      </p>
      {error && <p role="alert" style={{ color: '#ef4444', fontSize: 12 }}>{error}</p>}
      <ul className="edu-domain-list">
        {(data?.domains || []).map(d => (
          <li key={d.domain}>
            <span>{d.domain}</span>{d.note && <span className="edu-domain-note"> · {d.note}</span>}
            <button type="button" className="btn-icon" onClick={() => drop(d.domain)} aria-label={`Stop counting ${d.domain}`} title="Stop counting it">×</button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input style={fieldInput} value={domain} onChange={e => setDomain(e.target.value)} placeholder="ethz.ch" aria-label="School domain" required />
        <input style={fieldInput} value={note} onChange={e => setNote(e.target.value)} placeholder="ETH Zürich (optional)" aria-label="Note" />
        <button className="btn btn-secondary" type="submit" style={{ padding: '5px 12px', fontSize: 12 }}>Add</button>
      </form>
    </div>
  )
}

// ---- The landing page's statistics ----

const PERIODS = [7, 30, 90]
const percent = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—')
// The change from the period before, as "+12% on the previous 30 days"
function change(now, before, days) {
  if (!before) return now ? `New since the previous ${days} days` : `None in the previous ${days} days either`
  const p = Math.round(((now - before) / before) * 100)
  return `${p > 0 ? '+' : ''}${p}% on the previous ${days} days`
}
const countryName = code => {
  try { return new Intl.DisplayNames(undefined, { type: 'region' }).of(code) || code } catch { return code }
}
const formatShortDay = day => new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

// One step of the funnel: a bar as long as its share of the visitors
function FunnelStep({ label, count, of, note }) {
  const share = of > 0 && count != null ? Math.min(1, count / of) : 0
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 10px', alignItems: 'baseline' }}>
      <div style={{ fontSize: 13 }}>{label}{note && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> · {note}</span>}</div>
      <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{count == null ? '—' : count.toLocaleString()} <span style={{ color: 'var(--text-muted)' }}>{count == null ? '' : percent(count, of)}</span></div>
      <div style={{ gridColumn: '1 / -1', height: 6, borderRadius: 3, background: 'var(--bg-hover)' }}>
        <div style={{ width: `${share * 100}%`, height: '100%', borderRadius: 3, background: 'var(--accent)' }} />
      </div>
    </div>
  )
}

function TopList({ title, rows, name = x => x }) {
  return (
    <div style={{ minWidth: 0 }}>
      <h3 style={{ ...styles.h2, fontSize: 13, marginBottom: 6 }}>{title}</h3>
      {rows.length ? <SimpleTable columns={['', 'Count']} rows={rows.map(r => [name(r.name), r.count.toLocaleString()])} />
        : <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>None yet</p>}
    </div>
  )
}

// The landing page's visitors and what they did there, as Umami counts them,
// with the accounts made in the same days
export function LandingStatsPanel() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(undefined)
  const [error, setError] = useState(null)
  useEffect(() => {
    let current = true
    setError(null)
    api.getLandingStats(days).then(d => { if (current) setData(d) }).catch(err => { if (current) setError(err.message) })
    return () => { current = false }
  }, [days])

  const header = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <h2 style={styles.h2}>Landing page</h2>
        <p style={styles.sub}>Visitors and what they did, counted by Umami without cookies; new accounts from this app.</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {data?.configured && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{data.activeNow} visitor{data.activeNow === 1 ? '' : 's'} now</span>}
        <div role="group" aria-label="Period" style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 6, background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
          {PERIODS.map(d => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}
              style={{ padding: '3px 9px', fontSize: 12, borderRadius: 4, background: days === d ? 'var(--bg-active)' : 'transparent', color: days === d ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {d} days
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  if (error) return <section style={styles.panel}>{header}<p style={{ fontSize: 13, margin: 0 }}>Couldn’t load the statistics: {error}</p></section>
  if (data === undefined) return <section style={styles.panel}>{header}<p style={{ ...styles.muted, fontSize: 13, margin: 0 }}>Loading…</p></section>
  if (!data.configured) {
    return (
      <section style={styles.panel}>{header}
        <p style={{ fontSize: 13, margin: 0 }}>Analytics isn’t set up on this server. It needs UMAMI_URL, UMAMI_WEBSITE_ID, UMAMI_STATS_USER and UMAMI_STATS_PASSWORD.</p>
      </section>
    )
  }

  const { totals, previous, events } = data
  const clicks = (events.try || 0) + (events['sign-in'] || 0)
  const daily = data.daily.map(d => ({ key: d.day, label: formatShortDay(d.day), tooltipLabel: formatShortDay(d.day), value: d.visits }))
  return (
    <section style={styles.panel} aria-labelledby="admin-landing-stats">
      {header}
      <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: 14, margin: '0 -16px 14px' }}>
        <Stat first label="Visitors" value={totals.visitors.toLocaleString()} note={change(totals.visitors, previous.visitors, days)} />
        <Stat label="Visits" value={totals.visits.toLocaleString()} note={`${totals.pageviews.toLocaleString()} page views`} />
        <Stat label="Left without doing anything" value={percent(totals.bounces, totals.visits)} note="Visits with one page view and no clicks counted" />
        <Stat label="Average visit" value={totals.visits ? formatDuration((totals.totalSeconds / totals.visits) * 1000) : '—'} />
      </div>
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ ...styles.h2, fontSize: 13, marginBottom: 6 }}>Visits per day</h3>
          <ColumnChart data={daily} integer ariaLabel={`Visits to the landing page per day, last ${days} days`} />
        </div>
        <div style={{ display: 'grid', gap: 10, alignContent: 'start', minWidth: 0 }}>
          <h3 style={{ ...styles.h2, fontSize: 13 }}>From visit to account</h3>
          <FunnelStep label="Visitors" count={totals.visitors} of={totals.visitors} />
          <FunnelStep label="Clicked Try it or Sign in" count={clicks} of={totals.visitors} note="clicks" />
          <FunnelStep label="Started a guest session" count={events['guest-start'] || 0} of={totals.visitors} />
          <FunnelStep label="Made an account" count={data.accounts?.signups ?? null} of={totals.visitors} note="from anywhere" />
        </div>
      </div>
      <h3 style={{ ...styles.h2, fontSize: 13, margin: '18px 0 6px' }}>Examples</h3>
      {data.examples.length
        ? <SimpleTable columns={['Example', 'Opened', 'Open in the editor', 'Guest sessions']} rows={data.examples.map(e => [e.title, e.opened, e.toEditor, e.guestStarts].map(v => (typeof v === 'number' ? v.toLocaleString() : v)))} />
        : <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No example opened yet</p>}
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', marginTop: 18 }}>
        <TopList title="Came from" rows={data.referrers} />
        <TopList title="Countries" rows={data.countries} name={countryName} />
        <TopList title="Devices" rows={data.devices} name={d => d.charAt(0).toUpperCase() + d.slice(1)} />
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

function AddExample({ kind, fields, onAdded, onCancel }) {
  const [presentations, setPresentations] = useState(null)
  const [presentationId, setPresentationId] = useState('')
  const [form, setForm] = useState({ field: '', title: '', description: '', tags: '', kind })
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Field label="Presentation" hint="its slides are copied as they are now">
          <select className="select-sm" value={presentationId} onChange={choose} required disabled={!presentations}>
            <option value="">{presentations ? 'Choose one of your presentations…' : 'Loading…'}</option>
            {presentations?.map(p => <option key={p.id} value={p.id}>{p.title || 'Untitled'}</option>)}
          </select>
        </Field>
      </div>
      <ExampleFields form={form} set={set} fields={fields} />
      {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={saving || !presentationId} style={{ padding: '5px 12px', fontSize: 13 }}>{saving ? 'Adding…' : form.kind === 'template' ? 'Add template' : 'Add example'}</button>
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
      <a href={`/examples/${e.slug}/deck`} target="_blank" rel="noopener noreferrer" title="Open the live deck" style={{ display: 'block', aspectRatio: '16 / 9', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', background: background(e.background) }}>
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
            {!e.hero && e.kind !== 'template' && <button className="btn btn-secondary" style={smallBtn} disabled={working} onClick={() => onAct(e, () => api.saveExample(e.slug, { hero: true }))}>Put at the top</button>}
            {!e.hero && (e.kind === 'template' || e.ownDeck || !e.builtin) && (
              <button className="btn btn-secondary" style={smallBtn} disabled={working}
                title={e.kind === 'template' ? 'Show it with the examples, to look at' : 'Show it on the Templates tab, for people to copy'}
                onClick={() => onAct(e, () => api.saveExample(e.slug, { kind: e.kind === 'template' ? 'example' : 'template' }), { moved: true })}>
                {e.kind === 'template' ? 'Make an example' : 'Make a template'}
              </button>
            )}
            {e.sourcePresentationId
              ? <button className="btn btn-secondary" style={smallBtn} disabled={working || !e.sourceTitle} onClick={() => onAct(e, () => api.refreshExample(e.slug))} title="Copy the slides again, as the presentation is now">Update from presentation</button>
              : <button className="btn btn-secondary" style={smallBtn} disabled={working} onClick={() => onAct(e, () => api.copyExample(e.slug))} title="Make a presentation of yours from it, to change its slides">Make an editable copy</button>}
            <button className="btn btn-secondary" style={smallBtn} disabled={working} onClick={() => onAct(e, () => api.redrawExampleThumbnail(e.slug))}>Redraw thumbnail</button>
            {!e.builtin && !e.hero && <button className="btn btn-secondary" style={smallBtn} disabled={working}
              onClick={() => confirm(`Delete the ${e.kind === 'template' ? 'template' : 'example'} “${e.title}”? The presentation it came from stays.`) && onAct(e, () => api.deleteExample(e.slug), { removed: true })}>Delete</button>}
          </div>
        </>)}
        {working && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Working…</div>}
      </div>
    </div>
  )
}

const kindOf = e => (e.kind === 'template' ? 'template' : 'example')

const PANEL_WORDS = {
  example: {
    title: 'Landing page examples',
    about: 'The deck at the top of the landing page and the example cards under it, in this order. Each is a copy of one of your presentations: change the presentation, then use Update from presentation to show it. An example’s speaker notes stay private.',
    add: 'Add an example',
    none: 'No examples yet.',
  },
  template: {
    title: 'Templates',
    about: 'The cards on the landing page’s Templates tab, in this order. People copy a template into their account to start from, with its speaker notes, so write them for whoever starts from it. Each is a copy of one of your presentations: change the presentation, then use Update from presentation to show it.',
    add: 'Add a template',
    none: 'No templates yet.',
  },
}

// The landing page's examples (kind "example": the deck at the top and the
// cards under it) or its templates (kind "template", on its Templates tab)
export function ExamplesPanel({ kind = 'example' }) {
  const [all, setAll] = useState(null)
  const [canDraw, setCanDraw] = useState(true)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)
  const words = PANEL_WORDS[kind]
  const list = all && all.filter(e => kindOf(e) === kind)

  const load = useCallback(async () => {
    try {
      const r = await api.getAdminExamples()
      setAll(r.examples)
      setCanDraw(r.thumbnails)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])
  useEffect(() => { load() }, [load])

  // Runs a change to one card; true when it went through
  const act = useCallback(async (e, change, { removed = false, moved = false } = {}) => {
    setBusy(e.slug)
    setNotice(null)
    try {
      const r = await change()
      if (removed) setAll(l => l.filter(x => x.slug !== e.slug))
      else await load()
      const parts = []
      if (moved) parts.push(`Moved “${e.title}” to ${kindOf(e) === 'template' ? 'Examples' : 'Templates'}.`)
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

  // Swaps e with the next card of its kind up or down; the other kind's
  // cards keep their places
  const move = useCallback(async (e, dir) => {
    const at = list.indexOf(e)
    const other = list.at(at + dir)
    const slugs = all.map(x => (x.slug === e.slug ? other.slug : x.slug === other.slug ? e.slug : x.slug))
    setBusy(e.slug)
    try { setAll((await api.orderExamples(slugs)).examples) } catch (err) { setNotice({ slug: e.slug, text: err.message }) } finally { setBusy(null) }
  }, [all, list])

  const fields = [...new Set(['Physics', 'Astronomy', 'Chemistry', 'Mathematics', 'Engineering and CS', ...(all || []).map(e => e.field).filter(Boolean)])]
  const headingId = `admin-${kind}s`

  return (
    <section style={styles.panel} aria-labelledby={headingId}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h2 style={styles.h2} id={headingId}>{words.title}</h2>
          <p style={styles.sub}>
            {words.about}
            {canDraw ? ' The server draws each card’s thumbnail from the first slide.' : ' This server has no Chromium, so it can’t draw thumbnails; new cards show a placeholder.'}
          </p>
        </div>
        {!adding && <button className="btn btn-secondary" onClick={() => setAdding(true)} style={{ padding: '5px 12px', fontSize: 12 }}>{words.add}</button>}
      </div>
      {adding && <AddExample kind={kind} fields={fields} onCancel={() => setAdding(false)} onAdded={async r => {
        setAdding(false)
        await load()
        if (r.thumbnailError) setNotice({ slug: r.example.slug, text: `Added, but the thumbnail wasn’t drawn: ${r.thumbnailError}` })
      }} />}
      {error && <p style={{ fontSize: 13, margin: '8px 0 0' }}>Couldn’t load the {kind}s: {error}</p>}
      {notice && !list?.some(e => e.slug === notice.slug) && <div role="status" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0' }}>{notice.text}</div>}
      {list && !list.length && !adding && <p style={{ ...styles.muted, fontSize: 13, margin: '8px 0 0' }}>{words.none}</p>}
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
// The admin page's tabs, in order, as { id, label }. Those for the cloud
// version's tables (plans, teams, the landing page) need the server to list
// its plans.
export function adminTabs(data) {
  const cloud = data?.plans?.length > 0
  return [
    { id: 'overview', label: 'Overview' },
    { id: 'accounts', label: 'Accounts' },
    cloud && { id: 'teams', label: 'Teams' },
    cloud && { id: 'plans', label: 'Plans' },
    cloud && { id: 'analytics', label: 'Analytics' },
    cloud && { id: 'answers', label: 'Sign-up answers' },
    cloud && { id: 'examples', label: 'Examples' },
    cloud && { id: 'templates', label: 'Templates' },
    { id: 'plugins', label: 'Plugins' },
    { id: 'server', label: 'Server' },
  ].filter(Boolean)
}

// The answers to the optional sign-up questions (server/services/signup-survey.js):
// each question's choices counted, the "something else" answers, and every
// answer as a CSV file
export function SurveyAnswersPanel() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.getSurveySummary().then(setData, err => setError(err.message)) }, [])
  const download = async () => {
    try {
      const url = URL.createObjectURL(await api.getSurveyCsv())
      const a = document.createElement('a')
      a.href = url
      a.download = `parallax-signup-answers-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) { setError(err.message) }
  }
  return (
    <section style={styles.panel} className="survey-answers">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={styles.h2}>Sign-up answers</h2>
          <p style={styles.sub}>
            {data
              ? `${data.answered} account${data.answered === 1 ? '' : 's'} answered · ${data.skipped} skipped. Everyone is asked once on the dashboard; every question is optional.`
              : 'The optional questions accounts are asked once on the dashboard.'}
          </p>
        </div>
        {data?.answered > 0 && <button className="btn btn-secondary" onClick={download} style={{ padding: '5px 12px', fontSize: 12 }}>Download CSV</button>}
      </div>
      {error && <p role="alert" style={{ color: '#ef4444', fontSize: 12 }}>{error}</p>}
      {data && data.answered === 0 && <p style={styles.sub}>No answers yet.</p>}
      {data && data.answered > 0 && (
        <div className="survey-answers-grid">
          {data.questions.map(q => {
            const most = Math.max(1, ...q.counts.map(c => c.n))
            return (
              <div key={q.id} className="survey-answers-question">
                <h3>{q.label}</h3>
                <p className="survey-answers-sub">{q.answered} answered{q.kind === 'many' ? ' · they could pick several' : ''}</p>
                <table>
                  <tbody>
                    {[...q.counts].sort((a, b) => b.n - a.n).map(c => (
                      <tr key={c.id}>
                        <td>{c.label}</td>
                        <td className="survey-answers-bar"><span style={{ width: `${(c.n / most) * 100}%` }} /></td>
                        <td className="survey-answers-n">{c.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
      {data?.others?.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: '18px 0 6px' }}>In their own words</h3>
          <ul className="survey-answers-others">
            {data.others.map((o, i) => <li key={i}><span>{o.question}</span> {o.text}</li>)}
          </ul>
        </>
      )}
    </section>
  )
}

// The tab row; arrow keys, Home and End move between tabs
export function AdminTabs({ tabs, active, onChange }) {
  const move = (e, i) => {
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    const tab = tabs.at(next % tabs.length)
    onChange(tab.id)
    document.getElementById(`admin-tab-${tab.id}`)?.focus()
  }
  return (
    <div role="tablist" aria-label="Admin sections" style={styles.tabs}>
      {tabs.map((t, i) => {
        const on = t.id === active
        return (
          <button key={t.id} id={`admin-tab-${t.id}`} role="tab" type="button" aria-selected={on} aria-controls={`admin-panel-${t.id}`}
            tabIndex={on ? 0 : -1} onClick={() => onChange(t.id)} onKeyDown={e => move(e, i)}
            style={{ ...styles.tab, color: on ? 'var(--text-primary)' : 'var(--text-muted)', borderBottomColor: on ? 'var(--accent)' : 'transparent', fontWeight: on ? 600 : 500 }}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// One tab of the admin page (adminTabs), Overview when `tab` isn't one of them
export function AdminDashboard({ data, tab = 'overview', refreshing = false, onGuestSessionsEnded, onPlanChanged }) {
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

  const shown = adminTabs(data).some(t => t.id === tab) ? tab : 'overview'
  const panels = {
    overview: <>
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
    </>,
    accounts: <>
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
    </>,
    teams: <AdminTeamsPanel />,
    plans: <PlansPanel plans={data.plans} byPlan={data.accounts.byPlan} billingEnabled={data.billingEnabled} onChanged={onPlanChanged} />,
    answers: <SurveyAnswersPanel />,
    analytics: <LandingStatsPanel />,
    examples: <ExamplesPanel kind="example" />,
    templates: <ExamplesPanel kind="template" />,
    plugins: <PluginReviewPanel />,
    server: <>
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
    </>,
  }

  return (
    <div role="tabpanel" id={`admin-panel-${shown}`} aria-labelledby={`admin-tab-${shown}`}
      style={{ display: 'grid', gap: 20, opacity: refreshing ? 0.6 : 1, transition: 'opacity 150ms' }}>
      {panels[shown]}
    </div>
  )
}

// The tab in the address (/admin#teams), so a reload or a link opens it
const tabFromHash = () => window.location.hash.replace(/^#/, '') || 'overview'

export default function AdminPage() {
  const [data, setData] = useState(undefined) // undefined: loading, null: not an admin
  const [tab, setTab] = useState(tabFromHash)
  const pickTab = id => {
    setTab(id)
    window.history.replaceState(null, '', id === 'overview' ? window.location.pathname : `#${id}`)
  }
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

        {data && (() => {
          const tabs = adminTabs(data)
          const active = tabs.some(t => t.id === tab) ? tab : 'overview'
          return <>
            <AdminTabs tabs={tabs} active={active} onChange={pickTab} />
            <AdminDashboard data={data} tab={active} refreshing={refreshing} onGuestSessionsEnded={load} onPlanChanged={load} />
          </>
        })()}
      </div>
    </div>
  )
}

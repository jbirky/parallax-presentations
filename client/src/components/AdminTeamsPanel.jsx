// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useCallback, useEffect, useState } from 'react'
import { api } from '../utils/api'
import * as ui from './adminStyles'

const panel = ui.panel
const th = ui.th
const td = { ...ui.td, verticalAlign: 'middle' }
const control = { fontSize: 13, padding: '5px 8px', width: 'auto' }
const STATUS_LABELS = { active: 'Active', past_due: 'Payment failed', lapsed: 'Lapsed' }

function NewTeam({ plans, onMade, onCancel }) {
  const [form, setForm] = useState({ name: '', ownerEmail: '', seats: 3, plan: plans.includes('team') ? 'team' : plans[0] })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function make(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.createAdminTeam({ ...form, seats: Number(form.seats) })
      onMade()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={make} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '4px 0 12px' }}>
      <input className="form-input" required placeholder="Team name" aria-label="Team name" value={form.name} onChange={e => set('name', e.target.value)} style={{ ...control, flex: '1 1 160px' }} />
      <input className="form-input" required type="email" placeholder="Owner's email" aria-label="Owner's email" value={form.ownerEmail} onChange={e => set('ownerEmail', e.target.value)} style={{ ...control, flex: '1 1 200px' }} />
      <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        Seats <input className="form-input" type="number" min={1} max={1000} value={form.seats} onChange={e => set('seats', e.target.value)} style={{ ...control, width: 70 }} />
      </label>
      <select className="form-select" aria-label="Plan" value={form.plan} onChange={e => set('plan', e.target.value)} style={control}>
        {plans.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <button className="btn btn-primary" type="submit" disabled={busy} style={{ padding: '5px 12px', fontSize: 12 }}>Make team</button>
      <button className="btn btn-ghost" type="button" onClick={onCancel} style={{ padding: '5px 12px', fontSize: 12 }}>Cancel</button>
      {error && <p role="alert" style={{ flexBasis: '100%', margin: 0, fontSize: 12, color: 'var(--danger)' }}>{error}</p>}
    </form>
  )
}

function TeamRow({ team, plans, onChanged, onError }) {
  const [seats, setSeats] = useState(team.seats)
  const [busy, setBusy] = useState(false)

  const save = async change => {
    setBusy(true)
    try {
      await api.updateAdminTeam(team.id, change)
      await onChanged()
    } catch (err) {
      onError(`${team.name}: ${err.message}`)
      setSeats(team.seats)
    }
    setBusy(false)
  }

  return (
    <tr>
      <td style={td}>{team.name}</td>
      <td style={td}>{team.ownerEmail || '—'}</td>
      <td style={td}>
        <form style={{ display: 'flex', gap: 6, alignItems: 'center' }} onSubmit={e => { e.preventDefault(); save({ seats: Number(seats) }) }}>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{team.seatsUsed} of</span>
          <input className="form-input" type="number" min={1} max={1000} value={seats} disabled={busy} aria-label={`Seats in ${team.name}`}
            onChange={e => setSeats(e.target.value)} style={{ ...control, width: 70 }} />
          {Number(seats) !== team.seats && <button className="btn btn-secondary" type="submit" disabled={busy} style={{ padding: '4px 10px', fontSize: 12 }}>Save</button>}
        </form>
      </td>
      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{team.memberCount}</td>
      <td style={td}>
        <select className="form-select" value={team.plan} disabled={busy} aria-label={`Plan of ${team.name}`} onChange={e => save({ plan: e.target.value })} style={control}>
          {[...new Set([team.plan, ...plans])].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </td>
      <td style={td}>
        <select className="form-select" value={team.status} disabled={busy} aria-label={`Status of ${team.name}`} onChange={e => save({ status: e.target.value })} style={control}>
          {Object.entries(STATUS_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        {team.hasSubscription && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Paid through Stripe</div>}
      </td>
      <td style={td}>
        <button className="btn btn-ghost" disabled={busy} style={{ padding: '4px 10px', fontSize: 12, color: 'var(--danger)' }}
          onClick={async () => {
            if (!confirm(`Delete ${team.name}? Its ${team.memberCount} members lose the team; their own presentations aren’t touched.`)) return
            setBusy(true)
            try { await api.deleteAdminTeam(team.id); await onChanged() } catch (err) { onError(`${team.name}: ${err.message}`) }
            setBusy(false)
          }}>
          Delete
        </button>
      </td>
    </tr>
  )
}

// Teams on /admin: make one for an account, change its seats, plan or
// status, or delete it. Until teams can be bought, this is how they start.
export default function AdminTeamsPanel() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await api.getAdminTeams())
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <section style={panel} aria-labelledby="admin-teams">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 id="admin-teams" style={ui.h2}>Teams</h2>
          <p style={ui.sub}>
            Make a team for an account by its email address; its owner then invites people from Teams on their dashboard.
            Owners, admins and members take a seat each; viewers don’t.
          </p>
        </div>
        {!adding && data && <button className="btn btn-secondary" onClick={() => setAdding(true)} style={{ padding: '5px 12px', fontSize: 12 }}>Make a team</button>}
      </div>
      {adding && data && <NewTeam plans={data.plans} onCancel={() => setAdding(false)} onMade={async () => { setAdding(false); await load() }} />}
      {error && <p role="alert" style={{ fontSize: 12, margin: '0 0 8px', color: 'var(--danger)' }}>{error}</p>}
      {data && (data.teams.length ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Team', 'Owner', 'Seats', 'People', 'Plan', 'Status', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.teams.map(team => <TeamRow key={`${team.id}-${team.seats}`} team={team} plans={data.plans} onChanged={load} onError={setError} />)}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ fontSize: 13, margin: 0, color: 'var(--text-muted)' }}>No teams yet.</p>
      ))}
    </section>
  )
}

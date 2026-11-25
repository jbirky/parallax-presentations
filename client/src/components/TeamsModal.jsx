// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useCallback, useEffect, useState } from 'react'
import { X, ArrowLeft, Copy, Link, LogOut, UserMinus, Crown } from 'lucide-react'
import { api } from '../utils/api'

export const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' }
const ROLE_HINTS = {
  admin: 'Invites people and runs the team',
  member: 'Takes a seat',
  viewer: 'Takes no seat',
}
const STATUS_NOTES = {
  past_due: 'The last payment for this team failed. Everything still works while it is retried.',
  lapsed: 'This team’s subscription has ended.',
}

export const teamJoinUrl = token => `${window.location.origin}/teams/join/${token}`

const muted = { fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }
const sectionTitle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: 0.4 }
const small = { padding: '5px 10px', fontSize: 12 }

function expiryLabel(iso) {
  if (!iso) return 'never expires'
  return `expires ${new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

function Avatar({ person }) {
  const name = person.name || person.email || '?'
  return person.avatarUrl
    ? <img src={person.avatarUrl} alt="" width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0 }} />
    : <span aria-hidden style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{name[0].toUpperCase()}</span>
}

// Makes an invite link; shows its address once, since only its hash is kept
function NewInvite({ teamId, onMade }) {
  const [role, setRole] = useState('member')
  const [email, setEmail] = useState('')
  const [days, setDays] = useState('30')
  const [made, setMade] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function make(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { token } = await api.createTeamInvite(teamId, { role, email: email.trim() || null, days: days === 'never' ? null : Number(days) })
      setMade(teamJoinUrl(token))
      setEmail('')
      onMade()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  const copy = () => {
    navigator.clipboard.writeText(made).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <form onSubmit={make} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <select className="form-select" value={role} onChange={e => setRole(e.target.value)} aria-label="Role" style={{ width: 'auto', fontSize: 13, padding: '6px 10px' }}>
          {['member', 'admin', 'viewer'].map(r => <option key={r} value={r}>{ROLE_LABELS[r]}: {ROLE_HINTS[r]}</option>)}
        </select>
        <select className="form-select" value={days} onChange={e => setDays(e.target.value)} aria-label="Lasts" style={{ width: 'auto', fontSize: 13, padding: '6px 10px' }}>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="never">No expiry</option>
        </select>
        <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Only for this email (optional)"
          aria-label="Only for this email address" style={{ flex: '1 1 180px', fontSize: 13, padding: '6px 10px' }} />
        <button className="btn btn-primary" type="submit" disabled={busy} style={small}><Link size={13} /> Make link</button>
      </form>
      {made && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly className="form-input" value={made} onFocus={e => e.target.select()} aria-label="New invite link" style={{ fontSize: 13, padding: '6px 10px' }} />
            <button className="btn btn-secondary" onClick={copy} style={{ ...small, flexShrink: 0 }}><Copy size={13} /> {copied ? 'Copied' : 'Copy'}</button>
          </div>
          <p style={muted}>Copy it now: the link isn’t shown again. Send it to the people you’re inviting.</p>
        </div>
      )}
      {error && <p role="alert" style={{ ...muted, color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}

// One team: its members, and for owners and admins, roles, removals and
// invite links
function TeamDetail({ teamId, onBack, onLeft, onRenamed }) {
  const [team, setTeam] = useState(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const t = await api.getTeam(teamId)
      setTeam(t)
      setName(t.name)
    } catch (err) {
      setError(err.message)
    }
  }, [teamId])
  useEffect(() => { load() }, [load])

  const act = async fn => {
    setBusy(true)
    setError('')
    try { await fn() } catch (err) { setError(err.message) }
    setBusy(false)
  }

  if (!team) {
    return error ? <p role="alert" style={{ ...muted, color: 'var(--danger)' }}>{error}</p> : <p style={muted}>Loading…</p>
  }

  const manager = team.role === 'owner' || team.role === 'admin'
  const nameOf = p => p.name || p.email

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {onBack && (
        <button className="btn btn-ghost" onClick={onBack} style={{ ...small, alignSelf: 'flex-start' }}><ArrowLeft size={13} /> All teams</button>
      )}
      {manager ? (
        <form style={{ display: 'flex', gap: 8 }} onSubmit={e => {
          e.preventDefault()
          act(async () => { const r = await api.renameTeam(teamId, name); setTeam(t => ({ ...t, name: r.name })); onRenamed() })
        }}>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} aria-label="Team name" maxLength={60} style={{ fontSize: 15, fontWeight: 600 }} />
          {name.trim() !== team.name && <button className="btn btn-secondary" type="submit" disabled={busy || !name.trim()} style={small}>Rename</button>}
        </form>
      ) : (
        <h3 style={{ margin: 0, fontSize: 16 }}>{team.name}</h3>
      )}
      <p style={muted}>
        {team.seatsUsed} of {team.seats} seats used. You’re {['owner', 'admin'].includes(team.role) ? 'an' : 'a'} {ROLE_LABELS[team.role].toLowerCase()}.
        {' '}Owners, admins and members take a seat each; viewers don’t.
      </p>
      {STATUS_NOTES[team.status] && <p role="status" style={{ ...muted, color: 'var(--text-primary)' }}>{STATUS_NOTES[team.status]}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h4 style={sectionTitle}>Members</h4>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {team.members.map(p => {
            const you = p.id === team.you
            const canChange = manager && p.role !== 'owner' && !you
            return (
              <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <Avatar person={p} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(p)}{you ? ' (you)' : ''}</div>
                  {p.email && p.email !== p.name && <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>}
                </div>
                {canChange ? (
                  <select className="form-select" value={p.role} disabled={busy} aria-label={`Role of ${nameOf(p)}`}
                    style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
                    onChange={e => { const role = e.target.value; act(async () => { await api.setTeamRole(teamId, p.id, role); await load() }) }}>
                    {['admin', 'member', 'viewer'].map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ROLE_LABELS[p.role]}</span>
                )}
                {team.role === 'owner' && p.role === 'admin' && (
                  <button className="btn btn-ghost" disabled={busy} title={`Hand the team to ${nameOf(p)}`} aria-label={`Hand the team to ${nameOf(p)}`} style={{ padding: 4 }}
                    onClick={() => {
                      if (!confirm(`Hand ${team.name} to ${nameOf(p)}? They become its owner, and you become an admin.`)) return
                      act(async () => { await api.transferTeam(teamId, p.id); await load() })
                    }}>
                    <Crown size={14} />
                  </button>
                )}
                {canChange && (
                  <button className="btn btn-ghost" disabled={busy} title={`Remove ${nameOf(p)}`} aria-label={`Remove ${nameOf(p)}`} style={{ padding: 4, color: 'var(--danger)' }}
                    onClick={() => {
                      if (!confirm(`Remove ${nameOf(p)} from ${team.name}?`)) return
                      act(async () => { await api.removeTeamMember(teamId, p.id); await load() })
                    }}>
                    <UserMinus size={14} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {manager && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h4 style={sectionTitle}>Invite links</h4>
          <p style={muted}>Anyone signed in who opens a link joins in its role, until it expires or you revoke it. Limit a link to one email address to keep it for one person.</p>
          <NewInvite teamId={teamId} onMade={load} />
          {team.invites.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {team.invites.map(i => (
                <li key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 12 }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ROLE_LABELS[i.role]} link …{i.hint} · {i.email ? `only ${i.email}` : 'anyone with it'} · {expiryLabel(i.expiresAt)}
                  </span>
                  <button className="btn btn-ghost" disabled={busy} style={{ ...small, color: 'var(--danger)' }}
                    onClick={() => act(async () => { await api.revokeTeamInvite(teamId, i.id); await load() })}>
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {team.role !== 'owner' && (
        <button className="btn btn-danger" disabled={busy} style={{ justifyContent: 'center' }}
          onClick={() => {
            if (!confirm(`Leave ${team.name}? You’ll need a new invite to come back.`)) return
            act(async () => { await api.removeTeamMember(teamId, team.you); onLeft() })
          }}>
          <LogOut size={14} /> Leave team
        </button>
      )}
      {error && <p role="alert" style={{ ...muted, color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}

// The teams the signed-in person is in, from the dashboard. `teams` is what
// api.listTeams returned; onChange is called after anything that changes
// that list. Opens straight onto `initialTeamId`, or the only team.
export default function TeamsModal({ teams, initialTeamId = null, onChange, onClose }) {
  const [open, setOpen] = useState(initialTeamId || (teams.length === 1 ? teams[0].id : null))
  const shown = open && teams.some(t => t.id === open) ? open : null

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-labelledby="teams-title" style={{ width: 520, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="teams-title" style={{ margin: 0 }}>Teams</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }} aria-label="Close"><X size={16} /></button>
        </div>
        {shown ? (
          <TeamDetail key={shown} teamId={shown}
            onBack={teams.length > 1 ? () => setOpen(null) : null}
            onRenamed={onChange}
            onLeft={() => { setOpen(null); onChange() }} />
        ) : teams.length ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {teams.map(t => (
              <li key={t.id}>
                <button className="btn btn-secondary" onClick={() => setOpen(t.id)} style={{ width: '100%', justifyContent: 'space-between', padding: '10px 12px' }}>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{ROLE_LABELS[t.role]} · {t.memberCount} {t.memberCount === 1 ? 'person' : 'people'}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={muted}>You’re not in a team. To join one, open an invite link from its owner or an admin.</p>
        )}
      </div>
    </div>
  )
}

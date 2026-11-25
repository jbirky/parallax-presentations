// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import BetaBadge from '../components/BetaBadge'
import { ROLE_LABELS } from '../components/TeamsModal'

const ROLE_NOTES = {
  admin: 'As an admin, you’ll be able to invite people and change their roles.',
  member: 'You’ll take one of the team’s seats.',
  viewer: 'Viewers don’t take one of the team’s seats.',
}

const withArticle = role => `${['owner', 'admin'].includes(role) ? 'an' : 'a'} ${ROLE_LABELS[role].toLowerCase()}`

// /teams/join/<token>: someone was sent a team's invite link. Says which team
// and in what role and, once they accept, takes them to the dashboard with
// the team open.
export default function TeamJoinPage({ token }) {
  const [invite, setInvite] = useState(null)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    api.getTeamInvite(token).then(setInvite).catch(err => setError(err.message))
  }, [token])

  const toTeam = teamId => { window.location.href = `/dashboard?team=${teamId}` }

  const join = async () => {
    setJoining(true)
    try {
      const joined = await api.acceptTeamInvite(token)
      toTeam(joined.teamId)
    } catch (err) {
      setError(err.message)
      setJoining(false)
    }
  }

  const blocked = invite && !invite.joined && (invite.seatsFull || invite.wrongEmail)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg-primary, #0f0f1a)' }}>
      <div style={{ width: 420, maxWidth: '100%', background: 'var(--bg-card, #1e1e2e)', border: '1px solid var(--border, #2a2a3e)', borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--text-primary, #e0e0e0)' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}><span style={{ color: 'var(--accent, #6366f1)' }}>P</span>arallax<BetaBadge /></div>
        {error ? (
          <>
            <p role="alert" style={{ margin: 0, fontSize: 14 }}>{error}</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #888)' }}>Ask the person who sent it for a new link.</p>
            <a className="btn btn-secondary" href="/dashboard" style={{ justifyContent: 'center', textDecoration: 'none' }}>Go to your presentations</a>
          </>
        ) : !invite ? (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted, #888)' }}>Opening the invitation…</p>
        ) : invite.joined ? (
          <>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.4 }}>
              You’re already in {invite.teamName}, as {withArticle(invite.yourRole)}.
            </h1>
            <button className="btn btn-primary" onClick={() => toTeam(invite.teamId)} style={{ justifyContent: 'center' }}>Open the team</button>
          </>
        ) : (
          <>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.4 }}>
              {invite.invitedBy ? `${invite.invitedBy} invited you` : 'You’re invited'} to join {invite.teamName} as {withArticle(invite.role)}
            </h1>
            {blocked ? (
              <p role="alert" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                {invite.wrongEmail || `Every seat in ${invite.teamName} is taken. Ask its owner to add a seat, then open this link again.`}
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #888)', lineHeight: 1.5 }}>{ROLE_NOTES[invite.role]}</p>
            )}
            {!blocked && (
              <button className="btn btn-primary" onClick={join} disabled={joining} style={{ justifyContent: 'center' }}>
                {joining ? 'Joining…' : 'Join the team'}
              </button>
            )}
            <a className="btn btn-ghost" href="/dashboard" style={{ justifyContent: 'center', textDecoration: 'none' }}>Not now</a>
          </>
        )}
      </div>
    </div>
  )
}

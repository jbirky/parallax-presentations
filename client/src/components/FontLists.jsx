// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The Fonts dialog's lists: the person's own fonts (My Fonts) and, in a
// team's deck, the team's (Team fonts). One of yours can be shared with the
// team, which then keeps it even if you remove yours; the team's owner and
// admins remove any team font, and members those they shared.

import { useState } from 'react'
import { X, Users } from 'lucide-react'
import { api } from '../utils/api'

const ADDERS = ['owner', 'admin', 'member']

function FontRow({ font, onRemove, onShare, busy }) {
  return (
    <div className="font-row">
      <div style={{ flex: 1 }}>
        <div className="font-row-name" style={{ fontFamily: `'${font.familyName}', sans-serif` }}>{font.familyName}</div>
        <div className="font-row-meta">
          {font.source === 'google' ? 'Google Fonts' : 'Uploaded file'}
          {font.creatorName ? ` · shared by ${font.creatorName}` : ''}
        </div>
      </div>
      <span className="font-row-sample" style={{ fontFamily: `'${font.familyName}', sans-serif` }}>Aa</span>
      {onShare && (
        <button className="btn-icon" title={`Share ${font.familyName} with the team`} aria-label={`Share ${font.familyName} with the team`} onClick={onShare} disabled={busy}>
          <Users size={12} />
        </button>
      )}
      {onRemove && (
        <button className="btn-icon" style={{ color: 'var(--danger)' }} title="Remove font" aria-label={`Remove ${font.familyName}`} onClick={onRemove} disabled={busy}>
          <X size={12} />
        </button>
      )}
    </div>
  )
}

// fonts: getFonts' list (a team's with teamId); team: { id, role, you } or
// null; onChange(fonts) with the new list
export default function FontLists({ fonts, team = null, onChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mine = fonts.filter(f => !f.teamId)
  const teams = fonts.filter(f => f.teamId)
  const canAdd = !!team && ADDERS.includes(team.role)
  const canRemove = f => team?.role === 'owner' || team?.role === 'admin' || (team?.role === 'member' && f.createdBy === team.you)
  const inTeam = name => teams.some(f => f.familyName.toLowerCase() === name.toLowerCase())

  const act = async work => {
    setBusy(true)
    setError('')
    try { await work() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const removeMine = f => act(async () => {
    await api.deleteFont(f.id)
    onChange(fonts.filter(x => x.id !== f.id))
  })
  const share = f => act(async () => {
    const added = await api.addTeamFont(team.id, { fontId: f.id })
    onChange([...fonts, added])
  })
  const removeTeams = f => act(async () => {
    await api.deleteTeamFont(f.teamId, f.id)
    onChange(fonts.filter(x => x.id !== f.id))
  })

  return (
    <>
      {error && <p className="theme-lib-error" role="alert">{error}</p>}
      <div className="font-list-heading">My Fonts ({mine.length})</div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {mine.length === 0 ? (
          <div className="font-list-empty">No custom fonts added yet.</div>
        ) : mine.map(f => (
          <FontRow key={f.id} font={f} busy={busy} onRemove={() => removeMine(f)}
            onShare={canAdd && !inTeam(f.familyName) ? () => share(f) : null} />
        ))}
        {team && (
          <>
            <div className="font-list-heading" style={{ marginTop: 14 }}>Team fonts ({teams.length})</div>
            {teams.length === 0 ? (
              <div className="font-list-empty">{canAdd ? 'Share one of your fonts with the team to use it in all the team’s presentations.' : 'The team hasn’t shared any fonts yet.'}</div>
            ) : teams.map(f => (
              <FontRow key={f.id} font={f} busy={busy} onRemove={canRemove(f) ? () => removeTeams(f) : null} />
            ))}
          </>
        )}
      </div>
    </>
  )
}

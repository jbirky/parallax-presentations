// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useEffect, useState } from 'react'
import { api } from '../utils/api'

// /invite/<token>: someone was sent a presentation's invite link. Says whose
// presentation it is and, once they accept, opens it; they're an editor from
// then on. onOpen(id, title) opens the editor.
export default function InvitePage({ token, onOpen }) {
  const [invite, setInvite] = useState(null)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    api.getInvite(token).then(setInvite).catch(err => setError(err.message))
  }, [token])

  const join = async () => {
    setJoining(true)
    try {
      const joined = await api.acceptInvite(token)
      onOpen(joined.id, joined.title)
    } catch (err) {
      setError(err.message)
      setJoining(false)
    }
  }

  const toDashboard = () => { window.location.href = '/dashboard' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg-primary, #0f0f1a)' }}>
      <div style={{ width: 420, maxWidth: '100%', background: 'var(--bg-card, #1e1e2e)', border: '1px solid var(--border, #2a2a3e)', borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--text-primary, #e0e0e0)' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}><span style={{ color: 'var(--accent, #6366f1)' }}>P</span>arallax</div>
        {error ? (
          <>
            <p role="alert" style={{ margin: 0, fontSize: 14 }}>{error}</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #888)' }}>Ask the person who sent it for a new link.</p>
            <button className="btn btn-secondary" onClick={toDashboard} style={{ justifyContent: 'center' }}>Go to your presentations</button>
          </>
        ) : !invite ? (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted, #888)' }}>Opening the invitation…</p>
        ) : (
          <>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.4 }}>
              {invite.joined ? 'You can already edit ' : `${invite.ownerName} invited you to edit `}
              “{invite.title || 'Untitled'}”
            </h1>
            {!invite.joined && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #888)', lineHeight: 1.5 }}>
                You'll be able to change it and upload to it, and it will be listed on your dashboard under Shared with you.
              </p>
            )}
            <button className="btn btn-primary" onClick={join} disabled={joining} style={{ justifyContent: 'center' }}>
              {joining ? 'Opening…' : invite.joined ? 'Open presentation' : 'Accept and open'}
            </button>
            <button className="btn btn-ghost" onClick={toDashboard} style={{ justifyContent: 'center' }}>Not now</button>
          </>
        )}
      </div>
    </div>
  )
}

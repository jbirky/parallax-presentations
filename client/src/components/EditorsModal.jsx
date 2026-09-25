// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState } from 'react'
import { X, Link, Copy, RefreshCw, LogOut, UserMinus } from 'lucide-react'
import { api } from '../utils/api'

const muted = { fontSize: 12, color: '#a0a0b0', margin: 0, lineHeight: 1.5 }
const inputStyle = { flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }

export const inviteUrl = token => `${window.location.origin}/invite/${token}`

// Who edits the presentation. The owner turns the invite link on or off, makes
// a new one, and removes editors; an editor can leave. `access` is what
// api.getCollaborators returned; onChange gets it back after a change.
export default function EditorsModal({ presentationId, access, onChange, onClose, onLeft }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const owner = access.role === 'owner'
  const ownerPerson = access.people.find(p => p.role === 'owner')
  const nameOf = p => p.name || p.email

  const act = async (fn) => {
    setBusy(true)
    setError('')
    try { await fn() } catch (err) { setError(err.message) }
    setBusy(false)
  }
  const refresh = async () => onChange(await api.getCollaborators(presentationId))
  const copy = () => {
    navigator.clipboard.writeText(inviteUrl(access.inviteToken)).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-labelledby="editors-title" style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 440, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="editors-title" style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>Editors</h3>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }} aria-label="Close"><X size={16} /></button>
        </div>

        {owner ? (
          <>
            <p style={muted}>
              Anyone who opens the invite link while signed in can change this presentation.
              Their uploads count against your storage. Deleting it, share links, presenting live, and GitHub stay with you.
            </p>
            {access.inviteToken ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input readOnly value={inviteUrl(access.inviteToken)} style={inputStyle} onFocus={e => e.target.select()} aria-label="Invite link" />
                  <button className="btn btn-secondary" onClick={copy} style={{ flexShrink: 0 }}>
                    <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" disabled={busy} title="The link you gave out stops working"
                    onClick={() => act(async () => { await api.turnOnInvite(presentationId); await refresh() })}>
                    <RefreshCw size={13} /> New link
                  </button>
                  <button className="btn btn-secondary" disabled={busy}
                    onClick={() => act(async () => { await api.turnOffInvite(presentationId); await refresh() })}>
                    Turn off link
                  </button>
                </div>
                <p style={muted}>Editors who have joined stay until you remove them.</p>
              </div>
            ) : (
              <button className="btn btn-primary" disabled={busy} style={{ justifyContent: 'center' }}
                onClick={() => act(async () => { await api.turnOnInvite(presentationId); await refresh() })}>
                <Link size={14} /> Turn on invite link
              </button>
            )}
          </>
        ) : (
          <p style={muted}>
            {ownerPerson ? `${nameOf(ownerPerson)} owns this presentation. ` : ''}
            You can change it and upload to it; your uploads count against the owner's storage.
            Deleting it, share links, presenting live, and GitHub stay with the owner.
          </p>
        )}

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {access.people.map(p => (
            <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              {p.avatarUrl
                ? <img src={p.avatarUrl} alt="" width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0 }} />
                : <span aria-hidden style={{ width: 28, height: 28, borderRadius: '50%', background: '#3a3a52', color: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{(nameOf(p) || '?')[0].toUpperCase()}</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nameOf(p)}{p.id === access.you ? ' (you)' : ''}
                </div>
                {p.name && <div style={{ fontSize: 11, color: '#a0a0b0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>}
              </div>
              <span style={{ fontSize: 11, color: '#a0a0b0' }}>{p.role === 'owner' ? 'Owner' : 'Editor'}</span>
              {owner && p.role !== 'owner' && (
                <button className="btn btn-ghost" disabled={busy} title={`Remove ${nameOf(p)}`} aria-label={`Remove ${nameOf(p)}`} style={{ padding: 4, color: 'var(--danger)' }}
                  onClick={() => {
                    if (!confirm(`Remove ${nameOf(p)}? They won't be able to open this presentation.`)) return
                    act(async () => { await api.removeCollaborator(presentationId, p.id); await refresh() })
                  }}>
                  <UserMinus size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {owner && access.people.length === 1 && <p style={muted}>No one else edits this presentation yet.</p>}

        {!owner && (
          <button className="btn btn-danger" disabled={busy} style={{ justifyContent: 'center' }}
            onClick={() => {
              if (!confirm('Leave this presentation? You won\'t be able to open it again unless the owner invites you.')) return
              act(async () => { await api.removeCollaborator(presentationId, access.you); onLeft() })
            }}>
            <LogOut size={14} /> Leave presentation
          </button>
        )}
        {error && <p role="alert" style={{ ...muted, color: '#f87171' }}>{error}</p>}
      </div>
    </div>
  )
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// AI collaborator links (cloud only, the owner's): a link to this
// presentation that an AI chat app (Claude, ChatGPT, …) adds as a connector,
// so the AI can read and change the slides (server/mcp). The owner names a
// link, picks how long it lasts, and copies it, once; the list below renews
// and revokes links.

import { useEffect, useState } from 'react'
import { X, Copy, Bot, RefreshCw, Trash2 } from 'lucide-react'
import { api } from '../utils/api'

const muted = { fontSize: 12, color: '#a0a0b0', margin: 0, lineHeight: 1.5 }
const inputStyle = { flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }
const LIFETIMES = [[7, '7 days'], [30, '30 days'], [90, '90 days'], [null, 'Never expires']]

const dateOf = iso => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
function ago(iso) {
  const minutes = Math.round((Date.now() - new Date(iso)) / 60000)
  if (minutes < 2) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`
  return dateOf(iso)
}
export function linkStatus(link) {
  const expiry = link.expired ? 'Expired' : link.expiresAt ? `Expires ${dateOf(link.expiresAt)}` : 'Never expires'
  return `${expiry} · ${link.lastUsedAt ? `used ${ago(link.lastUsedAt)}` : 'not used yet'}`
}

// Where the link goes in each app
export function ConnectSteps({ url }) {
  const step = { margin: '0 0 8px', fontSize: 12, color: '#c8c8d4', lineHeight: 1.5 }
  return (
    <div>
      <p style={step}><strong>Claude</strong> (claude.ai, Desktop): Customize › Connectors › Add › Add custom connector. Paste the link and choose “No sign-in”. Use a personal account: on Team and Enterprise plans connectors are added for everyone.</p>
      <p style={step}><strong>Claude Code</strong>: <code style={{ fontSize: 11, wordBreak: 'break-all' }}>claude mcp add --transport http parallax {url}</code></p>
      <p style={step}><strong>ChatGPT</strong> (web): Plugins › + › Add custom MCP server. Paste the link as the Server URL, choose “No authentication”, and create it as a plugin. In a chat, type @ and pick it. On Business and Enterprise workspaces only admins can add one.</p>
      <p style={{ ...step, marginBottom: 0 }}>Pasted into a chat message instead, it opens a page the AI can read.</p>
    </div>
  )
}

export default function AiLinkModal({ presentationId, onClose }) {
  const [links, setLinks] = useState(null)
  const [name, setName] = useState('Claude')
  const [days, setDays] = useState(30)
  const [made, setMade] = useState(null) // the link just made, with its URL
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => setLinks((await api.getAiLinks(presentationId)).links)
  useEffect(() => { load().catch(err => setError(err.message)) }, [presentationId]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async fn => {
    setBusy(true)
    setError('')
    try { await fn() } catch (err) { setError(err.message) }
    setBusy(false)
  }
  const make = () => act(async () => {
    const link = await api.createAiLink(presentationId, { name, days })
    setMade(link)
    setCopied(false)
    await load()
  })
  const copy = () => {
    navigator.clipboard?.writeText(made.url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}>
      <div role="dialog" aria-labelledby="ai-links-title" style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 480, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="ai-links-title" style={{ margin: 0, fontSize: 16, color: '#e0e0e0', display: 'flex', alignItems: 'center', gap: 8 }}><Bot size={16} /> AI collaborator links</h3>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }} aria-label="Close"><X size={16} /></button>
        </div>
        <p style={muted}>
          Add a link as a connector in Claude, ChatGPT or another AI chat app, and the AI can read and change this presentation.
          Its changes appear here as it makes them, and a version is saved before each session, so you can undo them from History.
          Anyone with a link can use it until you revoke it.
        </p>

        {made ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <p style={{ ...muted, color: '#e0e0e0' }}><strong>{made.name}</strong>: copy the link now. It won&apos;t be shown again.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly value={made.url} style={inputStyle} onFocus={e => e.target.select()} aria-label="AI collaborator link" />
              <button className="btn btn-secondary" onClick={copy} style={{ flexShrink: 0 }}><Copy size={13} /> {copied ? 'Copied' : 'Copy'}</button>
            </div>
            <ConnectSteps url={made.url} />
            <button className="btn btn-ghost" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={() => setMade(null)}>Make another link</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#a0a0b0' }}>
              Name
              <input value={name} maxLength={40} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Claude"
                onKeyDown={e => { if (e.key === 'Enter' && name.trim() && !busy) make() }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#a0a0b0' }}>
              Lasts
              <select className="prop-input" value={days === null ? 'never' : String(days)} onChange={e => setDays(e.target.value === 'never' ? null : Number(e.target.value))}
                style={{ padding: '7px 8px' }}>
                {LIFETIMES.map(([d, label]) => <option key={label} value={d === null ? 'never' : String(d)}>{label}</option>)}
              </select>
            </label>
            <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={make}>Make link</button>
          </div>
        )}

        <div>
          <div style={{ fontSize: 12, color: '#a0a0b0', fontWeight: 600, marginBottom: 6 }}>Links to this presentation</div>
          {links === null ? <p style={muted}>Loading…</p> : !links.length ? <p style={muted}>None yet.</p> : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {links.map(link => (
                <li key={link.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                  <span aria-hidden style={{ width: 28, height: 28, borderRadius: '50%', background: '#3a3a52', color: '#c7d2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bot size={14} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {link.name} <span style={{ color: '#a0a0b0', fontSize: 11 }}>…{link.hint}</span>
                    </div>
                    <div style={{ fontSize: 11, color: link.expired ? '#f59e0b' : '#a0a0b0' }}>{linkStatus(link)}</div>
                  </div>
                  {(link.expired || link.expiresAt) && (
                    <button className="btn btn-ghost" disabled={busy} title="Make it last 30 more days, with the same link" aria-label={`Renew ${link.name}`} style={{ padding: 4 }}
                      onClick={() => act(async () => { await api.renewAiLink(presentationId, link.id, 30); await load() })}>
                      <RefreshCw size={14} />
                    </button>
                  )}
                  <button className="btn btn-ghost" disabled={busy} title="Stop this link working" aria-label={`Revoke ${link.name}`} style={{ padding: 4, color: 'var(--danger)' }}
                    onClick={() => {
                      if (!confirm(`Revoke “${link.name}”? The AI app using it loses access at once.`)) return
                      act(async () => {
                        await api.revokeAiLink(presentationId, link.id)
                        if (made?.id === link.id) setMade(null)
                        await load()
                      })
                    }}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && <p role="alert" style={{ ...muted, color: '#f87171' }}>{error}</p>}
      </div>
    </div>
  )
}

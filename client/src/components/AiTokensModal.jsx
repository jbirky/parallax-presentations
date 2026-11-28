// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// AI access tokens (cloud only): a token for the person's whole account that
// an AI agent, such as Claude Code with the parallax plugin, sends to the
// account-level MCP server at /mcp (server/mcp/account.js), so it can list,
// make and change their presentations as they can. The person names a token,
// picks how long it lasts and whether it may change anything, and copies it,
// once; the list below revokes tokens. AI chat apps such as claude.ai sign
// in to /mcp instead (server/mcp/oauth.js); the apps the person connected
// are listed too, to turn off or allow again. Opened from the dashboard's
// account menu, AI access.

import { useEffect, useState } from 'react'
import { X, Copy, Bot, Trash2, Power } from 'lucide-react'
import { api } from '../utils/api'
import { linkStatus, ago } from './AiLinkModal'

const muted = { fontSize: 12, color: 'var(--text-secondary, #6b6b70)', margin: 0, lineHeight: 1.5 }
const codeStyle = { display: 'block', fontSize: 11, padding: '8px 10px', borderRadius: 6, background: 'rgba(127,127,127,0.12)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: '4px 0 0' }
const LIFETIMES = [[30, '30 days'], [90, '90 days'], [365, '1 year']]
const PROD = 'https://parallax-presentations.com'
export const PLUGIN_REPO = 'jbirky/parallax-agent'

// How to give the token to Claude Code: the parallax plugin asks for it when
// it's installed, and keeps it in the system's credential store (with the
// site, when it isn't the main one); or as a plain MCP server
export function SetupSteps({ secret, server }) {
  const origin = server.replace(/\/mcp$/, '')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <p style={muted}><strong>Claude Code, with the Parallax plugin</strong>: add it, and paste the token when it asks.</p>
        <code style={codeStyle}>{`/plugin marketplace add ${PLUGIN_REPO}\n/plugin install parallax@parallax-agent`}</code>
        {origin !== PROD && <p style={{ ...muted, marginTop: 6 }}>Set its Parallax site option to <code>{origin}</code>.</p>}
        <p style={{ ...muted, marginTop: 6 }}>Already installed? <code>/plugin configure parallax@parallax-agent</code> takes the new token.</p>
      </div>
      <div>
        <p style={muted}><strong>Any MCP client that sends headers</strong>: the server is {server}, with the header <code>Authorization: Bearer &lt;token&gt;</code>. In Claude Code without the plugin:</p>
        <code style={codeStyle}>{`claude mcp add --transport http parallax ${server} --header "Authorization: Bearer ${secret}"`}</code>
      </div>
    </div>
  )
}

export default function AiTokensModal({ onClose }) {
  const [tokens, setTokens] = useState(null)
  const [apps, setApps] = useState([])
  const [signIn, setSignIn] = useState(false)
  const [server, setServer] = useState('')
  const [name, setName] = useState('Claude Code')
  const [days, setDays] = useState(90)
  const [writes, setWrites] = useState(true)
  const [made, setMade] = useState(null) // the token just made, with its secret
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const got = await api.getAiTokens()
    setTokens(got.tokens)
    setApps(got.apps || [])
    setSignIn(!!got.signIn)
    setServer(got.server)
  }
  useEffect(() => { load().catch(err => setError(err.message)) }, [])

  const act = async fn => {
    setBusy(true)
    setError('')
    try { await fn() } catch (err) { setError(err.message) }
    setBusy(false)
  }
  const make = () => act(async () => {
    const token = await api.createAiToken({ name, days, scopes: writes ? ['decks:read', 'decks:write'] : ['decks:read'] })
    setMade(token)
    setCopied(false)
    await load()
  })
  const copy = () => {
    navigator.clipboard?.writeText(made.secret).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}>
      <div className="modal" role="dialog" aria-labelledby="ai-tokens-title" style={{ width: 540, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="ai-tokens-title" style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Bot size={16} /> AI access</h3>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }} aria-label="Close"><X size={16} /></button>
        </div>
        <p style={muted}>
          A token lets an AI agent, such as Claude Code with the Parallax plugin, work in your account as you can: list your presentations,
          make new ones, and change the ones you can edit, live. A version is saved before each session, so you can undo its changes from History.
          Anyone with a token can use it until it expires or you revoke it. To share one presentation with an AI chat app, use its AI collaborator link instead.
        </p>

        {made ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <p style={muted}><strong>{made.name}</strong>: copy the token now. It won&apos;t be shown again.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="prop-input" readOnly value={made.secret} style={{ flex: 1, minWidth: 0 }} onFocus={e => e.target.select()} aria-label="AI access token" />
              <button className="btn btn-secondary" onClick={copy} style={{ flexShrink: 0 }}><Copy size={13} /> {copied ? 'Copied' : 'Copy'}</button>
            </div>
            <SetupSteps secret={made.secret} server={made.server} />
            <button className="btn btn-ghost" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={() => setMade(null)}>Make another token</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                Name
                <input className="prop-input" value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder="Claude Code"
                  onKeyDown={e => { if (e.key === 'Enter' && name.trim() && !busy) make() }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                Lasts
                <select className="prop-input" value={String(days)} onChange={e => setDays(Number(e.target.value))}>
                  {LIFETIMES.map(([d, label]) => <option key={d} value={String(d)}>{label}</option>)}
                </select>
              </label>
              <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={make}>Make token</button>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
              <input type="checkbox" checked={writes} onChange={e => setWrites(e.target.checked)} />
              Can make and change presentations (without it, the AI only reads them)
            </label>
          </div>
        )}

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Your tokens</div>
          {tokens === null ? <p style={muted}>Loading…</p> : !tokens.length ? <p style={muted}>None yet.</p> : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {tokens.map(token => (
                <li key={token.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                  <span aria-hidden style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bot size={14} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {token.name} <span style={{ ...muted, fontSize: 11 }}>…{token.hint}{token.scopes.includes('decks:write') ? '' : ' · reads only'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: token.expired ? '#d97706' : undefined, opacity: token.expired ? 1 : 0.7 }}>{linkStatus(token)}</div>
                  </div>
                  <button className="btn btn-ghost" disabled={busy} title="Stop this token working" aria-label={`Revoke ${token.name}`} style={{ padding: 4, color: 'var(--danger)' }}
                    onClick={() => {
                      if (!confirm(`Revoke “${token.name}”? The agent using it loses access at once.`)) return
                      act(async () => {
                        await api.revokeAiToken(token.id)
                        if (made?.id === token.id) setMade(null)
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
        {(signIn || apps.length > 0) && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Connected apps</div>
            {signIn && server && (
              <p style={{ ...muted, marginBottom: 6 }}>
                AI chat apps such as claude.ai and ChatGPT need no token: add <code>{server}</code> as a custom connector, and sign in to Parallax when it asks.
                Each app you connect can make and change presentations, and shows here.
              </p>
            )}
            {apps.length > 0 && (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {apps.map(app => (
                  <li key={app.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', opacity: app.off ? 0.6 : 1 }}>
                    <span aria-hidden style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bot size={14} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {app.name} {app.host && <span style={{ ...muted, fontSize: 11 }}>{app.host}</span>}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>{app.off ? 'Turned off' : app.lastUsedAt ? `Signed in · used ${ago(app.lastUsedAt)}` : 'Signed in'}</div>
                    </div>
                    {app.off ? (
                      <button className="btn btn-ghost" disabled={busy} style={{ fontSize: 12 }}
                        onClick={() => act(async () => { await api.allowAiApp(app.id); await load() })}>
                        Allow again
                      </button>
                    ) : (
                      <button className="btn btn-ghost" disabled={busy} title="Stop this app working in your account" aria-label={`Turn off ${app.name}`} style={{ padding: 4, color: 'var(--danger)' }}
                        onClick={() => {
                          if (!confirm(`Turn off “${app.name}”? It loses access at once, until you allow it again here.`)) return
                          act(async () => { await api.revokeAiToken(app.id); await load() })
                        }}>
                        <Power size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {server && !made && <p style={muted}>Agents send tokens to {server}.</p>}
        {error && <p role="alert" style={{ ...muted, color: '#dc2626' }}>{error}</p>}
      </div>
    </div>
  )
}

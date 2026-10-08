// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// /admin's community plugins: the versions people imported from GitHub
// repos, or the nightly check found, to approve (listed and installable),
// reject, or revoke (no longer served anywhere, decks included). Each shows
// what a reviewer checks: the commit, the hosts it may reach, its files,
// the changes since the last approved version, and a live preview with its
// default data. Above them: how many wait, and what the last check for new
// version tags found, with a way to run it now.

import { useState, useEffect, useCallback } from 'react'
import { api } from '../utils/api'
import PluginSandbox from '../plugins/PluginSandbox'
import { STATUS_LABELS } from './PluginBrowser'

const panel = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, minWidth: 0 }
const card = { border: '1px solid var(--border)', borderRadius: 8, padding: 12, display: 'grid', gap: 8, minWidth: 0 }
const muted = { margin: 0, fontSize: 12, color: 'var(--text-muted)' }
const chip = { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }
const link = { color: 'var(--accent)' }
const FILTERS = ['pending', 'approved', 'rejected', 'revoked', 'all']
const ACTIONS = { pending: ['approve', 'reject'], rejected: ['approve'], approved: ['revoke'], revoked: [] }
const ACTION_LABELS = { approve: 'Approve', reject: 'Reject', revoke: 'Revoke' }

const formatSize = n => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const formatDay = iso => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '')
const formatWhen = iso => (iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// What the last check for new version tags did
function CheckSummary({ summary, checking, onCheck }) {
  const run = summary?.lastCheck
  return (
    <div style={{ display: 'grid', gap: 6, marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span>
          {summary?.nightly ? 'Listed plugins’ repos are checked for new version tags each night. ' : 'This server doesn’t check for new version tags each night. '}
          {run && !run.error && `Last checked ${formatWhen(run.finishedAt)}: ${plural(run.checked, 'plugin', 'plugins')}, ${plural(run.imported.length, 'new version', 'new versions')} imported${run.refused.length ? `, ${plural(run.refused.length, 'problem', 'problems')}` : ''}.`}
          {run?.error && `The last check, ${formatWhen(run.finishedAt)}, stopped: ${run.error}`}
        </span>
        <button className="btn btn-secondary" onClick={onCheck} disabled={checking} style={{ padding: '3px 10px', fontSize: 12 }}>
          {checking ? 'Checking…' : 'Check now'}
        </button>
      </div>
      {run?.refused?.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {run.refused.map((r, i) => <li key={i}>{r.slug}{r.tag ? ` ${r.tag}` : ''}: {r.error}</li>)}
        </ul>
      )}
    </div>
  )
}

export default function PluginReviewPanel() {
  const [status, setStatus] = useState('pending')
  const [versions, setVersions] = useState(null)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)
  const [checking, setChecking] = useState(false)

  const load = useCallback(() => {
    api.getPluginReviewQueue(status)
      .then(list => { setVersions(list); setError(null) })
      .catch(err => { setVersions([]); setError(err.message) })
    api.getPluginReviewSummary().then(setSummary).catch(() => {})
  }, [status])
  useEffect(() => { setVersions(null); load() }, [load])

  async function checkNow() {
    setChecking(true)
    try {
      const run = await api.checkPluginTags()
      setSummary(s => ({ ...s, lastCheck: run }))
      load()
    } catch (err) {
      setError(err.message)
    }
    setChecking(false)
  }

  return (
    <section style={panel}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          Community plugins
          {summary?.pending > 0 && <span style={{ ...chip, background: 'rgba(99, 102, 241, 0.18)', color: 'var(--text-primary)' }}>{plural(summary.pending, 'version', 'versions')} waiting for review</span>}
        </h2>
        <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Show versions"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>
          {FILTERS.map(f => <option key={f} value={f}>{f === 'all' ? 'All versions' : STATUS_LABELS[f]}</option>)}
        </select>
      </div>
      <p style={{ ...muted, margin: '0 0 8px' }}>Versions imported from GitHub. Approving one lists it; revoking one stops it being served anywhere, decks included.</p>
      <CheckSummary summary={summary} checking={checking || summary?.checking} onCheck={checkNow} />
      {error && <p style={{ ...muted, color: 'var(--text-primary)', marginBottom: 12 }}>{error}</p>}
      {versions === null ? <p style={muted}>Loading…</p> : !versions.length ? (
        <p style={muted}>{status === 'pending' ? 'Nothing is waiting for review.' : 'No versions.'}</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {versions.map(v => <VersionCard key={v.id} version={v} onChanged={load} />)}
        </div>
      )}
    </section>
  )
}

function VersionCard({ version: v, onChanged }) {
  const [note, setNote] = useState(v.reviewNote || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // undefined: closed; null: couldn't be loaded
  const [preview, setPreview] = useState(undefined)
  const repo = `https://github.com/${v.repoOwner}/${v.repoName}`
  const manifest = v.manifest || {}
  const types = manifest.contributes?.elementTypes || []
  const hosts = (manifest.permissions || []).map(p => p.replace(/^network:/, ''))
  const size = types[0]?.defaultSize || { width: 400, height: 300 }

  async function act(action) {
    setBusy(true)
    setError(null)
    try {
      await api.reviewPluginVersion(v.id, action, note)
      onChanged()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  async function togglePreview() {
    if (preview !== undefined) return setPreview(undefined)
    setPreview(await api.getPluginVersionSandbox(v.pluginId, v.version).catch(() => null))
  }

  return (
    <div style={card} data-version={v.id}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>{manifest.name}</strong>
        <span style={{ fontSize: 13 }}>{v.version}</span>
        <span style={chip}>{STATUS_LABELS[v.status] || v.status}</span>
      </div>
      <p style={muted}>
        <a href={`${repo}/tree/${v.commitSha}`} target="_blank" rel="noopener noreferrer" style={link}>{v.repoOwner}/{v.repoName} at {v.tag}</a>
        {' · '}{v.foundByCheck
          ? `found ${formatDay(v.createdAt)} by the nightly check${v.submitterEmail ? `, for ${v.submitterEmail}` : ''}`
          : `imported ${formatDay(v.createdAt)} by ${v.submitterEmail || 'a deleted account'}`}
        {v.approved && <>{' · '}<a href={`${repo}/compare/${encodeURIComponent(v.approved.tag)}...${encodeURIComponent(v.tag)}`} target="_blank" rel="noopener noreferrer" style={link}>Changes since {v.approved.version}</a></>}
      </p>
      <p style={{ margin: 0, fontSize: 13 }}>{manifest.description}</p>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '2px 12px', fontSize: 12 }}>
        <dt style={muted}>Id</dt><dd style={{ margin: 0 }}><code>{v.pluginId}</code></dd>
        <dt style={muted}>License</dt><dd style={{ margin: 0 }}>{manifest.license}</dd>
        <dt style={muted}>Elements</dt><dd style={{ margin: 0 }}>{types.map(t => `${t.label} (${t.type})`).join(', ')}</dd>
        <dt style={muted}>Network</dt><dd style={{ margin: 0 }}>{hosts.length ? hosts.join(', ') : 'None'}</dd>
        <dt style={muted}>Files</dt>
        <dd style={{ margin: 0 }}>
          {(v.files || []).map(f => (
            <div key={f.path}>
              <a href={`${repo}/blob/${v.commitSha}/dist/${f.path.split('/').map(encodeURIComponent).join('/')}`} target="_blank" rel="noopener noreferrer" style={link}>{f.path}</a>
              <span style={muted}> · {formatSize(f.size)}</span>
            </div>
          ))}
        </dd>
      </dl>
      <div>
        <button className="btn btn-secondary" onClick={togglePreview} style={{ padding: '3px 10px', fontSize: 12 }}>
          {preview === undefined ? 'Preview' : 'Hide preview'}
        </button>
      </div>
      {preview === null && <p style={muted}>The preview couldn’t be loaded.</p>}
      {preview && (
        <div style={{ overflow: 'auto', maxWidth: '100%' }}>
          <div style={{ width: size.width, height: size.height, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <PluginSandbox html={preview} pluginData={types[0]?.defaultData || {}} width={size.width} height={size.height} isSelected />
          </div>
        </div>
      )}
      {ACTIONS[v.status]?.length > 0 && (
        <>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="A note for whoever imported it (optional)" aria-label="Review note" maxLength={2000}
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 8px', borderRadius: 6, fontSize: 13, minHeight: 48, resize: 'vertical', width: '100%', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {ACTIONS[v.status].map(action => (
              <button key={action} className={`btn ${action === 'approve' ? 'btn-primary' : 'btn-secondary'}`} disabled={busy} onClick={() => act(action)} style={{ padding: '4px 12px', fontSize: 12 }}>
                {ACTION_LABELS[action]}
              </button>
            ))}
          </div>
        </>
      )}
      {v.status === 'revoked' && v.reviewNote && <p style={muted}>{v.reviewNote}</p>}
      {error && <p style={{ ...muted, color: 'var(--text-primary)' }}>{error}</p>}
    </div>
  )
}

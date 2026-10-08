// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The editor's Plugins dialog (cloud). Browse lists the community plugins an
// admin approved, to install into the Insert menu. Publish imports a tag of
// a public GitHub repo for review, and lists the versions you've imported.
// The server checks an import against the rules in
// server/services/plugin-import.js.

import { useState, useEffect, useMemo } from 'react'
import { X, Search, Star, Check, Github } from 'lucide-react'
import { api } from '../utils/api'

const muted = { fontSize: 12, color: '#a0a0b0', margin: 0, lineHeight: 1.5 }
const inputStyle = { flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }
const chip = { fontSize: 11, padding: '1px 8px', borderRadius: 999, background: '#2a2a3e', color: '#b0b0c0', whiteSpace: 'nowrap' }
const errorBox = { fontSize: 12, color: '#f0a0a0', background: 'rgba(240,80,80,0.08)', border: '1px solid rgba(240,80,80,0.25)', borderRadius: 6, padding: '8px 10px', margin: 0 }

export const STATUS_LABELS = { pending: 'Waiting for review', approved: 'Approved', rejected: 'Not approved', revoked: 'Withdrawn' }
const STATUS_COLORS = { pending: '#e0c070', approved: '#80d0a0', rejected: '#f0a0a0', revoked: '#f0a0a0' }

const repoUrl = p => `https://github.com/${p.repo.owner}/${p.repo.name}`

export default function PluginBrowser({ onClose, onInstalled, onUninstalled, initialTab = 'browse' }) {
  const [tab, setTab] = useState(initialTab)
  const tabButton = (id, label) => (
    <button className={`btn ${tab === id ? 'btn-secondary' : 'btn-ghost'}`} aria-pressed={tab === id} onClick={() => setTab(id)} style={{ padding: '4px 12px', fontSize: 13 }}>
      {label}
    </button>
  )
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-labelledby="plugins-title" style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 600, maxWidth: '90vw', maxHeight: '85vh', boxSizing: 'border-box', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="plugins-title" style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>Plugins</h3>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }} aria-label="Close"><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {tabButton('browse', 'Browse')}
          {tabButton('publish', 'Publish')}
        </div>
        <div style={{ overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'browse' ? <Browse onInstalled={onInstalled} onUninstalled={onUninstalled} /> : <Publish />}
        </div>
      </div>
    </div>
  )
}

function Browse({ onInstalled, onUninstalled }) {
  const [plugins, setPlugins] = useState(null)
  const [installed, setInstalled] = useState(() => new Set())
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.getPluginCatalog(), api.getInstalledPlugins().catch(() => [])])
      .then(([all, mine]) => {
        setPlugins(all.filter(p => p.community))
        setInstalled(new Set(mine.map(p => p.slug)))
      })
      .catch(err => { setPlugins([]); setError(err.message) })
  }, [])

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return (plugins || []).filter(p => {
      const text = [p.name, p.description, p.repo?.owner, ...(p.manifest?.keywords || []), ...(p.manifest?.categories || [])].join(' ').toLowerCase()
      return words.every(w => text.includes(w))
    })
  }, [plugins, query])

  async function toggle(p) {
    setBusy(p.slug)
    setError('')
    try {
      if (installed.has(p.slug)) {
        await api.uninstallPlugin(p.slug)
        setInstalled(s => { const next = new Set(s); next.delete(p.slug); return next })
        onUninstalled?.(p)
      } else {
        await api.installPlugin(p.slug)
        setInstalled(s => new Set(s).add(p.slug))
        onInstalled?.(p)
      }
    } catch (err) {
      setError(err.message)
    }
    setBusy(null)
  }

  if (plugins === null) return <p style={muted}>Loading…</p>
  return (
    <>
      <p style={muted}>
        Plugins made by other people, each from a GitHub repo and reviewed before it’s listed. An installed plugin’s elements are in the Plugins menu.{' '}
        <a href="/plugins" target="_blank" rel="noopener noreferrer" style={{ color: '#a5b4fc' }}>See them live in the gallery</a>
      </p>
      {plugins.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={14} color="#a0a0b0" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search plugins" aria-label="Search plugins" style={inputStyle} />
        </label>
      )}
      {error && <p role="alert" style={errorBox}>{error}</p>}
      {!plugins.length && !error && <p style={muted}>No community plugins are listed yet. Publish one from a GitHub repo.</p>}
      {plugins.length > 0 && !shown.length && <p style={muted}>No plugins match.</p>}
      {shown.map(p => {
        const isInstalled = installed.has(p.slug)
        return (
          <div key={p.slug} data-plugin={p.slug} style={{ border: '1px solid #3a3a4e', borderRadius: 8, padding: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ color: '#e0e0e0', fontSize: 14 }}>{p.name}</strong>
                <span style={{ fontSize: 12, color: '#a0a0b0' }}>{p.version}</span>
              </div>
              <p style={{ ...muted, color: '#c0c0d0' }}>{p.description}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: '#a0a0b0' }}>
                <a href={repoUrl(p)} target="_blank" rel="noopener noreferrer" style={{ color: '#a0a0b0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Github size={12} /> {p.repo.owner}/{p.repo.name}
                </a>
                <span>{p.downloads === 1 ? '1 install' : `${p.downloads || 0} installs`}</span>
                {(p.manifest?.categories || []).map(c => <span key={c} style={chip}>{c}</span>)}
              </div>
            </div>
            <button className={`btn ${isInstalled ? 'btn-ghost' : 'btn-primary'}`} disabled={busy === p.slug} onClick={() => toggle(p)} style={{ flexShrink: 0, fontSize: 12, padding: '4px 12px' }}>
              {isInstalled ? <><Check size={13} /> Installed</> : 'Install'}
            </button>
          </div>
        )
      })}
    </>
  )
}

function Problems({ error }) {
  return (
    <div role="alert" style={errorBox}>
      {error.message}
      {error.problems?.length > 1 && (
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {error.problems.map(p => <li key={p}>{p}</li>)}
        </ul>
      )}
    </div>
  )
}

function Publish() {
  const [url, setUrl] = useState('')
  const [repo, setRepo] = useState(null)
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState(false)
  const [lookupError, setLookupError] = useState(null)
  const [importError, setImportError] = useState(null)
  const [imported, setImported] = useState(null)
  const [mine, setMine] = useState(null)

  const loadMine = () => api.getPluginSubmissions().then(setMine).catch(() => setMine([]))
  useEffect(() => { loadMine() }, [])

  async function lookup(e) {
    e.preventDefault()
    setBusy(true)
    setLookupError(null)
    setImportError(null)
    setImported(null)
    setRepo(null)
    try {
      const found = await api.lookupPluginRepo(url)
      setRepo(found)
      setTag(found.tags.find(t => !t.status)?.name || '')
    } catch (err) {
      setLookupError(err)
    }
    setBusy(false)
  }

  async function importTag() {
    setBusy(true)
    setImportError(null)
    setImported(null)
    try {
      const version = await api.importPluginVersion(url, tag)
      setImported(version)
      setRepo(r => ({ ...r, tags: r.tags.map(t => (t.name === tag ? { ...t, status: version.status } : t)) }))
      setTag('')
      loadMine()
    } catch (err) {
      setImportError(err)
    }
    setBusy(false)
  }

  return (
    <>
      <p style={muted}>
        Publish a plugin from a public GitHub repo. An admin reviews each version before other people can install it.{' '}
        New to plugins? Start from the <a href="https://github.com/jbirky/parallax-plugin-template" target="_blank" rel="noopener noreferrer" style={{ color: '#a5b4fc' }}>plugin template</a>.
      </p>
      <details style={{ fontSize: 12, color: '#a0a0b0' }}>
        <summary style={{ cursor: 'pointer' }}>What the repo needs at the tag</summary>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
          <li><code>parallax-plugin.json</code> at the root, its <code>version</code> the tag’s (tag <code>v1.2.0</code> or <code>1.2.0</code>)</li>
          <li>The built plugin committed in <code>dist/</code>: its <code>sandbox</code> page, one self-contained HTML file, at most 2 MB in all</li>
          <li>An <code>id</code> such as <code>io.github.you.plugin</code>, a <code>license</code>, and element types under <code>contributes.elementTypes</code></li>
          <li>No <code>main</code>: a community plugin runs only in its sandbox</li>
          <li>Each host it loads from or sends to, as <code>network:host</code> in <code>permissions</code>; it can reach no others</li>
        </ul>
      </details>
      <form onSubmit={lookup} style={{ display: 'flex', gap: 8 }}>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/you/your-plugin" aria-label="GitHub repo" style={inputStyle} required />
        <button className="btn btn-secondary" type="submit" disabled={busy || !url.trim()} style={{ flexShrink: 0 }}>Look up</button>
      </form>
      {lookupError && <Problems error={lookupError} />}
      {repo && (
        <div style={{ border: '1px solid #3a3a4e', borderRadius: 8, padding: 12, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <a href={repo.url} target="_blank" rel="noopener noreferrer" style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>{repo.owner}/{repo.repo}</a>
            <span style={{ fontSize: 12, color: '#a0a0b0', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Star size={12} /> {repo.stars}</span>
          </div>
          {repo.description && <p style={muted}>{repo.description}</p>}
          {!repo.tags.length ? (
            <p style={muted}>This repo has no version tags yet. Tag a commit <code>v1.0.0</code> and look it up again.</p>
          ) : (
            <>
              <div role="radiogroup" aria-label="Version" style={{ display: 'grid', gap: 4 }}>
                {repo.tags.map(t => (
                  <label key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.status ? '#808090' : '#e0e0e0' }}>
                    <input type="radio" name="plugin-tag" value={t.name} checked={tag === t.name} disabled={!!t.status} onChange={() => setTag(t.name)} />
                    {t.name}
                    {t.status && <span style={{ ...chip, color: STATUS_COLORS[t.status] }}>{STATUS_LABELS[t.status]}</span>}
                  </label>
                ))}
              </div>
              <div>
                <button className="btn btn-primary" disabled={busy || !tag} onClick={importTag}>{busy ? 'Importing…' : tag ? `Import ${tag}` : 'Import'}</button>
              </div>
              {importError && <Problems error={importError} />}
            </>
          )}
        </div>
      )}
      {imported && <p role="status" style={{ ...muted, color: '#80d0a0' }}>Imported {imported.manifest?.name} {imported.version}. It’s waiting for review.</p>}
      <div style={{ display: 'grid', gap: 6 }}>
        <h4 style={{ margin: '4px 0 0', fontSize: 13, color: '#e0e0e0' }}>Your imports</h4>
        {mine === null ? <p style={muted}>Loading…</p> : !mine.length ? <p style={muted}>None yet.</p> : mine.map(v => (
          <div key={v.id} style={{ display: 'grid', gap: 2, fontSize: 13, color: '#e0e0e0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>{v.manifest?.name || v.pluginId} {v.version}</span>
              <span style={{ ...chip, color: STATUS_COLORS[v.status] }}>{STATUS_LABELS[v.status] || v.status}</span>
            </div>
            {v.reviewNote && <p style={muted}>{v.reviewNote}</p>}
          </div>
        ))}
      </div>
    </>
  )
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, Link, Unlink, ChevronDown, ChevronRight, Database, Table2, X, Check, Search, RefreshCw, Globe, Telescope, Plus } from 'lucide-react'
import { api } from '../utils/api'
import { LiveSourceForm, SourceTab, VersionsTab, TransformsTab, RowsTable, scheduleLabel, relativeTime } from './LiveDatasets'

const TYPE_COLORS = {
  integer: '#60a5fa',
  float: '#34d399',
  string: '#fbbf24',
  boolean: '#f472b6',
  date: '#a78bfa',
  datetime: '#a78bfa',
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SchemaTable({ columns }) {
  if (!columns || !columns.length) return null
  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Column</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Type</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Sample</th>
          </tr>
        </thead>
        <tbody>
          {columns.map(col => (
            <tr key={col.name} style={{ borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.05))' }}>
              <td style={{ padding: '4px 8px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{col.name}</td>
              <td style={{ padding: '4px 8px' }}>
                <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 10, background: `${TYPE_COLORS[col.type] || '#94a3b8'}22`, color: TYPE_COLORS[col.type] || '#94a3b8' }}>
                  {col.type}
                </span>
              </td>
              <td style={{ padding: '4px 8px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(col.sample || []).slice(0, 3).join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// The first rows a deck's slides get: through the deck when the dataset is
// linked to it, so a pinned version shows as the slides see it
function DataPreview({ ds, presentationId, linked, pinnedVersionId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    const read = presentationId && linked
      ? api.getPresentationDatasetData(presentationId, ds.id, { limit: '20' })
      : api.getDatasetData(ds.id, { limit: '20' })
    Promise.resolve(read)
      .then(d => { if (live) { if (d?.error) setError(d.error); else setData(d) } })
      .catch(err => live && setError(err.message))
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [ds.id, ds.updatedAt, presentationId, linked, pinnedVersionId])

  if (loading) return <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>Loading preview...</div>
  if (error) return <div style={{ padding: '8px 12px', borderRadius: 6, fontSize: 12, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>{error}</div>
  if (!data || !data.columns) return <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>No data</div>
  return <RowsTable columns={data.columns} total={data.totalRows} />
}

const tabButton = active => ({
  padding: '4px 10px', fontSize: 11, borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer',
  background: active ? 'var(--accent)' : 'var(--bg-card)', color: active ? '#fff' : 'var(--text-secondary)',
})

export default function DatasetPanel({ presentationId, onClose }) {
  const [datasets, setDatasets] = useState([])
  const [linkedIds, setLinkedIds] = useState(new Set())
  const [pins, setPins] = useState({})
  const [sources, setSources] = useState({ enabled: false })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [adding, setAdding] = useState(null)  // 'url' | 'tap' while the form is open
  const [addMenu, setAddMenu] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [tab, setTab] = useState('columns')
  const [refreshing, setRefreshing] = useState(null)
  const [notes, setNotes] = useState({})  // dataset id -> what its last refresh did
  const [searchQuery, setSearchQuery] = useState('')
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const fileInputRef = useRef(null)

  async function refresh() {
    setLoading(true)
    try {
      const [all, linked] = await Promise.all([
        api.getDatasets(),
        presentationId ? api.getPresentationDatasets(presentationId) : Promise.resolve([]),
      ])
      setDatasets(Array.isArray(all) ? all : [])
      const links = Array.isArray(linked) ? linked : []
      setLinkedIds(new Set(links.map(d => d.id)))
      setPins(Object.fromEntries(links.filter(d => d.pinnedVersionId).map(d => [d.id, d.pinnedVersionId])))
    } catch {
      setDatasets([])
    }
    setLoading(false)
  }

  async function loadSources() {
    try { setSources(await api.getDatasetSources()) } catch { setSources({ enabled: false }) }
  }

  useEffect(() => { refresh(); loadSources() }, [presentationId])

  const replace = ds => setDatasets(list => list.map(d => (d.id === ds.id ? { ...d, ...ds } : d)))

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const ds = await api.uploadDataset(file)
      if (presentationId) {
        await api.linkDataset(presentationId, ds.id)
      }
      await refresh()
    } catch (err) {
      setUploadError(err.message || 'Upload failed')
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleLink(datasetId) {
    if (!presentationId) return
    await api.linkDataset(presentationId, datasetId)
    setLinkedIds(prev => new Set([...prev, datasetId]))
  }

  async function handleUnlink(datasetId) {
    if (!presentationId) return
    await api.unlinkDataset(presentationId, datasetId)
    setLinkedIds(prev => { const s = new Set(prev); s.delete(datasetId); return s })
    setPins(prev => { const p = { ...prev }; delete p[datasetId]; return p })
  }

  async function handleDelete(datasetId) {
    await api.deleteDataset(datasetId)
    setDeleteConfirm(null)
    if (expandedId === datasetId) setExpandedId(null)
    await refresh()
    loadSources()
  }

  async function handleRename(datasetId) {
    if (!renameValue.trim()) return
    await api.renameDataset(datasetId, renameValue.trim())
    setRenaming(null)
    await refresh()
  }

  async function handleRefresh(ds) {
    setRefreshing(ds.id)
    setNotes(n => ({ ...n, [ds.id]: null }))
    try {
      const result = await api.refreshDataset(ds.id)
      replace(result.dataset)
      setNotes(n => ({ ...n, [ds.id]: result.outcome === 'changed' ? 'New data: saved as a new version.' : result.outcome === 'unchanged' ? 'No change since the last fetch.' : null }))
    } catch (err) {
      setNotes(n => ({ ...n, [ds.id]: err.message }))
      await refresh()
    }
    setRefreshing(null)
  }

  function openForm(kind) {
    setAddMenu(false)
    setUploadError(null)
    setAdding(kind)
  }

  const filtered = datasets.filter(d =>
    !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.filename.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const menuItem = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border)', borderRadius: 12, width: 860, maxWidth: 'calc(100vw - 32px)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>Datasets</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: 10 }}>
              {datasets.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!adding && (
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search datasets..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '5px 8px 5px 28px', borderRadius: 6, fontSize: 12, width: 180 }}
                />
              </div>
            )}
            {sources.enabled ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setAddMenu(o => !o)}
                  disabled={uploading}
                  aria-haspopup="menu"
                  aria-expanded={addMenu}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500, opacity: uploading ? 0.6 : 1 }}
                >
                  <Plus size={13} />
                  {uploading ? 'Uploading...' : 'Add'}
                  <ChevronDown size={12} />
                </button>
                {addMenu && (
                  <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 2, background: 'var(--bg-card, #1a1a2e)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, width: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                    <button role="menuitem" style={menuItem} onClick={() => { setAddMenu(false); fileInputRef.current?.click() }}><Upload size={13} /> Upload a file</button>
                    <button role="menuitem" style={menuItem} onClick={() => openForm('url')}><Globe size={13} /> From a URL</button>
                    <button role="menuitem" style={menuItem} onClick={() => openForm('tap')}><Telescope size={13} /> From a TAP query</button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500, opacity: uploading ? 0.6 : 1 }}
              >
                <Upload size={13} />
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            )}
            <input ref={fileInputRef} type="file" accept=".csv,.tsv,.json,.tab" onChange={handleUpload} style={{ display: 'none' }} />
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px' }}>&times;</button>
          </div>
        </div>

        {/* Upload error */}
        {uploadError && (
          <div style={{ margin: '8px 20px 0', padding: '8px 12px', borderRadius: 6, fontSize: 12, background: 'rgba(239,68,68,0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
            <X size={14} />
            {uploadError}
            <button onClick={() => setUploadError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>&times;</button>
          </div>
        )}

        {/* A new live dataset, or the list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: adding ? 0 : '8px 12px' }}>
          {adding ? (
            <LiveSourceForm
              kind={adding}
              sources={sources}
              presentationId={presentationId}
              onCancel={() => setAdding(null)}
              onDone={async ds => { setAdding(null); await refresh(); loadSources(); setExpandedId(ds.id); setTab('data') }}
            />
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Database size={32} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 12 }} />
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {searchQuery ? 'No datasets match your search' : 'No datasets yet'}
              </div>
              {!searchQuery && (
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                  {sources.enabled ? 'Upload a CSV, TSV, or JSON file, or fetch one from a URL or a TAP query' : 'Upload a CSV, TSV, or JSON file to get started'}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map(ds => {
                const isExpanded = expandedId === ds.id
                const isLinked = linkedIds.has(ds.id)
                const isLive = ds.sourceKind && ds.sourceKind !== 'upload'
                const note = notes[ds.id]
                const tabs = [['columns', 'Columns'], ['data', 'Data'], ['steps', `Steps${ds.transforms?.length ? ` (${ds.transforms.length})` : ''}`],
                  ...(isLive ? [['source', 'Source']] : []), ['versions', 'Versions']]

                return (
                  <div key={ds.id} style={{ background: 'var(--bg-hover)', borderRadius: 8, border: `1px solid ${isLinked ? 'var(--accent)' : 'var(--border)'}`, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                    {/* Row header */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer' }}
                      onClick={() => { setExpandedId(isExpanded ? null : ds.id); setTab('columns') }}
                    >
                      {isExpanded ? <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                      {isLive
                        ? (ds.sourceKind === 'tap' ? <Telescope size={14} style={{ color: isLinked ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} /> : <Globe size={14} style={{ color: isLinked ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />)
                        : <Table2 size={14} style={{ color: isLinked ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {renaming === ds.id ? (
                          <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRename(ds.id); if (e.key === 'Escape') setRenaming(null) }}
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: 4, fontSize: 12, flex: 1 }}
                            />
                            <button onClick={() => handleRename(ds.id)} style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer' }}><Check size={14} /></button>
                            <button onClick={() => setRenaming(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <div
                              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              onDoubleClick={e => { e.stopPropagation(); setRenaming(ds.id); setRenameValue(ds.name) }}
                              title="Double-click to rename"
                            >
                              {ds.name}
                            </div>
                            {isLive && (
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(34,197,94,0.12)', color: '#22c55e', whiteSpace: 'nowrap' }}>
                                Live · {scheduleLabel(ds.schedule).toLowerCase()}
                              </span>
                            )}
                            {pins[ds.id] && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', whiteSpace: 'nowrap' }}>Pinned</span>}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {ds.filename} &middot; {ds.rowCount?.toLocaleString()} rows &middot; {(ds.sourceColumns || ds.columns)?.length} cols &middot; {formatBytes(ds.byteSize)}
                          {ds.transforms?.length > 0 && <> &middot; {ds.transforms.length} step{ds.transforms.length === 1 ? '' : 's'}</>}
                          {isLive && ds.lastFetchedAt && <> &middot; fetched {relativeTime(ds.lastFetchedAt)}</>}
                        </div>
                        {isLive && ds.lastError && (
                          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ds.lastError}>
                            Last fetch failed: {ds.lastError}
                          </div>
                        )}
                        {note && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{note}</div>}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        {isLive && (
                          <button
                            onClick={() => handleRefresh(ds)}
                            disabled={refreshing === ds.id}
                            title="Fetch it now"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 10, fontWeight: 500 }}
                          >
                            <RefreshCw size={11} style={refreshing === ds.id ? { animation: 'spin 1s linear infinite' } : undefined} />
                            {refreshing === ds.id ? 'Fetching' : 'Refresh'}
                          </button>
                        )}
                        {presentationId && (
                          <button
                            onClick={() => isLinked ? handleUnlink(ds.id) : handleLink(ds.id)}
                            title={isLinked ? 'Unlink from presentation' : 'Link to presentation'}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: isLinked ? 'var(--accent)' : 'none', color: isLinked ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 10, fontWeight: 500 }}
                          >
                            {isLinked ? <><Unlink size={11} /> Linked</> : <><Link size={11} /> Link</>}
                          </button>
                        )}
                        {deleteConfirm === ds.id ? (
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button onClick={() => handleDelete(ds.id)} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontSize: 10, fontWeight: 500 }}>Delete</button>
                            <button onClick={() => setDeleteConfirm(null)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}>Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(ds.id)}
                            title="Delete dataset"
                            style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px' }}>
                        <div role="tablist" style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
                          {tabs.map(([key, text]) => (
                            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} style={tabButton(tab === key)}>{text}</button>
                          ))}
                        </div>

                        {tab === 'columns' && <SchemaTable columns={ds.columns} />}
                        {tab === 'data' && <DataPreview ds={ds} presentationId={presentationId} linked={isLinked} pinnedVersionId={pins[ds.id]} />}
                        {tab === 'steps' && (
                          <TransformsTab ds={ds} datasets={datasets.map(d => d.name)} onSaved={replace} />
                        )}
                        {tab === 'source' && isLive && <SourceTab ds={ds} sources={sources.enabled ? sources : null} onChanged={replace} />}
                        {tab === 'versions' && (
                          <VersionsTab
                            ds={ds}
                            presentationId={presentationId}
                            linked={isLinked}
                            pinnedVersionId={pins[ds.id]}
                            onPinned={versionId => setPins(p => ({ ...p, [ds.id]: versionId || undefined }))}
                          />
                        )}

                        {/* Usage hint */}
                        {isLinked && (
                          <div style={{ marginTop: 10, padding: '6px 10px', background: 'rgba(99,102,241,0.08)', borderRadius: 6, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            ctx.datasets.query("{ds.name}")
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Linked datasets are available to plugins via ctx.datasets.query()</span>
          <span>{sources.enabled ? 'CSV, TSV, JSON, a URL or a TAP query' : 'Accepts CSV, TSV, JSON'}</span>
        </div>
      </div>
    </div>
  )
}

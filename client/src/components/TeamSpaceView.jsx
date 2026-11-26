// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useCallback, useEffect, useState } from 'react'
import { Plus, Presentation, FolderPlus, Pencil, Trash2, Users } from 'lucide-react'
import { api } from '../utils/api'
import { formatSize } from '../utils/plans'

const ALL = 'all'
const chip = on => ({
  padding: '5px 12px', borderRadius: 999, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
  border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
  background: on ? 'var(--accent)' : 'transparent', color: on ? '#fff' : 'var(--text-secondary)',
})
const small = { padding: '5px 10px', fontSize: 12 }

// Asks for a folder's name in place, for a new folder or a renamed one
function FolderName({ initial = '', label, onSave, onCancel }) {
  const [name, setName] = useState(initial)
  return (
    <form style={{ display: 'flex', gap: 6, alignItems: 'center' }} onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(name.trim()) }}>
      <input className="form-input" autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={60} aria-label={label}
        onKeyDown={e => { if (e.key === 'Escape') onCancel() }} style={{ width: 200, fontSize: 13, padding: '5px 10px' }} />
      <button className="btn btn-primary" type="submit" disabled={!name.trim()} style={small}>Save</button>
      <button className="btn btn-ghost" type="button" onClick={onCancel} style={small}>Cancel</button>
    </form>
  )
}

// A team's presentations on the dashboard, with its folders. `team` is from
// api.listTeams; `folder` is the folder shown ('all', or a folder's id), set
// with onFolder. renderCard(presentation, { reload }) draws a card;
// onNew(folderId) starts a new presentation there; onManage opens the team's
// members. A change to reloadKey loads the team again.
export default function TeamSpaceView({ team, folder, onFolder, renderCard, onNew, onManage, reloadKey = 0 }) {
  const [space, setSpace] = useState(null)
  const [error, setError] = useState('')
  const [naming, setNaming] = useState(null) // 'new' or 'rename'
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setSpace(await api.getTeamSpace(team.id))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [team.id])
  useEffect(() => { setSpace(null); load() }, [load, reloadKey])

  // A folder that's gone (deleted, or another team's) shows everything
  useEffect(() => {
    if (space && folder !== ALL && !space.folders.some(f => f.id === folder)) onFolder(ALL)
  }, [space, folder, onFolder])

  const act = async fn => {
    setBusy(true)
    setError('')
    try { await fn() } catch (err) { setError(err.message) }
    setBusy(false)
  }

  if (!space) {
    return error
      ? <p role="alert" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>
      : <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Loading...</div>
  }

  const { canCreate, role, status } = space.team
  const manager = role === 'owner' || role === 'admin'
  const current = space.folders.find(f => f.id === folder) || null
  const folderName = Object.fromEntries(space.folders.map(f => [f.id, f.name]))
  const shown = space.presentations
    .filter(p => !current || p.folderId === current.id)
    .map(p => ({ ...p, folderName: !current && p.folderId ? folderName[p.folderId] : null }))

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h2 style={{ margin: 0 }}>{space.team.name}</h2>
          {onManage && <button type="button" className="btn btn-ghost" onClick={onManage} style={small}><Users size={13} /> Members</button>}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {formatSize(space.storage.used)}{space.storage.limit ? ` of ${formatSize(space.storage.limit)}` : ''} used
          {role === 'viewer' && ' · You’re a viewer: you can open and present these, but not change them'}
        </span>
      </div>
      {status === 'lapsed' && (
        <p role="status" style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
          This team’s subscription has ended, so its presentations can be opened and presented but not changed.
        </p>
      )}

      <div role="toolbar" aria-label="Folders" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 16 }}>
        <button type="button" style={chip(!current)} aria-pressed={!current} onClick={() => onFolder(ALL)}>All</button>
        {space.folders.map(f => (
          <button key={f.id} type="button" style={chip(current?.id === f.id)} aria-pressed={current?.id === f.id} onClick={() => onFolder(f.id)}>{f.name}</button>
        ))}
        {canCreate && naming !== 'new' && (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setNaming('new')} style={small}>
            <FolderPlus size={14} /> New folder
          </button>
        )}
        {naming === 'new' && (
          <FolderName label="New folder's name" onCancel={() => setNaming(null)} onSave={name => act(async () => {
            const made = await api.createTeamFolder(team.id, name)
            setNaming(null)
            await load()
            onFolder(made.id)
          })} />
        )}
      </div>

      {current && (canCreate || manager) && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '-6px 0 16px' }}>
          {naming === 'rename' ? (
            <FolderName initial={current.name} label="Folder's name" onCancel={() => setNaming(null)} onSave={name => act(async () => {
              await api.renameTeamFolder(team.id, current.id, name)
              setNaming(null)
              await load()
            })} />
          ) : (<>
            {canCreate && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setNaming('rename')} style={small}><Pencil size={13} /> Rename folder</button>}
            {manager && status !== 'lapsed' && (
              <button type="button" className="btn btn-ghost" disabled={busy} style={{ ...small, color: 'var(--danger)' }}
                onClick={() => {
                  if (!confirm(`Delete the folder “${current.name}”? Its presentations stay in the team, outside any folder.`)) return
                  act(async () => { await api.deleteTeamFolder(team.id, current.id); onFolder(ALL); await load() })
                }}>
                <Trash2 size={13} /> Delete folder
              </button>
            )}
          </>)}
        </div>
      )}
      {error && <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}

      <div className="presentations-grid">
        {canCreate && (
          <div className="new-card" onClick={() => onNew(current?.id || null)}>
            <Plus size={32} />
            <span>New Presentation</span>
          </div>
        )}
        {shown.length === 0 ? (
          <div className="empty-state">
            <Presentation size={48} />
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{current ? 'No presentations in this folder' : 'No team presentations yet'}</p>
            {canCreate && <p style={{ fontSize: 14 }}>{current ? 'Make one here, or move one in from its card.' : 'Make one here, or move one of yours in from its card.'}</p>}
          </div>
        ) : shown.map(p => renderCard(p, { reload: load }))}
      </div>
    </div>
  )
}

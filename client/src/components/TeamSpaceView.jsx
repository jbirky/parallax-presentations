// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useCallback, useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { api } from '../utils/api'
import { formatSize } from '../utils/plans'
import DeckBrowser from './DeckBrowser'

const small = { padding: '5px 10px', fontSize: 12 }

// A team's presentations on the dashboard, in its folders (DeckBrowser).
// `team` is from api.listTeams; `folder` is the folder open (null: the top
// level), set with onFolder. renderCard(presentation, { reload }) draws a
// tile and renderActions(presentation, { reload }) its buttons in the list;
// onNew(folderId) starts a new presentation there; onManage opens the team's
// members. A change to reloadKey loads the team again.
export default function TeamSpaceView({ team, folder, onFolder, view = 'tiles', onView, renderCard, renderActions, renderThumb, onOpenDeck, onNew, onManage, reloadKey = 0 }) {
  const [space, setSpace] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setSpace(await api.getTeamSpace(team.id))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [team.id])
  useEffect(() => { setSpace(null); load() }, [load, reloadKey])

  // A folder that's gone (deleted, or another team's) shows the top level
  useEffect(() => {
    if (space && folder && !space.folders.some(f => f.id === folder)) onFolder(null)
  }, [space, folder, onFolder])

  if (!space) {
    return error
      ? <p role="alert" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>
      : <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Loading...</div>
  }

  const { canCreate, role, status } = space.team
  const manager = (role === 'owner' || role === 'admin') && status !== 'lapsed'

  return (
    <div>
      {status === 'lapsed' && (
        <p role="status" style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
          This team’s subscription has ended, so its presentations can be opened and presented but not changed.
        </p>
      )}
      <DeckBrowser
        rootName={space.team.name} folders={space.folders} decks={space.presentations}
        folderId={folder} onOpenFolder={onFolder}
        view={view} onView={onView}
        canEditFolders={canCreate} canDeleteFolders={manager}
        canMoveDeck={p => p.role === 'owner'}
        onCreateFolder={async (name, parentId) => { await api.createTeamFolder(team.id, name, parentId); await load() }}
        onUpdateFolder={async (id, change) => { await api.updateTeamFolder(team.id, id, change); await load() }}
        onDeleteFolder={async id => { await api.deleteTeamFolder(team.id, id); await load() }}
        onMoveDeck={async (id, folderId) => { await api.moveDeck(id, { teamId: team.id, folderId }); await load() }}
        renderTile={p => renderCard(p, { reload: load })}
        renderActions={p => renderActions?.(p, { reload: load })}
        renderThumb={renderThumb}
        onOpenDeck={onOpenDeck}
        onNew={canCreate ? onNew : null}
        ownerColumn={{ label: 'Made by', value: p => p.creatorName || '' }}
        emptyTitle="No team presentations yet"
        emptyText={canCreate ? 'Make one here, or move one of yours in from its card.' : null}
        headerExtra={<>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {formatSize(space.storage.used)}{space.storage.limit ? ` of ${formatSize(space.storage.limit)}` : ''} used
            {role === 'viewer' && ' · You’re a viewer: you can open and present these, but not change them'}
          </span>
          {onManage && <button type="button" className="btn btn-ghost" onClick={onManage} style={small}><Users size={13} /> Members</button>}
        </>}
      />
    </div>
  )
}

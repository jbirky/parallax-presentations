// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { api } from '../utils/api'
import { folderPaths } from '../utils/folders'

const PERSONAL = 'personal'
const muted = { fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }

// The teams someone can put presentations in: not as a viewer, nor in a team
// whose subscription has lapsed
export const teamsToAddTo = teams => teams.filter(t => ['owner', 'admin', 'member'].includes(t.role) && t.status !== 'lapsed')

// Moves a presentation between the person's own folders and their teams'.
// `deck` is { id, title, teamId, folderId, creatorId }; `teams` is
// api.listTeams' list (empty self-hosted); `you` is the person's id.
export default function MoveDeckModal({ deck, teams = [], you, onMoved, onClose }) {
  const places = teamsToAddTo(teams)
  const [teamId, setTeamId] = useState(deck.teamId || PERSONAL)
  const [folders, setFolders] = useState(null)
  const [folderId, setFolderId] = useState(deck.folderId || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setFolders(null)
    const load = teamId === PERSONAL ? api.listFolders() : api.getTeamSpace(teamId)
    load.then(r => setFolders(r?.folders || [])).catch(err => setError(err.message))
  }, [teamId])

  const toPersonal = teamId === PERSONAL
  const fromHere = toPersonal ? !deck.teamId : teamId === deck.teamId
  const unchanged = fromHere && (folderId || null) === (deck.folderId || null)
  const takesOver = toPersonal && deck.teamId && deck.creatorId && deck.creatorId !== you
  const teamName = id => teams.find(t => t.id === id)?.name || 'the team'

  async function move(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.moveDeck(deck.id, { teamId: toPersonal ? null : teamId, folderId: folderId || null })
      onMoved()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <form className="modal" role="dialog" aria-labelledby="move-title" onSubmit={move} style={{ width: 440, maxWidth: '92vw', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="move-title" style={{ margin: 0 }}>Move “{deck.title || 'Untitled'}”</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }} aria-label="Close"><X size={16} /></button>
        </div>
        {(places.length > 0 || deck.teamId) && (
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="move-to">To</label>
            <select id="move-to" className="form-select" value={teamId} onChange={e => { setTeamId(e.target.value); setFolderId('') }}>
              <option value={PERSONAL}>My presentations</option>
              {places.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="move-folder">Folder</label>
          <select id="move-folder" className="form-select" value={folderId} onChange={e => setFolderId(e.target.value)} disabled={!folders}>
            <option value="">{folders ? 'Not in a folder' : 'Loading…'}</option>
            {folders && folderPaths(folders).map(f => <option key={f.id} value={f.id}>{f.path}</option>)}
          </select>
        </div>
        <p style={muted}>
          {fromHere
            ? 'It stays where it is, in the folder you choose.'
            : toPersonal
              ? takesOver
                ? 'It becomes yours: it leaves the team, and its files count against your storage and plan.'
                : 'It leaves the team. Its files count against your storage and plan.'
              : `Everyone in ${teamName(teamId)} will be able to open it, and its files will count against the team’s storage.`}
        </p>
        {error && <p role="alert" style={{ ...muted, color: 'var(--danger)' }}>{error}</p>}
        <div className="modal-footer" style={{ marginTop: 0 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || unchanged}>{busy ? 'Moving…' : 'Move'}</button>
        </div>
      </form>
    </div>
  )
}

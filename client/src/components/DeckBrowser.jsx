// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState } from 'react'
import { Plus, Presentation, Folder, FolderPlus, Pencil, Trash2, LayoutGrid, List, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import { folderTrail, foldersIn, isWithin } from '../utils/folders'

// What's being dragged, in dataTransfer: { kind: 'deck' | 'folder', id }
const DRAG_TYPE = 'application/x-parallax-item'
const small = { padding: '5px 10px', fontSize: 12 }

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}

const dragged = e => {
  try { return JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) } catch { return null }
}
const carriesItem = e => [...(e.dataTransfer?.types || [])].includes(DRAG_TYPE)

// Asks for a folder's name in place
function FolderName({ initial = '', label, onSave, onCancel }) {
  const [name, setName] = useState(initial)
  return (
    <form style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}
      onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(name.trim()) }}>
      <input className="form-input" autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={60} aria-label={label}
        onKeyDown={e => { if (e.key === 'Escape') onCancel() }} style={{ width: 180, fontSize: 13, padding: '5px 10px' }} />
      <button className="btn btn-primary" type="submit" disabled={!name.trim()} style={small}>Save</button>
      <button className="btn btn-ghost" type="button" onClick={onCancel} style={small}>Cancel</button>
    </form>
  )
}

// A file browser for presentations: folders (nested) and presentations, as
// tiles or as a list, with breadcrumbs. Presentations and folders can be
// dragged onto a folder, or a breadcrumb, to move them there.
//
//   rootName        the top level's name, first in the breadcrumbs
//   folders         [{ id, name, parentId }]
//   decks           presentations, each with its folderId (null at the top)
//   folderId        the folder shown (null: the top level); onOpenFolder(id)
//   view            'tiles' or 'list'; onView(view), or no switch without it
//   canEditFolders  make, rename and move folders; canDeleteFolders
//   canMoveDeck     deck => whether it can be dragged into a folder
//   onCreateFolder(name, parentId), onUpdateFolder(id, { name?, parentId? }),
//   onDeleteFolder(id), onMoveDeck(deckId, folderId): may throw, to show why
//   renderTile      deck => its tile; renderActions deck => its list row's buttons
//   renderThumb     deck => a small preview for its list row
//   onOpenDeck      deck => opens it from the list
//   onNew           folderId => a new presentation there; none when they can't add
//   ownerColumn     { label, value(deck) } for a list column of who made each
//   headerExtra     shown at the right of the breadcrumbs
//   flat            no folders at all (a list such as "Shared with you")
export default function DeckBrowser({
  rootName, folders = [], decks, folderId = null, onOpenFolder = () => {},
  view = 'tiles', onView, canEditFolders = false, canDeleteFolders = false, canMoveDeck = () => false,
  onCreateFolder, onUpdateFolder, onDeleteFolder, onMoveDeck,
  renderTile, renderActions, renderThumb, onOpenDeck, onNew, ownerColumn, headerExtra,
  emptyTitle = 'No presentations yet', emptyText, flat = false,
}) {
  const [naming, setNaming] = useState(null) // 'new', or a folder's id being renamed
  const [dropAt, setDropAt] = useState(undefined) // the folder (null: top level) something is held over
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sort, setSort] = useState({ by: 'updated', desc: true })

  const current = flat ? null : folders.find(f => f.id === folderId) || null
  const here = current?.id || null
  const trail = flat ? [] : folderTrail(folders, here)
  const subfolders = flat ? [] : foldersIn(folders, here)
  const shownDecks = (flat ? decks : decks.filter(d => (d.folderId || null) === here)).slice().sort((a, b) => {
    const order = sort.by === 'name'
      ? (a.title || 'Untitled').localeCompare(b.title || 'Untitled', undefined, { sensitivity: 'base' })
      : sort.by === 'slides' ? (a.slideCount || 0) - (b.slideCount || 0)
        : String(a.updatedAt || '').localeCompare(String(b.updatedAt || ''))
    return sort.desc ? -order : order
  })
  const countIn = id => foldersIn(folders, id).length + decks.filter(d => d.folderId === id).length

  const act = async fn => {
    setBusy(true)
    setError('')
    try { await fn() } catch (err) { setError(err.message) }
    setBusy(false)
  }

  // Dragging presentations and folders onto folders
  const dragProps = (kind, id, can) => (can ? {
    draggable: true,
    onDragStart: e => {
      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind, id }))
      e.dataTransfer.effectAllowed = 'move'
    },
  } : {})
  const canTake = (item, target) => {
    if (!item) return false
    if (item.kind === 'deck') {
      const deck = decks.find(d => d.id === item.id)
      return !!deck && canMoveDeck(deck) && (deck.folderId || null) !== target
    }
    const folder = folders.find(f => f.id === item.id)
    return canEditFolders && !!folder && (folder.parentId || null) !== target && !(target && isWithin(folders, target, item.id))
  }
  const dropProps = target => (flat ? {} : {
    onDragOver: e => {
      if (!carriesItem(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (dropAt !== target) setDropAt(target)
    },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropAt(undefined) },
    onDrop: e => {
      e.preventDefault()
      setDropAt(undefined)
      const item = dragged(e)
      if (!canTake(item, target)) return
      act(() => (item.kind === 'deck' ? onMoveDeck(item.id, target) : onUpdateFolder(item.id, { parentId: target })))
    },
  })
  const dropClass = target => (dropAt === target ? ' drop-target' : '')

  const folderButtons = f => (
    <>
      {canEditFolders && (
        <button type="button" className="btn-icon" title="Rename" aria-label={`Rename ${f.name}`} disabled={busy}
          onClick={e => { e.stopPropagation(); setNaming(f.id) }}>
          <Pencil size={13} />
        </button>
      )}
      {canDeleteFolders && (
        <button type="button" className="btn-icon" title="Delete folder" aria-label={`Delete ${f.name}`} disabled={busy} style={{ color: 'var(--danger)' }}
          onClick={e => {
            e.stopPropagation()
            if (!confirm(`Delete the folder “${f.name}”? What’s in it moves up to ${current ? `“${current.name}”` : rootName}.`)) return
            act(() => onDeleteFolder(f.id))
          }}>
          <Trash2 size={13} />
        </button>
      )}
    </>
  )
  const renameField = f => (
    <FolderName initial={f.name} label="Folder's name" onCancel={() => setNaming(null)}
      onSave={name => act(async () => { await onUpdateFolder(f.id, { name }); setNaming(null) })} />
  )

  const sortHeader = (by, label, extra = {}) => (
    <th style={{ textAlign: 'left', ...extra }} aria-sort={sort.by === by ? (sort.desc ? 'descending' : 'ascending') : undefined}>
      <button type="button" className="deck-list-sort" onClick={() => setSort(s => ({ by, desc: s.by === by ? !s.desc : by !== 'name' }))}>
        {label}{sort.by === by && (sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
      </button>
    </th>
  )

  const empty = !subfolders.length && !shownDecks.length

  return (
    <div className="deck-browser">
      <div className="deck-browser-bar">
        <nav aria-label="Folders" className={`deck-crumbs${flat ? ' flat' : ''}`}>
          {flat ? <h2 style={{ margin: 0 }}>{rootName}</h2> : (
            <>
              <button type="button" className={`deck-crumb${!current ? ' current' : ''}${dropClass(null)}`} aria-current={!current ? 'page' : undefined}
                onClick={() => onOpenFolder(null)} {...dropProps(null)}>{rootName}</button>
              {trail.map(f => (
                <span key={f.id} style={{ display: 'contents' }}>
                  <ChevronRight size={14} aria-hidden style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <button type="button" className={`deck-crumb${f.id === here ? ' current' : ''}${dropClass(f.id)}`} aria-current={f.id === here ? 'page' : undefined}
                    onClick={() => onOpenFolder(f.id)} {...dropProps(f.id)}>{f.name}</button>
                </span>
              ))}
            </>
          )}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {headerExtra}
          {!flat && canEditFolders && naming !== 'new' && (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setNaming('new')} style={small}>
              <FolderPlus size={14} /> New folder
            </button>
          )}
          {onView && (
            <div role="group" aria-label="Show as" className="view-switch">
              <button type="button" aria-pressed={view === 'tiles'} title="Tiles" aria-label="Tiles" onClick={() => onView('tiles')}><LayoutGrid size={15} /></button>
              <button type="button" aria-pressed={view === 'list'} title="List" aria-label="List" onClick={() => onView('list')}><List size={15} /></button>
            </div>
          )}
        </div>
      </div>
      {naming === 'new' && (
        <div style={{ marginBottom: 12 }}>
          <FolderName label="New folder's name" onCancel={() => setNaming(null)}
            onSave={name => act(async () => { await onCreateFolder(name, here); setNaming(null) })} />
        </div>
      )}
      {error && <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}

      {view === 'list' ? (
        <div className="deck-list-wrap">
          <table className="deck-list">
            <thead>
              <tr>
                {sortHeader('name', 'Name')}
                {ownerColumn && <th style={{ textAlign: 'left' }}>{ownerColumn.label}</th>}
                {sortHeader('slides', 'Slides', { width: 80 })}
                {sortHeader('updated', 'Modified', { width: 130 })}
                <th style={{ width: 1 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {onNew && (
                <tr className="deck-row deck-row-new" onClick={() => onNew(here)}>
                  <td colSpan={ownerColumn ? 5 : 4}>
                    <span className="deck-row-name"><span className="deck-row-thumb deck-row-icon"><Plus size={15} /></span>New presentation</span>
                  </td>
                </tr>
              )}
              {subfolders.map(f => (
                <tr key={f.id} className={`deck-row${dropClass(f.id)}`} onClick={() => naming !== f.id && onOpenFolder(f.id)}
                  {...dragProps('folder', f.id, canEditFolders)} {...dropProps(f.id)}>
                  <td>
                    {naming === f.id ? renameField(f) : (
                      <span className="deck-row-name"><span className="deck-row-thumb deck-row-icon"><Folder size={15} /></span>{f.name}</span>
                    )}
                  </td>
                  {ownerColumn && <td />}
                  <td className="deck-row-muted">{countIn(f.id)} {countIn(f.id) === 1 ? 'item' : 'items'}</td>
                  <td />
                  <td className="deck-row-actions">{folderButtons(f)}</td>
                </tr>
              ))}
              {shownDecks.map(d => (
                <tr key={d.id} className="deck-row" onClick={() => onOpenDeck(d)} {...dragProps('deck', d.id, canMoveDeck(d))}>
                  <td>
                    <span className="deck-row-name">
                      {renderThumb ? renderThumb(d) : <span className="deck-row-thumb deck-row-icon"><Presentation size={15} /></span>}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title || 'Untitled'}</span>
                    </span>
                  </td>
                  {ownerColumn && <td className="deck-row-muted">{ownerColumn.value(d)}</td>}
                  <td className="deck-row-muted">{d.slideCount}</td>
                  <td className="deck-row-muted">{formatDate(d.updatedAt)}</td>
                  <td className="deck-row-actions" onClick={e => e.stopPropagation()}>{renderActions?.(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {empty && !onNew && <p className="deck-row-muted" style={{ padding: '16px 4px', margin: 0 }}>{emptyTitle}</p>}
        </div>
      ) : (
        <>
          {subfolders.length > 0 && (
            <div className="folders-grid">
              {subfolders.map(f => (
                <div key={f.id} className={`folder-tile${dropClass(f.id)}`} role="button" tabIndex={0} aria-label={`Open ${f.name}`}
                  onClick={() => naming !== f.id && onOpenFolder(f.id)}
                  onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onOpenFolder(f.id) } }}
                  {...dragProps('folder', f.id, canEditFolders)} {...dropProps(f.id)}>
                  {naming === f.id ? renameField(f) : (
                    <>
                      <Folder size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <span className="folder-tile-name">{f.name}</span>
                      <span className="folder-tile-actions">{folderButtons(f)}</span>
                      <span className="folder-tile-count" title={`${countIn(f.id)} ${countIn(f.id) === 1 ? 'item' : 'items'}`}>{countIn(f.id)}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="presentations-grid">
            {onNew && (
              <div className="new-card" onClick={() => onNew(here)}>
                <Plus size={32} />
                <span>New Presentation</span>
              </div>
            )}
            {empty ? (
              <div className="empty-state">
                <Presentation size={48} />
                <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{current ? 'This folder is empty' : emptyTitle}</p>
                {emptyText && <p style={{ fontSize: 14 }}>{emptyText}</p>}
              </div>
            ) : shownDecks.map(d => (
              <div key={d.id} className="deck-tile" {...dragProps('deck', d.id, canMoveDeck(d))}>{renderTile(d)}</div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

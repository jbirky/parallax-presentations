// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Folders for presentations: a person's own ({ userId }, null on a
// self-hosted server) or a team's ({ teamId }; services/team-space.js checks
// who in the team may change them). Folders nest. Deleting one moves what's
// in it up into its parent. The storage keeps them (listFolders and the rest
// in storage/pg-storage.js and storage/file-storage.js); this checks names
// and nesting.

const NAME_MAX = 60
const MAX_FOLDERS = 200 // per person or team

class FolderError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function cleanName(name) {
  const s = String(name ?? '').replace(/\s+/g, ' ').trim()
  if (!s) throw new FolderError(400, 'Give the folder a name')
  if (s.length > NAME_MAX) throw new FolderError(400, `A folder's name can be at most ${NAME_MAX} characters`)
  return s
}

const uniqueName = err => {
  if (err.code === '23505') throw new FolderError(409, 'There\'s already a folder with that name here')
  throw err
}

// Whether folder `target` is folder `id` or inside it
function within(folders, target, id) {
  const parentOf = new Map(folders.map(f => [f.id, f.parentId || null]))
  for (let at = target, steps = 0; at && steps <= folders.length; at = parentOf.get(at), steps++) {
    if (at === id) return true
  }
  return false
}

const listFolders = (storage, place) => storage.listFolders(place)

async function getFolder(storage, place, id) {
  const folder = (await listFolders(storage, place)).find(f => f.id === id)
  if (!folder) throw new FolderError(404, 'No such folder')
  return folder
}

// { name, parentId?, createdBy? }
async function createFolder(storage, place, { name, parentId = null, createdBy = null } = {}) {
  const folderName = cleanName(name)
  const folders = await listFolders(storage, place)
  if (parentId && !folders.some(f => f.id === parentId)) throw new FolderError(404, 'No such folder')
  if (folders.length >= MAX_FOLDERS) throw new FolderError(400, `There can be at most ${MAX_FOLDERS} folders`)
  return storage.createFolder(place, { name: folderName, parentId: parentId || null, createdBy }).catch(uniqueName)
}

// Renames it ({ name }) or moves it into another folder ({ parentId }, null
// for the top level), or both
async function updateFolder(storage, place, id, { name, parentId } = {}) {
  const folders = await listFolders(storage, place)
  const folder = folders.find(f => f.id === id)
  if (!folder) throw new FolderError(404, 'No such folder')
  const change = {}
  if (name !== undefined) change.name = cleanName(name)
  if (parentId !== undefined) {
    const target = parentId || null
    if (target && !folders.some(f => f.id === target)) throw new FolderError(404, 'No such folder')
    if (target && within(folders, target, id)) throw new FolderError(400, 'A folder can\'t go inside itself')
    change.parentId = target
  }
  if (!Object.keys(change).length) return folder
  return storage.updateFolder(place, id, change).catch(uniqueName)
}

async function deleteFolder(storage, place, id) {
  if (!(await storage.deleteFolder(place, id))) throw new FolderError(404, 'No such folder')
}

// Files a presentation in one of the place's folders, or none (null)
async function placeDeck(storage, place, deckId, folderId) {
  if (folderId) await getFolder(storage, place, folderId)
  await storage.setPresentationFolder(deckId, folderId || null)
}

module.exports = { FolderError, listFolders, getFolder, createFolder, updateFolder, deleteFolder, placeDeck, within }

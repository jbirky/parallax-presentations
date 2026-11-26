// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Folders as the server lists them: { id, name, parentId }, flat, nesting
// through parentId (null at the top level).

// The folders from the top level down to `id`, for breadcrumbs; empty at the
// top level
export function folderTrail(folders, id) {
  const byId = new Map(folders.map(f => [f.id, f]))
  const trail = []
  for (let at = byId.get(id), steps = 0; at && steps <= folders.length; at = byId.get(at.parentId), steps++) trail.unshift(at)
  return trail
}

// Every folder with its path ("Talks / 2026"), in path order, for a picker
export function folderPaths(folders) {
  return folders
    .map(f => ({ id: f.id, path: folderTrail(folders, f.id).map(x => x.name).join(' / ') }))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }))
}

// Whether folder `target` is folder `id` or inside it: where `id` can't move
export function isWithin(folders, target, id) {
  return folderTrail(folders, target).some(f => f.id === id)
}

// The folders directly in `parentId` (null: the top level), by name
export function foldersIn(folders, parentId) {
  return folders
    .filter(f => (f.parentId || null) === (parentId || null))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

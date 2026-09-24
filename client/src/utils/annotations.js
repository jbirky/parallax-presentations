// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Present-mode annotations: the ink drawn while presenting, kept apart from
// the slides so the deck itself stays clean. Each present session is a set in
// presentation.annotationSets:
//
//   { id, name, createdAt, updatedAt,
//     slides: { [slideId]: { paths: [{ points, color, strokeWidth, opacity }] } },
//     boards: [{ id, afterId, paths }] }       // whiteboard pages
//
// Paths are the drawing element's, in slide coordinates. The Present window
// (utils/annotationOverlay.js) sends the whole set to the editor after each
// change, and keeps a copy in localStorage in case the editor tab is gone;
// the editor saves sets with the presentation and recovers such copies.

export const ANNOTATION_MESSAGE = 'parallax-annotations'
const BACKUP_PREFIX = 'parallax-annotations:'

export function backupKey(presentationId, setId) {
  return `${BACKUP_PREFIX}${presentationId}:${setId}`
}

export function newAnnotationSet(now = new Date()) {
  const when = now.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return { id: crypto.randomUUID(), name: `Presented ${when}`, createdAt: now.toISOString(), updatedAt: null, slides: {}, boards: [] }
}

// Whether a set has any ink or boards worth keeping
export function hasInk(set) {
  return !!set && (Object.values(set.slides || {}).some(s => s.paths?.length) || (set.boards || []).length > 0)
}

// The presentation with `set` added or replacing the one with its id. The same
// object when nothing changes, so an unchanged set doesn't trigger a save.
export function upsertAnnotationSet(presentation, set) {
  if (!presentation || !set?.id) return presentation
  const sets = presentation.annotationSets || []
  const i = sets.findIndex(s => s.id === set.id)
  if (i === -1 && !hasInk(set)) return presentation
  if (i !== -1 && JSON.stringify(sets[i]) === JSON.stringify(set)) return presentation
  const next = i === -1 ? [...sets, set] : sets.map((s, j) => j === i ? set : s)
  return { ...presentation, annotationSets: next }
}

// The most recently used sets first
export function recentAnnotationSets(presentation, limit = 5) {
  return [...(presentation?.annotationSets || [])]
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
    .slice(0, limit)
}

export function inkedSlideCount(set) {
  return Object.values(set.slides || {}).filter(s => s.paths?.length).length + (set.boards || []).length
}

// Merges the Present window's local copies of this presentation's sets that
// are newer than the saved ones. Returns { presentation, recovered } where
// recovered counts the sets taken from copies; copies already saved (or
// unreadable) are deleted from `storage`.
export function recoverAnnotationBackups(presentation, storage) {
  let recovered = 0
  if (!presentation?.id || !storage) return { presentation, recovered }
  const prefix = `${BACKUP_PREFIX}${presentation.id}:`
  const keys = []
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key?.startsWith(prefix)) keys.push(key)
    }
  } catch { return { presentation, recovered } }
  let result = presentation
  for (const key of keys) {
    let set = null
    try { set = JSON.parse(storage.getItem(key)) } catch {}
    const saved = (result.annotationSets || []).find(s => s.id === set?.id)
    const newer = set?.id && hasInk(set) && (!saved || (set.updatedAt || '') > (saved.updatedAt || ''))
    if (newer) {
      result = upsertAnnotationSet(result, set)
      recovered++
    } else {
      try { storage.removeItem(key) } catch {}
    }
  }
  return { presentation: result, recovered }
}

// For undo history: the presentation without its annotation sets, which undo
// and redo leave as they are
export function withoutAnnotations(presentation) {
  if (!presentation?.annotationSets) return presentation
  const { annotationSets, ...rest } = presentation
  return rest
}

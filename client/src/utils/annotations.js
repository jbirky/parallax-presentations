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
// Paths are in slide coordinates, with points as [x, y] pairs. The Present
// window (utils/annotationOverlay.js) sends the whole set to the editor after
// each change, and keeps a copy in localStorage in case the editor tab is gone;
// the editor saves sets with the presentation and recovers such copies. A
// deleted set stays behind as { id, deletedAt }, so neither an open Present
// window nor a copy on some device can bring it back.

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

export const isDeletedSet = set => !!set?.deletedAt

// The presentation with `set` added or replacing the one with its id. The same
// object when nothing changes, so an unchanged set doesn't trigger a save. The
// editor names sets, so a saved set keeps its name; a deleted one stays deleted.
export function upsertAnnotationSet(presentation, set) {
  if (!presentation || !set?.id) return presentation
  const sets = presentation.annotationSets || []
  const i = sets.findIndex(s => s.id === set.id)
  if (i === -1 && !hasInk(set)) return presentation
  if (i !== -1 && isDeletedSet(sets[i])) return presentation
  if (i !== -1) set = { ...set, name: sets[i].name }
  if (i !== -1 && JSON.stringify(sets[i]) === JSON.stringify(set)) return presentation
  const next = i === -1 ? [...sets, set] : sets.map((s, j) => j === i ? set : s)
  return { ...presentation, annotationSets: next }
}

export function renameAnnotationSet(presentation, id, name) {
  const sets = presentation?.annotationSets || []
  if (!name.trim() || !sets.some(s => s.id === id && !isDeletedSet(s))) return presentation
  return { ...presentation, annotationSets: sets.map(s => s.id === id ? { ...s, name: name.trim() } : s) }
}

export function deleteAnnotationSet(presentation, id, now = new Date()) {
  const sets = presentation?.annotationSets || []
  if (!sets.some(s => s.id === id && !isDeletedSet(s))) return presentation
  return { ...presentation, annotationSets: sets.map(s => s.id === id ? { id, deletedAt: now.toISOString() } : s) }
}

// The most recently used sets first
export function recentAnnotationSets(presentation, limit = 5) {
  return (presentation?.annotationSets || [])
    .filter(s => !isDeletedSet(s))
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
    const newer = set?.id && hasInk(set) && !isDeletedSet(saved) && (!saved || (set.updatedAt || '') > (saved.updatedAt || ''))
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

// The presentation as it looked with `set`'s ink, as an ordinary deck for
// exports and read-only views: each inked slide gets its ink as a drawing
// element on top, and each board becomes a blank slide after the page it was
// added on, placed as the Present window places it. Ink on slides since
// deleted is left out.
export function inkedPresentation(presentation, set) {
  const { annotationSets, ...deck } = presentation
  const W = presentation.slideWidth || 960, H = presentation.slideHeight || 540
  // The drawing element's points are { x, y }, and a lone point needs a second
  // one to be drawn as a dot
  const toPoints = points => {
    const pts = points.map(([x, y]) => ({ x, y }))
    return pts.length === 1 ? [pts[0], { x: pts[0].x + 0.01, y: pts[0].y }] : pts
  }
  const inkElement = (id, paths, zIndex) => ({
    id: `ink-${id}`, type: 'drawing', x: 0, y: 0, width: W, height: H, zIndex,
    paths: paths.filter(p => p.points?.length).map(p => ({
      points: toPoints(p.points), color: p.color, strokeWidth: p.strokeWidth, opacity: p.opacity ?? 1,
    })),
  })
  // Keyed as the presented page keys its sections (generateRevealHTML's data-slide-id)
  const pages = (presentation.slides || []).map((slide, index) => {
    const key = String(slide.id || index)
    const paths = set?.slides?.[key]?.paths
    if (!paths?.length) return { key, slide }
    const top = Math.max(0, ...(slide.elements || []).map(el => el.zIndex || 0))
    // Above the footer and grid, as the Present window's ink layer is
    const ink = inkElement(key, paths, Math.max(2000, top + 1))
    return { key, slide: { ...slide, elements: [...(slide.elements || []), ink] } }
  })
  // A board's page goes right after its anchor, so later boards on the same
  // anchor come first; with no anchor, it goes at the end
  for (const board of set?.boards || []) {
    const i = pages.findIndex(p => p.key === board.afterId)
    const anchor = pages[i]?.slide
    const slide = {
      id: board.id,
      elements: board.paths?.length ? [inkElement(board.id, board.paths, 2000)] : [],
      showPageNumber: false, hideFooter: true,
    }
    // In the anchor's column or section, so it's presented alongside it
    for (const prop of ['column', 'section', 'activeSection']) {
      if (anchor?.[prop] !== undefined) slide[prop] = anchor[prop]
    }
    const page = { key: board.id, slide }
    if (i === -1) pages.push(page)
    else pages.splice(i + 1, 0, page)
  }
  return { ...deck, title: `${presentation.title || 'Untitled'} — ${set?.name || 'Annotated'}`, slides: pages.map(p => p.slide) }
}

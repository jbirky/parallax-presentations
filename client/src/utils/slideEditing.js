// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Small rules the editor follows the way PowerPoint, Keynote and Google
// Slides do: where a new slide goes, which layout it takes, and how far the
// arrow keys move what's selected.

// The layout a new slide takes after `slide` (Ctrl+M, or New slide on a
// slide): the same as that slide's, except that a title or section slide is
// followed by a title and its content, as is a slide whose layout isn't known
export function nextLayoutKey(slide, layouts, fallback = 'title-content') {
  const key = slide?.layout
  if (!key || key === 'title' || key === 'section-header' || !layouts[key]) return fallback
  return key
}

// Where a new slide goes in `slides`: right after the slide at `afterIndex`.
// In a deck of columns, a slide meant for another column (`column`) goes at
// the end of that column instead.
export function newSlideIndex(slides, afterIndex, column = null) {
  const after = slides[afterIndex]
  if (column === null || column === undefined || (after && (after.column ?? 0) === column)) {
    return Math.min(Math.max(afterIndex + 1, 0), slides.length)
  }
  let last = -1
  slides.forEach((s, i) => { if ((s.column ?? 0) === column) last = i })
  return last >= 0 ? last + 1 : slides.length
}

// How far an arrow key moves the selection: 1px, 10px with Shift, or a grid
// step when the grid is on; null for any other key
export function nudgeFor(key, { shift = false, grid = false, gridSize = 40 } = {}) {
  const step = grid ? gridSize : shift ? 10 : 1
  switch (key) {
    case 'ArrowLeft': return { dx: -step, dy: 0 }
    case 'ArrowRight': return { dx: step, dy: 0 }
    case 'ArrowUp': return { dx: 0, dy: -step }
    case 'ArrowDown': return { dx: 0, dy: step }
    default: return null
  }
}

// A key that types a character (so typing on a selected text box starts
// editing it with that character)
export function typesCharacter(e) {
  return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing
}

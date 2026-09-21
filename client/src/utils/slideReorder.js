// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Move a set of slides to sit together at a drop target, keeping their
// relative order. Returns a new array, or null when the move is a no-op.
//
// The drop target is an existing slide index. Dropping past the block puts it
// after the target, dropping before the block puts it in front of the target --
// which is what a single-slide drag already does, so a one-element selection
// behaves exactly as it did before.
export function reorderSlides(slides, indices, toIndex) {
  if (!Array.isArray(slides) || !Array.isArray(indices)) return null
  if (toIndex < 0 || toIndex >= slides.length) return null

  const selected = [...new Set(indices)]
    .filter(i => Number.isInteger(i) && i >= 0 && i < slides.length)
    .sort((a, b) => a - b)
  if (!selected.length) return null

  // Dropping onto a slide that is itself being dragged changes nothing
  if (selected.includes(toIndex)) return null

  const selectedSet = new Set(selected)
  const moving = selected.map(i => slides[i])
  const rest = slides.filter((_, i) => !selectedSet.has(i))

  const targetPos = rest.indexOf(slides[toIndex])
  const insertAt = toIndex > selected[selected.length - 1] ? targetPos + 1 : targetPos

  return [...rest.slice(0, insertAt), ...moving, ...rest.slice(insertAt)]
}

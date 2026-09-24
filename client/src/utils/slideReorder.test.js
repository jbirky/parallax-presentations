import { describe, it, expect } from 'vitest'
import { reorderSlides } from './slideReorder'

// Slides are identified by id so the expected order reads clearly
const deck = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id }))
const ids = arr => arr.map(s => s.id)

describe('reorderSlides — single slide matches the old drag behaviour', () => {
  it('dragging down lands after the target', () => {
    expect(ids(reorderSlides(deck, [0], 3))).toEqual(['b', 'c', 'd', 'a', 'e', 'f'])
  })

  it('dragging up lands before the target', () => {
    expect(ids(reorderSlides(deck, [5], 2))).toEqual(['a', 'b', 'f', 'c', 'd', 'e'])
  })

  it('dragging to an adjacent slide swaps the pair', () => {
    expect(ids(reorderSlides(deck, [0], 1))).toEqual(['b', 'a', 'c', 'd', 'e', 'f'])
  })

  it('moves to the very start', () => {
    expect(ids(reorderSlides(deck, [4], 0))).toEqual(['e', 'a', 'b', 'c', 'd', 'f'])
  })

  it('moves to the very end', () => {
    expect(ids(reorderSlides(deck, [1], 5))).toEqual(['a', 'c', 'd', 'e', 'f', 'b'])
  })
})

describe('reorderSlides — groups move together', () => {
  it('keeps a contiguous block contiguous when dragged down', () => {
    expect(ids(reorderSlides(deck, [0, 1], 4))).toEqual(['c', 'd', 'e', 'a', 'b', 'f'])
  })

  it('keeps a contiguous block contiguous when dragged up', () => {
    expect(ids(reorderSlides(deck, [3, 4], 1))).toEqual(['a', 'd', 'e', 'b', 'c', 'f'])
  })

  it('gathers a non-contiguous selection into one block', () => {
    expect(ids(reorderSlides(deck, [0, 2], 4))).toEqual(['b', 'd', 'e', 'a', 'c', 'f'])
  })

  it('preserves the relative order of the selection, not the click order', () => {
    expect(ids(reorderSlides(deck, [4, 1, 2], 5))).toEqual(['a', 'd', 'f', 'b', 'c', 'e'])
  })

  it('handles a selection that straddles the target', () => {
    expect(ids(reorderSlides(deck, [0, 5], 2))).toEqual(['b', 'a', 'f', 'c', 'd', 'e'])
  })

  it('moves a block to the very start', () => {
    expect(ids(reorderSlides(deck, [3, 5], 0))).toEqual(['d', 'f', 'a', 'b', 'c', 'e'])
  })

  it('moves a block to the very end', () => {
    expect(ids(reorderSlides(deck, [0, 1], 5))).toEqual(['c', 'd', 'e', 'f', 'a', 'b'])
  })

  it('always returns every slide exactly once', () => {
    const out = reorderSlides(deck, [1, 3, 4], 0)
    expect(out).toHaveLength(deck.length)
    expect(new Set(ids(out)).size).toBe(deck.length)
  })
})

describe('reorderSlides — no-ops and bad input', () => {
  it('returns null when dropping onto a dragged slide', () => {
    expect(reorderSlides(deck, [1, 3], 3)).toBeNull()
    expect(reorderSlides(deck, [2], 2)).toBeNull()
  })

  it('returns null for an out-of-range target', () => {
    expect(reorderSlides(deck, [0], -1)).toBeNull()
    expect(reorderSlides(deck, [0], 6)).toBeNull()
  })

  it('returns null for an empty selection', () => {
    expect(reorderSlides(deck, [], 2)).toBeNull()
  })

  it('returns null when nothing in the selection is a valid index', () => {
    expect(reorderSlides(deck, [99, -4], 2)).toBeNull()
  })

  it('ignores out-of-range and duplicate entries in the selection', () => {
    expect(ids(reorderSlides(deck, [0, 0, 99, 1], 4))).toEqual(['c', 'd', 'e', 'a', 'b', 'f'])
  })

  it('returns null for non-array input', () => {
    expect(reorderSlides(null, [0], 1)).toBeNull()
    expect(reorderSlides(deck, null, 1)).toBeNull()
  })

  it('does not mutate the input', () => {
    const before = ids(deck)
    reorderSlides(deck, [0, 2], 5)
    expect(ids(deck)).toEqual(before)
  })
})

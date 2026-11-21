import { describe, it, expect } from 'vitest'
import { nextLayoutKey, newSlideIndex, nudgeFor, typesCharacter } from './slideEditing'

const layouts = { title: {}, 'title-content': {}, 'two-column': {}, 'section-header': {}, blank: {} }

describe('nextLayoutKey', () => {
  it('follows a title or section slide with a title and content', () => {
    expect(nextLayoutKey({ layout: 'title' }, layouts)).toBe('title-content')
    expect(nextLayoutKey({ layout: 'section-header' }, layouts)).toBe('title-content')
  })
  it('repeats any other layout', () => {
    expect(nextLayoutKey({ layout: 'two-column' }, layouts)).toBe('two-column')
    expect(nextLayoutKey({ layout: 'blank' }, layouts)).toBe('blank')
  })
  it('uses a title and content when the layout isn’t known', () => {
    expect(nextLayoutKey({}, layouts)).toBe('title-content')
    expect(nextLayoutKey({ layout: 'gone' }, layouts)).toBe('title-content')
    expect(nextLayoutKey(undefined, layouts)).toBe('title-content')
  })
})

describe('newSlideIndex', () => {
  it('puts a slide right after the one given', () => {
    const slides = [{}, {}, {}]
    expect(newSlideIndex(slides, 0)).toBe(1)
    expect(newSlideIndex(slides, 2)).toBe(3)
  })
  it('in columns, right after the slide given in its own column', () => {
    const slides = [{ column: 0 }, { column: 0 }, { column: 1 }, { column: 1 }]
    expect(newSlideIndex(slides, 0, 0)).toBe(1)
    expect(newSlideIndex(slides, 2, 1)).toBe(3)
  })
  it('at the end of another column, or of the deck for a new one', () => {
    const slides = [{ column: 0 }, { column: 0 }, { column: 1 }, { column: 1 }]
    expect(newSlideIndex(slides, 0, 1)).toBe(4)
    expect(newSlideIndex(slides, 3, 0)).toBe(2)
    expect(newSlideIndex(slides, 0, 5)).toBe(4)
  })
})

describe('nudgeFor', () => {
  it('moves 1px, 10px with Shift, or a grid step', () => {
    expect(nudgeFor('ArrowLeft')).toEqual({ dx: -1, dy: 0 })
    expect(nudgeFor('ArrowDown', { shift: true })).toEqual({ dx: 0, dy: 10 })
    expect(nudgeFor('ArrowUp', { grid: true, gridSize: 20, shift: true })).toEqual({ dx: 0, dy: -20 })
    expect(nudgeFor('Enter')).toBeNull()
  })
})

describe('typesCharacter', () => {
  it('is a character typed without Ctrl, Cmd or Alt', () => {
    expect(typesCharacter({ key: 'a' })).toBe(true)
    expect(typesCharacter({ key: ' ' })).toBe(true)
    expect(typesCharacter({ key: 'a', ctrlKey: true })).toBe(false)
    expect(typesCharacter({ key: 'Enter' })).toBe(false)
    expect(typesCharacter({ key: 'a', isComposing: true })).toBe(false)
  })
})

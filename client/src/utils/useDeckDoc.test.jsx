// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { useDeckDoc } from './useDeckDoc'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const deck = { id: 'p1', title: 'Talk', slides: [{ id: 's1', elements: [{ id: 'a', type: 'text', x: 0 }] }] }

// Renders the hook as the app does, in StrictMode, and keeps what it returned last
function mount() {
  const seen = { renders: 0 }
  function Probe() {
    Object.assign(seen, useDeckDoc())
    seen.renders++
    return null
  }
  const root = createRoot(document.createElement('div'))
  act(() => root.render(<StrictMode><Probe /></StrictMode>))
  return { seen, root }
}

describe('useDeckDoc', () => {
  it('redraws the editor for each change, and for undo and redo', () => {
    const { seen, root } = mount()
    const { setDeck, undo } = seen
    expect(seen.deck).toBeNull()

    act(() => seen.setDeck(deck))
    expect(seen.deck).toEqual(deck)
    act(() => seen.setDeck(prev => ({ ...prev, title: 'New' })))
    expect(seen.deck.title).toBe('New')
    expect(seen.canUndo()).toBe(true)

    act(() => { seen.undo() })
    expect(seen.deck.title).toBe('Talk')
    expect(seen.canRedo()).toBe(true)
    act(() => { seen.redo() })
    expect(seen.deck.title).toBe('New')

    // the same functions on every render, so effects and callbacks can keep them
    expect(seen.setDeck).toBe(setDeck)
    expect(seen.undo).toBe(undo)
    act(() => root.unmount())
  })

  it('doesn’t redraw when an update returns the same deck', () => {
    const { seen, root } = mount()
    act(() => seen.setDeck(deck))
    const renders = seen.renders
    act(() => seen.setDeck(prev => prev))
    expect(seen.renders).toBe(renders)
    act(() => root.unmount())
  })
})

// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../utils/api', () => ({
  api: { getExample: vi.fn(async slug => (slug === 'venn' ? { id: 'example-venn', title: 'Venn diagrams', theme: 'white', slides: [{ id: 's1', elements: [] }] } : null)) },
  setGuestToken: () => {},
}))
vi.mock('./EditorPage', () => ({ default: () => null }))
import { firstDeck } from './GuestPage'

afterEach(() => window.history.replaceState(null, '', '/try'))

describe('a guest’s first deck', () => {
  it('starts from the example in the link, under an id of its own', async () => {
    window.history.replaceState(null, '', '/try?example=venn')
    expect(await firstDeck()).toEqual({ title: 'Venn diagrams', theme: 'white', slides: [{ id: 's1', elements: [] }] })
  })

  it('is blank without one, or for one there isn’t', async () => {
    window.history.replaceState(null, '', '/try')
    expect(await firstDeck()).toEqual({ title: 'Untitled', theme: 'black', transition: 'slide' })
    window.history.replaceState(null, '', '/try?example=nope')
    expect((await firstDeck()).title).toBe('Untitled')
  })
})

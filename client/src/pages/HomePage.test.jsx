// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

const deck = (id, title, extra = {}) => ({ id, title, slideCount: 2, updatedAt: '2026-09-20T00:00:00Z', thumbnail: null, ...extra })

// Calls the test doesn't set up resolve to nothing
vi.mock('../utils/api', () => ({
  api: new Proxy({
    getPresentations: vi.fn(async () => [
      deck('mine', 'My talk'),
      deck('theirs', 'Group talk', { role: 'editor', ownerName: 'Ada' }),
    ]),
    getTemplates: vi.fn(async () => []),
    getCollaborators: vi.fn(async () => ({ you: 'u-me' })),
    removeCollaborator: vi.fn(async () => ({ success: true })),
  }, { get: (api, name) => api[name] ?? (api[name] = vi.fn(async () => null)) }),
}))
vi.mock('@clerk/clerk-react', () => ({ UserButton: () => null }))
import { api } from '../utils/api'
import HomePage from './HomePage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('the dashboard', () => {
  it('lists presentations shared with the user apart, with their owner, to leave rather than delete', async () => {
    const el = document.createElement('div')
    const root = createRoot(el)
    await act(async () => root.render(<HomePage onOpen={() => {}} theme="dark" onToggleTheme={() => {}} initialSlug={null} />))

    const headings = [...el.querySelectorAll('h2')].map(h => h.textContent)
    expect(headings).toContain('Shared with you')
    const grids = el.querySelectorAll('.presentations-grid')
    const card = title => [...el.querySelectorAll('.presentation-card')].find(c => c.querySelector('h3').textContent === title)
    expect(grids[0].contains(card('My talk'))).toBe(true)
    expect(grids[0].contains(card('Group talk'))).toBe(false)

    const titles = c => [...c.querySelectorAll('button')].map(b => b.title)
    expect(titles(card('My talk'))).toEqual(['Edit', 'Duplicate', 'Delete'])
    expect(titles(card('Group talk'))).toEqual(['Edit', 'Leave'])
    expect(card('Group talk').textContent).toContain('Owned by Ada')

    window.confirm = () => true
    await act(async () => { card('Group talk').querySelector('button[title="Leave"]').click() })
    expect(api.removeCollaborator).toHaveBeenCalledWith('theirs', 'u-me')
    expect(card('Group talk')).toBeUndefined()
    expect([...el.querySelectorAll('h2')].map(h => h.textContent)).not.toContain('Shared with you')
    act(() => root.unmount())
  })
})

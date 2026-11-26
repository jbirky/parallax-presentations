// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: {
    getTeamSpace: vi.fn(),
    createTeamFolder: vi.fn(async (id, name, parentId) => ({ id: 'f-new', name, parentId })),
    updateTeamFolder: vi.fn(async (id, folderId, change) => ({ id: folderId, ...change })),
    deleteTeamFolder: vi.fn(async () => ({ success: true })),
    moveDeck: vi.fn(async () => ({})),
  },
}))
import { api } from '../utils/api'
import TeamSpaceView from './TeamSpaceView'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const GB = 1024 * 1024 * 1024
const deck = (id, title, extra = {}) => ({ id, title, teamId: 't1', folderId: null, role: 'editor', creatorName: 'Ada', slideCount: 3, updatedAt: '2026-11-20T00:00:00Z', ...extra })
const spaceOf = (role, extra = {}) => ({
  team: { id: 't1', name: 'Exoplanet lab', status: 'active', role, canCreate: role !== 'viewer' },
  folders: [{ id: 'f1', name: 'Talks', parentId: null }, { id: 'f2', name: '2026', parentId: 'f1' }],
  presentations: [deck('d1', 'Colloquium', { folderId: 'f1' }), deck('d2', 'Lab meeting', { role: 'owner' })],
  storage: { used: 2 * GB, limit: 100 * GB },
  ...extra,
})

async function render(role, props = {}, space = spaceOf(role)) {
  api.getTeamSpace.mockResolvedValue(space)
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const onFolder = vi.fn()
  const renderCard = vi.fn((p, { reload }) => <div className="card">{p.title}</div>)
  const onNew = vi.fn()
  await act(async () => root.render(
    <TeamSpaceView team={{ id: 't1', name: 'Exoplanet lab' }} folder={null} onFolder={onFolder} renderCard={renderCard} onNew={onNew} {...props} />))
  const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.getAttribute('aria-label') === text)
  const cards = () => [...el.querySelectorAll('.card')].map(c => c.textContent)
  return { el, root, onFolder, renderCard, onNew, button, cards }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.confirm = () => true
})

describe('a team on the dashboard', () => {
  it('shows its top level, its folders and its storage', async () => {
    const { el, cards, renderCard, root } = await render('member')
    expect(api.getTeamSpace).toHaveBeenCalledWith('t1')
    expect(el.querySelector('.deck-crumb').textContent).toBe('Exoplanet lab')
    expect(el.textContent).toContain('2 GB of 100 GB used')
    expect([...el.querySelectorAll('.folder-tile-name')].map(n => n.textContent)).toEqual(['Talks'])
    expect(cards()).toEqual(['Lab meeting'])
    expect(typeof renderCard.mock.calls[0][1].reload).toBe('function')
    act(() => root.unmount())
  })

  it('opens a folder, and makes new presentations there', async () => {
    const page = await render('member', { folder: 'f1' })
    expect(page.cards()).toEqual(['Colloquium'])
    expect([...page.el.querySelectorAll('.deck-crumb')].map(c => c.textContent)).toEqual(['Exoplanet lab', 'Talks'])
    expect([...page.el.querySelectorAll('.folder-tile-name')].map(n => n.textContent)).toEqual(['2026'])
    await act(async () => page.el.querySelector('.new-card').click())
    expect(page.onNew).toHaveBeenCalledWith('f1')
    act(() => page.root.unmount())
  })

  it('makes, renames and (for owners and admins) deletes folders in the team', async () => {
    const page = await render('member')
    expect(page.button('Rename Talks')).toBeTruthy()
    expect(page.button('Delete Talks')).toBeUndefined()
    await act(async () => page.button('New folder').click())
    const input = page.el.querySelector('input[aria-label="New folder\'s name"]')
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
    await act(async () => { set.call(input, 'Journal club'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => input.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(api.createTeamFolder).toHaveBeenCalledWith('t1', 'Journal club', null)
    act(() => page.root.unmount())

    const admin = await render('admin')
    await act(async () => admin.button('Delete Talks').click())
    expect(api.deleteTeamFolder).toHaveBeenCalledWith('t1', 'f1')
    act(() => admin.root.unmount())
  })

  it('gives viewers nothing to change', async () => {
    const asViewer = spaceOf('viewer')
    asViewer.presentations = asViewer.presentations.map(p => ({ ...p, role: 'viewer' }))
    const { el, button, root } = await render('viewer', {}, asViewer)
    expect(el.querySelector('.new-card')).toBeNull()
    expect(button('New folder')).toBeUndefined()
    expect(button('Rename Talks')).toBeUndefined()
    expect(el.querySelector('[draggable="true"]')).toBeNull()
    expect(el.textContent).toContain('You’re a viewer')
    act(() => root.unmount())
  })

  it('says when the team has lapsed', async () => {
    const lapsed = spaceOf('owner')
    lapsed.team = { ...lapsed.team, status: 'lapsed', canCreate: false }
    const { el, button, root } = await render('owner', {}, lapsed)
    expect(el.querySelector('[role="status"]').textContent).toContain('subscription has ended')
    expect(button('New folder')).toBeUndefined()
    expect(button('Delete Talks')).toBeUndefined()
    act(() => root.unmount())
  })

  it('opens the team\'s members', async () => {
    const onManage = vi.fn()
    const { button, root } = await render('member', { onManage })
    await act(async () => button('Members').click())
    expect(onManage).toHaveBeenCalled()
    act(() => root.unmount())
  })
})

// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: {
    getTeamSpace: vi.fn(),
    createTeamFolder: vi.fn(async (id, name) => ({ id: 'f-new', name })),
    renameTeamFolder: vi.fn(async (id, folderId, name) => ({ id: folderId, name })),
    deleteTeamFolder: vi.fn(async () => ({ success: true })),
  },
}))
import { api } from '../utils/api'
import TeamSpaceView from './TeamSpaceView'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const GB = 1024 * 1024 * 1024
const deck = (id, title, extra = {}) => ({ id, title, teamId: 't1', folderId: null, role: 'editor', creatorName: 'Ada', ...extra })
const spaceOf = (role, extra = {}) => ({
  team: { id: 't1', name: 'Exoplanet lab', status: 'active', role, canCreate: role !== 'viewer' },
  folders: [{ id: 'f1', name: 'Talks' }, { id: 'f2', name: 'Grants' }],
  presentations: [deck('d1', 'Colloquium', { folderId: 'f1' }), deck('d2', 'Lab meeting')],
  storage: { used: 2 * GB, limit: 100 * GB },
  ...extra,
})

async function render(role, props = {}, space = spaceOf(role)) {
  api.getTeamSpace.mockResolvedValue(space)
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const state = { folder: props.folder || 'all' }
  const onFolder = vi.fn(f => { state.folder = f })
  const renderCard = vi.fn((p, { reload }) => <div key={p.id} className="card" data-folder={p.folderName || ''}>{p.title}</div>)
  const onNew = vi.fn()
  const draw = async () => act(async () => root.render(
    <TeamSpaceView team={{ id: 't1', name: 'Exoplanet lab' }} folder={state.folder} onFolder={onFolder} renderCard={renderCard} onNew={onNew} {...props} />))
  await draw()
  const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text)
  const cards = () => [...el.querySelectorAll('.card')].map(c => c.textContent)
  return { el, root, state, draw, onFolder, renderCard, onNew, button, cards }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.confirm = () => true
})

describe('a team on the dashboard', () => {
  it('shows its presentations, its folders and its storage', async () => {
    const { el, cards, renderCard, root } = await render('member')
    expect(api.getTeamSpace).toHaveBeenCalledWith('t1')
    expect(el.querySelector('h2').textContent).toBe('Exoplanet lab')
    expect(el.textContent).toContain('2 GB of 100 GB used')
    expect([...el.querySelectorAll('[role="toolbar"] button[aria-pressed]')].map(b => b.textContent)).toEqual(['All', 'Talks', 'Grants'])
    expect(cards()).toEqual(['Colloquium', 'Lab meeting'])
    // Seen together, each says which folder it's in
    expect(el.querySelector('.card').dataset.folder).toBe('Talks')
    expect(typeof renderCard.mock.calls[0][1].reload).toBe('function')
    act(() => root.unmount())
  })

  it('shows one folder at a time, and makes new presentations in it', async () => {
    const page = await render('member')
    await act(async () => page.button('Talks').click())
    expect(page.onFolder).toHaveBeenCalledWith('f1')
    await page.draw()
    expect(page.cards()).toEqual(['Colloquium'])
    await act(async () => page.el.querySelector('.new-card').click())
    expect(page.onNew).toHaveBeenCalledWith('f1')
    act(() => page.root.unmount())
  })

  it('lets members make and rename folders, and only owners and admins delete them', async () => {
    const page = await render('member', { folder: 'f1' })
    expect(page.button('Rename folder')).toBeTruthy()
    expect(page.button('Delete folder')).toBeUndefined()

    await act(async () => page.button('New folder').click())
    const input = page.el.querySelector('input[aria-label="New folder\'s name"]')
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
    await act(async () => { set.call(input, 'Journal club'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => input.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(api.createTeamFolder).toHaveBeenCalledWith('t1', 'Journal club')
    expect(page.onFolder).toHaveBeenLastCalledWith('f-new')
    act(() => page.root.unmount())

    const admin = await render('admin', { folder: 'f2' })
    await act(async () => admin.button('Delete folder').click())
    expect(api.deleteTeamFolder).toHaveBeenCalledWith('t1', 'f2')
    expect(admin.onFolder).toHaveBeenCalledWith('all')
    act(() => admin.root.unmount())
  })

  it('gives viewers nothing to change', async () => {
    const { el, button, root } = await render('viewer', { folder: 'f1' })
    expect(el.querySelector('.new-card')).toBeNull()
    expect(button('New folder')).toBeUndefined()
    expect(button('Rename folder')).toBeUndefined()
    expect(el.textContent).toContain('You’re a viewer')
    act(() => root.unmount())
  })

  it('says when the team has lapsed', async () => {
    const lapsed = spaceOf('owner')
    lapsed.team = { ...lapsed.team, status: 'lapsed', canCreate: false }
    const { el, button, root } = await render('owner', {}, lapsed)
    expect(el.querySelector('[role="status"]').textContent).toContain('subscription has ended')
    expect(button('New folder')).toBeUndefined()
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

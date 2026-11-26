// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: {
    listFolders: vi.fn(async () => ({ folders: [{ id: 'p1', name: 'Thesis', parentId: null }, { id: 'p2', name: 'Chapters', parentId: 'p1' }] })),
    getTeamSpace: vi.fn(async id => ({ folders: id === 't1' ? [{ id: 'f1', name: 'Talks', parentId: null }] : [] })),
    moveDeck: vi.fn(async () => ({})),
  },
}))
import { api } from '../utils/api'
import MoveDeckModal, { teamsToAddTo } from './MoveDeckModal'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const teams = [
  { id: 't1', name: 'Exoplanet lab', role: 'member', status: 'active' },
  { id: 't2', name: 'Teaching', role: 'admin', status: 'active' },
  { id: 't3', name: 'Watching', role: 'viewer', status: 'active' },
  { id: 't4', name: 'Old grant', role: 'owner', status: 'lapsed' },
]

async function render(deck, theirTeams = teams) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const onMoved = vi.fn(), onClose = vi.fn()
  await act(async () => root.render(<MoveDeckModal deck={deck} teams={theirTeams} you="u-me" onMoved={onMoved} onClose={onClose} />))
  const select = id => el.querySelector(`#${id}`)
  const options = id => [...select(id).options].map(o => o.textContent)
  const choose = async (id, value) => act(async () => {
    const s = select(id)
    s.value = value
    s.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const submit = () => act(async () => el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  return { el, root, onMoved, onClose, select, options, choose, submit }
}

beforeEach(() => vi.clearAllMocks())

describe('moving a presentation', () => {
  it('offers only teams the person can add to', () => {
    expect(teamsToAddTo(teams).map(t => t.id)).toEqual(['t1', 't2'])
  })

  it('files one of theirs in another of their folders, nested ones by path', async () => {
    const page = await render({ id: 'd1', title: 'Defense', teamId: null, folderId: null })
    expect(page.options('move-to')).toEqual(['My presentations', 'Exoplanet lab', 'Teaching'])
    expect(page.options('move-folder')).toEqual(['Not in a folder', 'Thesis', 'Thesis / Chapters'])
    // Where it is now isn't a move
    expect(page.el.querySelector('button[type="submit"]').disabled).toBe(true)
    await page.choose('move-folder', 'p2')
    await page.submit()
    expect(api.moveDeck).toHaveBeenCalledWith('d1', { teamId: null, folderId: 'p2' })
    expect(page.onMoved).toHaveBeenCalled()
    act(() => page.root.unmount())
  })

  it('moves one of theirs into a team\'s folder', async () => {
    const page = await render({ id: 'd1', title: 'Grant talk', teamId: null, folderId: null })
    await page.choose('move-to', 't1')
    expect(page.options('move-folder')).toEqual(['Not in a folder', 'Talks'])
    expect(page.el.textContent).toContain('Everyone in Exoplanet lab will be able to open it')
    await page.choose('move-folder', 'f1')
    await page.submit()
    expect(api.moveDeck).toHaveBeenCalledWith('d1', { teamId: 't1', folderId: 'f1' })
    act(() => page.root.unmount())
  })

  it('takes a team presentation into one of the person\'s folders, saying it becomes theirs', async () => {
    const page = await render({ id: 'd2', title: 'Lab meeting', teamId: 't2', folderId: null, creatorId: 'u-ada' })
    expect(page.select('move-to').value).toBe('t2')
    await page.choose('move-to', 'personal')
    expect(page.el.textContent).toContain('It becomes yours')
    await page.choose('move-folder', 'p1')
    await page.submit()
    expect(api.moveDeck).toHaveBeenCalledWith('d2', { teamId: null, folderId: 'p1' })
    act(() => page.root.unmount())
  })

  it('asks only for a folder where there are no teams', async () => {
    const page = await render({ id: 'd1', title: 'Defense', teamId: null, folderId: 'p1' }, [])
    expect(page.select('move-to')).toBeNull()
    expect(page.select('move-folder').value).toBe('p1')
    act(() => page.root.unmount())
  })

  it('shows why a move was refused', async () => {
    api.moveDeck.mockRejectedValueOnce(new Error('Teaching doesn\'t have room for its files (2 GB; 1 GB free).'))
    const page = await render({ id: 'd1', title: 'Grant talk', teamId: null, folderId: null })
    await page.choose('move-to', 't2')
    await page.submit()
    expect(page.el.querySelector('[role="alert"]').textContent).toContain('doesn\'t have room')
    expect(page.onMoved).not.toHaveBeenCalled()
    act(() => page.root.unmount())
  })
})

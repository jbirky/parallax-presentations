// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

// Teams are the cloud version's
vi.hoisted(() => vi.stubEnv('VITE_PARALLAX_MODE', 'cloud'))

const deck = (id, title, extra = {}) => ({ id, title, slideCount: 2, updatedAt: '2026-09-20T00:00:00Z', thumbnail: null, ...extra })
const teamDeck = (id, title, role, extra = {}) => deck(id, title, { teamId: 't1', folderId: null, role, creatorId: 'u-ada', creatorName: 'Ada', ...extra })

// Calls the test doesn't set up resolve to nothing
vi.mock('../utils/api', () => ({
  api: new Proxy({
    getPresentations: vi.fn(async () => [deck('mine', 'My talk')]),
    getTemplates: vi.fn(async () => []),
    getMe: vi.fn(async () => ({ id: 'u-me', plan: 'free', limits: { maxPresentations: 3 }, presentationCount: 1 })),
    getUploads: vi.fn(async () => []),
    listTeams: vi.fn(async () => ({ teams: [{ id: 't1', name: 'Exoplanet lab', role: 'member', status: 'active', memberCount: 3 }] })),
    getTeamSpace: vi.fn(async () => ({
      team: { id: 't1', name: 'Exoplanet lab', status: 'active', role: 'member', canCreate: true },
      folders: [{ id: 'f1', name: 'Talks' }],
      presentations: [
        teamDeck('d1', 'Colloquium', 'editor', { folderId: 'f1' }),
        teamDeck('d2', 'My lab talk', 'owner', { creatorId: 'u-me', creatorName: 'Me' }),
      ],
      storage: { used: 0, limit: 75 * 1024 ** 3 },
    })),
    createPresentation: vi.fn(async data => ({ id: 'new', title: data.title || 'Untitled' })),
  }, { get: (api, name) => api[name] ?? (api[name] = vi.fn(async () => null)) }),
}))
vi.mock('@clerk/clerk-react', () => ({ UserButton: () => null }))
import { api } from '../utils/api'
import HomePage from './HomePage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function render() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const onOpen = vi.fn()
  await act(async () => root.render(<HomePage onOpen={onOpen} theme="dark" onToggleTheme={() => {}} initialSlug={null} />))
  const card = title => [...el.querySelectorAll('.presentation-card')].find(c => c.querySelector('h3').textContent === title)
  const titles = c => [...c.querySelectorAll('button')].map(b => b.title)
  const nav = text => [...el.querySelectorAll('.spaces-item')].find(b => b.textContent.trim() === text)
  return { el, root, onOpen, card, titles, nav }
}

beforeEach(() => {
  vi.clearAllMocks()
  try { window.localStorage.clear() } catch {}
})

describe('the dashboard with teams', () => {
  it('lists the person\'s own presentations and their teams side by side', async () => {
    const page = await render()
    expect([...page.el.querySelectorAll('.spaces-item')].map(b => b.textContent.trim())).toEqual(['My presentations', 'Exoplanet lab'])
    expect(page.nav('My presentations').getAttribute('aria-current')).toBe('true')
    expect(page.titles(page.card('My talk'))).toEqual(['Edit', 'Move', 'Duplicate', 'Delete'])
    act(() => page.root.unmount())
  })

  it('shows a team\'s presentations, in its folders, with what the person can do with each, and makes new ones there', async () => {
    const page = await render()
    await act(async () => page.nav('Exoplanet lab').click())
    expect(api.getTeamSpace).toHaveBeenCalledWith('t1')
    // At the top level: the folder, and the presentation outside it
    expect(page.el.querySelector('.folder-tile').textContent).toContain('Talks')
    expect(page.card('Colloquium')).toBeUndefined()
    // Their own: move and delete too
    expect(page.titles(page.card('My lab talk'))).toEqual(['Edit', 'Move', 'Duplicate', 'Save as team template', 'Delete'])
    await act(async () => page.el.querySelector('.folder-tile').click())
    // Someone else's: edit and copy
    expect(page.card('Colloquium').textContent).toContain('By Ada')
    expect(page.titles(page.card('Colloquium'))).toEqual(['Edit', 'Duplicate', 'Save as team template'])

    await act(async () => page.el.querySelector('.deck-crumb').click())
    await act(async () => page.el.querySelector('.new-card').click())
    expect(page.el.querySelector('.modal h2').textContent).toBe('New presentation in Exoplanet lab')
    await act(async () => page.el.querySelector('.modal form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(api.createPresentation).toHaveBeenCalledWith(expect.objectContaining({ teamId: 't1', folderId: null }))
    expect(page.onOpen).toHaveBeenCalledWith('new', false, 'Untitled')
    act(() => page.root.unmount())
  })

  it('saves a team presentation as a team template, and starts new team presentations from it', async () => {
    api.getTeamTemplates.mockResolvedValue([
      { id: 'tt1', title: 'Group meeting', teamId: 't1', createdBy: 'u-me', creatorName: 'Me', thumbnail: null },
      { id: 'tt2', title: 'Journal club', teamId: 't1', createdBy: 'u-ada', creatorName: 'Ada', thumbnail: null },
    ])
    api.saveTeamTemplate.mockResolvedValue({ id: 'tt3', title: 'Lab talk (template)' })
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Lab talk (template)')
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const page = await render()
    await act(async () => page.nav('Exoplanet lab').click())
    await act(async () => page.card('My lab talk').querySelector('button[title="Save as team template"]').click())
    expect(api.saveTeamTemplate).toHaveBeenCalledWith('t1', 'd2', 'Lab talk (template)')
    expect(alert.mock.calls[0][0]).toContain('team’s templates')

    await act(async () => page.el.querySelector('.new-card').click())
    expect(api.getTeamTemplates).toHaveBeenCalledWith('t1')
    const picks = () => [...page.el.querySelectorAll('.modal .form-group button[type="button"]:not(.template-remove)')].map(b => b.textContent.trim())
    expect(picks()).toEqual(expect.arrayContaining(['Blank', 'Group meeting', 'Journal club']))
    // A member deletes the team templates they saved, not others'
    const removers = [...page.el.querySelectorAll('.template-remove')].map(b => b.getAttribute('aria-label'))
    expect(removers).toEqual(['Delete the team template Group meeting'])
    const pick = [...page.el.querySelectorAll('.modal button')].find(b => b.textContent.trim() === 'Journal club')
    await act(async () => pick.click())
    await act(async () => page.el.querySelector('.modal form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(api.createPresentation).toHaveBeenCalledWith(expect.objectContaining({ teamId: 't1', templateId: 'tt2' }))

    await act(async () => page.el.querySelector('.new-card').click())
    await act(async () => page.el.querySelector('.template-remove').click())
    expect(api.deleteTeamTemplate).toHaveBeenCalledWith('t1', 'tt1')
    expect(picks()).not.toContain('Group meeting')
    prompt.mockRestore(); alert.mockRestore(); confirm.mockRestore()
    act(() => page.root.unmount())
  })

  it('keeps a team\'s viewers from adding to it, and Fork from Git on their own page', async () => {
    api.listTeams.mockResolvedValueOnce({ teams: [{ id: 't1', name: 'Exoplanet lab', role: 'viewer', status: 'active', memberCount: 3 }] })
    const page = await render()
    const header = () => [...page.el.querySelectorAll('.home-header button')].map(b => b.textContent.trim()).filter(Boolean)
    expect(header()).toEqual(expect.arrayContaining(['Fork from Git', 'From Beamer', 'New Presentation']))
    await act(async () => page.nav('Exoplanet lab').click())
    expect(header()).not.toContain('Fork from Git')
    expect(header()).not.toContain('New Presentation')
    expect(header()).not.toContain('From Beamer')
    act(() => page.root.unmount())
  })

  it('remembers the team it was showing', async () => {
    window.localStorage.setItem('parallax.space', 't1')
    const page = await render()
    expect(page.nav('Exoplanet lab').getAttribute('aria-current')).toBe('true')
    expect(page.card('My lab talk')).toBeTruthy()
    act(() => page.root.unmount())
  })

  it('files their own presentations in folders, and shows them as a list', async () => {
    api.listFolders.mockResolvedValue({ folders: [{ id: 'pf1', name: 'Thesis', parentId: null }] })
    api.getPresentations.mockResolvedValueOnce([deck('mine', 'My talk'), deck('filed', 'Chapter 2', { folderId: 'pf1' })])
    const page = await render()
    expect(page.card('Chapter 2')).toBeUndefined()
    await act(async () => page.el.querySelector('.folder-tile').click())
    expect(page.card('Chapter 2')).toBeTruthy()
    await act(async () => page.el.querySelector('.new-card').click())
    expect(page.el.querySelector('.modal h2').textContent).toBe('New presentation in Thesis')
    await act(async () => page.el.querySelector('.modal form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(api.createPresentation).toHaveBeenCalledWith(expect.objectContaining({ folderId: 'pf1' }))
    expect(api.createPresentation.mock.calls.at(-1)[0].teamId).toBeUndefined()

    await act(async () => page.el.querySelector('button[aria-label="List"]').click())
    expect(window.localStorage.getItem('parallax.deckView')).toBe('list')
    expect([...page.el.querySelectorAll('.deck-row .deck-row-name')].map(n => n.textContent)).toEqual(['New presentation', 'Chapter 2'])
    act(() => page.root.unmount())
  })
})

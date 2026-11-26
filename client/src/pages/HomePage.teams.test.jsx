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
    // One of theirs can go to a team they're a member of
    expect(page.titles(page.card('My talk'))).toEqual(['Edit', 'Move to a team', 'Duplicate', 'Delete'])
    act(() => page.root.unmount())
  })

  it('shows a team\'s presentations with what the person can do with each, and makes new ones there', async () => {
    const page = await render()
    await act(async () => page.nav('Exoplanet lab').click())
    expect(api.getTeamSpace).toHaveBeenCalledWith('t1')
    expect(page.card('Colloquium').textContent).toContain('By Ada · in Talks')
    // Someone else's: edit and copy; their own: move and delete too
    expect(page.titles(page.card('Colloquium'))).toEqual(['Edit', 'Duplicate'])
    expect(page.titles(page.card('My lab talk'))).toEqual(['Edit', 'Move', 'Duplicate', 'Delete'])

    await act(async () => page.el.querySelector('.new-card').click())
    expect(page.el.querySelector('.modal h2').textContent).toBe('New presentation in Exoplanet lab')
    await act(async () => page.el.querySelector('.modal form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(api.createPresentation).toHaveBeenCalledWith(expect.objectContaining({ teamId: 't1', folderId: null }))
    expect(page.onOpen).toHaveBeenCalledWith('new', false, 'Untitled')
    act(() => page.root.unmount())
  })

  it('keeps a team\'s viewers from adding to it, and Fork from Git on their own page', async () => {
    api.listTeams.mockResolvedValueOnce({ teams: [{ id: 't1', name: 'Exoplanet lab', role: 'viewer', status: 'active', memberCount: 3 }] })
    const page = await render()
    const header = () => [...page.el.querySelectorAll('.home-header button')].map(b => b.textContent.trim()).filter(Boolean)
    expect(header()).toEqual(expect.arrayContaining(['Fork from Git', 'From Beamer', 'New Presentation']))
    // One of their own can't go to a team they only view
    expect(page.titles(page.card('My talk'))).toEqual(['Edit', 'Duplicate', 'Delete'])
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
    expect(page.card('Colloquium')).toBeTruthy()
    act(() => page.root.unmount())
  })
})

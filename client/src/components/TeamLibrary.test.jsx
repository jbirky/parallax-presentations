// @vitest-environment happy-dom
// A team's library in the editor: the Team themes in the Themes panel, the
// Team fonts in the Fonts dialog, and the team's datasets in the Datasets
// panel, with what each team role can do with them.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: new Proxy({
    listThemes: vi.fn(async () => [
      { id: 'mine1', name: 'My look', base: 'white', version: 1 },
      { id: 'team1', name: 'Lab look', base: 'moon', version: 1, teamId: 't1', createdBy: 'u-ada', creatorName: 'Ada' },
      { id: 'team2', name: 'Poster', base: 'night', version: 1, teamId: 't1', createdBy: 'u-me', creatorName: 'Me' },
    ]),
    createTeamTheme: vi.fn(async (teamId, doc) => ({ ...doc, id: 'team3', version: 1, teamId, createdBy: 'u-me' })),
    deleteTeamTheme: vi.fn(async () => ({ success: true })),
    addTeamFont: vi.fn(async (teamId, { fontId }) => ({ id: 'tf2', familyName: 'Jost', source: 'google', url: 'u2', teamId, createdBy: 'u-me', sharedFrom: fontId })),
    deleteTeamFont: vi.fn(async () => ({ success: true })),
    deleteFont: vi.fn(async () => ({ success: true })),
    getDatasets: vi.fn(async () => [
      { id: 'd1', name: 'mine', filename: 'mine.csv', columns: [], rowCount: 2, byteSize: 10, sourceKind: 'upload' },
      { id: 'd2', name: 'shared', filename: 'shared.csv', columns: [], rowCount: 2, byteSize: 10, sourceKind: 'upload', teamId: 't1', creatorId: 'u-ada', creatorName: 'Ada' },
    ]),
    getPresentationDatasets: vi.fn(async () => []),
    getDatasetSources: vi.fn(async () => ({ enabled: false })),
    shareDatasetWithTeam: vi.fn(async () => ({})),
    linkDataset: vi.fn(async () => ({ success: true, movedToTeam: true })),
  }, { get: (api, name) => api[name] ?? (api[name] = vi.fn(async () => null)) }),
}))
import { api } from '../utils/api'
import ThemeLibrary from './ThemeLibrary'
import FontLists from './FontLists'
import DatasetPanel from './DatasetPanel'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function mount(ui) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  await act(async () => root.render(ui))
  const labels = () => [...el.querySelectorAll('button[aria-label]')].map(b => b.getAttribute('aria-label'))
  const button = label => el.querySelector(`button[aria-label="${label}"]`)
  return { el, root, labels, button, unmount: () => act(() => root.unmount()) }
}

const member = { id: 't1', role: 'member', you: 'u-me' }
const viewer = { id: 't1', role: 'viewer', you: 'u-me' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.spyOn(window, 'prompt').mockReturnValue('Team look')
})

describe('Team themes', () => {
  const deck = { title: 'Talk', theme: 'black' }

  it('lists the team\'s themes apart from their own, and lets members delete only theirs', async () => {
    const page = await mount(<ThemeLibrary deck={deck} onApply={vi.fn()} onSource={vi.fn()} team={member} />)
    expect(api.listThemes).toHaveBeenCalledWith('t1')
    const headings = [...page.el.querySelectorAll('h4')].map(h => h.textContent)
    expect(headings).toEqual(['My themes', 'Team themes'])
    const lists = page.el.querySelectorAll('.theme-lib-list')
    expect([...lists[0].querySelectorAll('.theme-lib-name')].map(n => n.textContent)).toEqual(['My look'])
    expect([...lists[1].querySelectorAll('.theme-lib-name')].map(n => n.textContent)).toEqual(['Lab look', 'Poster'])
    expect(page.button('Delete Lab look')).toBeNull()
    expect(page.button('Delete Poster')).toBeTruthy()
    await act(async () => page.button('Delete Poster').click())
    expect(api.deleteTeamTheme).toHaveBeenCalledWith('t1', 'team2')
    page.unmount()
  })

  it('saves the deck\'s look to the team, and copies one of theirs there', async () => {
    const onSource = vi.fn()
    const page = await mount(<ThemeLibrary deck={deck} onApply={vi.fn()} onSource={onSource} team={member} />)
    await act(async () => page.button('Save to the team’s themes').click())
    expect(api.createTeamTheme).toHaveBeenCalledWith('t1', expect.objectContaining({ name: 'Team look' }))
    expect(onSource).toHaveBeenCalledWith(expect.objectContaining({ id: 'team3' }))
    await act(async () => page.button('Copy My look to the team').click())
    expect(api.createTeamTheme).toHaveBeenLastCalledWith('t1', expect.objectContaining({ name: 'My look', base: 'white' }))
    expect(api.createTeamTheme.mock.calls.at(-1)[1].id).toBeUndefined()
    page.unmount()
  })

  it('gives a team\'s viewers the themes to use, not to change', async () => {
    const page = await mount(<ThemeLibrary deck={deck} onApply={vi.fn()} onSource={vi.fn()} team={viewer} />)
    expect(page.button('Save to the team’s themes')).toBeNull()
    expect(page.button('Copy My look to the team')).toBeNull()
    expect(page.labels().filter(l => l.startsWith('Delete'))).toEqual(['Delete My look'])
    page.unmount()
  })

  it('is just their own outside a team', async () => {
    api.listThemes.mockResolvedValueOnce([{ id: 'mine1', name: 'My look', base: 'white', version: 1 }])
    const page = await mount(<ThemeLibrary deck={deck} onApply={vi.fn()} onSource={vi.fn()} />)
    expect(api.listThemes).toHaveBeenCalledWith(undefined)
    expect([...page.el.querySelectorAll('h4')].map(h => h.textContent)).toEqual(['My themes'])
    page.unmount()
  })
})

describe('Team fonts', () => {
  const fonts = [
    { id: 'f1', familyName: 'Jost', source: 'google', url: 'u2' },
    { id: 'f2', familyName: 'Lato', source: 'google', url: 'u1' },
    { id: 'tf1', familyName: 'Lato', source: 'google', url: 'u1', teamId: 't1', createdBy: 'u-ada', creatorName: 'Ada' },
  ]

  it('shares their fonts the team doesn\'t have, and removes only team fonts they may', async () => {
    const onChange = vi.fn()
    const page = await mount(<FontLists fonts={fonts} team={member} onChange={onChange} />)
    expect([...page.el.querySelectorAll('.font-list-heading')].map(h => h.textContent)).toEqual(['My Fonts (2)', 'Team fonts (1)'])
    expect(page.el.textContent).toContain('shared by Ada')
    // Lato is the team's already
    expect(page.button('Share Lato with the team')).toBeNull()
    expect(page.labels().filter(l => l === 'Remove Lato')).toHaveLength(1)
    await act(async () => page.button('Share Jost with the team').click())
    expect(api.addTeamFont).toHaveBeenCalledWith('t1', { fontId: 'f1' })
    expect(onChange.mock.calls[0][0].map(f => f.id)).toEqual(['f1', 'f2', 'tf1', 'tf2'])
    page.unmount()
  })

  it('lets the team\'s admins remove any team font', async () => {
    const onChange = vi.fn()
    const page = await mount(<FontLists fonts={fonts} team={{ id: 't1', role: 'admin', you: 'u-me' }} onChange={onChange} />)
    const removers = [...page.el.querySelectorAll('button[aria-label="Remove Lato"]')]
    expect(removers).toHaveLength(2)
    await act(async () => removers[1].click())
    expect(api.deleteTeamFont).toHaveBeenCalledWith('t1', 'tf1')
    expect(onChange.mock.calls[0][0].map(f => f.id)).toEqual(['f1', 'f2'])
    page.unmount()
  })

  it('shows only their own outside a team', async () => {
    const page = await mount(<FontLists fonts={fonts.slice(0, 2)} onChange={vi.fn()} />)
    expect([...page.el.querySelectorAll('.font-list-heading')].map(h => h.textContent)).toEqual(['My Fonts (2)'])
    expect(page.labels().some(l => l.startsWith('Share'))).toBe(false)
    page.unmount()
  })
})

describe('the team\'s datasets', () => {
  const rowOf = (el, name) => [...el.querySelectorAll('div')].find(d => d.style.borderRadius === '8px' && d.textContent.includes(`${name}.csv`))

  it('marks the team\'s, gives theirs to the team, and keeps others\' from members', async () => {
    const page = await mount(<DatasetPanel presentationId="p1" team={member} onClose={vi.fn()} />)
    expect(api.getDatasets).toHaveBeenCalledWith('t1')
    const mine = rowOf(page.el, 'mine'), shared = rowOf(page.el, 'shared')
    expect(shared.textContent).toContain('Team')
    expect(mine.textContent).toContain('Give to team')
    expect(shared.textContent).not.toContain('Give to team')
    expect(mine.querySelector('button[title="Delete dataset"]')).toBeTruthy()
    expect(shared.querySelector('button[title="Delete dataset"]')).toBeNull()
    const give = [...mine.querySelectorAll('button')].find(b => b.textContent.includes('Give to team'))
    await act(async () => give.click())
    expect(api.shareDatasetWithTeam).toHaveBeenCalledWith('d1', 't1')
    expect(page.el.querySelector('[role="status"]').textContent).toContain('“mine” is the team’s now')
    page.unmount()
  })

  it('says so when linking one of theirs gives it to the team', async () => {
    const page = await mount(<DatasetPanel presentationId="p1" team={member} onClose={vi.fn()} />)
    const link = [...rowOf(page.el, 'mine').querySelectorAll('button')].find(b => b.textContent.includes('Link'))
    await act(async () => link.click())
    expect(api.linkDataset).toHaveBeenCalledWith('p1', 'd1')
    expect(page.el.querySelector('[role="status"]').textContent).toContain('the team’s now')
    page.unmount()
  })

  it('lists only their own outside a team', async () => {
    const page = await mount(<DatasetPanel presentationId="p1" onClose={vi.fn()} />)
    expect(api.getDatasets).toHaveBeenCalledWith(undefined)
    expect(page.el.textContent).not.toContain('Give to team')
    page.unmount()
  })
})

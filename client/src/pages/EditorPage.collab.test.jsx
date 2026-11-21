// @vitest-environment happy-dom
// The editor with others, saving over HTTP: what an editor doesn't get, and
// what happens when someone else saved first.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

// The cloud version, set before EditorPage is imported (imports come first)
vi.hoisted(() => vi.stubEnv('VITE_PARALLAX_MODE', 'cloud'))

const saved = { id: 'p1', title: 'Group talk', version: 7, slides: [{ id: 's1', elements: [{ id: 'a', type: 'text', x: 0, y: 0, width: 100, height: 40, zIndex: 1, content: '<p>Hi</p>' }] }] }
const conflict = Object.assign(new Error('Someone else saved'), { code: 'conflict', version: 8 })

// Calls the test doesn't set up resolve to nothing
vi.mock('../utils/api', () => ({
  api: new Proxy({}, { get: (api, name) => api[name] ?? (api[name] = vi.fn(async () => null)) }),
  getAuthToken: async () => 'token',
}))
// Live editing refuses at once, so these open the presentation the saved way
// (EditorPage.live.test.jsx has live editing)
vi.mock('../utils/liveDeck', () => ({
  connectLive: vi.fn(({ onRefused }) => { queueMicrotask(onRefused); return { disconnect: () => {} } }),
}))
import { api } from '../utils/api'
import EditorPage from './EditorPage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, el
async function open(role, props = {}) {
  api.getPresentation.mockImplementation(async () => structuredClone(saved))
  api.getCollaborators.mockResolvedValue({ role, you: 'u-me', inviteToken: null, people: [] })
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<EditorPage presentationId="p1" onGoHome={() => {}} {...props} />))
  await act(async () => { await vi.runOnlyPendingTimersAsync() })
}
const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text)
// An edit: renaming the presentation
async function rename(title) {
  const input = el.querySelector('.editor-header .title-input')
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  await act(async () => { setValue.call(input, title); input.dispatchEvent(new Event('input', { bubbles: true })) })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  // Requests outside the api module (plugins) find nothing; refused saves are logged
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]')))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  act(() => root.unmount())
  el.remove()
  vi.useRealTimers()
})

describe('the editor, shared', () => {
  // The labels in a menu of the menu bar, after opening it and, along
  // `path`, its submenus
  async function menu(name, ...path) {
    const title = [...el.querySelectorAll('.menu-bar .menu-title')].find(b => b.textContent === name)
    await act(async () => title.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    for (const label of path) {
      const row = [...el.querySelectorAll('.menu-dropdown [role^=menuitem]')].find(b => b.querySelector('.menu-label').textContent.replace(/^[✓•]/, '').trim() === label)
      await act(async () => row.click())
    }
    const deepest = [...el.querySelectorAll('.menu-dropdown')].pop()
    return [...deepest.querySelectorAll(':scope > .menu-row > button')].map(b => b.querySelector('.menu-label').textContent.replace(/^[✓•]/, '').trim())
  }
  const closeMenus = async () => act(async () => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))

  it('has a menu bar where the top bar’s buttons were, and keeps Present', async () => {
    await open('owner')
    expect([...el.querySelectorAll('.menu-bar .menu-title')].map(b => b.textContent)).toEqual(['File', 'Edit', 'View', 'Insert', 'Format', 'Slide', 'Tools', 'Help'])
    expect(el.querySelector('.menu-bar').getAttribute('role')).toBe('menubar')
    for (const gone of ['Settings', 'Export', 'Share', 'History', 'Files', 'Data', 'Sync']) expect(button(gone)).toBeUndefined()
    expect(button('Present')).toBeTruthy()
  })

  it('puts the share link and editors under Tools, not Export', async () => {
    await open('owner')
    const tools = await menu('Tools')
    expect(tools).toContain('Share link…')
    expect(tools).toContain('Editors…')
    await closeMenus()
    const exports = await menu('File', 'Export')
    expect(exports).toEqual(expect.arrayContaining(['PDF', 'PowerPoint (.pptx)', 'HTML']))
    expect(exports).not.toContain('Share link…')
  })

  it('gives an editor the editors but not the share link, which is the owner’s', async () => {
    await open('editor')
    const tools = await menu('Tools')
    expect(tools).toContain('Editors…')
    expect(tools).not.toContain('Share link…')
  })

  it('has no sharing for a guest', async () => {
    await open('owner', { guest: { idleHours: 12 } })
    const tools = await menu('Tools')
    expect(tools).not.toContain('Share link…')
    expect(tools).not.toContain('Editors…')
    await closeMenus()
    expect(await menu('File', 'Export')).toContain('Offline HTML')
  })

  it('switches the editor between light and dark in View', async () => {
    const onThemeChange = vi.fn()
    await open('owner', { theme: 'light', onThemeChange })
    const themes = await menu('View', 'Editor theme')
    expect(themes).toEqual(['Light', 'Dark'])
    const dark = [...el.querySelectorAll('.menu-dropdown [role=menuitemradio]')].find(b => b.textContent.includes('Dark'))
    await act(async () => dark.click())
    expect(onThemeChange).toHaveBeenCalledWith('dark')
  })

  it('leaves the owner’s Sync menu out for an editor', async () => {
    await open('editor')
    expect(el.querySelector('.editor-header .title-input').value).toBe('Group talk')
    expect(await menu('Tools')).not.toContain('Sync')
  })

  it('keeps the Sync menu for the owner', async () => {
    await open('owner')
    expect(await menu('Tools')).toContain('Sync')
  })

  it('stops saving when someone else saved first, and can load their version', async () => {
    await open('editor')
    api.updatePresentation.mockRejectedValue(conflict)
    await rename('Renamed')
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(api.updatePresentation).toHaveBeenCalled()
    const alert = el.querySelector('[role="alert"]')
    expect(alert.textContent).toContain('Someone else saved this presentation')

    // no more saves while it's showing, even after another edit
    const calls = api.updatePresentation.mock.calls.length
    await rename('Renamed again')
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(api.updatePresentation.mock.calls.length).toBe(calls)

    api.updatePresentation.mockResolvedValue({ ...saved, version: 8 })
    await act(async () => { button('Load their version').click() })
    await act(async () => { await vi.runOnlyPendingTimersAsync() })
    expect(el.querySelector('[role="alert"]')).toBeNull()
    expect(api.getPresentation).toHaveBeenCalledTimes(2)
    expect(el.querySelector('.editor-header .title-input').value).toBe('Group talk')
  })

  it('can save over their version instead', async () => {
    await open('owner')
    api.updatePresentation.mockRejectedValueOnce(conflict).mockResolvedValue({ ...saved, version: 9 })
    await rename('Mine')
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(el.querySelector('[role="alert"]')).toBeTruthy()
    await act(async () => { button('Keep mine').click() })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(api.saveOverVersion).toHaveBeenCalledWith('p1', 8)
    expect(api.updatePresentation).toHaveBeenLastCalledWith('p1', expect.objectContaining({ title: 'Mine' }))
    expect(el.querySelector('[role="alert"]')).toBeNull()
  })
})

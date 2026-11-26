// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import DeckBrowser from './DeckBrowser'
import { folderTrail, folderPaths, isWithin, foldersIn } from '../utils/folders'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const FOLDERS = [
  { id: 'f1', name: 'Talks', parentId: null },
  { id: 'f2', name: '2026', parentId: 'f1' },
  { id: 'f3', name: 'Archive', parentId: null },
]
const deck = (id, title, folderId = null, extra = {}) => ({ id, title, folderId, slideCount: 3, updatedAt: '2026-11-01T00:00:00Z', ...extra })
const DECKS = [
  deck('d1', 'Lab meeting', null, { updatedAt: '2026-11-20T00:00:00Z', slideCount: 9 }),
  deck('d2', 'Colloquium', null, { updatedAt: '2026-10-01T00:00:00Z', slideCount: 30 }),
  deck('d3', 'AAS talk', 'f1'),
  deck('d4', 'Locked', null, { locked: true }),
]

async function render(props = {}) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const calls = {
    onOpenFolder: vi.fn(), onView: vi.fn(), onCreateFolder: vi.fn(async () => {}), onUpdateFolder: vi.fn(async () => {}),
    onDeleteFolder: vi.fn(async () => {}), onMoveDeck: vi.fn(async () => {}), onOpenDeck: vi.fn(), onNew: vi.fn(),
  }
  const all = {
    rootName: 'My presentations', folders: FOLDERS, decks: DECKS, folderId: null, view: 'tiles',
    canEditFolders: true, canDeleteFolders: true, canMoveDeck: d => !d.locked,
    renderTile: d => <div className="tile">{d.title}</div>,
    renderActions: d => <button type="button" title={`Act on ${d.title}`}>x</button>,
    ...calls, ...props,
  }
  const draw = extra => act(async () => root.render(<DeckBrowser {...all} {...extra} />))
  await draw()
  const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.getAttribute('aria-label') === text)
  return { el, root, draw, button, ...calls }
}

// A drag that carries data between dispatched events, as a browser's does
function dataTransfer() {
  const data = {}
  return { types: [], effectAllowed: '', dropEffect: '', setData(type, value) { data[type] = value; this.types = Object.keys(data) }, getData: type => data[type] || '' }
}
async function drag(from, to, dt = dataTransfer()) {
  const fire = (target, type) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: dt })
    target.dispatchEvent(event)
  }
  await act(async () => { fire(from, 'dragstart'); fire(to, 'dragover'); fire(to, 'drop') })
}

beforeEach(() => {
  window.confirm = () => true
})

describe('folder paths', () => {
  it('walks up to the top level, and lists every folder by its path', () => {
    expect(folderTrail(FOLDERS, 'f2').map(f => f.name)).toEqual(['Talks', '2026'])
    expect(folderTrail(FOLDERS, null)).toEqual([])
    expect(folderPaths(FOLDERS).map(f => f.path)).toEqual(['Archive', 'Talks', 'Talks / 2026'])
    expect(isWithin(FOLDERS, 'f2', 'f1')).toBe(true)
    expect(isWithin(FOLDERS, 'f3', 'f1')).toBe(false)
    expect(foldersIn(FOLDERS, null).map(f => f.name)).toEqual(['Archive', 'Talks'])
  })
})

describe('the file browser', () => {
  it('shows the folders and presentations at one level as tiles', async () => {
    const { el, root } = await render()
    expect([...el.querySelectorAll('.deck-crumb')].map(c => c.textContent)).toEqual(['My presentations'])
    expect([...el.querySelectorAll('.folder-tile-name')].map(n => n.textContent)).toEqual(['Archive', 'Talks'])
    // Talks holds 2026 and AAS talk
    expect([...el.querySelectorAll('.folder-tile-count')].map(n => n.textContent)).toEqual(['0', '2'])
    expect([...el.querySelectorAll('.tile')].map(t => t.textContent)).toEqual(['Lab meeting', 'Locked', 'Colloquium'])
    act(() => root.unmount())
  })

  it('opens folders and goes back up through the breadcrumbs', async () => {
    const page = await render({ folderId: 'f2' })
    expect([...page.el.querySelectorAll('.deck-crumb')].map(c => c.textContent)).toEqual(['My presentations', 'Talks', '2026'])
    expect(page.el.querySelector('.deck-crumb[aria-current="page"]').textContent).toBe('2026')
    expect(page.el.textContent).toContain('This folder is empty')
    await act(async () => page.button('Talks').click())
    expect(page.onOpenFolder).toHaveBeenCalledWith('f1')
    await page.draw({ folderId: null })
    await act(async () => page.el.querySelector('.folder-tile[aria-label="Open Archive"]').click())
    expect(page.onOpenFolder).toHaveBeenLastCalledWith('f3')
    act(() => page.root.unmount())
  })

  it('shows the same as a list, sortable, with folders first', async () => {
    const page = await render({ view: 'list', ownerColumn: { label: 'Owner', value: d => d.title === 'Colloquium' ? 'Ada' : '' } })
    const names = () => [...page.el.querySelectorAll('.deck-row .deck-row-name')].map(n => n.textContent)
    expect(names()).toEqual(['New presentation', 'Archive', 'Talks', 'Lab meeting', 'Locked', 'Colloquium'])
    expect(page.el.querySelector('th').textContent).toBe('Name')
    expect(page.el.textContent).toContain('Ada')
    await act(async () => page.button('Name').click())
    expect(names().slice(3)).toEqual(['Colloquium', 'Lab meeting', 'Locked'])
    await act(async () => page.button('Name').click())
    expect(names().slice(3)).toEqual(['Locked', 'Lab meeting', 'Colloquium'])
    await act(async () => page.button('Slides').click())
    expect(names().slice(3)).toEqual(['Colloquium', 'Lab meeting', 'Locked'])

    // A row opens its presentation or folder; its buttons don't
    await act(async () => [...page.el.querySelectorAll('.deck-row')].find(r => r.textContent.includes('Lab meeting')).click())
    expect(page.onOpenDeck).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }))
    await act(async () => page.el.querySelector('button[title="Act on Colloquium"]').click())
    expect(page.onOpenDeck).toHaveBeenCalledTimes(1)
    await act(async () => [...page.el.querySelectorAll('.deck-row')].find(r => r.textContent.includes('Archive')).click())
    expect(page.onOpenFolder).toHaveBeenCalledWith('f3')
    await act(async () => page.el.querySelector('.deck-row-new').click())
    expect(page.onNew).toHaveBeenCalledWith(null)
    act(() => page.root.unmount())
  })

  it('switches between tiles and a list', async () => {
    const page = await render()
    expect(page.button('Tiles').getAttribute('aria-pressed')).toBe('true')
    await act(async () => page.button('List').click())
    expect(page.onView).toHaveBeenCalledWith('list')
    act(() => page.root.unmount())
  })

  it('makes folders where it is, and renames and deletes them', async () => {
    const page = await render({ folderId: 'f1' })
    await act(async () => page.button('New folder').click())
    const input = page.el.querySelector('input[aria-label="New folder\'s name"]')
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
    await act(async () => { set.call(input, 'Posters'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => input.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(page.onCreateFolder).toHaveBeenCalledWith('Posters', 'f1')

    await act(async () => page.button('Rename 2026').click())
    const rename = page.el.querySelector('input[aria-label="Folder\'s name"]')
    expect(rename.value).toBe('2026')
    await act(async () => { set.call(rename, '2026 talks'); rename.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => rename.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(page.onUpdateFolder).toHaveBeenCalledWith('f2', { name: '2026 talks' })

    await act(async () => page.button('Delete 2026').click())
    expect(page.onDeleteFolder).toHaveBeenCalledWith('f2')
    act(() => page.root.unmount())
  })

  it('shows why a change was refused', async () => {
    const page = await render({ onDeleteFolder: vi.fn(async () => { throw new Error('Only the team\'s owner and admins can delete folders') }) })
    await act(async () => page.button('Delete Talks').click())
    expect(page.el.querySelector('[role="alert"]').textContent).toBe('Only the team\'s owner and admins can delete folders')
    act(() => page.root.unmount())
  })

  it('moves presentations and folders dropped on a folder or a breadcrumb', async () => {
    const page = await render()
    const tile = title => [...page.el.querySelectorAll('.deck-tile')].find(t => t.textContent === title)
    const folderTile = name => page.el.querySelector(`.folder-tile[aria-label="Open ${name}"]`)
    await drag(tile('Lab meeting'), folderTile('Talks'))
    expect(page.onMoveDeck).toHaveBeenCalledWith('d1', 'f1')
    await drag(folderTile('Archive'), folderTile('Talks'))
    expect(page.onUpdateFolder).toHaveBeenCalledWith('f3', { parentId: 'f1' })
    // Some can't be dragged
    expect(tile('Locked').getAttribute('draggable')).toBeNull()
    act(() => page.root.unmount())

    // From inside a folder, up to the top level by its breadcrumb
    const inside = await render({ folderId: 'f1' })
    const aas = [...inside.el.querySelectorAll('.deck-tile')].find(t => t.textContent === 'AAS talk')
    await drag(aas, inside.button('My presentations'))
    expect(inside.onMoveDeck).toHaveBeenCalledWith('d3', null)
    // A folder can't go inside itself, nor somewhere it already is
    await drag(inside.el.querySelector('.folder-tile[aria-label="Open 2026"]'), inside.button('Talks'))
    expect(inside.onUpdateFolder).not.toHaveBeenCalled()
    act(() => inside.root.unmount())
  })

  it('lists presentations without folders when flat', async () => {
    const { el, button, root } = await render({ flat: true, rootName: 'Shared with you', onView: undefined, canEditFolders: false, onNew: undefined })
    expect(el.querySelector('h2').textContent).toBe('Shared with you')
    expect(el.querySelector('.folder-tile')).toBeNull()
    expect(button('New folder')).toBeUndefined()
    expect(button('List')).toBeUndefined()
    expect(el.querySelectorAll('.tile')).toHaveLength(4)
    act(() => root.unmount())
  })
})

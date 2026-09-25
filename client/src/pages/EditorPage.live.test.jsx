// @vitest-environment happy-dom
// The editor editing live (utils/liveDeck.js), with the connection stood in
// for by a real Yjs document the test fills and changes as the server would.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import * as Y from 'yjs'
import { loadDeck, readDeck } from '../utils/deckDoc'

vi.stubEnv('VITE_PARALLAX_MODE', 'cloud')

// The presentation as saved, which the editor fetches first
const saved = { id: 'p1', title: 'Saved title', version: 3, createdAt: '2026-09-01T00:00:00Z', slides: [{ id: 's1', elements: [] }] }

// The live connection: `connection.opts` is what the editor passed, for the
// test to call back as the server would
const connection = { opts: null, disconnect: vi.fn() }
vi.mock('../utils/liveDeck', () => ({
  connectLive: vi.fn(opts => { connection.opts = opts; return { disconnect: connection.disconnect } }),
}))
// Calls the test doesn't set up resolve to nothing
vi.mock('../utils/api', () => ({
  api: new Proxy({}, { get: (api, name) => api[name] ?? (api[name] = vi.fn(async () => null)) }),
  getAuthToken: async () => 'token',
}))
import { api } from '../utils/api'
import EditorPage from './EditorPage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, el, doc
const titleInput = () => el.querySelector('.editor-header .title-input')
const indicator = () => [...el.querySelectorAll('.editor-header .save-indicator')].map(s => s.textContent).join(' ')
async function rename(title) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  await act(async () => { setValue.call(titleInput(), title); titleInput().dispatchEvent(new Event('input', { bubbles: true })) })
}
const later = ms => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

// Opens the editor; with `arrive`, the live document arrives from the server
async function open({ arrive = true } = {}) {
  api.getPresentation.mockImplementation(async () => structuredClone(saved))
  api.getCollaborators.mockResolvedValue({ role: 'owner', you: 'u-me', inviteToken: null, people: [] })
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<EditorPage presentationId="p1" onGoHome={() => {}} />))
  await later(0)
  if (arrive) {
    doc = new Y.Doc()
    loadDeck(doc, { title: 'Live title', slides: [{ id: 's1', elements: [] }, { id: 's2', elements: [] }] })
    await act(async () => { connection.opts.onSynced(doc) })
    await act(async () => { connection.opts.onStatus('connected') })
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]')))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  connection.opts = null
})
afterEach(() => {
  act(() => root.unmount())
  el.remove()
  vi.useRealTimers()
})

describe('the editor, live', () => {
  it('connects to the presentation, and shows the live document rather than what was saved', async () => {
    await open()
    expect(connection.opts.id).toBe('p1')
    expect(await connection.opts.token()).toBe('token')
    expect(titleInput().value).toBe('Live title')
  })

  it('puts edits in the document instead of saving the presentation', async () => {
    await open()
    await rename('Changed here')
    await later(5000)
    expect(readDeck(doc).title).toBe('Changed here')
    expect(api.updatePresentation).not.toHaveBeenCalled()
  })

  it('shows changes that arrive from others', async () => {
    await open()
    await act(async () => { doc.transact(() => doc.getMap('fields').set('title', 'From someone else'), 'server') })
    expect(titleInput().value).toBe('From someone else')
  })

  it('undoes its own edit, and leaves others’ alone', async () => {
    await open()
    await rename('Mine')
    await act(async () => { doc.transact(() => doc.getMap('fields').set('theme', 'white'), 'server') })
    await act(async () => { el.querySelector('button[title="Undo (Ctrl+Z)"]').click() })
    expect(readDeck(doc).title).toBe('Live title')
    expect(readDeck(doc).theme).toBe('white')
  })

  it('says when changes are on their way, saved, or waiting for the connection', async () => {
    await open()
    expect(indicator()).toBe('Saved')
    await act(async () => { connection.opts.onUnsent(2) })
    expect(indicator()).toBe('Saving…')
    await act(async () => { connection.opts.onStatus('disconnected') })
    expect(indicator()).toBe('Reconnecting…')
    await act(async () => { connection.opts.onStatus('connected'); connection.opts.onUnsent(0) })
    expect(indicator()).toBe('Saved')
  })

  it('asks before closing the tab while changes haven’t been sent', async () => {
    await open()
    const closing = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(closing()).toBe(false)
    await act(async () => { connection.opts.onUnsent(1) })
    expect(closing()).toBe(true)
  })

  it('says so when the user is removed, or the presentation deleted', async () => {
    await open()
    await act(async () => { connection.opts.onRefused() })
    expect(el.querySelector('[role="alert"]').textContent).toContain('you were removed as an editor')
    expect(connection.disconnect).toHaveBeenCalled()
  })

  it('saves the usual way when live editing doesn’t connect', async () => {
    await open({ arrive: false })
    expect(titleInput()).toBeNull()
    await later(10000)
    expect(connection.disconnect).toHaveBeenCalled()
    expect(titleInput().value).toBe('Saved title')
    api.updatePresentation.mockResolvedValue({ ...saved, version: 4 })
    await rename('Saved the usual way')
    await later(2000)
    expect(api.updatePresentation).toHaveBeenCalledWith('p1', expect.objectContaining({ title: 'Saved the usual way' }))
  })

  it('saves the usual way when refused before the document arrives', async () => {
    await open({ arrive: false })
    await act(async () => { connection.opts.onRefused() })
    expect(titleInput().value).toBe('Saved title')
    expect(el.querySelector('[role="alert"]')).toBeNull()
  })
})

// @vitest-environment happy-dom
// The editor editing live (utils/liveDeck.js), with the connection stood in
// for by a real Yjs document the test fills and changes as the server would.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import * as Y from 'yjs'
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import { loadDeck, readDeck } from '../utils/deckDoc'

vi.stubEnv('VITE_PARALLAX_MODE', 'cloud')

// The presentation as saved, which the editor fetches first
const saved = { id: 'p1', title: 'Saved title', version: 3, createdAt: '2026-09-01T00:00:00Z', slides: [{ id: 's1', elements: [] }] }

// The live connection: `connection.opts` is what the editor passed, for the
// test to call back as the server would; `connection.awareness` is where
// tabs say what they're doing
const connection = { opts: null, awareness: null, disconnect: vi.fn() }
vi.mock('../utils/liveDeck', () => ({
  connectLive: vi.fn(opts => {
    connection.opts = opts
    return { disconnect: connection.disconnect, get awareness() { return connection.awareness } }
  }),
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

const people = [
  { id: 'u-me', name: 'Me', email: 'me@example.com', role: 'owner' },
  { id: 'u-ada', name: 'Ada', email: 'ada@example.com', role: 'editor' },
]
const text = id => ({ id, type: 'text', x: 100, y: 100, width: 200, height: 60, zIndex: 1, content: `<p>${id}</p>` })

// Another tab, with the client id given, saying what it's doing
function tab(clientId, state) {
  const other = new Y.Doc()
  other.clientID = clientId
  const awareness = new Awareness(other)
  awareness.setLocalState(state)
  return {
    say: next => act(async () => {
      if (next) awareness.setLocalState(next)
      applyAwarenessUpdate(connection.awareness, encodeAwarenessUpdate(awareness, [clientId]), 'remote')
    }),
    leave: () => act(async () => { removeAwarenessStates(connection.awareness, [clientId], 'remote') }),
  }
}
const mine = () => connection.awareness.getLocalState()
const canvasElement = id => el.querySelector(`[data-element-id="${id}"]`)
const doubleClick = node => act(async () => { node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })) })
const status = () => el.querySelector('[role="status"]')?.textContent

// Opens the editor; with `arrive`, the live document arrives from the server
async function open({ arrive = true } = {}) {
  api.getPresentation.mockImplementation(async () => structuredClone(saved))
  api.getCollaborators.mockResolvedValue({ role: 'owner', you: 'u-me', inviteToken: null, people })
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<EditorPage presentationId="p1" onGoHome={() => {}} />))
  await later(0)
  if (arrive) {
    doc = new Y.Doc()
    doc.clientID = 50
    connection.awareness = new Awareness(doc)
    loadDeck(doc, { title: 'Live title', slides: [{ id: 's1', elements: [text('e1'), text('e2')] }, { id: 's2', elements: [] }] })
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

  it('shows who else is here and on which slide, and goes there', async () => {
    await open()
    await tab(10, { user: 'u-ada', slide: 's2', selected: [], editing: null }).say()
    const avatar = el.querySelector('.presence-avatars button')
    expect(avatar.getAttribute('aria-label')).toBe('Ada, slide 2')
    expect(el.querySelector('[role="img"][aria-label="Here: Ada"]')).toBeTruthy()
    await act(async () => { avatar.click() })
    expect(el.querySelectorAll('.slide-item')[1].className).toContain('active')
  })

  it('outlines what others have selected, and says who’s editing', async () => {
    await open()
    const ada = tab(10, { user: 'u-ada', slide: 's1', selected: ['e1'], editing: null })
    await ada.say()
    expect(canvasElement('e1').textContent).toContain('Ada')
    await ada.say({ user: 'u-ada', slide: 's1', selected: ['e1'], editing: 'e1' })
    expect(canvasElement('e1').textContent).toContain('Ada is editing')
    await ada.leave()
    expect(canvasElement('e1').textContent).not.toContain('Ada')
    expect(el.querySelector('.presence-avatars')).toBeNull()
  })

  it('tells the others where this tab is and what it has open', async () => {
    await open()
    await act(async () => { canvasElement('e2').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(mine()).toEqual({ user: 'u-me', slide: 's1', selected: ['e2'], editing: null })
    await doubleClick(canvasElement('e2'))
    expect(mine().editing).toBe('e2')
    // and doesn't take itself for someone else
    expect(canvasElement('e2').textContent).not.toContain('other tab')
    expect(el.querySelector('.presence-avatars')).toBeNull()
  })

  it('won’t open a text box someone else is typing in, or delete it', async () => {
    await open()
    await tab(10, { user: 'u-ada', slide: 's1', selected: ['e1'], editing: 'e1' }).say()
    await doubleClick(canvasElement('e1'))
    expect(mine().editing).toBeNull()
    expect(status()).toBe('Ada is editing this')

    await act(async () => { canvasElement('e1').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })) })
    expect(canvasElement('e1')).toBeTruthy()
    expect(readDeck(doc).slides[0].elements.map(e => e.id)).toEqual(['e1', 'e2'])
    expect(status()).toBe('Ada is editing this, so it wasn’t deleted')
  })

  it('lets go of a text box another tab opened at the same moment, if that tab came first', async () => {
    await open()
    await doubleClick(canvasElement('e1'))
    expect(mine().editing).toBe('e1')
    // a tab with a higher client id gives way to this one
    await tab(90, { user: 'u-ada', slide: 's1', selected: ['e1'], editing: 'e1' }).say()
    expect(mine().editing).toBe('e1')
    // a lower one keeps it
    await tab(10, { user: 'u-ada', slide: 's1', selected: ['e1'], editing: 'e1' }).say()
    expect(mine().editing).toBeNull()
    expect(status()).toBe('Ada started editing this at the same moment')
  })

  // A change the server sends: someone else's, to the slide order
  const reorderRemotely = ids => act(async () => {
    doc.transact(() => {
      const order = doc.getArray('slideOrder')
      order.delete(0, order.length)
      order.insert(0, ids)
    }, 'server')
  })
  const deleteSlideRemotely = id => act(async () => {
    doc.transact(() => {
      const order = doc.getArray('slideOrder')
      order.delete(order.toArray().indexOf(id), 1)
      doc.getMap('slides').delete(id)
    }, 'server')
  })
  const activeSlide = () => [...el.querySelectorAll('.slide-item')].findIndex(item => item.className.includes('active'))

  it('keeps showing the same slide when someone else moves it', async () => {
    await open()
    expect(activeSlide()).toBe(0)
    await reorderRemotely(['s2', 's1'])
    expect(activeSlide()).toBe(1)
    expect(canvasElement('e1')).toBeTruthy()
    expect(mine().slide).toBe('s1')
  })

  it('shows the slide now in its place when someone else deletes it', async () => {
    await open()
    await act(async () => { el.querySelectorAll('.slide-item')[1].click() })
    expect(activeSlide()).toBe(1)
    await deleteSlideRemotely('s2')
    expect(activeSlide()).toBe(0)
    expect(canvasElement('e1')).toBeTruthy()
  })

  it('stops editing a text box someone else deleted', async () => {
    await open()
    await doubleClick(canvasElement('e1'))
    expect(mine().editing).toBe('e1')
    await act(async () => {
      doc.transact(() => {
        const slide = doc.getMap('slides').get('s1')
        const order = slide.get('elementOrder')
        order.delete(order.toArray().indexOf('e1'), 1)
        slide.get('elements').delete('e1')
      }, 'server')
    })
    expect(mine().editing).toBeNull()
  })

  it('won’t delete a slide someone else has something open on', async () => {
    await open()
    await tab(10, { user: 'u-ada', slide: 's1', selected: ['e2'], editing: 'e2' }).say()
    window.confirm = () => true
    const remove = el.querySelectorAll('.slide-item')[0].querySelector('button[title="Delete"]')
    await act(async () => { remove.click() })
    expect(readDeck(doc).slides.map(s => s.id)).toEqual(['s1', 's2'])
    expect(status()).toBe('Ada is editing something on this slide, so it wasn’t deleted')
  })

  it('saves the usual way when refused before the document arrives', async () => {
    await open({ arrive: false })
    await act(async () => { connection.opts.onRefused() })
    expect(titleInput().value).toBe('Saved title')
    expect(el.querySelector('[role="alert"]')).toBeNull()
  })
})

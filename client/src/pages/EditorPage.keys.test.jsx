// @vitest-environment happy-dom
// The editor's keys and clipboard: a new slide with Ctrl+M, text pasted from
// another app, and Ctrl+A
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.hoisted(() => vi.stubEnv('VITE_PARALLAX_MODE', 'cloud'))

const saved = { id: 'p1', title: 'Talk', version: 1, slides: [
  { id: 's1', layout: 'title', elements: [{ id: 'a', type: 'text', x: 10, y: 10, width: 200, height: 60, zIndex: 1, content: '<h2>Hello</h2>' }, { id: 'b', type: 'shape', shape: 'rect', x: 300, y: 300, width: 50, height: 50, zIndex: 2 }] },
  { id: 's2', elements: [] },
] }

vi.mock('../utils/api', () => ({
  api: new Proxy({}, { get: (api, name) => api[name] ?? (api[name] = vi.fn(async () => null)) }),
  getAuthToken: async () => 'token',
}))
vi.mock('../utils/liveDeck', () => ({
  connectLive: vi.fn(({ onRefused }) => { queueMicrotask(onRefused); return { disconnect: () => {} } }),
}))
import { api } from '../utils/api'
import EditorPage from './EditorPage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, el
async function open() {
  api.getPresentation.mockImplementation(async () => structuredClone(saved))
  api.getCollaborators.mockResolvedValue({ role: 'owner', you: 'u-me', inviteToken: null, people: [] })
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<EditorPage presentationId="p1" onGoHome={() => {}} />))
  await act(async () => { await vi.runOnlyPendingTimersAsync() })
}
const press = async (key, extra = {}) => act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra })))
const thumbs = () => [...el.querySelectorAll('.slide-item')].map(d => d.classList.contains('active'))
const onCanvas = () => [...el.querySelectorAll('.slide-canvas [data-element-id]')]

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]')))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  act(() => root.unmount())
  el.remove()
  vi.useRealTimers()
})

describe('keys on the slide', () => {
  it('adds a title-and-content slide right after a title slide with Ctrl+M', async () => {
    await open()
    expect(thumbs()).toEqual([true, false])
    await press('m', { ctrlKey: true })
    expect(thumbs()).toEqual([false, true, false])
    // Its placeholders, empty, showing their hints
    expect(onCanvas().map(d => d.textContent)).toEqual(['Click to add title', 'Click to add text'])
  })

  it('pastes text from another app as a text box', async () => {
    await open()
    const paste = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(paste, 'clipboardData', { value: { getData: type => (type === 'text/plain' ? 'From elsewhere' : ''), files: [] } })
    await act(async () => document.dispatchEvent(paste))
    expect(paste.defaultPrevented).toBe(true)
    expect(onCanvas().map(d => d.textContent)).toEqual(['Hello', '', 'From elsewhere'])
  })

  it('selects everything on the slide with Ctrl+A', async () => {
    await open()
    await press('a', { ctrlKey: true })
    expect(onCanvas().every(d => d.style.outline.includes('solid'))).toBe(true)
  })

  it('searches the menus with Alt+/, and runs the command found', async () => {
    await open()
    await press('/', { altKey: true, code: 'Slash' })
    const input = document.querySelector('input[aria-label="Search the menus"]')
    expect(input).toBeTruthy()
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'new slide')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(document.querySelector('[role=option]').textContent).toMatch(/^New slideSlide(Ctrl\+M|⌘M)$/)
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(thumbs()).toEqual([false, true, false])
    expect(document.querySelector('input[aria-label="Search the menus"]')).toBeNull()
  })

  it('writes speaker notes in the strip under the slide', async () => {
    await open()
    await act(async () => el.querySelector('.notes-strip-empty').click())
    const notes = el.querySelector('textarea[aria-label="Speaker notes for slide 1"]')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(notes, 'Welcome everyone')
      notes.dispatchEvent(new Event('input', { bubbles: true }))
    })
    // To slide 2, which has none, and back
    await act(async () => el.querySelectorAll('.slide-item')[1].click())
    expect(el.querySelector('.notes-strip-empty')).toBeTruthy()
    await act(async () => el.querySelectorAll('.slide-item')[0].click())
    expect(el.querySelector('textarea[aria-label="Speaker notes for slide 1"]').value).toBe('Welcome everyone')
  })
})

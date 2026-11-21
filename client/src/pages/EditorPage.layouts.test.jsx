// @vitest-environment happy-dom
// Placeholders, Change layout and themes in the editor
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.hoisted(() => vi.stubEnv('VITE_PARALLAX_MODE', 'cloud'))

const saved = { id: 'p1', title: 'Talk', theme: 'black', version: 1, slides: [
  { id: 's1', layout: 'title', background: { type: 'color', color: '#1e1e2e' }, elements: [
    { id: 't', type: 'text', placeholder: 'title', sizeMode: 'shrink', x: 60, y: 150, width: 840, height: 120, zIndex: 1, content: '<h2 style="text-align:center">Dark matter</h2>' },
    { id: 'u', type: 'text', placeholder: 'subtitle', sizeMode: 'shrink', x: 120, y: 282, width: 720, height: 80, zIndex: 2, content: '<p style="text-align:center"></p>' },
  ] },
  { id: 's2', background: { type: 'color', color: '#ff0000' }, elements: [] },
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
const onCanvas = () => [...el.querySelectorAll('.slide-canvas [data-element-id]')]
async function pick(menu, ...path) {
  const title = [...el.querySelectorAll('.menu-bar .menu-title')].find(b => b.textContent === menu)
  await act(async () => title.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
  for (const label of path) {
    const row = [...el.querySelectorAll('.menu-dropdown [role^=menuitem]')].find(b => b.querySelector('.menu-label').textContent.replace(/^[✓•]/, '').trim() === label)
    await act(async () => row.click())
  }
}

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

describe('placeholders and layouts', () => {
  it('shows an empty placeholder’s hint, and moves the title into another layout', async () => {
    await open()
    expect(onCanvas().map(d => d.textContent)).toEqual(['Dark matter', 'Click to add subtitle'])
    await pick('Slide', 'Change layout', 'Two Column')
    // The title moved; the empty subtitle went; two empty bodies wait
    expect(onCanvas().map(d => d.textContent)).toEqual(['Dark matter', 'Click to add text', 'Click to add text'])
    expect(onCanvas()[0].style.left).toBe('40px')
  })

  it('applies a theme from the Theme panel, and slides on the old default take its page', async () => {
    await open()
    const canvas = () => el.querySelector('.slide-canvas')
    expect(canvas().style.backgroundColor).toMatch(/#1e1e2e|rgb\(30, 30, 46\)/)
    await act(async () => el.querySelector('.toolbar button[aria-label="Theme"]').click())
    expect(el.querySelector('aside[aria-label="Themes"]')).toBeTruthy()
    expect(el.querySelector('[role=tablist][aria-label="Inspector"]')).toBeNull()
    await act(async () => [...el.querySelectorAll('aside [role=radio]')].find(r => r.textContent.endsWith('White')).click())
    expect(canvas().style.backgroundColor).toMatch(/#ffffff|rgb\(255, 255, 255\)/)
    expect(canvas().style.getPropertyValue('--slide-heading')).toBe('#222222')
    // A background of its own stays
    await act(async () => el.querySelectorAll('.slide-item')[1].click())
    expect(canvas().style.backgroundColor).toMatch(/#ff0000|rgb\(255, 0, 0\)/)
  })
})

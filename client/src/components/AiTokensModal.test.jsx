// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: {
    getAiTokens: vi.fn(),
    createAiToken: vi.fn(),
    revokeAiToken: vi.fn(async () => ({ success: true })),
    allowAiApp: vi.fn(async () => ({ success: true })),
  },
}))
import { api } from '../utils/api'
import AiTokensModal from './AiTokensModal'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const day = 864e5
const server = 'https://parallax-presentations.com/mcp'
const secret = 'plx_pat_' + 'a'.repeat(48) + 'q7xz'
const code = { id: 't1', name: 'Claude Code', hint: 'q7xz', scopes: ['decks:read', 'decks:write'], expired: false, expiresAt: new Date(Date.now() + 90 * day).toISOString(), lastUsedAt: null }
const reader = { id: 't2', name: 'Reader', hint: 'Zz12', scopes: ['decks:read'], expired: false, expiresAt: new Date(Date.now() + 30 * day).toISOString(), lastUsedAt: new Date(Date.now() - 5 * 60e3).toISOString() }

async function render() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const onClose = vi.fn()
  await act(async () => root.render(<AiTokensModal onClose={onClose} />))
  const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.getAttribute('aria-label') === text)
  return { el, root, onClose, button }
}
const click = async b => { await act(async () => { b.click() }) }
const type = async (input, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const nameBox = el => el.querySelector('input[placeholder="Lab scripts"]')
const rows = el => [...el.querySelectorAll('li')].map(li => li.textContent)

beforeEach(() => {
  vi.clearAllMocks()
  window.confirm = () => true
})

describe('the AI access dialog', () => {
  it('lists the tokens, with what they may do and when they were used', async () => {
    api.getAiTokens.mockResolvedValue({ tokens: [code, reader], server })
    const { el, root } = await render()
    const [a, b] = rows(el)
    expect(a).toContain('Claude Code')
    expect(a).toContain('…q7xz')
    expect(a).not.toContain('reads only')
    expect(a).toContain('not used yet')
    expect(b).toContain('reads only')
    expect(b).toContain('used 5 min ago')
    expect(el.textContent).toContain(`Agents send tokens to ${server}`)
    act(() => root.unmount())
  })

  it('makes a named token and shows it once, with how to send it', async () => {
    api.getAiTokens.mockResolvedValueOnce({ tokens: [], server }).mockResolvedValueOnce({ tokens: [code], server })
    api.createAiToken.mockResolvedValue({ ...code, secret, server })
    const { el, button, root } = await render()
    expect(el.textContent).toContain('None yet.')
    expect(button('Make token').disabled).toBe(true)
    await type(nameBox(el), 'Claude Code')
    await click(button('Make token'))
    expect(api.createAiToken).toHaveBeenCalledWith({ name: 'Claude Code', days: 90, scopes: ['decks:read', 'decks:write'] })
    expect(el.querySelector('input[aria-label="AI access token"]').value).toBe(secret)
    expect(el.textContent).toContain(`Send it to ${server} in the header`)
    expect(el.textContent).toContain(`--header "Authorization: Bearer ${secret}"`)
    expect(el.textContent).not.toContain('/plugin configure')
    act(() => root.unmount())
  })

  it('makes a read-only token, and names the server off the main site', async () => {
    const dev = 'https://dev.parallax-presentations.com/mcp'
    api.getAiTokens.mockResolvedValue({ tokens: [], server: dev })
    api.createAiToken.mockResolvedValue({ ...reader, secret, server: dev })
    const { el, button, root } = await render()
    const box = el.querySelector('input[type="checkbox"]')
    await act(async () => { box.click() })
    await type(nameBox(el), 'Reader')
    await click(button('Make token'))
    expect(api.createAiToken).toHaveBeenCalledWith({ name: 'Reader', days: 90, scopes: ['decks:read'] })
    expect(el.textContent).toContain(`Send it to ${dev} in the header`)
    act(() => root.unmount())
  })

  it('lists the apps that signed in, to turn off and allow again', async () => {
    const claude = { id: 'a1', name: 'Claude', host: 'claude.ai', off: false, lastUsedAt: new Date(Date.now() - 2 * 60e3).toISOString() }
    api.getAiTokens
      .mockResolvedValueOnce({ tokens: [], apps: [claude], server, signIn: true })
      .mockResolvedValueOnce({ tokens: [], apps: [{ ...claude, off: true }], server, signIn: true })
      .mockResolvedValueOnce({ tokens: [], apps: [claude], server, signIn: true })
    const { el, button, root } = await render()
    expect(el.textContent).toContain('add the marketplace jbirky/parallax-agent in claude.ai or Claude Code')
    expect(el.textContent).toContain(`${server} added as a connector`)
    expect(rows(el).find(r => r.includes('Claude'))).toContain('used 2 min ago')
    await click(button('Turn off Claude'))
    expect(api.revokeAiToken).toHaveBeenCalledWith('a1')
    expect(rows(el).find(r => r.includes('Claude'))).toContain('Turned off')
    await click(button('Allow again'))
    expect(api.allowAiApp).toHaveBeenCalledWith('a1')
    expect(rows(el).find(r => r.includes('Claude'))).toContain('Signed in')
    act(() => root.unmount())
  })

  it('leaves the plugin out off the main site, where it doesn\'t connect', async () => {
    const dev = 'https://dev.parallax-presentations.com/mcp'
    api.getAiTokens.mockResolvedValue({ tokens: [], apps: [], server: dev, signIn: true })
    const { el, root } = await render()
    expect(el.textContent).toContain(`${dev} added as a connector`)
    expect(el.textContent).not.toContain('Parallax plugin')
    act(() => root.unmount())
  })

  it('says nothing of apps where none can sign in', async () => {
    api.getAiTokens.mockResolvedValue({ tokens: [], apps: [], server, signIn: false })
    const { el, root } = await render()
    expect(el.textContent).not.toContain('Connected apps')
    act(() => root.unmount())
  })

  it('revokes a token', async () => {
    api.getAiTokens.mockResolvedValueOnce({ tokens: [code], server }).mockResolvedValueOnce({ tokens: [], server })
    const { el, button, root } = await render()
    await click(button('Revoke Claude Code'))
    expect(api.revokeAiToken).toHaveBeenCalledWith('t1')
    expect(el.textContent).toContain('None yet.')
    act(() => root.unmount())
  })
})

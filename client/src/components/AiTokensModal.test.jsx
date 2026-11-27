// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: {
    getAiTokens: vi.fn(),
    createAiToken: vi.fn(),
    revokeAiToken: vi.fn(async () => ({ success: true })),
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

  it('makes a token and shows it once, with how to give it to Claude Code', async () => {
    api.getAiTokens.mockResolvedValueOnce({ tokens: [], server }).mockResolvedValueOnce({ tokens: [code], server })
    api.createAiToken.mockResolvedValue({ ...code, secret, server })
    const { el, button, root } = await render()
    expect(el.textContent).toContain('None yet.')
    await click(button('Make token'))
    expect(api.createAiToken).toHaveBeenCalledWith({ name: 'Claude Code', days: 90, scopes: ['decks:read', 'decks:write'] })
    expect(el.querySelector('input[aria-label="AI access token"]').value).toBe(secret)
    expect(el.textContent).toContain(`export PARALLAX_TOKEN=${secret}`)
    expect(el.textContent).not.toContain('PARALLAX_URL')
    expect(el.textContent).toContain('/plugin install parallax@parallax-agent')
    expect(el.textContent).toContain(`--header "Authorization: Bearer ${secret}"`)
    act(() => root.unmount())
  })

  it('makes a read-only token, and names the server off the main site', async () => {
    const dev = 'https://dev.parallax-presentations.com/mcp'
    api.getAiTokens.mockResolvedValue({ tokens: [], server: dev })
    api.createAiToken.mockResolvedValue({ ...reader, secret, server: dev })
    const { el, button, root } = await render()
    const box = el.querySelector('input[type="checkbox"]')
    await act(async () => { box.click() })
    await click(button('Make token'))
    expect(api.createAiToken).toHaveBeenCalledWith({ name: 'Claude Code', days: 90, scopes: ['decks:read'] })
    expect(el.textContent).toContain('export PARALLAX_URL=https://dev.parallax-presentations.com')
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

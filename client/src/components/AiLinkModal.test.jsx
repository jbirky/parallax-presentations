// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: {
    getAiLinks: vi.fn(),
    createAiLink: vi.fn(),
    renewAiLink: vi.fn(async () => ({})),
    revokeAiLink: vi.fn(async () => ({ success: true })),
  },
}))
import { api } from '../utils/api'
import AiLinkModal, { linkStatus } from './AiLinkModal'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const day = 864e5
const url = 'https://parallax-presentations.com/mcp/plx_' + 'x'.repeat(39) + 'Ab3Z'
const claude = { id: 'l1', name: 'Claude', hint: 'Ab3Z', expired: false, expiresAt: new Date(Date.now() + 30 * day).toISOString(), lastUsedAt: null }
const old = { id: 'l2', name: 'ChatGPT', hint: 'Qq9w', expired: true, expiresAt: new Date(Date.now() - day).toISOString(), lastUsedAt: new Date(Date.now() - 3 * 3600e3).toISOString() }

async function render() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const onClose = vi.fn()
  await act(async () => root.render(<AiLinkModal presentationId="p1" onClose={onClose} />))
  const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.getAttribute('aria-label') === text)
  return { el, root, onClose, button }
}
const click = async b => { await act(async () => { b.click() }) }
const rows = el => [...el.querySelectorAll('li')].map(li => li.textContent)

beforeEach(() => {
  vi.clearAllMocks()
  window.confirm = () => true
})

describe('the AI collaborator links dialog', () => {
  it('lists the links, with when they expire and were last used', async () => {
    api.getAiLinks.mockResolvedValue({ links: [claude, old] })
    const { el, root } = await render()
    expect(api.getAiLinks).toHaveBeenCalledWith('p1')
    const [a, b] = rows(el)
    expect(a).toContain('Claude')
    expect(a).toContain('…Ab3Z')
    expect(a).toContain('not used yet')
    expect(b).toContain('Expired')
    expect(b).toContain('used 3 h ago')
    expect(linkStatus({ expiresAt: null, expired: false, lastUsedAt: null })).toBe('Never expires · not used yet')
    act(() => root.unmount())
  })

  it('makes a link with a name and lifetime, and shows it once with where to add it', async () => {
    api.getAiLinks.mockResolvedValueOnce({ links: [] }).mockResolvedValueOnce({ links: [claude] })
    api.createAiLink.mockResolvedValue({ ...claude, url })
    const { el, button, root } = await render()
    expect(el.textContent).toContain('None yet.')
    const name = el.querySelector('input[placeholder="Claude"]')
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    await act(async () => { setValue.call(name, 'Claude Desktop'); name.dispatchEvent(new Event('input', { bubbles: true })) })
    const lasts = el.querySelector('select')
    await act(async () => { lasts.value = 'never'; lasts.dispatchEvent(new Event('change', { bubbles: true })) })
    await click(button('Make link'))
    expect(api.createAiLink).toHaveBeenCalledWith('p1', { name: 'Claude Desktop', days: null })
    expect(el.querySelector('input[aria-label="AI collaborator link"]').value).toBe(url)
    expect(el.textContent).toContain("It won't be shown again")
    expect(el.textContent).toContain(`claude mcp add --transport http parallax ${url}`)
    expect(el.textContent).toContain('Add custom connector')
    // Once it's put away, the link isn't shown again
    await click(button('Make another link'))
    expect(el.querySelector('input[aria-label="AI collaborator link"]')).toBeNull()
    expect(el.textContent).not.toContain(url)
    act(() => root.unmount())
  })

  it('renews and revokes links', async () => {
    api.getAiLinks.mockResolvedValue({ links: [claude, old] })
    const { button, root } = await render()
    await click(button('Renew ChatGPT'))
    expect(api.renewAiLink).toHaveBeenCalledWith('p1', 'l2', 30)
    await click(button('Revoke Claude'))
    expect(api.revokeAiLink).toHaveBeenCalledWith('p1', 'l1')
    expect(api.getAiLinks).toHaveBeenCalledTimes(3)
    act(() => root.unmount())
  })

  it('says what went wrong', async () => {
    api.getAiLinks.mockResolvedValue({ links: [] })
    api.createAiLink.mockRejectedValue(new Error('A presentation can have 10 AI collaborator links. Revoke one first.'))
    const { el, button, root } = await render()
    await click(button('Make link'))
    expect(el.querySelector('[role=alert]').textContent).toContain('Revoke one first')
    act(() => root.unmount())
  })
})

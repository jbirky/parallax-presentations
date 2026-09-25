// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: { getInvite: vi.fn(), acceptInvite: vi.fn() },
}))
import { api } from '../utils/api'
import InvitePage from './InvitePage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function render() {
  const el = document.createElement('div')
  const root = createRoot(el)
  const onOpen = vi.fn()
  await act(async () => root.render(<InvitePage token="tok" onOpen={onOpen} />))
  const button = text => [...el.querySelectorAll('button')].find(b => b.textContent === text)
  return { el, root, onOpen, button }
}

beforeEach(() => vi.clearAllMocks())

describe('opening an invite link', () => {
  it('says whose presentation it is, and opens it once accepted', async () => {
    api.getInvite.mockResolvedValue({ id: 'p1', title: 'Group talk', ownerName: 'Ada', joined: false })
    api.acceptInvite.mockResolvedValue({ id: 'p1', title: 'Group talk', role: 'editor' })
    const { el, onOpen, button, root } = await render()
    expect(el.querySelector('h1').textContent).toBe('Ada invited you to edit “Group talk”')
    await act(async () => { button('Accept and open').click() })
    expect(api.acceptInvite).toHaveBeenCalledWith('tok')
    expect(onOpen).toHaveBeenCalledWith('p1', 'Group talk')
    act(() => root.unmount())
  })

  it('just opens a presentation they can already edit', async () => {
    api.getInvite.mockResolvedValue({ id: 'p1', title: 'Group talk', ownerName: 'Ada', joined: true })
    const { el, button, root } = await render()
    expect(el.querySelector('h1').textContent).toBe('You can already edit “Group talk”')
    expect(button('Open presentation')).toBeTruthy()
    act(() => root.unmount())
  })

  it('explains a link that no longer works', async () => {
    api.getInvite.mockRejectedValue(new Error('This invite link has been turned off or replaced.'))
    const { el, button, root } = await render()
    expect(el.querySelector('[role="alert"]').textContent).toBe('This invite link has been turned off or replaced.')
    expect(button('Go to your presentations')).toBeTruthy()
    act(() => root.unmount())
  })
})

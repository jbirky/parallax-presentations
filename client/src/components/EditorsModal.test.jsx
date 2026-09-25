// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: {
    getCollaborators: vi.fn(),
    turnOnInvite: vi.fn(async () => ({ inviteToken: 'new' })),
    turnOffInvite: vi.fn(async () => ({ inviteToken: null })),
    removeCollaborator: vi.fn(async () => ({ success: true })),
  },
}))
import { api } from '../utils/api'
import EditorsModal, { inviteUrl } from './EditorsModal'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const ownerPerson = { id: 'u-owner', name: 'Ada Owner', email: 'ada@example.com', role: 'owner' }
const editorPerson = { id: 'u-ed', name: '', email: 'ed@example.com', role: 'editor' }
const token = '5f0c6b9e-4a1d-4c8e-9b7a-2d3e4f5a6b7c'

function render(props) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const onChange = vi.fn(), onClose = vi.fn(), onLeft = vi.fn()
  act(() => root.render(<EditorsModal presentationId="p1" onChange={onChange} onClose={onClose} onLeft={onLeft} {...props} />))
  const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.includes(text) || b.getAttribute('aria-label') === text)
  return { el, root, onChange, onClose, onLeft, button }
}
const click = async b => { await act(async () => { b.click() }) }

beforeEach(() => {
  vi.clearAllMocks()
  window.confirm = () => true
})

describe('the Editors dialog', () => {
  it('shows the owner the invite link, and everyone who edits', () => {
    const { el, button, root } = render({ access: { role: 'owner', you: 'u-owner', inviteToken: token, people: [ownerPerson, editorPerson] } })
    expect(el.querySelector('input[aria-label="Invite link"]').value).toBe(inviteUrl(token))
    expect(inviteUrl(token)).toMatch(new RegExp(`/invite/${token}$`))
    const rows = [...el.querySelectorAll('li')].map(li => li.textContent)
    expect(rows[0]).toContain('Ada Owner (you)')
    expect(rows[1]).toContain('ed@example.com')
    // the owner can remove an editor, but not themselves; no Leave
    expect(button('Remove ed@example.com')).toBeTruthy()
    expect(button('Remove Ada Owner')).toBeUndefined()
    expect(button('Leave presentation')).toBeUndefined()
    act(() => root.unmount())
  })

  it('lets the owner turn the link on, make a new one, and turn it off', async () => {
    const off = { role: 'owner', you: 'u-owner', inviteToken: null, people: [ownerPerson] }
    api.getCollaborators.mockResolvedValue({ ...off, inviteToken: token })
    const { el, button, onChange, root } = render({ access: off })
    expect(el.textContent).toContain('No one else edits this presentation yet.')
    await click(button('Turn on invite link'))
    expect(api.turnOnInvite).toHaveBeenCalledWith('p1')
    expect(onChange).toHaveBeenCalledWith({ ...off, inviteToken: token })
    act(() => root.unmount())

    const on = render({ access: { ...off, inviteToken: token } })
    await click(on.button('New link'))
    expect(api.turnOnInvite).toHaveBeenCalledTimes(2)
    await click(on.button('Turn off link'))
    expect(api.turnOffInvite).toHaveBeenCalledWith('p1')
    act(() => on.root.unmount())
  })

  it('removes an editor once the owner confirms', async () => {
    api.getCollaborators.mockResolvedValue({ role: 'owner', you: 'u-owner', inviteToken: null, people: [ownerPerson] })
    const { button, root } = render({ access: { role: 'owner', you: 'u-owner', inviteToken: null, people: [ownerPerson, editorPerson] } })
    window.confirm = () => false
    await click(button('Remove ed@example.com'))
    expect(api.removeCollaborator).not.toHaveBeenCalled()
    window.confirm = () => true
    await click(button('Remove ed@example.com'))
    expect(api.removeCollaborator).toHaveBeenCalledWith('p1', 'u-ed')
    act(() => root.unmount())
  })

  it('shows an editor whose it is, without the link, and lets them leave', async () => {
    const { el, button, onLeft, root } = render({ access: { role: 'editor', you: 'u-ed', inviteToken: null, people: [ownerPerson, editorPerson] } })
    expect(el.textContent).toContain('Ada Owner owns this presentation.')
    expect(el.querySelector('input[aria-label="Invite link"]')).toBeNull()
    expect(button('Turn on invite link')).toBeUndefined()
    expect(button('Remove Ada Owner')).toBeUndefined()
    expect([...el.querySelectorAll('li')][1].textContent).toContain('ed@example.com (you)')
    await click(button('Leave presentation'))
    expect(api.removeCollaborator).toHaveBeenCalledWith('p1', 'u-ed')
    expect(onLeft).toHaveBeenCalled()
    act(() => root.unmount())
  })

  it('says why a change didn’t go through', async () => {
    api.turnOffInvite.mockRejectedValueOnce(new Error('Only the owner can do this'))
    const { el, button, root } = render({ access: { role: 'owner', you: 'u-owner', inviteToken: token, people: [ownerPerson] } })
    await click(button('Turn off link'))
    expect(el.querySelector('[role="alert"]').textContent).toBe('Only the owner can do this')
    act(() => root.unmount())
  })
})

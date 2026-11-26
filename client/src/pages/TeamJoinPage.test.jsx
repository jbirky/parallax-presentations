// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: { getTeamInvite: vi.fn(), acceptTeamInvite: vi.fn() },
}))
import { api } from '../utils/api'
import TeamJoinPage from './TeamJoinPage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function render() {
  const el = document.createElement('div')
  const root = createRoot(el)
  await act(async () => root.render(<TeamJoinPage token="tok" />))
  const button = text => [...el.querySelectorAll('button')].find(b => b.textContent === text)
  return { el, root, button }
}

const offer = extra => ({ teamId: 't1', teamName: 'Exoplanet lab', role: 'member', invitedBy: 'Ada', joined: false, yourRole: null, seatsFull: false, wrongEmail: null, ...extra })

beforeEach(() => {
  vi.clearAllMocks()
  delete window.location
  window.location = { href: '' }
})

describe('opening a team invite link', () => {
  it('says which team and role, and joins it', async () => {
    api.getTeamInvite.mockResolvedValue(offer())
    api.acceptTeamInvite.mockResolvedValue({ teamId: 't1', teamName: 'Exoplanet lab', role: 'member' })
    const { el, button, root } = await render()
    expect(el.querySelector('h1').textContent).toBe('Ada invited you to join Exoplanet lab as a member')
    expect(el.textContent).toContain('You’ll take one of the team’s seats.')
    await act(async () => { button('Join the team').click() })
    expect(api.acceptTeamInvite).toHaveBeenCalledWith('tok')
    expect(window.location.href).toBe('/dashboard?team=t1')
    act(() => root.unmount())
  })

  it('opens the team for someone already in it', async () => {
    api.getTeamInvite.mockResolvedValue(offer({ joined: true, yourRole: 'owner' }))
    const { el, button, root } = await render()
    expect(el.querySelector('h1').textContent).toBe('You’re already in Exoplanet lab, as an owner.')
    await act(async () => { button('Open the team').click() })
    expect(window.location.href).toBe('/dashboard?team=t1')
    act(() => root.unmount())
  })

  it('says why it can\'t be accepted when the seats are full or the address is wrong', async () => {
    api.getTeamInvite.mockResolvedValue(offer({ seatsFull: true }))
    let page = await render()
    expect(page.el.querySelector('[role="alert"]').textContent).toContain('Every seat in Exoplanet lab is taken')
    expect(page.button('Join the team')).toBeUndefined()
    act(() => page.root.unmount())

    api.getTeamInvite.mockResolvedValue(offer({ role: 'viewer', wrongEmail: 'This invite is for a…@example.com. Sign in with that address to accept it.' }))
    page = await render()
    expect(page.el.querySelector('h1').textContent).toBe('Ada invited you to join Exoplanet lab as a viewer')
    expect(page.el.querySelector('[role="alert"]').textContent).toContain('Sign in with that address')
    expect(page.button('Join the team')).toBeUndefined()
    act(() => page.root.unmount())
  })

  it('shows why a link doesn\'t work', async () => {
    api.getTeamInvite.mockRejectedValue(new Error('This invite link has expired or been revoked.'))
    const { el, root } = await render()
    expect(el.querySelector('[role="alert"]').textContent).toBe('This invite link has expired or been revoked.')
    act(() => root.unmount())
  })
})

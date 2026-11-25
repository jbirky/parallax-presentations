// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: {
    getTeam: vi.fn(),
    renameTeam: vi.fn(async (id, name) => ({ name })),
    createTeamInvite: vi.fn(async () => ({ token: 'T'.repeat(43), invite: {} })),
    revokeTeamInvite: vi.fn(async () => ({ success: true })),
    setTeamRole: vi.fn(async (id, userId, role) => ({ role })),
    removeTeamMember: vi.fn(async () => ({ success: true })),
    transferTeam: vi.fn(async () => ({ success: true })),
  },
}))
import { api } from '../utils/api'
import TeamsModal, { teamJoinUrl } from './TeamsModal'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const people = {
  owner: { id: 'u-owner', name: 'Ada Owner', email: 'ada@example.com', role: 'owner' },
  admin: { id: 'u-admin', name: 'Bo Admin', email: 'bo@example.com', role: 'admin' },
  member: { id: 'u-member', name: 'Cy Member', email: 'c…@example.com', role: 'member' },
  viewer: { id: 'u-viewer', name: 'Di Viewer', email: 'd…@example.com', role: 'viewer' },
}
const lab = { id: 't1', name: 'Exoplanet lab', role: 'owner', memberCount: 4 }
const team = (role, you, extra = {}) => ({
  id: 't1', name: 'Exoplanet lab', plan: 'team', seats: 4, seatsUsed: 3, status: 'active', role, you,
  members: Object.values(people),
  ...(['owner', 'admin'].includes(role) && { invites: [{ id: 'i1', role: 'member', email: null, hint: 'abcd', expiresAt: null }] }),
  ...extra,
})

async function render(props) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const onChange = vi.fn(), onClose = vi.fn()
  await act(async () => root.render(<TeamsModal teams={[lab]} onChange={onChange} onClose={onClose} {...props} />))
  const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.getAttribute('aria-label') === text)
  return { el, root, onChange, onClose, button }
}
const click = async b => { await act(async () => { b.click() }) }

beforeEach(() => {
  vi.clearAllMocks()
  window.confirm = () => true
})

describe('the Teams dialog', () => {
  it('opens the only team, and shows its owner every control', async () => {
    api.getTeam.mockResolvedValue(team('owner', 'u-owner'))
    const { el, button, root } = await render()
    expect(api.getTeam).toHaveBeenCalledWith('t1')
    expect(el.querySelector('input[aria-label="Team name"]').value).toBe('Exoplanet lab')
    expect(el.textContent).toContain('3 of 4 seats used. You’re an owner.')
    // Roles can be changed for everyone but the owner
    expect(el.querySelector('select[aria-label="Role of Ada Owner"]')).toBeNull()
    expect(el.querySelector('select[aria-label="Role of Cy Member"]').value).toBe('member')
    expect(button('Remove Bo Admin')).toBeTruthy()
    expect(button('Remove Ada Owner')).toBeUndefined()
    // Only admins can be handed the team
    expect(button('Hand the team to Bo Admin')).toBeTruthy()
    expect(button('Hand the team to Cy Member')).toBeUndefined()
    expect(el.textContent).toContain('Member link …abcd · anyone with it · never expires')
    expect(button('Leave team')).toBeUndefined()
    act(() => root.unmount())
  })

  it('shows a member the team without changing it', async () => {
    api.getTeam.mockResolvedValue(team('member', 'u-member'))
    const { el, button, root } = await render({ teams: [{ ...lab, role: 'member' }] })
    expect(el.querySelector('h3').textContent).toBe('Exoplanet lab')
    expect(el.querySelector('input[aria-label="Team name"]')).toBeNull()
    expect(el.querySelectorAll('select')).toHaveLength(0)
    expect(button('Remove Di Viewer')).toBeUndefined()
    expect(el.textContent).not.toContain('Invite links')
    expect(button('Leave team')).toBeTruthy()
    act(() => root.unmount())
  })

  it('makes an invite link and shows its address once', async () => {
    api.getTeam.mockResolvedValue(team('admin', 'u-admin'))
    const { el, button, root } = await render()
    const role = el.querySelector('select[aria-label="Role"]')
    await act(async () => { role.value = 'viewer'; role.dispatchEvent(new Event('change', { bubbles: true })) })
    await click(button('Make link'))
    expect(api.createTeamInvite).toHaveBeenCalledWith('t1', { role: 'viewer', email: null, days: 30 })
    expect(el.querySelector('input[aria-label="New invite link"]').value).toBe(teamJoinUrl('T'.repeat(43)))
    expect(teamJoinUrl('T'.repeat(43))).toMatch(/\/teams\/join\/T{43}$/)
    expect(el.textContent).toContain('the link isn’t shown again')
    act(() => root.unmount())
  })

  it('changes roles, removes people and revokes links', async () => {
    api.getTeam.mockResolvedValue(team('owner', 'u-owner'))
    const { el, button, root } = await render()
    const role = el.querySelector('select[aria-label="Role of Di Viewer"]')
    await act(async () => { role.value = 'member'; role.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(api.setTeamRole).toHaveBeenCalledWith('t1', 'u-viewer', 'member')
    await click(button('Remove Cy Member'))
    expect(api.removeTeamMember).toHaveBeenCalledWith('t1', 'u-member')
    await click(button('Revoke'))
    expect(api.revokeTeamInvite).toHaveBeenCalledWith('t1', 'i1')
    await click(button('Hand the team to Bo Admin'))
    expect(api.transferTeam).toHaveBeenCalledWith('t1', 'u-admin')
    act(() => root.unmount())
  })

  it('shows the server\'s reason when a change is refused', async () => {
    api.getTeam.mockResolvedValue(team('owner', 'u-owner'))
    api.setTeamRole.mockRejectedValueOnce(new Error('Every seat is taken. Add a seat first.'))
    const { el, root } = await render()
    const role = el.querySelector('select[aria-label="Role of Di Viewer"]')
    await act(async () => { role.value = 'member'; role.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(el.querySelector('[role="alert"]').textContent).toBe('Every seat is taken. Add a seat first.')
    act(() => root.unmount())
  })

  it('lists several teams, and tells a member who leaves', async () => {
    api.getTeam.mockResolvedValue(team('viewer', 'u-viewer'))
    const other = { id: 't2', name: 'Teaching', role: 'viewer', memberCount: 1 }
    const { el, button, onChange, root } = await render({ teams: [{ ...lab, role: 'viewer' }, other] })
    expect([...el.querySelectorAll('li')].map(li => li.textContent)).toEqual(['Exoplanet labViewer · 4 people', 'TeachingViewer · 1 person'])
    await click(button('Exoplanet labViewer · 4 people'))
    await click(button('Leave team'))
    expect(api.removeTeamMember).toHaveBeenCalledWith('t1', 'u-viewer')
    expect(onChange).toHaveBeenCalled()
    // Back on the list
    expect(el.textContent).toContain('Teaching')
    act(() => root.unmount())
  })
})

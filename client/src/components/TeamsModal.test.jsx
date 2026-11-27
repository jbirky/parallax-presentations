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
    getPlans: vi.fn(async () => ({ billing: true, teamPlans: [{ id: 'team', name: 'Team', minSeats: 3, prices: [
      { priceId: 'price_m', interval: 'month', amountCents: 1200, currency: 'usd' },
      { priceId: 'price_y', interval: 'year', amountCents: 11520, currency: 'usd' },
    ] }] })),
    createTeamCheckout: vi.fn(async () => ({ url: 'https://checkout.stripe.test/new' })),
    teamBillingCheckout: vi.fn(async () => ({ url: 'https://checkout.stripe.test/existing' })),
    teamBillingPortal: vi.fn(async () => ({ url: 'https://billing.stripe.test/team' })),
    setTeamSeats: vi.fn(async (id, seats) => ({ seats })),
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

  it('emails an invitation to an address, where the server sends email, and says if it didn’t go', async () => {
    api.getTeam.mockResolvedValue(team('owner', 'u-owner', { inviteEmails: true }))
    const { el, button, root } = await render()
    const input = el.querySelector('input[aria-label="Email address to send the invitation to"]')
    const type = async value => {
      const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
      await act(async () => { set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) })
    }
    expect(button('Make link')).toBeTruthy()
    await type('new@example.com')
    api.createTeamInvite.mockResolvedValueOnce({ token: 'T'.repeat(43), invite: {}, emailed: true })
    await click(button('Send invite'))
    expect(api.createTeamInvite).toHaveBeenCalledWith('t1', { role: 'member', email: 'new@example.com', days: 30 })
    expect(el.querySelector('[role="status"]').textContent).toContain('Invitation emailed to new@example.com')
    // The link is still there to copy
    expect(el.querySelector('input[aria-label="New invite link"]').value).toBe(teamJoinUrl('T'.repeat(43)))

    await type('late@example.com')
    api.createTeamInvite.mockResolvedValueOnce({ token: 'U'.repeat(43), invite: {}, emailed: false, emailError: 'The email couldn’t be sent.' })
    await click(button('Send invite'))
    const status = el.querySelector('[role="status"]').textContent
    expect(status).toContain('The invitation wasn’t emailed: The email couldn’t be sent.')
    expect(status).toContain('send it to late@example.com')
    act(() => root.unmount())
  })

  it('makes a link for an address to send yourself, where the server sends no email', async () => {
    api.getTeam.mockResolvedValue(team('owner', 'u-owner'))
    const { el, button, root } = await render()
    const input = el.querySelector('input[aria-label="Only for this email address"]')
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
    await act(async () => { set.call(input, 'new@example.com'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(button('Send invite')).toBeUndefined()
    await click(button('Make link'))
    expect(el.querySelector('[role="status"]').textContent).toContain('Copy the link now and send it to new@example.com')
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

describe('paying for teams', () => {
  const setValue = async (input, value) => {
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
    await act(async () => { set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) })
  }
  const submit = form => act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  let assign
  beforeEach(() => {
    assign = vi.fn()
    delete window.location
    window.location = { origin: 'http://localhost', assign }
  })

  it('offers someone in no team to create one, and sends them to Stripe to pay', async () => {
    const { el, root } = await render({ teams: [], billing: true })
    expect(el.querySelector('h3').textContent).toBe('Create a team')
    expect(el.querySelector('#team-seats').value).toBe('3')
    expect(el.textContent).toContain('Monthly: $12 a seat a month')
    expect(el.textContent).toContain('($36 a month for 3)')
    await setValue(el.querySelector('#team-name'), 'Exoplanet lab')
    await setValue(el.querySelector('#team-seats'), '5')
    const yearly = [...el.querySelectorAll('input[type="radio"]')][1]
    await act(async () => yearly.click())
    await submit(el.querySelector('form'))
    expect(api.createTeamCheckout).toHaveBeenCalledWith({ name: 'Exoplanet lab', seats: 5, priceId: 'price_y' })
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.test/new')
    act(() => root.unmount())
  })

  it('offers to create another team from the list', async () => {
    const { el, button, root } = await render({ teams: [lab, { ...lab, id: 't2', name: 'Teaching' }], billing: true })
    await act(async () => button('Create a team').click())
    expect(el.querySelector('h3').textContent).toBe('Create a team')
    await act(async () => button('Cancel').click())
    expect(el.textContent).toContain('Teaching')
    act(() => root.unmount())
  })

  it('shows the owner the seats paid for, to change, and Stripe\'s billing page', async () => {
    api.getTeam.mockResolvedValue(team('owner', 'u-owner', { billing: true, subscribed: true, minSeats: 3 }))
    const { el, button, root } = await render()
    const seats = el.querySelector('#team-paid-seats')
    expect(seats.value).toBe('4')
    expect(button('Change seats')).toBeUndefined()
    await setValue(seats, '6')
    expect(el.textContent).toContain('Stripe charges or credits the difference')
    await submit(seats.closest('form'))
    expect(api.setTeamSeats).toHaveBeenCalledWith('t1', 6)
    await act(async () => button('Manage billing').click())
    expect(api.teamBillingPortal).toHaveBeenCalledWith('t1')
    expect(assign).toHaveBeenCalledWith('https://billing.stripe.test/team')
    act(() => root.unmount())
  })

  it('asks the owner to fix a failed payment', async () => {
    api.getTeam.mockResolvedValue(team('owner', 'u-owner', { billing: true, subscribed: true, status: 'past_due' }))
    const { el, button, root } = await render()
    expect(el.querySelector('[role="status"]').textContent).toContain('last payment for this team failed')
    await act(async () => button('Update the payment method').click())
    expect(api.teamBillingPortal).toHaveBeenCalledWith('t1')
    act(() => root.unmount())
  })

  it('lets the owner pay for a team an admin of the site made', async () => {
    api.getTeam.mockResolvedValue(team('owner', 'u-owner', { billing: true, subscribed: false }))
    const { el, button, root } = await render()
    await act(async () => button('Pay for this team').click())
    await submit(el.querySelector('#team-buy-seats').closest('form'))
    expect(api.teamBillingCheckout).toHaveBeenCalledWith('t1', { priceId: 'price_m', seats: 4 })
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.test/existing')
    act(() => root.unmount())
  })

  it('keeps billing to the owner, and away when billing is off', async () => {
    api.getTeam.mockResolvedValue(team('admin', 'u-admin', { billing: true, subscribed: true }))
    let page = await render()
    expect(page.el.textContent).not.toContain('Billing')
    act(() => page.root.unmount())
    api.getTeam.mockResolvedValue(team('owner', 'u-owner', { billing: false, subscribed: false }))
    page = await render()
    expect(page.button('Pay for this team')).toBeUndefined()
    act(() => page.root.unmount())
  })
})

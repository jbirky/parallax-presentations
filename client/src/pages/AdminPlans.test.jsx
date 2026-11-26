// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: {
    addPlanPrice: vi.fn(async () => ({ plan: {} })),
    removePlanPrice: vi.fn(async () => ({ plan: {} })),
    savePlan: vi.fn(async () => ({ plan: {}, unexpired: 0 })),
  },
}))
import { api } from '../utils/api'
import { AdminDashboard, toPlanForm, fromPlanForm } from './AdminPage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const MB = 1024 * 1024
const plan = (id, name, fields) => ({
  id, name, storageBytes: 100 * MB, maxPresentations: null, expirationDays: null, maxFileBytes: null, stripePriceId: null,
  priceLabel: null, public: false, sortOrder: 0, perSeat: false, minSeats: null, prices: [], ...fields,
})
const data = {
  generatedAt: new Date().toISOString(),
  accounts: { total: 1, new30d: 0, new7d: 0, byPlan: { free: 1 } },
  guestsActive: null, signupsByWeek: [], storage: { uploadBytes: 0, datasetBytes: 0 }, users: [], jobs: null,
  system: { memoryBytes: 0, memoryLimitBytes: null, cpuPercent: null, samples: [] },
  billingEnabled: true,
  plans: [
    plan('free', 'Free', { public: true }),
    plan('team', 'Team', { perSeat: true, minSeats: 3, prices: [{ priceId: 'price_team1', interval: 'month', amountCents: 1200, currency: 'usd' }] }),
  ],
}

async function render() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const onPlanChanged = vi.fn()
  await act(async () => root.render(<AdminDashboard data={data} tab="plans" onPlanChanged={onPlanChanged} />))
  const card = name => [...el.querySelectorAll('strong')].find(s => s.textContent === name).closest('div[style*="border-radius: 8px"]')
  const button = (scope, text) => [...scope.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.getAttribute('aria-label') === text)
  return { el, root, card, button, onPlanChanged }
}
const setValue = async (input, value) => {
  const proto = Object.getPrototypeOf(input)
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value)
  await act(async () => { input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })) })
}

beforeEach(() => {
  vi.clearAllMocks()
  window.confirm = () => true
})

describe('a plan\'s prices, in /admin', () => {
  it('lists them, adds one by its Stripe ID, and stops selling at one', async () => {
    const { card, button, root, onPlanChanged } = await render()
    const team = card('Team')
    expect(team.textContent).toContain('Sold to teams by the seat, at least 3')
    expect(team.textContent).toContain('Monthly: $12 a seat a month')
    await act(async () => button(team, 'Add a price').click())
    await setValue(team.querySelector('input[aria-label="Stripe price ID"]'), 'price_teamYear1')
    await setValue(team.querySelector('select[aria-label="Billed"]'), 'year')
    await setValue(team.querySelector('input[aria-label="Amount in dollars"]'), '115.20')
    await act(async () => team.querySelector('input[aria-label="Stripe price ID"]').closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(api.addPlanPrice).toHaveBeenCalledWith('team', { priceId: 'price_teamYear1', interval: 'year', amountCents: 11520 })
    expect(onPlanChanged).toHaveBeenCalled()

    await act(async () => button(team, 'Stop selling at price_team1').click())
    expect(api.removePlanPrice).toHaveBeenCalledWith('team', 'price_team1')
    act(() => root.unmount())
  })

  it('shows why a price wasn\'t added', async () => {
    api.addPlanPrice.mockRejectedValueOnce(new Error('Stripe has no price with that ID.'))
    const { card, button, root } = await render()
    const team = card('Team')
    await act(async () => button(team, 'Add a price').click())
    await setValue(team.querySelector('input[aria-label="Stripe price ID"]'), 'price_nothing1')
    await act(async () => team.querySelector('input[aria-label="Stripe price ID"]').closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(team.querySelector('[role="alert"]').textContent).toBe('Stripe has no price with that ID.')
    act(() => root.unmount())
  })

  it('keeps a plan sold by the seat, and its fewest seats, in the form', () => {
    const form = toPlanForm(data.plans[1])
    expect(form).toMatchObject({ perSeat: true, minSeats: '3' })
    expect(fromPlanForm({ ...form, id: 'team' })).toMatchObject({ perSeat: true, minSeats: 3 })
    expect(fromPlanForm({ ...form, id: 'team', perSeat: false })).toMatchObject({ perSeat: false, minSeats: null })
  })
})

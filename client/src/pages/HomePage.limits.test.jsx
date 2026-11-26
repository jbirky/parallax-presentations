// @vitest-environment happy-dom
// The dashboard at a plan's limit: presentations past it are read-only, not
// expired; a new one asks before making the oldest editable one read-only;
// and the plans show the education price to a verified school email.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.hoisted(() => vi.stubEnv('VITE_PARALLAX_MODE', 'cloud'))

const deck = (id, title, createdAt, extra = {}) => ({ id, title, slideCount: 2, createdAt, updatedAt: createdAt, thumbnail: null, ...extra })

vi.mock('../utils/api', () => ({
  api: new Proxy({
    getPresentations: vi.fn(async () => [
      deck('d4', 'Newest talk', '2026-11-20T00:00:00Z'),
      deck('d3', 'Third talk', '2026-11-10T00:00:00Z'),
      deck('d2', 'Second talk', '2026-11-01T00:00:00Z'),
      deck('d1', 'First talk', '2026-10-01T00:00:00Z', { locked: true }),
    ]),
    getTemplates: vi.fn(async () => []),
    getMe: vi.fn(async () => ({ id: 'u-me', plan: 'free', planName: 'Free', limits: { maxPresentations: 3, storageBytes: 100 * 1024 * 1024 }, presentationCount: 4, billing: true })),
    getUploads: vi.fn(async () => []),
    listTeams: vi.fn(async () => ({ teams: [] })),
    listFolders: vi.fn(async () => ({ folders: [] })),
    getBillingStatus: vi.fn(async () => ({ active: false })),
    getPlans: vi.fn(async () => ({ plans: [{ id: 'pro', name: 'Pro', purchasable: true, maxPresentations: null, storageBytes: 5 * 1024 ** 3,
      prices: [{ priceId: 'price_m', interval: 'month', amountCents: 1000, currency: 'usd' }, { priceId: 'price_y', interval: 'year', amountCents: 9600, currency: 'usd' }] }] })),
    getBillingDiscounts: vi.fn(async () => ({ promotionCodes: true, education: { percentOff: 50, duration: 'forever', eligible: true, domain: 'uw.edu' } })),
    createPresentation: vi.fn(async data => ({ id: 'new', title: data.title || 'Untitled' })),
    getSurvey: vi.fn(async () => ({ questions: [{ id: 'field', label: 'What’s your field?', kind: 'one', choices: [['physics', 'Physics']] }], answers: null })),
  }, { get: (api, name) => api[name] ?? (api[name] = vi.fn(async () => null)) }),
}))
vi.mock('@clerk/clerk-react', () => {
  const UserButton = () => null
  UserButton.MenuItems = () => null
  UserButton.Action = () => null
  return { UserButton }
})
import { api } from '../utils/api'
import HomePage from './HomePage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function render() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const onOpen = vi.fn()
  await act(async () => root.render(<HomePage onOpen={onOpen} theme="dark" onToggleTheme={() => {}} initialSlug={null} />))
  const card = title => [...el.querySelectorAll('.presentation-card')].find(c => c.querySelector('h3')?.textContent === title)
  return { el, root, onOpen, card }
}

beforeEach(() => {
  vi.clearAllMocks()
  try { window.localStorage.clear() } catch {}
})

describe('the dashboard at a plan\'s limit', () => {
  it('marks presentations past the limit read-only, and lets them be viewed and copied', async () => {
    const page = await render()
    const first = page.card('First talk')
    expect(first.querySelector('.card-locked').textContent.trim()).toBe('Read-only')
    expect(page.card('Second talk').querySelector('.card-locked')).toBeNull()
    const titles = [...first.querySelectorAll('.card-actions button')].map(b => b.title)
    expect(titles).toContain('View')
    expect(titles).toContain('Make an editable copy')
    expect(page.el.textContent).toContain('The Free plan keeps your 3 newest presentations editable. 1 older one is read-only')
    expect(page.el.textContent).not.toMatch(/expire/i)
    act(() => page.root.unmount())
  })

  it('still makes new ones, after saying which one becomes read-only', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const page = await render()
    const make = [...page.el.querySelectorAll('.home-header button')].find(b => b.textContent.includes('New Presentation'))
    expect(make.disabled).toBe(false)
    await act(async () => make.click())
    await act(async () => page.el.querySelector('.modal form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(confirm.mock.calls[0][0]).toContain('Making another makes “Second talk” read-only')
    expect(api.createPresentation).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    await act(async () => page.el.querySelector('.modal form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(api.createPresentation).toHaveBeenCalled()
    confirm.mockRestore()
    act(() => page.root.unmount())
  })

  it('shows the education price for a verified school email', async () => {
    const page = await render()
    await act(async () => [...page.el.querySelectorAll('button')].find(b => b.textContent.trim() === 'See plans').click())
    expect(page.el.textContent).toContain('Education price: 50% off for your uw.edu address, taken off at checkout.')
    const upgrades = [...page.el.querySelectorAll('button')].map(b => b.textContent).filter(t => t.startsWith('Upgrade to Pro'))
    expect(upgrades).toEqual(['Upgrade to Pro — $5 a month', 'Upgrade to Pro — $48 a year'])
    expect(page.el.textContent).toContain('3 editable presentations, older ones read-only')
    act(() => page.root.unmount())
  })

  it('tells others about the education price and promotion codes', async () => {
    api.getBillingDiscounts.mockResolvedValueOnce({ promotionCodes: true, education: { percentOff: 50, duration: 'forever', eligible: false, domain: null } })
    const page = await render()
    await act(async () => [...page.el.querySelectorAll('button')].find(b => b.textContent.trim() === 'See plans').click())
    expect(page.el.textContent).toContain('Students and educators get 50% off: add your school email')
    expect(page.el.textContent).toContain('Have a promotion code? You can enter it at checkout.')
    expect([...page.el.querySelectorAll('button')].map(b => b.textContent)).toContain('Upgrade to Pro — $10 a month')
    act(() => page.root.unmount())
  })
})

describe('the sign-up questions on the dashboard', () => {
  it('come up once by themselves for an account that hasn\'t answered or skipped them', async () => {
    api.getMe.mockResolvedValueOnce({ id: 'u-me', plan: 'free', planName: 'Free', limits: { maxPresentations: 3 }, presentationCount: 1, billing: false, survey: { pending: true } })
    const page = await render()
    expect(page.el.querySelector('.signup-survey h2').textContent).toBe('Welcome to Parallax')
    await act(async () => [...page.el.querySelectorAll('.signup-survey button')].find(b => b.textContent.trim() === 'Skip').click())
    expect(api.skipSurvey).toHaveBeenCalled()
    expect(page.el.querySelector('.signup-survey')).toBeNull()
    act(() => page.root.unmount())
  })

  it('stay away once answered', async () => {
    const page = await render()
    expect(page.el.querySelector('.signup-survey')).toBeNull()
    act(() => page.root.unmount())
  })
})

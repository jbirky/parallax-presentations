// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

const answers = { stats: null, error: null }
vi.mock('../utils/api', () => ({
  api: {
    getLandingStats: vi.fn(async days => {
      if (answers.error) throw new Error(answers.error)
      return typeof answers.stats === 'function' ? answers.stats(days) : answers.stats
    }),
  },
}))
import { api } from '../utils/api'
import { LandingStatsPanel } from './AdminPage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, el
afterEach(() => { act(() => root.unmount()); el.remove(); answers.stats = null; answers.error = null; vi.clearAllMocks() })

async function mount() {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<LandingStatsPanel />))
}

const stats = days => ({
  configured: true, days, activeNow: 2,
  totals: { visitors: 200, visits: 250, pageviews: 400, bounces: 100, totalSeconds: 25000 },
  previous: { visitors: 160, visits: 200, pageviews: 300, bounces: 90, totalSeconds: 20000 },
  daily: [{ day: '2026-10-06', visits: 120, pageviews: 190 }, { day: '2026-10-07', visits: 130, pageviews: 210 }],
  events: { try: 30, 'sign-in': 10, 'guest-start': 12, 'open-example': 55 },
  examples: [{ slug: 'venn', title: 'Venn diagrams', opened: 40, toEditor: 9, guestStarts: 5 }],
  referrers: [{ name: 'news.ycombinator.com', count: 80 }], countries: [{ name: 'DE', count: 30 }], devices: [{ name: 'laptop', count: 150 }],
  accounts: { signups: 6 },
})

describe('the landing page statistics, in /admin', () => {
  it('shows the totals, the funnel and the examples for the last 30 days', async () => {
    answers.stats = stats
    await mount()
    expect(api.getLandingStats).toHaveBeenCalledWith(30)
    expect(el.textContent).toContain('2 visitors now')
    expect(el.textContent).toContain('+25% on the previous 30 days')
    const steps = [...el.querySelectorAll('h3')].find(h => h.textContent === 'From visit to account').parentElement.textContent
    expect(steps).toContain('Clicked Try it or Sign in · clicks40 20%')
    expect(steps).toContain('Started a guest session12 6%')
    expect(steps).toContain('Made an account · from anywhere6 3%')
    const rows = [...el.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent))
    expect(rows).toContainEqual(['Venn diagrams', '40', '9', '5'])
    expect(rows).toContainEqual(['news.ycombinator.com', '80'])
    expect(rows.some(r => r[0] === 'Germany' || r[0] === 'DE')).toBe(true)
  })

  it('changes the period', async () => {
    answers.stats = stats
    await mount()
    await act(async () => [...el.querySelectorAll('button')].find(b => b.textContent === '7 days').click())
    expect(api.getLandingStats).toHaveBeenLastCalledWith(7)
    expect(el.textContent).toContain('on the previous 7 days')
  })

  it('says what’s missing where analytics isn’t set up, and why it couldn’t load', async () => {
    answers.stats = { configured: false }
    await mount()
    expect(el.textContent).toContain('Analytics isn’t set up on this server')
    act(() => root.unmount()); el.remove()
    answers.error = 'Umami couldn’t be reached'
    await mount()
    expect(el.textContent).toContain('Couldn’t load the statistics: Umami couldn’t be reached')
  })
})

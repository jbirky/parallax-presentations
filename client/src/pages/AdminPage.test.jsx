import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AdminDashboard, planChangeSummary, toPlanForm, fromPlanForm, planEditEffects } from './AdminPage'
import { niceTicks } from '../components/AdminCharts'

const MB = 1024 * 1024

function overview(overrides = {}) {
  const now = Date.now()
  return {
    generatedAt: new Date(now).toISOString(),
    accounts: { total: 6, new30d: 2, new7d: 1, byPlan: { free: 5, pro: 1 } },
    guestsActive: 3,
    signupsByWeek: Array.from({ length: 12 }, (_, i) => ({
      weekStart: new Date(now - (11 - i) * 7 * 86400000).toISOString().slice(0, 10),
      signups: i === 11 ? 2 : i % 4,
    })),
    storage: { uploadBytes: 337 * MB, datasetBytes: 2 * MB },
    users: [
      { id: 'u1', email: 'heavy@example.com', name: 'Heavy User', plan: 'free', createdAt: '2026-05-01T00:00:00Z',
        lastActive: new Date(now - 3 * 3600000).toISOString(), presentations: 3,
        storageBytes: 110 * MB, storageLimitBytes: 100 * MB, processingMs: 185000, jobs: 4 },
      { id: 'u2', email: 'near@example.com', name: '', plan: 'free', createdAt: '2026-06-01T00:00:00Z',
        lastActive: null, presentations: 1, storageBytes: 80 * MB, storageLimitBytes: 100 * MB, processingMs: 0, jobs: 0 },
      { id: 'u3', email: 'pro@example.com', name: 'Pro User', plan: 'pro', createdAt: '2026-07-01T00:00:00Z',
        lastActive: new Date(now - 40 * 86400000).toISOString(), presentations: 12,
        storageBytes: 1 * MB, storageLimitBytes: 5 * 1024 * MB, processingMs: 0, jobs: 0 },
    ],
    jobs: {
      byKind: [{ kind: 'video_conversion', jobs: 3, durationMs: 150000 }, { kind: 'powerpoint_import', jobs: 1, durationMs: 35000 }],
      recent: [{ kind: 'video_conversion', durationMs: 42000, bytes: 9 * MB, createdAt: new Date(now - 600000).toISOString(), email: 'heavy@example.com' }],
    },
    system: {
      source: 'container', memoryBytes: 43 * MB, memoryLimitBytes: 4096 * MB, cpuPercent: 1.4, intervalSeconds: 60,
      samples: Array.from({ length: 30 }, (_, i) => ({ t: now - (30 - i) * 60000, cpuPercent: i % 5, memBytes: (40 + i) * MB })),
    },
    ...overrides,
  }
}

describe('niceTicks', () => {
  it('steps up to a clean top value', () => {
    expect(niceTicks(43)).toEqual([0, 20, 40, 60])
    expect(niceTicks(0.4)).toEqual([0, 0.1, 0.2, 0.3, 0.4])
  })

  it('uses whole-number steps for counts', () => {
    expect(niceTicks(7, { integer: true })).toEqual([0, 2, 4, 6, 8])
    expect(niceTicks(3, { integer: true })).toEqual([0, 1, 2, 3])
  })

  it('gives an empty series a 0-1 axis', () => {
    expect(niceTicks(0, { integer: true })).toEqual([0, 1])
  })
})

describe('AdminDashboard', () => {
  it('shows accounts, storage status and processing jobs', () => {
    const html = renderToStaticMarkup(<AdminDashboard data={overview()} />)
    expect(html).toContain('5 free · 1 pro')
    expect(html).toContain('Guest sessions now')
    expect(html).toContain('339 MB')
    expect(html).toContain('Over limit')
    expect(html).toContain('Near limit')
    expect(html).toContain('near@example.com')
    expect(html).toContain('3 min 5 s')
    expect(html).toContain('Video conversion')
    expect(html).toContain('of 4.0 GB limit')
    expect(html).toContain('Last 12 weeks · 17 in total')
  })

  it('explains what is missing when migrations have not run', () => {
    const html = renderToStaticMarkup(<AdminDashboard data={overview({ jobs: null, guestsActive: null })} />)
    expect(html).toContain('Job tracking starts once migration 012 has run')
    expect(html).toContain('Guest mode isn’t set up here')
  })

  it('offers to end guest sessions only while some are active', () => {
    const endAll = guestsActive => renderToStaticMarkup(<AdminDashboard data={overview({ guestsActive })} />).includes('>End all</button>')
    expect(endAll(3)).toBe(true)
    expect(endAll(0)).toBe(false)
    expect(endAll(null)).toBe(false)
  })

  it('says it is collecting before there are two CPU readings', () => {
    const data = overview()
    data.system = { ...data.system, samples: [], cpuPercent: null }
    const html = renderToStaticMarkup(<AdminDashboard data={data} />)
    expect(html).toContain('Collecting. Readings are taken every 60 seconds')
  })

  it('lets an admin pick each account’s plan once the server lists the plans', () => {
    const picker = renderToStaticMarkup(<AdminDashboard data={overview({ plans: PLANS })} />)
    expect(picker).toContain('aria-label="Plan for pro@example.com"')
    expect(picker).toMatch(/<option value="pro" selected="">Pro<\/option>/)
    expect(picker).toContain('<option value="team">Team</option>')
    expect(picker).not.toContain('value="guest"')

    const badge = renderToStaticMarkup(<AdminDashboard data={overview()} />)
    expect(badge).not.toContain('<select')
  })
})

const plan = (id, name, fields) => ({
  id, name, maxPresentations: null, expirationDays: null, maxFileBytes: null, stripePriceId: null,
  priceLabel: null, public: false, sortOrder: 0, assignable: id !== 'guest', ...fields,
})
const PLANS = [
  plan('free', 'Free', { storageBytes: 100 * MB, maxPresentations: 3, expirationDays: 30, priceLabel: 'Free', public: true }),
  plan('pro', 'Pro', { storageBytes: 5 * 1024 * MB, stripePriceId: 'price_pro123', priceLabel: '$5/mo', public: true, sortOrder: 1 }),
  plan('team', 'Team', { storageBytes: 25 * 1024 * MB, sortOrder: 2 }),
  plan('guest', 'Guest', { storageBytes: 25 * MB, maxPresentations: 1, maxFileBytes: 10 * MB, sortOrder: 3 }),
]

describe('planChangeSummary', () => {
  const [free, pro, team] = PLANS
  const user = { name: 'Near', email: 'near@example.com', plan: 'free', hasSubscription: false }

  it('says presentations stop expiring when moving off free', () => {
    const text = planChangeSummary(user, free, pro)
    expect(text).toContain('Move Near from Free to Pro?')
    expect(text).toContain('Storage limit: 5 GB.')
    expect(text).toContain('Their presentations will stop expiring.')
  })

  it('says only new presentations expire when moving to free', () => {
    const text = planChangeSummary({ ...user, plan: 'pro' }, pro, free)
    expect(text).toContain('Storage limit: 100 MB.')
    expect(text).toContain('new ones will expire after 30 days')
    expect(text).not.toContain('stop expiring')
  })

  it('leaves expiry out between plans that don’t expire, and warns about Stripe', () => {
    const text = planChangeSummary({ ...user, plan: 'pro', hasSubscription: true }, pro, team)
    expect(text).not.toContain('expir')
    expect(text).toContain('They pay through Stripe')
  })
})

describe('plan editor', () => {
  const [free, pro] = PLANS

  it('round-trips a plan through the form', () => {
    const form = toPlanForm(free)
    expect(form).toMatchObject({ storage: '100', storageUnit: 'MB', maxPresentations: '3', expirationDays: '30', maxFileMB: '', stripePriceId: '' })
    expect(toPlanForm(pro)).toMatchObject({ storage: '5', storageUnit: 'GB', maxPresentations: '', expirationDays: '' })
    const back = fromPlanForm(form)
    expect(back).toMatchObject({ id: 'free', storageBytes: 100 * MB, maxPresentations: 3, expirationDays: 30, maxFileBytes: null, stripePriceId: null })
    expect(fromPlanForm({ ...form, storage: '1.5', storageUnit: 'GB', maxFileMB: '50' })).toMatchObject({ storageBytes: 1536 * MB, maxFileBytes: 50 * MB })
  })

  it('warns about what a save does to accounts on the plan', () => {
    expect(planEditEffects(free, { ...free, expirationDays: null }, 5)).toEqual(['Presentations of the 5 accounts on it will stop expiring.'])
    expect(planEditEffects(pro, { ...pro, expirationDays: 14 }, 1)[0]).toContain('Only presentations made from now on will expire')
    expect(planEditEffects(free, { ...free, storageBytes: 50 * MB, maxPresentations: 2 }, 1)).toEqual([
      'Accounts on it storing more than 50 MB can’t upload until they free space.',
      'Accounts on it with more than 2 presentations keep them but can’t make more.',
    ])
    expect(planEditEffects(pro, { ...pro, stripePriceId: 'price_new123' }, 0)[0]).toContain('Existing subscribers stay on the old price')
    expect(planEditEffects(free, { ...free, name: 'Starter' }, 9)).toEqual([])
  })

  it('shows a card per plan, with delete only for plans that can go', () => {
    const html = renderToStaticMarkup(<AdminDashboard data={overview({ plans: PLANS })} />)
    expect(html).toContain('<h2 style="margin:0 0 2px;font-size:14px;font-weight:600">Plans</h2>')
    expect(html).toContain('Billing is switched off')
    expect(html).toContain('5 accounts')
    expect(html).toContain('$5/mo · <code>price_pro123</code>')
    expect(html).toContain('Guest mode')
    expect(html).toContain('Files up to 10 MB each')
    // Free and guest can't be deleted; pro has an account, so its Delete is disabled
    expect(html.match(/>Delete<\/button>/g)).toHaveLength(2)
    expect(html).toContain('disabled="" title="Move its accounts to another plan first"')
  })
})

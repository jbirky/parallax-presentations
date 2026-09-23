import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AdminDashboard } from './AdminPage'
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

  it('says it is collecting before there are two CPU readings', () => {
    const data = overview()
    data.system = { ...data.system, samples: [], cpuPercent: null }
    const html = renderToStaticMarkup(<AdminDashboard data={data} />)
    expect(html).toContain('Collecting. Readings are taken every 60 seconds')
  })
})

// The landing page's statistics as the admin page gets them: Umami's answers
// reshaped, with every day of the period and the examples by slug. Needs
// neither Umami nor a database.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { shapeStats, landingStats } = require('../services/umami-stats')

const DAY = 24 * 60 * 60 * 1000
const endAt = Date.parse('2026-10-07T12:00:00Z'), startAt = endAt - 7 * DAY

describe('the landing page statistics', () => {
  it('reshapes Umami’s answers for the admin page', () => {
    const out = shapeStats({
      stats: { pageviews: 40, visitors: 20, visits: 25, bounces: 10, totaltime: 1500, comparison: { pageviews: 30, visitors: 16, visits: 20, bounces: 9, totaltime: 900 } },
      series: { pageviews: [{ x: '2026-10-02T00:00:00Z', y: 12 }, { x: '2026-10-07T00:00:00Z', y: 28 }], sessions: [{ x: '2026-10-02T00:00:00Z', y: 9 }, { x: '2026-10-07T00:00:00Z', y: 16 }] },
      events: [{ x: 'try', y: 6 }, { x: 'open-example', y: 11 }, { x: 'guest-start', y: 3 }],
      referrers: [{ x: 'news.ycombinator.com', y: 5 }, { x: '', y: 2 }],
      countries: [{ x: 'US', y: 12 }],
      devices: [{ x: 'laptop', y: 15 }],
      opened: [{ value: 'venn', total: 7 }, { value: 'gone', total: 4 }],
      toEditor: [{ value: 'venn', total: 2 }],
      guestStarts: [{ value: 'venn', total: 1 }, { value: 'none', total: 2 }],
      active: { visitors: 3 },
    }, { days: 7, startAt, endAt, accounts: { signups: 2 }, titles: { venn: 'Venn diagrams' } })

    assert.deepEqual(out.totals, { visitors: 20, visits: 25, pageviews: 40, bounces: 10, totalSeconds: 1500 })
    assert.equal(out.previous.visitors, 16)
    assert.equal(out.activeNow, 3)
    // Every day of the period, empty ones too
    assert.equal(out.daily.length, 8)
    assert.deepEqual(out.daily[0], { day: '2026-09-30', visits: 0, pageviews: 0 })
    assert.deepEqual(out.daily.find(d => d.day === '2026-10-02'), { day: '2026-10-02', visits: 9, pageviews: 12 })
    assert.deepEqual(out.events, { try: 6, 'open-example': 11, 'guest-start': 3 })
    // Examples by slug with their titles; a deleted one keeps its slug; guests from no example aren't one
    assert.deepEqual(out.examples, [
      { slug: 'venn', title: 'Venn diagrams', opened: 7, toEditor: 2, guestStarts: 1 },
      { slug: 'gone', title: 'gone', opened: 4, toEditor: 0, guestStarts: 0 },
    ])
    assert.deepEqual(out.referrers, [{ name: 'news.ycombinator.com', count: 5 }, { name: '(none)', count: 2 }])
    assert.deepEqual(out.accounts, { signups: 2 })
  })

  it('copes with Umami having nothing yet', () => {
    const out = shapeStats({ stats: {}, series: {}, events: [], referrers: [], countries: [], devices: [], opened: [], toEditor: [], guestStarts: [], active: {} }, { days: 7, startAt, endAt, accounts: { signups: 0 } })
    assert.equal(out.totals.visitors, 0)
    assert.equal(out.daily.every(d => d.visits === 0), true)
    assert.deepEqual(out.examples, [])
  })

  it('says so where Umami isn’t set up', async () => {
    for (const key of ['UMAMI_URL', 'UMAMI_WEBSITE_ID', 'UMAMI_STATS_USER', 'UMAMI_STATS_PASSWORD']) delete process.env[key]
    assert.deepEqual(await landingStats(null, 30), { configured: false })
  })
})

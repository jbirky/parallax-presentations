// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The landing page's statistics for the admin page, read from Umami's API.
// The server signs in as a view-only Umami account (UMAMI_STATS_USER and
// UMAMI_STATS_PASSWORD) and reads its own website (UMAMI_WEBSITE_ID, at
// UMAMI_URL). What Umami can't know, the accounts made, comes from this app's
// database; guest sessions are counted by Umami (the guest page's guest-start
// event), as a guest's account is deleted when the session ends. A period's
// answer is kept for a minute, so the admin page can be reloaded freely.

class StatsError extends Error {
  constructor(message, status = 502) { super(message); this.status = status }
}

const PERIODS = [7, 30, 90]
const DAY = 24 * 60 * 60 * 1000
const CACHE_MS = 60 * 1000
const TOP = 8

function config() {
  const url = (process.env.UMAMI_URL || '').replace(/\/+$/, '')
  const websiteId = process.env.UMAMI_WEBSITE_ID || ''
  const user = process.env.UMAMI_STATS_USER || ''
  const password = process.env.UMAMI_STATS_PASSWORD || ''
  return url && /^[0-9a-f-]{36}$/i.test(websiteId) && user && password ? { url, websiteId, user, password } : null
}

let token = null
async function signIn(cfg) {
  let r
  try {
    r = await fetch(`${cfg.url}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: cfg.user, password: cfg.password }) })
  } catch (err) {
    throw new StatsError('Umami couldn’t be reached')
  }
  if (!r.ok) throw new StatsError('Umami didn’t accept the statistics account’s sign-in')
  return (await r.json()).token
}

// The token, signing in when there's none; requests at the same moment wait
// for the same sign-in
let signingIn = null
async function currentToken(cfg) {
  if (token) return token
  if (!signingIn) signingIn = signIn(cfg).then(t => { token = t; return t }).finally(() => { signingIn = null })
  return signingIn
}

// A GET from Umami's API, signing in again once if the token has expired
async function umami(cfg, path, params = {}) {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  for (let attempt = 0; attempt < 2; attempt++) {
    const used = await currentToken(cfg)
    let r
    try {
      r = await fetch(`${cfg.url}${path}?${query}`, { headers: { Authorization: `Bearer ${used}` } })
    } catch (err) {
      throw new StatsError('Umami couldn’t be reached')
    }
    // Expired: sign in again, unless another request already has
    if (r.status === 401 && attempt === 0) { if (token === used) token = null; continue }
    if (!r.ok) throw new StatsError(`Umami answered ${r.status} for ${path.replace(/\/websites\/[^/]+/, '/websites/…')}`)
    return r.json()
  }
}

const dayOf = t => new Date(t).toISOString().slice(0, 10)
const top = (rows, n = TOP) => (Array.isArray(rows) ? rows : []).slice(0, n).map(r => ({ name: r.x || '(none)', count: r.y || 0 }))

// Umami's answers, and the app's own counts, as the admin page shows them:
// every day of the period in the daily series, the examples by slug with
// their titles, and the events by name
function shapeStats({ stats, series, events, referrers, countries, devices, opened, toEditor, guestStarts, active }, { days, startAt, endAt, accounts, titles = {} }) {
  const perDay = key => new Map((series?.[key] || []).map(p => [dayOf(p.x), p.y || 0]))
  const visits = perDay('sessions'), views = perDay('pageviews')
  const daily = []
  for (let t = Date.parse(dayOf(startAt)); t <= endAt; t += DAY) {
    const day = dayOf(t)
    daily.push({ day, visits: visits.get(day) || 0, pageviews: views.get(day) || 0 })
  }
  const bySlug = new Map()
  const add = (rows, key) => (Array.isArray(rows) ? rows : []).forEach(({ value, total }) => {
    if (!value || value === 'none') return
    if (!bySlug.has(value)) bySlug.set(value, { slug: value, title: titles[value] || value, opened: 0, toEditor: 0, guestStarts: 0 })
    bySlug.get(value)[key] += total || 0
  })
  add(opened, 'opened'); add(toEditor, 'toEditor'); add(guestStarts, 'guestStarts')
  const eventCounts = Object.fromEntries((Array.isArray(events) ? events : []).map(e => [e.x, e.y || 0]))
  const totals = s => ({ visitors: s?.visitors || 0, visits: s?.visits || 0, pageviews: s?.pageviews || 0, bounces: s?.bounces || 0, totalSeconds: s?.totaltime || 0 })
  return {
    configured: true,
    days, startAt, endAt,
    activeNow: active?.visitors || 0,
    totals: totals(stats),
    previous: totals(stats?.comparison),
    daily,
    events: eventCounts,
    examples: [...bySlug.values()].sort((a, b) => b.opened - a.opened || b.toEditor - a.toEditor),
    referrers: top(referrers),
    countries: top(countries),
    devices: top(devices),
    accounts,
  }
}

const cache = new Map()

// The statistics for the last `days` days; { configured: false } without Umami
async function landingStats(storage, days, { titles = {} } = {}) {
  const cfg = config()
  if (!cfg) return { configured: false }
  if (!PERIODS.includes(days)) throw new StatsError('The period is 7, 30 or 90 days', 400)
  const kept = cache.get(days)
  if (kept && Date.now() - kept.at < CACHE_MS) return kept.value
  const endAt = Date.now(), startAt = endAt - days * DAY
  const w = `/api/websites/${cfg.websiteId}`
  const q = { startAt, endAt }
  // An event's property, or nothing if Umami has none recorded yet
  const values = (event, propertyName) => umami(cfg, `${w}/event-data/values`, { ...q, event, propertyName }).catch(() => [])
  const [stats, series, events, referrers, countries, devices, opened, toEditor, guestStarts, active] = await Promise.all([
    umami(cfg, `${w}/stats`, q),
    umami(cfg, `${w}/pageviews`, { ...q, unit: 'day', timezone: 'UTC' }),
    umami(cfg, `${w}/metrics`, { ...q, type: 'event' }),
    umami(cfg, `${w}/metrics`, { ...q, type: 'referrer' }),
    umami(cfg, `${w}/metrics`, { ...q, type: 'country' }),
    umami(cfg, `${w}/metrics`, { ...q, type: 'device' }),
    values('open-example', 'example'),
    values('example-to-editor', 'example'),
    values('guest-start', 'example'),
    umami(cfg, `${w}/active`),
  ])
  let accounts = { signups: null }
  if (storage?.query) {
    const { rows: [r] } = await storage.query(
      `SELECT COUNT(*)::int AS signups FROM users
        WHERE auth_provider IS DISTINCT FROM 'guest' AND created_at >= to_timestamp($1::double precision / 1000)`, [startAt])
    accounts = r
  }
  const value = shapeStats({ stats, series, events, referrers, countries, devices, opened, toEditor, guestStarts, active }, { days, startAt, endAt, accounts, titles })
  cache.set(days, { at: Date.now(), value })
  return value
}

module.exports = { landingStats, shapeStats, StatsError, PERIODS }

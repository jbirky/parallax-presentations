// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Admin dashboard data: sign-ups, per-user storage and processing, and this
// container's CPU and memory.

const fs = require('fs')

// ── Container CPU and memory ────────────────────────────────────────────────
// Read from this container's own cgroup (v2), so no Docker access is needed.
// One sample a minute, the last 24 hours kept in memory: history starts over
// when the server restarts, and sampling never touches the database.

const SAMPLE_INTERVAL_MS = 60 * 1000
const SAMPLE_WINDOW = 24 * 60

const samples = []
let previous = null
let memoryLimit = null
let source = null

function readUsage() {
  try {
    const cpuStat = fs.readFileSync('/sys/fs/cgroup/cpu.stat', 'utf8')
    const max = fs.readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim()
    return {
      source: 'container',
      cpuUsec: Number(/usage_usec (\d+)/.exec(cpuStat)[1]),
      memBytes: Number(fs.readFileSync('/sys/fs/cgroup/memory.current', 'utf8')),
      memLimit: max === 'max' ? null : Number(max),
    }
  } catch {
    // Not in a cgroup v2 container (e.g. running from source): this process only
    const cpu = process.cpuUsage()
    return { source: 'process', cpuUsec: cpu.user + cpu.system, memBytes: process.memoryUsage().rss, memLimit: null }
  }
}

function takeSample() {
  const now = Date.now()
  const usage = readUsage()
  source = usage.source
  memoryLimit = usage.memLimit
  if (previous) {
    // docker stats convention: 100% = one CPU core
    const cpuPercent = Math.max(0, (usage.cpuUsec - previous.cpuUsec) / ((now - previous.at) * 1000) * 100)
    samples.push({ t: now, cpuPercent: Math.round(cpuPercent * 10) / 10, memBytes: usage.memBytes })
    if (samples.length > SAMPLE_WINDOW) samples.shift()
  }
  previous = { at: now, cpuUsec: usage.cpuUsec }
}

function startSystemSampling() {
  takeSample()
  setInterval(takeSample, SAMPLE_INTERVAL_MS).unref()
}

function systemStats() {
  const now = readUsage()
  return {
    source,
    memoryBytes: now.memBytes,
    memoryLimitBytes: now.memLimit ?? memoryLimit,
    cpuPercent: samples.length ? samples[samples.length - 1].cpuPercent : null,
    intervalSeconds: SAMPLE_INTERVAL_MS / 1000,
    samples,
  }
}

// ── Per-user processing jobs ────────────────────────────────────────────────

// Records a CPU-heavy job. Never fails the request that ran the job.
function recordUsage(storage, { userId, kind, durationMs, bytes = null }) {
  if (!storage || !storage.query || !userId) return
  storage.query(
    'INSERT INTO usage_events (user_id, kind, duration_ms, bytes) VALUES ($1, $2, $3, $4)',
    [userId, kind, Math.round(durationMs), bytes]
  ).catch(err => console.error('Usage record failed:', err.message))
}

// ── Overview ────────────────────────────────────────────────────────────────

// Guests are counted as sessions, not as accounts
const ACCOUNT = "COALESCE(u.plan, 'free') <> 'guest'"

async function tableExists(storage, name) {
  const { rows } = await storage.query('SELECT to_regclass($1) IS NOT NULL AS ok', [name])
  return rows[0].ok
}

async function getAdminOverview(storage, planLimits) {
  const [hasUsage, hasGuests] = await Promise.all([
    tableExists(storage, 'usage_events'),
    tableExists(storage, 'guest_sessions'),
  ])
  const usageCols = hasUsage
    ? `(SELECT COALESCE(SUM(duration_ms), 0) FROM usage_events e WHERE e.user_id = u.id AND e.created_at > NOW() - INTERVAL '30 days')::bigint AS processing_ms,
       (SELECT COUNT(*) FROM usage_events e WHERE e.user_id = u.id AND e.created_at > NOW() - INTERVAL '30 days')::int AS jobs`
    : '0::bigint AS processing_ms, 0 AS jobs'

  const [totals, weekly, users, storageTotals, jobsByKind, recentJobs, guests] = await Promise.all([
    storage.query(`
      SELECT COUNT(*)::int AS accounts,
             COUNT(*) FILTER (WHERE u.created_at > NOW() - INTERVAL '30 days')::int AS new_30d,
             COUNT(*) FILTER (WHERE u.created_at > NOW() - INTERVAL '7 days')::int AS new_7d,
             (SELECT COALESCE(json_object_agg(plan, n), '{}')
                FROM (SELECT COALESCE(u.plan, 'free') AS plan, COUNT(*)::int AS n
                        FROM users u WHERE ${ACCOUNT} GROUP BY 1) per_plan) AS by_plan
        FROM users u
       WHERE ${ACCOUNT}`),
    storage.query(`
      SELECT to_char(w, 'YYYY-MM-DD') AS week_start, COUNT(u.id)::int AS signups
        FROM generate_series(date_trunc('week', NOW()) - INTERVAL '11 weeks', date_trunc('week', NOW()), INTERVAL '1 week') AS w
        LEFT JOIN users u ON date_trunc('week', u.created_at) = w AND ${ACCOUNT}
       GROUP BY w ORDER BY w`),
    storage.query(`
      SELECT * FROM (
        SELECT u.id, u.email, u.name, COALESCE(u.plan, 'free') AS plan, u.created_at,
               (SELECT COUNT(*) FROM presentations p WHERE p.user_id = u.id AND NOT p.is_template)::int AS presentations,
               (SELECT MAX(updated_at) FROM presentations p WHERE p.user_id = u.id) AS last_active,
               (SELECT COALESCE(SUM(size_bytes), 0) FROM uploads up WHERE up.user_id = u.id)::bigint AS upload_bytes,
               (SELECT COALESCE(SUM(byte_size), 0) FROM datasets d WHERE d.user_id = u.id)::bigint AS dataset_bytes,
               ${usageCols}
          FROM users u
         WHERE ${ACCOUNT}
      ) accounts
      ORDER BY upload_bytes + dataset_bytes DESC, created_at DESC
      LIMIT 500`),
    storage.query(`
      SELECT (SELECT COALESCE(SUM(size_bytes), 0) FROM uploads)::bigint AS upload_bytes,
             (SELECT COALESCE(SUM(byte_size), 0) FROM datasets)::bigint AS dataset_bytes`),
    hasUsage ? storage.query(`
      SELECT kind, COUNT(*)::int AS jobs, COALESCE(SUM(duration_ms), 0)::bigint AS duration_ms
        FROM usage_events WHERE created_at > NOW() - INTERVAL '30 days'
       GROUP BY kind ORDER BY 3 DESC`) : null,
    hasUsage ? storage.query(`
      SELECT e.kind, e.duration_ms, e.bytes, e.created_at, u.email
        FROM usage_events e LEFT JOIN users u ON u.id = e.user_id
       ORDER BY e.created_at DESC LIMIT 15`) : null,
    hasGuests ? storage.query(`
      SELECT COUNT(*)::int AS active FROM guest_sessions
       WHERE closing_at IS NULL AND last_active_at > NOW() - INTERVAL '12 hours'`) : null,
  ])

  const t = totals.rows[0]
  return {
    generatedAt: new Date().toISOString(),
    accounts: { total: t.accounts, new30d: t.new_30d, new7d: t.new_7d, byPlan: t.by_plan },
    guestsActive: guests ? guests.rows[0].active : null,
    signupsByWeek: weekly.rows.map(r => ({ weekStart: r.week_start, signups: r.signups })),
    storage: {
      uploadBytes: Number(storageTotals.rows[0].upload_bytes),
      datasetBytes: Number(storageTotals.rows[0].dataset_bytes),
    },
    users: users.rows.map(r => ({
      id: r.id,
      email: r.email,
      name: r.name || '',
      plan: r.plan,
      createdAt: r.created_at,
      lastActive: r.last_active,
      presentations: r.presentations,
      storageBytes: Number(r.upload_bytes) + Number(r.dataset_bytes),
      storageLimitBytes: (planLimits[r.plan] || planLimits.free).storageBytes,
      processingMs: Number(r.processing_ms),
      jobs: r.jobs,
    })),
    jobs: hasUsage ? {
      byKind: jobsByKind.rows.map(r => ({ kind: r.kind, jobs: r.jobs, durationMs: Number(r.duration_ms) })),
      recent: recentJobs.rows.map(r => ({
        kind: r.kind, durationMs: r.duration_ms, bytes: r.bytes === null ? null : Number(r.bytes),
        createdAt: r.created_at, email: r.email,
      })),
    } : null,
    system: systemStats(),
  }
}

module.exports = { startSystemSampling, recordUsage, getAdminOverview }

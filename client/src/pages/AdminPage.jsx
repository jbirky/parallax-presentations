// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Admin dashboard (/admin): sign-ups, per-user storage and processing, and
// the server container's CPU and memory. The server answers only for admins.

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { api } from '../utils/api'
import { ColumnChart, LineChart } from '../components/AdminCharts'

const REFRESH_MS = 60 * 1000

const JOB_LABELS = {
  video_conversion: 'Video conversion',
  powerpoint_import: 'PowerPoint import',
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const v = bytes / 1024 ** i
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

function formatDuration(ms) {
  if (!ms) return '0 s'
  const s = ms / 1000
  if (s < 10) return `${s.toFixed(1)} s`
  if (s < 60) return `${Math.round(s)} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ${Math.round(s % 60)} s`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}

function formatDay(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
}

function formatAgo(iso) {
  if (!iso) return '—'
  const minutes = Math.round((Date.now() - new Date(iso)) / 60000)
  if (minutes < 60) return minutes <= 1 ? 'Just now' : `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days <= 30 ? `${days} days ago` : formatDay(iso)
}

const formatClock = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const formatWeek = iso => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

// Hourly averages and peaks, the table view for the CPU and memory charts
function hourlyRows(samples, key) {
  const hours = new Map()
  for (const s of samples) {
    const d = new Date(s.t)
    d.setMinutes(0, 0, 0)
    const bucket = hours.get(d.getTime()) || { t: d.getTime(), sum: 0, n: 0, peak: 0 }
    bucket.sum += s[key]
    bucket.n += 1
    bucket.peak = Math.max(bucket.peak, s[key])
    hours.set(d.getTime(), bucket)
  }
  return [...hours.values()].sort((a, b) => b.t - a.t).map(b => ({ t: b.t, average: b.sum / b.n, peak: b.peak }))
}

const styles = {
  // The app's body doesn't scroll (the editor needs that), so this page does
  page: { height: '100%', overflowY: 'auto', background: 'var(--bg-primary)', color: 'var(--text-primary)' },
  wrap: { maxWidth: 1120, margin: '0 auto', paddingInline: 16, paddingBlock: '20px 64px', display: 'grid', gap: 20 },
  panel: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, minWidth: 0 },
  h2: { margin: '0 0 2px', fontSize: 14, fontWeight: 600 },
  sub: { margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' },
  muted: { color: 'var(--text-muted)' },
  th: { textAlign: 'left', fontWeight: 500, fontSize: 12, color: 'var(--text-muted)', padding: '8px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
  td: { padding: '9px 10px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'top' },
  num: { fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' },
  details: { marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' },
}

function Stat({ label, value, note, first }) {
  return (
    <div style={{ flex: '1 1 170px', padding: '4px 16px', borderLeft: first ? 'none' : '1px solid var(--border)', minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.3 }}>{value}</div>
      {note && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{note}</div>}
    </div>
  )
}

function ChartPanel({ title, subtitle, children, table }) {
  return (
    <section style={styles.panel}>
      <h2 style={styles.h2}>{title}</h2>
      <p style={styles.sub}>{subtitle}</p>
      {children}
      {table && (
        <details style={styles.details}>
          <summary style={{ cursor: 'pointer' }}>Show numbers</summary>
          <div style={{ overflowX: 'auto', marginTop: 8 }}>{table}</div>
        </details>
      )}
    </section>
  )
}

// Columns from `numbersFrom` on hold numbers and align right
function SimpleTable({ columns, rows, numbersFrom = 1 }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{columns.map((c, i) => <th key={c} style={{ ...styles.th, ...(i >= numbersFrom ? styles.num : {}) }}>{c}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((cell, j) => <td key={j} style={{ ...styles.td, ...(j >= numbersFrom ? styles.num : {}) }}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  )
}

// Same thresholds and colors as the storage meter on the dashboard
function StorageMeter({ used, limit }) {
  const ratio = limit ? used / limit : 0
  const color = ratio > 0.9 ? '#ef4444' : ratio > 0.7 ? '#f59e0b' : 'var(--accent)'
  const status = ratio >= 1 ? 'Over limit' : ratio > 0.9 ? 'Almost full' : ratio > 0.7 ? 'Near limit' : null
  return (
    <div style={{ display: 'grid', gap: 4, minWidth: 150 }}>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, ratio * 100)}%`, background: color, borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
        {formatBytes(used)} of {formatBytes(limit)}{status && <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}> · {status}</strong>}
      </div>
    </div>
  )
}

// The dashboard itself, rendered from the overview data
export function AdminDashboard({ data, refreshing = false }) {
  const system = data.system
  const samples = system?.samples || []
  const cpuPoints = samples.map(s => ({ t: s.t, value: s.cpuPercent }))
  const memPoints = samples.map(s => ({ t: s.t, value: s.memBytes / (1024 * 1024) }))
  const weeks = (data.signupsByWeek || []).map(w => ({
    key: w.weekStart, label: formatWeek(w.weekStart), tooltipLabel: `Week of ${formatWeek(w.weekStart)}`, value: w.signups,
  }))
  const plans = Object.entries(data.accounts.byPlan || {}).sort((a, b) => b[1] - a[1])
  const signupsInRange = weeks.reduce((sum, w) => sum + w.value, 0)
  const collecting = system?.intervalSeconds
    ? `Collecting. Readings are taken every ${system.intervalSeconds} seconds; the chart appears after two.`
    : 'Collecting.'

  return (
    <div style={{ display: 'grid', gap: 20, opacity: refreshing ? 0.6 : 1, transition: 'opacity 150ms' }}>
      <section style={{ ...styles.panel, display: 'flex', flexWrap: 'wrap', rowGap: 14, padding: '14px 0' }}>
        <Stat first label="Accounts" value={data.accounts.total.toLocaleString()}
          note={plans.length ? plans.map(([plan, n]) => `${n} ${plan}`).join(' · ') : 'None yet'} />
        <Stat label="New accounts" value={data.accounts.new30d.toLocaleString()} note={`Last 30 days · ${data.accounts.new7d} in the last 7`} />
        <Stat label="Guest sessions now" value={data.guestsActive === null ? '—' : data.guestsActive.toLocaleString()}
          note={data.guestsActive === null ? 'Guest mode isn’t set up here' : 'Active in the last 12 hours'} />
        <Stat label="Storage used" value={formatBytes(data.storage.uploadBytes + data.storage.datasetBytes)}
          note={`${formatBytes(data.storage.uploadBytes)} uploads · ${formatBytes(data.storage.datasetBytes)} datasets`} />
        <Stat label="Memory" value={formatBytes(system.memoryBytes)}
          note={system.memoryLimitBytes ? `of ${formatBytes(system.memoryLimitBytes)} limit` : 'No limit set'} />
        <Stat label="CPU" value={system.cpuPercent === null ? '—' : `${system.cpuPercent}%`}
          note={system.source === 'process' ? 'This process, 100% = one core' : 'Last minute, 100% = one core'} />
      </section>

      <ChartPanel title="Sign-ups per week"
        subtitle={signupsInRange ? `Last 12 weeks · ${signupsInRange} in total` : 'Last 12 weeks · none in this period'}
        table={<SimpleTable columns={['Week of', 'Sign-ups']} rows={[...weeks].reverse().map(w => [w.label, w.value])} />}>
        <ColumnChart data={weeks} integer ariaLabel="Sign-ups per week, last 12 weeks" />
      </ChartPanel>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <ChartPanel title="Container CPU" subtitle={`Last 24 hours · 100% = one core${system.source === 'process' ? ' · this process only' : ''} · starts over when the server restarts`}
          table={samples.length > 1 && <SimpleTable columns={['Hour', 'Average', 'Peak']}
            rows={hourlyRows(samples, 'cpuPercent').map(r => [formatClock(r.t), `${r.average.toFixed(1)}%`, `${r.peak.toFixed(1)}%`])} />}>
          <LineChart points={cpuPoints} formatValue={v => `${Math.round(v * 10) / 10}%`} formatTime={formatClock}
            ariaLabel="Container CPU over the last 24 hours" emptyText={collecting} />
        </ChartPanel>
        <ChartPanel title="Container memory"
          subtitle={`Last 24 hours · ${system.memoryLimitBytes ? `limit ${formatBytes(system.memoryLimitBytes)}` : 'no limit set'} · starts over when the server restarts`}
          table={samples.length > 1 && <SimpleTable columns={['Hour', 'Average', 'Peak']}
            rows={hourlyRows(samples, 'memBytes').map(r => [formatClock(r.t), formatBytes(r.average), formatBytes(r.peak)])} />}>
          <LineChart points={memPoints} formatValue={v => `${Math.round(v)} MB`} formatTime={formatClock}
            ariaLabel="Container memory over the last 24 hours" emptyText={collecting} />
        </ChartPanel>
      </div>

      <section style={styles.panel}>
        <h2 style={styles.h2}>Accounts</h2>
        <p style={styles.sub}>Sorted by storage used · processing counts video conversion and PowerPoint import over the last 30 days</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                <th style={styles.th}>Account</th>
                <th style={styles.th}>Plan</th>
                <th style={styles.th}>Joined</th>
                <th style={{ ...styles.th, ...styles.num }}>Presentations</th>
                <th style={styles.th}>Storage</th>
                <th style={{ ...styles.th, ...styles.num }}>Processing</th>
                <th style={{ ...styles.th, ...styles.num }}>Last edit</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map(u => (
                <tr key={u.id}>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 500 }}>{u.name || u.email}</div>
                    {u.name && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</div>}
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-hover)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{u.plan}</span>
                  </td>
                  <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>{formatDay(u.createdAt)}</td>
                  <td style={{ ...styles.td, ...styles.num }}>{u.presentations}</td>
                  <td style={styles.td}><StorageMeter used={u.storageBytes} limit={u.storageLimitBytes} /></td>
                  <td style={{ ...styles.td, ...styles.num }}>
                    {u.jobs ? <>{formatDuration(u.processingMs)}<div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.jobs} {u.jobs === 1 ? 'job' : 'jobs'}</div></> : <span style={styles.muted}>—</span>}
                  </td>
                  <td style={{ ...styles.td, ...styles.num }}>{formatAgo(u.lastActive)}</td>
                </tr>
              ))}
              {!data.users.length && (
                <tr><td colSpan={7} style={{ ...styles.td, color: 'var(--text-muted)' }}>No accounts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.h2}>Processing jobs</h2>
        <p style={styles.sub}>The CPU-heavy work, by type over the last 30 days, and the latest jobs</p>
        {!data.jobs ? (
          <p style={{ ...styles.muted, margin: 0, fontSize: 13 }}>Job tracking starts once migration 012 has run on this database.</p>
        ) : !data.jobs.recent.length ? (
          <p style={{ ...styles.muted, margin: 0, fontSize: 13 }}>No processing jobs yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <SimpleTable columns={['Type', 'Jobs', 'Total time']}
              rows={data.jobs.byKind.map(k => [JOB_LABELS[k.kind] || k.kind, k.jobs, formatDuration(k.durationMs)])} />
            <div style={{ overflowX: 'auto' }}>
              <SimpleTable numbersFrom={3} columns={['When', 'Account', 'Type', 'Duration', 'File size']}
                rows={data.jobs.recent.map(j => [formatAgo(j.createdAt), j.email || '(deleted account)', JOB_LABELS[j.kind] || j.kind, formatDuration(j.durationMs), j.bytes === null ? '—' : formatBytes(j.bytes)])} />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default function AdminPage() {
  const [data, setData] = useState(undefined) // undefined: loading, null: not an admin
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      setData(await api.getAdminOverview())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load() }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  if (data === undefined && !error) {
    return <div style={{ ...styles.page, display: 'grid', placeItems: 'center' }}><p style={styles.muted}>Loading…</p></div>
  }
  if (data === null) {
    return (
      <div style={{ ...styles.page, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>Page not found</p>
          <a href="/dashboard" style={{ color: 'var(--accent)' }}>Go to your dashboard</a>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <a href="/dashboard" className="btn btn-secondary" style={{ textDecoration: 'none', padding: '6px 10px' }}>
              <ArrowLeft size={15} /> Dashboard
            </a>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Admin</h1>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{window.location.host}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            {data && <span>Updated {formatClock(data.generatedAt)}</span>}
            <button className="btn btn-secondary" onClick={load} disabled={refreshing} style={{ padding: '6px 10px' }}>
              <RefreshCw size={14} /> {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        {error && (
          <p style={{ ...styles.panel, margin: 0, color: 'var(--text-primary)' }}>
            Couldn’t load the dashboard: {error}. It retries every minute, or use Refresh.
          </p>
        )}

        {data && <AdminDashboard data={data} refreshing={refreshing} />}
      </div>
    </div>
  )
}

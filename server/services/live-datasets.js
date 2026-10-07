// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Live datasets: fetched from their source when made, then on a schedule.
// A fetch whose data changed is kept as a new version and made current; an
// unchanged or failed one leaves the current version as it is.

const { safeFetch } = require('./safe-fetch')
const { normalizeSource, requestUrl, sourceLabel, readAnswer, SourceError } = require('./live-sources')
const { runInWorker, storeColumns, deleteDatasetFile, datasetName } = require('./dataset-service')
const { unpackTable, tableToRows } = require('./dataset-table')

const HOUR = 60 * 60 * 1000
const SCHEDULES = { hourly: HOUR, daily: 24 * HOUR, weekly: 7 * 24 * HOUR }
// Fastest first; a plan's min_refresh is the fastest it may use
const SCHEDULE_ORDER = ['hourly', 'daily', 'weekly', 'manual']
const MAX_FETCH_BYTES = 100 * 1024 * 1024
// The current version, the 4 before it, and any a deck pins
const KEEP_VERSIONS = 5
const MAX_FAILURES = 10
const RETRY_BASE = 15 * 60 * 1000

// The plan an owner is on, as plans.js gives it, or null where there are no
// plans (self-hosted)
function planOf(name) {
  if (!name) return null
  try { return require('./plans').planFor(name) } catch { return null }
}

function allowedSchedule(schedule, plan) {
  if (!SCHEDULE_ORDER.includes(schedule)) return false
  if (!plan || !plan.minRefresh || schedule === 'manual') return true
  return SCHEDULE_ORDER.indexOf(schedule) >= SCHEDULE_ORDER.indexOf(plan.minRefresh)
}

// When to fetch next after a fetch that worked: the schedule's interval and
// up to 10% more, so datasets made together don't stay together
function nextFetch(schedule, now = Date.now()) {
  const interval = SCHEDULES[schedule]
  if (!interval) return null
  return new Date(now + interval * (1 + Math.random() * 0.1)).toISOString()
}

// After a failed one: 15 min, doubling with each failure in a row, never
// later than the schedule would be; nothing after 10 in a row (paused)
function retryAt(schedule, failures, now = Date.now(), retryAfterMs = 0) {
  if (failures >= MAX_FAILURES || !SCHEDULES[schedule]) return null
  const wait = Math.min(SCHEDULES[schedule], RETRY_BASE * 2 ** (failures - 1))
  return new Date(now + Math.max(wait, retryAfterMs)).toISOString()
}

function retryAfterMs(res) {
  const value = res && res.headers && res.headers['retry-after']
  if (!value) return 0
  const secs = Number(value)
  if (Number.isFinite(secs)) return Math.min(secs * 1000, 7 * 24 * HOUR)
  const at = Date.parse(value)
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : 0
}

function fetchLimit(plan) {
  return Math.min(MAX_FETCH_BYTES, (plan && plan.maxFileBytes) || MAX_FETCH_BYTES)
}

// Refuses a new version that wouldn't fit in the owner's storage (cloud only)
async function checkRoom(storage, userId, plan, bytes) {
  if (!storage.query || !plan || !plan.storageBytes || !userId) return
  const { storageUsedBytes } = require('../middleware/upload-quota')
  const used = await storageUsedBytes(storage, userId)
  if (used + bytes > plan.storageBytes) {
    throw new SourceError(`Storage full: this version needs ${Math.ceil(bytes / 1024)} KB more than the ${Math.round(plan.storageBytes / (1024 * 1024))} MB on the ${plan.name} plan`)
  }
}

// Fetches and parses a source. Resolves to { unchanged: true } on a 304, or
// to the packed data with the response's validators; throws a SourceError
// (or a FetchError) saying what went wrong
async function fetchAndPack(kind, source, { secret, etag, lastModified, maxBytes, fetchOptions = {} }) {
  const headers = {}
  if (secret && secret.name) headers[secret.name] = secret.value
  if (etag) headers['If-None-Match'] = etag
  else if (lastModified) headers['If-Modified-Since'] = lastModified
  let res
  try {
    res = await safeFetch(requestUrl(kind, source), { ...fetchOptions, headers, maxBytes })
  } catch (err) {
    throw Object.assign(err, { response: null })
  }
  if (res.status === 304) return { unchanged: true, httpStatus: 304, bytes: 0 }
  let answer
  try { answer = readAnswer(kind, source, res) } catch (err) { throw Object.assign(err, { response: res }) }
  const packed = await runInWorker(answer.body, answer.format, { rowsPath: source.rowsPath, keyColumn: source.keyColumn })
  return {
    ...packed, httpStatus: res.status, bytes: res.body.length,
    etag: res.headers.etag || null, lastModified: res.headers['last-modified'] || null,
  }
}

// A header secret as stored: "Name: value", parsed
function parseSecret(text) {
  if (!text) return null
  const i = text.indexOf(':')
  if (i < 1) throw new SourceError('Write the header as Name: value, such as X-API-Key: abc123')
  const name = text.slice(0, i).trim()
  if (!/^[A-Za-z0-9-]{1,100}$/.test(name)) throw new SourceError('A header name has only letters, digits and dashes')
  return { name, value: text.slice(i + 1).trim() }
}

// Fetches a source once without saving anything: its columns and first rows
async function testSource(kind, input, { secret, plan, fetchOptions } = {}) {
  const source = normalizeSource(kind, input)
  const packed = await fetchAndPack(kind, source, { secret: parseSecret(secret), maxBytes: fetchLimit(plan), fetchOptions })
  const table = await unpackTable(packed.gz)
  return {
    columns: packed.columns, rowCount: packed.rowCount,
    rows: tableToRows({ ...table, length: Math.min(20, table.length) }),
  }
}

async function saveVersion(storage, ds, packed, { userId, keyPrefix, localDir }) {
  const storageKey = await storeColumns(packed.gz, { name: ds.name, keyPrefix: keyPrefix || userId || 'local', localDir })
  const version = await storage.createDatasetVersion(ds.id, {
    storageKey, format: 'columns', contentHash: packed.hash, columns: packed.columns,
    rowCount: packed.rowCount, byteSize: packed.gz.length, etag: packed.etag, lastModified: packed.lastModified,
  })
  await storage.setCurrentVersion(ds.id, version)
  return version
}

// Deletes the versions past KEEP_VERSIONS that no deck pins, and their files
async function pruneVersions(storage, ds, localDir) {
  const versions = await storage.listDatasetVersions(ds.id)
  const current = (await storage.getDatasetForFetch(ds.id))?.currentVersionId
  const drop = versions.slice(KEEP_VERSIONS).filter(v => !v.pinnedBy.length && v.id !== current)
  const keys = await storage.deleteDatasetVersions(ds.id, drop.map(v => v.id))
  for (const key of keys) deleteDatasetFile(key, localDir).catch(e => console.error('Old dataset version not deleted:', e.message))
}

// Makes a live dataset from a source whose first fetch works. Throws a
// SourceError (or FetchError) when it doesn't, an error with code
// 'duplicate' when the name is taken
async function createLiveDataset(storage, { userId, plan, keyPrefix }, input, { localDir, fetchOptions } = {}) {
  const kind = input.sourceKind
  const source = normalizeSource(kind, input.source)
  const schedule = input.schedule || 'daily'
  if (!allowedSchedule(schedule, plan)) throw new SourceError(`The ${plan?.name || 'current'} plan refreshes at most ${plan?.minRefresh}`)
  const name = datasetName(input.name || '')
  if (!name || !/[a-z0-9]/.test(name)) throw new SourceError('Give the dataset a name')
  if (await storage.getDatasetByName(name, userId)) {
    throw Object.assign(new Error(`You already have a dataset named "${name}"`), { code: 'duplicate' })
  }
  const secret = parseSecret(input.secret)
  const startedAt = new Date()
  const packed = await fetchAndPack(kind, source, { secret, maxBytes: fetchLimit(plan), fetchOptions })
  if (packed.unchanged) throw new SourceError('The source answered 304 Not Modified to a first request')
  await checkRoom(storage, userId, plan, packed.gz.length)
  const ds = await storage.createLiveDataset({
    name, filename: sourceLabel(kind, source), sourceKind: kind, source, sourceSecret: input.secret || null,
    schedule, nextFetchAt: nextFetch(schedule),
  }, userId)
  try {
    await saveVersion(storage, ds, packed, { userId, keyPrefix, localDir })
  } catch (err) {
    await storage.deleteDataset(ds.id, userId)
    throw err
  }
  await storage.recordFetch(ds.id, { startedAt, durationMs: Date.now() - startedAt, outcome: 'changed', httpStatus: packed.httpStatus, bytes: packed.bytes })
  return storage.getDataset(ds.id, userId)
}

// Fetches a live dataset now and keeps a new version if its data changed.
// The caller holds its lease (claimDueDatasets or leaseDataset); this gives
// it up. Resolves to { outcome: 'changed' | 'unchanged' | 'failed', error }
async function refreshDataset(storage, id, { localDir, fetchOptions } = {}) {
  const ds = await storage.getDatasetForFetch(id)
  if (!ds || ds.sourceKind === 'upload') return { outcome: 'failed', error: 'Not a live dataset' }
  const plan = planOf(ds.plan)
  const startedAt = new Date()
  const current = ds.currentVersionId ? await storage.getDatasetVersion(id, ds.currentVersionId) : null
  try {
    const secret = ds.secret ? parseSecret(ds.secret) : null
    const packed = await fetchAndPack(ds.sourceKind, ds.source, {
      secret, etag: current?.etag, lastModified: current?.lastModified, maxBytes: fetchLimit(plan), fetchOptions,
    })
    let outcome = 'unchanged'
    if (!packed.unchanged && packed.hash !== current?.contentHash) {
      await checkRoom(storage, ds.userId, plan, packed.gz.length)
      await saveVersion(storage, ds, packed, { userId: ds.userId, localDir })
      await pruneVersions(storage, ds, localDir)
      outcome = 'changed'
    }
    await storage.recordFetch(id, { startedAt, durationMs: Date.now() - startedAt, outcome, httpStatus: packed.httpStatus, bytes: packed.bytes })
    await storage.recordFetchState(id, { fetched: true, lastError: null, failures: 0, nextFetchAt: nextFetch(ds.schedule) })
    return { outcome }
  } catch (err) {
    const error = err.sourceError || err.fetchError ? err.message : `Fetching failed: ${err.message}`
    const failures = (ds.failures || 0) + 1
    await storage.recordFetch(id, {
      startedAt, durationMs: Date.now() - startedAt, outcome: 'failed', httpStatus: err.response?.status || null,
      bytes: err.response?.body?.length ?? null, error,
    })
    const paused = failures >= MAX_FAILURES
    await storage.recordFetchState(id, {
      fetched: false, failures,
      lastError: paused ? `${error} (paused after ${MAX_FAILURES} failed fetches in a row)` : error,
      nextFetchAt: retryAt(ds.schedule, failures, Date.now(), retryAfterMs(err.response)),
    })
    return { outcome: 'failed', error }
  }
}

// Fetches the datasets that are due, every minute: each under a lease (see
// claimDueDatasets), two at a time, until none are due. Once an hour it
// also deletes fetch-log rows over 30 days old. A first pass soon after the
// server starts catches up on what fell due while it was down (the desktop
// app, closed). Returns { tick, stop }.
function startRefreshLoop(storage, { localDir, intervalMs = 60 * 1000, concurrency = 2, leaseSeconds = 600, firstAfterMs = 5000, fetchOptions } = {}) {
  let busy = false
  let stopped = false
  let prunedAt = 0
  async function tick() {
    if (busy || stopped) return
    busy = true
    try {
      if (Date.now() - prunedAt > HOUR) {
        prunedAt = Date.now()
        await storage.pruneDatasetFetches(30)
      }
      while (!stopped) {
        const ids = await storage.claimDueDatasets(concurrency, leaseSeconds)
        if (!ids.length) break
        await Promise.all(ids.map(id => refreshDataset(storage, id, { localDir, fetchOptions })
          .catch(err => console.error('Live dataset refresh failed:', err.message))))
      }
    } catch (err) {
      console.error('Live dataset refresh loop:', err.message)
    } finally {
      busy = false
    }
  }
  const timer = setInterval(tick, intervalMs)
  const first = setTimeout(tick, firstAfterMs)
  timer.unref?.()
  first.unref?.()
  return { tick, stop() { stopped = true; clearInterval(timer); clearTimeout(first) } }
}

module.exports = {
  SCHEDULES, SCHEDULE_ORDER, KEEP_VERSIONS, MAX_FAILURES,
  allowedSchedule, nextFetch, retryAt, parseSecret, fetchLimit, planOf,
  testSource, createLiveDataset, refreshDataset, pruneVersions, startRefreshLoop,
}

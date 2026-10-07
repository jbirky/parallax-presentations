// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Transforms: steps that shape a dataset for a slide (keep some rows, add a
// column, count by group, bin for a histogram, join another dataset). They
// are saved with the dataset and run on whichever version is read, so they
// follow every refresh of a live dataset, and a pinned version gets them too.

const crypto = require('crypto')
const { compile } = require('./dataset-expr')
const { passes, inferColumns, tableBytes } = require('./dataset-table')

const MAX_STEPS = 20
const AGGREGATES = ['count', 'sum', 'mean', 'min', 'max', 'median']

class TransformError extends Error {
  constructor(message) {
    super(message)
    this.transformError = true
  }
}

// --- Checking steps ---

const isName = v => typeof v === 'string' && v.length > 0 && v.length <= 200 && v !== '__proto__'
function name(value, label) {
  if (!isName(value)) throw new Error(`${label} must be a column name`)
  return value
}
function names(value, label, { min = 1, max = 200 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max || !value.every(isName)) {
    throw new Error(`${label} must be a list of column names`)
  }
  return [...new Set(value)]
}
function whole(value, label, min, max, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label} must be a whole number from ${min} to ${max}`)
  return n
}
function oneOf(value, options, label, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  if (!options.includes(value)) throw new Error(`${label} must be ${options.join(' or ')}`)
  return value
}
function expression(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Write an expression')
  if (value.length > 1000) throw new Error('Keep an expression under 1000 characters')
  return value.trim()
}

function normalizeStep(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error('Each step is an object with an op')
  switch (s.op) {
    case 'filter':
      if (s.expr !== undefined) return { op: 'filter', expr: expression(s.expr) }
      if (s.where && typeof s.where === 'object' && !Array.isArray(s.where) && Object.keys(s.where).every(isName)) return { op: 'filter', where: s.where }
      throw new Error('A filter keeps rows by an expression, such as pl_bmasse > 10')
    case 'select':
      return { op: 'select', columns: names(s.columns, 'The columns to keep') }
    case 'rename':
      return { op: 'rename', from: name(s.from, 'The column to rename'), to: name(s.to, 'The new name') }
    case 'compute':
      return { op: 'compute', name: name(s.name, 'The new column’s name'), expr: expression(s.expr) }
    case 'sort':
      return { op: 'sort', column: name(s.column, 'The column to sort by'), direction: oneOf(s.direction, ['asc', 'desc'], 'The direction', 'asc') }
    case 'group': {
      const by = names(s.by, 'The columns to group by', { max: 10 })
      if (!Array.isArray(s.aggregates) || !s.aggregates.length || s.aggregates.length > 20) throw new Error('Say what to work out for each group, such as a count')
      const aggregates = s.aggregates.map(a => {
        if (!a || !AGGREGATES.includes(a.fn)) throw new Error(`A group works out ${AGGREGATES.join(', ')}`)
        const column = a.column ? name(a.column, 'The column to work it out from') : null
        if (a.fn !== 'count' && !column) throw new Error(`A ${a.fn} needs a column`)
        return { fn: a.fn, column, name: a.name ? name(a.name, 'The result’s name') : column ? `${a.fn}_${column}` : 'count' }
      })
      return { op: 'group', by, aggregates }
    }
    case 'bin':
      return {
        op: 'bin', column: name(s.column, 'The column to bin'), bins: whole(s.bins, 'The number of bins', 1, 1000, 20),
        scale: oneOf(s.scale, ['linear', 'log'], 'The scale', 'linear'),
      }
    case 'bin2d': {
      const x = name(s.x, 'The x column'), y = name(s.y, 'The y column')
      if (x === y) throw new Error('Bin two different columns')
      return {
        op: 'bin2d', x, y,
        xBins: whole(s.xBins, 'The number of x bins', 1, 500, 40), yBins: whole(s.yBins, 'The number of y bins', 1, 500, 40),
        xScale: oneOf(s.xScale, ['linear', 'log'], 'The x scale', 'linear'), yScale: oneOf(s.yScale, ['linear', 'log'], 'The y scale', 'linear'),
      }
    }
    case 'join': {
      if (typeof s.dataset !== 'string' || !/^[a-z0-9_-]{1,200}$/.test(s.dataset)) throw new Error('Name the dataset to join')
      const leftOn = name(s.leftOn || s.on, 'The column to match on')
      const rightOn = name(s.rightOn || s.on, 'The other dataset’s column to match on')
      return {
        op: 'join', dataset: s.dataset, leftOn, rightOn,
        columns: s.columns ? names(s.columns, 'The columns to bring over') : null,
        how: oneOf(s.how, ['left', 'inner'], 'The join', 'left'),
      }
    }
    case 'limit':
      return { op: 'limit', count: whole(s.count, 'The number of rows', 1, 10000000, 100) }
    default:
      throw new Error('Each step is filter, select, rename, compute, sort, group, bin, bin2d, join or limit')
  }
}

// Checks a list of steps (their shape: the columns they name depend on the
// data, and are checked when they run); returns them cleaned
function normalizeTransforms(steps) {
  if (!Array.isArray(steps)) throw new TransformError('Transforms are a list of steps')
  if (steps.length > MAX_STEPS) throw new TransformError(`Keep to ${MAX_STEPS} steps`)
  return steps.map((step, i) => {
    try { return normalizeStep(step) } catch (err) { throw new TransformError(`Step ${i + 1}: ${err.message}`) }
  })
}

// --- Running them ---

function makeTable(order, byName, length) {
  const columns = Object.create(null)
  for (const n of order) columns[n] = byName[n]
  return { names: order, columns, length }
}

function pickRows(table, rows) {
  const columns = Object.create(null)
  for (const n of table.names) { const v = table.columns[n]; columns[n] = rows.map(i => v[i]) }
  return { names: table.names, columns, length: rows.length }
}

function need(table, column) {
  if (!Object.hasOwn(table.columns, column)) throw new Error(`There’s no column "${column}"`)
  return table.columns[column]
}

const truthy = v => v !== null && v !== undefined && v !== false && v !== 0 && v !== ''
const isNum = v => typeof v === 'number' && Number.isFinite(v)

function median(values) {
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function aggregate(fn, values) {
  if (fn === 'count') return values.length
  const nums = values.filter(isNum)
  if (!nums.length) return fn === 'sum' ? 0 : null
  if (fn === 'sum') return nums.reduce((a, b) => a + b, 0)
  if (fn === 'mean') return nums.reduce((a, b) => a + b, 0) / nums.length
  if (fn === 'min') return nums.reduce((a, b) => (b < a ? b : a))
  if (fn === 'max') return nums.reduce((a, b) => (b > a ? b : a))
  return median(nums)
}

// Bin edges over a column's values: evenly spaced, or evenly in log10 (only
// positive values count there)
function edges(values, bins, scale) {
  const usable = values.filter(v => isNum(v) && (scale !== 'log' || v > 0))
  if (!usable.length) return null
  let lo = Math.min(...usable.slice(0, 100000)), hi = Math.max(...usable.slice(0, 100000))
  for (let i = 100000; i < usable.length; i++) { if (usable[i] < lo) lo = usable[i]; if (usable[i] > hi) hi = usable[i] }
  const f = scale === 'log' ? Math.log10 : x => x
  const g = scale === 'log' ? x => 10 ** x : x => x
  const a = f(lo), b = f(hi)
  const width = b > a ? (b - a) / bins : 1
  const list = Array.from({ length: bins + 1 }, (_, k) => g(a + width * k))
  list[0] = lo
  if (b > a) list[bins] = hi
  // The bin a value falls in, or -1
  const index = v => {
    if (!isNum(v) || (scale === 'log' && v <= 0)) return -1
    const k = Math.floor((f(v) - a) / width)
    return Math.min(Math.max(k, 0), bins - 1)
  }
  return { list, index }
}

function runStep(table, step, joined) {
  switch (step.op) {
    case 'filter': {
      const rows = []
      if (step.expr) {
        const test = compile(step.expr, table.columns)
        for (let i = 0; i < table.length; i++) if (truthy(test(i))) rows.push(i)
      } else {
        const conditions = Object.entries(step.where).map(([col, c]) => [need(table, col), c])
        for (let i = 0; i < table.length; i++) if (conditions.every(([values, c]) => passes(values[i], c))) rows.push(i)
      }
      return pickRows(table, rows)
    }
    case 'select': {
      for (const c of step.columns) need(table, c)
      return makeTable(step.columns, table.columns, table.length)
    }
    case 'rename': {
      need(table, step.from)
      if (step.from === step.to) return table
      if (Object.hasOwn(table.columns, step.to)) throw new Error(`There’s already a column "${step.to}"`)
      const byName = Object.create(null)
      for (const n of table.names) byName[n === step.from ? step.to : n] = table.columns[n]
      return makeTable(table.names.map(n => (n === step.from ? step.to : n)), byName, table.length)
    }
    case 'compute': {
      const f = compile(step.expr, table.columns)
      const values = Array.from({ length: table.length }, (_, i) => { const v = f(i); return v === undefined ? null : v })
      const byName = Object.assign(Object.create(null), table.columns, { [step.name]: values })
      const order = table.names.includes(step.name) ? table.names : [...table.names, step.name]
      return makeTable(order, byName, table.length)
    }
    case 'sort': {
      const values = need(table, step.column)
      const dir = step.direction === 'desc' ? -1 : 1
      const rows = Array.from({ length: table.length }, (_, i) => i)
      // Missing values last, whichever way
      rows.sort((a, b) => {
        const x = values[a], y = values[b]
        if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1
        return x < y ? -dir : x > y ? dir : 0
      })
      return pickRows(table, rows)
    }
    case 'group': {
      const keys = step.by.map(c => need(table, c))
      for (const a of step.aggregates) if (a.column) need(table, a.column)
      const groups = new Map()
      for (let i = 0; i < table.length; i++) {
        const key = JSON.stringify(keys.map(values => values[i] ?? null))
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(i)
      }
      const byName = Object.create(null)
      const firsts = [...groups.values()].map(rows => rows[0])
      step.by.forEach((c, k) => { byName[c] = firsts.map(i => keys[k][i] ?? null) })
      for (const a of step.aggregates) {
        const values = a.column ? table.columns[a.column] : null
        byName[a.name] = [...groups.values()].map(rows => (
          a.fn === 'count' && !values ? rows.length : aggregate(a.fn, rows.map(i => values[i]).filter(v => v != null))
        ))
      }
      const order = [...new Set([...step.by, ...step.aggregates.map(a => a.name)])]
      return makeTable(order, byName, groups.size)
    }
    case 'bin': {
      const values = need(table, step.column)
      const e = edges(values, step.bins, step.scale)
      const counts = new Array(step.bins).fill(0)
      if (e) for (const v of values) { const k = e.index(v); if (k >= 0) counts[k]++ }
      const from = `${step.column}_from`, to = `${step.column}_to`
      return makeTable([from, to, 'count'], {
        [from]: e ? e.list.slice(0, -1) : [], [to]: e ? e.list.slice(1) : [], count: e ? counts : [],
      }, e ? step.bins : 0)
    }
    case 'bin2d': {
      const xs = need(table, step.x), ys = need(table, step.y)
      const ex = edges(xs, step.xBins, step.xScale), ey = edges(ys, step.yBins, step.yScale)
      const cells = new Map()
      if (ex && ey) {
        for (let i = 0; i < table.length; i++) {
          const a = ex.index(xs[i]), b = ey.index(ys[i])
          if (a < 0 || b < 0) continue
          const key = a * step.yBins + b
          cells.set(key, (cells.get(key) || 0) + 1)
        }
      }
      // Only the bins something fell in, in x then y order
      const keys = [...cells.keys()].sort((p, q) => p - q)
      const xa = keys.map(k => Math.floor(k / step.yBins)), yb = keys.map(k => k % step.yBins)
      const out = {
        [`${step.x}_from`]: xa.map(a => ex.list[a]), [`${step.x}_to`]: xa.map(a => ex.list[a + 1]),
        [`${step.y}_from`]: yb.map(b => ey.list[b]), [`${step.y}_to`]: yb.map(b => ey.list[b + 1]),
        count: keys.map(k => cells.get(k)),
      }
      return makeTable(Object.keys(out), out, keys.length)
    }
    case 'join': {
      const right = joined.get(step.dataset)
      if (!right) throw new Error(`There’s no dataset "${step.dataset}"`)
      const leftKeys = need(table, step.leftOn)
      const rightKeys = need(right, step.rightOn)
      const bring = step.columns || right.names.filter(n => n !== step.rightOn)
      for (const c of bring) need(right, c)
      const index = new Map()
      for (let j = 0; j < right.length; j++) {
        const k = rightKeys[j]
        if (k != null && !index.has(String(k))) index.set(String(k), j)
      }
      const matches = Array.from({ length: table.length }, (_, i) => (leftKeys[i] == null ? undefined : index.get(String(leftKeys[i]))))
      const rows = []
      for (let i = 0; i < table.length; i++) if (step.how === 'left' || matches[i] !== undefined) rows.push(i)
      const base = pickRows(table, rows)
      const byName = Object.assign(Object.create(null), base.columns)
      const order = [...base.names]
      for (const c of bring) {
        const out = Object.hasOwn(byName, c) ? `${c}_${step.dataset}` : c
        byName[out] = rows.map(i => (matches[i] === undefined ? null : right.columns[c][matches[i]]))
        order.push(out)
      }
      return makeTable(order, byName, rows.length)
    }
    case 'limit':
      return table.length <= step.count ? table : pickRows(table, Array.from({ length: step.count }, (_, i) => i))
  }
  throw new Error(`Unknown step ${step.op}`)
}

// Runs steps over a table. `joined` maps the name of each dataset a join
// step names to its table (missing ones fail that step)
function runTransforms(table, steps, joined = new Map()) {
  let t = table
  steps.forEach((step, i) => {
    try { t = runStep(t, step, joined) } catch (err) {
      throw new TransformError(`Step ${i + 1} (${step.op}): ${err.message}`)
    }
  })
  return t
}

// The datasets a list of steps joins, by name
const joinedNames = steps => [...new Set(steps.filter(s => s.op === 'join').map(s => s.dataset))]

// Transformed tables, by what they were made from: the source's storage key,
// the steps, and the storage key of each joined dataset. Up to 64 MB
const CACHE_BYTES = 64 * 1024 * 1024
const cache = new Map()
let cachedBytes = 0

function cacheKey(sourceKey, steps, joinedKeys) {
  return crypto.createHash('sha256').update(JSON.stringify([sourceKey, steps, joinedKeys])).digest('hex')
}

// A table with steps run on it, from the cache when the same source, steps
// and joined data made it before. `loadJoined(name)` resolves to
// { key, table } for another of the owner's datasets, or null
async function transformTable(table, sourceKey, steps, loadJoined) {
  if (!steps || !steps.length) return table
  const joined = new Map()
  const joinedKeys = []
  for (const n of joinedNames(steps)) {
    const other = await loadJoined(n)
    if (other) { joined.set(n, other.table); joinedKeys.push([n, other.key]) }
  }
  const key = cacheKey(sourceKey, steps, joinedKeys)
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit.table
  }
  const out = runTransforms(table, steps, joined)
  const bytes = tableBytes(out)
  if (bytes <= CACHE_BYTES / 4) {
    cache.set(key, { table: out, bytes })
    cachedBytes += bytes
    for (const [k, entry] of cache) {
      if (cachedBytes <= CACHE_BYTES) break
      cache.delete(k)
      cachedBytes -= entry.bytes
    }
  }
  return out
}

module.exports = { normalizeTransforms, runTransforms, transformTable, joinedNames, TransformError, inferColumns, MAX_STEPS }

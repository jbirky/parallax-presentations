// Datasets as tables, column by column: the query over them, sorting by a
// key, and the stored columns copy. Needs nothing.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  rowsToTable, tableToRows, inferColumns, sortTableBy, packTable, unpackTable, processBody, likeMatch, applyQuery,
} = require('../services/dataset-table')

// The query as it ran over rows, before datasets were read as tables
function rowQuery(rows, columns, opts = {}) {
  let filtered = rows
  if (opts.where) {
    filtered = filtered.filter(row => {
      for (const [col, conditions] of Object.entries(opts.where)) {
        const val = row[col]
        if (conditions.eq != null && val !== conditions.eq) return false
        if (conditions.neq != null && val === conditions.neq) return false
        if (conditions.gt != null && !(val > conditions.gt)) return false
        if (conditions.gte != null && !(val >= conditions.gte)) return false
        if (conditions.lt != null && !(val < conditions.lt)) return false
        if (conditions.lte != null && !(val <= conditions.lte)) return false
        if (conditions.in && !conditions.in.includes(val)) return false
        if (conditions.like && !likeMatch(val, conditions.like)) return false
      }
      return true
    })
  }
  if (opts.orderBy) {
    const col = typeof opts.orderBy === 'string' ? opts.orderBy : opts.orderBy.column
    const dir = (typeof opts.orderBy === 'object' && opts.orderBy.direction === 'desc') ? -1 : 1
    filtered = [...filtered].sort((a, b) => {
      if (a[col] < b[col]) return -dir
      if (a[col] > b[col]) return dir
      return 0
    })
  }
  const totalRows = filtered.length
  if (opts.offset) filtered = filtered.slice(opts.offset)
  if (opts.limit) filtered = filtered.slice(0, opts.limit)
  const result = {}
  for (const col of opts.columns || columns.map(c => c.name)) result[col] = filtered.map(r => r[col] ?? null)
  return { columns: result, totalRows }
}

// A seeded random source, so a failure can be run again
function random(seed) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
}

function randomRows(rnd, n) {
  const words = ['Mars', 'mercury', 'Venus', 'earth', 'Kepler-452 b', 'TOI-700 d', '', 'm_x']
  return Array.from({ length: n }, () => ({
    planet: words[Math.floor(rnd() * words.length)],
    period: rnd() < 0.1 ? null : Math.round(rnd() * 1000) / 10,
    year: 1990 + Math.floor(rnd() * 36),
    flag: rnd() < 0.5,
  }))
}

function randomQuery(rnd) {
  const pick = list => list[Math.floor(rnd() * list.length)]
  const opts = {}
  if (rnd() < 0.7) {
    const where = {}
    if (rnd() < 0.5) where.year = pick([{ gt: 2000 }, { gte: 2010, lt: 2020 }, { lte: 1995 }, { eq: 2001 }, { neq: 2001 }, { in: [1999, 2005, 2020] }])
    if (rnd() < 0.5) where.planet = pick([{ like: 'm%' }, { like: '%e%' }, { eq: 'Mars' }, { in: ['Venus', ''] }, { like: '_ars' }])
    if (rnd() < 0.3) where.period = pick([{ gt: 50 }, { lt: 10 }, { neq: null }])
    if (rnd() < 0.2) where.flag = { eq: true }
    opts.where = where
  }
  if (rnd() < 0.6) opts.orderBy = pick(['year', 'planet', 'period', { column: 'year', direction: 'desc' }, { column: 'planet', direction: 'desc' }])
  if (rnd() < 0.4) opts.offset = Math.floor(rnd() * 30)
  if (rnd() < 0.5) opts.limit = 1 + Math.floor(rnd() * 40)
  if (rnd() < 0.3) opts.columns = pick([['year'], ['planet', 'period'], ['period', 'missing']])
  return opts
}

describe('a query over a table', () => {
  it('answers as the query over rows did, for every operator, order, offset and limit', () => {
    const rnd = random(20261007)
    const columns = [{ name: 'planet' }, { name: 'period' }, { name: 'year' }, { name: 'flag' }]
    for (let t = 0; t < 400; t++) {
      const rows = randomRows(rnd, Math.floor(rnd() * 80))
      const opts = randomQuery(rnd)
      assert.deepEqual(applyQuery(rowsToTable(rows), columns, opts), rowQuery(rows, columns, opts), JSON.stringify(opts))
    }
  })

  it('gives every column when none are named, and nulls for a column it lacks', () => {
    const table = rowsToTable([{ a: 1, b: 'x' }, { a: 2 }])
    assert.deepEqual(applyQuery(table, null, {}).columns, { a: [1, 2], b: ['x', null] })
    assert.deepEqual(applyQuery(table, null, { columns: ['c'] }).columns, { c: [null, null] })
  })
})

describe('a table', () => {
  it('has a column for every key any row has, in the order they appear', () => {
    const table = rowsToTable([{ b: 1 }, { a: 2, b: 3 }])
    assert.deepEqual(table.names, ['b', 'a'])
    assert.deepEqual(tableToRows(table), [{ b: 1, a: null }, { a: 2, b: 3 }])
    assert.throws(() => rowsToTable([1, 2]), /object/)
  })

  it('describes its columns as uploads always have', () => {
    const cols = inferColumns(rowsToTable([{ n: 1, x: 1.5, s: 'a', d: '2026-10-07' }, { n: 2, x: null, s: 'b', d: '2026-10-08' }]))
    assert.deepEqual(cols.map(c => [c.name, c.type, c.nullable]), [['n', 'integer', false], ['x', 'float', true], ['s', 'string', false], ['d', 'date', false]])
  })

  it('sorts by a key column, the same way whatever order the rows came in', () => {
    const rows = [{ k: 'b', v: 2 }, { k: null, v: 0 }, { k: 'a', v: 1 }, { k: 10, v: 3 }]
    const sorted = sortTableBy(rowsToTable(rows), 'k')
    assert.deepEqual(sorted.columns.k, [10, 'a', 'b', null])
    assert.deepEqual(sortTableBy(rowsToTable([...rows].reverse()), 'k').columns.v, sorted.columns.v)
  })

  it('comes back from its columns copy unchanged, column names that look like numbers in place', async () => {
    const table = rowsToTable([{ name: 'x', 2020: 1, 1999: 2 }, { name: 'y', 2020: 3, 1999: null }])
    const { gz, hash } = await packTable(table)
    const back = await unpackTable(gz)
    assert.deepEqual(back.names, table.names)
    assert.deepEqual(tableToRows(back), tableToRows(table))
    assert.match(hash, /^[0-9a-f]{64}$/)
  })
})

describe('a response made ready to store', () => {
  it('hashes the same whatever order the rows came in, given a key column', async () => {
    const a = await processBody(Buffer.from('name,mass\nb,2\na,1\n'), 'csv', { keyColumn: 'name' })
    const b = await processBody(Buffer.from('name,mass\na,1\nb,2\n'), 'csv', { keyColumn: 'name' })
    const c = await processBody(Buffer.from('name,mass\na,1\nb,3\n'), 'csv', { keyColumn: 'name' })
    assert.equal(a.hash, b.hash)
    assert.notEqual(a.hash, c.hash)
    assert.equal(a.rowCount, 2)
    await assert.rejects(processBody(Buffer.from('name\na\n'), 'csv', { keyColumn: 'id' }), /key column "id"/)
  })

  it('finds JSON rows at a path', async () => {
    const body = Buffer.from(JSON.stringify({ result: { items: [{ a: 1 }, { a: 2 }] } }))
    const { rowCount, columns } = await processBody(body, 'json', { rowsPath: 'result.items' })
    assert.equal(rowCount, 2)
    assert.equal(columns[0].name, 'a')
    await assert.rejects(processBody(body, 'json', { rowsPath: 'result.missing' }), /No list of rows at "result.missing"/)
    await assert.rejects(processBody(body, 'json', { rowsPath: '__proto__' }), /No list of rows/)
  })
})

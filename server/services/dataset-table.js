// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A dataset in memory is a table: its column names in order, and an array of
// values for each, all `length` long. Nothing here reads or writes storage,
// so the parse worker (dataset-worker.js) runs the same code as the server.

const crypto = require('crypto')
const zlib = require('zlib')
const { promisify } = require('util')
const { parse: csvParser } = require('csv-parse')

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

// A file's rows. A CSV or TSV is parsed a chunk at a time, with the server
// free in between: parsed in one go, a large file held up every other request
// (and live editing) for seconds, on every read
const CSV_CHUNK = 256 * 1024

async function parseRows(buffer, format, { rowsPath } = {}) {
  if (format === 'csv' || format === 'tsv') {
    const parser = csvParser({
      // A column named __proto__ would be each row's prototype
      columns: header => header.map(name => (name === '__proto__' ? '_proto_' : name)),
      skip_empty_lines: true, delimiter: format === 'tsv' ? '\t' : ',', cast: true, relax_column_count: true,
    })
    const rows = []
    parser.on('readable', () => { let row; while ((row = parser.read()) !== null) rows.push(row) })
    const done = new Promise((resolve, reject) => { parser.on('end', resolve); parser.on('error', reject) })
    // A bad line rejects `done` while this is between chunks, before it's
    // awaited: unheard, that rejection would end the process
    done.catch(() => {})
    for (let i = 0; i < buffer.length && !parser.destroyed; i += CSV_CHUNK) {
      parser.write(buffer.subarray(i, i + CSV_CHUNK))
      await new Promise(resolve => setImmediate(resolve))
    }
    if (!parser.destroyed) parser.end()
    await done
    return rows
  }
  if (format === 'json') {
    const parsed = JSON.parse(buffer.toString('utf8'))
    if (rowsPath) {
      const rows = String(rowsPath).split('.').filter(Boolean)
        .reduce((at, key) => (at && typeof at === 'object' && Object.hasOwn(at, key) ? at[key] : undefined), parsed)
      if (!Array.isArray(rows)) throw new Error(`No list of rows at "${rowsPath}" in the JSON`)
      return rows
    }
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray(parsed.data)) return parsed.data
    throw new Error('JSON must be an array of objects or have a "data" array property')
  }
  throw new Error(`Unsupported format: ${format}`)
}

// The table rows make: a column for every key any row has, in the order
// they first appear, and null where a row lacks one
function rowsToTable(rows) {
  const names = []
  const from = new Map()  // column name -> the key it's read from
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Each row must be an object of named values')
    for (const key of Object.keys(row)) {
      const name = key === '__proto__' ? '_proto_' : key
      if (!from.has(name)) { from.set(name, key); names.push(name) }
    }
  }
  const columns = Object.create(null)
  for (const name of names) {
    const key = from.get(name)
    const values = new Array(rows.length)
    for (let i = 0; i < rows.length; i++) {
      const v = Object.hasOwn(rows[i], key) ? rows[i][key] : null
      values[i] = v === undefined ? null : v
    }
    columns[name] = values
  }
  return { names, columns, length: rows.length }
}

function tableToRows(table) {
  return Array.from({ length: table.length }, (_, i) => {
    const row = {}
    for (const name of table.names) row[name] = table.columns[name][i]
    return row
  })
}

function inferType(values) {
  const sample = values.slice(0, 100)
  if (sample.length === 0) return 'string'
  if (sample.every(v => typeof v === 'boolean' || v === 'true' || v === 'false')) return 'boolean'
  if (sample.every(v => typeof v === 'number' && Number.isInteger(v))) return 'integer'
  if (sample.every(v => typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v))))) return 'float'
  if (sample.every(v => typeof v === 'string' && v.length > 6 && !isNaN(Date.parse(v)))) return 'date'
  return 'string'
}

// Each column's name, type, whether it has gaps, and its first few values
function inferColumns(table) {
  return table.names.map(name => {
    const values = table.columns[name].filter(v => v != null && v !== '')
    return { name, type: inferType(values), nullable: values.length < table.length, sample: values.slice(0, 3) }
  })
}

// About how much memory a table takes, for the read cache
function tableBytes(table) {
  let bytes = 0
  for (const name of table.names) {
    for (const v of table.columns[name]) bytes += typeof v === 'string' ? 24 + 2 * v.length : 8
  }
  return bytes
}

// The table with its rows in the order of one column's values (as strings,
// so numbers and text sort the same way every time); null and missing last
function sortTableBy(table, column) {
  const values = table.columns[column]
  if (!values) return table
  const key = v => (v == null ? null : String(v))
  const order = Array.from({ length: table.length }, (_, i) => i)
  order.sort((a, b) => {
    const x = key(values[a]), y = key(values[b])
    if (x === y) return a - b
    if (x === null) return 1
    if (y === null) return -1
    return x < y ? -1 : 1
  })
  const columns = Object.create(null)
  for (const name of table.names) columns[name] = order.map(i => table.columns[name][i])
  return { names: table.names, columns, length: table.length }
}

// The stored form, a "columns copy": names kept as a list, since an object's
// keys that look like numbers ("2020") would come first
function encodeTable(table) {
  return JSON.stringify({ v: 1, names: table.names, rows: table.length, data: table.names.map(n => table.columns[n]) })
}

function decodeTable(json) {
  const parsed = JSON.parse(json)
  if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.names) || !Array.isArray(parsed.data)) throw new Error('Not a stored dataset')
  const columns = Object.create(null)
  parsed.names.forEach((name, i) => { columns[name] = parsed.data[i] })
  return { names: parsed.names, columns, length: parsed.rows }
}

async function packTable(table) {
  const json = encodeTable(table)
  return { gz: await gzip(json), hash: crypto.createHash('sha256').update(json).digest('hex') }
}

async function unpackTable(buffer) {
  return decodeTable((await gunzip(buffer)).toString('utf8'))
}

// A response or uploaded file, made ready to store: parsed, in key order when
// the dataset has a key column, described, hashed and compressed
async function processBody(buffer, format, { rowsPath, keyColumn } = {}) {
  let table = rowsToTable(await parseRows(buffer, format, { rowsPath }))
  if (keyColumn) {
    if (table.length && !table.columns[keyColumn]) throw new Error(`The key column "${keyColumn}" isn't in the data`)
    table = sortTableBy(table, keyColumn)
  }
  const { gz, hash } = await packTable(table)
  return { gz, hash, columns: inferColumns(table), rowCount: table.length }
}

// SQL's LIKE, ignoring case: % matches any run of characters, _ any one, and
// the rest only themselves. Walks the value once, going back to the last % on
// a mismatch, so it takes at most value × pattern steps; a regex built from
// the pattern (%%%%…!) could take longer than the server can wait.
function likeMatch(value, pattern) {
  const s = String(value).toLowerCase()
  const p = String(pattern).toLowerCase()
  let i = 0, j = 0, star = -1, from = 0
  while (i < s.length) {
    if (j < p.length && p[j] !== '%' && (p[j] === '_' || p[j] === s[i])) { i++; j++ }
    else if (j < p.length && p[j] === '%') { star = j++; from = i }
    else if (star !== -1) { j = star + 1; i = ++from }
    else return false
  }
  while (p[j] === '%') j++
  return j === p.length
}

function passes(val, conditions) {
  if (!conditions || typeof conditions !== 'object') return true
  if (conditions.eq != null && val !== conditions.eq) return false
  if (conditions.neq != null && val === conditions.neq) return false
  if (conditions.gt != null && !(val > conditions.gt)) return false
  if (conditions.gte != null && !(val >= conditions.gte)) return false
  if (conditions.lt != null && !(val < conditions.lt)) return false
  if (conditions.lte != null && !(val <= conditions.lte)) return false
  if (Array.isArray(conditions.in) && !conditions.in.includes(val)) return false
  if (conditions.like && !likeMatch(val, conditions.like)) return false
  return true
}

// A query over a table: rows kept by `where`, ordered, then offset and
// limited, as the row numbers they pick; then the chosen columns' values
function applyQuery(table, columns, opts = {}) {
  const n = table.length
  const value = (col, i) => { const arr = table.columns[col]; return arr ? arr[i] : undefined }
  let rows = null  // null: every row, in order

  if (opts.where && typeof opts.where === 'object') {
    const conditions = Object.entries(opts.where)
    rows = []
    for (let i = 0; i < n; i++) {
      if (conditions.every(([col, c]) => passes(value(col, i), c))) rows.push(i)
    }
  }

  if (opts.orderBy) {
    const col = typeof opts.orderBy === 'string' ? opts.orderBy : opts.orderBy.column
    const dir = (typeof opts.orderBy === 'object' && opts.orderBy.direction === 'desc') ? -1 : 1
    if (!rows) rows = Array.from({ length: n }, (_, i) => i)
    rows.sort((a, b) => {
      const x = value(col, a), y = value(col, b)
      if (x < y) return -dir
      if (x > y) return dir
      return 0
    })
  }

  const totalRows = rows ? rows.length : n
  if (opts.offset || opts.limit) {
    if (!rows) rows = Array.from({ length: n }, (_, i) => i)
    if (opts.offset) rows = rows.slice(opts.offset)
    if (opts.limit) rows = rows.slice(0, opts.limit)
  }

  const selected = opts.columns || (columns ? columns.map(c => c.name) : table.names)
  const result = {}
  for (const col of selected) {
    if (col === '__proto__') continue
    const arr = table.columns[col]
    if (rows) result[col] = rows.map(i => (arr ? arr[i] ?? null : null))
    else result[col] = arr ? arr.map(v => v ?? null) : new Array(n).fill(null)
  }
  return { columns: result, totalRows }
}

module.exports = {
  parseRows, rowsToTable, tableToRows, inferColumns, tableBytes, sortTableBy,
  encodeTable, decodeTable, packTable, unpackTable, processBody, likeMatch, applyQuery,
}

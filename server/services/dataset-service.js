// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const path = require('path')
const fs = require('fs-extra')
const { v4: uuidv4 } = require('uuid')
const { uploadToR2, streamFromR2, deleteFromR2 } = require('./r2')
const { isR2Enabled } = require('./r2')
const {
  parseRows, rowsToTable, inferColumns, tableBytes, unpackTable, likeMatch, applyQuery,
} = require('./dataset-table')

const ALLOWED_FORMATS = new Set(['csv', 'json', 'tsv'])

function detectFormat(filename) {
  const ext = path.extname(filename).toLowerCase().replace('.', '')
  if (ext === 'csv') return 'csv'
  if (ext === 'tsv' || ext === 'tab') return 'tsv'
  if (ext === 'json') return 'json'
  return null
}

async function ingestDataset(filePath, originalFilename, { userId, storage, localDir, keyPrefix }) {
  const format = detectFormat(originalFilename)
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new Error(`Unsupported file format. Accepted: ${[...ALLOWED_FORMATS].join(', ')}`)
  }

  const table = rowsToTable(await parseRows(await fs.readFile(filePath), format))
  const columns = inferColumns(table)
  const stat = fs.statSync(filePath)
  const baseName = path.basename(originalFilename, path.extname(originalFilename))
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase()

  let storageKey
  if (isR2Enabled()) {
    storageKey = `${keyPrefix || userId}/datasets/${baseName}/${uuidv4()}${path.extname(originalFilename)}`
    await uploadToR2(filePath, storageKey, 'application/octet-stream')
  } else {
    const dsDir = path.join(localDir, 'datasets')
    fs.ensureDirSync(dsDir)
    const localName = `${uuidv4()}${path.extname(originalFilename)}`
    storageKey = `local:${localName}`
    fs.copySync(filePath, path.join(dsDir, localName))
  }

  fs.removeSync(filePath)

  return {
    name: baseName,
    filename: originalFilename,
    format,
    storageKey,
    columns,
    rowCount: table.length,
    byteSize: stat.size,
  }
}

// Tables by storage key, since a chart asks for its data again and again,
// and a file never changes under its key (an upload gets a new one). Up to
// 128 MB of tables in memory, the least recently read going first; a table
// over 48 MB is read each time. Callers mustn't change a table (applyQuery
// doesn't).
const CACHE_BYTES = 128 * 1024 * 1024
const CACHE_TABLE_BYTES = 48 * 1024 * 1024
const cached = new Map()
const parsing = new Map()
let cachedBytes = 0

function remember(key, table) {
  const bytes = tableBytes(table)
  if (bytes > CACHE_TABLE_BYTES) return
  cached.set(key, { table, bytes })
  cachedBytes += bytes
  for (const [oldest, entry] of cached) {
    if (cachedBytes <= CACHE_BYTES) break
    cached.delete(oldest)
    cachedBytes -= entry.bytes
  }
}

async function readStored(storageKey, localDir) {
  if (storageKey.startsWith('local:')) {
    return fs.readFile(path.join(localDir, 'datasets', storageKey.replace('local:', '')))
  }
  const { body } = await streamFromR2(storageKey)
  const chunks = []
  for await (const chunk of body) chunks.push(chunk)
  return Buffer.concat(chunks)
}

// A stored dataset as a table: a columns copy as it was saved, or an
// uploaded CSV, TSV or JSON file parsed
async function readDatasetFile(storageKey, format, localDir) {
  const hit = cached.get(storageKey)
  if (hit) {
    cached.delete(storageKey)
    cached.set(storageKey, hit)
    return hit.table
  }
  // Two reads at once read it once
  if (parsing.has(storageKey)) return parsing.get(storageKey)
  const read = (async () => {
    const buffer = await readStored(storageKey, localDir)
    const table = format === 'columns' ? await unpackTable(buffer) : rowsToTable(await parseRows(buffer, format))
    remember(storageKey, table)
    return table
  })()
  parsing.set(storageKey, read)
  try { return await read } finally { parsing.delete(storageKey) }
}

async function deleteDatasetFile(storageKey, localDir) {
  const hit = cached.get(storageKey)
  if (hit) { cached.delete(storageKey); cachedBytes -= hit.bytes }
  if (storageKey.startsWith('local:')) {
    const localName = storageKey.replace('local:', '')
    fs.removeSync(path.join(localDir, 'datasets', localName))
  } else {
    await deleteFromR2(storageKey)
  }
}

module.exports = { ingestDataset, readDatasetFile, applyQuery, likeMatch, deleteDatasetFile, detectFormat, ALLOWED_FORMATS }

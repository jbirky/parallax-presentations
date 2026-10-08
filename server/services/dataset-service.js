// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const path = require('path')
const fs = require('fs-extra')
const { Worker } = require('worker_threads')
const { v4: uuidv4 } = require('uuid')
const { putBufferToR2, streamFromR2, deleteFromR2 } = require('./r2')
const { isR2Enabled } = require('./r2')
const { parseRows, rowsToTable, tableBytes, unpackTable, likeMatch, applyQuery } = require('./dataset-table')

const ALLOWED_FORMATS = new Set(['csv', 'json', 'tsv'])

function detectFormat(filename) {
  const ext = path.extname(filename).toLowerCase().replace('.', '')
  if (ext === 'csv') return 'csv'
  if (ext === 'tsv' || ext === 'tab') return 'tsv'
  if (ext === 'json') return 'json'
  return null
}

// Parses a body and packs it as a columns copy in a worker thread (see
// processBody in dataset-table.js). The worker's memory is capped, so a body
// too big to read fails on its own instead of taking the server down
const WORKER = path.join(__dirname, 'dataset-worker.js')

function runInWorker(body, format, opts = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER, { workerData: { body, format, opts }, resourceLimits: { maxOldGenerationSizeMb: 1536 } })
    let settled = false
    const settle = (fn, value) => { if (!settled) { settled = true; fn(value) } }
    worker.once('message', msg => {
      if (msg.ok) settle(resolve, { ...msg, gz: Buffer.from(msg.gz.buffer, msg.gz.byteOffset, msg.gz.byteLength) })
      else settle(reject, new Error(msg.error))
      worker.terminate()
    })
    worker.once('error', err => settle(reject, err.code === 'ERR_WORKER_OUT_OF_MEMORY' ? new Error('The data is too large to read') : err))
    worker.once('exit', () => settle(reject, new Error('Reading the data stopped before it finished')))
  })
}

// Stores a packed table: on R2 under its owner's datasets, or in the data
// folder when self-hosted
async function storeColumns(gz, { name, keyPrefix, localDir }) {
  if (isR2Enabled()) {
    const storageKey = `${keyPrefix}/datasets/${name}/${uuidv4()}.json.gz`
    await putBufferToR2(storageKey, gz, 'application/gzip')
    return storageKey
  }
  const localName = `${uuidv4()}.json.gz`
  await fs.ensureDir(path.join(localDir, 'datasets'))
  await fs.writeFile(path.join(localDir, 'datasets', localName), gz)
  return `local:${localName}`
}

function datasetName(text) {
  return String(text).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
}

async function ingestDataset(filePath, originalFilename, { userId, localDir, keyPrefix }) {
  const format = detectFormat(originalFilename)
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new Error(`Unsupported file format. Accepted: ${[...ALLOWED_FORMATS].join(', ')}`)
  }
  try {
    const name = datasetName(path.basename(originalFilename, path.extname(originalFilename)))
    const packed = await runInWorker(await fs.readFile(filePath), format)
    const storageKey = await storeColumns(packed.gz, { name, keyPrefix: keyPrefix || userId, localDir })
    return {
      name,
      filename: originalFilename,
      format: 'columns',
      storageKey,
      columns: packed.columns,
      rowCount: packed.rowCount,
      byteSize: packed.gz.length,
      contentHash: packed.hash,
    }
  } finally {
    fs.removeSync(filePath)
  }
}

// Saves an upload as its dataset's only version, deleting the files an
// earlier upload under that name left. `previous` is that dataset, if any
async function saveUpload(storage, result, userId, { previous, localDir }) {
  const ds = await storage.createDataset(result, userId)
  const old = await storage.listDatasetVersions(ds.id)
  const version = await storage.createDatasetVersion(ds.id, {
    storageKey: result.storageKey, format: result.format, contentHash: result.contentHash,
    columns: result.columns, rowCount: result.rowCount, byteSize: result.byteSize,
  })
  await storage.setCurrentVersion(ds.id, version)
  const keys = await storage.deleteDatasetVersions(ds.id, old.map(v => v.id))
  // A dataset uploaded before versions, on a server with no migration to
  // give it one (self-hosted), had only its own key
  if (previous?.storageKey) keys.push(previous.storageKey)
  for (const key of new Set(keys)) {
    if (key && key !== result.storageKey) {
      deleteDatasetFile(key, localDir).catch(e => console.error('Replaced dataset file not deleted:', e.message))
    }
  }
  return storage.getDataset(ds.id, userId)
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

module.exports = {
  ingestDataset, saveUpload, runInWorker, storeColumns, datasetName, readDatasetFile, applyQuery, likeMatch,
  deleteDatasetFile, detectFormat, ALLOWED_FORMATS,
}

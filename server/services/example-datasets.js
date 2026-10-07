// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The datasets the landing page's example decks plot
// (client/src/examples/datasets.js, through deck-html.js). The server
// fetches each source as a live dataset would, at most once a day and only
// when an example that uses it is opened, and keeps the copy in the data
// folder (examples/<source>.json.gz). Until a fetch has worked, and whenever
// one fails, the copy saved in server/examples/<source>.csv.gz stands in,
// so the examples never wait on the source or show nothing. Tests never
// fetch, nor does a server with PARALLAX_EXAMPLE_FETCH=off.

const path = require('path')
const zlib = require('zlib')
const fs = require('fs-extra')
const { EXAMPLE_SOURCES, EXAMPLE_DATASETS, exampleDatasetNames, dataGraphs, graphNeeds, embedDatasetNames } = require('./deck-html')
const { normalizeSource } = require('./live-sources')
const { fetchAndPack } = require('./live-datasets')
const { runInWorker, storeColumns, saveUpload } = require('./dataset-service')
const { unpackTable } = require('./dataset-table')
const { normalizeTransforms, transformTable, inferColumns } = require('./dataset-transforms')
const { refreshOutputColumns } = require('./dataset-views')
const { buildDeckData, readsData, readError } = require('./deck-data')

const DAY = 24 * 60 * 60 * 1000
// After a failed fetch, the next try waits this long
const RETRY = 60 * 60 * 1000
const MAX_BYTES = 50 * 1024 * 1024
const SNAPSHOTS = path.join(__dirname, '..', 'examples')
const fetching = () => process.env.NODE_ENV !== 'test' && process.env.PARALLAX_EXAMPLE_FETCH !== 'off'

// Each source's copy: { gz (packed), table, columns, rowCount, hash, asOf
// (ISO), fetchedAt (ms; 0 for the saved copy), tried (ms), refreshing }
const sources = new Map()

const savedFiles = (localDir, name) => {
  const dir = path.join(localDir, 'examples')
  return { dir, gz: path.join(dir, `${name}.json.gz`), meta: path.join(dir, `${name}.json`) }
}

// The last copy fetched, else the one in the repository
async function loadSource(name, localDir) {
  const files = savedFiles(localDir, name)
  try {
    const meta = await fs.readJson(files.meta)
    const gz = await fs.readFile(files.gz)
    return { ...meta, gz, table: await unpackTable(gz), tried: 0 }
  } catch { /* none fetched yet */ }
  const def = EXAMPLE_SOURCES[name]
  const csv = zlib.gunzipSync(await fs.readFile(path.join(SNAPSHOTS, `${name}.csv.gz`)))
  const packed = await runInWorker(csv, 'csv', { keyColumn: def.source.keyColumn })
  return {
    gz: packed.gz, table: await unpackTable(packed.gz), columns: packed.columns, rowCount: packed.rowCount, hash: packed.hash,
    asOf: `${def.snapshot}T00:00:00.000Z`, fetchedAt: 0, tried: 0,
  }
}

// Fetches a source again, keeping the new copy when its data changed
async function refreshSource(name, entry, localDir) {
  const def = EXAMPLE_SOURCES[name]
  entry.tried = Date.now()
  try {
    const packed = await fetchAndPack(def.kind, normalizeSource(def.kind, def.source), { maxBytes: MAX_BYTES })
    const now = Date.now()
    if (packed.hash !== entry.hash) {
      Object.assign(entry, { gz: packed.gz, table: await unpackTable(packed.gz), columns: packed.columns, rowCount: packed.rowCount, hash: packed.hash })
    }
    Object.assign(entry, { asOf: new Date(now).toISOString(), fetchedAt: now })
    const files = savedFiles(localDir, name)
    await fs.ensureDir(files.dir)
    await fs.writeFile(files.gz, entry.gz)
    await fs.writeJson(files.meta, { columns: entry.columns, rowCount: entry.rowCount, hash: entry.hash, asOf: entry.asOf, fetchedAt: entry.fetchedAt })
  } catch (err) {
    console.error(`Example data "${name}" not refreshed:`, err.message)
  }
}

// A source's copy now; one more than a day old is fetched again behind it
async function sourceCopy(name, localDir) {
  if (!sources.has(name)) sources.set(name, loadSource(name, localDir).catch(err => { sources.delete(name); throw err }))
  const entry = await sources.get(name)
  const now = Date.now()
  if (fetching() && !entry.refreshing && now - entry.fetchedAt > DAY && now - entry.tried > RETRY) {
    entry.refreshing = refreshSource(name, entry, localDir).finally(() => { entry.refreshing = null })
  }
  return entry
}

// An example dataset as a deck reads it: its source's copy with its steps
// run, { table, columns, rowCount, asOf, version } or { error }
async function readDataset(name, localDir) {
  const def = EXAMPLE_DATASETS[name]
  try {
    const src = await sourceCopy(def.source, localDir)
    const table = await transformTable(src.table, `example:${def.source}:${src.hash}`, normalizeTransforms(def.transforms), async () => null)
    return {
      table, columns: def.transforms.length ? inferColumns(table) : src.columns,
      rowCount: table.length, asOf: src.asOf, version: `example:${name}:${src.hash}`,
    }
  } catch (err) {
    return { error: readError(err) }
  }
}

// The example datasets a deck names
function namesIn(deck, pluginSandbox) {
  const names = new Set([...graphNeeds(dataGraphs(deck)).keys(), ...embedDatasetNames(deck, Object.keys(EXAMPLE_DATASETS), { pluginSandbox })])
  return exampleDatasetNames(names)
}

// opts.deckData for an example deck's page, or undefined for one that reads
// no example dataset
async function exampleDeckData(deck, { localDir, pluginSandbox } = {}) {
  if (!deck || !readsData(deck)) return undefined
  const names = namesIn(deck, pluginSandbox)
  if (!names.length) return undefined
  const reads = new Map()
  const linked = []
  for (const name of names) {
    const read = await readDataset(name, localDir)
    reads.set(name, read)
    linked.push({ id: `example-${name}`, name, columns: read.columns || [], rowCount: read.rowCount ?? null, asOf: read.asOf || null, version: read.version })
  }
  return buildDeckData(deck, linked, ds => reads.get(ds.name), { pluginSandbox })
}

// What an example deck's page depends on, besides the deck: its sources'
// copies, so the page is built again once one changes
async function exampleDataVersion(deck, { localDir } = {}) {
  if (!deck || !readsData(deck)) return ''
  const used = new Set(namesIn(deck).map(name => EXAMPLE_DATASETS[name].source))
  const parts = []
  for (const name of used) {
    const src = await sourceCopy(name, localDir)
    parts.push(`${name}:${src.hash}:${src.asOf}`)
  }
  return parts.join('|')
}

// Gives userId copies of the example datasets an example deck names, as
// datasets of their own (uploads, with the example's steps), linked to their
// presentation `presentationId`. A dataset they already have by a name is
// linked as it is. Resolves to the datasets linked
async function copyExampleDatasets(storage, deck, { userId, keyPrefix, presentationId, localDir, checkRoom }) {
  const names = namesIn(deck)
  const copies = []
  for (const name of names) {
    const src = await sourceCopy(EXAMPLE_DATASETS[name].source, localDir)
    copies.push({ name, src, transforms: normalizeTransforms(EXAMPLE_DATASETS[name].transforms) })
  }
  const fresh = []
  for (const c of copies) if (!(await storage.getDatasetByName(c.name, userId))) fresh.push(c)
  if (checkRoom) await checkRoom(fresh.reduce((n, c) => n + c.src.gz.length, 0))
  const linked = []
  for (const c of copies) {
    let ds = await storage.getDatasetByName(c.name, userId)
    if (!ds) {
      const storageKey = await storeColumns(c.src.gz, { name: c.name, keyPrefix: keyPrefix || userId || 'local', localDir })
      ds = await saveUpload(storage, {
        name: c.name, filename: `${c.name}.csv`, format: 'columns', storageKey,
        columns: c.src.columns, rowCount: c.src.rowCount, byteSize: c.src.gz.length, contentHash: c.src.hash,
      }, userId, { previous: null, localDir })
      if (c.transforms.length) {
        await storage.setDatasetTransforms(ds.id, userId, c.transforms, null)
        await refreshOutputColumns(storage, await storage.getDataset(ds.id, userId), { ownerId: userId, localDir })
        ds = await storage.getDataset(ds.id, userId)
      }
    }
    await storage.linkDatasetToPresentation(presentationId, ds.id, null)
    linked.push(ds)
  }
  return linked
}

module.exports = { exampleDeckData, exampleDataVersion, copyExampleDatasets, sourceCopy }

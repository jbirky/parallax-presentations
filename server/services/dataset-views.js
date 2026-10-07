// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// What a read of a dataset gets: a version (the current one, or one it
// names), with the dataset's transforms run on it unless it asks for the
// raw data.

const { readDatasetFile } = require('./dataset-service')
const { transformTable, inferColumns, TransformError } = require('./dataset-transforms')
const { tableToRows } = require('./dataset-table')

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const emptyTable = () => ({ names: [], columns: Object.create(null), length: 0 })

// Resolves to { table, columns } (columns: the stored description, or null
// for transformed data), or null for a version that isn't the dataset's.
// ownerId is whose datasets a join may name; steps replace the dataset's
// own transforms (a preview of unsaved ones)
async function readView(storage, ds, { versionId, ownerId, raw = false, steps, localDir }) {
  let source
  if (versionId && versionId !== 'current') {
    if (!UUID.test(versionId)) return null
    const v = await storage.getDatasetVersion(ds.id, versionId)
    if (!v) return null
    source = { key: v.storageKey, format: v.format, columns: v.columns }
  } else if (ds.storageKey) {
    source = { key: ds.storageKey, format: ds.format, columns: ds.sourceColumns || ds.columns }
  } else {
    return { table: emptyTable(), columns: [] }
  }
  const table = await readDatasetFile(source.key, source.format, localDir)
  const transforms = steps || ds.transforms || []
  if (raw || !transforms.length) return { table, columns: source.columns }
  const out = await transformTable(table, source.key, transforms, async name => {
    const other = await storage.getDatasetByName(name, ownerId)
    if (!other || !other.storageKey) return null
    return { key: other.storageKey, table: await readDatasetFile(other.storageKey, other.format, localDir) }
  })
  return { table: out, columns: null }
}

// A table's columns, size and first rows, for the editor
function preview(table, rows = 20) {
  return {
    columns: inferColumns(table),
    rowCount: table.length,
    rows: tableToRows({ ...table, length: Math.min(rows, table.length) }),
  }
}

// Works out and stores the columns a dataset's transforms give, after its
// data or its transforms change; null when they no longer run (a column
// they name went away), which a read then explains
async function refreshOutputColumns(storage, ds, { ownerId, localDir }) {
  if (!ds.transforms || !ds.transforms.length) return
  let columns = null
  try {
    const { table } = await readView(storage, ds, { ownerId, localDir })
    columns = inferColumns(table)
  } catch (err) {
    if (!(err instanceof TransformError)) throw err
  }
  await storage.setOutputColumns(ds.id, columns)
}

module.exports = { readView, preview, refreshOutputColumns }

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The datasets an AI collaborator link's presentation can use (list_datasets):
// the ones linked to it in Tools › Datasets…, each with its columns, the
// range of its number columns, its size, where it comes from and how old its
// data is, and its first rows. A Graph's data lines plot them by name and
// column (guides.js). Read as the presentation reads them: the version it
// holds, if any, with the dataset's transforms run.

const { readView } = require('../services/dataset-views')
const { sourceLabel } = require('../services/live-sources')

const MAX_DATASETS = 20
const MAX_COLUMNS = 40
const SAMPLE_ROWS = 3
const SCAN_ROWS = 200000
const NUMERIC = new Set(['number', 'float', 'integer'])

const cell = v => {
  if (v === null || v === undefined || v === '') return ''
  const s = typeof v === 'number' ? short(v) : String(v)
  return (s.length > 40 ? `${s.slice(0, 39)}…` : s).replace(/\|/g, '\\|').replace(/\n/g, ' ')
}
const short = n => (Number.isInteger(n) && Math.abs(n) < 1e9 ? String(n) : Number(n.toPrecision(4)).toString())
const day = d => (d ? new Date(d).toISOString().slice(0, 10) : null)

function where(ds) {
  try {
    if (ds.sourceKind === 'tap') return `a TAP query (${sourceLabel('tap', ds.source).replace(/^TAP: /, '')}), refreshed ${ds.schedule || 'by hand'}`
    if (ds.sourceKind === 'url') return `fetched from ${new URL(ds.source.url).hostname}, refreshed ${ds.schedule || 'by hand'}`
  } catch {}
  return ds.filename ? `an uploaded file, ${ds.filename}` : 'an uploaded file'
}

// The range of a number column, over its first SCAN_ROWS rows
function range(values) {
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < Math.min(values.length, SCAN_ROWS); i++) {
    const v = values[i]
    if (typeof v === 'number' && Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v }
  }
  return lo <= hi ? `${short(lo)} to ${short(hi)}` : ''
}

async function describe(storage, ds, { ownerId, localDir }) {
  const name = ds.alias || ds.name
  let asOf = ds.lastFetchedAt || ds.updatedAt
  if (ds.pinnedVersionId) asOf = (await storage.getDatasetVersion(ds.id, ds.pinnedVersionId))?.createdAt || null
  const facts = [
    ds.rowCount != null ? `${Number(ds.rowCount).toLocaleString('en-US')} rows` : null,
    `from ${where(ds)}`,
    asOf ? `data as of ${day(asOf)}` : null,
    ds.pinnedVersionId ? 'the presentation holds this version' : null,
    ds.transforms?.length ? `${ds.transforms.length} transform step${ds.transforms.length === 1 ? '' : 's'} applied` : null,
  ].filter(Boolean)
  const lines = [`## ${name}`, '', `${facts.join(' · ')}.`]
  let table = null
  try {
    table = (await readView(storage, ds, { versionId: ds.pinnedVersionId || undefined, ownerId, localDir }))?.table || null
  } catch (err) {
    lines.push('', `Its data couldn't be read: ${err.transformError || err.exprError ? err.message : 'the file is missing or damaged'}.`)
  }
  const columns = (ds.columns || []).slice(0, MAX_COLUMNS)
  if (columns.length) {
    lines.push('', '| Column | Type | Range |', '| --- | --- | --- |')
    for (const c of columns) {
      const values = table?.columns?.[c.name]
      lines.push(`| ${cell(c.name)} | ${c.type || ''} | ${NUMERIC.has(c.type) && values ? range(values) : ''} |`)
    }
    if ((ds.columns || []).length > MAX_COLUMNS) lines.push('', `And ${ds.columns.length - MAX_COLUMNS} more columns.`)
  }
  if (table && table.length && columns.length) {
    const shown = columns.slice(0, 8)
    lines.push('', `First ${Math.min(SAMPLE_ROWS, table.length)} rows${columns.length > shown.length ? ` (first ${shown.length} columns)` : ''}:`, '',
      `| ${shown.map(c => cell(c.name)).join(' | ')} |`, `| ${shown.map(() => '---').join(' | ')} |`)
    for (let i = 0; i < Math.min(SAMPLE_ROWS, table.length); i++) {
      lines.push(`| ${shown.map(c => cell(table.columns[c.name]?.[i])).join(' | ')} |`)
    }
  }
  return lines.join('\n')
}

// Markdown for list_datasets
async function datasetList(storage, deckId, { ownerId, localDir }) {
  const linked = await storage.getPresentationDatasets(deckId)
  if (!linked.length) {
    return 'No datasets are linked to this presentation. The person can link one in the editor, under Tools › Datasets…: an uploaded CSV, TSV or JSON file, a file fetched from the web, or a TAP query such as the NASA Exoplanet Archive\'s.'
  }
  const parts = [`# Datasets this presentation can use (${linked.length})`, '',
    'A Graph plots one with a data line, naming the dataset and its columns (get_element_guide with type graph). HTML, p5 and plugin elements read them by name too.']
  for (const ds of linked.slice(0, MAX_DATASETS)) parts.push('', await describe(storage, ds, { ownerId, localDir }))
  if (linked.length > MAX_DATASETS) parts.push('', `And ${linked.length - MAX_DATASETS} more.`)
  return parts.join('\n')
}

module.exports = { datasetList, describe }

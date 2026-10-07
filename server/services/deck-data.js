// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The data a deck the server builds carries (share links, live sessions,
// Present, exports, GitHub and Zenodo): each graph's data lines' columns,
// and the datasets its HTML, p5 and plugin elements name, from each linked
// dataset's pinned version for the deck, or its current one, with its
// transforms run. Written into the page, so the deck works offline and
// never waits on a source. What a deck needs is worked out by
// client/src/utils/deckData.js (through deck-html.js), as the editor does.

const {
  MAX_ROWS, dataGraphs, graphNeeds, graphRowsFrom, findDataset, hasEmbeds, embedDatasetNames, datasetSummary, carriedData,
} = require('./deck-html')
const { readView } = require('./dataset-views')
const { applyQuery } = require('./dataset-table')

// What a read that failed says on the slide
function readError(err) {
  if (err && (err.transformError || err.exprError)) return err.message
  return 'The data couldn’t be read'
}

// Resolves to opts.deckData for generateRevealHTML, or undefined for a deck
// that reads no datasets. ownerId is whose datasets a transform's join may
// name (null for one user's files); pluginSandbox(el) gives a plugin's page
async function deckDataFor(storage, presentation, { ownerId = null, localDir, pluginSandbox } = {}) {
  if (!presentation || !presentation.id) return undefined
  const graphs = dataGraphs(presentation)
  if (!graphs.length && !hasEmbeds(presentation)) return undefined
  const linked = await storage.getPresentationDatasets(presentation.id)
  const names = linked.map(d => d.alias || d.name)
  const carried = embedDatasetNames(presentation, names, { pluginSandbox })

  // One read of each dataset, its transforms run once
  const views = new Map()
  const view = ds => {
    if (!views.has(ds.id)) {
      views.set(ds.id, readView(storage, ds, { versionId: ds.pinnedVersionId || undefined, ownerId, localDir })
        .then(v => v || { error: 'The version this deck holds is gone' })
        .catch(err => ({ error: readError(err) })))
    }
    return views.get(ds.id)
  }
  const version = ds => `${ds.id}:${ds.pinnedVersionId || ds.currentVersionId || ds.updatedAt || ''}`

  // Graphs: only the columns their data lines plot
  const tables = new Map()
  for (const [name, cols] of graphNeeds(graphs)) {
    const ds = findDataset(linked, name)
    if (!ds) continue
    const v = await view(ds)
    if (v.error) { tables.set(ds.id, { error: v.error }); continue }
    const read = applyQuery(v.table, v.columns, { columns: [...cols], limit: MAX_ROWS })
    tables.set(ds.id, { columns: read.columns, total: read.totalRows, version: version(ds) })
  }
  const graphRows = {}
  for (const el of graphs) graphRows[el.id] = graphRowsFrom(el, linked, ds => tables.get(ds.id) || { error: 'The data couldn’t be read' })

  // HTML, p5 and plugin elements: the datasets they name, whole
  const whole = new Map()
  for (const name of carried) {
    const ds = findDataset(linked, name)
    if (!ds) continue
    const v = await view(ds)
    whole.set(name, v.error ? { error: v.error } : applyQuery(v.table, v.columns, { limit: MAX_ROWS }))
  }
  return {
    graphs: graphRows,
    datasets: { list: linked.map(datasetSummary), data: carriedData(carried, name => whole.get(name) || null) },
  }
}

module.exports = { deckDataFor }

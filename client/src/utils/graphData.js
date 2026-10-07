// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The rows graphs' data lines plot, and the datasets HTML, p5 and plugin
// elements read, as the editor has them. A graph draws in a frame of its own
// that can't fetch (it has no origin), so its page has the rows written in:
// this store fetches, from the deck's linked datasets, the columns its graphs
// use, and graphPage.js reads them through setGraphDataSource. So the canvas,
// the graph editor and Present (which builds its page at the click, with no
// time to fetch) all have them. The datasets elements name in their code
// (deckData.js) are fetched whole, for the editor's answers to
// parallax.datasets (datasets/embedBridge.js) and for the decks it builds.

import { api } from './api'
import { setGraphDataSource, hasDataLines } from './graphPage'
import {
  MAX_ROWS, graphNeeds, graphRowsFrom, findDataset, embedDatasetNames, datasetSummary, carriedData, setDeckDataSource,
} from './deckData'
import registry from '../plugins/PluginRegistry'

let presentationId = null
let datasets = null         // the deck's linked datasets, once listed
let tables = new Map()      // dataset id -> { columns: {name: values}, have: Set, total, loading: Set, error, version, whole, wholeLoad }
let version = 0
let listing = null
const listeners = new Set()
const built = new WeakMap() // element -> { version, rows }

function notify() {
  version++
  for (const fn of listeners) fn()
}

export function subscribeGraphData(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function graphDataVersion() { return version }

// A data line's dataset, by the name it plots it under (a link's alias, or
// the dataset's name)
export function datasetNamed(name) {
  return findDataset(datasets, name)
}

// The deck's linked datasets, or null until they're listed (listGraphDatasets)
export function linkedDatasets() { return datasets }
export function listGraphDatasets() { return listDatasets() }

// Starts over for another deck
export function setGraphDataPresentation(id) {
  if (id === presentationId) return
  presentationId = id
  datasets = null
  tables = new Map()
  listing = null
  notify()
}

// Lists the deck's datasets again, and forgets the rows fetched: after the
// datasets changed (a refresh, new steps, a link)
export function refreshGraphData() {
  tables = new Map()
  listing = null
  datasets = null
  notify()
  return listDatasets()
}

function listDatasets() {
  if (!presentationId) return Promise.resolve([])
  if (!listing) {
    const id = presentationId
    listing = api.getPresentationDatasets(id).then(list => {
      if (id !== presentationId) return []
      datasets = Array.isArray(list) ? list : []
      notify()
      return datasets
    }).catch(() => { datasets = []; notify(); return [] })
  }
  return listing
}

// Every graph on a deck's slides
export function deckGraphs(presentation) {
  const out = []
  for (const slide of presentation?.slides || []) for (const el of slide.elements || []) if (el.type === 'graph') out.push(el)
  return out
}

// Fetches the columns these graphs plot that aren't here yet: all of a
// dataset's needed columns in one request
export async function loadGraphData(elements) {
  const needs = graphNeeds(elements)
  if (!needs.size || !presentationId) return
  await listDatasets()
  const id = presentationId
  await Promise.all([...needs].map(async ([name, cols]) => {
    const ds = datasetNamed(name)
    if (!ds) return
    const t = tableFor(ds)
    const want = [...cols].filter(c => !t.whole && !t.have.has(c) && !t.loading.has(c))
    if (!want.length) return
    for (const c of want) t.loading.add(c)
    notify()
    try {
      const res = await api.getPresentationDatasetData(id, ds.id, { columns: want.join(','), limit: String(MAX_ROWS) })
      if (id !== presentationId || tables.get(ds.id) !== t) return
      for (const c of want) { t.columns[c] = res.columns?.[c] || []; t.have.add(c) }
      t.total = res.totalRows
      t.error = null
      t.version++
    } catch (err) {
      if (tables.get(ds.id) !== t) return
      t.error = err.message || 'The data couldn’t be read'
    } finally {
      for (const c of want) t.loading.delete(c)
      notify()
    }
  }))
}

function tableFor(ds) {
  let t = tables.get(ds.id)
  if (!t) {
    t = { columns: {}, have: new Set(), loading: new Set(), total: null, error: null, version: 0, whole: false }
    tables.set(ds.id, t)
  }
  return t
}

// What's been read of a dataset, as deckData.js takes it: null while nothing has
function tableOf(ds) {
  const t = tables.get(ds.id)
  if (!t || (!t.have.size && !t.error)) return null
  if (t.error) return { error: t.error }
  return { columns: t.columns, total: t.total, version: `${ds.id}:${ds.updatedAt || ''}:${t.version}` }
}

// A graph's data lines' rows, by line id, as its page takes them (each
// { x, y, ... , total, version }, or { loading } or { error }); null for a
// graph with no data lines. The same object while nothing changed
export function graphDataFor(el) {
  if (!hasDataLines(el)) return null
  const kept = built.get(el)
  if (kept && kept.version === version) return kept.rows
  const rows = graphRowsFrom(el, datasets, tableOf)
  built.set(el, { version, rows })
  return rows
}

// The datasets a deck's HTML, p5 and plugin elements name (deckData.js), by
// the name they use
function embedNames(presentation) {
  if (!datasets || !presentation) return new Set()
  return embedDatasetNames(presentation, datasets.map(d => d.alias || d.name), { pluginSandbox: el => registry.getSandboxHtml(el.type) })
}

// Fetches, whole (up to MAX_ROWS rows), the datasets a deck's elements name
// that aren't here yet
export async function loadEmbedData(presentation) {
  if (!presentationId || !presentation) return
  await listDatasets()
  const id = presentationId
  await Promise.all([...embedNames(presentation)].map(async name => {
    const ds = datasetNamed(name)
    if (!ds) return
    const t = tableFor(ds)
    if (t.whole) return
    // One request at a time, which every caller waits for
    if (!t.wholeLoad) {
      t.wholeLoad = api.getPresentationDatasetData(id, ds.id, { limit: String(MAX_ROWS) }).then(res => {
        if (id !== presentationId || tables.get(ds.id) !== t) return
        for (const [c, values] of Object.entries(res.columns || {})) { t.columns[c] = values; t.have.add(c) }
        t.total = res.totalRows
        t.whole = true
        t.error = null
        t.version++
      }, err => {
        if (tables.get(ds.id) !== t) return
        t.error = err.message || 'The data couldn’t be read'
      }).finally(() => {
        t.wholeLoad = null
        notify()
      })
    }
    await t.wholeLoad
  }))
}

// What a deck built here carries for its HTML, p5 and plugin elements
// ({ list, data }, as deckData.js describes), from what's been fetched
export function embedDataFor(presentation) {
  const names = embedNames(presentation)
  return {
    list: (datasets || []).map(datasetSummary),
    data: carriedData(names, name => {
      const ds = datasetNamed(name)
      const t = ds && tables.get(ds.id)
      if (t && t.error) return { error: t.error }
      if (!t || !t.whole) return { error: `“${name}” was still loading when the deck was made` }
      return { columns: t.columns, totalRows: t.total }
    }),
  }
}

// The same, once the deck's datasets are listed and those its elements name
// are fetched: what the editor answers parallax.datasets from
export async function embedDataReady(presentation) {
  await loadEmbedData(presentation)
  return embedDataFor(presentation)
}

// The extent of a graph's data lines' values, for fitting its view:
// { xMin, xMax, yMin, yMax }, positive only on a log axis; null with none
export function dataExtent(el) {
  const rows = graphDataFor(el)
  if (!rows) return null
  const xLog = el.xScale === 'log', yLog = el.yScale === 'log'
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity
  for (const e of el.expressions) {
    const r = e && e.data && !e.hidden && rows[e.id]
    if (!r || !Array.isArray(r.x) || !Array.isArray(r.y)) continue
    const bars = e.data.mark === 'bars'
    for (let i = 0; i < r.x.length; i++) {
      const x = +r.x[i], y = +r.y[i]
      if (!isFinite(x) || !isFinite(y) || (xLog && x <= 0) || (yLog && y <= 0)) continue
      const x2 = bars && Array.isArray(r.x2) ? +r.x2[i] : x
      if (x < xMin) xMin = x
      if (x > xMax) xMax = x
      if (isFinite(x2) && x2 > xMax) xMax = x2
      if (y < yMin) yMin = y
      if (y > yMax) yMax = y
    }
    // Bars stand on 0
    if (bars && !yLog) { yMin = Math.min(yMin, 0); yMax = Math.max(yMax, 0) }
  }
  if (!(xMax >= xMin) || !(yMax >= yMin)) return null
  return { xMin, xMax, yMin, yMax }
}

// A view around an extent with some room: a twentieth of the span each side,
// in log10 on a log axis
export function paddedView(ext, { xLog = false, yLog = false } = {}) {
  const pad = (lo, hi, log) => {
    if (log) {
      const a = Math.log10(lo), b = Math.log10(hi)
      const m = b > a ? (b - a) / 20 : 0.5
      return [10 ** (a - m), 10 ** (b + m)]
    }
    const m = hi > lo ? (hi - lo) / 20 : Math.abs(lo) / 10 || 1
    return [lo - m, hi + m]
  }
  const [xMin, xMax] = pad(ext.xMin, ext.xMax, xLog)
  const [yMin, yMax] = pad(ext.yMin, ext.yMax, yLog)
  return { xMin, xMax, yMin, yMax }
}

setGraphDataSource(graphDataFor)
setDeckDataSource(presentation => ({ datasets: embedDataFor(presentation) }))

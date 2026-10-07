// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// What a deck's slides read from its datasets, and that data as a presented
// deck carries it. A graph's data lines plot the columns they name, written
// into the graph's own page; HTML, p5 and plugin elements read datasets with
// parallax.datasets, which their page asks of the page around it: the editor
// (datasets/embedBridge.js) or, in a presented deck, the copy written into
// the deck. Shared by the editor (graphData.js) and the server
// (services/deck-data.js, through deck-html.js), so both work out the same
// needs the same way.

// The most rows read from one dataset
export const MAX_ROWS = 200000
// The most values a deck carries for its HTML, p5 and plugin elements, all
// datasets together: every viewer downloads them
export const EMBED_VALUE_LIMIT = 2000000
// A data line's columns, by option, and their names in a page's rows
export const DATA_FIELDS = { x: 'x', y: 'y', x2: 'x2', colorBy: 'color', sizeBy: 'size', label: 'label', xErr: 'xErr', yErr: 'yErr' }

const isDataLines = el => el && el.type === 'graph' && Array.isArray(el.expressions) && el.expressions.some(e => e && e.data && typeof e.data === 'object')
const EMBED_TYPES = el => el && (el.type === 'html' || el.type === 'p5' || (typeof el.type === 'string' && el.type.startsWith('plugin:')))

// A dataset by the name slides use for it (a link's alias, or its name)
export function findDataset(list, name) {
  return (list || []).find(d => (d.alias || d.name) === name) || (list || []).find(d => d.name === name) || null
}

// Every element on a deck's slides
function deckElements(presentation) {
  const out = []
  for (const slide of presentation?.slides || []) for (const el of slide.elements || []) out.push(el)
  return out
}

// The graphs that plot datasets' rows
export function dataGraphs(presentation) {
  return deckElements(presentation).filter(isDataLines)
}

// What graphs' data lines need: dataset name -> the columns they plot
export function graphNeeds(elements) {
  const needs = new Map()
  for (const el of elements) {
    if (!isDataLines(el)) continue
    for (const e of el.expressions) {
      const spec = e && e.data
      if (!spec || !spec.dataset) continue
      if (!needs.has(spec.dataset)) needs.set(spec.dataset, new Set())
      for (const field of Object.keys(DATA_FIELDS)) if (spec[field]) needs.get(spec.dataset).add(spec[field])
    }
  }
  return needs
}

// A graph's data lines' rows, by line id, as its page takes them: each
// { x, y, ..., total, version }, or { loading } or { error }. tableOf(ds)
// gives what's been read of a dataset: { columns: {name: values}, total,
// version }, { error }, or null while it's being read; a line whose columns
// aren't all there yet is loading
export function graphRowsFrom(el, datasets, tableOf) {
  const rows = {}
  for (const e of el.expressions || []) {
    const spec = e && e.data
    if (!spec) continue
    if (!spec.dataset || !spec.x || !spec.y) { rows[e.id] = { error: 'Choose a dataset, and the columns for x and y' }; continue }
    const ds = datasets ? findDataset(datasets, spec.dataset) : null
    if (datasets && !ds) { rows[e.id] = { error: `No dataset “${spec.dataset}” is linked to this deck` }; continue }
    const known = new Set((ds?.columns || []).map(c => c.name))
    const unknown = Object.keys(DATA_FIELDS).map(f => spec[f]).filter(c => c && known.size && !known.has(c))
    if (unknown.length) { rows[e.id] = { error: `“${spec.dataset}” has no column “${unknown[0]}”` }; continue }
    const t = ds && tableOf(ds)
    if (!t) { rows[e.id] = { loading: true }; continue }
    if (t.error) { rows[e.id] = { error: t.error }; continue }
    const entry = { total: t.total, version: t.version }
    let missing = false
    for (const [field, key] of Object.entries(DATA_FIELDS)) {
      if (!spec[field]) continue
      if (Object.prototype.hasOwnProperty.call(t.columns, spec[field])) entry[key] = t.columns[spec[field]]
      else missing = true
    }
    rows[e.id] = missing ? { loading: true } : entry
  }
  return rows
}

// The code an HTML, p5 or plugin element runs, and its data: where it names
// the datasets it reads
function embedText(el, pluginSandbox) {
  if (el.type === 'html' || el.type === 'p5') return typeof el.content === 'string' ? el.content : ''
  let text = ''
  try { text = JSON.stringify(el.pluginData || {}) } catch { /* not data */ }
  const page = pluginSandbox ? pluginSandbox(el) : null
  return typeof page === 'string' ? text + page : text
}

// Whether any element could read a dataset with parallax.datasets
export function hasEmbeds(presentation) {
  return deckElements(presentation).some(EMBED_TYPES)
}

// The datasets a deck carries for its HTML, p5 and plugin elements: those of
// `names` an element names in quotes, in its code or its data
// (parallax.datasets.query("exoplanets"), or a plugin's { dataset:
// "exoplanets" }). opts.pluginSandbox(el) gives a plugin's own page
export function embedDatasetNames(presentation, names, { pluginSandbox } = {}) {
  const found = new Set()
  if (!names || !names.length) return found
  for (const el of deckElements(presentation)) {
    if (!EMBED_TYPES(el)) continue
    const text = embedText(el, pluginSandbox)
    if (!text) continue
    for (const name of names) {
      if (found.has(name) || !name) continue
      // JSON writes a plugin's string as "name", with its quotes escaped
      const json = JSON.stringify(name)
      if (text.includes(`"${name}"`) || text.includes(`'${name}'`) || text.includes(`\`${name}\``) || text.includes(json)) found.add(name)
    }
  }
  return found
}

// A dataset as parallax.datasets.list() describes it
export function datasetSummary(ds) {
  return { name: ds.alias || ds.name, columns: (ds.columns || []).map(c => ({ name: c.name, type: c.type })), rowCount: ds.rowCount ?? null }
}

// The data a deck carries for its HTML, p5 and plugin elements, within
// EMBED_VALUE_LIMIT: name -> { columns, totalRows } or { error }. tableOf(name)
// gives a dataset's rows ({ columns, totalRows }) or { error }
export function carriedData(names, tableOf) {
  const data = {}
  let left = EMBED_VALUE_LIMIT
  for (const name of names) {
    const t = tableOf(name)
    if (!t) continue
    if (t.error) { data[name] = { error: t.error }; continue }
    let count = 0
    for (const values of Object.values(t.columns || {})) count += values ? values.length : 0
    if (count > left) { data[name] = { error: `“${name}” is too large for a presented deck to carry (${count.toLocaleString('en-US')} values)` }; continue }
    left -= count
    data[name] = { columns: t.columns || {}, totalRows: t.totalRows }
  }
  return data
}

// Answers one parallax.datasets call from the data a deck carries
// ({ list, data: { name: { columns, totalRows } | { error } } }): resolves to
// { result } or { error }. Runs in the deck's page as source text, so it
// uses nothing from outside itself
export function answerDatasets(store, op, name, opts) {
  var list = (store && store.list) || []
  var data = (store && store.data) || {}
  if (op === 'list') return { result: list }
  var meta = null
  for (var i = 0; i < list.length; i++) if (list[i].name === name) meta = list[i]
  if (!meta) return { error: 'No dataset “' + name + '” is linked to this deck' }
  if (op === 'schema') return { result: meta.columns }
  var d = Object.prototype.hasOwnProperty.call(data, name) ? data[name] : null
  if (!d) return { error: 'The deck doesn’t carry “' + name + '”: name it in quotes in the element’s code' }
  if (d.error) return { error: d.error }
  if (op === 'load') return { result: null }
  if (op !== 'query') return { error: 'Unknown call ' + op }
  opts = opts || {}
  var cols = Array.isArray(opts.columns) ? opts.columns : Object.keys(d.columns)
  var offset = Math.max(0, parseInt(opts.offset, 10) || 0)
  var limit = parseInt(opts.limit, 10) > 0 ? parseInt(opts.limit, 10) : Infinity
  var out = {}
  for (var j = 0; j < cols.length; j++) {
    var arr = Object.prototype.hasOwnProperty.call(d.columns, cols[j]) ? d.columns[cols[j]] : null
    if (arr) out[cols[j]] = arr.slice(offset, offset + limit)
  }
  return { result: { columns: out, totalRows: d.totalRows } }
}

// parallax.datasets in an element's own page: every call goes to the page
// around it (the editor, or the deck) and resolves with its answer. Runs as
// source text in the element's page, so it uses nothing from outside itself
export function datasetsClient(win) {
  var calls = {}
  var next = 0
  win.addEventListener('message', function (e) {
    var m = e.data
    if (e.source !== win.parent || !m || m.source !== 'parallax-datasets-reply' || !calls[m.id]) return
    var call = calls[m.id]
    delete calls[m.id]
    if (m.error) call.reject(new Error(m.error))
    else call.resolve(m.result)
  })
  function ask(op, name, opts) {
    return new Promise(function (resolve, reject) {
      var id = ++next
      calls[id] = { resolve: resolve, reject: reject }
      win.parent.postMessage({ source: 'parallax-datasets', id: id, op: op, name: name, opts: opts ? JSON.parse(JSON.stringify(opts)) : null }, '*')
    })
  }
  return Object.freeze({
    list: function () { return ask('list') },
    schema: function (name) { return ask('schema', String(name)) },
    load: function (name) { return ask('load', String(name)) },
    query: function (name, opts) { return ask('query', String(name), opts) },
  })
}

// Written into an element's page: parallax.datasets (a plugin's bridge
// takes `datasets: PARALLAX_DATASETS` into its own window.parallax)
export const DATASETS_CLIENT = `(${datasetsClient.toString()})(window)`
export const EMBED_DATASETS_SCRIPT = `<script>window.parallax=window.parallax||Object.freeze({datasets:${DATASETS_CLIENT}});<\/script>`

// The deck's side: answers its elements' pages from the data it carries
// (#pp-datasets). In the deck's <head>, so it listens before any element's
// page can ask. Only frames in the deck's own page are answered
export function deckDatasetsScript(store) {
  // In a <script>: no "</script>" or "<!--" can come from the data
  const json = JSON.stringify(store || { list: [], data: {} }).replace(/</g, '\\u003c')
  return `  <script type="application/json" id="pp-datasets">${json}</script>
  <script>
  (function () {
    var answer = ${answerDatasets.toString()};
    var store = null;
    function data() {
      if (!store) { try { store = JSON.parse(document.getElementById('pp-datasets').textContent); } catch (err) { store = { list: [], data: {} }; } }
      return store;
    }
    function ours(win) { for (var i = 0; i < window.frames.length; i++) if (window.frames[i] === win) return true; return false; }
    window.addEventListener('message', function (e) {
      var m = e.data;
      if (!m || m.source !== 'parallax-datasets' || !e.source || !ours(e.source)) return;
      var a = answer(data(), m.op, m.name, m.opts);
      e.source.postMessage({ source: 'parallax-datasets-reply', id: m.id, result: a.result, error: a.error }, '*');
    });
  })()
  </script>`
}

// Where a deck built without its data (opts.deckData) gets it: the editor
// registers its store (graphData.js), which has fetched it; on the server
// nothing is registered, and decks are given their data instead
let deckDataSource = null
export function setDeckDataSource(fn) {
  deckDataSource = typeof fn === 'function' ? fn : null
}
export function deckDataOf(presentation, opts = {}) {
  if (opts.deckData !== undefined) return opts.deckData
  return deckDataSource ? deckDataSource(presentation) : null
}

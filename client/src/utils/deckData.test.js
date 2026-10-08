import { describe, it, expect, vi } from 'vitest'
import {
  graphNeeds, graphRowsFrom, embedDatasetNames, carriedData, answerDatasets, datasetsClient, deckDatasetsScript,
  datasetSummary, dataGraphs, hasEmbeds, EMBED_VALUE_LIMIT,
} from './deckData'

const DATASETS = [
  { id: 'ds1', name: 'exoplanets', alias: null, rowCount: 3, columns: [{ name: 'p', type: 'number' }, { name: 'm', type: 'number' }, { name: 'method', type: 'string' }] },
  { id: 'ds2', name: 'raw_hist', alias: 'hist', rowCount: 2, columns: [{ name: 'from' }, { name: 'to' }, { name: 'count' }] },
]
const names = DATASETS.map(d => d.alias || d.name)
const graph = (id, expressions) => ({ id, type: 'graph', expressions })
const deck = (...elements) => ({ id: 'deck', slides: [{ id: 's', elements }] })

describe('what a deck’s slides read', () => {
  it('needs the columns graphs’ data lines plot, by dataset', () => {
    const a = graph('a', [{ id: 'd', data: { dataset: 'exoplanets', x: 'p', y: 'm', colorBy: 'method' } }, { id: 'f', latex: 'y=x' }])
    const b = graph('b', [{ id: 'e', data: { dataset: 'exoplanets', x: 'p', y: 'm', label: 'name' } }])
    expect(graphNeeds([a, b, { type: 'text' }])).toEqual(new Map([['exoplanets', new Set(['p', 'm', 'method', 'name'])]]))
    expect(dataGraphs(deck(a, graph('c', [{ id: 'f', latex: 'y=x' }]), { id: 't', type: 'text' }))).toEqual([a])
  })

  it('carries the datasets elements name in quotes, in their code or a plugin’s data or page', () => {
    const html = { id: 'h', type: 'html', content: '<script>parallax.datasets.query("exoplanets", { columns: ["p"] })</script>' }
    const p5 = { id: 'q', type: 'p5', content: "parallax.datasets.load('hist')" }
    expect(embedDatasetNames(deck(html), names)).toEqual(new Set(['exoplanets']))
    expect(embedDatasetNames(deck(html, p5), names)).toEqual(new Set(['exoplanets', 'hist']))
    // A name in passing, unquoted, isn't asked for
    expect(embedDatasetNames(deck({ id: 'h', type: 'html', content: '<p>The exoplanets so far</p>' }), names).size).toBe(0)
    const plugin = { id: 'x', type: 'plugin:scatter', pluginData: { dataset: 'hist' } }
    expect(embedDatasetNames(deck(plugin), names)).toEqual(new Set(['hist']))
    const sandbox = vi.fn(() => '<script>parallax.datasets.query(`exoplanets`)</script>')
    expect(embedDatasetNames(deck({ id: 'y', type: 'plugin:fixed', pluginData: {} }), names, { pluginSandbox: sandbox })).toEqual(new Set(['exoplanets']))
    expect(hasEmbeds(deck(graph('g', [])))).toBe(false)
    expect(hasEmbeds(deck(plugin))).toBe(true)
  })

  it('builds a graph’s rows from what’s been read, saying why a line has none', () => {
    const el = graph('g', [
      { id: 'ok', data: { dataset: 'exoplanets', x: 'p', y: 'm' } },
      { id: 'unset', data: { dataset: 'exoplanets', x: 'p' } },
      { id: 'gone', data: { dataset: 'moons', x: 'a', y: 'b' } },
      { id: 'col', data: { dataset: 'exoplanets', x: 'p', y: 'radius' } },
      { id: 'err', data: { dataset: 'hist', x: 'from', y: 'count' } },
    ])
    const tables = { ds1: { columns: { p: [1, 2], m: [3, 4] }, total: 2, version: 'v1' }, ds2: { error: 'The source is down' } }
    const rows = graphRowsFrom(el, DATASETS, ds => tables[ds.id])
    expect(rows.ok).toEqual({ x: [1, 2], y: [3, 4], total: 2, version: 'v1' })
    expect(rows.unset.error).toMatch(/columns for x and y/)
    expect(rows.gone.error).toBe('No dataset “moons” is linked to this deck')
    expect(rows.col.error).toBe('“exoplanets” has no column “radius”')
    expect(rows.err).toEqual({ error: 'The source is down' })
    // Not read yet, or not all its columns
    expect(graphRowsFrom(el, DATASETS, () => null).ok).toEqual({ loading: true })
    expect(graphRowsFrom(el, DATASETS, () => ({ columns: { p: [1] }, total: 1 })).ok).toEqual({ loading: true })
  })

  it('carries datasets whole within its limit, and says which it couldn’t', () => {
    const big = { columns: { a: new Array(EMBED_VALUE_LIMIT).fill(0) }, totalRows: EMBED_VALUE_LIMIT }
    const small = { columns: { a: [1, 2] }, totalRows: 2 }
    const data = carriedData(['small', 'big', 'broken', 'unread'], name => ({ small, big, broken: { error: 'No' } })[name] || null)
    expect(data.small).toEqual(small)
    expect(data.big.error).toMatch(/too large/)
    expect(data.broken).toEqual({ error: 'No' })
    expect('unread' in data).toBe(false)
  })
})

describe('parallax.datasets', () => {
  const store = {
    list: DATASETS.map(datasetSummary),
    data: { exoplanets: { columns: { p: [1, 2, 3], m: [4, 5, 6] }, totalRows: 3 }, hist: { error: 'Too big' } },
  }

  it('answers from the data a deck carries', () => {
    expect(answerDatasets(store, 'list').result.map(d => d.name)).toEqual(['exoplanets', 'hist'])
    expect(answerDatasets(store, 'schema', 'exoplanets').result).toEqual([{ name: 'p', type: 'number' }, { name: 'm', type: 'number' }, { name: 'method', type: 'string' }])
    expect(answerDatasets(store, 'query', 'exoplanets').result).toEqual({ columns: { p: [1, 2, 3], m: [4, 5, 6] }, totalRows: 3 })
    expect(answerDatasets(store, 'query', 'exoplanets', { columns: ['m'], offset: 1, limit: 1 }).result).toEqual({ columns: { m: [5] }, totalRows: 3 })
    expect(answerDatasets(store, 'load', 'exoplanets')).toEqual({ result: null })
    expect(answerDatasets(store, 'query', 'hist')).toEqual({ error: 'Too big' })
    expect(answerDatasets(store, 'query', 'moons').error).toBe('No dataset “moons” is linked to this deck')
    expect(answerDatasets({ list: store.list, data: {} }, 'query', 'exoplanets').error).toMatch(/name it in quotes/)
  })

  it('asks the page around it, and resolves with its answer', async () => {
    const listeners = []
    const sent = []
    const parent = { postMessage: msg => sent.push(msg) }
    const win = { parent, addEventListener: (type, fn) => listeners.push(fn) }
    const api = datasetsClient(win)
    const reply = (msg, answer) => listeners.forEach(fn => fn({ source: parent, data: { source: 'parallax-datasets-reply', id: msg.id, ...answer } }))

    const got = api.query('exoplanets', { columns: ['p'] })
    expect(sent[0]).toEqual({ source: 'parallax-datasets', id: 1, op: 'query', name: 'exoplanets', opts: { columns: ['p'] } })
    // Another frame's message is ignored
    listeners.forEach(fn => fn({ source: {}, data: { source: 'parallax-datasets-reply', id: 1, result: 'wrong' } }))
    reply(sent[0], { result: { columns: { p: [1] }, totalRows: 1 } })
    await expect(got).resolves.toEqual({ columns: { p: [1] }, totalRows: 1 })

    const failed = api.load('moons')
    reply(sent[1], { error: 'No dataset “moons” is linked to this deck' })
    await expect(failed).rejects.toThrow('No dataset “moons”')
  })

  it('is written into a deck that can’t be closed early by its data', () => {
    const html = deckDatasetsScript({ list: [], data: { x: { columns: { a: ['</script><script>alert(1)</script>'] }, totalRows: 1 } } })
    expect(html.match(/<\/script>/g)).toHaveLength(2)
    expect(html).toContain('\\u003c/script>')
    const json = html.match(/<script type="application\/json" id="pp-datasets">([\s\S]*?)<\/script>/)[1]
    expect(JSON.parse(json).data.x.columns.a[0]).toBe('</script><script>alert(1)</script>')
  })
})

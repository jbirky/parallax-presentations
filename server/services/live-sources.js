// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Where a live dataset comes from: a URL that serves CSV, TSV or JSON, or a
// TAP service and an ADQL query. Each kind checks its settings, says what to
// request, and turns the answer into a body and a format to parse, or a
// message saying what went wrong in the source's own words.

const path = require('path')
const { checkUrl } = require('./safe-fetch')

// TAP services people use most, by the base URL /sync hangs off. All
// answered REQUEST=doQuery&LANG=ADQL&FORMAT=csv on 2026-10-06
const TAP_PRESETS = [
  { id: 'exoplanets', name: 'NASA Exoplanet Archive', url: 'https://exoplanetarchive.ipac.caltech.edu/TAP' },
  { id: 'gaia', name: 'Gaia (ESA)', url: 'https://gea.esac.esa.int/tap-server/tap' },
  { id: 'irsa', name: 'IRSA (NASA/IPAC)', url: 'https://irsa.ipac.caltech.edu/TAP' },
  { id: 'simbad', name: 'SIMBAD', url: 'https://simbad.cds.unistra.fr/simbad/sim-tap' },
  { id: 'vizier', name: 'VizieR', url: 'https://tapvizier.cds.unistra.fr/TAP' },
]

const MAX_ROWS = 1000000
const FORMATS = ['auto', 'csv', 'tsv', 'json']

class SourceError extends Error {
  constructor(message) {
    super(message)
    this.sourceError = true
  }
}

function text(value, label, max) {
  if (value == null || value === '') return ''
  if (typeof value !== 'string') throw new SourceError(`${label} must be text`)
  if (value.length > max) throw new SourceError(`${label} is too long`)
  return value.trim()
}

// A source's settings as stored, checked; throws a SourceError a person can act on
function normalizeSource(kind, input = {}) {
  const keyColumn = text(input.keyColumn, 'The key column', 200) || null
  if (kind === 'url') {
    const url = text(input.url, 'The address', 2000)
    if (!url) throw new SourceError('Give the address of the data')
    checkSourceUrl(url)
    const format = input.format || 'auto'
    if (!FORMATS.includes(format)) throw new SourceError(`The format must be one of ${FORMATS.join(', ')}`)
    return { url, format, rowsPath: text(input.rowsPath, 'The rows path', 200) || null, keyColumn }
  }
  if (kind === 'tap') {
    const service = text(input.service, 'The TAP service', 2000).replace(/\/+$/, '').replace(/\/sync$/i, '')
    if (!service) throw new SourceError('Choose a TAP service')
    checkSourceUrl(service)
    const query = text(input.query, 'The query', 20000)
    if (!query) throw new SourceError('Write the ADQL query to run')
    const maxRows = input.maxRows == null || input.maxRows === '' ? MAX_ROWS : Number(input.maxRows)
    if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > MAX_ROWS) throw new SourceError(`The row limit must be a whole number from 1 to ${MAX_ROWS.toLocaleString('en-US')}`)
    return { service, query, maxRows, keyColumn }
  }
  throw new SourceError('A live dataset comes from a URL or a TAP query')
}

function checkSourceUrl(url) {
  try { checkUrl(url, {}) } catch (err) {
    // A self-hosted server may allow its own network; safeFetch checks again
    if (!/private address|standard ports/.test(err.message) || process.env.PARALLAX_FETCH_ALLOW_PRIVATE !== '1') throw new SourceError(err.message)
  }
}

// The address to fetch for a source
function requestUrl(kind, source) {
  if (kind === 'url') return source.url
  const params = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', MAXREC: String(source.maxRows || MAX_ROWS), QUERY: source.query })
  return `${source.service}/sync?${params}`
}

// A short name for the dataset's file column: the URL's file, or the service
function sourceLabel(kind, source) {
  if (kind === 'tap') return `TAP: ${new URL(source.service).hostname}`
  const u = new URL(source.url)
  return path.basename(u.pathname) || u.hostname
}

const XML_ENTITIES = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&apos;': '\'' }
const unescapeXml = s => s.replace(/&(lt|gt|amp|quot|apos);/g, m => XML_ENTITIES[m])

// A TAP service's status in a VOTable: { status: 'ERROR' | 'OVERFLOW' | 'OK', message }
function votableStatus(body) {
  const head = body.subarray(0, 64 * 1024).toString('utf8')
  if (!/<VOTABLE/i.test(head)) return null
  for (const m of head.matchAll(/<INFO\b([^>]*)>([\s\S]*?)<\/INFO>|<INFO\b([^>]*)\/>/gi)) {
    const attrs = m[1] || m[3] || ''
    if (!/name\s*=\s*["']QUERY_STATUS["']/i.test(attrs)) continue
    const status = (attrs.match(/value\s*=\s*["']([^"']*)["']/i) || [])[1] || ''
    return { status: status.toUpperCase(), message: unescapeXml((m[2] || '').trim()) }
  }
  return { status: 'UNKNOWN', message: '' }
}

// The start of a response's text, for an error message
function snippet(body) {
  return body.subarray(0, 2000).toString('utf8').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
}

function formatOf(source, res) {
  if (source.format && source.format !== 'auto') return source.format
  const type = String(res.headers['content-type'] || '').toLowerCase()
  if (type.includes('json')) return 'json'
  if (type.includes('tab-separated')) return 'tsv'
  if (type.includes('csv')) return 'csv'
  const ext = path.extname(new URL(res.url || source.url).pathname).toLowerCase()
  if (ext === '.json') return 'json'
  if (ext === '.tsv' || ext === '.tab') return 'tsv'
  if (ext === '.csv') return 'csv'
  const start = res.body.subarray(0, 4096).toString('utf8').trimStart()
  if (start.startsWith('[') || start.startsWith('{')) return 'json'
  const firstLine = start.split('\n')[0]
  if (firstLine.includes('\t') && !firstLine.includes(',')) return 'tsv'
  return 'csv'
}

// What to parse from a source's answer; throws a SourceError when the
// answer is an error, in the source's own words where it gives some
function readAnswer(kind, source, res) {
  if (kind === 'tap') {
    const vot = votableStatus(res.body)
    if (vot && vot.status === 'ERROR') throw new SourceError(`The TAP service refused the query: ${vot.message || 'no reason given'}`)
    if (res.status !== 200) throw new SourceError(`The TAP service answered ${res.status}${snippet(res.body) ? `: ${snippet(res.body)}` : ''}`)
    if (vot) throw new SourceError('The TAP service answered with a VOTable instead of CSV')
    return { body: res.body, format: 'csv' }
  }
  if (res.status < 200 || res.status >= 300) {
    throw new SourceError(`The source answered ${res.status}${snippet(res.body) ? `: ${snippet(res.body)}` : ''}`)
  }
  if (/text\/html/i.test(String(res.headers['content-type'] || '')) && (!source.format || source.format === 'auto')) {
    throw new SourceError('The address gave a web page, not data. Link to the CSV, TSV or JSON file itself.')
  }
  return { body: res.body, format: formatOf(source, res) }
}

module.exports = {
  TAP_PRESETS, MAX_ROWS, SourceError, normalizeSource, requestUrl, sourceLabel, readAnswer, votableStatus, formatOf,
}

// Where live datasets come from: checking a source's settings, the request
// it makes, reading its answer (a TAP service's errors in its own words),
// and when to fetch again. Needs nothing.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { normalizeSource, requestUrl, sourceLabel, readAnswer, votableStatus } = require('../services/live-sources')
const { allowedSchedule, nextFetch, retryAt, parseSecret } = require('../services/live-datasets')

const answer = (body, { status = 200, type = '', url = 'https://example.com/data' } = {}) =>
  ({ status, headers: type ? { 'content-type': type } : {}, body: Buffer.from(body), url })

// What the NASA Exoplanet Archive sent back for a misspelled column on 2026-10-06
const ARCHIVE_ERROR = `<?xml version="1.0" encoding="UTF-8"?>
<VOTABLE version="1.4" xmlns="http://www.ivoa.net/xml/VOTable/v1.3">
<RESOURCE type="results">
<INFO name="QUERY_STATUS" value="ERROR">
ORA-00904: 'NOSUCHCOL': invalid identifier
</INFO>
</RESOURCE>
</VOTABLE>`

describe('a source’s settings', () => {
  it('checks a URL source', () => {
    assert.deepEqual(normalizeSource('url', { url: ' https://example.com/planets.csv ' }),
      { url: 'https://example.com/planets.csv', format: 'auto', rowsPath: null, keyColumn: null })
    assert.throws(() => normalizeSource('url', {}), /Give the address/)
    assert.throws(() => normalizeSource('url', { url: 'http://169.254.169.254/latest' }), /private address/)
    assert.throws(() => normalizeSource('url', { url: 'https://example.com/x', format: 'xml' }), /format must be one of/)
    assert.throws(() => normalizeSource('url', { url: 42 }), /must be text/)
  })

  it('checks a TAP source, and asks for CSV the standard way', () => {
    const source = normalizeSource('tap', {
      service: 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync/', query: 'select pl_name from pscomppars', keyColumn: 'pl_name',
    })
    assert.equal(source.service, 'https://exoplanetarchive.ipac.caltech.edu/TAP')
    assert.equal(source.maxRows, 1000000)
    const url = new URL(requestUrl('tap', source))
    assert.equal(url.pathname, '/TAP/sync')
    assert.equal(url.searchParams.get('REQUEST'), 'doQuery')
    assert.equal(url.searchParams.get('LANG'), 'ADQL')
    assert.equal(url.searchParams.get('FORMAT'), 'csv')
    assert.equal(url.searchParams.get('QUERY'), 'select pl_name from pscomppars')
    assert.equal(sourceLabel('tap', source), 'TAP: exoplanetarchive.ipac.caltech.edu')
    assert.throws(() => normalizeSource('tap', { service: 'https://x.org/TAP' }), /ADQL query/)
    assert.throws(() => normalizeSource('tap', { service: 'https://x.org/TAP', query: 'q', maxRows: 0 }), /row limit/)
    assert.throws(() => normalizeSource('ftp', {}), /URL or a TAP query/)
  })
})

describe('a source’s answer', () => {
  it('reads a TAP service’s error out of its VOTable, whatever the status', () => {
    assert.deepEqual(votableStatus(Buffer.from(ARCHIVE_ERROR)), { status: 'ERROR', message: 'ORA-00904: \'NOSUCHCOL\': invalid identifier' })
    const tap = { service: 'https://x.org/TAP', query: 'q' }
    for (const status of [200, 400]) {
      assert.throws(() => readAnswer('tap', tap, answer(ARCHIVE_ERROR, { status })),
        /The TAP service refused the query: ORA-00904: 'NOSUCHCOL': invalid identifier/)
    }
    assert.throws(() => readAnswer('tap', tap, answer('<html><body><h1>503 Service Unavailable</h1></body></html>', { status: 503 })),
      /answered 503: 503 Service Unavailable/)
    assert.deepEqual(readAnswer('tap', tap, answer('a\n1\n')).format, 'csv')
  })

  it('works out a URL’s format from its type, its name, then its first bytes', () => {
    const src = { url: 'https://example.com/data', format: 'auto' }
    assert.equal(readAnswer('url', src, answer('[]', { type: 'application/json' })).format, 'json')
    assert.equal(readAnswer('url', src, answer('a,b', { type: 'text/csv; charset=utf-8' })).format, 'csv')
    assert.equal(readAnswer('url', src, answer('a,b', { url: 'https://example.com/x.tsv' })).format, 'tsv')
    assert.equal(readAnswer('url', src, answer('  {"data": []}')).format, 'json')
    assert.equal(readAnswer('url', src, answer('a\tb\n1\t2')).format, 'tsv')
    assert.equal(readAnswer('url', { ...src, format: 'tsv' }, answer('a,b', { type: 'text/csv' })).format, 'tsv')
  })

  it('says when an address gives a web page or an error instead of data', () => {
    const src = { url: 'https://example.com/data', format: 'auto' }
    assert.throws(() => readAnswer('url', src, answer('<html></html>', { type: 'text/html' })), /web page, not data/)
    assert.throws(() => readAnswer('url', src, answer('Not here', { status: 404 })), /answered 404: Not here/)
  })
})

describe('when a live dataset is fetched', () => {
  it('keeps a plan to its fastest refresh', () => {
    const free = { name: 'Free', minRefresh: 'daily' }
    assert.equal(allowedSchedule('hourly', free), false)
    assert.equal(allowedSchedule('daily', free), true)
    assert.equal(allowedSchedule('weekly', free), true)
    assert.equal(allowedSchedule('manual', free), true)
    assert.equal(allowedSchedule('hourly', null), true)
    assert.equal(allowedSchedule('yearly', null), false)
  })

  it('fetches again after the schedule’s interval, give or take 10%', () => {
    const now = Date.parse('2026-10-07T00:00:00Z')
    for (let i = 0; i < 20; i++) {
      const at = Date.parse(nextFetch('daily', now)) - now
      assert.ok(at >= 86400000 && at <= 86400000 * 1.1)
    }
    assert.equal(nextFetch('manual', now), null)
  })

  it('retries a failure sooner, doubling, never later than the schedule, and pauses after 10', () => {
    const now = Date.parse('2026-10-07T00:00:00Z')
    const wait = (schedule, failures, after) => (Date.parse(retryAt(schedule, failures, now, after)) - now) / 60000
    assert.equal(wait('daily', 1), 15)
    assert.equal(wait('daily', 2), 30)
    assert.equal(wait('daily', 5), 240)
    assert.equal(wait('hourly', 5), 60)
    assert.equal(wait('daily', 1, 3600000), 60)  // Retry-After: an hour
    assert.equal(retryAt('daily', 10, now), null)
    assert.equal(retryAt('manual', 1, now), null)
  })

  it('reads a header secret as Name: value', () => {
    assert.deepEqual(parseSecret('X-API-Key: abc:123'), { name: 'X-API-Key', value: 'abc:123' })
    assert.equal(parseSecret(''), null)
    assert.throws(() => parseSecret('just-a-key'), /Name: value/)
    assert.throws(() => parseSecret('Bad Name: x'), /letters, digits and dashes/)
  })
})

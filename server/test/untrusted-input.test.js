// Pieces that take what anyone can send: a dataset query's LIKE pattern, and
// the type an uploaded file is served with. Needs nothing.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { likeMatch, applyQuery } = require('../services/dataset-service')
const { uploadContentType, setUploadHeaders } = require('../utils/upload-headers')

describe('a dataset query’s LIKE', () => {
  it('matches as SQL does, ignoring case', () => {
    assert.equal(likeMatch('Hello', 'h%'), true)
    assert.equal(likeMatch('Hello', '%LL%'), true)
    assert.equal(likeMatch('Hello', 'h_llo'), true)
    assert.equal(likeMatch('Hello', 'h_lo'), false)
    assert.equal(likeMatch('abcbc', 'a%bc'), true)
    assert.equal(likeMatch('', '%'), true)
    assert.equal(likeMatch('', '_'), false)
    assert.equal(likeMatch(42, '4_'), true)
  })

  it('takes the rest of the pattern as it is, not as a regex', () => {
    assert.equal(likeMatch('a.c', 'a.c'), true)
    assert.equal(likeMatch('abc', 'a.c'), false)
    assert.equal(likeMatch('x(y', 'x(y'), true)
    assert.equal(likeMatch('aaa', 'a*'), false)
  })

  it('answers at once for patterns a regex would take forever on', () => {
    const start = Date.now()
    assert.equal(likeMatch('a'.repeat(100000), '%'.repeat(30) + '!'), false)
    assert.equal(likeMatch('a'.repeat(20000), '%a'.repeat(60) + '!'), false)
    assert.ok(Date.now() - start < 1000)
  })

  it('filters rows by it', () => {
    const rows = [{ name: 'Mars' }, { name: 'Venus' }, { name: 'Mercury' }]
    const { columns, totalRows } = applyQuery(rows, [{ name: 'name' }], { where: { name: { like: 'm%' } } })
    assert.deepEqual(columns.name, ['Mars', 'Mercury'])
    assert.equal(totalRows, 2)
  })
})

describe('the type an upload is served with', () => {
  function headersFor(name) {
    const headers = {}
    setUploadHeaders({ setHeader: (k, v) => { headers[k.toLowerCase()] = v } }, name)
    return headers
  }

  it('comes from its name, never from what the uploader sent', () => {
    assert.equal(uploadContentType('p/1234.png'), 'image/png')
    assert.equal(uploadContentType('x.SVG'), 'image/svg+xml')
    assert.equal(uploadContentType('font.woff2'), 'font/woff2')
    assert.equal(uploadContentType('page.html'), 'application/octet-stream')
    assert.equal(uploadContentType('noext'), 'application/octet-stream')
  })

  it('keeps anything opened on its own in a sandbox, and makes the rest a download', () => {
    assert.deepEqual(headersFor('a.svg'), { 'content-type': 'image/svg+xml', 'x-content-type-options': 'nosniff', 'content-security-policy': 'sandbox' })
    assert.equal(headersFor('a.png')['content-security-policy'], 'sandbox')
    assert.equal(headersFor('a.pdf')['content-security-policy'], undefined)
    const html = headersFor('forked/a.xhtml')
    assert.equal(html['content-type'], 'application/octet-stream')
    assert.equal(html['content-disposition'], 'attachment')
    assert.equal(html['content-security-policy'], 'sandbox')
  })
})

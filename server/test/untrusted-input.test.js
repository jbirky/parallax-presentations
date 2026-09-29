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

describe('what a failed request says', () => {
  it('keeps the app’s own messages, and not the database’s, the file system’s or storage’s', () => {
    // In production, which the module reads when it loads
    const { execFileSync } = require('child_process')
    const script = `
      console.error = () => {}
      const { safeErrorMessage } = require(${JSON.stringify(require.resolve('../middleware/security'))})
      const e = (m, extra) => Object.assign(new Error(m), extra)
      console.log(JSON.stringify([
        e('GitHub refused the push: 404'),
        e('duplicate key value violates unique constraint "users_email_key"', { code: '23505', severity: 'ERROR' }),
        e("ENOENT: no such file or directory, open '/app/server/data/x'", { code: 'ENOENT', errno: -2, syscall: 'open' }),
        e('Access Denied', { $metadata: { httpStatusCode: 403 } }),
        e('Bad JSON', { statusCode: 400 }),
      ].map(safeErrorMessage)))`
    const out = JSON.parse(execFileSync(process.execPath, ['-e', script], { env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8' }))
    assert.deepEqual(out, ['GitHub refused the push: 404', 'Internal server error', 'Internal server error', 'Internal server error', 'Bad JSON'])
  })
})

describe('reading a dataset', () => {
  const os = require('os')
  const fs = require('fs')
  const path = require('path')
  const { readDatasetFile, deleteDatasetFile } = require('../services/dataset-service')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'datasets-'))
  fs.mkdirSync(path.join(dir, 'datasets'))
  let n = 0
  const stored = (text, ext = 'csv') => {
    const name = `d${++n}.${ext}`
    fs.writeFileSync(path.join(dir, 'datasets', name), text)
    return `local:${name}`
  }

  it('gives the rows the whole-file parser did, across chunk boundaries', async () => {
    const { parse } = require('csv-parse/sync')
    // Rows of "é" (two bytes) so that some straddle the 256 KB chunks
    const text = 'city,name,value\n' + Array.from({ length: 30000 }, (_, i) => `Montréal,é${'é'.repeat(i % 7)},${i}`).join('\n')
    const rows = await readDatasetFile(stored(text), 'csv', dir)
    assert.deepEqual(rows, parse(text, { columns: true, skip_empty_lines: true, cast: true, relax_column_count: true }))
    const tsv = await readDatasetFile(stored('a\tb\n1\tx\n', 'tsv'), 'tsv', dir)
    assert.deepEqual(tsv, [{ a: 1, b: 'x' }])
  })

  it('leaves the server free while it parses', async () => {
    const text = 'a,b,c\n' + '1,two,3.5\n'.repeat(600000)  // 6 MB
    let ticks = 0
    const timer = setInterval(() => ticks++, 5)
    const rows = await readDatasetFile(stored(text), 'csv', dir)
    clearInterval(timer)
    assert.equal(rows.length, 600000)
    assert.ok(ticks >= 3, `timers ran ${ticks} times while it parsed`)
  })

  it('reads a file once, while it stays unchanged', async () => {
    const key = stored('x,y\n1,2\n')
    const [a, b] = await Promise.all([readDatasetFile(key, 'csv', dir), readDatasetFile(key, 'csv', dir)])
    assert.equal(a, b)
    assert.equal(await readDatasetFile(key, 'csv', dir), a)
    await deleteDatasetFile(key, dir)
    await assert.rejects(readDatasetFile(key, 'csv', dir))
  })

  it('turns a CSV it can’t read into an error, not a crash', async () => {
    // Before, the parser's error went unheard between chunks, and ended the process
    await assert.rejects(readDatasetFile(stored('a,b\n"x"y,2\n'), 'csv', dir), /quote/i)
    const late = 'a,b\n' + '1,2\n'.repeat(100000) + '5" screen,3\n'  // past the first chunk
    await assert.rejects(readDatasetFile(stored(late), 'csv', dir), /quote/i)
    // and the next read still works
    assert.deepEqual(await readDatasetFile(stored('a\n1\n'), 'csv', dir), [{ a: 1 }])
  })

  it('doesn’t let a column named __proto__ be a row’s prototype', async () => {
    const [row] = await readDatasetFile(stored('__proto__,b\nx,1\n'), 'csv', dir)
    assert.equal(Object.getPrototypeOf(row), Object.prototype)
    assert.deepEqual(row, { _proto_: 'x', b: 1 })
  })
})

// Fetching a URL someone gave the server: the addresses it refuses, the
// sizes and times it stops at, and redirects. Needs nothing: the sources are
// a local server, which the tests treat as public (everything else private
// stays refused).

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const zlib = require('zlib')
const { safeFetch, isPrivateAddress, checkUrl, checkedLookup, USER_AGENT } = require('../services/safe-fetch')

describe('the addresses the server won’t fetch from', () => {
  it('refuses private, loopback, link-local and reserved addresses, in every spelling', () => {
    const refused = [
      '127.0.0.1', '127.255.0.9', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
      '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1',
      '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'fec0::1', 'ff02::1', '2001:db8::1',
      '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '::127.0.0.1', '64:ff9b::a9fe:a9fe', '2002:7f00:1::',
      'not-an-address', '',
    ]
    for (const ip of refused) assert.equal(isPrivateAddress(ip), true, ip)
  })

  it('fetches from public ones', () => {
    const allowed = ['8.8.8.8', '1.1.1.1', '134.4.20.1', '172.32.0.1', '192.169.0.1', '100.128.0.1',
      '2606:4700:4700::1111', '::ffff:8.8.8.8', '2002:808:808::']
    for (const ip of allowed) assert.equal(isPrivateAddress(ip), false, ip)
  })

  it('reads an address however the URL spells it', () => {
    for (const url of ['http://2130706433/', 'http://0177.0.0.1/', 'http://0x7f.1/', 'http://[::1]/', 'http://[::ffff:169.254.169.254]/',
      'http://localhost/', 'http://db.localhost/', 'http://metadata.google.internal/', 'http://printer.local/']) {
      assert.throws(() => checkUrl(url, {}), /private address/, url)
    }
  })

  it('takes only http and https, on the standard ports, with no credentials in the address', () => {
    assert.throws(() => checkUrl('ftp://example.com/x', {}), /Only http and https/)
    assert.throws(() => checkUrl('file:///etc/passwd', {}), /Only http and https/)
    assert.throws(() => checkUrl('https://example.com:8443/', {}), /standard ports/)
    assert.throws(() => checkUrl('https://me:secret@example.com/', {}), /credentials/)
    assert.throws(() => checkUrl('not a url', {}), /isn’t a web address/)
    assert.equal(checkUrl('https://example.com/x?y=1', {}).hostname, 'example.com')
    assert.equal(checkUrl('http://example.com:80/', {}).hostname, 'example.com')
  })

  it('keeps to the hosts a self-hosted server allows, and can allow its own network', () => {
    const hosts = { allowedHosts: ['caltech.edu'] }
    assert.equal(checkUrl('https://exoplanetarchive.ipac.caltech.edu/TAP', hosts).hostname, 'exoplanetarchive.ipac.caltech.edu')
    assert.throws(() => checkUrl('https://example.com/', hosts), /only fetches from caltech.edu/)
    assert.throws(() => checkUrl('https://notcaltech.edu/', hosts), /only fetches from/)
    assert.equal(checkUrl('http://10.0.0.5:8080/data.csv', { allowPrivate: true }).hostname, '10.0.0.5')
  })

  it('refuses a name whose DNS answer is private, in the lookup the request connects with', async () => {
    const err = await new Promise(resolve => checkedLookup(isPrivateAddress)('localhost', {}, resolve))
    assert.match(err.message, /leads to a private address/)
  })
})

describe('fetching', () => {
  let server, base, last
  const routes = {
    '/plain': (req, res) => { last = req; res.end('a,b\n1,2\n') },
    '/gzip': (req, res) => { res.setHeader('Content-Encoding', 'gzip'); res.end(zlib.gzipSync('x\n'.repeat(1000))) },
    '/big': (req, res) => res.end(Buffer.alloc(2048, 'x')),
    '/bomb': (req, res) => { res.setHeader('Content-Encoding', 'gzip'); res.end(zlib.gzipSync(Buffer.alloc(5 * 1024 * 1024))) },
    '/silent': () => {},
    '/slow': (req, res) => { res.write('a'); setTimeout(() => res.end('b'), 2000) },
    '/to-metadata': (req, res) => { res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' }); res.end() },
    '/to-plain': (req, res) => { res.writeHead(301, { Location: '/plain' }); res.end() },
    '/loop': (req, res) => { res.writeHead(302, { Location: '/loop' }); res.end() },
    '/etag': (req, res) => {
      if (req.headers['if-none-match'] === '"v1"') { res.writeHead(304); return res.end() }
      res.writeHead(200, { ETag: '"v1"' }); res.end('data')
    },
    '/error': (req, res) => { res.writeHead(400, { 'Content-Type': 'application/xml' }); res.end('<INFO name="QUERY_STATUS" value="ERROR">bad</INFO>') },
  }
  // The local server counts as public here; everything else private stays refused
  const opts = { blocked: ip => ip !== '127.0.0.1' && isPrivateAddress(ip), anyPort: true, politeMs: 0 }

  before(async () => {
    server = http.createServer((req, res) => (routes[req.url.split('?')[0]] || ((q, r) => { r.writeHead(404); r.end() }))(req, res))
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${server.address().port}`
  })
  after(() => server.close())

  it('gets a body, saying who it is', async () => {
    const res = await safeFetch(`${base}/plain`, opts)
    assert.equal(res.status, 200)
    assert.equal(res.body.toString(), 'a,b\n1,2\n')
    assert.equal(last.headers['user-agent'], USER_AGENT)
  })

  it('refuses the local server without the test’s exception', async () => {
    await assert.rejects(safeFetch(`${base}/plain`, { politeMs: 0 }), /standard ports|private address/)
    await assert.rejects(safeFetch(`${base}/plain`, { anyPort: true, politeMs: 0 }), /private address/)
  })

  it('decompresses, and stops at the cap counted after decompressing', async () => {
    assert.equal((await safeFetch(`${base}/gzip`, opts)).body.length, 2000)
    await assert.rejects(safeFetch(`${base}/big`, { ...opts, maxBytes: 1024 }), /larger than/)
    await assert.rejects(safeFetch(`${base}/bomb`, { ...opts, maxBytes: 1024 * 1024 }), /larger than 1 MB/)
  })

  it('gives up on a source that doesn’t answer, or takes too long', async () => {
    await assert.rejects(safeFetch(`${base}/silent`, { ...opts, firstByteMs: 200 }), /didn’t answer within/)
    await assert.rejects(safeFetch(`${base}/slow`, { ...opts, totalMs: 500 }), /took longer than/)
  })

  it('follows redirects, checking each place it’s sent', async () => {
    const res = await safeFetch(`${base}/to-plain`, opts)
    assert.equal(res.body.toString(), 'a,b\n1,2\n')
    assert.equal(res.url, `${base}/plain`)
    await assert.rejects(safeFetch(`${base}/to-metadata`, opts), /169\.254\.169\.254 is a private address/)
    await assert.rejects(safeFetch(`${base}/loop`, opts), /redirected more than 5 times/)
  })

  it('answers 304 with nothing to read when the data hasn’t changed', async () => {
    const first = await safeFetch(`${base}/etag`, opts)
    assert.equal(first.headers.etag, '"v1"')
    const again = await safeFetch(`${base}/etag`, { ...opts, headers: { 'If-None-Match': first.headers.etag } })
    assert.equal(again.status, 304)
    assert.equal(again.body.length, 0)
  })

  it('hands back an error status with its body, for the caller to read', async () => {
    const res = await safeFetch(`${base}/error`, opts)
    assert.equal(res.status, 400)
    assert.match(res.body.toString(), /QUERY_STATUS/)
  })

  it('asks one host one thing at a time, spaced out', async () => {
    const starts = []
    const spaced = { ...opts, politeMs: 150 }
    routes['/stamp'] = (req, res) => { starts.push(Date.now()); res.end('ok') }
    await Promise.all([safeFetch(`${base}/stamp`, spaced), safeFetch(`${base}/stamp`, spaced), safeFetch(`${base}/stamp`, spaced)])
    assert.equal(starts.length, 3)
    assert.ok(starts[1] - starts[0] >= 140 && starts[2] - starts[1] >= 140, `started ${starts.map(s => s - starts[0]).join(', ')} ms apart`)
  })
})

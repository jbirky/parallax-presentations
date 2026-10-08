// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Fetches a URL someone gave Parallax, as the server. It won't connect to an
// address inside the server's own network (its database, the cloud's
// metadata service, the machine itself), follows a redirect only to where it
// would have gone in the first place, and stops at a size and a time.
//
// It uses node:http(s) rather than fetch() because it has to pick the
// address it connects to: the address checked is the one used, so a second
// DNS answer can't swap in another (DNS rebinding).

const http = require('http')
const https = require('https')
const dns = require('dns')
const net = require('net')
const zlib = require('zlib')

const USER_AGENT = 'Parallax/1.0 (+https://parallax-presentations.com; support@parallax-presentations.com)'
const DEFAULTS = {
  maxBytes: 100 * 1024 * 1024, firstByteMs: 15000, totalMs: 120000, maxRedirects: 5, politeMs: 2000,
}

class FetchError extends Error {
  constructor(message, extra = {}) {
    super(message)
    this.fetchError = true
    Object.assign(this, extra)
  }
}

// --- Which addresses are off limits ---

// [first address, prefix length]: this network, private networks, carrier
// NAT, loopback, link-local (169.254.169.254 is the cloud's metadata
// service), test and documentation ranges, multicast and reserved
const BLOCKED_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
].map(([ip, bits]) => [v4ToInt(ip), bits])

function v4ToInt(ip) {
  return ip.split('.').reduce((n, part) => n * 256 + Number(part), 0)
}

function blockedV4(ip) {
  const n = v4ToInt(ip)
  return BLOCKED_V4.some(([base, bits]) => Math.floor(n / 2 ** (32 - bits)) === Math.floor(base / 2 ** (32 - bits)))
}

// An IPv6 address as its eight 16-bit groups
function v6Groups(ip) {
  let text = ip.toLowerCase().replace(/%.*$/, '')
  // A dotted IPv4 tail (::ffff:1.2.3.4) as two groups
  const tail = text.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (tail) {
    const n = v4ToInt(tail[1])
    text = text.slice(0, -tail[1].length) + `${Math.floor(n / 65536).toString(16)}:${(n % 65536).toString(16)}`
  }
  const [head, rest] = text.split('::')
  const a = head ? head.split(':') : []
  const b = rest !== undefined && rest !== '' ? rest.split(':') : []
  const fill = rest !== undefined ? new Array(8 - a.length - b.length).fill('0') : []
  return [...a, ...fill, ...b].map(g => parseInt(g, 16))
}

const groupsToV4 = (hi, lo) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`

function blockedV6(ip) {
  const g = v6Groups(ip)
  if (g.length !== 8 || g.some(x => Number.isNaN(x))) return true
  const zerosTo = k => g.slice(0, k).every(x => x === 0)
  if (zerosTo(8)) return true                                          // ::
  if (zerosTo(7) && g[7] === 1) return true                            // ::1
  if (zerosTo(5) && g[5] === 0xffff) return blockedV4(groupsToV4(g[6], g[7]))  // ::ffff:a.b.c.d
  if (zerosTo(6)) return blockedV4(groupsToV4(g[6], g[7]))             // ::a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every(x => x === 0)) return blockedV4(groupsToV4(g[6], g[7]))  // NAT64
  if (g[0] === 0x2002) return blockedV4(groupsToV4(g[1], g[2]))        // 6to4
  if ((g[0] & 0xfe00) === 0xfc00) return true                          // unique local
  if ((g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0) return true  // link- and site-local
  if ((g[0] & 0xff00) === 0xff00) return true                          // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true                  // documentation
  if (g[0] === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true  // discard
  return false
}

// Whether the server mustn't connect to `ip`; anything that isn't an
// address at all counts as off limits
function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) return blockedV4(ip)
  if (net.isIPv6(ip)) return blockedV6(ip)
  return true
}

// --- The rules a URL must pass ---

function settings() {
  const hosts = (process.env.PARALLAX_FETCH_HOSTS || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
  const gap = Number(process.env.PARALLAX_FETCH_GAP_MS)
  return {
    allowPrivate: process.env.PARALLAX_FETCH_ALLOW_PRIVATE === '1', allowedHosts: hosts,
    ...(Number.isFinite(gap) && gap >= 0 && { politeMs: gap }),
  }
}

// Which addresses a request refuses, and whether it may use any port:
// allowPrivate (a self-hosted server's setting) lifts both rules; a test can
// pass its own `blocked`
function rules({ allowPrivate, blocked, anyPort }) {
  if (allowPrivate) return { blocked: () => false, anyPort: true }
  return { blocked: blocked || isPrivateAddress, anyPort: !!anyPort }
}

function checkUrl(url, opts) {
  const { blocked, anyPort } = rules(opts)
  let u
  try { u = new URL(url) } catch { throw new FetchError('That isn’t a web address') }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new FetchError('Only http and https addresses can be fetched')
  if (u.username || u.password) throw new FetchError('Put credentials in a header, not in the address')
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const port = u.port || (u.protocol === 'https:' ? '443' : '80')
  if (!anyPort && port !== '443' && port !== '80') throw new FetchError('Only the standard ports (80 and 443) can be fetched')
  if (net.isIP(host) && blocked(host)) throw new FetchError(`${host} is a private address, which Parallax doesn’t fetch from`)
  // Names that only ever mean something inside a network
  if (!opts.allowPrivate && !net.isIP(host)
      && (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local'))) {
    throw new FetchError(`${host} is a private address, which Parallax doesn’t fetch from`)
  }
  const { allowedHosts } = opts
  if (allowedHosts && allowedHosts.length && !allowedHosts.some(h => host === h || host.endsWith(`.${h}`))) {
    throw new FetchError(`This server only fetches from ${allowedHosts.join(', ')}`)
  }
  return u
}

// A DNS lookup that refuses private addresses, for http.request: the address
// it hands back is the one the request connects to
function checkedLookup(blocked) {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err)
      const bad = addresses.find(a => blocked(a.address))
      if (bad) return callback(new FetchError(`${hostname} leads to a private address (${bad.address}), which Parallax doesn’t fetch from`))
      if (options && options.all) return callback(null, addresses)
      callback(null, addresses[0].address, addresses[0].family)
    })
  }
}

// --- Being a polite client: one request at a time to a host, spaced out ---

const hostQueues = new Map()

function politely(host, gapMs, run) {
  const prev = hostQueues.get(host) || Promise.resolve(0)
  const next = prev.then(async lastEnd => {
    const wait = lastEnd + gapMs - Date.now()
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
    try { return { value: await run() } } catch (error) { return { error } }
  })
  const done = next.then(() => Date.now())
  hostQueues.set(host, done)
  done.then(() => { if (hostQueues.get(host) === done) hostQueues.delete(host) })
  return next.then(r => { if (r.error) throw r.error; return r.value })
}

// --- One request ---

function requestOnce(u, { headers, maxBytes, firstByteMs, totalMs, ...opts }) {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http
    let finished = false
    const fail = err => { if (!finished) { finished = true; clearTimeout(total); clearTimeout(first); req.destroy(); reject(err) } }
    const total = setTimeout(() => fail(new FetchError(`The source took longer than ${Math.round(totalMs / 1000)} s`)), totalMs)
    const first = setTimeout(() => fail(new FetchError(`The source didn’t answer within ${Math.round(firstByteMs / 1000)} s`)), firstByteMs)
    const req = lib.request(u, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip, deflate, br', Accept: '*/*', ...headers },
      lookup: checkedLookup(rules(opts).blocked),
    }, res => {
      clearTimeout(first)
      const status = res.statusCode
      if ((status >= 300 && status < 400) || status === 204) {
        res.resume()
        finished = true
        clearTimeout(total)
        return resolve({ status, headers: res.headers, body: Buffer.alloc(0) })
      }
      const encoding = String(res.headers['content-encoding'] || '').toLowerCase()
      let stream = res
      if (encoding === 'gzip' || encoding === 'x-gzip') stream = res.pipe(zlib.createGunzip())
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate())
      else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress())
      const chunks = []
      let bytes = 0
      stream.on('data', chunk => {
        bytes += chunk.length
        // Counted after decompression, so a small compressed body can't
        // expand past the cap
        if (bytes > maxBytes) return fail(new FetchError(`The data is larger than ${Math.round(maxBytes / (1024 * 1024))} MB`, { tooBig: true }))
        chunks.push(chunk)
      })
      stream.on('end', () => {
        if (finished) return
        finished = true
        clearTimeout(total)
        resolve({ status, headers: res.headers, body: Buffer.concat(chunks) })
      })
      stream.on('error', err => fail(new FetchError(`The source’s answer couldn’t be read: ${err.message}`)))
      res.on('error', err => fail(new FetchError(`The connection broke: ${err.message}`)))
    })
    req.on('error', err => fail(err.fetchError ? err : new FetchError(friendlyNetworkError(err))))
    req.end()
  })
}

function friendlyNetworkError(err) {
  if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') return `No server found at ${err.hostname || 'that address'}`
  if (err.code === 'ECONNREFUSED') return 'The server refused the connection'
  if (err.code === 'ECONNRESET') return 'The server closed the connection'
  if (err.code === 'CERT_HAS_EXPIRED' || /certificate/i.test(err.message)) return `The server’s certificate isn’t valid: ${err.message}`
  return `The request failed: ${err.message}`
}

// Fetches `url`, following up to maxRedirects redirects, each checked as the
// first address was. Resolves to { status, headers, body, url } for any
// status (a TAP error comes back as a 400 with its message in the body);
// throws a FetchError when the address isn't allowed, or for a network
// failure, a timeout or a body over maxBytes. A 304 has an empty body.
async function safeFetch(url, options = {}) {
  const opts = { ...DEFAULTS, ...settings(), ...options }
  let current = checkUrl(url, opts)
  for (let hops = 0; ; hops++) {
    const res = await politely(current.host, opts.politeMs, () => requestOnce(current, opts))
    const location = res.headers.location
    if ([301, 302, 303, 307, 308].includes(res.status) && location) {
      if (hops >= opts.maxRedirects) throw new FetchError(`The source redirected more than ${opts.maxRedirects} times`)
      current = checkUrl(new URL(location, current).toString(), opts)
      continue
    }
    return { ...res, url: current.toString() }
  }
}

module.exports = { safeFetch, isPrivateAddress, checkUrl, checkedLookup, FetchError, USER_AGENT }

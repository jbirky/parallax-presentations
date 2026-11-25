// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Slides as JPEGs, drawn in a headless Chromium. The Docker image has
// Alpine's chromium-headless-shell; PARALLAX_CHROMIUM points elsewhere. One
// render at a time.
//
// - renderFirstSlide(url): a deck's first slide, for the landing page's
//   example cards. The deck's own page (/examples/<slug>, from this server)
//   is opened, and the first slide is stepped through so all of it shows.
// - renderAllSlides(url): every slide of such a page, smaller, for a
//   landing page template's own page (services/template-slides.js).
// - renderSlide({ html, origin, slideId }): any slide of a deck page the
//   server built, for AI collaborator links (server/mcp). Anyone's deck can
//   be drawn this way, and a deck runs its author's code, so the browser
//   gets no network of its own: every request goes to a proxy that isn't
//   there, unless this answers it. It answers with the page, the server's
//   own files a deck uses (libraries, uploads, plugin files), and anything
//   public over the web through safe-fetch.js, which refuses addresses
//   inside the server's network at every redirect. So a deck can't frame or
//   load a page from inside the network into the picture.
//
// Either way the slide is shown as the presenter leaves it: stepped through
// to its end, as when stepping back to it, without the deck's buttons.

const fs = require('fs')
const crypto = require('crypto')
const { safeFetch } = require('./safe-fetch')

const CANDIDATES = ['/usr/bin/chromium-headless-shell', '/usr/lib/chromium/chromium-headless-shell', '/usr/bin/chromium-browser', '/usr/bin/chromium']
const WIDTH = 960, HEIGHT = 540
// WebGL (3D graphs, molecules, harmonics) in software, as there's no GPU
const BROWSER_ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
// No network: a proxy nothing listens on, for every address, the machine's
// own too (loopback skips a proxy unless told not to)
const NO_NETWORK = ['--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>']
// The server's files a deck page may load (sendDeckPage's pages load the same)
const LOCAL_FILES = /^\/(?:vendor|uploads|examples)\/|^\/api\/plugins\/[a-z0-9-]+\/assets\//
const MAX_FILE_BYTES = 25 * 1024 * 1024
// A deck page's sandbox, as the server sends it (index.js's sendDeckPage)
const DECK_PAGE_SANDBOX = 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads allow-pointer-lock'
// The most slides drawn for one deck
const MAX_SLIDES = 60
const HIDE_CONTROLS = '#fs-btn, #overview-toggle, #overview-panel, .reveal .controls, .reveal .progress { display: none !important; }'

// The Chromium to use, or null when this server has none. playwright-core
// needs Node 20, and on an older one ends the process when it loads, so
// there's none to use there.
function chromiumPath() {
  if (Number(process.versions.node.split('.')[0]) < 20) return null
  const set = process.env.PARALLAX_CHROMIUM
  if (set) return fs.existsSync(set) ? set : null
  return CANDIDATES.find(p => fs.existsSync(p)) || null
}

class ThumbnailError extends Error {}

let queue = Promise.resolve()
let waiting = 0
function queued(work) {
  waiting++
  const run = queue.then(work).finally(() => { waiting-- })
  queue = run.catch(() => {})
  return run
}
// How many renders are waiting or running
const queueLength = () => waiting

// The JPEG of the deck at `url`'s first slide; throws a ThumbnailError
function renderFirstSlide(url) {
  return queued(() => drawFirst(url))
}

// JPEGs of every slide of the deck at `url`, in order, `scale` times its
// size; throws a ThumbnailError
function renderAllSlides(url, { scale = 0.5 } = {}) {
  return queued(() => drawAll(url, scale))
}

// The JPEG of one slide of a deck page: html, the page as the server builds
// it, with its files at origin (this server, as the browser reaches it);
// slideId, the slide's id. width and height: the page's size. Throws a
// ThumbnailError.
function renderSlide({ html, origin, slideId, width = WIDTH, height = HEIGHT, fetchOutside = safeFetch }) {
  return queued(() => drawSlide({ html, origin, slideId, width, height, fetchOutside }))
}

async function launch(extraArgs = []) {
  const executablePath = chromiumPath()
  if (!executablePath) throw new ThumbnailError('This server has no Chromium to draw slides with')
  const { chromium } = require('playwright-core')
  return chromium.launch({ executablePath, args: [...BROWSER_ARGS, ...extraArgs] })
}

// Steps the slide showing through to its end, then back to it, so all of it
// shows as when the presenter steps back to it
async function stepToEnd(page) {
  const at = () => page.evaluate(() => JSON.stringify(window.Reveal.getIndices()))
  const start = JSON.parse(await at())
  for (let i = 0; i < 60; i++) {
    const before = await at()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)
    const now = JSON.parse(await at())
    if (now.h !== start.h || now.v !== start.v) { await page.keyboard.press('ArrowLeft'); break }
    if (JSON.stringify(now) === before) break
  }
}

async function drawFirst(url) {
  let browser = null
  try {
    browser = await launch()
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 })
    await page.goto(url, { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady(), null, { timeout: 20000 })
    await page.waitForTimeout(1500)
    await stepToEnd(page)
    await page.addStyleTag({ content: HIDE_CONTROLS })
    await page.waitForTimeout(2500)
    return await page.screenshot({ type: 'jpeg', quality: 82 })
  } catch (err) {
    throw err instanceof ThumbnailError ? err : new ThumbnailError(`The first slide couldn’t be drawn: ${err.message.split('\n')[0]}`)
  } finally {
    await browser?.close()
  }
}

async function drawAll(url, scale) {
  let browser = null
  try {
    browser = await launch()
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: scale })
    await page.goto(url, { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady(), null, { timeout: 20000 })
    await page.addStyleTag({ content: HIDE_CONTROLS })
    await page.waitForTimeout(1500)
    const total = await page.evaluate(() => window.Reveal.getSlides().length)
    const shots = []
    for (let i = 0; i < Math.min(total, MAX_SLIDES); i++) {
      await page.evaluate(n => { const at = window.Reveal.getIndices(window.Reveal.getSlides()[n]); window.Reveal.slide(at.h, at.v, -1) }, i)
      await page.waitForTimeout(400)
      await stepToEnd(page)
      await page.waitForTimeout(1200)
      shots.push(await page.screenshot({ type: 'jpeg', quality: 80 }))
    }
    return shots
  } catch (err) {
    throw err instanceof ThumbnailError ? err : new ThumbnailError(`The slides couldn’t be drawn: ${err.message.split('\n')[0]}`)
  } finally {
    await browser?.close()
  }
}

// The headers a file is passed on to the page with
function passHeaders(headers) {
  const out = {}
  for (const key of ['content-type', 'access-control-allow-origin', 'cache-control']) {
    const value = typeof headers.get === 'function' ? headers.get(key) : headers[key]
    if (value) out[key] = String(value)
  }
  return out
}

// One of the server's own files, from the server
async function localFile(url) {
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
  if (Number(res.headers.get('content-length')) > MAX_FILE_BYTES) return { status: 413, headers: {}, body: Buffer.alloc(0) }
  const body = Buffer.from(await res.arrayBuffer())
  if (body.length > MAX_FILE_BYTES) return { status: 413, headers: {}, body: Buffer.alloc(0) }
  return { status: res.status, headers: passHeaders(res.headers), body }
}

// Answers each request the page makes: see the top of the file
async function answer(route, { pageUrl, html, origin, fetchOutside }) {
  const request = route.request()
  let url
  try { url = new URL(request.url()) } catch { return route.abort('blockedbyclient') }
  if (url.href === pageUrl) {
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': DECK_PAGE_SANDBOX }, body: html })
  }
  // Only reading, and no video or sound, which a picture doesn't show
  if (request.method() !== 'GET' || request.resourceType() === 'media') return route.abort('blockedbyclient')
  try {
    if (url.origin === origin) {
      if (!LOCAL_FILES.test(url.pathname)) return route.abort('blockedbyclient')
      return route.fulfill(await localFile(url.href))
    }
    if (url.protocol !== 'https:') return route.abort('blockedbyclient')
    const res = await fetchOutside(url.href, { maxBytes: MAX_FILE_BYTES, firstByteMs: 8000, totalMs: 15000, politeMs: 0 })
    return route.fulfill({ status: res.status, headers: passHeaders(res.headers), body: res.body })
  } catch {
    return route.abort('failed').catch(() => {})
  }
}

async function drawSlide({ html, origin, slideId, width, height, fetchOutside }) {
  const pageUrl = `${origin}/__slide/${crypto.randomUUID()}`
  let browser = null
  try {
    browser = await launch(NO_NETWORK)
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: 'block' })
    await context.route('**/*', route => answer(route, { pageUrl, html, origin, fetchOutside }))
    const page = await context.newPage()
    await page.goto(pageUrl, { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady(), null, { timeout: 20000 })
    const found = await page.evaluate(id => {
      const section = [...document.querySelectorAll('.reveal .slides section[data-slide-id]')].find(s => s.getAttribute('data-slide-id') === id)
      if (!section) return false
      const { h, v } = window.Reveal.getIndices(section)
      window.Reveal.slide(h, v)
      return true
    }, String(slideId))
    if (!found) throw new ThumbnailError('That slide isn’t in the presented deck (it may be hidden)')
    await page.waitForTimeout(1200)
    await stepToEnd(page)
    await page.addStyleTag({ content: HIDE_CONTROLS })
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {})
    await page.waitForTimeout(1500)
    return await page.screenshot({ type: 'jpeg', quality: 80 })
  } catch (err) {
    throw err instanceof ThumbnailError ? err : new ThumbnailError(`The slide couldn’t be drawn: ${err.message.split('\n')[0]}`)
  } finally {
    await browser?.close()
  }
}

module.exports = { renderFirstSlide, renderAllSlides, renderSlide, chromiumPath, queueLength, ThumbnailError, LOCAL_FILES, NO_NETWORK }

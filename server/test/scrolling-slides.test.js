// Pages the server builds (exports, share links, the live viewer) present a
// scrolling slide the way the editor's Present window does. Runs the
// self-hosted version, which needs no database. .env isn't read.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
const fs = require('fs')

const serverDir = path.join(__dirname, '..')
const { SCROLLING_CSS, SCROLLING_SCRIPT } = require('../services/scrolling-slides')
let base, server

function startServer() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parallax-test-'))
  for (const key of ['PARALLAX_MODE', 'PARALLAX_DB', 'DATABASE_URL', 'PARALLAX_STORAGE']) delete process.env[key]
  Object.assign(process.env, {
    NODE_ENV: 'test', SLIDES_DATA_DIR: path.join(tmp, 'data'), SLIDES_UPLOADS_DIR: path.join(tmp, 'uploads'),
  })
  const dotenv = require.resolve('dotenv', { paths: [serverDir] })
  require.cache[dotenv] = { id: dotenv, filename: dotenv, loaded: true, exports: { config: () => ({ parsed: {} }) }, children: [], paths: [] }
  const { app } = require('../index.js')
  return new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
}

async function exported(fields) {
  const json = (method, url, body) => fetch(base + url, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(res => res.json())
  const { id } = await json('POST', '/api/presentations', { title: 'Tall' })
  await json('PUT', `/api/presentations/${id}`, fields)
  return (await fetch(`${base}/api/presentations/${id}/export`)).text()
}

const text = (id, extra = {}) => ({ id, type: 'text', x: 40, y: 40, width: 300, height: 60, zIndex: 1, content: `<p>${id}</p>`, ...extra })

describe('scrolling slides in pages the server builds', () => {
  before(async () => {
    server = await startServer()
    base = `http://127.0.0.1:${server.address().port}`
  })
  after(() => server?.close())

  it('holds the canvas in a scroller, with pinned elements on the screen', async () => {
    const html = await exported({ slideHeight: 540, slides: [
      { id: 'tall', scrollHeight: 1080, elements: [text('low', { y: 900 }), text('title', { y: 10, scrollBehavior: 'pin' })] },
    ] })
    const section = html.match(/<section id="s-tall"[\s\S]*?<\/section>/)[0]
    assert.match(section, /^<section id="s-tall" data-scroll-height="1080" style="padding:0;width:960px;height:540px;/)
    const canvas = section.match(/<div class="slide-scroll-inner" style="position:relative;width:960px;height:1080px;">([\s\S]*?)\n {8}<\/div>/)[1]
    assert.match(canvas, />\s*<p>low<\/p>/)
    assert.doesNotMatch(canvas, /title/)
    assert.match(section.slice(section.indexOf('slide-scroll-track')), /<p>title<\/p>/)
    assert.ok(html.includes(SCROLLING_CSS))
    assert.ok(html.includes(SCROLLING_SCRIPT))
  })

  it('paints a gradient background on the canvas, so it scrolls with it', async () => {
    const html = await exported({ slides: [{ id: 'tall', scrollHeight: 1080, background: { type: 'gradient', gradient: 'linear-gradient(#111, #333)' }, elements: [] }] })
    const section = html.match(/<section id="s-tall"[^>]*>/)[0]
    assert.ok(!section.includes('data-background-gradient'))
    assert.ok(html.includes('<div class="slide-scroll-inner" style="position:relative;width:960px;height:1080px;background:linear-gradient(#111, #333);">'))
  })

  it('leaves a deck without one as it was', async () => {
    const html = await exported({ slides: [{ id: 'flat', elements: [text('a', { scrollBehavior: 'pin' })] }] })
    for (const marker of ['slide-scroller', 'data-scroll-height', 'Scrolling slides']) assert.ok(!html.includes(marker), marker)
  })
})

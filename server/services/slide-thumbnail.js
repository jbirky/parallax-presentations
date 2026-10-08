// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A deck's first slide as a JPEG, for the landing page's example cards. The
// deck's own page (/examples/<slug>, from this server) is opened in a headless
// Chromium, the first slide is stepped through so all of it shows, as it does
// when the presenter steps back to it, and the screen is taken without the
// deck's buttons. The Docker image has Alpine's chromium-headless-shell;
// PARALLAX_CHROMIUM points elsewhere. One render at a time.

const fs = require('fs')

const CANDIDATES = ['/usr/bin/chromium-headless-shell', '/usr/lib/chromium/chromium-headless-shell', '/usr/bin/chromium-browser', '/usr/bin/chromium']
const WIDTH = 960, HEIGHT = 540

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

// The JPEG of the deck at `url`'s first slide; throws a ThumbnailError
function renderFirstSlide(url) {
  const run = queue.then(() => render(url))
  queue = run.catch(() => {})
  return run
}

async function render(url) {
  const executablePath = chromiumPath()
  if (!executablePath) throw new ThumbnailError('This server has no Chromium to draw thumbnails with')
  const { chromium } = require('playwright-core')
  let browser = null
  try {
    browser = await chromium.launch({
      executablePath,
      // WebGL (3D graphs, molecules, harmonics) in software, as there's no GPU
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    })
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 })
    await page.goto(url, { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction(() => window.Reveal && window.Reveal.isReady(), null, { timeout: 20000 })
    await page.waitForTimeout(1500)
    const at = () => page.evaluate(() => JSON.stringify(window.Reveal.getIndices()))
    for (let i = 0; i < 60; i++) {
      const before = await at()
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(200)
      const now = JSON.parse(await at())
      if (now.h > 0 || now.v > 0) { await page.keyboard.press('ArrowLeft'); break }
      if (JSON.stringify(now) === before) break
    }
    await page.addStyleTag({ content: '#fs-btn, #overview-toggle, #overview-panel, .reveal .controls, .reveal .progress { display: none !important; }' })
    await page.waitForTimeout(2500)
    return await page.screenshot({ type: 'jpeg', quality: 82 })
  } catch (err) {
    throw err instanceof ThumbnailError ? err : new ThumbnailError(`The first slide couldn’t be drawn: ${err.message.split('\n')[0]}`)
  } finally {
    await browser?.close()
  }
}

module.exports = { renderFirstSlide, chromiumPath, ThumbnailError }

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The slides of a landing page template, drawn small for its own page
// (/templates/<slug>, services/site-pages.js). Each version of a template's
// deck is drawn once, by the server's Chromium (slide-thumbnail.js), and
// kept on disk in `dir` (in the server's data folder), so a restart doesn't
// draw them again. The first page to ask for them starts the drawing;
// pages ask again until they're there. Drawing that fails is tried again
// after a while, and a server without Chromium has none to show.

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { renderAllSlides, chromiumPath, ThumbnailError } = require('./slide-thumbnail')

const RETRY_MS = 10 * 60 * 1000
// A version's folder: the template's slug and a hash of the deck's version
const KEY = /^([a-z0-9-]{1,64})-([0-9a-f]{12})$/

function createTemplateSlides({ dir, render = renderAllSlides, hasBrowser = () => !!chromiumPath() }) {
  const drawing = new Map()
  const failed = new Map()

  const keyOf = (slug, version) => `${slug}-${crypto.createHash('sha256').update(String(version)).digest('hex').slice(0, 12)}`
  const folder = key => path.join(dir, key)

  function drawnCount(key) {
    try {
      const { count } = JSON.parse(fs.readFileSync(path.join(folder(key), 'slides.json'), 'utf8'))
      return Number.isInteger(count) ? count : null
    } catch {
      return null
    }
  }

  async function draw(slug, key, url) {
    try {
      const shots = await render(url)
      const tmp = `${folder(key)}.tmp`
      fs.rmSync(tmp, { recursive: true, force: true })
      fs.mkdirSync(tmp, { recursive: true })
      shots.forEach((jpeg, i) => fs.writeFileSync(path.join(tmp, `${i + 1}.jpg`), jpeg))
      fs.writeFileSync(path.join(tmp, 'slides.json'), JSON.stringify({ count: shots.length }))
      fs.rmSync(folder(key), { recursive: true, force: true })
      fs.renameSync(tmp, folder(key))
      // This template's older versions go
      for (const name of fs.readdirSync(dir)) {
        const m = KEY.exec(name)
        if (m && m[1] === slug && name !== key) fs.rmSync(folder(name), { recursive: true, force: true })
      }
      failed.delete(key)
    } catch (err) {
      if (!(err instanceof ThumbnailError)) console.error('Template slides error:', err.message)
      failed.set(key, Date.now())
    }
  }

  // Whether a template's slides are drawn: { ready, count, key } once they
  // are, or { ready: false, drawing } while they're being drawn or can't be.
  // `url` is the deck's page, for the browser to open.
  function status(slug, version, url) {
    const key = keyOf(slug, version)
    const count = drawnCount(key)
    if (count !== null) return { ready: true, count, key }
    if (drawing.has(key)) return { ready: false, drawing: true }
    if (!hasBrowser() || Date.now() - (failed.get(key) || 0) < RETRY_MS) return { ready: false, drawing: false }
    fs.mkdirSync(dir, { recursive: true })
    drawing.set(key, draw(slug, key, url).finally(() => drawing.delete(key)))
    return { ready: false, drawing: true }
  }

  // Slide n's JPEG (from 1) in the version `key` names, or null
  function image(slug, key, n) {
    const m = KEY.exec(String(key))
    if (!m || m[1] !== slug || !Number.isInteger(n) || n < 1) return null
    try {
      return fs.readFileSync(path.join(folder(key), `${n}.jpg`))
    } catch {
      return null
    }
  }

  // For tests: until the drawing under way is done
  const settled = () => Promise.all([...drawing.values()])

  return { status, image, keyOf, settled }
}

module.exports = { createTemplateSlides }

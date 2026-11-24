// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A landing page template's slides, drawn small for its own page
// (services/template-slides.js), with a stand-in for the browser. Needs no
// server.

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createTemplateSlides } = require('../services/template-slides')
const { ThumbnailError } = require('../services/slide-thumbnail')

let dir
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-slides-')) })
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('a template’s slides, drawn small', () => {
  it('draws each version once, when first asked, and keeps it on disk', async () => {
    const urls = []
    const render = async url => { urls.push(url); return [Buffer.from('one'), Buffer.from('two')] }
    const slides = createTemplateSlides({ dir, render, hasBrowser: () => true })
    assert.deepEqual(slides.status('lecture', 'v1', 'http://x/deck'), { ready: false, drawing: true })
    assert.deepEqual(slides.status('lecture', 'v1', 'http://x/deck'), { ready: false, drawing: true })
    await slides.settled()
    const done = slides.status('lecture', 'v1', 'http://x/deck')
    assert.deepEqual([done.ready, done.count], [true, 2])
    assert.deepEqual(urls, ['http://x/deck'])
    assert.equal(slides.image('lecture', done.key, 2).toString(), 'two')
    assert.equal(slides.image('lecture', done.key, 3), null)
    // Another server process finds them on disk
    const again = createTemplateSlides({ dir, render: async () => assert.fail('drawn again'), hasBrowser: () => true })
    assert.equal(again.status('lecture', 'v1', 'http://x/deck').ready, true)
  })

  it('draws a new version, and lets the old one go, but not another template’s', async () => {
    let n = 0
    const slides = createTemplateSlides({ dir, render: async () => [Buffer.from(`v${++n}`)], hasBrowser: () => true })
    slides.status('lecture', 'v1', 'u'); slides.status('lecture-2', 'v1', 'u')
    await slides.settled()
    const old = slides.keyOf('lecture', 'v1')
    slides.status('lecture', 'v2', 'u')
    await slides.settled()
    assert.equal(fs.existsSync(path.join(dir, old)), false)
    assert.equal(fs.existsSync(path.join(dir, slides.keyOf('lecture-2', 'v1'))), true)
    assert.equal(slides.status('lecture', 'v2', 'u').ready, true)
  })

  it('waits before trying again after it fails, and draws nothing without a browser', async () => {
    let tries = 0
    const failing = createTemplateSlides({ dir, render: async () => { tries++; throw new ThumbnailError('no') }, hasBrowser: () => true })
    failing.status('lecture', 'v1', 'u')
    await failing.settled()
    assert.deepEqual(failing.status('lecture', 'v1', 'u'), { ready: false, drawing: false })
    assert.equal(tries, 1)
    const none = createTemplateSlides({ dir, render: async () => assert.fail('drawn'), hasBrowser: () => false })
    assert.deepEqual(none.status('seminar', 'v1', 'u'), { ready: false, drawing: false })
  })

  it('serves only a template’s own pictures', async () => {
    const slides = createTemplateSlides({ dir, render: async () => [Buffer.from('a')], hasBrowser: () => true })
    slides.status('lecture', 'v1', 'u')
    await slides.settled()
    const key = slides.keyOf('lecture', 'v1')
    assert.equal(slides.image('seminar', key, 1), null)
    assert.equal(slides.image('lecture', '../lecture', 1), null)
    assert.equal(slides.image('lecture', key, 0), null)
    assert.equal(slides.image('lecture', key, 1).toString(), 'a')
  })
})

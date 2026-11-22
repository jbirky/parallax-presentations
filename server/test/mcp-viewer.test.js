// The deck viewer's parts that need no server (server/mcp/viewer.js):
// preview tokens, the deck's version and the editor's address

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const viewer = require('../mcp/viewer')

const LINK = '0b9d7c1e-3f2a-4c5b-8d6e-7f8091a2b3c4'

describe('the deck viewer', () => {
  it('signs preview links for a while, and refuses them after, or changed', () => {
    let time = 1_000_000
    const tokens = viewer.previewTokens({ now: () => time, ttlMs: 60_000 })
    const token = tokens.make(LINK)
    assert.equal(tokens.check(token), LINK)
    assert.equal(viewer.previewTokens({ now: () => time }).check(token), null, 'another key')
    const [id, exp, sig] = token.split('.')
    assert.equal(tokens.check(`${id}.${(parseInt(exp, 36) + 600).toString(36)}.${sig}`), null, 'a later expiry')
    assert.equal(tokens.check(`${LINK.replace('0b', '1b')}.${exp}.${sig}`), null, 'another link')
    for (const bad of [undefined, 42, '', 'a.b.c', `${token}x`]) assert.equal(tokens.check(bad), null)
    time += 59_000
    assert.equal(tokens.check(token), LINK)
    time += 2_000
    assert.equal(tokens.check(token), null, 'expired')
  })

  it('versions a deck by what is in it, not when it was saved', () => {
    const deck = { title: 'A', slides: [{ id: 's1', elements: [] }], version: 3, updatedAt: '2026-11-21' }
    const v = viewer.deckVersion(deck)
    assert.equal(viewer.deckVersion({ ...deck, version: 4, updatedAt: '2026-11-22' }), v)
    assert.notEqual(viewer.deckVersion({ ...deck, title: 'B' }), v)
  })

  it('opens the editor where the app does, at the deck’s title', () => {
    assert.equal(viewer.editorUrl('https://x.test', { title: 'Dark matter: in ten minutes!' }), 'https://x.test/dashboard/dark-matter-in-ten-minutes')
    assert.equal(viewer.editorUrl('https://x.test', { title: '' }), 'https://x.test/dashboard/untitled')
  })

  it('has a page that loads nothing from elsewhere', () => {
    const html = viewer.viewerHtml()
    assert.match(html, /protocolVersion: PROTOCOL/)
    assert.match(html, /const PROTOCOL = '2026-01-26'/)
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|@import/)
    const x = ['https://x.test']
    assert.deepEqual(viewer.viewerMeta('https://x.test'), { ui: { csp: { frameDomains: x, resourceDomains: x, connectDomains: x }, prefersBorder: false } })
  })
})

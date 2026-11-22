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
    const meta = viewer.viewerMeta('https://x.test')
    assert.deepEqual(meta.ui.csp.frameDomains, ['https://x.test'])
    assert.equal(meta.ui.csp.resourceDomains[0], 'https://x.test')
    assert.ok(meta.ui.csp.resourceDomains.includes('https://fonts.gstatic.com'))
    assert.ok(meta.ui.csp.connectDomains.includes('https://tikzjax.com'))
    assert.equal(meta.ui.prefersBorder, false)
  })

  it('makes the deck page’s links to the site whole, for drawing it elsewhere', () => {
    const site = 'https://x.test'
    const page = [
      '<script src="/vendor/reveal.js@5.1.0/dist/reveal.js"></script>',
      "<link href='/vendor/katex@0.16.40/dist/katex.min.css' rel=stylesheet>",
      '<img src="/uploads/a.png" srcset="/uploads/a.png 1x, /uploads/b.png 2x">',
      '<div style="background: url(/uploads/bg.jpg)"></div><i style="background:url(\'/examples/e.png\')"></i>',
      '<script>var deck = {"html":"<img src=\\"/uploads/c.png\\">"}</script>',
      '<iframe srcdoc="<img src=&quot;/uploads/d.png&quot;>"></iframe>',
      '@font-face { src: url("/api/fonts/file/f.woff2") }',
      '<a href="#/2">2</a> <a href="//cdn.test/x.js">x</a> <a href="https://x.test/uploads/e.png">e</a> <a href="/dashboard">d</a>',
    ].join('\n')
    const out = viewer.forInline(page, site)
    for (const f of ['vendor/reveal.js@5.1.0/dist/reveal.js', 'vendor/katex@0.16.40/dist/katex.min.css', 'uploads/a.png 1x', 'uploads/b.png 2x', 'uploads/bg.jpg', 'examples/e.png', 'uploads/c.png', 'uploads/d.png', 'api/fonts/file/f.woff2']) {
      assert.ok(out.includes(`${site}/${f}`), f)
    }
    assert.ok(out.includes('href="#/2"') && out.includes('href="//cdn.test/x.js"') && out.includes('href="/dashboard"'), 'leaves other links')
    assert.ok(out.includes('href="https://x.test/uploads/e.png"') && !out.includes('x.testhttps'), 'leaves whole links')
  })
})

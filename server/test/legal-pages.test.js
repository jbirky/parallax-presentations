// The hosted site's legal pages (services/legal-pages.js): the privacy policy
// at /privacy, from server/content/privacy.md, in the site pages' shell, and
// linked from their footer. Needs no server: the route is a line in
// index.js, and self-hosted.test.js checks a self-hosted copy has no policy.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

process.env.PARALLAX_MODE = 'cloud'
const { legalPage } = require('../services/legal-pages')
const { sitePage } = require('../services/site-pages')

const origin = 'https://parallax-presentations.com'

describe('the privacy policy page', () => {
  it('draws the policy from its Markdown, with its head tags, and links its address', async () => {
    const page = await legalPage('privacy', { origin, analytics: null, index: true })
    assert.match(page, /<title>Privacy policy · Parallax<\/title>/)
    assert.match(page, /<link rel="canonical" href="https:\/\/parallax-presentations\.com\/privacy" \/>/)
    assert.match(page, /<article class="legal"><h1>Privacy policy<\/h1>/)
    for (const heading of ['What we collect', 'How we use it', 'AI apps and agents', 'Who else handles your data', 'Cookies', 'Your choices and rights', 'Contact']) {
      assert.match(page, new RegExp(`<h2>${heading}</h2>`), heading)
    }
    assert.match(page, /<table>[\s\S]*<td>Clerk<\/td>[\s\S]*<\/table>/)
    assert.match(page, /<a href="mailto:support@parallax-presentations\.com">support@parallax-presentations\.com<\/a>/)
    assert.equal(await legalPage('terms', { origin }), null)
  })

  it('is linked from the footer of the hosted site’s own pages', () => {
    assert.match(sitePage({ meta: '', main: '' }), /<a href="\/privacy">Privacy<\/a>/)
  })
})

// What link previews and search engines are given: head tags, the app's page,
// robots.txt, sitemap.xml and the examples' pages. Needs no server.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { pageMeta, appHtml, robotsTxt, sitemapXml, examplePage } = require('../services/site-pages')

const origin = 'https://parallax-presentations.com'
const example = { slug: 'venn', field: 'Mathematics', title: 'Venn diagrams', desc: 'De Morgan’s law, shaded.', tags: ['Venn diagram'], thumbnail: '/examples/thumbs/venn.jpg', background: null }

describe('what link previews and search engines see', () => {
  it('gives a page its title, description, preview image and address, escaped', () => {
    const meta = pageMeta({ origin, path: '/x', title: 'A "quoted" <b>title</b>', description: 'd & e', index: true })
    assert.match(meta, /<title>A &quot;quoted&quot; &lt;b&gt;title&lt;\/b&gt;<\/title>/)
    assert.match(meta, /<meta name="description" content="d &amp; e" \/>/)
    assert.match(meta, /<link rel="canonical" href="https:\/\/parallax-presentations\.com\/x" \/>/)
    assert.match(meta, /<meta property="og:image" content="https:\/\/parallax-presentations\.com\/social\/parallax\.jpg" \/>/)
    assert.match(meta, /<meta property="og:image:width" content="1200" \/>/)
    assert.match(meta, /<meta name="twitter:card" content="summary_large_image" \/>/)
    assert.match(meta, /<meta name="robots" content="index, follow" \/>/)
    assert.match(pageMeta({ origin, path: '/', title: 't', description: 'd' }), /content="noindex"/)
  })

  it('puts the landing page’s tags into the app’s page, and keeps the rest of the app out of search', () => {
    const template = '<head>\n    <!-- meta -->\n    <title>Parallax</title>\n    <!-- /meta -->\n</head>'
    const landing = appHtml(template, { origin, path: '/', index: true })
    assert.match(landing, /<title>Parallax · Interactive slides for complex concepts<\/title>/)
    assert.match(landing, /content="index, follow"/)
    assert.equal((landing.match(/<title>/g) || []).length, 1)
    const dashboard = appHtml(template, { origin, path: '/dashboard', index: true })
    assert.match(dashboard, /<title>Parallax<\/title>/)
    assert.match(dashboard, /content="noindex"/)
    assert.match(dashboard, /<link rel="canonical" href="https:\/\/parallax-presentations\.com\/dashboard" \/>/)
  })

  it('lets search engines into the landing page and examples only, on an indexed site', () => {
    const robots = robotsTxt({ origin, index: true })
    assert.match(robots, /^User-agent: \*\nAllow: \//)
    for (const p of ['/api/', '/dashboard', '/admin', '/try', '/share/']) assert.match(robots, new RegExp(`Disallow: ${p}\\n`))
    assert.match(robots, /Sitemap: https:\/\/parallax-presentations\.com\/sitemap\.xml/)
    assert.equal(robotsTxt({ origin, index: false }), 'User-agent: *\nDisallow: /\n')
    const sitemap = sitemapXml({ origin, examples: [example] })
    assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]), [`${origin}/`, `${origin}/examples/venn`])
  })

  it('makes an example a page of its own, around its deck', () => {
    const html = examplePage({ origin, example, others: [{ ...example, slug: 'logic', title: 'Digital logic', thumbnail: null }], guestEnabled: true, analytics: { websiteId: 'w-1' }, index: true })
    assert.match(html, /<title>Venn diagrams · Parallax examples<\/title>/)
    assert.match(html, /<meta property="og:image" content="https:\/\/parallax-presentations\.com\/examples\/thumbs\/venn\.jpg" \/>/)
    assert.match(html, /<meta property="og:image:width" content="960" \/>/)
    assert.match(html, /<iframe src="\/examples\/venn\/deck"/)
    assert.match(html, /<a class="btn primary" href="\/try\?example=venn" data-umami-event="example-to-editor"/)
    assert.match(html, /<script defer src="\/stats\/script\.js" data-website-id="w-1" data-do-not-track="true"><\/script>/)
    // Another example without a thumbnail shows its title
    assert.match(html, /<a class="card" href="\/examples\/logic">[\s\S]*?<b>Digital logic<\/b>/)
    const signedIn = examplePage({ origin, example, others: [], guestEnabled: false, analytics: null, index: false })
    assert.match(signedIn, /Make your own with Parallax/)
    assert.doesNotMatch(signedIn, /stats\/script\.js|More examples/)
  })

  it('escapes what an admin typed', () => {
    const html = examplePage({ origin, example: { ...example, title: '</title><script>alert(1)</script>', desc: '"><img onerror=x>', tags: ['<b>'] }, others: [], guestEnabled: true, analytics: null, index: true })
    assert.doesNotMatch(html, /<script>alert|<img onerror|<b>/)
    assert.match(html, /&lt;\/title&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  })
})

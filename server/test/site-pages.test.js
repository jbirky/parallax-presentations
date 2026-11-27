// What link previews and search engines are given: head tags, the app's page,
// robots.txt, sitemap.xml and the examples' and templates' pages. Needs no
// server.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { pageMeta, appHtml, robotsTxt, sitemapXml, examplePage, templatePage } = require('../services/site-pages')

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
    for (const p of ['/api/', '/dashboard', '/admin', '/try', '/share/', '/teams/']) assert.match(robots, new RegExp(`Disallow: ${p}\\n`))
    assert.match(robots, /Sitemap: https:\/\/parallax-presentations\.com\/sitemap\.xml/)
    assert.equal(robotsTxt({ origin, index: false }), 'User-agent: *\nDisallow: /\n')
    const sitemap = sitemapXml({ origin, examples: [example], templates: [{ slug: 'lecture' }] })
    assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]), [`${origin}/`, `${origin}/examples/venn`, `${origin}/templates/lecture`])
  })

  it('makes an example a page of its own, around its deck', () => {
    const html = examplePage({ origin, example, others: [{ ...example, slug: 'logic', title: 'Digital logic', thumbnail: null }], guestEnabled: true, analytics: { websiteId: 'w-1' }, index: true })
    assert.match(html, /<title>Venn diagrams · Parallax examples<\/title>/)
    assert.match(html, /<meta property="og:image" content="https:\/\/parallax-presentations\.com\/examples\/thumbs\/venn\.jpg" \/>/)
    assert.match(html, /<meta property="og:image:width" content="960" \/>/)
    assert.match(html, /<iframe src="\/examples\/venn\/deck"/)
    // The deck page is sandboxed (an opaque origin): only "*" lets its Fullscreen button work
    assert.match(html, /<iframe src="\/examples\/venn\/deck"[^>]* allow="fullscreen \*"/)
    assert.match(html, /<a class="btn primary" href="\/try\?example=venn" data-umami-event="example-to-editor"/)
    assert.match(html, /<script defer src="\/stats\/script\.js" data-website-id="w-1" data-do-not-track="true"><\/script>/)
    // Another example without a thumbnail shows its title
    assert.match(html, /<a class="card" href="\/examples\/logic">[\s\S]*?<b>Digital logic<\/b>/)
    const signedIn = examplePage({ origin, example, others: [], guestEnabled: false, analytics: null, index: false })
    assert.match(signedIn, /Make your own with Parallax/)
    assert.doesNotMatch(signedIn, /stats\/script\.js|More examples/)
  })

  it('makes a template a page of its own: its deck, its slides to jump to, its theme, and a way to copy it', () => {
    const template = { slug: 'lecture', field: 'Teaching', title: 'Physics lecture', desc: 'Forces, slide by slide.', tags: ['Graph'], thumbnail: '/examples/thumbs/lecture.jpg', background: null }
    const facts = {
      theme: { id: 'bauhaus', label: 'Bauhaus', note: 'Lowercase headings', ownColors: true, stylesheet: 'h2 { color: red }' },
      colors: [{ name: 'Background', value: '#f7f6f2' }, { name: 'Accent', value: 'url(x)' }],
      fonts: { text: 'Jost', heading: 'Jost' },
      sizes: [{ name: 'Body text', px: 26 }],
      slides: [{ title: 'Forces', layout: 'Title Slide', kinds: [], background: '#f7f6f2', text: '#151515' }, { title: 'Second law', layout: '', kinds: ['2 graphs'], background: 'red;x:y', text: '#151515' }],
      contents: ['2 graphs', '3 text boxes'],
    }
    const html = templatePage({ origin, template, facts, others: [{ ...template, slug: 'seminar', title: 'Seminar', thumbnail: null, theme: 'Turin' }], guestEnabled: true, analytics: null, index: true })
    assert.match(html, /<title>Physics lecture · Parallax templates<\/title>/)
    assert.match(html, /<link rel="canonical" href="https:\/\/parallax-presentations\.com\/templates\/lecture" \/>/)
    assert.match(html, /<meta property="og:image" content="https:\/\/parallax-presentations\.com\/examples\/thumbs\/lecture\.jpg" \/>/)
    assert.match(html, /<iframe id="deck" src="\/examples\/lecture\/deck"/)
    assert.match(html, /<iframe id="deck" src="\/examples\/lecture\/deck"[^>]* allow="fullscreen \*"/)
    assert.match(html, /<a class="btn primary" href="\/templates\/lecture\/use" data-umami-event="template-to-account"/)
    assert.match(html, /href="\/try\?example=lecture"/)
    // Every slide, to jump to, on its own color until it's drawn
    assert.equal((html.match(/class="tp-thumb"/g) || []).length, 2)
    assert.match(html, /data-go="1" aria-label="Slide 2: Second law"/)
    assert.match(html, /<p>2 graphs<\/p>/)
    assert.match(html, /fetch\('\/templates\/lecture\/slides\.json'/)
    // The theme, its colors and its stylesheet; a color that isn't one isn't written
    assert.match(html, /<strong>Bauhaus<\/strong>, with colors of its own and a stylesheet of its own/)
    assert.match(html, /<pre>h2 \{ color: red \}<\/pre>/)
    assert.doesNotMatch(html, /background:url\(x\)|red;x:y/)
    assert.match(html, /<a class="card" href="\/templates\/seminar">[\s\S]*?<b>Seminar<\/b><i class="theme-pill">Turin<span class="sr"> theme<\/span><\/i>/)
    // A theme of the deck's own goes by its name, on the theme it starts from
    const own = templatePage({ origin, template, facts: { ...facts, theme: { ...facts.theme, label: '<DNA>', base: 'White', named: true } }, others: [], guestEnabled: false, analytics: null, index: false })
    assert.match(own, /<strong>&lt;DNA&gt;<\/strong>, a theme of the deck’s own, on White/)
    const noGuest = templatePage({ origin, template, facts: { ...facts, contents: [] }, others: [], guestEnabled: false, analytics: null, index: false })
    assert.doesNotMatch(noGuest, /\/try\?example|More templates|What’s in it/)
  })

  it('heads the hosted site’s example and template pages with the landing page’s tabs', () => {
    const tabsOf = html => {
      const nav = html.match(/<nav aria-label="Main">([\s\S]*?)<\/nav>/)[1]
      return { nav, tabs: [...nav.matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map(m => m[1]) }
    }
    const landing = ['Features', 'Examples', 'Templates', 'Plugins', 'How it works', 'AI agents', 'Docs', 'GitHub', 'Sign in']
    const ex = tabsOf(examplePage({ origin, example, others: [], guestEnabled: true, analytics: null, index: false, cloud: true }))
    assert.deepEqual(ex.tabs, landing)
    assert.match(ex.nav, /<a class="mid" href="\/#examples" aria-current="true">Examples<\/a>/)
    assert.match(ex.nav, /<a class="btn" href="\/sign-in">Sign in<\/a>/)
    const template = { slug: 'lecture', field: 'Teaching', title: 'Physics lecture', desc: '', tags: [], thumbnail: null, background: null }
    const facts = { theme: { label: 'Bauhaus' }, colors: [], fonts: { text: 'Jost', heading: 'Jost' }, sizes: [], slides: [{ title: 'Forces', layout: '', kinds: [] }], contents: [] }
    const tp = tabsOf(templatePage({ origin, template, facts, others: [], guestEnabled: true, analytics: null, index: false }))
    assert.deepEqual(tp.tabs, landing)
    assert.match(tp.nav, /<a href="\/#templates" aria-current="true">Templates<\/a>/)
    // A self-hosted server has no landing page or sign-in: a few links and one home
    const own = tabsOf(examplePage({ origin, example, others: [], guestEnabled: true, analytics: null, index: false }))
    assert.deepEqual(own.tabs, ['All examples', 'Plugins', 'Docs', 'Parallax home'])
  })

  it('is dark unless light was chosen, with a toggle that remembers', () => {
    const html = examplePage({ origin, example, others: [], guestEnabled: false, analytics: null, index: false })
    // The choice is read before the page draws, in the head
    const head = html.slice(0, html.indexOf('</head>'))
    assert.match(head, /localStorage\.getItem\('parallax-theme'\)/)
    assert.match(head, /:root\[data-theme="light"\] \{ color-scheme: light;/)
    assert.match(html, /<button type="button" class="theme" id="theme-toggle" aria-label="Switch to light theme"/)
    assert.match(html, /localStorage\.setItem\('parallax-theme', theme\)/)
    // The toggle sits in the header, before the link home
    assert.ok(html.indexOf('id="theme-toggle"') < html.indexOf('>Parallax home</a>'))
  })

  it('escapes what an admin typed', () => {
    const html = examplePage({ origin, example: { ...example, title: '</title><script>alert(1)</script>', desc: '"><img onerror=x>', tags: ['<b>'] }, others: [], guestEnabled: true, analytics: null, index: true })
    assert.doesNotMatch(html, /<script>alert|<img onerror|<b>/)
    assert.match(html, /&lt;\/title&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
    const facts = { theme: { label: '<i>', note: '', stylesheet: '</pre><script>x</script>' }, colors: [], fonts: { text: '<b>', heading: '' }, sizes: [], contents: ['<u>'],
      slides: [{ title: '</button><script>y</script>', layout: '', kinds: [], background: '#000', text: '#fff' }] }
    const page = templatePage({ origin, template: { ...example, title: '<s>', desc: '<q>' }, facts, others: [], guestEnabled: false, analytics: null, index: true })
    assert.doesNotMatch(page, /<script>x|<script>y|<i>|<b>|<u>|<s>|<q>/)
    // The slides' names in the page's script can't end it
    assert.doesNotMatch(page.slice(page.indexOf('var names')), /<\/button>/)
  })
})

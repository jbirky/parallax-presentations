// The public plugin gallery's pages (services/plugin-pages.js): the gallery,
// a plugin's own page, and its README, which anyone could have written.
// Needs no server.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { galleryPage, pluginPage, renderReadme, iconUrl } = require('../services/plugin-pages')
const { sitemapXml } = require('../services/site-pages')

const origin = 'https://parallax-presentations.com'
const lorenz = {
  slug: 'someone--lorenz', pluginId: 'io.github.someone.lorenz', name: 'Lorenz attractor', version: '1.1.0',
  description: 'A strange attractor you can turn', installs: 12, repoOwner: 'someone', repoName: 'lorenz',
  updatedAt: '2026-10-07T12:00:00Z', listedAt: '2026-10-01T12:00:00Z',
  manifest: {
    license: 'MIT', icon: 'icon.svg', categories: ['physics', 'math'], keywords: ['chaos'], permissions: ['network:cdn.jsdelivr.net'],
    contributes: { elementTypes: [{ type: 'lorenz', label: 'Lorenz attractor', defaultSize: { width: 500, height: 400 } }] },
  },
}
const ising = { ...lorenz, slug: 'else--ising', pluginId: 'io.github.else.ising', name: 'Ising model', installs: 1, repoOwner: 'else', repoName: 'ising', manifest: { license: 'MIT', categories: ['physics'], contributes: { elementTypes: [{ type: 'ising', label: 'Ising' }] } } }
const commit = 'a'.repeat(40)

describe('a plugin’s README', () => {
  const render = md => renderReadme(md, { owner: 'someone', repo: 'lorenz', commit })

  it('shows raw HTML as text', async () => {
    const html = await render('Hi\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)> and <b>bold</b>')
    assert.doesNotMatch(html, /<script|<img src=x|<b>/)
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  })

  it('keeps web, mail and in-page links, points paths into the repo, and drops the rest', async () => {
    const html = await render('[a](https://example.com) [b](mailto:x@y.z) [c](#use) [d](docs/guide.md) [e](javascript:alert(1)) [f](data:text/html,x) [g](//evil.example)')
    assert.match(html, /<a href="https:\/\/example\.com" rel="nofollow noopener" target="_blank">a<\/a>/)
    assert.match(html, /href="mailto:x@y\.z"/)
    assert.match(html, /<a href="#use">c<\/a>/)
    assert.match(html, new RegExp(`href="https://github\\.com/someone/lorenz/blob/${commit}/docs/guide\\.md"`))
    assert.doesNotMatch(html, /javascript:|data:text|evil\.example/)
    // What they linked stays, as text
    assert.match(html, /<\/a> e f g<\/p>/)
  })

  it('takes images from GitHub only, paths from the repo at the commit', async () => {
    const html = await render('![shot](docs/shot.png) ![badge](https://img.shields.io/x.svg) ![hosted](https://user-images.githubusercontent.com/1/a.png) ![js](javascript:x)')
    assert.match(html, new RegExp(`<img src="https://raw\\.githubusercontent\\.com/someone/lorenz/${commit}/docs/shot\\.png" alt="shot"`))
    assert.match(html, /<span class="noimg">\[badge\]<\/span>/)
    assert.match(html, /<img src="https:\/\/user-images\.githubusercontent\.com\/1\/a\.png"/)
    assert.doesNotMatch(html, /javascript:|img\.shields/)
  })

  it('leaves out a first heading, since the page has the plugin’s name', async () => {
    const html = await render('# Lorenz attractor\n\nA strange attractor.\n\n## Use\n\nInsert it.')
    assert.doesNotMatch(html, /<h1>/)
    assert.match(html, /<p>A strange attractor\.<\/p>\n<h2>Use<\/h2>/)
  })
})

describe('the gallery', () => {
  it('lists each plugin with what search, the categories and sorting read', () => {
    const html = galleryPage({ origin, plugins: [lorenz, ising], analytics: null, index: true })
    assert.match(html, /<title>Plugins · Parallax<\/title>/)
    assert.match(html, /<meta name="robots" content="index, follow" \/>/)
    assert.match(html, /<a class="pcard" href="\/plugins\/someone--lorenz" data-search="[^"]*chaos[^"]*" data-cats="physics,math" data-installs="12" data-new="2026-10-01T12:00:00\.000Z"/)
    assert.match(html, /<img src="\/api\/plugin-files\/io\.github\.someone\.lorenz\/1\.1\.0\/icon\.svg"/)
    // A plugin with no icon gets its initial
    assert.match(html, /<span class="picon blank"[^>]*>I<\/span>/)
    assert.match(html, /<button type="button" data-cat="physics" aria-pressed="false">Physics<\/button>/)
    assert.match(html, /12 installs[\s\S]*1 install</)
    assert.match(html, /Publish your own/)
  })

  it('says when nothing is listed, and escapes what authors wrote', () => {
    assert.match(galleryPage({ origin, plugins: [], analytics: null, index: false }), /No plugins are listed yet/)
    const html = galleryPage({ origin, plugins: [{ ...lorenz, name: '<script>x()</script>', description: '"><img onerror=y>' }], analytics: null, index: true })
    assert.doesNotMatch(html, /<script>x\(\)|<img onerror/)
  })
})

describe('a plugin’s page', () => {
  const plugin = { ...lorenz, readme: '# Lorenz\n\nIt **turns**.', versions: [
    { version: '1.1.0', tag: 'v1.1.0', commitSha: commit, approvedAt: '2026-10-07T12:00:00Z' },
    { version: '1.0.0', tag: 'v1.0.0', commitSha: 'b'.repeat(40), approvedAt: '2026-10-01T12:00:00Z' },
  ] }

  it('shows it live, with its README, facts, versions and a way to install it', async () => {
    const html = await pluginPage({ origin, plugin, analytics: { websiteId: 'w' }, index: true })
    assert.match(html, /<title>Lorenz attractor · Parallax plugins<\/title>/)
    assert.match(html, /<iframe src="\/plugins\/someone--lorenz\/preview" sandbox="allow-scripts" title="Lorenz attractor, live" style="width: 500px; height: 400px">/)
    assert.match(html, /aspect-ratio: 500 \/ 400/)
    assert.match(html, /box\.clientWidth \/ 500/)
    assert.match(html, /<a class="btn primary" href="\/plugins\/someone--lorenz\/install"/)
    assert.match(html, /<p>It <strong>turns<\/strong>\.<\/p>/)
    assert.match(html, /<dt>Reaches<\/dt><dd>cdn\.jsdelivr\.net<\/dd>/)
    assert.match(html, /<dt>Installs<\/dt><dd>12<\/dd>/)
    assert.match(html, new RegExp(`<a href="https://github\\.com/someone/lorenz/tree/${commit}"[^>]*>v1\\.1\\.0</a> <span class="when">Oct 7, 2026</span>`))
    assert.match(html, /data-website-id="w"/)
  })

  it('says when a plugin reaches no other site, or has no README', async () => {
    const html = await pluginPage({ origin, plugin: { ...plugin, readme: null, manifest: { ...plugin.manifest, permissions: [] } }, analytics: null, index: false })
    assert.match(html, /<dd>No other sites<\/dd>/)
    assert.match(html, /This plugin has no README/)
  })

  it('gives icons by version', () => {
    assert.equal(iconUrl(lorenz), '/api/plugin-files/io.github.someone.lorenz/1.1.0/icon.svg')
    assert.equal(iconUrl(ising), null)
  })
})

describe('the sitemap', () => {
  it('lists the gallery and each plugin, when there are some', () => {
    const urls = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
    assert.deepEqual(urls(sitemapXml({ origin, examples: [], plugins: ['someone--lorenz'] })), [`${origin}/`, `${origin}/plugins`, `${origin}/plugins/someone--lorenz`])
    assert.deepEqual(urls(sitemapXml({ origin, examples: [] })), [`${origin}/`])
  })
})

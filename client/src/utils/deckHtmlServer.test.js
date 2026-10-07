import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'

// The server's copy of generateRevealHTML (server/services/deck-html.js) runs
// where there's no window, as it does in the server
import { generateRevealHTML } from './generateHTML'

const require = createRequire(import.meta.url)
const { bundle, TARGET } = require('../../../scripts/build-deck-html.js')
const server = require('../../../server/services/deck-html.js')

const deck = (elements, extra = {}) => ({
  title: 'Talk', slideWidth: 960, slideHeight: 540,
  slides: [{ id: 's1', notes: 'Say hello', autoAnimate: true, elements }],
  ...extra,
})
const at = { x: 10, y: 10, width: 200, height: 100, zIndex: 1 }

describe('the pages the server builds', () => {
  it('come from this generator: run `node scripts/build-deck-html.js` after changing it or its imports', async () => {
    expect(readFileSync(TARGET, 'utf8')).toBe(await bundle())
  })

  it('are the pages the editor presents, apart from the library links', () => {
    const presentation = deck([
      { id: 'a', type: 'text', ...at, content: '<p>Hi</p>', animationEnter: 'fadeUp' },
      { id: 'b', type: 'p5', ...at, content: 'function setup(){createCanvas(10,10)}' },
      { id: 'c', type: 'textpath', ...at, content: 'Curved' },
      { id: 'd', type: 'drawing', ...at, paths: [{ points: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 9, y: 2 }], color: '#f00' }] },
      { id: 'e', type: 'text3d', ...at, content: 'Deep', depth: 3 },
    ])
    const html = server.generateRevealHTML(presentation)
    const unversioned = s => s.replace(/cdn\.jsdelivr\.net\/npm\/([^/@"']+(?:\/[^/@"']+)?)@[^/"']+/g, 'cdn.jsdelivr.net/npm/$1')
    expect(unversioned(html)).toBe(unversioned(generateRevealHTML(presentation)))
    // What the server's own generator never drew
    expect(html).toContain('p5.min.js')
    expect(html).toContain('<textPath href="#tp-c"')
    expect(html).toContain('transform-style:preserve-3d')
    expect(html).toMatch(/<path d="M 0 0 C [^"]+" stroke="#f00"/)
    expect(html).toContain('data-id="a"')
    expect(html).toContain('data-gsap-enter="fadeUp"')
    // Uploads keep this site's relative links (exports rewrite them to ./assets/)
    const img = server.generateRevealHTML(deck([{ id: 'i', type: 'image', ...at, src: './assets/x.png' }]))
    expect(img).toContain('<img src="./assets/x.png"')
  })

  it('leave speaker notes out when asked', () => {
    expect(server.generateRevealHTML(deck([]))).toContain('Say hello')
    expect(server.generateRevealHTML(deck([]), { notes: false })).not.toContain('Say hello')
  })

  it('carry the data the server read: graphs’ rows, and datasets for elements’ pages to ask the deck for', () => {
    const presentation = deck([
      { id: 'g', type: 'graph', ...at, expressions: [{ id: 'd', data: { dataset: 'exoplanets', x: 'p', y: 'm' } }] },
      { id: 'h', type: 'html', ...at, content: '<p id="n"></p><script>parallax.datasets.query("exoplanets")</script>' },
      { id: 'q', type: 'p5', ...at, content: 'function setup(){}' },
      { id: 'p', type: 'plugin:counter', pluginId: 'counter', ...at, pluginData: {} },
    ])
    const deckData = {
      graphs: { g: { d: { x: [1.5, 20], y: [3.25, 400], total: 2, version: 'v' } } },
      datasets: { list: [{ name: 'exoplanets', columns: [{ name: 'p' }], rowCount: 2 }], data: { exoplanets: { columns: { p: [1.5, 20] }, totalRows: 2 } } },
    }
    const pluginSandbox = () => '<html><head></head><body>sandbox</body></html>'
    for (const make of [server.generateRevealHTML, generateRevealHTML]) {
      const html = make(presentation, { deckData, pluginSandbox })
      // The graph's page holds its rows (in its srcdoc, escaped)
      expect(html).toContain('&quot;data&quot;:{&quot;d&quot;:{&quot;x&quot;:[1.5,20],&quot;y&quot;:[3.25,400]')
      expect(html).toContain('<script type="application/json" id="pp-datasets">{"list":[{"name":"exoplanets"')
      expect(html).toContain('parallax-datasets-reply')
      // HTML, p5 and plugin pages get parallax.datasets
      expect(html.match(/window.parallax=window.parallax\|\|Object.freeze\(\{datasets:/g)).toHaveLength(2)
      expect(html).toMatch(/fetch: function\(url, opts\) \{ return window.fetch\(url, opts\); \},\s+datasets: \(function/)
    }
    // A deck with no datasets is as it was
    const without = server.generateRevealHTML(presentation, { deckData: { graphs: {}, datasets: { list: [], data: {} } }, pluginSandbox })
    expect(without).not.toContain('pp-datasets')
    expect(without).not.toContain('datasets:')
    // Nor are a graph's rows there unless given
    expect(server.generateRevealHTML(presentation, { pluginSandbox })).not.toContain('&quot;data&quot;:{&quot;d&quot;')
  })

  it('draw plugin elements from the sandbox page the server finds', () => {
    const plugin = { id: 'p', type: 'plugin:counter', pluginId: 'counter', ...at, pluginData: { n: 1 } }
    const html = server.generateRevealHTML(deck([plugin]), { pluginSandbox: el => `<html><head></head><body>${el.pluginId} sandbox</body></html>` })
    expect(html).toContain('counter sandbox')
    expect(server.generateRevealHTML(deck([plugin]))).toContain('Plugin: counter')
  })
})

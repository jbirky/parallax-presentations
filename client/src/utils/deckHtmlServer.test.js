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
    ])
    const html = server.generateRevealHTML(presentation)
    const unversioned = s => s.replace(/cdn\.jsdelivr\.net\/npm\/([^/@"']+(?:\/[^/@"']+)?)@[^/"']+/g, 'cdn.jsdelivr.net/npm/$1')
    expect(unversioned(html)).toBe(unversioned(generateRevealHTML(presentation)))
    // What the server's own generator never drew
    expect(html).toContain('p5.min.js')
    expect(html).toContain('<textPath href="#tp-c"')
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

  it('draw plugin elements from the sandbox page the server finds', () => {
    const plugin = { id: 'p', type: 'plugin:counter', pluginId: 'counter', ...at, pluginData: { n: 1 } }
    const html = server.generateRevealHTML(deck([plugin]), { pluginSandbox: el => `<html><head></head><body>${el.pluginId} sandbox</body></html>` })
    expect(html).toContain('counter sandbox')
    expect(server.generateRevealHTML(deck([plugin]))).toContain('Plugin: counter')
  })
})

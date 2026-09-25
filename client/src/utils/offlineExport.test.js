import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import vm from 'vm'

if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import { generateOfflineHTML } from './offlineExport'
import { generateRevealHTML } from './generateHTML'
import { inkedPresentation } from './annotations'

// The installed copy of a /vendor/<name>@<version>/<file> URL, as the app serves it
function vendorFile(url) {
  const [, name, file] = url.match(/\/vendor\/((?:@[^/]+\/)?[^/@]+)@[^/]+\/(.+)$/)
  for (const root of ['../../node_modules', '../../../node_modules']) {
    const p = path.resolve(__dirname, root, name, file)
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8')
  }
  return null
}

afterEach(() => vi.unstubAllGlobals())

function serveVendorFiles() {
  const served = new Map()
  vi.stubGlobal('fetch', async url => {
    const text = vendorFile(url)
    if (text !== null) served.set(url, text)
    return { ok: text !== null, text: async () => text }
  })
  return served
}

describe('offline HTML', () => {
  it('inlines the libraries exactly as they are', async () => {
    const served = serveVendorFiles()
    const html = await generateOfflineHTML(generateRevealHTML({ id: 'p1', title: 'T', slides: [{ id: 's1', elements: [] }] }))
    expect(served.size).toBeGreaterThanOrEqual(8)
    // reveal.js, KaTeX and highlight.js contain "$&" and "$'", which a
    // replacement string would expand into the page itself
    const altered = [...served].filter(([, text]) => !html.includes(text)).map(([url]) => url)
    expect(altered).toEqual([])
    expect(html).not.toMatch(/<script[^>]*\ssrc=["']https:\/\/cdn\.jsdelivr\.net\/npm\/(reveal\.js|katex|gsap)@/)
  })

  it('exports a session’s ink as a page whose scripts all run', async () => {
    serveVendorFiles()
    const deck = { id: 'p1', title: 'T', slides: [{ id: 's1', elements: [] }], annotationSets: [] }
    const set = { id: 'a', name: 'Presented', slides: { s1: { paths: [{ points: [[1, 2], [3, 4]], color: '#f00', strokeWidth: 3, opacity: 1 }] } }, boards: [] }
    const html = await generateOfflineHTML(generateRevealHTML(inkedPresentation(deck, set)))
    expect(html).toContain('<path d="M 1 2 L 3 4"')
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
    expect(scripts.length).toBeGreaterThanOrEqual(5)
    const broken = scripts.filter(code => { try { new vm.Script(code); return false } catch { return true } })
    expect(broken.map(code => code.slice(0, 80))).toEqual([])
  })
})

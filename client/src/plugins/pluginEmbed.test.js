import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { Window } from 'happy-dom'

if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import registry from './PluginRegistry'
import { buildStaticPluginSrcdoc } from './pluginEmbed'
import { generateRevealHTML } from '../utils/generateHTML'

const counterSandbox = readFileSync(
  fileURLToPath(new URL('../../../plugins/animated-counter/dist/sandbox.html', import.meta.url)), 'utf8')

const manifest = {
  id: 'test.counter',
  sandbox: './sandbox.html',
  contributes: { elementTypes: [{ type: 'test-counter', label: 'Counter' }] },
}

function presWith(element) {
  return { title: 'Deck', theme: 'black', slideWidth: 960, slideHeight: 540, slides: [{ id: 's1', elements: [element] }] }
}

const counterElement = {
  id: 'e1', type: 'plugin:test-counter', pluginId: 'test.counter',
  x: 10, y: 20, width: 300, height: 200, zIndex: 2,
  pluginData: { value: 42, label: 'Answers', duration: 1 },
}

function srcdocOf(html) {
  const doc = new Window().document
  doc.write(html)
  return doc.querySelector('iframe')?.getAttribute('srcdoc') || null
}

// Runs a srcdoc page with scripts enabled, the way the present-mode iframe does.
// happy-dom doesn't fire DOMContentLoaded for a written document (a browser
// does when the iframe loads), so fire it here.
async function runPage(html) {
  const win = new Window({ settings: { enableJavaScriptEvaluation: true } })
  win.document.write(html)
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'))
  await win.happyDOM.waitUntilComplete()
  return win
}

describe('buildStaticPluginSrcdoc', () => {
  it('puts the bridge at the start of the sandbox head', () => {
    const doc = buildStaticPluginSrcdoc('<html><head><title>x</title></head><body></body></html>', { data: {}, width: 1, height: 1 })
    expect(doc.indexOf('window.parallax')).toBeLessThan(doc.indexOf('<title>'))
  })

  it("keeps a '</script>' in the data from closing the bridge script", () => {
    const doc = buildStaticPluginSrcdoc('<head></head>', { data: { note: '</script><b>hi</b>' }, width: 1, height: 1 })
    expect(doc.match(/<\/script>/g)).toHaveLength(1)
  })

  it('builds the same page as the server copy', () => {
    const server = createRequire(import.meta.url)('../../../server/services/plugin-embed.js')
    const args = [counterSandbox, { data: { value: 7, label: '</script>' }, width: 300, height: 200 }]
    expect(server.buildStaticPluginSrcdoc(...args)).toBe(buildStaticPluginSrcdoc(...args))
  })

  it('gives the sandbox its data and applies updateData in place', async () => {
    const win = await runPage(buildStaticPluginSrcdoc(counterSandbox, { data: { value: 5, label: 'Before', duration: 1 }, width: 300, height: 200 }))
    expect(win.parallax.data.value).toBe(5)
    expect(win.document.getElementById('lbl').textContent).toBe('Before')

    win.parallax.updateData({ label: 'After' })
    expect(win.parallax.data.label).toBe('After')
    expect(win.document.getElementById('lbl').textContent).toBe('After')
    await win.happyDOM.close()
  })
})

describe('plugin elements in present mode', () => {
  afterEach(() => registry.unregister(manifest.id))

  it('embeds the plugin sandbox with the element data', async () => {
    registry.register(manifest, 'test-counter')
    registry.setSandboxHtml(manifest.id, counterSandbox)
    const html = generateRevealHTML(presWith(counterElement))

    const srcdoc = srcdocOf(html)
    expect(srcdoc).toContain('window.parallax')
    expect(html).toContain('sandbox="allow-scripts"')

    const win = await runPage(srcdoc)
    expect(win.parallax.data).toEqual(counterElement.pluginData)
    expect(win.document.getElementById('lbl').textContent).toBe('Answers')
    await win.happyDOM.close()
  })

  it("shows a placeholder when the plugin's sandbox isn't loaded", () => {
    const html = generateRevealHTML(presWith(counterElement))
    expect(srcdocOf(html)).toBeNull()
    expect(html).toContain('Plugin: test-counter')
  })
})

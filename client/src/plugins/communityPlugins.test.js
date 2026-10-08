import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Window } from 'happy-dom'
import { webcrypto } from 'node:crypto'

// Node 18 has no global crypto, which new elements' ids come from
if (!globalThis.crypto) globalThis.crypto = webcrypto
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import registry from './PluginRegistry'
import { loadVersionSandbox, versionSandbox, versionSandboxUrl, pluginVersionsIn, clearVersionSandboxes } from './versionSandboxes'
import { loadPlugins, unloadPlugin, createPluginElement, getInsertablePluginTypes } from './PluginLoader'
import { generateRevealHTML } from '../utils/generateHTML'

const lorenz = {
  slug: 'someone--lorenz', community: true, pluginId: 'io.github.someone.lorenz', version: '1.1.0',
  manifest: {
    id: 'io.github.someone.lorenz', name: 'Lorenz', version: '1.1.0', sandbox: 'sandbox.html', main: './plugin.js',
    contributes: { elementTypes: [{ type: 'lorenz', label: 'Lorenz attractor', defaultSize: { width: 400, height: 300 }, defaultData: { sigma: 10 } }] },
  },
}
const local = {
  slug: 'counter', manifest: { id: 'test.local-counter', contributes: { elementTypes: [{ type: 'local-counter', label: 'Counter' }] } },
}

const page = text => ({ ok: true, text: async () => text })
const missing = () => ({ ok: false, text: async () => '' })

beforeEach(() => clearVersionSandboxes())
afterEach(() => {
  vi.unstubAllGlobals()
  for (const id of [lorenz.manifest.id, local.manifest.id]) unloadPlugin(id)
})

describe('community plugin pages, by version', () => {
  it('fetches each version once, and keeps null for one there isn’t', async () => {
    const fetchPage = vi.fn(async url => (url.includes('1.0.0') ? page('<p>v1</p>') : missing()))
    const [a, b] = await Promise.all([loadVersionSandbox('io.x.y', '1.0.0', fetchPage), loadVersionSandbox('io.x.y', '1.0.0', fetchPage)])
    expect(a).toBe('<p>v1</p>')
    expect(b).toBe('<p>v1</p>')
    expect(await loadVersionSandbox('io.x.y', '2.0.0', fetchPage)).toBe(null)
    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(fetchPage).toHaveBeenCalledWith('/api/plugin-versions/io.x.y/1.0.0/sandbox')
    expect(versionSandbox('io.x.y', '1.0.0')).toBe('<p>v1</p>')
    expect(versionSandbox('io.x.y', '3.0.0')).toBe(undefined)
  })

  it('lists the versions a deck’s elements record', () => {
    const deck = { slides: [
      { elements: [{ type: 'plugin:lorenz', pluginId: 'a.b', pluginVersion: '1.0.0' }, { type: 'plugin:lorenz', pluginId: 'a.b', pluginVersion: '1.0.0' }, { type: 'text' }] },
      { elements: [{ type: 'plugin:counter', pluginId: 'com.parallax.animated-counter' }, { type: 'plugin:lorenz', pluginId: 'a.b', pluginVersion: '1.1.0' }] },
    ] }
    expect(pluginVersionsIn(deck)).toEqual([{ pluginId: 'a.b', version: '1.0.0' }, { pluginId: 'a.b', version: '1.1.0' }])
  })
})

describe('loading community plugins', () => {
  it('loads local plugins for everyone, and community ones once installed, never importing a main', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => (url === '/api/plugins' ? { ok: true, json: async () => [local, { ...lorenz }] } : missing())))
    await loadPlugins({ getInstalled: null })
    expect(getInsertablePluginTypes().map(t => t.type)).toEqual(['plugin:local-counter'])

    await loadPlugins({ getInstalled: async () => [lorenz] })
    expect(getInsertablePluginTypes().map(t => t.type)).toEqual(['plugin:local-counter', 'plugin:lorenz'])
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('plugin.js'))
    expect(registry.getPlugin(lorenz.manifest.id)).toMatchObject({ community: true, version: '1.1.0' })
  })

  it('records the installed version on a new element, and an uninstall takes it out of the menu', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })))
    await loadPlugins({ getInstalled: async () => [lorenz] })
    const el = createPluginElement('plugin:lorenz')
    expect(el).toMatchObject({ type: 'plugin:lorenz', pluginId: lorenz.manifest.id, pluginVersion: '1.1.0', width: 400, height: 300, pluginData: { sigma: 10 } })
    unloadPlugin(lorenz.manifest.id)
    expect(getInsertablePluginTypes()).toEqual([])
    // Loads again after an uninstall
    await loadPlugins({ getInstalled: async () => [lorenz] })
    expect(getInsertablePluginTypes().map(t => t.type)).toEqual(['plugin:lorenz'])
  })

  it('exports each element at the version it records, or a placeholder until that version’s loaded', async () => {
    const element = { id: 'e1', type: 'plugin:lorenz', pluginId: 'a.b', pluginVersion: '1.0.0', x: 0, y: 0, width: 400, height: 300, pluginData: {} }
    const deck = { title: 'Deck', theme: 'black', slideWidth: 960, slideHeight: 540, slides: [{ id: 's1', elements: [element] }] }
    const srcdocOf = html => {
      const doc = new Window().document
      doc.write(html)
      return doc.querySelector('iframe')?.getAttribute('srcdoc') || null
    }
    expect(srcdocOf(generateRevealHTML(deck))).toBe(null)
    expect(registry.sandboxFor(element)).toBe(null)
    await loadVersionSandbox('a.b', '1.0.0', async () => page('<!DOCTYPE html><html><head></head><body id="lorenz-v1"></body></html>'))
    expect(srcdocOf(generateRevealHTML(deck))).toContain('id="lorenz-v1"')
    expect(versionSandboxUrl('a.b', '1.0.0')).toBe('/api/plugin-versions/a.b/1.0.0/sandbox')
  })
})

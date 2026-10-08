// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

const lorenz = {
  slug: 'someone--lorenz', community: true, pluginId: 'io.github.someone.lorenz', name: 'Lorenz attractor', version: '1.1.0',
  description: 'A strange attractor you can turn', downloads: 3, repo: { owner: 'someone', name: 'lorenz' },
  manifest: { keywords: ['chaos'], categories: ['physics'] },
}
const ising = { ...lorenz, slug: 'else--ising', pluginId: 'io.github.else.ising', name: 'Ising model', description: 'Spins on a lattice', repo: { owner: 'else', name: 'ising' }, manifest: { categories: ['physics'] } }
const tooBig = Object.assign(new Error('The plugin at v2.0.0 breaks 2 of the rules'), {
  problems: ['“main” isn’t allowed in community plugins yet', 'dist/ holds 3.1 MB; a plugin can be at most 2.0 MB'],
})

vi.mock('../utils/api', () => ({
  api: {
    getPluginCatalog: vi.fn(async () => [lorenz, ising, { slug: 'animated-counter', community: false, name: 'Counter' }]),
    getInstalledPlugins: vi.fn(async () => [ising]),
    installPlugin: vi.fn(async () => ({ ok: true })),
    uninstallPlugin: vi.fn(async () => ({ ok: true })),
    getPluginSubmissions: vi.fn(async () => [{ id: 'v0', pluginId: 'io.github.you.waves', version: '0.9.0', status: 'rejected', reviewNote: 'Needs a license', manifest: { name: 'Waves' } }]),
    lookupPluginRepo: vi.fn(async () => ({
      owner: 'you', repo: 'waves', url: 'https://github.com/you/waves', description: 'Waves on a string', stars: 4,
      tags: [{ name: 'v2.0.0', version: '2.0.0', status: null }, { name: 'v1.0.0', version: '1.0.0', status: null }, { name: 'v0.9.0', version: '0.9.0', status: 'rejected' }],
    })),
    importPluginVersion: vi.fn(async (url, tag) => {
      if (tag === 'v2.0.0') throw tooBig
      return { id: 'v1', version: '1.0.0', status: 'pending', manifest: { name: 'Waves' } }
    }),
  },
}))
import { api } from '../utils/api'
import PluginBrowser from './PluginBrowser'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, el
beforeEach(() => vi.clearAllMocks())
afterEach(() => { act(() => root.unmount()); el.remove() })

async function mount(props = {}) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<PluginBrowser onClose={() => {}} {...props} />))
}
const button = (scope, text) => [...scope.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const card = slug => el.querySelector(`[data-plugin="${slug}"]`)
const type = async (input, value) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  await act(async () => { set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) })
}

describe('the Plugins dialog', () => {
  it('lists the community plugins, marks the installed ones, and installs', async () => {
    const onInstalled = vi.fn()
    const onUninstalled = vi.fn()
    await mount({ onInstalled, onUninstalled })
    expect(card('animated-counter')).toBe(null)
    expect(card('someone--lorenz').textContent).toContain('someone/lorenz')
    expect(card('someone--lorenz').textContent).toContain('3 installs')
    expect(button(card('else--ising'), 'Installed')).toBeTruthy()

    await act(async () => button(card('someone--lorenz'), 'Install').click())
    expect(api.installPlugin).toHaveBeenCalledWith('someone--lorenz')
    expect(onInstalled).toHaveBeenCalledWith(lorenz)
    expect(button(card('someone--lorenz'), 'Installed')).toBeTruthy()

    await act(async () => button(card('else--ising'), 'Installed').click())
    expect(api.uninstallPlugin).toHaveBeenCalledWith('else--ising')
    expect(onUninstalled).toHaveBeenCalledWith(ising)
  })

  it('searches names, descriptions and keywords', async () => {
    await mount()
    await type(el.querySelector('input[aria-label="Search plugins"]'), 'chaos')
    expect(card('someone--lorenz')).toBeTruthy()
    expect(card('else--ising')).toBe(null)
  })

  it('imports a tag of a repo for review, and shows each rule a version breaks', async () => {
    await mount({ initialTab: 'publish' })
    expect(el.textContent).toContain('Waves 0.9.0Not approved')
    expect(el.textContent).toContain('Needs a license')
    await type(el.querySelector('input[aria-label="GitHub repo"]'), 'https://github.com/you/waves')
    await act(async () => el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(api.lookupPluginRepo).toHaveBeenCalledWith('https://github.com/you/waves')
    const radios = [...el.querySelectorAll('input[type="radio"]')]
    expect(radios.map(r => [r.value, r.checked, r.disabled])).toEqual([['v2.0.0', true, false], ['v1.0.0', false, false], ['v0.9.0', false, true]])

    await act(async () => button(el, 'Import v2.0.0').click())
    const alert = el.querySelector('[role="alert"]')
    expect(alert.textContent).toContain('breaks 2 of the rules')
    expect([...alert.querySelectorAll('li')].map(li => li.textContent)).toEqual(tooBig.problems)

    await act(async () => radios[1].click())
    await act(async () => button(el, 'Import v1.0.0').click())
    expect(api.importPluginVersion).toHaveBeenLastCalledWith('https://github.com/you/waves', 'v1.0.0')
    expect(el.querySelector('[role="status"]').textContent).toContain('Imported Waves 1.0.0. It’s waiting for review.')
    expect(el.querySelector('input[value="v1.0.0"]').disabled).toBe(true)
    expect(api.getPluginSubmissions).toHaveBeenCalledTimes(2)
  })
})

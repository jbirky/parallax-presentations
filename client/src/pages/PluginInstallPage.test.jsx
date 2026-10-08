// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: {
    getPlugin: vi.fn(async slug => {
      if (slug === 'gone') throw new Error('That plugin isn’t listed')
      return { slug, name: 'Exoplanet plot' }
    }),
    installPlugin: vi.fn(async () => ({ ok: true })),
  },
}))
import { api } from '../utils/api'
import PluginInstallPage from './PluginInstallPage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, el
beforeEach(() => vi.clearAllMocks())
afterEach(() => { act(() => root.unmount()); el.remove() })

async function mount(slug) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<PluginInstallPage slug={slug} />))
}
const button = text => [...el.querySelectorAll('button')].find(b => b.textContent === text)

describe('installing a plugin from the gallery', () => {
  it('installs it and says where its element is', async () => {
    await mount('jbirky--parallax-exoplanets')
    expect(api.installPlugin).toHaveBeenCalledWith('jbirky--parallax-exoplanets')
    expect(el.querySelector('h1').textContent).toBe('Exoplanet plot is installed')
    expect(el.textContent).toContain('Plugins menu')
    expect(button('Go to your presentations')).toBeTruthy()
    expect(button('Back to the plugin')).toBeTruthy()
  })

  it('says why when it can’t', async () => {
    await mount('gone')
    expect(api.installPlugin).not.toHaveBeenCalled()
    expect(el.querySelector('[role="alert"]').textContent).toBe('That plugin isn’t listed')
    expect(button('See the plugins')).toBeTruthy()
  })
})

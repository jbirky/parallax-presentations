import { describe, it, expect } from 'vitest'
import { compareVersions, pluginUpdates, withPluginVersion } from './pluginUpdates'

const catalog = [
  { slug: 'jbirky--parallax-exoplanets', community: true, pluginId: 'io.github.jbirky.exoplanets', name: 'Exoplanet plot', version: '1.0.1' },
  { slug: 'local-counter', community: false, pluginId: 'org.example.counter', name: 'Counter', version: '9.9.9' },
]
const exo = (id, pluginVersion) => ({ id, type: 'plugin:exoplanet-plot', pluginId: 'io.github.jbirky.exoplanets', pluginVersion, pluginData: { x: 'radius' } })
const deck = elements => ({ slides: [{ id: 's1', elements: elements.slice(0, 2) }, { id: 's2', elements: elements.slice(2) }] })

describe('plugin updates', () => {
  it('orders versions as semver does', () => {
    expect(['1.10.0', '1.2.0', '1.2.0-beta.10', '1.2.0-beta.2'].sort(compareVersions)).toEqual(['1.2.0-beta.2', '1.2.0-beta.10', '1.2.0', '1.10.0'])
  })

  it('offers the newest listed version to a deck’s older elements, counting them', () => {
    const d = deck([exo('a', '1.0.0'), { id: 't', type: 'text' }, exo('b', '1.0.1'), exo('c', '0.9.0')])
    expect(pluginUpdates(d, catalog)).toEqual([{
      pluginId: 'io.github.jbirky.exoplanets', slug: 'jbirky--parallax-exoplanets', name: 'Exoplanet plot', to: '1.0.1', from: ['0.9.0', '1.0.0'], count: 2, unavailable: false,
    }])
  })

  it('offers nothing for elements at the newest version, a newer one, or a plugin from a folder', () => {
    const d = deck([exo('a', '1.0.1'), exo('b', '1.2.0'), { id: 'c', type: 'plugin:counter', pluginId: 'org.example.counter' }])
    expect(pluginUpdates(d, catalog)).toEqual([])
    expect(pluginUpdates(d, [])).toEqual([])
  })

  it('offers an older listed version when the elements’ own can’t be had', () => {
    const d = deck([exo('a', '1.2.0')])
    const [u] = pluginUpdates(d, catalog, { unavailable: (id, v) => v === '1.2.0' })
    expect(u).toMatchObject({ to: '1.0.1', from: ['1.2.0'], unavailable: true })
  })

  it('moves every element of the plugin, keeping its settings and leaving the rest alone', () => {
    const d = deck([exo('a', '1.0.0'), { id: 't', type: 'text' }, exo('c', '0.9.0')])
    const next = withPluginVersion(d, 'io.github.jbirky.exoplanets', '1.0.1')
    expect(next.slides.flatMap(s => s.elements).map(el => el.pluginVersion ?? null)).toEqual(['1.0.1', null, '1.0.1'])
    expect(next.slides[1].elements[0].pluginData).toEqual({ x: 'radius' })
    expect(next.slides[0].elements[1]).toBe(d.slides[0].elements[1])
    // A slide with nothing to move stays the same object
    const untouched = withPluginVersion(deck([{ id: 't', type: 'text' }]), 'io.github.jbirky.exoplanets', '1.0.1')
    expect(pluginUpdates(untouched, catalog)).toEqual([])
  })
})

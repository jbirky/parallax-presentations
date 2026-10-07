// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  document.head.innerHTML = ''
  delete window.umami
})
const load = async config => {
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => config }))
  const analytics = await import('./analytics')
  await analytics.startAnalytics()
  return analytics
}

describe('analytics', () => {
  it('loads Umami’s script from this site, once, honoring Do Not Track', async () => {
    const { startAnalytics } = await load({ websiteId: 'ca976091-851a-4e54-b53e-6fa9a8bd8b79', script: '/stats/script.js' })
    await startAnalytics()
    const scripts = document.head.querySelectorAll('script')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].getAttribute('src')).toBe('/stats/script.js')
    expect(scripts[0].getAttribute('data-website-id')).toBe('ca976091-851a-4e54-b53e-6fa9a8bd8b79')
    expect(scripts[0].getAttribute('data-do-not-track')).toBe('true')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps events from before the script arrives, and sends them when it does', async () => {
    const { track } = await load({ websiteId: 'w', script: '/stats/script.js' })
    track('open-example', { example: 'venn' })
    track('try', { from: 'hero' })
    window.umami = { track: vi.fn() }
    document.head.querySelector('script').onload()
    expect(window.umami.track.mock.calls).toEqual([['open-example', { example: 'venn' }], ['try', { from: 'hero' }]])
    track('docs', { from: 'nav' })
    expect(window.umami.track).toHaveBeenLastCalledWith('docs', { from: 'nav' })
  })

  it('does nothing where the server has no analytics', async () => {
    const { track } = await load({})
    expect(document.head.querySelector('script')).toBeNull()
    track('try', { from: 'hero' })
    window.umami = { track: vi.fn() }
    expect(window.umami.track).not.toHaveBeenCalled()
  })
})

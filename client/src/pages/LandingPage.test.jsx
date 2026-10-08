// @vitest-environment happy-dom
// @vitest-environment-options {"settings": {"disableIframePageLoading": true}}
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

const guest = { enabled: true }
const server = { list: null }
vi.mock('../utils/api', () => ({ api: { getGuestConfig: vi.fn(async () => guest), getLandingExamples: vi.fn(async () => server.list) } }))
vi.mock('../components/DocsPage', () => ({ default: () => <div className="docs-stub">Docs</div> }))
vi.mock('../utils/analytics', () => ({ startAnalytics: vi.fn(), track: vi.fn() }))
import { startAnalytics, track } from '../utils/analytics'
import LandingPage from './LandingPage'
import { EXAMPLES } from '../examples/catalog'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, el
afterEach(() => { act(() => root.unmount()); el.remove(); window.location.hash = '' })

async function mount(props = {}) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<LandingPage onSignIn={() => {}} {...props} />))
  return el
}
const cards = () => [...el.querySelectorAll('.lp-card h3')].map(h => h.textContent)
const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.startsWith(text))

describe('the landing page', () => {
  it('opens with a live deck and a way in without an account', async () => {
    await mount()
    expect(el.querySelector('.lp-hero iframe').getAttribute('src')).toBe('/examples/hero/deck')
    expect(el.querySelector('.lp-ctas a').getAttribute('href')).toBe('/try')
    expect(el.querySelector('.lp-fine').textContent).toContain('Jess Birky')
    expect(el.querySelector('.lp-support a').getAttribute('href')).toBe('mailto:support@parallax-presentations.com')
  })

  it('shows the examples by field', async () => {
    await mount()
    expect([...el.querySelectorAll('a.lp-card')].map(a => a.getAttribute('href'))).toEqual(EXAMPLES.map(e => `/examples/${e.slug}`))
    expect(cards()).toEqual(EXAMPLES.map(e => e.title))
    await act(async () => button('Physics').click())
    expect(cards()).toEqual(EXAMPLES.filter(e => e.field === 'Physics').map(e => e.title))
    expect(button('Physics').getAttribute('aria-pressed')).toBe('true')
    await act(async () => button('All').click())
    expect(cards()).toHaveLength(EXAMPLES.length)
  })

  it('opens an example live, steps to the next, and into the editor with it', async () => {
    await mount()
    await act(async () => el.querySelectorAll('.lp-card')[1].click())
    const viewer = el.querySelector('.lp-viewer')
    expect(viewer.querySelector('iframe').getAttribute('src')).toBe(`/examples/${EXAMPLES[1].slug}/deck`)
    expect([...viewer.querySelectorAll('a')].some(a => a.getAttribute('href') === `/examples/${EXAMPLES[1].slug}`)).toBe(true)
    expect(viewer.querySelector('a.lp-btn').getAttribute('href')).toBe(`/try?example=${EXAMPLES[1].slug}`)
    await act(async () => viewer.querySelector('[aria-label="Next example"]').click())
    expect(viewer.querySelector('h3').textContent).toBe(EXAMPLES[2].title)
    await act(async () => viewer.querySelector('[aria-label="Previous example"]').click())
    await act(async () => viewer.querySelector('[aria-label="Previous example"]').click())
    await act(async () => viewer.querySelector('[aria-label="Previous example"]').click())
    expect(viewer.querySelector('h3').textContent).toBe(EXAMPLES[EXAMPLES.length - 1].title)
    await act(async () => viewer.querySelector('[aria-label="Close"]').click())
    expect(viewer.querySelector('iframe')).toBeNull()
  })

  it('asks for a sign-in instead, where there’s no guest mode', async () => {
    guest.enabled = false
    try {
      const onSignIn = vi.fn()
      await mount({ onSignIn })
      await act(async () => button('Get started free').click())
      await act(async () => el.querySelector('.lp-card').click())
      await act(async () => button('Sign in to make your own').click())
      expect(onSignIn).toHaveBeenCalledTimes(2)
    } finally { guest.enabled = true }
  })

  it('shows the examples as the server lists them, with a placeholder for one without a thumbnail', async () => {
    server.list = {
      hero: 'my-talk',
      examples: [
        { slug: 'my-talk', field: 'Biology', title: 'Cell division', desc: 'Mitosis, step by step', tags: ['Diagram'], thumbnail: null, background: { type: 'color', color: '#123456' } },
        { slug: 'venn', field: 'Mathematics', title: 'Venn diagrams', desc: 'De Morgan', tags: [], thumbnail: '/examples/thumbs/venn.jpg' },
      ],
    }
    try {
      await mount()
      expect(el.querySelector('.lp-hero iframe').getAttribute('src')).toBe('/examples/my-talk/deck')
      expect(cards()).toEqual(['Cell division', 'Venn diagrams'])
      expect([...el.querySelectorAll('.lp-filters button')].map(b => b.firstChild.textContent)).toEqual(['All', 'Mathematics', 'Biology'])
      const thumb = el.querySelector('.lp-card .lp-thumb')
      expect(thumb.querySelector('img')).toBeNull()
      expect(thumb.querySelector('.lp-thumb-title').textContent).toBe('Cell division')
      expect(thumb.getAttribute('style')).toContain('#123456')
    } finally { server.list = null }
  })

  it('counts what visitors open and click', async () => {
    track.mockClear()
    await mount()
    expect(startAnalytics).toHaveBeenCalled()
    await act(async () => el.querySelector('.lp-ctas a').click())
    expect(track).toHaveBeenLastCalledWith('try', { from: 'hero' })
    await act(async () => button('Chemistry').click())
    expect(track).toHaveBeenLastCalledWith('filter', { field: 'Chemistry' })
    await act(async () => el.querySelector('.lp-card').click())
    expect(track).toHaveBeenLastCalledWith('open-example', { example: 'chemistry', from: 'card' })
    await act(async () => el.querySelector('.lp-viewer a.lp-btn').click())
    expect(track).toHaveBeenLastCalledWith('example-to-editor', { example: 'chemistry' })
    await act(async () => el.querySelector('[aria-label="Next example"]').click())
    expect(track).toHaveBeenLastCalledWith('open-example', { example: 'chemistry', from: 'viewer' })
  })

  it('opens the docs in place, and comes back to a section', async () => {
    await mount()
    await act(async () => [...el.querySelectorAll('.lp-links button')].find(b => b.textContent === 'Docs').click())
    expect(el.querySelector('.docs-stub')).not.toBeNull()
    expect(window.location.hash).toBe('#docs')
    await act(async () => [...el.querySelectorAll('.lp-links button')].find(b => b.textContent === 'Examples').click())
    expect(el.querySelector('.docs-stub')).toBeNull()
    expect(el.querySelector('#examples')).not.toBeNull()
  })
})

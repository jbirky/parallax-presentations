// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import DocsPage from './DocsPage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const response = (body, type) => Promise.resolve({ ok: true, headers: { get: () => type }, text: () => Promise.resolve(body), json: () => Promise.resolve(JSON.parse(body)) })

// The docs page opened on `initialPage`, with the server answering `answer`
// for anything but the sidebar; resolves to what was fetched and the page
async function open(initialPage, answer) {
  const fetch = vi.fn(url => url === '/api/docs/sidebar'
    ? response('{"guide":[],"features":[],"tutorials":[]}', 'application/json')
    : answer())
  vi.stubGlobal('fetch', fetch)
  const el = document.createElement('div')
  document.body.appendChild(el)
  await act(async () => { createRoot(el).render(<DocsPage initialPage={initialPage} />) })
  await act(async () => {})
  return { urls: fetch.mock.calls.map(c => c[0]), el }
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('the docs page', () => {
  it('shows a docs page', async () => {
    const { urls, el } = await open('guide/getting-started', () => response('# Getting started', 'text/plain; charset=utf-8'))
    expect(urls).toContain('/api/docs/guide/getting-started')
    expect(el.querySelector('.docs-markdown').textContent).toContain('Getting started')
  })

  it('fetches nothing but docs pages, whatever the URL says', async () => {
    const answer = vi.fn(() => response('[{"title":"<img src=x onerror=alert(1)>"}]', 'application/json'))
    const { urls, el } = await open('../presentations', answer)
    expect(urls).toEqual(['/api/docs/sidebar'])
    expect(el.querySelector('.docs-markdown').textContent).toContain('Not Found')
  })

  it('shows only what the docs route sends as text', async () => {
    const { el } = await open('guide/x', () => response('[{"title":"<img src=x onerror=alert(1)>"}]', 'application/json'))
    expect(el.querySelector('.docs-markdown img')).toBeNull()
    expect(el.querySelector('.docs-markdown').textContent).toContain('Not Found')
  })
})

// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: { getLandingExamples: vi.fn(), useTemplate: vi.fn() },
}))
vi.mock('../utils/analytics', () => ({ track: vi.fn() }))
import { api } from '../utils/api'
import { track } from '../utils/analytics'
import TemplateUsePage from './TemplateUsePage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const LIST = {
  hero: 'hero', examples: [],
  templates: [{ slug: 'journal-club', title: 'Journal club', field: 'Talks', desc: 'A paper in ten slides', tags: [], thumbnail: '/examples/thumbs/journal-club.jpg?v=1', background: null }],
}

async function render(slug = 'journal-club') {
  const el = document.createElement('div')
  const root = createRoot(el)
  const onOpen = vi.fn()
  await act(async () => root.render(<TemplateUsePage slug={slug} onOpen={onOpen} />))
  const button = text => [...el.querySelectorAll('button')].find(b => b.textContent === text)
  return { el, root, onOpen, button }
}

beforeEach(() => vi.clearAllMocks())

describe('using a template from the landing page', () => {
  it('says which template it is, and makes a copy only when asked', async () => {
    api.getLandingExamples.mockResolvedValue(LIST)
    api.useTemplate.mockResolvedValue({ id: 'p9', title: 'Journal club' })
    const { el, onOpen, button, root } = await render()
    expect(el.querySelector('h1').textContent).toBe('Start a presentation from “Journal club”')
    expect(el.querySelector('img').getAttribute('src')).toBe('/examples/thumbs/journal-club.jpg?v=1')
    expect(el.textContent).toContain('A paper in ten slides')
    expect(api.useTemplate).not.toHaveBeenCalled()
    await act(async () => { button('Make my copy').click() })
    expect(api.useTemplate).toHaveBeenCalledWith('journal-club')
    expect(onOpen).toHaveBeenCalledWith('p9', 'Journal club')
    expect(track).toHaveBeenCalledWith('use-template', { template: 'journal-club' })
    act(() => root.unmount())
  })

  it('says so when the template is gone', async () => {
    api.getLandingExamples.mockResolvedValue({ ...LIST, templates: [] })
    const { el, button, root } = await render()
    expect(el.querySelector('[role="alert"]').textContent).toBe('That template isn’t available any more.')
    expect(el.querySelector('a').getAttribute('href')).toBe('/#templates')
    expect(button('Make my copy')).toBeUndefined()
    act(() => root.unmount())
  })

  it('passes on why the copy wasn’t made, such as a full plan', async () => {
    api.getLandingExamples.mockResolvedValue(LIST)
    api.useTemplate.mockRejectedValue(new Error('The Free plan is limited to 3 presentations.'))
    const { el, onOpen, button, root } = await render()
    await act(async () => { button('Make my copy').click() })
    expect(el.querySelector('[role="alert"]').textContent).toBe('The Free plan is limited to 3 presentations.')
    expect(onOpen).not.toHaveBeenCalled()
    act(() => root.unmount())
  })
})

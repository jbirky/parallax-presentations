// The presented deck: theme colors, placeholders and text that shrinks to fit
import { describe, it, expect } from 'vitest'

if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import { generateRevealHTML } from './generateHTML'

const text = (id, content, extra = {}) => ({ id, type: 'text', x: 40, y: 40, width: 400, height: 100, zIndex: 1, content, ...extra })
const deck = (theme, slides) => ({ title: 'T', theme, transition: 'slide', slideWidth: 960, slideHeight: 540, slides })
const sections = html => [...html.matchAll(/<section data-slide-id="([^"]+)"[^>]*style="([^"]*)"/g)].map(m => ({ id: m[1], style: m[2] }))

describe('the presented deck', () => {
  it('gives a slide without a background the theme’s text and heading colors', () => {
    const html = generateRevealHTML(deck('white', [{ id: 's1', elements: [text('a', '<h2>Hello</h2>')] }]))
    expect(html).toMatch(/color:#222222;[^"]*">\s*<h2>Hello<\/h2>/)
    expect(sections(html)[0].style).toContain('--r-heading-color:#222222;')
    expect(html).not.toContain('data-background-color')
  })

  it('keeps white text and headings on the old dark default in a light theme', () => {
    const html = generateRevealHTML(deck('white', [{ id: 's1', background: { type: 'color', color: '#1e1e2e' }, elements: [text('a', '<h2>Hi</h2>')] }]))
    expect(html).toContain('data-background-color="#1e1e2e"')
    expect(html).toMatch(/color:#ffffff;[^"]*">\s*<h2>Hi<\/h2>/)
    expect(sections(html)[0].style).toContain('--r-heading-color:#ffffff;')
  })

  it('leaves out empty placeholders, and keeps ones with text', () => {
    const html = generateRevealHTML(deck('black', [{ id: 's1', elements: [
      text('empty', '<h2 style="text-align:center"></h2>', { placeholder: 'title' }),
      text('full', '<p>Typed</p>', { placeholder: 'body', y: 200 }),
    ] }]))
    expect(html).not.toContain('Click to add')
    expect(html).toContain('<p>Typed</p>')
    expect((html.match(/<h2 style="text-align:center"><\/h2>/g) || []).length).toBe(0)
  })

  it('shrinks text set to, with the script that fits it', () => {
    const shrink = generateRevealHTML(deck('black', [{ id: 's1', elements: [text('a', '<p>Long</p>', { sizeMode: 'shrink' })] }]))
    expect(shrink).toMatch(/data-fit="shrink" style="[^"]*"><div style="position:relative;padding:8px 12px;[^"]*"><p>Long<\/p><\/div><\/div>/)
    expect(shrink).toContain('window.parallaxFitText')
    const fixed = generateRevealHTML(deck('black', [{ id: 's1', elements: [text('a', '<p>Short</p>')] }]))
    expect(fixed).not.toContain('data-fit="shrink"')
    expect(fixed).not.toContain('window.parallaxFitText')
  })
})

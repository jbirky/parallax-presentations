import { describe, it, expect, vi } from 'vitest'
import { Window } from 'happy-dom'

if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import { generateRevealHTML, exportPDF } from './generateHTML'
import { CITATION_CSS } from './citationIndex'

// Presented decks and PDFs number citations by the index: the entries the deck
// cites, in the order it's set to (utils/citationIndex.js)

const smith = { key: 'smith2020', type: 'article', author: 'Smith, John', title: 'Alpha Paper', year: '2020' }
const doe = { key: 'doe2019', type: 'article', author: 'Doe, Jane', title: 'Beta Paper', year: '2019' }
const ames = { key: 'ames2021', type: 'article', author: 'Ames, Ada', title: 'Gamma Paper', year: '2021' }
const marker = (key, label) => `<sup data-cite="${key}" style="color:#6366f1;cursor:default">${label}</sup>`
const text = (id, content, y = 0) => ({ id, type: 'text', x: 0, y, width: 400, height: 60, zIndex: 1, content })

// Library order smith, doe, ames; the deck cites ames first, then smith, and
// the stored labels are out of date
const deck = (extra = {}) => ({
  id: 'p', title: 'Deck', slideWidth: 960, slideHeight: 540,
  bibliography: [smith, doe, ames],
  slides: [
    { id: 's1', elements: [text('e1', `<p>first ${marker('ames2021', '[3]')}</p>`)] },
    { id: 's2', elements: [text('e2', `<p>then ${marker('smith2020', '[1]')}</p>`)] },
  ],
  ...extra,
})

const parse = html => { const win = new Window({ url: 'http://localhost/' }); win.document.write(html); return win.document }
const references = doc => [...doc.querySelectorAll('section[data-slide-id="references"] div[style*="columns"] > div')].map(d => d.textContent.replace(/\s+/g, ' ').trim())

describe('citations in a presented deck', () => {
  it('shows each marker with its index label, whatever it stored', () => {
    const doc = parse(generateRevealHTML(deck()))
    expect(doc.querySelector('section[data-slide-id="s1"] sup[data-cite]').textContent).toBe('[1]')
    expect(doc.querySelector('section[data-slide-id="s2"] sup[data-cite]').textContent).toBe('[2]')
  })

  it('lists only cited entries on the references slide, numbered the same way', () => {
    const refs = references(parse(generateRevealHTML(deck())))
    expect(refs).toHaveLength(2)
    expect(refs[0]).toBe('[1]Ames, Ada (2021). Gamma Paper.')
    expect(refs[1]).toBe('[2]Smith, John (2020). Alpha Paper.')
  })

  it('sizes the references slide like the others, so its list shows', () => {
    // Unsized, the section was 0px tall and clipped everything on it
    const section = parse(generateRevealHTML(deck())).querySelector('section[data-slide-id="references"]')
    expect(section.getAttribute('style')).toContain('width:960px;height:540px;overflow:hidden;')
  })

  it('follows the alphabetical order and the author-year style', () => {
    const doc = parse(generateRevealHTML(deck({ citationOrder: 'alphabetical', citationStyle: 'author-year' })))
    expect(doc.querySelector('section[data-slide-id="s1"] sup[data-cite]').textContent).toBe('(Ames, 2021)')
    expect(references(doc).map(r => r.slice(0, 3))).toEqual(['[1]', '[2]'])
  })

  it('brings the rule that makes markers bold only when there are markers', () => {
    expect(generateRevealHTML(deck())).toContain(CITATION_CSS)
    const plain = deck({ slides: [{ id: 's1', elements: [text('e1', '<p>See [1]</p>')] }] })
    expect(generateRevealHTML(plain)).not.toContain(CITATION_CSS)
  })

  it('escapes what a bibliography brings into a label', () => {
    const odd = { ...doe, key: 'odd', author: 'Doe, <img src=x onerror=alert(1)>' }
    const html = generateRevealHTML(deck({ citationStyle: 'author-year', bibliography: [odd], slides: [{ id: 's1', elements: [text('e1', `<p>${marker('odd', 'x')}</p>`)] }] }))
    expect(html).not.toContain('<img src=x')
  })
})

describe('citations in a PDF', () => {
  it('prints index labels, and the references on a last page', async () => {
    let blob = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    globalThis.window.open = vi.fn()
    vi.useFakeTimers()
    try { exportPDF(deck()) } finally { vi.useRealTimers(); vi.restoreAllMocks() }
    const page = JSON.parse((await blob.text()).match(/frame\.srcdoc = (".*");/)[1])
    const pages = [...parse(page).querySelectorAll('.slide-page')]
    expect(pages).toHaveLength(3)
    expect(pages[0].querySelector('sup[data-cite]').textContent).toBe('[1]')
    expect(pages[2].textContent).toContain('References')
    expect(pages[2].textContent.replace(/\s+/g, ' ')).toContain('[2]Smith, John (2020). Alpha Paper.')
    expect(page).toContain(CITATION_CSS)
  })
})

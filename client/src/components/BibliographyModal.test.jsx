// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: {
    getZoteroConfig: vi.fn(async () => ({})),
  },
}))
import BibliographyModal, { matchesLibrarySearch } from './BibliographyModal'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const library = [
  { type: 'article', key: 'gaia2016', title: 'The Gaia mission', author: 'Prusti, T. and Brown, A. G. A.', year: '2016', journal: 'A&A' },
  { type: 'article', key: 'schrodinger1926', title: 'Quantisierung als Eigenwertproblem', author: 'Schr\\"odinger, E.', year: '1926', journal: 'Annalen der Physik' },
  { type: 'book', key: 'mw2008', title: 'Galactic Dynamics', author: 'Binney, J. and Tremaine, S.', year: '2008' },
  { type: 'inproceedings', key: 'kepler2010', title: 'Kepler Mission Design', author: 'Borucki, W. J.', year: '2010', booktitle: 'Proc. SPIE' },
]

function render(props) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const onUpdate = vi.fn(), onInsertCitation = vi.fn(), onClose = vi.fn()
  act(() => root.render(<BibliographyModal bibliography={library} onUpdate={onUpdate} onInsertCitation={onInsertCitation} onClose={onClose} {...props} />))
  const search = () => el.querySelector('input[aria-label="Search the library"]')
  const titles = () => [...el.querySelectorAll('div')].filter(d => d.style.fontWeight === '500').map(d => d.textContent)
  const type = async text => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    await act(async () => { setValue.call(search(), text); search().dispatchEvent(new Event('input', { bubbles: true })) })
  }
  const buttons = text => [...el.querySelectorAll('button')].filter(b => b.textContent.trim() === text)
  return { el, root, onUpdate, onInsertCitation, search, titles, type, buttons }
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('matching a library entry', () => {
  it('needs every word, in any order, across key, title, authors, year and venue', () => {
    expect(matchesLibrarySearch(library[0], 'gaia')).toBe(true)
    expect(matchesLibrarySearch(library[0], 'BROWN 2016')).toBe(true)
    expect(matchesLibrarySearch(library[0], 'mission prusti')).toBe(true)
    expect(matchesLibrarySearch(library[0], 'gaia 2017')).toBe(false)
    expect(matchesLibrarySearch(library[1], 'annalen')).toBe(true)
    expect(matchesLibrarySearch(library[3], 'spie')).toBe(true)
    expect(matchesLibrarySearch(library[2], 'mw2008')).toBe(true)
  })

  it('ignores accents, typed or left as LaTeX', () => {
    expect(matchesLibrarySearch(library[1], 'schrodinger')).toBe(true)
    expect(matchesLibrarySearch(library[1], 'Schrödinger')).toBe(true)
    expect(matchesLibrarySearch({ key: 'x', author: 'Schr{\\"o}dinger, E.' }, 'schrödinger')).toBe(true)
  })

  it('matches everything when the query is blank', () => {
    expect(matchesLibrarySearch(library[0], '   ')).toBe(true)
  })
})

describe('the Library tab search', () => {
  it('shows only matching entries, and how many of the library they are', async () => {
    const { el, titles, type } = render()
    expect(titles()).toHaveLength(4)
    await type('mission')
    expect(titles()).toEqual(['The Gaia mission', 'Kepler Mission Design'])
    expect(el.textContent).toContain('2 of 4')
    await type('')
    expect(titles()).toHaveLength(4)
    expect(el.textContent).not.toContain('of 4')
  })

  it('says so when nothing matches', async () => {
    const { el, titles, type } = render()
    await type('neutrino')
    expect(titles()).toHaveLength(0)
    expect(el.textContent).toContain('No entries match “neutrino”')
  })

  it('cites a found entry with its place in the whole library', async () => {
    const { onInsertCitation, type, buttons } = render()
    await type('kepler')
    const cites = buttons('Cite')
    expect(cites).toHaveLength(1)
    await act(async () => { cites[0].click() })
    expect(onInsertCitation).toHaveBeenCalledWith(library[3], 3)
  })

  it("can't reorder while searching, since neighbours may be hidden", async () => {
    const { type, buttons } = render()
    await type('galactic')
    expect(buttons('↑')[0].disabled).toBe(true)
    expect(buttons('↓')[0].disabled).toBe(true)
    await type('')
    expect(buttons('↓')[0].disabled).toBe(false)
  })

  it('clears on Escape without letting the editor see it', async () => {
    const { search, titles, type } = render()
    await type('gaia')
    const seen = vi.fn()
    document.addEventListener('keydown', seen)
    await act(async () => { search().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(search().value).toBe('')
    expect(titles()).toHaveLength(4)
    expect(seen).not.toHaveBeenCalled()
    document.removeEventListener('keydown', seen)
  })

  it('has no search box while the library is empty', () => {
    const { search } = render({ bibliography: [] })
    expect(search()).toBeNull()
  })
})

// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({ api: { uploadFile: vi.fn(async () => ({ url: '/uploads/x.png' })) } }))
import BeamerImportModal from './BeamerImportModal'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, el
afterEach(() => { act(() => root.unmount()); el.remove() })

async function mount(props = {}) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<BeamerImportModal onClose={() => {}} {...props} />))
}
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 320)) })
const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text)
async function typeSource(value) {
  const area = el.querySelector('textarea[aria-label="Beamer source"]')
  const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  await act(async () => { set.call(area, value); area.dispatchEvent(new Event('input', { bubbles: true })) })
  await settle()
}
async function drop(files) {
  const input = el.querySelector('input[type="file"]')
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
  await settle()
}
const cards = () => [...el.querySelectorAll('[role="checkbox"]')]

const TALK = `\\documentclass{beamer}
\\title{My talk}
\\begin{document}
\\begin{frame}{One}First \\cite{knuth}\\end{frame}
\\begin{frame}{Two}A\\pause B\\end{frame}
\\end{document}`

describe('the Beamer import', () => {
  it('previews each frame as it’s typed, and adds the frames chosen', async () => {
    const onInsert = vi.fn()
    await mount({ onInsert })
    expect(el.textContent).toContain('The slides show here as you type')
    await typeSource(TALK)
    expect(cards()).toHaveLength(2)
    expect(cards()[0].textContent).toContain('1. One')
    expect(cards()[1].textContent).toMatch(/2 steps.*2\. Two/)
    expect(el.textContent).toContain('2 of 2 frames · 2 slides')
    // An unknown key shows as itself, and says so
    expect(el.textContent).toContain('1 citation without an entry')

    await act(async () => cards()[0].click())
    expect(cards()[0].getAttribute('aria-checked')).toBe('false')
    await act(async () => button('Add 1 slide').click())
    expect(onInsert).toHaveBeenCalledTimes(1)
    const [slides, bibliography] = onInsert.mock.calls[0]
    expect(slides).toHaveLength(1)
    expect(slides[0].elements.some(e => e.fragment)).toBe(true)
    expect(bibliography).toBe(null)
  })

  it('starts a new deck from a dropped .tex and .bib, with the references it cites', async () => {
    const onCreate = vi.fn(async () => {})
    await mount({ mode: 'new', onCreate })
    await drop([
      new File([TALK], 'main.tex'),
      new File(['@book{knuth, title={The TeXbook}, author={Knuth, Donald}, year={1984}}\n@book{unused, title={Other}}'], 'refs.bib'),
    ])
    expect(el.querySelector('textarea').value).toBe(TALK)
    expect(el.textContent).toContain('1 .tex · 1 .bib')
    expect(el.textContent).not.toContain('without an entry')
    await act(async () => button('Create presentation').click())
    const deck = onCreate.mock.calls[0][0]
    expect(deck).toMatchObject({ title: 'My talk', slideWidth: 960, slideHeight: 720, theme: 'white' })
    expect(deck.bibliography.map(e => e.key)).toEqual(['knuth'])
    expect(deck.slides[0].elements.some(e => /data-cite="knuth"/.test(e.content || ''))).toBe(true)
  })

  it('joins citations to the deck’s own library when adding to it', async () => {
    const onInsert = vi.fn()
    await mount({ onInsert, bibliography: [{ key: 'knuth', title: 'The TeXbook' }] })
    await typeSource(TALK)
    expect(el.textContent).not.toContain('without an entry')
    await act(async () => button('Add 2 slides').click())
    expect(onInsert.mock.calls[0][1]).toBe(null)
    expect(onInsert.mock.calls[0][0][0].elements.some(e => /data-cite="knuth"/.test(e.content || ''))).toBe(true)
  })

  it('switches to a slide per step', async () => {
    await mount({ onInsert: () => {} })
    await typeSource(TALK)
    await act(async () => {
      const select = el.querySelector('select')
      select.value = 'slides'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(el.textContent).toContain('2 of 2 frames · 3 slides')
  })
})

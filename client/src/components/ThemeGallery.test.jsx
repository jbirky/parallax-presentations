// @vitest-environment happy-dom
// The theme gallery and the layout picker
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ThemeGallery, { ThemePanel } from './ThemeGallery'
import LayoutPicker from './LayoutPicker'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, el
async function render(ui) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(ui))
}
afterEach(() => {
  act(() => root.unmount())
  el.remove()
})

describe('ThemeGallery', () => {
  it('shows each theme’s title slide in its colors, the chosen one checked', async () => {
    const onChange = vi.fn()
    await render(<ThemeGallery value="moon" onChange={onChange} />)
    const radios = [...el.querySelectorAll('[role=radio]')]
    expect(radios).toHaveLength(33)
    expect(radios.filter(r => r.getAttribute('aria-checked') === 'true').map(r => r.textContent)).toEqual(['Presentation titleSubtitleMoon'])
    const moon = radios.find(r => r.textContent.endsWith('Moon')).querySelector('.theme-swatch')
    expect(moon.style.backgroundColor).toMatch(/#002b36|rgb\(0, 43, 54\)/)
    await act(async () => radios.find(r => r.textContent.endsWith('White')).click())
    expect(onChange).toHaveBeenCalledWith('white')
  })

  it('applies a theme from the panel as it’s clicked, and closes', async () => {
    const onChange = vi.fn(), onClose = vi.fn()
    await render(<ThemePanel value="black" onChange={onChange} onClose={onClose} />)
    await act(async () => [...el.querySelectorAll('[role=radio]')].find(r => r.textContent.endsWith('Dracula')).click())
    expect(onChange).toHaveBeenCalledWith('dracula')
    await act(async () => el.querySelector('button[aria-label="Close themes"]').click())
    expect(onClose).toHaveBeenCalled()
  })
})

describe('LayoutPicker', () => {
  const layouts = {
    blank: { label: 'Blank', elements: [] },
    title: { label: 'Title Slide', elements: [{ type: 'text', placeholder: 'title', x: 60, y: 150, width: 840, height: 120, content: '<h2 style="text-align:center"></h2>' }] },
    axial: { label: 'Axial', category: 'systems', elements: [{ type: 'shape', shape: 'rect', x: 0, y: 0, width: 3, height: 400, fill: '#f472b6' }] },
  }

  it('draws the layouts with their hints, systems apart, the current one marked', async () => {
    const onPick = vi.fn()
    await render(<LayoutPicker layouts={layouts} theme="white" title="Change layout" current="title" onPick={onPick} onClose={() => {}} />)
    expect(document.querySelector('#layout-picker-title').textContent).toBe('Change layout')
    const choices = [...document.querySelectorAll('.layout-choice')]
    expect(choices.map(c => c.querySelector(':scope > span').textContent)).toEqual(['Blank', 'Title Slide', 'Axial'])
    expect(choices[1].textContent).toContain('Click to add title')
    expect(choices[1].getAttribute('aria-current')).toBe('true')
    expect(document.querySelector('.layout-picker-heading').textContent).toBe('Typographic systems')
    await act(async () => choices[2].click())
    expect(onPick).toHaveBeenCalledWith('axial')
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    await render(<LayoutPicker layouts={layouts} theme="black" title="New slide" onPick={() => {}} onClose={onClose} />)
    await act(async () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onClose).toHaveBeenCalled()
  })
})

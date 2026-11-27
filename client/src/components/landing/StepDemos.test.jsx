// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../../utils/analytics', () => ({ track: vi.fn() }))
import { PlanDemo, BuildDemo, PresentDemo, ShareDemo } from './StepDemos'
import { MiniSlide } from './TalkSlide'
import { TALK } from './PracticeDemo'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, el
afterEach(() => { act(() => root.unmount()); el.remove(); vi.useRealTimers() })

async function mount(node) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(node))
}
const button = text => [...el.querySelectorAll('button')].find(b => b.textContent === text || b.getAttribute('aria-label') === text)
const click = async b => act(async () => b.click())
// React reads an input's value through its own setter
async function type(input, value) {
  const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
  await act(async () => { set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) })
}
const key = (node, k) => act(async () => node.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })))
const pointer = (node, type, x, y) => act(async () => node.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 })))

describe('Plan', () => {
  it('adds up the minutes against the talk’s length, and keeps notes off the slide', async () => {
    await mount(<PlanDemo />)
    const plan = () => el.querySelector('.lp-sd-ol-plan').textContent
    expect(plan()).toContain('9 min planned of')
    expect(plan()).toContain('1 to spare')
    await type(el.querySelector('[aria-label="Minutes for slide 3"]'), '5.5')
    expect(plan()).toContain('11.5 min planned')
    expect(plan()).toContain('1.5 over')
    expect(el.querySelector('.lp-sd-bar .over')).not.toBeNull()
    // The section's total follows
    expect([...el.querySelectorAll('.lp-sd-ol-list .sec')].map(s => s.textContent)).toEqual(['§ Opening0.5 min', '§ The evidence7.5 min', '§ What it means3.5 min'])
    // A click on a line shows its slide, as it is
    await click(button('What’s next'))
    expect(el.querySelector('.lp-pr-slide h4').textContent).toBe('What’s next')
    // Enter makes a note after this one; Backspace on an empty one takes it away
    const notes = () => [...el.querySelectorAll('[aria-label="Note on slide 5"]')]
    expect(notes()).toHaveLength(1)
    await key(notes()[0], 'Enter')
    expect(notes()).toHaveLength(2)
    expect(document.activeElement).toBe(notes()[1])
    await type(notes()[1], 'Thank the group')
    expect(notes()[1].value).toBe('Thank the group')
    await type(notes()[1], '')
    await key(notes()[1], 'Backspace')
    expect(notes()).toHaveLength(1)
    expect(el.querySelector('.lp-pr-slide').textContent).not.toContain('Thank the group')
  })
})

describe('Build', () => {
  it('sets the LaTeX as it’s typed, numbers citations and lists them', async () => {
    await mount(<BuildDemo />)
    const eq = () => el.querySelector('.lp-sd-box.eq')
    expect(eq().querySelector('.katex')).not.toBeNull()
    expect(eq().textContent).toContain('G')
    await type(el.querySelector('#lp-sd-tex'), 'E = mc^2')
    expect(eq().querySelector('annotation').textContent).toBe('E = mc^2')
    await click(button('Cite Rubin & Ford, 1970'))
    await click(button('Cite Planck Collaboration, 2020'))
    await click(button('Cite Rubin & Ford, 1970'))
    expect([...el.querySelectorAll('.lp-sd-cite')].map(c => c.textContent)).toEqual(['[1]', '[2]', '[1]'])
    expect([...el.querySelectorAll('.lp-sd-refs li')].map(li => li.textContent)).toEqual(['[1] Rubin, V. C. & Ford, W. K. 1970, ApJ, 159, 379', '[2] Planck Collaboration 2020, A&A, 641, A6'])
    await click(button('Undo the last citation'))
    expect(el.querySelectorAll('.lp-sd-cite')).toHaveLength(2)
    // The boxes move with the arrow keys too
    expect(eq().style.left).toBe('50%')
    await key(eq(), 'ArrowRight')
    expect(eq().style.left).toBe('52%')
  })
})

describe('Present', () => {
  it('keeps ink on its slide, and lets the audience look back but not ahead', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
    await mount(<PresentDemo />)
    const ink = () => el.querySelector('.lp-sd-ink')
    await pointer(ink(), 'pointerdown', 10, 10)
    await pointer(ink(), 'pointermove', 20, 15)
    await pointer(ink(), 'pointerup', 20, 15)
    expect(ink().querySelectorAll('polyline.pen')).toHaveLength(1)
    // The laser's trail fades and isn't kept
    await click(button('Laser pointer'))
    await pointer(ink(), 'pointerdown', 5, 5)
    await pointer(ink(), 'pointerup', 5, 5)
    expect(ink().querySelectorAll('polyline.laser')).toHaveLength(1)
    await act(async () => { vi.advanceTimersByTime(800) })
    expect(ink().querySelectorAll('polyline.laser')).toHaveLength(0)

    expect(el.querySelector('.lp-sd-notes').textContent).toContain('outer stars should slow down')
    await click(button('Next slide →'))
    await click(button('Next slide →'))
    expect(ink().querySelectorAll('polyline')).toHaveLength(0)
    expect(el.querySelector('.lp-sd-notes').textContent).toContain('Planck’s number')
    // The phone joined on slide 1; it can go on to slide 3, which has been shown, and no further
    const phone = () => el.querySelector('.lp-sd-phone-nav span').textContent
    expect(phone()).toBe('1 / 3 shown')
    await click(button('Their next slide'))
    await click(button('Their next slide'))
    expect(phone()).toBe('3 / 3 shown')
    expect(button('Their next slide').disabled).toBe(true)
    // Back on slide 1, the ink is still there
    await click(button('← Previous'))
    await click(button('← Previous'))
    expect(ink().querySelectorAll('polyline.pen')).toHaveLength(1)
    await click(button('Clear slide'))
    expect(ink().querySelectorAll('polyline')).toHaveLength(0)
    expect(el.querySelector('.lp-sd-clock').textContent).toBe('0:00')
    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(el.querySelector('.lp-sd-clock').textContent).toBe('0:03')
  })
})

describe('Share', () => {
  it('makes a link, a file or a site', async () => {
    await mount(<ShareDemo />)
    await click(button('Enable Sharing'))
    expect(el.querySelector('.lp-sd-url').textContent).toContain('parallax-presentations.com/share/')
    await click(button('Disable Sharing'))
    expect(el.querySelector('.lp-sd-url')).toBeNull()
    await click([...el.querySelectorAll('.lp-sd-ways button')][1])
    await click(button('PowerPoint (.pptx)'))
    expect(el.querySelector('.lp-sd-file').textContent).toContain('LaTeX comes as images')
    await click([...el.querySelectorAll('.lp-sd-ways button')][2])
    await type(el.querySelector('[aria-label="Commit message"]'), 'Tighten the ending')
    await click(button('Push to GitHub'))
    expect(el.querySelector('.lp-sd-commits').textContent).toContain('Tighten the ending')
    expect(el.querySelector('.lp-sd-commits .lp-sd-url').textContent).toBe('you.github.io/talks/dark_matter_in_ten_minutes/presentation.html')
  })
})

describe('the sample talk’s slides', () => {
  it('opens on the hero deck’s first slide, and draws the rest in the Parallax theme', async () => {
    await mount(<>{TALK.map(s => <MiniSlide key={s.title} slide={s} />)}</>)
    const [hero, list, number] = el.querySelectorAll('.lp-mini')
    expect(hero.className).toContain('hero')
    expect(hero.querySelector('.lp-hs-field').textContent).toBe('Astronomy')
    expect(hero.querySelector('h4').textContent).toBe('Why galaxies spin too fast')
    expect(hero.textContent).toContain('Dark halo mass')
    // The two curves, from the figure's formulas at the sliders' starting values
    const curves = [...hero.querySelectorAll('svg svg path')].map(p => p.getAttribute('d'))
    expect(curves).toHaveLength(2)
    expect(curves.every(d => d.startsWith('M62.0 370.0') && d.split('L').length === 131)).toBe(true)
    expect(hero.querySelectorAll('circle[r="6"]')).toHaveLength(10)
    expect(list.querySelectorAll('li')).toHaveLength(3)
    expect(number.className).toContain('number')
    expect(number.querySelector('h4').textContent).toBe('84%')
  })
})

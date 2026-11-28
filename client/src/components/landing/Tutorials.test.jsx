// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

vi.mock('../../utils/analytics', () => ({ track: vi.fn() }))
import { track } from '../../utils/analytics'
import { TutorialList, TutorialPage } from './Tutorials'
import { TUTORIALS } from '../../tutorials/catalog'
import SHOTS from '../../tutorials/shots.json'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../public')

let root, el
afterEach(() => { if (root) act(() => root.unmount()); el?.remove(); root = el = null })

async function mount(node) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(node))
  return el
}
const tryIt = from => <a className="try" href="/try" data-from={from}>Try it</a>

describe('the tutorials and their shots', () => {
  // capture.py writes the shots and where their pins sit; the catalog names
  // them, so a step changed in one and not the other shows here
  it('has a shot for every step, with every pin the step explains', () => {
    for (const t of TUTORIALS) {
      expect(t.steps.length).toBeGreaterThan(0)
      expect(t.steps.some(s => s.shot === t.cover)).toBe(true)
      for (const step of t.steps) {
        const meta = SHOTS[`${t.slug}/${step.shot}`]
        expect(meta, `${t.slug}/${step.shot} in shots.json`).toBeTruthy()
        expect(fs.existsSync(path.join(PUBLIC, 'tutorials', t.slug, `${step.shot}.webp`)), `${t.slug}/${step.shot}.webp`).toBe(true)
        for (const id of Object.keys(step.pins || {})) {
          const box = meta.pins[id]
          expect(box, `pin ${id} on ${t.slug}/${step.shot}`).toHaveLength(4)
          // On the shot, give or take its outline
          const [x, y, w, h] = box
          expect(x).toBeGreaterThanOrEqual(-1)
          expect(y).toBeGreaterThanOrEqual(-1)
          expect(x + w).toBeLessThanOrEqual(101)
          expect(y + h).toBeLessThanOrEqual(101)
        }
      }
    }
  })

  it('has no shots the catalog doesn’t show', () => {
    const shown = new Set(TUTORIALS.flatMap(t => t.steps.map(s => `${t.slug}/${s.shot}`)))
    expect(Object.keys(SHOTS).filter(k => !shown.has(k))).toEqual([])
  })

  it('names each tutorial once, in American spelling', () => {
    expect(new Set(TUTORIALS.map(t => t.slug)).size).toBe(TUTORIALS.length)
    const words = JSON.stringify(TUTORIALS)
    expect(words).not.toMatch(/\b(colour|centre|grey|organis|customis|favourite|behaviour)/i)
  })
})

describe('the list of tutorials', () => {
  it('shows a card for each, leading to it', async () => {
    track.mockClear()
    await mount(<TutorialList onDocs={() => {}} />)
    const cards = [...el.querySelectorAll('.lp-tut-card')]
    expect(cards.map(c => c.getAttribute('href'))).toEqual(TUTORIALS.map(t => `#tutorials/${t.slug}`))
    expect(cards[0].querySelector('img').getAttribute('src')).toBe(`/tutorials/${TUTORIALS[0].slug}/${TUTORIALS[0].cover}.webp`)
    expect(cards[0].textContent).toContain(`${TUTORIALS[0].steps.length} steps`)
    await act(async () => cards[1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
    expect(track).toHaveBeenLastCalledWith('open-tutorial', { tutorial: TUTORIALS[1].slug, from: 'list' })
  })

  it('leads to the docs for the rest', async () => {
    const onDocs = vi.fn()
    await mount(<TutorialList onDocs={onDocs} />)
    await act(async () => el.querySelector('.lp-tut-more button').click())
    expect(onDocs).toHaveBeenCalled()
  })
})

describe('a tutorial', () => {
  const t = TUTORIALS[0]

  it('shows each step with its screenshot, its pins and what they point at', async () => {
    await mount(<TutorialPage slug={t.slug} tryIt={tryIt} />)
    expect(el.querySelector('h2').textContent).toBe(t.title)
    expect(el.querySelector('.try').dataset.from).toBe(`tutorial-${t.slug}`)
    const steps = [...el.querySelectorAll('.lp-tut-step')]
    expect(steps).toHaveLength(t.steps.length)
    const first = steps[0]
    expect(first.querySelector('h3').textContent).toBe(`Step 1: ${t.steps[0].title}`)
    expect(first.querySelector('img').getAttribute('src')).toBe(`/tutorials/${t.slug}/${t.steps[0].shot}.webp`)
    const pins = Object.keys(t.steps[0].pins)
    expect([...first.querySelectorAll('.lp-tut-pin b')].map(b => b.textContent)).toEqual(pins.map((_, i) => String(i + 1)))
    expect([...first.querySelectorAll('.lp-tut-legend li span')].map(s => s.textContent)).toEqual(Object.values(t.steps[0].pins))
    // The way to the tool, a part at a time
    expect([...first.querySelectorAll('.lp-tut-where kbd')].map(k => k.textContent)).toEqual(t.steps[0].where)
    // A pin's box sits where capture.py measured it
    const [x, y] = SHOTS[`${t.slug}/${t.steps[0].shot}`].pins[pins[0]]
    expect(first.querySelector('.lp-tut-pin').style.left).toBe(`${x}%`)
    expect(first.querySelector('.lp-tut-pin').style.top).toBe(`${y}%`)
  })

  it('points a pin out from its line in the list, and the line from its pin', async () => {
    await mount(<TutorialPage slug={t.slug} tryIt={tryIt} />)
    const step = el.querySelector('.lp-tut-step')
    const line = step.querySelectorAll('.lp-tut-legend li')[1]
    await act(async () => line.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
    expect(step.querySelectorAll('.lp-tut-pin')[1].classList.contains('on')).toBe(true)
    await act(async () => line.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })))
    expect(step.querySelector('.lp-tut-pin.on')).toBeNull()
    await act(async () => step.querySelectorAll('.lp-tut-pin')[2].dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
    expect(step.querySelectorAll('.lp-tut-legend li')[2].classList.contains('on')).toBe(true)
  })

  it('lists its steps to jump to, and ends with the docs and the next tutorial', async () => {
    await mount(<TutorialPage slug={t.slug} tryIt={tryIt} />)
    expect([...el.querySelectorAll('.lp-tut-nav button')].map(b => b.textContent)).toEqual(t.steps.map((s, i) => `${String(i + 1).padStart(2, '0')}${s.title}`))
    expect([...el.querySelectorAll('.lp-tut-end ul a')].map(a => a.getAttribute('href'))).toEqual(t.docs.map(([, page]) => `#docs/${page}`))
    expect(el.querySelector('.lp-tut-end .lp-tut-card').getAttribute('href')).toBe(`#tutorials/${TUTORIALS[1].slug}`)
  })

  it('opens a screenshot full size, and steps through them there', async () => {
    HTMLDialogElement.prototype.showModal ||= function () { this.open = true }
    HTMLDialogElement.prototype.close ||= function () { this.open = false }
    await mount(<TutorialPage slug={t.slug} tryIt={tryIt} />)
    await act(async () => el.querySelectorAll('.lp-tut-zoom')[1].click())
    const dialog = el.querySelector('.lp-tut-zoomed')
    expect(dialog.querySelector('h3').textContent).toBe(t.steps[1].title)
    await act(async () => dialog.querySelector('[aria-label="Next step"]').click())
    expect(dialog.querySelector('h3').textContent).toBe(t.steps[2].title)
    await act(async () => dialog.querySelector('[aria-label="Close"]').click())
    expect(dialog.querySelector('h3')).toBeNull()
  })

  it('says so when there’s no such tutorial', async () => {
    await mount(<TutorialPage slug="nope" tryIt={tryIt} />)
    expect(el.querySelector('.lp-empty a').getAttribute('href')).toBe('#tutorials')
  })
})

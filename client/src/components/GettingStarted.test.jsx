// @vitest-environment happy-dom
// The getting-started checklist: steps that tick themselves, a card that can
// be closed for good and brought back
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import GettingStarted from './GettingStarted'
import { tickStep, dismissChecklist, reopenChecklist, readChecklist, showChecklist, rememberDeckCount, resetChecklistForTests, FIRST_DECKS } from '../utils/gettingStarted'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, el
async function render(props = {}) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<GettingStarted {...props} />))
}
beforeEach(() => {
  localStorage.clear()
  resetChecklistForTests()
})
afterEach(() => {
  if (root) { act(() => root.unmount()); el.remove(); root = null }
})

describe('the checklist', () => {
  it('shows on a first deck, and not for someone with many, until it’s brought back', () => {
    expect(showChecklist(readChecklist())).toBe(true)
    rememberDeckCount(FIRST_DECKS + 5)
    expect(showChecklist(readChecklist())).toBe(false)
    expect(showChecklist(readChecklist(), { guest: true })).toBe(true)
    reopenChecklist()
    expect(showChecklist(readChecklist())).toBe(true)
    dismissChecklist()
    expect(showChecklist(readChecklist(), { guest: true })).toBe(false)
  })

  it('keeps what’s done in this browser', () => {
    tickStep('slide')
    tickStep('nonsense')
    resetChecklistForTests()
    expect(readChecklist().done).toEqual({ slide: true })
  })
})

describe('GettingStarted', () => {
  it('lists five steps that tick as they’re done, and does the ones that aren’t', async () => {
    const onStep = vi.fn()
    await render({ onStep })
    const steps = () => [...el.querySelectorAll('li button')]
    expect(steps().map(b => b.textContent)).toEqual(['Pick a theme', 'Add a slide', 'Add an image', 'Add speaker notes', 'Present'])
    expect(el.textContent).toContain('0 of 5')
    await act(async () => steps()[2].click())
    expect(onStep).toHaveBeenCalledWith('image')
    await act(async () => tickStep('theme'))
    expect(el.textContent).toContain('1 of 5')
    expect(steps()[0].disabled).toBe(true)
    expect(steps()[0].getAttribute('aria-label')).toBe('Pick a theme, done')
  })

  it('says so when all five are done, and closes for good', async () => {
    await render()
    await act(async () => ['theme', 'slide', 'image', 'notes', 'present'].forEach(tickStep))
    expect(el.textContent).toContain('You’re all set')
    await act(async () => el.querySelector('button[aria-label="Close the checklist"]').click())
    expect(readChecklist().dismissed).toBe(true)
  })
})

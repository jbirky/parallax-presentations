import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import AnimationTimeline from './AnimationTimeline'

describe('the animation timeline', () => {
  it('shows the steps at which elements change state, with the fragments', () => {
    const slide = { elements: [
      { id: 'a', type: 'shape', shape: 'circle', fragment: true, fragmentIndex: 1 },
      { id: 'b', type: 'shape', shape: 'star', states: [{ id: 'st', name: 'Big' }], stateSteps: { 1: 'st', 3: null } },
    ] }
    const html = renderToStaticMarkup(<AnimationTimeline slide={slide} onUpdateElement={() => {}} onClose={() => {}} />)
    const steps = [...html.matchAll(/timeline-step-label">([^<]+)</g)].map(m => m[1])
    expect(steps).toEqual(['Initial', 'Step 1', 'Step 3'])
    expect(html).toContain('◆ star → Big')
    expect(html).toContain('◆ star → Default')
  })
})

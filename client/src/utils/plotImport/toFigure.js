// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A figure kept as it is: its base and its layers (splitSvg.js) as image
// elements stacked on the slide in one group, each layer hidden until the
// step it appears at and from the step it leaves at, with the states and
// state steps any element has (clickActions.js: a hidden state at opacity
// 0, its initialState, its stateSteps).

import { IMPORT_WIDTH } from './toGraph'

const HIDDEN = { id: 'hidden', name: 'Hidden', opacity: 0, duration: 300, easing: 'ease' }

// urls: { base, [layer id]: url }; choices as plotToGraph takes them. The
// elements, in drawing order, to put at x, y
export function figureElements(plot, urls, { choices = {}, x = 0, y = 0, width = IMPORT_WIDTH, height, newId = () => crypto.randomUUID() } = {}) {
  const h = Math.round(height || width * (plot.size.height / plot.size.width || 0.7))
  const groupId = newId()
  const box = { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: h }
  const image = (src, alt, z) => ({ id: newId(), type: 'image', ...box, zIndex: z, src, objectFit: 'contain', alt, groupId })
  const out = [image(urls.base, 'The figure, without the layers that come and go', 2)]
  plot.layers.forEach((layer, i) => {
    const choice = choices[layer.id] || {}
    if (choice.include === false || !urls[layer.id]) return
    const el = image(urls[layer.id], choice.name || layer.name, 3 + i)
    el.name = choice.name || layer.name
    const step = choice.step > 0 ? choice.step : 0
    const until = choice.until > step ? choice.until : 0
    if (step || until) {
      el.states = [{ ...HIDDEN }]
      el.stateSteps = {}
      if (step) { el.initialState = 'hidden'; el.stateSteps[step] = null }
      if (until) el.stateSteps[until] = 'hidden'
    }
    out.push(el)
  })
  return out
}

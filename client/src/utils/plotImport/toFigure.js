// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A figure kept as it is: the pieces it's cut into (splitSvg.js, splitPdf.js)
// as image elements stacked on the slide in one group, each layer's hidden
// until the step it appears at and from the step it leaves at, with the
// states and state steps any element has (clickActions.js: a hidden state
// at opacity 0, its initialState, its stateSteps).
//
// matplotlib draws the layers in among each other and among the rest: the
// legend over the data, a line between one series' error bars and its
// markers. So a figure is cut, in the order it's drawn, into runs: what one
// layer draws, or what no layer does, until another takes over. Stacked in
// that order the pieces are the figure as it was drawn, and a layer can be
// more than one piece, all of them coming and going together. A layer's
// legend entry is part of it (plotModel.js), and the legend's frame is a
// part of its own ('legend'), showing while any entry does.
//
// Each element keeps what it came from (figure: { id, src, file, plan,
// part, run, sig }), so the figure can be opened again (readFigure): src is
// the file it was cut from, part 'base', 'legend' or a layer's id, sig a
// layer's kind and color, to know it again if the file reads into layers in
// another order.

import { IMPORT_WIDTH } from './toGraph'

const HIDDEN = { id: 'hidden', name: 'Hidden', opacity: 0, duration: 300, easing: 'ease' }

// Runs of one part in what's drawn, in order: parts has each drawn thing's
// part. [{ part, run, from, to, size }]; run counts a part's runs from 0
export function runsOf(parts) {
  const runs = [], count = {}
  parts.forEach((part, i) => {
    const last = runs[runs.length - 1]
    if (last && last.part === part) { last.to = i; last.size++; return }
    count[part] = count[part] || 0
    runs.push({ part, run: count[part]++, from: i, to: i, size: 1 })
  })
  return runs
}

// The runs in short: pieces cut before can stand in for new ones only where
// a figure is cut the same way
export const planOf = runs => runs.map(r => `${r.part}:${r.size}`).join(' ')

export const pieceKey = p => `${p.part}:${p.run || 0}`

// What a figure is cut by: the legend's own part (its frame, and what else
// of it no layer has) first, then the layers, whose entries are theirs.
// kind: 'svg' (cut by groups) or 'pdf' (by operators)
export function partsOf(plot, kind) {
  const legend = plot.legend && (kind === 'svg' ? plot.legend.groups?.length : plot.legend.ops?.length) ? [{ id: 'legend', ...plot.legend }] : []
  return [...legend, ...plot.layers]
}
const sigOf = layer => `${layer.kind}|${layer.color}`
const ALWAYS = new Set(['base', 'legend'])

// A layer's steps, as chosen: { step, until }, 0 for none
function stepsOf(choice = {}) {
  const step = choice.step > 0 ? choice.step : 0
  return { step, until: choice.until > step ? choice.until : 0 }
}

// The legend's frame: from the step its first entry comes until its last
// leaves (if they all do); null, always there, when no layer has an entry
function legendSteps(plot, choices) {
  const own = plot.layers.filter(l => l.legend != null && choices[l.id]?.include !== false).map(l => stepsOf(choices[l.id]))
  if (!own.length) return null
  const step = Math.min(...own.map(s => s.step))
  const until = own.every(s => s.until) ? Math.max(...own.map(s => s.until)) : 0
  return { step, until: until > step ? until : 0 }
}

// A hidden state and the steps it comes and goes at, on an element
function setSteps(el, { step, until }) {
  delete el.states; delete el.stateSteps; delete el.initialState
  if (!step && !until) return
  el.states = [{ ...HIDDEN }]
  el.stateSteps = {}
  if (step) { el.initialState = 'hidden'; el.stateSteps[step] = null }
  if (until) el.stateSteps[until] = 'hidden'
}

// pieces: [{ part, run, url }], in drawing order, without the layers left
// out. meta: { id, src, file, plan }. reuse, box, groupId, z: what the
// figure was before, when it's made again (readFigure). The elements, at box
export function figureElements(plot, pieces, { choices = {}, meta = {}, reuse = new Map(), box, groupId, z = 2, width = IMPORT_WIDTH, newId = () => crypto.randomUUID() } = {}) {
  const b = box || { x: 0, y: 0, width: Math.round(width), height: Math.round(width * (plot.size.height / plot.size.width || 0.7)) }
  const group = groupId || newId()
  const figureId = meta.id || newId()
  const layers = new Map(plot.layers.map(l => [l.id, l]))
  const legend = legendSteps(plot, choices)
  return pieces.map((p, k) => {
    const layer = layers.get(p.part)
    const choice = (layer && choices[layer.id]) || {}
    const name = layer ? (choice.name || layer.name) : p.part === 'legend' ? 'Legend' : 'Figure'
    const run = p.run || 0
    const fresh = {
      type: 'image', x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height),
      zIndex: z + k, src: p.url, objectFit: 'contain', groupId: group,
      name: run ? `${name}, part ${run + 1}` : name,
      alt: layer ? name : p.part === 'legend' ? 'The figure’s legend' : run ? 'Part of the figure drawn over its layers' : 'The figure, without the layers that come and go',
      figure: { ...meta, id: figureId, part: p.part, run, ...(layer ? { sig: sigOf(layer) } : {}) },
    }
    const old = reuse.get(pieceKey(p))
    const el = old ? { ...old, ...fresh } : { id: newId(), ...fresh }
    // A layer's states, and the legend's, are the figure's to set
    if (layer) setSteps(el, stepsOf(choice))
    else if (p.part === 'legend') setSteps(el, legend || { step: 0, until: 0 })
    return el
  })
}

// What a figure's elements say of it, against its plot read again from its
// file: the choices it was made with (a layer's steps from its states, its
// name from its element), its elements by piece key (to keep their ids, and
// their images where the figure is cut the same way), and its place.
// null for elements that aren't a figure's
export function readFigure(elements, plot) {
  const els = (elements || []).filter(e => e.figure)
  if (!els.length) return null
  const meta = els[0].figure
  // Each layer's elements, to the layer read again: the same id and look,
  // else the same look
  const parts = new Map([...ALWAYS].map(p => [p, p]))
  const taken = new Set()
  for (const part of new Set(els.map(e => e.figure.part))) {
    if (ALWAYS.has(part)) continue
    const sig = els.find(e => e.figure.part === part).figure.sig
    const free = l => !taken.has(l.id) && sigOf(l) === sig
    const layer = plot.layers.find(l => l.id === part && free(l)) || plot.layers.find(free)
    if (layer) { parts.set(part, layer.id); taken.add(layer.id) }
  }
  const reuse = new Map()
  for (const e of els) {
    const part = parts.get(e.figure.part)
    if (part) reuse.set(pieceKey({ part, run: e.figure.run }), e)
  }
  const choices = {}
  for (const layer of plot.layers) {
    const el = reuse.get(pieceKey({ part: layer.id, run: 0 }))
    if (!el) { choices[layer.id] = { include: false, name: layer.name, step: 0, until: 0 }; continue }
    const steps = el.stateSteps || {}
    const first = v => Number(Object.keys(steps).filter(k => steps[k] === v).sort((a, b) => a - b)[0]) || 0
    const step = el.initialState === 'hidden' ? first(null) : 0
    const until = first('hidden')
    choices[layer.id] = { include: true, name: el.name || layer.name, step, until: until > step ? until : 0 }
  }
  const base = reuse.get('base:0') || els[0]
  return {
    choices, reuse,
    plan: meta.plan || '',
    meta: { id: meta.id, src: meta.src, file: meta.file },
    box: { x: base.x, y: base.y, width: base.width, height: base.height },
    groupId: base.groupId || null,
    z: Math.min(...els.map(e => e.zIndex ?? 2)),
    ids: els.map(e => e.id),
  }
}

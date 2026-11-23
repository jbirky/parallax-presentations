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
// clear, dark, labels, part, run, sig, name, label, steps, shown, color }),
// so the figure can be opened again (readFigure): src is the file it was cut
// from; clear, that it was cut with its backgrounds left out (transparent);
// dark, that it was made for a dark slide (white text and lines); labels, the
// titles' and axis labels' words changed ({ [id]: words }); color, a
// layer's, when it was given one of its own (recolorOf); part 'base', a
// legend's ('legend', or a panel's 'p2-legend'), a panel's id or a layer's;
// sig a layer's kind and color, to know it again if the file reads into
// layers in another order.
//
// A figure of several panels (plot.panels) has a part for each: a panel
// comes and goes as a whole, and a layer shows only while its panel does.

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

// The runs to make pieces of: not one left with nothing to draw (empty: it
// drew only a background, left clear), unless it's all a panel or a layer
// has, so the part is still there to come and go
export const keptRuns = runs => runs.filter(r => !r.empty || (r.part !== 'base' && !runs.some(q => q.part === r.part && !q.empty)))

// A figure's layers: every panel's, in a figure of several
export const figureLayers = plot => (plot.panels ? plot.panels.flatMap(p => p.layers) : plot.layers)

// What a figure is cut by, the broadest first, as what comes later in the
// list takes what it draws from what came before: in a figure of several
// panels, each panel (an inset after the one it's in); a legend's own part
// (its frame, and what else of it no layer has); then the layers, whose
// legend entries are theirs. kind: 'svg' (cut by groups) or 'pdf' (by
// operators)
export function partsOf(plot, kind) {
  const has = part => !!part && !!(kind === 'svg' ? part.groups?.length : part.ops?.length)
  // A legend of the figure's own: its frame, then each entry
  const fl = plot.figureLegend
  const outer = fl ? [
    ...(has(fl) ? [{ id: 'figure-legend', groups: fl.groups, ops: fl.ops }] : []),
    ...fl.entries.map((e, k) => ({ id: `figure-legend-${k + 1}`, groups: e.groups, ops: e.ops })).filter(has),
  ] : []
  if (!plot.panels) return [...(has(plot.legend) ? [{ id: 'legend', ...plot.legend }] : []), ...outer, ...plot.layers]
  return [
    ...plot.panels.filter(has).map(p => ({ id: p.id, groups: p.groups, ops: p.ops })),
    ...plot.panels.filter(p => has(p.legend)).map(p => ({ id: `${p.id}-legend`, ...p.legend })),
    ...outer,
    ...figureLayers(plot),
  ]
}

// The parts that draw data: the layers, and a figure legend's entries (whose
// samples are the layers'), which keep their colors on a dark slide
export const dataPartsOf = plot => new Set([...figureLayers(plot).map(l => l.id), ...(plot.figureLegend?.entries || []).map((e, k) => `figure-legend-${k + 1}`)])

// A figure legend's entry: its part's index (figure-legend-2 → 1), else -1
export const figureLegendEntry = part => { const m = /^figure-legend-(\d+)$/.exec(part); return m ? Number(m[1]) - 1 : -1 }
// A layer known again: its kind and color (and its panel, of several)
const sigOf = layer => (layer.panel ? `${layer.panel}|` : '') + `${layer.kind}|${layer.color}`

const NONE = { step: 0, until: 0 }
const NEVER = { step: 0, until: 0, never: true }

// A layer's or a panel's steps, as chosen: { step, until }, 0 for none
function stepsOf(choice = {}) {
  const step = choice.step > 0 ? choice.step : 0
  return { step, until: choice.until > step ? choice.until : 0 }
}

// Shown while both are: a layer within its panel
function meet(a, b) {
  if (a.never || b.never) return NEVER
  const step = Math.max(a.step, b.step)
  const until = a.until && b.until ? Math.min(a.until, b.until) : a.until || b.until
  return until && until <= step ? NEVER : { step, until }
}

// While any of them shows: from the first to come until the last to go (if
// they all do); null for none
function anyOf(list) {
  const own = list.filter(st => !st.never)
  if (!own.length) return null
  const step = Math.min(...own.map(st => st.step))
  const until = own.every(st => st.until) ? Math.max(...own.map(st => st.until)) : 0
  return { step, until: until > step ? until : 0 }
}

// Every part's steps: a panel's (within the one an inset is in), a layer's
// within its panel's (never, left out), a legend's frame while its entries
// show, within its panel's (always there, with no layer of its own), and a
// figure legend's entry while any layer it names shows
export function partSteps(plot, choices) {
  const steps = new Map()
  const panels = plot.panels || []
  const byId = new Map(panels.map(p => [p.id, p]))
  const chosen = id => (choices[id]?.include === false ? NEVER : stepsOf(choices[id]))
  const panelSteps = p => meet(chosen(p.id), p.parent && byId.has(p.parent) ? panelSteps(byId.get(p.parent)) : NONE)
  for (const p of panels) steps.set(p.id, panelSteps(p))
  for (const l of figureLayers(plot)) steps.set(l.id, meet(chosen(l.id), steps.get(l.panel) || NONE))
  const frame = (layers, within) => {
    const shown = anyOf(layers.filter(l => l.legend != null).map(l => steps.get(l.id)))
    return shown ? meet(shown, within) : within
  }
  if (panels.length) for (const p of panels) steps.set(`${p.id}-legend`, frame(p.layers, steps.get(p.id)))
  else steps.set('legend', frame(plot.layers, NONE))
  const fl = plot.figureLegend
  if (fl) {
    const entries = fl.entries.map(e => anyOf(e.layers.map(id => steps.get(id) || NEVER)) || NEVER)
    entries.forEach((st, k) => steps.set(`figure-legend-${k + 1}`, st))
    steps.set('figure-legend', fl.entries.length ? anyOf(entries) || NEVER : NONE)
  }
  return steps
}

// A hidden state and the steps it comes and goes at, on an element
function setSteps(el, st) {
  delete el.states; delete el.stateSteps; delete el.initialState
  if (!st.never && !st.step && !st.until) return
  el.states = [{ ...HIDDEN }]
  el.stateSteps = {}
  if (st.never) { el.initialState = 'hidden'; return }
  if (st.step) { el.initialState = 'hidden'; el.stateSteps[st.step] = null }
  if (st.until) el.stateSteps[st.until] = 'hidden'
}

// The steps an element's states show it at
function shownBy(el) {
  const steps = el.stateSteps || {}
  const first = v => Number(Object.keys(steps).filter(k => steps[k] === v).sort((a, b) => a - b)[0]) || 0
  const hidden = el.initialState === 'hidden'
  const step = hidden ? first(null) : 0
  if (hidden && !step) return NEVER
  const until = first('hidden')
  return { step, until: until > step ? until : 0 }
}
const same = (a, b) => !!a && !!b && !!a.never === !!b.never && (!!a.never || (a.step === b.step && a.until === b.until))

// The parts to draw in a color of their own: a layer given one (choices[id].
// color, other than the figure's), and a figure legend's entry when every
// layer it names that's in the figure is now drawn in the same one.
// Map(part → { from, to }), colors as #rrggbb
export function recolorOf(plot, choices = {}) {
  const out = new Map()
  const all = figureLayers(plot)
  const given = l => { const c = String(choices[l.id]?.color || '').toLowerCase(); return /^#[0-9a-f]{6}$/.test(c) && c !== l.color.toLowerCase() ? c : null }
  for (const l of all) { const to = given(l); if (to) out.set(l.id, { from: l.color.toLowerCase(), to }) }
  plot.figureLegend?.entries.forEach((e, k) => {
    const named = e.layers.map(id => all.find(l => l.id === id)).filter(l => l && choices[l.id]?.include !== false)
    const now = new Set(named.map(l => given(l) || l.color.toLowerCase()))
    const to = now.size === 1 ? [...now][0] : null
    if (to && to !== named[0].color.toLowerCase()) out.set(`figure-legend-${k + 1}`, { from: named[0].color.toLowerCase(), to })
  })
  return out
}

// pieces: [{ part, run, url }], in drawing order, without the parts left
// out. meta: { id, src, file, plan, clear, dark, labels }. reuse, box, groupId, z: what the
// figure was before, when it's made again (readFigure). The elements, at box.
// A layer's and a panel's elements keep the name and steps chosen (name,
// steps) and what they were given (label, shown), to read them back as
// chosen unless they've been changed since
export function figureElements(plot, pieces, { choices = {}, meta = {}, reuse = new Map(), box, groupId, z = 2, width = IMPORT_WIDTH, newId = () => crypto.randomUUID() } = {}) {
  const b = box || { x: 0, y: 0, width: Math.round(width), height: Math.round(width * (plot.size.height / plot.size.width || 0.7)) }
  const group = groupId || newId()
  const figureId = meta.id || newId()
  const layers = new Map(figureLayers(plot).map(l => [l.id, l]))
  const panels = new Map((plot.panels || []).map(p => [p.id, p]))
  const steps = partSteps(plot, choices)
  const recolor = recolorOf(plot, choices)
  const nameOf = it => choices[it.id]?.name || it.name
  return pieces.map((p, k) => {
    const layer = layers.get(p.part)
    const panel = panels.get(p.part)
    const legendIn = /-legend$/.test(p.part) ? panels.get(p.part.replace(/-legend$/, '')) || null : null
    const entry = plot.figureLegend?.entries[figureLegendEntry(p.part)]
    const outer = p.part === 'figure-legend' || !!entry
    const legend = p.part === 'legend' || !!legendIn || outer
    const own = layer || panel
    const run = p.run || 0
    const name = own ? nameOf(own) : entry ? `Figure legend: ${entry.label}` : outer ? 'Figure legend' : legend ? 'Legend' : 'Figure'
    // Of several panels, a layer's and a legend's say whose
    const home = (layer && panels.get(layer.panel)) || legendIn
    const label = (run ? `${name}, part ${run + 1}` : name) + (home ? ` · ${nameOf(home)}` : '')
    const shown = steps.get(p.part) || NONE
    const fresh = {
      type: 'image', x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height),
      zIndex: z + k, src: p.url, objectFit: 'contain', groupId: group, name: label,
      alt: layer ? name : panel ? `The figure’s ${name}` : legend ? 'The figure’s legend' : run ? 'Part of the figure drawn over its layers' : 'The figure, without the layers that come and go',
      figure: {
        ...meta, id: figureId, part: p.part, run,
        ...(layer ? { sig: sigOf(layer) } : {}),
        ...(own ? { name, label, steps: stepsOf(choices[own.id]), shown } : {}),
        ...(layer && recolor.has(layer.id) ? { color: recolor.get(layer.id).to } : {}),
      },
    }
    const old = reuse.get(pieceKey(p))
    const el = old ? { ...old, ...fresh } : { id: newId(), ...fresh }
    // A layer's states, a panel's and a legend's, are the figure's to set
    if (own || legend) setSteps(el, shown)
    return el
  })
}

// A figure put on a slide whole (dropped there), not yet cut: one image of
// it (url), with the file it can be cut from (meta: { src, file }), its
// part 'whole'. Opened again, it's cut as chosen (readFigure: whole)
export function wholeFigure(plot, { url, meta = {}, x = 0, y = 0, width = IMPORT_WIDTH, zIndex = 2, newId = () => crypto.randomUUID() } = {}) {
  const height = Math.round(width * (plot.size.height / plot.size.width || 0.7))
  return {
    id: newId(), type: 'image', x: Math.round(x), y: Math.round(y), width: Math.round(width), height, zIndex,
    src: url, objectFit: 'contain', name: 'Figure', alt: 'A figure, whose layers can be made to come and go (right-click it)',
    figure: { ...meta, id: newId(), plan: '', part: 'whole', run: 0 },
  }
}

// What a figure's elements say of it, against its plot read again from its
// file: the choices it was made with (as chosen, or as its elements show
// them if they've been changed since), its elements by piece key (to keep
// their ids, and their images where the figure is cut the same way), and its
// place. null for elements that aren't a figure's
export function readFigure(elements, plot) {
  const els = (elements || []).filter(e => e.figure)
  if (!els.length) return null
  const meta = els[0].figure
  // Not cut yet: nothing chosen, its place its one image's
  const whole = els.find(e => e.figure.part === 'whole')
  if (whole) {
    return {
      whole: true, choices: null, reuse: new Map(), plan: '',
      meta: { id: meta.id, src: meta.src, file: meta.file, clear: !!meta.clear, dark: !!meta.dark, labels: { ...(meta.labels || {}) } },
      box: { x: whole.x, y: whole.y, width: whole.width, height: whole.height },
      groupId: whole.groupId || null, z: whole.zIndex ?? 2, ids: els.map(e => e.id),
    }
  }
  const all = figureLayers(plot)
  // Each layer's elements, to the layer read again: the same id and look,
  // else the same look; the rest (the base, panels, legends) as they were
  const parts = new Map()
  const taken = new Set()
  for (const part of new Set(els.map(e => e.figure.part))) {
    const sig = els.find(e => e.figure.part === part).figure.sig
    if (!sig) { parts.set(part, part); continue }
    const free = l => !taken.has(l.id) && sigOf(l) === sig
    const layer = all.find(l => l.id === part && free(l)) || all.find(free)
    if (layer) { parts.set(part, layer.id); taken.add(layer.id) }
  }
  const reuse = new Map()
  for (const e of els) {
    const part = parts.get(e.figure.part)
    if (part) reuse.set(pieceKey({ part, run: e.figure.run }), e)
  }
  const choices = {}
  // A part's first piece (a panel's first run may have been only its
  // background, left clear)
  const firstOf = id => reuse.get(pieceKey({ part: id, run: 0 })) || els.filter(e => parts.get(e.figure.part) === id).sort((a, b) => a.figure.run - b.figure.run)[0]
  for (const it of [...(plot.panels || []), ...all]) {
    const el = firstOf(it.id)
    if (!el) { choices[it.id] = { include: false, name: it.name, step: 0, until: 0 }; continue }
    const f = el.figure
    const st = f.steps && same(shownBy(el), f.shown) ? f.steps : shownBy(el)
    const name = f.label != null && el.name === f.label ? f.name : el.name
    choices[it.id] = { include: true, name: name || it.name, step: st.step, until: st.until > st.step ? st.until : 0, ...(f.color ? { color: f.color } : {}) }
  }
  const base = reuse.get('base:0') || els[0]
  return {
    choices, reuse,
    plan: meta.plan || '',
    meta: { id: meta.id, src: meta.src, file: meta.file, clear: !!meta.clear, dark: !!meta.dark, labels: { ...(meta.labels || {}) } },
    box: { x: base.x, y: base.y, width: base.width, height: base.height },
    groupId: base.groupId || null,
    z: Math.min(...els.map(e => e.zIndex ?? 2)),
    ids: els.map(e => e.id),
  }
}

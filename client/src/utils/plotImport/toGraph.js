// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// An imported plot (plotModel.js) as a Graph element and the dataset it
// plots: a column for each layer's x, y and error bars, and a data line for
// each layer, in its color, at the step it appears and the step it leaves.
// Numbers are written as JavaScript prints them, which reads back as the
// same number.

import { newExpressionId } from '../graphPage'

// The graph element's width; its height keeps the figure's shape
export const IMPORT_WIDTH = 560
const POINT_SIZES = [1.5, 2, 3, 4.5, 6]

// Column names from a layer's name: measured → measured_x, measured_y
function columnBase(name, taken) {
  let base = String(name || 'layer').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'layer'
  if (/^\d/.test(base)) base = `l_${base}`
  let out = base
  for (let n = 2; taken.has(out); n++) out = `${base}_${n}`
  taken.add(out)
  return out
}

const cell = v => (v === null || v === undefined || !isFinite(v) ? '' : String(v))

// choices: { [layer id]: { include, name, step, until } }. Returns the CSV,
// the graph's fields and its size on the slide
export function plotToGraph(plot, { datasetName, choices = {}, dark = false } = {}) {
  const taken = new Set()
  const columns = []
  const expressions = []
  // Figure points to the graph's pixels, roughly: the plot area fills most of the element
  const scale = (IMPORT_WIDTH - 60) / Math.max(1, plot.axes.box.x1 - plot.axes.box.x0)
  for (const layer of plot.layers) {
    const choice = choices[layer.id] || {}
    if (choice.include === false) continue
    const name = (choice.name ?? layer.name) || layer.name
    const base = columnBase(name, taken)
    const col = suffix => `${base}_${suffix}`
    const data = { dataset: datasetName, x: col('x'), y: col('y'), mark: layer.kind, opacity: 1 }
    columns.push([col('x'), layer.data.x], [col('y'), layer.data.y])
    if (layer.data.x2) { data.x2 = col('x2'); columns.push([col('x2'), layer.data.x2]) }
    if (layer.data.yErr) { data.yErr = col('yerr'); columns.push([col('yerr'), layer.data.yErr]) }
    if (layer.data.xErr) { data.xErr = col('xerr'); columns.push([col('xerr'), layer.data.xErr]) }
    if (layer.kind === 'points') {
      const r = (layer.size || 6) / 2 * scale
      data.size = POINT_SIZES.reduce((best, s) => (Math.abs(s - r) < Math.abs(best - r) ? s : best), POINT_SIZES[0])
    }
    const ex = { id: newExpressionId(), color: layer.color, data }
    if (layer.kind === 'line') {
      ex.width = Math.max(0.5, Math.min(12, Math.round((layer.width || 1.5) * scale * 2) / 2))
      if (layer.style && layer.style !== 'solid') ex.style = layer.style
    }
    if (choice.step > 0) ex.step = choice.step
    if (choice.until > 0 && (!(choice.step > 0) || choice.until > choice.step)) ex.until = choice.until
    expressions.push(ex)
  }

  const rows = Math.max(0, ...columns.map(([, v]) => v.length))
  const lines = [columns.map(([n]) => n).join(',')]
  for (let i = 0; i < rows; i++) lines.push(columns.map(([, v]) => cell(v[i])).join(','))
  const csv = lines.join('\n') + '\n'

  const { x, y } = plot.axes
  const aspect = plot.size.height / plot.size.width
  const graph = {
    expressions,
    view: { xMin: x.range[0], xMax: x.range[1], yMin: y.range[0], yMax: y.range[1] },
    equalScale: false,
    grid: !!plot.axes.grid,
    axes: true,
    axisNumbers: true,
    xLabel: x.label || '',
    yLabel: y.label || '',
    theme: dark ? 'dark' : 'light',
    background: 'transparent',
    showSliders: false,
    lockView: false,
  }
  if (x.scale === 'log') graph.xScale = 'log'
  if (y.scale === 'log') graph.yScale = 'log'
  return {
    csv, columns: columns.map(([n]) => n), rows, graph,
    size: { w: IMPORT_WIDTH, h: Math.round(IMPORT_WIDTH * Math.min(1.2, Math.max(0.4, isFinite(aspect) ? aspect : 0.7))) },
  }
}

// Each layer's steps by default: all with the slide, or one a step, in the
// legend's order where there is one
export function defaultChoices(plot, oneByOne = true) {
  const order = [...plot.layers].sort((a, b) => (a.legend ?? 1e9) - (b.legend ?? 1e9))
  const out = {}
  order.forEach((l, i) => { out[l.id] = { include: true, name: l.name, step: oneByOne ? i + 1 : 0, until: 0 } })
  return out
}

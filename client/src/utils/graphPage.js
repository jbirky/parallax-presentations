// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A graph element: expressions typed as in Desmos, drawn in an iframe by
// graphRuntime with the parser from graphParser. The page carries both as
// source, so a presented or exported deck needs no library for them.

import { createMathParser } from './graphParser'
import { graphRuntime } from './graphRuntime'
import { graphFields } from './graphFields'
import { graph3d } from './graph3d'

// Desmos's colors, and brighter ones that read on a dark slide
export const GRAPH_COLORS = {
  light: ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000'],
  dark: ['#ff6b64', '#5aa9ff', '#4cc36a', '#b18cff', '#ffa447', '#ffffff'],
}

// What a graph element keeps, besides its place on the slide. dims 3 makes
// it a 3D graph, with a camera (turn, tilt) and maybe a spin when presented
export const GRAPH_FIELDS = ['expressions', 'view', 'equalScale', 'grid', 'axes', 'axisNumbers', 'xLabel', 'yLabel', 'zLabel', 'theme', 'background', 'showSliders', 'lockView', 'dims', 'camera', 'spin', 'colorBar']

export const DEFAULT_VIEW = { xMin: -10, xMax: 10, yMin: -7, yMax: 7 }
export const DEFAULT_VIEW_3D = { xMin: -10, xMax: 10, yMin: -10, yMax: 10, zMin: -10, zMax: 10 }
export const DEFAULT_CAMERA = { turn: 35, tilt: 25 }

export function newExpressionId() {
  return Math.random().toString(36).slice(2, 10)
}

export function defaultGraph(dark) {
  const colors = GRAPH_COLORS[dark ? 'dark' : 'light']
  return {
    expressions: [
      { id: newExpressionId(), text: 'y = a sin(bx)', color: colors[0] },
      { id: newExpressionId(), text: 'a = 2', slider: { min: -5, max: 5, step: 0.1 } },
      { id: newExpressionId(), text: 'b = 1', slider: { min: 0, max: 4, step: 0.05 } },
    ],
    view: { ...DEFAULT_VIEW },
    equalScale: true,
    grid: true,
    axes: true,
    axisNumbers: true,
    xLabel: '',
    yLabel: '',
    theme: dark ? 'dark' : 'light',
    background: 'transparent',
    showSliders: true,
    lockView: false,
  }
}

// A 3D graph's surfaces wave across its box: a sliders' worth of z = f(x, y)
export function defaultGraph3d(dark) {
  const colors = GRAPH_COLORS[dark ? 'dark' : 'light']
  return {
    ...defaultGraph(dark),
    dims: 3,
    expressions: [
      { id: newExpressionId(), text: 'z = a sin(bx) cos(by)', color: colors[1] },
      { id: newExpressionId(), text: 'a = 4', slider: { min: -10, max: 10, step: 0.1 } },
      { id: newExpressionId(), text: 'b = 0.5', slider: { min: 0, max: 2, step: 0.05 } },
    ],
    view: { ...DEFAULT_VIEW_3D },
    camera: { ...DEFAULT_CAMERA },
    zLabel: '',
    spin: false,
  }
}

function validView(v, dims3) {
  const base = dims3 ? DEFAULT_VIEW_3D : DEFAULT_VIEW
  const n = k => (v && isFinite(+v[k]) ? +v[k] : base[k])
  let { xMin, xMax, yMin, yMax } = { xMin: n('xMin'), xMax: n('xMax'), yMin: n('yMin'), yMax: n('yMax') }
  if (!(xMax > xMin)) ({ xMin, xMax } = base)
  if (!(yMax > yMin)) ({ yMin, yMax } = base)
  if (!dims3) return { xMin, xMax, yMin, yMax }
  let { zMin, zMax } = { zMin: n('zMin'), zMax: n('zMax') }
  if (!(zMax > zMin)) ({ zMin, zMax } = base)
  return { xMin, xMax, yMin, yMax, zMin, zMax }
}

// The graph as its page reads it. `showAll` draws expressions that appear
// at a step (the editor, thumbnails and the PDF show the finished graph).
export function graphConfig(el, { snapshotKey = null, print = false, editor = false, showAll = false } = {}) {
  const config = {}
  for (const key of GRAPH_FIELDS) if (el[key] !== undefined) config[key] = el[key]
  config.expressions = Array.isArray(el.expressions) ? el.expressions : []
  config.view = validView(el.view, el.dims === 3)
  if (el.dims === 3) {
    const c = el.camera || {}
    config.camera = { turn: isFinite(+c.turn) ? +c.turn : DEFAULT_CAMERA.turn, tilt: isFinite(+c.tilt) ? Math.max(-89, Math.min(89, +c.tilt)) : DEFAULT_CAMERA.tilt }
  }
  return { ...config, snapshotKey, print, editor, showAll: showAll || print || editor }
}

// For the editor's snapshot key: a thumbnail isn't reused after a change
export function graphSnapshotContent(el) {
  return JSON.stringify(GRAPH_FIELDS.map(k => el[k]))
}


// The runtime, parser, field numerics and 3D drawing as source, made once
let pageCode = null

export function graphPageHtml(el, opts = {}) {
  const config = graphConfig(el, opts)
  if (!pageCode) {
    // Its own code has no "</script" or "<!--", and a minifier can't make one
    // that ends the script: in code, "<!--" is "< !--"; in a string, "<\/" is "</"
    pageCode = `(${graphRuntime.toString()})((${createMathParser.toString()})(), (${graphFields.toString()})(), (${graph3d.toString()})(), `
      .replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '< !--')
  }
  // What people typed can't end the script either: every < is \u003c
  const code = `${pageCode}${JSON.stringify(config).replace(/</g, '\\u003c')});`
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;-webkit-user-select:none;user-select:none}</style></head><body><script>${code}</script></body></html>`
}

// The steps a graph's expressions appear at
export function graphSteps(el) {
  const steps = new Set()
  for (const e of el?.expressions || []) {
    if (e?.hidden) continue
    // A line's own step, and its field overlays' (equilibria, nullclines…)
    const at = [e?.step].concat(e?.field?.steps ? Object.values(e.field.steps) : [])
    for (const v of at) {
      const n = Number(v)
      if (Number.isInteger(n) && n >= 1 && n <= 1000) steps.add(n)
    }
  }
  return [...steps].sort((a, b) => a - b)
}

// A slide's hidden fragments for its graphs' steps, as clickActions'
// stepMarkers are for states; GRAPH_DECK_SCRIPT tells each graph its step
export function graphStepMarkers(slide) {
  let html = ''
  for (const el of slide?.elements || []) {
    if (el.type !== 'graph') continue
    const id = String(el.id || '').replace(/[^A-Za-z0-9_-]/g, '')
    // Reveal renumbers data-fragment-index from 0, so the step is kept apart
    for (const n of graphSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-graph-step="${id}" data-graph-step-at="${n}" aria-hidden="true" style="position:absolute;"></span>`
  }
  return html
}

export function hasGraphs(presentation) {
  return (presentation?.slides || []).some(s => (s.elements || []).some(el => el.type === 'graph'))
}

// In a deck with graphs: tells each its step, and moves through the slides
// with the keys a graph hands back once someone has clicked into it
export const GRAPH_DECK_SCRIPT = `
    (function() {
      function stepOf(frame) {
        var slide = frame.closest('section'), id = frame.getAttribute('data-graph-id'), n = 0;
        if (!slide) return 0;
        slide.querySelectorAll('.fragment[data-graph-step]').forEach(function(m) {
          if (m.getAttribute('data-graph-step') === id && m.classList.contains('visible')) n = Math.max(n, +m.getAttribute('data-graph-step-at') || 0);
        });
        return n;
      }
      function send(frame) {
        try { frame.contentWindow.postMessage({ source: 'parallax-deck', type: 'graph-step', step: stepOf(frame) }, '*'); } catch (e) {}
      }
      function sendAll() { document.querySelectorAll('iframe[data-graph-id]').forEach(send); }
      document.querySelectorAll('iframe[data-graph-id]').forEach(function(frame) {
        frame.addEventListener('load', function() { send(frame); });
      });
      ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden'].forEach(function(name) { Reveal.on(name, sendAll); });
      window.addEventListener('message', function(e) {
        var d = e.data;
        if (!d || d.source !== 'parallax-graph' || d.type !== 'key') return;
        var fromGraph = Array.prototype.some.call(document.querySelectorAll('iframe[data-graph-id]'), function(f) { return f.contentWindow === e.source; });
        if (!fromGraph) return;
        var k = d.key;
        if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !d.shift)) Reveal.next();
        else if (k === 'ArrowLeft' || k === 'PageUp' || (k === ' ' && d.shift)) Reveal.prev();
        else if (k === 'ArrowDown') Reveal.down();
        else if (k === 'ArrowUp') Reveal.up();
        else if (k === 'Home') Reveal.slide(0);
        else if (k === 'End') Reveal.slide(Number.MAX_VALUE);
      });
    })();
`

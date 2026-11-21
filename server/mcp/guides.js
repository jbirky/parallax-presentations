// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The elements an AI collaborator can add beyond text boxes and shapes:
// graphs, equations, tables, code, LaTeX, timelines, and the diagrams
// (circuits, Feynman, logic, free-body, Venn, timing, geometry), the
// periodic table and spherical harmonics. For each: a guide (get_element_
// guide) saying what it takes, with examples; make(spec, cx), which checks
// what the AI wrote, as the element's editor would, and returns the
// element's fields, or throws an EditError saying what to fix; its natural
// size; and read(el), what get_slide shows of it.
//
// The checking reuses the editor's own code (shared.js): Graph's parser, the
// diagrams' models, which clean every field as the editor does, and their
// readers for set expressions, WaveJSON and geometry scripts. A spec can
// also start from one of an element's templates, as its editor's can.
//
// cx: { dark, slideW, slideH, datasets }: whether the slide is dark (so ink
// reads on it), the slide's size, and the presentation's datasets
// ([{ name, columns }], or null when unknown).

const { randomUUID } = require('crypto')
const shared = require('./shared')
const { fail, num, int, str, color, oneOf, bool, list, object, only } = require('./checks')

const ink = dark => (dark ? '#ffffff' : '#1a1a1a')
const ID = /^[A-Za-z0-9_-]{1,40}$/
const json = v => JSON.stringify(v)
const clip = (s, n = 120) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t }
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
// A field that must be plain JSON, and not too much of it
function plain(value, name, max = 4000) {
  if (value === undefined) return undefined
  let text
  try { text = JSON.stringify(value) } catch { fail(`${name} must be plain JSON.`) }
  if (text.length > max) fail(`${name} is too large.`)
  return JSON.parse(text)
}
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]))
const without = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)))

// ── Graph ──

const GRAPH_LINE_KEYS = ['id', 'text', 'color', 'hidden', 'step', 'style', 'width', 'label', 'showCoords', 'min', 'max', 'uMin', 'uMax', 'vMin', 'vMax',
  'slider', 'field', 'traj', 'surface', 'volume', 'data']
const DATA_KEYS = ['dataset', 'x', 'y', 'mark', 'colorBy', 'sizeBy', 'label', 'x2', 'xErr', 'yErr', 'size', 'opacity']
const RESERVED_2D = 'x, y, t, θ (theta) and r'
const RESERVED_3D = 'x, y, z, t, u, v, w, θ and r'
const newLineId = () => Math.random().toString(36).slice(2, 10)

function graphLine(line, i, used) {
  const name = `expressions[${i}]`
  object(line, name)
  only(line, name, GRAPH_LINE_KEYS)
  const out = {}
  out.id = typeof line.id === 'string' && ID.test(line.id) && !used.has(line.id) ? line.id : newLineId()
  used.add(out.id)
  if (line.data !== undefined) {
    object(line.data, `${name}.data`)
    only(line.data, `${name}.data`, DATA_KEYS)
    const data = {}
    for (const key of ['dataset', 'x', 'y', 'colorBy', 'sizeBy', 'label', 'x2', 'xErr', 'yErr']) {
      const v = str(line.data[key], `${name}.data.${key}`, 200)
      if (v) data[key] = v
    }
    if (!data.dataset || !data.x || !data.y) fail(`${name}.data needs dataset, x and y: the dataset's name and the columns to plot.`)
    if (line.data.mark !== undefined) data.mark = oneOf(line.data.mark, `${name}.data.mark`, ['points', 'line', 'bars'])
    if (line.data.size !== undefined) data.size = num(line.data.size, `${name}.data.size`, 0.5, 30)
    if (line.data.opacity !== undefined) data.opacity = num(line.data.opacity, `${name}.data.opacity`, 0.05, 1)
    out.data = data
    out.text = ''
  } else {
    out.text = str(line.text ?? '', `${name}.text`, 500)
  }
  if (line.color !== undefined) out.color = color(line.color, `${name}.color`)
  if (line.hidden !== undefined) out.hidden = bool(line.hidden, `${name}.hidden`)
  if (line.step !== undefined) out.step = int(line.step, `${name}.step`, 1, 1000)
  if (line.style !== undefined) out.style = oneOf(line.style, `${name}.style`, ['solid', 'dashed', 'dotted'])
  if (line.width !== undefined) out.width = num(line.width, `${name}.width`, 0.5, 10)
  if (line.label !== undefined) out.label = str(line.label, `${name}.label`, 100)
  if (line.showCoords !== undefined) out.showCoords = bool(line.showCoords, `${name}.showCoords`)
  for (const key of ['min', 'max', 'uMin', 'uMax', 'vMin', 'vMax']) if (line[key] !== undefined) out[key] = num(line[key], `${name}.${key}`, -1e6, 1e6)
  if (line.slider !== undefined) {
    object(line.slider, `${name}.slider`)
    only(line.slider, `${name}.slider`, ['min', 'max', 'step', 'play'])
    out.slider = { min: num(line.slider.min ?? -10, `${name}.slider.min`, -1e6, 1e6), max: num(line.slider.max ?? 10, `${name}.slider.max`, -1e6, 1e6), step: num(line.slider.step ?? 0.1, `${name}.slider.step`, 1e-6, 1e6) }
    if (out.slider.min >= out.slider.max) fail(`${name}.slider: min must be below max.`)
    if (line.slider.play !== undefined) out.slider.play = bool(line.slider.play, `${name}.slider.play`)
  }
  for (const key of ['field', 'traj', 'surface', 'volume']) if (line[key] !== undefined) out[key] = plain(object(line[key], `${name}.${key}`), `${name}.${key}`, 2000)
  return out
}

function makeGraph(spec, cx, template, size, kept = {}) {
  only(spec, 'spec', shared.GRAPH_FIELDS)
  const dims = spec.dims === undefined ? 2 : int(spec.dims, 'dims', 2, 3)
  const base = without(dims === 3 ? shared.defaultGraph3d(cx.dark) : shared.defaultGraph(cx.dark), ['expressions'])
  const lines = list(spec.expressions, 'expressions', 80)
  if (!lines || !lines.length) fail('A graph needs expressions: a list of lines such as { "text": "y = x^2" }.')
  const used = new Set()
  // Lines the element has already (update_element without expressions) keep
  // only the fields this knows; lines the AI gives must have only those
  const known = line => (line && typeof line === 'object' ? pick(line, GRAPH_LINE_KEYS) : line)
  const expressions = lines.map((line, i) => graphLine(kept.expressions ? known(line) : line, i, used))
  const { items } = shared.createMathParser().analyze(expressions, { dims })
  const reserved = dims === 3 ? RESERVED_3D : RESERVED_2D
  items.forEach((item, i) => {
    const what = `expressions[${i}] (${json(expressions[i].text)})`
    if (item.kind === 'error') fail(`${what}: ${item.error}.`)
    if (item.missing && item.missing.length) {
      fail(`${what} uses ${item.missing.join(', ')}, which no line defines. Add a slider line such as "${item.missing[0]} = 1", or use the variables (${reserved}).`)
    }
    if (item.colorError) fail(`${what}.surface.colorBy: ${item.colorError}.`)
    if (item.atError) fail(`${what}.volume.at: ${item.atError}.`)
  })
  // Each drawn line gets the next of the graph's colors, as the editor gives them
  const palette = shared.GRAPH_COLORS[cx.dark ? 'dark' : 'light']
  let next = 0
  items.forEach((item, i) => {
    if (!expressions[i].color && !['param', 'empty', 'value', 'function', 'partner'].includes(item.kind)) expressions[i].color = palette[next++ % palette.length]
    if (item.kind === 'function' && !expressions[i].color) expressions[i].color = palette[next++ % palette.length]
  })
  // Data lines name a dataset the presentation has, and its columns
  for (const line of expressions.filter(l => l.data)) {
    if (!cx.datasets) continue
    const ds = cx.datasets.find(d => d.name === line.data.dataset)
    if (!ds) {
      fail(cx.datasets.length
        ? `There's no dataset ${json(line.data.dataset)} linked to the presentation. It has: ${cx.datasets.map(d => d.name).join(', ')} (list_datasets shows their columns).`
        : `There's no dataset ${json(line.data.dataset)}: the presentation has none linked. The person can link one under Tools › Datasets….`)
    }
    const names = (ds.columns || []).map(c => c.name)
    for (const key of ['x', 'y', 'colorBy', 'sizeBy', 'label', 'x2', 'xErr', 'yErr']) {
      if (line.data[key] && !names.includes(line.data[key])) fail(`Dataset ${json(ds.name)} has no column ${json(line.data[key])} (for ${key}). Its columns: ${names.join(', ')}.`)
    }
  }
  const out = { ...base, expressions, ...(dims === 3 ? { dims: 3 } : {}) }
  if (spec.view !== undefined) {
    object(spec.view, 'view')
    const keys = dims === 3 ? ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'] : ['xMin', 'xMax', 'yMin', 'yMax']
    only(spec.view, 'view', keys)
    const view = { ...base.view }
    for (const k of keys) if (spec.view[k] !== undefined) view[k] = num(spec.view[k], `view.${k}`, -1e9, 1e9)
    for (const axis of dims === 3 ? ['x', 'y', 'z'] : ['x', 'y']) if (view[`${axis}Min`] >= view[`${axis}Max`]) fail(`view: ${axis}Min must be below ${axis}Max.`)
    out.view = view
  }
  for (const key of ['equalScale', 'grid', 'axes', 'axisNumbers', 'showSliders', 'lockView', 'spin', 'colorBar']) if (spec[key] !== undefined) out[key] = bool(spec[key], key)
  for (const key of ['xLabel', 'yLabel', 'zLabel']) if (spec[key] !== undefined) out[key] = str(spec[key], key, 100)
  for (const key of ['xScale', 'yScale']) if (spec[key] !== undefined) out[key] = oneOf(spec[key], key, ['linear', 'log'])
  if ((out.xScale === 'log' || out.yScale === 'log') && dims === 3) fail('Log axes are for 2D graphs.')
  if (spec.theme !== undefined) out.theme = oneOf(spec.theme, 'theme', ['light', 'dark'])
  if (spec.background !== undefined) out.background = spec.background === 'transparent' ? 'transparent' : color(spec.background, 'background')
  if (spec.camera !== undefined) {
    object(spec.camera, 'camera')
    only(spec.camera, 'camera', ['turn', 'tilt'])
    out.camera = { turn: num(spec.camera.turn ?? 35, 'camera.turn', -360, 360), tilt: num(spec.camera.tilt ?? 25, 'camera.tilt', -89, 89) }
  }
  return out
}

function readGraph(el) {
  const lines = (el.expressions || []).slice(0, 30).map(e => {
    const what = e.data ? `data: ${json(e.data)}` : json(e.text || '')
    const extra = [e.color && `color ${e.color}`, e.step && `step ${e.step}`, e.slider && `slider ${e.slider.min} to ${e.slider.max}`, e.hidden && 'hidden'].filter(Boolean)
    return `   - \`${e.id}\` ${what}${extra.length ? ` (${extra.join(', ')})` : ''}`
  })
  const v = el.view || {}
  const view = el.dims === 3 ? `x ${v.xMin} to ${v.xMax}, y ${v.yMin} to ${v.yMax}, z ${v.zMin} to ${v.zMax}` : `x ${v.xMin} to ${v.xMax}, y ${v.yMin} to ${v.yMax}`
  const scales = [el.xScale === 'log' && 'log x', el.yScale === 'log' && 'log y'].filter(Boolean)
  return [`   ${el.dims === 3 ? '3D graph' : 'Graph'}: ${view}${scales.length ? `, ${scales.join(', ')}` : ''}${el.xLabel || el.yLabel ? `, labels ${json(el.xLabel || '')} and ${json(el.yLabel || '')}` : ''}`, ...lines]
}

// ── Equation ──

function makeEquation(spec, cx) {
  only(spec, 'spec', shared.EQUATION_FIELDS)
  const latex = str(spec.latex, 'latex', 20000, { min: 1 })
  if (!latex) fail('An equation needs latex: KaTeX math, with \\term{id}{…} around each part to label.')
  const bad = shared.badTermIds(latex)
  if (bad.length) fail(`\\term ids must start with a letter, then letters, digits, - or _: ${bad.map(b => json(b)).join(', ')}.`)
  const terms = (list(spec.terms, 'terms', shared.MAX_TERMS) || []).map((t, i) => {
    object(t, `terms[${i}]`)
    only(t, `terms[${i}]`, ['id', 'label', 'note', 'color'])
    const id = str(t.id, `terms[${i}].id`, 40, { min: 1 })
    if (!shared.TERM_ID.test(id)) fail(`terms[${i}].id must start with a letter, then letters, digits, - or _.`)
    return { id, label: str(t.label ?? '', `terms[${i}].label`, 80), note: str(t.note ?? '', `terms[${i}].note`, 300), ...(t.color !== undefined ? { color: color(t.color, `terms[${i}].color`) } : {}) }
  })
  const inLatex = new Set(shared.termIdsIn(latex))
  const unused = terms.filter(t => !inLatex.has(t.id)).map(t => t.id)
  if (unused.length) fail(`terms ${unused.join(', ')} aren't in latex: wrap each part as \\term{id}{…}.`)
  const base = shared.defaultEquation(cx.dark)
  const fields = { ...base, latex, terms, sentence: '' }
  if (spec.labelStyle !== undefined) fields.labelStyle = oneOf(spec.labelStyle, 'labelStyle', shared.LABEL_STYLES)
  if (spec.interaction !== undefined) fields.interaction = oneOf(spec.interaction, 'interaction', shared.INTERACTIONS)
  if (spec.sentence !== undefined) fields.sentence = str(spec.sentence, 'sentence', 2000)
  if (fields.labelStyle === 'sentence' && !fields.sentence) fail('labelStyle "sentence" needs a sentence, linking phrases to terms: "[what you believe after](t1) …".')
  for (const key of ['showAll', 'keepTinted']) if (spec[key] !== undefined) fields[key] = bool(spec[key], key)
  if (spec.stepStart !== undefined) fields.stepStart = int(spec.stepStart, 'stepStart', 1, 1000)
  if (spec.fontSize !== undefined) fields.fontSize = num(spec.fontSize, 'fontSize', 8, 200)
  if (spec.labelSize !== undefined) fields.labelSize = num(spec.labelSize, 'labelSize', 6, 120)
  if (spec.textColor !== undefined) fields.textColor = color(spec.textColor, 'textColor')
  return pick(shared.equationConfig(fields), shared.EQUATION_FIELDS)
}

const readEquation = el => [`   latex: ${json(clip(el.latex, 300))}`, ...(el.terms || []).slice(0, 12).map(t => `   - term \`${t.id}\`: ${json(t.label || '')}${t.note ? ` (${clip(t.note, 80)})` : ''}`)]

// ── Table, code, LaTeX, timeline ──

function makeTable(spec, cx) {
  only(spec, 'spec', ['data', 'headerRow', 'fontSize', 'textColor', 'borderColor', 'borderWidth', 'headerBgColor', 'cellBgColor', 'cellPadding'])
  const rows = list(spec.data, 'data', 30)
  if (!rows || !rows.length) fail('A table needs data: rows of cells, such as [["Name", "Mass"], ["Earth", "1"]].')
  const width = Math.max(...rows.map((r, i) => (list(r, `data[${i}]`, 12) || []).length))
  if (!width) fail('The table\'s rows are empty.')
  const data = rows.map((r, i) => Array.from({ length: width }, (_, j) => {
    const v = r[j]
    if (v === undefined || v === null) return ''
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    return str(v, `data[${i}][${j}]`, 300)
  }))
  return {
    data,
    headerRow: spec.headerRow === undefined ? true : bool(spec.headerRow, 'headerRow'),
    cellPadding: spec.cellPadding === undefined ? 8 : num(spec.cellPadding, 'cellPadding', 0, 40),
    borderColor: spec.borderColor === undefined ? (cx.dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') : color(spec.borderColor, 'borderColor'),
    borderWidth: spec.borderWidth === undefined ? 1 : num(spec.borderWidth, 'borderWidth', 0, 10),
    headerBgColor: spec.headerBgColor === undefined ? (cx.dark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.15)') : color(spec.headerBgColor, 'headerBgColor'),
    cellBgColor: spec.cellBgColor === undefined ? 'transparent' : (spec.cellBgColor === 'transparent' ? 'transparent' : color(spec.cellBgColor, 'cellBgColor')),
    textColor: spec.textColor === undefined ? ink(cx.dark) : color(spec.textColor, 'textColor'),
    fontSize: spec.fontSize === undefined ? 16 : num(spec.fontSize, 'fontSize', 8, 60),
  }
}
const tableSize = f => ({ w: Math.min(880, Math.max(240, 150 * f.data[0].length)), h: Math.round(f.data.length * (f.fontSize * 1.5 + 2 * f.cellPadding + 2)) })
const readTable = el => (el.data || []).slice(0, 8).map(r => `   | ${r.map(c => clip(c, 30).replace(/\|/g, '\\|')).join(' | ')} |`)

const CODE_LANGUAGES = ['plaintext', 'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'r',
  'scala', 'html', 'css', 'json', 'yaml', 'bash', 'sql', 'markdown', 'latex']
function makeCode(spec) {
  only(spec, 'spec', ['content', 'language', 'fontSize', 'borderRadius'])
  if (typeof spec.content !== 'string' || !spec.content.trim()) fail('A code block needs content: the code, as text.')
  if (spec.content.length > 20000) fail('content can be up to 20000 characters.')
  return {
    content: spec.content.replace(/\r\n?/g, '\n'),
    language: spec.language === undefined ? 'plaintext' : oneOf(spec.language, 'language', CODE_LANGUAGES),
    fontSize: spec.fontSize === undefined ? 16 : num(spec.fontSize, 'fontSize', 8, 32),
    ...(spec.borderRadius !== undefined ? { borderRadius: num(spec.borderRadius, 'borderRadius', 0, 50) } : {}),
  }
}
const codeSize = f => ({ w: 640, h: Math.min(460, Math.round(f.content.split('\n').length * f.fontSize * 1.5 + 32)) })
const readCode = el => [`   ${el.language || 'plaintext'}, ${plural(String(el.content || '').split('\n').length, 'line')}: ${json(clip(el.content, 200))}`]

function makeLatex(spec, cx) {
  only(spec, 'spec', ['content', 'textColor', 'fontSize'])
  if (typeof spec.content !== 'string' || !spec.content.trim()) fail('A LaTeX element needs content: a tikzpicture, a tabular, or display math.')
  if (spec.content.length > 20000) fail('content can be up to 20000 characters.')
  const content = spec.content.replace(/\r\n?/g, '\n')
  // TikZ draws in black whatever the text color, which a dark slide hides
  const tikz = /\\begin\{tikzpicture\}|\\tikz\s*[[{]/.test(content)
  const notes = cx.dark && tikz && !/color\s*=|\[\s*(white|\w+!\d+)/.test(content)
    ? ['The slide is dark and TikZ draws in black: start with \\begin{tikzpicture}[color=white], and use light colors such as cyan or orange for lines.'] : []
  return {
    fields: {
      content,
      textColor: spec.textColor === undefined ? ink(cx.dark) : color(spec.textColor, 'textColor'),
      fontSize: spec.fontSize === undefined ? 20 : num(spec.fontSize, 'fontSize', 8, 80),
    },
    notes,
  }
}
const readLatex = el => [`   ${/\\begin\{tikzpicture\}|\\tikz[[{]/.test(el.content || '') ? 'TikZ' : /tabular|longtable/.test(el.content || '') ? 'table' : 'math'}: ${json(clip(el.content, 300))}`]

const DATE = /^\d{4}-\d{2}-\d{2}$/
const YEAR = /^-?\d{1,5}$/
function makeTimeline(spec, cx, template, size, kept = {}) {
  only(spec, 'spec', ['startDate', 'endDate', 'items', 'tickSpacing', 'lineColor', 'dotColor', 'textColor', 'fontSize'])
  const start = str(String(spec.startDate ?? ''), 'startDate', 12, { min: 1 })
  const end = str(String(spec.endDate ?? ''), 'endDate', 12, { min: 1 })
  const years = YEAR.test(start)
  const valid = d => (years ? YEAR.test(d) : DATE.test(d) && !Number.isNaN(Date.parse(d)))
  const kind = years ? 'years such as "1905"' : 'dates such as "2024-06-01"'
  if (!valid(start) || !valid(end)) fail(`startDate and endDate must both be ${years ? kind : 'dates such as "2024-06-01", or both years such as "1905"'}.`)
  const at = d => (years ? Number(d) : Date.parse(d))
  if (at(start) >= at(end)) fail('startDate must be before endDate.')
  const items = (list(spec.items, 'items', 40) || []).map((it, i) => {
    object(it, `items[${i}]`)
    if (kept.items) it = pick(it, ['date', 'label', 'description', 'detailedDescription', 'side'])
    only(it, `items[${i}]`, ['date', 'label', 'description', 'detailedDescription', 'side'])
    const date = str(String(it.date ?? ''), `items[${i}].date`, 12, { min: 1 })
    if (!valid(date)) fail(`items[${i}].date must be ${kind}, as startDate is.`)
    if (at(date) < at(start) || at(date) > at(end)) fail(`items[${i}].date (${date}) is outside ${start} to ${end}.`)
    return {
      id: randomUUID(), date, label: str(it.label ?? '', `items[${i}].label`, 120), description: str(it.description ?? '', `items[${i}].description`, 300), image: '',
      side: it.side === undefined ? (i % 2 ? 'bottom' : 'top') : oneOf(it.side, `items[${i}].side`, ['top', 'bottom']),
      ...(it.detailedDescription ? { detailedDescription: str(it.detailedDescription, `items[${i}].detailedDescription`, 2000) } : {}),
    }
  })
  if (!items.length) fail('A timeline needs items: events with a date and a label.')
  return {
    startDate: start, endDate: end, items,
    ...(spec.tickSpacing !== undefined ? { tickSpacing: oneOf(spec.tickSpacing, 'tickSpacing', ['auto', 'day', 'month', 'year', '10year', '100year', '1000year']) } : {}),
    lineColor: spec.lineColor === undefined ? '#6366f1' : color(spec.lineColor, 'lineColor'),
    dotColor: spec.dotColor === undefined ? '#6366f1' : color(spec.dotColor, 'dotColor'),
    textColor: spec.textColor === undefined ? ink(cx.dark) : color(spec.textColor, 'textColor'),
    fontSize: spec.fontSize === undefined ? 12 : num(spec.fontSize, 'fontSize', 8, 30),
  }
}
const readTimeline = el => [`   ${el.startDate} to ${el.endDate}`, ...(el.items || []).slice(0, 15).map(it => `   - ${it.date}: ${json(it.label || '')}${it.description ? ` (${clip(it.description, 80)})` : ''}`)]

// ── Diagrams drawn from parts (circuit, Feynman, logic, free-body) ──

// A diagram from parts: its fields from the spec over its editor's defaults,
// through its model, which drops parts it can't use; the AI is told
const PART_DIAGRAMS = {
  circuit: {
    fields: shared.CIRCUIT_FIELDS, parts: ['vertices', 'edges'], templates: shared.CIRCUIT_TEMPLATES, model: shared.circuitModel, box: shared.circuitBox,
    base: dark => ({ captions: {}, color: ink(dark), symbols: 'us', flow: true, readings: true, stepStart: 1, dimPast: false }),
    lint(m) {
      const notes = []
      const loose = shared.looseEnds(m)
      if (loose.length) notes.push(`Vertices ${loose.join(', ')} connect to only one part, so the circuit isn't closed there.`)
      const status = shared.solveCircuit(m).status
      if (status === 'nosource') notes.push('It has no battery or source, so no current flows.')
      if (status === 'shorted') notes.push('A source is shorted by a wire.')
      if (status === 'conflict') notes.push('Two sources fight over the same voltage or current.')
      return notes
    },
    read: m => [`   ${plural((m.vertices || []).length, 'vertex')}: ${(m.vertices || []).slice(0, 20).map(v => `${v.id} (${v.x}, ${v.y})`).join(', ')}`,
      ...(m.edges || []).slice(0, 25).map(e => `   - \`${e.id}\` ${e.part} ${e.from}→${e.to}${e.value ? ` ${e.value}` : ''}${e.label ? ` ${json(e.label)}` : ''}${e.step ? ` step ${e.step}` : ''}`)],
  },
  feynman: {
    fields: shared.FEYNMAN_FIELDS, parts: ['vertices', 'edges'], templates: shared.FEYNMAN_TEMPLATES, model: shared.feynmanModel, box: shared.feynmanBox,
    base: dark => ({ captions: {}, color: ink(dark), stepStart: 1, dimPast: true }),
    lint: m => shared.flowWarnings(m).map(w => (typeof w === 'string' ? w : w.message || json(w))),
    read: m => [`   ${plural((m.vertices || []).length, 'vertex')}: ${(m.vertices || []).slice(0, 20).map(v => `${v.id} (${v.x}, ${v.y})${v.label ? ` ${json(v.label)}` : ''}`).join(', ')}`,
      ...(m.edges || []).slice(0, 25).map(e => `   - \`${e.id}\` ${e.particle} ${e.from}→${e.to}${e.label ? ` ${json(e.label)}` : ''}${e.bend ? ` bend ${e.bend}` : ''}${e.step ? ` step ${e.step}` : ''}`)],
  },
  logic: {
    fields: shared.LOGIC_FIELDS, parts: ['parts', 'nodes', 'wires'], templates: shared.LOGIC_TEMPLATES, model: shared.logicModel, box: shared.logicBox,
    base: dark => ({ nodes: [], captions: {}, color: ink(dark), symbols: 'us', values: true, table: false, stepStart: 1 }),
    lint(m) {
      const floating = shared.floatingPins(m)
      return floating.length ? [`Pins with no wire: ${floating.join(', ')}.`] : []
    },
    read: m => [...(m.parts || []).slice(0, 25).map(p => `   - \`${p.id}\` ${p.kind} at (${p.x}, ${p.y})${p.label ? ` ${json(p.label)}` : ''}`),
      `   wires: ${(m.wires || []).slice(0, 30).map(w => `${w.from}→${w.to}`).join(', ')}`],
  },
  freebody: {
    fields: shared.FREEBODY_FIELDS, parts: ['forces'], templates: shared.FREEBODY_TEMPLATES, model: shared.freebodyModel, box: shared.freebodyBox,
    base: dark => ({ captions: {}, color: ink(dark), stepStart: 1, dimPast: false }),
    lint: () => [],
    read: m => [`   body ${m.body?.shape} ${json(m.body?.label || '')}${m.body?.mass ? ` mass ${m.body.mass}` : ''}, surface ${m.surface?.kind}${m.surface?.angle ? ` at ${m.surface.angle}°` : ''}, motion ${m.motion}`,
      ...(m.forces || []).slice(0, 20).map(f => `   - \`${f.id}\` ${f.kind} ${json(f.label || '')} ${f.magMode}${f.mag ? ` ${f.mag}` : ''}, ${f.dir?.deg}° from ${f.dir?.from}`)],
  },
}

function templateOf(templates, key, type) {
  const t = templates.find(x => (x.key ?? x.id) === key)
  if (!t) fail(`${type} has no template ${json(key)}. Its templates: ${templates.map(x => x.key ?? x.id).join(', ')}.`)
  return t
}

function makeParts(type, spec, cx, template) {
  const d = PART_DIAGRAMS[type]
  only(spec, 'spec', d.fields)
  const start = template ? { ...d.base(cx.dark), ...templateOf(d.templates, template, type).build() } : d.base(cx.dark)
  if (!template) {
    const missing = d.parts.filter(p => p !== 'nodes' && !Array.isArray(spec[p]))
    if (missing.length) fail(`A ${type} diagram needs ${missing.join(' and ')}, or a template to start from (${d.templates.map(t => t.key).join(', ')}).`)
  }
  const given = plain(spec, 'spec', 60000)
  for (const key of d.parts) if (given[key] !== undefined) list(given[key], key, key === 'forces' ? 40 : 200)
  if (given.color !== undefined) color(given.color, 'color')
  const m = d.model({ ...start, ...given })
  const dropped = d.parts.map(key => [key, (given[key] || []).length - (m[key] || []).length]).filter(([, n]) => n > 0)
  if (dropped.length) {
    fail(`${dropped.map(([key, n]) => `${n} of the ${key}`).join(' and ')} couldn't be used: each needs an id (letters, digits, - or _, unique), a known kind, and ends that name parts that exist. Check them against get_element_guide.`)
  }
  return { fields: pick(m, d.fields), notes: d.lint(m) }
}

// ── Venn, timing, geometry, periodic table, spherical harmonics ──

function makeVenn(spec, cx, template) {
  only(spec, 'spec', [...shared.VENN_FIELDS, 'buildUp'])
  const { buildUp, ...rest } = spec
  const start = template ? shared.vennModel(templateOf(shared.VENN_TEMPLATES, template, 'venn').build()) : {}
  if (!template && !Array.isArray(rest.sets)) fail('A Venn diagram needs sets (1 to 4, each { "id": "A", "label": "A" }) and expr, or a template to start from.')
  const m = shared.vennModel({ ...start, color: ink(cx.dark), stepStart: 1, ...plain(rest, 'spec', 20000) })
  const a = shared.analyzeVenn(m)
  if (a.err) fail(`expr ${json(m.expr)}: ${a.err.message}${Number.isInteger(a.err.at) ? ` (at character ${a.err.at + 1})` : ''}.`)
  ;(a.layers || []).forEach((layer, i) => { if (layer && layer.err) fail(`layers[${i}].expr: ${layer.err.message}.`) })
  if (buildUp !== undefined) {
    oneOf(buildUp, 'buildUp', ['every', 'sides'])
    if (shared.buildUp(m, buildUp) === false) fail(`expr ${json(m.expr)} couldn't be built up step by step.`)
  }
  return { fields: pick(m, shared.VENN_FIELDS), notes: [...(a.warnings || []), ...(a.notes || [])].map(n => (typeof n === 'string' ? n : n.message || json(n))) }
}
const readVenn = el => [`   sets: ${(el.sets || []).map(s => `${s.id} ${json(s.label || s.id)}`).join(', ')}; layout ${el.layout}; expr ${json(el.expr || '')}`,
  ...(el.facts || []).length ? [`   facts: ${el.facts.slice(0, 8).join('; ')}`] : []]

function makeTiming(spec, cx, template) {
  only(spec, 'spec', shared.TIMING_FIELDS)
  const source = spec.source !== undefined ? str(spec.source, 'source', 40000, { min: 1 }) : template ? templateOf(shared.TIMING_TEMPLATES, template, 'timing').source : undefined
  if (!source) fail('A timing diagram needs source: WaveJSON, such as { signal: [ { name: "clk", wave: "p...." } ] }, or a template.')
  const parsed = shared.parseTiming(source)
  if (parsed.error) fail(`source: ${parsed.error}`)
  const steps = (list(spec.steps, 'steps', 60) || []).map((s, i) => {
    object(s, `steps[${i}]`)
    only(s, `steps[${i}]`, ['to', 'caption'])
    return { to: num(s.to, `steps[${i}].to`, 0, 10000), caption: str(s.caption ?? '', `steps[${i}].caption`, 300) }
  })
  const fields = shared.timingModel({
    source, theme: spec.theme === undefined ? (cx.dark ? 'dark' : 'light') : oneOf(spec.theme, 'theme', ['dark', 'light']), steps,
    revealFrom: spec.revealFrom === undefined ? 0 : num(spec.revealFrom, 'revealFrom', 0, 10000),
    cursor: spec.cursor === undefined ? true : bool(spec.cursor, 'cursor'),
    stepStart: spec.stepStart === undefined ? 1 : int(spec.stepStart, 'stepStart', 1, 1000),
  })
  const drawn = shared.drawTiming({ ...fields, id: 'check' })
  if (drawn.error) fail(`source: ${drawn.error}`)
  return pick(fields, shared.TIMING_FIELDS)
}
const readTiming = el => [`   source: ${json(clip(el.source, 400))}`]

function makeGeometry(spec, cx, template, size) {
  only(spec, 'spec', shared.GEOMETRY_FIELDS)
  const W = size.w, H = size.h
  const start = template ? shared.geometryFromTemplate(templateOf(shared.GEOMETRY_TEMPLATES, template, 'geometry').key, { dark: cx.dark, W, H }) : null
  const script = spec.script !== undefined ? str(spec.script, 'script', 20000, { min: 1 }) : start?.script
  if (!script) fail('A geometry construction needs script: one object a line, such as "A = Point(0, 0)", or a template.')
  const parsed = shared.GEO.parse(script)
  if (parsed.errors.length) fail(`script: ${parsed.errors.slice(0, 5).map(e => `line ${e.line}: ${e.msg}`).join('; ')}.`)
  if (!parsed.objs.length) fail('script has no objects.')
  if (parsed.objs.length > 400) fail('script can have up to 400 objects.')
  const vals = shared.GEO.compute(parsed.objs)
  const fields = {
    script: shared.GEO.serialize(parsed.objs),
    view: spec.script !== undefined || !start ? shared.fitView(parsed.objs, vals, W, H) : start.view,
    theme: cx.dark ? 'dark' : 'light', axes: false, grid: false, steps: shared.stepsPerLine(parsed.objs, null), start: null, tidy: false, captions: true, stepStart: 1,
  }
  if (spec.view !== undefined) {
    object(spec.view, 'view')
    only(spec.view, 'view', ['x', 'y', 'w'])
    fields.view = { x: num(spec.view.x ?? 0, 'view.x', -1e6, 1e6), y: num(spec.view.y ?? 0, 'view.y', -1e6, 1e6), w: num(spec.view.w ?? 12, 'view.w', 1e-3, 1e6) }
  }
  if (spec.theme !== undefined) fields.theme = oneOf(spec.theme, 'theme', ['dark', 'light'])
  for (const key of ['axes', 'grid', 'tidy', 'captions']) if (spec[key] !== undefined) fields[key] = bool(spec[key], key)
  if (spec.start !== undefined) fields.start = spec.start === null ? null : int(spec.start, 'start', 0, 400)
  if (spec.stepStart !== undefined) fields.stepStart = int(spec.stepStart, 'stepStart', 1, 1000)
  if (spec.steps !== undefined) {
    fields.steps = list(spec.steps, 'steps', 400).map((s, i) => {
      object(s, `steps[${i}]`)
      only(s, `steps[${i}]`, ['to', 'caption'])
      return { to: int(s.to, `steps[${i}].to`, 1, parsed.objs.length), caption: str(s.caption ?? '', `steps[${i}].caption`, 300) }
    })
  } else if (spec.start !== undefined) fields.steps = shared.stepsPerLine(parsed.objs, fields.start)
  const missing = parsed.objs.filter(o => vals[o.name] == null && !o.opts?.hidden).map(o => o.name)
  return { fields, notes: missing.length ? [`These don't exist for the points as placed (such as circles that don't meet): ${missing.join(', ')}.`] : [] }
}
const readGeometry = el => [`   script: ${json(clip(el.script, 500))}`, `   view: centered on (${el.view?.x}, ${el.view?.y}), ${el.view?.w} wide`]

function makePeriodic(spec, cx) {
  only(spec, 'spec', shared.PERIODIC_FIELDS)
  return pick(shared.PT.normalize({ ...shared.defaultPeriodic(cx.dark), ...plain(spec, 'spec', 20000) }), shared.PERIODIC_FIELDS)
}
const readPeriodic = el => [`   color by ${el.colorBy}, showing ${el.show}${el.highlight ? `, highlight ${json(el.highlight)}` : ''}${el.restingElement ? `, card for ${el.restingElement}` : ''}${(el.steps || []).length ? `, ${plural(el.steps.length, 'step')}` : ''}`]

function makeHarmonics(spec, cx, template) {
  only(spec, 'spec', shared.HARMONICS_FIELDS)
  let start = shared.defaultHarmonics(cx.dark)
  if (template) start = shared.applyHarmonicsTemplate(start, templateOf(shared.HARMONICS_TEMPLATES, template, 'harmonics'))
  const fields = pick(shared.HV.normalize({ ...start, ...plain(spec, 'spec', 20000) }), shared.HARMONICS_FIELDS)
  if (fields.source === 'sum') {
    const parsed = shared.SH.parseExpr(fields.expr || '', fields.form)
    if (parsed.error) fail(`expr ${json(fields.expr || '')}: ${parsed.error}${Number.isInteger(parsed.pos) ? ` (at character ${parsed.pos + 1})` : ''}.`)
  }
  return fields
}
const readHarmonics = el => [`   ${el.source === 'sum' ? `sum ${json(el.expr || '')}` : el.source === 'single' ? `Y(l=${el.l}, m=${el.m}), ${el.form}` : el.source}, view ${el.view}${(el.steps || []).length ? `, ${plural(el.steps.length, 'step')}` : ''}`]

// ── The guides ──

const PART_RULES = {
  circuit: `Vertices are points in centimeters, y up: { "id": "a", "x": 0, "y": 0 }, with optional kind (auto, none, dot, terminal), ground (down, left, up, right), label (TeX) and step. Edges are parts between two vertices: { "id": "e1", "from": "a", "to": "b", "part": "resistor", "value": "4.7k", "label": "R_1" }. part is one of: ${Object.keys(shared.CIRCUIT_PARTS).join(', ')}. value is a number with an SI prefix ("100", "4.7k", "10u"); batteries and sources run from − (from) to + (to), diodes from anode to cathode. A switch takes closed (true or false) and flipAt (a step); current and voltage put TeX annotations on a part. Keep parts on a grid of whole centimeters, wires along x or y. Settings: symbols (us or iec), flow (current arrows), readings (meter values).`,
  feynman: `Vertices are points in centimeters, y up: { "id": "v1", "x": 0, "y": 0, "label": "e^-" }, with optional kind (auto, none, dot, blob, crossed, empty, square) and step. External particles end at vertices of their own, labeled. Edges join two vertices: { "id": "e1", "from": "v1", "to": "v2", "particle": "fermion" }; particle is one of: ${Object.keys(shared.FEYNMAN_TYPES).join(', ')}. bend (−1.6 to 1.6; 1 is a semicircle) curves a line; label and momentum annotate it (TeX); from = to makes a loop. Time runs left to right. dimPast dims earlier steps.`,
  logic: `Parts: { "id": "g1", "kind": "and", "x": 3, "y": 0 }, in centimeters, y up; kind is one of: ${Object.keys(shared.LOGIC_PARTS).join(', ')}. Gates (and, or, nand, nor, xor, xnor) take inputs (2 to 4); input parts take value (0 or 1) and flips (the steps they toggle at); outputs take a label. Wires join pins: { "id": "w1", "from": "A.out", "to": "g1.in1" }. Gates have pins in1…inN on their left and out on their right; inputs and clocks have out; outputs have in; dff has d, clk, q, qn. nodes are junctions ({ "id": "n1", "x": 2, "y": 0 }) a wire can end at. table: true shows the truth table beside it; values shows signals.`,
  freebody: `body: { "shape": "box" (or ball, dot), "w": 1.6, "h": 1, "label": "m", "mass": "5" }. surface: { "kind": "floor" (none, floor, incline, wall, ceiling), "angle": 0 (−60 to 60, for an incline) }. motion: rest, slide or free. forces (up to 40): { "id": "f1", "kind": "weight", "label": "mg", "magMode": "mass", "dir": { "from": "level", "deg": -90 } }; kind is one of: ${Object.keys(shared.FORCE_KINDS).join(', ')}. magMode: given (with mag, in newtons), solve (worked out so the forces balance, or give the motion), mass (weight only, from body.mass) or mu (friction only, with mu). dir.from is level (degrees from horizontal) or surface (degrees from the surface). forceScale is newtons per centimeter; values shows magnitudes; net: { "show": true } draws the net force.`,
}

const GUIDES = {
  graph: {
    label: 'Graph', about: '2D and 3D graphs of functions, curves, regions, points, sliders, vector fields, ODEs and data, like Desmos. Lines can appear at steps.',
    make: makeGraph, size: () => ({ w: 560, h: 400 }), fit: { cap: 1, fw: 0.92, fh: 0.85 }, read: readGraph,
    text: `spec: { "expressions": [lines], and optional view, xLabel, yLabel, xScale, yScale, dims, grid, axes, axisNumbers, equalScale, showSliders, theme, background, camera, spin }.

Each line is { "text": "…" } with optional color, step (the slide step it appears at), style (solid, dashed, dotted), width, label, hidden. Line kinds, by example:
- explicit: "y = x^2 - 2", "x = sin y"; function: "f(x) = e^(-x^2)"
- implicit: "x^2 + y^2 = 9"; region: "y < 0.5x + 1", "1 < x^2 + y^2 < 4"
- polar: "r = 2 + 2cos θ"; parametric: "(3cos t, 2sin t)" with min and max for t
- point: "(2, 3)" (label, showCoords); "(p, q)" with sliders p and q is draggable
- slider: "a = 2" with { "slider": { "min": -5, "max": 5, "step": 0.1 } }; derived value: "c = 2a"
- piecewise: "y = {x < 0: -x, x^2}"; restricted: "y = √x {0 < x < 4}"
- vector field: "F(x, y) = (-y, x)"; system: "(x', y') = (y, -sin x - 0.3y)"; slope field: "dy/dx = x - y" with a solution "y(0) = 1"; trajectory: "(x, y)(0) = (1, 0)"
- data: { "data": { "dataset": "planets", "x": "period", "y": "mass", "mark": "points" } }, with optional colorBy, sizeBy, label, xErr, yErr (columns), from list_datasets
Variables are ${RESERVED_2D}; any other name needs a slider or value line. Implicit multiplication (2x), sin^2 x, |x|, a_1, π and √ work.

3D ("dims": 3, variables ${RESERVED_3D}): surface "z = sin x cos y", implicit "x^2 + y^2 + z^2 = 36", parametric surface "((6+2cos v)cos u, (6+2cos v)sin u, 2sin v)", curve "(5cos t, 5sin t, t/2)", point "(2, 3, 4)", volume "w = sin x + sin y + sin z". camera: { "turn": 35, "tilt": 25 }.

view: { "xMin": -10, "xMax": 10, "yMin": -7, "yMax": 7 } (and zMin, zMax in 3D). xScale/yScale: "log" for log axes (2D). equalScale (default true) keeps circles round; set it false to fit any ranges.

Example: { "op": "add_element", "slide": 3, "type": "graph", "x": 200, "y": 120, "spec": { "expressions": [ { "text": "y = A e^(-kx)" }, { "text": "A = 5", "slider": { "min": 1, "max": 10, "step": 0.5 } }, { "text": "k = 0.5", "slider": { "min": 0.1, "max": 2, "step": 0.1 } } ], "view": { "xMin": 0, "xMax": 10, "yMin": 0, "yMax": 10 }, "equalScale": false, "xLabel": "t (s)", "yLabel": "N" } }`,
  },
  equation: {
    label: 'Equation', about: 'An equation whose parts are labeled and explained, one at a time at steps or on hover, with callouts, braces or a linked sentence.',
    make: makeEquation, size: () => ({ w: shared.EQUATION_SIZE.w, h: shared.EQUATION_SIZE.h }), fit: { cap: 1, fw: 0.95, fh: 0.8 }, read: readEquation,
    text: `spec: { "latex": "…", "terms": [{ "id", "label", "note", "color" }], and optional labelStyle (callout, brace, sentence), sentence, interaction (steps, hover, both), stepStart, showAll, keepTinted, fontSize (default 44), labelSize, textColor }.

latex is KaTeX math; wrap each part to explain as \\term{id}{…}, and give each a term with a short label and a one-line note. Colors come from a palette unless given. With labelStyle "sentence", sentence links phrases to terms: "[what you believe after the data](t1) is …". For a plain equation, a text box with $$…$$ is simpler.

Example: { "op": "add_element", "slide": 2, "type": "equation", "spec": { "latex": "\\\\term{F}{F} = \\\\term{m}{m}\\\\,\\\\term{a}{a}", "terms": [ { "id": "F", "label": "Net force", "note": "In newtons" }, { "id": "m", "label": "Mass", "note": "In kilograms" }, { "id": "a", "label": "Acceleration", "note": "In m/s²" } ] } }`,
  },
  table: {
    label: 'Table', about: 'A table of plain-text cells, with a header row.',
    make: makeTable, size: tableSize, fit: { cap: 1, fw: 0.92, fh: 0.8 }, read: readTable,
    text: `spec: { "data": [["Header 1", "Header 2"], ["a", "b"]], and optional headerRow (default true), fontSize (default 16), textColor, borderColor, borderWidth, headerBgColor, cellBgColor, cellPadding }. Up to 30 rows and 12 columns; cells are plain text (no Markdown or math). Colors default to ones that read on the slide.

Example: { "op": "add_element", "slide": 4, "type": "table", "x": 80, "y": 140, "width": 800, "spec": { "data": [["Planet", "Mass (Earths)"], ["Mars", "0.107"], ["Jupiter", "317.8"]] } }`,
  },
  code: {
    label: 'Code', about: 'A block of code, highlighted for its language.',
    make: makeCode, size: codeSize, fit: { cap: 1, fw: 0.92, fh: 0.85 }, read: readCode,
    text: `spec: { "content": "the code", "language": one of ${CODE_LANGUAGES.join(', ')}, and optional fontSize (8 to 32, default 16), borderRadius }. The highlighting theme is the presentation's own.

Example: { "op": "add_element", "slide": 5, "type": "code", "x": 80, "y": 130, "spec": { "language": "python", "content": "def rc(t, tau):\\n    return 1 - math.exp(-t / tau)" } }`,
  },
  latex: {
    label: 'LaTeX', about: 'A TikZ picture, a LaTeX tabular, or display math, drawn from LaTeX source.',
    make: makeLatex, size: () => ({ w: 500, h: 380 }), fit: { cap: 1, fw: 0.9, fh: 0.85 }, read: readLatex,
    text: `spec: { "content": "LaTeX", and optional textColor (defaults to ink that reads on the slide), fontSize (20 is normal size) }.

What content holds decides how it's drawn: \\begin{tikzpicture}…\\end{tikzpicture} by TikZJax (core TikZ; not pgfplots — use a graph for plots); a tabular by latex.js (booktabs works); anything else as display math by KaTeX. For math in text, a text box with $…$ is simpler. TikZ draws in black: on a dark slide, start with \\begin{tikzpicture}[color=white] and use light colors for lines. fontSize scales the picture (20 is its natural size, 40 twice that). Check a TikZ picture with render_slide.

Example: { "op": "add_element", "slide": 6, "type": "latex", "x": 280, "y": 120, "width": 400, "height": 300, "spec": { "content": "\\\\begin{tikzpicture}\\n\\\\draw[->] (0,0) -- (3,0) node[right] {$x$};\\n\\\\draw[->] (0,0) -- (0,2) node[above] {$y$};\\n\\\\end{tikzpicture}" } }`,
  },
  timeline: {
    label: 'Timeline', about: 'Events along a line of dates or years, alternating above and below it.',
    make: makeTimeline, size: (f, cx) => ({ w: cx.slideW - 80, h: 260 }), fit: { cap: 1, fw: 0.96, fh: 0.6 }, read: readTimeline,
    text: `spec: { "startDate", "endDate", "items": [{ "date", "label", "description", "side" }], and optional tickSpacing (auto, day, month, year, 10year, 100year, 1000year), lineColor, dotColor, textColor, fontSize }. Dates are all ISO dates ("2024-06-01") or all years ("1905", "-300"). Items alternate top and bottom unless side says.

Example: { "op": "add_element", "slide": 2, "type": "timeline", "x": 40, "y": 160, "spec": { "startDate": "1900", "endDate": "1930", "items": [ { "date": "1905", "label": "Special relativity" }, { "date": "1915", "label": "General relativity" }, { "date": "1927", "label": "Copenhagen" } ] } }`,
  },
  circuit: {
    label: 'Circuit diagram', about: 'An electric circuit with US or IEC symbols, its currents and meter readings worked out, switches that flip at steps.',
    parts: true, fit: { cap: 1, fw: 0.6, fh: 0.7 }, text: PART_RULES.circuit,
  },
  feynman: {
    label: 'Feynman diagram', about: 'A Feynman diagram, its lines drawn in at steps.',
    parts: true, fit: { cap: 1, fw: 0.6, fh: 0.7 }, text: PART_RULES.feynman,
  },
  logic: {
    label: 'Logic diagram', about: 'Logic gates and flip-flops with their signals worked out, inputs that flip at steps, and a truth table.',
    parts: true, fit: { cap: 1, fw: 0.7, fh: 0.7 }, text: PART_RULES.logic,
  },
  freebody: {
    label: 'Free-body diagram', about: 'A body on a surface with its forces drawn to scale, unknown forces solved, components and angles.',
    parts: true, fit: { cap: 1, fw: 0.6, fh: 0.75 }, text: PART_RULES.freebody,
  },
  venn: {
    label: 'Venn diagram', about: 'Up to four sets with a set expression shaded, built up at steps; region counts, probabilities and members.',
    keepsShape: true, make: makeVenn, templates: shared.VENN_TEMPLATES, size: shared.vennBox, fit: { cap: 1, fw: 0.6, fh: 0.75 }, read: readVenn, fromTemplate: true,
    text: `spec: { "sets": [{ "id": "A", "label": "A", "color" }] (1 to 4; ids are single letters), "expr": "…", and optional layout, universe ({ "show", "label" }), notation ({ "complement": "prime" | "c" | "bar" }), facts, members, regions, buildUp }.

expr shades the regions it names: ∪ (or |, or, \\cup), ∩ (or &, and, \\cap, AB), ∖ (or -, \\setminus), Δ (xor), complement A' (or ¬A, A^c, \\overline{A}), brackets, U for the universe, ∅. One relation draws both sides and says whether it holds: = , ≠, ⊆ (\\subseteq), ⊊. layout: for 2 sets overlap, inside or apart; for 3 classic, row or nested; 4 sets use ellipses. facts give numbers to solve for: "|A ∩ B| = 7", "n(A) = 22", "P(A) = 0.3", "P(A | B) = 1/4"; with regions: { "values": "counts" } (or probability) they show in the regions. members: { "U": "1..12", "A": "2, 4, 6" } places elements. buildUp: "every" builds the shading up a step at a time (or "sides", each side of a relation).

Example: { "op": "add_element", "slide": 3, "type": "venn", "spec": { "sets": [ { "id": "A", "label": "Cats" }, { "id": "B", "label": "Dogs" } ], "expr": "A ∩ B'", "buildUp": "every" } }`,
  },
  timing: {
    label: 'Timing diagram', about: 'Digital waveforms from WaveJSON (WaveDrom), revealed cycle by cycle at steps; also register and bit-field drawings.',
    keepsShape: true, make: makeTiming, templates: shared.TIMING_TEMPLATES, size: shared.timingBox, fit: { cap: 1.6, fw: 0.9, fh: 0.8 }, read: readTiming, fromTemplate: true,
    text: `spec: { "source": "WaveJSON", and optional steps ([{ "to": cycle, "caption" }], revealing up to a cycle each), revealFrom (cycles shown before the first step), cursor, theme }.

source is WaveDrom's WaveJSON (JSON5): { signal: [ { name: "clk", wave: "p......" }, { name: "data", wave: "x.=.=.x", data: ["A", "B"] }, {}, { name: "ready", wave: "0..1..0" } ] }. Wave characters: p/n clock, 0 1 levels, x unknown, z high impedance, = 2-9 data (named in data), . repeat, | gap. Groups: ["name", {…}, {…}]. Also { reg: [ { bits: 8, name: "opcode" } ] } for a register.

Example: { "op": "add_element", "slide": 4, "type": "timing", "spec": { "source": "{ signal: [ { name: 'clk', wave: 'p.....' }, { name: 'req', wave: '01..0.' }, { name: 'ack', wave: '0.1..0' } ] }", "steps": [ { "to": 2, "caption": "Request" }, { "to": 3, "caption": "Acknowledge" } ] } }`,
  },
  geometry: {
    label: 'Geometry construction', about: 'A compass-and-straightedge construction from a script, drawn in at steps; its points can be dragged when presenting.',
    make: makeGeometry, templates: shared.GEOMETRY_TEMPLATES, size: (f, cx) => { const w = Math.min(shared.GEOMETRY_SIZE.w, cx.slideW * 0.9); return { w, h: Math.round(w * shared.GEOMETRY_SIZE.h / shared.GEOMETRY_SIZE.w) } },
    fit: { cap: 1, fw: 0.9, fh: 0.85 }, read: readGeometry, fromTemplate: true, sized: true,
    text: `spec: { "script": "one object a line", and optional view ({ "x", "y", "w" }: the point at the center and the width shown; fitted to the figure if left out), axes, grid, steps, start, tidy, captions, theme }.

Each line is name = Command(args) {options}; args are earlier names or numbers; # starts a comment. Commands: A = Point(1, 2); C = PointOn(c, 0.5); P = Intersect(c, d, 0) (0 or 1); M = Midpoint(A, B); s = Segment(A, B); l = Line(A, B); r = Ray(A, B); c = Circle(A, B) (center, through); k = Circle(A, B, C) (through three); p = Perpendicular(P, l) or Perpendicular(P, A, B); q = Parallel(P, l); m = PerpendicularBisector(A, B); b = AngleBisector(A, B, C); t = Polygon(A, B, C); α = Angle(A, B, C) (vertex B); d = Distance(A, B). Options: construction, hidden, dashed, color=red|blue|green|yellow|purple (named only), label, label=none, label=text. By default each object after the first points is drawn in at a step of its own; tidy hides construction lines at the end.

Example: { "op": "add_element", "slide": 5, "type": "geometry", "spec": { "script": "A = Point(-3, -1)\\nB = Point(3, -1)\\nc1 = Circle(A, B) {construction}\\nc2 = Circle(B, A) {construction}\\nC = Intersect(c1, c2, 0)\\nt = Polygon(A, B, C)", "tidy": true } }`,
  },
  periodic: {
    label: 'Periodic table', about: 'The periodic table, colored by category or a property, with highlights, trend arrows and element cards at steps.',
    make: makePeriodic, size: f => shared.periodicBox(f), fit: { cap: 99, fw: 0.94, fh: 0.92 }, read: readPeriodic,
    text: `spec (all optional): colorBy (category, block, state, en, ie, ea, radius, mp, bp, density, mass, year), show (all, periods-1-4, main-group, periods-1-3, element), highlight ("group:1,2;period:3;block:p;category:Halogen;state:Gas;z:6,O"), arrow (en, ie, ea, radius, metallic: a trend arrow), restingElement (an element's symbol or Z for its card, or null), card (gap, side, none), orbitalView (boxes, shells, clouds, none), tileLabel, labels, legend, steps ([{ "highlight", "pin", "arrow", "colorBy" }], one a step).

Example: { "op": "add_element", "slide": 6, "type": "periodic", "spec": { "colorBy": "en", "arrow": "en", "highlight": "group:17", "restingElement": "F" } }`,
  },
  harmonics: {
    label: 'Spherical harmonics', about: 'Spherical harmonics and orbitals in 3D: lobes, spheres, maps or a table, with sums such as hybrid orbitals.',
    make: makeHarmonics, templates: shared.HARMONICS_TEMPLATES, size: (f, cx) => ({ w: Math.round(cx.slideW * 0.6), h: Math.round(cx.slideH * 0.72) }), fit: { cap: 1, fw: 0.6, fh: 0.72 }, read: readHarmonics, fromTemplate: true,
    text: `spec (all optional): source (single, sum, cap, sky), l (0 to 60) and m (−l to l) for single, form (complex, real), expr for a sum ("(s + p_x + p_y + p_z)/2", "Y(2,1) + Y(2,-1)", orbital names, Y_l^m), part (auto, re, im, abs, abs2), view (lobes, sphere, shape, map, table), motion (none, spin, wave), nodes, axes, label (none, name, formula), steps ([picture fields + caption], each step changing what it names).

Example: { "op": "add_element", "slide": 7, "type": "harmonics", "spec": { "source": "single", "l": 3, "m": 2, "form": "real", "view": "lobes", "nodes": true } }`,
  },
}

// The part diagrams' make, size and read, from PART_DIAGRAMS
for (const [type, d] of Object.entries(PART_DIAGRAMS)) {
  Object.assign(GUIDES[type], {
    templates: d.templates, fromTemplate: true, keepsShape: true,
    make: (spec, cx, template) => makeParts(type, spec, cx, template),
    size: d.box, read: el => d.read(el),
  })
}

// The fields each type keeps on its element, which update_element's spec
// changes
const FIELDS = {
  graph: shared.GRAPH_FIELDS, equation: shared.EQUATION_FIELDS,
  table: ['data', 'headerRow', 'fontSize', 'textColor', 'borderColor', 'borderWidth', 'headerBgColor', 'cellBgColor', 'cellPadding'],
  code: ['content', 'language', 'fontSize', 'borderRadius'], latex: ['content', 'textColor', 'fontSize'],
  timeline: ['startDate', 'endDate', 'items', 'tickSpacing', 'lineColor', 'dotColor', 'textColor', 'fontSize'],
  ...Object.fromEntries(Object.entries(PART_DIAGRAMS).map(([type, d]) => [type, d.fields])),
  venn: shared.VENN_FIELDS, timing: shared.TIMING_FIELDS, geometry: shared.GEOMETRY_FIELDS, periodic: shared.PERIODIC_FIELDS, harmonics: shared.HARMONICS_FIELDS,
}

const TYPES = Object.keys(GUIDES)

// An element's fields from spec, or a template and spec: { fields, notes }.
// With `element`, the spec changes that element: the fields it gives replace
// the element's, and the rest stay as they are.
function makeSpec(type, spec = {}, cx, { template, size, element = null } = {}) {
  const guide = GUIDES[type]
  object(spec, 'spec')
  if (template !== undefined && !guide.fromTemplate) fail(`${type} has no templates; give its spec.`)
  if (template !== undefined) str(template, 'template', 40, { min: 1 })
  let input = spec
  const kept = {}
  if (element && template === undefined) {
    const own = pick(element, FIELDS[type])
    for (const key of Object.keys(own)) if (spec[key] === undefined) kept[key] = true
    input = { ...own, ...spec }
    // A new script is framed and stepped afresh, unless the spec says how
    if (type === 'geometry' && spec.script !== undefined) {
      if (spec.view === undefined) delete input.view
      if (spec.steps === undefined) delete input.steps
    }
  }
  const out = guide.make(input, cx, template, size, kept)
  return out && out.fields ? { fields: out.fields, notes: out.notes || [] } : { fields: out, notes: [] }
}

// The size an element is drawn at by default: its natural size, scaled to
// fit the slide as its editor does
function defaultSize(type, fields, cx) {
  const guide = GUIDES[type]
  const box = guide.size(fields, cx) || {}
  const w = Number(box.w) > 0 ? box.w : 480, h = Number(box.h) > 0 ? box.h : 320
  const { cap, fw, fh } = guide.fit
  const scale = Math.min(cap, (cx.slideW * fw) / w, (cx.slideH * fh) / h)
  return { w: Math.max(20, Math.round(w * scale)), h: Math.max(20, Math.round(h * scale)), ratio: h / w }
}

// get_element_guide: one type's guide, or what every type is
function guideText(type) {
  if (!type) {
    return ['Elements add_element takes besides text and shape, by type. Read one\'s guide before adding it: get_element_guide with its type.', '',
      ...TYPES.map(t => `- **${t}** (${GUIDES[t].label}): ${GUIDES[t].about}${GUIDES[t].templates ? ` Templates: ${GUIDES[t].templates.map(x => x.key ?? x.id).join(', ')}.` : ''}`),
      '', 'Images, video, molecules, HTML and plugins can\'t be added through a link yet: describe them to the person.'].join('\n')
  }
  const guide = GUIDES[type]
  const lines = [`# ${guide.label} (type "${type}")`, '', guide.about, '', 'add_element takes it with type, slide, a position and size (x, y, width, height; it is centered at a size that fits if left out), and spec. update_element changes it with spec: the fields given replace the ones there.', '']
  if (guide.parts) lines.push(`spec: the diagram's fields (${PART_DIAGRAMS[type].fields.join(', ')}). Most diagrams start best from a template ("template": "${guide.templates[0].key}"), with spec changing labels and values; or give the whole diagram.`, '')
  lines.push(guide.text)
  if (guide.templates) lines.push('', `Templates ("template": key, with spec to change it): ${guide.templates.map(t => `${t.key ?? t.id} (${t.name})`).join('; ')}.`)
  if (guide.parts) {
    const t = guide.templates.find(x => x.key !== 'blank') || guide.templates[0]
    lines.push('', `The "${t.key}" template's spec, as an example of the whole form:`, '', '```json', JSON.stringify(pick(t.build(), PART_DIAGRAMS[type].parts)), '```')
  }
  lines.push('', 'Steps: a diagram\'s step n is the slide\'s click n (with stepStart 1), counted with the slide\'s other steps. Check how it came out with render_slide.')
  return lines.join('\n')
}

// get_slide's lines for an element of one of these types, or null
function readElement(el) {
  const guide = GUIDES[el.type]
  if (!guide || !guide.read) return null
  try { return guide.read(el) } catch { return null }
}

module.exports = { GUIDES, TYPES, FIELDS, makeSpec, defaultSize, guideText, readElement, CODE_LANGUAGES }

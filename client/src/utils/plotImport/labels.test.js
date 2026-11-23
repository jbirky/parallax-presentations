// @vitest-environment node
// A kept figure's titles and axis labels: found in its SVG and its PDF
// alike (plotModel.js), and their words drawn again when they're changed as
// matplotlib draws text (glyphs.js), in the SVG's pieces (splitSvg.js) and
// in the plan of the PDF's (splitPdf.js)
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import { Window } from 'happy-dom'
import * as opentype from 'opentype.js'
import { readPdfDrawing } from './pdfReader'
import { readSvgDrawing } from './svgReader'
import { plotFromDrawing } from './plotModel'
import { splitSvg } from './splitSvg'
import { planPdf } from './splitPdf'
import { partsOf } from './toFigure'
import { textOutline, advanceOf, fontFor, shiftFor } from './glyphs'

const require = createRequire(import.meta.url)
const fixture = name => new URL(`./fixtures/${name}`, import.meta.url)
const { DOMParser, XMLSerializer } = new Window()
const opts = { Parser: DOMParser, Serializer: XMLSerializer }
let pdfjs, face
beforeAll(async () => {
  pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href
  const buf = readFileSync(require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf'))
  face = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
})
const svgText = name => readFileSync(fixture(`${name}.svg`), 'utf8')
const readSvg = name => plotFromDrawing(readSvgDrawing(svgText(name), DOMParser))
const readPdf = async name => plotFromDrawing(await readPdfDrawing(new Uint8Array(readFileSync(fixture(`${name}.pdf`))), pdfjs))
const parse = svg => new DOMParser().parseFromString(svg, 'image/svg+xml')
const byId = (doc, id) => [...doc.getElementsByTagName('*')].find(e => e.getAttribute('id') === id)

describe('a figure’s titles and axis labels', () => {
  it('lays words out as matplotlib does: every glyph where its SVGs put it', () => {
    let worst = 0, glyphs = 0
    for (const name of ['decay', 'pair', 'grid', 'loglog', 'bars', 'inset', 'twinx', 'classic']) {
      for (const m of svgText(name).matchAll(/<!-- ([^>]+?) -->\s*<g transform="translate\([^)]*\)(?: rotate\([^)]*\))? scale\(([\d.]+) -[\d.]+\)">([\s\S]*?)<\/g>/g)) {
        if (m[1].includes('$')) continue
        const uses = [...m[3].matchAll(/<use xlink:href="#DejaVuSans-([0-9a-f]+)"(?: transform="translate\(([\d.]+) 0\)")?/g)]
        // Each glyph's place: the width of the words before it
        uses.forEach((u, k) => {
          const before = uses.slice(0, k + 1).map(v => String.fromCodePoint(parseInt(v[1], 16))).join('')
          const at = textOutline(face, before, 100).width - advanceOf(face, before.at(-1))
          worst = Math.max(worst, Math.abs(at - +(u[2] || 0)))
          glyphs++
        })
      }
    }
    expect(glyphs).toBeGreaterThan(300)
    expect(worst).toBeLessThan(1e-6)
    // r and e kerned, an eighth of a unit at 100 points as matplotlib rounds it
    expect(textOutline(face, 're', 100).width).toBeCloseTo(advanceOf(face, 'r') + advanceOf(face, 'e') - 2.25, 6)
    expect(textOutline(face, 'Ab', 10).d).toMatch(/^M/)
    expect(fontFor('DejaVuSans-Bold')).toBe('DejaVuSans-Bold')
    expect(fontFor('Helvetica')).toBe('DejaVuSans')
    expect(shiftFor('center', 40, 60)).toBe(-10)
    expect(shiftFor('end', 40, 60)).toBe(-20)
  })

  it('finds them in an SVG and in a PDF alike, and how each lines up with its axes', async () => {
    const pick = l => [l.id, l.s, l.align, l.angle, Math.round(l.size)]
    for (const name of ['decay', 'pair', 'bars']) {
      const svg = readSvg(name), pdf = await readPdf(name)
      expect(svg.labels.map(pick), name).toEqual(pdf.labels.map(pick))
      for (const l of svg.labels) expect(l.gid).toMatch(/^text_\d+$/)
      for (const l of pdf.labels) { expect(l.ops.length).toBeGreaterThan(0); expect(l.fill).toBe('#000000') }
    }
    expect(readSvg('decay').labels.map(pick)).toEqual([['xlabel', 'time (s)', 'center', 0, 10], ['ylabel', 'signal (V)', 'center', 90, 10]])
    expect(readSvg('pair').labels.map(l => l.id)).toEqual(['p1:title', 'p1:xlabel', 'p2:title', 'suptitle'])
    // (the legends' words are none of them)
    expect(readSvg('grid').labels).toEqual([])
    // Exact widths in a PDF
    for (const l of (await readPdf('decay')).labels) expect(l.w).toBeCloseTo(textOutline(face, l.s, l.size).width, 1)
  })

  it('draws an SVG’s changed label again where it lined up, as matplotlib would', () => {
    const plot = readSvg('decay')
    const labels = plot.labels.map(l => (l.id === 'xlabel' ? { ...l, text: 'elapsed time (seconds)', face } : l))
    const plain = splitSvg(svgText('decay'), partsOf(plot, 'svg'), { ...opts, labels: plot.labels })
    const out = splitSvg(svgText('decay'), partsOf(plot, 'svg'), { ...opts, labels })
    expect(out.plan).toBe(plain.plan)
    expect(out.pieces[0].labels).toEqual(['xlabel', 'ylabel'])
    expect(out.pieces.slice(1).every(p => !p.labels.length)).toBe(true)
    for (let k = 1; k < out.pieces.length; k++) expect(out.pieces[k].svg).toBe(plain.pieces[k].svg)
    const doc = parse(out.pieces[0].svg)
    const g = byId(doc, 'text_7')
    expect([...g.childNodes].find(n => n.nodeType === 8).nodeValue.trim()).toBe('elapsed time (seconds)')
    expect(g.getElementsByTagName('use')).toHaveLength(0)
    const drawn = g.firstElementChild
    expect(drawn.firstElementChild.localName).toBe('path')
    // Centered where "time (s)" was: its middle stays put
    const [ox] = /translate\(([\d.]+) ([\d.]+)\) scale/.exec(svgText('decay').split('<!-- time (s) -->')[1]).slice(1).map(Number)
    const [nx] = /translate\(([\d.]+) ([\d.]+)\)/.exec(drawn.getAttribute('transform')).slice(1).map(Number)
    const oldW = textOutline(face, 'time (s)', 10).width, newW = textOutline(face, 'elapsed time (seconds)', 10).width
    expect(ox + oldW / 2).toBeCloseTo(nx + newW / 2, 4)
    // Its glyphs' outlines no longer needed, but the y label's kept
    expect(out.pieces[0].svg).toContain('id="DejaVuSans-6e"')
    // A turned label turns the same way; no words, no label
    const up = splitSvg(svgText('decay'), partsOf(plot, 'svg'), { ...opts, labels: plot.labels.map(l => (l.id === 'ylabel' ? { ...l, text: 'voltage (mV)', face } : l)) })
    expect(byId(parse(up.pieces[0].svg), 'text_13').firstElementChild.getAttribute('transform')).toMatch(/ rotate\(-90\)$/)
    const gone = splitSvg(svgText('decay'), partsOf(plot, 'svg'), { ...opts, labels: plot.labels.map(l => (l.id === 'ylabel' ? { ...l, text: '', face } : l)) })
    expect(byId(parse(gone.pieces[0].svg), 'text_13')).toBeUndefined()
  })

  it('knows which of a PDF’s runs draw each label', async () => {
    const plot = await readPdf('pair')
    const ops = await (async () => {
      const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync(fixture('pair.pdf'))), verbosity: 0 })
      try { return await (await (await task.promise).getPage(1)).getOperatorList() } finally { task.destroy() }
    })()
    const { runs } = planPdf(ops, partsOf(plot, 'pdf'), pdfjs.OPS, { labels: plot.labels })
    const where = Object.fromEntries(plot.labels.map(l => [l.id, runs.filter(r => r.labels.includes(l)).map(r => r.part)]))
    expect(where).toEqual({ 'p1:title': ['p1'], 'p1:xlabel': ['p1'], 'p2:title': ['p2'], suptitle: ['base'] })
  })
})

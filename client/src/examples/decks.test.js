// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { exampleDeck, EXAMPLE_SLUGS, SHOWCASE_SLUGS, CAFFEINE_SRC, JSXGRAPH_PLOT } from './decks'
import { SKETCH } from '../components/landing/FeatureShowcase'
import { EXAMPLES, EXAMPLE_FIELDS, HERO_EXAMPLE } from './catalog'
import { generateRevealHTML } from '../utils/generateHTML'
import { graphNeeds, dataGraphs, embedDatasetNames } from '../utils/deckData'
import { EXAMPLE_DATASETS, EXAMPLE_SOURCES } from './datasets'

const PUBLIC = path.join(__dirname, '../../public')
const types = deck => deck.slides.map(s => s.elements.map(e => e.type).filter(t => t !== 'text'))

describe('the example decks', () => {
  it('has a deck and a thumbnail for every card and the hero, in a field the filters offer', () => {
    for (const e of EXAMPLES) {
      expect(EXAMPLE_SLUGS).toContain(e.slug)
      expect(EXAMPLE_FIELDS).toContain(e.field)
      expect(fs.existsSync(path.join(PUBLIC, 'examples/thumbs', e.slug + '.jpg')), e.slug).toBe(true)
    }
    expect(EXAMPLE_SLUGS).toContain(HERO_EXAMPLE)
    expect(fs.existsSync(path.join(PUBLIC, 'examples/thumbs', HERO_EXAMPLE + '.jpg'))).toBe(true)
    expect(fs.existsSync(path.join(PUBLIC, CAFFEINE_SRC))).toBe(true)
  })

  it('starts the server’s list (migrations 017, 019 and 020) as the catalog has it', () => {
    const sql = ['017_landing_examples.sql', '019_exoplanets_example.sql', '020_gaia_example.sql'].map(f => fs.readFileSync(path.join(__dirname, '../../../server/migrations', f), 'utf8')).join('\n')
    const q = v => "'" + String(v).replace(/'/g, "''") + "'"
    EXAMPLES.forEach((e, i) => expect(sql, e.slug).toContain(`(${q(e.slug)}, ${q(e.field)}, ${q(e.title)}, ${q(e.desc)}, ${q(JSON.stringify(e.tags))}, TRUE, TRUE, FALSE, ${i + 1})`))
    expect(sql).toContain(`(${q(HERO_EXAMPLE)}, '', 'Parallax',`)
  })

  it('builds each from the elements it names', () => {
    expect(types(exampleDeck('hero'))).toEqual([['html'], ['feynman'], ['geometry']])
    expect(types(exampleDeck('chemistry'))).toEqual([['periodic'], ['molecule']])
    expect(types(exampleDeck('logic'))).toEqual([['logic'], ['timing']])
    expect(types(exampleDeck('rotation'))).toEqual([['graph'], ['equation']])
    expect(types(exampleDeck('orbitals'))).toEqual([['harmonics'], ['graph']])
    expect(types(exampleDeck('exoplanets'))).toEqual([['graph', 'html'], ['graph', 'html'], ['html', 'html']])
    expect(types(exampleDeck('gaia'))).toEqual([['graph', 'html'], ['graph', 'html']])
  })

  it('plots only datasets the server provides for examples', () => {
    const deck = exampleDeck('exoplanets')
    const names = new Set([...graphNeeds(dataGraphs(deck)).keys(), ...embedDatasetNames(deck, Object.keys(EXAMPLE_DATASETS))])
    expect([...names].sort()).toEqual(['discoveries', 'exoplanets', 'newest'])
    for (const name of names) expect(EXAMPLE_SOURCES[EXAMPLE_DATASETS[name].source], name).toBeTruthy()
    // The footer reads the list, so the deck carries only the small "newest" whole
    expect(embedDatasetNames(deck, Object.keys(EXAMPLE_DATASETS))).toEqual(new Set(['newest']))
  })

  it('plots the Gaia stars, carrying no dataset whole', () => {
    const deck = exampleDeck('gaia')
    expect([...graphNeeds(dataGraphs(deck)).keys()].sort()).toEqual(['nearby_stars', 'star_counts'])
    for (const name of ['nearby_stars', 'star_counts']) expect(EXAMPLE_DATASETS[name].source).toBe('gaia')
    expect(EXAMPLE_SOURCES.gaia.kind).toBe('tap')
    expect(embedDatasetNames(deck, Object.keys(EXAMPLE_DATASETS))).toEqual(new Set())
  })

  it('gives every element and slide an id of its own, and fits them on the slide', () => {
    for (const slug of EXAMPLE_SLUGS) {
      const deck = exampleDeck(slug)
      const ids = deck.slides.flatMap(s => [s.id, ...s.elements.map(e => e.id)])
      expect(new Set(ids).size, slug).toBe(ids.length)
      for (const e of deck.slides.flatMap(s => s.elements)) {
        expect(e.x >= 0 && e.y >= 0 && e.x + e.width <= deck.slideWidth && e.y + e.height <= deck.slideHeight, `${slug} ${e.id}`).toBe(true)
      }
    }
  })

  it('presents each one', () => {
    for (const slug of EXAMPLE_SLUGS) {
      const html = generateRevealHTML(exampleDeck(slug), { notes: false })
      expect(html, slug).toContain('Reveal.initialize')
    }
  })

  it('has the decks the landing page’s showcase plays, the code as its panel shows it', () => {
    expect(SHOWCASE_SLUGS).toEqual(['showcase-ai', 'showcase-cite', 'showcase-code', 'showcase-figure'])
    // The decay figure kept as matplotlib drew it: its pieces in drawing
    // order, the model's at step 1 and the measurements' at step 2, its file
    // there to edit its layers again
    const figure = exampleDeck('showcase-figure').slides[0].elements.filter(e => e.figure)
    expect(figure.map(e => e.src)).toEqual(['base', 'l2', 'l1', 'l2-2', 'base-2', 'legend', 'l1-2', 'l2-3'].map(p => `/examples/figure-layers/${p}.svg`))
    expect(new Set(figure.map(e => e.groupId)).size).toBe(1)
    expect(figure.filter(e => e.figure.part === 'l1').map(e => e.stateSteps)).toEqual([{ 1: null }, { 1: null }])
    expect(figure.filter(e => e.figure.part === 'l2').map(e => e.stateSteps)).toEqual([{ 2: null }, { 2: null }, { 2: null }])
    expect(figure.find(e => e.figure.part === 'legend').stateSteps).toEqual({ 1: null })
    expect(figure[0].figure).toMatchObject({ src: '/examples/figure-layers/decay.svg', file: 'decay.svg', part: 'base' })
    const cite = exampleDeck('showcase-cite')
    expect(cite.bibliography.map(e => e.key)).toEqual(['zwicky1933', 'rubin1970', 'bertone2018'])
    expect(JSON.stringify(cite.slides).match(/data-cite=/g)).toHaveLength(3)
    expect(generateRevealHTML(cite, { notes: false })).toContain('data-slide-id="references"')
    const code = exampleDeck('showcase-code').slides[0].elements[0]
    expect(code.type).toBe('html')
    expect(code.content).toContain(SKETCH)
    // The AI's slide: the HTML its guide shows an AI collaborator, with
    // JSXGraph at the version Parallax bundles, so it loads from Parallax
    const guide = createRequire(import.meta.url)('../../../server/mcp/guides.js').guideText('html')
    const example = guide.slice(guide.indexOf('{ "op"'))
    expect(JSON.parse(example.slice(0, example.indexOf('\n'))).spec.content).toBe(JSXGRAPH_PLOT)
    expect(exampleDeck('showcase-ai').slides[0].elements.find(e => e.type === 'html').content).toBe(JSXGRAPH_PLOT)
    const { devDependencies } = createRequire(import.meta.url)('../../../package.json')
    expect(JSXGRAPH_PLOT).toContain(`cdn.jsdelivr.net/npm/jsxgraph@${devDependencies.jsxgraph}/`)
  })

  it('makes a fresh deck each time, and nothing for a name it doesn’t have', () => {
    const a = exampleDeck('venn'), b = exampleDeck('venn')
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
    for (const slug of ['nope', '__proto__', 'constructor', 'toString']) expect(exampleDeck(slug)).toBeNull()
  })
})

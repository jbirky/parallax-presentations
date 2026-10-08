// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { exampleDeck, EXAMPLE_SLUGS, CAFFEINE_SRC } from './decks'
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
    expect(types(exampleDeck('hero'))).toEqual([['graph'], ['feynman'], ['geometry']])
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

  it('makes a fresh deck each time, and nothing for a name it doesn’t have', () => {
    const a = exampleDeck('venn'), b = exampleDeck('venn')
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
    for (const slug of ['nope', '__proto__', 'constructor', 'toString']) expect(exampleDeck(slug)).toBeNull()
  })
})

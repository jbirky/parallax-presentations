// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { exampleDeck, EXAMPLE_SLUGS, CAFFEINE_SRC } from './decks'
import { EXAMPLES, EXAMPLE_FIELDS, HERO_EXAMPLE } from './catalog'
import { generateRevealHTML } from '../utils/generateHTML'

const PUBLIC = path.join(__dirname, '../../public')
const types = deck => deck.slides.map(s => s.elements.map(e => e.type).filter(t => t !== 'text'))

describe('the example decks', () => {
  it('has a deck and a thumbnail for every card, in a field the filters offer', () => {
    for (const e of EXAMPLES) {
      expect(EXAMPLE_SLUGS).toContain(e.slug)
      expect(EXAMPLE_FIELDS).toContain(e.field)
      expect(fs.existsSync(path.join(PUBLIC, 'examples/thumbs', e.slug + '.jpg')), e.slug).toBe(true)
    }
    expect(EXAMPLE_SLUGS).toContain(HERO_EXAMPLE)
    expect(fs.existsSync(path.join(PUBLIC, CAFFEINE_SRC))).toBe(true)
  })

  it('builds each from the elements it names', () => {
    expect(types(exampleDeck('hero'))).toEqual([['graph'], ['feynman'], ['geometry']])
    expect(types(exampleDeck('chemistry'))).toEqual([['periodic'], ['molecule']])
    expect(types(exampleDeck('logic'))).toEqual([['logic'], ['timing']])
    expect(types(exampleDeck('rotation'))).toEqual([['graph'], ['equation']])
    expect(types(exampleDeck('orbitals'))).toEqual([['harmonics'], ['graph']])
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

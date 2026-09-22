import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  findCitations, buildCitationIndex, nextCitationLabel, citationMarkerHtml,
  resolveCitationsInHtml, applyCitationNumbering, countStaleMarkers,
} from './citationIndex'

const smith = { key: 'smith2020', type: 'article', author: 'Smith, John', title: 'Alpha Paper', year: '2020' }
const doe = { key: 'doe2019', type: 'article', author: 'Doe, Jane and Roe, Rick', title: 'Beta Paper', year: '2019' }
const ames = { key: 'ames2021', type: 'article', author: 'Ames, Ada', title: 'Gamma Paper', year: '2021' }

const marker = (key, label) => `<sup data-cite="${key}" style="color:#6366f1">${label}</sup>`

function pres(slides, over = {}) {
  return { slideWidth: 960, slideHeight: 540, bibliography: [smith, doe, ames], slides, ...over }
}
const text = (id, content, pos = {}) => ({
  id, type: 'text', x: pos.x ?? 0, y: pos.y ?? 0, width: 400, height: 60, zIndex: 1, content,
})

describe('findCitations', () => {
  it('finds keyed markers', () => {
    expect(findCitations(`a ${marker('doe2019', '[1]')} b`, [smith, doe]))
      .toEqual([{ pos: 2, key: 'doe2019' }])
  })

  it('finds legacy numbers by library position', () => {
    expect(findCitations('see [2] here', [smith, doe])[0].key).toBe('doe2019')
  })

  it('finds a bare key or an author-short mention', () => {
    expect(findCitations('as in smith2020', [smith]).map(h => h.key)).toEqual(['smith2020'])
    expect(findCitations('as in Doe & Roe (2019)', [doe]).map(h => h.key)).toEqual(['doe2019'])
  })

  it('ignores numbers with no entry behind them', () => {
    expect(findCitations('array[9] index', [smith])).toEqual([])
  })

  it('returns hits in the order they appear', () => {
    const hits = findCitations(`${marker('ames2021', '[1]')} then smith2020`, [smith, doe, ames])
    expect(hits.map(h => h.key)).toEqual(['ames2021', 'smith2020'])
  })

  it('has nothing to say about empty text', () => {
    expect(findCitations('', [smith])).toEqual([])
    expect(findCitations(undefined, [smith])).toEqual([])
  })
})

describe('buildCitationIndex — what gets indexed', () => {
  it('indexes only entries the deck cites', () => {
    const index = buildCitationIndex(pres([
      { id: 's1', elements: [text('e1', `body ${marker('doe2019', '[1]')}`)] },
    ]))
    expect(index.entries.map(e => e.key)).toEqual(['doe2019'])
    expect(index.numberByKey).toEqual({ doe2019: 1 })
    expect(index.citedCount).toBe(1)
  })

  it('is empty when nothing is cited', () => {
    const index = buildCitationIndex(pres([{ id: 's1', elements: [text('e1', '<p>plain</p>')] }]))
    expect(index.entries).toEqual([])
    expect(index.labelByKey).toEqual({})
  })

  it('survives a missing bibliography or slides', () => {
    expect(buildCitationIndex(undefined).entries).toEqual([])
    expect(buildCitationIndex({}).entries).toEqual([])
  })

  it('drops a citation whose entry has left the library', () => {
    const index = buildCitationIndex(pres(
      [{ id: 's1', elements: [text('e1', marker('gone2000', '[1]'))] }],
      { bibliography: [smith] },
    ))
    expect(index.entries).toEqual([])
  })
})

describe('buildCitationIndex — presentation order', () => {
  it('numbers by first appearance across slides', () => {
    const index = buildCitationIndex(pres([
      { id: 's1', elements: [text('e1', marker('ames2021', '[9]'))] },
      { id: 's2', elements: [text('e2', marker('smith2020', '[9]'))] },
    ]))
    expect(index.entries.map(e => e.key)).toEqual(['ames2021', 'smith2020'])
    expect(index.numberByKey).toEqual({ ames2021: 1, smith2020: 2 })
  })

  it('reads a slide top to bottom, left to right', () => {
    const index = buildCitationIndex(pres([{
      id: 's1',
      elements: [
        text('low', marker('smith2020', '[?]'), { x: 0, y: 400 }),
        text('right', marker('doe2019', '[?]'), { x: 500, y: 40 }),
        text('left', marker('ames2021', '[?]'), { x: 20, y: 40 }),
      ],
    }]))
    expect(index.entries.map(e => e.key)).toEqual(['ames2021', 'doe2019', 'smith2020'])
  })

  it('counts an entry once, at its first appearance', () => {
    const index = buildCitationIndex(pres([
      { id: 's1', elements: [text('e1', `${marker('doe2019', '[1]')} ${marker('smith2020', '[2]')}`)] },
      { id: 's2', elements: [text('e2', marker('doe2019', '[1]'))] },
    ]))
    expect(index.entries.map(e => e.key)).toEqual(['doe2019', 'smith2020'])
  })

  it('picks up citations on image captions too', () => {
    const index = buildCitationIndex(pres([{
      id: 's1',
      elements: [{ id: 'img', type: 'image', x: 0, y: 0, width: 100, height: 100, zIndex: 1, src: '/a.png', citationText: 'Ames, Ada (2021)' }],
    }]))
    expect(index.entries.map(e => e.key)).toEqual(['ames2021'])
  })
})

describe('buildCitationIndex — alphabetical order', () => {
  const cited = [
    { id: 's1', elements: [text('e1', `${marker('smith2020', '[1]')} ${marker('doe2019', '[2]')} ${marker('ames2021', '[3]')}`)] },
  ]

  it('orders by first author last name', () => {
    const index = buildCitationIndex(pres(cited, { citationOrder: 'alphabetical' }))
    expect(index.entries.map(e => e.key)).toEqual(['ames2021', 'doe2019', 'smith2020'])
    expect(index.numberByKey).toEqual({ ames2021: 1, doe2019: 2, smith2020: 3 })
  })

  it('still indexes only what is cited', () => {
    const index = buildCitationIndex(pres(
      [{ id: 's1', elements: [text('e1', marker('smith2020', '[1]'))] }],
      { citationOrder: 'alphabetical' },
    ))
    expect(index.entries.map(e => e.key)).toEqual(['smith2020'])
  })

  it('breaks ties on year, then title', () => {
    const a = { key: 'a', author: 'Lee, Ann', title: 'Zebra', year: '2001' }
    const b = { key: 'b', author: 'Lee, Ann', title: 'Apple', year: '1999' }
    const c = { key: 'c', author: 'Lee, Ann', title: 'Apple', year: '2001' }
    const index = buildCitationIndex({
      bibliography: [a, b, c], citationOrder: 'alphabetical',
      slides: [{ id: 's1', elements: [text('e1', `${marker('a', 'x')}${marker('b', 'x')}${marker('c', 'x')}`)] }],
    })
    expect(index.entries.map(e => e.key)).toEqual(['b', 'c', 'a'])
  })

  it('falls back to the raw author field when it cannot be parsed', () => {
    const odd = { key: 'odd', author: '', title: 'Anonymous Report' }
    const index = buildCitationIndex({
      bibliography: [odd, ames], citationOrder: 'alphabetical',
      slides: [{ id: 's1', elements: [text('e1', `${marker('odd', 'x')}${marker('ames2021', 'x')}`)] }],
    })
    expect(index.entries.map(e => e.key)).toEqual(['ames2021', 'odd'])
  })
})

describe('citation labels', () => {
  const deck = pres([{ id: 's1', elements: [text('e1', `${marker('doe2019', '[1]')} ${marker('smith2020', '[2]')}`)] }])

  it('labels numbered style by index position', () => {
    expect(buildCitationIndex(deck).labelByKey).toEqual({ doe2019: '[1]', smith2020: '[2]' })
  })

  it('labels author-year style from the entry', () => {
    const index = buildCitationIndex({ ...deck, citationStyle: 'author-year' })
    expect(index.labelByKey.doe2019).toBe('(Doe & Roe, 2019)')
  })

  it('gives a citation about to be inserted the next free number', () => {
    expect(nextCitationLabel(deck, ames)).toBe('[3]')
  })

  it('reuses the number of an entry already cited', () => {
    expect(nextCitationLabel(deck, smith)).toBe('[2]')
  })

  it('writes a marker carrying the entry key', () => {
    expect(citationMarkerHtml(smith, '[2]')).toContain('data-cite="smith2020"')
    expect(citationMarkerHtml(smith, '[2]')).toContain('>[2]</sup>')
  })
})

describe('resolveCitationsInHtml', () => {
  it('refreshes the label inside a marker', () => {
    const html = `see ${marker('smith2020', '[7]')} now`
    expect(resolveCitationsInHtml(html, { smith2020: '[1]' })).toContain('>[1]</sup>')
  })

  it('keeps the marker attributes', () => {
    const out = resolveCitationsInHtml(marker('smith2020', '[7]'), { smith2020: '[1]' })
    expect(out).toContain('data-cite="smith2020"')
    expect(out).toContain('color:#6366f1')
  })

  it('leaves a marker alone when its entry is not indexed', () => {
    const html = marker('smith2020', '[7]')
    expect(resolveCitationsInHtml(html, {})).toBe(html)
  })

  it('leaves text without markers untouched', () => {
    expect(resolveCitationsInHtml('<p>plain [1] text</p>', { smith2020: '[1]' })).toBe('<p>plain [1] text</p>')
    expect(resolveCitationsInHtml('', {})).toBe('')
    expect(resolveCitationsInHtml(undefined, {})).toBe(undefined)
  })

  it('handles a span marker as well as a sup', () => {
    const html = '<span data-cite="smith2020">[9]</span>'
    expect(resolveCitationsInHtml(html, { smith2020: '[1]' })).toBe('<span data-cite="smith2020">[1]</span>')
  })
})

describe('applyCitationNumbering', () => {
  it('rewrites stored markers to match the index', () => {
    const deck = pres([
      { id: 's1', elements: [text('e1', `first ${marker('doe2019', '[2]')}`)] },
      { id: 's2', elements: [text('e2', `then ${marker('smith2020', '[1]')}`)] },
    ])
    const out = applyCitationNumbering(deck)
    expect(out.slides[0].elements[0].content).toContain('>[1]</sup>')
    expect(out.slides[1].elements[0].content).toContain('>[2]</sup>')
  })

  it('returns the same deck when nothing needs changing', () => {
    const deck = pres([{ id: 's1', elements: [text('e1', marker('doe2019', '[1]'))] }])
    expect(applyCitationNumbering(deck)).toBe(deck)
  })

  it('leaves a deck without a bibliography alone', () => {
    const deck = { slides: [{ id: 's1', elements: [text('e1', '<p>[1]</p>')] }] }
    expect(applyCitationNumbering(deck)).toBe(deck)
  })

  it('links markers written before keys were stored, on request', () => {
    const deck = pres([{ id: 's1', elements: [text('e1', '<p>see <sup style="color:#6366f1">[2]</sup></p>')] }])
    const out = applyCitationNumbering(deck, { linkLegacy: true })
    expect(out.slides[0].elements[0].content).toContain('data-cite="doe2019"')
  })

  it('does not touch unlinked markers unless asked', () => {
    const deck = pres([{ id: 's1', elements: [text('e1', '<p>see <sup>[2]</sup></p>')] }])
    expect(applyCitationNumbering(deck)).toBe(deck)
  })
})

describe('countStaleMarkers', () => {
  it('counts markers whose label no longer matches', () => {
    const deck = pres([
      { id: 's1', elements: [text('e1', marker('doe2019', '[2]'))] },
      { id: 's2', elements: [text('e2', marker('smith2020', '[2]'))] },
    ])
    expect(countStaleMarkers(deck).stale).toBe(1)   // doe is [1] now, smith really is [2]
  })

  it('counts markers that carry no key', () => {
    const deck = pres([{ id: 's1', elements: [text('e1', '<p><sup>[1]</sup> and <sup>[2]</sup></p>')] }])
    expect(countStaleMarkers(deck).unlinked).toBe(2)
  })

  it('is zero for a deck with no bibliography', () => {
    expect(countStaleMarkers({ slides: [] })).toEqual({ stale: 0, unlinked: 0 })
  })
})

// ── The server carries its own copy of this logic ────────────────────────
// A deck can be rendered by the client or by server/index.js, so the two must
// agree. Rather than trust that, run the server's block against this module.

describe('server copy agrees with this module', () => {
  const serverSource = readFileSync(new URL('../../../server/index.js', import.meta.url), 'utf8')
  const start = serverSource.indexOf('// ── Citation index ─')
  const end = serverSource.indexOf('function generateRevealHTML(presentation, opts = {}) {')

  it('still has a citation index block to compare against', () => {
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
  })

  const server = new Function(
    serverSource.slice(start, end) +
    '; return { buildCitationIndex: buildCitationIndex, resolveCitationsInHtml: resolveCitationsInHtml }'
  )()

  const decks = {
    'appearance order': pres([{
      id: 's1',
      elements: [
        text('low', marker('smith2020', '[9]'), { y: 300 }),
        text('high', marker('ames2021', '[9]'), { y: 10 }),
      ],
    }]),
    'alphabetical order': pres(
      [{ id: 's1', elements: [text('e1', `${marker('smith2020', '[1]')}${marker('ames2021', '[2]')}`)] }],
      { citationOrder: 'alphabetical' },
    ),
    'author-year style': pres(
      [{ id: 's1', elements: [text('e1', marker('doe2019', '[1]'))] }],
      { citationStyle: 'author-year' },
    ),
    'legacy and loose matches': pres([{
      id: 's1',
      elements: [
        text('e1', '<p>bare [2] and <sup>[1]</sup></p>'),
        { id: 'img', type: 'image', x: 0, y: 100, width: 10, height: 10, zIndex: 1, citationText: 'Ames, Ada 2021' },
      ],
    }]),
    'escaped ampersand in an author': pres([
      { id: 's1', elements: [text('e1', '<p>as in Doe &amp; Roe (2019)</p>')] },
    ]),
    'nothing cited': pres([{ id: 's1', elements: [text('e1', '<p>plain</p>')] }]),
  }

  for (const [name, deck] of Object.entries(decks)) {
    it(`indexes "${name}" the same way`, () => {
      const mine = buildCitationIndex(deck)
      const theirs = server.buildCitationIndex(deck)
      expect(theirs.entries.map(e => e.key)).toEqual(mine.entries.map(e => e.key))
      expect(theirs.labelByKey).toEqual(mine.labelByKey)
      expect(theirs.numberByKey).toEqual(mine.numberByKey)
    })

    it(`resolves markers in "${name}" the same way`, () => {
      const labels = buildCitationIndex(deck).labelByKey
      for (const slide of deck.slides) {
        for (const el of slide.elements) {
          expect(server.resolveCitationsInHtml(el.content || '', labels))
            .toBe(resolveCitationsInHtml(el.content || '', labels))
        }
      }
    })
  }
})

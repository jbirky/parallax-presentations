import { describe, it, expect } from 'vitest'
import { webcrypto } from 'node:crypto'

// Browsers (and Node 19+) have crypto as a global
if (!globalThis.crypto) globalThis.crypto = webcrypto

if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import {
  newAnnotationSet, hasInk, upsertAnnotationSet, recentAnnotationSets, inkedSlideCount,
  recoverAnnotationBackups, withoutAnnotations, backupKey,
  renameAnnotationSet, deleteAnnotationSet, inkedPresentation,
} from './annotations'
import { generateRevealHTML } from './generateHTML'

const ink = { paths: [{ points: [[0, 0], [10, 10]], color: '#f00', strokeWidth: 3, opacity: 1 }] }
const set = (id, extra = {}) => ({ id, name: id, createdAt: '2026-09-01T10:00:00.000Z', updatedAt: null, slides: {}, boards: [], ...extra })

// A Storage-like object for recovery
function storage(entries) {
  const map = new Map(Object.entries(entries))
  return {
    get length() { return map.size },
    key: i => [...map.keys()][i],
    getItem: k => map.get(k) ?? null,
    removeItem: k => map.delete(k),
    keys: () => [...map.keys()],
  }
}

describe('annotation sets', () => {
  it('starts a named, empty set', () => {
    const s = newAnnotationSet(new Date('2026-09-24T14:30:00'))
    expect(s.name).toMatch(/^Presented /)
    expect(s).toMatchObject({ slides: {}, boards: [], updatedAt: null })
    expect(hasInk(s)).toBe(false)
  })

  it('counts ink and boards', () => {
    expect(hasInk(set('a', { slides: { s1: ink } }))).toBe(true)
    expect(hasInk(set('a', { slides: { s1: { paths: [] } } }))).toBe(false)
    expect(hasInk(set('a', { boards: [{ id: 'b', afterId: 's1', paths: [] }] }))).toBe(true)
    expect(inkedSlideCount(set('a', { slides: { s1: ink, s2: { paths: [] } }, boards: [{ id: 'b', afterId: 's1', paths: [] }] }))).toBe(2)
  })

  it('adds and replaces sets, and leaves the presentation alone when nothing changed', () => {
    const p = { id: 'p1', slides: [] }
    expect(upsertAnnotationSet(p, set('a'))).toBe(p) // an empty new set isn't kept
    const withA = upsertAnnotationSet(p, set('a', { slides: { s1: ink } }))
    expect(withA.annotationSets).toHaveLength(1)
    expect(upsertAnnotationSet(withA, set('a', { slides: { s1: ink } }))).toBe(withA)
    const cleared = upsertAnnotationSet(withA, set('a', { slides: {}, updatedAt: '2026-09-01T11:00:00.000Z' }))
    expect(cleared.annotationSets[0].slides).toEqual({}) // erasing everything is saved too
  })

  it('lists the most recently used sets first', () => {
    const p = { annotationSets: [set('old', { updatedAt: '2026-09-01T00:00:00Z' }), set('new', { updatedAt: '2026-09-20T00:00:00Z' }), set('never', { createdAt: '2026-09-10T00:00:00Z' })] }
    expect(recentAnnotationSets(p).map(s => s.id)).toEqual(['new', 'never', 'old'])
    expect(recentAnnotationSets(p, 1)).toHaveLength(1)
  })

  it('leaves annotation sets out of undo history', () => {
    const p = { id: 'p1', slides: [], annotationSets: [set('a')] }
    expect(withoutAnnotations(p)).toEqual({ id: 'p1', slides: [] })
  })
})

describe('managing sessions', () => {
  const p = { id: 'p1', slides: [], annotationSets: [set('a', { slides: { s1: ink } }), set('b', { slides: { s1: ink } })] }

  it('renames a session, and ignores blank names', () => {
    expect(renameAnnotationSet(p, 'a', '  Lecture 4 ').annotationSets[0].name).toBe('Lecture 4')
    expect(renameAnnotationSet(p, 'a', '   ')).toBe(p)
    expect(renameAnnotationSet(p, 'nope', 'x')).toBe(p)
  })

  it('keeps the editor’s name when the Present window sends the set again', () => {
    const renamed = renameAnnotationSet(p, 'a', 'Lecture 4')
    const sent = upsertAnnotationSet(renamed, set('a', { slides: { s1: ink, s2: ink }, updatedAt: '2026-09-01T11:00:00.000Z' }))
    expect(sent.annotationSets[0]).toMatchObject({ name: 'Lecture 4', slides: { s2: ink } })
  })

  it('leaves a deleted session behind so nothing brings it back', () => {
    const deleted = deleteAnnotationSet(p, 'a', new Date('2026-09-24T12:00:00Z'))
    expect(deleted.annotationSets[0]).toEqual({ id: 'a', deletedAt: '2026-09-24T12:00:00.000Z' })
    expect(recentAnnotationSets(deleted).map(s => s.id)).toEqual(['b'])
    expect(deleteAnnotationSet(deleted, 'a')).toBe(deleted)
    expect(renameAnnotationSet(deleted, 'a', 'x')).toBe(deleted)
    // An open Present window sending it again
    expect(upsertAnnotationSet(deleted, set('a', { slides: { s1: ink }, updatedAt: '2026-09-24T13:00:00.000Z' }))).toBe(deleted)
    // A copy on this device, newer than anything saved
    const store = storage({ [backupKey('p1', 'a')]: JSON.stringify(set('a', { slides: { s1: ink }, updatedAt: '2026-09-24T13:00:00.000Z' })) })
    const { presentation, recovered } = recoverAnnotationBackups(deleted, store)
    expect(recovered).toBe(0)
    expect(presentation).toBe(deleted)
    expect(store.length).toBe(0)
  })
})

describe('slides with a session’s ink', () => {
  const stroke = (points, extra = {}) => ({ points, color: '#f00', strokeWidth: 3, opacity: 1, ...extra })
  const deck = {
    id: 'p1', title: 'Lecture', slideWidth: 1280, slideHeight: 720,
    slides: [
      { id: 's1', elements: [{ id: 'e1', type: 'text', zIndex: 2 }] },
      { id: 's2', elements: [], column: 1 },
      { id: 's3', elements: [] },
    ],
    annotationSets: [set('a')],
  }

  it('puts the ink on its slides as a drawing on top', () => {
    const inked = inkedPresentation(deck, set('a', { name: 'Presented Sep 24', slides: {
      s1: { paths: [stroke([[1, 2], [3, 4]]), stroke([[5, 6]], { color: '#ff0', strokeWidth: 12, opacity: 0.35 })] },
      gone: { paths: [stroke([[0, 0], [1, 1]])] },
    } }))
    expect(inked.annotationSets).toBeUndefined()
    expect(inked.title).toBe('Lecture — Presented Sep 24')
    expect(inked.slides.map(s => s.id)).toEqual(['s1', 's2', 's3'])
    expect(inked.slides[1]).toBe(deck.slides[1])
    const [text, drawing] = inked.slides[0].elements
    expect(text).toBe(deck.slides[0].elements[0])
    expect(drawing).toMatchObject({ type: 'drawing', x: 0, y: 0, width: 1280, height: 720, zIndex: 2000 })
    expect(drawing.paths[0].points).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }])
    // A dot gets a second point, since a one-point path draws nothing
    expect(drawing.paths[1]).toMatchObject({ color: '#ff0', strokeWidth: 12, opacity: 0.35, points: [{ x: 5, y: 6 }, { x: 5.01, y: 6 }] })
    expect(deck.slides[0].elements).toHaveLength(1) // the deck itself is left alone
  })

  it('places boards as the Present window does', () => {
    const inked = inkedPresentation(deck, set('a', { boards: [
      { id: 'b1', afterId: 's2', paths: [stroke([[0, 0], [9, 9]])] },
      { id: 'b2', afterId: 's2', paths: [] }, // added later, after the same slide, so it comes first
      { id: 'b3', afterId: 'b1', paths: [] }, // added on a board
      { id: 'b4', afterId: 'deleted-slide', paths: [] },
    ] }))
    expect(inked.slides.map(s => s.id)).toEqual(['s1', 's2', 'b2', 'b1', 'b3', 's3', 'b4'])
    const b1 = inked.slides[3]
    expect(b1).toMatchObject({ showPageNumber: false, hideFooter: true, column: 1 })
    expect(b1.elements[0]).toMatchObject({ type: 'drawing', paths: [{ points: [{ x: 0, y: 0 }, { x: 9, y: 9 }] }] })
    expect(inked.slides[2].elements).toEqual([])
    expect(inked.slides[6].column).toBeUndefined()
  })

  it('renders the ink in the presented HTML', () => {
    const html = generateRevealHTML(inkedPresentation(deck, set('a', {
      slides: { s3: { paths: [stroke([[10, 20], [30, 40], [50, 20]])] } },
      boards: [{ id: 'b1', afterId: 's3', paths: [stroke([[7, 8]])] }],
    })))
    expect(html).toContain('<path d="M 10 20 C')
    expect(html).toContain('<path d="M 7 8 L 7.01 8"')
    expect(html).toContain('<section data-slide-id="b1"')
    expect(html).not.toMatch(/d="[^"]*(undefined|NaN)/)
    expect(html).not.toContain('pp-shield') // read-only: no pen
  })
})

describe('recovering ink kept on this device', () => {
  const saved = set('a', { slides: { s1: ink }, updatedAt: '2026-09-01T10:05:00.000Z' })
  const p = { id: 'p1', slides: [], annotationSets: [saved] }

  it('takes copies newer than the saved sets, and deletes the rest', () => {
    const newer = set('a', { slides: { s1: ink, s2: ink }, updatedAt: '2026-09-01T10:09:00.000Z' })
    const unsaved = set('b', { slides: { s1: ink }, updatedAt: '2026-09-02T09:00:00.000Z' })
    const store = storage({
      [backupKey('p1', 'a')]: JSON.stringify(newer),
      [backupKey('p1', 'b')]: JSON.stringify(unsaved),
      [backupKey('p1', 'c')]: '{not json',
      [backupKey('p2', 'z')]: JSON.stringify(set('z', { slides: { s1: ink } })),
      'unrelated': 'x',
    })
    const { presentation, recovered } = recoverAnnotationBackups(p, store)
    expect(recovered).toBe(2)
    expect(presentation.annotationSets.map(s => s.id).sort()).toEqual(['a', 'b'])
    expect(presentation.annotationSets.find(s => s.id === 'a').slides.s2).toBeTruthy()
    expect(store.keys()).toEqual([backupKey('p1', 'a'), backupKey('p1', 'b'), backupKey('p2', 'z'), 'unrelated'])
  })

  it('drops copies that are already saved', () => {
    const store = storage({ [backupKey('p1', 'a')]: JSON.stringify(saved) })
    const { presentation, recovered } = recoverAnnotationBackups(p, store)
    expect(recovered).toBe(0)
    expect(presentation).toBe(p)
    expect(store.length).toBe(0)
  })

  it('copes without storage', () => {
    expect(recoverAnnotationBackups(p, null)).toEqual({ presentation: p, recovered: 0 })
  })
})

describe('present-mode HTML', () => {
  const deck = {
    id: 'p1', title: 'T',
    slides: [{ id: 's1', elements: [] }, { id: 's2', elements: [] }],
  }

  it('marks each slide with its id', () => {
    const html = generateRevealHTML(deck)
    expect(html).toContain('<section data-slide-id="s1"')
    expect(html).toContain('<section data-slide-id="s2"')
  })

  it('adds the drawing layer only when asked', () => {
    expect(generateRevealHTML(deck)).not.toContain('pp-shield')
    const html = generateRevealHTML(deck, { annotate: { set: set('a') } })
    expect(html).toContain('pp-shield')
    expect(html).toContain(`"backupKey":"${backupKey('p1', 'a')}"`)
  })

  it('keeps a set’s text from closing the script', () => {
    const html = generateRevealHTML(deck, { annotate: { set: set('a', { name: '</script><script>alert(1)</script>' }) } })
    expect(html).not.toContain('</script><script>alert(1)')
    expect(html).toContain('\\u003c/script>')
  })
})

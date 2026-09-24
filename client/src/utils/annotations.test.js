import { describe, it, expect } from 'vitest'
import { webcrypto } from 'node:crypto'

// Browsers (and Node 19+) have crypto as a global
if (!globalThis.crypto) globalThis.crypto = webcrypto

if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import {
  newAnnotationSet, hasInk, upsertAnnotationSet, recentAnnotationSets, inkedSlideCount,
  recoverAnnotationBackups, withoutAnnotations, backupKey,
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

import { describe, it, expect } from 'vitest'
import { sameWork, workFinder, splitDuplicates, duplicatesInLibrary } from './bibDuplicates'

const gaiaBib = { key: 'gaia2016', title: 'The {G}aia mission', author: 'Prusti, T.', year: '2016', doi: '10.1051/0004-6361/201629272' }
const gaiaZotero = { key: 'X7K2PQ9A', title: 'The Gaia Mission.', author: 'Prusti, T.', year: '2016', doi: 'https://doi.org/10.1051/0004-6361/201629272' }

describe('telling whether two entries are the same work', () => {
  it('matches the same DOI however it was written', () => {
    expect(sameWork(gaiaBib, gaiaZotero)).toBe(true)
    expect(sameWork(gaiaBib, { key: 'a', doi: 'DOI: 10.1051/0004-6361/201629272' })).toBe(true)
    expect(sameWork(gaiaBib, { key: 'a', doi: 'http://dx.doi.org/10.1051/0004-6361/201629272' })).toBe(true)
  })

  it('keeps two DOIs apart even under one title', () => {
    expect(sameWork(gaiaBib, { ...gaiaZotero, doi: '10.48550/arXiv.1609.04153' })).toBe(false)
  })

  it('matches title and year when either has no DOI, ignoring case, braces, punctuation and accents', () => {
    expect(sameWork(gaiaBib, { ...gaiaZotero, doi: '' })).toBe(true)
    expect(sameWork(
      { key: 'a', title: 'Quantisierung als Eigenwertproblem', year: '1926' },
      { key: 'b', title: 'Quantisierung als Eigenwertproblem', year: '1926' },
    )).toBe(true)
    expect(sameWork(
      { key: 'a', title: 'Zur Elektrodynamik bewegter K\\"orper', year: '1905' },
      { key: 'b', title: 'Zur Elektrodynamik bewegter Körper', year: '1905' },
    )).toBe(true)
  })

  it('keeps apart the same title in different years', () => {
    expect(sameWork({ key: 'a', title: 'Annual review', year: '2020' }, { key: 'b', title: 'Annual review', year: '2021' })).toBe(false)
  })

  it('never matches on an empty title', () => {
    expect(sameWork({ key: 'a', title: '', year: '2020' }, { key: 'b', title: '{}', year: '2020' })).toBe(false)
  })

  it('matches titles in any script', () => {
    expect(sameWork({ key: 'a', title: '银河系结构', year: '2020' }, { key: 'b', title: '银河系结构。', year: '2020' })).toBe(true)
    expect(sameWork({ key: 'a', title: '银河系结构', year: '2020' }, { key: 'b', title: '恒星演化', year: '2020' })).toBe(false)
  })

  it('matches the same key', () => {
    expect(sameWork({ key: 'k', title: 'One' }, { key: 'k', title: 'Two' })).toBe(true)
  })
})

describe('importing into a library', () => {
  it('skips entries already there, and repeats within the import', () => {
    const tess = { key: 'tess', title: 'TESS', year: '2015' }
    const { kept, skipped } = splitDuplicates([gaiaZotero, tess, { ...tess, key: 'tess-again' }], [gaiaBib])
    expect(kept).toEqual([tess])
    expect(skipped.map(s => [s.entry.key, s.of.key])).toEqual([['X7K2PQ9A', 'gaia2016'], ['tess-again', 'tess']])
  })

  it('finds the library entry that is the same work', () => {
    const find = workFinder([{ key: 'other', title: 'Other', year: '2000' }, gaiaBib])
    expect(find(gaiaZotero)).toBe(gaiaBib)
    expect(find({ key: 'new', title: 'New', year: '2001' })).toBeUndefined()
  })
})

describe('duplicates already in a library', () => {
  it('marks every later copy with the first copy\'s key', () => {
    const third = { ...gaiaZotero, key: 'gaia-3' }
    const repeats = duplicatesInLibrary([gaiaBib, { key: 'x', title: 'X', year: '1' }, gaiaZotero, third])
    expect([...repeats]).toEqual([['X7K2PQ9A', 'gaia2016'], ['gaia-3', 'gaia2016']])
  })

  it('finds none in a library without repeats', () => {
    expect(duplicatesInLibrary([gaiaBib, { key: 'x', title: 'X', year: '1' }]).size).toBe(0)
  })
})

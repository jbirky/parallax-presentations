// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The same paper can reach a library twice under different citation keys (a
// .bib file and Zotero never agree on keys), and then it is listed twice in
// the references. These recognise a paper by the work itself.

// What an entry is compared by, worked out once per entry
function signature(entry) {
  return {
    key: entry.key || '',
    // However it was written: https://doi.org/…, doi:…, any case
    doi: String(entry.doi ?? '').trim().toLowerCase()
      .replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '').replace(/^doi:\s*/, ''),
    // Letters and digits only, without accents or LaTeX, so case, braces and
    // punctuation don't make two titles differ
    title: String(entry.title ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\\[`'^"~=.]/g, '')
      .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''),
    year: String(entry.year ?? '').trim(),
  }
}

// The same key; else the same DOI when both have one; else the same title and
// year. Two different DOIs are two works, whatever their titles.
function sameSignature(a, b) {
  if (a.key && a.key === b.key) return true
  if (a.doi && b.doi) return a.doi === b.doi
  return a.title !== '' && a.title === b.title && a.year === b.year
}

export function sameWork(a, b) {
  return sameSignature(signature(a), signature(b))
}

// A lookup of the library entry that is the same work as a given entry, if any
export function workFinder(library) {
  const known = library.map(entry => ({ entry, sig: signature(entry) }))
  return entry => {
    const sig = signature(entry)
    return known.find(k => sameSignature(sig, k.sig))?.entry
  }
}

// Incoming entries split into those to add and those already in the library
// (or earlier in the same import), each with the entry it repeats
export function splitDuplicates(incoming, library) {
  const known = library.map(entry => ({ entry, sig: signature(entry) }))
  const kept = [], skipped = []
  for (const entry of incoming) {
    const sig = signature(entry)
    const of = known.find(k => sameSignature(sig, k.sig))?.entry
    if (of) { skipped.push({ entry, of }); continue }
    kept.push(entry)
    known.push({ entry, sig })
  }
  return { kept, skipped }
}

// For each entry that repeats an earlier one, the earlier one's key: the later
// copy is the one to remove, which renumbers the fewest entries
export function duplicatesInLibrary(library) {
  const repeats = new Map()
  const seen = []
  for (const entry of library) {
    const sig = signature(entry)
    const of = seen.find(s => sameSignature(sig, s.sig))
    if (of) repeats.set(entry.key, of.key)
    else seen.push({ key: entry.key, sig })
  }
  return repeats
}

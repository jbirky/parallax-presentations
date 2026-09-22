// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { parseAuthors, formatAuthorsShort, formatCitation } from './bibtexParser'

// Only entries the deck actually cites get an index, and the index decides both
// the in-text marker and the position on the references slide. Two orders are
// offered: the order citations first appear while presenting, or alphabetical by
// first author. Library order is for organising the library, not for numbering.

// A marker carries the entry key, so a citation survives renumbering:
//   <sup data-cite="smith2020">[2]</sup>
// The label inside it is a cache — buildCitationIndex is what is true — which is
// why the canvas and the exports resolve it again when they draw.
const MARKER_RE = /<(sup|span)\b[^>]*\bdata-cite="([^"]*)"[^>]*>[\s\S]*?<\/\1>/gi
const KEYED_MARKER_RE = /(<(sup|span)\b[^>]*\bdata-cite="([^"]*)"[^>]*>)([\s\S]*?)(<\/\2>)/gi
// Markers from before keys were stored, which is exactly the shape the Cite
// button used to produce.
const LEGACY_MARKER_RE = /(<sup\b((?:(?!data-cite)[^>])*)>)\s*\[(\d{1,3})\]\s*(<\/sup>)/gi
const BARE_NUMBER_RE = /\[(\d{1,3})\]/g

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function allIndexesOf(haystack, needle) {
  if (!needle) return []
  const found = []
  const re = new RegExp(escapeRegExp(needle), 'g')
  let m
  while ((m = re.exec(haystack)) !== null) found.push(m.index)
  return found
}

// Every citation in a piece of text, as { pos, key }, earliest first. Keyed
// markers are exact; beyond those it is the same loose matching the references
// slide has always used, so nothing a deck already cites drops off the list.
// Markup is blanked out before the loose pass — without that, the [1] inside a
// marker, or a key sitting in an attribute, would be read as a second citation.
const ENTITIES = { '&amp;': '&', '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

function blank(length) {
  return ' '.repeat(length)
}

// Visible text with markup and entities replaced by equal-length filler, so that
// every position still lines up with the original string.
function visibleText(html, onMarker) {
  let out = html.replace(MARKER_RE, (match, tag, key, offset) => {
    onMarker(key, offset)
    return blank(match.length)
  })
  out = out.replace(/<[^>]*>/g, match => blank(match.length))
  out = out.replace(/&[a-z#0-9]+;/gi, match => {
    const decoded = ENTITIES[match.toLowerCase()]
    return decoded ? decoded + blank(match.length - decoded.length) : blank(match.length)
  })
  return out
}

export function findCitations(text, bibliography = []) {
  if (!text) return []
  const byKey = new Map(bibliography.map(e => [e.key, e]))
  const hits = []

  const visible = visibleText(text, (key, pos) => {
    if (byKey.has(key)) hits.push({ pos, key })
  })

  let m
  BARE_NUMBER_RE.lastIndex = 0
  while ((m = BARE_NUMBER_RE.exec(visible)) !== null) {
    const entry = bibliography[parseInt(m[1], 10) - 1]
    if (entry) hits.push({ pos: m.index, key: entry.key })
  }

  for (const entry of bibliography) {
    for (const pos of allIndexesOf(visible, entry.key)) hits.push({ pos, key: entry.key })
    const short = formatAuthorsShort(parseAuthors(entry.author))
    for (const pos of allIndexesOf(visible, short)) hits.push({ pos, key: entry.key })
  }

  return hits.sort((a, b) => a.pos - b.pos)
}

// Reading order: slide by slide, and within a slide top to bottom, left to right.
function citedKeysInPresentationOrder(bibliography, slides) {
  const seen = new Set()
  const keys = []
  for (const slide of slides || []) {
    const elements = [...(slide.elements || [])]
      .sort((a, b) => ((a.y || 0) - (b.y || 0)) || ((a.x || 0) - (b.x || 0)))
    for (const el of elements) {
      const text = [el.content, el.citationText].filter(Boolean).join('\n')
      for (const { key } of findCitations(text, bibliography)) {
        if (!seen.has(key)) { seen.add(key); keys.push(key) }
      }
    }
  }
  return keys
}

function alphabeticalSortKey(entry) {
  const authors = parseAuthors(entry.author)
  const lead = authors[0]?.last || entry.author || entry.title || ''
  return [lead.toLowerCase(), entry.year || '', (entry.title || '').toLowerCase()]
}

export function buildCitationIndex(presentation) {
  const bibliography = presentation?.bibliography || []
  const order = presentation?.citationOrder === 'alphabetical' ? 'alphabetical' : 'presentation'
  const style = presentation?.citationStyle || 'numbered'

  const citedKeys = citedKeysInPresentationOrder(bibliography, presentation?.slides || [])
  const byKey = new Map(bibliography.map(e => [e.key, e]))
  let entries = citedKeys.map(k => byKey.get(k)).filter(Boolean)

  if (order === 'alphabetical') {
    entries = [...entries].sort((a, b) => {
      const ka = alphabeticalSortKey(a), kb = alphabeticalSortKey(b)
      for (let i = 0; i < ka.length; i++) {
        const cmp = String(ka[i]).localeCompare(String(kb[i]))
        if (cmp !== 0) return cmp
      }
      return 0
    })
  }

  const numberByKey = {}
  const labelByKey = {}
  entries.forEach((entry, i) => {
    numberByKey[entry.key] = i + 1
    labelByKey[entry.key] = formatCitation(entry, style, i)
  })

  return { entries, numberByKey, labelByKey, order, style, citedCount: entries.length }
}

// What a marker for this entry should read right now, including one that is about
// to be inserted and so is not in the index yet.
export function nextCitationLabel(presentation, entry) {
  const { labelByKey, citedCount, style } = buildCitationIndex(presentation)
  if (labelByKey[entry.key]) return labelByKey[entry.key]
  return formatCitation(entry, style, citedCount)
}

export function citationMarkerHtml(entry, label) {
  return `<sup data-cite="${entry.key}" style="color:#6366f1;font-weight:700;cursor:default">${label}</sup>`
}

// Refresh the label inside every keyed marker. Content is never the authority, so
// this is safe to run at render time as well as over stored slides.
export function resolveCitationsInHtml(html, labelByKey) {
  if (!html || typeof html !== 'string' || html.indexOf('data-cite') === -1) return html
  return html.replace(KEYED_MARKER_RE, (match, open, tag, key, inner, close) => {
    const label = labelByKey?.[key]
    return label ? `${open}${label}${close}` : match
  })
}

// Attach keys to markers written before they carried one, reading the number they
// show as a position in the library, which is how it was assigned.
function linkLegacyMarkers(html, bibliography) {
  if (!html || html.indexOf('<sup') === -1) return html
  return html.replace(LEGACY_MARKER_RE, (match, open, attrs, num, close) => {
    const entry = bibliography[parseInt(num, 10) - 1]
    if (!entry) return match
    return `<sup${attrs} data-cite="${entry.key}">[${num}]${close}`
  })
}

// Rewrite the stored markers across a deck: used when the index changes under
// them, so that anything reading the slides directly still sees live numbers.
export function applyCitationNumbering(presentation, { linkLegacy = false } = {}) {
  const bibliography = presentation?.bibliography || []
  if (!presentation || !bibliography.length) return presentation

  const { labelByKey } = buildCitationIndex(presentation)
  let changed = false

  const slides = (presentation.slides || []).map(slide => {
    let slideChanged = false
    const elements = (slide.elements || []).map(el => {
      if (typeof el.content !== 'string' || !el.content) return el
      const linked = linkLegacy ? linkLegacyMarkers(el.content, bibliography) : el.content
      const resolved = resolveCitationsInHtml(linked, labelByKey)
      if (resolved === el.content) return el
      slideChanged = true
      return { ...el, content: resolved }
    })
    if (!slideChanged) return slide
    changed = true
    return { ...slide, elements }
  })

  return changed ? { ...presentation, slides } : presentation
}

// How many stored markers disagree with the index, so the settings tab can say so.
export function countStaleMarkers(presentation) {
  const bibliography = presentation?.bibliography || []
  if (!bibliography.length) return { stale: 0, unlinked: 0 }
  const { labelByKey } = buildCitationIndex(presentation)
  let stale = 0, unlinked = 0

  for (const slide of presentation?.slides || []) {
    for (const el of slide.elements || []) {
      if (typeof el.content !== 'string' || !el.content) continue
      let m
      KEYED_MARKER_RE.lastIndex = 0
      while ((m = KEYED_MARKER_RE.exec(el.content)) !== null) {
        const label = labelByKey[m[3]]
        if (label && m[4] !== label) stale++
      }
      LEGACY_MARKER_RE.lastIndex = 0
      while ((m = LEGACY_MARKER_RE.exec(el.content)) !== null) {
        if (bibliography[parseInt(m[3], 10) - 1]) unlinked++
      }
    }
  }
  return { stale, unlinked }
}

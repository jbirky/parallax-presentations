// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// What a presentation's card needs to draw its first slide (the client's
// components/DeckTile.jsx): the slide, without its background (that's
// `thumbnail`, sent already) or its notes, and the deck's colors, text
// styles, font and slide size. Every list of presentations sends these.

// SQL columns, for a query whose presentations row is `p` (or none: '')
function tileColumns(p = '') {
  const d = p ? `${p}.data` : 'data'
  return `(${d}->'slides'->0) - ARRAY['background', 'notes', 'outlineNotes'] AS "firstSlide",
        ${d}->'themeColors' AS "themeColors",
        ${d}->'textStyles' AS "textStyles",
        ${d}->>'globalFont' AS "globalFont",
        ${d}->'slideWidth' AS "slideWidth",
        ${d}->'slideHeight' AS "slideHeight"`
}

// Elements a card draws as a plain tile (SlideThumbnail's embeds, without a
// still on the dashboard): only where they sit is sent, not what's in them
const TILED = new Set(['html', 'code', 'latex', 'markdown', 'audio', 'table', 'icon', 'callout', 'p5', 'model', 'molecule', 'graph'])
const PLACE = ['id', 'type', 'x', 'y', 'width', 'height', 'zIndex', 'rotation', 'shadowBlur', 'shadowX', 'shadowY', 'shadowColor']

// A first slide as a card needs it: tiled elements cut down to their place
function tileSlide(slide) {
  if (!slide || typeof slide !== 'object' || !Array.isArray(slide.elements)) return slide || null
  return {
    ...slide,
    elements: slide.elements.map(el => (el && TILED.has(el.type)
      ? Object.fromEntries(PLACE.filter(k => el[k] !== undefined).map(k => [k, el[k]]))
      : el)),
  }
}

// A list row from a query with tileColumns, its first slide cut down
function tileRow(row) {
  if (row && 'firstSlide' in row) row.firstSlide = tileSlide(row.firstSlide)
  return row
}

// The same from a presentation's data, for the file store
function tileFields(data = {}) {
  const first = Array.isArray(data.slides) && data.slides[0] ? { ...data.slides[0] } : null
  if (first) { delete first.background; delete first.notes; delete first.outlineNotes }
  return {
    firstSlide: tileSlide(first),
    themeColors: data.themeColors ?? null,
    textStyles: data.textStyles ?? null,
    globalFont: data.globalFont ?? null,
    slideWidth: data.slideWidth ?? null,
    slideHeight: data.slideHeight ?? null,
  }
}

module.exports = { tileColumns, tileFields, tileSlide, tileRow }

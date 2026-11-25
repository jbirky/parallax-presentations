// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// An HTML embed's editable content: a JSON block in its own code,
//
//   <script type="application/json" data-parallax-content>
//   { "title": "Parts list", "parts": [{ "item": 1, "description": "Fairing" }] }
//   </script>
//
// that the embed's script reads with
//
//   JSON.parse(document.querySelector('[data-parallax-content]').textContent)
//
// The editor shows the block as a form (components/EmbedContentForm.jsx), so
// the words and numbers in an embed can change without opening its code. The
// content lives in the embed's HTML, so presented, shared and exported decks
// need nothing new. Keys starting with $ are settings for the form, not
// content: $labels names fields ({ "dv": "Δv (km/s)" }) and $choices limits a
// field to a list ({ "status": ["open", "closed"] }).

const BLOCK = /(<script\b[^>]*\bdata-parallax-content\b[^>]*>)([\s\S]*?)(<\/script\s*>)/i

// Where the block's JSON sits in html: { start, end, text } or null
function findBlock(html) {
  const m = typeof html === 'string' ? BLOCK.exec(html) : null
  if (!m) return null
  const start = m.index + m[1].length
  return { start, end: start + m[2].length, text: m[2] }
}

// Whether html has a content block
export function hasEmbedContent(html) {
  return !!findBlock(html)
}

// The block's content: { data } or { error } when its JSON doesn't parse, or
// null when there is no block
export function readEmbedContent(html) {
  const block = findBlock(html)
  if (!block) return null
  try {
    const data = JSON.parse(block.text)
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'The content block holds a list or a single value; it should hold { … }' }
    return { data }
  } catch (err) {
    return { error: `The content block isn’t valid JSON: ${err.message}` }
  }
}

// JSON that is safe inside a <script>: a "<" would let "</script>" or "<!--"
// in a string end the block early, so it is written as its \u escape, which
// JSON.parse reads back as "<"
export function contentJson(data) {
  return JSON.stringify(data, null, 2).replace(/</g, '\\u003c')
}

// html with its block's content replaced by data. Spliced by position, not
// String.replace, since a "$" in the content would read as a pattern
export function writeEmbedContent(html, data) {
  const block = findBlock(html)
  if (!block) return html
  return html.slice(0, block.start) + '\n' + contentJson(data) + '\n' + html.slice(block.end)
}

// A field's label: $labels[key], or the key in words ("altitudeKm" → "Altitude km").
// A short key with no vowel, or a usual one, reads as an abbreviation ("trl" → "TRL")
const ABBREVIATIONS = ['id', 'url', 'uri', 'api', 'ui']
export function fieldLabel(key, labels) {
  if (labels && typeof labels[key] === 'string') return labels[key]
  const k = String(key)
  if (ABBREVIATIONS.includes(k) || /^[b-df-hj-np-tv-z]{1,4}$/.test(k)) return k.toUpperCase()
  const words = k.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const isPlainObject = v => !!v && typeof v === 'object' && !Array.isArray(v)
const isPrimitive = v => v === null || ['string', 'number', 'boolean'].includes(typeof v)

// How the form shows a value: 'text', 'longtext', 'number', 'boolean',
// 'choice', 'list' (of words or numbers), 'table' (rows of fields), 'group'
// (named fields), or 'json' for anything else
export function fieldKind(value, choices) {
  if (Array.isArray(choices) && choices.length && (isPrimitive(value))) return 'choice'
  if (typeof value === 'string') return value.length > 60 || value.includes('\n') ? 'longtext' : 'text'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) {
    if (value.length && value.every(isPlainObject)) return 'table'
    if (value.every(v => typeof v === 'string' || typeof v === 'number')) return 'list'
    return 'json'
  }
  if (isPlainObject(value)) return 'group'
  return 'json'
}

// A table's columns: every row's keys, in the order they first appear
export function tableColumns(rows) {
  const cols = []
  for (const row of rows) for (const k of Object.keys(row)) if (!k.startsWith('$') && !cols.includes(k)) cols.push(k)
  return cols
}

// A new row for a table, shaped like its last: words blank, lists empty, and
// numbers, switches and choices copied
export function blankRow(rows, choices = {}) {
  const last = rows[rows.length - 1] || {}
  const row = {}
  for (const k of tableColumns(rows.length ? rows : [last])) {
    const v = last[k]
    if (typeof v === 'string') row[k] = Array.isArray(choices[k]) ? v : ''
    else if (Array.isArray(v)) row[k] = []
    else if (isPlainObject(v)) row[k] = {}
    else row[k] = v ?? ''
  }
  return row
}

// A list's items written one per line, and read back: numbers stay numbers when
// every item was one
export function listToText(items) {
  return (items || []).join('\n')
}
export function textToList(text, like = []) {
  const lines = String(text).split('\n')
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  const numeric = like.length > 0 && like.every(v => typeof v === 'number')
  return lines.map(l => {
    if (!numeric) return l
    const n = Number(l)
    return l.trim() !== '' && Number.isFinite(n) ? n : l
  })
}

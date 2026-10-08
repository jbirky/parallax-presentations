// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The landing page's examples, edited from /admin (landing_examples, migration
// 017). Each has the card's words, whether it's one of the cards, and whether
// it plays at the top of the page (one does). A built-in one shows the deck
// client/src/examples/decks.js builds until it's given a deck of its own; one
// added from a presentation keeps a copy of that deck, refreshed only when
// asked, and remembers which presentation it came from. A thumbnail drawn by
// the server (slide-thumbnail.js) replaces the built-in image.
//
// Without the table (the self-hosted version, or before the migration) the
// built-in examples are the list, as the client's catalog has them.

const deckHtml = require('./deck-html')

class ExampleError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

const TEXT_LIMITS = { field: 40, title: 80, description: 300 }
const MAX_TAGS = 6, MAX_TAG = 40
const COLUMNS = `slug, field, title, description, tags, builtin, card, hero, sort_order,
  source_presentation_id, (SELECT p.title FROM presentations p WHERE p.id = source_presentation_id) AS source_title,
  deck IS NOT NULL AS has_deck, thumbnail IS NOT NULL AS has_thumbnail,
  COALESCE(deck->'slides'->0->'background', 'null'::jsonb) AS background, updated_at`

let tableFound = false
async function hasTable(storage) {
  if (tableFound) return true
  if (!storage || !storage.query) return false
  const { rows: [{ ok }] } = await storage.query("SELECT to_regclass('landing_examples') IS NOT NULL AS ok")
  tableFound = ok
  return ok
}

const builtinBackground = slug => deckHtml.exampleDeck(slug)?.slides?.[0]?.background || null

function fromRow(r) {
  return {
    slug: r.slug,
    field: r.field,
    title: r.title,
    description: r.description,
    tags: Array.isArray(r.tags) ? r.tags : [],
    builtin: r.builtin,
    card: r.card,
    hero: r.hero,
    sortOrder: r.sort_order,
    sourcePresentationId: r.source_presentation_id || null,
    // Its title now, or null once it's deleted
    sourceTitle: r.source_title ?? null,
    // A copy of a deck of its own, rather than the one the code builds
    ownDeck: r.has_deck,
    hasThumbnail: r.has_thumbnail,
    background: r.background || (r.builtin && !r.has_deck ? builtinBackground(r.slug) : null),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
  }
}

// The built-in examples, as the table starts out
function builtins() {
  const cards = deckHtml.EXAMPLES.map((e, i) => ({
    slug: e.slug, field: e.field, title: e.title, description: e.desc, tags: e.tags,
    builtin: true, card: true, hero: false, sortOrder: i + 1,
    sourcePresentationId: null, sourceTitle: null, ownDeck: false, hasThumbnail: false, background: builtinBackground(e.slug), updatedAt: null,
  }))
  const hero = { slug: deckHtml.HERO_EXAMPLE, field: '', title: 'Parallax', description: 'A galaxy rotation curve, a Feynman diagram and a geometry construction', tags: [],
    builtin: true, card: false, hero: true, sortOrder: 0, sourcePresentationId: null, sourceTitle: null, ownDeck: false, hasThumbnail: false, background: null, updatedAt: null }
  return [hero, ...cards]
}

// Every example, cards or not, in order
async function listExamples(storage) {
  if (!(await hasTable(storage))) return builtins()
  const { rows } = await storage.query(`SELECT ${COLUMNS} FROM landing_examples ORDER BY sort_order, created_at`)
  return rows.map(fromRow)
}

// Where a card's image is: the one the server drew, a built-in one, or none
function thumbnailUrl(e) {
  if (e.hasThumbnail) return `/examples/thumbs/${e.slug}.jpg?v=${Date.parse(e.updatedAt) || 0}`
  return e.builtin && !e.ownDeck ? `/examples/thumbs/${e.slug}.jpg` : null
}

// What the landing page shows: the deck at the top, and the cards
async function landingExamples(storage) {
  const all = await listExamples(storage)
  const hero = all.find(e => e.hero) || all.find(e => e.slug === deckHtml.HERO_EXAMPLE)
  return {
    hero: hero ? hero.slug : null,
    examples: all.filter(e => e.card).map(e => ({
      slug: e.slug, field: e.field, title: e.title, desc: e.description, tags: e.tags,
      thumbnail: thumbnailUrl(e), background: e.background,
    })),
  }
}

// An example's deck and when it last changed, or null
async function getExampleDeck(storage, slug) {
  if (!(await hasTable(storage))) {
    const deck = deckHtml.exampleDeck(slug)
    return deck ? { deck, version: 'built-in' } : null
  }
  const { rows: [r] } = await storage.query('SELECT deck, builtin, updated_at FROM landing_examples WHERE slug = $1', [slug])
  if (!r) return null
  const deck = r.deck || (r.builtin ? deckHtml.exampleDeck(slug) : null)
  return deck ? { deck, version: String(r.updated_at instanceof Date ? r.updated_at.getTime() : r.updated_at) } : null
}

async function getThumbnail(storage, slug) {
  if (!(await hasTable(storage))) return null
  const { rows: [r] } = await storage.query('SELECT thumbnail FROM landing_examples WHERE slug = $1', [slug])
  return r?.thumbnail || null
}

// A presentation as anyone may see it on the landing page: without its
// present-mode ink, practice runs, speaker notes or outline notes
function publicCopy(presentation) {
  const { id, createdAt, updatedAt, expiresAt, version, annotationSets, practiceRuns, ...deck } = presentation
  deck.slides = (deck.slides || []).map(({ notes, outlineNotes, ...slide }) => ({ ...slide, notes: '' }))
  return deck
}

// The card's words, checked
function cleanFields(input, { partial = false } = {}) {
  const out = {}
  for (const key of ['field', 'title', 'description']) {
    if (input[key] === undefined) { if (!partial && key === 'title') throw new ExampleError('A title is needed'); continue }
    const value = String(input[key] ?? '').replace(/\s+/g, ' ').trim()
    if (key === 'title' && !value) throw new ExampleError('A title is needed')
    if (value.length > TEXT_LIMITS[key]) throw new ExampleError(`The ${key} can be at most ${TEXT_LIMITS[key]} characters`)
    out[key] = value
  }
  if (input.tags !== undefined) {
    const tags = (Array.isArray(input.tags) ? input.tags : String(input.tags).split(','))
      .map(t => String(t).replace(/\s+/g, ' ').trim()).filter(Boolean)
    if (tags.length > MAX_TAGS) throw new ExampleError(`An example can have at most ${MAX_TAGS} tags`)
    if (tags.some(t => t.length > MAX_TAG)) throw new ExampleError(`A tag can be at most ${MAX_TAG} characters`)
    out.tags = tags
  }
  return out
}

const slugify = title => title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'example'

async function needTable(storage) {
  if (!(await hasTable(storage))) throw new ExampleError('Examples can’t be edited until the landing_examples migration has run', 409)
}

async function getRow(storage, slug) {
  const { rows: [r] } = await storage.query(`SELECT ${COLUMNS} FROM landing_examples WHERE slug = $1`, [slug])
  if (!r) throw new ExampleError('No such example', 404)
  return fromRow(r)
}

// A new example, a copy of `presentation`, last among the cards
async function createExample(storage, presentation, input) {
  await needTable(storage)
  const fields = { field: '', description: '', tags: [], ...cleanFields(input) }
  const base = slugify(fields.title)
  const { rows: taken } = await storage.query('SELECT slug FROM landing_examples WHERE slug = $1 OR slug LIKE $2', [base, `${base}-%`])
  const used = new Set(taken.map(r => r.slug).concat(['thumbs']))
  let slug = base
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`
  await storage.query(
    `INSERT INTO landing_examples (slug, field, title, description, tags, deck, source_presentation_id, builtin, card, hero, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, TRUE, FALSE, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM landing_examples))`,
    [slug, fields.field, fields.title, fields.description, JSON.stringify(fields.tags), JSON.stringify(publicCopy(presentation)), presentation.id]
  )
  return getRow(storage, slug)
}

// The card's words, whether it's a card, and moving the top of the page to it
async function updateExample(storage, slug, input) {
  await needTable(storage)
  await getRow(storage, slug)
  const fields = cleanFields(input, { partial: true })
  const sets = [], params = [slug]
  for (const [key, value] of Object.entries(fields)) {
    params.push(key === 'tags' ? JSON.stringify(value) : value)
    sets.push(`${key} = $${params.length}`)
  }
  if (input.card !== undefined) { params.push(!!input.card); sets.push(`card = $${params.length}`) }
  if (sets.length) await storage.query(`UPDATE landing_examples SET ${sets.join(', ')}, updated_at = NOW() WHERE slug = $1`, params)
  if (input.hero === true) {
    // One statement, so the page always has exactly one
    await storage.query('UPDATE landing_examples SET hero = (slug = $1), updated_at = NOW() WHERE hero OR slug = $1', [slug])
  }
  return getRow(storage, slug)
}

// The cards in the order given; any left out keep their places after them
async function setOrder(storage, slugs) {
  await needTable(storage)
  if (!Array.isArray(slugs) || slugs.some(s => typeof s !== 'string')) throw new ExampleError('An order is a list of examples')
  await storage.query(
    `UPDATE landing_examples e SET sort_order = o.n FROM unnest($1::text[]) WITH ORDINALITY AS o(slug, n) WHERE e.slug = o.slug`,
    [slugs]
  )
  const { rows } = await storage.query(`SELECT slug FROM landing_examples WHERE NOT (slug = ANY($1::text[])) ORDER BY sort_order, created_at`, [slugs])
  for (const [i, r] of rows.entries()) await storage.query('UPDATE landing_examples SET sort_order = $2 WHERE slug = $1', [r.slug, slugs.length + i + 1])
  return listExamples(storage)
}

// The deck copied again from the presentation it came from
async function refreshExample(storage, slug, presentation) {
  await needTable(storage)
  await storage.query('UPDATE landing_examples SET deck = $2, source_presentation_id = $3, updated_at = NOW() WHERE slug = $1',
    [slug, JSON.stringify(publicCopy(presentation)), presentation.id])
  return getRow(storage, slug)
}

async function setThumbnail(storage, slug, jpeg) {
  await storage.query('UPDATE landing_examples SET thumbnail = $2, updated_at = NOW() WHERE slug = $1', [slug, jpeg])
}

// Built-in examples can be hidden but not deleted: the migration would put
// them back
async function deleteExample(storage, slug) {
  await needTable(storage)
  const e = await getRow(storage, slug)
  if (e.builtin) throw new ExampleError('A built-in example can be hidden, not deleted')
  if (e.hero) throw new ExampleError('Move the top of the page to another example first')
  await storage.query('DELETE FROM landing_examples WHERE slug = $1', [slug])
}

module.exports = {
  ExampleError, listExamples, landingExamples, getExampleDeck, getThumbnail, publicCopy,
  createExample, updateExample, setOrder, refreshExample, setThumbnail, deleteExample, getRow,
}

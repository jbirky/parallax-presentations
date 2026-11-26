// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Plans (tiers): each one's limits, and the Stripe price that sells it. They
// live in the plans table, which admins edit from /admin, and are cached in
// PLAN_LIMITS, keyed by plan id. Edits replace its entries in place, so code
// holding PLAN_LIMITS sees them. Until the table is loaded (self-hosted mode,
// or before migration 014) it holds the built-in plans below.
//
// Free is where new accounts start and guest is guest mode's, so neither can
// be deleted, sold or, for guest, given to an account.

const MB = 1024 * 1024
const GB = 1024 * MB
const UPLOAD_CAP_BYTES = 500 * MB // multer's limit in index.js
// How often a price charges, in the order they're offered
const INTERVALS = ['month', 'year']

const BUILT_IN = [
  { id: 'free', name: 'Free', storageBytes: 100 * MB, maxPresentations: 3, maxFileBytes: null, stripePriceId: null, priceLabel: 'Free', public: true, sortOrder: 0, liveDatasets: 1, minRefresh: 'daily', perSeat: false, minSeats: null },
  { id: 'pro', name: 'Pro', storageBytes: 5 * GB, maxPresentations: Infinity, maxFileBytes: null, stripePriceId: 'price_1TVnpZF9LOeD1Xd0coGVd0fI', priceLabel: '$5/mo', public: true, sortOrder: 1, liveDatasets: 25, minRefresh: 'hourly', perSeat: false, minSeats: null },
  { id: 'team', name: 'Team', storageBytes: 25 * GB, maxPresentations: Infinity, maxFileBytes: null, stripePriceId: null, priceLabel: null, public: false, sortOrder: 2, liveDatasets: 100, minRefresh: 'hourly', perSeat: true, minSeats: 3 },
  { id: 'guest', name: 'Guest', storageBytes: 25 * MB, maxPresentations: 1, maxFileBytes: 10 * MB, stripePriceId: null, priceLabel: null, public: false, sortOrder: 3, liveDatasets: 0, minRefresh: 'weekly', perSeat: false, minSeats: null },
].map(p => withPrices(p, []))

// The plan with its prices: [{ priceId, interval, amountCents, currency }],
// monthly first. A plan's stripe_price_id, from before plan_prices
// (migration 030), counts as a monthly price.
function withPrices(plan, prices) {
  const list = prices.map(r => ({ priceId: r.stripe_price_id, interval: r.interval, amountCents: r.amount_cents ?? null, currency: r.currency || 'usd' }))
  if (plan.stripePriceId && !list.some(p => p.priceId === plan.stripePriceId)) {
    list.push({ priceId: plan.stripePriceId, interval: 'month', amountCents: null, currency: 'usd' })
  }
  list.sort((a, b) => INTERVALS.indexOf(a.interval) - INTERVALS.indexOf(b.interval))
  return { ...plan, prices: list }
}
// How often a live dataset may refresh, fastest first
const REFRESH_RATES = ['hourly', 'daily', 'weekly']

const PLAN_LIMITS = {}

function replaceAll(plans) {
  for (const id of Object.keys(PLAN_LIMITS)) delete PLAN_LIMITS[id]
  for (const plan of plans) PLAN_LIMITS[plan.id] = plan
}
replaceAll(BUILT_IN)

function fromRow(r) {
  return {
    id: r.id,
    name: r.name,
    storageBytes: Number(r.storage_bytes),
    maxPresentations: r.max_presentations === null ? Infinity : r.max_presentations,
    maxFileBytes: r.max_file_bytes === null ? null : Number(r.max_file_bytes),
    stripePriceId: r.stripe_price_id,
    priceLabel: r.price_label,
    public: r.public,
    sortOrder: r.sort_order,
    // Null until an admin sets them, or before migration 018: the built-in
    // plan's, or none
    liveDatasets: r.live_datasets ?? BUILT_IN.find(p => p.id === r.id)?.liveDatasets ?? 0,
    minRefresh: REFRESH_RATES.includes(r.min_refresh) ? r.min_refresh : BUILT_IN.find(p => p.id === r.id)?.minRefresh ?? 'daily',
    // Sold by the seat, to teams (migration 030): before it, the built-in plan's
    perSeat: r.per_seat ?? BUILT_IN.find(p => p.id === r.id)?.perSeat ?? false,
    minSeats: r.min_seats ?? (r.per_seat === undefined ? BUILT_IN.find(p => p.id === r.id)?.minSeats ?? null : null),
  }
}

let warnedMissing = false

// Reads the plans table into PLAN_LIMITS; keeps what's there if it can't
async function loadPlans(storage) {
  if (!storage || !storage.query) return
  const { rows: [{ ok }] } = await storage.query("SELECT to_regclass('plans') IS NOT NULL AS ok")
  if (!ok) {
    if (!warnedMissing) console.warn('No plans table (migration 014); using the built-in plans')
    warnedMissing = true
    return
  }
  const { rows } = await storage.query('SELECT * FROM plans ORDER BY sort_order, id')
  // A table without free would leave new accounts with no plan
  if (!rows.some(r => r.id === 'free')) throw new Error('The plans table has no free plan')
  const { rows: [{ priced }] } = await storage.query("SELECT to_regclass('plan_prices') IS NOT NULL AS priced")
  const { rows: prices } = priced ? await storage.query('SELECT * FROM plan_prices ORDER BY created_at') : { rows: [] }
  replaceAll(rows.map(r => withPrices(fromRow(r), prices.filter(p => p.plan_id === r.id))))
}

function listPlans() {
  return Object.values(PLAN_LIMITS).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
}

// A plan by id, or free for an unknown one
function planFor(id) {
  return PLAN_LIMITS[id] || PLAN_LIMITS.free
}

// The plan a Stripe price sells and the price itself, { plan, price }, or null
function priceFor(priceId) {
  if (!priceId) return null
  for (const plan of listPlans()) {
    const price = plan.prices.find(p => p.priceId === priceId)
    if (price) return { plan, price }
  }
  return null
}

function planForPrice(priceId) {
  return priceFor(priceId)?.plan || null
}

// Plans an admin can put an account on
function assignablePlans() {
  return listPlans().filter(p => p.id !== 'guest').map(p => p.id)
}

// Plans a signed-in account can buy for themselves
function purchasablePlans() {
  return listPlans().filter(p => p.public && !p.perSeat && p.prices.length)
}

// Plans a team can be bought on, by the seat
function teamPlans() {
  return listPlans().filter(p => p.perSeat && p.prices.length)
}

// For JSON, where Infinity would turn into null anyway
function toJSON(plan) {
  return { ...plan, maxPresentations: plan.maxPresentations === Infinity ? null : plan.maxPresentations }
}

// ── Admin edits ─────────────────────────────────────────────────────────────

class PlanError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

const ID_RE = /^[a-z][a-z0-9-]{1,31}$/
const PRICE_RE = /^price_[A-Za-z0-9]{6,}$/

function optionalInt(value, label, min, max) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) throw new PlanError(`${label} must be a whole number from ${min} to ${max}, or blank.`)
  return n
}

// Checks an admin's plan fields, returning them ready for the table
function validatePlan(id, input) {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > 40) throw new PlanError('Give the plan a name of up to 40 characters.')
  const storageBytes = Number(input.storageBytes)
  if (!Number.isInteger(storageBytes) || storageBytes < MB || storageBytes > 100 * 1024 * GB) {
    throw new PlanError('Storage must be from 1 MB to 100 TB.')
  }
  const priceLabel = typeof input.priceLabel === 'string' && input.priceLabel.trim() ? input.priceLabel.trim() : null
  if (priceLabel && priceLabel.length > 40) throw new PlanError('Keep the price label to 40 characters.')
  const stripePriceId = typeof input.stripePriceId === 'string' && input.stripePriceId.trim() ? input.stripePriceId.trim() : null
  if (stripePriceId && !PRICE_RE.test(stripePriceId)) throw new PlanError('A Stripe price ID looks like price_1AbC… (from the Stripe dashboard).')
  if (stripePriceId && (id === 'free' || id === 'guest')) throw new PlanError(`The ${id} plan can’t be sold.`)
  const isPublic = !!input.public
  if (isPublic && id === 'guest') throw new PlanError('The guest plan can’t be listed.')
  // Fields an edit leaves out keep the plan's values (an admin page from
  // before live datasets sends none)
  const current = PLAN_LIMITS[id] || BUILT_IN.find(p => p.id === id)
  const minRefresh = input.minRefresh === undefined ? current?.minRefresh || 'daily' : input.minRefresh
  if (!REFRESH_RATES.includes(minRefresh)) throw new PlanError(`The fastest refresh must be ${REFRESH_RATES.join(', ')}.`)
  return {
    name,
    storageBytes,
    maxPresentations: optionalInt(input.maxPresentations, 'Presentations', 1, 100000),
    maxFileBytes: optionalInt(input.maxFileBytes, 'Largest file', MB, UPLOAD_CAP_BYTES),
    stripePriceId,
    priceLabel,
    public: isPublic,
    sortOrder: optionalInt(input.sortOrder, 'Order', 0, 1000) ?? 0,
    liveDatasets: input.liveDatasets === undefined ? current?.liveDatasets ?? 0 : optionalInt(input.liveDatasets, 'Live datasets', 0, 100000) ?? 0,
    minRefresh,
    perSeat: input.perSeat === undefined ? current?.perSeat ?? false : !!input.perSeat,
    minSeats: input.minSeats === undefined ? current?.minSeats ?? null : optionalInt(input.minSeats, 'Fewest seats', 1, 1000),
  }
}

function friendlyWriteError(err) {
  if (err.code === '42P01') return new PlanError('Plans can’t be edited until the latest migrations have run on this database.', 409)
  if (err.code === '42703') return new PlanError('Plans can’t be edited until the latest migrations have run on this database.', 409)
  if (err.code === '23505' && /stripe_price_id/.test(err.constraint || err.detail || '')) {
    return new PlanError('Another plan already uses that Stripe price.')
  }
  if (err.code === '23505') return new PlanError('A plan with that id already exists.')
  return err
}

async function createPlan(storage, input) {
  const id = typeof input.id === 'string' ? input.id.trim() : ''
  if (!ID_RE.test(id)) throw new PlanError('The id must be 2–32 lowercase letters, digits or dashes, starting with a letter.')
  const p = validatePlan(id, input)
  try {
    await storage.query(
      `INSERT INTO plans (id, name, storage_bytes, max_presentations, expiration_days, max_file_bytes, stripe_price_id, price_label, public, sort_order,
                          live_datasets, min_refresh, per_seat, min_seats)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [id, p.name, p.storageBytes, p.maxPresentations, null, p.maxFileBytes, p.stripePriceId, p.priceLabel, p.public, p.sortOrder,
        p.liveDatasets, p.minRefresh, p.perSeat, p.minSeats]
    )
  } catch (err) { throw friendlyWriteError(err) }
  await loadPlans(storage)
  return planFor(id)
}

// Saves a plan's fields. (Presentations don't expire any more: past a plan's
// limit they're read-only, services/deck-locks.js; expiration_days stays
// empty.) Returns the plan.
async function updatePlan(storage, id, input) {
  const p = validatePlan(id, input)
  let rowCount
  try {
    ({ rowCount } = await storage.query(`
      UPDATE plans SET name = $2, storage_bytes = $3, max_presentations = $4, expiration_days = NULL,
             max_file_bytes = $5, stripe_price_id = $6, price_label = $7, public = $8, sort_order = $9,
             live_datasets = $10, min_refresh = $11, per_seat = $12, min_seats = $13, updated_at = NOW()
       WHERE id = $1`,
      [id, p.name, p.storageBytes, p.maxPresentations, p.maxFileBytes, p.stripePriceId, p.priceLabel, p.public, p.sortOrder,
        p.liveDatasets, p.minRefresh, p.perSeat, p.minSeats]
    ))
  } catch (err) { throw friendlyWriteError(err) }
  if (!rowCount) throw new PlanError('No such plan.', 404)
  await loadPlans(storage)
  return { plan: planFor(id) }
}

// Deletes a plan no account is on
async function deletePlan(storage, id) {
  if (id === 'free' || id === 'guest') throw new PlanError(`The ${id} plan can’t be deleted.`)
  const { rows: [{ accounts }] } = await storage.query(
    "SELECT COUNT(*)::int AS accounts FROM users WHERE COALESCE(plan, 'free') = $1", [id]
  )
  if (accounts) {
    throw new PlanError(`${accounts} account${accounts === 1 ? ' is' : 's are'} on this plan. Move ${accounts === 1 ? 'it' : 'them'} to another plan first.`)
  }
  let rowCount
  try {
    ({ rowCount } = await storage.query('DELETE FROM plans WHERE id = $1', [id]))
  } catch (err) { throw friendlyWriteError(err) }
  if (!rowCount) throw new PlanError('No such plan.', 404)
  await loadPlans(storage)
}

// Another price a plan is sold at: { priceId, interval, amountCents?,
// currency? }. `describe(priceId)`, when given, asks Stripe for the price
// and fills in what it says, so the interval and amount can't be mistyped.
async function addPlanPrice(storage, planId, input, describe = null) {
  if (!PLAN_LIMITS[planId]) throw new PlanError('No such plan.', 404)
  if (planId === 'free' || planId === 'guest') throw new PlanError(`The ${planId} plan can’t be sold.`)
  const priceId = typeof input.priceId === 'string' ? input.priceId.trim() : ''
  if (!PRICE_RE.test(priceId)) throw new PlanError('A Stripe price ID looks like price_1AbC… (from the Stripe dashboard).')
  let { interval, amountCents = null, currency = 'usd' } = input
  if (describe) {
    const found = await describe(priceId)
    if (!found) throw new PlanError('Stripe has no price with that ID.')
    if (!found.recurring) throw new PlanError('That price isn’t a subscription: give it a monthly or yearly interval in Stripe.')
    ;({ interval, amountCents, currency } = found)
  }
  if (!INTERVALS.includes(interval)) throw new PlanError('A price is by the month or by the year.')
  if (amountCents !== null && amountCents !== undefined && (!Number.isInteger(Number(amountCents)) || Number(amountCents) < 0)) {
    throw new PlanError('The amount is a whole number of cents.')
  }
  const owner = priceFor(priceId)
  if (owner) throw new PlanError(owner.plan.id === planId ? 'The plan already has that price.' : `The ${owner.plan.name} plan already uses that price.`)
  try {
    await storage.query(
      'INSERT INTO plan_prices (stripe_price_id, plan_id, interval, amount_cents, currency) VALUES ($1, $2, $3, $4, $5)',
      [priceId, planId, interval, amountCents === null || amountCents === undefined ? null : Number(amountCents), String(currency || 'usd').toLowerCase()]
    )
  } catch (err) { throw friendlyWriteError(err) }
  await loadPlans(storage)
  return planFor(planId)
}

// Stops selling a plan at a price. Subscriptions already on it carry on.
async function removePlanPrice(storage, planId, priceId) {
  const { rowCount } = await storage.query('DELETE FROM plan_prices WHERE plan_id = $1 AND stripe_price_id = $2', [planId, priceId])
  // A price from before plan_prices is the plan's own stripe_price_id
  const { rowCount: legacy } = await storage.query('UPDATE plans SET stripe_price_id = NULL WHERE id = $1 AND stripe_price_id = $2', [planId, priceId])
  if (!rowCount && !legacy) throw new PlanError('The plan isn’t sold at that price.', 404)
  await loadPlans(storage)
  return planFor(planId)
}

module.exports = {
  PLAN_LIMITS, loadPlans, listPlans, planFor, planForPrice, priceFor, assignablePlans, purchasablePlans, teamPlans, toJSON,
  PlanError, createPlan, updatePlan, deletePlan, addPlanPrice, removePlanPrice, UPLOAD_CAP_BYTES,
}

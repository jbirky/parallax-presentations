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

const BUILT_IN = [
  { id: 'free', name: 'Free', storageBytes: 100 * MB, maxPresentations: 3, expirationDays: 30, maxFileBytes: null, stripePriceId: null, priceLabel: 'Free', public: true, sortOrder: 0 },
  { id: 'pro', name: 'Pro', storageBytes: 5 * GB, maxPresentations: Infinity, expirationDays: null, maxFileBytes: null, stripePriceId: 'price_1TVnpZF9LOeD1Xd0coGVd0fI', priceLabel: '$5/mo', public: true, sortOrder: 1 },
  { id: 'team', name: 'Team', storageBytes: 25 * GB, maxPresentations: Infinity, expirationDays: null, maxFileBytes: null, stripePriceId: null, priceLabel: null, public: false, sortOrder: 2 },
  { id: 'guest', name: 'Guest', storageBytes: 25 * MB, maxPresentations: 1, expirationDays: null, maxFileBytes: 10 * MB, stripePriceId: null, priceLabel: null, public: false, sortOrder: 3 },
]

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
    expirationDays: r.expiration_days,
    maxFileBytes: r.max_file_bytes === null ? null : Number(r.max_file_bytes),
    stripePriceId: r.stripe_price_id,
    priceLabel: r.price_label,
    public: r.public,
    sortOrder: r.sort_order,
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
  replaceAll(rows.map(fromRow))
}

function listPlans() {
  return Object.values(PLAN_LIMITS).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
}

// A plan by id, or free for an unknown one
function planFor(id) {
  return PLAN_LIMITS[id] || PLAN_LIMITS.free
}

function planForPrice(priceId) {
  return priceId ? listPlans().find(p => p.stripePriceId === priceId) || null : null
}

// Plans an admin can put an account on
function assignablePlans() {
  return listPlans().filter(p => p.id !== 'guest').map(p => p.id)
}

// Plans a signed-in account can buy
function purchasablePlans() {
  return listPlans().filter(p => p.public && p.stripePriceId)
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
  return {
    name,
    storageBytes,
    maxPresentations: optionalInt(input.maxPresentations, 'Presentations', 1, 100000),
    expirationDays: optionalInt(input.expirationDays, 'Expiry', 1, 3650),
    maxFileBytes: optionalInt(input.maxFileBytes, 'Largest file', MB, UPLOAD_CAP_BYTES),
    stripePriceId,
    priceLabel,
    public: isPublic,
    sortOrder: optionalInt(input.sortOrder, 'Order', 0, 1000) ?? 0,
  }
}

function friendlyWriteError(err) {
  if (err.code === '42P01') return new PlanError('Plans can’t be edited until migration 014 has run on this database.', 409)
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
      `INSERT INTO plans (id, name, storage_bytes, max_presentations, expiration_days, max_file_bytes, stripe_price_id, price_label, public, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, p.name, p.storageBytes, p.maxPresentations, p.expirationDays, p.maxFileBytes, p.stripePriceId, p.priceLabel, p.public, p.sortOrder]
    )
  } catch (err) { throw friendlyWriteError(err) }
  await loadPlans(storage)
  return planFor(id)
}

// Saves a plan's fields. With expiry off, presentations of accounts on it
// stop expiring, or the sweeper would still delete them; turning expiry on
// or changing its length only applies to new presentations. Returns the plan
// and how many presentations stopped expiring.
async function updatePlan(storage, id, input) {
  const p = validatePlan(id, input)
  let rows
  try {
    ({ rows } = await storage.query(`
      WITH changed AS (
        UPDATE plans SET name = $2, storage_bytes = $3, max_presentations = $4, expiration_days = $5,
               max_file_bytes = $6, stripe_price_id = $7, price_label = $8, public = $9, sort_order = $10, updated_at = NOW()
         WHERE id = $1 RETURNING id
      ), unexpired AS (
        UPDATE presentations SET expires_at = NULL
         WHERE $5::int IS NULL AND expires_at IS NOT NULL AND EXISTS (SELECT 1 FROM changed)
           AND user_id IN (SELECT u.id FROM users u WHERE COALESCE(u.plan, 'free') = $1)
        RETURNING id
      )
      SELECT (SELECT COUNT(*) FROM changed)::int AS found, (SELECT COUNT(*) FROM unexpired)::int AS unexpired`,
      [id, p.name, p.storageBytes, p.maxPresentations, p.expirationDays, p.maxFileBytes, p.stripePriceId, p.priceLabel, p.public, p.sortOrder]
    ))
  } catch (err) { throw friendlyWriteError(err) }
  if (!rows[0].found) throw new PlanError('No such plan.', 404)
  await loadPlans(storage)
  return { plan: planFor(id), unexpired: rows[0].unexpired }
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

module.exports = {
  PLAN_LIMITS, loadPlans, listPlans, planFor, planForPrice, assignablePlans, purchasablePlans, toJSON,
  PlanError, createPlan, updatePlan, deletePlan, UPLOAD_CAP_BYTES,
}

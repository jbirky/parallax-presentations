// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Presentations past a plan's limit are read-only, not expired (the pricing
// plan's "What to build", 2). A plan's maxPresentations is how many of a
// person's own presentations they can edit: their newest, by when each was
// made. The others can still be opened, presented, shared, copied, moved and
// deleted; deleting a newer one, or upgrading, makes them editable again.
// Team presentations have no such limit (the team's plan has none), and the
// self-hosted version none at all.

const { planFor } = require('./plans')

// How many of their own presentations a plan lets someone edit, or null for
// no limit
function editableLimit(planId) {
  const n = planFor(planId).maxPresentations
  return Number.isFinite(n) ? n : null
}

// Whether a personal presentation, made at createdAt by ownerId, is past the
// owner's limit: `limit` of theirs are newer
async function isPastLimit(storage, { id, ownerId, createdAt }, limit) {
  if (limit == null) return false
  const { rows } = await storage.query(
    `SELECT COUNT(*)::int AS n FROM presentations
      WHERE user_id = $1 AND team_id IS NULL AND is_template = false AND (created_at, id) > ($2, $3)`,
    [ownerId, createdAt, id]
  )
  return rows[0].n >= limit
}

// The ids of userId's own presentations past `limit`, for marking them in lists
async function lockedIds(storage, userId, limit) {
  if (limit == null || !storage.query) return new Set()
  const { rows } = await storage.query(
    `SELECT id FROM presentations WHERE user_id = $1 AND team_id IS NULL AND is_template = false
      ORDER BY created_at DESC, id DESC OFFSET $2`,
    [userId, limit]
  )
  return new Set(rows.map(r => r.id))
}

// Marks the presentations in a list that are read-only (locked: true), each
// by its owner's plan: list items with ownerId and ownerPlan, or all
// userId's on userPlan
async function markLocked(storage, list, { userId, userPlan } = {}) {
  const owners = new Map()
  for (const p of list) {
    if (p.teamId) continue
    const owner = p.ownerId || userId
    if (!owner) continue
    if (!owners.has(owner)) owners.set(owner, p.ownerPlan || userPlan)
  }
  const locked = new Set()
  for (const [owner, plan] of owners) {
    for (const id of await lockedIds(storage, owner, editableLimit(plan))) locked.add(id)
  }
  return list.map(p => (locked.has(p.id) ? { ...p, locked: true } : p))
}

// Whether presentation id is read-only by its owner's plan (for edits that
// don't come through deckAccess, such as an AI collaborator link's)
async function isDeckLocked(storage, id) {
  if (!storage.query) return false
  const { rows } = await storage.query(
    `SELECT p.id, p.user_id AS "ownerId", p.created_at AS "createdAt", p.team_id AS "teamId", u.plan
       FROM presentations p LEFT JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
    [id]
  )
  const r = rows[0]
  if (!r || r.teamId) return false
  return isPastLimit(storage, r, editableLimit(r.plan))
}

// What a read-only presentation says, to its owner or to someone editing
// with them
function lockedMessage(planId, { own = true } = {}) {
  const plan = planFor(planId)
  const n = plan.maxPresentations
  const kept = `the ${plan.name} plan keeps ${own ? 'your' : 'its owner’s'} ${n} newest presentation${n === 1 ? '' : 's'} editable`
  return own
    ? `This presentation is read-only: ${kept}. Upgrade, or delete a newer presentation, to edit it.`
    : `This presentation is read-only: ${kept}.`
}

module.exports = { editableLimit, isPastLimit, lockedIds, markLocked, isDeckLocked, lockedMessage }

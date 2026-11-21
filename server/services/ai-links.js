// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// AI collaborator links, in the cloud version: a link to one presentation
// that an AI chat app (Claude, ChatGPT, …) adds as a connector. The link is
// an MCP server at /mcp/<secret> (server/mcp), and the secret in it is the
// sign-in. Its owner makes links, renews and revokes them; each has a name
// ("Claude") that says whose changes are whose.
//
// The secret is shown once, when the link is made. Only its SHA-256 is kept,
// with its last four characters for telling links apart.

const crypto = require('crypto')

const PREFIX = 'plx_'
// plx_ and 32 random bytes in base64url
const SECRET_PATTERN = /^plx_[A-Za-z0-9_-]{43}$/
// How long a link lasts, in days; null never expires
const LIFETIMES = [7, 30, 90, null]
const DEFAULT_DAYS = 30
const MAX_LINKS = 10 // per presentation, not counting revoked ones
const NAME_MAX = 40
// A link's last use is written at most this often
const TOUCH_MS = 60 * 1000

const hashOf = secret => crypto.createHash('sha256').update(secret).digest('hex')
const newSecret = () => PREFIX + crypto.randomBytes(32).toString('base64url')

function httpError(status, message) {
  return Object.assign(new Error(message), { status, expose: true })
}

function cleanName(name) {
  const s = String(name ?? '').replace(/\s+/g, ' ').trim()
  if (!s) throw httpError(400, 'Give the link a name, such as Claude')
  if (s.length > NAME_MAX) throw httpError(400, `A link's name can be at most ${NAME_MAX} characters`)
  return s
}

// Days a link lasts: one of LIFETIMES, the default when none is given
function lifetime(days) {
  if (days === undefined) return DEFAULT_DAYS
  if (days === null || days === 'never') return null
  const n = Number(days)
  if (!LIFETIMES.includes(n)) throw httpError(400, 'A link lasts 7, 30 or 90 days, or never expires')
  return n
}

const COLUMNS = `id, name, token_hint AS hint, created_at AS "createdAt", expires_at AS "expiresAt", last_used_at AS "lastUsedAt"`
const withExpired = row => ({ ...row, expired: !!(row.expiresAt && new Date(row.expiresAt) <= new Date()) })
const expiry = `CASE WHEN $DAYS::int IS NULL THEN NULL ELSE NOW() + make_interval(days => $DAYS::int) END`

// A presentation's links, oldest first, expired ones too (they can be
// renewed), without revoked ones
async function listLinks(storage, presentationId) {
  const { rows } = await storage.query(
    `SELECT ${COLUMNS} FROM ai_links WHERE presentation_id = $1 AND revoked_at IS NULL ORDER BY created_at`,
    [presentationId]
  )
  return rows.map(withExpired)
}

// A new link: what listLinks gives for it, and its secret, which is never
// given again
async function createLink(storage, { presentationId, userId, name, days }) {
  const cleaned = cleanName(name)
  const life = lifetime(days)
  const { rows: [{ count }] } = await storage.query(
    'SELECT COUNT(*)::int AS count FROM ai_links WHERE presentation_id = $1 AND revoked_at IS NULL', [presentationId])
  if (count >= MAX_LINKS) throw httpError(409, `A presentation can have ${MAX_LINKS} AI collaborator links. Revoke one first.`)
  const secret = newSecret()
  const { rows } = await storage.query(
    `INSERT INTO ai_links (id, presentation_id, created_by, name, token_hash, token_hint, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, ${expiry.replace(/\$DAYS/g, '$7')})
     RETURNING ${COLUMNS}`,
    [crypto.randomUUID(), presentationId, userId, cleaned, hashOf(secret), secret.slice(-4), life]
  )
  return { ...withExpired(rows[0]), secret }
}

// A link made to last `days` from now, keeping its secret; null when the
// presentation has no such link
async function renewLink(storage, presentationId, linkId, days) {
  const life = lifetime(days)
  const { rows } = await storage.query(
    `UPDATE ai_links SET expires_at = ${expiry.replace(/\$DAYS/g, '$3')}
      WHERE id = $1 AND presentation_id = $2 AND revoked_at IS NULL
      RETURNING ${COLUMNS}`,
    [linkId, presentationId, life]
  )
  return rows[0] ? withExpired(rows[0]) : null
}

// Stops a link working; false when the presentation has no such link
async function revokeLink(storage, presentationId, linkId) {
  const { rowCount } = await storage.query(
    'UPDATE ai_links SET revoked_at = NOW() WHERE id = $1 AND presentation_id = $2 AND revoked_at IS NULL',
    [linkId, presentationId]
  )
  return rowCount > 0
}

// The link a secret is for, and its presentation: { id, name, deckId,
// ownerId, ownerPlan }, or null when no link that still works has it (an
// unknown, revoked or expired secret, or an expired presentation all look
// the same). Notes when it was used.
async function findLink(storage, secret) {
  if (typeof secret !== 'string' || !SECRET_PATTERN.test(secret)) return null
  const { rows } = await storage.query(
    `SELECT l.id, l.name, l.presentation_id AS "deckId", l.last_used_at AS "lastUsedAt",
            p.user_id AS "ownerId", u.plan AS "ownerPlan"
       FROM ai_links l
       JOIN presentations p ON p.id = l.presentation_id
       LEFT JOIN users u ON u.id = p.user_id
      WHERE l.token_hash = $1 AND l.revoked_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > NOW())
        AND p.is_template = false
        AND (p.expires_at IS NULL OR p.expires_at > NOW())`,
    [hashOf(secret)]
  )
  const link = rows[0]
  if (!link) return null
  if (!link.lastUsedAt || Date.now() - new Date(link.lastUsedAt).getTime() > TOUCH_MS) {
    storage.query('UPDATE ai_links SET last_used_at = NOW() WHERE id = $1', [link.id])
      .catch(err => console.error('AI link: noting its use failed:', err.message))
  }
  const { lastUsedAt, ...rest } = link
  return rest
}

module.exports = {
  listLinks, createLink, renewLink, revokeLink, findLink,
  hashOf, SECRET_PATTERN, LIFETIMES, DEFAULT_DAYS, MAX_LINKS, NAME_MAX,
}

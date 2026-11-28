// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// AI access tokens, in the cloud version: a token for a person's whole
// account, which an AI agent sends to the account-level MCP server at /mcp
// (server/mcp/account.js) as "Authorization: Bearer <token>". Claude Code's
// parallax plugin reads it from PARALLAX_TOKEN. Where an AI collaborator link
// (ai-links.js) reaches one presentation, a token reaches every presentation
// its person can open, as they can: viewing what they view, changing what
// they edit. Each has a name ("Claude Code") that says whose changes are
// whose, and scopes that say whether it may change anything.
//
// The secret is shown once, when the token is made. Only its SHA-256 is
// kept, with its last four characters for telling tokens apart.

const crypto = require('crypto')
const { base32, hashOf } = require('./ai-links')

const PREFIX = 'plx_pat_'
const SECRET_PATTERN = /^plx_pat_[a-z2-7]{52}$/
// What a token may do: read presentations, and change them (and make new
// ones). A token has decks:read at least.
const SCOPES = ['decks:read', 'decks:write']
const DEFAULT_SCOPES = ['decks:read', 'decks:write']
// How long a token lasts, in days. None lasts forever: a token reaches a
// whole account.
const LIFETIMES = [30, 90, 365]
const DEFAULT_DAYS = 90
const MAX_TOKENS = 10 // per person, not counting revoked or expired ones
const NAME_MAX = 40
// A token's last use is written at most this often
const TOUCH_MS = 60 * 1000

const newSecret = () => PREFIX + base32(crypto.randomBytes(32))

function httpError(status, message) {
  return Object.assign(new Error(message), { status, expose: true })
}

function cleanName(name) {
  const s = String(name ?? '').replace(/\s+/g, ' ').trim()
  if (!s) throw httpError(400, 'Give the token a name, such as Claude Code')
  if (s.length > NAME_MAX) throw httpError(400, `A token's name can be at most ${NAME_MAX} characters`)
  return s
}

function lifetime(days) {
  if (days === undefined || days === null) return DEFAULT_DAYS
  const n = Number(days)
  if (!LIFETIMES.includes(n)) throw httpError(400, 'A token lasts 30, 90 or 365 days')
  return n
}

function cleanScopes(scopes) {
  if (scopes === undefined) return DEFAULT_SCOPES
  if (!Array.isArray(scopes) || scopes.some(s => !SCOPES.includes(s))) {
    throw httpError(400, `A token's scopes are some of ${SCOPES.join(', ')}`)
  }
  return SCOPES.filter(s => s === 'decks:read' || scopes.includes(s))
}

const COLUMNS = `id, name, token_hint AS hint, scopes, created_at AS "createdAt", expires_at AS "expiresAt", last_used_at AS "lastUsedAt"`
const withExpired = row => ({ ...row, expired: !!(row.expiresAt && new Date(row.expiresAt) <= new Date()) })

// A person's tokens, newest first, expired ones too, without revoked ones
async function listTokens(storage, userId) {
  const { rows } = await storage.query(
    `SELECT ${COLUMNS} FROM ai_tokens WHERE user_id = $1 AND oauth_client IS NULL AND revoked_at IS NULL ORDER BY created_at DESC`,
    [userId]
  )
  return rows.map(withExpired)
}

// The address an app's OAuth client id names, for telling apps apart: a
// Client ID Metadata Document's host (claude.ai), or nothing for a client id
// that isn't an address
const clientHost = client => {
  try { return /^https:/.test(client) ? new URL(client).host : '' } catch { return '' }
}

// The apps a person connected by signing in (server/mcp/oauth.js), the most
// recently used first, those they turned off too: { id, name, host,
// createdAt, lastUsedAt, off }
async function listApps(storage, userId) {
  const { rows } = await storage.query(
    `SELECT id, name, oauth_client AS client, created_at AS "createdAt", last_used_at AS "lastUsedAt", revoked_at IS NOT NULL AS off
       FROM ai_tokens WHERE user_id = $1 AND oauth_client IS NOT NULL
      ORDER BY COALESCE(last_used_at, created_at) DESC`,
    [userId]
  )
  return rows.map(({ client, ...app }) => ({ ...app, host: clientHost(client) }))
}

// The app an OAuth client is for one person, made the first time it signs
// in: { id, name, scopes, userId, userPlan, off }. An app reads and writes,
// since Clerk's scopes can't say which; the person limits it by turning it
// off. Notes when it was used.
async function connectApp(storage, { userId, client, name }) {
  const { rows: [app] } = await storage.query(
    `INSERT INTO ai_tokens (id, user_id, name, scopes, oauth_client, last_used_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id, oauth_client) WHERE oauth_client IS NOT NULL
       DO UPDATE SET last_used_at = NOW()
     RETURNING id, name, scopes, user_id AS "userId", revoked_at IS NOT NULL AS off`,
    [crypto.randomUUID(), userId, String(name || 'AI app').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) || 'AI app', DEFAULT_SCOPES, String(client).slice(0, 500)]
  )
  const { rows: [user] } = await storage.query('SELECT plan FROM users WHERE id = $1', [userId])
  return { ...app, userPlan: user?.plan }
}

// Lets an app the person turned off sign in again; false when they have no
// such app
async function allowApp(storage, userId, appId) {
  const { rowCount } = await storage.query(
    'UPDATE ai_tokens SET revoked_at = NULL WHERE id = $1 AND user_id = $2 AND oauth_client IS NOT NULL AND revoked_at IS NOT NULL',
    [appId, userId]
  )
  return rowCount > 0
}

// A new token: what listTokens gives for it, and its secret, which is never
// given again
async function createToken(storage, { userId, name, days, scopes }) {
  const cleaned = cleanName(name)
  const life = lifetime(days)
  const scoped = cleanScopes(scopes)
  const { rows: [{ count }] } = await storage.query(
    `SELECT COUNT(*)::int AS count FROM ai_tokens
      WHERE user_id = $1 AND oauth_client IS NULL AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`, [userId])
  if (count >= MAX_TOKENS) throw httpError(409, `You can have ${MAX_TOKENS} AI access tokens. Revoke one first.`)
  const secret = newSecret()
  const { rows } = await storage.query(
    `INSERT INTO ai_tokens (id, user_id, name, token_hash, token_hint, scopes, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + make_interval(days => $7::int))
     RETURNING ${COLUMNS}`,
    [crypto.randomUUID(), userId, cleaned, hashOf(secret), secret.slice(-4), scoped, life]
  )
  return { ...withExpired(rows[0]), secret }
}

// Stops a token working, or turns a connected app off; false when the person
// has no such token or app
async function revokeToken(storage, userId, tokenId) {
  const { rowCount } = await storage.query(
    'UPDATE ai_tokens SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL',
    [tokenId, userId]
  )
  return rowCount > 0
}

// The token a secret is, and its person: { id, name, scopes, userId,
// userPlan }, or null when no token that still works has it (an unknown,
// revoked or expired secret all look the same). Notes when it was used.
async function findToken(storage, secret) {
  if (typeof secret !== 'string' || !SECRET_PATTERN.test(secret)) return null
  const { rows } = await storage.query(
    `SELECT t.id, t.name, t.scopes, t.user_id AS "userId", u.plan AS "userPlan", t.last_used_at AS "lastUsedAt"
       FROM ai_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at > NOW())`,
    [hashOf(secret)]
  )
  const token = rows[0]
  if (!token) return null
  if (!token.lastUsedAt || Date.now() - new Date(token.lastUsedAt).getTime() > TOUCH_MS) {
    storage.query('UPDATE ai_tokens SET last_used_at = NOW() WHERE id = $1', [token.id])
      .catch(err => console.error('AI token: noting its use failed:', err.message))
  }
  const { lastUsedAt, ...rest } = token
  return rest
}

module.exports = {
  listTokens, createToken, revokeToken, findToken, listApps, connectApp, allowApp,
  SECRET_PATTERN, SCOPES, DEFAULT_SCOPES, LIFETIMES, DEFAULT_DAYS, MAX_TOKENS, NAME_MAX,
}

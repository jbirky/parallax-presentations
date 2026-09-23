// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Guest mode: account-free editor sessions. A session is deleted, with all of
// its presentations and files, when its tab closes or after GUEST_IDLE_HOURS
// without activity.

const crypto = require('crypto')
const { isR2Enabled, deleteManyFromR2, listR2Keys } = require('./r2')

const GUEST_IDLE_HOURS = 12
// A tab close is only final after this long: pagehide also fires on reload,
// and a reloaded tab reconnects within seconds.
const CLOSE_GRACE_SECONDS = 120

// The sweeper skips its query while no sessions can exist, so an unused guest
// mode doesn't keep the database awake. Unknown after a restart, so start true.
let sessionsMayExist = true
let sessionsCreated = 0

function guestSessionsMayExist() {
  return sessionsMayExist
}

function isGuestModeEnabled() {
  return process.env.PARALLAX_MODE === 'cloud' && !!isR2Enabled() &&
    !!process.env.TURNSTILE_SITE_KEY && !!process.env.TURNSTILE_SECRET_KEY
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

// Every R2 key a guest session writes starts with this, so the bucket's
// lifecycle rule for guest/ can remove anything the sweeper misses.
function guestKeyPrefix(sessionId) {
  return `guest/${sessionId}`
}

async function verifyTurnstile(responseToken, remoteIp) {
  if (!responseToken) return false
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: String(responseToken),
      ...(remoteIp ? { remoteip: remoteIp } : {}),
    }),
  })
  const data = await res.json().catch(() => ({}))
  return data.success === true
}

async function createGuestSession(storage) {
  const token = crypto.randomBytes(32).toString('base64url')
  const userId = crypto.randomUUID()
  await storage.query(
    `WITH u AS (
       INSERT INTO users (id, email, name, auth_provider, plan)
       VALUES ($1, $2, 'Guest', 'guest', 'guest') RETURNING id
     )
     INSERT INTO guest_sessions (user_id, token_hash) SELECT id, $3 FROM u`,
    [userId, `${userId}@guest.invalid`, hashToken(token)]
  )
  sessionsCreated++
  sessionsMayExist = true
  return { token }
}

// Returns { id, userId } for a live session, or null if it has ended.
// Any request cancels a pending close; `activity` also resets the idle clock.
async function touchGuestSession(storage, token, { activity }) {
  const { rows } = await storage.query(
    `SELECT id, user_id, closing_at, last_active_at < NOW() - INTERVAL '1 minute' AS stale
       FROM guest_sessions
      WHERE token_hash = $1
        AND last_active_at > NOW() - make_interval(hours => $2)
        AND (closing_at IS NULL OR closing_at > NOW() - make_interval(secs => $3))`,
    [hashToken(token), GUEST_IDLE_HOURS, CLOSE_GRACE_SECONDS]
  )
  const s = rows[0]
  if (!s) return null
  if (s.closing_at || (activity && s.stale)) {
    await storage.query(
      `UPDATE guest_sessions SET closing_at = NULL,
              last_active_at = CASE WHEN $2 THEN NOW() ELSE last_active_at END
        WHERE id = $1`,
      [s.id, !!activity]
    )
  }
  return { id: s.id, userId: s.user_id }
}

async function closeGuestSession(storage, token) {
  await storage.query(
    'UPDATE guest_sessions SET closing_at = NOW() WHERE token_hash = $1 AND closing_at IS NULL',
    [hashToken(token)]
  )
}

async function deleteGuestSession(storage, session) {
  if (isR2Enabled()) {
    const { rows } = await storage.query(
      `SELECT storage_key FROM uploads WHERE user_id = $1
       UNION SELECT storage_key FROM datasets WHERE user_id = $1`,
      [session.user_id]
    )
    const keys = rows.map(r => r.storage_key).filter(k => !k.startsWith('local:'))
    keys.push(...await listR2Keys(`${guestKeyPrefix(session.id)}/`))
    const failed = await deleteManyFromR2(keys)
    if (failed.length) throw new Error(`could not delete ${failed.length} R2 files; will retry`)
  }
  // uploads.user_id has no ON DELETE CASCADE; deleting the user removes the
  // session, presentations, snapshots, datasets and everything else.
  await storage.query('DELETE FROM uploads WHERE user_id = $1', [session.user_id])
  await storage.query("DELETE FROM users WHERE id = $1 AND plan = 'guest'", [session.user_id])
}

// Deletes every session that was closed (past the grace period) or idle for
// GUEST_IDLE_HOURS. A session whose files can't be deleted is retried next run.
async function sweepGuestSessions(storage) {
  const createdBefore = sessionsCreated
  const { rows } = await storage.query(
    `SELECT id, user_id FROM guest_sessions
      WHERE last_active_at < NOW() - make_interval(hours => $1)
         OR closing_at < NOW() - make_interval(secs => $2)
      LIMIT 50`,
    [GUEST_IDLE_HOURS, CLOSE_GRACE_SECONDS]
  )
  let deleted = 0
  for (const session of rows) {
    try {
      await deleteGuestSession(storage, session)
      deleted++
    } catch (err) {
      console.error(`Guest cleanup failed for session ${session.id}:`, err.message)
    }
  }
  const { rows: left } = await storage.query('SELECT EXISTS (SELECT 1 FROM guest_sessions) AS any')
  // A session started while this sweep ran keeps the sweeper going
  if (!left[0].any && sessionsCreated === createdBefore) sessionsMayExist = false
  return deleted
}

module.exports = {
  GUEST_IDLE_HOURS,
  isGuestModeEnabled, guestKeyPrefix, verifyTurnstile, guestSessionsMayExist,
  createGuestSession, touchGuestSession, closeGuestSession, sweepGuestSessions,
}

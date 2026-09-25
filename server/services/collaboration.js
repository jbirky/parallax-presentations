// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Editing a presentation with others, in the cloud version. Its owner turns on
// an invite link, and each signed-in person who opens it becomes an editor.
// Editors open, change, upload to, and keep versions of the presentation;
// deleting it, share links, live presenting, GitHub and Zenodo stay with the
// owner. Editors' uploads count against the owner's storage.

const { v4: uuidv4 } = require('uuid')
const { IS_CLOUD } = require('../middleware/auth')
const { refuseUpload } = require('../middleware/upload-quota')

// userId's access to presentation id: { ownerId, ownerPlan, role }, with role
// 'owner' or 'editor', or null when they have none
async function presentationAccess(storage, id, userId) {
  const { rows } = await storage.query(
    `SELECT p.user_id AS "ownerId", u.plan AS "ownerPlan",
            CASE WHEN p.user_id = $2 THEN 'owner' ELSE c.role END AS role
       FROM presentations p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN presentation_collaborators c ON c.presentation_id = p.id AND c.user_id = $2
      WHERE p.id = $1 AND p.is_template = false AND (p.user_id = $2 OR c.user_id IS NOT NULL)`,
    [id, userId]
  )
  return rows[0] || null
}

// Lets a request at a presentation (the route's `param`) through for its owner
// and its editors, with req.deck = { id, ownerId, ownerPlan, role }. Routes act
// as the owner: they pass req.deck.ownerId to storage, and uploads go on the
// owner's storage. Self-hosted and in guest mode there are no editors, and
// req.deck is the user's own; storage checks it's theirs, as before.
function deckAccess(storage, param = 'id') {
  return async (req, res, next) => {
    const id = req.params[param]
    if (!IS_CLOUD || !storage.query || req.isGuest || !req.userId) {
      req.deck = { id, ownerId: req.userId, ownerPlan: req.userPlan, role: 'owner' }
      return next()
    }
    try {
      const access = await presentationAccess(storage, id, req.userId)
      if (!access) {
        // An upload's body hasn't been read yet (see refuseUpload)
        if (req.is('multipart/form-data') && !req.readableEnded) return refuseUpload(req, res, { status: 404, error: 'Not found' })
        return res.status(404).json({ error: 'Not found' })
      }
      req.deck = { id, ...access }
      next()
    } catch (err) {
      next(err)
    }
  }
}

// For routes only the owner may use, after deckAccess
function ownerOnly(req, res, next) {
  if (req.deck?.role !== 'owner') return res.status(403).json({ error: 'Only the owner can do this' })
  next()
}

// The owner and the editors, owner first, then editors by when they joined
async function listCollaborators(storage, id) {
  const { rows } = await storage.query(
    `SELECT u.id, u.name, u.email, u.avatar_url AS "avatarUrl", 'owner' AS role, p.created_at AS "joinedAt"
       FROM presentations p JOIN users u ON u.id = p.user_id
      WHERE p.id = $1
     UNION ALL
     SELECT u.id, u.name, u.email, u.avatar_url, c.role, c.created_at
       FROM presentation_collaborators c JOIN users u ON u.id = c.user_id
      WHERE c.presentation_id = $1
     ORDER BY 5 DESC, 6`,
    [id]
  )
  return rows
}

async function getInviteToken(storage, id) {
  const { rows } = await storage.query('SELECT invite_token FROM presentations WHERE id = $1', [id])
  return rows[0]?.invite_token || null
}

// Turns the invite link on with a new token, which stops the old link
// working, or turns it off
async function setInviteToken(storage, id, on) {
  const { rows } = await storage.query(
    'UPDATE presentations SET invite_token = $2 WHERE id = $1 RETURNING invite_token',
    [id, on ? uuidv4() : null]
  )
  return rows[0]?.invite_token || null
}

// What an invite link is for, as userId sees it: { id, title, ownerName,
// joined }, or null when no presentation has the token
async function describeInvite(storage, token, userId) {
  const { rows } = await storage.query(
    `SELECT p.id, p.title, COALESCE(NULLIF(u.name, ''), u.email) AS "ownerName",
            (p.user_id = $2 OR EXISTS (
              SELECT 1 FROM presentation_collaborators c WHERE c.presentation_id = p.id AND c.user_id = $2)) AS joined
       FROM presentations p JOIN users u ON u.id = p.user_id
      WHERE p.invite_token = $1 AND p.is_template = false`,
    [token, userId]
  )
  return rows[0] || null
}

// Makes userId an editor of the presentation the token is for: { id, title,
// role }, or null when no presentation has the token. The owner stays owner.
async function acceptInvite(storage, token, userId) {
  const { rows } = await storage.query(
    'SELECT id, title, user_id FROM presentations WHERE invite_token = $1 AND is_template = false',
    [token]
  )
  if (!rows.length) return null
  const { id, title, user_id: ownerId } = rows[0]
  if (ownerId === userId) return { id, title, role: 'owner' }
  await storage.query(
    'INSERT INTO presentation_collaborators (presentation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [id, userId]
  )
  return { id, title, role: 'editor' }
}

async function removeCollaborator(storage, id, userId) {
  const { rowCount } = await storage.query(
    'DELETE FROM presentation_collaborators WHERE presentation_id = $1 AND user_id = $2',
    [id, userId]
  )
  return rowCount > 0
}

// The presentations userId edits for others, for the dashboard: listed like
// their own, with role 'editor' and the owner's name. Expired ones are left out.
async function listSharedPresentations(storage, userId) {
  const { rows } = await storage.query(
    `SELECT p.id, p.title,
            p.data->>'theme' AS theme,
            p.data->>'transition' AS transition,
            jsonb_array_length(COALESCE(p.data->'slides', '[]'::jsonb)) AS "slideCount",
            p.updated_at AS "updatedAt",
            p.created_at AS "createdAt",
            p.expires_at AS "expiresAt",
            p.data->'slides'->0->'background' AS thumbnail,
            c.role,
            COALESCE(NULLIF(u.name, ''), u.email) AS "ownerName"
       FROM presentation_collaborators c
       JOIN presentations p ON p.id = c.presentation_id
       JOIN users u ON u.id = p.user_id
      WHERE c.user_id = $1 AND p.is_template = false
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
      ORDER BY p.updated_at DESC`,
    [userId]
  )
  return rows.map(r => ({ ...r, slideCount: parseInt(r.slideCount) || 0, thumbnail: r.thumbnail || null }))
}

module.exports = {
  presentationAccess, deckAccess, ownerOnly,
  listCollaborators, getInviteToken, setInviteToken, describeInvite, acceptInvite, removeCollaborator,
  listSharedPresentations,
}

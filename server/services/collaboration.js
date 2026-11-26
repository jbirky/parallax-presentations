// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Editing a presentation with others, in the cloud version. Its owner turns on
// an invite link, and each signed-in person who opens it becomes an editor.
// Editors open, change, upload to, and keep versions of the presentation;
// deleting it, share links, live presenting, GitHub and Zenodo stay with the
// owner. Editors' uploads count against the owner's storage.
//
// A team's decks (services/teams.js, services/team-space.js) are reached
// through the team instead: its owner and admins act as each deck's owner,
// members edit (and own the decks they made), viewers only view, and uploads
// count against the team's shared storage.

const { v4: uuidv4 } = require('uuid')
const { IS_CLOUD } = require('../middleware/auth')
const { refuseUpload } = require('../middleware/upload-quota')

// Deck roles, weakest first: a viewer opens and presents; an editor also
// changes it; an owner also deletes it, shares it, presents it live and
// manages who edits it
const DECK_ROLES = ['viewer', 'editor', 'owner']
const stronger = (a, b) => (DECK_ROLES.indexOf(a) >= DECK_ROLES.indexOf(b) ? a : b)

// A team member's role on one of the team's decks (services/teams.js): the
// team's owner and admins manage every deck, and members the decks they
// made; members edit the rest, and viewers only view
function teamDeckRole(teamRole, isCreator) {
  if (teamRole === 'owner' || teamRole === 'admin') return 'owner'
  if (teamRole === 'member') return isCreator ? 'owner' : 'editor'
  if (teamRole === 'viewer') return 'viewer'
  return null
}

// userId's access to presentation id, or null when they have none:
//   { ownerId, ownerPlan, role, teamId, teamRole, seats, lapsed }
// role is 'owner', 'editor' or 'viewer' (DECK_ROLES). ownerId is who made
// it: storage calls are made as them. For a team deck, ownerPlan is the
// team's plan, whose storage is shared by the team (seats × the plan's), and
// once the team's subscription has lapsed everyone only views.
async function presentationAccess(storage, id, userId) {
  const { rows } = await storage.query(
    `SELECT p.user_id AS "ownerId", u.plan AS "userPlan", p.team_id AS "teamId",
            t.plan AS "teamPlan", t.seats, t.status AS "teamStatus",
            m.role AS "teamRole", c.role AS "collabRole"
       FROM presentations p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN teams t ON t.id = p.team_id
       LEFT JOIN team_members m ON m.team_id = p.team_id AND m.user_id = $2
       LEFT JOIN presentation_collaborators c ON c.presentation_id = p.id AND c.user_id = $2
      WHERE p.id = $1 AND p.is_template = false`,
    [id, userId]
  )
  const r = rows[0]
  if (!r) return null
  const isCreator = r.ownerId === userId
  let role
  if (!r.teamId) {
    role = isCreator ? 'owner' : r.collabRole ? 'editor' : null
  } else {
    // Someone invited to edit the deck itself is at least an editor
    role = teamDeckRole(r.teamRole, isCreator)
    if (r.collabRole) role = role ? stronger(role, 'editor') : 'editor'
    if (role && r.teamStatus === 'lapsed') role = 'viewer'
  }
  if (!role) return null
  return {
    ownerId: r.ownerId,
    ownerPlan: r.teamId ? r.teamPlan : r.userPlan,
    role,
    teamId: r.teamId || null,
    teamRole: r.teamRole || null,
    seats: r.teamId ? r.seats : null,
    lapsed: r.teamStatus === 'lapsed',
  }
}

// Lets a request at a presentation (the route's `param`) through for anyone
// with a role on it, with req.deck = { id, ...presentationAccess }. Routes
// act as the deck's maker: they pass req.deck.ownerId to storage. Self-hosted
// and in guest mode there are no editors or teams, and req.deck is the user's
// own; storage checks it's theirs, as before.
function deckAccess(storage, param = 'id') {
  return async (req, res, next) => {
    const id = req.params[param]
    if (!IS_CLOUD || !storage.query || req.isGuest || !req.userId) {
      req.deck = { id, ownerId: req.userId, ownerPlan: req.userPlan, role: 'owner', teamId: null, teamRole: null, seats: null, lapsed: false }
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

// For routes that change a presentation, after deckAccess: not for viewers
function canEdit(req, res, next) {
  if (req.deck?.role !== 'viewer') return next()
  const error = req.deck.lapsed
    ? 'This team’s subscription has ended, so its presentations can be viewed but not changed.'
    : 'You can view this presentation but not change it.'
  if (req.is('multipart/form-data') && !req.readableEnded) return refuseUpload(req, res, { status: 403, error })
  res.status(403).json({ error })
}

// For routes only the owner may use, after deckAccess. On a team deck, that's
// the team's owner and admins and the deck's maker (teamDeckRole).
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

// The first letter and the domain of an email address (j…@example.com), for
// telling people apart without giving their address away
function emailHint(email) {
  const at = (email || '').lastIndexOf('@')
  return at > 0 ? `${email[0]}…${email.slice(at)}` : ''
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
  DECK_ROLES, teamDeckRole, presentationAccess, deckAccess, canEdit, ownerOnly,
  listCollaborators, emailHint, getInviteToken, setInviteToken, describeInvite, acceptInvite, removeCollaborator,
  listSharedPresentations,
}

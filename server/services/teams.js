// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Teams, in the cloud version (phase 1 of the team subscriptions plan): a team
// has members in one of four roles and pays for seats; people join through
// invite links. The owner, admins and members take a seat each; viewers don't.
//
// Who can do what:
//   owner   everything, and the only one who hands the team over
//   admin   renames the team, makes and revokes invite links, changes roles
//           and removes people, except the owner
//   member  sees the team and its members
//   viewer  the same, without a seat
// Anyone but the owner can leave. Teams are made by an admin of the site for
// now (/admin), until teams can be bought.

const crypto = require('crypto')

const ROLES = ['owner', 'admin', 'member', 'viewer']
const INVITE_ROLES = ['admin', 'member', 'viewer']
const SEAT_ROLES = ['owner', 'admin', 'member']
const MANAGERS = ['owner', 'admin']
const STATUSES = ['active', 'past_due', 'lapsed']
const NAME_MAX = 60
const MAX_SEATS = 1000
const MAX_INVITES = 20 // open links per team
const INVITE_DAYS = [7, 30, 90]
// The secret in an invite link: 32 random bytes, URL-safe
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

const hashOf = token => crypto.createHash('sha256').update(token).digest('hex')

class TeamError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const isManager = role => MANAGERS.includes(role)
const takesSeat = role => SEAT_ROLES.includes(role)

function cleanName(name) {
  const s = String(name ?? '').replace(/\s+/g, ' ').trim()
  if (!s) throw new TeamError(400, 'Give the team a name')
  if (s.length > NAME_MAX) throw new TeamError(400, `A team's name can be at most ${NAME_MAX} characters`)
  return s
}

function cleanSeats(seats) {
  const n = Number(seats)
  if (!Number.isInteger(n) || n < 1 || n > MAX_SEATS) throw new TeamError(400, `Seats must be a whole number from 1 to ${MAX_SEATS}`)
  return n
}

function cleanEmail(email) {
  if (email === undefined || email === null || email === '') return null
  const s = String(email).trim().toLowerCase()
  if (s.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new TeamError(400, 'That email address doesn\'t look right')
  return s
}

// The first letter and the domain of an email address (j…@example.com)
function emailHint(email) {
  const at = (email || '').lastIndexOf('@')
  return at > 0 ? `${email[0]}…${email.slice(at)}` : ''
}

// Runs fn(client) in a transaction on one connection
async function inTransaction(storage, fn) {
  const client = await storage.pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

// userId's role in the team, or null
async function roleIn(db, teamId, userId) {
  const { rows } = await db.query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId])
  return rows[0]?.role || null
}

// Seats taken: everyone but viewers
async function seatsUsed(db, teamId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM team_members WHERE team_id = $1 AND role = ANY($2)`,
    [teamId, SEAT_ROLES]
  )
  return rows[0].n
}

// The team row, locked until the transaction ends, or a 404
async function lockTeam(client, teamId) {
  const { rows } = await client.query('SELECT id, name, seats, status, owner_id FROM teams WHERE id = $1 FOR UPDATE', [teamId])
  if (!rows.length) throw new TeamError(404, 'Team not found')
  return rows[0]
}

// The teams userId belongs to, for the dashboard
async function listTeams(storage, userId) {
  const { rows } = await storage.query(
    `SELECT t.id, t.name, t.plan, t.seats, t.status, m.role,
            (SELECT COUNT(*)::int FROM team_members x WHERE x.team_id = t.id) AS "memberCount",
            (SELECT COUNT(*)::int FROM team_members x WHERE x.team_id = t.id AND x.role = ANY($2)) AS "seatsUsed"
       FROM team_members m JOIN teams t ON t.id = m.team_id
      WHERE m.user_id = $1
      ORDER BY lower(t.name), t.created_at`,
    [userId, SEAT_ROLES]
  )
  return rows
}

// A team as userId sees it: its members and, for owners and admins, its open
// invite links and members' email addresses. A 404 for anyone not in it.
async function getTeam(storage, teamId, userId) {
  const role = await roleIn(storage, teamId, userId)
  if (!role) throw new TeamError(404, 'Team not found')
  const { rows: [team] } = await storage.query(
    `SELECT id, name, plan, seats, status, created_at AS "createdAt",
            stripe_subscription_id IS NOT NULL AS subscribed
       FROM teams WHERE id = $1`,
    [teamId]
  )
  const { rows: members } = await storage.query(
    `SELECT u.id, COALESCE(NULLIF(u.name, ''), u.email) AS name, u.email, u.avatar_url AS "avatarUrl",
            m.role, m.joined_at AS "joinedAt"
       FROM team_members m JOIN users u ON u.id = m.user_id
      WHERE m.team_id = $1
      ORDER BY array_position($2::text[], m.role), m.joined_at`,
    [teamId, ROLES]
  )
  const manager = isManager(role)
  const result = {
    ...team,
    role,
    you: userId,
    seatsUsed: members.filter(m => takesSeat(m.role)).length,
    members: manager ? members : members.map(m => (m.id === userId ? m : { ...m, email: emailHint(m.email) })),
  }
  if (manager) result.invites = await listInvites(storage, teamId)
  return result
}

async function renameTeam(storage, teamId, userId, name) {
  const role = await roleIn(storage, teamId, userId)
  if (!role) throw new TeamError(404, 'Team not found')
  if (!isManager(role)) throw new TeamError(403, 'Only the team\'s owner and admins can rename it')
  const { rows } = await storage.query(
    'UPDATE teams SET name = $2, updated_at = NOW() WHERE id = $1 RETURNING name',
    [teamId, cleanName(name)]
  )
  return rows[0]
}

// --- Invite links ---

const INVITE_COLUMNS = `id, role, email, token_hint AS hint, created_at AS "createdAt", expires_at AS "expiresAt"`

async function listInvites(db, teamId) {
  const { rows } = await db.query(
    `SELECT ${INVITE_COLUMNS} FROM team_invites
      WHERE team_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC`,
    [teamId]
  )
  return rows
}

// A new invite link, as { token, invite }. The token is shown this once: only
// its hash is kept. { role, email?, days? }; days is 7, 30 or 90, or none for
// a link that doesn't expire.
async function createInvite(storage, teamId, userId, { role, email, days } = {}) {
  const myRole = await roleIn(storage, teamId, userId)
  if (!myRole) throw new TeamError(404, 'Team not found')
  if (!isManager(myRole)) throw new TeamError(403, 'Only the team\'s owner and admins can invite people')
  if (!INVITE_ROLES.includes(role)) throw new TeamError(400, 'Invite someone as an admin, member or viewer')
  const lockedEmail = cleanEmail(email)
  let expires = null
  if (days !== undefined && days !== null && days !== 'never') {
    const n = Number(days)
    if (!INVITE_DAYS.includes(n)) throw new TeamError(400, 'An invite link lasts 7, 30 or 90 days, or doesn\'t expire')
    expires = n
  }
  if ((await listInvites(storage, teamId)).length >= MAX_INVITES) {
    throw new TeamError(400, `A team can have at most ${MAX_INVITES} invite links open; revoke one first`)
  }
  const token = crypto.randomBytes(32).toString('base64url')
  const { rows } = await storage.query(
    `INSERT INTO team_invites (team_id, role, email, token_hash, token_hint, created_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7::int IS NULL THEN NULL ELSE NOW() + make_interval(days => $7::int) END)
     RETURNING ${INVITE_COLUMNS}`,
    [teamId, role, lockedEmail, hashOf(token), token.slice(-4), userId, expires]
  )
  return { token, invite: rows[0] }
}

// How many invites for an email address userId has made in the last hour,
// as a cap on the invitations the site emails for them
async function recentEmailInvites(db, userId) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM team_invites
      WHERE created_by = $1 AND email IS NOT NULL AND created_at > NOW() - interval '1 hour'`,
    [userId]
  )
  return rows[0].n
}

async function revokeInvite(storage, teamId, userId, inviteId) {
  const myRole = await roleIn(storage, teamId, userId)
  if (!myRole) throw new TeamError(404, 'Team not found')
  if (!isManager(myRole)) throw new TeamError(403, 'Only the team\'s owner and admins can revoke invite links')
  const { rowCount } = await storage.query(
    'UPDATE team_invites SET revoked_at = NOW() WHERE id = $1 AND team_id = $2 AND revoked_at IS NULL',
    [inviteId, teamId]
  )
  if (!rowCount) throw new TeamError(404, 'No such invite link')
}

// The open invite a token is for, with its team, or null
async function findInvite(db, token, { lock = false } = {}) {
  if (!TOKEN_PATTERN.test(token || '')) return null
  const { rows } = await db.query(
    `SELECT i.id, i.team_id AS "teamId", i.role, i.email, t.name AS "teamName", t.status,
            COALESCE(NULLIF(u.name, ''), u.email) AS "invitedBy"
       FROM team_invites i
       JOIN teams t ON t.id = i.team_id
       LEFT JOIN users u ON u.id = i.created_by
      WHERE i.token_hash = $1 AND i.revoked_at IS NULL AND (i.expires_at IS NULL OR i.expires_at > NOW())
      ${lock ? 'FOR UPDATE OF i' : ''}`,
    [hashOf(token)]
  )
  return rows[0] || null
}

const GONE = 'This invite link has expired or been revoked.'
const wrongEmail = email => `This invite is for ${emailHint(email)}. Sign in with that address to accept it.`

// What an invite link offers userId (whose address is `email`): { teamId,
// teamName, role, invitedBy, joined, yourRole, seatsFull, wrongEmail }
async function describeInvite(storage, token, userId, email) {
  const invite = await findInvite(storage, token)
  if (!invite) throw new TeamError(404, GONE)
  const yourRole = await roleIn(storage, invite.teamId, userId)
  const { rows: [team] } = await storage.query('SELECT seats FROM teams WHERE id = $1', [invite.teamId])
  return {
    teamId: invite.teamId,
    teamName: invite.teamName,
    role: invite.role,
    invitedBy: invite.invitedBy,
    joined: !!yourRole,
    yourRole,
    seatsFull: !yourRole && takesSeat(invite.role) && (await seatsUsed(storage, invite.teamId)) >= team.seats,
    wrongEmail: invite.email && invite.email !== (email || '').toLowerCase() ? wrongEmail(invite.email) : null,
  }
}

// Adds userId to the invite's team in its role: { teamId, teamName, role }.
// Someone already in the team keeps the role they have.
async function acceptInvite(storage, token, userId, email) {
  return inTransaction(storage, async client => {
    const invite = await findInvite(client, token)
    if (!invite) throw new TeamError(404, GONE)
    const team = await lockTeam(client, invite.teamId)
    const current = await roleIn(client, team.id, userId)
    if (current) return { teamId: team.id, teamName: team.name, role: current }
    if (invite.email && invite.email !== (email || '').toLowerCase()) throw new TeamError(403, wrongEmail(invite.email))
    if (takesSeat(invite.role) && (await seatsUsed(client, team.id)) >= team.seats) {
      throw new TeamError(409, `Every seat in ${team.name} is taken. Ask its owner to add a seat.`)
    }
    await client.query('INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)', [team.id, userId, invite.role])
    return { teamId: team.id, teamName: team.name, role: invite.role }
  })
}

// --- Members ---

// actorId gives targetId another role (not owner: see transferOwnership)
async function changeRole(storage, teamId, actorId, targetId, role) {
  if (!INVITE_ROLES.includes(role)) throw new TeamError(400, 'A member can be an admin, member or viewer')
  return inTransaction(storage, async client => {
    const team = await lockTeam(client, teamId)
    const actorRole = await roleIn(client, teamId, actorId)
    if (!actorRole) throw new TeamError(404, 'Team not found')
    if (!isManager(actorRole)) throw new TeamError(403, 'Only the team\'s owner and admins can change roles')
    const current = await roleIn(client, teamId, targetId)
    if (!current) throw new TeamError(404, 'Not a member of this team')
    if (current === 'owner') throw new TeamError(403, 'The owner\'s role changes only when they hand the team over')
    if (current === role) return { role }
    if (!takesSeat(current) && takesSeat(role) && (await seatsUsed(client, teamId)) >= team.seats) {
      throw new TeamError(409, 'Every seat is taken. Add a seat first.')
    }
    await client.query('UPDATE team_members SET role = $3 WHERE team_id = $1 AND user_id = $2', [teamId, targetId, role])
    return { role }
  })
}

// actorId removes targetId, or leaves when they're the same person
async function removeMember(storage, teamId, actorId, targetId) {
  const actorRole = await roleIn(storage, teamId, actorId)
  if (!actorRole) throw new TeamError(404, 'Team not found')
  const leaving = actorId === targetId
  if (!leaving && !isManager(actorRole)) throw new TeamError(403, 'Only the team\'s owner and admins can remove people')
  const role = leaving ? actorRole : await roleIn(storage, teamId, targetId)
  if (!role) throw new TeamError(404, 'Not a member of this team')
  if (role === 'owner') {
    throw new TeamError(403, leaving ? 'Hand the team to an admin before you leave it' : 'The owner can\'t be removed')
  }
  await storage.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, targetId])
}

// The owner hands the team to one of its admins, and becomes an admin
async function transferOwnership(storage, teamId, ownerId, toId) {
  return inTransaction(storage, async client => {
    await lockTeam(client, teamId)
    const actorRole = await roleIn(client, teamId, ownerId)
    if (!actorRole) throw new TeamError(404, 'Team not found')
    if (actorRole !== 'owner') throw new TeamError(403, 'Only the owner can hand the team over')
    if (toId === ownerId) throw new TeamError(400, 'You already own this team')
    const toRole = await roleIn(client, teamId, toId)
    if (!toRole) throw new TeamError(404, 'Not a member of this team')
    if (toRole !== 'admin') throw new TeamError(400, 'Make them an admin first; only an admin can take the team over')
    // The old owner steps down first: one owner at a time (team_members_one_owner)
    await client.query(`UPDATE team_members SET role = 'admin' WHERE team_id = $1 AND user_id = $2`, [teamId, ownerId])
    await client.query(`UPDATE team_members SET role = 'owner' WHERE team_id = $1 AND user_id = $2`, [teamId, toId])
    await client.query('UPDATE teams SET owner_id = $2, updated_at = NOW() WHERE id = $1', [teamId, toId])
  })
}

// --- For admins of the site (/admin) ---

async function adminListTeams(storage) {
  const { rows } = await storage.query(
    `SELECT t.id, t.name, t.plan, t.seats, t.status, t.created_at AS "createdAt",
            t.stripe_subscription_id IS NOT NULL AS "hasSubscription",
            u.email AS "ownerEmail", COALESCE(NULLIF(u.name, ''), u.email) AS "ownerName",
            (SELECT COUNT(*)::int FROM team_members x WHERE x.team_id = t.id) AS "memberCount",
            (SELECT COUNT(*)::int FROM team_members x WHERE x.team_id = t.id AND x.role = ANY($1)) AS "seatsUsed"
       FROM teams t LEFT JOIN users u ON u.id = t.owner_id
      ORDER BY t.created_at DESC`,
    [SEAT_ROLES]
  )
  return rows
}

// A team owned by the account with this email address. { name, ownerEmail,
// seats, plan }; `plans` lists the plan ids an account can be put on.
async function adminCreateTeam(storage, { name, ownerEmail, seats, plan = 'team' }, plans) {
  const teamName = cleanName(name)
  const n = cleanSeats(seats ?? 3)
  if (!plans.includes(plan)) throw new TeamError(400, 'Unknown plan')
  const email = cleanEmail(ownerEmail)
  if (!email) throw new TeamError(400, 'Give the owner\'s email address')
  return inTransaction(storage, async client => {
    const { rows: owners } = await client.query(
      `SELECT id FROM users WHERE lower(email) = $1 AND plan <> 'guest' ORDER BY created_at LIMIT 1`,
      [email]
    )
    if (!owners.length) throw new TeamError(404, 'No account has that email address; they need to sign in once first')
    const ownerId = owners[0].id
    const { rows: [team] } = await client.query(
      'INSERT INTO teams (name, owner_id, plan, seats) VALUES ($1, $2, $3, $4) RETURNING id, name, plan, seats, status',
      [teamName, ownerId, plan, n]
    )
    await client.query(`INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')`, [team.id, ownerId])
    return team
  })
}

// Changes a team's seats, plan or status: { seats?, plan?, status? }
async function adminUpdateTeam(storage, teamId, { seats, plan, status }, plans) {
  return inTransaction(storage, async client => {
    const team = await lockTeam(client, teamId)
    const next = { seats: team.seats, plan: undefined, status: team.status }
    if (seats !== undefined) {
      next.seats = cleanSeats(seats)
      const used = await seatsUsed(client, teamId)
      if (next.seats < used) throw new TeamError(400, `${used} seats are in use; remove people or make them viewers first`)
    }
    if (plan !== undefined && !plans.includes(plan)) throw new TeamError(400, 'Unknown plan')
    if (status !== undefined) {
      if (!STATUSES.includes(status)) throw new TeamError(400, 'Status is active, past_due or lapsed')
      next.status = status
    }
    const { rows } = await client.query(
      `UPDATE teams SET seats = $2, plan = COALESCE($3, plan), status = $4, updated_at = NOW()
        WHERE id = $1 RETURNING id, name, plan, seats, status`,
      [teamId, next.seats, plan ?? null, next.status]
    )
    return rows[0]
  })
}

// --- Paid through Stripe (services/stripe.js) ---

// A team bought at checkout, with its owner as its first member. Stripe may
// send the same event twice: a subscription that already has a team gets
// that team back. Returns { id, created }.
async function createPaidTeam(storage, { name, ownerId, plan, seats, status, customerId, subscriptionId }) {
  return inTransaction(storage, async client => {
    const { rows: existing } = await client.query('SELECT id FROM teams WHERE stripe_subscription_id = $1', [subscriptionId])
    if (existing.length) return { id: existing[0].id, created: false }
    const { rows: [team] } = await client.query(
      `INSERT INTO teams (name, owner_id, plan, seats, status, stripe_customer_id, stripe_subscription_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [cleanName(name || 'My team'), ownerId, plan, cleanSeats(seats), status, customerId, subscriptionId]
    )
    await client.query(`INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')`, [team.id, ownerId])
    return { id: team.id, created: true }
  })
}

// Records what a team's subscription says: { subscriptionId (null once it's
// gone), customerId?, seats?, plan?, status }. Finds the team by its id or
// by the subscription. Returns { id, statusBefore }, or null for no team.
async function setTeamSubscription(storage, { teamId = null, subscriptionId, customerId, seats, plan, status }) {
  // The team the subscription names is the one, whatever else has had it
  const { rows } = teamId
    ? await storage.query('SELECT id, status FROM teams WHERE id = $1', [teamId])
    : subscriptionId
      ? await storage.query('SELECT id, status FROM teams WHERE stripe_subscription_id = $1', [subscriptionId])
      : { rows: [] }
  if (!rows.length) return null
  await storage.query(
    `UPDATE teams SET stripe_subscription_id = $2, stripe_customer_id = COALESCE($3, stripe_customer_id),
            seats = COALESCE($4, seats), plan = COALESCE($5, plan), status = $6, updated_at = NOW()
      WHERE id = $1`,
    [rows[0].id, subscriptionId, customerId ?? null, seats ? cleanSeats(seats) : null, plan ?? null, status]
  )
  return { id: rows[0].id, statusBefore: rows[0].status }
}

// The team as its owner pays for it: { id, name, seats, seatsUsed, plan,
// status, customerId, subscriptionId }, after checking userId owns it
async function billingOf(storage, teamId, userId) {
  const role = await roleIn(storage, teamId, userId)
  if (!role) throw new TeamError(404, 'Team not found')
  if (role !== 'owner') throw new TeamError(403, 'Only the team\'s owner can change its billing')
  const { rows: [t] } = await storage.query(
    'SELECT id, name, seats, plan, status, stripe_customer_id, stripe_subscription_id FROM teams WHERE id = $1', [teamId]
  )
  return {
    id: t.id, name: t.name, seats: t.seats, plan: t.plan, status: t.status,
    seatsUsed: await seatsUsed(storage, teamId),
    customerId: t.stripe_customer_id, subscriptionId: t.stripe_subscription_id,
  }
}

async function setSeats(storage, teamId, seats) {
  await storage.query('UPDATE teams SET seats = $2, updated_at = NOW() WHERE id = $1', [teamId, cleanSeats(seats)])
}

async function adminDeleteTeam(storage, teamId) {
  const { rows } = await storage.query('SELECT COUNT(*)::int AS n FROM presentations WHERE team_id = $1', [teamId])
  if (rows[0].n) throw new TeamError(409, 'This team still has presentations')
  const { rowCount } = await storage.query('DELETE FROM teams WHERE id = $1', [teamId])
  if (!rowCount) throw new TeamError(404, 'Team not found')
}

module.exports = {
  ROLES, INVITE_ROLES, SEAT_ROLES, TOKEN_PATTERN, MAX_SEATS, TeamError,
  isManager, takesSeat, roleIn, cleanName, cleanSeats,
  createPaidTeam, setTeamSubscription, billingOf, setSeats,
  listTeams, getTeam, renameTeam,
  createInvite, revokeInvite, findInvite, recentEmailInvites, describeInvite, acceptInvite,
  changeRole, removeMember, transferOwnership,
  adminListTeams, adminCreateTeam, adminUpdateTeam, adminDeleteTeam,
}

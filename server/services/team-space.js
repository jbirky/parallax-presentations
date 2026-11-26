// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A team's decks and folders (phase 2 of the team subscriptions plan). A team
// deck belongs to the team: user_id stays whoever made it, team_id says whose
// it is, and folder_id where it's filed. Every member sees every folder.
//
// Folders: owners, admins and members make and rename them; owners and
// admins delete them, which leaves their decks at the team's top level.
// Moving a deck: its owner moves a personal deck into a team they're in (not
// as a viewer); a team deck's owners (the team's owner and admins, and its
// maker) file it in another folder, move it to another team, or take it into
// their own space. Each move checks there's room where it goes.

const { TeamError, roleIn } = require('./teams')
const { presentationAccess, teamDeckRole } = require('./collaboration')
const { storageUsedBytes, teamStorageUsedBytes, teamStorageBytes } = require('../middleware/upload-quota')
const { planFor } = require('./plans')

const FOLDER_NAME_MAX = 60
const MAX_FOLDERS = 200 // per team
const FOLDER_MAKERS = ['owner', 'admin', 'member']
const FOLDER_REMOVERS = ['owner', 'admin']

function formatSize(bytes) {
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 1 ? `${Math.round(gb * 10) / 10} GB` : `${Math.round(bytes / (1024 * 1024))} MB`
}

function cleanFolderName(name) {
  const s = String(name ?? '').replace(/\s+/g, ' ').trim()
  if (!s) throw new TeamError(400, 'Give the folder a name')
  if (s.length > FOLDER_NAME_MAX) throw new TeamError(400, `A folder's name can be at most ${FOLDER_NAME_MAX} characters`)
  return s
}

async function teamRow(storage, teamId) {
  const { rows } = await storage.query('SELECT id, name, plan, seats, status FROM teams WHERE id = $1', [teamId])
  return rows[0] || null
}

// The team and userId's role in it, or a 404 for anyone not in it
async function memberOf(storage, teamId, userId) {
  const role = await roleIn(storage, teamId, userId)
  const team = role && await teamRow(storage, teamId)
  if (!team) throw new TeamError(404, 'Team not found')
  return { team, role }
}

const LAPSED = 'This team’s subscription has ended, so its presentations can be viewed but not changed.'

// For a change to the team's decks or folders: active teams, and roles in `allowed`
function mayChange({ team, role }, allowed, refusal) {
  if (team.status === 'lapsed') throw new TeamError(403, LAPSED)
  if (!allowed.includes(role)) throw new TeamError(403, refusal)
}

const uniqueName = err => {
  if (err.code === '23505') throw new TeamError(409, 'There\'s already a folder with that name here')
  throw err
}

// Its storage: { used, limit } in bytes; limit is null when the plan has none
async function teamStorage(storage, team) {
  const limit = teamStorageBytes(planFor(team.plan), team.seats)
  return { used: await teamStorageUsedBytes(storage, team.id), limit: limit === Infinity ? null : limit }
}

// The team's space as userId sees it: { team, folders, presentations,
// storage }. Each presentation has the caller's role on it (teamDeckRole).
async function listTeamSpace(storage, teamId, userId) {
  const { team, role } = await memberOf(storage, teamId, userId)
  const { rows: folders } = await storage.query(
    `SELECT id, name, parent_id AS "parentId", created_by AS "createdBy", created_at AS "createdAt"
       FROM folders WHERE team_id = $1 ORDER BY lower(name)`,
    [teamId]
  )
  const { rows } = await storage.query(
    `SELECT p.id, p.title,
            p.data->>'theme' AS theme,
            p.data->>'transition' AS transition,
            jsonb_array_length(COALESCE(p.data->'slides', '[]'::jsonb)) AS "slideCount",
            p.updated_at AS "updatedAt", p.created_at AS "createdAt",
            p.data->'slides'->0->'background' AS thumbnail,
            p.folder_id AS "folderId", p.user_id AS "creatorId",
            COALESCE(NULLIF(u.name, ''), u.email) AS "creatorName"
       FROM presentations p LEFT JOIN users u ON u.id = p.user_id
      WHERE p.team_id = $1 AND p.is_template = false
      ORDER BY p.updated_at DESC`,
    [teamId]
  )
  const lapsed = team.status === 'lapsed'
  const presentations = rows.map(r => ({
    ...r,
    slideCount: parseInt(r.slideCount) || 0,
    thumbnail: r.thumbnail || null,
    teamId,
    role: lapsed ? 'viewer' : teamDeckRole(role, r.creatorId === userId),
  }))
  return {
    team: { id: team.id, name: team.name, status: team.status, role, canCreate: !lapsed && FOLDER_MAKERS.includes(role) },
    folders,
    presentations,
    storage: await teamStorage(storage, team),
  }
}

async function folderIn(storage, teamId, folderId) {
  const { rows } = await storage.query('SELECT id, name, parent_id AS "parentId" FROM folders WHERE id = $1 AND team_id = $2', [folderId, teamId])
  if (!rows.length) throw new TeamError(404, 'No such folder in this team')
  return rows[0]
}

async function createFolder(storage, teamId, userId, { name, parentId = null } = {}) {
  const member = await memberOf(storage, teamId, userId)
  mayChange(member, FOLDER_MAKERS, 'Viewers can\'t make folders')
  const folderName = cleanFolderName(name)
  if (parentId) await folderIn(storage, teamId, parentId)
  const { rows: [{ n }] } = await storage.query('SELECT COUNT(*)::int AS n FROM folders WHERE team_id = $1', [teamId])
  if (n >= MAX_FOLDERS) throw new TeamError(400, `A team can have at most ${MAX_FOLDERS} folders`)
  const { rows } = await storage.query(
    `INSERT INTO folders (team_id, parent_id, name, created_by) VALUES ($1, $2, $3, $4)
     RETURNING id, name, parent_id AS "parentId", created_by AS "createdBy", created_at AS "createdAt"`,
    [teamId, parentId, folderName, userId]
  ).catch(uniqueName)
  return rows[0]
}

async function renameFolder(storage, teamId, userId, folderId, name) {
  const member = await memberOf(storage, teamId, userId)
  mayChange(member, FOLDER_MAKERS, 'Viewers can\'t rename folders')
  await folderIn(storage, teamId, folderId)
  const { rows } = await storage.query(
    `UPDATE folders SET name = $3, updated_at = NOW() WHERE id = $1 AND team_id = $2
     RETURNING id, name, parent_id AS "parentId"`,
    [folderId, teamId, cleanFolderName(name)]
  ).catch(uniqueName)
  return rows[0]
}

// Its decks move to the team's top level (the foreign key does it)
async function deleteFolder(storage, teamId, userId, folderId) {
  const member = await memberOf(storage, teamId, userId)
  mayChange(member, FOLDER_REMOVERS, 'Only the team\'s owner and admins can delete folders')
  await folderIn(storage, teamId, folderId)
  await storage.query('DELETE FROM folders WHERE id = $1 AND team_id = $2', [folderId, teamId])
}

// Where userId may put a new deck: { teamId, folderId } after checking
// they're an owner, admin or member of the team and the folder is its
async function deckTarget(storage, userId, teamId, folderId = null) {
  const member = await memberOf(storage, teamId, userId)
  mayChange(member, FOLDER_MAKERS, 'Viewers can\'t add presentations to the team')
  if (folderId) await folderIn(storage, teamId, folderId)
  return { teamId, folderId: folderId || null }
}

// Bytes a deck's files take, each once
async function deckBytes(storage, deckId) {
  const { rows } = await storage.query(
    `SELECT COALESCE(SUM(size_bytes), 0) AS bytes FROM (
       SELECT DISTINCT ON (storage_key) size_bytes FROM uploads WHERE presentation_id = $1) files`,
    [deckId]
  )
  return Number(rows[0].bytes)
}

// Moves a deck: { teamId, folderId } says where, teamId null for userId's own
// space. userPlan is userId's plan, for a deck taken into their space.
// Returns { teamId, folderId, ownerChanged }.
async function moveDeck(storage, deckId, userId, userPlan, { teamId = null, folderId = null } = {}) {
  if (folderId && !teamId) throw new TeamError(400, 'A folder is in a team')
  const access = await presentationAccess(storage, deckId, userId)
  if (!access) throw new TeamError(404, 'Not found')
  if (access.lapsed) throw new TeamError(403, LAPSED)
  if (access.role !== 'owner') {
    throw new TeamError(403, access.teamId
      ? 'Only the team\'s owner and admins, and whoever made it, can move this presentation'
      : 'Only its owner can move this presentation')
  }
  if (!access.teamId && !teamId) return { teamId: null, folderId: null, ownerChanged: false }

  // Into a team, or within one
  if (teamId) {
    await deckTarget(storage, userId, teamId, folderId)
    if (access.teamId !== teamId) {
      const team = await teamRow(storage, teamId)
      const { used, limit } = await teamStorage(storage, team)
      const bytes = await deckBytes(storage, deckId)
      if (limit !== null && used + bytes > limit) {
        throw new TeamError(413, `${team.name} doesn't have room for its files (${formatSize(bytes)}; ${formatSize(Math.max(0, limit - used))} free).`)
      }
    }
    await storage.query(
      'UPDATE presentations SET team_id = $2, folder_id = $3, expires_at = NULL WHERE id = $1',
      [deckId, teamId, folderId || null]
    )
    return { teamId, folderId: folderId || null, ownerChanged: false }
  }

  // Out of a team, into userId's own space: it becomes theirs, under their plan
  const plan = planFor(userPlan)
  if (plan.maxPresentations !== Infinity) {
    const { rows: [{ n }] } = await storage.query(
      `SELECT COUNT(*)::int AS n FROM presentations
        WHERE user_id = $1 AND team_id IS NULL AND is_template = false AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId]
    )
    if (n >= plan.maxPresentations) throw new TeamError(403, `The ${plan.name} plan is limited to ${plan.maxPresentations} presentations.`)
  }
  if (plan.storageBytes) {
    const bytes = await deckBytes(storage, deckId)
    const used = await storageUsedBytes(storage, userId)
    if (used + bytes > plan.storageBytes) {
      throw new TeamError(413, `Your storage doesn't have room for its files (${formatSize(bytes)}; ${formatSize(Math.max(0, plan.storageBytes - used))} free on the ${plan.name} plan).`)
    }
  }
  await storage.query(
    `UPDATE presentations SET team_id = NULL, folder_id = NULL, user_id = $2,
            expires_at = CASE WHEN $3::int IS NULL THEN NULL ELSE NOW() + make_interval(days => $3::int) END
      WHERE id = $1`,
    [deckId, userId, plan.expirationDays || null]
  )
  // Its files now count against them
  await storage.query('UPDATE uploads SET user_id = $2 WHERE presentation_id = $1', [deckId, userId])
  return { teamId: null, folderId: null, ownerChanged: access.ownerId !== userId }
}

// The team's deck ids, for closing live-editing connections
async function teamDeckIds(storage, teamId) {
  const { rows } = await storage.query('SELECT id FROM presentations WHERE team_id = $1', [teamId])
  return rows.map(r => r.id)
}

// Revokes the AI collaborator links userId made on the team's decks (when
// they leave it); returns the links' ids
async function revokeTeamLinks(storage, teamId, userId) {
  const { rows } = await storage.query(
    `UPDATE ai_links SET revoked_at = NOW()
      WHERE created_by = $2 AND revoked_at IS NULL
        AND presentation_id IN (SELECT id FROM presentations WHERE team_id = $1)
      RETURNING id`,
    [teamId, userId]
  )
  return rows.map(r => r.id)
}

module.exports = {
  listTeamSpace, createFolder, renameFolder, deleteFolder,
  deckTarget, moveDeck, teamDeckIds, revokeTeamLinks,
}

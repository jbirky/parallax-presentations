// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A team's decks and folders (phase 2 of the team subscriptions plan), and
// moving decks between people's own folders and teams. A team deck belongs to
// the team: user_id stays whoever made it, team_id says whose it is, and
// folder_id where it's filed. Every member sees every folder.
//
// Folders (services/folders.js): owners, admins and members make, rename and
// move them; owners and admins delete them, which moves what's in them up
// into their parent.
// Moving a deck: its owner files a personal deck in their own folders, or
// moves it into a team they're in (not as a viewer); a team deck's owners
// (the team's owner and admins, and its maker) file it in another folder,
// move it to another team, or take it into their own presentations. Each
// move checks there's room where it goes.

const { TeamError, roleIn } = require('./teams')
const { presentationAccess, teamDeckRole } = require('./collaboration')
const { storageUsedBytes, teamStorageUsedBytes, teamStorageBytes } = require('../middleware/upload-quota')
const { planFor } = require('./plans')
const folders = require('./folders')
const { tileColumns, tileRow } = require('../storage/deck-tile')
const teamLibrary = require('./team-library')

const FOLDER_MAKERS = ['owner', 'admin', 'member']
const FOLDER_REMOVERS = ['owner', 'admin']

function formatSize(bytes) {
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 1 ? `${Math.round(gb * 10) / 10} GB` : `${Math.round(bytes / (1024 * 1024))} MB`
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

// Its storage: { used, limit } in bytes; limit is null when the plan has none
async function teamStorage(storage, team) {
  const limit = teamStorageBytes(planFor(team.plan), team.seats)
  return { used: await teamStorageUsedBytes(storage, team.id), limit: limit === Infinity ? null : limit }
}

// The team's space as userId sees it: { team, folders, presentations,
// storage }. Each presentation has the caller's role on it (teamDeckRole).
async function listTeamSpace(storage, teamId, userId) {
  const { team, role } = await memberOf(storage, teamId, userId)
  const { rows } = await storage.query(
    `SELECT p.id, p.title,
            p.data->>'theme' AS theme,
            p.data->>'transition' AS transition,
            jsonb_array_length(COALESCE(p.data->'slides', '[]'::jsonb)) AS "slideCount",
            p.updated_at AS "updatedAt", p.created_at AS "createdAt",
            p.data->'slides'->0->'background' AS thumbnail,
            ${tileColumns('p')},
            p.folder_id AS "folderId", p.user_id AS "creatorId",
            COALESCE(NULLIF(u.name, ''), u.email) AS "creatorName"
       FROM presentations p LEFT JOIN users u ON u.id = p.user_id
      WHERE p.team_id = $1 AND p.is_template = false
      ORDER BY p.updated_at DESC`,
    [teamId]
  )
  const lapsed = team.status === 'lapsed'
  const presentations = rows.map(r => tileRow({
    ...r,
    slideCount: parseInt(r.slideCount) || 0,
    thumbnail: r.thumbnail || null,
    teamId,
    role: lapsed ? 'viewer' : teamDeckRole(role, r.creatorId === userId),
  }))
  return {
    team: { id: team.id, name: team.name, status: team.status, role, canCreate: !lapsed && FOLDER_MAKERS.includes(role) },
    folders: await folders.listFolders(storage, { teamId }),
    presentations,
    storage: await teamStorage(storage, team),
  }
}

async function createFolder(storage, teamId, userId, { name, parentId = null } = {}) {
  mayChange(await memberOf(storage, teamId, userId), FOLDER_MAKERS, 'Viewers can\'t make folders')
  return folders.createFolder(storage, { teamId }, { name, parentId, createdBy: userId })
}

// Renames it ({ name }) or moves it ({ parentId }), or both
async function updateFolder(storage, teamId, userId, folderId, { name, parentId } = {}) {
  mayChange(await memberOf(storage, teamId, userId), FOLDER_MAKERS, 'Viewers can\'t change folders')
  return folders.updateFolder(storage, { teamId }, folderId, { name, parentId })
}

// What's in it moves up into its parent
async function deleteFolder(storage, teamId, userId, folderId) {
  mayChange(await memberOf(storage, teamId, userId), FOLDER_REMOVERS, 'Only the team\'s owner and admins can delete folders')
  await folders.deleteFolder(storage, { teamId }, folderId)
}

// Where userId may put a new deck: { teamId, folderId } after checking
// they're an owner, admin or member of the team and the folder is its
async function deckTarget(storage, userId, teamId, folderId = null) {
  mayChange(await memberOf(storage, teamId, userId), FOLDER_MAKERS, 'Viewers can\'t add presentations to the team')
  if (folderId) await folders.getFolder(storage, { teamId }, folderId)
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
// presentations (folderId then one of their folders). userPlan is userId's
// plan, for a deck taken into their own. Returns { teamId, folderId,
// ownerChanged, sameSpace }: sameSpace when it only changed folders, so who
// can open it is as it was.
async function moveDeck(storage, deckId, userId, userPlan, { teamId = null, folderId = null } = {}) {
  const access = await presentationAccess(storage, deckId, userId)
  if (!access) throw new TeamError(404, 'Not found')
  if (access.lapsed) throw new TeamError(403, LAPSED)
  if (access.role !== 'owner') {
    throw new TeamError(403, access.teamId
      ? 'Only the team\'s owner and admins, and whoever made it, can move this presentation'
      : 'Only its owner can move this presentation')
  }
  const own = { userId }

  // Within their own presentations: another folder
  if (!access.teamId && !teamId) {
    await folders.placeDeck(storage, own, deckId, folderId)
    return { teamId: null, folderId: folderId || null, ownerChanged: false, sameSpace: true }
  }

  // Into a team, or within one. The datasets its maker made for it go into
  // the team with it (they're counted against the team from then on).
  if (teamId) {
    await deckTarget(storage, userId, teamId, folderId)
    let carried = { ids: [] }
    if (access.teamId !== teamId) {
      const team = await teamRow(storage, teamId)
      const { used, limit } = await teamStorage(storage, team)
      carried = await teamLibrary.ownDatasetsOfDeck(storage, deckId, access.ownerId)
      const bytes = await deckBytes(storage, deckId) + carried.bytes
      if (limit !== null && used + bytes > limit) {
        throw new TeamError(413, `${team.name} doesn't have room for its files and data (${formatSize(bytes)}; ${formatSize(Math.max(0, limit - used))} free).`)
      }
      if (carried.live) await teamLibrary.checkTeamRoom(storage, team, { live: carried.live })
    }
    await storage.query(
      'UPDATE presentations SET team_id = $2, folder_id = $3, expires_at = NULL WHERE id = $1',
      [deckId, teamId, folderId || null]
    )
    for (const id of carried.ids) await storage.setDatasetTeam(id, teamId)
    const datasetsLeft = access.teamId && access.teamId !== teamId ? await leaveTeamDatasets(storage, deckId, access.teamId) : 0
    return { teamId, folderId: folderId || null, ownerChanged: false, sameSpace: access.teamId === teamId, datasetsMoved: carried.ids.length, datasetsLeft }
  }

  // Out of a team, into userId's own presentations: it becomes theirs, under their plan
  if (folderId) await folders.getFolder(storage, own, folderId)
  // (Past their plan's limit, their oldest presentations become read-only:
  // services/deck-locks.js.)
  const plan = planFor(userPlan)
  if (plan.storageBytes) {
    const bytes = await deckBytes(storage, deckId)
    const used = await storageUsedBytes(storage, userId)
    if (used + bytes > plan.storageBytes) {
      throw new TeamError(413, `Your storage doesn't have room for its files (${formatSize(bytes)}; ${formatSize(Math.max(0, plan.storageBytes - used))} free on the ${plan.name} plan).`)
    }
  }
  await storage.query(
    'UPDATE presentations SET team_id = NULL, folder_id = $3, user_id = $2 WHERE id = $1',
    [deckId, userId, folderId || null]
  )
  // Its files now count against them
  await storage.query('UPDATE uploads SET user_id = $2 WHERE presentation_id = $1', [deckId, userId])
  const datasetsLeft = await leaveTeamDatasets(storage, deckId, access.teamId)
  return { teamId: null, folderId: folderId || null, ownerChanged: access.ownerId !== userId, sameSpace: false, datasetsLeft }
}

// A deck leaving a team leaves the team's datasets behind: they're the
// team's, and its other presentations may read them. Returns how many.
async function leaveTeamDatasets(storage, deckId, teamId) {
  const { rowCount } = await storage.query(
    `DELETE FROM presentation_datasets
      WHERE presentation_id = $1 AND dataset_id IN (SELECT id FROM datasets WHERE team_id = $2)`,
    [deckId, teamId]
  )
  return rowCount
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
  listTeamSpace, createFolder, updateFolder, deleteFolder,
  deckTarget, moveDeck, teamDeckIds, revokeTeamLinks,
}

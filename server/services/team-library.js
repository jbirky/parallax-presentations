// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A team's library (phase 4 of the team subscriptions plan): themes, fonts,
// datasets and templates that belong to the team rather than to whoever added
// them (migration 031). Its members use them in the team's presentations, and
// they stay with the team when that person leaves.
//
// Who can do what: the owner, admins and members add to it; the owner and
// admins change or remove anything in it, and members what they added.
// Viewers use what's there. Once a team's subscription lapses, nothing in it
// changes.

const { TeamError, roleIn } = require('./teams')
const { planFor } = require('./plans')
const { teamStorageUsedBytes, teamStorageBytes } = require('../middleware/upload-quota')

const ADDERS = ['owner', 'admin', 'member']
const MAX_TEAM_THEMES = 100
const MAX_TEAM_FONTS = 100
const MAX_TEAM_TEMPLATES = 50

function formatSize(bytes) {
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 1 ? `${Math.round(gb * 10) / 10} GB` : `${Math.round(bytes / (1024 * 1024))} MB`
}

// userId's role in the team and the team: { role, team }, or a 404
async function membership(storage, teamId, userId) {
  const role = await roleIn(storage, teamId, userId)
  const { rows } = role ? await storage.query('SELECT id, name, plan, seats, status FROM teams WHERE id = $1', [teamId]) : { rows: [] }
  if (!rows.length) throw new TeamError(404, 'Team not found')
  return { role, team: rows[0] }
}

const LAPSED = 'This team’s subscription has ended, so its library can be used but not changed.'

async function mayAdd(storage, teamId, userId) {
  const m = await membership(storage, teamId, userId)
  if (m.team.status === 'lapsed') throw new TeamError(403, LAPSED)
  if (!ADDERS.includes(m.role)) throw new TeamError(403, 'Viewers can’t add to the team’s library')
  return m
}

// For changing or removing something in the library that `creatorId` added
async function mayChange(storage, teamId, userId, creatorId) {
  const m = await membership(storage, teamId, userId)
  if (m.team.status === 'lapsed') throw new TeamError(403, LAPSED)
  if (m.role === 'owner' || m.role === 'admin' || (m.role === 'member' && creatorId === userId)) return m
  throw new TeamError(403, 'Only the team’s owner and admins, and whoever added it, can change this')
}

// --- Themes ---

const themeOf = r => ({
  ...r.doc, id: r.id, name: r.name, version: r.version, createdAt: r.created_at, updatedAt: r.updated_at,
  teamId: r.team_id, createdBy: r.user_id, creatorName: r.creator_name || null,
})

async function listThemes(storage, teamId, userId) {
  await membership(storage, teamId, userId)
  const { rows } = await storage.query(
    `SELECT t.*, COALESCE(NULLIF(u.name, ''), u.email) AS creator_name
       FROM themes t LEFT JOIN users u ON u.id = t.user_id
      WHERE t.team_id = $1 ORDER BY lower(t.name), t.created_at`,
    [teamId]
  )
  return rows.map(themeOf)
}

async function teamThemeRow(storage, teamId, themeId) {
  const { rows } = await storage.query('SELECT * FROM themes WHERE id = $1 AND team_id = $2', [themeId, teamId])
  if (!rows.length) throw new TeamError(404, 'Theme not found')
  return rows[0]
}

// doc: a theme document, checked already (cleanThemeDoc)
async function createTheme(storage, teamId, userId, doc) {
  await mayAdd(storage, teamId, userId)
  const { rows: [{ n }] } = await storage.query('SELECT COUNT(*)::int AS n FROM themes WHERE team_id = $1', [teamId])
  if (n >= MAX_TEAM_THEMES) throw new TeamError(400, `A team can keep up to ${MAX_TEAM_THEMES} themes. Delete one to save another.`)
  const { rows } = await storage.query(
    'INSERT INTO themes (user_id, team_id, name, doc) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, teamId, doc.name, doc]
  )
  return themeOf(rows[0])
}

async function updateTheme(storage, teamId, userId, themeId, doc) {
  const row = await teamThemeRow(storage, teamId, themeId)
  await mayChange(storage, teamId, userId, row.user_id)
  const { rows } = await storage.query(
    'UPDATE themes SET name = $3, doc = $4, version = version + 1, updated_at = NOW() WHERE id = $1 AND team_id = $2 RETURNING *',
    [themeId, teamId, doc.name, doc]
  )
  return themeOf(rows[0])
}

async function deleteTheme(storage, teamId, userId, themeId) {
  const row = await teamThemeRow(storage, teamId, themeId)
  await mayChange(storage, teamId, userId, row.user_id)
  await storage.query('DELETE FROM themes WHERE id = $1 AND team_id = $2', [themeId, teamId])
}

// --- Fonts ---
// A Google font by name, or one of the person's own fonts shared with the
// team (the same file: removing the team's copy leaves the file alone)

const fontOf = r => ({
  id: r.id, familyName: r.family_name, source: r.source, url: r.url, createdAt: r.created_at,
  teamId: r.team_id, createdBy: r.user_id, creatorName: r.creator_name || null,
})

async function listFonts(storage, teamId, userId) {
  await membership(storage, teamId, userId)
  const { rows } = await storage.query(
    `SELECT f.*, COALESCE(NULLIF(u.name, ''), u.email) AS creator_name
       FROM user_fonts f LEFT JOIN users u ON u.id = f.user_id
      WHERE f.team_id = $1 ORDER BY f.family_name`,
    [teamId]
  )
  return rows.map(fontOf)
}

// { familyName } for a Google font, or { fontId } for one of userId's own
async function addFont(storage, teamId, userId, { familyName, fontId } = {}) {
  await mayAdd(storage, teamId, userId)
  const { rows: [{ n }] } = await storage.query('SELECT COUNT(*)::int AS n FROM user_fonts WHERE team_id = $1', [teamId])
  if (n >= MAX_TEAM_FONTS) throw new TeamError(400, `A team can keep up to ${MAX_TEAM_FONTS} fonts.`)
  let font
  if (fontId) {
    const { rows } = await storage.query('SELECT family_name, source, url FROM user_fonts WHERE id = $1 AND user_id = $2 AND team_id IS NULL', [fontId, userId])
    if (!rows.length) throw new TeamError(404, 'Font not found')
    font = rows[0]
  } else {
    const name = String(familyName || '').trim()
    if (!name || name.length > 80) throw new TeamError(400, 'Give the font’s family name')
    font = {
      family_name: name, source: 'google',
      url: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@100;200;300;400;500;600;700;800;900&display=swap`,
    }
  }
  const { rows: same } = await storage.query('SELECT 1 FROM user_fonts WHERE team_id = $1 AND lower(family_name) = lower($2)', [teamId, font.family_name])
  if (same.length) throw new TeamError(409, `The team already has ${font.family_name}`)
  const { rows } = await storage.query(
    'INSERT INTO user_fonts (user_id, team_id, family_name, source, url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [userId, teamId, font.family_name, font.source, font.url]
  )
  return fontOf(rows[0])
}

async function deleteFont(storage, teamId, userId, fontId) {
  const { rows } = await storage.query('SELECT user_id FROM user_fonts WHERE id = $1 AND team_id = $2', [fontId, teamId])
  if (!rows.length) throw new TeamError(404, 'Font not found')
  await mayChange(storage, teamId, userId, rows[0].user_id)
  await storage.query('DELETE FROM user_fonts WHERE id = $1 AND team_id = $2', [fontId, teamId])
}

// Whether any other font row still uses `url`, so its file is kept
async function fontFileShared(storage, url) {
  const { rows } = await storage.query('SELECT 1 FROM user_fonts WHERE url = $1 LIMIT 1', [url])
  return rows.length > 0
}

// --- Datasets ---

// A dataset as userId may use it: { ds, ownerId }, ownerId being whose it is
// (its maker; storage calls are made as them), or null when they can't see
// it. Their own, or a team's they're in; `change` asks to change it too.
async function datasetFor(storage, id, userId, { change = false } = {}) {
  let ds = await storage.getDataset(id, userId)
  let ownerId = userId
  let teamId = ds?.teamId || null
  if (!ds) {
    if (!storage.query) return null
    const { rows } = await storage.query('SELECT user_id, team_id FROM datasets WHERE id = $1 AND team_id IS NOT NULL', [id])
    if (!rows.length) return null
    ownerId = rows[0].user_id
    teamId = rows[0].team_id
  }
  if (teamId) {
    // A team's dataset is its members', not its maker's once they've left
    if (!(await roleIn(storage, teamId, userId))) return null
    if (change) await mayChange(storage, teamId, userId, ownerId)
    if (!ds) ds = await storage.getDataset(id, ownerId)
  }
  return ds ? { ds, ownerId } : null
}

// A deck's dataset: its owner's own, or, for a team's deck, the team's.
// `deck` is req.deck (services/collaboration.js).
async function deckDataset(storage, id, deck) {
  const own = await storage.getDataset(id, deck.ownerId)
  // One its maker gave a team is theirs to use while they're in it
  if (own && (!own.teamId || own.teamId === deck.teamId || await roleIn(storage, own.teamId, deck.ownerId))) {
    return { ds: own, ownerId: deck.ownerId }
  }
  if (!deck.teamId || !storage.query) return null
  const { rows } = await storage.query('SELECT user_id FROM datasets WHERE id = $1 AND team_id = $2', [id, deck.teamId])
  if (!rows.length) return null
  return { ds: await storage.getDataset(id, rows[0].user_id), ownerId: rows[0].user_id }
}

async function listDatasets(storage, teamId, userId) {
  await membership(storage, teamId, userId)
  return storage.listTeamDatasets(teamId)
}

// Checks the team has room for datasets taking `bytes`, `live` of them live
async function checkTeamRoom(storage, team, { bytes = 0, live = 0 } = {}) {
  const plan = planFor(team.plan)
  const limit = teamStorageBytes(plan, team.seats)
  const used = await teamStorageUsedBytes(storage, team.id)
  if (limit !== Infinity && used + bytes > limit) {
    throw new TeamError(413, `${team.name} doesn't have room for it (${formatSize(bytes)}; ${formatSize(Math.max(0, limit - used))} free).`)
  }
  if (live && plan.liveDatasets !== undefined && (await storage.countTeamLiveDatasets(team.id)) + live > plan.liveDatasets) {
    throw new TeamError(403, `${team.name} can have up to ${plan.liveDatasets} live datasets on the ${plan.name} plan.`)
  }
}

// Gives one of userId's own datasets to a team they add to. They keep using
// it; it counts against the team from now on.
async function shareDataset(storage, id, userId, teamId) {
  const ds = await storage.getDataset(id, userId)
  if (!ds) throw new TeamError(404, 'Dataset not found')
  if (ds.teamId) throw new TeamError(409, ds.teamId === teamId ? 'The team has this dataset already' : 'This dataset is another team’s')
  const { team } = await mayAdd(storage, teamId, userId)
  await checkTeamRoom(storage, team, { bytes: await storage.datasetBytes(id), live: ds.sourceKind && ds.sourceKind !== 'upload' ? 1 : 0 })
  await storage.setDatasetTeam(id, teamId)
  return storage.getDataset(id, userId)
}

// The datasets a deck uses that its owner made and kept to themselves, for
// moving into a team with the deck: [{ id, live }], with the bytes they take
async function ownDatasetsOfDeck(storage, deckId, ownerId) {
  const { rows } = await storage.query(
    `SELECT d.id, d.source_kind,
            (SELECT COALESCE(SUM(v.byte_size), 0) FROM dataset_versions v WHERE v.dataset_id = d.id) AS bytes
       FROM presentation_datasets pd JOIN datasets d ON d.id = pd.dataset_id
      WHERE pd.presentation_id = $1 AND d.user_id = $2 AND d.team_id IS NULL`,
    [deckId, ownerId]
  )
  return {
    ids: rows.map(r => r.id),
    live: rows.filter(r => r.source_kind && r.source_kind !== 'upload').length,
    bytes: rows.reduce((sum, r) => sum + Number(r.bytes), 0),
  }
}

// --- Templates ---

async function listTemplates(storage, teamId, userId) {
  await membership(storage, teamId, userId)
  const { rows } = await storage.query(
    `SELECT p.id, p.title, p.data->>'theme' AS theme, p.data->>'transition' AS transition,
            jsonb_array_length(COALESCE(p.data->'slides', '[]'::jsonb)) AS "slideCount",
            p.updated_at AS "updatedAt", p.created_at AS "createdAt",
            p.data->'slides'->0->'background' AS thumbnail,
            p.user_id AS "createdBy", COALESCE(NULLIF(u.name, ''), u.email) AS "creatorName"
       FROM presentations p LEFT JOIN users u ON u.id = p.user_id
      WHERE p.is_template = true AND p.team_id = $1
      ORDER BY p.updated_at DESC`,
    [teamId]
  )
  return rows.map(r => ({ ...r, slideCount: parseInt(r.slideCount) || 0, thumbnail: r.thumbnail || null, teamId }))
}

// A template of one of the team's decks, for the team: { id, title }
async function saveTemplate(storage, teamId, userId, deckId, title) {
  await mayAdd(storage, teamId, userId)
  const { rows: [{ n }] } = await storage.query('SELECT COUNT(*)::int AS n FROM presentations WHERE is_template = true AND team_id = $1', [teamId])
  if (n >= MAX_TEAM_TEMPLATES) throw new TeamError(400, `A team can keep up to ${MAX_TEAM_TEMPLATES} templates. Delete one to save another.`)
  const { rows: [deck] } = await storage.query('SELECT data FROM presentations WHERE id = $1 AND team_id = $2 AND is_template = false', [deckId, teamId])
  if (!deck) throw new TeamError(404, 'Not found')
  // Without present-mode ink or practice runs, which are the deck's own
  const { annotationSets, practiceRuns, version, id, createdAt, updatedAt, expiresAt, ...data } = deck.data || {}
  const name = String(title || '').trim() || `${data.title || 'Untitled'} (template)`
  const { rows } = await storage.query(
    `INSERT INTO presentations (id, user_id, team_id, title, data, is_template, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW()) RETURNING id, title`,
    [userId, teamId, name.slice(0, 200), JSON.stringify({ ...data, title: name.slice(0, 200) })]
  )
  return rows[0]
}

async function deleteTemplate(storage, teamId, userId, templateId) {
  const { rows } = await storage.query('SELECT user_id FROM presentations WHERE id = $1 AND team_id = $2 AND is_template = true', [templateId, teamId])
  if (!rows.length) throw new TeamError(404, 'Template not found')
  await mayChange(storage, teamId, userId, rows[0].user_id)
  await storage.query('DELETE FROM presentations WHERE id = $1 AND team_id = $2 AND is_template = true', [templateId, teamId])
}

// A team template's slides, for a new deck in the team
async function templateForTeam(storage, teamId, templateId) {
  const { rows } = await storage.query('SELECT id, data FROM presentations WHERE id = $1 AND team_id = $2 AND is_template = true', [templateId, teamId])
  return rows.length ? { ...rows[0].data, id: rows[0].id } : null
}

module.exports = {
  listThemes, createTheme, updateTheme, deleteTheme,
  listFonts, addFont, deleteFont, fontFileShared,
  datasetFor, deckDataset, listDatasets, shareDataset, checkTeamRoom, ownDatasetsOfDeck,
  listTemplates, saveTemplate, deleteTemplate, templateForTeam,
}

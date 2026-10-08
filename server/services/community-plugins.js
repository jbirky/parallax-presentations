// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Community plugins in the database (migration 021): the versions imported
// from GitHub (services/plugin-import.js), their review, and their sandbox
// pages for the editor and for the pages the server builds. A plugin's
// elements record the version they were made with (pluginVersion), and
// every view draws that version; a version that isn't approved draws a
// placeholder. Cloud only: self-hosted servers keep their plugin folders.

const { PluginImportError, compareVersions, slugFor } = require('./plugin-import')
const { withPluginCsp, WITHDRAWN_PAGE } = require('./plugin-embed')

async function hasTables(storage) {
  if (!storage || !storage.query) return false
  const { rows: [{ ok }] } = await storage.query("SELECT to_regclass('plugin_versions') IS NOT NULL AS ok")
  return ok
}

// --- Importing ---

// Stores a version fetchVersion fetched, as pending; submittedBy is who
// imported it. reservedTypes: element type -> plugin id, for the plugins
// that come with Parallax. Refuses (409) an id another repo has, an id
// that isn't this repo's, an element type another plugin has, and a
// version already imported.
async function saveVersion(storage, fetched, { submittedBy = null, reservedTypes = new Map() } = {}) {
  const { manifest } = fetched
  const types = manifest.contributes.elementTypes.map(t => t.type)
  for (const type of types) {
    if (reservedTypes.has(type)) throw new PluginImportError(`The element type “${type}” belongs to ${reservedTypes.get(type)}. Choose another.`, { status: 409 })
  }
  const client = await storage.pool.connect()
  try {
    await client.query('BEGIN')
    let { rows: [plugin] } = await client.query(
      'SELECT id, manifest_id FROM plugins WHERE lower(repo_owner) = lower($1) AND lower(repo_name) = lower($2) FOR UPDATE',
      [fetched.owner, fetched.repo])
    if (plugin && plugin.manifest_id !== manifest.id) {
      throw new PluginImportError(`This repo’s plugin has the id “${plugin.manifest_id}”. It can’t change to “${manifest.id}”, because decks find a plugin by its id.`, { status: 409 })
    }
    if (!plugin) {
      const { rows: [taken] } = await client.query('SELECT repo_owner, repo_name FROM plugins WHERE manifest_id = $1', [manifest.id])
      if (taken) throw new PluginImportError(`The id “${manifest.id}” belongs to github.com/${taken.repo_owner}/${taken.repo_name}`, { status: 409 })
    }
    const { rows: clash } = await client.query(
      `SELECT DISTINCT p.manifest_id AS "pluginId", et->>'type' AS type
         FROM plugin_versions v JOIN plugins p ON p.id = v.plugin_id,
              jsonb_array_elements(v.manifest->'contributes'->'elementTypes') et
        WHERE v.status <> 'rejected' AND p.manifest_id <> $1 AND et->>'type' = ANY($2)`,
      [manifest.id, types])
    if (clash.length) throw new PluginImportError(`The element type “${clash[0].type}” belongs to ${clash[0].pluginId}. Choose another.`, { status: 409 })

    if (!plugin) {
      const slug = slugFor(fetched.owner, fetched.repo)
      if (slug.length > 64) throw new PluginImportError('The repo’s owner and name together are too long for Parallax’s plugin addresses (64 characters)')
      ;({ rows: [plugin] } = await client.query(
        `INSERT INTO plugins (slug, name, description, version, manifest, published, manifest_id, repo_owner, repo_name)
         VALUES ($1, $2, $3, $4, $5, false, $6, $7, $8) RETURNING id, manifest_id`,
        [slug, manifest.name, manifest.description, manifest.version, manifest, manifest.id, fetched.owner, fetched.repo]))
    }
    const { rows: [existing] } = await client.query('SELECT status FROM plugin_versions WHERE plugin_id = $1 AND version = $2', [plugin.id, manifest.version])
    if (existing) throw new PluginImportError(`Version ${manifest.version} is already imported (${existing.status})`, { status: 409 })
    const { rows: [version] } = await client.query(
      `INSERT INTO plugin_versions (plugin_id, version, tag, commit_sha, manifest, readme, submitted_by, sha256, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [plugin.id, manifest.version, fetched.tag, fetched.commitSha, manifest, fetched.readme, submittedBy, fetched.sha256, fetched.sizeBytes])
    for (const f of fetched.files) {
      await client.query('INSERT INTO plugin_files (version_id, path, content, content_type, sha256) VALUES ($1, $2, $3, $4, $5)',
        [version.id, f.path, f.content, f.contentType, f.sha256])
    }
    await client.query('COMMIT')
    return getVersion(storage, version.id)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    // Two first imports of one repo at once: the second loses the race
    if (err.code === '23505') throw new PluginImportError('Someone imported this plugin at the same moment. Try again.', { status: 409 })
    throw err
  } finally {
    client.release()
  }
}

// The versions of a repo's plugin already imported: { version: status }
async function importedVersions(storage, owner, repo) {
  const { rows } = await storage.query(
    `SELECT v.version, v.status FROM plugin_versions v JOIN plugins p ON p.id = v.plugin_id
      WHERE lower(p.repo_owner) = lower($1) AND lower(p.repo_name) = lower($2)`, [owner, repo])
  return Object.fromEntries(rows.map(r => [r.version, r.status]))
}

// --- Versions ---

const VERSION_COLUMNS = `
  v.id, p.slug, p.manifest_id AS "pluginId", p.repo_owner AS "repoOwner", p.repo_name AS "repoName",
  v.version, v.tag, v.commit_sha AS "commitSha", v.manifest, v.status, v.review_note AS "reviewNote",
  v.size_bytes AS "sizeBytes", v.sha256, v.submitted_by AS "submittedBy", v.created_at AS "createdAt", v.reviewed_at AS "reviewedAt"`

async function getVersion(storage, versionId) {
  const { rows: [v] } = await storage.query(`SELECT ${VERSION_COLUMNS} FROM plugin_versions v JOIN plugins p ON p.id = v.plugin_id WHERE v.id = $1`, [versionId])
  return v || null
}

// The versions someone imported, newest first
async function submissions(storage, userId) {
  const { rows } = await storage.query(
    `SELECT ${VERSION_COLUMNS} FROM plugin_versions v JOIN plugins p ON p.id = v.plugin_id
      WHERE v.submitted_by = $1 ORDER BY v.created_at DESC LIMIT 100`, [userId])
  return rows
}

// Versions for an admin to review (status: one status, or all), newest
// first, each with its files, who imported it, and the plugin's newest
// other approved version to compare it with
async function versionsForReview(storage, { status = 'pending' } = {}) {
  const { rows } = await storage.query(
    `SELECT ${VERSION_COLUMNS}, v.readme, u.email AS "submitterEmail",
            (SELECT COALESCE(json_agg(json_build_object('path', f.path, 'size', octet_length(f.content), 'contentType', f.content_type, 'sha256', f.sha256) ORDER BY f.path), '[]')
               FROM plugin_files f WHERE f.version_id = v.id) AS files,
            (SELECT COALESCE(json_agg(json_build_object('version', a.version, 'tag', a.tag)), '[]') FROM plugin_versions a
              WHERE a.plugin_id = v.plugin_id AND a.status = 'approved' AND a.id <> v.id) AS "approvedVersions"
       FROM plugin_versions v JOIN plugins p ON p.id = v.plugin_id LEFT JOIN users u ON u.id = v.submitted_by
      WHERE ($1::text IS NULL OR v.status = $1) ORDER BY v.created_at DESC LIMIT 200`,
    [status || null])
  // approved: the plugin's newest other approved version, { version, tag }
  return rows.map(({ approvedVersions, ...v }) => ({
    ...v, approved: approvedVersions.sort((a, b) => compareVersions(a.version, b.version)).pop() || null,
  }))
}

const MOVES = {
  approve: { from: ['pending', 'rejected'], to: 'approved' },
  reject: { from: ['pending'], to: 'rejected' },
  revoke: { from: ['approved'], to: 'revoked' },
}

// An admin's decision on a version: approve, reject or revoke. Resolves to
// the version, or null when it's not in a state that decision applies to
async function reviewVersion(storage, versionId, action, { note = '', reviewerId = null } = {}) {
  const move = MOVES[action]
  if (!move) throw new Error(`Unknown review action ${action}`)
  const { rows: [v] } = await storage.query(
    `UPDATE plugin_versions SET status = $2, review_note = $3, reviewed_by = $4, reviewed_at = NOW()
      WHERE id = $1 AND status = ANY($5) RETURNING plugin_id`,
    [versionId, move.to, String(note || '').slice(0, 2000), reviewerId, move.from])
  if (!v) return null
  await refreshListing(storage, v.plugin_id)
  return getVersion(storage, versionId)
}

// Points a plugin's listing at its newest approved version, or unlists it
// when it has none
async function refreshListing(storage, pluginId) {
  const { rows } = await storage.query(`SELECT version, manifest, readme FROM plugin_versions WHERE plugin_id = $1 AND status = 'approved'`, [pluginId])
  const newest = rows.sort((a, b) => compareVersions(b.version, a.version))[0]
  if (!newest) {
    await storage.query('UPDATE plugins SET published = false, updated_at = NOW() WHERE id = $1', [pluginId])
    return
  }
  await storage.query(
    `UPDATE plugins SET published = true, version = $2, name = $3, description = $4, manifest = $5, readme = $6, updated_at = NOW() WHERE id = $1`,
    [pluginId, newest.version, newest.manifest.name, newest.manifest.description, newest.manifest, newest.readme])
}

// --- Serving a version ---

// Whether the request's user may have a version's files: anyone once it's
// approved; while it isn't, admins and whoever imported it (and once it's
// revoked, admins only)
function canSee(v, { userId = null, admin = false } = {}) {
  if (!v) return false
  if (v.status === 'approved' || admin) return true
  return v.status !== 'revoked' && !!userId && v.submittedBy === userId
}

// One of a version's files: { status, submittedBy, manifest, path,
// contentType, content }, or null. filePath null is its sandbox page.
async function versionFile(storage, pluginId, version, filePath = null) {
  const { rows: [row] } = await storage.query(
    `SELECT v.status, v.submitted_by AS "submittedBy", v.manifest, f.path, f.content_type AS "contentType", f.content
       FROM plugin_versions v JOIN plugins p ON p.id = v.plugin_id
       LEFT JOIN plugin_files f ON f.version_id = v.id AND f.path = COALESCE($3, v.manifest->>'sandbox')
      WHERE p.manifest_id = $1 AND v.version = $2`,
    [pluginId, version, filePath])
  return row || null
}

// A version's sandbox page as the editor and decks embed it: with its CSP
function sandboxPage(file) {
  return withPluginCsp(file.content.toString('utf8'), file.manifest?.permissions)
}

// The community plugin versions a deck's elements use: [{ pluginId, version }]
function pluginVersionsIn(presentation) {
  const seen = new Map()
  for (const slide of presentation?.slides || []) {
    for (const el of slide.elements || []) {
      if (typeof el?.type === 'string' && el.type.startsWith('plugin:') && typeof el.pluginId === 'string' && typeof el.pluginVersion === 'string') {
        seen.set(`${el.pluginId}@${el.pluginVersion}`, { pluginId: el.pluginId, version: el.pluginVersion })
      }
    }
  }
  return [...seen.values()]
}

const versionKey = (pluginId, version) => `${pluginId}@${version}`

// The sandbox pages of the community plugin versions a deck uses, for the
// pages the server builds: Map of "id@version" -> page. A version that
// isn't approved gets the placeholder page.
async function sandboxesFor(storage, presentation) {
  const wanted = pluginVersionsIn(presentation)
  const pages = new Map()
  if (!wanted.length || !(await hasTables(storage))) return pages
  const { rows } = await storage.query(
    `SELECT p.manifest_id AS "pluginId", v.version, v.status, v.manifest, f.content
       FROM plugin_versions v JOIN plugins p ON p.id = v.plugin_id
       LEFT JOIN plugin_files f ON f.version_id = v.id AND f.path = v.manifest->>'sandbox'
      WHERE (p.manifest_id, v.version) IN (SELECT * FROM unnest($1::text[], $2::text[]))`,
    [wanted.map(w => w.pluginId), wanted.map(w => w.version)])
  for (const w of wanted) {
    const row = rows.find(r => r.pluginId === w.pluginId && r.version === w.version)
    pages.set(versionKey(w.pluginId, w.version), row && row.status === 'approved' && row.content ? sandboxPage(row) : WITHDRAWN_PAGE)
  }
  return pages
}

module.exports = {
  hasTables, saveVersion, importedVersions, getVersion, submissions, versionsForReview, reviewVersion, refreshListing,
  canSee, versionFile, sandboxPage, pluginVersionsIn, sandboxesFor, versionKey,
}

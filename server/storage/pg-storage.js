// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const { Pool } = require('pg')
const { v4: uuidv4 } = require('uuid')
const StorageInterface = require('./interface')
const { encrypt, decrypt } = require('../utils/crypto')

// Fields kept in columns, which the data's copies of don't matter to whether
// a save changed anything
const UNSAVED_FIELDS = `'{id,createdAt,updatedAt,expiresAt,version}'::text[]`

class PgStorage extends StorageInterface {
  constructor(connectionString) {
    super()
    // Encrypted, with the server's certificate checked, unless the URL's
    // sslmode says otherwise (which overrides this)
    this.pool = new Pool({ connectionString, ssl: true })
    // Set when presentations are edited live (services/collab.js):
    // beforeRead(id) stores the live document's edits in data, and
    // liveSave(id, data, { baseVersion }) saves to the live document, or
    // returns null when the presentation has none
    this.beforeRead = null
    this.liveSave = null
  }

  async query(text, params) {
    return this.pool.query(text, params)
  }

  // --- Presentations ---

  async listPresentations(userId, opts = {}) {
    const conditions = ['is_template = false']
    const params = []
    if (userId) { params.push(userId); conditions.push(`user_id = $${params.length}`) }
    if (opts.excludeExpired) { conditions.push('(expires_at IS NULL OR expires_at > NOW())') }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await this.query(`
      SELECT id, title,
        data->>'theme' as theme,
        data->>'transition' as transition,
        jsonb_array_length(COALESCE(data->'slides', '[]'::jsonb)) as "slideCount",
        updated_at as "updatedAt",
        created_at as "createdAt",
        expires_at as "expiresAt",
        data->'slides'->0->'background' as thumbnail
      FROM presentations
      ${where}
      ORDER BY updated_at DESC
    `, params)
    return rows.map(r => ({ ...r, slideCount: parseInt(r.slideCount) || 0, thumbnail: r.thumbnail || null }))
  }

  async getPresentation(id, userId) {
    if (this.beforeRead) await this.beforeRead(id)
    const sql = userId
      ? 'SELECT id, data, created_at as "createdAt", updated_at as "updatedAt", expires_at as "expiresAt", version FROM presentations WHERE id = $1 AND user_id = $2 AND is_template = false'
      : 'SELECT id, data, created_at as "createdAt", updated_at as "updatedAt", expires_at as "expiresAt", version FROM presentations WHERE id = $1 AND is_template = false'
    const params = userId ? [id, userId] : [id]
    const { rows } = await this.query(sql, params)
    if (!rows.length) return null
    const r = rows[0]
    return { ...r.data, id: r.id, createdAt: r.createdAt, updatedAt: r.updatedAt, expiresAt: r.expiresAt || null, version: r.version }
  }

  async createPresentation(data, userId, expiresAt = null) {
    const id = data.id || uuidv4()
    const now = new Date().toISOString()
    const title = data.title || 'Untitled'
    const pres = { ...data, id, createdAt: now, updatedAt: now }
    if (expiresAt) pres.expiresAt = expiresAt
    await this.query(
      'INSERT INTO presentations (id, user_id, title, data, is_template, created_at, updated_at, expires_at) VALUES ($1, $2, $3, $4, false, $5, $5, $6)',
      [id, userId || null, title, JSON.stringify(pres), now, expiresAt]
    )
    return pres
  }

  // Saves data over the presentation. With baseVersion, the version the
  // saver's copy came from, a save from an older version is refused: returns
  // { conflict: true, version } with the version now. A save that changes
  // nothing isn't written, so it doesn't bump the version and leave everyone
  // else's copy out of date.
  async updatePresentation(id, data, userId, { baseVersion } = {}) {
    const existing = await this.getPresentation(id, userId)
    if (!existing) return null
    const checked = Number.isInteger(baseVersion)
    if (checked && baseVersion !== existing.version) return { conflict: true, version: existing.version }
    const live = this.liveSave && await this.liveSave(id, data, { baseVersion })
    if (live) return live.conflict ? live : this.getPresentation(id, userId)
    const now = new Date().toISOString()
    const { version: _, ...merged } = { ...existing, ...data, id, updatedAt: now }
    const params = [merged.title || 'Untitled', JSON.stringify(merged), now, id]
    const where = [
      'id = $4',
      `(title IS DISTINCT FROM $1 OR (data - ${UNSAVED_FIELDS}) IS DISTINCT FROM ($2::jsonb - ${UNSAVED_FIELDS}))`,
    ]
    if (userId) { params.push(userId); where.push(`user_id = $${params.length}`) }
    if (checked) { params.push(baseVersion); where.push(`version = $${params.length}`) }
    const { rows } = await this.query(
      `UPDATE presentations SET title = $1, data = $2, updated_at = $3, version = version + 1
        WHERE ${where.join(' AND ')} RETURNING version`,
      params
    )
    if (rows.length) return { ...merged, version: rows[0].version }
    // Nothing written: either nothing changed, or someone saved in between
    const current = await this.getPresentation(id, userId)
    if (!current) return null
    if (checked && current.version !== baseVersion) return { conflict: true, version: current.version }
    return current
  }

  async deletePresentation(id, userId) {
    const sql = userId
      ? 'DELETE FROM presentations WHERE id = $1 AND user_id = $2'
      : 'DELETE FROM presentations WHERE id = $1'
    const params = userId ? [id, userId] : [id]
    const { rowCount } = await this.query(sql, params)
    return rowCount > 0
  }

  async duplicatePresentation(id, userId) {
    const orig = await this.getPresentation(id, userId)
    if (!orig) return null
    const copy = { ...JSON.parse(JSON.stringify(orig)), title: (orig.title || 'Untitled') + ' (copy)' }
    delete copy.id
    delete copy.createdAt
    delete copy.updatedAt
    delete copy.version
    const created = await this.createPresentation(copy, userId)
    // The copy's slides use the original's files. Its own upload rows keep
    // those files (and their /uploads/ URLs) when the original is deleted.
    await this.query(
      `INSERT INTO uploads (presentation_id, user_id, filename, storage_key, content_type, size_bytes, file_hash)
       SELECT $1, user_id, filename, storage_key, content_type, size_bytes, file_hash
         FROM uploads WHERE presentation_id = $2`,
      [created.id, id]
    )
    return created
  }

  // --- Templates ---

  async listTemplates(userId) {
    const conditions = ['is_template = true']
    const params = []
    if (userId) { params.push(userId); conditions.push(`user_id = $${params.length}`) }
    const { rows } = await this.query(`
      SELECT id, title,
        data->>'theme' as theme,
        data->>'transition' as transition,
        jsonb_array_length(COALESCE(data->'slides', '[]'::jsonb)) as "slideCount",
        updated_at as "updatedAt",
        created_at as "createdAt",
        data->'slides'->0->'background' as thumbnail
      FROM presentations
      WHERE ${conditions.join(' AND ')}
      ORDER BY updated_at DESC
    `, params)
    return rows.map(r => ({ ...r, slideCount: parseInt(r.slideCount) || 0, thumbnail: r.thumbnail || null }))
  }

  async getTemplate(id, userId) {
    const sql = userId
      ? 'SELECT id, data, created_at as "createdAt", updated_at as "updatedAt" FROM presentations WHERE id = $1 AND user_id = $2 AND is_template = true'
      : 'SELECT id, data, created_at as "createdAt", updated_at as "updatedAt" FROM presentations WHERE id = $1 AND is_template = true'
    const params = userId ? [id, userId] : [id]
    const { rows } = await this.query(sql, params)
    if (!rows.length) return null
    const r = rows[0]
    return { ...r.data, id: r.id, createdAt: r.createdAt, updatedAt: r.updatedAt }
  }

  async createTemplate(data, userId) {
    const id = uuidv4()
    const now = new Date().toISOString()
    const title = data.title || 'Untitled Template'
    const tmpl = { ...data, id, isTemplate: true, createdAt: now, updatedAt: now }
    await this.query(
      'INSERT INTO presentations (id, user_id, title, data, is_template, created_at, updated_at) VALUES ($1, $2, $3, $4, true, $5, $5)',
      [id, userId || null, title, JSON.stringify(tmpl), now]
    )
    return tmpl
  }

  async updateTemplate(id, data, userId) {
    const existing = await this.getTemplate(id, userId)
    if (!existing) return null
    const now = new Date().toISOString()
    const merged = { ...existing, ...data, id, updatedAt: now }
    const sql = userId
      ? 'UPDATE presentations SET title = $1, data = $2, updated_at = $3 WHERE id = $4 AND user_id = $5 AND is_template = true'
      : 'UPDATE presentations SET title = $1, data = $2, updated_at = $3 WHERE id = $4 AND is_template = true'
    const params = userId
      ? [merged.title || 'Untitled', JSON.stringify(merged), now, id, userId]
      : [merged.title || 'Untitled', JSON.stringify(merged), now, id]
    await this.query(sql, params)
    return merged
  }

  async deleteTemplate(id, userId) {
    const sql = userId
      ? 'DELETE FROM presentations WHERE id = $1 AND user_id = $2 AND is_template = true'
      : 'DELETE FROM presentations WHERE id = $1 AND is_template = true'
    const params = userId ? [id, userId] : [id]
    const { rowCount } = await this.query(sql, params)
    return rowCount > 0
  }

  async saveAsTemplate(presentationId, title, userId) {
    const stored = await this.getPresentation(presentationId, userId)
    if (!stored) return null
    // Without present-mode ink or practice runs, which are private to this presentation
    const { annotationSets, practiceRuns, version, ...pres } = stored
    const tmplData = { ...JSON.parse(JSON.stringify(pres)), title: (title || pres.title || 'Untitled') + ' (template)' }
    delete tmplData.id
    delete tmplData.createdAt
    delete tmplData.updatedAt
    return this.createTemplate(tmplData, userId)
  }

  // --- Sharing ---

  async createShareToken(presentationId, userId) {
    const sql = userId
      ? 'SELECT id, share_token, share_enabled FROM presentations WHERE id = $1 AND user_id = $2'
      : 'SELECT id, share_token, share_enabled FROM presentations WHERE id = $1'
    const params = userId ? [presentationId, userId] : [presentationId]
    const { rows } = await this.query(sql, params)
    if (!rows.length) return null
    const row = rows[0]
    if (row.share_enabled && row.share_token) return { token: row.share_token, shared: true }
    // A new link each time sharing is turned on, so turning it off and on
    // is how a leaked link is replaced
    const token = uuidv4()
    const updateSql = userId
      ? 'UPDATE presentations SET share_token = $1, share_enabled = true WHERE id = $2 AND user_id = $3'
      : 'UPDATE presentations SET share_token = $1, share_enabled = true WHERE id = $2'
    const updateParams = userId ? [token, presentationId, userId] : [token, presentationId]
    await this.query(updateSql, updateParams)
    return { token, shared: true }
  }

  async deleteShareToken(presentationId, userId) {
    const sql = userId
      ? 'UPDATE presentations SET share_enabled = false WHERE id = $1 AND user_id = $2'
      : 'UPDATE presentations SET share_enabled = false WHERE id = $1'
    const params = userId ? [presentationId, userId] : [presentationId]
    await this.query(sql, params)
    return { shared: false }
  }

  async getShareStatus(presentationId, userId) {
    const sql = userId
      ? 'SELECT share_token, share_enabled FROM presentations WHERE id = $1 AND user_id = $2'
      : 'SELECT share_token, share_enabled FROM presentations WHERE id = $1'
    const params = userId ? [presentationId, userId] : [presentationId]
    const { rows } = await this.query(sql, params)
    if (!rows.length) return { shared: false, token: null }
    return { shared: rows[0].share_enabled, token: rows[0].share_enabled ? rows[0].share_token : null }
  }

  async getSharedPresentation(token) {
    const { rows } = await this.query(
      'SELECT id, data, created_at as "createdAt", updated_at as "updatedAt" FROM presentations WHERE share_token = $1 AND share_enabled = true',
      [token]
    )
    if (!rows.length) return null
    const r = rows[0]
    return { ...r.data, id: r.id, createdAt: r.createdAt, updatedAt: r.updatedAt }
  }

  // Whose a presentation is (and so whose its linked datasets are), for pages
  // built from it without a signed-in owner: share links
  async getPresentationOwner(presentationId) {
    const { rows } = await this.query('SELECT user_id FROM presentations WHERE id = $1', [presentationId])
    return rows.length ? rows[0].user_id : null
  }

  // --- Snapshots ---

  async createSnapshot(presentationId, name, userId) {
    const stored = await this.getPresentation(presentationId, userId)
    if (!stored) return null
    // A version is the slides; present-mode ink and practice runs aren't part of it
    const { annotationSets, practiceRuns, version, ...pres } = stored
    const id = uuidv4()
    const label = name || new Date().toISOString()
    const now = new Date().toISOString()
    await this.query(
      'INSERT INTO snapshots (id, presentation_id, data, label, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, presentationId, JSON.stringify(pres), label, now]
    )
    return { id, name: label, createdAt: now }
  }

  async listSnapshots(presentationId, userId) {
    const ownerCheck = userId
      ? await this.query('SELECT 1 FROM presentations WHERE id = $1 AND user_id = $2', [presentationId, userId])
      : { rows: [1] }
    if (!ownerCheck.rows.length) return []
    const { rows } = await this.query(
      `SELECT id, label as name, created_at as "createdAt",
        jsonb_array_length(COALESCE(data->'slides', '[]'::jsonb)) as "slideCount"
      FROM snapshots WHERE presentation_id = $1 ORDER BY created_at DESC`,
      [presentationId]
    )
    return rows.map(r => ({ ...r, slideCount: parseInt(r.slideCount) || 0 }))
  }

  async restoreSnapshot(presentationId, snapshotId, userId) {
    const { rows } = await this.query('SELECT data FROM snapshots WHERE id = $1 AND presentation_id = $2', [snapshotId, presentationId])
    if (!rows.length) return null
    const snapData = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
    // The presentation keeps its present-mode ink and practice runs, which aren't part of a version
    const { annotationSets, practiceRuns, ...restored } = snapData
    return this.updatePresentation(presentationId, restored, userId)
  }

  async deleteSnapshot(presentationId, snapshotId, userId) {
    if (userId) {
      const { rows } = await this.query('SELECT 1 FROM presentations WHERE id = $1 AND user_id = $2', [presentationId, userId])
      if (!rows.length) return false
    }
    await this.query('DELETE FROM snapshots WHERE id = $1 AND presentation_id = $2', [snapshotId, presentationId])
    return true
  }

  async getSnapshotData(presentationId, snapshotId, userId) {
    if (userId) {
      const { rows } = await this.query('SELECT 1 FROM presentations WHERE id = $1 AND user_id = $2', [presentationId, userId])
      if (!rows.length) return null
    }
    const { rows } = await this.query('SELECT data FROM snapshots WHERE id = $1 AND presentation_id = $2', [snapshotId, presentationId])
    if (!rows.length) return null
    return typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
  }

  // --- GitHub config ---

  async getGithubConfig(userId) {
    if (!userId) return { token: '', owner: '', repo: '', pagesUrl: '' }
    const { rows } = await this.query('SELECT token, owner, repo, pages_url as "pagesUrl" FROM github_configs WHERE user_id = $1', [userId])
    if (!rows.length) return { token: '', owner: '', repo: '', pagesUrl: '' }
    return { ...rows[0], token: decrypt(rows[0].token || '') }
  }

  async setGithubConfig(config, userId) {
    if (!userId) return config
    const existing = await this.getGithubConfig(userId)
    const updated = {
      token: config.token !== undefined ? config.token : existing.token,
      owner: config.owner !== undefined ? config.owner : existing.owner,
      repo: config.repo !== undefined ? config.repo : existing.repo,
      pagesUrl: config.pagesUrl !== undefined ? config.pagesUrl : (existing.pagesUrl || ''),
    }
    const encryptedToken = encrypt(updated.token)
    await this.query(
      `INSERT INTO github_configs (user_id, token, owner, repo, pages_url) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET token = $2, owner = $3, repo = $4, pages_url = $5`,
      [userId, encryptedToken, updated.owner, updated.repo, updated.pagesUrl]
    )
    return updated
  }

  // --- Zotero ---

  async getZoteroConfig(userId) {
    if (!userId) return { zoteroUserId: '', apiKey: '' }
    const { rows } = await this.query('SELECT zotero_user_id as "zoteroUserId", api_key as "apiKey" FROM zotero_configs WHERE user_id = $1', [userId])
    if (!rows.length) return { zoteroUserId: '', apiKey: '' }
    return { zoteroUserId: rows[0].zoteroUserId || '', apiKey: decrypt(rows[0].apiKey || '') }
  }

  async setZoteroConfig(config, userId) {
    if (!userId) return config
    const encryptedKey = encrypt(config.apiKey || '')
    await this.query(
      `INSERT INTO zotero_configs (user_id, zotero_user_id, api_key) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET zotero_user_id = $2, api_key = $3`,
      [userId, config.zoteroUserId || '', encryptedKey]
    )
    return { zoteroUserId: config.zoteroUserId || '', apiKey: config.apiKey || '' }
  }

  // --- Zenodo ---

  async getZenodoConfig(userId) {
    if (!userId) return { token: '', sandbox: false }
    const { rows } = await this.query('SELECT token, sandbox FROM zenodo_configs WHERE user_id = $1', [userId])
    if (!rows.length) return { token: '', sandbox: false }
    return { token: decrypt(rows[0].token || ''), sandbox: rows[0].sandbox || false }
  }

  async setZenodoConfig(config, userId) {
    if (!userId) return config
    const existing = await this.getZenodoConfig(userId)
    const updated = {
      token: config.token !== undefined ? config.token : existing.token,
      sandbox: config.sandbox !== undefined ? config.sandbox : existing.sandbox,
    }
    const encryptedToken = encrypt(updated.token)
    await this.query(
      `INSERT INTO zenodo_configs (user_id, token, sandbox) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET token = $2, sandbox = $3`,
      [userId, encryptedToken, updated.sandbox]
    )
    return updated
  }

  // --- Plugins ---

  _scanBundledPlugins() {
    const dir = require('path').join(__dirname, '..', '..', 'plugins')
    const fs = require('fs-extra')
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(entry => {
      const mp = require('path').join(dir, entry.name, 'parallax-plugin.json')
      if (!fs.existsSync(mp)) return null
      const m = fs.readJsonSync(mp)
      return { id: m.id, slug: entry.name, name: m.name, description: m.description, version: m.version, manifest: m }
    }).filter(Boolean)
  }

  // A plugins row, read as JSON so it works with or without the community
  // plugin columns (migration 021); community: imported from a GitHub repo
  // (services/community-plugins.js), and listed once a version is approved
  _pluginFromRow(r) {
    return {
      id: r.id, slug: r.slug, name: r.name, description: r.description, version: r.version,
      priceCents: r.price_cents, manifest: r.manifest, published: r.published, downloads: r.downloads, avgRating: r.avg_rating,
      community: !!r.repo_owner,
      ...(r.repo_owner && { pluginId: r.manifest_id, repo: { owner: r.repo_owner, name: r.repo_name }, updatedAt: r.updated_at }),
    }
  }

  async listPlugins() {
    const { rows } = await this.query(`SELECT to_jsonb(p) - 'readme' AS p FROM plugins p WHERE published = true ORDER BY name`)
    const listed = rows.map(r => this._pluginFromRow(r.p))
    const bundled = this._scanBundledPlugins().map(b => ({ ...b, community: false }))
    const seen = new Set(listed.map(r => r.slug))
    return [...listed, ...bundled.filter(b => !seen.has(b.slug))]
  }

  async getPlugin(slug) {
    const { rows } = await this.query(`SELECT to_jsonb(p) - 'readme' AS p FROM plugins p WHERE slug = $1`, [slug])
    if (rows[0]) return this._pluginFromRow(rows[0].p)
    const bundled = this._scanBundledPlugins().find(b => b.slug === slug)
    return bundled ? { ...bundled, community: false } : null
  }

  // Counts an install the first time someone installs a plugin (again,
  // after uninstalling it)
  async installPlugin(pluginId, userId) {
    const licenseKey = require('crypto').randomUUID()
    const { rows } = await this.query(
      `INSERT INTO plugin_licenses (user_id, plugin_id, license_key, status) VALUES ($1, $2, $3, 'active') ON CONFLICT (user_id, plugin_id) DO UPDATE SET status = 'active' RETURNING (xmax = 0) AS inserted`,
      [userId, pluginId, licenseKey]
    )
    if (rows[0]?.inserted) await this.query('UPDATE plugins SET downloads = downloads + 1 WHERE id = $1', [pluginId])
  }

  async uninstallPlugin(pluginId, userId) {
    await this.query(`DELETE FROM plugin_licenses WHERE user_id = $1 AND plugin_id = $2`, [userId, pluginId])
  }

  // The listed plugins someone installed, each at its newest approved version
  async getInstalledPlugins(userId) {
    const { rows } = await this.query(
      `SELECT to_jsonb(p) - 'readme' AS p FROM plugins p INNER JOIN plugin_licenses l ON l.plugin_id = p.id WHERE l.user_id = $1 AND l.status = 'active' AND p.published = true ORDER BY p.name`,
      [userId]
    )
    return rows.map(r => this._pluginFromRow(r.p))
  }

  async getPresentationPlugins(presentationId) {
    const { rows } = await this.query(
      `SELECT p.id, p.slug, p.name, p.version, p.manifest, pp.config FROM plugins p INNER JOIN presentation_plugins pp ON pp.plugin_id = p.id WHERE pp.presentation_id = $1`,
      [presentationId]
    )
    return rows
  }

  async enablePluginForPresentation(presentationId, pluginId, config = {}) {
    await this.query(
      `INSERT INTO presentation_plugins (presentation_id, plugin_id, config) VALUES ($1, $2, $3) ON CONFLICT (presentation_id, plugin_id) DO UPDATE SET config = $3`,
      [presentationId, pluginId, JSON.stringify(config)]
    )
  }

  async disablePluginForPresentation(presentationId, pluginId) {
    await this.query(`DELETE FROM presentation_plugins WHERE presentation_id = $1 AND plugin_id = $2`, [presentationId, pluginId])
  }

  async getPluginStorage(userId, pluginId, key) {
    const { rows } = await this.query(`SELECT value FROM plugin_storage WHERE user_id = $1 AND plugin_id = $2 AND key = $3`, [userId, pluginId, key])
    return rows[0]?.value ?? null
  }

  async setPluginStorage(userId, pluginId, key, value) {
    await this.query(
      `INSERT INTO plugin_storage (user_id, plugin_id, key, value) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, plugin_id, key) DO UPDATE SET value = $4`,
      [userId, pluginId, key, JSON.stringify(value)]
    )
  }

  async deletePluginStorage(userId, pluginId, key) {
    await this.query(`DELETE FROM plugin_storage WHERE user_id = $1 AND plugin_id = $2 AND key = $3`, [userId, pluginId, key])
  }

  // --- Datasets ---
  // A dataset row mirrors its current version (storage_key, format, columns,
  // row_count, byte_size), so reading the current data needs no join

  async createDataset(data, userId) {
    const id = uuidv4()
    const now = new Date().toISOString()
    await this.query(
      `INSERT INTO datasets (id, user_id, name, filename, format, storage_key, columns, row_count, byte_size, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       ON CONFLICT (user_id, name) DO UPDATE SET
         filename = EXCLUDED.filename, format = EXCLUDED.format, storage_key = EXCLUDED.storage_key,
         columns = EXCLUDED.columns, row_count = EXCLUDED.row_count, byte_size = EXCLUDED.byte_size, updated_at = EXCLUDED.updated_at`,
      [id, userId, data.name, data.filename, data.format, data.storageKey, JSON.stringify(data.columns), data.rowCount, data.byteSize, now]
    )
    const { rows } = await this.query(`SELECT ${DATASET_FIELDS} FROM datasets d WHERE user_id = $1 AND name = $2`, [userId, data.name])
    return datasetFrom(rows[0], { withKey: true })
  }

  // A live dataset, made once its first fetch worked; a name already taken
  // throws with code 'duplicate'
  async createLiveDataset(data, userId) {
    try {
      const { rows } = await this.query(
        `INSERT INTO datasets AS d (user_id, name, filename, format, storage_key, columns, row_count, byte_size,
                               source_kind, source, source_secret, schedule, next_fetch_at, last_fetched_at)
         VALUES ($1, $2, $3, 'columns', '', '[]', 0, 0, $4, $5, $6, $7, $8, NOW())
         RETURNING ${DATASET_FIELDS}`,
        [userId, data.name, data.filename, data.sourceKind, JSON.stringify(data.source), data.sourceSecret ? encrypt(data.sourceSecret) : null,
          data.schedule, data.nextFetchAt]
      )
      return datasetFrom(rows[0], { withKey: true })
    } catch (err) {
      if (err.code === '23505') throw Object.assign(new Error(`You already have a dataset named "${data.name}"`), { code: 'duplicate' })
      throw err
    }
  }

  async listDatasets(userId) {
    const { rows } = await this.query(`SELECT ${DATASET_FIELDS} FROM datasets d WHERE user_id = $1 ORDER BY updated_at DESC`, [userId])
    return rows.map(r => datasetFrom(r))
  }

  async getDataset(id, userId) {
    const { rows } = await this.query(`SELECT ${DATASET_FIELDS} FROM datasets d WHERE id = $1 AND user_id = $2`, [id, userId])
    return rows.length ? datasetFrom(rows[0], { withKey: true }) : null
  }

  async getDatasetByName(name, userId) {
    const { rows } = await this.query(`SELECT ${DATASET_FIELDS} FROM datasets d WHERE name = $1 AND user_id = $2`, [name, userId])
    return rows.length ? datasetFrom(rows[0], { withKey: true }) : null
  }

  // A dataset as the refresh loop needs it: its owner and plan, and its
  // header secret decrypted
  async getDatasetForFetch(id) {
    const { rows } = await this.query(
      `SELECT ${DATASET_FIELDS}, d.user_id, d.source_secret, u.plan
         FROM datasets d JOIN users u ON u.id = d.user_id WHERE d.id = $1`,
      [id]
    )
    if (!rows.length) return null
    const r = rows[0]
    return { ...datasetFrom(r, { withKey: true }), userId: r.user_id, plan: r.plan, secret: r.source_secret ? decrypt(r.source_secret) : '' }
  }

  async updateDataset(id, data, userId) {
    const sets = []
    const params = []
    let i = 1
    if (data.name) { sets.push(`name = $${i++}`); params.push(data.name) }
    if (!sets.length) return this.getDataset(id, userId)
    sets.push(`updated_at = NOW()`)
    params.push(id, userId)
    await this.query(`UPDATE datasets SET ${sets.join(', ')} WHERE id = $${i++} AND user_id = $${i}`, params)
    return this.getDataset(id, userId)
  }

  // Changes where a live dataset comes from or how often it refreshes.
  // sourceSecret: undefined keeps it, '' removes it
  async updateDatasetSource(id, userId, { source, sourceSecret, schedule, nextFetchAt }) {
    const sets = ['updated_at = NOW()', 'failures = 0']
    const params = []
    let i = 1
    if (source !== undefined) { sets.push(`source = $${i++}`); params.push(JSON.stringify(source)) }
    if (sourceSecret !== undefined) { sets.push(`source_secret = $${i++}`); params.push(sourceSecret ? encrypt(sourceSecret) : null) }
    if (schedule !== undefined) { sets.push(`schedule = $${i++}`); params.push(schedule) }
    if (nextFetchAt !== undefined) { sets.push(`next_fetch_at = $${i++}`); params.push(nextFetchAt) }
    params.push(id, userId)
    await this.query(`UPDATE datasets SET ${sets.join(', ')} WHERE id = $${i++} AND user_id = $${i} AND source_kind <> 'upload'`, params)
    return this.getDataset(id, userId)
  }

  async setDatasetTransforms(id, userId, transforms, outputColumns) {
    await this.query(
      'UPDATE datasets SET transforms = $1, output_columns = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4',
      [JSON.stringify(transforms), outputColumns ? JSON.stringify(outputColumns) : null, id, userId]
    )
    return this.getDataset(id, userId)
  }

  // The transforms' columns after a refresh changed the data under them
  async setOutputColumns(id, outputColumns) {
    await this.query('UPDATE datasets SET output_columns = $1 WHERE id = $2', [outputColumns ? JSON.stringify(outputColumns) : null, id])
  }

  async countLiveDatasets(userId) {
    const { rows } = await this.query(`SELECT COUNT(*)::int AS n FROM datasets WHERE user_id = $1 AND source_kind <> 'upload'`, [userId])
    return rows[0].n
  }

  // Deletes a dataset, its versions and its fetch log; returns it with every
  // version's storage key, for deleting their files
  async deleteDataset(id, userId) {
    const ds = await this.getDataset(id, userId)
    if (!ds) return null
    const { rows } = await this.query('SELECT storage_key FROM dataset_versions WHERE dataset_id = $1', [id])
    await this.query('DELETE FROM datasets WHERE id = $1 AND user_id = $2', [id, userId])
    const keys = new Set(rows.map(r => r.storage_key))
    if (ds.storageKey) keys.add(ds.storageKey)
    return { ...ds, storageKeys: [...keys].filter(Boolean) }
  }

  // --- Dataset versions ---

  async createDatasetVersion(datasetId, v) {
    const { rows } = await this.query(
      `INSERT INTO dataset_versions (dataset_id, storage_key, format, content_hash, columns, row_count, byte_size, etag, last_modified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [datasetId, v.storageKey, v.format, v.contentHash || null, JSON.stringify(v.columns || []), v.rowCount, v.byteSize || 0, v.etag || null, v.lastModified || null]
    )
    return versionFrom(rows[0])
  }

  // Makes a version the one the dataset reads, copying its file and shape
  async setCurrentVersion(datasetId, version) {
    await this.query(
      `UPDATE datasets SET current_version_id = $1, storage_key = $2, format = $3, columns = $4, row_count = $5, byte_size = $6, updated_at = NOW()
       WHERE id = $7`,
      [version.id, version.storageKey, version.format, JSON.stringify(version.columns), version.rowCount, version.byteSize, datasetId]
    )
  }

  // Newest first, each with the decks that pin it
  async listDatasetVersions(datasetId) {
    const { rows } = await this.query(
      `SELECT v.*, COALESCE(array_agg(pd.presentation_id) FILTER (WHERE pd.presentation_id IS NOT NULL), '{}') AS pinned_by
         FROM dataset_versions v LEFT JOIN presentation_datasets pd ON pd.pinned_version_id = v.id
        WHERE v.dataset_id = $1 GROUP BY v.id ORDER BY v.created_at DESC, v.id`,
      [datasetId]
    )
    return rows.map(r => ({ ...versionFrom(r), pinnedBy: r.pinned_by }))
  }

  async getDatasetVersion(datasetId, versionId) {
    const { rows } = await this.query('SELECT * FROM dataset_versions WHERE id = $1 AND dataset_id = $2', [versionId, datasetId])
    return rows.length ? versionFrom(rows[0]) : null
  }

  // Returns the storage keys of the versions deleted
  async deleteDatasetVersions(datasetId, versionIds) {
    if (!versionIds.length) return []
    const { rows } = await this.query(
      'DELETE FROM dataset_versions WHERE dataset_id = $1 AND id = ANY($2) RETURNING storage_key',
      [datasetId, versionIds]
    )
    return rows.map(r => r.storage_key)
  }

  async setPinnedVersion(presentationId, datasetId, versionId) {
    await this.query(
      'UPDATE presentation_datasets SET pinned_version_id = $1 WHERE presentation_id = $2 AND dataset_id = $3',
      [versionId || null, presentationId, datasetId]
    )
  }

  // --- Refreshing live datasets ---

  // Takes a lease on up to `limit` datasets due a fetch, so no other server
  // fetches them: only live, scheduled datasets some deck uses
  async claimDueDatasets(limit, leaseSeconds) {
    const { rows } = await this.query(
      `UPDATE datasets SET fetch_lease_until = NOW() + make_interval(secs => $2)
        WHERE id IN (
          SELECT d.id FROM datasets d
           WHERE d.source_kind <> 'upload' AND d.schedule <> 'manual'
             AND d.next_fetch_at <= NOW()
             AND (d.fetch_lease_until IS NULL OR d.fetch_lease_until < NOW())
             AND EXISTS (SELECT 1 FROM presentation_datasets pd WHERE pd.dataset_id = d.id)
           ORDER BY d.next_fetch_at LIMIT $1
           FOR UPDATE SKIP LOCKED)
        RETURNING id`,
      [limit, leaseSeconds]
    )
    return rows.map(r => r.id)
  }

  // A fetch's lease for a refresh started outside the loop (Refresh now):
  // false when one is already running
  async leaseDataset(id, leaseSeconds) {
    const { rowCount } = await this.query(
      `UPDATE datasets SET fetch_lease_until = NOW() + make_interval(secs => $2)
        WHERE id = $1 AND (fetch_lease_until IS NULL OR fetch_lease_until < NOW())`,
      [id, leaseSeconds]
    )
    return rowCount > 0
  }

  // Records how a fetch went, sets the next one, and gives up the lease
  async recordFetchState(id, { fetched, lastError, failures, nextFetchAt }) {
    await this.query(
      `UPDATE datasets SET last_error = $2, failures = $3, next_fetch_at = $4, fetch_lease_until = NULL,
              last_fetched_at = CASE WHEN $5 THEN NOW() ELSE last_fetched_at END
        WHERE id = $1`,
      [id, lastError || null, failures, nextFetchAt, !!fetched]
    )
  }

  async recordFetch(datasetId, f) {
    await this.query(
      `INSERT INTO dataset_fetches (dataset_id, started_at, duration_ms, outcome, http_status, bytes, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [datasetId, f.startedAt, f.durationMs, f.outcome, f.httpStatus || null, f.bytes ?? null, f.error || null]
    )
  }

  async listDatasetFetches(datasetId, limit = 50) {
    const { rows } = await this.query(
      'SELECT * FROM dataset_fetches WHERE dataset_id = $1 ORDER BY started_at DESC, id DESC LIMIT $2',
      [datasetId, limit]
    )
    return rows.map(r => ({
      startedAt: r.started_at, durationMs: r.duration_ms, outcome: r.outcome,
      httpStatus: r.http_status, bytes: r.bytes == null ? null : Number(r.bytes), error: r.error,
    }))
  }

  async pruneDatasetFetches(days) {
    const { rowCount } = await this.query('DELETE FROM dataset_fetches WHERE started_at < NOW() - make_interval(days => $1)', [days])
    return rowCount
  }

  async linkDatasetToPresentation(presentationId, datasetId, alias) {
    await this.query(
      `INSERT INTO presentation_datasets (presentation_id, dataset_id, alias) VALUES ($1, $2, $3)
       ON CONFLICT (presentation_id, dataset_id) DO UPDATE SET alias = $3`,
      [presentationId, datasetId, alias || null]
    )
  }

  async unlinkDatasetFromPresentation(presentationId, datasetId) {
    await this.query('DELETE FROM presentation_datasets WHERE presentation_id = $1 AND dataset_id = $2', [presentationId, datasetId])
  }

  async getPresentationDatasets(presentationId) {
    const { rows } = await this.query(
      `SELECT ${DATASET_FIELDS}, pd.alias, pd.pinned_version_id
       FROM datasets d INNER JOIN presentation_datasets pd ON pd.dataset_id = d.id
       WHERE pd.presentation_id = $1 ORDER BY d.name`,
      [presentationId]
    )
    return rows.map(r => ({ ...datasetFrom(r, { withKey: true }), alias: r.alias, pinnedVersionId: r.pinned_version_id }))
  }
}

// The dataset fields every query reads; the secret itself never leaves here
// but through getDatasetForFetch
const DATASET_FIELDS = `d.id, d.name, d.filename, d.format, d.storage_key, d.columns, d.row_count, d.byte_size,
  d.created_at, d.updated_at, d.source_kind, d.source, d.source_secret IS NOT NULL AS has_secret, d.schedule,
  d.next_fetch_at, d.last_fetched_at, d.last_error, d.failures, d.current_version_id, d.transforms, d.output_columns`

// columns are what a read gives: the transforms' output when it has
// transforms, else the source's (sourceColumns, either way)
function datasetFrom(r, { withKey = false } = {}) {
  const transformed = (r.transforms || []).length > 0 && Array.isArray(r.output_columns)
  const ds = {
    id: r.id, name: r.name, filename: r.filename, format: r.format,
    columns: transformed ? r.output_columns : r.columns, sourceColumns: r.columns,
    rowCount: r.row_count, byteSize: r.byte_size == null ? null : Number(r.byte_size), createdAt: r.created_at, updatedAt: r.updated_at,
    sourceKind: r.source_kind, source: r.source, hasSecret: !!r.has_secret, schedule: r.schedule,
    nextFetchAt: r.next_fetch_at, lastFetchedAt: r.last_fetched_at, lastError: r.last_error, failures: r.failures,
    currentVersionId: r.current_version_id, transforms: r.transforms || [],
  }
  if (withKey) ds.storageKey = r.storage_key
  return ds
}

function versionFrom(r) {
  return {
    id: r.id, datasetId: r.dataset_id, storageKey: r.storage_key, format: r.format, contentHash: r.content_hash,
    columns: r.columns, rowCount: r.row_count, byteSize: Number(r.byte_size), etag: r.etag, lastModified: r.last_modified,
    createdAt: r.created_at,
  }
}

module.exports = PgStorage

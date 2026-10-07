// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const path = require('path')
const fs = require('fs-extra')
const { v4: uuidv4 } = require('uuid')
const StorageInterface = require('./interface')
const { encrypt, decrypt } = require('../utils/crypto')

class FileStorage extends StorageInterface {
  constructor(dataDir) {
    super()
    this.dataDir = dataDir
    this.dataFile = path.join(dataDir, 'presentations.json')
    this.templatesFile = path.join(dataDir, 'templates.json')
    this.shareFile = path.join(dataDir, 'share-tokens.json')
    this.githubConfigFile = path.join(dataDir, 'github-config.json')
    this.historyDir = path.join(dataDir, 'history')

    fs.ensureDirSync(dataDir)
    fs.ensureDirSync(this.historyDir)
    if (!fs.existsSync(this.dataFile)) fs.writeJsonSync(this.dataFile, [])
    if (!fs.existsSync(this.templatesFile)) fs.writeJsonSync(this.templatesFile, [])
    if (!fs.existsSync(this.shareFile)) fs.writeJsonSync(this.shareFile, {})
    if (!fs.existsSync(this.githubConfigFile)) fs.writeJsonSync(this.githubConfigFile, { token: '', owner: '', repo: '' })
  }

  async _readAll() { return fs.readJson(this.dataFile) }
  async _writeAll(data) { return fs.writeJson(this.dataFile, data, { spaces: 2 }) }
  async _readTemplates() { return fs.readJson(this.templatesFile) }
  async _writeTemplates(data) { return fs.writeJson(this.templatesFile, data, { spaces: 2 }) }
  async _readTokens() { return fs.readJson(this.shareFile) }
  async _writeTokens(data) { return fs.writeJson(this.shareFile, data, { spaces: 2 }) }

  _summary(p) {
    return { id: p.id, title: p.title, theme: p.theme, transition: p.transition, slideCount: (p.slides || []).length, updatedAt: p.updatedAt, createdAt: p.createdAt, thumbnail: (p.slides && p.slides[0]) ? p.slides[0].background : null }
  }

  async listPresentations() {
    return (await this._readAll()).map(p => this._summary(p))
  }
  async getPresentation(id) {
    return (await this._readAll()).find(p => p.id === id) || null
  }
  async createPresentation(data) {
    const now = new Date().toISOString()
    const pres = { ...data, id: data.id || uuidv4(), createdAt: now, updatedAt: now }
    const all = await this._readAll()
    all.push(pres)
    await this._writeAll(all)
    return pres
  }
  async updatePresentation(id, data) {
    const all = await this._readAll()
    const i = all.findIndex(p => p.id === id)
    if (i === -1) return null
    all[i] = { ...all[i], ...data, id, updatedAt: new Date().toISOString() }
    await this._writeAll(all)
    return all[i]
  }
  async deletePresentation(id) {
    const all = await this._readAll()
    const i = all.findIndex(p => p.id === id)
    if (i === -1) return false
    all.splice(i, 1)
    await this._writeAll(all)
    return true
  }
  async duplicatePresentation(id) {
    const all = await this._readAll()
    const orig = all.find(p => p.id === id)
    if (!orig) return null
    const now = new Date().toISOString()
    const copy = { ...JSON.parse(JSON.stringify(orig)), id: uuidv4(), title: (orig.title || 'Untitled') + ' (copy)', createdAt: now, updatedAt: now }
    all.push(copy)
    await this._writeAll(all)
    return copy
  }

  async listTemplates() {
    return (await this._readTemplates()).map(t => this._summary(t))
  }
  async getTemplate(id) {
    return (await this._readTemplates()).find(t => t.id === id) || null
  }
  async createTemplate(data) {
    const now = new Date().toISOString()
    const tmpl = { ...data, id: uuidv4(), isTemplate: true, createdAt: now, updatedAt: now }
    const all = await this._readTemplates()
    all.push(tmpl)
    await this._writeTemplates(all)
    return tmpl
  }
  async updateTemplate(id, data) {
    const all = await this._readTemplates()
    const i = all.findIndex(t => t.id === id)
    if (i === -1) return null
    all[i] = { ...all[i], ...data, id, updatedAt: new Date().toISOString() }
    await this._writeTemplates(all)
    return all[i]
  }
  async deleteTemplate(id) {
    const all = await this._readTemplates()
    const i = all.findIndex(t => t.id === id)
    if (i === -1) return false
    all.splice(i, 1)
    await this._writeTemplates(all)
    return true
  }
  async saveAsTemplate(presentationId, title) {
    const stored = await this.getPresentation(presentationId)
    if (!stored) return null
    // Without present-mode ink or practice runs, which are private to this presentation
    const { annotationSets, practiceRuns, ...pres } = stored
    const now = new Date().toISOString()
    const tmpl = { ...JSON.parse(JSON.stringify(pres)), id: uuidv4(), title: (title || pres.title || 'Untitled') + ' (template)', isTemplate: true, createdAt: now, updatedAt: now }
    const all = await this._readTemplates()
    all.push(tmpl)
    await this._writeTemplates(all)
    return tmpl
  }

  async createShareToken(presentationId) {
    if (!(await this.getPresentation(presentationId))) return null
    const tokens = await this._readTokens()
    let token = Object.entries(tokens).find(([, id]) => id === presentationId)?.[0]
    if (!token) { token = uuidv4(); tokens[token] = presentationId; await this._writeTokens(tokens) }
    return { token, shared: true }
  }
  async deleteShareToken(presentationId) {
    const tokens = await this._readTokens()
    for (const [t, id] of Object.entries(tokens)) { if (id === presentationId) delete tokens[t] }
    await this._writeTokens(tokens)
    return { shared: false }
  }
  async getShareStatus(presentationId) {
    const tokens = await this._readTokens()
    const entry = Object.entries(tokens).find(([, id]) => id === presentationId)
    return { shared: !!entry, token: entry ? entry[0] : null }
  }
  // One user's files: datasets aren't looked up by owner
  async getPresentationOwner() {
    return null
  }

  async getSharedPresentation(token) {
    const tokens = await this._readTokens()
    const pid = tokens[token]
    if (!pid) return null
    return this.getPresentation(pid)
  }

  async createSnapshot(presentationId, name) {
    const stored = await this.getPresentation(presentationId)
    if (!stored) return null
    // A version is the slides; present-mode ink and practice runs aren't part of it
    const { annotationSets, practiceRuns, ...pres } = stored
    const dir = path.join(this.historyDir, presentationId)
    fs.ensureDirSync(dir)
    const id = uuidv4()
    const snap = { id, name: name || new Date().toISOString(), createdAt: new Date().toISOString(), data: JSON.parse(JSON.stringify(pres)) }
    fs.writeJsonSync(path.join(dir, `${id}.json`), snap, { spaces: 2 })
    return { id, name: snap.name, createdAt: snap.createdAt }
  }
  async listSnapshots(presentationId) {
    const dir = path.join(this.historyDir, presentationId)
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => {
      const s = fs.readJsonSync(path.join(dir, f))
      return { id: s.id, name: s.name, createdAt: s.createdAt, slideCount: (s.data?.slides || []).length }
    }).reverse()
  }
  async restoreSnapshot(presentationId, snapshotId) {
    const file = path.join(this.historyDir, presentationId, `${snapshotId}.json`)
    if (!fs.existsSync(file)) return null
    const snap = fs.readJsonSync(file)
    // The presentation keeps its present-mode ink and practice runs, which aren't part of a version
    const { annotationSets, practiceRuns, ...restored } = snap.data || {}
    return this.updatePresentation(presentationId, restored)
  }
  async deleteSnapshot(presentationId, snapshotId) {
    const file = path.join(this.historyDir, presentationId, `${snapshotId}.json`)
    if (fs.existsSync(file)) fs.removeSync(file)
    return true
  }

  async getGithubConfig() {
    const config = await fs.readJson(this.githubConfigFile)
    return { ...config, token: decrypt(config.token || '') }
  }
  async setGithubConfig(config) {
    const existing = await this.getGithubConfig()
    const updated = { ...existing, ...config }
    const toStore = { ...updated, token: encrypt(updated.token || '') }
    await fs.writeJson(this.githubConfigFile, toStore, { spaces: 2 })
    return updated
  }

  async getZoteroConfig() {
    const file = path.join(this.dataDir, 'zotero-config.json')
    if (!fs.existsSync(file)) return { zoteroUserId: '', apiKey: '' }
    const config = await fs.readJson(file)
    return { zoteroUserId: config.zoteroUserId || '', apiKey: decrypt(config.apiKey || '') }
  }
  async setZoteroConfig(config) {
    const file = path.join(this.dataDir, 'zotero-config.json')
    const toStore = { zoteroUserId: config.zoteroUserId || '', apiKey: encrypt(config.apiKey || '') }
    await fs.writeJson(file, toStore, { spaces: 2 })
    return { zoteroUserId: config.zoteroUserId || '', apiKey: config.apiKey || '' }
  }

  // --- Plugins (self-hosted: directory-scanned, no marketplace) ---

  _pluginsDir() {
    const dir = path.join(this.dataDir, 'plugins')
    fs.ensureDirSync(dir)
    return dir
  }

  _pluginStorageFile() {
    const file = path.join(this.dataDir, 'plugin-storage.json')
    if (!fs.existsSync(file)) fs.writeJsonSync(file, {})
    return file
  }

  _presPluginsFile() {
    const file = path.join(this.dataDir, 'presentation-plugins.json')
    if (!fs.existsSync(file)) fs.writeJsonSync(file, {})
    return file
  }

  _bundledPluginsDir() {
    return path.join(__dirname, '..', '..', 'plugins')
  }

  _scanPluginDir(dir) {
    if (!fs.existsSync(dir)) return []
    const entries = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory())
    const plugins = []
    for (const entry of entries) {
      const manifestPath = path.join(dir, entry.name, 'parallax-plugin.json')
      if (!fs.existsSync(manifestPath)) continue
      const manifest = fs.readJsonSync(manifestPath)
      plugins.push({ id: manifest.id, slug: entry.name, name: manifest.name, description: manifest.description, version: manifest.version, manifest, _dir: dir })
    }
    return plugins
  }

  async listPlugins() {
    const user = this._scanPluginDir(this._pluginsDir())
    const bundled = this._scanPluginDir(this._bundledPluginsDir())
    const seen = new Set(user.map(p => p.slug))
    return [...user, ...bundled.filter(p => !seen.has(p.slug))]
  }

  async getPlugin(slug) {
    for (const dir of [this._pluginsDir(), this._bundledPluginsDir()]) {
      const manifestPath = path.join(dir, slug, 'parallax-plugin.json')
      if (!fs.existsSync(manifestPath)) continue
      const manifest = fs.readJsonSync(manifestPath)
      return { id: manifest.id, slug, name: manifest.name, description: manifest.description, version: manifest.version, manifest, _dir: dir }
    }
    return null
  }

  async installPlugin() {}
  async uninstallPlugin() {}
  async getInstalledPlugins() { return this.listPlugins() }

  async getPresentationPlugins(presentationId) {
    const mapping = fs.readJsonSync(this._presPluginsFile())
    const slugs = mapping[presentationId] || []
    const all = await this.listPlugins()
    return all.filter(p => slugs.includes(p.slug))
  }

  async enablePluginForPresentation(presentationId, pluginId) {
    const mapping = fs.readJsonSync(this._presPluginsFile())
    const list = mapping[presentationId] || []
    if (!list.includes(pluginId)) list.push(pluginId)
    mapping[presentationId] = list
    fs.writeJsonSync(this._presPluginsFile(), mapping, { spaces: 2 })
  }

  async disablePluginForPresentation(presentationId, pluginId) {
    const mapping = fs.readJsonSync(this._presPluginsFile())
    mapping[presentationId] = (mapping[presentationId] || []).filter(s => s !== pluginId)
    fs.writeJsonSync(this._presPluginsFile(), mapping, { spaces: 2 })
  }

  async getPluginStorage(userId, pluginId, key) {
    const store = fs.readJsonSync(this._pluginStorageFile())
    return store[`${userId}:${pluginId}:${key}`] ?? null
  }

  async setPluginStorage(userId, pluginId, key, value) {
    const store = fs.readJsonSync(this._pluginStorageFile())
    store[`${userId}:${pluginId}:${key}`] = value
    fs.writeJsonSync(this._pluginStorageFile(), store, { spaces: 2 })
  }

  async deletePluginStorage(userId, pluginId, key) {
    const store = fs.readJsonSync(this._pluginStorageFile())
    delete store[`${userId}:${pluginId}:${key}`]
    fs.writeJsonSync(this._pluginStorageFile(), store, { spaces: 2 })
  }

  // --- Datasets ---

  _datasetsFile() {
    const file = path.join(this.dataDir, 'datasets.json')
    if (!fs.existsSync(file)) fs.writeJsonSync(file, [])
    return file
  }

  _presDatasetLinksFile() {
    const file = path.join(this.dataDir, 'presentation-datasets.json')
    if (!fs.existsSync(file)) fs.writeJsonSync(file, {})
    return file
  }

  _readDatasets() { return fs.readJsonSync(this._datasetsFile()) }
  _writeDatasets(all) { fs.writeJsonSync(this._datasetsFile(), all, { spaces: 2 }) }

  // A dataset entry as callers see it: no versions, fetch log or secret
  _publicDataset(ds, { withKey = true } = {}) {
    const { versions, fetches, sourceSecret, fetchLeaseUntil, storageKey, outputColumns, ...rest } = ds
    const out = {
      sourceKind: 'upload', source: null, schedule: 'manual', nextFetchAt: null, lastFetchedAt: null,
      lastError: null, failures: 0, currentVersionId: null, transforms: [], ...rest, hasSecret: !!sourceSecret,
    }
    // What a read gives: the transforms' columns when it has transforms
    out.sourceColumns = ds.columns
    if (out.transforms.length && Array.isArray(outputColumns)) out.columns = outputColumns
    if (withKey) out.storageKey = storageKey
    return out
  }

  async createDataset(data) {
    const all = this._readDatasets()
    const existing = all.findIndex(d => d.name === data.name)
    const now = new Date().toISOString()
    const ds = { id: uuidv4(), ...data, createdAt: now, updatedAt: now }
    if (existing >= 0) {
      all[existing] = { ...all[existing], ...data, updatedAt: now }
      this._writeDatasets(all)
      return this._publicDataset(all[existing])
    }
    all.push(ds)
    this._writeDatasets(all)
    return this._publicDataset(ds)
  }

  async createLiveDataset(data) {
    const all = this._readDatasets()
    if (all.some(d => d.name === data.name)) throw Object.assign(new Error(`You already have a dataset named "${data.name}"`), { code: 'duplicate' })
    const now = new Date().toISOString()
    const ds = {
      id: uuidv4(), name: data.name, filename: data.filename, format: 'columns', storageKey: '', columns: [], rowCount: 0, byteSize: 0,
      sourceKind: data.sourceKind, source: data.source, sourceSecret: data.sourceSecret ? encrypt(data.sourceSecret) : null,
      schedule: data.schedule, nextFetchAt: data.nextFetchAt, lastFetchedAt: now, lastError: null, failures: 0,
      currentVersionId: null, transforms: [], versions: [], fetches: [], createdAt: now, updatedAt: now,
    }
    all.push(ds)
    this._writeDatasets(all)
    return this._publicDataset(ds)
  }

  async listDatasets() {
    return this._readDatasets().map(d => this._publicDataset(d, { withKey: false }))
  }

  async getDataset(id) {
    const ds = this._readDatasets().find(d => d.id === id)
    return ds ? this._publicDataset(ds) : null
  }

  async getDatasetByName(name) {
    const ds = this._readDatasets().find(d => d.name === name)
    return ds ? this._publicDataset(ds) : null
  }

  async getDatasetForFetch(id) {
    const ds = this._readDatasets().find(d => d.id === id)
    if (!ds) return null
    return { ...this._publicDataset(ds), userId: null, plan: null, secret: ds.sourceSecret ? decrypt(ds.sourceSecret) : '' }
  }

  // Changes one dataset entry in place; returns it, or null
  _changeDataset(id, change) {
    const all = this._readDatasets()
    const ds = all.find(d => d.id === id)
    if (!ds) return null
    change(ds)
    this._writeDatasets(all)
    return ds
  }

  async updateDataset(id, data) {
    const ds = this._changeDataset(id, d => {
      if (data.name) d.name = data.name
      d.updatedAt = new Date().toISOString()
    })
    return ds ? this._publicDataset(ds) : null
  }

  async updateDatasetSource(id, userId, { source, sourceSecret, schedule, nextFetchAt }) {
    const ds = this._changeDataset(id, d => {
      if (!d.sourceKind || d.sourceKind === 'upload') return
      if (source !== undefined) d.source = source
      if (sourceSecret !== undefined) d.sourceSecret = sourceSecret ? encrypt(sourceSecret) : null
      if (schedule !== undefined) d.schedule = schedule
      if (nextFetchAt !== undefined) d.nextFetchAt = nextFetchAt
      d.failures = 0
      d.updatedAt = new Date().toISOString()
    })
    return ds ? this._publicDataset(ds) : null
  }

  async setDatasetTransforms(id, userId, transforms, outputColumns) {
    const ds = this._changeDataset(id, d => {
      d.transforms = transforms
      d.outputColumns = outputColumns || null
      d.updatedAt = new Date().toISOString()
    })
    return ds ? this._publicDataset(ds) : null
  }

  async setOutputColumns(id, outputColumns) {
    this._changeDataset(id, d => { d.outputColumns = outputColumns || null })
  }

  async countLiveDatasets() {
    return this._readDatasets().filter(d => d.sourceKind && d.sourceKind !== 'upload').length
  }

  async deleteDataset(id) {
    const all = this._readDatasets()
    const i = all.findIndex(d => d.id === id)
    if (i === -1) return null
    const [ds] = all.splice(i, 1)
    this._writeDatasets(all)
    const links = fs.readJsonSync(this._presDatasetLinksFile())
    for (const pid of Object.keys(links)) links[pid] = links[pid].filter(l => l.datasetId !== id)
    fs.writeJsonSync(this._presDatasetLinksFile(), links, { spaces: 2 })
    const keys = new Set((ds.versions || []).map(v => v.storageKey))
    if (ds.storageKey) keys.add(ds.storageKey)
    return { ...this._publicDataset(ds), storageKeys: [...keys].filter(Boolean) }
  }

  // --- Dataset versions ---

  async createDatasetVersion(datasetId, v) {
    const version = {
      id: uuidv4(), datasetId, storageKey: v.storageKey, format: v.format, contentHash: v.contentHash || null,
      columns: v.columns || [], rowCount: v.rowCount, byteSize: v.byteSize || 0, etag: v.etag || null,
      lastModified: v.lastModified || null, createdAt: new Date().toISOString(),
    }
    this._changeDataset(datasetId, d => { d.versions = [version, ...(d.versions || [])] })
    return version
  }

  async setCurrentVersion(datasetId, version) {
    this._changeDataset(datasetId, d => {
      Object.assign(d, {
        currentVersionId: version.id, storageKey: version.storageKey, format: version.format, columns: version.columns,
        rowCount: version.rowCount, byteSize: version.byteSize, updatedAt: new Date().toISOString(),
      })
    })
  }

  async listDatasetVersions(datasetId) {
    const ds = this._readDatasets().find(d => d.id === datasetId)
    if (!ds) return []
    const links = fs.readJsonSync(this._presDatasetLinksFile())
    return (ds.versions || []).map(v => ({
      ...v,
      pinnedBy: Object.keys(links).filter(pid => links[pid].some(l => l.datasetId === datasetId && l.pinnedVersionId === v.id)),
    }))
  }

  async getDatasetVersion(datasetId, versionId) {
    const ds = this._readDatasets().find(d => d.id === datasetId)
    return (ds?.versions || []).find(v => v.id === versionId) || null
  }

  async deleteDatasetVersions(datasetId, versionIds) {
    const gone = []
    this._changeDataset(datasetId, d => {
      d.versions = (d.versions || []).filter(v => {
        if (!versionIds.includes(v.id)) return true
        gone.push(v.storageKey)
        return false
      })
    })
    const links = fs.readJsonSync(this._presDatasetLinksFile())
    for (const pid of Object.keys(links)) {
      for (const l of links[pid]) if (l.datasetId === datasetId && versionIds.includes(l.pinnedVersionId)) l.pinnedVersionId = null
    }
    fs.writeJsonSync(this._presDatasetLinksFile(), links, { spaces: 2 })
    return gone
  }

  async setPinnedVersion(presentationId, datasetId, versionId) {
    const links = fs.readJsonSync(this._presDatasetLinksFile())
    const link = (links[presentationId] || []).find(l => l.datasetId === datasetId)
    if (!link) return
    link.pinnedVersionId = versionId || null
    fs.writeJsonSync(this._presDatasetLinksFile(), links, { spaces: 2 })
  }

  // --- Refreshing live datasets ---
  // One server reads these files, so a lease only keeps the loop from
  // starting a dataset's fetch twice

  async claimDueDatasets(limit, leaseSeconds) {
    const now = Date.now()
    const links = fs.readJsonSync(this._presDatasetLinksFile())
    const linked = new Set(Object.values(links).flat().map(l => l.datasetId))
    const claimed = []
    const all = this._readDatasets()
    const due = all
      .filter(d => d.sourceKind && d.sourceKind !== 'upload' && d.schedule !== 'manual' && linked.has(d.id)
        && d.nextFetchAt && Date.parse(d.nextFetchAt) <= now && !(d.fetchLeaseUntil && Date.parse(d.fetchLeaseUntil) > now))
      .sort((a, b) => Date.parse(a.nextFetchAt) - Date.parse(b.nextFetchAt))
      .slice(0, limit)
    for (const d of due) {
      d.fetchLeaseUntil = new Date(now + leaseSeconds * 1000).toISOString()
      claimed.push(d.id)
    }
    if (claimed.length) this._writeDatasets(all)
    return claimed
  }

  async leaseDataset(id, leaseSeconds) {
    let leased = false
    this._changeDataset(id, d => {
      if (d.fetchLeaseUntil && Date.parse(d.fetchLeaseUntil) > Date.now()) return
      d.fetchLeaseUntil = new Date(Date.now() + leaseSeconds * 1000).toISOString()
      leased = true
    })
    return leased
  }

  async recordFetchState(id, { fetched, lastError, failures, nextFetchAt }) {
    this._changeDataset(id, d => {
      d.lastError = lastError || null
      d.failures = failures
      d.nextFetchAt = nextFetchAt
      d.fetchLeaseUntil = null
      if (fetched) d.lastFetchedAt = new Date().toISOString()
    })
  }

  async recordFetch(datasetId, f) {
    this._changeDataset(datasetId, d => {
      const entry = {
        startedAt: f.startedAt, durationMs: f.durationMs, outcome: f.outcome,
        httpStatus: f.httpStatus || null, bytes: f.bytes ?? null, error: f.error || null,
      }
      d.fetches = [entry, ...(d.fetches || [])].slice(0, 50)
    })
  }

  async listDatasetFetches(datasetId, limit = 50) {
    const ds = this._readDatasets().find(d => d.id === datasetId)
    return (ds?.fetches || []).slice(0, limit)
  }

  async pruneDatasetFetches(days) {
    const cutoff = Date.now() - days * 86400000
    let pruned = 0
    const all = this._readDatasets()
    for (const d of all) {
      const kept = (d.fetches || []).filter(f => Date.parse(f.startedAt) >= cutoff)
      pruned += (d.fetches || []).length - kept.length
      d.fetches = kept
    }
    if (pruned) this._writeDatasets(all)
    return pruned
  }

  async linkDatasetToPresentation(presentationId, datasetId, alias) {
    const links = fs.readJsonSync(this._presDatasetLinksFile())
    if (!links[presentationId]) links[presentationId] = []
    const existing = links[presentationId].findIndex(l => l.datasetId === datasetId)
    if (existing >= 0) {
      links[presentationId][existing].alias = alias || null
    } else {
      links[presentationId].push({ datasetId, alias: alias || null, pinnedVersionId: null })
    }
    fs.writeJsonSync(this._presDatasetLinksFile(), links, { spaces: 2 })
  }

  async unlinkDatasetFromPresentation(presentationId, datasetId) {
    const links = fs.readJsonSync(this._presDatasetLinksFile())
    if (!links[presentationId]) return
    links[presentationId] = links[presentationId].filter(l => l.datasetId !== datasetId)
    fs.writeJsonSync(this._presDatasetLinksFile(), links, { spaces: 2 })
  }

  async getPresentationDatasets(presentationId) {
    const links = fs.readJsonSync(this._presDatasetLinksFile())
    const presLinks = links[presentationId] || []
    const all = this._readDatasets()
    return presLinks.map(l => {
      const ds = all.find(d => d.id === l.datasetId)
      if (!ds) return null
      return { ...this._publicDataset(ds), alias: l.alias, pinnedVersionId: l.pinnedVersionId || null }
    }).filter(Boolean)
  }
}

module.exports = FileStorage

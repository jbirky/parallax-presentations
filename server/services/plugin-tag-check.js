// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Each night, the listed community plugins' repos are asked for version
// tags newer than any version imported, and each new one is imported for
// review (services/plugin-import.js, services/community-plugins.js), so an
// author needn't come back to Publish after pushing a tag. An import goes
// under the name of whoever imported the plugin's newest version, so it's
// in their imports, and is marked as the check's (migration 022). A tag that
// breaks the rules is left, and said so in the run's summary for /admin.
// GitHub allows 60 API calls an hour without GITHUB_PLUGIN_TOKEN: a plugin
// with nothing new takes 2, and each new version 1 more; a run that meets
// the limit stops there.

const pluginImport = require('./plugin-import')
const communityPlugins = require('./community-plugins')

const { compareVersions } = pluginImport

// The last run, as /admin shows it: { startedAt, finishedAt, checked,
// imported: [{ slug, version }], refused: [{ slug, tag, error, problems }],
// error }, or null before the first
let lastRun = null
let running = null

async function hasCheckColumn(storage) {
  const { rows: [{ ok }] } = await storage.query(
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plugin_versions' AND column_name = 'found_by_check') AS ok")
  return ok
}

async function run(storage, { reservedTypes, fetcher, maxPerPlugin, log }) {
  const result = { startedAt: new Date().toISOString(), finishedAt: null, checked: 0, imported: [], refused: [], error: null }
  try {
    if (!(await communityPlugins.hasTables(storage)) || !(await hasCheckColumn(storage))) {
      result.error = 'The check for new versions needs migrations 021 and 022 on this server’s database'
      return result
    }
    const { rows: plugins } = await storage.query(
      `SELECT p.slug, p.repo_owner AS owner, p.repo_name AS repo,
              COALESCE((SELECT json_agg(json_build_object('version', v.version, 'submittedBy', v.submitted_by)) FROM plugin_versions v WHERE v.plugin_id = p.id), '[]') AS versions
         FROM plugins p WHERE p.published AND p.repo_owner IS NOT NULL ORDER BY p.slug`)
    for (const p of plugins) {
      const known = p.versions
      const newest = known.map(v => v.version).sort(compareVersions).pop()
      let repo
      try {
        repo = await pluginImport.lookupRepo(`${p.owner}/${p.repo}`, { fetcher })
      } catch (err) {
        if (err.status === 429) throw err
        result.refused.push({ slug: p.slug, tag: null, error: err.message })
        continue
      }
      result.checked++
      // Versions newer than any imported; the newest few when there are many
      const fresh = repo.tags
        .filter(t => !known.some(k => k.version === t.version) && (!newest || compareVersions(t.version, newest) > 0))
        .sort((a, b) => compareVersions(a.version, b.version))
        .slice(-maxPerPlugin)
      const lastImporter = known.filter(k => k.submittedBy).sort((a, b) => compareVersions(a.version, b.version)).pop()
      for (const tag of fresh) {
        try {
          const fetched = await pluginImport.fetchVersion(`${repo.owner}/${repo.repo}`, tag.name, { fetcher, repo })
          const saved = await communityPlugins.saveVersion(storage, fetched, { submittedBy: lastImporter?.submittedBy || null, reservedTypes, foundByCheck: true })
          result.imported.push({ slug: p.slug, version: saved.version })
        } catch (err) {
          if (err.status === 429) throw err
          result.refused.push({ slug: p.slug, tag: tag.name, error: err.message, ...(err.problems && { problems: err.problems }) })
        }
      }
    }
  } catch (err) {
    result.error = err.message
    log.error(`The check for new plugin versions stopped: ${err.message}`)
  } finally {
    result.finishedAt = new Date().toISOString()
  }
  return result
}

// Runs the check, unless one is running already (then resolves to that
// one's result). reservedTypes: the element types the server's plugin
// folders have; fetcher: for tests.
function checkPluginTags(storage, { reservedTypes = new Map(), fetcher, maxPerPlugin = 3, log = console } = {}) {
  if (!running) {
    running = run(storage, { reservedTypes, fetcher, maxPerPlugin, log })
      .then(result => {
        lastRun = result
        if (result.imported.length) log.log(`Imported ${result.imported.map(i => `${i.slug} ${i.version}`).join(', ')} for review`)
        return result
      })
      .finally(() => { running = null })
  }
  return running
}

// Runs `task` each day at hour:minute, server time; returns a stop function
function scheduleNightly(task, { hour = 3, minute = 30 } = {}) {
  let timer = null
  const next = () => {
    const now = new Date()
    const at = new Date(now)
    at.setHours(hour, minute, 0, 0)
    if (at <= now) at.setDate(at.getDate() + 1)
    timer = setTimeout(() => {
      Promise.resolve().then(task).catch(() => {}).finally(next)
    }, at - now)
    timer.unref?.()
  }
  next()
  return () => clearTimeout(timer)
}

module.exports = { checkPluginTags, scheduleNightly, lastCheck: () => lastRun, checkRunning: () => !!running }

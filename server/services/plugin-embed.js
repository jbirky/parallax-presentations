// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Plugin elements' sandbox pages for the pages the server builds (shared,
// live and exported presentations), which client/src/plugins/pluginEmbed.js
// fills with the element's data through server/services/deck-html.js.

const fs = require('fs')
const path = require('path')

// Returns a lookup from plugin ID to its sandbox page, searching the given
// plugin folders in order (user-installed first, like the assets route). Each
// lookup reads the folders once, so use one per render.
function createSandboxLookup(pluginDirs) {
  let byId = null
  const index = () => {
    byId = new Map()
    for (const dir of pluginDirs) {
      let entries = []
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        try {
          const manifest = JSON.parse(fs.readFileSync(path.join(dir, entry.name, 'parallax-plugin.json'), 'utf8'))
          if (!manifest.id || typeof manifest.sandbox !== 'string' || byId.has(manifest.id)) continue
          // Like the assets route, never read outside the plugin's dist folder
          const distDir = path.resolve(dir, entry.name, 'dist')
          const file = path.resolve(distDir, manifest.sandbox)
          if (!file.startsWith(distDir + path.sep)) continue
          byId.set(manifest.id, file)
        } catch { /* not a plugin folder */ }
      }
    }
  }
  const cache = new Map()
  return (pluginId) => {
    if (cache.has(pluginId)) return cache.get(pluginId)
    if (!byId) index()
    let html = null
    const file = byId.get(pluginId)
    if (file) { try { html = fs.readFileSync(file, 'utf8') } catch { /* missing sandbox */ } }
    cache.set(pluginId, html)
    return html
  }
}

module.exports = { createSandboxLookup }

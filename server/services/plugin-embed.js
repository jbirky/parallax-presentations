// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Plugin elements' sandbox pages for the pages the server builds (shared,
// live and exported presentations), which client/src/plugins/pluginEmbed.js
// fills with the element's data through server/services/deck-html.js.
// Bundled and folder plugins' pages come from their folders; community
// plugins' from the database (services/community-plugins.js), each with a
// CSP that keeps it to the hosts its manifest names.

const fs = require('fs')
const path = require('path')

// A host a community plugin may reach, as its manifest names it after
// "network:": a name with at least one dot, or *. and one
const NETWORK_HOST_RE = /^(\*\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/

// The https origins a manifest's permissions name
function networkHosts(permissions) {
  return (Array.isArray(permissions) ? permissions : [])
    .filter(p => typeof p === 'string' && p.startsWith('network:'))
    .map(p => p.slice('network:'.length).toLowerCase())
    .filter(host => NETWORK_HOST_RE.test(host))
    .map(host => `https://${host}`)
}

// What a community plugin's page may load and reach: inline code, data and
// blob URLs, and the hosts its permissions name, nothing else
function pluginCsp(permissions) {
  const hosts = networkHosts(permissions).join(' ')
  const plus = base => [base, hosts].filter(Boolean).join(' ')
  return [
    "default-src 'none'",
    `script-src ${plus("'unsafe-inline' 'unsafe-eval' blob: data:")}`,
    `style-src ${plus("'unsafe-inline'")}`,
    `img-src ${plus('data: blob:')}`,
    `font-src ${plus('data:')}`,
    `media-src ${plus('data: blob:')}`,
    `connect-src ${hosts || "'none'"}`,
    'worker-src blob:',
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
}

// A community plugin's sandbox page with its CSP as the first tag, after
// only a byte order mark, comments and the doctype, so none of the page's
// own scripts runs before it. A <meta> CSP can only add rules, so one the
// page brings itself can't loosen it.
function withPluginCsp(html, permissions) {
  const text = String(html)
  const lead = text.match(/^\uFEFF?(?:\s|<!--[\s\S]*?-->)*(?:<!doctype[^>]*>)?/i)[0]
  const meta = `<meta http-equiv="Content-Security-Policy" content="${pluginCsp(permissions)}">`
  return text.slice(0, lead.length) + meta + text.slice(lead.length)
}

// Shown in a community plugin element's place when its version can't be
// served (withdrawn, or never approved)
const WITHDRAWN_PAGE = '<!DOCTYPE html><html><head><style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;font:13px sans-serif;color:rgba(128,128,128,0.9);background:rgba(128,128,128,0.08);text-align:center;}</style></head><body>This plugin isn\u2019t available</body></html>'

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

// The element types the plugins in the given folders have: Map of type ->
// plugin id. A community plugin can't take one (services/community-plugins.js).
function folderPluginTypes(pluginDirs) {
  const types = new Map()
  for (const dir of pluginDirs) {
    let entries = []
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      try {
        const manifest = JSON.parse(fs.readFileSync(path.join(dir, entry.name, 'parallax-plugin.json'), 'utf8'))
        for (const et of manifest.contributes?.elementTypes || []) {
          if (typeof et?.type === 'string' && !types.has(et.type)) types.set(et.type, manifest.id)
        }
      } catch { /* not a plugin folder */ }
    }
  }
  return types
}

module.exports = { createSandboxLookup, folderPluginTypes, networkHosts, pluginCsp, withPluginCsp, WITHDRAWN_PAGE, NETWORK_HOST_RE }

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Plugin elements in shared, live and exported presentations: the plugin's
// sandbox page with a window.parallax bridge that already holds the element's
// data. There's no editor to report changes to, so updateData only applies
// them in place; interactions work during the talk and aren't saved. The
// client builds the same thing in client/src/plugins/pluginEmbed.js; keep the
// two in step.

const fs = require('fs')
const path = require('path')

function staticBridge({ data, width, height }) {
  // < keeps "</script>" inside the data from closing the script early
  const json = JSON.stringify(data || {}).replace(/</g, '\\u003c')
  return `<script>
(function(){
  var _data = ${json};
  var _width = ${Number(width) || 0};
  var _height = ${Number(height) || 0};
  var _dataCallbacks = [];
  function copy() { return JSON.parse(JSON.stringify(_data)); }
  window.parallax = Object.freeze({
    get data() { return copy(); },
    get width() { return _width; },
    get height() { return _height; },
    updateData: function(patch) {
      Object.assign(_data, patch);
      _dataCallbacks.forEach(function(cb) { cb(copy()); });
    },
    onDataChanged: function(cb) { _dataCallbacks.push(cb); },
    onResize: function() {},
    onCaptureSnapshot: function() {},
    reportError: function(msg) { console.error('[plugin] ' + msg); },
    fetch: function(url, opts) { return window.fetch(url, opts); }
  });
})();
<\/script><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}</style>`
}

function buildStaticPluginSrcdoc(sandboxHtml, { data, width, height }) {
  const injection = staticBridge({ data, width, height })
  if (/<head[^>]*>/i.test(sandboxHtml)) return sandboxHtml.replace(/<head[^>]*>/i, m => m + injection)
  if (/<html[^>]*>/i.test(sandboxHtml)) return sandboxHtml.replace(/<html[^>]*>/i, m => m + injection)
  return injection + sandboxHtml
}

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

module.exports = { buildStaticPluginSrcdoc, createSandboxLookup }

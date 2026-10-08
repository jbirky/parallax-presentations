// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Community plugins' sandbox pages, by the version an element records
// (pluginVersion). The server sends each with its CSP already in place
// (server/services/community-plugins.js), and a version's page never
// changes, so each is fetched once. A version that can't be had (revoked,
// or never approved) is null, and its elements show a placeholder.

const pages = new Map()
const loading = new Map()

const key = (pluginId, version) => `${pluginId}@${version}`

export function versionSandboxUrl(pluginId, version) {
  return `/api/plugin-versions/${encodeURIComponent(pluginId)}/${encodeURIComponent(version)}/sandbox`
}

// The page, once loaded: a string, null when there's none, or undefined
// while it hasn't been asked for or is on its way
export function versionSandbox(pluginId, version) {
  return pages.get(key(pluginId, version))
}

export function loadVersionSandbox(pluginId, version, fetchPage = url => fetch(url)) {
  const k = key(pluginId, version)
  if (pages.has(k)) return Promise.resolve(pages.get(k))
  if (!loading.has(k)) {
    loading.set(k, fetchPage(versionSandboxUrl(pluginId, version))
      .then(r => (r.ok ? r.text() : null))
      .catch(() => null)
      .then(html => {
        pages.set(k, html)
        loading.delete(k)
        return html
      }))
  }
  return loading.get(k)
}

// The community plugin versions a deck's elements use: [{ pluginId, version }]
export function pluginVersionsIn(presentation) {
  const seen = new Map()
  for (const slide of presentation?.slides || []) {
    for (const el of slide.elements || []) {
      if (el?.type?.startsWith?.('plugin:') && el.pluginId && el.pluginVersion) {
        seen.set(key(el.pluginId, el.pluginVersion), { pluginId: el.pluginId, version: el.pluginVersion })
      }
    }
  }
  return [...seen.values()]
}

// For tests
export function clearVersionSandboxes() {
  pages.clear()
  loading.clear()
}

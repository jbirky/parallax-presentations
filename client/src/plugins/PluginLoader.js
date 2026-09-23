// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import registry from './PluginRegistry'
import { createPluginContext } from './PluginContext'

const loaded = new Set()

async function fetchPlugins() {
  const res = await fetch('/api/plugins')
  if (!res.ok) return []
  return res.json()
}

export async function loadPlugins({ getPresentation, updateElement, showToast }) {
  let plugins
  try {
    plugins = await fetchPlugins()
  } catch {
    return
  }

  const sandboxFetches = []
  for (const plugin of plugins) {
    if (loaded.has(plugin.slug)) continue
    const manifest = plugin.manifest
    if (!manifest || !manifest.id) continue

    registry.register(manifest, plugin.slug)
    loaded.add(plugin.slug)

    if (manifest.sandbox) {
      const sandboxUrl = `/api/plugins/${plugin.slug}/assets/${manifest.sandbox.replace(/^\.\//, '')}`
      sandboxFetches.push(fetch(sandboxUrl)
        .then(r => r.ok ? r.text() : null)
        .then(html => { if (html) registry.setSandboxHtml(manifest.id, html) })
        .catch(() => {}))
    }

    if (manifest.main) {
      try {
        const mainUrl = `/api/plugins/${plugin.slug}/assets/${manifest.main.replace(/^\.\//, '')}`
        const mod = await import(/* @vite-ignore */ mainUrl)
        if (typeof mod.activate === 'function') {
          const { context, dispose } = createPluginContext(manifest, {
            getElement: () => null,
            updateElement: (id, patch) => updateElement?.(id, patch),
            getPresentation,
            showToast,
          })
          mod.activate(context)
          registry.setInstance(manifest.id, { module: mod, context, dispose })
          registry.markActivated(manifest.id)
        }
      } catch (err) {
        console.warn(`[plugin-loader] Failed to activate ${manifest.id}:`, err.message)
      }
    }
  }
  await Promise.all(sandboxFetches)
}

export function getInsertablePluginTypes() {
  return registry.getAllElementTypes().map(et => ({
    type: et.fullType,
    label: et.label,
    pluginId: et.pluginId,
    defaultSize: et.defaultSize || { width: 300, height: 200 },
    defaultData: et.defaultData || {},
    toolbar: et.toolbar,
  }))
}

export function createPluginElement(fullType) {
  const et = registry.getElementType(fullType)
  if (!et) return null
  return {
    id: crypto.randomUUID(),
    type: fullType,
    pluginId: et.pluginId,
    x: 40,
    y: 40,
    width: et.defaultSize?.width || 300,
    height: et.defaultSize?.height || 200,
    zIndex: 2,
    pluginData: { ...(et.defaultData || {}) },
  }
}

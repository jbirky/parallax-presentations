// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Moving a community plugin's elements to another version: when the
// gallery lists a newer approved version than a deck's elements record, or
// when theirs can't be had any more (revoked) and another can. Only
// pluginVersion changes; the elements keep their settings. The editor
// offers it above the canvas and in the properties panel.

// -1, 0 or 1 as version a comes before, with or after b (semver: a
// pre-release comes before its release), as the server orders them
export function compareVersions(a, b) {
  const parse = v => {
    const [core, pre = null] = String(v).split(/-(.*)/s)
    return { nums: core.split('.').map(Number), pre }
  }
  const x = parse(a)
  const y = parse(b)
  for (let i = 0; i < 3; i++) {
    if (x.nums[i] !== y.nums[i]) return x.nums[i] < y.nums[i] ? -1 : 1
  }
  if (x.pre === y.pre) return 0
  if (x.pre === null) return 1
  if (y.pre === null) return -1
  const xs = x.pre.split('.')
  const ys = y.pre.split('.')
  for (let i = 0; i < Math.max(xs.length, ys.length); i++) {
    if (xs[i] === undefined) return -1
    if (ys[i] === undefined) return 1
    const xn = /^\d+$/.test(xs[i])
    const yn = /^\d+$/.test(ys[i])
    if (xn && yn && Number(xs[i]) !== Number(ys[i])) return Number(xs[i]) < Number(ys[i]) ? -1 : 1
    if (xn !== yn) return xn ? -1 : 1
    if (xs[i] !== ys[i]) return xs[i] < ys[i] ? -1 : 1
  }
  return 0
}

// The plugins whose elements in a deck could move to another version:
// [{ pluginId, slug, name, to, from, count, unavailable }], from being the
// versions they're at now and count how many elements. catalog is the
// listed plugins (api.getPluginCatalog); unavailable(pluginId, version)
// says when a version's page can't be had.
export function pluginUpdates(presentation, catalog, { unavailable = () => false } = {}) {
  const listed = new Map((catalog || []).filter(p => p && p.community && p.pluginId && p.version).map(p => [p.pluginId, p]))
  const found = new Map()
  for (const slide of presentation?.slides || []) {
    for (const el of slide.elements || []) {
      if (!el?.pluginId || !el.pluginVersion) continue
      const p = listed.get(el.pluginId)
      if (!p || p.version === el.pluginVersion) continue
      const gone = unavailable(el.pluginId, el.pluginVersion)
      if (compareVersions(p.version, el.pluginVersion) <= 0 && !gone) continue
      const u = found.get(el.pluginId) || { pluginId: el.pluginId, slug: p.slug, name: p.name, to: p.version, from: [], count: 0, unavailable: false }
      if (!u.from.includes(el.pluginVersion)) u.from.push(el.pluginVersion)
      u.count++
      u.unavailable = u.unavailable || gone
      found.set(el.pluginId, u)
    }
  }
  return [...found.values()].map(u => ({ ...u, from: u.from.sort(compareVersions) }))
}

// The deck with every element of a plugin at version `to`
export function withPluginVersion(presentation, pluginId, to) {
  const moves = el => el?.pluginId === pluginId && el.pluginVersion && el.pluginVersion !== to
  return {
    ...presentation,
    slides: (presentation.slides || []).map(s => ((s.elements || []).some(moves)
      ? { ...s, elements: s.elements.map(el => (moves(el) ? { ...el, pluginVersion: to } : el)) }
      : s)),
  }
}

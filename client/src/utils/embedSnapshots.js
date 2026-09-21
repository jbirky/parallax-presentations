// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// One-off snapshots taken from embed iframes while they are live on the canvas,
// so the slide panel can show a real thumbnail without running the embed's
// script a second time. Deliberately in memory only: nothing is written to the
// presentation, and a key includes a hash of the embed's source, so editing an
// embed simply misses the cache instead of needing invalidation.

const MAX_ENTRIES = 200

const cache = new Map()
const listeners = new Set()
let version = 0

// FNV-1a, enough to notice an edited embed. Not a security boundary.
function hash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export function snapshotKey(elementId, content) {
  if (!elementId) return null
  return `${elementId}:${hash(String(content || ''))}`
}

export function getSnapshot(key) {
  if (!key) return null
  return cache.get(key) || null
}

export function setSnapshot(key, dataUrl) {
  if (!key || !dataUrl) return
  if (cache.get(key) === dataUrl) return
  // Re-insert so iteration order stays least-recently-written first
  cache.delete(key)
  cache.set(key, dataUrl)
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value)
  version++
  listeners.forEach(fn => { try { fn() } catch { /* a bad listener must not stop the rest */ } })
}

export function subscribeSnapshots(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSnapshotVersion() {
  return version
}

// Exported for testing; the window listener below is the only caller in the app.
export function handleSnapshotMessage(data) {
  if (!data || data.source !== 'parallax-embed' || data.type !== 'snapshot') return false
  const { key, dataUrl } = data
  if (typeof key !== 'string' || typeof dataUrl !== 'string') return false
  if (!dataUrl.startsWith('data:image/')) return false
  setSnapshot(key, dataUrl)
  return true
}

export function clearSnapshots() {
  cache.clear()
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', e => handleSnapshotMessage(e.data))
}

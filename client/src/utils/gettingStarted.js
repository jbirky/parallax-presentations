// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The getting-started checklist, above the slide list on someone's first
// decks: five things that tick themselves as they're done, in any deck.
// Kept in this browser. Closing it hides it for good; Help › Getting-started
// checklist brings it back.

import { useSyncExternalStore } from 'react'

export const STEPS = [
  { id: 'theme', label: 'Pick a theme' },
  { id: 'slide', label: 'Add a slide' },
  { id: 'image', label: 'Add an image' },
  { id: 'notes', label: 'Add speaker notes' },
  { id: 'present', label: 'Present' },
]

const KEY = 'parallax-getting-started'
const COUNT_KEY = 'parallax-deck-count'
// Someone with more decks than this has found their way already
export const FIRST_DECKS = 3

const listeners = new Set()
let cache = null

function load() {
  if (cache) return cache
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { /* not kept */ }
  cache = { done: saved.done || {}, dismissed: !!saved.dismissed, reopened: !!saved.reopened }
  return cache
}

function save(next) {
  cache = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* not kept */ }
  listeners.forEach(fn => fn())
}

export function readChecklist() {
  return load()
}

// A step done: it ticks, once
export function tickStep(id) {
  const state = load()
  if (state.done[id] || !STEPS.some(s => s.id === id)) return
  save({ ...state, done: { ...state.done, [id]: true } })
}

// Closed: hidden for good
export function dismissChecklist() {
  save({ ...load(), dismissed: true, reopened: false })
}

// Help › Getting-started checklist
export function reopenChecklist() {
  save({ ...load(), dismissed: false, reopened: true })
}

// How many decks this person has (the home page counts them)
export function rememberDeckCount(count) {
  try { localStorage.setItem(COUNT_KEY, String(count)) } catch { /* not kept */ }
}

function deckCount() {
  try { const n = localStorage.getItem(COUNT_KEY); return n === null ? null : Number(n) } catch { return null }
}

// Whether to show it: not closed, and on a first deck (a guest's, or someone
// with few), or brought back from Help
export function showChecklist(state, { guest = false } = {}) {
  if (state.dismissed) return false
  if (state.reopened || guest) return true
  const count = deckCount()
  return count === null || count <= FIRST_DECKS
}

export function resetChecklistForTests() {
  cache = null
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useChecklist() {
  return useSyncExternalStore(subscribe, load, load)
}

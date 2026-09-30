// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The app's light or dark look. What someone picks (the dashboard's toggle,
// or Settings in the editor) is kept in this browser; until they pick, the
// cloud version is light from signing in on and for guests (the landing page
// stays dark, as it's designed), and the self-hosted and desktop apps are
// dark. The old key was saved on every load, so only a light
// found there was a choice.

export const THEME_KEY = 'parallax-theme'

// 'light', 'dark', or null when nothing was picked
export function chosenTheme(storage = globalThis.localStorage) {
  try {
    const theme = storage.getItem(THEME_KEY)
    if (theme === 'light' || theme === 'dark') return theme
    return storage.getItem('editor-theme') === 'light' ? 'light' : null
  } catch {
    return null
  }
}

export function saveTheme(theme, storage = globalThis.localStorage) {
  try { storage.setItem(THEME_KEY, theme) } catch {}
}

export function defaultTheme(isCloud, path = globalThis.location?.pathname || '/') {
  if (!isCloud) return 'dark'
  return path === '/' || path === '' ? 'dark' : 'light'
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The light or dark look, kept apart for two surfaces, each with its own
// default and its own choice in this browser:
// - 'site': the hosted site's landing page (/) and the pages the server
//   builds (examples, templates, plugins; server/services/site-pages.js).
//   Dark unless light is picked with their toggle.
// - 'app': the dashboard, the editor, sign-in, guest mode and /admin. The
//   cloud version is light unless dark is picked (the dashboard's toggle, or
//   Settings in the editor); the self-hosted and desktop apps are dark.
// So turning the landing page light leaves the editor alone, and the other
// way round. Both used to share one key, `parallax-theme` (and before it
// `editor-theme`, saved on every load, so only a light there was a choice).
// The hosted app no longer reads them, as a landing-page toggle filled them
// too; the self-hosted and desktop apps, which have no landing page, still
// take them as the app's choice. client/index.html and site-pages.js apply a
// saved choice before the page paints.

export const SITE_THEME_KEY = 'parallax-site-theme'
export const APP_THEME_KEY = 'parallax-app-theme'
const OLD_KEY = 'parallax-theme'

// Which surface a page is: only the hosted site has a landing page
export function themeSurface(isCloud, path = globalThis.location?.pathname || '/') {
  return isCloud && (path === '/' || path === '') ? 'site' : 'app'
}

const valid = t => (t === 'light' || t === 'dark' ? t : null)

// 'light', 'dark', or null when nothing was picked
export function chosenTheme(surface, { isCloud = true, storage = globalThis.localStorage } = {}) {
  try {
    const theme = valid(storage.getItem(surface === 'site' ? SITE_THEME_KEY : APP_THEME_KEY))
    if (theme || surface === 'site' || isCloud) return theme
    return valid(storage.getItem(OLD_KEY)) || (storage.getItem('editor-theme') === 'light' ? 'light' : null)
  } catch {
    return null
  }
}

export function saveTheme(surface, theme, storage = globalThis.localStorage) {
  try { storage.setItem(surface === 'site' ? SITE_THEME_KEY : APP_THEME_KEY, theme) } catch {}
}

export function defaultTheme(isCloud, path = globalThis.location?.pathname || '/') {
  return themeSurface(isCloud, path) === 'site' || !isCloud ? 'dark' : 'light'
}

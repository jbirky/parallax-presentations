// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The deck's font: what Settings → Font picked, or Arial when nothing was
// picked. The same font on every computer, so a slide laid out on one
// isn't reflowed on another the way the system font (San Francisco, Segoe
// UI, …) was. The editor, the thumbnails and the presented deck all read
// it from here.

export const DEFAULT_DECK_FONT = 'Arial, sans-serif'

export function deckFont(globalFont) {
  return (typeof globalFont === 'string' && globalFont.trim()) || DEFAULT_DECK_FONT
}

// The name of a deck's font, for a menu: "Jost" for "Jost, sans-serif"
export function deckFontName(globalFont) {
  return deckFont(globalFont).split(',')[0].replace(/['"]/g, '').trim()
}

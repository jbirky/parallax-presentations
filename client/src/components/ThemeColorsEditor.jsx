// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The Themes panel's Customize: the deck's own colors over its theme's
// (deck.themeColors, utils/themes.js): its page, text, headings, links and
// accent, the color theme stylesheets mark things with (--px-accent). Slides
// with a background of their own keep the colors that show on it.

import { RotateCcw } from 'lucide-react'
import { deckTheme, cleanThemeColors, parseColor, THEME_COLOR_KEYS } from '../utils/themes'

const LABELS = { background: 'Page', text: 'Text', heading: 'Headings', link: 'Links', accent: 'Accent' }
const HINTS = { accent: 'For theme CSS: --px-accent' }

// A color as #rrggbb, for a color input
export function hexColor(value) {
  const rgb = parseColor(value)
  return rgb ? `#${rgb.map(n => Math.round(n).toString(16).padStart(2, '0')).join('')}` : '#000000'
}

export default function ThemeColorsEditor({ theme, colors, onChange }) {
  const own = cleanThemeColors(colors) || {}
  const shown = deckTheme(theme, own)
  const set = (key, value) => {
    const next = { ...own }
    if (value) next[key] = value
    else delete next[key]
    onChange(cleanThemeColors(next))
  }
  return (
    <div className="theme-colors">
      {THEME_COLOR_KEYS.map(key => (
        <div key={key} className="text-style-row">
          <label htmlFor={`theme-color-${key}`}>
            <span>{LABELS[key]}</span>
            {HINTS[key] && <span className="text-style-hint">{HINTS[key]}</span>}
          </label>
          <div className="text-style-size">
            <input id={`theme-color-${key}`} type="color" className="theme-color-input" value={hexColor(shown[key])}
              onChange={e => set(key, e.target.value)} />
            <button type="button" className="btn-icon" onClick={() => set(key, null)} disabled={!own[key]}
              title={own[key] ? `${LABELS[key]} back to the theme’s` : 'The theme’s color'} aria-label={`Reset ${LABELS[key].toLowerCase()} color`}
              style={{ visibility: own[key] ? 'visible' : 'hidden' }}>
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

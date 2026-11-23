// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The themes as pictures: each one's title slide in its colors, in the deck's
// font (or the theme's, when the deck has none), with the theme's stylesheet. In a panel beside the slide that applies a theme as it's clicked
// (the toolbar's Theme, Slide › Theme…), and when a deck is made.

import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { THEME_LIST, themeBackgroundStyle } from '../utils/themes'
import { deckFont } from '../utils/deckFont'
import { deckThemeClass } from '../utils/themeCss'
import TextStylesEditor from './TextStylesEditor'
import ThemeColorsEditor from './ThemeColorsEditor'
import ThemeCssEditor from './ThemeCssEditor'

// One theme's title slide, small
export function ThemeSwatch({ theme, font, title = 'Presentation title', width = 168 }) {
  return (
    <div className={['theme-swatch', deckThemeClass(theme.id)].filter(Boolean).join(' ')} style={{ width, height: Math.round(width * 9 / 16), ...themeBackgroundStyle(theme.id), fontFamily: deckFont(font || theme.font) }}>
      <span className="theme-swatch-title" style={{ color: theme.heading, fontFamily: theme.textStyles?.headingFont, fontSize: Math.round(width / (theme.textStyles?.headingFont ? 17 : 11)), fontWeight: theme.textStyles?.headingWeight || 700, lineHeight: theme.textStyles?.headingFont ? 1.4 : 1.15 }}>{title}</span>
      <span style={{ color: theme.text, fontSize: Math.round(width / 19), marginTop: Math.round(width / 40) }}>Subtitle</span>
      <span style={{ display: 'block', width: '24%', height: 2, marginTop: Math.round(width / 24), background: theme.link, borderRadius: 1 }} />
    </div>
  )
}

// The themes to choose from; `value` is the chosen one
export default function ThemeGallery({ value, onChange, font, columns = 2, width = 168, label = 'Theme' }) {
  return (
    <div role="radiogroup" aria-label={label} className="theme-gallery" style={{ gridTemplateColumns: `repeat(${columns}, ${width + 12}px)` }}>
      {THEME_LIST.map(theme => {
        const on = (value || 'black') === theme.id
        return (
          <button key={theme.id} type="button" role="radio" aria-checked={on} className={`theme-choice ${on ? 'on' : ''}`}
            onClick={() => onChange(theme.id)} title={`${theme.label}${theme.dark ? ', dark' : ', light'}${theme.note ? `. ${theme.note}` : ''}`}>
            <ThemeSwatch theme={theme} font={font} width={width} />
            <span className="theme-choice-label">
              {theme.label}
              {on && <Check size={12} aria-hidden="true" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Themes, beside the slide: picking one applies it to the deck at once, and
// Customize sets the deck's own colors over it (ThemeColorsEditor). The Text
// tab sets the size and font of the deck's text (TextStylesEditor), and the
// CSS tab the deck's own stylesheet (ThemeCssEditor).
export function ThemePanel({ value, font, onChange, onClose, tab = 'colors', onTab, textStyles, onTextStyles, onFont, themeColors = null, onThemeColors, themeCss = '', onThemeCss }) {
  const tabs = [['colors', 'Colors'], onTextStyles && ['text', 'Text'], onThemeCss && ['css', 'CSS']].filter(Boolean)
  const shown = tabs.some(([id]) => id === tab) ? tab : 'colors'
  // Customize starts open on a deck with colors of its own
  const [customizing, setCustomizing] = useState(!!themeColors)
  return (
    <aside className="properties-panel theme-panel" aria-label="Themes">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 4px' }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Themes</h3>
        <button className="btn-icon" onClick={onClose} title="Close themes" aria-label="Close themes"><X size={15} /></button>
      </div>
      {tabs.length > 1 && (
        <div className="inspector-tabs" role="tablist" aria-label="Theme" style={{ margin: '4px 12px 10px' }}>
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" id={`theme-tab-${id}`} aria-selected={shown === id} aria-controls="theme-tab-panel"
              className={shown === id ? 'active' : undefined} onClick={() => onTab?.(id)}>
              {label}
            </button>
          ))}
        </div>
      )}
      <div id="theme-tab-panel" role={tabs.length > 1 ? 'tabpanel' : undefined} aria-labelledby={tabs.length > 1 ? `theme-tab-${shown}` : undefined}>
        {shown === 'text' ? (
          <div style={{ padding: '0 12px 16px' }}>
            <TextStylesEditor textStyles={textStyles} font={font} theme={value} onChange={onTextStyles} onFont={onFont} />
          </div>
        ) : shown === 'css' ? (
          <div style={{ padding: '0 12px 16px' }}>
            <ThemeCssEditor value={themeCss} onChange={onThemeCss} />
          </div>
        ) : (
          <>
            <p className="prop-hint" style={{ padding: '0 12px', margin: '0 0 8px' }}>
              The page, text and heading colors of every slide without a background of its own. Bauhaus and Pixel also bring fonts and a look of their own: hover over one to see what it adds. A font you pick in Settings › Font or the Text tab wins.
            </p>
            {onThemeColors && (
              <details className="theme-customize" open={customizing} onToggle={e => setCustomizing(e.currentTarget.open)}>
                <summary>Customize colors</summary>
                <ThemeColorsEditor theme={value} colors={themeColors} onChange={onThemeColors} />
              </details>
            )}
            <div style={{ padding: '0 12px 16px' }}>
              <ThemeGallery value={value} onChange={onChange} font={font} columns={1} width={204} />
            </div>
          </>
        )}
      </div>
    </aside>
  )
}

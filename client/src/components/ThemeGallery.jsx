// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The themes as pictures: each one's title slide in its colors, in the deck's
// font. In a panel beside the slide that applies a theme as it's clicked
// (the toolbar's Theme, Slide › Theme…), and when a deck is made.

import { X, Check } from 'lucide-react'
import { THEME_LIST, themeBackgroundStyle } from '../utils/themes'
import { deckFont } from '../utils/deckFont'
import TextStylesEditor from './TextStylesEditor'

// One theme's title slide, small
export function ThemeSwatch({ theme, font, title = 'Presentation title', width = 168 }) {
  return (
    <div className="theme-swatch" style={{ width, height: Math.round(width * 9 / 16), ...themeBackgroundStyle(theme.id), fontFamily: deckFont(font) }}>
      <span style={{ color: theme.heading, fontSize: Math.round(width / 11), fontWeight: 700, lineHeight: 1.15 }}>{title}</span>
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
            onClick={() => onChange(theme.id)} title={`${theme.label}${theme.dark ? ', dark' : ', light'}`}>
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

// Themes, beside the slide: picking one applies it to the deck at once. Its
// Text tab sets the size and font of the deck's text (TextStylesEditor).
export function ThemePanel({ value, font, onChange, onClose, tab = 'colors', onTab, textStyles, onTextStyles, onFont }) {
  const tabs = onTextStyles ? [['colors', 'Colors'], ['text', 'Text']] : [['colors', 'Colors']]
  const shown = tabs.some(([id]) => id === tab) ? tab : 'colors'
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
        ) : (
          <>
            <p className="prop-hint" style={{ padding: '0 12px', margin: '0 0 8px' }}>
              The page, text and heading colors of every slide without a background of its own.
            </p>
            <div style={{ padding: '0 12px 16px' }}>
              <ThemeGallery value={value} onChange={onChange} font={font} columns={1} width={204} />
            </div>
          </>
        )}
      </div>
    </aside>
  )
}

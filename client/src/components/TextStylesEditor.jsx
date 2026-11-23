// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The Themes panel's Text tab: how big every slide's body text and headings
// are, and the fonts they're in (deck.textStyles, utils/textStyles.js; body
// text's font is the deck's font, deck.globalFont). Changes show on the
// slide beside it as they're made.

import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import DeckFontOptions from './DeckFontOptions'
import { deckFont, deckFontName } from '../utils/deckFont'
import { themeOf, themeBackgroundStyle, deckTextFont } from '../utils/themes'
import { textSizes, withTextStyles, cleanTextStyles, MIN_SIZE, MAX_SIZE, HEADING_WEIGHTS } from '../utils/textStyles'

const SIZES = [
  { key: 'h1Size', label: 'Heading 1', hint: 'Section headers' },
  { key: 'h2Size', label: 'Heading 2', hint: 'Slide titles' },
  { key: 'h3Size', label: 'Heading 3', hint: 'Column headings' },
  { key: 'bodySize', label: 'Body text', hint: 'Paragraphs, lists' },
]

const WEIGHT_NAMES = { 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra bold', 900: 'Black' }

// A size in px: typed freely, applied once it's a size that can be used
function SizeField({ id, value, custom, onChange, onReset, label }) {
  const shown = String(Math.round(value))
  const [draft, setDraft] = useState(shown)
  useEffect(() => setDraft(shown), [shown])
  const apply = text => {
    setDraft(text)
    const n = Number(text)
    if (text !== '' && Number.isFinite(n) && n >= MIN_SIZE && n <= MAX_SIZE) onChange(n)
  }
  return (
    <div className="text-style-size">
      <input id={id} className="prop-input" type="number" min={MIN_SIZE} max={MAX_SIZE} step="1" inputMode="numeric"
        value={draft} onChange={e => apply(e.target.value)} onBlur={() => setDraft(shown)} />
      <span className="text-style-unit">px</span>
      <button type="button" className="btn-icon" onClick={onReset} disabled={!custom}
        title={custom ? `${label} back to its default size` : 'The default size'} aria-label={`Reset ${label} size`}
        style={{ visibility: custom ? 'visible' : 'hidden' }}>
        <RotateCcw size={12} />
      </button>
    </div>
  )
}

// The styles as a small slide: each one in its size and font, in the theme's colors
function Specimen({ theme, sizes, bodyFont, headingFont, weight }) {
  const t = themeOf(theme)
  // A third of the slide's size, so body text can be read
  const scale = 0.3
  const heading = (size, text) => (
    <div style={{ fontSize: size * scale, fontFamily: headingFont, fontWeight: weight, color: t.heading, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</div>
  )
  return (
    <div className="text-style-specimen" style={{ ...themeBackgroundStyle(theme) }} aria-hidden="true">
      {heading(sizes.h1Size, 'Heading 1')}
      {heading(sizes.h2Size, 'Slide title')}
      {heading(sizes.h3Size, 'Heading 3')}
      <div style={{ fontSize: sizes.bodySize * scale, fontFamily: bodyFont, color: t.text, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Body text</div>
    </div>
  )
}

export default function TextStylesEditor({ textStyles, font, theme, onChange, onFont }) {
  const clean = cleanTextStyles(textStyles) || {}
  const sizes = textSizes(clean)
  const set = patch => onChange(withTextStyles(clean, patch))
  // The deck's font, or its theme's (utils/themes.js)
  const bodyFont = deckFont(deckTextFont(font, theme))
  const headingFont = clean.headingFont || bodyFont
  const weight = clean.headingWeight || 700
  const anyCustom = Object.keys(clean).length > 0

  return (
    <div className="text-styles">
      <p className="prop-hint">
        The size and font of every slide’s text. Text you gave a size or font of its own keeps it.
      </p>
      <Specimen theme={theme} sizes={sizes} bodyFont={bodyFont} headingFont={headingFont} weight={weight} />

      <h4 className="text-styles-heading">Sizes</h4>
      {SIZES.map(({ key, label, hint }) => (
        <div key={key} className="text-style-row">
          <label htmlFor={`text-style-${key}`}>
            <span>{label}</span>
            <span className="text-style-hint">{hint}</span>
          </label>
          <SizeField id={`text-style-${key}`} label={label} value={sizes[key]} custom={clean[key] != null}
            onChange={n => set({ [key]: n })} onReset={() => set({ [key]: null })} />
        </div>
      ))}

      <h4 className="text-styles-heading">Fonts</h4>
      <label className="text-style-field">
        <span>Body text</span>
        <select className="prop-input" value={font || ''} onChange={e => onFont(e.target.value || null)}>
          <option value="">Default ({deckFontName(deckTextFont('', theme))})</option>
          <DeckFontOptions />
        </select>
      </label>
      <label className="text-style-field">
        <span>Headings</span>
        <select className="prop-input" value={clean.headingFont || ''} onChange={e => set({ headingFont: e.target.value || null })}>
          <option value="">Same as body text</option>
          <DeckFontOptions />
        </select>
      </label>
      <label className="text-style-field">
        <span>Heading weight</span>
        <select className="prop-input" value={weight} onChange={e => set({ headingWeight: Number(e.target.value) })}>
          {HEADING_WEIGHTS.map(w => <option key={w} value={w}>{WEIGHT_NAMES[w]}{w === 700 ? ' (default)' : ''}</option>)}
        </select>
      </label>

      <button type="button" className="btn btn-secondary text-styles-reset" disabled={!anyCustom} onClick={() => onChange(null)}>
        <RotateCcw size={13} /> Reset sizes and heading font
      </button>
    </div>
  )
}

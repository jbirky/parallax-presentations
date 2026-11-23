// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The Themes panel's CSS tab: the deck's own stylesheet (deck.themeCss),
// scoped to its slides and checked (utils/scopeCss.js), shown on the slide
// beside it as it's typed. What was left out is listed with its line.

import { useEffect, useMemo, useRef, useState } from 'react'
import { scopeThemeCss, MAX_THEME_CSS } from '../utils/scopeCss'

const EXAMPLE = `/* A rule under slide titles, in the accent color */
[data-placeholder=title] h2 {
  border-bottom: 6px solid var(--px-accent);
  padding-bottom: 8px;
}

/* Square bullets */
.px-text li::marker { content: "\\25A0  "; color: var(--px-accent); }

/* Section headers on the accent color */
.px-slide[data-layout=section-header] { background: var(--px-accent); }
`

const HOOKS = [
  ['.px-slide', 'every slide'],
  ['[data-layout=…]', 'a slide’s layout: title, title-content, section-header, two-column…'],
  ['.px-text', 'every text box'],
  ['[data-placeholder=…]', 'a layout’s title, subtitle or body'],
  ['--px-bg, --px-text, --px-heading, --px-link, --px-accent', 'the slide’s colors'],
  ['--ts-body, --ts-h1 … --ts-h3', 'the Text tab’s sizes'],
]

export default function ThemeCssEditor({ value, onChange }) {
  const [draft, setDraft] = useState(value || '')
  const typing = useRef(false)
  const timer = useRef(0)
  // Someone else's change (undo, a collaborator) shows unless it's being typed in
  useEffect(() => { if (!typing.current) setDraft(value || '') }, [value])
  useEffect(() => () => clearTimeout(timer.current), [])
  const { dropped } = useMemo(() => scopeThemeCss(draft), [draft])

  const change = text => {
    setDraft(text)
    typing.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { typing.current = false; onChange(text) }, 300)
  }
  const flush = () => {
    if (!typing.current) return
    clearTimeout(timer.current)
    typing.current = false
    onChange(draft)
  }

  return (
    <div className="theme-css">
      <p className="prop-hint">
        A stylesheet for this deck’s slides, in the editor and when presenting. Rules apply inside slides only.
      </p>
      <textarea className="theme-css-text" aria-label="Theme CSS" spellCheck={false} value={draft} maxLength={MAX_THEME_CSS}
        placeholder={EXAMPLE} onChange={e => change(e.target.value)} onBlur={flush}
        onKeyDown={e => {
          if (e.key !== 'Tab' || e.shiftKey) return
          e.preventDefault()
          const { selectionStart: start, selectionEnd: end } = e.target
          const next = draft.slice(0, start) + '  ' + draft.slice(end)
          change(next)
          requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = start + 2 })
        }} />
      <div className="theme-css-meta">
        <span>{draft.length.toLocaleString()} / {MAX_THEME_CSS.toLocaleString()} characters</span>
        {!draft.trim() && <button type="button" className="theme-css-link" onClick={() => change(EXAMPLE)}>Start from an example</button>}
      </div>
      {dropped.length > 0 && (
        <div className="theme-css-dropped" role="status">
          <strong>Left out</strong>
          <ul>
            {dropped.slice(0, 20).map((d, i) => <li key={i}>{d.line ? `Line ${d.line}: ` : ''}{d.reason}</li>)}
          </ul>
        </div>
      )}
      <details className="theme-css-hooks">
        <summary>What a rule can target</summary>
        <dl>
          {HOOKS.map(([hook, what]) => <div key={hook}><dt><code>{hook}</code></dt><dd>{what}</dd></div>)}
        </dl>
      </details>
    </div>
  )
}

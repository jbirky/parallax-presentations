// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The hooks a theme's stylesheet can target, the same in every place a slide
// is drawn: the editor's canvas and thumbnails, the presented deck and the
// PDF. A slide's root is .px-slide, with its layout (data-layout) and its
// colors as CSS variables (--px-bg, --px-text, --px-heading, --px-link,
// --px-accent: themes.js's paletteVars); a text box is .px-text, and a
// layout's placeholder says which it is (data-placeholder). So a stylesheet
// can write
//
//   .px-slide[data-layout=section-header] { … }
//   [data-placeholder=title] h2 { border-bottom: 6px solid var(--px-accent); }
//
// A slide with a background of its own (themes.js's slidePalette: own) also
// has data-own-background, so a stylesheet that draws over the theme's page,
// such as a starfield on title slides, can leave that background showing:
//
//   .px-slide[data-layout=title]:not([data-own-background])::before { … }

export const SLIDE_CLASS = 'px-slide'
export const TEXT_CLASS = 'px-text'

// The footer, where a slide shows one (the editor's canvas, the presented
// deck and the PDF): .px-footer, with data-footer "sequence" (the deck's
// sections in a row, Settings › Footer) or "basic". In a sequence, each
// section is a .px-footer-section inside .px-footer-sections, with
// data-state "past", "current" or "future" from the slide's place in the
// sequence (slide.activeSection), and its own color, if it has one, as
// --px-section-color. A basic footer has a .px-footer-label; either can
// have a .px-footer-time and a .px-footer-page.
export const FOOTER_CLASS = 'px-footer'

// A section's place in the footer's sequence, for a slide in section active
// (an index, or none)
export function footerSectionState(i, active) {
  if (typeof active !== 'number') return 'future'
  return i < active ? 'past' : i === active ? 'current' : 'future'
}

const NAME = /^[\w-]{1,40}$/

// A slide's layout (slideLayouts.js), as its data-layout, or ''
export function slideLayout(slide) {
  return typeof slide?.layout === 'string' && NAME.test(slide.layout) ? slide.layout : ''
}

// A text box's placeholder ('title', 'subtitle' or 'body'), as its
// data-placeholder, or ''
export function textPlaceholder(el) {
  return el?.type === 'text' && typeof el.placeholder === 'string' && NAME.test(el.placeholder) ? el.placeholder : ''
}

// For a page's HTML: the attributes after a slide's or text box's class
export function slideLayoutAttr(slide) {
  const layout = slideLayout(slide)
  return layout ? ` data-layout="${layout}"` : ''
}

// data-own-background, for a slide whose palette (themes.js) is its own
export function ownBackgroundAttr(palette) {
  return palette?.own ? ' data-own-background' : ''
}

export function placeholderAttr(el) {
  const role = textPlaceholder(el)
  return role ? ` data-placeholder="${role}"` : ''
}

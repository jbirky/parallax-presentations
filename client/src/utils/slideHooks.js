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

export const SLIDE_CLASS = 'px-slide'
export const TEXT_CLASS = 'px-text'

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

export function placeholderAttr(el) {
  const role = textPlaceholder(el)
  return role ? ` data-placeholder="${role}"` : ''
}

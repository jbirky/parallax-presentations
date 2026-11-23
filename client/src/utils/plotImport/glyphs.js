// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Words drawn as matplotlib draws them, for a kept figure's title or axis
// label when it's changed (splitSvg.js, splitPdf.js): the outlines of their
// glyphs (opentype.js), in matplotlib's own fonts (the DejaVu family, from
// the app's copy of dejavu-fonts-ttf), each glyph placed at the one before's
// advance plus their kerning, which matplotlib rounds to an eighth of a unit
// at 100 points (FreeType's kerning at the size it lays text out at,
// grid-fitted with its hinting factor of 8). Its SVGs place every glyph so.

const FAMILY = ['DejaVuSans', 'DejaVuSans-Bold', 'DejaVuSans-Oblique', 'DejaVuSans-BoldOblique',
  'DejaVuSerif', 'DejaVuSerif-Bold', 'DejaVuSerif-Italic', 'DejaVuSerif-BoldItalic', 'DejaVuSansMono']

// The font a figure's words are drawn again in: their own, when it's one of
// these, else DejaVu Sans (matplotlib's own default)
export const fontFor = name => (FAMILY.includes(name) ? name : 'DejaVuSans')

const kerning = new WeakMap()
function kernOf(font, a, b) {
  if (!kerning.has(font)) {
    const pos = font.position
    kerning.set(font, (pos && (pos.getKerningTables?.('latn') || pos.getKerningTables?.('DFLT') || pos.defaultKerningTables)) || null)
  }
  const tables = kerning.get(font)
  if (tables) return font.position.getKerningValue(tables, a.index, b.index) || 0
  return font.kerningPairs?.[`${a.index},${b.index}`] || 0
}

// A glyph's advance at 100 points, by its character
export const advanceOf = (font, ch) => font.charToGlyph(ch).advanceWidth * 100 / font.unitsPerEm

// s in font at size (points), as matplotlib lays it out: { d: SVG path data,
// the baseline at 0 and y down, width }
export function textOutline(font, s, size) {
  const unit = 100 / font.unitsPerEm
  let x = 0, prev = null, d = ''
  for (const ch of String(s)) {
    const g = font.charToGlyph(ch)
    if (prev) x += Math.round(kernOf(font, prev, g) * unit * 8) / 8
    d += g.getPath(x * size / 100, 0, size).toPathData(3)
    x += g.advanceWidth * unit
    prev = g
  }
  return { d, width: x * size / 100 }
}

// How far along its line a label's new words start from its old ones' start,
// so the point they line up with the axes by (align: their start, middle or
// end) stays where it was
export const shiftFor = (align, oldWidth, newWidth) => (oldWidth - newWidth) * ({ start: 0, center: 0.5, end: 1 }[align] ?? 0.5)

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// TikZ diagram elements, made in the TikZ diagram editor (tools/tikz-editor.html):
// { type: 'tikz', svg, tikz, editorState }. Slides show `svg` inline, sized to
// the element, so its KaTeX math uses the page's KaTeX CSS; `tikz` is the code
// to copy into a paper and `editorState` reopens the editor where it left off.
// server/services/tikz-diagram.js is the same for pages the server builds.

// The <svg> without anything that could run: scripts, frames, event handlers
// and javascript: links. Only the editor writes these, but they're saved with
// the presentation, so treat them as untrusted.
export function sanitizeSvg(svg) {
  const match = typeof svg === 'string' && svg.match(/<svg\b[\s\S]*<\/svg\s*>/i)
  if (!match) return ''
  return match[0]
    .replace(/<(script|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|iframe|object|embed)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s((?:xlink:)?href)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, ' $1="#"')
}

// The diagram's SVG, filling its element
export function tikzDiagramSvg(el) {
  return sanitizeSvg(el.svg).replace(/^<svg\b/i, '<svg style="width:100%;height:100%;display:block;overflow:visible"')
}

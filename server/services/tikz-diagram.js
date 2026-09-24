// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// TikZ diagram elements for pages the server builds; the client's
// utils/tikzDiagram.js is the same (see there), and both run the same tests.

// The <svg> without anything that could run: scripts, frames, event handlers
// and javascript: links
function sanitizeSvg(svg) {
  const match = typeof svg === 'string' && svg.match(/<svg\b[\s\S]*<\/svg\s*>/i)
  if (!match) return ''
  return match[0]
    .replace(/<(script|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|iframe|object|embed)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s((?:xlink:)?href)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, ' $1="#"')
}

// The diagram's SVG, filling its element
function tikzDiagramSvg(el) {
  return sanitizeSvg(el.svg).replace(/^<svg\b/i, '<svg style="width:100%;height:100%;display:block;overflow:visible"')
}

module.exports = { sanitizeSvg, tikzDiagramSvg }

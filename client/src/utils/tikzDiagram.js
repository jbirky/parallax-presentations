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
  if (typeof svg !== 'string') return ''
  // The first <svg to the last </svg>, found by position: a regex spanning
  // them looks again from each <svg when there's no closing tag
  const start = svg.search(/<svg\b/i)
  let end = -1
  for (const m of svg.matchAll(/<\/svg\s*>/gi)) end = m.index + m[0].length
  if (start < 0 || end <= start) return ''
  return withoutPairs(svg.slice(start, end))
    .replace(/<(script|iframe|object|embed)\b[^>]*>/gi, '')
    // A quote that never closes runs to the end, as a browser reads it
    .replace(/\son[a-z]+\s*=\s*("[^"]*(?:"|$)|'[^']*(?:'|$)|[^\s>]+)/gi, '')
    .replace(/\s((?:xlink:)?href)\s*=\s*("\s*javascript:[^"]*(?:"|$)|'\s*javascript:[^']*(?:'|$))/gi, ' $1="#"')
}

// `html` without each <script>…</script>, and the same for iframe, object
// and embed. Each tag's closing tag is looked for once past where there's
// none, so a deck's SVG full of unclosed ones takes no longer than its length.
function withoutPairs(html) {
  const lower = html.toLowerCase()
  const noCloseFrom = {}
  const open = /<(script|iframe|object|embed)\b/gi
  let out = '', kept = 0, m
  while ((m = open.exec(html))) {
    const tag = m[1].toLowerCase()
    if (m.index >= (noCloseFrom[tag] ?? Infinity)) continue
    const close = new RegExp(`</${tag}\\s*>`, 'g')
    close.lastIndex = m.index
    const c = close.exec(lower)
    if (!c) { noCloseFrom[tag] = m.index; continue }
    out += html.slice(kept, m.index)
    kept = open.lastIndex = c.index + c[0].length
  }
  return out + html.slice(kept)
}

// The diagram's SVG, filling its element
export function tikzDiagramSvg(el) {
  return sanitizeSvg(el.svg).replace(/^<svg\b/i, '<svg style="width:100%;height:100%;display:block;overflow:visible"')
}

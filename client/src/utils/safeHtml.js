// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A deck's HTML (text boxes, markdown, shapes, TikZ diagrams), for showing in
// the editor. A deck can come from someone else: forked from GitHub,
// imported, made from a template, or edited by a collaborator, whose tab can
// write anything to the live document. So before the editor puts it in the
// page, it loses scripts, event handlers, javascript: links, and styles and
// forms that would reach outside its element. What the text editor writes is
// kept as it is.
//
// Presented decks and share pages run a deck's own code by design (HTML
// embeds), so they're kept apart from the app instead of cleaned.

import DOMPurify from 'dompurify'

const FORBID_TAGS = ['style', 'form', 'input', 'button', 'textarea', 'select']
const HTML = { ADD_ATTR: ['target', 'colwidth'], FORBID_TAGS }
// A TikZ diagram's math is HTML in a foreignObject. Its <style> goes, and
// index.css has its rules (.tikz-diagram-math).
const SVG = { ADD_TAGS: ['foreignObject'], HTML_INTEGRATION_POINTS: { 'annotation-xml': true, foreignobject: true }, FORBID_TAGS }

// Recently cleaned HTML, since the canvas redraws often
const cache = new Map()
const CACHE_SIZE = 200

function clean(html, config, kind) {
  if (!html || typeof html !== 'string') return ''
  const key = kind + html
  let out = cache.get(key)
  if (out === undefined) {
    out = DOMPurify.sanitize(html, config)
    if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value)
    cache.set(key, out)
  }
  return out
}

export const safeHtml = html => clean(html, HTML, 'h')
export const safeSvg = svg => clean(svg, SVG, 's')

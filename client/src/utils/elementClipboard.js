// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Copying a slide's elements to the system clipboard and pasting them back,
// in this tab, another tab or another presentation; and pasting text and HTML
// from other apps as a text box.
//
// A copy carries the elements' JSON twice: under a type of its own, which a
// paste in the same browser reads first, and in an attribute of its HTML,
// for a browser that drops custom types. The HTML and plain text otherwise
// hold the text boxes' words, so a copy pastes into a document as text.

import DOMPurify from 'dompurify'

export const ELEMENTS_TYPE = 'application/x-parallax-elements'
const ATTRIBUTE = 'data-parallax-elements'

// The words of a text box's HTML, one line per block
function plainText(html) {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks = [...doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, pre, blockquote')]
    .filter(el => !el.querySelector('p, li'))
  const lines = blocks.length ? blocks.map(el => el.textContent) : [doc.body.textContent]
  return lines.map(line => line.trim()).filter(Boolean).join('\n')
}

// What a copy of `elements` (copied from the slide `slideId`) puts on the
// clipboard: { [type]: data }
export function clipboardData(elements, slideId = null) {
  const json = JSON.stringify({ version: 1, slideId, elements })
  const texts = elements.filter(el => el.type === 'text' && el.content)
  const words = texts.map(el => el.content).join('')
  return {
    [ELEMENTS_TYPE]: json,
    'text/html': `<div ${ATTRIBUTE}="${encodeURIComponent(json)}">${words}</div>`,
    'text/plain': texts.map(el => plainText(el.content)).filter(Boolean).join('\n\n'),
  }
}

// Puts a copy of `elements` on a copy event's clipboard
export function writeElements(dataTransfer, elements, slideId = null) {
  for (const [type, data] of Object.entries(clipboardData(elements, slideId))) {
    try { dataTransfer.setData(type, data) } catch { /* a type this browser refuses */ }
  }
}

function parse(json) {
  try {
    const value = JSON.parse(json)
    if (!value || !Array.isArray(value.elements)) return null
    const elements = value.elements.filter(el => el && typeof el === 'object' && typeof el.type === 'string')
    return elements.length ? { slideId: value.slideId ?? null, elements } : null
  } catch {
    return null
  }
}

// The elements a copy from Parallax put in HTML, if it holds some
export function elementsFromHtml(html) {
  if (!html || !html.includes(ATTRIBUTE)) return null
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const holder = doc.querySelector(`[${ATTRIBUTE}]`)
  if (!holder) return null
  try { return parse(decodeURIComponent(holder.getAttribute(ATTRIBUTE))) } catch { return null }
}

// { slideId, elements } from a paste event's clipboard, or null when it
// holds no elements copied from Parallax
export function readElements(dataTransfer) {
  const own = dataTransfer.getData(ELEMENTS_TYPE)
  if (own) return parse(own)
  return elementsFromHtml(dataTransfer.getData('text/html'))
}

const escapeText = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Plain text as a text box's paragraphs
export function textToHtml(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n')
  return lines.map(line => line ? `<p>${escapeText(line)}</p>` : '<p></p>').join('')
}

const KEPT_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'a']
const BLOCKS = 'p, h1, h2, h3, ul, ol, pre, blockquote'

// HTML copied from another app (a web page, a word processor) as a text
// box's content: its structure and bold, italic and underline, without its
// fonts, colors and sizes, which were chosen for a white page
export function sanitizePastedHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html')
  // Styles that mean bold, italic or underline become those tags, before the
  // styles go. A word processor can wrap everything in a <b> that isn't bold.
  for (const el of [...doc.body.querySelectorAll('[style]')]) {
    const style = el.getAttribute('style').toLowerCase()
    const weight = /font-weight\s*:\s*(\d+|bold|normal)/.exec(style)?.[1]
    if (el.tagName === 'B' && weight && (weight === 'normal' || Number(weight) < 600)) {
      el.replaceWith(...el.childNodes)
      continue
    }
    let inner = null
    const wrap = tag => {
      const outer = doc.createElement(tag)
      if (inner) inner.replaceWith(outer)
      else el.replaceWith(outer)
      outer.append(...(inner ? [inner] : [el]))
      inner = outer
    }
    if (el.tagName === 'SPAN') {
      if (weight === 'bold' || Number(weight) >= 600) wrap('strong')
      if (/font-style\s*:\s*italic/.test(style)) wrap('em')
      if (/text-decoration[^;]*underline/.test(style)) wrap('u')
    }
  }
  const clean = DOMPurify.sanitize(doc.body.innerHTML, { ALLOWED_TAGS: KEPT_TAGS, ALLOWED_ATTR: ['href'], KEEP_CONTENT: true })
  const out = new DOMParser().parseFromString(clean, 'text/html').body
  // Words outside any paragraph go into one
  if (!out.querySelector(BLOCKS)) return out.textContent.trim() ? `<p>${out.innerHTML.trim()}</p>` : ''
  return out.innerHTML.trim()
}

// Where pasted elements go: where they were copied from, or, on the slide
// they're still on, `step` px down and to the right for each paste so far
// (`pastes` counts this one), kept on a canvas `width` by `height`
export function placePasted(elements, { sameSlide, pastes = 1, width = 960, height = 540, step = 20 }) {
  const shift = sameSlide ? step * pastes : 0
  if (!shift) return elements
  return elements.map(el => ({
    ...el,
    x: Math.max(0, Math.min((el.x || 0) + shift, width - (el.width || 100))),
    y: Math.max(0, Math.min((el.y || 0) + shift, height - (el.height || 100))),
  }))
}

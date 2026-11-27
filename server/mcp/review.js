// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// check_deck: what an AI reviewing a presentation should look at, found
// without drawing it. Per slide: elements past its edges and text boxes that
// overlap (format.js's warnings, as get_slide gives them), no title, more
// words than people read while listening, text set very small, images with
// no alt text, citations the bibliography doesn't have. For the deck: content
// slides without speaker notes, and the slides' minutes against the talk's
// length. render_deck shows what this can't: how the slides look.

const format = require('./format')

// More words than this on one slide (titles included) are more than people
// read while listening
const MAX_WORDS = 75
// Text set smaller than this many pixels, on a 960×540 slide, is hard to
// read from the back of a room
const MIN_TEXT_PX = 14
// Slides that need no speaker notes: they say it themselves
const NO_NOTES_LAYOUTS = new Set(['title', 'section-header', 'big-number', 'blank'])

const words = s => (s.match(/\S+/g) || []).length
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`
const list = numbers => {
  const out = []
  for (const n of numbers) {
    const last = out[out.length - 1]
    if (last && last[1] === n - 1) last[1] = n
    else out.push([n, n])
  }
  return out.map(([a, b]) => (a === b ? `${a}` : b === a + 1 ? `${a}, ${b}` : `${a}–${b}`)).join(', ')
}

// The keys a text box cites ([@key], <sup data-cite="key">)
function citedKeys(html) {
  const keys = []
  for (const [, value] of String(html || '').matchAll(/data-cite="([^"]*)"/g)) {
    for (const key of value.split(/[\s,;]+/)) if (key) keys.push(key)
  }
  return keys
}

// The smallest font size set inline in a text box, in pixels, or null
function smallestPx(html) {
  let least = null
  for (const [, px] of String(html || '').matchAll(/font-size:\s*([\d.]+)px/g)) {
    const n = Number(px)
    if (n > 0 && (least === null || n < least)) least = n
  }
  return least
}

// What's wrong with one slide, as lines
function slideProblems(deck, { slide }, known) {
  const w = Number(deck.slideWidth) || format.SLIDE_W
  const h = Number(deck.slideHeight) || format.SLIDE_H
  const out = [...format.warningsOf(slide, w, h)]
  const els = (slide.elements || []).filter(el => el && !el.layoutPart)
  if (!format.titleOf(slide) && slide.layout !== 'blank' && els.some(el => el.type === 'text' && format.hasText(el))) {
    out.push('It has no title: a title saying what the slide shows helps people follow.')
  }
  const texts = els.filter(el => el.type === 'text' && format.hasText(el))
  const count = texts.reduce((n, el) => n + words(format.textOf(el.content)), 0)
  if (count > MAX_WORDS) out.push(`${count} words: more than people read while listening. Cut it down, or move detail to the speaker notes.`)
  for (const el of texts) {
    const px = smallestPx(el.content)
    if (px !== null && px < MIN_TEXT_PX) out.push(`\`${el.id}\` has text set at ${px} px, too small to read from the back of a room.`)
  }
  for (const el of els) {
    if (el.type === 'image' && !String(el.alt || '').trim()) out.push(`Image \`${el.id}\` has no alt text.`)
  }
  const unknown = [...new Set(texts.flatMap(el => citedKeys(el.content)).filter(key => !known.has(key)))]
  if (unknown.length) out.push(`It cites ${unknown.map(k => `[@${k}]`).join(', ')}, which the bibliography doesn't have: they show as bare keys.`)
  return out
}

// The deck's review, as Markdown
function checkDeck(deck) {
  const shown = format.shownSlides(deck)
  if (!shown.length) return 'The presentation has no slides yet.'
  const known = new Set((deck.bibliography || []).map(e => e && e.key).filter(Boolean))
  const bySlide = shown.map(found => ({ found, problems: slideProblems(deck, found, known) })).filter(x => x.problems.length)

  const deckLines = []
  const noNotes = shown.filter(({ slide, number }) => number > 1 && !NO_NOTES_LAYOUTS.has(slide.layout) && !format.notesText(slide.notes)).map(s => s.number)
  if (noNotes.length) deckLines.push(`No speaker notes on ${plural(noNotes.length, 'slide')}: ${list(noNotes)}.`)
  const talk = Number(deck.talkMinutes) || 0
  const planned = shown.filter(({ slide }) => Number(slide.minutes) > 0)
  const total = Math.round(planned.reduce((n, { slide }) => n + Number(slide.minutes), 0) * 100) / 100
  if (talk > 0 && !planned.length) {
    deckLines.push(`The talk is planned at ${talk} minutes, but no slide has minutes: set them with update_outline, so Practice Talk can time each slide.`)
  } else if (talk > 0 && Math.abs(total - talk) > Math.max(1, talk * 0.1)) {
    deckLines.push(`The slides' minutes add up to ${total}, against a ${talk}-minute talk: ${total > talk ? 'cut slides or minutes' : 'there is room to spare'}.`)
  }
  if (planned.length && planned.length < shown.length) {
    const without = shown.filter(({ slide }) => !(Number(slide.minutes) > 0)).map(s => s.number)
    deckLines.push(`No minutes on ${plural(without.length, 'slide')}: ${list(without)}.`)
  }

  const count = bySlide.reduce((n, x) => n + x.problems.length, 0) + deckLines.length
  if (!count) return `No problems found on ${plural(shown.length, 'slide')}. These checks don't look at the slides: render_deck shows how they look.`
  const lines = [`${plural(count, 'problem')} found on ${plural(shown.length, 'slide')}. These checks don't look at the slides: render_deck shows how they look.`]
  if (deckLines.length) lines.push('', '## The whole deck', ...deckLines.map(l => `- ${l}`))
  for (const { found, problems } of bySlide) {
    const title = format.titleOf(found.slide)
    lines.push('', `## Slide ${found.number}${title ? `: ${title}` : ''}`, ...problems.map(p => `- ${p}`))
  }
  return lines.join('\n')
}

module.exports = { checkDeck, citedKeys, MAX_WORDS, MIN_TEXT_PX }

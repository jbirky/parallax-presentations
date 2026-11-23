// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The changes an AI collaborator can make to its presentation (server/mcp).
// Each operation takes the deck as plain JSON, changes it in place, and
// returns a line saying what it did, or throws an EditError saying what to
// fix. index.js runs a list of them against the deck as it is, to check
// them, then on the live document, where they land together or not at all.
//
// Slides are named as get_deck shows them, by number or id; elements as
// get_slide lists them, by id or number. Text is Markdown (markdown.js).
// Slides are filled through their layouts' placeholders, so most changes
// need no positions. Ink and practice runs are never touched, and outline
// notes change only through update_outline.

const { randomUUID } = require('crypto')
const { SLIDE_TEMPLATES, layoutElements } = require('../services/slide-layouts')
const { fillPlaceholder, changeLayout, titleOf: titleBoxOf } = require('../services/placeholders')
const { THEMES, newSlideBackground, isLegacyBackground, slidePalette, cleanThemeColors, THEME_COLOR_KEYS } = require('../services/themes')
const { CLOSED_SHAPES } = require('../services/shape-geometry')
const format = require('./format')
const { toHtml, MarkdownError, MAX_MARKDOWN } = require('./markdown')
const shared = require('./shared')
const guides = require('./guides')
const { EditError, fail, num, str, color, oneOf, object: objectValue, only } = require('./checks')


const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom', 'differential-rotation']
const LAYOUTS = Object.keys(SLIDE_TEMPLATES)
const ELEMENT_TYPES = ['text', 'shape', ...guides.TYPES]
const MAX_EDITS = 50
const MAX_SLIDES = 500
const MAX_ELEMENTS = 200
const MAX_OUTLINE_LINES = 40
const MAX_NOTES = 20000
const OUTLINE_LEVELS = 3
const MAX_BEAMER = 200000
const MAX_BIBTEX = 200000
const MAX_IMPORTED = 100

// ── Checking values (checks.js) ──

function markdown(value, name) {
  if (value === undefined) return undefined
  if (typeof value !== 'string') fail(`${name} must be Markdown text.`)
  try { return toHtml(value) } catch (err) { if (err instanceof MarkdownError) fail(`${name}: ${err.message}`); throw err }
}

// A CSS font family list, as deck fonts are (they go into the deck's CSS)
const FONT_LIST = { pattern: /^[\w\s,'"-]+$/, hint: 'must be a CSS font family list, such as "Georgia, serif".' }

// update_deck's textStyles: the styles to change, each null (or "" for the
// heading font) to go back to its default; null for all of them
const TEXT_STYLE_KEYS = [...shared.SIZE_KEYS, 'headingFont', 'headingWeight']
function textStylesPatch(value) {
  if (value === undefined || value === null) return value
  objectValue(value, 'textStyles')
  only(value, 'textStyles', TEXT_STYLE_KEYS)
  if (!Object.keys(value).length) fail(`textStyles needs at least one of ${TEXT_STYLE_KEYS.join(', ')}; or null for the defaults.`)
  const patch = {}
  for (const key of shared.SIZE_KEYS) {
    if (value[key] === null) patch[key] = null
    else if (value[key] !== undefined) patch[key] = num(value[key], `textStyles.${key}`, shared.MIN_SIZE, shared.MAX_SIZE)
  }
  if (value.headingFont !== undefined) patch.headingFont = value.headingFont === null ? null : str(value.headingFont, 'textStyles.headingFont', 100, FONT_LIST)
  if (value.headingWeight !== undefined) {
    const weight = typeof value.headingWeight === 'string' && value.headingWeight.trim() ? Number(value.headingWeight) : value.headingWeight
    patch.headingWeight = weight === null ? null : oneOf(weight, 'textStyles.headingWeight', shared.HEADING_WEIGHTS)
  }
  return patch
}

// update_deck's themeColors: the deck's own colors to change, over its
// theme's (client/src/utils/themes.js), each null to go back to the theme's;
// null for all of them
const THEME_COLOR = { min: 1, pattern: /^(#[0-9a-f]{3}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\))$/i, hint: 'must be a hex or rgb() color, such as "#d62828".' }
function themeColorsPatch(value) {
  if (value === undefined || value === null) return value
  objectValue(value, 'themeColors')
  only(value, 'themeColors', THEME_COLOR_KEYS)
  if (!Object.keys(value).length) fail(`themeColors needs at least one of ${THEME_COLOR_KEYS.join(', ')}; or null for the theme's.`)
  const patch = {}
  for (const key of THEME_COLOR_KEYS) {
    if (value[key] === null || value[key] === '') patch[key] = null
    else if (value[key] !== undefined) patch[key] = str(value[key], `themeColors.${key}`, 40, THEME_COLOR)
  }
  return patch
}

// What scopeThemeCss left out, in short
const droppedList = dropped => dropped.slice(0, 10).map(d => `${d.line ? `line ${d.line}: ` : ''}${d.reason}`).join('; ') + (dropped.length > 10 ? `; and ${dropped.length - 10} more` : '')

const textList = (value, name) => (Array.isArray(value) ? value : [value]).map((v, i) => {
  if (typeof v !== 'string') fail(`${name}${Array.isArray(value) ? ` item ${i + 1}` : ''} must be Markdown text.`)
  return v
})

// ── Finding slides and elements ──

const isNumberRef = ref => (typeof ref === 'number' && Number.isInteger(ref)) || (typeof ref === 'string' && /^\d+$/.test(ref))

function slideAt(deck, ref, name = 'slide') {
  if (ref === undefined || ref === null || ref === '') fail(`Say which ${name}: a number from get_deck or its id.`)
  const found = format.findSlide(deck, ref)
  if (!found) {
    const count = format.shownSlides(deck).length
    fail(`There's no slide ${JSON.stringify(ref)}${name === 'slide' ? '' : ` for ${name}`}. The presentation has ${count} slide${count === 1 ? '' : 's'}: give a number from 1 to ${count}, or an id from get_deck.`)
  }
  return found
}

function elementAt(slide, ref, number) {
  const els = format.elementsInOrder(slide)
  let el = els.find(e => String(e.id) === String(ref))
  if (!el && isNumberRef(ref)) el = els[Number(ref) - 1]
  if (!el) fail(`Slide ${number} has no element ${JSON.stringify(ref)}. get_slide lists its ${els.length} element${els.length === 1 ? '' : 's'}, with their ids.`)
  return el
}

const numberOf = (deck, slide) => format.shownSlides(deck).find(s => s.slide === slide)?.number

// Where `after` puts a slide in deck.slides: 0 for the start, a slide for
// after it, nothing for the end
function insertIndex(deck, after, moving = null) {
  const slides = deck.slides
  if (after === undefined || after === null) return { index: slides.length, before: slides[slides.length - 1] }
  if (after === 0 || after === '0') return { index: 0, before: null }
  const target = slideAt(deck, after, 'after').slide
  if (target === moving) fail('A slide can\'t go after itself.')
  return { index: slides.indexOf(target) + 1, before: target }
}

// ── Beamer ──

// The slides LaTeX Beamer source makes, as the editor's File › Import ›
// LaTeX Beamer… makes them (utils/beamerSlides.js), with the references it
// cites. An import is checked on the deck as it is, then made on the live
// document, so the source is read once for both.
const converted = new WeakMap()

function convertBeamer(deck, input, before) {
  if (converted.has(input)) return converted.get(input)
  const source = str(input.source, 'source', MAX_BEAMER, { min: 1 })
  if (source === undefined) fail('import_beamer needs source: the Beamer LaTeX, from \\documentclass{beamer} or just its frames.')
  const bibtex = str(input.bibtex, 'bibtex', MAX_BIBTEX)
  let doc
  try {
    doc = shared.readBeamer(source)
  } catch (err) {
    fail(`The Beamer source couldn't be read: ${err.message}`)
  }
  if (!doc.frames || !doc.frames.length) fail('The source has no frames. Each slide is a \\begin{frame} … \\end{frame}.')
  let incoming = []
  if (bibtex) {
    try { incoming = shared.parseBibtex(bibtex) } catch (err) { fail(`The BibTeX couldn't be read: ${err.message}`) }
  }
  for (const item of doc.bibItems || []) incoming.push({ type: 'misc', key: item.key, title: item.text })
  const library = deck.bibliography || []
  const references = shared.mergeBibliography(library, incoming)
  const citeKey = shared.citeKeyFinder(references.keyMap, library)
  const order = new Map()
  const unlinked = new Set()
  const cite = key => {
    const k = citeKey(key)
    if (!k) { unlinked.add(key); return null }
    if (!order.has(k)) order.set(k, order.size + 1)
    return { key: k, label: `[${order.get(k)}]` }
  }
  const look = slidePalette(before || deck.slides[0] || {}, deck.theme).dark ? 'dark' : 'light'
  const layout = shared.beamerSlides(doc, { slideW: Number(deck.slideWidth) || 960, slideH: Number(deck.slideHeight) || 540, look, overlays: 'steps', cite })
  if (!layout.slides.length) fail('The source\'s frames made no slides.')
  if (layout.slides.length > MAX_IMPORTED) fail(`The source makes ${layout.slides.length} slides; import up to ${MAX_IMPORTED} at a time.`)
  const slides = layout.slides.map(s => s.slide)
  const cited = shared.citedKeys(slides)
  const result = {
    slides,
    frames: new Set(layout.slides.map(s => s.frame)).size,
    added: references.added.filter(e => cited.has(e.key)),
    missing: layout.missing,
    crowded: layout.crowded,
    unlinked: [...unlinked],
    warnings: doc.warnings || [],
  }
  converted.set(input, result)
  return result
}

// ── Text boxes ──

const byReading = (a, b) => ((Number(a.y) || 0) - (Number(b.y) || 0)) || ((Number(a.x) || 0) - (Number(b.x) || 0))
const placeholdersOf = (slide, role) => (slide.elements || []).filter(el => el && el.type === 'text' && el.placeholder === role).sort(byReading)

// An empty copy of a text box's first block: its heading level and alignment
function emptyBlock(content, fallback) {
  const m = /<(h[1-6]|p)\b[^>]*>/i.exec(content || '')
  return m ? `${m[0]}</${m[1]}>` : fallback
}

// A title (or subtitle) box: the words go into its first block, which keeps
// its heading level and alignment, as Change layout does
function writeLine(el, html, role) {
  const template = emptyBlock(el.content, role === 'title' ? '<h2></h2>' : '<p></p>')
  el.content = html ? fillPlaceholder(template, html, role) : template
}

// A body box: paragraphs and lists as written, in the box's alignment
function writeBody(el, html) {
  if (html) el.content = fillPlaceholder(el.content || '<p></p>', html, 'body')
  else el.content = /^\s*<ul\b/i.test(el.content || '') ? '<ul><li><p></p></li></ul>' : '<p></p>'
}

// A text box's text, as its kind of box takes it
function writeText(el, html) {
  if (el.placeholder === 'title' || el.placeholder === 'subtitle') writeLine(el, html, el.placeholder)
  else if (el.placeholder) writeBody(el, html)
  else el.content = html || '<p></p>'
}

const layoutSummary = key => {
  const parts = (SLIDE_TEMPLATES[key].elements || []).filter(el => el.type === 'text' && el.placeholder)
  const count = role => parts.filter(p => p.placeholder === role).length
  const say = (role, n) => (n === 0 ? null : n === 1 ? role : `${n} ${role === 'body' ? 'bodies' : role + 's'}`)
  const roles = [say('title', count('title')), say('subtitle', count('subtitle')), say('body', count('body'))].filter(Boolean)
  return `${key} (${roles.length ? roles.join(', ') : 'nothing to fill'})`
}

// title, subtitle and body into a slide's placeholders
function fillText(slide, input, touch) {
  if (input.title !== undefined) {
    const html = markdown(input.title, 'title')
    const box = placeholdersOf(slide, 'title')[0] || titleBoxOf(slide.elements || [])
    if (!box) fail('This slide has no title box. Give it a layout with a title (update_slide\'s layout), or add a text box with add_element.')
    writeLine(box, html, 'title')
    touch(box)
  }
  for (const role of ['subtitle', 'body']) {
    if (input[role] === undefined) continue
    const parts = textList(input[role], role)
    const boxes = placeholdersOf(slide, role)
    if (!boxes.length) {
      fail(`This slide has no ${role} placeholder. Change one of its text boxes with update_element (get_slide lists them), or give it a layout that has one with update_slide's layout, which moves its text into the new placeholders.`)
    }
    if (parts.length > boxes.length) {
      fail(`This slide has ${boxes.length} ${role} placeholder${boxes.length === 1 ? '' : 's'}, and ${role} has ${parts.length} parts. Give at most ${boxes.length}, in reading order.`)
    }
    parts.forEach((md, i) => {
      const html = markdown(md, role)
      if (role === 'body') writeBody(boxes[i], html)
      else writeLine(boxes[i], html, role)
      touch(boxes[i])
    })
  }
}

function notesOf(value) {
  const s = str(value, 'notes', MAX_NOTES)
  return s ?? ''
}

// An outline as Markdown list lines, as [{ text, level }]: two spaces of
// indent a level, up to three levels
function outlineOf(value) {
  if (typeof value !== 'string') fail('outline must be Markdown list lines, such as "- First point\\n  - A detail".')
  const lines = value.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length > MAX_OUTLINE_LINES) fail(`outline can have up to ${MAX_OUTLINE_LINES} lines.`)
  return lines.map(line => {
    const indent = /^[ \t]*/.exec(line)[0].replace(/\t/g, '  ').length
    const text = line.trim().replace(/^([-*+]|\d+[.)])\s+/, '').slice(0, 300)
    return { text, level: Math.min(OUTLINE_LEVELS - 1, Math.floor(indent / 2)) }
  }).filter(n => n.text)
}

const maxZ = slide => (slide.elements || []).reduce((m, el) => Math.max(m, Number(el?.zIndex) || 0), 0)

function geometry(input, el = {}) {
  const out = {
    x: num(input.x, 'x', -960, 1920),
    y: num(input.y, 'y', -540, 1080),
    width: num(input.width, 'width', 1, 4000),
    height: num(input.height, 'height', 1, 4000),
  }
  for (const [key, value] of Object.entries(out)) if (value !== undefined) el[key] = value
  return el
}

// ── Graphs, diagrams and the other guided elements (guides.js) ──

// What a guided element's checks need to know about where it goes
function slideContext(deck, slide, ctx) {
  return { dark: !!slidePalette(slide, deck.theme).dark, slideW: Number(deck.slideWidth) || 960, slideH: Number(deck.slideHeight) || 540, datasets: ctx.datasets || null }
}

// A line saying what an edit did, with what the element's checks noticed
function withNotes(line, ctx) {
  const notes = ctx.notes.splice(0)
  return notes.length ? `${line} Notes: ${notes.join(' ')}` : line
}

function addGuided(deck, slide, number, input, ctx) {
  const type = input.type
  for (const key of ['text', 'shape', 'fill', 'stroke', 'strokeWidth', 'textColor', 'fontSize']) {
    if (input[key] !== undefined) fail(`${key} is for text boxes and shapes; a ${type} takes spec (get_element_guide with type ${type} says what).`)
  }
  const cx = slideContext(deck, slide, ctx)
  const given = geometry(input, {})
  // A geometry construction is framed for its box, so its size comes first
  let size = null
  if (guides.GUIDES[type].sized) {
    const natural = guides.GUIDES[type].size({}, cx)
    const w = given.width ?? (given.height ? Math.round(given.height * natural.w / natural.h) : natural.w)
    size = { w, h: given.height ?? Math.round(w * natural.h / natural.w) }
  }
  const { fields, notes } = guides.makeSpec(type, input.spec ?? {}, cx, { template: input.template, size: size || { w: 640, h: 400 } })
  const fit = size ? { w: size.w, h: size.h, ratio: size.h / size.w } : guides.defaultSize(type, fields, cx)
  const width = given.width ?? (given.height ? Math.round(given.height / fit.ratio) : fit.w)
  const height = given.height ?? (given.width ? Math.round(given.width * fit.ratio) : fit.h)
  const el = {
    id: randomUUID(), type,
    x: given.x ?? Math.round((cx.slideW - width) / 2), y: given.y ?? Math.round((cx.slideH - height) / 2),
    width, height, zIndex: maxZ(slide) + 1, ...fields,
  }
  if (!Array.isArray(slide.elements)) slide.elements = []
  slide.elements.push(el)
  ctx.touch(slide, [el])
  ctx.notes.push(...notes)
  return withNotes(`Added a ${type} \`${el.id}\` to slide ${number} at x ${el.x}, y ${el.y}, ${el.width}×${el.height}${input.template ? `, from the ${input.template} template` : ''}.`, ctx)
}

// ── The operations ──

const OPS = {
  update_deck(deck, input, ctx) {
    const done = []
    const title = str(input.title, 'title', 200, { min: 1 })
    if (title !== undefined) { deck.title = title; done.push(`title to "${title}"`) }
    const theme = oneOf(input.theme, 'theme', Object.keys(THEMES))
    if (theme !== undefined) {
      deck.theme = theme
      // As the editor's theme gallery does: slides with the old dark
      // default take the theme's page
      for (const slide of deck.slides || []) if (slide && isLegacyBackground(slide.background)) delete slide.background
      done.push(`theme to ${theme}`)
      // A new theme brings its own colors, as the theme gallery does,
      // unless this change gives the deck some
      if (input.themeColors === undefined && deck.themeColors) {
        delete deck.themeColors
        done.push("own colors back to the theme's")
      }
    }
    // The deck's own colors over its theme's (the Themes panel's Customize)
    const colors = themeColorsPatch(input.themeColors)
    if (colors !== undefined) {
      const merged = colors ? { ...(deck.themeColors || {}) } : null
      if (merged) for (const [key, value] of Object.entries(colors)) { if (value === null) delete merged[key]; else merged[key] = value }
      const next = merged && cleanThemeColors(merged)
      if (next) deck.themeColors = next
      else delete deck.themeColors
      done.push(next ? `own colors to ${Object.entries(next).map(([key, value]) => `${key} ${value}`).join(', ')}` : "own colors back to the theme's")
    }
    // The deck's stylesheet (the Themes panel's CSS tab), kept as written and
    // checked, as every page that draws it checks it (client/src/utils/scopeCss.js)
    if (input.themeCss !== undefined) {
      if (input.themeCss !== null && typeof input.themeCss !== 'string') fail('themeCss must be CSS text, or "" for none.')
      const source = input.themeCss || ''
      if (source.length > shared.MAX_THEME_CSS) fail(`themeCss can be up to ${shared.MAX_THEME_CSS} characters.`)
      if (!source.trim()) {
        delete deck.themeCss
        done.push('stylesheet removed')
      } else {
        const { css, dropped } = shared.scopeThemeCss(source)
        if (!css) fail(`Nothing in themeCss can be used${dropped.length ? `: ${droppedList(dropped)}` : ''}. get_theme lists what rules can target.`)
        deck.themeCss = source
        done.push(`stylesheet (${source.length} characters${dropped.length ? `; left out when drawn: ${droppedList(dropped)}` : ''})`)
      }
    }
    const font = str(input.font, 'font', 100, FONT_LIST)
    if (font !== undefined) {
      if (font) deck.globalFont = font
      else delete deck.globalFont
      done.push(font ? `font to ${font}` : 'font back to Arial')
    }
    // The size and font of every slide's text, as the Themes panel's Text
    // tab sets them (client/src/utils/textStyles.js)
    const styles = textStylesPatch(input.textStyles)
    if (styles !== undefined) {
      const next = styles && shared.withTextStyles(deck.textStyles, styles)
      if (next) deck.textStyles = next
      else delete deck.textStyles
      done.push(next ? `text styles to ${format.textStylesFacts(next).replace(/^text /, '')}` : 'text styles back to the defaults')
    }
    const transition = oneOf(input.transition, 'transition', TRANSITIONS)
    if (transition !== undefined) { deck.transition = transition; done.push(`transition to ${transition}`) }
    const minutes = num(input.talkMinutes, 'talkMinutes', 1, 600)
    if (minutes !== undefined) { deck.timerDuration = minutes; done.push(`talk length to ${minutes} minutes`) }
    if (!done.length) fail('update_deck needs at least one of title, theme, font, textStyles, themeColors, themeCss, transition or talkMinutes.')
    ctx.deckChanged = true
    return `Changed the presentation's ${done.join(', ')}.`
  },

  add_slide(deck, input, ctx) {
    const key = oneOf(input.layout ?? 'title-content', 'layout', LAYOUTS)
    const template = SLIDE_TEMPLATES[key]
    if (!Array.isArray(deck.slides)) deck.slides = []
    if (deck.slides.length >= MAX_SLIDES) fail(`A presentation can have up to ${MAX_SLIDES} slides.`)
    const { index, before } = insertIndex(deck, input.after)
    const is2D = deck.slides.some(s => s && s.column !== undefined)
    const background = newSlideBackground(before || deck.slides[0])
    const slide = {
      id: randomUUID(),
      ...(is2D ? { column: (before || deck.slides[0])?.column ?? 0 } : {}),
      layout: key,
      elements: layoutElements(template, randomUUID),
      notes: '',
      ...(background ? { background } : {}),
      ...(template.layoutGrid ? { layoutGrid: { ...template.layoutGrid } } : {}),
      ...(template.axisLines ? { axisLines: template.axisLines.map(a => ({ ...a, id: randomUUID() })) } : {}),
    }
    fillText(slide, input, () => {})
    if (input.notes !== undefined) slide.notes = notesOf(input.notes)
    const minutes = num(input.minutes, 'minutes', 0, 120)
    if (minutes) slide.minutes = minutes
    deck.slides.splice(index, 0, slide)
    ctx.touch(slide, slide.elements.filter(el => !el.layoutPart))
    return `Added slide ${numberOf(deck, slide)} (\`${slide.id}\`), layout ${key}.`
  },

  update_slide(deck, input, ctx) {
    const { slide, number } = slideAt(deck, input.slide)
    const done = []
    const touched = []
    const key = oneOf(input.layout, 'layout', LAYOUTS)
    if (key !== undefined) {
      const template = SLIDE_TEMPLATES[key]
      slide.elements = changeLayout(slide, template, randomUUID)
      slide.layout = key
      if (template.layoutGrid) slide.layoutGrid = { ...template.layoutGrid }
      if (template.axisLines) slide.axisLines = template.axisLines.map(a => ({ ...a, id: randomUUID() }))
      touched.push(...slide.elements.filter(el => el.placeholder))
      done.push(`layout to ${key}`)
    }
    const before = touched.length
    fillText(slide, input, el => touched.push(el))
    if (touched.length > before) done.push(['title', 'subtitle', 'body'].filter(r => input[r] !== undefined).join(', '))
    if (input.notes !== undefined) { slide.notes = notesOf(input.notes); done.push('speaker notes') }
    const minutes = num(input.minutes, 'minutes', 0, 120)
    if (minutes !== undefined) {
      if (minutes) slide.minutes = minutes
      else delete slide.minutes
      done.push('minutes')
    }
    if (input.background !== undefined) {
      if (input.background === 'theme') delete slide.background
      else slide.background = { type: 'color', color: color(input.background, 'background') }
      done.push('background')
    }
    if (!done.length) fail('update_slide needs at least one of layout, title, subtitle, body, notes, minutes or background.')
    ctx.touch(slide, touched)
    return `Changed slide ${number}'s ${done.join(', ')}.`
  },

  move_slide(deck, input, ctx) {
    if ((deck.slides || []).some(s => s && s.column !== undefined)) {
      fail('This presentation has columns of slides, which only the editor can rearrange. Describe the move to the person instead.')
    }
    const { slide, number } = slideAt(deck, input.slide)
    if (input.after === undefined) fail('Say where it goes with after: a slide\'s number or id, or 0 for first.')
    const target = input.after === 0 || input.after === '0' ? null : slideAt(deck, input.after, 'after').slide
    if (target === slide) fail('A slide can\'t go after itself.')
    deck.slides.splice(deck.slides.indexOf(slide), 1)
    deck.slides.splice(target ? deck.slides.indexOf(target) + 1 : 0, 0, slide)
    ctx.touch(slide, [])
    return `Moved slide ${number} to be slide ${numberOf(deck, slide)}.`
  },

  delete_slide(deck, input, ctx) {
    const { slide, number } = slideAt(deck, input.slide)
    if (deck.slides.filter(Boolean).length <= 1) fail('That\'s the only slide; a presentation needs one.')
    deck.slides.splice(deck.slides.indexOf(slide), 1)
    ctx.removed(slide)
    return `Deleted slide ${number} (\`${slide.id}\`).`
  },

  add_element(deck, input, ctx) {
    const { slide, number } = slideAt(deck, input.slide)
    const type = input.type
    if (!ELEMENT_TYPES.includes(type)) {
      fail(`type must be one of: ${ELEMENT_TYPES.join(', ')}. Images, video, molecules and plugins can't be added through a link yet: describe them to the person, who can add them in the editor.`)
    }
    if ((slide.elements || []).length >= MAX_ELEMENTS) fail(`A slide can have up to ${MAX_ELEMENTS} elements.`)
    if (guides.GUIDES[type]) return addGuided(deck, slide, number, input, ctx)
    for (const key of ['spec', 'template']) if (input[key] !== undefined) fail(`${key} is for graphs, diagrams and the other guided elements; a ${type} takes text${type === 'shape' ? ' and its look' : ''}.`)
    const el = { id: randomUUID(), type, x: 80, y: 140, width: type === 'text' ? 800 : 200, height: type === 'text' ? 120 : 120, zIndex: maxZ(slide) + 1 }
    geometry(input, el)
    if (type === 'text') {
      for (const key of ['shape', 'fill', 'stroke', 'strokeWidth', 'textColor', 'fontSize']) {
        if (input[key] !== undefined) fail(`${key} is for shapes. A text box's look comes from its Markdown and the theme.`)
      }
      el.content = markdown(input.text ?? '', 'text') || '<p></p>'
      // Its text shrinks to fit the box, as a layout's text does
      el.sizeMode = 'shrink'
    } else {
      Object.assign(el, {
        shape: oneOf(input.shape ?? 'rect', 'shape', CLOSED_SHAPES),
        fill: color(input.fill ?? '#6366f1', 'fill'),
        stroke: color(input.stroke ?? 'none', 'stroke'),
        strokeWidth: num(input.strokeWidth ?? 0, 'strokeWidth', 0, 50),
        text: str(input.text ?? '', 'text', 500),
        fontSize: num(input.fontSize ?? 18, 'fontSize', 6, 200),
        textColor: color(input.textColor ?? '#ffffff', 'textColor'),
      })
    }
    if (!Array.isArray(slide.elements)) slide.elements = []
    slide.elements.push(el)
    ctx.touch(slide, [el])
    return `Added a ${type} \`${el.id}\` to slide ${number}.`
  },

  update_element(deck, input, ctx) {
    const { slide, number } = slideAt(deck, input.slide)
    const el = elementAt(slide, input.element, number)
    const done = []
    if (input.spec !== undefined || input.template !== undefined) {
      if (!guides.GUIDES[el.type]) fail(`spec and template are for graphs, diagrams and the other guided elements (${guides.TYPES.join(', ')}); this is a ${el.type}.`)
      const cx = slideContext(deck, slide, ctx)
      const size = { w: Number(input.width ?? el.width) || 640, h: Number(input.height ?? el.height) || 400 }
      const { fields, notes } = guides.makeSpec(el.type, input.spec ?? {}, cx, { template: input.template, size, element: input.template === undefined ? el : null })
      for (const key of guides.FIELDS[el.type]) delete el[key]
      Object.assign(el, fields)
      // A drawing keeps its width, and its height follows its new shape, as its editor does
      if (input.height === undefined && guides.GUIDES[el.type].keepsShape) {
        const { ratio } = guides.defaultSize(el.type, fields, cx)
        el.height = Math.max(20, Math.round((Number(input.width ?? el.width) || 400) * ratio))
      }
      done.push(input.template !== undefined ? `contents, from the ${input.template} template` : 'contents')
      ctx.notes.push(...notes)
    }
    const moved = geometry(input, {})
    if (Object.keys(moved).length) { Object.assign(el, moved); done.push('position and size') }
    const rotation = num(input.rotation, 'rotation', -360, 360)
    if (rotation !== undefined) { el.rotation = rotation; done.push('rotation') }
    const opacity = num(input.opacity, 'opacity', 0, 1)
    if (opacity !== undefined) { el.opacity = opacity; done.push('opacity') }
    if (input.text !== undefined) {
      if (el.type === 'text') writeText(el, markdown(input.text, 'text'))
      else if (el.type === 'shape') el.text = str(input.text, 'text', 500)
      else if (guides.GUIDES[el.type]) fail(`A ${el.type} changes through spec (get_element_guide with type ${el.type} says what it takes), not text.`)
      else fail(`A ${el.type} element's contents can't be changed through a link yet, only its position, size, rotation and opacity. Describe the change to the person.`)
      done.push('text')
    }
    const styles = { shape: v => oneOf(v, 'shape', CLOSED_SHAPES), fill: v => color(v, 'fill'), stroke: v => color(v, 'stroke'),
      strokeWidth: v => num(v, 'strokeWidth', 0, 50), textColor: v => color(v, 'textColor'), fontSize: v => num(v, 'fontSize', 6, 200) }
    for (const [key, check] of Object.entries(styles)) {
      if (input[key] === undefined) continue
      if (el.type !== 'shape') fail(`${key} is for shapes; this is a ${el.type}.${el.type === 'text' ? ' A text box\'s look comes from its Markdown and the theme.' : ''}`)
      el[key] = check(input[key])
      done.push(key)
    }
    if (!done.length) fail('update_element needs something to change: x, y, width, height, rotation, opacity, text, a shape\'s look, or a guided element\'s spec.')
    ctx.touch(slide, [el])
    return withNotes(`Changed \`${el.id}\` on slide ${number}: ${done.join(', ')}.`, ctx)
  },

  delete_element(deck, input, ctx) {
    const { slide, number } = slideAt(deck, input.slide)
    const el = elementAt(slide, input.element, number)
    slide.elements = slide.elements.filter(e => e !== el)
    ctx.touch(slide, [])
    return `Deleted the ${el.type} \`${el.id}\` from slide ${number}.`
  },

  import_beamer(deck, input, ctx) {
    if (!Array.isArray(deck.slides)) deck.slides = []
    const { index, before } = insertIndex(deck, input.after)
    const result = convertBeamer(deck, input, before)
    if (deck.slides.length + result.slides.length > MAX_SLIDES) fail(`A presentation can have up to ${MAX_SLIDES} slides, and this would make ${deck.slides.length + result.slides.length}.`)
    const is2D = deck.slides.some(s => s && s.column !== undefined)
    const column = is2D ? (before || deck.slides[0])?.column ?? 0 : undefined
    const slides = result.slides.map(slide => ({ ...structuredClone(slide), ...(column === undefined ? {} : { column }) }))
    deck.slides.splice(index, 0, ...slides)
    if (result.added.length) deck.bibliography = [...(deck.bibliography || []), ...structuredClone(result.added)]
    ctx.touch(slides[0], [])
    const first = numberOf(deck, slides[0]), last = numberOf(deck, slides[slides.length - 1])
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
    const lines = [`Added ${plural(slides.length, 'slide')} from ${plural(result.frames, 'frame')}, as ${first === last ? `slide ${first}` : `slides ${first} to ${last}`}.`]
    if (slides.length > result.frames) lines.push('Frames with overlays became a slide for each step, shown one after another without a transition.')
    if (result.added.length) lines.push(`${plural(result.added.length, 'reference')} joined the bibliography: ${result.added.map(e => e.key).join(', ')}.`)
    if (result.unlinked.length) lines.push(`Citations not found in the BibTeX or the bibliography show as [key]: ${result.unlinked.join(', ')}.`)
    if (result.missing.length) lines.push(`Figures show as empty boxes, since Parallax has no copy of them: ${result.missing.join(', ')}. Tell the person, who can put the images in.`)
    if (result.crowded.length) lines.push(`Frame${result.crowded.length === 1 ? '' : 's'} ${result.crowded.join(', ')} may overflow the slide; check ${result.crowded.length === 1 ? 'it' : 'them'} with render_slide.`)
    for (const w of result.warnings.slice(0, 8)) lines.push(`${w.message}${w.frames && w.frames.length ? ` (frame${w.frames.length === 1 ? '' : 's'} ${w.frames.join(', ')})` : ''}`)
    return lines.join('\n')
  },

  update_outline(deck, input, ctx) {
    const { slide, number } = slideAt(deck, input.slide)
    const done = []
    if (input.outline !== undefined) {
      const notes = outlineOf(input.outline)
      if (notes.length) slide.outlineNotes = notes
      else delete slide.outlineNotes
      done.push('outline notes')
    }
    const minutes = num(input.minutes, 'minutes', 0, 120)
    if (minutes !== undefined) {
      if (minutes) slide.minutes = minutes
      else delete slide.minutes
      done.push('minutes')
    }
    const section = str(input.section, 'section', 80)
    if (section !== undefined) {
      if (section) slide.section = section
      else delete slide.section
      done.push('section')
    }
    if (!done.length) fail('update_outline needs at least one of outline, minutes or section.')
    ctx.touch(slide, [])
    return `Changed slide ${number}'s ${done.join(', ')}.`
  },
}

// What each operation takes, for checking the edits apply_edits is given
const FIELDS = {
  update_deck: ['title', 'theme', 'font', 'textStyles', 'themeColors', 'themeCss', 'transition', 'talkMinutes'],
  add_slide: ['layout', 'after', 'title', 'subtitle', 'body', 'notes', 'minutes'],
  update_slide: ['slide', 'layout', 'title', 'subtitle', 'body', 'notes', 'minutes', 'background'],
  move_slide: ['slide', 'after'],
  delete_slide: ['slide'],
  add_element: ['slide', 'type', 'x', 'y', 'width', 'height', 'text', 'shape', 'fill', 'stroke', 'strokeWidth', 'textColor', 'fontSize', 'spec', 'template'],
  update_element: ['slide', 'element', 'x', 'y', 'width', 'height', 'rotation', 'opacity', 'text', 'shape', 'fill', 'stroke', 'strokeWidth', 'textColor', 'fontSize', 'spec', 'template'],
  delete_element: ['slide', 'element'],
  update_outline: ['slide', 'outline', 'minutes', 'section'],
  import_beamer: ['source', 'after', 'bibtex'],
}
const DESTRUCTIVE = new Set(['delete_slide', 'delete_element'])

// Makes edits, [{ op, ...fields }], to deck in place, in order. Returns
// { lines, slideId, elementIds }: what each did, and the slide changed last
// with the elements changed on it, for the AI's place in the avatars.
function runEdits(deck, edits, { datasets = null } = {}) {
  if (!Array.isArray(edits) || !edits.length) fail('Give at least one edit.')
  if (edits.length > MAX_EDITS) fail(`Give at most ${MAX_EDITS} edits at once.`)
  let slideId = null
  let elementIds = []
  const ctx = {
    datasets,
    notes: [],
    touch(slide, elements) {
      if (slide.id !== slideId) elementIds = []
      slideId = slide.id
      for (const el of elements) if (!elementIds.includes(el.id)) elementIds.push(el.id)
    },
    removed(slide) {
      if (slide.id === slideId) { slideId = null; elementIds = [] }
    },
  }
  const lines = edits.map((edit, i) => {
    const where = edits.length > 1 ? `Edit ${i + 1}` : 'The edit'
    if (!edit || typeof edit !== 'object' || Array.isArray(edit)) fail(`${where} must be an object with an op.`)
    const { op, ...input } = edit
    if (!OPS[op]) fail(`${where} has op ${JSON.stringify(op)}; it must be one of: ${Object.keys(OPS).join(', ')}.`)
    const unknown = Object.keys(input).filter(k => !FIELDS[op].includes(k))
    if (unknown.length) fail(`${where} (${op}) has ${unknown.map(k => JSON.stringify(k)).join(', ')}, which ${op} doesn't take. It takes: ${FIELDS[op].join(', ')}.`)
    try {
      return OPS[op](deck, input, ctx)
    } catch (err) {
      if (err instanceof EditError && edits.length > 1) throw new EditError(`${where} (${op}): ${err.message}`)
      throw err
    }
  })
  return { lines, slideId, elementIds: elementIds.slice(0, 20) }
}

// ── What the tools take (JSON Schema) ──

const ref = (description, min = 1) => ({ description, anyOf: [{ type: 'integer', minimum: min }, { type: 'string', minLength: 1, maxLength: 100 }] })
const SLIDE = ref('The slide: its number as get_deck shows it (1 is the first) or its id')
const AFTER = ref('The slide it goes after, by number or id; 0 puts it first', 0)
const ELEMENT = ref('The element: its id from get_slide, or its number in get_slide\'s list')
const md = (description, max = MAX_MARKDOWN) => ({ type: 'string', maxLength: max, description })
const mdParts = description => ({ description, anyOf: [{ type: 'string', maxLength: MAX_MARKDOWN }, { type: 'array', items: { type: 'string', maxLength: MAX_MARKDOWN }, minItems: 1, maxItems: 6 }] })
const number = (description, minimum, maximum) => ({ type: 'number', minimum, maximum, description })
const sizeOrNull = description => ({ anyOf: [{ type: 'number', minimum: shared.MIN_SIZE, maximum: shared.MAX_SIZE }, { type: 'null' }], description })
const colorField = description => ({ type: 'string', maxLength: 40, description })
const LAYOUT_LIST = LAYOUTS.map(layoutSummary).join('; ')

const TEXT_FIELDS = {
  title: md('The title, as one line of Markdown (math and citations work)', 2000),
  subtitle: mdParts('Subtitle text; a list fills several subtitle placeholders in reading order (the comparison layout\'s two column headings)'),
  body: mdParts('Body text as Markdown: "- " bullets, paragraphs, **bold**, $math$, [@citations]. A list of strings fills several body placeholders in reading order (two-column, three-column, comparison).'),
}
const SHAPE_FIELDS = {
  shape: { type: 'string', enum: CLOSED_SHAPES, description: 'For a shape: its outline' },
  fill: colorField('For a shape: its fill, such as "#6366f1", "rgba(0,0,0,0.3)" or "none"'),
  stroke: colorField('For a shape: its outline color, or "none"'),
  strokeWidth: number('For a shape: its outline width in pixels', 0, 50),
  textColor: colorField('For a shape: its label color'),
  fontSize: number('For a shape: its label size in pixels', 6, 200),
}
const GEOMETRY = {
  x: number('Left edge, in pixels from the slide\'s left (the slide is 960 wide)', -960, 1920),
  y: number('Top edge, in pixels from the slide\'s top (the slide is 540 tall)', -540, 1080),
  width: number('Width in pixels', 1, 4000),
  height: number('Height in pixels', 1, 4000),
}

const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false })
const SPEC_FIELDS = {
  spec: { type: 'object', description: 'For a graph, diagram or other guided element: its fields, as its guide (get_element_guide) says. In update_element, the fields given replace the element\'s.' },
  template: { type: 'string', maxLength: 40, description: 'For a diagram: the template to start from (its guide lists them), changed by spec' },
}

const SCHEMAS = {
  update_deck: object({
    title: { type: 'string', minLength: 1, maxLength: 200, description: 'The presentation\'s title' },
    theme: { type: 'string', enum: Object.keys(THEMES), description: 'Its theme: page, text and heading colors when presenting. A new theme clears themeColors unless they are given too.' },
    font: { type: 'string', maxLength: 100, description: 'Its font, as a CSS font family list such as "Georgia, serif"; "" for the default, Arial. It is body text\'s font, and the headings\' unless textStyles gives them one.' },
    textStyles: {
      description: 'The size and font of every slide\'s text, as the Themes panel\'s Text tab sets them. Only the fields given change; null puts one back to its default, and textStyles: null puts them all back. Text given a size or font of its own keeps it, and layout placeholders still shrink their text to fit. get_deck shows the current sizes.',
      anyOf: [{
        type: 'object',
        additionalProperties: false,
        properties: {
          h1Size: sizeOrNull('Heading 1 (section headers, the section-header layout\'s title), in pixels; default 105'),
          h2Size: sizeOrNull('Heading 2: the slide titles in every other layout, in pixels; default 67.2'),
          h3Size: sizeOrNull('Heading 3 (the comparison layout\'s column headings), in pixels; default 54.6'),
          bodySize: sizeOrNull('Body text: paragraphs, lists and subtitles, in pixels; default 42. Headings keep their sizes when it changes.'),
          headingFont: { anyOf: [{ type: 'string', maxLength: 100 }, { type: 'null' }], description: 'The headings\' font, as a CSS font family list such as "\'Computer Modern Serif\', serif"; "" or null for the same as body text' },
          headingWeight: { anyOf: [{ type: 'integer', enum: shared.HEADING_WEIGHTS }, { type: 'null' }], description: 'The headings\' weight, 400 (regular) to 900 (black); default 700 (bold)' },
        },
      }, { type: 'null' }],
    },
    themeColors: {
      description: 'The deck\'s own colors over its theme\'s, as the Themes panel\'s Customize sets them: background (the page), text, heading, link, and accent (for themeCss, as var(--px-accent)). Hex or rgb() colors. Only the fields given change; null puts one back to the theme\'s, and themeColors: null puts them all back. Slides with a background of their own keep colors that show on it.',
      anyOf: [{
        type: 'object',
        additionalProperties: false,
        properties: Object.fromEntries(THEME_COLOR_KEYS.map(key => [key, { anyOf: [{ type: 'string', maxLength: 40 }, { type: 'null' }] }])),
      }, { type: 'null' }],
    },
    themeCss: {
      anyOf: [{ type: 'string', maxLength: shared.MAX_THEME_CSS }, { type: 'null' }],
      description: 'The deck\'s stylesheet, as the Themes panel\'s CSS tab holds it, replacing what is there; "" or null for none. It shows in the editor and when presenting. Every rule is scoped to a slide (.px-slide), so it styles slides only; read get_theme first for what rules can target. The reply lists rules left out, with their lines. Check the result with render_slide.',
    },
    transition: { type: 'string', enum: TRANSITIONS, description: 'How slides change when presenting' },
    talkMinutes: number('How long the talk is meant to run, in minutes', 1, 600),
  }),
  add_slide: object({
    layout: { type: 'string', enum: LAYOUTS, description: `Its layout; title-content if left out. Placeholders: ${LAYOUT_LIST}` },
    after: AFTER,
    ...TEXT_FIELDS,
    notes: md('Speaker notes, as plain text', MAX_NOTES),
    minutes: number('Minutes planned for the slide', 0, 120),
  }),
  update_slide: object({
    slide: SLIDE,
    layout: { type: 'string', enum: LAYOUTS, description: 'A new layout: its title and text move into the new placeholders, as Slide › Change layout does' },
    ...TEXT_FIELDS,
    notes: md('Speaker notes, as plain text, replacing what is there', MAX_NOTES),
    minutes: number('Minutes planned for the slide; 0 for none', 0, 120),
    background: colorField('A background color such as "#0b1021", or "theme" for the theme\'s own'),
  }, ['slide']),
  move_slide: object({ slide: SLIDE, after: AFTER }, ['slide', 'after']),
  delete_slide: object({ slide: SLIDE }, ['slide']),
  add_element: object({
    slide: SLIDE,
    type: { type: 'string', enum: ELEMENT_TYPES, description: `text (a text box, whose text shrinks to fit), shape, or a guided element: ${guides.TYPES.join(', ')}. Read a guided element's guide first (get_element_guide).` },
    ...GEOMETRY,
    text: md('A text box\'s text as Markdown, or a shape\'s label as plain text'),
    ...SHAPE_FIELDS,
    ...SPEC_FIELDS,
  }, ['slide', 'type']),
  update_element: object({
    slide: SLIDE,
    element: ELEMENT,
    ...GEOMETRY,
    rotation: number('Rotation in degrees', -360, 360),
    opacity: number('Opacity, from 0 to 1', 0, 1),
    text: md('New text: Markdown for a text box (replacing all its text; inline colors and sizes go), plain text for a shape\'s label'),
    ...SHAPE_FIELDS,
    ...SPEC_FIELDS,
  }, ['slide', 'element']),
  delete_element: object({ slide: SLIDE, element: ELEMENT }, ['slide', 'element']),
  update_outline: object({
    slide: SLIDE,
    outline: { type: 'string', maxLength: 12000, description: 'The slide\'s outline notes as Markdown list lines, two spaces of indent a level ("- Point\\n  - Detail"); "" clears them. They plan the talk and never show on the slide.' },
    minutes: number('Minutes planned for the slide; 0 for none', 0, 120),
    section: { type: 'string', maxLength: 80, description: 'The section the slide is in. Every slide of a section carries its name, so set it on each; "" for none.' },
  }, ['slide']),
  import_beamer: object({
    source: { type: 'string', minLength: 1, maxLength: MAX_BEAMER, description: 'LaTeX Beamer source: a whole document from \\documentclass{beamer}, or just frames. Macros it defines are expanded; \\input files and figures are not available.' },
    after: AFTER,
    bibtex: { type: 'string', maxLength: MAX_BIBTEX, description: 'BibTeX entries for what the source \\cite-s, which join the presentation\'s bibliography' },
  }, ['source']),
}

module.exports = { OPS, FIELDS, SCHEMAS, DESTRUCTIVE, LAYOUTS, LAYOUT_LIST, MAX_EDITS, runEdits, EditError }

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

export function parseBibtex(input) {
  const entries = []
  const re = /@(\w+)\s*\{\s*([^,\s{}]+)\s*,/g
  let match
  while ((match = re.exec(input)) !== null) {
    const type = match[1].toLowerCase()
    if (type === 'string' || type === 'preamble' || type === 'comment') continue
    const key = match[2].trim()
    const start = match.index + match[0].length
    const body = extractBraced(input, start)
    if (!body) continue
    const fields = parseFields(body)
    entries.push({ type, key, ...fields })
  }
  return entries
}

function extractBraced(str, from) {
  let depth = 1
  let i = from
  while (i < str.length && depth > 0) {
    if (str[i] === '{') depth++
    else if (str[i] === '}') depth--
    i++
  }
  return depth === 0 ? str.slice(from, i - 1) : null
}

// Fields that hold an address, kept as written: cleaning them as TeX would
// turn a URL's ~ into a space, or -- into a dash
const VERBATIM = new Set(['url', 'doi', 'eprint', 'file'])

function parseFields(body) {
  const fields = {}
  const re = /(\w+)\s*=\s*/g
  let m
  while ((m = re.exec(body)) !== null) {
    const name = m[1].toLowerCase()
    const valStart = m.index + m[0].length
    const val = readValue(body, valStart)
    if (val !== null) fields[name] = VERBATIM.has(name) ? val.trim() : cleanLatex(val)
  }
  return fields
}

function readValue(str, from) {
  let i = from
  while (i < str.length && /\s/.test(str[i])) i++
  if (i >= str.length) return null
  if (str[i] === '{') {
    let depth = 1
    let start = i + 1
    i++
    while (i < str.length && depth > 0) {
      if (str[i] === '{') depth++
      else if (str[i] === '}') depth--
      i++
    }
    return str.slice(start, i - 1)
  }
  if (str[i] === '"') {
    let start = i + 1
    i++
    while (i < str.length && str[i] !== '"') {
      if (str[i] === '\\') i++
      i++
    }
    return str.slice(start, i)
  }
  let start = i
  while (i < str.length && /[a-zA-Z0-9]/.test(str[i])) i++
  return str.slice(start, i)
}

// TeX's dashes: --- sets an em dash and -- an en dash
const texDashes = str => str.replace(/---/g, '\u2014').replace(/--/g, '\u2013')

function cleanLatex(str) {
  return texDashes(str)
    .replace(/\{([^{}]*)\}/g, '$1')
    .replace(/\\&/g, '&')
    .replace(/~/g, ' ')
    .replace(/``/g, '"')
    .replace(/''/g, '"')
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\emph\{([^}]*)\}/g, '$1')
    .trim()
}

// The names in an author list, split at each " and " outside braces, so an
// organisation's braced name stays whole however it reads
function splitNames(str) {
  const names = []
  let depth = 0, from = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') depth++
    else if (str[i] === '}') depth = Math.max(0, depth - 1)
    else if (depth === 0 && str[i] === ' ' && str.slice(i, i + 5).toLowerCase() === ' and ') {
      names.push(str.slice(from, i))
      from = i + 5
      i += 4
    }
  }
  names.push(str.slice(from))
  return names
}

export function parseAuthors(authorStr) {
  if (!authorStr) return []
  // Spaces squeezed first: author lists come from anyone's .bib
  return splitNames(authorStr.replace(/\s+/g, ' ')).map(a => {
    a = a.trim()
    // An organisation, in braces as BibTeX writes one: {Planck Collaboration}
    if (/^\{[^{}]*\}$/.test(a)) return { first: '', last: a.slice(1, -1).trim() }
    a = a.replace(/[{}]/g, '')
    if (a.includes(',')) {
      const [last, first] = a.split(',').map(s => s.trim())
      return { first, last }
    }
    const parts = a.split(/\s+/)
    if (parts.length === 1) return { first: '', last: parts[0] }
    return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
  })
}

// BibTeX ends a list it cuts short with "and others": not an author
const isOthers = a => !!a && !a.first && /^others$/i.test(a.last)

export function formatAuthorsShort(authors) {
  if (!authors || authors.length === 0) return ''
  const people = authors.filter(a => !isOthers(a))
  if (people.length === 0) return ''
  if (people.length < authors.length) return `${people[0].last} et al.`
  if (people.length === 1) return people[0].last
  if (people.length === 2) return `${people[0].last} & ${people[1].last}`
  return `${people[0].last} et al.`
}

// Authors as a list of references prints them, "Ada Ames, Jane Doe and Rick
// Roe", or the first et al. when the list was cut short ("and others") or runs
// past six names
export function formatAuthorsReference(authors) {
  if (!authors || authors.length === 0) return ''
  const people = authors.filter(a => !isOthers(a))
  const name = a => a.first ? `${a.first} ${a.last}` : a.last
  if (people.length === 0) return ''
  if (people.length < authors.length || people.length > 6) return `${name(people[0])} et al.`
  if (people.length === 1) return name(people[0])
  return `${people.slice(0, -1).map(name).join(', ')} and ${name(people[people.length - 1])}`
}

export function formatAuthorsFull(authors) {
  if (!authors || authors.length === 0) return ''
  return authors.map(a => a.first ? `${a.first} ${a.last}` : a.last).join(', ')
}

export function formatCitation(entry, style, index) {
  const authors = parseAuthors(entry.author)
  const year = entry.year || ''
  if (style === 'author-year') {
    return `(${formatAuthorsShort(authors)}, ${year})`
  }
  return `[${index + 1}]`
}

export function getReferencedEntries(bibliography, slides) {
  if (!bibliography || !bibliography.length) return []
  const allText = (slides || []).flatMap(s => (s.elements || []).flatMap(el => {
    const parts = []
    if (el.content) parts.push(el.content)
    if (el.citationText) parts.push(el.citationText)
    return parts
  })).join(' ')

  return bibliography.filter((entry, i) => {
    if (allText.includes(`[${i + 1}]`)) return true
    const authors = parseAuthors(entry.author)
    const short = formatAuthorsShort(authors)
    if (short && allText.includes(short)) return true
    if (entry.key && allText.includes(entry.key)) return true
    return false
  })
}

// A reference's web link, for one with no DOI (a PubChem record), named by
// its site: { href, site }
export function webLink(url) {
  const href = String(url || '').trim()
  if (!/^https?:\/\//i.test(href)) return null
  try { return { href, site: new URL(href).hostname.replace(/^www\./, '') } } catch { return null }
}

// A page range as a reference prints it, with an en dash between its ends:
// from TeX's --, or a hyphen between two numbers (as Zotero gives them, and
// as bibliographies imported before -- was read still have them)
export function pageRange(pages) {
  return texDashes(String(pages || '').trim()).replace(/(\d)\s*[-\u2013]\s*(\d)/g, '$1\u2013$2')
}

// An entry's author field as a list of references prints it. A role written
// after the names, "Evans, Lyndon and Bryant, Philip (eds.)", stays at the end
// rather than joining the last name
export function formatAuthorLine(authorStr) {
  const str = String(authorStr || '')
  const role = /^(.*?)\s*(\([^(){}]*\))\s*$/.exec(str)
  const line = formatAuthorsReference(parseAuthors(role ? role[1] : str))
  return role && line ? `${line} ${role[2]}` : line
}

export function formatReference(entry, index) {
  const authorStr = formatAuthorLine(entry.author)
  const year = entry.year || ''
  const title = entry.title || ''
  const journal = entry.journal || entry.booktitle || ''
  const volume = entry.volume || ''
  const pages = pageRange(entry.pages)
  const doi = entry.doi || ''

  let ref = `[${index + 1}] ${authorStr}`
  if (year) ref += ` (${year})`
  ref += `. ${title}.`
  if (journal) ref += ` <em>${journal}</em>`
  if (volume) ref += `, ${volume}`
  if (pages) ref += `, ${pages}`
  ref += '.'
  if (doi) ref += ` DOI: ${doi}`
  return ref
}

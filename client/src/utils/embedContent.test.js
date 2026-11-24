import { describe, it, expect } from 'vitest'
import {
  hasEmbedContent, readEmbedContent, writeEmbedContent, contentJson,
  fieldLabel, fieldKind, tableColumns, blankRow, listToText, textToList,
} from './embedContent'

const page = json => `<div id="parts"></div>
<script type="application/json" data-parallax-content>${json}</script>
<script>
var C = JSON.parse(document.querySelector('[data-parallax-content]').textContent);
</script>`

describe('embed content blocks', () => {
  it('finds the block, and only a marked one', () => {
    expect(hasEmbedContent(page('{}'))).toBe(true)
    expect(hasEmbedContent('<script type="application/json">{}</script>')).toBe(false)
    expect(hasEmbedContent('')).toBe(false)
    expect(hasEmbedContent(undefined)).toBe(false)
    expect(readEmbedContent('<p>plain</p>')).toBe(null)
  })

  it('reads the JSON, and says what is wrong with it', () => {
    expect(readEmbedContent(page('{ "title": "Parts", "n": 5 }'))).toEqual({ data: { title: 'Parts', n: 5 } })
    expect(readEmbedContent(page('{ "title": ')).error).toMatch(/isn’t valid JSON/)
    expect(readEmbedContent(page('[1, 2]')).error).toMatch(/should hold/)
  })

  it('writes the block back and leaves the rest of the page alone', () => {
    const html = page('{"title":"Parts"}')
    const out = writeEmbedContent(html, { title: 'Parts list', rows: [{ item: 1 }] })
    expect(readEmbedContent(out).data).toEqual({ title: 'Parts list', rows: [{ item: 1 }] })
    expect(out.startsWith('<div id="parts"></div>\n<script type="application/json" data-parallax-content>\n{')).toBe(true)
    expect(out.endsWith(html.slice(html.indexOf('</script>')))).toBe(true)
    expect(writeEmbedContent('<p>no block</p>', { a: 1 })).toBe('<p>no block</p>')
  })

  it('keeps words that look like HTML or a replacement pattern from breaking the page', () => {
    const data = { note: 'Close with </script><script>alert(1)</script> <!-- or this', price: "$& and $1 and $'" }
    const out = writeEmbedContent(page('{}'), data)
    expect(out.match(/<\/script>/g)).toHaveLength(2)
    expect(out).not.toContain('<!--')
    expect(readEmbedContent(out).data).toEqual(data)
    expect(contentJson({ a: '<b>' })).toBe('{\n  "a": "\\u003cb>"\n}')
  })
})

describe('the form', () => {
  it('labels fields from their keys, or from $labels', () => {
    expect(fieldLabel('altitudeKm')).toBe('Altitude km')
    expect(fieldLabel('mass_kg')).toBe('Mass kg')
    expect(fieldLabel('trl')).toBe('TRL')
    expect(fieldLabel('id')).toBe('ID')
    expect(fieldLabel('max')).toBe('Max')
    expect(fieldLabel('to')).toBe('To')
    expect(fieldLabel('url')).toBe('URL')
    expect(fieldLabel('x')).toBe('X')
    expect(fieldLabel('t', { t: 'Time (s)' })).toBe('Time (s)')
  })

  it('picks a box for each kind of value', () => {
    expect(fieldKind('Booster')).toBe('text')
    expect(fieldKind('x'.repeat(61))).toBe('longtext')
    expect(fieldKind('two\nlines')).toBe('longtext')
    expect(fieldKind(3.5)).toBe('number')
    expect(fieldKind(true)).toBe('boolean')
    expect(fieldKind('open', ['open', 'closed'])).toBe('choice')
    expect(fieldKind(['a', 'b'])).toBe('list')
    expect(fieldKind([])).toBe('list')
    expect(fieldKind([{ a: 1 }, { a: 2 }])).toBe('table')
    expect(fieldKind({ a: 1 })).toBe('group')
    expect(fieldKind([[1, 2], [3, 4]])).toBe('json')
    expect(fieldKind(null)).toBe('json')
  })

  it('gives a table every row’s columns and a new row shaped like the last', () => {
    const rows = [{ id: 'A', mass: 3, notes: ['x'] }, { id: 'B', mass: 4, status: 'open', notes: [] }]
    expect(tableColumns(rows)).toEqual(['id', 'mass', 'notes', 'status'])
    expect(blankRow(rows, { status: ['open', 'closed'] })).toEqual({ id: '', mass: 4, notes: [], status: 'open' })
    expect(blankRow([])).toEqual({})
  })

  it('writes lists one item per line and reads numbers back as numbers', () => {
    expect(listToText(['a', 'b'])).toBe('a\nb')
    expect(textToList('a\nb\n\n')).toEqual(['a', 'b'])
    expect(textToList('1\n2.5\nx', [1, 2])).toEqual([1, 2.5, 'x'])
    expect(textToList('1\n2', ['a'])).toEqual(['1', '2'])
  })
})

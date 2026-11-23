// @vitest-environment happy-dom
// A file dropped on a slide: a figure matplotlib saved goes in whole, to be
// cut when it's opened (index.js figureFromFile); anything else doesn't
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { figureFromFile } from './index'

const fixture = name => readFileSync(`${process.cwd()}/src/utils/plotImport/fixtures/${name}`, 'utf8')

describe('a file dropped on a slide', () => {
  it('is a figure when matplotlib saved it: the SVG itself, and what was read of it', async () => {
    const made = await figureFromFile(new File([fixture('decay.svg')], 'decay.svg', { type: 'image/svg+xml' }))
    expect(made.type).toBe('image/svg+xml')
    expect(made.ext).toBe('svg')
    expect(await made.image.text()).toBe(fixture('decay.svg'))
    expect(made.result.plot.layers.map(l => l.name)).toEqual(['model', 'measured'])
  })

  it('isn’t, for any other picture or file', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'
    expect(await figureFromFile(new File([svg], 'logo.svg', { type: 'image/svg+xml' }))).toBeNull()
    expect(await figureFromFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }))).toBeNull()
  })
})

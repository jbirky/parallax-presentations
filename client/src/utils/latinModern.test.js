// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { latinModernFaces, addLatinModernFaces } from './latinModern'
import { generateRevealHTML } from './generateHTML'

const root = path.join(__dirname, '../../..')

describe('Latin Modern Roman', () => {
  it('is CMU Serif from the bundled latex.js, in four faces, whose files exist', () => {
    const css = latinModernFaces()
    const urls = [...css.matchAll(/url\('([^']+)'\)/g)].map(m => m[1])
    expect(urls).toHaveLength(4)
    expect(css.match(/font-style: (\w+); font-weight: (\d+)/g)).toEqual(['font-style: normal; font-weight: 400', 'font-style: normal; font-weight: 700', 'font-style: italic; font-weight: 400', 'font-style: italic; font-weight: 700'])
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/npm\/latex\.js@[\d.]+\/dist\/fonts\/Serif\/cmun(rm|bx|ti|bi)\.woff$/)
      expect(fs.existsSync(path.join(root, 'node_modules/latex.js', url.split(/latex\.js@[\d.]+\//)[1])), url).toBe(true)
    }
  })

  it('loads in the editor from the app’s own copy, once', () => {
    addLatinModernFaces(document)
    addLatinModernFaces(document)
    const styles = document.querySelectorAll('style[data-fonts="latin-modern"]')
    expect(styles).toHaveLength(1)
    expect(styles[0].textContent).toMatch(/url\('\/vendor\/latex\.js@[\d.]+\/dist\/fonts\/Serif\/cmunrm\.woff'\)/)
  })

  it('is declared by every deck', () => {
    const html = generateRevealHTML({ slides: [{ id: 's', elements: [] }] })
    expect(html).toContain(latinModernFaces().split('\n')[3])
    expect(html).not.toContain('lm-web-fonts')
  })
})

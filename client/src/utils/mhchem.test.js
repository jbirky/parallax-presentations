import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import katex from 'katex'
import 'katex/contrib/mhchem'

if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import { generateRevealHTML } from './generateHTML'
import { generateLatexIframeHtml } from './latexRenderer'
import { localizeLibraries } from './libraries'

const require = createRequire(import.meta.url)
const { packages } = require('../../../server/vendor-libraries.js')

const deck = { title: 'Talk', slideWidth: 960, slideHeight: 540, slides: [{ id: 's1', elements: [] }] }

// mhchem only adds macros to the KaTeX that's already loaded, so it must come after it
function loadsMhchemAfterKatex(html) {
  const katexAt = html.search(/<script src="[^"]*katex@[^"]*\/dist\/katex\.min\.js"/)
  const mhchemAt = html.search(/<script src="[^"]*katex@[^"]*\/dist\/contrib\/mhchem\.min\.js"/)
  return katexAt >= 0 && mhchemAt > katexAt
}

describe('mhchem', () => {
  it('draws \\ce and \\pu with the KaTeX the editor imports', () => {
    const html = katex.renderToString('\\ce{2H2 + O2 -> 2H2O} \\quad \\pu{25 kJ mol-1}', { throwOnError: true })
    expect(html).toContain('katex')
    expect(() => katex.renderToString('\\ce{CO2 + C <=> 2CO}', { throwOnError: true })).not.toThrow()
  })

  it('is loaded after KaTeX in decks and in LaTeX elements', () => {
    expect(loadsMhchemAfterKatex(generateRevealHTML(deck))).toBe(true)
    expect(loadsMhchemAfterKatex(generateLatexIframeHtml('\\ce{H2O}', '#ffffff', 24))).toBe(true)
  })

  it('is bundled, so decks draw chemistry offline', () => {
    expect(packages.katex.files).toContain('dist/contrib/mhchem.min.js')
    const html = localizeLibraries(generateRevealHTML(deck), 'http://localhost:3000')
    expect(html).toMatch(/\/vendor\/katex@[\d.]+\/dist\/contrib\/mhchem\.min\.js/)
  })
})

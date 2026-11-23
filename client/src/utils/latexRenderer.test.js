import { describe, it, expect } from 'vitest'
import { tikzInk, generateLatexIframeHtml } from './latexRenderer'

const PICTURE = '\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}'
const tikzOf = html => html.match(/<script type="text\/tikz">([\s\S]*?)<\\?\/script>/)[1]

describe('TikZ in the editor', () => {
  it('takes the first color TeX can be given, as HTML hex', () => {
    expect(tikzInk(PICTURE, ['#fff'])).toBe(`\\definecolor{parallaxink}{HTML}{FFFFFF}\\color{parallaxink}\n${PICTURE}`)
    expect(tikzInk(PICTURE, [undefined, 'tomato', 'rgba(34, 34, 34, 0.5)'])).toMatch(/\{HTML\}\{222222\}/)
    expect(tikzInk(PICTURE, [null, ''])).toBe(PICTURE)
  })

  it('draws in the element\'s text color, else the slide\'s; the preview, on its dark ground, in white', () => {
    expect(tikzOf(generateLatexIframeHtml(PICTURE, '#ff8800', 20, '#ffffff'))).toMatch(/\{HTML\}\{FF8800\}/)
    expect(tikzOf(generateLatexIframeHtml(PICTURE, undefined, 20, '#222222'))).toMatch(/\{HTML\}\{222222\}/)
    expect(tikzOf(generateLatexIframeHtml(PICTURE))).toMatch(/\{HTML\}\{FFFFFF\}/)
    // Math and tables keep their CSS color, as before
    expect(generateLatexIframeHtml('E = mc^2', undefined, 20, '#222222')).not.toContain('parallaxink')
  })
})

// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TextStyle from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { readBeamer } from './beamer'
import { beamerSlides, mergeBibliography, citedKeys, legible, palette, estimateTextHeight, isDarkColor, citeKeyFinder } from './beamerSlides'
import { MathNode } from '../extensions/MathExtension'
import { CitationNode } from '../extensions/CitationExtension'
import { FontSize } from '../extensions/FontSize'
import { FontFamily } from '../extensions/FontFamily'
import { BlockStyle } from '../extensions/BlockStyle'
import { LineHeight } from '../extensions/LineHeight'

const doc = body => `\\documentclass[aspectratio=169]{beamer}\n\\begin{document}\n${body}\n\\end{document}`
let n = 0
const slidesOf = (src, opts = {}) => beamerSlides(readBeamer(src), { newId: () => 'id' + (++n), ...opts })
const texts = slide => slide.elements.filter(e => e.type === 'text')

describe('frames as slides', () => {
  it('gives each frame a slide, its title a box the outline reads', () => {
    const { slides } = slidesOf(doc('\\begin{frame}{Hello \\emph{world}}Some text.\\end{frame}'))
    expect(slides).toHaveLength(1)
    const [title, body] = texts(slides[0].slide)
    expect(title.outline).toBe('title')
    expect(title.content).toMatch(/^<p style="font-size: 33px; line-height: 43px"><span style="color: #3333b2; font-size: 33px">Hello <\/span><em><span[^>]*>world<\/span><\/em><\/p>$/)
    // Its own size and spacing, not the slide's 42px type's
    expect(body.content).toBe('<p style="font-size: 23px; line-height: 30px"><span style="color: #1a1a1a; font-size: 23px">Some text.</span></p>')
    expect(slides[0].slide.background).toEqual({ type: 'color', color: '#ffffff' })
    // Within the slide
    for (const e of slides[0].slide.elements) {
      expect(e.x).toBeGreaterThanOrEqual(0)
      expect(e.x + e.width).toBeLessThanOrEqual(960)
      expect(e.y + e.height).toBeLessThanOrEqual(540)
    }
  })

  it('builds a list up step by step as fragments, numbered from 1', () => {
    const { slides } = slidesOf(doc('\\begin{frame}\\begin{itemize}[<+->]\\item A \\item B \\item C\\end{itemize}\\pause\\[x\\]\\end{frame}'))
    expect(slides).toHaveLength(1)
    const els = texts(slides[0].slide)
    expect(els.map(e => e.fragment ? e.fragmentIndex : 0)).toEqual([0, 1, 2, 3])
    expect(els.every(e => !e.fragment || e.fragmentAnimation === 'fade-in')).toBe(true)
    // Each piece of the list is a list of its own, in the bullets' color
    expect(els[1].content).toMatch(/^<ul style="color: #3333b2; font-size: 23px; line-height: 30px"><li><p>.*B.*<\/p><\/li><\/ul>$/)
    // and stands right under the one before
    expect(els[1].y).toBeLessThan(els[0].y + els[0].height)
  })

  it('numbers a numbered list on where it’s cut', () => {
    const { slides } = slidesOf(doc('\\begin{frame}\\begin{enumerate}\\item A \\pause \\item B\\end{enumerate}\\end{frame}'))
    expect(texts(slides[0].slide)[1].content).toMatch(/^<ol start="2"/)
  })

  it('makes a slide per step for a frame whose parts also go away, and flips between them', () => {
    const { slides } = slidesOf(doc('\\begin{frame}{T}\\only<1>{First}\\only<2>{Second}\\note{N}\\end{frame}'))
    expect(slides.map(s => s.page)).toEqual([1, 2])
    expect(texts(slides[0].slide)[1].content).toMatch(/First/)
    expect(texts(slides[0].slide)[1].content).not.toMatch(/Second/)
    expect(texts(slides[1].slide)[1].content).toMatch(/Second/)
    expect(slides[0].slide.notes).toBe('N')
    expect(slides[1].slide.notes).toBe('')
    expect(slides[0].slide.transition).toBeUndefined()
    expect(slides[1].slide.transition).toBe('none')
  })

  it('keeps room for what’s uncovered later, on the slides before', () => {
    const { slides } = slidesOf(doc('\\begin{frame}A \\uncover<2>{B} C\\end{frame}'))
    expect(slides).toHaveLength(2)
    expect(texts(slides[0].slide)[0].content).toMatch(/color: transparent[^>]*>B/)
    expect(texts(slides[1].slide)[0].content).not.toMatch(/transparent/)
  })

  it('makes steps slides, or shows only the last, when asked', () => {
    const src = doc('\\begin{frame}A\\pause B\\pause C\\end{frame}')
    expect(slidesOf(src, { overlays: 'slides' }).slides).toHaveLength(3)
    const [last] = slidesOf(src, { overlays: 'none' }).slides
    expect(last.slide.elements.some(e => e.fragment)).toBe(false)
    expect(texts(last.slide).map(e => e.content).join()).toMatch(/C/)
  })

  it('leaves out a slide that’s the same as the one before', () => {
    // \alert<2> changes nothing here, so slide 2 would repeat slide 1
    const { slides } = slidesOf(doc('\\begin{frame}\\only<1-2>{Same}\\alert<2>{x}\\only<3>{Other}\\end{frame}'))
    expect(slides.map(s => s.page)).toEqual([1, 3])
  })

  it('makes the title page from the title, author and date', () => {
    const { slides } = slidesOf('\\documentclass{beamer}\\title{Big}\\author{Me}\\date{Today}\\begin{document}\\frame{\\titlepage}\\end{document}')
    const [box] = texts(slides[0].slide)
    expect(box.outline).toBe('title')
    expect(box.content).toMatch(/^<p style="text-align: center; font-size: 35px; line-height: 45px"><span[^>]*>Big<\/span><\/p>/)
    expect(box.content).toMatch(/Me.*Today/)
  })

  it('draws a block as a tinted box behind its title and text', () => {
    const { slides } = slidesOf(doc('\\begin{frame}\\begin{alertblock}{Careful}Mind this\\end{alertblock}\\end{frame}'))
    const [shape, title, body] = slides[0].slide.elements
    expect(shape).toMatchObject({ type: 'shape', shape: 'rounded-rect', fill: 'rgba(224,0,0,0.09)', zIndex: 1 })
    expect(title.content).toBe('<p style="font-size: 23px; line-height: 30px"><strong><span style="color: #e00000; font-size: 23px">Careful</span></strong></p>')
    expect(body.content).toMatch(/Mind this/)
    expect(shape.y).toBeLessThanOrEqual(title.y)
    expect(shape.y + shape.height).toBeGreaterThanOrEqual(body.y + body.height - 20)
  })

  it('places columns side by side', () => {
    const { slides } = slidesOf(doc('\\begin{frame}\\begin{columns}\\column{0.4\\textwidth} Left \\column{0.4\\textwidth} Right\\end{columns}\\end{frame}'))
    const [l, r] = texts(slides[0].slide)
    expect(l.x).toBeLessThan(r.x)
    expect(l.x + l.width).toBeLessThanOrEqual(r.x)
    expect(Math.abs(l.width - r.width)).toBeLessThanOrEqual(1)
  })

  it('sizes figures as the source asks, and boxes the ones not found', () => {
    const image = path => path === 'plot' ? { src: 'blob:plot', width: 400, height: 200 } : null
    const { slides, missing } = slidesOf(doc('\\begin{frame}\\centering\\includegraphics[width=0.5\\textwidth]{plot}\n\n\\includegraphics[width=3cm]{nope}\\end{frame}'), { image })
    const img = slides[0].slide.elements.find(e => e.type === 'image')
    expect(img).toMatchObject({ src: 'blob:plot', objectFit: 'contain', alt: 'plot' })
    expect(img.width / img.height).toBeCloseTo(2, 1)
    expect(img.x + img.width / 2).toBeCloseTo(480, -1)
    expect(missing).toEqual(['nope'])
    const box = slides[0].slide.elements.find(e => e.type === 'shape')
    expect(box).toMatchObject({ strokeDasharray: 'dashed', width: 180 })
  })

  it('makes a plain table a table element, and one with math LaTeX', () => {
    const plain = slidesOf(doc('\\begin{frame}\\begin{tabular}{ll}\\hline A & B \\\\ \\hline 1 & 2 \\\\ \\end{tabular}\\end{frame}')).slides[0].slide.elements[0]
    expect(plain).toMatchObject({ type: 'table', data: [['A', 'B'], ['1', '2']], headerRow: true, textColor: '#1a1a1a' })
    const math = slidesOf(doc('\\begin{frame}\\begin{tabular}{l} $x^2$ \\end{tabular}\\end{frame}')).slides[0].slide.elements[0]
    expect(math).toMatchObject({ type: 'latex', textColor: '#1a1a1a' })
    expect(math.content).toMatch(/^\\begin\{tabular\}/)
  })

  it('makes code a code element, and TikZ a LaTeX element with the preamble it needs', () => {
    const src = `\\documentclass{beamer}\\usetikzlibrary{calc}\\begin{document}
\\begin{frame}[fragile]
\\begin{verbatim}
print("hi")
\\end{verbatim}
\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}
\\end{frame}\\end{document}`
    const els = slidesOf(src, { look: 'dark' }).slides[0].slide.elements
    expect(els.find(e => e.type === 'code')).toMatchObject({ content: 'print("hi")', language: 'plaintext' })
    const tikz = els.find(e => e.type === 'latex')
    expect(tikz.content).toBe('\\usetikzlibrary{calc}\n\\color{white}\n\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}')
    // Drawn at the frame's scale: TeX points on a 4:3 frame on 960×540
    expect(tikz.fontSize).toBe(30)
  })

  it('shrinks a crowded frame until it fits', () => {
    const items = Array.from({ length: 16 }, (_, k) => `\\item Point number ${k} with a few words`).join('\n')
    const { slides, crowded } = slidesOf(doc(`\\begin{frame}{Many}\\begin{itemize}${items}\\end{itemize}\\end{frame}`))
    const body = texts(slides[0].slide)[1]
    expect(Number(/font-size: (\d+)px/.exec(body.content)[1])).toBeLessThan(23)
    expect(body.y + body.height).toBeLessThanOrEqual(540)
    expect(crowded).toEqual([])
  })

  it('puts footnotes at the foot', () => {
    const { slides } = slidesOf(doc('\\begin{frame}Text\\footnote{The note.}\\end{frame}'))
    const els = texts(slides[0].slide)
    const foot = els.find(e => /The note/.test(e.content))
    expect(foot.y).toBeGreaterThan(els.find(e => /Text/.test(e.content)).y)
    expect(foot.content).toMatch(/data-math-latex="\^\{\\text\{1\}\}"/)
  })

  it('cites through the deck’s keys, and shows unknown keys as text', () => {
    const cite = key => key === 'a' ? { key: 'A2020', label: '[1]' } : null
    const { slides } = slidesOf(doc('\\begin{frame}See \\cite{a,b}.\\end{frame}'), { cite })
    const html = texts(slides[0].slide)[0].content
    expect(html).toContain('<sup data-cite="A2020" style="color:#6366f1;cursor:default">[1]</sup>[b]')
    expect([...citedKeys(slides.map(s => s.slide))]).toEqual(['A2020'])
  })

  it('carries sections onto the slides when the talk has them', () => {
    const { slides } = slidesOf(doc('\\section{Intro}\\begin{frame}x\\end{frame}'))
    expect(slides[0].slide.section).toBe('Intro')
    expect(slidesOf(doc('\\begin{frame}x\\end{frame}')).slides[0].slide.section).toBeUndefined()
  })
})

describe('looks and colors', () => {
  it('has a light and a dark look', () => {
    const { slides } = slidesOf(doc('\\begin{frame}{T}x\\end{frame}'), { look: 'dark' })
    expect(slides[0].slide.background.color).toBe('#1e1e2e')
    expect(texts(slides[0].slide)[1].content).toMatch(/color: #ececf4/)
  })

  it('takes the source’s structure color, made to read on the background', () => {
    const d = readBeamer('\\documentclass{beamer}\\setbeamercolor{structure}{fg=blue!50!black}\\begin{document}\\end{document}')
    expect(palette('light', d).structure).toBe('#000080')
    expect(palette('dark', d).structure).not.toBe('#000080')
  })

  it('lifts dark colors on a dark slide, and leaves readable ones', () => {
    expect(legible('#000000', '#1e1e2e')).not.toBe('#000000')
    expect(legible('#ff0000', '#ffffff')).toBe('#ff0000')
    expect(isDarkColor('#1e1e2e')).toBe(true)
    expect(isDarkColor('#fbfaf7')).toBe(false)
  })
})

describe('the bibliography', () => {
  it('joins references to a library, citing what it has already', () => {
    const library = [{ key: 'old', title: 'A Paper', year: '2020' }]
    const incoming = [{ key: 'old', title: 'Whatever' }, { key: 'new1', title: 'A paper!', year: '2020' }, { key: 'new2', title: 'Fresh', year: '2021' }]
    const { added, keyMap } = mergeBibliography(library, incoming)
    expect(added.map(e => e.key)).toEqual(['new2'])
    expect(Object.fromEntries(keyMap)).toEqual({ old: 'old', new1: 'old', new2: 'new2' })
  })
})

describe('in the text editor', () => {
  // As EditorPage sets the editor up, for what the import writes
  const editorWith = content => new Editor({
    extensions: [StarterKit, Underline, TextAlign.configure({ types: ['heading', 'paragraph'] }), Color, TextStyle, MathNode, CitationNode, FontFamily, FontSize, LineHeight, BlockStyle],
    content,
  })

  it('keeps math, colors, sizes, spacing, list colors and citations through editing', () => {
    const cite = key => ({ key, label: '[1]' })
    const { slides } = slidesOf(doc(`\\begin{frame}
\\begin{itemize}\\item \\textbf{Bold} $x^2$ \\cite{k} \\texttt{code}\\end{itemize}
\\begin{center}Centered \\alert{alert}\\end{center}
\\[ \\int f \\]
\\end{frame}`), { cite })
    const html = texts(slides[0].slide).map(e => e.content).join('')
    const out = editorWith(html).getHTML()
    expect(out).toContain('<ul style="line-height: 30px; color: #3333b2; font-size: 23px;">')
    expect(out).toContain('<p style="line-height: 30px; font-size: 23px;">')
    expect(out).toContain('data-math-latex="x^2"')
    expect(out).toMatch(/data-math-latex="\\int f" data-math-display="true"/)
    expect(out).toContain('data-cite="k"')
    expect(out).toContain('<span style="color: #1a1a1a; font-size: 23px;"><strong>Bold</strong>')
    expect(out).toContain('<p style="text-align: center; line-height: 30px; font-size: 23px;">')
    expect(out).toContain('<span style="color: #e00000; font-size: 23px;">alert</span>')
    expect(out).toMatch(/font-family: [^"]*Fira Code/)
    // and stays as it is from then on
    expect(editorWith(out).getHTML()).toBe(out)
  })
})

describe('estimating text', () => {
  it('grows with the text, and shrinks with a wider box', () => {
    const p = t => `<p><span style="font-size: 20px">${t}</span></p>`
    expect(estimateTextHeight(p('x'.repeat(400)), 600)).toBeGreaterThan(estimateTextHeight(p('x'), 600))
    expect(estimateTextHeight(p('x'.repeat(400)), 900)).toBeLessThan(estimateTextHeight(p('x'.repeat(400)), 300))
  })
})

describe('half-typed source', () => {
  // The window reads the source at each pause in typing, so any piece of it must do
  const TALK = doc(`\\newcommand{\\R}{\\mathbb{R}}
\\section{One}
\\begin{frame}{A \\alert{title}}
  \\begin{itemize}[<+->]
    \\item Math $x \\in \\R$ \\cite{a}\\footnote{note}
    \\item \\only<2>{once} \\alt<3>{b}{c}
  \\end{itemize}
  \\begin{columns}\\column{.5\\textwidth} \\includegraphics[width=\\linewidth]{f} \\column{.5\\textwidth}
  \\begin{tabular}{lc} \\hline a & $b$ \\\\ \\hline \\end{tabular}\\end{columns}
  \\begin{block}{B}\\[ y \\]\\end{block}
\\end{frame}`)

  it('lays out every prefix of a talk', () => {
    for (let k = 0; k <= TALK.length; k += 2) {
      expect(() => beamerSlides(readBeamer(TALK.slice(0, k)), { newId: () => 'x' }), TALK.slice(0, k)).not.toThrow()
    }
  })

  it('takes stray and unclosed pieces', () => {
    const bits = ['\\', '{', '}', '$', '\\[', '\\begin{', '\\item<', '\\only<2>{', '\\newcommand{\\x}', '\\def\\a{\\a}\\a', '\\column', '\\begin{tabular}{', '\\includegraphics[', '\\verb|x', '\\cite{', '\\pause[', '\\begin{frame}[', '\\section{', '\\color{', '\\begin{thebibliography}{9}\\bibitem{']
    for (const a of bits) for (const b of bits) {
      const src = `\\begin{frame}{T} ${a} x ${b} y \\end{frame}`
      expect(() => beamerSlides(readBeamer(src), { newId: () => 'x' }), src).not.toThrow()
    }
  })
})

describe('themes’ own frames', () => {
  it('makes metropolis’ standout frame a dark slide of large, centered text, and \\maketitle outside a frame its title slide', () => {
    const { slides } = slidesOf('\\documentclass{beamer}\\usetheme{metropolis}\\title{T}\\begin{document}\\maketitle\\begin{frame}[standout]Questions?\\end{frame}\\end{document}')
    expect(slides).toHaveLength(2)
    expect(texts(slides[0].slide)[0].outline).toBe('title')
    const [box] = texts(slides[1].slide)
    expect(slides[1].slide.background.color).toBe('#23373b')
    expect(box.content).toBe('<p style="text-align: center; font-size: 31px; line-height: 41px"><span style="color: #ffffff; font-size: 31px">Questions?</span></p>')
  })
})

describe('more', () => {
  it('hides the bullets of items not shown yet on a slide of a step', () => {
    const { slides } = slidesOf(doc('\\begin{frame}\\begin{itemize}\\item<1-> A \\item<2-> B\\end{itemize}\\only<2>{x}\\end{frame}'))
    const list = texts(slides[0].slide)[0].content
    expect(list).toMatch(/^<ul style="color: #3333b2[^>]*><li><p>.*A.*<\/li><\/ul><ul style="color: transparent[^>]*><li><p><span style="color: transparent[^>]*>B/)
    expect(texts(slides[1].slide)[0].content).not.toContain('transparent')
  })

  it('finds cited keys as BibTeX does, in any case, in the references or the deck’s library', () => {
    const find = citeKeyFinder(new Map([['Knuth92', 'Knuth92']]), [{ key: 'old2001' }])
    expect(find('knuth92')).toBe('Knuth92')
    expect(find('OLD2001')).toBe('old2001')
    expect(find('nope')).toBe(null)
  })
})

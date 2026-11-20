// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { readFiles, pickMain, relativeTo, findFigure, imageDpi } from './beamerFiles'

describe('a talk’s files', () => {
  it('unpacks a project zip, and finds its main file', async () => {
    const zip = new JSZip()
    zip.file('talk/main.tex', '\\documentclass{beamer}\\begin{document}\\input{parts/a}\\end{document}')
    zip.file('talk/parts/a.tex', '\\begin{frame}x\\end{frame}')
    zip.file('talk/refs.bib', '@article{k, title={T}}')
    zip.file('talk/figs/plot.png', new Uint8Array([137, 80, 78, 71]))
    zip.file('__MACOSX/talk/._main.tex', 'junk')
    zip.file('talk/.hidden.tex', 'junk')
    const blob = await zip.generateAsync({ type: 'blob' })
    const read = await readFiles([new File([blob], 'project.zip')])
    expect([...read.texts.keys()].sort()).toEqual(['talk/main.tex', 'talk/parts/a.tex'])
    const main = pickMain(read.texts)
    expect(main).toBe('talk/main.tex')
    expect([...relativeTo(main, read.texts).keys()].sort()).toEqual(['main.tex', 'parts/a.tex'])
    expect([...relativeTo(main, read.bibs).keys()]).toEqual(['refs.bib'])
    expect([...relativeTo(main, read.figures).keys()]).toEqual(['figs/plot.png'])
    expect(await read.figures.get('talk/figs/plot.png').blob()).toBeInstanceOf(Blob)
  })

  it('takes loose files as they are', async () => {
    const read = await readFiles([new File(['\\begin{frame}y\\end{frame}'], 'frames.tex'), new File([''], 'a.pdf')])
    expect(pickMain(read.texts)).toBe('frames.tex')
    expect(read.figures.get('a.pdf').name).toBe('a.pdf')
  })

  it('prefers a Beamer document to other files', () => {
    const texts = new Map([['notes.tex', 'hi'], ['frames.tex', '\\begin{frame}\\end{frame}'], ['slides.tex', '\\documentclass{beamer}\\begin{document}\\end{document}']])
    expect(pickMain(texts)).toBe('slides.tex')
  })
})

describe('finding figures', () => {
  const figures = new Map([['figs/plot.pdf', {}], ['figs/plot.png', {}], ['img/Photo.JPG', {}], ['deep/down/logo.svg', {}]])

  it('tries LaTeX’s extensions in its order, and the graphics paths', () => {
    expect(findFigure(figures, 'figs/plot')).toBe('figs/plot.pdf')
    expect(findFigure(figures, 'figs/plot.png')).toBe('figs/plot.png')
    expect(findFigure(figures, 'plot', ['figs/'])).toBe('figs/plot.pdf')
    expect(findFigure(figures, './figs/plot')).toBe('figs/plot.pdf')
  })

  it('then any case, then the file name anywhere', () => {
    expect(findFigure(figures, 'img/photo.jpg')).toBe('img/Photo.JPG')
    expect(findFigure(figures, 'logo')).toBe('deep/down/logo.svg')
    expect(findFigure(figures, 'missing')).toBe(null)
  })
})

describe('image resolution', () => {
  it('reads a PNG’s pHYs, and a JPEG’s JFIF density', () => {
    // 300 dpi is 11811 pixels per meter
    const png = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 9, ...'pHYs'.split('').map(c => c.charCodeAt(0)), 0, 0, 0x2e, 0x23, 0, 0, 0x2e, 0x23, 1, 0, 0, 0, 0]
    expect(imageDpi(new Uint8Array(png).buffer)).toBe(300)
    const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0, 16, ...'JFIF'.split('').map(c => c.charCodeAt(0)), 0, 1, 1, 1, 0, 150, 0, 150, 0, 0]
    expect(imageDpi(new Uint8Array(jpeg).buffer)).toBe(150)
    expect(imageDpi(new Uint8Array([1, 2, 3]).buffer)).toBe(72)
  })
})

// @vitest-environment happy-dom
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { describe, it, expect } from 'vitest'
import { scopeThemeCss, themeCssTag, setDocumentThemeCss, allowedUrl } from './scopeCss'

const css = source => scopeThemeCss(source).css
const reasons = source => scopeThemeCss(source).dropped.map(d => d.reason).join(' | ')

describe("a deck's theme stylesheet", () => {
  it('scopes every selector to the slide', () => {
    expect(css('h2 { color: red }')).toBe('.px-slide h2{color:red}')
    expect(css('[data-placeholder=title] h2, li::marker { color: red }')).toBe('.px-slide [data-placeholder=title] h2,.px-slide li::marker{color:red}')
    expect(css('.px-slide[data-layout=section-header] { background: #000 }')).toBe('.px-slide[data-layout=section-header]{background:#000}')
    expect(css('.px-slide > .px-text { padding: 0 }')).toBe('.px-slide>.px-text{padding:0}')
  })

  it('makes html, body and :root the slide', () => {
    expect(css(':root { --px-accent: red }')).toBe('.px-slide{--px-accent: red }')
    expect(css('html body h1 { color: red }')).toBe('.px-slide h1{color:red}')
    expect(css('body > p { margin: 0 }')).toBe('.px-slide>p{margin:0}')
  })

  it("keeps a selector from reaching the slide's neighbors", () => {
    expect(css('.px-slide ~ div { display: none }')).toBe('')
    expect(css('.px-slide + * { display: none }')).toBe('')
    expect(reasons('.px-slide ~ div { display: none }')).toMatch(/reach outside the slide/)
    expect(css('.px-slide ~ div, h1 { color: red }')).toBe('.px-slide h1{color:red}')
  })

  it('keeps @media, @supports, @font-face and renames @keyframes', () => {
    expect(css('@media (max-width: 500px) { h1 { color: red } }')).toBe('@media (max-width:500px){.px-slide h1{color:red}}')
    const k = css('@keyframes pop { from { opacity: 0 } to { opacity: 1 } } h1 { animation: pop 1s }')
    expect(k).toContain('@keyframes px-pop')
    expect(k).toContain('.px-slide h1{animation:px-pop 1s}')
    expect(css("@font-face { font-family: X; src: url(/uploads/fonts/x.woff2) }")).toBe('@font-face{font-family:X;src:url(/uploads/fonts/x.woff2)}')
  })

  it('drops other at-rules, and @import except from font hosts', () => {
    expect(css('@page { margin: 0 } @namespace svg url(x);')).toBe('')
    expect(reasons('@page { margin: 0 }')).toMatch(/@page isn't allowed/)
    expect(css('@import url(https://evil.example/x.css); h1 { color: red }')).toBe('.px-slide h1{color:red}')
    expect(css('h1 { color: red } @import url(https://fonts.googleapis.com/css2?family=Jost);')).toMatch(/^@import url\(https:\/\/fonts\.googleapis\.com/)
  })

  it('lets url() load only data:, uploads and font hosts', () => {
    expect(css('h1 { background: url(https://tracker.example/p.gif) }')).toBe('')
    expect(reasons('h1 { background: url(https://tracker.example/p.gif) }')).toMatch(/isn't an upload, a data: URL or a font host/)
    expect(css('h1 { background: url(data:image/png;base64,AAAA) }')).toContain('url(data:image/png;base64,AAAA)')
    expect(css('h1 { background: url(javascript:alert(1)) }')).toBe('')
    expect(css('h1 { background: image-set("https://tracker.example/a.png" 1x) }')).toBe('')
    // Custom properties aren't parsed, so their urls are checked by hand
    expect(css(':root { --bg: url(https://tracker.example/a.png) }')).toBe('')
    expect(allowedUrl('https://fonts.gstatic.com/s/jost.woff2')).toBe(true)
    expect(allowedUrl('http://fonts.gstatic.com/s/jost.woff2')).toBe(false)
  })

  it('drops position: fixed, old script hooks and \\ escapes outside strings', () => {
    expect(css('h1 { position: fixed; color: red }')).toBe('.px-slide h1{color:red}')
    expect(css('h1 { behavior: url(x.htc) }')).toBe('')
    expect(css('h1 { width: expression(alert(1)) }')).toBe('')
    expect(css('h1 { background: u\\72l(https://tracker.example/a.png) }')).toBe('')
    // Strings are read and written back: "\\25A0 " is the square itself
    expect(css('li::marker { content: "\\25A0  " }')).toBe('.px-slide li::marker{content:"\u25a0 "}')
  })

  it("can never close the <style> it's written into", () => {
    const out = css('h1::after { content: "</style><script>alert(1)</script>" }')
    expect(out).not.toContain('<')
    expect(themeCssTag('h1::after { content: "</style>" }')).not.toMatch(/<\/style>[\s\S]*<\/style>/)
  })

  it('is limited in size and says what it dropped, by line', () => {
    expect(scopeThemeCss('h1{}'.padEnd(50001, ' ')).css).toBe('')
    const { dropped } = scopeThemeCss('h1 { color: red }\n@page { margin: 0 }\nh2 { position: fixed }')
    expect(dropped.map(d => d.line)).toEqual([2, 3])
    expect(scopeThemeCss('').css).toBe('')
    expect(scopeThemeCss(null).css).toBe('')
  })

  it("is the editor's own <style>, and goes when there's none", () => {
    setDocumentThemeCss('h1 { color: red }')
    expect(document.head.querySelector('style[data-theme-css]').textContent).toBe('.px-slide h1{color:red}')
    setDocumentThemeCss('')
    expect(document.head.querySelector('style[data-theme-css]')).toBe(null)
  })
})

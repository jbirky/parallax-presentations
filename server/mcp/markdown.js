// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Markdown an AI collaborator writes (server/mcp), as the HTML a text box
// keeps: only what the editor's text boxes understand, which are TipTap's
// paragraphs, headings, lists, quotes, code, tables and links, and
// Parallax's math ($…$ and $$…$$) and citations ([@key]). Raw HTML is shown
// as text, never kept as HTML, and links go only to web and mail addresses.
// format.js turns the HTML back into Markdown for reading.

const { CITATION_STYLE } = require('./citation-style')

const MAX_MARKDOWN = 20000

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// As utils/beamerSlides.js writes math, for the editor's math node
const mathSpan = (tex, display) =>
  `<span data-math-latex="${esc(tex)}" data-math-display="${display}" data-math-fontsize="" data-math-color="" class="math-node ${display ? 'math-display' : 'math-inline'}"></span>`

// A citation key as BibTeX allows: no spaces, braces, commas or quotes
const CITE_KEY = /^[^\s{}(),;"'#%~\\]+$/

const EXTENSIONS = [
  {
    // $$ … $$ on lines of its own
    name: 'mathBlock',
    level: 'block',
    start(src) { const m = /^ {0,3}\$\$/m.exec(src); return m ? m.index : undefined },
    tokenizer(src) {
      const m = /^ {0,3}\$\$[ \t]*\n?([\s\S]+?)\n?[ \t]*\$\$[ \t]*(?:\n+|$)/.exec(src)
      if (m && m[1].trim()) return { type: 'mathBlock', raw: m[0], text: m[1].trim() }
    },
    renderer: token => `<p>${mathSpan(token.text, true)}</p>`,
  },
  {
    // $$…$$ or $…$ in a line. A lone $ is math only as Pandoc reads it: no
    // space inside either $, and no digit right after the closing one, so
    // "$5 and $10" stays money.
    name: 'mathInline',
    level: 'inline',
    start(src) { const i = src.indexOf('$'); return i < 0 ? undefined : i },
    tokenizer(src) {
      let m = /^\$\$((?:\\.|[^\\$])+?)\$\$/.exec(src)
      if (m) return { type: 'mathInline', raw: m[0], text: m[1].trim(), display: true }
      m = /^\$(?!\s)((?:\\.|[^\\$\n])+?)(?<!\s)\$(?!\d)/.exec(src)
      if (m) return { type: 'mathInline', raw: m[0], text: m[1], display: false }
    },
    renderer: token => mathSpan(token.text, token.display),
  },
  {
    // [@key] or [@a; @b]
    name: 'citation',
    level: 'inline',
    start(src) { const i = src.indexOf('[@'); return i < 0 ? undefined : i },
    tokenizer(src) {
      const m = /^\[(@[^\]\n]{1,300})\]/.exec(src)
      if (!m) return
      const keys = m[1].split(/[;,]/).map(k => k.trim().replace(/^@/, ''))
      if (keys.length && keys.every(k => k && CITE_KEY.test(k))) return { type: 'citation', raw: m[0], keys }
    },
    // The label is a placeholder the citation index numbers wherever the
    // slide is drawn (client/src/utils/citationIndex.js)
    renderer: token => token.keys.map(k => `<sup data-cite="${esc(k)}" style="${CITATION_STYLE}">[${esc(k)}]</sup>`).join(''),
  },
]

function safeHref(href) {
  const h = String(href || '').trim()
  return /^(https?:\/\/|mailto:)/i.test(h) ? h : null
}

let parser = null
async function getParser() {
  if (parser) return parser
  const { Marked } = await import('marked')
  const marked = new Marked({ gfm: true, breaks: true })
  marked.use({
    extensions: EXTENSIONS,
    renderer: {
      html({ text }) { return esc(text) },
      heading({ tokens, depth }) { return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>` },
      paragraph({ tokens }) { return `<p>${this.parser.parseInline(tokens)}</p>` },
      blockquote({ tokens }) { return `<blockquote>${this.parser.parse(tokens)}</blockquote>` },
      code({ text, lang }) {
        const language = /^[\w+#.-]{1,30}$/.test(lang || '') ? ` class="language-${esc(lang)}"` : ''
        return `<pre><code${language}>${esc(text)}</code></pre>`
      },
      hr() { return '<hr>' },
      // The editor's list items hold paragraphs
      list(token) {
        const items = token.items.map(item => {
          const blocks = item.tokens.map(t => (t.type === 'text'
            ? `<p>${t.tokens ? this.parser.parseInline(t.tokens) : esc(t.text)}</p>`
            : t.type === 'checkbox' ? '' : this.parser.parse([t]))).join('')
          const box = item.task ? (item.checked ? '☑ ' : '☐ ') : ''
          return `<li>${box && blocks.startsWith('<p>') ? blocks.replace('<p>', `<p>${box}`) : box + blocks}</li>`
        }).join('')
        if (!token.ordered) return `<ul>${items}</ul>`
        const start = Number(token.start)
        return `<ol${Number.isInteger(start) && start !== 1 ? ` start="${start}"` : ''}>${items}</ol>`
      },
      table(token) {
        const cell = (c, tag) => `<${tag}><p>${this.parser.parseInline(c.tokens)}</p></${tag}>`
        const rows = [`<tr>${token.header.map(c => cell(c, 'th')).join('')}</tr>`, ...token.rows.map(r => `<tr>${r.map(c => cell(c, 'td')).join('')}</tr>`)]
        return `<table><tbody>${rows.join('')}</tbody></table>`
      },
      strong({ tokens }) { return `<strong>${this.parser.parseInline(tokens)}</strong>` },
      em({ tokens }) { return `<em>${this.parser.parseInline(tokens)}</em>` },
      del({ tokens }) { return `<s>${this.parser.parseInline(tokens)}</s>` },
      codespan({ text }) { return `<code>${esc(text)}</code>` },
      br() { return '<br>' },
      link({ href, tokens }) {
        const inner = this.parser.parseInline(tokens)
        const url = safeHref(href)
        return url ? `<a target="_blank" rel="noopener noreferrer nofollow" href="${esc(url)}">${inner}</a>` : inner
      },
      // Images need an upload, which links can't make yet: the words stay
      image({ text }) { return text ? esc(text) : '' },
      text(token) { return token.tokens ? this.parser.parseInline(token.tokens) : esc(token.text) },
      checkbox() { return '' },
      space() { return '' },
      def() { return '' },
    },
  })
  parser = marked
  return parser
}

class MarkdownError extends Error {}

// Markdown as text box HTML, '' for none. toHtml is synchronous, for edits
// made inside a live document's transaction, once ready() has loaded marked.
function toHtml(markdown) {
  if (!parser) throw new Error('Markdown is not ready: await ready() first')
  const md = String(markdown ?? '')
  if (md.length > MAX_MARKDOWN) throw new MarkdownError(`That text is ${md.length} characters; a text box takes up to ${MAX_MARKDOWN}. Split it across slides.`)
  if (!md.trim()) return ''
  // Newlines between blocks go; those inside code blocks stay, before text (a < there is escaped)
  return parser.parse(md.replace(/\r\n?/g, '\n')).replace(/\n+(?=<|$)/g, '')
}
const ready = () => getParser().then(() => {})
const markdownToHtml = async markdown => { await ready(); return toHtml(markdown) }

module.exports = { markdownToHtml, toHtml, ready, MarkdownError, MAX_MARKDOWN }

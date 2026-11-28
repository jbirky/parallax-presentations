// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The site's legal pages, written in Markdown in server/content and drawn in
// the shell the site's own pages share (site-pages.js): /privacy, the privacy
// policy of the hosted service. Cloud only, since a self-hosted copy isn't
// ours to make promises for (server/index.js). Each page is read and drawn
// once, when it's first asked for.

const fs = require('fs')
const path = require('path')
const { sitePage, pageMeta, landingTabs, SIGN_IN } = require('./site-pages')

const PAGES = {
  privacy: {
    file: 'privacy.md',
    title: 'Privacy policy',
    description: 'What Parallax collects, why, who else handles it, and what you can do about it.',
  },
}

const STYLES = `
  .legal { max-width: 720px; padding-block: 48px 64px; font-size: 16px; }
  .legal h1 { margin: 0 0 6px; font: 800 clamp(30px, 5vw, 44px)/1.1 var(--display); letter-spacing: -0.03em; }
  .legal h1 + p em { color: var(--faint); font-style: normal; font-size: 14.5px; }
  .legal h2 { margin: 2.2em 0 0.5em; font: 700 22px/1.25 var(--display); letter-spacing: -0.02em; }
  .legal h3 { margin: 1.6em 0 0.4em; font-size: 17px; letter-spacing: -0.01em; }
  .legal p, .legal ul, .legal table { margin: 0 0 1em; }
  .legal li { margin: 0 0 0.35em; }
  .legal a { color: var(--soft); }
  .legal table { width: 100%; border-collapse: collapse; font-size: 14.5px; display: block; overflow-x: auto; }
  .legal th, .legal td { text-align: left; vertical-align: top; padding: 8px 12px 8px 0; border-bottom: 1px solid var(--line); }
  .legal th { font-weight: 600; border-bottom: 2px solid var(--text); }
`

const drawn = new Map()

// A page's HTML, from its Markdown: ours, so not sanitized
async function bodyOf(name) {
  if (drawn.has(name)) return drawn.get(name)
  const { Marked } = await import('marked')
  const markdown = fs.readFileSync(path.join(__dirname, '..', 'content', PAGES[name].file), 'utf8')
  const html = new Marked({ gfm: true })
    .parse(markdown)
    // Addresses in the text become links
    .replace(/(^|[\s(>])([\w.+-]+@parallax-presentations\.com)(?![^<]*<\/a>)/g, '$1<a href="mailto:$2">$2</a>')
  drawn.set(name, html)
  return html
}

// The whole page for /<name>, or null for a page there isn't
async function legalPage(name, { origin, analytics, index }) {
  const page = PAGES[name]
  if (!page) return null
  return sitePage({
    meta: pageMeta({ origin, path: `/${name}`, title: `${page.title} · Parallax`, description: page.description, index }),
    analytics,
    nav: landingTabs(null),
    end: SIGN_IN,
    styles: STYLES,
    main: `<article class="legal">${await bodyOf(name)}</article>`,
  })
}

module.exports = { legalPage, LEGAL_PAGES: Object.keys(PAGES) }

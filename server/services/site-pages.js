// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// What the site tells link previews and search engines: the tags in each
// page's head (title, description, preview image, canonical address), a page
// of its own for each landing page example, the shell the plugin gallery's
// pages share (services/plugin-pages.js), robots.txt and sitemap.xml. Only
// the landing page and the examples' and plugins' pages are for search
// engines, and only on a site that's indexed (not dev, nor a self-hosted copy).

const TAGLINE = 'Interactive slides for complex concepts'
const DESCRIPTION = 'Parallax is a slide editor that runs in your browser. Put live graphs, physics and circuit diagrams, equations and 3D molecules on a slide, and move them while you present. Free to start, open source.'
const SOCIAL_IMAGE = { path: '/social/parallax.jpg', width: 1200, height: 630 }
const SUPPORT = 'support@parallax-presentations.com'

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// The head tags for a page. `image` is { path, width, height } on this site.
function pageMeta({ origin, path, title, description, image = SOCIAL_IMAGE, index = false }) {
  const url = origin + path
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta name="robots" content="${index ? 'index, follow' : 'noindex'}" />`,
    `<meta property="og:site_name" content="Parallax" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
  ]
  if (image) {
    tags.push(
      `<meta property="og:image" content="${esc(origin + image.path)}" />`,
      `<meta property="og:image:width" content="${image.width}" />`,
      `<meta property="og:image:height" content="${image.height}" />`,
      `<meta property="og:image:alt" content="${esc(image.alt || title)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:image" content="${esc(origin + image.path)}" />`,
    )
  }
  tags.push(`<meta name="twitter:title" content="${esc(title)}" />`, `<meta name="twitter:description" content="${esc(description)}" />`)
  return tags.join('\n    ')
}

// The app's HTML with its head tags for `path`: the landing page's at /, and
// a plain title, kept out of search engines, everywhere else in the app
function appHtml(template, { origin, path, index }) {
  const landing = path === '/'
  const meta = pageMeta({
    origin, path: landing ? '/' : path,
    title: landing ? `Parallax · ${TAGLINE}` : 'Parallax',
    description: DESCRIPTION,
    index: landing && index,
  })
  return template.replace(/<!-- meta -->[\s\S]*?<!-- \/meta -->/, `<!-- meta -->\n    ${meta}\n    <!-- /meta -->`)
}

function robotsTxt({ origin, index }) {
  if (!index) return 'User-agent: *\nDisallow: /\n'
  return [
    'User-agent: *',
    'Allow: /',
    ...['/api/', '/dashboard', '/admin', '/try', '/share/', '/live/', '/invite/', '/uploads/', '/stats/'].map(p => `Disallow: ${p}`),
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
}

// The landing page, each example shown as a card, and the plugin gallery
// with each listed plugin's page (plugins: their slugs; none, no gallery)
function sitemapXml({ origin, examples, plugins = [] }) {
  const urls = [`${origin}/`, ...examples.map(e => `${origin}/examples/${e.slug}`),
    ...(plugins.length ? [`${origin}/plugins`, ...plugins.map(slug => `${origin}/plugins/${slug}`)] : [])]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`
}

// The site's own pages around `main`: the head (`meta` from pageMeta, the
// analytics script when it's on), a header with `nav` (links: [href, text,
// hide on a phone]) and a link home, and the footer. `styles` and `script`
// are the page's own, after the shared ones.
function sitePage({ meta, analytics, nav = [], main, styles = '', script = '' }) {
  const links = nav.map(([href, text, hide]) => `<a${hide ? ' class="hide"' : ''} href="${esc(href)}">${esc(text)}</a>`)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${meta}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" />
    ${analytics ? `<script defer src="/stats/script.js" data-website-id="${esc(analytics.websiteId)}" data-do-not-track="true"></script>` : ''}
    <style>
      :root { color-scheme: dark; --bg: #0f0f17; --raise: #151527; --card: #1c1c36; --line: #2b2b4a; --text: #ececf4; --muted: #a1a2bd; --faint: #8586a6; --accent: #6366f1; --soft: #8f92fa; }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 Inter, -apple-system, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
      a { color: inherit; }
      :focus-visible { outline: 2px solid var(--soft); outline-offset: 3px; border-radius: 6px; }
      .wrap { max-width: 1040px; margin: 0 auto; padding-inline: clamp(16px, 4vw, 40px); }
      header { border-bottom: 1px solid var(--line); background: rgba(15, 15, 23, 0.9); position: sticky; top: 0; z-index: 5; backdrop-filter: blur(10px); }
      header .wrap { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-block: 12px; }
      .logo { font-weight: 800; font-size: 21px; letter-spacing: -0.5px; text-decoration: none; white-space: nowrap; }
      .logo span { color: var(--accent); }
      .beta { display: inline-block; margin-left: 0.35em; padding: 0.22em 0.55em; transform: translateY(-0.55em); font: 650 9.5px/1 Inter, sans-serif; letter-spacing: 0.06em; text-transform: uppercase; color: var(--soft); border: 1px solid rgba(99, 102, 241, 0.55); background: rgba(99, 102, 241, 0.14); border-radius: 999px; }
      nav { display: flex; align-items: center; gap: 4px; }
      nav a { text-decoration: none; color: var(--muted); font-size: 14.5px; font-weight: 500; padding: 7px 12px; border-radius: 8px; white-space: nowrap; }
      nav a:hover { color: var(--text); background: var(--raise); }
      .btn { display: inline-flex; align-items: center; justify-content: center; padding: 11px 18px; border-radius: 10px; font-weight: 600; font-size: 15px; text-decoration: none; border: 1px solid var(--line); }
      .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
      .btn.primary:hover { background: #5458e8; }
      nav .btn { padding: 7px 12px; font-size: 14px; color: var(--text); }
      main { padding-block: clamp(32px, 6vw, 56px) 72px; }
      .label { font: 500 11.5px 'JetBrains Mono', ui-monospace, monospace; letter-spacing: 0.07em; text-transform: uppercase; color: var(--soft); }
      h1 { margin: 10px 0 0; font-size: clamp(30px, 5vw, 46px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.08; text-wrap: balance; }
      .lead { margin: 14px 0 0; max-width: 62ch; font-size: 18px; color: var(--muted); }
      .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
      .tags span { font: 500 12px 'JetBrains Mono', ui-monospace, monospace; border: 1px solid var(--line); border-radius: 6px; padding: 2px 8px; background: rgba(255, 255, 255, 0.05); }
      .stage { margin-top: 28px; border-radius: 12px; overflow: hidden; border: 1px solid var(--line); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55); background: #111; }
      .slide { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; }
      .slide iframe { position: absolute; left: 0; top: 0; width: 960px; height: 540px; border: 0; transform-origin: 0 0; transform: scale(var(--s, 1)); }
      .hint { margin: 12px 0 0; font-size: 14px; color: var(--faint); }
      .hint kbd { font: 500 12px 'JetBrains Mono', ui-monospace, monospace; color: var(--text); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 4px; padding: 0 5px; }
      .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-top: 20px; }
      .small { font-size: 13.5px; color: var(--faint); max-width: 44ch; }
      footer { border-top: 1px solid var(--line); padding-block: 28px; color: var(--faint); font-size: 13.5px; }
      footer .wrap { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 20px; }
      @media (max-width: 560px) { nav .hide { display: none; } }${styles ? `\n      ${styles.trim().split('\n').map(l => l.trim()).join('\n      ')}` : ''}
    </style>
  </head>
  <body>
    <header>
      <div class="wrap">
        <a class="logo" href="/"><span>P</span>arallax<sup class="beta">Beta</sup></a>
        <nav aria-label="Main">
          ${[...links, '<a class="btn" href="/">Parallax home</a>'].join('\n          ')}
        </nav>
      </div>
    </header>
    <main class="wrap">
      ${main.trim()}
    </main>
    <footer>
      <div class="wrap">
        <span>© 2026 Jess Birky. Licensed under AGPL-3.0.</span>
        <span>Support: <a href="mailto:${SUPPORT}">${SUPPORT}</a></span>
      </div>
    </footer>${script ? `
    <script>
      ${script.trim()}
    </script>` : ''}
  </body>
</html>
`
}

// Scales a page's 960 × 540 deck, or a w × h element, in #slide to the page's width
const fitScript = (w = 960) => `// Drawn at ${w} pixels wide and scaled to the page's width
      (function () {
        var box = document.getElementById('slide')
        function fit() { box.style.setProperty('--s', String(box.clientWidth / ${w})) }
        fit()
        if (window.ResizeObserver) new ResizeObserver(fit).observe(box); else window.addEventListener('resize', fit)
      })()`

// An example's own page: what it is, the live deck, a way into the editor,
// and the other examples. `example` and `others` are as the landing page has
// them ({ slug, field, title, desc, tags, thumbnail, background }).
function examplePage({ origin, example: e, others, guestEnabled, analytics, index }) {
  const thumbnail = e.thumbnail ? { path: e.thumbnail, width: 960, height: 540, alt: `The first slide of ${e.title}` } : SOCIAL_IMAGE
  const description = e.desc ? `${e.desc} A live Parallax deck.` : `${e.title}, a live Parallax deck.`
  const meta = pageMeta({ origin, path: `/examples/${e.slug}`, title: `${e.title} · Parallax examples`, description, image: thumbnail, index })
  const bg = b => (b?.type === 'color' && b.color) || '#1e1e2e'
  const card = o => `<a class="card" href="/examples/${esc(o.slug)}">
          <span class="thumb" style="background:${esc(bg(o.background))}">${o.thumbnail ? `<img loading="lazy" alt="" src="${esc(o.thumbnail)}" />` : `<b>${esc(o.title)}</b>`}</span>
          ${o.field ? `<span class="label">${esc(o.field)}</span>` : ''}
          <span class="name">${esc(o.title)}</span>
        </a>`
  const editor = guestEnabled
    ? `<a class="btn primary" href="/try?example=${esc(e.slug)}" data-umami-event="example-to-editor" data-umami-event-example="${esc(e.slug)}" data-umami-event-from="page">Open in the editor</a>
        <span class="small">Opens a copy you can change, with no account. It lasts until you close the tab.</span>`
    : `<a class="btn primary" href="/" data-umami-event="sign-in" data-umami-event-from="example-page">Make your own with Parallax</a>`
  return sitePage({
    meta, analytics,
    nav: [['/#examples', 'All examples', true], ['/plugins', 'Plugins', true], ['/#docs', 'Docs', true]],
    styles: `
      .more { margin-top: 64px; }
      .more h2 { margin: 0 0 18px; font-size: 24px; letter-spacing: -0.02em; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 18px; }
      .card { display: grid; gap: 6px; text-decoration: none; }
      .thumb { position: relative; display: grid; place-items: center; aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); }
      .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .thumb b { padding: 12px; text-align: center; color: #fff; }
      .card:hover .thumb { border-color: rgba(143, 146, 250, 0.6); }
      .card .name { font-weight: 600; }`,
    main: `
      ${e.field ? `<div class="label">${esc(e.field)}</div>` : ''}
      <h1>${esc(e.title)}</h1>
      ${e.desc ? `<p class="lead">${esc(e.desc)}</p>` : ''}
      ${e.tags?.length ? `<div class="tags">${e.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="stage"><div class="slide" id="slide"><iframe src="/examples/${esc(e.slug)}/deck" title="${esc(e.title)}, a live Parallax deck" allow="fullscreen"></iframe></div></div>
      <p class="hint">A live deck, as it’s presented. Click the slide, then press <kbd>→</kbd> to step through it and <kbd>←</kbd> to go back.</p>
      <div class="actions">
        ${editor}
      </div>
      ${others.length ? `<section class="more" aria-labelledby="more">
        <h2 id="more">More examples</h2>
        <div class="grid">
        ${others.map(card).join('\n        ')}
        </div>
      </section>` : ''}`,
    script: fitScript(),
  })
}

module.exports = { pageMeta, appHtml, robotsTxt, sitemapXml, examplePage, sitePage, fitScript, esc, DESCRIPTION, TAGLINE, SOCIAL_IMAGE }

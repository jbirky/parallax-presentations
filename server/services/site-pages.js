// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// What the site tells link previews and search engines: the tags in each
// page's head (title, description, preview image, canonical address), a page
// of its own for each landing page example and template, the shell the
// plugin gallery's pages share (services/plugin-pages.js), robots.txt and
// sitemap.xml. Only the landing page and the examples', templates' and
// plugins' pages are for search engines, and only on a site that's indexed
// (not dev, nor a self-hosted copy).

const TAGLINE = 'Interactive slides for complex concepts'
const DESCRIPTION = 'Parallax is a slide editor that runs in your browser. Put live graphs, physics and circuit diagrams, equations and 3D molecules on a slide, and move them while you present. Free to start, open source.'
const SOCIAL_IMAGE = { path: '/social/parallax.jpg', width: 1200, height: 630 }
const SUPPORT = 'support@parallax-presentations.com'

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Words an admin typed, ending as a sentence does, to go before another
const sentence = s => (/[.!?…]['’"”)]?$/.test(s.trim()) ? s.trim() : `${s.trim()}.`)

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
function sitemapXml({ origin, examples, templates = [], plugins = [] }) {
  const urls = [`${origin}/`, ...examples.map(e => `${origin}/examples/${e.slug}`), ...templates.map(e => `${origin}/templates/${e.slug}`),
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
  const description = e.desc ? `${sentence(e.desc)} A live Parallax deck.` : `${e.title}, a live Parallax deck.`
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

// A color for a style attribute: a hex color, rgb()/hsl(), or a name; else
// the fallback
const safeColor = (c, fallback = '#1e1e2e') => (/^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%/]+\)|[a-z]{3,20})$/i.test(String(c || '').trim()) ? String(c).trim() : fallback)

// A landing page template's own page: what it is, its deck live with every
// slide to jump to (drawn small by the server, services/template-slides.js,
// once a page has asked; until then each shows its name on its color), Use
// this template (the app's /templates/<slug>/use, which signs people in and
// makes their copy), its theme, and each slide's contents. On a phone, Use
// this template comes right after the slides.
// `template` and `others` are as the landing page has them; `facts` is
// client/src/utils/templateFacts.js's account of the deck.
function templatePage({ origin, template: t, facts, others, guestEnabled, analytics, index }) {
  const thumbnail = t.thumbnail ? { path: t.thumbnail, width: 960, height: 540, alt: `The first slide of ${t.title}` } : SOCIAL_IMAGE
  const description = t.desc ? `${sentence(t.desc)} A Parallax template to copy and make your own.` : `${t.title}, a Parallax template to copy and make your own.`
  const meta = pageMeta({ origin, path: `/templates/${t.slug}`, title: `${t.title} · Parallax templates`, description, image: thumbnail, index })
  const slides = facts.slides
  const slug = esc(t.slug)
  const bg = b => (b?.type === 'color' && b.color) || '#1e1e2e'
  const card = o => `<a class="card" href="/templates/${esc(o.slug)}">
          <span class="thumb" style="background:${esc(safeColor(bg(o.background)))}">${o.thumbnail ? `<img loading="lazy" alt="" src="${esc(o.thumbnail)}" />` : `<b>${esc(o.title)}</b>`}</span>
          ${o.field ? `<span class="label">${esc(o.field)}</span>` : ''}
          <span class="name">${esc(o.title)}</span>
        </a>`
  const thumb = (s, i) => `<button type="button" class="tp-thumb" role="listitem" data-go="${i}" aria-label="Slide ${i + 1}: ${esc(s.title)}" style="background:${esc(safeColor(s.background))};color:${esc(safeColor(s.text, '#ffffff'))}">
            <span class="tp-ph">${esc(s.title)}</span><img alt="" hidden /><span class="tp-n">${i + 1}</span>
          </button>`
  const row = (s, i) => `<li>
            <button type="button" class="tp-jump" data-go="${i}" aria-label="Show slide ${i + 1}">${i + 1}</button>
            <div><h3>${esc(s.title)}</h3>${s.layout || s.kinds.length ? `<p>${esc([s.layout, s.kinds.join(', ')].filter(Boolean).join(' · '))}</p>` : ''}</div>
          </li>`
  const swatch = c => `<li><i style="background:${esc(safeColor(c.value))}"></i><span>${esc(c.name)}<small>${esc(c.value)}</small></span></li>`
  const theme = facts.theme
  return sitePage({
    meta, analytics,
    nav: [['/#templates', 'All templates', true], ['/#examples', 'Examples', true], ['/plugins', 'Plugins', true]],
    styles: `
      .wrap { max-width: 1280px; }
      .tp-layout { display: grid; gap: 28px; grid-template-columns: minmax(0, 1fr); margin-top: 28px; }
      @media (min-width: 1040px) { .tp-layout { grid-template-columns: minmax(0, 1fr) 330px; align-items: start; } }
      .tp-main { display: grid; gap: 12px; min-width: 0; }
      .stage { margin-top: 0; }
      .tp-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .tp-controls .btn { padding: 8px 14px; font-size: 14px; background: var(--raise); color: var(--text); cursor: pointer; font-family: inherit; }
      .tp-controls .btn:hover { border-color: rgba(143, 146, 250, 0.6); }
      .tp-controls .btn:disabled { opacity: 0.45; cursor: default; }
      .tp-where { flex: 1; min-width: 160px; font-weight: 600; }
      .tp-where span:first-child { font: 500 13px 'JetBrains Mono', ui-monospace, monospace; color: var(--faint); margin-right: 8px; }
      .hint { margin: 0; }
      .tp-thumbs { display: grid; grid-auto-flow: column; grid-auto-columns: 152px; gap: 10px; overflow-x: auto; padding: 4px 2px 10px; scrollbar-width: thin; }
      .tp-thumb { position: relative; width: 152px; height: 85.5px; padding: 0; border: 2px solid var(--line); border-radius: 8px; overflow: hidden; cursor: pointer; font: inherit; }
      .tp-thumb[aria-current="true"] { border-color: var(--soft); }
      .tp-thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
      .tp-ph { position: absolute; inset: 0; display: grid; place-items: center; padding: 8px; font-size: 11px; font-weight: 600; line-height: 1.25; text-align: center; overflow: hidden; }
      .tp-n { position: absolute; right: 4px; bottom: 4px; z-index: 1; font: 600 10px/16px 'JetBrains Mono', ui-monospace, monospace; color: #fff; background: rgba(15, 15, 23, 0.8); padding: 0 5px; border-radius: 4px; }
      .tp-slides { margin-top: 36px; }
      .tp-slides h2, .more h2 { margin: 0 0 14px; font-size: 22px; letter-spacing: -0.02em; }
      .tp-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); }
      .tp-list li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: start; padding: 12px 14px; background: var(--raise); border: 1px solid var(--line); border-radius: 10px; }
      .tp-list h3 { margin: 0; font-size: 15px; line-height: 1.35; }
      .tp-list p { margin: 2px 0 0; font-size: 13.5px; color: var(--muted); }
      .tp-jump { font: 600 12px/18px 'JetBrains Mono', ui-monospace, monospace; min-width: 30px; padding: 3px 6px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--text); cursor: pointer; }
      .tp-jump:hover { border-color: var(--soft); }
      .tp-side { display: grid; gap: 14px; min-width: 0; }
      .tp-card { background: var(--raise); border: 1px solid var(--line); border-radius: 12px; padding: 18px; display: grid; gap: 10px; min-width: 0; }
      .tp-card h2 { margin: 0; font-size: 17px; }
      .tp-card p { margin: 0; font-size: 14px; color: var(--muted); }
      .tp-card strong { color: var(--text); }
      .tp-use .btn.primary { width: 100%; }
      .tp-quiet { font-size: 14px; color: var(--soft); }
      .tp-swatches { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
      .tp-swatches li { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px; align-items: center; font-size: 13.5px; line-height: 1.25; }
      .tp-swatches i { width: 22px; height: 22px; border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18); }
      .tp-swatches small { display: block; font: 11px 'JetBrains Mono', ui-monospace, monospace; color: var(--faint); }
      .tp-facts { width: 100%; border-collapse: collapse; font-size: 13.5px; }
      .tp-facts td { padding: 5px 0; border-top: 1px solid var(--line); }
      .tp-facts td:last-child { text-align: right; color: var(--muted); }
      .tp-chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
      .tp-chips li { font: 500 12px 'JetBrains Mono', ui-monospace, monospace; border: 1px solid var(--line); border-radius: 6px; padding: 2px 8px; background: rgba(255, 255, 255, 0.05); }
      .tp-card details summary { cursor: pointer; font-size: 14px; font-weight: 600; }
      .tp-card pre { max-height: 260px; overflow: auto; margin: 8px 0 0; padding: 10px; border-radius: 8px; background: var(--bg); border: 1px solid var(--line); font: 11.5px/1.5 'JetBrains Mono', ui-monospace, monospace; white-space: pre; }
      .more { margin-top: 56px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 18px; }
      .card { display: grid; gap: 6px; text-decoration: none; }
      .thumb { position: relative; display: grid; place-items: center; aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); }
      .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .thumb b { padding: 12px; text-align: center; color: #fff; }
      .card:hover .thumb { border-color: rgba(143, 146, 250, 0.6); }
      .card .name { font-weight: 600; }`,
    main: `
      <div class="label">${t.field ? `${esc(t.field)} · ` : ''}Template</div>
      <h1>${esc(t.title)}</h1>
      ${t.desc ? `<p class="lead">${esc(t.desc)}</p>` : ''}
      ${t.tags?.length ? `<div class="tags">${t.tags.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
      <div class="tp-layout">
        <div class="tp-main">
          <div class="stage"><div class="slide" id="slide"><iframe id="deck" src="/examples/${slug}/deck" title="${esc(t.title)}, a live Parallax deck" allow="fullscreen"></iframe></div></div>
          <div class="tp-controls">
            <button type="button" class="btn" id="tp-prev">← Back</button>
            <div class="tp-where" aria-live="polite"><span id="tp-num">1 / ${slides.length}</span><span id="tp-name">${esc(slides[0]?.title || '')}</span></div>
            <button type="button" class="btn" id="tp-next">Next →</button>
          </div>
          <p class="hint">Back and Next step through each slide’s builds, as <kbd>←</kbd> and <kbd>→</kbd> do. Pick a slide below to jump to it.</p>
          <div class="tp-thumbs" id="tp-thumbs" role="list" aria-label="Slides">
          ${slides.map(thumb).join('\n          ')}
          </div>
        </div>
        <aside class="tp-side">
          <section class="tp-card tp-use">
            <h2>Use this template</h2>
            <p>A copy of all ${slides.length} slides goes in your presentations, yours to change. The template stays as it is.</p>
            <a class="btn primary" href="/templates/${slug}/use" data-umami-event="template-to-account" data-umami-event-template="${slug}" data-umami-event-from="page">Use this template</a>
            <p>You’ll sign in or sign up first if you haven’t.</p>
            ${guestEnabled ? `<a class="tp-quiet" href="/try?example=${slug}" data-umami-event="template-to-guest" data-umami-event-template="${slug}" data-umami-event-from="page">Try it without an account</a>` : ''}
          </section>
          <section class="tp-card">
            <h2>Theme</h2>
            <p><strong>${esc(theme.label)}</strong>${theme.ownColors ? ', with colors of its own' : ''}${theme.stylesheet ? ' and a stylesheet of its own' : ''}</p>
            ${theme.note ? `<p>${esc(theme.note)}</p>` : ''}
            <ul class="tp-swatches">
              ${facts.colors.map(swatch).join('\n              ')}
            </ul>
            <table class="tp-facts">
              <tr><td>Text font</td><td>${esc(facts.fonts.text)}</td></tr>
              <tr><td>Heading font</td><td>${esc(facts.fonts.heading)}</td></tr>
              ${facts.sizes.map(s => `<tr><td>${esc(s.name)}</td><td>${s.px} px</td></tr>`).join('\n              ')}
            </table>
            ${theme.stylesheet ? `<details><summary>Its stylesheet</summary><pre>${esc(theme.stylesheet)}</pre></details>` : ''}
          </section>
          ${facts.contents.length ? `<section class="tp-card">
            <h2>What’s in it</h2>
            <ul class="tp-chips">
              ${facts.contents.map(c => `<li>${esc(c)}</li>`).join('\n              ')}
            </ul>
          </section>` : ''}
        </aside>
      </div>
      <section class="tp-slides" aria-labelledby="tp-slides-title">
        <h2 id="tp-slides-title">Slide by slide</h2>
        <ol class="tp-list">
        ${slides.map(row).join('\n        ')}
        </ol>
      </section>
      ${others.length ? `<section class="more" aria-labelledby="more">
        <h2 id="more">More templates</h2>
        <div class="grid">
        ${others.map(card).join('\n        ')}
        </div>
      </section>` : ''}`,
    script: `${fitScript()}
      // The deck says which slide it shows; Back, Next, the keys and the
      // slides below move it (the deck's bridge, client/src/utils/generateHTML.js)
      ;(function () {
        var deck = document.getElementById('deck')
        var names = ${JSON.stringify(slides.map(s => s.title)).replace(/</g, '\\u003c')}
        var thumbs = Array.prototype.slice.call(document.querySelectorAll('.tp-thumb'))
        var at = 0
        function send(msg) { deck.contentWindow && deck.contentWindow.postMessage(Object.assign({ type: 'parallax-deck-go' }, msg), '*') }
        function show(i) {
          at = i
          document.getElementById('tp-num').textContent = (i + 1) + ' / ' + names.length
          document.getElementById('tp-name').textContent = names[i] || ''
          thumbs.forEach(function (t, k) { t.setAttribute('aria-current', String(k === i)) })
          var t = thumbs[i], strip = document.getElementById('tp-thumbs')
          if (t && (t.offsetLeft < strip.scrollLeft || t.offsetLeft + t.offsetWidth > strip.scrollLeft + strip.clientWidth)) strip.scrollLeft = t.offsetLeft - 20
        }
        window.addEventListener('message', function (e) {
          if (e.source !== deck.contentWindow || !e.data || e.data.type !== 'parallax-deck' || typeof e.data.slide !== 'number') return
          show(e.data.slide)
        })
        document.getElementById('tp-prev').addEventListener('click', function () { send({ step: -1 }) })
        document.getElementById('tp-next').addEventListener('click', function () { send({ step: 1 }) })
        document.querySelectorAll('[data-go]').forEach(function (b) {
          b.addEventListener('click', function () { send({ slide: Number(b.getAttribute('data-go')) }) })
        })
        document.addEventListener('keydown', function (e) {
          if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
          if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); send({ step: 1 }) }
          else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); send({ step: -1 }) }
        })
        show(0)

        // The slides drawn small, once the server has them
        var tries = 0
        function load() {
          fetch('/templates/${slug}/slides.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null }).then(function (s) {
            if (s && s.ready) {
              thumbs.forEach(function (t, k) {
                if (k >= s.count) return
                var img = t.querySelector('img')
                img.onload = function () { img.hidden = false; t.querySelector('.tp-ph').hidden = true }
                img.src = s.path + (k + 1) + '.jpg'
              })
            } else if (s && s.drawing && ++tries < 40) setTimeout(load, 4000)
          }).catch(function () {})
        }
        load()
      })()`,
  })
}

module.exports = { pageMeta, appHtml, robotsTxt, sitemapXml, examplePage, templatePage, sitePage, fitScript, esc, DESCRIPTION, TAGLINE, SOCIAL_IMAGE }

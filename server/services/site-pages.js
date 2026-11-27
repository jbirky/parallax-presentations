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
    ...['/api/', '/dashboard', '/admin', '/try', '/share/', '/live/', '/invite/', '/teams/', '/uploads/', '/stats/'].map(p => `Disallow: ${p}`),
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

// Light or dark, as the visitor chose on this site (the app keeps the choice
// in localStorage, utils/theme.js): dark unless light was chosen. Set before
// the page draws, so it doesn't show the other one first.
const THEME_EARLY = "try { var t = localStorage.getItem('parallax-theme'); if (t !== 'light' && t !== 'dark') t = localStorage.getItem('editor-theme') === 'light' ? 'light' : null; if (t) document.documentElement.setAttribute('data-theme', t) } catch (e) {}"
// The mark, as on the landing page: the P as each eye sees it, red and
// blue, and where they overlap in the page's ink
const MARK_P = 'M26 18H56A22 22 0 0 1 56 62H42V82H26ZM42 32H55A8 8 0 0 1 55 48H42Z'
// The mark as the P of the wordmark: its box fits the glyphs, so at a
// capital's height (0.69em of Archivo) on the baseline it reads as the first
// letter (as client/src/components/ParallaxMark.jsx Wordmark has it)
const MARK = `<svg class="wm-p" viewBox="18 18 64 64" aria-hidden="true" focusable="false"><defs><clipPath id="mark-clip"><path d="${MARK_P}" transform="translate(-6 0)" clip-rule="evenodd"/></clipPath></defs>`
  + `<g transform="translate(-2 0)" fill-rule="evenodd"><path d="${MARK_P}" transform="translate(-6 0)" fill="#ee2b2b"/><path d="${MARK_P}" transform="translate(6 0)" fill="#1e60ff"/>`
  + `<g clip-path="url(#mark-clip)"><path d="${MARK_P}" transform="translate(6 0)" style="fill: var(--text)"/></g></g></svg>`
// The header's toggle: a sun to go light, a moon to go dark
const THEME_BUTTON = `<button type="button" class="theme" id="theme-toggle" aria-label="Switch to light theme" title="Switch to light theme">`
  + `<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`
  + `<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg></button>`
const THEME_TOGGLE = `(function () {
      var root = document.documentElement, button = document.getElementById('theme-toggle')
      function label() {
        var next = root.getAttribute('data-theme') === 'light' ? 'Switch to dark theme' : 'Switch to light theme'
        button.setAttribute('aria-label', next); button.title = next
      }
      button.addEventListener('click', function () {
        var theme = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light'
        root.setAttribute('data-theme', theme)
        try { localStorage.setItem('parallax-theme', theme) } catch (e) {}
        label()
      })
      label()
    })()`

// The site's own pages around `main`: the head (`meta` from pageMeta, the
// analytics script when it's on), a header with `nav` and `end`, and the
// footer. `nav` is links, each [href, text, hide on a phone] or { href,
// text, hide, current, external }, where hide is 'wide' or 'mid' to leave
// it out where the landing page's nav does (client/src/index.css), and
// current is the aria-current it gets; `end` is the header's last link,
// [href, text], a button. `styles` and `script` are the page's own, after
// the shared ones.
function sitePage({ meta, analytics, nav = [], end = ['/', 'Parallax home'], main, styles = '', script = '' }) {
  const links = nav.map(n => {
    const { href, text, hide, current, external } = Array.isArray(n) ? { href: n[0], text: n[1], hide: n[2] } : n
    const cls = hide === 'wide' || hide === 'mid' ? hide : hide ? 'hide' : ''
    return `<a${cls ? ` class="${cls}"` : ''} href="${esc(href)}"${current ? ` aria-current="${esc(current)}"` : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(text)}</a>`
  })
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${meta}
    <script>${THEME_EARLY}</script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" />
    ${analytics ? `<script defer src="/stats/script.js" data-website-id="${esc(analytics.websiteId)}" data-do-not-track="true"></script>` : ''}
    <style>
      /* As the landing page has it (client/src/index.css, Landing Page): ink,
         or paper when light is chosen; the red and blue of 3D glasses as
         offset shadows; Archivo headings over Inter; square corners. Ink and
         paper are a soft charcoal and a warm gray-white, not black and white */
      :root { color-scheme: dark; --ink: #1f1f22; --paper: #ecebe6; --bg: var(--ink); --raise: #28282c; --card: #2e2e32; --line: rgba(236, 235, 230, 0.16); --chip-line: rgba(236, 235, 230, 0.25); --edge: rgba(236, 235, 230, 0.45); --text: var(--paper); --muted: #b6b6b1; --faint: #9a9a96; --tag: #ff8a80; --soft: #8db0ff; --accent: #1e60ff; --nav-bg: rgba(31, 31, 34, 0.92); --chip: transparent; --ring: rgba(236, 235, 230, 0.2);
        --red: #ee2b2b; --blue: #1e60ff; --stereo: 10px;
        --frame-shadow: calc(-1 * var(--stereo)) 0 0 var(--red), var(--stereo) 0 0 var(--blue);
        --small-shadow: calc(-0.5 * var(--stereo)) 0 0 var(--red), calc(0.5 * var(--stereo)) 0 0 var(--blue);
        --stage-shadow: var(--frame-shadow);
        --display: Archivo, Inter, -apple-system, 'Segoe UI', sans-serif; --mono: 'JetBrains Mono', ui-monospace, monospace; }
      :root[data-theme="light"] { color-scheme: light; --bg: var(--paper); --raise: #e2e1db; --card: #e2e1db; --line: #cfcec7; --chip-line: rgba(31, 31, 34, 0.25); --edge: var(--ink); --text: var(--ink); --muted: #434347; --faint: #5e5e62; --tag: #b81b1b; --soft: #1650d8; --nav-bg: rgba(236, 235, 230, 0.92); --ring: rgba(31, 31, 34, 0.18); }
      @media (max-width: 600px) { :root { --stereo: 6px; } }
      @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 Inter, -apple-system, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
      a { color: inherit; }
      :focus-visible { outline: 3px solid var(--blue); outline-offset: 3px; }
      .wrap { max-width: 1040px; margin: 0 auto; padding-inline: clamp(16px, 4vw, 40px); }
      header { border-bottom: 1px solid var(--line); background: var(--nav-bg); position: sticky; top: 0; z-index: 5; backdrop-filter: blur(10px); }
      header .wrap { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-block: 8px; }
      .logo { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; white-space: nowrap; }
      .logo .wm { display: inline-flex; align-items: baseline; font: 800 28px/1 var(--display); letter-spacing: -0.035em; }
      .logo .wm-p { display: block; flex: none; width: 0.69em; height: 0.69em; margin-right: 0.05em; }
      .vh { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
      .beta { padding: 3px 6px; font: 700 10px/1.2 Inter, sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: var(--bg); background: var(--text); }
      nav { display: flex; align-items: center; gap: 2px; }
      nav a { padding: 12px 10px; color: var(--text); font-size: 14.5px; font-weight: 500; text-decoration: none; text-underline-offset: 7px; text-decoration-thickness: 2px; white-space: nowrap; }
      nav a:hover { text-decoration: underline; text-decoration-color: var(--edge); }
      nav a[aria-current] { text-decoration: underline; text-decoration-color: var(--red); }
      /* Hovered, the two eyes' copies of a button move apart */
      .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 20px; font-weight: 600; font-size: 15px; color: var(--text); text-decoration: none; border: 1.5px solid var(--edge); transition: box-shadow 0.15s, background-color 0.15s; }
      .btn:hover { border-color: var(--text); background: color-mix(in srgb, var(--text) 8%, transparent); }
      .btn.primary { color: var(--bg); background: var(--text); border-color: var(--text); box-shadow: var(--small-shadow); }
      .btn.primary:hover { background: var(--text); box-shadow: var(--frame-shadow); }
      nav .btn { min-height: 44px; margin-left: 8px; padding: 0 16px; font-size: 14px; }
      nav a.btn:hover { text-decoration: none; color: var(--bg); background: var(--text); border-color: var(--text); }
      .theme { display: inline-grid; place-items: center; width: 40px; height: 44px; padding: 0; border: 0; background: none; color: var(--text); cursor: pointer; }
      .theme:hover { background: color-mix(in srgb, var(--text) 8%, transparent); }
      .theme svg { width: 17px; height: 17px; }
      :root[data-theme="light"] .theme .sun, :root:not([data-theme="light"]) .theme .moon { display: none; }
      main { padding-block: clamp(40px, 7vw, 72px) 96px; }
      .label { font: 600 12px/1.4 Inter, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: var(--tag); }
      /* The page's eyebrow, after the mark's three bars */
      main > .label, .phead .label { display: flex; align-items: center; gap: 14px; font-size: 13px; letter-spacing: 0.15em; color: var(--text); }
      main > .label::before, .phead .label::before { content: ''; flex: none; width: 32px; height: 10px; background: linear-gradient(90deg, var(--red) 0 7px, var(--text) 7px 25px, var(--blue) 25px); }
      h1 { margin: 18px 0 0; font: 800 clamp(36px, 5.6vw, 64px)/1.02 var(--display); letter-spacing: -0.03em; text-wrap: balance; }
      h2, h3 { font-family: var(--display); }
      .lead { margin: 18px 0 0; max-width: 62ch; font-size: 18px; line-height: 1.5; color: var(--muted); }
      .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 18px; }
      .tags span { padding: 3px 8px; font-size: 12px; line-height: 1.4; color: var(--muted); border: 1px solid var(--line); }
      .stage { margin-top: 40px; overflow: hidden; background: #000; box-shadow: var(--stage-shadow); }
      .slide { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; }
      .slide iframe { position: absolute; left: 0; top: 0; width: 960px; height: 540px; border: 0; transform-origin: 0 0; transform: scale(var(--s, 1)); }
      .hint { margin: 20px 0 0; font-size: 14px; color: var(--faint); }
      .hint kbd { font: 500 12px var(--mono); color: var(--text); border: 1px solid var(--edge); border-bottom-width: 2px; padding: 0 5px; }
      .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 20px; margin-top: 24px; }
      .small { font-size: 13.5px; color: var(--faint); max-width: 44ch; }
      footer { border-top: 1px solid var(--line); padding-block: 32px; color: var(--faint); font-size: 13.5px; }
      footer .wrap { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 20px; }
      footer a { color: var(--soft); }
      @media (max-width: 680px) { nav .hide { display: none; } }
      @media (max-width: 960px) { nav .wide { display: none; } }
      @media (max-width: 600px) { nav .mid { display: none; } }
      @media (max-width: 520px) { .beta { display: none; } .logo .wm { font-size: 25px; } nav a { padding-inline: 7px; } nav .btn { margin-left: 4px; padding-inline: 12px; } }
      @media (max-width: 420px) { header .wrap, .logo { gap: 8px; } .logo .wm { font-size: 23px; } .beta { display: none; } nav a { padding-inline: 6px; font-size: 14px; } .theme { width: 30px; } nav .btn { margin-left: 2px; padding-inline: 10px; } }
      @media (max-width: 370px) { nav a { padding-inline: 5px; } nav .btn { padding-inline: 8px; } }
      /* The smallest phones: the mark alone (its link still says Parallax) */
      @media (max-width: 359px) { .logo .word { display: none; } .logo .wm-p { width: 24px; height: 24px; margin: 0; } }${styles ? `\n      ${styles.trim().split('\n').map(l => l.trim()).join('\n      ')}` : ''}
    </style>
  </head>
  <body>
    <header>
      <div class="wrap">
        <a class="logo" href="/" aria-label="Parallax"><span class="wm">${MARK}<span class="word"><span class="vh">P</span>arallax</span></span><span class="beta">Beta</span></a>
        <nav aria-label="Main">
          ${[...links, THEME_BUTTON, `<a class="btn" href="${esc(end[0])}">${esc(end[1])}</a>`].join('\n          ')}
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
    </footer>
    <script>${THEME_TOGGLE}</script>${script ? `
    <script>
      ${script.trim()}
    </script>` : ''}
  </body>
</html>
`
}

// The landing page's tabs, in its order (client/src/pages/LandingPage.jsx),
// to its sections by their ids there, which it scrolls to; `href` is the
// tab of the page they head, marked with `current` (its aria-current). For
// the hosted site's pages, where there are a landing page, templates and a
// sign-in: SIGN_IN ends their header
const LANDING_TABS = [
  { href: '/#features', text: 'Features', hide: 'wide' },
  { href: '/#examples', text: 'Examples', hide: 'mid' },
  { href: '/#templates', text: 'Templates' },
  { href: '/plugins', text: 'Plugins', hide: 'wide' },
  { href: '/#workflow', text: 'How it works', hide: 'wide' },
  { href: '/#docs', text: 'Docs' },
  { href: 'https://github.com/jbirky/parallax-presentations', text: 'GitHub', hide: 'wide', external: true },
]
const landingTabs = (href, current = 'true') => LANDING_TABS.map(n => (n.href === href ? { ...n, current } : n))
const SIGN_IN = ['/sign-in', 'Sign in']

// Scales a page's 960 × 540 deck, or a w × h element, in #slide to the page's width
const fitScript = (w = 960) => `// Drawn at ${w} pixels wide and scaled to the page's width
      (function () {
        var box = document.getElementById('slide')
        function fit() { box.style.setProperty('--s', String(box.clientWidth / ${w})) }
        fit()
        if (window.ResizeObserver) new ResizeObserver(fit).observe(box); else window.addEventListener('resize', fit)
      })()`

// The other examples, or templates, under a page: cards as the landing
// page has them, square, under a rule in the page's ink
const MORE_STYLES = `
      .more { margin-top: 80px; padding-top: 40px; border-top: 1px solid var(--line); }
      .more h2 { margin: 0 0 24px; font: 800 clamp(26px, 3vw, 34px)/1.1 var(--display); letter-spacing: -0.02em; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 20px; }
      .card { display: grid; gap: 6px; align-content: start; padding-bottom: 16px; text-decoration: none; background: var(--card); border-top: 4px solid var(--text); transition: box-shadow 0.15s, transform 0.15s; }
      .card > .label, .card > .name { padding-inline: 14px; }
      .card > .label { margin-top: 8px; }
      .card:hover { transform: translateY(-3px); box-shadow: var(--small-shadow); }
      .thumb { position: relative; display: grid; place-items: center; aspect-ratio: 16 / 9; overflow: hidden; }
      .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .thumb b { padding: 12px; text-align: center; color: #fff; font-family: var(--display); }
      .card .name { font: 700 17px/1.25 var(--display); letter-spacing: -0.01em; }`

// An example's own page: what it is, the live deck, a way into the editor,
// and the other examples. `example` and `others` are as the landing page has
// them ({ slug, field, title, desc, tags, thumbnail, background }). On the
// hosted site (`cloud`) its header has the landing page's tabs; a
// self-hosted server has no landing page, so a few links and one home.
function examplePage({ origin, example: e, others, guestEnabled, analytics, index, cloud = false }) {
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
    ...(cloud ? { nav: landingTabs('/#examples'), end: SIGN_IN } : { nav: [['/#examples', 'All examples', true], ['/plugins', 'Plugins', true], ['/#docs', 'Docs', true]] }),
    styles: MORE_STYLES,
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
          <span class="thumb" style="background:${esc(safeColor(bg(o.background)))}">${o.thumbnail ? `<img loading="lazy" alt="" src="${esc(o.thumbnail)}" />` : `<b>${esc(o.title)}</b>`}${o.theme ? `<i class="theme-pill">${esc(o.theme)}<span class="sr"> theme</span></i>` : ''}</span>
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
    nav: landingTabs('/#templates'), end: SIGN_IN,
    styles: `
      .wrap { max-width: 1280px; }
      .tp-layout { display: grid; gap: 28px; grid-template-columns: minmax(0, 1fr); margin-top: 28px; }
      @media (min-width: 1040px) { .tp-layout { grid-template-columns: minmax(0, 1fr) 330px; align-items: start; } }
      .tp-main { display: grid; gap: 12px; min-width: 0; }
      .stage { margin-top: 0; }
      .tp-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .tp-controls .btn { min-height: 40px; padding: 0 14px; font-size: 14px; background: transparent; cursor: pointer; font-family: inherit; }
      .tp-controls .btn:disabled { opacity: 0.45; cursor: default; }
      .tp-where { flex: 1; min-width: 160px; font-weight: 600; }
      .tp-where span:first-child { font: 500 13px 'JetBrains Mono', ui-monospace, monospace; color: var(--faint); margin-right: 8px; }
      .hint { margin: 0; }
      .tp-thumbs { display: grid; grid-auto-flow: column; grid-auto-columns: 152px; gap: 10px; overflow-x: auto; padding: 4px 2px 10px; scrollbar-width: thin; }
      .tp-thumb { position: relative; width: 152px; height: 85.5px; padding: 0; border: 2px solid var(--line); overflow: hidden; cursor: pointer; font: inherit; }
      .tp-thumb[aria-current="true"] { border-color: var(--blue); box-shadow: var(--small-shadow); }
      .tp-thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
      .tp-ph { position: absolute; inset: 0; display: grid; place-items: center; padding: 8px; font-size: 11px; font-weight: 600; line-height: 1.25; text-align: center; overflow: hidden; }
      .tp-n { position: absolute; right: 4px; bottom: 4px; z-index: 1; font: 600 10px/16px 'JetBrains Mono', ui-monospace, monospace; color: var(--paper); background: rgba(31, 31, 34, 0.85); padding: 0 5px; }
      .tp-slides { margin-top: 56px; }
      .tp-slides h2 { margin: 0 0 20px; font: 800 clamp(26px, 3vw, 34px)/1.1 var(--display); letter-spacing: -0.02em; }
      .tp-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); }
      .tp-list li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: start; padding: 14px; background: var(--card); border-top: 3px solid var(--text); }
      .tp-list h3 { margin: 0; font-size: 16px; font-weight: 700; line-height: 1.3; }
      .tp-list p { margin: 2px 0 0; font-size: 13.5px; color: var(--muted); }
      .tp-jump { font: 600 12px/18px var(--mono); min-width: 32px; padding: 4px 6px; border: 1.5px solid var(--edge); background: transparent; color: var(--text); cursor: pointer; }
      .tp-jump:hover { color: var(--bg); background: var(--text); border-color: var(--text); }
      .tp-side { display: grid; gap: 14px; min-width: 0; }
      .tp-card { background: var(--card); border-top: 4px solid var(--text); padding: 20px; display: grid; gap: 10px; min-width: 0; }
      .tp-card h2 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }
      .tp-card p { margin: 0; font-size: 14px; color: var(--muted); }
      .tp-card strong { color: var(--text); }
      .tp-use .btn.primary { width: 100%; }
      .tp-quiet { font-size: 14px; color: var(--muted); text-underline-offset: 3px; }
      .tp-quiet:hover { color: var(--text); }
      .tp-swatches { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
      .tp-swatches li { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px; align-items: center; font-size: 13.5px; line-height: 1.25; }
      .tp-swatches i { width: 22px; height: 22px; box-shadow: inset 0 0 0 1px var(--ring); }
      .tp-swatches small { display: block; font: 11px 'JetBrains Mono', ui-monospace, monospace; color: var(--faint); }
      .tp-facts { width: 100%; border-collapse: collapse; font-size: 13.5px; }
      .tp-facts td { padding: 5px 0; border-top: 1px solid var(--line); }
      .tp-facts td:last-child { text-align: right; color: var(--muted); }
      .tp-chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
      .tp-chips li { font-size: 12px; line-height: 1.4; color: var(--muted); border: 1px solid var(--line); padding: 3px 8px; }
      .tp-card details summary { cursor: pointer; font-size: 14px; font-weight: 600; }
      .tp-card pre { max-height: 260px; overflow: auto; margin: 8px 0 0; padding: 10px; background: var(--bg); border: 1px solid var(--line); font: 11.5px/1.5 var(--mono); white-space: pre; }
      .theme-pill { position: absolute; right: 8px; bottom: 8px; padding: 5px 9px; font: normal 600 11.5px/1 Inter, sans-serif; color: var(--ink); background: var(--paper); box-shadow: 0 0 0 1px rgba(31, 31, 34, 0.2); }
      .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      ${MORE_STYLES}`,
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
            <p><strong>${esc(theme.label)}</strong>${theme.named ? `, a theme of the deck’s own, on ${esc(theme.base)}` : `${theme.ownColors ? ', with colors of its own' : ''}${theme.stylesheet ? ' and a stylesheet of its own' : ''}`}</p>
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

module.exports = { pageMeta, appHtml, robotsTxt, sitemapXml, examplePage, templatePage, sitePage, fitScript, esc, landingTabs, SIGN_IN, DESCRIPTION, TAGLINE, SOCIAL_IMAGE }

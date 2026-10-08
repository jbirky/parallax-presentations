// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The public plugin gallery (/plugins) and each listed plugin's own page
// (/plugins/<slug>): the community plugins an admin approved
// (services/community-plugins.js), in the site's pages' shell
// (services/site-pages.js). A plugin's page shows it live, from
// /plugins/<slug>/preview, in a sandbox, and its README, which anyone could
// have written: its raw HTML shows as text, links keep only web, mail and
// in-page addresses, and images come only from GitHub's own hosts.

const { sitePage, pageMeta, fitScript, esc, SOCIAL_IMAGE } = require('./site-pages')

const CATEGORY_LABELS = {
  math: 'Math', physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology', astronomy: 'Astronomy',
  data: 'Data', 'computer science': 'Computer science', teaching: 'Teaching', other: 'Other',
}
const NAV = [['/#examples', 'Examples', true], ['/plugins', 'Plugins', true], ['/#docs', 'Docs', true]]
// The repo to copy to start a plugin
const TEMPLATE_URL = 'https://github.com/jbirky/parallax-plugin-template'
// Where a README's images may come from
const IMAGE_HOSTS = ['raw.githubusercontent.com', 'github.com', 'user-images.githubusercontent.com', 'private-user-images.githubusercontent.com', 'camo.githubusercontent.com', 'avatars.githubusercontent.com']

const formatDate = iso => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '')
const isoDate = iso => (iso ? new Date(iso).toISOString() : '')
const count = n => Number(n || 0).toLocaleString('en-US')
const installs = n => (Number(n) === 1 ? '1 install' : `${count(n)} installs`)
const repoUrl = p => `https://github.com/${encodeURIComponent(p.repoOwner)}/${encodeURIComponent(p.repoName)}`
const avatarUrl = owner => `https://github.com/${encodeURIComponent(owner)}.png?size=64`
const pathUrl = file => String(file).split('/').map(encodeURIComponent).join('/')

// A plugin's icon, from its own files, or null
function iconUrl(p) {
  const icon = p.manifest?.icon
  return icon ? `/api/plugin-files/${encodeURIComponent(p.pluginId)}/${encodeURIComponent(p.version)}/${pathUrl(icon)}` : null
}

function iconHtml(p, size) {
  const url = iconUrl(p)
  return url
    ? `<span class="picon" style="width:${size}px;height:${size}px"><img src="${esc(url)}" alt="" width="${size}" height="${size}" /></span>`
    : `<span class="picon blank" style="width:${size}px;height:${size}px" aria-hidden="true">${esc((p.name || '?').slice(0, 1).toUpperCase())}</span>`
}

// --- READMEs ---

// A README as HTML. Relative links and images point into the repo at the
// version's commit; the first heading goes when it starts the README,
// since the page has the plugin's name as its own.
async function renderReadme(markdown, { owner, repo, commit }) {
  const { Marked } = await import('marked')
  const at = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
  function address(href, kind) {
    const h = String(href || '').trim()
    if (/^(https?:|mailto:)/i.test(h)) return h
    if (h.startsWith('#')) return h
    // javascript:, data:, //host and anything else with a scheme
    if (/^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith('//') || !h) return null
    const file = h.replace(/^(\.\/)+/, '').replace(/^\//, '')
    return kind === 'image' ? `https://raw.githubusercontent.com/${at}/${commit}/${file}` : `https://github.com/${at}/blob/${commit}/${file}`
  }
  const marked = new Marked({
    gfm: true,
    renderer: {
      html({ text }) { return esc(text) },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens)
        const url = address(href, 'link')
        if (!url) return inner
        return `<a href="${esc(url)}"${title ? ` title="${esc(title)}"` : ''}${url.startsWith('#') ? '' : ' rel="nofollow noopener" target="_blank"'}>${inner}</a>`
      },
      image({ href, title, text }) {
        const url = address(href, 'image')
        let host = ''
        try { host = new URL(url).hostname } catch { /* not an address */ }
        if (!url || !url.startsWith('https:') || !IMAGE_HOSTS.includes(host)) return text ? `<span class="noimg">[${esc(text)}]</span>` : ''
        return `<img src="${esc(url)}" alt="${esc(text)}"${title ? ` title="${esc(title)}"` : ''} loading="lazy" />`
      },
    },
  })
  const tokens = marked.lexer(String(markdown || ''))
  while (tokens.length && tokens[0].type === 'space') tokens.shift()
  if (tokens[0]?.type === 'heading' && tokens[0].depth === 1) tokens.shift()
  return marked.parser(tokens)
}

// --- The gallery ---

const GALLERY_STYLES = `
  .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
  .toolbar input, .toolbar select { font: inherit; font-size: 15px; color: var(--text); background: var(--raise); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; }
  .toolbar input { flex: 1 1 260px; min-width: 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .chips button { font: 500 13px Inter, sans-serif; color: var(--muted); background: transparent; border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; cursor: pointer; }
  .chips button[aria-pressed="true"] { color: var(--text); background: rgba(99, 102, 241, 0.18); border-color: rgba(99, 102, 241, 0.6); }
  .plugins { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 16px; margin-top: 24px; }
  .pcard { display: flex; gap: 14px; padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--raise); text-decoration: none; min-width: 0; }
  .pcard:hover { border-color: rgba(143, 146, 250, 0.6); }
  .picon { display: grid; place-items: center; flex: none; border-radius: 12px; overflow: hidden; background: var(--card); }
  .picon img { width: 100%; height: 100%; display: block; }
  .picon.blank { font-weight: 800; font-size: 22px; color: var(--soft); }
  .pbody { display: grid; gap: 4px; min-width: 0; }
  .pname { font-weight: 700; font-size: 16.5px; }
  .pname .ver { font: 500 12px 'JetBrains Mono', ui-monospace, monospace; color: var(--faint); margin-left: 6px; }
  .pdesc { color: var(--muted); font-size: 14.5px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .pmeta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 13px; color: var(--faint); margin-top: 2px; }
  .pmeta img { width: 18px; height: 18px; border-radius: 50%; vertical-align: -4px; margin-right: 5px; }
  .empty { margin-top: 24px; color: var(--muted); }
  .publish { margin-top: 64px; padding-top: 28px; border-top: 1px solid var(--line); max-width: 72ch; }
  .publish h2 { margin: 0 0 8px; font-size: 22px; letter-spacing: -0.02em; }
  .publish > p { margin: 0; color: var(--muted); }
  .publish .actions { margin-top: 18px; }
  .publish ol { margin: 24px 0 0; padding-left: 22px; color: var(--muted); }
  .publish li { margin-top: 14px; padding-left: 4px; }
  .publish li strong { color: var(--text); }
  .publish a { color: var(--soft); }
  .publish .btn { padding: 9px 16px; font-size: 14.5px; color: var(--text); }
  .publish .btn.primary { color: #fff; }
  .publish code { font: 500 13.5px 'JetBrains Mono', ui-monospace, monospace; color: var(--text); }
  .publish pre { margin: 10px 0 0; padding: 12px 14px; background: var(--raise); border: 1px solid var(--line); border-radius: 10px; overflow-x: auto; }
  .publish pre code { font-size: 13px; line-height: 1.7; color: var(--muted); }`

// Filters by search words and category, and sorts, without a reload
const GALLERY_SCRIPT = `(function () {
        var q = document.getElementById('q'), sort = document.getElementById('sort'), list = document.getElementById('list'), none = document.getElementById('none')
        if (!list) return
        var cards = Array.prototype.slice.call(list.children)
        var cat = ''
        var chips = Array.prototype.slice.call(document.querySelectorAll('#cats button'))
        chips.forEach(function (b) {
          b.addEventListener('click', function () {
            cat = b.getAttribute('data-cat')
            chips.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)) })
            apply()
          })
        })
        q.addEventListener('input', apply)
        sort.addEventListener('change', apply)
        function apply() {
          var words = q.value.toLowerCase().split(/\\s+/).filter(Boolean)
          var key = sort.value
          var shown = 0
          cards.forEach(function (c) {
            var ok = (!cat || c.getAttribute('data-cats').split(',').indexOf(cat) >= 0) && words.every(function (w) { return c.getAttribute('data-search').indexOf(w) >= 0 })
            c.hidden = !ok
            if (ok) shown++
          })
          cards.slice().sort(function (a, b) {
            if (key === 'installs') return Number(b.getAttribute('data-installs')) - Number(a.getAttribute('data-installs'))
            var x = a.getAttribute('data-' + key), y = b.getAttribute('data-' + key)
            return x < y ? 1 : x > y ? -1 : 0
          }).forEach(function (c) { list.appendChild(c) })
          none.hidden = shown > 0
        }
      })()`

function galleryCard(p) {
  const m = p.manifest || {}
  const search = [p.name, p.description, p.repoOwner, p.repoName, ...(m.keywords || []), ...(m.categories || []).map(c => CATEGORY_LABELS[c] || c)].join(' ').toLowerCase()
  return `<a class="pcard" href="/plugins/${esc(p.slug)}" data-search="${esc(search)}" data-cats="${esc((m.categories || []).join(','))}" data-installs="${Number(p.installs) || 0}" data-new="${esc(isoDate(p.listedAt))}" data-updated="${esc(isoDate(p.updatedAt))}">
          ${iconHtml(p, 52)}
          <span class="pbody">
            <span class="pname">${esc(p.name)}<span class="ver">${esc(p.version)}</span></span>
            <span class="pdesc">${esc(p.description)}</span>
            <span class="pmeta"><span><img src="${esc(avatarUrl(p.repoOwner))}" alt="" loading="lazy" />${esc(p.repoOwner)}</span><span>${installs(p.installs)}</span>${(m.categories || []).map(c => `<span>${esc(CATEGORY_LABELS[c] || c)}</span>`).join('')}</span>
          </span>
        </a>`
}

// /plugins: every listed plugin, to search, filter by category and sort
function galleryPage({ origin, plugins, analytics, index }) {
  const description = 'Slide elements made by people who use Parallax: plots, simulations and diagrams, each from a GitHub repo and reviewed before it’s listed.'
  const meta = pageMeta({ origin, path: '/plugins', title: 'Plugins · Parallax', description, index })
  const categories = [...new Set(plugins.flatMap(p => p.manifest?.categories || []))].sort((a, b) => Object.keys(CATEGORY_LABELS).indexOf(a) - Object.keys(CATEGORY_LABELS).indexOf(b))
  const list = plugins.length ? `
      <div class="toolbar" role="search">
        <input type="search" id="q" placeholder="Search plugins" aria-label="Search plugins" />
        <select id="sort" aria-label="Sort by">
          <option value="installs">Most installed</option>
          <option value="new">Newest</option>
          <option value="updated">Recently updated</option>
        </select>
      </div>
      ${categories.length > 1 ? `<div class="chips" id="cats" role="group" aria-label="Category">
        <button type="button" data-cat="" aria-pressed="true">All</button>
        ${categories.map(c => `<button type="button" data-cat="${esc(c)}" aria-pressed="false">${esc(CATEGORY_LABELS[c] || c)}</button>`).join('\n        ')}
      </div>` : ''}
      <div class="plugins" id="list">
        ${plugins.map(galleryCard).join('\n        ')}
      </div>
      <p class="empty" id="none" hidden>No plugins match.</p>` : `
      <p class="empty">No plugins are listed yet.</p>`
  return sitePage({
    meta, analytics, nav: NAV.filter(([href]) => href !== '/plugins'),
    styles: GALLERY_STYLES,
    main: `
      <div class="label">Plugins</div>
      <h1>Plugins for Parallax</h1>
      <p class="lead">${esc(description)}</p>
      ${list}
      <section class="publish" id="publish" aria-labelledby="publish-title">
        <h2 id="publish-title">Make your own plugin</h2>
        <p>A plugin is a public GitHub repo holding one web page, the element, and a manifest that describes it. The <a href="${TEMPLATE_URL}" rel="noopener" target="_blank">plugin template</a> is one to copy: it has a working example, a pendulum, with a build, tests and a check of the rules Parallax applies.</p>
        <div class="actions">
          <a class="btn primary" href="${TEMPLATE_URL}/generate" rel="noopener" target="_blank" data-umami-event="plugin-template" data-umami-event-how="template">Use the template</a>
          <a class="btn" href="${TEMPLATE_URL}/fork" rel="noopener" target="_blank" data-umami-event="plugin-template" data-umami-event-how="fork">Fork it</a>
        </div>
        <ol>
          <li><strong>Copy the template.</strong> Choose Use the template, sign in to GitHub if asked, and name the new repo after your plugin, such as <code>parallax-orbits</code>. On its first push, a GitHub Action names the plugin after the repo: its id becomes <code>io.github.&lt;you&gt;.orbits</code>, and its name Orbits. To fork it instead, choose Fork, then run <code>npm run setup</code> in your copy once, since a fork doesn’t run the Action. Using the template is simpler: your plugin gets a history of its own.</li>
          <li><strong>Make it yours.</strong> Clone your repo and replace the pendulum in <code>src/</code> with your own element. It needs Node 18 or later, and nothing else:
            <pre><code>git clone https://github.com/&lt;you&gt;/parallax-orbits
cd parallax-orbits
npm run build    # writes the plugin’s page into dist/
npm test         # the example’s tests, and dist/ matching src/
npm run check    # the rules Parallax applies on import</code></pre>
            To try the element outside Parallax, open <code>dist/sandbox.html</code> in a browser. The <a href="/#docs/tutorials/writing-plugins">Writing Plugins</a> guide covers the manifest, the page and what it can reach.</li>
          <li><strong>Tag a version.</strong> Set the same version in <code>parallax-plugin.json</code> and <code>package.json</code>, commit, and push a tag for it:
            <pre><code>git tag v0.1.0
git push origin v0.1.0</code></pre></li>
          <li><strong>Publish it.</strong> In the editor, open Plugins › Browse plugins… › Publish, paste your repo’s address and pick the tag. An admin reviews each version, and it’s listed here once approved. Later versions are found by themselves: Parallax looks for new version tags each night.</li>
        </ol>
      </section>`,
    script: plugins.length ? GALLERY_SCRIPT : '',
  })
}

// --- A plugin's page ---

const PLUGIN_STYLES = `
  .back { display: inline-block; margin-bottom: 18px; color: var(--muted); text-decoration: none; font-size: 14.5px; }
  .back:hover { color: var(--text); }
  .phead { display: flex; gap: 20px; align-items: flex-start; }
  .phead > div { min-width: 0; }
  .picon { display: grid; place-items: center; flex: none; border-radius: 16px; overflow: hidden; background: var(--card); }
  .picon img { width: 100%; height: 100%; display: block; }
  .picon.blank { font-weight: 800; font-size: 34px; color: var(--soft); }
  .byline { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; margin: 14px 0 0; color: var(--faint); font-size: 14.5px; }
  .byline img { width: 20px; height: 20px; border-radius: 50%; vertical-align: -5px; margin-right: 6px; }
  .byline a { color: var(--muted); }
  .stage.plugin { background: #14141f; }
  /* The page inside has the default color scheme; a frame whose scheme differs gets an opaque backdrop */
  .stage.plugin iframe { color-scheme: normal; }
  .cols { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 40px; margin-top: 48px; align-items: start; }
  @media (max-width: 820px) { .cols { grid-template-columns: minmax(0, 1fr); } .phead .picon { width: 56px !important; height: 56px !important; } }
  .facts h2 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--faint); font-weight: 600; }
  .facts dl { margin: 0 0 28px; display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; font-size: 14.5px; }
  .facts dt { color: var(--faint); }
  .facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
  .facts ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; font-size: 14.5px; }
  .facts .when { color: var(--faint); }
  .readme { min-width: 0; font-size: 15.5px; }
  .readme h1, .readme h2, .readme h3 { letter-spacing: -0.02em; line-height: 1.25; margin: 1.6em 0 0.5em; }
  .readme h1 { font-size: 26px; } .readme h2 { font-size: 21px; } .readme h3 { font-size: 17px; }
  .readme > :first-child { margin-top: 0; }
  .readme p, .readme ul, .readme ol, .readme table, .readme pre, .readme blockquote { margin: 0 0 1em; }
  .readme a { color: var(--soft); }
  .readme img { max-width: 100%; height: auto; border-radius: 8px; }
  .readme code { font: 500 0.88em 'JetBrains Mono', ui-monospace, monospace; background: var(--raise); border: 1px solid var(--line); border-radius: 5px; padding: 1px 5px; }
  .readme pre { background: var(--raise); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; overflow-x: auto; }
  .readme pre code { background: none; border: 0; padding: 0; }
  .readme table { border-collapse: collapse; display: block; overflow-x: auto; }
  .readme th, .readme td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; vertical-align: top; }
  .readme blockquote { border-left: 3px solid var(--line); padding-left: 14px; color: var(--muted); }
  .readme .noimg { color: var(--faint); }`

// /plugins/<slug>: a listed plugin, live, with its README and its facts
async function pluginPage({ origin, plugin: p, analytics, index }) {
  const m = p.manifest || {}
  const types = m.contributes?.elementTypes || []
  const size = types[0]?.defaultSize || { width: 640, height: 420 }
  const hosts = (m.permissions || []).filter(x => x.startsWith('network:')).map(x => x.slice('network:'.length))
  const newest = p.versions.find(v => v.version === p.version) || p.versions[0]
  const readme = p.readme && newest ? await renderReadme(p.readme, { owner: p.repoOwner, repo: p.repoName, commit: newest.commitSha }) : ''
  const meta = pageMeta({ origin, path: `/plugins/${p.slug}`, title: `${p.name} · Parallax plugins`, description: p.description, image: SOCIAL_IMAGE, index })
  const facts = [
    ['Version', esc(p.version)],
    ['Updated', esc(formatDate(newest?.approvedAt || p.updatedAt))],
    ['Listed', esc(formatDate(p.listedAt))],
    ['Installs', count(p.installs)],
    ['License', esc(m.license || '')],
    ['Elements', types.map(t => esc(t.label || t.type)).join(', ')],
    ['Reaches', hosts.length ? hosts.map(esc).join(', ') : 'No other sites'],
    ['Source', `<a href="${esc(repoUrl(p))}" rel="noopener" target="_blank">github.com/${esc(p.repoOwner)}/${esc(p.repoName)}</a>`],
    ...(m.homepage && m.homepage.replace(/\/+$/, '').toLowerCase() !== repoUrl(p).toLowerCase() ? [['Homepage', `<a href="${esc(m.homepage)}" rel="nofollow noopener" target="_blank">${esc(m.homepage.replace(/^https:\/\//, ''))}</a>`]] : []),
  ]
  return sitePage({
    meta, analytics, nav: NAV,
    styles: PLUGIN_STYLES,
    main: `
      <a class="back" href="/plugins">← All plugins</a>
      <div class="phead">
        ${iconHtml(p, 84)}
        <div>
          ${(m.categories || []).length ? `<div class="label">${m.categories.map(c => esc(CATEGORY_LABELS[c] || c)).join(' · ')}</div>` : ''}
          <h1>${esc(p.name)}</h1>
          <p class="lead">${esc(p.description)}</p>
          <p class="byline"><span><img src="${esc(avatarUrl(p.repoOwner))}" alt="" /><a href="https://github.com/${esc(encodeURIComponent(p.repoOwner))}" rel="noopener" target="_blank">${esc(p.repoOwner)}</a></span><span>Version ${esc(p.version)}</span><span>${installs(p.installs)}</span></p>
        </div>
      </div>
      <div class="actions">
        <a class="btn primary" href="/plugins/${esc(p.slug)}/install" data-umami-event="plugin-install" data-umami-event-plugin="${esc(p.slug)}">Install in Parallax</a>
        <span class="small">Its element is then in the editor’s Plugins menu.</span>
      </div>
      <div class="stage plugin"><div class="slide" id="slide" style="aspect-ratio: ${Number(size.width)} / ${Number(size.height)}"><iframe src="/plugins/${esc(p.slug)}/preview" sandbox="allow-scripts" title="${esc(p.name)}, live" style="width: ${Number(size.width)}px; height: ${Number(size.height)}px"></iframe></div></div>
      <p class="hint">Live, with the settings a new element starts with.</p>
      <div class="cols">
        <article class="readme">${readme || '<p class="hint">This plugin has no README.</p>'}</article>
        <aside class="facts">
          <h2>Details</h2>
          <dl>${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
          <h2>Versions</h2>
          <ul>${p.versions.map(v => `<li><a href="${esc(repoUrl(p))}/tree/${esc(v.commitSha)}" rel="noopener" target="_blank">${esc(v.tag)}</a> <span class="when">${esc(formatDate(v.approvedAt))}</span></li>`).join('')}</ul>
        </aside>
      </div>`,
    script: fitScript(Number(size.width)),
  })
}

module.exports = { galleryPage, pluginPage, renderReadme, iconUrl, CATEGORY_LABELS }

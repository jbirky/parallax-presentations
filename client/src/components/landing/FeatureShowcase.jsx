// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The landing page's showcase of what sets Parallax apart: a list of
// features beside one panel at a time, each a claim and something that shows
// it. Live data, citations and code play live decks (the exoplanet example
// and the showcase decks, client/src/examples/decks.js); only the panel
// showing has its deck. The hero's chips open a panel here (LandingPage).

import { track } from '../../utils/analytics'
import SlideFrame from './SlideFrame'

export const FEATURES = [
  { key: 'data', name: 'Live data', short: 'Charts that refresh from the source' },
  { key: 'cite', name: 'BibTeX citations', short: 'Numbered for you, references slide built' },
  { key: 'code', name: 'Your own code', short: 'HTML, JavaScript and p5.js on a slide' },
  { key: 'plugins', name: 'Plugins', short: 'Build an element once, use it everywhere' },
  { key: 'git', name: 'GitHub', short: 'Version history and Pages hosting' },
  { key: 'ai', name: 'AI collaborators', short: 'Claude or ChatGPT edits beside you', isNew: true },
]

const EXOPLANET_QUERY = `select pl_name, pl_orbper, pl_bmasse,
       discoverymethod, disc_year
from   pscomppars
where  pl_orbper is not null
  and  pl_bmasse is not null`

const BIB_ENTRY = `@article{rubin1970,
  author  = {Rubin, Vera C. and
             Ford, W. Kent, Jr.},
  title   = {Rotation of the Andromeda Nebula
             from a Spectroscopic Survey
             of Emission Regions},
  journal = {ApJ},
  year    = {1970}, volume = {159},
  pages   = {379}
}`

// The showcase deck's script (decks.js DIFFUSION_SKETCH), as its panel shows it
export const SKETCH = `// 3000 random walkers from one point: where
// they are after 50, 400 and 2000 steps
const ctx = c.getContext('2d'), N = 3000
const x = new Float32Array(N), y = new Float32Array(N)
const snaps = { 50: '#7dd3fc', 400: '#a78bfa', 2000: '#fb923c' }
for (let t = 1; t <= 2000; t++) {
  for (let i = 0; i < N; i++) {
    x[i] += Math.random() - 0.5
    y[i] += Math.random() - 0.5
  }
  if (!snaps[t]) continue
  ctx.fillStyle = ctx.strokeStyle = snaps[t]
  for (let i = 0; i < N; i++)
    ctx.fillRect(480 + 9 * x[i], 290 + 9 * y[i], 2, 2)
  ctx.beginPath()
  ctx.arc(480, 290, 9 * Math.sqrt(t / 6), 0, 2 * Math.PI)
  ctx.stroke()
}`

const MANIFEST = `{
  "id": "io.github.you.orbits",
  "name": "Orbits",
  "version": "1.0.0",
  "sandbox": "./sandbox.html",
  "permissions": [],
  "contributes": {
    "elementTypes": [{
      "type": "kepler-orbits",
      "label": "Kepler orbits",
      "defaultData": { "eccentricity": 0.5 }
    }]
  }
}`

function Deck({ slug, title, caption }) {
  return (
    <figure className="lp-proof-deck">
      <div className="lp-frame"><SlideFrame src={`/examples/${slug}/deck`} title={title} /></div>
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

function Code({ name, kind, children }) {
  return (
    <div className="lp-code">
      <div className="lp-code-name"><span>{name}</span><span>{kind}</span></div>
      <pre>{children}</pre>
    </div>
  )
}

function Facts({ rows }) {
  return <dl className="lp-facts-list">{rows.map(([k, v, live]) => <div key={k}><dt>{k}</dt><dd className={live ? 'live' : undefined}>{v}</dd></div>)}</dl>
}

function Links({ links }) {
  return (
    <div className="lp-panel-links">
      {links.map(([text, href, quiet]) => quiet
        ? <span key={text}>{text}</span>
        : <a key={text} href={href} onClick={() => track('feature-link', { href })}>{text} →</a>)}
    </div>
  )
}

function Panel({ feature, guestEnabled }) {
  switch (feature) {
    case 'data': return (<>
      <h3>Charts that keep up with the archive</h3>
      <p className="lp-lede">Link a dataset to a TAP query, a CSV or JSON file on the web, or an upload. Parallax fetches it on a schedule and keeps a version each time it changes. Every graph that plots it updates, and the slide says how fresh its data is.</p>
      <div className="lp-proof">
        <div className="lp-proof-side">
          <Code name="Dataset: exoplanets" kind="TAP">{EXOPLANET_QUERY}</Code>
          <Facts rows={[['Source', 'NASA Exoplanet Archive'], ['Refresh', 'Daily'], ['Shown', 'The data as of the day you open it', true]]} />
        </div>
        <Deck slug="exoplanets" title="Exoplanets by orbital period and mass, a live Parallax deck" caption="Live: the date at the bottom is today's data" />
      </div>
      <Links links={[['Live datasets', '#docs/tutorials/live-datasets'], ['This deck’s own page', '/examples/exoplanets']]} />
    </>)
    case 'cite': return (<>
      <h3>Cite from your .bib file. The numbers take care of themselves.</h3>
      <p className="lp-lede">Import a .bib file or your Zotero library, and cite from the editor. Parallax numbers citations in the order you present them and builds the references slide. Move a slide and the numbers follow; import the same paper twice and it’s listed once.</p>
      <div className="lp-proof">
        <div className="lp-proof-side"><Code name="references.bib" kind="Import BibTeX">{BIB_ENTRY}</Code></div>
        <Deck slug="showcase-cite" title="Citations numbered on a slide, a live Parallax deck" caption="Live: click the slide, then press → for the references" />
      </div>
      <Links links={[['Citations and bibliography', '#docs/tutorials/citations'], ...(guestEnabled ? [['Open it in the editor', '/try?example=showcase-cite']] : [])]} />
    </>)
    case 'code': return (<>
      <h3>If you can code it, it can go on a slide</h3>
      <p className="lp-lede">Paste HTML, JavaScript or a p5.js sketch onto a slide and it runs there, in the editor and when you present, kept apart from the rest of the page. Your code can read the deck’s datasets with <code>parallax.datasets.query()</code>.</p>
      <div className="lp-proof">
        <div className="lp-proof-side"><Code name="HTML element: its script" kind="JavaScript">{SKETCH}</Code></div>
        <Deck slug="showcase-code" title="A diffusion sketch running on a slide, a live Parallax deck" caption="Live: the walkers are new each time it loads" />
      </div>
      <Links links={[['HTML embeds and p5.js', '#docs/tutorials/html-embeds'], ...(guestEnabled ? [['Open it in the editor', '/try?example=showcase-code']] : [])]} />
    </>)
    case 'plugins': return (<>
      <h3>Package an element once, and use it in every talk</h3>
      <p className="lp-lede">A plugin is a GitHub repository with a manifest and a sandboxed page. Start from the template, which checks your plugin against Parallax’s rules, tag a release, and submit it. Once it’s reviewed, it’s in the plugin gallery for everyone.</p>
      <div className="lp-proof">
        <div className="lp-proof-side"><Code name="parallax-plugin.json" kind="Manifest">{MANIFEST}</Code></div>
        <div className="lp-proof-side">
          <div className="lp-plugin">
            <div aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><ellipse cx="12" cy="12" rx="10" ry="4.5" /></svg></div>
            <div><h4>Exoplanet plot</h4><p>Every known exoplanet by orbital period and mass, from the NASA Exoplanet Archive, with the Solar System marked.</p><small>jbirky/parallax-exoplanets · v1.0.0</small></div>
          </div>
          <div className="lp-plugin">
            <div aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v7" /><circle cx="12" cy="15" r="4" /><path d="M5 3h14" /></svg></div>
            <div><h4>Plugin template</h4><p>A working pendulum element to start from. <code>npm run check</code> runs Parallax’s rules before you submit.</p><small>jbirky/parallax-plugin-template · GitHub template</small></div>
          </div>
          <Facts rows={[['1. Template', 'Use the template on GitHub'], ['2. Release', 'Tag a version, such as v1.0.0'], ['3. Submit', 'Reviewed, then in the gallery']]} />
        </div>
      </div>
      <Links links={[['Browse the plugin gallery', '/plugins'], ['Writing a plugin', '#docs/tutorials/writing-plugins']]} />
    </>)
    case 'git': return (<>
      <h3>Keep every version of your talk on GitHub</h3>
      <p className="lp-lede">Push a presentation to a GitHub repository. Each push is a commit with a self-contained <code>presentation.html</code>, the <code>presentation.json</code> you can import again, and its figures. Turn on GitHub Pages and every talk has an address that opens in any browser.</p>
      <div className="lp-proof">
        <div className="lp-repo" aria-label="What a repository holds after two pushes">
          <div className="lp-repo-bar"><span>you/talks</span><span>What a push makes</span></div>
          <ul>
            <li>README.md<span>An index of your talks, kept up to date</span></li>
            <li>dark-matter-seminar/<span>Add the rotation curve slide</span></li>
            <li className="in">presentation.html<span>Opens in any browser</span></li>
            <li className="in">presentation.json<span>Import it into Parallax</span></li>
            <li className="in">assets/<span>Figures and media</span></li>
            <li>rc-filters-lecture/<span>First version</span></li>
          </ul>
        </div>
        <div className="lp-proof-side">
          <Facts rows={[['Push', 'Sync › GitHub…, a commit message, Push'], ['History', 'Every push is a commit you can go back to'], ['Host', 'you.github.io/talks/dark-matter-seminar/presentation.html']]} />
        </div>
      </div>
      <Links links={[['Export and GitHub', '#docs/features/export']]} />
    </>)
    case 'ai': return (<>
      <h3>Bring Claude or ChatGPT into the deck</h3>
      <p className="lp-lede">Make a link for one presentation and add it to your AI chat app. The AI reads the slides, adds and changes them while you watch, and appears in the editor beside the people working on it. It can look at its slides to check them, and a version is saved before each session, so undoing a session takes one click.</p>
      <div className="lp-proof">
        <div className="lp-chat" aria-label="A conversation in an AI chat app">
          <div className="you">Add a slide after slide 3 comparing slides before and after, in two columns.</div>
          <div className="bot">Added slide 4, “Before and after”, in the two-column layout. I looked at it, and both columns fit.<small>add_slide · render_slide</small></div>
          <div className="you">Now tighten the right column.</div>
        </div>
        <div className="lp-mock-editor">
          <div className="lp-mock-top"><span>Editor · slide 4</span><span className="lp-avatars"><i className="me">JB</i><i className="ai" title="Claude (AI)">AI</i></span></div>
          <div className="lp-mock-canvas">
            <img src="/landing/ai-slide.jpg" alt="A two-column slide titled Before and after, made by the AI" loading="lazy" />
            <div className="lp-mock-held"><span>Claude (AI)</span></div>
          </div>
        </div>
      </div>
      <Links links={[['AI collaborator links', '#docs/tutorials/ai-collaborators'], ['Works with Claude, ChatGPT and other apps that connect to MCP servers', null, true]]} />
    </>)
    default: return null
  }
}

export default function FeatureShowcase({ feature, onFeature, guestEnabled }) {
  const keyNav = (e, i) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]
    let to = null
    if (step) to = (i + step + FEATURES.length) % FEATURES.length
    if (e.key === 'Home') to = 0
    if (e.key === 'End') to = FEATURES.length - 1
    if (to === null) return
    e.preventDefault()
    onFeature(FEATURES[to].key)
    e.currentTarget.parentElement.children[to]?.focus()
  }
  const current = FEATURES.find(f => f.key === feature) || FEATURES[0]
  return (
    <div className="lp-show">
      <div className="lp-show-tabs" role="tablist" aria-label="Features" aria-orientation="vertical">
        {FEATURES.map((f, i) => (
          <button key={f.key} type="button" role="tab" id={`lp-tab-${f.key}`} aria-controls="lp-feature-panel" aria-selected={f.key === current.key}
            tabIndex={f.key === current.key ? 0 : -1} onKeyDown={e => keyNav(e, i)}
            onClick={() => { track('feature', { feature: f.key }); onFeature(f.key) }}>
            <b>{f.name}{f.isNew && <span className="lp-new">New</span>}</b>
            <small>{f.short}</small>
          </button>
        ))}
      </div>
      <article className="lp-feature" role="tabpanel" id="lp-feature-panel" aria-labelledby={`lp-tab-${current.key}`} key={current.key}>
        <div className="lp-label">{current.name}</div>
        <Panel feature={current.key} guestEnabled={guestEnabled} />
      </article>
    </div>
  )
}

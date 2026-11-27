// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The landing page, for visitors who aren't signed in: what Parallax is, a
// live deck, what sets it apart (components/landing/FeatureShowcase.jsx), the
// example decks by field (as /admin arranges them, served at
// /examples/<slug>; the built-in ones in client/src/examples if the list
// can't be had), how it compares with the tools people use, how a talk comes
// together with Practice Talk to try (PracticeDemo.jsx), the elements by
// subject, the plans, and a last way in. Ink and paper bands, the mark's red
// and blue as offset shadows (index.css, Landing Page). It's dark unless
// light is chosen, with the nav's toggle or the dashboard's (theme,
// onToggleTheme; utils/theme.js). The docs
// open in place of it, at #docs, and the
// templates at #templates: each opens its own page (/templates/<slug>, which
// the server builds, server/services/site-pages.js), where people copy it
// into their account (/templates/<slug>/use, TemplateUsePage.jsx). What
// visitors open and click is counted (utils/analytics.js) where the server
// has analytics set up.

import { useState, useEffect, useRef } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Moon, Sun, X } from 'lucide-react'
import DocsPage from '../components/DocsPage'
import BetaBadge from '../components/BetaBadge'
import Mark from '../components/ParallaxMark'
import SlideFrame from '../components/landing/SlideFrame'
import FeatureShowcase, { FEATURES } from '../components/landing/FeatureShowcase'
import PracticeDemo from '../components/landing/PracticeDemo'
import { api } from '../utils/api'
import { startAnalytics, track } from '../utils/analytics'
import { EXAMPLES as BUILT_IN, EXAMPLE_FIELDS, HERO_EXAMPLE } from '../examples/catalog'

const GITHUB = 'https://github.com/jbirky/parallax-presentations'
const SUPPORT = 'support@parallax-presentations.com'

// From the first plan to the DOI, in order
const STEPS = [
  { title: 'Plan', text: 'Outline each slide with notes and the minutes it gets. The notes stay in the outline and never change a slide.', tool: 'Outline' },
  { title: 'Build', text: 'Lay out text, figures and live elements in a visual editor. Math is LaTeX; references come from your citations.', tool: 'Editor' },
  { title: 'Rehearse', text: 'Practice Talk times every slide against your plan and shows where you run long.', tool: 'Practice Talk' },
  { title: 'Present', text: 'Speaker notes, drawing on slides, and a live link your audience can follow on their own screens.', tool: 'Presenter view' },
  { title: 'Share', text: 'Send a link, export PDF or PowerPoint, or push to GitHub and host it on GitHub Pages.', tool: 'Share and publish' },
]

// Parallax beside the tools researchers already use: [feature, PowerPoint
// and Google Slides, Beamer, reveal.js, Parallax], each cell [mark, words]
// with mark y (yes), p (partly) or n (no)
const COMPARISON = [
  ['Visual editor', ['y', 'Yes'], ['n', 'No, you write source'], ['n', 'No, you write source'], ['y', 'Yes']],
  ['LaTeX math', ['p', 'Partly, in PowerPoint’s equation editor'], ['y', 'Yes'], ['y', 'Yes, with its math plugin'], ['y', 'Yes']],
  ['Citations from BibTeX', ['n', 'No'], ['y', 'Yes'], ['n', 'Not built in'], ['y', 'Yes, and from Zotero']],
  ['Charts that refresh from a data source', ['p', 'Partly, from linked spreadsheets'], ['n', 'No, fixed when compiled'], ['p', 'If you code it'], ['y', 'Yes, on a schedule']],
  ['Interactive graphs and diagrams', ['n', 'No'], ['n', 'No'], ['p', 'If you code it'], ['y', 'Built in']],
  ['Your own HTML and JavaScript', ['n', 'No'], ['n', 'No'], ['y', 'Yes'], ['y', 'Yes']],
  ['Git history', ['n', 'No'], ['p', 'Git, by hand'], ['p', 'Git, by hand'], ['y', 'Push to GitHub']],
  ['Export to PowerPoint', ['y', 'Yes'], ['n', 'No'], ['n', 'No'], ['y', 'Yes']],
  ['Open source, runs on your server', ['n', 'No'], ['y', 'Yes'], ['y', 'Yes'], ['y', 'Yes']],
]
const COMPARED = ['PowerPoint, Google Slides', 'LaTeX Beamer', 'reveal.js', 'Parallax']

// The home tab's sections an address can name, as in /#examples
const HOME_SECTIONS = ['top', 'features', 'examples', 'compare', 'workflow', 'practice', 'start']

// The built-in examples, as the server lists them
const BUILT_IN_LIST = { hero: HERO_EXAMPLE, examples: BUILT_IN.map(e => ({ ...e, thumbnail: `/examples/thumbs/${e.slug}.jpg` })), templates: [] }
// The filters: the usual fields first, then any others the examples have
const fieldsOf = examples => {
  const have = new Set(examples.map(e => e.field).filter(Boolean))
  return [...EXAMPLE_FIELDS.filter(f => have.has(f)), ...[...have].filter(f => !EXAMPLE_FIELDS.includes(f))]
}
const placeholderBg = bg => (bg?.type === 'color' && bg.color) || (bg?.type === 'gradient' && bg.gradient) || '#1e1e2e'

// The plans and what they cost (the pricing plan; their limits are the
// plans table's, server/services/plans.js, which /admin edits, so change
// both together). An item marked `soon` isn't built yet and says so. Pro is
// the lead card, in ink.
const PLANS = [
  {
    id: 'free', name: 'Free', price: '$0', note: 'For trying it, and for good', cta: 'Start free',
    items: [['5 editable presentations; older ones read-only'], ['250 MB of storage'], ['1 live dataset, updated daily'], ['Public links with a small badge', 'soon']],
  },
  {
    id: 'pro', name: 'Pro', price: '$10', lead: true, cta: 'Go Pro',
    note: 'a month, or $8 billed yearly. Students and educators: $5, or $4 yearly',
    items: [['Unlimited presentations'], ['10 GB of storage'], ['25 live datasets, updated hourly'], ['No badge, password links, view counts', 'soon']],
  },
  {
    id: 'team', name: 'Team', price: '$12', note: 'a seat a month, 3 seats or more, less yearly', cta: 'Set up a team',
    items: [['Shared folders and roles'], ['25 GB a seat, pooled'], ['100 live datasets, shared'], ['Team themes, fonts, data and templates']],
  },
  {
    id: 'institution', name: 'Institution', price: 'Custom', note: 'An annual department or campus license', cta: 'Talk to us',
    href: `mailto:${SUPPORT}?subject=${encodeURIComponent('Parallax for an institution')}`,
    items: [['Single sign-on, domain capture', 'soon'], ['Audit log', 'soon'], ['Invoices and purchase orders'], ['Custom storage and data'], ['Support agreement']],
  },
]

// Words whose red and blue copies sit at two depths behind the ink, so they
// shift against the pointer the way far things do as you move your head:
// the red, farthest back, most, the blue less, the ink not at all. They ease
// toward the pointer and back to rest when it leaves the window. Still for
// anyone who asks for less motion, and on touch screens.
export function ParallaxWords({ children }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const clamp = v => Math.max(-1, Math.min(1, v))
    let target = { x: 0, y: 0 }
    const at = { x: 0, y: 0 }
    let frame = 0
    const step = () => {
      at.x += (target.x - at.x) * 0.12
      at.y += (target.y - at.y) * 0.12
      el.style.setProperty('--px', at.x.toFixed(3))
      el.style.setProperty('--py', at.y.toFixed(3))
      frame = Math.abs(target.x - at.x) + Math.abs(target.y - at.y) > 0.002 ? requestAnimationFrame(step) : 0
    }
    const go = () => { if (!frame) frame = requestAnimationFrame(step) }
    const move = e => {
      if (e.pointerType === 'touch') return
      const r = el.getBoundingClientRect()
      target = {
        x: clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)),
        y: clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)),
      }
      go()
    }
    const rest = () => { target = { x: 0, y: 0 }; go() }
    const page = document.documentElement
    window.addEventListener('pointermove', move, { passive: true })
    page.addEventListener('mouseleave', rest)
    window.addEventListener('blur', rest)
    return () => {
      window.removeEventListener('pointermove', move)
      page.removeEventListener('mouseleave', rest)
      window.removeEventListener('blur', rest)
      cancelAnimationFrame(frame)
    }
  }, [])
  return <em ref={ref} className="lp-parallax">{children}</em>
}

// An example, live, with what it shows and a way into the editor
function ExampleViewer({ examples, at, onMove, onClose, guestEnabled, onSignIn }) {
  const ref = useRef(null)
  const example = at === null ? null : examples[at]
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (example && !dialog.open) dialog.showModal?.()
    if (!example && dialog.open) dialog.close?.()
  }, [example])
  // Closed by Escape, as well as by its buttons
  useEffect(() => {
    const dialog = ref.current
    dialog?.addEventListener('close', onClose)
    return () => dialog?.removeEventListener('close', onClose)
  }, [onClose])
  return (
    <dialog className="lp-viewer" ref={ref} aria-labelledby="lp-viewer-title"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {example && (<>
        <div className="lp-viewer-head">
          <div className="lp-viewer-name">
            <div className="lp-label">{example.field}</div>
            <h3 id="lp-viewer-title">{example.title}</h3>
          </div>
          <div className="lp-viewer-nav">
            <button type="button" className="lp-icon" aria-label="Previous example" onClick={() => onMove(-1)}><ChevronLeft size={18} /></button>
            <button type="button" className="lp-icon" aria-label="Next example" onClick={() => onMove(1)}><ChevronRight size={18} /></button>
            <button type="button" className="lp-icon" aria-label="Close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="lp-viewer-body">
          <div className="lp-viewer-deck"><SlideFrame key={example.slug} src={`/examples/${example.slug}/deck`} title={`${example.title}, a live Parallax deck`} /></div>
          <div className="lp-viewer-side">
            <p className="lp-viewer-desc">{example.desc}</p>
            {example.tags.length > 0 && (
              <div>
                <div className="lp-label">Made with</div>
                <div className="lp-tags">{example.tags.map(t => <span key={t}>{t}</span>)}</div>
              </div>
            )}
            <p className="lp-keys">Click the slide, then press <kbd>→</kbd> to step through it and <kbd>←</kbd> to go back.</p>
            <a className="lp-quiet" href={`/examples/${example.slug}`}>This example’s own page, to share</a>
            {guestEnabled ? (<>
              <a className="lp-btn primary" href={`/try?example=${example.slug}`} onClick={() => track('example-to-editor', { example: example.slug })}>Open in the editor</a>
              <p className="lp-small">Opens a copy you can change, with no account. It lasts until you close the tab.</p>
            </>) : (
              <button type="button" className="lp-btn primary" onClick={() => { track('sign-in', { from: 'example' }); onSignIn() }}>Sign in to make your own</button>
            )}
          </div>
        </div>
      </>)}
    </dialog>
  )
}

export default function LandingPage({ onSignIn, theme = 'dark', onToggleTheme }) {
  const [tab, setTab] = useState('home')
  const [docsPage, setDocsPage] = useState(null)
  const [guestEnabled, setGuestEnabled] = useState(false)
  const [field, setField] = useState('All')
  const [viewing, setViewing] = useState(null)
  const [templateField, setTemplateField] = useState('All')
  const [scrollTo, setScrollTo] = useState(null)
  const [copied, setCopied] = useState(false)
  const [catalog, setCatalog] = useState(null)
  const [feature, setFeature] = useState(FEATURES[0].key)

  useEffect(() => {
    startAnalytics()
    api.getGuestConfig().then(config => setGuestEnabled(!!config.enabled)).catch(() => {})
    api.getLandingExamples().then(list => setCatalog(list || BUILT_IN_LIST)).catch(() => setCatalog(BUILT_IN_LIST))
  }, [])

  useEffect(() => {
    const read = () => {
      const h = window.location.hash
      if (h.startsWith('#docs')) {
        setTab('docs')
        const p = h.replace('#docs/', '').replace('#docs', '')
        if (p && p.includes('/')) setDocsPage(p)
      } else if (h === '#templates') {
        setTab('templates')
      } else {
        setTab('home')
        // A section named in the address (the site's own pages link to them,
        // services/site-pages.js), once the examples above it are in
        if (HOME_SECTIONS.includes(h.slice(1))) setScrollTo({ id: h.slice(1), afterCatalog: true })
      }
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  const switchTab = (t) => {
    setTab(t)
    window.location.hash = t === 'home' ? '' : t
  }
  // A section of the home tab, from the docs too
  const goTo = id => {
    if (tab !== 'home') switchTab('home')
    setScrollTo({ id })
  }
  useEffect(() => {
    if (!scrollTo || tab !== 'home' || (scrollTo.afterCatalog && !catalog)) return
    document.getElementById(scrollTo.id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [scrollTo, tab, catalog])

  const examples = catalog?.examples || []
  const shown = field === 'All' ? examples : examples.filter(e => e.field === field)
  const templates = catalog?.templates || []
  const templatesShown = templateField === 'All' ? templates : templates.filter(e => e.field === templateField)
  const tryIt = from => guestEnabled
    ? <a className="lp-btn primary" href="/try" onClick={() => track('try', { from })}>Try it, no account needed <ArrowRight size={16} /></a>
    : <button type="button" className="lp-btn primary" onClick={() => { track('sign-in', { from }); onSignIn() }}>Get started free <ArrowRight size={16} /></button>

  const copySupport = async () => {
    track('support', { how: 'copy' })
    try { await navigator.clipboard.writeText(SUPPORT); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* the address is shown to select */ }
  }

  return (
    <div className="landing-page">
      <nav className="lp-nav" aria-label="Main">
        <div className="lp-wrap lp-nav-row">
          <button type="button" className="lp-logo" aria-label="Parallax" onClick={() => goTo('top')}><Mark id="nav" size={32} /><span className="lp-word">Parallax</span><BetaBadge /></button>
          <div className="lp-links">
            <button type="button" className="lp-wide" onClick={() => goTo('features')}>Features</button>
            {/* On a phone, Templates takes its place; the hero's See the examples leads there */}
            <button type="button" className={templates.length > 0 ? 'lp-mid' : undefined} onClick={() => goTo('examples')}>Examples</button>
            {(templates.length > 0 || tab === 'templates') && (
              <button type="button" className={tab === 'templates' ? 'on' : ''} aria-current={tab === 'templates' ? 'page' : undefined} onClick={() => { track('templates', { from: 'nav' }); switchTab('templates') }}>Templates</button>
            )}
            <a className="lp-wide" href="/plugins" onClick={() => track('plugins', { from: 'nav' })}>Plugins</a>
            <button type="button" className="lp-wide" onClick={() => goTo('workflow')}>How it works</button>
            <button type="button" className={tab === 'docs' ? 'on' : ''} aria-current={tab === 'docs' ? 'page' : undefined} onClick={() => { track('docs', { from: 'nav' }); switchTab('docs') }}>Docs</button>
            <a className="lp-wide" href={GITHUB} target="_blank" rel="noopener noreferrer" onClick={() => track('github', { from: 'nav' })}>GitHub</a>
            {onToggleTheme && (
              <button type="button" className="lp-theme" aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                onClick={() => { track('theme', { to: theme === 'light' ? 'dark' : 'light' }); onToggleTheme() }}>
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              </button>
            )}
            <button type="button" className="lp-signin" onClick={() => { track('sign-in', { from: 'nav' }); onSignIn() }}>Sign in</button>
          </div>
        </div>
      </nav>

      <div className="landing-scroll">
        {tab === 'docs' ? (
          <DocsPage initialPage={docsPage} />
        ) : tab === 'templates' ? (
          <section className="lp-band lp-light alt lp-templates" id="templates" aria-labelledby="lp-templates">
            <div className="lp-wrap">
              <div className="lp-head">
                <h2 id="lp-templates">Templates</h2>
                <p>Decks set up to start from. Use one, and a copy opens in your account, yours to change.</p>
              </div>
              {templates.length === 0 ? (
                <p className="lp-empty">{catalog ? 'No templates yet. In the meantime, the examples show what Parallax can do.' : 'Loading the templates…'}</p>
              ) : (<>
                {fieldsOf(templates).length > 1 && (
                  <div className="lp-filters" role="group" aria-label="Show templates for">
                    {['All', ...fieldsOf(templates)].map(f => (
                      <button key={f} type="button" aria-pressed={templateField === f} onClick={() => { track('template-filter', { field: f }); setTemplateField(f) }}>
                        {f}<span>{f === 'All' ? templates.length : templates.filter(e => e.field === f).length}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="lp-grid">
                  {templatesShown.map(e => (
                    <a key={e.slug} className="lp-card" href={`/templates/${e.slug}`} aria-label={`${e.title}${e.field ? `, ${e.field}` : ''}${e.theme ? `, in the ${e.theme} theme` : ''}: open the template`}
                      onClick={() => track('open-template', { template: e.slug, from: 'card' })}>
                      <div className="lp-thumb" style={e.thumbnail ? undefined : { background: placeholderBg(e.background) }}>
                        {e.thumbnail ? <img loading="lazy" alt="" src={e.thumbnail} /> : <strong className="lp-thumb-title">{e.title}</strong>}
                        <span>{e.theme || 'Preview'}</span>
                      </div>
                      <div className="lp-card-body">
                        {e.field && <div className="lp-label">{e.field}</div>}
                        <h3>{e.title}</h3>
                        <p>{e.desc}</p>
                        <div className="lp-tags">{e.tags.map(t => <span key={t}>{t}</span>)}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </>)}
            </div>
          </section>
        ) : (<>
          <header className="lp-hero lp-wrap" id="top">
            <div className="lp-eyebrow">Slides for research talks, lectures and seminars</div>
            <h1>Create interactive<br />and intuitive slides&nbsp;for<br /><ParallaxWords>complex concepts.</ParallaxWords></h1>
            <div className="lp-ctas">
              {tryIt('hero')}
              <button type="button" className="lp-btn ghost" onClick={() => { track('see-examples'); goTo('examples') }}>See the examples</button>
            </div>
            <div className="lp-chips" role="group" aria-label="What sets Parallax apart">
              {FEATURES.map(f => (
                <button key={f.key} type="button" onClick={() => { track('feature', { feature: f.key, from: 'hero' }); setFeature(f.key); goTo('features') }}>
                  {f.name}{f.isNew && <span className="lp-new">New</span>}
                </button>
              ))}
            </div>
            <div className="lp-facts"><span>Free to start</span><span>Open source, AGPL-3.0</span><span>Export to HTML, PDF and PowerPoint</span></div>
            <div className="lp-stage">
              <div className="lp-frame">
                {catalog?.hero ? <SlideFrame src={`/examples/${catalog.hero}/deck`} title="A live Parallax deck" /> : <div className="lp-slide" />}
              </div>
              <div className="lp-hint"><i aria-hidden="true" />Live deck: drag a slider, then click and press →</div>
            </div>
          </header>

          <section className="lp-band lp-light" id="features" aria-labelledby="lp-features">
            <div className="lp-wrap">
              <div className="lp-head lp-head-line">
                <div className="lp-label">What sets it apart</div>
                <h2 id="lp-features">Slides that work like <em>your research</em></h2>
                <p>Your data, your references and your code are part of the talk, not pasted into it. Each of these is in Parallax today.</p>
              </div>
              <FeatureShowcase feature={feature} onFeature={setFeature} guestEnabled={guestEnabled} />
            </div>
          </section>

          <section className="lp-band lp-light alt" id="examples" aria-labelledby="lp-examples">
            <div className="lp-wrap">
              <div className="lp-head">
                <h2 id="lp-examples">Examples</h2>
                <p>Each one is a real Parallax deck. Open it, step through it with the arrow keys, and drag whatever moves.</p>
              </div>
              <div className="lp-filters" role="group" aria-label="Show examples from">
                {['All', ...fieldsOf(examples)].map(f => (
                  <button key={f} type="button" aria-pressed={field === f} onClick={() => { track('filter', { field: f }); setField(f) }}>
                    {f}<span>{f === 'All' ? examples.length : examples.filter(e => e.field === f).length}</span>
                  </button>
                ))}
              </div>
              <div className="lp-grid">
                {shown.map((e, i) => (
                  <a key={e.slug} href={`/examples/${e.slug}`} className="lp-card" aria-label={`${e.title}, ${e.field}: open the live deck`} onClick={ev => {
                    // A link to the example's page, for new tabs and search engines; a click opens it here
                    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return
                    ev.preventDefault()
                    track('open-example', { example: e.slug, from: 'card' })
                    setViewing(i)
                  }}>
                    <div className="lp-thumb" style={e.thumbnail ? undefined : { background: placeholderBg(e.background) }}>
                      {e.thumbnail ? <img loading="lazy" alt="" src={e.thumbnail} /> : <strong className="lp-thumb-title">{e.title}</strong>}
                      <span>Open live</span>
                    </div>
                    <div className="lp-card-body">
                      {e.field && <div className="lp-label">{e.field}</div>}
                      <h3>{e.title}</h3>
                      <p>{e.desc}</p>
                      <div className="lp-tags">{e.tags.map(t => <span key={t}>{t}</span>)}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>

          <section className="lp-band" id="compare" aria-labelledby="lp-compare">
            <div className="lp-wrap">
              <div className="lp-head lp-head-wide">
                <div className="lp-label">Where it fits</div>
                <h2 id="lp-compare">A visual editor that knows <em>LaTeX, BibTeX and git</em></h2>
                <p>Parallax keeps what researchers like about the tools they already use, in one place.</p>
              </div>
              <div className="lp-compare">
                <table>
                  <thead><tr><th scope="col"><span className="lp-label">Feature</span></th>{COMPARED.map((t, i) => <th scope="col" key={t} className={i === COMPARED.length - 1 ? 'us' : undefined}>{t}</th>)}</tr></thead>
                  <tbody>{COMPARISON.map(([name, ...cells]) => (
                    <tr key={name}><th scope="row">{name}</th>{cells.map(([mark, words], i) => <td key={i} className={`${mark}${i === cells.length - 1 ? ' us' : ''}`}>{words}</td>)}</tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="lp-compare-note">Coming from Beamer? File › Import › LaTeX Beamer… turns a .tex talk into slides you can edit.</p>
            </div>
          </section>

          <section className="lp-band lp-light" id="workflow" aria-labelledby="lp-workflow">
            <div className="lp-wrap">
              <div className="lp-head">
                <h2 id="lp-workflow">From outline to talk</h2>
                <p>Parallax follows a talk the whole way, from the first plan to the version you share.</p>
              </div>
              <ol className="lp-steps">
                {STEPS.map(s => <li key={s.title} className={s.title === 'Rehearse' ? 'on' : undefined}><h3>{s.title}</h3><p>{s.text}</p><span>{s.title === 'Rehearse' ? `${s.tool} · try it below` : s.tool}</span></li>)}
              </ol>
              <PracticeDemo />
            </div>
          </section>

          <section className="lp-band lp-light alt" id="start" aria-labelledby="lp-start">
            <div className="lp-wrap">
              <div className="lp-head">
                <h2 id="lp-start">Start free, or run it yourself</h2>
                <p>Use Parallax here, or install it on your own server. It’s the same open-source editor either way.</p>
              </div>
              <div className="lp-plans">
                {PLANS.map(plan => (
                  <div key={plan.id} className={plan.lead ? 'lp-plan lead' : 'lp-plan'}>
                    <h3>{plan.name}</h3>
                    <div className="lp-price">{plan.price}</div>
                    <p className="lp-price-note">{plan.note}</p>
                    <ul>{plan.items.map(([text, soon]) => <li key={text}><span>{text}{soon && <> <span className="lp-soon">Coming soon</span></>}</span></li>)}</ul>
                    <div className="lp-plan-row">
                      {plan.href
                        ? <a className="lp-btn ghost" href={plan.href} onClick={() => track('contact', { from: `plan-${plan.id}` })}>{plan.cta}</a>
                        : <button type="button" className={plan.lead ? 'lp-btn primary' : 'lp-btn ghost'} onClick={() => { track('sign-in', { from: `plan-${plan.id}` }); onSignIn() }}>{plan.cta}</button>}
                      {plan.id === 'free' && guestEnabled && <a className="lp-quiet" href="/try" onClick={() => track('try', { from: 'plans' })}>or try it without an account</a>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="lp-selfhost">
                <div>
                  <div className="lp-label">Self-hosted · free and unlimited</div>
                  <p>Runs on your server with Docker, with no account needed and your decks on your own machine. Desktop apps for macOS, Windows and Linux.</p>
                </div>
                <a className="lp-btn primary" href="#docs/guide/installation" onClick={() => track('self-hosting-guide')}>Self-hosting guide</a>
              </div>
            </div>
          </section>

          <section className="lp-band lp-cta" aria-labelledby="lp-cta">
            <div className="lp-wrap lp-cta-row">
              <div className="lp-cta-text">
                <div className="lp-eyebrow">Try it</div>
                <h2 id="lp-cta">Make your next talk in Parallax</h2>
                <p>Free to start, no card needed.</p>
                <div className="lp-ctas">
                  {tryIt('cta')}
                  {guestEnabled && <button type="button" className="lp-btn ghost" onClick={() => { track('sign-in', { from: 'cta' }); onSignIn() }}>Sign in</button>}
                </div>
              </div>
              <Mark id="cta" className="lp-cta-mark" />
            </div>
          </section>

          <footer className="lp-footer">
            <div className="lp-wrap">
              <div className="lp-footer-cols">
                <div>
                  <button type="button" className="lp-logo" aria-label="Parallax" onClick={() => goTo('top')}><Mark id="footer" size={30} /><span className="lp-word">Parallax</span><BetaBadge /></button>
                  <p>Parallax is in beta, so features may change. Tell us what breaks and what you’d like next.</p>
                </div>
                <div><h4>Product</h4><ul>
                  <li><button type="button" onClick={() => goTo('features')}>Features</button></li>
                  <li><button type="button" onClick={() => goTo('examples')}>Examples</button></li>
                  {templates.length > 0 && <li><button type="button" onClick={() => { track('templates', { from: 'footer' }); switchTab('templates') }}>Templates</button></li>}
                  <li><button type="button" onClick={() => goTo('workflow')}>How it works</button></li>
                  <li><button type="button" onClick={() => { track('docs', { from: 'footer' }); switchTab('docs') }}>Docs</button></li>
                </ul></div>
                <div><h4>Project</h4><ul>
                  <li><a href={GITHUB} target="_blank" rel="noopener noreferrer" onClick={() => track('github', { from: 'footer' })}>GitHub</a></li>
                  <li><a href={`${GITHUB}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">License, AGPL-3.0</a></li>
                </ul></div>
                <div><h4>Support</h4>
                  <div className="lp-support"><a href={`mailto:${SUPPORT}`} onClick={() => track('support', { how: 'email' })}>{SUPPORT}</a><button type="button" onClick={copySupport}>{copied ? 'Copied' : 'Copy'}</button></div>
                </div>
              </div>
              <div className="lp-fine">© 2026 Jess Birky. Licensed under AGPL-3.0.</div>
            </div>
          </footer>
        </>)}
      </div>

      <ExampleViewer examples={shown} at={viewing} onClose={() => setViewing(null)}
        onMove={d => {
          const next = (viewing + d + shown.length) % shown.length
          track('open-example', { example: shown[next].slug, from: 'viewer' })
          setViewing(next)
        }} guestEnabled={guestEnabled} onSignIn={onSignIn} />
    </div>
  )
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The landing page, for visitors who aren't signed in: what Parallax is, a
// live deck, the example decks by field (as /admin arranges them, served at
// /examples/<slug>; the built-in ones in client/src/examples if the list
// can't be had), how a talk comes together, the elements by subject, and the
// plans. The docs open in place of it, at #docs.

import { useState, useEffect, useRef } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react'
import DocsPage from '../components/DocsPage'
import BetaBadge from '../components/BetaBadge'
import { api } from '../utils/api'
import { EXAMPLES as BUILT_IN, EXAMPLE_FIELDS, HERO_EXAMPLE } from '../examples/catalog'

const GITHUB = 'https://github.com/jbirky/parallax-presentations'
const SUPPORT = 'support@parallax-presentations.com'

// From the first plan to the DOI, in order
const STEPS = [
  { title: 'Plan', text: 'Outline each slide with notes and the minutes it gets. The notes stay in the outline and never change a slide.', tool: 'Outline' },
  { title: 'Build', text: 'Lay out text, figures and live elements in a visual editor. Math is LaTeX; references come from your citations.', tool: 'Editor' },
  { title: 'Rehearse', text: 'Practice Talk times every slide against your plan and shows where you run long.', tool: 'Practice Talk' },
  { title: 'Present', text: 'Speaker notes, drawing on slides, and a live link your audience can follow on their own screens.', tool: 'Presenter view' },
  { title: 'Share', text: 'Send a link, export PDF or PowerPoint, push to GitHub, or publish with a DOI from Zenodo.', tool: 'Share and publish' },
]

const ELEMENTS = [
  { field: 'Physics', items: [['Feynman diagrams', 'drawn one propagator per step'], ['Free-body diagrams', 'ΣF = ma solved for you'], ['Spherical harmonics', <>any Y<sub>l</sub><sup>m</sup>, in WebGL</>]] },
  { field: 'Mathematics', items: [['Graphs', '2D, 3D, vector and slope fields, with sliders'], ['Geometry constructions', 'compass and straightedge, step by step'], ['Venn diagrams', 'shade any set expression'], ['Interactive equations', 'click a term to explain it']] },
  { field: 'Chemistry', items: [['3D molecules', 'from PubChem or the PDB'], ['Periodic table', 'with element details on click'], ['Reactions', 'mhchem: \\ce{2H2 + O2 -> 2H2O}']] },
  { field: 'Engineering and CS', items: [['Circuits', 'readings from a DC solver'], ['Logic gates', 'click an input, watch it propagate'], ['Timing diagrams', 'WaveDrom, stepped through as you talk'], ['Code', 'with syntax highlighting']] },
  { field: 'Every subject', items: [['LaTeX math', 'inline and display'], ['Citations', 'a references slide built from them'], ['Scrolling slides', 'for a derivation too long for one screen'], ['Click and hover actions', 'states that morph from one look to another']] },
]

// The built-in examples, as the server lists them
const BUILT_IN_LIST = { hero: HERO_EXAMPLE, examples: BUILT_IN.map(e => ({ ...e, thumbnail: `/examples/thumbs/${e.slug}.jpg` })) }
// The filters: the usual fields first, then any others the examples have
const fieldsOf = examples => {
  const have = new Set(examples.map(e => e.field).filter(Boolean))
  return [...EXAMPLE_FIELDS.filter(f => have.has(f)), ...[...have].filter(f => !EXAMPLE_FIELDS.includes(f))]
}
const placeholderBg = bg => (bg?.type === 'color' && bg.color) || (bg?.type === 'gradient' && bg.gradient) || '#1e1e2e'

const HOSTED = ['3 presentations', '100 MB of storage', 'Presentations kept for 30 days', 'Share links and live presenting']
const SELF_HOSTED = ['Runs on your server with Docker', 'No account needed', 'Your decks stay on your machine', 'Desktop apps for macOS, Windows and Linux']

// A deck page drawn at its own 960 × 540 and scaled to the width it's
// given, so a phone shows the slide rather than reveal.js's scroll view
function SlideFrame({ src, title }) {
  const ref = useRef(null)
  useEffect(() => {
    const box = ref.current
    if (!box) return
    const fit = () => box.style.setProperty('--s', String(box.clientWidth / 960))
    fit()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fit)
      return () => window.removeEventListener('resize', fit)
    }
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  return <div className="lp-slide" ref={ref}><iframe src={src} title={title} allow="fullscreen" /></div>
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
          <div className="lp-viewer-deck"><SlideFrame key={example.slug} src={`/examples/${example.slug}`} title={`${example.title}, a live Parallax deck`} /></div>
          <div className="lp-viewer-side">
            <p className="lp-viewer-desc">{example.desc}</p>
            <div>
              <div className="lp-label">Made with</div>
              <div className="lp-tags">{example.tags.map(t => <span key={t}>{t}</span>)}</div>
            </div>
            <p className="lp-keys">Click the slide, then press <kbd>→</kbd> to step through it and <kbd>←</kbd> to go back.</p>
            {guestEnabled ? (<>
              <a className="lp-btn primary" href={`/try?example=${example.slug}`}>Open in the editor</a>
              <p className="lp-small">Opens a copy you can change, with no account. It lasts until you close the tab.</p>
            </>) : (
              <button type="button" className="lp-btn primary" onClick={onSignIn}>Sign in to make your own</button>
            )}
          </div>
        </div>
      </>)}
    </dialog>
  )
}

export default function LandingPage({ onSignIn }) {
  const [tab, setTab] = useState('home')
  const [docsPage, setDocsPage] = useState(null)
  const [guestEnabled, setGuestEnabled] = useState(false)
  const [field, setField] = useState('All')
  const [viewing, setViewing] = useState(null)
  const [scrollTo, setScrollTo] = useState(null)
  const [copied, setCopied] = useState(false)
  const [catalog, setCatalog] = useState(null)

  useEffect(() => {
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
      } else {
        setTab('home')
      }
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  const switchTab = (t) => {
    setTab(t)
    window.location.hash = t === 'docs' ? 'docs' : ''
  }
  // A section of the home tab, from the docs too
  const goTo = id => {
    if (tab !== 'home') switchTab('home')
    setScrollTo({ id })
  }
  useEffect(() => {
    if (!scrollTo || tab !== 'home') return
    document.getElementById(scrollTo.id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [scrollTo, tab])

  const examples = catalog?.examples || []
  const shown = field === 'All' ? examples : examples.filter(e => e.field === field)
  const tryIt = guestEnabled
    ? <a className="lp-btn primary" href="/try">Try it, no account needed <ArrowRight size={16} /></a>
    : <button type="button" className="lp-btn primary" onClick={onSignIn}>Get started free <ArrowRight size={16} /></button>

  const copySupport = async () => {
    try { await navigator.clipboard.writeText(SUPPORT); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* the address is shown to select */ }
  }

  return (
    <div className="landing-page">
      <nav className="lp-nav" aria-label="Main">
        <div className="lp-wrap lp-nav-row">
          <button type="button" className="lp-logo" onClick={() => goTo('top')}><span className="lp-p">P</span>arallax<BetaBadge /></button>
          <div className="lp-links">
            <button type="button" onClick={() => goTo('examples')}>Examples</button>
            <button type="button" className="lp-wide" onClick={() => goTo('workflow')}>How it works</button>
            <button type="button" className={tab === 'docs' ? 'on' : ''} aria-current={tab === 'docs' ? 'page' : undefined} onClick={() => switchTab('docs')}>Docs</button>
            <a className="lp-wide" href={GITHUB} target="_blank" rel="noopener noreferrer">GitHub</a>
            <button type="button" className="lp-signin" onClick={onSignIn}>Sign in</button>
          </div>
        </div>
      </nav>

      <div className="landing-scroll">
        {tab === 'docs' ? (
          <DocsPage initialPage={docsPage} />
        ) : (<>
          <header className="lp-hero lp-wrap" id="top">
            <div className="lp-eyebrow">Slides for research talks, lectures and seminars</div>
            <h1>Create interactive and intuitive slides <em>for complex concepts.</em></h1>
            <p className="lp-sub">Parallax is a slide editor that runs in your browser. Put live graphs, physics and circuit diagrams, equations and 3D molecules on a slide, and move them while you present.</p>
            <div className="lp-ctas">
              {tryIt}
              <button type="button" className="lp-btn ghost" onClick={() => goTo('examples')}>See the examples</button>
            </div>
            <div className="lp-facts"><span>Free to start</span><span>Open source, AGPL-3.0</span><span>Export to HTML, PDF and PowerPoint</span></div>
            <div className="lp-stage">
              <div className="lp-frame">
                {catalog?.hero ? <SlideFrame src={`/examples/${catalog.hero}`} title="A live Parallax deck" /> : <div className="lp-slide" />}
              </div>
              <div className="lp-hint"><i aria-hidden="true">●</i> Live deck: drag a slider, then click and press →</div>
            </div>
          </header>

          <section className="lp-band" id="examples" aria-labelledby="lp-examples">
            <div className="lp-wrap">
              <div className="lp-head">
                <h2 id="lp-examples">Examples</h2>
                <p>Each one is a real Parallax deck. Open it, step through it with the arrow keys, and drag whatever moves.</p>
              </div>
              <div className="lp-filters" role="group" aria-label="Show examples from">
                {['All', ...fieldsOf(examples)].map(f => (
                  <button key={f} type="button" aria-pressed={field === f} onClick={() => setField(f)}>
                    {f}<span>{f === 'All' ? examples.length : examples.filter(e => e.field === f).length}</span>
                  </button>
                ))}
              </div>
              <div className="lp-grid">
                {shown.map((e, i) => (
                  <button key={e.slug} type="button" className="lp-card" aria-label={`${e.title}, ${e.field}: open the live deck`} onClick={() => setViewing(i)}>
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
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="lp-band alt" id="workflow" aria-labelledby="lp-workflow">
            <div className="lp-wrap">
              <div className="lp-head">
                <h2 id="lp-workflow">From outline to talk</h2>
                <p>Parallax follows a talk the whole way, from the first plan to the DOI.</p>
              </div>
              <ol className="lp-steps">
                {STEPS.map(s => <li key={s.title}><h3>{s.title}</h3><p>{s.text}</p><span>{s.tool}</span></li>)}
              </ol>
            </div>
          </section>

          <section className="lp-band" id="elements" aria-labelledby="lp-elements">
            <div className="lp-wrap">
              <div className="lp-head">
                <h2 id="lp-elements">Built for the subjects you teach</h2>
                <p>Each of these is an element you place on a slide and edit in its own panel, not a screenshot.</p>
              </div>
              <div className="lp-fields">
                {ELEMENTS.map(g => (
                  <div key={g.field}>
                    <h3>{g.field}</h3>
                    <ul>{g.items.map(([name, note]) => <li key={name}>{name}<small>{note}</small></li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="lp-band alt" id="start" aria-labelledby="lp-start">
            <div className="lp-wrap">
              <div className="lp-head">
                <h2 id="lp-start">Start free, or run it yourself</h2>
                <p>Use Parallax here, or install it on your own server. It’s the same open-source editor either way.</p>
              </div>
              <div className="lp-plans">
                <div className="lp-plan lead">
                  <div className="lp-label">Hosted</div>
                  <div className="lp-price">Free <small>to start</small></div>
                  <ul>{HOSTED.map(x => <li key={x}>{x}</li>)}</ul>
                  <div className="lp-plan-row">
                    <button type="button" className="lp-btn primary" onClick={onSignIn}>Start free</button>
                    {guestEnabled && <a className="lp-quiet" href="/try">or try it without an account</a>}
                  </div>
                </div>
                <div className="lp-plan">
                  <div className="lp-label">Self-hosted</div>
                  <div className="lp-price">Free <small>and unlimited</small></div>
                  <ul>{SELF_HOSTED.map(x => <li key={x}>{x}</li>)}</ul>
                  <div className="lp-plan-row"><a className="lp-btn ghost" href="#docs/guide/installation">Self-hosting guide</a></div>
                </div>
              </div>
            </div>
          </section>

          <footer className="lp-footer">
            <div className="lp-wrap">
              <div className="lp-footer-cols">
                <div>
                  <button type="button" className="lp-logo" onClick={() => goTo('top')}><span className="lp-p">P</span>arallax<BetaBadge /></button>
                  <p>Parallax is in beta, so features may change. Tell us what breaks and what you’d like next.</p>
                </div>
                <div><h4>Product</h4><ul>
                  <li><button type="button" onClick={() => goTo('examples')}>Examples</button></li>
                  <li><button type="button" onClick={() => goTo('workflow')}>How it works</button></li>
                  <li><button type="button" onClick={() => switchTab('docs')}>Docs</button></li>
                </ul></div>
                <div><h4>Project</h4><ul>
                  <li><a href={GITHUB} target="_blank" rel="noopener noreferrer">GitHub</a></li>
                  <li><a href={`${GITHUB}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">License, AGPL-3.0</a></li>
                </ul></div>
                <div><h4>Support</h4>
                  <div className="lp-support"><a href={`mailto:${SUPPORT}`}>{SUPPORT}</a><button type="button" onClick={copySupport}>{copied ? 'Copied' : 'Copy'}</button></div>
                </div>
              </div>
              <div className="lp-fine">© 2026 Jess Birky. Licensed under AGPL-3.0.</div>
            </div>
          </footer>
        </>)}
      </div>

      <ExampleViewer examples={shown} at={viewing} onClose={() => setViewing(null)}
        onMove={d => setViewing(v => (v + d + shown.length) % shown.length)} guestEnabled={guestEnabled} onSignIn={onSignIn} />
    </div>
  )
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The landing page's Tutorials tab: at #tutorials the list of them, at
// #tutorials/<slug> one of them, step by step. Each step is a screenshot of
// the real editor with numbered pins, what they point at beside it, and the
// way to the tool. The tutorials are client/src/tutorials/catalog.js; their
// shots and pins come from scripts/tutorials/capture.py (shots.json).

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Maximize2, X } from 'lucide-react'
import { TUTORIALS, tutorialBySlug } from '../../tutorials/catalog'
import SHOTS from '../../tutorials/shots.json'
import { track } from '../../utils/analytics'

const two = n => String(n).padStart(2, '0')
const src = (slug, shot) => `/tutorials/${slug}/${shot}.webp`
const stepCount = t => `${t.steps.length} steps · about ${t.minutes} min`

// A shot with its pins; `on` is the pin to show strongest, as its line in the
// list beside it is pointed at
function Shot({ slug, step, on, onPin, alt }) {
  const meta = SHOTS[`${slug}/${step.shot}`]
  const ids = Object.keys(step.pins || {})
  if (!meta) return null
  return (
    <div className="lp-tut-img" style={{ aspectRatio: `${meta.w} / ${meta.h}`, '--ar': meta.w / meta.h }}>
      <img src={src(slug, step.shot)} width={meta.w} height={meta.h} alt={alt} loading="lazy" decoding="async" />
      {ids.map((id, i) => {
        const box = meta.pins[id]
        if (!box) return null
        const [x, y, w, h] = box
        return (
          <span key={id} className={`lp-tut-pin${on === i ? ' on' : ''}`} aria-hidden="true"
            style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
            onMouseEnter={() => onPin?.(i)} onMouseLeave={() => onPin?.(null)}>
            <b>{i + 1}</b>
          </span>
        )
      })}
    </div>
  )
}

function Step({ tutorial, step, index, onZoom }) {
  const [on, setOn] = useState(null)
  const meta = SHOTS[`${tutorial.slug}/${step.shot}`]
  const pins = Object.entries(step.pins || {})
  const alt = `The editor at step ${index + 1}: ${step.title}`
  return (
    <section className="lp-tut-step" id={`lp-tut-step-${index + 1}`} aria-labelledby={`lp-tut-h-${index + 1}`}>
      <div className="lp-tut-text">
        <div className="lp-tut-num" aria-hidden="true">{two(index + 1)}</div>
        <h3 id={`lp-tut-h-${index + 1}`}><span className="sr-only">Step {index + 1}: </span>{step.title}</h3>
        {step.where && (
          <p className="lp-tut-where"><span>Where</span>{step.where.map((w, i) => <span key={i}>{i > 0 && <i aria-hidden="true">›</i>}<kbd>{w}</kbd></span>)}</p>
        )}
        <p>{step.text}</p>
        {pins.length > 0 && (
          <ol className="lp-tut-legend" aria-label="On the screenshot">
            {pins.map(([id, words], i) => (
              <li key={id} className={on === i ? 'on' : undefined} onMouseEnter={() => setOn(i)} onMouseLeave={() => setOn(null)}>
                <b aria-hidden="true">{i + 1}</b><span>{words}</span>
              </li>
            ))}
          </ol>
        )}
        {step.tip && <p className="lp-tut-tip"><b>Tip</b>{step.tip}</p>}
      </div>
      <figure className="lp-tut-shot" style={meta ? { '--ar': meta.w / meta.h } : undefined}>
        <button type="button" className="lp-tut-zoom" onClick={() => onZoom(index)} aria-label={`Enlarge the screenshot of step ${index + 1}`}>
          <Shot slug={tutorial.slug} step={step} on={on} onPin={setOn} alt={alt} />
          <span className="lp-tut-zoom-hint" aria-hidden="true"><Maximize2 size={14} /></span>
        </button>
      </figure>
    </section>
  )
}

// A shot full size, over the page
function Zoom({ tutorial, at, onClose, onMove }) {
  const ref = useRef(null)
  const step = at === null ? null : tutorial.steps[at]
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (step && !dialog.open) dialog.showModal?.()
    if (!step && dialog.open) dialog.close?.()
  }, [step])
  useEffect(() => {
    const dialog = ref.current
    dialog?.addEventListener('close', onClose)
    return () => dialog?.removeEventListener('close', onClose)
  }, [onClose])
  return (
    <dialog className="lp-viewer lp-tut-zoomed" ref={ref} aria-label={step ? `Step ${at + 1}: ${step.title}` : 'Screenshot'}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => { if (e.key === 'ArrowRight') onMove(1); else if (e.key === 'ArrowLeft') onMove(-1) }}>
      {step && (<>
        <div className="lp-viewer-head">
          <div className="lp-viewer-name"><div className="lp-label">Step {at + 1} of {tutorial.steps.length}</div><h3>{step.title}</h3></div>
          <div className="lp-viewer-nav">
            <button type="button" className="lp-icon" aria-label="Previous step" disabled={at === 0} onClick={() => onMove(-1)}><ArrowLeft size={18} /></button>
            <button type="button" className="lp-icon" aria-label="Next step" disabled={at === tutorial.steps.length - 1} onClick={() => onMove(1)}><ArrowRight size={18} /></button>
            <button type="button" className="lp-icon" aria-label="Close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="lp-tut-zoomed-body">
          <Shot slug={tutorial.slug} step={step} alt={`The editor at step ${at + 1}: ${step.title}`} />
          <ol className="lp-tut-legend">
            {Object.entries(step.pins || {}).map(([id, words], i) => <li key={id}><b aria-hidden="true">{i + 1}</b><span>{words}</span></li>)}
          </ol>
        </div>
      </>)}
    </dialog>
  )
}

function Card({ t, from }) {
  return (
    <a className="lp-card lp-tut-card" href={`#tutorials/${t.slug}`} onClick={() => track('open-tutorial', { tutorial: t.slug, from })}>
      <div className="lp-thumb">
        <img loading="lazy" alt="" src={src(t.slug, t.cover)} />
        {t.badge && <span>{t.badge}</span>}
      </div>
      <div className="lp-card-body">
        <div className="lp-label">{stepCount(t)}</div>
        <h3>{t.title}</h3>
        <p>{t.summary}</p>
        <div className="lp-tags">{t.uses.map(u => <span key={u}>{u}</span>)}</div>
      </div>
    </a>
  )
}

export function TutorialList({ onDocs }) {
  return (
    <div className="lp-wrap">
      <div className="lp-head">
        <h2 id="lp-tutorials">Tutorials</h2>
        <p>A task at a time, in the real editor, with a screenshot of every step. Follow along in another tab, or read them through first.</p>
      </div>
      <div className="lp-grid">
        {TUTORIALS.map(t => <Card key={t.slug} t={t} from="list" />)}
      </div>
      <p className="lp-tut-more">Looking for one tool, or every option it has? <button type="button" className="lp-quiet" onClick={onDocs}>The docs</button> cover each of them.</p>
    </div>
  )
}

export function TutorialPage({ slug, tryIt }) {
  const tutorial = tutorialBySlug(slug)
  const [zoom, setZoom] = useState(null)
  const [current, setCurrent] = useState(0)
  const steps = useRef([])

  // The step in view, for the list of steps
  useEffect(() => {
    if (!tutorial || typeof IntersectionObserver === 'undefined') return
    const root = document.querySelector('.landing-scroll')
    const seen = new Map()
    const watch = new IntersectionObserver(entries => {
      entries.forEach(e => seen.set(Number(e.target.dataset.i), e.isIntersecting))
      const first = [...seen].filter(([, v]) => v).map(([k]) => k).sort((a, b) => a - b)[0]
      if (first !== undefined) setCurrent(first)
    }, { root, rootMargin: '-25% 0px -55% 0px' })
    steps.current.forEach(el => el && watch.observe(el))
    return () => watch.disconnect()
  }, [tutorial])

  if (!tutorial) {
    return (
      <div className="lp-wrap">
        <p className="lp-empty">There’s no tutorial here. <a className="lp-quiet" href="#tutorials">See all the tutorials</a>.</p>
      </div>
    )
  }
  const at = TUTORIALS.indexOf(tutorial)
  const next = TUTORIALS[at + 1] || null
  const goStep = i => {
    document.getElementById(`lp-tut-step-${i + 1}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="lp-wrap">
      <a className="lp-tut-back" href="#tutorials"><ArrowLeft size={16} /> All tutorials</a>
      <header className="lp-head lp-head-wide lp-tut-head">
        <div className="lp-label">Tutorial · {stepCount(tutorial)}</div>
        <h2 id="lp-tutorials">{tutorial.title}</h2>
        <p>{tutorial.summary}</p>
        <div className="lp-tags">{tutorial.uses.map(u => <span key={u}>{u}</span>)}</div>
        <div className="lp-ctas">{tryIt(`tutorial-${tutorial.slug}`)}</div>
      </header>

      <div className="lp-tut-body">
        <nav className="lp-tut-nav" aria-label="Steps">
          <ol>
            {tutorial.steps.map((s, i) => (
              <li key={s.shot}>
                <button type="button" aria-current={current === i ? 'step' : undefined} onClick={() => goStep(i)}>
                  <span>{two(i + 1)}</span>{s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="lp-tut-steps">
          {tutorial.steps.map((s, i) => (
            <div key={s.shot} data-i={i} ref={el => { steps.current[i] = el }}>
              <Step tutorial={tutorial} step={s} index={i} onZoom={setZoom} />
            </div>
          ))}
          <footer className="lp-tut-end">
            {tutorial.docs?.length > 0 && (
              <div>
                <div className="lp-label">More in the docs</div>
                <ul>{tutorial.docs.map(([name, page]) => <li key={page}><a className="lp-quiet" href={`#docs/${page}`}>{name}</a></li>)}</ul>
              </div>
            )}
            {next && (
              <div>
                <div className="lp-label">Next tutorial</div>
                <Card t={next} from={`after-${tutorial.slug}`} />
              </div>
            )}
          </footer>
        </div>
      </div>

      <Zoom tutorial={tutorial} at={zoom} onClose={() => setZoom(null)}
        onMove={d => setZoom(z => Math.max(0, Math.min(tutorial.steps.length - 1, z + d)))} />
    </div>
  )
}

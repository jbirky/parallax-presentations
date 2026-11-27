// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The landing page's "From outline to talk": the five steps of a talk as
// tabs, each showing its tool below on the same sample talk (PracticeDemo's
// TALK). Rehearse is Practice Talk (PracticeDemo). The others are drawn here
// as the editor has them:
// - Plan: the outline (components/OutlinePanel.jsx, docs/tutorials/outline.md)
// - Build: the canvas, LaTeX and the bibliography (docs/tutorials/citations.md)
// - Present: present mode's pen, the speaker view and Live Present, whose
//   audience joins on the presenter's slide and can page back, not ahead
//   (server/index.js /live/:id; docs/tutorials/drawing-on-slides.md)
// - Share: Share link, File › Export and Sync › GitHub (docs/features/export.md)

import { Fragment, useEffect, useRef, useState } from 'react'
import katex from 'katex'
import PracticeDemo, { TALK, MiniSlide } from './PracticeDemo'
import { clock } from '../../utils/practice'
import { track } from '../../utils/analytics'

export const STEPS = [
  { key: 'plan', title: 'Plan', text: 'Outline each slide with notes and the minutes it gets. The notes stay in the outline and never change a slide.', tool: 'Outline' },
  { key: 'build', title: 'Build', text: 'Lay out text, figures and live elements in a visual editor. Math is LaTeX; references come from your citations.', tool: 'Editor' },
  { key: 'rehearse', title: 'Rehearse', text: 'Practice Talk times every slide against your plan and shows where you run long.', tool: 'Practice Talk' },
  { key: 'present', title: 'Present', text: 'Speaker notes, drawing on slides, and a live link your audience can follow on their own screens.', tool: 'Presenter view' },
  { key: 'share', title: 'Share', text: 'Send a link, export PDF or PowerPoint, or push to GitHub and host it on GitHub Pages.', tool: 'Share and publish' },
]

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const fmtMin = m => (m % 1 ? m.toFixed(1) : String(m))
const num = s => Math.max(0, Number(s) || 0)

function Head({ label, title, children }) {
  return (
    <header>
      <div className="lp-label">{label}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </header>
  )
}

function Chrome({ title, note }) {
  return <div className="lp-pr-chrome"><i /><i /><i /><span>{title}</span>{note && <em>{note}</em>}</div>
}

// A slide drawn small, sized by its own width
function Thumb({ slide, className = '' }) {
  return <div className={`lp-sd-thumb ${className}`}><MiniSlide slide={slide} /></div>
}

// ── Plan: the outline ─────────────────────────────────────────────────────

const SECTIONS = ['Opening', 'The evidence', 'What it means']
const SECTION_OF = [0, 1, 1, 2, 2]
const OUTLINE_NOTES = [
  [{ t: 'Ask it: what holds a galaxy together?', l: 0 }],
  [{ t: 'Two clues, forty years apart', l: 0 }, { t: 'Zwicky, 1933: Coma’s galaxies', l: 1 }, { t: 'Rubin and Ford, 1970: Andromeda', l: 1 }],
  [{ t: 'Drag the halo slider live', l: 0 }, { t: 'Stop where the light runs out', l: 0 }],
  [{ t: 'One lensing picture, no equations', l: 0 }],
  [{ t: 'Leave a minute for questions', l: 0 }],
]

export function PlanDemo() {
  const [minutes, setMinutes] = useState(() => TALK.map(s => String(s.minutes)))
  const [target, setTarget] = useState('10')
  const [notes, setNotes] = useState(OUTLINE_NOTES)
  const [sel, setSel] = useState(2)
  const [focus, setFocus] = useState(null)
  const fields = useRef({})
  useEffect(() => {
    if (!focus) return
    fields.current[focus]?.focus()
    setFocus(null)
  }, [focus])

  const mins = minutes.map(num)
  const total = mins.reduce((a, b) => a + b, 0)
  const length = num(target)
  const span = Math.max(total, length) || 1
  const perSection = SECTIONS.map((_, k) => mins.reduce((a, m, i) => a + (SECTION_OF[i] === k ? m : 0), 0))
  const over = length > 0 && total > length
  const status = !length || !total ? '' : over ? `${fmtMin(total - length)} over` : `${fmtMin(length - total)} to spare`

  const setNote = (i, k, t) => setNotes(ns => ns.map((n, j) => (j === i ? n.map((x, m) => (m === k ? { ...x, t } : x)) : n)))
  const keyNote = (i, k, e) => {
    const note = notes[i][k]
    if (e.key === 'Enter') {
      e.preventDefault()
      setNotes(ns => ns.map((n, j) => (j === i ? [...n.slice(0, k + 1), { t: '', l: note.l }, ...n.slice(k + 1)] : n)))
      setFocus(`${i}-${k + 1}`)
    } else if (e.key === 'Backspace' && !note.t && notes[i].length > 1) {
      e.preventDefault()
      setNotes(ns => ns.map((n, j) => (j === i ? n.filter((_, m) => m !== k) : n)))
      setFocus(k > 0 ? `${i}-${k - 1}` : `${i}-0`)
    }
  }

  return (
    <div className="lp-stepdemo">
      <Head label="Plan" title="Plan the talk before you build it">
        At the top of the left panel, switch from Slides to Outline. Each slide is a line with its title, your notes under it, and the minutes it gets; the outline adds them up against the talk’s length. The notes are yours alone: they never change a slide, and they don’t show when you present. Try it: change the minutes, or type a note and press Enter for another.
      </Head>
      <div className="lp-sd-grid plan">
        <aside className="lp-sd-outline" aria-label="The talk’s outline">
          <div className="lp-sd-ol-head">
            <b>Outline</b>
            <span className="lp-sd-ol-plan">
              <strong>{fmtMin(total)}</strong> min planned of
              <input type="number" min="0" step="1" value={target} aria-label="Talk length in minutes" onChange={e => setTarget(e.target.value)} />
              min <em className={over ? 'over' : undefined}>{status}</em>
            </span>
          </div>
          <div className="lp-sd-bar" aria-hidden="true">
            {perSection.map((m, k) => m > 0 && <i key={k} className={`s${k}`} style={{ width: `${m / span * 100}%` }} />)}
            {over && <b className="over" style={{ left: `${length / span * 100}%` }} />}
            {length > 0 && <u style={{ left: `${length / span * 100}%` }} />}
          </div>
          <div className="lp-sd-ol-list">
            {TALK.map((s, i) => (
              <Fragment key={s.title}>
                {(i === 0 || SECTION_OF[i] !== SECTION_OF[i - 1]) && (
                  <div className="sec"><span>§ {SECTIONS[SECTION_OF[i]]}</span><span>{fmtMin(perSection[SECTION_OF[i]])} min</span></div>
                )}
                <div className={`slide${sel === i ? ' cur' : ''}`}>
                  <span className="n">{i + 1}</span>
                  <button type="button" className="t" onClick={() => setSel(i)}>{s.title}</button>
                  <input className="m" type="number" min="0" step="0.5" value={minutes[i]} aria-label={`Minutes for slide ${i + 1}`}
                    onFocus={() => setSel(i)} onChange={e => setMinutes(ms => ms.map((m, j) => (j === i ? e.target.value : m)))} />
                </div>
                {notes[i].map((n, k) => (
                  <input key={k} ref={el => { fields.current[`${i}-${k}`] = el }} className={`note l${n.l}`} value={n.t} placeholder="Add a note"
                    aria-label={`Note on slide ${i + 1}`} onFocus={() => setSel(i)} onChange={e => setNote(i, k, e.target.value)} onKeyDown={e => keyNote(i, k, e)} />
                ))}
              </Fragment>
            ))}
          </div>
          <div className="lp-sd-foot"><kbd>Enter</kbd> new note · <kbd>Backspace</kbd> on an empty one removes it</div>
        </aside>
        <div className="lp-pr-window">
          <Chrome title="Editor · Dark matter in ten minutes" note={`Slide ${sel + 1}`} />
          <div className="lp-pr-stage"><div className="lp-pr-slide"><MiniSlide slide={TALK[sel]} /></div></div>
          <div className="lp-pr-controls"><span>Click a line and its slide shows here, as it is. Type all you like in the outline: nothing on the slide moves.</span></div>
        </div>
      </div>
    </div>
  )
}

// ── Build: the canvas, LaTeX and citations ───────────────────────────────

const LIBRARY = [
  { key: 'rubin1970', short: 'Rubin & Ford, 1970', ref: 'Rubin, V. C. & Ford, W. K. 1970, ApJ, 159, 379' },
  { key: 'zwicky1933', short: 'Zwicky, 1933', ref: 'Zwicky, F. 1933, Helv. Phys. Acta, 6, 110' },
  { key: 'planck2018', short: 'Planck Collaboration, 2020', ref: 'Planck Collaboration 2020, A&A, 641, A6' },
]
const START_TEX = 'v(r) = \\sqrt{\\frac{G\\,M(r)}{r}}'
const BOXES = { text: 'Text box', eq: 'Equation' }

export function BuildDemo() {
  const [tex, setTex] = useState(START_TEX)
  const [marks, setMarks] = useState([])
  const [pos, setPos] = useState({ text: { x: 7, y: 30 }, eq: { x: 50, y: 58 } })
  const [selected, setSelected] = useState('eq')
  const stage = useRef(null)
  const drag = useRef(null)

  // Numbered in the order they're first cited, as the references slide lists them
  const order = [...new Set(marks)]
  const n = key => order.indexOf(key) + 1
  const math = katex.renderToString(tex, { throwOnError: false, displayMode: true, maxExpand: 100, maxSize: 20 })

  // Where a box can go: on the slide, under its title
  const place = (id, x, y, box) => {
    const r = stage.current.getBoundingClientRect()
    const w = box.width / (r.width || 1) * 100, h = box.height / (r.height || 1) * 100
    setPos(p => ({ ...p, [id]: { x: clamp(x, 0, Math.max(0, 100 - w)), y: clamp(y, 18, Math.max(18, 100 - h)) } }))
  }
  const down = (id, e) => {
    setSelected(id)
    const r = stage.current.getBoundingClientRect()
    drag.current = { id, sx: e.clientX, sy: e.clientY, x: pos[id].x, y: pos[id].y, w: r.width || 1, h: r.height || 1, el: e.currentTarget }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const move = e => {
    const d = drag.current
    if (!d) return
    place(d.id, d.x + (e.clientX - d.sx) / d.w * 100, d.y + (e.clientY - d.sy) / d.h * 100, d.el.getBoundingClientRect())
  }
  const up = () => {
    if (drag.current) track('workflow-demo', { step: 'build', did: 'drag' })
    drag.current = null
  }
  const nudge = (id, e) => {
    const step = e.shiftKey ? 6 : 2
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (!d) return
    e.preventDefault()
    place(id, pos[id].x + d[0], pos[id].y + d[1], e.currentTarget.getBoundingClientRect())
  }
  const boxProps = id => ({
    role: 'button', tabIndex: 0, 'aria-label': `${BOXES[id]}: drag it, or move it with the arrow keys`,
    className: `lp-sd-box ${id}${selected === id ? ' on' : ''}`, style: { left: `${pos[id].x}%`, top: `${pos[id].y}%` },
    onPointerDown: e => down(id, e), onPointerMove: move, onPointerUp: up, onPointerCancel: up,
    onKeyDown: e => nudge(id, e), onFocus: () => setSelected(id),
  })
  const cite = key => {
    setMarks(m => (m.length >= 6 ? m : [...m, key]))
    track('workflow-demo', { step: 'build', did: 'cite' })
  }

  return (
    <div className="lp-stepdemo">
      <Head label="Build" title="A visual editor that speaks LaTeX">
        Put text, figures, equations, graphs and diagrams on a slide and drag them where they go. Math is typed in LaTeX and set as you type. Import your BibTeX or Zotero library, cite from it, and the citations are numbered and the references slide is made for you. Try it: drag the boxes, change the LaTeX, cite a paper.
      </Head>
      <div className="lp-sd-grid build">
        <div className="lp-pr-window">
          <Chrome title="Editor · Why galaxies spin too fast" note="Slide 3" />
          <div className="lp-pr-stage lp-sd-canvas" ref={stage}>
            <div className="lp-mini lp-sd-slide">
              <h4>Why galaxies spin too fast</h4>
              <div {...boxProps('text')}>
                Far from the center, stars orbit as fast as those near it{marks.map((k, i) => <span key={i} className="lp-sd-cite">[{n(k)}]</span>)}
              </div>
              <div {...boxProps('eq')} dangerouslySetInnerHTML={{ __html: math }} />
            </div>
          </div>
          <div className="lp-sd-refs" aria-live="polite">
            <Thumb slide={{ kind: 'list', title: 'References', items: order.length ? order.map(k => `[${n(k)}] ${LIBRARY.find(e => e.key === k).ref}`) : ['Cite a paper and it’s listed here'] }} />
            <span><b>Slide 6 · References</b>Made from what the slides cite, in the order they cite it. It changes as they do.</span>
          </div>
        </div>
        <aside className="lp-sd-side">
          <section>
            <h4><label htmlFor="lp-sd-tex">Equation · LaTeX</label></h4>
            <textarea id="lp-sd-tex" rows={3} spellCheck={false} value={tex} onChange={e => setTex(e.target.value)} onFocus={() => setSelected('eq')} />
            <p>Set with KaTeX as you type. Inline math in text is <code>$…$</code>; TikZ diagrams work too.</p>
          </section>
          <section>
            <h4>Citations and bibliography</h4>
            <ul className="lp-sd-lib">
              {LIBRARY.map(e => (
                <li key={e.key}>
                  <span><code>{e.key}</code>{e.short}</span>
                  <button type="button" className="lp-btn ghost" onClick={() => cite(e.key)} aria-label={`Cite ${e.short}`}>Cite</button>
                </li>
              ))}
            </ul>
            {marks.length > 0 && <button type="button" className="lp-sd-link" onClick={() => setMarks(m => m.slice(0, -1))}>Undo the last citation</button>}
          </section>
        </aside>
      </div>
    </div>
  )
}

// ── Present: the pen, the speaker view and Live Present ──────────────────

const SPEAKER_NOTES = [
  'Open with the question: what holds a galaxy together?',
  'Zwicky first, then Rubin’s curves. Two clues, forty years apart.',
  'Drag the halo slider live. Pause where the curve stays flat.',
  'One lensing picture is enough. Skip the math.',
  'Thank the group, then take questions.',
]
const PENS = [['pen', 'Pen'], ['highlighter', 'Highlighter'], ['laser', 'Laser pointer']]
const INKS = [['#ee2b2b', 'Red'], ['#1e60ff', 'Blue'], ['#ffd23f', 'Yellow']]
const points = pts => (pts.length === 1 ? [pts[0], pts[0]] : pts).map(p => p.join(',')).join(' ')

export function PresentDemo() {
  const [at, setAt] = useState(0)
  const [shown, setShown] = useState(0)
  const [phone, setPhone] = useState(0)
  const [pen, setPen] = useState('pen')
  const [ink, setInk] = useState(INKS[0][0])
  const [strokes, setStrokes] = useState(() => TALK.map(() => []))
  const [live, setLive] = useState(null)
  const [trails, setTrails] = useState([])
  const [secs, setSecs] = useState(0)
  const timers = useRef([])
  const ids = useRef(0)
  useEffect(() => {
    const t = setInterval(() => setSecs(s => s + 1), 1000)
    return () => { clearInterval(t); timers.current.forEach(clearTimeout) }
  }, [])

  const go = d => {
    const to = clamp(at + d, 0, TALK.length - 1)
    setAt(to)
    setShown(s => Math.max(s, to))
    track('workflow-demo', { step: 'present', did: 'slide' })
  }
  const at160 = e => {
    const r = e.currentTarget.getBoundingClientRect()
    return [(e.clientX - r.left) / (r.width || 1) * 160, (e.clientY - r.top) / (r.height || 1) * 90].map(v => Math.round(v * 10) / 10)
  }
  const down = e => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    ids.current += 1
    setLive({ id: ids.current, pen, ink: pen === 'laser' ? '#ff3b30' : ink, pts: [at160(e)] })
  }
  const move = e => { if (live) { const p = at160(e); setLive(s => s && { ...s, pts: [...s.pts, p] }) } }
  const up = () => {
    if (!live) return
    const s = live
    setLive(null)
    if (s.pen === 'laser') {
      setTrails(t => [...t, s])
      timers.current.push(setTimeout(() => setTrails(t => t.filter(x => x.id !== s.id)), 700))
    } else {
      setStrokes(all => all.map((list, i) => (i === at ? [...list, s] : list)))
      track('workflow-demo', { step: 'present', did: 'draw' })
    }
  }
  const line = (s, extra = '') => <polyline key={s.id} className={`${s.pen}${extra}`} points={points(s.pts)} stroke={s.ink} />
  const next = TALK[at + 1]

  return (
    <div className="lp-stepdemo">
      <Head label="Present" title="Present with your notes, a pen, and a link for the room">
        Present opens the deck in its own window. Press <kbd>S</kbd> for the speaker view: your notes, a timer and the next slide. Press <kbd>D</kbd> to draw with a pen, a highlighter or a laser pointer; the ink stays on its slide, and each time you present keeps its own. Present ▾ › Live Present gives you a link: the audience joins on your slide and can look back at anything you’ve shown, but not ahead of you. Try it: draw on the slide, then move on and watch the phone.
      </Head>
      <div className="lp-sd-grid present">
        <div className="lp-pr-window">
          <Chrome title="Present · Dark matter in ten minutes" note={`Slide ${at + 1} of ${TALK.length}`} />
          <div className="lp-pr-stage">
            <div className="lp-pr-slide"><MiniSlide slide={TALK[at]} /></div>
            <svg className={`lp-sd-ink ${pen}`} viewBox="0 0 160 90" preserveAspectRatio="none" role="img" aria-label="Draw on the slide"
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
              {strokes[at].map(s => line(s))}
              {trails.map(s => line(s, ' fade'))}
              {live && line(live)}
            </svg>
          </div>
          <div className="lp-sd-pen" role="toolbar" aria-label="Pen">
            {PENS.map(([key, name]) => <button key={key} type="button" aria-pressed={pen === key} onClick={() => setPen(key)}>{name}</button>)}
            <span className="sw">
              {INKS.map(([c, name]) => <button key={c} type="button" aria-label={name} aria-pressed={ink === c} style={{ background: c }} onClick={() => { setInk(c); if (pen === 'laser') setPen('pen') }} />)}
            </span>
            <button type="button" onClick={() => setStrokes(all => all.map((list, i) => (i === at ? [] : list)))} disabled={!strokes[at].length}>Clear slide</button>
          </div>
          <div className="lp-pr-controls">
            <button type="button" className="lp-btn ghost" onClick={() => go(-1)} disabled={at === 0}>← Previous</button>
            <button type="button" className="lp-btn ghost" onClick={() => go(1)} disabled={at === TALK.length - 1}>Next slide →</button>
            <span>Ink stays on its slide: go back and it’s still there.</span>
          </div>
        </div>
        <div className="lp-sd-stack">
          <section className="lp-sd-card" aria-label="Speaker view">
            <div className="lp-sd-card-head"><b>Speaker view</b><span className="lp-sd-clock">{clock(secs)}</span></div>
            <p className="lp-sd-notes">{SPEAKER_NOTES[at]}</p>
            <div className="lp-sd-next">
              <span>Next</span>
              {next ? <Thumb slide={next} /> : <div className="lp-sd-end">End of the talk</div>}
            </div>
          </section>
          <section className="lp-sd-card" aria-label="Live Present, on someone’s phone">
            <div className="lp-sd-card-head"><b>Live Present</b><span className="lp-sd-live">Live</span></div>
            <code className="lp-sd-url">parallax-presentations.com/live/3f9c…</code>
            <div className="lp-sd-phone">
              <Thumb slide={TALK[phone]} />
              <div className="lp-sd-phone-nav">
                <button type="button" aria-label="Their previous slide" disabled={phone === 0} onClick={() => setPhone(p => p - 1)}>‹</button>
                <span>{phone + 1} / {shown + 1} shown</span>
                <button type="button" aria-label="Their next slide" disabled={phone >= shown} onClick={() => setPhone(p => p + 1)}>›</button>
              </div>
            </div>
            <p className="lp-sd-small">{phone < at ? 'They’re behind you. They can catch up to the slide you’re on.' : phone > at ? 'They’re ahead of you, on a slide you’ve already shown.' : 'On the slide you’re showing. Your ink stays in your window.'}</p>
          </section>
        </div>
      </div>
    </div>
  )
}

// ── Share: a link, a file, or a site ─────────────────────────────────────

const WAYS = [
  { key: 'link', name: 'Share link', how: 'Share › Share link…' },
  { key: 'export', name: 'Export a file', how: 'File › Export' },
  { key: 'github', name: 'GitHub and Pages', how: 'Sync › GitHub…' },
]
const FORMATS = [
  { key: 'pdf', name: 'PDF', ext: 'pdf', text: 'A print view with every step shown. Save it as a PDF from the print dialog: for handouts, and for the archive.' },
  { key: 'pptx', name: 'PowerPoint (.pptx)', ext: 'pptx', text: 'Text, images and basic shapes stay editable in PowerPoint, Google Slides or LibreOffice. LaTeX comes as images.' },
  { key: 'html', name: 'HTML', ext: 'html', text: 'One file that opens in any browser and presents as Parallax does, sliders and all. Its libraries load from the web.' },
  { key: 'offline', name: 'Offline HTML', ext: 'html', text: 'The same, with everything inside it, so it presents with no connection: from a USB stick, or a conference room’s laptop.' },
]
const FOLDER = 'dark_matter_in_ten_minutes'

export function ShareDemo() {
  const [way, setWay] = useState('link')
  const [shared, setShared] = useState(false)
  const [format, setFormat] = useState('pdf')
  const [message, setMessage] = useState('Add the rotation curve slide')
  const [pushes, setPushes] = useState([])
  const f = FORMATS.find(x => x.key === format)
  const push = () => {
    setPushes(p => [{ id: p.length + 1, message: message.trim() || 'Update from Parallax' }, ...p].slice(0, 3))
    track('workflow-demo', { step: 'share', did: 'push' })
  }

  return (
    <div className="lp-stepdemo">
      <Head label="Share" title="Share it as a link, a file, or a site">
        A share link opens the talk in any browser, with nothing to install, and turns off when you say. File › Export saves a PDF, a PowerPoint file or HTML that works offline. Sync › GitHub… pushes the talk to a repository, every push a commit, and GitHub Pages gives it an address of its own.
      </Head>
      <div className="lp-sd-grid share">
        <div className="lp-sd-ways" role="group" aria-label="Ways to share">
          {WAYS.map(w => (
            <button key={w.key} type="button" aria-pressed={way === w.key} onClick={() => { setWay(w.key); track('workflow-demo', { step: 'share', did: w.key }) }}>
              <b>{w.name}</b><small>{w.how}</small>
            </button>
          ))}
        </div>
        <div className="lp-pr-window lp-sd-share">
          {way === 'link' && (<>
            <Chrome title="Share · Dark matter in ten minutes" />
            <div className="lp-sd-pane">
              {shared ? (<>
                <p>Anyone with the link can view the talk in a browser, without the editor.</p>
                <code className="lp-sd-url">parallax-presentations.com/share/7c1e2b40-…</code>
                <div className="lp-sd-browser">
                  <div className="lp-sd-browser-bar"><i /><span>parallax-presentations.com/share/7c1e2b40-…</span></div>
                  <Thumb slide={TALK[0]} />
                </div>
                <button type="button" className="lp-btn ghost" onClick={() => setShared(false)}>Disable Sharing</button>
              </>) : (<>
                <p>Make a public link to view this presentation without the editor. To let someone edit instead, invite them under Share › Editors.</p>
                <button type="button" className="lp-btn primary" onClick={() => { setShared(true); track('workflow-demo', { step: 'share', did: 'enable' }) }}>Enable Sharing</button>
              </>)}
            </div>
          </>)}
          {way === 'export' && (<>
            <Chrome title="File › Export" />
            <div className="lp-sd-pane lp-sd-export">
              <div className="lp-sd-formats" role="group" aria-label="Export as">
                {FORMATS.map(x => <button key={x.key} type="button" aria-pressed={format === x.key} onClick={() => setFormat(x.key)}>{x.name}</button>)}
              </div>
              <div className="lp-sd-file">
                <div className="lp-sd-doc" aria-hidden="true"><span>.{f.ext}</span></div>
                <div><b>Dark matter in ten minutes · {f.name}</b><p>{f.text}</p></div>
              </div>
            </div>
          </>)}
          {way === 'github' && (<>
            <Chrome title="Sync › GitHub · you/talks" />
            <div className="lp-sd-pane">
              <div className="lp-sd-push">
                <input value={message} onChange={e => setMessage(e.target.value)} aria-label="Commit message" />
                <button type="button" className="lp-btn primary" onClick={push}>Push to GitHub</button>
              </div>
              <ul className="lp-sd-repo" aria-label="What the repository holds">
                <li>README.md<span>An index of your talks</span></li>
                <li>{FOLDER}/<span>{pushes[0] ? pushes[0].message : 'Not pushed yet'}</span></li>
                <li className="in">presentation.html<span>Opens in any browser</span></li>
                <li className="in">presentation.json<span>Import it into Parallax</span></li>
                <li className="in">assets/<span>Figures and media</span></li>
              </ul>
              {pushes.length > 0 ? (
                <div className="lp-sd-commits" aria-live="polite">
                  {pushes.map((p, i) => <div key={p.id}><b>{i === 0 ? 'just now' : `push ${p.id}`}</b>{p.message}</div>)}
                  <code className="lp-sd-url">you.github.io/talks/{FOLDER}/presentation.html</code>
                  <p className="lp-sd-small">With GitHub Pages on, that’s the talk’s address. Every push is a commit you can go back to.</p>
                </div>
              ) : <p className="lp-sd-small">Push, and the talk’s folder holds the HTML, the JSON and its figures.</p>}
            </div>
          </>)}
        </div>
      </div>
    </div>
  )
}

// ── The steps, as tabs ────────────────────────────────────────────────────

const PANELS = { plan: PlanDemo, build: BuildDemo, rehearse: PracticeDemo, present: PresentDemo, share: ShareDemo }

export default function WorkflowSteps({ step, onStep }) {
  const pick = key => { track('workflow-step', { step: key }); onStep(key) }
  const keyNav = (e, i) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    let to = d ? (i + d + STEPS.length) % STEPS.length : e.key === 'Home' ? 0 : e.key === 'End' ? STEPS.length - 1 : null
    if (to === null) return
    e.preventDefault()
    onStep(STEPS[to].key)
    e.currentTarget.parentElement.children[to]?.focus()
  }
  const current = STEPS.find(s => s.key === step) || STEPS[0]
  const Panel = PANELS[current.key]
  return (<>
    <div className="lp-steps" role="tablist" aria-label="The steps of a talk">
      {STEPS.map((s, i) => (
        <button key={s.key} type="button" role="tab" id={`lp-step-${s.key}`} aria-controls="lp-step-panel" aria-selected={s.key === current.key}
          tabIndex={s.key === current.key ? 0 : -1} className={s.key === current.key ? 'on' : undefined}
          onClick={() => pick(s.key)} onKeyDown={e => keyNav(e, i)}>
          <span className="n">{String(i + 1).padStart(2, '0')}</span>
          <b>{s.title}</b>
          <span className="d">{s.text}</span>
          <span className="tool">{s.tool}</span>
        </button>
      ))}
    </div>
    <div role="tabpanel" id="lp-step-panel" aria-labelledby={`lp-step-${current.key}`} key={current.key}>
      <Panel />
    </div>
  </>)
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The outline: the deck as lines in the left panel, in place of the slides.
// Each line is typed into where it is, and each change goes into the deck at
// once (utils/outline.js), so the slide follows as it's typed and the outline
// follows what's typed on the slide. Enter, Tab, Shift+Tab and Backspace
// change the deck's shape: new points and slides, points under points,
// points into slides and back.

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import katex from 'katex'
import { Lock, MessageSquare, BookOpen } from 'lucide-react'
import * as O from '../utils/outline'
import { editorOf } from '../utils/presence'
import { resolveCitationsInHtml } from '../utils/citationIndex'
import { latestRun, clock } from '../utils/practice'

// The Slides / Outline switch at the top of the left panel
export function PanelViewSwitch({ view, onChange }) {
  return (
    <div className="panel-switch" role="tablist" aria-label="Left panel shows">
      {[['slides', 'Slides'], ['outline', 'Outline']].map(([v, label]) => (
        <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  )
}

// ── The cursor in a line, counting math and citations as one character ────
function caretOffset(el) {
  const sel = window.getSelection()
  if (!sel.rangeCount || !el.contains(sel.anchorNode)) return null
  const pre = document.createRange()
  pre.selectNodeContents(el)
  const r = sel.getRangeAt(0)
  pre.setEnd(r.startContainer, r.startOffset)
  const frag = pre.cloneContents()
  frag.querySelectorAll('[contenteditable="false"]').forEach(a => a.replaceWith('x'))
  return frag.textContent.length
}
function setCaret(el, off) {
  const sel = window.getSelection(), r = document.createRange()
  let left = off == null ? Infinity : off, placed = false
  const visit = n => {
    for (const c of Array.from(n.childNodes)) {
      if (placed) return
      if (c.nodeType === 3) {
        if (left <= c.textContent.length) { r.setStart(c, left); placed = true; return }
        left -= c.textContent.length
      } else if (c.nodeType === 1) {
        if (c.getAttribute('contenteditable') === 'false') {
          if (left <= 0) { r.setStartBefore(c); placed = true; return }
          left -= 1
          if (left === 0) { r.setStartAfter(c); placed = true; return }
        } else visit(c)
      }
    }
  }
  visit(el)
  if (!placed) { r.selectNodeContents(el); r.collapse(false) } else r.collapse(true)
  sel.removeAllRanges()
  sel.addRange(r)
}
// A cursor inside a piece (where typing does nothing; a click or End can
// put it there) moves out, to just after it
function leaveAtom(el) {
  const sel = window.getSelection()
  if (!el || !sel.rangeCount || !sel.isCollapsed) return
  const n = sel.anchorNode, host = n && (n.nodeType === 1 ? n : n.parentElement)
  const atom = host && host.closest('[contenteditable="false"]')
  if (!atom || !el.contains(atom)) return
  const r = document.createRange()
  const next = atom.nextSibling
  if (next && next.nodeType === 3) r.setStart(next, Math.min(1, next.textContent.length)); else r.setStartAfter(atom)
  r.collapse(true)
  sel.removeAllRanges()
  sel.addRange(r)
}
function selectAll(el) {
  const r = document.createRange(), sel = window.getSelection()
  r.selectNodeContents(el)
  sel.removeAllRanges()
  sel.addRange(r)
}
// A line's content before and after the cursor (a selection goes)
function splitLine(el, rich) {
  const sel = window.getSelection()
  if (!sel.rangeCount) return [rich ? O.lineHtml(el) : el.textContent, '']
  const r = sel.getRangeAt(0)
  const a = document.createRange(), b = document.createRange()
  a.selectNodeContents(el); a.setEnd(r.startContainer, r.startOffset)
  b.selectNodeContents(el); b.setStart(r.endContainer, r.endOffset)
  const read = range => {
    const d = document.createElement('div')
    d.appendChild(range.cloneContents())
    return rich ? O.normalizeInline(O.lineHtml(d)) : d.textContent
  }
  return [read(a), read(b)]
}
const caretRect = () => {
  const sel = window.getSelection()
  if (!sel.rangeCount) return null
  const r = sel.getRangeAt(0).cloneRange()
  r.collapse(true)
  return r.getClientRects()[0] || null
}
const onFirstLine = el => { const r = caretRect(); return !r || r.top - el.getBoundingClientRect().top < 10 }
const onLastLine = el => { const r = caretRect(); return !r || el.getBoundingClientRect().bottom - r.bottom < 10 }

// A line's content drawn: math by KaTeX, citations by their labels, both as
// pieces that can't be typed into
function paint(el, value, rich, labels) {
  if (!rich) { el.textContent = value || ''; return }
  el.innerHTML = O.atomize(O.cleanInline(resolveCitationsInHtml(value || '', labels)))
  el.querySelectorAll('[data-math-latex]').forEach(m => {
    const tex = m.getAttribute('data-math-latex') || ''
    try { katex.render(tex, m, { throwOnError: false, displayMode: false }) } catch (e) { m.textContent = '$' + tex + '$' }
  })
  // A browser won't put the cursor beside a piece at a line's end without text there
  el.querySelectorAll('[contenteditable="false"]').forEach(a => {
    if (!a.nextSibling || a.nextSibling.nodeType !== 3) a.after(document.createTextNode(O.CARET_SLOT))
    if (!a.previousSibling) a.before(document.createTextNode(O.CARET_SLOT))
  })
}

// One line's text: drawn from the deck unless the deck has what it shows
const Text = memo(function Text({ value, rich, labels, locked, placeholder, label, focus, lineKey, onText, onKeyDown, onFocus }) {
  const ref = useRef(null)
  const shown = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || shown.current === value) return
    const focused = document.activeElement === el
    const at = focused ? caretOffset(el) : null
    paint(el, value, rich, labels)
    shown.current = value
    if (focused) setCaret(el, at)
  }, [value, rich, labels])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !focus || focus.key !== lineKey || focus.done) return
    focus.done = true
    el.focus({ preventScroll: true })
    if (focus.caret === 'all') selectAll(el)
    else setCaret(el, focus.caret === 'start' ? 0 : focus.caret === 'end' || focus.caret == null ? null : focus.caret)
    el.scrollIntoView?.({ block: 'nearest' })
  })
  return (
    <div
      ref={ref}
      className="ol-text"
      contentEditable={!locked}
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-label={label}
      aria-readonly={locked || undefined}
      data-ph={placeholder}
      data-key={lineKey}
      onInput={e => {
        const el = e.currentTarget
        if (el.innerHTML === '<br>') el.innerHTML = ''
        const v = rich ? O.normalizeInline(O.lineHtml(el)) : el.textContent.replace(/\n/g, ' ')
        shown.current = v
        onText(v)
      }}
      onKeyDown={e => { leaveAtom(ref.current); onKeyDown(e, ref.current) }}
      onMouseUp={() => leaveAtom(ref.current)}
      onFocus={onFocus}
      onPaste={e => {
        // Pasted as text, on one line
        e.preventDefault()
        const t = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\s*\n\s*/g, ' ')
        document.execCommand('insertText', false, t)
      }}
    />
  )
})

// Minutes for a slide, kept as typed while it has the focus
function Minutes({ value, onChange, n }) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setText(value == null ? '' : String(value)) }, [value])
  return (
    <input className="ol-mins" type="number" min="0" step="0.5" value={text} placeholder="–" aria-label={'Minutes for slide ' + n}
      onFocus={() => { focused.current = true }}
      onBlur={() => { focused.current = false; setText(value == null ? '' : String(value)) }}
      onChange={e => { setText(e.target.value); onChange(e.target.value === '' ? null : Number(e.target.value)) }} />
  )
}

function Dots({ people }) {
  if (!people || !people.length) return null
  const names = people.map(p => (p.self ? 'You, in another tab' : p.name)).join(', ')
  return (
    <span className="ol-dots" role="img" aria-label={'Here: ' + names} title={names}>
      {people.slice(0, 3).map(p => <span key={p.userId} style={{ background: p.color }} />)}
    </span>
  )
}

const PLACEHOLDER = { section: 'Section name', slide: 'Untitled slide', point: 'Point', note: 'Speaker note' }

export default function OutlinePanel({
  deck, setDeck, stopCapturing = () => {}, onUndo, onRedo, currentIndex = 0, onSelectSlide, onSelectElement,
  onLeaveCanvas, onNotice = () => {}, peers = [], presence = null, citationLabels = {}, slideW = 960, slideH = 540,
  referencesCount = 0, viewSwitch = null, onShowRuns,
}) {
  const lines = useMemo(() => O.outlineLines(deck, { referencesCount }), [deck, referencesCount])
  const plan = useMemo(() => O.timing(deck), [deck])
  const [focus, setFocus] = useState(null)
  const listRef = useRef(null)
  const opts = useMemo(() => ({ slideW, slideH }), [slideW, slideH])

  // A change to the deck, from the deck as it is now; a change of shape is
  // an undo step of its own, while typing runs together
  const apply = useCallback((op, shape = false) => {
    let result = null
    if (shape) stopCapturing()
    setDeck(prev => {
      if (!prev) return prev
      result = op(prev)
      return result && result.deck ? result.deck : prev
    })
    if (shape) stopCapturing()
    if (result && result.refused) onNotice(result.refused)
    if (result && result.focus) setFocus({ key: result.focus[0], caret: result.focus[1], done: false })
    return result
  }, [setDeck, stopCapturing, onNotice])

  const typed = useCallback((L, v) => {
    if (L.kind === 'slide') apply(d => ({ deck: O.setTitle(d, L.slideId, v, opts) }))
    else if (L.kind === 'point') apply(d => ({ deck: O.setPoint(d, L.slideId, L.j, v) }))
    else if (L.kind === 'note') apply(d => ({ deck: O.setNote(d, L.slideId, L.n, v) }))
    else if (L.kind === 'section') apply(d => ({ deck: O.setSectionName(d, L.slideId, v) }))
  }, [apply, opts])

  // The line before or after one, among those that can be typed into
  const neighbor = useCallback((key, dir) => {
    const texts = Array.from(listRef.current?.querySelectorAll('.ol-text[contenteditable="true"]') || [])
    const at = texts.findIndex(t => t.dataset.key === key)
    return texts[at + dir] || null
  }, [])

  const onKey = useCallback((e, el, L) => {
    if (e.nativeEvent.isComposing) return
    const rich = L.kind === 'slide' || L.kind === 'point'
    const mod = e.ctrlKey || e.metaKey
    if (mod && !e.altKey && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? onRedo?.() : onUndo?.(); return }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); onRedo?.(); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (L.kind === 'section') { const n = neighbor(L.key, 1); if (n) { n.focus(); setCaret(n, 0) } return }
      const [before, after] = splitLine(el, rich)
      apply(d => O.enter(d, L, before, after, opts), true)
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      apply(d => (e.shiftKey ? O.outdent : O.indent)(d, L, opts), true)
      return
    }
    if (e.key === 'Backspace' && window.getSelection().isCollapsed && caretOffset(el) === 0) {
      const empty = rich ? !O.textOf(O.lineHtml(el)) && !el.querySelector('[contenteditable="false"]') : !el.textContent
      const prev = neighbor(L.key, -1)
      const r = O.backspace(deck, L, empty, prev ? prev.dataset.key : null)
      if (!r) return
      e.preventDefault()
      apply(d => O.backspace(d, L, empty, prev ? prev.dataset.key : null) || { deck: d }, true)
      return
    }
    if (e.key === 'ArrowUp' && !e.shiftKey && onFirstLine(el)) {
      const n = neighbor(L.key, -1)
      if (n) { e.preventDefault(); n.focus(); setCaret(n, null); n.scrollIntoView?.({ block: 'nearest' }) }
    } else if (e.key === 'ArrowDown' && !e.shiftKey && onLastLine(el)) {
      const n = neighbor(L.key, 1)
      if (n) { e.preventDefault(); n.focus(); setCaret(n, 0); n.scrollIntoView?.({ block: 'nearest' }) }
    } else if (e.key === 'Escape') el.blur()
  }, [apply, deck, neighbor, onRedo, onUndo, opts])

  const focused = useCallback(L => {
    onLeaveCanvas?.()
    if (L.index !== currentIndex) onSelectSlide?.(L.index)
  }, [currentIndex, onLeaveCanvas, onSelectSlide])

  // The slide shown on the canvas, kept in view when it's chosen elsewhere
  useEffect(() => {
    const list = listRef.current
    if (!list || list.contains(document.activeElement)) return
    const row = list.querySelector('.ol-row.k-slide.cur')
    row?.scrollIntoView?.({ block: 'nearest' })
  }, [currentIndex])

  const sectionMinutes = useMemo(() => new Map(plan.sections.map(s => [s.slideId, s.minutes])), [plan])
  // The latest practice run's time on each slide
  const last = useMemo(() => latestRun(deck), [deck])
  const practiced = useMemo(() => new Map((last?.slides || []).map(s => [s.id, s])), [last])
  const span = Math.max(plan.total, plan.target, 0.1)

  return (
    <div className="slide-panel outline-panel">
      <div className="slide-panel-header">
        {viewSwitch || <span>Outline</span>}
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{deck?.slides?.length || 0}</span>
      </div>
      <div className="ol-plan">
        <div className="ol-plan-row">
          <strong>{fmt(plan.total)}</strong> min planned of
          <input type="number" min="0" step="1" value={plan.target} aria-label="Talk length in minutes" title="The talk’s length, which the footer timer also uses"
            onChange={e => apply(d => ({ deck: O.setTarget(d, e.target.value) }))} />
          min
          <span className={'ol-plan-status' + (plan.total > plan.target && plan.target > 0 ? ' over' : '')}>
            {!plan.target || !plan.total ? '' : plan.total > plan.target ? fmt(plan.total - plan.target) + ' over' : fmt(plan.target - plan.total) + ' to spare'}
          </span>
        </div>
        {last && (
          <button type="button" className="ol-last-run" onClick={onShowRuns} title="See the practice runs">
            Last practice <b>{clock(last.total)}</b>
            {last.target ? <span className={last.total - last.target > 5 ? 'over' : ''}> · {Math.abs(last.total - last.target) < 5 ? 'on time' : last.total > last.target ? clock(last.total - last.target) + ' over' : clock(last.target - last.total) + ' to spare'}</span> : null}
          </button>
        )}
        <div className="ol-bar" aria-hidden="true">
          <div className="ol-segs">
            {plan.sections.filter(s => s.minutes > 0).map(s => <span key={s.slideId} style={{ width: (s.minutes / span * 100) + '%' }} title={(s.label || 'No section') + ': ' + fmt(s.minutes) + ' min'} />)}
          </div>
          {plan.total > plan.target && plan.target > 0 && <div className="ol-over" style={{ left: (plan.target / span * 100) + '%' }} />}
          {plan.target > 0 && <div className="ol-target" style={{ left: (plan.target / span * 100) + '%' }} />}
        </div>
      </div>
      <div className="ol-list" ref={listRef} role="list" aria-label="Outline">
        {lines.map(L => {
          const cur = L.index === currentIndex
          const peer = L.elementId ? editorOf(peers, L.elementId) : null
          const cls = 'ol-row k-' + L.kind + (L.kind === 'point' ? ' lv' + L.level : '') + (cur ? ' cur' : '') + (L.vertical ? ' vertical' : '')
          if (L.kind === 'item' || L.kind === 'references') {
            return (
              <div key={L.key} className={cls} role="listitem">
                <span className="ol-mark">{L.kind === 'item' ? <Lock size={11} /> : <BookOpen size={12} />}</span>
                <button type="button" className="ol-item" title={L.kind === 'item' ? 'Made on the slide: select it there to change it' : 'Made from the deck’s citations'}
                  onClick={() => (L.kind === 'item' ? onSelectElement?.(L.index, L.elementId) : onSelectSlide?.(L.index))}>
                  {L.kind === 'item' ? L.label : 'References · ' + L.count}
                </button>
              </div>
            )
          }
          const rich = L.kind === 'slide' || L.kind === 'point'
          return (
            <div key={L.key} className={cls} role="listitem">
              <span className="ol-mark">
                {L.kind === 'slide' ? <span className="ol-num">{L.vertical ? '↓' : ''}{L.n}</span>
                  : L.kind === 'section' ? '§'
                  : L.kind === 'note' ? <MessageSquare size={11} />
                  : L.level ? '◦' : '•'}
              </span>
              <Text
                value={rich ? L.html : L.text}
                rich={rich}
                labels={citationLabels}
                locked={!!peer}
                placeholder={L.kind === 'section' && !L.text && L.index !== lines[0]?.index ? 'No section · name it' : PLACEHOLDER[L.kind]}
                label={{ section: 'Section', slide: 'Slide ' + L.n + ' title', point: 'Point', note: 'Speaker note' }[L.kind]}
                focus={focus}
                lineKey={L.key}
                onText={v => typed(L, v)}
                onKeyDown={(e, el) => onKey(e, el, L)}
                onFocus={() => focused(L)}
              />
              <span className="ol-meta">
                {peer && <span className="ol-held" title={peer.name + ' is editing this on the slide'} style={{ background: peer.color }} />}
                {L.kind === 'slide' && <Dots people={presence?.get(L.slideId)} />}
                {L.kind === 'slide' && practiced.get(L.slideId)?.seconds > 0 && (() => {
                  const p = practiced.get(L.slideId), m = Number(deck.slides[L.index]?.minutes)
                  return <span className={'ol-practiced' + (m > 0 && p.seconds > m * 60 + 5 ? ' over' : '')} title="Time on this slide in the last practice run">{clock(p.seconds)}</span>
                })()}
                {L.kind === 'slide' && <Minutes value={deck.slides[L.index]?.minutes} n={L.n} onChange={v => apply(d => ({ deck: O.setMinutes(d, L.slideId, v) }))} />}
                {L.kind === 'section' && sectionMinutes.has(L.slideId) && sectionMinutes.get(L.slideId) > 0 && <span className="ol-total">{fmt(sectionMinutes.get(L.slideId))} min</span>}
              </span>
            </div>
          )
        })}
      </div>
      <div className="ol-help">
        <kbd>Enter</kbd> new line · <kbd>Tab</kbd> <kbd>⇧Tab</kbd> level ·{' '}
        <a href="/#docs/tutorials/outline" target="_blank" rel="noopener noreferrer">How to use</a>
      </div>
    </div>
  )
}

const fmt = m => String(Math.round(m * 10) / 10)

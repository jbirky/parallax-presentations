// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The outline: notes for planning a talk, in the left panel in place of the
// slides. Under each slide's title (read from the slide) are its outline
// notes, typed into where they are and kept apart from the slide, which they
// never change (utils/outline.js). Enter, Tab, Shift+Tab and Backspace make
// notes, put notes under notes, start sections, and add and remove blank
// slides.

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import katex from 'katex'
import { BookOpen } from 'lucide-react'
import * as O from '../utils/outline'
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

// ── The cursor in a line of text ──────────────────────────────────────────
function caretOffset(el) {
  const sel = window.getSelection()
  if (!sel.rangeCount || !el.contains(sel.anchorNode)) return null
  const pre = document.createRange()
  pre.selectNodeContents(el)
  const r = sel.getRangeAt(0)
  pre.setEnd(r.startContainer, r.startOffset)
  return pre.toString().length
}
function setCaret(el, off) {
  const sel = window.getSelection(), r = document.createRange()
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let left = off, placed = false
  for (let t = walk.nextNode(); t && off != null; t = walk.nextNode()) {
    if (left <= t.textContent.length) { r.setStart(t, left); placed = true; break }
    left -= t.textContent.length
  }
  if (!placed) { r.selectNodeContents(el); r.collapse(off === 0) } else r.collapse(true)
  sel.removeAllRanges()
  sel.addRange(r)
}
function selectAll(el) {
  const r = document.createRange(), sel = window.getSelection()
  r.selectNodeContents(el)
  sel.removeAllRanges()
  sel.addRange(r)
}
// A line's text before and after the cursor (a selection goes)
function splitLine(el) {
  const sel = window.getSelection()
  if (!sel.rangeCount || !el.contains(sel.anchorNode)) return [el.textContent, '']
  const r = sel.getRangeAt(0)
  const a = document.createRange(), b = document.createRange()
  a.selectNodeContents(el); a.setEnd(r.startContainer, r.startOffset)
  b.selectNodeContents(el); b.setStart(r.endContainer, r.endOffset)
  return [a.toString(), b.toString()]
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
// Moves the focus to a line, the cursor where it's asked for
const go = (el, caret) => { el.focus(); if (el.isContentEditable) setCaret(el, caret); el.scrollIntoView?.({ block: 'nearest' }) }

// Puts the cursor in a line the outline asked for, once
function useFocus(ref, focus, lineKey, editable) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !focus || focus.key !== lineKey || focus.done) return
    focus.done = true
    el.focus({ preventScroll: true })
    if (editable) {
      if (focus.caret === 'all') selectAll(el)
      else setCaret(el, focus.caret === 'start' ? 0 : focus.caret === 'end' || focus.caret == null ? null : focus.caret)
    }
    el.scrollIntoView?.({ block: 'nearest' })
  })
}

// A note or section name, typed into where it is
const Text = memo(function Text({ value, placeholder, label, focus, lineKey, onText, onKeyDown, onFocus }) {
  const ref = useRef(null)
  const shown = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || shown.current === value) return
    const focused = document.activeElement === el
    const at = focused ? caretOffset(el) : null
    el.textContent = value || ''
    shown.current = value
    if (focused) setCaret(el, at)
  }, [value])
  useFocus(ref, focus, lineKey, true)
  return (
    <div
      ref={ref}
      className="ol-text"
      contentEditable
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-label={label}
      data-ph={placeholder}
      data-key={lineKey}
      data-nav=""
      onInput={e => {
        const el = e.currentTarget
        if (el.innerHTML === '<br>') el.innerHTML = ''
        const v = el.textContent.replace(/\n/g, ' ')
        shown.current = v
        onText(v)
      }}
      onKeyDown={e => onKeyDown(e, ref.current)}
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

// A slide's title, as it is on the slide: math drawn by KaTeX, citations by
// their labels. It can't be typed into, but takes the keys that add and
// remove slides and start sections, and keeps them from the editor's own
// shortcuts, which would paste into the slide or undo twice.
const Title = memo(function Title({ html, labels, label, focus, lineKey, onKeyDown, onFocus }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = O.cleanInline(resolveCitationsInHtml(html || '', labels))
    el.querySelectorAll('[data-math-latex]').forEach(m => {
      const tex = m.getAttribute('data-math-latex') || ''
      try { katex.render(tex, m, { throwOnError: false, displayMode: false }) } catch (e) { m.textContent = '$' + tex + '$' }
    })
  }, [html, labels])
  useFocus(ref, focus, lineKey, false)
  return (
    <div ref={ref} className="ol-text ol-title" tabIndex={0} role="heading" aria-level={3} aria-label={label}
      title="The slide’s title: change it on the slide" data-ph="Untitled slide" data-key={lineKey} data-nav=""
      onKeyDown={e => { e.stopPropagation(); onKeyDown(e, ref.current) }} onFocus={onFocus} />
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

export default function OutlinePanel({
  deck, setDeck, stopCapturing = () => {}, onUndo, onRedo, currentIndex = 0, onSelectSlide,
  onLeaveCanvas, onNotice = () => {}, presence = null, citationLabels = {},
  referencesCount = 0, viewSwitch = null, onShowRuns,
}) {
  const lines = useMemo(() => O.outlineLines(deck, { referencesCount }), [deck, referencesCount])
  const plan = useMemo(() => O.timing(deck), [deck])
  const [focus, setFocus] = useState(null)
  const listRef = useRef(null)

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
    if (L.kind === 'note') apply(d => ({ deck: O.setNote(d, L.slideId, L.n, v) }))
    else if (L.kind === 'section') apply(d => ({ deck: O.setSectionName(d, L.slideId, v) }))
  }, [apply])

  // The line before or after one
  const neighbor = useCallback((key, dir) => {
    const texts = Array.from(listRef.current?.querySelectorAll('.ol-text[data-nav]') || [])
    const at = texts.findIndex(t => t.dataset.key === key)
    return texts[at + dir] || null
  }, [])

  const onKey = useCallback((e, el, L) => {
    if (e.nativeEvent.isComposing) return
    const mod = e.ctrlKey || e.metaKey
    const title = L.kind === 'slide'
    if (mod && !e.altKey && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? onRedo?.() : onUndo?.(); return }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); onRedo?.(); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (L.kind === 'section') { const n = neighbor(L.key, 1); if (n) go(n, 0); return }
      const [before, after] = title ? ['', ''] : splitLine(el)
      apply(d => O.enter(d, L, before, after), true)
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      apply(d => (e.shiftKey ? O.outdent : O.indent)(d, L), true)
      return
    }
    if (e.key === 'Backspace' && (title || (window.getSelection().isCollapsed && caretOffset(el) === 0))) {
      const empty = !el.textContent
      if (title) e.preventDefault()
      if (!O.backspace(deck, L, empty)) return
      e.preventDefault()
      apply(d => O.backspace(d, L, empty, neighbor(L.key, -1)?.dataset.key || null) || { deck: d }, true)
      return
    }
    if (e.key === 'ArrowUp' && !e.shiftKey && (title || onFirstLine(el))) {
      const n = neighbor(L.key, -1)
      if (n) { e.preventDefault(); go(n, null) }
    } else if (e.key === 'ArrowDown' && !e.shiftKey && (title || onLastLine(el))) {
      const n = neighbor(L.key, 1)
      if (n) { e.preventDefault(); go(n, 0) }
    } else if (e.key === 'Escape') el.blur()
  }, [apply, deck, neighbor, onRedo, onUndo])

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
          const cls = 'ol-row k-' + L.kind + (L.kind === 'note' ? ' lv' + L.level + (L.blank ? ' blank' : '') : '') + (cur ? ' cur' : '') + (L.vertical ? ' vertical' : '')
          if (L.kind === 'references') {
            return (
              <div key={L.key} className={cls} role="listitem">
                <span className="ol-mark"><BookOpen size={12} /></span>
                <button type="button" className="ol-item" title="Made from the deck’s citations" onClick={() => onSelectSlide?.(L.index)}>
                  {'References · ' + L.count}
                </button>
              </div>
            )
          }
          const onKeyDown = (e, el) => onKey(e, el, L)
          const onFocus = () => focused(L)
          return (
            <div key={L.key} className={cls} role="listitem">
              <span className="ol-mark">
                {L.kind === 'slide' ? <span className="ol-num">{L.vertical ? '↓' : ''}{L.n}</span>
                  : L.kind === 'section' ? '§'
                  : L.level ? '◦' : '•'}
              </span>
              {L.kind === 'slide'
                ? <Title html={L.html} labels={citationLabels} label={'Slide ' + L.n + ': ' + (O.textOf(L.html) || 'Untitled slide')} focus={focus} lineKey={L.key} onKeyDown={onKeyDown} onFocus={onFocus} />
                : <Text
                    value={L.text}
                    placeholder={L.kind === 'section' ? (!L.text && L.index !== lines[0]?.index ? 'No section · name it' : 'Section name') : L.blank ? 'Add a note' : 'Note'}
                    label={L.kind === 'section' ? 'Section' : 'Note'}
                    focus={focus}
                    lineKey={L.key}
                    onText={v => typed(L, v)}
                    onKeyDown={onKeyDown}
                    onFocus={onFocus}
                  />}
              <span className="ol-meta">
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
        Notes here stay in the outline: they never change the slides.<br />
        <kbd>Enter</kbd> new note · <kbd>Tab</kbd> <kbd>⇧Tab</kbd> level ·{' '}
        <a href="/#docs/tutorials/outline" target="_blank" rel="noopener noreferrer">How to use</a>
      </div>
    </div>
  )
}

const fmt = m => String(Math.round(m * 10) / 10)

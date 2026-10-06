// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Practice Talk: the deck presented in a window that times each slide, shows
// the pace against the minutes planned in the outline, and ends with a table
// of the run. The window sends the run to the editor as it goes (as present-
// mode ink is sent), and the editor keeps the last few with the deck, in
// practiceRuns: private to the author, like ink, and never an undo step.

import { generateRevealHTML, openDeckWindow, scriptValue } from './generateHTML'
import { localizeLibraries } from './libraries'
import { outlineLines, textOf } from './outline'

export const PRACTICE_MESSAGE = 'parallax-practice-run'
// Runs kept with a deck, the newest last
export const MAX_RUNS = 10

const newRunId = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'run-' + Date.now().toString(36))

// The slides as the run goes through them: id, number, title, and the
// seconds planned for it (from the outline's minutes), or null
export function practicePlan(deck, { referencesCount = 0 } = {}) {
  const slides = []
  outlineLines(deck, { referencesCount }).forEach(L => {
    if (L.kind === 'slide') {
      const m = Number(deck.slides[L.index] && deck.slides[L.index].minutes)
      slides.push({ id: L.slideId, n: L.n, title: textOf(L.html) || 'Slide ' + L.n, allotted: m > 0 ? Math.round(m * 60) : null })
    } else if (L.kind === 'references') slides.push({ id: 'references', n: L.n, title: 'References', allotted: null })
  })
  const target = Number(deck && deck.timerDuration != null ? deck.timerDuration : 20) || 0
  return { slides, target: target > 0 ? Math.round(target * 60) : null }
}

// Opens the practice window
export function practiceInWindow(presentation, { referencesCount = 0 } = {}) {
  const plan = practicePlan(presentation, { referencesCount })
  const config = { presentationId: presentation.id, message: PRACTICE_MESSAGE, runId: newRunId(), ...plan }
  const deck = localizeLibraries(generateRevealHTML(presentation, { bridge: true }))
  return openDeckWindow(deck, { title: 'Practice · ' + (presentation.title || 'Presentation'), script: '(' + relayPractice.toString() + ')(' + scriptValue(config) + ', frame)' })
}

// A run kept with the deck, replacing the one with its id; the last
// MAX_RUNS stay. Runs under a few seconds aren't kept.
export function upsertPracticeRun(deck, run) {
  if (!deck || !run || typeof run !== 'object' || !run.id || !Array.isArray(run.slides)) return deck
  const clean = {
    id: String(run.id).slice(0, 80),
    startedAt: String(run.startedAt || ''),
    endedAt: String(run.endedAt || ''),
    target: Number(run.target) > 0 ? Number(run.target) : null,
    total: Math.max(0, Number(run.total) || 0),
    slides: run.slides.slice(0, 1000).map(s => ({
      id: String(s.id || ''), n: Number(s.n) || 0, title: String(s.title || '').slice(0, 200),
      allotted: Number(s.allotted) > 0 ? Number(s.allotted) : null, seconds: Math.max(0, Number(s.seconds) || 0),
    })),
  }
  if (clean.total < 3) return deck
  const runs = (deck.practiceRuns || []).filter(r => r.id !== clean.id)
  runs.push(clean)
  runs.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)))
  return { ...deck, practiceRuns: runs.slice(-MAX_RUNS) }
}
export function removePracticeRun(deck, id) {
  return { ...deck, practiceRuns: (deck.practiceRuns || []).filter(r => r.id !== id) }
}
export const latestRun = deck => {
  const runs = (deck && deck.practiceRuns) || []
  return runs.length ? runs[runs.length - 1] : null
}

// Seconds as m:ss (h:mm:ss past an hour); with sign, as a difference
export function clock(seconds, signed = false) {
  const neg = seconds < 0, t = Math.round(Math.abs(seconds))
  const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60
  const body = (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0')
  return (signed ? (neg ? '−' : '+') : neg ? '−' : '') + body
}

// A run's rows against the deck as it is now: each slide's planned and
// practiced seconds, matched by id (a slide since deleted keeps its title)
export function runRows(run) {
  return (run.slides || []).map(s => ({ ...s, diff: s.allotted ? s.seconds - s.allotted : null }))
}
// The planned minutes a run suggests: each slide's practiced time, to the
// nearest half minute (at least half a minute for a slide that was shown)
export function minutesFromRun(deck, run) {
  const byId = new Map((run.slides || []).map(s => [s.id, s.seconds]))
  return {
    ...deck,
    slides: deck.slides.map(s => {
      if (!byId.has(s.id) || !(byId.get(s.id) > 0)) return s
      return { ...s, minutes: Math.max(0.5, Math.round(byId.get(s.id) / 30) / 2) }
    }),
  }
}

// ── The practice window ───────────────────────────────────────────────────
// The page around the deck (openDeckWindow), which has this site's origin:
// counts the time on each slide the deck says it shows, shows it with the
// pace in a box at the top right, and sends the run to the editor. Finish
// shows the run as a table. Injected as source text, so everything it uses
// is inside it.
//
// config: { presentationId, message, runId, slides: [{ id, n, title, allotted }], target }
export function relayPractice(config, frame) {
  const slides = config.slides || []
  const at = {}
  slides.forEach((s, i) => { at[s.id] = i })
  let runId = config.runId, started = Date.now()
  let spent = {}, current = null, since = Date.now(), paused = false, done = false, sendTimer = null

  const clock = (seconds, signed) => {
    const neg = seconds < 0, t = Math.round(Math.abs(seconds))
    const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60
    const body = (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0')
    return (signed ? (neg ? '−' : '+') : neg ? '−' : '') + body
  }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

  // Seconds so far on each slide, the one showing included
  const totals = () => {
    const t = Object.assign({}, spent)
    if (current != null && !paused && !done) t[current] = (t[current] || 0) + (Date.now() - since) / 1000
    return t
  }
  const bank = () => {
    if (current != null && !paused && !done) spent[current] = (spent[current] || 0) + (Date.now() - since) / 1000
    since = Date.now()
  }
  const snapshot = () => {
    const t = totals()
    const rows = slides.map(s => ({ id: s.id, n: s.n, title: s.title, allotted: s.allotted, seconds: Math.round((t[s.id] || 0) * 10) / 10 }))
    const total = Math.round(rows.reduce((a, r) => a + r.seconds, 0) * 10) / 10
    return { id: runId, startedAt: new Date(started).toISOString(), endedAt: new Date().toISOString(), target: config.target || null, total, slides: rows }
  }
  // To the editor that opened this window, which keeps it with the deck
  const send = () => {
    clearTimeout(sendTimer)
    sendTimer = null
    const run = snapshot()
    if (run.total < 3) return false
    const editor = window.opener
    if (!editor || editor.closed) return false
    try { editor.postMessage({ type: config.message, presentationId: config.presentationId, run }, window.location.origin); return true } catch (e) { return false }
  }
  const later = () => { clearTimeout(sendTimer); sendTimer = setTimeout(send, 1500) }

  const style = document.createElement('style')
  style.textContent = [
    '.pp-hud{position:fixed;top:12px;right:12px;z-index:99999;display:flex;align-items:center;gap:12px;padding:8px 8px 8px 12px;border-radius:10px;background:rgba(15,15,23,0.9);color:#e2e8f0;font:13px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 4px 18px rgba(0,0,0,0.45);font-variant-numeric:tabular-nums;border:1px solid rgba(255,255,255,0.08)}',
    '.pp-hud .pp-col{display:grid;gap:5px;min-width:132px}',
    '.pp-hud .pp-line{display:flex;gap:6px;align-items:baseline;white-space:nowrap}',
    '.pp-hud .pp-dim{color:#94a3b8;font-size:11px}',
    '.pp-hud .pp-big{font-weight:650;font-size:15px}',
    '.pp-hud .pp-bar{height:4px;border-radius:2px;background:rgba(255,255,255,0.12);overflow:hidden}',
    '.pp-hud .pp-bar i{display:block;height:100%;width:0;background:#818cf8}',
    '.pp-hud .pp-col.over .pp-bar i{background:#f59e0b}.pp-hud .pp-col.over .pp-big{color:#fbbf24}',
    '.pp-hud .pp-pace{font-size:11px;color:#94a3b8}.pp-hud .pp-pace.behind{color:#fbbf24}.pp-hud .pp-pace.ahead{color:#4ade80}',
    '.pp-hud button,.pp-sum button{font:inherit;font-size:12px;color:#e2e8f0;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:6px;padding:5px 10px;cursor:pointer}',
    '.pp-hud button:hover,.pp-sum button:hover{background:rgba(255,255,255,0.16)}',
    '.pp-hud .pp-finish,.pp-sum .pp-primary{background:#6366f1;border-color:#6366f1}',
    '.pp-hud.paused .pp-big{color:#94a3b8}',
    '.pp-sum{position:fixed;inset:0;z-index:100000;overflow:auto;background:#0f0f17;color:#e2e8f0;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:36px 20px}',
    '.pp-sum .pp-in{max-width:860px;margin:0 auto}',
    '.pp-sum h1{font-size:22px;margin:0 0 4px;font-weight:650}',
    '.pp-sum .pp-lead{color:#94a3b8;margin:0 0 20px;font-variant-numeric:tabular-nums}.pp-sum .pp-lead b{color:#e2e8f0}',
    '.pp-sum table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}',
    '.pp-sum th{text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;padding:6px 8px;border-bottom:1px solid #2a2a4a}',
    '.pp-sum td{padding:7px 8px;border-bottom:1px solid #1e1e3a;vertical-align:middle}',
    '.pp-sum td.num,.pp-sum th.num{text-align:right;white-space:nowrap}',
    '.pp-sum td.title{max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.pp-sum .over{color:#fbbf24}.pp-sum .under{color:#4ade80}.pp-sum .none{color:#64748b}',
    '.pp-sum .pp-b{position:relative;height:10px;min-width:120px;background:rgba(255,255,255,0.05);border-radius:3px}',
    '.pp-sum .pp-b i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:#818cf8}',
    '.pp-sum .pp-b i.o{background:#f59e0b}',
    '.pp-sum .pp-b u{position:absolute;top:-3px;bottom:-3px;width:2px;background:#e2e8f0;text-decoration:none}',
    '.pp-sum .pp-acts{display:flex;gap:8px;margin-top:22px;align-items:center;flex-wrap:wrap}',
    '.pp-sum .pp-note{color:#64748b;font-size:12px}',
  ].join('\n')
  document.head.appendChild(style)

  const hud = document.createElement('div')
  hud.className = 'pp-hud'
  hud.setAttribute('role', 'status')
  hud.innerHTML = '<div class="pp-col pp-this"><div class="pp-line"><span class="pp-dim pp-which">Slide</span><span class="pp-big pp-st">0:00</span><span class="pp-dim pp-alloc"></span></div><div class="pp-bar"><i></i></div></div>' +
    '<div class="pp-col"><div class="pp-line"><span class="pp-dim">Talk</span><span class="pp-big pp-tt">0:00</span><span class="pp-dim pp-target"></span></div><div class="pp-pace"></div></div>' +
    '<button type="button" class="pp-pause">Pause</button><button type="button" class="pp-finish">Finish</button>'
  document.body.appendChild(hud)
  const $ = sel => hud.querySelector(sel)

  // The pace: time on the slides before this one, against what was planned for them
  const pace = t => {
    const i = current != null && at[current] != null ? at[current] : -1
    let delta = 0, planned = false
    for (let k = 0; k < i; k++) if (slides[k].allotted) { planned = true; delta += (t[slides[k].id] || 0) - slides[k].allotted }
    return planned ? delta : null
  }
  function draw() {
    const t = totals()
    const s = current != null && at[current] != null ? slides[at[current]] : null
    const here = current != null ? t[current] || 0 : 0
    $('.pp-which').textContent = s ? 'Slide ' + s.n : 'Slide'
    $('.pp-st').textContent = clock(here)
    $('.pp-alloc').textContent = s && s.allotted ? 'of ' + clock(s.allotted) : ''
    $('.pp-bar i').style.width = s && s.allotted ? Math.min(100, here / s.allotted * 100) + '%' : '0'
    $('.pp-this').classList.toggle('over', !!(s && s.allotted && here > s.allotted))
    const total = Object.keys(t).reduce((a, k) => a + t[k], 0)
    $('.pp-tt').textContent = clock(total)
    $('.pp-target').textContent = config.target ? 'of ' + clock(config.target) : ''
    const d = pace(t), p = $('.pp-pace')
    p.className = 'pp-pace' + (d == null || Math.abs(d) < 5 ? '' : d > 0 ? ' behind' : ' ahead')
    p.textContent = d == null ? '' : Math.abs(d) < 5 ? 'On pace' : d > 0 ? clock(d) + ' behind plan' : clock(-d) + ' ahead of plan'
    hud.classList.toggle('paused', paused)
  }

  window.addEventListener('message', e => {
    if (e.source !== frame.contentWindow || !e.data || e.data.type !== 'parallax-deck' || done) return
    const id = e.data.id != null ? String(e.data.id) : slides[e.data.slide] ? slides[e.data.slide].id : null
    if (id == null || id === current) return
    bank()
    current = id
    draw()
    later()
  })
  $('.pp-pause').addEventListener('click', () => {
    bank()
    paused = !paused
    $('.pp-pause').textContent = paused ? 'Resume' : 'Pause'
    draw()
    send()
    frame.focus()
  })

  let summary = null
  function finish() {
    bank()
    done = true
    clearInterval(ticker)
    const sent = send()
    const run = snapshot()
    hud.style.display = 'none'
    summary = document.createElement('div')
    summary.className = 'pp-sum'
    const longest = Math.max(1, ...run.slides.map(r => Math.max(r.seconds, r.allotted || 0)))
    const rows = run.slides.map(r => {
      const diff = r.allotted ? r.seconds - r.allotted : null
      const cls = diff == null ? 'none' : diff > 5 ? 'over' : diff < -5 ? 'under' : ''
      return '<tr><td class="num">' + r.n + '</td><td class="title">' + esc(r.title) + '</td>' +
        '<td class="num">' + (r.allotted ? clock(r.allotted) : '<span class="none">–</span>') + '</td>' +
        '<td class="num">' + (r.seconds ? clock(r.seconds) : '<span class="none">skipped</span>') + '</td>' +
        '<td class="num ' + cls + '">' + (diff == null ? '' : clock(diff, true)) + '</td>' +
        '<td><div class="pp-b"><i class="' + (r.allotted && r.seconds > r.allotted + 5 ? 'o' : '') + '" style="width:' + (r.seconds / longest * 100) + '%"></i>' +
        (r.allotted ? '<u style="left:' + (r.allotted / longest * 100) + '%"></u>' : '') + '</div></td></tr>'
    }).join('')
    const over = config.target ? run.total - config.target : null
    summary.innerHTML = '<div class="pp-in"><h1>Practice run</h1>' +
      '<p class="pp-lead"><b>' + clock(run.total) + '</b>' + (config.target ? ' of ' + clock(config.target) + ' · ' + (Math.abs(over) < 5 ? 'right on time' : over > 0 ? '<span class="over">' + clock(over) + ' over</span>' : '<span class="under">' + clock(-over) + ' to spare</span>') : '') + '</p>' +
      '<table><thead><tr><th class="num">#</th><th>Slide</th><th class="num">Planned</th><th class="num">Practice</th><th class="num">Difference</th><th>Time</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="pp-acts"><button type="button" class="pp-primary pp-again">Practice again</button><button type="button" class="pp-close">Close</button>' +
      '<span class="pp-note">' + (sent ? 'Saved with the deck: in the editor, Present ▾ → Practice runs.' : run.total < 3 ? 'Too short to keep.' : 'The editor that opened this window is closed, so this run wasn’t saved.') + '</span></div></div>'
    document.body.appendChild(summary)
    summary.querySelector('.pp-again').addEventListener('click', again)
    summary.querySelector('.pp-close').addEventListener('click', () => window.close())
  }
  function again() {
    if (summary) { summary.remove(); summary = null }
    runId = 'run-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    started = Date.now()
    spent = {}
    paused = false
    done = false
    since = Date.now()
    $('.pp-pause').textContent = 'Pause'
    hud.style.display = ''
    ticker = setInterval(draw, 250)
    try { frame.contentWindow.postMessage({ type: 'parallax-deck-go', slide: 0 }, '*') } catch (e) { /* the deck stays where it is */ }
    frame.focus()
    draw()
  }
  $('.pp-finish').addEventListener('click', finish)
  let ticker = setInterval(draw, 250)
  draw()
  // Closing the window keeps the run
  window.addEventListener('pagehide', () => { if (!done) { bank(); send() } })
  return { finish, again, snapshot }
}

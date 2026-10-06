// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { practicePlan, upsertPracticeRun, removePracticeRun, latestRun, clock, runRows, minutesFromRun, relayPractice, MAX_RUNS } from './practice'

const text = (id, content) => ({ id, type: 'text', x: 0, y: 0, width: 800, height: 400, content })
const deck = {
  id: 'p1', timerDuration: 12,
  slides: [
    { id: 'a', minutes: 1.5, elements: [text('t1', '<h1>Why galaxies spin</h1>')] },
    { id: 'b', elements: [text('t2', '<p>no heading</p>')] },
    { id: 'c', minutes: 0.25, elements: [text('t3', '<h2>Takeaways</h2>')] },
  ],
}

describe('the plan a practice run follows', () => {
  it('has each slide’s title and planned seconds, the references last, and the talk’s length', () => {
    expect(practicePlan(deck, { referencesCount: 2 })).toEqual({
      target: 720,
      slides: [
        { id: 'a', n: 1, title: 'Why galaxies spin', allotted: 90 },
        { id: 'b', n: 2, title: 'Slide 2', allotted: null },
        { id: 'c', n: 3, title: 'Takeaways', allotted: 15 },
        { id: 'references', n: 4, title: 'References', allotted: null },
      ],
    })
    expect(practicePlan({ ...deck, timerDuration: 0 }).target).toBeNull()
  })
})

describe('runs kept with the deck', () => {
  const run = (id, startedAt, total = 60, extra = {}) => ({ id, startedAt, endedAt: startedAt, target: 720, total, slides: [{ id: 'a', n: 1, title: 'A', allotted: 90, seconds: total }], ...extra })

  it('replaces a run sent again as it goes, and keeps the newest few', () => {
    let d = upsertPracticeRun(deck, run('r1', '2026-10-05T10:00:00Z', 20))
    d = upsertPracticeRun(d, run('r1', '2026-10-05T10:00:00Z', 95))
    expect(d.practiceRuns).toHaveLength(1)
    expect(d.practiceRuns[0].total).toBe(95)
    for (let i = 0; i < MAX_RUNS + 3; i++) d = upsertPracticeRun(d, run('x' + i, '2026-10-06T10:' + String(i).padStart(2, '0') + ':00Z'))
    expect(d.practiceRuns).toHaveLength(MAX_RUNS)
    expect(latestRun(d).id).toBe('x' + (MAX_RUNS + 2))
    expect(removePracticeRun(d, latestRun(d).id).practiceRuns).toHaveLength(MAX_RUNS - 1)
  })

  it('keeps only what a run is, and not runs of a moment', () => {
    const d = upsertPracticeRun(deck, run('r1', '2026-10-05T10:00:00Z', 60, { evil: '<script>', slides: [{ id: 'a', title: 'A'.repeat(500), seconds: -4, allotted: 'x', html: '<img>' }] }))
    expect(d.practiceRuns[0]).toEqual({ id: 'r1', startedAt: '2026-10-05T10:00:00Z', endedAt: '2026-10-05T10:00:00Z', target: 720, total: 60, slides: [{ id: 'a', n: 0, title: 'A'.repeat(200), allotted: null, seconds: 0 }] })
    expect(upsertPracticeRun(deck, run('r2', '2026-10-05T10:00:00Z', 1))).toBe(deck)
    expect(upsertPracticeRun(deck, { id: 'r3' })).toBe(deck)
  })

  it('reads a run against its plan, and plans from it', () => {
    const r = run('r1', '2026-10-05T10:00:00Z', 0, { slides: [{ id: 'a', n: 1, title: 'A', allotted: 90, seconds: 130 }, { id: 'b', n: 2, title: 'B', allotted: null, seconds: 44 }, { id: 'c', n: 3, title: 'C', allotted: 15, seconds: 0 }] })
    expect(runRows(r).map(x => x.diff)).toEqual([40, null, -15])
    // To the half minute, at least half a minute; a slide not reached keeps its plan
    expect(minutesFromRun(deck, r).slides.map(s => s.minutes)).toEqual([2, 0.5, 0.25])
  })

  it('writes times as a clock', () => {
    expect([clock(0), clock(59.6), clock(61), clock(3725), clock(-75), clock(40, true), clock(-15, true)]).toEqual(['0:00', '1:00', '1:01', '1:02:05', '−1:15', '+0:40', '−0:15'])
  })
})

describe('the practice window', () => {
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; document.head.innerHTML = '' })
  function open() {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-05T10:00:00Z'))
    const frame = { contentWindow: { postMessage: vi.fn() }, focus: vi.fn() }
    const opener = { closed: false, postMessage: vi.fn() }
    Object.defineProperty(window, 'opener', { value: opener, configurable: true })
    const plan = practicePlan(deck)
    const api = relayPractice({ presentationId: 'p1', message: 'parallax-practice-run', runId: 'run1', ...plan }, frame)
    const show = (id, source = frame.contentWindow) => window.dispatchEvent(new MessageEvent('message', { data: { type: 'parallax-deck', slide: 0, id }, source }))
    const hud = sel => document.querySelector('.pp-hud ' + sel).textContent
    return { api, frame, opener, show, hud }
  }

  it('times each slide the deck shows, and the talk, against the plan', () => {
    const { api, show, hud } = open()
    show('a')
    vi.advanceTimersByTime(100000)
    expect(hud('.pp-which')).toBe('Slide 1')
    expect(hud('.pp-st')).toBe('1:40')
    expect(hud('.pp-alloc')).toBe('of 1:30')
    expect(document.querySelector('.pp-this').classList.contains('over')).toBe(true)
    show('c')
    vi.advanceTimersByTime(5000)
    expect(hud('.pp-tt')).toBe('1:45')
    expect(hud('.pp-target')).toBe('of 12:00')
    expect(hud('.pp-pace')).toBe('0:10 behind plan')
    // Only its own deck is heard
    show('b', {})
    expect(hud('.pp-which')).toBe('Slide 3')
    expect(api.snapshot().slides.map(s => s.seconds)).toEqual([100, 0, 5])
  })

  it('doesn’t count paused time', () => {
    const { api, show } = open()
    show('a')
    vi.advanceTimersByTime(10000)
    document.querySelector('.pp-pause').click()
    vi.advanceTimersByTime(60000)
    expect(document.querySelector('.pp-pause').textContent).toBe('Resume')
    document.querySelector('.pp-pause').click()
    vi.advanceTimersByTime(5000)
    expect(api.snapshot().slides[0].seconds).toBe(15)
  })

  it('sends the run to the editor as it goes and when it ends, then shows it as a table', () => {
    const { opener, show } = open()
    show('a')
    vi.advanceTimersByTime(30000)
    show('b')
    vi.advanceTimersByTime(1600)
    expect(opener.postMessage).toHaveBeenCalledTimes(1)
    const [msg, origin] = opener.postMessage.mock.calls[0]
    expect(origin).toBe(window.location.origin)
    expect(msg).toMatchObject({ type: 'parallax-practice-run', presentationId: 'p1', run: { id: 'run1', target: 720 } })
    expect(msg.run.slides.map(s => s.seconds)).toEqual([30, 1.5, 0])
    vi.advanceTimersByTime(20000)
    document.querySelector('.pp-finish').click()
    expect(opener.postMessage).toHaveBeenCalledTimes(2)
    const rows = [...document.querySelectorAll('.pp-sum tbody tr')].map(tr => [...tr.children].slice(0, 5).map(td => td.textContent))
    expect(rows).toEqual([['1', 'Why galaxies spin', '1:30', '0:30', '−1:00'], ['2', 'Slide 2', '–', '0:22', ''], ['3', 'Takeaways', '0:15', 'skipped', '−0:15']])
    expect(document.querySelector('.pp-sum .pp-lead').textContent).toBe('0:52 of 12:00 · 11:08 to spare')
    expect(document.querySelector('.pp-note').textContent).toMatch(/Saved with the deck/)
  })

  it('starts again from the first slide as a new run', () => {
    const { api, frame, show } = open()
    show('a')
    vi.advanceTimersByTime(10000)
    api.finish()
    api.again()
    expect(frame.contentWindow.postMessage).toHaveBeenCalledWith({ type: 'parallax-deck-go', slide: 0 }, '*')
    expect(document.querySelector('.pp-sum')).toBeNull()
    vi.advanceTimersByTime(4000)
    const s = api.snapshot()
    expect(s.id).not.toBe('run1')
    expect(s.slides[0].seconds).toBe(4)
  })
})

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Practice Talk on the landing page: a sample ten-minute talk to rehearse at
// 20× speed, with the timer, the run's table and the outline as the editor
// has them (utils/practice.js): each slide's time against its planned
// minutes, the talk's time against its length, the pace from the slides
// before this one, and Plan from this run, to the half minute. It moves on
// at a sample run's pace; Next slide moves on sooner.

import { useEffect, useRef, useState } from 'react'
import { clock } from '../../utils/practice'
import { track } from '../../utils/analytics'
import { MiniSlide } from './TalkSlide'

export { MiniSlide }

export const SPEED = 20
export const TARGET = 600
export const TALK = [
  { title: 'Why galaxies spin too fast', minutes: 0.5, run: 28, kind: 'hero', field: 'Astronomy', text: 'The visible disk alone says outer stars should slow down. They don’t: a dark halo keeps the curve flat.' },
  { title: 'Missing mass, twice', minutes: 2, run: 150, kind: 'list', items: ['Coma’s galaxies move too fast for their light', 'Andromeda’s rotation curve stays flat far past its light', 'Both point to the same unseen matter'] },
  { title: 'How much is missing', minutes: 3, run: 222, kind: 'number', number: '84', unit: '%', caption: 'of the matter in the universe is dark', source: 'Planck Collaboration 2020, A&A, 641, A6' },
  { title: 'What a halo predicts', minutes: 2.5, run: 128, kind: 'list', items: ['Rotation curves that stay flat far out', 'More lensing than the light can explain', 'About five times as much dark matter as ordinary matter'] },
  { title: 'What’s next', minutes: 1, run: 52, kind: 'list', items: ['Direct detection underground', 'Searches at colliders', 'Questions'] },
]

// As Plan from this run does (practice.js minutesFromRun): a slide's time to
// the half minute, at least half a minute; a skipped slide keeps its plan
export const planFrom = (minutes, seconds) => (seconds > 0 ? Math.max(0.5, Math.round(seconds / 30) / 2) : minutes)

const minutesText = m => `${m % 1 ? m.toFixed(1) : m} min`

export default function PracticeDemo() {
  const [plan, setPlan] = useState(() => TALK.map(s => s.minutes))
  const [changed, setChanged] = useState([])
  const [state, setState] = useState('ready') // ready, running, done
  const [at, setAt] = useState(0)
  const [paused, setPaused] = useState(false)
  const [times, setTimes] = useState(() => TALK.map(() => 0))
  const [lastRun, setLastRun] = useState(null)
  const live = useRef({ at: 0, times: [], paused: false, last: 0 })

  const finish = () => {
    const run = live.current.times.map(t => Math.round(t))
    setTimes(run)
    setLastRun(run)
    setState('done')
    track('practice-demo', { did: 'finish' })
  }
  const next = () => {
    const l = live.current
    if (l.at >= TALK.length - 1) return finish()
    l.at += 1
    setAt(l.at)
  }
  const start = () => {
    live.current = { at: 0, times: TALK.map(() => 0), paused: false, last: performance.now() }
    setTimes(live.current.times.slice())
    setAt(0)
    setPaused(false)
    setChanged([])
    setState('running')
    track('practice-demo', { did: 'start' })
  }

  // Time runs while a slide shows, 20 seconds of talk a second
  useEffect(() => {
    if (state !== 'running') return
    const timer = setInterval(() => {
      const l = live.current, now = performance.now()
      const dt = (now - l.last) / 1000 * SPEED
      l.last = now
      if (l.paused) return
      l.times[l.at] += dt
      if (l.times[l.at] >= TALK[l.at].run) next()
      setTimes(l.times.slice())
    }, 100)
    return () => clearInterval(timer)
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePause = () => {
    const l = live.current
    l.paused = !l.paused
    l.last = performance.now()
    setPaused(l.paused)
  }
  const planFromRun = () => {
    if (!lastRun) return
    const next = plan.map((m, i) => planFrom(m, lastRun[i]))
    setChanged(next.map((m, i) => m !== plan[i]))
    setPlan(next)
    track('practice-demo', { did: 'plan' })
  }

  const here = times[at] || 0
  const allotted = plan[at] * 60
  const total = times.reduce((a, b) => a + b, 0)
  // The pace: time on the slides before this one, against what was planned for them
  let pace = null
  if (at > 0) { pace = 0; for (let k = 0; k < at; k++) pace += times[k] - plan[k] * 60 }
  const paceClass = pace == null || Math.abs(pace) < 5 ? '' : pace > 0 ? ' behind' : ' ahead'
  const paceText = pace == null ? '' : Math.abs(pace) < 5 ? 'On pace' : pace > 0 ? `${clock(pace)} behind plan` : `${clock(-pace)} ahead of plan`
  const planned = plan.reduce((a, m) => a + m * 60, 0)
  const runTotal = lastRun ? lastRun.reduce((a, b) => a + b, 0) : 0
  const longest = lastRun ? Math.max(1, ...TALK.map((_, i) => Math.max(lastRun[i], plan[i] * 60))) : 1

  return (
    <div className="lp-practice" id="practice">
      <header>
        <div className="lp-label">Rehearse</div>
        <h3>Time every slide against your plan</h3>
        <p>Choose Present ▾ › Practice Talk and your deck opens with a timer: the slide’s time against the minutes you planned for it, the talk’s time against its length, and whether you’re ahead of or behind the plan. Finish to see the run slide by slide, then plan the next one from it.</p>
      </header>
      <div className="lp-pr-grid">
        <div className="lp-pr-window">
          <div className="lp-pr-chrome"><i /><i /><i /><span>Practice Talk · Dark matter in ten minutes</span><em>Here at {SPEED}× speed</em></div>
          <div className={`lp-pr-stage${state === 'done' ? ' done' : ''}`}>
            {state !== 'done' && <div className="lp-pr-slide"><MiniSlide slide={TALK[at]} /></div>}
            {state === 'running' && (
              <div className="lp-pr-hud" role="group" aria-label="Practice timer">
                <div className={`lp-pr-col${here > allotted ? ' over' : ''}`}>
                  <div className="lp-pr-line"><span>Slide {at + 1}</span><b>{clock(here)}</b><span>of {clock(allotted)}</span></div>
                  <div className="lp-pr-bar"><i style={{ width: `${Math.min(100, here / allotted * 100)}%` }} /></div>
                </div>
                <div className="lp-pr-col">
                  <div className="lp-pr-line"><span>Talk</span><b>{clock(total)}</b><span>of {clock(TARGET)}</span></div>
                  <div className={`lp-pr-pace${paceClass}`}>{paceText}</div>
                </div>
                <button type="button" onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
                <button type="button" onClick={finish}>Finish</button>
              </div>
            )}
            {state === 'ready' && <div className="lp-pr-start"><button type="button" className="lp-btn primary" onClick={start}>▶ Start practicing</button></div>}
            {state === 'done' && (
              <div className="lp-pr-sum">
                <h4>Practice run</h4>
                <p className="lp-pr-lead"><b>{clock(runTotal)}</b> of {clock(TARGET)} · {Math.abs(runTotal - TARGET) < 5 ? 'right on time'
                  : runTotal > TARGET ? <span className="over">{clock(runTotal - TARGET)} over</span> : <span className="under">{clock(TARGET - runTotal)} to spare</span>}</p>
                <div className="lp-pr-table">
                  <table>
                    <thead><tr><th className="num">#</th><th>Slide</th><th className="num">Planned</th><th className="num">Practice</th><th className="num">Difference</th><th>Time</th></tr></thead>
                    <tbody>{TALK.map((s, i) => {
                      const p = plan[i] * 60, sec = lastRun[i], diff = sec - p
                      return (
                        <tr key={s.title}>
                          <td className="num">{i + 1}</td><td className="t">{s.title}</td>
                          <td className="num">{clock(p)}</td><td className="num">{sec ? clock(sec) : 'skipped'}</td>
                          <td className={`num${diff > 5 ? ' over' : diff < -5 ? ' under' : ''}`}>{clock(diff, true)}</td>
                          <td><div className="lp-pr-b"><i className={sec > p + 5 ? 'o' : undefined} style={{ width: `${sec / longest * 100}%` }} /><u style={{ left: `${p / longest * 100}%` }} /></div></td>
                        </tr>
                      )
                    })}</tbody>
                  </table>
                </div>
                <div className="lp-pr-acts"><button type="button" className="lp-btn primary" onClick={start}>Practice again</button><span>In the editor, runs are kept with the deck: Present ▾ › Practice runs.</span></div>
              </div>
            )}
          </div>
          <div className="lp-pr-controls">
            <button type="button" className="lp-btn ghost" disabled={state !== 'running'} onClick={next}>Next slide →</button>
            <span>{state === 'done' ? 'Practice again to run the talk once more, or plan the next run from this one.' : 'It moves on by itself, at the pace of a sample run. Click Next slide to go on sooner.'}</span>
          </div>
        </div>
        <aside className="lp-pr-outline" aria-label="The talk’s outline">
          <div className="lp-pr-outline-head"><b>Outline</b><span>{clock(planned)} planned · {clock(TARGET)} talk</span></div>
          <ol>{TALK.map((s, i) => {
            const practiced = lastRun ? lastRun[i] : 0
            return (
              <li key={s.title} className={state === 'running' && i === at ? 'cur' : undefined}>
                <span className="n">{i + 1}</span><span className="t">{s.title}</span>
                <span className={`m${changed[i] ? ' changed' : ''}`}>{minutesText(plan[i])}</span>
                <span className={`pt${practiced > plan[i] * 60 + 5 ? ' over' : ''}`} title={practiced ? 'Time on this slide in the last practice run' : undefined}>{practiced ? clock(practiced) : ''}</span>
              </li>
            )
          })}</ol>
          <div className="lp-pr-outline-foot">
            {lastRun ? (<>
              <span>Last practice <b>{clock(runTotal)}</b>. {changed.length ? 'Planned minutes now follow it. Practice again to try the new plan.' : 'Plan from this run sets each slide’s minutes to its time, to the half minute.'}</span>
              {!changed.length && <button type="button" className="lp-btn ghost" onClick={planFromRun}>Plan from this run</button>}
            </>) : <span>Each slide’s planned minutes. After a run, its time shows beside them, red when it ran over.</span>}
          </div>
        </aside>
      </div>
    </div>
  )
}

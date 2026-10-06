// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A deck's practice runs (utils/practice.js): each run's time on every slide
// against the minutes planned in the outline. A run's times can become the
// plan. The editor does the work; this only shows the runs.

import { useState } from 'react'
import { Timer, Trash2, X, Wand2 } from 'lucide-react'
import { clock, runRows } from '../utils/practice'

const when = run => new Date(run.startedAt || run.endedAt)
  .toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function verdict(run) {
  if (!run.target) return ''
  const d = run.total - run.target
  if (Math.abs(d) < 5) return 'right on time'
  return d > 0 ? clock(d) + ' over' : clock(-d) + ' to spare'
}

export default function PracticeRunsModal({ runs, onPractice, onUsePlan, onDelete, onClose }) {
  const newest = runs.slice().reverse()
  const [chosen, setChosen] = useState(newest[0]?.id || null)
  const run = newest.find(r => r.id === chosen) || newest[0] || null
  const rows = run ? runRows(run) : []
  const longest = Math.max(1, ...rows.map(r => Math.max(r.seconds, r.allotted || 0)))
  const planned = rows.some(r => r.allotted)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal practice-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Practice runs">
        <div className="pr-head">
          <h2>Practice runs</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }} aria-label="Close"><X size={16} /></button>
        </div>
        <p className="pr-lead">
          The time spent on each slide each time you practiced, against the minutes planned for it in the outline. Only you see these; they aren’t published, shared or kept in versions.
        </p>
        {!run ? (
          <div className="pr-empty">
            <p>No practice runs yet.</p>
            <button className="btn btn-primary" onClick={onPractice}><Timer size={14} /> Practice the talk</button>
          </div>
        ) : (
          <div className="pr-body">
            <div className="pr-runs" role="listbox" aria-label="Runs">
              {newest.map((r, i) => {
                const d = r.target ? r.total - r.target : 0
                return (
                  <button key={r.id} role="option" aria-selected={r.id === run.id} className={'pr-run' + (r.id === run.id ? ' on' : '')} onClick={() => setChosen(r.id)}>
                    <span className="pr-when">{when(r)}{i === 0 ? ' · latest' : ''}</span>
                    <span className="pr-total"><b>{clock(r.total)}</b>{r.target ? <span className={d > 5 ? 'over' : d < -5 ? 'under' : ''}> {verdict(r)}</span> : null}</span>
                  </button>
                )
              })}
            </div>
            <div className="pr-detail">
              <div className="pr-sum">
                <b>{clock(run.total)}</b>{run.target ? <> of {clock(run.target)} · <span className={run.total - run.target > 5 ? 'over' : run.total - run.target < -5 ? 'under' : ''}>{verdict(run)}</span></> : null}
              </div>
              <div className="pr-table-wrap">
                <table className="pr-table">
                  <thead><tr><th className="num">#</th><th>Slide</th><th className="num">Planned</th><th className="num">Practice</th><th className="num">±</th><th aria-label="Time" /></tr></thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id + r.n}>
                        <td className="num dim">{r.n}</td>
                        <td className="title" title={r.title}>{r.title}</td>
                        <td className="num">{r.allotted ? clock(r.allotted) : <span className="dim">–</span>}</td>
                        <td className="num">{r.seconds ? clock(r.seconds) : <span className="dim">skipped</span>}</td>
                        <td className={'num ' + (r.diff == null ? '' : r.diff > 5 ? 'over' : r.diff < -5 ? 'under' : '')}>{r.diff == null ? '' : clock(r.diff, true)}</td>
                        <td className="bar">
                          <div className="pr-bar">
                            <i className={r.allotted && r.seconds > r.allotted + 5 ? 'o' : ''} style={{ width: (r.seconds / longest * 100) + '%' }} />
                            {r.allotted ? <u style={{ left: (r.allotted / longest * 100) + '%' }} /> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pr-acts">
                <button className="btn btn-primary" onClick={onPractice}><Timer size={14} /> Practice again</button>
                <button className="btn btn-secondary" onClick={() => onUsePlan(run)} title={planned ? 'Each slide’s planned minutes become its time in this run, to the half minute' : 'Each slide gets its time in this run as its planned minutes, to the half minute'}>
                  <Wand2 size={14} /> Plan from this run
                </button>
                <span className="grow" />
                <button className="btn btn-ghost" onClick={() => onDelete(run.id)} title="Delete this run"><Trash2 size={14} /> Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

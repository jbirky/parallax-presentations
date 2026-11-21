// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The getting-started checklist's card, above the slide list
// (utils/gettingStarted.js). A step not done yet is a button that does it,
// or shows where it's done.

import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react'
import { STEPS, useChecklist, dismissChecklist } from '../utils/gettingStarted'

export default function GettingStarted({ onStep }) {
  const state = useChecklist()
  const [open, setOpen] = useState(true)
  const done = STEPS.filter(s => state.done[s.id]).length
  const all = done === STEPS.length
  return (
    <section className="getting-started" aria-labelledby="getting-started-title">
      <div className="getting-started-head">
        <button type="button" className="getting-started-toggle" aria-expanded={open} onClick={() => setOpen(v => !v)}>
          {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
          <span id="getting-started-title">Getting started</span>
          <span className="getting-started-count">{done} of {STEPS.length}</span>
        </button>
        <button type="button" className="btn-icon" style={{ width: 22, height: 22 }} title="Close the checklist (Help brings it back)" aria-label="Close the checklist" onClick={dismissChecklist}>
          <X size={13} />
        </button>
      </div>
      <div className="getting-started-bar" aria-hidden="true"><span style={{ width: `${(done / STEPS.length) * 100}%` }} /></div>
      {open && (all
        ? <p className="getting-started-done">You’re all set. Help › Search the menus finds anything else.</p>
        : (
          <ul>
            {STEPS.map(step => {
              const ticked = !!state.done[step.id]
              return (
                <li key={step.id}>
                  <button type="button" className={ticked ? 'ticked' : undefined} disabled={ticked} onClick={() => onStep?.(step.id)}
                    aria-label={`${step.label}${ticked ? ', done' : ''}`}>
                    <span className="getting-started-check" aria-hidden="true">{ticked && <Check size={10} />}</span>
                    {step.label}
                  </button>
                </li>
              )
            })}
          </ul>
        ))}
    </section>
  )
}

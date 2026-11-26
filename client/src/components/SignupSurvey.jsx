// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The optional questions an account is asked once on the dashboard, and from
// "About you" in the account menu after (server/services/signup-survey.js,
// which also holds the questions and their choices). Every question can be
// left out; Skip passes without answering, and isn't asked again.

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { api } from '../utils/api'

// The answers as the server keeps them, from the form's state
function toBody(questions, picked, other) {
  const body = {}
  for (const q of questions) {
    if (q.kind === 'many') {
      body[q.id] = [...(picked[q.id] || [])]
      body.reasonOther = (picked[q.id] || []).includes('other') ? other[q.id] || '' : ''
    } else {
      body[q.id] = picked[q.id] || null
      body[`${q.id}Other`] = picked[q.id] === 'other' ? other[q.id] || '' : ''
    }
  }
  return body
}

// The form's state from saved answers
function fromAnswers(questions, answers) {
  const picked = {}
  const other = {}
  if (!answers || answers.skipped && !answers.field && !answers.careerStage && !(answers.reasons || []).length && !answers.heardFrom) return { picked, other }
  for (const q of questions) {
    if (q.kind === 'many') {
      picked[q.id] = answers[q.id] || []
      other[q.id] = answers.reasonOther || ''
    } else {
      picked[q.id] = answers[q.id] || null
      other[q.id] = answers[`${q.id}Other`] || ''
    }
  }
  return { picked, other }
}

// firstTime: shown by itself on the dashboard (Skip), rather than opened
// from the account menu (Cancel)
export default function SignupSurvey({ firstTime = false, onClose }) {
  const [questions, setQuestions] = useState(null)
  const [picked, setPicked] = useState({})
  const [other, setOther] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef(null)

  useEffect(() => {
    let live = true
    api.getSurvey().then(data => {
      if (!live) return
      setQuestions(data.questions)
      const state = fromAnswers(data.questions, data.answers)
      setPicked(state.picked)
      setOther(state.other)
    }, err => { if (live) setError(err.message) })
    return () => { live = false }
  }, [])

  useEffect(() => { if (questions) dialog.current?.querySelector('input')?.focus() }, [questions])

  const pass = async () => {
    if (firstTime) {
      try { await api.skipSurvey() } catch {}
    }
    onClose(false)
  }
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') pass() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const choose = (q, id, on) => setPicked(p => {
    if (q.kind !== 'many') return { ...p, [q.id]: on ? id : null }
    const list = new Set(p[q.id] || [])
    if (on) list.add(id)
    else list.delete(id)
    return { ...p, [q.id]: [...list] }
  })
  const isPicked = (q, id) => (q.kind === 'many' ? (picked[q.id] || []).includes(id) : picked[q.id] === id)

  const save = async e => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.saveSurvey(toBody(questions, picked, other))
      onClose(true)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={pass}>
      <div className="modal signup-survey" role="dialog" aria-modal="true" aria-labelledby="signup-survey-title" ref={dialog} onClick={e => e.stopPropagation()}>
        <div className="signup-survey-head">
          <h2 id="signup-survey-title">{firstTime ? 'Welcome to Parallax' : 'About you'}</h2>
          <button type="button" className="btn-icon" onClick={pass} aria-label={firstTime ? 'Skip' : 'Close'}><X size={16} /></button>
        </div>
        <p className="signup-survey-intro">
          {firstTime
            ? 'A few optional questions, to help us build what you need. Answer any, all or none.'
            : 'Your answers help us build what you need. Every question is optional.'}
        </p>
        {error && <p className="signup-survey-error" role="alert">{error}</p>}
        {!questions ? (
          !error && <p className="signup-survey-intro">Loading…</p>
        ) : (
          <form onSubmit={save}>
            {questions.map(q => (
              <fieldset key={q.id} className="signup-survey-question">
                <legend>{q.label}{q.kind === 'many' && <span className="signup-survey-hint"> Pick any.</span>}</legend>
                <div className="signup-survey-choices">
                  {q.choices.map(([id, label]) => (
                    <label key={id} className={isPicked(q, id) ? 'picked' : undefined}>
                      <input type={q.kind === 'many' ? 'checkbox' : 'radio'} name={q.id} value={id} checked={isPicked(q, id)}
                        onChange={e => choose(q, id, e.target.checked)} />
                      {label}
                    </label>
                  ))}
                </div>
                {isPicked(q, 'other') && (
                  <input className="form-input signup-survey-other" value={other[q.id] || ''} maxLength={200}
                    onChange={e => setOther(o => ({ ...o, [q.id]: e.target.value }))}
                    placeholder="Tell us more (optional)" aria-label={`${q.label} Something else`} />
                )}
              </fieldset>
            ))}
            <div className="signup-survey-actions">
              <button type="button" className="btn btn-secondary" onClick={pass} disabled={busy}>{firstTime ? 'Skip' : 'Cancel'}</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

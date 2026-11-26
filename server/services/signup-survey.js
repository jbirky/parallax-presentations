// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The optional questions an account is asked once, on the dashboard: field,
// career stage, why Parallax and how they heard of it (migration 033). Every
// question can be left out, and Skip records that they passed, so they
// aren't asked again; "About you" in the account menu changes the answers.
// Admins see the totals and the answers in /admin (summary, csv).
//
// The questions and their choices live here, and the dashboard draws them
// from GET /api/me/survey, so a choice added here shows up there.

const QUESTIONS = [
  {
    id: 'field', label: 'What’s your field?', kind: 'one',
    choices: [
      ['astronomy', 'Astronomy and astrophysics'], ['physics', 'Physics'], ['chemistry', 'Chemistry'],
      ['biology', 'Biology and medicine'], ['math', 'Mathematics and statistics'], ['cs', 'Computer science and engineering'],
      ['earth', 'Earth and climate science'], ['social', 'Social sciences and humanities'], ['other', 'Something else'],
    ],
  },
  {
    id: 'careerStage', label: 'Where are you in your career?', kind: 'one',
    choices: [
      ['undergrad', 'Undergraduate student'], ['grad', 'Graduate student'], ['postdoc', 'Postdoc'],
      ['faculty', 'Faculty or lecturer'], ['teacher', 'School teacher'], ['research_staff', 'Research staff or scientist'],
      ['industry', 'Working outside academia'], ['other', 'Something else'],
    ],
  },
  {
    id: 'reasons', label: 'What brings you to Parallax?', kind: 'many',
    choices: [
      ['talks', 'Conference and seminar talks'], ['teaching', 'Teaching and lectures'], ['live_data', 'Live data and figures'],
      ['collaborating', 'Making slides with collaborators'], ['replacing', 'Replacing PowerPoint, Keynote or Beamer'],
      ['exploring', 'Just exploring'], ['other', 'Something else'],
    ],
  },
  {
    id: 'heardFrom', label: 'How did you hear about Parallax?', kind: 'one',
    choices: [
      ['colleague', 'A colleague or friend'], ['talk', 'A talk that used it'], ['search', 'Searching the web'],
      ['social', 'Social media'], ['github', 'GitHub'], ['other', 'Somewhere else'],
    ],
  },
]

// Each question's columns: its answer, and the "something else" text
const COLUMNS = {
  field: ['field', 'field_other'],
  careerStage: ['career_stage', 'career_other'],
  reasons: ['reasons', 'reason_other'],
  heardFrom: ['heard_from', 'heard_other'],
}
const OTHER_MAX = 200

class SurveyError extends Error {
  constructor(message) { super(message); this.status = 400 }
}

const choiceIds = q => q.choices.map(([id]) => id)
const cleanText = v => (typeof v === 'string' && v.trim() ? v.trim().slice(0, OTHER_MAX) : null)

// Answers from a request body, checked: { field, fieldOther, careerStage,
// careerOther, reasons, reasonOther, heardFrom, heardOther }, each optional
function cleanAnswers(body = {}) {
  const out = {}
  for (const q of QUESTIONS) {
    const value = body[q.id]
    if (q.kind === 'many') {
      const list = Array.isArray(value) ? [...new Set(value)] : []
      const bad = list.find(v => !choiceIds(q).includes(v))
      if (bad !== undefined) throw new SurveyError(`“${bad}” isn’t one of the choices for ${q.id}`)
      out[q.id] = list
      out[`${q.id === 'reasons' ? 'reason' : q.id}Other`] = list.includes('other') ? cleanText(body.reasonOther) : null
    } else {
      if (value != null && value !== '' && !choiceIds(q).includes(value)) throw new SurveyError(`“${value}” isn’t one of the choices for ${q.id}`)
      out[q.id] = value || null
      out[`${q.id}Other`] = value === 'other' ? cleanText(body[`${q.id}Other`]) : null
    }
  }
  return out
}

const rowToAnswers = r => (r ? {
  field: r.field, fieldOther: r.field_other,
  careerStage: r.career_stage, careerStageOther: r.career_other,
  reasons: r.reasons || [], reasonOther: r.reason_other,
  heardFrom: r.heard_from, heardFromOther: r.heard_other,
  skipped: r.skipped, updatedAt: r.updated_at,
} : null)

// Whether userId hasn't been asked yet (no answers, and didn't skip)
async function isPending(storage, userId) {
  try {
    const { rows } = await storage.query('SELECT 1 FROM signup_answers WHERE user_id = $1', [userId])
    return rows.length === 0
  } catch (err) {
    if (err.code === '42P01') return false // before migration 033
    throw err
  }
}

async function getAnswers(storage, userId) {
  const { rows } = await storage.query('SELECT * FROM signup_answers WHERE user_id = $1', [userId])
  return rowToAnswers(rows[0])
}

async function saveAnswers(storage, userId, body) {
  const a = cleanAnswers(body)
  const { rows } = await storage.query(
    `INSERT INTO signup_answers (user_id, field, field_other, career_stage, career_other, reasons, reason_other, heard_from, heard_other, skipped)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
     ON CONFLICT (user_id) DO UPDATE SET field = $2, field_other = $3, career_stage = $4, career_other = $5,
       reasons = $6, reason_other = $7, heard_from = $8, heard_other = $9, skipped = false, updated_at = NOW()
     RETURNING *`,
    [userId, a.field, a.fieldOther, a.careerStage, a.careerStageOther, a.reasons, a.reasonOther, a.heardFrom, a.heardFromOther]
  )
  return rowToAnswers(rows[0])
}

// Records that they passed; answers they gave before are kept
async function skip(storage, userId) {
  await storage.query(
    `INSERT INTO signup_answers (user_id, skipped) VALUES ($1, true) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  )
}

// --- For admins ---

const labelOf = (q, id) => q.choices.find(([c]) => c === id)?.[1] || id

// Totals for each question: { asked, answered, skipped, questions: [{ id,
// label, counts: [{ id, label, n }] }], others: [{ question, text }] }
async function summary(storage) {
  const { rows } = await storage.query('SELECT * FROM signup_answers ORDER BY updated_at DESC')
  const answered = rows.filter(r => !r.skipped)
  const questions = QUESTIONS.map(q => {
    const [col] = COLUMNS[q.id]
    const counts = q.choices.map(([id, label]) => ({
      id, label, n: answered.filter(r => (q.kind === 'many' ? (r[col] || []).includes(id) : r[col] === id)).length,
    }))
    return { id: q.id, label: q.label, kind: q.kind, counts, answered: answered.filter(r => (q.kind === 'many' ? (r[col] || []).length : r[col])).length }
  })
  const others = []
  for (const r of answered) {
    for (const q of QUESTIONS) {
      const text = r[COLUMNS[q.id][1]]
      if (text) others.push({ question: q.label, text })
    }
  }
  return { total: rows.length, answered: answered.length, skipped: rows.length - answered.length, questions, others: others.slice(0, 200) }
}

function csvCell(v) {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Every answer, one account a line, as CSV (with the account's email and plan)
async function csv(storage) {
  const { rows } = await storage.query(
    `SELECT a.*, u.email, u.plan, u.created_at AS joined FROM signup_answers a JOIN users u ON u.id = a.user_id
      WHERE NOT a.skipped ORDER BY a.updated_at DESC`
  )
  const q = Object.fromEntries(QUESTIONS.map(x => [x.id, x]))
  const header = ['email', 'plan', 'joined', 'answered', 'field', 'field (other)', 'career stage', 'career stage (other)', 'reasons', 'reasons (other)', 'heard from', 'heard from (other)']
  const lines = rows.map(r => [
    r.email, r.plan, r.joined?.toISOString?.() || r.joined, r.updated_at?.toISOString?.() || r.updated_at,
    r.field && labelOf(q.field, r.field), r.field_other,
    r.career_stage && labelOf(q.careerStage, r.career_stage), r.career_other,
    (r.reasons || []).map(id => labelOf(q.reasons, id)).join('; '), r.reason_other,
    r.heard_from && labelOf(q.heardFrom, r.heard_from), r.heard_other,
  ].map(csvCell).join(','))
  return [header.join(','), ...lines].join('\n') + '\n'
}

module.exports = { QUESTIONS, SurveyError, cleanAnswers, isPending, getAnswers, saveAnswers, skip, summary, csv }

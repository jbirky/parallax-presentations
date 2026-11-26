// @vitest-environment happy-dom
// The sign-up answers in /admin (SurveyAnswersPanel)
import { describe, it, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: {
    getSurveySummary: vi.fn(async () => ({
      total: 3, answered: 2, skipped: 1,
      questions: [
        { id: 'field', label: 'What’s your field?', kind: 'one', answered: 2, counts: [{ id: 'physics', label: 'Physics', n: 1 }, { id: 'astronomy', label: 'Astronomy and astrophysics', n: 2 }] },
        { id: 'reasons', label: 'What brings you to Parallax?', kind: 'many', answered: 1, counts: [{ id: 'talks', label: 'Conference and seminar talks', n: 1 }] },
      ],
      others: [{ question: 'What brings you to Parallax?', text: 'Group meetings' }],
    })),
    getSurveyCsv: vi.fn(async () => new Blob(['email\n'], { type: 'text/csv' })),
  },
}))
import { api } from '../utils/api'
import { SurveyAnswersPanel, adminTabs } from './AdminPage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('the sign-up answers, in /admin', () => {
  it('has a tab in the cloud version', () => {
    expect(adminTabs({ plans: [{ id: 'free' }] }).map(t => t.id)).toContain('answers')
    expect(adminTabs({ plans: [] }).map(t => t.id)).not.toContain('answers')
  })

  it('counts each question\'s choices, most first, lists the answers in words, and downloads them all', async () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    await act(async () => root.render(<SurveyAnswersPanel />))
    expect(el.textContent).toContain('2 accounts answered · 1 skipped')
    const first = el.querySelector('.survey-answers-question')
    expect([...first.querySelectorAll('tr')].map(r => r.textContent)).toEqual(['Astronomy and astrophysics2', 'Physics1'])
    expect(el.querySelector('.survey-answers-others').textContent).toContain('Group meetings')
    URL.createObjectURL = vi.fn(() => 'blob:answers')
    URL.revokeObjectURL = vi.fn()
    await act(async () => [...el.querySelectorAll('button')].find(b => b.textContent === 'Download CSV').click())
    expect(api.getSurveyCsv).toHaveBeenCalled()
    expect(URL.createObjectURL).toHaveBeenCalled()
    act(() => root.unmount())
  })
})

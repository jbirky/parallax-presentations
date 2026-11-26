// @vitest-environment happy-dom
// The optional sign-up questions (SignupSurvey): drawn from the server's
// questions, every one optional, saved or skipped.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

const QUESTIONS = [
  { id: 'field', label: 'What’s your field?', kind: 'one', choices: [['astronomy', 'Astronomy and astrophysics'], ['physics', 'Physics'], ['other', 'Something else']] },
  { id: 'careerStage', label: 'Where are you in your career?', kind: 'one', choices: [['grad', 'Graduate student'], ['postdoc', 'Postdoc'], ['other', 'Something else']] },
  { id: 'reasons', label: 'What brings you to Parallax?', kind: 'many', choices: [['talks', 'Conference and seminar talks'], ['teaching', 'Teaching and lectures'], ['other', 'Something else']] },
  { id: 'heardFrom', label: 'How did you hear about Parallax?', kind: 'one', choices: [['colleague', 'A colleague or friend'], ['other', 'Somewhere else']] },
]

vi.mock('../utils/api', () => ({
  api: {
    getSurvey: vi.fn(async () => ({ questions: QUESTIONS, answers: null })),
    saveSurvey: vi.fn(async () => ({ answers: {} })),
    skipSurvey: vi.fn(async () => ({ success: true })),
  },
}))
import { api } from '../utils/api'
import SignupSurvey from './SignupSurvey'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

async function mount(props) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const onClose = vi.fn()
  await act(async () => root.render(<SignupSurvey onClose={onClose} {...props} />))
  // Picks a choice, in the question-th question (the first by default)
  const pick = async (text, question = 0) => {
    const fieldset = el.querySelectorAll('fieldset')[question]
    const input = [...fieldset.querySelectorAll('label')].find(l => l.textContent.trim() === text).querySelector('input')
    await act(async () => input.click())
  }
  const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.getAttribute('aria-label') === text)
  return { el, root, onClose, pick, button }
}

beforeEach(() => vi.clearAllMocks())

describe('the sign-up questions', () => {
  it('asks the server\'s questions, and saves what\'s picked, with "something else" in words', async () => {
    const page = await mount({ firstTime: true })
    expect(page.el.querySelector('h2').textContent).toBe('Welcome to Parallax')
    expect([...page.el.querySelectorAll('legend')].map(l => l.textContent)).toEqual([
      'What’s your field?', 'Where are you in your career?', 'What brings you to Parallax? Pick any.', 'How did you hear about Parallax?',
    ])
    await page.pick('Astronomy and astrophysics')
    await page.pick('Conference and seminar talks', 2)
    await page.pick('Something else', 2)
    // A "something else" choice asks for words
    const other = page.el.querySelector('.signup-survey-other')
    expect(other).toBeTruthy()
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    await act(async () => { setValue.call(other, 'Group meetings'); other.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => page.el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(api.saveSurvey).toHaveBeenCalledWith({
      field: 'astronomy', fieldOther: '', careerStage: null, careerStageOther: '',
      reasons: ['talks', 'other'], reasonOther: 'Group meetings', heardFrom: null, heardFromOther: '',
    })
    expect(page.onClose).toHaveBeenCalledWith(true)
    act(() => page.root.unmount())
  })

  it('records a skip the first time, so it isn\'t asked again', async () => {
    const page = await mount({ firstTime: true })
    await act(async () => page.button('Skip').click())
    expect(api.skipSurvey).toHaveBeenCalled()
    expect(api.saveSurvey).not.toHaveBeenCalled()
    expect(page.onClose).toHaveBeenCalledWith(false)
    act(() => page.root.unmount())
  })

  it('opens from the account menu with the saved answers, and Cancel changes nothing', async () => {
    api.getSurvey.mockResolvedValueOnce({ questions: QUESTIONS, answers: { field: 'physics', careerStage: 'other', careerStageOther: 'Retired', reasons: ['teaching'], skipped: false } })
    const page = await mount({ firstTime: false })
    expect(page.el.querySelector('h2').textContent).toBe('About you')
    const checked = [...page.el.querySelectorAll('input:checked')].map(i => i.closest('label').textContent.trim())
    expect(checked).toEqual(['Physics', 'Something else', 'Teaching and lectures'])
    expect(page.el.querySelector('.signup-survey-other').value).toBe('Retired')
    await act(async () => page.button('Cancel').click())
    expect(api.skipSurvey).not.toHaveBeenCalled()
    expect(page.onClose).toHaveBeenCalledWith(false)
    act(() => page.root.unmount())
  })
})

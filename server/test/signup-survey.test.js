// The optional sign-up questions (services/signup-survey.js), through the
// HTTP API, against a real Postgres: asked once, answered or skipped, and
// seen only by admins. Needs TEST_DATABASE_URL, as collaboration.test.js
// describes; skipped without it.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { DB, startCloudServer } = require('./helpers')
const { cleanAnswers } = require('../services/signup-survey')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'

describe('checking sign-up answers', () => {
  it('keeps the choices it knows, and the "something else" text only with that choice', () => {
    assert.deepEqual(cleanAnswers({ field: 'other', fieldOther: '  Linguistics ', careerStage: 'postdoc', careerStageOther: 'ignored', reasons: ['talks', 'talks', 'other'], reasonOther: 'Group meetings', heardFrom: '' }), {
      field: 'other', fieldOther: 'Linguistics', careerStage: 'postdoc', careerStageOther: null,
      reasons: ['talks', 'other'], reasonOther: 'Group meetings', heardFrom: null, heardFromOther: null,
    })
    assert.deepEqual(cleanAnswers({}).reasons, [])
    assert.throws(() => cleanAnswers({ field: 'alchemy' }), /isn’t one of the choices/)
    assert.throws(() => cleanAnswers({ reasons: ['talks', 'fame'] }), /isn’t one of the choices/)
    assert.equal(cleanAnswers({ field: 'other', fieldOther: 'x'.repeat(500) }).fieldOther.length, 200)
  })
})

describe('the sign-up questions', { skip }, () => {
  let t, call
  let siteAdmin, newcomer, passer

  before(async () => {
    t = await startCloudServer()
    call = t.call
    ;[siteAdmin, newcomer, passer] = ['survey-admin', 'survey-newcomer', 'survey-passer'].map(t.user)
    process.env.ADMIN_USER_IDS = siteAdmin
  })
  after(() => t?.stop())

  it('asks a new account once, and keeps what they answer', async () => {
    assert.equal((await call(newcomer, 'GET', '/api/me')).body.survey.pending, true)
    const asked = (await call(newcomer, 'GET', '/api/me/survey')).body
    assert.deepEqual(asked.questions.map(q => q.id), ['field', 'careerStage', 'reasons', 'heardFrom'])
    assert.equal(asked.answers, null)

    assert.equal((await call(newcomer, 'PUT', '/api/me/survey', { field: 'alchemy' })).status, 400)
    assert.equal((await call(newcomer, 'GET', '/api/me')).body.survey.pending, true)

    const saved = await call(newcomer, 'PUT', '/api/me/survey', {
      field: 'astronomy', careerStage: 'grad', reasons: ['talks', 'other'], reasonOther: `Thesis defense ${t.run}`, heardFrom: 'colleague',
    })
    assert.equal(saved.status, 200, JSON.stringify(saved.body))
    assert.equal((await call(newcomer, 'GET', '/api/me')).body.survey.pending, false)
    const again = (await call(newcomer, 'GET', '/api/me/survey')).body.answers
    assert.deepEqual([again.field, again.careerStage, again.reasons, again.reasonOther, again.skipped],
      ['astronomy', 'grad', ['talks', 'other'], `Thesis defense ${t.run}`, false])
    // Skipping later keeps them
    await call(newcomer, 'POST', '/api/me/survey/skip')
    assert.equal((await call(newcomer, 'GET', '/api/me/survey')).body.answers.field, 'astronomy')
  })

  it('doesn\'t ask again once they skip, and lets them answer later', async () => {
    await call(passer, 'GET', '/api/me')
    assert.equal((await call(passer, 'POST', '/api/me/survey/skip')).status, 200)
    assert.equal((await call(passer, 'GET', '/api/me')).body.survey.pending, false)
    assert.equal((await call(passer, 'GET', '/api/me/survey')).body.answers.skipped, true)
    await call(passer, 'PUT', '/api/me/survey', { careerStage: 'faculty' })
    const later = (await call(passer, 'GET', '/api/me/survey')).body.answers
    assert.deepEqual([later.careerStage, later.skipped], ['faculty', false])
  })

  it('shows admins the totals and every answer, and no one else', async () => {
    assert.equal((await call(newcomer, 'GET', '/api/admin/survey')).status, 404)
    assert.equal((await call(newcomer, 'GET', '/api/admin/survey.csv')).status, 404)
    const summary = (await call(siteAdmin, 'GET', '/api/admin/survey')).body
    assert.ok(summary.answered >= 2)
    const field = summary.questions.find(q => q.id === 'field')
    assert.ok(field.counts.find(c => c.id === 'astronomy').n >= 1)
    assert.ok(summary.others.some(o => o.text === `Thesis defense ${t.run}` && o.question === 'What brings you to Parallax?'))

    const res = await fetch(`${t.base}/api/admin/survey.csv`, { headers: { 'X-Test-User': siteAdmin } })
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /text\/csv/)
    assert.match(res.headers.get('content-disposition'), /attachment; filename="parallax-signup-answers-/)
    const text = await res.text()
    assert.match(text.split('\n')[0], /^email,plan,joined,answered,field/)
    const line = text.split('\n').find(l => l.startsWith(`${newcomer}@test.local,`))
    assert.match(line, /Astronomy and astrophysics,,Graduate student,,Conference and seminar talks; Something else,Thesis defense/)
  })
})

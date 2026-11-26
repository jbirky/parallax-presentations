// Email through Resend (services/email.js), with fetch stubbed, and the
// team invitation it sends (services/team-invite-email.js)

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const email = require('../services/email')
const { teamInviteEmail } = require('../services/team-invite-email')

describe('email', () => {
  const realFetch = globalThis.fetch
  let sent
  beforeEach(() => {
    sent = []
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.PARALLAX_EMAIL_FROM = 'Parallax <invites@example.com>'
  })
  afterEach(() => {
    globalThis.fetch = realFetch
    delete process.env.RESEND_API_KEY
    delete process.env.PARALLAX_EMAIL_FROM
  })
  const answer = (status, body) => { globalThis.fetch = async (url, init) => { sent.push({ url, init }); return new Response(JSON.stringify(body), { status }) } }

  it('is off without a key and a sender', async () => {
    delete process.env.PARALLAX_EMAIL_FROM
    assert.equal(email.isEnabled(), false)
    answer(200, { id: 'x' })
    await assert.rejects(email.send({ to: 'a@b.c', subject: 's', text: 't' }), email.EmailError)
    assert.equal(sent.length, 0)
  })

  it('sends one message to Resend', async () => {
    answer(200, { id: 'em_1' })
    assert.equal(email.isEnabled(), true)
    const got = await email.send({ to: 'new@example.com', subject: 'Hello\r\nBcc: x@evil.test', text: 'Hi', html: '<p>Hi</p>', replyTo: 'support@example.com', idempotencyKey: 'team-invite-7' })
    assert.deepEqual(got, { id: 'em_1' })
    assert.equal(sent[0].url, email.API)
    assert.equal(sent[0].init.headers.Authorization, 'Bearer re_test_key')
    assert.equal(sent[0].init.headers['Idempotency-Key'], 'team-invite-7')
    const body = JSON.parse(sent[0].init.body)
    assert.deepEqual(body, { from: 'Parallax <invites@example.com>', to: ['new@example.com'], subject: 'Hello Bcc: x@evil.test', text: 'Hi', html: '<p>Hi</p>', reply_to: 'support@example.com' })
  })

  it('says why Resend refused it', async () => {
    answer(403, { name: 'validation_error', message: 'The example.com domain is not verified.' })
    await assert.rejects(email.send({ to: 'a@b.c', subject: 's', text: 't' }), { name: 'Error', message: 'The example.com domain is not verified.' })
    globalThis.fetch = async () => { throw new TypeError('fetch failed') }
    await assert.rejects(email.send({ to: 'a@b.c', subject: 's', text: 't' }), { message: 'The email service couldn’t be reached' })
  })
})

describe('a team invitation’s email', () => {
  const base = { teamName: 'Exoplanet lab', invitedBy: 'Ada Owner', role: 'member', email: 'new@example.com', expiresAt: '2026-12-26T10:00:00.000Z', url: 'https://parallax-presentations.com/teams/join/' + 'T'.repeat(43), origin: 'https://parallax-presentations.com' }

  it('says who invited them to which team, as what, and links to joining it', () => {
    const m = teamInviteEmail(base)
    assert.equal(m.subject, 'Ada Owner invited you to Exoplanet lab on Parallax')
    for (const part of [m.text, m.html]) {
      assert.ok(part.includes(base.url))
      assert.ok(part.includes('make and edit the team’s presentations'))
      assert.ok(part.includes('works only for new@example.com until December 26, 2026'))
    }
    assert.match(m.html, /<a href="https:\/\/parallax-presentations\.com\/teams\/join\/T{43}"[^>]*>Join Exoplanet lab<\/a>/)
    assert.ok(m.html.includes('Parallax · parallax-presentations.com'))
    assert.ok(teamInviteEmail({ ...base, role: 'viewer', expiresAt: null }).text.includes('without changing them'))
    assert.ok(!teamInviteEmail({ ...base, expiresAt: null }).text.includes(' until '))
    assert.equal(teamInviteEmail({ ...base, invitedBy: null }).subject, 'You’re invited to Exoplanet lab on Parallax')
  })

  it('escapes what people typed', () => {
    const m = teamInviteEmail({ ...base, teamName: '<img src=x onerror=alert(1)>', invitedBy: '"Bo" <b>' })
    assert.ok(!m.html.includes('<img src=x'))
    assert.ok(!m.html.includes('<b>'))
    assert.ok(m.html.includes('&lt;img src=x onerror=alert(1)&gt;'))
  })
})

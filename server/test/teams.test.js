// Teams, through the HTTP API, against a real Postgres: made by an admin of
// the site, joined through invite links, and run by their owner and admins.
// Needs TEST_DATABASE_URL, as collaboration.test.js describes; skipped
// without it. A test user's email address is <their id>@test.local.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { DB, startCloudServer } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'

describe('teams', { skip }, () => {
  let t, call, userId, pool
  let siteAdmin, owner, admin, member, viewer, outsider, late
  let team

  const email = who => `${who}@test.local`
  const invite = async (who, body) => {
    const res = await call(who, 'POST', `/api/teams/${team}/invites`, body)
    assert.equal(res.status, 201, JSON.stringify(res.body))
    return res.body.token
  }
  const join = (who, token) => call(who, 'POST', `/api/team-invites/${token}/accept`)

  before(async () => {
    t = await startCloudServer()
    ;({ call, userId, pool } = t)
    ;[siteAdmin, owner, admin, member, viewer, outsider, late] =
      ['site-admin', 'owner', 'admin', 'member', 'viewer', 'outsider', 'late'].map(t.user)
    process.env.ADMIN_USER_IDS = siteAdmin
    for (const who of [siteAdmin, owner, admin, member, viewer, outsider, late]) {
      assert.equal((await call(who, 'GET', '/api/me')).status, 200)
    }
  })

  after(() => t?.stop())

  it('is made by an admin of the site, for an account by its email address', async () => {
    const body = { name: `Lab ${t.run}`, ownerEmail: email(owner), seats: 3 }
    assert.equal((await call(owner, 'POST', '/api/admin/teams', body)).status, 404)
    assert.equal((await call(siteAdmin, 'POST', '/api/admin/teams', { ...body, ownerEmail: 'nobody@test.local' })).status, 404)
    assert.equal((await call(siteAdmin, 'POST', '/api/admin/teams', { ...body, seats: 0 })).status, 400)
    const res = await call(siteAdmin, 'POST', '/api/admin/teams', body)
    assert.equal(res.status, 201, JSON.stringify(res.body))
    team = res.body.team.id
    assert.equal(res.body.team.plan, 'team')

    const mine = await call(owner, 'GET', '/api/teams')
    assert.deepEqual(mine.body.teams.map(x => [x.id, x.role, x.seatsUsed, x.seats]), [[team, 'owner', 1, 3]])
    const listed = await call(siteAdmin, 'GET', '/api/admin/teams')
    assert.equal(listed.body.teams.find(x => x.id === team).ownerEmail, email(owner))
  })

  it('is hidden from people outside it', async () => {
    assert.equal((await call(outsider, 'GET', `/api/teams/${team}`)).status, 404)
    assert.equal((await call(outsider, 'PATCH', `/api/teams/${team}`, { name: 'Mine' })).status, 404)
    assert.equal((await call(outsider, 'POST', `/api/teams/${team}/invites`, { role: 'member' })).status, 404)
    assert.deepEqual((await call(outsider, 'GET', '/api/teams')).body.teams, [])
  })

  it('takes people in through invite links, in the link\'s role', async () => {
    const token = await invite(owner, { role: 'member' })
    const seen = await call(member, 'GET', `/api/team-invites/${token}`)
    assert.equal(seen.status, 200)
    assert.equal(seen.body.teamName, `Lab ${t.run}`)
    assert.equal(seen.body.role, 'member')
    assert.equal(seen.body.joined, false)
    assert.equal(seen.body.seatsFull, false)
    const joined = await join(member, token)
    assert.deepEqual(joined.body, { teamId: team, teamName: `Lab ${t.run}`, role: 'member' })
    // Accepting again changes nothing
    assert.equal((await join(member, token)).body.role, 'member')
    assert.equal((await call(member, 'GET', `/api/team-invites/${token}`)).body.joined, true)

    const adminLink = await invite(owner, { role: 'admin', days: 7 })
    assert.equal((await join(admin, adminLink)).body.role, 'admin')
    const viewerLink = await invite(admin, { role: 'viewer' })
    assert.equal((await join(viewer, viewerLink)).body.role, 'viewer')

    const got = await call(owner, 'GET', `/api/teams/${team}`)
    assert.deepEqual(got.body.members.map(m => m.role), ['owner', 'admin', 'member', 'viewer'])
    assert.equal(got.body.seatsUsed, 3)
  })

  it('refuses links it doesn\'t know, and bad invites', async () => {
    assert.equal((await call(member, 'GET', '/api/team-invites/not-a-token')).status, 404)
    assert.equal((await call(member, 'GET', `/api/team-invites/${'x'.repeat(43)}`)).status, 404)
    assert.equal((await call(owner, 'POST', `/api/teams/${team}/invites`, { role: 'owner' })).status, 400)
    assert.equal((await call(owner, 'POST', `/api/teams/${team}/invites`, { role: 'member', days: 3 })).status, 400)
    assert.equal((await call(owner, 'POST', `/api/teams/${team}/invites`, { role: 'member', email: 'nope' })).status, 400)
  })

  it('stops at its seats, though viewers take none', async () => {
    // owner, admin and member fill the 3 seats
    const token = await invite(owner, { role: 'member' })
    assert.equal((await call(late, 'GET', `/api/team-invites/${token}`)).body.seatsFull, true)
    const full = await join(late, token)
    assert.equal(full.status, 409)
    assert.match(full.body.error, /Ask its owner to add a seat/)
    // A viewer can't be made a member either, until there's a seat
    assert.equal((await call(owner, 'PATCH', `/api/teams/${team}/members/${await userId(viewer)}`, { role: 'member' })).status, 409)
    // Fewer seats than are in use is refused
    assert.equal((await call(siteAdmin, 'PUT', `/api/admin/teams/${team}`, { seats: 2 })).status, 400)
    assert.equal((await call(siteAdmin, 'PUT', `/api/admin/teams/${team}`, { seats: 4 })).body.team.seats, 4)
    assert.equal((await join(late, token)).body.role, 'member')
  })

  it('keeps an email-locked link for that address', async () => {
    // Addresses compare without case
    const locked = await invite(owner, { role: 'viewer', email: email(outsider).toUpperCase() })
    const stranger = t.user('stranger')
    await call(stranger, 'GET', '/api/me')
    assert.match((await call(stranger, 'GET', `/api/team-invites/${locked}`)).body.wrongEmail, /Sign in with that address/)
    assert.equal((await join(stranger, locked)).status, 403)
    assert.equal((await call(outsider, 'GET', `/api/team-invites/${locked}`)).body.wrongEmail, null)
    assert.equal((await join(outsider, locked)).body.role, 'viewer')
  })

  it('emails a link for an address there, where the server sends email, a few an hour', async () => {
    // Resend, stubbed; the test's own calls to the server go through
    const realFetch = globalThis.fetch
    let mails = [], refuse = false
    globalThis.fetch = async (url, init) => {
      if (!String(url).startsWith('https://api.resend.com/')) return realFetch(url, init)
      if (refuse) return new Response(JSON.stringify({ message: 'The test.local domain is not verified.' }), { status: 403 })
      mails.push({ ...JSON.parse(init.body), key: init.headers['Idempotency-Key'] })
      return new Response(JSON.stringify({ id: `em_${mails.length}` }), { status: 200 })
    }
    const made = []
    const post = async (who, body) => {
      const res = await call(who, 'POST', `/api/teams/${team}/invites`, body)
      assert.equal(res.status, 201, JSON.stringify(res.body))
      made.push([who, res.body.invite.id])
      return res.body
    }
    try {
      // Off: the link is made, to send yourself
      assert.equal((await call(owner, 'GET', `/api/teams/${team}`)).body.inviteEmails, false)
      let got = await post(owner, { role: 'member', email: email(late) })
      assert.deepEqual([got.emailed, got.emailError], [false, 'This server doesn’t send email.'])

      process.env.RESEND_API_KEY = 're_test'
      process.env.PARALLAX_EMAIL_FROM = 'Parallax <invites@test.local>'
      assert.equal((await call(owner, 'GET', `/api/teams/${team}`)).body.inviteEmails, true)
      got = await post(owner, { role: 'viewer', email: email(late) })
      assert.equal(got.emailed, true)
      assert.equal(mails.length, 1)
      assert.deepEqual(mails[0].to, [email(late)])
      assert.equal(mails[0].from, 'Parallax <invites@test.local>')
      const { rows: [{ who }] } = await pool.query("SELECT COALESCE(NULLIF(name, ''), email) AS who FROM users WHERE email = $1", [email(owner)])
      assert.equal(mails[0].subject, `${who} invited you to Lab ${t.run} on Parallax`)
      assert.ok(mails[0].text.includes(`/teams/join/${got.token}`))
      assert.ok(mails[0].text.includes(`works only for ${email(late)}`))
      assert.equal(mails[0].key, `team-invite-${got.invite.id}`)
      // The emailed link joins that address, and only that one
      const someoneElse = t.user('someone-else')
      await call(someoneElse, 'GET', '/api/me')
      assert.equal((await join(someoneElse, got.token)).status, 403)

      // A link for anyone isn't emailed anywhere
      got = await post(owner, { role: 'member' })
      assert.equal(got.emailed, undefined)
      assert.equal(mails.length, 1)

      // Refused by the email service: the link is still made, to send yourself
      refuse = true
      got = await post(owner, { role: 'member', email: 'someone@test.local' })
      assert.deepEqual([got.emailed, got.emailError], [false, 'The email couldn’t be sent.'])
      assert.ok(got.token)
      refuse = false

      // At most 20 emailed an hour by one person
      for (const [, id] of made.splice(0)) await call(owner, 'DELETE', `/api/teams/${team}/invites/${id}`)
      const { rows: [{ n: before }] } = await pool.query(
        `SELECT count(*)::int AS n FROM team_invites i JOIN users u ON u.id = i.created_by
          WHERE u.email = $1 AND i.email IS NOT NULL AND i.created_at > NOW() - interval '1 hour'`, [email(admin)])
      mails = []
      let last
      for (let k = 0; k < 25; k++) {
        last = await post(admin, { role: 'viewer', email: `cap${k}@test.local` })
        await call(admin, 'DELETE', `/api/teams/${team}/invites/${made.pop()[1]}`)
        if (!last.emailed) break
      }
      assert.equal(mails.length, 20 - before)
      assert.match(last.emailError, /20 invitations emailed in the last hour/)
    } finally {
      globalThis.fetch = realFetch
      delete process.env.RESEND_API_KEY
      delete process.env.PARALLAX_EMAIL_FROM
      for (const [who, id] of made) await call(who, 'DELETE', `/api/teams/${team}/invites/${id}`)
    }
  })

  it('stops a link working once it is revoked or has expired', async () => {
    const token = await invite(owner, { role: 'viewer' })
    const { invites } = (await call(owner, 'GET', `/api/teams/${team}`)).body
    const open = invites.find(i => i.hint === token.slice(-4))
    assert.ok(open)
    assert.equal((await call(member, 'DELETE', `/api/teams/${team}/invites/${open.id}`)).status, 403)
    assert.equal((await call(admin, 'DELETE', `/api/teams/${team}/invites/${open.id}`)).status, 200)
    assert.equal((await call(t.user('newcomer'), 'GET', `/api/team-invites/${token}`)).status, 404)
    assert.ok(!(await call(owner, 'GET', `/api/teams/${team}`)).body.invites.some(i => i.id === open.id))

    const later = await invite(owner, { role: 'viewer', days: 7 })
    await pool.query(`UPDATE team_invites SET expires_at = NOW() - interval '1 minute' WHERE token_hint = $1 AND team_id = $2`, [later.slice(-4), team])
    const newcomer = t.user('newcomer')
    await call(newcomer, 'GET', '/api/me')
    assert.equal((await join(newcomer, later)).status, 404)
  })

  it('lets owners and admins run it, and members and viewers only see it', async () => {
    for (const who of [member, viewer]) {
      const got = await call(who, 'GET', `/api/teams/${team}`)
      assert.equal(got.status, 200)
      assert.equal(got.body.invites, undefined)
      // Others' addresses show only as hints
      const ownerRow = got.body.members.find(m => m.role === 'owner')
      assert.match(ownerRow.email, /^.…@test\.local$/)
      assert.equal(got.body.members.find(m => m.id === got.body.you).email, email(who))
      assert.equal((await call(who, 'PATCH', `/api/teams/${team}`, { name: 'Renamed' })).status, 403)
      assert.equal((await call(who, 'POST', `/api/teams/${team}/invites`, { role: 'viewer' })).status, 403)
      assert.equal((await call(who, 'PATCH', `/api/teams/${team}/members/${await userId(late)}`, { role: 'viewer' })).status, 403)
      assert.equal((await call(who, 'DELETE', `/api/teams/${team}/members/${await userId(late)}`)).status, 403)
    }
    assert.equal((await call(admin, 'GET', `/api/teams/${team}`)).body.members[0].email, email(owner))
    assert.equal((await call(admin, 'PATCH', `/api/teams/${team}`, { name: `Lab ${t.run} group` })).body.name, `Lab ${t.run} group`)
    assert.equal((await call(admin, 'PATCH', `/api/teams/${team}`, { name: '  ' })).status, 400)
  })

  it('lets admins change roles and remove people, except the owner', async () => {
    const ownerId = await userId(owner)
    assert.equal((await call(admin, 'PATCH', `/api/teams/${team}/members/${ownerId}`, { role: 'member' })).status, 403)
    assert.equal((await call(admin, 'DELETE', `/api/teams/${team}/members/${ownerId}`)).status, 403)
    assert.equal((await call(admin, 'PATCH', `/api/teams/${team}/members/${await userId(late)}`, { role: 'owner' })).status, 400)
    assert.equal((await call(admin, 'PATCH', `/api/teams/${team}/members/${await userId(late)}`, { role: 'viewer' })).body.role, 'viewer')
    assert.equal((await call(admin, 'DELETE', `/api/teams/${team}/members/${await userId(late)}`)).status, 200)
    assert.equal((await call(late, 'GET', `/api/teams/${team}`)).status, 404)
    assert.equal((await call(admin, 'DELETE', `/api/teams/${team}/members/${await userId(late)}`)).status, 404)
  })

  it('lets anyone but the owner leave', async () => {
    assert.equal((await call(outsider, 'DELETE', `/api/teams/${team}/members/${await userId(outsider)}`)).status, 200)
    assert.deepEqual((await call(outsider, 'GET', '/api/teams')).body.teams, [])
    const stay = await call(owner, 'DELETE', `/api/teams/${team}/members/${await userId(owner)}`)
    assert.equal(stay.status, 403)
    assert.match(stay.body.error, /Hand the team to an admin/)
  })

  it('is handed over by its owner, to an admin only', async () => {
    assert.equal((await call(admin, 'POST', `/api/teams/${team}/transfer`, { userId: await userId(admin) })).status, 403)
    assert.equal((await call(owner, 'POST', `/api/teams/${team}/transfer`, { userId: await userId(member) })).status, 400)
    assert.equal((await call(owner, 'POST', `/api/teams/${team}/transfer`, { userId: await userId(admin) })).status, 200)
    const roles = Object.fromEntries((await call(admin, 'GET', `/api/teams/${team}`)).body.members.map(m => [m.id, m.role]))
    assert.equal(roles[await userId(admin)], 'owner')
    assert.equal(roles[await userId(owner)], 'admin')
    const { rows } = await pool.query('SELECT owner_id FROM teams WHERE id = $1', [team])
    assert.equal(rows[0].owner_id, await userId(admin))
    // Now the old owner can leave
    assert.equal((await call(owner, 'DELETE', `/api/teams/${team}/members/${await userId(owner)}`)).status, 200)
  })

  it('is removed by an admin of the site', async () => {
    assert.equal((await call(admin, 'DELETE', `/api/admin/teams/${team}`)).status, 404)
    assert.equal((await call(siteAdmin, 'DELETE', `/api/admin/teams/${team}`)).status, 200)
    assert.deepEqual((await call(admin, 'GET', '/api/teams')).body.teams, [])
  })
})

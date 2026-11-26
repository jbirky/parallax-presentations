// A team's library (services/team-library.js), through the HTTP API, against
// a real Postgres: its datasets, themes, fonts and templates, who can use and
// change them, and datasets moving into the team with a deck. Needs
// TEST_DATABASE_URL, as collaboration.test.js describes; skipped without it.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { DB, startCloudServer } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'

describe('a team\'s library', { skip }, () => {
  let t, call, userId, pool, createDeck
  let siteAdmin, owner, admin, member, other, viewer, outsider
  let team, teamDeck

  const join = async (who, teamId, role, by) => {
    const { token } = (await call(by, 'POST', `/api/teams/${teamId}/invites`, { role })).body
    assert.equal((await call(who, 'POST', `/api/team-invites/${token}/accept`)).status, 200)
  }
  const uploadData = (who, name, csv = 'x,y\n1,2\n3,4') => {
    const boundary = `----parallax${crypto.randomBytes(8).toString('hex')}`
    const body = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${name}\r\n`
      + `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}.csv"\r\nContent-Type: text/csv\r\n\r\n`
      + `${csv}\r\n--${boundary}--\r\n`)
    return call(who, 'POST', '/api/datasets', body, { 'Content-Type': `multipart/form-data; boundary=${boundary}` })
  }
  const teamOf = async id => (await pool.query('SELECT team_id FROM datasets WHERE id = $1', [id])).rows[0].team_id

  before(async () => {
    t = await startCloudServer()
    ;({ call, userId, pool, createDeck } = t)
    ;[siteAdmin, owner, admin, member, other, viewer, outsider] =
      ['lib-admin', 'lib-owner', 'lib-tadmin', 'lib-member', 'lib-other', 'lib-viewer', 'lib-outsider'].map(t.user)
    process.env.ADMIN_USER_IDS = siteAdmin
    for (const who of [siteAdmin, owner, admin, member, other, viewer, outsider]) await call(who, 'GET', '/api/me')
    // Pro, so their own decks and datasets aren't held to the free plan's limits
    await pool.query("UPDATE users SET plan = 'pro' WHERE auth_id = ANY($1)", [[member, outsider]])
    team = (await call(siteAdmin, 'POST', '/api/admin/teams', { name: `Library ${t.run}`, ownerEmail: `${owner}@test.local`, seats: 5 })).body.team.id
    await join(admin, team, 'admin', owner)
    await join(member, team, 'member', owner)
    await join(other, team, 'member', owner)
    await join(viewer, team, 'viewer', owner)
    teamDeck = await createDeck(owner, 'Team deck', { teamId: team })
  })

  after(() => t?.stop())

  describe('datasets', () => {
    let ds

    it('gives a member\'s dataset to the team when they link it to a team deck', async () => {
      const made = await uploadData(member, `counts-${t.run}`)
      assert.equal(made.status, 201, JSON.stringify(made.body))
      ds = made.body.id
      const linked = await call(member, 'POST', `/api/presentations/${teamDeck}/datasets`, { datasetId: ds })
      assert.equal(linked.status, 200, JSON.stringify(linked.body))
      assert.equal(linked.body.movedToTeam, true)
      assert.equal(await teamOf(ds), team)
    })

    it('lists the team\'s datasets with the team, not on the member\'s own list', async () => {
      const own = (await call(member, 'GET', '/api/datasets')).body
      assert.ok(!own.some(d => d.id === ds))
      const withTeam = (await call(other, 'GET', `/api/datasets?teamId=${team}`)).body
      const found = withTeam.find(d => d.id === ds)
      assert.equal(found.teamId, team)
      assert.equal(found.creatorId, await userId(member))
      assert.equal((await call(outsider, 'GET', `/api/datasets?teamId=${team}`)).status, 404)
    })

    it('lets everyone in the team read it, and no one else', async () => {
      for (const who of [owner, other, viewer]) {
        const res = await call(who, 'GET', `/api/datasets/${ds}/data`)
        assert.equal(res.status, 200, `${who}: ${JSON.stringify(res.body)}`)
        assert.deepEqual(res.body.columns.x, [1, 3])
      }
      const deckRead = await call(other, 'GET', `/api/presentations/${teamDeck}/datasets/${ds}/data`)
      assert.equal(deckRead.status, 200, JSON.stringify(deckRead.body))
      assert.equal((await call(outsider, 'GET', `/api/datasets/${ds}/data`)).status, 404)
      assert.equal((await call(outsider, 'GET', `/api/datasets/${ds}`)).status, 404)
    })

    it('lets its giver, the team\'s admins and owner change it, not other members or viewers', async () => {
      assert.equal((await call(other, 'PATCH', `/api/datasets/${ds}`, { name: 'taken' })).status, 403)
      assert.equal((await call(viewer, 'PATCH', `/api/datasets/${ds}`, { name: 'taken' })).status, 403)
      assert.equal((await call(other, 'DELETE', `/api/datasets/${ds}`)).status, 403)
      const renamed = await call(admin, 'PATCH', `/api/datasets/${ds}`, { name: `team-counts-${t.run}` })
      assert.equal(renamed.status, 200, JSON.stringify(renamed.body))
      assert.equal(renamed.body.name, `team-counts-${t.run}`)
      assert.equal((await call(member, 'PATCH', `/api/datasets/${ds}`, { name: `counts-${t.run}` })).status, 200)
    })

    it('stays the team\'s when its giver leaves', async () => {
      const leaver = t.user('lib-leaver')
      await call(leaver, 'GET', '/api/me')
      await join(leaver, team, 'member', owner)
      const mine = (await uploadData(leaver, `leaving-${t.run}`)).body.id
      assert.equal((await call(leaver, 'POST', `/api/datasets/${mine}/team`, { teamId: team })).status, 200)
      assert.equal((await call(owner, 'DELETE', `/api/teams/${team}/members/${await userId(leaver)}`)).status, 200)
      assert.equal(await teamOf(mine), team)
      assert.equal((await call(leaver, 'GET', `/api/datasets/${mine}/data`)).status, 404)
      assert.equal((await call(other, 'GET', `/api/datasets/${mine}/data`)).status, 200)
    })

    it('counts the team\'s datasets against the team\'s storage, not the giver\'s', async () => {
      const { rows: [{ bytes }] } = await pool.query('SELECT COALESCE(SUM(byte_size), 0)::bigint AS bytes FROM dataset_versions WHERE dataset_id = $1', [ds])
      assert.ok(Number(bytes) > 0)
      const { teamStorageUsedBytes, storageUsedBytes } = require('../middleware/upload-quota')
      const db = { query: (q, p) => pool.query(q, p) }
      assert.ok(await teamStorageUsedBytes(db, team) >= Number(bytes))
      const before = await storageUsedBytes(db, await userId(member))
      const extra = (await uploadData(member, `own-${t.run}`)).body.id
      const after = await storageUsedBytes(db, await userId(member))
      assert.ok(after > before)
      await call(member, 'POST', `/api/datasets/${extra}/team`, { teamId: team })
      assert.equal(await storageUsedBytes(db, await userId(member)), before)
    })

    it('gives datasets only to teams the caller adds to', async () => {
      const mine = (await uploadData(outsider, `outside-${t.run}`)).body.id
      assert.equal((await call(outsider, 'POST', `/api/datasets/${mine}/team`, { teamId: team })).status, 404)
      const viewers = (await uploadData(viewer, `viewers-${t.run}`)).body.id
      assert.equal((await call(viewer, 'POST', `/api/datasets/${viewers}/team`, { teamId: team })).status, 403)
      assert.equal((await call(member, 'POST', `/api/datasets/${viewers}/team`, { teamId: team })).status, 404)
      assert.equal(await teamOf(viewers), null)
    })

    it('carries a deck\'s own datasets into the team with it, and leaves the team\'s behind when it goes', async () => {
      const deck = await createDeck(member, 'Moving deck')
      const own = (await uploadData(member, `moving-${t.run}`)).body.id
      const linked = await call(member, 'POST', `/api/presentations/${deck}/datasets`, { datasetId: own })
      assert.equal(linked.body.movedToTeam, false)
      assert.equal(await teamOf(own), null)
      const into = await call(member, 'PUT', `/api/presentations/${deck}/location`, { teamId: team })
      assert.equal(into.status, 200, JSON.stringify(into.body))
      assert.equal(into.body.datasetsMoved, 1)
      assert.equal(await teamOf(own), team)
      // Out again: the dataset is the team's now, so the deck loses it
      const out = await call(member, 'PUT', `/api/presentations/${deck}/location`, { teamId: null })
      assert.equal(out.status, 200, JSON.stringify(out.body))
      assert.equal(out.body.datasetsLeft, 1)
      assert.equal(await teamOf(own), team)
      const { rows } = await pool.query('SELECT 1 FROM presentation_datasets WHERE presentation_id = $1', [deck])
      assert.equal(rows.length, 0)
    })
  })

  describe('themes', () => {
    let theme

    it('saves themes for the team from its owner, admins and members', async () => {
      const res = await call(member, 'POST', `/api/teams/${team}/themes`, { name: 'Lab look', base: 'white', colors: { heading: '#d62828' } })
      assert.equal(res.status, 201, JSON.stringify(res.body))
      theme = res.body
      assert.equal(theme.teamId, team)
      assert.equal((await call(viewer, 'POST', `/api/teams/${team}/themes`, { name: 'No', base: 'white' })).status, 403)
      assert.equal((await call(outsider, 'POST', `/api/teams/${team}/themes`, { name: 'No', base: 'white' })).status, 404)
      assert.equal((await call(member, 'POST', `/api/teams/${team}/themes`, { name: 'Bad', base: 'neon' })).status, 400)
    })

    it('lists them beside each member\'s own, only with the team', async () => {
      const withTeam = (await call(viewer, 'GET', `/api/themes?teamId=${team}`)).body
      assert.ok(withTeam.some(x => x.id === theme.id && x.teamId === team && x.base === 'white'))
      assert.ok(!(await call(member, 'GET', '/api/themes')).body.some(x => x.id === theme.id))
      assert.equal((await call(outsider, 'GET', `/api/themes?teamId=${team}`)).status, 404)
      // Not reachable as a personal theme either
      assert.equal((await call(member, 'PUT', `/api/themes/${theme.id}`, { name: 'Mine now', base: 'white' })).status, 404)
    })

    it('lets whoever saved it, admins and the owner change it', async () => {
      assert.equal((await call(other, 'PUT', `/api/teams/${team}/themes/${theme.id}`, { name: 'Taken', base: 'moon' })).status, 403)
      const changed = await call(admin, 'PUT', `/api/teams/${team}/themes/${theme.id}`, { name: 'Lab look 2', base: 'moon' })
      assert.equal(changed.status, 200, JSON.stringify(changed.body))
      assert.equal(changed.body.version, 2)
      assert.equal((await call(other, 'DELETE', `/api/teams/${team}/themes/${theme.id}`)).status, 403)
      assert.equal((await call(member, 'DELETE', `/api/teams/${team}/themes/${theme.id}`)).status, 200)
    })
  })

  describe('fonts', () => {
    it('adds Google fonts and shares members\' own fonts with the team', async () => {
      const added = await call(member, 'POST', `/api/teams/${team}/fonts`, { familyName: 'Lato' })
      assert.equal(added.status, 201, JSON.stringify(added.body))
      assert.equal(added.body.teamId, team)
      assert.equal((await call(other, 'POST', `/api/teams/${team}/fonts`, { familyName: 'lato' })).status, 409)
      assert.equal((await call(viewer, 'POST', `/api/teams/${team}/fonts`, { familyName: 'Jost' })).status, 403)

      const own = (await call(other, 'POST', '/api/fonts/google', { familyName: 'Jost' })).body
      const shared = await call(other, 'POST', `/api/teams/${team}/fonts`, { fontId: own.id })
      assert.equal(shared.status, 201, JSON.stringify(shared.body))
      assert.equal(shared.body.url, own.url)
      // Someone else's font can't be shared
      assert.equal((await call(member, 'POST', `/api/teams/${team}/fonts`, { fontId: own.id })).status, 404)

      const list = (await call(viewer, 'GET', `/api/fonts?teamId=${team}`)).body
      assert.deepEqual(list.filter(f => f.teamId).map(f => f.familyName).sort(), ['Jost', 'Lato'])
      assert.ok(!(await call(other, 'GET', '/api/fonts')).body.some(f => f.teamId))

      // Removing their own copy leaves the team's
      assert.equal((await call(other, 'DELETE', `/api/fonts/${own.id}`)).status, 200)
      assert.ok((await call(member, 'GET', `/api/fonts?teamId=${team}`)).body.some(f => f.id === shared.body.id))
      assert.equal((await call(member, 'DELETE', `/api/teams/${team}/fonts/${shared.body.id}`)).status, 403)
      assert.equal((await call(owner, 'DELETE', `/api/teams/${team}/fonts/${shared.body.id}`)).status, 200)
    })
  })

  describe('templates', () => {
    let template

    it('saves a team deck as one of the team\'s templates', async () => {
      await call(owner, 'PUT', `/api/presentations/${teamDeck}`, { title: 'Team deck', slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: 'Hello team', x: 0, y: 0, width: 100, height: 50 }] }] })
      const res = await call(member, 'POST', `/api/teams/${team}/templates`, { presentationId: teamDeck, title: 'Group meeting' })
      assert.equal(res.status, 201, JSON.stringify(res.body))
      template = res.body.id
      assert.equal((await call(viewer, 'POST', `/api/teams/${team}/templates`, { presentationId: teamDeck })).status, 403)
      const personal = await createDeck(member, 'Mine')
      assert.equal((await call(member, 'POST', `/api/teams/${team}/templates`, { presentationId: personal })).status, 404)
    })

    it('lists it for the team, not among anyone\'s own templates', async () => {
      const list = (await call(viewer, 'GET', `/api/teams/${team}/templates`)).body
      assert.ok(list.some(x => x.id === template && x.title === 'Group meeting' && x.teamId === team))
      assert.ok(!(await call(member, 'GET', '/api/templates')).body.some(x => x.id === template))
      assert.equal((await call(member, 'GET', `/api/templates/${template}`)).status, 404)
      assert.equal((await call(outsider, 'GET', `/api/teams/${team}/templates`)).status, 404)
    })

    it('starts the team\'s presentations from it, and no one else\'s', async () => {
      const made = await call(other, 'POST', '/api/presentations', { templateId: template, teamId: team })
      assert.equal(made.status, 201, JSON.stringify(made.body))
      assert.equal(made.body.title, 'Group meeting')
      assert.ok(JSON.stringify(made.body.slides).includes('Hello team'))
      const outside = await call(outsider, 'POST', '/api/presentations', { templateId: template })
      assert.equal(outside.status, 201)
      assert.ok(!JSON.stringify(outside.body.slides).includes('Hello team'))
    })

    it('lets whoever saved it, admins and the owner delete it', async () => {
      assert.equal((await call(other, 'DELETE', `/api/teams/${team}/templates/${template}`)).status, 403)
      assert.equal((await call(admin, 'DELETE', `/api/teams/${team}/templates/${template}`)).status, 200)
      assert.equal((await call(owner, 'GET', `/api/teams/${team}/templates`)).body.length, 0)
    })
  })

  it('keeps a lapsed team\'s library as it is', async () => {
    await pool.query("UPDATE teams SET status = 'lapsed' WHERE id = $1", [team])
    try {
      assert.equal((await call(owner, 'POST', `/api/teams/${team}/themes`, { name: 'Late', base: 'white' })).status, 403)
      assert.equal((await call(owner, 'POST', `/api/teams/${team}/fonts`, { familyName: 'Inter' })).status, 403)
      const lib = await call(viewer, 'GET', `/api/teams/${team}/library`)
      assert.equal(lib.status, 200)
      assert.ok(Array.isArray(lib.body.datasets) && lib.body.datasets.length > 0)
    } finally {
      await pool.query("UPDATE teams SET status = 'active' WHERE id = $1", [team])
    }
  })
})

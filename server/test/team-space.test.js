// A team's decks and folders, through the HTTP API, against a real Postgres:
// who can open, change, file and move a team deck, and the team's shared
// storage. Needs TEST_DATABASE_URL, as collaboration.test.js describes;
// skipped without it.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { DB, startCloudServer } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'
const GB = 1024 * 1024 * 1024

function imageUpload() {
  const boundary = `----parallax${crypto.randomBytes(8).toString('hex')}`
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000'
    + '1f15c4890000000d49444154789c6360000002000100e221bc330000000049454e44ae426082', 'hex')
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="dot.png"\r\nContent-Type: image/png\r\n\r\n`),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  return { body, headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } }
}

describe('a team\'s decks and folders', { skip }, () => {
  let t, call, userId, pool, createDeck
  let siteAdmin, owner, admin, member, other, viewer, outsider
  let team, otherTeam, deck

  const upload = (who, id) => {
    const { body, headers } = imageUpload()
    return call(who, 'POST', `/api/presentations/${id}/upload`, body, headers)
  }
  const space = async who => (await call(who, 'GET', `/api/teams/${team}/space`)).body
  const join = async (who, teamId, role, by) => {
    const { token } = (await call(by, 'POST', `/api/teams/${teamId}/invites`, { role })).body
    assert.equal((await call(who, 'POST', `/api/team-invites/${token}/accept`)).status, 200)
  }
  // A file row of `bytes` on deck id, as if it had been uploaded
  const fakeFile = async (id, who, bytes) => pool.query(
    `INSERT INTO uploads (presentation_id, user_id, filename, storage_key, content_type, size_bytes)
     VALUES ($1, $2, 'big.bin', $3, 'application/octet-stream', $4)`,
    [id, await userId(who), `test/${crypto.randomUUID()}`, bytes]
  )

  before(async () => {
    t = await startCloudServer()
    ;({ call, userId, pool, createDeck } = t)
    ;[siteAdmin, owner, admin, member, other, viewer, outsider] =
      ['site-admin', 'owner', 'admin', 'member', 'other', 'viewer', 'outsider'].map(t.user)
    process.env.ADMIN_USER_IDS = siteAdmin
    for (const who of [siteAdmin, owner, admin, member, other, viewer, outsider]) await call(who, 'GET', '/api/me')
    const made = await call(siteAdmin, 'POST', '/api/admin/teams', { name: `Lab ${t.run}`, ownerEmail: `${owner}@test.local`, seats: 4 })
    team = made.body.team.id
    await join(admin, team, 'admin', owner)
    await join(member, team, 'member', owner)
    await join(other, team, 'member', owner)
    await join(viewer, team, 'viewer', owner)
    otherTeam = (await call(siteAdmin, 'POST', '/api/admin/teams', { name: `Other ${t.run}`, ownerEmail: `${outsider}@test.local`, seats: 2 })).body.team.id
  })

  after(() => t?.stop())

  it('makes decks in the team for its owner, admins and members, not its viewers', async () => {
    const res = await call(member, 'POST', '/api/presentations', { title: 'Group meeting', teamId: team })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.equal(res.body.teamId, team)
    assert.equal(res.body.expiresAt, undefined)
    deck = res.body.id
    assert.equal((await call(viewer, 'POST', '/api/presentations', { title: 'No', teamId: team })).status, 403)
    assert.equal((await call(outsider, 'POST', '/api/presentations', { title: 'No', teamId: team })).status, 404)
    const { rows } = await pool.query('SELECT team_id, user_id, data FROM presentations WHERE id = $1', [deck])
    assert.equal(rows[0].team_id, team)
    assert.equal(rows[0].user_id, await userId(member))
    assert.equal(rows[0].data.teamId, undefined)
  })

  it('lists team decks in the team\'s space, not on anyone\'s own list or plan', async () => {
    const mine = (await call(member, 'GET', '/api/presentations')).body
    assert.ok(!mine.some(p => p.id === deck))
    assert.equal((await call(member, 'GET', '/api/me')).body.presentationCount, 0)
    // A free plan's three decks don't stop more team decks
    for (const n of [1, 2, 3]) await createDeck(member, `Own ${n}`)
    assert.equal((await call(member, 'POST', '/api/presentations', { title: 'Fourth own' })).status, 403)
    assert.equal((await call(member, 'POST', '/api/presentations', { title: 'Another team deck', teamId: team })).status, 201)

    const roles = async who => Object.fromEntries((await space(who)).presentations.map(p => [p.title, p.role]))
    assert.equal((await roles(member))['Group meeting'], 'owner')
    assert.equal((await roles(other))['Group meeting'], 'editor')
    assert.equal((await roles(viewer))['Group meeting'], 'viewer')
    assert.equal((await roles(admin))['Group meeting'], 'owner')
    assert.equal((await call(outsider, 'GET', `/api/teams/${team}/space`)).status, 404)
    const s = await space(owner)
    assert.equal(s.team.canCreate, true)
    assert.equal(s.storage.limit, 4 * 25 * GB)
    assert.equal((await space(viewer)).team.canCreate, false)
  })

  it('lets members edit team decks and viewers only look', async () => {
    assert.equal((await call(viewer, 'GET', `/api/presentations/${deck}`)).status, 200)
    assert.equal((await call(viewer, 'GET', `/api/presentations/${deck}/present`)).status, 200)
    const refused = await call(viewer, 'PUT', `/api/presentations/${deck}`, { title: 'Viewer was here' })
    assert.equal(refused.status, 403)
    assert.match(refused.body.error, /view this presentation but not change it/)
    assert.equal((await upload(viewer, deck)).status, 403)
    assert.equal((await call(viewer, 'POST', `/api/presentations/${deck}/snapshot`, { name: 'v' })).status, 403)
    assert.equal((await call(viewer, 'POST', `/api/presentations/${deck}/duplicate`)).status, 403)
    assert.equal((await call(outsider, 'GET', `/api/presentations/${deck}`)).status, 404)

    assert.equal((await call(other, 'PUT', `/api/presentations/${deck}`, { title: 'Group meeting, edited' })).status, 200)
    assert.equal((await upload(other, deck)).status, 200)
  })

  it('leaves deleting, sharing and live presenting to the team\'s owner and admins and the deck\'s maker', async () => {
    for (const [method, url] of [['DELETE', `/api/presentations/${deck}`], ['POST', `/api/presentations/${deck}/share`], ['POST', `/api/presentations/${deck}/live/start`]]) {
      assert.equal((await call(other, method, url)).status, 403, `${method} ${url}`)
    }
    assert.deepEqual((await call(other, 'GET', `/api/presentations/${deck}/share`)).body, { shared: false, token: null })
    assert.equal((await call(member, 'POST', `/api/presentations/${deck}/share`)).status, 200)
    assert.equal((await call(admin, 'GET', `/api/presentations/${deck}/share`)).body.shared, true)
    assert.equal((await call(admin, 'DELETE', `/api/presentations/${deck}/share`)).status, 200)
    const doomed = (await call(other, 'POST', '/api/presentations', { title: 'Doomed', teamId: team })).body.id
    assert.equal((await call(admin, 'DELETE', `/api/presentations/${doomed}`)).status, 200)
  })

  it('copies a team deck into the same team and folder, as the copier\'s', async () => {
    const folder = (await call(member, 'POST', `/api/teams/${team}/folders`, { name: 'Talks' })).body
    const filed = (await call(member, 'POST', '/api/presentations', { title: 'Colloquium', teamId: team, folderId: folder.id })).body.id
    const copy = await call(other, 'POST', `/api/presentations/${filed}/duplicate`)
    assert.equal(copy.status, 201, JSON.stringify(copy.body))
    assert.equal(copy.body.teamId, team)
    assert.equal(copy.body.folderId, folder.id)
    const { rows } = await pool.query('SELECT user_id, team_id, folder_id FROM presentations WHERE id = $1', [copy.body.id])
    assert.deepEqual(rows[0], { user_id: await userId(other), team_id: team, folder_id: folder.id })
  })

  it('keeps folders: members make and rename them, owners and admins delete them', async () => {
    const res = await call(other, 'POST', `/api/teams/${team}/folders`, { name: 'Journal club' })
    assert.equal(res.status, 201)
    const folder = res.body.id
    assert.equal((await call(other, 'POST', `/api/teams/${team}/folders`, { name: 'journal CLUB' })).status, 409)
    assert.equal((await call(viewer, 'POST', `/api/teams/${team}/folders`, { name: 'Mine' })).status, 403)
    assert.equal((await call(other, 'POST', `/api/teams/${team}/folders`, { name: '   ' })).status, 400)
    assert.equal((await call(other, 'PATCH', `/api/teams/${team}/folders/${folder}`, { name: 'Journal club 2026' })).body.name, 'Journal club 2026')

    const filed = (await call(other, 'POST', '/api/presentations', { title: 'Paper', teamId: team, folderId: folder })).body.id
    // A folder of another team isn't a place in this one
    const elsewhere = (await call(outsider, 'POST', `/api/teams/${otherTeam}/folders`, { name: 'Theirs' })).body.id
    assert.equal((await call(member, 'POST', '/api/presentations', { title: 'No', teamId: team, folderId: elsewhere })).status, 404)

    assert.equal((await call(other, 'DELETE', `/api/teams/${team}/folders/${folder}`)).status, 403)
    assert.equal((await call(admin, 'DELETE', `/api/teams/${team}/folders/${folder}`)).status, 200)
    const s = await space(other)
    assert.ok(!s.folders.some(f => f.id === folder))
    assert.equal(s.presentations.find(p => p.id === filed).folderId, null)
  })

  it('moves a personal deck into the team, and a team deck out to whoever takes it', async () => {
    const own = await createDeck(owner, 'Grant talk')
    const folder = (await call(owner, 'POST', `/api/teams/${team}/folders`, { name: 'Grants' })).body.id
    assert.equal((await call(admin, 'PUT', `/api/presentations/${own}/location`, { teamId: team })).status, 404)
    const moved = await call(owner, 'PUT', `/api/presentations/${own}/location`, { teamId: team, folderId: folder })
    assert.equal(moved.status, 200, JSON.stringify(moved.body))
    assert.ok(!(await call(owner, 'GET', '/api/presentations')).body.some(p => p.id === own))
    assert.equal((await space(member)).presentations.find(p => p.id === own).folderId, folder)
    // Now its team's members can open it
    assert.equal((await call(other, 'GET', `/api/presentations/${own}`)).status, 200)

    // Only its owners move it on
    assert.equal((await call(other, 'PUT', `/api/presentations/${own}/location`, { teamId: null })).status, 403)
    assert.equal((await call(member, 'PUT', `/api/presentations/${own}/location`, { teamId: team, folderId: null })).status, 403)
    // ...and not into a team where they only view
    await join(owner, otherTeam, 'viewer', outsider)
    assert.equal((await call(owner, 'PUT', `/api/presentations/${own}/location`, { teamId: otherTeam })).status, 403)

    // An admin takes it into their own space: it's theirs now, files and all
    await fakeFile(own, owner, 1000)
    const out = await call(admin, 'PUT', `/api/presentations/${own}/location`, { teamId: null })
    assert.equal(out.status, 200)
    assert.equal(out.body.ownerChanged, true)
    assert.ok((await call(admin, 'GET', '/api/presentations')).body.some(p => p.id === own))
    assert.equal((await call(owner, 'GET', `/api/presentations/${own}`)).status, 404)
    const { rows } = await pool.query('SELECT DISTINCT user_id FROM uploads WHERE presentation_id = $1', [own])
    assert.deepEqual(rows.map(r => r.user_id), [await userId(admin)])
  })

  it('shares the team\'s storage, seats × the plan\'s, apart from its members\' own', async () => {
    const big = (await call(member, 'POST', '/api/presentations', { title: 'Big data', teamId: team })).body.id
    // Three seats' worth used of four
    await fakeFile(big, member, 75 * GB)
    assert.equal((await call(member, 'GET', '/api/me')).body.storageUsed < GB, true)
    assert.ok((await space(member)).storage.used >= 75 * GB)
    assert.equal((await upload(other, big)).status, 200)

    // A personal deck too big for what's left can't come in
    const own = await createDeck(admin, 'Raw images')
    await fakeFile(own, admin, 26 * GB)
    const refused = await call(admin, 'PUT', `/api/presentations/${own}/location`, { teamId: team })
    assert.equal(refused.status, 413)
    assert.match(refused.body.error, /doesn't have room/)

    // Uploads stop at the team's limit, with the team's words
    await fakeFile(big, member, 26 * GB)
    const full = await upload(other, big)
    assert.equal(full.status, 413)
    assert.match(full.body.error, /team's storage is full/)
  })

  it('turns every team deck read-only once the team has lapsed', async () => {
    assert.equal((await call(siteAdmin, 'PUT', `/api/admin/teams/${team}`, { status: 'lapsed' })).status, 200)
    const refused = await call(owner, 'PUT', `/api/presentations/${deck}`, { title: 'Too late' })
    assert.equal(refused.status, 403)
    assert.match(refused.body.error, /subscription has ended/)
    assert.equal((await call(owner, 'GET', `/api/presentations/${deck}`)).status, 200)
    assert.equal((await call(admin, 'DELETE', `/api/presentations/${deck}`)).status, 403)
    assert.equal((await call(member, 'POST', '/api/presentations', { title: 'No', teamId: team })).status, 403)
    assert.equal((await call(member, 'POST', `/api/teams/${team}/folders`, { name: 'No' })).status, 403)
    assert.ok((await space(admin)).presentations.every(p => p.role === 'viewer'))
    assert.equal((await call(siteAdmin, 'PUT', `/api/admin/teams/${team}`, { status: 'active' })).status, 200)
    assert.equal((await call(owner, 'PUT', `/api/presentations/${deck}`, { title: 'Group meeting' })).status, 200)
  })

  it('revokes the AI collaborator links someone made on team decks when they leave, and keeps their decks', async () => {
    const link = await call(other, 'POST', `/api/presentations/${deck}/ai-links`, { name: 'Claude' })
    assert.equal(link.status, 201, JSON.stringify(link.body))
    assert.equal((await call(viewer, 'POST', `/api/presentations/${deck}/ai-links`, { name: 'Claude' })).status, 403)
    const theirs = (await call(other, 'POST', '/api/presentations', { title: 'Left behind', teamId: team })).body.id
    assert.equal((await call(other, 'DELETE', `/api/teams/${team}/members/${await userId(other)}`)).status, 200)
    const { rows } = await pool.query('SELECT revoked_at FROM ai_links WHERE created_by = $1 AND presentation_id = $2', [await userId(other), deck])
    assert.ok(rows.length && rows.every(r => r.revoked_at))
    assert.equal((await call(other, 'GET', `/api/presentations/${theirs}`)).status, 404)
    assert.ok((await space(admin)).presentations.some(p => p.id === theirs && p.creatorName))
  })
})

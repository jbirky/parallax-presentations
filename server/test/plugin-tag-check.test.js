// The check for new version tags of listed community plugins
// (services/plugin-tag-check.js), as an admin runs it from /admin; the
// nightly run is the same check. Against a real Postgres with migrations
// 021 and 022, as helpers.js describes; GitHub is the stand-in in
// fake-github.js. Skipped without TEST_DATABASE_URL.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const pluginImport = require('../services/plugin-import')
const { fakeGitHub, pluginFiles } = require('./fake-github')
const { DB, startCloudServer } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'

describe('the check for new plugin versions', { skip }, () => {
  let t, admin, author, owner, slug, id, type, repo
  const real = { fetchVersion: pluginImport.fetchVersion, lookupRepo: pluginImport.lookupRepo }
  const check = () => t.call(admin, 'POST', '/api/admin/plugin-versions/check')
  const ours = list => list.filter(x => x.slug === slug)

  before(async () => {
    t = await startCloudServer()
    admin = t.user('admin')
    author = t.user('author')
    process.env.ADMIN_USER_IDS = admin
    owner = `tagcheck-${t.run}`
    slug = `${owner}--waves`
    id = `io.github.tagcheck${t.run}.waves`
    type = `waves-${t.run}`
    const gh = fakeGitHub()
    repo = gh.repo(owner, 'waves')
    repo.tag('v1.0.0', pluginFiles({ id, type }))
    pluginImport.lookupRepo = url => real.lookupRepo(url, { fetcher: gh.fetcher })
    pluginImport.fetchVersion = (url, tag, opts = {}) => real.fetchVersion(url, tag, { fetcher: gh.fetcher, repo: opts.repo })
    const imported = await t.call(author, 'POST', '/api/plugin-repos/import', { url: `${owner}/waves`, tag: 'v1.0.0' })
    assert.equal(imported.status, 201, JSON.stringify(imported.body))
    assert.equal((await t.call(admin, 'POST', `/api/admin/plugin-versions/${imported.body.id}/approve`)).status, 200)
  })
  after(async () => {
    Object.assign(pluginImport, real)
    await t.pool.query('DELETE FROM plugins WHERE repo_owner = $1', [owner])
    await t.stop()
  })

  it('is for admins only', async () => {
    assert.equal((await t.call(author, 'POST', '/api/admin/plugin-versions/check')).status, 404)
    assert.equal((await t.call(author, 'GET', '/api/admin/plugin-versions/summary')).status, 404)
  })

  it('imports newer version tags for review, under the last importer’s name, and says which break the rules', async () => {
    repo.tag('v0.9.0', pluginFiles({ id, type, version: '0.9.0' }))
    repo.tag('v1.1.0', pluginFiles({ id, type, version: '1.1.0' }))
    repo.tag('v1.2.0', pluginFiles({ id, type, version: '1.2.0' }))
    repo.tag('v1.3.0', pluginFiles({ id, type, version: '1.3.0', manifest: { main: './plugin.js' } }))
    const run = (await check()).body
    assert.equal(run.error, null)
    assert.deepEqual(ours(run.imported).map(i => i.version), ['1.1.0', '1.2.0'])
    const [refused] = ours(run.refused)
    assert.equal(refused.tag, 'v1.3.0')
    assert.match(refused.problems.join(' '), /“main” isn’t allowed/)

    const theirs = (await t.call(author, 'GET', '/api/me/plugin-submissions')).body.filter(v => v.pluginId === id)
    assert.deepEqual(theirs.map(v => [v.version, v.status]), [['1.2.0', 'pending'], ['1.1.0', 'pending'], ['1.0.0', 'approved']])
    const queue = (await t.call(admin, 'GET', '/api/admin/plugin-versions')).body.filter(v => v.pluginId === id)
    assert.deepEqual(queue.map(v => [v.version, v.foundByCheck, v.submitterEmail]), [['1.2.0', true, `${author}@test.local`], ['1.1.0', true, `${author}@test.local`]])

    const summary = (await t.call(admin, 'GET', '/api/admin/plugin-versions/summary')).body
    assert.ok(summary.pending >= 2)
    assert.equal(summary.lastCheck.finishedAt, run.finishedAt)
    assert.equal(summary.nightly, false)
  })

  it('imports nothing it has already, and only the newest few of many', async () => {
    assert.deepEqual(ours((await check()).body.imported), [])
    for (const v of ['1.4.0', '1.5.0', '1.6.0', '1.7.0']) repo.tag(`v${v}`, pluginFiles({ id, type, version: v }))
    assert.deepEqual(ours((await check()).body.imported).map(i => i.version), ['1.5.0', '1.6.0', '1.7.0'])
  })

  it('stops when GitHub’s limit is used up', async () => {
    const lookup = pluginImport.lookupRepo
    pluginImport.lookupRepo = async () => { throw new pluginImport.PluginImportError('GitHub’s limit on requests from Parallax is used up', { status: 429 }) }
    try {
      const run = (await check()).body
      assert.match(run.error, /limit on requests/)
      assert.equal(run.checked, 0)
    } finally {
      pluginImport.lookupRepo = lookup
    }
  })
})

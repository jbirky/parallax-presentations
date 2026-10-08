// Community plugins: importing a tag of a GitHub repo, checked against the
// rules (services/plugin-import.js), then reviewing, listing, installing and
// drawing it in decks at the version each element records
// (services/community-plugins.js). GitHub is the stand-in in fake-github.js.
// The first part needs no database; the second runs against a real
// Postgres with migration 021, as helpers.js describes, and is skipped
// without TEST_DATABASE_URL.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const pluginImport = require('../services/plugin-import')
const { withPluginCsp, pluginCsp } = require('../services/plugin-embed')
const { fakeGitHub, pluginFiles } = require('./fake-github')
const { DB, startCloudServer } = require('./helpers')

const { fetchVersion, lookupRepo, checkManifest, compareVersions } = pluginImport

describe('importing a plugin from GitHub', () => {
  const gh = fakeGitHub()
  const lorenz = gh.repo('someone', 'lorenz', { stars: 7 })
  lorenz.tag('v1.0.0', pluginFiles())
  lorenz.tag('notes', pluginFiles())
  lorenz.tag('1.1.0', pluginFiles({ version: '1.1.0', manifest: { main: './plugin.js', contributes: { elementTypes: [{ type: 'lorenz', label: 'L' }], exportHooks: [{ id: 'x' }] } } }))
  gh.repo('someone', 'secret', { isPrivate: true })
  const opts = { fetcher: gh.fetcher }

  it('lists a repo’s version tags, newest first', async () => {
    const repo = await lookupRepo('https://github.com/Someone/lorenz.git', opts)
    assert.equal(repo.owner, 'someone')
    assert.equal(repo.stars, 7)
    assert.deepEqual(repo.tags.map(t => t.name), ['1.1.0', 'v1.0.0'])
    await assert.rejects(lookupRepo('someone/secret', opts), { status: 404 })
    await assert.rejects(lookupRepo('https://gitlab.com/someone/lorenz', opts), /Only GitHub/)
  })

  it('fetches a tag’s dist/ files and README, checked against the commit, in three API calls', async () => {
    gh.calls.length = 0
    const v = await fetchVersion('someone/lorenz', 'v1.0.0', opts)
    assert.equal(v.version, '1.0.0')
    assert.equal(v.commitSha.length, 40)
    assert.deepEqual(v.files.map(f => f.path), ['sandbox.html'])
    assert.equal(v.files[0].contentType, 'text/html; charset=utf-8')
    assert.equal(v.manifest.sandbox, 'sandbox.html')
    assert.deepEqual(v.manifest.permissions, ['network:cdn.jsdelivr.net'])
    assert.match(v.readme, /strange attractor/)
    assert.match(v.sha256, /^[0-9a-f]{64}$/)
    assert.equal(gh.calls.filter(u => u.startsWith('https://api.github.com')).length, 3)
  })

  it('refuses a plugin with main, or contributions that need it, naming each rule', async () => {
    const err = await fetchVersion('someone/lorenz', '1.1.0', opts).catch(e => e)
    assert.equal(err.status, 400)
    assert.equal(err.problems.length, 2)
    assert.match(err.problems.join('\n'), /“main” isn’t allowed/)
    assert.match(err.problems.join('\n'), /contributes\.exportHooks/)
  })

  it('refuses a tag that isn’t a version, and a file that doesn’t match its commit', async () => {
    await assert.rejects(fetchVersion('someone/lorenz', 'notes', opts), { status: 404 })
    const tampered = async (url, o) => {
      const res = await gh.fetcher(url, o)
      return url.endsWith('/dist/sandbox.html') ? { ...res, body: Buffer.from('<script>evil()</script>') } : res
    }
    await assert.rejects(fetchVersion('someone/lorenz', 'v1.0.0', { fetcher: tampered }), /didn’t match the commit’s copy/)
  })

  it('checks the manifest’s fields', () => {
    const files = new Set(['sandbox.html', 'icon.svg'])
    const base = JSON.parse(pluginFiles()['parallax-plugin.json'])
    const problems = m => checkManifest({ ...base, ...m }, { version: '1.0.0', files }).problems
    assert.deepEqual(problems({}), [])
    assert.match(problems({ id: 'com.parallax.lorenz' })[0], /kept for the plugins that come with Parallax/)
    assert.match(problems({ id: 'Lorenz' })[0], /reverse-DNS/)
    assert.match(problems({ version: '1.0.1' })[0], /the tag says 1\.0\.0/)
    assert.match(problems({ sandbox: '../secret.html' })[0], /“sandbox” must name an \.html file/)
    assert.match(problems({ sandbox: 'missing.html' })[0], /isn’t in the repo/)
    assert.match(problems({ permissions: ['camera'] })[0], /network:<host>/)
    assert.match(problems({ permissions: ['network:*'] })[0], /network:<host>/)
    assert.match(problems({ license: '' })[0], /“license” is required/)
    assert.match(problems({ categories: ['cooking'] })[0], /“categories”/)
    assert.deepEqual(problems({ icon: './icon.svg' }), [])
    const kept = checkManifest({ ...base, extra: 1, icon: './icon.svg' }, { version: '1.0.0', files }).manifest
    assert.equal(kept.extra, undefined)
    assert.equal(kept.icon, 'icon.svg')
  })

  it('orders versions as semver does', () => {
    assert.deepEqual(['1.10.0', '1.2.0', '1.2.0-beta.10', '1.2.0-beta.2', '0.9.9'].sort(compareVersions), ['0.9.9', '1.2.0-beta.2', '1.2.0-beta.10', '1.2.0', '1.10.0'])
  })

  it('puts the CSP before anything the plugin wrote', () => {
    const csp = pluginCsp(['network:cdn.jsdelivr.net'])
    assert.match(csp, /default-src 'none'/)
    assert.match(csp, /connect-src https:\/\/cdn\.jsdelivr\.net/)
    assert.match(pluginCsp([]), /connect-src 'none'/)
    const meta = '<meta http-equiv="Content-Security-Policy"'
    assert.ok(withPluginCsp('<!DOCTYPE html>\n<html><head>', []).startsWith(`<!DOCTYPE html>${meta}`))
    // A script before <head>, or a <head> inside a comment, can't come first
    assert.ok(withPluginCsp('<!doctype html><script>x()</script><head>', []).startsWith(`<!doctype html>${meta}`))
    assert.ok(withPluginCsp('<!-- <head> --><script>x()</script>', []).startsWith(`<!-- <head> -->${meta}`))
    assert.ok(withPluginCsp('<script>x()</script>', []).startsWith(meta))
  })
})

const skip = DB ? false : 'TEST_DATABASE_URL is not set'

describe('community plugins', { skip }, () => {
  let t, admin, author, someone, gh, owner, repoUrl, id, type
  const real = { fetchVersion: pluginImport.fetchVersion, lookupRepo: pluginImport.lookupRepo }

  // A deck's page as its owner presents it
  async function presented(who, deckId) {
    const res = await fetch(`${t.base}/api/presentations/${deckId}/present`, { headers: { 'X-Test-User': who } })
    assert.equal(res.status, 200)
    return res.text()
  }
  const sandboxOf = (who, version = '1.0.0') =>
    fetch(`${t.base}/api/plugin-versions/${id}/${version}/sandbox`, { headers: who ? { 'X-Test-User': who } : {} })

  before(async () => {
    t = await startCloudServer()
    admin = t.user('admin')
    author = t.user('author')
    someone = t.user('someone')
    process.env.ADMIN_USER_IDS = admin
    owner = `someone-${t.run}`
    id = `io.github.someone${t.run}.lorenz`
    type = `lorenz-${t.run}`
    repoUrl = `https://github.com/${owner}/lorenz`
    gh = fakeGitHub()
    const repo = gh.repo(owner, 'lorenz')
    repo.tag('v1.0.0', pluginFiles({ id, type }))
    repo.tag('v1.1.0', pluginFiles({ id, type, version: '1.1.0' }))
    const thief = gh.repo(owner, 'thief')
    thief.tag('v1.0.0', pluginFiles({ id, type: `other-${t.run}` }))
    thief.tag('v2.0.0', pluginFiles({ id: `io.github.thief${t.run}.x`, type, version: '2.0.0' }))
    thief.tag('v3.0.0', pluginFiles({ id: `io.github.thief${t.run}.y`, type: 'counter', version: '3.0.0' }))
    pluginImport.fetchVersion = (url, tag) => real.fetchVersion(url, tag, { fetcher: gh.fetcher })
    pluginImport.lookupRepo = url => real.lookupRepo(url, { fetcher: gh.fetcher })
  })
  after(async () => {
    Object.assign(pluginImport, real)
    await t.pool.query('DELETE FROM plugins WHERE repo_owner = $1', [owner])
    await t.stop()
  })

  it('imports a tag as a version waiting for review', async () => {
    const looked = await t.call(author, 'POST', '/api/plugin-repos/lookup', { url: repoUrl })
    assert.equal(looked.status, 200, JSON.stringify(looked.body))
    assert.deepEqual(looked.body.tags.map(tag => [tag.name, tag.status]), [['v1.1.0', null], ['v1.0.0', null]])

    const imported = await t.call(author, 'POST', '/api/plugin-repos/import', { url: repoUrl, tag: 'v1.0.0' })
    assert.equal(imported.status, 201, JSON.stringify(imported.body))
    assert.equal(imported.body.status, 'pending')
    assert.equal(imported.body.slug, `${owner}--lorenz`)
    assert.equal(imported.body.pluginId, id)

    assert.equal((await t.call(author, 'POST', '/api/plugin-repos/import', { url: repoUrl, tag: 'v1.0.0' })).status, 409)
    assert.equal((await t.call(null, 'POST', '/api/plugin-repos/import', { url: repoUrl, tag: 'v1.0.0' })).status, 401)
    const again = await t.call(author, 'POST', '/api/plugin-repos/lookup', { url: repoUrl })
    assert.equal(again.body.tags.find(tag => tag.name === 'v1.0.0').status, 'pending')
    const mine = await t.call(author, 'GET', '/api/me/plugin-submissions')
    assert.deepEqual(mine.body.map(v => [v.version, v.status]), [['1.0.0', 'pending']])
  })

  it('keeps a pending version to its importer and admins', async () => {
    const own = await sandboxOf(author)
    assert.equal(own.status, 200)
    assert.equal(own.headers.get('content-security-policy'), 'sandbox allow-scripts')
    const page = await own.text()
    assert.ok(page.startsWith('<!DOCTYPE html><meta http-equiv="Content-Security-Policy"'))
    assert.match(page, /connect-src https:\/\/cdn\.jsdelivr\.net/)
    assert.equal((await sandboxOf(admin)).status, 200)
    assert.equal((await sandboxOf(someone)).status, 404)
    assert.equal((await sandboxOf(null)).status, 404)
    assert.ok(!(await t.call(null, 'GET', '/api/plugins')).body.some(p => p.pluginId === id))
    assert.equal((await t.call(null, 'GET', `/api/plugins/${owner}--lorenz`)).status, 404)
  })

  it('refuses another repo’s id or element type, and a bundled plugin’s type', async () => {
    const steal = tag => t.call(author, 'POST', '/api/plugin-repos/import', { url: `${owner}/thief`, tag })
    const sameId = await steal('v1.0.0')
    assert.equal(sameId.status, 409)
    assert.match(sameId.body.error, /belongs to github\.com/)
    const sameType = await steal('v2.0.0')
    assert.equal(sameType.status, 409)
    assert.match(sameType.body.error, new RegExp(`“${type}” belongs to ${id.replace(/\./g, '\\.')}`))
    const bundledType = await steal('v3.0.0')
    assert.equal(bundledType.status, 409)
    assert.match(bundledType.body.error, /“counter” belongs to com\.parallax\.animated-counter/)
  })

  it('is reviewed by admins only', async () => {
    assert.equal((await t.call(someone, 'GET', '/api/admin/plugin-versions')).status, 404)
    const queue = await t.call(admin, 'GET', '/api/admin/plugin-versions')
    assert.equal(queue.status, 200)
    const v = queue.body.find(x => x.pluginId === id)
    assert.equal(v.submitterEmail, `${author}@test.local`)
    assert.deepEqual(v.files.map(f => f.path), ['sandbox.html'])
    assert.equal(v.approved, null)
    assert.equal((await t.call(someone, 'POST', `/api/admin/plugin-versions/${v.id}/approve`)).status, 404)
    assert.equal((await t.call(admin, 'POST', `/api/admin/plugin-versions/${v.id}/revoke`)).status, 409)
    const approved = await t.call(admin, 'POST', `/api/admin/plugin-versions/${v.id}/approve`, { note: 'Looks good' })
    assert.equal(approved.status, 200)
    assert.equal(approved.body.status, 'approved')
  })

  it('lists an approved plugin, and installs it', async () => {
    const listed = (await t.call(null, 'GET', '/api/plugins')).body.find(p => p.pluginId === id)
    assert.equal(listed.community, true)
    assert.equal(listed.version, '1.0.0')
    assert.deepEqual(listed.repo, { owner, name: 'lorenz' })
    assert.equal((await sandboxOf(null)).status, 200)

    assert.equal((await t.call(someone, 'POST', `/api/plugins/${owner}--lorenz/install`)).status, 200)
    assert.equal((await t.call(someone, 'POST', `/api/plugins/${owner}--lorenz/install`)).status, 200)
    const installed = (await t.call(someone, 'GET', '/api/me/plugins')).body
    assert.deepEqual(installed.map(p => [p.pluginId, p.version]), [[id, '1.0.0']])
    const { rows: [{ downloads }] } = await t.pool.query('SELECT downloads FROM plugins WHERE manifest_id = $1', [id])
    assert.equal(downloads, 1)
    assert.equal((await t.call(someone, 'POST', '/api/plugins/animated-counter/install')).status, 404)
  })

  it('draws each element at its version in deck pages, with the CSP, until it’s revoked', async () => {
    const deck = await t.createDeck(someone, `Chaos ${t.run}`, {
      slides: [{ id: 's1', elements: [
        { id: 'e1', type: `plugin:${type}`, pluginId: id, pluginVersion: '1.0.0', x: 0, y: 0, width: 400, height: 300, pluginData: { sigma: 10 } },
        { id: 'e2', type: 'plugin:counter', pluginId: 'com.parallax.animated-counter', x: 0, y: 300, width: 200, height: 100, pluginData: {} },
      ] }],
    })
    let html = await presented(someone, deck)
    assert.ok(html.includes('id=&quot;lorenz-1.0.0&quot;'))
    assert.ok(html.includes('http-equiv=&quot;Content-Security-Policy&quot;'))
    assert.ok(html.includes('id=&quot;val&quot;'), 'the bundled plugin is drawn from its folder')

    // A newer approved version is listed; the deck keeps its own
    const v11 = await t.call(author, 'POST', '/api/plugin-repos/import', { url: repoUrl, tag: 'v1.1.0' })
    assert.equal(v11.status, 201)
    const queued = (await t.call(admin, 'GET', '/api/admin/plugin-versions')).body.find(x => x.id === v11.body.id)
    assert.deepEqual(queued.approved, { version: '1.0.0', tag: 'v1.0.0' })
    assert.equal((await t.call(admin, 'POST', `/api/admin/plugin-versions/${v11.body.id}/approve`)).status, 200)
    assert.equal((await t.call(null, 'GET', '/api/plugins')).body.find(p => p.pluginId === id).version, '1.1.0')
    html = await presented(someone, deck)
    assert.ok(html.includes('id=&quot;lorenz-1.0.0&quot;'))
    assert.ok(!html.includes('lorenz-1.1.0'))

    const v10 = (await t.call(admin, 'GET', '/api/admin/plugin-versions?status=approved')).body.find(x => x.pluginId === id && x.version === '1.0.0')
    assert.equal((await t.call(admin, 'POST', `/api/admin/plugin-versions/${v10.id}/revoke`, { note: 'Sends data away' })).status, 200)
    html = await presented(someone, deck)
    assert.ok(!html.includes('lorenz-1.0.0'))
    assert.ok(html.includes('This plugin isn’t available'))
    assert.equal((await sandboxOf(someone)).status, 404)
    assert.equal((await sandboxOf(admin)).status, 200)
    assert.equal((await t.call(null, 'GET', '/api/plugins')).body.find(p => p.pluginId === id).version, '1.1.0')
    const mine = (await t.call(author, 'GET', '/api/me/plugin-submissions')).body
    assert.deepEqual(mine.map(v => [v.version, v.status, v.reviewNote]), [['1.1.0', 'approved', ''], ['1.0.0', 'revoked', 'Sends data away']])
  })

  it('unlists a plugin with no approved version left', async () => {
    const v11 = (await t.call(admin, 'GET', '/api/admin/plugin-versions?status=approved')).body.find(x => x.pluginId === id)
    assert.equal((await t.call(admin, 'POST', `/api/admin/plugin-versions/${v11.id}/revoke`)).status, 200)
    assert.ok(!(await t.call(null, 'GET', '/api/plugins')).body.some(p => p.pluginId === id))
    assert.deepEqual((await t.call(someone, 'GET', '/api/me/plugins')).body, [])
  })
})

// The theme library in the cloud version (/api/themes, migration 026): each
// person's saved themes, theirs alone, checked as client/src/utils/
// customTheme.js describes. Needs TEST_DATABASE_URL (helpers.js); without
// it the tests are skipped.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { DB, startCloudServer } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'
let t, call, pool, owner, other

describe('the theme library', { skip }, () => {
  before(async () => {
    t = await startCloudServer()
    ;({ call, pool } = t)
    ;[owner, other] = ['themer', 'other'].map(t.user)
    for (const who of [owner, other]) assert.equal((await call(who, 'GET', '/api/me')).status, 200)
  })
  after(() => t?.stop())

  it('saves, lists, replaces and deletes a theme, counting its versions', async () => {
    const saved = await call(owner, 'POST', '/api/themes', { name: 'Lab talks', base: 'white', colors: { heading: '#d62828' }, textStyles: { h2Size: 48 }, css: 'h2 { color: red }' })
    assert.equal(saved.status, 201, JSON.stringify(saved.body))
    assert.deepEqual([saved.body.name, saved.body.base, saved.body.version, saved.body.colors, saved.body.textStyles], ['Lab talks', 'white', 1, { heading: '#d62828' }, { h2Size: 48 }])
    const second = await call(owner, 'POST', '/api/themes', { name: 'alpha', base: 'night' })
    assert.deepEqual((await call(owner, 'GET', '/api/themes')).body.map(x => x.name), ['alpha', 'Lab talks'])
    const changed = await call(owner, 'PUT', `/api/themes/${saved.body.id}`, { name: 'Lab talks 2', base: 'beige', font: 'Jost, sans-serif' })
    assert.deepEqual([changed.status, changed.body.version, changed.body.name, changed.body.base, changed.body.font, changed.body.css], [200, 2, 'Lab talks 2', 'beige', 'Jost, sans-serif', undefined])
    const { rows } = await pool.query('SELECT name, version FROM themes WHERE id = $1', [saved.body.id])
    assert.deepEqual(rows[0], { name: 'Lab talks 2', version: 2 })
    assert.equal((await call(owner, 'DELETE', `/api/themes/${second.body.id}`)).status, 200)
    assert.deepEqual((await call(owner, 'GET', '/api/themes')).body.map(x => x.id), [saved.body.id])
  })

  it("keeps each person's themes their own", async () => {
    const mine = await call(owner, 'POST', '/api/themes', { name: 'Private', base: 'moon' })
    assert.equal((await call(other, 'GET', '/api/themes')).body.length, 0)
    assert.equal((await call(other, 'PUT', `/api/themes/${mine.body.id}`, { name: 'Taken', base: 'white' })).status, 404)
    assert.equal((await call(other, 'DELETE', `/api/themes/${mine.body.id}`)).status, 404)
    assert.equal((await call(null, 'GET', '/api/themes')).status, 401)
  })

  it('says what is wrong with a theme it refuses', async () => {
    const bad = async (body, pattern) => {
      const res = await call(owner, 'POST', '/api/themes', body)
      assert.equal(res.status, 400)
      assert.match(res.body.error, pattern)
    }
    await bad({ base: 'white' }, /needs a name/)
    await bad({ name: 'x', base: 'neon' }, /base must be one of/)
    await bad({ name: 'x', base: 'white', colors: { heading: 'url(x)' } }, /colors must be/)
    await bad({ name: 'x', base: 'white', font: '};body{' }, /font family list/)
    assert.equal((await call(owner, 'PUT', '/api/themes/not-an-id', { name: 'x', base: 'white' })).status, 400)
  })
})

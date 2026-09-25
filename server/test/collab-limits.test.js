// The rate limit live editing's WebSocket uses (services/collab.js). Needs
// no database.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { tokenBucket } = require('../services/collab')

describe('the WebSocket rate limit', () => {
  it('allows a burst, then refuses until time has passed', () => {
    let now = 0
    const allow = tokenBucket(10, 3, () => now)
    assert.deepEqual([allow(), allow(), allow(), allow()], [true, true, true, false])
    now = 100 // a tenth of a second: one more
    assert.deepEqual([allow(), allow()], [true, false])
    now = 10000 // never more than the burst
    assert.deepEqual([allow(), allow(), allow(), allow()], [true, true, true, false])
  })

  it('counts bytes by their size', () => {
    let now = 0
    const allow = tokenBucket(1000, 5000, () => now)
    assert.equal(allow(4000), true)
    assert.equal(allow(2000), false)
    now = 1000
    assert.equal(allow(2000), true)
  })
})

// Which email domains count as schools for the education price
// (services/education.js). Needs no database.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { domainOf, isSchoolDomain } = require('../services/education')

describe('school email domains', () => {
  it('reads an email\'s domain', () => {
    assert.equal(domainOf('Kim@CS.UW.edu'), 'cs.uw.edu')
    assert.equal(domainOf('nobody'), '')
    assert.equal(domainOf(null), '')
  })

  it('knows schools by how their domains end', () => {
    for (const d of ['uw.edu', 'cs.uw.edu', 'unimelb.edu.au', 'ox.ac.uk', 'u-tokyo.ac.jp', 'lwsd.k12.wa.us']) {
      assert.equal(isSchoolDomain(d), true, d)
    }
    for (const d of ['gmail.com', 'edu.example.com', 'education.com', 'ac.uk.example.com', 'k12.com', '']) {
      assert.equal(isSchoolDomain(d), false, d)
    }
  })

  it('counts the domains an admin adds, and their subdomains', () => {
    assert.equal(isSchoolDomain('ethz.ch', ['ethz.ch']), true)
    assert.equal(isSchoolDomain('inf.ethz.ch', ['ethz.ch']), true)
    assert.equal(isSchoolDomain('notethz.ch', ['ethz.ch']), false)
  })
})

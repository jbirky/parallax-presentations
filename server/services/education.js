// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The education price (the pricing plan's "What to build", 1): Pro at a
// discount for students and educators, as a Stripe coupon
// (STRIPE_EDUCATION_COUPON) put on the checkout of anyone whose account has a
// verified school email in Clerk. A school email is one whose domain ends
// like a school's (.edu, .edu.au, .ac.uk, .k12.wa.us, ...) or is one of the
// domains kept in /admin (migration 032), such as ethz.ch. Promotions are
// promotion codes for a coupon, typed at checkout (allow_promotion_codes).

const SCHOOL_ENDINGS = [/\.edu$/, /\.edu\.[a-z]{2}$/, /\.ac\.[a-z]{2}$/, /\.k12\.[a-z]{2}\.us$/]
const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/
const CACHE_MS = 5 * 60 * 1000

class EducationError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

function domainOf(email) {
  const at = typeof email === 'string' ? email.lastIndexOf('@') : -1
  return at > 0 ? email.slice(at + 1).trim().toLowerCase() : ''
}

// Whether a domain is a school's: by its ending, or one of `extra` (itself
// or a subdomain of it, as cs.ethz.ch for ethz.ch)
function isSchoolDomain(domain, extra = []) {
  if (!domain) return false
  return SCHOOL_ENDINGS.some(re => re.test(domain)) || extra.some(d => domain === d || domain.endsWith(`.${d}`))
}

let cached = null
async function extraDomains(storage) {
  if (!storage?.query) return []
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.domains
  try {
    const { rows } = await storage.query('SELECT domain FROM education_domains ORDER BY domain')
    cached = { at: Date.now(), domains: rows.map(r => r.domain) }
  } catch (err) {
    if (err.code !== '42P01') throw err // before migration 032
    cached = { at: Date.now(), domains: [] }
  }
  return cached.domains
}

// The verified email addresses Clerk has for an account (its auth id)
async function verifiedEmails(authId) {
  if (!authId) return []
  const { clerkClient } = require('@clerk/express')
  const user = await clerkClient.users.getUser(authId)
  return (user.emailAddresses || [])
    .filter(e => e.verification?.status === 'verified')
    .map(e => e.emailAddress)
}

// Whether an account gets the education price: { eligible, domain }, domain
// being the school email's. Not eligible when Clerk can't be asked.
async function educationFor(storage, authId) {
  let emails
  try {
    emails = await verifiedEmails(authId)
  } catch (err) {
    console.error('Education check: Clerk failed:', err.message)
    return { eligible: false, domain: null }
  }
  const extra = await extraDomains(storage)
  const domain = emails.map(domainOf).find(d => isSchoolDomain(d, extra)) || null
  return { eligible: !!domain, domain }
}

// The coupon that makes the education price, or null when there's none
function educationCoupon() {
  return process.env.STRIPE_EDUCATION_COUPON || null
}

// --- The admin's list of school domains ---

async function listDomains(storage) {
  const { rows } = await storage.query('SELECT domain, note, created_at AS "createdAt" FROM education_domains ORDER BY domain')
  return rows
}

async function addDomain(storage, input, note) {
  const domain = String(input || '').trim().toLowerCase().replace(/^@/, '')
  if (!DOMAIN_RE.test(domain) || domain.length > 253) throw new EducationError(400, 'Give a domain, such as ethz.ch')
  const { rows } = await storage.query(
    `INSERT INTO education_domains (domain, note) VALUES ($1, $2)
     ON CONFLICT (domain) DO UPDATE SET note = EXCLUDED.note
     RETURNING domain, note, created_at AS "createdAt"`,
    [domain, String(note || '').trim().slice(0, 200) || null]
  )
  cached = null
  return rows[0]
}

async function removeDomain(storage, domain) {
  const { rowCount } = await storage.query('DELETE FROM education_domains WHERE domain = $1', [String(domain || '').toLowerCase()])
  cached = null
  if (!rowCount) throw new EducationError(404, 'No such domain')
}

module.exports = {
  EducationError, domainOf, isSchoolDomain, educationFor, educationCoupon, verifiedEmails,
  listDomains, addDomain, removeDomain,
}

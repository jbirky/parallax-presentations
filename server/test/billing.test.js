// Paying for plans and teams, through the HTTP API, against a real Postgres
// and a fake Stripe that records what it's asked and answers like Stripe
// does. Billing is on for this file only. Needs TEST_DATABASE_URL, as
// collaboration.test.js describes; skipped without it.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const { DB, startCloudServer } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'

// A fake of the parts of the Stripe library services/stripe.js uses
function fakeStripe() {
  const fake = { calls: [], subscriptions: new Map(), customerCount: 0 }
  const record = (name, args) => { fake.calls.push([name, args]); return args }
  const PRICES = {
    price_teamMonthly1: { recurring: { interval: 'month' }, unit_amount: 1200, currency: 'usd' },
    price_teamYearly1: { recurring: { interval: 'year' }, unit_amount: 11520, currency: 'usd' },
    price_proYearly1: { recurring: { interval: 'year' }, unit_amount: 9600, currency: 'usd' },
    price_oneOff1: { recurring: null, unit_amount: 500, currency: 'usd' },
  }
  fake.client = {
    customers: { create: async args => { record('customers.create', args); return { id: `cus_${++fake.customerCount}` } } },
    checkout: { sessions: { create: async args => { record('checkout', args); return { id: `cs_${fake.calls.length}`, url: 'https://checkout.stripe.test/pay' } } } },
    billingPortal: { sessions: { create: async args => { record('portal', args); return { url: 'https://billing.stripe.test/team' } } } },
    prices: {
      retrieve: async id => {
        if (!PRICES[id]) throw Object.assign(new Error('No such price'), { statusCode: 404 })
        return PRICES[id]
      },
    },
    subscriptions: {
      retrieve: async id => fake.subscriptions.get(id),
      update: async (id, change) => {
        record('subscriptions.update', { id, ...change })
        const sub = fake.subscriptions.get(id)
        if (change.items) sub.items.data[0].quantity = change.items[0].quantity
        if (change.metadata) sub.metadata = change.metadata
        return { ...sub, current_period_end: 1800000000 }
      },
    },
    webhooks: {
      constructEvent: (body, signature) => {
        if (signature !== 'signed') throw new Error('No signatures found matching the expected signature')
        return JSON.parse(body.toString())
      },
    },
  }
  // A subscription Stripe has made, as it would describe it
  fake.subscribe = (id, { priceId, quantity = 1, status = 'active', metadata = {} }) => {
    const sub = { id, status, metadata, items: { data: [{ id: `si_${id}`, quantity, price: { id: priceId } }] } }
    fake.subscriptions.set(id, sub)
    return sub
  }
  fake.last = name => fake.calls.filter(c => c[0] === name).at(-1)?.[1]
  return fake
}

describe('billing', { skip }, () => {
  let t, call, userId, pool, stripe
  let siteAdmin, owner, member, buyer, solo
  let team

  const webhook = (type, object, signature = 'signed') =>
    call(null, 'POST', '/api/billing/webhook', { id: `evt_${Date.now()}`, type, data: { object } }, { 'stripe-signature': signature })
  const teamRow = async id => (await pool.query('SELECT * FROM teams WHERE id = $1', [id])).rows[0]

  // The fake prices this file adds to the test database, taken out before
  // the server reads its plans and again after
  const FAKE_PRICES = ['price_teamMonthly1', 'price_teamYearly1', 'price_proYearly1']
  async function removeFakePrices() {
    const { Pool } = require('pg')
    const db = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } })
    await db.query('DELETE FROM plan_prices WHERE stripe_price_id = ANY($1)', [FAKE_PRICES])
    await db.end()
  }

  before(async () => {
    await removeFakePrices()
    Object.assign(process.env, { PARALLAX_BILLING: 'on', STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_WEBHOOK_SECRET: 'whsec_fake' })
    stripe = fakeStripe()
    const file = require.resolve('stripe', { paths: [path.join(__dirname, '..')] })
    require.cache[file] = { id: file, filename: file, loaded: true, exports: () => stripe.client, children: [], paths: [] }
    t = await startCloudServer()
    ;({ call, userId, pool } = t)
    ;[siteAdmin, owner, member, buyer, solo] = ['site-admin', 'owner', 'member', 'buyer', 'solo'].map(t.user)
    process.env.ADMIN_USER_IDS = siteAdmin
    for (const who of [siteAdmin, owner, member, buyer, solo]) await call(who, 'GET', '/api/me')
  })

  after(async () => {
    await t?.stop()
    await removeFakePrices()
  })

  it('sells a plan at the prices an admin adds, described by Stripe', async () => {
    assert.equal((await call(owner, 'POST', '/api/admin/plans/team/prices', { priceId: 'price_teamMonthly1' })).status, 404)
    const added = await call(siteAdmin, 'POST', '/api/admin/plans/team/prices', { priceId: 'price_teamMonthly1' })
    assert.equal(added.status, 201, JSON.stringify(added.body))
    assert.deepEqual(added.body.plan.prices.map(p => [p.priceId, p.interval, p.amountCents]), [['price_teamMonthly1', 'month', 1200]])
    assert.equal((await call(siteAdmin, 'POST', '/api/admin/plans/team/prices', { priceId: 'price_teamYearly1' })).status, 201)
    assert.equal((await call(siteAdmin, 'POST', '/api/admin/plans/pro/prices', { priceId: 'price_proYearly1' })).status, 201)
    // Refused: no such price, not a subscription, sold already, or a plan that can't be
    assert.match((await call(siteAdmin, 'POST', '/api/admin/plans/team/prices', { priceId: 'price_nothing1' })).body.error, /no price/)
    assert.match((await call(siteAdmin, 'POST', '/api/admin/plans/team/prices', { priceId: 'price_oneOff1' })).body.error, /isn’t a subscription/)
    assert.match((await call(siteAdmin, 'POST', '/api/admin/plans/pro/prices', { priceId: 'price_teamMonthly1' })).body.error, /Team plan already uses/)
    assert.equal((await call(siteAdmin, 'POST', '/api/admin/plans/free/prices', { priceId: 'price_proYearly1' })).status, 400)

    const listed = (await call(null, 'GET', '/api/plans')).body
    assert.equal(listed.billing, true)
    const pro = listed.plans.find(p => p.id === 'pro')
    assert.equal(pro.purchasable, true)
    assert.deepEqual(pro.prices.map(p => p.interval), ['month', 'year'])
    assert.ok(!listed.plans.some(p => p.id === 'team'))
    assert.deepEqual(listed.teamPlans.map(p => [p.id, p.minSeats, p.prices.length]), [['team', 3, 2]])
  })

  it('sells a person their plan by the year too', async () => {
    const res = await call(solo, 'POST', '/api/billing/checkout', { plan: 'pro', priceId: 'price_proYearly1' })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.deepEqual(stripe.last('checkout').line_items, [{ price: 'price_proYearly1', quantity: 1 }])
    assert.equal((await call(solo, 'POST', '/api/billing/checkout', { plan: 'pro', priceId: 'price_teamMonthly1' })).status, 400)

    // Paid: the webhook puts them on the plan
    const customer = (await pool.query('SELECT stripe_customer_id FROM users WHERE id = $1', [await userId(solo)])).rows[0].stripe_customer_id
    stripe.subscribe(`sub_solo_${t.run}`, { priceId: 'price_proYearly1' })
    const done = await webhook('checkout.session.completed', { id: 'cs_solo', mode: 'subscription', subscription: `sub_solo_${t.run}`, customer, metadata: { parallax_plan: 'pro' } })
    assert.equal(done.status, 200)
    assert.equal((await call(solo, 'GET', '/api/me')).body.plan, 'pro')
  })

  it('opens checkout for a new team, as its own Stripe customer, for its seats', async () => {
    assert.match((await call(buyer, 'POST', '/api/teams/checkout', { name: 'Lab', seats: 2, priceId: 'price_teamMonthly1' })).body.error, /at least 3 seats/)
    assert.equal((await call(buyer, 'POST', '/api/teams/checkout', { name: 'Lab', seats: 4, priceId: 'price_proYearly1' })).status, 400)
    assert.equal((await call(buyer, 'POST', '/api/teams/checkout', { name: ' ', seats: 4, priceId: 'price_teamMonthly1' })).status, 400)
    const res = await call(buyer, 'POST', '/api/teams/checkout', { name: `Buyer lab ${t.run}`, seats: 4, priceId: 'price_teamMonthly1' })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.url, 'https://checkout.stripe.test/pay')
    assert.equal(stripe.last('customers.create').name, `Buyer lab ${t.run}`)
    const session = stripe.last('checkout')
    assert.deepEqual(session.line_items, [{ price: 'price_teamMonthly1', quantity: 4, adjustable_quantity: { enabled: true, minimum: 3, maximum: 1000 } }])
    assert.equal(session.metadata.parallax_kind, 'team')
    assert.equal(session.metadata.parallax_team_owner, await userId(buyer))
    assert.match(session.success_url, /\/dashboard\?teamCheckout=done$/)
    // No team yet: it's made when the subscription starts
    assert.deepEqual((await call(buyer, 'GET', '/api/teams')).body.teams, [])
  })

  it('makes the team when its subscription starts, once however often Stripe says so', async () => {
    const session = stripe.last('checkout')
    stripe.subscribe(`sub_team_${t.run}`, { priceId: 'price_teamMonthly1', quantity: 5 })
    const event = { id: 'cs_team', mode: 'subscription', subscription: `sub_team_${t.run}`, customer: 'cus_team', metadata: session.metadata }
    assert.equal((await webhook('checkout.session.completed', event, 'forged')).status, 400)
    assert.equal((await webhook('checkout.session.completed', event)).status, 200)
    assert.equal((await webhook('checkout.session.completed', event)).status, 200)
    const mine = (await call(buyer, 'GET', '/api/teams')).body.teams
    assert.equal(mine.length, 1)
    team = mine[0].id
    assert.deepEqual([mine[0].name, mine[0].role, mine[0].seats, mine[0].plan, mine[0].status], [`Buyer lab ${t.run}`, 'owner', 5, 'team', 'active'])
    const row = await teamRow(team)
    assert.deepEqual([row.stripe_customer_id, row.stripe_subscription_id], ['cus_team', `sub_team_${t.run}`])
    assert.equal(stripe.subscriptions.get(`sub_team_${t.run}`).metadata.parallax_team_id, team)
    const got = (await call(buyer, 'GET', `/api/teams/${team}`)).body
    assert.deepEqual([got.subscribed, got.minSeats, got.billing], [true, 3, true])
  })

  it('lets its owner, and only its owner, change its seats and open Stripe\'s billing page', async () => {
    const { token } = (await call(buyer, 'POST', `/api/teams/${team}/invites`, { role: 'admin' })).body
    await call(member, 'POST', `/api/team-invites/${token}/accept`)
    assert.equal((await call(member, 'PUT', `/api/teams/${team}/seats`, { seats: 8 })).status, 403)
    assert.equal((await call(member, 'POST', `/api/teams/${team}/billing/portal`)).status, 403)

    const changed = await call(buyer, 'PUT', `/api/teams/${team}/seats`, { seats: 8 })
    assert.equal(changed.status, 200, JSON.stringify(changed.body))
    assert.deepEqual(stripe.last('subscriptions.update'), { id: `sub_team_${t.run}`, items: [{ id: `si_sub_team_${t.run}`, quantity: 8 }], proration_behavior: 'create_prorations' })
    assert.equal((await teamRow(team)).seats, 8)
    assert.match((await call(buyer, 'PUT', `/api/teams/${team}/seats`, { seats: 1 })).body.error, /seats are in use|at least 3/)
    assert.match((await call(buyer, 'PUT', `/api/teams/${team}/seats`, { seats: 2 })).body.error, /at least 3 seats/)

    const portal = await call(buyer, 'POST', `/api/teams/${team}/billing/portal`)
    assert.equal(portal.body.url, 'https://billing.stripe.test/team')
    assert.equal(stripe.last('portal').customer, 'cus_team')
    assert.match(stripe.last('portal').return_url, new RegExp(`/dashboard\\?team=${team}$`))
  })

  it('follows the subscription: seats changed in Stripe, a failed payment, and the end', async () => {
    const sub = stripe.subscriptions.get(`sub_team_${t.run}`)
    sub.items.data[0].quantity = 6
    assert.equal((await webhook('customer.subscription.updated', sub)).status, 200)
    assert.equal((await teamRow(team)).seats, 6)

    sub.status = 'past_due'
    await webhook('customer.subscription.updated', sub)
    assert.equal((await teamRow(team)).status, 'past_due')
    // Everything still works while Stripe retries
    const deck = (await call(buyer, 'POST', '/api/presentations', { title: 'Still editing', teamId: team })).body.id
    assert.equal((await call(buyer, 'PUT', `/api/presentations/${deck}`, { title: 'Still editing, again' })).status, 200)

    await webhook('customer.subscription.deleted', { ...sub, status: 'canceled' })
    const ended = await teamRow(team)
    assert.deepEqual([ended.status, ended.stripe_subscription_id], ['lapsed', null])
    assert.equal((await call(buyer, 'PUT', `/api/presentations/${deck}`, { title: 'Too late' })).status, 403)
    assert.equal((await call(buyer, 'GET', `/api/presentations/${deck}`)).status, 200)
  })

  it('lets the owner pay again, as the same customer, and the team comes back', async () => {
    const customersBefore = stripe.customerCount
    const res = await call(buyer, 'POST', `/api/teams/${team}/billing/checkout`, { priceId: 'price_teamYearly1' })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(stripe.customerCount, customersBefore)
    const session = stripe.last('checkout')
    assert.equal(session.customer, 'cus_team')
    assert.equal(session.metadata.parallax_team_id, team)
    // At least the seats in use (owner and admin) and the plan's fewest
    assert.equal(session.line_items[0].adjustable_quantity.minimum, 3)
    stripe.subscribe(`sub_again_${t.run}`, { priceId: 'price_teamYearly1', quantity: 3, metadata: session.metadata })
    await webhook('checkout.session.completed', { id: 'cs_again', mode: 'subscription', subscription: `sub_again_${t.run}`, customer: 'cus_team', metadata: session.metadata })
    const back = await teamRow(team)
    assert.deepEqual([back.status, back.stripe_subscription_id, back.seats], ['active', `sub_again_${t.run}`, 3])
    assert.equal((await call(buyer, 'POST', `/api/teams/${team}/billing/checkout`, { priceId: 'price_teamYearly1' })).status, 409)
  })

  it('lets the owner of a team an admin made start paying for it', async () => {
    const made = (await call(siteAdmin, 'POST', '/api/admin/teams', { name: `Comped ${t.run}`, ownerEmail: `${owner}@test.local`, seats: 3 })).body.team.id
    assert.equal((await call(owner, 'POST', `/api/teams/${made}/billing/portal`)).status, 409)
    assert.equal((await call(owner, 'PUT', `/api/teams/${made}/seats`, { seats: 4 })).status, 409)
    const res = await call(owner, 'POST', `/api/teams/${made}/billing/checkout`, { priceId: 'price_teamMonthly1', seats: 4 })
    assert.equal(res.status, 200)
    assert.equal(stripe.last('customers.create').metadata.parallax_team_id, made)
    const customer = (await teamRow(made)).stripe_customer_id
    assert.ok(customer)
    const session = stripe.last('checkout')
    assert.equal(session.line_items[0].quantity, 4)
    stripe.subscribe(`sub_comped_${t.run}`, { priceId: 'price_teamMonthly1', quantity: 4, metadata: session.metadata })
    await webhook('checkout.session.completed', { id: 'cs_comped', mode: 'subscription', subscription: `sub_comped_${t.run}`, customer, metadata: session.metadata })
    const paid = await teamRow(made)
    assert.deepEqual([paid.stripe_subscription_id, paid.seats, paid.status], [`sub_comped_${t.run}`, 4, 'active'])
  })

  it('stops selling a plan at a price an admin removes', async () => {
    const removed = await call(siteAdmin, 'DELETE', '/api/admin/plans/team/prices/price_teamYearly1')
    assert.equal(removed.status, 200)
    assert.deepEqual(removed.body.plan.prices.map(p => p.priceId), ['price_teamMonthly1'])
    assert.equal((await call(buyer, 'POST', '/api/teams/checkout', { name: 'Another', seats: 3, priceId: 'price_teamYearly1' })).status, 400)
    assert.equal((await call(siteAdmin, 'DELETE', '/api/admin/plans/team/prices/price_teamYearly1')).status, 404)
  })
})

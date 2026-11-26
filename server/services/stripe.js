// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Billing through Stripe: a person's own plan (Pro), and a team's seats.
// Off unless PARALLAX_BILLING=on and STRIPE_SECRET_KEY are set.
//
// A person pays for their plan as their own Stripe customer (users.
// stripe_customer_id). A team is its own Stripe customer, named after it, so
// its invoices carry the team's name: its owner buys it at checkout, for a
// number of seats at one of a per-seat plan's prices, and the webhook makes
// the team when the subscription starts. Changes to the subscription (seats,
// a failed payment, canceling) come back through the webhook too.

// Each plan's Stripe prices are set from /admin
const { PLAN_LIMITS, planForPrice } = require('./plans')
const teams = require('./teams')

let stripe = null
function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
  }
  return stripe
}

// Switched off until payment plans are set up (764e1a6c); PARALLAX_BILLING=on
// turns it on where Stripe is configured
function isEnabled() {
  return process.env.PARALLAX_BILLING === 'on' && !!process.env.STRIPE_SECRET_KEY
}

async function getOrCreateCustomer(storage, userId, email, name) {
  const s = getStripe()
  const { rows } = await storage.query('SELECT stripe_customer_id FROM users WHERE id = $1', [userId])
  if (rows[0]?.stripe_customer_id) return rows[0].stripe_customer_id

  const customer = await s.customers.create({
    email,
    name,
    metadata: { parallax_user_id: userId },
  })
  await storage.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customer.id, userId])
  return customer.id
}

// Checkout for `plan`, at `price` (one of plan.prices; its first by default)
// opts.coupon: a coupon to take off (the education price); without one, the
// checkout takes promotion codes (Stripe allows one or the other)
async function createCheckoutSession(storage, userId, email, name, plan, successUrl, cancelUrl, price = plan.prices[0], opts = {}) {
  const s = getStripe()
  const customerId = await getOrCreateCustomer(storage, userId, email, name)
  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    ...(opts.coupon ? { discounts: [{ coupon: opts.coupon }] } : { allow_promotion_codes: true }),
    line_items: [{ price: price.priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { parallax_user_id: userId, parallax_plan: plan.id },
  })
  return session
}

async function createPortalSession(storage, userId) {
  const s = getStripe()
  const { rows } = await storage.query('SELECT stripe_customer_id, email, name FROM users WHERE id = $1', [userId])
  let customerId = rows[0]?.stripe_customer_id
  if (!customerId) {
    customerId = await getOrCreateCustomer(storage, userId, rows[0]?.email, rows[0]?.name)
  }
  const session = await s.billingPortal.sessions.create({
    customer: customerId,
    return_url: process.env.APP_URL || 'https://parallax-presentations.com/dashboard',
  })
  return session
}

// What a coupon takes off: { percentOff, amountOffCents, currency, duration,
// durationMonths }, or null when there's no such coupon or it's no longer
// valid. Asked of Stripe at most every 10 minutes.
const coupons = new Map()
async function describeCoupon(couponId) {
  const hit = coupons.get(couponId)
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.value
  let value = null
  try {
    const c = await getStripe().coupons.retrieve(couponId)
    if (c.valid !== false) {
      value = {
        percentOff: c.percent_off ?? null, amountOffCents: c.amount_off ?? null, currency: c.currency || null,
        duration: c.duration, durationMonths: c.duration_in_months ?? null,
      }
    }
  } catch (err) {
    if (!(err.statusCode === 404 || err.code === 'resource_missing')) throw err
  }
  coupons.set(couponId, { at: Date.now(), value })
  return value
}

// What Stripe says a price is, for an admin adding it to a plan: { recurring,
// interval, amountCents, currency }, or null when there's no such price
async function describePrice(priceId) {
  try {
    const p = await getStripe().prices.retrieve(priceId)
    return { recurring: !!p.recurring, interval: p.recurring?.interval, amountCents: p.unit_amount, currency: p.currency }
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'resource_missing') return null
    throw err
  }
}

// --- Teams ---

// Checkout for a team's seats, by its owner. `team` is { name } for a new
// team (made when the subscription starts) or { id, name, customerId } for
// one already there (made by an admin of the site). `minSeats` is the fewest
// the owner may pick on Stripe's page.
async function createTeamCheckoutSession(storage, { owner, team, seats, minSeats, plan, price, successUrl, cancelUrl }) {
  const s = getStripe()
  let customer = team.customerId
  if (!customer) {
    customer = (await s.customers.create({
      name: team.name,
      email: owner.email,
      metadata: { parallax_team_owner: owner.id, ...(team.id && { parallax_team_id: team.id }) },
    })).id
    if (team.id) await storage.query('UPDATE teams SET stripe_customer_id = $2 WHERE id = $1', [team.id, customer])
  }
  const metadata = {
    parallax_kind: 'team',
    parallax_team_owner: owner.id,
    parallax_team_name: team.name,
    parallax_plan: plan.id,
    ...(team.id && { parallax_team_id: team.id }),
  }
  return s.checkout.sessions.create({
    customer,
    mode: 'subscription',
    allow_promotion_codes: true,
    line_items: [{
      price: price.priceId,
      quantity: seats,
      adjustable_quantity: { enabled: true, minimum: minSeats, maximum: teams.MAX_SEATS },
    }],
    subscription_data: { metadata },
    metadata,
    success_url: successUrl,
    cancel_url: cancelUrl,
  })
}

async function createTeamPortalSession(customerId, returnUrl) {
  return getStripe().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl })
}

// Changes the seats a team pays for; Stripe prorates the difference
async function setTeamSeats(storage, team, seats) {
  const s = getStripe()
  const sub = await s.subscriptions.retrieve(team.subscriptionId)
  const item = sub.items.data[0]
  await s.subscriptions.update(sub.id, { items: [{ id: item.id, quantity: seats }], proration_behavior: 'create_prorations' })
  await teams.setSeats(storage, team.id, seats)
}

// A team's status, from its subscription's: everything works while a
// payment is retried, and its decks turn read-only once the subscription ends
function teamStatus(subStatus) {
  if (subStatus === 'active' || subStatus === 'trialing') return 'active'
  if (subStatus === 'past_due' || subStatus === 'unpaid' || subStatus === 'incomplete') return 'past_due'
  return 'lapsed'
}

const seatsOf = sub => sub?.items?.data?.[0]?.quantity || 1

// --- Webhook ---

// Puts the customer's account on the paid plan `planId`, recording
// `subscriptionId` when given. On a plan whose presentations don't expire,
// the account's existing ones stop expiring too; otherwise the sweeper would
// still delete the ones made on Free. Returns the account's Clerk ID.
async function moveCustomerToPlan(storage, customerId, planId, subscriptionId = null) {
  const { rows } = await storage.query(`
    WITH changed AS (
      UPDATE users SET plan = $2, plan_expires_at = NULL, stripe_subscription_id = COALESCE($3, stripe_subscription_id)
       WHERE stripe_customer_id = $1 RETURNING id, auth_id
    ), unexpired AS (
      UPDATE presentations SET expires_at = NULL
       WHERE $4::boolean AND expires_at IS NOT NULL AND user_id IN (SELECT id FROM changed)
    )
    SELECT auth_id FROM changed`,
    [customerId, planId, subscriptionId, !PLAN_LIMITS[planId].expirationDays]
  )
  return rows.map(r => r.auth_id)
}

// The plan a subscription pays for, by its price
function planForSubscription(sub) {
  return planForPrice(sub?.items?.data?.[0]?.price?.id)
}

// A team's checkout finished: the team it was for gets the subscription, or
// a new team is made for its owner. Returns the team's id.
async function teamFromCheckout(storage, s, session) {
  const meta = session.metadata || {}
  const sub = await s.subscriptions.retrieve(session.subscription)
  const plan = planForSubscription(sub) || PLAN_LIMITS[meta.parallax_plan] || null
  const fields = { subscriptionId: sub.id, customerId: session.customer, seats: seatsOf(sub), plan: plan?.id, status: teamStatus(sub.status) }
  if (meta.parallax_team_id) {
    const team = await teams.setTeamSubscription(storage, { teamId: meta.parallax_team_id, ...fields })
    return team?.id || null
  }
  const { rows } = await storage.query('SELECT id FROM users WHERE id = $1', [meta.parallax_team_owner])
  if (!rows.length) {
    console.error(`Stripe checkout ${session.id} is for a team whose owner doesn't exist; no team made`)
    return null
  }
  const team = await teams.createPaidTeam(storage, { name: meta.parallax_team_name, ownerId: rows[0].id, ...fields, plan: fields.plan || 'team' })
  // So the subscription in Stripe's dashboard says which team it is
  if (team.created) {
    await s.subscriptions.update(sub.id, { metadata: { ...(sub.metadata || {}), parallax_team_id: team.id } })
      .catch(err => console.error(`Couldn't label subscription ${sub.id} with its team: ${err.message}`))
  }
  return team.id
}

// The team a subscription pays for, if it's a team's: by the id in its
// metadata, or by the subscription
async function teamSubscriptionChanged(storage, sub, { ended = false } = {}) {
  return teams.setTeamSubscription(storage, {
    teamId: sub.metadata?.parallax_team_id || null,
    subscriptionId: sub.id,
    ...(ended
      ? { status: 'lapsed' }
      : { seats: seatsOf(sub), plan: planForSubscription(sub)?.id, status: teamStatus(sub.status) }),
  }).then(async team => {
    // Ended: the team keeps no subscription
    if (team && ended) await storage.query('UPDATE teams SET stripe_subscription_id = NULL WHERE id = $1', [team.id])
    return team
  })
}

// Returns the event, the Clerk IDs of accounts whose plan it changed (so the
// caller can drop their cached plan), and the teams whose status changed (so
// their decks' live editing can reopen with the rights they have now)
async function handleWebhook(storage, rawBody, signature) {
  const s = getStripe()
  const event = s.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
  let planChangedFor = []
  const teamsChanged = []

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      if (session.mode !== 'subscription') break
      if (session.metadata?.parallax_kind === 'team') {
        const teamId = await teamFromCheckout(storage, s, session)
        if (teamId) teamsChanged.push(teamId)
        break
      }
      // The plan checkout was opened for, or else the one the price sells
      const fromMetadata = PLAN_LIMITS[session.metadata?.parallax_plan]
      const plan = fromMetadata?.prices?.length ? fromMetadata : planForSubscription(await s.subscriptions.retrieve(session.subscription))
      if (plan) planChangedFor = await moveCustomerToPlan(storage, session.customer, plan.id, session.subscription)
      else console.error(`Stripe checkout ${session.id} is for a price no plan uses; plan left as it is`)
      break
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object
      const team = await teamSubscriptionChanged(storage, sub)
      if (team) {
        if (team.statusBefore !== teamStatus(sub.status)) teamsChanged.push(team.id)
        break
      }
      if (sub.status === 'active') {
        // Switching plans in the billing portal changes the price
        const plan = planForSubscription(sub)
        if (plan) planChangedFor = await moveCustomerToPlan(storage, sub.customer, plan.id)
        else console.error(`Stripe subscription ${sub.id} is for a price no plan uses; plan left as it is`)
      }
      // past_due or unpaid: the account keeps its plan while Stripe retries
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const team = await teamSubscriptionChanged(storage, sub, { ended: true })
      if (team) {
        teamsChanged.push(team.id)
        break
      }
      const { rows } = await storage.query(
        `UPDATE users SET plan = 'free', stripe_subscription_id = NULL, plan_expires_at = NULL WHERE stripe_customer_id = $1 RETURNING auth_id`,
        [sub.customer]
      )
      planChangedFor = rows.map(r => r.auth_id)
      break
    }
  }

  return { event, planChangedFor, teamsChanged }
}

async function cancelSubscription(storage, userId) {
  const s = getStripe()
  const { rows } = await storage.query('SELECT stripe_subscription_id FROM users WHERE id = $1', [userId])
  const subId = rows[0]?.stripe_subscription_id
  if (!subId) throw new Error('No active subscription')
  const sub = await s.subscriptions.update(subId, { cancel_at_period_end: true })
  return { cancelAt: new Date(sub.current_period_end * 1000).toISOString() }
}

async function resumeSubscription(storage, userId) {
  const s = getStripe()
  const { rows } = await storage.query('SELECT stripe_subscription_id FROM users WHERE id = $1', [userId])
  const subId = rows[0]?.stripe_subscription_id
  if (!subId) throw new Error('No active subscription')
  await s.subscriptions.update(subId, { cancel_at_period_end: false })
}

async function getSubscriptionStatus(storage, userId) {
  const s = getStripe()
  const { rows } = await storage.query('SELECT stripe_subscription_id FROM users WHERE id = $1', [userId])
  const subId = rows[0]?.stripe_subscription_id
  if (!subId) return { active: false }
  const sub = await s.subscriptions.retrieve(subId)
  return {
    active: sub.status === 'active',
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
  }
}

module.exports = {
  isEnabled, createCheckoutSession, createPortalSession, describePrice, describeCoupon, handleWebhook,
  createTeamCheckoutSession, createTeamPortalSession, setTeamSeats, teamStatus,
  cancelSubscription, resumeSubscription, getSubscriptionStatus, getStripe,
}

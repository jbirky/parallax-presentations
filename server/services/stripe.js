// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || 'price_1TVnpZF9LOeD1Xd0coGVd0fI'
const { PLAN_LIMITS } = require('../middleware/auth')

let stripe = null
function getStripe() {
  if (!stripe && STRIPE_SECRET_KEY) {
    stripe = require('stripe')(STRIPE_SECRET_KEY)
  }
  return stripe
}

function isEnabled() {
  return false
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

async function createCheckoutSession(storage, userId, email, name, successUrl, cancelUrl) {
  const s = getStripe()
  const customerId = await getOrCreateCustomer(storage, userId, email, name)
  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    allow_promotion_codes: true,
    line_items: [{ price: STRIPE_PRO_PRICE_ID, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { parallax_user_id: userId },
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

// Puts the customer's account on Pro, recording `subscriptionId` when given.
// Pro presentations don't expire, so the account's existing ones stop
// expiring too; otherwise the sweeper would still delete the ones made on
// Free. Returns the account's Clerk ID.
async function moveCustomerToPro(storage, customerId, subscriptionId = null) {
  const { rows } = await storage.query(`
    WITH changed AS (
      UPDATE users SET plan = 'pro', plan_expires_at = NULL, stripe_subscription_id = COALESCE($2, stripe_subscription_id)
       WHERE stripe_customer_id = $1 RETURNING id, auth_id
    ), unexpired AS (
      UPDATE presentations SET expires_at = NULL
       WHERE $3::boolean AND expires_at IS NOT NULL AND user_id IN (SELECT id FROM changed)
    )
    SELECT auth_id FROM changed`,
    [customerId, subscriptionId, !PLAN_LIMITS.pro.expirationDays]
  )
  return rows.map(r => r.auth_id)
}

// Returns the event and the Clerk IDs of accounts whose plan it changed, so
// the caller can drop their cached plan
async function handleWebhook(storage, rawBody, signature) {
  const s = getStripe()
  const event = s.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)
  let planChangedFor = []

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      if (session.mode === 'subscription') {
        planChangedFor = await moveCustomerToPro(storage, session.customer, session.subscription)
      }
      break
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object
      const status = sub.status
      if (status === 'active') {
        planChangedFor = await moveCustomerToPro(storage, sub.customer)
      } else if (status === 'past_due' || status === 'unpaid') {
        // keep pro for now, but could downgrade after grace period
      }
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const { rows } = await storage.query(
        `UPDATE users SET plan = 'free', stripe_subscription_id = NULL, plan_expires_at = NULL WHERE stripe_customer_id = $1 RETURNING auth_id`,
        [sub.customer]
      )
      planChangedFor = rows.map(r => r.auth_id)
      break
    }
  }

  return { event, planChangedFor }
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

module.exports = { isEnabled, createCheckoutSession, createPortalSession, handleWebhook, cancelSubscription, resumeSubscription, getSubscriptionStatus, getStripe }

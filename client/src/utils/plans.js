// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Wording for a plan's limits, as the server gives them: maxPresentations and
// expirationDays are null for unlimited and never, maxFileBytes for no limit
// beyond the server's own.

export function formatSize(bytes) {
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${Math.round(gb * 10) / 10} GB`
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

// One line per limit, e.g. ['3 presentations', '100 MB storage', 'Presentations expire after 30 days']
export function planSummary(limits) {
  if (!limits) return []
  const { maxPresentations, storageBytes, expirationDays, maxFileBytes } = limits
  const lines = [
    maxPresentations == null ? 'Unlimited presentations' : `${maxPresentations} presentation${maxPresentations === 1 ? '' : 's'}`,
    `${formatSize(storageBytes)} storage`,
  ]
  if (maxFileBytes) lines.push(`Files up to ${formatSize(maxFileBytes)} each`)
  lines.push(expirationDays ? `Presentations expire after ${expirationDays} day${expirationDays === 1 ? '' : 's'}` : 'No expiration')
  return lines
}

// A price as people read it: "$10 a month", "$12 a seat a month" for a plan
// sold by the seat, or "$144 a month" for `seats` of them. Stripe's price is
// { amountCents, currency, interval }; without an amount, just how often.
export function priceText({ amountCents, currency = 'usd', interval }, { perSeat = false, seats = null } = {}) {
  const per = interval === 'year' ? 'year' : 'month'
  if (amountCents === null || amountCents === undefined) return `by the ${per}`
  const cents = seats ? amountCents * seats : amountCents
  const amount = (cents / 100).toLocaleString('en-US', {
    style: 'currency', currency: String(currency).toUpperCase(), minimumFractionDigits: cents % 100 ? 2 : 0,
  })
  return `${amount}${perSeat && !seats ? ' a seat' : ''} a ${per}`
}

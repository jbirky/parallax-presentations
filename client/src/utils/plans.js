// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Wording for a plan's limits, as the server gives them: maxPresentations is
// how many of their own presentations someone can edit (their newest; older
// ones are read-only), null for no limit; maxFileBytes null for no limit
// beyond the server's own.

export function formatSize(bytes) {
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${Math.round(gb * 10) / 10} GB`
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

// One line per limit, e.g. ['3 editable presentations, older ones read-only', '100 MB storage']
export function planSummary(limits) {
  if (!limits) return []
  const { maxPresentations, storageBytes, maxFileBytes } = limits
  const lines = [
    maxPresentations == null
      ? 'Unlimited presentations'
      : `${maxPresentations} editable presentation${maxPresentations === 1 ? '' : 's'}, older ones read-only`,
    `${formatSize(storageBytes)} storage`,
  ]
  if (maxFileBytes) lines.push(`Files up to ${formatSize(maxFileBytes)} each`)
  return lines
}

// A price with a coupon taken off: { percentOff } or { amountOffCents }
export function discountedPrice(price, discount) {
  if (!price || price.amountCents == null || !discount) return price
  const off = discount.percentOff != null
    ? Math.round(price.amountCents * discount.percentOff / 100)
    : Math.min(price.amountCents, discount.amountOffCents || 0)
  return { ...price, amountCents: price.amountCents - off }
}

// What a coupon takes off, in words: "50% off", "50% off for 12 months"
export function discountText(discount) {
  if (!discount) return ''
  const amount = discount.percentOff != null
    ? `${discount.percentOff}% off`
    : `${((discount.amountOffCents || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: String(discount.currency || 'usd').toUpperCase() })} off`
  if (discount.duration === 'repeating' && discount.durationMonths) return `${amount} for ${discount.durationMonths} months`
  if (discount.duration === 'once') return `${amount} the first time`
  return amount
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

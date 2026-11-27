import { describe, it, expect } from 'vitest'
import { formatSize, planSummary, discountedPrice, discountText } from './plans'

const MB = 1024 * 1024

describe('formatSize', () => {
  it('uses MB below a gigabyte and GB from there', () => {
    expect(formatSize(100 * MB)).toBe('100 MB')
    expect(formatSize(5 * 1024 * MB)).toBe('5 GB')
    expect(formatSize(1536 * MB)).toBe('1.5 GB')
  })
})

describe('planSummary', () => {
  it('describes a limited plan, whose older presentations are read-only', () => {
    expect(planSummary({ maxPresentations: 3, storageBytes: 100 * MB, maxFileBytes: null }))
      .toEqual(['3 editable presentations, older ones read-only', '100 MB storage'])
  })

  it('describes an unlimited plan', () => {
    expect(planSummary({ maxPresentations: null, storageBytes: 5 * 1024 * MB }))
      .toEqual(['Unlimited presentations', '5 GB storage'])
  })

  it('mentions a file size limit and uses the singular', () => {
    expect(planSummary({ maxPresentations: 1, storageBytes: 25 * MB, maxFileBytes: 10 * MB }))
      .toEqual(['1 editable presentation, older ones read-only', '25 MB storage', 'Files up to 10 MB each'])
  })

  it('is empty before the plan loads', () => {
    expect(planSummary(null)).toEqual([])
  })
})

describe('priceText', () => {
  it('says what a price costs and how often', async () => {
    const { priceText } = await import('./plans')
    expect(priceText({ amountCents: 1000, currency: 'usd', interval: 'month' })).toBe('$10 a month')
    expect(priceText({ amountCents: 9600, currency: 'usd', interval: 'year' })).toBe('$96 a year')
    expect(priceText({ amountCents: 1200, interval: 'month' }, { perSeat: true })).toBe('$12 a seat a month')
    expect(priceText({ amountCents: 1250, interval: 'month' }, { perSeat: true, seats: 3 })).toBe('$37.50 a month')
    expect(priceText({ amountCents: null, interval: 'year' })).toBe('by the year')
  })
})

describe('discounts', () => {
  it('takes a coupon off a price', () => {
    expect(discountedPrice({ amountCents: 1000, interval: 'month' }, { percentOff: 50 })).toEqual({ amountCents: 500, interval: 'month' })
    expect(discountedPrice({ amountCents: 9600, interval: 'year' }, { amountOffCents: 2000 })).toEqual({ amountCents: 7600, interval: 'year' })
    expect(discountedPrice({ amountCents: 1000 }, null)).toEqual({ amountCents: 1000 })
  })

  it('says what a coupon takes off', () => {
    expect(discountText({ percentOff: 50, duration: 'forever' })).toBe('50% off')
    expect(discountText({ percentOff: 50, duration: 'repeating', durationMonths: 12 })).toBe('50% off for 12 months')
    expect(discountText({ amountOffCents: 500, currency: 'usd', duration: 'once' })).toBe('$5.00 off the first time')
  })
})

import { describe, it, expect } from 'vitest'
import { formatSize, planSummary } from './plans'

const MB = 1024 * 1024

describe('formatSize', () => {
  it('uses MB below a gigabyte and GB from there', () => {
    expect(formatSize(100 * MB)).toBe('100 MB')
    expect(formatSize(5 * 1024 * MB)).toBe('5 GB')
    expect(formatSize(1536 * MB)).toBe('1.5 GB')
  })
})

describe('planSummary', () => {
  it('describes a limited plan that expires', () => {
    expect(planSummary({ maxPresentations: 3, storageBytes: 100 * MB, expirationDays: 30, maxFileBytes: null }))
      .toEqual(['3 presentations', '100 MB storage', 'Presentations expire after 30 days'])
  })

  it('describes an unlimited plan without expiry', () => {
    expect(planSummary({ maxPresentations: null, storageBytes: 5 * 1024 * MB, expirationDays: null }))
      .toEqual(['Unlimited presentations', '5 GB storage', 'No expiration'])
  })

  it('mentions a file size limit and uses the singular', () => {
    expect(planSummary({ maxPresentations: 1, storageBytes: 25 * MB, expirationDays: 1, maxFileBytes: 10 * MB }))
      .toEqual(['1 presentation', '25 MB storage', 'Files up to 10 MB each', 'Presentations expire after 1 day'])
  })

  it('is empty before the plan loads', () => {
    expect(planSummary(null)).toEqual([])
  })
})

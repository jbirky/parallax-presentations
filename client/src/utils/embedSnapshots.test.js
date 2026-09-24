import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  snapshotKey, getSnapshot, setSnapshot, subscribeSnapshots,
  getSnapshotVersion, handleSnapshotMessage, clearSnapshots,
} from './embedSnapshots'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const SVG = 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E'

beforeEach(() => clearSnapshots())

describe('snapshotKey', () => {
  it('is stable for the same element and content', () => {
    expect(snapshotKey('e1', '<svg/>')).toBe(snapshotKey('e1', '<svg/>'))
  })

  it('changes when the embed source changes, so an edit misses the cache', () => {
    expect(snapshotKey('e1', '<svg a/>')).not.toBe(snapshotKey('e1', '<svg b/>'))
  })

  it('differs between elements holding identical content', () => {
    expect(snapshotKey('e1', 'same')).not.toBe(snapshotKey('e2', 'same'))
  })

  it('treats missing content as empty rather than throwing', () => {
    expect(snapshotKey('e1', undefined)).toBe(snapshotKey('e1', ''))
    expect(snapshotKey('e1', null)).toBe(snapshotKey('e1', ''))
  })

  it('returns null without an element id', () => {
    expect(snapshotKey(undefined, 'x')).toBeNull()
    expect(snapshotKey('', 'x')).toBeNull()
  })
})

describe('get/set', () => {
  it('round-trips a snapshot', () => {
    const k = snapshotKey('e1', 'c')
    setSnapshot(k, PNG)
    expect(getSnapshot(k)).toBe(PNG)
  })

  it('misses for content that was never captured', () => {
    expect(getSnapshot(snapshotKey('e1', 'never'))).toBeNull()
  })

  it('returns null for a null key instead of throwing', () => {
    expect(getSnapshot(null)).toBeNull()
  })

  it('ignores a set with no key or no data', () => {
    setSnapshot(null, PNG)
    setSnapshot(snapshotKey('e1', 'c'), '')
    expect(getSnapshot(snapshotKey('e1', 'c'))).toBeNull()
  })

  it('a later capture replaces an earlier one', () => {
    const k = snapshotKey('e1', 'c')
    setSnapshot(k, SVG)
    setSnapshot(k, PNG)
    expect(getSnapshot(k)).toBe(PNG)
  })

  it('bounds the cache, evicting the oldest writes', () => {
    for (let i = 0; i < 260; i++) setSnapshot(`k${i}`, `data:image/png;base64,${i}`)
    expect(getSnapshot('k0')).toBeNull()
    expect(getSnapshot('k259')).toBe('data:image/png;base64,259')
  })
})

describe('subscriptions', () => {
  it('notifies subscribers and bumps the version on a new snapshot', () => {
    const fn = vi.fn()
    const before = getSnapshotVersion()
    const unsub = subscribeSnapshots(fn)
    setSnapshot(snapshotKey('e1', 'c'), PNG)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(getSnapshotVersion()).toBeGreaterThan(before)
    unsub()
  })

  it('does not notify when the value is unchanged', () => {
    const k = snapshotKey('e1', 'c')
    setSnapshot(k, PNG)
    const fn = vi.fn()
    const unsub = subscribeSnapshots(fn)
    setSnapshot(k, PNG)
    expect(fn).not.toHaveBeenCalled()
    unsub()
  })

  it('stops notifying after unsubscribe', () => {
    const fn = vi.fn()
    subscribeSnapshots(fn)()
    setSnapshot(snapshotKey('e1', 'c'), PNG)
    expect(fn).not.toHaveBeenCalled()
  })

  it('one throwing subscriber does not stop the others', () => {
    const good = vi.fn()
    const unsub1 = subscribeSnapshots(() => { throw new Error('boom') })
    const unsub2 = subscribeSnapshots(good)
    expect(() => setSnapshot(snapshotKey('e1', 'c'), PNG)).not.toThrow()
    expect(good).toHaveBeenCalled()
    unsub1(); unsub2()
  })
})

describe('handleSnapshotMessage', () => {
  const msg = (over = {}) => ({ source: 'parallax-embed', type: 'snapshot', key: 'k', dataUrl: PNG, ...over })

  it('stores a well-formed message', () => {
    expect(handleSnapshotMessage(msg())).toBe(true)
    expect(getSnapshot('k')).toBe(PNG)
  })

  it('ignores messages from anything else on the page', () => {
    expect(handleSnapshotMessage(msg({ source: 'parallax-sandbox' }))).toBe(false)
    expect(handleSnapshotMessage(msg({ type: 'ready' }))).toBe(false)
    expect(handleSnapshotMessage(undefined)).toBe(false)
    expect(handleSnapshotMessage('a string')).toBe(false)
    expect(getSnapshot('k')).toBeNull()
  })

  it('rejects a dataUrl that is not an image', () => {
    expect(handleSnapshotMessage(msg({ dataUrl: 'data:text/html,<script>x</script>' }))).toBe(false)
    expect(handleSnapshotMessage(msg({ dataUrl: 'https://example.com/x.png' }))).toBe(false)
    expect(handleSnapshotMessage(msg({ dataUrl: 'javascript:alert(1)' }))).toBe(false)
    expect(getSnapshot('k')).toBeNull()
  })

  it('rejects wrong field types', () => {
    expect(handleSnapshotMessage(msg({ key: 42 }))).toBe(false)
    expect(handleSnapshotMessage(msg({ dataUrl: null }))).toBe(false)
  })

  it('accepts an svg snapshot', () => {
    expect(handleSnapshotMessage(msg({ dataUrl: SVG }))).toBe(true)
    expect(getSnapshot('k')).toBe(SVG)
  })
})

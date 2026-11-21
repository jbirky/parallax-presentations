import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fitScale, applyScale, contentHeight, SHRINK_FIT_SCRIPT } from './shrinkFit'

// A text box's content whose height comes from its width: `lines` lines of
// `lineHeight` at `wordsWidth` px of words, plus 8px of padding each way
function textBlock(wordsWidth, lineHeight = 50) {
  const inner = { style: {}, offsetHeight: 0 }
  const last = {
    offsetTop: 8,
    get offsetHeight() {
      const w = parseFloat(inner.style.width) - 24
      return Math.ceil(wordsWidth / w) * lineHeight
    },
  }
  inner.lastElementChild = last
  return inner
}

beforeEach(() => { vi.stubGlobal('getComputedStyle', () => ({ paddingBottom: '8px' })) })

describe('shrinking text to fit', () => {
  it('measures to the bottom of the last block, without its margin', () => {
    const inner = textBlock(500)
    inner.style.width = '524px'
    expect(contentHeight(inner)).toBe(8 + 50 + 8)
  })

  it('leaves text that fits at its size', () => {
    expect(fitScale(textBlock(400), 524, 100)).toBe(1)
  })

  it('finds the largest scale at which it fits, laying it out wider', () => {
    // 3000px of words in a 500px-wide line: 6 lines, 316px; the box is 120px
    const inner = textBlock(3000)
    const s = fitScale(inner, 524, 120)
    expect(s).toBeGreaterThan(0.3)
    expect(s).toBeLessThan(1)
    applyScale(inner, 524, s)
    expect(contentHeight(inner) * s).toBeLessThanOrEqual(120.5)
    expect(inner.style.transform).toBe(`scale(${s})`)
    expect(inner.style.transformOrigin).toBe('0 0')
    // a little bigger no longer fits
    inner.style.width = `${524 / (s + 0.02)}px`
    expect(contentHeight(inner) * (s + 0.02)).toBeGreaterThan(120.5)
  })

  it('goes no smaller than 0.3', () => {
    expect(fitScale(textBlock(1e6), 524, 40)).toBe(0.3)
  })

  it('ships the same in decks, without backslashes', () => {
    expect(SHRINK_FIT_SCRIPT).toContain('[data-fit="shrink"]')
    expect(SHRINK_FIT_SCRIPT).not.toContain('\\')
    expect(() => new Function(SHRINK_FIT_SCRIPT)).not.toThrow()
  })
})

import { describe, it, expect } from 'vitest'
import { chosenTheme, defaultTheme, saveTheme, THEME_KEY } from './theme'

const storage = (items = {}) => ({
  items,
  getItem: key => (key in items ? items[key] : null),
  setItem(key, value) { items[key] = String(value) },
})

describe('the app theme', () => {
  it('is light once signed in and for guests, and dark on the landing and sign-in pages', () => {
    for (const path of ['/dashboard', '/dashboard/my-talk', '/try', '/invite/abc']) expect(defaultTheme(true, path)).toBe('light')
    for (const path of ['/', '', '/sign-in']) expect(defaultTheme(true, path)).toBe('dark')
  })

  it('is dark self-hosted and in the desktop app', () => {
    expect(defaultTheme(false, '/dashboard')).toBe('dark')
  })

  it('keeps what someone picked', () => {
    const s = storage()
    expect(chosenTheme(s)).toBe(null)
    saveTheme('dark', s)
    expect(s.items[THEME_KEY]).toBe('dark')
    expect(chosenTheme(s)).toBe('dark')
  })

  it('takes a light from the old key as a choice, but not a dark, which was saved on every load', () => {
    expect(chosenTheme(storage({ 'editor-theme': 'light' }))).toBe('light')
    expect(chosenTheme(storage({ 'editor-theme': 'dark' }))).toBe(null)
    expect(chosenTheme(storage({ 'editor-theme': 'light', [THEME_KEY]: 'dark' }))).toBe('dark')
  })

  it('falls back to the default when storage is blocked', () => {
    const blocked = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } }
    expect(chosenTheme(blocked)).toBe(null)
    expect(() => saveTheme('light', blocked)).not.toThrow()
  })
})

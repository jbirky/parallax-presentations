import { describe, it, expect } from 'vitest'
import { chosenTheme, defaultTheme, saveTheme, themeSurface, SITE_THEME_KEY, APP_THEME_KEY } from './theme'

const storage = (items = {}) => ({
  items,
  getItem: key => (key in items ? items[key] : null),
  setItem(key, value) { items[key] = String(value) },
})

describe('the app theme', () => {
  it('is dark on the landing page, and light from signing in on and for guests', () => {
    for (const path of ['/', '']) expect(defaultTheme(true, path)).toBe('dark')
    for (const path of ['/sign-in', '/dashboard', '/dashboard/my-talk', '/try', '/invite/abc', '/admin']) expect(defaultTheme(true, path)).toBe('light')
  })

  it('is dark self-hosted and in the desktop app, where / is the dashboard', () => {
    expect(defaultTheme(false, '/dashboard')).toBe('dark')
    expect(defaultTheme(false, '/')).toBe('dark')
    expect(themeSurface(false, '/')).toBe('app')
  })

  it('keeps the landing page’s choice apart from the editor’s', () => {
    expect(themeSurface(true, '/')).toBe('site')
    expect(themeSurface(true, '/dashboard/my-talk')).toBe('app')
    const s = storage()
    saveTheme('site', 'light', s)
    expect(s.items[SITE_THEME_KEY]).toBe('light')
    expect(chosenTheme('site', { storage: s })).toBe('light')
    // Turning the landing page light leaves the editor at its default
    expect(chosenTheme('app', { storage: s })).toBe(null)
    saveTheme('app', 'dark', s)
    expect(s.items[APP_THEME_KEY]).toBe('dark')
    expect(chosenTheme('app', { storage: s })).toBe('dark')
    expect(chosenTheme('site', { storage: s })).toBe('light')
  })

  it('ignores the old shared key on the hosted site, which a landing-page toggle filled too', () => {
    const s = storage({ 'parallax-theme': 'dark', 'editor-theme': 'light' })
    expect(chosenTheme('app', { isCloud: true, storage: s })).toBe(null)
    expect(chosenTheme('site', { isCloud: true, storage: s })).toBe(null)
  })

  it('takes the old keys as the self-hosted app’s choice, a light in the oldest only', () => {
    expect(chosenTheme('app', { isCloud: false, storage: storage({ 'parallax-theme': 'light' }) })).toBe('light')
    expect(chosenTheme('app', { isCloud: false, storage: storage({ 'editor-theme': 'light' }) })).toBe('light')
    expect(chosenTheme('app', { isCloud: false, storage: storage({ 'editor-theme': 'dark' }) })).toBe(null)
    expect(chosenTheme('app', { isCloud: false, storage: storage({ 'parallax-theme': 'light', [APP_THEME_KEY]: 'dark' }) })).toBe('dark')
  })

  it('falls back to the default when storage is blocked', () => {
    const blocked = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } }
    expect(chosenTheme('app', { storage: blocked })).toBe(null)
    expect(chosenTheme('app', { isCloud: false, storage: blocked })).toBe(null)
    expect(() => saveTheme('site', 'light', blocked)).not.toThrow()
  })
})

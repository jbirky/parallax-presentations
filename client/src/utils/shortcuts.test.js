import { describe, it, expect } from 'vitest'
import { SHORTCUTS, SHORTCUT_GROUPS, keyLabel, withShortcut, matchesShortcut } from './shortcuts'
import { findShortcuts } from '../components/KeyboardShortcuts'

const press = (key, extra = {}) => ({ key, code: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra })

describe('the shortcuts table', () => {
  it('writes keys as this computer does', () => {
    expect(keyLabel('Mod+Shift+G', false)).toBe('Ctrl+Shift+G')
    expect(keyLabel('Mod+Shift+G', true)).toBe('⌘⇧G')
    expect(keyLabel('Alt+/', true)).toBe('⌥/')
    expect(keyLabel([SHORTCUTS.cut, SHORTCUTS.copy], false)).toBe('Ctrl+X  Ctrl+C')
    expect(keyLabel('↑  ↓', false)).toBe('↑  ↓')
    expect(withShortcut('Bold', 'Mod+B')).toMatch(/^Bold \((Ctrl\+B|⌘B)\)$/)
    expect(withShortcut('Text box')).toBe('Text box')
  })

  it('matches a key only with exactly its modifiers', () => {
    expect(matchesShortcut(press('m', { ctrlKey: true }), SHORTCUTS.newSlide)).toBe(true)
    expect(matchesShortcut(press('m', { metaKey: true }), SHORTCUTS.newSlide)).toBe(true)
    expect(matchesShortcut(press('m'), SHORTCUTS.newSlide)).toBe(false)
    expect(matchesShortcut(press('m', { ctrlKey: true, shiftKey: true }), SHORTCUTS.newSlide)).toBe(false)
    expect(matchesShortcut(press('G', { ctrlKey: true, shiftKey: true }), SHORTCUTS.ungroup)).toBe(true)
    expect(matchesShortcut(press('g', { ctrlKey: true }), SHORTCUTS.ungroup)).toBe(false)
    expect(matchesShortcut(press('Z', { ctrlKey: true, shiftKey: true }), SHORTCUTS.redoAlt)).toBe(true)
    expect(matchesShortcut(press('z', { ctrlKey: true, shiftKey: true }), SHORTCUTS.undo)).toBe(false)
  })

  it('goes by the key’s place where Shift or ⌥ change what it types', () => {
    // ⌥/ types ÷ on a Mac
    expect(matchesShortcut(press('÷', { altKey: true, code: 'Slash' }), SHORTCUTS.searchMenus)).toBe(true)
    // Shift+8 types *
    expect(matchesShortcut(press('*', { ctrlKey: true, shiftKey: true, code: 'Digit8' }), SHORTCUTS.bulletList)).toBe(true)
    // / with Shift, on keyboards that need it
    expect(matchesShortcut(press('/', { ctrlKey: true, shiftKey: true, code: 'Digit7' }), SHORTCUTS.shortcuts)).toBe(true)
    expect(matchesShortcut(press('Delete'), SHORTCUTS.delete)).toBe(true)
  })

  it('is where the sheet’s keys come from', () => {
    // Every key combination the sheet lists is one of the table's
    const known = new Set(Object.values(SHORTCUTS))
    for (const group of SHORTCUT_GROUPS) {
      for (const [, keys] of group.items) {
        for (const k of [keys].flat()) {
          if (/Mod\+|Alt\+/.test(k)) expect(known.has(k), k).toBe(true)
        }
      }
    }
  })

  it('is searched by name or by keys', () => {
    expect(findShortcuts('bold').flatMap(g => g.items.map(([what]) => what))).toEqual(['Bold, italic, underline'])
    expect(findShortcuts('group').flatMap(g => g.items.map(([what]) => what))).toEqual(['Group, ungroup'])
    expect(findShortcuts('slide list').map(g => g.name)).toEqual(['Slides'])
    expect(findShortcuts('nothing like this')).toEqual([])
    expect(findShortcuts('').length).toBe(SHORTCUT_GROUPS.length)
  })
})

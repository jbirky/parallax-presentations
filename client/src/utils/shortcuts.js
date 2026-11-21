// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The editor's keyboard shortcuts: one table that the keyboard handler
// matches keys against (matchesShortcut), and that the Ctrl+/ sheet, the
// menus and the toolbar's tooltips show, so they never drift apart. "Mod" is
// Ctrl, or ⌘ on a Mac. The text ones are the text editor's own (TipTap's).

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')

export const SHORTCUTS = {
  undo: 'Mod+Z',
  redo: 'Mod+Y',
  redoAlt: 'Mod+Shift+Z',
  find: 'Mod+F',
  newSlide: 'Mod+M',
  shortcuts: 'Mod+/',
  searchMenus: 'Alt+/',
  selectAll: 'Mod+A',
  cut: 'Mod+X',
  copy: 'Mod+C',
  paste: 'Mod+V',
  duplicate: 'Mod+D',
  delete: 'Delete',
  group: 'Mod+G',
  ungroup: 'Mod+Shift+G',
  bold: 'Mod+B',
  italic: 'Mod+I',
  underline: 'Mod+U',
  strike: 'Mod+Shift+S',
  code: 'Mod+E',
  link: 'Mod+K',
  highlight: 'Mod+Shift+H',
  alignLeft: 'Mod+Shift+L',
  alignCenter: 'Mod+Shift+E',
  alignRight: 'Mod+Shift+R',
  bulletList: 'Mod+Shift+8',
  orderedList: 'Mod+Shift+7',
  heading1: 'Mod+Alt+1',
  heading2: 'Mod+Alt+2',
  heading3: 'Mod+Alt+3',
  paragraph: 'Mod+Alt+0',
  quote: 'Mod+Shift+B',
  codeBlock: 'Mod+Alt+C',
}

// "Mod+Shift+G" as this computer writes it; several, as a list
export function keyLabel(keys, mac = isMac) {
  if (!keys) return ''
  if (Array.isArray(keys)) return keys.map(k => keyLabel(k, mac)).join('  ')
  return mac ? keys.replace(/Mod\+/g, '⌘').replace(/Shift\+/g, '⇧').replace(/Alt\+/g, '⌥') : keys.replace(/Mod\+/g, 'Ctrl+')
}

// A name with its shortcut, for a tooltip: "Bold (Ctrl+B)"
export function withShortcut(name, keys) {
  return keys ? `${name} (${keyLabel(keys)})` : name
}

// Whether a key event is `keys` (exactly those modifiers). Digits, letters
// and / go by the key's place too, as Shift and ⌥ change what they type.
export function matchesShortcut(e, keys) {
  const parts = keys.split('+')
  const key = parts.pop()
  const mod = parts.includes('Mod')
  const shift = parts.includes('Shift')
  const alt = parts.includes('Alt')
  // Some keyboards type / with Shift
  const shiftOk = key === '/' || !!e.shiftKey === shift
  if (!!(e.ctrlKey || e.metaKey) !== mod || !shiftOk || !!e.altKey !== alt) return false
  if (/^\d$/.test(key)) return e.code === `Digit${key}` || e.key === key
  if (key === '/') return e.key === '/' || e.code === 'Slash'
  if (/^[A-Z]$/.test(key)) return (e.key || '').toLowerCase() === key.toLowerCase() || e.code === `Key${key}`
  return e.key === key
}

export const SHORTCUT_GROUPS = [
  {
    name: 'Slides',
    items: [
      ['New slide after this one', SHORTCUTS.newSlide],
      ['New slide, in the slide list', 'Enter'],
      ['Duplicate the slide, in the slide list', SHORTCUTS.duplicate],
      ['Delete the slide, in the slide list', SHORTCUTS.delete],
      ['Previous or next slide, in the slide list', '↑  ↓'],
    ],
  },
  {
    name: 'On a slide',
    items: [
      ['Select everything on the slide', SHORTCUTS.selectAll],
      ['Cut, copy, paste', [SHORTCUTS.cut, SHORTCUTS.copy, SHORTCUTS.paste]],
      ['Duplicate', SHORTCUTS.duplicate],
      ['Delete', SHORTCUTS.delete],
      ['Move 1px', '←  ↑  →  ↓'],
      ['Move 10px', 'Shift+arrow'],
      ['Group, ungroup', [SHORTCUTS.group, SHORTCUTS.ungroup]],
      ['Deselect', 'Esc'],
    ],
  },
  {
    name: 'Text',
    items: [
      ['Edit the selected text box', 'Enter, F2 or type'],
      ['Bold, italic, underline', [SHORTCUTS.bold, SHORTCUTS.italic, SHORTCUTS.underline]],
      ['Strikethrough', SHORTCUTS.strike],
      ['Link', SHORTCUTS.link],
      ['Align left, center, right', [SHORTCUTS.alignLeft, SHORTCUTS.alignCenter, SHORTCUTS.alignRight]],
      ['Bullet list, numbered list', [SHORTCUTS.bulletList, SHORTCUTS.orderedList]],
      ['Heading 1, 2, 3', [SHORTCUTS.heading1, SHORTCUTS.heading2, SHORTCUTS.heading3]],
      ['Normal text', SHORTCUTS.paragraph],
      ['Inline code, code block', [SHORTCUTS.code, SHORTCUTS.codeBlock]],
      ['Quote', SHORTCUTS.quote],
      ['Stop editing', 'Esc'],
    ],
  },
  {
    name: 'Anywhere',
    items: [
      ['Undo, redo', [SHORTCUTS.undo, SHORTCUTS.redo]],
      ['Find and replace', SHORTCUTS.find],
      ['Search the menus', SHORTCUTS.searchMenus],
      ['This list', SHORTCUTS.shortcuts],
    ],
  },
]

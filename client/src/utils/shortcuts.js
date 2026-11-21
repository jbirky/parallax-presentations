// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The editor's keyboard shortcuts, for the Ctrl+/ sheet and the menus that
// show them. "Mod" is Ctrl, or ⌘ on a Mac.

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')

// "Mod+Shift+G" as this computer writes it
export function keyLabel(keys, mac = isMac) {
  if (!keys) return ''
  return mac ? keys.replace(/Mod\+/g, '⌘').replace(/Shift\+/g, '⇧').replace(/Alt\+/g, '⌥') : keys.replace(/Mod\+/g, 'Ctrl+')
}

export const SHORTCUT_GROUPS = [
  {
    name: 'Slides',
    items: [
      ['New slide after this one', 'Mod+M'],
      ['New slide, in the slide list', 'Enter'],
      ['Duplicate the slide, in the slide list', 'Mod+D'],
      ['Delete the slide, in the slide list', 'Delete'],
      ['Previous or next slide, in the slide list', '↑  ↓'],
    ],
  },
  {
    name: 'On a slide',
    items: [
      ['Select everything on the slide', 'Mod+A'],
      ['Cut, copy, paste', 'Mod+X  Mod+C  Mod+V'],
      ['Duplicate', 'Mod+D'],
      ['Delete', 'Delete'],
      ['Move 1px', '←  ↑  →  ↓'],
      ['Move 10px', 'Shift+arrow'],
      ['Group, ungroup', 'Mod+G  Mod+Shift+G'],
      ['Deselect', 'Esc'],
    ],
  },
  {
    name: 'Text',
    items: [
      ['Edit the selected text box', 'Enter, F2 or type'],
      ['Bold, italic, underline', 'Mod+B  Mod+I  Mod+U'],
      ['Stop editing', 'Esc'],
    ],
  },
  {
    name: 'Anywhere',
    items: [
      ['Undo, redo', 'Mod+Z  Mod+Y'],
      ['Find and replace', 'Mod+F'],
      ['This list', 'Mod+/'],
      ['Search the menus', 'Alt+/'],
    ],
  },
]

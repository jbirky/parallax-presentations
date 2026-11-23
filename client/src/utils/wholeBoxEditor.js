// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Formatting a whole text box while it's selected, without editing it, as in
// PowerPoint, Keynote and Google Slides: bold, a color or a size applies to
// all of its text.
//
// The toolbar talks to a text editor (TipTap). For a selected box it gets a
// stand-in with the calls it makes (chain, isActive, getAttributes, can):
// each chain of commands runs over all of the box's text in an editor of its
// own, and the box's new HTML goes to onChange. The stand-in never takes the
// focus, so keys keep going to the canvas.

import { Editor } from '@tiptap/react'

// The stand-in for one box's HTML, made with the text editor's extensions;
// destroy() frees it
export function createWholeBoxEditor(extensions, html, onChange) {
  const ed = new Editor({ extensions, content: html || '' })
  const all = () => ed.commands.selectAll()
  const run = steps => {
    all()
    const before = ed.getHTML()
    let chain = ed.chain()
    for (const [name, args] of steps) {
      // The commands a toolbar button chains: everything but the focus
      if (name === 'focus' || typeof chain[name] !== 'function') continue
      chain = chain[name](...args)
    }
    const ok = chain.run()
    const after = ed.getHTML()
    if (after !== before) onChange(after)
    return ok
  }
  return {
    wholeBox: true,
    chain() {
      const steps = []
      const proxy = new Proxy({}, {
        get: (_, name) => (name === 'run' ? () => run(steps) : (...args) => { steps.push([name, args]); return proxy }),
      })
      return proxy
    },
    isActive: (...args) => { all(); return ed.isActive(...args) },
    getAttributes: (...args) => { all(); return ed.getAttributes(...args) },
    // Undo is the presentation's, not this editor's
    can: () => ({ undo: () => false, redo: () => false }),
    destroy: () => ed.destroy(),
  }
}

// Bold, italic or underline for all the text of every box in `htmls`: on for
// all of them, unless all of them have it already, then off. The boxes' new
// HTML, in order.
export function toggleMarkAcross(extensions, htmls, mark) {
  const editors = htmls.map(html => new Editor({ extensions, content: html || '' }))
  try {
    editors.forEach(ed => ed.commands.selectAll())
    const on = editors.every(ed => ed.isActive(mark))
    const name = mark[0].toUpperCase() + mark.slice(1)
    return editors.map(ed => {
      ed.chain().selectAll()[on ? `unset${name}` : `set${name}`]().run()
      return ed.getHTML()
    })
  } finally {
    editors.forEach(ed => ed.destroy())
  }
}

import { Extension } from '@tiptap/core'

// A paragraph's or list's own font size, and a list's color, kept through
// editing. Text boxes sit in the slide's 42px type, so without a size of
// their own, small text keeps big paragraph gaps, list indents and bullets;
// and a list on a light slide (as the Beamer import makes them) would get
// the box's white bullets back. Line heights are extensions/LineHeight.js's.
const style = (prop, css) => ({
  default: null,
  parseHTML: el => el.style[prop] || null,
  renderHTML: attrs => attrs[prop] ? { style: `${css}: ${attrs[prop]}` } : {},
})

export const BlockStyle = Extension.create({
  name: 'blockStyle',
  addGlobalAttributes() {
    return [
      { types: ['bulletList', 'orderedList'], attributes: { color: style('color', 'color') } },
      { types: ['paragraph', 'bulletList', 'orderedList'], attributes: { fontSize: style('fontSize', 'font-size') } },
    ]
  },
})

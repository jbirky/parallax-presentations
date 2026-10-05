import { Node } from '@tiptap/core'
import { CITATION_STYLE } from '../utils/citationIndex'

// A citation in a text box, <sup data-cite="key">[2]</sup>, kept whole: the
// text editor has no superscript of its own, and without this it dropped the
// tag and the key with it, leaving plain text. The label is a cache that the
// citation index refreshes wherever the slide is drawn (utils/citationIndex.js).
export const CitationNode = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      cite:  { default: '' },
      label: { default: '' },
    }
  },

  parseHTML() {
    const getAttrs = el => ({ cite: el.getAttribute('data-cite') || '', label: el.textContent || '' })
    return [{ tag: 'sup[data-cite]', getAttrs }, { tag: 'span[data-cite]', getAttrs }]
  },

  renderHTML({ node }) {
    return ['sup', { 'data-cite': node.attrs.cite, style: CITATION_STYLE }, node.attrs.label]
  },

  renderText({ node }) {
    return node.attrs.label
  },
})

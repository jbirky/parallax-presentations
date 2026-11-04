import TextStyle from '@tiptap/extension-text-style'

const textProperties = {
  color: 'color', fontFamily: 'font-family', fontSize: 'font-size', fontWeight: 'font-weight',
}

// TipTap normally reads these attributes only from spans. Imported decks also
// put them on paragraphs, headings and list containers. Read the inline cascade
// before those containers are converted to editor nodes.
const blockTags = /^(P|H[1-6]|LI|UL|OL|BLOCKQUOTE|DIV)$/

// Toolbar controls must use the same block defaults that the text inherits.
export function getSelectionTextStyle(editor) {
  if (!editor) return {}
  const attrs = {}
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const block = $from.node(depth).attrs
    for (const property of Object.keys(textProperties)) {
      if (!attrs[property] && block[property]) attrs[property] = block[property]
    }
  }
  for (const [property, value] of Object.entries(editor.getAttributes('textStyle'))) {
    if (value) attrs[property] = value
  }
  return attrs
}

function inheritedStyles(element, inlineOnly = false) {
  const attrs = {}
  for (const property of Object.keys(textProperties)) {
    for (let node = element; node?.style; node = node.parentElement) {
      if (inlineOnly && blockTags.test(node.tagName)) break
      const value = node.style[property]
      if (value && value !== 'inherit') { attrs[property] = value; break }
      if (property === 'fontWeight' && /^(STRONG|B)$/.test(node.tagName)) {
        attrs[property] = 'bold'
        break
      }
    }
  }
  return attrs
}

export default TextStyle.extend({
  parseHTML() {
    return [{
      tag: '[style]',
      // Keep parsing the paragraph/heading or semantic mark on the same tag.
      consuming: false,
      getAttrs: element => {
        // Block defaults belong on the block itself. Repeating a relative
        // font size on a child span would apply it twice (e.g. 2em -> 4em).
        if (blockTags.test(element.tagName)) return false
        const attrs = inheritedStyles(element, true)
        if (!Object.keys(attrs).length) return false
        // The Color/FontSize/etc. attribute parsers run after getAttrs and read
        // element.style. Materialize inherited values on this temporary parse
        // DOM, so a nested span changing size does not clear the parent color.
        for (const [property, value] of Object.entries(attrs)) element.style[property] = value
        return {}
      },
    }]
  },
  addGlobalAttributes() {
    return [{
      // Retain block defaults even when the paragraph is empty, so its first
      // newly typed character still inherits the original formatting.
      types: ['paragraph', 'heading', 'listItem'],
      attributes: Object.fromEntries(Object.entries(textProperties).map(([property, css]) => [property, {
        default: null,
        parseHTML: element => inheritedStyles(element)[property] || null,
        renderHTML: attrs => attrs[property] ? { style: `${css}: ${attrs[property]}` } : {},
      }])),
    }]
  },
})

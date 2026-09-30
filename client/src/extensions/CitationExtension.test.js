// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TextStyle from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { CitationNode } from './CitationExtension'

// The text editor as EditorPage sets it up, as far as citations care
const editorWith = content => new Editor({ extensions: [StarterKit, TextStyle, Color, CitationNode], content })

describe('a citation in the text editor', () => {
  it('is inserted with its key and label, and stays one piece', () => {
    const editor = editorWith('<p>See </p>')
    editor.commands.setTextSelection(5)
    editor.commands.insertContent({ type: 'citation', attrs: { cite: 'smith2020', label: '[1]' } })
    editor.commands.insertContent(' and more')
    expect(editor.getHTML()).toBe('<p>See<sup data-cite="smith2020" style="color: #6366f1; cursor: default;">[1]</sup> and more</p>')
  })

  it('keeps its key through saving and loading, without gaining bold', () => {
    const saved = '<p>x<sup data-cite="doe2019" style="color:#6366f1;cursor:default">(Doe &amp; Roe, 2019)</sup> y</p>'
    const html = editorWith(saved).getHTML()
    expect(html).toBe('<p>x<sup data-cite="doe2019" style="color: #6366f1; cursor: default;">(Doe &amp; Roe, 2019)</sup> y</p>')
    expect(editorWith(html).getHTML()).toBe(html)
  })

  it('escapes a key that would end its attribute', () => {
    const editor = editorWith('<p></p>')
    editor.commands.insertContent({ type: 'citation', attrs: { cite: 'a"b', label: '[1]' } })
    expect(editor.getHTML()).toContain('data-cite="a&quot;b"')
  })

  it('reads a span marker too, and leaves a plain number as text', () => {
    const editor = editorWith('<p><span data-cite="k">[2]</span> and [3]</p>')
    expect(editor.getHTML()).toBe('<p><sup data-cite="k" style="color: #6366f1; cursor: default;">[2]</sup> and [3]</p>')
    expect(editor.getText()).toBe('[2] and [3]')
  })
})

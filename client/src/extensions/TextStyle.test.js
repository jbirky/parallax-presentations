// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import TextStyle, { getSelectionTextStyle } from './TextStyle'
import { FontSize } from './FontSize'
import { FontWeight } from './FontWeight'
import { LineHeight } from './LineHeight'

let editor
afterEach(() => editor?.destroy())

function open(content) {
  editor = new Editor({
    extensions: [StarterKit, Underline, TextStyle, Color, FontFamily, FontSize, FontWeight,
      LineHeight, TextAlign.configure({ types: ['heading', 'paragraph'] })],
    content,
  })
  return editor
}

function append(text) {
  editor.commands.setTextSelection(editor.state.doc.content.size - 1)
  editor.commands.insertContent(text)
  return editor.getHTML()
}

function currentStyle() {
  return getSelectionTextStyle(editor)
}

describe('preserving text formatting when opening the editor', () => {
  it.each(['p', 'h2'])('keeps a black %s and types in its existing font', tag => {
    open(`<${tag} style="color:#000000;font-family:Arial;font-size:28px;font-weight:500">Hello</${tag}>`)
    append(' world')
    expect(editor.getText()).toBe('Hello world')
    expect(currentStyle()).toMatchObject({
      color: '#000000', fontFamily: 'Arial', fontSize: '28px', fontWeight: '500',
    })
    expect(editor.getHTML()).toContain('color: #000000')
  })

  it('keeps inherited color when a nested span changes only size', () => {
    open('<p style="color:black;font-family:Arial"><span style="font-size:24px">Text</span></p>')
    append('!')
    expect(currentStyle()).toMatchObject({ color: 'black', fontFamily: 'Arial', fontSize: '24px' })
  })

  it('preserves mixed colors and nested overrides', () => {
    open('<p style="color:black"><span style="color:red">Red</span> Black</p>')
    append('!')
    expect(editor.getHTML()).toContain('color: red')
    expect(editor.getHTML()).toContain('color: black')
    expect(currentStyle().color).toBe('black')
    expect(editor.getText()).toBe('Red Black!')
  })

  it('retains the font and color of an empty paragraph for new text', () => {
    open('<p style="color:black;font-family:Arial;font-size:24px"></p>')
    append('New')
    const html = editor.getHTML()
    expect(html).toContain('color: black')
    expect(html).toContain('font-size: 24px')
    expect(html).toContain('font-family: Arial')
  })

  it('keeps bold, italic, underline, alignment and line height', () => {
    open('<p style="color:black;text-align:center;line-height:1.8"><strong><em><u>Styled</u></em></strong></p>')
    const html = append('!')
    expect(editor.isActive('bold')).toBe(true)
    expect(editor.isActive('italic')).toBe(true)
    expect(editor.isActive('underline')).toBe(true)
    expect(html).toContain('text-align: center')
    expect(html).toContain('line-height: 1.8')
    expect(html).toContain('color: black')
  })

  it('preserves inherited list text styles through an HTML round trip', () => {
    open('<ul style="color:black;font-family:Arial"><li><p>Item</p></li></ul>')
    const html = editor.getHTML()
    editor.commands.setContent(html, false)
    expect(editor.getHTML()).toContain('color: black')
    expect(editor.getHTML()).toContain('font-family: Arial')
  })

  it('does not carry color or font from the previously edited box', () => {
    open('<p><span style="color:red;font-family:serif">Previous</span></p>')
    append('!')
    editor.commands.setContent('<p style="color:black;font-family:Arial">Next</p>', false)
    const html = append('!')
    expect(html).not.toContain('color: red')
    expect(html).not.toContain('font-family: serif')
    expect(html).toContain('color: black')
    expect(html).toContain('font-family: Arial')
  })

  it('does not duplicate relative block font sizes on child spans', () => {
    open('<p style="color:black;font-size:2em"><span style="color:red">Text</span></p>')
    append('!')
    expect(editor.getHTML().match(/font-size: 2em/g)).toHaveLength(1)
    expect(currentStyle()).toMatchObject({ fontSize: '2em', color: 'red' })
  })
})

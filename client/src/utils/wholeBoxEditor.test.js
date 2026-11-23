// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { createWholeBoxEditor, toggleMarkAcross } from './wholeBoxEditor'

const extensions = () => [StarterKit, Underline, TextAlign.configure({ types: ['heading', 'paragraph'] }), TextStyle, Color]

describe('createWholeBoxEditor', () => {
  it('runs a toolbar chain over all of the text, without the focus', () => {
    const onChange = vi.fn()
    const box = createWholeBoxEditor(extensions(), '<p>One</p><p>Two</p>', onChange)
    expect(box.isActive('bold')).toBe(false)
    box.chain().focus().toggleBold().run()
    expect(onChange).toHaveBeenLastCalledWith('<p><strong>One</strong></p><p><strong>Two</strong></p>')
    box.chain().focus().setTextAlign('center').run()
    expect(onChange.mock.lastCall[0]).toContain('text-align: center')
    box.chain().focus().setColor('#ff0000').run()
    expect(onChange.mock.lastCall[0]).toContain('color: #ff0000')
    expect(box.isActive('bold')).toBe(true)
    box.destroy()
  })

  it('reports nothing when a command changes nothing', () => {
    const onChange = vi.fn()
    const box = createWholeBoxEditor(extensions(), '<p>Left</p>', onChange)
    box.chain().focus().unsetBold().run()
    expect(onChange).not.toHaveBeenCalled()
    expect(box.can().undo()).toBe(false)
    box.destroy()
  })
})

describe('toggleMarkAcross', () => {
  it('turns a mark on for every box unless all have it, then off', () => {
    const mixed = toggleMarkAcross(extensions(), ['<p><strong>A</strong></p>', '<p>B</p>'], 'bold')
    expect(mixed).toEqual(['<p><strong>A</strong></p>', '<p><strong>B</strong></p>'])
    expect(toggleMarkAcross(extensions(), mixed, 'bold')).toEqual(['<p>A</p>', '<p>B</p>'])
    expect(toggleMarkAcross(extensions(), ['<p>C</p>'], 'underline')).toEqual(['<p><u>C</u></p>'])
  })
})

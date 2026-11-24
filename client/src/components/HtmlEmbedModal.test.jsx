// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import HtmlEmbedModal from './HtmlEmbedModal'
import { readEmbedContent } from '../utils/embedContent'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, el
afterEach(() => { act(() => root.unmount()); el.remove() })

async function mount(props) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<HtmlEmbedModal onCancel={() => {}} onApply={() => {}} {...props} />))
}
const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const field = label => el.querySelector(`[aria-label="${label}"]`)
async function type(node, value) {
  const proto = node.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : node.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value)
    node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}
const click = node => act(async () => { node.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

const CONTENT = {
  $labels: { reqs: 'Requirements' },
  $choices: { status: ['open', 'in work', 'closed'] },
  caption: 'Parts list',
  margin: 12,
  notes: ['One', 'Two'],
  reqs: [
    { id: 'REQ-001', text: 'Deliver 8,000 kg to orbit', status: 'closed' },
    { id: 'REQ-002', text: 'Survive max-Q', status: 'open' },
  ],
}
const EMBED = `<div id="x"></div>\n<script type="application/json" data-parallax-content>\n${JSON.stringify(CONTENT)}\n</script>\n<script>/* draws it */</script>`

describe('HtmlEmbedModal', () => {
  it('opens an embed with a content block on its form, and applies what changed', async () => {
    const onApply = vi.fn()
    await mount({ content: EMBED, width: 960, height: 540, onApply })
    expect(el.querySelector('[role="tab"][aria-selected="true"]').textContent).toBe('Content')
    expect(el.querySelector('iframe[title="Embed preview"]')).not.toBe(null)
    expect(el.textContent).toContain('Requirements')
    expect(el.textContent).not.toContain('$choices')

    await type(field('Caption'), 'Bill of materials')
    await type(field('Margin'), '15.5')
    await type(field('Notes'), 'One\nTwo\nThree')
    await type(field('Text, row 2'), 'Survive 35 kPa at max-Q')
    await type(field('Status, row 2'), 'in work')
    await click(button('+ Add row'))
    await type(field('ID, row 3'), 'REQ-003')
    await click(el.querySelector('[aria-label="Move row 3 up"]'))
    await click(el.querySelector('[aria-label="Remove row 1"]'))
    await click(button('Apply'))

    const html = onApply.mock.calls[0][0]
    expect(html.endsWith('<script>/* draws it */</script>')).toBe(true)
    const { data } = readEmbedContent(html)
    expect(data.caption).toBe('Bill of materials')
    expect(data.margin).toBe(15.5)
    expect(data.notes).toEqual(['One', 'Two', 'Three'])
    expect(data.reqs).toEqual([
      { id: 'REQ-003', text: '', status: 'in work' },
      { id: 'REQ-002', text: 'Survive 35 kPa at max-Q', status: 'in work' },
    ])
    expect(data.$choices).toEqual(CONTENT.$choices)
  })

  it('keeps a number box’s half-typed number without changing the value', async () => {
    const onApply = vi.fn()
    await mount({ content: EMBED, onApply })
    await type(field('Margin'), '-')
    expect(field('Margin').value).toBe('-')
    await click(button('Apply'))
    expect(readEmbedContent(onApply.mock.calls[0][0]).data.margin).toBe(12)
  })

  it('switches to the code and back, keeping edits from either', async () => {
    const onApply = vi.fn()
    await mount({ content: EMBED, onApply })
    await type(field('Caption'), 'Edited in the form')
    await click(button('Code'))
    const code = field('Embed code')
    expect(code.value).toContain('Edited in the form')
    await type(code, code.value.replace('Edited in the form', 'Edited in the code'))
    await click(button('Content'))
    expect(field('Caption').value).toBe('Edited in the code')
    await click(button('Apply'))
    expect(readEmbedContent(onApply.mock.calls[0][0]).data.caption).toBe('Edited in the code')
  })

  it('says when the block’s JSON is broken', async () => {
    await mount({ content: EMBED.replace('"margin":12', '"margin":') })
    expect(el.textContent).toContain('isn’t valid JSON')
    await click(button('Fix it in the code'))
    expect(field('Embed code')).not.toBe(null)
  })

  it('opens any other embed on its code, with no tabs', async () => {
    const onApply = vi.fn()
    await mount({ content: '<p>Hello</p>', onApply })
    expect(el.querySelector('[role="tablist"]')).toBe(null)
    await type(field('Embed code'), '<p>Hi</p>')
    await click(button('Apply'))
    expect(onApply).toHaveBeenCalledWith('<p>Hi</p>')
  })

  it('opens on the code when asked to', async () => {
    await mount({ content: EMBED, initialMode: 'code' })
    expect(field('Embed code')).not.toBe(null)
    expect(el.querySelector('[role="tab"][aria-selected="true"]').textContent).toBe('Code')
  })
})

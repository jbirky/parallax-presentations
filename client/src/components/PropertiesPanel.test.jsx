import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

if (!globalThis.window) globalThis.window = {}

import PropertiesPanel from './PropertiesPanel'

const text = (id, extra = {}) => ({ id, type: 'text', x: 0, y: 0, width: 100, height: 40, zIndex: 1, content: `<p>${id}</p>`, ...extra })

// The panel's text, one line per piece, with each select showing its chosen option
function panel(slide, selected) {
  const html = renderToStaticMarkup(
    <PropertiesPanel slide={slide} selectedElement={selected} selectedElementIds={[selected.id]} presentation={{ id: 'p', slides: [slide] }}
      onUpdateSlide={() => {}} onUpdateElement={() => {}} onUpdateWithGroup={() => {}} onSelectElement={() => {}} currentSlideIndex={0} />)
  const chosen = [...html.matchAll(/<option value="[^"]*" selected="">([^<]*)</g)].map(m => m[1])
  const lines = html.replace(/<option[^>]*>[^<]*<\/option>/g, '').replace(/<[^>]+>/g, '\n').split('\n').map(s => s.trim()).filter(Boolean)
  return { html, lines, chosen }
}

describe('On click in the Properties panel', () => {
  const tab = text('Tab A', { clickAction: { type: 'visibility', show: ['Panel A', 'Panel A text'], hide: ['Tab A'] }, hoverEffect: 'lift' })
  const slide = { id: 's1', elements: [
    tab,
    text('Panel A', { groupId: 'g', startHidden: true }), text('Panel A text', { groupId: 'g', startHidden: true }),
    { id: 'chart', type: 'html', x: 0, y: 0, width: 10, height: 10, content: '' },
  ] }

  it('lists what a click shows or hides, a group as one', () => {
    const { lines, chosen } = panel(slide, tab)
    const at = lines.indexOf('On click')
    expect(at).toBeGreaterThan(-1)
    expect(lines.slice(at)).toEqual(expect.arrayContaining(['Tab A (this)', 'Group: Panel A', '· hidden at start', 'Html 1', 'On hover', 'Hidden until a click shows it']))
    // The action, then Tab A: hide, the group: show, the chart: no change, then the hover style
    expect(chosen.slice(-5)).toEqual(['Show or hide elements', 'Hide', 'Show', '—', 'Lift'])
  })

  it('lets an embed be hidden at start, without a click action of its own', () => {
    const { lines, html } = panel(slide, slide.elements[3])
    expect(lines).toContain('This element takes its own clicks, but a click on something else can still show or hide it.')
    expect(lines).toContain('Hidden until a click shows it')
    expect(html).not.toContain('aria-label="On click"')
  })

  it('warns when nothing shows an element hidden at start', () => {
    const lonely = { id: 's', elements: [text('x', { startHidden: true })] }
    expect(panel(lonely, lonely.elements[0]).lines).toContain('Nothing on this slide shows it yet.')
    expect(panel(slide, slide.elements[1]).lines).not.toContain('Nothing on this slide shows it yet.')
  })
})

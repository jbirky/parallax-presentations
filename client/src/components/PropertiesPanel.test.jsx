import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

if (!globalThis.window) globalThis.window = {}

import PropertiesPanel from './PropertiesPanel'

const text = (id, extra = {}) => ({ id, type: 'text', x: 0, y: 0, width: 100, height: 40, zIndex: 1, content: `<p>${id}</p>`, ...extra })

// The panel's text, one line per piece, with each select showing its chosen option
function panel(slide, selected, props = {}) {
  const html = renderToStaticMarkup(
    <PropertiesPanel slide={slide} selectedElement={selected} selectedElementIds={[selected.id]} presentation={{ id: 'p', slides: [slide] }}
      onUpdateSlide={() => {}} onUpdateElement={() => {}} onUpdateWithGroup={() => {}} onSelectElement={() => {}} currentSlideIndex={0} {...props} />)
  const chosen = [...html.matchAll(/<option value="[^"]*" selected="">([^<]*)</g)].map(m => m[1])
  const lines = html.replace(/<option[^>]*>[^<]*<\/option>/g, '').replace(/<[^>]+>/g, '\n').split('\n').map(s => s.trim()).filter(Boolean)
  return { html, lines, chosen }
}

describe('Interactions in the Properties panel', () => {
  const tab = text('Tab A', { clickAction: { type: 'visibility', show: ['Panel A', 'Panel A text'], hide: ['Tab A'] }, hoverEffect: 'lift' })
  const slide = { id: 's1', elements: [
    tab,
    text('Panel A', { groupId: 'g', startHidden: true }), text('Panel A text', { groupId: 'g', startHidden: true }),
    { id: 'chart', type: 'html', x: 0, y: 0, width: 10, height: 10, content: '' },
  ] }

  it('lists what a click shows or hides, a group as one', () => {
    const { lines, chosen } = panel(slide, tab)
    const at = lines.indexOf('Interactions')
    expect(at).toBeGreaterThan(-1)
    expect(lines.slice(at)).toEqual(expect.arrayContaining(['On click', 'Tab A (this)', 'Group: Panel A', '· hidden at start', 'Html 1', 'Hover style', 'On hover', 'Hidden until a click or hover shows it']))
    // The action, then Tab A: hide, the group: show, the chart: no change, then the hover style, and no hover action
    expect(chosen.slice(-6)).toEqual(['Show, hide or change elements', 'Hide', 'Show', '—', 'Lift', 'Nothing'])
  })

  it('lists what a hover shows or hides, leaving out the element itself', () => {
    const spot = text('Spot', { groupId: 'm', hoverAction: { type: 'visibility', show: ['Panel A', 'Panel A text'], hide: ['chart'] } })
    const hoverSlide = { ...slide, elements: [...slide.elements, spot, text('Spot label', { groupId: 'm' })] }
    const { lines, chosen, html } = panel(hoverSlide, spot)
    // No click action, then the hover: the tab no change, the group: show, the chart: hide
    expect(chosen.slice(-5)).toEqual(['Nothing', 'Show, hide or change elements', '—', 'Show', 'Hide'])
    expect(html).toContain('aria-label="Group: Panel A: on hover"')
    expect(html).not.toContain('Group: Spot') // its own group can't be shown or hidden by its hover
    expect(lines).not.toContain('Hover style') // only for clickable elements
    expect(lines).toContain('Applies to the whole group.')
  })

  it('lets an embed be hidden at start, without a click action of its own', () => {
    const { lines, html } = panel(slide, slide.elements[3])
    expect(lines).toContain('This element takes its own clicks and hovers, but a click or hover on something else can still show or hide it.')
    expect(lines).toContain('Hidden until a click or hover shows it')
    expect(html).not.toContain('aria-label="On click"')
    expect(html).not.toContain('aria-label="On hover"')
  })

  it('warns when nothing shows an element hidden at start', () => {
    const lonely = { id: 's', elements: [text('x', { startHidden: true })] }
    expect(panel(lonely, lonely.elements[0]).lines).toContain('Nothing on this slide shows it yet.')
    expect(panel(slide, slide.elements[1]).lines).not.toContain('Nothing on this slide shows it yet.')
    const hovered = { id: 's', elements: [text('x', { startHidden: true }), text('y', { hoverAction: { type: 'visibility', show: ['x'] } })] }
    expect(panel(hovered, hovered.elements[0]).lines).not.toContain('Nothing on this slide shows it yet.')
  })
})

describe('States in the Properties panel', () => {
  const card = text('Card', { states: [{ id: 'st_a', name: 'Flipped', flipX: true, duration: 300, easing: 'spring' }, { id: 'st_b', name: 'Big' }], initialState: 'st_b' })
  const button = text('Button', { clickAction: { type: 'visibility', show: [], hide: [], toggle: [], set: [{ id: 'Card', state: 'st_a', mode: 'toggle' }, { id: 'Gone', state: 'x' }] } })
  const slide = { id: 's1', elements: [card, button] }

  it('lists the states, what it starts as, and offers zooming for an element without any', () => {
    const { lines, chosen, html } = panel(slide, card)
    expect(html).toContain('aria-label="States"')
    expect(lines).toEqual(expect.arrayContaining(['Default', 'Flipped', 'Big', '+ State', 'Starts as']))
    expect(html).toContain('be seen while turned over (for flip cards)')
    expect(chosen).toContain('Big') // starts as
    expect(lines).not.toContain('Zoom in when clicked')
    expect(panel({ id: 's', elements: [text('x')] }, text('x')).lines).toContain('Zoom in when clicked')
  })

  it('shows the state being recorded, and hides the layer buttons', () => {
    const { lines, chosen, html } = panel(slide, card, { recordingState: 'st_a' })
    expect(html).toContain('aria-pressed="true" style="padding:2px 8px;border-radius:10px;border:1px solid var(--border);font-size:11px;cursor:pointer;background:#d946ef')
    expect(html).toContain('value="Flipped"')
    expect(html).toContain('value="300"')
    expect(chosen).toContain('Spring')
    expect(lines).toEqual(expect.arrayContaining(['Clear changes', 'Delete state', 'In front of everything']))
    expect(lines).not.toContain('↑ Forward')
    expect(panel(slide, card).lines).toContain('↑ Forward')
  })

  it('lets a click put elements in their states', () => {
    const { chosen, html } = panel(slide, button)
    expect(html).toContain('aria-label="Card: state on click"')
    expect(chosen).toContain('Toggle Flipped')
    expect(html).toContain('<option value="cycle:">Next state</option>')
  })
})

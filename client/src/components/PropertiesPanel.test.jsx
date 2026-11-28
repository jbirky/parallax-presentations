import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

if (!globalThis.window) globalThis.window = {}

import PropertiesPanel from './PropertiesPanel'

const text = (id, extra = {}) => ({ id, type: 'text', x: 0, y: 0, width: 100, height: 40, zIndex: 1, content: `<p>${id}</p>`, ...extra })

// The panel's text, one line per piece, with each select showing its chosen option
function panel(slide, selected, props = {}, { before } = {}) {
  const whole = renderToStaticMarkup(
    <PropertiesPanel slide={slide} selectedElement={selected} selectedElementIds={[selected.id]} presentation={{ id: 'p', slides: [slide] }}
      onUpdateSlide={() => {}} onUpdateElement={() => {}} onUpdateWithGroup={() => {}} onSelectElement={() => {}} currentSlideIndex={0} {...props} />)
  // Up to `before`, as the element's part of a tab, without the slide's after it
  const html = before && whole.includes(before) ? whole.slice(0, whole.indexOf(before)) : whole
  const chosen = [...html.matchAll(/<option value="[^"]*" selected="">([^<]*)</g)].map(m => m[1])
  const lines = html.replace(/<option[^>]*>[^<]*<\/option>/g, '').replace(/<[^>]+>/g, '\n').split('\n').map(s => s.trim()).filter(Boolean)
  return { html, lines, chosen }
}

// The Animate tab, where interactions, states and steps are (the element's
// part, without the slide's transition after it)
const animate = (slide, selected, props = {}) => panel(slide, selected, { tab: 'animate', ...props }, { before: '>Transition' })
// The panel with nothing selected
function nothing(slide, props = {}) {
  const html = renderToStaticMarkup(
    <PropertiesPanel slide={slide} selectedElement={null} selectedElementIds={[]} presentation={{ id: 'p', slides: [slide] }}
      onUpdateSlide={() => {}} onUpdateElement={() => {}} onUpdateWithGroup={() => {}} onSelectElement={() => {}} currentSlideIndex={0} {...props} />)
  return { html, lines: html.replace(/<option[^>]*>[^<]*<\/option>/g, '').replace(/<[^>]+>/g, '\n').split('\n').map(s => s.trim()).filter(Boolean) }
}

describe('The inspector’s tabs', () => {
  const box = text('Box')
  const slide = { id: 's1', elements: [box], notes: 'Say hello' }

  it('formats a text box under Text, Box and Arrange, without its animations', () => {
    const { lines, html } = panel(slide, box)
    expect(html).toContain('role="tablist"')
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>Format</)
    expect(lines.slice(lines.indexOf('Slide') + 1, lines.indexOf('Slide') + 3)).toEqual(['Text box', 'Text'])
    expect(lines).toEqual(expect.arrayContaining(['Box', 'Fixed size', 'Grow box', 'Arrange', 'Anchor point', 'Delete']))
    expect(lines.indexOf('Text')).toBeLessThan(lines.indexOf('Box'))
    expect(lines.indexOf('Box')).toBeLessThan(lines.indexOf('Arrange'))
    expect(lines).not.toContain('Appear on click')
    expect(lines).not.toContain('Interactions')
    expect(lines).not.toContain('Transition')
  })

  it('animates it under Animate, with the slide’s transition', () => {
    const { lines } = panel(slide, box, { tab: 'animate' })
    expect(lines).toEqual(expect.arrayContaining(['Entry animation, as the slide opens', 'Appear on click', 'Interactions', 'Transition']))
    expect(lines).not.toContain('Arrange')
    expect(lines).not.toContain('Fixed size')
  })

  it('shows the slide’s background when nothing is selected', () => {
    const { lines } = nothing(slide)
    expect(lines).toEqual(expect.arrayContaining(['Slide 1', 'Select something on the slide to format it.', 'Background', 'Color', 'Gradient']))
  })

  it('keeps the background and footer on the Slide tab, the rest folded under Advanced, and the notes under the slide', () => {
    const { lines } = nothing(slide, { tab: 'slide' })
    expect(lines).toEqual(expect.arrayContaining(['Background', 'Footer', 'Advanced']))
    expect(lines).not.toContain('Slide Group')
    expect(lines).not.toContain('Speaker Notes')
    expect(lines).not.toContain('Say hello')
  })
})

describe('Interactions in the Properties panel', () => {
  const tab = text('Tab A', { clickAction: { type: 'visibility', show: ['Panel A', 'Panel A text'], hide: ['Tab A'] }, hoverEffect: 'lift' })
  const slide = { id: 's1', elements: [
    tab,
    text('Panel A', { groupId: 'g', startHidden: true }), text('Panel A text', { groupId: 'g', startHidden: true }),
    { id: 'chart', type: 'html', x: 0, y: 0, width: 10, height: 10, content: '' },
  ] }

  it('lists what a click shows or hides, a group as one', () => {
    const { lines, chosen } = animate(slide, tab)
    const at = lines.indexOf('Interactions')
    expect(at).toBeGreaterThan(-1)
    expect(lines.slice(at)).toEqual(expect.arrayContaining(['On click', 'Tab A (this)', 'Group: Panel A', '· hidden at start', 'Html 1', 'Hover style', 'On hover', 'Hidden until a click or hover shows it']))
    // The action, then Tab A: hide, the group: show, the chart: no change, then the hover style, and no hover action
    expect(chosen.slice(-6)).toEqual(['Show, hide or change elements', 'Hide', 'Show', '—', 'Lift', 'Nothing'])
  })

  it('lists what a hover shows or hides, leaving out the element itself', () => {
    const spot = text('Spot', { groupId: 'm', hoverAction: { type: 'visibility', show: ['Panel A', 'Panel A text'], hide: ['chart'] } })
    const hoverSlide = { ...slide, elements: [...slide.elements, spot, text('Spot label', { groupId: 'm' })] }
    const { lines, chosen, html } = animate(hoverSlide, spot)
    // No click action, then the hover: the tab no change, the group: show, the chart: hide
    expect(chosen.slice(-5)).toEqual(['Nothing', 'Show, hide or change elements', '—', 'Show', 'Hide'])
    expect(html).toContain('aria-label="Group: Panel A: on hover"')
    expect(html).not.toContain('Group: Spot') // its own group can't be shown or hidden by its hover
    expect(lines).not.toContain('Hover style') // only for clickable elements
    expect(lines).toContain('Applies to the whole group.')
  })

  it('lets an embed be hidden at start, without a click action of its own', () => {
    const { lines, html } = animate(slide, slide.elements[3])
    expect(lines).toContain('This element takes its own clicks and hovers, but a click or hover on something else can still show or hide it.')
    expect(lines).toContain('Hidden until a click or hover shows it')
    expect(html).not.toContain('aria-label="On click"')
    expect(html).not.toContain('aria-label="On hover"')
  })

  it('warns when nothing shows an element hidden at start', () => {
    const lonely = { id: 's', elements: [text('x', { startHidden: true })] }
    expect(animate(lonely, lonely.elements[0]).lines).toContain('Nothing on this slide shows it yet.')
    expect(animate(slide, slide.elements[1]).lines).not.toContain('Nothing on this slide shows it yet.')
    const hovered = { id: 's', elements: [text('x', { startHidden: true }), text('y', { hoverAction: { type: 'visibility', show: ['x'] } })] }
    expect(animate(hovered, hovered.elements[0]).lines).not.toContain('Nothing on this slide shows it yet.')
  })
})

describe('States in the Properties panel', () => {
  const card = text('Card', { states: [{ id: 'st_a', name: 'Flipped', flipX: true, duration: 300, easing: 'spring' }, { id: 'st_b', name: 'Big' }], initialState: 'st_b' })
  const button = text('Button', { clickAction: { type: 'visibility', show: [], hide: [], toggle: [], set: [{ id: 'Card', state: 'st_a', mode: 'toggle' }, { id: 'Gone', state: 'x' }] } })
  const slide = { id: 's1', elements: [card, button] }

  it('lists the states, what it starts as, and offers zooming for an element without any', () => {
    const { lines, chosen, html } = animate(slide, card)
    expect(html).toContain('aria-label="States"')
    expect(lines).toEqual(expect.arrayContaining(['Default', 'Flipped', 'Big', '+ State', 'Starts as']))
    expect(html).toContain('be seen while turned over (for flip cards)')
    expect(chosen).toContain('Big') // starts as
    expect(lines).not.toContain('Zoom in when clicked')
    expect(animate({ id: 's', elements: [text('x')] }, text('x')).lines).toContain('Zoom in when clicked')
  })

  it('shows the state being recorded, and hides the layer buttons', () => {
    const { lines, chosen, html } = animate(slide, card, { recordingState: 'st_a' })
    expect(html).toContain('aria-pressed="true" style="padding:2px 8px;border-radius:10px;border:1px solid var(--border);font-size:11px;cursor:pointer;background:#d946ef')
    expect(html).toContain('value="Flipped"')
    expect(html).toContain('value="300"')
    expect(chosen).toContain('Spring')
    expect(lines).toEqual(expect.arrayContaining(['Clear changes', 'Delete state', 'In front of everything']))
    // The layer buttons, on the Format tab, are hidden while recording
    expect(panel(slide, card, { recordingState: 'st_a' }).lines).not.toContain('↑ Forward')
    expect(panel(slide, card).lines).toContain('↑ Forward')
  })

  it('lets a click put elements in their states', () => {
    const { chosen, html } = animate(slide, button)
    expect(html).toContain('aria-label="Card: state on click"')
    expect(chosen).toContain('Toggle Flipped')
    expect(html).toContain('<option value="cycle:">Next state</option>')
  })
})

describe('Steps in the Properties panel', () => {
  it('lists the steps that change its state, and adds one after the slide’s last', () => {
    const el = text('Dot', { states: [{ id: 'st_a', name: 'Moved' }], stateSteps: { 3: 'st_a', 5: null } })
    const slide = { id: 's1', elements: [el, text('Frag', { fragment: true, fragmentIndex: 6 })] }
    const { html, chosen, lines } = animate(slide, el)
    expect(html).toMatch(/aria-label="Step 3"[^>]*value="3"/)
    expect(html).toMatch(/aria-label="Step 5"[^>]*value="5"/)
    expect(chosen).toEqual(expect.arrayContaining(['Moved', 'Default']))
    expect(lines).toContain('+ Step')
    expect(html).toContain('step 1 is the first press of → or a clicker. Going back undoes them.')
  })
})

describe('A molecule’s citation in the Properties panel', () => {
  const pubchem = { key: 'pubchem-cid-2519', type: 'misc', author: '{National Center for Biotechnology Information}', title: 'PubChem Compound Summary for CID 2519, Caffeine', year: '2026' }
  const molecule = (extra = {}) => ({ id: 'mol', type: 'molecule', x: 0, y: 0, width: 300, height: 260, zIndex: 1, src: '/uploads/p/caffeine.sdf', format: 'sdf', name: 'Caffeine', source: { db: 'pubchem', id: '2519' }, ...extra })
  const show = (el, props = {}) => panel({ id: 's1', elements: [el] }, el, { onCiteElement: () => {}, ...props })

  it('offers to cite PubChem, above fields like an image’s', () => {
    const { lines } = show(molecule())
    const at = lines.indexOf('Citation')
    expect(lines.slice(at, at + 4)).toEqual(['Citation', 'Cite PubChem', 'Text', 'Link (optional)'])
  })

  it('doesn’t offer it for a molecule from elsewhere', () => {
    const { lines } = show(molecule({ source: { db: 'pdb', id: '1UBQ' } }))
    expect(lines).toContain('Citation')
    expect(lines).not.toContain('Cite PubChem')
  })

  it('says which entry its caption cites', () => {
    const el = molecule({ citationText: 'PubChem CID 2519', citationKey: 'pubchem-cid-2519' })
    const { lines, html } = show(el, { presentation: { id: 'p', slides: [], bibliography: [pubchem] } })
    expect(lines).toContain('Cites PubChem Compound Summary for CID 2519, Caffeine')
    expect(html).toContain('aria-label="Stop citing it"')
    expect(show(el).lines.some(l => l.startsWith('Cites'))).toBe(false)
  })
})

describe('An HTML embed’s steps', () => {
  const embed = { id: 'emb', type: 'html', x: 0, y: 0, width: 100, height: 100, zIndex: 1, content: '<p>x</p>' }

  it('takes how many of the slide’s clicks it hears, and where the first comes once it has any', () => {
    const { html } = panel({ id: 's1', elements: [embed] }, embed)
    expect(html).toMatch(/aria-label="Steps"[^>]* value="0"/)
    expect(html).not.toContain('First step at slide step')
    const stepped = { ...embed, steps: 3, stepStart: 2 }
    const after = panel({ id: 's1', elements: [stepped] }, stepped).html
    expect(after).toMatch(/aria-label="Steps"[^>]* value="3"/)
    expect(after).toMatch(/aria-label="First step at slide step"[^>]* value="2"/)
  })
})

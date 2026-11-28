// @vitest-environment happy-dom
// @vitest-environment-options {"settings": {"disableIframePageLoading": true}}
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

const guest = { enabled: true }
const server = { list: null }
vi.mock('../utils/api', () => ({ api: { getGuestConfig: vi.fn(async () => guest), getLandingExamples: vi.fn(async () => server.list) } }))
vi.mock('../components/DocsPage', () => ({ default: () => <div className="docs-stub">Docs</div> }))
vi.mock('../utils/analytics', () => ({ startAnalytics: vi.fn(), track: vi.fn() }))
import { startAnalytics, track } from '../utils/analytics'
import LandingPage from './LandingPage'
import { EXAMPLES } from '../examples/catalog'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, el
afterEach(() => { act(() => root.unmount()); el.remove(); window.location.hash = '' })

async function mount(props = {}) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<LandingPage onSignIn={() => {}} {...props} />))
  return el
}
const cards = () => [...el.querySelectorAll('.lp-card h3')].map(h => h.textContent)
const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.startsWith(text))

describe('the landing page', () => {
  it('opens with a live deck and a way in without an account', async () => {
    await mount()
    expect(el.querySelector('.lp-hero iframe').getAttribute('src')).toBe('/examples/hero/deck')
    expect(el.querySelector('.lp-ctas a').getAttribute('href')).toBe('/try')
    expect(el.querySelector('.lp-fine').textContent).toContain('Jess Birky')
    expect(el.querySelector('.lp-support a').getAttribute('href')).toBe('mailto:support@parallax-presentations.com')
  })

  it('moves the title’s last words’ red and blue copies with the pointer', async () => {
    await mount()
    const words = el.querySelector('.lp-hero h1 .lp-parallax')
    expect(words.textContent).toBe('complex concepts.')
    expect(el.querySelector('.lp-hero h1').textContent).toBe('Create interactive and intuitive slides\u00a0forcomplex concepts.')
    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 400, clientY: 300, pointerType: 'mouse' }))
      await new Promise(r => setTimeout(r, 100))
    })
    expect(Number(words.style.getPropertyValue('--px'))).toBeGreaterThan(0)
    expect(Number(words.style.getPropertyValue('--py'))).toBeGreaterThan(0)
    // The section and closing titles' fringed words move too
    const moving = [...el.querySelectorAll('.lp-parallax')]
    expect(moving.map(w => w.textContent)).toEqual(['complex concepts.', 'your research', 'LaTeX, BibTeX and git', 'an AI agent', 'your computer', 'Make your next talk in Parallax'])
    for (const w of moving) expect(w.style.getPropertyValue('--px')).not.toBe('')
    // And the closing mark's red and blue P's (the clip path's red P too), the red twice as far
    const eyes = [...el.querySelectorAll('.lp-cta-mark [data-eye]')]
    expect(eyes.map(p => p.dataset.eye)).toEqual(['red', 'red', 'blue', 'blue'])
    const shift = p => p.getAttribute('transform').match(/translate\((\S+) (\S+)\)/).slice(1).map(Number)
    const [[rx, ry], [bx, by]] = [shift(eyes[0]), shift(eyes[2])]
    expect(rx).toBeLessThan(-6)
    expect(ry).toBeLessThan(0)
    expect(bx).toBeLessThan(6)
    expect(-6 - rx).toBeCloseTo(2 * (6 - bx), 1)
    expect(shift(eyes[1])).toEqual([rx, ry])
    // The nav and footer marks hold still
    expect(el.querySelector('.lp-nav [data-eye="red"]').getAttribute('transform')).toBe('translate(-6 0)')
  })

  it('shows the examples by field', async () => {
    await mount()
    expect([...el.querySelectorAll('a.lp-card')].map(a => a.getAttribute('href'))).toEqual(EXAMPLES.map(e => `/examples/${e.slug}`))
    expect(cards()).toEqual(EXAMPLES.map(e => e.title))
    await act(async () => button('Physics').click())
    expect(cards()).toEqual(EXAMPLES.filter(e => e.field === 'Physics').map(e => e.title))
    expect(button('Physics').getAttribute('aria-pressed')).toBe('true')
    await act(async () => button('All').click())
    expect(cards()).toHaveLength(EXAMPLES.length)
  })

  // The site's own pages link to the home tab's sections (services/site-pages.js)
  it('scrolls to a section an address names', async () => {
    const seen = []
    const was = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function () { seen.push(this.id) }
    try {
      window.location.hash = '#workflow'
      await mount()
      expect(seen).toEqual(['workflow'])
    } finally { Element.prototype.scrollIntoView = was }
  })

  it('opens an example live, steps to the next, and into the editor with it', async () => {
    await mount()
    await act(async () => el.querySelectorAll('.lp-card')[1].click())
    const viewer = el.querySelector('.lp-viewer')
    expect(viewer.querySelector('iframe').getAttribute('src')).toBe(`/examples/${EXAMPLES[1].slug}/deck`)
    expect([...viewer.querySelectorAll('a')].some(a => a.getAttribute('href') === `/examples/${EXAMPLES[1].slug}`)).toBe(true)
    expect(viewer.querySelector('a.lp-btn').getAttribute('href')).toBe(`/try?example=${EXAMPLES[1].slug}`)
    await act(async () => viewer.querySelector('[aria-label="Next example"]').click())
    expect(viewer.querySelector('h3').textContent).toBe(EXAMPLES[2].title)
    await act(async () => viewer.querySelector('[aria-label="Previous example"]').click())
    await act(async () => viewer.querySelector('[aria-label="Previous example"]').click())
    await act(async () => viewer.querySelector('[aria-label="Previous example"]').click())
    expect(viewer.querySelector('h3').textContent).toBe(EXAMPLES[EXAMPLES.length - 1].title)
    await act(async () => viewer.querySelector('[aria-label="Close"]').click())
    expect(viewer.querySelector('iframe')).toBeNull()
  })

  it('asks for a sign-in instead, where there’s no guest mode', async () => {
    guest.enabled = false
    try {
      const onSignIn = vi.fn()
      await mount({ onSignIn })
      await act(async () => button('Get started free').click())
      await act(async () => el.querySelector('.lp-card').click())
      await act(async () => button('Sign in to make your own').click())
      expect(onSignIn).toHaveBeenCalledTimes(2)
    } finally { guest.enabled = true }
  })

  it('shows the examples as the server lists them, with a placeholder for one without a thumbnail', async () => {
    server.list = {
      hero: 'my-talk',
      examples: [
        { slug: 'my-talk', field: 'Biology', title: 'Cell division', desc: 'Mitosis, step by step', tags: ['Diagram'], thumbnail: null, background: { type: 'color', color: '#123456' } },
        { slug: 'venn', field: 'Mathematics', title: 'Venn diagrams', desc: 'De Morgan', tags: [], thumbnail: '/examples/thumbs/venn.jpg' },
      ],
    }
    try {
      await mount()
      expect(el.querySelector('.lp-hero iframe').getAttribute('src')).toBe('/examples/my-talk/deck')
      expect(cards()).toEqual(['Cell division', 'Venn diagrams'])
      expect([...el.querySelectorAll('.lp-filters button')].map(b => b.firstChild.textContent)).toEqual(['All', 'Mathematics', 'Biology'])
      const thumb = el.querySelector('.lp-card .lp-thumb')
      expect(thumb.querySelector('img')).toBeNull()
      expect(thumb.querySelector('.lp-thumb-title').textContent).toBe('Cell division')
      expect(thumb.getAttribute('style')).toContain('#123456')
    } finally { server.list = null }
  })

  it('switches between light and dark from the nav', async () => {
    const onToggleTheme = vi.fn()
    await mount({ theme: 'dark', onToggleTheme })
    const toggle = el.querySelector('.lp-theme')
    expect(toggle.getAttribute('aria-label')).toBe('Switch to light theme')
    await act(async () => toggle.click())
    expect(onToggleTheme).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('theme', { to: 'light' })
    act(() => root.unmount())
    await mount({ theme: 'light', onToggleTheme })
    expect(el.querySelector('.lp-theme').getAttribute('aria-label')).toBe('Switch to dark theme')
  })

  it('has no theme toggle when nothing can change the theme', async () => {
    await mount()
    expect(el.querySelector('.lp-theme')).toBeNull()
  })

  it('has no Templates tab until there are templates', async () => {
    await mount()
    expect(button('Templates')).toBeUndefined()
  })

  it('lists the templates on their own tab, each opening its own page', async () => {
    const template = (slug, title, field) => ({ slug, title, field, desc: `${title}, ready to fill in`, tags: ['Outline'], thumbnail: null, background: { type: 'color', color: '#202040' } })
    server.list = { hero: 'hero', examples: [], templates: [{ ...template('journal-club', 'Journal club', 'Talks'), theme: 'Preprint' }, template('lecture', 'Lecture', 'Teaching')] }
    try {
      await mount()
      await act(async () => button('Templates').click())
      expect(window.location.hash).toBe('#templates')
      expect(el.querySelector('#lp-templates').textContent).toBe('Templates')
      expect(el.querySelector('.lp-hero')).toBeNull()
      expect(cards()).toEqual(['Journal club', 'Lecture'])
      await act(async () => button('Teaching').click())
      expect(cards()).toEqual(['Lecture'])
      await act(async () => button('All').click())

      // Each card is a link to the template's own page, which Use this template is on,
      // its picture labeled with its theme
      const links = [...el.querySelectorAll('a.lp-card')]
      expect(links.map(a => a.querySelector('.lp-thumb span').textContent)).toEqual(['Preprint', 'Preview'])
      expect(links[0].getAttribute('aria-label')).toBe('Journal club, Talks, in the Preprint theme: open the template')
      expect(links.map(a => a.getAttribute('href'))).toEqual(['/templates/journal-club', '/templates/lecture'])
      links[1].addEventListener('click', e => e.preventDefault())
      await act(async () => links[1].click())
      expect(track).toHaveBeenCalledWith('open-template', { template: 'lecture', from: 'card' })
      expect(el.querySelectorAll('.lp-viewer')).toHaveLength(1)
    } finally { server.list = null }
  })

  it('opens the Templates tab from its link, and says when there are none yet', async () => {
    window.location.hash = '#templates'
    await mount()
    expect(el.querySelector('#lp-templates')).not.toBeNull()
    expect(el.querySelector('.lp-empty').textContent).toMatch(/No templates yet/)
  })

  it('counts what visitors open and click', async () => {
    track.mockClear()
    await mount()
    expect(startAnalytics).toHaveBeenCalled()
    await act(async () => el.querySelector('.lp-ctas a').click())
    expect(track).toHaveBeenLastCalledWith('try', { from: 'hero' })
    await act(async () => button('Chemistry').click())
    expect(track).toHaveBeenLastCalledWith('filter', { field: 'Chemistry' })
    await act(async () => el.querySelector('.lp-card').click())
    expect(track).toHaveBeenLastCalledWith('open-example', { example: 'chemistry', from: 'card' })
    await act(async () => el.querySelector('.lp-viewer a.lp-btn').click())
    expect(track).toHaveBeenLastCalledWith('example-to-editor', { example: 'chemistry' })
    await act(async () => el.querySelector('[aria-label="Next example"]').click())
    expect(track).toHaveBeenLastCalledWith('open-example', { example: 'chemistry', from: 'viewer' })
  })

  it('opens the docs in place, and comes back to a section', async () => {
    await mount()
    await act(async () => [...el.querySelectorAll('.lp-links button')].find(b => b.textContent === 'Docs').click())
    expect(el.querySelector('.docs-stub')).not.toBeNull()
    expect(window.location.hash).toBe('#docs')
    await act(async () => [...el.querySelectorAll('.lp-links button')].find(b => b.textContent === 'Examples').click())
    expect(el.querySelector('.docs-stub')).toBeNull()
    expect(el.querySelector('#examples')).not.toBeNull()
  })
})

describe('what sets Parallax apart', () => {
  const tabs = () => [...el.querySelectorAll('.lp-show-tabs [role="tab"]')]
  const selected = () => tabs().find(t => t.getAttribute('aria-selected') === 'true')?.textContent
  const showcaseDecks = () => [...el.querySelectorAll('.lp-feature iframe')].map(f => f.getAttribute('src'))

  it('opens a feature, with only its own deck', async () => {
    track.mockClear()
    await mount()
    // The hero has no feature chips; the showcase's tabs open each one
    expect(el.querySelector('.lp-hero .lp-chips')).toBeNull()
    expect(selected()).toMatch(/^Live data/)
    expect(showcaseDecks()).toEqual(['/examples/exoplanets/deck'])
    await act(async () => tabs().find(t => t.textContent.startsWith('BibTeX citations')).click())
    expect(track).toHaveBeenLastCalledWith('feature', { feature: 'cite' })
    expect(selected()).toMatch(/^BibTeX citations/)
    expect(showcaseDecks()).toEqual(['/examples/showcase-cite/deck'])
    expect(el.querySelector('.lp-feature').textContent).toContain('@article{rubin1970')
    // A guest can open it in the editor
    expect([...el.querySelectorAll('.lp-panel-links a')].map(a => a.getAttribute('href'))).toContain('/try?example=showcase-cite')
  })

  it('moves between features with the arrow keys', async () => {
    await mount()
    await act(async () => tabs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
    expect(selected()).toMatch(/^BibTeX citations/)
    await act(async () => tabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })))
    expect(selected()).toMatch(/^AI collaborators/)
    // The JSXGraph plot an AI made, live
    expect(showcaseDecks()).toEqual(['/examples/showcase-ai/deck'])
    expect(el.querySelector('.lp-chat').textContent).toContain('JSXGraph')
    await act(async () => tabs().at(-1).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
    expect(selected()).toMatch(/^Live data/)
  })

  it('shows a matplotlib figure brought in a layer at a time', async () => {
    await mount()
    await act(async () => tabs().find(t => t.textContent.startsWith('matplotlib figures')).click())
    expect(showcaseDecks()).toEqual(['/examples/showcase-figure/deck'])
    expect(el.querySelector('.lp-feature').textContent).toContain('Edit figure layers…')
    expect(el.querySelector('.lp-feature').textContent).toContain("fig.savefig('decay.svg')")
  })

  it('never promises a DOI, while publishing to Zenodo is turned off', async () => {
    await mount()
    for (const tab of tabs()) {
      await act(async () => tab.click())
      expect(el.querySelector('.lp-feature').textContent).not.toMatch(/DOI|Zenodo/)
    }
    expect(el.querySelector('#workflow').textContent).not.toMatch(/DOI|Zenodo/)
  })

  it('shows the plans and what they cost, marking what isn’t built yet', async () => {
    const onSignIn = vi.fn()
    await mount({ onSignIn })
    const plans = [...el.querySelectorAll('.lp-plan')]
    expect(plans.map(p => p.querySelector('h3').textContent)).toEqual(['Free', 'Pro', 'Team', 'Institution'])
    expect(plans.map(p => p.querySelector('.lp-price').textContent)).toEqual(['$0', '$10', '$12', 'Custom'])
    expect(plans[1].classList.contains('lead')).toBe(true)
    const soon = plans.map(p => [...p.querySelectorAll('li')].filter(li => li.querySelector('.lp-soon')).map(li => li.textContent.replace('Coming soon', '').trim()))
    expect(soon).toEqual([[], [], [], ['Single sign-on, domain capture', 'Audit log']])
    const items = plans.map(p => [...p.querySelectorAll('li')].map(li => li.textContent.replace('Coming soon', '').trim()))
    expect(items[0]).toContain('1 collaborator per deck')
    expect(items[1]).toContain('Unlimited collaborators')
    expect(items[2]).toEqual(expect.arrayContaining(['Unlimited presentations', 'Unlimited collaborators']))
    expect(items.flat().join(' ')).not.toMatch(/badge|password links|view counts/)
    // Pro and Team can't be bought yet: their buttons say so and do nothing
    const ctas = plans.map(p => p.querySelector('.lp-plan-row .lp-btn'))
    expect(ctas.map(b => b.textContent)).toEqual(['Start free', 'Coming soon', 'Coming soon', 'Talk to us'])
    expect(ctas.map(b => b.disabled === true)).toEqual([false, true, true, false])
    await act(async () => { ctas[1].click(); ctas[2].click() })
    expect(onSignIn).not.toHaveBeenCalled()
    await act(async () => ctas[0].click())
    expect(onSignIn).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('sign-in', { from: 'plan-free' })
    expect(plans[3].querySelector('a.lp-btn').getAttribute('href')).toMatch(/^mailto:support@parallax-presentations\.com\?subject=/)
    expect(el.querySelector('.lp-selfhost a').getAttribute('href')).toBe('#docs/guide/installation')
  })

  it('shows the ways to connect an AI agent, and leads to the tutorial', async () => {
    await mount()
    const ways = [...el.querySelectorAll('#ai .lp-agent')]
    expect(ways.map(w => w.querySelector('h3').textContent)).toEqual(['The Parallax plugin', 'Your account’s MCP server', 'One presentation, in a chat'])
    expect(ways[0].classList.contains('lead')).toBe(true)
    expect(ways[0].querySelector('pre').textContent).toContain('/plugin install parallax@parallax-agent')
    // The server's address is this site's, as the hosted site and dev differ
    expect(ways[1].querySelector('pre').textContent).toBe(`${window.location.origin}/mcp`)
    expect(ways.map(w => w.querySelector('a').getAttribute('href'))).toEqual(['https://github.com/jbirky/parallax-agent', '#docs/tutorials/ai-access', '#docs/tutorials/ai-collaborators'])
    expect(ways[0].querySelector('a').getAttribute('target')).toBe('_blank')
    expect(el.querySelector('.lp-agents-more a').getAttribute('href')).toBe('#docs/tutorials/ai-agents')
    // The nav and the footer lead to it
    await act(async () => [...el.querySelectorAll('.lp-links button')].find(b => b.textContent === 'AI agents').click())
    expect(track).toHaveBeenCalledWith('ai-agents', { from: 'nav' })
    expect([...el.querySelectorAll('.lp-footer button')].map(b => b.textContent)).toContain('AI agents')
  })

  it('compares Parallax with the tools people use', async () => {
    await mount()
    const heads = [...el.querySelectorAll('.lp-compare thead th')].map(th => th.textContent)
    expect(heads.slice(1)).toEqual(['PowerPoint, Google Slides', 'LaTeX Beamer', 'reveal.js', 'Parallax'])
    const bib = [...el.querySelectorAll('.lp-compare tbody tr')].find(tr => tr.textContent.startsWith('Citations from BibTeX'))
    expect([...bib.querySelectorAll('td')].map(td => td.className)).toEqual(['n', 'y', 'n', 'y us'])
  })
})

describe('Practice Talk to try', () => {
  // It's the Rehearse step's demo, under the steps of a talk
  const mountRehearse = async () => { await mount(); await act(async () => el.querySelector('#lp-step-rehearse').click()) }
  const hud = () => el.querySelector('.lp-pr-hud')?.textContent
  const click = text => act(async () => [...el.querySelectorAll('.lp-practice button')].find(b => b.textContent.includes(text)).click())
  const advance = ms => act(async () => { vi.advanceTimersByTime(ms) })
  afterEach(() => vi.useRealTimers())

  it('times each slide against its plan, and plans the next run from this one', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] })
    await mountRehearse()
    await click('Start practicing')
    expect(hud()).toContain('Slide 1')
    expect(hud()).toContain('of 0:30')
    // 20 seconds of talk a second
    await advance(1000)
    expect(hud()).toMatch(/Slide 10:20of 0:30/)
    // The sample run spends 28 seconds on the title, then moves on
    await advance(500)
    expect(hud()).toContain('Slide 2')
    expect(hud()).toContain('On pace')
    // 2:00 planned for slide 2; spend 2:20 on it (the sample run would stay 2:30), then go on
    await advance(7000)
    await click('Next slide')
    expect(hud()).toContain('Slide 3')
    expect(el.querySelector('.lp-pr-pace').textContent).toMatch(/^0:\d\d behind plan$/)
    await click('Finish')
    const rows = [...el.querySelectorAll('.lp-pr-table tbody tr')].map(tr => [...tr.querySelectorAll('td')].slice(0, 5).map(td => td.textContent))
    expect(rows.map(r => r[1])).toEqual(['Why galaxies spin too fast', 'Missing mass, twice', 'How much is missing', 'What a halo predicts', 'What’s next'])
    expect(rows[3][3]).toBe('skipped')
    expect(rows[1][4]).toMatch(/^\+0:\d\d$/)
    expect(el.querySelector('.lp-pr-sum .over, .lp-pr-sum .under')).not.toBeNull()
    // The outline shows each slide's time, red where it ran over
    const outline = () => [...el.querySelectorAll('.lp-pr-outline li')].map(li => [li.querySelector('.m').textContent, li.querySelector('.pt').textContent, li.querySelector('.pt').className])
    expect(outline()[1][2]).toContain('over')
    expect(outline()[4][1]).toBe('')
    await click('Plan from this run')
    // To the half minute; the skipped slides keep their plan
    expect(outline().map(r => r[0])).toEqual(['0.5 min', '2.5 min', expect.stringMatching(/min$/), '2.5 min', '1 min'])
  })

  it('pauses', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] })
    await mountRehearse()
    await click('Start practicing')
    await advance(500)
    await click('Pause')
    const at = hud()
    await advance(3000)
    expect(hud()).toBe(at.replace('Pause', 'Resume'))
  })
})

describe('the steps of a talk', () => {
  const tabs = () => [...el.querySelectorAll('.lp-steps [role="tab"]')]

  it('shows a demo for the step picked, and #practice opens Rehearse', async () => {
    await mount()
    expect(el.querySelector('#workflow').textContent).not.toContain('Parallax follows a talk the whole way')
    expect(tabs().map(t => t.querySelector('b').textContent)).toEqual(['Plan', 'Build', 'Rehearse', 'Present', 'Share'])
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true')
    expect(el.querySelector('#lp-step-panel h3').textContent).toBe('Plan the talk before you build it')
    for (const [i, title] of [[1, 'A visual editor that speaks LaTeX'], [3, 'Present with your notes, a pen, and a link for the room'], [4, 'Share it as a link, a file, or a site'], [2, 'Time every slide against your plan']]) {
      await act(async () => tabs()[i].click())
      expect(el.querySelector('#lp-step-panel h3').textContent).toBe(title)
      expect(tabs()[i].getAttribute('aria-selected')).toBe('true')
    }
    expect(track).toHaveBeenCalledWith('workflow-step', { step: 'share' })
    // Arrow keys move between the steps
    await act(async () => tabs()[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(tabs()[3].getAttribute('aria-selected')).toBe('true')
  })

  it('opens on Practice Talk when the address names it', async () => {
    window.location.hash = '#practice'
    await mount()
    expect(el.querySelector('#lp-step-rehearse').getAttribute('aria-selected')).toBe('true')
    expect(el.querySelector('#practice')).not.toBeNull()
  })
})

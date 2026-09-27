// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { DECK_SANDBOX, deckWindowHTML, presentInWindow, livePresentInWindow, previewSlideInWindow, exportPDF, relayLiveSlides } from './generateHTML'
import { backupKey } from './annotations'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const deck = {
  id: 'p1', title: 'Talk', slideWidth: 960, slideHeight: 540,
  slides: [
    { id: 's1', elements: [
      { id: 'e1', type: 'html', x: 0, y: 0, width: 100, height: 100, content: '<script>top.opener.document</script>' },
      { id: 'e2', type: 'text', x: 0, y: 200, width: 300, height: 60, content: '<p>DECK TEXT</p>' },
    ] },
    { id: 's2', elements: [] },
  ],
}

// The page a window opened from the editor gets, and the deck in its frame
function opened(open) {
  let blob = null
  vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  window.open = vi.fn(() => ({}))
  vi.useFakeTimers()
  open()
  return blob.text().then(page => ({ page, deck: JSON.parse(page.match(/frame\.srcdoc = (".*");/)[1]) }))
}
const sandboxOf = page => new DOMParser().parseFromString(page, 'text/html').getElementById('deck').getAttribute('sandbox').split(' ')

describe('windows opened from the editor', () => {
  it('run the deck in the sandbox share links have, never with this site’s origin', () => {
    const server = readFileSync(resolve(process.cwd(), '../server/index.js'), 'utf8')
    expect(server).toContain(`const DECK_PAGE_SANDBOX = 'sandbox ${DECK_SANDBOX}'`)
    const sandbox = sandboxOf(deckWindowHTML('<p>deck</p>'))
    expect(sandbox).toContain('allow-scripts')
    expect(sandbox).not.toContain('allow-same-origin')
    expect(sandbox).not.toContain('allow-top-navigation')
  })

  it('keep the deck and its title from breaking out of the page', () => {
    const page = deckWindowHTML('</script><script>alert(1)</script>', { title: '</title><script>alert(2)</script>' })
    expect(page).not.toContain('<script>alert(1)')
    expect(page).not.toContain('<script>alert(2)')
    expect(JSON.parse(page.match(/frame\.srcdoc = (".*");/)[1])).toBe('<base href="about:srcdoc"></script><script>alert(1)</script>')
  })

  it('keep slide links in the deck', () => {
    const page = deckWindowHTML('<!doctype html><html><head><title>t</title></head><body><a href="#/s-s2">two</a></body></html>')
    expect(JSON.parse(page.match(/frame\.srcdoc = (".*");/)[1])).toContain('<head><base href="about:srcdoc"><title>')
  })

  it('Present, the slide preview and the PDF each frame their deck', async () => {
    for (const open of [() => presentInWindow(deck), () => previewSlideInWindow(deck, 0), () => exportPDF(deck)]) {
      const { page, deck: framed } = await opened(open)
      expect(sandboxOf(page)).not.toContain('allow-same-origin')
      expect(framed).toContain('DECK TEXT') // the deck's content, inside the frame
      expect(page.replace(/frame\.srcdoc = ".*"/, '')).not.toContain('DECK TEXT')
      vi.restoreAllMocks()
    }
  })

  it('run their own script, which fills the frame with the deck', async () => {
    const set = { id: 'set9', name: 'S', slides: {}, boards: [] }
    for (const open of [() => presentInWindow(deck, { annotationSet: set }), () => livePresentInWindow(deck, 'abc234'), () => exportPDF(deck)]) {
      const { page, deck: framed } = await opened(open)
      vi.useRealTimers()
      const doc = new DOMParser().parseFromString(page, 'text/html')
      document.body.innerHTML = doc.body.innerHTML
      for (const script of doc.querySelectorAll('script')) new Function(script.textContent)()
      expect(document.getElementById('deck').getAttribute('srcdoc')).toBe(framed)
      vi.restoreAllMocks()
    }
  })

  it('Present with drawing on saves through the page around the deck, into the set it was opened with', async () => {
    const set = { id: 'set9', name: 'S', slides: {}, boards: [] }
    const { page, deck: framed } = await opened(() => presentInWindow(deck, { annotationSet: set }))
    expect(framed).toContain('pp-shield')
    expect(framed).not.toContain(backupKey('p1', 'set9'))
    expect(page).toContain(`"backupKey":"${backupKey('p1', 'set9')}"`)
    expect(page).toContain('"setId":"set9"')
    expect(page).toContain('"presentationId":"p1"')
  })

  it('live presenting reports the deck’s slides from the page around it', async () => {
    const { page, deck: framed } = await opened(() => livePresentInWindow(deck, 'abc234'))
    expect(framed).toContain("type: 'parallax-deck'")
    expect(framed).not.toContain('/api/live/')
    expect(page).toContain('"sessionId":"abc234"')
  })
})

describe('the page around a live-presented deck', () => {
  function live() {
    document.body.innerHTML = ''
    const deckWin = { postMessage: vi.fn() }
    const fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ viewers: 3 }) }))
    vi.stubGlobal('fetch', fetch)
    const count = vi.fn()
    Object.defineProperty(window, 'opener', { value: { __liveViewerCount: count }, configurable: true })
    relayLiveSlides({ sessionId: 'abc234' }, { contentWindow: deckWin })
    const send = (data, source = deckWin) => window.dispatchEvent(new MessageEvent('message', { data, source }))
    return { fetch, count, send }
  }

  it('tells the server each slide the deck shows, and shows who’s watching', async () => {
    const { fetch, count, send } = live()
    send({ type: 'parallax-deck', slide: 1, total: 2 })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`${window.location.origin}/api/live/abc234/slide`)
    expect(JSON.parse(init.body)).toEqual({ flatIndex: 1 })
    await vi.waitFor(() => expect(count).toHaveBeenCalledWith(3))
    expect(document.body.textContent).toContain('3 viewers')
    vi.unstubAllGlobals()
  })

  it('hears only its own deck, and only slide numbers', () => {
    const { fetch, send } = live()
    send({ type: 'parallax-deck', slide: 1 }, { postMessage() {} })
    send({ type: 'parallax-deck', slide: -1 })
    send({ type: 'parallax-deck', slide: '1' })
    send({ type: 'other', slide: 1 })
    expect(fetch).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

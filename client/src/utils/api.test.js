import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// The saves the API client sends, and a way to answer each one
const sent = []
let answer = () => ({ status: 200, body: {} })
const fetchMock = vi.fn(async (url, options = {}) => {
  const body = options.body ? JSON.parse(options.body) : undefined
  sent.push({ url, method: options.method || 'GET', body })
  const { status, body: reply } = await answer(url, options.method || 'GET', body)
  return new Response(JSON.stringify(reply), { status })
})

let api
beforeAll(async () => {
  vi.stubGlobal('fetch', fetchMock)
  ;({ api } = await import('./api'))
})
beforeEach(() => { sent.length = 0 })

// A server that keeps one presentation's version, as the real one does
function server(start) {
  let version = start
  return (url, method, body) => {
    if (method === 'GET') return { status: 200, body: { id: 'p1', title: 'Talk', version } }
    if (Number.isInteger(body.version) && body.version !== version) return { status: 409, body: { error: 'conflict', message: 'Someone else saved', version } }
    version++
    return { status: 200, body: { ...body, version } }
  }
}

describe('saving a presentation', () => {
  it('sends the version it loaded, then the one each save made', async () => {
    answer = server(4)
    await api.getPresentation('p1')
    await api.updatePresentation('p1', { id: 'p1', title: 'A', version: 1 })
    await api.updatePresentation('p1', { id: 'p1', title: 'B' })
    expect(sent.filter(r => r.method === 'PUT').map(r => r.body.version)).toEqual([4, 5])
  })

  it('reports a save someone else saved over as a conflict, and can save over it', async () => {
    const real = server(10)
    answer = real
    await api.getPresentation('p1')
    // someone else saves
    real('', 'PUT', { title: 'Theirs' })
    const refused = await api.updatePresentation('p1', { title: 'Mine' }).catch(e => e)
    expect(refused.code).toBe('conflict')
    expect(refused.version).toBe(11)
    api.saveOverVersion('p1', refused.version)
    expect((await api.updatePresentation('p1', { title: 'Mine' })).version).toBe(12)
  })

  it('sends a save asked for during another once that one is done, from its version', async () => {
    const real = server(20)
    await (answer = real, api.getPresentation('p1'))
    let release
    const held = new Promise(resolve => { release = resolve })
    answer = async (url, method, body) => {
      if (body.title === 'first') await held
      return real(url, method, body)
    }
    const first = api.updatePresentation('p1', { title: 'first' })
    const second = api.updatePresentation('p1', { title: 'second' })
    await new Promise(resolve => setTimeout(resolve, 20))
    // the first is on its way; the second waits
    expect(sent.filter(r => r.method === 'PUT').map(r => r.body.title)).toEqual(['first'])
    release()
    expect((await first).version).toBe(21)
    expect((await second).version).toBe(22)
    expect(sent.filter(r => r.method === 'PUT').map(r => r.body.version)).toEqual([20, 21])
  })

  it('sends no version for a presentation that has none (self-hosted)', async () => {
    answer = () => ({ status: 200, body: { id: 'local', title: 'Talk' } })
    await api.getPresentation('local')
    await api.updatePresentation('local', { id: 'local', title: 'Talk', version: 3 })
    expect('version' in sent.at(-1).body).toBe(false)
  })

  it('rejects a save the server refuses for another reason', async () => {
    answer = () => ({ status: 404, body: { error: 'Not found' } })
    await expect(api.updatePresentation('gone', { title: 'x' })).rejects.toThrow('Not found')
  })
})

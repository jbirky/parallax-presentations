// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

const version = (extra = {}) => ({
  id: 'v2', pluginId: 'io.github.someone.lorenz', repoOwner: 'someone', repoName: 'lorenz', version: '1.1.0', tag: 'v1.1.0',
  commitSha: 'a'.repeat(40), status: 'pending', reviewNote: '', submitterEmail: 'author@example.com', createdAt: '2026-10-07T12:00:00Z',
  files: [{ path: 'sandbox.html', size: 25000 }], approved: { version: '1.0.0', tag: 'v1.0.0' },
  manifest: {
    name: 'Lorenz attractor', description: 'A strange attractor', license: 'MIT', permissions: ['network:cdn.jsdelivr.net'],
    contributes: { elementTypes: [{ type: 'lorenz', label: 'Lorenz attractor', defaultSize: { width: 400, height: 300 }, defaultData: { sigma: 10 } }] },
  },
  ...extra,
})
const state = { list: [] }
vi.mock('../utils/api', () => ({
  api: {
    getPluginReviewQueue: vi.fn(async () => state.list),
    reviewPluginVersion: vi.fn(async (id, action) => {
      state.list = []
      return { id, status: action === 'approve' ? 'approved' : 'rejected' }
    }),
    getPluginVersionSandbox: vi.fn(async () => '<!DOCTYPE html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><body>Lorenz</body>'),
  },
}))
import { api } from '../utils/api'
import PluginReviewPanel from './PluginReviewPanel'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, el
beforeEach(() => { state.list = [version()]; vi.clearAllMocks() })
afterEach(() => { act(() => root.unmount()); el.remove() })

async function mount() {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<PluginReviewPanel />))
}
const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text)

describe('reviewing community plugins', () => {
  it('shows what a reviewer checks: the commit, the hosts, the files, and the changes since the last approved version', async () => {
    await mount()
    expect(api.getPluginReviewQueue).toHaveBeenCalledWith('pending')
    const links = [...el.querySelectorAll('a')].map(a => a.getAttribute('href'))
    expect(links).toContain(`https://github.com/someone/lorenz/tree/${'a'.repeat(40)}`)
    expect(links).toContain('https://github.com/someone/lorenz/compare/v1.0.0...v1.1.0')
    expect(links).toContain(`https://github.com/someone/lorenz/blob/${'a'.repeat(40)}/dist/sandbox.html`)
    expect(el.textContent).toContain('cdn.jsdelivr.net')
    expect(el.textContent).toContain('author@example.com')
    expect(button('Revoke')).toBe(undefined)
  })

  it('previews the version with its default data', async () => {
    await mount()
    await act(async () => button('Preview').click())
    expect(api.getPluginVersionSandbox).toHaveBeenCalledWith('io.github.someone.lorenz', '1.1.0')
    const frame = el.querySelector('iframe')
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
    expect(frame.getAttribute('srcdoc')).toContain('Lorenz')
  })

  it('approves with a note, and loads the queue again', async () => {
    await mount()
    const note = el.querySelector('textarea')
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    await act(async () => { set.call(note, 'Thanks!'); note.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => button('Approve').click())
    expect(api.reviewPluginVersion).toHaveBeenCalledWith('v2', 'approve', 'Thanks!')
    expect(api.getPluginReviewQueue).toHaveBeenCalledTimes(2)
    expect(el.textContent).toContain('Nothing is waiting for review.')
  })

  it('offers to revoke an approved version, and nothing for a revoked one', async () => {
    state.list = [version({ status: 'approved' }), version({ id: 'v1', version: '1.0.0', status: 'revoked', reviewNote: 'Sent data away' })]
    await mount()
    expect(el.querySelectorAll('[data-version] button')).toHaveLength(3)
    expect(button('Revoke')).toBeTruthy()
    expect(el.querySelector('[data-version="v1"]').textContent).toContain('Sent data away')
  })
})

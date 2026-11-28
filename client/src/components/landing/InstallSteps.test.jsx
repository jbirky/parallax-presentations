// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../../utils/analytics', () => ({ track: vi.fn() }))
import { track } from '../../utils/analytics'
import InstallSteps, { visitorPlatform } from './InstallSteps'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, el
afterEach(() => { if (root) act(() => root.unmount()); el?.remove(); root = el = null; vi.restoreAllMocks() })

async function mount() {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<InstallSteps />))
}
const pick = async (group, label) => {
  const b = [...el.querySelectorAll(`[aria-label="${group}"] button`)].find(x => x.textContent === label)
  await act(async () => b.click())
}
const pressed = group => el.querySelector(`[aria-label="${group}"] [aria-pressed="true"]`)?.textContent
const panel = () => el.querySelector('.lp-install-panel')

describe('the desktop app’s install steps', () => {
  it('tells the platform from the browser, with macOS for phones and the unknown', () => {
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    expect(visitorPlatform({ platform: 'MacIntel', userAgent: mac })).toBe('mac')
    expect(visitorPlatform({ userAgentData: { platform: 'Windows' }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })).toBe('windows')
    expect(visitorPlatform({ platform: 'Linux x86_64', userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })).toBe('linux')
    expect(visitorPlatform({ platform: 'Linux armv8l', userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' })).toBe('mac')
    expect(visitorPlatform({ platform: 'iPhone', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe('mac')
    expect(visitorPlatform({})).toBe('mac')
  })

  it('opens on the visitor’s platform', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32')
    await mount()
    expect(pressed('Show the steps for')).toBe('Windows')
    expect(panel().textContent).toContain('Parallax.Setup.')
    expect(panel().textContent).toContain('Run anyway')
  })

  it('gives each platform its steps and a way to the download', async () => {
    await mount()
    await pick('Show the steps for', 'macOS')
    expect(panel().textContent).toContain('arm64.dmg')
    expect(panel().textContent).toContain('Open Anyway')
    const download = [...panel().querySelectorAll('a.lp-btn')]
    expect(download.map(a => a.textContent.trim())).toEqual(['Download for macOS'])
    expect(download[0].getAttribute('href')).toBe('https://github.com/jbirky/parallax-presentations/releases/latest')
    expect(download[0].getAttribute('target')).toBe('_blank')
    await act(async () => download[0].click())
    expect(track).toHaveBeenCalledWith('download', { platform: 'mac' })
    expect(panel().querySelector('.lp-install-foot a').getAttribute('href')).toBe('#docs/guide/installation')
  })

  it('sets up the APT or RPM repository on Linux, and the AppImage elsewhere', async () => {
    await mount()
    await pick('Show the steps for', 'Linux')
    expect(pressed('Your distribution')).toBe('Ubuntu, Debian')
    const code = () => panel().querySelector('pre').textContent
    expect(code()).toBe('sudo curl -fsSLo /etc/apt/sources.list.d/parallax.sources \\\n  https://pkg.parallax-presentations.com/apt/parallax.sources\nsudo apt update\nsudo apt install parallax')
    // A repository needs no download
    expect(panel().querySelector('a.lp-btn')).toBeNull()

    await pick('Your distribution', 'Fedora, RHEL')
    expect(code()).toContain('/etc/yum.repos.d/parallax.repo')
    expect(code()).toContain('sudo dnf install parallax')
    await pick('Your distribution', 'openSUSE')
    expect(code()).toBe('sudo zypper addrepo https://pkg.parallax-presentations.com/rpm/parallax.repo\nsudo zypper install parallax')

    await pick('Your distribution', 'Arch, others')
    expect(code()).toBe('chmod +x Parallax-*.AppImage\n./Parallax-*.AppImage')
    expect(panel().textContent).toContain('sudo pacman -S fuse2')
    expect(panel().querySelector('a.lp-btn').textContent.trim()).toBe('Download the AppImage')
  })

  it('copies the commands', async () => {
    const writeText = vi.fn(async () => {})
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText })
    await mount()
    await pick('Show the steps for', 'Linux')
    await pick('Your distribution', 'openSUSE')
    const copy = panel().querySelector('.lp-install-code button')
    await act(async () => copy.click())
    expect(writeText).toHaveBeenCalledWith('sudo zypper addrepo https://pkg.parallax-presentations.com/rpm/parallax.repo\nsudo zypper install parallax')
    expect(copy.getAttribute('aria-label')).toBe('Copied')
  })
})

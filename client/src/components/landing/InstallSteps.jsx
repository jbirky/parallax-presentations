// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// How to install the desktop app (the landing page's #install): a tab for
// each platform, the visitor's own first, with the steps from
// docs/guide/installation.md (change the two together). On Linux, the APT
// or RPM repository at pkg.parallax-presentations.com for each family of
// distributions (.github/workflows/release.yml publishes them), and the
// AppImage for the rest. The downloads are on the latest GitHub release,
// whose files carry the version in their names, so the buttons open that
// release rather than a file.

import { useState } from 'react'
import { ArrowRight, Check, Copy } from 'lucide-react'
import { track } from '../../utils/analytics'

const RELEASE = 'https://github.com/jbirky/parallax-presentations/releases/latest'
const PKG = 'https://pkg.parallax-presentations.com'
const GUIDE = '#docs/guide/installation'

export const PLATFORMS = [
  { id: 'mac', label: 'macOS' },
  { id: 'windows', label: 'Windows' },
  { id: 'linux', label: 'Linux' },
]

// A package manager's setup for each family, and the AppImage for the rest
export const DISTROS = [
  {
    id: 'apt', label: 'Ubuntu, Debian', note: 'Ubuntu 22.04, Debian 12 and later, and Linux Mint.',
    code: `sudo curl -fsSLo /etc/apt/sources.list.d/parallax.sources \\\n  ${PKG}/apt/parallax.sources\nsudo apt update\nsudo apt install parallax`,
  },
  {
    id: 'dnf', label: 'Fedora, RHEL', note: 'dnf asks you to trust the Parallax Packages key on the first install.',
    code: `sudo curl -fsSLo /etc/yum.repos.d/parallax.repo \\\n  ${PKG}/rpm/parallax.repo\nsudo dnf install parallax`,
  },
  {
    id: 'zypper', label: 'openSUSE', note: 'zypper asks you to trust the Parallax Packages key on the first install.',
    code: `sudo zypper addrepo ${PKG}/rpm/parallax.repo\nsudo zypper install parallax`,
  },
  { id: 'appimage', label: 'Arch, others', code: 'chmod +x Parallax-*.AppImage\n./Parallax-*.AppImage' },
]

// The visitor's platform, from the browser; a phone or anything unknown gets macOS
export function visitorPlatform(nav = typeof navigator === 'undefined' ? {} : navigator) {
  const p = `${nav.userAgentData?.platform || ''} ${nav.platform || ''} ${nav.userAgent || ''}`.toLowerCase()
  if (/android|iphone|ipad|mac/.test(p)) return 'mac'
  if (p.includes('win')) return 'windows'
  if (/linux|x11|cros/.test(p)) return 'linux'
  return 'mac'
}

function Code({ code, what }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    track('install-copy', { what })
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* the commands are there to select */ }
  }
  return (
    <div className="lp-install-code">
      <pre><code>{code}</code></pre>
      <button type="button" onClick={copy} aria-label={copied ? 'Copied' : 'Copy the commands'} title="Copy">
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  )
}

const Download = ({ platform, children }) => (
  <a className="lp-btn primary" href={RELEASE} target="_blank" rel="noopener noreferrer" onClick={() => track('download', { platform })}>
    {children} <ArrowRight size={16} />
  </a>
)

export default function InstallSteps() {
  const [platform, setPlatform] = useState(visitorPlatform)
  const [distro, setDistro] = useState('apt')
  const linux = DISTROS.find(d => d.id === distro)

  return (
    <div className="lp-install">
      <div className="lp-install-tabs" role="group" aria-label="Show the steps for">
        {PLATFORMS.map(p => (
          <button key={p.id} type="button" aria-pressed={platform === p.id} onClick={() => { track('install-platform', { platform: p.id }); setPlatform(p.id) }}>{p.label}</button>
        ))}
      </div>

      <div className="lp-install-panel">
        {platform === 'mac' && (<>
          <ol>
            <li>From the latest release on GitHub, download <code>Parallax-…-arm64.dmg</code>. It’s for Macs with Apple silicon (M1 and later).</li>
            <li>Open it, and drag Parallax to Applications.</li>
            <li>The app isn’t signed with an Apple Developer ID yet, so the first time you open it, macOS says it can’t check it for malware. Click <b>Done</b>, open <b>System Settings › Privacy &amp; Security</b>, and click <b>Open Anyway</b> by the message about Parallax. After that it opens normally.</li>
          </ol>
          <div className="lp-install-row"><Download platform="mac">Download for macOS</Download></div>
        </>)}

        {platform === 'windows' && (<>
          <ol>
            <li>From the latest release on GitHub, download <code>Parallax.Setup.….exe</code>.</li>
            <li>Run the installer. It isn’t signed with a code-signing certificate yet, so if SmartScreen says it doesn’t recognize the app, click <b>More info</b>, then <b>Run anyway</b>.</li>
          </ol>
          <div className="lp-install-row"><Download platform="windows">Download for Windows</Download></div>
        </>)}

        {platform === 'linux' && (<>
          <div className="lp-install-distros" role="group" aria-label="Your distribution">
            {DISTROS.map(d => (
              <button key={d.id} type="button" aria-pressed={distro === d.id} onClick={() => { track('install-distro', { distro: d.id }); setDistro(d.id) }}>{d.label}</button>
            ))}
          </div>
          {linux.id === 'appimage' ? (<>
            <p>There’s no package for these yet. From the latest release on GitHub, download <code>Parallax-…-x86_64.AppImage</code>, then run it:</p>
            <Code code={linux.code} what="appimage" />
            <p className="lp-install-note">On Arch, install FUSE 2 first: <code>sudo pacman -S fuse2</code>. On Ubuntu 24.04 and later the AppImage can’t start, so use the Ubuntu package.</p>
            <div className="lp-install-row"><Download platform="linux">Download the AppImage</Download></div>
          </>) : (<>
            <p>{linux.note} Installed this way, Parallax updates along with the rest of your system.</p>
            <Code code={linux.code} what={linux.id} />
          </>)}
        </>)}

        <p className="lp-install-foot">
          The app runs the editor on your computer, with no account, and keeps your decks there. <a className="lp-quiet" href={GUIDE} onClick={() => track('install-guide')}>The installation guide</a>
        </p>
      </div>
    </div>
  )
}

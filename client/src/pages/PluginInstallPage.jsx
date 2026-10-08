// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import BetaBadge from '../components/BetaBadge'

// /plugins/<slug>/install: the Install button on a plugin's page in the
// gallery (server/services/plugin-pages.js) comes here, through signing in
// when need be. Installs the plugin and says where its element is.
export default function PluginInstallPage({ slug }) {
  const [state, setState] = useState({ status: 'installing' })

  useEffect(() => {
    let stale = false
    ;(async () => {
      try {
        const plugin = await api.getPlugin(slug)
        await api.installPlugin(slug)
        if (!stale) setState({ status: 'installed', name: plugin.name })
      } catch (err) {
        if (!stale) setState({ status: 'failed', message: err.message })
      }
    })()
    return () => { stale = true }
  }, [slug])

  const go = href => () => { window.location.href = href }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg-primary, #0f0f1a)' }}>
      <div style={{ width: 420, maxWidth: '100%', background: 'var(--bg-card, #1e1e2e)', border: '1px solid var(--border, #2a2a3e)', borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--text-primary, #e0e0e0)' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}><span style={{ color: 'var(--accent, #6366f1)' }}>P</span>arallax<BetaBadge /></div>
        {state.status === 'installing' ? (
          <p role="status" style={{ margin: 0, fontSize: 14, color: 'var(--text-muted, #888)' }}>Installing the plugin…</p>
        ) : state.status === 'failed' ? (
          <>
            <p role="alert" style={{ margin: 0, fontSize: 14 }}>{state.message}</p>
            <button className="btn btn-secondary" onClick={go('/plugins')} style={{ justifyContent: 'center' }}>See the plugins</button>
          </>
        ) : (
          <>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.4 }}>{state.name} is installed</h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #888)', lineHeight: 1.5 }}>
              Open a presentation, and its element is in the Plugins menu at the right of the editor’s toolbar.
            </p>
            <button className="btn btn-primary" onClick={go('/dashboard')} style={{ justifyContent: 'center' }}>Go to your presentations</button>
            <button className="btn btn-ghost" onClick={go(`/plugins/${encodeURIComponent(slug)}`)} style={{ justifyContent: 'center' }}>Back to the plugin</button>
          </>
        )}
      </div>
    </div>
  )
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { track } from '../utils/analytics'
import BetaBadge from '../components/BetaBadge'

// /templates/<slug>/use: Use this template, from the landing page's Templates
// tab, once signed in. Says which template it is and, when asked, makes a
// presentation of theirs from it (with the datasets it plots) and opens it.
// A click makes the copy, not the link, so a link alone adds nothing to
// anyone's presentations. onOpen(id, title) opens the editor.
export default function TemplateUsePage({ slug, onOpen }) {
  const [template, setTemplate] = useState(null)
  const [error, setError] = useState('')
  const [making, setMaking] = useState(false)

  useEffect(() => {
    api.getLandingExamples()
      .then(list => {
        const found = (list?.templates || []).find(t => t.slug === slug)
        if (found) setTemplate(found)
        else setError('That template isn’t available any more.')
      })
      .catch(() => setError('The templates couldn’t be loaded. Try again in a moment.'))
  }, [slug])

  const make = async () => {
    setMaking(true)
    try {
      const made = await api.useTemplate(slug)
      track('use-template', { template: slug })
      onOpen(made.id, made.title)
    } catch (err) {
      setError(err.message)
      setMaking(false)
    }
  }

  const toDashboard = () => { window.location.href = '/dashboard' }
  const muted = { margin: 0, fontSize: 13, color: 'var(--text-muted, #888)', lineHeight: 1.5 }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg-primary, #0f0f1a)' }}>
      <div style={{ width: 440, maxWidth: '100%', background: 'var(--bg-card, #1e1e2e)', border: '1px solid var(--border, #2a2a3e)', borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--text-primary, #e0e0e0)' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}><span style={{ color: 'var(--accent, #6366f1)' }}>P</span>arallax<BetaBadge /></div>
        {error ? (
          <>
            <p role="alert" style={{ margin: 0, fontSize: 14 }}>{error}</p>
            <a href="/#templates" style={{ fontSize: 13, color: 'var(--accent, #6366f1)' }}>See the templates</a>
            <button className="btn btn-secondary" onClick={toDashboard} style={{ justifyContent: 'center' }}>Go to your presentations</button>
          </>
        ) : !template ? (
          <p style={muted}>Opening the template…</p>
        ) : (
          <>
            {template.thumbnail && (
              <img src={template.thumbnail} alt="" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border, #2a2a3e)' }} />
            )}
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.4 }}>Start a presentation from “{template.title}”</h1>
            {template.desc && <p style={muted}>{template.desc}</p>}
            <p style={muted}>A copy goes in your presentations, yours to change. The template stays as it is.</p>
            <button className="btn btn-primary" onClick={make} disabled={making} style={{ justifyContent: 'center' }}>
              {making ? 'Making your copy…' : 'Make my copy'}
            </button>
            <button className="btn btn-ghost" onClick={toDashboard} style={{ justifyContent: 'center' }}>Not now</button>
          </>
        )}
      </div>
    </div>
  )
}

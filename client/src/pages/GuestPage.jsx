// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Guest mode (/try): the editor without an account. The session token lives in
// sessionStorage, so each tab is its own session and a reload keeps it. The
// server deletes the session when the tab closes or after it sits idle.

import { useState, useEffect, useRef, useCallback } from 'react'
import EditorPage from './EditorPage'
import { api, setGuestToken } from '../utils/api'

const TOKEN_KEY = 'parallax-guest-token'
// User input counts as activity; tell the server at most this often
const ACTIVITY_PING_MS = 5 * 60 * 1000

function readToken() { try { return sessionStorage.getItem(TOKEN_KEY) } catch { return null } }
function saveToken(token) { try { sessionStorage.setItem(TOKEN_KEY, token) } catch { /* private mode */ } }
function clearToken() { try { sessionStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ } }

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => resolve(window.turnstile)
    script.onerror = () => reject(new Error('Could not load the verification check. Please reload the page.'))
    document.head.appendChild(script)
  })
}

const muted = { color: 'var(--text-muted, #888)', fontSize: 14, maxWidth: 460, lineHeight: 1.6, margin: 0 }

export default function GuestPage() {
  // loading | start | editor | expired | unavailable | error
  const [state, setState] = useState('loading')
  const [presentationId, setPresentationId] = useState(null)
  const [siteKey, setSiteKey] = useState(null)
  const [idleHours, setIdleHours] = useState(12)
  const [verification, setVerification] = useState(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState(null)
  const widgetRef = useRef(null)

  // Open this session's presentation, creating it on first entry
  const enter = useCallback(async () => {
    const session = await api.resumeGuestSession()
    if (session.idleHours) setIdleHours(session.idleHours)
    const id = session.presentationId ||
      (await api.createPresentation({ title: 'Untitled', theme: 'black', transition: 'slide' })).id
    setPresentationId(id)
    setState('editor')
  }, [])

  const showStart = useCallback(async () => {
    setError(null)
    setVerification(null)
    const config = await api.getGuestConfig().catch(() => ({ enabled: false }))
    if (!config.enabled) { setState('unavailable'); return }
    if (config.idleHours) setIdleHours(config.idleHours)
    setSiteKey(config.turnstileSiteKey)
    setState('start')
  }, [])

  // Rejoin this tab's session after a reload, or offer to start one
  useEffect(() => {
    const token = readToken()
    if (!token) { showStart(); return }
    setGuestToken(token)
    enter().catch(err => {
      // An ended session is handled by the guest-expired listener below
      if (readToken()) { setError(err.message); setState('error') }
    })
  }, [enter, showStart])

  // The server deleted the session (tab closed elsewhere, or idle too long)
  useEffect(() => {
    const onExpired = () => {
      clearToken()
      setGuestToken(null)
      setPresentationId(null)
      setState('expired')
    }
    window.addEventListener('parallax:guest-expired', onExpired)
    return () => window.removeEventListener('parallax:guest-expired', onExpired)
  }, [])

  // Verification widget on the start screen
  useEffect(() => {
    if (state !== 'start' || !siteKey) return
    let widgetId
    let cancelled = false
    loadTurnstile().then(turnstile => {
      if (cancelled || !widgetRef.current) return
      widgetId = turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
        callback: token => setVerification(token),
        'expired-callback': () => setVerification(null),
        'error-callback': () => setError('Verification failed. Please reload the page and try again.'),
      })
    }).catch(err => setError(err.message))
    return () => {
      cancelled = true
      if (widgetId !== undefined) window.turnstile?.remove(widgetId)
    }
  }, [state, siteKey])

  async function start() {
    setStarting(true)
    setError(null)
    try {
      const { token } = await api.startGuestSession(verification)
      saveToken(token)
      setGuestToken(token)
      await enter()
    } catch (err) {
      setError(err.message)
      setVerification(null)
      window.turnstile?.reset()
    } finally {
      setStarting(false)
    }
  }

  // While editing: report the tab closing, reclaim the session after a
  // back/forward-cache restore, warn before leaving, and report activity.
  useEffect(() => {
    if (state !== 'editor') return
    const token = readToken()
    // The server waits a couple of minutes before deleting, so a reload
    // (which also fires pagehide) reconnects in time.
    const onPageHide = () => { if (token) navigator.sendBeacon('/api/guest/close', token) }
    const onPageShow = e => { if (e.persisted) api.resumeGuestSession().catch(() => {}) }
    const onBeforeUnload = e => { e.preventDefault(); e.returnValue = '' }
    let lastPing = Date.now()
    const onActivity = () => {
      if (Date.now() - lastPing < ACTIVITY_PING_MS) return
      lastPing = Date.now()
      api.pingGuestActivity()
    }
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pointerdown', onActivity, true)
    window.addEventListener('keydown', onActivity, true)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pointerdown', onActivity, true)
      window.removeEventListener('keydown', onActivity, true)
    }
  }, [state])

  if (state === 'editor') {
    return <EditorPage presentationId={presentationId} guest={{ idleHours }} onGoHome={() => { window.location.href = '/' }} />
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 20, padding: 16, textAlign: 'center', background: 'var(--bg-primary, #0f0f1a)',
    }}>
      <h1 style={{ fontSize: 36, fontWeight: 700, color: 'var(--text-primary, #fff)', margin: 0, cursor: 'pointer' }}
          onClick={() => { window.location.href = '/' }}>
        <span style={{ color: 'var(--accent, #6366f1)' }}>P</span>arallax
      </h1>

      {state === 'loading' && <p style={muted}>Loading…</p>}

      {state === 'unavailable' && (
        <>
          <p style={muted}>Guest mode isn't available right now. Sign in to use the editor.</p>
          <a href="/sign-in" className="btn btn-primary" style={{ textDecoration: 'none' }}>Sign in</a>
        </>
      )}

      {state === 'expired' && (
        <>
          <p style={muted}>
            This guest session has ended, and its presentation and uploads were deleted.
          </p>
          <button className="btn btn-primary" onClick={showStart}>Start a new guest session</button>
        </>
      )}

      {state === 'error' && (
        <>
          <p style={muted}>{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button>
        </>
      )}

      {state === 'start' && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary, #fff)', margin: 0 }}>
            Try the editor as a guest
          </h2>
          <p style={muted}>
            No account needed. Your presentation and uploads are deleted when you close this tab,
            or after {idleHours} hours without activity. To keep your work, use
            Export&nbsp;→&nbsp;Export Offline HTML before you leave.
          </p>
          <div ref={widgetRef} style={{ minHeight: 65 }} />
          <button className="btn btn-primary" disabled={!verification || starting} onClick={start}>
            {starting ? 'Opening…' : 'Open the editor'}
          </button>
          {error && <p style={{ ...muted, color: 'var(--danger, #ef4444)' }}>{error}</p>}
        </>
      )}
    </div>
  )
}

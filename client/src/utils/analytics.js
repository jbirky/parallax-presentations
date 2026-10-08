// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Counting visits to the landing page and what's done there, with Umami, when
// the server has it set up (GET /api/analytics; server/index.js passes the
// script and events on to Umami). Umami sets no cookies, and its script sends
// nothing for a browser that asks not to be tracked. Events from before the
// script arrives wait for it, a few at most.

const MAX_WAITING = 20
let started = null
const waiting = []

// Loads the script, once
export function startAnalytics() {
  if (started) return started
  started = fetch('/api/analytics')
    .then(r => (r.ok ? r.json() : {}))
    .then(config => {
      if (!config.websiteId || !config.script) return
      const script = document.createElement('script')
      script.defer = true
      script.src = config.script
      script.setAttribute('data-website-id', config.websiteId)
      script.setAttribute('data-do-not-track', 'true')
      script.onload = () => { while (waiting.length) send(...waiting.shift()) }
      document.head.appendChild(script)
    })
    .catch(() => {})
  return started
}

function send(name, data) {
  try { window.umami?.track(name, data) } catch { /* not counted */ }
}

// An event, with what it was about: track('open-example', { example: 'venn' })
export function track(name, data) {
  if (window.umami?.track) send(name, data)
  else if (started && waiting.length < MAX_WAITING) waiting.push([name, data])
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Guest mode auth: resolves an X-Guest-Token header to the session's user and
// limits guests to the routes the editor needs. Anything not listed here
// (sharing, live sessions, GitHub/Zenodo/Zotero, templates, fonts, PowerPoint
// import, Manim rendering, billing, ...) needs an account.

const rateLimit = require('express-rate-limit')
const { ipKeyGenerator } = rateLimit
const { PLAN_LIMITS } = require('./auth')
const { touchGuestSession, guestKeyPrefix } = require('../services/guest-service')

const GUEST_ROUTES = [
  ['POST', /^\/api\/guest\/(resume|activity)$/],
  ['GET', /^\/api\/me$/],
  // Presentations and version history
  ['GET POST', /^\/api\/presentations$/],
  ['GET PUT DELETE', /^\/api\/presentations\/[^/]+$/],
  ['GET', /^\/api\/presentations\/[^/]+\/export$/],
  ['GET', /^\/api\/presentations\/[^/]+\/snapshots$/],
  ['POST', /^\/api\/presentations\/[^/]+\/snapshot$/],
  ['GET', /^\/api\/presentations\/[^/]+\/snapshots\/[^/]+\/data$/],
  ['DELETE', /^\/api\/presentations\/[^/]+\/snapshots\/[^/]+$/],
  ['POST', /^\/api\/presentations\/[^/]+\/restore\/[^/]+$/],
  // Uploads
  ['POST', /^\/api\/upload$/],
  ['POST', /^\/api\/presentations\/[^/]+\/upload$/],
  ['GET', /^\/api\/presentations\/[^/]+\/uploads$/],
  ['GET', /^\/api\/uploads$/],
  ['DELETE', /^\/api\/uploads\/[^/]+$/],
  // Datasets
  ['GET POST', /^\/api\/datasets$/],
  ['GET PATCH DELETE', /^\/api\/datasets\/[^/]+$/],
  ['GET', /^\/api\/datasets\/[^/]+\/data$/],
  ['GET POST', /^\/api\/presentations\/[^/]+\/datasets$/],
  ['DELETE', /^\/api\/presentations\/[^/]+\/datasets\/[^/]+$/],
  ['GET', /^\/api\/presentations\/[^/]+\/datasets\/[^/]+\/data$/],
  // Plugins in a presentation; fonts and templates read-only
  ['GET', /^\/api\/me\/plugins$/],
  ['GET POST', /^\/api\/presentations\/[^/]+\/plugins$/],
  ['DELETE', /^\/api\/presentations\/[^/]+\/plugins\/[^/]+$/],
  ['GET', /^\/api\/fonts$/],
  ['GET', /^\/api\/fonts\/file\/[^/]+$/],
  ['GET', /^\/api\/templates(\/[^/]+)?$/],
]

const UPLOAD_ROUTES = [
  /^\/api\/upload$/,
  /^\/api\/presentations\/[^/]+\/upload$/,
  /^\/api\/datasets$/,
]

// Allowance for multipart framing around the file itself
const MULTIPART_OVERHEAD = 64 * 1024
// A refused upload is read to the end before answering (see refuseUpload),
// unless it is bigger than this
const DRAIN_LIMIT = 100 * 1024 * 1024

function isGuestRoute(method, path) {
  return GUEST_ROUTES.some(([methods, re]) => methods.split(' ').includes(method) && re.test(path))
}

function formatMB(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

// Rejects an upload before multer writes it to disk if it is too big for a
// guest or would take the session over its storage limit.
async function checkGuestUpload(storage, req) {
  const { maxFileBytes, storageBytes } = PLAN_LIMITS.guest
  const length = Number(req.get('content-length'))
  if (!length) return { status: 411, error: 'Upload size is required' }
  if (length > maxFileBytes + MULTIPART_OVERHEAD) {
    return { status: 413, error: `Guest uploads are limited to ${formatMB(maxFileBytes)} per file.` }
  }
  const { rows } = await storage.query(
    `SELECT (SELECT COALESCE(SUM(size_bytes), 0) FROM uploads WHERE user_id = $1)
          + (SELECT COALESCE(SUM(byte_size), 0) FROM datasets WHERE user_id = $1) AS used`,
    [req.userId]
  )
  if (Number(rows[0].used) + length > storageBytes + MULTIPART_OVERHEAD) {
    return { status: 413, error: `Guest storage is full (${formatMB(storageBytes)}). Delete some files to upload more.` }
  }
  return null
}

// Browsers often report a network error instead of the response if the server
// answers and closes the connection while an upload is still being sent, so
// read the rest of the body first.
function refuseUpload(req, res, { status, error }) {
  const send = () => { if (!res.headersSent) res.status(status).json({ error }) }
  const length = Number(req.get('content-length'))
  if (!length || length > DRAIN_LIMIT) {
    res.set('Connection', 'close')
    return send()
  }
  req.on('end', send)
  req.on('error', () => {})
  req.resume()
}

function guestAuth(storage) {
  return async (req, res, next) => {
    const token = req.get('X-Guest-Token')
    if (!token || req.userId || !req.path.startsWith('/api/')) return next()
    try {
      const session = await touchGuestSession(storage, token, { activity: req.method !== 'GET' })
      if (!session) return res.status(401).json({ error: 'This guest session has ended.', code: 'guest_expired' })
      if (!isGuestRoute(req.method, req.path)) {
        return res.status(403).json({ error: 'Create a free account to use this feature.', code: 'guest_forbidden' })
      }
      req.userId = session.userId
      req.userPlan = 'guest'
      req.isGuest = true
      req.guestKeyPrefix = guestKeyPrefix(session.id)
      if (req.method === 'POST' && UPLOAD_ROUTES.some(re => re.test(req.path))) {
        const problem = await checkGuestUpload(storage, req)
        if (problem) return refuseUpload(req, res, problem)
      }
      next()
    } catch (err) {
      console.error('Guest auth error:', err.message)
      res.status(500).json({ error: 'Guest session error' })
    }
  }
}

// Requests reach the app through the Cloudflare tunnel, so req.ip is the
// tunnel's address; Cloudflare puts the visitor's address in CF-Connecting-IP.
const guestCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => ipKeyGenerator(req.get('CF-Connecting-IP') || req.ip),
  validate: { xForwardedForHeader: false },
  message: { error: 'Too many guest sessions from this network. Please try again later.' },
})

module.exports = { guestAuth, guestCreateLimiter }

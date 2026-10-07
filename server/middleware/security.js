// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const { ipKeyGenerator } = rateLimit

const IS_CLOUD = process.env.PARALLAX_MODE === 'cloud'
const IS_PROD = process.env.NODE_ENV === 'production'

// The site this server is (PARALLAX_PUBLIC_URL, prod's by default). Prod and
// dev are separate sites and each trusts only itself: its pages alone may call
// its API with credentials, and it takes only sign-ins made on it (auth.js).
const PUBLIC_ORIGIN = IS_CLOUD ? new URL(process.env.PARALLAX_PUBLIC_URL || 'https://parallax-presentations.com').origin : null
const ALLOWED_ORIGINS = [PUBLIC_ORIGIN]

function corsConfig() {
  // Self-hosted, nothing is for other sites (localOnly)
  if (!IS_CLOUD) {
    return { origin: false }
  }
  return {
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true)
      } else {
        callback(Object.assign(new Error('Not allowed by CORS'), { status: 403 }))
      }
    },
    credentials: true,
  }
}

function helmetConfig() {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true } : false,
  })
}

// Requests reach the app through the Cloudflare tunnel, so req.ip is the
// tunnel's address; Cloudflare puts the visitor's address in CF-Connecting-IP.
function clientIpKey(req) {
  return ipKeyGenerator(req.get('CF-Connecting-IP') || req.ip)
}

function userOrIpKey(req) {
  return req.userId || clientIpKey(req)
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_CLOUD ? 300 : 0,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: () => !IS_CLOUD,
})

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_CLOUD ? 60 : 0,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: () => !IS_CLOUD,
  message: { error: 'Too many uploads, please try again later' },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_CLOUD ? 30 : 0,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: () => !IS_CLOUD,
  message: { error: 'Too many requests, please try again later' },
})

// Pages built from a deck (share links, live sessions): outside /api, each
// builds the whole deck. Per address, with room for a class behind one NAT
// Analytics events from the landing page, passed on to Umami (/stats/api/send)
const statsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
})

const deckPageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_CLOUD ? 600 : 0,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  skip: () => !IS_CLOUD,
  message: 'Too many requests, please try again later',
})

// --- Self-hosted: this machine only ---
// With no sign-in, whoever reaches the server can read and change every
// presentation and use the stored GitHub and Zotero tokens. So it only
// answers requests addressed to this machine by name (a site that points its
// own name at 127.0.0.1 gets nothing: DNS rebinding), and /api refuses what
// other sites' pages send. PARALLAX_ALLOWED_HOSTS (names, comma-separated)
// lets others in, with PARALLAX_HOST to listen beyond this machine.
const LOCAL_HOSTS = 'localhost,127.0.0.1,[::1]'

const hostnameOf = host => {
  const h = String(host || '').toLowerCase()
  return h.startsWith('[') ? h.slice(0, h.indexOf(']') + 1) : h.split(':')[0]
}

function localOnly(allowedHosts = process.env.PARALLAX_ALLOWED_HOSTS || LOCAL_HOSTS) {
  const allowed = allowedHosts.split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
  return (req, res, next) => {
    if (!allowed.includes(hostnameOf(req.headers.host))) {
      return res.status(403).type('text/plain').send('This Parallax only answers on this computer. To open it to others, set PARALLAX_ALLOWED_HOSTS.')
    }
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      let sameOrigin = true
      if (req.headers.origin) {
        try { sameOrigin = new URL(req.headers.origin).host === String(req.headers.host).toLowerCase() } catch { sameOrigin = false }
      }
      const site = req.headers['sec-fetch-site']
      if (!sameOrigin || site === 'cross-site' || site === 'same-site') {
        return res.status(403).json({ error: 'Requests from other sites are refused' })
      }
    }
    next()
  }
}

// Where the server listens: this machine only when self-hosted (no sign-in)
function listenHost() {
  return process.env.PARALLAX_HOST || (IS_CLOUD ? '0.0.0.0' : '127.0.0.1')
}

// --- Validation helpers ---

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i
const SHA_RE = /^[0-9a-f]{4,40}$/i

function isValidUUID(s) { return typeof s === 'string' && UUID_RE.test(s) }
function isValidSlug(s) { return typeof s === 'string' && SAFE_SLUG_RE.test(s) }
function isValidSHA(s) { return typeof s === 'string' && SHA_RE.test(s) }

function requireValidId(paramName = 'id') {
  return (req, res, next) => {
    const val = req.params[paramName]
    if (!val || !isValidUUID(val)) {
      return res.status(400).json({ error: `Invalid ${paramName}` })
    }
    next()
  }
}

function requireValidSlug(paramName = 'slug') {
  return (req, res, next) => {
    const val = req.params[paramName]
    if (!val || !isValidSlug(val)) {
      return res.status(400).json({ error: `Invalid ${paramName}` })
    }
    next()
  }
}

function requireValidSHA(paramName = 'sha') {
  return (req, res, next) => {
    const val = req.params[paramName]
    if (!val || !isValidSHA(val)) {
      return res.status(400).json({ error: `Invalid ${paramName}` })
    }
    next()
  }
}

// --- Upload validation ---

const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/flac', 'audio/aac',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'font/woff', 'font/woff2', 'font/ttf', 'font/otf',
  'model/stl', 'model/gltf-binary',
])

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif',
  '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv',
  '.mp3', '.wav', '.flac', '.aac',
  '.pdf', '.pptx', '.ppt',
  '.woff', '.woff2', '.ttf', '.otf',
  '.stl', '.glb',
  // Molecular structures (client/src/utils/moleculeViewer.js), served as downloads
  '.pdb', '.ent', '.pqr', '.cif', '.mmcif', '.sdf', '.mol', '.mol2', '.xyz', '.gro',
])

function validateUpload(req, res, next) {
  if (!req.file) return next()
  const ext = require('path').extname(req.file.originalname).toLowerCase()
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
    require('fs-extra').removeSync(req.file.path)
    return res.status(400).json({ error: `File type not allowed: ${ext}` })
  }
  next()
}

// --- Error handling ---

// What a failed request says about its error. Messages the app writes itself
// (GitHub refused the push, say) are kept; the database's, the file system's
// and storage's are logged and not sent, since they name tables, columns,
// values, paths and keys. In development everything is sent.
function safeErrorMessage(err) {
  if (!IS_PROD) return err?.message || 'Internal server error'
  if (err?.statusCode && err.statusCode < 500) return err.message
  const internal = !err?.message ||
    (typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code)) || err.severity || err.routine ||  // Postgres
    err.syscall || typeof err.errno === 'number' ||  // the file system, sockets
    err.$metadata  // the AWS SDK (R2)
  if (!internal) return err.message
  console.error('Internal error:', err)
  return 'Internal server error'
}

module.exports = {
  corsConfig,
  helmetConfig,
  clientIpKey,
  apiLimiter,
  uploadLimiter,
  deckPageLimiter,
  statsLimiter,
  localOnly,
  listenHost,
  authLimiter,
  requireValidId,
  requireValidSlug,
  requireValidSHA,
  validateUpload,
  safeErrorMessage,
  isValidUUID,
  isValidSlug,
  ALLOWED_ORIGINS,
  PUBLIC_ORIGIN,
}

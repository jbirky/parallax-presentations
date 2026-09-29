// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs-extra')
const multer = require('multer')
const { v4: uuidv4 } = require('uuid')
const { execFile } = require('child_process')
const crypto = require('crypto')
const os = require('os')

const app = express()
const PORT = process.env.PORT || 3002

// Support custom data directory (used by Electron to write to user's app data folder)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const createStorage = require('./storage')
const storage = createStorage()
const { authStack, requireUser, isAdmin, IS_CLOUD, PLAN_LIMITS } = require('./middleware/auth')
const { isR2Enabled, streamFromR2, putBufferToR2, deleteFromR2, deleteManyFromR2 } = require('./services/r2')
const { handleUpload: r2Upload, deletePresentationAndFiles, sweepExpiredPresentations } = require('./services/upload-service')
const { setUploadHeaders } = require('./utils/upload-headers')
const { localizeLibraries } = require('./services/libraries')
const {
  GUEST_IDLE_HOURS, isGuestModeEnabled, verifyTurnstile, guestSessionsMayExist,
  createGuestSession, closeGuestSession, sweepGuestSessions, endAllGuestSessions,
} = require('./services/guest-service')
const { startSystemSampling, recordUsage, getAdminOverview, setUserPlan } = require('./services/admin-service')
const {
  loadPlans, listPlans, planFor, assignablePlans, purchasablePlans, toJSON: planJSON,
  PlanError, createPlan, updatePlan, deletePlan,
} = require('./services/plans')
const { guestAuth, guestCreateLimiter } = require('./middleware/guest')
const { uploadQuota, storageUsedBytes } = require('./middleware/upload-quota')
const collaboration = require('./services/collaboration')
const { deckAccess: deckAccessFor, ownerOnly } = collaboration
const { ingestDataset, readDatasetFile, applyQuery, deleteDatasetFile } = require('./services/dataset-service')
const { createSandboxLookup } = require('./services/plugin-embed')
const { renewSlideIds } = require('./services/click-actions')
const deckHtml = require('./services/deck-html')
const {
  corsConfig, helmetConfig, apiLimiter, uploadLimiter, authLimiter, deckPageLimiter, localOnly, listenHost,
  requireValidId, requireValidSlug, requireValidSHA, validateUpload, isValidUUID,
  safeErrorMessage, PUBLIC_ORIGIN,
} = require('./middleware/security')

const DATA_DIR = process.env.SLIDES_DATA_DIR || path.join(__dirname, 'data')
const UPLOADS_BASE = process.env.SLIDES_UPLOADS_DIR || path.join(__dirname, 'uploads')
const UPLOADS_DIR = UPLOADS_BASE

// The file in the uploads folder that a deck's /uploads/<relativePath> names,
// or null for one that leads out of it (/uploads/../../proc/self/environ):
// publishing reads what a deck points at and puts it in the owner's repo
function uploadsFile(relativePath) {
  const root = path.resolve(UPLOADS_DIR)
  const filePath = path.resolve(root, relativePath)
  return filePath.startsWith(root + path.sep) ? filePath : null
}

fs.ensureDirSync(DATA_DIR)
fs.ensureDirSync(UPLOADS_DIR)

// Multer storage config
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (isR2Enabled()) {
      const tmpDir = path.join(os.tmpdir(), 'parallax-uploads')
      fs.ensureDirSync(tmpDir)
      cb(null, tmpDir)
    } else {
      const dir = req.params.id ? path.join(UPLOADS_DIR, req.params.id) : UPLOADS_DIR
      fs.ensureDirSync(dir)
      cb(null, dir)
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  }
})
const upload = multer({ storage: multerStorage, limits: { fileSize: 500 * 1024 * 1024 } }) // 500MB limit for video
// Plan storage limits, checked before multer writes the file
const storageQuota = uploadQuota(storage)
// Owner or editor of the presentation in the route's :id (or another param)
const deckAccess = (param = 'id') => deckAccessFor(storage, param)

// Live editing over a WebSocket at /collab (cloud only; services/collab.js).
// Hocuspocus needs Node 22, which the desktop app's server may not have, so
// it's loaded only here. Reading a presentation stores its live edits first,
// and saving one goes into its live document.
let collab = null
if (IS_CLOUD && storage.query) {
  const { createCollab } = require('./services/collab')
  collab = createCollab({ storage, userIdForToken, ipOf: req => req.headers['cf-connecting-ip'] || req.socket.remoteAddress })
  storage.beforeRead = collab.flush
  storage.liveSave = collab.applySave
  // Stopping the server stores every open document first
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, async () => {
      await collab.flushAll()
      process.exit(0)
    })
  }
}

// The user a Clerk session token is for (the WebSocket has no Clerk middleware)
async function userIdForToken(token) {
  const { verifyToken } = require('@clerk/express')
  const { sub } = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY, authorizedParties: [PUBLIC_ORIGIN] })
  const { rows } = await storage.query('SELECT id FROM users WHERE auth_id = $1', [sub])
  return rows[0]?.id || null
}

app.use(helmetConfig())
if (!IS_CLOUD) app.use(localOnly())
// Library files, uploads and a live session's slide feed are public, and the
// pages that use them are sandboxed (sendDeckPage), so their requests come
// from origin null: those answer any origin, without credentials
const PUBLIC_CORS = /^\/(vendor|uploads)\/|^\/api\/live\/[^/]+\/(stream|status)$/
const publicCors = cors()
const appCors = cors(corsConfig())
app.use((req, res, next) => (PUBLIC_CORS.test(req.path) ? publicCors : appCors)(req, res, next))

// Stripe webhook — must be before express.json() to get raw body
const stripeService = require('./services/stripe')
if (stripeService.isEnabled()) {
  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const { planChangedFor } = await stripeService.handleWebhook(storage, req.body, req.headers['stripe-signature'])
      // Their next request reads the new plan instead of the cached one
      for (const authId of planChangedFor) provisionCache.delete(authId)
      res.json({ received: true })
    } catch (err) {
      console.error('Stripe webhook error:', err.message)
      res.status(400).json({ error: err.message })
    }
  })
}

app.use(express.json({ limit: '10mb' }))
if (isR2Enabled()) {
  app.get('/uploads/*', async (req, res) => {
    const urlPath = req.path.replace(/^\/uploads\//, '')
    if (urlPath.includes('..') || urlPath.startsWith('/')) return res.status(400).send('Invalid path')
    try {
      const { rows } = await storage.query(
        'SELECT storage_key, content_type FROM uploads WHERE filename = $1',
        [urlPath]
      )
      if (!rows.length) return res.status(404).send('Not found')
      const { body, contentLength } = await streamFromR2(rows[0].storage_key)
      // By its name, not the type it was stored with (utils/upload-headers.js)
      setUploadHeaders(res, urlPath)
      if (contentLength) res.setHeader('Content-Length', contentLength)
      // Guest files are deleted with their session, so nothing may cache them
      res.setHeader('Cache-Control', rows[0].storage_key.startsWith('guest/') ? 'private, no-store' : 'public, max-age=31536000, immutable')
      body.pipe(res)
    } catch (err) {
      console.error('R2 proxy error:', err.message)
      res.status(500).send('Storage error')
    }
  })
} else {
  app.use('/uploads', express.static(UPLOADS_DIR, {
    setHeaders(res, filePath) { setUploadHeaders(res, filePath) }
  }))
}

// ---- Docs API (public, before auth) ----

const DOCS_DIR = path.join(__dirname, '..', 'docs')

app.get('/api/docs/sidebar', (req, res) => {
  if (!fs.existsSync(DOCS_DIR)) return res.json({ guide: [], features: [], tutorials: [] })
  const sidebar = {
    guide: [
      { text: 'Introduction', link: 'guide/getting-started' },
      { text: 'Installation', link: 'guide/installation' },
      { text: 'Keyboard Shortcuts', link: 'guide/keyboard-shortcuts' },
      { text: 'Your First Presentation', link: 'tutorials/first-presentation' },
    ],
    features: [
      { text: 'Animations & Fragments', link: 'tutorials/animations' },
      { text: 'Charts', link: 'features/charts' },
      { text: 'Charts & Tables', link: 'tutorials/charts-tables' },
      { text: 'Citations & Bibliography', link: 'tutorials/citations' },
      { text: 'Code, LaTeX & Markdown', link: 'tutorials/code-math' },
      { text: 'Diagram Editor', link: 'tutorials/diagrams' },
      { text: 'Drawing on Slides', link: 'tutorials/drawing-on-slides' },
      { text: 'Editing with Others', link: 'tutorials/editing-with-others' },
      { text: 'Equation Palette', link: 'tutorials/equation-palette' },
      { text: 'Export & Sharing', link: 'features/export' },
      { text: 'Graphs', link: 'tutorials/graphs' },
      { text: 'HTML Embeds & p5.js', link: 'tutorials/html-embeds' },
      { text: 'Images', link: 'tutorials/images' },
      { text: 'Kinetic Text', link: 'tutorials/kinetic-text' },
      { text: 'LaTeX & Math', link: 'features/latex' },
      { text: 'Links, Click & Hover Actions', link: 'tutorials/interactive-slides' },
      { text: 'Overview', link: 'features/overview' },
      { text: 'Presenting & Export', link: 'tutorials/presenting' },
      { text: 'Scrolling Slides', link: 'tutorials/scrolling-slides' },
      { text: 'Shapes & Drawing', link: 'tutorials/shapes-drawing' },
      { text: 'Shapes & Elements', link: 'features/shapes' },
      { text: 'Text & Formatting', link: 'features/text-formatting' },
      { text: 'Text & Typography', link: 'tutorials/text-typography' },
      { text: 'Transitions', link: 'tutorials/transitions' },
      { text: 'Using LaTeX & Math', link: 'tutorials/using-latex' },
      { text: 'Version Diff', link: 'features/version-diff' },
      { text: 'Video & Audio', link: 'tutorials/media' },
      // Hidden while publishing to Zenodo is turned off (ZENODO_ENABLED)
      // { text: 'Zenodo Integration', link: 'features/zenodo' },
    ],
  }
  res.json(sidebar)
})

app.get('/api/docs/:section/:page', (req, res) => {
  const { section, page } = req.params
  const safe = (s) => s.replace(/[^a-z0-9_-]/gi, '')
  const filePath = path.join(DOCS_DIR, safe(section), safe(page) + '.md')
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Doc not found' })
  res.type('text/plain').send(fs.readFileSync(filePath, 'utf8'))
})

const docsPublic = path.join(DOCS_DIR, 'public')
if (fs.existsSync(docsPublic)) {
  app.use('/parallax-presentations', express.static(docsPublic))
}

// Plugin assets (public, before auth — sandbox iframes need these)
const userPluginsDir = path.join(DATA_DIR, 'plugins')
const bundledPluginsDir = path.join(__dirname, '..', 'plugins')
fs.ensureDirSync(userPluginsDir)
app.use('/api/plugins/:slug/assets', requireValidSlug(), (req, res, next) => {
  const slug = req.params.slug
  const userDir = path.join(userPluginsDir, slug, 'dist')
  const bundledDir = path.join(bundledPluginsDir, slug, 'dist')
  if (fs.existsSync(userDir)) {
    express.static(userDir)(req, res, next)
  } else if (fs.existsSync(bundledDir)) {
    express.static(bundledDir)(req, res, next)
  } else {
    next()
  }
})

// Plugin listing (public, before auth — needed by client plugin loader)
app.get('/api/plugins', async (req, res) => {
  try {
    const plugins = await storage.listPlugins()
    res.json(plugins)
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

app.get('/api/plugins/:slug', async (req, res) => {
  try {
    const plugin = await storage.getPlugin(req.params.slug)
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' })
    res.json(plugin)
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

app.get('/api/plugins/:slug/manifest', async (req, res) => {
  try {
    const plugin = await storage.getPlugin(req.params.slug)
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' })
    res.json(plugin.manifest)
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// Auth: in cloud mode, parses Clerk session and attaches req.userId
// In self-hosted mode, sets req.userId = null (no-op)
authStack().forEach(mw => app.use(mw))

// Signed-in users' account id and plan by Clerk ID, for CACHE_TTL. A plan
// change, from an admin or a Stripe webhook, drops the account's entry.
const provisionCache = new Map()

// User provisioning (cloud mode only): maps Clerk auth ID → internal UUID.
// On first authenticated request, creates a row in the users table.
if (IS_CLOUD) {
  const CACHE_TTL = 5 * 60 * 1000
  let clerkClient = null
  try { clerkClient = require('@clerk/express').clerkClient } catch {}

  app.use(async (req, res, next) => {
    if (!req.userId) return next()
    const clerkId = req.userId
    req.authId = clerkId

    const cached = provisionCache.get(clerkId)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      req.userId = cached.id
      req.userPlan = cached.plan
      return next()
    }

    try {
      const { rows } = await storage.query('SELECT id, plan FROM users WHERE auth_id = $1', [clerkId])
      if (rows.length) {
        provisionCache.set(clerkId, { id: rows[0].id, plan: rows[0].plan, cachedAt: Date.now() })
        req.userId = rows[0].id
        req.userPlan = rows[0].plan
        return next()
      }

      let email = `${clerkId}@auth.local`
      let name = ''
      let avatarUrl = ''
      if (clerkClient) {
        try {
          const cu = await clerkClient.users.getUser(clerkId)
          email = cu.emailAddresses?.[0]?.emailAddress || email
          name = [cu.firstName, cu.lastName].filter(Boolean).join(' ')
          avatarUrl = cu.imageUrl || ''
        } catch (e) { console.error('Clerk user fetch failed:', e.message) }
      }

      const id = uuidv4()
      await storage.query(
        'INSERT INTO users (id, email, name, avatar_url, auth_provider, auth_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, email, name, avatarUrl, 'clerk', clerkId]
      )
      provisionCache.set(clerkId, { id, plan: 'free', cachedAt: Date.now() })
      req.userId = id
      req.userPlan = 'free'
    } catch (err) {
      console.error('User provisioning error:', err.message)
      return res.status(500).json({ error: 'User provisioning failed' })
    }
    next()
  })
}

// Guest mode: try the editor without an account. A guest session and all of
// its files are deleted when its tab closes or after GUEST_IDLE_HOURS idle.
if (IS_CLOUD) {
  app.get('/api/guest/config', (req, res) => {
    const enabled = isGuestModeEnabled()
    res.json({ enabled, turnstileSiteKey: enabled ? process.env.TURNSTILE_SITE_KEY : null, idleHours: GUEST_IDLE_HOURS })
  })

  app.post('/api/guest', guestCreateLimiter, async (req, res) => {
    if (!isGuestModeEnabled()) return res.status(404).json({ error: 'Guest mode is not available' })
    try {
      const ok = await verifyTurnstile(req.body?.turnstileToken, req.get('CF-Connecting-IP') || req.ip)
      if (!ok) return res.status(403).json({ error: 'Verification failed. Please try again.' })
      res.status(201).json(await createGuestSession(storage))
    } catch (err) {
      console.error('Guest session error:', err.message)
      res.status(500).json({ error: 'Could not start a guest session' })
    }
  })

  // Sent with navigator.sendBeacon when the tab closes, which can't set
  // headers, so the token comes as the plain-text body.
  app.post('/api/guest/close', express.text(), async (req, res) => {
    try {
      if (typeof req.body === 'string' && req.body) await closeGuestSession(storage, req.body)
      res.status(204).end()
    } catch (err) {
      res.status(500).end()
    }
  })

  app.use(guestAuth(storage))

  app.post('/api/guest/resume', async (req, res) => {
    if (!req.isGuest) return res.status(401).json({ error: 'This guest session has ended.', code: 'guest_expired' })
    try {
      const { rows } = await storage.query(
        'SELECT id FROM presentations WHERE user_id = $1 AND is_template = false ORDER BY created_at LIMIT 1',
        [req.userId]
      )
      res.json({ presentationId: rows[0]?.id || null, idleHours: GUEST_IDLE_HOURS })
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) })
    }
  })

  // Recorded as activity by guestAuth; nothing else to do
  app.post('/api/guest/activity', (req, res) => res.status(204).end())
}

// GET /api/plans — the listed plans, for pricing and upgrade options, each
// marked purchasable when billing is on and it has a Stripe price. Public, so
// it can be shown before anyone signs in.
if (IS_CLOUD) {
  app.get('/api/plans', (req, res) => {
    const billing = stripeService.isEnabled()
    res.json({
      billing,
      plans: listPlans().filter(p => p.public).map(p => {
        const { stripePriceId, public: _public, sortOrder, ...shown } = planJSON(p)
        return { ...shown, purchasable: billing && !!stripePriceId }
      }),
    })
  })
}

// Protect all /api routes in cloud mode, but for the slide feed of a live
// session, which its audience follows without signing in
const LIVE_FEED = /^\/live\/[^/]+\/(stream|status)$/
app.use('/api', (req, res, next) => (LIVE_FEED.test(req.path) ? next() : requireUser(req, res, next)))
app.use('/api', apiLimiter)

// Plan quota check helper
// Templates and saved versions are whole decks kept in the database (up to
// 10 MB each), outside the storage a plan counts, so each has a number limit
// on every plan. The most anyone had on 2026-09-27 was one template and no
// versions.
const MAX_TEMPLATES = 20
const MAX_VERSIONS = 50

// Whether `sql` (with `params`) counts fewer than `limit`; else answers 403
async function belowLimit(res, sql, params, limit, message) {
  if (!storage.query) return true
  const { rows } = await storage.query(sql, params)
  if (rows[0].count < limit) return true
  res.status(403).json({ error: 'limit_reached', message, limit, current: rows[0].count })
  return false
}
const belowTemplateLimit = (req, res) => belowLimit(res,
  'SELECT COUNT(*)::int AS count FROM presentations WHERE user_id = $1 AND is_template = true', [req.userId],
  MAX_TEMPLATES, `You can keep up to ${MAX_TEMPLATES} templates. Delete one to save another.`)

async function checkPresentationQuota(req, res) {
  if (!IS_CLOUD || !req.userId) return true
  const limits = planFor(req.userPlan)
  if (limits.maxPresentations === Infinity) return true
  const { rows } = await storage.query(
    'SELECT COUNT(*)::int as count FROM presentations WHERE user_id = $1 AND is_template = false AND (expires_at IS NULL OR expires_at > NOW())',
    [req.userId]
  )
  if (rows[0].count >= limits.maxPresentations) {
    res.status(403).json({
      error: 'presentation_limit_reached',
      message: limits.id === 'guest'
        ? 'Guest mode is limited to one presentation.'
        : `The ${limits.name} plan is limited to ${limits.maxPresentations} presentations.`,
      limit: limits.maxPresentations, current: rows[0].count,
    })
    return false
  }
  return true
}

// GET /api/me — returns user plan and usage
app.get('/api/me', async (req, res) => {
  if (!IS_CLOUD) return res.json({ plan: null, presentationCount: 0, limits: null })
  try {
    const limits = planFor(req.userPlan)
    const { rows } = await storage.query(
      'SELECT COUNT(*)::int as count FROM presentations WHERE user_id = $1 AND is_template = false AND (expires_at IS NULL OR expires_at > NOW())',
      [req.userId]
    )
    res.json({
      plan: limits.id,
      planName: limits.name,
      presentationCount: rows[0].count,
      storageUsed: await storageUsedBytes(storage, req.userId),
      limits: {
        maxPresentations: limits.maxPresentations === Infinity ? null : limits.maxPresentations,
        expirationDays: limits.expirationDays,
        storageBytes: limits.storageBytes,
        maxFileBytes: limits.maxFileBytes,
      },
      billing: stripeService.isEnabled(),
      isAdmin: isAdmin(req),
    })
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// GET /api/admin/overview — sign-ups, per-user storage and processing, and
// container CPU/memory. Not found for anyone who isn't an admin.
app.get('/api/admin/overview', async (req, res) => {
  if (!isAdmin(req)) return res.status(404).json({ error: 'Not found' })
  try {
    res.json({ ...await getAdminOverview(storage, PLAN_LIMITS), billingEnabled: stripeService.isEnabled() })
  } catch (err) {
    console.error('Admin overview error:', err.message)
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/admin/guest-sessions/end-all — ends every guest session and
// deletes its work. Not found for anyone who isn't an admin.
app.post('/api/admin/guest-sessions/end-all', async (req, res) => {
  if (!IS_CLOUD || !isAdmin(req)) return res.status(404).json({ error: 'Not found' })
  try {
    const result = await endAllGuestSessions(storage)
    console.log(`Admin ended ${result.ended} guest sessions`)
    res.json(result)
  } catch (err) {
    console.error('End guest sessions error:', err.message)
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/admin/users/:id/plan — puts an account on another plan, given as
// { plan }. Not found for anyone who isn't an admin.
app.post('/api/admin/users/:id/plan', async (req, res) => {
  if (!IS_CLOUD || !isAdmin(req)) return res.status(404).json({ error: 'Not found' })
  if (!isValidUUID(req.params.id)) return res.status(400).json({ error: 'Invalid id' })
  const plan = req.body?.plan
  if (!assignablePlans().includes(plan)) return res.status(400).json({ error: 'Unknown plan' })
  try {
    const result = await setUserPlan(storage, PLAN_LIMITS, req.params.id, plan)
    if (!result) return res.status(404).json({ error: 'Account not found' })
    // Their next request reads the new plan instead of the cached one
    if (result.authId) provisionCache.delete(result.authId)
    console.log(`Admin moved account ${req.params.id} from ${result.previousPlan} to ${plan}`)
    res.json({ previousPlan: result.previousPlan, plan, hasSubscription: result.hasSubscription, unexpired: result.unexpired })
  } catch (err) {
    console.error('Plan change error:', err.message)
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// Plans: POST /api/admin/plans adds one, PUT /api/admin/plans/:id saves one
// and DELETE /api/admin/plans/:id removes one no account is on. Not found for
// anyone who isn't an admin.
function planRoute(handler) {
  return async (req, res) => {
    if (!IS_CLOUD || !isAdmin(req)) return res.status(404).json({ error: 'Not found' })
    try {
      await handler(req, res)
    } catch (err) {
      if (err instanceof PlanError) return res.status(err.status).json({ error: err.message })
      console.error('Plan edit error:', err.message)
      res.status(500).json({ error: safeErrorMessage(err) })
    }
  }
}

app.post('/api/admin/plans', planRoute(async (req, res) => {
  const plan = await createPlan(storage, req.body || {})
  console.log(`Admin added plan ${plan.id}`)
  res.status(201).json({ plan: planJSON(plan) })
}))

app.put('/api/admin/plans/:id', planRoute(async (req, res) => {
  const { plan, unexpired } = await updatePlan(storage, req.params.id, req.body || {})
  console.log(`Admin saved plan ${plan.id}${unexpired ? `; ${unexpired} presentations stopped expiring` : ''}`)
  res.json({ plan: planJSON(plan), unexpired })
}))

app.delete('/api/admin/plans/:id', planRoute(async (req, res) => {
  await deletePlan(storage, req.params.id)
  console.log(`Admin deleted plan ${req.params.id}`)
  res.json({ success: true })
}))

// ---- Billing API ----
if (IS_CLOUD && stripeService.isEnabled()) {
  // Body: { plan }, one of the plans for sale
  app.post('/api/billing/checkout', authLimiter, requireUser, async (req, res) => {
    try {
      const plan = purchasablePlans().find(p => p.id === req.body?.plan)
      if (!plan) return res.status(400).json({ error: 'That plan isn’t for sale' })
      if (plan.id === req.userPlan) return res.status(400).json({ error: 'You’re already on that plan' })
      const { rows } = await storage.query('SELECT email, name FROM users WHERE id = $1', [req.userId])
      if (!rows[0]) return res.status(404).json({ error: 'User not found' })
      const baseUrl = req.headers.origin || 'https://parallax-presentations.com'
      const session = await stripeService.createCheckoutSession(
        storage, req.userId, rows[0].email, rows[0].name, plan,
        `${baseUrl}/dashboard?billing=success`,
        `${baseUrl}/dashboard?billing=cancel`
      )
      res.json({ url: session.url })
    } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
  })

  app.post('/api/billing/portal', requireUser, async (req, res) => {
    try {
      const session = await stripeService.createPortalSession(storage, req.userId)
      res.json({ url: session.url })
    } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
  })

  app.get('/api/billing/status', requireUser, async (req, res) => {
    try {
      const status = await stripeService.getSubscriptionStatus(storage, req.userId)
      res.json(status)
    } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
  })

  app.post('/api/billing/cancel', requireUser, async (req, res) => {
    try {
      const result = await stripeService.cancelSubscription(storage, req.userId)
      res.json(result)
    } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
  })

  app.post('/api/billing/resume', requireUser, async (req, res) => {
    try {
      await stripeService.resumeSubscription(storage, req.userId)
      res.json({ ok: true })
    } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
  })
}

// Transcode a video file to H.264 MP4 if its codec isn't web-compatible.
// Returns the (possibly new) filename. Deletes the original on success.
const WEB_VIDEO_CODECS = new Set(['h264', 'vp8', 'vp9', 'av1', 'hevc', 'vp08', 'vp09'])
// ffmpeg, LibreOffice and pdftoppm on an uploaded file: in a child process
// the server doesn't wait on (a synchronous one held every request and live
// editing connection until it finished), killed after `timeout`, two at a
// time, and with none of the server's environment (its database, storage and
// sign-in keys), since they parse whatever was uploaded
const TOOL_ENV = { PATH: process.env.PATH, HOME: '/tmp', LANG: 'C.UTF-8' }
const TOOLS_AT_ONCE = 2
let toolsRunning = 0
const toolQueue = []

async function runTool(cmd, args, { timeout }) {
  if (toolsRunning >= TOOLS_AT_ONCE) await new Promise(resolve => toolQueue.push(resolve))
  toolsRunning++
  try {
    return await new Promise((resolve, reject) => {
      execFile(cmd, args, { timeout, killSignal: 'SIGKILL', env: TOOL_ENV, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => err ? reject(err) : resolve(stdout))
    })
  } finally {
    toolsRunning--
    toolQueue.shift()?.()
  }
}

async function videoNeedsTranscode(filePath) {
  try {
    const codec = String(await runTool('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ], { timeout: 30000 })).trim().toLowerCase()
    return !!codec && !WEB_VIDEO_CODECS.has(codec)
  } catch (e) {
    console.error('Video probe error:', e.message)
    return false
  }
}

// Converts an uploaded video if needed, recording the conversion as the
// uploader's processing time
async function convertUploadedVideo(req, filePath) {
  const started = Date.now()
  const converted = await transcodeVideoIfNeeded(filePath)
  if (converted !== filePath) {
    recordUsage(storage, { userId: req.userId, kind: 'video_conversion', durationMs: Date.now() - started, bytes: req.file.size })
  }
  return converted
}

// The video as MP4/H.264, or as it was if it plays already, or if ffmpeg
// fails or takes over 10 minutes
async function transcodeVideoIfNeeded(filePath) {
  if (!await videoNeedsTranscode(filePath)) return filePath
  const dir = path.dirname(filePath)
  const base = path.basename(filePath, path.extname(filePath))
  const outPath = path.join(dir, `${base}.mp4`)
  try {
    await runTool('ffmpeg', [
      '-i', filePath,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      '-y', outPath
    ], { timeout: 10 * 60 * 1000 })
    if (outPath !== filePath) fs.removeSync(filePath)
    return outPath
  } catch (e) {
    console.error('Video transcode error:', e.message)
    if (outPath !== filePath) fs.removeSync(outPath)
    return filePath
  }
}



// A deck's page (share links, live sessions, exports, GitHub and Zenodo), from
// the generator the editor's windows use (services/deck-html.js, built from
// the client's utils/generateHTML.js). Plugin elements get their sandbox page
// from the plugins' folders. opts.notes: false leaves speaker notes out, for
// pages anyone with a link can open; opts.customFonts are the deck's fonts.
function generateRevealHTML(presentation, opts = {}) {
  const pluginSandbox = createSandboxLookup([userPluginsDir, bundledPluginsDir])
  return deckHtml.generateRevealHTML(presentation, { ...opts, pluginSandbox: el => (el.pluginId ? pluginSandbox(el.pluginId) : null) })
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// GET /api/presentations - list summaries
app.get('/api/presentations', async (req, res) => {
  try {
    const excludeExpired = IS_CLOUD && !!planFor(req.userPlan).expirationDays
    const own = await storage.listPresentations(req.userId, { excludeExpired })
    const shared = IS_CLOUD && storage.query && !req.isGuest
      ? await collaboration.listSharedPresentations(storage, req.userId)
      : []
    res.json([...own, ...shared])
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/presentations - create new (optionally from template)
app.post('/api/presentations', async (req, res) => {
  try {
    if (!(await checkPresentationQuota(req, res))) return
    const { title, theme, transition, templateId, slides: providedSlides, ...extraFields } = req.body
    const now = new Date().toISOString()
    let presentation

    if (providedSlides && Array.isArray(providedSlides)) {
      // Create from provided slide data (preset templates)
      presentation = {
        ...extraFields,
        id: uuidv4(),
        title: title || 'Untitled Presentation',
        theme: theme || extraFields.theme || 'black',
        transition: transition || extraFields.transition || 'slide',
        slides: providedSlides.map(s => ({
          ...s,
          id: s.id || uuidv4(),
          elements: (s.elements || []).map(el => ({ ...el, id: el.id || uuidv4() }))
        })),
        createdAt: now,
        updatedAt: now
      }
      delete presentation.isTemplate
      delete presentation.description
      delete presentation.thumbnail
    } else if (templateId) {
      // Create from template
      const template = await storage.getTemplate(templateId, req.userId)
      if (template) {
        const cloned = JSON.parse(JSON.stringify(template))
        presentation = {
          ...cloned,
          id: uuidv4(),
          title: title || cloned.title || 'Untitled Presentation',
          createdAt: now,
          updatedAt: now,
          // New slide and element ids, with the template's links following them
          slides: renewSlideIds(cloned.slides, uuidv4),
        }
        // Remove template-specific fields
        delete presentation.isTemplate
      }
    }

    if (!presentation) {
      presentation = {
        id: uuidv4(),
        title: title || 'Untitled Presentation',
        theme: theme || 'black',
        transition: transition || 'slide',
        slides: [
          {
            id: uuidv4(),
            elements: [{
              id: uuidv4(),
              type: 'text',
              x: 80, y: 160, width: 800, height: 220, zIndex: 1,
              content: '<h2 style="text-align: center">Welcome to your presentation</h2><p style="text-align: center">Double-click to start editing</p>'
            }],
            notes: '',
            background: { type: 'color', color: '#1e1e2e' }
          }
        ],
        createdAt: now,
        updatedAt: now
      }
    }

    const limits = planFor(req.userPlan)
    const expiresAt = limits.expirationDays
      ? new Date(Date.now() + limits.expirationDays * 86400000).toISOString()
      : null
    const created = await storage.createPresentation(presentation, req.userId, expiresAt)
    res.status(201).json(created)
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// --- Templates ---

// GET /api/templates
app.get('/api/templates', async (req, res) => {
  try {
    res.json(await storage.listTemplates(req.userId))
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/templates - create new template
app.post('/api/templates', async (req, res) => {
  try {
    if (!await belowTemplateLimit(req, res)) return
    const template = await storage.createTemplate(req.body, req.userId)
    res.status(201).json(template)
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// GET /api/templates/:id
app.get('/api/templates/:id', requireValidId(), async (req, res) => {
  try {
    const template = await storage.getTemplate(req.params.id, req.userId)
    if (!template) return res.status(404).json({ error: 'Not found' })
    res.json(template)
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// PUT /api/templates/:id
app.put('/api/templates/:id', requireValidId(), async (req, res) => {
  try {
    const updated = await storage.updateTemplate(req.params.id, req.body, req.userId)
    if (!updated) return res.status(404).json({ error: 'Not found' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// DELETE /api/templates/:id
app.delete('/api/templates/:id', requireValidId(), async (req, res) => {
  try {
    const deleted = await storage.deleteTemplate(req.params.id, req.userId)
    if (!deleted) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/presentations/:id/save-as-template
app.post('/api/presentations/:id/save-as-template', requireValidId(), async (req, res) => {
  try {
    if (!await belowTemplateLimit(req, res)) return
    const template = await storage.saveAsTemplate(req.params.id, req.body.title, req.userId)
    if (!template) return res.status(404).json({ error: 'Not found' })
    res.status(201).json(template)
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// GET /api/presentations/:id - get full presentation
app.get('/api/presentations/:id', requireValidId(), deckAccess(), async (req, res) => {
  try {
    const presentation = await storage.getPresentation(req.params.id, req.deck.ownerId)
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    res.json(presentation)
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// PUT /api/presentations/:id - update. A body with the version it was made
// from is refused (409) when someone has saved a newer one since.
app.put('/api/presentations/:id', requireValidId(), deckAccess(), async (req, res) => {
  try {
    const updated = await storage.updatePresentation(req.params.id, req.body, req.deck.ownerId, { baseVersion: req.body?.version })
    if (!updated) return res.status(404).json({ error: 'Not found' })
    if (updated.conflict) {
      return res.status(409).json({ error: 'conflict', message: 'Someone else saved this presentation since your copy was loaded.', version: updated.version })
    }
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// GET /api/presentations/:id/uploads - list uploaded files
app.get('/api/presentations/:id/uploads', requireValidId(), deckAccess(), async (req, res) => {
  try {
    const pres = await storage.getPresentation(req.params.id, req.deck.ownerId)
    if (!pres) return res.status(404).json({ error: 'Not found' })
    const { rows } = await storage.query(
      'SELECT id, filename, content_type, size_bytes, created_at FROM uploads WHERE presentation_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    )
    res.json(rows.map(r => ({
      id: r.id,
      url: `/uploads/${r.filename}`,
      contentType: r.content_type,
      size: r.size_bytes,
      createdAt: r.created_at,
      name: r.filename.split('/').pop(),
    })))
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// GET /api/uploads - list all uploaded files for the current user
app.get('/api/uploads', async (req, res) => {
  try {
    // A duplicated presentation has its own rows for the original's files;
    // list each file once, under the presentation that uploaded it
    const { rows } = await storage.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (u.storage_key)
                u.id, u.filename, u.content_type, u.size_bytes, u.created_at, u.presentation_id,
                p.title as presentation_title
           FROM uploads u
           LEFT JOIN presentations p ON p.id = u.presentation_id
          WHERE u.user_id = $1
          ORDER BY u.storage_key, u.created_at
       ) files
       ORDER BY created_at DESC`,
      [req.userId]
    )
    res.json(rows.map(r => ({
      id: r.id,
      url: `/uploads/${r.filename}`,
      name: r.filename.split('/').pop(),
      contentType: r.content_type,
      size: Number(r.size_bytes || 0),
      createdAt: r.created_at,
      presentationId: r.presentation_id,
      presentationTitle: r.presentation_title || null,
    })))
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// DELETE /api/uploads/:id - delete a single uploaded file
app.delete('/api/uploads/:id', requireValidId(), async (req, res) => {
  try {
    const { rows } = await storage.query(
      'SELECT id, filename, storage_key, size_bytes FROM uploads WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'File not found' })

    if (isR2Enabled()) {
      try { await deleteFromR2(rows[0].storage_key) } catch (e) {
        console.error('R2 delete failed:', e.message)
      }
    } else {
      const localPath = path.join(UPLOADS_DIR, rows[0].storage_key.replace(/^anonymous\//, ''))
      if (fs.existsSync(localPath)) fs.removeSync(localPath)
    }

    // Deleting the file removes it from every presentation that uses it
    await storage.query('DELETE FROM uploads WHERE user_id = $1 AND storage_key = $2', [req.userId, rows[0].storage_key])
    // A font's file: the font goes too, rather than staying listed without it
    if (rows[0].filename.startsWith('fonts/')) {
      await storage.query('DELETE FROM user_fonts WHERE user_id = $1 AND url = $2',
        [req.userId, `/api/fonts/file/${rows[0].filename.slice('fonts/'.length)}`])
    }
    res.json({ success: true, freedBytes: Number(rows[0].size_bytes || 0) })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// --- Datasets ---

// POST /api/datasets — upload a dataset (CSV, JSON, TSV)
app.post('/api/datasets', uploadLimiter, storageQuota, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  try {
    const name = req.body.name || undefined
    const result = await ingestDataset(req.file.path, req.file.originalname, {
      userId: req.userId, storage, localDir: DATA_DIR, keyPrefix: req.guestKeyPrefix,
    })
    if (name) result.name = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    // Uploading under a name already used replaces that dataset: its file
    // goes, or it would stay in storage, counted by no one
    const same = (await storage.listDatasets(req.userId)).find(d => d.name === result.name)
    const replaced = same && await storage.getDataset(same.id, req.userId)
    const ds = await storage.createDataset(result, req.userId)
    if (replaced?.storageKey && replaced.storageKey !== ds.storageKey) {
      deleteDatasetFile(replaced.storageKey, DATA_DIR).catch(e => console.error('Replaced dataset file not deleted:', e.message))
    }
    res.status(201).json(ds)
  } catch (err) {
    if (req.file && req.file.path) fs.removeSync(req.file.path)
    res.status(400).json({ error: err.message })
  }
})

// GET /api/datasets — list user's datasets
app.get('/api/datasets', async (req, res) => {
  try {
    res.json(await storage.listDatasets(req.userId))
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// GET /api/datasets/:id — get dataset metadata
app.get('/api/datasets/:id', requireValidId(), async (req, res) => {
  try {
    const ds = await storage.getDataset(req.params.id, req.userId)
    if (!ds) return res.status(404).json({ error: 'Dataset not found' })
    res.json(ds)
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// GET /api/datasets/:id/data — fetch dataset rows (column-oriented)
app.get('/api/datasets/:id/data', requireValidId(), async (req, res) => {
  try {
    const ds = await storage.getDataset(req.params.id, req.userId)
    if (!ds) return res.status(404).json({ error: 'Dataset not found' })
    const rows = await readDatasetFile(ds.storageKey, ds.format, DATA_DIR)
    const opts = {}
    if (req.query.columns) opts.columns = req.query.columns.split(',')
    if (req.query.limit) opts.limit = parseInt(req.query.limit)
    if (req.query.offset) opts.offset = parseInt(req.query.offset)
    if (req.query.orderBy) opts.orderBy = req.query.orderBy
    if (req.query.where) {
      try { opts.where = JSON.parse(req.query.where) } catch {}
    }
    const result = applyQuery(rows, ds.columns, opts)
    res.json(result)
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// PATCH /api/datasets/:id — rename a dataset
app.patch('/api/datasets/:id', requireValidId(), async (req, res) => {
  try {
    const ds = await storage.updateDataset(req.params.id, { name: req.body.name }, req.userId)
    if (!ds) return res.status(404).json({ error: 'Dataset not found' })
    res.json(ds)
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// DELETE /api/datasets/:id — delete a dataset and its stored file
app.delete('/api/datasets/:id', requireValidId(), async (req, res) => {
  try {
    const ds = await storage.deleteDataset(req.params.id, req.userId)
    if (!ds) return res.status(404).json({ error: 'Dataset not found' })
    try { await deleteDatasetFile(ds.storageKey, DATA_DIR) } catch (e) {
      console.error('Dataset file cleanup failed:', e.message)
    }
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// POST /api/presentations/:pid/datasets — link a dataset to a presentation
// A presentation's datasets are its owner's.
app.post('/api/presentations/:pid/datasets', requireValidId('pid'), deckAccess('pid'), async (req, res) => {
  const { pid } = req.params
  const { datasetId, alias } = req.body
  if (!datasetId) return res.status(400).json({ error: 'datasetId is required' })
  try {
    const pres = await storage.getPresentation(pid, req.deck.ownerId)
    if (!pres) return res.status(404).json({ error: 'Presentation not found' })
    const ds = await storage.getDataset(datasetId, req.deck.ownerId)
    if (!ds) return res.status(404).json({ error: 'Dataset not found' })
    await storage.linkDatasetToPresentation(pid, datasetId, alias)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// Whether the caller may use presentation `pid`'s datasets: deckAccess checks
// editors, but leaves guests (and self-hosted) to storage, and the dataset
// links aren't looked up by owner
const ownsDeck = async (req, pid) => !!(await storage.getPresentation(pid, req.deck.ownerId))

// DELETE /api/presentations/:pid/datasets/:did — unlink a dataset
app.delete('/api/presentations/:pid/datasets/:did', requireValidId('pid'), deckAccess('pid'), async (req, res) => {
  try {
    if (!await ownsDeck(req, req.params.pid)) return res.status(404).json({ error: 'Presentation not found' })
    await storage.unlinkDatasetFromPresentation(req.params.pid, req.params.did)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// GET /api/presentations/:pid/datasets — list datasets linked to a presentation
app.get('/api/presentations/:pid/datasets', requireValidId('pid'), deckAccess('pid'), async (req, res) => {
  try {
    if (!await ownsDeck(req, req.params.pid)) return res.status(404).json({ error: 'Presentation not found' })
    res.json(await storage.getPresentationDatasets(req.params.pid))
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// GET /api/presentations/:pid/datasets/:did/data — fetch data for a linked dataset
// (only a linked one: editors reach the owner's datasets through this)
app.get('/api/presentations/:pid/datasets/:did/data', requireValidId('pid'), deckAccess('pid'), async (req, res) => {
  try {
    if (!await ownsDeck(req, req.params.pid)) return res.status(404).json({ error: 'Presentation not found' })
    const linked = await storage.getPresentationDatasets(req.params.pid)
    if (!linked.some(d => d.id === req.params.did)) return res.status(404).json({ error: 'Dataset not found' })
    const ds = await storage.getDataset(req.params.did, req.deck.ownerId)
    if (!ds) return res.status(404).json({ error: 'Dataset not found' })
    const rows = await readDatasetFile(ds.storageKey, ds.format, DATA_DIR)
    const opts = {}
    if (req.query.columns) opts.columns = req.query.columns.split(',')
    if (req.query.limit) opts.limit = parseInt(req.query.limit)
    if (req.query.offset) opts.offset = parseInt(req.query.offset)
    if (req.query.orderBy) opts.orderBy = req.query.orderBy
    if (req.query.where) {
      try { opts.where = JSON.parse(req.query.where) } catch {}
    }
    const result = applyQuery(rows, ds.columns, opts)
    res.json(result)
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// --- Custom Fonts ---

// GET /api/fonts - list user's custom fonts
app.get('/api/fonts', async (req, res) => {
  try {
    const { rows } = await storage.query(
      'SELECT id, family_name, source, url, created_at FROM user_fonts WHERE user_id = $1 ORDER BY family_name',
      [req.userId]
    )
    res.json(rows.map(r => ({ id: r.id, familyName: r.family_name, source: r.source, url: r.url, createdAt: r.created_at })))
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// POST /api/fonts/upload - upload a TTF/OTF/WOFF font file
app.post('/api/fonts/upload', uploadLimiter, storageQuota, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const ext = path.extname(req.file.originalname).toLowerCase()
    if (!['.ttf', '.otf', '.woff', '.woff2'].includes(ext)) {
      fs.removeSync(req.file.path)
      return res.status(400).json({ error: 'Only TTF, OTF, WOFF, and WOFF2 files are supported' })
    }
    const familyName = req.body.familyName || path.basename(req.file.originalname, ext)

    let fontUrl
    if (isR2Enabled()) {
      const filename = `${uuidv4()}${ext}`
      const storageKey = `fonts/${req.userId}/${filename}`
      const contentType = {
        '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
      }[ext] || 'application/octet-stream'
      const buffer = fs.readFileSync(req.file.path)
      await putBufferToR2(storageKey, buffer, contentType)
      fs.removeSync(req.file.path)
      fontUrl = `/api/fonts/file/${filename}`
      await storage.query(
        'INSERT INTO uploads (presentation_id, user_id, filename, storage_key, content_type, size_bytes) VALUES ($1, $2, $3, $4, $5, $6)',
        [null, req.userId, `fonts/${filename}`, storageKey, contentType, buffer.length]
      )
    } else {
      const fontsDir = path.join(UPLOADS_DIR, 'fonts')
      fs.ensureDirSync(fontsDir)
      const filename = `${uuidv4()}${ext}`
      fs.moveSync(req.file.path, path.join(fontsDir, filename))
      fontUrl = `/uploads/fonts/${filename}`
    }

    const id = uuidv4()
    await storage.query(
      'INSERT INTO user_fonts (id, user_id, family_name, source, url) VALUES ($1, $2, $3, $4, $5)',
      [id, req.userId, familyName, 'upload', fontUrl]
    )
    res.json({ id, familyName, source: 'upload', url: fontUrl })
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// GET /api/fonts/file/:filename - serve uploaded font files from R2
app.get('/api/fonts/file/:filename', async (req, res) => {
  try {
    const filename = req.params.filename
    if (filename.includes('..') || filename.includes('/')) return res.status(400).send('Invalid')
    if (isR2Enabled()) {
      const { rows } = await storage.query(
        "SELECT storage_key, content_type FROM uploads WHERE filename = $1",
        [`fonts/${filename}`]
      )
      if (!rows.length) return res.status(404).send('Not found')
      const { body } = await streamFromR2(rows[0].storage_key)
      setUploadHeaders(res, filename)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      body.pipe(res)
    } else {
      const filePath = path.join(UPLOADS_DIR, 'fonts', filename)
      if (!fs.existsSync(filePath)) return res.status(404).send('Not found')
      setUploadHeaders(res, filename)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.sendFile(filePath)
    }
  } catch (err) { res.status(500).send('Error') }
})

// POST /api/fonts/google - add a Google Font by family name
app.post('/api/fonts/google', async (req, res) => {
  try {
    const { familyName } = req.body
    if (!familyName || typeof familyName !== 'string') return res.status(400).json({ error: 'familyName is required' })
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(familyName)}:wght@100;200;300;400;500;600;700;800;900&display=swap`
    const id = uuidv4()
    await storage.query(
      'INSERT INTO user_fonts (id, user_id, family_name, source, url) VALUES ($1, $2, $3, $4, $5)',
      [id, req.userId, familyName, 'google', url]
    )
    res.json({ id, familyName, source: 'google', url })
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// Deletes an uploaded font's file, found from its URL: /api/fonts/file/<name>
// is in R2 with an uploads row (which is what counts it toward storage), and
// /uploads/fonts/<name> is on disk
async function deleteFontFile(url, userId) {
  const name = path.basename(url || '')
  if (!name) return
  if (url.startsWith('/api/fonts/file/')) {
    const { rows } = await storage.query(
      'DELETE FROM uploads WHERE user_id = $1 AND filename = $2 RETURNING storage_key', [userId, `fonts/${name}`]
    )
    for (const { storage_key } of rows) {
      try { await deleteFromR2(storage_key) } catch (e) { console.error('R2 delete failed:', e.message) }
    }
  } else if (url.startsWith('/uploads/fonts/')) {
    fs.removeSync(path.join(UPLOADS_DIR, 'fonts', name))
  }
}

// DELETE /api/fonts/:id - remove a custom font, and an uploaded one's file
app.delete('/api/fonts/:id', requireValidId(), async (req, res) => {
  try {
    const { rows } = await storage.query(
      'DELETE FROM user_fonts WHERE id = $1 AND user_id = $2 RETURNING source, url', [req.params.id, req.userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Font not found' })
    if (rows[0].source === 'upload') await deleteFontFile(rows[0].url, req.userId)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// DELETE /api/presentations/:id
app.delete('/api/presentations/:id', requireValidId(), async (req, res) => {
  try {
    const deleted = await deletePresentationAndFiles(storage, req.params.id, req.userId)
    if (!deleted) return res.status(404).json({ error: 'Not found' })
    collab?.closeDocument(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/presentations/:id/duplicate
app.post('/api/presentations/:id/duplicate', requireValidId(), async (req, res) => {
  try {
    if (!(await checkPresentationQuota(req, res))) return
    const copy = await storage.duplicatePresentation(req.params.id, req.userId)
    if (!copy) return res.status(404).json({ error: 'Not found' })
    res.status(201).json(copy)
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/upload (legacy global upload)
app.post('/api/upload', uploadLimiter, storageQuota, upload.single('file'), validateUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  try {
    let filePath = req.file.path
    if (req.file.mimetype.startsWith('video/')) {
      if (req.isGuest && await videoNeedsTranscode(filePath)) {
        fs.removeSync(filePath)
        return res.status(415).json({ error: 'Guest mode only accepts web-ready video (MP4/H.264 or WebM). Convert it first or create an account.' })
      }
      filePath = await convertUploadedVideo(req, filePath)
    }
    if (isR2Enabled()) {
      const result = await r2Upload(filePath, req.file.originalname, {
        presentationId: null, userId: req.userId, storage, keyPrefix: req.guestKeyPrefix,
      })
      return res.json(result)
    }
    res.json({ url: `/uploads/${path.basename(filePath)}` })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/presentations/:id/upload (per-presentation upload)
app.post('/api/presentations/:id/upload', requireValidId(), deckAccess(), uploadLimiter, storageQuota, upload.single('file'), validateUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  try {
    const pres = await storage.getPresentation(req.params.id, req.deck.ownerId)
    if (!pres) { fs.removeSync(req.file.path); return res.status(404).json({ error: 'Not found' }) }
    let filePath = req.file.path
    if (req.file.mimetype.startsWith('video/')) {
      if (req.isGuest && await videoNeedsTranscode(filePath)) {
        fs.removeSync(filePath)
        return res.status(415).json({ error: 'Guest mode only accepts web-ready video (MP4/H.264 or WebM). Convert it first or create an account.' })
      }
      filePath = await convertUploadedVideo(req, filePath)
    }
    if (isR2Enabled()) {
      const result = await r2Upload(filePath, req.file.originalname, {
        presentationId: req.params.id, userId: req.deck.ownerId, storage, keyPrefix: req.guestKeyPrefix,
      })
      return res.json(result)
    }
    res.json({ url: `/uploads/${req.params.id}/${path.basename(filePath)}` })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/presentations/:id/import-pptx — convert PPTX to per-slide PNG images
app.post('/api/presentations/:id/import-pptx', requireValidId(), deckAccess(), uploadLimiter, storageQuota, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const pres = await storage.getPresentation(req.params.id, req.deck.ownerId)
  if (!pres) { fs.removeSync(req.file.path); return res.status(404).json({ error: 'Not found' }) }
  const tmpDir = path.join(os.tmpdir(), uuidv4())
  try {
    fs.ensureDirSync(tmpDir)
    const pptxPath = path.join(tmpDir, 'presentation.pptx')
    fs.moveSync(req.file.path, pptxPath)
    const started = Date.now()

    // Convert PPTX → PDF
    await runTool('libreoffice', [
      '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', tmpDir, pptxPath
    ], { timeout: 120000 })

    const pdfPath = path.join(tmpDir, 'presentation.pdf')
    if (!fs.existsSync(pdfPath)) throw new Error('LibreOffice PDF conversion failed')

    // Convert PDF pages → PNG images at 150 dpi
    await runTool('pdftoppm', ['-r', '150', '-png', pdfPath, path.join(tmpDir, 'slide')], { timeout: 120000 })
    recordUsage(storage, { userId: req.userId, kind: 'powerpoint_import', durationMs: Date.now() - started, bytes: req.file.size })

    const pngFiles = fs.readdirSync(tmpDir)
      .filter(f => /^slide-?\d+\.png$/.test(f))
      .sort((a, b) => {
        const n = s => parseInt(s.match(/(\d+)/)[1])
        return n(a) - n(b)
      })

    // The slide images can be much bigger than the file: they have to fit in
    // the storage left on the owner's plan, as the file had to
    if (isR2Enabled() && storage.query) {
      const plan = planFor(req.deck.role === 'owner' ? req.userPlan : req.deck.ownerPlan)
      const bytes = pngFiles.reduce((sum, f) => sum + fs.statSync(path.join(tmpDir, f)).size, 0)
      if (plan.storageBytes && await storageUsedBytes(storage, req.deck.ownerId) + bytes > plan.storageBytes) {
        return res.status(413).json({ error: `The slides as images (${Math.round(bytes / (1024 * 1024))} MB) don't fit in the storage left on the ${plan.name} plan.` })
      }
    }

    if (isR2Enabled()) {
      const urls = []
      for (const f of pngFiles) {
        const result = await r2Upload(path.join(tmpDir, f), f, {
          presentationId: req.params.id, userId: req.deck.ownerId, storage,
        })
        urls.push(result.url)
      }
      res.json({ urls })
    } else {
      const uploadDir = path.join(UPLOADS_DIR, req.params.id)
      fs.ensureDirSync(uploadDir)
      const urls = pngFiles.map(f => {
        const id = uuidv4()
        fs.copySync(path.join(tmpDir, f), path.join(uploadDir, `${id}.png`))
        return `/uploads/${req.params.id}/${id}.png`
      })
      res.json({ urls })
    }
  } catch (err) {
    console.error('PPTX import error:', err.message)
    res.status(500).json({ error: safeErrorMessage(err) })
  } finally {
    fs.removeSync(tmpDir)
  }
})

// GET /api/presentations/:id/export - download HTML
app.get('/api/presentations/:id/export', requireValidId(), deckAccess(), async (req, res) => {
  try {
    const presentation = await storage.getPresentation(req.params.id, req.deck.ownerId)
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    const html = generateRevealHTML(presentation)
    const filename = `${(presentation.title || 'presentation').replace(/[^a-z0-9]/gi, '_')}.html`
    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(html)
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// A page built from a deck, in a sandbox. A deck runs its author's code (HTML
// embeds, and anything in its text), so its page gets an origin of its own,
// null: it can't read this site's cookies or storage, or use the API as
// whoever opened it. Links and web page actions open outside the sandbox.
const DECK_PAGE_SANDBOX = 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads allow-pointer-lock'
function sendDeckPage(res, html) {
  res.setHeader('Content-Type', 'text/html')
  res.setHeader('Content-Security-Policy', DECK_PAGE_SANDBOX)
  res.send(html)
}

// GET /api/presentations/:id/present - serve in browser
app.get('/api/presentations/:id/present', requireValidId(), deckAccess(), async (req, res) => {
  try {
    const presentation = await storage.getPresentation(req.params.id, req.deck.ownerId)
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    sendDeckPage(res, localizeLibraries(generateRevealHTML(presentation)))
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// --- Share Links ---

// Share links and live presenting are for the cloud version. Self-hosted, the
// editor has no sign-in, so anyone who could open a link could already open
// every presentation; and at localhost, nobody else can open one anyway.
if (!IS_CLOUD) {
  app.use(['/share', '/live', '/api/live', '/api/presentations/:id/share', '/api/presentations/:id/live',
    '/api/invites', '/api/presentations/:id/collaborators', '/api/presentations/:id/invite'],
    (req, res) => res.status(404).json({ error: 'Not available in the self-hosted version' }))
}

// Helper: read/write share tokens


// POST /api/presentations/:id/share - enable sharing, return token
app.post('/api/presentations/:id/share', requireValidId(), async (req, res) => {
  try {
    const result = await storage.createShareToken(req.params.id, req.userId)
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// DELETE /api/presentations/:id/share - disable sharing
app.delete('/api/presentations/:id/share', requireValidId(), async (req, res) => {
  try {
    res.json(await storage.deleteShareToken(req.params.id, req.userId))
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// GET /api/presentations/:id/share - get share status
app.get('/api/presentations/:id/share', requireValidId(), async (req, res) => {
  try {
    res.json(await storage.getShareStatus(req.params.id, req.userId))
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// GET /share/:token - public view of shared presentation
// --- Editing with others (cloud only; see services/collaboration.js) ---

// GET /api/presentations/:id/collaborators - the owner and editors, the
// caller's role and id, and for the owner, the invite link's token
app.get('/api/presentations/:id/collaborators', requireValidId(), deckAccess(), async (req, res) => {
  try {
    let people = await collaboration.listCollaborators(storage, req.params.id)
    const inviteToken = req.deck.role === 'owner' ? await collaboration.getInviteToken(storage, req.params.id) : null
    // Editors may not know each other (anyone with the invite link can join):
    // they see the owner's email and their own, and only a hint of the rest
    if (req.deck.role !== 'owner') {
      people = people.map(p => (p.role === 'owner' || p.id === req.userId ? p : { ...p, email: collaboration.emailHint(p.email) }))
    }
    res.json({ role: req.deck.role, you: req.userId, people, inviteToken })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/presentations/:id/invite - turn the invite link on, with a new
// token; a link given out before stops working
app.post('/api/presentations/:id/invite', requireValidId(), deckAccess(), ownerOnly, async (req, res) => {
  try {
    res.json({ inviteToken: await collaboration.setInviteToken(storage, req.params.id, true) })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// DELETE /api/presentations/:id/invite - turn the invite link off
app.delete('/api/presentations/:id/invite', requireValidId(), deckAccess(), ownerOnly, async (req, res) => {
  try {
    res.json({ inviteToken: await collaboration.setInviteToken(storage, req.params.id, false) })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// DELETE /api/presentations/:id/collaborators/:userId - the owner removes an
// editor, or an editor leaves
app.delete('/api/presentations/:id/collaborators/:userId', requireValidId(), requireValidId('userId'), deckAccess(), async (req, res) => {
  if (req.deck.role !== 'owner' && req.params.userId !== req.userId) {
    return res.status(403).json({ error: 'Only the owner can remove other editors' })
  }
  try {
    if (!(await collaboration.removeCollaborator(storage, req.params.id, req.params.userId))) {
      return res.status(404).json({ error: 'Not an editor of this presentation' })
    }
    collab?.disconnectUser(req.params.id, req.params.userId)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// GET /api/invites/:token - the presentation an invite link is for
app.get('/api/invites/:token', requireValidId('token'), async (req, res) => {
  try {
    const invite = await collaboration.describeInvite(storage, req.params.token, req.userId)
    if (!invite) return res.status(404).json({ error: 'This invite link has been turned off or replaced.' })
    res.json(invite)
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/invites/:token/accept - become an editor of that presentation
app.post('/api/invites/:token/accept', requireValidId('token'), async (req, res) => {
  try {
    const joined = await collaboration.acceptInvite(storage, req.params.token, req.userId)
    if (!joined) return res.status(404).json({ error: 'This invite link has been turned off or replaced.' })
    res.json(joined)
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

app.get('/share/:token', deckPageLimiter, requireValidId('token'), async (req, res) => {
  try {
    const presentation = await storage.getSharedPresentation(req.params.token)
    if (!presentation) return res.status(404).send('Presentation not found or sharing disabled')

    sendDeckPage(res, localizeLibraries(generateRevealHTML(presentation, { notes: false })))
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// --- Live Sessions ---

const liveSessions = new Map()

// Anyone with the code can watch, so it comes from crypto, not Math.random
function generateSessionCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[crypto.randomInt(chars.length)]
  return code
}

// POST /api/presentations/:id/live/start
app.post('/api/presentations/:id/live/start', requireValidId(), async (req, res) => {
  try {
    const presentation = await storage.getPresentation(req.params.id, req.userId)
    if (!presentation) return res.status(404).json({ error: 'Not found' })

    let sessionId
    do { sessionId = generateSessionCode() } while (liveSessions.has(sessionId))

    liveSessions.set(sessionId, {
      presentationId: req.params.id,
      userId: req.userId,
      currentSlide: 0,
      unlockedSlides: new Set([0]),
      viewers: new Set(),
      startedAt: Date.now(),
    })

    res.json({ sessionId, url: `/live/${sessionId}` })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/presentations/:id/live/stop
app.post('/api/presentations/:id/live/stop', requireValidId(), async (req, res) => {
  const { sessionId } = req.body
  const session = liveSessions.get(sessionId)
  if (!session || session.userId !== req.userId) return res.status(404).json({ error: 'Session not found' })

  for (const viewer of session.viewers) {
    viewer.write(`data: ${JSON.stringify({ type: 'ended' })}\n\n`)
    viewer.end()
  }
  liveSessions.delete(sessionId)
  res.json({ ok: true })
})

// POST /api/live/:sessionId/slide — presenter updates current slide. Only
// whoever started the session: its code is given to the audience
app.post('/api/live/:sessionId/slide', async (req, res) => {
  const session = liveSessions.get(req.params.sessionId)
  if (!session || session.userId !== req.userId) return res.status(404).json({ error: 'Session not found' })

  const { flatIndex } = req.body
  if (!Number.isInteger(flatIndex) || flatIndex < 0) return res.status(400).json({ error: 'flatIndex required' })

  session.currentSlide = flatIndex
  session.unlockedSlides.add(flatIndex)

  const msg = JSON.stringify({
    type: 'slide',
    currentSlide: flatIndex,
    unlocked: [...session.unlockedSlides].sort((a, b) => a - b),
  })
  for (const viewer of session.viewers) {
    viewer.write(`data: ${msg}\n\n`)
  }

  res.json({ ok: true, viewers: session.viewers.size })
})

// GET /api/live/:sessionId/stream — SSE for viewers
app.get('/api/live/:sessionId/stream', (req, res) => {
  const session = liveSessions.get(req.params.sessionId)
  if (!session) return res.status(404).json({ error: 'Session not found' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  session.viewers.add(res)

  const initMsg = JSON.stringify({
    type: 'init',
    currentSlide: session.currentSlide,
    unlocked: [...session.unlockedSlides].sort((a, b) => a - b),
    viewers: session.viewers.size,
  })
  res.write(`data: ${initMsg}\n\n`)

  // Broadcast updated viewer count
  const countMsg = JSON.stringify({ type: 'viewers', count: session.viewers.size })
  for (const v of session.viewers) { if (v !== res) v.write(`data: ${countMsg}\n\n`) }

  req.on('close', () => {
    session.viewers.delete(res)
    const dcMsg = JSON.stringify({ type: 'viewers', count: session.viewers.size })
    for (const v of session.viewers) v.write(`data: ${dcMsg}\n\n`)
  })
})

// GET /api/live/:sessionId/status — check if session exists
app.get('/api/live/:sessionId/status', (req, res) => {
  const session = liveSessions.get(req.params.sessionId)
  if (!session) return res.status(404).json({ error: 'Session not found' })
  res.json({ viewers: session.viewers.size, currentSlide: session.currentSlide })
})

// GET /live/:sessionId — serve viewer page (public, no auth)
app.get('/live/:id', deckPageLimiter, async (req, res) => {
  const session = liveSessions.get(req.params.id)
  if (!session) return res.status(404).send('Live session not found or has ended.')

  try {
    const presentation = await storage.getPresentation(session.presentationId, session.userId)
    if (!presentation) return res.status(404).send('Presentation not found')

    const baseHtml = localizeLibraries(generateRevealHTML(presentation, { notes: false }))
    const liveScript = `
    <script>
    // ── Live session viewer ──────────────────────────────────
    (function() {
      var sessionId = '${req.params.id}';
      var unlocked = new Set([0]);
      var maxUnlocked = 0;
      var badge = document.createElement('div');
      badge.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;background:rgba(34,197,94,0.9);color:white;padding:6px 12px;border-radius:20px;font-family:-apple-system,sans-serif;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;backdrop-filter:blur(4px);pointer-events:none;transition:background 0.3s;';
      badge.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:white;display:inline-block"></span> LIVE';
      document.body.appendChild(badge);

      var es = new EventSource('/api/live/' + sessionId + '/stream');

      es.onmessage = function(e) {
        var data = JSON.parse(e.data);
        if (data.type === 'init' || data.type === 'slide') {
          data.unlocked.forEach(function(i) { unlocked.add(i); });
          maxUnlocked = Math.max.apply(null, Array.from(unlocked));
          if (data.type === 'init') {
            // Join on the presenter's slide, once the deck is ready
            var join = function() { var at = flatToHV(data.currentSlide); Reveal.slide(at.h, at.v); };
            if (Reveal.isReady()) join(); else Reveal.on('ready', join);
          }
        }
        if (data.type === 'ended') {
          badge.style.background = 'rgba(100,100,100,0.8)';
          badge.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#999;display:inline-block"></span> ENDED';
          es.close();
        }
      };

      es.onerror = function() {
        badge.style.background = 'rgba(239,68,68,0.9)';
        badge.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:white;display:inline-block"></span> RECONNECTING';
      };

      // Build flat→(h,v) map after Reveal is ready
      var flatMap = [];
      Reveal.on('ready', function() {
        var slides = Reveal.getSlides();
        slides.forEach(function(s) {
          flatMap.push(Reveal.getIndices(s));
        });
      });

      function flatToHV(fi) {
        if (flatMap[fi]) return flatMap[fi];
        return { h: fi, v: 0 };
      }

      function currentFlat() {
        var idx = Reveal.getIndices();
        for (var i = 0; i < flatMap.length; i++) {
          if (flatMap[i].h === idx.h && flatMap[i].v === idx.v) return i;
        }
        return 0;
      }

      // Intercept navigation — block forward past unlocked
      Reveal.on('slidechanged', function(e) {
        var fi = currentFlat();
        if (fi > maxUnlocked) {
          var target = flatMap[maxUnlocked] || { h: 0, v: 0 };
          Reveal.slide(target.h, target.v);
        }
      });
    })();
    <\/script>`

    const lastBodyIdx = baseHtml.lastIndexOf('</body>')
    const html = lastBodyIdx >= 0
      ? baseHtml.slice(0, lastBodyIdx) + liveScript + '\n</body>' + baseHtml.slice(lastBodyIdx + 7)
      : baseHtml + liveScript
    sendDeckPage(res, html)
  } catch (err) {
    res.status(500).send('Error loading presentation')
  }
})

// --- Version History ---

// POST /api/presentations/:id/snapshot
app.post('/api/presentations/:id/snapshot', requireValidId(), deckAccess(), async (req, res) => {
  try {
    if (!await belowLimit(res, 'SELECT COUNT(*)::int AS count FROM snapshots WHERE presentation_id = $1', [req.params.id],
      MAX_VERSIONS, `A presentation can keep up to ${MAX_VERSIONS} saved versions. Delete one in History to save another.`)) return
    const result = await storage.createSnapshot(req.params.id, req.body.name, req.deck.ownerId)
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.json(result)
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// GET /api/presentations/:id/snapshots - list snapshots
app.get('/api/presentations/:id/snapshots', requireValidId(), deckAccess(), async (req, res) => {
  try {
    res.json(await storage.listSnapshots(req.params.id, req.deck.ownerId))
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// POST /api/presentations/:id/restore/:snapshotId - restore a snapshot
app.post('/api/presentations/:id/restore/:snapshotId', requireValidId(), requireValidId('snapshotId'), deckAccess(), async (req, res) => {
  try {
    const restored = await storage.restoreSnapshot(req.params.id, req.params.snapshotId, req.deck.ownerId)
    if (!restored) return res.status(404).json({ error: 'Snapshot or presentation not found' })
    res.json(restored)
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// DELETE /api/presentations/:id/snapshots/:snapshotId - the owner only: an
// editor could otherwise delete every version, leaving nothing to restore
app.delete('/api/presentations/:id/snapshots/:snapshotId', requireValidId(), requireValidId('snapshotId'), deckAccess(), ownerOnly, async (req, res) => {
  try {
    await storage.deleteSnapshot(req.params.id, req.params.snapshotId, req.deck.ownerId)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// GET /api/presentations/:id/snapshots/:snapshotId/data - get snapshot data without restoring
app.get('/api/presentations/:id/snapshots/:snapshotId/data', requireValidId(), requireValidId('snapshotId'), deckAccess(), async (req, res) => {
  try {
    const data = await storage.getSnapshotData(req.params.id, req.params.snapshotId, req.deck.ownerId)
    if (!data) return res.status(404).json({ error: 'Snapshot not found' })
    res.json(data)
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// --- GitHub Integration ---

// GET /api/github/config - get saved config (token is masked)
app.get('/api/github/config', async (req, res) => {
  try {
    const config = await storage.getGithubConfig(req.userId)
    res.json({ owner: config.owner || '', repo: config.repo || '', hasToken: !!config.token, pagesUrl: config.pagesUrl || '' })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/github/config - save config
app.post('/api/github/config', async (req, res) => {
  try {
    const updated = await storage.setGithubConfig(req.body, req.userId)
    res.json({ owner: updated.owner || '', repo: updated.repo || '', hasToken: !!updated.token, pagesUrl: updated.pagesUrl || '' })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// GET /api/zotero/config - get saved Zotero config (key is masked)
app.get('/api/zotero/config', async (req, res) => {
  try {
    const config = await storage.getZoteroConfig(req.userId)
    res.json({ zoteroUserId: config.zoteroUserId || '', hasApiKey: !!config.apiKey })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/zotero/config - save Zotero credentials
app.post('/api/zotero/config', async (req, res) => {
  try {
    await storage.setZoteroConfig(req.body, req.userId)
    res.json({ zoteroUserId: req.body.zoteroUserId || '', hasApiKey: !!req.body.apiKey })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// DELETE /api/zotero/config - disconnect Zotero
app.delete('/api/zotero/config', async (req, res) => {
  try {
    await storage.setZoteroConfig({ zoteroUserId: '', apiKey: '' }, req.userId)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// GET /api/zotero/proxy/* - proxy requests to Zotero API with stored credentials
app.get('/api/zotero/proxy/*', async (req, res) => {
  try {
    const config = await storage.getZoteroConfig(req.userId)
    if (!config.apiKey || !config.zoteroUserId) {
      return res.status(400).json({ error: 'Zotero not configured' })
    }
    // Only the user's own collections and items, as the bibliography asks
    // for them, and only as JSON: the path arrives decoded (..%2f reaches
    // other api.zotero.org paths), and Zotero's own type, sent back from
    // this site, could make an attachment a page here
    const zoteroPath = req.params[0]
    if (!/^(collections|items)(\/[A-Za-z0-9]+){0,3}$/.test(zoteroPath)) return res.status(400).json({ error: 'Invalid Zotero path' })
    const qs = new URL(req.url, 'http://localhost').search
    const url = `https://api.zotero.org/users/${encodeURIComponent(config.zoteroUserId)}/${zoteroPath}${qs}`
    const zRes = await fetch(url, {
      headers: { 'Zotero-API-Version': '3', 'Zotero-API-Key': config.apiKey },
      redirect: 'error',
    })
    const body = await zRes.text()
    let data
    try { data = JSON.parse(body) } catch { data = { error: `Zotero answered ${zRes.status}` } }
    res.status(zRes.status)
      .set('Total-Results', zRes.headers.get('total-results') || '0')
      .json(data)
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// --- Zenodo Integration ---

// Publishing to Zenodo is turned off for now; the code stays for when it's
// brought back. Set this to true (and ZENODO_ENABLED in the client's
// EditorPage.jsx) to turn it on again.
const ZENODO_ENABLED = false
if (!ZENODO_ENABLED) {
  app.use(['/api/zenodo', '/api/presentations/:id/zenodo'],
    (req, res) => res.status(404).json({ error: 'Publishing to Zenodo is turned off' }))
}

// GET /api/zenodo/config
app.get('/api/zenodo/config', async (req, res) => {
  try {
    const config = await storage.getZenodoConfig(req.userId)
    res.json({ hasToken: !!config.token, sandbox: config.sandbox })
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// POST /api/zenodo/config
app.post('/api/zenodo/config', async (req, res) => {
  try {
    const updated = await storage.setZenodoConfig(req.body, req.userId)
    res.json({ hasToken: !!updated.token, sandbox: updated.sandbox })
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// DELETE /api/zenodo/config
app.delete('/api/zenodo/config', async (req, res) => {
  try {
    await storage.setZenodoConfig({ token: '', sandbox: false }, req.userId)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// GET /api/presentations/:id/zenodo/status - check if this presentation has been published
app.get('/api/presentations/:id/zenodo/status', requireValidId(), async (req, res) => {
  try {
    const { rows } = await storage.query(
      'SELECT deposition_id, doi, zenodo_url, sandbox, published_at, concept_recid FROM zenodo_publications WHERE presentation_id = $1 AND user_id = $2 ORDER BY published_at DESC LIMIT 1',
      [req.params.id, req.userId]
    )
    if (!rows.length) return res.json({ published: false })
    const { rows: allVersions } = await storage.query(
      'SELECT doi, zenodo_url, published_at FROM zenodo_publications WHERE presentation_id = $1 AND user_id = $2 ORDER BY published_at DESC',
      [req.params.id, req.userId]
    )
    res.json({
      published: true,
      depositionId: rows[0].deposition_id,
      conceptRecid: rows[0].concept_recid,
      doi: rows[0].doi,
      url: rows[0].zenodo_url,
      sandbox: rows[0].sandbox,
      publishedAt: rows[0].published_at,
      versionCount: allVersions.length,
      versions: allVersions,
    })
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// POST /api/presentations/:id/zenodo/publish - publish presentation to Zenodo
app.post('/api/presentations/:id/zenodo/publish', requireValidId(), async (req, res) => {
  try {
    const config = await storage.getZenodoConfig(req.userId)
    if (!config.token) return res.status(400).json({ error: 'Zenodo not configured. Save your API token first.' })

    const stored = await storage.getPresentation(req.params.id, req.userId)
    if (!stored) return res.status(404).json({ error: 'Presentation not found' })
    // Published without its present-mode ink, which is private to the author
    const { annotationSets, ...presentation } = stored

    const { creators, description, keywords, license } = req.body
    if (!creators || !creators.length) return res.status(400).json({ error: 'At least one creator is required' })

    const baseUrl = config.sandbox ? 'https://sandbox.zenodo.org' : 'https://zenodo.org'
    const token = config.token
    const zen = async (endpoint, opts = {}) => {
      const r = await fetch(`${baseUrl}/api${endpoint}`, {
        ...opts,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...opts.headers,
        },
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        let msg = body.message || ''
        if (body.errors) msg += (msg ? ': ' : '') + body.errors.map(e => `${e.field}: ${e.message || e.messages?.join(', ')}`).join('; ')
        throw new Error(msg || JSON.stringify(body) || `Zenodo API ${r.status}`)
      }
      return body
    }

    // 1. Create deposition — new version if previously published, fresh otherwise
    const { rows: prevPubs } = await storage.query(
      'SELECT deposition_id, concept_recid FROM zenodo_publications WHERE presentation_id = $1 AND user_id = $2 AND sandbox = $3 ORDER BY published_at DESC LIMIT 1',
      [req.params.id, req.userId, config.sandbox]
    )
    let deposition, isNewVersion = false
    if (prevPubs.length && prevPubs[0].deposition_id) {
      const prevId = prevPubs[0].deposition_id
      const nvRes = await zen(`/deposit/depositions/${prevId}/actions/newversion`, { method: 'POST' })
      const draftUrl = nvRes.links?.latest_draft
      if (!draftUrl) throw new Error('Zenodo did not return a draft URL for the new version')
      const draftRes = await fetch(draftUrl, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } })
      if (!draftRes.ok) throw new Error(`Failed to fetch new version draft: ${draftRes.status}`)
      deposition = await draftRes.json()
      isNewVersion = true
      // Delete old files from the draft so we can upload fresh ones
      const filesRes = await zen(`/deposit/depositions/${deposition.id}/files`)
      for (const f of (Array.isArray(filesRes) ? filesRes : [])) {
        await fetch(`${baseUrl}/api/deposit/depositions/${deposition.id}/files/${f.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        })
      }
    } else {
      deposition = await zen('/deposit/depositions', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    }
    const depositionId = deposition.id
    const bucketUrl = deposition.links?.bucket

    // Helper: upload a file to the deposition (bucket API with fallback to files API)
    const zenUploadFile = async (filename, buffer, contentType) => {
      if (bucketUrl) {
        const r = await fetch(`${bucketUrl}/${filename}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
          body: buffer,
        })
        if (r.ok) return
        console.error(`Zenodo bucket upload failed for ${filename}: ${r.status} ${await r.text().catch(() => '')}`)
      }
      // Fallback: old files API (multipart form upload)
      const form = new FormData()
      form.set('file', new Blob([buffer], { type: contentType }), filename)
      const r = await fetch(`${baseUrl}/api/deposit/depositions/${depositionId}/files`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      })
      if (!r.ok) {
        const body = await r.text().catch(() => '')
        throw new Error(`File upload failed for ${filename}: ${r.status} ${body}`)
      }
    }

    // 2. Prepare export: rewrite asset paths for self-contained HTML
    const exportPres = JSON.parse(JSON.stringify(presentation))
    const uploadPaths = new Set()
    const collectUploads = (str) => { for (const m of str.matchAll(/\/uploads\/[^\s"'<>)]+/g)) uploadPaths.add(m[0]) }
    for (const slide of presentation.slides || []) {
      for (const el of slide.elements || []) {
        if (el.src && el.src.startsWith('/uploads/')) uploadPaths.add(el.src)
        if (el.poster && el.poster.startsWith('/uploads/')) uploadPaths.add(el.poster)
        if (el.content) collectUploads(el.content)
      }
      if (slide.background?.image?.startsWith('/uploads/')) uploadPaths.add(slide.background.image)
    }

    const assetName = (p) => path.basename(p)
    const rewriteUploads = (str) => str.replace(/\/uploads\/[^\s"'<>)]+/g, m => `./assets/${assetName(m)}`)
    for (const slide of exportPres.slides || []) {
      for (const el of slide.elements || []) {
        if (el.src && el.src.startsWith('/uploads/')) el.src = `./assets/${assetName(el.src)}`
        if (el.poster && el.poster.startsWith('/uploads/')) el.poster = `./assets/${assetName(el.poster)}`
        if (el.content && el.content.includes('/uploads/')) el.content = rewriteUploads(el.content)
      }
      if (slide.background?.image?.startsWith('/uploads/')) slide.background.image = `./assets/${assetName(slide.background.image)}`
    }

    const { rows: userFontRows } = await storage.query(
      'SELECT family_name, source, url FROM user_fonts WHERE user_id = $1', [req.userId]
    ).catch(() => ({ rows: [] }))
    const userFonts = userFontRows.map(r => ({ familyName: r.family_name, source: r.source, url: r.url }))

    let htmlContent = generateRevealHTML(exportPres, { customFonts: userFonts })
    const jsonContent = JSON.stringify(presentation, null, 2)

    // 2b. Inject citation slide with pre-reserved DOI
    const preresDoi = deposition.metadata?.prereserve_doi?.doi || ''
    if (preresDoi) {
      const year = new Date().getFullYear()
      const title = escapeHtml(presentation.title || 'Untitled Presentation')
      const authorNames = creators.map(c => escapeHtml(c.name)).join(' and ')
      const firstAuthorLast = (creators[0]?.name || 'Author').split(',')[0].trim().toLowerCase().replace(/\s+/g, '')
      const bibKey = `${firstAuthorLast}${year}${(presentation.title || 'presentation').split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '')}`
      const doiUrl = `https://doi.org/${preresDoi}`

      const bibtex = [
        `@misc{${bibKey},`,
        `  author    = {${creators.map(c => c.name).join(' and ')}},`,
        `  title     = {${presentation.title || 'Untitled Presentation'}},`,
        `  year      = {${year}},`,
        `  publisher = {Zenodo},`,
        `  doi       = {${preresDoi}},`,
        `  url       = {${doiUrl}}`,
        `}`,
      ].join('\n')

      const slideW = presentation.slideWidth || 960
      const slideH = presentation.slideHeight || 540
      const citationSlide = `
    <section>
      <div style="position:absolute;left:40px;top:30px;width:${slideW - 80}px;height:${slideH - 60}px;overflow:auto;z-index:1">
        <h2 style="font-size:28px;margin:0 0 20px;color:rgba(255,255,255,0.95)">Cite this Presentation</h2>
        <div style="margin-bottom:20px;">
          <div style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:6px;">DOI</div>
          <a href="${doiUrl}" target="_blank" rel="noopener" style="font-size:20px;color:#818cf8;text-decoration:underline;word-break:break-all;">${doiUrl}</a>
        </div>
        <div>
          <div style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:6px;">BibTeX</div>
          <pre style="background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:14px 18px;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.85);font-family:'Fira Code','JetBrains Mono',monospace;overflow-x:auto;white-space:pre;margin:0;">${escapeHtml(bibtex)}</pre>
        </div>
      </div>
    </section>`

      htmlContent = htmlContent.replace(
        '    </div>\n  </div>',
        citationSlide + '\n    </div>\n  </div>'
      )
    }

    // 3. Upload presentation files
    await zenUploadFile('presentation.html', Buffer.from(htmlContent, 'utf8'), 'text/html')
    await zenUploadFile('presentation.json', Buffer.from(jsonContent, 'utf8'), 'application/json')

    // 4. Upload asset files
    for (const uploadPath of uploadPaths) {
      const relativePath = uploadPath.replace(/^\/uploads\//, '')
      try {
        let fileBuffer, contentType = 'application/octet-stream'
        if (isR2Enabled()) {
          const { rows } = await storage.query('SELECT storage_key, content_type FROM uploads WHERE filename = $1', [relativePath])
          if (!rows.length) continue
          contentType = rows[0].content_type || contentType
          const { body } = await streamFromR2(rows[0].storage_key)
          const chunks = []
          for await (const chunk of body) chunks.push(chunk)
          fileBuffer = Buffer.concat(chunks)
        } else {
          const filePath = uploadsFile(relativePath)
          if (!filePath || !fs.existsSync(filePath)) continue
          fileBuffer = fs.readFileSync(filePath)
        }
        await zenUploadFile(`assets_${assetName(uploadPath)}`, fileBuffer, contentType)
      } catch (e) { console.error(`Zenodo asset upload failed for ${uploadPath}:`, e.message) }
    }

    // 6. Set metadata
    const metadata = {
      title: presentation.title || 'Untitled Presentation',
      upload_type: 'presentation',
      description: description || `Presentation created with Parallax.`,
      publication_date: new Date().toISOString().split('T')[0],
      access_right: 'open',
      creators: creators.map(c => {
        const entry = { name: c.name }
        if (c.affiliation) entry.affiliation = c.affiliation
        if (c.orcid) entry.orcid = c.orcid
        return entry
      }),
    }
    if (keywords && keywords.length) metadata.keywords = keywords
    if (license) metadata.license = license

    await zen(`/deposit/depositions/${depositionId}`, {
      method: 'PUT',
      body: JSON.stringify({ metadata }),
    })

    // 7. Publish
    const published = await zen(`/deposit/depositions/${depositionId}/actions/publish`, {
      method: 'POST',
    })

    const doi = published.doi || published.metadata?.doi || ''
    const zenodoUrl = published.links?.html || published.links?.record_html || `${baseUrl}/records/${depositionId}`
    const conceptRecid = published.conceptrecid || published.metadata?.relations?.version?.[0]?.parent?.pid_value || ''

    // 8. Record in database
    await storage.query(
      'INSERT INTO zenodo_publications (presentation_id, user_id, deposition_id, doi, zenodo_url, sandbox, concept_recid) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.params.id, req.userId, depositionId, doi, zenodoUrl, config.sandbox, conceptRecid]
    )

    res.json({ doi, url: zenodoUrl, depositionId, isNewVersion, conceptRecid })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/presentations/:id/github/push - push presentation to GitHub
app.post('/api/presentations/:id/github/push', async (req, res) => {
  try {
    const config = await storage.getGithubConfig(req.userId)
    if (!config.token || !config.owner || !config.repo) {
      return res.status(400).json({ error: 'GitHub not configured. Set token, owner, and repo first.' })
    }

    const stored = await storage.getPresentation(req.params.id, req.userId)
    if (!stored) return res.status(404).json({ error: 'Presentation not found' })
    // Pushed without its present-mode ink, which is private to the author
    const { annotationSets, ...presentation } = stored

    const { token, owner, repo } = config
    const gh = (endpoint, opts = {}) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30000)
      return fetch(`https://api.github.com${endpoint}`, {
        ...opts,
        signal: controller.signal,
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          ...opts.headers,
        },
      }).then(async r => {
        clearTimeout(timer)
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.message || `GitHub API ${r.status}`)
        return body
      }).catch(err => {
        clearTimeout(timer)
        if (err.name === 'AbortError') throw new Error(`GitHub API timeout on ${endpoint}`)
        throw err
      })
    }

    // Folder name from presentation title
    const folderName = (presentation.title || 'untitled').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()

    // Collect all /uploads/ paths referenced in the presentation
    const uploadPaths = new Set()
    const collectUploads = (str) => { for (const m of str.matchAll(/\/uploads\/[^\s"'<>)]+/g)) uploadPaths.add(m[0]) }
    for (const slide of presentation.slides || []) {
      for (const el of slide.elements || []) {
        if (el.src && el.src.startsWith('/uploads/')) uploadPaths.add(el.src)
        if (el.poster && el.poster.startsWith('/uploads/')) uploadPaths.add(el.poster)
        if (el.content) collectUploads(el.content)
      }
      if (slide.background?.image?.startsWith('/uploads/')) uploadPaths.add(slide.background.image)
    }

    // Rewrite /uploads/path to ./assets/filename for self-contained HTML
    const exportPres = JSON.parse(JSON.stringify(presentation))
    const assetName = (p) => path.basename(p)
    const rewriteUploads = (str) => str.replace(/\/uploads\/[^\s"'<>)]+/g, m => `./assets/${assetName(m)}`)
    for (const slide of exportPres.slides || []) {
      for (const el of slide.elements || []) {
        if (el.src && el.src.startsWith('/uploads/')) el.src = `./assets/${assetName(el.src)}`
        if (el.poster && el.poster.startsWith('/uploads/')) el.poster = `./assets/${assetName(el.poster)}`
        if (el.content && el.content.includes('/uploads/')) el.content = rewriteUploads(el.content)
      }
      if (slide.background?.image?.startsWith('/uploads/')) slide.background.image = `./assets/${assetName(slide.background.image)}`
    }
    const { rows: ghFontRows } = await storage.query(
      'SELECT family_name, source, url FROM user_fonts WHERE user_id = $1', [req.userId]
    ).catch(() => ({ rows: [] }))
    const ghUserFonts = ghFontRows.map(r => ({ familyName: r.family_name, source: r.source, url: r.url }))

    const htmlContent = generateRevealHTML(exportPres, { customFonts: ghUserFonts })
    const jsonContent = JSON.stringify(presentation, null, 2)

    // Get default branch
    const repoInfo = await gh(`/repos/${owner}/${repo}`)
    const branch = repoInfo.default_branch || 'main'

    // Check if repo has any commits (empty repo)
    let latestCommitSha = null
    let baseTreeSha = null
    try {
      const refData = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`)
      latestCommitSha = refData.object.sha
      const commitData = await gh(`/repos/${owner}/${repo}/git/commits/${latestCommitSha}`)
      baseTreeSha = commitData.tree.sha
    } catch {
      // Repo is empty — bootstrap with an initial commit via the Contents API
      // (the Git Data API doesn't work on repos with zero commits)
      await gh(`/repos/${owner}/${repo}/contents/.gitkeep`, {
        method: 'PUT',
        body: JSON.stringify({ message: 'Initial commit', content: '' }),
      })
      const refData = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`)
      latestCommitSha = refData.object.sha
      const commitData = await gh(`/repos/${owner}/${repo}/git/commits/${latestCommitSha}`)
      baseTreeSha = commitData.tree.sha
    }

    // Discover existing presentation folders in the repo tree
    const existingFolders = new Set()
    if (baseTreeSha) {
      const rootTree = await gh(`/repos/${owner}/${repo}/git/trees/${baseTreeSha}`)
      for (const item of rootTree.tree || []) {
        if (item.type === 'tree' && item.path !== '.github') {
          existingFolders.add(item.path)
        }
      }
    }
    existingFolders.add(folderName)

    // Build README with links to all presentations
    const readmeLines = [`# Presentations\n`]
    const sortedFolders = [...existingFolders].sort()
    for (const folder of sortedFolders) {
      const displayName = folder.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      const pagesUrl = config.pagesUrl || `https://${owner}.github.io/${repo}`
      const viewUrl = `${pagesUrl}/${encodeURIComponent(folder)}/presentation.html`
      readmeLines.push(`- [${displayName}](${viewUrl})`)
    }
    const readmeContent = readmeLines.join('\n') + '\n'

    // Upload asset files to GitHub as blobs (parallel, batches of 5)
    const assetBlobs = []
    const assetUploads = [...uploadPaths].map(uploadPath => async () => {
      const relativePath = uploadPath.replace(/^\/uploads\//, '')
      try {
        let fileBuffer
        if (isR2Enabled()) {
          const { rows } = await storage.query('SELECT storage_key FROM uploads WHERE filename = $1', [relativePath])
          if (!rows.length) return null
          const { body } = await streamFromR2(rows[0].storage_key)
          const chunks = []
          for await (const chunk of body) chunks.push(chunk)
          fileBuffer = Buffer.concat(chunks)
        } else {
          const filePath = uploadsFile(relativePath)
          if (!filePath || !fs.existsSync(filePath)) return null
          fileBuffer = fs.readFileSync(filePath)
        }
        const blob = await gh(`/repos/${owner}/${repo}/git/blobs`, {
          method: 'POST',
          body: JSON.stringify({ content: fileBuffer.toString('base64'), encoding: 'base64' }),
        })
        return { path: `${folderName}/assets/${assetName(uploadPath)}`, mode: '100644', type: 'blob', sha: blob.sha }
      } catch (e) { console.error(`Asset upload failed for ${uploadPath}:`, e.message); return null }
    })
    for (let i = 0; i < assetUploads.length; i += 5) {
      const batch = assetUploads.slice(i, i + 5).map(fn => fn())
      const results = await Promise.all(batch)
      assetBlobs.push(...results.filter(Boolean))
    }

    // Create blobs for HTML, JSON, README (parallel)
    const [htmlBlob, jsonBlob, readmeBlob] = await Promise.all([
      gh(`/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: Buffer.from(htmlContent).toString('base64'), encoding: 'base64' }),
      }),
      gh(`/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: Buffer.from(jsonContent).toString('base64'), encoding: 'base64' }),
      }),
      gh(`/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: Buffer.from(readmeContent).toString('base64'), encoding: 'base64' }),
      }),
    ])

    // Create a new tree with our files, assets, + README
    const treePayload = {
      tree: [
        { path: `${folderName}/presentation.html`, mode: '100644', type: 'blob', sha: htmlBlob.sha },
        { path: `${folderName}/presentation.json`, mode: '100644', type: 'blob', sha: jsonBlob.sha },
        { path: 'README.md', mode: '100644', type: 'blob', sha: readmeBlob.sha },
        ...assetBlobs,
      ],
    }
    if (baseTreeSha) treePayload.base_tree = baseTreeSha
    const newTree = await gh(`/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify(treePayload),
    })

    // Create a commit (no parents for initial commit)
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    const defaultMessage = `${presentation.title || 'Untitled'} [${dateStr} ${timeStr}]`
    const commitMessage = (req.body && req.body.message) ? req.body.message : defaultMessage
    const commitPayload = {
      message: commitMessage,
      tree: newTree.sha,
      parents: latestCommitSha ? [latestCommitSha] : [],
    }
    const newCommit = await gh(`/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify(commitPayload),
    })

    // Update or create the branch reference
    if (latestCommitSha) {
      await gh(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: newCommit.sha }),
      })
    } else {
      await gh(`/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: newCommit.sha }),
      })
    }

    res.json({
      success: true,
      commitSha: newCommit.sha,
      url: `https://github.com/${owner}/${repo}/tree/${branch}/${folderName}`,
    })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// GET /api/presentations/:id/github/history - list git commits for this presentation
app.get('/api/presentations/:id/github/history', async (req, res) => {
  try {
    const config = await storage.getGithubConfig(req.userId)
    if (!config.token || !config.owner || !config.repo) {
      return res.status(400).json({ error: 'GitHub not configured' })
    }
    const presentation = await storage.getPresentation(req.params.id, req.userId)
    if (!presentation) return res.status(404).json({ error: 'Not found' })

    const { token, owner, repo } = config
    const folderName = (presentation.title || 'untitled').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(folderName)}/presentation.json&per_page=50`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    )
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      return res.status(response.status).json({ error: body.message || 'GitHub API error' })
    }
    const commits = await response.json()
    res.json(commits.map(c => ({
      sha: c.sha,
      message: c.commit.message,
      date: c.commit.committer.date,
      author: c.commit.author.name,
    })))
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// GET /api/presentations/:id/github/version/:sha - fetch presentation.json at a specific commit
app.get('/api/presentations/:id/github/version/:sha', requireValidId(), requireValidSHA(), async (req, res) => {
  try {
    const config = await storage.getGithubConfig(req.userId)
    if (!config.token || !config.owner || !config.repo) {
      return res.status(400).json({ error: 'GitHub not configured' })
    }
    const presentation = await storage.getPresentation(req.params.id, req.userId)
    if (!presentation) return res.status(404).json({ error: 'Not found' })

    const { token, owner, repo } = config
    const folderName = (presentation.title || 'untitled').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
    const filePath = `${folderName}/presentation.json`

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${req.params.sha}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    )
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      return res.status(response.status).json({ error: body.message || 'GitHub API error' })
    }
    const file = await response.json()
    const content = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'))
    res.json(content)
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/github/browse-repo - scan a GitHub repo for Parallax presentations
app.post('/api/github/browse-repo', async (req, res) => {
  try {
    const { url } = req.body
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL is required' })

    const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/)
    if (!match) return res.status(400).json({ error: 'Invalid GitHub URL. Expected format: https://github.com/owner/repo' })
    const [, owner, repo] = match

    const config = await storage.getGithubConfig(req.userId)
    const headers = { Accept: 'application/vnd.github.v3+json' }
    if (config.token) headers.Authorization = `token ${config.token}`

    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers })
    if (!repoRes.ok) {
      const body = await repoRes.json().catch(() => ({}))
      return res.status(repoRes.status).json({ error: body.message || 'Repository not found or not accessible' })
    }
    const repoInfo = await repoRes.json()
    const branch = repoInfo.default_branch || 'main'

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers })
    if (!treeRes.ok) {
      return res.status(treeRes.status).json({ error: 'Failed to read repository contents' })
    }
    const tree = await treeRes.json()

    const jsonFiles = (tree.tree || []).filter(
      item => item.type === 'blob' && item.path.endsWith('/presentation.json')
    )

    const presentations = await Promise.all(jsonFiles.map(async (item) => {
      const folder = item.path.replace(/\/presentation\.json$/, '')
      let title = folder.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      let slideCount = 0
      try {
        const contentRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(item.path)}?ref=${branch}`,
          { headers }
        )
        if (contentRes.ok) {
          const file = await contentRes.json()
          const data = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'))
          if (data.title) title = data.title
          slideCount = (data.slides || []).length
        }
      } catch {}
      return { folder, title, slideCount }
    }))

    res.json({ owner, repo, branch, presentations })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// POST /api/presentations/fork - fork a presentation from a GitHub repo
app.post('/api/presentations/fork', async (req, res) => {
  try {
    if (!(await checkPresentationQuota(req, res))) return

    const { owner, repo, folder, branch: reqBranch } = req.body
    if (!owner || !repo || !folder) return res.status(400).json({ error: 'owner, repo, and folder are required' })
    if (!/^[a-z0-9_-]+$/i.test(owner) || !/^[a-z0-9_.-]+$/i.test(repo)) {
      return res.status(400).json({ error: 'Invalid owner or repo name' })
    }
    if (/[\/\\]|\.\./.test(folder)) return res.status(400).json({ error: 'Invalid folder name' })

    const config = await storage.getGithubConfig(req.userId)
    const headers = { Accept: 'application/vnd.github.v3+json' }
    if (config.token) headers.Authorization = `token ${config.token}`

    const branch = reqBranch || 'main'
    const jsonPath = `${folder}/presentation.json`

    const jsonRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(jsonPath)}?ref=${branch}`,
      { headers }
    )
    if (!jsonRes.ok) return res.status(404).json({ error: 'presentation.json not found in that folder' })
    const jsonFile = await jsonRes.json()
    const presData = JSON.parse(Buffer.from(jsonFile.content, 'base64').toString('utf8'))

    // Discover asset files in the folder's assets/ subdirectory
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers }
    )
    const tree = treeRes.ok ? await treeRes.json() : { tree: [] }
    const assetPrefix = `${folder}/assets/`
    const assetFiles = (tree.tree || []).filter(
      item => item.type === 'blob' && item.path.startsWith(assetPrefix)
    )

    // Download and re-upload each asset, building a path rewrite map. In the
    // cloud they go on the user's storage and count against their plan
    const pathMap = {}
    const plan = planFor(req.userPlan)
    const quota = isR2Enabled() && storage.query ? { used: await storageUsedBytes(storage, req.userId) } : null
    const storedKeys = []
    let addedBytes = 0
    for (const asset of assetFiles) {
      const filename = path.basename(asset.path)
      if (quota && plan.storageBytes && quota.used + addedBytes + (asset.size || 0) > plan.storageBytes) {
        await Promise.all([
          deleteManyFromR2(storedKeys).catch(e => console.error('Fork assets not deleted:', e.message)),
          storedKeys.length && storage.query('DELETE FROM uploads WHERE storage_key = ANY($1)', [storedKeys]),
        ])
        return res.status(413).json({ error: `Its files don't fit in your storage (${Math.round(plan.storageBytes / (1024 * 1024))} MB on the ${plan.name} plan).` })
      }
      if (quota && plan.maxFileBytes && (asset.size || 0) > plan.maxFileBytes) continue
      try {
        const blobRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/blobs/${asset.sha}`,
          { headers: { ...headers, Accept: 'application/vnd.github.v3+json' } }
        )
        if (!blobRes.ok) continue
        const blob = await blobRes.json()
        const buffer = Buffer.from(blob.content, 'base64')

        if (isR2Enabled()) {
          const newFilename = `${uuidv4()}${path.extname(filename)}`
          const contentType = {
            '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
            '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
            '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf',
          }[path.extname(filename).toLowerCase()] || 'application/octet-stream'
          const storageKey = `uploads/${newFilename}`
          await putBufferToR2(storageKey, buffer, contentType)
          await storage.query(
            'INSERT INTO uploads (filename, storage_key, content_type, size_bytes, presentation_id, user_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [newFilename, storageKey, contentType, buffer.length, null, req.userId]
          )
          storedKeys.push(storageKey)
          addedBytes += buffer.length
          pathMap[`./assets/${filename}`] = `/uploads/${newFilename}`
        } else {
          const destDir = path.join(UPLOADS_DIR, 'forked')
          fs.ensureDirSync(destDir)
          const newFilename = `${uuidv4()}${path.extname(filename)}`
          fs.writeFileSync(path.join(destDir, newFilename), buffer)
          pathMap[`./assets/${filename}`] = `/uploads/forked/${newFilename}`
        }
      } catch (e) { console.error(`Fork asset download failed for ${asset.path}:`, e.message) }
    }

    // Rewrite asset paths in the presentation data
    const rewrite = (str) => {
      let result = str
      for (const [oldPath, newPath] of Object.entries(pathMap)) {
        result = result.split(oldPath).join(newPath)
      }
      return result
    }
    const presStr = rewrite(JSON.stringify(presData))
    const forkedPres = JSON.parse(presStr)

    // Clean up and create as a new presentation
    delete forkedPres.id
    delete forkedPres.createdAt
    delete forkedPres.updatedAt
    delete forkedPres.expiresAt
    forkedPres.title = (forkedPres.title || 'Untitled') + ' (fork)'
    // New slide and element ids, with links and show/hide following them
    forkedPres.slides = renewSlideIds(forkedPres.slides, uuidv4)

    const { expirationDays } = planFor(req.userPlan)
    const expiresAt = IS_CLOUD && expirationDays
      ? new Date(Date.now() + expirationDays * 86400000).toISOString()
      : null
    const created = await storage.createPresentation(forkedPres, req.userId, expiresAt)
    // Its files go with it when it's deleted
    if (storedKeys.length) await storage.query('UPDATE uploads SET presentation_id = $1 WHERE storage_key = ANY($2)', [created.id, storedKeys])

    res.json({
      ...created,
      forkedFrom: { owner, repo, folder, branch },
      assetsImported: Object.keys(pathMap).length,
    })
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) })
  }
})

// ---- Plugin API (authenticated routes) ----

if (IS_CLOUD) {
  app.post('/api/plugins/:slug/install', requireValidSlug(), requireUser, async (req, res) => {
    try {
      const plugin = await storage.getPlugin(req.params.slug)
      if (!plugin) return res.status(404).json({ error: 'Plugin not found' })
      await storage.installPlugin(plugin.id, req.userId)
      res.json({ ok: true })
    } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
  })

  app.delete('/api/plugins/:slug/install', requireValidSlug(), requireUser, async (req, res) => {
    try {
      const plugin = await storage.getPlugin(req.params.slug)
      if (!plugin) return res.status(404).json({ error: 'Plugin not found' })
      await storage.uninstallPlugin(plugin.id, req.userId)
      res.json({ ok: true })
    } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
  })

  app.get('/api/me/plugins', requireUser, async (req, res) => {
    try {
      const plugins = await storage.getInstalledPlugins(req.userId)
      res.json(plugins)
    } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
  })
}

app.get('/api/presentations/:id/plugins', requireValidId(), deckAccess(), async (req, res) => {
  try {
    const pres = await storage.getPresentation(req.params.id, req.deck.ownerId)
    if (!pres) return res.status(404).json({ error: 'Not found' })
    const plugins = await storage.getPresentationPlugins(req.params.id)
    res.json(plugins)
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

app.post('/api/presentations/:id/plugins', requireValidId(), deckAccess(), async (req, res) => {
  try {
    const pres = await storage.getPresentation(req.params.id, req.deck.ownerId)
    if (!pres) return res.status(404).json({ error: 'Not found' })
    const { pluginId, config } = req.body
    await storage.enablePluginForPresentation(req.params.id, pluginId, config)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

app.delete('/api/presentations/:id/plugins/:pluginId', requireValidId(), deckAccess(), async (req, res) => {
  try {
    const pres = await storage.getPresentation(req.params.id, req.deck.ownerId)
    if (!pres) return res.status(404).json({ error: 'Not found' })
    await storage.disablePluginForPresentation(req.params.id, req.params.pluginId)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: safeErrorMessage(err) }) }
})

// In production, serve client build with SPA fallback
if (process.env.NODE_ENV === 'production') {
  // Support both Docker layout (../client/dist) and Electron layout (resourcesPath/client/dist)
  let clientDist = path.join(__dirname, '..', 'client', 'dist')
  if (!fs.existsSync(clientDist) && process.resourcesPath) {
    clientDist = path.join(process.resourcesPath, 'client', 'dist')
  }
  if (fs.existsSync(clientDist)) {
    // Bundled libraries: each path names its version, so they never change
    app.use('/vendor', express.static(path.join(clientDist, 'vendor'), { immutable: true, maxAge: '1y', fallthrough: false }))
    app.use(express.static(clientDist))
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'))
    })
  }
}

// Global error handler — prevents stack traces and internal paths from leaking
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message)
  res.status(err.status || 500).json({ error: safeErrorMessage(err) })
})

// When required as a module (Electron), export startServer. Otherwise start directly.
async function startServer(port) {
  const p = port || PORT
  // Until they load, the built-in plans apply
  if (IS_CLOUD) {
    try { await loadPlans(storage) } catch (err) { console.error('Could not load plans:', err.message) }
  }
  return new Promise((resolve) => {
    const host = listenHost()
    const server = app.listen(p, host, () => {
      console.log(`Server running on http://localhost:${p}${host === '127.0.0.1' ? ' (this computer only)' : ` (listening on ${host})`}`)
      resolve(server)
    })
    attachLiveEditing(server)
  })
}

// Serves live editing's WebSocket on an HTTP server, in the cloud version
function attachLiveEditing(server) {
  collab?.attach(server)
}

// Periodic cleanup: hard-delete free-tier presentations expired > 7 days,
// along with their R2 files
if (IS_CLOUD) {
  setInterval(async () => {
    try {
      const deleted = await sweepExpiredPresentations(storage)
      if (deleted > 0) console.log(`Cleanup: deleted ${deleted} expired presentations`)
    } catch (err) { console.error('Cleanup error:', err.message) }
  }, 60 * 60 * 1000)

  // Guest sessions: closed tabs (after a short grace period) and idle
  // sessions. Skipped while none exist, so the database can go idle.
  let sweepingGuests = false
  setInterval(async () => {
    if (sweepingGuests || !guestSessionsMayExist()) return
    sweepingGuests = true
    try {
      const deleted = await sweepGuestSessions(storage)
      if (deleted > 0) console.log(`Cleanup: deleted ${deleted} guest sessions`)
    } catch (err) {
      console.error('Guest cleanup error:', err.message)
    } finally {
      sweepingGuests = false
    }
  }, 60 * 1000)

  // Container CPU and memory for the admin dashboard
  startSystemSampling()
}

if (require.main === module) {
  startServer()
}

module.exports = { app, startServer, attachLiveEditing }

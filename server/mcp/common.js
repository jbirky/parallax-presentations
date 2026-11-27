// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// What both MCP servers share: the one behind AI collaborator links
// (index.js, /mcp/<secret>) and the account-level one behind AI access
// tokens (account.js, /mcp). Tool annotations, tool results, and serving an
// Express request through the SDK's fetch-shaped handler.

const { Readable } = require('stream')

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
const DELETE = { ...WRITE, destructiveHint: true }

const text = s => ({ content: [{ type: 'text', text: s }] })
const failure = s => ({ content: [{ type: 'text', text: s }], isError: true })

// A tool's work, with the server's own errors logged and not shown
const guarded = (name, work) => async (...args) => {
  try {
    return await work(...args)
  } catch (err) {
    console.error(`MCP tool ${name} failed:`, err.message)
    return failure('Something went wrong on the Parallax server, so that may not have worked. Read the presentation again to check before trying again.')
  }
}

// Request headers passed on to the SDK
const SKIP_HEADERS = new Set(['host', 'content-length', 'connection', 'transfer-encoding', 'cookie', 'keep-alive', 'upgrade'])

// Serves one request through the SDK's fetch-shaped handler. auth is what
// the tools see as ctx.authInfo: { token, clientId, scopes, extra }; extra
// gets local, this server's own address, for its renderer.
async function serve(handler, req, res, auth) {
  const controller = new AbortController()
  res.on('close', () => { if (!res.writableEnded) controller.abort() })
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value != null && !SKIP_HEADERS.has(key)) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  const post = req.method === 'POST'
  const request = new Request(`${req.protocol}://${req.get('host')}${req.originalUrl}`, {
    method: req.method,
    headers,
    body: post ? JSON.stringify(req.body ?? null) : undefined,
    signal: controller.signal,
  })
  const response = await handler.fetch(request, {
    authInfo: { ...auth, extra: { ...auth.extra, local: `http://127.0.0.1:${req.socket.localPort}` } },
    ...(post && { parsedBody: req.body }),
  })
  res.status(response.status)
  response.headers.forEach((value, key) => res.setHeader(key, value))
  if (!response.body || req.method === 'HEAD') return res.end()
  const body = Readable.fromWeb(response.body)
  body.on('error', () => res.end())
  body.pipe(res)
}

const wantsStream = req => /text\/event-stream/i.test(req.get('accept') || '')

module.exports = { READ_ONLY, WRITE, DELETE, text, failure, guarded, serve, wantsStream }

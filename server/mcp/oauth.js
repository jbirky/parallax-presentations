// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Signing in to the account-level MCP server (/mcp, account.js) with OAuth,
// in the cloud version. AI chat apps such as claude.ai and ChatGPT can't
// send an AI access token, so they sign the person in, as the MCP
// authorization spec has them do:
//
// 1. A request with no token gets a 401 whose WWW-Authenticate header points
//    at this server's protected resource metadata
//    (/.well-known/oauth-protected-resource/mcp, RFC 9728).
// 2. That names Clerk's Frontend API as the authorization server. The app
//    registers there (a Client ID Metadata Document, or dynamic
//    registration), and the person signs in to Parallax and agrees on
//    Clerk's consent screen.
// 3. The app sends Clerk's access token as "Authorization: Bearer <token>".
//    Clerk checks it (authenticateRequest with acceptsToken 'oauth_token',
//    and this server's /mcp as its audience), which gives the person's Clerk
//    id and the app's client id.
//
// Each app a person connects is a row in ai_tokens (services/ai-tokens.js
// connectApp), so its edits, versions and avatar name work as a token's do,
// and the person can turn it off under AI access.

const crypto = require('crypto')
const { connectApp } = require('../services/ai-tokens')

// A checked access token is trusted this long before Clerk is asked again:
// an app sends one with every request, and MCP requests come in runs
const TOKEN_CACHE_MS = 60 * 1000
const TOKEN_CACHE_MAX = 2000
// Apps' names, read from their client metadata, by client id
const NAME_CACHE_MS = 24 * 60 * 60 * 1000
const NAME_FETCH_MS = 5000
const NAME_MAX_BYTES = 64 * 1024
const FETCH = { firstByteMs: NAME_FETCH_MS, totalMs: NAME_FETCH_MS, maxBytes: NAME_MAX_BYTES, maxRedirects: 2, politeMs: 0 }
// Clerk's authorization server metadata, for apps that look for it here
const SERVER_METADATA_MS = 60 * 60 * 1000

// Names apps go by when their metadata gives none, by client metadata host
const KNOWN_APPS = { 'claude.ai': 'Claude', 'chatgpt.com': 'ChatGPT', 'chat.openai.com': 'ChatGPT' }

// The Clerk Frontend API a publishable key names: pk_test_ or pk_live_, then
// the base64 of "<host>$"
function frontendApi(publishableKey) {
  const m = /^pk_(?:test|live)_([A-Za-z0-9+/=_-]+)$/.exec(String(publishableKey || ''))
  if (!m) return null
  const host = Buffer.from(m[1], 'base64').toString('utf8').replace(/\$$/, '')
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host) ? `https://${host}` : null
}

const hashOf = token => crypto.createHash('sha256').update(token).digest('hex')

function createOAuth({ storage, clerkClient, provision, safeFetch, publishableKey = process.env.CLERK_PUBLISHABLE_KEY }) {
  const issuer = frontendApi(publishableKey)
  const enabled = !!(issuer && clerkClient?.authenticateRequest && provision)
  const tokens = new Map() // token hash → { account, until }
  const names = new Map() // client id → { name, until }
  let serverMetadata = null // { body, until }

  const resource = origin => `${origin}/mcp`
  const metadataUrl = origin => `${origin}/.well-known/oauth-protected-resource/mcp`

  // RFC 9728's protected resource metadata for /mcp
  function resourceMetadata(origin) {
    return {
      resource: resource(origin),
      authorization_servers: [issuer],
      bearer_methods_supported: ['header'],
      scopes_supported: ['profile', 'email'],
      resource_name: 'Parallax',
      resource_documentation: `${origin}/docs/tutorials/ai-agents`,
    }
  }

  // The header a 401 from /mcp carries: where to find how to sign in, and
  // whether the token sent was the trouble
  function challenge(origin, { invalid = false } = {}) {
    return `Bearer ${invalid ? 'error="invalid_token", ' : ''}resource_metadata="${metadataUrl(origin)}"`
  }

  // Clerk's own authorization server metadata, for apps written to an older
  // MCP spec that look for it on the resource's site
  async function authorizationServerMetadata() {
    if (serverMetadata && serverMetadata.until > Date.now()) return serverMetadata.body
    const res = await safeFetch(`${issuer}/.well-known/oauth-authorization-server`, FETCH)
    if (res.status !== 200) throw new Error(`Clerk answered ${res.status}`)
    const body = JSON.parse(res.body.toString('utf8'))
    serverMetadata = { body, until: Date.now() + SERVER_METADATA_MS }
    return body
  }

  // What an app calls itself: the client_name in its Client ID Metadata
  // Document (its client id is that document's https address), or the name
  // Clerk has for a client registered with it
  async function appName(clientId) {
    const known = names.get(clientId)
    if (known && known.until > Date.now()) return known.name
    let name = ''
    try {
      if (/^https:\/\//.test(clientId)) {
        const res = await safeFetch(clientId, FETCH)
        if (res.status === 200) name = JSON.parse(res.body.toString('utf8')).client_name || ''
        if (!name) name = KNOWN_APPS[new URL(clientId).host] || new URL(clientId).host
      } else if (clerkClient.oauthApplications?.get) {
        name = (await clerkClient.oauthApplications.get(clientId))?.name || ''
      }
    } catch (err) {
      console.error('MCP OAuth: reading an app\'s name failed:', err.message)
    }
    name = String(name).replace(/\s+/g, ' ').trim() || 'AI app'
    names.set(clientId, { name, until: Date.now() + NAME_CACHE_MS })
    return name
  }

  // The account an access token signs in as, for account.js: { id, name,
  // scopes, userId, userPlan, app: true }; { off } when the person turned the
  // app off; null when Clerk doesn't take the token
  async function account(token, origin) {
    if (!enabled || typeof token !== 'string' || token.length > 4096) return null
    const key = hashOf(token)
    const cached = tokens.get(key)
    if (cached && cached.until > Date.now()) return cached.account
    let auth
    try {
      const state = await clerkClient.authenticateRequest(
        new Request(resource(origin), { headers: { authorization: `Bearer ${token}` } }),
        { acceptsToken: 'oauth_token', audience: resource(origin) })
      if (!state?.isAuthenticated) return null
      auth = state.toAuth()
    } catch (err) {
      console.error('MCP OAuth: checking a token failed:', err.message)
      return null
    }
    if (!auth?.userId || !auth.clientId) return null
    const user = await provision(auth.userId)
    const app = await connectApp(storage, { userId: user.id, client: auth.clientId, name: await appName(auth.clientId) })
    const found = app.off ? { off: true, name: app.name } : { id: app.id, name: app.name, scopes: app.scopes, userId: app.userId, userPlan: app.userPlan, app: true }
    if (tokens.size >= TOKEN_CACHE_MAX) tokens.delete(tokens.keys().next().value)
    tokens.set(key, { account: found, until: Date.now() + TOKEN_CACHE_MS })
    return found
  }

  // Turning an app off or on again takes effect at once
  function forget() { tokens.clear() }

  return { enabled, issuer, resourceMetadata, challenge, authorizationServerMetadata, account, forget }
}

module.exports = { createOAuth, frontendApi }

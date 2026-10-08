// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Community plugins from GitHub: a public repo's version tags, and one tag's
// plugin, checked against the rules a community plugin follows. The repo
// has a plugin folder's layout: parallax-plugin.json at its root and the
// built files in dist/. Everything is read at the tag's commit, and each
// file is checked against the commit's own hash of it, so a tag moved
// midway can't swap the files. Nothing from the repo runs on the server.
// services/community-plugins.js stores what this fetches.

const crypto = require('crypto')
const { safeFetch } = require('./safe-fetch')
const { NETWORK_HOST_RE } = require('./plugin-embed')

const API = 'https://api.github.com'
const RAW = 'https://raw.githubusercontent.com'

const KB = 1024
const LIMITS = { files: 40, totalBytes: 2 * KB * KB, fileBytes: KB * KB, manifestBytes: 64 * KB, readmeBytes: 200 * KB, defaultDataBytes: 64 * KB }
const CATEGORIES = ['math', 'physics', 'chemistry', 'biology', 'astronomy', 'data', 'computer science', 'teaching', 'other']

const VERSION_TAG_RE = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/
// GitHub's rules: an owner is letters, digits and single hyphens
const OWNER_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/
const ID_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/
const TYPE_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/
// Kept for plugins that come with Parallax
const RESERVED_ID_RE = /^com\.parallax\./
// What a plugin's dist/ files are, by extension; anything else is bytes
const CONTENT_TYPES = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', wasm: 'application/wasm',
}

// A refusal to show whoever's importing: status is the HTTP status to send,
// problems each rule the plugin breaks, when there are several
class PluginImportError extends Error {
  constructor(message, { status = 400, problems } = {}) {
    super(message)
    this.importError = true
    this.status = status
    if (problems) this.problems = problems
  }
}

const formatBytes = n => (n >= KB * KB ? `${(n / (KB * KB)).toFixed(1)} MB` : `${Math.ceil(n / KB)} KB`)
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex')
// The SHA git gives a file's contents, as a commit's tree lists it
const gitBlobSha = buf => crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex')
const contentTypeFor = file => CONTENT_TYPES[file.split('.').pop().toLowerCase()] || 'application/octet-stream'

// -1, 0 or 1 as version a comes before, with or after b (semver: a
// pre-release comes before its release)
function compareVersions(a, b) {
  const parse = v => {
    const [core, pre = null] = String(v).split(/-(.*)/s)
    return { nums: core.split('.').map(Number), pre }
  }
  const x = parse(a), y = parse(b)
  for (let i = 0; i < 3; i++) {
    if (x.nums[i] !== y.nums[i]) return x.nums[i] < y.nums[i] ? -1 : 1
  }
  if (x.pre === y.pre) return 0
  if (x.pre === null) return 1
  if (y.pre === null) return -1
  const xs = x.pre.split('.'), ys = y.pre.split('.')
  for (let i = 0; i < Math.max(xs.length, ys.length); i++) {
    if (xs[i] === undefined) return -1
    if (ys[i] === undefined) return 1
    const xn = /^\d+$/.test(xs[i]), yn = /^\d+$/.test(ys[i])
    if (xn && yn && Number(xs[i]) !== Number(ys[i])) return Number(xs[i]) < Number(ys[i]) ? -1 : 1
    if (xn !== yn) return xn ? -1 : 1
    if (xs[i] !== ys[i]) return xs[i] < ys[i] ? -1 : 1
  }
  return 0
}

// A repo's plugin's name in Parallax's URLs: GitHub owners can't contain
// "--", so the owner and the repo can't run into each other's
function slugFor(owner, repo) {
  return `${owner}--${repo}`.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
}

// { owner, repo } from what someone pasted: a GitHub URL (with .git, a
// trailing slash, or a /tree/… path), git@github.com:owner/repo, or owner/repo
function parseRepoUrl(input) {
  const text = String(input || '').trim()
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) && !/^https?:\/\/(www\.)?github\.com\//i.test(text)) {
    throw new PluginImportError('Only GitHub repos can be imported for now')
  }
  const m = text.match(/^(?:(?:https?:\/\/)?(?:www\.)?github\.com\/|git@github\.com:)?([^/\s]+)\/([^/\s?#]+)/i)
  const owner = m?.[1]
  const repo = m?.[2]?.replace(/\.git$/i, '')
  if (!owner || !repo || !OWNER_RE.test(owner) || !REPO_RE.test(repo) || repo === '.' || repo === '..') {
    throw new PluginImportError('That isn’t a GitHub repo’s address. It looks like https://github.com/owner/repo')
  }
  return { owner, repo }
}

// --- Asking GitHub ---

// GitHub's hosts are fixed, so the server's own list of hosts it may fetch
// from (PARALLAX_FETCH_HOSTS) doesn't apply, nor its gap between requests
const FETCH_OPTS = { politeMs: 0, allowedHosts: [], maxRedirects: 2, firstByteMs: 15000, totalMs: 30000 }

function apiHeaders() {
  const token = process.env.GITHUB_PLUGIN_TOKEN
  return { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token && { Authorization: `Bearer ${token}` }) }
}

// The API's JSON for path, or null for a 404
async function api(path, fetcher) {
  let res
  try {
    res = await fetcher(API + path, { ...FETCH_OPTS, maxBytes: 8 * KB * KB, headers: apiHeaders() })
  } catch (err) {
    throw new PluginImportError(`GitHub couldn’t be reached: ${err.message}`, { status: 502 })
  }
  if (res.status === 404) return null
  if (res.status === 429 || (res.status === 403 && String(res.headers['x-ratelimit-remaining']) === '0')) {
    const reset = Number(res.headers['x-ratelimit-reset'])
    const minutes = reset ? Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60000)) : 0
    throw new PluginImportError(`GitHub’s limit on requests from Parallax is used up${minutes ? `. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}` : ''}`, { status: 429 })
  }
  if (res.status !== 200) throw new PluginImportError(`GitHub answered with an error (${res.status})`, { status: 502 })
  try {
    return JSON.parse(res.body.toString('utf8'))
  } catch {
    throw new PluginImportError('GitHub’s answer couldn’t be read', { status: 502 })
  }
}

// A file at a commit, or null when there's none
async function raw({ owner, repo, sha }, file, maxBytes, fetcher) {
  const url = `${RAW}/${owner}/${repo}/${sha}/${file.split('/').map(encodeURIComponent).join('/')}`
  let res
  try {
    res = await fetcher(url, { ...FETCH_OPTS, maxBytes })
  } catch (err) {
    if (err.tooBig) throw new PluginImportError(`${file} is larger than ${formatBytes(maxBytes)}`)
    throw new PluginImportError(`${file} couldn’t be downloaded: ${err.message}`, { status: 502 })
  }
  if (res.status === 404) return null
  if (res.status !== 200) throw new PluginImportError(`${file} couldn’t be downloaded (GitHub answered ${res.status})`, { status: 502 })
  return res.body
}

// A public repo and its version tags (v1.2.0 or 1.2.0), newest first:
// { owner, repo, url, description, stars, avatar, tags: [{ name, version, sha }] }
async function lookupRepo(input, { fetcher = safeFetch } = {}) {
  const { owner, repo } = parseRepoUrl(input)
  const info = await api(`/repos/${owner}/${repo}`, fetcher)
  if (!info || info.private) throw new PluginImportError(`There’s no public repo at github.com/${owner}/${repo}`, { status: 404 })
  const login = info.owner?.login || owner
  const name = info.name || repo
  const tags = (await api(`/repos/${login}/${name}/tags?per_page=100`, fetcher)) || []
  return {
    owner: login,
    repo: name,
    url: info.html_url || `https://github.com/${login}/${name}`,
    description: info.description || '',
    stars: info.stargazers_count || 0,
    avatar: info.owner?.avatar_url || '',
    tags: (Array.isArray(tags) ? tags : [])
      .map(t => ({ name: String(t.name), version: VERSION_TAG_RE.exec(t.name)?.[1] || null, sha: t.commit?.sha }))
      .filter(t => t.version && /^[0-9a-f]{40}$/.test(t.sha || ''))
      .sort((a, b) => compareVersions(b.version, a.version)),
  }
}

// --- The manifest's rules ---

// A path inside dist/ as a manifest gives it ("./sandbox.html"), or null
// when it would leave the folder
function distPath(value) {
  if (typeof value !== 'string') return null
  const p = value.trim().replace(/^\.\//, '')
  if (!p || p.startsWith('/') || p.includes('\\') || p.split('/').some(seg => seg === '..' || seg === '.' || seg === '')) return null
  return p
}

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max

// Checks a manifest against the rules, for the tag's version and the files
// in dist/. Returns { manifest, problems }: the manifest as stored (only the
// fields Parallax reads, paths without "./"), and each rule it breaks.
function checkManifest(m, { version, files }) {
  const problems = []
  if (!isObject(m)) return { manifest: null, problems: ['parallax-plugin.json must hold an object'] }
  const out = {}

  if (typeof m.id !== 'string' || m.id.length > 100 || !ID_RE.test(m.id)) {
    problems.push('“id” must be a lower-case reverse-DNS name, such as io.github.<owner>.<plugin>')
  } else if (RESERVED_ID_RE.test(m.id)) {
    problems.push('Ids starting with com.parallax. are kept for the plugins that come with Parallax')
  } else out.id = m.id

  if (!text(m.name, 60)) problems.push('“name” is required, at most 60 characters')
  else out.name = m.name.trim()
  if (!text(m.description, 300)) problems.push('“description” is required, at most 300 characters')
  else out.description = m.description.trim()
  if (m.version !== version) problems.push(`“version” is ${JSON.stringify(m.version ?? null)}, but the tag says ${version}`)
  out.version = version
  if (!text(m.license, 64)) problems.push('“license” is required: an SPDX id such as MIT')
  else out.license = m.license.trim()

  const sandbox = distPath(m.sandbox)
  if (!sandbox || !/\.html?$/i.test(sandbox)) problems.push('“sandbox” must name an .html file in dist/')
  else if (!files.has(sandbox)) problems.push(`“sandbox” names dist/${sandbox}, which isn’t in the repo at that tag`)
  else out.sandbox = sandbox

  if (m.icon !== undefined) {
    const icon = distPath(m.icon)
    if (!icon || !/\.(svg|png)$/i.test(icon)) problems.push('“icon” must name an .svg or .png file in dist/')
    else if (!files.has(icon)) problems.push(`“icon” names dist/${icon}, which isn’t in the repo at that tag`)
    else out.icon = icon
  }
  if (m.homepage !== undefined) {
    if (typeof m.homepage !== 'string' || m.homepage.length > 300 || !/^https:\/\/[^\s]+$/.test(m.homepage)) problems.push('“homepage” must be an https address')
    else out.homepage = m.homepage
  }
  if (isObject(m.author)) {
    const author = {}
    if (text(m.author.name, 100)) author.name = m.author.name.trim()
    if (typeof m.author.url === 'string' && /^https:\/\/[^\s]+$/.test(m.author.url) && m.author.url.length <= 300) author.url = m.author.url
    if (Object.keys(author).length) out.author = author
  }
  if (typeof m.parallaxEngine === 'string' && m.parallaxEngine.length <= 40) out.parallaxEngine = m.parallaxEngine

  if (m.main !== undefined) {
    problems.push('“main” isn’t allowed in community plugins yet, because it would run inside the editor. Put the plugin’s code in its sandbox page.')
  }

  const contributes = isObject(m.contributes) ? m.contributes : {}
  for (const key of Object.keys(contributes)) {
    if (key === 'elementTypes') continue
    const value = contributes[key]
    if (Array.isArray(value) ? value.length : value !== undefined && value !== null) {
      problems.push(`“contributes.${key}” isn’t allowed in community plugins yet: only element types are`)
    }
  }
  const types = contributes.elementTypes
  if (!Array.isArray(types) || types.length === 0 || types.length > 10) {
    problems.push('“contributes.elementTypes” must list between 1 and 10 element types')
  } else {
    const seen = new Set()
    out.contributes = { elementTypes: [] }
    types.forEach((et, i) => {
      const where = `Element type ${i + 1}`
      if (!isObject(et)) { problems.push(`${where} must be an object`); return }
      if (typeof et.type !== 'string' || !TYPE_RE.test(et.type)) { problems.push(`${where}’s “type” must be lower-case letters, digits and hyphens, at most 40`); return }
      if (seen.has(et.type)) { problems.push(`The element type “${et.type}” is listed twice`); return }
      seen.add(et.type)
      const kept = { type: et.type }
      if (!text(et.label, 60)) problems.push(`“${et.type}” needs a “label”, at most 60 characters`)
      else kept.label = et.label.trim()
      if (et.defaultSize !== undefined) {
        const { width, height } = isObject(et.defaultSize) ? et.defaultSize : {}
        const ok = n => Number.isFinite(n) && n >= 20 && n <= 4000
        if (!ok(width) || !ok(height)) problems.push(`“${et.type}”’s “defaultSize” must have a width and height between 20 and 4000`)
        else kept.defaultSize = { width, height }
      }
      if (et.defaultData !== undefined) {
        if (!isObject(et.defaultData)) problems.push(`“${et.type}”’s “defaultData” must be an object`)
        else if (Buffer.byteLength(JSON.stringify(et.defaultData)) > LIMITS.defaultDataBytes) problems.push(`“${et.type}”’s “defaultData” is over 64 KB`)
        else kept.defaultData = et.defaultData
      }
      out.contributes.elementTypes.push(kept)
    })
  }

  const permissions = m.permissions ?? []
  if (!Array.isArray(permissions) || permissions.length > 20) problems.push('“permissions” must be a list of at most 20')
  else {
    out.permissions = []
    for (const p of permissions) {
      const host = typeof p === 'string' && p.startsWith('network:') ? p.slice(8).toLowerCase() : null
      if (!host || !NETWORK_HOST_RE.test(host)) problems.push(`${JSON.stringify(p)} isn’t a permission Parallax knows. Use network:<host>, such as network:cdn.jsdelivr.net`)
      else if (!out.permissions.includes(`network:${host}`)) out.permissions.push(`network:${host}`)
    }
  }

  if (m.categories !== undefined) {
    if (!Array.isArray(m.categories) || m.categories.length > 3 || m.categories.some(c => !CATEGORIES.includes(c))) {
      problems.push(`“categories” must list at most 3 of: ${CATEGORIES.join(', ')}`)
    } else out.categories = [...new Set(m.categories)]
  }
  if (m.keywords !== undefined) {
    if (!Array.isArray(m.keywords) || m.keywords.length > 10 || m.keywords.some(k => !text(k, 30))) problems.push('“keywords” must list at most 10 words or phrases, each at most 30 characters')
    else out.keywords = m.keywords.map(k => k.trim())
  }

  return { manifest: problems.length ? null : out, problems }
}

// --- One tag's plugin ---

// Fetches and checks the plugin at a repo's tag. Resolves to { owner, repo,
// url, description, stars, avatar, tag, version, commitSha, manifest, readme,
// files: [{ path, content, sha256, contentType }], sizeBytes, sha256 }, or
// throws a PluginImportError listing what's wrong. repo: what lookupRepo
// gave for it just now, to save asking GitHub again.
async function fetchVersion(input, tagName, { fetcher = safeFetch, repo = null } = {}) {
  const repoInfo = repo || await lookupRepo(input, { fetcher })
  const tag = repoInfo.tags.find(t => t.name === tagName)
  if (!tag) throw new PluginImportError(`${repoInfo.owner}/${repoInfo.repo} has no version tag named “${tagName}”`, { status: 404 })
  const at = { owner: repoInfo.owner, repo: repoInfo.repo, sha: tag.sha }

  const manifestBytes = await raw(at, 'parallax-plugin.json', LIMITS.manifestBytes, fetcher)
  if (!manifestBytes) throw new PluginImportError(`There’s no parallax-plugin.json at the root of the repo at ${tag.name}`)
  let rawManifest
  try {
    rawManifest = JSON.parse(manifestBytes.toString('utf8'))
  } catch (err) {
    throw new PluginImportError(`parallax-plugin.json isn’t valid JSON: ${err.message}`)
  }

  const tree = await api(`/repos/${at.owner}/${at.repo}/git/trees/${tag.sha}?recursive=1`, fetcher)
  if (!tree || !Array.isArray(tree.tree)) throw new PluginImportError('GitHub didn’t list the repo’s files at that tag', { status: 502 })
  if (tree.truncated) throw new PluginImportError('The repo has too many files for GitHub to list at once. Keep the plugin in a repo of its own.')
  const inDist = tree.tree.filter(e => typeof e.path === 'string' && e.path.startsWith('dist/') && e.type === 'blob')
  const files = inDist.map(e => ({ path: e.path.slice('dist/'.length), size: Number(e.size) || 0, sha: e.sha, link: e.mode === '120000' }))

  const { manifest, problems } = checkManifest(rawManifest, { version: tag.version, files: new Set(files.map(f => f.path)) })
  if (!files.length) problems.push('There are no files in dist/ at that tag. Commit the built plugin there.')
  if (files.length > LIMITS.files) problems.push(`dist/ has ${files.length} files; a plugin can have at most ${LIMITS.files}`)
  for (const f of files) {
    if (f.link) problems.push(`dist/${f.path} is a symbolic link, which a plugin can’t have`)
    else if (f.size > LIMITS.fileBytes) problems.push(`dist/${f.path} is ${formatBytes(f.size)}; a file can be at most ${formatBytes(LIMITS.fileBytes)}`)
  }
  const total = files.reduce((n, f) => n + f.size, 0)
  if (total > LIMITS.totalBytes) problems.push(`dist/ holds ${formatBytes(total)}; a plugin can be at most ${formatBytes(LIMITS.totalBytes)}`)
  if (problems.length) {
    throw new PluginImportError(problems.length === 1 ? problems[0] : `The plugin at ${tag.name} breaks ${problems.length} of the rules`, { problems })
  }

  const stored = []
  for (const f of files) {
    const content = await raw(at, `dist/${f.path}`, LIMITS.fileBytes, fetcher)
    if (!content) throw new PluginImportError(`dist/${f.path} couldn’t be downloaded`, { status: 502 })
    if (gitBlobSha(content) !== f.sha) throw new PluginImportError(`dist/${f.path} didn’t match the commit’s copy of it. Try again.`, { status: 502 })
    stored.push({ path: f.path, content, sha256: sha256(content), contentType: contentTypeFor(f.path) })
  }

  let readme = null
  const readmeEntry = tree.tree.find(e => e.type === 'blob' && /^readme\.md$/i.test(e.path || ''))
  if (readmeEntry && Number(readmeEntry.size) <= LIMITS.readmeBytes) {
    const bytes = await raw(at, readmeEntry.path, LIMITS.readmeBytes, fetcher)
    if (bytes && gitBlobSha(bytes) === readmeEntry.sha) readme = bytes.toString('utf8')
  }

  // One hash for the whole version: its manifest, and each file's path and hash
  const whole = crypto.createHash('sha256').update(JSON.stringify(manifest))
  for (const f of [...stored].sort((a, b) => (a.path < b.path ? -1 : 1))) whole.update(`\n${f.path}\0${f.sha256}`)

  return {
    owner: repoInfo.owner, repo: repoInfo.repo, url: repoInfo.url, description: repoInfo.description, stars: repoInfo.stars, avatar: repoInfo.avatar,
    tag: tag.name, version: tag.version, commitSha: tag.sha, manifest, readme,
    files: stored, sizeBytes: stored.reduce((n, f) => n + f.content.length, 0), sha256: whole.digest('hex'),
  }
}

module.exports = {
  PluginImportError, parseRepoUrl, lookupRepo, fetchVersion, checkManifest, compareVersions, slugFor, gitBlobSha,
  LIMITS, CATEGORIES, VERSION_TAG_RE,
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Links to the browser libraries listed in ../vendor-libraries.js, for pages
// the server builds: libUrl gives the jsDelivr link at the bundled version
// (what exports keep), and localizeLibraries points links it has a copy of
// at /vendor/ on this server. The client's utils/libraries.js is the same
// logic for pages built in the browser; both run the same tests.

const fs = require('fs')
const path = require('path')
const { packages, cdnjs } = require('../vendor-libraries')

// The versions the build copied, from its manifest (next to the server in the
// Docker image and the desktop app), or else the exact ones pinned in the
// root package.json, which the dev server serves
function readVersions() {
  const root = path.join(__dirname, '..', '..')
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
  try {
    return read('client/dist/vendor/manifest.json').versions
  } catch {}
  try {
    const { devDependencies = {} } = read('package.json')
    return Object.fromEntries(Object.keys(packages).filter(name => devDependencies[name]).map(name => [name, devDependencies[name]]))
  } catch (err) {
    console.warn('Could not read library versions; presentations will load libraries from jsDelivr:', err.message)
    return {}
  }
}
const versions = readVersions()

const JSDELIVR_RE = /https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)(?:@([0-9A-Za-z.^~-]+))?(\/[^\s"'`<>()\\&?#]*)?/g
const CDNJS_RE = /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/([a-z0-9._-]+)\/([0-9A-Za-z.-]+)\/([^\s"'`<>()\\&?#]+)/g

function globToRegExp(glob) {
  const escape = s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${glob.split('**').map(part => part.split('*').map(escape).join('[^/]*')).join('.*')}$`)
}
const patterns = Object.fromEntries(Object.entries(packages).map(([name, p]) => [name, p.files.map(globToRegExp)]))

// Whether a link asking for `requested` can use `installed`: the same major
// version, or for 0.x the same minor, which is how those break
function compatible(requested, installed) {
  if (!requested || requested === 'latest') return true
  const [rMajor, rMinor] = requested.replace(/^[\^~]/, '').split('.')
  const [iMajor, iMinor] = installed.split('.')
  if (rMajor !== iMajor) return false
  return iMajor !== '0' || rMinor === undefined || rMinor === iMinor
}

// The bundled file a link means, or null when there's no copy of it
function bundled(name, requested, file) {
  const version = versions[name]
  if (!version || !packages[name] || !compatible(requested, version)) return null
  const filePath = file || packages[name].main
  if (!filePath || !patterns[name].some(re => re.test(filePath))) return null
  return `/vendor/${name}@${version}/${filePath}`
}

// A library file's jsDelivr link, at the bundled version. Without versions
// (see readVersions) it's the file at jsDelivr's latest.
function libUrl(name, file) {
  if (!packages[name]) throw new Error(`${name} isn't in server/vendor-libraries.js`)
  return `https://cdn.jsdelivr.net/npm/${name}${versions[name] ? `@${versions[name]}` : ''}/${file}`
}

// Points the library links in `html` that have a bundled copy at `base`
// (relative to this server by default)
function localizeLibraries(html, base = '') {
  return html
    .replace(JSDELIVR_RE, (url, name, requested, file) => {
      const local = bundled(name, requested, file && file.slice(1))
      return local ? base + local : url
    })
    .replace(CDNJS_RE, (url, lib, requested, file) => {
      const alias = cdnjs[lib]
      const local = alias && bundled(alias.package, requested, `${alias.dir}/${file}`)
      return local ? base + local : url
    })
}

module.exports = { libUrl, localizeLibraries, compatible, versions }

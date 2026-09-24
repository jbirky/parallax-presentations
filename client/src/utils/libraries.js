// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Links to the browser libraries listed in server/vendor-libraries.js. Pages
// are written with jsDelivr links (libUrl), which is what standalone exports
// keep; pages opened in the app go through localizeLibraries, which points
// every link it has a copy of at this app's /vendor/ instead, so they work
// offline. That includes links in users' own embed code, as long as the
// version they ask for is compatible with the one bundled.
//
// server/services/libraries.js does the same for pages the server builds;
// the two are tested against the same cases.

/* global __VENDOR_LIBRARIES__ */
const { packages, cdnjs, versions } = __VENDOR_LIBRARIES__

const JSDELIVR_RE = /https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)(?:@([0-9A-Za-z.^~-]+))?(\/[^\s"'`<>()\\&?#]*)?/g
const CDNJS_RE = /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/([a-z0-9._-]+)\/([0-9A-Za-z.-]+)\/([^\s"'`<>()\\&?#]+)/g

function globToRegExp(glob) {
  const escape = s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${glob.split('**').map(part => part.split('*').map(escape).join('[^/]*')).join('.*')}$`)
}
const patterns = Object.fromEntries(Object.entries(packages).map(([name, p]) => [name, p.files.map(globToRegExp)]))

// Whether a link asking for `requested` can use `installed`: the same major
// version, or for 0.x the same minor, which is how those break
export function compatible(requested, installed) {
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
  const path = file || packages[name].main
  if (!path || !patterns[name].some(re => re.test(path))) return null
  return `/vendor/${name}@${version}/${path}`
}

// A library file's jsDelivr link, at the bundled version
export function libUrl(name, file) {
  if (!versions[name]) throw new Error(`${name} isn't in server/vendor-libraries.js`)
  return `https://cdn.jsdelivr.net/npm/${name}@${versions[name]}/${file}`
}

// Points the library links in `html` that have a bundled copy at `base`
// (this app's origin, since present windows are blob: pages)
export function localizeLibraries(html, base = globalThis.location?.origin || '') {
  return html
    .replace(JSDELIVR_RE, (url, name, requested, file) => {
      const local = bundled(name, requested, file?.slice(1))
      return local ? base + local : url
    })
    .replace(CDNJS_RE, (url, lib, requested, file) => {
      const alias = cdnjs[lib]
      const local = alias && bundled(alias.package, requested, `${alias.dir}/${file}`)
      return local ? base + local : url
    })
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// How an uploaded file is served from this site. Its type comes from its
// extension, never from the uploader: a browser's multipart Content-Type is
// whatever the uploader says, and a ".png" served as text/html, or any SVG,
// would run its script on this site, as whoever opened the link. Every
// response gets a sandbox CSP as well, so a file opened on its own gets an
// origin of its own (an SVG's scripts can't reach this site's cookies or API),
// and anything that isn't media, a PDF or a font is a download.

const path = require('path')

const UPLOAD_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp', '.tiff': 'image/tiff', '.tif': 'image/tiff',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg', '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.aac': 'audio/aac',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
}

const DOWNLOAD = 'application/octet-stream'

function uploadContentType(name) {
  return UPLOAD_TYPES[path.extname(String(name || '')).toLowerCase()] || DOWNLOAD
}

// Before the body is sent. PDFs get no sandbox: browsers' PDF viewers won't
// open in one, and they don't run a PDF's script as the page
function setUploadHeaders(res, name) {
  const type = uploadContentType(name)
  res.setHeader('Content-Type', type)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (type !== 'application/pdf') res.setHeader('Content-Security-Policy', 'sandbox')
  if (type === DOWNLOAD) res.setHeader('Content-Disposition', 'attachment')
}

module.exports = { uploadContentType, setUploadHeaders }

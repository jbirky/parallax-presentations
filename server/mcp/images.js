// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Pictures an AI adds to slides (add_image, request_upload in index.js):
// what a file is, read from its bytes rather than its name, with its size in
// pixels; and one-time upload addresses, so an agent that has a file on its
// computer (Claude Code) can send it with curl, without base64 in a tool call.

const crypto = require('crypto')
const { base32 } = require('../services/ai-links')

// The pictures a slide takes, by what their bytes say they are
const IMAGE_TYPES = {
  png: { ext: '.png', mime: 'image/png' },
  jpeg: { ext: '.jpg', mime: 'image/jpeg' },
  gif: { ext: '.gif', mime: 'image/gif' },
  webp: { ext: '.webp', mime: 'image/webp' },
  svg: { ext: '.svg', mime: 'image/svg+xml' },
}
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
// base64 in add_image: at most this many bytes once decoded
const MAX_INLINE_BYTES = 2 * 1024 * 1024
// An upload or a fetched picture: at most this, or the plan's file limit if
// that's smaller
const MAX_IMAGE_BYTES = 50 * 1024 * 1024

const svgLength = v => {
  const m = /^\s*([\d.]+)\s*(px)?\s*$/.exec(v || '')
  return m ? Number(m[1]) : null
}

// { type, ext, mime, width, height } for a picture a slide takes, or null.
// width and height are null when its bytes don't say (some SVGs).
function imageInfo(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null
  const out = (type, width, height) => ({ type, ...IMAGE_TYPES[type], width: width > 0 ? width : null, height: height > 0 ? height : null })
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.toString('ascii', 12, 16) === 'IHDR') return out('png', buf.readUInt32BE(16), buf.readUInt32BE(20))
  if (buf.toString('ascii', 0, 4) === 'GIF8') return out('gif', buf.readUInt16LE(6), buf.readUInt16LE(8))
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16)
    if (kind === 'VP8 ' && buf.length >= 30) return out('webp', buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff)
    if (kind === 'VP8L' && buf.length >= 25) {
      const b = buf.readUInt32LE(21)
      return out('webp', (b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1)
    }
    if (kind === 'VP8X' && buf.length >= 30) return out('webp', buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1)
    return out('webp', 0, 0)
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue }
      const marker = buf[i + 1]
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue }
      const length = buf.readUInt16BE(i + 2)
      // Start of a frame: its height, then its width
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return out('jpeg', buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5))
      i += 2 + length
    }
    return out('jpeg', 0, 0)
  }
  const head = buf.toString('utf8', 0, Math.min(buf.length, 4096)).replace(/^﻿/, '').trimStart()
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) {
    const tag = /<svg[^>]*>/i.exec(head)?.[0] || ''
    const attr = name => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1]
    let width = svgLength(attr('width')), height = svgLength(attr('height'))
    const box = (attr('viewBox') || '').trim().split(/[\s,]+/).map(Number)
    if ((!width || !height) && box.length === 4 && box[2] > 0 && box[3] > 0) { width = box[2]; height = box[3] }
    return out('svg', width, height)
  }
  return null
}

// One-time upload addresses: make(info) gives a ticket for /mcp/upload/<ticket>
// that lasts ttlMs; take(ticket) gives its info once, or null when it's
// unknown, used or expired. A link or token has at most perOwner at once.
function uploadTickets({ ttlMs = 10 * 60 * 1000, perOwner = 20, now = Date.now } = {}) {
  const tickets = new Map()
  const sweep = () => { for (const [k, v] of tickets) if (v.expires <= now()) tickets.delete(k) }
  return {
    ttlMs,
    make(owner, info) {
      sweep()
      const mine = [...tickets.values()].filter(v => v.owner === owner)
      if (mine.length >= perOwner) return null
      const ticket = base32(crypto.randomBytes(24))
      tickets.set(ticket, { owner, info, expires: now() + ttlMs })
      return ticket
    },
    take(ticket) {
      const found = typeof ticket === 'string' && tickets.get(ticket)
      if (!found) return null
      tickets.delete(ticket)
      return found.expires > now() ? found.info : null
    },
  }
}

module.exports = { imageInfo, uploadTickets, IMAGE_TYPES, IMAGE_EXTENSIONS, MAX_INLINE_BYTES, MAX_IMAGE_BYTES }

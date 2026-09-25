// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Storage limits for uploads, checked from Content-Length before multer writes
// the file to disk. Guests are checked in guestAuth; signed-in users on a plan
// by uploadQuota on each upload route.

const { planFor } = require('../services/plans')

// Allowance for multipart framing around the file itself
const MULTIPART_OVERHEAD = 64 * 1024
// A refused upload is read to the end before answering (see refuseUpload),
// unless it is bigger than this
const DRAIN_LIMIT = 100 * 1024 * 1024

function formatSize(bytes) {
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 1 ? `${Math.round(gb * 10) / 10} GB` : `${Math.round(bytes / (1024 * 1024))} MB`
}

// Bytes a user stores: each file once (a duplicated presentation shares its
// files with the original) plus datasets
async function storageUsedBytes(storage, userId) {
  const { rows } = await storage.query(
    `SELECT (SELECT COALESCE(SUM(size_bytes), 0) FROM (
               SELECT DISTINCT ON (storage_key) size_bytes FROM uploads WHERE user_id = $1) files)
          + (SELECT COALESCE(SUM(byte_size), 0) FROM datasets WHERE user_id = $1) AS used`,
    [userId]
  )
  return Number(rows[0].used)
}

// Returns { status, error } when the upload can't be taken, or null.
// `messages` words the refusals: { fileTooBig(limit), storageFull(limit) }.
// The file goes on userId's storage, the uploader's own unless given.
async function checkUpload(storage, req, { maxFileBytes, storageBytes }, messages, userId = req.userId) {
  const length = Number(req.get('content-length'))
  if (!length) return { status: 411, error: 'Upload size is required' }
  if (maxFileBytes && length > maxFileBytes + MULTIPART_OVERHEAD) {
    return { status: 413, error: messages.fileTooBig(formatSize(maxFileBytes)) }
  }
  if (storageBytes && await storageUsedBytes(storage, userId) + length > storageBytes + MULTIPART_OVERHEAD) {
    return { status: 413, error: messages.storageFull(formatSize(storageBytes)) }
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

// Upload routes for signed-in users: refuses a file that would take them over
// their plan's storage. Only Postgres storage (cloud) has plans and usage. An
// upload to a presentation someone else owns (req.deck, from deckAccess) goes
// on the owner's storage, under the owner's plan.
function uploadQuota(storage) {
  return async (req, res, next) => {
    if (!storage.query || !req.userId || req.isGuest) return next()
    const forOwner = req.deck && req.deck.role !== 'owner'
    const plan = planFor(forOwner ? req.deck.ownerPlan : req.userPlan)
    const messages = forOwner ? {
      fileTooBig: limit => `Files are limited to ${limit} each on the owner's ${plan.name} plan.`,
      storageFull: limit => `The owner's storage is full (${limit} on the ${plan.name} plan). Ask them to free some space.`,
    } : {
      fileTooBig: limit => `Files are limited to ${limit} each on the ${plan.name} plan.`,
      storageFull: limit => plan.id === 'free'
        ? `Your storage is full (${limit} on the ${plan.name} plan). Delete some files or upgrade to upload more.`
        : `Your storage is full (${limit} on the ${plan.name} plan). Delete some files to upload more.`,
    }
    try {
      const problem = await checkUpload(storage, req, plan, messages, forOwner ? req.deck.ownerId : req.userId)
      if (problem) return refuseUpload(req, res, problem)
      next()
    } catch (err) {
      next(err)
    }
  }
}

module.exports = { storageUsedBytes, checkUpload, refuseUpload, uploadQuota }

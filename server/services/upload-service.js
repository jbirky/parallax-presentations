// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const path = require('path')
const fs = require('fs-extra')
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const { isR2Enabled, uploadToR2, deleteFromR2, deleteManyFromR2 } = require('./r2')

async function handleUpload(filePath, originalFilename, mimetype, { presentationId, userId, storage, keyPrefix }) {
  const contentType = mimetype || 'application/octet-stream'
  const fileHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')

  if (storage && storage.query && presentationId) {
    const { rows } = await storage.query(
      'SELECT filename FROM uploads WHERE presentation_id = $1 AND file_hash = $2 LIMIT 1',
      [presentationId, fileHash]
    )
    if (rows.length) {
      fs.removeSync(filePath)
      return { url: `/uploads/${rows[0].filename}` }
    }
  }

  const ext = path.extname(originalFilename || filePath)
  const fileName = `${uuidv4()}${ext}`
  const urlFilename = presentationId ? `${presentationId}/${fileName}` : fileName
  const storageKey = `${keyPrefix || userId || 'anonymous'}/${urlFilename}`

  const { size } = await uploadToR2(filePath, storageKey, contentType)

  if (storage && storage.query) {
    await storage.query(
      'INSERT INTO uploads (id, presentation_id, user_id, filename, storage_key, content_type, size_bytes, file_hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [uuidv4(), presentationId || null, userId || null, urlFilename, storageKey, contentType, size, fileHash]
    )
  }

  fs.removeSync(filePath)
  return { url: `/uploads/${urlFilename}` }
}

async function deleteUploadsForPresentation(presentationId, storage) {
  if (!storage || !storage.query) return
  const { rows } = await storage.query(
    'SELECT storage_key FROM uploads WHERE presentation_id = $1',
    [presentationId]
  )
  for (const row of rows) {
    try { await deleteFromR2(row.storage_key) } catch (e) {
      console.error('R2 delete failed:', e.message)
    }
  }
}

// Hard-deletes free-tier presentations that expired more than 7 days ago,
// deleting their R2 files first. A file still used by another upload row
// is kept. If any file can't be deleted, that batch is left for the next run
// so no rows are removed while their files remain.
async function sweepExpiredPresentations(storage) {
  let deleted = 0
  for (let round = 0; round < 20; round++) {
    const { rows } = await storage.query(
      "SELECT id FROM presentations WHERE expires_at IS NOT NULL AND expires_at < NOW() - INTERVAL '7 days' LIMIT 100"
    )
    if (!rows.length) break
    const ids = rows.map(r => r.id)
    if (isR2Enabled()) {
      const { rows: keyRows } = await storage.query(
        `SELECT DISTINCT u.storage_key FROM uploads u
          WHERE u.presentation_id = ANY($1::uuid[])
            AND NOT EXISTS (
              SELECT 1 FROM uploads o
               WHERE o.storage_key = u.storage_key
                 AND (o.presentation_id IS NULL OR o.presentation_id <> ALL($1::uuid[])))`,
        [ids]
      )
      const failed = await deleteManyFromR2(keyRows.map(r => r.storage_key))
      if (failed.length) throw new Error(`could not delete ${failed.length} R2 files; will retry`)
    }
    const { rowCount } = await storage.query('DELETE FROM presentations WHERE id = ANY($1::uuid[])', [ids])
    deleted += rowCount
    if (rows.length < 100) break
  }
  return deleted
}

module.exports = { handleUpload, deleteUploadsForPresentation, sweepExpiredPresentations }

-- A presentation duplicated before copies got their own upload rows uses the
-- original's files with no rows of its own, so deleting the original deleted
-- those files. Give each such presentation rows for the files its slides use.
-- Uploads with no presentation (the global /api/upload) aren't at risk.
INSERT INTO uploads (presentation_id, user_id, filename, storage_key, content_type, size_bytes, file_hash)
SELECT DISTINCT ON (p.id, u.storage_key)
       p.id, u.user_id, u.filename, u.storage_key, u.content_type, u.size_bytes, u.file_hash
  FROM presentations p
  JOIN uploads u ON u.user_id = p.user_id AND u.presentation_id <> p.id
 WHERE p.data::text LIKE '%/uploads/' || u.filename || '%'
   AND NOT EXISTS (
     SELECT 1 FROM uploads x WHERE x.presentation_id = p.id AND x.storage_key = u.storage_key)
 ORDER BY p.id, u.storage_key, u.created_at;

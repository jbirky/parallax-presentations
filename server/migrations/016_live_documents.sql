-- Live editing: a presentation's Yjs document, once it has been opened live
-- (server/services/collab.js). From then on it's what counts, and data is
-- written from it after each change.
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS ydoc BYTEA;

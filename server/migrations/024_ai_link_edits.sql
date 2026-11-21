-- AI collaborator links that edit (server/mcp): when each last edited, so
-- the first edit after a quiet spell starts a session with a version saved
-- first, and which versions those are, so a deck keeps only the latest few
ALTER TABLE ai_links ADD COLUMN IF NOT EXISTS last_edit_at TIMESTAMPTZ;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS ai_link_id UUID REFERENCES ai_links(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS snapshots_ai_link ON snapshots (presentation_id, created_at) WHERE ai_link_id IS NOT NULL;

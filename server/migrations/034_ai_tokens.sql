-- AI access tokens (services/ai-tokens.js): a token for a person's whole
-- account that an AI agent (Claude Code, through the parallax plugin) sends
-- to the account-level MCP server at /mcp as "Authorization: Bearer <token>".
-- As with AI collaborator links, only the secret's SHA-256 is kept, with its
-- last four characters to tell tokens apart, and a revoked token keeps its
-- row (revoked_at) until its person is deleted.
CREATE TABLE IF NOT EXISTS ai_tokens (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  token_hint   TEXT NOT NULL,
  scopes       TEXT[] NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ai_tokens_user ON ai_tokens (user_id);

-- When a token last edited each presentation, so the first edit after a
-- quiet spell starts a session with a version saved first (as
-- ai_links.last_edit_at does for links)
CREATE TABLE IF NOT EXISTS ai_token_edits (
  token_id        UUID NOT NULL REFERENCES ai_tokens(id) ON DELETE CASCADE,
  presentation_id UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  last_edit_at    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (token_id, presentation_id)
);

-- Which versions a token's sessions saved, so a deck keeps only the latest
-- few of the AI's versions
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS ai_token_id UUID REFERENCES ai_tokens(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS snapshots_ai_token ON snapshots (presentation_id, created_at) WHERE ai_token_id IS NOT NULL;

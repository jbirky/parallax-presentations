-- AI collaborator links (services/ai-links.js): a link to one presentation
-- that an AI chat app adds as a connector, an MCP server at /mcp/<secret>.
-- Only the secret's SHA-256 is kept, with its last four characters to tell
-- links apart. A revoked link keeps its row (revoked_at) until its
-- presentation is deleted.
CREATE TABLE IF NOT EXISTS ai_links (
  id              UUID PRIMARY KEY,
  presentation_id UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  token_hash      TEXT NOT NULL UNIQUE,
  token_hint      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  last_used_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ai_links_presentation ON ai_links (presentation_id);

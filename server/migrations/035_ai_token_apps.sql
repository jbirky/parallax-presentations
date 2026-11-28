-- Apps a person connected to the account-level MCP server by signing in
-- (server/mcp/oauth.js): claude.ai, ChatGPT and other MCP clients that sign
-- in through Clerk's OAuth instead of sending an AI access token. Each app
-- is a row in ai_tokens with no secret of its own, keyed by its OAuth client
-- id, so its edits, versions and avatar name work as a token's do, and the
-- person can turn it off under AI access (revoked_at) and allow it again.
ALTER TABLE ai_tokens ADD COLUMN IF NOT EXISTS oauth_client TEXT;
ALTER TABLE ai_tokens ALTER COLUMN token_hash DROP NOT NULL;
ALTER TABLE ai_tokens ALTER COLUMN token_hint DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ai_tokens_app ON ai_tokens (user_id, oauth_client) WHERE oauth_client IS NOT NULL;

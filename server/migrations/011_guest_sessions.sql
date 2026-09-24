-- Guest mode: account-free editor sessions. Each session owns a users row
-- (plan 'guest'); both are deleted when the tab closes or after 12 hours
-- without activity.
CREATE TABLE IF NOT EXISTS guest_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT UNIQUE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closing_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_last_active ON guest_sessions (last_active_at);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_closing ON guest_sessions (closing_at) WHERE closing_at IS NOT NULL;

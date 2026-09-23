-- CPU-heavy jobs per user (video conversion, PowerPoint import, Manim
-- renders), so the admin dashboard can show who uses the most processing.
CREATE TABLE IF NOT EXISTS usage_events (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  duration_ms  INTEGER NOT NULL,
  bytes        BIGINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events (created_at);

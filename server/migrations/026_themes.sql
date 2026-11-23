-- The theme library: each person's saved themes, the documents
-- client/src/utils/customTheme.js describes (a base theme, colors, font, text
-- styles and a stylesheet). A deck keeps its own copy of the theme it used,
-- with the id and version it came from, so a saved theme changing never
-- changes a deck until its owner takes the update (GET/POST/PUT/DELETE
-- /api/themes, server/index.js).
CREATE TABLE IF NOT EXISTS themes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  doc         JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_themes_user ON themes(user_id, name);

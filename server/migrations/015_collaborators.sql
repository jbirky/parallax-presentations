-- Editing a presentation with others. Its owner shares an invite link; each
-- person who opens it signed in becomes an editor. Editors' uploads count
-- against the owner's storage.
CREATE TABLE IF NOT EXISTS presentation_collaborators (
  presentation_id UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'editor' CHECK (role = 'editor'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (presentation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_collaborators_user ON presentation_collaborators (user_id);

-- The invite link's token; NULL while the link is off
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS invite_token UUID UNIQUE;

-- Goes up with each save that changes the presentation. A save made from an
-- older version is refused, so one editor's save can't silently undo another's.
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

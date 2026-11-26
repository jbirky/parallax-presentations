-- Teams, phase 2: team decks and their folders. A team deck has a team_id
-- (the column has been on presentations since 001) and, if it's filed, a
-- folder_id; user_id stays whoever made it. Its uploads count against the
-- team through the deck, so uploads need no column of their own.
-- Re-runnable, like every migration here.

CREATE TABLE IF NOT EXISTS folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  -- Folders can nest; the app shows one level for now. A deleted folder's
  -- folders move up to the top level, like its decks.
  parent_id   UUID REFERENCES folders(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_folders_team ON folders (team_id);
-- One folder of a name in each place
CREATE UNIQUE INDEX IF NOT EXISTS folders_unique_name
  ON folders (team_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- Deleting a folder leaves its decks at the team's top level
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_presentations_folder ON presentations (folder_id) WHERE folder_id IS NOT NULL;

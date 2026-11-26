-- Folders for a person's own presentations, as well as a team's. A folder
-- belongs to a team (team_id) or a person (user_id), never both; neither, on a
-- self-hosted server, where there's one person and no accounts. A personal
-- deck's folder_id is one of its owner's folders.
-- Re-runnable, like every migration here.

ALTER TABLE folders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE folders ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE folders DROP CONSTRAINT IF EXISTS folders_one_owner;
ALTER TABLE folders ADD CONSTRAINT folders_one_owner CHECK (team_id IS NULL OR user_id IS NULL);
CREATE INDEX IF NOT EXISTS idx_folders_user ON folders (user_id) WHERE user_id IS NOT NULL;

-- One folder of a name in each place, now that places can be people's too
DROP INDEX IF EXISTS folders_unique_name;
CREATE UNIQUE INDEX IF NOT EXISTS folders_unique_place_name ON folders (
  COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(name)
);

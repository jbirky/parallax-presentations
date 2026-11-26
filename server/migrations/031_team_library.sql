-- Teams, phase 4: the team library. A theme, font or dataset with a team_id
-- is the team's: its members use it, and it stays with the team when whoever
-- added it (user_id) leaves. If the team is deleted it goes back to them.
-- A team's templates are template presentations with a team_id (that column
-- has been on presentations since 001).
-- Re-runnable, like every migration here.

ALTER TABLE themes ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_themes_team ON themes (team_id) WHERE team_id IS NOT NULL;

ALTER TABLE user_fonts ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_user_fonts_team ON user_fonts (team_id) WHERE team_id IS NOT NULL;

-- A team's dataset refreshes on the team's plan and counts against the
-- team's storage and live-dataset allowance
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_datasets_team ON datasets (team_id) WHERE team_id IS NOT NULL;

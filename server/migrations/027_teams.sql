-- Teams, phase 1: members with roles, seats, and invite links. The teams and
-- team_members tables have been here since 001, unused; this fills them out.
-- Re-runnable, like every migration here.

-- Seats: the members a team pays for (viewers take none). It replaces
-- max_members, which nothing read.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'max_members')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'seats') THEN
    ALTER TABLE teams RENAME COLUMN max_members TO seats;
  END IF;
END $$;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS seats INT;
UPDATE teams SET seats = 3 WHERE seats IS NULL;
ALTER TABLE teams ALTER COLUMN seats SET DEFAULT 3;
ALTER TABLE teams ALTER COLUMN seats SET NOT NULL;

-- active, past_due (a payment failed; everything still works) or lapsed (the
-- subscription ended; the team's decks are read-only)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_status_check;
ALTER TABLE teams ADD CONSTRAINT teams_status_check CHECK (status IN ('active', 'past_due', 'lapsed'));
ALTER TABLE teams ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Roles: one owner, then admins, members and viewers. teams.owner_id is kept
-- equal to the owner's row here.
UPDATE team_members SET role = 'member' WHERE role IS NULL OR role NOT IN ('owner', 'admin', 'member', 'viewer');
ALTER TABLE team_members ALTER COLUMN role SET NOT NULL;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_role_check CHECK (role IN ('owner', 'admin', 'member', 'viewer'));
CREATE UNIQUE INDEX IF NOT EXISTS team_members_one_owner ON team_members (team_id) WHERE role = 'owner';
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id);

-- Invite links. The link's secret is kept only as a hash; token_hint is its
-- last characters, to tell links apart. A link works for anyone signed in, or
-- only for `email` when one is set, until it expires or is revoked.
CREATE TABLE IF NOT EXISTS team_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  email       TEXT,
  token_hash  TEXT NOT NULL UNIQUE,
  token_hint  TEXT NOT NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_team_invites_team ON team_invites (team_id);

-- The optional questions a new account is asked on the dashboard: their field,
-- career stage, why Parallax and how they heard of it
-- (services/signup-survey.js). One row per account; skipped marks someone
-- who passed without answering, so they aren't asked again. Only admins see
-- the answers, and an account's go with it.
-- Re-runnable, like every migration here.

CREATE TABLE IF NOT EXISTS signup_answers (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  field         TEXT,
  field_other   TEXT,
  career_stage  TEXT,
  career_other  TEXT,
  reasons       TEXT[] NOT NULL DEFAULT '{}',
  reason_other  TEXT,
  heard_from    TEXT,
  heard_other   TEXT,
  skipped       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

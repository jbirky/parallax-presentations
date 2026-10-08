-- Community plugins: each one a public GitHub repo, imported a tag at a time
-- (services/plugin-import.js) and listed once an admin approves a version
-- (services/community-plugins.js). A community plugin's row in plugins is
-- keyed by its repo; manifest_id is its manifest's id, which decks store on
-- its elements, so it never changes. name, description, version, manifest,
-- readme and published follow the newest approved version; published is
-- false until one is approved. downloads counts installs.
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS manifest_id TEXT;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS repo_owner TEXT;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS repo_name TEXT;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS readme TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS plugins_manifest_id ON plugins (manifest_id);
CREATE UNIQUE INDEX IF NOT EXISTS plugins_repo ON plugins (lower(repo_owner), lower(repo_name));

-- One imported tag. Its files never change once stored; status moves
-- pending -> approved or rejected, and approved -> revoked. A revoked
-- version is never served, and decks show a placeholder in its place.
CREATE TABLE IF NOT EXISTS plugin_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id      UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  version        TEXT NOT NULL,
  tag            TEXT NOT NULL,
  commit_sha     TEXT NOT NULL,
  manifest       JSONB NOT NULL,
  readme         TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  review_note    TEXT NOT NULL DEFAULT '',
  submitted_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  sha256         TEXT NOT NULL,
  size_bytes     INTEGER NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ,
  UNIQUE (plugin_id, version)
);
CREATE INDEX IF NOT EXISTS plugin_versions_status ON plugin_versions (status);
CREATE INDEX IF NOT EXISTS plugin_versions_submitted_by ON plugin_versions (submitted_by);

-- A version's files, from the repo's dist/ folder, by their path inside it
CREATE TABLE IF NOT EXISTS plugin_files (
  version_id     UUID NOT NULL REFERENCES plugin_versions(id) ON DELETE CASCADE,
  path           TEXT NOT NULL,
  content        BYTEA NOT NULL,
  content_type   TEXT NOT NULL,
  sha256         TEXT NOT NULL,
  PRIMARY KEY (version_id, path)
);

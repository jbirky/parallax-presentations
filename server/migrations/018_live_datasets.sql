-- Live datasets: a dataset fetched from a URL or a TAP query on a schedule,
-- each change kept as a version, and transforms that shape it for slides.
-- Every statement can run again: run.js runs every file each time.

-- Every dataset's saved copies; an upload is version 1
CREATE TABLE IF NOT EXISTS dataset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  format TEXT NOT NULL,
  content_hash TEXT,
  columns JSONB NOT NULL DEFAULT '[]',
  row_count INTEGER,
  byte_size BIGINT NOT NULL DEFAULT 0,
  etag TEXT,
  last_modified TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dataset_versions_dataset ON dataset_versions(dataset_id, created_at DESC);

-- Where a dataset comes from and when it's next fetched. source holds the
-- connector's settings; source_secret one request header, encrypted
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'upload';
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS source JSONB;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS source_secret TEXT;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS schedule TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS next_fetch_at TIMESTAMPTZ;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMPTZ;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS fetch_lease_until TIMESTAMPTZ;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES dataset_versions(id) ON DELETE SET NULL;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS transforms JSONB NOT NULL DEFAULT '[]';

ALTER TABLE datasets DROP CONSTRAINT IF EXISTS datasets_source_kind_check;
ALTER TABLE datasets ADD CONSTRAINT datasets_source_kind_check CHECK (source_kind IN ('upload', 'url', 'tap'));
ALTER TABLE datasets DROP CONSTRAINT IF EXISTS datasets_schedule_check;
ALTER TABLE datasets ADD CONSTRAINT datasets_schedule_check CHECK (schedule IN ('manual', 'hourly', 'daily', 'weekly'));
-- 'columns': the column-by-column copy live datasets and new uploads are stored as
ALTER TABLE datasets DROP CONSTRAINT IF EXISTS datasets_format_check;
ALTER TABLE datasets ADD CONSTRAINT datasets_format_check CHECK (format IN ('csv', 'json', 'parquet', 'tsv', 'columns'));

CREATE INDEX IF NOT EXISTS idx_datasets_next_fetch ON datasets(next_fetch_at) WHERE source_kind <> 'upload';

-- What each fetch did, for the dataset panel; kept 30 days
CREATE TABLE IF NOT EXISTS dataset_fetches (
  id BIGSERIAL PRIMARY KEY,
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  outcome TEXT NOT NULL CHECK (outcome IN ('changed', 'unchanged', 'failed')),
  http_status INTEGER,
  bytes BIGINT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_dataset_fetches_dataset ON dataset_fetches(dataset_id, started_at DESC);

-- A deck can hold one version still, for a talk
ALTER TABLE presentation_datasets ADD COLUMN IF NOT EXISTS pinned_version_id UUID REFERENCES dataset_versions(id) ON DELETE SET NULL;

-- How many live datasets each plan has, and how often they may refresh
ALTER TABLE plans ADD COLUMN IF NOT EXISTS live_datasets INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS min_refresh TEXT;
UPDATE plans SET live_datasets = 0, min_refresh = 'weekly' WHERE id = 'guest' AND live_datasets IS NULL;
UPDATE plans SET live_datasets = 1, min_refresh = 'daily' WHERE id = 'free' AND live_datasets IS NULL;
UPDATE plans SET live_datasets = 25, min_refresh = 'hourly' WHERE id = 'pro' AND live_datasets IS NULL;
UPDATE plans SET live_datasets = 100, min_refresh = 'hourly' WHERE id = 'team' AND live_datasets IS NULL;

-- Every dataset already uploaded becomes its own version 1
INSERT INTO dataset_versions (dataset_id, storage_key, format, columns, row_count, byte_size, created_at)
SELECT d.id, d.storage_key, d.format, d.columns, d.row_count, COALESCE(d.byte_size, 0), d.updated_at
  FROM datasets d
 WHERE NOT EXISTS (SELECT 1 FROM dataset_versions v WHERE v.dataset_id = d.id);
UPDATE datasets d SET current_version_id = (
    SELECT v.id FROM dataset_versions v WHERE v.dataset_id = d.id ORDER BY v.created_at DESC LIMIT 1)
 WHERE current_version_id IS NULL;
-- An upload replaced by a server that predates this file changed only the
-- dataset row: its version follows it
UPDATE dataset_versions v
   SET storage_key = d.storage_key, format = d.format, columns = d.columns,
       row_count = d.row_count, byte_size = COALESCE(d.byte_size, 0)
  FROM datasets d
 WHERE d.current_version_id = v.id AND d.source_kind = 'upload' AND v.storage_key <> d.storage_key;

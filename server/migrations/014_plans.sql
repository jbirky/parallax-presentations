-- Plans (tiers) and their limits, edited from /admin. users.plan holds a
-- plan's id. NULL max_presentations means unlimited, NULL expiration_days
-- means presentations don't expire, and NULL max_file_bytes leaves only the
-- server's own upload cap. A plan with a stripe_price_id can be bought.
CREATE TABLE IF NOT EXISTS plans (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  storage_bytes         BIGINT NOT NULL,
  max_presentations     INTEGER,
  expiration_days       INTEGER,
  max_file_bytes        BIGINT,
  stripe_price_id       TEXT UNIQUE,
  price_label           TEXT,
  public                BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- The plans as they were built in, with Pro on the price checkout used until
-- now. Existing rows are left alone, so re-running keeps admins' edits.
INSERT INTO plans (id, name, storage_bytes, max_presentations, expiration_days, max_file_bytes, stripe_price_id, price_label, public, sort_order) VALUES
  ('free',  'Free',  104857600,   3,    30,   NULL,     NULL,                             'Free',   TRUE,  0),
  ('pro',   'Pro',   5368709120,  NULL, NULL, NULL,     'price_1TVnpZF9LOeD1Xd0coGVd0fI', '$5/mo',  TRUE,  1),
  ('team',  'Team',  26843545600, NULL, NULL, NULL,     NULL,                             NULL,     FALSE, 2),
  ('guest', 'Guest', 26214400,    1,    NULL, 10485760, NULL,                             NULL,     FALSE, 3)
ON CONFLICT (id) DO NOTHING;

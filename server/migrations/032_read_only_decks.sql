-- Presentations past a plan's limit become read-only instead of expiring
-- (the pricing plan's "What to build", 2): a plan's max_presentations is how
-- many of a person's own presentations they can edit, their newest, and the
-- rest can still be opened, presented, shared, copied and deleted. Nothing
-- expires or is deleted any more, so expiry dates are cleared.
--
-- Also: email domains that count as schools for the education price, beyond
-- the ones recognized by their ending (.edu, .ac.uk, ...), kept from /admin.
-- Re-runnable, like every migration here.

UPDATE plans SET expiration_days = NULL WHERE expiration_days IS NOT NULL;
UPDATE presentations SET expires_at = NULL WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS education_domains (
  domain     TEXT PRIMARY KEY CHECK (domain = lower(domain) AND domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

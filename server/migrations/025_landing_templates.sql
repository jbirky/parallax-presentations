-- The landing page's templates (its Templates tab): rows of landing_examples
-- of kind 'template', decks people copy into their account to start from
-- (POST /api/landing-templates/:slug/use), where an example is a deck to look
-- at. Edited from /admin with the examples (server/services/landing-examples.js).
ALTER TABLE landing_examples ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'example';
ALTER TABLE landing_examples DROP CONSTRAINT IF EXISTS landing_examples_kind_check;
ALTER TABLE landing_examples ADD CONSTRAINT landing_examples_kind_check
  CHECK (kind IN ('example', 'template') AND NOT (kind = 'template' AND hero));

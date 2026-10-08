-- The Gaia example (client/src/examples/catalog.js), which plots the
-- datasets the server fetches from ESA's Gaia archive
-- (server/services/example-datasets.js). Existing rows are left alone, so
-- re-running keeps admins' edits.
INSERT INTO landing_examples (slug, field, title, description, tags, builtin, card, hero, sort_order) VALUES
  ('gaia', 'Astronomy', 'The solar neighborhood', 'Every well-measured star within 50 parsecs, from ESA’s Gaia archive: an HR diagram, then counts that grow as distance squared.', '["Live dataset","Graph with data"]', TRUE, TRUE, FALSE, 11)
ON CONFLICT (slug) DO NOTHING;

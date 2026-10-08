-- The exoplanet example (client/src/examples/catalog.js), which plots the
-- datasets the server fetches from the NASA Exoplanet Archive
-- (server/services/example-datasets.js). Existing rows are left alone, so
-- re-running keeps admins' edits.
INSERT INTO landing_examples (slug, field, title, description, tags, builtin, card, hero, sort_order) VALUES
  ('exoplanets', 'Astronomy', 'Every exoplanet, kept current', 'A live dataset from the NASA Exoplanet Archive, refreshed daily: each planet’s period and mass, discoveries by year, and the newest finds.', '["Live dataset","Graph with data"]', TRUE, TRUE, FALSE, 10)
ON CONFLICT (slug) DO NOTHING;

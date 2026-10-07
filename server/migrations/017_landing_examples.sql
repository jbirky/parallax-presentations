-- The landing page's examples, edited from /admin (server/services/landing-examples.js).
-- A built-in example (builtin) shows the deck client/src/examples/decks.js
-- builds while deck is NULL; one added from a presentation keeps a copy of its
-- deck here, and source_presentation_id says which, for "Update from
-- presentation". card: one of the examples shown as cards. hero: the deck
-- at the top of the page, which the app keeps to exactly one. thumbnail: a
-- JPEG of the first slide, drawn by the server; NULL uses the built-in image.
CREATE TABLE IF NOT EXISTS landing_examples (
  slug                    TEXT PRIMARY KEY,
  field                   TEXT NOT NULL DEFAULT '',
  title                   TEXT NOT NULL,
  description             TEXT NOT NULL DEFAULT '',
  tags                    JSONB NOT NULL DEFAULT '[]',
  deck                    JSONB,
  source_presentation_id  UUID,
  thumbnail               BYTEA,
  builtin                 BOOLEAN NOT NULL DEFAULT FALSE,
  card                    BOOLEAN NOT NULL DEFAULT TRUE,
  hero                    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order              INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- The built-in examples, as client/src/examples/catalog.js has them. Existing
-- rows are left alone, so re-running keeps admins' edits.
INSERT INTO landing_examples (slug, field, title, description, tags, builtin, card, hero, sort_order) VALUES
  ('hero', '', 'Parallax', 'A galaxy rotation curve, a Feynman diagram and a geometry construction', '[]', TRUE, FALSE, TRUE, 0),
  ('chemistry', 'Chemistry', 'Periodic table and caffeine', 'A periodic table to explore, and a caffeine molecule from PubChem that you can turn and zoom.', '["Periodic table","3D molecule"]', TRUE, TRUE, FALSE, 1),
  ('circuit', 'Engineering and CS', 'Circuits, solved', 'A voltage divider and a Wheatstone bridge, with readings from the DC solver and current that flows.', '["Circuit"]', TRUE, TRUE, FALSE, 2),
  ('rotation', 'Astronomy', 'Why galaxies spin too fast', 'A rotation curve with a dark halo you tune with sliders, then Bayes’ rule explained term by term.', '["Graph with sliders","Interactive equation"]', TRUE, TRUE, FALSE, 3),
  ('logic', 'Engineering and CS', 'Digital logic', 'A half adder you can click, then an SPI byte as a timing diagram.', '["Logic diagram","Timing diagram"]', TRUE, TRUE, FALSE, 4),
  ('orbitals', 'Physics', 'Orbitals and surfaces', 'The spherical harmonic Y₂¹ in WebGL, then a 3D surface that turns on its own.', '["Spherical harmonics","3D graph"]', TRUE, TRUE, FALSE, 5),
  ('freebody', 'Physics', 'Forces on a block', 'A block sliding down a slope and a sled pulled at an angle, each force on its own step.', '["Free-body diagram"]', TRUE, TRUE, FALSE, 6),
  ('venn', 'Mathematics', 'Venn diagrams', 'De Morgan’s law shaded in step by step, then a probability problem.', '["Venn diagram"]', TRUE, TRUE, FALSE, 7),
  ('feynman', 'Physics', 'Feynman diagrams', 'Gluon fusion to a Higgs and Compton scattering, drawn one propagator at a time.', '["Feynman diagram"]', TRUE, TRUE, FALSE, 8),
  ('geometry', 'Mathematics', 'Euclid I.1', 'An equilateral triangle by compass and straightedge, then Thales’ theorem. Drag the points.', '["Geometry construction"]', TRUE, TRUE, FALSE, 9)
ON CONFLICT (slug) DO NOTHING;

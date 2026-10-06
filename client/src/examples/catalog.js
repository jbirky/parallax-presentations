// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The example decks the landing page shows, in the order it shows them. Each
// is built by exampleDeck (decks.js) and served at /examples/<slug>; its
// thumbnail is client/public/examples/thumbs/<slug>.jpg. The hero deck is
// served the same way but isn't one of the cards.

export const EXAMPLE_FIELDS = ['Physics', 'Astronomy', 'Chemistry', 'Mathematics', 'Engineering and CS']

export const EXAMPLES = [
  { slug: 'chemistry', field: 'Chemistry', title: 'Periodic table and caffeine', desc: 'A periodic table to explore, and a caffeine molecule from PubChem that you can turn and zoom.', tags: ['Periodic table', '3D molecule'] },
  { slug: 'circuit', field: 'Engineering and CS', title: 'Circuits, solved', desc: 'A voltage divider and a Wheatstone bridge, with readings from the DC solver and current that flows.', tags: ['Circuit'] },
  { slug: 'rotation', field: 'Astronomy', title: 'Why galaxies spin too fast', desc: 'A rotation curve with a dark halo you tune with sliders, then Bayes’ rule explained term by term.', tags: ['Graph with sliders', 'Interactive equation'] },
  { slug: 'logic', field: 'Engineering and CS', title: 'Digital logic', desc: 'A half adder you can click, then an SPI byte as a timing diagram.', tags: ['Logic diagram', 'Timing diagram'] },
  { slug: 'orbitals', field: 'Physics', title: 'Orbitals and surfaces', desc: 'The spherical harmonic Y₂¹ in WebGL, then a 3D surface that turns on its own.', tags: ['Spherical harmonics', '3D graph'] },
  { slug: 'freebody', field: 'Physics', title: 'Forces on a block', desc: 'A block sliding down a slope and a sled pulled at an angle, each force on its own step.', tags: ['Free-body diagram'] },
  { slug: 'venn', field: 'Mathematics', title: 'Venn diagrams', desc: 'De Morgan’s law shaded in step by step, then a probability problem.', tags: ['Venn diagram'] },
  { slug: 'feynman', field: 'Physics', title: 'Feynman diagrams', desc: 'Gluon fusion to a Higgs and Compton scattering, drawn one propagator at a time.', tags: ['Feynman diagram'] },
  { slug: 'geometry', field: 'Mathematics', title: 'Euclid I.1', desc: 'An equilateral triangle by compass and straightedge, then Thales’ theorem. Drag the points.', tags: ['Geometry construction'] },
]

export const HERO_EXAMPLE = 'hero'

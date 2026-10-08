// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The datasets the example decks plot (decks.js). The server fetches each
// source itself, at most once a day and only once an example that uses it is
// opened, and keeps the copy (services/example-datasets.js); until then, and
// whenever a fetch fails, the copy saved in server/examples/ stands in. A
// guest who opens the example in the editor gets copies of the datasets,
// steps and all, to work with.

// Where the data comes from: a TAP query, as a live dataset would make it
// (services/live-sources.js), and the copy the repository keeps
export const EXAMPLE_SOURCES = {
  exoplanets: {
    kind: 'tap',
    source: {
      service: 'https://exoplanetarchive.ipac.caltech.edu/TAP',
      // pscomppars has one row per planet; ps has one per planet per paper
      query: 'select pl_name, pl_orbper, pl_bmasse, pl_bmassprov, discoverymethod, disc_year, disc_pubdate from pscomppars where pl_orbper is not null and pl_bmasse is not null',
      keyColumn: 'pl_name',
    },
    credit: 'NASA Exoplanet Archive, Planetary Systems Composite Parameters',
    link: 'https://exoplanetarchive.ipac.caltech.edu/',
    // server/examples/exoplanets.csv.gz: the archive's answer on this day
    snapshot: '2026-10-07',
  },
  gaia: {
    kind: 'tap',
    source: {
      service: 'https://gea.esac.esa.int/tap-server/tap',
      // Every star within 50 parsecs (parallax over 20 mas) whose parallax is
      // good to 10% and whose color is clean: a well-behaved astrometric
      // solution (RUWE), bright enough in BP and RP, and the BP + RP flux
      // excess cut of Gaia's DR2 HR diagram paper (Babusiaux et al. 2018).
      // Three decimals are finer than a plot can show; the order keeps an
      // unchanged answer the same
      query: 'select round(parallax, 3) as parallax, round(phot_g_mean_mag, 3) as phot_g_mean_mag, round(bp_rp, 3) as bp_rp from gaiadr3.gaia_source where parallax > 20 and parallax_over_error > 10 and ruwe < 1.4 and phot_bp_mean_flux_over_error > 20 and phot_rp_mean_flux_over_error > 20 and phot_bp_rp_excess_factor > 1.0 + 0.015 * bp_rp * bp_rp and phot_bp_rp_excess_factor < 1.3 + 0.06 * bp_rp * bp_rp order by source_id',
    },
    credit: 'ESA/Gaia/DPAC, Gaia Data Release 3',
    link: 'https://gea.esac.esa.int/archive/',
    snapshot: '2026-10-07',
  },
}

// The datasets a deck links, by name: a source and the steps that shape it
export const EXAMPLE_DATASETS = {
  // The graph's key is titled by the column it colors by
  exoplanets: { source: 'exoplanets', transforms: [{ op: 'rename', from: 'discoverymethod', to: 'Discovered by' }] },
  // Planets found each year
  discoveries: {
    source: 'exoplanets',
    transforms: [
      { op: 'group', by: ['disc_year'], aggregates: [{ fn: 'count', name: 'planets' }] },
      { op: 'sort', column: 'disc_year' },
    ],
  },
  // The latest published
  newest: {
    source: 'exoplanets',
    transforms: [
      { op: 'sort', column: 'disc_pubdate', direction: 'desc' },
      { op: 'limit', count: 8 },
      { op: 'select', columns: ['pl_name', 'discoverymethod', 'pl_orbper', 'pl_bmasse', 'disc_pubdate'] },
    ],
  },
  // Each nearby star's brightness in Gaia's G band against the Sun's: its
  // absolute magnitude from the parallax (in mas), and the Sun's, 4.67
  nearby_stars: {
    source: 'gaia',
    transforms: [
      { op: 'compute', name: 'M_G', expr: 'phot_g_mean_mag + 5 * log(parallax) - 10' },
      { op: 'compute', name: 'luminosity', expr: '10^(0.4 * (4.67 - M_G))' },
      // To three figures, all a plot needs, so the deck carries a third as much
      { op: 'compute', name: 'luminosity', expr: 'round(luminosity * 10^(2 - floor(log(luminosity)))) / 10^(2 - floor(log(luminosity)))' },
    ],
  },
  // The stars in each shell a parsec thick, by its middle
  star_counts: {
    source: 'gaia',
    transforms: [
      { op: 'compute', name: 'distance', expr: '1000 / parallax' },
      // A parallax rounded down to 20 mas would make a shell of its own
      { op: 'filter', expr: 'distance < 50' },
      { op: 'compute', name: 'shell', expr: 'floor(distance) + 0.5' },
      { op: 'group', by: ['shell'], aggregates: [{ fn: 'count', name: 'stars' }] },
      { op: 'sort', column: 'shell' },
    ],
  },
}

// The example datasets a deck reads: the names its graphs and elements use
// that are example datasets
export function exampleDatasetNames(names) {
  return [...names].filter(name => Object.prototype.hasOwnProperty.call(EXAMPLE_DATASETS, name))
}

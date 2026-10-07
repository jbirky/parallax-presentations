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
}

// The example datasets a deck reads: the names its graphs and elements use
// that are example datasets
export function exampleDatasetNames(names) {
  return [...names].filter(name => Object.prototype.hasOwnProperty.call(EXAMPLE_DATASETS, name))
}

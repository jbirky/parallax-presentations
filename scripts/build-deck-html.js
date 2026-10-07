// Writes server/services/deck-html.js: generateRevealHTML from
// client/src/utils/generateHTML.js, and what it uses from the client, bundled
// into CommonJS for the pages the server builds (share links, live sessions,
// exports, GitHub and Zenodo). One generator makes every presented deck, in
// the editor's windows and from the server alike. The landing page's example
// decks (client/src/examples/decks.js) and the datasets they plot
// (client/src/examples/datasets.js) come with it, and what
// client/src/utils/deckData.js works out of the data a deck's slides read
// (for services/deck-data.js). Run after changing them or anything they
// import:
//
//   node scripts/build-deck-html.js
//
// client/src/utils/deckHtmlServer.test.js fails when the bundle is out of date.
//
// Two of its imports are the server's own: utils/libraries.js becomes
// server/services/libraries.js (which reads the bundled versions from disk),
// and the editor's plugin registry is left out, since the server passes
// opts.pluginSandbox, reading plugins' sandbox pages from their folders.

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const SOURCE = 'client/src/utils/generateHTML.js'
const EXAMPLES = 'client/src/examples/decks.js'
const CATALOG = 'client/src/examples/catalog.js'
const DECK_DATA = 'client/src/utils/deckData.js'
const EXAMPLE_DATA = 'client/src/examples/datasets.js'
const TARGET = path.join(root, 'server/services/deck-html.js')

const HEADER = `// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Written by scripts/build-deck-html.js from ${SOURCE} and what it
// imports; edit those, then run the script.

`

const serverSide = {
  name: 'server-side',
  setup(build) {
    build.onResolve({ filter: /^\.\/libraries$/ }, () => ({ path: './libraries', external: true }))
    // WaveDrom's renderer, as client/vite.config.js names it
    build.onResolve({ filter: /^wavedrom-render-any$/ }, () => ({ path: path.join(path.dirname(require.resolve('wavedrom/package.json')), 'lib/render-any.js') }))
    build.onResolve({ filter: /\/PluginRegistry$/ }, () => ({ path: 'plugin-registry', namespace: 'server' }))
    build.onLoad({ filter: /.*/, namespace: 'server' }, () => ({
      contents: 'export default { getSandboxHtml: () => null }', loader: 'js',
    }))
  },
}

async function bundle() {
  const esbuild = require('esbuild')
  const result = await esbuild.build({
    stdin: { contents: `export { generateRevealHTML } from './${SOURCE}'\nexport { MAX_ROWS, dataGraphs, graphNeeds, graphRowsFrom, findDataset, hasEmbeds, embedDatasetNames, datasetSummary, carriedData } from './${DECK_DATA}'\nexport { EXAMPLE_SOURCES, EXAMPLE_DATASETS, exampleDatasetNames } from './${EXAMPLE_DATA}'\nexport { exampleDeck, EXAMPLE_SLUGS } from './${EXAMPLES}'\nexport { EXAMPLES, HERO_EXAMPLE } from './${CATALOG}'`, resolveDir: root, sourcefile: 'deck-html.js' },
    absWorkingDir: root,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    charset: 'utf8',
    legalComments: 'none',
    write: false,
    logLevel: 'silent',
    plugins: [serverSide],
  })
  return HEADER + result.outputFiles[0].text
}

module.exports = { bundle, TARGET }

if (require.main === module) {
  bundle().then(code => {
    fs.writeFileSync(TARGET, code)
    console.log(`Wrote ${path.relative(root, TARGET)}`)
  }, err => {
    console.error(err.message)
    process.exit(1)
  })
}

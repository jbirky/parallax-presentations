// Writes server/mcp/shared.js: what AI collaborator links (server/mcp) use
// from the client, bundled into CommonJS with what it imports. Each piece
// runs without a page:
// - the LaTeX Beamer converter (utils/beamer.js, utils/beamerSlides.js) and
//   the BibTeX reader, for import_beamer
// - the deck's text styles (utils/textStyles.js) and the checker for its
//   stylesheet (utils/scopeCss.js), for update_deck and get_theme
// - the elements' defaults, templates and models, and the readers that
//   check what an AI writes for them (Graph's math parser, equations'
//   terms, set expressions, WaveJSON, geometry scripts), for guides.js
//
// Run after changing them or anything they import:
//
//   node scripts/build-mcp-shared.js
//
// client/src/utils/mcpShared.test.js fails when the bundle is out of date.

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const TARGET = path.join(root, 'server/mcp/shared.js')
const SOURCES = {
  'client/src/utils/beamer.js': ['readBeamer', 'plainText'],
  'client/src/utils/beamerSlides.js': ['beamerSlides', 'mergeBibliography', 'citedKeys', 'citeKeyFinder'],
  'client/src/utils/bibtexParser.js': ['parseBibtex'],
  'client/src/utils/graphParser.js': ['createMathParser'],
  'client/src/utils/graphPage.js': ['GRAPH_FIELDS', 'GRAPH_COLORS', 'DEFAULT_VIEW', 'DEFAULT_VIEW_3D', 'DEFAULT_CAMERA', 'defaultGraph', 'defaultGraph3d'],
  'client/src/utils/equationTerms.js': ['EQUATION_COLORS', 'LABEL_STYLES', 'INTERACTIONS', 'EQUATION_SIZE', 'EQUATION_FIELDS', 'MAX_TERMS', 'TERM_ID',
    'defaultEquation', 'termIdsIn', 'badTermIds', 'equationConfig', 'sentenceParts'],
  'client/src/utils/circuitParts.js': ['CIRCUIT_FIELDS', 'CIRCUIT_PARTS', 'circuitModel'],
  'client/src/utils/circuitDiagram.js': ['CIRCUIT_TEMPLATES', 'circuitBox', 'looseEnds'],
  'client/src/utils/circuitSolve.js': ['solveCircuit'],
  'client/src/utils/feynmanDiagram.js': ['FEYNMAN_FIELDS', 'FEYNMAN_TYPES', 'FEYNMAN_TEMPLATES', 'feynmanModel', 'feynmanBox', 'flowWarnings'],
  'client/src/utils/logicParts.js': ['LOGIC_FIELDS', 'LOGIC_PARTS', 'logicModel'],
  'client/src/utils/logicDiagram.js': ['LOGIC_TEMPLATES', 'logicBox', 'floatingPins'],
  'client/src/utils/freebodySolve.js': ['FREEBODY_FIELDS', 'FORCE_KINDS', 'freebodyModel'],
  'client/src/utils/freebodyDiagram.js': ['FREEBODY_TEMPLATES', 'freebodyBox'],
  'client/src/utils/vennDiagram.js': ['VENN_FIELDS', 'VENN_TEMPLATES', 'vennModel', 'analyzeVenn', 'buildUp', 'vennBox'],
  'client/src/utils/timingDiagram.js': ['TIMING_FIELDS', 'TIMING_TEMPLATES', 'parseTiming', 'drawTiming', 'timingModel', 'timingBox', 'defaultTiming'],
  'client/src/utils/geometryDiagram.js': ['GEOMETRY_FIELDS', 'GEOMETRY_SIZE', 'GEOMETRY_TEMPLATES', 'geometryModel', 'geometryFromTemplate', 'fitView', 'stepsPerLine'],
  'client/src/utils/geometryEngine.js': ['GEO'],
  'client/src/utils/periodicTable.js': ['PT', 'PERIODIC_FIELDS', 'periodicBox', 'defaultPeriodic'],
  'client/src/utils/harmonicsView.js': ['HV', 'HARMONICS_FIELDS', 'HARMONICS_TEMPLATES', 'defaultHarmonics', 'applyHarmonicsTemplate'],
  'client/src/utils/sphericalHarmonics.js': ['SH'],
  'client/src/utils/textStyles.js': ['SIZE_KEYS', 'MIN_SIZE', 'MAX_SIZE', 'HEADING_WEIGHTS', 'DEFAULT_SIZES', 'textSizes', 'withTextStyles', 'cleanTextStyles'],
  'client/src/utils/scopeCss.js': ['scopeThemeCss', 'MAX_THEME_CSS'],
}

// WaveDrom's renderer, as client/vite.config.js names it (timing diagrams)
const aliases = {
  name: 'aliases',
  setup(build) {
    build.onResolve({ filter: /^wavedrom-render-any$/ }, () => ({ path: path.join(path.dirname(require.resolve('wavedrom/package.json')), 'lib/render-any.js') }))
  },
}

const HEADER = `// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Written by scripts/build-mcp-shared.js from ${Object.keys(SOURCES).join(', ')}
// and what they import; edit those, then run the script.

`

async function bundle() {
  const esbuild = require('esbuild')
  const contents = Object.entries(SOURCES).map(([file, names]) => `export { ${names.join(', ')} } from './${file}'`).join('\n')
  const result = await esbuild.build({
    stdin: { contents, resolveDir: root, sourcefile: 'shared.js' },
    absWorkingDir: root,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    charset: 'utf8',
    legalComments: 'none',
    write: false,
    logLevel: 'silent',
    plugins: [aliases],
  })
  return HEADER + result.outputFiles[0].text
}

module.exports = { bundle, TARGET, SOURCES }

if (require.main === module) {
  bundle().then(code => {
    fs.writeFileSync(TARGET, code)
    console.log(`Wrote ${path.relative(root, TARGET)} (${Math.round(code.length / 1024)} KB)`)
  }, err => {
    console.error(err.message)
    process.exit(1)
  })
}

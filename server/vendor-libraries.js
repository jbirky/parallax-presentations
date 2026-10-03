// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Libraries that presentations and embeds load in the browser, served from
// this app at /vendor/<package>@<version>/<file> so presenting works without
// the internet. The build copies the files listed here out of node_modules
// (see client/vite.config.js); versions are the exact devDependencies in the
// root package.json, so updating one there is all an upgrade takes. Exported
// standalone HTML links to the same versions on jsDelivr instead.
//
// `files` are globs relative to the package (`*` within a folder, `**` any
// depth). `main` is the file a bare link like cdn.jsdelivr.net/npm/d3@7
// means. `cdnjs` maps cdnjs.cloudflare.com library names to a package folder.

module.exports = {
  packages: {
    'reveal.js': {
      files: ['dist/reset.css', 'dist/reveal.css', 'dist/reveal.js', 'dist/theme/**',
        'plugin/notes/notes.js', 'plugin/highlight/highlight.js'],
    },
    // mhchem adds \ce and \pu, for chemical equations and units
    katex: { files: ['dist/katex.min.js', 'dist/katex.min.css', 'dist/fonts/*.woff2', 'dist/contrib/mhchem.min.js'] },
    '@highlightjs/cdn-assets': { files: ['highlight.min.js', 'styles/*.min.css'] },
    gsap: { files: ['dist/gsap.min.js'] },
    p5: { files: ['lib/p5.min.js'] },
    marked: { files: ['lib/marked.umd.js'], main: 'lib/marked.umd.js' },
    d3: { files: ['dist/d3.min.js'], main: 'dist/d3.min.js' },
    // The loaders and environment are the 3D model viewer's (modelViewer.js)
    three: {
      files: ['build/three.module.js', 'examples/jsm/controls/OrbitControls.js',
        'examples/jsm/loaders/GLTFLoader.js', 'examples/jsm/loaders/STLLoader.js',
        'examples/jsm/utils/BufferGeometryUtils.js', 'examples/jsm/environments/RoomEnvironment.js'],
    },
    animejs: { files: ['lib/anime.min.js'] },
    // Its Computer Modern fonts also back the Computer Modern and Latin
    // Modern font choices
    'latex.js': {
      files: ['dist/latex.js', 'dist/css/*.css', 'dist/fonts/cmu.css', 'dist/fonts/KaTeX_*.woff2',
        'dist/fonts/Sans/*', 'dist/fonts/Serif/*', 'dist/fonts/Serif Slanted/*',
        'dist/fonts/Typewriter/*', 'dist/fonts/Typewriter Slanted/*'],
    },
    // The app's PDF import uses the legacy build (see Toolbar.jsx); build/ is
    // for links in people's own embeds to cdnjs's pdf.js
    'pdfjs-dist': { files: ['build/pdf.min.mjs', 'build/pdf.worker.min.mjs', 'legacy/build/pdf.min.mjs', 'legacy/build/pdf.worker.min.mjs'] },
    jsxgraph: { files: ['distrib/jsxgraphcore.js', 'distrib/jsxgraph.css'] },
    // Records canvas drawing as SVG, for the TikZ diagram editor's export
    svgcanvas: { files: ['dist/svgcanvas.esm.js'] },
  },
  cdnjs: {
    'pdf.js': { package: 'pdfjs-dist', dir: 'build' },
    jsxgraph: { package: 'jsxgraph', dir: 'distrib' },
  },
}

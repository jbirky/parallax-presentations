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
    katex: { files: ['dist/katex.min.js', 'dist/katex.min.css', 'dist/fonts/*.woff2'] },
    '@highlightjs/cdn-assets': { files: ['highlight.min.js', 'styles/*.min.css'] },
    gsap: { files: ['dist/gsap.min.js'] },
    p5: { files: ['lib/p5.min.js'] },
    marked: { files: ['lib/marked.umd.js'], main: 'lib/marked.umd.js' },
    'chart.js': { files: ['dist/chart.umd.min.js'], main: 'dist/chart.umd.min.js' },
    d3: { files: ['dist/d3.min.js'], main: 'dist/d3.min.js' },
    three: { files: ['build/three.module.js', 'examples/jsm/controls/OrbitControls.js'] },
    animejs: { files: ['lib/anime.min.js'] },
    // Its Computer Modern fonts also back the Computer Modern and Latin
    // Modern font choices
    'latex.js': {
      files: ['dist/latex.js', 'dist/css/*.css', 'dist/fonts/cmu.css', 'dist/fonts/KaTeX_*.woff2',
        'dist/fonts/Sans/*', 'dist/fonts/Serif/*', 'dist/fonts/Serif Slanted/*',
        'dist/fonts/Typewriter/*', 'dist/fonts/Typewriter Slanted/*'],
    },
    'pdfjs-dist': { files: ['build/pdf.min.js', 'build/pdf.worker.min.js'] },
    jsxgraph: { files: ['distrib/jsxgraphcore.js', 'distrib/jsxgraph.css'] },
  },
  cdnjs: {
    'pdf.js': { package: 'pdfjs-dist', dir: 'build' },
    jsxgraph: { package: 'jsxgraph', dir: 'distrib' },
  },
}

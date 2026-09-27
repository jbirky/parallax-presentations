import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import * as clientLibraries from './libraries'
import { generateRevealHTML } from './generateHTML'

const require = createRequire(import.meta.url)
const serverLibraries = require('../../../server/services/libraries.js')
const { packages } = require('../../../server/vendor-libraries.js')
const pinned = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8')).devDependencies
const v = pinned // the versions every link should use

const BASE = 'http://localhost:3000'

// The browser and server copies of the link logic must agree
describe.each([['client', clientLibraries], ['server', serverLibraries]])('%s libraries', (_, lib) => {
  const local = html => lib.localizeLibraries(html, BASE)

  it('links to jsDelivr at the bundled version', () => {
    expect(lib.libUrl('reveal.js', 'dist/reveal.js')).toBe(`https://cdn.jsdelivr.net/npm/reveal.js@${v['reveal.js']}/dist/reveal.js`)
    expect(lib.libUrl('@highlightjs/cdn-assets', 'highlight.min.js'))
      .toBe(`https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@${v['@highlightjs/cdn-assets']}/highlight.min.js`)
  })

  it('points bundled files at /vendor/', () => {
    expect(local(`<script src="${lib.libUrl('reveal.js', 'dist/reveal.js')}"></script>`))
      .toBe(`<script src="${BASE}/vendor/reveal.js@${v['reveal.js']}/dist/reveal.js"></script>`)
    expect(local(`<link href="https://cdn.jsdelivr.net/npm/reveal.js@${v['reveal.js']}/dist/theme/night.css">`))
      .toBe(`<link href="${BASE}/vendor/reveal.js@${v['reveal.js']}/dist/theme/night.css">`)
  })

  it('uses the main file for bare links, as in users’ embed code', () => {
    expect(local('<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>'))
      .toBe(`<script src="${BASE}/vendor/d3@${v.d3}/dist/d3.min.js"></script>`)
    // inside an escaped srcdoc attribute
    expect(local('srcdoc="&lt;script src=&quot;https://cdn.jsdelivr.net/npm/d3@7&quot;&gt;"'))
      .toBe(`srcdoc="&lt;script src=&quot;${BASE}/vendor/d3@${v.d3}/dist/d3.min.js&quot;&gt;"`)
  })

  it('maps cdnjs links for the libraries it has', () => {
    expect(local('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'))
      .toBe(`${BASE}/vendor/pdfjs-dist@${v['pdfjs-dist']}/build/pdf.worker.min.js`)
    expect(local('https://cdnjs.cloudflare.com/ajax/libs/jsxgraph/1.11.1/jsxgraphcore.js'))
      .toBe(`${BASE}/vendor/jsxgraph@${v.jsxgraph}/distrib/jsxgraphcore.js`)
  })

  it('leaves links it has no compatible copy of', () => {
    const untouched = [
      'https://cdn.jsdelivr.net/npm/d3@6/dist/d3.min.js', // another major
      'https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.module.js', // another 0.x minor
      `https://cdn.jsdelivr.net/npm/three@${v.three}/examples/jsm/loaders/GLTFLoader.js`, // not bundled
      'https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js', // not a bundled package
      'https://cdn.jsdelivr.net/npm/chart.js@4', // no longer bundled
      'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js',
      'https://tikzjax.com/v1/tikzjax.js',
    ]
    for (const url of untouched) expect(local(url)).toBe(url)
  })

  it('judges version compatibility by major, or minor for 0.x', () => {
    expect(lib.compatible('7', '7.9.0')).toBe(true)
    expect(lib.compatible('^7.2.0', '7.9.0')).toBe(true)
    expect(lib.compatible('6.7.0', '7.9.0')).toBe(false)
    expect(lib.compatible('0.162.0', '0.162.0')).toBe(true)
    expect(lib.compatible('0.163.0', '0.162.0')).toBe(false)
    expect(lib.compatible(undefined, '18.0.14')).toBe(true)
  })
})

describe('bundled library versions', () => {
  it('pins every bundled package to an exact version in the root package.json', () => {
    for (const name of Object.keys(packages)) {
      expect(pinned[name], `${name} in the root package.json devDependencies`).toMatch(/^\d+\.\d+\.\d+$/)
    }
  })

  it('has Dependabot propose updates for exactly the bundled packages', () => {
    const config = fs.readFileSync(path.resolve(__dirname, '../../../.github/dependabot.yml'), 'utf8')
    const allowed = [...config.matchAll(/dependency-name: "?([^"\n]+)"?/g)].map(m => m[1]).sort()
    expect(allowed).toEqual(Object.keys(packages).sort())
  })

  it('gives the server the versions the build bundled, or else the pinned ones', () => {
    const manifest = path.resolve(__dirname, '../../dist/vendor/manifest.json')
    const expected = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')).versions
      : Object.fromEntries(Object.keys(packages).map(name => [name, pinned[name]]))
    expect(serverLibraries.versions).toEqual(expected)
  })
})

describe('presenting from the app', () => {
  it('loads every library from the app, not a CDN', () => {
    const deck = {
      title: 'Offline', theme: 'night', slideWidth: 960, slideHeight: 540,
      slides: [{
        id: 's1',
        background: { type: 'color', color: '#000' },
        elements: [
          { id: 'p', type: 'p5', x: 0, y: 0, width: 200, height: 200, content: 'function setup(){createCanvas(100,100)}' },
          { id: 'm', type: 'markdown', x: 0, y: 0, width: 200, height: 200, content: '# Hi' },
          { id: 'l', type: 'latex', x: 0, y: 0, width: 200, height: 200, content: '\\begin{tabular}{cc} a & b \\end{tabular}' },
          { id: 'k', type: 'code', x: 0, y: 0, width: 200, height: 200, language: 'js', content: 'let a = 1' },
          { id: 'h', type: 'html', x: 0, y: 0, width: 200, height: 200, content: '<script src="https://cdn.jsdelivr.net/npm/d3@7"></script><svg></svg>' },
        ],
      }],
    }
    const html = generateRevealHTML(deck)
    expect(html).toContain('https://cdn.jsdelivr.net/npm/') // what a download keeps
    const presented = clientLibraries.localizeLibraries(html, BASE)
    expect(presented).not.toMatch(/https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)\//)
    for (const name of ['reveal.js', 'katex', 'p5', 'marked', 'latex.js', 'd3', '@highlightjs/cdn-assets']) {
      expect(presented, name).toContain(`${BASE}/vendor/${name}@${v[name]}/`)
    }
  })
})

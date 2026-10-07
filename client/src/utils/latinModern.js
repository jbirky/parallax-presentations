// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// 'Latin Modern Roman', which the font menus offer and diagrams' math labels
// use, is drawn with CMU Serif (Computer Modern Unicode, the same design)
// from the latex.js package, which the app bundles (server/vendor-libraries.js).
// Latin Modern's own web fonts aren't published anywhere the app can load
// them from. Decks, the editor and kinetic text all declare these faces, so a
// slide sets its text the same way in each.

import { libUrl, localizeLibraries } from './libraries'

const FACES = [['normal', 400, 'cmunrm'], ['normal', 700, 'cmunbx'], ['italic', 400, 'cmunti'], ['italic', 700, 'cmunbi']]

// The @font-face rules, with links made by `url` (jsDelivr by default, as
// pages are written)
export function latinModernFaces(url = libUrl) {
  return FACES.map(([style, weight, file]) =>
    `@font-face { font-family: 'Latin Modern Roman'; font-style: ${style}; font-weight: ${weight}; src: url('${url('latex.js', `dist/fonts/Serif/${file}.woff`)}') format('woff'); }`).join('\n')
}

// The editor's own page: the faces from this app's bundled copy, so they
// load offline too
export function addLatinModernFaces(doc = document) {
  if (doc.querySelector('style[data-fonts="latin-modern"]')) return
  const style = doc.createElement('style')
  style.setAttribute('data-fonts', 'latin-modern')
  style.textContent = localizeLibraries(latinModernFaces(), '')
  doc.head.appendChild(style)
}

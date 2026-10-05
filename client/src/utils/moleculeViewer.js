// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The page inside a molecule element's iframe: a structure file (PDB, mmCIF,
// SDF, MOL2, XYZ…) drawn by 3Dmol.js, to turn by dragging and zoom by
// scrolling. The editor's canvas, presented decks, printed pages and the
// server's deck pages all run this page, so a molecule looks the same
// everywhere. The file is an upload, fetched from PubChem or the PDB by
// moleculeSources.js or chosen by the user, so presenting needs no internet.

import { libUrl } from './libraries'

// File extensions and the 3Dmol format each is read as. A .mol file is an
// SDF with one record.
export const MOLECULE_FORMATS = {
  '.pdb': 'pdb', '.ent': 'pdb', '.pqr': 'pqr',
  '.cif': 'cif', '.mmcif': 'cif',
  '.sdf': 'sdf', '.mol': 'sdf',
  '.mol2': 'mol2', '.xyz': 'xyz', '.gro': 'gro',
}

export const MOLECULE_STYLES = [
  ['auto', 'Auto'],
  ['cartoon', 'Cartoon'],
  ['ballstick', 'Ball and stick'],
  ['stick', 'Sticks'],
  ['sphere', 'Space-filling'],
  ['line', 'Wireframe'],
]

export const MOLECULE_COLORS = [
  ['auto', 'Auto'],
  ['element', 'By element'],
  ['chain', 'By chain'],
  ['spectrum', 'Rainbow (N → C)'],
  ['ss', 'Secondary structure'],
]

export const MOLECULE_DEFAULTS = {
  style: 'auto',
  color: 'auto',
  hydrogens: true,
  surface: false,
  background: 'transparent',
  spin: false,
}

// The 3Dmol format for a file name, or null for one the viewer doesn't read
export function moleculeFormat(name) {
  const lower = String(name || '').toLowerCase()
  const ext = lower.slice(lower.lastIndexOf('.'))
  return lower.includes('.') ? MOLECULE_FORMATS[ext] || null : null
}

// What the viewer draws, for the editor's snapshot key: a thumbnail taken
// before a setting changed isn't reused after it
export function moleculeSnapshotContent(el) {
  return JSON.stringify([el.src, el.format, el.style, el.color, el.hydrogens, el.surface, el.background, el.view])
}

// Into a <script>: no "</script>" or "<!--" can end it early
function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function pick(value, allowed, fallback) {
  return allowed.some(([v]) => v === value) ? value : fallback
}

// A saved view: 3Dmol's getView(), eight numbers (translation, zoom, rotation)
function savedView(view) {
  return Array.isArray(view) && view.length >= 8 && view.every(n => typeof n === 'number' && Number.isFinite(n))
    ? view.slice(0, 8) : null
}

// `src` is the file's URL as the page should fetch it (made absolute by the
// caller where the page won't resolve /uploads/…). In the editor only,
// `snapshotKey` asks for a still to be sent to the slide panel once the
// molecule is in, and `viewKey` for the view to be sent after it's turned, so
// the properties panel can keep it.
export function moleculeViewerHtml(el, { src = el.src, snapshotKey = null, viewKey = null, print = false } = {}) {
  const options = {
    src: src || '',
    format: Object.values(MOLECULE_FORMATS).includes(el.format) ? el.format : moleculeFormat(el.src) || 'pdb',
    style: pick(el.style, MOLECULE_STYLES, MOLECULE_DEFAULTS.style),
    color: pick(el.color, MOLECULE_COLORS, MOLECULE_DEFAULTS.color),
    hydrogens: el.hydrogens !== false,
    surface: !!el.surface,
    background: el.background || MOLECULE_DEFAULTS.background,
    spin: !!el.spin && !print,
    view: savedView(el.view),
    snapshotKey,
    viewKey,
    print,
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}#stage{position:absolute;inset:0}canvas{display:block;outline:none}#status{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;text-align:center;font:13px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:rgba(128,128,128,0.9);pointer-events:none}#status.error{color:#e5484d}</style>
<script src="${libUrl('3dmol', 'build/3Dmol-min.js')}"></script>
</head><body><div id="stage"></div><div id="status">Loading molecule…</div>
<script>
(function () {
var O = ${scriptJson(options)};
var stage = document.getElementById('stage');
var status = document.getElementById('status');
function fail(message) { status.className = 'error'; status.textContent = message; }

// How much the deck or editor enlarges this frame, which it can't see (a CSS
// transform). 3Dmol sizes its canvas by window.devicePixelRatio, so that is
// raised to match: sharp when enlarged, at least 2 in a PDF
var baseRatio = window.devicePixelRatio || 1;
var shownScale = 1;
try {
  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    get: function () { return Math.min(4, Math.max(1, baseRatio * (O.print ? Math.max(shownScale, 2) : shownScale))); },
  });
} catch (e) { /* drawn at the screen's own ratio */ }

if (typeof window.$3Dmol === 'undefined') { fail('The molecule viewer couldn’t be loaded.'); return; }
var $3Dmol = window.$3Dmol;

// Surfaces are worked out in workers started from a blob: URL, which a
// sandboxed frame may not be allowed to start; then they're worked out here
if ($3Dmol.SurfaceWorker) {
  try { new Worker($3Dmol.SurfaceWorker).terminate(); } catch (e) { $3Dmol.setSyncSurface(true); }
}

// 3Dmol draws on an OffscreenCanvas it shares between viewers, and copies
// each frame to the page's canvas as a bitmap, which drops the transparent
// background (it showed white). With one viewer, it may as well draw on the
// page's canvas itself
try { window.OffscreenCanvas = undefined; } catch (e) { /* drawn the shared way */ }

var viewer = null;
try {
  viewer = $3Dmol.createViewer(stage, {
    backgroundColor: O.background === 'transparent' ? 'white' : O.background,
    backgroundAlpha: O.background === 'transparent' ? 0 : 1,
    antialias: true,
  });
} catch (e) { viewer = null; }
if (!viewer) { fail('3D needs WebGL, which this browser has turned off.'); return; }

var WATER = { resn: ['HOH', 'WAT', 'H2O', 'DOD', 'SOL', 'TIP3'] };
var model = null, touched = false, snapshotSent = false, reportTimer = 0;

function colors(kind) {
  var c = O.color === 'auto' ? (kind === 'cartoon' ? 'spectrum' : 'element') : O.color;
  if (c === 'chain') return { colorscheme: 'chain' };
  if (c === 'spectrum') return kind === 'cartoon' ? { color: 'spectrum' } : { colorscheme: 'Jmol' };
  if (c === 'ss') return { colorscheme: 'ssPyMol' };
  return { colorscheme: 'Jmol' };
}

function atomStyle(kind, c) {
  function w(extra) { var o = {}; for (var k in c) o[k] = c[k]; for (var k2 in extra) o[k2] = extra[k2]; return o; }
  if (kind === 'cartoon') return { cartoon: w({}) };
  if (kind === 'stick') return { stick: w({ radius: 0.2 }) };
  if (kind === 'sphere') return { sphere: w({}) };
  if (kind === 'line') return { line: w({}) };
  return { stick: w({ radius: 0.14 }), sphere: w({ scale: 0.25 }) };
}

function applyStyle() {
  // A protein or nucleic acid: its backbone is in ATOM records (SDF and XYZ
  // atoms are all HETATM to 3Dmol)
  var polymer = model.selectedAtoms({ atom: ['CA', 'P'], hetflag: false }).length > 0;
  var kind = O.style === 'auto' ? (polymer ? 'cartoon' : 'ballstick') : O.style;
  if (kind === 'cartoon' && !polymer) kind = 'ballstick';
  viewer.setStyle({}, {});
  if (kind === 'cartoon') {
    viewer.setStyle({ hetflag: false }, atomStyle('cartoon', colors('cartoon')));
    // Ligands and ions stand out against it, with green carbons; water is left out
    viewer.setStyle({ and: [{ hetflag: true }, { not: WATER }] }, atomStyle('ballstick', { colorscheme: 'greenCarbon' }));
  } else {
    viewer.setStyle(polymer ? { not: WATER } : {}, atomStyle(kind, colors(kind)));
  }
  if (!O.hydrogens) viewer.setStyle({ elem: 'H' }, {});
  if (O.surface) {
    var c = O.color === 'chain' ? { colorscheme: 'chain' } : O.color === 'ss' ? { colorscheme: 'ssPyMol' } : { colorscheme: 'Jmol' };
    c.opacity = 0.7;
    var around = polymer ? { hetflag: false } : O.hydrogens ? {} : { not: { elem: 'H' } };
    viewer.addSurface($3Dmol.SurfaceType.VDW, c, around, around);
  }
}

// Framed to fit, or as it was kept in the editor
function applyView() {
  viewer.zoomTo();
  if (O.view) viewer.setView(O.view);
  viewer.render();
}

function sendSnapshot() {
  if (!O.snapshotKey || snapshotSent) return;
  snapshotSent = true;
  try { parent.postMessage({ source: 'parallax-embed', type: 'snapshot', key: O.snapshotKey, dataUrl: viewer.pngURI() }, '*'); } catch (e) { /* the thumbnail keeps its placeholder */ }
}

function reportView() {
  if (!O.viewKey) return;
  clearTimeout(reportTimer);
  reportTimer = setTimeout(function () {
    try { parent.postMessage({ source: 'parallax-embed', type: 'molecule-view', key: O.viewKey, view: viewer.getView() }, '*'); } catch (e) { /* nothing to keep */ }
  }, 250);
}

// Taking hold of it stops a spin, so it stays where it's turned to
function touch() {
  touched = true;
  if (O.spin) viewer.spin(false);
}
stage.addEventListener('pointerdown', touch, true);
stage.addEventListener('wheel', touch, { capture: true, passive: true });
stage.addEventListener('touchstart', touch, { capture: true, passive: true });
viewer.setViewChangeCallback(function () { if (touched) reportView(); });

function resize() {
  viewer.resize();
  // Loaded on a hidden slide, it was framed at no size: frame it again
  // when shown, unless someone has already turned it
  if (model && !touched) applyView();
}
window.addEventListener('resize', resize);
window.addEventListener('message', function (e) {
  if (e.source !== window.parent) return;
  if (e.data === 'parallax-resize') resize();
  if (e.data && e.data.type === 'scale' && typeof e.data.scale === 'number' && e.data.scale > 0) {
    shownScale = Math.min(8, Math.max(0.1, e.data.scale));
    resize();
  }
});

if (!O.src) {
  fail('No structure yet. Choose a molecule in the properties panel.');
  return;
}
fetch(O.src)
  .then(function (res) {
    if (!res.ok) throw new Error('The structure file couldn’t be loaded (' + res.status + ').');
    return res.text();
  })
  .then(function (text) {
    model = viewer.addModel(text, O.format, { keepH: O.hydrogens });
    if (!model || !model.selectedAtoms({}).length) throw new Error('This file has no atoms the viewer can read.');
    applyStyle();
    status.textContent = '';
    applyView();
    viewer.render(sendSnapshot);
    if (O.spin) viewer.spin('y', 0.6);
  })
  .catch(function (err) { fail(err && err.message ? err.message : 'The structure couldn’t be read.'); });
})();
</script></body></html>`
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Written by scripts/copy-click-actions.js from client/src/utils/slideLayouts.js;
// edit that, then run the script.

// The slide layouts, for the editor's new slides and Change layout, and for
// AI collaborator links (server/mcp), whose copy scripts/copy-click-actions.js
// writes. Their text boxes are placeholders (utils/placeholders.js): empty,
// showing a hint, and shrinking their text to fit. Their shapes become the
// slide's layout parts, which Change layout swaps for the next layout's.
const ph = (placeholder, x, y, width, height, content, extra = {}) => ({ type: 'text', placeholder, sizeMode: 'shrink', x, y, width, height, zIndex: 2, content, ...extra })
const layoutTitle = (x, y, width, height, align) => ph('title', x, y, width, height, `<h2${align ? ` style="text-align:${align}"` : ''}></h2>`, { zIndex: 1 })
const bullets = (x, y, width, height) => ph('body', x, y, width, height, '<ul><li><p></p></li></ul>')
const SLIDE_TEMPLATES = {
  blank: { label: 'Blank', elements: [] },
  title: { label: 'Title Slide', elements: [
    layoutTitle(60, 150, 840, 120, 'center'),
    ph('subtitle', 120, 282, 720, 80, '<p style="text-align:center"></p>'),
  ]},
  'title-content': { label: 'Title and Content', elements: [
    layoutTitle(40, 36, 880, 100),
    bullets(40, 140, 880, 360),
  ]},
  'two-column': { label: 'Two Column', elements: [
    layoutTitle(40, 36, 880, 100),
    bullets(40, 140, 420, 360),
    bullets(500, 140, 420, 360),
  ]},
  'image-text': { label: 'Image + Text', elements: [
    layoutTitle(40, 36, 880, 100),
    { type: 'shape', shape: 'rect', x: 40, y: 140, width: 420, height: 340, zIndex: 2, fill: '#2d2d4e', stroke: 'none', strokeWidth: 0, text: '[ Image ]', fontSize: 18, textColor: '#888888' },
    ph('body', 500, 140, 420, 340, '<p></p>'),
  ]},
  'section-header': { label: 'Section Header', elements: [
    ph('title', 80, 140, 800, 150, '<h1 style="text-align:center"></h1>', { zIndex: 1 }),
    { type: 'shape', shape: 'rect', x: 280, y: 302, width: 400, height: 4, zIndex: 2, fill: '#6366f1', stroke: 'none', strokeWidth: 0, locked: true },
    ph('subtitle', 200, 320, 560, 80, '<p style="text-align:center"></p>', { hint: 'Click to add a description' }),
  ]},
  'three-column': { label: 'Three Column', elements: [
    layoutTitle(40, 36, 880, 100),
    ph('body', 20, 140, 290, 340, '<p></p>'),
    ph('body', 335, 140, 290, 340, '<p></p>'),
    ph('body', 650, 140, 290, 340, '<p></p>'),
  ]},
  'comparison': { label: 'Comparison', elements: [
    layoutTitle(40, 26, 880, 100, 'center'),
    { type: 'shape', shape: 'rounded-rect', x: 30, y: 136, width: 440, height: 380, zIndex: 1, fill: 'rgba(99,102,241,0.1)', stroke: '#6366f1', strokeWidth: 1, locked: true },
    ph('subtitle', 50, 146, 400, 80, '<h3 style="text-align:center; color: #6366f1"></h3>', { hint: 'Click to add heading' }),
    bullets(50, 230, 400, 276),
    { type: 'shape', shape: 'rounded-rect', x: 490, y: 136, width: 440, height: 380, zIndex: 1, fill: 'rgba(236,72,153,0.1)', stroke: '#ec4899', strokeWidth: 1, locked: true },
    ph('subtitle', 510, 146, 400, 80, '<h3 style="text-align:center; color: #ec4899"></h3>', { hint: 'Click to add heading' }),
    bullets(510, 230, 400, 276),
  ]},
  'big-number': { label: 'Big Number', elements: [
    ph('title', 80, 80, 800, 200, '<h1 style="text-align:center; font-size: 120px; color: #6366f1"></h1>', { zIndex: 1, hint: '42%' }),
    ph('subtitle', 160, 300, 640, 120, '<p style="text-align:center"></p>', { hint: 'Click to add what the number means' }),
  ]},

  // ── Typographic System Presets (Elam / Bauhaus) ──────────────────────

  'system-axial': {
    label: 'Axial',
    category: 'systems',
    layoutGrid: { enabled: true, columns: 2, rows: 0, gutter: 0, marginX: 40, marginY: 40, snap: true },
    axisLines: [{ id: 'ax1', axis: 'x', position: 320, visible: true, snap: true }],
    elements: [
      layoutTitle(40, 50, 260, 100, 'right'),
      ph('subtitle', 40, 150, 260, 80, '<p style="text-align:right"></p>'),
      ph('body', 340, 50, 580, 440, '<p></p>'),
      { type: 'shape', shape: 'rect', x: 318, y: 40, width: 3, height: 460, zIndex: 0, fill: 'rgba(244,114,182,0.4)', stroke: 'none', strokeWidth: 0, locked: true },
    ]
  },

  'system-bilateral': {
    label: 'Bilateral',
    category: 'systems',
    axisLines: [{ id: 'ax1', axis: 'x', position: 480, visible: true, snap: true }],
    elements: [
      layoutTitle(130, 56, 700, 100, 'center'),
      { type: 'shape', shape: 'rect', x: 380, y: 164, width: 200, height: 3, zIndex: 0, fill: '#6366f1', stroke: 'none', strokeWidth: 0, locked: true },
      ph('subtitle', 130, 176, 700, 80, '<p style="text-align:center"></p>'),
      ph('body', 130, 266, 700, 230, '<p style="text-align:center"></p>'),
    ]
  },

  'system-grid': {
    label: 'Grid System',
    category: 'systems',
    layoutGrid: { enabled: true, columns: 3, rows: 2, gutter: 16, marginX: 40, marginY: 40, snap: true },
    elements: [
      layoutTitle(40, 36, 880, 100),
      { type: 'shape', shape: 'rect', x: 40, y: 140, width: 880, height: 2, zIndex: 0, fill: 'rgba(99,102,241,0.3)', stroke: 'none', strokeWidth: 0, locked: true },
      ph('body', 40, 152, 277, 166, '<p></p>'),
      ph('body', 333, 152, 277, 166, '<p></p>'),
      ph('body', 626, 152, 277, 166, '<p></p>'),
      ph('body', 40, 326, 277, 174, '<p></p>'),
      ph('body', 333, 326, 277, 174, '<p></p>'),
      ph('body', 626, 326, 277, 174, '<p></p>'),
    ]
  },

  'system-modular': {
    label: 'Modular',
    category: 'systems',
    layoutGrid: { enabled: true, columns: 4, rows: 3, gutter: 8, marginX: 32, marginY: 32, snap: true },
    elements: [
      { type: 'shape', shape: 'rect', x: 32, y: 32, width: 214, height: 150, zIndex: 0, fill: 'rgba(99,102,241,0.15)', stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 },
      { type: 'shape', shape: 'rect', x: 254, y: 32, width: 214, height: 150, zIndex: 0, fill: 'rgba(99,102,241,0.15)', stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 },
      { type: 'shape', shape: 'rect', x: 476, y: 32, width: 214, height: 150, zIndex: 0, fill: 'rgba(99,102,241,0.15)', stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 },
      { type: 'shape', shape: 'rect', x: 698, y: 32, width: 214, height: 150, zIndex: 0, fill: 'rgba(99,102,241,0.15)', stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 },
      layoutTitle(32, 198, 436, 100),
      ph('body', 32, 300, 436, 202, '<p></p>'),
      { type: 'shape', shape: 'circle', x: 828, y: 420, width: 80, height: 80, zIndex: 2, fill: '#6366f1', stroke: 'none', strokeWidth: 0, opacity: 0.7 },
    ]
  },

  'system-transitional': {
    label: 'Transitional',
    category: 'systems',
    elements: [
      layoutTitle(60, 36, 500, 100),
      ph('subtitle', 120, 136, 460, 56, '<p style="font-size: 28px"></p>'),
      { type: 'shape', shape: 'rect', x: 0, y: 200, width: 700, height: 3, zIndex: 0, fill: 'rgba(128,128,128,0.35)', stroke: 'none', strokeWidth: 0, locked: true },
      ph('body', 80, 220, 460, 230, '<p style="font-size: 26px"></p>'),
      ph('body', 520, 440, 400, 80, '<p style="text-align:right; font-size: 14px"></p>', { hint: 'Click to add a detail' }),
    ]
  },

  'system-radial': {
    label: 'Radial',
    category: 'systems',
    elements: [
      { type: 'shape', shape: 'circle', x: 380, y: 170, width: 200, height: 200, zIndex: 0, fill: 'rgba(99,102,241,0.12)', stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 },
      { type: 'shape', shape: 'circle', x: 330, y: 120, width: 300, height: 300, zIndex: 0, fill: 'none', stroke: 'rgba(99,102,241,0.15)', strokeWidth: 1 },
      { type: 'shape', shape: 'circle', x: 444, y: 234, width: 72, height: 72, zIndex: 1, fill: '#6366f1', stroke: 'none', strokeWidth: 0 },
      ph('body', 440, 245, 80, 50, '<p style="text-align:center; font-size:11px; color:white"></p>', { hint: 'Focus' }),
      ph('body', 540, 100, 380, 80, '<h3></h3>', { zIndex: 3, hint: 'Click to add a point' }),
      ph('body', 570, 310, 350, 80, '<h3></h3>', { zIndex: 3, hint: 'Click to add a point' }),
      ph('body', 40, 180, 300, 80, '<h3 style="text-align:right"></h3>', { zIndex: 3, hint: 'Click to add a point' }),
      ph('body', 40, 420, 300, 80, '<h3 style="text-align:right"></h3>', { zIndex: 3, hint: 'Click to add a point' }),
    ]
  },
}

// A layout's elements for a new slide: new ids, and its shapes marked as the
// layout's own (Change layout swaps them)
const layoutElements = (template, newId = () => globalThis.crypto.randomUUID()) => template.elements.map(el => ({
  ...el,
  id: newId(),
  ...(el.type === 'text' && el.placeholder ? {} : { layoutPart: true }),
}))

module.exports = { SLIDE_TEMPLATES, layoutElements }

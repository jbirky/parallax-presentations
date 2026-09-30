// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// 3D text elements (type 'text3d'): the text on a plane turned and tilted
// in CSS 3D under a perspective. It's flat, or extruded: copies of it
// stacked behind, each pushed a little further back and shaded a little
// darker. The editor's canvas, the slide thumbnails and the deck generators
// all draw text3dHtml, so they match. The tilt is set in the editor (drag
// it in tilt mode, or the panel's sliders); presented, it stays put.
//
// Nothing in 3D may sit between the perspective and the stack: overflow,
// opacity, filter and the like on the stack flatten it. They go on the
// element's own box, outside this markup.

export const TEXT3D_DEFAULTS = {
  content: '3D Text',
  fontSize: 96, fontWeight: '800', fontStyle: 'normal',
  letterSpacing: 0, lineHeight: 1.1, textAlign: 'center',
  color: '#ffffff', sideColor: '#6366f1', sideShade: 0.6,
  depth: 0, rotateX: 16, rotateY: -26, perspective: 800,
}

// The depth text gets when it goes from flat to extruded
export const TEXT3D_EXTRUDED_DEPTH = 24

// Starting angles; they leave depth, colors and type alone
export const TEXT3D_PRESETS = [
  { id: 'front', label: 'Front', rotateX: 0, rotateY: 0, perspective: 800 },
  { id: 'turn-left', label: 'Turn left', rotateX: 10, rotateY: -26, perspective: 800 },
  { id: 'turn-right', label: 'Turn right', rotateX: 10, rotateY: 26, perspective: 800 },
  { id: 'lean-back', label: 'Lean back', rotateX: 40, rotateY: 0, perspective: 700 },
]

export const TEXT3D_LIMITS = {
  depth: [0, 150], rotateX: [-80, 80], rotateY: [-80, 80], perspective: [150, 3000],
  fontSize: [8, 400], letterSpacing: [-50, 200], lineHeight: [0.5, 4], sideShade: [0, 1],
}

// One copy per pixel of depth, up to this many; deeper text spaces them out
const MAX_LAYERS = 60

const WEIGHTS = /^(normal|bold|[1-9]00)$/
const STYLES = ['normal', 'italic', 'oblique']
const ALIGNS = { left: 'flex-start', center: 'center', right: 'flex-end' }
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

// The element's settings, in range and safe to write into a page
export function text3dSettings(el, fallbackFont) {
  const num = (key) => {
    const n = Number(el[key])
    const [lo, hi] = TEXT3D_LIMITS[key]
    return Number.isFinite(n) && el[key] !== null && el[key] !== '' ? Math.min(hi, Math.max(lo, n)) : TEXT3D_DEFAULTS[key]
  }
  const color = (key) => HEX.test(el[key] || '') ? el[key] : TEXT3D_DEFAULTS[key]
  const weight = String(el.fontWeight ?? '')
  return {
    depth: num('depth'), rotateX: num('rotateX'), rotateY: num('rotateY'), perspective: num('perspective'),
    fontSize: num('fontSize'), letterSpacing: num('letterSpacing'), lineHeight: num('lineHeight'), sideShade: num('sideShade'),
    color: color('color'), sideColor: color('sideColor'),
    fontWeight: WEIGHTS.test(weight) ? weight : TEXT3D_DEFAULTS.fontWeight,
    fontStyle: STYLES.includes(el.fontStyle) ? el.fontStyle : 'normal',
    textAlign: ALIGNS[el.textAlign] ? el.textAlign : 'center',
    fontFamily: String(el.fontFamily || fallbackFont || 'sans-serif').replace(/[<>"`;{}\\\r\n]/g, ''),
  }
}

const escapeText = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// A hex color moved toward black by `amount` (0–1)
export function darken(hex, amount) {
  let h = hex.slice(1)
  if (h.length === 3) h = h.replace(/./g, c => c + c)
  const k = 1 - Math.min(1, Math.max(0, amount))
  return '#' + [0, 2, 4].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('')
}

const round = v => Math.round(v * 100) / 100 || 0

// The copies behind the face, back to front: how far back each sits and its color
export function text3dLayers(el) {
  const s = text3dSettings(el)
  const n = Math.min(MAX_LAYERS, Math.ceil(s.depth))
  const layers = []
  for (let i = n; i >= 1; i--) {
    // The one just behind the face keeps the side color; the back is darkest
    const t = n === 1 ? 0 : (i - 1) / (n - 1)
    layers.push({ z: round(-(i * s.depth) / n), color: darken(s.sideColor, s.sideShade * t) })
  }
  return layers
}

// How far the back of the text lands from its face, in px, ignoring the
// perspective: the direction the extrusion shows in
export function text3dExtrusion(el) {
  const s = text3dSettings(el)
  const rx = (s.rotateX * Math.PI) / 180
  const ry = (s.rotateY * Math.PI) / 180
  // (0, 0, -depth) turned by rotateX(rx) rotateY(ry), with y down
  return { dx: round(-s.depth * Math.sin(ry)), dy: round(s.depth * Math.cos(ry) * Math.sin(rx)) }
}

// How many times larger than it shows the text is drawn. A browser draws
// text under a perspective at its own size and stretches that when the slide
// is scaled up (fullscreen, a sharp screen), which blurs it; drawn larger and
// scaled down, it stays sharp. Every copy behind extruded text is drawn at
// that size too, so extruded text gets less.
export function text3dResolution(el) {
  return text3dSettings(el).depth > 0 ? 2 : 4
}

// The element's inside, filling its box. `fontFamily` is the deck's font,
// for text that has none of its own; `resolution` overrides
// text3dResolution (thumbnails, drawn small, need no more than 1).
//
// The text is laid out `resolution` times larger in a box as many times the
// element's, which is scaled down to fit it: the same picture, at more pixels.
export function text3dHtml(el, { fontFamily, resolution } = {}) {
  const s = text3dSettings(el, fontFamily)
  const k = Math.max(1, Math.round(Number(resolution) || text3dResolution(el)))
  const text = escapeText(el.content)
  const type = `font-family:${s.fontFamily};font-size:${round(s.fontSize * k)}px;font-weight:${s.fontWeight};font-style:${s.fontStyle};letter-spacing:${round(s.letterSpacing * k)}px;line-height:${s.lineHeight};text-align:${s.textAlign};white-space:pre-wrap;`
  const layers = text3dLayers(el)
    .map(l => `<div aria-hidden="true" style="position:absolute;inset:0;color:${l.color};transform:translateZ(${round(l.z * k)}px)">${text}</div>`)
    .join('')
  const down = Math.round(1e6 / k) / 1e6
  return `<div class="text3d" style="position:relative;width:100%;height:100%;perspective:${s.perspective}px">`
    + `<div style="position:absolute;left:0;top:0;width:${100 * k}%;height:${100 * k}%;transform-origin:0 0;transform:scale3d(${down},${down},${down});transform-style:preserve-3d;display:flex;align-items:center;justify-content:${ALIGNS[s.textAlign]};${type}">`
    + `<div style="position:relative;transform-style:preserve-3d;transform:rotateX(${s.rotateX}deg) rotateY(${s.rotateY}deg)">`
    + `${layers}<div style="position:relative;color:${s.color}">${text}</div></div></div></div>`
}

// Degrees of tilt per pixel the pointer moves in tilt mode
const TILT_PER_PX = 0.4

// The tilt after dragging `dx`, `dy` screen pixels from where it was: the
// text turns the way the pointer goes, like grabbing the plane. Right turns
// its face to the right; down tips its top toward you.
export function text3dTilt(start, dx, dy) {
  const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Math.round(v)))
  const from = key => Number.isFinite(Number(start[key])) && start[key] !== null ? Number(start[key]) : TEXT3D_DEFAULTS[key]
  return {
    rotateY: clamp(from('rotateY') + dx * TILT_PER_PX, TEXT3D_LIMITS.rotateY) || 0,
    rotateX: clamp(from('rotateX') - dy * TILT_PER_PX, TEXT3D_LIMITS.rotateX) || 0,
  }
}

// The element's drop shadow, as a filter: a box-shadow would draw its box
export function text3dShadowFilter(el) {
  if (!(el.shadowBlur || el.shadowX || el.shadowY)) return ''
  const px = v => Number(v) || 0
  const color = String(el.shadowColor || 'rgba(0,0,0,0.5)').replace(/[<>"`;{}\\\r\n]/g, '')
  return `drop-shadow(${px(el.shadowX)}px ${px(el.shadowY)}px ${Math.max(0, px(el.shadowBlur))}px ${color})`
}

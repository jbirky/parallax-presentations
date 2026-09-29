// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Written by scripts/build-deck-html.js from client/src/utils/generateHTML.js and what it
// imports; edit those, then run the script.

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// deck-html.js
var deck_html_exports = {};
__export(deck_html_exports, {
  generateRevealHTML: () => generateRevealHTML
});
module.exports = __toCommonJS(deck_html_exports);

// client/src/utils/shapeGeometry.js
var CLOSED_SHAPES = ["rect", "rounded-rect", "circle", "triangle", "diamond", "arrow-right", "star"];
var num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
var round = (v) => Math.round(v * 100) / 100;
var escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function dashArray(style, width) {
  return style === "dashed" ? `${width * 3} ${width * 2}` : style === "dotted" ? `${width} ${width * 1.5}` : void 0;
}
function starPoints(el, w, h, sw) {
  const cx = el.starCx != null ? num(el.starCx) : w / 2;
  const cy = el.starCy != null ? num(el.starCy) : h / 2;
  const outerR = el.starOuterR != null ? num(el.starOuterR) : Math.min(w, h) / 2 - sw;
  const innerR = el.starInnerR != null ? num(el.starInnerR) : outerR * 0.4;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 5 * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}
function polygonPoints(el, w, h, sw) {
  switch (el.shape) {
    case "triangle":
      return [[w / 2, sw], [w - sw, h - sw], [sw, h - sw]];
    case "diamond":
      return [[w / 2, sw], [w - sw, h / 2], [w / 2, h - sw], [sw, h / 2]];
    case "arrow-right":
      return [[sw, h * 0.35], [w * 0.6, h * 0.35], [w * 0.6, sw], [w - sw, h / 2], [w * 0.6, h - sw], [w * 0.6, h * 0.65], [sw, h * 0.65]];
    case "star":
      return starPoints(el, w, h, sw);
    default:
      return null;
  }
}
var cornerRadius = (el, w, h, sw) => Math.max(0, Math.min(el.shape === "rounded-rect" ? Math.min(w, h) * 0.15 : num(el.borderRadius), (w - sw) / 2, (h - sw) / 2));
function shapeParts(el) {
  const w = num(el.width), h = num(el.height), sw = num(el.strokeWidth);
  const shape = el.shape || "rect";
  if (shape === "line" || shape === "line-arrow") {
    const lw = num(el.strokeWidth) || 3;
    const color2 = el.stroke && el.stroke !== "none" ? el.stroke : el.fill || "#ffffff";
    const dash = dashArray(el.strokeDasharray, lw);
    const lines = [{ tag: "line", attrs: { x1: lw, y1: h / 2, x2: w - lw, y2: h / 2, stroke: color2, "stroke-width": lw, "stroke-dasharray": dash, fill: "none" } }];
    if (shape === "line-arrow") {
      const hs = Math.max(lw * 3, h * 0.3);
      lines.push({ tag: "polyline", attrs: {
        points: `${w - lw - hs},${h / 2 - hs} ${w - lw},${h / 2} ${w - lw - hs},${h / 2 + hs}`,
        stroke: color2,
        "stroke-width": lw,
        fill: "none",
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      } });
    }
    return { lines };
  }
  const group = { fill: el.fill || "#6366f1", stroke: el.stroke || "none", "stroke-width": sw, "stroke-dasharray": dashArray(el.strokeDasharray, sw) };
  const poly = polygonPoints({ ...el, shape }, w, h, sw);
  const body = poly ? { tag: "polygon", attrs: { points: poly.map((p) => p.join(",")).join(" ") } } : shape === "circle" ? { tag: "ellipse", attrs: { cx: w / 2, cy: h / 2, rx: Math.max(0, w / 2 - sw / 2), ry: Math.max(0, h / 2 - sw / 2) } } : { tag: "rect", attrs: { x: sw / 2, y: sw / 2, width: w - sw, height: h - sw, rx: shape === "rect" || shape === "rounded-rect" ? cornerRadius({ ...el, shape }, w, h, sw) : 0 } };
  return { group, body };
}
function shapeOutline(el, n = 64) {
  const shape = el.shape || "rect";
  if (!CLOSED_SHAPES.includes(shape)) return null;
  const w = num(el.width), h = num(el.height), sw = num(el.strokeWidth);
  let dense = polygonPoints({ ...el, shape }, w, h, sw);
  if (shape === "circle") {
    const rx = Math.max(0, w / 2 - sw / 2), ry = Math.max(0, h / 2 - sw / 2);
    dense = Array.from({ length: 256 }, (_, i) => {
      const a = 2 * Math.PI * i / 256 - Math.PI / 2;
      return [w / 2 + rx * Math.cos(a), h / 2 + ry * Math.sin(a)];
    });
  } else if (!dense) {
    const r = cornerRadius({ ...el, shape }, w, h, sw), x0 = sw / 2, y0 = sw / 2, x1 = w - sw / 2, y1 = h - sw / 2;
    const arc = (cx2, cy, from) => Array.from({ length: 17 }, (_, i) => {
      const a = from + Math.PI / 2 * (i / 16);
      return [cx2 + r * Math.cos(a), cy + r * Math.sin(a)];
    });
    dense = [...arc(x1 - r, y0 + r, -Math.PI / 2), ...arc(x1 - r, y1 - r, 0), ...arc(x0 + r, y1 - r, Math.PI / 2), ...arc(x0 + r, y0 + r, Math.PI)];
  }
  const area = dense.reduce((a, p, i) => {
    const q = dense[(i + 1) % dense.length];
    return a + p[0] * q[1] - q[0] * p[1];
  }, 0);
  if (area < 0) dense.reverse();
  const cx = w / 2;
  let top = null;
  dense.forEach((p, i) => {
    const q = dense[(i + 1) % dense.length];
    if ((p[0] - cx) * (q[0] - cx) > 0 || p[0] === q[0]) return;
    const y = p[1] + (q[1] - p[1]) * ((cx - p[0]) / (q[0] - p[0]));
    if (!top || y < top.y) top = { i, y };
  });
  if (top) dense = [[cx, top.y], ...dense.slice(top.i + 1), ...dense.slice(0, top.i + 1)];
  const lengths = dense.map((p, i) => {
    const q = dense[(i + 1) % dense.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  const points = [];
  let edge = 0, walked = 0;
  for (let k = 0; k < n; k++) {
    const at = total * k / n;
    while (edge < dense.length - 1 && walked + lengths[edge] < at) walked += lengths[edge++];
    const p = dense[edge], q = dense[(edge + 1) % dense.length], t = lengths[edge] ? (at - walked) / lengths[edge] : 0;
    points.push([round(p[0] + (q[0] - p[0]) * t), round(p[1] + (q[1] - p[1]) * t)]);
  }
  return points;
}
var outlinePath = (points) => `M${points.map((p) => p.join(" ")).join("L")}Z`;
var attrsHtml = (attrs) => Object.entries(attrs).filter(([, v]) => v !== void 0 && v !== null && v !== "").map(([k, v]) => ` ${k}="${escapeAttr(typeof v === "number" ? round(v) : v)}"`).join("");
function shapeSvgString(el, morph = null) {
  const w = num(el.width), h = num(el.height);
  const parts = shapeParts(el);
  const inner = parts.lines ? parts.lines.map(({ tag, attrs }) => `<${tag}${attrsHtml(attrs)} />`).join("") : `<g${attrsHtml(parts.group)}>${morph ? `<path d="${escapeAttr(morph.d)}" data-morph="${escapeAttr(morph.outlines)}" />` : `<${parts.body.tag}${attrsHtml(parts.body.attrs)} />`}</g>`;
  const label = el.text ? `<text${attrsHtml({ x: morph ? "50%" : w / 2, y: morph ? "50%" : h / 2, "dominant-baseline": "middle", "text-anchor": "middle", "font-size": num(el.fontSize) || 16, fill: el.textColor || "#ffffff" })} style="font-family:inherit;">${escapeAttr(el.text)}</text>` : "";
  const box = morph ? "" : ` viewBox="0 0 ${round(w)} ${round(h)}" preserveAspectRatio="none"`;
  return `<svg width="100%" height="100%"${box} style="position:absolute;inset:0;overflow:visible;">${inner}${label}</svg>`;
}

// client/src/utils/drawingUtils.js
function pointsToPath(points, smooth = true) {
  if (!points || points.length < 2) return "";
  if (!smooth || points.length < 3) {
    return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
  }
  const d = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x} ${p2.y}`);
  }
  return d.join(" ");
}

// client/src/utils/bibtexParser.js
function parseAuthors(authorStr) {
  if (!authorStr) return [];
  return authorStr.replace(/\s+/g, " ").split(/ and /i).map((a) => {
    a = a.trim();
    if (a.includes(",")) {
      const [last, first] = a.split(",").map((s) => s.trim());
      return { first, last };
    }
    const parts = a.split(/\s+/);
    if (parts.length === 1) return { first: "", last: parts[0] };
    return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
  });
}
function formatAuthorsShort(authors) {
  if (!authors || authors.length === 0) return "";
  if (authors.length === 1) return authors[0].last;
  if (authors.length === 2) return `${authors[0].last} & ${authors[1].last}`;
  return `${authors[0].last} et al.`;
}
function getReferencedEntries(bibliography, slides) {
  if (!bibliography || !bibliography.length) return [];
  const allText = (slides || []).flatMap((s) => (s.elements || []).flatMap((el) => {
    const parts = [];
    if (el.content) parts.push(el.content);
    if (el.citationText) parts.push(el.citationText);
    return parts;
  })).join(" ");
  return bibliography.filter((entry, i) => {
    if (allText.includes(`[${i + 1}]`)) return true;
    const authors = parseAuthors(entry.author);
    const short = formatAuthorsShort(authors);
    if (short && allText.includes(short)) return true;
    if (entry.key && allText.includes(entry.key)) return true;
    return false;
  });
}

// server:plugin-registry
var plugin_registry_default = { getSandboxHtml: () => null };

// client/src/plugins/pluginEmbed.js
function staticBridge({ data, width, height }) {
  const json = JSON.stringify(data || {}).replace(/</g, "\\u003c");
  return `<script>
(function(){
  var _data = ${json};
  var _width = ${Number(width) || 0};
  var _height = ${Number(height) || 0};
  var _dataCallbacks = [];
  function copy() { return JSON.parse(JSON.stringify(_data)); }
  window.parallax = Object.freeze({
    get data() { return copy(); },
    get width() { return _width; },
    get height() { return _height; },
    updateData: function(patch) {
      Object.assign(_data, patch);
      _dataCallbacks.forEach(function(cb) { cb(copy()); });
    },
    onDataChanged: function(cb) { _dataCallbacks.push(cb); },
    onResize: function() {},
    onCaptureSnapshot: function() {},
    reportError: function(msg) { console.error('[plugin] ' + msg); },
    fetch: function(url, opts) { return window.fetch(url, opts); }
  });
})();
</script><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}</style>`;
}
function buildStaticPluginSrcdoc(sandboxHtml, { data, width, height }) {
  const injection = staticBridge({ data, width, height });
  if (/<head[^>]*>/i.test(sandboxHtml)) return sandboxHtml.replace(/<head[^>]*>/i, (m) => m + injection);
  if (/<html[^>]*>/i.test(sandboxHtml)) return sandboxHtml.replace(/<html[^>]*>/i, (m) => m + injection);
  return injection + sandboxHtml;
}

// client/src/utils/generateHTML.js
var import_libraries2 = require("./libraries");

// client/src/utils/modelViewer.js
var import_libraries = require("./libraries");
var MODEL_DEFAULTS = {
  color: "#b8c2cc",
  background: "transparent",
  view: "iso",
  autoRotate: false,
  edges: false
};
function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
function modelViewerHtml(el, { src = el.src, snapshotKey = null } = {}) {
  const options = {
    src: src || "",
    color: el.color || MODEL_DEFAULTS.color,
    background: el.background || MODEL_DEFAULTS.background,
    view: el.view || MODEL_DEFAULTS.view,
    // 'auto': STL has no up axis and is nearly always Z-up (CAD, slicers);
    // glTF is Y-up by definition
    up: el.upAxis === "y" || el.upAxis === "z" ? el.upAxis : "auto",
    autoRotate: !!el.autoRotate,
    edges: !!el.edges,
    snapshotKey
  };
  const imports = {
    three: (0, import_libraries.libUrl)("three", "build/three.module.js")
  };
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block;outline:none}#status{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;text-align:center;font:13px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:rgba(128,128,128,0.9);pointer-events:none}#status.error{color:#e5484d}</style>
<script type="importmap">${scriptJson({ imports })}</script>
</head><body><div id="status">Loading model…</div>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from '${(0, import_libraries.libUrl)("three", "examples/jsm/controls/OrbitControls.js")}';
import { GLTFLoader } from '${(0, import_libraries.libUrl)("three", "examples/jsm/loaders/GLTFLoader.js")}';
import { STLLoader } from '${(0, import_libraries.libUrl)("three", "examples/jsm/loaders/STLLoader.js")}';
import { RoomEnvironment } from '${(0, import_libraries.libUrl)("three", "examples/jsm/environments/RoomEnvironment.js")}';

const O = ${scriptJson(options)};
const status = document.getElementById('status');
function fail(message) { status.className = 'error'; status.textContent = message; }

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
} catch (e) {
  fail('3D needs WebGL, which this browser has turned off.');
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
if (O.background !== 'transparent') scene.background = new THREE.Color(O.background);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(0.5, 1, 1);
camera.add(key);
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = O.autoRotate;
controls.autoRotateSpeed = 1.5;

let dirty = true, touched = false, model = null, snapshotSent = false;
controls.addEventListener('change', () => { dirty = true; });
controls.addEventListener('start', () => { touched = true; });

const VIEWS = { iso: [1, 0.75, 1], front: [0, 0, 1], top: [0, 1, 0.0001], right: [1, 0, 0] };

// The model's bounding sphere just fills the frame, seen from O.view
function frame() {
  if (!model) return;
  const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
  const radius = sphere.radius || 1;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distance = 1.15 * radius / Math.sin(Math.min(vFov, hFov) / 2);
  const dir = new THREE.Vector3(...(VIEWS[O.view] || VIEWS.iso)).normalize();
  controls.target.copy(sphere.center);
  camera.position.copy(sphere.center).addScaledVector(dir, distance);
  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  controls.update();
  dirty = true;
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // Loaded on a hidden slide, it was framed at no size: frame it again
  // when shown, unless someone has already turned it
  if (!touched) frame();
  dirty = true;
}
window.addEventListener('resize', resize);
window.addEventListener('message', e => {
  if (e.source === window.parent && e.data === 'parallax-resize') resize();
});
resize();

function addEdges(root) {
  const material = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 });
  const meshes = [];
  root.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const mesh of meshes) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), material));
}

function isGlb(buffer) {
  return buffer.byteLength >= 4 && new DataView(buffer).getUint32(0, true) === 0x46546C67;
}

function parse(buffer) {
  if (isGlb(buffer)) {
    return new Promise((resolve, reject) => {
      new GLTFLoader().parse(buffer, '', gltf => resolve({ object: gltf.scene, zUp: O.up === 'z' }), err => {
        const message = String(err && err.message || err);
        reject(new Error(/draco|meshopt|KHR_|EXT_/i.test(message)
          ? 'This GLB uses compression or an extension the viewer can’t read. Export it again without compression.'
          : message));
      });
    });
  }
  const unreadable = new Error('This file isn’t an STL or GLB model the viewer can read.');
  let geometry;
  try { geometry = new STLLoader().parse(buffer); } catch (e) { throw unreadable; }
  if (!geometry.attributes.position || !geometry.attributes.position.count) throw unreadable;
  const material = new THREE.MeshStandardMaterial({
    color: geometry.hasColors ? 0xffffff : O.color,
    vertexColors: !!geometry.hasColors,
    metalness: 0.1,
    roughness: 0.55,
  });
  return { object: new THREE.Mesh(geometry, material), zUp: O.up !== 'y' };
}

function sendSnapshot() {
  if (!O.snapshotKey || snapshotSent) return;
  snapshotSent = true;
  try {
    parent.postMessage({ source: 'parallax-embed', type: 'snapshot', key: O.snapshotKey, dataUrl: renderer.domElement.toDataURL('image/png') }, '*');
  } catch (e) { /* the thumbnail keeps its placeholder */ }
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if (!dirty) return;
  dirty = false;
  renderer.render(scene, camera);
  if (model) sendSnapshot();
}
animate();

if (!O.src) {
  fail('No model file yet. Choose an STL or GLB file in the properties panel.');
} else {
  fetch(O.src)
    .then(res => {
      if (!res.ok) throw new Error('The model file couldn’t be loaded (' + res.status + ').');
      return res.arrayBuffer();
    })
    .then(parse)
    .then(({ object, zUp }) => {
      const holder = new THREE.Group();
      if (zUp) holder.rotation.x = -Math.PI / 2;
      holder.add(object);
      if (O.edges) addEdges(holder);
      scene.add(holder);
      model = holder;
      status.textContent = '';
      frame();
    })
    .catch(err => fail(err && err.message ? err.message : 'The model couldn’t be read.'));
}
</script></body></html>`;
}

// client/src/utils/tikzDiagram.js
function sanitizeSvg(svg) {
  if (typeof svg !== "string") return "";
  const start = svg.search(/<svg\b/i);
  let end = -1;
  for (const m of svg.matchAll(/<\/svg\s*>/gi)) end = m.index + m[0].length;
  if (start < 0 || end <= start) return "";
  return withoutPairs(svg.slice(start, end)).replace(/<(script|iframe|object|embed)\b[^>]*>/gi, "").replace(/\son[a-z]+\s*=\s*("[^"]*(?:"|$)|'[^']*(?:'|$)|[^\s>]+)/gi, "").replace(/\s((?:xlink:)?href)\s*=\s*("\s*javascript:[^"]*(?:"|$)|'\s*javascript:[^']*(?:'|$))/gi, ' $1="#"');
}
function withoutPairs(html) {
  const lower = html.toLowerCase();
  const noCloseFrom = {};
  const open = /<(script|iframe|object|embed)\b/gi;
  let out = "", kept = 0, m;
  while (m = open.exec(html)) {
    const tag = m[1].toLowerCase();
    if (m.index >= (noCloseFrom[tag] ?? Infinity)) continue;
    const close = new RegExp(`</${tag}\\s*>`, "g");
    close.lastIndex = m.index;
    const c = close.exec(lower);
    if (!c) {
      noCloseFrom[tag] = m.index;
      continue;
    }
    out += html.slice(kept, m.index);
    kept = open.lastIndex = c.index + c[0].length;
  }
  return out + html.slice(kept);
}
function tikzDiagramSvg(el) {
  return sanitizeSvg(el.svg).replace(/^<svg\b/i, '<svg style="width:100%;height:100%;display:block;overflow:visible"');
}

// client/src/utils/annotationOverlay.js
function installAnnotations(config) {
  const NS = "http://www.w3.org/2000/svg";
  const W = config.slideW, H = config.slideH;
  const set = config.set;
  set.slides = set.slides || {};
  set.boards = set.boards || [];
  const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ffffff", "#111827"];
  const SIZES = [3, 6, 12];
  const ERASE_RADIUS = 10;
  let tool = null;
  let color2 = COLORS[0];
  let size = SIZES[0];
  let penSeen = false;
  let active = null;
  let sent = false;
  const undoStacks = {};
  const keyOf = (section) => section && (section.getAttribute("data-slide-id") || section.getAttribute("data-board-id"));
  const boardOf = (section) => section && set.boards.find((b) => b.id === section.getAttribute("data-board-id"));
  function pathsOf(section) {
    const board = boardOf(section);
    if (board) return board.paths;
    const key = keyOf(section);
    if (!set.slides[key]) set.slides[key] = { paths: [] };
    return set.slides[key].paths;
  }
  const currentPage = () => {
    const s = window.Reveal && Reveal.getCurrentSlide();
    return keyOf(s) ? s : null;
  };
  const scrollerOf = (section) => section && section.querySelector(":scope > .slide-scroller");
  const surfaceOf = (section) => scrollerOf(section)?.querySelector(":scope > .slide-scroll-inner") || section;
  const heightOf = (section) => Number(section.getAttribute("data-scroll-height")) || H;
  function layerOf(section) {
    const surface = surfaceOf(section);
    let svg = surface.querySelector(":scope > svg.pp-ink");
    if (!svg) {
      svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "pp-ink");
      svg.setAttribute("viewBox", `0 0 ${W} ${heightOf(section)}`);
      surface.appendChild(svg);
    }
    return svg;
  }
  function pathD(points) {
    if (points.length === 1) return `M${points[0][0]} ${points[0][1]}l0.01 0`;
    let d = `M${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i], [nx, ny] = points[i + 1];
      d += `Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
    }
    const last = points[points.length - 1];
    return d + `L${last[0]} ${last[1]}`;
  }
  function pathElement(p) {
    const el = document.createElementNS(NS, "path");
    el.setAttribute("d", pathD(p.points));
    el.setAttribute("stroke", p.color);
    el.setAttribute("stroke-width", p.strokeWidth);
    el.setAttribute("stroke-opacity", p.opacity ?? 1);
    el.setAttribute("fill", "none");
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("stroke-linejoin", "round");
    return el;
  }
  function render(section) {
    const layer = layerOf(section);
    layer.querySelectorAll("path:not(.pp-laser)").forEach((el) => el.remove());
    for (const p of pathsOf(section)) layer.appendChild(pathElement(p));
  }
  function toSlide(e, section) {
    const r = surfaceOf(section).getBoundingClientRect();
    const round2 = (v) => Math.round(v * 10) / 10;
    return [round2((e.clientX - r.left) * W / r.width), round2((e.clientY - r.top) * heightOf(section) / r.height)];
  }
  function simplify(points, tolerance) {
    if (points.length < 3) return points;
    const [ax, ay] = points[0], [bx, by] = points[points.length - 1];
    let far = 0, index = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const [px, py] = points[i];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const d = Math.abs((by - ay) * px - (bx - ax) * py + bx * ay - by * ax) / len;
      if (d > far) {
        far = d;
        index = i;
      }
    }
    if (far <= tolerance) return [points[0], points[points.length - 1]];
    return simplify(points.slice(0, index + 1), tolerance).slice(0, -1).concat(simplify(points.slice(index), tolerance));
  }
  function segmentDistance([px, py], [ax, ay], [bx, by]) {
    const dx = bx - ax, dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function eraseAt(section, pt) {
    const paths = pathsOf(section);
    for (let i = paths.length - 1; i >= 0; i--) {
      const p = paths[i], reach = ERASE_RADIUS + p.strokeWidth / 2;
      const pts = p.points;
      const hit = pts.length === 1 ? Math.hypot(pt[0] - pts[0][0], pt[1] - pts[0][1]) <= reach : pts.some((q, j) => j > 0 && segmentDistance(pt, pts[j - 1], q) <= reach);
      if (hit) {
        paths.splice(i, 1);
        pushUndo(section, { type: "remove", path: p, index: i });
        render(section);
        scheduleSave();
      }
    }
  }
  function pushUndo(section, action) {
    const key = keyOf(section);
    (undoStacks[key] = undoStacks[key] || []).push(action);
  }
  function undo() {
    const section = currentPage();
    const stack = section && undoStacks[keyOf(section)];
    const action = stack && stack.pop();
    if (!action) return;
    const paths = pathsOf(section);
    if (action.type === "add") {
      const i = paths.lastIndexOf(action.path);
      if (i !== -1) paths.splice(i, 1);
    }
    if (action.type === "remove") paths.splice(action.index, 0, action.path);
    if (action.type === "clear") paths.push(...action.paths);
    render(section);
    scheduleSave();
  }
  function clearPage() {
    const section = currentPage();
    const paths = section && pathsOf(section);
    if (!paths || !paths.length || !confirm("Clear the ink on this slide?")) return;
    pushUndo(section, { type: "clear", paths: paths.splice(0) });
    render(section);
    scheduleSave();
  }
  function boardSection(board) {
    const s = document.createElement("section");
    s.setAttribute("data-board-id", board.id);
    s.className = "pp-board";
    s.style.cssText = `padding:0;width:${W}px;height:${H}px`;
    return s;
  }
  function findPage(key) {
    return [...document.querySelectorAll(".reveal .slides section")].find((s) => keyOf(s) === key) || null;
  }
  function addBoard() {
    const anchor = currentPage();
    if (!anchor) return;
    const id = "board-" + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
    const board = { id, afterId: keyOf(anchor), paths: [] };
    set.boards.push(board);
    const section = boardSection(board);
    anchor.after(section);
    Reveal.sync();
    const { h, v } = Reveal.getIndices(section);
    Reveal.slide(h, v);
    scheduleSave();
  }
  function deleteBoard() {
    const section = currentPage();
    const board = boardOf(section);
    if (!board || board.paths.length && !confirm("Delete this board and its ink?")) return;
    set.boards = set.boards.filter((b) => b !== board);
    for (const b of set.boards) if (b.afterId === board.id) b.afterId = board.afterId;
    Reveal.prev();
    section.remove();
    Reveal.sync();
    scheduleSave();
  }
  function restoreBoards() {
    for (const board of set.boards) {
      const anchor = findPage(board.afterId);
      const section = boardSection(board);
      if (anchor) anchor.after(section);
      else document.querySelector(".reveal .slides").appendChild(section);
    }
    if (set.boards.length) Reveal.sync();
  }
  const hasInk = () => Object.values(set.slides).some((s) => s.paths.length) || set.boards.length > 0;
  function scheduleSave() {
    status("Saving…");
    flush();
  }
  function flush() {
    if (!hasInk() && !sent) return status("");
    set.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const slides = Object.fromEntries(Object.entries(set.slides).filter(([, s]) => s.paths.length));
    window.parent.postMessage({ type: config.message, set: { ...set, slides } }, config.origin);
    sent = true;
  }
  window.addEventListener("message", (e) => {
    if (e.source !== window.parent || e.data?.type !== `${config.message}:status`) return;
    status(e.data.saved ? "Saved" : "Kept on this device. It saves when you next open the presentation.");
  });
  const shield = document.createElement("div");
  shield.className = "pp-shield";
  document.querySelector(".reveal").appendChild(shield);
  const draws = (e) => e.pointerType !== "touch" || !penSeen;
  shield.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "pen") penSeen = true;
    const section = currentPage();
    if (!tool || !section || !draws(e) || e.button > 0 || Reveal.isOverview()) return;
    e.preventDefault();
    try {
      shield.setPointerCapture(e.pointerId);
    } catch {
    }
    const pt = toSlide(e, section);
    if (tool === "eraser") {
      active = { id: e.pointerId, section, erase: true };
      return eraseAt(section, pt);
    }
    const highlighter = tool === "highlighter", laser = tool === "laser";
    const path = {
      points: [pt],
      color: laser ? "#ff3b3b" : color2,
      strokeWidth: laser ? 4 : highlighter ? size * 4 : size,
      opacity: highlighter ? 0.35 : 1
    };
    const el = pathElement(path);
    if (laser) el.setAttribute("class", "pp-laser");
    layerOf(section).appendChild(el);
    active = { id: e.pointerId, section, path, el, laser };
  });
  shield.addEventListener("pointermove", (e) => {
    if (!active || e.pointerId !== active.id) return;
    e.preventDefault();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      const pt = toSlide(ev, active.section);
      if (active.erase) {
        eraseAt(active.section, pt);
        continue;
      }
      const last = active.path.points[active.path.points.length - 1];
      if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) >= 0.8) active.path.points.push(pt);
    }
    if (!active.erase) active.el.setAttribute("d", pathD(active.path.points));
  });
  function endStroke(e) {
    if (!active || e.pointerId !== active.id) return;
    const { section, path, el, laser, erase } = active;
    active = null;
    if (erase) return;
    if (laser) {
      el.style.transition = "opacity 0.8s";
      setTimeout(() => {
        el.style.opacity = "0";
      }, 400);
      setTimeout(() => el.remove(), 1300);
      return;
    }
    path.points = simplify(path.points, 0.6);
    pathsOf(section).push(path);
    pushUndo(section, { type: "add", path });
    el.setAttribute("d", pathD(path.points));
    scheduleSave();
  }
  shield.addEventListener("pointerup", endStroke);
  shield.addEventListener("pointercancel", endStroke);
  for (const type of ["touchstart", "touchmove"]) {
    shield.addEventListener(type, (e) => {
      const stylus = [...e.changedTouches].some((t) => t.touchType === "stylus");
      if (tool && (stylus || !penSeen)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false });
  }
  shield.addEventListener("wheel", (e) => {
    const scroller = scrollerOf(currentPage());
    if (!scroller) return;
    e.preventDefault();
    scroller.scrollTop += e.deltaY;
  }, { passive: false });
  let drag = null;
  shield.addEventListener("touchstart", (e) => {
    const scroller = scrollerOf(currentPage());
    const t = e.touches[0];
    drag = tool && penSeen && scroller && e.touches.length === 1 && t.touchType !== "stylus" ? { scroller, x: t.clientX, y: t.clientY, vertical: null } : null;
  }, { passive: true });
  shield.addEventListener("touchmove", (e) => {
    if (!drag) return;
    const t = e.touches[0];
    if (drag.vertical === null) {
      const dx = t.clientX - drag.x, dy = t.clientY - drag.y;
      if (Math.hypot(dx, dy) < 8) return;
      drag.vertical = Math.abs(dy) > Math.abs(dx);
    }
    if (!drag.vertical) return;
    e.stopPropagation();
    const scale = drag.scroller.clientHeight / (drag.scroller.getBoundingClientRect().height || 1);
    drag.scroller.scrollTop -= (t.clientY - drag.y) * scale;
    drag.y = t.clientY;
  }, { passive: true });
  shield.addEventListener("touchend", () => {
    drag = null;
  });
  const style = document.createElement("style");
  style.textContent = `
    svg.pp-ink { position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:none; overflow:visible; z-index:2000; }
    svg.pp-ink .pp-laser { filter: drop-shadow(0 0 3px #ff3b3b); }
    .pp-shield { position:absolute; inset:0; z-index:2500; display:none; touch-action:none; }
    .pp-on .pp-shield { display:block; cursor:crosshair; }
    .pp-bar { position:fixed; left:12px; bottom:12px; z-index:3000; display:flex; align-items:center; gap:4px; flex-wrap:wrap; max-width:calc(100vw - 24px);
      padding:5px; border-radius:22px; background:rgba(20,20,30,0.82); color:#fff; font:13px/1 -apple-system,system-ui,sans-serif; box-shadow:0 4px 16px rgba(0,0,0,0.35); }
    .pp-bar button { all:unset; box-sizing:border-box; min-width:34px; height:34px; padding:0 8px; border-radius:17px; display:inline-flex; align-items:center; justify-content:center; gap:4px; cursor:pointer; }
    .pp-bar button:hover { background:rgba(255,255,255,0.14); }
    .pp-bar button[aria-pressed="true"] { background:rgba(255,255,255,0.26); }
    .pp-bar button:focus-visible { outline:2px solid #818cf8; }
    .pp-bar .pp-sep { width:1px; height:22px; background:rgba(255,255,255,0.2); margin:0 2px; }
    .pp-bar .pp-swatch { width:18px; height:18px; border-radius:50%; border:2px solid rgba(255,255,255,0.5); }
    .pp-bar .pp-dot { border-radius:50%; background:#fff; }
    .pp-bar .pp-status { font-size:11px; opacity:0.75; padding:0 6px; max-width:240px; }
    .pp-bar:not(.pp-open) > :not(.pp-toggle) { display:none; }
    .pp-bar:not(.pp-open) { opacity:0.55; }
    .pp-bar:not(.pp-open):hover { opacity:1; }
    .pp-bar .pp-board-only { display:none; }
    .pp-on-board .pp-bar.pp-open .pp-board-only { display:inline-flex; }
  `;
  document.head.appendChild(style);
  const bar = document.createElement("div");
  bar.className = "pp-bar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Annotate");
  const button = (label, content, onClick, extra = "") => {
    const b = document.createElement("button");
    b.type = "button";
    b.title = label;
    b.setAttribute("aria-label", label);
    if (extra) b.className = extra;
    b.innerHTML = content;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick(b);
    });
    return b;
  };
  const sep = () => Object.assign(document.createElement("span"), { className: "pp-sep" });
  const toolButtons = {};
  const swatchButtons = [], sizeButtons = [];
  const toggle = button("Annotate (D)", "&#9998;", () => setTool(tool ? null : "pen"), "pp-toggle");
  bar.append(toggle);
  for (const [name, label, icon] of [["pen", "Pen", "&#9998;"], ["highlighter", "Highlighter", "&#9646;"], ["eraser", "Eraser (E)", "&#9003;"], ["laser", "Laser pointer", "&#9673;"]]) {
    toolButtons[name] = button(label, icon, () => setTool(name));
    bar.append(toolButtons[name]);
  }
  bar.append(sep());
  for (const c of COLORS) {
    const b = button(`Color ${c}`, `<span class="pp-swatch" style="background:${c}"></span>`, () => {
      color2 = c;
      if (tool !== "highlighter") setTool("pen");
      refresh();
    });
    b.dataset.color = c;
    swatchButtons.push(b);
    bar.append(b);
  }
  bar.append(sep());
  for (const s of SIZES) {
    const b = button(`Width ${s}`, `<span class="pp-dot" style="width:${s + 3}px;height:${s + 3}px"></span>`, () => {
      size = s;
      refresh();
    });
    b.dataset.size = s;
    sizeButtons.push(b);
    bar.append(b);
  }
  bar.append(sep());
  bar.append(button("Undo (Ctrl+Z)", "&#8630;", undo));
  bar.append(button("Clear slide", "&#128465;", clearPage));
  bar.append(sep());
  bar.append(button("New board after this slide", "&#65291; Board", addBoard));
  bar.append(button("Delete this board", "&#10005; Board", deleteBoard, "pp-board-only"));
  const statusEl = Object.assign(document.createElement("span"), { className: "pp-status" });
  statusEl.setAttribute("aria-live", "polite");
  bar.append(statusEl);
  bar.append(button("Stop annotating (Esc)", "Done", () => setTool(null)));
  for (const type of ["pointerdown", "touchstart", "mousedown"]) bar.addEventListener(type, (e) => e.stopPropagation());
  document.body.appendChild(bar);
  function status(text) {
    statusEl.textContent = text;
  }
  function refresh() {
    document.documentElement.classList.toggle("pp-on", !!tool);
    document.documentElement.classList.toggle("pp-on-board", !!boardOf(currentPage()));
    bar.classList.toggle("pp-open", !!tool);
    for (const [name, b] of Object.entries(toolButtons)) b.setAttribute("aria-pressed", String(tool === name));
    for (const b of swatchButtons) b.setAttribute("aria-pressed", String(b.dataset.color === color2));
    for (const b of sizeButtons) b.setAttribute("aria-pressed", String(Number(b.dataset.size) === size));
    shield.style.cursor = tool === "eraser" ? "cell" : "crosshair";
  }
  function setTool(name) {
    tool = name;
    refresh();
  }
  Reveal.on("slidechanged", refresh);
  window.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea, [contenteditable]")) return;
    const key = e.key.toLowerCase();
    let handled = true;
    if (key === "d" && !e.ctrlKey && !e.metaKey && !e.altKey) setTool(tool ? null : "pen");
    else if (tool && key === "e" && !e.ctrlKey && !e.metaKey) setTool("eraser");
    else if (tool && key === "escape") setTool(null);
    else if (key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) undo();
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  restoreBoards();
  document.querySelectorAll(".reveal .slides section[data-slide-id], .reveal .slides section[data-board-id]").forEach((s) => {
    const board = boardOf(s);
    if ((board ? board.paths : set.slides[keyOf(s)]?.paths || []).length) render(s);
  });
  refresh();
  return { flush, setTool, get set() {
    return set;
  } };
}

// client/src/utils/scrollingSlides.js
var MAX_SCREENS = 8;
function getCanvasHeight(slide, slideH) {
  const h = Math.round(Number(slide?.scrollHeight) || 0);
  return h > slideH ? Math.min(h, slideH * MAX_SCREENS) : slideH;
}
var isScrolling = (slide, slideH) => getCanvasHeight(slide, slideH) > slideH;
var isPinned = (el) => el?.scrollBehavior === "pin";
function hasScrollingSlides(presentation) {
  const slideH = presentation?.slideHeight || 540;
  return (presentation?.slides || []).some((slide) => isScrolling(slide, slideH));
}
function canvasBackgroundStyle(bg, url = (src) => src) {
  const value = (v) => String(v).replace(/[\\;{}<>"'`\r\n]/g, "").replace(/&/g, "&amp;");
  if (bg?.type === "gradient" && bg.gradient) return `background:${value(bg.gradient)};`;
  if (bg?.type === "image" && bg.image && !/^\s*(javascript|data|vbscript):/i.test(bg.image)) {
    return `background-image:url('${value(url(bg.image))}');background-size:${value(bg.size || "cover")};background-position:${value(bg.position || "center")};`;
  }
  return "";
}
function scrollingSlideBody({ slideW, slideH, canvasH, elementsHtml, pinnedHtml, background = "" }) {
  return `      <div class="slide-scroller" data-prevent-swipe style="position:absolute;left:0;top:0;width:${slideW}px;height:${slideH}px;overflow-x:hidden;overflow-y:auto;">
        <div class="slide-scroll-inner" style="position:relative;width:${slideW}px;height:${canvasH}px;${background}">
${elementsHtml}
        </div>
      </div>
      <div class="slide-scroll-track" aria-hidden="true"><div class="slide-scroll-thumb"></div></div>${pinnedHtml ? `
${pinnedHtml}` : ""}`;
}
var SCROLLING_CSS = `
    .reveal .slides section > .slide-scroller { overflow-x:hidden !important; overflow-y:auto !important; overscroll-behavior:contain; touch-action:pan-y pinch-zoom; scrollbar-width:none; }
    .reveal .slides section > .slide-scroller::-webkit-scrollbar { display:none; }
    .reveal .slides section .slide-scroll-inner { overflow:visible; }
    .reveal .slides section > .slide-scroll-track { position:absolute; top:0; right:0; width:4px; height:100%; z-index:940; background:rgba(127,127,127,0.12); pointer-events:none; }
    .reveal .slides section .slide-scroll-thumb { position:absolute; left:0; top:0; width:100%; height:0; background:rgba(160,160,160,0.55); border-radius:2px; }`;
var SCROLL_STEP_SOURCE = `
      var SCROLL_STEP = 0.85;
      function scrollStep(dir, view, step) {
        var bottom = view.top + view.height;
        if (dir > 0) {
          if (step && (step.pinned || step.top < bottom)) return 'reveal';
          if (view.top < view.max - 1) return Math.min(view.max, view.top + view.height * SCROLL_STEP);
          return 'reveal';
        }
        if (step && (step.pinned || (step.top < bottom && step.bottom > view.top))) return 'reveal';
        if (view.top > 1) return Math.max(0, view.top - view.height * SCROLL_STEP);
        return step ? 'skip' : 'reveal';
      }`;
var SCROLLING_SCRIPT = `
    // ── Scrolling slides ─────────────────────────────────────────────────
    (function() {${SCROLL_STEP_SOURCE}
      var reduceMotion = false;
      try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

      function scrollerOf(slide) { return slide ? slide.querySelector(':scope > .slide-scroller') : null; }
      function canScroll(sc) { return !!sc && sc.scrollHeight > sc.clientHeight + 1; }

      // Where the canvas is, or is on its way to while a step's smooth scroll runs
      function viewOf(sc) {
        var top = sc._to != null && Date.now() - sc._toAt < 800 ? sc._to : sc.scrollTop;
        return { top: top, height: sc.clientHeight, max: sc.scrollHeight - sc.clientHeight };
      }
      function scrollToY(sc, top) {
        top = Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, top));
        sc._to = top;
        sc._toAt = Date.now();
        sc.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
      }

      // The fragment step a key would show (the lowest index still hidden) or
      // hide (the highest shown)
      function fragmentStep(slide, shown) {
        var frags = slide.querySelectorAll('.fragment'), best = null, els = [];
        for (var i = 0; i < frags.length; i++) {
          if (frags[i].classList.contains('visible') !== shown) continue;
          var index = parseInt(frags[i].getAttribute('data-fragment-index'), 10) || 0;
          if (best === null || (shown ? index > best : index < best)) { best = index; els = [frags[i]]; }
          else if (index === best) els.push(frags[i]);
        }
        return els;
      }
      // Where elements are on the canvas, or pinned: true if any is on the screen
      function extentOf(els, sc) {
        var inner = sc.firstElementChild, top = Infinity, bottom = -Infinity;
        for (var i = 0; i < els.length; i++) {
          var y = 0, node = els[i];
          while (node && node !== inner) { y += node.offsetTop; node = node.offsetParent; }
          if (node !== inner) return { pinned: true };
          top = Math.min(top, y);
          bottom = Math.max(bottom, y + els[i].offsetHeight);
        }
        return els.length ? { top: top, bottom: bottom } : null;
      }

      function keyDirection(e) {
        if (e.altKey || e.ctrlKey || e.metaKey) return 0;
        if (e.keyCode === 32) return e.shiftKey ? -1 : 1;
        if (e.shiftKey) return 0;
        if ([40, 74, 34, 78].indexOf(e.keyCode) !== -1) return 1;
        if ([38, 75, 33, 80].indexOf(e.keyCode) !== -1) return -1;
        return 0;
      }
      // Before reveal.js's own handler, which listens on the document too
      document.addEventListener('keydown', function(e) {
        var dir = keyDirection(e);
        if (!dir) return;
        var active = document.activeElement;
        if (active && (active.isContentEditable || /^(input|textarea|select)$/i.test(active.tagName))) return;
        if (Reveal.getConfig().keyboard === false || Reveal.isOverview() || Reveal.isPaused()) return;
        var slide = Reveal.getCurrentSlide(), sc = scrollerOf(slide);
        if (!canScroll(sc)) return;
        var to = scrollStep(dir, viewOf(sc), extentOf(fragmentStep(slide, dir < 0), sc));
        if (to === 'reveal') return;
        e.preventDefault();
        e.stopPropagation();
        if (to === 'skip') Reveal.prev({ skipFragments: true });
        else scrollToY(sc, to);
      }, true);

      // A fragment that appears off screen is scrolled into view
      Reveal.on('fragmentshown', function(e) {
        var sc = scrollerOf(Reveal.getCurrentSlide());
        if (!canScroll(sc)) return;
        var extent = extentOf(e.fragments || [e.fragment], sc);
        if (!extent || extent.pinned) return;
        var view = viewOf(sc), margin = 24;
        if (extent.top < view.top) scrollToY(sc, extent.top - margin);
        else if (extent.bottom > view.top + view.height) scrollToY(sc, Math.min(extent.top - margin, extent.bottom + margin - view.height));
      });

      function syncTrack(sc) {
        var thumb = sc.parentNode.querySelector(':scope > .slide-scroll-track > .slide-scroll-thumb');
        if (!thumb) return;
        var h = sc.clientHeight, max = sc.scrollHeight - h, size = Math.max(24, h * h / sc.scrollHeight);
        thumb.style.height = size + 'px';
        thumb.style.top = (max > 0 ? sc.scrollTop / max * (h - size) : 0) + 'px';
      }
      var scrollers = document.querySelectorAll('.reveal .slides section > .slide-scroller');
      for (var i = 0; i < scrollers.length; i++) (function(sc) {
        sc.addEventListener('scroll', function() { syncTrack(sc); }, { passive: true });
        // Scrolled by hand, the canvas is no longer on its way to a step's position
        var byHand = function() { sc._to = null; };
        sc.addEventListener('wheel', byHand, { passive: true });
        sc.addEventListener('touchstart', byHand, { passive: true });
      })(scrollers[i]);

      var lastIndex = -1;
      function land(e) {
        var index = Reveal.getSlides().indexOf(e.currentSlide), sc = scrollerOf(e.currentSlide);
        if (sc) {
          sc._to = null;
          sc.scrollTop = index === lastIndex - 1 ? sc.scrollHeight : 0;
          syncTrack(sc);
        }
        lastIndex = index;
      }
      Reveal.on('ready', land);
      Reveal.on('slidechanged', land);

      // The scroller keeps touches from reveal.js, so a sideways swipe on it
      // changes slides here, the way reveal.js's own swipes do
      var swipe = null;
      document.addEventListener('touchstart', function(e) {
        var on = e.touches.length === 1 && e.target.closest && e.target.closest('.slide-scroller');
        swipe = on ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
      }, { passive: true });
      document.addEventListener('touchend', function(e) {
        if (!swipe) return;
        var t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
        swipe = null;
        var config = Reveal.getConfig();
        if (config.touch === false || Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 2) return;
        if (config.navigationMode === 'linear') { if ((dx > 0) !== !!config.rtl) Reveal.prev(); else Reveal.next(); }
        else if (dx > 0) Reveal.left();
        else Reveal.right();
      }, { passive: true });
    })();`;

// client/src/utils/annotations.js
var ANNOTATION_MESSAGE = "parallax-annotations";

// client/src/utils/clickActions.js
var HOVER_EFFECTS = ["brighten", "lift", "grow", "none"];
var VISIBILITY_KEYS = ["show", "hide", "toggle"];
var HOVER_KEYS = ["show", "hide"];
var MAX_STATES = 8;
var STATE_EASINGS = {
  ease: "ease",
  "ease-in-out": "ease-in-out",
  "ease-out": "ease-out",
  "ease-in": "ease-in",
  linear: "linear",
  spring: "cubic-bezier(0.34,1.56,0.64,1)"
};
var DEFAULT_STATE_DURATION = 400;
var SET_MODES = ["set", "toggle", "cycle"];
var SAFE_ID = /^[A-Za-z0-9_-]+$/;
var COLOR = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9.,%\s/-]+\)|[a-z]{3,20})$/i;
var clamp = (v, min, max) => typeof v === "number" && Number.isFinite(v) ? +Math.min(max, Math.max(min, v)).toFixed(2) : null;
var color = (v) => typeof v === "string" && COLOR.test(v.trim()) ? v.trim() : null;
var flip = (v) => v === true || v === 180 ? 180 : v === -180 ? -180 : 0;
function elementStates(el) {
  if (typeof el?.id !== "string" || !SAFE_ID.test(el.id) || !Array.isArray(el.states)) return [];
  return el.states.filter((st) => typeof st?.id === "string" && SAFE_ID.test(st.id)).slice(0, MAX_STATES);
}
function stateValues(st) {
  return {
    x: clamp(st.x, -1e4, 1e4),
    y: clamp(st.y, -1e4, 1e4),
    width: clamp(st.width, 1, 1e4),
    height: clamp(st.height, 1, 1e4),
    rotation: clamp(st.rotation, -3600, 3600),
    scale: clamp(st.scale, 0.05, 20),
    flipX: flip(st.flipX),
    flipY: flip(st.flipY),
    opacity: clamp(st.opacity, 0, 1),
    zIndex: st.zIndex == null ? null : Math.round(clamp(st.zIndex, -1e3, 1e5) ?? 0),
    fill: color(st.fill),
    stroke: color(st.stroke),
    textColor: color(st.textColor),
    filterBrightness: clamp(st.filterBrightness, 0, 400),
    filterContrast: clamp(st.filterContrast, 0, 400),
    filterGrayscale: clamp(st.filterGrayscale, 0, 100),
    shape: CLOSED_SHAPES.includes(st.shape) ? st.shape : null,
    borderRadius: clamp(st.borderRadius, 0, 1e4),
    duration: Math.round(clamp(st.duration, 0, 1e4) ?? DEFAULT_STATE_DURATION),
    easing: STATE_EASINGS[st.easing] || "ease"
  };
}
function setList(action, modes = SET_MODES) {
  return (Array.isArray(action?.set) ? action.set : []).filter((s) => typeof s?.id === "string" && SAFE_ID.test(s.id) && (!s.state || typeof s.state === "string" && SAFE_ID.test(s.state)) && modes.includes(s.mode || "set"));
}
var NO_CLICK_ACTION = /* @__PURE__ */ new Set(["html", "p5", "model", "video", "audio", "drawing"]);
function supportsClickAction(el) {
  return !!el?.type && !NO_CLICK_ACTION.has(el.type) && !el.type.startsWith("plugin:");
}
var slideAnchor = (id) => `s-${id}`;
function safeActionUrl(url) {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  return /^(https?:\/\/[^\s]|mailto:[^\s])/i.test(trimmed) ? trimmed : "";
}
var escapeAttr2 = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var idList = (list) => (Array.isArray(list) ? list : []).filter((id) => typeof id === "string" && id && !/\s/.test(id));
function visibilityTargets(slide) {
  const targets = /* @__PURE__ */ new Set();
  for (const el of slide?.elements || []) {
    if (el.clickAction?.type === "visibility") {
      for (const key of VISIBILITY_KEYS) idList(el.clickAction[key]).forEach((id) => targets.add(id));
      setList(el.clickAction).forEach((s) => targets.add(s.id));
    }
    if (el.hoverAction?.type === "visibility") {
      for (const key of HOVER_KEYS) idList(el.hoverAction[key]).forEach((id) => targets.add(id));
      setList(el.hoverAction, ["set"]).forEach((s) => targets.add(s.id));
    }
  }
  return targets;
}
function clickActionAttrs(el, targets = /* @__PURE__ */ new Set()) {
  const click = actionAttrs(el);
  return click + hoverAttrs(el, !click) + visibilityAttrs(el, targets);
}
function actionAttrs(el) {
  const action = el?.clickAction;
  if (!action || !supportsClickAction(el)) return "";
  let target = "";
  if (action.type === "slide") {
    if (!action.slideId) return "";
    target = ` data-action-slide="${escapeAttr2(slideAnchor(action.slideId))}"`;
  } else if (action.type === "url") {
    const url = safeActionUrl(action.url);
    if (!url) return "";
    target = ` data-action-url="${escapeAttr2(url)}"${action.newTab === false ? "" : " data-action-new-tab"}`;
  } else if (action.type === "visibility") {
    const set = setList(action);
    target = VISIBILITY_KEYS.map((key) => [key, idList(action[key])]).filter(([, ids]) => ids.length).map(([key, ids]) => ` data-action-${key}="${escapeAttr2(ids.join(" "))}"`).join("") + (set.length ? ` data-action-set="${set.map((s) => `${s.id}:${s.state || ""}:${s.mode || "set"}`).join(" ")}"` : "");
    if (!target) return "";
  } else if (action.type !== "next" && action.type !== "prev") {
    return "";
  }
  const hover = HOVER_EFFECTS.includes(el.hoverEffect) && el.hoverEffect !== "brighten" ? ` data-hover="${el.hoverEffect}"` : "";
  return ` data-action="${action.type}"${target}${hover} role="${action.type === "url" ? "link" : "button"}" tabindex="0"`;
}
function hoverAttrs(el, focusable) {
  const action = el?.hoverAction;
  if (action?.type !== "visibility" || !supportsClickAction(el)) return "";
  const set = setList(action, ["set"]);
  const attrs = HOVER_KEYS.map((key) => [key, idList(action[key])]).filter(([, ids]) => ids.length).map(([key, ids]) => ` data-hover-${key}="${escapeAttr2(ids.join(" "))}"`).join("") + (set.length ? ` data-hover-set="${set.map((s) => `${s.id}:${s.state || ""}`).join(" ")}"` : "");
  return attrs && focusable ? `${attrs} tabindex="0"` : attrs;
}
function visibilityAttrs(el, targets) {
  const states = elementStates(el);
  if (!el?.id || !(targets.has(el.id) || el.startHidden || states.length)) return "";
  const start = states.some((st2) => st2.id === el.initialState) ? el.initialState : "";
  const st = states.length ? ` data-st-list="${states.map((s) => s.id).join(" ")}" data-st="${start}" data-st-start="${start}"` : "";
  return ` data-el="${escapeAttr2(el.id)}"${el.startHidden ? " data-start-hidden data-hidden" : ""}${st}`;
}
function stateOutlines(el) {
  const shape = el?.shape || "rect";
  if (el?.type !== "shape" || !CLOSED_SHAPES.includes(shape)) return null;
  const states = elementStates(el);
  const values = states.map(stateValues);
  if (!values.some((v) => v.shape && v.shape !== shape || v.width != null || v.height != null || v.borderRadius != null)) return null;
  const outlines = [["", shapeOutline(el)]];
  states.forEach((st, i) => {
    const v = values[i];
    const w = v.width ?? el.width, h = v.height ?? el.height;
    const sx = w / (el.width || 1), sy = h / (el.height || 1);
    const star = ["starCx", "starCy", "starOuterR", "starInnerR"].filter((k) => el[k] != null).reduce((o, k) => ({ ...o, [k]: el[k] * (k === "starCx" ? sx : k === "starCy" ? sy : Math.min(sx, sy)) }), {});
    outlines.push([st.id, shapeOutline({ ...el, ...star, shape: v.shape || shape, width: w, height: h, borderRadius: v.borderRadius ?? el.borderRadius })]);
  });
  return outlines;
}
function shapeSvg(el) {
  const outlines = stateOutlines(el);
  if (!outlines) return shapeSvgString(el);
  const start = elementStates(el).some((st) => st.id === el.initialState) ? el.initialState : "";
  return shapeSvgString(el, {
    d: outlinePath(outlines.find(([id]) => id === start)[1]),
    outlines: outlines.map(([id, points]) => `${id}:${points.map((p) => p.join(",")).join(" ")}`).join("|")
  });
}
function stateSteps(slide) {
  const steps = /* @__PURE__ */ new Map();
  for (const el of slide?.elements || []) {
    const ids = elementStates(el).map((st) => st.id);
    if (!ids.length || !el.stateSteps || typeof el.stateSteps !== "object") continue;
    for (const [key, state] of Object.entries(el.stateSteps)) {
      const step = Number(key);
      if (!Number.isInteger(step) || step < 1 || step > 1e3 || state && !ids.includes(state)) continue;
      if (!steps.has(step)) steps.set(step, []);
      steps.get(step).push([el.id, state || ""]);
    }
  }
  return [...steps.entries()].sort((a, b) => a[0] - b[0]);
}
function stepMarkers(slide) {
  return stateSteps(slide).map(([step, changes]) => `<span class="fragment" data-fragment-index="${step}" data-st-steps="${changes.map(([id, st]) => `${id}:${st}`).join(" ")}" aria-hidden="true" style="position:absolute;"></span>`).join("");
}
function statesCss(slides) {
  const rules = [];
  for (const slide of slides || []) {
    for (const el of slide?.elements || []) {
      const states = elementStates(el);
      if (!states.length) continue;
      const values = states.map(stateValues);
      const base = `[data-el="${el.id}"]`;
      const where = (sel) => `.reveal .slides :where(${sel})`;
      const turns = values.some((v) => v.flipX || v.flipY || v.scale != null);
      const transform = (v) => `perspective(1000px) rotateX(${v.flipY || 0}deg) rotateY(${v.flipX || 0}deg) scale(${v.scale ?? 1})`;
      const own = [turns && `transform:${transform({})}`, el.backfaceHidden === true && "backface-visibility:hidden"].filter(Boolean);
      if (own.length) rules.push(`${where(base)} { ${own.join("; ")}; }`);
      const line = el.shape === "line" || el.shape === "line-arrow";
      states.forEach((st, i) => {
        const v = values[i];
        const on = [`${base}[data-st="${st.id}"]:not([data-hover-st])`, `${base}[data-hover-st="${st.id}"]`];
        const decl = [`--st-dur:${v.duration}ms`, `--st-ease:${v.easing}`];
        for (const [key, prop] of [["x", "left"], ["y", "top"], ["width", "width"], ["height", "height"]]) {
          if (v[key] != null) decl.push(`${prop}:${v[key]}px !important`);
        }
        if (v.rotation != null) decl.push(`rotate:${v.rotation}deg !important`);
        if (v.zIndex != null) decl.push(`z-index:${v.zIndex} !important`);
        if (turns) decl.push(`transform:${transform(v)}`);
        rules.push(`${where(on.join(", "))} { ${decl.join("; ")}; }`);
        if (v.opacity != null) rules.push(`${where(on.map((s) => `${s}:not(.fragment:not(.visible))`).join(", "))} { opacity:${v.opacity} !important; }`);
        const lineColor = v.stroke || (el.stroke && el.stroke !== "none" ? null : v.fill);
        const paint = (line ? [lineColor && `stroke:${lineColor}`] : [v.fill && `fill:${v.fill}`, v.stroke && `stroke:${v.stroke}`]).filter(Boolean);
        if (paint.length) rules.push(`${where(on.join(", "))} > svg > ${line ? ":is(line, polyline)" : "g"} { ${paint.join("; ")}; }`);
        if (v.textColor) rules.push(`${where(on.join(", "))} > svg > text { fill:${v.textColor}; }`);
        if (v.filterBrightness != null || v.filterContrast != null || v.filterGrayscale != null) {
          const b = v.filterBrightness ?? clamp(el.filterBrightness, 0, 400) ?? 100;
          const c = v.filterContrast ?? clamp(el.filterContrast, 0, 400) ?? 100;
          const g = v.filterGrayscale ?? clamp(el.filterGrayscale, 0, 100) ?? 0;
          rules.push(`${where(on.join(", "))} img { filter:brightness(${b}%) contrast(${c}%) grayscale(${g}%) !important; }`);
        }
      });
    }
  }
  return rules.map((r) => `
    ${r}`).join("");
}
function slideIdAttr(slide) {
  return slide?.id ? ` id="${escapeAttr2(slideAnchor(slide.id))}"` : "";
}
var CLICK_ACTION_CSS = `
    .reveal .slides [data-action] { cursor:pointer; }
    .reveal .slides [data-action]:not(.fragment), .reveal .slides [data-el]:not(.fragment) { transition:filter 0.15s, translate 0.15s, scale 0.15s, box-shadow 0.15s, opacity 0.25s, visibility 0.25s; }
    .reveal .slides [data-action]:hover { filter:brightness(1.15); }
    .reveal .slides [data-action][data-hover]:hover { filter:none; }
    .reveal .slides [data-action][data-hover="lift"]:hover { translate:0 -4px; box-shadow:0 10px 24px rgba(0,0,0,0.35); }
    .reveal .slides [data-action][data-hover="grow"]:hover { scale:1.04; }
    .reveal .slides [data-action]:focus-visible, .reveal .slides :is([data-hover-show], [data-hover-hide], [data-hover-set]):focus-visible { outline:2px solid #818cf8; outline-offset:2px; }
    .reveal .slides [data-action] iframe { pointer-events:none; }
    .reveal .slides [data-el][data-hidden]:not([data-hover-shown]), .reveal .slides [data-el][data-hover-hidden] { opacity:0 !important; visibility:hidden !important; pointer-events:none; }
    .reveal .slides [data-el][data-st-list]:not(.fragment) { transition-property:left, top, width, height, rotate, transform, opacity, visibility, filter, translate, scale, box-shadow; transition-duration:var(--st-dur, 0.4s); transition-timing-function:var(--st-ease, ease); }
    .reveal .slides [data-st-list] > svg > *, .reveal .slides [data-st-list] img { transition:fill var(--st-dur, 0.4s) var(--st-ease, ease), stroke var(--st-dur, 0.4s) var(--st-ease, ease), filter var(--st-dur, 0.4s) var(--st-ease, ease); }
    @media (prefers-reduced-motion: reduce) { .reveal .slides [data-st-list], .reveal .slides [data-st-list] * { transition-duration:0s !important; } }`;
var CLICK_ACTION_SCRIPT = `
    (function() {
      var HOVER = '.reveal .slides [data-hover-show], .reveal .slides [data-hover-hide], .reveal .slides [data-hover-set]';
      var hovered = [], focused = null, tapped = null, pointerType = 'mouse', keyboard = false, ending = null;
      function ids(el, key) { return (el.getAttribute(key) || '').split(' '); }
      function shownBy(source, node) {
        var shown = ids(source, 'data-hover-show');
        var slide = source.closest('section');
        for (var t = node; t && t !== slide && t.getAttribute; t = t.parentElement) {
          if (shown.indexOf(t.getAttribute('data-el')) !== -1) return true;
        }
        return false;
      }
      function sameHover(a, b) {
        return a === b || !!(a && b && a.closest('section') === b.closest('section')
          && a.getAttribute('data-hover-show') === b.getAttribute('data-hover-show')
          && a.getAttribute('data-hover-hide') === b.getAttribute('data-hover-hide')
          && a.getAttribute('data-hover-set') === b.getAttribute('data-hover-set'));
      }
      function stateOf(el) { return el.hasAttribute('data-hover-st') ? el.getAttribute('data-hover-st') : el.getAttribute('data-st') || ''; }
      // Morphing: a shape whose states change its outline moves its path's
      // points to the new state's, over the time the state moves in
      var CURVES = { ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1], linear: [0, 0, 1, 1] };
      function curve(css) {
        var m = /cubic-bezier[(]([^)]+)[)]/.exec(css || ''), c = m ? m[1].split(',').map(Number) : CURVES[(css || '').trim()] || CURVES.ease;
        var at = function(t, a, b) { return 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t; };
        return function(x) {
          var lo = 0, hi = 1, t = x;
          for (var i = 0; i < 24; i++) { t = (lo + hi) / 2; if (at(t, c[0], c[2]) < x) lo = t; else hi = t; }
          return at(t, c[1], c[3]);
        };
      }
      function outlines(path) {
        if (!path._outlines) {
          path._outlines = {};
          (path.getAttribute('data-morph') || '').split('|').forEach(function(entry) {
            var at = entry.indexOf(':');
            path._outlines[entry.slice(0, at)] = entry.slice(at + 1).split(' ').map(function(p) { return p.split(',').map(Number); });
          });
        }
        return path._outlines;
      }
      function draw(path, points) {
        path._points = points;
        path.setAttribute('d', 'M' + points.map(function(p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join('L') + 'Z');
      }
      function morph(el) {
        var path = el.querySelector('path[data-morph]');
        if (!path) return;
        var all = outlines(path), to = all[stateOf(el)] || all[''];
        var from = path._points || all[el.getAttribute('data-st-start') || ''] || to;
        if (!to || from.length !== to.length) return;
        window.cancelAnimationFrame(path._frame);
        var cs = window.getComputedStyle(el), time = (cs.getPropertyValue('--st-dur') || '').trim();
        var ms = !time ? 400 : /ms$/.test(time) ? parseFloat(time) : parseFloat(time) * 1000;
        var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!(ms > 0) || still) return draw(path, to);
        var ease = curve(cs.getPropertyValue('--st-ease')), began = null;
        var step = function(now) {
          if (began === null) began = now;
          var k = ease(Math.min(1, (now - began) / ms));
          draw(path, from.map(function(p, i) { return [p[0] + (to[i][0] - p[0]) * k, p[1] + (to[i][1] - p[1]) * k]; }));
          if (now - began < ms) path._frame = window.requestAnimationFrame(step);
        };
        path._frame = window.requestAnimationFrame(step);
      }
      function changeState(el, attr, value) {
        var before = stateOf(el), dur = '', ease = '';
        if (before) { var cs = window.getComputedStyle(el); dur = cs.getPropertyValue('--st-dur'); ease = cs.getPropertyValue('--st-ease'); }
        if (value === null) el.removeAttribute(attr); else el.setAttribute(attr, value);
        var after = stateOf(el);
        if (after === before) return;
        if (after || !dur) { el.style.removeProperty('--st-dur'); el.style.removeProperty('--st-ease'); }
        else { el.style.setProperty('--st-dur', dur); el.style.setProperty('--st-ease', ease); }
        morph(el);
      }
      function stateTarget(slide, id) {
        var els = slide.querySelectorAll('[data-st-list]');
        for (var i = 0; i < els.length; i++) if (els[i].getAttribute('data-el') === id) return els[i];
        return null;
      }
      function hasState(el, state) { return !state || ids(el, 'data-st-list').indexOf(state) !== -1; }
      function changeStates(el) {
        var slide = el.closest('section');
        var sets = ids(el, 'data-action-set');
        for (var i = 0; slide && i < sets.length; i++) {
          var parts = sets[i].split(':'), target = stateTarget(slide, parts[0]);
          if (!target) continue;
          var state = parts[1] || '', mode = parts[2], now = target.getAttribute('data-st') || '';
          var cycle = [''].concat(ids(target, 'data-st-list'));
          var next = mode === 'toggle' ? (now === state ? '' : state) : mode === 'cycle' ? cycle[(cycle.indexOf(now) + 1) % cycle.length] : state;
          if (hasState(target, next)) changeState(target, 'data-st', next);
        }
      }
      function stepped(slide) {
        var markers = Array.prototype.slice.call(slide ? slide.querySelectorAll('.fragment[data-st-steps]') : []);
        markers.sort(function(a, b) { return (+a.getAttribute('data-fragment-index') || 0) - (+b.getAttribute('data-fragment-index') || 0); });
        var states = {};
        for (var i = 0; i < markers.length; i++) {
          var shown = markers[i].classList.contains('visible'), changes = ids(markers[i], 'data-st-steps');
          for (var j = 0; j < changes.length; j++) {
            var parts = changes[j].split(':');
            if (shown) states[parts[0]] = parts[1] || '';
            else if (!(parts[0] in states)) states[parts[0]] = null; // not reached yet: its first state
          }
        }
        return states;
      }
      function stepStates(slide, now) {
        var states = stepped(slide);
        for (var id in states) {
          var el = stateTarget(slide, id);
          if (!el) continue;
          var next = states[id] === null ? el.getAttribute('data-st-start') || '' : states[id];
          if (!hasState(el, next) || (el.getAttribute('data-st') || '') === next) continue;
          if (now) el.setAttribute('data-st', next); else changeState(el, 'data-st', next);
        }
      }
      function resetStates(slide) {
        var els = slide ? slide.querySelectorAll('[data-st-list]') : [];
        for (var i = 0; i < els.length; i++) {
          els[i].style.setProperty('--st-dur', '0s');
          els[i].removeAttribute('data-hover-st');
          els[i].setAttribute('data-st', els[i].getAttribute('data-st-start') || '');
        }
        stepStates(slide, true);
        if (els.length) els[0].offsetWidth;
        for (var j = 0; j < els.length; j++) { morph(els[j]); els[j].style.removeProperty('--st-dur'); els[j].style.removeProperty('--st-ease'); }
      }
      function layer() {
        var old = document.querySelectorAll('.reveal .slides [data-hover-shown], .reveal .slides [data-hover-hidden]');
        for (var i = 0; i < old.length; i++) { old[i].removeAttribute('data-hover-shown'); old[i].removeAttribute('data-hover-hidden'); }
        var sources = [focused, tapped].concat(hovered), stated = [], states = [];
        for (var s = 0; s < sources.length; s++) {
          var source = sources[s], slide = source && source.closest('section');
          if (!slide) continue;
          var hide = ids(source, 'data-hover-hide'), show = ids(source, 'data-hover-show');
          var els = slide.querySelectorAll('[data-el]');
          for (var j = 0; j < els.length; j++) {
            var id = els[j].getAttribute('data-el');
            if (show.indexOf(id) !== -1) { els[j].setAttribute('data-hover-shown', ''); els[j].removeAttribute('data-hover-hidden'); }
            else if (hide.indexOf(id) !== -1) { els[j].setAttribute('data-hover-hidden', ''); els[j].removeAttribute('data-hover-shown'); }
          }
          var sets = ids(source, 'data-hover-set');
          for (var k = 0; k < sets.length; k++) {
            var parts = sets[k].split(':'), target = stateTarget(slide, parts[0]);
            if (!target || !hasState(target, parts[1] || '')) continue;
            var at = stated.indexOf(target);
            if (at === -1) { stated.push(target); states.push(parts[1] || ''); } else states[at] = parts[1] || '';
          }
        }
        // States change only where they differ, so they move rather than restart
        var was = document.querySelectorAll('.reveal .slides [data-hover-st]');
        for (var w = 0; w < was.length; w++) if (stated.indexOf(was[w]) === -1) changeState(was[w], 'data-hover-st', null);
        for (var t = 0; t < stated.length; t++) if (stated[t].getAttribute('data-hover-st') !== states[t]) changeState(stated[t], 'data-hover-st', states[t]);
      }
      function unhover() { clearTimeout(ending); ending = null; hovered = []; focused = null; tapped = null; layer(); }
      function hover(next) {
        clearTimeout(ending);
        ending = null;
        if (next.length === hovered.length && next.every(function(el, i) { return el === hovered[i]; })) return;
        if (next.every(function(el) { return hovered.indexOf(el) !== -1; })) {
          ending = setTimeout(function() { ending = null; hovered = next; layer(); }, 200);
          return;
        }
        hovered = next;
        layer();
      }
      document.addEventListener('pointerover', function(e) {
        pointerType = e.pointerType || 'mouse';
        if (pointerType === 'touch' || !e.target.closest) return;
        var next = hovered.filter(function(source) { return shownBy(source, e.target); });
        var source = e.target.closest(HOVER);
        if (source && next.indexOf(source) === -1) next.push(source);
        hover(next);
      });
      document.addEventListener('pointerout', function(e) {
        if (!e.relatedTarget && e.pointerType !== 'touch') hover([]);
      });
      document.addEventListener('pointerdown', function(e) { pointerType = e.pointerType || 'mouse'; keyboard = false; }, true);
      window.addEventListener('keydown', function() { keyboard = true; }, true);
      document.addEventListener('focusin', function(e) {
        var source = keyboard && e.target.closest ? e.target.closest(HOVER) : null;
        if (source === focused) return;
        focused = source;
        layer();
      });
      document.addEventListener('focusout', function() {
        if (!focused) return;
        focused = null;
        layer();
      });
      function tap(target) {
        var source = target.closest(HOVER);
        var next = source && !source.hasAttribute('data-action') ? (sameHover(source, tapped) ? null : source)
          : tapped && shownBy(tapped, target) ? tapped : null;
        if (next === tapped) return;
        tapped = next;
        layer();
      }
      function hide(el, hidden) {
        if (hidden) el.setAttribute('data-hidden', ''); else el.removeAttribute('data-hidden');
      }
      function reset(slide) {
        var els = slide ? slide.querySelectorAll('[data-el]') : [];
        for (var i = 0; i < els.length; i++) hide(els[i], els[i].hasAttribute('data-start-hidden'));
      }
      function showHide(el) {
        var slide = el.closest('section');
        var els = slide ? slide.querySelectorAll('[data-el]') : [];
        var change = function(key, fn) {
          var ids = (el.getAttribute('data-action-' + key) || '').split(' ');
          for (var i = 0; i < els.length; i++) if (ids.indexOf(els[i].getAttribute('data-el')) !== -1) fn(els[i]);
        };
        change('hide', function(t) { hide(t, true); });
        change('show', function(t) { hide(t, false); });
        change('toggle', function(t) { hide(t, !t.hasAttribute('data-hidden')); });
      }
      function run(el) {
        var type = el.getAttribute('data-action');
        if (type === 'visibility') { showHide(el); changeStates(el); return; }
        if (type === 'next') return Reveal.next();
        if (type === 'prev') return Reveal.prev();
        if (type === 'slide') {
          var target = document.getElementById(el.getAttribute('data-action-slide'));
          if (!target) return;
          var at = Reveal.getIndices(target);
          return Reveal.slide(at.h, at.v);
        }
        if (type === 'url') {
          var url = el.getAttribute('data-action-url');
          if (!/^(https?:|mailto:)/i.test(url)) return;
          if (el.hasAttribute('data-action-new-tab')) window.open(url, '_blank', 'noopener');
          else window.location.href = url;
        }
      }
      document.addEventListener('click', function(e) {
        if (!e.target.closest) return;
        if (pointerType === 'touch') tap(e.target);
        var link = e.target.closest('.reveal .slides a[href^="#/"]');
        if (link) { e.preventDefault(); window.location.hash = link.getAttribute('href'); return; }
        if (e.target.closest('a[href]')) return;
        var el = e.target.closest('.reveal .slides [data-action]');
        if (!el) return;
        e.preventDefault();
        run(el);
      });
      window.addEventListener('keydown', function(e) {
        if ((e.key !== 'Enter' && e.key !== ' ') || !e.target.closest) return;
        var el = e.target.closest('.reveal .slides [data-action]');
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        run(el);
      }, true);
      Reveal.on('slidechanged', function(e) { unhover(); reset(e.currentSlide); resetStates(e.currentSlide); });
      Reveal.on('fragmentshown', function() { stepStates(Reveal.getCurrentSlide()); });
      Reveal.on('fragmenthidden', function() { stepStates(Reveal.getCurrentSlide()); });
    })();`;

// client/src/utils/generateHTML.js
var EMBED_RESIZE_LISTENER = "window.addEventListener('message',function(e){if(e.source===window.parent&&e.data==='parallax-resize')window.dispatchEvent(new Event('resize'))});";
function buildHtmlEmbed(userHtml, embedW, embedH) {
  const initScript = `<script>const EMBED_WIDTH=${embedW},EMBED_HEIGHT=${embedH};(function(){function fit(){document.querySelectorAll('svg').forEach(function(s){if(s._vb)return;var w=parseFloat(s.getAttribute('width')),h=parseFloat(s.getAttribute('height'));if(!s.getAttribute('viewBox')){if(!(w>0&&h>0))return;s.setAttribute('viewBox','0 0 '+w+' '+h);}s.setAttribute('width','100%');s.setAttribute('height','100%');s._vb=1;});}window.addEventListener('load',fit);setTimeout(fit,100);setTimeout(fit,400);new MutationObserver(fit).observe(document.documentElement,{childList:true,subtree:true});})();${EMBED_RESIZE_LISTENER}</script>`;
  const resetStyle = `<style>html,body{margin:0;padding:0;overflow:hidden;width:100%;height:100%;box-sizing:border-box;}canvas{display:block;}svg{display:block;}</style>`;
  const injection = initScript + resetStyle;
  if (/<head[^>]*>/i.test(userHtml))
    return userHtml.replace(/<head[^>]*>/i, (m) => m + injection);
  if (/<html[^>]*>/i.test(userHtml))
    return userHtml.replace(/<html[^>]*>/i, (m) => m + injection);
  if (/<!doctype[^>]*>/i.test(userHtml))
    return userHtml.replace(/(<!doctype[^>]*>)/i, "$1" + injection);
  return injection + userHtml;
}
function absoluteSrc(src) {
  if (!src) return src;
  const origin = typeof window === "undefined" ? "" : window.location?.origin;
  if (!origin || /^(https?:|data:|blob:)/.test(src)) return src;
  return `${origin}${src.startsWith("/") ? "" : "/"}${src}`;
}
function sanitizeAttr(val) {
  if (val == null) return "";
  return String(val).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function sanitizeUrl(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (/^(javascript|vbscript):/i.test(trimmed)) return "";
  if (/^data:/i.test(trimmed) && !/^data:(image|video|audio)\//i.test(trimmed)) return "";
  return sanitizeAttr(trimmed);
}
function cssValue(val) {
  if (val == null) return "";
  return String(val).replace(/[<>"`;{}\\\r\n]/g, "");
}
function sanitizeCustomCSS(css) {
  if (!css || typeof css !== "string") return "";
  return css.replace(/<\/style/gi, "&lt;/style").replace(/<script/gi, "&lt;script").replace(/expression\s*\(/gi, "/* expression blocked */ (").replace(/url\s*\(\s*['"]?\s*javascript:/gi, "url(/* blocked */");
}
function customFontLinks(fonts) {
  return fonts.filter((f) => f.source === "google" && f.url).map((f) => `
  <link rel="stylesheet" href="${sanitizeUrl(f.url)}">`).join("");
}
function customFontFaces(fonts) {
  const quoted = (s) => String(s || "").replace(/['"\\<>{};\r\n]/g, "");
  return fonts.filter((f) => f.source === "upload" && f.url && !/^\s*(javascript|vbscript|data):/i.test(f.url)).map((f) => `
    @font-face { font-family: '${quoted(f.familyName)}'; src: url('${quoted(absoluteSrc(f.url)).replace(/[()]/g, "")}'); }`).join("");
}
function getSlideColumns(slides, presentation = {}) {
  const is2D = slides.some((s) => s.column !== void 0);
  if (is2D) {
    const colMap = {};
    slides.forEach((s) => {
      const c = s.column ?? 0;
      if (!colMap[c]) colMap[c] = [];
      colMap[c].push(s);
    });
    const sortedKeys = Object.keys(colMap).map(Number).sort((a, b) => a - b);
    return sortedKeys.map((k) => colMap[k]);
  }
  if (presentation.sectionNav) {
    const groups = [];
    const keyOrder = [];
    const keyToGroup = {};
    slides.forEach((s) => {
      const key = s.activeSection !== void 0 ? String(s.activeSection) : s.section || "";
      if (!key) {
        groups.push([s]);
        keyOrder.push(null);
      } else if (keyToGroup[key]) {
        keyToGroup[key].push(s);
      } else {
        const group = [s];
        keyToGroup[key] = group;
        groups.push(group);
        keyOrder.push(key);
      }
    });
    return groups;
  }
  return slides.map((s) => [s]);
}
var CUSTOM_TRANSITIONS = ["differential-rotation"];
function generateRevealHTML(presentation, opts = {}) {
  const slideW = Number(presentation.slideWidth) || 960;
  const slideH = Number(presentation.slideHeight) || 540;
  const globalFont = cssValue(presentation.globalFont);
  const showFooter = presentation.showFooter || false;
  const showPageNumbers = presentation.showPageNumbers || false;
  const footerTimeMode = presentation.footerTimeMode || "none";
  const timerDuration = Number(presentation.timerDuration ?? 20) || 0;
  const showTimeWidget = footerTimeMode !== "none";
  const laserPointer = presentation.laserPointer || "off";
  const bibliography = presentation.bibliography || [];
  const pageNumberFormat = presentation.pageNumberFormat || "c/t";
  const theme = /^[\w-]+$/.test(presentation.theme || "") ? presentation.theme : "black";
  const codeTheme = /^[\w-]+$/.test(presentation.codeTheme || "") ? presentation.codeTheme : "monokai";
  const footerFontSize = Number(presentation.footerFontSize) || 14;
  const footerFontFamily = cssValue(presentation.footerFontFamily) || "-apple-system,sans-serif";
  const footerColor = cssValue(presentation.footerColor) || "rgba(255,255,255,0.65)";
  const showPresentGrid = presentation.showPresentGrid || false;
  const presentGridSize = Number(presentation.gridSize) || 40;
  const footerMode = presentation.footerMode || "basic";
  const sequenceSections = presentation.sequenceSections || [];
  const footerInactiveColor = cssValue(presentation.footerInactiveColor) || "rgba(255,255,255,0.25)";
  const customFonts = (opts.customFonts || []).filter(Boolean);
  const pluginSandbox = opts.pluginSandbox || ((el) => plugin_registry_default.getSandboxHtml(el.type));
  const seenGroups = /* @__PURE__ */ new Set();
  const totalNumberedSlides = (presentation.slides || []).filter((s) => {
    if (s.showPageNumber === false) return false;
    if (s.slideGroup) {
      if (seenGroups.has(s.slideGroup)) return false;
      seenGroups.add(s.slideGroup);
    }
    return true;
  }).length;
  let pageCounter = 0;
  const pageGroupSeen = /* @__PURE__ */ new Set();
  const slideSectionHtmlByIndex = /* @__PURE__ */ new Map();
  presentation.slides.forEach((slide, slideIndex) => {
    const bgAttrs = getBackgroundAttrs(slide.background);
    const notes = slide.notes && opts.notes !== false ? `<aside class="notes">${slide.notes}</aside>` : "";
    const sideCitations = (slide.elements || []).filter((el) => el.type === "image" && (el.citationText || el.citationLink) && el.citationMode === "side").map((el) => ({ id: el.id, text: el.citationText, link: el.citationLink }));
    const clickTargets = visibilityTargets(slide);
    const canvasH = getCanvasHeight(slide, slideH);
    const scrolling = canvasH > slideH;
    const sortedElements = (slide.elements || []).slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    const renderedElements = sortedElements.map((el) => {
      const shadowStyle = el.shadowBlur || el.shadowX || el.shadowY ? `box-shadow:${el.shadowX || 0}px ${el.shadowY || 0}px ${el.shadowBlur || 0}px ${cssValue(el.shadowColor) || "rgba(0,0,0,0.5)"};` : "";
      const borderRadiusStyle = (el.type === "image" || el.type === "code") && el.borderRadius ? `border-radius:${el.borderRadius}px;` : "";
      const rotationStyle = el.rotation ? `rotate:${el.rotation}deg;` : "";
      const style = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.zIndex || 1};overflow:hidden;box-sizing:border-box;${shadowStyle}${borderRadiusStyle}${rotationStyle}`;
      const dataId2 = slide.autoAnimate ? ` data-id="${el.id}"` : "";
      const fragClass2 = el.fragment ? ` class="fragment ${sanitizeAttr(el.fragmentAnimation || "fade-in")}"` : "";
      const fragIdx2 = el.fragment && el.fragmentIndex != null ? ` data-fragment-index="${sanitizeAttr(el.fragmentIndex)}"` : "";
      const gsapAttrs2 = el.animationEnter && el.animationEnter !== "none" ? ` data-gsap-enter="${sanitizeAttr(el.animationEnter)}" data-gsap-delay="${Number(el.animationDelay) || 0}" data-gsap-duration="${Number(el.animationDuration) || 600}"` : "";
      const actionAttrs2 = clickActionAttrs(el, clickTargets);
      if (el.type === "text") {
        const spacingStyle = `${globalFont ? `font-family:${globalFont};` : ""}line-height:${cssValue(el.lineHeight ?? 1.5)};${el.letterSpacing ? `letter-spacing:${cssValue(el.letterSpacing)}px;` : ""}${el.wordSpacing ? `word-spacing:${cssValue(el.wordSpacing)}px;` : ""}`;
        const textStyle = el.sizeMode === "auto" ? `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:auto;z-index:${el.zIndex || 1};overflow:visible;box-sizing:border-box;${shadowStyle}${rotationStyle}` : style;
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${textStyle} padding:8px 12px; color:white;${spacingStyle}">${el.content || ""}</div>`;
      }
      if (el.type === "image") {
        const src = absoluteSrc(sanitizeUrl(el.src));
        const imgFilterParts = [
          el.filterBrightness != null && el.filterBrightness !== 100 ? `brightness(${el.filterBrightness}%)` : "",
          el.filterContrast != null && el.filterContrast !== 100 ? `contrast(${el.filterContrast}%)` : "",
          el.filterGrayscale ? `grayscale(${el.filterGrayscale}%)` : ""
        ].filter(Boolean).join(" ");
        const filterStyle = imgFilterParts ? `filter:${imgFilterParts};` : "";
        const expandAttr = el.clickToExpand ? ' data-expand="true"' : "";
        const popupAttr = el.popupText ? ` data-popup="${el.popupText.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}" data-popup-pos="${el.popupPosition || "below"}" data-popup-fs="${el.popupFontSize || 15}"` : "";
        const interactiveCursor = el.clickToExpand || el.popupText ? "cursor:pointer;" : "";
        const hasCite = el.citationText || el.citationLink;
        const citeCaption = hasCite && (el.citationMode || "caption") === "caption";
        const citeSide = hasCite && el.citationMode === "side";
        const cStyle = citeCaption ? style.replace("overflow:hidden;", "overflow:visible;") : style;
        let capHtml = "";
        if (citeCaption) {
          const align = cssValue(el.citationAlign) || "left";
          const ct = (el.citationText || el.citationLink || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const cc = el.citationColor ? `color:${cssValue(el.citationColor)};` : "";
          capHtml = el.citationLink ? `<div class="image-caption" style="text-align:${align};${cc}"><a href="${sanitizeUrl(el.citationLink)}" target="_blank" rel="noopener" style="${cc}">${ct}</a></div>` : `<div class="image-caption" style="text-align:${align};${cc}">${ct}</div>`;
        }
        const sIdx = citeSide ? sideCitations.findIndex((c) => c.id === el.id) : -1;
        const sup = sIdx >= 0 ? `<span class="cite-sup">${sIdx + 1}</span>` : "";
        const clipOpen = citeCaption ? `<div style="width:100%;height:100%;overflow:hidden;position:relative;${borderRadiusStyle}">` : "";
        const clipClose = citeCaption ? "</div>" : "";
        if (el.imageW != null) {
          const offX = el.imageOffsetX ?? 0;
          const offY = el.imageOffsetY ?? 0;
          const imgStyle = `position:absolute;left:${offX}px;top:${offY}px;width:${el.imageW}px;height:${el.imageH}px;object-fit:${cssValue(el.objectFit) || "contain"};${filterStyle}`;
          return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2}${expandAttr}${popupAttr} style="${cStyle}${interactiveCursor}">${clipOpen}<img src="${src}" alt="${sanitizeAttr(el.alt || "")}" style="${imgStyle}" />${clipClose}${capHtml}${sup}</div>`;
        }
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2}${expandAttr}${popupAttr} style="${cStyle}${interactiveCursor}">${clipOpen}<img src="${src}" alt="${sanitizeAttr(el.alt || "")}" style="display:block;width:100%;height:100%;object-fit:${cssValue(el.objectFit) || "contain"};${filterStyle}" />${clipClose}${capHtml}${sup}</div>`;
      }
      if (el.type === "shape") {
        const opacityStyle = el.opacity !== void 0 && el.opacity !== 1 ? `opacity:${el.opacity};` : "";
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}${opacityStyle}">${shapeSvg(el)}</div>`;
      }
      if (el.type === "tikz") {
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}">${tikzDiagramSvg(el)}</div>`;
      }
      if (el.type === "html") {
        const embedHtml = buildHtmlEmbed(el.content || "", el.width, el.height);
        const srcdoc = embedHtml.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${srcdoc}" style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no"></iframe></div>`;
      }
      if (el.type === "model") {
        const srcdoc = modelViewerHtml(el, { src: absoluteSrc(el.src) }).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${srcdoc}" style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no" title="3D model"></iframe></div>`;
      }
      if (el.type === "p5") {
        const p5Doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:transparent;overflow:hidden;}canvas{display:block;}</style><script src="${(0, import_libraries2.libUrl)("p5", "lib/p5.min.js")}"></script><script>${EMBED_RESIZE_LISTENER}</script></head><body><script>${el.content || ""}</script></body></html>`;
        const srcdoc = p5Doc.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${srcdoc}" style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no"></iframe></div>`;
      }
      if (el.type === "code") {
        const lang = el.language || "plaintext";
        const codeContent = escapeHtml(el.content || "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><pre style="margin:0;padding:10px 14px;width:100%;height:100%;overflow:hidden;box-sizing:border-box;font-family:'Fira Code','JetBrains Mono','Courier New',monospace;font-size:${el.fontSize || 14}px;line-height:1.5;"><code class="language-${lang}" data-trim>${codeContent}</code></pre></div>`;
      }
      if (el.type === "markdown") {
        const md = (el.content || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><script src="${(0, import_libraries2.libUrl)("marked", "lib/marked.umd.js")}"><\\/script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent;color:white;font-family:-apple-system,sans-serif;font-size:18px;line-height:1.6;padding:8px 12px;overflow:auto}h1,h2,h3,h4{margin:0 0 .4em}p{margin:0 0 .4em}ul,ol{padding-left:1.5em;margin:0 0 .4em}a{color:#60a5fa}pre{background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:6px;overflow:auto;font-size:13px}code{font-family:'Fira Code',monospace}</style></head><body><div id="out"></div><script>document.getElementById('out').innerHTML=marked.parse(${JSON.stringify(el.content || "")});<\\/script></body></html>`;
        const escaped = srcdoc.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${escaped}" style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no"></iframe></div>`;
      }
      if (el.type === "timeline") {
        const w = el.width, h = el.height, pad = 30, lineY = h * 0.5;
        const lc = el.lineColor || "#6366f1", dc = el.dotColor || lc, tc = el.textColor || "#fff", fs = el.fontSize || 11;
        const spacing = el.tickSpacing || "auto";
        const yearMode = ["year", "10year", "100year", "1000year"].includes(spacing) || spacing === "auto" && String(el.startDate).match(/^-?\d+$/);
        const ticks = [];
        let datePos, itemDateLabel;
        if (yearMode) {
          const y0 = parseInt(el.startDate) || 0, y1 = parseInt(el.endDate) || 0, yr = y1 - y0 || 1;
          datePos = (d) => pad + (parseInt(d) - y0) / yr * (w - pad * 2);
          itemDateLabel = (d) => String(parseInt(d) || d);
          const step = spacing === "1000year" ? 1e3 : spacing === "100year" ? 100 : spacing === "10year" ? 10 : Math.abs(yr) > 8 ? 2 : 1;
          const sY = Math.ceil(y0 / step) * step;
          for (let y = sY; y <= y1; y += step) ticks.push({ date: String(y), label: String(y) });
        } else {
          const t0 = new Date(el.startDate).getTime(), t1 = new Date(el.endDate).getTime(), range = t1 - t0 || 1;
          datePos = (d) => pad + (new Date(d).getTime() - t0) / range * (w - pad * 2);
          itemDateLabel = (d) => d;
          const d0 = new Date(el.startDate), d1 = new Date(el.endDate);
          if (spacing === "day") {
            const step = 864e5;
            for (let t = d0.getTime(); t <= d1.getTime(); t += step) {
              const d = new Date(t);
              ticks.push({ date: d.toISOString().split("T")[0], label: `${d.getMonth() + 1}/${d.getDate()}` });
            }
          } else if (spacing === "month") {
            for (let d = new Date(d0.getFullYear(), d0.getMonth(), 1); d <= d1; d.setMonth(d.getMonth() + 1)) ticks.push({ date: d.toISOString().split("T")[0], label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` });
          } else {
            const yearSpan = (t1 - t0) / (365.25 * 24 * 36e5);
            const step = yearSpan > 8 ? 2 : 1;
            for (let y = d0.getFullYear(); y <= d1.getFullYear(); y += step) ticks.push({ date: `${y}-01-01`, label: String(y) });
          }
        }
        const esc = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
        svg += `<line x1="${pad}" y1="${lineY}" x2="${w - pad}" y2="${lineY}" stroke="${lc}" stroke-width="2"/>`;
        for (const t of ticks) {
          const x = datePos(t.date);
          svg += `<line x1="${x}" y1="${lineY - 4}" x2="${x}" y2="${lineY + 4}" stroke="${lc}" stroke-width="1.5"/><text x="${x}" y="${lineY + 14}" text-anchor="end" fill="${tc}" font-size="${fs - 1}" opacity="0.5" transform="rotate(-45,${x},${lineY + 14})">${t.label}</text>`;
        }
        for (const item of el.items || []) {
          const x = datePos(item.date), isTop = item.side !== "bottom", cl = item.connectorLength ?? 0;
          const cardY = isTop ? 8 - cl : lineY + 28 + cl, cardH = isTop ? lineY - 36 : h - lineY - 36;
          const connY1 = isTop ? cardY + cardH : lineY, connY2 = isTop ? lineY : cardY;
          const imgH = item.image ? Math.min(cardH * 0.55, 60) : 0;
          const hasExpand = item.image || item.detailedDescription;
          svg += `<g${hasExpand ? ` class="tl-event" data-tl-id="${item.id}" style="cursor:pointer"` : ""}>`;
          svg += `<line x1="${x}" y1="${connY1}" x2="${x}" y2="${connY2}" stroke="${lc}" stroke-width="1" stroke-dasharray="3,2" opacity="0.5"/>`;
          svg += `<circle cx="${x}" cy="${lineY}" r="4" fill="${dc}"/>`;
          if (isTop) {
            let ty = cardY + fs;
            svg += `<text x="${x}" y="${ty}" text-anchor="middle" fill="${tc}" font-size="${fs}" font-weight="600">${esc(item.label)}</text>`;
            ty += fs + 2;
            if (item.description) {
              svg += `<text x="${x}" y="${ty}" text-anchor="middle" fill="${tc}" font-size="${fs - 1}" opacity="0.6">${esc(item.description)}</text>`;
              ty += fs;
            }
            svg += `<text x="${x}" y="${ty}" text-anchor="middle" fill="${tc}" font-size="${fs - 2}" opacity="0.35">${itemDateLabel(item.date)}</text>`;
            ty += 4;
            if (item.image) svg += `<image href="${absoluteSrc(sanitizeUrl(item.image))}" x="${x - 40}" y="${ty}" width="80" height="${imgH}" preserveAspectRatio="xMidYMid meet"/>`;
          } else {
            if (item.image) svg += `<image href="${absoluteSrc(sanitizeUrl(item.image))}" x="${x - 40}" y="${cardY}" width="80" height="${imgH}" preserveAspectRatio="xMidYMid meet"/>`;
            svg += `<text x="${x}" y="${cardY + imgH + fs + 2}" text-anchor="middle" fill="${tc}" font-size="${fs}" font-weight="600">${esc(item.label)}</text>`;
            if (item.description) svg += `<text x="${x}" y="${cardY + imgH + fs * 2 + 4}" text-anchor="middle" fill="${tc}" font-size="${fs - 1}" opacity="0.6">${esc(item.description)}</text>`;
            svg += `<text x="${x}" y="${cardY + imgH + fs * (item.description ? 3 : 2) + 6}" text-anchor="middle" fill="${tc}" font-size="${fs - 2}" opacity="0.35">${itemDateLabel(item.date)}</text>`;
          }
          svg += "</g>";
        }
        svg += "</svg>";
        const expandItems = (el.items || []).filter((i) => i.image || i.detailedDescription);
        let expandData = "";
        if (expandItems.length) {
          const itemsJson = JSON.stringify(expandItems.map((i) => ({ id: i.id, label: i.label, date: itemDateLabel(i.date), description: i.description, detailedDescription: i.detailedDescription, image: i.image ? absoluteSrc(sanitizeUrl(i.image)) : "" }))).replace(/</g, "\\u003c");
          expandData = `<div class="tl-overlay" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,0.75);border-radius:6px;z-index:10;cursor:pointer;padding:16px;align-items:center;justify-content:center;gap:16px"></div><script>(function(){var el=document.currentScript.parentElement;var overlay=el.querySelector('.tl-overlay');var items=${itemsJson};el.querySelectorAll('.tl-event').forEach(function(g){g.addEventListener('click',function(e){e.stopPropagation();var id=g.getAttribute('data-tl-id');var item=items.find(function(i){return i.id===id});if(!item)return;var h='';if(item.image)h+='<img src="'+item.image+'" style="max-width:'+(item.detailedDescription?'45%':'80%')+';max-height:85%;object-fit:contain;border-radius:6px;flex-shrink:0">';h+='<div style="flex:'+(item.image?1:'none')+';max-width:'+(item.image?'45%':'80%')+';overflow:auto;max-height:85%">';h+='<div style="color:${tc};font-weight:700;font-size:${fs + 4}px;margin-bottom:4px">'+item.label+'<\\/div>';h+='<div style="color:${tc};opacity:0.5;font-size:${fs - 1}px;margin-bottom:8px">'+item.date+'<\\/div>';if(item.description)h+='<div style="color:${tc};opacity:0.7;font-size:${fs}px;margin-bottom:8px">'+item.description+'<\\/div>';if(item.detailedDescription)h+='<div style="color:${tc};opacity:0.85;font-size:${fs + 1}px;line-height:1.5;white-space:pre-wrap">'+item.detailedDescription+'<\\/div>';h+='<\\/div>';overlay.innerHTML=h;overlay.style.display='flex';})});overlay.addEventListener('click',function(){overlay.style.display='none'});}());<\\/script>`;
        }
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><div style="position:relative;width:100%;height:100%;">${svg}${expandData}</div></div>`;
      }
      if (el.type === "callout") {
        const bg = cssValue(el.calloutColor) || "#ef4444";
        const tc = cssValue(el.calloutTextColor) || "#ffffff";
        const fs = el.fontSize || 16;
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:${tc};font-size:${fs}px;font-weight:700;font-family:-apple-system,sans-serif;line-height:1;">${el.calloutNumber || 1}</div>`;
      }
      if (el.type === "icon") {
        const color2 = sanitizeAttr(el.iconColor) || "#ffffff";
        const sw = Number(el.iconStrokeWidth) || 2;
        const iconPaths = { Star: '<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>', Heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>', Check: '<polyline points="20,6 9,17 4,12"/>', X: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', Zap: '<polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>', Target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' };
        const path = iconPaths[el.iconName] || iconPaths["Star"];
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="${color2}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${path}</svg></div>`;
      }
      if (el.type === "latex") {
        const content = el.content || "";
        const lc = el.textColor || "white";
        const sc = el.fontSize ? el.fontSize / 20 : 1;
        const hasTikz = /\\begin\{tikzpicture\}|\\tikz\s*[{[]/.test(content);
        const hasTable = /\\begin\{(tabular\*?|table\*?|longtable|tabularx|tabulary)\}/.test(content);
        if (hasTikz) {
          const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" type="text/css" href="https://tikzjax.com/v1/fonts.css"><script src="https://tikzjax.com/v1/tikzjax.js"><\\/script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;overflow:auto;color:${lc}}body{transform:scale(${sc});transform-origin:center center}svg{max-width:100%;max-height:100%}</style></head><body><script type="text/tikz">${content}<\\/script></body></html>`;
          const escaped2 = srcdoc.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
          return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${escaped2}" style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no"></iframe></div>`;
        }
        if (hasTable) {
          const wrapped = content.includes("\\begin{document}") ? content : `\\documentclass{article}
\\usepackage{booktabs}
\\usepackage{array}
\\begin{document}
${content}
\\end{document}`;
          const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><script src="${(0, import_libraries2.libUrl)("latex.js", "dist/latex.js")}"><\\/script><link rel="stylesheet" href="${(0, import_libraries2.libUrl)("latex.js", "dist/css/base.css")}"><style>*{box-sizing:border-box}html,body{margin:0;padding:8px;background:transparent;color:${lc}!important;width:100%;height:100%;overflow:auto;font-family:'Computer Modern',Georgia,serif;transform:scale(${sc});transform-origin:top left}table{border-collapse:collapse;color:${lc}}td,th{padding:3px 10px;color:${lc}!important}p,span,div{color:${lc}!important}</style></head><body><div id="out"></div><script>try{var generator=new HtmlGenerator({hyphenate:false});var doc=parse(${JSON.stringify(wrapped)},{generator:generator});document.getElementById('out').appendChild(doc.domFragment())}catch(e){document.getElementById('out').innerHTML='<span style="color:#f87171">Error: '+e.message+'<\\/span>'}<\\/script></body></html>`;
          const escaped2 = srcdoc.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
          return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${escaped2}" style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no"></iframe></div>`;
        }
        const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} data-latex-block="${escaped}" style="${style}display:flex;align-items:center;justify-content:center;overflow:hidden;"><span class="katex-block" style="font-size:${Math.round(sc * 22)}px;color:${lc};"></span></div>`;
      }
      if (el.type === "video") {
        const src = absoluteSrc(sanitizeUrl(el.src));
        const attrs = [];
        if (el.controls !== false) attrs.push("controls");
        if (el.autoplay) attrs.push("autoplay");
        if (el.loop) attrs.push("loop");
        if (el.muted) attrs.push("muted");
        const posterAttr = el.poster ? ` poster="${absoluteSrc(sanitizeUrl(el.poster))}"` : "";
        const hasClip = el.startTime != null && el.startTime > 0 || el.endTime != null;
        const rate = el.playbackRate && el.playbackRate !== 1 ? el.playbackRate : null;
        let vidScript = "";
        if (rate || hasClip) {
          const parts = [];
          parts.push("var v=document.currentScript.previousElementSibling");
          if (rate) parts.push(`v.playbackRate=${rate}`);
          if (hasClip) {
            const s = el.startTime || 0;
            const looping = el.loop;
            if (s > 0) parts.push(`v.addEventListener('loadedmetadata',function(){v.currentTime=${s}})`);
            if (el.endTime != null) parts.push(`v.addEventListener('timeupdate',function(){if(v.currentTime>=${el.endTime}){${looping ? `v.currentTime=${s};v.play()` : "v.pause()"}}})`);
            if (s > 0) parts.push(`v.addEventListener('play',function(){if(v.currentTime<${s})v.currentTime=${s}})`);
          }
          vidScript = `<script>${parts.join(";")}</script>`;
        }
        if (hasClip && el.loop) attrs.splice(attrs.indexOf("loop"), attrs.indexOf("loop") >= 0 ? 1 : 0);
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><video src="${src}" ${attrs.join(" ")}${posterAttr} style="width:100%;height:100%;object-fit:${cssValue(el.objectFit) || "contain"};display:block;background:#000;"></video>${vidScript}</div>`;
      }
      if (el.type === "audio") {
        const src = absoluteSrc(sanitizeUrl(el.src));
        const attrs = ["controls"];
        if (el.autoplay) attrs.push("autoplay");
        if (el.loop) attrs.push("loop");
        if (el.muted) attrs.push("muted");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}display:flex;align-items:center;justify-content:center;"><audio src="${src}" ${attrs.join(" ")} style="width:90%;"></audio></div>`;
      }
      if (el.type === "table") {
        const data = el.data || [[""]];
        const headerBg = cssValue(el.headerBgColor) || "rgba(99,102,241,0.3)";
        const cellBg = cssValue(el.cellBgColor) || "transparent";
        const borderColor = cssValue(el.borderColor) || "rgba(255,255,255,0.2)";
        const borderWidth = Number(el.borderWidth ?? 1) || 0;
        const textColor = cssValue(el.textColor) || "#ffffff";
        const fontSize = Number(el.fontSize) || 14;
        const cellPadding = Number(el.cellPadding) || 8;
        const rows = data.map((row, ri) => {
          const cells = (row || []).map((cell, ci) => {
            const bg = el.headerRow && ri === 0 ? headerBg : cellBg;
            return `<td style="padding:${cellPadding}px;border:${borderWidth}px solid ${borderColor};background:${bg};color:${textColor};font-size:${fontSize}px;">${escapeHtml(cell || "")}</td>`;
          }).join("");
          return `<tr>${cells}</tr>`;
        }).join("");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}overflow:auto;"><table style="width:100%;height:100%;border-collapse:collapse;">${rows}</table></div>`;
      }
      if (el.type === "textpath") {
        const fontSize = el.fontSize || 64;
        const w = el.width;
        const pathSide = el.pathSide || "bottom";
        const ff = (el.fontFamily || globalFont || "sans-serif").replace(/"/g, "'");
        const baseTextAttrs = `font-size="${fontSize}" font-family="${ff}" fill="${el.color || "#ffffff"}" font-weight="${el.fontWeight || "normal"}" font-style="${el.fontStyle || "normal"}" letter-spacing="${el.letterSpacing || 0}"${el.wordSpacing ? ` word-spacing="${el.wordSpacing}"` : ""}`;
        let svg, svgH;
        if (pathSide === "leftedge" || pathSide === "rightedge") {
          const pad = Math.ceil(fontSize * 0.6);
          const pathX0 = pathSide === "leftedge" ? pad : w - pad;
          svgH = el.height || 300;
          const lineH = fontSize * (el.lineHeight ?? 1.35);
          const tanA = Math.tan((el.angle || 0) * Math.PI / 180);
          const lines = (el.content || "").split("\n");
          const lineXAt = (i) => pathX0 + (fontSize + i * lineH) * tanA;
          const guideX2 = pathX0 + svgH * tanA;
          const tspans = lines.map(
            (line, i) => `<tspan x="${lineXAt(i)}" dy="${i === 0 ? fontSize : lineH}">${escapeHtml(line || " ")}</tspan>`
          ).join("");
          const guideLine = el.showPath !== false ? `<line x1="${pathX0}" y1="0" x2="${guideX2}" y2="${svgH}" stroke="rgba(34,211,238,0.4)" stroke-width="1"/>` : "";
          const anchor = pathSide === "leftedge" ? "start" : "end";
          svg = `<svg width="${w}" height="${svgH}" viewBox="0 0 ${w} ${svgH}" xmlns="http://www.w3.org/2000/svg" overflow="visible">${guideLine}<text ${baseTextAttrs} text-anchor="${anchor}">${tspans}</text></svg>`;
        } else {
          const angle = el.angle || 0;
          const angleRad = angle * Math.PI / 180;
          const dy = w * Math.tan(angleRad);
          const pad = Math.ceil(fontSize * 1.2);
          const minY = Math.min(0, dy);
          svgH = Math.ceil(Math.abs(dy) + pad * 2);
          const baselineY = pad - minY;
          const pathD = `M 0,${baselineY} L ${w},${baselineY + dy}`;
          const pathId = `tp-${el.id}`;
          const capHeight = Math.round(fontSize * 0.72);
          const textDy = pathSide === "left" || pathSide === "right" ? capHeight : 0;
          const tpSide = pathSide === "top" || pathSide === "right" ? "right" : "left";
          const dyAttr = textDy ? ` dy="${textDy}"` : "";
          svg = `<svg width="${w}" height="${svgH}" viewBox="0 0 ${w} ${svgH}" xmlns="http://www.w3.org/2000/svg" overflow="visible"><defs><path id="${pathId}" d="${pathD}"/></defs><text ${baseTextAttrs}${dyAttr}><textPath href="#${pathId}" startOffset="${el.startOffset || 0}%" textAnchor="${el.textAnchor || "start"}" side="${tpSide}">${escapeHtml(el.content || "")}</textPath></text></svg>`;
        }
        const elStyle = `position:absolute;left:${el.x}px;top:${el.y}px;width:${w}px;height:${svgH}px;z-index:${el.zIndex || 1};overflow:visible;${el.rotation ? `rotate:${el.rotation}deg;` : ""}`;
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${elStyle}">${svg}</div>`;
      }
      if (el.type === "drawing") {
        const svgPaths = (el.paths || []).map((path) => {
          const d = pointsToPath(path.points, el.smooth !== false);
          return `<path d="${d}" stroke="${path.color || "#ffffff"}" stroke-width="${path.strokeWidth || 3}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${path.opacity ?? 1}"/>`;
        }).join("");
        return `<svg${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="position:absolute;left:0;top:0;width:${slideW}px;height:${canvasH}px;overflow:visible;pointer-events:none;z-index:${el.zIndex || 1};">${svgPaths}</svg>`;
      }
      if (el.type && el.type.startsWith("plugin:")) {
        const sandboxHtml = pluginSandbox(el);
        if (!sandboxHtml) {
          return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:14px;">Plugin: ${escapeHtml(el.type.replace("plugin:", ""))}</div>`;
        }
        const srcdoc = buildStaticPluginSrcdoc(sandboxHtml, { data: el.pluginData, width: el.width, height: el.height }).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${srcdoc}" sandbox="allow-scripts" style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no"></iframe></div>`;
      }
      return "";
    });
    const pinned = (i) => scrolling && isPinned(sortedElements[i]);
    const elementsHtml = renderedElements.filter((_, i) => !pinned(i)).join("\n");
    const pinnedHtml = renderedElements.filter((_, i) => pinned(i)).join("\n");
    let sideCitationsHtml = "";
    if (sideCitations.length > 0) {
      const items = sideCitations.map((c, i) => {
        const t = (c.text || c.link || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const content = c.link ? `<a href="${c.link.replace(/"/g, "&quot;")}" target="_blank" rel="noopener">${t}</a>` : t;
        return `${i + 1}. ${content}`;
      }).join("&ensp;&middot;&ensp;");
      sideCitationsHtml = `      <div class="slide-citations"><div class="slide-citations-text">${items}</div></div>`;
    }
    const slideHasPageNum = slide.showPageNumber !== false;
    if (slideHasPageNum) {
      if (slide.slideGroup && pageGroupSeen.has(slide.slideGroup)) {
      } else {
        pageCounter++;
        if (slide.slideGroup) pageGroupSeen.add(slide.slideGroup);
      }
    }
    const pageLabel = showPageNumbers && slideHasPageNum ? pageNumberFormat === "c/t" ? `${pageCounter} / ${totalNumberedSlides}` : `${pageCounter}` : "";
    let footerHtml = "";
    if (slide.showSlideFooter !== false && !slide.hideFooter) {
      const timeSpan = showTimeWidget ? `<span class="reveal-time-widget" style="flex-shrink:0;"></span>` : "";
      if (footerMode === "sequence" && sequenceSections.length > 0 && (showFooter || showTimeWidget)) {
        const activeIdx = slide.activeSection;
        const seqSpans = sequenceSections.map((sec, i) => {
          const isActive = activeIdx === i;
          const secLabel = typeof sec === "string" ? sec : sec?.label || "";
          const secActiveColor = typeof sec === "object" && sec?.color ? cssValue(sec.color) : footerColor || "rgba(255,255,255,0.9)";
          const color2 = isActive ? secActiveColor : footerInactiveColor;
          const weight = isActive ? "font-weight:700;" : "font-weight:400;";
          return `<span style="color:${color2};${weight}">${escapeHtml(secLabel || `Section ${i + 1}`)}</span>`;
        }).join("");
        const pageSpan = pageLabel ? `<span style="margin-left:12px;flex-shrink:0;">${pageLabel}</span>` : "";
        const timePart = timeSpan ? `${timeSpan}` : "";
        footerHtml = `      <div class="reveal-footer" style="position:absolute;bottom:6px;left:16px;right:16px;z-index:900;display:flex;justify-content:center;align-items:center;pointer-events:none;box-sizing:border-box;">${timePart}<div style="display:flex;flex:1;justify-content:space-evenly;align-items:center;">${seqSpans}</div>${pageSpan}</div>`;
      } else {
        const sectionLabel = showFooter && slide.section ? escapeHtml(slide.section) : "";
        const leftContent = [timeSpan, sectionLabel].filter(Boolean).join(" — ");
        footerHtml = leftContent || pageLabel ? `      <div class="reveal-footer" style="position:absolute;bottom:8px;left:16px;right:16px;z-index:900;display:flex;justify-content:space-between;align-items:center;pointer-events:none;box-sizing:border-box;"><span>${leftContent}</span><span>${pageLabel}</span></div>` : "";
      }
    }
    const slideShowGrid = slide.showPresentGrid != null ? slide.showPresentGrid : showPresentGrid;
    const gridHtml = slideShowGrid ? `      <div style="position:absolute;inset:0;z-index:950;pointer-events:none;background-image:linear-gradient(to right,rgba(255,255,255,0.12) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.12) 1px,transparent 1px);background-size:${presentGridSize}px ${presentGridSize}px;"></div>` : "";
    const autoAnimateAttr = slide.autoAnimate ? ' data-auto-animate data-auto-animate-unmatched="fade"' : "";
    const autoAnimateDurAttr = slide.autoAnimate && slide.autoAnimateDuration ? ` data-auto-animate-duration="${sanitizeAttr(slide.autoAnimateDuration)}"` : "";
    const autoAnimateEasingAttr = slide.autoAnimate && slide.autoAnimateEasing ? ` data-auto-animate-easing="${sanitizeAttr(slide.autoAnimateEasing)}"` : "";
    const isCustomTrans = CUSTOM_TRANSITIONS.includes(slide.transition);
    const perSlideTransition = slide.transition ? ` data-transition="${isCustomTrans ? "none" : sanitizeAttr(slide.transition)}"` : "";
    const customTransAttr = isCustomTrans ? ` data-custom-transition="${slide.transition}"` : "";
    const perSlideSpeed = slide.transitionSpeed ? ` data-transition-speed="${sanitizeAttr(slide.transitionSpeed)}"` : "";
    const scrollAttr = scrolling ? ` data-scroll-height="${canvasH}"` : "";
    const canvasBg = scrolling ? canvasBackgroundStyle(slide.background, absoluteSrc) : "";
    const bodyHtml = (scrolling ? scrollingSlideBody({ slideW, slideH, canvasH, elementsHtml, pinnedHtml, background: canvasBg }) : elementsHtml) + stepMarkers(slide);
    slideSectionHtmlByIndex.set(slideIndex, `    <section data-slide-id="${escapeHtml(String(slide.id || slideIndex))}"${slideIdAttr(slide)}${canvasBg ? "" : bgAttrs}${autoAnimateAttr}${autoAnimateDurAttr}${autoAnimateEasingAttr}${perSlideTransition}${customTransAttr}${perSlideSpeed}${scrollAttr} style="padding:0;width:${slideW}px;height:${slideH}px;overflow:hidden;font-size:42px;">
${bodyHtml}
${footerHtml}
${gridHtml}
${sideCitationsHtml}
      ${notes}
    </section>`);
  });
  const scrollingDeck = hasScrollingSlides(presentation);
  const columns = getSlideColumns(presentation.slides, presentation);
  let slidesHtml = columns.map((colSlides) => {
    const sections = colSlides.map((slide) => {
      const idx = presentation.slides.indexOf(slide);
      return slideSectionHtmlByIndex.get(idx) || "";
    }).join("\n");
    if (colSlides.length === 1) return sections;
    return `    <section>
${sections}
    </section>`;
  }).join("\n");
  if (bibliography.length > 0) {
    const referencedEntries = getReferencedEntries(bibliography, presentation.slides);
    if (referencedEntries.length > 0) {
      const refItems = referencedEntries.map((entry, i) => {
        const authors = entry.author || "";
        const year = entry.year || "";
        const title = escapeHtml(entry.title || "");
        const journal = entry.journal || entry.booktitle || "";
        const vol = entry.volume || "";
        const pages = entry.pages || "";
        const doi = entry.doi || "";
        let line = `<span style="color:${footerColor};font-weight:700;margin-right:6px">[${i + 1}]</span>`;
        line += `${escapeHtml(authors)}`;
        if (year) line += ` (${escapeHtml(year)})`;
        line += `. ${title}.`;
        if (journal) line += ` <em>${escapeHtml(journal)}</em>`;
        if (vol) line += `, ${escapeHtml(vol)}`;
        if (pages) line += `, ${escapeHtml(pages)}`;
        line += ".";
        if (doi) line += ` <a href="https://doi.org/${escapeHtml(doi)}" target="_blank" rel="noopener" style="color:rgba(99,102,241,0.8);font-size:0.85em">DOI</a>`;
        return `<div style="margin-bottom:8px;line-height:1.5;font-size:14px;color:rgba(255,255,255,0.85)">${line}</div>`;
      }).join("\n          ");
      const refSlide = `    <section data-slide-id="references">
      <div style="position:absolute;left:40px;top:30px;width:${slideW - 80}px;height:${slideH - 60}px;overflow:auto;z-index:1">
        <h2 style="font-size:28px;margin:0 0 20px;color:rgba(255,255,255,0.95)">References</h2>
        <div style="columns:${referencedEntries.length > 8 ? 2 : 1};column-gap:30px">
          ${refItems}
        </div>
      </div>
    </section>`;
      slidesHtml += "\n" + refSlide;
    }
  }
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(presentation.title || "Presentation")}</title>
  <link rel="stylesheet" href="${(0, import_libraries2.libUrl)("reveal.js", "dist/reset.css")}">
  <link rel="stylesheet" href="${(0, import_libraries2.libUrl)("reveal.js", "dist/reveal.css")}">
  <link rel="stylesheet" href="${(0, import_libraries2.libUrl)("reveal.js", `dist/theme/${theme}.css`)}">
  <link rel="stylesheet" href="${(0, import_libraries2.libUrl)("@highlightjs/cdn-assets", `styles/${codeTheme}.min.css`)}">
  <link rel="stylesheet" href="${(0, import_libraries2.libUrl)("katex", "dist/katex.min.css")}">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&family=Roboto:wght@100;300;400;500;700;900&family=Open+Sans:wght@300;400;500;600;700;800&family=Source+Sans+Pro:ital,wght@0,200;0,300;0,400;0,600;0,700;0,900;1,200;1,300;1,400;1,600;1,700;1,900&family=Playfair+Display:wght@400;500;600;700;800;900&family=Merriweather:wght@300;400;700;900&family=Fira+Code:wght@300;400;500;600;700&family=JetBrains+Mono:wght@100;200;300;400;500;600;700;800&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;500;600;700&family=Questrial&family=Didact+Gothic&family=Nunito:wght@300;400;500;600;700;800;900&family=Nunito+Sans:wght@300;400;500;600;700;800;900&family=Quicksand:wght@300;400;500;600;700&family=Dosis:wght@300;400;500;600;700;800&family=M+PLUS+Rounded+1c:wght@300;400;500;700;900&family=Jura:wght@300;400;500;600;700&family=Codystar:wght@300;400&family=Barlow:wght@300;400;500;600;700;800;900&family=Barlow+Condensed:wght@300;400;500;600;700;800;900&family=Asap+Condensed:wght@400;500;600;700;900&family=Istok+Web:wght@400;700&family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inconsolata:wght@300;400;500;600;700;800;900&family=Source+Sans+3:wght@300;400;500;600;700;800;900&family=Fira+Sans:wght@300;400;500;600;700;800;900&family=Roboto+Condensed:wght@300;400;500;700&family=Roboto+Mono:wght@300;400;500;600;700&family=Rubik:wght@300;400;500;600;700;800;900&family=Ubuntu:wght@300;400;500;700&family=Manrope:wght@300;400;500;600;700;800&family=Bebas+Neue&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=Roboto+Flex:wght@300;400;500;600;700&family=Inter+Tight:wght@300;400;500;600;700;800;900&family=Geist:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&family=Figtree:wght@300;400;500;600;700;800;900&display=swap">
  <link rel="stylesheet" href="${(0, import_libraries2.libUrl)("latex.js", "dist/fonts/cmu.css")}">
  <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/futura-pt">
  <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/bauhaus-93">
  <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/national-park">${customFontLinks(customFonts)}
  <style>${customFontFaces(customFonts)}
    @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 400; src: url('${(0, import_libraries2.libUrl)("latex.js", "dist/fonts/Serif/cmunrm.woff")}') format('woff'); }
    @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 700; src: url('${(0, import_libraries2.libUrl)("latex.js", "dist/fonts/Serif/cmunbx.woff")}') format('woff'); }
    @font-face { font-family: 'Latin Modern Roman'; font-style: italic; font-weight: 400; src: url('${(0, import_libraries2.libUrl)("latex.js", "dist/fonts/Serif/cmunti.woff")}') format('woff'); }
  </style>
  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; background: #000; }
    /* Override reveal.js theme CSS variables to match editor */
    :root { --r-main-font-size: 42px; --r-block-margin: 0px; --r-heading-margin: 0 0 0.4em 0; --r-heading-text-transform: none; --r-heading-letter-spacing: normal; }
    /* Reset reveal.js section padding/alignment so absolute positions match the editor canvas exactly */
    .reveal .slides section { padding: 0 !important; text-align: left !important; overflow: hidden !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.4 !important; text-transform: none; letter-spacing: normal; }
    .reveal .slides section > * { overflow: hidden; }
    /* Override ALL theme element styles to match TipTap editor exactly */
    .reveal p { margin: 0 0 0.4em !important; }
    .reveal h1, .reveal h2, .reveal h3, .reveal h4, .reveal h5, .reveal h6 { margin: 0 0 0.4em !important; text-transform: none !important; letter-spacing: normal !important; text-shadow: none !important; }
    .reveal h1 { font-size: 2.5em; font-weight: bold; line-height: 1.2; }
    .reveal h2 { font-size: 1.6em; font-weight: bold; line-height: 1.2; }
    .reveal h3 { font-size: 1.3em; font-weight: bold; line-height: 1.2; }
    .reveal h4 { font-size: 1em;   font-weight: bold; line-height: 1.2; }
    .reveal ul, .reveal ol { padding-left: 1.5em; margin: 0 0 0.4em; }
    .reveal li { margin-bottom: 0.2em; line-height: inherit; }
    .reveal span { line-height: inherit; }
    .reveal a { text-decoration: underline; }
    .reveal img { margin: 0 !important; border: none !important; background: none !important; box-shadow: none !important; max-width: none !important; max-height: none !important; }
    .reveal code { background: rgba(255,255,255,0.1); padding: 2px 5px; border-radius: 3px; font-family: monospace; }
    .reveal pre { background: rgba(0,0,0,0.4); padding: 12px 16px; border-radius: 6px; margin: 0 0 0.4em !important; overflow: auto; width: auto !important; box-shadow: none !important; }
    .reveal pre code { background: none; padding: 0; }
    .reveal blockquote { border-left: 3px solid rgba(255,255,255,0.3); padding-left: 16px; opacity: 0.8; margin: 0 0 0.4em !important; width: auto !important; box-shadow: none !important; font-style: normal; }
    /* Footer — explicit CSS rule with high specificity so reveal.js theme cannot override */
    /* color only on the container so per-span inline colors (inactive sections) are not overridden */
    .reveal .slides section .reveal-footer { color: ${footerColor} !important; }
    .reveal .slides section .reveal-footer,
    .reveal .slides section .reveal-footer * { font-family: ${footerFontFamily} !important; font-size: ${footerFontSize}px !important; }
    #fs-btn {
      position: fixed; bottom: 16px; right: 16px; z-index: 9999;
      background: rgba(0,0,0,0.5); color: white; border: 1px solid rgba(255,255,255,0.3);
      border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 13px;
      backdrop-filter: blur(4px); transition: background 0.15s;
    }
    #fs-btn:hover { background: rgba(0,0,0,0.75); }
    :fullscreen #fs-btn, :-webkit-full-screen #fs-btn { display: none; }
    [data-expand] { transition:box-shadow 0.2s, outline 0.2s; outline:2px solid transparent; outline-offset:2px; }
    [data-expand]:hover { outline-color:rgba(99,102,241,0.6); box-shadow:0 0 16px rgba(99,102,241,0.25); }
    .expand-overlay { position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.92);z-index:10000;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity 0.2s; }
    .expand-overlay.active { opacity:1; }
    .expand-overlay img { max-width:90vw;max-height:90vh;object-fit:contain;cursor:default;border-radius:4px; }
    .image-popup { position:fixed;z-index:10001;background:rgba(20,20,30,0.95);color:#fff;padding:12px 18px;border-radius:8px;font-family:-apple-system,sans-serif;font-size:15px;line-height:1.5;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);opacity:0;transition:opacity 0.2s;white-space:pre-wrap;pointer-events:auto; }
    .image-popup.active { opacity:1; }
    [data-popup] { transition:box-shadow 0.2s, outline 0.2s; outline:2px solid transparent; outline-offset:2px; }
    [data-popup]:hover { outline-color:rgba(251,191,36,0.5); box-shadow:0 0 12px rgba(251,191,36,0.2); }${CLICK_ACTION_CSS}${statesCss(presentation.slides)}${scrollingDeck ? SCROLLING_CSS : ""}
    .image-caption { position:absolute;left:0;right:0;top:100%;font-size:${Number(presentation.citationFontSize) || 10}px;color:rgba(255,255,255,0.5);font-family:${cssValue(presentation.citationFontFamily) || "-apple-system,sans-serif"};line-height:1.3;padding:3px 2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .image-caption a { color:rgba(255,255,255,0.5);text-decoration:underline;text-decoration-color:rgba(255,255,255,0.25); }
    .cite-sup { position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.55);color:rgba(255,255,255,0.85);font-size:10px;font-weight:700;font-family:-apple-system,sans-serif;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px;pointer-events:none;line-height:1; }
    .slide-citations { position:absolute;right:2px;top:0;bottom:0;z-index:890;display:flex;align-items:center;pointer-events:none; }
    .slide-citations-text { writing-mode:vertical-rl;transform:rotate(180deg);font-size:9px;color:rgba(255,255,255,0.45);font-family:-apple-system,sans-serif;line-height:1.3;white-space:nowrap; }
    .slide-citations-text a { color:rgba(255,255,255,0.45);text-decoration:underline; }
    /* Ensure fragments stay hidden until triggered */
    .reveal .slides section .fragment:not(.visible):not(.current-fragment) { opacity: 0 !important; visibility: hidden !important; }
    /* Custom fragment animations */
    .fragment.slide-up { transform:translateY(40px); transition:transform 0.5s ease, opacity 0.5s ease; }
    .fragment.slide-down { transform:translateY(-40px); transition:transform 0.5s ease, opacity 0.5s ease; }
    .fragment.slide-left { transform:translateX(40px); transition:transform 0.5s ease, opacity 0.5s ease; }
    .fragment.slide-right { transform:translateX(-40px); transition:transform 0.5s ease, opacity 0.5s ease; }
    .fragment.slide-up,.fragment.slide-down,.fragment.slide-left,.fragment.slide-right { opacity:0; }
    .fragment.slide-up.visible,.fragment.slide-down.visible,.fragment.slide-left.visible,.fragment.slide-right.visible { transform:none; opacity:1; }
    .fragment.flip-up { transform:perspective(600px) rotateX(90deg); opacity:0; transition:transform 0.6s ease, opacity 0.3s ease; }
    .fragment.flip-down { transform:perspective(600px) rotateX(-90deg); opacity:0; transition:transform 0.6s ease, opacity 0.3s ease; }
    .fragment.flip-up.visible,.fragment.flip-down.visible { transform:none; opacity:1; }
    /* Laser pointer / spotlight */
    #laser-dot { position:fixed;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle,#ff0000 0%,#ff0000 60%,rgba(255,0,0,0.4) 100%);box-shadow:0 0 8px 2px rgba(255,0,0,0.6);pointer-events:none;z-index:99999;display:none;transform:translate(-50%,-50%); }
    #spotlight-overlay { position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:99998;display:none; }
    /* Slide overview panel */
    #overview-toggle { position:fixed;top:16px;left:16px;z-index:9999;background:rgba(0,0,0,0.5);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:6px;padding:6px 10px;cursor:pointer;font-size:13px;backdrop-filter:blur(4px);transition:background 0.15s; }
    #overview-toggle:hover { background:rgba(0,0,0,0.75); }
    :fullscreen #overview-toggle, :-webkit-full-screen #overview-toggle { display:none; }
    #overview-panel { position:fixed;top:0;left:0;bottom:0;z-index:9998;background:rgba(15,15,25,0.95);backdrop-filter:blur(8px);border-right:1px solid rgba(255,255,255,0.1);transform:translateX(-100%);transition:transform 0.25s ease;overflow:hidden;display:flex;flex-direction:column; }
    #overview-panel.open { transform:translateX(0); }
    #overview-panel .ov-header { padding:12px 16px;font-size:12px;color:rgba(255,255,255,0.5);font-family:-apple-system,sans-serif;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;display:flex;align-items:center;justify-content:space-between; }
    #overview-panel .ov-body { flex:1;overflow:auto;padding:10px; }
    #overview-panel .ov-body.linear { display:flex;flex-direction:column;gap:8px;width:180px; }
    #overview-panel .ov-body.sections { display:flex;flex-direction:row;gap:16px;min-width:min-content;padding:10px 14px; }
    #overview-panel .ov-section-col { display:flex;flex-direction:column;gap:8px;min-width:140px; }
    #overview-panel .ov-section-label { font-size:10px;color:rgba(255,255,255,0.45);font-family:-apple-system,sans-serif;text-transform:uppercase;letter-spacing:0.04em;padding:0 4px 4px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:4px;white-space:nowrap; }
    #overview-panel .ov-thumb { position:relative;border-radius:4px;overflow:hidden;cursor:pointer;border:2px solid transparent;transition:border-color 0.15s,box-shadow 0.15s;flex-shrink:0; }
    #overview-panel .ov-thumb:hover { border-color:rgba(99,102,241,0.5);box-shadow:0 0 8px rgba(99,102,241,0.2); }
    #overview-panel .ov-thumb.active { border-color:rgba(99,102,241,0.9);box-shadow:0 0 12px rgba(99,102,241,0.35); }
    #overview-panel .ov-thumb-num { position:absolute;top:3px;left:3px;font-size:9px;color:rgba(255,255,255,0.7);background:rgba(0,0,0,0.6);padding:1px 4px;border-radius:3px;font-family:-apple-system,sans-serif;z-index:2; }
  </style>${presentation.customCSS ? `
  <style>
${sanitizeCustomCSS(presentation.customCSS)}
  </style>` : ""}
</head>
<body>
  <div class="reveal">
    <div class="slides">
${slidesHtml}
    </div>
  </div>
  <button id="fs-btn" title="Enter fullscreen (F)" onclick="document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()">&#x26F6; Fullscreen</button>
  <button id="overview-toggle" title="Slide overview (G)">&#x25A6; Overview</button>
  <div id="overview-panel"><div class="ov-header"><span>Slides</span><span id="ov-count"></span></div><div class="ov-body ${sanitizeAttr(presentation.overviewLayout || "linear")}" id="ov-body"></div></div>
  <div id="laser-dot"></div>
  <canvas id="spotlight-overlay"></canvas>
  <script src="${(0, import_libraries2.libUrl)("reveal.js", "dist/reveal.js")}"></script>
  <script src="${(0, import_libraries2.libUrl)("reveal.js", "plugin/notes/notes.js")}"></script>
  <script src="${(0, import_libraries2.libUrl)("reveal.js", "plugin/highlight/highlight.js")}"></script>
  <script src="${(0, import_libraries2.libUrl)("katex", "dist/katex.min.js")}"></script>
  <script>
    var _customTransitions = ['differential-rotation'];
    var _globalTransition = ${scriptValue(presentation.transition || "slide")};
    var _isGlobalCustom = _customTransitions.indexOf(_globalTransition) !== -1;
    Reveal.initialize({
      hash: true,
      width: ${slideW},
      height: ${slideH},
      margin: 0,
      minScale: 0,
      maxScale: 10,
      center: false,
      transition: _isGlobalCustom ? 'none' : _globalTransition,
      autoAnimateStyles: ['opacity', 'color', 'background-color', 'padding', 'font-size', 'line-height', 'letter-spacing', 'border-width', 'border-color', 'border-radius', 'outline', 'outline-offset', 'rotate'],
      plugins: [ RevealNotes, RevealHighlight ]
    });
    Reveal.on('ready', function() {
      document.querySelectorAll('span[data-math-latex]').forEach(function(el) {
        try {
          katex.render(el.getAttribute('data-math-latex'), el, {
            displayMode: el.getAttribute('data-math-display') === 'true',
            throwOnError: false
          });
        } catch(e) {}
      });
      document.querySelectorAll('[data-latex-block]').forEach(function(el) {
        try {
          var target = el.querySelector('.katex-block') || el;
          katex.render(el.getAttribute('data-latex-block'), target, {
            displayMode: true,
            throwOnError: false
          });
        } catch(e) {
          var target = el.querySelector('.katex-block') || el;
          target.textContent = e.message;
          target.style.color = '#f87171';
        }
      });
    });

    // ── Element entry animations ──────────────────────────────────────────────
    // Web Animations on translate, scale and opacity, from each preset's start
    // to the element's own style: its rotation, and anything else set on it,
    // stays as it is, and nothing is left on the element afterwards.
    var OUT2 = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', OUT3 = 'cubic-bezier(0.215, 0.61, 0.355, 1)', BACK = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    var ENTRY_PRESETS = {
      fadeIn:     [OUT2, { opacity: 0 }],
      fadeUp:     [OUT3, { opacity: 0, translate: '0 48px' }],
      fadeDown:   [OUT3, { opacity: 0, translate: '0 -48px' }],
      fadeLeft:   [OUT3, { opacity: 0, translate: '48px 0' }],
      fadeRight:  [OUT3, { opacity: 0, translate: '-48px 0' }],
      zoomIn:     [BACK, { opacity: 0, scale: '0.7' }],
      zoomOut:    [OUT2, { opacity: 0, scale: '1.3' }],
      slideUp:    [OUT3, { translate: '0 560px' }],
      slideDown:  [OUT3, { translate: '0 -560px' }],
      slideLeft:  [OUT3, { translate: '980px 0' }],
      slideRight: [OUT3, { translate: '-980px 0' }],
      flipX:      [OUT2, { opacity: 0, transform: 'perspective(600px) rotateX(90deg)' }, { transform: 'perspective(600px) rotateX(0deg)' }],
      flipY:      [OUT2, { opacity: 0, transform: 'perspective(600px) rotateY(90deg)' }, { transform: 'perspective(600px) rotateY(0deg)' }],
    };
    function runSlideAnimations(slide) {
      if (!slide) return;
      slide.querySelectorAll('[data-gsap-enter]').forEach(function(el) {
        var preset = ENTRY_PRESETS[el.getAttribute('data-gsap-enter')];
        if (!preset || !el.animate) return;
        var from = Object.assign({ offset: 0 }, preset[1]);
        if (el._entry) el._entry.cancel();
        el._entry = el.animate(preset[2] ? [from, preset[2]] : [from], {
          duration: parseFloat(el.getAttribute('data-gsap-duration') || 600),
          delay: parseFloat(el.getAttribute('data-gsap-delay') || 0),
          easing: preset[0],
          fill: 'backwards',
        });
      });
    }
    Reveal.on('ready',        function(e) { runSlideAnimations(e.currentSlide); });
    Reveal.on('slidechanged', function(e) { runSlideAnimations(e.currentSlide); });

    // Dispatch resize into HTML/p5 iframes when their slide becomes active,
    // so D3 figures that use window.addEventListener('resize', ...) re-render.
    function notifyIframes(slide) {
      if (!slide) return;
      slide.querySelectorAll('iframe').forEach(function(fr) {
        try { fr.contentWindow.dispatchEvent(new Event('resize')); }
        catch(ex) { try { fr.contentWindow.postMessage('parallax-resize', '*'); } catch(ex2) {} }
      });
    }
    Reveal.on('ready',        function(e) { notifyIframes(e.currentSlide); });
    Reveal.on('slidechanged', function(e) { notifyIframes(e.currentSlide); });

    // ── Custom transitions (differential rotation) ───────────────────────
    (function() {
      var prevH = 0, prevV = 0;
      Reveal.on('ready', function(e) { prevH = e.indexh || 0; prevV = e.indexv || 0; });
      Reveal.on('slidechanged', function(e) {
        var prev = e.previousSlide;
        var transName = null;
        if (prev && prev.getAttribute('data-custom-transition'))
          transName = prev.getAttribute('data-custom-transition');
        else if (_isGlobalCustom)
          transName = _globalTransition;
        var dir = 1;
        if ((e.indexh || 0) < prevH || ((e.indexh || 0) === prevH && (e.indexv || 0) < prevV)) dir = -1;
        prevH = e.indexh || 0;
        prevV = e.indexv || 0;
        if (transName === 'differential-rotation') drTransition(dir);
      });
      function drTransition(dir) {
        var N = 16;
        var vw = window.innerWidth, vh = window.innerHeight;
        var bh = vh / N;
        var BAUHAUS = ['#CC0000', '#003399', '#FFCC00'];
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9998;pointer-events:none;overflow:hidden;';
        var pending = N;
        for (var i = 0; i < N; i++) {
          var band = document.createElement('div');
          band.style.cssText = 'position:absolute;left:0;width:100%;background:#000;box-sizing:border-box;';
          band.style.top = (i * bh) + 'px';
          band.style.height = (bh + 0.5) + 'px';
          if (i < N - 1) {
            band.style.borderBottom = '1.5px solid ' + BAUHAUS[i % 3];
          }
          overlay.appendChild(band);
          var lat = Math.PI * ((i + 0.5) / N - 0.5);
          var cos2 = Math.cos(lat); cos2 = cos2 * cos2;
          var dur = 0.4 + 1.0 * (1 - cos2);
          band.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + (dir * (vw + 20)) + 'px)' }], {
            duration: dur * 1000, easing: 'linear', fill: 'forwards'
          }).onfinish = function() { pending--; if (pending <= 0) overlay.remove(); };
        }
        document.body.appendChild(overlay);
      }
    })();

    // ── Image click interactions (popup + expand) ─────────────────────
    (function() {
      function dismissAll() {
        var p = document.querySelector('.image-popup');
        if (p) { p.classList.remove('active'); setTimeout(function() { p.remove(); }, 200); }
        var ov = document.querySelector('.expand-overlay');
        if (ov) { ov.classList.remove('active'); setTimeout(function() { ov.remove(); }, 200); }
      }
      function showPopup(el, anchor) {
        var old = document.querySelector('.image-popup');
        if (old) old.remove();
        var text = el.getAttribute('data-popup');
        var pos = el.getAttribute('data-popup-pos') || 'below';
        var fs = el.getAttribute('data-popup-fs') || '15';
        var rect = anchor.getBoundingClientRect();
        var p = document.createElement('div');
        p.className = 'image-popup';
        p.textContent = text;
        p.style.fontSize = fs + 'px';
        if (pos === 'center') {
          p.style.left = (rect.left + rect.width/2) + 'px';
          p.style.top = (rect.top + rect.height/2) + 'px';
          p.style.transform = 'translate(-50%,-50%)';
        } else if (pos === 'side') {
          p.style.top = (rect.top + rect.height/2) + 'px';
          if (rect.right + 320 < window.innerWidth) {
            p.style.left = (rect.right + 12) + 'px';
            p.style.transform = 'translateY(-50%)';
          } else {
            p.style.left = (rect.left - 12) + 'px';
            p.style.transform = 'translate(-100%,-50%)';
          }
        } else {
          p.style.left = (rect.left + rect.width/2) + 'px';
          p.style.top = (rect.bottom + 12) + 'px';
          p.style.transform = 'translateX(-50%)';
        }
        document.body.appendChild(p);
        requestAnimationFrame(function() { p.classList.add('active'); });
      }
      document.addEventListener('click', function(e) {
        if (e.target.closest('.image-popup')) return;
        var ov = e.target.closest('.expand-overlay');
        if (ov) {
          if (e.target.tagName === 'IMG') return;
          dismissAll(); return;
        }
        var el = e.target.closest('[data-popup],[data-expand]');
        if (!el) { dismissAll(); return; }
        e.stopPropagation();
        dismissAll();
        var hasPopup = el.hasAttribute('data-popup');
        var hasExpand = el.hasAttribute('data-expand');
        var img = el.querySelector('img');
        if (hasExpand && img) {
          var overlay = document.createElement('div');
          overlay.className = 'expand-overlay';
          var big = document.createElement('img');
          big.src = img.src;
          big.onclick = function(ev) { ev.stopPropagation(); };
          overlay.appendChild(big);
          document.body.appendChild(overlay);
          requestAnimationFrame(function() {
            overlay.classList.add('active');
            if (hasPopup) showPopup(el, big);
          });
        } else if (hasPopup) {
          showPopup(el, el);
        }
      });
      document.addEventListener('keydown', function(e) { if (e.key === 'Escape') dismissAll(); });
    })();
${CLICK_ACTION_SCRIPT}${scrollingDeck ? SCROLLING_SCRIPT : ""}

${(() => {
    const overviewLayout = presentation.overviewLayout || "linear";
    const colsData = columns.map((colSlides, h) => colSlides.map((slide, v) => {
      const flatIdx = presentation.slides.indexOf(slide);
      return { h, v, flatIdx, section: slide.section || "" };
    }));
    const flatSlides = colsData.flat();
    return `
    // ── Slide overview panel ──────────────────────────────────────────
    (function() {
      var LAYOUT = ${scriptValue(overviewLayout)};
      var SLIDES = ${scriptValue(flatSlides)};
      var panel = document.getElementById('overview-panel');
      var body = document.getElementById('ov-body');
      var toggle = document.getElementById('overview-toggle');
      var countEl = document.getElementById('ov-count');
      var thumbs = [];
      var THUMB_W = LAYOUT === 'sections' ? 130 : 150;
      var slideW = ${slideW}, slideH = ${slideH};
      var thumbH = Math.round(THUMB_W * slideH / slideW);
      var isOpen = false;

      countEl.textContent = SLIDES.length;

      function buildThumbnails() {
        var allSections = document.querySelectorAll('.reveal .slides > section');
        var slideEls = [];
        allSections.forEach(function(sec) {
          var nested = sec.querySelectorAll(':scope > section');
          if (nested.length > 0) {
            nested.forEach(function(s) { slideEls.push(s); });
          } else {
            slideEls.push(sec);
          }
        });

        if (LAYOUT === 'sections') {
          var groups = {};
          var order = [];
          SLIDES.forEach(function(s, i) {
            var key = s.section || '(No Section)';
            if (!groups[key]) { groups[key] = []; order.push(key); }
            groups[key].push({ meta: s, idx: i, el: slideEls[i] });
          });
          order.forEach(function(key) {
            var col = document.createElement('div');
            col.className = 'ov-section-col';
            var label = document.createElement('div');
            label.className = 'ov-section-label';
            label.textContent = key;
            col.appendChild(label);
            groups[key].forEach(function(item) {
              col.appendChild(makeThumb(item.meta, item.idx, item.el));
            });
            body.appendChild(col);
          });
        } else {
          SLIDES.forEach(function(s, i) {
            body.appendChild(makeThumb(s, i, slideEls[i]));
          });
        }
      }

      function makeThumb(meta, idx, srcEl) {
        var wrap = document.createElement('div');
        wrap.className = 'ov-thumb';
        wrap.style.width = THUMB_W + 'px';
        wrap.style.height = thumbH + 'px';
        var num = document.createElement('div');
        num.className = 'ov-thumb-num';
        num.textContent = idx + 1;
        wrap.appendChild(num);
        if (srcEl) {
          var clone = srcEl.cloneNode(true);
          // A picture only: its clickable and hoverable copies can't be tabbed to
          clone.setAttribute('inert', '');
          clone.setAttribute('aria-hidden', 'true');
          clone.style.cssText = 'position:absolute;top:0;left:0;width:' + slideW + 'px;height:' + slideH + 'px;transform:scale(' + (THUMB_W/slideW) + ');transform-origin:top left;pointer-events:none;overflow:hidden;';
          clone.querySelectorAll('.reveal-footer').forEach(function(f) { f.remove(); });
          clone.querySelectorAll('iframe').forEach(function(f) { f.remove(); });
          clone.querySelectorAll('video').forEach(function(v) { v.pause(); v.removeAttribute('autoplay'); });
          wrap.appendChild(clone);
        } else {
          wrap.style.background = 'rgba(30,30,46,0.8)';
        }
        wrap.onclick = function() { Reveal.slide(meta.h, meta.v); updateActive(); };
        thumbs.push({ el: wrap, h: meta.h, v: meta.v });
        return wrap;
      }

      function updateActive() {
        var state = Reveal.getIndices();
        thumbs.forEach(function(t) {
          if (t.h === state.h && t.v === state.v) t.el.classList.add('active');
          else t.el.classList.remove('active');
        });
        var active = body.querySelector('.ov-thumb.active');
        if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }

      function togglePanel() {
        isOpen = !isOpen;
        if (isOpen) panel.classList.add('open');
        else panel.classList.remove('open');
      }

      toggle.onclick = togglePanel;
      document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'g' || e.key === 'G') { e.preventDefault(); togglePanel(); }
      });

      Reveal.on('ready', function() { buildThumbnails(); updateActive(); });
      Reveal.on('slidechanged', function() { updateActive(); });
    })();
`;
  })()}
${laserPointer !== "off" ? `
    // ── Laser pointer / spotlight ────────────────────────────────────
    (function() {
      var mode = ${scriptValue(laserPointer)};
      var active = false;
      var dot = document.getElementById('laser-dot');
      var canvas = document.getElementById('spotlight-overlay');
      var ctx = canvas.getContext('2d');
      var mx = 0, my = 0;

      function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; if (active && mode === 'spotlight') drawSpotlight(); }
      window.addEventListener('resize', resize);
      resize();

      function drawSpotlight() {
        var w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, w, h);
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        var grad = ctx.createRadialGradient(mx, my, 0, mx, my, 120);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(0.7, 'rgba(0,0,0,0.9)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mx, my, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      document.addEventListener('mousemove', function(e) {
        mx = e.clientX; my = e.clientY;
        if (!active) return;
        if (mode === 'dot') { dot.style.left = mx + 'px'; dot.style.top = my + 'px'; }
        else { drawSpotlight(); }
      });

      document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'l' || e.key === 'L') {
          e.preventDefault();
          active = !active;
          if (mode === 'dot') { dot.style.display = active ? 'block' : 'none'; }
          else { canvas.style.display = active ? 'block' : 'none'; if (active) drawSpotlight(); }
        }
      });
    })();
` : ""}
${showTimeWidget ? `
    // Time widget (clock or timer)
    (function() {
      var mode = ${scriptValue(footerTimeMode)};
      var timerDur = ${timerDuration} * 60;
      var timerStart = Date.now();
      function pad(n) { return n < 10 ? '0' + n : '' + n; }
      function fmt() {
        if (mode === 'clock12') return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        if (mode === 'clock24') return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        var elapsed = Math.floor((Date.now() - timerStart) / 1000);
        var secs = mode === 'timer-down' ? Math.max(0, timerDur - elapsed) : elapsed;
        var h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
        return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
      }
      function update() { document.querySelectorAll('.reveal-time-widget').forEach(function(el) { el.textContent = fmt(); }); }
      update();
      setInterval(update, 1000);
    })();
` : ""}
  </script>
${opts.annotate ? annotationScript(presentation, opts.annotate.set) : ""}
${opts.bridge ? DECK_BRIDGE_SCRIPT : ""}
</body>
</html>`;
}
function annotationScript(presentation, set) {
  const config = {
    set,
    message: ANNOTATION_MESSAGE,
    origin: globalThis.location?.origin || "*",
    slideW: presentation.slideWidth || 960,
    slideH: presentation.slideHeight || 540
  };
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `  <script>
  (function () {
    var start = function () { (${installAnnotations.toString()})(${json}) }
    if (Reveal.isReady()) start(); else Reveal.on('ready', start)
  })()
  </script>`;
}
function getBackgroundAttrs(bg) {
  if (!bg) return "";
  if (bg.type === "color" && bg.color) return ` data-background-color="${sanitizeAttr(bg.color)}"`;
  if (bg.type === "image" && bg.image) return ` data-background-image="${absoluteSrc(sanitizeUrl(bg.image))}" data-background-size="${sanitizeAttr(bg.size || "cover")}" data-background-position="${sanitizeAttr(bg.position || "center")}"`;
  if (bg.type === "gradient" && bg.gradient) return ` data-background-gradient="${sanitizeAttr(bg.gradient)}"`;
  return "";
}
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
var scriptValue = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
var DECK_BRIDGE_SCRIPT = `  <script>
  (function () {
    function send() {
      window.parent.postMessage({ type: 'parallax-deck', slide: Reveal.getSlides().indexOf(Reveal.getCurrentSlide()), total: Reveal.getTotalSlides() }, '*');
    }
    window.addEventListener('message', function (e) {
      if (e.source !== window.parent || !e.data || e.data.type !== 'parallax-deck-go') return;
      var s = Reveal.getSlides()[e.data.slide];
      if (s) { var i = Reveal.getIndices(s); Reveal.slide(i.h, i.v); }
    });
    if (Reveal.isReady()) send(); else Reveal.on('ready', send);
    Reveal.on('slidechanged', send);
  })()
  </script>`;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateRevealHTML
});

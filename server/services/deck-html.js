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
function modelViewerHtml(el, { src = el.src, snapshotKey = null, print = false } = {}) {
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
    snapshotKey,
    print
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
// How much the deck or editor enlarges this frame, which it can't see (a CSS
// transform): it draws at that size to stay sharp, at least 2 in a PDF
let shownScale = 1;
const pixelRatio = () => Math.min(4, Math.max(1, (window.devicePixelRatio || 1) * (O.print ? Math.max(shownScale, 2) : shownScale)));
renderer.setPixelRatio(pixelRatio());
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
  if (e.source !== window.parent) return;
  if (e.data === 'parallax-resize') resize();
  if (e.data && e.data.type === 'scale' && typeof e.data.scale === 'number' && e.data.scale > 0) {
    shownScale = Math.min(8, Math.max(0.1, e.data.scale));
    renderer.setPixelRatio(pixelRatio());
    resize();
  }
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

// client/src/utils/graphParser.js
function createMathParser() {
  const FUNCS = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    sec: (x) => 1 / Math.cos(x),
    csc: (x) => 1 / Math.sin(x),
    cot: (x) => 1 / Math.tan(x),
    arcsin: Math.asin,
    arccos: Math.acos,
    arctan: (y, x) => x === void 0 ? Math.atan(y) : Math.atan2(y, x),
    asin: Math.asin,
    acos: Math.acos,
    atan: (y, x) => x === void 0 ? Math.atan(y) : Math.atan2(y, x),
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    exp: Math.exp,
    ln: Math.log,
    log: Math.log10,
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    sign: Math.sign,
    sgn: Math.sign,
    min: Math.min,
    max: Math.max,
    mod: (a, b) => (a % b + b) % b
  };
  const ARITY = { min: [1, 99], max: [1, 99], mod: [2, 2], arctan: [1, 2], atan: [1, 2] };
  const INVERSE = { sin: "arcsin", cos: "arccos", tan: "arctan" };
  const CONSTANTS = { pi: Math.PI, tau: 2 * Math.PI, e: Math.E };
  const GREEK = ["alpha", "beta", "gamma", "delta", "epsilon", "lambda", "sigma", "omega", "phi", "rho"];
  const RESERVED = ["x", "y", "t", "theta", "r"];
  const NAMES = Object.keys(FUNCS).concat(Object.keys(CONSTANTS), ["theta"], GREEK).sort((a, b) => b.length - a.length);
  const UNICODE = {
    "−": "-",
    "–": "-",
    "·": "*",
    "×": "*",
    "⋅": "*",
    "÷": "/",
    "≤": "<=",
    "≥": ">=",
    "π": "pi",
    "θ": "theta",
    "τ": "tau",
    "√": "sqrt",
    "²": "^2",
    "³": "^3",
    "α": "alpha",
    "β": "beta",
    "γ": "gamma",
    "δ": "delta",
    "ε": "epsilon",
    "λ": "lambda",
    "σ": "sigma",
    "ω": "omega",
    "φ": "phi",
    "ρ": "rho"
  };
  const CMP = ["=", "<", ">", "<=", ">="];
  function fail(message) {
    const e = new Error(message);
    e.graphError = true;
    throw e;
  }
  function normalize(text) {
    let out = "";
    for (const ch of String(text)) out += UNICODE[ch] !== void 0 ? UNICODE[ch] : ch;
    return out;
  }
  const isDigit = (c) => c >= "0" && c <= "9";
  const isLetter = (c) => c >= "a" && c <= "z" || c >= "A" && c <= "Z";
  const isWord = (c) => isLetter(c) || isDigit(c);
  function tokenize(text) {
    const s = normalize(text);
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === " " || c === "	" || c === "\n" || c === "\r") {
        i++;
        continue;
      }
      if (isDigit(c) || c === "." && isDigit(s[i + 1])) {
        let j = i;
        while (isDigit(s[j])) j++;
        if (s[j] === ".") {
          j++;
          while (isDigit(s[j])) j++;
        }
        tokens.push({ t: "num", v: parseFloat(s.slice(i, j)) });
        i = j;
        continue;
      }
      if (isLetter(c)) {
        const word = NAMES.find((n) => s.startsWith(n, i));
        let name = word || c;
        let j = i + name.length;
        if (!word || !FUNCS[word]) {
          if (s[j] === "_") {
            if (s[j + 1] === "{") {
              const end = s.indexOf("}", j + 2);
              if (end < 0) fail("A subscript _{ needs its }");
              const sub = s.slice(j + 2, end).trim();
              if (!sub || ![...sub].every(isWord)) fail("Subscripts are letters and digits, like a_1");
              name += "_" + sub;
              j = end + 1;
            } else {
              let k = j + 1;
              while (k < s.length && isWord(s[k])) k++;
              if (k === j + 1) fail("Put a letter or digit after _, like a_1");
              name += "_" + s.slice(j + 1, k);
              j = k;
            }
          }
        }
        tokens.push({ t: word && FUNCS[word] ? "fn" : "id", v: name });
        i = j;
        continue;
      }
      const two = s.slice(i, i + 2);
      if (two === "<=" || two === ">=") {
        tokens.push({ t: "op", v: two });
        i += 2;
        continue;
      }
      if (two === "**") {
        tokens.push({ t: "op", v: "^" });
        i += 2;
        continue;
      }
      if ("+-*/^(),|{}=<>:".includes(c)) {
        tokens.push({ t: "op", v: c });
        i++;
        continue;
      }
      fail("“" + c + "” isn’t something a graph can read");
    }
    return tokens;
  }
  function parser(tokens, userFns) {
    let pos = 0;
    let absDepth = 0;
    const peek = () => tokens[pos];
    const isOp = (v) => pos < tokens.length && tokens[pos].t === "op" && tokens[pos].v === v;
    function expect(v, what) {
      if (!isOp(v)) fail(pos < tokens.length ? "Expected " + (what || v) + " before “" + tokens[pos].v + "”" : "Expected " + (what || v) + " at the end");
      pos++;
    }
    function startsFactor(tok) {
      if (!tok) return false;
      if (tok.t !== "op") return true;
      return tok.v === "(" || tok.v === "{" || tok.v === "|" && absDepth === 0;
    }
    function expr() {
      let a = term();
      while (isOp("+") || isOp("-")) {
        const op = tokens[pos++].v;
        a = { k: "bin", op, a, b: term() };
      }
      return a;
    }
    function term() {
      let a = unary();
      for (; ; ) {
        if (isOp("*") || isOp("/")) {
          const op = tokens[pos++].v;
          a = { k: "bin", op, a, b: unary() };
        } else if (startsFactor(peek())) {
          a = { k: "bin", op: "*", a, b: power() };
        } else {
          return a;
        }
      }
    }
    function unary() {
      if (isOp("-")) {
        pos++;
        return { k: "neg", a: unary() };
      }
      if (isOp("+")) {
        pos++;
        return unary();
      }
      return power();
    }
    function power() {
      const base = primary();
      if (isOp("^")) {
        pos++;
        return { k: "bin", op: "^", a: base, b: exponent() };
      }
      return base;
    }
    function exponent() {
      if (isOp("{")) {
        pos++;
        const e = expr();
        expect("}");
        return e;
      }
      return unary();
    }
    function args() {
      const list = [expr()];
      while (isOp(",")) {
        pos++;
        list.push(expr());
      }
      expect(")");
      return list;
    }
    function chain(first) {
      const parts = [first || expr()];
      const ops = [];
      while (pos < tokens.length && tokens[pos].t === "op" && CMP.includes(tokens[pos].v)) {
        ops.push(tokens[pos++].v);
        parts.push(expr());
      }
      return { parts, ops };
    }
    function piecewise() {
      const branches = [];
      let otherwise = null;
      for (; ; ) {
        const c = chain();
        if (!c.ops.length) {
          otherwise = c.parts[0];
          if (!isOp("}")) fail("In { }, the value for “otherwise” goes last");
          break;
        }
        let value = null;
        if (isOp(":")) {
          pos++;
          value = expr();
        }
        branches.push({ cond: c, value });
        if (!isOp(",")) break;
        pos++;
      }
      expect("}");
      return { k: "piece", branches, otherwise };
    }
    function fn() {
      let name = tokens[pos++].v;
      let pow = null;
      if (isOp("^")) {
        pos++;
        pow = exponent();
      }
      if (pow && INVERSE[name] && pow.k === "neg" && pow.a.k === "num" && pow.a.v === 1) {
        name = INVERSE[name];
        pow = null;
      }
      let list;
      if (isOp("(")) {
        pos++;
        list = args();
      } else {
        if (!startsFactor(peek())) fail(name + " needs something to work on, like " + name + "(x)");
        let a = power();
        while (startsFactor(peek()) && peek().t !== "fn") a = { k: "bin", op: "*", a, b: power() };
        list = [a];
      }
      const [least, most] = ARITY[name] || [1, 1];
      if (list.length < least || list.length > most) {
        fail(name + " takes " + (least === most ? least : least + " or " + most) + " value" + (most === 1 ? "" : "s"));
      }
      const call = { k: "call", f: name, args: list };
      return pow ? { k: "bin", op: "^", a: call, b: pow } : call;
    }
    function primary() {
      const tok = peek();
      if (!tok) fail("Something’s missing at the end");
      if (tok.t === "num") {
        pos++;
        return { k: "num", v: tok.v };
      }
      if (tok.t === "fn") return fn();
      if (tok.t === "id") {
        pos++;
        if (userFns.has(tok.v) && isOp("(")) {
          pos++;
          return { k: "ucall", f: tok.v, args: args() };
        }
        return { k: "var", n: tok.v };
      }
      if (isOp("(")) {
        pos++;
        const saved = absDepth;
        absDepth = 0;
        const items = args();
        absDepth = saved;
        return items.length === 1 ? items[0] : { k: "tuple", items };
      }
      if (isOp("|")) {
        pos++;
        absDepth++;
        const a = expr();
        absDepth--;
        expect("|", "a closing |");
        return { k: "call", f: "abs", args: [a] };
      }
      if (isOp("{")) {
        pos++;
        return piecewise();
      }
      fail("“" + tok.v + "” is out of place");
    }
    return {
      statement() {
        const c = chain();
        if (pos < tokens.length) fail("“" + tokens[pos].v + "” is out of place");
        return c;
      }
    };
  }
  function parseStatement(text, userFns) {
    return parser(tokenize(text), userFns || /* @__PURE__ */ new Set()).statement();
  }
  function freeVars(node, into, bound) {
    const out = into || /* @__PURE__ */ new Set();
    const walk = (n) => {
      if (!n) return;
      switch (n.k) {
        case "var":
          if (!(n.n in CONSTANTS) && !(bound && bound.includes(n.n))) out.add(n.n);
          break;
        case "neg":
          walk(n.a);
          break;
        case "bin":
          walk(n.a);
          walk(n.b);
          break;
        case "call":
        case "ucall":
          n.args.forEach(walk);
          break;
        case "tuple":
          n.items.forEach(walk);
          break;
        case "piece":
          n.branches.forEach((b) => {
            b.cond.parts.forEach(walk);
            walk(b.value);
          });
          walk(n.otherwise);
          break;
      }
    };
    walk(node);
    return out;
  }
  function usedFns(node, into) {
    const out = into || /* @__PURE__ */ new Set();
    const walk = (n) => {
      if (!n) return;
      if (n.k === "ucall") out.add(n.f);
      if (n.a) walk(n.a);
      if (n.b) walk(n.b);
      if (n.args) n.args.forEach(walk);
      if (n.items) n.items.forEach(walk);
      if (n.branches) n.branches.forEach((b) => {
        b.cond.parts.forEach(walk);
        walk(b.value);
      });
      if (n.otherwise) walk(n.otherwise);
    };
    walk(node);
    return out;
  }
  const approxEqual = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  const COMPARE = {
    "=": approxEqual,
    "<": (a, b) => a < b,
    ">": (a, b) => a > b,
    "<=": (a, b) => a <= b,
    ">=": (a, b) => a >= b
  };
  function compile(node, formals, fns) {
    const c = (n) => compile(n, formals, fns);
    switch (node.k) {
      case "num": {
        const v = node.v;
        return () => v;
      }
      case "var": {
        if (node.n in CONSTANTS) {
          const v = CONSTANTS[node.n];
          return () => v;
        }
        const i = formals ? formals.indexOf(node.n) : -1;
        if (i >= 0) return (env, a) => a[i];
        if (fns[node.n]) fail(node.n + " is a function: write " + node.n + "(x)");
        const name = node.n;
        return (env) => {
          const v = env[name];
          return typeof v === "number" ? v : NaN;
        };
      }
      case "neg": {
        const a = c(node.a);
        return (env, x) => -a(env, x);
      }
      case "bin": {
        const a = c(node.a), b = c(node.b);
        switch (node.op) {
          case "+":
            return (env, x) => a(env, x) + b(env, x);
          case "-":
            return (env, x) => a(env, x) - b(env, x);
          case "*":
            return (env, x) => a(env, x) * b(env, x);
          case "/":
            return (env, x) => a(env, x) / b(env, x);
          default:
            return (env, x) => Math.pow(a(env, x), b(env, x));
        }
      }
      case "call": {
        const f = FUNCS[node.f];
        const list = node.args.map(c);
        if (list.length === 1) {
          const a = list[0];
          return (env, x) => f(a(env, x));
        }
        if (list.length === 2) {
          const a = list[0], b = list[1];
          return (env, x) => f(a(env, x), b(env, x));
        }
        return (env, x) => f.apply(null, list.map((g) => g(env, x)));
      }
      case "ucall": {
        const def = fns[node.f];
        if (!def) fail(node.f + "(…) has an error");
        if (def.formals.length !== node.args.length) fail(node.f + " takes " + def.formals.length + " value" + (def.formals.length === 1 ? "" : "s"));
        const list = node.args.map(c);
        return (env, x) => def.call(env, list.map((g) => g(env, x)));
      }
      case "piece": {
        const branches = node.branches.map((b) => ({ test: condition(b.cond, formals, fns), value: b.value ? c(b.value) : () => 1 }));
        const otherwise = node.otherwise ? c(node.otherwise) : () => NaN;
        return (env, x) => {
          for (let i = 0; i < branches.length; i++) if (branches[i].test(env, x)) return branches[i].value(env, x);
          return otherwise(env, x);
        };
      }
      case "tuple":
        fail("A point ( , ) can’t be used inside a calculation");
    }
    fail("Couldn’t read this");
  }
  function condition(ch, formals, fns) {
    const parts = ch.parts.map((p) => compile(p, formals, fns));
    const tests = ch.ops.map((op) => COMPARE[op]);
    return (env, x) => {
      let left = parts[0](env, x);
      for (let i = 0; i < tests.length; i++) {
        const right = parts[i + 1](env, x);
        if (!tests[i](left, right)) return false;
        left = right;
      }
      return true;
    };
  }
  const FN_DEF = /^\s*([A-Za-z](?:_(?:\{[A-Za-z0-9]+\}|[A-Za-z0-9]+))?)\s*\(\s*([A-Za-z]+(?:\s*,\s*[A-Za-z]+)*)\s*\)\s*=(?![=<>])/;
  function literal(node) {
    if (node.k === "num") return node.v;
    if (node.k === "neg" && node.a.k === "num") return -node.a.v;
    return null;
  }
  const isVar = (node, name) => node.k === "var" && node.n === name;
  const only = (set, names) => [...set].every((v) => !RESERVED.includes(v) || names.includes(v));
  const has = (set, names) => names.some((n) => set.has(n));
  function analyze(expressions) {
    const items = (expressions || []).map((e) => ({ id: e.id, text: String(e.text || "") }));
    const fns = {};
    for (const item of items) {
      const text = normalize(item.text);
      const m = FN_DEF.exec(text);
      if (!m) continue;
      const name = m[1].replace(/[{}]/g, "");
      const formals = m[2].split(",").map((s) => s.trim());
      if (FUNCS[name] || name in CONSTANTS || RESERVED.includes(name)) continue;
      if (!formals.every((f) => f.length === 1 || f === "theta" || GREEK.includes(f))) continue;
      if (fns[name]) {
        item.kind = "error";
        item.error = name + " is defined twice";
        continue;
      }
      item.kind = "function";
      item.name = name;
      item.formals = formals;
      item.bodyText = text.slice(m[0].length);
      fns[name] = { formals, item };
    }
    const userFns = new Set(Object.keys(fns));
    for (const item of items) {
      if (item.kind === "error") continue;
      if (!item.text.trim()) {
        item.kind = "empty";
        continue;
      }
      try {
        if (item.kind === "function") {
          const st = parseStatement(item.bodyText, userFns);
          if (st.ops.length) fail("A function is one expression after =");
          item.body = st.parts[0];
        } else {
          item.stmt = parseStatement(item.text, userFns);
        }
      } catch (e) {
        if (!e.graphError) throw e;
        item.kind = "error";
        item.error = e.message;
      }
    }
    const params = /* @__PURE__ */ new Set();
    for (const item of items) {
      if (!item.stmt || item.kind) continue;
      const { parts, ops } = item.stmt;
      if (ops.length !== 1 || ops[0] !== "=" || parts[0].k !== "var") continue;
      const name = parts[0].n;
      if (RESERVED.includes(name) || name in CONSTANTS) continue;
      if (has(freeVars(parts[1]), RESERVED)) continue;
      if (params.has(name)) {
        item.kind = "error";
        item.error = name + " is defined twice";
        continue;
      }
      params.add(name);
      item.kind = "param";
      item.name = name;
      item.value = parts[1];
      item.literal = literal(parts[1]);
      item.slider = item.literal !== null;
    }
    for (const name of params) {
      if (fns[name]) Object.assign(fns[name].item, { kind: "error", error: name + " is already a slider" });
    }
    const known = new Set(RESERVED.concat([...params], [...userFns]));
    const missing = /* @__PURE__ */ new Set();
    const note = (vars, item) => vars.forEach((v) => {
      if (known.has(v)) return;
      missing.add(v);
      if (item) (item.missing = item.missing || []).push(v);
    });
    const reaches = (name, seen) => {
      const def = fns[name];
      if (!def || !def.item.body) return false;
      for (const f of usedFns(def.item.body)) {
        if (seen.has(f)) return true;
        if (reaches(f, /* @__PURE__ */ new Set([...seen, f]))) return true;
      }
      return false;
    };
    for (const name of userFns) {
      const item = fns[name].item;
      if (item.kind === "function" && reaches(name, /* @__PURE__ */ new Set([name]))) {
        item.kind = "error";
        item.error = name + " uses itself";
      }
    }
    const callable = {};
    for (const name of userFns) if (fns[name].item.kind === "function") callable[name] = fns[name];
    for (const name of Object.keys(callable)) {
      const def = callable[name];
      let body = null;
      def.call = (env, a) => body ? body(env, a) : NaN;
      def.compile = () => {
        body = compile(def.item.body, def.formals, callable);
      };
    }
    for (const name of Object.keys(callable)) {
      try {
        callable[name].compile();
      } catch (e) {
        if (!e.graphError) throw e;
        callable[name].item.kind = "error";
        callable[name].item.error = e.message;
      }
    }
    for (let changed = true; changed; ) {
      changed = false;
      for (const name of Object.keys(callable)) {
        const item = callable[name].item;
        if (item.kind !== "function") {
          delete callable[name];
          changed = true;
          continue;
        }
        const broken = [...usedFns(item.body)].find((f) => !callable[f] || callable[f].item.kind !== "function");
        if (broken) {
          Object.assign(item, { kind: "error", error: broken + "(…) has an error" });
          changed = true;
        }
      }
    }
    const cf = (node) => compile(node, null, callable);
    for (const item of items) {
      try {
        if (item.kind === "function") {
          const vars = freeVars(item.body, null, item.formals);
          note(vars, item);
          if (item.formals.length === 1 && item.formals[0] === "x" && only(vars, ["x"])) {
            item.graph = "y";
            const def = callable[item.name];
            item.f = (env) => def.call(env, [env.x]);
          }
        } else if (item.kind === "param") {
          note(freeVars(item.value), item);
          item.f = cf(item.value);
        } else if (item.stmt && !item.kind) {
          classify(item);
        }
      } catch (e) {
        if (!e.graphError) throw e;
        item.kind = "error";
        item.error = e.message;
      }
    }
    function classify(item) {
      const { parts, ops } = item.stmt;
      const vars = /* @__PURE__ */ new Set();
      parts.forEach((p) => freeVars(p, vars));
      note(vars, item);
      if (!ops.length) {
        let node = parts[0];
        let restrict = null;
        if (node.k === "bin" && node.op === "*" && node.a.k === "tuple") {
          restrict = node.b;
          node = node.a;
        }
        if (node.k === "tuple") {
          if (node.items.length !== 2) fail("A point has two coordinates, like (1, 2)");
          const [nx, ny] = restrict ? node.items.map((n) => ({ k: "bin", op: "*", a: n, b: restrict })) : node.items;
          if (vars.has("t")) {
            if (!only(vars, ["t"])) fail("A curve (x(t), y(t)) can use only t and sliders");
            item.kind = "parametric";
          } else {
            if (has(vars, RESERVED)) fail("A point’s coordinates are numbers or sliders; for a curve use t");
            item.kind = "point";
            item.dragX = node.items[0].k === "var" && params.has(node.items[0].n) ? node.items[0].n : null;
            item.dragY = node.items[1].k === "var" && params.has(node.items[1].n) ? node.items[1].n : null;
          }
          item.fx = cf(nx);
          item.fy = cf(ny);
          return;
        }
        if (has(vars, ["y", "t", "theta", "r"])) fail("Write it as an equation, like y = …");
        item.f = cf(node);
        item.kind = vars.has("x") ? "explicit" : "value";
        item.axis = "y";
        return;
      }
      if (ops.every((op) => op === "=")) {
        if (ops.length > 1) fail("Only one = per line");
        const [l, r] = parts;
        for (const [side, other] of [[l, r], [r, l]]) {
          const ov = freeVars(other);
          if (isVar(side, "y") && only(ov, ["x"])) {
            item.kind = "explicit";
            item.axis = "y";
            item.f = cf(other);
            return;
          }
          if (isVar(side, "x") && only(ov, ["y"])) {
            item.kind = "explicit";
            item.axis = "x";
            item.f = cf(other);
            return;
          }
          if (isVar(side, "r") && only(ov, ["theta"])) {
            item.kind = "polar";
            item.f = cf(other);
            return;
          }
        }
        if (isVar(l, "t") || isVar(l, "theta")) fail(l.n + " is what curves are drawn over; call this something else");
        if (!only(vars, ["x", "y"])) fail("An equation uses x, y and sliders; for curves over t or θ, see the examples");
        if (!has(vars, ["x", "y"])) fail("There’s no x or y to draw");
        const lf = cf(l), rf = cf(r);
        item.kind = "implicit";
        item.F = (env) => lf(env) - rf(env);
        return;
      }
      if (ops.includes("=")) fail("Use either = or <, >, ≤, ≥ in one line");
      if (!only(vars, ["x", "y"])) fail("An inequality uses x, y and sliders");
      if (!has(vars, ["x", "y"])) fail("There’s no x or y to shade");
      if (ops.length === 1) {
        const [l, r] = parts;
        const op = ops[0];
        const strict = op === "<" || op === ">";
        const less = op === "<" || op === "<=";
        for (const [axis, other] of [["y", "x"], ["x", "y"]]) {
          if (isVar(l, axis) && only(freeVars(r), [other])) {
            Object.assign(item, { kind: "region", axis, f: cf(r), side: less ? "below" : "above", strict });
            return;
          }
          if (isVar(r, axis) && only(freeVars(l), [other])) {
            Object.assign(item, { kind: "region", axis, f: cf(l), side: less ? "above" : "below", strict });
            return;
          }
        }
      }
      item.kind = "region";
      item.axis = null;
      item.comps = ops.map((op, i) => {
        const lf = cf(parts[i]), rf = cf(parts[i + 1]);
        const test = COMPARE[op];
        return { g: (env) => lf(env) - rf(env), test: (env) => test(lf(env), rf(env)), strict: op === "<" || op === ">" };
      });
    }
    return { items, params: [...params], missing: [...missing], fns: Object.keys(callable) };
  }
  function paramValues(analysis, values) {
    const env = {};
    const pending = analysis.items.filter((it) => it.kind === "param");
    for (const it of pending) {
      if (it.slider) env[it.name] = values && typeof values[it.name] === "number" ? values[it.name] : it.literal;
    }
    let rest = pending.filter((it) => !it.slider);
    const passes = rest.length + 1;
    for (let pass = 0; pass < passes && rest.length; pass++) {
      rest = rest.filter((it) => {
        const v = it.f(env);
        if (Number.isNaN(v) && [...freeVars(it.value)].some((n) => env[n] === void 0)) return true;
        env[it.name] = v;
        return false;
      });
    }
    return env;
  }
  return { tokenize, parseStatement, freeVars, compile, analyze, paramValues, normalize, RESERVED };
}

// client/src/utils/graphRuntime.js
function graphRuntime(P, config) {
  let C = config;
  const THEMES = {
    light: {
      axis: "#2b2b2b",
      major: "rgba(0,0,0,0.14)",
      minor: "rgba(0,0,0,0.055)",
      text: "#3a3a3a",
      halo: "rgba(255,255,255,0.85)",
      panel: "rgba(255,255,255,0.94)",
      panelText: "#222",
      border: "rgba(0,0,0,0.14)",
      accent: "#2d70b3"
    },
    dark: {
      axis: "rgba(255,255,255,0.85)",
      major: "rgba(255,255,255,0.16)",
      minor: "rgba(255,255,255,0.06)",
      text: "rgba(255,255,255,0.8)",
      halo: "rgba(18,18,28,0.8)",
      panel: "rgba(24,24,36,0.9)",
      panelText: "#eee",
      border: "rgba(255,255,255,0.16)",
      accent: "#6fa8ff"
    }
  };
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
  const MATH_FONT = '"Cambria Math", "Latin Modern Math", "STIX Two Math", "Times New Roman", serif';
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;left:0;top:0;display:block;touch-action:none;";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0;
  let theme = THEMES.light;
  let analysis = null;
  let values = {};
  let view = null;
  let step = 0;
  let hover = null;
  let playing = {};
  let snapshotSent = false;
  let frame = 0;
  let shownScale = 1;
  const density = () => Math.min(4, Math.max(1, (window.devicePixelRatio || 1) * (C.print ? Math.max(shownScale, 3) : shownScale)));
  const clamp2 = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const copyView = (v) => ({ xMin: +v.xMin, xMax: +v.xMax, yMin: +v.yMin, yMax: +v.yMax });
  const sameView = (a, b) => ["xMin", "xMax", "yMin", "yMax"].every((k) => Math.abs(a[k] - b[k]) < 1e-9 * Math.max(1, Math.abs(a[k])));
  function setConfig(next, keepState) {
    C = next;
    theme = THEMES[C.theme] || THEMES.light;
    analysis = P.analyze(C.expressions || []);
    const kept = values;
    values = {};
    for (const it of analysis.items) {
      if (it.kind === "param" && it.slider) values[it.name] = keepState && typeof kept[it.name] === "number" && !C.editor ? kept[it.name] : it.literal;
    }
    if (!keepState || C.editor) view = copyView(C.view);
    playing = {};
    for (const e of C.expressions || []) {
      const it = analysis.items.find((i) => i.id === e.id);
      if (it && it.kind === "param" && it.slider && e.slider && e.slider.play && !C.print) playing[it.name] = 1;
    }
    step = C.showAll ? Infinity : step;
    buildPanel();
    request();
  }
  function shown() {
    if (C.equalScale === false || !W || !H) return view;
    const half = (view.xMax - view.xMin) * H / W / 2;
    const mid = (view.yMin + view.yMax) / 2;
    return { xMin: view.xMin, xMax: view.xMax, yMin: mid - half, yMax: mid + half };
  }
  function exprOf(it) {
    return (C.expressions || []).find((e) => e.id === it.id) || {};
  }
  function visible(it) {
    const e = exprOf(it);
    if (e.hidden) return false;
    return !(e.step > 0) || e.step <= step;
  }
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
    return { step: nice * p, minor: nice === 2 ? 4 : 5 };
  }
  function ticksBetween(lo, hi, stepSize) {
    if (!(stepSize > 0) || !isFinite(lo) || !isFinite(hi)) return [];
    const first = Math.ceil(lo / stepSize), last2 = Math.floor(hi / stepSize);
    if (!(last2 - first < 500)) return [];
    const out = [];
    for (let i = 0; i <= last2 - first; i++) out.push((first + i) * stepSize);
    return out;
  }
  function tickLabel(v, stepSize) {
    if (Math.abs(v) < stepSize * 1e-6) return "0";
    if (stepSize >= 1e6 || stepSize < 1e-5) return v.toExponential(2).replace(/\.?0+e/, "e").replace("-", "−");
    const decimals = Math.max(0, -Math.floor(Math.log10(stepSize) + 1e-9));
    return (Math.round(v / stepSize) * stepSize).toFixed(decimals).replace("-", "−");
  }
  function fmt(v) {
    if (!isFinite(v)) return "undefined";
    if (v !== 0 && (Math.abs(v) >= 1e6 || Math.abs(v) < 1e-4)) return v.toExponential(3).replace("-", "−");
    return String(parseFloat(v.toPrecision(4))).replace("-", "−");
  }
  function prettyName(name) {
    const greek = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", lambda: "λ", sigma: "σ", omega: "ω", phi: "φ", rho: "ρ", theta: "θ" };
    const i = name.indexOf("_");
    const base = i < 0 ? name : name.slice(0, i);
    return { base: greek[base] || base, sub: i < 0 ? "" : name.slice(i + 1) };
  }
  let X0, X1, Y0, Y1;
  const sx = (x) => (x - X0) / (X1 - X0) * W;
  const sy = (y) => H - (y - Y0) / (Y1 - Y0) * H;
  const wx = (px) => X0 + px / W * (X1 - X0);
  const wy = (py) => Y0 + (H - py) / H * (Y1 - Y0);
  const clampPx = (v) => v > 1e5 ? 1e5 : v < -1e5 ? -1e5 : v;
  function env() {
    const e = P.paramValues(analysis, values);
    e.x = 0;
    e.y = 0;
    e.t = 0;
    e.theta = 0;
    return e;
  }
  function draw() {
    if (!W || !H || !analysis) return;
    const v = shown();
    X0 = v.xMin;
    X1 = v.xMax;
    Y0 = v.yMin;
    Y1 = v.yMax;
    ctx.clearRect(0, 0, W, H);
    if (C.background && C.background !== "transparent") {
      ctx.fillStyle = C.background;
      ctx.fillRect(0, 0, W, H);
    }
    const E = env();
    const ticks = gridAndAxes();
    const items = analysis.items.filter(visible);
    const each = (kinds, fn) => {
      for (const it of items) {
        if (!kinds.includes(it.kind)) continue;
        try {
          fn(it);
        } catch (e) {
          ctx.globalAlpha = 1;
          ctx.setLineDash([]);
        }
      }
    };
    each(["region"], (it) => drawRegion(it, E));
    each(["explicit", "function", "polar", "parametric", "implicit"], (it) => {
      if (it.kind === "explicit" || it.kind === "function" && it.graph) strokeRuns(explicitRuns(it.f, E, it.axis || "y"), exprOf(it));
      else if (it.kind === "polar") strokeRuns(curveRuns(it, E, "theta"), exprOf(it));
      else if (it.kind === "parametric") strokeRuns(curveRuns(it, E, "t"), exprOf(it));
      else if (it.kind === "implicit") strokeRuns(contour(it.F, E), exprOf(it));
    });
    axisNumbers(ticks);
    axisLabels();
    each(["point"], (it) => drawPoint(it, E));
    if (hover) drawHover();
    if (C.snapshotKey && !snapshotSent && analysis.items.length) {
      snapshotSent = true;
      try {
        parent.postMessage({ source: "parallax-embed", type: "snapshot", key: C.snapshotKey, dataUrl: canvas.toDataURL("image/png") }, "*");
      } catch (e) {
      }
    }
  }
  function gridAndAxes() {
    const px = 90;
    const tx = niceStep((X1 - X0) * px / W);
    const ty = C.equalScale === false ? niceStep((Y1 - Y0) * px / H) : tx;
    const line = (x0, y0, x1, y1) => {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    };
    if (C.grid !== false) {
      ctx.lineWidth = 1;
      for (const [t, major] of [[tx.step / tx.minor, false], [tx.step, true]]) {
        ctx.beginPath();
        ctx.strokeStyle = major ? theme.major : theme.minor;
        for (const v of ticksBetween(X0, X1, t)) {
          const p = Math.round(sx(v)) + 0.5;
          line(p, 0, p, H);
        }
        const u = major ? ty.step : ty.step / ty.minor;
        for (const v of ticksBetween(Y0, Y1, u)) {
          const p = Math.round(sy(v)) + 0.5;
          line(0, p, W, p);
        }
        ctx.stroke();
      }
    }
    if (C.axes !== false) {
      ctx.beginPath();
      ctx.strokeStyle = theme.axis;
      ctx.lineWidth = 1.25;
      if (X0 <= 0 && X1 >= 0) {
        const p = Math.round(sx(0)) + 0.5;
        line(p, 0, p, H);
      }
      if (Y0 <= 0 && Y1 >= 0) {
        const p = Math.round(sy(0)) + 0.5;
        line(0, p, W, p);
      }
      ctx.stroke();
    }
    return { tx, ty };
  }
  function haloText(text, x, y, align, baseline, font, color2) {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = theme.halo;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color2 || theme.text;
    ctx.fillText(text, x, y);
  }
  function axisNumbers({ tx, ty }) {
    if (C.axisNumbers === false || C.axes === false) return;
    const font = "12px " + FONT;
    const ay = Math.min(Math.max(sy(0), 2), H - 18);
    const ax = Math.min(Math.max(sx(0), 30), W - 4);
    const originShown = X0 <= 0 && X1 >= 0 && Y0 <= 0 && Y1 >= 0;
    for (const v of ticksBetween(X0, X1, tx.step)) {
      if (Math.abs(v) < tx.step * 1e-6) continue;
      const p = sx(v);
      if (p < 12 || p > W - 12) continue;
      haloText(tickLabel(v, tx.step), p, ay + 4, "center", "top", font);
    }
    for (const v of ticksBetween(Y0, Y1, ty.step)) {
      if (Math.abs(v) < ty.step * 1e-6) continue;
      const p = sy(v);
      if (p < 10 || p > H - 10) continue;
      haloText(tickLabel(v, ty.step), ax - 5, p, "right", "middle", font);
    }
    if (originShown) haloText("0", sx(0) - 5, sy(0) + 4, "right", "top", font);
  }
  function axisLabels() {
    const font = "italic 16px " + MATH_FONT;
    if (C.xLabel) haloText(C.xLabel, W - 8, Math.min(Math.max(sy(0), 20), H - 24) - 6, "right", "bottom", font);
    if (C.yLabel) haloText(C.yLabel, Math.min(Math.max(sx(0), 8), W - 40) + 8, 8, "left", "top", font);
  }
  function styleFor(e) {
    ctx.strokeStyle = e.color || "#c74440";
    ctx.lineWidth = e.width || 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const w = ctx.lineWidth;
    ctx.setLineDash(e.style === "dashed" ? [w * 3.2, w * 2.4] : e.style === "dotted" ? [0.01, w * 2.2] : []);
  }
  function strokeRuns(runs, e) {
    styleFor(e);
    ctx.beginPath();
    for (const run of runs) {
      if (run.length < 2) continue;
      ctx.moveTo(run[0][0], run[0][1]);
      for (let i = 1; i < run.length; i++) ctx.lineTo(run[i][0], run[i][1]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function explicitRuns(f, E, axis) {
    const horiz = axis === "y";
    const k = Math.min(2, density());
    const n = Math.ceil((horiz ? W : H) * k);
    const toWorld = horiz ? (px) => wx(px / k) : (px) => wy(px / k);
    const toPx = horiz ? sy : sx;
    const key = horiz ? "x" : "y";
    const at = (u) => {
      E[key] = u;
      return f(E);
    };
    const place = (u, val) => horiz ? [sx(u), clampPx(sy(val))] : [clampPx(sx(val)), sy(u)];
    const runs = [];
    let run = [], pu = 0, pv = NaN;
    for (let i = 0; i <= n; i++) {
      const u = toWorld(i);
      const val = at(u);
      if (!isFinite(val)) {
        if (run.length) {
          runs.push(run);
          run = [];
        }
        pv = NaN;
        continue;
      }
      if (isFinite(pv) && Math.abs(toPx(val) - toPx(pv)) > 24) {
        let a = pu, b = u, fa = pv, fb = val, broken = false;
        const left = [], right = [];
        for (let k2 = 0; k2 < 30; k2++) {
          const m = (a + b) / 2;
          const fm = at(m);
          if (!isFinite(fm)) {
            broken = true;
            break;
          }
          if (Math.abs(fm - fa) > Math.abs(fb - fm)) {
            b = m;
            fb = fm;
            right.push(place(m, fm));
          } else {
            a = m;
            fa = fm;
            left.push(place(m, fm));
          }
        }
        if (broken || Math.abs(toPx(fb) - toPx(fa)) > 2) {
          run.push(...left);
          runs.push(run);
          run = right.reverse();
        }
      }
      run.push(place(u, val));
      pv = val;
      pu = u;
    }
    if (run.length) runs.push(run);
    return runs;
  }
  function curveRuns(it, E, key) {
    const e = exprOf(it);
    const lo = isFinite(+e.min) && e.min !== "" && e.min != null ? +e.min : 0;
    const hi = isFinite(+e.max) && e.max !== "" && e.max != null ? +e.max : 2 * Math.PI;
    const n = Math.min(2e4, Math.max(800, Math.ceil(Math.abs(hi - lo) * 150)));
    const runs = [];
    let run = [];
    let prev = null;
    for (let i = 0; i <= n; i++) {
      E[key] = lo + (hi - lo) * i / n;
      let x, y;
      if (key === "t") {
        x = it.fx(E);
        y = it.fy(E);
      } else {
        const r = it.f(E);
        x = r * Math.cos(E.theta);
        y = r * Math.sin(E.theta);
      }
      if (!isFinite(x) || !isFinite(y)) {
        if (run.length) runs.push(run);
        run = [];
        prev = null;
        continue;
      }
      const p = [clampPx(sx(x)), clampPx(sy(y))];
      if (prev && Math.abs(p[0] - prev[0]) + Math.abs(p[1] - prev[1]) > W + H) {
        runs.push(run);
        run = [];
      }
      run.push(p);
      prev = p;
    }
    if (run.length) runs.push(run);
    return runs;
  }
  function contour(F, E, cellPx) {
    const cell = cellPx || clamp2(6 / density(), 2, 4);
    const nx = Math.ceil(W / cell) + 1, ny = Math.ceil(H / cell) + 1;
    const vals = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      E.y = wy(j * cell);
      for (let i = 0; i < nx; i++) {
        E.x = wx(i * cell);
        vals[j * nx + i] = F(E);
      }
    }
    const points = /* @__PURE__ */ new Map();
    const cross = (key, i0, j0, i1, j1) => {
      if (points.has(key)) return points.get(key);
      const a = vals[j0 * nx + i0], b = vals[j1 * nx + i1];
      const t = a / (a - b);
      const px = (i0 + (i1 - i0) * t) * cell, py = (j0 + (j1 - j0) * t) * cell;
      E.x = wx(px);
      E.y = wy(py);
      const fp = F(E);
      const p = Math.abs(fp) < 0.5 * (Math.abs(a) + Math.abs(b)) ? [px, py] : null;
      points.set(key, p);
      return p;
    };
    const edges = /* @__PURE__ */ new Map();
    const segs = [];
    const add = (k1, p1, k2, p2) => {
      if (!p1 || !p2) return;
      const s = segs.length;
      segs.push([k1, p1, k2, p2]);
      for (const k of [k1, k2]) {
        if (!edges.has(k)) edges.set(k, []);
        edges.get(k).push(s);
      }
    };
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = vals[j * nx + i], b = vals[j * nx + i + 1], c = vals[(j + 1) * nx + i + 1], d = vals[(j + 1) * nx + i];
        if (!(isFinite(a) && isFinite(b) && isFinite(c) && isFinite(d))) continue;
        const idx = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        const T = () => ["h" + (j * nx + i), cross("h" + (j * nx + i), i, j, i + 1, j)];
        const B = () => ["h" + ((j + 1) * nx + i), cross("h" + ((j + 1) * nx + i), i, j + 1, i + 1, j + 1)];
        const L = () => ["v" + (j * nx + i), cross("v" + (j * nx + i), i, j, i, j + 1)];
        const R = () => ["v" + (j * nx + i + 1), cross("v" + (j * nx + i + 1), i + 1, j, i + 1, j + 1)];
        const seg = (e1, e2) => {
          const p = e1(), q = e2();
          add(p[0], p[1], q[0], q[1]);
        };
        switch (idx) {
          case 1:
          case 14:
            seg(L, T);
            break;
          case 2:
          case 13:
            seg(T, R);
            break;
          case 3:
          case 12:
            seg(L, R);
            break;
          case 4:
          case 11:
            seg(R, B);
            break;
          case 6:
          case 9:
            seg(T, B);
            break;
          case 7:
          case 8:
            seg(L, B);
            break;
          case 5:
          case 10: {
            E.x = wx((i + 0.5) * cell);
            E.y = wy((j + 0.5) * cell);
            const centerPositive = F(E) > 0;
            if (idx === 5 === centerPositive) {
              seg(T, R);
              seg(B, L);
            } else {
              seg(L, T);
              seg(R, B);
            }
            break;
          }
        }
      }
    }
    const used = new Uint8Array(segs.length);
    const runs = [];
    const walk = (s, fromKey) => {
      const out = [];
      let key = fromKey;
      while (s >= 0 && !used[s]) {
        used[s] = 1;
        const [k1, p1, k2, p2] = segs[s];
        const [nextKey, p] = k1 === key ? [k2, p2] : [k1, p1];
        out.push(p);
        key = nextKey;
        s = (edges.get(key) || []).find((o) => !used[o]);
        if (s === void 0) s = -1;
      }
      return out;
    };
    const order = [...edges.entries()].filter(([, list]) => list.length === 1).map(([k, list]) => [list[0], k]);
    for (let s = 0; s < segs.length; s++) order.push([s, segs[s][0]]);
    for (const [s, key] of order) {
      if (used[s]) continue;
      const start = segs[s][0] === key ? segs[s][1] : segs[s][3];
      runs.push([start].concat(walk(s, key)));
    }
    return runs;
  }
  function fillStyle(e) {
    ctx.fillStyle = e.color || "#c74440";
    ctx.globalAlpha = 0.28;
  }
  function drawRegion(it, E) {
    const e = exprOf(it);
    if (it.axis) {
      const runs = explicitRuns(it.f, E, it.axis);
      const horiz = it.axis === "y";
      const edge = horiz ? it.side === "below" ? H + 2 : -2 : it.side === "below" ? -2 : W + 2;
      fillStyle(e);
      ctx.beginPath();
      for (const run of runs) {
        if (run.length < 2) continue;
        ctx.moveTo(run[0][0], run[0][1]);
        for (const p of run) ctx.lineTo(p[0], p[1]);
        const last2 = run[run.length - 1], first = run[0];
        if (horiz) {
          ctx.lineTo(last2[0], edge);
          ctx.lineTo(first[0], edge);
        } else {
          ctx.lineTo(edge, last2[1]);
          ctx.lineTo(edge, first[1]);
        }
        ctx.closePath();
      }
      ctx.fill();
      ctx.globalAlpha = 1;
      strokeRuns(runs, Object.assign({}, e, { style: it.strict ? "dashed" : e.style }));
      return;
    }
    const cell = clamp2(4.5 / density(), 1.5, 3);
    fillStyle(e);
    ctx.beginPath();
    for (let py = 0; py < H; py += cell) {
      E.y = wy(py + cell / 2);
      let start = -1;
      for (let px = 0; px <= W; px += cell) {
        E.x = wx(px + cell / 2);
        const inside = px < W && it.comps.every((c) => c.test(E));
        if (inside && start < 0) start = px;
        if (!inside && start >= 0) {
          ctx.rect(start, py, px - start, cell);
          start = -1;
        }
      }
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    for (const c of it.comps) strokeRuns(contour(c.g, E), Object.assign({}, e, { style: c.strict ? "dashed" : e.style }));
  }
  function pointAt(it, E) {
    const x = it.fx(E), y = it.fy(E);
    return isFinite(x) && isFinite(y) ? { x, y, px: sx(x), py: sy(y) } : null;
  }
  function drawPoint(it, E) {
    const p = pointAt(it, E);
    if (!p) return;
    const e = exprOf(it);
    ctx.beginPath();
    ctx.arc(p.px, p.py, (e.width || 2.5) + 2.5, 0, Math.PI * 2);
    ctx.fillStyle = e.color || "#c74440";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = theme.halo;
    ctx.stroke();
    if (it.dragX || it.dragY) {
      ctx.beginPath();
      ctx.arc(p.px, p.py, (e.width || 2.5) + 8, 0, Math.PI * 2);
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    const label = e.label ? e.label : e.showCoords ? "(" + fmt(p.x) + ", " + fmt(p.y) + ")" : "";
    if (label) haloText(label, p.px + 9, p.py - 7, "left", "bottom", "13px " + FONT, e.color);
  }
  function drawHover() {
    const { px, py, x, y, color: color2 } = hover;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = color2;
    ctx.fill();
    const text = "(" + fmt(x) + ", " + fmt(y) + ")";
    ctx.font = "12px " + FONT;
    const w = ctx.measureText(text).width + 12;
    const bx = Math.min(Math.max(px + 10, 2), W - w - 2), by = Math.max(py - 30, 2);
    ctx.fillStyle = theme.panel;
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(bx, by, w, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme.panelText;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, bx + 6, by + 11);
  }
  let last = 0;
  function request() {
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function tick(now) {
    frame = 0;
    const names = Object.keys(playing);
    if (names.length) {
      const dt = last ? Math.min(0.1, (now - last) / 1e3) : 0;
      last = now;
      for (const name of names) animate(name, dt);
      syncPanel();
      draw();
      request();
    } else {
      last = 0;
      draw();
    }
  }
  function sliderOf(name) {
    const it = analysis.items.find((i) => i.kind === "param" && i.name === name);
    const e = it ? exprOf(it) : {};
    const s = e.slider || {};
    const min = isFinite(+s.min) && s.min !== "" ? +s.min : -10;
    const max = isFinite(+s.max) && s.max !== "" ? +s.max : 10;
    const stepSize = isFinite(+s.step) && +s.step > 0 ? +s.step : 0;
    return { min: Math.min(min, max), max: Math.max(min, max), step: stepSize, speed: +s.speed > 0 ? +s.speed : 1 };
  }
  function animate(name, dt) {
    const s = sliderOf(name);
    if (s.max === s.min) return;
    let v = values[name] + playing[name] * (s.max - s.min) * dt * s.speed / 4;
    if (v > s.max) {
      v = s.max - (v - s.max);
      playing[name] = -1;
    }
    if (v < s.min) {
      v = s.min + (s.min - v);
      playing[name] = 1;
    }
    values[name] = Math.min(s.max, Math.max(s.min, v));
  }
  const panel = document.createElement("div");
  document.body.appendChild(panel);
  let rows = [];
  function buildPanel() {
    panel.innerHTML = "";
    rows = [];
    const params = analysis.items.filter((it) => it.kind === "param" && it.slider && !exprOf(it).hidden);
    const show = C.showSliders !== false && !C.print && params.length > 0;
    panel.style.cssText = "position:absolute;left:8px;bottom:8px;display:" + (show ? "flex" : "none") + ";flex-direction:column;gap:4px;padding:6px 10px;border-radius:8px;max-height:45%;overflow:auto;background:" + theme.panel + ";border:1px solid " + theme.border + ";color:" + theme.panelText + ";font:13px " + FONT + ";box-shadow:0 2px 10px rgba(0,0,0,0.15);";
    for (const it of params) {
      const s = sliderOf(it.name);
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;white-space:nowrap;";
      const play = document.createElement("button");
      play.type = "button";
      play.style.cssText = "width:22px;height:22px;border-radius:50%;border:1px solid " + theme.border + ";background:transparent;color:" + theme.panelText + ";cursor:pointer;font-size:10px;line-height:1;padding:0;flex:none;";
      play.title = "Play";
      play.addEventListener("click", () => {
        if (playing[it.name]) delete playing[it.name];
        else playing[it.name] = 1;
        syncPanel();
        request();
      });
      const label = document.createElement("span");
      const nm = prettyName(it.name);
      const base = document.createElement("i");
      base.textContent = nm.base;
      base.style.fontFamily = MATH_FONT;
      base.style.fontSize = "15px";
      label.appendChild(base);
      if (nm.sub) {
        const sub = document.createElement("sub");
        sub.textContent = nm.sub;
        label.appendChild(sub);
      }
      const value = document.createElement("span");
      value.style.cssText = "min-width:44px;font-variant-numeric:tabular-nums;";
      const range = document.createElement("input");
      range.type = "range";
      range.min = String(s.min);
      range.max = String(s.max);
      range.step = s.step ? String(s.step) : "any";
      range.style.cssText = "width:120px;accent-color:" + theme.accent + ";";
      range.addEventListener("input", () => {
        values[it.name] = +range.value;
        delete playing[it.name];
        syncPanel();
        request();
      });
      range.addEventListener("change", () => postEditor({ type: "param", name: it.name, value: values[it.name] }));
      row.append(play, label, document.createTextNode("="), value, range);
      panel.appendChild(row);
      rows.push({ name: it.name, play, value, range });
    }
    syncPanel();
  }
  function syncPanel() {
    for (const r of rows) {
      const v = values[r.name];
      r.value.textContent = fmt(v);
      if (document.activeElement !== r.range) r.range.value = String(v);
      r.play.textContent = playing[r.name] ? "❚❚" : "▶";
      r.play.title = playing[r.name] ? "Pause" : "Play";
    }
  }
  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "⟲";
  reset.title = "Back to the starting view";
  document.body.appendChild(reset);
  function styleReset() {
    const changed = view && C.view && !sameView(view, copyView(C.view));
    reset.style.cssText = "position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:16px;line-height:1;padding:0;background:" + theme.panel + ";border:1px solid " + theme.border + ";color:" + theme.panelText + ";display:" + (changed && !C.editor && !C.print ? "block" : "none") + ";";
  }
  reset.addEventListener("click", () => {
    view = copyView(C.view);
    styleReset();
    request();
  });
  function postEditor(msg) {
    if (!C.editor) return;
    try {
      parent.postMessage(Object.assign({ source: "parallax-graph" }, msg), "*");
    } catch (e) {
    }
  }
  let viewTimer = 0;
  function viewChanged() {
    styleReset();
    request();
    clearTimeout(viewTimer);
    viewTimer = setTimeout(() => postEditor({ type: "view", view: copyView(view) }), 200);
  }
  function zoom(factor, px, py) {
    const v = shown();
    const cx = v.xMin + px / W * (v.xMax - v.xMin);
    const cy = v.yMin + (H - py) / H * (v.yMax - v.yMin);
    const span = Math.min(view.xMax - view.xMin, view.yMax - view.yMin);
    const least = 1e-12 * Math.max(1, Math.abs(cx), Math.abs(cy));
    factor = Math.min(Math.max(factor, least / span), 1e12 / Math.max(view.xMax - view.xMin, view.yMax - view.yMin));
    if (!(factor > 0) || !isFinite(factor)) return;
    view = {
      xMin: cx - (cx - view.xMin) * factor,
      xMax: cx + (view.xMax - cx) * factor,
      yMin: cy - (cy - view.yMin) * factor,
      yMax: cy + (view.yMax - cy) * factor
    };
    viewChanged();
  }
  const pointers = /* @__PURE__ */ new Map();
  let drag = null;
  function pos(ev) {
    const r = canvas.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  }
  function snap(name, v) {
    const s = sliderOf(name);
    return s.step ? Math.round(v / s.step) * s.step : parseFloat(v.toPrecision(6));
  }
  canvas.addEventListener("pointerdown", (ev) => {
    const [px, py] = pos(ev);
    pointers.set(ev.pointerId, [px, py]);
    canvas.setPointerCapture(ev.pointerId);
    hover = null;
    if (pointers.size === 2) {
      drag = { kind: "pinch", view: copyView(view), start: [...pointers.values()] };
      return;
    }
    const E = env();
    for (const it of analysis.items) {
      if (it.kind !== "point" || !(it.dragX || it.dragY) || !visible(it)) continue;
      const p = pointAt(it, E);
      if (p && Math.hypot(p.px - px, p.py - py) < 14) {
        drag = { kind: "point", it };
        return;
      }
    }
    if (!C.lockView) drag = { kind: "pan", view: copyView(view), start: [px, py], shown: shown() };
  });
  canvas.addEventListener("pointermove", (ev) => {
    const [px, py] = pos(ev);
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, [px, py]);
    if (!drag) {
      trace(px, py);
      return;
    }
    if (drag.kind === "point") {
      const v = shown();
      if (drag.it.dragX) values[drag.it.dragX] = snap(drag.it.dragX, v.xMin + px / W * (v.xMax - v.xMin));
      if (drag.it.dragY) values[drag.it.dragY] = snap(drag.it.dragY, v.yMin + (H - py) / H * (v.yMax - v.yMin));
      if (drag.it.dragX) delete playing[drag.it.dragX];
      if (drag.it.dragY) delete playing[drag.it.dragY];
      syncPanel();
      request();
    } else if (drag.kind === "pan") {
      const dx = (px - drag.start[0]) / W * (drag.shown.xMax - drag.shown.xMin);
      const dy = (py - drag.start[1]) / H * (drag.shown.yMax - drag.shown.yMin);
      view = { xMin: drag.view.xMin - dx, xMax: drag.view.xMax - dx, yMin: drag.view.yMin + dy, yMax: drag.view.yMax + dy };
      viewChanged();
    } else if (drag.kind === "pinch" && pointers.size === 2 && !C.lockView) {
      const [a, b] = [...pointers.values()];
      const [a0, b0] = drag.start;
      const d0 = Math.hypot(a0[0] - b0[0], a0[1] - b0[1]), d1 = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d0 > 10 && d1 > 10) {
        view = copyView(drag.view);
        zoom(d0 / d1, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
    }
  });
  const end = (ev) => {
    pointers.delete(ev.pointerId);
    if (drag && drag.kind === "point") {
      for (const name of [drag.it.dragX, drag.it.dragY]) if (name) postEditor({ type: "param", name, value: values[name] });
    }
    if (!pointers.size) drag = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", () => {
    if (hover) {
      hover = null;
      request();
    }
  });
  canvas.addEventListener("wheel", (ev) => {
    if (C.lockView) return;
    ev.preventDefault();
    const [px, py] = pos(ev);
    zoom(Math.exp(ev.deltaY * 15e-4), px, py);
  }, { passive: false });
  canvas.addEventListener("dblclick", (ev) => {
    if (C.lockView) return;
    const [px, py] = pos(ev);
    zoom(0.5, px, py);
  });
  function trace(px, py) {
    let best = null;
    const E = env();
    for (const it of analysis.items) {
      const curve = it.kind === "explicit" || it.kind === "function" && it.graph;
      if (!curve || !visible(it)) continue;
      const e = exprOf(it);
      const horiz = (it.axis || "y") === "y";
      const u = horiz ? wx(px) : wy(py);
      E[horiz ? "x" : "y"] = u;
      const val = it.f(E);
      if (!isFinite(val)) continue;
      const d = horiz ? Math.abs(sy(val) - py) : Math.abs(sx(val) - px);
      if (d < 10 && (!best || d < best.d)) {
        best = horiz ? { d, px, py: sy(val), x: u, y: val, color: e.color } : { d, px: sx(val), py, x: val, y: u, color: e.color };
      }
    }
    const had = !!hover;
    hover = best;
    canvas.style.cursor = best ? "crosshair" : C.lockView ? "default" : "grab";
    if (best || had) request();
  }
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return;
    W = w;
    H = h;
    const d = density();
    canvas.width = Math.round(w * d);
    canvas.height = Math.round(h * d);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(d, 0, 0, d, 0, 0);
    draw();
  }
  window.addEventListener("resize", resize);
  const NAV_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", " ", "Home", "End"];
  window.addEventListener("keydown", (ev) => {
    if (C.editor || ev.altKey || ev.ctrlKey || ev.metaKey || !NAV_KEYS.includes(ev.key)) return;
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
    ev.preventDefault();
    try {
      parent.postMessage({ source: "parallax-graph", type: "key", key: ev.key, shift: ev.shiftKey }, "*");
    } catch (e) {
    }
  });
  window.addEventListener("message", (ev) => {
    if (ev.source !== window.parent) return;
    const data = ev.data;
    if (data === "parallax-resize") {
      resize();
      return;
    }
    if (!data || typeof data !== "object") return;
    if (data.type === "scale" && typeof data.scale === "number" && data.scale > 0) {
      shownScale = clamp2(data.scale, 0.1, 8);
      resize();
      return;
    }
    if (data.source === "parallax-deck" && data.type === "graph-step" && typeof data.step === "number" && !C.showAll) {
      step = data.step;
      request();
    } else if (data.source === "parallax-graph-editor" && data.type === "config" && data.config) {
      setConfig(Object.assign({}, data.config, { editor: true, showAll: true }), true);
      styleReset();
    }
  });
  setConfig(C, false);
  styleReset();
  canvas.style.cursor = C.lockView ? "default" : "grab";
  resize();
}

// client/src/utils/graphPage.js
var GRAPH_FIELDS = ["expressions", "view", "equalScale", "grid", "axes", "axisNumbers", "xLabel", "yLabel", "theme", "background", "showSliders", "lockView"];
var DEFAULT_VIEW = { xMin: -10, xMax: 10, yMin: -7, yMax: 7 };
function validView(v) {
  const n = (k) => v && isFinite(+v[k]) ? +v[k] : DEFAULT_VIEW[k];
  let { xMin, xMax, yMin, yMax } = { xMin: n("xMin"), xMax: n("xMax"), yMin: n("yMin"), yMax: n("yMax") };
  if (!(xMax > xMin)) ({ xMin, xMax } = DEFAULT_VIEW);
  if (!(yMax > yMin)) ({ yMin, yMax } = DEFAULT_VIEW);
  return { xMin, xMax, yMin, yMax };
}
function graphConfig(el, { snapshotKey = null, print = false, editor = false, showAll = false } = {}) {
  const config = {};
  for (const key of GRAPH_FIELDS) if (el[key] !== void 0) config[key] = el[key];
  config.expressions = Array.isArray(el.expressions) ? el.expressions : [];
  config.view = validView(el.view);
  return { ...config, snapshotKey, print, editor, showAll: showAll || print || editor };
}
var pageCode = null;
function graphPageHtml(el, opts = {}) {
  const config = graphConfig(el, opts);
  if (!pageCode) {
    pageCode = `(${graphRuntime.toString()})((${createMathParser.toString()})(), `.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "< !--");
  }
  const code = `${pageCode}${JSON.stringify(config).replace(/</g, "\\u003c")});`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;-webkit-user-select:none;user-select:none}</style></head><body><script>${code}</script></body></html>`;
}
function graphSteps(el) {
  const steps = /* @__PURE__ */ new Set();
  for (const e of el?.expressions || []) {
    const n = Number(e?.step);
    if (Number.isInteger(n) && n >= 1 && n <= 1e3 && !e.hidden) steps.add(n);
  }
  return [...steps].sort((a, b) => a - b);
}
function graphStepMarkers(slide) {
  let html = "";
  for (const el of slide?.elements || []) {
    if (el.type !== "graph") continue;
    const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    for (const n of graphSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-graph-step="${id}" data-graph-step-at="${n}" aria-hidden="true" style="position:absolute;"></span>`;
  }
  return html;
}
function hasGraphs(presentation) {
  return (presentation?.slides || []).some((s) => (s.elements || []).some((el) => el.type === "graph"));
}
var GRAPH_DECK_SCRIPT = `
    (function() {
      function stepOf(frame) {
        var slide = frame.closest('section'), id = frame.getAttribute('data-graph-id'), n = 0;
        if (!slide) return 0;
        slide.querySelectorAll('.fragment[data-graph-step]').forEach(function(m) {
          if (m.getAttribute('data-graph-step') === id && m.classList.contains('visible')) n = Math.max(n, +m.getAttribute('data-graph-step-at') || 0);
        });
        return n;
      }
      function send(frame) {
        try { frame.contentWindow.postMessage({ source: 'parallax-deck', type: 'graph-step', step: stepOf(frame) }, '*'); } catch (e) {}
      }
      function sendAll() { document.querySelectorAll('iframe[data-graph-id]').forEach(send); }
      document.querySelectorAll('iframe[data-graph-id]').forEach(function(frame) {
        frame.addEventListener('load', function() { send(frame); });
      });
      ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden'].forEach(function(name) { Reveal.on(name, sendAll); });
      window.addEventListener('message', function(e) {
        var d = e.data;
        if (!d || d.source !== 'parallax-graph' || d.type !== 'key') return;
        var fromGraph = Array.prototype.some.call(document.querySelectorAll('iframe[data-graph-id]'), function(f) { return f.contentWindow === e.source; });
        if (!fromGraph) return;
        var k = d.key;
        if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !d.shift)) Reveal.next();
        else if (k === 'ArrowLeft' || k === 'PageUp' || (k === ' ' && d.shift)) Reveal.prev();
        else if (k === 'ArrowDown') Reveal.down();
        else if (k === 'ArrowUp') Reveal.up();
        else if (k === 'Home') Reveal.slide(0);
        else if (k === 'End') Reveal.slide(Number.MAX_VALUE);
      });
    })();
`;

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

// client/src/utils/text3d.js
var TEXT3D_DEFAULTS = {
  content: "3D Text",
  fontSize: 96,
  fontWeight: "800",
  fontStyle: "normal",
  letterSpacing: 0,
  lineHeight: 1.1,
  textAlign: "center",
  color: "#ffffff",
  sideColor: "#6366f1",
  sideShade: 0.6,
  depth: 0,
  rotateX: 16,
  rotateY: -26,
  perspective: 800
};
var TEXT3D_LIMITS = {
  depth: [0, 150],
  rotateX: [-80, 80],
  rotateY: [-80, 80],
  perspective: [150, 3e3],
  fontSize: [8, 400],
  letterSpacing: [-50, 200],
  lineHeight: [0.5, 4],
  sideShade: [0, 1]
};
var MAX_LAYERS = 60;
var WEIGHTS = /^(normal|bold|[1-9]00)$/;
var STYLES = ["normal", "italic", "oblique"];
var ALIGNS = { left: "flex-start", center: "center", right: "flex-end" };
var HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
function text3dSettings(el, fallbackFont) {
  const num2 = (key) => {
    const n = Number(el[key]);
    const [lo, hi] = TEXT3D_LIMITS[key];
    return Number.isFinite(n) && el[key] !== null && el[key] !== "" ? Math.min(hi, Math.max(lo, n)) : TEXT3D_DEFAULTS[key];
  };
  const color2 = (key) => HEX.test(el[key] || "") ? el[key] : TEXT3D_DEFAULTS[key];
  const weight = String(el.fontWeight ?? "");
  return {
    depth: num2("depth"),
    rotateX: num2("rotateX"),
    rotateY: num2("rotateY"),
    perspective: num2("perspective"),
    fontSize: num2("fontSize"),
    letterSpacing: num2("letterSpacing"),
    lineHeight: num2("lineHeight"),
    sideShade: num2("sideShade"),
    color: color2("color"),
    sideColor: color2("sideColor"),
    fontWeight: WEIGHTS.test(weight) ? weight : TEXT3D_DEFAULTS.fontWeight,
    fontStyle: STYLES.includes(el.fontStyle) ? el.fontStyle : "normal",
    textAlign: ALIGNS[el.textAlign] ? el.textAlign : "center",
    fontFamily: String(el.fontFamily || fallbackFont || "sans-serif").replace(/[<>"`;{}\\\r\n]/g, "")
  };
}
var escapeText = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function darken(hex, amount) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const k = 1 - Math.min(1, Math.max(0, amount));
  return "#" + [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("");
}
var round2 = (v) => Math.round(v * 100) / 100 || 0;
function text3dLayers(el) {
  const s = text3dSettings(el);
  const n = Math.min(MAX_LAYERS, Math.ceil(s.depth));
  const layers = [];
  for (let i = n; i >= 1; i--) {
    const t = n === 1 ? 0 : (i - 1) / (n - 1);
    layers.push({ z: round2(-(i * s.depth) / n), color: darken(s.sideColor, s.sideShade * t) });
  }
  return layers;
}
function text3dResolution(el) {
  return text3dSettings(el).depth > 0 ? 2 : 4;
}
function text3dHtml(el, { fontFamily, resolution } = {}) {
  const s = text3dSettings(el, fontFamily);
  const k = Math.max(1, Math.round(Number(resolution) || text3dResolution(el)));
  const text = escapeText(el.content);
  const type = `font-family:${s.fontFamily};font-size:${round2(s.fontSize * k)}px;font-weight:${s.fontWeight};font-style:${s.fontStyle};letter-spacing:${round2(s.letterSpacing * k)}px;line-height:${s.lineHeight};text-align:${s.textAlign};white-space:pre-wrap;`;
  const layers = text3dLayers(el).map((l) => `<div aria-hidden="true" style="position:absolute;inset:0;color:${l.color};transform:translateZ(${round2(l.z * k)}px)">${text}</div>`).join("");
  const down = Math.round(1e6 / k) / 1e6;
  return `<div class="text3d" style="position:relative;width:100%;height:100%;perspective:${s.perspective}px"><div style="position:absolute;left:0;top:0;width:${100 * k}%;height:${100 * k}%;transform-origin:0 0;transform:scale3d(${down},${down},${down});transform-style:preserve-3d;display:flex;align-items:center;justify-content:${ALIGNS[s.textAlign]};${type}"><div style="position:relative;transform-style:preserve-3d;transform:rotateX(${s.rotateX}deg) rotateY(${s.rotateY}deg)">${layers}<div style="position:relative;color:${s.color}">${text}</div></div></div></div>`;
}
function text3dShadowFilter(el) {
  if (!(el.shadowBlur || el.shadowX || el.shadowY)) return "";
  const px = (v) => Number(v) || 0;
  const color2 = String(el.shadowColor || "rgba(0,0,0,0.5)").replace(/[<>"`;{}\\\r\n]/g, "");
  return `drop-shadow(${px(el.shadowX)}px ${px(el.shadowY)}px ${Math.max(0, px(el.shadowBlur))}px ${color2})`;
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
  const widthOf = (section) => Number(section.getAttribute("data-scroll-width")) || W;
  const heightOf = (section) => Number(section.getAttribute("data-scroll-height")) || H;
  const sideways = (scroller) => scroller.getAttribute("data-scroll") === "x";
  function layerOf(section) {
    const surface = surfaceOf(section);
    let svg = surface.querySelector(":scope > svg.pp-ink");
    if (!svg) {
      svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "pp-ink");
      svg.setAttribute("viewBox", `0 0 ${widthOf(section)} ${heightOf(section)}`);
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
    const round3 = (v) => Math.round(v * 10) / 10;
    return [round3((e.clientX - r.left) * widthOf(section) / r.width), round3((e.clientY - r.top) * heightOf(section) / r.height)];
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
    if (sideways(scroller)) scroller.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    else scroller.scrollTop += e.deltaY;
  }, { passive: false });
  let drag = null;
  shield.addEventListener("touchstart", (e) => {
    const scroller = scrollerOf(currentPage());
    const t = e.touches[0];
    drag = tool && penSeen && scroller && e.touches.length === 1 && t.touchType !== "stylus" ? { scroller, x: t.clientX, y: t.clientY, along: null } : null;
  }, { passive: true });
  shield.addEventListener("touchmove", (e) => {
    if (!drag) return;
    const t = e.touches[0], x = sideways(drag.scroller);
    if (drag.along === null) {
      const dx = t.clientX - drag.x, dy = t.clientY - drag.y;
      if (Math.hypot(dx, dy) < 8) return;
      drag.along = x ? Math.abs(dx) > Math.abs(dy) : Math.abs(dy) > Math.abs(dx);
    }
    if (!drag.along) return;
    e.stopPropagation();
    const rect = drag.scroller.getBoundingClientRect();
    if (x) drag.scroller.scrollLeft -= (t.clientX - drag.x) * drag.scroller.clientWidth / (rect.width || 1);
    else drag.scroller.scrollTop -= (t.clientY - drag.y) * drag.scroller.clientHeight / (rect.height || 1);
    drag.x = t.clientX;
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
function getCanvasWidth(slide, slideW, slideH) {
  if (getCanvasHeight(slide, slideH) > slideH) return slideW;
  const w = Math.round(Number(slide?.scrollWidth) || 0);
  return w > slideW ? Math.min(w, slideW * MAX_SCREENS) : slideW;
}
function scrollAxis(slide, slideW, slideH) {
  if (getCanvasHeight(slide, slideH) > slideH) return "y";
  if (getCanvasWidth(slide, slideW, slideH) > slideW) return "x";
  return null;
}
var isScrolling = (slide, slideW, slideH) => scrollAxis(slide, slideW, slideH) !== null;
var isPinned = (el) => el?.scrollBehavior === "pin";
function hasScrollingSlides(presentation) {
  const slideW = Number(presentation?.slideWidth) || 960;
  const slideH = Number(presentation?.slideHeight) || 540;
  return (presentation?.slides || []).some((slide) => isScrolling(slide, slideW, slideH));
}
function canvasBackgroundStyle(bg, url = (src) => src) {
  const value = (v) => String(v).replace(/[\\;{}<>"'`\r\n]/g, "").replace(/&/g, "&amp;");
  if (bg?.type === "gradient" && bg.gradient) return `background:${value(bg.gradient)};`;
  if (bg?.type === "image" && bg.image && !/^\s*(javascript|data|vbscript):/i.test(bg.image)) {
    return `background-image:url('${value(url(bg.image))}');background-size:${value(bg.size || "cover")};background-position:${value(bg.position || "center")};`;
  }
  return "";
}
function scrollingSlideBody({ slideW, slideH, canvasW = slideW, canvasH = slideH, axis = "y", elementsHtml, pinnedHtml, background = "" }) {
  const x = axis === "x";
  const mark = x ? ' data-scroll="x"' : "";
  return `      <div class="slide-scroller"${mark} data-prevent-swipe style="position:absolute;left:0;top:0;width:${slideW}px;height:${slideH}px;${x ? "overflow-x:auto;overflow-y:hidden;" : "overflow-x:hidden;overflow-y:auto;"}">
        <div class="slide-scroll-inner" style="position:relative;width:${canvasW}px;height:${canvasH}px;${background}">
${elementsHtml}
        </div>
      </div>
      <div class="slide-scroll-track"${mark} aria-hidden="true"><div class="slide-scroll-thumb"></div></div>${pinnedHtml ? `
${pinnedHtml}` : ""}`;
}
var SCROLLING_CSS = `
    .reveal .slides section > .slide-scroller { overflow-x:hidden !important; overflow-y:auto !important; overscroll-behavior:contain; touch-action:pan-y pinch-zoom; scrollbar-width:none; }
    .reveal .slides section > .slide-scroller[data-scroll="x"] { overflow-x:auto !important; overflow-y:hidden !important; touch-action:pan-x pinch-zoom; }
    .reveal .slides section > .slide-scroller::-webkit-scrollbar { display:none; }
    .reveal .slides section .slide-scroll-inner { overflow:visible; }
    .reveal .slides section > .slide-scroll-track { position:absolute; top:0; right:0; width:4px; height:100%; z-index:940; background:rgba(127,127,127,0.12); pointer-events:none; }
    .reveal .slides section > .slide-scroll-track[data-scroll="x"] { top:auto; bottom:0; left:0; right:auto; width:100%; height:4px; }
    .reveal .slides section .slide-scroll-thumb { position:absolute; left:0; top:0; width:100%; height:0; background:rgba(160,160,160,0.55); border-radius:2px; }
    .reveal .slides section > .slide-scroll-track[data-scroll="x"] > .slide-scroll-thumb { width:0; height:100%; }`;
var SCROLL_STEP_SOURCE = `
      var SCROLL_STEP = 0.85;
      function scrollStep(dir, view, step) {
        var end = view.start + view.size;
        if (dir > 0) {
          if (step && (step.pinned || step.start < end)) return 'reveal';
          if (view.start < view.max - 1) return Math.min(view.max, view.start + view.size * SCROLL_STEP);
          return 'reveal';
        }
        if (step && (step.pinned || (step.start < end && step.end > view.start))) return 'reveal';
        if (view.start > 1) return Math.max(0, view.start - view.size * SCROLL_STEP);
        return step ? 'skip' : 'reveal';
      }`;
var SCROLLING_SCRIPT = `
    // ── Scrolling slides ─────────────────────────────────────────────────
    (function() {${SCROLL_STEP_SOURCE}
      var reduceMotion = false;
      try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

      function scrollerOf(slide) { return slide ? slide.querySelector(':scope > .slide-scroller') : null; }
      function sideways(sc) { return sc.getAttribute('data-scroll') === 'x'; }
      // How far along the scroller is, how much it shows, and how far it can go
      function posOf(sc) { return sideways(sc) ? sc.scrollLeft : sc.scrollTop; }
      function sizeOf(sc) { return sideways(sc) ? sc.clientWidth : sc.clientHeight; }
      function maxOf(sc) { return sideways(sc) ? sc.scrollWidth - sc.clientWidth : sc.scrollHeight - sc.clientHeight; }
      function canScroll(sc) { return !!sc && maxOf(sc) > 1; }

      // Where the canvas is, or is on its way to while a step's smooth scroll runs
      function viewOf(sc) {
        var start = sc._to != null && Date.now() - sc._toAt < 800 ? sc._to : posOf(sc);
        return { start: start, size: sizeOf(sc), max: maxOf(sc) };
      }
      function scrollToPos(sc, pos) {
        pos = Math.max(0, Math.min(maxOf(sc), pos));
        sc._to = pos;
        sc._toAt = Date.now();
        var to = { behavior: reduceMotion ? 'auto' : 'smooth' };
        to[sideways(sc) ? 'left' : 'top'] = pos;
        sc.scrollTo(to);
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
      // Where elements are along the canvas, or pinned: true if any is on the screen
      function extentOf(els, sc) {
        var inner = sc.firstElementChild, x = sideways(sc), start = Infinity, end = -Infinity;
        for (var i = 0; i < els.length; i++) {
          var at = 0, node = els[i];
          while (node && node !== inner) { at += x ? node.offsetLeft : node.offsetTop; node = node.offsetParent; }
          if (node !== inner) return { pinned: true };
          start = Math.min(start, at);
          end = Math.max(end, at + (x ? els[i].offsetWidth : els[i].offsetHeight));
        }
        return els.length ? { start: start, end: end } : null;
      }

      // Forwards (1), back (-1), or neither (0) for a slide that scrolls
      // sideways (x) or down
      function keyDirection(e, x) {
        if (e.altKey || e.ctrlKey || e.metaKey) return 0;
        if (e.keyCode === 32) return e.shiftKey ? -1 : 1;
        if (e.shiftKey) return 0;
        if ([x ? 39 : 40, x ? 76 : 74, 34, 78].indexOf(e.keyCode) !== -1) return 1;
        if ([x ? 37 : 38, x ? 72 : 75, 33, 80].indexOf(e.keyCode) !== -1) return -1;
        return 0;
      }
      // Before reveal.js's own handler, which listens on the document too
      document.addEventListener('keydown', function(e) {
        var slide = Reveal.getCurrentSlide(), sc = scrollerOf(slide);
        if (!canScroll(sc)) return;
        var dir = keyDirection(e, sideways(sc));
        if (!dir) return;
        var active = document.activeElement;
        if (active && (active.isContentEditable || /^(input|textarea|select)$/i.test(active.tagName))) return;
        if (Reveal.getConfig().keyboard === false || Reveal.isOverview() || Reveal.isPaused()) return;
        var to = scrollStep(dir, viewOf(sc), extentOf(fragmentStep(slide, dir < 0), sc));
        if (to === 'reveal') return;
        e.preventDefault();
        e.stopPropagation();
        if (to === 'skip') Reveal.prev({ skipFragments: true });
        else scrollToPos(sc, to);
      }, true);

      // A fragment that appears off screen is scrolled into view
      Reveal.on('fragmentshown', function(e) {
        var sc = scrollerOf(Reveal.getCurrentSlide());
        if (!canScroll(sc)) return;
        var extent = extentOf(e.fragments || [e.fragment], sc);
        if (!extent || extent.pinned) return;
        var view = viewOf(sc), margin = 24;
        if (extent.start < view.start) scrollToPos(sc, extent.start - margin);
        else if (extent.end > view.start + view.size) scrollToPos(sc, Math.min(extent.start - margin, extent.end + margin - view.size));
      });

      function syncTrack(sc) {
        var thumb = sc.parentNode.querySelector(':scope > .slide-scroll-track > .slide-scroll-thumb');
        if (!thumb) return;
        var x = sideways(sc), size = sizeOf(sc), max = maxOf(sc), length = Math.max(24, size * size / (size + max));
        thumb.style[x ? 'width' : 'height'] = length + 'px';
        thumb.style[x ? 'left' : 'top'] = (max > 0 ? posOf(sc) / max * (size - length) : 0) + 'px';
      }
      var scrollers = document.querySelectorAll('.reveal .slides section > .slide-scroller');
      for (var i = 0; i < scrollers.length; i++) (function(sc) {
        sc.addEventListener('scroll', function() { syncTrack(sc); }, { passive: true });
        // Scrolled by hand, the canvas is no longer on its way to a step's position
        var byHand = function() { sc._to = null; };
        sc.addEventListener('wheel', byHand, { passive: true });
        sc.addEventListener('touchstart', byHand, { passive: true });
        // An up-and-down wheel turns a sideways canvas, until it reaches an end
        if (sideways(sc)) sc.addEventListener('wheel', function(e) {
          if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
          var by = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? sc.clientWidth : 1);
          if (by > 0 ? sc.scrollLeft >= maxOf(sc) - 1 : sc.scrollLeft <= 0) return;
          e.preventDefault();
          sc.scrollLeft += by;
        }, { passive: false });
      })(scrollers[i]);

      var lastIndex = -1;
      function land(e) {
        var index = Reveal.getSlides().indexOf(e.currentSlide), sc = scrollerOf(e.currentSlide);
        if (sc) {
          sc._to = null;
          var atEnd = index === lastIndex - 1;
          if (sideways(sc)) sc.scrollLeft = atEnd ? sc.scrollWidth : 0;
          else sc.scrollTop = atEnd ? sc.scrollHeight : 0;
          syncTrack(sc);
        }
        lastIndex = index;
      }
      Reveal.on('ready', land);
      Reveal.on('slidechanged', land);

      // The scroller keeps touches from reveal.js, so a sideways swipe on it
      // changes slides here, the way reveal.js's own swipes do. On a slide that
      // scrolls sideways the swipe scrolls the canvas, so it changes slides only
      // when it starts at the end it moves towards.
      var swipe = null;
      document.addEventListener('touchstart', function(e) {
        var sc = e.touches.length === 1 && e.target.closest && e.target.closest('.slide-scroller');
        swipe = sc ? { x: e.touches[0].clientX, y: e.touches[0].clientY, sc: sc, pos: sc.scrollLeft } : null;
      }, { passive: true });
      document.addEventListener('touchend', function(e) {
        if (!swipe) return;
        var t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y, sc = swipe.sc, pos = swipe.pos;
        swipe = null;
        var config = Reveal.getConfig();
        if (config.touch === false || Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 2) return;
        if (sideways(sc) && (dx < 0 ? pos < maxOf(sc) - 1 : pos > 1)) return;
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
var NO_CLICK_ACTION = /* @__PURE__ */ new Set(["html", "p5", "model", "graph", "video", "audio", "drawing"]);
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
var EMBED_SCALE_SCRIPT = `
    (function() {
      function send(frame) {
        var s = Reveal.getScale && Reveal.getScale();
        if (!(s > 0)) return;
        try { frame.contentWindow.postMessage({ source: 'parallax-deck', type: 'scale', scale: s }, '*'); } catch (e) {}
      }
      function sendAll() { document.querySelectorAll('iframe[data-deck-scale]').forEach(send); }
      document.querySelectorAll('iframe[data-deck-scale]').forEach(function(frame) {
        frame.addEventListener('load', function() { send(frame); });
      });
      Reveal.on('ready', sendAll);
      Reveal.on('resize', sendAll);
    })();
`;
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
    const canvasW = getCanvasWidth(slide, slideW, slideH);
    const axis = scrollAxis(slide, slideW, slideH);
    const scrolling = axis !== null;
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
      if (el.type === "graph") {
        const srcdoc = graphPageHtml(el).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        const graphId = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${srcdoc}" data-graph-id="${graphId}" data-deck-scale style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no" title="Graph"></iframe></div>`;
      }
      if (el.type === "model") {
        const srcdoc = modelViewerHtml(el, { src: absoluteSrc(el.src) }).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${srcdoc}" data-deck-scale style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no" title="3D model"></iframe></div>`;
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
      if (el.type === "text3d") {
        const shadow = text3dShadowFilter(el);
        const t3Style = style.replace("overflow:hidden;", "overflow:visible;").replace(shadowStyle, "") + (shadow ? `filter:${shadow};` : "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${t3Style}">${text3dHtml(el, { fontFamily: globalFont })}</div>`;
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
        return `<svg${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="position:absolute;left:0;top:0;width:${canvasW}px;height:${canvasH}px;overflow:visible;pointer-events:none;z-index:${el.zIndex || 1};">${svgPaths}</svg>`;
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
    const scrollAttr = axis === "x" ? ` data-scroll-width="${canvasW}"` : axis === "y" ? ` data-scroll-height="${canvasH}"` : "";
    const canvasBg = scrolling ? canvasBackgroundStyle(slide.background, absoluteSrc) : "";
    const bodyHtml = (scrolling ? scrollingSlideBody({ slideW, slideH, canvasW, canvasH, axis, elementsHtml, pinnedHtml, background: canvasBg }) : elementsHtml) + stepMarkers(slide) + graphStepMarkers(slide);
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
${CLICK_ACTION_SCRIPT}${scrollingDeck ? SCROLLING_SCRIPT : ""}${hasGraphs(presentation) ? GRAPH_DECK_SCRIPT : ""}${(presentation.slides || []).some((s) => (s.elements || []).some((el) => el.type === "graph" || el.type === "model")) ? EMBED_SCALE_SCRIPT : ""}

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

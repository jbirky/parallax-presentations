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
function formatCitation(entry, style, index) {
  const authors = parseAuthors(entry.author);
  const year = entry.year || "";
  if (style === "author-year") {
    return `(${formatAuthorsShort(authors)}, ${year})`;
  }
  return `[${index + 1}]`;
}

// client/src/utils/citationIndex.js
var BARE_NUMBER_RE = /\[(\d{1,3})\]/g;
var OPEN_TAG_RE = /^<(sup|span)(?=[\s/>])/i;
var CITE_ATTR_RE = /(?:^|[\s"'])data-cite="([^"]*)"/i;
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
var escapeText = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var unescapeAttr = (text) => text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
function allIndexesOf(haystack, needle) {
  if (!needle) return [];
  const found = [];
  const re = new RegExp(escapeRegExp(needle), "g");
  let m;
  while ((m = re.exec(haystack)) !== null) found.push(m.index);
  return found;
}
function scanTags(html) {
  const tags = [];
  let lt = html.indexOf("<");
  while (lt !== -1) {
    const gt = html.indexOf(">", lt);
    if (gt === -1) break;
    const start = html.lastIndexOf("<", gt);
    tags.push({ from: lt, start, end: gt + 1, text: html.slice(start, gt + 1) });
    lt = html.indexOf("<", gt + 1);
  }
  return tags;
}
function openTag(tag) {
  const m = OPEN_TAG_RE.exec(tag.text);
  if (!m) return null;
  const cite = CITE_ATTR_RE.exec(tag.text);
  return { name: m[1].toLowerCase(), key: cite ? unescapeAttr(cite[1]) : null };
}
var isClose = (tag, name) => tag.text.toLowerCase() === `</${name}>`;
function nextCloses(tags) {
  const next = { sup: new Array(tags.length), span: new Array(tags.length) };
  let sup = -1, span = -1;
  for (let i = tags.length - 1; i >= 0; i--) {
    if (isClose(tags[i], "sup")) sup = i;
    if (isClose(tags[i], "span")) span = i;
    next.sup[i] = sup;
    next.span[i] = span;
  }
  return next;
}
function keyedMarkers(html) {
  if (!html || html.indexOf("data-cite") === -1) return [];
  const tags = scanTags(html), closes = nextCloses(tags), found = [];
  for (let i = 0; i < tags.length; i++) {
    const open = openTag(tags[i]);
    if (!open || open.key === null) continue;
    const c = closes[open.name][i + 1] ?? -1;
    if (c === -1) continue;
    found.push({ start: tags[i].start, end: tags[c].end, key: open.key, inner: [tags[i].end, tags[c].start] });
    i = c;
  }
  return found;
}
function replaceRanges(html, ranges, replace) {
  if (!ranges.length) return html;
  let out = "", at = 0;
  for (const r of ranges) {
    out += html.slice(at, r.start) + replace(r);
    at = r.end;
  }
  return out + html.slice(at);
}
var ENTITIES = { "&amp;": "&", "&nbsp;": " ", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
function blank(length) {
  return " ".repeat(length);
}
function visibleText(html, onMarker) {
  let out = replaceRanges(html, keyedMarkers(html), (m) => {
    onMarker(m.key, m.start);
    return blank(m.end - m.start);
  });
  out = replaceRanges(out, scanTags(out).map((t) => ({ start: t.from, end: t.end })), (r) => blank(r.end - r.start));
  out = out.replace(/&[a-z#0-9]+;/gi, (match) => {
    const decoded = ENTITIES[match.toLowerCase()];
    return decoded ? decoded + blank(match.length - decoded.length) : blank(match.length);
  });
  return out;
}
function findCitations(text, bibliography = []) {
  if (!text) return [];
  const byKey = new Map(bibliography.map((e) => [e.key, e]));
  const hits = [];
  const visible = visibleText(text, (key, pos) => {
    if (byKey.has(key)) hits.push({ pos, key });
  });
  let m;
  BARE_NUMBER_RE.lastIndex = 0;
  while ((m = BARE_NUMBER_RE.exec(visible)) !== null) {
    const entry = bibliography[parseInt(m[1], 10) - 1];
    if (entry) hits.push({ pos: m.index, key: entry.key });
  }
  for (const entry of bibliography) {
    for (const pos of allIndexesOf(visible, entry.key)) hits.push({ pos, key: entry.key });
    const short = formatAuthorsShort(parseAuthors(entry.author));
    for (const pos of allIndexesOf(visible, short)) hits.push({ pos, key: entry.key });
  }
  return hits.sort((a, b) => a.pos - b.pos);
}
function citedKeysInPresentationOrder(bibliography, slides) {
  const seen = /* @__PURE__ */ new Set();
  const keys = [];
  for (const slide of slides || []) {
    const elements = [...slide.elements || []].sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0));
    for (const el of elements) {
      const text = [el.content, el.citationText].filter(Boolean).join("\n");
      for (const { key } of findCitations(text, bibliography)) {
        if (!seen.has(key)) {
          seen.add(key);
          keys.push(key);
        }
      }
    }
  }
  return keys;
}
function alphabeticalSortKey(entry) {
  const authors = parseAuthors(entry.author);
  const lead = authors[0]?.last || entry.author || entry.title || "";
  return [lead.toLowerCase(), entry.year || "", (entry.title || "").toLowerCase()];
}
function buildCitationIndex(presentation) {
  const bibliography = presentation?.bibliography || [];
  const order = presentation?.citationOrder === "alphabetical" ? "alphabetical" : "presentation";
  const style = presentation?.citationStyle || "numbered";
  const citedKeys = citedKeysInPresentationOrder(bibliography, presentation?.slides || []);
  const byKey = new Map(bibliography.map((e) => [e.key, e]));
  let entries = citedKeys.map((k) => byKey.get(k)).filter(Boolean);
  if (order === "alphabetical") {
    entries = [...entries].sort((a, b) => {
      const ka = alphabeticalSortKey(a), kb = alphabeticalSortKey(b);
      for (let i = 0; i < ka.length; i++) {
        const cmp = String(ka[i]).localeCompare(String(kb[i]));
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }
  const numberByKey = {};
  const labelByKey = {};
  entries.forEach((entry, i) => {
    numberByKey[entry.key] = i + 1;
    labelByKey[entry.key] = formatCitation(entry, style, i);
  });
  return { entries, numberByKey, labelByKey, order, style, citedCount: entries.length };
}
var CITATION_CSS = `
    sup[data-cite] { font-weight:700; }`;
function resolveCitationsInHtml(html, labelByKey) {
  if (!html || typeof html !== "string" || html.indexOf("data-cite") === -1) return html;
  const markers = keyedMarkers(html).filter((m) => labelByKey?.[m.key]);
  return replaceRanges(html, markers, (m) => html.slice(m.start, m.inner[0]) + escapeText(labelByKey[m.key]) + html.slice(m.inner[1], m.end));
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
var import_libraries3 = require("./libraries");

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

// client/src/utils/moleculeViewer.js
var import_libraries2 = require("./libraries");
var MOLECULE_FORMATS = {
  ".pdb": "pdb",
  ".ent": "pdb",
  ".pqr": "pqr",
  ".cif": "cif",
  ".mmcif": "cif",
  ".sdf": "sdf",
  ".mol": "sdf",
  ".mol2": "mol2",
  ".xyz": "xyz",
  ".gro": "gro"
};
var MOLECULE_STYLES = [
  ["auto", "Auto"],
  ["cartoon", "Cartoon"],
  ["ballstick", "Ball and stick"],
  ["stick", "Sticks"],
  ["sphere", "Space-filling"],
  ["line", "Wireframe"]
];
var MOLECULE_COLORS = [
  ["auto", "Auto"],
  ["element", "By element"],
  ["chain", "By chain"],
  ["spectrum", "Rainbow (N → C)"],
  ["ss", "Secondary structure"]
];
var MOLECULE_DEFAULTS = {
  style: "auto",
  color: "auto",
  hydrogens: true,
  surface: false,
  background: "transparent",
  spin: false
};
function moleculeFormat(name) {
  const lower = String(name || "").toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));
  return lower.includes(".") ? MOLECULE_FORMATS[ext] || null : null;
}
function scriptJson2(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
function pick(value, allowed, fallback) {
  return allowed.some(([v]) => v === value) ? value : fallback;
}
function savedView(view) {
  return Array.isArray(view) && view.length >= 8 && view.every((n) => typeof n === "number" && Number.isFinite(n)) ? view.slice(0, 8) : null;
}
function moleculeViewerHtml(el, { src = el.src, snapshotKey = null, viewKey = null, print = false } = {}) {
  const options = {
    src: src || "",
    format: Object.values(MOLECULE_FORMATS).includes(el.format) ? el.format : moleculeFormat(el.src) || "pdb",
    style: pick(el.style, MOLECULE_STYLES, MOLECULE_DEFAULTS.style),
    color: pick(el.color, MOLECULE_COLORS, MOLECULE_DEFAULTS.color),
    hydrogens: el.hydrogens !== false,
    surface: !!el.surface,
    background: el.background || MOLECULE_DEFAULTS.background,
    spin: !!el.spin && !print,
    view: savedView(el.view),
    snapshotKey,
    viewKey,
    print
  };
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}#stage{position:absolute;inset:0}canvas{display:block;outline:none}#status{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;text-align:center;font:13px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:rgba(128,128,128,0.9);pointer-events:none}#status.error{color:#e5484d}</style>
<script src="${(0, import_libraries2.libUrl)("3dmol", "build/3Dmol-min.js")}"></script>
</head><body><div id="stage"></div><div id="status">Loading molecule…</div>
<script>
(function () {
var O = ${scriptJson2(options)};
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
  const GREEK2 = ["alpha", "beta", "gamma", "delta", "epsilon", "lambda", "sigma", "omega", "phi", "rho"];
  const RESERVED = ["x", "y", "t", "theta", "r"];
  const NAMES = Object.keys(FUNCS).concat(Object.keys(CONSTANTS), ["theta"], GREEK2).sort((a, b) => b.length - a.length);
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
  function tokenize2(text) {
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
              const sub2 = s.slice(j + 2, end).trim();
              if (!sub2 || ![...sub2].every(isWord)) fail("Subscripts are letters and digits, like a_1");
              name += "_" + sub2;
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
    return parser(tokenize2(text), userFns || /* @__PURE__ */ new Set()).statement();
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
      if (!formals.every((f) => f.length === 1 || f === "theta" || GREEK2.includes(f))) continue;
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
  return { tokenize: tokenize2, parseStatement, freeVars, compile, analyze, paramValues, normalize, RESERVED };
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
  const MATH_FONT2 = '"Cambria Math", "Latin Modern Math", "STIX Two Math", "Times New Roman", serif';
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
  const clamp4 = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
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
    const half2 = (view.xMax - view.xMin) * H / W / 2;
    const mid = (view.yMin + view.yMax) / 2;
    return { xMin: view.xMin, xMax: view.xMax, yMin: mid - half2, yMax: mid + half2 };
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
    const font = "italic 16px " + MATH_FONT2;
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
    const cell = cellPx || clamp4(6 / density(), 2, 4);
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
    const add2 = (k1, p1, k2, p2) => {
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
          add2(p[0], p[1], q[0], q[1]);
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
    const cell = clamp4(4.5 / density(), 1.5, 3);
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
      base.style.fontFamily = MATH_FONT2;
      base.style.fontSize = "15px";
      label.appendChild(base);
      if (nm.sub) {
        const sub2 = document.createElement("sub");
        sub2.textContent = nm.sub;
        label.appendChild(sub2);
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
      shownScale = clamp4(data.scale, 0.1, 8);
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

// client/src/utils/equationRuntime.js
function equationRuntime(root, cfg, katex) {
  const doc = root.ownerDocument;
  const win = doc.defaultView || window;
  const SAFE = /^[A-Za-z0-9_-]+$/;
  const NS = "http://www.w3.org/2000/svg";
  const FALLBACK = ["#5aa9ff", "#ff9a52", "#4cc36a", "#c58cff", "#f0c04b", "#ff7aa2"];
  const fontSize = cfg.fontSize || 44;
  const labelSize = cfg.labelSize || 18;
  const style = cfg.labelStyle || "callout";
  if (!doc.getElementById("pxeq-style")) {
    const css = doc.createElement("style");
    css.id = "pxeq-style";
    css.textContent = [
      ".pxeq{position:relative;width:100%;height:100%;line-height:normal;text-align:center}",
      ".pxeq .pxeq-body{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.45em}",
      ".pxeq .pxeq-math{max-width:none}",
      ".pxeq .pxeq-math .katex-display{margin:0}",
      ".pxeq .pxeq-math .katex{font-size:1em}",
      ".pxeq .katex,.pxeq .katex *{transition:color .35s ease,border-color .35s ease}",
      ".pxeq.pxeq-dim .katex{color:color-mix(in srgb,currentColor 28%,transparent)}",
      ".pxeq [data-term].pxeq-past{color:color-mix(in srgb,var(--tc) 50%,transparent)}",
      ".pxeq [data-term].pxeq-lit{color:var(--tc)}",
      ".pxeq.pxeq-hover [data-term]{cursor:pointer}",
      ".pxeq .pxeq-svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}",
      ".pxeq .pxeq-annos{position:absolute;inset:0;pointer-events:none}",
      ".pxeq .pxeq-brace{fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:pxeq-draw .45s ease-out forwards}",
      ".pxeq .pxeq-leader{fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;opacity:.8}",
      ".pxeq .pxeq-tint{animation:pxeq-fade .3s ease-out both}",
      ".pxeq .pxeq-label,.pxeq .pxeq-card{position:absolute;box-sizing:border-box;max-width:22em;font-size:var(--pxeq-label);line-height:1.3;animation:pxeq-rise .35s ease-out both}",
      ".pxeq .pxeq-label{text-align:center}",
      ".pxeq .pxeq-label b,.pxeq .pxeq-card b{display:block;font-weight:700;color:var(--tc)}",
      ".pxeq .pxeq-label span,.pxeq .pxeq-card span{display:block;padding-top:.2em;font-size:.85em;color:color-mix(in srgb,currentColor 80%,transparent)}",
      ".pxeq .pxeq-card{text-align:left;padding:.4em .75em .5em;border:2px solid var(--tc);border-radius:.45em;background:color-mix(in srgb,var(--tc) 12%,transparent)}",
      ".pxeq .pxeq-compact b{white-space:nowrap}",
      ".pxeq .pxeq-above{--pxeq-dy:-6px}",
      ".pxeq .pxeq-below{--pxeq-dy:6px}",
      ".pxeq .pxeq-sentence{margin:0;max-width:min(100%,34em);font-size:calc(var(--pxeq-label) * 1.2);line-height:1.5;color:color-mix(in srgb,currentColor 72%,transparent);text-wrap:balance}",
      ".pxeq .pxeq-sentence.pxeq-off{display:none}",
      ".pxeq .pxeq-phr{transition:color .3s ease,border-color .3s ease;border-bottom:.12em solid transparent}",
      ".pxeq .pxeq-phr.pxeq-past{color:color-mix(in srgb,var(--tc) 60%,transparent)}",
      ".pxeq .pxeq-phr.pxeq-lit{color:var(--tc);border-bottom-color:var(--tc)}",
      ".pxeq .pxeq-sentence.pxeq-rest .pxeq-phr.pxeq-lit{border-bottom-color:transparent}",
      "@keyframes pxeq-draw{to{stroke-dashoffset:0}}",
      "@keyframes pxeq-rise{from{opacity:0;transform:translateY(var(--pxeq-dy,6px))}to{opacity:1;transform:none}}",
      "@keyframes pxeq-fade{from{opacity:0}to{opacity:1}}",
      ".pxeq.pxeq-static .pxeq-label,.pxeq.pxeq-static .pxeq-card,.pxeq.pxeq-static .pxeq-tint{animation:none}",
      ".pxeq.pxeq-static .pxeq-brace{animation:none;stroke-dashoffset:0}",
      ".pxeq.pxeq-static .katex,.pxeq.pxeq-static .katex *,.pxeq.pxeq-static .pxeq-phr{transition:none}",
      "@media (prefers-reduced-motion:reduce){.pxeq .pxeq-label,.pxeq .pxeq-card,.pxeq .pxeq-tint{animation:none}.pxeq .pxeq-brace{animation:none;stroke-dashoffset:0}.pxeq .katex,.pxeq .katex *,.pxeq .pxeq-phr{transition:none}}"
    ].join("\n");
    (doc.head || doc.documentElement).appendChild(css);
  }
  const make = (tag, cls) => {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };
  root.textContent = "";
  const wrap = make("div", "pxeq" + (cfg.static ? " pxeq-static" : "") + (cfg.hover ? " pxeq-hover" : ""));
  const svg = doc.createElementNS(NS, "svg");
  svg.setAttribute("class", "pxeq-svg");
  svg.setAttribute("aria-hidden", "true");
  const body = make("div", "pxeq-body");
  const math = make("div", "pxeq-math");
  const sentence = make("div", "pxeq-sentence");
  const annos = make("div", "pxeq-annos");
  annos.setAttribute("aria-hidden", "true");
  body.appendChild(math);
  body.appendChild(sentence);
  wrap.appendChild(svg);
  wrap.appendChild(body);
  wrap.appendChild(annos);
  wrap.style.fontSize = fontSize + "px";
  wrap.style.setProperty("--pxeq-label", labelSize + "px");
  if (cfg.textColor) wrap.style.color = cfg.textColor;
  root.appendChild(wrap);
  const trust = (ctx) => ctx.command === "\\htmlData" && Object.keys(ctx.attributes || {}).every((k) => (k === "data-term" || k === "data-pk") && SAFE.test(ctx.attributes[k]));
  try {
    katex.render(cfg.latex || "", math, {
      displayMode: true,
      throwOnError: false,
      trust,
      strict: (code) => code === "htmlExtension" ? "ignore" : "warn",
      macros: { "\\term": "\\htmlData{term=#1}{#2}" }
    });
  } catch (e) {
    math.textContent = String(e && e.message || e);
  }
  const termEls = Array.prototype.slice.call(math.querySelectorAll(".katex-html [data-term]"));
  const terms = [];
  const byId = {};
  const add2 = (t) => {
    byId[t.id] = t;
    terms.push(t);
  };
  (cfg.terms || []).forEach((t) => {
    if (t && !byId[t.id] && termEls.some((e) => e.getAttribute("data-term") === t.id)) add2({ id: t.id, label: t.label || "", note: t.note || "", color: t.color || FALLBACK[terms.length % 6] });
  });
  termEls.forEach((e) => {
    const id = e.getAttribute("data-term");
    if (!byId[id]) add2({ id, label: "", note: "", color: FALLBACK[terms.length % 6] });
  });
  const order = terms.map((t) => t.id);
  termEls.forEach((e) => e.style.setProperty("--tc", byId[e.getAttribute("data-term")].color));
  const phrases = [];
  if (style === "sentence" && cfg.sentence) {
    const re = /\[([^\]]+)\]\(([A-Za-z][A-Za-z0-9_-]*)\)/g;
    const text = cfg.sentence;
    let last = 0;
    let m;
    while (m = re.exec(text)) {
      sentence.appendChild(doc.createTextNode(text.slice(last, m.index)));
      const span = make("span", "pxeq-phr");
      span.textContent = m[1];
      if (byId[m[2]]) {
        span.setAttribute("data-term", m[2]);
        span.style.setProperty("--tc", byId[m[2]].color);
        phrases.push(span);
      }
      sentence.appendChild(span);
      last = re.lastIndex;
    }
    sentence.appendChild(doc.createTextNode(text.slice(last)));
  } else {
    sentence.classList.add("pxeq-off");
  }
  const stateAt = (n) => {
    if (cfg.interaction === "hover") return { kind: "rest" };
    const k = n - (cfg.stepStart || 1);
    if (k < 0 || !order.length) return { kind: "plain" };
    if (k < order.length) return { kind: "term", index: k };
    return cfg.showAll === false ? { kind: "term", index: order.length - 1 } : { kind: "all" };
  };
  let stepState = cfg.interaction === "hover" ? { kind: "rest" } : { kind: "plain" };
  let hoverId = null;
  let shown = null;
  function look() {
    const st = hoverId ? { kind: "focus", id: hoverId } : stepState;
    const s = { lit: [], past: [], dim: false, anno: [], compact: false, rest: false };
    if (st.kind === "plain") s.rest = true;
    else if (st.kind === "rest") {
      s.lit = order;
      s.rest = true;
    } else if (st.kind === "all") {
      s.lit = order;
      s.anno = order;
      s.compact = order.length > 1;
    } else if (st.kind === "term" && order[st.index]) {
      s.lit = [order[st.index]];
      s.past = cfg.keepTinted ? order.slice(0, st.index) : [];
      s.dim = true;
      s.anno = s.lit;
    } else if (st.kind === "focus") {
      s.lit = [st.id];
      s.dim = true;
      s.anno = s.lit;
    }
    return s;
  }
  function apply(force) {
    const s = look();
    const key = JSON.stringify(s);
    if (!force && key === shown) return;
    shown = key;
    wrap.classList.toggle("pxeq-dim", s.dim);
    termEls.concat(phrases).forEach((e) => {
      const id = e.getAttribute("data-term");
      e.classList.toggle("pxeq-lit", s.lit.indexOf(id) >= 0);
      e.classList.toggle("pxeq-past", s.past.indexOf(id) >= 0);
    });
    sentence.classList.toggle("pxeq-rest", s.rest);
    draw(s);
  }
  function measure() {
    const rr = wrap.getBoundingClientRect();
    const w = wrap.offsetWidth;
    if (!w || !rr.width) return null;
    const sc = rr.width / w;
    const box = (node) => {
      let L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
      const grow = (l, t, r, b) => {
        if (r - l <= 0 || b - t <= 0) return;
        L = Math.min(L, l);
        T = Math.min(T, t);
        R = Math.max(R, r);
        B = Math.max(B, b);
      };
      const range = doc.createRange();
      const walker = doc.createTreeWalker(node, 4);
      while (walker.nextNode()) {
        const n = walker.currentNode;
        if (!n.nodeValue.trim()) continue;
        range.selectNodeContents(n);
        const rects = range.getClientRects();
        for (let i = 0; i < rects.length; i++) {
          const trim = (rects[i].bottom - rects[i].top) * 0.06;
          grow(rects[i].left, rects[i].top + trim, rects[i].right, rects[i].bottom - trim);
        }
      }
      node.querySelectorAll("svg, .frac-line, .rule, .overline-line, .underline-line, .hline").forEach((e) => {
        const r = e.getBoundingClientRect();
        const p = (e.tagName.toLowerCase() === "svg" && e.parentElement ? e.parentElement : e).getBoundingClientRect();
        grow(Math.max(r.left, p.left), Math.max(r.top, p.top), Math.min(r.right, p.right), Math.min(r.bottom, p.bottom));
      });
      if (L === Infinity) return null;
      return { left: (L - rr.left) / sc, top: (T - rr.top) / sc, right: (R - rr.left) / sc, bottom: (B - rr.top) / sc };
    };
    return { w, box };
  }
  const draw1 = (tag, attrs, css) => {
    const e = doc.createElementNS(NS, tag);
    Object.keys(attrs).forEach((k) => e.setAttribute(k, attrs[k]));
    if (css) e.setAttribute("style", css);
    svg.appendChild(e);
    return e;
  };
  const bracePath = (x0, x1, y, d) => {
    const xm = (x0 + x1) / 2, q = Math.min(labelSize * 0.6, (x1 - x0) / 4), h = d / 2;
    return "M" + x0 + "," + y + " Q" + x0 + "," + (y + h) + " " + (x0 + q) + "," + (y + h) + " L" + (xm - q) + "," + (y + h) + " Q" + xm + "," + (y + h) + " " + xm + "," + (y + d) + " Q" + xm + "," + (y + h) + " " + (xm + q) + "," + (y + h) + " L" + (x1 - q) + "," + (y + h) + " Q" + x1 + "," + (y + h) + " " + x1 + "," + y;
  };
  const labelFor = (cls, t, compact, side) => {
    if (!t.label && (compact || !t.note)) return null;
    const d = make("div", cls + " pxeq-" + side + (compact ? " pxeq-compact" : ""));
    d.style.setProperty("--tc", t.color);
    if (t.label) {
      const b = make("b");
      b.textContent = t.label;
      d.appendChild(b);
    }
    if (!compact && t.note) {
      const n = make("span");
      n.textContent = t.note;
      d.appendChild(n);
    }
    annos.appendChild(d);
    return d;
  };
  function draw(s) {
    svg.textContent = "";
    annos.textContent = "";
    if (style === "sentence" || !s.anno.length) return;
    const m = measure();
    const html = math.querySelector(".katex-html");
    const eq = m && html && m.box(html);
    if (!eq) return;
    const mid = (eq.top + eq.bottom) / 2, eqH = eq.bottom - eq.top;
    const L = labelSize, gap = L * 0.6;
    const items = [];
    s.anno.forEach((id) => {
      const boxes = termEls.filter((e) => e.getAttribute("data-term") === id).map(m.box).filter(Boolean);
      if (!byId[id] || !boxes.length) return;
      const first = boxes[0];
      const side = (first.top + first.bottom) / 2 < mid - eqH * 0.12 ? "above" : "below";
      items.push({ t: byId[id], boxes, side, cx: (first.left + first.right) / 2 });
    });
    const rows = { above: [], below: [] };
    const row = (side, i) => rows[side][i] = rows[side][i] || { spans: [], posts: [] };
    const covers = (l, r, x) => x > l - gap / 2 && x < r + gap / 2;
    const place = (item, w) => {
      const lo = w > m.w ? (m.w - w) / 2 : 0, hi = w > m.w ? (m.w - w) / 2 : m.w - w;
      const want = Math.max(lo, Math.min(hi, item.cx - w / 2));
      const others = items.filter((o) => o !== item && o.side === item.side).map((o) => o.cx);
      const fits = (i2, l) => {
        const r = row(item.side, i2);
        if (!r.spans.every((sp) => l + w + gap <= sp[0] || l >= sp[1] + gap)) return false;
        if (r.posts.some((x) => covers(l, l + w, x))) return false;
        if (i2 === 0 && others.some((x) => covers(l, l + w, x))) return false;
        for (let j = 0; j < i2; j++) if (row(item.side, j).spans.some((sp) => covers(sp[0], sp[1], item.cx))) return false;
        return true;
      };
      const nudge = style === "callout" ? Math.min(w * 0.45, L * 5) : 0;
      for (let i2 = 0; i2 < 6; i2++) {
        let at = fits(i2, want) ? want : null;
        if (at === null && nudge) {
          const near = [];
          row(item.side, i2).spans.forEach((sp) => near.push(sp[1] + gap, sp[0] - gap - w));
          const ok = near.filter((l) => l >= lo && l <= hi && Math.abs(l - want) <= nudge && fits(i2, l));
          if (ok.length) at = ok.sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0];
        }
        if (at !== null) {
          row(item.side, i2).spans.push([at, at + w]);
          for (let j = 0; j < i2; j++) row(item.side, j).posts.push(item.cx);
          return { x: at, row: i2 };
        }
      }
      const i = rows[item.side].length;
      row(item.side, i).spans.push([want, want + w]);
      return { x: want, row: i };
    };
    items.forEach((item) => {
      const { t, boxes, side, cx } = item;
      const dir = side === "below" ? 1 : -1;
      if (style === "brace") {
        const y0 = side === "below" ? eq.bottom + L * 0.45 : eq.top - L * 0.45;
        const depth = L * 0.75 * dir;
        boxes.forEach((b) => draw1("path", { class: "pxeq-brace", d: bracePath(b.left + 1, b.right - 1, y0, depth), pathLength: 1 }, "stroke:" + t.color));
        const lab = labelFor("pxeq-label", t, s.compact, side);
        if (!lab) return;
        const w = lab.offsetWidth, h = lab.offsetHeight;
        const at = place(item, w);
        const tipY = y0 + depth;
        const top = side === "below" ? tipY + L * 0.35 + at.row * L * 1.75 : tipY - L * 0.35 - h - at.row * L * 1.75;
        lab.style.left = at.x + "px";
        lab.style.top = top + "px";
        if (at.row > 0) {
          const edge = side === "below" ? top - 3 : top + h + 3;
          draw1("path", { class: "pxeq-leader pxeq-tint", d: "M" + cx + "," + (tipY + 3 * dir) + " L" + cx + "," + edge }, "stroke:" + t.color);
        }
      } else {
        const padX = fontSize * 0.07, padY = fontSize * 0.07;
        boxes.forEach((b) => draw1("rect", {
          class: "pxeq-tint",
          x: b.left - padX,
          y: b.top - padY,
          width: b.right - b.left + 2 * padX,
          height: b.bottom - b.top + 2 * padY,
          rx: fontSize * 0.18
        }, "fill:" + t.color + ";fill-opacity:.12;stroke:" + t.color + ";stroke-opacity:.55;stroke-width:1.5"));
        const card = labelFor("pxeq-card", t, s.compact, side);
        if (!card) return;
        const w = card.offsetWidth, h = card.offsetHeight;
        const at = place(item, w);
        const out = s.compact ? L * 1.9 : L * 2.3;
        const top = side === "below" ? eq.bottom + out + at.row * L * 2.4 : eq.top - out - h - at.row * L * 2.4;
        card.style.left = at.x + "px";
        card.style.top = top + "px";
        const cardX = Math.max(at.x + L, Math.min(at.x + w - L, cx));
        const cardEdge = side === "below" ? top : top + h;
        boxes.forEach((b) => {
          const ax = (b.left + b.right) / 2, ay = side === "below" ? b.bottom + padY : b.top - padY;
          const midY = side === "below" ? Math.max(ay + L * 0.6, eq.bottom + L * 0.9) : Math.min(ay - L * 0.6, eq.top - L * 0.9);
          draw1("path", { class: "pxeq-leader pxeq-tint", d: "M" + ax + "," + ay + " L" + ax + "," + midY + " L" + cardX + "," + midY + " L" + cardX + "," + cardEdge }, "stroke:" + t.color);
          draw1("circle", { class: "pxeq-tint", cx: ax, cy: ay, r: L * 0.22 }, "fill:" + t.color);
        });
      }
    });
  }
  let timer = 0;
  const setHover = (id) => {
    win.clearTimeout(timer);
    if (hoverId === id) return;
    hoverId = id;
    apply();
  };
  const leave = () => {
    win.clearTimeout(timer);
    timer = win.setTimeout(() => setHover(null), 200);
  };
  const termAt = (target) => {
    const t = target && target.closest ? target.closest("[data-term]") : null;
    return t && wrap.contains(t) && byId[t.getAttribute("data-term")] ? t.getAttribute("data-term") : null;
  };
  const onOver = (e) => {
    if (e.pointerType === "touch") return;
    const id = termAt(e.target);
    if (id) setHover(id);
    else leave();
  };
  const onClick = (e) => {
    const id = termAt(e.target);
    const tap = e.pointerType === "touch" || e.pointerType === "pen";
    if (id) setHover(tap && hoverId === id ? null : id);
    else if (hoverId) setHover(null);
  };
  if (cfg.hover) {
    wrap.addEventListener("pointerover", onOver);
    wrap.addEventListener("pointerleave", leave);
    wrap.addEventListener("click", onClick);
  }
  const redraw = () => apply(true);
  const ro = win.ResizeObserver ? new win.ResizeObserver(redraw) : null;
  if (ro) ro.observe(wrap);
  const fonts = doc.fonts;
  if (fonts && fonts.addEventListener) fonts.addEventListener("loadingdone", redraw);
  apply(true);
  return {
    step(n) {
      stepState = stateAt(n);
      apply();
    },
    show(kind, index) {
      stepState = kind === "term" ? { kind, index: index || 0 } : { kind };
      apply();
    },
    focus(id) {
      setHover(id && byId[id] ? id : null);
    },
    terms: order,
    wrap,
    math,
    redraw,
    // A node's box in the wrapper's own pixels, or null while it isn't shown
    box(node) {
      const m = measure();
      return m && node ? m.box(node) : null;
    },
    destroy() {
      win.clearTimeout(timer);
      if (ro) ro.disconnect();
      if (fonts && fonts.removeEventListener) fonts.removeEventListener("loadingdone", redraw);
      root.textContent = "";
    }
  };
}

// client/src/utils/equationTerms.js
var EQUATION_COLORS = {
  dark: ["#5aa9ff", "#ff9a52", "#4cc36a", "#c58cff", "#f0c04b", "#ff7aa2"],
  light: ["#1d6fd8", "#cc5410", "#12855a", "#8a3ec2", "#9f6600", "#c02a5c"]
};
var LABEL_STYLES = ["callout", "brace", "sentence"];
var INTERACTIONS = ["steps", "hover", "both"];
var MAX_TERMS = 40;
var TERM_ID = /^[A-Za-z][A-Za-z0-9_-]*$/;
var COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
var ARGS = {
  frac: "mm",
  dfrac: "mm",
  tfrac: "mm",
  cfrac: "mm",
  binom: "mm",
  dbinom: "mm",
  tbinom: "mm",
  sqrt: "om",
  overset: "mm",
  underset: "mm",
  stackrel: "mm",
  xrightarrow: "om",
  xleftarrow: "om",
  overbrace: "m",
  underbrace: "m",
  overline: "m",
  underline: "m",
  boxed: "m",
  hat: "m",
  widehat: "m",
  tilde: "m",
  widetilde: "m",
  bar: "m",
  vec: "m",
  dot: "m",
  ddot: "m",
  dddot: "m",
  check: "m",
  breve: "m",
  acute: "m",
  grave: "m",
  mathring: "m",
  overrightarrow: "m",
  overleftarrow: "m",
  overleftrightarrow: "m",
  underrightarrow: "m",
  underleftarrow: "m",
  cancel: "m",
  bcancel: "m",
  xcancel: "m",
  sout: "m",
  phantom: "m",
  hphantom: "m",
  vphantom: "m",
  smash: "om",
  mathrm: "m",
  mathbf: "m",
  mathit: "m",
  mathsf: "m",
  mathtt: "m",
  mathcal: "m",
  mathbb: "m",
  mathfrak: "m",
  mathscr: "m",
  mathnormal: "m",
  boldsymbol: "m",
  bm: "m",
  pmb: "m",
  mathop: "m",
  mathbin: "m",
  mathrel: "m",
  mathord: "m",
  mathopen: "m",
  mathclose: "m",
  mathpunct: "m",
  mathinner: "m",
  text: "t",
  textrm: "t",
  textbf: "t",
  textit: "t",
  textsf: "t",
  texttt: "t",
  textnormal: "t",
  textup: "t",
  emph: "t",
  mbox: "t",
  hbox: "t",
  operatorname: "t",
  "operatorname*": "t",
  tag: "t",
  "tag*": "t",
  label: "t",
  color: "t",
  textcolor: "tm",
  colorbox: "tt",
  fcolorbox: "ttt",
  href: "tm",
  url: "t",
  htmlData: "tm",
  htmlClass: "tm",
  htmlId: "tm",
  htmlStyle: "tm",
  hspace: "t",
  kern: "",
  mkern: "",
  mskip: "",
  hskip: ""
};
var STRUCTURAL = /* @__PURE__ */ new Set(["over", "atop", "choose", "above", "brace", "brack", "\\", "cr", "newline", "right", "middle", "end", "hline", "hdashline", "nonumber", "notag"]);
var OPERATORS = /* @__PURE__ */ new Set([
  "sum",
  "prod",
  "coprod",
  "int",
  "iint",
  "iiint",
  "oint",
  "oiint",
  "bigcup",
  "bigcap",
  "bigvee",
  "bigwedge",
  "bigoplus",
  "bigotimes",
  "bigodot",
  "biguplus",
  "bigsqcup",
  "lim",
  "liminf",
  "limsup",
  "max",
  "min",
  "sup",
  "inf",
  "det",
  "gcd",
  "Pr",
  "argmax",
  "argmin",
  "varlimsup",
  "varliminf",
  "injlim",
  "projlim",
  "overbrace",
  "underbrace",
  "overbracket",
  "underbracket",
  "operatorname*",
  "mathop"
]);
var ENV_ARG = /* @__PURE__ */ new Set(["array", "darray", "subarray", "alignat", "alignat*", "alignedat"]);
function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "%") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === " " || c === "	" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c === "\\") {
      const word = /^[A-Za-z@]+\*?/.exec(src.slice(i + 1, i + 64));
      if (word) {
        out.push({ t: "cmd", name: word[0], start: i, end: i + 1 + word[0].length });
        i += 1 + word[0].length;
      } else if (i + 1 < src.length) {
        out.push({ t: "cmd", name: src[i + 1], start: i, end: i + 2 });
        i += 2;
      } else {
        out.push({ t: "char", start: i, end: i + 1 });
        i++;
      }
      continue;
    }
    const len2 = src.codePointAt(i) > 65535 ? 2 : 1;
    out.push({ t: "{}^_&[]".includes(c) ? c : "char", start: i, end: i + len2 });
    i += len2;
  }
  return out;
}
function parseLatex(src) {
  src = String(src || "");
  const toks = tokenize(src);
  let p = 0;
  const isCmd = (tok, ...names) => !!tok && tok.t === "cmd" && names.includes(tok.name);
  const mkList = (atoms2, start, end, braced) => ({ start, end, braced, atoms: atoms2, parent: null });
  const mk = (kind, start, end, lists, extra) => ({ kind, start, end, lists, wrap: true, parent: null, index: 0, ...extra });
  function items(stop) {
    const atoms2 = [];
    while (p < toks.length && !stop(toks[p])) {
      const a = atom();
      if (a) atoms2.push(a);
    }
    return atoms2;
  }
  function group() {
    const open = toks[p++];
    const atoms2 = items((tok) => tok.t === "}");
    const close = toks[p] && toks[p].t === "}" ? toks[p++] : null;
    const innerEnd = close ? close.start : atoms2.length ? atoms2[atoms2.length - 1].end : open.end;
    return { inner: mkList(atoms2, open.end, innerEnd, true), end: close ? close.end : innerEnd };
  }
  function skipArg() {
    const tok = toks[p];
    if (!tok) return src.length;
    if (tok.t !== "{") {
      p++;
      return tok.end;
    }
    let depth = 0;
    while (p < toks.length) {
      const t = toks[p++];
      if (t.t === "{") depth++;
      else if (t.t === "}" && --depth === 0) return t.end;
    }
    return src.length;
  }
  function mathArg() {
    const tok = toks[p];
    if (!tok || tok.t === "}" || tok.t === "&") return null;
    if (tok.t === "{") {
      const g = group();
      return { list: g.inner, end: g.end };
    }
    const a = base();
    return a ? { list: mkList([a], a.start, a.end, false), end: a.end } : null;
  }
  function base() {
    const tok = toks[p];
    if (tok.t === "{") {
      const g = group();
      return mk("group", tok.start, g.end, [g.inner]);
    }
    if (tok.t === "cmd") return command();
    p++;
    return mk("char", tok.start, tok.end, [], { wrap: tok.t !== "&" && tok.t !== "}" });
  }
  function atom() {
    const tok = toks[p];
    if (tok.t === "}") {
      p++;
      return null;
    }
    const b = tok.t === "^" || tok.t === "_" ? null : base();
    if (b && !b.wrap) return b;
    const scripts = [];
    let end = b ? b.end : tok.start, any = false;
    while (p < toks.length) {
      const t = toks[p];
      if (isCmd(t, "limits", "nolimits")) {
        end = t.end;
        p++;
        continue;
      }
      if (t.t === "char" && src[t.start] === "'") {
        end = t.end;
        p++;
        any = true;
        continue;
      }
      if (t.t !== "^" && t.t !== "_") break;
      p++;
      any = true;
      const arg = mathArg();
      if (!arg) {
        end = t.end;
        continue;
      }
      scripts.push(arg.list);
      end = arg.end;
    }
    if (!any) return b;
    const lists = [];
    if (b) {
      if (b.kind === "cmd" && OPERATORS.has(b.name)) lists.push(...b.lists);
      else lists.push(mkList([b], b.start, b.end, false));
    }
    lists.push(...scripts);
    return mk("scripts", b ? b.start : tok.start, end, lists);
  }
  function command() {
    const tok = toks[p++];
    const name = tok.name;
    if (name === "left") return leftRight(tok);
    if (name === "begin") return environment(tok);
    if (name === "term") return term(tok);
    if (STRUCTURAL.has(name)) {
      let end2 = tok.end;
      if (name === "middle" || name === "right") {
        const d = toks[p];
        if (d) {
          p++;
          end2 = d.end;
        }
      }
      if (name === "\\" && toks[p] && toks[p].t === "[") {
        p++;
        items((t) => t.t === "]");
        if (toks[p]) end2 = toks[p++].end;
      }
      return mk("cmd", tok.start, end2, [], { name, wrap: false });
    }
    const lists = [];
    let end = tok.end;
    const spec = ARGS[name];
    if (spec === void 0) {
      while (toks[p] && toks[p].t === "{" && toks[p].start === end) {
        const g = group();
        lists.push(g.inner);
        end = g.end;
      }
    } else {
      for (const kind of spec) {
        const t = toks[p];
        if (!t) break;
        if (kind === "o") {
          if (t.t !== "[") continue;
          p++;
          const atoms2 = items((x) => x.t === "]");
          const close = toks[p] && toks[p].t === "]" ? toks[p++] : null;
          lists.push(mkList(atoms2, t.end, close ? close.start : end, true));
          end = close ? close.end : atoms2.length ? atoms2[atoms2.length - 1].end : t.end;
        } else if (kind === "t") {
          end = skipArg();
        } else {
          const arg = mathArg();
          if (!arg) break;
          lists.push(arg.list);
          end = arg.end;
        }
      }
    }
    return mk("cmd", tok.start, end, lists, { name });
  }
  function leftRight(tok) {
    let end = tok.end;
    if (toks[p]) end = toks[p++].end;
    const open = end;
    const atoms2 = items((t) => isCmd(t, "right"));
    const close = toks[p] ? toks[p].start : src.length;
    if (isCmd(toks[p], "right")) {
      end = toks[p++].end;
      if (toks[p]) end = toks[p++].end;
    } else if (atoms2.length) end = atoms2[atoms2.length - 1].end;
    return mk("leftright", tok.start, end, [mkList(atoms2, open, close, true)]);
  }
  function environment(tok) {
    const nameTok = toks[p];
    let end = skipArg();
    const env = nameTok && nameTok.t === "{" ? src.slice(nameTok.end, end - 1).trim() : "";
    if (ENV_ARG.has(env)) end = skipArg();
    const cells = [];
    for (; ; ) {
      const from = toks[p] ? toks[p].start : src.length;
      const atoms2 = items((t2) => t2.t === "&" || isCmd(t2, "\\", "cr", "end", "hline", "hdashline"));
      const t = toks[p];
      cells.push(mkList(atoms2, from, t ? t.start : src.length, true));
      if (!t) break;
      p++;
      if (isCmd(t, "end")) {
        end = skipArg();
        break;
      }
      if (isCmd(t, "\\") && toks[p] && toks[p].t === "[") {
        p++;
        items((x) => x.t === "]");
        if (toks[p]) p++;
      }
    }
    return mk("env", tok.start, end, cells, { name: env });
  }
  function term(tok) {
    let id = "", end = tok.end;
    if (toks[p] && toks[p].t === "{") {
      const from = toks[p].end;
      end = skipArg();
      id = src.slice(from, end - 1).trim();
    }
    const arg = mathArg();
    if (!arg) return mk("cmd", tok.start, end, [], { name: "term", wrap: false, term: id });
    return mk("term", tok.start, arg.end, [arg.list], { term: id, body: arg.list });
  }
  const root = mkList(items(() => false), 0, src.length, true);
  const atoms = [];
  const link = (list, parent2) => {
    list.parent = parent2;
    list.atoms.forEach((a, i) => {
      a.parent = list;
      a.index = i;
      atoms.push(a);
      a.lists.forEach((l) => link(l, a));
    });
  };
  link(root, null);
  return { src, root, atoms };
}
function termAtoms(tree) {
  return tree.atoms.filter((a) => a.kind === "term").sort((a, b) => a.start - b.start);
}
function termIdsIn(latex) {
  const ids = [];
  for (const a of termAtoms(parseLatex(latex))) if (TERM_ID.test(a.term) && !ids.includes(a.term)) ids.push(a.term);
  return ids;
}
var int = (v, min, max, dflt) => Number.isInteger(+v) && +v >= min && +v <= max ? +v : dflt;
var num2 = (v, min, max, dflt) => typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt;
var str = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
var isDark = (hex) => {
  const h = hex.length === 4 ? hex.replace(/[0-9a-f]/gi, (d) => d + d) : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
};
function equationConfig(el) {
  const latex = str(el?.latex, 2e4);
  const ids = termIdsIn(latex);
  const textColor = typeof el?.textColor === "string" && COLOR.test(el.textColor) ? el.textColor : null;
  const palette = EQUATION_COLORS[textColor && isDark(textColor) ? "light" : "dark"];
  const given = Array.isArray(el?.terms) ? el.terms : [];
  const terms = [];
  for (const t of given) {
    if (!t || !ids.includes(t.id) || terms.some((u) => u.id === t.id)) continue;
    terms.push({ id: t.id, label: str(t.label, 200), note: str(t.note, 500), color: COLOR.test(t.color || "") ? t.color : null });
  }
  for (const id of ids) if (!terms.some((t) => t.id === id)) terms.push({ id, label: "", note: "", color: null });
  terms.splice(MAX_TERMS);
  terms.forEach((t, i) => {
    if (!t.color) t.color = palette[i % palette.length];
  });
  return {
    latex,
    terms,
    labelStyle: LABEL_STYLES.includes(el?.labelStyle) ? el.labelStyle : "callout",
    sentence: str(el?.sentence, 2e3),
    interaction: INTERACTIONS.includes(el?.interaction) ? el.interaction : "steps",
    stepStart: int(el?.stepStart, 1, 1e3, 1),
    showAll: el?.showAll !== false,
    keepTinted: !!el?.keepTinted,
    fontSize: num2(el?.fontSize, 8, 200, 44),
    labelSize: num2(el?.labelSize, 6, 120, 18),
    textColor
  };
}
function equationSteps(el) {
  if (el?.type !== "equation") return [];
  const cfg = equationConfig(el);
  if (cfg.interaction === "hover") return [];
  const steps = cfg.terms.map((t, i) => [cfg.stepStart + i, i]);
  if (steps.length && cfg.showAll) steps.push([cfg.stepStart + steps.length, "all"]);
  return steps.filter(([n]) => n <= 1e3);
}
function equationStepMarkers(slide) {
  let html = "";
  for (const el of slide?.elements || []) {
    const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    for (const [n] of equationSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-eq-step="${id}" data-eq-step-at="${n}" aria-hidden="true" style="position:absolute;"></span>`;
  }
  return html;
}
function hasEquations(presentation) {
  return (presentation?.slides || []).some((s) => (s.elements || []).some((el) => el.type === "equation"));
}
function equationConfigAttr(el, extra = {}) {
  return JSON.stringify({ ...equationConfig(el), ...extra }).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
var runtimeCode = null;
function runtimeSource() {
  if (!runtimeCode) runtimeCode = `(${equationRuntime.toString()})`.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "< !--");
  return runtimeCode;
}
function equationDeckScript() {
  return `
    (function() {
      var run = ${runtimeSource()};
      var items = [];
      document.querySelectorAll('[data-eq-config]').forEach(function(el) {
        try {
          var cfg = JSON.parse(el.getAttribute('data-eq-config'));
          cfg.hover = cfg.interaction !== 'steps';
          items.push({ el: el, id: el.getAttribute('data-eq'), eq: run(el, cfg, window.katex) });
        } catch (e) {}
      });
      function stepOf(item) {
        var slide = item.el.closest('section'), n = 0;
        if (!slide) return 0;
        slide.querySelectorAll('.fragment[data-eq-step]').forEach(function(m) {
          if (m.getAttribute('data-eq-step') === item.id && m.classList.contains('visible')) n = Math.max(n, +m.getAttribute('data-eq-step-at') || 0);
        });
        return n;
      }
      function sync() { items.forEach(function(item) { item.eq.step(stepOf(item)); }); }
      ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden'].forEach(function(name) { Reveal.on(name, sync); });
    })();
`;
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

// client/src/utils/diagramCore.js
var MATH_FONT = "'Latin Modern Roman', 'Times New Roman', Times, serif";
var esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var n1 = (v) => String(Math.round(v * 10) / 10);
var GREEK = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ϵ", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "ϕ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω" };
var SYM = { pm: "±", mp: "∓", to: "→", prime: "′", ell: "ℓ", ast: "∗", times: "×", cdot: "·", infty: "∞", partial: "∂", hbar: "ℏ", ",": " ", ";": " ", " ": " ", "!": "", quad: "  " };
var ACCENT = { bar: 772, overline: 773, tilde: 771, hat: 770 };
var UPRIGHT = { mathrm: 1, text: 1, rm: 1, mathbf: 1 };
var SCRIPT = { A: "𝒜", B: "ℬ", C: "𝒞", E: "ℰ", F: "ℱ", H: "ℋ", I: "ℐ", L: "ℒ", M: "ℳ", R: "ℛ" };
var COMBINING = new RegExp("[" + String.fromCharCode(768) + "-" + String.fromCharCode(879) + "]", "g");
function texRuns(src) {
  src = String(src || "");
  const runs = [];
  let i = 0;
  const push = (t, lvl, it) => {
    if (!t) return;
    const r = runs[runs.length - 1];
    if (r && r.lvl === lvl && r.it === it) r.t += t;
    else runs.push({ t, lvl, it });
  };
  function atom(lvl, up) {
    const c = src[i];
    if (c === void 0) return;
    if (c === "{") {
      i++;
      group(lvl, up, "}");
      return;
    }
    if (c === "\\") {
      const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i));
      if (!m) {
        i++;
        return;
      }
      i += m[0].length;
      const name = m[1];
      if (ACCENT[name]) {
        const before = runs.length, lastLen = before ? runs[before - 1].t.length : 0;
        while (src[i] === " ") i++;
        atom(lvl, up);
        const mark = String.fromCharCode(ACCENT[name]);
        if (runs.length > before) {
          const r = runs[before];
          r.t = r.t.slice(0, 1) + mark + r.t.slice(1);
        } else if (before && runs[before - 1].t.length > lastLen) {
          const r = runs[before - 1];
          r.t = r.t.slice(0, lastLen + 1) + mark + r.t.slice(lastLen + 1);
        }
        return;
      }
      if (UPRIGHT[name]) {
        while (src[i] === " ") i++;
        atom(lvl, true);
        return;
      }
      if (name === "mathcal") {
        while (src[i] === " ") i++;
        const before = runs.length;
        atom(lvl, true);
        for (const r of runs.slice(Math.max(0, before - 1))) r.t = r.t.replace(/[A-Z]/g, (c2) => SCRIPT[c2] || c2);
        return;
      }
      if (GREEK[name]) {
        push(GREEK[name], lvl, !up && name[0] === name[0].toLowerCase());
        return;
      }
      if (SYM[name] !== void 0) {
        push(SYM[name], lvl, false);
        return;
      }
      push(name, lvl, false);
      return;
    }
    i++;
    if (/[A-Za-z]/.test(c)) push(c, lvl, !up);
    else if (c === "-") push("−", lvl, false);
    else if (c === "'") push("′", lvl, false);
    else if (c === "~") push(" ", lvl, false);
    else if (c !== " ") push(c, lvl, false);
  }
  function group(lvl, up, end) {
    while (i < src.length && src[i] !== end) {
      if (src[i] === "^" || src[i] === "_") {
        const l = src[i] === "^" ? 1 : -1;
        i++;
        atom(lvl || l, up);
        continue;
      }
      if (src[i] === "}") {
        i++;
        continue;
      }
      atom(lvl, up);
    }
    if (end && src[i] === end) i++;
  }
  group(0, false, null);
  return runs;
}
function texBox(src, fs) {
  let w = 0, sup = false, sub2 = false;
  for (const r of texRuns(src)) {
    w += r.t.replace(COMBINING, "").length * fs * 0.5 * (r.lvl ? 0.7 : 1);
    if (r.lvl > 0) sup = true;
    if (r.lvl < 0) sub2 = true;
  }
  return { w: Math.max(w, fs * 0.4), h: fs * (1 + (sup ? 0.25 : 0) + (sub2 ? 0.2 : 0)) };
}
function texLiteHtml(src) {
  return texRuns(src).map((r) => {
    const t = r.it ? `<i>${esc(r.t)}</i>` : esc(r.t);
    return r.lvl > 0 ? `<sup>${t}</sup>` : r.lvl < 0 ? `<sub>${t}</sub>` : t;
  }).join("");
}
function texSvg(src, X, Y, fs, fill) {
  let cur = 0, spans = "";
  for (const r of texRuns(src)) {
    const target = r.lvl > 0 ? -0.42 : r.lvl < 0 ? 0.24 : 0;
    const dy = (target - cur) * fs;
    cur = target;
    spans += `<tspan dy="${n1(dy)}" font-size="${n1(r.lvl ? fs * 0.7 : fs)}" font-style="${r.it ? "italic" : "normal"}">${esc(r.t)}</tspan>`;
  }
  return `<text x="${n1(X)}" y="${n1(Y + fs * 0.34)}" text-anchor="middle" font-family="${esc(MATH_FONT)}" font-size="${n1(fs)}" fill="${esc(fill)}">${spans}</text>`;
}
function applyDiagramStep(root, cur, animate, dim) {
  var parts = root.querySelectorAll(".pxfx-part"), i, p, at, best = -1;
  for (i = 0; i < parts.length; i++) {
    p = parts[i];
    at = +p.getAttribute("data-fx-at") || 0;
    p.classList.toggle("pxfx-off", at > cur);
    p.classList.toggle("pxfx-past", !!dim && cur > 0 && at < cur);
    p.classList.remove("pxfx-new");
    if (animate && at === cur && at > 0) {
      void p.getBoundingClientRect();
      p.classList.add("pxfx-new");
    }
  }
  var caps = root.querySelectorAll("[data-fx-cap]");
  for (i = 0; i < caps.length; i++) {
    at = +caps[i].getAttribute("data-fx-cap");
    if (at <= cur && at > best) best = at;
  }
  for (i = 0; i < caps.length; i++) caps[i].classList.toggle("pxfx-off", +caps[i].getAttribute("data-fx-cap") !== best);
  var spans = root.querySelectorAll("[data-fx-in]"), r;
  for (i = 0; i < spans.length; i++) {
    r = spans[i].getAttribute("data-fx-in").split("-");
    spans[i].classList.toggle("pxfx-off", cur < +r[0] || r[1] !== "" && cur > +r[1]);
  }
}
var DIAGRAM_CSS = [
  ".pxfx-part.pxfx-off,.pxfx-cap.pxfx-off{visibility:hidden}",
  "[data-fx-in].pxfx-off{display:none}",
  ".pxfx-part{transition:opacity .35s ease}",
  ".pxfx-part.pxfx-past{opacity:.34}",
  ".pxfx-reveal{stroke-dasharray:1 1;stroke-dashoffset:0}",
  ".pxfx-new .pxfx-reveal{animation:pxfx-draw .75s ease-in-out both}",
  ".pxfx-new .pxfx-fade,.pxfx-new.pxfx-v{animation:pxfx-fade .35s .45s ease-out both}",
  "@keyframes pxfx-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}",
  "@keyframes pxfx-fade{from{opacity:0}to{opacity:1}}",
  // A circuit's current: dots that run the way conventional current flows
  ".pxcx-flow{animation:pxcx-flow .6s linear infinite}",
  "@keyframes pxcx-flow{to{stroke-dashoffset:-14}}",
  // A logic signal that changed: it fades in after those before it in the logic
  ".pxlg-sig{animation:pxfx-fade .28s ease-out both}",
  "@media (prefers-reduced-motion:reduce){.pxfx-new .pxfx-reveal,.pxfx-new .pxfx-fade,.pxfx-new.pxfx-v,.pxcx-flow,.pxlg-sig{animation:none}.pxfx-part{transition:none}}"
].join("\n");
var deckScript = null;
function diagramDeckScript() {
  if (!deckScript) deckScript = `
    (function() {
      var apply = (${applyDiagramStep.toString()});
      // The labels, now rather than when the deck is ready
      if (window.katex) document.querySelectorAll('[data-fx] span[data-math-latex]').forEach(function(el) {
        try { window.katex.render(el.getAttribute('data-math-latex'), el, { throwOnError: false }); el.style.fontFamily = ''; } catch (e) {}
      });
      var css = document.createElement('style');
      css.textContent = ${JSON.stringify(DIAGRAM_CSS)};
      document.head.appendChild(css);
      var items = [];
      document.querySelectorAll('[data-fx]').forEach(function(el) {
        items.push({ el: el, id: el.getAttribute('data-fx'), dim: el.getAttribute('data-fx-dim') === '1', at: -1 });
      });
      function stepOf(item) {
        var slide = item.el.closest('section'), n = 0;
        if (!slide) return 0;
        slide.querySelectorAll('.fragment[data-fx-step]').forEach(function(m) {
          if (m.getAttribute('data-fx-step') === item.id && m.classList.contains('visible')) n = Math.max(n, +m.getAttribute('data-fx-step-at') || 0);
        });
        return n;
      }
      function sync(ev) {
        var forward = !!ev && ev.type === 'fragmentshown';
        items.forEach(function(item) {
          var n = stepOf(item);
          if (n === item.at) return;
          apply(item.el, n, forward && n > item.at, item.dim);
          item.at = n;
        });
      }
      ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden'].forEach(function(name) { Reveal.on(name, sync); });
      sync();
    })();
`;
  return deckScript;
}

// client/src/utils/feynmanDiagram.js
var UNIT = 64;
var AMP = 0.085;
var HALF = 0.155;
var PITCH = 0.19;
var COIL = 0.1;
var DBL = 0.032;
var LABEL = 0.3;
var CAPTION = 0.27;
var FEYNMAN_TYPES = {
  fermion: { name: "Fermion", tikz: "fermion", arrow: 1, fermion: true, key: "f", usual: "e, μ, q, t", chips: ["e^-", "\\mu^-", "q", "t", "\\nu_e"] },
  antifermion: { name: "Antifermion", tikz: "anti fermion", arrow: -1, fermion: true, key: "a", usual: "e⁺, antiquarks", chips: ["e^+", "\\bar{q}", "\\bar{\\nu}_e"] },
  photon: { name: "Photon", tikz: "photon", deco: "wave", key: "p", usual: "γ, Z, W", chips: ["\\gamma", "\\gamma^*", "Z", "W^-"] },
  chargedBoson: { name: "Charged boson", tikz: "charged boson", deco: "wave", arrow: 1, usual: "W⁺, W⁻", chips: ["W^+", "W^-"] },
  gluon: { name: "Gluon", tikz: "gluon", deco: "coil", key: "g", usual: "g", chips: ["g"] },
  scalar: { name: "Scalar", tikz: "scalar", dash: "7 5", key: "s", usual: "H, φ, π⁰", chips: ["H", "\\phi", "\\pi^0"] },
  chargedScalar: { name: "Charged scalar", tikz: "charged scalar", dash: "7 5", arrow: 1, usual: "H⁺, π⁺, K⁺", chips: ["H^+", "\\pi^+", "K^+"] },
  ghost: { name: "Ghost", tikz: "ghost", dash: "dot", arrow: 1, usual: "Faddeev–Popov ghost", chips: ["c", "\\bar{c}"] },
  graviton: { name: "Graviton", tikz: "graviton", deco: "wave2", usual: "graviton", chips: ["h_{\\mu\\nu}"] },
  plain: { name: "Plain", tikz: "plain", usual: "any, or a Majorana line", chips: [] },
  double: { name: "Double", tikz: "double", deco: "double", usual: "heavy quark, composite", chips: ["Q", "B"] }
};
var VERTEX_KINDS = [["auto", "Auto"], ["none", "None"], ["dot", "Dot"], ["blob", "Blob"], ["crossed", "Crossed"], ["empty", "Empty"], ["square", "Square"]];
var KIND_R = { blob: 0.36, crossed: 0.125, empty: 0.072 };
var LABEL_AT = { above: [0, 1], below: [0, -1], left: [-1, 0], right: [1, 0] };
var esc2 = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var n12 = (v) => String(Math.round(v * 10) / 10);
var clamp = (v, a, b) => Math.min(b, Math.max(a, v));
var ID = /^[A-Za-z0-9_-]{1,40}$/;
var COLOR2 = /^#[0-9a-f]{6}$/i;
var num3 = (v, lo, hi, dflt) => typeof v === "number" && isFinite(v) ? clamp(v, lo, hi) : dflt;
var int2 = (v, lo, hi, dflt) => typeof v === "number" && isFinite(v) ? clamp(Math.round(v), lo, hi) : dflt;
var str2 = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
function feynmanModel(el) {
  const vertices = [], edges = [], ids = /* @__PURE__ */ new Set();
  for (const v of Array.isArray(el?.vertices) ? el.vertices.slice(0, 500) : []) {
    if (!v || !ID.test(v.id) || ids.has(v.id)) continue;
    ids.add(v.id);
    vertices.push({
      id: v.id,
      x: num3(v.x, -1e3, 1e3, 0),
      y: num3(v.y, -1e3, 1e3, 0),
      kind: VERTEX_KINDS.some(([k]) => k === v.kind) ? v.kind : "auto",
      label: str2(v.label, 200),
      labelAt: LABEL_AT[v.labelAt] ? v.labelAt : "auto",
      color: COLOR2.test(v.color || "") ? v.color : null,
      step: v.step == null ? null : int2(v.step, 0, 1e3, null)
    });
  }
  const edgeIds = /* @__PURE__ */ new Set();
  for (const e of Array.isArray(el?.edges) ? el.edges.slice(0, 1e3) : []) {
    if (!e || !ID.test(e.id) || edgeIds.has(e.id) || !ids.has(e.from) || !ids.has(e.to)) continue;
    edgeIds.add(e.id);
    const out = {
      id: e.id,
      from: e.from,
      to: e.to,
      particle: FEYNMAN_TYPES[e.particle] ? e.particle : "plain",
      bend: num3(e.bend, -1.6, 1.6, 0),
      label: str2(e.label, 200),
      labelSide: e.labelSide === -1 ? -1 : 1,
      momentum: str2(e.momentum, 200),
      momentumSide: e.momentumSide === 1 ? 1 : -1,
      momentumReverse: !!e.momentumReverse,
      color: COLOR2.test(e.color || "") ? e.color : null,
      step: int2(e.step, 0, 1e3, 0)
    };
    if (e.from === e.to) {
      out.loopAngle = int2(e.loopAngle, -360, 720, 90);
      out.loopSize = num3(e.loopSize, 0.3, 6, 1.2);
    }
    edges.push(out);
  }
  const captions = {};
  if (el?.captions && typeof el.captions === "object") {
    for (const [k, v] of Object.entries(el.captions)) {
      const n = Number(k);
      if (Number.isInteger(n) && n >= 0 && n <= 1e3 && typeof v === "string" && v.trim()) captions[n] = v.slice(0, 500);
    }
  }
  return {
    vertices,
    edges,
    captions,
    color: COLOR2.test(el?.color || "") ? el.color : "#ffffff",
    stepStart: int2(el?.stepStart, 1, 1e3, 1),
    dimPast: el?.dimPast !== false
  };
}
function lineGeometry(V, e) {
  const A = V[e.from], B = V[e.to];
  if (!A || !B) return null;
  if (e.from === e.to) {
    const r = (e.loopSize || 1.2) / 2, ang = (e.loopAngle ?? 90) * Math.PI / 180;
    const cx2 = A.x + r * Math.cos(ang), cy2 = A.y + r * Math.sin(ang), a0 = ang + Math.PI;
    return {
      len: 2 * Math.PI * r,
      curved: true,
      at: (t) => {
        const th = a0 - 2 * Math.PI * t;
        return [cx2 + r * Math.cos(th), cy2 + r * Math.sin(th), Math.sin(th), -Math.cos(th)];
      }
    };
  }
  const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-9;
  const b = e.bend || 0;
  if (Math.abs(b) < 0.02) return { len: d, at: (t) => [A.x + dx * t, A.y + dy * t, dx / d, dy / d] };
  const h = d / 2, s = b * h, R = (h * h + s * s) / (2 * Math.abs(s));
  const nx = -dy / d, ny = dx / d, off = s - Math.sign(s) * R;
  const cx = (A.x + B.x) / 2 + nx * off, cy = (A.y + B.y) / 2 + ny * off;
  const th0 = Math.atan2(A.y - cy, A.x - cx), th1 = Math.atan2(B.y - cy, B.x - cx);
  let sw = th1 - th0;
  if (s > 0) {
    while (sw >= 0) sw -= 2 * Math.PI;
    while (sw < -2 * Math.PI) sw += 2 * Math.PI;
  } else {
    while (sw <= 0) sw += 2 * Math.PI;
    while (sw > 2 * Math.PI) sw -= 2 * Math.PI;
  }
  const sg = Math.sign(sw);
  return {
    len: R * Math.abs(sw),
    curved: true,
    at: (t) => {
      const th = th0 + sw * t;
      return [cx + R * Math.cos(th), cy + R * Math.sin(th), -sg * Math.sin(th), sg * Math.cos(th)];
    }
  };
}
var part = (g, t0, t1) => ({ len: g.len * (t1 - t0), curved: g.curved, at: (t) => g.at(t0 + (t1 - t0) * t) });
function basePoints(g, off = 0) {
  const n = g.curved ? 72 : 1, pts = [];
  for (let i = 0; i <= n; i++) {
    const [x, y, tx, ty] = g.at(i / n);
    pts.push([x - ty * off, y + tx * off]);
  }
  return pts;
}
function wavePoints(g, off = 0) {
  const k = Math.max(2, Math.round(g.len / HALF)), n = k * 10, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y, tx, ty] = g.at(t), o = AMP * Math.sin(Math.PI * k * t) + off;
    pts.push([x - ty * o, y + tx * o]);
  }
  return pts;
}
function coilPoints(g) {
  const L = g.len, N = Math.max(2, Math.round(L / PITCH)), n = N * 20, pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, th = 2 * Math.PI * N * u;
    const q = Math.min(u, 1 - u) * N * 2, w = q >= 1 ? 1 : q * q * (3 - 2 * q);
    const s = u * L - COIL * w * Math.sin(th), o = -COIL * w * Math.cos(th);
    const tc = clamp(s / L, 0, 1), [x, y, tx, ty] = g.at(tc), ex = s - tc * L;
    pts.push([x + tx * ex - ty * o, y + ty * ex + tx * o]);
  }
  return pts;
}
var decoAmp = (t) => t.deco === "wave" ? AMP : t.deco === "wave2" ? AMP + DBL : t.deco === "coil" ? COIL + 0.02 : t.deco === "double" ? DBL : 0;
function vertexMap(m) {
  const V = {};
  for (const v of m.vertices) V[v.id] = v;
  return V;
}
function degrees(m) {
  const d = {};
  for (const v of m.vertices) d[v.id] = 0;
  for (const e of m.edges) {
    d[e.from] = (d[e.from] || 0) + 1;
    d[e.to] = (d[e.to] || 0) + 1;
  }
  return d;
}
var shownKind = (v, deg) => v.kind && v.kind !== "auto" ? v.kind : deg[v.id] >= 3 ? "dot" : "none";
function vertexStep(m, v) {
  if (v.step != null) return v.step;
  let s = Infinity;
  for (const e of m.edges) if (e.from === v.id || e.to === v.id) s = Math.min(s, e.step || 0);
  return isFinite(s) ? s : 0;
}
function maxStep(m) {
  let s = 0;
  for (const e of m.edges) s = Math.max(s, e.step || 0);
  for (const v of m.vertices) if (v.step != null) s = Math.max(s, v.step);
  return s;
}
function legDirections(m, V, v) {
  const dirs = [];
  for (const e of m.edges) {
    if (e.from !== v.id && e.to !== v.id) continue;
    const g = lineGeometry(V, e);
    if (!g) continue;
    if (e.from === v.id) {
      const [, , tx, ty] = g.at(0.01);
      dirs.push([tx, ty]);
    }
    if (e.to === v.id) {
      const [, , tx, ty] = g.at(0.99);
      dirs.push([-tx, -ty]);
    }
  }
  return dirs;
}
function labelDirection(m, V, v) {
  if (LABEL_AT[v.labelAt]) return LABEL_AT[v.labelAt];
  const dirs = legDirections(m, V, v);
  if (!dirs.length) return [0, 1];
  let sx = 0, sy = 0;
  for (const d of dirs) {
    sx += d[0];
    sy += d[1];
  }
  const sl = Math.hypot(sx, sy);
  if (dirs.length === 1) return [-sx / sl, -sy / sl];
  let best = [0, 1], score = -Infinity;
  for (let k = 0; k < 16; k++) {
    const a = k * Math.PI / 8, c = [Math.cos(a), Math.sin(a)];
    let gap = Infinity;
    for (const d of dirs) gap = Math.min(gap, Math.acos(clamp(c[0] * d[0] + c[1] * d[1], -1, 1)));
    const sc = gap + (sl > 0.2 ? 0.25 * (-(sx * c[0] + sy * c[1]) / sl) : 0) + 0.06 * c[1];
    if (sc > score) {
      score = sc;
      best = c;
    }
  }
  return best;
}
function drawDiagram(m, o = {}) {
  const u = o.U || UNIT, k = u / 64, V = vertexMap(m), deg = degrees(m);
  const lw = o.lw || 2.2, fs = LABEL * u;
  const deck = o.deck != null ? String(o.deck).replace(/[^A-Za-z0-9_-]/g, "") : null;
  const stepped = deck == null && o.step != null;
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (X, Y, rx = 0, ry = rx) => {
    box.x0 = Math.min(box.x0, X - rx);
    box.x1 = Math.max(box.x1, X + rx);
    box.y0 = Math.min(box.y0, Y - ry);
    box.y1 = Math.max(box.y1, Y + ry);
  };
  const P = (pts, measure = true) => {
    let d = "";
    pts.forEach((p, i) => {
      const X = p[0] * u, Y = -p[1] * u;
      if (measure) grow(X, Y, lw);
      d += (i ? "L" : "M") + n12(X) + " " + n12(Y);
    });
    return d;
  };
  const stroke = (d, ink, extra = "", w = lw) => `<path d="${d}" fill="none" stroke="${esc2(ink)}" stroke-width="${n12(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
  const label = (tex, X, Y, size, ink) => {
    const b = texBox(tex, size);
    grow(X, Y, b.w / 2, b.h / 2);
    if (o.labels === "deck" || typeof o.labels === "function") {
      const w = b.w * 2 + size * 2, h = b.h * 1.6 + size;
      const inner = o.labels === "deck" ? `<span data-math-latex="${esc2(tex)}" style="font-family:${esc2(MATH_FONT)}">${texLiteHtml(tex)}</span>` : o.labels(tex);
      return `<foreignObject x="${n12(X - w / 2)}" y="${n12(Y - h / 2)}" width="${n12(w)}" height="${n12(h)}" pointer-events="none" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:${n12(size / 1.21)}px;color:${esc2(ink)}">${inner}</div></foreignObject>`;
    }
    return texSvg(tex, X, Y, size, ink);
  };
  const visible = (s) => !stepped || s <= o.step;
  const wrap = (s, lines, labels, revealPts, isVertex, id) => {
    if (deck != null) {
      const cls = `pxfx-part${isVertex ? " pxfx-v" : ""}`;
      if (s > 0 && revealPts) {
        const mid = `pxfxm-${deck}-${id}`;
        return `<g class="${cls}" data-fx-at="${s}"><mask id="${mid}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000"><path class="pxfx-reveal" pathLength="1" d="${P(revealPts, false)}" fill="none" stroke="#fff" stroke-width="${n12(40 * k)}" stroke-linecap="round"/></mask><g mask="url(#${mid})">${lines}</g><g class="pxfx-fade">${labels}</g></g>`;
      }
      return `<g class="${cls}" data-fx-at="${s}">${lines}${labels}</g>`;
    }
    const faded = stepped && o.dim && o.step > 0 && s < o.step;
    return `<g${faded ? ' opacity=".34"' : ""}>${lines}${labels}</g>`;
  };
  let out = "";
  if (o.editor && o.grid && o.view) {
    const v = o.view, gx = v.x0 * u, gy = -(v.y0 + v.h) * u;
    out += `<defs><pattern id="pxfx-g1" width="${u / 2}" height="${u / 2}" x="${-u / 4}" y="${-u / 4}" patternUnits="userSpaceOnUse"><circle cx="${u / 4}" cy="${u / 4}" r="1" fill="${esc2(o.mark)}" fill-opacity=".5"/></pattern><pattern id="pxfx-g2" width="${u}" height="${u}" x="${-u / 2}" y="${-u / 2}" patternUnits="userSpaceOnUse"><circle cx="${u / 2}" cy="${u / 2}" r="1.7" fill="${esc2(o.mark)}" fill-opacity=".75"/></pattern></defs><rect x="${n12(gx)}" y="${n12(gy)}" width="${n12(v.w * u)}" height="${n12(v.h * u)}" fill="url(#pxfx-g1)"/><rect x="${n12(gx)}" y="${n12(gy)}" width="${n12(v.w * u)}" height="${n12(v.h * u)}" fill="url(#pxfx-g2)"/>`;
  }
  for (const e of m.edges) {
    const g0 = lineGeometry(V, e);
    if (!g0) continue;
    const s = e.step || 0;
    if (!visible(s)) continue;
    const t = FEYNMAN_TYPES[e.particle] || FEYNMAN_TYPES.plain;
    const ink = e.color || o.ink || "#ffffff";
    const loop = e.from === e.to;
    const trim = (id) => (KIND_R[shownKind(V[id], deg)] || 0) / g0.len;
    const t0 = loop ? 0 : Math.min(0.45, trim(e.from)), t1 = loop ? 1 : 1 - Math.min(0.45, trim(e.to));
    const g = t0 > 0 || t1 < 1 ? part(g0, t0, t1) : g0;
    let lines = "";
    if (o.editor && o.sel && o.sel.kind === "e" && o.sel.id === e.id) lines += `<path d="${P(basePoints(g0))}" fill="none" stroke="${esc2(o.accent)}" stroke-opacity=".32" stroke-width="${n12(14 * k)}" stroke-linecap="round"/>`;
    if (t.deco === "wave") lines += stroke(P(wavePoints(g)), ink);
    else if (t.deco === "wave2") lines += stroke(P(wavePoints(g, DBL)), ink) + stroke(P(wavePoints(g, -DBL)), ink);
    else if (t.deco === "coil") lines += stroke(P(coilPoints(g)), ink);
    else if (t.deco === "double") lines += stroke(P(basePoints(g, DBL)), ink, "", lw * 0.8) + stroke(P(basePoints(g, -DBL)), ink, "", lw * 0.8);
    else if (t.dash === "dot") lines += stroke(P(basePoints(g)), ink, ` stroke-dasharray="0.1 ${n12(6 * k)}"`, lw * 1.45);
    else if (t.dash) lines += stroke(P(basePoints(g)), ink, ` stroke-dasharray="${t.dash.split(" ").map((x) => n12(x * k)).join(" ")}"`);
    else lines += stroke(P(basePoints(g)), ink);
    if (t.arrow) {
      const [x, y, tx, ty] = g.at(0.5), X = x * u, Y = -y * u;
      const dx = tx * t.arrow, dy = -ty * t.arrow, nx = -dy, ny = dx, aL = 7.5 * k, aW = 5.4 * k;
      lines += `<path d="M${n12(X + dx * aL)} ${n12(Y + dy * aL)}L${n12(X - dx * aL * 0.75 + nx * aW)} ${n12(Y - dy * aL * 0.75 + ny * aW)}L${n12(X - dx * aL * 0.75 - nx * aW)} ${n12(Y - dy * aL * 0.75 - ny * aW)}Z" fill="${esc2(ink)}"/>`;
    }
    let labels = "";
    const amp = decoAmp(t), ms = e.momentumSide || -1, ls = e.labelSide || 1;
    if (e.momentum) {
      const off = amp + 0.2, pts = [];
      for (let i = 0; i <= 18; i++) {
        const [x2, y2, tx2, ty2] = g.at(0.3 + 0.4 * i / 18);
        pts.push([x2 - ty2 * off * ms, y2 + tx2 * off * ms]);
      }
      if (e.momentumReverse) pts.reverse();
      const a = pts[pts.length - 2], b = pts[pts.length - 1];
      const hx = (b[0] - a[0]) * u, hy = -(b[1] - a[1]) * u, hl = Math.hypot(hx, hy) || 1, ux = hx / hl, uy = hy / hl;
      const BX = b[0] * u, BY = -b[1] * u, hs = 6 * k;
      labels += stroke(P(pts), ink, "", 1.4 * k);
      labels += `<path d="M${n12(BX - ux * hs - uy * hs * 0.6)} ${n12(BY - uy * hs + ux * hs * 0.6)}L${n12(BX)} ${n12(BY)}L${n12(BX - ux * hs + uy * hs * 0.6)} ${n12(BY - uy * hs - ux * hs * 0.6)}" fill="none" stroke="${esc2(ink)}" stroke-width="${n12(1.4 * k)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      const [x, y, tx, ty] = g.at(0.5), nX = -ty * ms, nY = tx * ms;
      const bx = texBox(e.momentum, fs * 0.85), ext = (Math.abs(nX) * bx.w / 2 + Math.abs(nY) * bx.h / 2) / u;
      const L = off + 0.1 + ext;
      labels += label(e.momentum, (x + nX * L) * u, -(y + nY * L) * u, fs * 0.85, ink);
    }
    if (e.label) {
      const [x, y, tx, ty] = g.at(0.5), nX = -ty * ls, nY = tx * ls;
      const bx = texBox(e.label, fs), ext = (Math.abs(nX) * bx.w / 2 + Math.abs(nY) * bx.h / 2) / u;
      const L = amp + 0.13 + ext + (e.momentum && ms === ls ? 0.5 : 0);
      labels += label(e.label, (x + nX * L) * u, -(y + nY * L) * u, fs, ink);
    }
    if (o.editor) labels += `<path class="pxfx-hit" data-e="${esc2(e.id)}" d="${P(basePoints(g0), false)}" fill="none" stroke="#000" stroke-opacity="0" stroke-width="${n12(16 * k)}" pointer-events="stroke"/>`;
    out += wrap(s, lines, labels, basePoints(g0), false, e.id);
  }
  const warn = new Set(o.warn || []);
  for (const v of m.vertices) {
    const s = vertexStep(m, v);
    if (!visible(s)) continue;
    const kind = shownKind(v, deg), ink = v.color || o.ink || "#ffffff", X = v.x * u, Y = -v.y * u;
    let mark = "";
    if (kind === "dot") {
      mark += `<circle cx="${n12(X)}" cy="${n12(Y)}" r="${n12(4.3 * k)}" fill="${esc2(ink)}"/>`;
      grow(X, Y, 4.3 * k);
    } else if (kind === "empty") {
      const r = KIND_R.empty * u;
      mark += `<circle cx="${n12(X)}" cy="${n12(Y)}" r="${n12(r)}" fill="none" stroke="${esc2(ink)}" stroke-width="${n12(1.8 * k)}"/>`;
      grow(X, Y, r);
    } else if (kind === "square") {
      mark += `<rect x="${n12(X - 4.6 * k)}" y="${n12(Y - 4.6 * k)}" width="${n12(9.2 * k)}" height="${n12(9.2 * k)}" fill="${esc2(ink)}"/>`;
      grow(X, Y, 4.6 * k);
    } else if (kind === "crossed") {
      const r = KIND_R.crossed * u, c = r * 0.7;
      mark += `<circle cx="${n12(X)}" cy="${n12(Y)}" r="${n12(r)}" fill="none" stroke="${esc2(ink)}" stroke-width="${n12(1.8 * k)}"/><path d="M${n12(X - c)} ${n12(Y - c)}L${n12(X + c)} ${n12(Y + c)}M${n12(X - c)} ${n12(Y + c)}L${n12(X + c)} ${n12(Y - c)}" stroke="${esc2(ink)}" stroke-width="${n12(1.6 * k)}"/>`;
      grow(X, Y, r);
    } else if (kind === "blob") {
      const r = KIND_R.blob * u;
      mark += `<circle cx="${n12(X)}" cy="${n12(Y)}" r="${n12(r)}" fill="${esc2(ink)}" fill-opacity=".22" stroke="${esc2(ink)}" stroke-width="${n12(2 * k)}"/>`;
      grow(X, Y, r);
    } else if (o.editor) mark += `<circle cx="${n12(X)}" cy="${n12(Y)}" r="3" fill="none" stroke="${esc2(o.mark)}" stroke-width="1.2"/>`;
    let labels = "";
    if (v.label) {
      const d = labelDirection(m, V, v);
      const bx = texBox(v.label, fs), ext = (Math.abs(d[0]) * bx.w / 2 + Math.abs(d[1]) * bx.h / 2) / u;
      const L = (KIND_R[kind] || (kind === "none" ? 0 : 0.07)) + 0.12 + ext;
      labels += label(v.label, (v.x + d[0] * L) * u, -(v.y + d[1] * L) * u, fs, ink);
    }
    if (o.editor) {
      if (warn.has(v.id)) mark += `<circle cx="${n12(X)}" cy="${n12(Y)}" r="${n12(13 * k)}" fill="none" stroke="${esc2(o.warnColor)}" stroke-width="2" stroke-dasharray="4 3"><title>Fermion arrows don’t flow through this vertex</title></circle>`;
      if (o.sel && o.sel.kind === "v" && o.sel.id === v.id) mark += `<circle cx="${n12(X)}" cy="${n12(Y)}" r="${n12(10 * k)}" fill="${esc2(o.accent)}" fill-opacity=".22" stroke="${esc2(o.accent)}" stroke-width="2"/>`;
      labels += `<circle data-v="${esc2(v.id)}" cx="${n12(X)}" cy="${n12(Y)}" r="${n12(12 * k)}" fill="#000" fill-opacity="0"/>`;
    }
    out += wrap(s, mark, labels, null, true, v.id);
  }
  if (o.editor && o.sel && o.sel.kind === "e") {
    const e = m.edges.find((x) => x.id === o.sel.id), g = e && lineGeometry(V, e);
    if (g) {
      const [x, y] = g.at(0.5), loop = e.from === e.to;
      out += `<circle data-h="${loop ? "loop" : "bend"}" cx="${n12(x * u)}" cy="${n12(-y * u)}" r="${n12(6.5 * k)}" fill="${esc2(o.accent)}" stroke="#fff" stroke-width="2"><title>${loop ? "Drag to turn and resize the loop" : "Drag to bend the line"}</title></circle>`;
    }
  }
  const capSteps = Object.keys(m.captions || {}).map(Number).sort((a, b) => a - b);
  if (o.captions && capSteps.length && isFinite(box.x0)) {
    const cs = CAPTION * u, w = Math.max(box.x1 - box.x0, 6 * u), cx = (box.x0 + box.x1) / 2, y = box.y1 + cs * 0.6, h = cs * 2.8;
    const one = (n, cls) => {
      const text = m.captions[n];
      if (o.labels === "text") return `<text${cls} x="${n12(cx)}" y="${n12(y + cs)}" text-anchor="middle" font-size="${n12(cs)}" fill="${esc2(o.ink || "#ffffff")}">${esc2(text)}</text>`;
      return `<foreignObject${cls} x="${n12(cx - w / 2)}" y="${n12(y)}" width="${n12(w)}" height="${n12(h)}" pointer-events="none"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;font-size:${n12(cs)}px;line-height:1.3;color:${esc2(o.ink || "#ffffff")}">${esc2(text)}</div></foreignObject>`;
    };
    if (deck != null) out += capSteps.map((n) => one(n, ` class="pxfx-cap" data-fx-cap="${n}"`)).join("");
    else {
      const cur = stepped ? o.step : maxStep(m);
      const shown = capSteps.filter((n) => n <= cur).pop();
      if (shown != null) out += one(shown, "");
    }
    grow(cx, y + h / 2, w / 2, h / 2);
  }
  if (!isFinite(box.x0)) Object.assign(box, { x0: 0, y0: 0, x1: 5 * u, y1: 2.5 * u });
  return { svg: out, box };
}
function feynmanBox(el) {
  const { box } = drawDiagram(feynmanModel(el), { captions: true });
  const pad = 0.18 * UNIT;
  return { x: box.x0 - pad, y: box.y0 - pad, w: box.x1 - box.x0 + 2 * pad, h: box.y1 - box.y0 + 2 * pad };
}
function feynmanSvg(el, opts = {}) {
  const m = feynmanModel(el);
  const b = feynmanBox(el);
  const { svg } = drawDiagram(m, { ink: m.color, labels: opts.labels || "text", captions: true, deck: opts.deck, step: opts.step, dim: m.dimPast });
  const size = opts.standalone ? ` width="${n12(b.w)}" height="${n12(b.h)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n12(b.x)} ${n12(b.y)} ${n12(b.w)} ${n12(b.h)}" preserveAspectRatio="xMidYMid meet"${size} style="width:100%;height:100%;display:block;overflow:visible">${svg}</svg>`;
}
function feynmanSteps(el) {
  if (el?.type !== "feynman") return [];
  const m = feynmanModel(el), steps = /* @__PURE__ */ new Set();
  for (const e of m.edges) if (e.step > 0) steps.add(e.step);
  for (const v of m.vertices) if (v.step > 0) steps.add(v.step);
  for (const n of Object.keys(m.captions)) if (+n > 0) steps.add(+n);
  return [...steps].sort((a, b) => a - b).map((s) => [m.stepStart - 1 + s, s]).filter(([n]) => n <= 1e3);
}
function feynmanStepMarkers(slide) {
  let html = "";
  for (const el of slide?.elements || []) {
    const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    for (const [n, s] of feynmanSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`;
  }
  return html;
}
function hasFeynman(presentation) {
  return (presentation?.slides || []).some((s) => (s.elements || []).some((el) => el.type === "feynman"));
}
function template(key, name, verts, edges, captions) {
  return { key, name, build() {
    return {
      vertices: verts.map(([id, x, y, label]) => ({ id, x, y, kind: "auto", label: label || "", labelAt: "auto", color: null, step: null })),
      edges: edges.map(([from, to, particle, opts], i) => ({ id: "e" + (i + 1), from, to, particle, bend: 0, label: "", labelSide: 1, momentum: "", momentumSide: -1, momentumReverse: false, color: null, step: 0, ...opts || {} })),
      captions: { ...captions || {} }
    };
  } };
}
var FEYNMAN_TEMPLATES = [
  template(
    "ee",
    "e⁺e⁻ → μ⁺μ⁻",
    [["i1", 0, 2, "e^-"], ["i2", 0, 0, "e^+"], ["a", 1.5, 1], ["b", 3.6, 1], ["f1", 5.1, 2, "\\mu^-"], ["f2", 5.1, 0, "\\mu^+"]],
    [["i1", "a", "fermion", { step: 1 }], ["a", "i2", "fermion", { step: 1 }], ["a", "b", "photon", { label: "\\gamma", momentum: "q", step: 2 }], ["b", "f1", "fermion", { step: 3 }], ["f2", "b", "fermion", { step: 3 }]],
    { 1: "An electron and a positron annihilate", 2: "into a virtual photon,", 3: "which makes a muon pair." }
  ),
  template(
    "ggf",
    "Gluon fusion to a Higgs",
    [["g1", 0, 2.6, "g"], ["g2", 0, -0.6, "g"], ["a", 2, 2], ["b", 2, 0], ["c", 3.6, 1], ["h", 5.6, 1, "H"]],
    [["g1", "a", "gluon", { step: 1 }], ["g2", "b", "gluon", { step: 1 }], ["a", "c", "fermion", { label: "t", step: 2 }], ["c", "b", "fermion", { step: 2 }], ["b", "a", "fermion", { step: 2 }], ["c", "h", "scalar", { step: 3 }]],
    { 1: "Two gluons, one from each proton,", 2: "fuse through a loop of top quarks", 3: "and make a Higgs boson." }
  ),
  template(
    "compton",
    "Compton scattering",
    [["i", 0, 0, "e^-"], ["a", 1.6, 0], ["b", 3.4, 0], ["f", 5, 0, "e^-"], ["g1", 0.2, 1.8, "\\gamma"], ["g2", 4.8, 1.8, "\\gamma"]],
    [["i", "a", "fermion", { step: 1 }], ["g1", "a", "photon", { step: 1 }], ["a", "b", "fermion", { label: "e^-", labelSide: -1, step: 2 }], ["b", "f", "fermion", { step: 3 }], ["b", "g2", "photon", { step: 3 }]],
    { 1: "An electron absorbs a photon,", 2: "travels as a virtual electron", 3: "and emits a photon." }
  ),
  template(
    "moller",
    "Møller scattering (t-channel)",
    [["i1", 0, 2.6, "e^-"], ["a", 2.4, 2.2], ["f1", 4.8, 2.6, "e^-"], ["i2", 0, -0.4, "e^-"], ["b", 2.4, 0], ["f2", 4.8, -0.4, "e^-"]],
    [["i1", "a", "fermion", { step: 1 }], ["i2", "b", "fermion", { step: 1 }], ["a", "b", "photon", { label: "\\gamma", momentum: "q", step: 2 }], ["a", "f1", "fermion", { step: 3 }], ["b", "f2", "fermion", { step: 3 }]],
    { 1: "Two electrons approach,", 2: "exchange a virtual photon", 3: "and scatter." }
  ),
  template(
    "self",
    "Electron self-energy",
    [["i", 0, 0, "e^-"], ["a", 1.4, 0], ["b", 3.6, 0], ["f", 5, 0, "e^-"]],
    [["i", "a", "fermion", { step: 1 }], ["a", "b", "fermion", { step: 1 }], ["b", "f", "fermion", { step: 1 }], ["a", "b", "photon", { bend: 1, label: "\\gamma", step: 2 }]],
    { 1: "An electron propagates,", 2: "emitting and reabsorbing a virtual photon." }
  ),
  template(
    "vacpol",
    "Vacuum polarization",
    [["i", 0, 1], ["a", 1.6, 1], ["b", 3.4, 1], ["f", 5, 1]],
    [["i", "a", "photon", { label: "\\gamma", step: 1 }], ["a", "b", "fermion", { bend: 1, label: "e^-", step: 2 }], ["b", "a", "fermion", { bend: 1, label: "e^+", step: 2 }], ["b", "f", "photon", { label: "\\gamma", step: 3 }]],
    { 1: "A photon", 2: "briefly becomes an electron–positron pair", 3: "and carries on." }
  ),
  template(
    "vertex",
    "QED vertex correction",
    [["g", 2.5, 3.1, "\\gamma"], ["v", 2.5, 2], ["a", 1.4, 0.9], ["b", 3.6, 0.9], ["i", 0.4, -0.3, "e^-"], ["f", 4.6, -0.3, "e^-"]],
    [["i", "a", "fermion", { step: 1 }], ["a", "v", "fermion", { step: 1 }], ["v", "b", "fermion", { step: 1 }], ["b", "f", "fermion", { step: 1 }], ["g", "v", "photon", { step: 1 }], ["a", "b", "photon", { label: "\\gamma", labelSide: -1, step: 2 }]],
    { 1: "An electron scatters off a photon.", 2: "A virtual photon across the vertex is the one-loop correction behind g − 2." }
  ),
  template(
    "beta",
    "β⁻ decay",
    [["i", 0, 0, "d"], ["v1", 2, 0.5], ["u", 4.8, 0, "u"], ["v2", 3.2, 2.1], ["e", 4.8, 3, "e^-"], ["n", 4.8, 1.4, "\\bar{\\nu}_e"]],
    [["i", "v1", "fermion", { step: 1 }], ["v1", "u", "fermion", { step: 1 }], ["v1", "v2", "photon", { label: "W^-", step: 2 }], ["v2", "e", "fermion", { step: 3 }], ["v2", "n", "antifermion", { step: 3 }]],
    { 1: "A down quark turns into an up quark", 2: "by emitting a virtual W⁻,", 3: "which decays to an electron and an electron antineutrino." }
  ),
  { key: "blank", name: "Blank", build: () => ({ vertices: [], edges: [], captions: {} }) }
];

// client/src/utils/circuitParts.js
var CIRCUIT_PARTS = {
  wire: { name: "Wire", key: "w", kind: "short" },
  resistor: { name: "Resistor", key: "r", tikz: "R", kind: "R", unit: "Ω", dflt: 100, chips: ["R", "R_1", "R_2"] },
  capacitor: { name: "Capacitor", key: "c", tikz: "C", kind: "open", unit: "F", dflt: 1e-6, chips: ["C", "C_1"] },
  inductor: { name: "Inductor", key: "l", tikz: "L", kind: "short", unit: "H", dflt: 1e-3, chips: ["L", "L_1"] },
  battery: { name: "Battery", key: "b", tikz: "battery1", kind: "V", unit: "V", dflt: 9, polar: true, chips: ["\\mathcal{E}", "V_0"] },
  vsource: { name: "DC source", key: "e", tikz: "V", kind: "V", unit: "V", dflt: 5, polar: true, chips: ["V_s", "V_1"] },
  acsource: { name: "AC source", tikz: "sV", kind: "V0", unit: "V", dflt: 10, polar: true, chips: ["V_0", "v(t)"] },
  isource: { name: "Current source", key: "i", tikz: "I", kind: "I", unit: "A", dflt: 0.01, polar: true, chips: ["I_s", "I_0"] },
  switch: { name: "Switch", key: "s", tikz: "nos", kind: "switch", chips: ["S", "S_1"] },
  diode: { name: "Diode", key: "d", tikz: "D", kind: "diode", polar: true, chips: ["D", "D_1"] },
  lamp: { name: "Lamp", key: "x", tikz: "lamp", kind: "R", unit: "Ω", dflt: 12, chips: ["B", "B_1"] },
  ammeter: { name: "Ammeter", key: "a", tikz: "ammeter", kind: "short", meter: "A", chips: ["A"] },
  voltmeter: { name: "Voltmeter", key: "m", tikz: "voltmeter", kind: "open", meter: "V", chips: ["V"] }
};
var CIRCUIT_VERTEX_KINDS = [["auto", "Auto"], ["none", "None"], ["dot", "Dot"], ["terminal", "Terminal"]];
var GROUND_DIRS = { down: 0, left: 90, up: 180, right: -90 };
var PREFIX = { p: 1e-12, n: 1e-9, u: 1e-6, "µ": 1e-6, "μ": 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9 };
function parseValue(s) {
  const m = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*([pnuµμmkMG])?/.exec(String(s ?? ""));
  return m ? parseFloat(m[1]) * (m[2] ? PREFIX[m[2]] : 1) : null;
}
function formatSI(v, unit) {
  if (v == null || !isFinite(v)) return "";
  const a = Math.abs(v);
  if (a < 1e-13) return `0 ${unit}`;
  const steps = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"]];
  let pick2 = steps[steps.length - 1];
  for (const s of steps) if (a >= s[0] * 0.9995) {
    pick2 = s;
    break;
  }
  const num7 = v / pick2[0];
  const str6 = Math.abs(num7) >= 99.95 ? String(Math.round(num7)) : String(Number(num7.toPrecision(3)));
  return `${str6} ${pick2[1]}${unit}`;
}
var valueOf = (e) => {
  const v = parseValue(e.value);
  return v == null ? CIRCUIT_PARTS[e.part].dflt ?? 0 : v;
};
var closedAt = (e, step) => !!e.closed !== (e.flipAt != null && step >= e.flipAt);
var isShort = (e, step) => CIRCUIT_PARTS[e.part].kind === "short" || e.part === "switch" && closedAt(e, step);
var ID2 = /^[A-Za-z0-9_-]{1,40}$/;
var COLOR3 = /^#[0-9a-f]{6}$/i;
var LABEL_AT2 = ["above", "below", "left", "right"];
var num4 = (v, lo, hi, dflt) => typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
var int3 = (v, lo, hi, dflt) => typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt;
var str3 = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
function circuitModel(el) {
  const vertices = [], edges = [], ids = /* @__PURE__ */ new Set(), edgeIds = /* @__PURE__ */ new Set();
  for (const v of Array.isArray(el?.vertices) ? el.vertices.slice(0, 500) : []) {
    if (!v || !ID2.test(v.id) || ids.has(v.id)) continue;
    ids.add(v.id);
    vertices.push({
      id: v.id,
      x: num4(v.x, -1e3, 1e3, 0),
      y: num4(v.y, -1e3, 1e3, 0),
      kind: CIRCUIT_VERTEX_KINDS.some(([k]) => k === v.kind) ? v.kind : "auto",
      ground: GROUND_DIRS[v.ground] !== void 0 ? v.ground : null,
      label: str3(v.label, 200),
      labelAt: LABEL_AT2.includes(v.labelAt) ? v.labelAt : "auto",
      step: v.step == null ? null : int3(v.step, 0, 1e3, null)
    });
  }
  for (const e of Array.isArray(el?.edges) ? el.edges.slice(0, 1e3) : []) {
    if (!e || !ID2.test(e.id) || edgeIds.has(e.id) || !ids.has(e.from) || !ids.has(e.to) || e.from === e.to) continue;
    edgeIds.add(e.id);
    edges.push({
      id: e.id,
      from: e.from,
      to: e.to,
      part: CIRCUIT_PARTS[e.part] ? e.part : "wire",
      label: str3(e.label, 200),
      value: str3(e.value, 40),
      flip: !!e.flip,
      current: str3(e.current, 200),
      voltage: str3(e.voltage, 200),
      closed: !!e.closed,
      flipAt: e.flipAt == null ? null : int3(e.flipAt, 1, 1e3, null),
      step: int3(e.step, 0, 1e3, 0)
    });
  }
  const captions = {};
  if (el?.captions && typeof el.captions === "object") {
    for (const [k, v] of Object.entries(el.captions)) {
      const n = Number(k);
      if (Number.isInteger(n) && n >= 0 && n <= 1e3 && typeof v === "string" && v.trim()) captions[n] = v.slice(0, 500);
    }
  }
  return {
    vertices,
    edges,
    captions,
    color: COLOR3.test(el?.color || "") ? el.color : "#ffffff",
    symbols: el?.symbols === "iec" ? "iec" : "us",
    flow: el?.flow !== false,
    readings: el?.readings !== false,
    stepStart: int3(el?.stepStart, 1, 1e3, 1),
    // Off unless chosen: the current runs through what came before too
    dimPast: !!el?.dimPast
  };
}

// client/src/utils/circuitSolve.js
var VF = 0.7;
var GON = 1e3;
var LEAK = 1e-12;
function gauss(A, b) {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-14) return null;
    if (p !== c) {
      [A[c], A[p]] = [A[p], A[c]];
      [b[c], b[p]] = [b[p], b[c]];
    }
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      if (!f) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}
function solveCircuit(m, step = Infinity) {
  const edges = m.edges.filter((e) => (e.step || 0) <= step && e.from !== e.to && CIRCUIT_PARTS[e.part]);
  if (!edges.length) return { status: "empty" };
  const kind = (e) => CIRCUIT_PARTS[e.part].kind;
  const ids = /* @__PURE__ */ new Set();
  for (const e of edges) {
    ids.add(e.from);
    ids.add(e.to);
  }
  const grounded = m.vertices.filter((v) => v.ground && ids.has(v.id)).map((v) => v.id);
  const GND = ":ground";
  const parent2 = { [GND]: GND };
  for (const id of ids) parent2[id] = id;
  const find = (a) => {
    while (parent2[a] !== a) {
      parent2[a] = parent2[parent2[a]];
      a = parent2[a];
    }
    return a;
  };
  const unite = (a, b) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent2[a] = b;
  };
  const shorts = [];
  for (const e of edges) if (isShort(e, step)) {
    unite(e.from, e.to);
    shorts.push([e.from, e.to, e.id]);
  }
  for (const g of grounded) {
    unite(g, GND);
    shorts.push([g, GND, null]);
  }
  const sources = edges.filter((e) => ["V", "V0", "I"].includes(kind(e)));
  if (!sources.length) return { status: "nosource" };
  const vsrc = edges.filter((e) => kind(e) === "V" || kind(e) === "V0");
  for (const e of vsrc) if (find(e.from) === find(e.to)) return { status: "shorted", id: e.id };
  const ref = grounded.length ? find(GND) : find(sources[0].from);
  const nodeOf = {};
  let N = 0;
  for (const id of [...ids, GND]) {
    const r = find(id);
    if (r !== ref && nodeOf[r] == null) nodeOf[r] = N++;
  }
  const ix = (id) => {
    const r = find(id);
    return r === ref ? -1 : nodeOf[r];
  };
  const S = N + vsrc.length;
  const diodes = edges.filter((e) => kind(e) === "diode");
  const on = new Map(diodes.map((d) => [d.id, true]));
  let x = null;
  const volt = (id) => {
    const i = ix(id);
    return i < 0 ? 0 : x[i];
  };
  for (let iter = 0; iter < 30; iter++) {
    const A = Array.from({ length: S }, () => new Float64Array(S)), z = new Float64Array(S);
    const conductance = (a, b, g) => {
      if (a >= 0) A[a][a] += g;
      if (b >= 0) A[b][b] += g;
      if (a >= 0 && b >= 0) {
        A[a][b] -= g;
        A[b][a] -= g;
      }
    };
    for (let i = 0; i < N; i++) A[i][i] += LEAK;
    for (const e of edges) {
      const a = ix(e.from), b = ix(e.to);
      if (kind(e) === "R") conductance(a, b, 1 / Math.max(1e-6, valueOf(e)));
      else if (kind(e) === "diode" && on.get(e.id)) {
        conductance(a, b, GON);
        if (a >= 0) z[a] += GON * VF;
        if (b >= 0) z[b] -= GON * VF;
      } else if (kind(e) === "I") {
        const I2 = valueOf(e);
        if (a >= 0) z[a] -= I2;
        if (b >= 0) z[b] += I2;
      }
    }
    vsrc.forEach((e, k) => {
      const p = ix(e.to), n = ix(e.from), r = N + k;
      if (p >= 0) {
        A[p][r] += 1;
        A[r][p] += 1;
      }
      if (n >= 0) {
        A[n][r] -= 1;
        A[r][n] -= 1;
      }
      z[r] = kind(e) === "V0" ? 0 : valueOf(e);
    });
    x = gauss(A, z);
    if (!x) return { status: "conflict" };
    let changed = false;
    for (const d of diodes) {
      const dv = volt(d.from) - volt(d.to);
      if (on.get(d.id) && GON * (dv - VF) < -1e-9) {
        on.set(d.id, false);
        changed = true;
      } else if (!on.get(d.id) && dv > VF + 1e-6) {
        on.set(d.id, true);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const V = {}, I = {}, P = {}, inj = {};
  for (const id of ids) V[id] = volt(id);
  for (const e of edges) {
    if (isShort(e, step)) continue;
    const dv = volt(e.from) - volt(e.to);
    let c = 0;
    if (kind(e) === "R") {
      const R = Math.max(1e-6, valueOf(e));
      c = dv / R;
      P[e.id] = c * c * R;
    } else if (kind(e) === "diode") c = on.get(e.id) ? GON * (dv - VF) : 0;
    else if (kind(e) === "I") c = valueOf(e);
    else if (kind(e) === "V" || kind(e) === "V0") c = -x[N + vsrc.indexOf(e)];
    I[e.id] = c;
    inj[e.from] = (inj[e.from] || 0) - c;
    inj[e.to] = (inj[e.to] || 0) + c;
  }
  const adj = {};
  for (const [a, b, id] of shorts) {
    (adj[a] = adj[a] || []).push([b, id, 1]);
    (adj[b] = adj[b] || []).push([a, id, -1]);
  }
  const seen = /* @__PURE__ */ new Set();
  for (const [start] of shorts) {
    if (seen.has(start)) continue;
    const order = [start], via = { [start]: null };
    seen.add(start);
    for (let q = 0; q < order.length; q++) {
      for (const [next, id, dir] of adj[order[q]] || []) {
        if (seen.has(next)) continue;
        seen.add(next);
        order.push(next);
        via[next] = [order[q], id, dir];
      }
    }
    const beyond = {};
    for (let q = order.length - 1; q >= 0; q--) {
      const node = order[q];
      beyond[node] = (beyond[node] || 0) + (inj[node] || 0);
      if (!via[node]) continue;
      const [toward, id, dir] = via[node];
      if (id) I[id] = dir === 1 ? -beyond[node] : beyond[node];
      beyond[toward] = (beyond[toward] || 0) + beyond[node];
    }
  }
  for (const e of edges) if (I[e.id] == null || Math.abs(I[e.id]) < 1e-9) I[e.id] = 0;
  const maxI = Math.max(0, ...edges.map((e) => Math.abs(I[e.id])));
  return { status: maxI < 1e-9 ? "still" : "ok", V, I, P, maxI };
}

// client/src/utils/circuitDiagram.js
var CIRCUIT_UNIT = 48;
var BODY = 1;
var LW = 2;
var LABEL2 = 0.34;
var CAPTION2 = 0.3;
var DIRS = { above: [0, 1], below: [0, -1], left: [-1, 0], right: [1, 0] };
var esc3 = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var n13 = (v) => String(Math.round(v * 10) / 10);
var n2 = (v) => String(Math.round(v * 100) / 100);
var clamp2 = (v, a, b) => Math.min(b, Math.max(a, v));
function flowColorFor(ink) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(ink || "");
  const light = !m || 0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16) > 140;
  return light ? "#ffbf47" : "#c26a00";
}
function vertexMap2(m) {
  const V = {};
  for (const v of m.vertices) V[v.id] = v;
  return V;
}
var shownAt = (s, step) => step == null || s <= step;
function connections(m, step = null) {
  const d = {};
  for (const v of m.vertices) d[v.id] = v.ground ? 1 : 0;
  for (const e of m.edges) if (shownAt(e.step || 0, step)) {
    d[e.from] = (d[e.from] || 0) + 1;
    d[e.to] = (d[e.to] || 0) + 1;
  }
  return d;
}
var shownKind2 = (v, conn) => v.kind && v.kind !== "auto" ? v.kind : conn[v.id] >= 3 ? "dot" : "none";
function vertexStep2(m, v) {
  if (v.step != null) return v.step;
  let s = Infinity;
  for (const e of m.edges) if (e.from === v.id || e.to === v.id) s = Math.min(s, e.step || 0);
  return isFinite(s) ? s : 0;
}
function maxStep2(m) {
  let s = 0;
  for (const e of m.edges) {
    s = Math.max(s, e.step || 0);
    if (e.part === "switch" && e.flipAt != null) s = Math.max(s, e.flipAt);
  }
  for (const v of m.vertices) if (v.step != null) s = Math.max(s, v.step);
  return s;
}
function partShape(part2, len2, u, k, lw, ink, style) {
  const L = (x1, y1, x2, y2, w = lw) => `<path d="M${n13(x1)} ${n13(y1)}L${n13(x2)} ${n13(y2)}" stroke="${esc3(ink)}" stroke-width="${n13(w)}" stroke-linecap="round" fill="none"/>`;
  const circ = (cx, r) => `<circle cx="${n13(cx)}" cy="0" r="${n13(r)}" fill="none" stroke="${esc3(ink)}" stroke-width="${n13(lw)}"/>`;
  const b = part2 === "wire" ? 0 : Math.max(Math.min(BODY * u, len2 - 0.3 * u), Math.min(len2 * 0.7, 0.5 * u));
  const a = (len2 - b) / 2, c = len2 / 2;
  const leads = () => L(0, 0, a, 0) + L(a + b, 0, len2, 0);
  const out = { body: "", ext: [0.06 * u, 0.06 * u], glyphs: [], a, b };
  if (part2 === "wire") {
    out.body = L(0, 0, len2, 0);
    out.ext = [0.04 * u, 0.04 * u];
  } else if (part2 === "resistor") {
    if (style === "iec") out.body = leads() + `<rect x="${n13(a)}" y="${n13(-0.14 * u)}" width="${n13(b)}" height="${n13(0.28 * u)}" fill="none" stroke="${esc3(ink)}" stroke-width="${n13(lw)}"/>`;
    else {
      const h = 0.16 * u;
      let d = `M${n13(a)} 0`;
      for (let i = 0; i < 6; i++) d += `L${n13(a + (2 * i + 1) * b / 12)} ${n13(i % 2 ? h : -h)}`;
      out.body = leads() + `<path d="${d}L${n13(a + b)} 0" fill="none" stroke="${esc3(ink)}" stroke-width="${n13(lw)}" stroke-linejoin="round"/>`;
    }
    out.ext = [0.17 * u, 0.17 * u];
  } else if (part2 === "capacitor") {
    const g = 0.08 * u, p = 0.3 * u;
    out.body = L(0, 0, c - g, 0) + L(c + g, 0, len2, 0) + L(c - g, -p, c - g, p, lw * 1.4) + L(c + g, -p, c + g, p, lw * 1.4);
    out.ext = [p, p];
  } else if (part2 === "inductor") {
    if (style === "iec") {
      out.body = leads() + `<rect x="${n13(a)}" y="${n13(-0.11 * u)}" width="${n13(b)}" height="${n13(0.22 * u)}" fill="${esc3(ink)}"/>`;
      out.ext = [0.12 * u, 0.12 * u];
    } else {
      const r = b / 8;
      let d = `M${n13(a)} 0`;
      for (let i = 0; i < 4; i++) d += `A${n13(r)} ${n13(r)} 0 0 1 ${n13(a + (i + 1) * 2 * r)} 0`;
      out.body = leads() + `<path d="${d}" fill="none" stroke="${esc3(ink)}" stroke-width="${n13(lw)}"/>`;
      out.ext = [r + 0.02 * u, 0.04 * u];
    }
  } else if (part2 === "battery") {
    const offs = [-0.27, -0.09, 0.09, 0.27].map((o) => c + o * u);
    out.body = L(0, 0, offs[0], 0) + L(offs[3], 0, len2, 0) + offs.map((x, i) => i % 2 ? L(x, -0.32 * u, x, 0.32 * u) : L(x, -0.15 * u, x, 0.15 * u, lw * 2.2)).join("");
    out.glyphs.push([offs[3] + 0.16 * u, -0.34 * u, "+", 0.3 * u]);
    out.ext = [0.34 * u, 0.33 * u];
  } else if (["vsource", "acsource", "isource", "ammeter", "voltmeter", "lamp"].includes(part2)) {
    const r = 0.3 * u;
    out.body = L(0, 0, c - r, 0) + L(c + r, 0, len2, 0) + circ(c, r);
    out.ext = [r, r];
    if (part2 === "vsource") {
      if (style === "iec") out.body += L(c - r, 0, c + r, 0);
      else {
        out.glyphs.push([c + 0.15 * u, 0, "+", 0.26 * u]);
        out.glyphs.push([c - 0.15 * u, 0, "−", 0.26 * u]);
      }
    } else if (part2 === "acsource") {
      let d = "";
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        d += `${i ? "L" : "M"}${n13(c - 0.17 * u + t * 0.34 * u)} ${n13(-0.1 * u * Math.sin(2 * Math.PI * t))}`;
      }
      out.body += `<path d="${d}" fill="none" stroke="${esc3(ink)}" stroke-width="${n13(lw * 0.85)}"/>`;
    } else if (part2 === "isource") {
      if (style === "iec") out.body += L(c, -r, c, r);
      else out.body += L(c - 0.17 * u, 0, c + 0.08 * u, 0) + `<path d="M${n13(c + 0.19 * u)} 0L${n13(c + 0.05 * u)} ${n13(-0.08 * u)}L${n13(c + 0.05 * u)} ${n13(0.08 * u)}Z" fill="${esc3(ink)}"/>`;
    } else if (part2 === "lamp") {
      const q = 0.21 * u;
      out.body += L(c - q, -q, c + q, q, lw * 0.9) + L(c - q, q, c + q, -q, lw * 0.9);
    } else out.glyphs.push([c, 0, CIRCUIT_PARTS[part2].meter, 0.3 * u, 600]);
  } else if (part2 === "switch") {
    const tr = 0.06 * u, x0 = a, x1 = a + b, ang = 28 * Math.PI / 180;
    const ring = (x) => `<circle cx="${n13(x)}" cy="0" r="${n13(tr)}" fill="none" stroke="${esc3(ink)}" stroke-width="${n13(lw * 0.8)}"/>`;
    out.body = L(0, 0, x0 - tr, 0) + L(x1 + tr, 0, len2, 0) + ring(x0) + ring(x1);
    out.blade = (closed) => closed ? L(x0, 0, x1, 0) : L(x0, 0, x0 + b * Math.cos(ang), -b * Math.sin(ang));
    out.ext = [b * Math.sin(ang) + 0.04 * u, 0.08 * u];
  } else if (part2 === "diode") {
    const t = 0.2 * u, h = 0.22 * u;
    out.body = L(0, 0, c - t, 0) + L(c + t, 0, len2, 0) + `<path d="M${n13(c - t)} ${n13(-h)}L${n13(c - t)} ${n13(h)}L${n13(c + t)} 0Z" fill="${style === "iec" ? "none" : esc3(ink)}" stroke="${esc3(ink)}" stroke-width="${n13(lw)}" stroke-linejoin="round"/>` + L(c + t, -h, c + t, h);
    out.ext = [h, h];
  }
  return out;
}
function drawCircuit(m, o = {}) {
  const u = o.U || CIRCUIT_UNIT, k = u / 48, lw = (o.lw || LW) * k, fs = LABEL2 * u;
  const ink = o.ink || "#ffffff", flowColor = o.flowColor || flowColorFor(ink), V = vertexMap2(m);
  const deck = o.deck != null ? String(o.deck).replace(/[^A-Za-z0-9_-]/g, "") : null;
  const step = deck != null ? null : o.step ?? null;
  const state = step == null ? Infinity : step;
  const conn = connections(m, step);
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (X, Y, rx = 0, ry = rx) => {
    box.x0 = Math.min(box.x0, X - rx);
    box.x1 = Math.max(box.x1, X + rx);
    box.y0 = Math.min(box.y0, Y - ry);
    box.y1 = Math.max(box.y1, Y + ry);
  };
  const label = (tex, X, Y, size) => {
    const b = texBox(tex, size);
    grow(X, Y, b.w / 2, b.h / 2);
    if (o.labels === "deck" || typeof o.labels === "function") {
      const w = b.w * 2 + size * 2, h = b.h * 1.6 + size;
      const inner = o.labels === "deck" ? `<span data-math-latex="${esc3(tex)}" style="font-family:${esc3(MATH_FONT)}">${texLiteHtml(tex)}</span>` : o.labels(tex);
      return `<foreignObject x="${n13(X - w / 2)}" y="${n13(Y - h / 2)}" width="${n13(w)}" height="${n13(h)}" pointer-events="none" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:${n13(size / 1.21)}px;color:${esc3(ink)}">${inner}</div></foreignObject>`;
    }
    return texSvg(tex, X, Y, size, ink);
  };
  const plain = (t, X, Y, size, color2 = ink, weight = 400) => {
    grow(X, Y, Math.max(String(t).length * size * 0.5, size * 0.4) / 2, size * 0.55);
    return `<text x="${n13(X)}" y="${n13(Y + size * 0.34)}" text-anchor="middle" font-family="${esc3(MATH_FONT)}" font-size="${n13(size)}" font-weight="${weight}" fill="${esc3(color2)}">${esc3(t)}</text>`;
  };
  const wrap = (s, lines, labels, reveal, isVertex, id) => {
    if (deck != null) {
      const cls = `pxfx-part${isVertex ? " pxfx-v" : ""}`;
      if (s > 0 && reveal) {
        const mid = `pxfxm-${deck}-${id}`;
        return `<g class="${cls}" data-fx-at="${s}"><mask id="${mid}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000"><path class="pxfx-reveal" pathLength="1" d="${reveal}" fill="none" stroke="#fff" stroke-width="${n13(46 * k)}" stroke-linecap="round"/></mask><g mask="url(#${mid})">${lines}</g><g class="pxfx-fade">${labels}</g></g>`;
      }
      return `<g class="${cls}" data-fx-at="${s}">${lines}${labels}</g>`;
    }
    const faded = step != null && o.dim && step > 0 && s < step;
    return `<g${faded ? ' opacity=".34"' : ""}>${lines}${labels}</g>`;
  };
  let grid = "";
  if (o.editor && o.grid && o.view) {
    const v = o.view, gx = v.x0 * u, gy = -(v.y0 + v.h) * u;
    grid = `<defs><pattern id="pxcx-g1" width="${u / 2}" height="${u / 2}" x="${-u / 4}" y="${-u / 4}" patternUnits="userSpaceOnUse"><circle cx="${u / 4}" cy="${u / 4}" r="1" fill="${esc3(o.mark)}" fill-opacity=".55"/></pattern><pattern id="pxcx-g2" width="${u}" height="${u}" x="${-u / 2}" y="${-u / 2}" patternUnits="userSpaceOnUse"><circle cx="${u / 2}" cy="${u / 2}" r="1.6" fill="${esc3(o.mark)}" fill-opacity=".8"/></pattern></defs><rect x="${n13(gx)}" y="${n13(gy)}" width="${n13(v.w * u)}" height="${n13(v.h * u)}" fill="url(#pxcx-g1)"/><rect x="${n13(gx)}" y="${n13(gy)}" width="${n13(v.w * u)}" height="${n13(v.h * u)}" fill="url(#pxcx-g2)"/>`;
  }
  const warn = new Set(o.warn || []);
  const placed = {};
  let parts = "";
  for (const e of m.edges) {
    const A = V[e.from], B = V[e.to];
    if (!A || !B || A === B) continue;
    const s = e.step || 0;
    if (deck == null && !shownAt(s, step)) continue;
    const P = CIRCUIT_PARTS[e.part] || CIRCUIT_PARTS.wire;
    const X1 = A.x * u, Y1 = -A.y * u, X2 = B.x * u, Y2 = -B.y * u, dx = X2 - X1, dy = Y2 - Y1, len2 = Math.hypot(dx, dy) || 1;
    const ux = dx / len2, uy = dy / len2, ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const G2 = (sx, sy) => [X1 + ux * sx - uy * sy, Y1 + uy * sx + ux * sy];
    const sh = partShape(e.part, len2, u, k, lw, ink, o.style);
    let body = sh.body;
    if (sh.blade) {
      if (deck != null && e.flipAt != null) body += `<g data-fx-in="0-${e.flipAt - 1}">${sh.blade(!!e.closed)}</g><g data-fx-in="${e.flipAt}-">${sh.blade(!e.closed)}</g>`;
      else body += sh.blade(closedAt(e, state));
    }
    grow(X1, Y1, lw);
    grow(X2, Y2, lw);
    for (const [gx, gy] of [G2(len2 / 2, -sh.ext[0]), G2(len2 / 2, sh.ext[1])]) grow(gx, gy);
    let lines = "";
    if (o.editor && o.sel && o.sel.kind === "e" && o.sel.id === e.id) lines += `<path d="M${n13(X1)} ${n13(Y1)}L${n13(X2)} ${n13(Y2)}" stroke="${esc3(o.accent)}" stroke-opacity=".3" stroke-width="${n13(16 * k)}" stroke-linecap="round"/>`;
    if (o.editor && warn.has(e.id)) lines += `<path d="M${n13(X1)} ${n13(Y1)}L${n13(X2)} ${n13(Y2)}" stroke="${esc3(o.warnColor)}" stroke-opacity=".45" stroke-width="${n13(16 * k)}" stroke-linecap="round"/>`;
    lines += `<g transform="translate(${n13(X1)} ${n13(Y1)}) rotate(${n13(ang)})">${body}</g>`;
    for (const [gxs, gys, t, size, weight] of sh.glyphs) {
      const [gx, gy] = G2(gxs, gys);
      lines += plain(t, gx, gy, size, ink, weight || 400);
    }
    let labels = "";
    const side = e.flip ? 1 : -1;
    const place = (sx, sd, gap, bx) => {
      const extPx = sd < 0 ? sh.ext[0] : sh.ext[1], nx = -uy * sd, ny = ux * sd;
      const reach = Math.abs(nx) * bx.w / 2 + Math.abs(ny) * bx.h / 2;
      const [px, py] = G2(sx, sd * (extPx + gap));
      return [px + nx * reach, py + ny * reach, reach * 2];
    };
    if (e.label && e.part !== "wire") {
      const [x, y] = place(len2 / 2, side, 0.12 * u, texBox(e.label, fs));
      labels += label(e.label, x, y, fs);
    }
    let depth = 0;
    const parsed = parseValue(e.value);
    const valueText = P.unit && e.value !== "" ? parsed != null ? formatSI(parsed, P.unit) : e.value : "";
    if (valueText) {
      const bx = { w: Math.max(valueText.length * fs * 0.9 * 0.5, fs * 0.4), h: fs * 0.95 };
      const [x, y, d] = place(len2 / 2, -side, 0.12 * u, bx);
      depth = d;
      labels += plain(valueText, x, y, fs * 0.9);
    }
    if (e.current) {
      const sx = e.part === "wire" ? len2 * 0.62 : len2 - sh.a / 2, hs = 0.12 * u;
      const [tx, ty] = G2(sx + hs * 0.6, 0), [b1x, b1y] = G2(sx - hs * 0.6, -hs * 0.65), [b2x, b2y] = G2(sx - hs * 0.6, hs * 0.65);
      labels += `<path d="M${n13(tx)} ${n13(ty)}L${n13(b1x)} ${n13(b1y)}L${n13(b2x)} ${n13(b2y)}Z" fill="${esc3(ink)}"/>`;
      const [x, y] = place(sx, side, 0.16 * u, texBox(e.current, fs * 0.85));
      labels += label(e.current, x, y, fs * 0.85);
    }
    if (e.voltage && e.part !== "wire") {
      const inset = Math.max(Math.min(sh.a * 0.5, len2 * 0.2), 0.12 * u), off = -side * (sh.ext[side < 0 ? 1 : 0] + 0.2 * u);
      const [px, py] = G2(inset, off), [qx, qy] = G2(len2 - inset, off);
      labels += plain("+", px, py, fs * 0.85) + plain("−", qx, qy, fs * 0.85);
      const [x, y, d] = place(len2 / 2, -side, 0.12 * u + depth, texBox(e.voltage, fs * 0.9));
      depth += d + 0.06 * u;
      labels += label(e.voltage, x, y, fs * 0.9);
    }
    if (o.editor) labels += `<path class="pxcx-hit" data-e="${esc3(e.id)}" d="M${n13(X1)} ${n13(Y1)}L${n13(X2)} ${n13(Y2)}" stroke="#000" stroke-opacity="0" stroke-width="${n13(18 * k)}" pointer-events="stroke"/>`;
    placed[e.id] = { e, X1, Y1, X2, Y2, len: len2, G: G2, at: s, reading: (text, size) => place(len2 / 2, -side, 0.12 * u + depth, { w: text.length * size * 0.5, h: size * 1.05 }) };
    parts += wrap(s, lines, labels, `M${n13(X1)} ${n13(Y1)}L${n13(X2)} ${n13(Y2)}`, false, e.id);
  }
  let verts = "";
  for (const v of m.vertices) {
    const s = vertexStep2(m, v);
    if (deck == null && !shownAt(s, step)) continue;
    const kind = shownKind2(v, conn), X = v.x * u, Y = -v.y * u;
    let mark = "", labels = "";
    if (v.ground) {
      const g = 0.3 * u;
      mark += `<g transform="translate(${n13(X)} ${n13(Y)}) rotate(${GROUND_DIRS[v.ground] ?? 0})" stroke="${esc3(ink)}" stroke-width="${n13(lw)}" stroke-linecap="round" fill="none"><path d="M0 0V${n13(g)}M${n13(-0.27 * u)} ${n13(g)}H${n13(0.27 * u)}M${n13(-0.17 * u)} ${n13(g + 0.09 * u)}H${n13(0.17 * u)}M${n13(-0.07 * u)} ${n13(g + 0.18 * u)}H${n13(0.07 * u)}"/></g>`;
      const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[v.ground];
      grow(X + d[0] * 0.48 * u, Y + d[1] * 0.48 * u, 0.27 * u);
    }
    if (kind === "dot") {
      mark += `<circle cx="${n13(X)}" cy="${n13(Y)}" r="${n13(3.4 * k)}" fill="${esc3(ink)}"/>`;
      grow(X, Y, 3.4 * k);
    } else if (kind === "terminal") {
      mark += `<circle cx="${n13(X)}" cy="${n13(Y)}" r="${n13(4.2 * k)}" fill="none" stroke="${esc3(ink)}" stroke-width="${n13(lw * 0.9)}"/>`;
      grow(X, Y, 4.2 * k);
    } else if (o.editor && conn[v.id] <= 2) mark += `<circle cx="${n13(X)}" cy="${n13(Y)}" r="2.6" fill="none" stroke="${esc3(o.mark)}" stroke-width="1.1"/>`;
    if (v.label) {
      let d = DIRS[v.labelAt];
      if (!d) {
        const legs = [];
        for (const e of m.edges) {
          if (deck == null && !shownAt(e.step || 0, step)) continue;
          const other = e.from === v.id ? V[e.to] : e.to === v.id ? V[e.from] : null;
          if (other) {
            const l = Math.hypot(other.x - v.x, other.y - v.y) || 1;
            legs.push([(other.x - v.x) / l, (other.y - v.y) / l]);
          }
        }
        if (v.ground) legs.push({ down: [0, -1], up: [0, 1], left: [-1, 0], right: [1, 0] }[v.ground]);
        d = awayFrom(legs);
      }
      const bx = texBox(v.label, fs), reach = (Math.abs(d[0]) * bx.w / 2 + Math.abs(d[1]) * bx.h / 2) / u, L = 0.16 + reach;
      labels += label(v.label, (v.x + d[0] * L) * u, -(v.y + d[1] * L) * u, fs);
    }
    if (o.editor) {
      if (warn.has(v.id)) mark += `<circle cx="${n13(X)}" cy="${n13(Y)}" r="${n13(11 * k)}" fill="none" stroke="${esc3(o.warnColor)}" stroke-width="2" stroke-dasharray="4 3"><title>Connected to nothing</title></circle>`;
      if (o.sel && o.sel.kind === "v" && o.sel.id === v.id) mark += `<circle cx="${n13(X)}" cy="${n13(Y)}" r="${n13(9 * k)}" fill="${esc3(o.accent)}" fill-opacity=".22" stroke="${esc3(o.accent)}" stroke-width="2"/>`;
      labels += `<circle data-v="${esc3(v.id)}" cx="${n13(X)}" cy="${n13(Y)}" r="${n13(11 * k)}" fill="#000" fill-opacity="0"/>`;
    }
    if (mark || labels) verts += wrap(s, mark, labels, null, true, v.id);
  }
  const overlay = (sol, upTo) => {
    let under2 = "", over2 = "";
    if (!sol || sol.status !== "ok" && sol.status !== "still") return { under: under2, over: over2 };
    for (const p of Object.values(placed)) {
      const { e } = p;
      if (upTo != null && p.at > upTo) continue;
      const I = sol.I[e.id];
      if (I == null) continue;
      if (o.flow && e.part === "lamp" && (sol.P[e.id] || 0) > 1e-4) {
        const bright = clamp2(sol.P[e.id] / (sol.P[e.id] + 0.35), 0.25, 1), [cx, cy] = p.G(p.len / 2, 0);
        for (const [r, a] of [[0.72, 0.16], [0.52, 0.24], [0.38, 0.36]]) under2 += `<circle cx="${n13(cx)}" cy="${n13(cy)}" r="${n13(r * u)}" fill="#ffcf6b" fill-opacity="${n2(a * bright)}"/>`;
      }
      if (o.flow && sol.maxI > 0 && Math.abs(I) > Math.max(1e-9, sol.maxI * 2e-3)) {
        const f = 0.25 + 0.75 * Math.abs(I) / sol.maxI;
        const d = I > 0 ? `M${n13(p.X1)} ${n13(p.Y1)}L${n13(p.X2)} ${n13(p.Y2)}` : `M${n13(p.X2)} ${n13(p.Y2)}L${n13(p.X1)} ${n13(p.Y1)}`;
        over2 += `<path class="pxcx-flow" d="${d}" fill="none" stroke="${esc3(flowColor)}" stroke-width="${n13(4.2 * k)}" stroke-linecap="round" stroke-dasharray="0.1 14" style="animation-duration:${(0.42 / f).toFixed(2)}s"/>`;
      }
      const meter = CIRCUIT_PARTS[e.part].meter;
      if (o.readings && meter) {
        const text = meter === "A" ? formatSI(Math.abs(I), "A") : formatSI(Math.abs((sol.V[e.from] || 0) - (sol.V[e.to] || 0)), "V");
        const [x, y] = p.reading(text, fs * 0.92);
        over2 += plain(text, x, y, fs * 0.92, flowColor, 600);
      }
    }
    return { under: under2, over: over2 };
  };
  let under = "", over = "";
  if (o.flow || o.readings) {
    if (deck != null) {
      for (const run of o.runs || []) {
        const lay = overlay(run.sol, run.from);
        const span = `${run.from}-${run.to ?? ""}`;
        if (lay.under) under += `<g data-fx-in="${span}">${lay.under}</g>`;
        if (lay.over) over += `<g data-fx-in="${span}">${lay.over}</g>`;
      }
    } else ({ under, over } = overlay(o.sol, step));
    if (under) under = `<g pointer-events="none">${under}</g>`;
    if (over) over = `<g pointer-events="none">${over}</g>`;
  }
  let caps = "";
  const capSteps = Object.keys(m.captions || {}).map(Number).sort((a, b) => a - b);
  if (o.captions && capSteps.length && isFinite(box.x0)) {
    const cs = CAPTION2 * u, w = Math.max(box.x1 - box.x0, 6 * u), cx = (box.x0 + box.x1) / 2, y = box.y1 + cs * 0.6, h = cs * 2.8;
    const one = (n, cls) => {
      const text = m.captions[n];
      if (o.labels === "text") return `<text${cls} x="${n13(cx)}" y="${n13(y + cs)}" text-anchor="middle" font-size="${n13(cs)}" fill="${esc3(ink)}">${esc3(text)}</text>`;
      return `<foreignObject${cls} x="${n13(cx - w / 2)}" y="${n13(y)}" width="${n13(w)}" height="${n13(h)}" pointer-events="none"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;font-size:${n13(cs)}px;line-height:1.3;color:${esc3(ink)}">${esc3(text)}</div></foreignObject>`;
    };
    if (deck != null) caps = capSteps.map((n) => one(n, ` class="pxfx-cap" data-fx-cap="${n}"`)).join("");
    else {
      const shown = capSteps.filter((n) => n <= (step ?? maxStep2(m))).pop();
      if (shown != null) caps = one(shown, "");
    }
    grow(cx, y + h / 2, w / 2, h / 2);
  }
  if (!isFinite(box.x0)) Object.assign(box, { x0: 0, y0: 0, x1: 6 * u, y1: 3 * u });
  return { svg: grid + under + parts + verts + over + caps, box };
}
function awayFrom(dirs) {
  if (!dirs.length) return [0, 1];
  let best = [0, 1], score = -Infinity, sx = 0, sy = 0;
  for (const d of dirs) {
    sx += d[0];
    sy += d[1];
  }
  const sl = Math.hypot(sx, sy);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, c = [Math.round(Math.cos(a) * 1e6) / 1e6, Math.round(Math.sin(a) * 1e6) / 1e6];
    let gap = Infinity;
    for (const d of dirs) gap = Math.min(gap, Math.acos(clamp2(c[0] * d[0] + c[1] * d[1], -1, 1)));
    const sc = gap + (sl > 0.2 ? 0.3 * (-(sx * c[0] + sy * c[1]) / sl) : 0) + (i % 2 ? -0.05 : 0) + 0.04 * c[1];
    if (sc > score) {
      score = sc;
      best = c;
    }
  }
  return best;
}
function circuitSteps(el) {
  if (el?.type !== "circuit") return [];
  const m = circuitModel(el);
  return modelSteps(m).map((s) => [m.stepStart - 1 + s, s]).filter(([n]) => n <= 1e3);
}
function modelSteps(m) {
  const steps = /* @__PURE__ */ new Set();
  for (const e of m.edges) {
    if (e.step > 0) steps.add(e.step);
    if (e.part === "switch" && e.flipAt != null) steps.add(e.flipAt);
  }
  for (const v of m.vertices) if (v.step > 0) steps.add(v.step);
  for (const n of Object.keys(m.captions)) if (+n > 0) steps.add(+n);
  return [...steps].sort((a, b) => a - b);
}
function circuitStepMarkers(slide) {
  let html = "";
  for (const el of slide?.elements || []) {
    const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    for (const [n, s] of circuitSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`;
  }
  return html;
}
function hasCircuits(presentation) {
  return (presentation?.slides || []).some((s) => (s.elements || []).some((el) => el.type === "circuit"));
}
function solutionRuns(m) {
  const starts = [0, ...modelSteps(m)];
  return starts.map((from, i) => ({ from, to: i + 1 < starts.length ? starts[i + 1] - 1 : null, sol: solveCircuit(m, from) }));
}
var baseOptions = (m) => ({ ink: m.color, style: m.symbols, captions: true, flow: m.flow, readings: m.readings });
function circuitBox(el) {
  const m = circuitModel(el);
  const { box } = drawCircuit(m, { ...baseOptions(m), sol: m.flow || m.readings ? solveCircuit(m) : null });
  const pad = 0.2 * CIRCUIT_UNIT;
  return { x: box.x0 - pad, y: box.y0 - pad, w: box.x1 - box.x0 + 2 * pad, h: box.y1 - box.y0 + 2 * pad };
}
function circuitSvg(el, opts = {}) {
  const m = circuitModel(el), b = circuitBox(el), solved = m.flow || m.readings;
  const o = { ...baseOptions(m), labels: opts.labels || "text" };
  const { svg } = opts.deck != null ? drawCircuit(m, { ...o, deck: opts.deck, runs: solved ? solutionRuns(m) : [] }) : drawCircuit(m, { ...o, step: opts.step ?? null, dim: m.dimPast, sol: solved ? solveCircuit(m, opts.step ?? Infinity) : null });
  const size = opts.standalone ? ` width="${n13(b.w)}" height="${n13(b.h)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n13(b.x)} ${n13(b.y)} ${n13(b.w)} ${n13(b.h)}" preserveAspectRatio="xMidYMid meet"${size} style="width:100%;height:100%;display:block;overflow:visible">${svg}</svg>`;
}
function template2(key, name, verts, edges, captions = {}) {
  return { key, name, build() {
    return {
      vertices: verts.map(([id, x, y, more]) => ({ id, x, y, kind: "auto", ground: null, label: "", labelAt: "auto", step: null, ...more || {} })),
      edges: edges.map(([from, to, part2, more], i) => ({ id: "e" + (i + 1), from, to, part: part2, label: "", value: "", flip: false, current: "", voltage: "", closed: false, flipAt: null, step: 0, ...more || {} })),
      captions: { ...captions }
    };
  } };
}
var CIRCUIT_TEMPLATES = [
  template2(
    "lamp",
    "Switch and lamp",
    [["a", 0, 0], ["b", 0, 3], ["c", 2.5, 3], ["d", 5, 3], ["e", 5, 0], ["f", 2.5, 0], ["g", 6.5, 3], ["h", 6.5, 0]],
    [
      ["a", "b", "battery", { label: "\\mathcal{E}", value: "9", step: 1 }],
      ["b", "c", "switch", { label: "S", flipAt: 3, step: 1 }],
      ["c", "d", "resistor", { label: "R", value: "18", step: 1 }],
      ["d", "e", "lamp", { label: "B", value: "12", step: 1 }],
      ["e", "f", "ammeter", { step: 1 }],
      ["f", "a", "wire", { step: 1 }],
      ["d", "g", "wire", { step: 2 }],
      ["g", "h", "voltmeter", { flip: true, step: 2 }],
      ["h", "e", "wire", { step: 2 }]
    ],
    { 1: "A battery, a switch, a resistor and a lamp in series,", 2: "with a voltmeter across the lamp.", 3: "Close the switch: 300 mA flows, and the lamp lights." }
  ),
  template2(
    "parallel",
    "Parallel branches",
    [["a", 0, 0], ["b", 0, 3], ["c", 2.5, 3], ["d", 4.5, 3], ["e", 6.5, 3], ["f", 2.5, 0], ["g", 4.5, 0], ["h", 6.5, 0]],
    [
      ["a", "b", "battery", { label: "\\mathcal{E}", value: "6", step: 1 }],
      ["b", "c", "ammeter", { step: 1 }],
      ["c", "f", "resistor", { label: "R_1", value: "10", step: 1 }],
      ["f", "a", "wire", { step: 1 }],
      ["c", "d", "wire", { step: 2 }],
      ["d", "g", "resistor", { label: "R_2", value: "20", step: 2 }],
      ["g", "f", "wire", { step: 2 }],
      ["d", "e", "wire", { step: 3 }],
      ["e", "h", "resistor", { label: "R_3", value: "30", step: 3 }],
      ["h", "g", "wire", { step: 3 }]
    ],
    { 1: "One resistor draws 600 mA.", 2: "A second branch adds 300 mA,", 3: "and a third 200 mA: 1.1 A from the battery." }
  ),
  template2(
    "divider",
    "Voltage divider",
    [["a", 0, 0, { ground: "down" }], ["b", 0, 4], ["c", 3, 4], ["d", 3, 2], ["e", 3, 0], ["o", 5.5, 2, { label: "V_\\mathrm{out}", labelAt: "right" }], ["p", 5.5, 0]],
    [
      ["a", "b", "vsource", { label: "V_s", value: "10" }],
      ["b", "c", "wire"],
      ["c", "d", "resistor", { label: "R_1", value: "1k" }],
      ["d", "e", "resistor", { label: "R_2", value: "2k" }],
      ["e", "a", "wire"],
      ["d", "o", "wire"],
      ["o", "p", "voltmeter"],
      ["p", "e", "wire"]
    ]
  ),
  template2(
    "bridge",
    "Wheatstone bridge",
    [["L", 0, 1.5], ["T", 2, 3.5], ["R", 4, 1.5], ["B", 2, -0.5], ["p", 0, -2], ["q", 4, -2]],
    [
      ["L", "T", "resistor", { label: "R_1", value: "100" }],
      ["T", "R", "resistor", { label: "R_2", value: "200" }],
      ["B", "L", "resistor", { label: "R_3", value: "100" }],
      ["R", "B", "resistor", { label: "R_x", value: "300" }],
      ["T", "B", "ammeter", { label: "G" }],
      ["L", "p", "wire"],
      ["p", "q", "battery", { label: "\\mathcal{E}", value: "12" }],
      ["q", "R", "wire"]
    ]
  ),
  template2(
    "diode",
    "Diode and resistor",
    [["a", 0, 0], ["b", 0, 3], ["c", 2.5, 3], ["d", 5, 3], ["e", 5, 0]],
    [["a", "b", "vsource", { label: "V_s", value: "5" }], ["b", "c", "resistor", { label: "R", value: "430" }], ["c", "d", "diode", { label: "D" }], ["d", "e", "ammeter"], ["e", "a", "wire"]]
  ),
  template2(
    "rc",
    "RC circuit",
    [["a", 0, 0], ["b", 0, 3], ["c", 2.5, 3], ["d", 5, 3], ["e", 5, 0]],
    [
      ["a", "b", "battery", { label: "\\mathcal{E}", value: "9", step: 1 }],
      ["b", "c", "switch", { label: "S", flipAt: 2, step: 1 }],
      ["c", "d", "resistor", { label: "R", value: "10k", step: 1 }],
      ["d", "e", "capacitor", { label: "C", value: "100u", voltage: "V_C", step: 1 }],
      ["e", "a", "wire", { step: 1 }]
    ],
    { 2: "Closing the switch charges C through R. Once it has charged, no current flows." }
  ),
  template2(
    "rlc",
    "Series RLC (AC)",
    [["a", 0, 0], ["b", 0, 3], ["c", 2.5, 3], ["d", 5, 3], ["e", 5, 0]],
    [
      ["a", "b", "acsource", { label: "v(t)" }],
      ["b", "c", "resistor", { label: "R", value: "50" }],
      ["c", "d", "inductor", { label: "L", value: "10m" }],
      ["d", "e", "capacitor", { label: "C", value: "1u" }],
      ["e", "a", "wire", { current: "i(t)" }]
    ]
  ),
  { key: "blank", name: "Blank", build: () => ({ vertices: [], edges: [], captions: {} }) }
];

// client/src/utils/logicParts.js
var LOGIC_PARTS = {
  input: { name: "Input", key: "i", tikz: "ocirc" },
  output: { name: "Output", key: "o", tikz: "ocirc" },
  clock: { name: "Clock", key: "k", tikz: "ocirc" },
  and: { name: "AND", key: "a", gate: "and", multi: true, iec: "&", tikz: "and port" },
  or: { name: "OR", key: "r", gate: "or", multi: true, iec: "≥1", tikz: "or port" },
  not: { name: "NOT", key: "n", gate: "buf", inv: true, iec: "1", tikz: "not port" },
  nand: { name: "NAND", gate: "and", inv: true, multi: true, iec: "&", tikz: "nand port" },
  nor: { name: "NOR", gate: "or", inv: true, multi: true, iec: "≥1", tikz: "nor port" },
  xor: { name: "XOR", key: "x", gate: "xor", multi: true, iec: "=1", tikz: "xor port" },
  xnor: { name: "XNOR", gate: "xor", inv: true, multi: true, iec: "=1", tikz: "xnor port" },
  buf: { name: "Buffer", gate: "buf", iec: "1", tikz: "buffer port" },
  dff: { name: "D flip-flop", key: "f", tikz: "flipflop D" }
};
var LOGIC_GATES = Object.keys(LOGIC_PARTS).filter((k) => LOGIC_PARTS[k].gate);
var LOGIC_SNAP = 0.25;
function pinsOf(p) {
  const K = LOGIC_PARTS[p.kind];
  if (K.gate) {
    const n = K.multi ? Math.min(4, Math.max(2, p.inputs || 2)) : 1;
    const ins = Array.from({ length: n }, (_, i) => ({ name: "in" + (i + 1), x: p.x - 0.75, y: p.y + ((n - 1) / 2 - i) * 0.5, io: "in" }));
    return [...ins, { name: "out", x: p.x + 0.75, y: p.y, io: "out" }];
  }
  if (p.kind === "input" || p.kind === "clock") return [{ name: "out", x: p.x + 0.75, y: p.y, io: "out" }];
  if (p.kind === "output") return [{ name: "in", x: p.x - 0.75, y: p.y, io: "in" }];
  return [
    { name: "d", x: p.x - 1, y: p.y + 0.5, io: "in" },
    { name: "clk", x: p.x - 1, y: p.y - 0.5, io: "in" },
    { name: "q", x: p.x + 1, y: p.y + 0.5, io: "out" },
    { name: "qn", x: p.x + 1, y: p.y - 0.5, io: "out" }
  ];
}
function endpoints(m, step = null) {
  const E = /* @__PURE__ */ new Map();
  for (const p of m.parts) if (step == null || (p.step || 0) <= step) for (const pin of pinsOf(p)) E.set(`${p.id}.${pin.name}`, { ...pin, part: p });
  for (const n of m.nodes) if (step == null || (n.step || 0) <= step) E.set(n.id, { x: n.x, y: n.y, node: n });
  return E;
}
var snapTo = (v) => Math.round(v / LOGIC_SNAP) * LOGIC_SNAP;
function route(P, Q, mx) {
  if (Math.abs(P.y - Q.y) < 1e-9) return [P, Q];
  const x = mx ?? snapTo((P.x + Q.x) / 2);
  return [P, { x, y: P.y }, { x, y: Q.y }, Q].filter((p, i, a) => i === 0 || Math.hypot(p.x - a[i - 1].x, p.y - a[i - 1].y) > 1e-9);
}
var inputAt = (p, s) => {
  let v = p.value ? 1 : 0;
  for (const f of p.flips || []) if (f <= s) v = 1 - v;
  return v;
};
var clockAt = (p, s) => {
  const a = p.start ?? 1, b = p.end ?? 8;
  return s >= a && s <= b ? (s - a) % 2 === 0 ? 1 : 0 : 0;
};
var ID3 = /^[A-Za-z0-9_-]{1,40}$/;
var COLOR4 = /^#[0-9a-f]{6}$/i;
var num5 = (v, lo, hi, dflt) => typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
var int4 = (v, lo, hi, dflt) => typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt;
var str4 = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
function logicModel(el) {
  const parts = [], nodes = [], wires = [], ids = /* @__PURE__ */ new Set();
  for (const p of Array.isArray(el?.parts) ? el.parts.slice(0, 300) : []) {
    if (!p || !ID3.test(p.id) || ids.has(p.id) || !LOGIC_PARTS[p.kind]) continue;
    ids.add(p.id);
    const K = LOGIC_PARTS[p.kind];
    const out = { id: p.id, kind: p.kind, x: num5(p.x, -1e3, 1e3, 0), y: num5(p.y, -1e3, 1e3, 0), label: str4(p.label, 200), step: int4(p.step, 0, 1e3, 0) };
    if (K.multi) out.inputs = int4(p.inputs, 2, 4, 2);
    if (p.kind === "input") {
      out.value = p.value ? 1 : 0;
      out.flips = [...new Set((Array.isArray(p.flips) ? p.flips : []).filter((f) => Number.isInteger(f) && f >= 1 && f <= 1e3))].sort((a, b) => a - b).slice(0, 200);
    }
    if (p.kind === "clock") {
      out.start = int4(p.start, 0, 1e3, 1);
      out.end = Math.max(out.start, int4(p.end, 0, 1e3, 8));
    }
    parts.push(out);
  }
  for (const n of Array.isArray(el?.nodes) ? el.nodes.slice(0, 500) : []) {
    if (!n || !ID3.test(n.id) || ids.has(n.id)) continue;
    ids.add(n.id);
    nodes.push({ id: n.id, x: num5(n.x, -1e3, 1e3, 0), y: num5(n.y, -1e3, 1e3, 0), step: int4(n.step, 0, 1e3, 0) });
  }
  const E = endpoints({ parts, nodes });
  const wireIds = /* @__PURE__ */ new Set();
  for (const w of Array.isArray(el?.wires) ? el.wires.slice(0, 1e3) : []) {
    if (!w || !ID3.test(w.id) || wireIds.has(w.id) || !E.has(w.from) || !E.has(w.to) || w.from === w.to) continue;
    wireIds.add(w.id);
    wires.push({ id: w.id, from: w.from, to: w.to, mx: typeof w.mx === "number" && isFinite(w.mx) ? num5(w.mx, -1e3, 1e3, 0) : null, step: int4(w.step, 0, 1e3, 0) });
  }
  const captions = {};
  if (el?.captions && typeof el.captions === "object") {
    for (const [k, v] of Object.entries(el.captions)) {
      const n = Number(k);
      if (Number.isInteger(n) && n >= 0 && n <= 1e3 && typeof v === "string" && v.trim()) captions[n] = v.slice(0, 500);
    }
  }
  return {
    parts,
    nodes,
    wires,
    captions,
    color: COLOR4.test(el?.color || "") ? el.color : "#ffffff",
    symbols: el?.symbols === "iec" ? "iec" : "us",
    values: el?.values !== false,
    table: !!el?.table,
    stepStart: int4(el?.stepStart, 1, 1e3, 1)
  };
}

// client/src/utils/logicSim.js
function gateOut(kind, ins) {
  const K = LOGIC_PARTS[kind];
  let v;
  if (K.gate === "and") v = ins.some((x) => x === 0) ? 0 : ins.every((x) => x === 1) ? 1 : null;
  else if (K.gate === "or") v = ins.some((x) => x === 1) ? 1 : ins.every((x) => x === 0) ? 0 : null;
  else if (K.gate === "xor") v = ins.some((x) => x == null) ? null : ins.reduce((a, b) => a ^ b, 0);
  else v = ins[0] ?? null;
  return v == null ? null : K.inv ? 1 - v : v;
}
var everythingAtOnce = (m) => ({ ...m, parts: m.parts.map((p) => ({ ...p, step: 0 })), wires: m.wires.map((w) => ({ ...w, step: 0 })), nodes: m.nodes.map((n) => ({ ...n, step: 0 })) });
function simulateLogic(m, upto, override = null) {
  const states = [], outVal = {}, ffQ = {}, lastClk = {};
  for (const p of m.parts) if (p.kind === "dff") ffQ[p.id] = 0;
  for (let s = 0; s <= upto; s++) {
    const E = endpoints(m, s);
    const parts = m.parts.filter((p) => (p.step || 0) <= s);
    const wires = m.wires.filter((w) => (w.step || 0) <= s && E.has(w.from) && E.has(w.to));
    const parent2 = {};
    for (const id of E.keys()) parent2[id] = id;
    const find = (a) => {
      while (parent2[a] !== a) {
        parent2[a] = parent2[parent2[a]];
        a = parent2[a];
      }
      return a;
    };
    for (const w of wires) {
      const a = find(w.from), b = find(w.to);
      if (a !== b) parent2[a] = b;
    }
    const drivers = {};
    for (const [id, e] of E) if (e.io === "out") (drivers[find(id)] = drivers[find(id)] || []).push(id);
    const conflicts = /* @__PURE__ */ new Set();
    const netVal = (net) => {
      const ds = drivers[net];
      if (!ds) return null;
      const vals = [...new Set(ds.map((d) => outVal[d] ?? null))];
      if (vals.length > 1) {
        if (!vals.includes(null)) conflicts.add(net);
        return null;
      }
      return vals[0];
    };
    const pinIn = (id) => netVal(find(id));
    let oscillates = false;
    const relax = (again = true) => {
      for (let iter = 0; iter < 200; iter++) {
        let changed = false;
        const set = (id, v) => {
          if (outVal[id] !== v) {
            outVal[id] = v;
            changed = true;
          }
        };
        for (const p of parts) {
          if (p.kind === "input") set(`${p.id}.out`, override && override.has(p.id) ? override.get(p.id) : inputAt(p, s));
          else if (p.kind === "clock") set(`${p.id}.out`, clockAt(p, s));
          else if (p.kind === "dff") {
            set(`${p.id}.q`, ffQ[p.id]);
            set(`${p.id}.qn`, ffQ[p.id] == null ? null : 1 - ffQ[p.id]);
          } else if (LOGIC_PARTS[p.kind].gate) set(`${p.id}.out`, gateOut(p.kind, pinsOf(p).filter((x) => x.io === "in").map((x) => pinIn(`${p.id}.${x.name}`))));
        }
        if (!changed) return;
      }
      oscillates = true;
      if (!again) return;
      for (const p of parts) if (LOGIC_PARTS[p.kind].gate) outVal[`${p.id}.out`] = null;
      relax(false);
    };
    relax();
    for (let round3 = 0; round3 < 10; round3++) {
      const fired = [];
      for (const p of parts) {
        if (p.kind !== "dff") continue;
        const clk = pinIn(`${p.id}.clk`);
        if (s > 0 && lastClk[p.id] === 0 && clk === 1) fired.push([p.id, pinIn(`${p.id}.d`)]);
        lastClk[p.id] = clk;
      }
      if (!fired.length) break;
      for (const [id, d] of fired) ffQ[id] = d;
      relax();
    }
    const at = {}, wire = {};
    for (const id of E.keys()) at[id] = netVal(find(id));
    for (const w of wires) wire[w.id] = netVal(find(w.from));
    const floating = parts.flatMap((p) => pinsOf(p).filter((x) => x.io === "in" && !drivers[find(`${p.id}.${x.name}`)]).map((x) => `${p.id}.${x.name}`));
    states.push({ at, wire, floating, conflicts: conflicts.size, oscillates });
  }
  return states;
}
var inputsOf = (m) => m.parts.filter((p) => p.kind === "input").sort((a, b) => b.y - a.y || a.x - b.x);
var outputsOf = (m) => m.parts.filter((p) => p.kind === "output").sort((a, b) => b.y - a.y || a.x - b.x);
function netsOf(m) {
  const E = endpoints(m), parent2 = {};
  for (const id of E.keys()) parent2[id] = id;
  const find = (a) => {
    while (parent2[a] !== a) {
      parent2[a] = parent2[parent2[a]];
      a = parent2[a];
    }
    return a;
  };
  for (const w of m.wires) if (E.has(w.from) && E.has(w.to)) {
    const a = find(w.from), b = find(w.to);
    if (a !== b) parent2[a] = b;
  }
  return find;
}
function hasFeedback(m) {
  const find = netsOf(m);
  const gates = m.parts.filter((p) => LOGIC_PARTS[p.kind].gate);
  const feeds = new Map(gates.map((g) => [g.id, gates.filter((h) => pinsOf(h).some((x) => x.io === "in" && find(`${h.id}.${x.name}`) === find(`${g.id}.out`))).map((h) => h.id)]));
  const state = {};
  const visit = (id) => {
    if (state[id] === 1) return true;
    if (state[id] === 2) return false;
    state[id] = 1;
    for (const n of feeds.get(id) || []) if (visit(n)) return true;
    state[id] = 2;
    return false;
  };
  return gates.some((g) => visit(g.id));
}
function truthTable(m) {
  if (m.parts.some((p) => p.kind === "dff" || p.kind === "clock")) return { why: "It has a flip-flop or a clock, so it remembers: no truth table." };
  const ins = inputsOf(m), outs = outputsOf(m);
  if (!ins.length || !outs.length) return { why: "Add inputs and outputs for a truth table." };
  if (ins.length > 6) return { why: "More than six inputs: too many rows for a truth table." };
  if (hasFeedback(m)) return { why: "It has feedback, so it can remember: no truth table." };
  const flat = everythingAtOnce(m), rows = [];
  for (let k = 0; k < 2 ** ins.length; k++) {
    const vals = ins.map((p, i) => k >> ins.length - 1 - i & 1);
    const st = simulateLogic(flat, 0, new Map(ins.map((p, i) => [p.id, vals[i]])))[0];
    rows.push([...vals, ...outs.map((o) => st.at[`${o.id}.in`])]);
  }
  return { ins, outs, rows };
}
function rowOf(tt, state) {
  if (!tt.rows || !state) return -1;
  return tt.rows.findIndex((r) => tt.ins.every((p, i) => state.at[`${p.id}.out`] === r[i]));
}
function logicDepths(m) {
  const find = netsOf(m), level = {};
  for (const p of m.parts) for (const x of pinsOf(p)) if (x.io === "out" && !LOGIC_PARTS[p.kind].gate) level[find(`${p.id}.${x.name}`)] = 0;
  const gates = m.parts.filter((p) => LOGIC_PARTS[p.kind].gate);
  for (let i = 0; i < gates.length + 2; i++) {
    for (const g of gates) {
      const ins = pinsOf(g).filter((x) => x.io === "in").map((x) => level[find(`${g.id}.${x.name}`)] ?? 0);
      level[find(`${g.id}.out`)] = Math.min(12, 1 + Math.max(0, ...ins));
    }
  }
  return (id) => level[find(id)] ?? 0;
}

// client/src/utils/logicDiagram.js
var LOGIC_UNIT = 56;
var LW2 = 2;
var CAPTION3 = 0.3;
var esc4 = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var n14 = (v) => String(Math.round(v * 10) / 10);
function signalColors(ink) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(ink || "");
  const light = !m || 0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16) > 140;
  return light ? { hi: "#4ade80", lo: "#5d6a85", unk: "#f5a524" } : { hi: "#16a34a", lo: "#a7b0c2", unk: "#d97706" };
}
function maxStep3(m) {
  let s = 0;
  for (const p of m.parts) {
    s = Math.max(s, p.step || 0, ...p.flips || []);
    if (p.kind === "clock") s = Math.max(s, p.end ?? 8);
  }
  for (const w of m.wires) s = Math.max(s, w.step || 0);
  for (const n of m.nodes) s = Math.max(s, n.step || 0);
  for (const k of Object.keys(m.captions || {})) s = Math.max(s, +k);
  return s;
}
function logicBounds(m) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of m.parts) {
    const r = p.kind === "dff" ? 1.1 : 0.9, hh = p.kind === "dff" ? 1 : Math.max(0.5, ((p.inputs || 2) - 1) * 0.25 + 0.3);
    x0 = Math.min(x0, p.x - r - (p.kind === "input" || p.kind === "clock" ? 0.6 : 0));
    x1 = Math.max(x1, p.x + r + (p.kind === "output" ? 0.6 : 0));
    y0 = Math.min(y0, p.y - hh);
    y1 = Math.max(y1, p.y + hh);
  }
  for (const n of m.nodes) {
    x0 = Math.min(x0, n.x);
    x1 = Math.max(x1, n.x);
    y0 = Math.min(y0, n.y);
    y1 = Math.max(y1, n.y);
  }
  return isFinite(x0) ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 6, y1: 3 };
}
function gateGeometry(p, u) {
  const K = LOGIC_PARTS[p.kind], ins = pinsOf(p).filter((x) => x.io === "in"), n = ins.length;
  const h = (K.multi ? Math.max(0.47, (n - 1) * 0.25 + 0.22) : 0.36) * u;
  return { K, ins, n, h };
}
function partBase(p, u, ink, style, label) {
  const K = LOGIC_PARTS[p.kind], X = p.x * u, Y = -p.y * u, lw = LW2;
  const stroke = `fill="none" stroke="${esc4(ink)}" stroke-width="${n14(lw)}" stroke-linejoin="round"`;
  const text = (t, x, y, fs) => `<text x="${n14(x)}" y="${n14(y + fs * 0.34)}" text-anchor="middle" font-family="${esc4(MATH_FONT)}" font-size="${n14(fs)}" fill="${esc4(ink)}">${esc4(t)}</text>`;
  let out = "";
  if (K.gate) {
    const { h } = gateGeometry(p, u), xb = X - 0.5 * u, xf = X + 0.5 * u;
    let front = xf;
    if (style === "iec") {
      out += `<rect x="${n14(X - 0.42 * u)}" y="${n14(Y - h)}" width="${n14(0.84 * u)}" height="${n14(2 * h)}" ${stroke}/>` + text(K.iec, X, Y, 0.3 * u);
      front = X + 0.42 * u;
    } else if (K.gate === "and") {
      const rx = Math.min(h, 0.55 * u);
      out += `<path d="M${n14(xb)} ${n14(Y - h)}H${n14(xf - rx)}A${n14(rx)} ${n14(h)} 0 0 1 ${n14(xf - rx)} ${n14(Y + h)}H${n14(xb)}Z" ${stroke}/>`;
    } else if (K.gate === "or" || K.gate === "xor") {
      const c = 0.22 * u;
      out += `<path d="M${n14(xb)} ${n14(Y - h)}Q${n14(xb + c)} ${n14(Y)} ${n14(xb)} ${n14(Y + h)}Q${n14(X + 0.15 * u)} ${n14(Y + h)} ${n14(xf)} ${n14(Y)}Q${n14(X + 0.15 * u)} ${n14(Y - h)} ${n14(xb)} ${n14(Y - h)}Z" ${stroke}/>`;
      if (K.gate === "xor") out += `<path d="M${n14(xb - 0.14 * u)} ${n14(Y - h)}Q${n14(xb - 0.14 * u + c)} ${n14(Y)} ${n14(xb - 0.14 * u)} ${n14(Y + h)}" ${stroke}/>`;
    } else {
      out += `<path d="M${n14(X - 0.35 * u)} ${n14(Y - 0.33 * u)}L${n14(X - 0.35 * u)} ${n14(Y + 0.33 * u)}L${n14(X + 0.3 * u)} ${n14(Y)}Z" ${stroke}/>`;
      front = X + 0.3 * u;
    }
    if (K.inv) out += `<circle cx="${n14(front + 0.08 * u)}" cy="${n14(Y)}" r="${n14(0.08 * u)}" ${stroke}/>`;
    if (p.label) out += label(p.label, X, Y - h - 0.24 * u, 0.28 * u);
  } else if (p.kind === "input" || p.kind === "clock") {
    out += `<rect x="${n14(X - 0.32 * u)}" y="${n14(Y - 0.27 * u)}" width="${n14(0.64 * u)}" height="${n14(0.54 * u)}" rx="${n14(0.08 * u)}" ${stroke}/>`;
    if (p.label) {
      const b = texBox(p.label, 0.32 * u);
      out += label(p.label, X - 0.48 * u - b.w / 2, Y, 0.32 * u);
    }
  } else if (p.kind === "output") {
    out += `<circle cx="${n14(X)}" cy="${n14(Y)}" r="${n14(0.27 * u)}" ${stroke}/>`;
    if (p.label) {
      const b = texBox(p.label, 0.32 * u);
      out += label(p.label, X + 0.45 * u + b.w / 2, Y, 0.32 * u);
    }
  } else if (p.kind === "dff") {
    const x0 = X - 0.6 * u, fs = 0.26 * u;
    out += `<rect x="${n14(x0)}" y="${n14(Y - 0.9 * u)}" width="${n14(1.2 * u)}" height="${n14(1.8 * u)}" ${stroke}/>`;
    out += text("D", x0 + 0.18 * u, Y - 0.5 * u, fs) + texSvg("Q", X + 0.42 * u, Y - 0.5 * u, fs, ink) + texSvg("\\overline{Q}", X + 0.42 * u, Y + 0.5 * u, fs, ink);
    out += `<path d="M${n14(x0)} ${n14(Y + 0.38 * u)}L${n14(x0 + 0.16 * u)} ${n14(Y + 0.5 * u)}L${n14(x0)} ${n14(Y + 0.62 * u)}" ${stroke}/>`;
    if (p.label) out += label(p.label, X, Y - 1.14 * u, 0.28 * u);
  }
  return out;
}
function backAt(p, u, style, pyPx) {
  const K = LOGIC_PARTS[p.kind], X = p.x * u, Y = -p.y * u;
  if (style === "iec") return X - 0.42 * u;
  if (K.gate === "buf") return X - 0.35 * u;
  if (K.gate === "and") return X - 0.5 * u;
  const { h } = gateGeometry(p, u), t = (pyPx - (Y - h)) / (2 * h);
  return X - 0.5 * u - (K.gate === "xor" ? 0.14 * u : 0) + 2 * t * (1 - t) * 0.22 * u;
}
function partSignals(p, u, ink, style, at, color2) {
  const K = LOGIC_PARTS[p.kind], X = p.x * u, Y = -p.y * u;
  const line = (x1, y1, x2, y2, c) => `<path d="M${n14(x1)} ${n14(y1)}L${n14(x2)} ${n14(y2)}" stroke="${esc4(c)}" stroke-width="${n14(LW2)}" stroke-linecap="round" fill="none"/>`;
  const sig = (name) => color2(at ? at[`${p.id}.${name}`] : void 0);
  let out = "";
  if (K.gate) {
    for (const pin of pinsOf(p).filter((x) => x.io === "in")) {
      const py = -pin.y * u;
      out += line(pin.x * u, py, backAt(p, u, style, py), py, sig(pin.name));
    }
    const front = style === "iec" ? X + 0.42 * u : K.gate === "buf" ? X + 0.3 * u : X + 0.5 * u;
    out += line(front + (K.inv ? 0.16 * u : 0), Y, X + 0.75 * u, Y, sig("out"));
  } else if (p.kind === "input" || p.kind === "clock") {
    const v = at ? at[`${p.id}.out`] : void 0;
    out += line(X + 0.32 * u, Y, X + 0.75 * u, Y, color2(v));
    if (p.kind === "clock") {
      const a = 0.18 * u, b = 0.12 * u;
      out += `<path d="M${n14(X - a)} ${n14(Y + b)}H${n14(X - a / 2)}V${n14(Y - b)}H${n14(X + a / 2)}V${n14(Y + b)}H${n14(X + a)}" fill="none" stroke="${esc4(v == null ? ink : color2(v))}" stroke-width="${n14(LW2 * 0.9)}" stroke-linejoin="round"/>`;
    } else if (v != null) out += `<text x="${n14(X)}" y="${n14(Y + 0.32 * u * 0.34)}" text-anchor="middle" font-family="${esc4(MATH_FONT)}" font-size="${n14(0.32 * u)}" font-weight="700" fill="${esc4(color2(v))}">${v}</text>`;
  } else if (p.kind === "output") {
    const v = at ? at[`${p.id}.in`] : void 0;
    out += line(X - 0.75 * u, Y, X - 0.27 * u, Y, color2(v));
    if (v === 1) out += `<circle cx="${n14(X)}" cy="${n14(Y)}" r="${n14(0.5 * u)}" fill="${esc4(color2(1))}" fill-opacity=".18"/><circle cx="${n14(X)}" cy="${n14(Y)}" r="${n14(0.27 * u)}" fill="${esc4(color2(1))}"/>`;
    else if (v === null) out += `<circle cx="${n14(X)}" cy="${n14(Y)}" r="${n14(0.27 * u)}" fill="none" stroke="${esc4(color2(null))}" stroke-width="${n14(LW2)}" stroke-dasharray="3 3"/>`;
  } else if (p.kind === "dff") {
    for (const pin of pinsOf(p)) {
      const px = pin.x * u, py = -pin.y * u;
      out += pin.io === "in" ? line(px, py, X - 0.6 * u, py, sig(pin.name)) : line(X + 0.6 * u, py, px, py, sig(pin.name));
    }
  }
  return out;
}
function drawLogic(m, o = {}) {
  const u = o.U || LOGIC_UNIT, ink = o.ink || "#ffffff", pal = signalColors(ink);
  const color2 = o.values ? (v) => v === 1 ? pal.hi : v === 0 ? pal.lo : v === null ? pal.unk : ink : () => ink;
  const deck = o.deck != null ? String(o.deck).replace(/[^A-Za-z0-9_-]/g, "") : null;
  const step = deck != null ? null : o.step ?? null;
  const max = maxStep3(m);
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (X, Y, rx = 0, ry = rx) => {
    box.x0 = Math.min(box.x0, X - rx);
    box.x1 = Math.max(box.x1, X + rx);
    box.y0 = Math.min(box.y0, Y - ry);
    box.y1 = Math.max(box.y1, Y + ry);
  };
  const label = (tex, X, Y, size) => {
    const b = texBox(tex, size);
    grow(X, Y, b.w / 2, b.h / 2);
    if (o.labels === "deck" || typeof o.labels === "function") {
      const w = b.w * 2 + size * 2, h = b.h * 1.6 + size;
      const inner = o.labels === "deck" ? `<span data-math-latex="${esc4(tex)}" style="font-family:${esc4(MATH_FONT)}">${texLiteHtml(tex)}</span>` : o.labels(tex);
      return `<foreignObject x="${n14(X - w / 2)}" y="${n14(Y - h / 2)}" width="${n14(w)}" height="${n14(h)}" pointer-events="none" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:${n14(size / 1.21)}px;color:${esc4(ink)}">${inner}</div></foreignObject>`;
    }
    return texSvg(tex, X, Y, size, ink);
  };
  for (const p of m.parts) {
    const b = logicBounds({ parts: [p], nodes: [] });
    grow((b.x0 + b.x1) / 2 * u, -(b.y0 + b.y1) / 2 * u, (b.x1 - b.x0) / 2 * u, (b.y1 - b.y0) / 2 * u);
  }
  for (const n of m.nodes) grow(n.x * u, -n.y * u);
  const flat = everythingAtOnce(m);
  const tt = o.table ? truthTable(m) : null;
  const deep = logicDepths(m);
  const states = deck != null ? simulateLogic(m, max) : step == null ? simulateLogic(flat, 0) : simulateLogic(m, step);
  const signals = (s, state, prev, model) => {
    const E = endpoints(model, s);
    const shown = (x) => s == null || (x.step || 0) <= s;
    let out = "";
    const fan = {};
    for (const w of model.wires) if (shown(w) && E.has(w.from) && E.has(w.to)) {
      fan[w.from] = (fan[w.from] || 0) + 1;
      fan[w.to] = (fan[w.to] || 0) + 1;
    }
    for (const w of model.wires) {
      if (!shown(w) || !E.has(w.from) || !E.has(w.to)) continue;
      const d = route(E.get(w.from), E.get(w.to), w.mx ?? void 0).map((p, i) => `${i ? "L" : "M"}${n14(p.x * u)} ${n14(-p.y * u)}`).join("");
      const v = state.wire[w.id], c = color2(v), dash = o.values && v === null ? ' stroke-dasharray="5 4"' : "";
      const path = (cls, col, extra = "") => `<path${cls} d="${d}" fill="none" stroke="${esc4(col)}" stroke-width="${n14(LW2 * 1.15)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
      const fresh = deck != null && (w.step || 0) === s && s > 0;
      const changed = prev && o.values && prev.wire[w.id] !== void 0 && prev.wire[w.id] !== v;
      if (deck != null && (fresh || changed)) {
        if (changed) out += path("", color2(prev.wire[w.id]));
        out += path(` class="pxlg-sig" style="animation-delay:${(deep(w.from) * 0.14).toFixed(2)}s"`, c, dash);
      } else out += path("", c, dash);
    }
    for (const [id, e] of E) {
      const f = fan[id] || 0;
      if (e.node && f >= 3 || !e.node && f >= 2) out += `<circle cx="${n14(e.x * u)}" cy="${n14(-e.y * u)}" r="3.6" fill="${esc4(color2(state.at[id]))}"/>`;
    }
    for (const p of model.parts) if (shown(p)) out += partSignals(p, u, ink, o.style, state.at, color2);
    if (tt && tt.rows) {
      const row = rowOf(tt, state);
      if (row >= 0) out += tableRow(row);
    }
    return out;
  };
  let tableBase = "", tableRow = () => "";
  if (tt && tt.rows) {
    const b = logicBounds(m), cw = 0.62 * u, rh = 0.44 * u, cols = tt.ins.length + tt.outs.length;
    const x0 = (b.x1 + 0.9) * u, top = -b.y1 * u + 0.1 * u, fs = 0.27 * u;
    [...tt.ins, ...tt.outs].forEach((p, c) => {
      tableBase += label(p.label || p.id, x0 + (c + 0.5) * cw, top + rh * 0.5, fs);
    });
    tableBase += `<path d="M${n14(x0 - 0.08 * u)} ${n14(top + rh)}H${n14(x0 + cols * cw + 0.08 * u)}M${n14(x0 + tt.ins.length * cw)} ${n14(top + 0.06 * u)}V${n14(top + rh * (tt.rows.length + 1))}" stroke="${esc4(ink)}" stroke-width="1.2" opacity=".6"/>`;
    tt.rows.forEach((r, ri) => r.forEach((v, c) => {
      tableBase += `<text x="${n14(x0 + (c + 0.5) * cw)}" y="${n14(top + rh * (ri + 1.5) + fs * 0.34)}" text-anchor="middle" font-family="${esc4(MATH_FONT)}" font-size="${n14(fs)}" fill="${esc4(ink)}">${v == null ? "?" : v}</text>`;
    }));
    grow(x0 + cols * cw / 2, top + rh * (tt.rows.length + 1) / 2, cols * cw / 2 + 0.1 * u, rh * (tt.rows.length + 1) / 2);
    tableRow = (row) => `<rect x="${n14(x0 - 0.08 * u)}" y="${n14(top + rh * (row + 1))}" width="${n14(cols * cw + 0.16 * u)}" height="${n14(rh)}" rx="4" fill="${esc4(o.accent || pal.hi)}" fill-opacity=".26"/>`;
  }
  let layers = "";
  if (deck != null) {
    for (let s = 0; s <= max; s++) layers += `<g data-fx-in="${s}-${s === max ? "" : s}">${signals(s, states[s], s ? states[s - 1] : null, m)}</g>`;
  } else layers = signals(step, states[states.length - 1], null, step == null ? flat : m);
  let bases = "";
  for (const p of m.parts) {
    if (step != null && (p.step || 0) > step) continue;
    let g = partBase(p, u, ink, o.style, label);
    if (o.editor) {
      const sel = o.sel && o.sel.kind === "p" && o.sel.id === p.id;
      const hw = (p.kind === "dff" ? 1 : 0.62) * u, hh = (p.kind === "dff" ? 0.95 : Math.max(0.45, ((p.inputs || 2) - 1) * 0.25 + 0.3)) * u;
      if (sel) g = `<rect x="${n14(p.x * u - hw)}" y="${n14(-p.y * u - hh)}" width="${n14(2 * hw)}" height="${n14(2 * hh)}" rx="6" fill="${esc4(o.accent)}" fill-opacity=".14" stroke="${esc4(o.accent)}" stroke-width="1.5"/>` + g;
      g += `<rect data-p="${esc4(p.id)}" x="${n14(p.x * u - hw * 0.8)}" y="${n14(-p.y * u - hh * 0.9)}" width="${n14(1.6 * hw)}" height="${n14(1.8 * hh)}" fill="#000" fill-opacity="0"/>`;
      if (p.kind === "input") g += `<rect data-toggle="${esc4(p.id)}" x="${n14(p.x * u - 0.32 * u)}" y="${n14(-p.y * u - 0.27 * u)}" width="${n14(0.64 * u)}" height="${n14(0.54 * u)}" fill="#000" fill-opacity="0"><title>Click to set it to ${p.value ? 0 : 1}</title></rect>`;
      for (const pin of pinsOf(p)) {
        const id = `${p.id}.${pin.name}`, floating = (o.warn || []).includes(id);
        g += `<circle data-pin="${esc4(id)}" cx="${n14(pin.x * u)}" cy="${n14(-pin.y * u)}" r="${floating ? 6 : 2.6}" fill="${floating ? esc4(o.warnColor) : "none"}" fill-opacity="${floating ? ".35" : "0"}" stroke="${esc4(floating ? o.warnColor : o.mark)}" stroke-width="1.2"/>`;
      }
    }
    bases += deck != null && (p.step || 0) > 0 ? `<g class="pxfx-part pxfx-v" data-fx-at="${p.step}">${g}</g>` : `<g>${g}</g>`;
  }
  let editor = "";
  if (o.editor) {
    const E = endpoints(m);
    for (const w of m.wires) {
      if (!E.has(w.from) || !E.has(w.to)) continue;
      const pts = route(E.get(w.from), E.get(w.to), w.mx ?? void 0);
      const d = pts.map((p, i) => `${i ? "L" : "M"}${n14(p.x * u)} ${n14(-p.y * u)}`).join("");
      const sel = o.sel && o.sel.kind === "w" && o.sel.id === w.id;
      if (sel) editor += `<path d="${d}" fill="none" stroke="${esc4(o.accent)}" stroke-opacity=".3" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`;
      editor += `<path data-w="${esc4(w.id)}" d="${d}" fill="none" stroke="#000" stroke-opacity="0" stroke-width="14" pointer-events="stroke"/>`;
      if (sel && pts.length === 4) editor += `<circle data-h="${esc4(w.id)}" cx="${n14(pts[1].x * u)}" cy="${n14(-(pts[1].y + pts[2].y) / 2 * u)}" r="6" fill="${esc4(o.accent)}" stroke="#fff" stroke-width="2"><title>Drag to move the upright</title></circle>`;
    }
    for (const n of m.nodes) {
      const sel = o.sel && o.sel.kind === "n" && o.sel.id === n.id;
      editor += `<circle data-n="${esc4(n.id)}" cx="${n14(n.x * u)}" cy="${n14(-n.y * u)}" r="${sel ? 7 : 5}" fill="${sel ? esc4(o.accent) : "#000"}" fill-opacity="${sel ? ".35" : "0"}"/>`;
    }
  }
  let grid = "";
  if (o.editor && o.grid && o.view) {
    const v = o.view, gx = v.x0 * u, gy = -(v.y0 + v.h) * u;
    grid = `<defs><pattern id="pxlg-g" width="${u / 2}" height="${u / 2}" x="${-u / 4}" y="${-u / 4}" patternUnits="userSpaceOnUse"><circle cx="${u / 4}" cy="${u / 4}" r="1.1" fill="${esc4(o.mark)}" fill-opacity=".7"/></pattern></defs><rect x="${n14(gx)}" y="${n14(gy)}" width="${n14(v.w * u)}" height="${n14(v.h * u)}" fill="url(#pxlg-g)"/>`;
  }
  let caps = "";
  const capSteps = Object.keys(m.captions || {}).map(Number).sort((a, b) => a - b);
  if (o.captions && capSteps.length && isFinite(box.x0)) {
    const cs = CAPTION3 * u, w = Math.max(box.x1 - box.x0, 6 * u), cx = (box.x0 + box.x1) / 2, y = box.y1 + cs * 0.6, h = cs * 2.8;
    const one = (n, cls) => {
      const text = m.captions[n];
      if (o.labels === "text") return `<text${cls} x="${n14(cx)}" y="${n14(y + cs)}" text-anchor="middle" font-size="${n14(cs)}" fill="${esc4(ink)}">${esc4(text)}</text>`;
      return `<foreignObject${cls} x="${n14(cx - w / 2)}" y="${n14(y)}" width="${n14(w)}" height="${n14(h)}" pointer-events="none"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;font-size:${n14(cs)}px;line-height:1.3;color:${esc4(ink)}">${esc4(text)}</div></foreignObject>`;
    };
    if (deck != null) caps = capSteps.map((n) => one(n, ` class="pxfx-cap" data-fx-cap="${n}"`)).join("");
    else {
      const shown = capSteps.filter((n) => n <= (step ?? 0)).pop();
      if (shown != null) caps = one(shown, "");
    }
    grow(cx, y + h / 2, w / 2, h / 2);
  }
  if (!isFinite(box.x0)) Object.assign(box, { x0: 0, y0: 0, x1: 6 * u, y1: 3 * u });
  return { svg: grid + `<g pointer-events="none">${layers}</g>` + bases + tableBase + editor + caps, box };
}
var baseOptions2 = (m) => ({ ink: m.color, style: m.symbols, values: m.values, table: m.table, captions: true });
function logicBox(el) {
  const m = logicModel(el);
  const { box } = drawLogic(m, baseOptions2(m));
  const pad = 0.2 * LOGIC_UNIT;
  return { x: box.x0 - pad, y: box.y0 - pad, w: box.x1 - box.x0 + 2 * pad, h: box.y1 - box.y0 + 2 * pad };
}
function logicSvg(el, opts = {}) {
  const m = logicModel(el), b = logicBox(el);
  const { svg } = drawLogic(m, { ...baseOptions2(m), labels: opts.labels || "text", deck: opts.deck, step: opts.step ?? null });
  const size = opts.standalone ? ` width="${n14(b.w)}" height="${n14(b.h)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n14(b.x)} ${n14(b.y)} ${n14(b.w)} ${n14(b.h)}" preserveAspectRatio="xMidYMid meet"${size} style="width:100%;height:100%;display:block;overflow:visible">${svg}</svg>`;
}
function logicSteps(el) {
  if (el?.type !== "logic") return [];
  const m = logicModel(el), steps = /* @__PURE__ */ new Set();
  for (const p of m.parts) {
    if (p.step > 0) steps.add(p.step);
    for (const f of p.flips || []) steps.add(f);
    if (p.kind === "clock") for (let s = Math.max(1, p.start); s <= p.end + 1; s++) steps.add(s);
  }
  for (const w of m.wires) if (w.step > 0) steps.add(w.step);
  for (const n of m.nodes) if (n.step > 0) steps.add(n.step);
  for (const k of Object.keys(m.captions)) if (+k > 0) steps.add(+k);
  return [...steps].filter((s) => s <= maxStep3(m)).sort((a, b) => a - b).map((s) => [m.stepStart - 1 + s, s]).filter(([n]) => n <= 1e3);
}
function logicStepMarkers(slide) {
  let html = "";
  for (const el of slide?.elements || []) {
    const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    for (const [n, s] of logicSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`;
  }
  return html;
}
function hasLogic(presentation) {
  return (presentation?.slides || []).some((s) => (s.elements || []).some((el) => el.type === "logic"));
}
function template3(key, name, parts, nodes, wires, extra = {}) {
  return { key, name, build() {
    return {
      parts: parts.map(([id, kind, x, y, more]) => ({
        id,
        kind,
        x,
        y,
        label: "",
        step: 0,
        ...LOGIC_PARTS[kind].multi ? { inputs: 2 } : {},
        ...kind === "input" ? { value: 0, flips: [] } : {},
        ...kind === "clock" ? { start: 1, end: 8 } : {},
        ...more || {}
      })),
      nodes: nodes.map(([id, x, y]) => ({ id, x, y, step: 0 })),
      wires: wires.map(([from, to, more], i) => ({ id: "w" + (i + 1), from, to, mx: null, step: 0, ...more || {} })),
      captions: { ...extra.captions || {} },
      table: !!extra.table
    };
  } };
}
var LOGIC_TEMPLATES = [
  template3(
    "half",
    "Half adder",
    [["A", "input", 0, 2, { label: "A", flips: [2] }], ["B", "input", 0, 0, { label: "B", flips: [1, 2, 3] }], ["g1", "xor", 3, 1.75], ["g2", "and", 3, 0.25], ["S", "output", 5.25, 1.75, { label: "S" }], ["C", "output", 5.25, 0.25, { label: "C" }]],
    [["nA", 1.25, 2], ["nB", 1.75, 0]],
    [["A.out", "nA"], ["nA", "g1.in1"], ["nA", "g2.in1", { mx: 1.25 }], ["B.out", "nB"], ["nB", "g2.in2"], ["nB", "g1.in2", { mx: 1.75 }], ["g1.out", "S.in"], ["g2.out", "C.in"]],
    { table: true, captions: { 0: "0 + 0: sum 0, carry 0", 1: "0 + 1: sum 1", 2: "1 + 0: sum 1", 3: "1 + 1: sum 0, carry 1" } }
  ),
  template3(
    "mux",
    "2-to-1 multiplexer",
    [
      ["D0", "input", 0, 3, { label: "D_0", value: 1 }],
      ["Sel", "input", 0, 1.75, { label: "S", flips: [1, 3] }],
      ["D1", "input", 0, 0.5, { label: "D_1", flips: [2] }],
      ["inv", "not", 2.5, 2.5],
      ["g1", "and", 4.5, 2.75],
      ["g2", "and", 4.5, 0.75],
      ["g3", "or", 7, 1.75],
      ["Y", "output", 9, 1.75, { label: "Y" }]
    ],
    [["j", 1.25, 1.75]],
    [
      ["D0.out", "g1.in1"],
      ["Sel.out", "j"],
      ["j", "inv.in1", { mx: 1.25 }],
      ["j", "g2.in1", { mx: 1.25 }],
      ["inv.out", "g1.in2"],
      ["D1.out", "g2.in2"],
      ["g1.out", "g3.in1", { mx: 5.75 }],
      ["g2.out", "g3.in2", { mx: 5.75 }],
      ["g3.out", "Y.in"]
    ],
    { table: true, captions: { 0: "S = 0 passes D₀", 1: "S = 1 passes D₁", 2: "D₁ rises, and Y with it", 3: "Back to D₀" } }
  ),
  template3(
    "latch",
    "SR latch (NOR)",
    [
      ["R", "input", 0, 2.75, { label: "R", flips: [3, 4] }],
      ["S", "input", 0, 0.25, { label: "S", flips: [1, 2] }],
      ["g1", "nor", 3, 2.5],
      ["g2", "nor", 3, 0.5],
      ["Q", "output", 6, 2.5, { label: "Q" }],
      ["Qn", "output", 6, 0.5, { label: "\\overline{Q}" }]
    ],
    [["q", 4.5, 2.5], ["k1", 4.5, 1.75], ["k2", 1.75, 1.75], ["qn", 4.5, 0.5], ["k3", 4.5, 1.25], ["k4", 1.5, 1.25]],
    [
      ["R.out", "g1.in1"],
      ["S.out", "g2.in2"],
      ["g1.out", "q"],
      ["q", "Q.in"],
      ["q", "k1"],
      ["k1", "k2"],
      ["k2", "g2.in1", { mx: 1.75 }],
      ["g2.out", "qn"],
      ["qn", "Qn.in"],
      ["qn", "k3"],
      ["k3", "k4"],
      ["k4", "g1.in2", { mx: 1.5 }]
    ],
    { captions: { 0: "With both inputs low, Q could be either.", 1: "S sets it: Q = 1.", 2: "S goes low, and the latch remembers.", 3: "R resets it: Q = 0.", 4: "And it holds." } }
  ),
  template3(
    "counter",
    "2-bit ripple counter",
    [["clk", "clock", 0, 1, { label: "\\mathrm{CLK}", start: 1, end: 8 }], ["f1", "dff", 3, 1.5], ["f2", "dff", 7, 1.5], ["Q0", "output", 5.75, 3.5, { label: "Q_0" }], ["Q1", "output", 9.75, 3.5, { label: "Q_1" }]],
    [["a1", 4.5, 1], ["a2", 4.5, 2.75], ["a3", 1.5, 2.75], ["b1", 8.5, 1], ["b2", 8.5, 2.75], ["b3", 5.5, 2.75]],
    [
      ["clk.out", "f1.clk"],
      ["f1.qn", "a1"],
      ["a1", "a2"],
      ["a2", "a3"],
      ["a3", "f1.d", { mx: 1.5 }],
      ["a1", "f2.clk"],
      ["f2.qn", "b1"],
      ["b1", "b2"],
      ["b2", "b3"],
      ["b3", "f2.d", { mx: 5.5 }],
      ["f1.q", "Q0.in", { mx: 4.25 }],
      ["f2.q", "Q1.in", { mx: 8.25 }]
    ],
    { captions: { 1: "The clock rises: count 1.", 3: "Q₀ falls, so its inverse rises and clocks Q₁: count 2.", 5: "Count 3.", 7: "And back to 0." } }
  ),
  { key: "blank", name: "Blank", build: () => ({ parts: [], nodes: [], wires: [], captions: {}, table: false }) }
];

// client/src/utils/freebodySolve.js
var G = 9.8;
var FORCE_KINDS = {
  weight: { name: "Weight", key: "w", label: "F_g", chips: ["F_g", "mg", "W", "F_G"] },
  normal: { name: "Normal", key: "n", label: "F_N", chips: ["F_N", "N", "n", "F_{\\perp}"] },
  friction: { name: "Friction", key: "f", label: "f", chips: ["f", "f_s", "f_k", "F_f"] },
  tension: { name: "Tension", key: "t", label: "T", chips: ["T", "T_1", "T_2", "F_T"] },
  applied: { name: "Applied", key: "a", label: "F_{\\text{app}}", chips: ["F", "F_{\\text{app}}", "P", "F_{\\text{push}}"] },
  drag: { name: "Drag", key: "d", label: "F_D", chips: ["F_D", "F_{\\text{air}}", "D", "bv"] },
  spring: { name: "Spring", key: "s", label: "F_s", chips: ["F_s", "kx", "F_{\\text{sp}}"] },
  custom: { name: "Other", key: "o", label: "F", chips: ["F", "qE", "F_E", "F_B", "F_b"] }
};
var ID4 = /^[A-Za-z0-9_-]{1,40}$/;
var HEX = /^#[0-9a-f]{6}$/i;
var num6 = (v, lo, hi, d) => typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
var int5 = (v, lo, hi, d) => Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d;
var str5 = (v, max, d = "") => typeof v === "string" ? v.slice(0, max) : d;
var oneOf = (v, list, d) => list.includes(v) ? v : d;
var typed = (v, d = "") => typeof v === "number" && isFinite(v) ? String(v) : typeof v === "string" ? v.slice(0, 20) : d;
var readNumber = (s) => {
  if (s == null || String(s).trim() === "") return null;
  const v = parseFloat(String(s).replace(",", "."));
  return isFinite(v) ? v : null;
};
function freebodyModel(el) {
  const b = el?.body || {}, s = el?.surface || {}, n = el?.net || {};
  const forces = [], ids = /* @__PURE__ */ new Set();
  for (const f of Array.isArray(el?.forces) ? el.forces.slice(0, 40) : []) {
    if (!f || !ID4.test(f.id) || ids.has(f.id) || !FORCE_KINDS[f.kind]) continue;
    ids.add(f.id);
    let magMode = oneOf(f.magMode, ["given", "solve", "mass", "mu"], "given");
    if (magMode === "mass" && f.kind !== "weight" || magMode === "mu" && f.kind !== "friction") magMode = "given";
    const cl = Array.isArray(f.compLabels) ? f.compLabels : [];
    forces.push({
      id: f.id,
      kind: f.kind,
      label: str5(f.label, 120, FORCE_KINDS[f.kind].label),
      magMode,
      mag: typed(f.mag),
      mu: typed(f.mu, "0.3"),
      dir: { from: oneOf(f.dir?.from, ["level", "surface"], "level"), deg: num6(f.dir?.deg, -360, 360, 0) },
      push: !!f.push,
      comps: !!f.comps,
      compLabels: [str5(cl[0], 120), str5(cl[1], 120)],
      angle: oneOf(f.angle, ["none", "level", "vertical", "surface", "normal"], "none"),
      angleLabel: str5(f.angleLabel, 60, "\\theta"),
      rope: !!f.rope,
      color: HEX.test(f.color || "") ? f.color : null,
      step: int5(f.step, 0, 1e3, 0)
    });
  }
  const captions = {};
  for (const [k, v] of Object.entries(el?.captions && typeof el.captions === "object" ? el.captions : {})) {
    const i = Number(k);
    if (Number.isInteger(i) && i >= 0 && i <= 1e3 && typeof v === "string" && v.trim()) captions[i] = v.slice(0, 300);
  }
  return {
    body: { shape: oneOf(b.shape, ["box", "ball", "dot"], "box"), w: num6(b.w, 0.3, 6, 1.6), h: num6(b.h, 0.3, 6, 1), label: str5(b.label, 60, "m"), mass: typed(b.mass) },
    surface: { kind: oneOf(s.kind, ["none", "floor", "incline", "wall", "ceiling"], "floor"), angle: num6(s.angle, -60, 60, 30), angleLabel: str5(s.angleLabel, 60, "\\theta"), show: s.show !== false },
    model: oneOf(el?.model, ["particle", "extended"], "particle"),
    axes: oneOf(el?.axes, ["none", "level", "surface"], "level"),
    motion: oneOf(el?.motion, ["rest", "slide", "free"], "rest"),
    forceScale: num6(el?.forceScale, 0.01, 1e6, 10),
    values: !!el?.values,
    net: { show: n.show !== false, step: int5(n.step, 0, 1e3, 0), label: str5(n.label, 60, "F_{\\text{net}}") },
    forces,
    captions,
    color: HEX.test(el?.color || "") ? el.color : "#ffffff",
    stepStart: int5(el?.stepStart, 1, 1e3, 1),
    dimPast: !!el?.dimPast
  };
}
var D2R = Math.PI / 180;
var uvec = (deg) => [Math.cos(deg * D2R), Math.sin(deg * D2R)];
var add = (a, b) => [a[0] + b[0], a[1] + b[1]];
var sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
var mul = (a, k) => [a[0] * k, a[1] * k];
var dot = (a, b) => a[0] * b[0] + a[1] * b[1];
var len = (a) => Math.hypot(a[0], a[1]);
var angOf = (v) => Math.atan2(v[1], v[0]) / D2R;
var wrap180 = (d) => {
  d = ((d + 180) % 360 + 360) % 360 - 180;
  return d === -180 ? 180 : d;
};
var angDiff = (a, b) => wrap180(b - a);
function alpha(m) {
  const k = m.surface.kind;
  return k === "incline" ? m.surface.angle : k === "wall" ? -90 : k === "ceiling" ? 180 : 0;
}
var bodyRot = (m) => m.surface.kind === "none" ? 0 : alpha(m);
function half(m) {
  const b = m.body;
  if (b.shape === "dot") return [0.09, 0.09];
  if (b.shape === "ball") return [b.h / 2, b.h / 2];
  return [b.w / 2, b.h / 2];
}
var absDeg = (m, f) => (f.dir.from === "surface" ? alpha(m) : 0) + f.dir.deg;
function axesFrame(m) {
  const a = m.axes === "surface" ? alpha(m) : 0;
  return [uvec(a), uvec(a + 90)];
}
function contact(m) {
  return mul(uvec(alpha(m) + 90), -half(m)[1]);
}
function boundary(m, u) {
  const [hw, hh] = half(m);
  if (m.body.shape !== "box") return mul(u, hw);
  const r = -bodyRot(m) * D2R;
  const lx = u[0] * Math.cos(r) - u[1] * Math.sin(r), ly = u[0] * Math.sin(r) + u[1] * Math.cos(r);
  const t = Math.min(Math.abs(lx) > 1e-9 ? hw / Math.abs(lx) : Infinity, Math.abs(ly) > 1e-9 ? hh / Math.abs(ly) : Infinity);
  return mul(u, t);
}
function solveFreebody(m) {
  const fs = m.forces, mass = readNumber(m.body.mass);
  const out = { mag: {}, how: {}, notes: [], net: [0, 0], acc: null, status: "ok", unknowns: 0 };
  const note = (text, ...labels) => {
    if (!out.notes.some((n3) => n3.text === text && n3.labels.join() === labels.join())) out.notes.push({ text, labels });
  };
  const normal = fs.find((f) => f.kind === "normal");
  const vars = [], expr = {};
  for (const f of fs) {
    if (f.magMode === "solve" && m.motion !== "free") {
      expr[f.id] = { c: 0, k: { [vars.length]: 1 } };
      vars.push({ id: f.id, label: f.label });
    }
  }
  for (const f of fs) {
    if (expr[f.id] !== void 0 || f.magMode === "mu") continue;
    if (f.magMode === "mass") {
      expr[f.id] = mass != null ? { c: mass * G, k: {} } : null;
      if (mass == null) note("{0} is mg, but the body has no mass yet.", f.label);
    } else if (f.magMode === "given") {
      const v = readNumber(f.mag);
      expr[f.id] = v != null ? { c: v, k: {} } : null;
    } else {
      expr[f.id] = null;
      note("Nothing is worked out in free motion: give {0} a value.", f.label);
    }
  }
  for (const f of fs) {
    if (f.magMode !== "mu") continue;
    const mu = readNumber(f.mu), ne = normal ? expr[normal.id] : null;
    if (!normal) note("{0} is μ times the normal force, but there’s no normal force.", f.label);
    expr[f.id] = mu != null && ne ? { c: mu * ne.c, k: Object.fromEntries(Object.entries(ne.k).map(([i, v]) => [i, mu * v])) } : null;
  }
  const s = uvec(alpha(m));
  let accVar = -1;
  if (m.motion === "slide") {
    if (mass == null) note("Give the body a mass to work out how fast it slides.");
    else {
      accVar = vars.length;
      vars.push({ acc: true, label: "a" });
    }
  }
  const n = vars.length;
  const A = [new Array(n).fill(0), new Array(n).fill(0)], b = [0, 0];
  for (const f of fs) {
    const e = expr[f.id];
    if (!e) continue;
    const u = uvec(absDeg(m, f));
    for (let r = 0; r < 2; r++) {
      b[r] -= u[r] * e.c;
      for (const [k, v] of Object.entries(e.k)) A[r][k] += u[r] * v;
    }
  }
  if (accVar >= 0) for (let r = 0; r < 2; r++) A[r][accVar] -= mass * s[r];
  out.unknowns = n;
  let x = null;
  if (n === 0) x = [];
  else if (n === 1) {
    const c = [A[0][0], A[1][0]], cc = dot(c, c);
    if (cc > 1e-12) x = [dot(b, c) / cc];
    else {
      out.status = "unsolved";
      note("{0} has nothing to balance: it doesn’t enter the sums.", vars[0].label);
    }
  } else if (n === 2) {
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    if (Math.abs(det) < 1e-9) {
      out.status = "unsolved";
      note("{0} and {1} act along one line, so they can’t both be worked out.", vars[0].label, vars[1].label);
    } else x = [(b[0] * A[1][1] - A[0][1] * b[1]) / det, (A[0][0] * b[1] - b[0] * A[1][0]) / det];
  } else {
    out.status = "unsolved";
    note(`${n} unknowns: only two can be worked out. Give the others values.`);
  }
  const value = (e) => {
    if (!e) return null;
    let v = e.c;
    for (const [k, c] of Object.entries(e.k)) {
      if (!x) return null;
      v += c * x[k];
    }
    return isFinite(v) ? v : null;
  };
  for (const f of fs) {
    const v = value(expr[f.id]);
    out.mag[f.id] = v;
    out.how[f.id] = v == null && f.magMode === "given" ? "none" : f.magMode;
    if (v == null && f.magMode === "given") note("{0} has no value, so it isn’t counted.", f.label);
    if (v != null && v < -1e-9) {
      if (f.kind === "normal") note("{0} comes out negative: the body would leave the surface.", f.label);
      else if (f.kind === "tension") note("{0} comes out negative: a rope can only pull.", f.label);
      else if (f.kind === "friction") note("{0} comes out negative, so friction points the other way. It’s drawn that way.", f.label);
      else if (f.magMode === "solve") note("{0} comes out negative, so it points the other way. It’s drawn that way.", f.label);
    }
    if (v != null) out.net = add(out.net, mul(uvec(absDeg(m, f)), v));
  }
  if (Math.abs(out.net[0]) < 1e-9) out.net[0] = 0;
  if (Math.abs(out.net[1]) < 1e-9) out.net[1] = 0;
  if (m.motion === "rest") {
    out.acc = [0, 0];
    if (len(out.net) > 1e-6 && n === 1 && x) note("With only {0} unknown, the forces can’t balance: what’s left is the net force.", vars[0].label);
  } else if (m.motion === "slide") out.acc = accVar >= 0 && x ? mul(s, x[accVar]) : null;
  else out.acc = mass ? mul(out.net, 1 / mass) : null;
  return out;
}

// client/src/utils/freebodyDiagram.js
var FREEBODY_UNIT = 56;
var DEFAULT_LEN = 1.6;
var MAX_LEN = 12;
var CAPTION4 = 0.3;
var esc5 = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var n15 = (v) => String(Math.round(v * 10) / 10);
function sig3(v) {
  const a = Math.abs(v);
  if (a < 5e-3) return "0";
  return a >= 100 ? String(Math.round(v)) : String(Number(v.toPrecision(3)));
}
var PUSHABLE = (k) => !["weight", "normal", "friction"].includes(k);
var isPush = (m, f) => m.model === "extended" && f.push && PUSHABLE(f.kind);
function forceGeom(m, f, sol) {
  const mag = sol.mag[f.id];
  let deg = absDeg(m, f);
  if (mag != null && mag < 0) deg += 180;
  const u = uvec(deg);
  const L = mag == null ? DEFAULT_LEN : Math.min(MAX_LEN, Math.max(0.3, Math.abs(mag) / m.forceScale));
  let tail = [0, 0];
  if (m.model === "extended") {
    if (f.kind === "normal" || f.kind === "friction") tail = m.surface.kind === "none" ? boundary(m, mul(u, -1)) : contact(m);
    else if (isPush(m, f)) tail = sub(boundary(m, mul(u, -1)), mul(u, L));
    else if (f.kind !== "weight") tail = boundary(m, u);
  }
  return { u, deg, L, tail, head: add(tail, mul(u, L)) };
}
function ropeGeom(m, f, sol) {
  const g = forceGeom(m, f, sol), u = uvec(absDeg(m, f));
  const start = m.body.shape === "dot" ? [0, 0] : boundary(m, u);
  return { u, start, end: add(start, mul(u, Math.max(2.6, g.L + 0.9))) };
}
function surfaceGeom(m) {
  const k = m.surface.kind;
  if (k === "none") return null;
  const a = alpha(m), s = uvec(a), n = uvec(a + 90), P = contact(m);
  if (k === "incline") {
    const E1 = add(P, mul(s, -3.2)), E2 = add(P, mul(s, 2));
    const low = E1[1] <= E2[1] ? E1 : E2, high = low === E1 ? E2 : E1;
    return { k, a, s, n, P, line: [E1, E2], low, high, B: [high[0], low[1]] };
  }
  return { k, a, s, n, P, line: [add(P, mul(s, -2.6)), add(P, mul(s, 2.6))] };
}
function inclineArc(sg) {
  const a0 = sg.B[0] > sg.low[0] ? 0 : 180;
  return { a0, d: angDiff(a0, angOf(sub(sg.high, sg.low))) };
}
function angleRef(m, f, deg) {
  const a = alpha(m);
  const cands = f.angle === "level" ? [0, 180] : f.angle === "vertical" ? [90, -90] : f.angle === "surface" ? [a, a + 180] : f.angle === "normal" ? [a + 90, a - 90] : [];
  let best = null;
  for (const c of cands) if (best == null || Math.abs(angDiff(c, deg)) < Math.abs(angDiff(best, deg))) best = c;
  return best;
}
function compLabel(label, axis) {
  if (label.endsWith("}")) {
    let depth = 0, i = label.length - 1;
    for (; i >= 0; i--) {
      depth += label[i] === "}" ? 1 : label[i] === "{" ? -1 : 0;
      if (!depth) break;
    }
    if (i > 0 && label[i - 1] === "_") return `${label.slice(0, i - 1)}_{${label.slice(i + 1, -1)},${axis}}`;
  }
  const m = /^(.*)_([A-Za-z0-9])$/.exec(label);
  if (m) return `${m[1]}_{${m[2]},${axis}}`;
  return label.includes("_") ? `{${label}}_${axis}` : `${label}_${axis}`;
}
function labelText(m, f, sol) {
  const v = sol.mag[f.id];
  return m.values && v != null ? `${f.label} = ${sig3(Math.abs(v))}\\,\\text{N}` : f.label;
}
var netLabel = (m, sol) => m.values ? `${m.net.label} = ${sig3(len(sol.net))}\\,\\text{N}` : m.net.label;
var netShown = (m, sol) => m.net.show && len(sol.net) > 0.01;
function netGeom(m, sol, box) {
  if (!netShown(m, sol)) return null;
  const u = mul(sol.net, 1 / len(sol.net)), L = Math.min(MAX_LEN, Math.max(0.3, len(sol.net) / m.forceScale));
  const xs = (isFinite(box.x1) ? box.x1 : 1) + 0.8;
  const tail = [xs + Math.max(0, -u[0]) * L, -(u[1] * L) / 2];
  let side = [-u[1], u[0]];
  if (Math.abs(side[0]) > 0.2 ? side[0] < 0 : side[1] < 0) side = mul(side, -1);
  return { u, L, tail, head: add(tail, mul(u, L)), mid: add(tail, mul(u, L / 2)), side };
}
function bodyLabelAt(m, sol) {
  const dirs = [];
  for (const f of m.forces) {
    const g = forceGeom(m, f, sol);
    if (len(g.tail) < 0.05) dirs.push(g.deg);
  }
  if (m.axes !== "none") {
    const a = m.axes === "surface" ? alpha(m) : 0;
    dirs.push(a, a + 90, a + 180, a - 90);
  }
  if (!dirs.length) return [0, 0];
  let best = 45, score = -1;
  for (let k = 0; k < 16; k++) {
    const c = 45 + k * 22.5, d = Math.min(...dirs.map((x) => Math.abs(angDiff(c, x))));
    if (d > score + 1e-6) {
      score = d;
      best = c;
    }
  }
  return mul(uvec(best), m.body.shape === "dot" ? 0.42 : 0.36);
}
function drawFreebody(m, o = {}) {
  const u = o.U || FREEBODY_UNIT, ink = o.ink || m.color;
  const deck = o.deck != null ? String(o.deck).replace(/[^A-Za-z0-9_-]/g, "") : null;
  const step = deck != null ? null : o.step ?? null;
  const sol = o.sol || solveFreebody(m);
  const bx = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const ext = (p, r = 0) => {
    bx.x0 = Math.min(bx.x0, p[0] - r);
    bx.y0 = Math.min(bx.y0, p[1] - r);
    bx.x1 = Math.max(bx.x1, p[0] + r);
    bx.y1 = Math.max(bx.y1, p[1] + r);
  };
  const X = (p) => n15(p[0] * u), Y = (p) => n15(-p[1] * u);
  const fs = 0.4 * u;
  const shown = (s) => step == null || s <= step;
  const part2 = (s, inner) => deck != null && s > 0 ? `<g class="pxfx-part" data-fx-at="${s}">${inner}</g>` : inner;
  const line = (a, b, attrs) => `<path d="M${X(a)} ${Y(a)}L${X(b)} ${Y(b)}" ${attrs}/>`;
  function label(tex, at, dir, size, color2) {
    const b = texBox(tex, size);
    const reach = (Math.abs(dir[0]) * b.w / 2 + Math.abs(dir[1]) * b.h / 2) / u + 0.14;
    const c = add(at, mul(dir, reach));
    ext([c[0] - b.w / 2 / u, c[1] - b.h / 2 / u]);
    ext([c[0] + b.w / 2 / u, c[1] + b.h / 2 / u]);
    const Xc = c[0] * u, Yc = -c[1] * u;
    if (o.labels === "deck" || typeof o.labels === "function") {
      const w = b.w * 2 + size * 2, h = b.h * 1.6 + size;
      const inner = o.labels === "deck" ? `<span data-math-latex="${esc5(tex)}" style="font-family:${esc5(MATH_FONT)}">${texLiteHtml(tex)}</span>` : o.labels(tex);
      return `<foreignObject x="${n15(Xc - w / 2)}" y="${n15(Yc - h / 2)}" width="${n15(w)}" height="${n15(h)}" pointer-events="none" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:${n15(size / 1.21)}px;color:${esc5(color2)}">${inner}</div></foreignObject>`;
    }
    return texSvg(tex, Xc, Yc, size, color2);
  }
  function arrow(t, h, color2, w, dash) {
    const v = sub(h, t), L = len(v);
    if (L < 1e-6) return { shaft: "", head: "" };
    const e = mul(v, 1 / L), k = w / 2.6, hl = Math.min(0.3 * k, L * 0.6), hw2 = 0.115 * k + 0.02;
    const base = sub(h, mul(e, hl * 0.82)), p = [-e[1], e[0]], back2 = sub(h, mul(e, hl));
    const a = add(back2, mul(p, hw2)), c = sub(back2, mul(p, hw2));
    ext(h, 0.15);
    ext(t);
    return {
      shaft: `<path${deck != null && !dash ? ' class="pxfx-reveal" pathLength="1"' : ""} d="M${X(t)} ${Y(t)}L${X(base)} ${Y(base)}" stroke="${esc5(color2)}" stroke-width="${n15(w * u / 46)}" stroke-linecap="round" fill="none"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`,
      head: `<path d="M${X(h)} ${Y(h)}L${X(a)} ${Y(a)}L${X(c)} ${Y(c)}Z" fill="${esc5(color2)}"/>`
    };
  }
  function hatch(a, b, out) {
    const L = len(sub(b, a)), s = mul(sub(b, a), 1 / L), d = mul(add(out, mul(s, -0.85)), 1 / Math.hypot(1, 0.85));
    let p = "";
    for (let t = 0.12; t < L - 0.05; t += 0.22) {
      const q = add(a, mul(s, t)), r = add(q, mul(d, 0.24));
      p += `M${X(q)} ${Y(q)}L${X(r)} ${Y(r)}`;
      ext(r);
    }
    return `<path d="${p}" stroke="${esc5(ink)}" stroke-opacity=".5" stroke-width="1.2" fill="none"/>`;
  }
  const lw = (w) => n15(w * u / 46);
  let back = "", mid = "", front = "", top = "";
  const sg = surfaceGeom(m);
  if (sg && m.surface.show) {
    if (sg.k === "incline") {
      const { low, high, B } = sg;
      back += `<path d="M${X(low)} ${Y(low)}L${X(B)} ${Y(B)}L${X(high)} ${Y(high)}Z" fill="${esc5(ink)}" fill-opacity=".07" stroke="${esc5(ink)}" stroke-width="${lw(2)}" stroke-linejoin="round"/>`;
      back += hatch(low, B, [0, -1]);
      ext(low);
      ext(high);
      ext(B);
      const { a0, d } = inclineArc(sg);
      if (Math.abs(d) > 1) {
        const r = 0.85, p0 = add(low, mul(uvec(a0), r)), p1 = add(low, mul(uvec(a0 + d), r));
        back += `<path d="M${X(p0)} ${Y(p0)}A${n15(r * u)} ${n15(r * u)} 0 0 ${d > 0 ? 0 : 1} ${X(p1)} ${Y(p1)}" stroke="${esc5(ink)}" stroke-width="${lw(1.4)}" fill="none"/>`;
        back += label(m.surface.angleLabel || "\\theta", add(low, mul(uvec(a0 + d / 2), r)), uvec(a0 + d / 2), fs * 0.9, ink);
      }
    } else {
      back += line(sg.line[0], sg.line[1], `stroke="${esc5(ink)}" stroke-width="${lw(2)}" stroke-linecap="round"`);
      back += hatch(sg.line[0], sg.line[1], mul(sg.n, -1));
      ext(sg.line[0]);
      ext(sg.line[1]);
    }
  }
  if (m.axes !== "none") {
    const [ex2, ey2] = axesFrame(m), r = 2.3;
    for (const [e, nm] of [[ex2, "x"], [ey2, "y"]]) {
      const a = mul(e, -r), b = mul(e, r), p = [-e[1], e[0]], hb = sub(b, mul(e, 0.2));
      mid += line(a, sub(b, mul(e, 0.12)), `stroke="${esc5(ink)}" stroke-opacity=".45" stroke-width="${lw(1.2)}"`);
      mid += `<path d="M${X(b)} ${Y(b)}L${X(add(hb, mul(p, 0.07)))} ${Y(add(hb, mul(p, 0.07)))}L${X(sub(hb, mul(p, 0.07)))} ${Y(sub(hb, mul(p, 0.07)))}Z" fill="${esc5(ink)}" fill-opacity=".45"/>`;
      mid += `<g opacity=".6">${label(nm, b, e, fs * 0.8, ink)}</g>`;
      ext(a);
      ext(b);
    }
  }
  for (const f of m.forces) {
    if (!f.rope || !m.surface.show) continue;
    const { u: d, start, end } = ropeGeom(m, f, sol), p = [-d[1], d[0]];
    ext(end, 0.45);
    if (!shown(f.step)) continue;
    mid += part2(f.step, line(start, end, `stroke="${esc5(ink)}" stroke-opacity=".55" stroke-width="${lw(1.6)}"`) + line(add(end, mul(p, 0.38)), sub(end, mul(p, 0.38)), `stroke="${esc5(ink)}" stroke-width="${lw(2.2)}" stroke-linecap="round"`) + hatch(sub(end, mul(p, 0.38)), add(end, mul(p, 0.38)), d));
  }
  const [hw, hh] = half(m);
  const bodyHit = o.editor ? ' data-body="1"' : "";
  if (m.body.shape === "box") {
    const r = bodyRot(m) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [x * cs - y * sn, x * sn + y * cs]);
    pts.forEach((p) => ext(p));
    mid += `<path${bodyHit} d="M${pts.map((p) => `${X(p)} ${Y(p)}`).join("L")}Z" fill="${esc5(ink)}" fill-opacity=".1" stroke="${esc5(ink)}" stroke-width="${lw(2)}" stroke-linejoin="round"/>`;
  } else if (m.body.shape === "ball") {
    ext([0, 0], hw);
    mid += `<circle${bodyHit} cx="0" cy="0" r="${n15(hw * u)}" fill="${esc5(ink)}" fill-opacity=".1" stroke="${esc5(ink)}" stroke-width="${lw(2)}"/>`;
  }
  if (m.body.shape === "dot" || m.model === "particle") {
    const dot0 = m.body.shape === "dot";
    mid += `<circle cx="0" cy="0" r="${n15((dot0 ? 0.11 : 0.06) * u)}" fill="${esc5(ink)}"/>`;
    if (dot0 && o.editor) mid += `<circle data-body="1" cx="0" cy="0" r="${n15(0.45 * u)}" fill="#000" fill-opacity="0"/>`;
    ext([0, 0], 0.2);
  }
  if (m.body.label) {
    const at = bodyLabelAt(m, sol);
    mid += `<g opacity=".85">${label(m.body.label, at, [0, 0], fs * 0.85, ink)}</g>`;
  }
  const [ex, ey] = axesFrame(m);
  for (const f of m.forces) {
    const g = forceGeom(m, f, sol), color2 = f.color || ink;
    if (!shown(f.step)) {
      ext(g.head, 0.6);
      ext(g.tail);
      continue;
    }
    let fade = "";
    if (f.comps && m.axes !== "none") {
      const vec = mul(g.u, g.L);
      for (const [e, k, lb] of [[ex, dot(vec, ex), f.compLabels[0] || compLabel(f.label, "x")], [ey, dot(vec, ey), f.compLabels[1] || compLabel(f.label, "y")]]) {
        if (Math.abs(k) < 0.08) continue;
        const tip = add(g.tail, mul(e, k)), a2 = arrow(g.tail, tip, color2, 1.7, `${n15(6 * u / 46)} ${n15(4 * u / 46)}`);
        fade += line(g.head, tip, `stroke="${esc5(color2)}" stroke-opacity=".55" stroke-width="${lw(1.1)}" stroke-dasharray="${n15(2 * u / 46)} ${n15(4 * u / 46)}"`) + a2.shaft + a2.head;
        fade += label(lb, tip, mul(e, Math.sign(k)), fs * 0.82, color2);
      }
    }
    if (f.angle !== "none") {
      const ref = angleRef(m, f, g.deg), d = ref == null ? 0 : angDiff(ref, g.deg);
      if (Math.abs(d) > 1) {
        const r = Math.min(0.75, g.L * 0.55), p0 = add(g.tail, mul(uvec(ref), r)), p1 = add(g.tail, mul(uvec(ref + d), r));
        fade += `<path d="M${X(p0)} ${Y(p0)}A${n15(r * u)} ${n15(r * u)} 0 0 ${d > 0 ? 0 : 1} ${X(p1)} ${Y(p1)}" stroke="${esc5(color2)}" stroke-width="${lw(1.3)}" fill="none"/>`;
        fade += label(f.angleLabel || "\\theta", add(g.tail, mul(uvec(ref + d / 2), r)), uvec(ref + d / 2), fs * 0.8, color2);
        if (f.angle === "level" || f.angle === "vertical") fade += line(g.tail, add(g.tail, mul(uvec(ref), r + 0.35)), `stroke="${esc5(color2)}" stroke-opacity=".5" stroke-width="${lw(1.1)}" stroke-dasharray="${n15(3 * u / 46)} ${n15(3 * u / 46)}"`);
      }
    }
    const a = arrow(g.tail, g.head, color2, 2.6, "");
    fade = a.head + label(labelText(m, f, sol), g.head, g.u, fs, color2) + fade;
    let s = "";
    if (o.editor && o.sel === f.id) s += line(g.tail, g.head, `stroke="${esc5(o.accent)}" stroke-opacity=".35" stroke-width="12" stroke-linecap="round"`);
    s += a.shaft + (deck != null && f.step > 0 ? `<g class="pxfx-fade">${fade}</g>` : fade);
    if (o.editor) {
      s += `<path data-f="${esc5(f.id)}" d="M${X(g.tail)} ${Y(g.tail)}L${X(g.head)} ${Y(g.head)}" stroke="#000" stroke-opacity="0" stroke-width="18" stroke-linecap="round" fill="none"/>`;
      if (o.sel === f.id) {
        const hp = isPush(m, f) ? g.tail : g.head;
        top += `<circle data-h="${esc5(f.id)}" cx="${X(hp)}" cy="${Y(hp)}" r="7" fill="${esc5(o.accent)}" stroke="${esc5(o.bg || "#fff")}" stroke-width="2"><title>Drag to turn it</title></circle>`;
      }
    }
    front += part2(f.step, `<g>${s}</g>`);
  }
  const ng = netGeom(m, sol, { ...bx });
  if (ng) {
    ext(ng.tail);
    ext(ng.head, 0.15);
    const nl = netLabel(m, sol);
    const lb = label(nl, add(ng.mid, mul(ng.side, 0.05)), ng.side, fs, ink);
    if (shown(m.net.step)) {
      const a = arrow(ng.tail, ng.head, ink, 2.2, `${n15(7 * u / 46)} ${n15(5 * u / 46)}`);
      const inner = a.shaft + a.head + lb;
      front += part2(m.net.step, deck != null && m.net.step > 0 ? `<g class="pxfx-fade">${inner}</g>` : inner);
    }
  }
  if (!isFinite(bx.x0)) ext([0, 0], 2);
  const box = { x0: bx.x0 * u, x1: bx.x1 * u, y0: -bx.y1 * u, y1: -bx.y0 * u };
  let caps = "";
  const capSteps = Object.keys(m.captions || {}).map(Number).sort((a, b) => a - b);
  if (o.captions && capSteps.length) {
    const cs = CAPTION4 * u, w = Math.max(box.x1 - box.x0, 6 * u), cx = (box.x0 + box.x1) / 2, y = box.y1 + cs * 0.6, h = cs * 2.8;
    const one = (n, cls) => {
      const text = m.captions[n];
      if (o.labels === "text" || !o.labels) return `<text${cls} x="${n15(cx)}" y="${n15(y + cs)}" text-anchor="middle" font-size="${n15(cs)}" fill="${esc5(ink)}">${esc5(text)}</text>`;
      return `<foreignObject${cls} x="${n15(cx - w / 2)}" y="${n15(y)}" width="${n15(w)}" height="${n15(h)}" pointer-events="none"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;font-size:${n15(cs)}px;line-height:1.3;color:${esc5(ink)}">${esc5(text)}</div></foreignObject>`;
    };
    if (deck != null) caps = capSteps.map((n) => one(n, ` class="pxfx-cap" data-fx-cap="${n}"`)).join("");
    else {
      const at = capSteps.filter((n) => n <= (step ?? 0)).pop();
      if (at != null) caps = one(at, "");
    }
    box.x0 = Math.min(box.x0, cx - w / 2);
    box.x1 = Math.max(box.x1, cx + w / 2);
    box.y1 = Math.max(box.y1, y + h);
  }
  return { svg: back + mid + front + top + caps, box, sol, net: ng };
}
var baseOptions3 = (m) => ({ ink: m.color, captions: true });
function freebodyBox(el) {
  const m = freebodyModel(el);
  const { box } = drawFreebody(m, baseOptions3(m));
  const pad = 0.2 * FREEBODY_UNIT;
  return { x: box.x0 - pad, y: box.y0 - pad, w: box.x1 - box.x0 + 2 * pad, h: box.y1 - box.y0 + 2 * pad };
}
function freebodySvg(el, opts = {}) {
  const m = freebodyModel(el), b = freebodyBox(el);
  const { svg } = drawFreebody(m, { ...baseOptions3(m), labels: opts.labels || "text", deck: opts.deck, step: opts.step ?? null });
  const size = opts.standalone ? ` width="${n15(b.w)}" height="${n15(b.h)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n15(b.x)} ${n15(b.y)} ${n15(b.w)} ${n15(b.h)}" preserveAspectRatio="xMidYMid meet"${size} style="width:100%;height:100%;display:block;overflow:visible">${svg}</svg>`;
}
function freebodySteps(el) {
  if (el?.type !== "freebody") return [];
  const m = freebodyModel(el), steps = /* @__PURE__ */ new Set();
  for (const f of m.forces) if (f.step > 0) steps.add(f.step);
  if (m.net.show && m.net.step > 0 && netShown(m, solveFreebody(m))) steps.add(m.net.step);
  for (const k of Object.keys(m.captions)) if (+k > 0) steps.add(+k);
  return [...steps].sort((a, b) => a - b).map((s) => [m.stepStart - 1 + s, s]).filter(([n]) => n <= 1e3);
}
function freebodyStepMarkers(slide) {
  let html = "";
  for (const el of slide?.elements || []) {
    const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    for (const [n, s] of freebodySteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`;
  }
  return html;
}
function hasFreebody(presentation) {
  return (presentation?.slides || []).some((s) => (s.elements || []).some((el) => el.type === "freebody"));
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
var HEX2 = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
function text3dSettings(el, fallbackFont) {
  const num7 = (key) => {
    const n = Number(el[key]);
    const [lo, hi] = TEXT3D_LIMITS[key];
    return Number.isFinite(n) && el[key] !== null && el[key] !== "" ? Math.min(hi, Math.max(lo, n)) : TEXT3D_DEFAULTS[key];
  };
  const color2 = (key) => HEX2.test(el[key] || "") ? el[key] : TEXT3D_DEFAULTS[key];
  const weight = String(el.fontWeight ?? "");
  return {
    depth: num7("depth"),
    rotateX: num7("rotateX"),
    rotateY: num7("rotateY"),
    perspective: num7("perspective"),
    fontSize: num7("fontSize"),
    letterSpacing: num7("letterSpacing"),
    lineHeight: num7("lineHeight"),
    sideShade: num7("sideShade"),
    color: color2("color"),
    sideColor: color2("sideColor"),
    fontWeight: WEIGHTS.test(weight) ? weight : TEXT3D_DEFAULTS.fontWeight,
    fontStyle: STYLES.includes(el.fontStyle) ? el.fontStyle : "normal",
    textAlign: ALIGNS[el.textAlign] ? el.textAlign : "center",
    fontFamily: String(el.fontFamily || fallbackFont || "sans-serif").replace(/[<>"`;{}\\\r\n]/g, "")
  };
}
var escapeText2 = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  const text = escapeText2(el.content);
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
      const len2 = Math.hypot(bx - ax, by - ay) || 1;
      const d = Math.abs((by - ay) * px - (bx - ax) * py + bx * ay - by * ax) / len2;
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
var COLOR5 = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9.,%\s/-]+\)|[a-z]{3,20})$/i;
var clamp3 = (v, min, max) => typeof v === "number" && Number.isFinite(v) ? +Math.min(max, Math.max(min, v)).toFixed(2) : null;
var color = (v) => typeof v === "string" && COLOR5.test(v.trim()) ? v.trim() : null;
var flip = (v) => v === true || v === 180 ? 180 : v === -180 ? -180 : 0;
function elementStates(el) {
  if (typeof el?.id !== "string" || !SAFE_ID.test(el.id) || !Array.isArray(el.states)) return [];
  return el.states.filter((st) => typeof st?.id === "string" && SAFE_ID.test(st.id)).slice(0, MAX_STATES);
}
function stateValues(st) {
  return {
    x: clamp3(st.x, -1e4, 1e4),
    y: clamp3(st.y, -1e4, 1e4),
    width: clamp3(st.width, 1, 1e4),
    height: clamp3(st.height, 1, 1e4),
    rotation: clamp3(st.rotation, -3600, 3600),
    scale: clamp3(st.scale, 0.05, 20),
    flipX: flip(st.flipX),
    flipY: flip(st.flipY),
    opacity: clamp3(st.opacity, 0, 1),
    zIndex: st.zIndex == null ? null : Math.round(clamp3(st.zIndex, -1e3, 1e5) ?? 0),
    fill: color(st.fill),
    stroke: color(st.stroke),
    textColor: color(st.textColor),
    filterBrightness: clamp3(st.filterBrightness, 0, 400),
    filterContrast: clamp3(st.filterContrast, 0, 400),
    filterGrayscale: clamp3(st.filterGrayscale, 0, 100),
    shape: CLOSED_SHAPES.includes(st.shape) ? st.shape : null,
    borderRadius: clamp3(st.borderRadius, 0, 1e4),
    duration: Math.round(clamp3(st.duration, 0, 1e4) ?? DEFAULT_STATE_DURATION),
    easing: STATE_EASINGS[st.easing] || "ease"
  };
}
function setList(action, modes = SET_MODES) {
  return (Array.isArray(action?.set) ? action.set : []).filter((s) => typeof s?.id === "string" && SAFE_ID.test(s.id) && (!s.state || typeof s.state === "string" && SAFE_ID.test(s.state)) && modes.includes(s.mode || "set"));
}
var NO_CLICK_ACTION = /* @__PURE__ */ new Set(["html", "p5", "model", "molecule", "graph", "video", "audio", "drawing"]);
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
          const b = v.filterBrightness ?? clamp3(el.filterBrightness, 0, 400) ?? 100;
          const c = v.filterContrast ?? clamp3(el.filterContrast, 0, 400) ?? 100;
          const g = v.filterGrayscale ?? clamp3(el.filterGrayscale, 0, 100) ?? 0;
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
function referencesHtml(citations, markerColor) {
  const items = citations.entries.map((entry) => {
    const year = entry.year || "";
    const journal = entry.journal || entry.booktitle || "";
    const vol = entry.volume || "";
    const pages = entry.pages || "";
    const doi = entry.doi || "";
    let line = `<span style="color:${markerColor};font-weight:700;margin-right:6px">[${citations.numberByKey[entry.key]}]</span>`;
    line += `${escapeHtml(entry.author || "")}`;
    if (year) line += ` (${escapeHtml(year)})`;
    line += `. ${escapeHtml(entry.title || "")}.`;
    if (journal) line += ` <em>${escapeHtml(journal)}</em>`;
    if (vol) line += `, ${escapeHtml(vol)}`;
    if (pages) line += `, ${escapeHtml(pages)}`;
    if (journal || vol || pages) line += ".";
    if (doi) line += ` <a href="https://doi.org/${escapeHtml(doi)}" target="_blank" rel="noopener" style="color:rgba(99,102,241,0.8);font-size:0.85em">DOI</a>`;
    return `<div style="margin-bottom:8px;line-height:1.5;font-size:14px;color:rgba(255,255,255,0.85)">${line}</div>`;
  }).join("\n          ");
  return `<h2 style="font-size:28px;margin:0 0 20px;color:rgba(255,255,255,0.95)">References</h2>
        <div style="columns:${citations.entries.length > 8 ? 2 : 1};column-gap:30px">
          ${items}
        </div>`;
}
var hasCitationMarkers = (presentation) => (presentation.slides || []).some((slide) => (slide.elements || []).some((el) => typeof el.content === "string" && el.content.includes("data-cite")));
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
  const citations = buildCitationIndex(presentation);
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
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${textStyle} padding:8px 12px; color:white;${spacingStyle}">${resolveCitationsInHtml(el.content || "", citations.labelByKey)}</div>`;
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
      if (el.type === "feynman") {
        const fxId = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} data-fx="${fxId}" data-fx-dim="${el.dimPast === false ? 0 : 1}" style="${style.replace("overflow:hidden;", "overflow:visible;")}">${feynmanSvg(el, { deck: fxId, labels: "deck" })}</div>`;
      }
      if (el.type === "circuit") {
        const fxId = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} data-fx="${fxId}" data-fx-dim="${el.dimPast ? 1 : 0}" style="${style.replace("overflow:hidden;", "overflow:visible;")}">${circuitSvg(el, { deck: fxId, labels: "deck" })}</div>`;
      }
      if (el.type === "logic") {
        const fxId = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} data-fx="${fxId}" data-fx-dim="0" style="${style.replace("overflow:hidden;", "overflow:visible;")}">${logicSvg(el, { deck: fxId, labels: "deck" })}</div>`;
      }
      if (el.type === "freebody") {
        const fxId = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} data-fx="${fxId}" data-fx-dim="${el.dimPast ? 1 : 0}" style="${style.replace("overflow:hidden;", "overflow:visible;")}">${freebodySvg(el, { deck: fxId, labels: "deck" })}</div>`;
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
      if (el.type === "molecule") {
        const srcdoc = moleculeViewerHtml(el, { src: absoluteSrc(el.src) }).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${srcdoc}" data-deck-scale style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no" title="${escapeHtml(el.name || "Molecule")}"></iframe></div>`;
      }
      if (el.type === "p5") {
        const p5Doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:transparent;overflow:hidden;}canvas{display:block;}</style><script src="${(0, import_libraries3.libUrl)("p5", "lib/p5.min.js")}"></script><script>${EMBED_RESIZE_LISTENER}</script></head><body><script>${el.content || ""}</script></body></html>`;
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
        const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><script src="${(0, import_libraries3.libUrl)("marked", "lib/marked.umd.js")}"><\\/script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent;color:white;font-family:-apple-system,sans-serif;font-size:18px;line-height:1.6;padding:8px 12px;overflow:auto}h1,h2,h3,h4{margin:0 0 .4em}p{margin:0 0 .4em}ul,ol{padding-left:1.5em;margin:0 0 .4em}a{color:#60a5fa}pre{background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:6px;overflow:auto;font-size:13px}code{font-family:'Fira Code',monospace}</style></head><body><div id="out"></div><script>document.getElementById('out').innerHTML=marked.parse(${JSON.stringify(el.content || "")});<\\/script></body></html>`;
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
        const esc6 = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
            svg += `<text x="${x}" y="${ty}" text-anchor="middle" fill="${tc}" font-size="${fs}" font-weight="600">${esc6(item.label)}</text>`;
            ty += fs + 2;
            if (item.description) {
              svg += `<text x="${x}" y="${ty}" text-anchor="middle" fill="${tc}" font-size="${fs - 1}" opacity="0.6">${esc6(item.description)}</text>`;
              ty += fs;
            }
            svg += `<text x="${x}" y="${ty}" text-anchor="middle" fill="${tc}" font-size="${fs - 2}" opacity="0.35">${itemDateLabel(item.date)}</text>`;
            ty += 4;
            if (item.image) svg += `<image href="${absoluteSrc(sanitizeUrl(item.image))}" x="${x - 40}" y="${ty}" width="80" height="${imgH}" preserveAspectRatio="xMidYMid meet"/>`;
          } else {
            if (item.image) svg += `<image href="${absoluteSrc(sanitizeUrl(item.image))}" x="${x - 40}" y="${cardY}" width="80" height="${imgH}" preserveAspectRatio="xMidYMid meet"/>`;
            svg += `<text x="${x}" y="${cardY + imgH + fs + 2}" text-anchor="middle" fill="${tc}" font-size="${fs}" font-weight="600">${esc6(item.label)}</text>`;
            if (item.description) svg += `<text x="${x}" y="${cardY + imgH + fs * 2 + 4}" text-anchor="middle" fill="${tc}" font-size="${fs - 1}" opacity="0.6">${esc6(item.description)}</text>`;
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
          const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><script src="${(0, import_libraries3.libUrl)("latex.js", "dist/latex.js")}"><\\/script><link rel="stylesheet" href="${(0, import_libraries3.libUrl)("latex.js", "dist/css/base.css")}"><style>*{box-sizing:border-box}html,body{margin:0;padding:8px;background:transparent;color:${lc}!important;width:100%;height:100%;overflow:auto;font-family:'Computer Modern',Georgia,serif;transform:scale(${sc});transform-origin:top left}table{border-collapse:collapse;color:${lc}}td,th{padding:3px 10px;color:${lc}!important}p,span,div{color:${lc}!important}</style></head><body><div id="out"></div><script>try{var generator=new HtmlGenerator({hyphenate:false});var doc=parse(${JSON.stringify(wrapped)},{generator:generator});document.getElementById('out').appendChild(doc.domFragment())}catch(e){document.getElementById('out').innerHTML='<span style="color:#f87171">Error: '+e.message+'<\\/span>'}<\\/script></body></html>`;
          const escaped2 = srcdoc.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
          return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${escaped2}" style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no"></iframe></div>`;
        }
        const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} data-latex-block="${escaped}" style="${style}display:flex;align-items:center;justify-content:center;overflow:hidden;"><span class="katex-block" style="font-size:${Math.round(sc * 22)}px;color:${lc};"></span></div>`;
      }
      if (el.type === "equation") {
        const eqId = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} data-eq="${eqId}" data-eq-config="${equationConfigAttr(el)}" style="${style}overflow:visible;"></div>`;
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
    const bodyHtml = (scrolling ? scrollingSlideBody({ slideW, slideH, canvasW, canvasH, axis, elementsHtml, pinnedHtml, background: canvasBg }) : elementsHtml) + stepMarkers(slide) + graphStepMarkers(slide) + equationStepMarkers(slide) + feynmanStepMarkers(slide) + circuitStepMarkers(slide) + logicStepMarkers(slide) + freebodyStepMarkers(slide);
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
  if (citations.entries.length > 0) {
    slidesHtml += `
    <section data-slide-id="references" style="padding:0;width:${slideW}px;height:${slideH}px;overflow:hidden;font-size:42px;">
      <div style="position:absolute;left:40px;top:30px;width:${slideW - 80}px;height:${slideH - 60}px;overflow:auto;z-index:1">
        ${referencesHtml(citations, footerColor)}
      </div>
    </section>`;
  }
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(presentation.title || "Presentation")}</title>
  <link rel="stylesheet" href="${(0, import_libraries3.libUrl)("reveal.js", "dist/reset.css")}">
  <link rel="stylesheet" href="${(0, import_libraries3.libUrl)("reveal.js", "dist/reveal.css")}">
  <link rel="stylesheet" href="${(0, import_libraries3.libUrl)("reveal.js", `dist/theme/${theme}.css`)}">
  <link rel="stylesheet" href="${(0, import_libraries3.libUrl)("@highlightjs/cdn-assets", `styles/${codeTheme}.min.css`)}">
  <link rel="stylesheet" href="${(0, import_libraries3.libUrl)("katex", "dist/katex.min.css")}">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&family=Roboto:wght@100;300;400;500;700;900&family=Open+Sans:wght@300;400;500;600;700;800&family=Source+Sans+Pro:ital,wght@0,200;0,300;0,400;0,600;0,700;0,900;1,200;1,300;1,400;1,600;1,700;1,900&family=Playfair+Display:wght@400;500;600;700;800;900&family=Merriweather:wght@300;400;700;900&family=Fira+Code:wght@300;400;500;600;700&family=JetBrains+Mono:wght@100;200;300;400;500;600;700;800&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;500;600;700&family=Questrial&family=Didact+Gothic&family=Nunito:wght@300;400;500;600;700;800;900&family=Nunito+Sans:wght@300;400;500;600;700;800;900&family=Quicksand:wght@300;400;500;600;700&family=Dosis:wght@300;400;500;600;700;800&family=M+PLUS+Rounded+1c:wght@300;400;500;700;900&family=Jura:wght@300;400;500;600;700&family=Codystar:wght@300;400&family=Barlow:wght@300;400;500;600;700;800;900&family=Barlow+Condensed:wght@300;400;500;600;700;800;900&family=Asap+Condensed:wght@400;500;600;700;900&family=Istok+Web:wght@400;700&family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inconsolata:wght@300;400;500;600;700;800;900&family=Source+Sans+3:wght@300;400;500;600;700;800;900&family=Fira+Sans:wght@300;400;500;600;700;800;900&family=Roboto+Condensed:wght@300;400;500;700&family=Roboto+Mono:wght@300;400;500;600;700&family=Rubik:wght@300;400;500;600;700;800;900&family=Ubuntu:wght@300;400;500;700&family=Manrope:wght@300;400;500;600;700;800&family=Bebas+Neue&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=Roboto+Flex:wght@300;400;500;600;700&family=Inter+Tight:wght@300;400;500;600;700;800;900&family=Geist:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&family=Figtree:wght@300;400;500;600;700;800;900&display=swap">
  <link rel="stylesheet" href="${(0, import_libraries3.libUrl)("latex.js", "dist/fonts/cmu.css")}">
  <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/futura-pt">
  <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/bauhaus-93">
  <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/national-park">${customFontLinks(customFonts)}
  <style>${customFontFaces(customFonts)}
    @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 400; src: url('${(0, import_libraries3.libUrl)("latex.js", "dist/fonts/Serif/cmunrm.woff")}') format('woff'); }
    @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 700; src: url('${(0, import_libraries3.libUrl)("latex.js", "dist/fonts/Serif/cmunbx.woff")}') format('woff'); }
    @font-face { font-family: 'Latin Modern Roman'; font-style: italic; font-weight: 400; src: url('${(0, import_libraries3.libUrl)("latex.js", "dist/fonts/Serif/cmunti.woff")}') format('woff'); }
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
    [data-popup]:hover { outline-color:rgba(251,191,36,0.5); box-shadow:0 0 12px rgba(251,191,36,0.2); }${CLICK_ACTION_CSS}${statesCss(presentation.slides)}${scrollingDeck ? SCROLLING_CSS : ""}${hasCitationMarkers(presentation) ? CITATION_CSS : ""}
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
  <script src="${(0, import_libraries3.libUrl)("reveal.js", "dist/reveal.js")}"></script>
  <script src="${(0, import_libraries3.libUrl)("reveal.js", "plugin/notes/notes.js")}"></script>
  <script src="${(0, import_libraries3.libUrl)("reveal.js", "plugin/highlight/highlight.js")}"></script>
  <script src="${(0, import_libraries3.libUrl)("katex", "dist/katex.min.js")}"></script>
  <script src="${(0, import_libraries3.libUrl)("katex", "dist/contrib/mhchem.min.js")}"></script>
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
${CLICK_ACTION_SCRIPT}${scrollingDeck ? SCROLLING_SCRIPT : ""}${hasGraphs(presentation) ? GRAPH_DECK_SCRIPT : ""}${hasEquations(presentation) ? equationDeckScript() : ""}${hasFeynman(presentation) || hasCircuits(presentation) || hasLogic(presentation) || hasFreebody(presentation) ? diagramDeckScript() : ""}${(presentation.slides || []).some((s) => (s.elements || []).some((el) => el.type === "graph" || el.type === "model" || el.type === "molecule")) ? EMBED_SCALE_SCRIPT : ""}

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
function escapeHtml(str6) {
  return String(str6).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

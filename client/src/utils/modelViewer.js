// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The page inside a 3D model element's iframe: an STL or GLB file on an
// orbitable Three.js stage, framed to fit. The editor's canvas, presented
// decks and the server's deck pages all run this page, so a model looks the
// same everywhere. The file is told apart by its first bytes, not its name:
// a GLB starts with "glTF", anything else is read as STL (ASCII or binary).

import { libUrl } from './libraries'

export const MODEL_EXTENSIONS = ['.stl', '.glb']

export const MODEL_VIEWS = [
  ['iso', 'Isometric'],
  ['front', 'Front'],
  ['top', 'Top'],
  ['right', 'Right'],
]

export const MODEL_DEFAULTS = {
  color: '#b8c2cc',
  background: 'transparent',
  view: 'iso',
  autoRotate: false,
  edges: false,
}

// Whether a file name is one the viewer reads
export function isModelFile(name) {
  const lower = String(name || '').toLowerCase()
  return MODEL_EXTENSIONS.some(ext => lower.endsWith(ext))
}

// What the viewer draws, for the editor's snapshot key: a thumbnail taken
// before a setting changed isn't reused after it
export function modelSnapshotContent(el) {
  return JSON.stringify([el.src, el.color, el.background, el.view, el.upAxis, el.edges])
}

// Into a <script>: no "</script>" or "<!--" can end it early
function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

// `src` is the file's URL as the page should fetch it (made absolute by the
// caller where the page won't resolve /uploads/…). `snapshotKey` (editor
// only) asks for a still to be sent to the slide panel once the model is in.
export function modelViewerHtml(el, { src = el.src, snapshotKey = null } = {}) {
  const options = {
    src: src || '',
    color: el.color || MODEL_DEFAULTS.color,
    background: el.background || MODEL_DEFAULTS.background,
    view: el.view || MODEL_DEFAULTS.view,
    // 'auto': STL has no up axis and is nearly always Z-up (CAD, slicers);
    // glTF is Y-up by definition
    up: el.upAxis === 'y' || el.upAxis === 'z' ? el.upAxis : 'auto',
    autoRotate: !!el.autoRotate,
    edges: !!el.edges,
    snapshotKey,
  }
  const imports = {
    three: libUrl('three', 'build/three.module.js'),
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block;outline:none}#status{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;text-align:center;font:13px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:rgba(128,128,128,0.9);pointer-events:none}#status.error{color:#e5484d}</style>
<script type="importmap">${scriptJson({ imports })}</script>
</head><body><div id="status">Loading model…</div>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from '${libUrl('three', 'examples/jsm/controls/OrbitControls.js')}';
import { GLTFLoader } from '${libUrl('three', 'examples/jsm/loaders/GLTFLoader.js')}';
import { STLLoader } from '${libUrl('three', 'examples/jsm/loaders/STLLoader.js')}';
import { RoomEnvironment } from '${libUrl('three', 'examples/jsm/environments/RoomEnvironment.js')}';

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
</script></body></html>`
}

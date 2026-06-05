// runtime/preview-engine/preview-app.js — browser entry. Wires the three
// adapter modules to Three.js + DOM.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ThreePreviewAdapter }     from './ThreePreviewAdapter.js';
import { SceneHierarchyRenderer }  from './SceneHierarchyRenderer.js';
import { PreviewStateSynchronizer } from './PreviewStateSynchronizer.js';

const adapter   = new ThreePreviewAdapter();
const hierarchy = new SceneHierarchyRenderer();
const sync      = new PreviewStateSynchronizer();

const $   = (id) => document.getElementById(id);
const setStatus = (s, cls) => { const el = $('status'); el.textContent = s; el.className = 'overlay overlay-topleft ' + (cls||''); };
const setLoaderStatus = (s) => { $('loader-status').textContent = 'three.js: ' + s; };

// ── Three.js bootstrap ────────────────────────────────────────────
const canvas   = $('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x0a0d12, 1);
setLoaderStatus('ready');

const scene  = new THREE.Scene();
scene.fog    = new THREE.Fog(0x0a0d12, 60, 240);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 5000);
camera.position.set(20, 18, 28);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.target.set(0, 2, 0);

// lights
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const sun = new THREE.DirectionalLight(0xffffff, 0.85);
sun.position.set(40, 60, 30); scene.add(sun);

// grid + axes
let grid = new THREE.GridHelper(80, 40, 0x2d333b, 0x1c2128);
scene.add(grid);
const axes = new THREE.AxesHelper(3); axes.position.y = 0.01; scene.add(axes);

// scene root replaced on every load
let sceneRoot = null;
let lastSpec  = null;
let manifest  = []; // [{ id, object3d, node }]
let selectedId = null;

// v62 — tier visibility state + heatmap toggle. `activeTiers` is null → all
// tiers visible. Otherwise it's a Set of integer tiers in {0..5}.
let activeTiers = null;
let heatmapOn   = false;

const TIER_LABELS = ['GAMEPLAY','STRUCTURE','SECONDARY','DETAIL','LIGHT','POLISH'];
const TIER_COLORS = [0x6ae28a, 0x4884de, 0x8a8ad4, 0xc08060, 0xffcc66, 0xff70b3];

// Per-target camera framing.  Each target type has a recognizable shape
// (obby = long Z corridor, fps = wide X arena, tycoon/rpg/sim = roughly
// square top-down). The default isometric 1-1-1 placement reads badly for
// the asymmetric ones, so we pick a side per target so the gameplay loop
// is visible at first glance.
const TARGET_VIEWPOINT = {
  // [xMult, yMult, zMult, lateralFactor] — multipliers applied to the
  // bounding-box reach. xMult/zMult chosen so the camera looks DOWN the
  // gameplay axis. lateralFactor widens the reach perpendicular to it.
  obby:      { x: 0.3, y: 0.5, z: 1.6, lateral: 1.0 }, // look from -Z toward +Z (the lane)
  fps:       { x: 1.2, y: 0.9, z: 0.4, lateral: 1.6 }, // wide arena, look down X
  tycoon:    { x: 1.0, y: 1.3, z: 1.0, lateral: 1.0 }, // top-down-ish
  simulator: { x: 1.0, y: 1.4, z: 1.0, lateral: 1.0 }, // concentric rings
  rpg:       { x: 1.0, y: 1.2, z: 1.0, lateral: 1.0 }, // hub town
  _default:  { x: 1.0, y: 0.7, z: 1.0, lateral: 1.0 },
};

function _viewpointFor(spec) {
  const t = String(spec.meta && spec.meta.target || "").toLowerCase();
  return TARGET_VIEWPOINT[t] || TARGET_VIEWPOINT._default;
}

function fitCamera(spec) {
  const [cx, cy, cz] = spec.bounds.center;
  const [sx, , sz]   = spec.bounds.size;
  const vp           = _viewpointFor(spec);
  // Use the longer of the two horizontal dimensions, scaled by lateral
  // factor so wide/long targets aren't cropped.
  const reach = Math.max(12, Math.max(sx, sz) * 1.4 * vp.lateral + 8);
  const camY  = Math.max(8, reach * vp.y);
  controls.target.set(cx, Math.max(2, cy), cz);
  camera.position.set(
    cx + reach * vp.x,
    cy + camY,
    cz - reach * vp.z, // negative Z so obby is viewed from the start line looking down the lane
  );
  controls.update();
}

function applySpec(spec) {
  if (sceneRoot) { scene.remove(sceneRoot); sceneRoot.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
  const built = adapter.renderToScene(spec, scene, THREE);
  Promise.resolve(built).then(({ root, manifest: m }) => {
    sceneRoot = root; manifest = m;
    fitCamera(spec);
    renderHierarchy(spec);
    renderMeta(spec);
    const label = spec.meta.source === 'production-scenegraph' ? 'parity' : 'preview';
    setStatus(`Loaded · ${spec.meta.structureCount} structures · ${label}`, '');
    lastSpec = spec;
    applyTierFilter();  // honor whatever tier filter is currently set
  });
}

function loadPreviewJson(json) {
  try {
    const spec = adapter.buildSceneSpec(json);
    if (lastSpec) {
      const patch = sync.diff(lastSpec, spec);
      console.info('[preview] diff', sync.summarise(patch));
    }
    applySpec(spec);
  } catch (e) { console.error(e); setStatus('Load failed: ' + e.message, 'err'); }
}

// ── Hierarchy / properties / meta rendering ──────────────────────
function renderMeta(spec) {
  $('meta-target').textContent  = spec.meta.target;
  $('meta-buildId').textContent = spec.meta.source === 'production-scenegraph'
    ? 'scenegraph-parity' : (spec.meta.buildId || '—');
  $('meta-count').textContent   = spec.meta.structureCount + ' structures';
  // v62 — surface Masterpiece Quality Score in the toolbar if the report rode along.
  const score = spec.meta.report && spec.meta.report.qualityScore;
  const el = $('quality-score');
  if (typeof score === 'number') {
    el.textContent = 'QualityScore: ' + score + '/100';
    el.className = 'tt-score ' + (score >= 85 ? 'ok' : score >= 65 ? 'warn' : 'err');
  } else {
    el.textContent = '—'; el.className = 'tt-score';
  }
}

// True when `node` passes the active tier filter (or there is no filter).
function nodeVisible(node) {
  if (!activeTiers) return true;
  if (typeof node?.tier !== 'number') return false;
  return activeTiers.has(node.tier);
}

function renderHierarchy(spec) {
  const tree = hierarchy.buildHierarchy(spec);
  const root = $('tree'); root.innerHTML = '';
  const draw = (node, depth, host) => {
    const row = document.createElement('div');
    row.className = 'tree-row'; row.style.paddingLeft = (8 + depth * 14) + 'px';
    row.dataset.nodeId = node.nodeId || '';
    const tierBadge = (typeof node.tier === 'number')
      ? `<span class="badge t${node.tier}">T${node.tier} ${TIER_LABELS[node.tier]||''}</span>` : '';
    const ruleBadge = (node.ruleTags && node.ruleTags.length)
      ? `<span class="badge rule" title="${escapeHtml(node.ruleTags.join(', '))}">RULE</span>` : '';
    row.innerHTML = `<span class="twirl${node.children.length?'':' empty'}">${node.children.length?'▾':'·'}</span>`
                  + `<span class="icon">${node.icon}</span>`
                  + `<span class="label">${escapeHtml(node.label)}</span>`
                  + `<span class="class-tag">${escapeHtml(node.luaClass)}</span>`
                  + tierBadge + ruleBadge;
    host.appendChild(row);
    const kids = document.createElement('div'); kids.className = 'tree-children';
    host.appendChild(kids);
    row.querySelector('.twirl').addEventListener('click', (e) => { e.stopPropagation(); kids.classList.toggle('collapsed'); row.querySelector('.twirl').textContent = kids.classList.contains('collapsed')?'▸':'▾'; });
    row.addEventListener('click', () => selectNode(node.nodeId, true));
    for (const c of node.children) draw(c, depth + 1, kids);
  };
  for (const r of tree.roots) draw(r, 0, root);
}

function renderProperties(node) {
  const host = $('props');
  if (!node) { host.innerHTML = '<div class="props-empty">Select an instance to inspect.</div>'; return; }
  const tier = (typeof node.tier === 'number')
    ? `T${node.tier} ${TIER_LABELS[node.tier] || ''}` : '—';
  const roleTags = (node.tags || []).filter(t =>
    !t.startsWith('tier:') && !t.startsWith('rule:') && !t.startsWith('zone:'));
  const zone = (node.tags || []).find(t => t.startsWith('zone:')) || '—';
  const rules = (node.ruleTags || []).join(', ') || '—';
  const rows = [
    ['Name',     escapeHtml(node.label)],
    ['ClassName',escapeHtml(node.luaClass)],
    ['Parent',   escapeHtml(node.parent)],
    ['Position', `(${node.position.map(v=>v.toFixed(2)).join(', ')})`],
    ['Size',     `(${node.size.map(v=>v.toFixed(2)).join(', ')})`],
    ['Material', escapeHtml(node.material)],
    ['Anchored', String(node.anchored)],
    ['Color',    `<span class="color-chip" style="--c:${node.color}"></span>${node.color}`],
    ['Tier',     escapeHtml(tier)],
    ['Role',     escapeHtml(roleTags.join(', ') || '—')],
    ['Zone',     escapeHtml(zone.replace(/^zone:/, ''))],
    ['Rules',    escapeHtml(rules)],
  ];
  host.innerHTML = '<h3>Instance</h3>' + rows.map(([k,v]) =>
    `<div class="prop-row"><span class="k">${k}</span><span class="v ${k==='Color'?'color-chip':''}">${v}</span></div>`).join('');
}

function selectNode(nodeId, scrollIntoView) {
  selectedId = nodeId || null;
  document.querySelectorAll('.tree-row.selected').forEach(r => r.classList.remove('selected'));
  if (!nodeId) { renderProperties(null); return; }
  const entry = manifest.find(m => m.id === nodeId);
  renderProperties(entry?.node || null);
  const row = document.querySelector(`.tree-row[data-node-id="${nodeId}"]`);
  if (row) { row.classList.add('selected'); if (scrollIntoView) row.scrollIntoView({ block: 'nearest' }); }
  manifest.forEach(m => {
    const mat = m.object3d.material;
    if (mat && 'emissiveIntensity' in mat) mat.emissiveIntensity = (m.id === nodeId) ? 0.8 : (m.node.glow ? 0.6 : 0);
  });
}

function escapeHtml(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

// ── Picking ───────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();
canvas.addEventListener('click', (ev) => {
  if (!sceneRoot) return;
  const r = canvas.getBoundingClientRect();
  mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(sceneRoot.children, true);
  selectNode(hits[0]?.object?.userData?.nodeId || null, true);
});

// ── Search ────────────────────────────────────────────────────────
$('tree-search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.tree-row').forEach(r => {
    const txt = r.textContent.toLowerCase();
    r.style.display = (!q || txt.includes(q)) ? '' : 'none';
  });
});

// ── Toolbar ───────────────────────────────────────────────────────
$('btn-frame').addEventListener('click', () => lastSpec && fitCamera(lastSpec));
$('btn-grid').addEventListener('click',  () => { grid.visible = !grid.visible; });

// ── Tier toolbar (v62) ────────────────────────────────────────────
function applyTierFilter() {
  // Hide meshes whose tier is filtered out.
  for (const m of manifest) {
    const visible = nodeVisible(m.node);
    m.object3d.visible = visible;
  }
  // Re-tint tree rows to dim filtered-out entries.
  document.querySelectorAll('.tree-row').forEach(r => {
    const id = r.dataset.nodeId;
    if (!id) { r.classList.remove('dimmed'); return; }
    const entry = manifest.find(m => m.id === id);
    if (entry && !nodeVisible(entry.node)) r.classList.add('dimmed');
    else r.classList.remove('dimmed');
  });
  applyHeatmap();
}

// Heatmap colours every visible mesh by tier so QualityGate metrics read
// instantly. Saves the original material colour on first toggle and restores
// it when toggled off.
function applyHeatmap() {
  for (const m of manifest) {
    const mat = m.object3d.material;
    if (!mat || !('color' in mat)) continue;
    if (!m._origColor) m._origColor = mat.color.getHex();
    if (heatmapOn && typeof m.node.tier === 'number') {
      mat.color.setHex(TIER_COLORS[m.node.tier] || 0x888899);
      if ('emissive' in mat) mat.emissive.setHex(TIER_COLORS[m.node.tier] || 0);
      if ('emissiveIntensity' in mat) mat.emissiveIntensity = 0.25;
    } else {
      mat.color.setHex(m._origColor);
      if ('emissive' in mat) mat.emissive.setHex(m.node.glow ? m._origColor : 0);
      if ('emissiveIntensity' in mat) mat.emissiveIntensity = m.node.glow ? 0.6 : 0;
    }
  }
}

document.querySelectorAll('#tier-toolbar .tt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const v = btn.dataset.tier;
    if (v === 'all') {
      activeTiers = null;
      document.querySelectorAll('#tier-toolbar .tt-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('#tier-toolbar .tt-all').classList.add('active');
    } else if (v === 'heatmap') {
      heatmapOn = !heatmapOn;
      btn.classList.toggle('active', heatmapOn);
    } else {
      const tier = Number(v);
      activeTiers = activeTiers || new Set();
      if (activeTiers.has(tier)) activeTiers.delete(tier);
      else activeTiers.add(tier);
      if (activeTiers.size === 0) activeTiers = null;
      document.querySelector('#tier-toolbar .tt-all').classList.toggle('active', !activeTiers);
      btn.classList.toggle('active', activeTiers && activeTiers.has(tier));
    }
    applyTierFilter();
  });
});
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'f' && lastSpec) fitCamera(lastSpec);
  if (e.key === 'g') grid.visible = !grid.visible;
});

// ── File-open ─────────────────────────────────────────────────────
$('file-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  if (file.name.endsWith('.zip')) { setStatus('ZIP open not yet supported in browser. Use CLI: node rbx.mjs preview <target>', 'warn'); return; }
  const text = await file.text();
  try { loadPreviewJson(JSON.parse(text)); } catch (e) { setStatus('Bad JSON: ' + e.message, 'err'); }
});

// ── Resize + render loop ──────────────────────────────────────────
function resize() {
  const host = canvas.parentElement;
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

let frame = 0, t0 = performance.now();
function loop() {
  controls.update(); renderer.render(scene, camera);
  frame++; const now = performance.now();
  if (now - t0 >= 500) {
    $('fps').textContent = ((frame * 1000) / (now - t0)).toFixed(0) + ' fps';
    $('renderinfo').textContent = renderer.info.render.calls + ' draws · ' + renderer.info.render.triangles + ' tris';
    frame = 0; t0 = now;
  }
  requestAnimationFrame(loop);
}
loop();

// ── Auto-load: /api/preview when served by preview-server.js, else demo ──
async function bootstrap() {
  setStatus('Loading preview…');
  try {
    const r = await fetch('./api/preview/latest');
    if (r.ok) { loadPreviewJson(await r.json()); return; }
  } catch (_) { /* offline open */ }
  setStatus('No build loaded — open a generatedPreview.json from the toolbar.', 'warn');
  loadPreviewJson({ schemaVersion: '1.0.0', target: 'demo', buildId: 'none', structures: [] });
}
bootstrap();

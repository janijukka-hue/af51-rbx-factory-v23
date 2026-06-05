// runtime/preview-engine/ThreePreviewAdapter.js
//
// Universal adapter that converts `generatedPreview.json` into a renderer-
// agnostic scene specification. Node-testable; the browser entry imports it
// and feeds the spec to scene-builder.js (which is the Three.js-aware half).
//
// Output shape (stable contract):
//   {
//     meta:   { target, buildId, schemaVersion, structureCount },
//     bounds: { min:[x,y,z], max:[x,y,z], center:[x,y,z], size:[w,h,d] },
//     nodes:  [ { id, label, luaClass, shape, parent, position:[x,y,z],
//                 size:[w,h,d], color, material, anchored, glow, depth } ],
//     groups: { <parentKey>: [nodeId, ...] }
//   }
//
// `depth` is the inferred hierarchy depth (root = 0). It's used by the layout
// pass to spread stacked-at-origin nodes across the X/Z plane while keeping
// children visually under their parent.

const TOP_LEVEL_PARENTS = new Set([
  'Workspace', 'ReplicatedStorage', 'ServerScriptService',
  'ServerStorage', 'StarterPlayer', 'StarterGui', 'StarterPack',
  'Lighting', 'SoundService', 'Teams', 'Players',
]);

function _parentKey(rawParent) {
  if (!rawParent) return 'Workspace';
  // PreviewBridge sometimes emits "Folder(folder)" — strip the parenthetical
  const stripped = String(rawParent).replace(/\s*\([^)]*\)\s*$/, '').trim();
  return stripped || 'Workspace';
}

function _inferDepth(parents, key, seen = new Set()) {
  if (TOP_LEVEL_PARENTS.has(key)) return 1;
  if (!parents.has(key) || seen.has(key)) return 1;
  seen.add(key);
  return 1 + _inferDepth(parents, parents.get(key), seen);
}

// Production-scenegraph nodes carry Vector3 / Color3 / CFrame literals in
// their properties map. The regex skips the first numeric token because it
// belongs to the constructor name (Vector3 → "3"). Mirrors quality-metrics.js.
function _nums(str) {
  if (typeof str !== 'string') return [];
  const all = str.match(/-?\d+\.?\d*/g) || [];
  if (/^(Vector3|Color3|CFrame|UDim2?|BrickColor)/.test(str)) return all.slice(1).map(Number);
  return all.map(Number);
}
function _hex(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
function _propsColor(p) {
  if (!p || typeof p.Color !== 'string') return '#888899';
  const v = _nums(p.Color);
  if (v.length >= 3) return _hex(v[0], v[1], v[2]);
  return '#888899';
}
function _propsSize(p) {
  if (!p) return [1, 1, 1];
  const v = _nums(p.Size);
  return v.length >= 3 ? [v[0], v[1], v[2]] : [1, 1, 1];
}
function _propsPos(p) {
  if (!p) return [0, 0, 0];
  if (typeof p.Position === 'string') {
    const v = _nums(p.Position);
    if (v.length >= 3) return [v[0], v[1], v[2]];
  }
  if (typeof p.CFrame === 'string') {
    const v = _nums(p.CFrame);
    if (v.length >= 3) return [v[0], v[1], v[2]];
  }
  return [0, 0, 0];
}
function _materialName(p) {
  if (!p || typeof p.Material !== 'string') return 'SmoothPlastic';
  return p.Material.replace(/^Enum\.Material\./, '');
}
function _tierOf(tags) {
  for (const t of tags || []) if (t.startsWith('tier:')) return Number(t.slice(5));
  return null;
}
function _ruleTagsOf(tags) {
  return (tags || []).filter(t => t.startsWith('rule:'));
}

// Convert a production-scenegraph.json (Workspace/AF51Scene/* nodes) into the
// same `structures` shape generatedPreview.json uses. Lighting children and
// non-Workspace services are kept under their service parent so the tree still
// surfaces them.
function _scenegraphToStructures(sg) {
  const out = [];
  const STRIP = 'Workspace/AF51Scene';
  for (let i = 0; i < sg.nodes.length; i++) {
    const n = sg.nodes[i];
    const p = n.properties || {};
    const [x, y, z] = _propsPos(p);
    const [w, h, d] = _propsSize(p);
    let parent = n.parent;
    if (parent === STRIP) parent = 'Workspace';
    else if (parent.startsWith(STRIP + '/')) parent = parent.substring(STRIP.length + 1);
    out.push({
      id: n.id,
      label: n.name,
      luaClass: n.className,
      shape: n.className,
      parent,
      x, y, z, w, h, d,
      color: _propsColor(p),
      material: _materialName(p),
      anchored: !!p.Anchored,
      glow: _materialName(p) === 'Neon' || (n.tags || []).includes('emissive'),
      tier: _tierOf(n.tags),
      tags: Array.isArray(n.tags) ? [...n.tags] : [],
      ruleTags: _ruleTagsOf(n.tags),
    });
  }
  return out;
}

export class ThreePreviewAdapter {
  /**
   * Accepts either:
   *   - generatedPreview.json:    { schemaVersion, target, buildId, structures }
   *   - production-scenegraph.json: { targetId, nodes, services, report }
   *
   * Returns the same normalized spec either way.
   */
  buildSceneSpec(previewJson) {
    if (!previewJson) return { meta: { structureCount: 0 }, bounds: _emptyBounds(), nodes: [], groups: {} };
    let structures, source;
    if (Array.isArray(previewJson.structures)) {
      structures = previewJson.structures;
      source = 'generatedPreview';
    } else if (Array.isArray(previewJson.nodes)) {
      structures = _scenegraphToStructures(previewJson);
      source = 'production-scenegraph';
    } else {
      return { meta: { structureCount: 0 }, bounds: _emptyBounds(), nodes: [], groups: {} };
    }

    // First pass: build parent map (nodeId → parentKey) for depth inference.
    const labelToId = new Map();
    structures.forEach(s => { if (s.label && !labelToId.has(s.label)) labelToId.set(s.label, s.id); });
    const parents = new Map();
    structures.forEach(s => parents.set(s.id, _parentKey(s.parent)));

    // Second pass: normalize, infer depth, group by parent.
    const groups = Object.create(null);
    const nodes = structures.map(s => {
      const pkey  = _parentKey(s.parent);
      const depth = _inferDepth(parents, pkey);
      (groups[pkey] ||= []).push(s.id);
      return {
        id:       s.id,
        label:    s.label || s.id,
        luaClass: s.luaClass || 'Part',
        shape:    s.shape    || s.luaClass || 'Part',
        parent:   pkey,
        position: [Number(s.x)||0, Number(s.y)||0, Number(s.z)||0],
        size:     [Number(s.w)||1, Number(s.h)||1, Number(s.d)||1],
        color:    s.color   || '#888899',
        material: s.material|| 'SmoothPlastic',
        anchored: !!s.anchored,
        glow:     !!s.glow,
        depth,
        tier:     (typeof s.tier === 'number') ? s.tier : null,
        tags:     Array.isArray(s.tags) ? s.tags : [],
        ruleTags: Array.isArray(s.ruleTags) ? s.ruleTags : [],
      };
    });

    return { meta: _meta(previewJson, source, structures.length),
             bounds: _computeBounds(nodes), nodes, groups };
  }

  /** Browser-only: realize the spec onto a THREE.Scene. Imported lazily so
   *  this file stays Node-loadable. The actual Three.js work lives in
   *  scene-builder.js to keep this adapter dep-free.
   */
  async renderToScene(spec, scene, THREE) {
    const { buildSceneObjects } = await import('./scene-builder.js');
    return buildSceneObjects(spec, scene, THREE);
  }
}

function _meta(p, source, count) {
  return {
    target:         p.target || p.targetId || 'unknown',
    buildId:        p.buildId || (p.report && p.report.type) || 'unknown',
    schemaVersion:  p.schemaVersion || '1.0.0',
    structureCount: count,
    source:         source || 'unknown',
    report:         p.report || null,
  };
}

function _emptyBounds() {
  return { min: [0,0,0], max: [0,0,0], center: [0,0,0], size: [0,0,0] };
}

function _computeBounds(nodes) {
  if (!nodes.length) return _emptyBounds();
  let mnx=Infinity,mny=Infinity,mnz=Infinity, mxx=-Infinity,mxy=-Infinity,mxz=-Infinity;
  for (const n of nodes) {
    const [x,y,z] = n.position, [w,h,d] = n.size;
    mnx = Math.min(mnx, x - w/2); mxx = Math.max(mxx, x + w/2);
    mny = Math.min(mny, y - h/2); mxy = Math.max(mxy, y + h/2);
    mnz = Math.min(mnz, z - d/2); mxz = Math.max(mxz, z + d/2);
  }
  return {
    min:    [mnx, mny, mnz],
    max:    [mxx, mxy, mxz],
    center: [(mnx+mxx)/2, (mny+mxy)/2, (mnz+mxz)/2],
    size:   [mxx-mnx, mxy-mny, mxz-mnz],
  };
}

export default ThreePreviewAdapter;

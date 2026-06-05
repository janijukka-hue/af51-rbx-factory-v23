// runtime/preview-engine/scene-builder.js
//
// Browser-only. Translates a scene spec (from ThreePreviewAdapter) into
// Three.js Object3Ds, attaches them to a parent group, returns a manifest
// the UI panel uses for picking + property inspection.

// Hex string ("#888899") → THREE.Color-compatible number.
function _hex(s) {
  if (typeof s !== 'string') return 0x888899;
  const v = parseInt(s.replace(/^#/, ''), 16);
  return Number.isFinite(v) ? v : 0x888899;
}

// Hashes a string deterministically so co-located nodes get different
// auto-layout offsets even when the bridge stacked them at the same x/y/z.
function _hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

// Mesh dispatcher. Returns a THREE.Object3D positioned at origin; the caller
// translates it. Falls back to a wireframe cube for unknown classes.
function _meshFor(node, THREE) {
  const [w, h, d] = node.size;
  const colorNum  = _hex(node.color);
  const luaClass  = node.luaClass;
  const isService = /Service$|Storage$|^Lighting$|^Players$|^Teams$/.test(luaClass)
                 || luaClass === 'Workspace';

  // ── Organisational containers: transparent wireframe bounds ─────────
  if (luaClass === 'Folder' || luaClass === 'Model' || isService) {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const edge = new THREE.EdgesGeometry(geo);
    const mat  = new THREE.LineBasicMaterial({ color: colorNum, transparent: true, opacity: 0.55 });
    return new THREE.LineSegments(edge, mat);
  }

  // ── Network glyphs: octahedron ──────────────────────────────────────
  if (/^Remote(Event|Function)$|^BindableEvent$/.test(luaClass)) {
    const r   = Math.max(0.4, Math.min(w, h, d) * 0.5);
    const geo = new THREE.OctahedronGeometry(r);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3aa0ff, metalness: 0.3, roughness: 0.4, emissive: 0x113355 });
    return new THREE.Mesh(geo, mat);
  }

  // ── Script glyphs: tetrahedron ──────────────────────────────────────
  if (/Script$/.test(luaClass)) {
    const r   = Math.max(0.45, Math.min(w, h, d) * 0.6);
    const geo = new THREE.TetrahedronGeometry(r);
    const tint = luaClass === 'LocalScript' ? 0x66ddff
              : luaClass === 'ModuleScript' ? 0xff9966 : 0x88ff88;
    const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.7, emissive: tint, emissiveIntensity: 0.15 });
    return new THREE.Mesh(geo, mat);
  }

  // ── Audio / animation / decal: small sphere wireframe ───────────────
  if (/^(Sound|Animation|Decal)$/.test(luaClass)) {
    const r   = Math.max(0.3, Math.min(w, h, d) * 0.4);
    const geo = new THREE.SphereGeometry(r, 12, 8);
    const mat = new THREE.MeshBasicMaterial({ color: colorNum, wireframe: true });
    return new THREE.Mesh(geo, mat);
  }

  // ── SpawnLocation: flat green disc ──────────────────────────────────
  if (luaClass === 'SpawnLocation') {
    const r   = Math.max(0.6, Math.min(w, d) * 0.7);
    const geo = new THREE.CylinderGeometry(r, r, Math.max(0.2, h * 0.3), 24);
    const mat = new THREE.MeshStandardMaterial({ color: 0x55cc55, roughness: 0.6, emissive: 0x114411, emissiveIntensity: 0.4 });
    return new THREE.Mesh(geo, mat);
  }

  // ── WedgePart: triangular prism via custom geometry ─────────────────
  if (luaClass === 'WedgePart') {
    const geo = new THREE.BufferGeometry();
    const hw = w/2, hh = h/2, hd = d/2;
    const v  = new Float32Array([
      -hw,-hh,-hd,  hw,-hh,-hd,  hw,-hh, hd,  -hw,-hh, hd,
      -hw, hh,-hd,  hw, hh,-hd,
    ]);
    const idx = [0,1,2, 0,2,3, 4,1,0, 4,5,1, 4,0,3, 4,3,5, 5,2,1, 5,3,2];
    geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: colorNum, roughness: 0.55 });
    return new THREE.Mesh(geo, mat);
  }

  // ── Default: solid Part box ─────────────────────────────────────────
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color: colorNum, roughness: node.material === 'Neon' ? 0.1 : 0.55,
    metalness: node.material === 'Metal' ? 0.7 : 0.05,
    emissive: node.glow ? colorNum : 0x000000,
    emissiveIntensity: node.glow ? 0.6 : 0,
  });
  return new THREE.Mesh(geo, mat);
}

// Spread co-located nodes across a Fibonacci-spiral on the X/Z plane so the
// camera-framed scene is readable even when the bridge stacked everything at
// the same coordinates.
function _layoutPosition(node, indexWithinParent) {
  const [x, y, z] = node.position;
  const k = indexWithinParent + 1;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const r      = Math.max(2, 1.5 * Math.sqrt(k));
  const a      = k * golden + (_hash(node.parent) % 360) * Math.PI / 180;
  return [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
}

export function buildSceneObjects(spec, scene, THREE) {
  const root = new THREE.Group();
  root.name = 'AF51-Preview';
  scene.add(root);

  const manifest = []; // [{ id, object3d, node }]

  for (const parentKey of Object.keys(spec.groups || {})) {
    spec.groups[parentKey].forEach((nodeId, i) => {
      const node = spec.nodes.find(n => n.id === nodeId);
      if (!node) return;
      const obj = _meshFor(node, THREE);
      const [px, py, pz] = _layoutPosition(node, i);
      obj.position.set(px, py, pz);
      obj.userData.nodeId = node.id;
      root.add(obj);
      manifest.push({ id: node.id, object3d: obj, node });
    });
  }

  return { root, manifest };
}

export default { buildSceneObjects };

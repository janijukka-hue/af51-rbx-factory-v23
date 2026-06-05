// runtime/rbx-runtime/PreviewRenderer.js
// AF51-RBX — Renders an RBX object graph into preview structures.
// Reflects the real parsed instances. No hardcoded scenes. No execution.
//
// Shape/semantic interpretation is delegated to the RBX Skill layer
// (s4/oliot/rbx-skills). Skills are pure interpreters of parsed code; if a
// skill returns nothing the renderer falls back to its own v14 logic, so the
// preview can never break from a half-finished skill.
import { interpretNode, makeCtx } from '../../s4/oliot/rbx-skills/index.js';

const CLASS_MAP = {
  Part:            { type: 'platform', color: '#4488CC', glow: false },
  WedgePart:       { type: 'platform', color: '#5599DD', glow: false },
  TrussPart:       { type: 'platform', color: '#6655CC', glow: false },
  CornerWedgePart: { type: 'platform', color: '#5599DD', glow: false },
  SpawnLocation:   { type: 'platform', color: '#A8FF2F', glow: true },
  Model:           { type: 'building', color: '#6A6A7A', glow: false },
  MeshPart:        { type: 'building', color: '#7788AA', glow: false },
  UnionOperation:  { type: 'building', color: '#8899BB', glow: false },
  Decal:           { type: 'window',   color: '#25D0FF', glow: true },
  Texture:         { type: 'window',   color: '#25D0FF', glow: true },
  PointLight:      { type: 'light',    color: '#FFE08A', glow: true },
  SpotLight:       { type: 'light',    color: '#FFD060', glow: true },
  SurfaceLight:    { type: 'light',    color: '#FFE8A0', glow: true },
  ParticleEmitter: { type: 'effect',   color: '#FF2FD1', glow: true },
  Fire:            { type: 'effect',   color: '#FF6622', glow: true },
  Smoke:           { type: 'effect',   color: '#AAAAAA', glow: true },
  Sound:           { type: 'effect',   color: '#22DDAA', glow: false },
  // UI classes — 2D, sized with UDim2 not Vector3. Mapped to a flat placeholder.
  ScreenGui:       { type: 'ui', color: '#2D7FF9', glow: false, ui: true },
  Frame:           { type: 'ui', color: '#3D8FE0', glow: false, ui: true },
  TextLabel:       { type: 'ui', color: '#46C0FF', glow: false, ui: true },
  TextButton:      { type: 'ui', color: '#56D0FF', glow: true,  ui: true },
  TextBox:         { type: 'ui', color: '#46C0FF', glow: false, ui: true },
  ImageLabel:      { type: 'ui', color: '#9B6CFF', glow: false, ui: true },
  ImageButton:     { type: 'ui', color: '#AB7CFF', glow: true,  ui: true },
  ScrollingFrame:  { type: 'ui', color: '#3D8FE0', glow: false, ui: true },
  SurfaceGui:      { type: 'ui', color: '#2D7FF9', glow: false, ui: true },
  BillboardGui:    { type: 'ui', color: '#2D7FF9', glow: false, ui: true },
  UIListLayout:    { type: 'ui', color: '#667788', glow: false, ui: true },
  UIGridLayout:    { type: 'ui', color: '#667788', glow: false, ui: true },
  UICorner:        { type: 'ui', color: '#667788', glow: false, ui: true },
};

// Coerce a possibly-NaN dimension to a finite, sane number.
function safeDim(v, fallback) {
  return Number.isFinite(v) ? v : fallback;
}

// Map a Roblox MeshType / dedicated-mesh class to a preview draw shape.
// The canvas knows: Block, Ball, Cylinder, Wedge. Anything rounded → Ball,
// anything tubular → Cylinder, so heads/spheres render round and limbs round.
function meshTypeToShape(meshType) {
  const t = String(meshType || '').replace(/^Enum\.MeshType\./, '').toLowerCase();
  if (t === 'sphere' || t === 'head' || t === 'ball') return 'Ball';
  if (t === 'cylinder') return 'Cylinder';
  if (t === 'wedge') return 'Wedge';
  if (t === 'brick' || t === 'block' || t === 'cube') return 'Block';
  return null; // unknown → let caller fall back
}

// Dedicated mesh classes carry their shape in the class name itself.
function meshClassToShape(className) {
  switch (className) {
    case 'SphereMesh':   return 'Ball';
    case 'CylinderMesh': return 'Cylinder';
    case 'BlockMesh':    return 'Block';
    default:             return null;
  }
}

// Decide the preview draw-shape for a node.
//   1. A Part with a mesh child inherits that child's shape (B).
//   2. A Part uses its own .Shape (Ball/Cylinder/Wedge/Block).
//   3. A MeshPart derives from .MeshType, else a generic rounded "building".
//   4. Mesh classes themselves aren't drawn as standalone boxes — the parent
//      already adopted their shape — so they keep their class label.
function resolveShape(node, p, meshShapeByParentVar, skill) {
  // Skill layer first: it understands semantics (head→Ball, mesh child, limbs).
  if (skill && skill.shape) return skill.shape;

  // Fallback: v14 built-in logic (unchanged), so behavior is safe even if the
  // skill layer returns no shape opinion for this node.
  const inherited = node.varName ? meshShapeByParentVar[node.varName] : null;
  if (node.className === 'Part') {
    return inherited || p.Shape || 'Block';
  }
  if (node.className === 'MeshPart') {
    return meshTypeToShape(p.MeshType) || inherited || 'Cylinder';
  }
  return inherited || node.className;
}

export class PreviewRenderer {
  render(graph) {
    const nodes = (graph && graph.nodes) || [];
    const posByVar = {};

    // Skill context over the parsed graph (read-only views of children/parents).
    const skillCtx = makeCtx(nodes);

    // ── B) Mesh-child shape inheritance ──────────────────────────────────
    // A Part with a SpecialMesh/CylinderMesh/BlockMesh/SphereMesh child should
    // render as that shape, not as a plain box. Build parentVar → shape from
    // any mesh node so the owning Part can adopt it below.
    const meshShapeByParentVar = {};
    for (const n of nodes) {
      let shape = null;
      if (n.className === 'SpecialMesh') {
        shape = meshTypeToShape((n.properties || {}).MeshType);
      } else {
        shape = meshClassToShape(n.className);
      }
      if (shape && n.parentVar) meshShapeByParentVar[n.parentVar] = shape;
    }

    const structures = nodes.map((node, i) => {
      const map = CLASS_MAP[node.className] || { type: 'platform', color: '#888899', glow: false };
      const p = node.properties || {};
      const isUI = map.ui === true;

      // RBX Skill interpretation (safe: {} if no skill matched).
      let skill = {};
      try { skill = interpretNode(node, skillCtx) || {}; } catch (e) { skill = {}; }

      // UI classes use UDim2 (not Vector3) → never trust p.Size as 3D dims.
      // Give them a flat, fixed placeholder so they never produce NaN.
      const hasExplicitSize = Array.isArray(p.Size);
      const rp = skill.roleProportion;
      const size = isUI
        ? [8, 0.4, 5]
        : hasExplicitSize
          ? p.Size
          : (rp ? [rp.w, rp.h, rp.d] : [4, 1, 4]); // role proportion fills the gap

      // Position: explicit, else CFrame, else near parent instance, else laid out.
      let pos = (!isUI && (p.Position || p.CFrame)) || null;
      if (!pos && node.parentVar && posByVar[node.parentVar]) {
        const pp = posByVar[node.parentVar];
        pos = [pp[0], pp[1] + 2, pp[2]]; // sit atop parent
      }
      if (!pos) pos = [i * 6, isUI ? 8 : 1, 0]; // float UI elements above ground
      posByVar[node.varName] = pos;

      // Color priority: explicit Color3/BrickColor from code → role tint hint
      // (only when code gave none) → class default. Code always wins.
      const explicitColor = p.Color || p.BrickColor;
      const color = explicitColor || skill.roleColor || map.color;

      return {
        id: node.id,
        type: map.type,
        label: String(p.Name || node.className || 'PART').toUpperCase(),
        x: Math.round(safeDim(pos[0], 0)),
        y: Math.round(safeDim(pos[1], 1)),
        z: Math.round(safeDim(pos[2], 0)),
        w: Math.max(1, Math.round(safeDim(size[0], isUI ? 8 : 4))),
        h: Math.max(1, Math.round(safeDim(size[1], isUI ? 1 : 1))),
        d: Math.max(1, Math.round(safeDim(size[2], isUI ? 5 : 4))),
        color,
        glow: skill.glow != null ? skill.glow : (map.glow || (p.Material === 'Neon')),
        luaClass: node.className,
        parent: node.parent || 'workspace',
        anchored: p.Anchored === true,
        material: skill.material || p.Material || 'SmoothPlastic',
        shape: resolveShape(node, p, meshShapeByParentVar, skill),
        role: skill.role || null,    // semantic role (humanoid-part, ui-element, …)
        kind: skill.kind || null,    // head | torso | limb | part | ui | …
      };
    });

    return {
      type: 'RBX_PREVIEW',
      schemaVersion: '1.0.0',
      source: 'lua-object-graph',
      structures,
      objects: nodes.map((n) => ({ id: n.id, className: n.className, parent: n.parent })),
    };
  }
}

export default PreviewRenderer;

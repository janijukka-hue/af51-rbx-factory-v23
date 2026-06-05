// s4/oliot/rbx-skills/_skillBase.js
// KERROS: S4 – Olio · RBX Skill Layer
// Version: 1.0.0
//
// Shared contract for every RBX skill. A skill INTERPRETS an already-parsed
// instance node — it never generates new objects. Each skill exposes:
//
//   match(node, ctx)     → bool   "do I recognize this node?"
//   interpret(node, ctx) → result (only called when match() is true)
//
// `node`  = parsed instance: { id, className, properties, parent, parentVar,
//                              varName, children? }
// `ctx`   = { childrenOf(varName), nodeByVar(varName), all } — read-only views
//
// The interpret() result is a partial set of preview/semantic hints:
//   { kind, shape, role, glow, material, transparency, isLight, isEffect,
//     isScript, drawable, label }
// Any field may be omitted; the renderer merges results over its own defaults,
// so a skill is always safe — a missing field changes nothing.

export const SAFE_RESULT = Object.freeze({}); // empty = "no opinion", never breaks

// MeshType / dedicated-mesh → preview draw shape.
export function meshTypeToShape(meshType) {
  const t = String(meshType || "").replace(/^Enum\.MeshType\./, "").toLowerCase();
  if (t === "sphere" || t === "head" || t === "ball") return "Ball";
  if (t === "cylinder") return "Cylinder";
  if (t === "wedge") return "Wedge";
  if (t === "brick" || t === "block" || t === "cube" || t === "torso") return "Block";
  return null;
}

export function meshClassToShape(className) {
  switch (className) {
    case "SphereMesh":   return "Ball";
    case "CylinderMesh": return "Cylinder";
    case "BlockMesh":    return "Block";
    default:             return null;
  }
}

// Normalize a PartType-ish value ("Enum.PartType.Ball" | "Ball") → draw shape.
export function partShape(shape) {
  const t = String(shape || "").replace(/^Enum\.PartType\./, "");
  if (t === "Ball" || t === "Cylinder" || t === "Wedge" || t === "Block") return t;
  return null;
}

// Build a read-only ctx over a flat node list (parent links via parentVar).
export function makeCtx(nodes) {
  const byVar = {};
  const childrenByParent = {};
  for (const n of nodes) {
    if (n.varName) byVar[n.varName] = n;
  }
  for (const n of nodes) {
    if (n.parentVar) {
      (childrenByParent[n.parentVar] = childrenByParent[n.parentVar] || []).push(n);
    }
  }
  return {
    all: nodes,
    nodeByVar: (v) => byVar[v] || null,
    childrenOf: (v) => childrenByParent[v] || [],
  };
}

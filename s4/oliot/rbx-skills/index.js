// s4/oliot/rbx-skills/index.js
// KERROS: S4 – Olio · RBX Skill Layer · Version 1.0.0
//
// The RBX Skill registry. interpretNode(node, ctx) runs every matching skill in
// priority order and merges their hints into one semantic result. Skills are
// PURE INTERPRETERS of already-parsed code — none of them generate objects.
//
// Merge rule: later (more specific) skills override earlier ones for the same
// key, but a skill that returns nothing changes nothing. Any skill throwing is
// swallowed and ignored, so a half-finished skill can never break the preview.
//
//   import { interpretNode, interpretGraph } from ".../rbx-skills/index.js";
//   const result = interpretNode(node, ctx);   // { kind, shape, glow, ... }

import { makeCtx, SAFE_RESULT } from "./_skillBase.js";
import { HierarchySkill } from "./HierarchySkill.js";
import { ScriptSkill }    from "./ScriptSkill.js";
import { UISkill }        from "./UISkill.js";
import { LightingSkill }  from "./LightingSkill.js";
import { EffectSkill }    from "./EffectSkill.js";
import { TransformSkill } from "./TransformSkill.js";
import { MaterialSkill }  from "./MaterialSkill.js";
import { PartSkill }      from "./PartSkill.js";
import { MeshSkill }      from "./MeshSkill.js";
import { HumanoidSkill }  from "./HumanoidSkill.js";

// Order = increasing specificity. Generic class/category skills first; the
// shape-deciding skills (Part → Mesh → Humanoid) last so the most specific
// interpretation wins the `shape` field.
//   - Hierarchy/Script/UI/Light/Effect set the broad kind + drawable flag
//   - Transform/Material add dimension + surface hints
//   - Part sets the base primitive shape
//   - Mesh overrides shape when a mesh/mesh-child is present
//   - Humanoid overrides for recognized character parts (head round, etc.)
const SKILLS = [
  HierarchySkill, ScriptSkill, UISkill, LightingSkill, EffectSkill,
  TransformSkill, MaterialSkill,
  PartSkill, MeshSkill, HumanoidSkill,
];

export function interpretNode(node, ctx) {
  if (!node) return { ...SAFE_RESULT };
  const merged = {};
  const applied = [];
  for (const skill of SKILLS) {
    try {
      if (skill.match(node, ctx)) {
        const out = skill.interpret(node, ctx) || {};
        Object.assign(merged, out);
        applied.push(skill.name);
      }
    } catch (e) {
      // A broken skill must never break the preview — ignore and continue.
    }
  }
  merged._skills = applied; // provenance, handy for debugging/tests
  return merged;
}

// Interpret a whole parsed graph → map of nodeId → result.
export function interpretGraph(graph) {
  const nodes = (graph && graph.nodes) || [];
  const ctx = makeCtx(nodes);
  const out = {};
  for (const n of nodes) out[n.id] = interpretNode(n, ctx);
  return out;
}

export {
  makeCtx,
  HierarchySkill, ScriptSkill, UISkill, LightingSkill, EffectSkill,
  TransformSkill, MaterialSkill, PartSkill, MeshSkill, HumanoidSkill,
};
export default { interpretNode, interpretGraph };

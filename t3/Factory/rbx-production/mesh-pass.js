// t3/Factory/rbx-production/mesh-pass.js
// AF51-RBX | T3 Layer — MeshPass (v63)
// Role  : Replaces cubic Part silhouettes with engine-primitive variety so the
//         scene reads as authored architecture instead of stacked boxes.
//         Uses Roblox's built-in `Part.Shape` (Block/Cylinder/Ball/Wedge) and
//         `SpecialMesh` children with MeshType=Sphere/Cylinder/Wedge/Brick —
//         all engine-bundled, no external AssetIds, fully deterministic.
//         Runs after MasterpiecePass, before TierTagger.

// Tag → mesh strategy. First matching tag wins (order matters for tie-breaks).
// Each entry is `{ shape?, mesh? }`:
//   shape : if set, mutate Part.properties.Shape to this Enum.PartType value.
//   mesh  : if set, add a SpecialMesh child with these properties.
const STRATEGY = [
  // Towers / spires — cylindrical body + slight taper on top.
  { match: ["tower", "spire", "goal-tower"],
    shape: "Enum.PartType.Cylinder",
    mesh:  { MeshType: "Enum.MeshType.Cylinder", Scale: "Vector3.new(1, 1, 1)" } },

  // Domes / shrines — spherical cap.
  { match: ["dome", "shrine", "upgrade-shrine", "loot-shrine"],
    shape: "Enum.PartType.Ball",
    mesh:  { MeshType: "Enum.MeshType.Sphere", Scale: "Vector3.new(1.05, 1.05, 1.05)" } },

  // Pillars / buttresses / columns — true cylinders.
  { match: ["pillar", "buttress", "column"],
    shape: "Enum.PartType.Cylinder",
    mesh:  null },

  // Beacons / reward beacons — vertical neon sphere on a stem reads as a beacon.
  { match: ["beacon", "reward-beacon"],
    shape: "Enum.PartType.Ball",
    mesh:  { MeshType: "Enum.MeshType.Sphere", Scale: "Vector3.new(1.15, 1.4, 1.15)" } },

  // Gates / checkpoints / vaults — keep block but wedge the top for arch feel.
  { match: ["gate", "checkpoint-gate", "village-gate", "vault", "collector-vault"],
    shape: null,
    mesh:  { MeshType: "Enum.MeshType.Brick", Scale: "Vector3.new(1.02, 1.05, 1.02)" } },

  // Roofs / canopies — wedge silhouette.
  { match: ["roof", "canopy", "ramp"],
    shape: "Enum.PartType.Wedge",
    mesh:  null },

  // Generic landmark fallback — slight scale bump on a Brick mesh so the
  // landmark catches more rim light vs surrounding shell parts.
  { match: ["landmark", "hero"],
    shape: null,
    mesh:  { MeshType: "Enum.MeshType.Brick", Scale: "Vector3.new(1.04, 1.08, 1.04)" } },
];

// ─── HUMANOID ROLE MAPPING ────────────────────────────────────────────────────
// Strategy for humanoid parts based on `kind` attribute. Used by _pickHumanoid().
// Transforms NPC/Character geometry from boxes → recognizable character forms.
const HUMANOID_STRATEGY = {
  // Head → Sphere (pyöreä pää)
  head: {
    shape: "Enum.PartType.Ball",
    mesh:  { MeshType: "Enum.MeshType.Sphere", Scale: "Vector3.new(1.0, 1.0, 1.0)" },
  },
  // Torso → Box (readable torso, keep as-is or slight brick mesh)
  torso: {
    shape: null, // Keep Block
    mesh:  { MeshType: "Enum.MeshType.Brick", Scale: "Vector3.new(1.0, 1.0, 1.0)" },
  },
  // Limbs (arms/legs) → Cylinder with rounded caps (capsule-like via scale)
  limb: {
    shape: "Enum.PartType.Cylinder",
    mesh:  { MeshType: "Enum.MeshType.Cylinder", Scale: "Vector3.new(1.0, 1.0, 1.0)" },
  },
};

// Tags we never touch — props that read better as plain blocks.
const EXEMPT = new Set(["crate", "trim", "shell", "wall", "perimeter", "depth-frame",
                         "rail", "energy-rail", "conveyor", "floor", "platform",
                         "module", "obstacle"]);

function _pick(tags) {
  if (!tags || !tags.length) return null;
  // EXEMPT wins: never override props/trim/shell silhouettes.
  for (const t of tags) if (EXEMPT.has(t)) {
    // EXCEPTION: landmark+module is still landmark — match on landmark/hero only.
    if (t === "module") continue;
    return null;
  }
  for (const strat of STRATEGY) {
    for (const m of strat.match) if (tags.includes(m)) return strat;
  }
  return null;
}

// Pick humanoid strategy based on `kind` attribute (head/torso/limb).
function _pickHumanoid(attributes) {
  if (!attributes || !attributes.kind) return null;
  const kind = String(attributes.kind).toLowerCase();
  return HUMANOID_STRATEGY[kind] || null;
}

export const MeshPass = {
  apply({ graph }) {
    let shapesChanged = 0;
    let meshesAdded   = 0;
    let landmarksTouched = 0;
    let humanoidsProcessed = 0;
    const touched = new Set();

    // Snapshot before mutation — graph.nodes can grow if we add meshes.
    const snapshot = graph.nodes.filter(n => n.className === "Part");
    for (const part of snapshot) {
      // TRY HUMANOID FIRST — if part has `kind` attribute (head/torso/limb),
      // prioritize humanoid strategy over tag-based strategy.
      const humanoidStrat = _pickHumanoid(part.attributes);
      const tagStrat      = _pick(part.tags);
      const strat         = humanoidStrat || tagStrat;

      if (!strat) continue;

      // Mutate Part.Shape — has to be a string the emitter recognizes as
      // an Enum constructor (it does — see _luaValue).
      if (strat.shape && part.properties.Shape !== strat.shape) {
        part.properties.Shape = strat.shape;
        shapesChanged++;
      }

      // Add a SpecialMesh child if requested, but only if the part doesn't
      // already carry one (idempotent across re-runs).
      if (strat.mesh) {
        // Build correct parent path: if part is inside a Model, use full hierarchy
        const parentPath = part.parent + "/" + part.name;
        const existing   = graph.nodes.some(n =>
          n.parent === parentPath && (n.className === "SpecialMesh" || n.className === "BlockMesh" ||
                                       n.className === "CylinderMesh"));
        if (!existing) {
          graph.add({
            className:  "SpecialMesh",
            name:       "Mesh_" + part.name,
            parent:     parentPath,
            properties: { ...strat.mesh },
            tags:       ["mesh", "primitive"],
          });
          meshesAdded++;
        }
      }

      if (humanoidStrat) humanoidsProcessed++;
      if (part.tags.includes("landmark") || part.tags.includes("hero")) landmarksTouched++;
      touched.add(part.id);
    }

    return { ok: true, shapesChanged, meshesAdded, landmarksTouched, humanoidsProcessed, touchedCount: touched.size };
  },
};

export default MeshPass;

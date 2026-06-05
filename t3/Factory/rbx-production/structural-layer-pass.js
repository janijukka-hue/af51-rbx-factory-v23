// t3/Factory/rbx-production/structural-layer-pass.js
// AF51-RBX | T3 Layer — StructuralLayerPass
// Role  : Walks primary structural Parts (start, finish, obstacle, base,
//         arena, floor, town, building, dropper-base, zone) and decorates
//         each with five layered children:
//           1. Primary    (the original part — left untouched)
//           2. Secondary  (raised inner detail block)
//           3. Trim       (chamfer / edge piece)
//           4. Lighting   (emissive accent strip)
//           5. Prop       (small surface marker)
//         Each layer is tagged so QualityGate V2 can count layer coverage.

import { part } from "./modules/_util.js";

const STRUCTURAL_TAGS = new Set([
  "start", "finish", "obstacle", "base", "arena", "floor",
  "town", "building", "dropper-base", "zone", "cover",
]);

// Extract the (x, y, z) numbers from a Luau literal like
// "Vector3.new(20, 1, 20)" or "CFrame.new(0, 5, 0) * CFrame.Angles(...)".
// The constructor prefix is stripped first so the leading "3" in "Vector3"
// can't be misread as a coordinate.
function _parseVec3(src) {
  if (!src) return null;
  const inner = String(src).replace(/[A-Za-z_][A-Za-z0-9_.]*\s*\(/, "(");
  const m = inner.match(/-?\d+\.?\d*/g);
  return m && m.length >= 3 ? [parseFloat(m[0]), parseFloat(m[1]), parseFloat(m[2])] : null;
}

function _readSize(props) { return _parseVec3(props.Size); }
function _readPos(props)  { return _parseVec3(props.Position || props.CFrame); }

function _commit(graph, parentPath, spec, layer) {
  return graph.add({
    className:  spec.className,
    name:       spec.name,
    parent:     parentPath,
    properties: spec.properties,
    tags:       [...spec.tags, "structural-layer", "layer:" + layer],
  });
}

export const StructuralLayerPass = {
  apply({ graph }) {
    let secondaries = 0, trims = 0, lights = 0, props = 0;
    // Snapshot — we add children during iteration so use a copy of the original list.
    const primaries = graph.nodes.filter((n) => n.className === "Part" && n.tags.some((t) => STRUCTURAL_TAGS.has(t)));

    for (const node of primaries) {
      const size = _readSize(node.properties);
      if (!size) continue;
      const pos = _readPos(node.properties);
      if (!pos) continue;
      const [sx, sy, sz] = size;
      const [px, py, pz] = pos;
      const parentPath = "Workspace/AF51Scene/" + node.name;

      // Layer 2: Secondary — slightly smaller raised block on top of primary,
      // gives parts visible thickness/depth instead of looking like flat slabs.
      if (sx >= 4 && sz >= 4) {
        const secSize = [Math.max(1, sx - 2), Math.max(0.4, sy * 0.4), Math.max(1, sz - 2)];
        _commit(graph, parentPath, part({
          name: "Secondary",
          size: secSize,
          position: [px, py + sy / 2 + secSize[1] / 2, pz],
          tags: ["secondary", "module"],
          extras: { Transparency: 0 },
        }), "secondary");
        secondaries++;
      }

      // Layer 3: Trim — thin strip along one side, gives a horizontal accent line.
      if (sx >= 2 && sz >= 2) {
        _commit(graph, parentPath, part({
          name: "Trim",
          size: [sx + 0.2, 0.3, 0.4],
          position: [px, py + sy / 2 + 0.15, pz + sz / 2 + 0.2],
          tags: ["trim", "module"],
        }), "trim");
        trims++;
      }

      // Layer 4: Lighting — emissive accent strip on top edge (Neon material).
      if (sx >= 2 && sz >= 2) {
        _commit(graph, parentPath, part({
          name: "AccentStrip",
          size: [Math.max(1, sx * 0.6), 0.2, 0.2],
          position: [px, py + sy / 2 + 0.1, pz - sz / 2 + 0.2],
          tags: ["accent-strip", "module"],
          extras: {
            Material:    "Enum.Material.Neon",
            Color:       "Color3.fromRGB(120, 200, 255)",
            CastShadow:  false,
          },
        }), "lighting");
        lights++;
      }

      // Layer 5: Prop — small marker cube near a corner. Surface punctuation.
      if (sx >= 4 && sz >= 4) {
        _commit(graph, parentPath, part({
          name: "Marker",
          size: [0.6, 0.6, 0.6],
          position: [px + sx / 2 - 0.6, py + sy / 2 + 0.3, pz + sz / 2 - 0.6],
          tags: ["prop", "module"],
        }), "prop");
        props++;
      }
    }

    return { ok: true, primariesTouched: primaries.length, secondaries, trims, lights, props };
  },
};

export default StructuralLayerPass;

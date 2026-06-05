// t3/Factory/rbx-production/traversal-pass.js
// AF51-RBX | T3 Layer — TraversalPass
// Role  : Adds path readability geometry that signals "go this way":
//          - Emissive guide strips on the ground connecting primary
//            structural anchors in the intended traversal order.
//          - Small PointLights along the path so the route reads at night.
//         Per-target ordering of anchors keeps the path deterministic.

import { part } from "./modules/_util.js";

const SCENE_ROOT = "Workspace/AF51Scene";

// Per-target anchor sequence (by tag). The pass draws guide strips between
// consecutive anchors in this order. Tags not present in the graph are skipped.
const PATH_PLANS = {
  obby:      { sequence: ["start", "obstacle", "finish"], color: "Color3.fromRGB(120, 220, 255)" },
  tycoon:    { sequence: ["base", "dropper-base"],         color: "Color3.fromRGB(255, 220, 120)" },
  simulator: { sequence: ["arena", "zone"],                color: "Color3.fromRGB(220, 180, 255)" },
  fps:       { sequence: ["floor", "cover"],               color: "Color3.fromRGB(255, 120, 120)" },
  rpg:       { sequence: ["town", "building"],             color: "Color3.fromRGB(255, 200, 140)" },
};

function _readPos(props) {
  const src = props.Position || props.CFrame;
  if (!src) return null;
  // Strip the constructor prefix so the leading digit in "Vector3" /
  // "Color3" / "CFrame" isn't read as a coordinate.
  const inner = String(src).replace(/[A-Za-z_][A-Za-z0-9_.]*\s*\(/, "(");
  const m = inner.match(/-?\d+\.?\d*/g);
  return m && m.length >= 3 ? [parseFloat(m[0]), parseFloat(m[1]), parseFloat(m[2])] : null;
}

function _collectAnchors(graph, sequence) {
  // For each tag in sequence, collect the world position of each Part with
  // that tag. Returns a flat list of [x, y, z, sourceName] in tag order.
  const out = [];
  for (const tag of sequence) {
    const parts = graph.nodes.filter(
      (n) => n.className === "Part" && n.tags.includes(tag),
    );
    for (const p of parts) {
      const pos = _readPos(p.properties);
      if (pos) out.push({ pos, name: p.name });
    }
  }
  return out;
}

function _stripBetween(a, b, color, idx) {
  // Build a flat strip on the ground between two points. Length = distance,
  // width = 1.2, height = 0.2. Rotated to align with the vector.
  const [ax, _ay, az] = a;
  const [bx, _by, bz] = b;
  const dx = bx - ax;
  const dz = bz - az;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 4) return null;                              // skip adjacent points
  const cx = (ax + bx) / 2;
  const cz = (az + bz) / 2;
  const angle = (Math.atan2(dz, dx) * 180) / Math.PI;     // degrees around Y
  return part({
    name: "GuideStrip_" + idx,
    size: [dist, 0.2, 1.2],
    position: [cx, 0.15, cz],
    rotation: -angle,                                     // rotate around Y to align long axis
    tags: ["traversal", "guide-strip", "module"],
    extras: {
      Material: "Enum.Material.Neon",
      Color: color,
      CastShadow: false,
      Transparency: 0.1,
    },
  });
}

function _pathLight(x, y, z, color, idx) {
  // Tiny emissive marker + PointLight so the path glows even with strong fog.
  return [
    {
      className: "Part", name: "PathMarker_" + idx,
      properties: {
        Size: "Vector3.new(0.6, 0.6, 0.6)",
        Position: "Vector3.new(" + x + ", " + (y + 0.6) + ", " + z + ")",
        Anchored: true,
        Material: "Enum.Material.Neon",
        Color: color,
        CastShadow: false,
      },
      tags: ["traversal", "path-marker", "module"],
    },
  ];
}

export const TraversalPass = {
  apply({ graph, target }) {
    const type = String(target.type || target.id || "").toLowerCase();
    const plan = PATH_PLANS[type];
    if (!plan) return { ok: true, type, strips: 0, markers: 0, skipped: true };

    const anchors = _collectAnchors(graph, plan.sequence);
    if (anchors.length < 2) return { ok: true, type, strips: 0, markers: 0 };

    let strips = 0;
    let markers = 0;

    // Strips between consecutive anchors.
    for (let i = 0; i < anchors.length - 1; i++) {
      const spec = _stripBetween(anchors[i].pos, anchors[i + 1].pos, plan.color, i);
      if (!spec) continue;
      graph.add({
        className:  spec.className,
        name:       "Traversal_" + spec.name,
        parent:     SCENE_ROOT,
        properties: spec.properties,
        tags:       spec.tags,
      });
      strips++;
    }

    // Path markers — one short emissive cube on each anchor (skip the source
    // Part itself; markers sit just above the surface).
    for (let i = 0; i < anchors.length; i++) {
      const [x, _y, z] = anchors[i].pos;
      const specs = _pathLight(x, 0, z, plan.color, i);
      for (const s of specs) {
        graph.add({
          className:  s.className,
          name:       "Traversal_" + s.name,
          parent:     SCENE_ROOT,
          properties: s.properties,
          tags:       s.tags,
        });
        markers++;
      }
    }

    return { ok: true, type, strips, markers, anchors: anchors.length };
  },
};

export default TraversalPass;

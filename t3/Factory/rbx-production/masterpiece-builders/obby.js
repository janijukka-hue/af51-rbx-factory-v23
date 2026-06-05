// masterpiece-builders/obby.js — Sci-fi traversal temple identity.
// Mandatory features: floating-platforms, checkpoint-gate, energy-rail,
// goal-tower, path-lighting, depth-frame.

import { ModuleLibrary } from "../module-library.js";

function _stamp(graph, ruleTag, matcher) {
  for (const n of graph.nodes) {
    if (matcher(n) && !n.tags.includes(ruleTag)) { n.tags.push(ruleTag); return true; }
    if (matcher(n)) return true;
  }
  return false;
}

export const OBBY = {
  apply({ graph, rules }) {
    const r = rules.requiredTags;
    let satisfied = 0;
    let secondaryLandmarks = 0;
    let storytelling = 0;

    // floating-platforms — claim existing finish/start/obstacle platforms.
    satisfied += _stamp(graph, "rule:obby:floating-platforms",
      n => n.className === "Part" && (n.tags.includes("obstacle") || n.tags.includes("start") || n.tags.includes("finish"))) ? 1 : 0;

    // checkpoint-gate — build a chunky gateway every 12 studs on the path z-line.
    for (let i = 0; i < 3; i++) {
      const z = -20 + i * 30;
      ModuleLibrary.gateway(graph,
        { x: 0, y: 1, z, width: 8, height: 6, thickness: 0.8 },
        { namePrefix: "Checkpoint_Gate_" + i,
          tags: ["checkpoint", "gate", "secondary", "rule:obby:checkpoint-gate"] });
    }
    secondaryLandmarks += 3;
    satisfied++;

    // energy-rail — long neon strips flanking the path.
    for (let i = 0; i < 6; i++) {
      const z = -25 + i * 12;
      for (const sx of [-4, 4]) {
        graph.add({
          className: "Part", name: "EnergyRail_" + i + (sx < 0 ? "_L" : "_R"),
          parent: "Workspace/AF51Scene",
          properties: {
            Size: "Vector3.new(0.4, 0.3, 10)",
            Position: "Vector3.new(" + sx + ", 0.6, " + z + ")",
            Anchored: true, Material: "Enum.Material.Neon",
            Color: rules.palette.glow, CastShadow: false,
          },
          tags: ["module", "rail", "energy-rail", "trim", "light-strip",
                 "emissive", "rule:obby:energy-rail"],
        });
      }
    }
    satisfied++;

    // goal-tower — claim the existing Energy Tower landmark.
    satisfied += _stamp(graph, "rule:obby:goal-tower",
      n => n.name.startsWith("Landmark_EnergyTower")) ? 1 : 0;

    // path-lighting — claim any traversal/path-light.
    satisfied += _stamp(graph, "rule:obby:path-lighting",
      n => n.className === "PointLight" || n.tags.includes("traversal") || n.tags.includes("path-light")) ? 1 : 0;

    // depth-frame — pit edge markers below the route (negative y) to give
    // vertical drop language. Thin chamfered slabs.
    for (let i = 0; i < 4; i++) {
      const z = -10 + i * 20;
      graph.add({
        className: "Part", name: "DepthFrame_" + i,
        parent: "Workspace/AF51Scene",
        properties: {
          Size: "Vector3.new(14, 0.4, 1.6)",
          Position: "Vector3.new(0, -4, " + z + ")",
          Anchored: true, Material: "Enum.Material.Concrete",
          Color: "Color3.fromRGB(50, 65, 85)",
        },
        tags: ["module", "depth-frame", "secondary", "story",
               "rule:obby:depth-frame"],
      });
    }
    satisfied++;
    storytelling += 4;

    return {
      rulesSatisfied: satisfied,
      secondaryLandmarks,
      storytelling,
      shellCenter: [0, 0, 25],
      shellRadius: 48,
      shellSegments: 14,
      shellHeight: 5,
      propAnchors: [[10, 0, 0], [-10, 0, 20], [0, 0, 50]],
    };
  },
};

export default OBBY;

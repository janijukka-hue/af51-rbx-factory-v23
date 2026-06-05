// modules/stairs.js — flat stair runs (no wedges, deterministic).
import { part } from "./_util.js";

export const Stairs = {
  // Straight run of stair steps from (x, y, z) going +Z direction.
  run({ x, y, z, steps = 8, stepHeight = 0.6, stepDepth = 1, width = 4, rotation = 0, namePrefix = "Stair" }) {
    const parts = [];
    for (let i = 0; i < steps; i++) {
      parts.push(part({
        name: namePrefix + "_Step" + i,
        size: [width, stepHeight, stepDepth],
        position: [x, y + stepHeight * i + stepHeight / 2, z + i * stepDepth],
        rotation,
        tags: ["module", "stair", "stair-step"],
      }));
    }
    return parts;
  },

  // Single landing platform (used at top/bottom or between flights).
  landing({ x, y, z, width = 6, depth = 6, thickness = 0.5, namePrefix = "Landing" }) {
    return [
      part({
        name: namePrefix + "_Plate",
        size: [width, thickness, depth],
        position: [x, y + thickness / 2, z],
        tags: ["module", "stair", "landing"],
      }),
    ];
  },
};

export default Stairs;

// modules/supports.js — structural supports, beams, trusses.
import { part } from "./_util.js";

export const Supports = {
  // Horizontal beam between two points (along x axis).
  beam({ x, y, z, length = 8, thickness = 0.6, rotation = 0, namePrefix = "Beam" }) {
    return [
      part({
        name: namePrefix + "_Beam",
        size: [length, thickness, thickness],
        position: [x, y, z],
        rotation,
        tags: ["module", "support", "beam"],
      }),
    ];
  },

  // Diagonal brace at ±45° between two endpoints (visual only).
  brace({ x, y, z, length = 6, thickness = 0.5, angleDeg = 45, namePrefix = "Brace" }) {
    return [
      part({
        name: namePrefix + "_Brace",
        size: [thickness, length, thickness],
        position: [x, y + length / 2, z],
        rotation: angleDeg,
        tags: ["module", "support", "brace"],
      }),
    ];
  },

  // Trussed support: vertical post with two diagonal braces.
  truss({ x, y, z, height = 6, baseWidth = 4, thickness = 0.4, namePrefix = "Truss" }) {
    return [
      part({
        name: namePrefix + "_Post",
        size: [thickness, height, thickness],
        position: [x, y + height / 2, z],
        tags: ["module", "support", "post"],
      }),
      part({
        name: namePrefix + "_BraceL",
        size: [thickness, Math.hypot(height, baseWidth / 2), thickness],
        position: [x - baseWidth / 4, y + height / 2, z],
        rotation: 30,
        tags: ["module", "support", "brace"],
      }),
      part({
        name: namePrefix + "_BraceR",
        size: [thickness, Math.hypot(height, baseWidth / 2), thickness],
        position: [x + baseWidth / 4, y + height / 2, z],
        rotation: -30,
        tags: ["module", "support", "brace"],
      }),
    ];
  },
};

export default Supports;

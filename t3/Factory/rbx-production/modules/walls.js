// modules/walls.js — wall segments, corners, end caps.
import { part } from "./_util.js";

export const Walls = {
  segment({ x, y, z, length = 8, height = 6, thickness = 1, rotation = 0, namePrefix = "Wall" }) {
    return [
      part({
        name: namePrefix + "_Body",
        size: [length, height, thickness],
        position: [x, y + height / 2, z],
        rotation,
        tags: ["module", "wall"],
      }),
    ];
  },

  // L-shaped corner: two segments meeting at 90°.
  cornerL({ x, y, z, length = 8, height = 6, thickness = 1, namePrefix = "Corner" }) {
    return [
      part({
        name: namePrefix + "_North",
        size: [length, height, thickness],
        position: [x, y + height / 2, z - length / 2 + thickness / 2],
        tags: ["module", "wall", "corner"],
      }),
      part({
        name: namePrefix + "_East",
        size: [thickness, height, length],
        position: [x + length / 2 - thickness / 2, y + height / 2, z],
        tags: ["module", "wall", "corner"],
      }),
    ];
  },

  // Cap at the end of a wall run: small thicker post for visual termination.
  endCap({ x, y, z, height = 6, thickness = 1.5, namePrefix = "EndCap" }) {
    return [
      part({
        name: namePrefix + "_Cap",
        size: [thickness, height + 0.5, thickness],
        position: [x, y + (height + 0.5) / 2, z],
        tags: ["module", "wall", "endcap"],
      }),
    ];
  },

  // Buttress: short angled support perpendicular to a wall, gives chunky silhouette.
  buttress({ x, y, z, depth = 3, height = 4, thickness = 1, rotation = 0, namePrefix = "Buttress" }) {
    return [
      part({
        name: namePrefix + "_Base",
        size: [thickness, height, depth],
        position: [x, y + height / 2, z],
        rotation,
        tags: ["module", "wall", "buttress"],
      }),
    ];
  },
};

export default Walls;

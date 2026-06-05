// modules/corners.js — corner accent pieces (decorative, not structural walls).
import { part, wedge } from "./_util.js";

export const Corners = {
  // 45° chamfer block — bevel between two flat surfaces.
  chamfer({ x, y, z, size = 2, rotation = 0, namePrefix = "Chamfer" }) {
    return [
      wedge({
        name: namePrefix + "_Chamfer",
        size: [size, size, size],
        position: [x, y + size / 2, z],
        rotation,
        tags: ["module", "corner", "trim"],
      }),
    ];
  },

  // Stepped corner: three stacked blocks, used as architectural detail.
  stepped({ x, y, z, baseSize = 3, stepHeight = 0.6, steps = 3, namePrefix = "Stepped" }) {
    const parts = [];
    for (let i = 0; i < steps; i++) {
      const size = baseSize - i * 0.6;
      if (size <= 0.2) break;
      parts.push(part({
        name: namePrefix + "_Step" + i,
        size: [size, stepHeight, size],
        position: [x, y + stepHeight * i + stepHeight / 2, z],
        tags: ["module", "corner", "trim"],
      }));
    }
    return parts;
  },
};

export default Corners;

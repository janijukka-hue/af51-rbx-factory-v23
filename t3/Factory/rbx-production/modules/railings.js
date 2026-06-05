// modules/railings.js — handrails and balusters (safety + readability).
import { part } from "./_util.js";

export const Railings = {
  // Top rail running between (x1, z1) and (x2, z2) at given y.
  topRail({ x1, z1, x2, z2, y = 4, thickness = 0.3, namePrefix = "Rail" }) {
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
    const angle = Math.atan2(x2 - x1, z2 - z1) * 180 / Math.PI;
    return [
      part({
        name: namePrefix + "_Top",
        size: [thickness, thickness, length],
        position: [cx, y, cz],
        rotation: angle,
        tags: ["module", "railing", "rail-top"],
      }),
    ];
  },

  // Balusters: small vertical posts at regular spacing along a line.
  balusters({ x1, z1, x2, z2, y = 0, height = 4, spacing = 2, thickness = 0.2, namePrefix = "Bal" }) {
    const out = [];
    const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
    const count = Math.max(2, Math.floor(length / spacing));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const px = x1 + (x2 - x1) * t;
      const pz = z1 + (z2 - z1) * t;
      out.push(part({
        name: namePrefix + "_" + i,
        size: [thickness, height, thickness],
        position: [px, y + height / 2, pz],
        tags: ["module", "railing", "baluster"],
      }));
    }
    return out;
  },

  // Convenience: full rail (top + balusters) along a line.
  full({ x1, z1, x2, z2, y = 0, height = 4, spacing = 2, thickness = 0.25, namePrefix = "Rail" }) {
    return [
      ...Railings.balusters({ x1, z1, x2, z2, y, height, spacing, thickness, namePrefix }),
      ...Railings.topRail({ x1, z1, x2, z2, y: y + height, thickness, namePrefix }),
    ];
  },
};

export default Railings;

// modules/pillars.js — columns and capped pillars (vertical accent geometry).
import { part } from "./_util.js";

export const Pillars = {
  column({ x, y, z, height = 8, thickness = 1.2, namePrefix = "Column" }) {
    return [
      part({
        name: namePrefix + "_Shaft",
        size: [thickness, height, thickness],
        position: [x, y + height / 2, z],
        tags: ["module", "pillar"],
      }),
    ];
  },

  capped({ x, y, z, height = 8, thickness = 1.2, capSize = 2, namePrefix = "Pillar" }) {
    return [
      part({
        name: namePrefix + "_Base",
        size: [capSize, capSize * 0.4, capSize],
        position: [x, y + capSize * 0.2, z],
        tags: ["module", "pillar", "trim"],
      }),
      part({
        name: namePrefix + "_Shaft",
        size: [thickness, height - capSize * 0.8, thickness],
        position: [x, y + capSize * 0.4 + (height - capSize * 0.8) / 2, z],
        tags: ["module", "pillar"],
      }),
      part({
        name: namePrefix + "_Cap",
        size: [capSize, capSize * 0.4, capSize],
        position: [x, y + height - capSize * 0.2, z],
        tags: ["module", "pillar", "trim"],
      }),
    ];
  },

  // Tapered tower segment — base wider than top. 3-stack visual cue.
  tapered({ x, y, z, height = 12, baseSize = 4, topSize = 2, namePrefix = "Tapered" }) {
    const midSize = (baseSize + topSize) / 2;
    return [
      part({
        name: namePrefix + "_Base",
        size: [baseSize, height / 3, baseSize],
        position: [x, y + height / 6, z],
        tags: ["module", "pillar", "tower"],
      }),
      part({
        name: namePrefix + "_Mid",
        size: [midSize, height / 3, midSize],
        position: [x, y + height / 2, z],
        tags: ["module", "pillar", "tower"],
      }),
      part({
        name: namePrefix + "_Top",
        size: [topSize, height / 3, topSize],
        position: [x, y + (height * 5) / 6, z],
        tags: ["module", "pillar", "tower"],
      }),
    ];
  },
};

export default Pillars;

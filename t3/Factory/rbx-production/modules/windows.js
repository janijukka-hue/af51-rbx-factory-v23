// modules/windows.js — window frames and slits (visual punctuation in walls).
import { part } from "./_util.js";

export const Windows = {
  // Rectangular window frame: 4 thin strips around an opening (no glass).
  frame({ x, y, z, width = 3, height = 4, thickness = 0.3, depth = 0.6, namePrefix = "Window" }) {
    const top    = part({
      name: namePrefix + "_Top",
      size: [width, thickness, depth],
      position: [x, y + height - thickness / 2, z],
      tags: ["module", "window", "windowframe"],
    });
    const bottom = part({
      name: namePrefix + "_Bottom",
      size: [width, thickness, depth],
      position: [x, y + thickness / 2, z],
      tags: ["module", "window", "windowframe"],
    });
    const left   = part({
      name: namePrefix + "_Left",
      size: [thickness, height, depth],
      position: [x - width / 2 + thickness / 2, y + height / 2, z],
      tags: ["module", "window", "windowframe"],
    });
    const right  = part({
      name: namePrefix + "_Right",
      size: [thickness, height, depth],
      position: [x + width / 2 - thickness / 2, y + height / 2, z],
      tags: ["module", "window", "windowframe"],
    });
    return [top, bottom, left, right];
  },

  // Horizontal slit window — a single thin strip, used for ventilation/military look.
  slit({ x, y, z, width = 4, height = 0.6, depth = 0.5, namePrefix = "Slit" }) {
    return [
      part({
        name: namePrefix + "_Slit",
        size: [width, height, depth],
        position: [x, y + height / 2, z],
        tags: ["module", "window", "slit"],
      }),
    ];
  },
};

export default Windows;

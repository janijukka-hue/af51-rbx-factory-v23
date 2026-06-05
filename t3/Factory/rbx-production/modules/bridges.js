// modules/bridges.js — bridge decks and trusses (silhouette / traversal modules).
import { part } from "./_util.js";

export const Bridges = {
  // Straight deck from (x1, z1) to (x2, z2) at given y.
  deck({ x1, z1, x2, z2, y = 0, width = 4, thickness = 0.5, namePrefix = "Bridge" }) {
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
    const angle = Math.atan2(x2 - x1, z2 - z1) * 180 / Math.PI;
    return [
      part({
        name: namePrefix + "_Deck",
        size: [width, thickness, length],
        position: [cx, y + thickness / 2, cz],
        rotation: angle,
        tags: ["module", "bridge", "bridge-deck"],
      }),
    ];
  },

  // Two-pylon truss with deck between.
  truss({ x, y, z, length = 30, width = 5, towerHeight = 8, deckThickness = 0.6, namePrefix = "Truss" }) {
    const out = [];
    // Deck
    out.push(part({
      name: namePrefix + "_Deck",
      size: [width, deckThickness, length],
      position: [x, y + deckThickness / 2, z],
      tags: ["module", "bridge", "bridge-deck"],
    }));
    // Two pylons at ends
    for (const sign of [-1, 1]) {
      out.push(part({
        name: namePrefix + "_Tower" + (sign > 0 ? "N" : "S"),
        size: [1.2, towerHeight, 1.2],
        position: [x - width / 2 - 0.5, y + towerHeight / 2, z + sign * (length / 2 - 1)],
        tags: ["module", "bridge", "support"],
      }));
      out.push(part({
        name: namePrefix + "_Tower" + (sign > 0 ? "N" : "S") + "R",
        size: [1.2, towerHeight, 1.2],
        position: [x + width / 2 + 0.5, y + towerHeight / 2, z + sign * (length / 2 - 1)],
        tags: ["module", "bridge", "support"],
      }));
    }
    return out;
  },
};

export default Bridges;

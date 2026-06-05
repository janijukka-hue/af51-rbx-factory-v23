// modules/floors.js — floor tiles and edge trims.
import { part } from "./_util.js";

export const Floors = {
  tile({ x, y, z, sizeX = 8, sizeZ = 8, thickness = 0.5, namePrefix = "Tile" }) {
    return [
      part({
        name: namePrefix + "_Tile",
        size: [sizeX, thickness, sizeZ],
        position: [x, y + thickness / 2, z],
        tags: ["module", "floor", "floor-tile"],
      }),
    ];
  },

  // A regular grid of tiles centered on (x, z).
  grid({ x, y, z, countX = 3, countZ = 3, tileSize = 6, thickness = 0.4, namePrefix = "Grid" }) {
    const parts = [];
    const startX = x - ((countX - 1) * tileSize) / 2;
    const startZ = z - ((countZ - 1) * tileSize) / 2;
    for (let i = 0; i < countX; i++) {
      for (let j = 0; j < countZ; j++) {
        parts.push(part({
          name: namePrefix + "_" + i + "_" + j,
          size: [tileSize - 0.2, thickness, tileSize - 0.2],
          position: [startX + i * tileSize, y + thickness / 2, startZ + j * tileSize],
          tags: ["module", "floor", "floor-tile"],
        }));
      }
    }
    return parts;
  },

  // Thin edge strip — used as floor trim or border between zones.
  edgeStrip({ x, y, z, length = 8, width = 0.6, thickness = 0.3, rotation = 0, namePrefix = "Edge" }) {
    return [
      part({
        name: namePrefix + "_Strip",
        size: [length, thickness, width],
        position: [x, y + thickness / 2, z],
        rotation,
        tags: ["module", "floor", "trim"],
      }),
    ];
  },
};

export default Floors;

// modules/doors.js — door frames and gateway arches (visual only).
import { part } from "./_util.js";

export const Doors = {
  // Frame around a doorway opening (3 segments: two posts + lintel).
  frame({ x, y, z, width = 4, height = 7, thickness = 0.6, namePrefix = "Doorway" }) {
    return [
      part({
        name: namePrefix + "_PostLeft",
        size: [thickness, height, thickness],
        position: [x - width / 2 + thickness / 2, y + height / 2, z],
        tags: ["module", "door", "doorframe"],
      }),
      part({
        name: namePrefix + "_PostRight",
        size: [thickness, height, thickness],
        position: [x + width / 2 - thickness / 2, y + height / 2, z],
        tags: ["module", "door", "doorframe"],
      }),
      part({
        name: namePrefix + "_Lintel",
        size: [width, thickness, thickness],
        position: [x, y + height - thickness / 2, z],
        tags: ["module", "door", "doorframe"],
      }),
    ];
  },

  // Larger gateway: wider frame plus a top header beam.
  gateway({ x, y, z, width = 8, height = 10, thickness = 1, namePrefix = "Gateway" }) {
    const f = Doors.frame({ x, y, z, width, height, thickness, namePrefix });
    f.push(part({
      name: namePrefix + "_Header",
      size: [width + thickness * 2, thickness, thickness * 1.5],
      position: [x, y + height + thickness / 2, z],
      tags: ["module", "door", "doorframe", "trim"],
    }));
    return f;
  },
};

export default Doors;

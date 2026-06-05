// s4/oliot/rbx-skills/PartSkill.js
// KERROS: S4 – Olio · RBX Skill Layer · Version 1.0.0
//
// PartSkill — a primitive BasePart. Reads .Shape → Block/Ball/Cylinder/Wedge.
// Does not generate anything; just interprets the part's own shape property.

import { partShape, SAFE_RESULT } from "./_skillBase.js";

const PART_CLASSES = new Set(["Part", "WedgePart", "TrussPart", "CornerWedgePart"]);

export const PartSkill = {
  name: "PartSkill",
  match(node) {
    return !!node && PART_CLASSES.has(node.className);
  },
  interpret(node) {
    const p = node.properties || {};
    let shape = partShape(p.Shape);
    if (!shape) {
      shape = node.className === "WedgePart" || node.className === "CornerWedgePart"
        ? "Wedge" : "Block";
    }
    return { kind: "part", shape, drawable: true };
  },
};

export default PartSkill;

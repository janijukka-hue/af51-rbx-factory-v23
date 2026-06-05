// s4/oliot/rbx-skills/MaterialSkill.js
// KERROS: S4 – Olio · RBX Skill Layer · Version 1.0.0
//
// MaterialSkill — reads .Material and gives the renderer glow / transparency /
// surface hints. Interpretation only: it reports what the material implies, it
// does not change the part's geometry.

function normMat(m) {
  return String(m || "").replace(/^Enum\.Material\./, "");
}

export const MaterialSkill = {
  name: "MaterialSkill",
  match(node) {
    return !!node && node.properties && node.properties.Material != null;
  },
  interpret(node) {
    var mat = normMat(node.properties.Material);
    var hints = { material: mat };
    if (mat === "Neon") { hints.glow = true; }
    if (mat === "Glass" || mat === "ForceField") { hints.transparency = 0.5; }
    if (mat === "Metal" || mat === "DiamondPlate" || mat === "CorrodedMetal") { hints.sheen = 0.4; }
    return hints; // merged over renderer defaults — never overrides shape
  },
};

export default MaterialSkill;

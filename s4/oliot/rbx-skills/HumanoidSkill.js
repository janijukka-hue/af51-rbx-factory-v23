// s4/oliot/rbx-skills/HumanoidSkill.js
// KERROS: S4 – Olio · RBX Skill Layer · Version 1.0.0
//
// HumanoidSkill — recognizes a character and labels its parts by ROLE so the
// preview can render a head as round, limbs as rounded, etc. — instead of a
// pile of identical boxes. It interprets the structure the user wrote; it does
// not add limbs that aren't there.
//
// A node is "humanoid context" if it sits under a Model that also contains a
// Humanoid, OR its name matches the standard R6/R15 rig part names.

const HEAD_NAMES  = new Set(["head"]);
const LIMB_NAMES  = new Set([
  "leftarm", "rightarm", "leftleg", "rightleg",
  "leftupperarm", "rightupperarm", "leftlowerarm", "rightlowerarm",
  "leftupperleg", "rightupperleg", "leftlowerleg", "rightlowerleg",
  "lefthand", "righthand", "leftfoot", "rightfoot",
]);
const TORSO_NAMES = new Set(["torso", "uppertorso", "lowertorso"]);

function nameKey(node) {
  const p = node.properties || {};
  return String(p.Name || node.varName || "").toLowerCase().replace(/[_\s]/g, "");
}

export const HumanoidSkill = {
  name: "HumanoidSkill",

  match(node, ctx) {
    if (!node) return false;
    const key = nameKey(node);
    if (HEAD_NAMES.has(key) || LIMB_NAMES.has(key) || TORSO_NAMES.has(key)) return true;
    // Model that contains a Humanoid → a character root.
    if (node.className === "Model" && node.varName && ctx) {
      return ctx.childrenOf(node.varName).some((c) => c.className === "Humanoid");
    }
    return false;
  },

  interpret(node) {
    const key = nameKey(node);
    if (node.className === "Model") {
      return { kind: "character", role: "humanoid-root", drawable: false };
    }
    // Each role carries a recommended proportion + a default tint so the
    // preview reads as a character even when the code sets no Color/Size.
    // These are RENDER HINTS only — they never change the built product.
    if (HEAD_NAMES.has(key)) {
      return { kind: "head", role: "humanoid-part", shape: "Ball", drawable: true,
        roleProportion: { w: 1.4, h: 1.4, d: 1.4 }, roleColor: "#FFD7AF" };
    }
    if (LIMB_NAMES.has(key)) {
      const isLeg = key.indexOf("leg") !== -1 || key.indexOf("foot") !== -1;
      return { kind: "limb", role: "humanoid-part", shape: "Cylinder", drawable: true,
        roleProportion: { w: 0.6, h: 2.0, d: 0.6 },
        roleColor: isLeg ? "#3A4A6A" : "#FFD7AF" };
    }
    if (TORSO_NAMES.has(key)) {
      return { kind: "torso", role: "humanoid-part", shape: "Block", drawable: true,
        roleProportion: { w: 2.0, h: 2.0, d: 1.0 }, roleColor: "#4A90D9" };
    }
    return {};
  },
};

export default HumanoidSkill;

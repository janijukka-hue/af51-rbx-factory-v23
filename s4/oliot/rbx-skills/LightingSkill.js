// s4/oliot/rbx-skills/LightingSkill.js
// KERROS: S4 – Olio · RBX Skill Layer · Version 1.0.0
//
// LightingSkill — light sources are drawn as LIGHT (glowing point), never as a
// solid box. Interpretation only.

const LIGHTS = new Set(["PointLight", "SpotLight", "SurfaceLight"]);

export const LightingSkill = {
  name: "LightingSkill",
  match(node) { return !!node && LIGHTS.has(node.className); },
  interpret(node) {
    return { kind: "light", role: "light", isLight: true, glow: true, drawable: true, shape: "Light" };
  },
};

export default LightingSkill;

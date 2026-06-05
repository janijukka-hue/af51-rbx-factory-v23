// s4/oliot/rbx-skills/EffectSkill.js
// KERROS: S4 – Olio · RBX Skill Layer · Version 1.0.0
//
// EffectSkill — particle/beam/fire/smoke effects render as EFFECT hints, not as
// physical parts. Interpretation only.

const EFFECTS = new Set(["ParticleEmitter", "Beam", "Trail", "Fire", "Smoke", "Sparkles", "Explosion"]);

export const EffectSkill = {
  name: "EffectSkill",
  match(node) { return !!node && EFFECTS.has(node.className); },
  interpret(node) {
    return { kind: "effect", role: "effect", isEffect: true, glow: true, drawable: false };
  },
};

export default EffectSkill;

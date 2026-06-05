// s4/oliot/rbx-skills/ScriptSkill.js
// KERROS: S4 – Olio · RBX Skill Layer · Version 1.0.0
//
// ScriptSkill — code containers. Not physical: never drawn as a part. The
// preview should list them in the hierarchy but not place a box in the world.

const SCRIPT_CLASSES = new Set(["Script", "LocalScript", "ModuleScript"]);

export const ScriptSkill = {
  name: "ScriptSkill",
  match(node) { return !!node && SCRIPT_CLASSES.has(node.className); },
  interpret(node) {
    return { kind: "script", role: "logic", isScript: true, drawable: false };
  },
};

export default ScriptSkill;

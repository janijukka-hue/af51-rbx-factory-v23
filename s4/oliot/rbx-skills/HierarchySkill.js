// s4/oliot/rbx-skills/HierarchySkill.js
// KERROS: S4 – Olio · RBX Skill Layer · Version 1.0.0
//
// HierarchySkill — service containers (Workspace, StarterGui, …). They are
// organizational, not physical. Interpreting them lets the preview group
// nodes by service instead of drawing the container as an object.

const SERVICES = new Set([
  "Workspace", "Players", "Lighting", "ReplicatedStorage", "ReplicatedFirst",
  "ServerScriptService", "ServerStorage", "StarterGui", "StarterPack",
  "StarterPlayer", "SoundService", "Teams", "Chat", "Folder",
]);

export const HierarchySkill = {
  name: "HierarchySkill",
  match(node) { return !!node && SERVICES.has(node.className); },
  interpret(node) {
    return {
      kind: node.className === "Folder" ? "folder" : "service",
      role: "container",
      drawable: false,
    };
  },
};

export default HierarchySkill;

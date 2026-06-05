// s4/oliot/rbx-skills/UISkill.js
// KERROS: S4 – Olio · RBX Skill Layer · Version 1.0.0
//
// UISkill — 2D GUI classes. They are sized with UDim2 (not Vector3) and render
// in PlayerGui, so the preview must treat them as flat UI, never 3D parts.

const UI_CLASSES = new Set([
  "ScreenGui", "SurfaceGui", "BillboardGui",
  "Frame", "ScrollingFrame",
  "TextLabel", "TextButton", "TextBox",
  "ImageLabel", "ImageButton",
  "UIListLayout", "UIGridLayout", "UICorner", "UIPadding", "UIStroke",
]);

export const UISkill = {
  name: "UISkill",
  match(node) { return !!node && UI_CLASSES.has(node.className); },
  interpret(node) {
    var isButton = node.className === "TextButton" || node.className === "ImageButton";
    return { kind: "ui", role: "ui-element", ui: true, drawable: true, glow: isButton };
  },
};

export default UISkill;

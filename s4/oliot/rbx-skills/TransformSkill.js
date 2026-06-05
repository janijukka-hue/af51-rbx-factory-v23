// s4/oliot/rbx-skills/TransformSkill.js
// KERROS: S4 – Olio · RBX Skill Layer · Version 1.0.0
//
// TransformSkill — interprets Size / Position / CFrame into safe, finite preview
// dimensions so a bad or missing value never yields NaN or absurd scale. It does
// not move or resize the real part — only sanitizes what the preview draws.

function num(v, fallback) {
  var n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

// Accepts an array [x,y,z], or {x,y,z}, or null.
function vec3(v, fb) {
  if (Array.isArray(v) && v.length >= 3) return [num(v[0], fb[0]), num(v[1], fb[1]), num(v[2], fb[2])];
  if (v && typeof v === "object") return [num(v.x, fb[0]), num(v.y, fb[1]), num(v.z, fb[2])];
  return fb.slice();
}

export const TransformSkill = {
  name: "TransformSkill",
  match(node) {
    if (!node || !node.properties) return false;
    var p = node.properties;
    return p.Size != null || p.Position != null || p.CFrame != null;
  },
  interpret(node) {
    var p = node.properties || {};
    var size = vec3(p.Size, [4, 1, 4]).map(function (n) { return Math.max(0.05, Math.min(2048, n)); });
    var pos = p.Position != null ? vec3(p.Position, [0, 1, 0]) : null;
    return { sizeHint: size, posHint: pos };
  },
};

export default TransformSkill;

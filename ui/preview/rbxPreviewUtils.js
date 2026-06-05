// ui/preview/rbxPreviewUtils.js
// AF51-RBX — Shared helpers for the v58 hierarchy + inspector.
// Pure functions, no rendering. Never throw on missing data.

// Stable id for a structure (prefer existing id).
export function getStructureId(item, index) {
  if (item && item.id) return item.id;
  var parent = (item && item.parent) || "root";
  var name = (item && (item.label || item.luaClass || item.type)) || "item";
  return parent + ":" + name + ":" + index;
}

// Attach __id and __index to every structure.
export function normalizeStructures(structures) {
  return (structures || []).map(function (item, index) {
    return Object.assign({}, item, {
      __id: getStructureId(item, index),
      __index: index,
    });
  });
}

// v63 — Convert production-scenegraph.json (the v62 Masterpiece pipeline's
// canonical artifact, with full tier + rule tags) into the simplified
// `structures` shape the canvas renderer + hierarchy + inspector expect.
// Pure function. Strips the "Workspace/AF51Scene" prefix so the tree looks
// natural in the hierarchy panel.
function _nums(str) {
  if (typeof str !== "string") return [];
  var all = str.match(/-?\d+\.?\d*/g) || [];
  if (/^(Vector3|Color3|CFrame|UDim2?|BrickColor)/.test(str)) return all.slice(1).map(Number);
  return all.map(Number);
}
function _hex2(n) { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"); }
function _propColor(p) {
  if (!p || typeof p.Color !== "string") return "#888899";
  var v = _nums(p.Color);
  return v.length >= 3 ? "#" + _hex2(v[0]) + _hex2(v[1]) + _hex2(v[2]) : "#888899";
}
function _propSize(p) {
  var v = _nums(p && p.Size);
  return v.length >= 3 ? { w: v[0], h: v[1], d: v[2] } : { w: 1, h: 1, d: 1 };
}
function _propPos(p) {
  if (!p) return { x: 0, y: 0, z: 0 };
  if (typeof p.Position === "string") {
    var v = _nums(p.Position);
    if (v.length >= 3) return { x: v[0], y: v[1], z: v[2] };
  }
  if (typeof p.CFrame === "string") {
    var v2 = _nums(p.CFrame);
    if (v2.length >= 3) return { x: v2[0], y: v2[1], z: v2[2] };
  }
  return { x: 0, y: 0, z: 0 };
}
function _matName(p) {
  if (!p || typeof p.Material !== "string") return "SmoothPlastic";
  return p.Material.replace(/^Enum\.Material\./, "");
}
function _tierOf(tags) {
  for (var i = 0; i < (tags || []).length; i++) if (tags[i].indexOf("tier:") === 0) return Number(tags[i].slice(5));
  return null;
}
function _ruleTagsOf(tags) {
  return (tags || []).filter(function (t) { return t.indexOf("rule:") === 0; });
}
function _shapeOf(className) {
  if (className === "Part" || className === "MeshPart" || className === "WedgePart" ||
      className === "TrussPart" || className === "CornerWedgePart") return "Block";
  return className;
}

// Map Part.Shape (Enum.PartType.*) to the canvas shape vocabulary.
function _partTypeShape(propShape) {
  if (typeof propShape !== "string") return null;
  if (propShape.indexOf("Cylinder") !== -1) return "Cylinder";
  if (propShape.indexOf("Ball")     !== -1) return "Ball";
  if (propShape.indexOf("Wedge")    !== -1) return "Wedge";
  if (propShape.indexOf("Block")    !== -1) return "Block";
  return null;
}

// Map SpecialMesh.MeshType to the canvas shape vocabulary.
function _meshTypeShape(meshType) {
  if (typeof meshType !== "string") return null;
  if (meshType.indexOf("Sphere")   !== -1) return "Ball";
  if (meshType.indexOf("Cylinder") !== -1) return "Cylinder";
  if (meshType.indexOf("Wedge")    !== -1) return "Wedge";
  if (meshType.indexOf("Brick")    !== -1) return "Block";
  return null;
}

// Detect format and convert; pass through if already in `structures` shape.
export function scenegraphToStructures(sg) {
  if (!sg || !Array.isArray(sg.nodes)) return [];
  var STRIP = "Workspace/AF51Scene";
  // v63 — Build a parent-path → child-nodes map so we can override Part
  // shape from SpecialMesh children + surface decals/lights to the inspector.
  var childrenByParent = {};
  for (var k = 0; k < sg.nodes.length; k++) {
    var cn = sg.nodes[k];
    var pp = cn.parent || "";
    if (!childrenByParent[pp]) childrenByParent[pp] = [];
    childrenByParent[pp].push(cn);
  }
  var out = [];
  for (var i = 0; i < sg.nodes.length; i++) {
    var n = sg.nodes[i];
    var p = n.properties || {};
    var pos = _propPos(p), sz = _propSize(p);
    var parent = n.parent;
    var partPath = STRIP + "/" + n.name;
    if (parent === STRIP) parent = "Workspace";
    else if (parent && parent.indexOf(STRIP + "/") === 0) parent = parent.substring(STRIP.length + 1);
    var mat = _matName(p);

    // v63 — Shape detection chain: SpecialMesh child > Part.Shape > className
    var shape = _shapeOf(n.className);
    var meshChild = null, decalCount = 0;
    var kids = childrenByParent[partPath] || [];
    for (var j = 0; j < kids.length; j++) {
      if (kids[j].className === "SpecialMesh") meshChild = kids[j];
      if (kids[j].className === "Decal")       decalCount++;
    }
    var ptShape = _partTypeShape(p.Shape);
    if (ptShape) shape = ptShape;
    var meshShape = meshChild ? _meshTypeShape((meshChild.properties || {}).MeshType) : null;
    if (meshShape) shape = meshShape;
    // Apply SpecialMesh.Scale (Vector3) so the silhouette honors the mesh
    // visualization. Default scale is 1,1,1 if missing.
    if (meshChild && typeof (meshChild.properties || {}).Scale === "string") {
      var sv = _nums(meshChild.properties.Scale);
      if (sv.length >= 3) { sz.w *= sv[0]; sz.h *= sv[1]; sz.d *= sv[2]; }
    }

    out.push({
      id:        n.id,
      label:     n.name,
      luaClass:  n.className,
      shape:     shape,
      parent:    parent || "Workspace",
      x: pos.x, y: pos.y, z: pos.z,
      w: sz.w,  h: sz.h,  d: sz.d,
      color:     _propColor(p),
      material:  mat,
      anchored:  !!p.Anchored,
      glow:      mat === "Neon" || (n.tags || []).indexOf("emissive") !== -1,
      tier:      _tierOf(n.tags),
      tags:      Array.isArray(n.tags) ? n.tags.slice() : [],
      ruleTags:  _ruleTagsOf(n.tags),
      decalCount: decalCount,
      hasMesh:    !!meshChild,
      properties: p,
      kind:      (n.attributes && n.attributes.kind) || null, // humanoid role: head/torso/limb
    });
  }
  return out;
}

// v63 — Extract Terrain biome info (services.Terrain) from a scenegraph so
// the preview can render a tinted ground plane that matches Studio output.
export function terrainFromPreviewData(previewData) {
  if (!previewData || !previewData.services || !previewData.services.Terrain) return null;
  var t = previewData.services.Terrain;
  return {
    biome:  t.biome  || "ground",
    ground: (t.ground || "").replace(/^Enum\.Material\./, "") || "Grass",
    accent: (t.accent || "").replace(/^Enum\.Material\./, ""),
    ops:    Array.isArray(t.ops) ? t.ops.length : 0,
  };
}

// Accept either format. Returns the `structures` array the canvas + hierarchy
// expect. Idempotent on already-flat input.
export function structuresFromPreviewData(previewData) {
  if (!previewData) return [];
  if (Array.isArray(previewData.structures)) return previewData.structures;
  if (Array.isArray(previewData.nodes))      return scenegraphToStructures(previewData);
  return [];
}

var UI_TYPES = ["ScreenGui","Frame","TextLabel","TextButton","TextBox","ImageLabel","ImageButton","ScrollingFrame","SurfaceGui","BillboardGui","UIListLayout","UIGridLayout","UICorner"];

// Classify into hierarchy group: 'workspace' | 'ui' | 'server' | 'unresolved'
export function classifyStructure(item) {
  var type = (item && (item.luaClass || item.type)) || "";
  var parent = String((item && item.parent) || "").toLowerCase();

  if (item && item.type === "ui") return "ui";
  if (UI_TYPES.indexOf(type) !== -1) return "ui";
  if (parent.indexOf("player") !== -1 || parent.indexOf("gui") !== -1) return "ui";
  if (type === "Script" || type === "ModuleScript") return "server";
  if (!parent) return "unresolved";
  return "workspace";
}

// Icon glyph for a structure based on shape/class.
export function iconFor(item) {
  var cls = (item && item.luaClass) || "";
  var shape = (item && item.shape) || "";
  if (cls === "Folder") return "\u25BE";          // ▾
  if (cls === "Model") return "\u25C8";           // ◈
  if (cls === "SpawnLocation") return "\u2691";   // ⚑
  if (cls === "PointLight" || cls === "SpotLight" || cls === "SurfaceLight") return "\u2600"; // ☀
  if (cls === "ScreenGui" || cls === "SurfaceGui" || cls === "BillboardGui") return "\u2317"; // ⌗
  if (cls === "Frame" || cls === "ScrollingFrame") return "\u25AD"; // ▭
  if (cls === "TextLabel" || cls === "TextButton" || cls === "TextBox") return "T";
  if (cls === "ImageLabel" || cls === "ImageButton") return "\u25A3"; // ▣
  if (cls === "Script" || cls === "ModuleScript") return "\u00A7"; // §
  if (cls === "IntValue" || cls === "NumberValue" || cls === "StringValue") return "#";
  if (shape === "Ball" || shape === "Sphere") return "\u25CF"; // ●
  if (shape === "Cylinder") return "\u25EF"; // ◯
  return "\u25FC"; // ◼ default cube
}

// Format a position/size triple from x/y/z or w/h/d.
export function fmtTriple(a, b, c) {
  function n(v) { return Number.isFinite(Number(v)) ? Number(v).toFixed(1) : "0.0"; }
  if (a == null && b == null && c == null) return "unknown";
  return n(a) + ", " + n(b) + ", " + n(c);
}

export function fmtColor(c) {
  if (!c) return "unknown";
  if (typeof c === "string") return c;
  if (typeof c === "object") return "rgb(" + (c.r || 0) + ", " + (c.g || 0) + ", " + (c.b || 0) + ")";
  return "unknown";
}

export function fmtVal(v, fallback) {
  if (v === undefined || v === null || v === "") return fallback || "unknown";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

export default {
  getStructureId, normalizeStructures, classifyStructure, iconFor,
  fmtTriple, fmtColor, fmtVal,
  scenegraphToStructures, structuresFromPreviewData, terrainFromPreviewData,
};

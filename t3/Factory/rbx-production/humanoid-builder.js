// t3/Factory/rbx-production/humanoid-builder.js
// AF51-RBX | T3 Layer — Humanoid Builder
// Role  : Generates recognizable character/NPC geometry with proper humanoid
//         structure (head/torso/limbs) that MeshPass transforms into
//         spherical heads, cylindrical limbs, etc.
//
// CONVENTIONS:
//   • Each humanoid part gets `kind` attribute (head/torso/limb) so MeshPass
//     can apply the correct Shape + SpecialMesh.
//   • Humanoids are Model containers with Part children, mirroring Roblox
//     character structure (Model → HumanoidRootPart, Head, Torso, LeftArm, etc.)
//   • Scale and proportions follow classic Roblox R6 blocky character ratios
//     but simplified (no joints, no Motor6D — pure visual geometry).

const SCENE_ROOT = "Workspace/AF51Scene";

/**
 * Creates a simple humanoid character model at the given position.
 * @param {object} graph - SceneGraph instance
 * @param {object} opts
 * @param {string} opts.name - Model name (e.g. "Innkeeper", "Guard")
 * @param {number} opts.x - World X position
 * @param {number} opts.y - World Y position (base foot level)
 * @param {number} opts.z - World Z position
 * @param {string} [opts.color] - BrickColor name (default "Bright yellow")
 * @param {number} [opts.scale] - Overall scale multiplier (default 1.0)
 * @param {string[]} [opts.tags] - Additional tags to apply to all parts
 * @param {object} [opts.attributes] - Additional attributes for the model
 */
export function buildHumanoid(graph, opts) {
  const {
    name, x, y, z,
    color = "Bright yellow",
    scale = 1.0,
    tags = [],
    attributes = {},
  } = opts;

  const modelParent = SCENE_ROOT;
  const modelPath   = `${SCENE_ROOT}/${name}`;

  // Model container (like a Roblox character Model)
  graph.add({
    className: "Model",
    name:      name,
    parent:    modelParent,
    properties: {},
    tags:      ["humanoid-model", "character", ...tags],
    attributes: { ...attributes, humanoid: true },
  });

  // R6-style proportions (scaled)
  const headSize   = 2.0 * scale;
  const torsoW     = 2.0 * scale;
  const torsoH     = 2.0 * scale;
  const torsoD     = 1.0 * scale;
  const limbW      = 1.0 * scale;
  const limbH      = 2.0 * scale;
  const limbD      = 1.0 * scale;

  // Vertical offsets (from base y)
  const torsoY = y + torsoH / 2;
  const headY  = torsoY + torsoH / 2 + headSize / 2;
  const armY   = torsoY + torsoH / 2 - limbH / 2;
  const legY   = y + limbH / 2;

  // ─── HEAD ─────────────────────────────────────────────────────────────
  graph.add({
    className:  "Part",
    name:       "Head",
    parent:     modelPath,
    properties: {
      Size:       `Vector3.new(${headSize}, ${headSize}, ${headSize})`,
      Position:   `Vector3.new(${x}, ${headY}, ${z})`,
      BrickColor: `BrickColor.new("${color}")`,
      Material:   "Enum.Material.SmoothPlastic",
      Anchored:   true,
    },
    tags:       ["humanoid-part", "head", ...tags],
    attributes: { kind: "head" },
  });

  // ─── TORSO (HumanoidRootPart) ─────────────────────────────────────────
  graph.add({
    className:  "Part",
    name:       "Torso",
    parent:     modelPath,
    properties: {
      Size:       `Vector3.new(${torsoW}, ${torsoH}, ${torsoD})`,
      Position:   `Vector3.new(${x}, ${torsoY}, ${z})`,
      BrickColor: `BrickColor.new("${color}")`,
      Material:   "Enum.Material.SmoothPlastic",
      Anchored:   true,
    },
    tags:       ["humanoid-part", "torso", ...tags],
    attributes: { kind: "torso" },
  });

  // ─── LEFT ARM ─────────────────────────────────────────────────────────
  const armOffsetX = torsoW / 2 + limbW / 2;
  graph.add({
    className:  "Part",
    name:       "LeftArm",
    parent:     modelPath,
    properties: {
      Size:       `Vector3.new(${limbW}, ${limbH}, ${limbD})`,
      Position:   `Vector3.new(${x - armOffsetX}, ${armY}, ${z})`,
      BrickColor: `BrickColor.new("${color}")`,
      Material:   "Enum.Material.SmoothPlastic",
      Anchored:   true,
    },
    tags:       ["humanoid-part", "limb", "arm", ...tags],
    attributes: { kind: "limb", limb: "left-arm" },
  });

  // ─── RIGHT ARM ────────────────────────────────────────────────────────
  graph.add({
    className:  "Part",
    name:       "RightArm",
    parent:     modelPath,
    properties: {
      Size:       `Vector3.new(${limbW}, ${limbH}, ${limbD})`,
      Position:   `Vector3.new(${x + armOffsetX}, ${armY}, ${z})`,
      BrickColor: `BrickColor.new("${color}")`,
      Material:   "Enum.Material.SmoothPlastic",
      Anchored:   true,
    },
    tags:       ["humanoid-part", "limb", "arm", ...tags],
    attributes: { kind: "limb", limb: "right-arm" },
  });

  // ─── LEFT LEG ─────────────────────────────────────────────────────────
  const legOffsetX = (torsoW / 2) * 0.5;
  graph.add({
    className:  "Part",
    name:       "LeftLeg",
    parent:     modelPath,
    properties: {
      Size:       `Vector3.new(${limbW}, ${limbH}, ${limbD})`,
      Position:   `Vector3.new(${x - legOffsetX}, ${legY}, ${z})`,
      BrickColor: `BrickColor.new("${color}")`,
      Material:   "Enum.Material.SmoothPlastic",
      Anchored:   true,
    },
    tags:       ["humanoid-part", "limb", "leg", ...tags],
    attributes: { kind: "limb", limb: "left-leg" },
  });

  // ─── RIGHT LEG ────────────────────────────────────────────────────────
  graph.add({
    className:  "Part",
    name:       "RightLeg",
    parent:     modelPath,
    properties: {
      Size:       `Vector3.new(${limbW}, ${limbH}, ${limbD})`,
      Position:   `Vector3.new(${x + legOffsetX}, ${legY}, ${z})`,
      BrickColor: `BrickColor.new("${color}")`,
      Material:   "Enum.Material.SmoothPlastic",
      Anchored:   true,
    },
    tags:       ["humanoid-part", "limb", "leg", ...tags],
    attributes: { kind: "limb", limb: "right-leg" },
  });
}

export const HumanoidBuilder = { buildHumanoid };
export default HumanoidBuilder;

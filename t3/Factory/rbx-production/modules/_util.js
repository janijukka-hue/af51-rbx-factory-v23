// t3/Factory/rbx-production/modules/_util.js
// AF51-RBX | T3 Layer — Module utilities
// Role  : Tiny formatting helpers used by every module factory so the
//         emitted Luau literals stay consistent across categories.

export function v3(x, y, z) {
  return "Vector3.new(" + _num(x) + ", " + _num(y) + ", " + _num(z) + ")";
}

export function rgb(r, g, b) {
  return "Color3.fromRGB(" + (r | 0) + ", " + (g | 0) + ", " + (b | 0) + ")";
}

export function cf(x, y, z, ry = 0) {
  // CFrame with optional Y rotation in degrees.
  if (!ry) return "CFrame.new(" + _num(x) + ", " + _num(y) + ", " + _num(z) + ")";
  return "CFrame.new(" + _num(x) + ", " + _num(y) + ", " + _num(z) +
         ") * CFrame.Angles(0, math.rad(" + _num(ry) + "), 0)";
}

function _num(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return Number.isInteger(v) ? String(v) : v.toFixed(3);
}

// Wraps a raw part spec produced by a module so the caller (module-library)
// only has to merge in {parent, name} and feed it to graph.add().
export function part({ name, size, position, rotation = 0, anchored = true, tags = [], extras = {} }) {
  const [sx, sy, sz] = size;
  const [px, py, pz] = position;
  const props = {
    Size:     v3(sx, sy, sz),
    Position: v3(px, py, pz),
    Anchored: !!anchored,
    ...extras,
  };
  if (rotation) {
    // Replace Position with CFrame when rotation is non-zero so Roblox applies the yaw.
    delete props.Position;
    props.CFrame = cf(px, py, pz, rotation);
  }
  return { className: "Part", name, properties: props, tags: [...tags] };
}

// Wedge part — for ramps, roof slopes, stair treads.
export function wedge({ name, size, position, rotation = 0, tags = [], extras = {} }) {
  const spec = part({ name, size, position, rotation, tags, extras });
  spec.className = "WedgePart";
  return spec;
}

// Cylinder — pillars, accent rings, supports.
export function cylinder({ name, size, position, rotation = 0, tags = [], extras = {} }) {
  const spec = part({ name, size, position, rotation, tags, extras });
  spec.properties.Shape = "Enum.PartType.Cylinder";
  return spec;
}

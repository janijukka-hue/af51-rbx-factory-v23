// t3/Factory/rbx-production/material-pass.js
// AF51-RBX | T3 Layer — MaterialPass
// Role  : Assigns Roblox Material + Color3 to Parts based on tags.
//         Pure function over SceneGraph; deterministic mapping from tag → material.

// Tag → { Material, Color } (Color stored as Luau Color3.fromRGB literal)
const TAG_STYLE = {
  start:        { Material: "Enum.Material.Neon",      Color: "Color3.fromRGB(106, 226, 138)" },
  finish:       { Material: "Enum.Material.Neon",      Color: "Color3.fromRGB(248, 196, 64)"  },
  obstacle:     { Material: "Enum.Material.SmoothPlastic", Color: "Color3.fromRGB(72, 132, 222)"  },
  base:         { Material: "Enum.Material.Concrete",  Color: "Color3.fromRGB(140, 140, 150)" },
  "dropper-base": { Material: "Enum.Material.Metal",   Color: "Color3.fromRGB(180, 160, 90)"  },
  arena:        { Material: "Enum.Material.Slate",     Color: "Color3.fromRGB(120, 122, 130)" },
  zone:         { Material: "Enum.Material.Neon",      Color: "Color3.fromRGB(200, 200, 200)" },
  bronze:       { Material: "Enum.Material.Neon",      Color: "Color3.fromRGB(176, 124, 64)"  },
  silver:       { Material: "Enum.Material.Neon",      Color: "Color3.fromRGB(192, 192, 200)" },
  gold:         { Material: "Enum.Material.Neon",      Color: "Color3.fromRGB(240, 200, 80)"  },
  floor:        { Material: "Enum.Material.WoodPlanks", Color: "Color3.fromRGB(150, 110, 80)" },
  cover:        { Material: "Enum.Material.Brick",     Color: "Color3.fromRGB(110, 90, 80)"   },
  town:         { Material: "Enum.Material.Cobblestone", Color: "Color3.fromRGB(140, 130, 120)" },
  building:     { Material: "Enum.Material.Wood",      Color: "Color3.fromRGB(160, 110, 70)"  },
  surface:      { Material: "Enum.Material.SmoothPlastic", Color: "Color3.fromRGB(180, 180, 188)" },
};

// Choose the most specific tag match. Order is the node's tag order; first
// matching specific tag wins. "surface" is treated as a fallback.
function _pick(tags) {
  for (let i = 0; i < tags.length; i++) {
    const t = tags[i];
    if (t === "surface") continue;
    if (TAG_STYLE[t]) return TAG_STYLE[t];
  }
  // fallback: surface, or generic
  if (tags.includes("surface")) return TAG_STYLE.surface;
  return null;
}

export const MaterialPass = {
  apply({ graph }) {
    let touched = 0;
    const parts = graph.findByClass("Part");
    for (let i = 0; i < parts.length; i++) {
      const node = parts[i];
      const style = _pick(node.tags);
      if (!style) continue;
      if (node.properties.Material === undefined) node.properties.Material = style.Material;
      if (node.properties.Color    === undefined) node.properties.Color    = style.Color;
      touched++;
    }
    return { ok: true, touched, totalParts: parts.length };
  },
};

export default MaterialPass;

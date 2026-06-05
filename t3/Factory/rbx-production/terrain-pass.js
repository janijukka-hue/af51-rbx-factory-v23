// t3/Factory/rbx-production/terrain-pass.js
// AF51-RBX | T3 Layer — TerrainPass (v63)
// Role  : Emits per-target Roblox Terrain via workspace.Terrain:FillBlock,
//         giving each world a real biome ground plane instead of floating
//         parts on the void. Output is deterministic (same target →
//         identical fill ops). Runs after MasterpiecePass.
//
// Storage : graph.services.Terrain = { biome: <name>, ops: [...] }.
// Emission: RobloxEmitter renders graph.services.Terrain into a separate
//           AF51Terrain.server.lua server script.

// Per-target terrain recipe. Each entry declares:
//   ground   : Enum.Material — the main biome surface
//   accent   : Enum.Material — secondary ribbons or roads
//   extent   : half-size in studs for the main ground fill (X/Z)
//   thickness: ground slab depth (studs)
//   ribbons  : optional array of {x,z,w,d,mat} strips overlaid on ground
const BIOMES = {
  obby: {
    biome:    "sci-fi-platform",
    ground:   "Enum.Material.Slate",
    accent:   "Enum.Material.Metal",
    extent:   140,
    thickness: 6,
    ribbons: [
      { x: 0, z: -10, w: 8,  d: 80, mat: "Enum.Material.Metal" },
    ],
  },
  fps: {
    biome:    "urban-arena",
    ground:   "Enum.Material.Asphalt",
    accent:   "Enum.Material.Concrete",
    extent:   150,
    thickness: 8,
    ribbons: [
      { x: 0, z: 0, w: 30, d: 30, mat: "Enum.Material.Concrete" },
    ],
  },
  tycoon: {
    biome:    "factory-floor",
    ground:   "Enum.Material.DiamondPlate",
    accent:   "Enum.Material.CorrodedMetal",
    extent:   160,
    thickness: 6,
    ribbons: [
      { x: 0, z: 0, w: 100, d: 6, mat: "Enum.Material.CorrodedMetal" },
    ],
  },
  simulator: {
    biome:    "reward-meadow",
    ground:   "Enum.Material.Grass",
    accent:   "Enum.Material.Sand",
    extent:   170,
    thickness: 6,
    ribbons: [
      { x: 0, z: 0, w: 24, d: 24, mat: "Enum.Material.Sand" },
    ],
  },
  rpg: {
    biome:    "fantasy-hub",
    ground:   "Enum.Material.Grass",
    accent:   "Enum.Material.Ground",
    extent:   170,
    thickness: 6,
    ribbons: [
      { x: 0, z: 0, w: 8,  d: 100, mat: "Enum.Material.Cobblestone" },
      { x: 0, z: 0, w: 100, d: 8,  mat: "Enum.Material.Cobblestone" },
    ],
  },
};

// Build the ordered list of FillBlock ops the emitter walks. Each op is
// `{ cframe, size, material }`, with cframe + size as raw Lua literals.
function _buildOps(b, sceneY) {
  const ops = [];
  // Main ground plane — centered at y = sceneY - thickness/2 so its top
  // surface sits at sceneY (slightly under part level so parts read as
  // standing on the terrain, not embedded in it).
  const groundY = sceneY - b.thickness / 2 - 0.05;
  ops.push({
    cframe:   `CFrame.new(0, ${groundY.toFixed(2)}, 0)`,
    size:     `Vector3.new(${b.extent * 2}, ${b.thickness}, ${b.extent * 2})`,
    material: b.ground,
  });
  // Ribbons — sit on top of the ground (top edge at sceneY).
  const ribbonH    = Math.max(0.6, b.thickness / 4);
  const ribbonY    = sceneY - ribbonH / 2 + 0.01;
  for (const r of (b.ribbons || [])) {
    ops.push({
      cframe:   `CFrame.new(${r.x}, ${ribbonY.toFixed(2)}, ${r.z})`,
      size:     `Vector3.new(${r.w}, ${ribbonH.toFixed(2)}, ${r.d})`,
      material: r.mat,
    });
  }
  return ops;
}

export const TerrainPass = {
  apply({ graph, target }) {
    const type = String(target.type || target.id || "").toLowerCase();
    const biome = BIOMES[type];
    if (!biome) return { ok: true, skipped: true, biome: null, opsCount: 0 };

    // Ground sits at y=0 — every builder anchors parts above ground.
    const ops = _buildOps(biome, 0);

    graph.services.Terrain = {
      biome:     biome.biome,
      ground:    biome.ground,
      accent:    biome.accent,
      ops,
    };

    return { ok: true, biome: biome.biome, opsCount: ops.length };
  },
};

export default TerrainPass;

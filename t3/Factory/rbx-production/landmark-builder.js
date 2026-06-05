// t3/Factory/rbx-production/landmark-builder.js
// AF51-RBX | T3 Layer — LandmarkBuilder
// Role  : Drops one large focal landmark per target. Gives each map a
//         readable identity at a distance and a fixed visual anchor for
//         the camera at spawn time. Composite of module parts.

import { ModuleLibrary } from "./module-library.js";
import { part } from "./modules/_util.js";

const LANDMARK_TAG = "landmark";

// Per-target landmark identity. Each builder returns { ok, parts }.
// Anchor positions are picked to NOT collide with primary structural parts.
const BUILDERS = {
  // Obby — Energy Tower behind the finish platform. Tall + emissive top.
  obby({ graph }) {
    const ax = 0, ay = 0, az = 130;          // 40m past finish
    const out = [];
    out.push(...ModuleLibrary.tower(graph,
      { x: ax, y: ay, z: az, height: 32, baseSize: 8, topSize: 2 },
      { namePrefix: "Landmark_EnergyTower", tags: [LANDMARK_TAG, "tower"] }));
    out.push(graph.add({
      className: "Part", name: "Landmark_EnergyTower_Beacon",
      parent: "Workspace/AF51Scene",
      properties: {
        Shape:     "Enum.PartType.Ball",
        Size:      "Vector3.new(4, 4, 4)",
        Position:  "Vector3.new(" + ax + ", " + (ay + 34) + ", " + az + ")",
        Anchored:  true,
        Material:  "Enum.Material.Neon",
        Color:     "Color3.fromRGB(255, 220, 120)",
        CastShadow: false,
      },
      tags: [LANDMARK_TAG, "beacon", "module"],
    }));
    return { ok: true, parts: out.length };
  },

  // Tycoon — Collector Core, central rotunda above the base.
  tycoon({ graph }) {
    const out = [];
    out.push(...ModuleLibrary.tower(graph,
      { x: 0, y: 1, z: 0, height: 18, baseSize: 6, topSize: 4 },
      { namePrefix: "Landmark_Core", tags: [LANDMARK_TAG, "core"] }));
    out.push(graph.add({
      className: "Part", name: "Landmark_Core_Capacitor",
      parent: "Workspace/AF51Scene",
      properties: {
        Shape: "Enum.PartType.Ball",
        Size: "Vector3.new(5, 5, 5)",
        Position: "Vector3.new(0, 21, 0)",
        Anchored: true,
        Material: "Enum.Material.Neon",
        Color: "Color3.fromRGB(120, 220, 255)",
        CastShadow: false,
      },
      tags: [LANDMARK_TAG, "beacon", "module"],
    }));
    return { ok: true, parts: out.length };
  },

  // Simulator — Arena Core: tapered pillar in the centre with a halo ring.
  simulator({ graph }) {
    const out = [];
    out.push(...ModuleLibrary.tower(graph,
      { x: 0, y: 1, z: 0, height: 24, baseSize: 7, topSize: 3 },
      { namePrefix: "Landmark_ArenaCore", tags: [LANDMARK_TAG, "core"] }));
    // Halo: thin ring approximated by 8 small parts in a circle.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = 8;
      out.push(graph.add({
        className: "Part", name: "Landmark_ArenaCore_Halo_" + i,
        parent: "Workspace/AF51Scene",
        properties: {
          Size: "Vector3.new(1.4, 0.6, 1.4)",
          Position: "Vector3.new(" + Math.round(Math.cos(a) * r) + ", 22, " + Math.round(Math.sin(a) * r) + ")",
          Anchored: true,
          Material: "Enum.Material.Neon",
          Color: "Color3.fromRGB(220, 200, 255)",
          CastShadow: false,
        },
        tags: [LANDMARK_TAG, "halo", "module"],
      }));
    }
    return { ok: true, parts: out.length };
  },

  // FPS — Dropship Wreck: chunky horizontal hulk on the edge of the arena.
  fps({ graph }) {
    const out = [];
    out.push(graph.add({
      className: "Part", name: "Landmark_DropshipWreck_Hull",
      parent: "Workspace/AF51Scene",
      properties: {
        Size: "Vector3.new(28, 6, 10)",
        Position: "Vector3.new(45, 3, -45)",
        Anchored: true,
        Material: "Enum.Material.CorrodedMetal",
        Color: "Color3.fromRGB(90, 80, 70)",
      },
      tags: [LANDMARK_TAG, "wreck", "module"],
    }));
    out.push(...ModuleLibrary.tower(graph,
      { x: 56, y: 6, z: -45, height: 10, baseSize: 4, topSize: 2 },
      { namePrefix: "Landmark_DropshipWreck_Tail", tags: [LANDMARK_TAG, "wreck"] }));
    out.push(graph.add({
      className: "Part", name: "Landmark_DropshipWreck_Beacon",
      parent: "Workspace/AF51Scene",
      properties: {
        Size: "Vector3.new(1.5, 1.5, 1.5)",
        Position: "Vector3.new(56, 18, -45)",
        Anchored: true,
        Material: "Enum.Material.Neon",
        Color: "Color3.fromRGB(255, 80, 80)",
        CastShadow: false,
      },
      tags: [LANDMARK_TAG, "beacon", "module"],
    }));
    return { ok: true, parts: out.length };
  },

  // RPG — Village Gate at the town entrance, large gateway + flanking pillars.
  rpg({ graph }) {
    const out = [];
    out.push(...ModuleLibrary.gateway(graph,
      { x: 0, y: 1, z: 30, width: 12, height: 14, thickness: 1.4 },
      { namePrefix: "Landmark_VillageGate", tags: [LANDMARK_TAG, "gate"] }));
    out.push(...ModuleLibrary.pillar(graph,
      { x: -10, y: 1, z: 30, height: 12, thickness: 1.6, capSize: 2.4 },
      { namePrefix: "Landmark_GatePillarL", tags: [LANDMARK_TAG, "pillar"] }));
    out.push(...ModuleLibrary.pillar(graph,
      { x:  10, y: 1, z: 30, height: 12, thickness: 1.6, capSize: 2.4 },
      { namePrefix: "Landmark_GatePillarR", tags: [LANDMARK_TAG, "pillar"] }));
    return { ok: true, parts: out.length };
  },
};

export const LandmarkBuilder = {
  apply({ graph, target }) {
    const type = String(target.type || target.id || "").toLowerCase();
    const builder = BUILDERS[type];
    if (!builder) return { ok: true, type, parts: 0, skipped: true };
    const res = builder({ graph });
    return { ok: true, type, parts: res.parts };
  },
};

export default LandmarkBuilder;

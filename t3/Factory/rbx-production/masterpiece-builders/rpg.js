// masterpiece-builders/rpg.js — Playable fantasy hub identity.
// Mandatory: village-gate, quest-plaza, enemy-border, loot-shrine,
// road-network, warm-hub-light, cold-danger-light, vertical-landmark.

import { ModuleLibrary } from "../module-library.js";

function _stamp(graph, ruleTag, matcher) {
  for (const n of graph.nodes) {
    if (matcher(n)) {
      if (!n.tags.includes(ruleTag)) n.tags.push(ruleTag);
      return true;
    }
  }
  return false;
}

export const RPG = {
  apply({ graph, rules }) {
    let satisfied = 0;
    let secondaryLandmarks = 0;

    // village-gate — claim the existing Landmark_VillageGate.
    satisfied += _stamp(graph, "rule:rpg:village-gate",
      n => n.name.startsWith("Landmark_VillageGate")) ? 1 : 0;

    // quest-plaza — a wide low platform with a central pedestal at the hub.
    graph.add({
      className: "Part", name: "Quest_Plaza_Floor",
      parent: "Workspace/AF51Scene",
      properties: {
        Size: "Vector3.new(18, 0.4, 18)",
        Position: "Vector3.new(0, 0.2, 0)",
        Anchored: true, Material: "Enum.Material.Cobblestone",
        Color: "Color3.fromRGB(150, 135, 115)",
      },
      tags: ["module", "plaza", "primary", "floor",
             "rule:rpg:quest-plaza"],
    });
    graph.add({
      className: "Part", name: "Quest_Plaza_Pedestal",
      parent: "Workspace/AF51Scene",
      properties: {
        Size: "Vector3.new(2.4, 1.8, 2.4)",
        Position: "Vector3.new(0, 1.3, 0)",
        Anchored: true, Material: "Enum.Material.Marble",
        Color: "Color3.fromRGB(220, 200, 170)",
      },
      tags: ["module", "plaza", "pedestal", "secondary",
             "rule:rpg:quest-plaza"],
    });
    satisfied++;

    // enemy-border — long thin red-tinted wall at the negative-z edge.
    for (let i = 0; i < 4; i++) {
      graph.add({
        className: "Part", name: "Enemy_Border_" + i,
        parent: "Workspace/AF51Scene",
        properties: {
          Size: "Vector3.new(8, 2.4, 0.6)",
          Position: "Vector3.new(" + (-14 + i * 8) + ", 1.2, -34)",
          Anchored: true, Material: "Enum.Material.Slate",
          Color: "Color3.fromRGB(120, 70, 70)",
        },
        tags: ["module", "wall", "border", "enemy-border", "secondary",
               "rule:rpg:enemy-border"],
      });
    }
    satisfied++;

    // loot-shrine — small ornate stand with a glowing orb.
    for (let s = 0; s < 2; s++) {
      const side = 2.2 - s * 0.6;
      graph.add({
        className: "Part", name: "Loot_Shrine_Step_" + s,
        parent: "Workspace/AF51Scene",
        properties: {
          Size: "Vector3.new(" + side.toFixed(2) + ", 0.6, " + side.toFixed(2) + ")",
          Position: "Vector3.new(20, " + (0.3 + s * 0.6).toFixed(2) + ", 6)",
          Anchored: true, Material: "Enum.Material.Marble",
          Color: "Color3.fromRGB(210, 195, 160)",
        },
        tags: ["module", "shrine", "secondary", "rule:rpg:loot-shrine"],
      });
    }
    graph.add({
      className: "Part", name: "Loot_Shrine_Orb",
      parent: "Workspace/AF51Scene",
      properties: {
        Shape: "Enum.PartType.Ball",
        Size: "Vector3.new(1.2, 1.2, 1.2)",
        Position: "Vector3.new(20, 2, 6)",
        Anchored: true, Material: "Enum.Material.Neon",
        Color: rules.palette.loot, CastShadow: false,
      },
      tags: ["module", "shrine", "loot", "beacon", "polish", "landmark",
             "rule:rpg:loot-shrine"],
    });
    secondaryLandmarks++;
    satisfied++;

    // road-network — three connected paths radiating from the plaza.
    for (const [name, dx, dz, len] of [
      ["North", 0, -1, 30], ["East", 1, 0, 30], ["West", -1, 0, 30],
    ]) {
      const sx = dx * len / 2;
      const sz = dz * len / 2;
      graph.add({
        className: "Part", name: "Road_" + name,
        parent: "Workspace/AF51Scene",
        properties: {
          Size: dx === 0 ? "Vector3.new(4, 0.3, " + len + ")"
                         : "Vector3.new(" + len + ", 0.3, 4)",
          Position: "Vector3.new(" + sx + ", 0.15, " + sz + ")",
          Anchored: true, Material: "Enum.Material.Cobblestone",
          Color: rules.palette.road,
        },
        tags: ["module", "road", "primary", "floor",
               "rule:rpg:road-network"],
      });
    }
    satisfied++;

    // warm-hub-light — emissive lantern parts around plaza.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const x = (Math.cos(a) * 7).toFixed(2);
      const z = (Math.sin(a) * 7).toFixed(2);
      graph.add({
        className: "Part", name: "Lantern_Warm_" + i,
        parent: "Workspace/AF51Scene",
        properties: {
          Shape: "Enum.PartType.Ball",
          Size: "Vector3.new(0.8, 0.8, 0.8)",
          Position: "Vector3.new(" + x + ", 3.4, " + z + ")",
          Anchored: true, Material: "Enum.Material.Neon",
          Color: rules.palette.warm, CastShadow: false,
        },
        tags: ["module", "lantern", "warm-light", "emissive",
               "rule:rpg:warm-hub-light"],
      });
    }
    satisfied++;

    // cold-danger-light — emissive cold tints along the enemy border.
    for (let i = 0; i < 3; i++) {
      graph.add({
        className: "Part", name: "Lantern_Cold_" + i,
        parent: "Workspace/AF51Scene",
        properties: {
          Shape: "Enum.PartType.Ball",
          Size: "Vector3.new(0.7, 0.7, 0.7)",
          Position: "Vector3.new(" + (-10 + i * 10) + ", 3, -32)",
          Anchored: true, Material: "Enum.Material.Neon",
          Color: rules.palette.cold, CastShadow: false,
        },
        tags: ["module", "lantern", "cold-light", "emissive",
               "rule:rpg:cold-danger-light"],
      });
    }
    satisfied++;

    // vertical-landmark — tall central spire above the plaza pedestal.
    ModuleLibrary.tower(graph,
      { x: 0, y: 2, z: 0, height: 22, baseSize: 2.4, topSize: 0.8 },
      { namePrefix: "Village_Spire",
        tags: ["spire", "vertical-form", "secondary",
               "rule:rpg:vertical-landmark"] });
    secondaryLandmarks++;
    satisfied++;

    return {
      rulesSatisfied: satisfied,
      secondaryLandmarks,
      storytelling: 0,
      shellCenter: [0, 0, -4],
      shellRadius: 40,
      shellSegments: 14,
      shellHeight: 4,
      propAnchors: [[12, 0, 12], [-12, 0, 12], [22, 0, 4]],
    };
  },
};

export default RPG;

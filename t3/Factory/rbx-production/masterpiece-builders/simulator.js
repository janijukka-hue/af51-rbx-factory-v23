// masterpiece-builders/simulator.js — Reward-loop playground identity.
// Mandatory: collection-field, sell-zone, upgrade-shrine, reward-beacon,
// progression-gate, resource-cluster.

import { ModuleLibrary } from "../module-library.js";

export const SIMULATOR = {
  apply({ graph, rules }) {
    let satisfied = 0;
    let secondaryLandmarks = 0;

    // collection-field — 4x4 grid of small emissive resource nodes.
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const x = -12 + i * 8;
        const z = -12 + j * 8;
        graph.add({
          className: "Part", name: "Resource_" + i + "_" + j,
          parent: "Workspace/AF51Scene",
          properties: {
            Shape: "Enum.PartType.Ball",
            Size: "Vector3.new(1.2, 1.2, 1.2)",
            Position: "Vector3.new(" + x + ", 1, " + z + ")",
            Anchored: true, Material: "Enum.Material.Neon",
            Color: "Color3.fromRGB(140, 220, 255)", CastShadow: false,
          },
          tags: ["module", "resource", "prop", "emissive",
                 "rule:simulator:collection-field",
                 "rule:simulator:resource-cluster"],
        });
      }
    }
    satisfied += 2;  // collection-field + resource-cluster

    // sell-zone — bright green floor pad.
    graph.add({
      className: "Part", name: "Sell_Zone",
      parent: "Workspace/AF51Scene",
      properties: {
        Size: "Vector3.new(10, 0.4, 6)",
        Position: "Vector3.new(0, 0.2, 22)",
        Anchored: true, Material: "Enum.Material.Neon",
        Color: rules.palette.sell, Transparency: 0.4, CastShadow: false,
      },
      tags: ["module", "sell-zone", "primary", "emissive",
             "rule:simulator:sell-zone"],
    });
    satisfied++;

    // upgrade-shrine — small stepped pyramid + glowing top.
    for (let s = 0; s < 3; s++) {
      const side = 4 - s * 1.2;
      graph.add({
        className: "Part", name: "Shrine_Step_" + s,
        parent: "Workspace/AF51Scene",
        properties: {
          Size: "Vector3.new(" + side.toFixed(2) + ", 0.8, " + side.toFixed(2) + ")",
          Position: "Vector3.new(-22, " + (0.4 + s * 0.8).toFixed(2) + ", 0)",
          Anchored: true, Material: "Enum.Material.Marble",
          Color: "Color3.fromRGB(180, 160, 130)",
        },
        tags: ["module", "shrine", "secondary", "rule:simulator:upgrade-shrine"],
      });
    }
    graph.add({
      className: "Part", name: "Shrine_Capstone",
      parent: "Workspace/AF51Scene",
      properties: {
        Shape: "Enum.PartType.Ball",
        Size: "Vector3.new(1.4, 1.4, 1.4)",
        Position: "Vector3.new(-22, 3.4, 0)",
        Anchored: true, Material: "Enum.Material.Neon",
        Color: rules.palette.shrine, CastShadow: false,
      },
      tags: ["module", "shrine", "beacon", "polish", "landmark",
             "rule:simulator:upgrade-shrine"],
    });
    secondaryLandmarks++;
    satisfied++;

    // reward-beacon — tall thin pillar with emissive top above sell-zone.
    ModuleLibrary.tower(graph,
      { x: 0, y: 0, z: 22, height: 12, baseSize: 1.6, topSize: 0.8 },
      { namePrefix: "Reward_Beacon_Pole",
        tags: ["beacon", "secondary", "rule:simulator:reward-beacon"] });
    graph.add({
      className: "Part", name: "Reward_Beacon_Bulb",
      parent: "Workspace/AF51Scene",
      properties: {
        Shape: "Enum.PartType.Ball",
        Size: "Vector3.new(2.2, 2.2, 2.2)",
        Position: "Vector3.new(0, 13, 22)",
        Anchored: true, Material: "Enum.Material.Neon",
        Color: rules.palette.reward, CastShadow: false,
      },
      tags: ["module", "beacon", "emissive", "polish",
             "rule:simulator:reward-beacon"],
    });
    secondaryLandmarks++;
    satisfied++;

    // progression-gate — sequence of narrowing arches between field and sell.
    for (let i = 0; i < 3; i++) {
      const w = 8 - i * 1.5;
      ModuleLibrary.gateway(graph,
        { x: 0, y: 1, z: 8 + i * 4, width: w, height: 5, thickness: 0.6 },
        { namePrefix: "Progression_Gate_" + i,
          tags: ["gate", "progression", "secondary",
                 "rule:simulator:progression-gate"] });
    }
    satisfied++;

    return {
      rulesSatisfied: satisfied,
      secondaryLandmarks,
      storytelling: 0,
      shellCenter: [0, 0, 5],
      shellRadius: 36,
      shellSegments: 14,
      shellHeight: 5,
      propAnchors: [[-22, 0, 6], [0, 0, 20], [14, 0, -10]],
    };
  },
};

export default SIMULATOR;

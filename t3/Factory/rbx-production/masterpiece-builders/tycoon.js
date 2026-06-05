// masterpiece-builders/tycoon.js — Industrial money factory identity.
// Mandatory features: claim-base, dropper-machine, conveyor, collector-vault,
// upgrade-wall, factory-pipe, storage-crate, cash-path-light.

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

export const TYCOON = {
  apply({ graph, rules }) {
    let satisfied = 0;
    let secondaryLandmarks = 0;

    // claim-base — claim the existing base floor / start platform.
    satisfied += _stamp(graph, "rule:tycoon:claim-base",
      n => n.tags.includes("base") || n.tags.includes("start")) ? 1 : 0;

    // dropper-machine — 3 chunky droppers placed along the production line.
    for (let i = 0; i < 3; i++) {
      const z = -8 + i * 8;
      // Body
      graph.add({
        className: "Part", name: "Dropper_" + i + "_Body",
        parent: "Workspace/AF51Scene",
        properties: {
          Size: "Vector3.new(3.2, 3.6, 2.4)",
          Position: "Vector3.new(8, 1.8, " + z + ")",
          Anchored: true, Material: "Enum.Material.Metal",
          Color: "Color3.fromRGB(120, 130, 140)",
        },
        tags: ["module", "dropper", "prop", "rule:tycoon:dropper-machine"],
      });
      // Spout
      graph.add({
        className: "Part", name: "Dropper_" + i + "_Spout",
        parent: "Workspace/AF51Scene",
        properties: {
          Shape: "Enum.PartType.Cylinder",
          Size: "Vector3.new(1.2, 0.8, 0.8)",
          Position: "Vector3.new(8, 0.4, " + z + ")",
          Anchored: true, Material: "Enum.Material.Neon",
          Color: rules.palette.cash, CastShadow: false,
        },
        tags: ["module", "dropper", "emissive", "trim",
               "rule:tycoon:dropper-machine"],
      });
    }
    satisfied++;

    // conveyor — long thin moving-belt surface running between droppers + vault.
    graph.add({
      className: "Part", name: "Conveyor_Main",
      parent: "Workspace/AF51Scene",
      properties: {
        Size: "Vector3.new(2.4, 0.4, 22)",
        Position: "Vector3.new(4, 0.4, 0)",
        Anchored: true, Material: "Enum.Material.Metal",
        Color: "Color3.fromRGB(60, 70, 80)",
      },
      tags: ["module", "conveyor", "prop", "rule:tycoon:conveyor"],
    });
    satisfied++;

    // collector-vault — sealed cube + neon top.
    graph.add({
      className: "Part", name: "Collector_Vault_Body",
      parent: "Workspace/AF51Scene",
      properties: {
        Size: "Vector3.new(5, 4.4, 5)",
        Position: "Vector3.new(-6, 2.2, 0)",
        Anchored: true, Material: "Enum.Material.Metal",
        Color: "Color3.fromRGB(80, 90, 100)",
      },
      tags: ["module", "vault", "landmark", "rule:tycoon:collector-vault"],
    });
    graph.add({
      className: "Part", name: "Collector_Vault_Beacon",
      parent: "Workspace/AF51Scene",
      properties: {
        Shape: "Enum.PartType.Ball",
        Size: "Vector3.new(1.6, 1.6, 1.6)",
        Position: "Vector3.new(-6, 5, 0)",
        Anchored: true, Material: "Enum.Material.Neon",
        Color: rules.palette.cash, CastShadow: false,
      },
      tags: ["module", "vault", "beacon", "emissive", "polish",
             "rule:tycoon:collector-vault"],
    });
    satisfied++;
    secondaryLandmarks++;

    // upgrade-wall — tall wall with neon bars beside the vault.
    graph.add({
      className: "Part", name: "Upgrade_Wall",
      parent: "Workspace/AF51Scene",
      properties: {
        Size: "Vector3.new(10, 6, 0.6)",
        Position: "Vector3.new(-6, 3, 6)",
        Anchored: true, Material: "Enum.Material.Concrete",
        Color: "Color3.fromRGB(95, 95, 100)",
      },
      tags: ["module", "wall", "upgrade-wall", "secondary",
             "rule:tycoon:upgrade-wall"],
    });
    for (let i = 0; i < 4; i++) {
      graph.add({
        className: "Part", name: "Upgrade_Wall_Bar_" + i,
        parent: "Workspace/AF51Scene",
        properties: {
          Size: "Vector3.new(0.6, 4.4, 0.2)",
          Position: "Vector3.new(" + (-10 + i * 2.5) + ", 3, 5.7)",
          Anchored: true, Material: "Enum.Material.Neon",
          Color: rules.palette.cash, CastShadow: false,
        },
        tags: ["module", "trim", "upgrade-wall", "emissive",
               "rule:tycoon:upgrade-wall"],
      });
    }
    satisfied++;

    // factory-pipe — multiple long thin pipes overhead.
    for (let i = 0; i < 4; i++) {
      graph.add({
        className: "Part", name: "Factory_Pipe_" + i,
        parent: "Workspace/AF51Scene",
        properties: {
          Size: "Vector3.new(18, 0.5, 0.5)",
          Position: "Vector3.new(0, " + (7 + i * 0.6).toFixed(2) + ", " + (-8 + i * 5) + ")",
          Anchored: true, Material: "Enum.Material.Metal",
          Color: rules.palette.pipe,
        },
        tags: ["module", "pipe", "prop", "rule:tycoon:factory-pipe"],
      });
    }
    satisfied++;

    // storage-crate — small pile near the vault, tagged with the rule.
    for (let i = 0; i < 4; i++) {
      const dx = (i % 2) * 1.6 - 0.8;
      const dz = (i < 2 ? 0 : 1.6);
      graph.add({
        className: "Part", name: "Storage_Crate_" + i,
        parent: "Workspace/AF51Scene",
        properties: {
          Size: "Vector3.new(1.8, 1.4, 1.4)",
          Position: "Vector3.new(" + (-10 + dx) + ", 0.7, " + (-4 + dz) + ")",
          Anchored: true, Material: "Enum.Material.Wood",
          Color: rules.palette.crate,
        },
        tags: ["module", "crate", "prop", "rule:tycoon:storage-crate"],
      });
    }
    satisfied++;

    // cash-path-light — emissive strip along the conveyor route.
    for (let i = 0; i < 5; i++) {
      graph.add({
        className: "Part", name: "CashPath_Light_" + i,
        parent: "Workspace/AF51Scene",
        properties: {
          Size: "Vector3.new(0.3, 0.15, 3)",
          Position: "Vector3.new(4, 0.7, " + (-10 + i * 5) + ")",
          Anchored: true, Material: "Enum.Material.Neon",
          Color: rules.palette.cash, CastShadow: false,
        },
        tags: ["module", "trim", "path-light", "light-strip", "emissive",
               "rule:tycoon:cash-path-light"],
      });
    }
    satisfied++;

    return {
      rulesSatisfied: satisfied,
      secondaryLandmarks,
      storytelling: 0,
      shellCenter: [0, 0, 0],
      shellRadius: 32,
      shellSegments: 12,
      shellHeight: 5,
      propAnchors: [[-9, 0, 4], [12, 0, -6], [12, 0, 6]],
    };
  },
};

export default TYCOON;

// masterpiece-builders/fps.js — Competitive arena identity.
// Mandatory features: 3 lanes (L/M/R), cover-cluster, spawn-protection,
// central-objective, flank-tunnel, high-ground, team-side-color.

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

function _lane(graph, name, lanePos, palette, ruleTag) {
  // A lane is a long thin floor strip + low side walls + a cover stub.
  const [x, z] = lanePos;
  graph.add({
    className: "Part", name: "Lane_" + name + "_Floor",
    parent: "Workspace/AF51Scene",
    properties: {
      Size: "Vector3.new(4, 0.4, 60)",
      Position: "Vector3.new(" + x + ", 0.2, " + z + ")",
      Anchored: true, Material: "Enum.Material.Concrete",
      Color: "Color3.fromRGB(100, 105, 110)",
    },
    tags: ["module", "floor", "lane", "primary", ruleTag],
  });
  for (let i = 0; i < 3; i++) {
    const cz = z - 20 + i * 20;
    graph.add({
      className: "Part", name: "Lane_" + name + "_Cover_" + i,
      parent: "Workspace/AF51Scene",
      properties: {
        Size: "Vector3.new(2.4, 1.6, 0.8)",
        Position: "Vector3.new(" + (x + (i % 2 === 0 ? 1.5 : -1.5)) + ", 1, " + cz + ")",
        Anchored: true, Material: "Enum.Material.Concrete",
        Color: "Color3.fromRGB(85, 90, 95)",
      },
      tags: ["module", "cover", "prop", "rule:fps:cover-cluster"],
    });
  }
}

export const FPS = {
  apply({ graph, rules }) {
    let satisfied = 0;
    let secondaryLandmarks = 0;
    let storytelling = 0;

    // 3 readable lanes (L / M / R).
    _lane(graph, "Left",  [-14, 0], rules.palette, "rule:fps:lane-left");
    _lane(graph, "Mid",   [  0, 0], rules.palette, "rule:fps:lane-mid");
    _lane(graph, "Right", [ 14, 0], rules.palette, "rule:fps:lane-right");
    satisfied += 3;
    satisfied++;  // cover-cluster (set by _lane)

    // Spawn protection — coloured floor pads at each team end.
    for (const [name, z, col, tag] of [
      ["TeamA", -32, rules.palette.teamA, "rule:fps:team-side-color"],
      ["TeamB",  32, rules.palette.teamB, "rule:fps:team-side-color"],
    ]) {
      graph.add({
        className: "Part", name: "Spawn_Protection_" + name,
        parent: "Workspace/AF51Scene",
        properties: {
          Size: "Vector3.new(34, 0.3, 8)",
          Position: "Vector3.new(0, 0.15, " + z + ")",
          Anchored: true, Material: "Enum.Material.Neon",
          Color: col, Transparency: 0.55, CastShadow: false,
        },
        tags: ["module", "spawn-protection", "team-side", "polish",
               "rule:fps:spawn-protection", tag],
      });
    }
    satisfied += 2;  // spawn-protection + team-side-color

    // Central objective — neon obelisk in the centre.
    graph.add({
      className: "Part", name: "Central_Objective_Obelisk",
      parent: "Workspace/AF51Scene",
      properties: {
        Size: "Vector3.new(2, 8, 2)",
        Position: "Vector3.new(0, 4.2, 0)",
        Anchored: true, Material: "Enum.Material.Neon",
        Color: rules.palette.objective, CastShadow: false,
      },
      tags: ["module", "objective", "landmark", "hero",
             "rule:fps:central-objective"],
    });
    satisfied++;
    secondaryLandmarks++;

    // Flank tunnels — low slabs along the outer edges suggest cover-corridor.
    for (const sx of [-22, 22]) {
      graph.add({
        className: "Part", name: "Flank_Tunnel_" + (sx < 0 ? "L" : "R"),
        parent: "Workspace/AF51Scene",
        properties: {
          Size: "Vector3.new(2.4, 4, 50)",
          Position: "Vector3.new(" + sx + ", 2, 0)",
          Anchored: true, Material: "Enum.Material.Concrete",
          Color: "Color3.fromRGB(70, 75, 80)",
        },
        tags: ["module", "tunnel", "flank", "secondary",
               "rule:fps:flank-tunnel"],
      });
    }
    satisfied++;

    // High ground — two raised platforms left + right of mid.
    for (const sx of [-7, 7]) {
      ModuleLibrary.pillar(graph,
        { x: sx, y: 0, z: 0, height: 5, thickness: 2.6, capSize: 4 },
        { namePrefix: "HighGround_" + (sx < 0 ? "L" : "R"),
          tags: ["high-ground", "secondary", "rule:fps:high-ground"] });
      secondaryLandmarks++;
    }
    satisfied++;

    storytelling += 1;
    return {
      rulesSatisfied: satisfied,
      secondaryLandmarks,
      storytelling,
      shellCenter: [0, 0, 0],
      shellRadius: 38,
      shellSegments: 12,
      shellHeight: 6,
      propAnchors: [[-20, 0, -28], [20, 0, 28], [0, 0, 0]],
    };
  },
};

export default FPS;

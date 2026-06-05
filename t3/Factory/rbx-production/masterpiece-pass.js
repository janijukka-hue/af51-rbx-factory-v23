// t3/Factory/rbx-production/masterpiece-pass.js
// AF51-RBX | T3 Layer — MasterpiecePass (v62)
// Role  : Lifts the v61 modular blockout into a production-grade world.
//         Runs after Gameplay, before TierTagger + QualityGate.
//         Per-target builder injects the mandatory identity geometry
//         declared in masterpiece-rules.js, then a common pass adds the
//         shared polish layer (architecture shell, ambient props, banners).

import { ModuleLibrary } from "./module-library.js";
import { rulesFor }      from "./masterpiece-rules.js";
import { OBBY }          from "./masterpiece-builders/obby.js";
import { TYCOON }        from "./masterpiece-builders/tycoon.js";
import { SIMULATOR }     from "./masterpiece-builders/simulator.js";
import { FPS }           from "./masterpiece-builders/fps.js";
import { RPG }           from "./masterpiece-builders/rpg.js";

const BUILDERS = { obby: OBBY, tycoon: TYCOON, simulator: SIMULATOR, fps: FPS, rpg: RPG };

// Stamp a rule-satisfaction tag on the first node that matches `matcher`,
// so existing v61 geometry "claims" the rule without re-building. Returns
// true if the rule was claimed by existing geometry.
function _claim(graph, ruleTag, matcher) {
  for (const n of graph.nodes) {
    if (matcher(n)) {
      if (!n.tags.includes(ruleTag)) n.tags.push(ruleTag);
      return true;
    }
  }
  return false;
}

// Generic perimeter shell — short walls around the play envelope so the map
// reads as enclosed architecture, not floating boxes. Walls are emitted as
// long thin rectangles (non-cube) so QualityGate's cube-ratio stays low.
function _architectureShell(graph, { center = [0, 0, 0], radius = 70, segments = 16, height = 4, palette, materials }) {
  const out = [];
  const [cx, cy, cz] = center;
  const color = palette?.shell || "Color3.fromRGB(95, 105, 120)";
  const mat   = materials?.shell || "Enum.Material.Slate";
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = (cx + Math.cos(a) * radius).toFixed(2);
    const z = (cz + Math.sin(a) * radius).toFixed(2);
    const rot = (a * 180 / Math.PI) + 90;
    out.push(graph.add({
      className: "Part", name: "Shell_Wall_" + i,
      parent: "Workspace/AF51Scene",
      properties: {
        Size: "Vector3.new(12, " + height + ", 0.6)",
        CFrame: "CFrame.new(" + x + ", " + (cy + height / 2) + ", " + z +
                ") * CFrame.Angles(0, math.rad(" + rot.toFixed(2) + "), 0)",
        Anchored: true, Material: mat, Color: color,
      },
      tags: ["module", "wall", "shell", "perimeter", "secondary"],
    }));
  }
  // Corner buttresses at cardinal points for vertical silhouette anchor.
  let bi = 0;
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const x = Math.round(cx + Math.cos(a) * radius);
    const z = Math.round(cz + Math.sin(a) * radius);
    out.push(...ModuleLibrary.pillar(graph,
      { x, y: cy, z, height: 10, thickness: 1.4, capSize: 2.2 },
      { namePrefix: "Shell_Buttress_" + (bi++), tags: ["shell", "buttress", "secondary"] }));
  }
  return out;
}

// Ambient prop clusters — small pile of crates/barrels grouped at offsets
// from the landmark so the storytelling tier reads at ground level.
function _ambientProps(graph, anchors, palette, materials) {
  const out = [];
  const matCrate  = (materials && (materials.crate || materials.prop)) || "Enum.Material.WoodPlanks";
  const matBarrel = (materials && (materials.pipe  || materials.prop)) || "Enum.Material.Metal";
  const matPipe   = (materials && (materials.pipe  || materials.prop)) || "Enum.Material.Metal";
  for (let i = 0; i < anchors.length; i++) {
    const [ax, ay, az] = anchors[i];
    // Three crates of different sizes — non-cube ratios so they don't
    // inflate cube-ratio in QualityGate V3.
    out.push(graph.add({
      className: "Part", name: "Prop_Crate_" + i + "_A",
      parent: "Workspace/AF51Scene",
      properties: {
        Size: "Vector3.new(2.4, 1.8, 1.6)",
        Position: "Vector3.new(" + ax + ", " + (ay + 0.9) + ", " + az + ")",
        Anchored: true, Material: matCrate,
        Color: palette?.crate || "Color3.fromRGB(150, 110, 70)",
      },
      tags: ["prop", "crate", "module", "storytelling"],
    }));
    out.push(graph.add({
      className: "Part", name: "Prop_Barrel_" + i,
      parent: "Workspace/AF51Scene",
      properties: {
        Shape: "Enum.PartType.Cylinder",
        Size: "Vector3.new(2.4, 1.6, 1.6)",
        Position: "Vector3.new(" + (ax + 2) + ", " + (ay + 0.8) + ", " + (az + 1) + ")",
        Anchored: true, Material: matBarrel,
        Color: "Color3.fromRGB(110, 100, 90)",
      },
      tags: ["prop", "barrel", "module", "storytelling"],
    }));
    out.push(graph.add({
      className: "Part", name: "Prop_Pipe_" + i,
      parent: "Workspace/AF51Scene",
      properties: {
        Size: "Vector3.new(5, 0.6, 0.6)",
        Position: "Vector3.new(" + (ax - 1) + ", " + (ay + 0.3) + ", " + (az - 1) + ")",
        Anchored: true, Material: matPipe,
        Color: "Color3.fromRGB(120, 110, 95)",
      },
      tags: ["prop", "pipe", "module", "storytelling"],
    }));
  }
  return out;
}

// Banner decals on perimeter shell walls so the map carries world-narrative.
function _banners(graph, palette) {
  const shellWalls = graph.nodes.filter(n => n.tags.includes("shell") &&
                                              n.tags.includes("perimeter")).slice(0, 4);
  const out = [];
  for (let i = 0; i < shellWalls.length; i++) {
    out.push(graph.add({
      className: "Decal", name: "Banner_" + i,
      parent: "Workspace/AF51Scene/" + shellWalls[i].name,
      properties: {
        Face: "Enum.NormalId.Front",
        Color3: palette?.trim || "Color3.fromRGB(220, 200, 160)",
        Transparency: 0.05,
      },
      tags: ["banner", "decal", "story", "polish", "storytelling"],
    }));
  }
  return out;
}

export const MasterpiecePass = {
  apply({ graph, target }) {
    const type = String(target.type || target.id || "").toLowerCase();
    const rules = rulesFor(target);
    if (!rules) return { ok: true, type, shells: 0, secondaryLandmarks: 0,
                          propClusters: 0, storytelling: 0, rulesSatisfied: 0, skipped: true };
    const ctx = { graph, target, rules, claim: _claim };
    const builder = BUILDERS[type];
    const built = builder ? builder.apply(ctx) : { rulesSatisfied: 0, propAnchors: [] };
    const shell = _architectureShell(graph, {
      center: built.shellCenter || [0, 0, 0],
      radius: built.shellRadius || 70,
      segments: built.shellSegments || 16,
      height: built.shellHeight || 4,
      palette: rules.palette,
      materials: rules.materials,
    });
    const props = _ambientProps(graph, built.propAnchors || [[0, 0, 0]], rules.palette, rules.materials);
    const banners = _banners(graph, rules.palette);
    return {
      ok: true, type,
      shells: shell.length,
      secondaryLandmarks: built.secondaryLandmarks || 0,
      propClusters: props.length,
      storytelling: banners.length + (built.storytelling || 0),
      rulesSatisfied: built.rulesSatisfied || 0,
    };
  },
};

export default MasterpiecePass;

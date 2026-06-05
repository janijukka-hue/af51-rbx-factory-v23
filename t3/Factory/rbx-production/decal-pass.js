// t3/Factory/rbx-production/decal-pass.js
// AF51-RBX | T3 Layer — DecalPass (v63)
// Role  : Adds per-target signage / faction iconography / surface graphics on
//         landmark, objective, gate, and team-side parts. Decals are emitted
//         as Roblox `Decal` instances with `Color3` + `Transparency` —
//         no external Texture/AssetId required, so the build stays fully
//         deterministic. Runs after MeshPass, before TierTagger.

// Per-target decal recipe. Each entry is a `{ match, faces, color, transparency }`:
//   match : array of tags — first match wins.
//   faces : array of NormalId values to apply (Front/Back/Left/Right/Top).
//   color : Color3 constructor string.
//   transparency : 0..1 (lower = more visible).
const RECIPES_BY_TYPE = {
  obby: [
    // Chevron warnings on energy rails.
    { match: ["energy-rail"], faces: ["Top"],
      color: "Color3.fromRGB(255, 230, 80)", transparency: 0.10 },
    // Goal-tower hero panel — top + front.
    { match: ["goal-tower", "landmark"], faces: ["Front", "Back"],
      color: "Color3.fromRGB(80, 220, 255)", transparency: 0.05 },
    // Checkpoint glyphs.
    { match: ["checkpoint-gate"], faces: ["Front"],
      color: "Color3.fromRGB(120, 255, 180)", transparency: 0.10 },
  ],
  fps: [
    // Team-A side wall faction colour.
    { match: ["lane-left", "team-side-color"], faces: ["Front"],
      color: "Color3.fromRGB(80, 160, 255)", transparency: 0.20 },
    { match: ["lane-right"], faces: ["Front"],
      color: "Color3.fromRGB(255, 80, 100)", transparency: 0.20 },
    // Central objective warning band.
    { match: ["central-objective"], faces: ["Top", "Front", "Back"],
      color: "Color3.fromRGB(255, 220, 120)", transparency: 0.05 },
    // Cover-cluster targeting stripes.
    { match: ["cover-cluster"], faces: ["Top"],
      color: "Color3.fromRGB(255, 80, 80)", transparency: 0.30 },
  ],
  tycoon: [
    // Cash collector glyph.
    { match: ["collector-vault"], faces: ["Front", "Back"],
      color: "Color3.fromRGB(120, 255, 160)", transparency: 0.05 },
    // Dropper machinery hazard stripes.
    { match: ["dropper-machine"], faces: ["Top"],
      color: "Color3.fromRGB(255, 200, 80)", transparency: 0.15 },
    // Upgrade-wall pricing label.
    { match: ["upgrade-wall"], faces: ["Front"],
      color: "Color3.fromRGB(220, 220, 240)", transparency: 0.10 },
  ],
  simulator: [
    // Reward beacon glow tint.
    { match: ["reward-beacon"], faces: ["Top", "Front", "Back", "Left", "Right"],
      color: "Color3.fromRGB(255, 240, 140)", transparency: 0.20 },
    // Sell-zone target marker.
    { match: ["sell-zone"], faces: ["Top"],
      color: "Color3.fromRGB(120, 255, 120)", transparency: 0.15 },
    // Shrine glyph.
    { match: ["upgrade-shrine", "shrine"], faces: ["Front", "Back"],
      color: "Color3.fromRGB(255, 200, 80)", transparency: 0.10 },
  ],
  rpg: [
    // Village-gate sigil.
    { match: ["village-gate"], faces: ["Front"],
      color: "Color3.fromRGB(255, 200, 130)", transparency: 0.05 },
    // Loot-shrine glyph.
    { match: ["loot-shrine"], faces: ["Front", "Back"],
      color: "Color3.fromRGB(255, 220, 120)", transparency: 0.10 },
    // Enemy border warning.
    { match: ["enemy-border"], faces: ["Top"],
      color: "Color3.fromRGB(255, 90, 90)", transparency: 0.20 },
    // Quest-plaza emblem.
    { match: ["quest-plaza"], faces: ["Top"],
      color: "Color3.fromRGB(180, 200, 255)", transparency: 0.15 },
  ],
};

// Per-part decal cap so a deeply-tagged landmark doesn't get 12 stacked decals.
const MAX_DECALS_PER_PART = 4;

function _matchedRecipes(tags, recipes) {
  if (!recipes) return [];
  const out = [];
  for (const r of recipes) {
    for (const m of r.match) if (tags.includes(m)) { out.push(r); break; }
  }
  return out;
}

export const DecalPass = {
  apply({ graph, target }) {
    const type = String(target.type || target.id || "").toLowerCase();
    const recipes = RECIPES_BY_TYPE[type] || RECIPES_BY_TYPE.obby;

    let decalsAdded = 0;
    const partsToProcess = graph.nodes.filter(n => n.className === "Part");

    for (const part of partsToProcess) {
      const matches = _matchedRecipes(part.tags, recipes);
      if (!matches.length) continue;

      let countOnPart = 0;
      const parentPath = "Workspace/AF51Scene/" + part.name;

      for (const recipe of matches) {
        for (const face of recipe.faces) {
          if (countOnPart >= MAX_DECALS_PER_PART) break;
          // Idempotent — skip if a decal with same name already exists.
          const decalName = "Decal_" + part.name + "_" + face;
          if (graph.nodes.some(n => n.name === decalName && n.parent === parentPath)) continue;
          graph.add({
            className:  "Decal",
            name:       decalName,
            parent:     parentPath,
            properties: {
              Color3:       recipe.color,
              Face:         "Enum.NormalId." + face,
              Transparency: recipe.transparency,
            },
            tags: ["decal", "polish", "signage", "tier:5"],
          });
          decalsAdded++;
          countOnPart++;
        }
        if (countOnPart >= MAX_DECALS_PER_PART) break;
      }
    }

    return { ok: true, decalsAdded };
  },
};

export default DecalPass;

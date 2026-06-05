// t3/Factory/rbx-production/masterpiece-rules.js
// AF51-RBX | T3 Layer — Per-target masterpiece rule sets (v62)
// Role  : Pure data. Each target declares the mandatory identity features
//         the MasterpiecePass must produce and the QualityGate must verify.
//         Each entry maps to a tag the rule writes when its geometry lands.

// v63 — Per-target material palette. Each entry maps a semantic surface role
// to a Roblox Enum.Material constant. Picked for PBR variety so the
// resulting Studio scene reads as authored architecture rather than a sea
// of SmoothPlastic cubes. Mat values are bare names; builders prefix
// "Enum.Material." when emitting properties.
const _MAT = {
  obby: {
    shell:    "DiamondPlate",   // chamfered armor plating on perimeter
    platform: "Metal",          // floating sci-fi pads
    glow:     "Neon",           // energy strips + path light
    depth:    "Concrete",       // dark drop-frame language
    prop:     "Metal",
    trim:     "Foil",
    landmark: "DiamondPlate",
  },
  fps: {
    shell:    "CorrodedMetal",  // worn arena perimeter
    floor:    "Asphalt",        // gritty playable surface
    cover:    "Concrete",       // hard-cover blocks
    objective:"Neon",           // capture point reads instantly
    teamMark: "SmoothPlastic",
    prop:     "Metal",
    landmark: "Metal",
  },
  tycoon: {
    shell:    "DiamondPlate",   // factory floor
    machinery:"CorrodedMetal",  // gritty dropper/conveyor
    pipe:     "Metal",
    cash:     "Neon",           // collector + cash path
    crate:    "WoodPlanks",     // storage crates
    floor:    "DiamondPlate",
    landmark: "Metal",
  },
  simulator: {
    shell:    "Sandstone",      // warm reward-loop perimeter
    field:    "Grass",          // collection field reads as biome
    shrine:   "Marble",         // upgrade shrine = premium feel
    sell:     "Foil",           // sell zone is gold-plated
    reward:   "Neon",           // beacon glow
    gate:     "Granite",
    prop:     "WoodPlanks",
    landmark: "Marble",
  },
  rpg: {
    shell:    "Cobblestone",    // medieval wall
    road:     "Cobblestone",    // village paths
    wood:     "WoodPlanks",     // huts, gates
    stone:    "Slate",          // village houses
    warm:     "Foil",           // warm hub light glow
    cold:     "Marble",         // cold danger marker
    loot:     "Neon",           // loot shrine glow
    prop:     "WoodPlanks",
    landmark: "Brick",
  },
};

// Wrap a bare Material name in the Enum string the emitter passes through.
function _enumMat(name) { return "Enum.Material." + name; }

// Expand each target's material palette to fully-qualified Enum strings so
// builders can drop them straight into a node's `properties.Material`.
function _expandMaterials(map) {
  const out = {};
  for (const k of Object.keys(map)) out[k] = _enumMat(map[k]);
  return out;
}

export const MASTERPIECE_RULES = {
  // OBBY — sci-fi traversal temple
  obby: {
    identity: "sci-fi-traversal-temple",
    requiredTags: [
      "rule:obby:floating-platforms",
      "rule:obby:checkpoint-gate",
      "rule:obby:energy-rail",
      "rule:obby:goal-tower",
      "rule:obby:path-lighting",
      "rule:obby:depth-frame",
    ],
    palette: {
      shell: "Color3.fromRGB(70, 90, 130)",
      trim:  "Color3.fromRGB(180, 220, 255)",
      glow:  "Color3.fromRGB(80, 220, 255)",
    },
    materials: _expandMaterials(_MAT.obby),
  },

  // FPS — competitive arena
  fps: {
    identity: "competitive-arena",
    requiredTags: [
      "rule:fps:lane-left",
      "rule:fps:lane-mid",
      "rule:fps:lane-right",
      "rule:fps:cover-cluster",
      "rule:fps:spawn-protection",
      "rule:fps:central-objective",
      "rule:fps:flank-tunnel",
      "rule:fps:high-ground",
      "rule:fps:team-side-color",
    ],
    palette: {
      shell:    "Color3.fromRGB(85, 90, 95)",
      teamA:    "Color3.fromRGB(80, 160, 255)",
      teamB:    "Color3.fromRGB(255, 80, 100)",
      objective:"Color3.fromRGB(255, 220, 120)",
    },
    materials: _expandMaterials(_MAT.fps),
  },

  // TYCOON — industrial money factory
  tycoon: {
    identity: "industrial-factory",
    requiredTags: [
      "rule:tycoon:claim-base",
      "rule:tycoon:dropper-machine",
      "rule:tycoon:conveyor",
      "rule:tycoon:collector-vault",
      "rule:tycoon:upgrade-wall",
      "rule:tycoon:factory-pipe",
      "rule:tycoon:storage-crate",
      "rule:tycoon:cash-path-light",
    ],
    palette: {
      shell:   "Color3.fromRGB(95, 100, 110)",
      pipe:    "Color3.fromRGB(160, 130, 90)",
      crate:   "Color3.fromRGB(170, 130, 80)",
      cash:    "Color3.fromRGB(120, 255, 160)",
    },
    materials: _expandMaterials(_MAT.tycoon),
  },

  // SIMULATOR — reward-loop playground
  simulator: {
    identity: "reward-loop-playground",
    requiredTags: [
      "rule:simulator:collection-field",
      "rule:simulator:sell-zone",
      "rule:simulator:upgrade-shrine",
      "rule:simulator:reward-beacon",
      "rule:simulator:progression-gate",
      "rule:simulator:resource-cluster",
    ],
    palette: {
      shell:   "Color3.fromRGB(110, 90, 140)",
      sell:    "Color3.fromRGB(120, 255, 120)",
      shrine:  "Color3.fromRGB(255, 200, 80)",
      reward:  "Color3.fromRGB(255, 240, 140)",
    },
    materials: _expandMaterials(_MAT.simulator),
  },

  // RPG — playable fantasy hub
  rpg: {
    identity: "playable-fantasy-hub",
    requiredTags: [
      "rule:rpg:village-gate",
      "rule:rpg:quest-plaza",
      "rule:rpg:enemy-border",
      "rule:rpg:loot-shrine",
      "rule:rpg:road-network",
      "rule:rpg:warm-hub-light",
      "rule:rpg:cold-danger-light",
      "rule:rpg:vertical-landmark",
    ],
    palette: {
      shell:    "Color3.fromRGB(120, 100, 80)",
      road:     "Color3.fromRGB(140, 120, 100)",
      warm:     "Color3.fromRGB(255, 200, 130)",
      cold:     "Color3.fromRGB(120, 160, 220)",
      loot:     "Color3.fromRGB(255, 220, 120)",
    },
    materials: _expandMaterials(_MAT.rpg),
  },
};

// Helper: list the rule-tag set for a target id/type.
export function rulesFor(target) {
  const type = String(target?.type || target?.id || "").toLowerCase();
  return MASTERPIECE_RULES[type] || null;
}

export default MASTERPIECE_RULES;

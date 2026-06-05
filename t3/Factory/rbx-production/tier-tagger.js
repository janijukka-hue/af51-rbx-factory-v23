// t3/Factory/rbx-production/tier-tagger.js
// AF51-RBX | T3 Layer — TierTagger (v62)
// Role  : Stamps a TIER_0..TIER_5 tag on every node based on its existing
//         role tags + Roblox className. Idempotent: re-running over a graph
//         with tier:N tags is a no-op. Tier vocabulary:
//           TIER_0 gameplay anchors  (SpawnLocation, start/finish/checkpoint)
//           TIER_1 primary structure (floors, walls, base, arena, platform)
//           TIER_2 secondary structure (trim, pillar, support, beam, railing)
//           TIER_3 detail props (crates, barrels, pipes, debris, cover)
//           TIER_4 lighting / emissive (PointLight, accent strips, beacons)
//           TIER_5 polish / storytelling (landmarks, decals, wreckage, halos)

const TIER_TAG = "tier:";

// Order matters: first match wins. Narrower roles ranked above broader ones
// so a `landmark` beacon (Part) gets TIER_5, not the structural default.
const RULES = [
  // TIER_0 — gameplay anchors -------------------------------------------------
  { tier: 0, classes: ["SpawnLocation"] },
  { tier: 0, tags: ["start", "finish", "checkpoint", "spawn", "objective",
                    "goal", "gameplay-anchor", "anchor"] },

  // TIER_5 — polish & storytelling -------------------------------------------
  { tier: 5, tags: ["landmark", "story", "polish", "hero", "halo", "wreck",
                    "wreckage", "banner", "mural", "decal-art", "shrine",
                    "monument", "totem", "core", "gate", "vault"] },
  { tier: 5, classes: ["Decal", "Texture", "ParticleEmitter"] },

  // TIER_4 — lighting / emissive ---------------------------------------------
  { tier: 4, classes: ["PointLight", "SpotLight", "SurfaceLight"] },
  { tier: 4, tags: ["identity-light", "beacon", "accent-light", "key-light",
                    "rim-light", "path-light", "emissive", "neon-strip",
                    "light-strip"] },

  // TIER_3 — detail props ----------------------------------------------------
  { tier: 3, tags: ["prop", "crate", "barrel", "pipe", "conveyor", "debris",
                    "clutter", "cover", "rubble", "vegetation", "fauna",
                    "dropper", "collector"] },

  // TIER_2 — secondary structure ---------------------------------------------
  { tier: 2, tags: ["secondary", "trim", "pillar", "tower", "support", "beam",
                    "truss", "buttress", "railing", "window", "stair",
                    "bridge-deck", "halo-ring", "frame", "chamfer", "stepped"] },

  // TIER_1 — primary structure -----------------------------------------------
  { tier: 1, tags: ["floor", "wall", "base", "arena", "platform", "road",
                    "ground", "hub", "primary", "structural", "shell",
                    "boundary", "perimeter", "lane", "zone-wall"] },
];

// Service-side parents that should never be tier-tagged (Lighting effects
// already carry their own meaning through service properties).
const SKIP_PARENT_PREFIX = ["Lighting"];

function _existingTier(node) {
  for (const t of node.tags) {
    if (t.startsWith(TIER_TAG)) return t;
  }
  return null;
}

function _matchRule(node, rule) {
  if (rule.classes && rule.classes.includes(node.className)) return true;
  if (rule.tags) {
    for (const tag of rule.tags) {
      if (node.tags.includes(tag)) return true;
    }
  }
  return false;
}

function _inferTier(node) {
  for (const rule of RULES) {
    if (_matchRule(node, rule)) return rule.tier;
  }
  // Untagged Part with no role hints — treat as primary structure so
  // QualityGate still counts it toward tier coverage rather than dropping it.
  if (node.className === "Part") return 1;
  return null;
}

function _skipNode(node) {
  for (const pref of SKIP_PARENT_PREFIX) {
    if (node.parent === pref) return true;
  }
  return false;
}

export const TierTagger = {
  /** Apply tier:N tags in place. Returns {ok, stamped, alreadyTagged, perTier}. */
  apply({ graph }) {
    let stamped = 0;
    let alreadyTagged = 0;
    const perTier = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const node of graph.nodes) {
      if (_skipNode(node)) continue;
      const existing = _existingTier(node);
      if (existing) {
        alreadyTagged++;
        const n = Number(existing.slice(TIER_TAG.length));
        if (Number.isFinite(n) && perTier[n] !== undefined) perTier[n]++;
        continue;
      }
      const tier = _inferTier(node);
      if (tier === null) continue;
      node.tags.push(TIER_TAG + tier);
      perTier[tier]++;
      stamped++;
    }
    return { ok: true, stamped, alreadyTagged, perTier };
  },

  /** Public read-only metadata for QualityGate and preview UI. */
  meta: {
    tierTagPrefix: TIER_TAG,
    tiers: [0, 1, 2, 3, 4, 5],
    tierLabels: {
      0: "GAMEPLAY",
      1: "STRUCTURE",
      2: "SECONDARY",
      3: "DETAIL",
      4: "LIGHT",
      5: "POLISH",
    },
  },
};

export default TierTagger;

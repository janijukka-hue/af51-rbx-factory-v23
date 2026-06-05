// t3/Factory/rbx-production/quality-gate.js
// AF51-RBX | T3 Layer — QualityGate V3 (Masterpiece World Builder, v62)
// Role  : Honest report on the produced SceneGraph. Blocking when critical
//         invariants fail. V3 layers a Masterpiece Quality Score (0..100,
//         blocks under 85), cube-ratio blocking (>35%), and untrimmed-
//         platform-ratio blocking (>25%) on top of the v61 world-
//         believability checks.

import {
  cubeRatio, untrimmedPlatformRatio, tierCoverage, ruleCoverage, qualityScore,
} from "./quality-metrics.js";

// Per-target thresholds. minParts is intentionally well above the v60
// baseline so the world-believability passes are forced to actually run.
const RECOMMENDED = {
  obby:       { minParts: 75, needs: ["start", "obstacle", "finish"] },
  tycoon:     { minParts: 75, needs: ["base", "dropper-base"] },
  simulator:  { minParts: 80, needs: ["arena", "zone"] },
  fps:        { minParts: 85, needs: ["floor"] },
  rpg:        { minParts: 70, needs: ["town", "building"] },
};

// ─── v2 — Per-target gameplay invariants ─────────────────────────────────
// Each target must satisfy a recognizable gameplay loop, not just a
// believable-looking world. These checks are BLOCKING (push into
// `criticals`) and also each missing gameplay invariant docks the quality
// score by 20 points, so a world that's pretty but unplayable can never
// score above the 85 gate even if every other axis is perfect.
//
// Tag conventions match composition-engine.js v2 (uppercase = gameplay).
const GAMEPLAY_REQUIREMENTS = {
  obby: [
    { check: (tc) => tc["Checkpoint"]  >= 5, msg: "obby needs >=5 Checkpoint parts (5 stages)" },
    { check: (tc) => tc["Killbrick"]   >= 3, msg: "obby needs >=3 Killbrick hazards" },
    { check: (tc) => tc["Mover"]       >= 1, msg: "obby needs >=1 Mover platform" },
    { check: (tc) => tc["finish"]      >= 1, msg: "obby needs a finish anchor" },
    { check: (tc) => tc["Goal"]        >= 1, msg: "obby needs a Goal gate" },
  ],
  tycoon: [
    { check: (tc) => tc["Dropper"]      >= 4, msg: "tycoon needs >=4 Dropper machines" },
    { check: (tc) => tc["Collector"]    >= 4, msg: "tycoon needs >=4 Collector pads" },
    { check: (tc) => tc["Upgrade"]      >= 3, msg: "tycoon needs >=3 Upgrade pads" },
    { check: (tc) => tc["TycoonOwner"]  >= 1, msg: "tycoon needs a TycoonOwner claim point" },
    { check: (tc) => tc["perimeter"]    >= 4, msg: "tycoon plot needs perimeter walls" },
  ],
  simulator: [
    { check: (tc) => tc["ResourceNode"]      >= 10, msg: "simulator needs >=10 ResourceNodes (tier coverage)" },
    { check: (tc) => tc["SellZone"]          >= 1,  msg: "simulator needs a SellZone" },
    { check: (tc) => tc["Shop"]              >= 2,  msg: "simulator needs >=2 shops (UpgradeShop + PetShop)" },
    { check: (tc) => tc["PrestigePodium"]    >= 1,  msg: "simulator needs a PrestigePodium (progression gate)" },
  ],
  fps: [
    { check: (tc) => tc["TeamSpawn"]      >= 2, msg: "fps needs >=2 TeamSpawns (two teams)" },
    { check: (tc) => tc["Objective"]      >= 1, msg: "fps needs at least one Objective" },
    { check: (tc) => tc["Cover"]          >= 6, msg: "fps needs >=6 Cover blocks for combat flow" },
    { check: (tc) => tc["lane:1"]         >= 1, msg: "fps needs lane markers (lane:1)" },
    { check: (tc) => tc["WeaponLocker"]   >= 1, msg: "fps needs a WeaponLocker" },
  ],
  rpg: [
    { check: (tc) => tc["NPC"]              >= 3, msg: "rpg needs >=3 NPC stands" },
    { check: (tc) => tc["QuestBoard"]       >= 1, msg: "rpg needs a QuestBoard" },
    { check: (tc) => tc["building"]         >= 4, msg: "rpg needs >=4 buildings (Inn/Smithy/Market/Temple)" },
    { check: (tc) => tc["DungeonGate"]      >= 1, msg: "rpg needs a DungeonGate (progression anchor)" },
    { check: (tc) => tc["ProgressionGate"]  >= 1, msg: "rpg needs a Portal / ProgressionGate" },
  ],
};

const REQUIRED_BELIEVABILITY = {
  minModuleCategories: 3,   // at least 3 distinct module categories
  minLandmarks:        1,   // ≥1 landmark Part
  minSilhouette:       4,   // ≥4 silhouette/vertical-form Parts
  minTraversal:        2,   // ≥2 traversal anchors (strips or markers)
  minLayers:           2,   // ≥2 of {secondary, trim, lighting, prop}
};

const MODULE_CATEGORY_TAGS = [
  "pillar", "tower", "wall", "floor", "corner",
  "stair", "door", "bridge", "railing", "window", "support",
];

function _countByTag(graph) {
  const out = {};
  for (const n of graph.nodes) {
    for (const t of n.tags) out[t] = (out[t] || 0) + 1;
  }
  return out;
}

function _moduleCategoryCount(tagCounts) {
  let n = 0;
  for (const t of MODULE_CATEGORY_TAGS) if (tagCounts[t]) n++;
  return n;
}

function _layerCoverage(tagCounts) {
  const layers = ["layer:secondary", "layer:trim", "layer:lighting", "layer:prop"];
  let present = 0;
  const detail = {};
  for (const t of layers) {
    detail[t] = tagCounts[t] || 0;
    if (tagCounts[t]) present++;
  }
  return { present, detail };
}

function _densityByZone(graph) {
  const out = {};
  for (const n of graph.nodes) {
    for (const t of n.tags) {
      if (t.startsWith("zone:")) out[t] = (out[t] || 0) + 1;
    }
  }
  return out;
}

export const QualityGate = {
  evaluate({ graph, target }) {
    const type   = String(target.type || target.id || "").toLowerCase();
    const parts  = graph.findByClass("Part").length;
    const lights = graph.findByClass("PointLight").length;
    const spawns = graph.findByClass("SpawnLocation").length;

    const materialDiversity = new Set(
      graph.nodes
        .filter((n) => n.className === "Part" && n.properties.Material)
        .map((n) => n.properties.Material),
    ).size;

    const tagCounts        = _countByTag(graph);
    const moduleCategories = _moduleCategoryCount(tagCounts);
    const layerInfo        = _layerCoverage(tagCounts);
    const densityByZone    = _densityByZone(graph);
    const landmarks        = tagCounts["landmark"]   || 0;
    const silhouette       = tagCounts["silhouette"] || 0;
    const traversal        = (tagCounts["traversal"] || 0);
    const identityLights   = tagCounts["identity-light"] || 0;

    const criticals = [];
    const warnings  = [];

    const rec = RECOMMENDED[type];
    if (rec) {
      if (parts < rec.minParts) {
        criticals.push("parts below recommended minimum for type " + type +
                       " (" + parts + " < " + rec.minParts + ")");
      }
      for (const need of rec.needs) {
        if (!tagCounts[need]) criticals.push("missing structural tag: " + need);
      }
    }
    if (spawns === 0) criticals.push("no SpawnLocation in scene — players would spawn at origin");

    // World-believability invariants (blocking — these are the v61 sprint).
    if (moduleCategories < REQUIRED_BELIEVABILITY.minModuleCategories) {
      criticals.push("module diversity below minimum (" + moduleCategories +
                     " < " + REQUIRED_BELIEVABILITY.minModuleCategories + ")");
    }
    if (landmarks < REQUIRED_BELIEVABILITY.minLandmarks) {
      criticals.push("no landmark Parts — map lacks focal identity");
    }
    if (silhouette < REQUIRED_BELIEVABILITY.minSilhouette) {
      criticals.push("silhouette forms below minimum (" + silhouette +
                     " < " + REQUIRED_BELIEVABILITY.minSilhouette + ")");
    }
    if (traversal < REQUIRED_BELIEVABILITY.minTraversal) {
      criticals.push("traversal cues below minimum (" + traversal +
                     " < " + REQUIRED_BELIEVABILITY.minTraversal + ")");
    }
    if (layerInfo.present < REQUIRED_BELIEVABILITY.minLayers) {
      criticals.push("structural layering coverage below minimum (" +
                     layerInfo.present + " < " + REQUIRED_BELIEVABILITY.minLayers + ")");
    }

    if (lights === 0)            warnings.push("no PointLights — scene relies entirely on Lighting service");
    if (materialDiversity < 2)   warnings.push("material diversity below 2 — scene looks monotone");
    if (identityLights === 0)    warnings.push("no identity lights — landmarks lack key/accent/rim");

    // ── V3 Masterpiece metrics ──────────────────────────────────────────
    const cube       = cubeRatio(graph);
    const untrimmed  = untrimmedPlatformRatio(graph);
    const tiers      = tierCoverage(graph);
    const rules      = ruleCoverage(graph, target);
    const polishTier = tiers.perTier[5] || 0;
    const propTier   = tiers.perTier[3] || 0;

    if (cube.ratio > 0.35) {
      criticals.push("simple-cube ratio above 35% (" +
                     (cube.ratio * 100).toFixed(1) + "% — world reads as boxes)");
    }
    if (untrimmed.ratio > 0.25) {
      criticals.push("untrimmed-platform ratio above 25% (" +
                     (untrimmed.ratio * 100).toFixed(1) + "% — floors lack edge detail)");
    }
    if (tiers.present < 5) {
      criticals.push("tier coverage below 5 (" + tiers.present +
                     "/6 — missing tier(s): " +
                     Object.entries(tiers.perTier).filter(([, v]) => v === 0).map(([k]) => "T" + k).join(", ") + ")");
    }
    if (polishTier < 3) {
      criticals.push("polish tier (TIER_5) below minimum (" + polishTier +
                     " < 3 — storytelling missing)");
    }
    if (rules.missing.length) {
      criticals.push("masterpiece rules unsatisfied for " + (rules.identity || type) +
                     ": " + rules.missing.join(", "));
    }

    // ── v2 — Per-target gameplay invariants ─────────────────────────────
    // Each missing gameplay anchor is BLOCKING and also docks the quality
    // score by 20 points (capped at the score floor). This is the explicit
    // guarantee: a build with qualityScore 97 must actually be playable.
    const gameplayReqs = GAMEPLAY_REQUIREMENTS[type] || [];
    const gameplayMissing = [];
    for (const req of gameplayReqs) {
      if (!req.check(tagCounts)) {
        criticals.push("gameplay: " + req.msg);
        gameplayMissing.push(req.msg);
      }
    }

    const qsRaw = qualityScore({
      parts, minParts: rec ? rec.minParts : 60,
      moduleCategories, tierPresent: tiers.present,
      landmarks, silhouette, traversal,
      layerPresent: layerInfo.present, materialDiversity,
      polishTier, propTier,
      ruleRatio: rules.ratio,
      cubeRatio: cube.ratio, untrimmedRatio: untrimmed.ratio,
    });

    // Gameplay penalty: 20 points per missing requirement, never below 0.
    const gameplayPenalty = gameplayMissing.length * 20;
    const adjustedScore = Math.max(0, qsRaw.score - gameplayPenalty);
    const qs = { score: adjustedScore, factors: { ...qsRaw.factors, gameplayPenalty } };

    if (qs.score < 85) {
      criticals.push("Masterpiece Quality Score below 85 (" + qs.score + "/100" +
                     (gameplayPenalty > 0 ? `, -${gameplayPenalty} gameplay penalty` : "") + ")");
    }

    const notes = [...criticals, ...warnings];
    const ok    = criticals.length === 0;
    const report = {
      type, parts, lights, spawns, materialDiversity,
      moduleCategories, landmarks, silhouette, traversal, identityLights,
      layerCoverage: layerInfo, densityByZone,
      tierCoverage: tiers,
      cubeRatio: cube,
      untrimmedPlatform: untrimmed,
      rules,
      qualityScore: qs.score,
      qualityScoreRaw: qsRaw.score,
      qualityFactors: qs.factors,
      gameplayRequirements: {
        total: gameplayReqs.length,
        missing: gameplayMissing,
        satisfied: gameplayReqs.length - gameplayMissing.length,
      },
      tagCoverage: Object.keys(tagCounts).sort().reduce((acc, k) => {
        acc[k] = tagCounts[k]; return acc;
      }, {}),
      criticals,
      warnings,
      notes,
      ok,
      pass: notes.length === 0,
    };

    graph.report = report;
    return report;
  },
};

export default QualityGate;

// m2/roblox/lua-code-analyzer.js — ESM
// AF51 ROBLOX — Code-aware feature analyzer.
//
// MISSION: Analyze user Lua code to determine what supporting infrastructure
//          the Factory needs to BUILD (not template-overlay) for the code to work.
//
// This is the CORE of the "Code-Aware Factory" concept:
//   1. User writes Lua code
//   2. Factory READS the code
//   3. Factory ANALYZES what the code needs
//   4. Factory GENERATES only those support structures
//   5. Factory DOES NOT overlay RPG/OBBY/etc templates
//
// Returns: { features, supportNeeds, targetHint, analysis }

/**
 * Analyze Roblox Lua source to detect gameplay features and determine
 * what supporting infrastructure is needed.
 *
 * @param {string} luaCode - User's Lua source code
 * @returns {{
 *   features: {
 *     hasHumanoid: boolean,
 *     hasCheckpoints: boolean,
 *     hasClickDetectors: boolean,
 *     hasTouchTransmitters: boolean,
 *     hasDropperLogic: boolean,
 *     hasTerrainGeneration: boolean,
 *     hasNPCs: boolean,
 *     hasAnimations: boolean,
 *   },
 *   supportNeeds: {
 *     needsHumanoidRig: boolean,
 *     needsR6Structure: boolean,
 *     needsMotor6D: boolean,
 *     needsAnimator: boolean,
 *     needsCheckpointSystem: boolean,
 *     needsClickHandling: boolean,
 *     needsTouchHandling: boolean,
 *   },
 *   targetHint: "code-driven" | "rpg-like" | "obby-like" | "simulator-like" | "tycoon-like" | "fps-like",
 *   analysis: {
 *     summary: string,
 *     confidence: number,
 *     signals: string[],
 *   }
 * }}
 */
export function analyzeCodeFeatures(luaCode) {
  if (typeof luaCode !== "string" || luaCode.length === 0) {
    return _emptyAnalysis();
  }

  const features = {
    hasHumanoid: false,
    hasCheckpoints: false,
    hasClickDetectors: false,
    hasTouchTransmitters: false,
    hasDropperLogic: false,
    hasTerrainGeneration: false,
    hasNPCs: false,
    hasAnimations: false,
  };

  const signals = [];

  // ─── HUMANOID DETECTION ───────────────────────────────────────────────
  // User creates Humanoid objects or references character structure
  if (/\bHumanoid\b/.test(luaCode)) {
    features.hasHumanoid = true;
    signals.push("Humanoid");
  }
  if (/\b(Head|Torso|LeftArm|RightArm|LeftLeg|RightLeg)\b/.test(luaCode)) {
    features.hasHumanoid = true;
    signals.push("Humanoid body parts");
  }
  if (/\bMotor6D\b/.test(luaCode)) {
    features.hasHumanoid = true;
    signals.push("Motor6D");
  }

  // ─── CHECKPOINT/OBBY DETECTION ────────────────────────────────────────
  if (/\b(Checkpoint|checkpoint|leaderstats\.Stage)\b/.test(luaCode)) {
    features.hasCheckpoints = true;
    signals.push("Checkpoint logic");
  }

  // ─── SIMULATOR/CLICKER DETECTION ──────────────────────────────────────
  if (/\bClickDetector\b/.test(luaCode)) {
    features.hasClickDetectors = true;
    signals.push("ClickDetector");
  }

  // ─── TOUCH/PROXIMITY DETECTION ────────────────────────────────────────
  if (/\.Touched:Connect\b/.test(luaCode)) {
    features.hasTouchTransmitters = true;
    signals.push("Touch events");
  }

  // ─── TYCOON/DROPPER DETECTION ─────────────────────────────────────────
  if (/\b(Dropper|Conveyor|claim|tycoon)\b/i.test(luaCode)) {
    features.hasDropperLogic = true;
    signals.push("Tycoon/Dropper");
  }

  // ─── TERRAIN GENERATION ───────────────────────────────────────────────
  if (/\bTerrain:Fill\b/.test(luaCode)) {
    features.hasTerrainGeneration = true;
    signals.push("Terrain generation");
  }

  // ─── NPC DETECTION ────────────────────────────────────────────────────
  if (/\b(NPC|npc|Dialogue|dialogue)\b/.test(luaCode)) {
    features.hasNPCs = true;
    signals.push("NPC/Dialogue");
  }

  // ─── ANIMATION DETECTION ──────────────────────────────────────────────
  if (/\b(Animator|Animation|LoadAnimation)\b/.test(luaCode)) {
    features.hasAnimations = true;
    signals.push("Animations");
  }

  // ─── DETERMINE SUPPORT NEEDS ──────────────────────────────────────────
  const supportNeeds = {
    needsHumanoidRig:       features.hasHumanoid && !_hasCompleteRig(luaCode),
    needsR6Structure:       features.hasHumanoid && !_hasR6Parts(luaCode),
    needsMotor6D:           features.hasHumanoid && !/\bMotor6D\b/.test(luaCode),
    needsAnimator:          features.hasAnimations && !/\bAnimator\b/.test(luaCode),
    needsCheckpointSystem:  features.hasCheckpoints && !_hasCheckpointCode(luaCode),
    needsClickHandling:     features.hasClickDetectors && !_hasClickCode(luaCode),
    needsTouchHandling:     features.hasTouchTransmitters && !_hasTouchCode(luaCode),
  };

  // ─── INFER TARGET HINT ────────────────────────────────────────────────
  // This is NOT a hard target — it's a hint for what kind of support to add
  let targetHint = "code-driven";  // default: no template, code drives everything
  if (features.hasCheckpoints) targetHint = "obby-like";
  if (features.hasClickDetectors && !features.hasCheckpoints) targetHint = "simulator-like";
  if (features.hasDropperLogic) targetHint = "tycoon-like";
  if (features.hasNPCs || (features.hasHumanoid && !features.hasCheckpoints)) targetHint = "rpg-like";

  const confidence = signals.length > 0 ? Math.min(1.0, signals.length / 5) : 0.0;

  return {
    features,
    supportNeeds,
    targetHint,
    analysis: {
      summary: _buildSummary(features, supportNeeds, signals),
      confidence,
      signals,
    },
  };
}

function _emptyAnalysis() {
  return {
    features: {},
    supportNeeds: {},
    targetHint: "code-driven",
    analysis: { summary: "No code provided", confidence: 0, signals: [] },
  };
}

function _hasCompleteRig(code) {
  return /Head.*Torso.*LeftArm.*RightArm.*LeftLeg.*RightLeg/s.test(code);
}

function _hasR6Parts(code) {
  const parts = ["Head", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg"];
  return parts.every(p => new RegExp(`\\b${p}\\b`).test(code));
}

function _hasCheckpointCode(code) {
  return /leaderstats.*Stage/.test(code) && /Checkpoint.*Touched/.test(code);
}

function _hasClickCode(code) {
  return /ClickDetector.*MouseClick:Connect/.test(code);
}

function _hasTouchCode(code) {
  return /\.Touched:Connect/.test(code);
}

function _buildSummary(features, supportNeeds, signals) {
  if (signals.length === 0) return "No recognizable gameplay patterns detected";
  
  const detected = [];
  if (features.hasHumanoid) detected.push("Humanoid characters");
  if (features.hasCheckpoints) detected.push("Checkpoint system");
  if (features.hasClickDetectors) detected.push("Click interactions");
  if (features.hasNPCs) detected.push("NPCs");
  
  const needs = [];
  if (supportNeeds.needsHumanoidRig) needs.push("complete R6 rig");
  if (supportNeeds.needsMotor6D) needs.push("Motor6D joints");
  if (supportNeeds.needsAnimator) needs.push("Animator");
  
  let summary = `Detected: ${detected.join(", ")}`;
  if (needs.length > 0) summary += ` | Needs: ${needs.join(", ")}`;
  return summary;
}

export default { analyzeCodeFeatures };

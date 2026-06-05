// t3/Factory/rbx-production/quality-metrics.js
// AF51-RBX | T3 Layer — QualityGate V3 metric helpers (v62)
// Role  : Pure functions for computing Masterpiece-grade metrics on the
//         finished SceneGraph: cube ratio, untrimmed platform ratio,
//         tier coverage, rule coverage, composite Quality Score.

import { MASTERPIECE_RULES } from "./masterpiece-rules.js";

// Pull all numbers out of a Vector3.new(...) / CFrame.new(...) string.
// Skips the leading "3" of the class name (matches the v61 pattern).
function _nums(str) {
  if (typeof str !== "string") return [];
  const all = str.match(/-?\d+\.?\d*/g) || [];
  // Constructors start with Vector3/CFrame/Color3 — first numeric token
  // is part of the class identifier.
  if (/^(Vector3|Color3|CFrame|UDim2?|BrickColor)/.test(str)) return all.slice(1).map(Number);
  return all.map(Number);
}

function _sizeOf(node) {
  const s = node.properties && node.properties.Size;
  if (!s) return null;
  const v = _nums(s);
  if (v.length < 3) return null;
  return [v[0], v[1], v[2]];
}

function _posOf(node) {
  const props = node.properties || {};
  if (props.Position) {
    const v = _nums(props.Position);
    if (v.length >= 3) return [v[0], v[1], v[2]];
  }
  if (props.CFrame) {
    const v = _nums(props.CFrame);
    if (v.length >= 3) return [v[0], v[1], v[2]];
  }
  return null;
}

// Cube = aspect ratio max/min < 1.4 AND no Shape override (sphere/cylinder
// already escape the "boxes" critique). Returns { total, cubes, ratio }.
export function cubeRatio(graph) {
  let total = 0, cubes = 0;
  for (const n of graph.nodes) {
    if (n.className !== "Part") continue;
    const shape = n.properties && n.properties.Shape;
    if (shape && shape !== "Enum.PartType.Block") continue;  // ball/cylinder/wedge → not cube
    const s = _sizeOf(n);
    if (!s) continue;
    const mn = Math.min(s[0], s[1], s[2]);
    const mx = Math.max(s[0], s[1], s[2]);
    if (mn <= 0) continue;
    total++;
    if (mx / mn < 1.4) cubes++;
  }
  return { total, cubes, ratio: total ? cubes / total : 0 };
}

// Untrimmed platform = floor/primary Part with no trim/secondary neighbour
// within `radius` studs (XZ). Ratio of untrimmed floors over total floors.
export function untrimmedPlatformRatio(graph, { radius = 18 } = {}) {
  const floors = [];
  const trims  = [];
  for (const n of graph.nodes) {
    if (n.className !== "Part") continue;
    const p = _posOf(n);
    if (!p) continue;
    if (n.tags.includes("floor") || n.tags.includes("tier:1")) floors.push({ n, p });
    if (n.tags.includes("trim") || n.tags.includes("tier:2") ||
        n.tags.includes("railing") || n.tags.includes("pillar") ||
        n.tags.includes("wall")) trims.push({ n, p });
  }
  if (!floors.length) return { total: 0, untrimmed: 0, ratio: 0 };
  let untrimmed = 0;
  const r2 = radius * radius;
  for (const f of floors) {
    let hit = false;
    for (const t of trims) {
      const dx = f.p[0] - t.p[0], dz = f.p[2] - t.p[2];
      if (dx * dx + dz * dz <= r2) { hit = true; break; }
    }
    if (!hit) untrimmed++;
  }
  return { total: floors.length, untrimmed, ratio: untrimmed / floors.length };
}

export function tierCoverage(graph) {
  const perTier = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const n of graph.nodes) {
    for (const t of n.tags) {
      if (!t.startsWith("tier:")) continue;
      const k = Number(t.slice(5));
      if (perTier[k] !== undefined) perTier[k]++;
    }
  }
  const present = Object.values(perTier).filter((v) => v > 0).length;
  return { present, perTier };
}

export function ruleCoverage(graph, target) {
  const type = String(target?.type || target?.id || "").toLowerCase();
  const rules = MASTERPIECE_RULES[type];
  if (!rules) return { total: 0, satisfied: 0, ratio: 1, missing: [] };
  const seen = new Set();
  for (const n of graph.nodes) {
    for (const t of n.tags) if (t.startsWith("rule:")) seen.add(t);
  }
  const missing = rules.requiredTags.filter((t) => !seen.has(t));
  const satisfied = rules.requiredTags.length - missing.length;
  return {
    total:     rules.requiredTags.length,
    satisfied,
    ratio:     rules.requiredTags.length ? satisfied / rules.requiredTags.length : 1,
    missing,
    identity:  rules.identity,
  };
}

// 0..1 helper.
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Composite Masterpiece Quality Score on 0..100. Weighted blend.
export function qualityScore(parts) {
  const w = {
    parts: 10, modules: 8, tiers: 10, hero: 5, silhouette: 10,
    traversal: 6, layers: 6, materials: 5, polish: 10, propClusters: 5,
    rules: 10, cube: 10, untrimmed: 5,
  };
  const f = {
    parts:        clamp01(parts.parts / parts.minParts),
    modules:      clamp01(parts.moduleCategories / 4),
    tiers:        clamp01(parts.tierPresent / 6),
    hero:         parts.landmarks > 0 ? 1 : 0,
    silhouette:   clamp01(parts.silhouette / 12),
    traversal:    clamp01(parts.traversal / 6),
    layers:       clamp01(parts.layerPresent / 4),
    materials:    clamp01(parts.materialDiversity / 5),
    polish:       clamp01(parts.polishTier / 8),
    propClusters: clamp01(parts.propTier / 10),
    rules:        parts.ruleRatio,
    cube:         clamp01(1 - parts.cubeRatio / 0.35),
    untrimmed:    clamp01(1 - parts.untrimmedRatio / 0.25),
  };
  let total = 0;
  for (const k of Object.keys(w)) total += w[k] * f[k];
  return { score: Math.round(total), factors: f, weights: w };
}

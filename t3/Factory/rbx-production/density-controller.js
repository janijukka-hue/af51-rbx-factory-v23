// t3/Factory/rbx-production/density-controller.js
// AF51-RBX | T3 Layer — DensityController
// Role  : Per-target zone density budgets. Reads zone-budgets.json, computes
//         current density per zone from existing tagged Parts, and tops up
//         underdense zones with deterministic module placements taken from
//         the Modular Structure Kit. Idempotent: re-running produces the
//         same node count.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ModuleLibrary } from "./module-library.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUDGET_FILE = path.join(__dirname, "zone-budgets.json");
const BUDGETS = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));

// Per-target anchor positions for each zone. Density Controller drops props
// in a deterministic ring/grid centred on these anchors. Keep these aligned
// with CompositionEngine's primary layout.
const ZONE_ANCHORS = {
  obby: {
    spawnZone:    { cx:  0, cz:   0, radius: 14 },
    obstacleZone: { cx:  0, cz:  44, radius: 26 },
    finishZone:   { cx:  0, cz:  90, radius: 14 },
  },
  tycoon: {
    spawnZone:      { cx:  0, cz:   0, radius: 12 },
    productionZone: { cx:  0, cz:   0, radius: 28 },
    perimeterZone:  { cx:  0, cz:   0, radius: 34 },
  },
  simulator: {
    spawnZone:     { cx:  0, cz: -36, radius: 12 },
    arenaZone:     { cx:  0, cz:   0, radius: 30 },
    perimeterZone: { cx:  0, cz:   0, radius: 42 },
  },
  fps: {
    spawnZone:     { cx: -45, cz:   0, radius: 12 },
    combatZone:    { cx:   0, cz:   0, radius: 38 },
    perimeterZone: { cx:   0, cz:   0, radius: 56 },
  },
  rpg: {
    spawnZone:     { cx:  0, cz:   0, radius: 12 },
    villageZone:   { cx:  0, cz:   0, radius: 22 },
    perimeterZone: { cx:  0, cz:   0, radius: 28 },
  },
};

function _countExistingInZone(graph, anchor) {
  let count = 0;
  for (const n of graph.nodes) {
    if (n.className !== "Part") continue;
    const pos = _readPos(n.properties);
    if (!pos) continue;
    const dx = pos[0] - anchor.cx;
    const dz = pos[2] - anchor.cz;
    if (Math.sqrt(dx * dx + dz * dz) <= anchor.radius) count++;
  }
  return count;
}

function _readPos(props) {
  const src = props.Position || props.CFrame;
  if (!src) return null;
  // Strip the constructor prefix (Vector3.new / CFrame.new) so the leading
  // digit in the type name can't be misread as a coordinate.
  const inner = String(src).replace(/[A-Za-z_][A-Za-z0-9_.]*\s*\(/, "(");
  const m = inner.match(/-?\d+\.?\d*/g);
  if (!m || m.length < 3) return null;
  return [parseFloat(m[0]), parseFloat(m[1]), parseFloat(m[2])];
}

// Deterministic ring layout: position N points evenly around (cx, cz) on radius r.
function _ringSlot(i, n, cx, cz, r) {
  const angle = (i / n) * Math.PI * 2;
  return { x: cx + Math.round(Math.cos(angle) * r), z: cz + Math.round(Math.sin(angle) * r) };
}

function _placeOne(graph, moduleId, x, y, z, namePrefix, zoneTag) {
  const [category, factory] = moduleId.split(".");
  return ModuleLibrary.place(graph, category, factory,
    { x, y, z, namePrefix },
    { namePrefix: "Density_" + zoneTag, tags: ["density", "zone:" + zoneTag] });
}

export const DensityController = {
  apply({ graph, target }) {
    const type    = String(target.type || target.id || "").toLowerCase();
    const budgets = BUDGETS[type] || {};
    const anchors = ZONE_ANCHORS[type] || {};
    const zoneReports = {};
    let totalAdded = 0;

    const zoneNames = Object.keys(budgets).sort();
    for (const zoneName of zoneNames) {
      const cfg    = budgets[zoneName];
      const anchor = anchors[zoneName];
      if (!anchor || !cfg) {
        zoneReports[zoneName] = { skipped: true };
        continue;
      }
      const existing = _countExistingInZone(graph, anchor);
      const needed   = Math.max(0, cfg.minProps - existing);
      let added = 0;
      if (needed > 0 && cfg.modules.length > 0) {
        const radius = Math.max(8, anchor.radius * 0.85);
        for (let i = 0; i < needed; i++) {
          const moduleId = cfg.modules[i % cfg.modules.length];
          const slot     = _ringSlot(i, needed, anchor.cx, anchor.cz, radius);
          const nodes    = _placeOne(graph, moduleId, slot.x, 0, slot.z, "z" + zoneName + "_" + i, zoneName);
          added += nodes.length;
        }
      }
      zoneReports[zoneName] = { existing, target: cfg.minProps, added, ok: existing + added >= cfg.minProps };
      totalAdded += added;
    }

    return { ok: true, type, totalAdded, zones: zoneReports };
  },
};

export default DensityController;
